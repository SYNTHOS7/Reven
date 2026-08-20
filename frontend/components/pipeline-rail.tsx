import { Check, ShieldAlert } from "lucide-react";

const stages = [
  ["01", "Detection", "Revenue-at-risk event identified"],
  ["02", "Trust gate", "Attempt pattern checked"],
  ["03", "Diagnosis", "Cause resolved or escalated"],
  ["04", "Decision", "Policy-bounded action selected"],
  ["05", "Recovery", "Outcome recorded in the ledger"],
];

export function PipelineRail({ running }: { running: boolean }) {
  return (
    <section className="pipelineSection" aria-label="Recovery pipeline">
      <div className={running ? "pipelineTrack isRunning" : "pipelineTrack"} aria-hidden="true"><span /></div>
      {stages.map(([number, name, description], index) => (
        <div className="pipelineStage" key={name} style={{ "--stage-index": index } as React.CSSProperties}>
          <div className="stageTop">
            <span>{number}</span>
            {index === 1 ? <ShieldAlert size={15} /> : <Check size={14} />}
          </div>
          <strong>{name}</strong>
          <small>{description}</small>
        </div>
      ))}
    </section>
  );
}
