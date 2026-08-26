from datetime import timedelta

from app.models import CustomerHistory, EventType, PaymentEvent, PolicySettings
from app.pipeline.engine import run_event
from app.recovery_timeline import RETRY_DELAY_HOURS, build_recovery_timeline


def event(**overrides) -> PaymentEvent:
    values = {
        "id": "timeline-event",
        "customer_id": "timeline-customer",
        "customer_name": "Timeline Test",
        "type": EventType.PAYMENT_FAILED,
        "amount": 100,
        "failure_code": "insufficient_funds",
        "history": CustomerHistory(successful_payments=5, prior_failures=0, tenure_days=50),
    }
    values.update(overrides)
    return PaymentEvent(**values)


def test_retry_timeline_exposes_eligibility_but_not_an_automatic_retry() -> None:
    result = run_event(event(), PolicySettings())
    timeline = build_recovery_timeline(event(), result)

    assert timeline.items[-1].stage == "retry_window"
    assert timeline.items[-1].status == "waiting"
    assert timeline.next_eligible_at == result.created_at + timedelta(hours=RETRY_DELAY_HOURS)
    assert "never triggers" in timeline.next_eligibility_note


def test_suspicious_timeline_has_no_future_recovery_window() -> None:
    suspicious = event(amount=9, attempts_in_window=7)
    timeline = build_recovery_timeline(suspicious, run_event(suspicious, PolicySettings()))

    assert timeline.items[-1].status == "blocked"
    assert timeline.next_eligible_at is None
