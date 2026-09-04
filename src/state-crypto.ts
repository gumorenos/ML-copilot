import { base64UrlToBytes, bytesToBase64Url } from "./encoding.ts";

const STATE_AAD = "ml-copilot:oauth-state:v1";

export interface EncryptedStateVerifierValue {
  ciphertext: string;
  iv: string;
}

export async function encryptStateVerifier(codeVerifier: string, key: CryptoKey): Promise<EncryptedStateVerifierValue> {
  if (!codeVerifier) throw new Error("OAuth code verifier is required");
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ownedArrayBuffer(iv), additionalData: ownedArrayBuffer(new TextEncoder().encode(STATE_AAD)) },
    key,
    ownedArrayBuffer(new TextEncoder().encode(codeVerifier)),
  );
  return { ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)), iv: bytesToBase64Url(iv) };
}

export async function decryptStateVerifier(value: EncryptedStateVerifierValue, key: CryptoKey): Promise<string> {
  if (!value || typeof value.ciphertext !== "string" || typeof value.iv !== "string") throw new Error("Stored OAuth verifier has an invalid shape");
  const iv = base64UrlToBytes(value.iv);
  if (iv.byteLength !== 12) throw new Error("Stored OAuth verifier has an invalid IV");
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ownedArrayBuffer(iv), additionalData: ownedArrayBuffer(new TextEncoder().encode(STATE_AAD)) },
      key,
      ownedArrayBuffer(base64UrlToBytes(value.ciphertext)),
    );
  } catch {
    throw new Error("Stored OAuth verifier failed authentication");
  }
  const verifier = new TextDecoder().decode(plaintext);
  if (!verifier) throw new Error("Stored OAuth verifier is empty");
  return verifier;
}

function ownedArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}
