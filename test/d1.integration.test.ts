import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { D1AccountStore, D1CredentialStore, D1OAuthStateStore } from "../src/d1-store.ts";
import { decryptTokens, encryptTokens, generateEncryptionSecret, importEncryptionKey } from "../src/crypto.ts";
import { decryptStateVerifier, encryptStateVerifier } from "../src/state-crypto.ts";
import type { ConnectedAccount, OAuthTokens } from "../src/types.ts";

const tokens: OAuthTokens = {
  accessToken: "local-access-token",
  refreshToken: "local-refresh-token",
  tokenType: "Bearer",
  expiresIn: 3_600,
  expiresAt: 10_000,
};

async function seedAccount(accountId = `d1-${crypto.randomUUID()}`): Promise<{ accountId: string; userId: string }> {
  const userId = `user-${crypto.randomUUID()}`;
  await env.DB.prepare(
    "INSERT INTO accounts (id, ml_user_id, site_id, tags_json, connection_status, connected_at, last_verified_at, created_at, updated_at) VALUES (?1, ?2, 'MPE', '[]', 'connected', ?3, ?3, ?3, ?3)",
  ).bind(accountId, userId, new Date().toISOString()).run();
  return { accountId, userId };
}

async function seedCredential(accountId: string, key: CryptoKey, now = 1_000): Promise<void> {
  const store = new D1CredentialStore(env.DB);
  await store.putInitial(accountId, await encryptTokens({ ...tokens, expiresAt: now - 1 }, key, accountId), now - 1, now);
}

describe("Phase 0 local workerd/D1 integration", () => {
  it("applies the Phase 0 migration and exposes only the minimal tables", async () => {
    const result = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('accounts', 'oauth_states', 'oauth_credentials') ORDER BY name").all<{ name: string }>();
    expect(result.results.map((row) => row.name)).toEqual(["accounts", "oauth_credentials", "oauth_states"]);
  });

  it("persists opaque MPE account identity and capability tags", async () => {
    const account: ConnectedAccount = {
      accountId: `meli:${crypto.randomUUID()}`,
      mlUserId: "9223372036854775807",
      siteId: "MPE",
      tags: ["user_product_seller", "warehouse_management", "multiwarehouse"],
      connectionStatus: "connected",
      connectedAt: "2099-01-01T00:00:00.000Z",
      lastVerifiedAt: "2099-01-01T00:00:00.000Z",
    };
    const store = new D1AccountStore(env.DB);
    await store.saveConnected(account);
    const current = await store.getConnected();
    expect(current?.accountId).toBe(account.accountId);
    expect(current?.mlUserId).toBe(account.mlUserId);
    expect(current?.siteId).toBe("MPE");
    expect(current?.tags).toEqual(account.tags);
  });

  it("inserts and consumes encrypted OAuth state exactly once", async () => {
    const key = await importEncryptionKey(generateEncryptionSecret());
    const store = new D1OAuthStateStore(env.DB, {
      encrypt: (value) => encryptStateVerifier(value, key),
      decrypt: (value) => decryptStateVerifier(value, key),
    }, "/phase0/capability", () => 100);
    const stateHash = `state-${crypto.randomUUID()}`;
    await store.put({ stateHash, codeVerifier: "verifier-value", expiresAt: 1_000 });
    const consumed = await Promise.all([store.consume(stateHash, 200), store.consume(stateHash, 200)]);
    expect(consumed.filter((value) => value !== null)).toHaveLength(1);
    expect(await store.consume(stateHash, 200)).toBeNull();
  });

  it("rejects an expired OAuth state", async () => {
    const key = await importEncryptionKey(generateEncryptionSecret());
    const store = new D1OAuthStateStore(env.DB, {
      encrypt: (value) => encryptStateVerifier(value, key),
      decrypt: (value) => decryptStateVerifier(value, key),
    }, "/phase0/capability", () => 100);
    const stateHash = `expired-${crypto.randomUUID()}`;
    await store.put({ stateHash, codeVerifier: "verifier-value", expiresAt: 100 });
    expect(await store.consume(stateHash, 100)).toBeNull();
  });

  it("persists encrypted credentials and reads them back without plaintext tokens", async () => {
    const key = await importEncryptionKey(generateEncryptionSecret());
    const { accountId } = await seedAccount();
    const store = new D1CredentialStore(env.DB);
    const encrypted = await encryptTokens(tokens, key, accountId);
    await store.putInitial(accountId, encrypted, tokens.expiresAt, 100);
    const row = await env.DB.prepare("SELECT encrypted_json FROM oauth_credentials WHERE account_id = ?1").bind(accountId).first<{ encrypted_json: string }>();
    expect(row?.encrypted_json).not.toContain(tokens.accessToken);
    expect(row?.encrypted_json).not.toContain(tokens.refreshToken);
    const record = await store.get(accountId);
    expect(record?.credentialVersion).toBe(1);
    expect(await decryptTokens(record!.encrypted, key, accountId)).toEqual(tokens);
    await store.putInitial(accountId, encrypted, tokens.expiresAt, 200);
    expect((await store.get(accountId))?.credentialVersion).toBe(2);
  });

  it("allows exactly one refresh lease and rejects a stale credential writer", async () => {
    const key = await importEncryptionKey(generateEncryptionSecret());
    const { accountId } = await seedAccount();
    await seedCredential(accountId, key);
    const store = new D1CredentialStore(env.DB);
    const acquired = await Promise.all([
      store.tryAcquireRefresh(accountId, 1, "owner-a", 1_000, 2_000),
      store.tryAcquireRefresh(accountId, 1, "owner-b", 1_000, 2_000),
    ]);
    expect(acquired.filter(Boolean)).toHaveLength(1);
    const owner = acquired[0] ? "owner-a" : "owner-b";
    const replacement = { ...tokens, accessToken: "new-local-access", refreshToken: "new-local-refresh", expiresAt: 5_000 };
    expect(await store.saveRefreshed(accountId, 1, owner, await encryptTokens(replacement, key, accountId), replacement.expiresAt, 1_100)).toBe(true);
    expect(await store.saveRefreshed(accountId, 1, owner === "owner-a" ? "owner-b" : "owner-a", await encryptTokens(tokens, key, accountId), tokens.expiresAt, 1_100)).toBe(false);
    expect((await store.get(accountId))?.credentialVersion).toBe(2);
    expect(await store.tryAcquireRefresh(accountId, 1, "stale-generation", 1_200, 2_200)).toBe(false);
  });

  it("recovers an expired refresh lease", async () => {
    const key = await importEncryptionKey(generateEncryptionSecret());
    const { accountId } = await seedAccount();
    await seedCredential(accountId, key);
    const store = new D1CredentialStore(env.DB);
    expect(await store.tryAcquireRefresh(accountId, 1, "crashed-worker", 1_000, 1_100)).toBe(true);
    expect(await store.tryAcquireRefresh(accountId, 1, "recovery-worker", 1_100, 2_100)).toBe(true);
  });

  it("fails closed when stored encrypted data is malformed or has a partial lease", async () => {
    const { accountId } = await seedAccount();
    await env.DB.prepare(
      "INSERT INTO oauth_credentials (account_id, encrypted_json, expires_at, credential_version, refresh_lease_owner, refresh_lease_until, updated_at) VALUES (?1, 'not-json', 100, 1, 'owner', NULL, ?2)",
    ).bind(accountId, new Date().toISOString()).run();
    await expect(new D1CredentialStore(env.DB).get(accountId)).rejects.toThrow(/malformed encrypted JSON/);

    const { accountId: partialAccount } = await seedAccount();
    const key = await importEncryptionKey(generateEncryptionSecret());
    const encrypted = await encryptTokens(tokens, key, partialAccount);
    await env.DB.prepare(
      "INSERT INTO oauth_credentials (account_id, encrypted_json, expires_at, credential_version, refresh_lease_owner, refresh_lease_until, updated_at) VALUES (?1, ?2, 100, 1, 'owner', NULL, ?3)",
    ).bind(partialAccount, JSON.stringify(encrypted), new Date().toISOString()).run();
    await expect(new D1CredentialStore(env.DB).get(partialAccount)).rejects.toThrow(/inconsistent refresh lease/);
  });
});
