import type { ExpoPushMessage } from "expo-server-sdk";
import { prisma } from "../db/prisma";
import { sendPushNotifications } from "../lib/pushNotifications";
import { daysUntil, NotificationPreferencesSchema } from "@thrifty/shared";

const NOTIFY_WINDOW_DAYS = 3;

export async function runDeadlineScan(now: Date = new Date()) {
  const windowEnd = new Date(now.getTime() + NOTIFY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [returnDue, warrantyDue] = await Promise.all([
    prisma.warrantyItem.findMany({
      where: { notifiedReturn: false, returnWindowEndsAt: { gte: now, lte: windowEnd } },
      include: { user: true },
    }),
    prisma.warrantyItem.findMany({
      where: { notifiedWarranty: false, warrantyEndsAt: { gte: now, lte: windowEnd } },
      include: { user: true },
    }),
  ]);

  const messages: ExpoPushMessage[] = [];
  const notificationRows: {
    userId: string;
    relatedWarrantyItemId: string;
    type: "return_window" | "warranty_expiry";
    willSend: boolean;
  }[] = [];

  for (const item of returnDue) {
    const prefs = NotificationPreferencesSchema.parse(item.user.notificationPreferences ?? {});
    const willSend = prefs.returnWindowReminders && !!item.user.pushToken;
    if (willSend) {
      messages.push({
        to: item.user.pushToken!,
        sound: "default",
        title: "Return window closing soon",
        body: `${item.itemName}: return window closes in ${daysUntil(item.returnWindowEndsAt!, now)} day(s).`,
      });
    }
    notificationRows.push({ userId: item.userId, relatedWarrantyItemId: item.id, type: "return_window", willSend });
  }

  for (const item of warrantyDue) {
    const prefs = NotificationPreferencesSchema.parse(item.user.notificationPreferences ?? {});
    const willSend = prefs.warrantyReminders && !!item.user.pushToken;
    if (willSend) {
      messages.push({
        to: item.user.pushToken!,
        sound: "default",
        title: "Warranty expiring soon",
        body: `${item.itemName}: warranty expires in ${daysUntil(item.warrantyEndsAt!, now)} day(s).`,
      });
    }
    notificationRows.push({ userId: item.userId, relatedWarrantyItemId: item.id, type: "warranty_expiry", willSend });
  }

  if (messages.length) {
    await sendPushNotifications(messages);
  }

  await Promise.all([
    prisma.notification.createMany({
      data: notificationRows.map((row) => ({
        userId: row.userId,
        relatedWarrantyItemId: row.relatedWarrantyItemId,
        type: row.type,
        scheduledFor: now,
        sentAt: row.willSend ? now : null,
        // "dismissed" here means "the user's own preferences opted out" — not something they
        // actively dismissed in the app, but it reuses the same "no action needed" status.
        status: row.willSend ? "sent" : "dismissed",
      })),
    }),
    prisma.warrantyItem.updateMany({
      where: { id: { in: returnDue.map((i) => i.id) } },
      data: { notifiedReturn: true },
    }),
    prisma.warrantyItem.updateMany({
      where: { id: { in: warrantyDue.map((i) => i.id) } },
      data: { notifiedWarranty: true },
    }),
  ]);

  return { returnNotified: returnDue.length, warrantyNotified: warrantyDue.length };
}
