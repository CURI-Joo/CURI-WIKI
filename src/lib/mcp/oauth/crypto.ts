import crypto from "node:crypto";

export const base64url = (buf: Buffer): string =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const randomToken = (bytes = 32): string => base64url(crypto.randomBytes(bytes));

/** Tokens and codes are stored as SHA-256 hashes, never in plaintext. */
export const hashToken = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex");

export function verifyPkce(verifier: string, challenge: string, method = "S256"): boolean {
  if (!verifier || !challenge) return false;
  if (method !== "S256") return false; // plain is rejected: OAuth 2.1 requires S256
  const computed = base64url(crypto.createHash("sha256").update(verifier).digest());
  return timingSafeEqual(computed, challenge);
}

export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export const nowSeconds = (): number => Math.floor(Date.now() / 1000);
