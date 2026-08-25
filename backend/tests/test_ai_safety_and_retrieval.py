from app.gemini_diagnosis import GeminiDiagnosis, build_diagnosis_prompt, normalize_gemini_diagnosis
from app.models import Action, EventType, PaymentEvent
from app.similar_cases import retrieve_historical_diagnosis_examples


def event(event_id: str, **overrides) -> PaymentEvent:
    values = {
        "id": event_id,
        "customer_id": event_id,
        "customer_name": "Test customer",
        "type": EventType.PAYMENT_FAILED,
        "amount": 1000,
        "failure_code": "ambiguous_failure",
        "payment_method": "card",
        "source": "razorpay_test",
    }
    values.update(overrides)
    return PaymentEvent(**values)


def test_unknown_model_diagnosis_is_always_capped_and_fail_closed() -> None:
    diagnosis = normalize_gemini_diagnosis(
        GeminiDiagnosis(cause="unknown", confidence=0.95, reason="The evidence is unresolved")
    )
    assert diagnosis.cause == "unknown"
    assert diagnosis.confidence == 0.35


def test_retrieval_uses_only_human_labelled_same_source_cases() -> None:
    current = event("current")
    labelled = event(
        "labelled",
        human_reviewed_cause="temporary_bank_failure",
        human_reviewed_action=Action.RETRY_LATER,
    )
    unreviewed = event("unreviewed")
    demo = event(
        "demo",
        source="demo",
        human_reviewed_cause="temporary_bank_failure",
        human_reviewed_action=Action.RETRY_LATER,
    )

    examples = retrieve_historical_diagnosis_examples(current, [current, labelled, unreviewed, demo])
    assert len(examples) == 1
    assert examples[0]["confirmed_cause"] == "temporary_bank_failure"
    assert examples[0]["confirmed_action"] == "retry_later"


def test_retrieval_prompt_marks_examples_as_supporting_evidence() -> None:
    sample = event("current")
    prompt = build_diagnosis_prompt(sample, [{"confirmed_cause": "temporary_bank_failure"}])
    assert "supporting evidence" in prompt
    assert "human-labelled" in prompt
    assert "capped at 0.35" in prompt
