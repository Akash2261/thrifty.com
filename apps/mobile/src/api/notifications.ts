import type { Notification, NotificationPreferences, UpdateNotificationPreferencesRequest } from "@thrifty/shared";
import { authorizedRequest } from "./authClient";

export function listNotifications() {
  return authorizedRequest<{ items: Notification[] }>("/notifications");
}

export function dismissNotification(id: string) {
  return authorizedRequest<{ item: Notification }>(`/notifications/${id}/dismiss`, { method: "PATCH" });
}

export function updateNotificationPreferences(patch: UpdateNotificationPreferencesRequest) {
  return authorizedRequest<{ notificationPreferences: NotificationPreferences }>("/notifications/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
