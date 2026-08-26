import { BrainCircuit, ShieldCheck } from "lucide-react";

import type { LearningHealthResponse } from "@/lib/types";

function percentage(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

export function LearningHealth({ data }: { data: LearningHealthResponse }) {
  return (
    <section className="learningHealth" aria-labelledby="learning-health-title">
      <div className="learningHealthHeader">
        <div><span className="utilityLabel">LEARNING EVIDENCE</span><h2 id="learning-health-title">What the system has actually learned from</h2><p>{data.learning_status}. This separates reviewed Test Mode evidence from unreviewed cases and simulated merchant data.</p></div>
        <BrainCircuit size={22} aria-hidden="true" />
      </div>
      <div className="learningHealthStats">
        <div><strong>{data.test_mode_cases}</strong><span>Test Mode cases</span></div>
        <div><strong>{data.human_labelled_cases}</strong><span>human labels</span></div>
        <div><strong>{percentage(data.label_coverage_pct)}</strong><span>label coverage</span></div>
        <div><strong>{percentage(data.action_agreement_pct)}</strong><span>action agreement</span></div>
      </div>
      <div className="learningHealthGoal"><ShieldCheck size={15} /><div><strong>Next evidence goal</strong><span>{data.next_evidence_goal}</span></div></div>
      <p className="learningHealthDisclaimer">{data.disclaimer}</p>
    </section>
  );
}
