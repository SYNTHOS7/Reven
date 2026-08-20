"use client";

import { useState } from "react";
import { ArrowUpRight, KeyRound, LoaderCircle } from "lucide-react";

import { approvePaymentLink } from "@/lib/api";
import { Button } from "./ui/button";

export function OperatorApprovalAction({ eventId }: { eventId: string }) {
  const [token, setToken] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<{ short_url: string; mode: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const created = await approvePaymentLink(eventId, note.trim(), token);
      setLink(created);
      setToken("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Operator approval failed");
    } finally {
      setLoading(false);
    }
  }

  if (link) {
    return (
      <div className="createdLink">
        <span>HUMAN-APPROVED {link.mode.toUpperCase()} LINK</span>
        <a href={link.short_url} target="_blank" rel="noreferrer">Open Payment Link <ArrowUpRight size={14} /></a>
      </div>
    );
  }

  return (
    <form className="operatorApprovalForm" onSubmit={handleApprove}>
      <label>
        <span>Approval reason</span>
        <input value={note} onChange={(event) => setNote(event.target.value)} minLength={5} maxLength={500} placeholder="Reviewed processor evidence" required />
      </label>
      <label>
        <span>Operator token</span>
        <input value={token} onChange={(event) => setToken(event.target.value)} type="password" autoComplete="off" placeholder="Render ADMIN_TOKEN" required />
      </label>
      <Button type="submit" disabled={loading || note.trim().length < 5 || !token}>
        {loading ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />}
        {loading ? "Approving" : "Approve test link"}
      </Button>
      {error && <small className="riskText">{error}</small>}
    </form>
  );
}
