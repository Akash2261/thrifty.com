import { describe, expect, it } from "vitest";
import {
  decryptFiData,
  deriveAesKey,
  encryptFiData,
  exportPrivateKeyBase64,
  generateAaKeyPair,
  privateKeyFromBase64,
} from "./aaEncryption";

describe("aaEncryption", () => {
  it("derives the same AES key on both sides of an ECDH handshake", () => {
    const fiu = generateAaKeyPair();
    const aa = generateAaKeyPair();

    const fiuDerivedKey = deriveAesKey(fiu.privateKey, aa.publicKeyBase64, fiu.nonceBase64, aa.nonceBase64);
    const aaDerivedKey = deriveAesKey(aa.privateKey, fiu.publicKeyBase64, fiu.nonceBase64, aa.nonceBase64);

    expect(fiuDerivedKey.equals(aaDerivedKey)).toBe(true);
  });

  it("round-trips FI data through encrypt/decrypt using the derived key", () => {
    const fiu = generateAaKeyPair();
    const aa = generateAaKeyPair();
    const aesKey = deriveAesKey(fiu.privateKey, aa.publicKeyBase64, fiu.nonceBase64, aa.nonceBase64);

    const plaintext = JSON.stringify({ transactions: [{ amount: 499, type: "DEBIT", narration: "NETFLIX.COM" }] });
    const encrypted = encryptFiData(plaintext, aesKey);
    const decrypted = decryptFiData(encrypted, aesKey);

    expect(decrypted).toBe(plaintext);
    expect(JSON.parse(decrypted).transactions[0].narration).toBe("NETFLIX.COM");
  });

  it("survives exporting/reimporting the private key across a process boundary (webhook round trip)", () => {
    const fiu = generateAaKeyPair();
    const aa = generateAaKeyPair();

    // Simulates persisting the FIU private key when the session is created, then reloading it
    // later when the Data-Notification webhook actually arrives.
    const storedPrivateKeyBase64 = exportPrivateKeyBase64(fiu.privateKey);
    const reimportedPrivateKey = privateKeyFromBase64(storedPrivateKeyBase64, fiu.publicKeyBase64);

    const keyBeforeExport = deriveAesKey(fiu.privateKey, aa.publicKeyBase64, fiu.nonceBase64, aa.nonceBase64);
    const keyAfterReimport = deriveAesKey(reimportedPrivateKey, aa.publicKeyBase64, fiu.nonceBase64, aa.nonceBase64);

    expect(keyBeforeExport.equals(keyAfterReimport)).toBe(true);
  });

  it("fails to decrypt with the wrong key (tampered/mismatched session)", () => {
    const fiu = generateAaKeyPair();
    const aa = generateAaKeyPair();
    const wrongAa = generateAaKeyPair();

    const correctKey = deriveAesKey(fiu.privateKey, aa.publicKeyBase64, fiu.nonceBase64, aa.nonceBase64);
    const wrongKey = deriveAesKey(fiu.privateKey, wrongAa.publicKeyBase64, fiu.nonceBase64, wrongAa.nonceBase64);

    const encrypted = encryptFiData("sensitive data", correctKey);
    expect(() => decryptFiData(encrypted, wrongKey)).toThrow();
  });
});
