import Link from "next/link";
import { ArrowRight, CheckCircle2, GitBranch, ShieldCheck, Sparkles } from "lucide-react";

const stages = [
  ["01", "Detect", "Receives a failed Razorpay payment event."],
  ["02", "Trust Gate", "Stops risky, repeated, or excessive recovery attempts."],
  ["03", "Diagnose", "Uses payment evidence and AI to understand the likely cause."],
  ["04", "Decide", "Applies rules, confidence thresholds, and human review."],
  ["05", "Verify", "Counts recovery only after Razorpay confirms payment."],
];

export function LandingPage() {
  return (
    <main className="landingPage">
      <header className="landingNav">
        <Link className="landingBrand" href="/" aria-label="Reven home">REVEN</Link>
        <nav aria-label="Landing navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#proof">Evidence</a>
          <a href="#difference">Why Reven</a>
        </nav>
        <Link className="landingNavCta" href="/home">Open dashboard <ArrowRight size={14} /></Link>
      </header>

      <section className="landingHero">
        <div className="landingHeroCopy">
          <p className="landingEyebrow"><span /> AI REVENUE RECOVERY</p>
          <h1>Failed payments deserve a <em>better next step.</em></h1>
          <p className="landingLead">Reven helps merchants understand why a payment failed, select a safe recovery action, and verify exactly what comes back.</p>
          <div className="landingActions">
            <Link className="landingPrimary" href="/home">Explore Reven <ArrowRight size={16} /></Link>
            <a className="landingSecondary" href="#how-it-works">See the architecture</a>
          </div>
          <div className="landingProofRow">
            <span><CheckCircle2 size={14} /> Evidence-led</span>
            <span><ShieldCheck size={14} /> Human-guarded</span>
            <span><Sparkles size={14} /> AI-assisted</span>
          </div>
        </div>

        <div className="landingCasePanel" aria-label="Example recovery decision">
          <div className="landingPanelHeader"><span>LIVE TEST EVIDENCE</span><i>Razorpay Test Mode</i></div>
          <div className="caseFact"><small>FAILED PAYMENT</small><strong>₹324.00</strong><span>Card · payment.failed received</span></div>
          <div className="caseLine"><b>1</b><div><strong>Trust Gate clear</strong><span>No suspicious retry pattern detected</span></div></div>
          <div className="caseLine"><b>2</b><div><strong>Evidence assessed</strong><span>Unsupported-card signal, low confidence</span></div></div>
          <div className="caseLine amber"><b>3</b><div><strong>Human review required</strong><span>Reven does not automate uncertain recovery</span></div></div>
          <div className="caseVerified"><CheckCircle2 size={16} /><div><small>SEPARATE VERIFIED TEST RECOVERY</small><strong>₹100 confirmed by paid webhook</strong></div></div>
        </div>
      </section>

      <section id="how-it-works" className="landingArchitecture">
        <div className="landingSectionIntro">
          <p className="landingEyebrow">THE ARCHITECTURE</p>
          <h2>AI diagnoses. Rules decide. Razorpay proves.</h2>
          <p>Reven does not blindly retry every failure. Each payment moves through a visible decision tree before any recovery action is allowed.</p>
        </div>
        <div className="architectureTree">
          <div className="treeSource"><GitBranch size={16} /><span>Razorpay <small>payment.failed</small></span></div>
          <div className="treeStem" />
          <div className="treeStages">
            {stages.map(([number, title, detail]) => (
              <article className="treeStage" key={title}>
                <span>{number}</span><h3>{title}</h3><p>{detail}</p>
              </article>
            ))}
          </div>
          <div className="treeOutcome"><CheckCircle2 size={17} /><div><small>OUTCOME</small><strong>Verified recovery only after <code>payment_link.paid</code></strong></div></div>
        </div>
      </section>

      <section id="proof" className="landingSplit">
        <article>
          <p className="landingEyebrow">REAL INTEGRATION</p>
          <h2>Live Test Mode proves the closed loop.</h2>
          <p>Signed Razorpay Test Mode webhooks enter Reven, policy decisions are recorded, and recovery is verified only after the provider confirms payment.</p>
          <Link href="/evidence">View live evidence <ArrowRight size={14} /></Link>
        </article>
        <article>
          <p className="landingEyebrow">SCALE SCENARIO</p>
          <h2>Demo data shows the merchant-scale opportunity.</h2>
          <p>A clearly labelled 500-transaction scenario helps merchants find leakage patterns and prioritise recovery—without contacting a real customer.</p>
          <Link href="/analyse">Analyse recovery opportunities <ArrowRight size={14} /></Link>
        </article>
      </section>

      <section id="difference" className="landingDifference">
        <p className="landingEyebrow">WHY REVEN</p>
        <h2>Recovery with proof, not blind automation.</h2>
        <div>
          <article><span>01</span><h3>Evidence before action</h3><p>Every recommendation starts with payment context, not a generic reminder.</p></article>
          <article><span>02</span><h3>Policy bounds AI</h3><p>Confidence, retry, amount, and contact limits are enforced by rules.</p></article>
          <article><span>03</span><h3>Humans handle uncertainty</h3><p>High-value and low-confidence cases pause for review.</p></article>
          <article><span>04</span><h3>Recovery is verified</h3><p>A link is not revenue. A paid Razorpay webhook is proof.</p></article>
        </div>
      </section>

      <section className="landingClose">
        <p className="landingEyebrow">RECOVERY, UNDER CONTROL</p>
        <h2>Find the leak. Recover it responsibly.</h2>
        <Link className="landingPrimary" href="/home">Open recovery dashboard <ArrowRight size={16} /></Link>
      </section>

      <footer className="landingFooter"><strong>REVEN</strong><span>Razorpay Test Mode evidence · Demo scenario is clearly simulated</span><a href="https://github.com/SYNTHOS7/Reven" target="_blank" rel="noreferrer">GitHub</a></footer>
    </main>
  );
}
