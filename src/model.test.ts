import test from "node:test";
import assert from "node:assert/strict";
import { assessSellerModel } from "./model.ts";
import type { MeliItem, MeliUser } from "./types.ts";

const user = (tags: string[] = []): MeliUser => ({ id: "seller", siteId: "MPE", tags });
const item = (overrides: Partial<MeliItem> = {}): MeliItem => ({ id: "MPE1", ...overrides });

test("seller without User Product tag and markers is legacy Items", () => {
  assert.equal(assessSellerModel(user(), [item()]).model, "legacy-items");
});

test("sampled family marker identifies User Products", () => {
  const result = assessSellerModel(user(["user_product_seller"]), [item({ familyName: "Family A", userProductId: "UP1" })]);
  assert.equal(result.model, "user-products");
  assert.equal(result.userProductItems, 1);
});

test("mixed markers identify coexistence", () => {
  const result = assessSellerModel(user(["user_product_seller"]), [item({ familyName: "Family A" }), item({ id: "MPE2" })]);
  assert.equal(result.model, "coexistence");
  assert.equal(result.legacyItems, 1);
});

test("User Product seller with an unmarked sample remains conservatively classified", () => {
  const result = assessSellerModel(user(["user_product_seller"]), [item()]);
  assert.equal(result.model, "coexistence");
  assert.match(result.evidence.join(" "), /migration/);
});

test("empty sample is unknown", () => {
  assert.equal(assessSellerModel(user(), []).model, "unknown");
});
