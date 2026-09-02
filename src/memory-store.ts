import type { CredentialRecord, CredentialStore, EncryptedCredential } from "./types.ts";

export class MemoryCredentialStore implements CredentialStore {
  private readonly records = new Map<string, CredentialRecord>();

  seed(record: CredentialRecord): void {
    this.records.set(record.accountId, cloneRecord(record));
  }

  async get(accountId: string): Promise<CredentialRecord | null> {
    const record = this.records.get(accountId);
    return record ? cloneRecord(record) : null;
  }

  async tryAcquireRefresh(accountId: string, expectedVersion: number, owner: string, now: number, leaseUntil: number): Promise<boolean> {
    const record = this.records.get(accountId);
    if (!record || record.credentialVersion !== expectedVersion) return false;
    if (record.refreshLeaseUntil !== undefined && record.refreshLeaseUntil > now) return false;
    record.refreshLeaseOwner = owner;
    record.refreshLeaseUntil = leaseUntil;
    return true;
  }

  async saveRefreshed(accountId: string, expectedVersion: number, owner: string, encrypted: EncryptedCredential, expiresAt: number, now: number): Promise<boolean> {
    const record = this.records.get(accountId);
    if (!record || record.credentialVersion !== expectedVersion || record.refreshLeaseOwner !== owner) return false;
    if (record.refreshLeaseUntil !== undefined && record.refreshLeaseUntil <= now) return false;
    record.encrypted = cloneEncrypted(encrypted);
    record.expiresAt = expiresAt;
    record.credentialVersion += 1;
    delete record.refreshLeaseOwner;
    delete record.refreshLeaseUntil;
    return true;
  }

  async releaseRefresh(accountId: string, owner: string): Promise<void> {
    const record = this.records.get(accountId);
    if (!record || record.refreshLeaseOwner !== owner) return;
    delete record.refreshLeaseOwner;
    delete record.refreshLeaseUntil;
  }
}

function cloneEncrypted(value: EncryptedCredential): EncryptedCredential {
  return { ...value };
}

function cloneRecord(value: CredentialRecord): CredentialRecord {
  return { ...value, encrypted: cloneEncrypted(value.encrypted) };
}
