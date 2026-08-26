import { ArrowRight, ShieldCheck, UserRoundCheck } from "lucide-react";

import type { RecoveryStrategiesResponse, RecoveryStrategyStatus } from "@/lib/types";

const statusCopy: Record<RecoveryStrategyStatus, string> = {
  allowed: "Policy allowed",
  requires_human_review: "Human review",
  blocked: "Policy blocked",
};

export function RecoveryStrategyPanel({ data }: { data: RecoveryStrategiesResponse }) {
  return (
    <section className="recoveryStrategyPanel" aria-labelledby="recovery-strategies-title">
      <div className="recoveryStrategyHeader">
        <div>
          <span className="utilityLabel">RECOVERY STRATEGY</span>
          <h2 id="recovery-strategies-title">What can safely happen next</h2>
          <p>These are explainable next steps generated after the decision. They do not run a payment, message, or link by themselves.</p>
        </div>
        <ShieldCheck size={22} aria-hidden="true" />
      </div>

      <div className="recoveryStrategyList">
        {data.strategies.map((strategy) => (
          <article className="recoveryStrategyCard" key={strategy.id}>
            <div className="strategyCardTopline">
              <span className={`strategyStatus strategyStatus-${strategy.status}`}>{statusCopy[strategy.status]}</span>
              {strategy.status === "requires_human_review" && <UserRoundCheck size={15} aria-label="Human review required" />}
            </div>
            <h3>{strategy.title}</h3>
            <p>{strategy.description}</p>
            <div className="strategyReason"><strong>Why:</strong> {strategy.rationale}</div>
            <div className="strategyNext"><ArrowRight size={14} /><span>{strategy.next_step}</span></div>
          </article>
        ))}
      </div>
      <p className="strategyDisclaimer"><ShieldCheck size={13} /> {data.disclaimer}</p>
    </section>
  );
}
