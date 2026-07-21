import { prisma } from "../../db/prisma";
import { hashPassword, verifyPassword } from "../../lib/password";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function createUser(email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AuthError("An account with this email already exists");
  }

  const passwordHash = await hashPassword(password);
  return prisma.user.create({
    data: { email, passwordHash },
  });
}

export async function verifyCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    throw new AuthError("Invalid email or password");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new AuthError("Invalid email or password");
  }

  return user;
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

// Google Play (and Apple) require apps that support account creation to also support in-app
// account deletion. Every user-owned row cascades on delete (see the `onDelete: Cascade`
// relations throughout schema.prisma) — receipts, subscriptions, bank/email/WhatsApp
// connections, claims, notifications, etc. all go with it automatically.
//
// Known gap: uploaded receipt images on local disk/S3 are NOT cleaned up here — StorageProvider
// doesn't have a delete method yet. Tracked in LAUNCH_CHECKLIST.md rather than silently ignored.
export async function deleteAccount(userId: string) {
  const membership = await prisma.householdMember.findFirst({ where: { userId } });
  if (membership?.role === "owner") {
    // Dissolve the household for every member rather than leave it ownerless — same behavior as
    // household.service.ts's leaveHousehold when the owner is the one leaving.
    await prisma.household.delete({ where: { id: membership.householdId } });
  }

  await prisma.user.delete({ where: { id: userId } });
}
