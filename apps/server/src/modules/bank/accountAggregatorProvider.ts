import { randomUUID } from "node:crypto";
import { prisma } from "../../db/prisma";
import { AppError } from "../../lib/errors";
import type { BankDataProvider, RawTransaction } from "./bankProvider";
import { createConsentRequest, createFiDataSession, fetchFiDataSession } from "./accountAggregator/setuAaClient";
import { deriveAesKey, decryptFiData, exportPrivateKeyBase64, privateKeyFromBase64 } from "./accountAggregator/aaEncryption";

const CONSENT_VALIDITY_DAYS = 365;
const DATA_HISTORY_DAYS = 365;
const PURPOSE_CODE = "101";
const PURPOSE_TEXT = "Wealth management service — detecting recurring subscriptions from bank transactions";

interface StoredAaSessionCredentials {
  sessionId: string;
  fiuPrivateKeyBase64: string;
  fiuPublicKeyBase64: string;
  fiuNonceBase64: string;
}

// Per the ReBIT FI-data spec, a decrypted account payload is an FI-type-specific bundle — for
// DEPOSIT accounts, the transactions live under Transaction[] with an amount/type/narration/date
// per entry. Only the fields this codebase actually uses are typed here.
interface DecryptedDepositAccountData {
  Transactions?: {
    Transaction?: {
      txnId: string;
      amount: string;
      type: "CREDIT" | "DEBIT";
      narration: string;
      valueDate: string;
    }[];
  };
}

function getRedirectUrl(): string {
  const base = process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;
  return `${base}/bank/aa/redirect`;
}

export const accountAggregatorProvider: BankDataProvider = {
  async createLinkSession(userId) {
    const consentHandle = randomUUID();
    const now = new Date();
    const consentExpiry = new Date(now.getTime() + CONSENT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
    const dataRangeFrom = new Date(now.getTime() - DATA_HISTORY_DAYS * 24 * 60 * 60 * 1000);

    const { approvalUrl } = await createConsentRequest({
      consentHandle,
      purposeCode: PURPOSE_CODE,
      purposeText: PURPOSE_TEXT,
      fetchType: "PERIODIC",
      fiTypes: ["DEPOSIT"],
      consentExpiry,
      dataRangeFrom,
      dataRangeTo: now,
      redirectUrl: getRedirectUrl(),
    });

    await prisma.bankConsent.create({
      data: { userId, consentHandle, purposeCode: PURPOSE_CODE, fetchType: "PERIODIC", consentExpiry },
    });

    return { linkToken: consentHandle, hostedLinkUrl: approvalUrl };
  },

  async pollLinkSession(linkToken) {
    const consent = await prisma.bankConsent.findUnique({ where: { consentHandle: linkToken } });
    if (!consent || consent.status !== "active" || !consent.consentId) {
      return { finished: false };
    }
    return { finished: true, publicToken: consent.consentId };
  },

  // `publicToken` here is the AA-assigned consentId (see pollLinkSession above) — starts the
  // actual FI-data pull. The AA fetches from the user's bank(s) asynchronously and notifies us
  // via the Data-Notification webhook (accountAggregator.routes.ts) once ready; this just kicks
  // that off and stashes what's needed to decrypt the result whenever it arrives.
  async exchangePublicToken(publicToken) {
    const consent = await prisma.bankConsent.findFirst({ where: { consentId: publicToken } });
    if (!consent) {
      throw new AppError("That consent could not be found.", 404);
    }

    const now = new Date();
    const dataRangeFrom = new Date(now.getTime() - DATA_HISTORY_DAYS * 24 * 60 * 60 * 1000);
    const { sessionId, fiuKeyPair } = await createFiDataSession(publicToken, dataRangeFrom, now);

    const credentials: StoredAaSessionCredentials = {
      sessionId,
      fiuPrivateKeyBase64: exportPrivateKeyBase64(fiuKeyPair.privateKey),
      fiuPublicKeyBase64: fiuKeyPair.publicKeyBase64,
      fiuNonceBase64: fiuKeyPair.nonceBase64,
    };

    return {
      accessToken: JSON.stringify(credentials),
      providerItemId: sessionId,
      institutionName: "India Accounts (Account Aggregator)",
      aaSessionId: sessionId,
      bankConsentId: consent.id,
    };
  },

  // Called both by the manual "sync" button and (in principle) right after a Data-Notification
  // webhook confirms a session is ready — either way, the session may take a while to complete on
  // the AA's side, so a session that isn't COMPLETED yet just yields no transactions rather than
  // erroring; the user's next manual sync (or the next scheduled one) picks it up.
  async fetchTransactions(accessToken, _sinceDate): Promise<RawTransaction[]> {
    const credentials = JSON.parse(accessToken) as StoredAaSessionCredentials;
    const session = await fetchFiDataSession(credentials.sessionId);

    if (session.status !== "COMPLETED") {
      return [];
    }

    const fiuPrivateKey = privateKeyFromBase64(credentials.fiuPrivateKeyBase64, credentials.fiuPublicKeyBase64);
    const aesKey = deriveAesKey(fiuPrivateKey, session.aaPublicKeyBase64, credentials.fiuNonceBase64, session.aaNonceBase64);

    const transactions: RawTransaction[] = [];
    for (const account of session.accounts) {
      let decrypted: DecryptedDepositAccountData;
      try {
        decrypted = JSON.parse(decryptFiData(account.encryptedData, aesKey));
      } catch (err) {
        console.error("Failed to decrypt AA FI data for an account — skipping", err);
        continue;
      }

      for (const txn of decrypted.Transactions?.Transaction ?? []) {
        if (txn.type !== "DEBIT") continue; // recurring-charge detection only cares about spend
        transactions.push({
          providerTransactionId: txn.txnId,
          merchantRaw: txn.narration,
          amount: Number(txn.amount),
          currency: "INR",
          date: txn.valueDate,
        });
      }
    }

    return transactions;
  },
};

// Called by the Consent-Notification webhook when the AA reports a status change for a consent
// the user is (or was) approving in their AA's own UI.
export async function updateConsentStatus(consentHandle: string, consentId: string | null, status: string) {
  const normalizedStatus = status.toLowerCase();
  const validStatuses = ["pending", "active", "paused", "rejected", "revoked", "expired"];
  if (!validStatuses.includes(normalizedStatus)) return;

  await prisma.bankConsent
    .update({
      where: { consentHandle },
      data: { consentId: consentId ?? undefined, status: normalizedStatus as any },
    })
    .catch((err) => {
      console.error(`Consent-Notification for unknown consentHandle ${consentHandle}`, err);
    });
}

// Called by the Data-Notification webhook — just a "your data is ready" ping; the actual
// decrypt-and-parse work happens in fetchTransactions above (via the ordinary bank-sync path)
// so there's nothing to persist here beyond acknowledging receipt in the logs.
export async function handleDataNotification(sessionId: string, status: string) {
  console.log(`AA Data-Notification: session ${sessionId} is ${status}`);
}
