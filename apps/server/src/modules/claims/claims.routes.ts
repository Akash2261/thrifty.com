import { FastifyInstance } from "fastify";
import { CreateClaimRequestSchema, UpdateClaimRequestSchema } from "@thrifty/shared";
import { createClaim, listClaims, updateClaim } from "./claims.service";
import { toPublicClaim } from "./claims.mapper";
import { AppError } from "../../lib/errors";

export default async function claimsRoutes(fastify: FastifyInstance) {
  fastify.post("/claims", { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = CreateClaimRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }
    try {
      const claim = await createClaim(
        request.currentUser!.sub,
        parsed.data.warrantyItemId,
        parsed.data.type,
        parsed.data.description,
      );
      return reply.code(201).send({ claim: toPublicClaim(claim) });
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  fastify.get("/claims", { preHandler: fastify.authenticate }, async (request, reply) => {
    const claims = await listClaims(request.currentUser!.sub);
    return reply.send({ claims: claims.map(toPublicClaim) });
  });

  fastify.patch<{ Params: { id: string } }>(
    "/claims/:id",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const parsed = UpdateClaimRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
      }
      try {
        const claim = await updateClaim(request.currentUser!.sub, request.params.id, parsed.data);
        return reply.send({ claim: toPublicClaim(claim) });
      } catch (err) {
        if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
        throw err;
      }
    },
  );
}
