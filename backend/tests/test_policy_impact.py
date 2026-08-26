from app.models import Action, CustomerHistory, EventType, PaymentEvent, PolicySettings
from app.pipeline.engine import run_event
from app.policy_impact import simulate_policy_impact


def event(event_id: str, **overrides) -> PaymentEvent:
    values = {
        "id": event_id,
        "customer_id": f"customer-{event_id}",
        "customer_name": "Policy impact test",
        "type": EventType.PAYMENT_FAILED,
        "amount": 100,
        "failure_code": "customer_cancelled",
        "history": CustomerHistory(successful_payments=4, prior_failures=0, tenure_days=20),
        "source": "razorpay_test",
    }
    values.update(overrides)
    return PaymentEvent(**values)


def test_policy_impact_shows_changes_without_mutating_existing_result() -> None:
    active_policy = PolicySettings(human_approval_amount_threshold=5000)
    item = event("low-value")
    current = run_event(item, active_policy)
    candidate = PolicySettings(human_approval_amount_threshold=50)

    impact = simulate_policy_impact([item], [current], candidate)

    assert current.decision.action == Action.CREATE_PAYMENT_LINK
    assert impact.total_cases == 1
    assert impact.action_changed_cases == 1
    assert impact.newly_human_review_cases == 1
    assert impact.changes[0].proposed_action == Action.ESCALATE_HUMAN
    assert current.decision.action == Action.CREATE_PAYMENT_LINK


def test_policy_impact_excludes_simulated_merchant_data() -> None:
    item = event("demo-only", source="demo")
    impact = simulate_policy_impact([item], [run_event(item, PolicySettings())], PolicySettings())

    assert impact.total_cases == 0
    assert impact.changes == []
