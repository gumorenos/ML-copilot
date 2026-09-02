import test from "node:test";
import assert from "node:assert/strict";
import { decryptTokens, encryptTokens, generateEncryptionSecret, importEncryptionKey } from "./crypto.ts";
import { MemoryCredentialStore } from "./memory-store.ts";
import { RefreshUnavailableError, RotatingAccessTokenManager } from "./refresh.ts";
import type { OAuthTokens } from "./types.ts";

function expiredTokens(): OAuthTokens {
  return { accessToken: "old-access", refreshToken: "old-refresh", tokenType: "Bearer", expiresIn: 60, expiresAt: 900 };
}

test("concurrent callers consume one rotating refresh token", async () => {
  const key = await importEncryptionKey(generateEncryptionSecret());
  const store = new MemoryCredentialStore();
  store.seed({
    accountId: "account-1",
    credentialVersion: 1,
    encrypted: await encryptTokens(expiredTokens(), key, "account-1"),
    expiresAt: 900,
  });
  let refreshCalls = 0;
  const refreshed: OAuthTokens = { accessToken: "new-access", refreshToken: "new-refresh", tokenType: "Bearer", expiresIn: 3_600, expiresAt: 5_000 };
  const refreshClient = {
    async refresh(refreshToken: string): Promise<OAuthTokens> {
      assert.equal(refreshToken, "old-refresh");
      refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return refreshed;
    },
  };
  const managerOptions = { accountId: "account-1", store, encryptionKey: key, refreshClient, now: () => 1_000, refreshSkewMs: 0, maxWaitAttempts: 100 };
  const [first, second] = await Promise.all([
    new RotatingAccessTokenManager(managerOptions).getAccessToken(),
    new RotatingAccessTokenManager(managerOptions).getAccessToken(),
  ]);
  assert.equal(first, "new-access");
  assert.equal(second, "new-access");
  assert.equal(refreshCalls, 1);
  const record = await store.get("account-1");
  assert.equal(record?.credentialVersion, 2);
  assert.equal(record?.refreshLeaseOwner, undefined);
  assert.deepEqual(await decryptTokens(record!.encrypted, key, "account-1"), refreshed);
});

test("stale refresh writers cannot overwrite a newer credential generation", async () => {
  const key = await importEncryptionKey(generateEncryptionSecret());
  const store = new MemoryCredentialStore();
  store.seed({
    accountId: "account-1",
    credentialVersion: 1,
    encrypted: await encryptTokens(expiredTokens(), key, "account-1"),
    expiresAt: 900,
  });
  assert.equal(await store.tryAcquireRefresh("account-1", 1, "owner-a", 1_000, 2_000), true);
  const next: OAuthTokens = { accessToken: "next-access", refreshToken: "next-refresh", tokenType: "Bearer", expiresIn: 3_600, expiresAt: 5_000 };
  assert.equal(await store.saveRefreshed("account-1", 1, "owner-a", await encryptTokens(next, key, "account-1"), next.expiresAt, 1_100), true);
  assert.equal(await store.saveRefreshed("account-1", 1, "owner-b", await encryptTokens(expiredTokens(), key, "account-1"), 1_200, 1_100), false);
});

test("expired refresh leases can be recovered", async () => {
  const key = await importEncryptionKey(generateEncryptionSecret());
  const store = new MemoryCredentialStore();
  store.seed({
    accountId: "account-1",
    credentialVersion: 1,
    encrypted: await encryptTokens(expiredTokens(), key, "account-1"),
    expiresAt: 900,
    refreshLeaseOwner: "crashed-worker",
    refreshLeaseUntil: 900,
  });
  const next: OAuthTokens = { accessToken: "recovered-access", refreshToken: "recovered-refresh", tokenType: "Bearer", expiresIn: 3_600, expiresAt: 5_000 };
  const manager = new RotatingAccessTokenManager({
    accountId: "account-1",
    store,
    encryptionKey: key,
    refreshClient: { refresh: async () => next },
    now: () => 1_000,
    refreshSkewMs: 0,
  });
  assert.equal(await manager.getAccessToken(), "recovered-access");
});

test("failed refresh releases its lease and surfaces a safe error", async () => {
  const key = await importEncryptionKey(generateEncryptionSecret());
  const store = new MemoryCredentialStore();
  store.seed({
    accountId: "account-1",
    credentialVersion: 1,
    encrypted: await encryptTokens(expiredTokens(), key, "account-1"),
    expiresAt: 900,
  });
  const manager = new RotatingAccessTokenManager({
    accountId: "account-1",
    store,
    encryptionKey: key,
    refreshClient: { refresh: async () => { throw new Error("invalid_grant"); } },
    now: () => 1_000,
    refreshSkewMs: 0,
  });
  await assert.rejects(() => manager.getAccessToken(), /invalid_grant/);
  const record = await store.get("account-1");
  assert.equal(record?.refreshLeaseOwner, undefined);
});

test("a missing credential fails closed", async () => {
  const key = await importEncryptionKey(generateEncryptionSecret());
  const manager = new RotatingAccessTokenManager({
    accountId: "missing",
    store: new MemoryCredentialStore(),
    encryptionKey: key,
    refreshClient: { refresh: async () => expiredTokens() },
  });
  await assert.rejects(() => manager.getAccessToken(), RefreshUnavailableError);
});
