"""Evidence completeness and reproducible case-record fingerprinting."""

from hashlib import sha256
import json

from app.models import EvidenceQualityResponse, EvidenceReceiptResponse, PaymentEvent, PipelineResult

UNKNOWN_CODES = {"", "unknown", "unknown_processor_failure", "generic_error", "bad_request_error"}


def assess_evidence_quality(event: PaymentEvent, result: PipelineResult) -> EvidenceQualityResponse:
    captured: list[str] = []
    missing: list[str] = []
    score = 0

    if event.failure_code not in UNKNOWN_CODES:
        captured.append(f"Processor failure code: {event.failure_code}")
        score += 25
    else:
        missing.append("Specific processor failure code")
    if event.payment_method:
        captured.append(f"Payment method: {event.payment_method}")
        score += 15
    else:
        missing.append("Payment method")
    if event.error_description:
        captured.append("Processor error description")
        score += 20
    else:
        missing.append("Processor error description")
    if any([event.bank, event.wallet, event.vpa, event.card_network, event.card_type]):
        captured.append("Instrument or issuer context")
        score += 15
    else:
        missing.append("Instrument or issuer context")
    if event.history.successful_payments or event.history.prior_failures or event.history.tenure_days:
        captured.append("Customer payment history")
        score += 10
    else:
        missing.append("Customer payment history")
    if result.diagnosis.evidence_used:
        captured.append("Structured diagnosis evidence")
        score += 10
    if event.source == "razorpay_test":
        captured.append("Razorpay Test Mode source")
        score += 5

    if result.trust_gate.status == "suspicious":
        status = "needs_review"
        assessment = "Safety evidence is sufficient to stop the workflow, but an operator should investigate the suspicious pattern."
        boundary = "Blocked by Trust Gate; do not retry, contact, or create a link."
    elif score >= 60 and result.diagnosis.confidence >= 0.6:
        status = "ready"
        assessment = "The case has enough structured processor evidence for the current policy-bounded decision."
        boundary = "Use the strategy and decision record; policy still controls any action."
    elif result.diagnosis.confidence < 0.6:
        status = "needs_review"
        assessment = "Evidence is incomplete or ambiguous, so the model confidence remains below the safety floor."
        boundary = "Human review is required before any recovery action is considered."
    else:
        status = "insufficient_evidence"
        assessment = "The available processor context is too thin to support a confident recovery recommendation."
        boundary = "Collect additional processor or operator context; do not infer missing facts."

    return EvidenceQualityResponse(
        event_id=event.id,
        status=status,
        score=score,
        captured_signals=captured,
        missing_signals=missing,
        assessment=assessment,
        recommended_boundary=boundary,
    )


def create_evidence_receipt(event: PaymentEvent, result: PipelineResult) -> EvidenceReceiptResponse:
    """Hash a canonical, non-secret view of the stored decision record."""
    record = {
        "event": event.model_dump(mode="json", exclude={"customer_name", "ip_address", "instrument_fingerprint"}),
        "pipeline_result": result.model_dump(
            mode="json",
            exclude={"customer_name", "generated_message"},
        ),
    }
    canonical = json.dumps(record, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return EvidenceReceiptResponse(
        event_id=event.id,
        pipeline_result_id=result.id,
        run_id=result.run_id,
        fingerprint_sha256=sha256(canonical.encode("utf-8")).hexdigest(),
        scope="Redacted event fields plus the stored pipeline decision record",
    )
