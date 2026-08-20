import { PolicyForm } from "@/components/policy-form";
import { Shell } from "@/components/shell";
import { loadPolicy } from "@/lib/api";

export default async function SettingsPage() {
  const policy = await loadPolicy();
  return (
    <Shell>
      <main className="innerPage">
        <div className="pageIntro">
          <span className="eyebrow"><span>POLICY</span> HARD LIMITS</span>
          <h1>The agent cannot<br /><em>negotiate these.</em></h1>
          <p>These controls run after diagnosis and before any recovery action. Ambition stops where policy begins.</p>
        </div>
        <PolicyForm initialPolicy={policy} />
      </main>
    </Shell>
  );
}
