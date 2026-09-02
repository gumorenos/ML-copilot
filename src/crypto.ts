import { base64UrlToBytes, bytesToBase64Url } from "./encoding.ts";
import type { EncryptedCredential, OAuthTokens } from "./types.ts";

export async function importEncryptionKey(secret: string): Promise<CryptoKey> {
  const bytes = base64UrlToBytes(secret);
  if (bytes.byteLength !== 32) throw new Error("ML_ENCRYPTION_KEY must be a base64url-encoded 256-bit key");
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export function generateEncryptionSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function encryptTokens(tokens: OAuthTokens, key: CryptoKey, accountId: string, keyVersion = "v1"): Promise<EncryptedCredential> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const additionalData = new TextEncoder().encode(aad(accountId, keyVersion));
  const plaintext = new TextEncoder().encode(JSON.stringify(tokens));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData }, key, plaintext);
  return { version: 1, algorithm: "AES-GCM", iv: bytesToBase64Url(iv), ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)), keyVersion };
}

export async function decryptTokens(encrypted: EncryptedCredential, key: CryptoKey, accountId: string): Promise<OAuthTokens> {
  if (encrypted.version !== 1 || encrypted.algorithm !== "AES-GCM") throw new Error("Unsupported encrypted credential format");
  const additionalData = new TextEncoder().encode(aad(accountId, encrypted.keyVersion));
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(encrypted.iv), additionalData },
    key,
    base64UrlToBytes(encrypted.ciphertext),
  );
  const parsed: unknown = JSON.parse(new TextDecoder().decode(plaintext));
  if (!isOAuthTokens(parsed)) throw new Error("Decrypted credential has an invalid shape");
  return parsed;
}

function aad(accountId: string, keyVersion: string): string {
  return `ml-copilot:oauth-credentials:${accountId}:${keyVersion}`;
}

function isOAuthTokens(value: unknown): value is OAuthTokens {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.accessToken === "string" && typeof item.refreshToken === "string" && typeof item.tokenType === "string" && typeof item.expiresIn === "number" && typeof item.expiresAt === "number";
}
