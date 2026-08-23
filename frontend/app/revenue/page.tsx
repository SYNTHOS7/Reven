import { Shell } from "@/components/shell";
import { RevenueIntelligenceView } from "@/components/revenue-intelligence-view";

export const metadata = {
  title: "Revenue Intelligence — Reven",
  description: "Financial impact dashboard, failure pattern analysis, and recovery pipeline.",
};

export default function RevenuePage() {
  return (
    <Shell>
      <RevenueIntelligenceView />
    </Shell>
  );
}
