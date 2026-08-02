import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/app";
import { initSentry } from "../src/lib/sentry";

// Vercel entrypoint using the classic /api directory convention (one explicit function, routed
// to via the catch-all rewrite in vercel.json) rather than Vercel's auto-detected "captured Node
// server" convention (a `server.ts` file calling `.listen()`) — that auto-detection behaved
// unpredictably in this monorepo (misidentified a plain helper module as an invalid entrypoint),
// so this is the same Fastify app wired up the unambiguous way instead.
//
// Deliberately does NOT start node-cron or the BullMQ email-sync worker like src/index.ts does:
// Vercel Functions don't run as a single persistent process, so an in-process scheduler or a
// continuously-polling worker would not reliably fire. Scheduled jobs instead run as Vercel Cron
// Jobs hitting the /cron/* routes (see vercel.json); email-sync polling simply doesn't run on
// Vercel — leave REDIS_URL unset there rather than half-configuring a worker that won't execute.
initSentry();

if (process.env.VERCEL && process.env.STORAGE_PROVIDER !== "s3") {
  // Vercel Functions have an ephemeral, effectively read-only filesystem between invocations —
  // anything LocalDiskStorage writes is gone (or simply inaccessible) by the time it's read back,
  // so this would silently break every receipt upload rather than erroring loudly.
  console.warn(
    "[server] Running on Vercel without STORAGE_PROVIDER=s3 — uploaded receipt images will not persist.",
  );
}

// Built once at module load (not per-request, and not lazily) — reused across warm invocations of
// this function, same idea as any "reuse the DB connection across warm Lambda starts" pattern.
// Deliberately NOT lazily built inside the handler: FastifyInstance is itself thenable (it
// supports `await fastify`), which made every lazy-init variant of this fight TypeScript's
// automatic thenable-flattening in confusing ways. A plain top-level const sidesteps all of it —
// no nullable narrowing, no promise-of-a-thenable typing.
const app = buildApp();
const appReady = Promise.resolve(app.ready());

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await appReady;
  app.server.emit("request", req, res);
}
