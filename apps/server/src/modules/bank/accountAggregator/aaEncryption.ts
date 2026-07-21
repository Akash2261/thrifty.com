import { createCipheriv, createDecipheriv, createPrivateKey, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, randomBytes, type KeyObject } from "node:crypto";

// India's Account Aggregator framework encrypts FI data end-to-end between the AA and the FIU
// (us) using ECDH key agreement over Curve25519, per the RBI-mandated ReBIT technical
// specification (api.rebit.org.in) — this is a public, TSP-agnostic crypto spec (every AA/FIU
// implements the same handshake), unlike the REST endpoint shapes in setuAaClient.ts which are
// specific to Setu as our chosen TSP and need confirming against their partner docs.
//
// Handshake: both sides generate an ephemeral X25519 keypair and a nonce for this session. Each
// computes the same shared secret via ECDH(myPrivateKey, theirPublicKey); the derived key never
// crosses the wire. An AES-256-GCM key is then derived from that shared secret via HKDF-SHA256,
// salted with both nonces concatenated (FIU nonce || AA nonce) so a compromised shared secret
// from one session can't be replayed against another.

const AES_KEY_LENGTH = 32;
const GCM_IV_LENGTH = 12;
const GCM_AUTH_TAG_LENGTH = 16;

export interface AaKeyPair {
  publicKeyBase64: string;
  nonceBase64: string;
  privateKey: KeyObject;
}

// Raw X25519 keys are 32 bytes — exporting as JWK and reading the `x`/`d` fields is the
// straightforward way to get raw bytes out of a Node KeyObject (no ASN.1/DER wrapping to strip).
export function generateAaKeyPair(): AaKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("x25519");
  const jwk = publicKey.export({ format: "jwk" }) as { x: string };
  return {
    publicKeyBase64: Buffer.from(jwk.x, "base64url").toString("base64"),
    nonceBase64: randomBytes(32).toString("base64"),
    privateKey,
  };
}

// The FIU (Data-Notification) side of this handshake is asynchronous — we generate our ephemeral
// keypair when creating the FI-data session, but the matching decryption only happens later once
// the AA's notification arrives, potentially in a different process. These let the private key
// survive that round trip (encrypted at rest via lib/encryption.ts, same as any other credential).
export function exportPrivateKeyBase64(privateKey: KeyObject): string {
  const jwk = privateKey.export({ format: "jwk" }) as { d: string };
  return Buffer.from(jwk.d, "base64url").toString("base64");
}

// Node's JWK import for OKP private keys requires the public component (`x`) alongside `d`, even
// though `d` alone mathematically determines it — so the matching public key has to travel with
// the stored private key too.
export function privateKeyFromBase64(privateKeyBase64: string, publicKeyBase64: string): KeyObject {
  const d = Buffer.from(privateKeyBase64, "base64").toString("base64url");
  const x = Buffer.from(publicKeyBase64, "base64").toString("base64url");
  return createPrivateKey({ key: { kty: "OKP", crv: "X25519", d, x }, format: "jwk" });
}

function publicKeyFromBase64(publicKeyBase64: string): KeyObject {
  const x = Buffer.from(publicKeyBase64, "base64").toString("base64url");
  return createPublicKey({ key: { kty: "OKP", crv: "X25519", x }, format: "jwk" });
}

// Derives the shared AES-256 key both sides will independently arrive at.
export function deriveAesKey(
  myPrivateKey: KeyObject,
  theirPublicKeyBase64: string,
  myNonceBase64: string,
  theirNonceBase64: string,
): Buffer {
  const theirPublicKey = publicKeyFromBase64(theirPublicKeyBase64);
  const sharedSecret = diffieHellman({ privateKey: myPrivateKey, publicKey: theirPublicKey });
  const salt = Buffer.concat([Buffer.from(myNonceBase64, "base64"), Buffer.from(theirNonceBase64, "base64")]);
  const derived = hkdfSync("sha256", sharedSecret, salt, Buffer.alloc(0), AES_KEY_LENGTH);
  return Buffer.from(derived);
}

// FI data arrives as base64(iv || ciphertext || authTag) — this convention (12-byte IV prefix,
// 16-byte GCM tag suffix) is what encryptFiData below produces too, so the round-trip test in
// aaEncryption.test.ts exercises the exact same framing this function expects from a real AA.
export function decryptFiData(encryptedBase64: string, aesKey: Buffer): string {
  const payload = Buffer.from(encryptedBase64, "base64");
  const iv = payload.subarray(0, GCM_IV_LENGTH);
  const authTag = payload.subarray(payload.length - GCM_AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(GCM_IV_LENGTH, payload.length - GCM_AUTH_TAG_LENGTH);

  const decipher = createDecipheriv("aes-256-gcm", aesKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

// Only used by the unit test (there's no real AA to encrypt against in this environment) — proves
// decryptFiData correctly reverses this module's own framing/derivation, which is the strongest
// verification available without a live Setu sandbox session.
export function encryptFiData(plaintext: string, aesKey: Buffer): string {
  const iv = randomBytes(GCM_IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]).toString("base64");
}
