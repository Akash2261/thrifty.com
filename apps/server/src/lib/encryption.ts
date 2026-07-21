import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { AppError } from "./errors";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new AppError(
      "Secure token storage isn't set up yet on the server (missing ENCRYPTION_KEY).",
      503,
    );
  }
  // Derives a fixed-length key from whatever string secret is configured, so operators can
  // set ENCRYPTION_KEY to any sufficiently random string rather than a precise byte length.
  return scryptSync(secret, "thrifty-access-token", 32);
}

// Encrypts access tokens (Account Aggregator bank tokens, Gmail/Outlook OAuth tokens) before they're
// stored — these grant read access to a user's bank or email data, so they're treated like the
// credential they effectively are.
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const [ivB64, authTagB64, dataB64] = payload.split(".");
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new AppError("Corrupt stored credential", 500);
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
