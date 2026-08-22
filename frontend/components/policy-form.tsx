"use client";

import { useState } from "react";
import { Save, ShieldCheck } from "lucide-react";

import { savePolicy } from "@/lib/api";
import type { PolicySettings } from "@/lib/types";
import { formatConfidence } from "@/lib/confidence";
import { Button } from "./ui/button";

const fields: Array<{ key: keyof PolicySettings; label: string; hint: string; step?: number }> = [
  { key: "max_retries_per_payment", label: "Maximum retries", hint: "Stop recovery when an event reaches this count." },
  { key: "max_messages_per_customer_per_day", label: "Daily contact limit", hint: "Maximum generated outreach per customer per day." },
  { key: "human_approval_amount_threshold", label: "Human review threshold ₹", hint: "Cases at or above this value move to human review." },
  { key: "diagnosis_confidence_escalation_threshold", label: "Minimum diagnosis confidence", hint: "Lower-confidence cases move to human review.", step: 0.05 },
  { key: "trust_gate_attempts_window_hours", label: "Trust window in hours", hint: "Look-back window for repeated attempts." },
  { key: "trust_gate_max_attempts_in_window", label: "Maximum attempts in window", hint: "Higher activity is refused as suspicious." },
  { key: "tiny_amount_threshold", label: "Tiny-amount threshold ₹", hint: "Repeated attempts below this value resemble card testing." },
];

export function PolicyForm({ initialPolicy }: { initialPolicy: PolicySettings }) {
  const [policy, setPolicy] = useState(initialPolicy);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      setPolicy(await savePolicy(policy));
      setMessage("Policy saved. Run a new evaluation to measure its effect.");
    } catch {
      setMessage("Policy was not saved. Check the backend service and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="policyForm" onSubmit={handleSubmit}>
      <div className="policyGrid">
        {fields.map((field) => {
          const isConfidence = field.key.includes("confidence");
          const displayVal = isConfidence ? formatConfidence(policy[field.key]) : "";

          return (
            <label className="policyField" key={field.key}>
              <span>
                {field.label} {isConfidence && `(${displayVal})`}
              </span>
              <input
                type="number"
                min={0}
                max={isConfidence ? 1 : undefined}
                step={field.step ?? 1}
                value={policy[field.key]}
                onChange={(event) => setPolicy({ ...policy, [field.key]: Number(event.target.value) })}
              />
              <small>{field.hint}</small>
            </label>
          );
        })}
      </div>
      <div className="policyFooter">
        <div className="policyGuard">
          <ShieldCheck size={18} />
          <span>Every evaluation stores an immutable snapshot of these values.</span>
        </div>
        <Button type="submit" disabled={saving}>
          <Save size={15} />
          {saving ? "Saving policy" : "Save policy"}
        </Button>
      </div>
      {message && <div className="notice" role="status">{message}</div>}
    </form>
  );
}
