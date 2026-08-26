"""Honest learning coverage and operator-agreement reporting."""

from collections import Counter

from app.models import LearningHealthResponse, PaymentEvent, PipelineResult


def build_learning_health(events: list[PaymentEvent], results: list[PipelineResult]) -> LearningHealthResponse:
    latest: dict[str, PipelineResult] = {}
    for result in results:
        if result.source != "razorpay_test":
            continue
        previous = latest.get(result.event_id)
        if previous is None or result.created_at > previous.created_at:
            latest[result.event_id] = result
    cases = [event for event in events if event.source == "razorpay_test" and event.id in latest]
    labelled = [event for event in cases if event.human_reviewed_cause and event.human_reviewed_action]

    cause_matches = sum(1 for event in labelled if latest[event.id].diagnosis.cause == event.human_reviewed_cause)
    action_matches = sum(1 for event in labelled if latest[event.id].decision.action == event.human_reviewed_action)
    overrides = sum(
        1
        for event in labelled
        if latest[event.id].diagnosis.cause != event.human_reviewed_cause
        or latest[event.id].decision.action != event.human_reviewed_action
    )
    method_counts = Counter(result.diagnosis.method for result in latest.values())
    coverage = round(100 * len(labelled) / len(cases), 1) if cases else None
    cause_agreement = round(100 * cause_matches / len(labelled), 1) if labelled else None
    action_agreement = round(100 * action_matches / len(labelled), 1) if labelled else None

    if len(labelled) >= 20:
        status = "Growing labelled evidence base"
        goal = "Keep adding reviewed edge cases and inspect every operator override before changing policy."
    elif labelled:
        status = "Early learning evidence"
        goal = f"Add {20 - len(labelled)} more human-reviewed Razorpay Test Mode cases before treating agreement trends as stable."
    else:
        status = "No learning labels yet"
        goal = "Review and label at least 10 diverse Razorpay Test Mode failures; do not claim model accuracy before that."

    return LearningHealthResponse(
        test_mode_cases=len(cases),
        human_labelled_cases=len(labelled),
        label_coverage_pct=coverage,
        cause_agreement_pct=cause_agreement,
        action_agreement_pct=action_agreement,
        operator_overrides=overrides,
        diagnoses_by_method=dict(method_counts),
        learning_status=status,
        next_evidence_goal=goal,
    )
