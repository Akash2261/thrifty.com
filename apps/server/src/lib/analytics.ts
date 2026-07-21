import { PostHog } from "posthog-node";

let client: PostHog | null = null;

// Inert until POSTHOG_API_KEY is set.
function getClient(): PostHog | null {
  if (client) return client;
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) return null;
  client = new PostHog(apiKey, { host: process.env.POSTHOG_HOST || "https://us.i.posthog.com" });
  return client;
}

export function track(userId: string, event: string, properties?: Record<string, unknown>) {
  getClient()?.capture({ distinctId: userId, event, properties });
}
