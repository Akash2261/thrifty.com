import { FastifyInstance } from "fastify";
import { z } from "zod";
import { NotificationPreferencesSchema, UpdateNotificationPreferencesRequestSchema } from "@thrifty/shared";
import { prisma } from "../../db/prisma";
import { AppError } from "../../lib/errors";
import { toPublicNotification } from "./notifications.mapper";

const RegisterPushTokenSchema = z.object({
  pushToken: z.string().min(1),
});

export default async function notificationsRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/notifications/register-push-token",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const parsed = RegisterPushTokenSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
      }

      await prisma.user.update({
        where: { id: request.currentUser!.sub },
        data: { pushToken: parsed.data.pushToken },
      });

      return reply.send({ ok: true });
    },
  );

  fastify.get("/notifications", { preHandler: fastify.authenticate }, async (request, reply) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: request.currentUser!.sub },
      orderBy: { scheduledFor: "desc" },
      take: 100,
    });
    return reply.send({ items: notifications.map(toPublicNotification) });
  });

  fastify.patch<{ Params: { id: string } }>(
    "/notifications/:id/dismiss",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const notification = await prisma.notification.findFirst({
        where: { id: request.params.id, userId: request.currentUser!.sub },
      });
      if (!notification) {
        throw new AppError("Notification not found", 404);
      }
      const updated = await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "dismissed" },
      });
      return reply.send({ item: toPublicNotification(updated) });
    },
  );

  fastify.patch(
    "/notifications/preferences",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const parsed = UpdateNotificationPreferencesRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
      }

      const user = await prisma.user.findUniqueOrThrow({ where: { id: request.currentUser!.sub } });
      const current = NotificationPreferencesSchema.parse(user.notificationPreferences ?? {});
      const merged = { ...current, ...parsed.data };

      await prisma.user.update({
        where: { id: user.id },
        data: { notificationPreferences: merged },
      });

      return reply.send({ notificationPreferences: merged });
    },
  );
}
