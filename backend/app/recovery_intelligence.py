import statistics
from datetime import timezone

from app.models import (
    Action,
    ActionMetrics,
    CauseMetrics,
    ConfidenceDistribution,
    HumanOverrideMetrics,
    PolicySettings,
    PrimaryRecoveryMetrics,
    RecoveryIntelligenceResponse,
    SafetyAndLearningMetrics,
    WebhookIntegrityMetrics,
)
from app.repository import Repository


def compute_recovery_intelligence(repo: Repository) -> RecoveryIntelligenceResponse:
    # 1. Gather latest PipelineResult for each event
    latest_by_event = {}
    for result in repo.results:
        current = latest_by_event.get(result.event_id)
        if current is None or result.created_at > current.created_at:
            latest_by_event[result.event_id] = result

    latest_results = list(latest_by_event.values())
    total_evaluated_cases = len(latest_results)

    events_by_id = {event.id: event for event in repo.events}

    # 2. Compute Primary Recovery Metrics
    verified_recovered_cases = [r for r in latest_results if r.verified_recovered_amount > 0]
    verified_recovery_amount = sum(r.verified_recovered_amount for r in verified_recovered_cases)

    created_payment_links = [r for r in latest_results if r.razorpay_payment_link_id]
    created_payment_links_count = len(created_payment_links)

    paid_payment_links = [r for r in created_payment_links if r.verified_recovered_amount > 0]
    paid_payment_links_count = len(paid_payment_links)

    if created_payment_links_count > 0:
        conversion_rate_pct: float | None = round((paid_payment_links_count / created_payment_links_count) * 100, 1)
    else:
        conversion_rate_pct = None

    # Median Time to Recovery
    recovery_durations_minutes: list[float] = []
    for r in verified_recovered_cases:
        event = events_by_id.get(r.event_id)
        if event and r.recovered_at and event.occurred_at:
            rec_dt = r.recovered_at if r.recovered_at.tzinfo else r.recovered_at.replace(tzinfo=timezone.utc)
            occ_dt = event.occurred_at if event.occurred_at.tzinfo else event.occurred_at.replace(tzinfo=timezone.utc)
            diff_min = (rec_dt - occ_dt).total_seconds() / 60.0
            if diff_min >= 0:
                recovery_durations_minutes.append(diff_min)

    if recovery_durations_minutes:
        median_time_min: float | None = round(statistics.median(recovery_durations_minutes), 1)
    else:
        median_time_min = None

    # Human-review rate
    escalated_cases = [r for r in latest_results if r.decision.action == Action.ESCALATE_HUMAN]
    escalated_cases_count = len(escalated_cases)

    if total_evaluated_cases > 0:
        human_review_rate_pct: float | None = round((escalated_cases_count / total_evaluated_cases) * 100, 1)
    else:
        human_review_rate_pct = None

    # Policy-block count
    policy_block_cases = [
        r for r in latest_results if r.decision.action in {Action.STOP_LIMIT_REACHED, Action.REFUSE_SUSPICIOUS}
    ]
    policy_block_count = len(policy_block_cases)

    primary = PrimaryRecoveryMetrics(
        verified_recovery_amount=verified_recovery_amount,
        payment_link_conversion_rate_pct=conversion_rate_pct,
        created_payment_links_count=created_payment_links_count,
        paid_payment_links_count=paid_payment_links_count,
        median_time_to_recovery_minutes=median_time_min,
        verified_recovery_cases_count=len(verified_recovered_cases),
        human_review_rate_pct=human_review_rate_pct,
        total_evaluated_cases=total_evaluated_cases,
        escalated_cases_count=escalated_cases_count,
        policy_block_count=policy_block_count,
    )

    # 3. Breakdown by Cause
    cause_groups: dict[str, list] = {}
    for r in latest_results:
        cause_groups.setdefault(r.diagnosis.cause, []).append(r)

    by_cause: list[CauseMetrics] = []
    for cause, group in cause_groups.items():
        total_c = len(group)
        rec_amt = sum(item.verified_recovered_amount for item in group)
        rec_c = sum(1 for item in group if item.verified_recovered_amount > 0)
        rate = round((rec_c / total_c) * 100, 1) if total_c > 0 else None
        by_cause.append(
            CauseMetrics(
                cause=cause,
                total_cases=total_c,
                verified_recovered_amount=rec_amt,
                recovery_rate_pct=rate,
            )
        )
    by_cause.sort(key=lambda x: x.total_cases, reverse=True)

    # 4. Breakdown by Action
    target_actions = [
        Action.RETRY_LATER,
        Action.CREATE_PAYMENT_LINK,
        Action.UPDATE_PAYMENT_METHOD,
        Action.ESCALATE_HUMAN,
        Action.STOP_LIMIT_REACHED,
        Action.REFUSE_SUSPICIOUS,
    ]
    by_action: list[ActionMetrics] = []
    for act in target_actions:
        group = [r for r in latest_results if r.decision.action == act]
        cases_count = len(group)
        rec_count = sum(1 for item in group if item.verified_recovered_amount > 0)
        rec_amt = sum(item.verified_recovered_amount for item in group)
        by_action.append(
            ActionMetrics(
                action=act,
                cases=cases_count,
                verified_recoveries=rec_count,
                verified_recovered_amount=rec_amt,
            )
        )

    # 5. Safety and Learning
    policy = repo.policy or PolicySettings()
    threshold = policy.diagnosis_confidence_escalation_threshold
    high_conf = sum(1 for r in latest_results if r.diagnosis.confidence >= threshold)
    low_conf = sum(1 for r in latest_results if r.diagnosis.confidence < threshold)
    conf_dist = ConfidenceDistribution(high_confidence_count=high_conf, low_confidence_count=low_conf)

    # Human Override Rate
    reviewed_events = [e for e in repo.events if e.human_reviewed_cause or e.human_reviewed_action]
    total_reviewed = len(reviewed_events)
    override_count = 0
    for e in reviewed_events:
        res = latest_by_event.get(e.id)
        if res:
            cause_diff = e.human_reviewed_cause and e.human_reviewed_cause != res.diagnosis.cause
            action_diff = e.human_reviewed_action and e.human_reviewed_action != res.decision.action
            if cause_diff or action_diff:
                override_count += 1

    if total_reviewed > 0:
        override_rate_pct: float | None = round((override_count / total_reviewed) * 100, 1)
    else:
        override_rate_pct = None

    human_override = HumanOverrideMetrics(
        total_reviewed_cases=total_reviewed,
        override_count=override_count,
        override_rate_pct=override_rate_pct,
    )

    webhook_integrity = WebhookIntegrityMetrics(
        valid_webhooks_processed=repo.valid_webhooks_processed,
        duplicate_webhooks_ignored=repo.duplicate_webhooks_ignored,
        invalid_webhooks_rejected=repo.invalid_webhooks_rejected,
    )

    safety = SafetyAndLearningMetrics(
        confidence_distribution=conf_dist,
        human_override=human_override,
        webhook_integrity=webhook_integrity,
    )

    return RecoveryIntelligenceResponse(
        primary=primary,
        by_cause=by_cause,
        by_action=by_action,
        safety_and_learning=safety,
        data_source=repo.policy.human_approval_amount_threshold and "razorpay_test" or "razorpay_test",
    )
