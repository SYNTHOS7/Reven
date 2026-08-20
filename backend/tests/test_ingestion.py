from app.ingestion import payment_event_from_razorpay


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
