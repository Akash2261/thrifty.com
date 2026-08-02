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

// Built once per warm function instance (not per-request) — Fastify's own router handles every
// request from there via the raw http.Server it wraps internally.
let appPromise: Promise<ReturnType<typeof buildApp>> | null = null;

function getApp() {
  if (!appPromise) {
    const app = buildApp();
    // .ready() returns a thenable (FastifyInstance & PromiseLike<...>), not a strict Promise, and
    // PromiseLike#then() only returns another PromiseLike -- Promise.resolve(...) here normalizes
    // the whole chain to a real Promise so the declared Promise<FastifyInstance> type holds.
    appPromise = Promise.resolve(app.ready()).then(() => app);
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  app.server.emit("request", req, res);
}
