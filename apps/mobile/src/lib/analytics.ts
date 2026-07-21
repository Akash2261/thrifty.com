import PostHog from "posthog-react-native";

let client: PostHog | null = null;

// Inert until EXPO_PUBLIC_POSTHOG_API_KEY is set.
export function initAnalytics() {
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  if (!apiKey) return;
  client = new PostHog(apiKey, { host: process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com" });
}

type EventProperties = Record<string, string | number | boolean | null>;

export function track(event: string, properties?: EventProperties) {
  client?.capture(event, properties);
}

export function identify(userId: string) {
  client?.identify(userId);
}

export function reset() {
  client?.reset();
}
