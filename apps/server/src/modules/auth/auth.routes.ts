import { FastifyInstance, FastifyReply } from "fastify";
import {
  SignupRequestSchema,
  LoginRequestSchema,
  RefreshRequestSchema,
  SendOtpRequestSchema,
  VerifyOtpRequestSchema,
  SocialSignInRequestSchema,
} from "@thrifty/shared";
import { createUser, verifyCredentials, getUserById, deleteAccount, AuthError } from "./auth.service";
import { sendOtp, verifyOtpAndSignIn } from "./otp.service";
import { socialSignIn } from "./socialAuth.service";
import { toPublicUser } from "./auth.mapper";
import { AppError } from "../../lib/errors";
import type { NamespacedJwt } from "../../plugins/jwt";
import type { User as PrismaUser } from "@prisma/client";

async function issueTokens(reply: FastifyReply, user: PrismaUser) {
  const accessToken = await reply.accessJwtSign({ sub: user.id, email: user.email });
  const refreshToken = await reply.refreshJwtSign({ sub: user.id });
  return { accessToken, refreshToken };
}

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/auth/signup", async (request, reply) => {
    const parsed = SignupRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    try {
      const user = await createUser(parsed.data.email, parsed.data.password, parsed.data.country);
      const tokens = await issueTokens(reply, user);
      return reply.code(201).send({ user: toPublicUser(user), ...tokens });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(409).send({ error: err.message });
      }
      throw err;
    }
  });

  fastify.post("/auth/login", async (request, reply) => {
    const parsed = LoginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    try {
      const user = await verifyCredentials(parsed.data.email, parsed.data.password);
      const tokens = await issueTokens(reply, user);
      return reply.send({ user: toPublicUser(user), ...tokens });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(401).send({ error: err.message });
      }
      throw err;
    }
  });

  fastify.post("/auth/refresh", async (request, reply) => {
    const parsed = RefreshRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    try {
      // Verify against the token in the request body, not the Authorization header.
      const namespacedJwt = fastify.jwt as unknown as NamespacedJwt;
      const payload = namespacedJwt.refresh.verify<{ sub: string }>(parsed.data.refreshToken);
      const user = await getUserById(payload.sub);
      if (!user) {
        return reply.code(401).send({ error: "Invalid refresh token" });
      }

      const tokens = await issueTokens(reply, user);
      return reply.send(tokens);
    } catch {
      return reply.code(401).send({ error: "Invalid or expired refresh token" });
    }
  });

  fastify.post("/auth/otp/send", async (request, reply) => {
    const parsed = SendOtpRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }
    try {
      await sendOtp(parsed.data.phoneNumber);
      return reply.send({ sent: true });
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  fastify.post("/auth/otp/verify", async (request, reply) => {
    const parsed = VerifyOtpRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }
    try {
      const user = await verifyOtpAndSignIn(parsed.data.phoneNumber, parsed.data.code, parsed.data.country);
      const tokens = await issueTokens(reply, user);
      return reply.send({ user: toPublicUser(user), ...tokens });
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  fastify.post("/auth/google", async (request, reply) => {
    const parsed = SocialSignInRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }
    try {
      const user = await socialSignIn("google", parsed.data.idToken, parsed.data.country);
      const tokens = await issueTokens(reply, user);
      return reply.send({ user: toPublicUser(user), ...tokens });
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  fastify.post("/auth/apple", async (request, reply) => {
    const parsed = SocialSignInRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }
    try {
      const user = await socialSignIn("apple", parsed.data.idToken, parsed.data.country);
      const tokens = await issueTokens(reply, user);
      return reply.send({ user: toPublicUser(user), ...tokens });
    } catch (err) {
      if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  fastify.get("/auth/me", { preHandler: fastify.authenticate }, async (request, reply) => {
    if (!request.currentUser) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    const user = await getUserById(request.currentUser.sub);
    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }
    return reply.send({ user: toPublicUser(user) });
  });

  fastify.delete("/auth/account", { preHandler: fastify.authenticate }, async (request, reply) => {
    await deleteAccount(request.currentUser!.sub);
    return reply.send({ deleted: true });
  });
}
