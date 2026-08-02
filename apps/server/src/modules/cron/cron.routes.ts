import { FastifyInstance, FastifyRequest } from "fastify";
import { runDeadlineScan } from "../../jobs/deadlineScan";
import { runSubscriptionDigest } from "../../jobs/subscriptionDigest";
import { runConsentExpiryCheck } from "../../jobs/consentExpiry";

// HTTP-triggered equivalents of the node-cron jobs in src/index.ts, for hosts (Vercel) where
// nothing keeps a persistent process alive to run an in-process scheduler. Vercel Cron Jobs call
// these on a schedule (see vercel.json) and authenticate via the CRON_SECRET Vercel automatically
// sends as the Authorization header — see https://vercel.com/docs/cron-jobs/manage-cron-jobs.
// Harmless (and unused) on persistent hosts, which rely on node-cron in src/index.ts instead.
function isAuthorizedCronRequest(request: FastifyRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.authorization === `Bearer ${secret}`;
}

export default async function cronRoutes(fastify: FastifyInstance) {
  fastify.get("/cron/deadline-scan", async (request, reply) => {
    if (!isAuthorizedCronRequest(request)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    await runDeadlineScan();
    return reply.send({ ok: true });
  });

  fastify.get("/cron/subscription-digest", async (request, reply) => {
    if (!isAuthorizedCronRequest(request)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    await runSubscriptionDigest();
    return reply.send({ ok: true });
  });

  fastify.get("/cron/consent-expiry", async (request, reply) => {
    if (!isAuthorizedCronRequest(request)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    await runConsentExpiryCheck();
    return reply.send({ ok: true });
  });
}
