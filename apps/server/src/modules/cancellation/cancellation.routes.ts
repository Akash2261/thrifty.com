import { FastifyInstance } from "fastify";
import { AppError } from "../../lib/errors";
import {
  createCancellationRequest,
  getCancellationOptions,
  sendCancellationRequest,
} from "./cancellation.service";
import { toPublicCancellationRequest } from "./cancellation.mapper";

export default async function cancellationRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string } }>(
    "/subscriptions/:id/cancellation-options",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const options = await getCancellationOptions(request.currentUser!.sub, request.params.id);
        return reply.send(options);
      } catch (err) {
        if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
        throw err;
      }
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/subscriptions/:id/cancellation-requests",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const cancellationRequest = await createCancellationRequest(request.currentUser!.sub, request.params.id);
        return reply.code(201).send({ item: toPublicCancellationRequest(cancellationRequest) });
      } catch (err) {
        if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
        throw err;
      }
    },
  );

  // The explicit "yes, actually send this" step — the mobile app only calls this after showing
  // the user the exact draft and getting an in-app confirmation tap.
  fastify.post<{ Params: { id: string } }>(
    "/cancellation-requests/:id/send",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const sent = await sendCancellationRequest(request.currentUser!.sub, request.params.id);
        return reply.send({ item: toPublicCancellationRequest(sent) });
      } catch (err) {
        if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
        throw err;
      }
    },
  );
}
