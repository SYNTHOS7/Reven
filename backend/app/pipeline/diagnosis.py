from app.config import get_config
from app.gemini_diagnosis import diagnose_ambiguous_with_gemini
from app.models import DiagnosisResult, PaymentEvent

RULES: dict[str, tuple[str, str]] = {
    "insufficient_funds": ("temporary_funds_shortage", "Issuer reported insufficient funds"),
    "card_expired": ("expired_payment_method", "Card expiry is explicit"),
    "mandate_lapsed": ("lapsed_mandate", "Recurring mandate is no longer active"),
    "bank_error": ("temporary_bank_failure", "Issuer or bank reported a transient failure"),
    "customer_cancelled": ("customer_abandoned_payment", "Customer cancelled the payment flow"),
    "invoice_overdue": ("overdue_receivable", "Invoice passed its due date"),
    "insufficient_balance": ("temporary_funds_shortage", "Razorpay reported insufficient balance"),
    "incorrect_otp": ("customer_abandoned_payment", "Payment authentication failed because the OTP was incorrect"),
    "payment_timed_out": ("customer_abandoned_payment", "Customer payment flow timed out"),
    "payment_cancelled": ("customer_abandoned_payment", "Customer cancelled the payment flow"),
    "bank_not_available": ("temporary_bank_failure", "The selected bank was temporarily unavailable"),
    "gateway_technical_error": ("temporary_bank_failure", "The payment gateway reported a technical failure"),
    "server_error": ("temporary_bank_failure", "The processor reported a transient server failure"),
    "card_not_supported": ("unsupported_payment_method", "Processor reported the card or payment method is unsupported"),
    "payment_method_not_supported": ("unsupported_payment_method", "Processor reported the payment method is unsupported"),
    "do_not_honor": ("issuer_decline", "Issuer declined the payment without a recoverable reason"),
    "payment_failed": ("technical_error", "Processor reported a technical payment failure"),
}


def build_evidence_list(event: PaymentEvent) -> list[str]:
    evidence = []
    if event.failure_code:
        evidence.append(f"failure_code: {event.failure_code}")
    if event.error_description:
        evidence.append(f"error_description: {event.error_description}")
    if event.payment_method:
        evidence.append(f"payment_method: {event.payment_method}")
    if event.bank:
        evidence.append(f"bank: {event.bank}")
    if event.wallet:
        evidence.append(f"wallet: {event.wallet}")
    if event.vpa:
        evidence.append(f"vpa: {event.vpa}")
    if event.card_network:
        evidence.append(f"card_network: {event.card_network}")
    if event.retry_count > 0:
        evidence.append(f"attempt_count: {event.retry_count + 1}")
    if event.amount:
        evidence.append(f"amount: ₹{event.amount:,.0f}")
    return evidence


def diagnose(event: PaymentEvent, historical_examples: list[dict] | None = None) -> DiagnosisResult:
    evidence = build_evidence_list(event)

    if event.failure_code in RULES:
        cause, reason = RULES[event.failure_code]
        return DiagnosisResult(
            cause=cause,
            method="rule",
            confidence=1.0,
            reason=reason,
            evidence_used=evidence,
        )

    gemini_result = diagnose_ambiguous_with_gemini(event, get_config(), historical_examples)
    if gemini_result:
        gemini_result.evidence_used = evidence
        return gemini_result

    # Safe fallback when Gemini is unconfigured, unavailable, or invalid.
    generic_codes = {"unknown", "unknown_processor_failure", "generic_error", "bad_request_error"}
    if (
        event.history.successful_payments >= 8
        and event.history.prior_failures <= 2
        and event.failure_code not in generic_codes
    ):
        return DiagnosisResult(
            cause="likely_transient_failure",
            method="heuristic_fallback",
            confidence=0.58,
            reason="Strong payment history but the processor supplied no explicit rule code",
            evidence_used=evidence,
        )

    return DiagnosisResult(
        cause="unknown",
        method="heuristic_fallback",
        confidence=0.35,
        reason="Unknown from available processor evidence",
        evidence_used=evidence,
    )
