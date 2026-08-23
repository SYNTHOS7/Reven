import { Shell } from "@/components/shell";
import { TransactionDataView } from "@/components/transaction-data-view";

export const metadata = {
  title: "Data — Reven",
  description: "CSV upload and demo data ingestion for revenue recovery intelligence.",
};

export default function DataPage() {
  return (
    <Shell>
      <TransactionDataView />
    </Shell>
  );
}
