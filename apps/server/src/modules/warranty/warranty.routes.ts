import { FastifyInstance } from "fastify";
import { WarrantyItemPatchSchema } from "@thrifty/shared";
import {
  createWarrantyItemFromReceipt,
  getWarrantyItem,
  getWarrantyItemImage,
  listWarrantyItems,
  updateWarrantyItem,
  WarrantyError,
} from "./warranty.service";
import { toPublicWarrantyItem } from "./warranty.mapper";

const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export default async function warrantyRoutes(fastify: FastifyInstance) {
  fastify.post("/receipts", { preHandler: fastify.authenticate }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: "No image uploaded" });
    }

    const buffer = await data.toBuffer();

    try {
      const item = await createWarrantyItemFromReceipt(request.currentUser!.sub, buffer, data.mimetype);
      return reply.code(201).send({ item: toPublicWarrantyItem(item) });
    } catch (err) {
      if (err instanceof WarrantyError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });

  fastify.get("/warranty-items", { preHandler: fastify.authenticate }, async (request, reply) => {
    const items = await listWarrantyItems(request.currentUser!.sub);
    return reply.send({ items: items.map(toPublicWarrantyItem) });
  });

  fastify.get<{ Params: { id: string } }>(
    "/warranty-items/:id",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const item = await getWarrantyItem(request.currentUser!.sub, request.params.id);
        return reply.send({ item: toPublicWarrantyItem(item) });
      } catch (err) {
        if (err instanceof WarrantyError) {
          return reply.code(err.status).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/warranty-items/:id",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const parsed = WarrantyItemPatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
      }

      try {
        const item = await updateWarrantyItem(request.currentUser!.sub, request.params.id, parsed.data);
        return reply.send({ item: toPublicWarrantyItem(item) });
      } catch (err) {
        if (err instanceof WarrantyError) {
          return reply.code(err.status).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/warranty-items/:id/image",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const buffer = await getWarrantyItemImage(request.currentUser!.sub, request.params.id);
        const item = await getWarrantyItem(request.currentUser!.sub, request.params.id);
        const ext = item.sourceImageUrl?.split(".").pop() ?? "jpeg";
        reply.header("Content-Type", EXT_TO_CONTENT_TYPE[ext] ?? "application/octet-stream");
        return reply.send(buffer);
      } catch (err) {
        if (err instanceof WarrantyError) {
          return reply.code(err.status).send({ error: err.message });
        }
        throw err;
      }
    },
  );
}
