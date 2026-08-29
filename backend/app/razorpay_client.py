import hashlib
import hmac

import httpx

from app.config import AppConfig
from app.models import PaymentEvent


class RazorpayClient:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    @property
    def configured(self) -> bool:
        return bool(self.config.razorpay_key_id and self.config.razorpay_key_secret)

    @property
    def test_mode_configured(self) -> bool:
        return bool(self.configured and (self.config.razorpay_key_id or "").startswith("rzp_test_"))

    def _require_test_mode(self) -> None:
        if not self.configured:
            raise RuntimeError("Razorpay Test Mode credentials are not configured")
        if not self.test_mode_configured:
            raise RuntimeError("Refusing Razorpay API call: Reven batch tooling requires an rzp_test_ key ID")

    async def create_payment_link(self, event: PaymentEvent) -> dict[str, str]:
        self._require_test_mode()
        payload = {
            "amount": int(round(event.amount * 100)),
            "currency": "INR",
            "reference_id": event.id[:40],
            "description": f"Reven recovery for {event.id}",
            "customer": {"name": event.customer_name},
            "notify": {"sms": False, "email": False},
            "reminder_enable": False,
            "notes": {"reven_event_id": event.id},
        }
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                "https://api.razorpay.com/v1/payment_links/",
                json=payload,
                auth=(self.config.razorpay_key_id or "", self.config.razorpay_key_secret or ""),
            )
            response.raise_for_status()
            data = response.json()
            return {"id": data["id"], "short_url": data["short_url"], "mode": "test"}

    async def fetch_failed_payments(self, count: int = 100) -> list[dict]:
        self._require_test_mode()
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                "https://api.razorpay.com/v1/payments",
                params={"count": min(max(count, 1), 100), "skip": 0},
                auth=(self.config.razorpay_key_id or "", self.config.razorpay_key_secret or ""),
            )
            response.raise_for_status()
            return [item for item in response.json().get("items", []) if item.get("status") == "failed"]

    async def fetch_payment_link(self, payment_link_id: str) -> dict:
        self._require_test_mode()
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"https://api.razorpay.com/v1/payment_links/{payment_link_id}",
                auth=(self.config.razorpay_key_id or "", self.config.razorpay_key_secret or ""),
            )
            response.raise_for_status()
            return response.json()

    def verify_webhook(self, body: bytes, signature: str | None) -> bool:
        secret = self.config.razorpay_webhook_secret
        if not secret:
            return self.config.app_env != "production"
        if not signature:
            return False
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)
