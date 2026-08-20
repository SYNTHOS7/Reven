"use client";

import { useState } from "react";
import { Check, LoaderCircle } from "lucide-react";

import { reconcilePaymentLink } from "@/lib/api";
import { Button } from "./ui/button";

export function RecoveryVerificationAction({ eventId }: { eventId: string }) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const recovery = await reconcilePaymentLink(eventId, token);
      setAmount(recovery.amount_recovered);
      setToken("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Recovery verification failed");
    } finally {
      setLoading(false);
    }
  }

  if (amount !== null) {
    return <div className="verifiedRecovery"><Check size={16} /><span>₹{amount.toLocaleString("en-IN")} verified recovered</span></div>;
  }

  return (
    <form className="verificationForm" onSubmit={handleVerify}>
      <label>
        <span>Operator token</span>
        <input value={token} onChange={(event) => setToken(event.target.value)} type="password" autoComplete="off" placeholder="Render ADMIN_TOKEN" required />
      </label>
      <Button type="submit" disabled={loading || !token}>
        {loading ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}
        {loading ? "Checking Razorpay" : "Verify paid status"}
      </Button>
      {error && <small className="riskText">{error}</small>}
    </form>
  );
}
