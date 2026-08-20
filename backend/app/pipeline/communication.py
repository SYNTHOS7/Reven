from app.models import Action, PaymentEvent


def generate_message(event: PaymentEvent, action: Action) -> str | None:
    first_name = event.customer_name.split()[0]
    amount = f"₹{event.amount:,.0f}"
    if action == Action.UPDATE_PAYMENT_METHOD:
        return (
            f"Hi {first_name}, your {amount} payment could not be completed because the saved payment method "
            "needs an update. You can update it securely when convenient. No additional charge has been attempted."
        )
    if action == Action.CREATE_PAYMENT_LINK:
        return (
            f"Hi {first_name}, your {amount} payment is still pending. We prepared a secure payment link for you. "
            "Please use it when convenient; this message will not be repeated today."
        )
    return None
