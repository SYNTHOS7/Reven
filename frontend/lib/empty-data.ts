import type { DashboardData, PolicySettings } from "./types";

export const defaultPolicy: PolicySettings = {
  max_retries_per_payment: 3,
  max_messages_per_customer_per_day: 1,
  human_approval_amount_threshold: 5000,
  diagnosis_confidence_escalation_threshold: 0.6,
  trust_gate_attempts_window_hours: 24,
  trust_gate_max_attempts_in_window: 5,
  tiny_amount_threshold: 20,
};

export const disconnectedData: DashboardData = {
  source: "disconnected",
  results: [],
  scorecard: {
    id: "not-connected",
    run_at: new Date(0).toISOString(),
    total_cases: 0,
    flagged_cases: 0,
    diagnosis_accuracy_pct: 0,
    action_accuracy_pct: 0,
    policy_compliance_pct: 0,
    actual_test_recovery: 0,
    suspicious_refusals: 0,
    escalated_cases: 0,
    wrong_or_uncertain_cases: [],
    policy_snapshot: defaultPolicy,
    pipeline_version: "not-connected",
    random_seed: 0,
    labeled_cases: 0,
    data_source: "none",
  },
};
