import { AppError } from "../../lib/errors";
import { htmlToText } from "./emailProvider";
import type { EmailProviderClient, RawEmailMessage } from "./emailProvider";

const AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_API = "https://graph.microsoft.com/v1.0";
const SCOPES = "offline_access Mail.Read User.Read";
const MESSAGE_SELECT = "id,from,subject,body,receivedDateTime,hasAttachments";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function getCredentials() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new AppError(
      "Outlook connection isn't set up yet on the server (missing MICROSOFT_CLIENT_ID/SECRET).",
      503,
    );
  }
  return { clientId, clientSecret };
}

interface GraphMessage {
  id: string;
  from?: { emailAddress?: { address?: string } };
  subject?: string;
  body?: { contentType: "text" | "html"; content: string };
  receivedDateTime: string;
  hasAttachments?: boolean;
}

interface GraphFileAttachment {
  "@odata.type"?: string;
  contentType?: string;
  contentBytes?: string;
  size?: number;
}

// Only fetched when `hasAttachments` is true, so most messages (which don't have any) never pay
// for this extra request — same reasoning as Gmail's attachmentId-only (not eagerly downloaded)
// reference.
async function fetchFirstImageAttachment(
  accessToken: string,
  messageId: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const response = await fetch(`${GRAPH_API}/me/messages/${messageId}/attachments`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { value: GraphFileAttachment[] };

  const attachment = data.value.find(
    (a) =>
      a["@odata.type"] === "#microsoft.graph.fileAttachment" &&
      a.contentType?.startsWith("image/") &&
      a.contentBytes &&
      (a.size ?? 0) <= MAX_ATTACHMENT_BYTES,
  );
  if (!attachment?.contentBytes || !attachment.contentType) return null;

  return { buffer: Buffer.from(attachment.contentBytes, "base64"), mimeType: attachment.contentType };
}

async function toRawMessage(accessToken: string, m: GraphMessage): Promise<RawEmailMessage> {
  const content = m.body?.content ?? "";
  const imageAttachment = m.hasAttachments ? await fetchFirstImageAttachment(accessToken, m.id) : null;

  return {
    providerMessageId: m.id,
    fromAddress: m.from?.emailAddress?.address ?? "",
    subject: m.subject ?? "",
    textBody: m.body?.contentType === "html" ? htmlToText(content) : content,
    receivedAt: new Date(m.receivedDateTime),
    imageAttachment,
  };
}

export const outlookProvider: EmailProviderClient = {
  getAuthUrl(state, redirectUri) {
    const { clientId } = getCredentials();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      response_mode: "query",
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
        scope: SCOPES,
      }),
    });
    if (!response.ok) {
      console.error("Outlook token exchange failed", await response.text());
      throw new AppError("Couldn't finish connecting your Outlook account. Try again.", 502);
    }
    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };

    const meResponse = await fetch(`${GRAPH_API}/me?$select=mail,userPrincipalName`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (!meResponse.ok) {
      throw new AppError("Couldn't read that Outlook account's address. Try again.", 502);
    }
    const me = (await meResponse.json()) as { mail?: string; userPrincipalName?: string };
    const emailAddress = me.mail ?? me.userPrincipalName;
    if (!emailAddress) {
      throw new AppError("That Outlook account has no readable email address.", 400);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      emailAddress,
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
        scope: SCOPES,
      }),
    });
    if (!response.ok) {
      console.error("Outlook token refresh failed", await response.text());
      throw new AppError("Your Outlook connection expired. Reconnect it in Settings.", 401);
    }
    const data = (await response.json()) as { access_token: string; expires_in: number };
    return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
  },

  async listNewMessages({ accessToken, syncToken, sinceDate }) {
    // Delta query: `syncToken` is the last poll's @odata.deltaLink. On the very first sync
    // there's no cursor yet, so bound the initial request by historicalScanDepthDays instead.
    let url = syncToken
      ? syncToken
      : `${GRAPH_API}/me/mailFolders/inbox/messages/delta?$select=${MESSAGE_SELECT}&$filter=${encodeURIComponent(
          `receivedDateTime ge ${sinceDate.toISOString()}`,
        )}`;

    const messages: RawEmailMessage[] = [];
    let nextSyncToken: string | null = syncToken;

    // Graph paginates delta results via @odata.nextLink; the final page carries @odata.deltaLink,
    // which becomes the cursor for the next poll.
    for (let page = 0; page < 10; page++) {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) {
        console.error("Outlook delta query failed", await response.text());
        throw new AppError("Couldn't check your Outlook for new receipts. Try again.", 502);
      }
      const data = (await response.json()) as {
        value: GraphMessage[];
        "@odata.nextLink"?: string;
        "@odata.deltaLink"?: string;
      };
      for (const m of data.value ?? []) messages.push(await toRawMessage(accessToken, m));

      if (data["@odata.nextLink"]) {
        url = data["@odata.nextLink"];
        continue;
      }
      if (data["@odata.deltaLink"]) {
        nextSyncToken = data["@odata.deltaLink"];
      }
      break;
    }

    return { messages, nextSyncToken };
  },
};
