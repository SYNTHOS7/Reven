"use client";

import { useState } from "react";
import { Activity, DatabaseZap, ShieldCheck } from "lucide-react";

import { loadProviderPaymentContext } from "@/lib/api";
import type { PipelineResult, ProviderPaymentContextResponse } from "@/lib/types";

export function RecoveryDecisionHarness({ eventId, result }: { eventId: string; result: PipelineResult }) {
  const [context, setContext] = useState<ProviderPaymentContextResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadContext() {
    setLoading(true);
    setError(null);
    try {
      setContext(await loadProviderPaymentContext(eventId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Razorpay provider context is unavailable");
    } finally {
      setLoading(false);
    }
  }

  const outcome = result.verified_recovered_amount > 0
    ? `Verified ₹${result.verified_recovered_amount.toLocaleString("en-IN")}`
    : result.razorpay_payment_link_id ? "Link awaiting paid webhook" : "No money action executed";

  return (
    <section className="decisionHarness" aria-labelledby="decision-harness-title">
      <div className="decisionHarnessHeader">
        <div>
          <span className="utilityLabel">RECOVERY DECISION HARNESS</span>
          <h2 id="decision-harness-title">From provider evidence to one bounded next step</h2>
          <p>Reven combines a signed failure event, live provider context, Trust Gate, advisory AI, policy, and outcome proof. Each layer answers a different question.</p>
        </div>
        <button type="button" className="button buttonSecondary buttonSmall" disabled={loading} onClick={loadContext}>
          <DatabaseZap size={14} /> {loading ? "Reading Razorpay…" : "Load Razorpay context"}
        </button>
      </div>

      <div className="harnessRail" aria-label="Recovery decision layers">
        <article><span>01 · PROVIDER</span><strong>Failure event received</strong><small>{result.failure_code.replaceAll("_", " ")}</small></article>
        <article><span>02 · SAFETY</span><strong>{result.trust_gate.status === "suspicious" ? "Recovery stopped" : "Trust Gate cleared"}</strong><small>{result.trust_gate.reason}</small></article>
        <article><span>03 · POLICY</span><strong>{result.decision.action.replaceAll("_", " ")}</strong><small>{result.decision.reason}</small></article>
        <article><span>04 · PROOF</span><strong>{outcome}</strong><small>Only Razorpay confirmation can verify recovery</small></article>
      </div>

      {context && (
        <div className="providerContextGrid">
          <div><span>Razorpay payment</span><strong>{context.payment_id}</strong></div>
          <div><span>Order correlation</span><strong>{context.order_id ?? "No order ID on this payment"}</strong></div>
          <div><span>Provider status</span><strong>{context.status ?? "Unknown"} · {context.method ?? "Unknown method"}</strong></div>
          <div><span>Processor signal</span><strong>{context.error_reason ?? "—"}{context.error_code ? ` · ${context.error_code}` : ""}</strong></div>
          <p>{context.error_description ?? "No additional processor description was returned."}</p>
          <footer><ShieldCheck size={14} /> {context.disclaimer}</footer>
        </div>
      )}
      {error && <p className="harnessError"><Activity size={14} /> {error}</p>}
    </section>
  );
}
