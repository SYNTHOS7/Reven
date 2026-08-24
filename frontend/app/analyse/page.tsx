import { Shell } from "@/components/shell";
import { RevenueIntelligenceView } from "@/components/revenue-intelligence-view";

export const metadata = {
  title: "Analyse — Reven",
  description: "Where revenue is being lost: financial impact, failure patterns, and recovery opportunities.",
};

export default function AnalysePage() {
  return (
    <Shell>
      <RevenueIntelligenceView />
    </Shell>
  );
}
