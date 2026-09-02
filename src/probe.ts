import { assessSellerModel } from "./model.ts";
import type { MeliItem, MeliUser, SellerItemsPage } from "./types.ts";

export interface ReadOnlyProbeClient {
  getMe(accessToken: string): Promise<MeliUser>;
  searchSellerItems(accessToken: string, sellerId: string, query?: { limit?: number; offset?: number }): Promise<SellerItemsPage>;
  getItems(accessToken: string, ids: string[]): Promise<{ items: MeliItem[]; failures: { id: string; code: number }[] }>;
}

export interface ReadOnlyProbeReport {
  checkedAt: string;
  mode: "real-mpe-read-only";
  account: { userId: string; siteId: string; tags: string[]; status?: string };
  listings: { total: number; firstPageCount: number; pageLimit: number; pageOffset: number; itemIds: string[] };
  sample: Array<{
    id: string;
    siteId?: string;
    status?: string;
    condition?: string;
    hasTitle: boolean;
    hasCategory: boolean;
    hasPrice: boolean;
    hasOwnerStock: boolean;
    pictureCount: number;
    attributeCount: number;
    hasUserProductId: boolean;
    hasFamilyName: boolean;
    tags: string[];
  }>;
  itemFailures: Array<{ id: string; code: number }>;
  sellerModel: ReturnType<typeof assessSellerModel>;
}

export async function runReadOnlyProbe(client: ReadOnlyProbeClient, accessToken: string, now = Date.now(), sampleSize = 5): Promise<ReadOnlyProbeReport> {
  if (!accessToken) throw new Error("An access token is required for the read-only probe");
  const user = await client.getMe(accessToken);
  if (user.siteId !== "MPE") throw new Error(`Connected account is ${user.siteId}, not MPE`);
  const page = await client.searchSellerItems(accessToken, user.id, { limit: Math.min(Math.max(sampleSize, 1), 20), offset: 0 });
  const ids = page.itemIds.slice(0, sampleSize);
  const batch = await client.getItems(accessToken, ids);
  const model = assessSellerModel(user, batch.items);
  return {
    checkedAt: new Date(now).toISOString(),
    mode: "real-mpe-read-only",
    account: { userId: user.id, siteId: user.siteId, tags: user.tags, status: user.status },
    listings: { total: page.total, firstPageCount: page.itemIds.length, pageLimit: page.limit, pageOffset: page.offset, itemIds: ids },
    sample: batch.items.map(summarizeItem),
    itemFailures: batch.failures,
    sellerModel: model,
  };
}

function summarizeItem(item: MeliItem): ReadOnlyProbeReport["sample"][number] {
  return {
    id: item.id,
    siteId: item.siteId,
    status: item.status,
    condition: item.condition,
    hasTitle: item.title !== undefined,
    hasCategory: item.categoryId !== undefined,
    hasPrice: item.price !== undefined,
    hasOwnerStock: item.availableQuantity !== undefined,
    pictureCount: item.pictures?.length ?? 0,
    attributeCount: item.attributes?.length ?? 0,
    hasUserProductId: item.userProductId !== undefined,
    hasFamilyName: item.familyName !== undefined && item.familyName !== null,
    tags: item.tags ?? [],
  };
}
