import { cn } from "@/lib/utils";

const safe = new Set(["clear", "flagged", "retry_later", "create_payment_link", "update_payment_method"]);
const warning = new Set(["escalate_human", "unknown", "stop_limit_reached"]);

export function StatusBadge({ value }: { value: string }) {
  const tone = safe.has(value) ? "safe" : warning.has(value) ? "warning" : value.includes("suspicious") || value.includes("refuse") ? "risk" : "neutral";
  return <span className={cn("statusBadge", `status-${tone}`)}>{value.replaceAll("_", " ")}</span>;
}
