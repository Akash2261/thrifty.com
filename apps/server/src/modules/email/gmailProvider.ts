import { AppError } from "../../lib/errors";
import { htmlToText } from "./emailProvider";
import type { EmailProviderClient, RawEmailMessage } from "./emailProvider";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const SCOPES = "https://www.googleapis.com/auth/gmail.readonly email";

// A real inbox easily has more than one page of matching mail across a 30-180 day window —
// without pagination, only the first page would ever be seen and historicalScanDepthDays would
// silently not mean what it says. Bounded rather than unbounded so a single sync can't run
// forever against a huge inbox; the next scheduled sync picks up anything left over via the
// incremental historyId cursor.
const MAX_HISTORICAL_MESSAGES = 300;
const LIST_PAGE_SIZE = 100;
const FETCH_CONCURRENCY = 8;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function getCredentials() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new AppError(
      "Gmail connection isn't set up yet on the server (missing GOOGLE_OAUTH_CLIENT_ID/SECRET).",
      503,
    );
  }
  return { clientId, clientSecret };
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPart {
  mimeType: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
}

interface ImageAttachmentRef {
  attachmentId: string;
  mimeType: string;
  size: number;
}

function findBodyContent(payload: GmailPart): { text: string | null; html: string | null; imageRef: ImageAttachmentRef | null } {
  let text: string | null = null;
  let html: string | null = null;
  let imageRef: ImageAttachmentRef | null = null;

  function walk(part: GmailPart) {
    if (part.mimeType === "text/plain" && part.body?.data && !text) {
      text = Buffer.from(part.body.data, "base64url").toString("utf8");
    } else if (part.mimeType === "text/html" && part.body?.data && !html) {
      html = Buffer.from(part.body.data, "base64url").toString("utf8");
    } else if (
      !imageRef &&
      part.mimeType.startsWith("image/") &&
      part.body?.attachmentId &&
      (part.body.size ?? 0) <= MAX_ATTACHMENT_BYTES
    ) {
      imageRef = { attachmentId: part.body.attachmentId, mimeType: part.mimeType, size: part.body.size ?? 0 };
    }
    for (const child of part.parts ?? []) walk(child);
  }
  walk(payload);
  return { text, html, imageRef };
}

function headerValue(headers: GmailHeader[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function fetchAttachmentBytes(accessToken: string, messageId: string, attachmentId: string): Promise<Buffer | null> {
  const response = await fetch(`${GMAIL_API}/messages/${messageId}/attachments/${attachmentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { data?: string };
  return data.data ? Buffer.from(data.data, "base64url") : null;
}

async function fetchMessage(accessToken: string, id: string): Promise<RawEmailMessage | null> {
  const response = await fetch(`${GMAIL_API}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { payload: GmailPart & { headers: GmailHeader[] }; internalDate: string };

  const headers = data.payload.headers ?? [];
  const { text, html, imageRef } = findBodyContent(data.payload);
  const body = text ?? (html ? htmlToText(html) : "");

  let imageAttachment: RawEmailMessage["imageAttachment"] = null;
  if (imageRef) {
    const buffer = await fetchAttachmentBytes(accessToken, id, imageRef.attachmentId);
    if (buffer) imageAttachment = { buffer, mimeType: imageRef.mimeType };
  }

  return {
    providerMessageId: id,
    fromAddress: headerValue(headers, "From"),
    subject: headerValue(headers, "Subject"),
    textBody: body,
    receivedAt: new Date(Number(data.internalDate)),
    imageAttachment,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function fetchMessagesInBatches(accessToken: string, ids: string[]): Promise<RawEmailMessage[]> {
  const messages: RawEmailMessage[] = [];
  for (const batch of chunk(ids, FETCH_CONCURRENCY)) {
    const fetched = await Promise.all(batch.map((id) => fetchMessage(accessToken, id)));
    for (const message of fetched) if (message) messages.push(message);
  }
  return messages;
}

export const gmailProvider: EmailProviderClient = {
  getAuthUrl(state, redirectUri) {
    const { clientId } = getCredentials();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode(code, redirectUri) {
    const { clientId, clientSecret } = getCredentials();
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!response.ok) {
      console.error("Gmail token exchange failed", await response.text());
      throw new AppError("Couldn't finish connecting your Gmail account. Try again.", 502);
    }
    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };

    const userinfo = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (!userinfo.ok) {
      throw new AppError("Couldn't read that Gmail account's address. Try again.", 502);
    }
    const { email } = (await userinfo.json()) as { email: string };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      emailAddress: email,
      scope: data.scope,
    };
  },

  async refreshAccessToken(refreshToken) {
    const { clientId, clientSecret } = getCredentials();
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });
    if (!response.ok) {
      console.error("Gmail token refresh failed", await response.text());
      throw new AppError("Your Gmail connection expired. Reconnect it in Settings.", 401);
    }
    const data = (await response.json()) as { access_token: string; expires_in: number };
    return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
  },

  async listNewMessages({ accessToken, syncToken, sinceDate }) {
    const messageIds: string[] = [];
    const seen = new Set<string>();

    if (syncToken) {
      const historyResponse = await fetch(
        `${GMAIL_API}/history?startHistoryId=${encodeURIComponent(syncToken)}&historyTypes=messageAdded`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (historyResponse.ok) {
        const data = (await historyResponse.json()) as {
          history?: { messagesAdded?: { message: { id: string } }[] }[];
        };
        for (const h of data.history ?? []) {
          for (const m of h.messagesAdded ?? []) {
            if (!seen.has(m.message.id)) {
              seen.add(m.message.id);
              messageIds.push(m.message.id);
            }
          }
        }
      }
      // A 404 here means the historyId is too old (Gmail only retains ~1 week) — fall through
      // to the date-bounded listing below instead of erroring the whole sync.
    }

    if (!syncToken || messageIds.length === 0) {
      const afterEpoch = Math.floor(sinceDate.getTime() / 1000);
      let pageToken: string | undefined;
      do {
        const params = new URLSearchParams({ q: `after:${afterEpoch}`, maxResults: String(LIST_PAGE_SIZE) });
        if (pageToken) params.set("pageToken", pageToken);

        const listResponse = await fetch(`${GMAIL_API}/messages?${params.toString()}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!listResponse.ok) {
          console.error("Gmail messages.list failed", await listResponse.text());
          throw new AppError("Couldn't check your Gmail for new receipts. Try again.", 502);
        }
        const data = (await listResponse.json()) as { messages?: { id: string }[]; nextPageToken?: string };
        for (const m of data.messages ?? []) {
          if (!seen.has(m.id)) {
            seen.add(m.id);
            messageIds.push(m.id);
          }
        }
        pageToken = data.nextPageToken;
      } while (pageToken && messageIds.length < MAX_HISTORICAL_MESSAGES);

      if (pageToken && messageIds.length >= MAX_HISTORICAL_MESSAGES) {
        console.warn(
          `Gmail historical sync hit the ${MAX_HISTORICAL_MESSAGES}-message cap with more mail still available — ` +
            "the remainder will be picked up incrementally via historyId on future syncs.",
        );
      }
    }

    const messages = await fetchMessagesInBatches(accessToken, messageIds);

    const profileResponse = await fetch(`${GMAIL_API}/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const nextSyncToken = profileResponse.ok
      ? ((await profileResponse.json()) as { historyId: string }).historyId
      : syncToken;

    return { messages, nextSyncToken: nextSyncToken ?? null };
  },
};
