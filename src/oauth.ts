import { base64UrlToBytes, bytesToBase64Url, randomBase64Url } from "./encoding.ts";
import type { OAuthStateRecord, OAuthStateStore } from "./types.ts";

const AUTHORIZATION_HOSTS: Record<string, string> = { MPE: "auth.mercadolibre.com.pe" };

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export interface OAuthTransaction {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  expiresAt: number;
}

export class MemoryOAuthStateStore implements OAuthStateStore {
  private readonly records = new Map<string, OAuthStateRecord>();

  async put(record: OAuthStateRecord): Promise<void> {
    this.records.set(record.stateHash, { ...record });
  }

  async consume(stateHash: string, now: number): Promise<string | null> {
    const record = this.records.get(stateHash);
    if (!record || record.consumedAt !== undefined || record.expiresAt <= now) return null;
    record.consumedAt = now;
    return record.codeVerifier;
  }
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function createPkcePair(): Promise<PkcePair> {
  const verifier = randomBase64Url(32);
  return { verifier, challenge: await sha256Base64Url(verifier) };
}

export async function createOAuthTransaction(store: OAuthStateStore, now = Date.now(), ttlMs = 10 * 60 * 1000): Promise<OAuthTransaction> {
  if (!Number.isFinite(now) || !Number.isInteger(now)) throw new Error("OAuth transaction time must be an integer timestamp");
  if (!Number.isFinite(ttlMs) || !Number.isInteger(ttlMs) || ttlMs <= 0) throw new Error("OAuth transaction TTL must be a positive integer");
  const state = randomBase64Url(32);
  const pkce = await createPkcePair();
  const expiresAt = now + ttlMs;
  await store.put({ stateHash: await sha256Base64Url(state), codeVerifier: pkce.verifier, expiresAt });
  return { state, codeVerifier: pkce.verifier, codeChallenge: pkce.challenge, expiresAt };
}

export async function consumeOAuthState(store: OAuthStateStore, state: string, now = Date.now()): Promise<string> {
  if (!state) throw new Error("Invalid, expired, or already-consumed OAuth state");
  const verifier = await store.consume(await sha256Base64Url(state), now);
  if (!verifier) throw new Error("Invalid, expired, or already-consumed OAuth state");
  return verifier;
}

export function buildAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  siteId?: "MPE";
  scope?: string;
}): string {
  if (!input.clientId || !input.redirectUri || !input.state || !input.codeChallenge) throw new Error("OAuth URL requires client, redirect, state, and PKCE challenge");
  assertHttpsRedirectUri(input.redirectUri);
  const host = AUTHORIZATION_HOSTS[input.siteId ?? "MPE"];
  const url = new URL(`https://${host}/authorization`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("scope", input.scope ?? "offline_access read");
  return url.toString();
}

export function assertHttpsRedirectUri(redirectUri: string): void {
  const url = new URL(redirectUri);
  if (url.protocol !== "https:") throw new Error("Mercado Libre redirect URI must use HTTPS");
  if (url.hash) throw new Error("Mercado Libre redirect URI must not contain a fragment");
}

export function decodeStateForDiagnostics(value: string): Uint8Array {
  return base64UrlToBytes(value);
}
