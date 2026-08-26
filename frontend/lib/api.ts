import { defaultPolicy, disconnectedData } from "./empty-data";
import type {
  Action,
  CaseDetailResponse,
  DashboardData,
  PipelineResult,
  PolicyReplayResponse,
  PolicyImpactResponse,
  PolicySettings,
  RecoveryIntelligenceResponse,
  RecoveryStrategiesResponse,
  RecoveryTimelineResponse,
} from "./types";

const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

export async function loadDashboard(): Promise<DashboardData> {
  if (!apiUrl) return disconnectedData;
  try {
    const [scorecardResponse, eventsResponse] = await Promise.all([
      fetch(`${apiUrl}/eval/latest`, { cache: "no-store" }),
      fetch(`${apiUrl}/events?limit=200`, { cache: "no-store" }),
    ]);
    if (!scorecardResponse.ok || !eventsResponse.ok) throw new Error("API unavailable");
    const scorecard = await scorecardResponse.json();
    const events = await eventsResponse.json();
    return { scorecard, results: events.items, source: "api" };
  } catch {
    return disconnectedData;
  }
}

export async function runEvaluation(): Promise<DashboardData> {
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const response = await fetch(`${apiUrl}/eval/run`, { method: "POST" });
  if (!response.ok) throw new Error("Evaluation failed");
  const data = await response.json();
  return { ...data, source: "api" };
}

export async function loadPolicy(): Promise<PolicySettings> {
  if (!apiUrl) return defaultPolicy;
  try {
    const response = await fetch(`${apiUrl}/settings`, { cache: "no-store" });
    if (!response.ok) throw new Error("Policy unavailable");
    return response.json();
  } catch {
    return defaultPolicy;
  }
}

export async function savePolicy(policy: PolicySettings, adminToken?: string): Promise<PolicySettings> {
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const response = await fetch(`${apiUrl}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(adminToken ? { "X-Admin-Token": adminToken } : {}) },
    body: JSON.stringify(policy),
  });
  if (!response.ok) throw new Error("Policy update failed");
  return response.json();
}

export async function loadCase(eventId: string): Promise<PipelineResult | null> {
  if (!apiUrl) return null;
  try {
    const response = await fetch(`${apiUrl}/events/${eventId}`, { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json();
    return data.pipeline_result;
  } catch {
    return null;
  }
}

export async function createPaymentLink(eventId: string): Promise<{ id: string; short_url: string; mode: string }> {
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const response = await fetch(`${apiUrl}/recovery/payment-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_id: eventId }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? "Payment Link could not be created");
  }
  return response.json();
}

export async function approvePaymentLink(
  eventId: string,
  approvalNote: string,
  adminToken: string,
): Promise<{ id: string; short_url: string; mode: string; approval: string }> {
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const response = await fetch(`${apiUrl}/recovery/payment-link/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken },
    body: JSON.stringify({ event_id: eventId, approval_note: approvalNote }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? "Operator approval failed");
  }
  return response.json();
}

export async function reconcilePaymentLink(
  eventId: string,
  adminToken: string,
): Promise<{ status: string; payment_link_id: string; amount_recovered: number }> {
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const response = await fetch(`${apiUrl}/recovery/payment-link/reconcile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken },
    body: JSON.stringify({ event_id: eventId }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? "Recovery verification failed");
  }
  return response.json();
}

export async function loadCaseDetails(eventId: string): Promise<CaseDetailResponse | null> {
  if (!apiUrl) return null;
  try {
    const response = await fetch(`${apiUrl}/events/${eventId}`, { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json();
    return data;
  } catch {
    return null;
  }
}

export async function loadRecoveryStrategies(eventId: string): Promise<RecoveryStrategiesResponse | null> {
  if (!apiUrl) return null;
  try {
    const response = await fetch(`${apiUrl}/events/${eventId}/strategies`, { cache: "no-store" });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function loadRecoveryTimeline(eventId: string): Promise<RecoveryTimelineResponse | null> {
  if (!apiUrl) return null;
  try {
    const response = await fetch(`${apiUrl}/events/${eventId}/timeline`, { cache: "no-store" });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function submitOperatorFeedback(
  eventId: string,
  correctCause: string,
  correctAction: Action,
  reviewerNotes: string,
  adminToken?: string,
): Promise<{ expected_cause: string; expected_action: string; ground_truth_source: string }> {
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (adminToken) headers["X-Admin-Token"] = adminToken;
  const response = await fetch(`${apiUrl}/events/${eventId}/ground-truth`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      correct_cause: correctCause,
      correct_action: correctAction,
      reviewer_notes: reviewerNotes,
    }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? "Failed to save operator feedback");
  }
  return response.json();
}

export async function runPolicyReplay(
  eventId: string,
  policy: PolicySettings,
): Promise<PolicyReplayResponse> {
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const response = await fetch(`${apiUrl}/events/${eventId}/replay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_id: eventId, policy }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? "Policy replay failed");
  }
  return response.json();
}

export async function runPolicyImpact(policy: PolicySettings): Promise<PolicyImpactResponse> {
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const response = await fetch(`${apiUrl}/policy/impact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(policy),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? "Policy impact simulation failed");
  }
  return response.json();
}

export async function loadRecoveryIntelligence(): Promise<RecoveryIntelligenceResponse | null> {
  if (!apiUrl) return null;
  try {
    const response = await fetch(`${apiUrl}/metrics/recovery-intelligence`, { cache: "no-store" });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}
