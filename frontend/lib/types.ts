export type Action =
  | "retry_later"
  | "create_payment_link"
  | "update_payment_method"
  | "escalate_human"
  | "stop_limit_reached"
  | "refuse_suspicious"
  | "no_action";

export interface PolicySettings {
  max_retries_per_payment: number;
  max_messages_per_customer_per_day: number;
  human_approval_amount_threshold: number;
  diagnosis_confidence_escalation_threshold: number;
  trust_gate_attempts_window_hours: number;
  trust_gate_max_attempts_in_window: number;
  tiny_amount_threshold: number;
}

export interface StageResult {
  status: string;
  reason: string;
}

export interface HumanReviewAudit {
  human_reviewed_cause: string;
  human_reviewed_action: Action;
  human_reviewed_note: string;
  human_reviewed_at: string;
}

export interface PaymentEventDetails {
  id: string;
  customer_id: string;
  customer_name: string;
  type: string;
  amount: number;
  failure_code: string;
  occurred_at: string;
  payment_method?: string | null;
  error_description?: string | null;
  bank?: string | null;
  wallet?: string | null;
  vpa?: string | null;
  card_network?: string | null;
  card_type?: string | null;
  error_source?: string | null;
  error_step?: string | null;
  human_reviewed_cause?: string | null;
  human_reviewed_action?: Action | null;
  human_reviewed_note?: string | null;
  human_reviewed_at?: string | null;
}

export interface PipelineResult {
  id: string;
  run_id: string;
  event_id: string;
  customer_id: string;
  customer_name: string;
  event_type: string;
  amount: number;
  failure_code: string;
  occurred_at: string;
  detection: StageResult;
  trust_gate: StageResult;
  diagnosis: {
    cause: string;
    method: string;
    confidence: number;
    reason: string;
    evidence_used?: string[];
  };
  decision: { action: Action; reason: string; requires_customer_contact: boolean };
  generated_message: string | null;
  verified_recovered_amount: number;
  razorpay_payment_link_id?: string | null;
}

export interface CaseDetailResponse {
  event: PaymentEventDetails;
  pipeline_result: PipelineResult;
  similar_cases: SimilarCases;
}

export interface SimilarCase {
  event_id: string;
  amount: number;
  occurred_at: string;
  failure_code: string;
  payment_method: string | null;
  diagnosed_cause: string;
  decision_action: Action;
  verified_recovered_amount: number;
  match_reasons: string[];
}

export interface SimilarCases {
  scope: string;
  cases: SimilarCase[];
  comparable_case_count: number;
  verified_recovery_count: number;
  verified_recovered_amount: number;
  disclaimer: string;
}

export interface PolicyReplayRequest {
  event_id: string;
  policy: PolicySettings;
}

export interface PolicyReplayResponse {
  event_id: string;
  original_policy: PolicySettings;
  original_decision: { action: Action; reason: string; requires_customer_contact: boolean };
  original_diagnosis: { cause: string; method: string; confidence: number; reason: string };
  proposed_policy: PolicySettings;
  proposed_decision: { action: Action; reason: string; requires_customer_contact: boolean };
  proposed_message: string | null;
  is_dry_run: boolean;
  disclaimer: string;
}

export interface Scorecard {
  id: string;
  run_at: string;
  total_cases: number;
  flagged_cases: number;
  diagnosis_accuracy_pct: number;
  action_accuracy_pct: number;
  policy_compliance_pct: number;
  actual_test_recovery: number;
  suspicious_refusals: number;
  escalated_cases: number;
  wrong_or_uncertain_cases: Array<{
    event_id: string;
    expected: string;
    actual: string;
    reason: string;
  }>;
  policy_snapshot: PolicySettings;
  pipeline_version: string;
  random_seed: number;
  labeled_cases: number;
  data_source: string;
}

export interface DashboardData {
  scorecard: Scorecard;
  results: PipelineResult[];
  source: "api" | "disconnected";
}

export interface CauseMetrics {
  cause: string;
  total_cases: number;
  verified_recovered_amount: number;
  recovery_rate_pct: number | null;
}

export interface ActionMetrics {
  action: Action;
  cases: number;
  verified_recoveries: number;
  verified_recovered_amount: number;
}

export interface ConfidenceDistribution {
  high_confidence_count: number;
  low_confidence_count: number;
}

export interface HumanOverrideMetrics {
  total_reviewed_cases: number;
  override_count: number;
  override_rate_pct: number | null;
}

export interface WebhookIntegrityMetrics {
  valid_webhooks_processed: number;
  duplicate_webhooks_ignored: number;
  invalid_webhooks_rejected: number;
}

export interface SafetyAndLearningMetrics {
  confidence_distribution: ConfidenceDistribution;
  human_override: HumanOverrideMetrics;
  webhook_integrity: WebhookIntegrityMetrics;
}

export interface PrimaryRecoveryMetrics {
  verified_recovery_amount: number;
  payment_link_conversion_rate_pct: number | null;
  created_payment_links_count: number;
  paid_payment_links_count: number;
  median_time_to_recovery_minutes: number | null;
  verified_recovery_cases_count: number;
  human_review_rate_pct: number | null;
  total_evaluated_cases: number;
  escalated_cases_count: number;
  policy_block_count: number;
}

export interface RecoveryIntelligenceResponse {
  primary: PrimaryRecoveryMetrics;
  by_cause: CauseMetrics[];
  by_action: ActionMetrics[];
  safety_and_learning: SafetyAndLearningMetrics;
  data_source: string;
}

// ---------------- CSV & Demo Data Types ----------------
export type TransactionStatus = "successful" | "failed" | "abandoned" | "recovered";

export type DemoActionType =
  | "not_started"
  | "preview_whatsapp"
  | "preview_email"
  | "create_payment_link"
  | "recommend_alternative"
  | "escalate_high_value"
  | "mark_recovered";

export interface Transaction {
  transaction_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  payment_method: string;
  failure_reason: string;
  attempted_at: string;
  retry_count: number;

  // Derived Intelligence
  likely_root_cause?: string;
  recovery_probability?: number; // 0 - 100
  recommended_action?: string;
  action_status?: DemoActionType;
  action_note?: string;
  simulated_link?: string;
  recovered_at?: string;
  is_high_priority?: boolean;
}

export interface CSVValidationError {
  row: number;
  field?: string;
  message: string;
  value?: string;
}

export interface CSVValidationResult {
  valid: boolean;
  transactions: Transaction[];
  errors: CSVValidationError[];
  totalRows: number;
  validRows: number;
}

export interface RevenueIntelligenceMetrics {
  totalAttemptedRevenue: number;
  revenueCollected: number;
  revenueLost: number;
  potentiallyRecoverableRevenue: number;
  revenueRecovered: number;
  recoveryRatePct: number;
  affectedCustomersCount: number;
  failureReasonStats: FailureReasonStat[];
  recoveryTrends: RecoveryTrendPoint[];
  highPriorityOpportunities: Transaction[];
}

export interface FailureReasonStat {
  reason: string;
  label: string;
  count: number;
  lostAmount: number;
  percentage: number;
  recommendedAlternative: string;
  isCardPattern: boolean;
}

export interface RecoveryTrendPoint {
  date: string;
  attempted: number;
  lost: number;
  recovered: number;
}

