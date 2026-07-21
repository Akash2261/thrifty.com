import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env";

export interface AccessTokenPayload {
  sub: string;
  email: string | null;
}

export interface RefreshTokenPayload {
  sub: string;
}

declare module "fastify" {
  interface FastifyRequest {
    accessJwtVerify(): Promise<AccessTokenPayload>;
    refreshJwtVerify(): Promise<RefreshTokenPayload>;
  }
  interface FastifyReply {
    accessJwtSign(payload: AccessTokenPayload): Promise<string>;
    refreshJwtSign(payload: RefreshTokenPayload): Promise<string>;
  }
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
  interface FastifyRequest {
    currentUser?: AccessTokenPayload;
  }
}

// @fastify/jwt's own types model `fastify.jwt` as a single JWT instance, but registering
// with `namespace` actually turns it into a map keyed by namespace at runtime
// (fastify.jwt.access, fastify.jwt.refresh) — this narrows that manually for verify-by-value.
export type NamespacedJwt = {
  [namespace in "access" | "refresh"]: {
    verify<T>(token: string): T;
  };
};

export default fp(async function jwtPlugin(fastify: FastifyInstance) {
  await fastify.register(jwt, {
    namespace: "access",
    secret: env.JWT_ACCESS_SECRET,
    sign: { expiresIn: env.ACCESS_TOKEN_TTL },
  });

  await fastify.register(jwt, {
    namespace: "refresh",
    secret: env.JWT_REFRESH_SECRET,
    sign: { expiresIn: env.REFRESH_TOKEN_TTL },
  });

  fastify.decorate("authenticate", async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      request.currentUser = await request.accessJwtVerify();
    } catch {
      reply.code(401).send({ error: "Unauthorized" });
    }
  });
});
