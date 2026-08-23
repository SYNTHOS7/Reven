import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatConfidence } from "./confidence";
import type { PipelineResult, PolicySettings } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getWhyThisAction(result: PipelineResult, policy?: PolicySettings): string {
  if (result.verified_recovered_amount > 0) {
    return "Verified: Razorpay paid webhook confirmed recovery.";
  }
  if (result.razorpay_payment_link_id) {
    return "Recovery pending: payment link created, awaiting paid webhook.";
  }
  if (result.trust_gate.status === "suspicious" || result.decision.action === "refuse_suspicious") {
    return `Blocked: ${result.trust_gate.reason || "suspicious attempt pattern detected by trust gate."}`;
  }
  if (result.decision.action === "stop_limit_reached") {
    return `Blocked: ${result.decision.reason || "retry limit reached."}`;
  }
  if (result.decision.action === "escalate_human") {
    const reason = (result.decision.reason || "").toLowerCase();
    if (
      reason.includes("amount") ||
      reason.includes("threshold") ||
      reason.includes("boundary") ||
      (policy && result.amount >= policy.human_approval_amount_threshold)
    ) {
      const formattedThreshold = policy
        ? `₹${policy.human_approval_amount_threshold.toLocaleString("en-IN")}`
        : "policy boundary";
      return `Escalated: payment amount exceeds ${formattedThreshold} policy boundary.`;
    }
    if (reason.includes("confidence") || reason.includes("floor") || reason.includes("below")) {
      const formattedConf = policy
        ? formatConfidence(policy.diagnosis_confidence_escalation_threshold)
        : "policy threshold";
      return `Escalated: diagnosis confidence is below ${formattedConf}.`;
    }
    return "Escalated: generic processor failure gave no safe automated recovery action.";
  }
  if (result.decision.action === "retry_later") {
    return "Retry scheduled: transient failure within policy retry bounds.";
  }
  if (result.decision.action === "update_payment_method") {
    return "Action required: customer payment method expired or lapsed mandate.";
  }
  if (result.decision.action === "create_payment_link") {
    return "Action approved: bounded payment link can be created.";
  }
  if (result.decision.action === "no_action") {
    return "No action: payment failure did not meet recovery criteria.";
  }
  return result.decision.reason || "Action evaluated under active policy bounds.";
}

/* ── PII Masking ── */

export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "••••@••••";
  const [local, domain] = email.split("@");
  const visible = local.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(local.length - 2, 3))}@${domain}`;
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return "••••••••••";
  const digits = phone.replace(/\D/g, "");
  return `${"•".repeat(Math.max(digits.length - 4, 6))}${digits.slice(-4)}`;
}

export function maskPII(value: string, type: "email" | "phone"): string {
  return type === "email" ? maskEmail(value) : maskPhone(value);
}
