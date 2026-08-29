import { Shell } from "@/components/shell";
import { EvidenceView } from "@/components/evidence-view";
import { LearningHealth } from "@/components/learning-health";
import { loadBatchDiagnosisReview, loadBatchSummary, loadDashboard, loadLearningHealth, loadVerifiedRecoverySummary } from "@/lib/api";

const BUILDATHON_BATCH_ID = "buildathon-01";

export const metadata = {
  title: "Evidence & Proof — Reven",
  description: "Live Razorpay Test Mode cases, five-stage pipeline breakdown, and verified recovery receipts.",
};

export default async function EvidencePage() {
  const [data, learningHealth, recoverySummary, batchSummary, diagnosisReview] = await Promise.all([
    loadDashboard(),
    loadLearningHealth(),
    loadVerifiedRecoverySummary(),
    loadBatchSummary(BUILDATHON_BATCH_ID),
    loadBatchDiagnosisReview(BUILDATHON_BATCH_ID),
  ]);
  return (
    <Shell>
      <EvidenceView
        initialData={data}
        initialRecoverySummary={recoverySummary}
        batchId={BUILDATHON_BATCH_ID}
        initialBatchSummary={batchSummary}
        initialDiagnosisReview={diagnosisReview}
      />
      {learningHealth && <div className="innerPage evidenceLearningWrap"><LearningHealth data={learningHealth} /></div>}
    </Shell>
  );
}
