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
  account_id: unknown;
  encrypted_json: unknown;
  expires_at: unknown;
  credential_version: unknown;
  refresh_lease_owner: unknown;
  refresh_lease_until: unknown;
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
    return parseCredentialRow(row, accountId);
  }

  async tryAcquireRefresh(accountId: string, expectedVersion: number, owner: string, now: number, leaseUntil: number): Promise<boolean> {
    assertPositiveInteger(expectedVersion, "credential version");
    assertInteger(now, "refresh time");
    assertInteger(leaseUntil, "refresh lease expiry");
    if (!owner) throw new Error("Refresh lease owner is required");
    if (leaseUntil <= now) throw new Error("Refresh lease expiry must be in the future");
    const result = await this.db.prepare(
      "UPDATE oauth_credentials SET refresh_lease_owner = ?1, refresh_lease_until = ?2 WHERE account_id = ?3 AND credential_version = ?4 AND (refresh_lease_until IS NULL OR refresh_lease_until <= ?5)",
    ).bind(owner, leaseUntil, accountId, expectedVersion, now).run();
    return result.meta.changes === 1;
  }

  async saveRefreshed(accountId: string, expectedVersion: number, owner: string, encrypted: EncryptedCredential, expiresAt: number, now: number): Promise<boolean> {
    assertPositiveInteger(expectedVersion, "credential version");
    assertInteger(now, "refresh time");
    assertInteger(expiresAt, "credential expiry");
    if (expiresAt < 0) throw new Error("Credential expiry cannot be negative");
    if (!owner) throw new Error("Refresh lease owner is required");
    if (!isEncryptedCredential(encrypted)) throw new Error("Refreshed credential has an invalid encrypted shape");
    const result = await this.db.prepare(
      "UPDATE oauth_credentials SET encrypted_json = ?1, expires_at = ?2, credential_version = credential_version + 1, refresh_lease_owner = NULL, refresh_lease_until = NULL, updated_at = ?3 WHERE account_id = ?4 AND credential_version = ?5 AND refresh_lease_owner = ?6 AND refresh_lease_until > ?7",
    ).bind(JSON.stringify(encrypted), expiresAt, new Date(now).toISOString(), accountId, expectedVersion, owner, now).run();
    return result.meta.changes === 1;
  }

  async releaseRefresh(accountId: string, owner: string): Promise<void> {
    if (!owner) return;
    await this.db.prepare(
      "UPDATE oauth_credentials SET refresh_lease_owner = NULL, refresh_lease_until = NULL WHERE account_id = ?1 AND refresh_lease_owner = ?2",
    ).bind(accountId, owner).run();
  }
}

interface OAuthStateRow extends Record<string, unknown> {
  state_hash: unknown;
  code_verifier_ciphertext: unknown;
  code_verifier_iv: unknown;
  expires_at: unknown;
  consumed_at: unknown;
}

interface ParsedOAuthStateRow {
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
  private readonly now: () => number;

  constructor(db: D1DatabaseLike, codec: OAuthStateVerifierCodec, safeReturnPath: string, now = () => Date.now()) {
    this.db = db;
    this.codec = codec;
    this.safeReturnPath = safeReturnPath;
    this.now = now;
  }

  async put(record: OAuthStateRecord): Promise<void> {
    if (!record.stateHash || !record.codeVerifier) throw new Error("OAuth state and verifier are required");
    assertInteger(record.expiresAt, "OAuth state expiry");
    const encrypted = await this.codec.encrypt(record.codeVerifier);
    await this.db.prepare(
      "INSERT INTO oauth_states (state_hash, code_verifier_ciphertext, code_verifier_iv, safe_return_path, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    ).bind(record.stateHash, encrypted.ciphertext, encrypted.iv, this.safeReturnPath, record.expiresAt, this.now()).run();
  }

  async consume(stateHash: string, now: number): Promise<string | null> {
    assertInteger(now, "OAuth state time");
    const rawRow = await this.db.prepare(
      "SELECT state_hash, code_verifier_ciphertext, code_verifier_iv, expires_at, consumed_at FROM oauth_states WHERE state_hash = ?1",
    ).bind(stateHash).first<OAuthStateRow>();
    if (!rawRow) return null;
    const row = parseOAuthStateRow(rawRow);
    if (row.consumed_at !== null || row.expires_at <= now) return null;
    const consumed = await this.db.prepare(
      "UPDATE oauth_states SET consumed_at = ?1 WHERE state_hash = ?2 AND consumed_at IS NULL AND expires_at > ?3",
    ).bind(now, stateHash, now).run();
    if (consumed.meta.changes !== 1) return null;
    return this.codec.decrypt({ ciphertext: row.code_verifier_ciphertext, iv: row.code_verifier_iv });
  }
}

function parseCredentialRow(row: CredentialRow, requestedAccountId: string): CredentialRecord {
  if (typeof row.account_id !== "string" || row.account_id !== requestedAccountId) throw new Error("Stored credential has an invalid account ID");
  if (typeof row.encrypted_json !== "string") throw new Error("Stored credential has invalid encrypted JSON");
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.encrypted_json);
  } catch {
    throw new Error("Stored credential has malformed encrypted JSON");
  }
  if (!isEncryptedCredential(parsed)) throw new Error("Stored credential has an invalid encrypted shape");
  const credentialVersion = positiveInteger(row.credential_version, "credential version");
  const expiresAt = nonNegativeInteger(row.expires_at, "credential expiry");
  const refreshLeaseOwner = nullableString(row.refresh_lease_owner, "refresh lease owner");
  const refreshLeaseUntil = nullableInteger(row.refresh_lease_until, "refresh lease expiry");
  return {
    accountId: row.account_id,
    encrypted: parsed,
    expiresAt,
    credentialVersion,
    ...(refreshLeaseOwner !== null ? { refreshLeaseOwner } : {}),
    ...(refreshLeaseUntil !== null ? { refreshLeaseUntil } : {}),
  };
}

function parseOAuthStateRow(row: OAuthStateRow): ParsedOAuthStateRow {
  if (typeof row.state_hash !== "string" || typeof row.code_verifier_ciphertext !== "string" || typeof row.code_verifier_iv !== "string") throw new Error("Stored OAuth state has invalid encrypted fields");
  const consumedAt = row.consumed_at === null || row.consumed_at === undefined ? null : nonNegativeInteger(row.consumed_at, "OAuth state consumed time");
  const expiresAt = nonNegativeInteger(row.expires_at, "OAuth state expiry");
  return { state_hash: row.state_hash, code_verifier_ciphertext: row.code_verifier_ciphertext, code_verifier_iv: row.code_verifier_iv, expires_at: expiresAt, consumed_at: consumedAt };
}
function isEncryptedCredential(value: unknown): value is EncryptedCredential {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return item.version === 1 && item.algorithm === "AES-GCM" && typeof item.iv === "string" && item.iv.length > 0 && typeof item.ciphertext === "string" && item.ciphertext.length > 0 && typeof item.keyVersion === "string" && item.keyVersion.length > 0;
}

function assertInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer`);
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive safe integer`);
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid ${label}`);
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${label}`);
  return value;
}
function nullableString(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length === 0) throw new Error(`Invalid ${label}`);
  return value;
}

function nullableInteger(value: unknown, label: string): number | null {
  if (value === null || value === undefined) return null;
  return nonNegativeInteger(value, label);
}
