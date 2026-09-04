import test from "node:test";
import assert from "node:assert/strict";
import { D1CredentialStore, D1OAuthStateStore } from "./d1-store.ts";
import { encryptTokens, decryptTokens, generateEncryptionSecret, importEncryptionKey } from "./crypto.ts";
import type { D1DatabaseLike, D1PreparedLike, D1RunResult } from "./d1-store.ts";
import type { EncryptedCredential, OAuthTokens } from "./types.ts";

interface CredentialRow {
  account_id: string;
  encrypted_json: string;
  expires_at: number;
  credential_version: number;
  refresh_lease_owner: string | null;
  refresh_lease_until: number | null;
}

interface StateRow {
  state_hash: string;
  code_verifier_ciphertext: string;
  code_verifier_iv: string;
  safe_return_path: string;
  expires_at: number;
  consumed_at: number | null;
  created_at: number;
}

class FakeD1Prepared implements D1PreparedLike {
  private values: unknown[] = [];

  private readonly database: FakeD1Database;
  private readonly query: string;

  constructor(database: FakeD1Database, query: string) {
    this.database = database;
    this.query = query;
  }

  bind(...values: unknown[]): D1PreparedLike {
    this.values = values;
    return this;
  }

  async first<T extends Record<string, unknown>>(): Promise<T | null> {
    return this.database.first<T>(this.query, this.values);
  }

  async run(): Promise<D1RunResult> {
    return this.database.run(this.query, this.values);
  }
}

class FakeD1Database implements D1DatabaseLike {
  private credential: CredentialRow | null = null;
  private readonly states = new Map<string, StateRow>();

  prepare(query: string): D1PreparedLike {
    return new FakeD1Prepared(this, query);
  }

  seedCredential(row: CredentialRow): void {
    this.credential = { ...row };
  }

  getCredential(): CredentialRow | null {
    return this.credential ? { ...this.credential } : null;
  }

  async first<T extends Record<string, unknown>>(query: string, values: unknown[]): Promise<T | null> {
    if (query.includes("FROM oauth_credentials")) return (this.credential ? { ...this.credential } : null) as T | null;
    if (query.includes("FROM oauth_states")) {
      const row = this.states.get(String(values[0]));
      return (row ? { ...row } : null) as T | null;
    }
    throw new Error(`Unexpected fake D1 SELECT: ${query}`);
  }

  async run(query: string, values: unknown[]): Promise<D1RunResult> {
    if (query.includes("SET refresh_lease_owner = ?1")) {
      const [owner, leaseUntil, accountId, expectedVersion, now] = values as [string, number, string, number, number];
      if (!this.credential || this.credential.account_id !== accountId || this.credential.credential_version !== expectedVersion) return { meta: { changes: 0 } };
      if (this.credential.refresh_lease_until !== null && this.credential.refresh_lease_until > now) return { meta: { changes: 0 } };
      this.credential.refresh_lease_owner = owner;
      this.credential.refresh_lease_until = leaseUntil;
      return { meta: { changes: 1 } };
    }
    if (query.includes("SET encrypted_json = ?1")) {
      const [encryptedJson, expiresAt, updatedAt, accountId, expectedVersion, owner, now] = values as [string, number, string, string, number, string, number];
      if (!this.credential || this.credential.account_id !== accountId || this.credential.credential_version !== expectedVersion || this.credential.refresh_lease_owner !== owner || this.credential.refresh_lease_until === null || this.credential.refresh_lease_until <= now) return { meta: { changes: 0 } };
      this.credential.encrypted_json = encryptedJson;
      this.credential.expires_at = expiresAt;
      this.credential.credential_version += 1;
      this.credential.refresh_lease_owner = null;
      this.credential.refresh_lease_until = null;
      void updatedAt;
      return { meta: { changes: 1 } };
    }
    if (query.includes("SET refresh_lease_owner = NULL")) {
      const [accountId, owner] = values as [string, string];
      if (!this.credential || this.credential.account_id !== accountId || this.credential.refresh_lease_owner !== owner) return { meta: { changes: 0 } };
      this.credential.refresh_lease_owner = null;
      this.credential.refresh_lease_until = null;
      return { meta: { changes: 1 } };
    }
    if (query.startsWith("INSERT INTO oauth_states")) {
      const [stateHash, ciphertext, iv, safeReturnPath, expiresAt, createdAt] = values as [string, string, string, string, number, number];
      this.states.set(stateHash, { state_hash: stateHash, code_verifier_ciphertext: ciphertext, code_verifier_iv: iv, safe_return_path: safeReturnPath, expires_at: expiresAt, consumed_at: null, created_at: createdAt });
      return { meta: { changes: 1 } };
    }
    if (query.startsWith("UPDATE oauth_states SET consumed_at")) {
      const [consumedAt, stateHash, now] = values as [number, string, number];
      const row = this.states.get(stateHash);
      if (!row || row.consumed_at !== null || row.expires_at <= now) return { meta: { changes: 0 } };
      row.consumed_at = consumedAt;
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unexpected fake D1 write: ${query}`);
  }
}

function expiredTokens(): OAuthTokens {
  return { accessToken: "old-access", refreshToken: "old-refresh", tokenType: "Bearer", expiresIn: 60, expiresAt: 900 };
}

function refreshedTokens(): OAuthTokens {
  return { accessToken: "new-access", refreshToken: "new-refresh", tokenType: "Bearer", expiresIn: 3_600, expiresAt: 5_000 };
}

async function seedExpiredCredential(database: FakeD1Database, key: CryptoKey): Promise<void> {
  const encrypted = await encryptTokens(expiredTokens(), key, "account-1");
  database.seedCredential({ account_id: "account-1", encrypted_json: JSON.stringify(encrypted), expires_at: 900, credential_version: 1, refresh_lease_owner: null, refresh_lease_until: null });
}

test("D1 conditional lease permits one owner and rejects stale credential writers", async () => {
  const key = await importEncryptionKey(generateEncryptionSecret());
  const database = new FakeD1Database();
  await seedExpiredCredential(database, key);
  const firstStore = new D1CredentialStore(database);
  const secondStore = new D1CredentialStore(database);
  const acquired = await Promise.all([
    firstStore.tryAcquireRefresh("account-1", 1, "owner-a", 1_000, 2_000),
    secondStore.tryAcquireRefresh("account-1", 1, "owner-b", 1_000, 2_000),
  ]);
  assert.equal(acquired.filter(Boolean).length, 1);
  const owner = acquired[0] ? "owner-a" : "owner-b";
  const next = refreshedTokens();
  const encrypted = await encryptTokens(next, key, "account-1");
  assert.equal(await firstStore.saveRefreshed("account-1", 1, owner, encrypted, next.expiresAt, 1_100), true);
  assert.equal(await secondStore.saveRefreshed("account-1", 1, owner === "owner-a" ? "owner-b" : "owner-a", await encryptTokens(expiredTokens(), key, "account-1"), 1_200, 1_100), false);
  const current = await firstStore.get("account-1");
  assert.equal(current?.credentialVersion, 2);
  assert.equal(current?.refreshLeaseOwner, undefined);
  assert.deepEqual(await decryptTokens(current!.encrypted, key, "account-1"), next);
});

test("D1 expired lease is recoverable", async () => {
  const key = await importEncryptionKey(generateEncryptionSecret());
  const database = new FakeD1Database();
  await seedExpiredCredential(database, key);
  database.seedCredential({ ...database.getCredential()!, refresh_lease_owner: "crashed-worker", refresh_lease_until: 900 });
  const store = new D1CredentialStore(database);
  assert.equal(await store.tryAcquireRefresh("account-1", 1, "recovery-worker", 1_000, 2_000), true);
});

test("D1 OAuth state consumption is one-time under concurrent callers", async () => {
  const database = new FakeD1Database();
  const codec = {
    async encrypt(codeVerifier: string) { return { ciphertext: `encrypted:${codeVerifier}`, iv: "iv" }; },
    async decrypt(value: { ciphertext: string; iv: string }) { return value.ciphertext.replace(/^encrypted:/, ""); },
  };
  const store = new D1OAuthStateStore(database, codec, "/", () => 123);
  await store.put({ stateHash: "state-hash", codeVerifier: "verifier", expiresAt: 1_000 });
  const consumed = await Promise.all([store.consume("state-hash", 200), store.consume("state-hash", 200)]);
  assert.equal(consumed.filter((value) => value !== null).length, 1);
  assert.equal(consumed.find((value) => value !== null), "verifier");
  assert.equal(await store.consume("state-hash", 200), null);
});

test("D1 credential reads fail closed on malformed encrypted JSON", async () => {
  const database = new FakeD1Database();
  database.seedCredential({ account_id: "account-1", encrypted_json: "not-json", expires_at: 900, credential_version: 1, refresh_lease_owner: null, refresh_lease_until: null });
  await assert.rejects(() => new D1CredentialStore(database).get("account-1"), /malformed encrypted JSON/);
});
