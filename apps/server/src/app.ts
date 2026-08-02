import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import jwtPlugin from "./plugins/jwt";
import authRoutes from "./modules/auth/auth.routes";
import warrantyRoutes from "./modules/warranty/warranty.routes";
import notificationsRoutes from "./modules/notifications/notifications.routes";
import bankRoutes from "./modules/bank/bank.routes";
import subscriptionsRoutes from "./modules/subscriptions/subscriptions.routes";
import cancellationRoutes from "./modules/cancellation/cancellation.routes";
import billingRoutes from "./modules/billing/billing.routes";
import inboundEmailRoutes from "./modules/warranty/inboundEmail.routes";
import emailConnectionsRoutes from "./modules/email/emailConnections.routes";
import whatsappRoutes from "./modules/whatsapp/whatsapp.routes";
import claimsRoutes from "./modules/claims/claims.routes";
import householdRoutes from "./modules/household/household.routes";
import accountRoutes from "./modules/account/account.routes";
import cronRoutes from "./modules/cron/cron.routes";
import { captureError } from "./lib/sentry";
import { AppError } from "./lib/errors";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });
  app.register(multipart, {
    limits: { fileSize: 15 * 1024 * 1024 },
  });

  // Payment webhook signatures (Razorpay) are computed over the exact raw request bytes,
  // so the JSON parser stashes the buffer before parsing rather than only exposing the parsed body.
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (request, body, done) => {
    request.rawBody = body as Buffer;
    if (body.length === 0) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(body.toString("utf8")));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.register(jwtPlugin);
  app.register(authRoutes);
  app.register(warrantyRoutes);
  app.register(notificationsRoutes);
  app.register(bankRoutes);
  app.register(subscriptionsRoutes);
  app.register(cancellationRoutes);
  app.register(billingRoutes);
  app.register(inboundEmailRoutes);
  app.register(emailConnectionsRoutes);
  app.register(whatsappRoutes);
  app.register(claimsRoutes);
  app.register(householdRoutes);
  app.register(accountRoutes);
  app.register(cronRoutes);

  app.get("/health", async () => ({ status: "ok" }));

  app.setErrorHandler((err, request, reply) => {
    // AppError is our own "clean, expected" error shape (handled at each route's catch block) —
    // if one reaches here it's a bug, so report it like any other unexpected error.
    if (!(err instanceof AppError)) {
      captureError(err);
    }
    request.log.error(err);
    const status = err instanceof AppError ? err.status : 500;
    reply.code(status).send({ error: err instanceof AppError ? err.message : "Internal server error" });
  });

  return app;
}
