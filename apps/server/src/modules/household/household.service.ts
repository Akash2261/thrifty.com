import { randomBytes } from "node:crypto";
import { prisma } from "../../db/prisma";
import { AppError } from "../../lib/errors";

function generateInviteCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function createHousehold(userId: string, name: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.householdId) {
    throw new AppError("You're already part of a household. Leave it first.", 400);
  }

  const household = await prisma.household.create({
    data: {
      name,
      createdBy: userId,
      inviteCode: generateInviteCode(),
      members: { create: { userId, role: "owner" } },
    },
  });

  await prisma.user.update({ where: { id: userId }, data: { householdId: household.id } });
  return household;
}

export async function joinHousehold(userId: string, inviteCode: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.householdId) {
    throw new AppError("You're already part of a household. Leave it first.", 400);
  }

  const household = await prisma.household.findUnique({ where: { inviteCode } });
  if (!household) {
    throw new AppError("That invite code isn't valid.", 404);
  }

  await prisma.householdMember.create({ data: { householdId: household.id, userId, role: "member" } });
  await prisma.user.update({ where: { id: userId }, data: { householdId: household.id } });
  return household;
}

export async function leaveHousehold(userId: string) {
  const membership = await prisma.householdMember.findFirst({ where: { userId } });
  if (!membership) {
    throw new AppError("You're not part of a household.", 400);
  }

  if (membership.role === "owner") {
    // No ownership-transfer flow yet — the owner leaving dissolves the household for everyone.
    // HouseholdMember rows cascade-delete and each member's User.householdId is cleared via
    // onDelete: SetNull on that relation.
    await prisma.household.delete({ where: { id: membership.householdId } });
  } else {
    await prisma.householdMember.delete({ where: { id: membership.id } });
    await prisma.user.update({ where: { id: userId }, data: { householdId: null } });
  }
}

export async function getHouseholdInfo(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.householdId) {
    return null;
  }

  const household = await prisma.household.findUnique({
    where: { id: user.householdId },
    include: { members: { include: { user: true } } },
  });
  return household;
}

export async function listSharedItems(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.householdId) {
    return { warrantyItems: [], subscriptions: [] };
  }

  const otherMembers = await prisma.householdMember.findMany({
    where: { householdId: user.householdId, userId: { not: userId } },
    include: { user: true },
  });
  const otherUserIds = otherMembers.map((m) => m.userId);
  const emailByUserId = new Map(otherMembers.map((m) => [m.userId, m.user.email]));

  if (otherUserIds.length === 0) {
    return { warrantyItems: [], subscriptions: [] };
  }

  const [warrantyItems, subscriptions] = await Promise.all([
    prisma.warrantyItem.findMany({ where: { userId: { in: otherUserIds } } }),
    prisma.detectedSubscription.findMany({ where: { userId: { in: otherUserIds }, status: { not: "cancelled" } } }),
  ]);

  return {
    warrantyItems: warrantyItems.map((item) => ({
      id: item.id,
      itemName: item.itemName,
      ownerEmail: emailByUserId.get(item.userId) ?? null,
      returnWindowEndsAt: item.returnWindowEndsAt?.toISOString() ?? null,
      warrantyEndsAt: item.warrantyEndsAt?.toISOString() ?? null,
    })),
    subscriptions: subscriptions.map((sub) => ({
      id: sub.id,
      displayName: sub.displayName,
      ownerEmail: emailByUserId.get(sub.userId) ?? null,
      avgAmount: sub.avgAmount,
      currency: sub.currency,
    })),
  };
}
