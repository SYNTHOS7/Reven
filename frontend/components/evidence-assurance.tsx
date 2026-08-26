import { CheckCircle2, FileKey2, ShieldAlert, ShieldCheck } from "lucide-react";

import type { EvidenceQualityResponse, EvidenceReceiptResponse } from "@/lib/types";

const qualityLabel = {
  ready: "Evidence ready",
  needs_review: "Review evidence",
  insufficient_evidence: "Evidence incomplete",
};

export function EvidenceAssurance({ quality, receipt }: { quality: EvidenceQualityResponse; receipt: EvidenceReceiptResponse | null }) {
  return (
    <section className="evidenceAssurance" aria-labelledby="evidence-assurance-title">
      <div className="evidenceAssuranceHeader">
        <div>
          <span className="utilityLabel">EVIDENCE ASSURANCE</span>
          <h2 id="evidence-assurance-title">Is this case ready for a decision?</h2>
          <p>Reven shows the evidence that exists, the context still missing, and a fingerprint for comparing the stored record later.</p>
        </div>
        <span className={`evidenceQualityPill evidenceQuality-${quality.status}`}>{qualityLabel[quality.status]} · {quality.score}/100</span>
      </div>
      <div className="evidenceAssuranceGrid">
        <article>
          <span><CheckCircle2 size={14} /> CAPTURED SIGNALS</span>
          <ul>{quality.captured_signals.map((signal) => <li key={signal}>{signal}</li>)}</ul>
        </article>
        <article>
          <span><ShieldAlert size={14} /> MISSING CONTEXT</span>
          {quality.missing_signals.length ? <ul>{quality.missing_signals.map((signal) => <li key={signal}>{signal}</li>)}</ul> : <p>Nothing material is missing from the configured evidence checklist.</p>}
        </article>
      </div>
      <div className="evidenceAssessment"><ShieldCheck size={15} /><div><strong>{quality.assessment}</strong><span>{quality.recommended_boundary}</span></div></div>
      {receipt && <div className="evidenceReceipt"><FileKey2 size={15} /><div><span>CASE RECORD FINGERPRINT</span><code>{receipt.fingerprint_sha256}</code><small>{receipt.scope}</small></div></div>}
      <p className="evidenceAssuranceDisclaimer"><ShieldCheck size={13} /> {quality.disclaimer}</p>
    </section>
  );
}
