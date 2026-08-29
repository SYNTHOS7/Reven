import { Shell } from "@/components/shell";
import { RevenueIntelligenceView } from "@/components/revenue-intelligence-view";
import { loadBatchSummary } from "@/lib/api";

export const metadata = {
  title: "Analyse — Reven",
  description: "Where revenue is being lost: financial impact, failure patterns, and recovery opportunities.",
};

export default async function AnalysePage() {
  const batchSummary = await loadBatchSummary("buildathon-01");
  return (
    <Shell>
      <RevenueIntelligenceView batchSummary={batchSummary} />
    </Shell>
  );
}
