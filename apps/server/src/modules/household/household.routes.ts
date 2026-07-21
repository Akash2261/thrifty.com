import { FastifyInstance } from "fastify";
import { CreateHouseholdRequestSchema, JoinHouseholdRequestSchema } from "@thrifty/shared";
import { createHousehold, getHouseholdInfo, joinHousehold, leaveHousehold, listSharedItems } from "./household.service";
import { toPublicHousehold } from "./household.mapper";
import { AppError } from "../../lib/errors";

export default async function householdRoutes(fastify: FastifyInstance) {
  fastify.post("/household/create", { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = CreateHouseholdRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }
    try {
      const household = await createHousehold(request.currentUser!.sub, parsed.data.name);
      const info = await getHouseholdInfo(request.currentUser!.sub);
      return reply.code(201).send({ household: toPublicHousehold(info!) });
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  fastify.post("/household/join", { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = JoinHouseholdRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }
    try {
      await joinHousehold(request.currentUser!.sub, parsed.data.inviteCode);
      const info = await getHouseholdInfo(request.currentUser!.sub);
      return reply.send({ household: toPublicHousehold(info!) });
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  fastify.post("/household/leave", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      await leaveHousehold(request.currentUser!.sub);
      return reply.send({ left: true });
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  fastify.get("/household", { preHandler: fastify.authenticate }, async (request, reply) => {
    const info = await getHouseholdInfo(request.currentUser!.sub);
    return reply.send({ household: info ? toPublicHousehold(info) : null });
  });

  fastify.get("/household/shared-items", { preHandler: fastify.authenticate }, async (request, reply) => {
    const items = await listSharedItems(request.currentUser!.sub);
    return reply.send(items);
  });
}
