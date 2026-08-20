from app.models import EventType, PaymentEvent, StageResult


RECOVERABLE_EVENT_TYPES = {
    EventType.PAYMENT_FAILED,
    EventType.RENEWAL_FAILED,
    EventType.INVOICE_OVERDUE,
}


def detect(event: PaymentEvent) -> StageResult:
    if event.type in RECOVERABLE_EVENT_TYPES:
        return StageResult(status="flagged", reason=f"{event.type.value} requires recovery review")
    return StageResult(status="ignored", reason="Event does not represent revenue at risk")
