import { prisma } from "../../db/prisma";
import { AppError } from "../../lib/errors";
import { sendEmail } from "../../lib/emailSender";
import { findKnownService } from "./knownService";
import type { CancellationOptions } from "@thrifty/shared";

async function getOwnedSubscription(userId: string, subscriptionId: string) {
  const sub = await prisma.detectedSubscription.findFirst({ where: { id: subscriptionId, userId } });
  if (!sub) {
    throw new AppError("Subscription not found", 404);
  }
  return sub;
}

function buildDraft(userEmail: string, displayName: string) {
  return {
    subject: `Cancellation request — ${displayName}`,
    body:
      `Hello,\n\nPlease cancel the subscription associated with this account: ${userEmail}.\n\n` +
      `Thank you,\n${userEmail}`,
  };
}

export async function getCancellationOptions(userId: string, subscriptionId: string): Promise<CancellationOptions> {
  const sub = await getOwnedSubscription(userId, subscriptionId);
  const known = await findKnownService(sub.merchantNormalized);

  if (known?.method === "self_service_url" && known.selfServiceUrl) {
    return {
      method: "self_service_url",
      displayName: known.displayName,
      instructions: known.instructions,
      selfServiceUrl: known.selfServiceUrl,
    };
  }

  if (known?.method === "email" && known.cancellationEmail) {
    return {
      method: "email",
      displayName: known.displayName,
      instructions: known.instructions,
      selfServiceUrl: null,
    };
  }

  return {
    method: "unknown",
    displayName: sub.displayName,
    instructions:
      "We don't have a verified cancellation method for this one yet. Check your bank/card statement " +
      "or the merchant's own app or website for how to cancel — usually under Account or Membership settings.",
    selfServiceUrl: null,
  };
}

export async function createCancellationRequest(userId: string, subscriptionId: string) {
  const sub = await getOwnedSubscription(userId, subscriptionId);
  const known = await findKnownService(sub.merchantNormalized);

  if (known?.method !== "email" || !known.cancellationEmail) {
    throw new AppError("This subscription doesn't have an email-based cancellation option.", 400);
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.email) {
    throw new AppError("Add an email address to your account to use email-based cancellation.", 400);
  }
  const draft = buildDraft(user.email, known.displayName);

  return prisma.cancellationRequest.create({
    data: {
      userId,
      detectedSubscriptionId: subscriptionId,
      method: "email",
      recipientEmail: known.cancellationEmail,
      draftSubject: draft.subject,
      draftBody: draft.body,
      status: "draft",
    },
  });
}

export async function sendCancellationRequest(userId: string, requestId: string) {
  const request = await prisma.cancellationRequest.findFirst({ where: { id: requestId, userId } });
  if (!request) {
    throw new AppError("Cancellation request not found", 404);
  }
  if (request.status === "sent") {
    return request;
  }
  if (!request.recipientEmail || !request.draftSubject || !request.draftBody) {
    throw new AppError("This request has no draft content to send", 400);
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.email) {
    throw new AppError("This account no longer has an email address on file.", 400);
  }

  try {
    await sendEmail({
      to: request.recipientEmail,
      replyTo: user.email,
      subject: request.draftSubject,
      textBody: request.draftBody,
    });
  } catch (err) {
    await prisma.cancellationRequest.update({ where: { id: request.id }, data: { status: "failed" } });
    throw err;
  }

  return prisma.cancellationRequest.update({
    where: { id: request.id },
    data: { status: "sent", sentAt: new Date() },
  });
}
