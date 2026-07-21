import { FastifyInstance } from "fastify";
import { AppError } from "../../lib/errors";
import { createCheckoutSession, handleRazorpayWebhook } from "./billing.service";

export default async function billingRoutes(fastify: FastifyInstance) {
  fastify.post("/billing/checkout", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      const session = await createCheckoutSession(request.currentUser!.sub);
      return reply.send(session);
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  fastify.post("/billing/webhook/razorpay", async (request, reply) => {
    const signature = request.headers["x-razorpay-signature"];
    if (!request.rawBody || typeof signature !== "string") {
      return reply.code(400).send({ error: "Missing signature or body" });
    }
    try {
      await handleRazorpayWebhook(request.rawBody, signature);
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
      request.log.error(err, "Failed to process Razorpay webhook");
    }
    return reply.send({ received: true });
  });
}
