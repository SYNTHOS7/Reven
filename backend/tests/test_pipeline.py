from app.models import Action, CustomerHistory, EventType, PaymentEvent, PolicySettings
from app.pipeline.engine import run_event


def make_event(**overrides) -> PaymentEvent:
    data = {
        "id": "evt_test",
        "customer_id": "cus_test",
        "customer_name": "Meera Iyer",
        "type": EventType.PAYMENT_FAILED,
        "amount": 1299,
        "failure_code": "insufficient_funds",
        "history": CustomerHistory(successful_payments=10, prior_failures=1, tenure_days=300),
    }
    data.update(overrides)
    return PaymentEvent(**data)


def test_clear_failure_uses_deterministic_rule() -> None:
    result = run_event(make_event(), PolicySettings())
    assert result.diagnosis.method == "rule"
    assert result.decision.action == Action.RETRY_LATER


def test_suspicious_event_stops_before_recovery() -> None:
    event = make_event(amount=9, attempts_in_window=7)
    result = run_event(event, PolicySettings())
    assert result.trust_gate.status == "suspicious"
    assert result.decision.action == Action.REFUSE_SUSPICIOUS
    assert result.verified_recovered_amount == 0


def test_high_value_case_requires_human() -> None:
    result = run_event(make_event(amount=7499), PolicySettings())
    assert result.decision.action == Action.ESCALATE_HUMAN


def test_retry_limit_is_enforced() -> None:
    result = run_event(make_event(retry_count=3), PolicySettings())
    assert result.decision.action == Action.STOP_LIMIT_REACHED


def test_ambiguous_case_fails_closed_without_model_credentials() -> None:
    result = run_event(make_event(failure_code="unknown"), PolicySettings())
    assert result.diagnosis.method == "heuristic_fallback"
    assert result.diagnosis.confidence < PolicySettings().diagnosis_confidence_escalation_threshold
    assert result.decision.action == Action.ESCALATE_HUMAN
