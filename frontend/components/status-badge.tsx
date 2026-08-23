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
  recovered: "Recovered",
  failed: "Failed",
  pending: "Pending",
  review: "Review",
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
  "recovered",
  "Recovered",
  "RECOVERED",
]);

const warning = new Set([
  "escalate_human",
  "unknown",
  "Human review required",
  "Recovery link created — awaiting payment",
  "review",
  "Review",
  "REVIEW",
  "pending",
  "Pending",
]);

export function StatusBadge({ value }: { value: string }) {
  const displayLabel = labels[value] || value.replaceAll("_", " ");
  const tone = safe.has(value) || safe.has(displayLabel)
    ? "recovered"
    : warning.has(value) || warning.has(displayLabel)
    ? "review"
    : value.includes("suspicious") || value.includes("refuse") || value.includes("Blocked") || value.toLowerCase().includes("fail")
    ? "risk"
    : "neutral";

  return (
    <span className={cn("stitchBadge", `stitchBadge-${tone}`)}>
      <span className="stitchBadgeDot" />
      <span>{displayLabel}</span>
    </span>
  );
}

