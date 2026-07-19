"""Integration: savings goals (finance_goals) — CRUD, contributions, and the
one-time "goal reached" notification, mirroring the budget-exceeded pattern
in test_fase7_extras.py."""
import pytest

from .conftest import register_and_login


@pytest.mark.asyncio
async def test_goal_crud_and_contribution_progress(client):
    session = await register_and_login(client)
    headers = session["headers"]

    create = await client.post(
        "/finance/goals",
        json={"name": "Viagem", "target_amount": 1000, "color": "#2563EB"},
        headers=headers,
    )
    assert create.status_code == 201, create.text
    goal = create.json()
    # NUMERIC(18,8) zero round-trips through Decimal as "0E-8", not "0" —
    # same DB quirk documented/fixed for CSV export in shared/csv_export.py.
    assert float(goal["current_amount"]) == 0
    assert float(goal["pct_complete"]) == 0
    assert goal["is_complete"] is False

    listing = await client.get("/finance/goals", headers=headers)
    assert len(listing.json()) == 1

    contribute = await client.post(
        f"/finance/goals/{goal['id']}/contributions",
        json={"amount": 250, "note": "Aporte inicial"},
        headers=headers,
    )
    assert contribute.status_code == 201
    updated = contribute.json()
    assert updated["current_amount"] == "250.00000000"
    assert updated["pct_complete"] == "0.25"
    assert updated["is_complete"] is False

    history = await client.get(f"/finance/goals/{goal['id']}/contributions", headers=headers)
    assert len(history.json()) == 1
    assert history.json()[0]["amount"] == "250.00000000"

    rename = await client.put(
        f"/finance/goals/{goal['id']}", json={"name": "Viagem Europa"}, headers=headers
    )
    assert rename.status_code == 200
    assert rename.json()["name"] == "Viagem Europa"
    assert rename.json()["current_amount"] == "250.00000000"  # unaffected by rename

    deleted = await client.delete(f"/finance/goals/{goal['id']}", headers=headers)
    assert deleted.status_code == 204
    assert (await client.get("/finance/goals", headers=headers)).json() == []


@pytest.mark.asyncio
async def test_goal_reached_notifies_once(client):
    session = await register_and_login(client)
    headers = session["headers"]

    goal = (
        await client.post(
            "/finance/goals", json={"name": "Reserva", "target_amount": 100}, headers=headers
        )
    ).json()

    # first contribution: under target, no notification
    await client.post(
        f"/finance/goals/{goal['id']}/contributions", json={"amount": 60}, headers=headers
    )
    assert (await client.get("/notifications", headers=headers)).json()["unread_count"] == 0

    # second contribution crosses the target — notifies exactly once
    second = await client.post(
        f"/finance/goals/{goal['id']}/contributions", json={"amount": 50}, headers=headers
    )
    assert second.json()["is_complete"] is True
    assert (await client.get("/notifications", headers=headers)).json()["unread_count"] == 1

    # further contributions after completion don't spam another notification
    await client.post(
        f"/finance/goals/{goal['id']}/contributions", json={"amount": 10}, headers=headers
    )
    assert (await client.get("/notifications", headers=headers)).json()["unread_count"] == 1


@pytest.mark.asyncio
async def test_goal_pct_complete_caps_at_one_when_overfunded(client):
    session = await register_and_login(client)
    headers = session["headers"]

    goal = (
        await client.post(
            "/finance/goals", json={"name": "Emergência", "target_amount": 100}, headers=headers
        )
    ).json()
    result = await client.post(
        f"/finance/goals/{goal['id']}/contributions", json={"amount": 150}, headers=headers
    )
    assert result.json()["pct_complete"] == "1"
    assert result.json()["current_amount"] == "150.00000000"


@pytest.mark.asyncio
async def test_goal_withdrawal_reduces_current_amount(client):
    session = await register_and_login(client)
    headers = session["headers"]

    goal = (
        await client.post(
            "/finance/goals", json={"name": "Carro", "target_amount": 500}, headers=headers
        )
    ).json()
    await client.post(f"/finance/goals/{goal['id']}/contributions", json={"amount": 300}, headers=headers)
    withdraw = await client.post(
        f"/finance/goals/{goal['id']}/contributions", json={"amount": -100, "note": "Emergência"}, headers=headers
    )
    assert withdraw.status_code == 201
    assert withdraw.json()["current_amount"] == "200.00000000"


@pytest.mark.asyncio
async def test_zero_contribution_rejected(client):
    session = await register_and_login(client)
    headers = session["headers"]

    goal = (
        await client.post(
            "/finance/goals", json={"name": "Teste", "target_amount": 500}, headers=headers
        )
    ).json()
    resp = await client.post(f"/finance/goals/{goal['id']}/contributions", json={"amount": 0}, headers=headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_goals_are_isolated_per_user(client):
    a = await register_and_login(client)
    b = await register_and_login(client)
    await client.post("/finance/goals", json={"name": "A's goal", "target_amount": 100}, headers=a["headers"])

    assert len((await client.get("/finance/goals", headers=a["headers"])).json()) == 1
    assert (await client.get("/finance/goals", headers=b["headers"])).json() == []


@pytest.mark.asyncio
async def test_archived_goals_excluded_by_default(client):
    session = await register_and_login(client)
    headers = session["headers"]
    goal = (
        await client.post(
            "/finance/goals", json={"name": "Antiga", "target_amount": 100}, headers=headers
        )
    ).json()

    await client.put(f"/finance/goals/{goal['id']}", json={"is_archived": True}, headers=headers)

    assert (await client.get("/finance/goals", headers=headers)).json() == []
    all_goals = await client.get("/finance/goals?include_archived=true", headers=headers)
    assert len(all_goals.json()) == 1
