import { env } from "./config/env";
import { buildApp } from "./app";
import { initSentry } from "./lib/sentry";

// Vercel-specific entrypoint. Vercel's Node.js runtime auto-detects a `server.{js,ts}` (or
// `src/server.{js,ts}`) file that calls `.listen()` and captures the underlying HTTP server as a
// Vercel Function — see https://vercel.com/docs/functions/runtimes/node-js#deploy-a-node.js-server.
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

const app = buildApp();

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
