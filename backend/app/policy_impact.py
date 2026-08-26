"""Safe portfolio-level policy simulation using saved diagnoses only."""

from collections import Counter

from app.models import Action, PaymentEvent, PipelineResult, PolicyImpactChange, PolicyImpactResponse, PolicySettings
from app.pipeline.decision import decide
from app.pipeline.trust_gate import check_trust


def simulate_policy_impact(
    events: list[PaymentEvent],
    results: list[PipelineResult],
    proposed_policy: PolicySettings,
) -> PolicyImpactResponse:
    """Compare existing decisions against candidate bounds without model calls or mutations."""
    latest_by_event: dict[str, PipelineResult] = {}
    for result in results:
        prior = latest_by_event.get(result.event_id)
        if prior is None or result.created_at > prior.created_at:
            latest_by_event[result.event_id] = result

    relevant = [event for event in events if event.id in latest_by_event and event.source == "razorpay_test"]
    current_counts: Counter[str] = Counter()
    proposed_counts: Counter[str] = Counter()
    changes: list[PolicyImpactChange] = []
    newly_human_review = 0
    newly_blocked = 0

    for event in relevant:
        current = latest_by_event[event.id]
        current_action = current.decision.action
        candidate_trust = check_trust(event, proposed_policy)
        if candidate_trust.status == "suspicious":
            proposed_action = Action.REFUSE_SUSPICIOUS
            reason = f"Candidate Trust Gate: {candidate_trust.reason}"
        else:
            candidate_decision = decide(event, current.diagnosis, proposed_policy)
            proposed_action = candidate_decision.action
            reason = candidate_decision.reason

        current_counts[current_action.value] += 1
        proposed_counts[proposed_action.value] += 1
        if proposed_action != current_action:
            changes.append(
                PolicyImpactChange(
                    event_id=event.id,
                    amount=event.amount,
                    failure_code=event.failure_code,
                    current_action=current_action,
                    proposed_action=proposed_action,
                    reason=reason,
                )
            )
            if proposed_action == Action.ESCALATE_HUMAN and current_action != Action.ESCALATE_HUMAN:
                newly_human_review += 1
            if proposed_action in {Action.REFUSE_SUSPICIOUS, Action.STOP_LIMIT_REACHED} and current_action not in {
                Action.REFUSE_SUSPICIOUS,
                Action.STOP_LIMIT_REACHED,
            }:
                newly_blocked += 1

    changes.sort(key=lambda item: item.amount, reverse=True)
    return PolicyImpactResponse(
        total_cases=len(relevant),
        source_scope="Saved Razorpay Test Mode cases only",
        unchanged_cases=len(relevant) - len(changes),
        action_changed_cases=len(changes),
        newly_human_review_cases=newly_human_review,
        newly_blocked_cases=newly_blocked,
        current_action_breakdown=dict(current_counts),
        proposed_action_breakdown=dict(proposed_counts),
        changes=changes[:12],
    )
