import { authorizedRequest } from "./authClient";

export function createCheckoutSession() {
  return authorizedRequest<{ checkoutUrl: string }>("/billing/checkout", { method: "POST" });
}
