from app.ingestion import payment_event_from_razorpay
from app.diagnostic_tools import execute_diagnostic_tool
from app.models import PolicySettings


def test_razorpay_payment_is_redacted_and_converted_from_paise() -> None:
    event = payment_event_from_razorpay(
        {
            "id": "pay_test123",
            "amount": 129900,
            "status": "failed",
            "method": "upi",
            "contact": "+919999999999",
            "email": "person@example.com",
            "error_reason": "incorrect_otp",
            "error_description": "Incorrect OTP",
            "created_at": 1787260800,
            "notes": {},
        }
    )
    assert event.amount == 1299
    assert event.source_event_id == "pay_test123"
    assert event.customer_id.startswith("rzp_customer_")
    assert "+919999999999" not in event.model_dump_json()
    assert "person@example.com" not in event.model_dump_json()
    assert event.failure_code == "incorrect_otp"


def test_retains_raw_error_code_when_error_reason_is_present() -> None:
    event = payment_event_from_razorpay(
        {
            "id": "pay_gateway_error",
            "amount": 10100,
            "status": "failed",
            "method": "card",
            "error_reason": "payment_failed",
            "error_code": "GATEWAY_ERROR",
            "error_description": "Payment failed at gateway",
            "error_source": "gateway",
            "error_step": "payment_authorization",
            "created_at": 1787260800,
            "notes": {},
        }
    )

    assert event.failure_code == "payment_failed"
    assert event.raw_error_code == "GATEWAY_ERROR"

    context, _ = execute_diagnostic_tool("get_processor_context", event, PolicySettings(), [])
    assert context["failure_code"] == "payment_failed"
    assert context["raw_error_code"] == "GATEWAY_ERROR"
