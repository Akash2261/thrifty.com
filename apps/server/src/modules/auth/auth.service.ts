import { prisma } from "../../db/prisma";
import { hashPassword, verifyPassword } from "../../lib/password";
import { deleteReceiptImage } from "../../lib/receiptStorage";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function createUser(
  email: string,
  password: string,
  name: string,
  phoneNumber: string,
  dateOfBirth: string,
) {
  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { phoneNumber }] } });
  if (existing) {
    throw new AuthError(
      existing.email === email ? "An account with this email already exists" : "An account with this phone number already exists",
    );
  }

  const passwordHash = await hashPassword(password);
  return prisma.user.create({
    data: { email, passwordHash, name, phoneNumber, dateOfBirth: new Date(dateOfBirth) },
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
export async function deleteAccount(userId: string) {
  // Collect receipt image keys before the cascading delete below removes the WarrantyItem rows
  // that reference them — this is the only place those keys exist.
  const itemsWithImages = await prisma.warrantyItem.findMany({
    where: { userId, sourceImageUrl: { not: null } },
    select: { sourceImageUrl: true },
  });

  const membership = await prisma.householdMember.findFirst({ where: { userId } });
  if (membership?.role === "owner") {
    // Dissolve the household for every member rather than leave it ownerless — same behavior as
    // household.service.ts's leaveHousehold when the owner is the one leaving.
    await prisma.household.delete({ where: { id: membership.householdId } });
  }

  await prisma.user.delete({ where: { id: userId } });

  // Best-effort, and after the DB delete has already succeeded: a storage hiccup here shouldn't
  // leave the account half-deleted, and one image's failure shouldn't block the rest.
  await Promise.all(
    itemsWithImages.map(({ sourceImageUrl }) =>
      deleteReceiptImage(sourceImageUrl!).catch((err) =>
        console.error(`Failed to delete receipt image ${sourceImageUrl} during account deletion`, err),
      ),
    ),
  );
}
