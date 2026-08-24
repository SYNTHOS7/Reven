import Link from "next/link";
import { History, ShieldCheck } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import type { SimilarCases } from "@/lib/types";

export function SimilarCases({ data }: { data: SimilarCases }) {
  const hasCases = data.cases.length > 0;
  const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

  return (
    <section className="similarCases" aria-labelledby="similar-cases-title">
      <div className="similarCasesHeader">
        <div>
          <span className="utilityLabel">SUPPORTING EVIDENCE</span>
          <h2 id="similar-cases-title"><History size={18} /> Similar past cases</h2>
          <p>{data.scope}. These comparisons help an operator understand context; they do not change this case’s decision.</p>
        </div>
        {hasCases && (
          <div className="similarCasesSummary">
            <strong>{data.comparable_case_count}</strong><span>comparable</span>
            <small>{data.verified_recovery_count} verified recovery{data.verified_recovery_count === 1 ? "" : "ies"}</small>
          </div>
        )}
      </div>

      {hasCases ? (
        <div className="similarCasesList">
          {data.cases.map((item) => (
            <article className="similarCaseRow" key={item.event_id}>
              <div>
                <span className="similarCaseCode">{item.failure_code.replaceAll("_", " ")}</span>
                <p>{item.match_reasons.join(" · ")}</p>
              </div>
              <div className="similarCaseOutcome">
                <StatusBadge value={item.decision_action} />
                <span>{item.verified_recovered_amount > 0 ? `${amount.format(item.verified_recovered_amount)} verified` : "No verified recovery"}</span>
              </div>
              <Link href={`/case/${item.event_id}`} className="button buttonSecondary buttonSmall">Inspect</Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="similarCasesEmpty">
          <History size={18} /> No comparable prior {data.scope.toLowerCase()} cases yet. Reven will not invent historical evidence.
        </div>
      )}
      <div className="similarCasesDisclaimer"><ShieldCheck size={14} /> {data.disclaimer}</div>
    </section>
  );
}
