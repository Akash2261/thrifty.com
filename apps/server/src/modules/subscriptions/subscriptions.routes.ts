import { FastifyInstance } from "fastify";
import { ConfirmInUseRequestSchema } from "@thrifty/shared";
import type { SubscriptionCadence } from "@thrifty/shared";
import { confirmCancelled, confirmInUse, listSubscriptions } from "./subscriptions.service";
import { toPublicSavingsCharge, toPublicSubscription } from "./subscriptions.mapper";
import { AppError } from "../../lib/errors";

const MONTHLY_MULTIPLIER: Record<SubscriptionCadence, number> = {
  weekly: 52 / 12,
  monthly: 1,
  yearly: 1 / 12,
};

export default async function subscriptionsRoutes(fastify: FastifyInstance) {
  fastify.get("/subscriptions", { preHandler: fastify.authenticate }, async (request, reply) => {
    const subs = await listSubscriptions(request.currentUser!.sub);
    const active = subs.filter((s) => s.status !== "cancelled");
    const monthlyTotal = active.reduce((sum, s) => sum + s.avgAmount * MONTHLY_MULTIPLIER[s.cadence], 0);

    return reply.send({
      items: subs.map(toPublicSubscription),
      monthlyTotal: Math.round(monthlyTotal * 100) / 100,
      currency: subs[0]?.currency ?? null,
    });
  });

  fastify.post<{ Params: { id: string } }>(
    "/subscriptions/:id/confirm-in-use",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const parsed = ConfirmInUseRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
      }
      try {
        const sub = await confirmInUse(request.currentUser!.sub, request.params.id, parsed.data.inUse);
        return reply.send({ item: toPublicSubscription(sub) });
      } catch (err) {
        if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
        throw err;
      }
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/subscriptions/:id/confirm-cancelled",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const result = await confirmCancelled(request.currentUser!.sub, request.params.id);
        return reply.send({
          charge: result.charge ? toPublicSavingsCharge(result.charge) : null,
          checkoutUrl: result.checkoutUrl,
        });
      } catch (err) {
        if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
        throw err;
      }
    },
  );
}
