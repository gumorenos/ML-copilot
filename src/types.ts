export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: number;
  scope?: string;
  userId?: string;
}

export interface MeliUser {
  id: string;
  siteId: string;
  tags: string[];
  status?: string;
}

export interface ConnectedAccount {
  accountId: string;
  mlUserId: string;
  siteId: string;
  tags: string[];
  status?: string;
  connectionStatus: string;
  connectedAt: string;
  lastVerifiedAt?: string;
}

export interface AccountStore {
  getConnected(): Promise<ConnectedAccount | null>;
  saveConnected(account: ConnectedAccount): Promise<void>;
}

export interface MeliPicture {
  id?: string;
  url?: string;
  secureUrl?: string;
}

export interface MeliAttribute {
  id?: string;
  name?: string;
  valueId?: string;
  valueName?: string;
}

export interface MeliItem {
  id: string;
  siteId?: string;
  sellerId?: string;
  title?: string;
  categoryId?: string;
  condition?: string;
  price?: number;
  currencyId?: string;
  availableQuantity?: number;
  status?: string;
  subStatus?: string[];
  tags?: string[];
  familyName?: string | null;
  familyId?: string;
  userProductId?: string;
  catalogProductId?: string;
  pictures?: MeliPicture[];
  attributes?: MeliAttribute[];
  permalink?: string;
}

export interface SellerItemsPage {
  sellerId: string;
  itemIds: string[];
  total: number;
  limit: number;
  offset: number;
  scrollId?: string;
}

export interface ItemFetchFailure {
  id: string;
  code: number;
}

export interface ItemBatch {
  items: MeliItem[];
  failures: ItemFetchFailure[];
}

export type SellerModel = "legacy-items" | "user-products" | "coexistence" | "unknown";

export interface SellerModelAssessment {
  model: SellerModel;
  sellerEnabledForUserProducts: boolean;
  userProductItems: number;
  legacyItems: number;
  evidence: string[];
}

export interface EncryptedCredential {
  version: 1;
  algorithm: "AES-GCM";
  iv: string;
  ciphertext: string;
  keyVersion: string;
}

export interface CredentialRecord {
  accountId: string;
  credentialVersion: number;
  encrypted: EncryptedCredential;
  expiresAt: number;
  refreshLeaseOwner?: string;
  refreshLeaseUntil?: number;
}

export interface CredentialStore {
  get(accountId: string): Promise<CredentialRecord | null>;
  tryAcquireRefresh(
    accountId: string,
    expectedVersion: number,
    owner: string,
    now: number,
    leaseUntil: number,
  ): Promise<boolean>;
  saveRefreshed(
    accountId: string,
    expectedVersion: number,
    owner: string,
    encrypted: EncryptedCredential,
    expiresAt: number,
    now: number,
  ): Promise<boolean>;
  releaseRefresh(accountId: string, owner: string): Promise<void>;

  putInitial?(accountId: string, encrypted: EncryptedCredential, expiresAt: number, now: number): Promise<void>;
}

export type RefreshVerificationStatus = "pending" | "succeeded" | "failed" | "ambiguous";

export interface RefreshVerification {
  accountId: string;
  status: RefreshVerificationStatus;
  attemptedAt: number;
  completedAt?: number;
  credentialVersionBefore: number;
  credentialVersionAfter?: number;
  errorCode?: string;
}

export interface RefreshVerificationStore {
  claim(accountId: string, credentialVersionBefore: number, now: number): Promise<boolean>;
  complete(
    accountId: string,
    status: Exclude<RefreshVerificationStatus, "pending">,
    credentialVersionBefore: number,
    now: number,
    credentialVersionAfter?: number,
    errorCode?: string,
  ): Promise<void>;
  get(accountId: string): Promise<RefreshVerification | null>;
}

export interface OAuthStateRecord {
  stateHash: string;
  codeVerifier: string;
  expiresAt: number;
  consumedAt?: number;
}

export interface OAuthStateStore {
  put(record: OAuthStateRecord): Promise<void>;
  consume(stateHash: string, now: number): Promise<string | null>;
}

export interface FetchLike {
  (input: string | URL | Request, init?: RequestInit): Promise<Response>;
}
