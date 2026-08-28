import Link from "next/link";
import { Activity, ArrowRight, BrainCircuit, CheckCircle2, FileKey2, GitBranch, ListChecks, ShieldCheck, Sparkles } from "lucide-react";
import { loadVerifiedRecoverySummary } from "@/lib/api";

const stages = [
  ["01", "Detect", "Receives a failed Razorpay payment event."],
  ["02", "Trust Gate", "Stops risky, repeated, or excessive recovery attempts."],
  ["03", "Diagnose", "Uses payment evidence and AI to understand the likely cause."],
  ["04", "Decide", "Applies rules, confidence thresholds, and human review."],
  ["05", "Verify", "Counts recovery only after Razorpay confirms payment."],
];

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export async function LandingPage() {
  const recovery = await loadVerifiedRecoverySummary();
  return (
    <main className="landingPage">
      <header className="landingNav">
        <Link className="landingBrand" href="/" aria-label="Reven home"><svg className="revenLogo" viewBox="0 0 28 28" aria-hidden="true"><path d="M4 4h10.5a5 5 0 0 1 0 10H9l12 10H14L4 15V4Zm5 5v3h5.5a1.5 1.5 0 0 0 0-3H9Z" /></svg>REVEN</Link>
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
          <div className="caseReceipt"><FileKey2 size={14} /><span>Redacted decision receipt <code>SHA-256</code></span></div>
          <div className="caseVerified"><CheckCircle2 size={16} /><div><small>VERIFIED TEST MODE RECOVERY</small><strong>{recovery ? `${money.format(recovery.verified_recovery_amount)} across ${recovery.verified_recovery_count} verified ${recovery.verified_recovery_count === 1 ? "recovery" : "recoveries"}` : "Live evidence temporarily unavailable"}</strong></div></div>
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

      <section className="landingControlLayer" aria-labelledby="control-layer-title">
        <div className="landingSectionIntro">
          <p className="landingEyebrow">FOUR BOUNDED AI LAYERS</p>
          <h2 id="control-layer-title">Each AI layer has one restricted job.</h2>
          <p>They investigate, recommend, evaluate, and summarise. Deterministic policy and a human operator remain the only path to a recovery action.</p>
        </div>
        <div className="controlLayerGrid">
          <Link href="/case/rzp_pay_TSx3NFbrKdjDCr" className="agentLayerCard"><BrainCircuit size={18} /><small>AGENT 01</small><span>AI Investigation</span><p>Gemini may inspect bounded, read-only processor, retry, and labelled-case context to explain a failure.</p><b>Inspect a live case <ArrowRight size={13} /></b></Link>
          <Link href="/case/rzp_pay_TSx3NFbrKdjDCr" className="agentLayerCard"><ShieldCheck size={18} /><small>AGENT 02</small><span>Recovery Strategy</span><p>Produces safe options such as retry later, method switch, or review—then policy filters every one.</p><b>See safe strategies <ArrowRight size={13} /></b></Link>
          <Link href="/evidence" className="agentLayerCard"><ListChecks size={18} /><small>AGENT 03</small><span>Learning &amp; Evaluation</span><p>Measures reviewed Test Mode labels, agreement, and playbook outcomes without learning from guesses.</p><b>View learning health <ArrowRight size={13} /></b></Link>
          <Link href="/analyse" className="agentLayerCard"><Activity size={18} /><small>AGENT 04</small><span>Merchant Intelligence</span><p>Turns aggregate, labelled metrics into one concise merchant briefing with supporting evidence.</p><b>Read the briefing <ArrowRight size={13} /></b></Link>
        </div>
        <div className="controlLayerFootnote"><FileKey2 size={15} /> Every layer is read-only or policy-bounded. None can contact a customer, change policy, or create a Payment Link. Recovery still needs Razorpay confirmation.</div>
      </section>

      <section id="difference" className="landingDifference">
        <p className="landingEyebrow">WHY REVEN</p>
        <h2>Recovery with proof, not blind automation.</h2>
        <div>
          <article><span>01</span><h3>Evidence before action</h3><p>Every recommendation starts with payment context, evidence quality, and a visible audit trail.</p></article>
          <article><span>02</span><h3>Policy bounds AI</h3><p>Confidence, retry, amount, contact, and Trust Gate limits are deterministic controls.</p></article>
          <article><span>03</span><h3>Humans handle uncertainty</h3><p>High-value, low-confidence, and suspicious cases pause or stop instead of being automated.</p></article>
          <article><span>04</span><h3>Recovery is verified</h3><p>A link is not revenue. A signed paid Razorpay webhook is proof.</p></article>
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
