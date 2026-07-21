import type { EmailProvider } from "@thrifty/shared";
import { gmailProvider } from "./gmailProvider";
import { outlookProvider } from "./outlookProvider";
import { yahooProvider } from "./yahooProvider";

export interface ExchangeResult {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  emailAddress: string;
  scope: string | null;
}

export interface RefreshResult {
  accessToken: string;
  expiresAt: Date | null;
}

export interface RawEmailMessage {
  providerMessageId: string;
  fromAddress: string;
  subject: string;
  textBody: string;
  receivedAt: Date;
  // Populated when the message has an attached receipt image — many retailers send a scanned
  // receipt/invoice as an attachment rather than (or in addition to) body text, so the
  // Claude-fallback extraction path prefers this over text when present.
  imageAttachment?: { buffer: Buffer; mimeType: string } | null;
}

export interface ListMessagesResult {
  messages: RawEmailMessage[];
  nextSyncToken: string | null;
}

export interface EmailProviderClient {
  // Builds the provider's consent-screen URL. `state` round-trips through the provider back to
  // our callback route so it can recover which PendingEmailOAuth row started the flow.
  getAuthUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<ExchangeResult>;
  refreshAccessToken(refreshToken: string): Promise<RefreshResult>;
  // `syncToken` is the provider's own incremental-sync cursor (Gmail historyId / Graph
  // deltaLink) — null on the very first sync, in which case `sinceDate` bounds how far back to
  // look via the historicalScanDepthDays the user chose when connecting.
  listNewMessages(params: {
    accessToken: string;
    syncToken: string | null;
    sinceDate: Date;
  }): Promise<ListMessagesResult>;
}

export function getEmailProvider(provider: EmailProvider): EmailProviderClient {
  switch (provider) {
    case "gmail":
      return gmailProvider;
    case "outlook":
      return outlookProvider;
    case "yahoo":
      return yahooProvider;
  }
}

// Cheap plain-text approximation of an HTML email body — good enough for keyword/regex-based
// retailer parsers and as input to the Claude fallback extractor. Not meant to be a faithful
// renderer.
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
