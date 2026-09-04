import test from "node:test";
import assert from "node:assert/strict";
import { encryptTokens, generateEncryptionSecret, importEncryptionKey } from "./crypto.ts";
import type { D1DatabaseLike } from "./d1-store.ts";
import { MemoryCredentialStore, MemoryRefreshVerificationStore } from "./memory-store.ts";
import { MemoryOAuthStateStore } from "./oauth.ts";
import type { AccountStore, ConnectedAccount, FetchLike, OAuthTokens } from "./types.ts";
import { createPhase0Worker, type Phase0Env } from "./worker.ts";

const OPERATOR_TOKEN = "phase0-operator-test-token";
const ACCESS_TOKEN = "synthetic-access-token";
const REFRESH_TOKEN = "synthetic-refresh-token";
const REDIRECT_URI = "https://staging.example.test/phase0/oauth/callback";

class MemoryAccountStore implements AccountStore {
  account: ConnectedAccount | null = null;

  async getConnected(): Promise<ConnectedAccount | null> {
    return this.account ? { ...this.account, tags: [...this.account.tags] } : null;
  }

  async saveConnected(account: ConnectedAccount): Promise<void> {
    this.account = { ...account, tags: [...account.tags] };
  }
}

function baseEnv(): Phase0Env {
  return {
    DB: {} as D1DatabaseLike,
    ML_CLIENT_ID: "test-client-id",
    ML_CLIENT_SECRET: "test-client-secret",
    ML_ENCRYPTION_KEY: generateEncryptionSecret(),
    ML_REDIRECT_URI: REDIRECT_URI,
    ML_API_BASE_URL: "https://api.example.test",
    PHASE0_OPERATOR_TOKEN: OPERATOR_TOKEN,
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

function authorizationRequest(): Request {
  return new Request("https://staging.example.test/phase0/oauth/start", { headers: { "X-Phase0-Operator-Token": OPERATOR_TOKEN } });
}

function capabilityRequest(): Request {
  return new Request("https://staging.example.test/phase0/capability", { headers: { Authorization: `Bearer ${OPERATOR_TOKEN}` } });
}

function forcedRefreshRequest(body: unknown = { confirm: "rotate-once" }): Request {
  return new Request("https://staging.example.test/phase0/refresh/verify", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPERATOR_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function syntheticTokens(now = 1_000_000): OAuthTokens {
  return { accessToken: ACCESS_TOKEN, refreshToken: REFRESH_TOKEN, tokenType: "Bearer", expiresIn: 3_600, expiresAt: now + 3_600_000 };
}

async function startAndReadState(worker: ReturnType<typeof createPhase0Worker>, env: Phase0Env): Promise<string> {
  const response = await worker(authorizationRequest(), env);
  assert.equal(response.status, 302);
  const location = response.headers.get("location");
  assert.ok(location);
  return new URL(location).searchParams.get("state")!;
}

function fakeMeliFetch(options: { siteId?: string; exchangeStatus?: number; meStatus?: number; mePayload?: unknown; refreshStatus?: number; refreshNetworkFailure?: boolean; onToken?: () => void; onItems?: (count: number) => void } = {}): FetchLike {
  return async (input) => {
    const url = new URL(input.toString());
    if (url.pathname === "/oauth/token") {
      options.onToken?.();
      if (options.refreshNetworkFailure) throw new Error("synthetic network timeout");
      if (options.refreshStatus) return jsonResponse({ message: "refresh failed", error: "invalid_grant" }, options.refreshStatus);
      if (options.exchangeStatus) return jsonResponse({ message: "authorization failed", error: "invalid_grant" }, options.exchangeStatus);
      return jsonResponse({ access_token: ACCESS_TOKEN, refresh_token: REFRESH_TOKEN, token_type: "Bearer", expires_in: 3_600, user_id: "9223372036854775807" });
    }
    if (url.pathname === "/users/me") {
      if (options.meStatus) return jsonResponse({ message: "account request failed" }, options.meStatus);
      if (options.mePayload !== undefined) return jsonResponse(options.mePayload);
      return jsonResponse({ id: "9223372036854775807", site_id: options.siteId ?? "MPE", tags: ["user_product_seller", "warehouse_management", "multiwarehouse"], status: "active" });
    }
    if (url.pathname.endsWith("/items/search")) {
      const ids = Array.from({ length: 25 }, (_, index) => `MPE${index + 1}`);
      return jsonResponse({ seller_id: "9223372036854775807", paging: { total: 25, limit: Number(url.searchParams.get("limit")), offset: Number(url.searchParams.get("offset")) }, results: ids });
    }
    if (url.pathname === "/items") {
      const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean);
      options.onItems?.(ids.length);
      return jsonResponse(ids.map((id, index) => ({ code: 200, body: { id, site_id: "MPE", title: `Item ${index}`, category_id: "MPE-CAT", condition: index % 2 === 0 ? "new" : "used", price: 10, available_quantity: 2, family_name: index === 0 ? "Familia" : null, tags: index === 0 ? ["user_product_listing"] : [] } })));
    }
    return jsonResponse({ message: "not found" }, 404);
  };
}

async function connectedCapabilityFixture(status?: number) {
  const env = baseEnv();
  const accountStore = new MemoryAccountStore();
  const credentialStore = new MemoryCredentialStore();
  const key = await importEncryptionKey(env.ML_ENCRYPTION_KEY!);
  const account: ConnectedAccount = { accountId: "meli:9223372036854775807", mlUserId: "9223372036854775807", siteId: "MPE", tags: [], connectionStatus: "connected", connectedAt: new Date(900_000).toISOString() };
  await accountStore.saveConnected(account);
  credentialStore.seed({ accountId: account.accountId, credentialVersion: 1, encrypted: await encryptTokens(syntheticTokens(), key, account.accountId), expiresAt: 4_600_000 });
  const worker = createPhase0Worker({ accountStore, credentialStore, encryptionKey: key, now: () => 1_000_000, maxReadRetries: 0, sleep: async () => undefined, fetchImpl: fakeMeliFetch({ meStatus: status }) });
  return { env, worker };
}

async function connectedRefreshFixture(fetchOptions: Parameters<typeof fakeMeliFetch>[0] = {}) {
  const env = baseEnv();
  const accountStore = new MemoryAccountStore();
  const credentialStore = new MemoryCredentialStore();
  const refreshVerificationStore = new MemoryRefreshVerificationStore();
  const key = await importEncryptionKey(env.ML_ENCRYPTION_KEY!);
  const account: ConnectedAccount = { accountId: "meli:refresh", mlUserId: "refresh-user", siteId: "MPE", tags: [], connectionStatus: "connected", connectedAt: new Date(900_000).toISOString() };
  await accountStore.saveConnected(account);
  credentialStore.seed({ accountId: account.accountId, credentialVersion: 1, encrypted: await encryptTokens(syntheticTokens(), key, account.accountId), expiresAt: 4_600_000 });
  let tokenCalls = 0;
  const worker = createPhase0Worker({ accountStore, credentialStore, refreshVerificationStore, encryptionKey: key, now: () => 1_000_000, maxReadRetries: 0, sleep: async () => undefined, fetchImpl: fakeMeliFetch({ ...fetchOptions, onToken: () => { tokenCalls += 1; fetchOptions.onToken?.(); } }) });
  return { env, worker, credentialStore, refreshVerificationStore, tokenCalls: () => tokenCalls };
}

test("Phase 0 OAuth start requires the temporary operator token", async () => {
  const env = baseEnv();
  const worker = createPhase0Worker({ stateStore: new MemoryOAuthStateStore(), encryptionKey: await importEncryptionKey(env.ML_ENCRYPTION_KEY!), now: () => 1_000_000 });
  const response = await worker(new Request("https://staging.example.test/phase0/oauth/start"), env);
  assert.equal(response.status, 401);
  assert.doesNotMatch(await response.text(), new RegExp(OPERATOR_TOKEN));
});

test("valid OAuth start creates S256 state and redirects without exposing the operator token", async () => {
  const env = baseEnv();
  const worker = createPhase0Worker({ stateStore: new MemoryOAuthStateStore(), encryptionKey: await importEncryptionKey(env.ML_ENCRYPTION_KEY!), now: () => 1_000_000 });
  const response = await worker(authorizationRequest(), env);
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("location")!);
  assert.equal(location.origin, "https://auth.mercadolibre.com.pe");
  assert.equal(location.searchParams.get("code_challenge_method"), "S256");
  assert.equal(location.searchParams.get("scope"), "offline_access read");
  assert.ok(location.searchParams.get("state"));
  assert.doesNotMatch(response.headers.get("location")!, new RegExp(OPERATOR_TOKEN));
});

test("callback rejects invalid and reused state", async () => {
  const env = baseEnv();
  const stateStore = new MemoryOAuthStateStore();
  const worker = createPhase0Worker({ stateStore, accountStore: new MemoryAccountStore(), credentialStore: new MemoryCredentialStore(), encryptionKey: await importEncryptionKey(env.ML_ENCRYPTION_KEY!), now: () => 1_000_000, fetchImpl: fakeMeliFetch() });
  const invalid = await worker(new Request(`https://staging.example.test/phase0/oauth/callback?state=invalid&code=code`), env);
  assert.equal(invalid.status, 400);
  const state = await startAndReadState(worker, env);
  const first = await worker(new Request(`https://staging.example.test/phase0/oauth/callback?state=${encodeURIComponent(state)}&code=good-code`), env);
  assert.equal(first.status, 200);
  const second = await worker(new Request(`https://staging.example.test/phase0/oauth/callback?state=${encodeURIComponent(state)}&code=good-code`), env);
  assert.equal(second.status, 400);
});

test("callback maps exchange failures safely and never returns token material", async () => {
  const env = baseEnv();
  const worker = createPhase0Worker({ stateStore: new MemoryOAuthStateStore(), encryptionKey: await importEncryptionKey(env.ML_ENCRYPTION_KEY!), now: () => 1_000_000, fetchImpl: fakeMeliFetch({ exchangeStatus: 400 }) });
  const state = await startAndReadState(worker, env);
  const response = await worker(new Request(`https://staging.example.test/phase0/oauth/callback?state=${encodeURIComponent(state)}&code=bad`), env);
  const body = await response.text();
  assert.equal(response.status, 502);
  assert.doesNotMatch(body, /invalid_grant|synthetic-access-token|synthetic-refresh-token/);
});

test("callback rejects a non-MPE account without storing credentials", async () => {
  const env = baseEnv();
  const accountStore = new MemoryAccountStore();
  const credentialStore = new MemoryCredentialStore();
  const worker = createPhase0Worker({ stateStore: new MemoryOAuthStateStore(), accountStore, credentialStore, encryptionKey: await importEncryptionKey(env.ML_ENCRYPTION_KEY!), now: () => 1_000_000, fetchImpl: fakeMeliFetch({ siteId: "MLB" }) });
  const state = await startAndReadState(worker, env);
  const response = await worker(new Request(`https://staging.example.test/phase0/oauth/callback?state=${encodeURIComponent(state)}&code=good`), env);
  assert.equal(response.status, 400);
  assert.equal(accountStore.account, null);
  assert.equal(await credentialStore.get("meli:9223372036854775807"), null);
});

test("successful callback stores encrypted credentials and returns only a safe page", async () => {
  const env = baseEnv();
  const accountStore = new MemoryAccountStore();
  const credentialStore = new MemoryCredentialStore();
  const key = await importEncryptionKey(env.ML_ENCRYPTION_KEY!);
  const worker = createPhase0Worker({ stateStore: new MemoryOAuthStateStore(), accountStore, credentialStore, encryptionKey: key, now: () => 1_000_000, fetchImpl: fakeMeliFetch() });
  const state = await startAndReadState(worker, env);
  const response = await worker(new Request(`https://staging.example.test/phase0/oauth/callback?state=${encodeURIComponent(state)}&code=good`), env);
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /connection succeeded/);
  assert.doesNotMatch(body, /synthetic-access-token|synthetic-refresh-token|test-client-secret/);
  const credential = await credentialStore.get("meli:9223372036854775807");
  assert.ok(credential);
  assert.doesNotMatch(JSON.stringify(credential), /synthetic-access-token|synthetic-refresh-token/);
  assert.equal(accountStore.account?.siteId, "MPE");
  assert.deepEqual(accountStore.account?.tags, ["user_product_seller", "warehouse_management", "multiwarehouse"]);
});

test("capability probe is protected, read-only, and bounds item hydration", async () => {
  const env = baseEnv();
  const accountStore = new MemoryAccountStore();
  const credentialStore = new MemoryCredentialStore();
  const key = await importEncryptionKey(env.ML_ENCRYPTION_KEY!);
  const account: ConnectedAccount = { accountId: "meli:1", mlUserId: "1", siteId: "MPE", tags: [], connectionStatus: "connected", connectedAt: new Date(900_000).toISOString() };
  await accountStore.saveConnected(account);
  await credentialStore.seed({ accountId: account.accountId, credentialVersion: 1, encrypted: await encryptTokens(syntheticTokens(), key, account.accountId), expiresAt: 4_600_000 });
  let hydratedCount = -1;
  const worker = createPhase0Worker({ accountStore, credentialStore, encryptionKey: key, now: () => 1_000_000, fetchImpl: fakeMeliFetch({ onItems: (count) => { hydratedCount = count; } }) });
  assert.equal((await worker(new Request("https://staging.example.test/phase0/capability"), env)).status, 401);
  const response = await worker(capabilityRequest(), env);
  const body = await response.text();
  assert.equal(response.status, 200);
  const report = JSON.parse(body) as { listings: { itemIds: string[] }; sellerModel: { model: string } };
  assert.equal(report.listings.itemIds.length, 5);
  assert.equal(hydratedCount, 5);
  assert.equal(report.sellerModel.model, "coexistence");
  assert.doesNotMatch(body, /synthetic-access-token|synthetic-refresh-token/);
});

test("capability probe maps malformed responses and upstream auth/rate-limit statuses", async () => {
  const env = baseEnv();
  const accountStore = new MemoryAccountStore();
  const credentialStore = new MemoryCredentialStore();
  const key = await importEncryptionKey(env.ML_ENCRYPTION_KEY!);
  const account: ConnectedAccount = { accountId: "meli:malformed", mlUserId: "malformed", siteId: "MPE", tags: [], connectionStatus: "connected", connectedAt: new Date().toISOString() };
  await accountStore.saveConnected(account);
  await credentialStore.seed({ accountId: account.accountId, credentialVersion: 1, encrypted: await encryptTokens(syntheticTokens(), key, account.accountId), expiresAt: 4_600_000 });
  const malformedWorker = createPhase0Worker({ accountStore, credentialStore, encryptionKey: key, now: () => 1_000_000, maxReadRetries: 0, fetchImpl: fakeMeliFetch({ mePayload: {} }) });
  assert.equal((await malformedWorker(capabilityRequest(), env)).status, 502);
  for (const status of [401, 403, 429]) {
    const fixture = await connectedCapabilityFixture(status);
    const response = await fixture.worker(capabilityRequest(), fixture.env);
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /synthetic-access-token|synthetic-refresh-token/);
  }
});

test("forced refresh requires operator authentication and explicit confirmation", async () => {
  const fixture = await connectedRefreshFixture();
  const unauthorized = await fixture.worker(new Request("https://staging.example.test/phase0/refresh/verify", { method: "POST", body: JSON.stringify({ confirm: "rotate-once" }), headers: { "content-type": "application/json" } }), fixture.env);
  assert.equal(unauthorized.status, 401);
  const unconfirmed = await fixture.worker(new Request("https://staging.example.test/phase0/refresh/verify", { method: "POST", headers: { Authorization: `Bearer ${OPERATOR_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ confirm: "nope" }) }), fixture.env);
  assert.equal(unconfirmed.status, 400);
});

test("forced refresh performs one rotating refresh, advances the generation, and rejects a second attempt", async () => {
  const fixture = await connectedRefreshFixture();
  const response = await fixture.worker(forcedRefreshRequest(), fixture.env);
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /"credentialVersionBefore":1/);
  assert.match(body, /"credentialVersionAfter":2/);
  assert.doesNotMatch(body, /synthetic-access-token|synthetic-refresh-token|test-client-secret/);
  assert.equal((await fixture.credentialStore.get("meli:refresh"))?.credentialVersion, 2);
  assert.equal((await fixture.refreshVerificationStore.get("meli:refresh"))?.status, "succeeded");
  assert.equal(fixture.tokenCalls(), 1);
  const second = await fixture.worker(forcedRefreshRequest(), fixture.env);
  assert.equal(second.status, 409);
  assert.equal(fixture.tokenCalls(), 1);
});

test("concurrent forced refresh attempts allow only one durable verification claim", async () => {
  const fixture = await connectedRefreshFixture();
  const responses = await Promise.all([fixture.worker(forcedRefreshRequest(), fixture.env), fixture.worker(forcedRefreshRequest(), fixture.env)]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  assert.equal(fixture.tokenCalls(), 1);
});

test("forced refresh fails safely on an upstream error and never retries", async () => {
  const fixture = await connectedRefreshFixture({ refreshStatus: 400 });
  const response = await fixture.worker(forcedRefreshRequest(), fixture.env);
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /invalid_grant|synthetic-refresh-token/);
  assert.equal(fixture.tokenCalls(), 1);
  assert.equal((await fixture.refreshVerificationStore.get("meli:refresh"))?.status, "failed");
  const second = await fixture.worker(forcedRefreshRequest(), fixture.env);
  assert.equal(second.status, 409);
});

test("ambiguous forced refresh failure is not retried automatically and exposes no token", async () => {
  const fixture = await connectedRefreshFixture({ refreshNetworkFailure: true });
  const response = await fixture.worker(forcedRefreshRequest(), fixture.env);
  assert.equal(response.status, 502);
  const body = await response.text();
  assert.match(body, /ambiguous/i);
  assert.doesNotMatch(body, /synthetic-access-token|synthetic-refresh-token|test-client-secret/);
  assert.equal(fixture.tokenCalls(), 1);
  assert.equal((await fixture.refreshVerificationStore.get("meli:refresh"))?.status, "ambiguous");
});
