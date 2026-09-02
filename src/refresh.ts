import { encryptTokens, decryptTokens } from "./crypto.ts";
import { randomBase64Url } from "./encoding.ts";
import type { CredentialStore, OAuthTokens } from "./types.ts";

export interface RefreshClient {
  refresh(refreshToken: string): Promise<OAuthTokens>;
}

export interface RefreshManagerOptions {
  accountId: string;
  store: CredentialStore;
  encryptionKey: CryptoKey;
  refreshClient: RefreshClient;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  keyVersion?: string;
  refreshSkewMs?: number;
  leaseMs?: number;
  maxWaitAttempts?: number;
}

export class RefreshUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefreshUnavailableError";
  }
}

export class RotatingAccessTokenManager {
  private readonly options: RefreshManagerOptions;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly keyVersion: string;
  private readonly refreshSkewMs: number;
  private readonly leaseMs: number;
  private readonly maxWaitAttempts: number;

  constructor(options: RefreshManagerOptions) {
    this.options = options;
    this.now = options.now ?? (() => Date.now());
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.keyVersion = options.keyVersion ?? "v1";
    this.refreshSkewMs = options.refreshSkewMs ?? 30_000;
    this.leaseMs = options.leaseMs ?? 30_000;
    this.maxWaitAttempts = options.maxWaitAttempts ?? 20;
  }

  async getAccessToken(): Promise<string> {
    const record = await this.options.store.get(this.options.accountId);
    if (!record) throw new RefreshUnavailableError("No encrypted credentials are stored for this account");
    const current = await decryptTokens(record.encrypted, this.options.encryptionKey, this.options.accountId);
    if (record.expiresAt > this.now() + this.refreshSkewMs) return current.accessToken;

    const owner = randomBase64Url(16);
    const now = this.now();
    const acquired = await this.options.store.tryAcquireRefresh(this.options.accountId, record.credentialVersion, owner, now, now + this.leaseMs);
    if (!acquired) return this.waitForFreshToken(record.credentialVersion);

    let saved = false;
    try {
      const leased = await this.options.store.get(this.options.accountId);
      if (!leased || leased.credentialVersion !== record.credentialVersion) return this.waitForFreshToken(record.credentialVersion);
      const leasedTokens = await decryptTokens(leased.encrypted, this.options.encryptionKey, this.options.accountId);
      if (leased.expiresAt > this.now() + this.refreshSkewMs) return leasedTokens.accessToken;

      const refreshed = await this.options.refreshClient.refresh(leasedTokens.refreshToken);
      const encrypted = await encryptTokens(refreshed, this.options.encryptionKey, this.options.accountId, this.keyVersion);
      saved = await this.options.store.saveRefreshed(
        this.options.accountId,
        record.credentialVersion,
        owner,
        encrypted,
        refreshed.expiresAt,
        this.now(),
      );
      if (!saved) return this.waitForFreshToken(record.credentialVersion);
      return refreshed.accessToken;
    } finally {
      if (!saved) await this.options.store.releaseRefresh(this.options.accountId, owner);
    }
  }

  private async waitForFreshToken(previousVersion: number): Promise<string> {
    for (let attempt = 0; attempt < this.maxWaitAttempts; attempt += 1) {
      await this.sleep(10);
      const record = await this.options.store.get(this.options.accountId);
      if (!record) throw new RefreshUnavailableError("Credentials disappeared during refresh");
      const tokens = await decryptTokens(record.encrypted, this.options.encryptionKey, this.options.accountId);
      if (record.credentialVersion > previousVersion && record.expiresAt > this.now()) return tokens.accessToken;
      if (record.refreshLeaseOwner === undefined && record.credentialVersion === previousVersion) {
        throw new RefreshUnavailableError("Refresh ended without a newer credential generation");
      }
    }
    throw new RefreshUnavailableError("Timed out waiting for the current credential generation");
  }
}
