import { D1AccountStore, D1CredentialStore, D1OAuthStateStore } from "./d1-store.ts";
import type { D1DatabaseLike } from "./d1-store.ts";
import { encryptTokens, importEncryptionKey } from "./crypto.ts";
import { MercadoLibreApiError, MercadoLibreClient, MercadoLibreSchemaError } from "./meli-client.ts";
import { createOAuthTransaction, buildAuthorizationUrl, consumeOAuthState } from "./oauth.ts";
import { runReadOnlyProbe } from "./probe.ts";
import { RefreshUnavailableError, RotatingAccessTokenManager } from "./refresh.ts";
import { decryptStateVerifier, encryptStateVerifier } from "./state-crypto.ts";
import type { AccountStore, ConnectedAccount, CredentialStore, FetchLike, OAuthStateStore } from "./types.ts";

export interface Phase0Env {
  DB: D1DatabaseLike;
  ML_CLIENT_ID?: string;
  ML_CLIENT_SECRET?: string;
  ML_ENCRYPTION_KEY?: string;
  ML_REDIRECT_URI?: string;
  ML_API_BASE_URL?: string;
  PHASE0_OPERATOR_TOKEN?: string;
}

export interface Phase0Dependencies {
  fetchImpl?: FetchLike;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  maxReadRetries?: number;
  accountStore?: AccountStore;
  credentialStore?: CredentialStore;
  stateStore?: OAuthStateStore;
  encryptionKey?: CryptoKey;
}

const START_PATH = "/phase0/oauth/start";
const CALLBACK_PATH = "/phase0/oauth/callback";
const CAPABILITY_PATH = "/phase0/capability";

export type Phase0Handler = (request: Request, env: Phase0Env) => Promise<Response>;

export function createPhase0Worker(dependencies: Phase0Dependencies = {}): Phase0Handler {
  return async (request, env) => {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    if (url.pathname === CALLBACK_PATH) {
      if (method !== "GET") return methodNotAllowed("GET");
      return handleCallback(request, env, dependencies);
    }
    if (url.pathname === START_PATH) {
      if (method !== "GET") return methodNotAllowed("GET");
      const authorization = requireOperator(request, env.PHASE0_OPERATOR_TOKEN);
      if (authorization) return authorization;
      return handleStart(env, dependencies);
    }
    if (url.pathname === CAPABILITY_PATH) {
      if (method !== "GET") return methodNotAllowed("GET");
      const authorization = requireOperator(request, env.PHASE0_OPERATOR_TOKEN);
      if (authorization) return authorization;
      return handleCapability(env, dependencies);
    }
    return jsonResponse({ error: "Not found" }, 404);
  };
}

async function handleStart(env: Phase0Env, dependencies: Phase0Dependencies): Promise<Response> {
  if (!env.ML_CLIENT_ID || !env.ML_REDIRECT_URI) return jsonResponse({ error: "Phase 0 OAuth is not configured" }, 503);
  try {
    const now = dependencies.now ?? (() => Date.now());
    const stateStore = await resolveStateStore(env, dependencies, now);
    const transaction = await createOAuthTransaction(stateStore, now());
    const location = buildAuthorizationUrl({
      clientId: env.ML_CLIENT_ID,
      redirectUri: env.ML_REDIRECT_URI,
      state: transaction.state,
      codeChallenge: transaction.codeChallenge,
      siteId: "MPE",
      scope: "offline_access read",
    });
    return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });
  } catch {
    return jsonResponse({ error: "Unable to start Phase 0 OAuth" }, 503);
  }
}

async function handleCallback(request: Request, env: Phase0Env, dependencies: Phase0Dependencies): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (url.searchParams.get("error") || !state || !code) return htmlResponse("Phase 0 OAuth failed.", 400);
  if (!env.ML_CLIENT_ID || !env.ML_CLIENT_SECRET || !env.ML_REDIRECT_URI) return htmlResponse("Phase 0 OAuth is not configured.", 503);
  const now = dependencies.now ?? (() => Date.now());
  try {
    const stateStore = await resolveStateStore(env, dependencies, now);
    const codeVerifier = await consumeOAuthState(stateStore, state, now());
    const client = createClient(env, dependencies);
    const tokens = await client.exchangeCode({
      clientId: env.ML_CLIENT_ID,
      clientSecret: env.ML_CLIENT_SECRET,
      code,
      redirectUri: env.ML_REDIRECT_URI,
      codeVerifier,
    });
    const user = await client.getMe(tokens.accessToken);
    if (user.siteId !== "MPE") return htmlResponse("The connected account is not a Mercado Libre Peru account.", 400);
    const encryptionKey = await resolveEncryptionKey(env, dependencies);
    const accountId = `meli:${user.id}`;
    const account: ConnectedAccount = {
      accountId,
      mlUserId: user.id,
      siteId: user.siteId,
      tags: user.tags,
      ...(user.status !== undefined ? { status: user.status } : {}),
      connectionStatus: "connected",
      connectedAt: new Date(now()).toISOString(),
      lastVerifiedAt: new Date(now()).toISOString(),
    };
    const accountStore = dependencies.accountStore ?? new D1AccountStore(env.DB);
    const credentialStore = dependencies.credentialStore ?? new D1CredentialStore(env.DB);
    if (!credentialStore.putInitial) return htmlResponse("Phase 0 credential storage is not configured.", 503);
    const encrypted = await encryptTokens(tokens, encryptionKey, accountId);
    await accountStore.saveConnected(account);
    await credentialStore.putInitial(accountId, encrypted, tokens.expiresAt, now());
    return htmlResponse("Phase 0 connection succeeded. Use the protected capability probe to verify read-only seller access.", 200);
  } catch (error) {
    return callbackErrorResponse(error);
  }
}

async function handleCapability(env: Phase0Env, dependencies: Phase0Dependencies): Promise<Response> {
  const now = dependencies.now ?? (() => Date.now());
  try {
    const accountStore = dependencies.accountStore ?? new D1AccountStore(env.DB);
    const credentialStore = dependencies.credentialStore ?? new D1CredentialStore(env.DB);
    const account = await accountStore.getConnected();
    if (!account) return jsonResponse({ error: "No connected Mercado Libre account" }, 404);
    const credential = await credentialStore.get(account.accountId);
    if (!credential) return jsonResponse({ error: "Connected account credentials are unavailable" }, 409);
    const encryptionKey = await resolveEncryptionKey(env, dependencies);
    if (!env.ML_CLIENT_ID || !env.ML_CLIENT_SECRET) return jsonResponse({ error: "Phase 0 OAuth is not configured" }, 503);
    const client = createClient(env, dependencies);
    const tokenManager = new RotatingAccessTokenManager({
      accountId: account.accountId,
      store: credentialStore,
      encryptionKey,
      now,
      refreshClient: { refresh: (refreshToken) => client.refresh(refreshToken, env.ML_CLIENT_ID!, env.ML_CLIENT_SECRET!) },
    });
    const accessToken = await tokenManager.getAccessToken();
    const report = await runReadOnlyProbe(client, accessToken, now(), 5);
    await accountStore.saveConnected({ ...account, tags: report.account.tags, ...(report.account.status !== undefined ? { status: report.account.status } : {}), lastVerifiedAt: report.checkedAt });
    return jsonResponse(report, 200);
  } catch (error) {
    return capabilityErrorResponse(error);
  }
}

function createClient(env: Phase0Env, dependencies: Phase0Dependencies): MercadoLibreClient {
  return new MercadoLibreClient({
    apiBaseUrl: env.ML_API_BASE_URL,
    fetchImpl: dependencies.fetchImpl,
    sleep: dependencies.sleep,
    maxReadRetries: dependencies.maxReadRetries,
  });
}

async function resolveEncryptionKey(env: Phase0Env, dependencies: Phase0Dependencies): Promise<CryptoKey> {
  if (dependencies.encryptionKey) return dependencies.encryptionKey;
  if (!env.ML_ENCRYPTION_KEY) throw new Error("ML_ENCRYPTION_KEY is not configured");
  return importEncryptionKey(env.ML_ENCRYPTION_KEY);
}

async function resolveStateStore(env: Phase0Env, dependencies: Phase0Dependencies, now: () => number): Promise<OAuthStateStore> {
  if (dependencies.stateStore) return dependencies.stateStore;
  const key = await resolveEncryptionKey(env, dependencies);
  return new D1OAuthStateStore(env.DB, {
    encrypt: (codeVerifier) => encryptStateVerifier(codeVerifier, key),
    decrypt: (value) => decryptStateVerifier(value, key),
  }, CAPABILITY_PATH, now);
}

function requireOperator(request: Request, configuredToken: string | undefined): Response | null {
  if (!configuredToken) return jsonResponse({ error: "Phase 0 operator access is not configured" }, 503);
  const authorization = request.headers.get("Authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  const presented = request.headers.get("X-Phase0-Operator-Token") ?? bearer;
  if (!presented || !constantTimeEqual(presented, configuredToken)) return jsonResponse({ error: "Unauthorized" }, 401);
  return null;
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  return difference === 0;
}

function callbackErrorResponse(error: unknown): Response {
  if (error instanceof MercadoLibreApiError) return htmlResponse("Mercado Libre authorization could not be completed.", 502);
  if (error instanceof MercadoLibreSchemaError) return htmlResponse("Mercado Libre returned an unexpected response.", 502);
  if (error instanceof Error && /Invalid, expired, or already-consumed OAuth state/.test(error.message)) return htmlResponse("Phase 0 OAuth state is invalid, expired, or already used.", 400);
  return htmlResponse("Phase 0 OAuth could not be completed.", 500);
}

function capabilityErrorResponse(error: unknown): Response {
  if (error instanceof MercadoLibreApiError) {
    if (error.status === 401 || error.status === 403 || error.status === 429) return jsonResponse({ error: "Mercado Libre request was not authorized or was rate limited" }, error.status);
    return jsonResponse({ error: "Mercado Libre request failed" }, 502);
  }
  if (error instanceof MercadoLibreSchemaError) return jsonResponse({ error: "Mercado Libre returned an unexpected response" }, 502);
  if (error instanceof RefreshUnavailableError) return jsonResponse({ error: "A current Mercado Libre credential is not available" }, 503);
  if (error instanceof Error && /Connected account is .* not MPE/.test(error.message)) return jsonResponse({ error: "The connected account is not MPE" }, 502);
  return jsonResponse({ error: "Phase 0 capability probe failed" }, 500);
}

function jsonResponse(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

function htmlResponse(message: string, status: number): Response {
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>ML Copilot Phase 0</title><p>${message}</p>`, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } });
}

function methodNotAllowed(allow: string): Response {
  const response = jsonResponse({ error: "Method not allowed" }, 405);
  response.headers.set("Allow", allow);
  return response;
}

export default { fetch: createPhase0Worker() };
