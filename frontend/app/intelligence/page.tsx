import { Shell } from "@/components/shell";
import { RevenueIntelligenceView } from "@/components/revenue-intelligence-view";

export const metadata = {
  title: "Intelligence — Reven",
  description: "Financial impact dashboard, failure pattern analysis, and recovery pipeline.",
};

export default function IntelligencePage() {
  return (
    <Shell>
      <RevenueIntelligenceView />
    </Shell>
  );
}
