import type { Metadata } from "next";
import { TransactionProvider } from "@/lib/transaction-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reven — Revenue Recovery Control",
  description: "Policy-bounded AI revenue recovery and intelligence engine.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <TransactionProvider>{children}</TransactionProvider>
      </body>
    </html>
  );
}
