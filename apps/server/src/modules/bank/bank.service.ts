import { prisma } from "../../db/prisma";
import { AppError } from "../../lib/errors";
import { encryptSecret, decryptSecret } from "../../lib/encryption";
import { accountAggregatorProvider as provider } from "./accountAggregatorProvider";
import { detectAndUpsertSubscriptions } from "../subscriptions/subscriptions.service";
import { normalizeMerchant } from "../subscriptions/recurringDetection";

const TRANSACTION_LOOKBACK_DAYS = 90;

export async function createLinkSession(userId: string) {
  const session = await provider.createLinkSession(userId);

  await prisma.pendingBankLink.create({
    data: { userId, linkToken: session.linkToken },
  });

  return session;
}

async function finishLink(pendingLinkId: string, userId: string, publicToken: string, fallbackInstitutionName?: string) {
  const exchanged = await provider.exchangePublicToken(publicToken);

  const account = await prisma.linkedBankAccount.create({
    data: {
      userId,
      providerItemId: exchanged.providerItemId,
      encryptedAccessToken: encryptSecret(exchanged.accessToken),
      institutionName: exchanged.institutionName ?? fallbackInstitutionName ?? null,
      aaSessionId: exchanged.aaSessionId,
      bankConsentId: exchanged.bankConsentId,
    },
  });

  await prisma.pendingBankLink.delete({ where: { id: pendingLinkId } }).catch(() => {});

  return account;
}

export async function pollLinkSession(userId: string, linkToken: string) {
  const pending = await prisma.pendingBankLink.findFirst({ where: { userId, linkToken } });
  if (!pending) {
    // Already completed (or never existed) — treat as "not linked yet" rather than an error
    // so the mobile app's polling loop doesn't need to special-case this.
    return { linked: false };
  }

  const result = await provider.pollLinkSession(linkToken);
  if (!result.finished || !result.publicToken) {
    return { linked: false };
  }

  const account = await finishLink(pending.id, userId, result.publicToken, result.institutionName);
  return { linked: true, institutionName: account.institutionName };
}

export async function listLinkedAccounts(userId: string) {
  return prisma.linkedBankAccount.findMany({ where: { userId } });
}

export async function syncAccount(userId: string, linkedAccountId: string) {
  const account = await prisma.linkedBankAccount.findFirst({ where: { id: linkedAccountId, userId } });
  if (!account) {
    throw new AppError("Linked account not found", 404);
  }

  const accessToken = decryptSecret(account.encryptedAccessToken);
  const sinceDate = new Date(Date.now() - TRANSACTION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const rawTransactions = await provider.fetchTransactions(accessToken, sinceDate);

  await prisma.transaction.createMany({
    data: rawTransactions.map((t) => ({
      linkedAccountId: account.id,
      providerTransactionId: t.providerTransactionId,
      merchantRaw: t.merchantRaw,
      merchantNormalized: normalizeMerchant(t.merchantRaw),
      amount: t.amount,
      currency: t.currency,
      date: new Date(t.date),
    })),
    skipDuplicates: true,
  });

  await prisma.linkedBankAccount.update({
    where: { id: account.id },
    data: { lastSyncedAt: new Date() },
  });

  await detectAndUpsertSubscriptions(userId);

  return { transactionsFetched: rawTransactions.length };
}

export async function syncAllAccounts(userId: string) {
  const accounts = await listLinkedAccounts(userId);
  let total = 0;
  for (const account of accounts) {
    const { transactionsFetched } = await syncAccount(userId, account.id);
    total += transactionsFetched;
  }
  return { accountsSynced: accounts.length, transactionsFetched: total };
}
