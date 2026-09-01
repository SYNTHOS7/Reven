import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { TransactionProvider } from "@/lib/transaction-context";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
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
        <TransactionProvider><div className={`${dmSans.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>{children}</div></TransactionProvider>
      </body>
    </html>
  );
}
