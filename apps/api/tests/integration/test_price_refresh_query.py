"""price_refresh_job's asset-selection query — antes só pegava ativos com
posição em carteira, então um ticker só na watchlist (ou só com um alerta
ativo, nunca comprado) ficava com last_price sempre nulo e o alerta jamais
disparava. Verifica a query real do job (não uma cópia) contra o Postgres."""
import pytest

from src.workers.price_refresh import _relevant_assets_query


@pytest.mark.asyncio
async def test_asset_apenas_na_watchlist_agora_entra_no_refresh(client, db_session):
    from .conftest import register_and_login

    a = await register_and_login(client)
    created = await client.post("/watchlist", json={"ticker": "MGLU3"}, headers=a["headers"])
    assert created.status_code == 201

    result = await db_session.execute(_relevant_assets_query())
    tickers = {asset.ticker for asset in result.scalars().all()}
    assert "MGLU3" in tickers


@pytest.mark.asyncio
async def test_asset_apenas_com_alerta_ativo_agora_entra_no_refresh(client, db_session):
    from .conftest import register_and_login

    a = await register_and_login(client)
    created = await client.post(
        "/alerts", json={"ticker": "BBAS3", "alert_type": "price_above", "threshold": "50"}, headers=a["headers"]
    )
    assert created.status_code == 201

    result = await db_session.execute(_relevant_assets_query())
    tickers = {asset.ticker for asset in result.scalars().all()}
    assert "BBAS3" in tickers


@pytest.mark.asyncio
async def test_alerta_ja_disparado_nao_forca_refresh_sozinho(client, db_session):
    """Um alerta triggered (is_active=False) não deve, por si só, manter o
    ativo elegível — evita reprocessar preços de alertas já resolvidos."""
    from sqlalchemy import update

    from src.portfolio.models import PriceAlert
    from .conftest import register_and_login

    a = await register_and_login(client)
    created = await client.post(
        "/alerts", json={"ticker": "CYRE3", "alert_type": "price_above", "threshold": "20"}, headers=a["headers"]
    )
    alert_id = created.json()["id"]
    await db_session.execute(update(PriceAlert).where(PriceAlert.id == alert_id).values(is_active=False))
    await db_session.commit()

    result = await db_session.execute(_relevant_assets_query())
    tickers = {asset.ticker for asset in result.scalars().all()}
    assert "CYRE3" not in tickers


@pytest.mark.asyncio
async def test_asset_sem_carteira_watchlist_ou_alerta_fica_fora(client, db_session):
    """Um Asset que existe (ex: criado por outro fluxo) mas não é seguido por
    ninguém não deve entrar no refresh — evita gastar orçamento de API com
    tickers que ninguém está olhando."""
    from src.portfolio.models import Asset
    from src.market_data.base import default_currency_for_ticker

    orphan = Asset(ticker="ORPHAN99", name="ORPHAN99", asset_type="stock", currency=default_currency_for_ticker("ORPHAN99"))
    db_session.add(orphan)
    await db_session.commit()

    result = await db_session.execute(_relevant_assets_query())
    tickers = {asset.ticker for asset in result.scalars().all()}
    assert "ORPHAN99" not in tickers
