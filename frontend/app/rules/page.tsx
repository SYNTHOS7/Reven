import { Shell } from "@/components/shell";
import { RulesSafetyView } from "@/components/rules-safety-view";
import { loadPolicy, loadDashboard } from "@/lib/api";

export const metadata = {
  title: "Rules & Safety — Reven",
  description: "Safety bounds, human review thresholds, retry limits, and policy simulation.",
};

export default async function RulesPage() {
  const [policy, dashboardData] = await Promise.all([
    loadPolicy(),
    loadDashboard(),
  ]);

  const sampleResult = dashboardData.results[0];

  return (
    <Shell>
      <RulesSafetyView
        initialPolicy={policy}
        sampleEventId={sampleResult?.event_id || "evt_rzp_fail_card_limit_001"}
        sampleResult={sampleResult}
      />
    </Shell>
  );
}
