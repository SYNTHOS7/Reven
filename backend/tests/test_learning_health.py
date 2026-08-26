from app.learning_health import build_learning_health
from app.models import Action, CustomerHistory, EventType, PaymentEvent, PolicySettings
from app.pipeline.engine import run_event


def event(event_id: str, **overrides) -> PaymentEvent:
    values = {
        "id": event_id,
        "customer_id": f"customer-{event_id}",
        "customer_name": "Learning test",
        "type": EventType.PAYMENT_FAILED,
        "amount": 100,
        "failure_code": "customer_cancelled",
        "history": CustomerHistory(successful_payments=2, tenure_days=20),
        "source": "razorpay_test",
    }
    values.update(overrides)
    return PaymentEvent(**values)


def test_learning_health_excludes_unreviewed_and_demo_cases() -> None:
    reviewed = event(
        "reviewed",
        human_reviewed_cause="customer_abandoned_payment",
        human_reviewed_action=Action.CREATE_PAYMENT_LINK,
    )
    unreviewed = event("unreviewed")
    demo = event("demo", source="demo", human_reviewed_cause="customer_abandoned_payment", human_reviewed_action=Action.CREATE_PAYMENT_LINK)
    report = build_learning_health(
        [reviewed, unreviewed, demo],
        [run_event(reviewed, PolicySettings()), run_event(unreviewed, PolicySettings()), run_event(demo, PolicySettings())],
    )

    assert report.test_mode_cases == 2
    assert report.human_labelled_cases == 1
    assert report.label_coverage_pct == 50.0
    assert report.action_agreement_pct == 100.0
    assert "excluded" in report.disclaimer
