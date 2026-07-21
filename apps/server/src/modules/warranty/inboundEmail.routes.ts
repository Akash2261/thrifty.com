import { FastifyInstance } from "fastify";
import { processInboundEmail, type PostmarkInboundPayload } from "./inboundEmail.service";

export default async function inboundEmailRoutes(fastify: FastifyInstance) {
  // The secret path segment (not a real user-facing route) is the auth mechanism here — Postmark's
  // inbound webhook doesn't sign payloads with an HMAC the way its outbound webhooks do, so a
  // hard-to-guess URL is the standard way to keep this endpoint from being spammed by outsiders.
  fastify.post<{ Params: { secret: string } }>(
    "/inbound-email/webhook/:secret",
    async (request, reply) => {
      const expectedSecret = process.env.POSTMARK_INBOUND_SIGNATURE_SECRET;
      if (!expectedSecret || request.params.secret !== expectedSecret) {
        return reply.code(404).send();
      }

      try {
        await processInboundEmail(request.body as PostmarkInboundPayload);
      } catch (err) {
        request.log.error(err, "Failed to process inbound email");
      }

      // Always 200 (per Postmark's guidance) so a transient failure doesn't trigger retry storms.
      return reply.send({ received: true });
    },
  );
}
