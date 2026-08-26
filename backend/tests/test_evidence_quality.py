from app.evidence_quality import assess_evidence_quality, create_evidence_receipt
from app.models import CustomerHistory, EventType, PaymentEvent, PolicySettings
from app.pipeline.engine import run_event


def event(**overrides) -> PaymentEvent:
    values = {
        "id": "evidence-quality-case",
        "customer_id": "customer-evidence-quality",
        "customer_name": "Evidence quality test",
        "type": EventType.PAYMENT_FAILED,
        "amount": 300,
        "failure_code": "card_not_supported",
        "payment_method": "card",
        "error_description": "International cards are unavailable",
        "card_network": "Visa",
        "history": CustomerHistory(successful_payments=3, prior_failures=0, tenure_days=50),
    }
    values.update(overrides)
    return PaymentEvent(**values)


def test_complete_processor_evidence_is_ready_but_not_a_recovery_guarantee() -> None:
    item = event()
    quality = assess_evidence_quality(item, run_event(item, PolicySettings()))

    assert quality.status == "ready"
    assert quality.score >= 60
    assert "not a fraud score" in quality.disclaimer


def test_unknown_failure_is_marked_for_review() -> None:
    item = event(failure_code="unknown", payment_method=None, error_description=None, card_network=None)
    quality = assess_evidence_quality(item, run_event(item, PolicySettings()))

    assert quality.status == "needs_review"
    assert "Specific processor failure code" in quality.missing_signals


def test_evidence_receipt_is_stable_for_same_record_and_redacts_customer_name() -> None:
    item = event()
    result = run_event(item, PolicySettings(), run_id="fixed-run")

    first = create_evidence_receipt(item, result)
    second = create_evidence_receipt(item, result)

    assert first.fingerprint_sha256 == second.fingerprint_sha256
    assert len(first.fingerprint_sha256) == 64
