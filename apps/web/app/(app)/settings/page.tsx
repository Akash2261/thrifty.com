"use client";

import Link from "next/link";
import { useState } from "react";
import type { NotificationPreferences } from "@thrifty/shared";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Switch } from "@/components/Switch";
import { TextField } from "@/components/TextField";
import { useSession } from "@/context/session-context";
import { updateNotificationPreferences } from "@/lib/api/notifications";
import { ApiError } from "@/lib/api/client";
import { deleteAccount as deleteAccountRequest, updateProfile } from "@/lib/api/auth";

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

  const [name, setName] = useState(user.name ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(user.dateOfBirth ?? "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const profileDirty =
    name !== (user.name ?? "") ||
    email !== (user.email ?? "") ||
    phoneNumber !== (user.phoneNumber ?? "") ||
    dateOfBirth !== (user.dateOfBirth ?? "");

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSaved(false);
    setIsSavingProfile(true);
    try {
      await updateProfile({
        ...(name !== (user.name ?? "") ? { name } : {}),
        ...(email !== (user.email ?? "") ? { email } : {}),
        ...(phoneNumber !== (user.phoneNumber ?? "") ? { phoneNumber } : {}),
        ...(dateOfBirth !== (user.dateOfBirth ?? "") ? { dateOfBirth } : {}),
      });
      await refreshUser();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Couldn't save your details. Try again.");
    } finally {
      setIsSavingProfile(false);
    }
  }

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

      <form className="flex flex-col gap-3" onSubmit={handleSaveProfile}>
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Personal details</p>
        <TextField label="Name" name="name" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField
          label="Phone"
          name="phoneNumber"
          type="tel"
          placeholder="+919876543210"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
        />
        <TextField
          label="Date of birth"
          name="dateOfBirth"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
        />

        {profileError ? <p className="text-sm text-danger">{profileError}</p> : null}

        <Button type="submit" variant="secondary" disabled={!profileDirty || isSavingProfile} className="self-start">
          {isSavingProfile ? "Saving…" : profileSaved ? "Saved!" : "Save changes"}
        </Button>
      </form>

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
