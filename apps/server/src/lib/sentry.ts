import * as Sentry from "@sentry/node";

let initialized = false;

// Inert until SENTRY_DSN is set.
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, tracesSampleRate: 1.0 });
  initialized = true;
}

export function captureError(err: unknown) {
  if (initialized) Sentry.captureException(err);
}
