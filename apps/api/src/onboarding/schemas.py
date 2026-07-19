from src.shared.schema_base import AppModel


class OnboardingStatusResponse(AppModel):
    has_portfolio: bool
    has_position: bool
    has_transaction: bool
    has_finance_transaction: bool
    has_goal: bool
