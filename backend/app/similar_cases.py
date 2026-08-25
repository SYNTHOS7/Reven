"""Comparable historical cases for explanation, never for autonomous action."""

from __future__ import annotations

from app.models import PaymentEvent, PipelineResult


def _latest_results(results: list[PipelineResult]) -> dict[str, PipelineResult]:
    latest: dict[str, PipelineResult] = {}
    for result in results:
        current = latest.get(result.event_id)
        if current is None or result.created_at > current.created_at:
            latest[result.event_id] = result
    return latest


def find_similar_cases(
    event: PaymentEvent,
    current_result: PipelineResult | None,
    events: list[PaymentEvent],
    results: list[PipelineResult],
    limit: int = 5,
) -> dict:
    """Return transparent, same-source comparisons for a case detail view.

    This function is deliberately an explanation aid. The pipeline decision is
    evaluated independently from historical matches by the policy engine.
    """

    latest_by_event = _latest_results(results)
    comparisons: list[tuple[int, PaymentEvent, PipelineResult, list[str]]] = []

    current_cause = getattr(getattr(current_result, "diagnosis", None), "cause", None)
    for candidate in events:
        if candidate.id == event.id or candidate.source != event.source:
            continue
        candidate_result = latest_by_event.get(candidate.id)
        if candidate_result is None:
            continue

        score = 0
        reasons: list[str] = []
        if candidate.failure_code and candidate.failure_code == event.failure_code:
            score += 5
            reasons.append("same processor failure code")
        if candidate.payment_method and candidate.payment_method == event.payment_method:
            score += 2
            reasons.append("same payment method")
        candidate_cause = candidate_result.diagnosis.cause
        if current_cause and current_cause != "unknown" and candidate_cause == current_cause:
            score += 3
            reasons.append("same diagnosed cause")
        if candidate.bank and candidate.bank == event.bank:
            score += 1
            reasons.append("same bank context")

        if score:
            comparisons.append((score, candidate, candidate_result, reasons))

    comparisons.sort(key=lambda item: (item[0], item[2].created_at), reverse=True)
    selected = comparisons[:limit]
    cases = [
        {
            "event_id": candidate.id,
            "amount": candidate.amount,
            "occurred_at": candidate.occurred_at,
            "failure_code": candidate.failure_code,
            "payment_method": candidate.payment_method,
            "diagnosed_cause": candidate_result.diagnosis.cause,
            "decision_action": candidate_result.decision.action,
            "verified_recovered_amount": candidate_result.verified_recovered_amount,
            "match_reasons": reasons,
        }
        for _, candidate, candidate_result, reasons in selected
    ]
    verified = [item for item in cases if item["verified_recovered_amount"] > 0]
    scope = "Razorpay Test Mode history" if event.source == "razorpay_test" else "current active dataset history"
    return {
        "scope": scope,
        "cases": cases,
        "comparable_case_count": len(cases),
        "verified_recovery_count": len(verified),
        "verified_recovered_amount": sum(item["verified_recovered_amount"] for item in verified),
        "disclaimer": "Supporting evidence only. The current case is evaluated independently by Trust Gate and policy rules.",
    }


def retrieve_historical_diagnosis_examples(
    event: PaymentEvent,
    events: list[PaymentEvent],
    limit: int = 3,
) -> list[dict[str, str | float | list[str]]]:
    """Retrieve labelled, comparable cases for the diagnosis prompt.

    The retrieval layer intentionally excludes unreviewed model outputs. For
    Razorpay Test Mode, an example only becomes eligible after a human has
    recorded a cause and action. This prevents a model from reinforcing its
    own previous guesses.
    """

    matches: list[tuple[int, PaymentEvent, str, str, list[str]]] = []
    for candidate in events:
        if candidate.id == event.id or candidate.source != event.source:
            continue
        cause = candidate.human_reviewed_cause or candidate.expected_cause
        action = candidate.human_reviewed_action or candidate.expected_action
        if not cause or not action:
            continue

        score = 0
        reasons: list[str] = []
        if candidate.failure_code == event.failure_code:
            score += 5
            reasons.append("same failure code")
        if candidate.payment_method and candidate.payment_method == event.payment_method:
            score += 2
            reasons.append("same payment method")
        lower, upper = event.amount * 0.8, event.amount * 1.2
        if lower <= candidate.amount <= upper:
            score += 1
            reasons.append("similar amount")
        if not score:
            continue
        action_value = action.value if hasattr(action, "value") else str(action)
        matches.append((score, candidate, cause, action_value, reasons))

    matches.sort(key=lambda item: (item[0], item[1].occurred_at), reverse=True)
    return [
        {
            "failure_code": candidate.failure_code,
            "payment_method": candidate.payment_method or "not supplied",
            "amount_inr": candidate.amount,
            "confirmed_cause": cause,
            "confirmed_action": action,
            "matched_on": reasons,
        }
        for _, candidate, cause, action, reasons in matches[:limit]
    ]
