import type { LinkedBankAccount as PrismaLinkedBankAccount } from "@prisma/client";
import type { LinkedBankAccount } from "@thrifty/shared";

export function toPublicLinkedAccount(account: PrismaLinkedBankAccount): LinkedBankAccount {
  return {
    id: account.id,
    institutionName: account.institutionName,
    lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
  };
}
