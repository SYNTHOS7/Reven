"use client";

import { useState } from "react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";

import { createPaymentLink } from "@/lib/api";
import { Button } from "./ui/button";

export function PaymentLinkAction({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<{ short_url: string; mode: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      setLink(await createPaymentLink(eventId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment Link could not be created");
    } finally {
      setLoading(false);
    }
  }

  if (link) {
    return (
      <div className="createdLink">
        <span>{link.mode.toUpperCase()} LINK READY</span>
        <a href={link.short_url} target="_blank" rel="noreferrer">Open Payment Link <ArrowUpRight size={14} /></a>
      </div>
    );
  }

  return (
    <div className="paymentLinkControl">
      <Button onClick={handleCreate} disabled={loading}>
        {loading ? <LoaderCircle className="spin" size={15} /> : <ArrowUpRight size={15} />}
        {loading ? "Preparing link" : "Prepare test link"}
      </Button>
      {error && <small className="riskText">{error}</small>}
    </div>
  );
}
