import test from "node:test";
import assert from "node:assert/strict";
import { runReadOnlyProbe } from "./probe.ts";
import type { MeliItem, MeliUser, SellerItemsPage } from "./types.ts";

test("read-only probe confirms MPE and returns a sanitized sample", async () => {
  const calls: string[] = [];
  const user: MeliUser = { id: "9223372036854775807", siteId: "MPE", tags: ["user_product_seller"], status: "active" };
  const page: SellerItemsPage = { sellerId: user.id, itemIds: ["MPE1", "MPE2", "MPE3"], total: 3, limit: 2, offset: 0 };
  const items: MeliItem[] = [
    { id: "MPE1", siteId: "MPE", title: "Producto", categoryId: "MPE-CAT", price: 10, availableQuantity: 2, familyName: "Familia", pictures: [{ id: "p1" }], attributes: [{ id: "brand", valueName: "Marca" }] },
    { id: "MPE2", siteId: "MPE", condition: "used", status: "paused", tags: [] },
  ];
  const report = await runReadOnlyProbe({
    async getMe() { calls.push("me"); return user; },
    async searchSellerItems(_token, sellerId, query) { calls.push("search:" + sellerId + ":" + query?.limit); return page; },
    async getItems(_token, ids) { calls.push("items:" + ids.join(",")); return { items, failures: [{ id: "MPE3", code: 403 }] }; },
  }, "access-token", 1_000, 2);
  assert.deepEqual(calls, ["me", "search:9223372036854775807:2", "items:MPE1,MPE2"]);
  assert.equal(report.account.siteId, "MPE");
  assert.equal(report.listings.total, 3);
  assert.deepEqual(report.listings.itemIds, ["MPE1", "MPE2"]);
  assert.equal(report.sample[0]?.hasOwnerStock, true);
  assert.equal(report.sample[1]?.condition, "used");
  assert.equal(report.sellerModel.model, "coexistence");
  assert.deepEqual(report.itemFailures, [{ id: "MPE3", code: 403 }]);
});

test("read-only probe rejects a non-MPE account before seller listing access", async () => {
  let searched = false;
  await assert.rejects(() => runReadOnlyProbe({
    async getMe() { return { id: "seller", siteId: "MLB", tags: [] }; },
    async searchSellerItems() { searched = true; return { sellerId: "seller", itemIds: [], total: 0, limit: 1, offset: 0 }; },
    async getItems() { return { items: [], failures: [] }; },
  }, "access-token"), /not MPE/);
  assert.equal(searched, false);
});
