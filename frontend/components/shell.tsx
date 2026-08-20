import Link from "next/link";
import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="siteShell">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Reven dashboard">
          <span className="brandMark">R</span>
          <span>REVEN</span>
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="/">Overview</Link>
          <Link href="/#events">Cases</Link>
          <Link href="/settings">Policy</Link>
        </nav>
        <div className="systemState"><span className="liveDot" /> TEST MODE</div>
      </header>
      {children}
      <footer className="footer">
        <span>REVEN / RECOVERY CONTROL</span>
        <span>RAZORPAY TEST MODE ONLY</span>
      </footer>
    </div>
  );
}
