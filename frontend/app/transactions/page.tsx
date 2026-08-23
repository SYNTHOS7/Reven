import { Shell } from "@/components/shell";
import { TransactionDataView } from "@/components/transaction-data-view";

export const metadata = {
  title: "Transaction Data — Reven",
  description: "CSV upload and demo data ingestion for revenue recovery intelligence.",
};

export default function TransactionsPage() {
  return (
    <Shell>
      <TransactionDataView />
    </Shell>
  );
}
