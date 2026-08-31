"use client";

import { useState } from "react";
import { BrainCircuit, ShieldCheck } from "lucide-react";

import { runAdvisoryInvestigation } from "@/lib/api";
import type { AdvisoryInvestigationResponse } from "@/lib/types";
import { formatConfidence } from "@/lib/confidence";

export function AdvisoryAiInvestigation({ eventId }: { eventId: string }) {
  const [result, setResult] = useState<AdvisoryInvestigationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function investigate() {
    setRunning(true);
    setError(null);
    try {
      setResult(await runAdvisoryInvestigation(eventId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI investigation could not run");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="advisoryInvestigation" aria-labelledby="advisory-investigation-title">
      <div className="advisoryInvestigationHeader">
        <div>
          <span className="utilityLabel">READ-ONLY AI INVESTIGATION</span>
          <h2 id="advisory-investigation-title">Ask AI to examine the same evidence</h2>
          <p>This is a separate advisory trace. It cannot replace the stored rule diagnosis or trigger a financial action.</p>
        </div>
        <button type="button" className="button buttonPrimary buttonSmall" disabled={running} onClick={investigate}>
          <BrainCircuit size={14} /> {running ? "Investigating…" : "Run AI investigation"}
        </button>
      </div>

      {error && <p className="advisoryError" role="status">{error}</p>}

      {result && (
        <div className="advisoryResult">
          <div><span>AI diagnosis</span><strong>{result.diagnosis.cause.replaceAll("_", " ")}</strong></div>
          <div><span>Confidence</span><strong>{formatConfidence(result.diagnosis.confidence)}</strong></div>
          <div><span>Evidence tools used</span><strong>{result.diagnosis.tool_calls.join(" · ") || "No tool trace returned"}</strong></div>
          <p>{result.diagnosis.reason}</p>
          <footer><ShieldCheck size={14} /> {result.disclaimer}</footer>
        </div>
      )}
    </section>
  );
}
