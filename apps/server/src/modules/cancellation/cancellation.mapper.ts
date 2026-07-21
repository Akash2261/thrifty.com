import type { CancellationRequest as PrismaCancellationRequest } from "@prisma/client";
import type { CancellationRequest } from "@thrifty/shared";

export function toPublicCancellationRequest(request: PrismaCancellationRequest): CancellationRequest {
  return {
    id: request.id,
    recipientEmail: request.recipientEmail,
    draftSubject: request.draftSubject,
    draftBody: request.draftBody,
    status: request.status,
    sentAt: request.sentAt?.toISOString() ?? null,
  };
}
