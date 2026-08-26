import { Dashboard } from "@/components/dashboard";
import { Shell } from "@/components/shell";
import { disconnectedData } from "@/lib/empty-data";

export default function Home() {
  return <Shell><Dashboard initialData={disconnectedData} /></Shell>;
}
