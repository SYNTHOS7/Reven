import { Shell } from "@/components/shell";
import { RecoveryQueueView } from "@/components/recovery-queue-view";

export const metadata = {
  title: "Recovery Queue — Reven",
  description: "Deterministic recovery queue and simulated action workspace.",
};

export default function QueuePage() {
  return (
    <Shell>
      <RecoveryQueueView />
    </Shell>
  );
}
