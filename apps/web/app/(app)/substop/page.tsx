"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { DetectedSubscription, LinkedBankAccount } from "@thrifty/shared";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ApiError } from "@/lib/api/client";
import {
  confirmSubscriptionInUse,
  listLinkedAccounts,
  listSubscriptions,
  syncBankAccounts,
} from "@/lib/api/substop";

export default function SubStopPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<LinkedBankAccount[] | null>(null);
  const [subs, setSubs] = useState<DetectedSubscription[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [currency, setCurrency] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    listLinkedAccounts()
      .then(({ accounts: fetched }) => setAccounts(fetched))
      .catch(() => setAccounts([]));
    listSubscriptions()
      .then((result) => {
        setSubs(result.items);
        setMonthlyTotal(result.monthlyTotal);
        setCurrency(result.currency);
      })
      .catch(() => {});
  }

  useEffect(load, []);

  async function handleRefresh() {
    setError(null);
    setIsSyncing(true);
    try {
      await syncBankAccounts();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't sync your linked accounts.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleInUse(id: string, inUse: boolean) {
    setOpenMenuId(null);
    try {
      const { item } = await confirmSubscriptionInUse(id, { inUse });
      setSubs((prev) => prev.map((s) => (s.id === id ? item : s)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update that subscription.");
    }
  }

  if (accounts === null) return <p className="text-sm text-ink-secondary">Loading…</p>;

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-ink">SubStop</h1>
        <EmptyState
          title="Find your subscription leakage"
          description="Link a bank or card and Thrifty will surface the recurring charges you might have forgotten about."
          action={<Button onClick={() => router.push("/substop/aa-consent")}>Link a bank or card</Button>}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">SubStop</h1>
        <Button variant="secondary" onClick={handleRefresh} disabled={isSyncing}>
          {isSyncing ? "Syncing…" : "Sync now"}
        </Button>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Card className="border-none bg-primary text-ink-inverse">
        <p className="text-xs opacity-65">Monthly subscription spend</p>
        <p className="text-3xl font-bold">
          {currency ?? ""} {monthlyTotal.toFixed(2)}
        </p>
        <p className="mt-1 text-xs opacity-55">
          {subs.length} subscription{subs.length === 1 ? "" : "s"}
        </p>
      </Card>

      {subs.length === 0 ? (
        <EmptyState title="No subscriptions detected yet" description="Try syncing again after a few days." />
      ) : (
        <div className="flex flex-col gap-2">
          {subs.map((sub) => (
            <Card key={sub.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{sub.displayName}</p>
                  <p className="text-xs text-ink-secondary">
                    {sub.detectedFromBank && sub.detectedFromEmail
                      ? "via bank + email"
                      : sub.detectedFromBank
                        ? "via bank"
                        : "via email"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {sub.userConfirmedInUse === false ? <Badge tone="urgent">Not using it</Badge> : null}
                  <span className="text-sm font-semibold text-ink">
                    {sub.currency} {sub.avgAmount.toFixed(2)}/{sub.cadence}
                  </span>
                </div>
              </div>

              <button
                className="self-start text-xs font-medium text-accent"
                onClick={() => setOpenMenuId(openMenuId === sub.id ? null : sub.id)}
              >
                Manage
              </button>

              {openMenuId === sub.id ? (
                <div className="flex flex-wrap gap-2 border-t border-border pt-2">
                  <Button variant="secondary" onClick={() => handleInUse(sub.id, true)}>
                    Still using it
                  </Button>
                  <Button variant="secondary" onClick={() => handleInUse(sub.id, false)}>
                    Not using it
                  </Button>
                  <Button variant="secondary" onClick={() => router.push(`/substop/cancel?id=${sub.id}`)}>
                    How do I cancel this?
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
