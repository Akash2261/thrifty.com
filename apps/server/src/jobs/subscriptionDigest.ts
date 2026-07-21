import type { ExpoPushMessage } from "expo-server-sdk";
import { prisma } from "../db/prisma";
import { sendPushNotifications } from "../lib/pushNotifications";
import { NotificationPreferencesSchema } from "@thrifty/shared";
import type { SubscriptionCadence } from "@thrifty/shared";

function monthlyEquivalent(amount: number, cadence: SubscriptionCadence): number {
  switch (cadence) {
    case "weekly":
      return (amount * 52) / 12;
    case "yearly":
      return amount / 12;
    case "monthly":
    default:
      return amount;
  }
}

// Runs monthly (see the cron schedule in index.ts) — summarizes total subscription spend per
// user, respecting the `unusedSubscriptionDigest` preference from Milestone 1's notification
// settings (which existed on the User model since then but had no job actually driving it).
export async function runSubscriptionDigest(now: Date = new Date()) {
  const usersWithSubscriptions = await prisma.user.findMany({
    where: { detectedSubscriptions: { some: { status: { not: "cancelled" } } } },
  });

  const messages: ExpoPushMessage[] = [];
  const notificationRows: { userId: string; willSend: boolean }[] = [];

  for (const user of usersWithSubscriptions) {
    const prefs = NotificationPreferencesSchema.parse(user.notificationPreferences ?? {});
    if (!prefs.unusedSubscriptionDigest) continue;

    const subs = await prisma.detectedSubscription.findMany({
      where: { userId: user.id, status: { not: "cancelled" } },
    });
    if (subs.length === 0) continue;

    const totalMonthly = subs.reduce((sum, s) => sum + monthlyEquivalent(s.avgAmount, s.cadence), 0);
    const flaggedCount = subs.filter((s) => s.status === "flagged").length;
    const currency = subs[0].currency;

    const willSend = !!user.pushToken;
    if (willSend) {
      const flaggedNote = flaggedCount > 0 ? ` (${flaggedCount} flagged as unused)` : "";
      messages.push({
        to: user.pushToken!,
        sound: "default",
        title: "Your monthly subscription digest",
        body: `You're spending ~${currency} ${totalMonthly.toFixed(2)}/mo across ${subs.length} subscription${subs.length === 1 ? "" : "s"}${flaggedNote}.`,
      });
    }
    notificationRows.push({ userId: user.id, willSend });
  }

  if (messages.length) {
    await sendPushNotifications(messages);
  }

  await prisma.notification.createMany({
    data: notificationRows.map((row) => ({
      userId: row.userId,
      type: "unused_subscription" as const,
      scheduledFor: now,
      sentAt: row.willSend ? now : null,
      status: row.willSend ? ("sent" as const) : ("dismissed" as const),
    })),
  });

  return { usersNotified: notificationRows.filter((r) => r.willSend).length, usersEvaluated: notificationRows.length };
}
