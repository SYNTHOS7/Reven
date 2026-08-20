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
  diagnosis: { cause: string; method: string; confidence: number; reason: string };
  decision: { action: Action; reason: string; requires_customer_contact: boolean };
  generated_message: string | null;
  verified_recovered_amount: number;
  razorpay_payment_link_id?: string | null;
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
