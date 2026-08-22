import { cn } from "@/lib/utils";

const labels: Record<string, string> = {
  escalate_human: "Human review required",
  stop_limit_reached: "Blocked by policy",
  refuse_suspicious: "Blocked by policy",
  no_action: "No action",
  create_payment_link: "Payment link approved",
  retry_later: "Retry scheduled",
  update_payment_method: "Update payment method",
  awaiting_payment: "Recovery link created — awaiting payment",
  verified_recovered: "Verified recovered by Razorpay webhook",
};

const safe = new Set([
  "clear",
  "flagged",
  "retry_later",
  "create_payment_link",
  "update_payment_method",
  "Payment link approved",
  "Retry scheduled",
  "Update payment method",
  "Verified recovered by Razorpay webhook",
]);

const warning = new Set([
  "escalate_human",
  "unknown",
  "Human review required",
  "Recovery link created — awaiting payment",
]);

export function StatusBadge({ value }: { value: string }) {
  const displayLabel = labels[value] || value.replaceAll("_", " ");
  const tone = safe.has(value) || safe.has(displayLabel)
    ? "safe"
    : warning.has(value) || warning.has(displayLabel)
    ? "warning"
    : value.includes("suspicious") || value.includes("refuse") || value.includes("Blocked")
    ? "risk"
    : "neutral";

  return <span className={cn("statusBadge", `status-${tone}`)}>{displayLabel}</span>;
}
