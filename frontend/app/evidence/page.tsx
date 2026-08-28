import { Shell } from "@/components/shell";
import { EvidenceView } from "@/components/evidence-view";
import { LearningHealth } from "@/components/learning-health";
import { loadDashboard, loadLearningHealth, loadVerifiedRecoverySummary } from "@/lib/api";

export const metadata = {
  title: "Evidence & Proof — Reven",
  description: "Live Razorpay Test Mode cases, five-stage pipeline breakdown, and verified recovery receipts.",
};

export default async function EvidencePage() {
  const [data, learningHealth, recoverySummary] = await Promise.all([
    loadDashboard(),
    loadLearningHealth(),
    loadVerifiedRecoverySummary(),
  ]);
  return (
    <Shell>
      <EvidenceView initialData={data} initialRecoverySummary={recoverySummary} />
      {learningHealth && <div className="innerPage evidenceLearningWrap"><LearningHealth data={learningHealth} /></div>}
    </Shell>
  );
}
