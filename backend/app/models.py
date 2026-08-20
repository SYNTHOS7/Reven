from datetime import datetime, timezone
from enum import Enum
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
    payment_method: str | None = None
    error_description: str | None = None
    ground_truth_source: str | None = None


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
    data_source: str = "razorpay_test"


class RunResponse(BaseModel):
    scorecard: ScorecardRun
    results: list[PipelineResult]


class PaymentLinkRequest(BaseModel):
    event_id: str


class GroundTruthUpdate(BaseModel):
    correct_cause: str
    correct_action: Action
    reviewer_notes: str = Field(min_length=3, max_length=1000)


class WebhookResponse(BaseModel):
    status: str
    event_id: str | None = None
