import { Dashboard } from "@/components/dashboard";
import { Shell } from "@/components/shell";
import { loadDashboard } from "@/lib/api";

export default async function Home() {
  const data = await loadDashboard();
  return <Shell><Dashboard initialData={data} /></Shell>;
}
