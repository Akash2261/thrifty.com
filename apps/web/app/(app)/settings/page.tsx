"use client";

import Link from "next/link";
import { useState } from "react";
import type { NotificationPreferences } from "@thrifty/shared";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Switch } from "@/components/Switch";
import { useSession } from "@/context/session-context";
import { updateNotificationPreferences } from "@/lib/api/notifications";
import { deleteAccount as deleteAccountRequest } from "@/lib/api/auth";

const PREFERENCE_LABELS: Record<keyof NotificationPreferences, string> = {
  returnWindowReminders: "Return window reminders",
  warrantyReminders: "Warranty expiry reminders",
  subscriptionRenewalReminders: "Subscription renewal reminders",
  unusedSubscriptionDigest: "Unused subscription digest",
};

export default function SettingsPage() {
  const { user, refreshUser, signOut } = useSession();
  const [copied, setCopied] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCopyForwardingEmail() {
    await navigator.clipboard.writeText(user.inboundEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleTogglePreference(key: keyof NotificationPreferences, value: boolean) {
    setSavingKey(key);
    try {
      await updateNotificationPreferences({ [key]: value });
      await refreshUser();
    } catch {
      // Leave the switch as-is — refreshUser only applies the change on success.
    } finally {
      setSavingKey(null);
    }
  }

  async function handleDeleteAccount() {
    if (
      !window.confirm(
        "This permanently deletes your account and everything in it — warranty items, subscriptions, connections, and claims. This can't be undone.",
      )
    ) {
      return;
    }
    setIsDeleting(true);
    setError(null);
    try {
      await deleteAccountRequest();
      window.location.href = "/sign-in";
    } catch {
      setError("Couldn't delete account. Try again in a moment.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold text-ink">Settings</h1>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
          {user.email ? "Email" : "Phone"}
        </p>
        <p className="text-base text-ink">{user.email ?? user.phoneNumber}</p>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Plan</p>
        <p className="text-base text-ink">{user.tier === "premium" ? "Premium" : "Free (5 items)"}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Forward receipts to</p>
        <p className="text-sm leading-relaxed text-ink-secondary">
          Forward any order-confirmation email to this address and Thrifty will scan it
          automatically — no photo needed.
        </p>
        <button
          onClick={handleCopyForwardingEmail}
          className="flex items-center justify-between gap-3 rounded-md bg-surface-alt px-4 py-3 text-left"
        >
          <span className="truncate text-sm text-ink">{user.inboundEmail}</span>
          <span className="shrink-0 text-sm font-semibold text-accent">{copied ? "Copied!" : "Copy"}</span>
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Claims</p>
        <Link
          href="/claims"
          className="flex items-center justify-between gap-3 rounded-md bg-surface-alt px-4 py-3"
        >
          <span className="text-sm font-semibold text-ink">View your claims</span>
          <span className="text-accent">→</span>
        </Link>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Privacy</p>
        <Link
          href="/data-usage"
          className="flex items-center justify-between gap-3 rounded-md bg-surface-alt px-4 py-3"
        >
          <span className="text-sm font-semibold text-ink">What we read from your data</span>
          <span className="text-accent">→</span>
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Notifications</p>
        <Card className="flex flex-col divide-y divide-border p-0">
          {(Object.keys(PREFERENCE_LABELS) as (keyof NotificationPreferences)[]).map((key) => (
            <div key={key} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-ink">{PREFERENCE_LABELS[key]}</span>
              <Switch
                checked={user.notificationPreferences[key]}
                onChange={(value) => handleTogglePreference(key, value)}
                disabled={savingKey === key}
              />
            </div>
          ))}
        </Card>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Button variant="danger" onClick={() => void signOut()}>
        Sign out
      </Button>

      <Button variant="secondary" onClick={handleDeleteAccount} disabled={isDeleting} className="text-danger">
        {isDeleting ? "Deleting…" : "Delete account"}
      </Button>
    </div>
  );
}
