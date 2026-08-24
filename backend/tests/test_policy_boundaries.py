from app.models import Action, DiagnosisResult, EventType, PaymentEvent, PolicySettings
from app.pipeline.decision import decide
from app.pipeline.trust_gate import check_trust


def make_event(**overrides) -> PaymentEvent:
    values = {
        "id": "boundary-event",
        "customer_id": "boundary-customer",
        "customer_name": "Boundary Test",
        "type": EventType.PAYMENT_FAILED,
        "amount": 4999,
        "failure_code": "customer_cancelled",
    }
    values.update(overrides)
    return PaymentEvent(**values)


def confident_link_diagnosis(confidence: float = 0.6) -> DiagnosisResult:
    return DiagnosisResult(
        cause="customer_abandoned_payment",
        method="rule",
        confidence=confidence,
        reason="Test boundary diagnosis",
    )


def test_confidence_floor_allows_exact_floor_and_escalates_just_below() -> None:
    policy = PolicySettings(diagnosis_confidence_escalation_threshold=0.6)
    assert decide(make_event(), confident_link_diagnosis(0.6), policy).action == Action.CREATE_PAYMENT_LINK
    assert decide(make_event(), confident_link_diagnosis(0.599), policy).action == Action.ESCALATE_HUMAN


def test_high_value_boundary_escalates_at_threshold_not_below() -> None:
    policy = PolicySettings(human_approval_amount_threshold=5000)
    assert decide(make_event(amount=4999), confident_link_diagnosis(), policy).action == Action.CREATE_PAYMENT_LINK
    assert decide(make_event(amount=5000), confident_link_diagnosis(), policy).action == Action.ESCALATE_HUMAN


def test_retry_boundary_stops_at_maximum_retry_count() -> None:
    policy = PolicySettings(max_retries_per_payment=3)
    assert decide(make_event(retry_count=2), confident_link_diagnosis(), policy).action == Action.CREATE_PAYMENT_LINK
    assert decide(make_event(retry_count=3), confident_link_diagnosis(), policy).action == Action.STOP_LIMIT_REACHED


def test_contact_boundary_stops_at_daily_cap() -> None:
    policy = PolicySettings(max_messages_per_customer_per_day=1)
    assert decide(make_event(messages_sent_today=0), confident_link_diagnosis(), policy).action == Action.CREATE_PAYMENT_LINK
    assert decide(make_event(messages_sent_today=1), confident_link_diagnosis(), policy).action == Action.STOP_LIMIT_REACHED


def test_trust_gate_allows_limit_and_flags_next_attempt() -> None:
    policy = PolicySettings(trust_gate_max_attempts_in_window=5)
    assert check_trust(make_event(attempts_in_window=5), policy).status == "clear"
    assert check_trust(make_event(attempts_in_window=6), policy).status == "suspicious"
