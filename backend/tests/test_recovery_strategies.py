from app.models import Action, CustomerHistory, EventType, PaymentEvent, PolicySettings
from app.pipeline.engine import run_event
from app.recovery_strategies import build_recovery_strategies


def make_event(**overrides) -> PaymentEvent:
    values = {
        "id": "strategy-event",
        "customer_id": "customer-strategy",
        "customer_name": "Strategy Test",
        "type": EventType.PAYMENT_FAILED,
        "amount": 324,
        "failure_code": "customer_cancelled",
        "history": CustomerHistory(successful_payments=2, prior_failures=0, tenure_days=45),
    }
    values.update(overrides)
    return PaymentEvent(**values)


def test_payment_link_is_only_allowed_when_policy_selected_it() -> None:
    policy = PolicySettings()
    result = run_event(make_event(), policy)
    strategies = build_recovery_strategies(result, policy)

    assert result.decision.action == Action.CREATE_PAYMENT_LINK
    assert strategies.strategies[0].id == "operator-payment-link"
    assert strategies.strategies[0].status == "allowed"


def test_high_value_case_is_review_only_not_a_hidden_payment_link() -> None:
    policy = PolicySettings()
    result = run_event(make_event(amount=9000), policy)
    strategies = build_recovery_strategies(result, policy)

    assert result.decision.action == Action.ESCALATE_HUMAN
    assert strategies.strategies[0].id == "human-review"
    assert strategies.strategies[0].status == "requires_human_review"
    assert all(item.status != "allowed" for item in strategies.strategies)


def test_suspicious_case_blocks_every_recovery_path() -> None:
    policy = PolicySettings()
    result = run_event(make_event(amount=9, attempts_in_window=7), policy)
    strategies = build_recovery_strategies(result, policy)

    assert result.decision.action == Action.REFUSE_SUSPICIOUS
    assert len(strategies.strategies) == 1
    assert strategies.strategies[0].status == "blocked"
