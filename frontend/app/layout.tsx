import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reven — Revenue Recovery Control",
  description: "Policy-bounded AI revenue recovery for Razorpay's AI Buildathon.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
