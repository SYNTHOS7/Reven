import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { TransactionProvider } from "@/lib/transaction-context";
import "./globals.css";

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reven — Revenue Recovery Control",
  description: "Policy-bounded AI revenue recovery and intelligence engine.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-text-primary antialiased min-h-screen">
        <TransactionProvider><div className={`${hankenGrotesk.variable} ${jetbrainsMono.variable}`}>{children}</div></TransactionProvider>
      </body>
    </html>
  );
}
