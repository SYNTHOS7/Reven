"""Aggregate-only merchant briefing agent with a deterministic safety fallback."""

import json

from pydantic import BaseModel, Field

from app.config import AppConfig
from app.models import MerchantBriefingRequest, MerchantBriefingResponse


class GeminiMerchantBriefing(BaseModel):
    headline: str = Field(min_length=5, max_length=160)
    narrative: str = Field(min_length=20, max_length=500)
    recommended_next_steps: list[str] = Field(min_length=1, max_length=3)


def deterministic_merchant_briefing(request: MerchantBriefingRequest) -> MerchantBriefingResponse:
    leading = request.patterns[0] if request.patterns else None
    if leading:
        headline = f"{leading.label} is the largest visible recovery leakage."
        narrative = (
            f"{leading.count} cases account for ₹{leading.lost_amount:,.0f} of the recorded loss. "
            f"₹{request.potentially_recoverable_revenue:,.0f} is only a policy-screened opportunity, not guaranteed recovery."
        )
        steps = [
            f"Review {leading.label.lower()} cases first and verify the processor context.",
            f"Consider {leading.recommended_alternative.lower()} only where policy allows it.",
            "Send low-confidence, high-value, or suspicious cases to human review.",
        ]
    else:
        headline = "No merchant failure pattern is available yet."
        narrative = "Import or receive labelled payment evidence before asking the system to prioritize a recovery program."
        steps = ["Collect processor failure context.", "Review the first cases under policy.", "Do not infer a recovery playbook from missing data."]
    return MerchantBriefingResponse(
        headline=headline,
        narrative=narrative,
        recommended_next_steps=steps,
        method="deterministic",
        data_source=request.data_source,
    )


def build_merchant_prompt(request: MerchantBriefingRequest) -> str:
    return (
        "Write a concise merchant recovery briefing from aggregate, labelled metrics only. "
        "Do not claim a payment will recover, do not invent a metric, do not mention individual customers, "
        "and do not recommend sending a message or creating a link as an automatic action. "
        "Use INR formatting and give at most three conservative next steps.\n"
        f"metrics={json.dumps(request.model_dump(), ensure_ascii=True)}"
    )


def build_merchant_briefing(request: MerchantBriefingRequest, config: AppConfig) -> MerchantBriefingResponse:
    if not config.gemini_api_key:
        return deterministic_merchant_briefing(request)
    try:
        from google import genai
        from google.genai import types

        with genai.Client(api_key=config.gemini_api_key) as client:
            response = client.models.generate_content(
                model=config.gemini_model,
                contents=build_merchant_prompt(request),
                config=types.GenerateContentConfig(
                    temperature=0,
                    response_mime_type="application/json",
                    response_schema=GeminiMerchantBriefing,
                ),
            )
        parsed = response.parsed or json.loads(response.text or "{}")
        briefing = GeminiMerchantBriefing.model_validate(parsed)
        return MerchantBriefingResponse(
            **briefing.model_dump(),
            method="llm",
            data_source=request.data_source,
        )
    except Exception:
        return deterministic_merchant_briefing(request)
