import type { ItemBatch, ItemFetchFailure, MeliAttribute, MeliItem, MeliPicture, MeliUser, OAuthTokens, SellerItemsPage } from "./types.ts";

export class RuntimeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeValidationError";
  }
}

export const UserSchema = {
  parse(value: unknown): MeliUser {
    const object = record(value, "user");
    return {
      id: requiredId(object.id, "user.id"),
      siteId: requiredString(object.site_id, "user.site_id"),
      tags: optionalStringArray(object.tags) ?? [],
      ...(typeof object.status === "string" ? { status: object.status } : {}),
    };
  },
};

export const ItemSchema = {
  parse(value: unknown): MeliItem {
    const object = record(value, "item");
    return parseItem(object);
  },
  safeParse(value: unknown): { success: true; data: MeliItem } | { success: false; error: RuntimeValidationError } {
    try {
      return { success: true, data: parseItem(record(value, "item")) };
    } catch (error) {
      return { success: false, error: error instanceof RuntimeValidationError ? error : new RuntimeValidationError("Invalid item") };
    }
  },
};

export const SellerItemsPageSchema = {
  parse(value: unknown): SellerItemsPage {
    const object = record(value, "seller items page");
    const paging = record(object.paging, "seller items paging");
    const results = array(object.results, "seller items results").map((item, index) => requiredId(item, `results[${index}]`));
    return {
      sellerId: requiredId(object.seller_id, "seller_id"),
      itemIds: results,
      total: nonNegativeInt(paging.total, "paging.total"),
      limit: positiveInt(paging.limit, "paging.limit"),
      offset: nonNegativeInt(paging.offset, "paging.offset"),
      ...(typeof object.scroll_id === "string" ? { scrollId: object.scroll_id } : {}),
    };
  },
};

export const TokenResponseSchema = {
  parse(value: unknown): { access_token: string; refresh_token: string; token_type: string; expires_in: number; scope?: string; user_id?: string } {
    const object = record(value, "token response");
    return {
      access_token: requiredString(object.access_token, "access_token"),
      refresh_token: requiredString(object.refresh_token, "refresh_token"),
      token_type: requiredString(object.token_type, "token_type"),
      expires_in: positiveInt(object.expires_in, "expires_in"),
      ...(typeof object.scope === "string" ? { scope: object.scope } : {}),
      ...(object.user_id !== undefined ? { user_id: requiredId(object.user_id, "user_id") } : {}),
    };
  },
};

export function parseTokenResponse(value: unknown, now = Date.now()): OAuthTokens {
  const token = TokenResponseSchema.parse(value);
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenType: token.token_type,
    expiresIn: token.expires_in,
    expiresAt: now + token.expires_in * 1000,
    ...(token.scope !== undefined ? { scope: token.scope } : {}),
    ...(token.user_id !== undefined ? { userId: token.user_id } : {}),
  };
}

export function parseItemBatch(value: unknown): ItemBatch {
  const entries = array(value, "item batch");
  const items: MeliItem[] = [];
  const failures: ItemFetchFailure[] = [];
  for (const entryValue of entries) {
    const entry = record(entryValue, "item batch entry");
    const code = int(entry.code, "item batch status");
    const id = extractEntryId(entry.body);
    if (code >= 200 && code < 300) {
      const parsed = ItemSchema.safeParse(entry.body);
      if (parsed.success) items.push(parsed.data);
      else failures.push({ id, code });
    } else {
      failures.push({ id, code });
    }
  }
  return { items, failures };
}

function parseItem(object: Record<string, unknown>): MeliItem {
  const pictures = object.pictures === undefined ? undefined : array(object.pictures, "item.pictures").map((value) => parsePicture(record(value, "picture")));
  const attributes = object.attributes === undefined ? undefined : array(object.attributes, "item.attributes").map((value) => parseAttribute(record(value, "attribute")));
  const familyName = object.family_name === null ? null : optionalString(object.family_name);
  return {
    id: requiredId(object.id, "item.id"),
    ...(optionalString(object.site_id) !== undefined ? { siteId: optionalString(object.site_id) } : {}),
    ...(object.seller_id !== undefined ? { sellerId: requiredId(object.seller_id, "item.seller_id") } : {}),
    ...(optionalString(object.title) !== undefined ? { title: optionalString(object.title) } : {}),
    ...(optionalString(object.category_id) !== undefined ? { categoryId: optionalString(object.category_id) } : {}),
    ...(optionalString(object.condition) !== undefined ? { condition: optionalString(object.condition) } : {}),
    ...(optionalNumber(object.price) !== undefined ? { price: optionalNumber(object.price) } : {}),
    ...(optionalString(object.currency_id) !== undefined ? { currencyId: optionalString(object.currency_id) } : {}),
    ...(optionalNumber(object.available_quantity) !== undefined ? { availableQuantity: nonNegativeInt(object.available_quantity, "item.available_quantity") } : {}),
    ...(optionalString(object.status) !== undefined ? { status: optionalString(object.status) } : {}),
    ...(object.sub_status !== undefined ? { subStatus: optionalStringArray(object.sub_status) ?? [] } : {}),
    ...(object.tags !== undefined ? { tags: optionalStringArray(object.tags) ?? [] } : {}),
    ...(familyName !== undefined ? { familyName } : {}),
    ...(object.family_id !== undefined ? { familyId: requiredId(object.family_id, "item.family_id") } : {}),
    ...(object.user_product_id !== undefined ? { userProductId: requiredId(object.user_product_id, "item.user_product_id") } : {}),
    ...(optionalString(object.catalog_product_id) !== undefined ? { catalogProductId: optionalString(object.catalog_product_id) } : {}),
    ...(pictures !== undefined ? { pictures } : {}),
    ...(attributes !== undefined ? { attributes } : {}),
    ...(optionalString(object.permalink) !== undefined ? { permalink: optionalString(object.permalink) } : {}),
  };
}

function parsePicture(object: Record<string, unknown>): MeliPicture {
  return {
    ...(optionalString(object.id) !== undefined ? { id: optionalString(object.id) } : {}),
    ...(optionalString(object.url) !== undefined ? { url: optionalString(object.url) } : {}),
    ...(optionalString(object.secure_url) !== undefined ? { secureUrl: optionalString(object.secure_url) } : {}),
  };
}

function parseAttribute(object: Record<string, unknown>): MeliAttribute {
  return {
    ...(optionalString(object.id) !== undefined ? { id: optionalString(object.id) } : {}),
    ...(optionalString(object.name) !== undefined ? { name: optionalString(object.name) } : {}),
    ...(optionalString(object.value_id) !== undefined ? { valueId: optionalString(object.value_id) } : {}),
    ...(optionalString(object.value_name) !== undefined ? { valueName: optionalString(object.value_name) } : {}),
  };
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new RuntimeValidationError(`Invalid ${label}`);
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new RuntimeValidationError(`Invalid ${label}`);
  return value;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new RuntimeValidationError(`Invalid ${label}`);
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (!value.every((item) => typeof item === "string")) throw new RuntimeValidationError("Invalid string array");
  return value as string[];
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function requiredId(value: unknown, label: string): string {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  throw new RuntimeValidationError(`Invalid ${label}`);
}

function int(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new RuntimeValidationError(`Invalid ${label}`);
  return value;
}

function positiveInt(value: unknown, label: string): number {
  const number = int(value, label);
  if (number <= 0) throw new RuntimeValidationError(`Invalid ${label}`);
  return number;
}

function nonNegativeInt(value: unknown, label: string): number {
  const number = int(value, label);
  if (number < 0) throw new RuntimeValidationError(`Invalid ${label}`);
  return number;
}

function extractEntryId(value: unknown): string {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const id = (value as Record<string, unknown>).id;
    if (typeof id === "string" || (typeof id === "number" && Number.isSafeInteger(id))) return String(id);
  }
  return "unknown";
}
