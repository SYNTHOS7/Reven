"""Configuration readiness without leaking values or connection secrets."""

from app.config import AppConfig
from app.models import ReadinessCheck, ReadinessResponse


def build_readiness(config: AppConfig, storage_mode: str) -> ReadinessResponse:
    checks = [
        ReadinessCheck(name="Razorpay Test Mode credentials", status="ready" if bool(config.razorpay_key_id and config.razorpay_key_secret) else "missing", detail="Required to create and reconcile Test Mode Payment Links."),
        ReadinessCheck(name="Razorpay webhook secret", status="ready" if bool(config.razorpay_webhook_secret) else "missing", detail="Required to verify signed payment and Payment Link webhooks."),
        ReadinessCheck(name="Supabase persistence", status="ready" if storage_mode == "supabase" else "optional", detail="Durable evidence storage is recommended; local memory is suitable only for a temporary demo."),
        ReadinessCheck(name="Gemini diagnosis key", status="ready" if bool(config.gemini_api_key) else "optional", detail="Without it, ambiguous cases fail closed to deterministic low-confidence review."),
        ReadinessCheck(name="Operator token", status="ready" if bool(config.admin_token) else "optional", detail="Protects policy edits, labels, approvals, and reconciliation when configured."),
    ]
    required_ready = all(check.status == "ready" for check in checks[:2])
    return ReadinessResponse(status="ready_for_test_mode" if required_ready else "limited", checks=checks)
