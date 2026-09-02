import { assertHttpsRedirectUri } from "./oauth.ts";
import { ItemSchema, SellerItemsPageSchema, UserSchema, parseItemBatch, parseTokenResponse } from "./schemas.ts";
import type { FetchLike, ItemBatch, MeliItem, MeliUser, OAuthTokens, SellerItemsPage } from "./types.ts";

const DEFAULT_API_BASE = "https://api.mercadolibre.com";
const TOKEN_PATH = "/oauth/token";

export interface MercadoLibreClientOptions {
  fetchImpl?: FetchLike;
  apiBaseUrl?: string;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  maxReadRetries?: number;
}

export interface OAuthExchangeInput {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}

export interface SellerItemsQuery {
  limit?: number;
  offset?: number;
  status?: string;
  searchType?: "scan";
  scrollId?: string;
}

export class MercadoLibreApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  retryAfterMs?: number;

  constructor(message: string, status: number, code?: string, requestId?: string) {
    super(message);
    this.name = "MercadoLibreApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export class MercadoLibreSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MercadoLibreSchemaError";
  }
}

export class MercadoLibreClient {
  private readonly fetchImpl: FetchLike;
  private readonly apiBaseUrl: string;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly maxReadRetries: number;

  constructor(options: MercadoLibreClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.apiBaseUrl = (options.apiBaseUrl ?? DEFAULT_API_BASE).replace(/\/$/, "");
    this.now = options.now ?? (() => Date.now());
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.maxReadRetries = options.maxReadRetries ?? 1;
  }

  async exchangeCode(input: OAuthExchangeInput): Promise<OAuthTokens> {
    assertHttpsRedirectUri(input.redirectUri);
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    });
    return parseTokenResponse(await this.requestJson(TOKEN_PATH, { method: "POST", body }), this.now());
  }

  async refresh(refreshToken: string, clientId: string, clientSecret: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });
    return parseTokenResponse(await this.requestJson(TOKEN_PATH, { method: "POST", body }), this.now());
  }

  async getMe(accessToken: string): Promise<MeliUser> {
    const payload = await this.readJson("/users/me", accessToken);
    return this.parse(() => UserSchema.parse(payload), "users/me");
  }

  async searchSellerItems(accessToken: string, sellerId: string, query: SellerItemsQuery = {}): Promise<SellerItemsPage> {
    const params = new URLSearchParams();
    params.set("limit", String(Math.min(Math.max(query.limit ?? 20, 1), 100)));
    params.set("offset", String(Math.max(query.offset ?? 0, 0)));
    if (query.status) params.set("status", query.status);
    if (query.searchType) params.set("search_type", query.searchType);
    if (query.scrollId) params.set("scroll_id", query.scrollId);
    const payload = await this.readJson(`/users/${encodeURIComponent(sellerId)}/items/search?${params.toString()}`, accessToken);
    return this.parse(() => SellerItemsPageSchema.parse(payload), "users/items/search");
  }

  async getItems(accessToken: string, ids: string[]): Promise<ItemBatch> {
    if (ids.length === 0) return { items: [], failures: [] };
    if (ids.length > 20) throw new Error("Mercado Libre multiget accepts at most 20 item IDs");
    const query = ids.map((id) => encodeURIComponent(id)).join(",");
    const payload = await this.readJson(`/items?ids=${query}`, accessToken);
    return this.parse(() => parseItemBatch(payload), "items multiget");
  }

  async getItem(accessToken: string, id: string): Promise<MeliItem> {
    const payload = await this.readJson(`/items/${encodeURIComponent(id)}`, accessToken);
    return this.parse(() => ItemSchema.parse(payload), "item");
  }

  private async readJson(path: string, accessToken: string): Promise<unknown> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.requestJson(path, { method: "GET", accessToken });
      } catch (error) {
        if (!(error instanceof MercadoLibreApiError) || attempt >= this.maxReadRetries || (error.status !== 429 && error.status < 500)) throw error;
        const delay = Math.min(error.retryAfterMs ?? 250 * 2 ** attempt, 5_000);
        await this.sleep(delay);
      }
    }
  }

  private async requestJson(path: string, options: { method: "GET" | "POST"; accessToken?: string; body?: URLSearchParams }): Promise<unknown> {
    const headers = new Headers({ Accept: "application/json" });
    if (options.body) headers.set("Content-Type", "application/x-www-form-urlencoded");
    if (options.accessToken) headers.set("Authorization", `Bearer ${options.accessToken}`);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.apiBaseUrl}${path}`, {
        method: options.method,
        headers,
        body: options.body,
      });
    } catch {
      throw new MercadoLibreApiError("Mercado Libre network request failed", 0);
    }
    const requestId = response.headers.get("x-request-id") ?? response.headers.get("x-correlation-id") ?? undefined;
    const contentType = response.headers.get("content-type") ?? "";
    let parsed: unknown;
    if (contentType.includes("json")) {
      try {
        parsed = await response.json();
      } catch {
        throw new MercadoLibreApiError("Mercado Libre returned invalid JSON", response.status, undefined, requestId);
      }
    } else {
      await response.text();
      throw new MercadoLibreApiError("Mercado Libre returned a non-JSON response", response.status, undefined, requestId);
    }
    if (!response.ok) {
      const detail = extractError(parsed);
      const retryAfterHeader = response.headers.get("retry-after");
      const error = new MercadoLibreApiError(detail.message, response.status, detail.code, requestId);
      if (retryAfterHeader) error.retryAfterMs = parseRetryAfter(retryAfterHeader, this.now());
      throw error;
    }
    return parsed;
  }

  private parse<T>(parser: () => T, resource: string): T {
    try {
      return parser();
    } catch (error) {
      if (error instanceof MercadoLibreApiError) throw error;
      throw new MercadoLibreSchemaError(`Mercado Libre returned an invalid ${resource} response`);
    }
  }
}

function extractError(value: unknown): { message: string; code?: string } {
  if (typeof value === "object" && value !== null) {
    const item = value as Record<string, unknown>;
    return {
      message: typeof item.message === "string" ? item.message : "Mercado Libre request failed",
      code: typeof item.error === "string" ? item.error : typeof item.code === "string" ? item.code : undefined,
    };
  }
  return { message: "Mercado Libre request failed" };
}

function parseRetryAfter(value: string, now: number): number | undefined {
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - now);
  return undefined;
}
