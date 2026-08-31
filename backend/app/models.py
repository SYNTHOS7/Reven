from datetime import datetime, timezone
from enum import Enum
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class EventType(str, Enum):
    PAYMENT_FAILED = "payment_failed"
    RENEWAL_FAILED = "subscription_renewal_failed"
    INVOICE_OVERDUE = "invoice_overdue"
    PAYMENT_SUCCEEDED = "payment_succeeded"


class Action(str, Enum):
    RETRY_LATER = "retry_later"
    CREATE_PAYMENT_LINK = "create_payment_link"
    UPDATE_PAYMENT_METHOD = "update_payment_method"
    ESCALATE_HUMAN = "escalate_human"
    STOP_LIMIT_REACHED = "stop_limit_reached"
    REFUSE_SUSPICIOUS = "refuse_suspicious"
    NO_ACTION = "no_action"


class CustomerHistory(BaseModel):
    successful_payments: int = 0
    prior_failures: int = 0
    tenure_days: int = 0


class PaymentEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    customer_id: str
    customer_name: str
    type: EventType
    amount: float = Field(ge=0)
    failure_code: str = "unknown"
    raw_error_code: str | None = None
    occurred_at: datetime = Field(default_factory=utc_now)
    retry_count: int = 0
    messages_sent_today: int = 0
    attempts_in_window: int = 1
    instrument_fingerprint: str | None = None
    ip_address: str | None = None
    history: CustomerHistory = Field(default_factory=CustomerHistory)
    expected_cause: str | None = None
    expected_action: Action | None = None
    source: str = "razorpay_test"
    source_event_id: str | None = None
    batch_id: str | None = None
    payment_method: str | None = None
    error_description: str | None = None
    bank: str | None = None
    wallet: str | None = None
    vpa: str | None = None
    card_network: str | None = None
    card_type: str | None = None
    error_source: str | None = None
    error_step: str | None = None
    ground_truth_source: str | None = None
    human_reviewed_cause: str | None = None
    human_reviewed_action: Action | None = None
    human_reviewed_note: str | None = None
    human_reviewed_at: datetime | None = None


class PolicySettings(BaseModel):
    max_retries_per_payment: int = Field(default=3, ge=0, le=10)
    max_messages_per_customer_per_day: int = Field(default=1, ge=0, le=10)
    human_approval_amount_threshold: float = Field(default=5000, ge=0)
    diagnosis_confidence_escalation_threshold: float = Field(default=0.6, ge=0, le=1)
    trust_gate_attempts_window_hours: int = Field(default=24, ge=1, le=168)
    trust_gate_max_attempts_in_window: int = Field(default=5, ge=1, le=100)
    tiny_amount_threshold: float = Field(default=20, ge=0)


class StageResult(BaseModel):
    status: str
    reason: str


class DiagnosisResult(BaseModel):
    cause: str
    method: str
    confidence: float = Field(ge=0, le=1)
    reason: str
    evidence_used: list[str] = Field(default_factory=list)
    tool_calls: list[str] = Field(default_factory=list)


class AdvisoryInvestigationResponse(BaseModel):
    """A read-only model investigation kept separate from the pipeline result."""

    event_id: str
    diagnosis: DiagnosisResult
    mode: Literal["advisory_only"] = "advisory_only"
    financial_authority: bool = False
    disclaimer: str


class DecisionResult(BaseModel):
    action: Action
    reason: str
    requires_customer_contact: bool = False


class PipelineResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    run_id: str
    event_id: str
    customer_id: str
    customer_name: str
    event_type: EventType
    amount: float
    failure_code: str
    occurred_at: datetime
    detection: StageResult
    trust_gate: StageResult
    diagnosis: DiagnosisResult
    decision: DecisionResult
    generated_message: str | None = None
    verified_recovered_amount: float = 0
    razorpay_payment_link_id: str | None = None
    recovered_at: datetime | None = None
    created_at: datetime = Field(default_factory=utc_now)
    source: str = "razorpay_test"
    source_event_id: str | None = None


class WrongCase(BaseModel):
    event_id: str
    expected: str
    actual: str
    reason: str


class ScorecardRun(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    run_at: datetime = Field(default_factory=utc_now)
    total_cases: int
    flagged_cases: int
    diagnosis_accuracy_pct: float
    action_accuracy_pct: float
    policy_compliance_pct: float
    actual_test_recovery: float = 0
    suspicious_refusals: int
    escalated_cases: int
    wrong_or_uncertain_cases: list[WrongCase]
    policy_snapshot: PolicySettings
    pipeline_version: str = "0.1.0"
    random_seed: int = 2408
    labeled_cases: int = 0
    diagnosis_labelled_cases: int = 0
    diagnosis_excluded_safety_blocks: int = 0
    action_labelled_cases: int = 0
    data_source: str = "razorpay_test"


class RunResponse(BaseModel):
    scorecard: ScorecardRun
    results: list[PipelineResult]


class PaymentLinkRequest(BaseModel):
    event_id: str


class OperatorApprovalRequest(BaseModel):
    event_id: str
    approval_note: str = Field(min_length=5, max_length=500)


class GroundTruthUpdate(BaseModel):
    correct_cause: str
    correct_action: Action
    reviewer_notes: str = Field(min_length=3, max_length=1000)


class DiagnosisLabelUpdate(BaseModel):
    """A cause-only human label used to evaluate diagnosis agreement."""

    correct_cause: str = Field(min_length=2, max_length=120)
    reviewer_notes: str = Field(min_length=3, max_length=1000)


class PolicyReplayRequest(BaseModel):
    event_id: str
    policy: PolicySettings


class PolicyReplayResponse(BaseModel):
    event_id: str
    original_policy: PolicySettings
    original_decision: DecisionResult
    original_diagnosis: DiagnosisResult
    proposed_policy: PolicySettings
    proposed_decision: DecisionResult
    proposed_message: str | None = None
    is_dry_run: bool = True
    disclaimer: str = "Dry run — no customer action, message, payment link, or revenue metric was changed."


class RecoveryStrategy(BaseModel):
    """An explainable recovery option. This object never performs an action."""

    id: str
    title: str
    description: str
    status: str  # allowed | requires_human_review | blocked
    rationale: str
    next_step: str


class RecoveryStrategiesResponse(BaseModel):
    event_id: str
    strategies: list[RecoveryStrategy]
    disclaimer: str = (
        "Strategies are recommendations only. Trust Gate and policy control what can run; "
        "this endpoint cannot send a message, create a link, retry a payment, or claim revenue."
    )


class RecoveryTimelineItem(BaseModel):
    stage: str
    title: str
    status: str  # completed | ready_for_operator | waiting | blocked
    occurred_at: datetime | None = None
    detail: str


class RecoveryTimelineResponse(BaseModel):
    event_id: str
    items: list[RecoveryTimelineItem]
    next_eligible_at: datetime | None = None
    next_eligibility_note: str | None = None
    disclaimer: str = (
        "This is a planning timeline, not an automated scheduler. Reven does not retry a payment, "
        "send a customer message, or create a link from this endpoint."
    )


class PolicyImpactChange(BaseModel):
    event_id: str
    amount: float
    failure_code: str
    current_action: Action
    proposed_action: Action
    reason: str


class PolicyImpactResponse(BaseModel):
    total_cases: int
    source_scope: str
    unchanged_cases: int
    action_changed_cases: int
    newly_human_review_cases: int
    newly_blocked_cases: int
    current_action_breakdown: dict[str, int]
    proposed_action_breakdown: dict[str, int]
    changes: list[PolicyImpactChange]
    disclaimer: str = (
        "Portfolio simulation only. It re-evaluates saved evidence with candidate policy bounds; "
        "it does not change policy, re-run AI, retry payments, contact customers, or create links."
    )


class EvidenceQualityResponse(BaseModel):
    event_id: str
    status: str  # ready | needs_review | insufficient_evidence
    score: int = Field(ge=0, le=100)
    captured_signals: list[str]
    missing_signals: list[str]
    assessment: str
    recommended_boundary: str
    disclaimer: str = "Evidence quality is an operator aid, not a fraud score or a recovery guarantee."


class EvidenceReceiptResponse(BaseModel):
    event_id: str
    pipeline_result_id: str
    run_id: str
    fingerprint_sha256: str
    generated_at: datetime = Field(default_factory=utc_now)
    scope: str
    disclaimer: str = (
        "This fingerprint is computed from the stored event and pipeline decision record. "
        "It is a tamper-evident comparison aid, not a payment confirmation."
    )


class LearningHealthResponse(BaseModel):
    test_mode_cases: int
    human_labelled_cases: int
    label_coverage_pct: float | None = None
    cause_agreement_pct: float | None = None
    action_agreement_pct: float | None = None
    operator_overrides: int
    diagnoses_by_method: dict[str, int]
    learning_status: str
    next_evidence_goal: str
    disclaimer: str = (
        "Only explicit human-reviewed Razorpay Test Mode labels count as learning evidence. "
        "Simulated merchant data and unreviewed outcomes are excluded."
    )


class RecoveryQueueItem(BaseModel):
    event_id: str
    amount: float
    failure_code: str
    decision_action: Action
    priority_score: int = Field(ge=0, le=100)
    priority: str
    reason: str
    requires_human_review: bool


class RecoveryQueueResponse(BaseModel):
    source_scope: str
    items: list[RecoveryQueueItem]
    total_open_cases: int
    excluded_suspicious_cases: int
    disclaimer: str = (
        "Queue ranking is deterministic and based on stored Test Mode evidence, policy result, and amount. "
        "It does not predict payment success or execute recovery."
    )


class ReadinessCheck(BaseModel):
    name: str
    status: str  # ready | missing | optional
    detail: str


class ReadinessResponse(BaseModel):
    status: str  # ready_for_test_mode | limited
    checks: list[ReadinessCheck]
    disclaimer: str = "Readiness reports configuration presence only; it never exposes secret values."


class MerchantPattern(BaseModel):
    label: str = Field(min_length=1, max_length=100)
    count: int = Field(ge=0, le=1_000_000)
    lost_amount: float = Field(ge=0)
    recommended_alternative: str = Field(min_length=1, max_length=240)


class MerchantBriefingRequest(BaseModel):
    data_source: Literal["simulated_merchant_scenario", "razorpay_test"]
    revenue_lost: float = Field(ge=0)
    potentially_recoverable_revenue: float = Field(ge=0)
    verified_recovered_revenue: float = Field(ge=0)
    priority_case_count: int = Field(ge=0, le=1_000_000)
    patterns: list[MerchantPattern] = Field(default_factory=list, max_length=5)


class MerchantBriefingResponse(BaseModel):
    headline: str = Field(min_length=5, max_length=160)
    narrative: str = Field(min_length=20, max_length=500)
    recommended_next_steps: list[str] = Field(min_length=1, max_length=3)
    method: Literal["llm", "deterministic"]
    data_source: Literal["simulated_merchant_scenario", "razorpay_test"]
    decision_boundary: str = (
        "This briefing uses aggregate metrics only. It cannot contact customers, change policy, or execute a recovery action."
    )


class CauseMetrics(BaseModel):
    cause: str
    total_cases: int
    verified_recovered_amount: float
    recovery_rate_pct: float | None = None


class ActionMetrics(BaseModel):
    action: Action
    cases: int
    verified_recoveries: int
    verified_recovered_amount: float


class ConfidenceDistribution(BaseModel):
    high_confidence_count: int
    low_confidence_count: int


class HumanOverrideMetrics(BaseModel):
    total_reviewed_cases: int
    override_count: int
    override_rate_pct: float | None = None


class WebhookIntegrityMetrics(BaseModel):
    valid_webhooks_processed: int
    duplicate_webhooks_ignored: int
    invalid_webhooks_rejected: int


class SafetyAndLearningMetrics(BaseModel):
    confidence_distribution: ConfidenceDistribution
    human_override: HumanOverrideMetrics
    webhook_integrity: WebhookIntegrityMetrics


class PrimaryRecoveryMetrics(BaseModel):
    verified_recovery_amount: float
    payment_link_conversion_rate_pct: float | None = None
    created_payment_links_count: int
    paid_payment_links_count: int
    median_time_to_recovery_minutes: float | None = None
    verified_recovery_cases_count: int
    human_review_rate_pct: float | None = None
    total_evaluated_cases: int
    escalated_cases_count: int
    policy_block_count: int


class RecoveryIntelligenceResponse(BaseModel):
    primary: PrimaryRecoveryMetrics
    by_cause: list[CauseMetrics]
    by_action: list[ActionMetrics]
    safety_and_learning: SafetyAndLearningMetrics
    data_source: str = "razorpay_test"


class VerifiedRecoverySummary(BaseModel):
    """Database-backed recovery evidence for public, aggregate UI surfaces."""

    verified_recovery_amount: float = 0
    verified_recovery_count: int = 0
    source: str = "recovery_attempts"
    disclaimer: str = (
        "Counts only completed, attributed Razorpay Test Mode recovery records. "
        "Creating a Payment Link is not recovered revenue."
    )


class BatchSummary(BaseModel):
    """Read-only evidence totals scoped to one real Razorpay Test Mode batch."""

    batch_id: str
    total_cases: int = 0
    trust_gate_blocks: int = 0
    human_review_escalations: int = 0
    verified_recovery_count: int = 0
    verified_recovery_amount: float = 0
    diagnosis_labelled_cases: int = 0
    diagnosis_excluded_safety_blocks: int = 0
    diagnosis_accuracy_pct: float | None = None
    source: str = "razorpay_test"
    disclaimer: str = (
        "Batch totals include only events that carried this batch ID in a signed Razorpay Test Mode webhook. "
        "Verified recovery counts only completed, attributed recovery records."
    )


class BatchDiagnosisReviewItem(BaseModel):
    event_id: str
    amount: float
    failure_code: str
    processor_description: str | None = None
    payment_method: str | None = None
    ai_assigned_cause: str
    diagnosis_method: str
    confidence: float
    decision_action: Action
    trust_gate_status: str
    human_label: str | None = None
    reviewer_note: str | None = None


class AiComparisonItem(BaseModel):
    event_id: str
    human_label: str
    stored_diagnosis: DiagnosisResult
    advisory_diagnosis: DiagnosisResult | None = None
    status: Literal["completed", "unavailable"]


class BatchAiComparisonResponse(BaseModel):
    """A transient, advisory-only comparison across human-reviewed Test Mode cases."""

    batch_id: str
    eligible_human_reviewed_cases: int
    model_calls_completed: int
    model_calls_unavailable: int
    rule_agreement_pct: float | None = None
    advisory_ai_agreement_pct: float | None = None
    comparisons: list[AiComparisonItem]
    disclaimer: str = (
        "Advisory comparison only. Each model call uses read-only evidence and does not modify the stored diagnosis, "
        "Trust Gate, policy decision, Payment Link state, or recovery metrics. Results are not production accuracy claims."
    )


class WebhookResponse(BaseModel):
    status: str
    event_id: str | None = None
