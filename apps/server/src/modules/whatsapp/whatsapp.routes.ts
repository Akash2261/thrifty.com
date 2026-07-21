import { FastifyInstance } from "fastify";
import { createLinkingCode, disconnect, getStatus, handleInboundMessage, parseInboundMessages } from "./whatsapp.service";
import { verifyWebhookSignature } from "./whatsappClient";

export default async function whatsappRoutes(fastify: FastifyInstance) {
  fastify.post("/whatsapp/link", { preHandler: fastify.authenticate }, async (request, reply) => {
    const result = await createLinkingCode(request.currentUser!.sub);
    return reply.send(result);
  });

  fastify.get("/whatsapp/status", { preHandler: fastify.authenticate }, async (request, reply) => {
    const status = await getStatus(request.currentUser!.sub);
    return reply.send(status);
  });

  fastify.delete("/whatsapp/link", { preHandler: fastify.authenticate }, async (request, reply) => {
    await disconnect(request.currentUser!.sub);
    return reply.send({ disconnected: true });
  });

  // Meta's one-time verification handshake when you register the webhook URL in the Meta App
  // Dashboard — must echo back hub.challenge exactly if the verify token matches.
  fastify.get("/webhooks/whatsapp", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    if (verifyToken && query["hub.mode"] === "subscribe" && query["hub.verify_token"] === verifyToken) {
      return reply.code(200).send(query["hub.challenge"]);
    }
    return reply.code(403).send("Verification failed");
  });

  fastify.post("/webhooks/whatsapp", async (request, reply) => {
    const signature = request.headers["x-hub-signature-256"] as string | undefined;
    if (!request.rawBody || !verifyWebhookSignature(request.rawBody, signature)) {
      request.log.warn("Rejected WhatsApp webhook with invalid signature");
      // Still 200 — Meta retries aggressively on non-2xx, and an invalid signature is never
      // going to become valid on retry, so there's nothing productive about a 4xx/5xx here.
      return reply.send({ received: true });
    }

    try {
      const messages = parseInboundMessages(request.body);
      for (const message of messages) {
        await handleInboundMessage(message);
      }
    } catch (err) {
      request.log.error(err, "Failed to process WhatsApp webhook");
    }
    return reply.send({ received: true });
  });
}
