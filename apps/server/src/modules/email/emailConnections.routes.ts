import { FastifyInstance } from "fastify";
import {
  ConnectEmailRequestSchema,
  EmailProviderSchema,
  ReviewDecisionRequestSchema,
} from "@thrifty/shared";
import {
  createAuthorizeUrl,
  disconnectConnection,
  handleOAuthCallback,
  listConnections,
  listReviewQueue,
  resolveReviewItem,
  syncConnectionById,
} from "./emailConnections.service";
import { toPublicConnection, toPublicReviewItem } from "./emailConnections.mapper";
import { AppError } from "../../lib/errors";

export default async function emailConnectionsRoutes(fastify: FastifyInstance) {
  fastify.post("/email-connections/authorize", { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = ConnectEmailRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }
    try {
      const result = await createAuthorizeUrl(
        request.currentUser!.sub,
        parsed.data.provider,
        parsed.data.historicalScanDepthDays,
      );
      return reply.send(result);
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  // Not authenticated with a user JWT — the provider (Google/Microsoft/Yahoo) redirects the
  // user's browser here directly after consent. The `state` param (a PendingEmailOAuth id) is
  // what ties this callback back to a specific user, the same way PendingBankLink's linkToken
  // does for the Account Aggregator flow. Always redirects into the app via the thrifty:// scheme rather than
  // returning JSON, since this request comes from the OS browser, not the mobile app's API client.
  fastify.get("/email-connections/callback/:provider", async (request, reply) => {
    const providerParsed = EmailProviderSchema.safeParse((request.params as any).provider);
    const { code, state } = request.query as { code?: string; state?: string };

    if (!providerParsed.success || !code || !state) {
      return reply.redirect(302, "thrifty://email-callback?status=error&message=Invalid+callback");
    }

    try {
      await handleOAuthCallback(providerParsed.data, code, state);
      return reply.redirect(302, `thrifty://email-callback?status=success&provider=${providerParsed.data}`);
    } catch (err) {
      const message = err instanceof AppError ? err.message : "Connection failed";
      request.log.error(err, "Email OAuth callback failed");
      return reply.redirect(302, `thrifty://email-callback?status=error&message=${encodeURIComponent(message)}`);
    }
  });

  fastify.get("/email-connections", { preHandler: fastify.authenticate }, async (request, reply) => {
    const connections = await listConnections(request.currentUser!.sub);
    return reply.send({ connections: connections.map(toPublicConnection) });
  });

  fastify.delete("/email-connections/:id", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      await disconnectConnection(request.currentUser!.sub, (request.params as any).id);
      return reply.send({ disconnected: true });
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  fastify.post("/email-connections/:id/sync", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      const result = await syncConnectionById(request.currentUser!.sub, (request.params as any).id);
      return reply.send(result);
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  fastify.get("/email-connections/review-queue", { preHandler: fastify.authenticate }, async (request, reply) => {
    const items = await listReviewQueue(request.currentUser!.sub);
    return reply.send({ items: items.map(toPublicReviewItem) });
  });

  fastify.post(
    "/email-connections/review/:id/approve",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const parsed = ReviewDecisionRequestSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
      }
      try {
        const result = await resolveReviewItem(request.currentUser!.sub, (request.params as any).id, "approve", parsed.data);
        return reply.send(result);
      } catch (err) {
        if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
        throw err;
      }
    },
  );

  fastify.post(
    "/email-connections/review/:id/reject",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const result = await resolveReviewItem(request.currentUser!.sub, (request.params as any).id, "reject");
        return reply.send(result);
      } catch (err) {
        if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
        throw err;
      }
    },
  );
}
