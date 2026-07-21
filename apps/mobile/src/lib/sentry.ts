import * as Sentry from "@sentry/react-native";

// Inert until EXPO_PUBLIC_SENTRY_DSN is set (Expo only inlines env vars prefixed EXPO_PUBLIC_
// into the client bundle) — same "wired but off until configured" pattern as every backend
// integration in this project.
export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, tracesSampleRate: 1.0 });
}

export { Sentry };
