import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { MercadoLibreClient } from "../src/meli-client.ts";
import { createOAuthTransaction, consumeOAuthState, buildAuthorizationUrl, MemoryOAuthStateStore, sha256Base64Url, assertHttpsRedirectUri } from "../src/oauth.ts";
import { decryptTokens, encryptTokens, importEncryptionKey } from "../src/crypto.ts";
import { runReadOnlyProbe } from "../src/probe.ts";
import type { OAuthTokens } from "../src/types.ts";

const transactionPath = resolve(process.cwd(), ".phase0-oauth.json");
const env = process.env;

async function main(): Promise<void> {
  const clientId = required("ML_CLIENT_ID");
  const redirectUri = required("ML_REDIRECT_URI");
  assertHttpsRedirectUri(redirectUri);
  const clientSecret = env.ML_CLIENT_SECRET;
  const authCode = env.ML_AUTH_CODE;
  const callbackState = env.ML_CALLBACK_STATE;
  const directAccessToken = env.ML_ACCESS_TOKEN;
  const client = new MercadoLibreClient({ apiBaseUrl: env.ML_API_BASE_URL });

  let accessToken: string;
  let authentication: "oauth-code-exchange" | "direct-access-token";
  let exchanged: OAuthTokens | undefined;
  if (authCode) {
    if (!clientSecret || !callbackState) throw new Error("ML_CLIENT_SECRET and ML_CALLBACK_STATE are required with ML_AUTH_CODE");
    const transaction = JSON.parse(await readFile(transactionPath, "utf8")) as { state: string; codeVerifier: string; expiresAt: number; redirectUri: string };
    if (transaction.redirectUri !== redirectUri) throw new Error("OAuth redirect URI does not match the local transaction");
    const store = new MemoryOAuthStateStore();
    await store.put({ stateHash: await sha256Base64Url(transaction.state), codeVerifier: transaction.codeVerifier, expiresAt: transaction.expiresAt });
    const codeVerifier = await consumeOAuthState(store, callbackState);
    exchanged = await client.exchangeCode({ clientId, clientSecret, code: authCode, redirectUri, codeVerifier });
    accessToken = exchanged.accessToken;
    authentication = "oauth-code-exchange";
    await verifyInMemoryEncryption(exchanged);
  } else if (directAccessToken) {
    accessToken = directAccessToken;
    authentication = "direct-access-token";
  } else {
    const store = new MemoryOAuthStateStore();
    const transaction = await createOAuthTransaction(store);
    await writeFile(transactionPath, JSON.stringify(transaction), { encoding: "utf8", mode: 0o600 });
    const authorizationUrl = buildAuthorizationUrl({ clientId, redirectUri, state: transaction.state, codeChallenge: transaction.codeChallenge });
    console.log(JSON.stringify({
      next: "Open authorizationUrl in the intended MPE admin account, then rerun with ML_AUTH_CODE and ML_CALLBACK_STATE from the exact callback.",
      authorizationUrl,
      transactionFile: transactionPath,
      expiresAt: new Date(transaction.expiresAt).toISOString(),
      note: "The transaction file is local and ignored by Git. It contains only short-lived OAuth state/PKCE material; never commit it.",
    }, null, 2));
    return;
  }

  const report = await runReadOnlyProbe(client, accessToken, Date.now(), boundedSampleSize());
  console.log(JSON.stringify({ authentication, exchangedUserId: exchanged?.userId ?? null, report }, null, 2));
}

async function verifyInMemoryEncryption(tokens: OAuthTokens): Promise<void> {
  const keyMaterial = required("ML_ENCRYPTION_KEY");
  const key = await importEncryptionKey(keyMaterial);
  const encrypted = await encryptTokens(tokens, key, "phase0-probe");
  const decrypted = await decryptTokens(encrypted, key, "phase0-probe");
  if (decrypted.accessToken !== tokens.accessToken || decrypted.refreshToken !== tokens.refreshToken) throw new Error("Credential encryption round-trip failed");
}

function boundedSampleSize(): number {
  const value = Number(env.ML_SAMPLE_SIZE ?? "5");
  if (!Number.isInteger(value) || value < 1 || value > 20) throw new Error("ML_SAMPLE_SIZE must be an integer from 1 to 20");
  return value;
}

function required(name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is required; provide it through a local ignored environment file, never chat`);
  return value;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Phase 0 probe failed";
  console.error(`Phase 0 probe failed: ${message}`);
  process.exitCode = 1;
});
