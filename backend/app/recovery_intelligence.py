from datetime import datetime, timezone
import statistics

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


def parse_datetime_safe(val) -> datetime | None:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
    if isinstance(val, (int, float)):
        try:
            return datetime.fromtimestamp(val, tz=timezone.utc)
        except Exception:
            return None
    if isinstance(val, str):
        try:
            cleaned = val.replace("Z", "+00:00")
            dt = datetime.fromisoformat(cleaned)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            return None
    return None


def get_action_str(action) -> str:
    if action is None:
        return ""
    if isinstance(action, Action):
        return action.value
    if hasattr(action, "value"):
        return str(action.value)
    return str(action)


def get_cause_str(result) -> str:
    if not result or not getattr(result, "diagnosis", None):
        return "unknown"
    diag = result.diagnosis
    if hasattr(diag, "cause") and diag.cause:
        return str(diag.cause)
    if isinstance(diag, dict) and diag.get("cause"):
        return str(diag["cause"])
    return "unknown"


def get_confidence_float(result) -> float:
    if not result or not getattr(result, "diagnosis", None):
        return 0.0
    diag = result.diagnosis
    val = getattr(diag, "confidence", None)
    if val is None and isinstance(diag, dict):
        val = diag.get("confidence")
    try:
        return float(val) if val is not None else 0.0
    except (ValueError, TypeError):
        return 0.0


def compute_recovery_intelligence(repo: Repository) -> RecoveryIntelligenceResponse:
    if not repo:
        repo = Repository()

    results_list = getattr(repo, "results", []) or []
    events_list = getattr(repo, "events", []) or []

    # 1. Gather latest PipelineResult for each event
    latest_by_event = {}
    for result in results_list:
        event_id = getattr(result, "event_id", None)
        if not event_id:
            continue
        current = latest_by_event.get(event_id)
        if current is None:
            latest_by_event[event_id] = result
        else:
            curr_dt = parse_datetime_safe(getattr(current, "created_at", None))
            new_dt = parse_datetime_safe(getattr(result, "created_at", None))
            curr_ts = curr_dt.timestamp() if curr_dt else 0.0
            new_ts = new_dt.timestamp() if new_dt else 0.0
            if new_ts >= curr_ts:
                latest_by_event[event_id] = result

    latest_results = list(latest_by_event.values())
    total_evaluated_cases = len(latest_results)

    events_by_id = {getattr(e, "id", ""): e for e in events_list if getattr(e, "id", None)}

    # 2. Compute Primary Recovery Metrics
    verified_recovered_cases = []
    created_payment_links = []
    paid_payment_links = []
    verified_recovery_amount = 0.0

    for r in latest_results:
        rec_amt = float(getattr(r, "verified_recovered_amount", 0) or 0)
        link_id = getattr(r, "razorpay_payment_link_id", None)

        if rec_amt > 0:
            verified_recovered_cases.append(r)
            verified_recovery_amount += rec_amt

        if link_id:
            created_payment_links.append(r)
            if rec_amt > 0:
                paid_payment_links.append(r)

    created_payment_links_count = len(created_payment_links)
    paid_payment_links_count = len(paid_payment_links)

    if created_payment_links_count > 0:
        conversion_rate_pct: float | None = round(
            (paid_payment_links_count / created_payment_links_count) * 100, 1
        )
    else:
        conversion_rate_pct = None

    # Median Time to Recovery
    recovery_durations_minutes: list[float] = []
    for r in verified_recovered_cases:
        event_id = getattr(r, "event_id", None)
        event = events_by_id.get(event_id)
        if event:
            rec_dt = parse_datetime_safe(getattr(r, "recovered_at", None))
            occ_dt = parse_datetime_safe(getattr(event, "occurred_at", None))
            if rec_dt and occ_dt:
                diff_min = (rec_dt - occ_dt).total_seconds() / 60.0
                if diff_min >= 0:
                    recovery_durations_minutes.append(diff_min)

    if recovery_durations_minutes:
        median_time_min: float | None = round(statistics.median(recovery_durations_minutes), 1)
    else:
        median_time_min = None

    # Human-review rate
    escalated_cases_count = 0
    policy_block_count = 0
    for r in latest_results:
        decision = getattr(r, "decision", None)
        action_val = get_action_str(getattr(decision, "action", None) if decision else None)
        if action_val == Action.ESCALATE_HUMAN.value:
            escalated_cases_count += 1
        elif action_val in (Action.STOP_LIMIT_REACHED.value, Action.REFUSE_SUSPICIOUS.value):
            policy_block_count += 1

    if total_evaluated_cases > 0:
        human_review_rate_pct: float | None = round(
            (escalated_cases_count / total_evaluated_cases) * 100, 1
        )
    else:
        human_review_rate_pct = None

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
        cause = get_cause_str(r)
        cause_groups.setdefault(cause, []).append(r)

    by_cause: list[CauseMetrics] = []
    for cause, group in cause_groups.items():
        total_c = len(group)
        rec_amt = sum(float(getattr(item, "verified_recovered_amount", 0) or 0) for item in group)
        rec_c = sum(1 for item in group if float(getattr(item, "verified_recovered_amount", 0) or 0) > 0)
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
        group = [
            r
            for r in latest_results
            if get_action_str(getattr(getattr(r, "decision", None), "action", None)) == act.value
        ]
        cases_count = len(group)
        rec_count = sum(1 for item in group if float(getattr(item, "verified_recovered_amount", 0) or 0) > 0)
        rec_amt = sum(float(getattr(item, "verified_recovered_amount", 0) or 0) for item in group)
        by_action.append(
            ActionMetrics(
                action=act,
                cases=cases_count,
                verified_recoveries=rec_count,
                verified_recovered_amount=rec_amt,
            )
        )

    # 5. Safety and Learning
    policy = getattr(repo, "policy", None) or PolicySettings()
    threshold = getattr(policy, "diagnosis_confidence_escalation_threshold", 0.6)

    high_conf = sum(1 for r in latest_results if get_confidence_float(r) >= threshold)
    low_conf = sum(1 for r in latest_results if get_confidence_float(r) < threshold)
    conf_dist = ConfidenceDistribution(high_confidence_count=high_conf, low_confidence_count=low_conf)

    # Human Override Rate
    reviewed_events = [
        e
        for e in events_list
        if getattr(e, "human_reviewed_cause", None) or getattr(e, "human_reviewed_action", None)
    ]
    total_reviewed = len(reviewed_events)
    override_count = 0
    for e in reviewed_events:
        event_id = getattr(e, "id", None)
        res = latest_by_event.get(event_id)
        if res:
            diag_cause = get_cause_str(res)
            dec_act = get_action_str(getattr(getattr(res, "decision", None), "action", None))
            rev_cause = getattr(e, "human_reviewed_cause", None)
            rev_action = get_action_str(getattr(e, "human_reviewed_action", None))

            cause_diff = rev_cause and rev_cause != diag_cause
            action_diff = rev_action and rev_action != dec_act
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
        valid_webhooks_processed=getattr(repo, "valid_webhooks_processed", 0) or 0,
        duplicate_webhooks_ignored=getattr(repo, "duplicate_webhooks_ignored", 0) or 0,
        invalid_webhooks_rejected=getattr(repo, "invalid_webhooks_rejected", 0) or 0,
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
        data_source="razorpay_test",
    )
