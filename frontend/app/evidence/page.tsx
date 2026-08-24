import { Shell } from "@/components/shell";
import { EvidenceView } from "@/components/evidence-view";
import { loadDashboard } from "@/lib/api";

export const metadata = {
  title: "Evidence & Proof — Reven",
  description: "Live Razorpay Test Mode cases, five-stage pipeline breakdown, and verified recovery receipts.",
};

export default async function EvidencePage() {
  const data = await loadDashboard();
  return (
    <Shell>
      <EvidenceView initialData={data} />
    </Shell>
  );
}
