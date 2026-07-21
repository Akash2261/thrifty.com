import { FastifyInstance } from "fastify";
import { buildAccountExportCsv } from "./dataExport.service";
import { getDataUsage } from "./account.service";

export default async function accountRoutes(fastify: FastifyInstance) {
  fastify.get("/account/export", { preHandler: fastify.authenticate }, async (request, reply) => {
    const csv = await buildAccountExportCsv(request.currentUser!.sub);
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", 'attachment; filename="thrifty-export.csv"');
    return reply.send(csv);
  });

  fastify.get("/account/data-usage", { preHandler: fastify.authenticate }, async (request, reply) => {
    const items = await getDataUsage(request.currentUser!.sub);
    return reply.send({ items });
  });
}
