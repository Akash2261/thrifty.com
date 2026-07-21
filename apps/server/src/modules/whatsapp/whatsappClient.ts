import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../../lib/errors";

const GRAPH_API_VERSION = "v20.0";

function getCredentials() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    throw new AppError(
      "WhatsApp isn't set up yet on the server (missing WHATSAPP_ACCESS_TOKEN/PHONE_NUMBER_ID).",
      503,
    );
  }
  return { accessToken, phoneNumberId };
}

export async function sendTextMessage(to: string, body: string): Promise<void> {
  const { accessToken, phoneNumberId } = getCredentials();

  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });

  if (!response.ok) {
    console.error("WhatsApp sendTextMessage failed", await response.text());
    // Don't throw here in practice — callers treat a failed reply as best-effort (see
    // whatsapp.service.ts) so a Meta/network hiccup never fails the whole webhook.
    throw new AppError("Couldn't send that WhatsApp message.", 502);
  }
}

// Media messages (photos) arrive as just an id — the actual bytes live behind a short-lived,
// token-gated URL that has to be resolved first.
export async function fetchMediaBytes(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const { accessToken } = getCredentials();

  const metaResponse = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaResponse.ok) {
    throw new AppError("Couldn't look up that WhatsApp image.", 502);
  }
  const meta = (await metaResponse.json()) as { url: string; mime_type: string };

  const fileResponse = await fetch(meta.url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!fileResponse.ok) {
    throw new AppError("Couldn't download that WhatsApp image.", 502);
  }
  const buffer = Buffer.from(await fileResponse.arrayBuffer());
  return { buffer, mimeType: meta.mime_type };
}

// Meta signs every webhook POST body with the app secret (X-Hub-Signature-256: sha256=<hex>).
// Verifying this is what proves a request actually came from Meta rather than an attacker who
// just knows the webhook URL.
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;

  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
