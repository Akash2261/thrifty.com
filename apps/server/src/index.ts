import cron from "node-cron";
import { env } from "./config/env";
import { buildApp } from "./app";
import { runDeadlineScan } from "./jobs/deadlineScan";
import { startEmailSyncWorker, enqueueEmailSync } from "./jobs/emailSync";
import { runSubscriptionDigest } from "./jobs/subscriptionDigest";
import { runConsentExpiryCheck } from "./jobs/consentExpiry";
import { initSentry } from "./lib/sentry";

initSentry();

async function main() {
  const app = buildApp();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });

  // Runs once a day; sends a push 3 days before a return window or warranty expires.
  cron.schedule("0 9 * * *", () => {
    runDeadlineScan().catch((err) => app.log.error(err, "Deadline scan failed"));
  });

  // Email sync needs Redis/BullMQ — stays off entirely when REDIS_URL isn't configured rather
  // than erroring on every tick.
  if (process.env.REDIS_URL) {
    startEmailSyncWorker();
    cron.schedule("0 */4 * * *", () => {
      enqueueEmailSync().catch((err) => app.log.error(err, "Failed to enqueue email sync"));
    });
  }

  // Runs at 9am on the 1st of each month — subscription spend summary + unused-subscription nudge.
  cron.schedule("0 9 1 * *", () => {
    runSubscriptionDigest().catch((err) => app.log.error(err, "Subscription digest failed"));
  });

  // Runs daily — flips any Account Aggregator consent past its expiry to "expired".
  cron.schedule("30 9 * * *", () => {
    runConsentExpiryCheck().catch((err) => app.log.error(err, "Consent expiry check failed"));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
