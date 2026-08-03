"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ApiError } from "@/lib/api/client";
import { createLinkSession, pollLinkStatus, syncBankAccounts } from "@/lib/api/substop";

const POLL_ATTEMPTS = 6;
const POLL_DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function AaConsentPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "waiting" | "timedOut">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    setError(null);
    setStatus("waiting");
    try {
      const { linkToken, hostedLinkUrl } = await createLinkSession();
      window.open(hostedLinkUrl, "_blank", "noopener,noreferrer");

      for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
        await sleep(POLL_DELAY_MS);
        const { linked } = await pollLinkStatus(linkToken);
        if (linked) {
          await syncBankAccounts().catch(() => {});
          router.push("/substop");
          return;
        }
      }
      setStatus("timedOut");
    } catch (err) {
      setStatus("idle");
      if (err instanceof ApiError && err.status === 503) {
        setError("Bank linking isn't available yet — this feature is still being set up.");
      } else {
        setError(err instanceof ApiError ? err.message : "Couldn't start the consent flow.");
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => router.push("/substop")} className="self-start text-sm font-medium text-accent">
        ← Back
      </button>

      <h1 className="text-2xl font-bold text-ink">Link a bank or card</h1>
      <p className="text-sm leading-relaxed text-ink-secondary">
        Thrifty reads your recent transactions through India&apos;s RBI-regulated Account
        Aggregator framework — a consent-based, bank-approved way to share data, not a
        username/password login.
      </p>

      <Card className="flex flex-col gap-2 text-sm text-ink-secondary">
        <p>
          <span className="font-semibold text-ink">What&apos;s shared: </span>
          Transaction history from the account(s) you choose.
        </p>
        <p>
          <span className="font-semibold text-ink">Purpose: </span>
          Detecting recurring subscriptions and monthly spend.
        </p>
        <p>
          <span className="font-semibold text-ink">Duration: </span>
          Up to 365 days, renewable.
        </p>
        <p>
          <span className="font-semibold text-ink">Frequency: </span>
          Synced on request or on a schedule.
        </p>
        <p>You can revoke this consent at any time through your Account Aggregator app.</p>
      </Card>

      {status === "timedOut" ? (
        <p className="text-sm text-ink-secondary">
          Still processing — this can take a minute. Check back on the SubStop tab shortly.
        </p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Button onClick={handleContinue} disabled={status === "waiting"} className="self-start">
        {status === "waiting" ? "Waiting for consent…" : "Continue to consent"}
      </Button>
    </div>
  );
}
