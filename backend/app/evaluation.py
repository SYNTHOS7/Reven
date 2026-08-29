from uuid import uuid4

from app.models import Action, RunResponse, ScorecardRun, WrongCase
from app.pipeline.engine import run_event
from app.repository import Repository
from app.similar_cases import retrieve_historical_diagnosis_examples


def run_evaluation(repo: Repository) -> RunResponse:
    run_id = str(uuid4())
    results = [
        run_event(event, repo.policy, run_id, retrieve_historical_diagnosis_examples(event, repo.events))
        for event in repo.events
    ]
    diagnosis_correct = 0
    action_correct = 0
    wrong: list[WrongCase] = []

    event_lookup = {event.id: event for event in repo.events}
    diagnosis_labelled_events = [event for event in repo.events if event.expected_cause is not None]
    action_labelled_events = [event for event in repo.events if event.expected_action is not None]
    diagnosis_labelled_ids = {event.id for event in diagnosis_labelled_events}
    action_labelled_ids = {event.id for event in action_labelled_events}
    for result in results:
        event = event_lookup[result.event_id]
        if event.id in diagnosis_labelled_ids and result.diagnosis.cause == event.expected_cause:
            diagnosis_correct += 1
        if event.id in action_labelled_ids and result.decision.action == event.expected_action:
            action_correct += 1
        if result.diagnosis.confidence < repo.policy.diagnosis_confidence_escalation_threshold:
            wrong.append(
                WrongCase(
                    event_id=result.event_id,
                    expected=event.expected_action.value if event.expected_action else "unlabelled",
                    actual=result.decision.action.value,
                    reason=result.decision.reason,
                )
            )
        elif event.id in action_labelled_ids and result.decision.action != event.expected_action:
            wrong.append(
                WrongCase(
                    event_id=result.event_id,
                    expected=event.expected_action.value if event.expected_action else "unlabelled",
                    actual=result.decision.action.value,
                    reason="Pipeline action differed from the locked fixture label",
                )
            )

    total = len(results)
    diagnosis_labelled_total = len(diagnosis_labelled_events)
    action_labelled_total = len(action_labelled_events)
    policy_violations = sum(
        1
        for result in results
        if result.amount >= repo.policy.human_approval_amount_threshold
        and result.decision.action != Action.ESCALATE_HUMAN
    )
    scorecard = ScorecardRun(
        id=run_id,
        total_cases=total,
        flagged_cases=sum(result.detection.status == "flagged" for result in results),
        diagnosis_accuracy_pct=round(diagnosis_correct / diagnosis_labelled_total * 100, 1) if diagnosis_labelled_total else 0,
        action_accuracy_pct=round(action_correct / action_labelled_total * 100, 1) if action_labelled_total else 0,
        policy_compliance_pct=round((total - policy_violations) / total * 100, 1) if total else 100,
        actual_test_recovery=repo.actual_test_recovery,
        suspicious_refusals=sum(result.decision.action == Action.REFUSE_SUSPICIOUS for result in results),
        escalated_cases=sum(result.decision.action == Action.ESCALATE_HUMAN for result in results),
        wrong_or_uncertain_cases=wrong[:12],
        policy_snapshot=repo.policy.model_copy(deep=True),
        labeled_cases=diagnosis_labelled_total,
        diagnosis_labelled_cases=diagnosis_labelled_total,
        action_labelled_cases=action_labelled_total,
    )
    repo.save_results(results)
    repo.save_scorecard(scorecard)
    return RunResponse(scorecard=scorecard, results=results)
