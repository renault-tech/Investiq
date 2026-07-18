"""Seed a demo account for local QA and screenshots.

Run from apps/api with the target database configured via DATABASE_URL /
REDIS_URL (defaults match infrastructure/docker-compose.yml):

    python -m scripts.seed_demo

Idempotent: if the demo user already exists, the script exits without making
changes (delete the user's row — cascades — and re-run to reseed).

Creates:
- 1 user (demo@investiq.local / Demo12345!)
- 2 portfolios: "Carteira BR" (PETR4, VALE3, HGLG11) and "Internacional"
  (AAPL, VOO) with ~30 buy/sell/dividend transactions over 18 months
- Finance categories (PT-BR seed) + ~60 transactions over 6 months,
  3 of them recurring
- 1 credit card with an invoice already in 'review' status (items
  pre-populated — no LLM call needed to explore the review UI)
"""
import asyncio
import random
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from src.database import AsyncSessionLocal
import src.auth.models  # noqa: F401 — registers relationship targets (see migrations/env.py)
import src.analysis.models  # noqa: F401
import src.cards.models  # noqa: F401
from src.auth.models import User
from src.auth.service import hash_password
from src.portfolio import service as portfolio_service
from src.finance import service as finance_service
from src.finance.models import FinanceCategory
from src.cards.models import CreditCard, CardInvoice, InvoiceItem

DEMO_EMAIL = "demo@investiq.local"
DEMO_PASSWORD = "Demo12345!"

BR_TICKERS = ["PETR4", "VALE3", "HGLG11"]
US_TICKERS = ["AAPL", "VOO"]

random.seed(42)  # deterministic demo data


def _dt(days_ago: int) -> datetime:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).replace(
        hour=12, minute=0, second=0, microsecond=0
    )


async def _create_demo_user(db) -> User | None:
    existing = await db.execute(select(User).where(User.email == DEMO_EMAIL))
    if existing.scalar_one_or_none():
        return None
    # User.id has no ORM-level server_default (unlike every other model here)
    # — the convention in auth/service.py is to generate it client-side.
    user = User(
        id=uuid.uuid4(),
        email=DEMO_EMAIL,
        hashed_password=hash_password(DEMO_PASSWORD),
        full_name="Usuário Demo",
        role="user",
        is_verified=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _seed_investments(db, user: User) -> None:
    br = await portfolio_service.create_portfolio(user.id, "Carteira BR", "Ações e FIIs na B3", "BRL", db)
    intl = await portfolio_service.create_portfolio(user.id, "Internacional", "Exposição em USD", "USD", db)

    positions: dict[str, uuid.UUID] = {}
    for ticker in BR_TICKERS:
        pos = await portfolio_service.add_position(br.id, user.id, ticker, "XP Investimentos", None, db)
        positions[ticker] = pos["id"]
    for ticker in US_TICKERS:
        pos = await portfolio_service.add_position(intl.id, user.id, ticker, "Avenue", None, db)
        positions[ticker] = pos["id"]

    base_prices = {"PETR4": 32.0, "VALE3": 68.0, "HGLG11": 165.0, "AAPL": 180.0, "VOO": 420.0}
    txn_count = 0
    for ticker, position_id in positions.items():
        price = base_prices[ticker]
        # 4-6 buys spread across the last 18 months
        n_buys = random.randint(4, 6)
        for i in range(n_buys):
            days_ago = int(540 * (n_buys - i) / n_buys) + random.randint(0, 20)
            price *= 1 + random.uniform(-0.08, 0.10)
            qty = random.randint(5, 40) if ticker != "HGLG11" else random.randint(10, 60)
            await portfolio_service.record_transaction(
                position_id=position_id, user_id=user.id, transaction_type="buy",
                quantity=Decimal(qty), unit_price=Decimal(str(round(price, 2))),
                fees=Decimal("0"), fx_rate=Decimal("1") if ticker in BR_TICKERS else Decimal("5.10"),
                transaction_date=_dt(days_ago), notes=None, db=db,
            )
            txn_count += 1

        # a dividend for BR tickers
        if ticker in BR_TICKERS:
            await portfolio_service.record_transaction(
                position_id=position_id, user_id=user.id, transaction_type="dividend",
                quantity=Decimal("1"), unit_price=Decimal(str(round(price * 0.02, 2))),
                fees=Decimal("0"), fx_rate=Decimal("1"),
                transaction_date=_dt(random.randint(30, 200)), notes="Provento", db=db,
            )
            txn_count += 1

    print(f"  portfolios: 2, positions: {len(positions)}, transactions: {txn_count}")


async def _seed_finance(db, user: User) -> None:
    await finance_service.ensure_default_categories(user.id, db)
    categories = (await db.execute(
        select(FinanceCategory).where(FinanceCategory.user_id == user.id)
    )).scalars().all()
    expense_cats = [c for c in categories if c.category_type == "expense"]
    income_cats = [c for c in categories if c.category_type == "income"]
    salary_cat = next((c for c in income_cats if c.name == "Salário"), income_cats[0])

    txn_count = 0
    # 6 months of salary (recurring)
    await finance_service.create_transaction(user.id, {
        "transaction_type": "income", "amount": Decimal("7500"), "description": "Salário",
        "category_id": salary_cat.id, "transaction_date": _dt(150),
        "recurrence_rule": "FREQ=MONTHLY", "tags": [],
    }, db)
    txn_count += 1

    # 2 more recurring expenses (subscriptions)
    for desc, amount, days_ago in [("Streaming", Decimal("39.90"), 140), ("Academia", Decimal("120"), 130)]:
        subs_cat = next((c for c in expense_cats if c.name == "Assinaturas"), expense_cats[0])
        await finance_service.create_transaction(user.id, {
            "transaction_type": "expense", "amount": amount, "description": desc,
            "category_id": subs_cat.id, "transaction_date": _dt(days_ago),
            "recurrence_rule": "FREQ=MONTHLY", "tags": [],
        }, db)
        txn_count += 1

    descriptions = {
        "Alimentação": ["Supermercado", "Restaurante", "iFood"],
        "Transporte": ["Uber", "Combustível", "Estacionamento"],
        "Saúde": ["Farmácia", "Consulta médica"],
        "Lazer": ["Cinema", "Show"],
        "Educação": ["Curso online"],
        "Moradia": ["Conta de luz", "Condomínio"],
        "Outros": ["Diversos"],
    }
    for _ in range(57):
        cat = random.choice(expense_cats)
        desc_options = descriptions.get(cat.name, ["Compra"])
        await finance_service.create_transaction(user.id, {
            "transaction_type": "expense",
            "amount": Decimal(str(round(random.uniform(15, 450), 2))),
            "description": random.choice(desc_options),
            "category_id": cat.id,
            "transaction_date": _dt(random.randint(0, 180)),
            "tags": [],
        }, db)
        txn_count += 1

    print(f"  categories: {len(categories)}, transactions: {txn_count}")


async def _seed_card(db, user: User) -> None:
    card = CreditCard(
        user_id=user.id, name="Nubank", brand="mastercard", last4="4242",
        credit_limit=Decimal("8000"), closing_day=3, due_day=10,
    )
    db.add(card)
    await db.flush()

    reference_month = date.today().replace(day=1)
    invoice = CardInvoice(
        user_id=user.id, card_id=card.id, reference_month=reference_month,
        status="review", total_amount=Decimal("612.40"), file_name="fatura-demo.csv",
        raw_text="(dados de demonstração — sem upload real)",
    )
    db.add(invoice)
    await db.flush()

    categories = (await db.execute(
        select(FinanceCategory).where(
            FinanceCategory.user_id == user.id, FinanceCategory.category_type == "expense"
        )
    )).scalars().all()
    cat_by_name = {c.name: c for c in categories}

    items = [
        ("MERCADO PÃO DE AÇÚCAR", Decimal("287.90"), "Alimentação", None, None),
        ("NETFLIX.COM", Decimal("39.90"), "Assinaturas", None, None),
        ("UBER *TRIP", Decimal("24.50"), "Transporte", None, None),
        ("FARMACIA SAO JOAO", Decimal("68.30"), "Saúde", None, None),
        ("LOJA ELETRONICOS XPTO", Decimal("191.80"), None, 2, 3),
    ]
    for desc, amount, cat_name, inst_no, inst_total in items:
        cat = cat_by_name.get(cat_name)
        db.add(InvoiceItem(
            user_id=user.id, invoice_id=invoice.id, description=desc, amount=amount,
            purchase_date=date.today() - timedelta(days=random.randint(1, 25)),
            installment_no=inst_no, installment_total=inst_total,
            suggested_category_id=cat.id if cat else None,
            category_id=cat.id if cat else None,
        ))

    print("  cards: 1, invoice: 1 (status=review), items: 5")


async def main() -> None:
    async with AsyncSessionLocal() as db:
        user = await _create_demo_user(db)
        if user is None:
            print(f"Demo user '{DEMO_EMAIL}' already exists — nothing to do (idempotent).")
            return

        print(f"Seeding demo user {DEMO_EMAIL} (senha: {DEMO_PASSWORD})...")
        await _seed_investments(db, user)
        await _seed_finance(db, user)
        await _seed_card(db, user)
        await db.commit()
        print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
