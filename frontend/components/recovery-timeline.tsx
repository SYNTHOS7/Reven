import { CalendarClock, Check, CircleAlert, Clock3, ShieldCheck } from "lucide-react";

import type { RecoveryTimelineResponse, RecoveryTimelineStatus } from "@/lib/types";

const statusLabel: Record<RecoveryTimelineStatus, string> = {
  completed: "Recorded",
  ready_for_operator: "Operator step",
  waiting: "Cooling off",
  blocked: "Blocked",
};

function TimelineIcon({ status }: { status: RecoveryTimelineStatus }) {
  if (status === "completed") return <Check size={14} />;
  if (status === "blocked") return <CircleAlert size={14} />;
  if (status === "waiting") return <Clock3 size={14} />;
  return <CalendarClock size={14} />;
}

export function RecoveryTimeline({ data }: { data: RecoveryTimelineResponse }) {
  const eligibleAt = data.next_eligible_at
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.next_eligible_at))
    : null;

  return (
    <section className="recoveryTimeline" aria-labelledby="recovery-timeline-title">
      <div className="recoveryTimelineHeader">
        <div>
          <span className="utilityLabel">RECOVERY TIMELINE</span>
          <h2 id="recovery-timeline-title">The state of this recovery</h2>
          <p>A short lifecycle view: completed evidence, the next allowed step, and any cooling-off window.</p>
        </div>
        <CalendarClock size={22} aria-hidden="true" />
      </div>

      <ol className="recoveryTimelineTrack">
        {data.items.map((item, index) => (
          <li className={`timelineItem timeline-${item.status}`} key={`${item.stage}-${index}`}>
            <span className="timelineMarker"><TimelineIcon status={item.status} /></span>
            <div>
              <div className="timelineTopline"><strong>{item.title}</strong><span>{statusLabel[item.status]}</span></div>
              <p>{item.detail}</p>
              {item.occurred_at && <small>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.occurred_at))}</small>}
            </div>
          </li>
        ))}
      </ol>

      {eligibleAt && (
        <div className="timelineEligibility">
          <Clock3 size={16} />
          <div><strong>Earliest eligible retry window: {eligibleAt}</strong><span>{data.next_eligibility_note}</span></div>
        </div>
      )}
      <p className="timelineDisclaimer"><ShieldCheck size={13} /> {data.disclaimer}</p>
    </section>
  );
}
