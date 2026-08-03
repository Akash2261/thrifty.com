import type { User } from "@thrifty/shared";

export function displayIdentity(user: User | null): string {
  if (!user) return "";
  return user.email ?? user.phoneNumber ?? "there";
}
