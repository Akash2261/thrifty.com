import { prisma } from "../../db/prisma";
import { createWarrantyItemFromEmail } from "./warranty.service";

interface PostmarkAttachment {
  Name: string;
  ContentType: string;
  Content: string;
  ContentLength: number;
}

export interface PostmarkInboundPayload {
  OriginalRecipient?: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  Attachments?: PostmarkAttachment[];
}

// Each user's forwarding address is `{token}@INBOUND_EMAIL_DOMAIN` — the token is looked up
// directly rather than trusting anything else in the payload, so this is safe from spoofed
// From/Subject headers.
export async function processInboundEmail(payload: PostmarkInboundPayload) {
  const recipient = payload.OriginalRecipient;
  if (!recipient) return;

  const token = recipient.split("@")[0];
  const user = await prisma.user.findUnique({ where: { inboundEmailToken: token } });
  if (!user) return;

  const imageAttachment = payload.Attachments?.find((a) => a.ContentType.startsWith("image/"));
  const text = payload.TextBody || payload.Subject || "";
  if (!text && !imageAttachment) return;

  await createWarrantyItemFromEmail(
    user.id,
    text,
    imageAttachment
      ? { buffer: Buffer.from(imageAttachment.Content, "base64"), mimeType: imageAttachment.ContentType }
      : null,
  );
}
