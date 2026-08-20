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
}


def diagnose(event: PaymentEvent) -> DiagnosisResult:
    if event.failure_code in RULES:
        cause, reason = RULES[event.failure_code]
        return DiagnosisResult(cause=cause, method="rule", confidence=1, reason=reason)

    gemini_result = diagnose_ambiguous_with_gemini(event, get_config())
    if gemini_result:
        return gemini_result

    # Safe fallback when Gemini is unconfigured, unavailable or invalid.
    if event.history.successful_payments >= 8 and event.history.prior_failures <= 2:
        return DiagnosisResult(
            cause="likely_transient_failure",
            method="heuristic_fallback",
            confidence=0.58,
            reason="Strong payment history but the processor supplied no actionable code",
        )
    return DiagnosisResult(
        cause="unknown",
        method="heuristic_fallback",
        confidence=0.35,
        reason="Insufficient evidence for a reliable diagnosis",
    )
