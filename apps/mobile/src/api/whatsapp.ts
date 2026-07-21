import type { WhatsAppLinkResponse, WhatsAppStatus } from "@thrifty/shared";
import { authorizedRequest } from "./authClient";

export function createWhatsAppLinkCode() {
  return authorizedRequest<WhatsAppLinkResponse>("/whatsapp/link", { method: "POST" });
}

export function getWhatsAppStatus() {
  return authorizedRequest<WhatsAppStatus>("/whatsapp/status");
}

export function disconnectWhatsApp() {
  return authorizedRequest<{ disconnected: true }>("/whatsapp/link", { method: "DELETE" });
}
