"""Integration: portfolio → position → buy/sell transactions → summary (WAC)."""
from datetime import date, timedelta
from decimal import Decimal

import pytest

from src.market_data.base import Quote
from src.portfolio import service
from .conftest import register_and_login


async def _create_portfolio_with_position(client, headers, ticker="PETR4"):
    portfolio = await client.post("/portfolios/", json={"name": "Carteira BR", "currency": "BRL"}, headers=headers)
    assert portfolio.status_code == 201, portfolio.text
    portfolio_id = portfolio.json()["id"]

    position = await client.post(
        f"/portfolios/{portfolio_id}/positions",
        json={"ticker": ticker, "target_weight": 0.3},
        headers=headers,
    )
    assert position.status_code == 201, position.text
    return portfolio_id, position.json()["id"]


@pytest.mark.asyncio
async def test_weighted_average_cost_on_multiple_buys(client):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio_id, position_id = await _create_portfolio_with_position(client, headers)

    # Buy 1: 100 @ 30.50 + 5 fees -> total 3055.00, avg_cost 30.55
    buy1 = await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "buy",
            "quantity": 100, "unit_price": 30.50, "fees": 5, "fx_rate": 1,
            "transaction_date": "2026-01-15T12:00:00Z",
        },
        headers=headers,
    )
    assert buy1.status_code == 201, buy1.text
    assert buy1.json()["total_amount"] == "3055.00000000"

    # Buy 2: 50 @ 32.00 + 0 fees -> total 1600.00
    buy2 = await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "buy",
            "quantity": 50, "unit_price": 32.00, "fees": 0, "fx_rate": 1,
            "transaction_date": "2026-02-10T12:00:00Z",
        },
        headers=headers,
    )
    assert buy2.status_code == 201, buy2.text

    summary = await client.get(f"/portfolios/{portfolio_id}/summary", headers=headers)
    assert summary.status_code == 200
    position = summary.json()["positions"][0]
    assert position["quantity"] == "150.00000000"
    # WAC = (3055 + 1600) / 150 = 31.033333...
    assert position["avg_cost"].startswith("31.03")
    assert position["cost_basis_brl"] == "4655.00000000"


@pytest.mark.asyncio
async def test_sell_reduces_quantity_and_cost_proportionally(client):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio_id, position_id = await _create_portfolio_with_position(client, headers)

    await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "buy",
            "quantity": 100, "unit_price": 10, "fees": 0, "fx_rate": 1,
            "transaction_date": "2026-01-01T12:00:00Z",
        },
        headers=headers,
    )
    sell = await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "sell",
            "quantity": 40, "unit_price": 12, "fees": 0, "fx_rate": 1,
            "transaction_date": "2026-03-01T12:00:00Z",
        },
        headers=headers,
    )
    assert sell.status_code == 201, sell.text

    summary = await client.get(f"/portfolios/{portfolio_id}/summary", headers=headers)
    position = summary.json()["positions"][0]
    assert position["quantity"] == "60.00000000"
    # cost basis reduced proportionally: 1000 * (1 - 40/100) = 600
    assert position["cost_basis_brl"] == "600.00000000"


@pytest.mark.asyncio
async def test_sell_more_than_held_is_rejected(client):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio_id, position_id = await _create_portfolio_with_position(client, headers)

    await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "buy",
            "quantity": 10, "unit_price": 10, "fees": 0, "fx_rate": 1,
            "transaction_date": "2026-01-01T12:00:00Z",
        },
        headers=headers,
    )
    sell = await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "sell",
            "quantity": 999, "unit_price": 10, "fees": 0, "fx_rate": 1,
            "transaction_date": "2026-02-01T12:00:00Z",
        },
        headers=headers,
    )
    assert sell.status_code == 422


@pytest.mark.asyncio
async def test_empty_portfolio_summary_has_zeroed_totals(client):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio = await client.post("/portfolios/", json={"name": "Vazio", "currency": "BRL"}, headers=session["headers"])
    portfolio_id = portfolio.json()["id"]

    summary = await client.get(f"/portfolios/{portfolio_id}/summary", headers=headers)
    assert summary.status_code == 200
    body = summary.json()
    assert body["positions"] == []
    assert body["total_invested_brl"] == "0"
    assert body["allocation_by_type"] == []
    # Sem aporte nenhum, não há fluxo de caixa pra calcular XIRR.
    assert body["xirr_percent"] is None


@pytest.mark.asyncio
async def test_xirr_percent_reflects_a_known_annualized_gain(client, monkeypatch):
    """XIRR (retorno ponderado pelo dinheiro): compra 100 PETR4 a R$10 exatos
    365 dias atrás (o que sobra de 2026, não bissexto, entre um aporte e uma
    avaliação de hoje); com a cotação ao vivo em R$20, o valor dobrou em
    exatamente um ano — XIRR anualizado tem que ficar perto de +100%, não de
    0% (o que _get_portfolio_cash_flows sem o valor de mercado final
    produziria) nem de algo fora de qualquer realidade."""
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio_id, position_id = await _create_portfolio_with_position(client, headers)

    buy_date = date.today() - timedelta(days=365)
    buy = await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "buy",
            "quantity": 100, "unit_price": 10, "fees": 0, "fx_rate": 1,
            "transaction_date": f"{buy_date.isoformat()}T12:00:00Z",
        },
        headers=headers,
    )
    assert buy.status_code == 201, buy.text

    class _DoublePriceProvider:
        async def get_quotes(self, tickers):
            return {t: Quote(ticker=t, price=Decimal("20"), currency="BRL") for t in tickers}

    monkeypatch.setattr(service, "get_provider", lambda *a, **kw: _DoublePriceProvider())

    summary = await client.get(f"/portfolios/{portfolio_id}/summary", headers=headers)
    assert summary.status_code == 200
    body = summary.json()
    assert body["total_market_value_brl"] == "2000.00"

    xirr = Decimal(body["xirr_percent"])
    assert Decimal("80") < xirr < Decimal("120"), (
        f"esperava XIRR perto de +100% (dobrou em 1 ano), veio {xirr}"
    )


@pytest.mark.asyncio
async def test_duplicate_position_for_same_ticker_conflicts(client):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio_id, _ = await _create_portfolio_with_position(client, headers)

    dup = await client.post(
        f"/portfolios/{portfolio_id}/positions", json={"ticker": "PETR4"}, headers=headers
    )
    assert dup.status_code == 409


# ---------------------------------------------------------------------------
# Auditoria de câmbio em ativo internacional
# ---------------------------------------------------------------------------

async def _seed_usd_fx(db_session, rate="5.40", when=None):
    from src.portfolio.models import FxRate

    db_session.add(FxRate(
        from_currency="USD", to_currency="BRL",
        rate=Decimal(rate), date=when or date(2026, 1, 1),
    ))
    await db_session.commit()


@pytest.mark.asyncio
async def test_transaction_without_fx_rate_uses_the_asset_currency_rate(client, db_session):
    """Lançamento em ativo de dólar sem informar câmbio não pode virar 1:1.

    Era o que a UI mandava (fx_rate fixo em 1): o custo ficava gravado em
    dólar num campo lido como real, e a posição aparecia com lucro fantasma
    do tamanho do próprio câmbio.
    """
    await _seed_usd_fx(db_session)
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio_id, position_id = await _create_portfolio_with_position(client, headers, ticker="VWO")

    created = await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "buy",
            "quantity": 10, "unit_price": 100, "fees": 0,
            "transaction_date": "2026-02-01T12:00:00Z",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert Decimal(body["fx_rate"]) == Decimal("5.40")
    # 10 × US$100 × 5,40 = R$ 5.400, não R$ 1.000
    assert Decimal(body["total_amount"]) == Decimal("5400")


@pytest.mark.asyncio
async def test_audit_flags_a_foreign_asset_bought_with_fx_rate_one(client, db_session):
    await _seed_usd_fx(db_session)
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio_id, position_id = await _create_portfolio_with_position(client, headers, ticker="VWO")

    await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "buy",
            "quantity": 10, "unit_price": 100, "fees": 0, "fx_rate": 1,
            "transaction_date": "2026-02-01T12:00:00Z",
        },
        headers=headers,
    )

    audit = await client.get(f"/portfolios/{portfolio_id}/audit", headers=headers)
    assert audit.status_code == 200, audit.text
    body = audit.json()
    assert body["issue_count"] == 1
    position = body["positions"][0]
    assert position["ticker"] == "VWO"
    assert position["issues"][0]["code"] == "fx_rate_missing"
    # A conta aberta que explica o total vem junto.
    assert Decimal(position["quantity"]) == Decimal("10")
    assert Decimal(position["fx_rate"]) == Decimal("5.40")


@pytest.mark.asyncio
async def test_repair_fx_rewrites_cost_with_the_historical_rate(client, db_session):
    await _seed_usd_fx(db_session)
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio_id, position_id = await _create_portfolio_with_position(client, headers, ticker="VWO")

    await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "buy",
            "quantity": 10, "unit_price": 100, "fees": 0, "fx_rate": 1,
            "transaction_date": "2026-02-01T12:00:00Z",
        },
        headers=headers,
    )

    repair = await client.post(f"/portfolios/{portfolio_id}/audit/repair-fx", headers=headers)
    assert repair.status_code == 200, repair.text
    assert repair.json()["transactions_repaired"] == 1
    assert repair.json()["positions_recalculated"] == 1

    audit = await client.get(f"/portfolios/{portfolio_id}/audit", headers=headers)
    body = audit.json()
    assert body["issue_count"] == 0
    # Custo passa de R$ 1.000 (dólar lido como real) para R$ 5.400.
    assert Decimal(body["positions"][0]["cost_basis_brl"]) == Decimal("5400")

    # Idempotente: rodar de novo não acha mais nada pra corrigir.
    again = await client.post(f"/portfolios/{portfolio_id}/audit/repair-fx", headers=headers)
    assert again.json()["transactions_repaired"] == 0


@pytest.mark.asyncio
async def test_repair_clears_stale_snapshots_even_without_fx_issues(client, db_session):
    """`portfolio_snapshots` grava um valor por dia e nunca revisita o
    passado — um snapshot gravado enquanto uma posição esteve com a
    quantidade errada (ex.: o bug de separador de milhar) infla aquele dia
    pra sempre no gráfico de performance, mesmo depois da transação já
    estar correta. O reparo precisa limpar isso mesmo quando não há nenhuma
    transação de câmbio pra corrigir — é exatamente esse o caso relatado:
    câmbio já certo, gráfico ainda errado.
    """
    import uuid
    from sqlalchemy import select
    from src.portfolio.models import PortfolioSnapshot

    session = await register_and_login(client)
    headers = session["headers"]
    portfolio_id, _ = await _create_portfolio_with_position(client, headers)
    portfolio_uuid = uuid.UUID(portfolio_id)

    db_session.add(PortfolioSnapshot(
        portfolio_id=portfolio_uuid, user_id=uuid.UUID(session["user_id"]),
        snapshot_date=date(2026, 1, 15),
        total_value=Decimal("400000"), total_invested=Decimal("1000"), total_pnl=Decimal("399000"),
    ))
    await db_session.commit()

    repair = await client.post(f"/portfolios/{portfolio_id}/audit/repair-fx", headers=headers)
    assert repair.status_code == 200, repair.text
    body = repair.json()
    assert body["transactions_repaired"] == 0
    assert body["snapshots_cleared"] == 1

    remaining = await db_session.execute(
        select(PortfolioSnapshot).where(PortfolioSnapshot.portfolio_id == portfolio_uuid)
    )
    assert remaining.scalars().all() == []


@pytest.mark.asyncio
async def test_audit_leaves_brl_assets_alone(client):
    session = await register_and_login(client)
    headers = session["headers"]
    portfolio_id, position_id = await _create_portfolio_with_position(client, headers)

    await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_id, "transaction_type": "buy",
            "quantity": 100, "unit_price": 30, "fees": 0, "fx_rate": 1,
            "transaction_date": "2026-02-01T12:00:00Z",
        },
        headers=headers,
    )

    audit = await client.get(f"/portfolios/{portfolio_id}/audit", headers=headers)
    # Câmbio 1 em ativo brasileiro é o correto — não é problema.
    assert audit.json()["issue_count"] == 0


# ---------------------------------------------------------------------------
# Consolidado — soma de todas as carteiras do usuário
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_consolidated_summary_sums_positions_across_portfolios(client, monkeypatch):
    """Duas carteiras, um ativo diferente em cada — o consolidado soma os
    totais e cada posição carrega de qual carteira ela veio (nunca uma soma
    das duas, mesmo que fosse o mesmo ticker: são lotes/custos distintos)."""
    session = await register_and_login(client)
    headers = session["headers"]

    portfolio_a, position_a = await _create_portfolio_with_position(client, headers, ticker="PETR4")
    portfolio_b = await client.post("/portfolios/", json={"name": "Carteira 2", "currency": "BRL"}, headers=headers)
    portfolio_b_id = portfolio_b.json()["id"]
    position_b = await client.post(
        f"/portfolios/{portfolio_b_id}/positions", json={"ticker": "VALE3"}, headers=headers
    )
    position_b_id = position_b.json()["id"]

    await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_a, "transaction_type": "buy",
            "quantity": 100, "unit_price": 10, "fees": 0, "fx_rate": 1,
            "transaction_date": "2026-01-01T12:00:00Z",
        },
        headers=headers,
    )
    await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_b_id, "transaction_type": "buy",
            "quantity": 50, "unit_price": 20, "fees": 0, "fx_rate": 1,
            "transaction_date": "2026-01-02T12:00:00Z",
        },
        headers=headers,
    )

    class _FixedPriceProvider:
        async def get_quotes(self, tickers):
            prices = {"PETR4": Decimal("10"), "VALE3": Decimal("20")}
            return {t: Quote(ticker=t, price=prices[t], currency="BRL") for t in tickers}

    monkeypatch.setattr(service, "get_provider", lambda *a, **kw: _FixedPriceProvider())

    # Cada carteira isolada primeiro, pra conferir contra o que o
    # consolidado deveria somar.
    summary_a = await client.get(f"/portfolios/{portfolio_a}/summary", headers=headers)
    summary_b = await client.get(f"/portfolios/{portfolio_b_id}/summary", headers=headers)
    value_a = Decimal(summary_a.json()["total_market_value_brl"])
    value_b = Decimal(summary_b.json()["total_market_value_brl"])

    consolidated = await client.get("/portfolios/consolidated/summary", headers=headers)
    assert consolidated.status_code == 200, consolidated.text
    body = consolidated.json()

    assert Decimal(body["total_market_value_brl"]) == value_a + value_b
    assert body["portfolio_count"] == 2
    assert len(body["positions"]) == 2

    by_ticker = {p["ticker"]: p for p in body["positions"]}
    assert by_ticker["PETR4"]["portfolio_id"] == portfolio_a
    assert by_ticker["PETR4"]["portfolio_name"] == "Carteira BR"
    assert by_ticker["VALE3"]["portfolio_id"] == portfolio_b_id
    assert by_ticker["VALE3"]["portfolio_name"] == "Carteira 2"

    # Peso recalculado contra o total combinado (as duas juntas somam 100%),
    # não mais contra o total de cada carteira isolada.
    total_weight = sum(Decimal(p["weight"]) for p in body["positions"])
    assert abs(total_weight - Decimal("1")) < Decimal("0.0001")

    # Rebalanceamento por carteira não faz sentido misturado — vem nulo.
    assert all(p["rebalance_action"] is None for p in body["positions"])


@pytest.mark.asyncio
async def test_consolidated_summary_with_no_portfolios_is_zeroed(client):
    session = await register_and_login(client)
    headers = session["headers"]

    consolidated = await client.get("/portfolios/consolidated/summary", headers=headers)
    assert consolidated.status_code == 200
    body = consolidated.json()
    assert body["portfolio_count"] == 0
    assert body["positions"] == []
    assert Decimal(body["total_market_value_brl"]) == 0


@pytest.mark.asyncio
async def test_consolidated_performance_spans_the_earliest_transaction_across_portfolios(client):
    """period=max some duas carteiras: o início da série é a transação mais
    antiga entre TODAS as carteiras, não só a mais recente a ser criada."""
    session = await register_and_login(client)
    headers = session["headers"]

    portfolio_a, position_a = await _create_portfolio_with_position(client, headers, ticker="PETR4")
    portfolio_b = await client.post("/portfolios/", json={"name": "Carteira 2", "currency": "BRL"}, headers=headers)
    portfolio_b_id = portfolio_b.json()["id"]
    position_b = await client.post(
        f"/portfolios/{portfolio_b_id}/positions", json={"ticker": "VALE3"}, headers=headers
    )
    position_b_id = position_b.json()["id"]

    old_date = date.today() - timedelta(days=200)
    recent_date = date.today() - timedelta(days=10)
    await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_a, "transaction_type": "buy",
            "quantity": 10, "unit_price": 10, "fees": 0, "fx_rate": 1,
            "transaction_date": f"{old_date.isoformat()}T12:00:00Z",
        },
        headers=headers,
    )
    await client.post(
        "/portfolios/transactions",
        json={
            "position_id": position_b_id, "transaction_type": "buy",
            "quantity": 10, "unit_price": 10, "fees": 0, "fx_rate": 1,
            "transaction_date": f"{recent_date.isoformat()}T12:00:00Z",
        },
        headers=headers,
    )

    performance = await client.get(
        "/portfolios/consolidated/performance", params={"period": "max"}, headers=headers
    )
    assert performance.status_code == 200, performance.text
    series = performance.json()
    assert series[0]["date"] == old_date.isoformat()
    assert series[-1]["date"] == date.today().isoformat()

    benchmark = await client.get(
        "/portfolios/consolidated/benchmark", params={"period": "max"}, headers=headers
    )
    assert benchmark.status_code == 200, benchmark.text
