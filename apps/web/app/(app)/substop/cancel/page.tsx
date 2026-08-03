"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { CancellationOptions, CancellationRequest } from "@thrifty/shared";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ApiError } from "@/lib/api/client";
import {
  createCancellationRequest,
  getCancellationOptions,
  sendCancellationRequest,
} from "@/lib/api/cancellation";
import { confirmSubscriptionCancelled } from "@/lib/api/substop";

export default function CancelSubscriptionPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-secondary">Loading…</p>}>
      <CancelSubscriptionView />
    </Suspense>
  );
}

function CancelSubscriptionView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";

  const [options, setOptions] = useState<CancellationOptions | null>(null);
  const [draft, setDraft] = useState<CancellationRequest | null>(null);
  const [confirmNotice, setConfirmNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    getCancellationOptions(id).then(setOptions).catch(() => setOptions(null));
  }, [id]);

  async function handleDraft() {
    setError(null);
    setIsBusy(true);
    try {
      const { item } = await createCancellationRequest(id);
      setDraft(item);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't draft that email.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSend() {
    if (!draft) return;
    if (!window.confirm("Send this cancellation email now?")) return;
    setError(null);
    setIsBusy(true);
    try {
      const { item } = await sendCancellationRequest(draft.id);
      setDraft(item);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send that email.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleConfirmCancelled() {
    setError(null);
    setIsBusy(true);
    try {
      const { charge, checkoutUrl } = await confirmSubscriptionCancelled(id);
      if (checkoutUrl) {
        setConfirmNotice(
          `Nice — that's ${charge?.currency ?? ""} ${charge?.estimatedAnnualSavings.toFixed(2) ?? ""} saved annually. Redirecting to a small one-time confirmation charge…`,
        );
        window.location.href = checkoutUrl;
      } else {
        setConfirmNotice("Marked as cancelled — no charge, thanks to Premium.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't confirm that cancellation.");
    } finally {
      setIsBusy(false);
    }
  }

  if (!id) return <p className="text-sm text-danger">Missing subscription id.</p>;
  if (!options) return <p className="text-sm text-ink-secondary">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => router.push("/substop")} className="self-start text-sm font-medium text-accent">
        ← Back
      </button>

      <h1 className="text-2xl font-bold text-ink">Cancel {options.displayName}</h1>
      <p className="text-sm leading-relaxed text-ink-secondary">{options.instructions}</p>

      {options.method === "self_service_url" && options.selfServiceUrl ? (
        <Button
          onClick={() => window.open(options.selfServiceUrl!, "_blank", "noopener,noreferrer")}
          className="self-start"
        >
          Open {options.displayName}&apos;s account page
        </Button>
      ) : null}

      {options.method === "email" ? (
        <Card className="flex flex-col gap-3">
          {!draft ? (
            <Button onClick={handleDraft} disabled={isBusy} className="self-start">
              Draft cancellation email
            </Button>
          ) : (
            <>
              <div className="flex flex-col gap-1 text-sm">
                <p>
                  <span className="font-semibold text-ink">To: </span>
                  <span className="text-ink-secondary">{draft.recipientEmail}</span>
                </p>
                <p>
                  <span className="font-semibold text-ink">Subject: </span>
                  <span className="text-ink-secondary">{draft.draftSubject}</span>
                </p>
                <p className="whitespace-pre-wrap text-ink-secondary">{draft.draftBody}</p>
              </div>
              {draft.status === "sent" ? (
                <p className="text-sm font-semibold text-ink">Sent ✓</p>
              ) : (
                <Button onClick={handleSend} disabled={isBusy} className="self-start">
                  Send this email
                </Button>
              )}
            </>
          )}
        </Card>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Card className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-ink">Already cancelled this?</p>
        {confirmNotice ? (
          <p className="text-sm text-ink-secondary">{confirmNotice}</p>
        ) : (
          <Button variant="secondary" onClick={handleConfirmCancelled} disabled={isBusy} className="self-start">
            Confirm this saved me money
          </Button>
        )}
      </Card>
    </div>
  );
}
