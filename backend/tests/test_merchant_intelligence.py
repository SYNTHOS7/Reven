from app.config import AppConfig
from app.merchant_intelligence import build_merchant_briefing, deterministic_merchant_briefing
from app.models import MerchantBriefingRequest, MerchantPattern


def request() -> MerchantBriefingRequest:
    return MerchantBriefingRequest(
        data_source="simulated_merchant_scenario",
        revenue_lost=12000,
        potentially_recoverable_revenue=5000,
        verified_recovered_revenue=1000,
        priority_case_count=3,
        patterns=[MerchantPattern(label="Card declines", count=8, lost_amount=7000, recommended_alternative="UPI fallback")],
    )


def test_deterministic_briefing_is_aggregate_only_and_bounded() -> None:
    briefing = deterministic_merchant_briefing(request())
    assert briefing.method == "deterministic"
    assert "Card declines" in briefing.headline
    assert len(briefing.recommended_next_steps) == 3
    assert "cannot contact" in briefing.decision_boundary


def test_briefing_falls_back_without_gemini_key() -> None:
    briefing = build_merchant_briefing(request(), AppConfig(gemini_api_key=None))
    assert briefing.method == "deterministic"
