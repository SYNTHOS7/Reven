import hashlib
from datetime import datetime, timezone

from app.models import CustomerHistory, EventType, PaymentEvent


def _anonymous_customer(payment: dict) -> str:
    stable_value = str(payment.get("customer_id") or payment.get("contact") or payment.get("email") or payment.get("id"))
    return "rzp_customer_" + hashlib.sha256(stable_value.encode()).hexdigest()[:16]


def payment_event_from_razorpay(payment: dict) -> PaymentEvent:
    payment_id = str(payment["id"])
    created_at = datetime.fromtimestamp(int(payment.get("created_at", 0)), timezone.utc)
    failure_code = str(payment.get("error_reason") or payment.get("error_code") or "unknown").lower()
    notes = payment.get("notes") if isinstance(payment.get("notes"), dict) else {}
    customer_name = str(notes.get("customer_name") or "Razorpay test customer")
    instrument = payment.get("card_id") or payment.get("token_id") or payment.get("vpa")
    instrument_hash = hashlib.sha256(str(instrument).encode()).hexdigest()[:20] if instrument else None

    card_obj = payment.get("card") if isinstance(payment.get("card"), dict) else {}
    card_network = card_obj.get("network") or card_obj.get("sub_type")
    card_type = card_obj.get("type")

    return PaymentEvent(
        id=f"rzp_{payment_id}",
        customer_id=_anonymous_customer(payment),
        customer_name=customer_name,
        type=EventType.PAYMENT_FAILED,
        amount=float(payment.get("amount", 0)) / 100,
        failure_code=failure_code,
        occurred_at=created_at,
        retry_count=int(notes.get("reven_retry_count", 0) or 0),
        messages_sent_today=0,
        attempts_in_window=1,
        instrument_fingerprint=instrument_hash,
        history=CustomerHistory(),
        source="razorpay_test",
        source_event_id=payment_id,
        payment_method=payment.get("method"),
        error_description=payment.get("error_description"),
        bank=payment.get("bank"),
        wallet=payment.get("wallet"),
        vpa=payment.get("vpa"),
        card_network=str(card_network) if card_network else None,
        card_type=str(card_type) if card_type else None,
        error_source=payment.get("error_source"),
        error_step=payment.get("error_step"),
    )

