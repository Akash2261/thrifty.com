import type { Household as PrismaHousehold, HouseholdMember as PrismaMember, User as PrismaUser } from "@prisma/client";
import type { HouseholdInfo } from "@thrifty/shared";

type HouseholdWithMembers = PrismaHousehold & { members: (PrismaMember & { user: PrismaUser })[] };

export function toPublicHousehold(household: HouseholdWithMembers): HouseholdInfo {
  return {
    id: household.id,
    name: household.name,
    inviteCode: household.inviteCode,
    members: household.members.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      role: m.role,
    })),
  };
}
