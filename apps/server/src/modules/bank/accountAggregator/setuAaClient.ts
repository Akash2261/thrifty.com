import { AppError } from "../../../lib/errors";
import { generateAaKeyPair } from "./aaEncryption";
import type { AaKeyPair } from "./aaEncryption";

// Setu's Account Aggregator ("Bridge") product is a TSP layer over the RBI-mandated ReBIT
// Account Aggregator API — the consent/session/notification JSON shapes below follow the
// ReBIT spec (the same across every AA/TSP, since it's an interoperability framework), while the
// base URL and auth headers are Setu-specific and will need confirming against their partner
// docs once a signed FIU agreement is in place. This is written to their documented contract as
// closely as I can without live sandbox access — treat endpoint paths as the best-effort shape to
// adjust once real onboarding docs are available, not as verified-working integration code.
const DEFAULT_BASE_URL = "https://fiu-sandbox.setu.co";

function getCredentials() {
  const clientId = process.env.SETU_AA_CLIENT_ID;
  const clientSecret = process.env.SETU_AA_CLIENT_SECRET;
  const productInstanceId = process.env.SETU_AA_PRODUCT_INSTANCE_ID;
  if (!clientId || !clientSecret || !productInstanceId) {
    throw new AppError(
      "Bank linking for India isn't available yet — it needs a signed Account Aggregator FIU " +
        "agreement (e.g. with Setu) plus SETU_AA_CLIENT_ID/SECRET/PRODUCT_INSTANCE_ID configured.",
      503,
    );
  }
  const baseUrl = process.env.SETU_AA_BASE_URL || DEFAULT_BASE_URL;
  return { clientId, clientSecret, productInstanceId, baseUrl };
}

function authHeaders(creds: ReturnType<typeof getCredentials>) {
  return {
    "x-client-id": creds.clientId,
    "x-client-secret": creds.clientSecret,
    "x-product-instance-id": creds.productInstanceId,
    "Content-Type": "application/json",
  };
}

export interface ConsentRequestParams {
  consentHandle: string;
  purposeCode: string;
  purposeText: string;
  fetchType: "ONETIME" | "PERIODIC";
  fiTypes: string[];
  consentExpiry: Date;
  dataRangeFrom: Date;
  dataRangeTo: Date;
  redirectUrl: string;
}

export interface ConsentRequestResult {
  approvalUrl: string;
}

// Creates a ConsentRequest per the ReBIT spec — the AA responds with a URL to redirect the user
// to (their own consent-approval UI/app, where they pick their FIP/bank and approve specific
// accounts). We supply our own `consentHandle` so we can recognize the eventual
// Consent-Notification webhook without depending on anything the AA hasn't told us yet.
export async function createConsentRequest(params: ConsentRequestParams): Promise<ConsentRequestResult> {
  const creds = getCredentials();

  const response = await fetch(`${creds.baseUrl}/consents`, {
    method: "POST",
    headers: authHeaders(creds),
    body: JSON.stringify({
      consentHandle: params.consentHandle,
      consentMode: "STORE",
      fetchType: params.fetchType,
      consentTypes: ["PROFILE", "SUMMARY", "TRANSACTIONS"],
      fiTypes: params.fiTypes,
      purpose: { code: params.purposeCode, text: params.purposeText, refUri: "https://api.rebit.org.in/aa/purpose/101.xml" },
      fiDataRange: { from: params.dataRangeFrom.toISOString(), to: params.dataRangeTo.toISOString() },
      dataLife: { unit: "MONTH", value: 12 },
      frequency: { unit: "MONTH", value: 1 },
      consentExpiry: params.consentExpiry.toISOString(),
      redirectUrl: params.redirectUrl,
    }),
  });

  if (!response.ok) {
    console.error("Setu createConsentRequest failed", await response.text());
    throw new AppError("Couldn't start the bank-linking consent flow. Try again.", 502);
  }

  const data = (await response.json()) as { url: string };
  return { approvalUrl: data.url };
}

export interface FiDataSessionResult {
  sessionId: string;
  fiuKeyPair: AaKeyPair;
}

// Once a consent is ACTIVE, this starts the actual data pull — the AA fetches the user's
// transaction history from their FIP(s) asynchronously and notifies us via the Data-Notification
// webhook when it's ready (see accountAggregatorProvider.ts). We supply our own ephemeral X25519
// public key + nonce here so the AA can derive the same shared encryption key we do.
export async function createFiDataSession(consentId: string, dataRangeFrom: Date, dataRangeTo: Date): Promise<FiDataSessionResult> {
  const creds = getCredentials();
  const fiuKeyPair = generateAaKeyPair();

  const response = await fetch(`${creds.baseUrl}/sessions`, {
    method: "POST",
    headers: authHeaders(creds),
    body: JSON.stringify({
      consentId,
      format: "json",
      fiDataRange: { from: dataRangeFrom.toISOString(), to: dataRangeTo.toISOString() },
      keyMaterial: {
        cryptoAlg: "ECDH",
        curve: "Curve25519",
        params: { publicKey: fiuKeyPair.publicKeyBase64, nonce: fiuKeyPair.nonceBase64 },
      },
    }),
  });

  if (!response.ok) {
    console.error("Setu createFiDataSession failed", await response.text());
    throw new AppError("Couldn't start fetching your bank data. Try again.", 502);
  }

  const data = (await response.json()) as { id: string };
  return { sessionId: data.id, fiuKeyPair };
}

export interface FiAccountEntry {
  fipId: string;
  linkRefNumber: string;
  maskedAccountNumber: string;
  encryptedData: string;
}

export interface FiSessionData {
  status: "COMPLETED" | "FAILED" | "PENDING";
  aaPublicKeyBase64: string;
  aaNonceBase64: string;
  accounts: FiAccountEntry[];
}

// Fetches the completed session — the actual FI data comes back per-account, still encrypted
// (that's what aaEncryption.ts's decryptFiData is for), alongside the AA's half of the ECDH
// handshake (its public key + nonce) needed to derive the shared key.
export async function fetchFiDataSession(sessionId: string): Promise<FiSessionData> {
  const creds = getCredentials();

  const response = await fetch(`${creds.baseUrl}/sessions/${sessionId}`, {
    headers: authHeaders(creds),
  });

  if (!response.ok) {
    console.error("Setu fetchFiDataSession failed", await response.text());
    throw new AppError("Couldn't fetch your bank data. Try again.", 502);
  }

  const data = (await response.json()) as {
    status: "COMPLETED" | "FAILED" | "PENDING";
    keyMaterial: { params: { publicKey: string; nonce: string } };
    fips: { fipId: string; accounts: { linkRefNumber: string; maskedAccNumber: string; data: string }[] }[];
  };

  return {
    status: data.status,
    aaPublicKeyBase64: data.keyMaterial?.params?.publicKey,
    aaNonceBase64: data.keyMaterial?.params?.nonce,
    accounts: (data.fips ?? []).flatMap((fip) =>
      fip.accounts.map((account) => ({
        fipId: fip.fipId,
        linkRefNumber: account.linkRefNumber,
        maskedAccountNumber: account.maskedAccNumber,
        encryptedData: account.data,
      })),
    ),
  };
}
