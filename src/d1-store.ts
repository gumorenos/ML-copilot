import type { CredentialRecord, CredentialStore, EncryptedCredential, OAuthStateRecord, OAuthStateStore } from "./types.ts";

export interface D1RunResult {
  meta: { changes: number };
}

export interface D1PreparedLike {
  bind(...values: unknown[]): D1PreparedLike;
  first<T extends Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1RunResult>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedLike;
}

interface CredentialRow extends Record<string, unknown> {
  account_id: string;
  encrypted_json: string;
  expires_at: number;
  credential_version: number;
  refresh_lease_owner: string | null;
  refresh_lease_until: number | null;
}

export class D1CredentialStore implements CredentialStore {
  private readonly db: D1DatabaseLike;

  constructor(db: D1DatabaseLike) {
    this.db = db;
  }

  async get(accountId: string): Promise<CredentialRecord | null> {
    const row = await this.db.prepare(
      "SELECT account_id, encrypted_json, expires_at, credential_version, refresh_lease_owner, refresh_lease_until FROM oauth_credentials WHERE account_id = ?1",
    ).bind(accountId).first<CredentialRow>();
    if (!row) return null;
    const encrypted = JSON.parse(row.encrypted_json) as EncryptedCredential;
    if (!isEncryptedCredential(encrypted)) throw new Error("Stored credential has an invalid encrypted shape");
    return {
      accountId: row.account_id,
      encrypted,
      expiresAt: row.expires_at,
      credentialVersion: row.credential_version,
      refreshLeaseOwner: row.refresh_lease_owner ?? undefined,
      refreshLeaseUntil: row.refresh_lease_until ?? undefined,
    };
  }

  async tryAcquireRefresh(accountId: string, expectedVersion: number, owner: string, now: number, leaseUntil: number): Promise<boolean> {
    const result = await this.db.prepare(
      "UPDATE oauth_credentials SET refresh_lease_owner = ?1, refresh_lease_until = ?2 WHERE account_id = ?3 AND credential_version = ?4 AND (refresh_lease_until IS NULL OR refresh_lease_until <= ?5)",
    ).bind(owner, leaseUntil, accountId, expectedVersion, now).run();
    return result.meta.changes === 1;
  }

  async saveRefreshed(accountId: string, expectedVersion: number, owner: string, encrypted: EncryptedCredential, expiresAt: number, now: number): Promise<boolean> {
    const result = await this.db.prepare(
      "UPDATE oauth_credentials SET encrypted_json = ?1, expires_at = ?2, credential_version = credential_version + 1, refresh_lease_owner = NULL, refresh_lease_until = NULL, updated_at = ?3 WHERE account_id = ?4 AND credential_version = ?5 AND refresh_lease_owner = ?6 AND refresh_lease_until > ?7",
    ).bind(JSON.stringify(encrypted), expiresAt, new Date(now).toISOString(), accountId, expectedVersion, owner, now).run();
    return result.meta.changes === 1;
  }

  async releaseRefresh(accountId: string, owner: string): Promise<void> {
    await this.db.prepare(
      "UPDATE oauth_credentials SET refresh_lease_owner = NULL, refresh_lease_until = NULL WHERE account_id = ?1 AND refresh_lease_owner = ?2",
    ).bind(accountId, owner).run();
  }
}

interface OAuthStateRow extends Record<string, unknown> {
  state_hash: string;
  code_verifier_ciphertext: string;
  code_verifier_iv: string;
  expires_at: number;
  consumed_at: number | null;
}

export interface EncryptedStateVerifier {
  ciphertext: string;
  iv: string;
}

export interface OAuthStateVerifierCodec {
  encrypt(codeVerifier: string): Promise<EncryptedStateVerifier>;
  decrypt(value: EncryptedStateVerifier): Promise<string>;
}

export class D1OAuthStateStore implements OAuthStateStore {
  private readonly db: D1DatabaseLike;
  private readonly codec: OAuthStateVerifierCodec;
  private readonly safeReturnPath: string;

  constructor(db: D1DatabaseLike, codec: OAuthStateVerifierCodec, safeReturnPath: string) {
    this.db = db;
    this.codec = codec;
    this.safeReturnPath = safeReturnPath;
  }

  async put(record: OAuthStateRecord): Promise<void> {
    const encrypted = await this.codec.encrypt(record.codeVerifier);
    await this.db.prepare(
      "INSERT INTO oauth_states (state_hash, code_verifier_ciphertext, code_verifier_iv, safe_return_path, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    ).bind(record.stateHash, encrypted.ciphertext, encrypted.iv, this.safeReturnPath, record.expiresAt, Date.now()).run();
  }

  async consume(stateHash: string, now: number): Promise<string | null> {
    const row = await this.db.prepare(
      "SELECT state_hash, code_verifier_ciphertext, code_verifier_iv, expires_at, consumed_at FROM oauth_states WHERE state_hash = ?1",
    ).bind(stateHash).first<OAuthStateRow>();
    if (!row || row.consumed_at !== null || row.expires_at <= now) return null;
    const consumed = await this.db.prepare(
      "UPDATE oauth_states SET consumed_at = ?1 WHERE state_hash = ?2 AND consumed_at IS NULL AND expires_at > ?3",
    ).bind(now, stateHash, now).run();
    if (consumed.meta.changes !== 1) return null;
    return this.codec.decrypt({ ciphertext: row.code_verifier_ciphertext, iv: row.code_verifier_iv });
  }
}

function isEncryptedCredential(value: EncryptedCredential): value is EncryptedCredential {
  return typeof value === "object" && value !== null && value.version === 1 && value.algorithm === "AES-GCM" && typeof value.iv === "string" && typeof value.ciphertext === "string" && typeof value.keyVersion === "string";
}
