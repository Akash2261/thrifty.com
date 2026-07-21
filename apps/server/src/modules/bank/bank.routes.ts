import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createLinkSession,
  pollLinkSession,
  listLinkedAccounts,
  syncAllAccounts,
} from "./bank.service";
import { toPublicLinkedAccount } from "./bank.mapper";
import { AppError } from "../../lib/errors";
import { updateConsentStatus, handleDataNotification } from "./accountAggregatorProvider";

const LinkStatusRequestSchema = z.object({ linkToken: z.string().min(1) });

export default async function bankRoutes(fastify: FastifyInstance) {
  fastify.post("/bank/link-token", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      const session = await createLinkSession(request.currentUser!.sub);
      return reply.send(session);
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  fastify.post("/bank/link-status", { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = LinkStatusRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }
    try {
      const status = await pollLinkSession(request.currentUser!.sub, parsed.data.linkToken);
      return reply.send(status);
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  fastify.get("/bank/accounts", { preHandler: fastify.authenticate }, async (request, reply) => {
    const accounts = await listLinkedAccounts(request.currentUser!.sub);
    return reply.send({ accounts: accounts.map(toPublicLinkedAccount) });
  });

  fastify.post("/bank/sync", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      const result = await syncAllAccounts(request.currentUser!.sub);
      return reply.send(result);
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  // The Account Aggregator webhooks below are called directly by the AA/TSP (Setu), not the
  // mobile app — no user JWT is available. Auth here is a shared secret in the Authorization
  // header; Setu's exact webhook-auth scheme (this may instead be a signed JWS, per some AA
  // implementations) needs confirming against their partner docs once onboarding is complete —
  // this is the best-effort placeholder until then.
  function isAuthorizedAaWebhook(request: any): boolean {
    const secret = process.env.SETU_AA_WEBHOOK_SECRET;
    if (!secret) return false;
    return request.headers.authorization === `Bearer ${secret}`;
  }

  fastify.post("/bank/aa/webhook/consent-notification", async (request, reply) => {
    if (!isAuthorizedAaWebhook(request)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    try {
      const body = request.body as { consentHandleId?: string; consentId?: string; status?: string };
      if (body.consentHandleId && body.status) {
        await updateConsentStatus(body.consentHandleId, body.consentId ?? null, body.status);
      }
    } catch (err) {
      request.log.error(err, "Failed to process AA Consent-Notification");
    }
    return reply.send({ received: true });
  });

  fastify.post("/bank/aa/webhook/data-notification", async (request, reply) => {
    if (!isAuthorizedAaWebhook(request)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    try {
      const body = request.body as { sessionId?: string; sessionStatus?: string };
      if (body.sessionId && body.sessionStatus) {
        await handleDataNotification(body.sessionId, body.sessionStatus);
      }
    } catch (err) {
      request.log.error(err, "Failed to process AA Data-Notification");
    }
    return reply.send({ received: true });
  });
}
