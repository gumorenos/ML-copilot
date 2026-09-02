import type { MeliItem, MeliUser, SellerModelAssessment } from "./types.ts";

export function assessSellerModel(user: MeliUser, items: MeliItem[]): SellerModelAssessment {
  const sellerEnabledForUserProducts = user.tags.includes("user_product_seller");
  const userProductItems = items.filter(isUserProductItem).length;
  const legacyItems = items.length - userProductItems;
  const evidence: string[] = [];
  if (sellerEnabledForUserProducts) evidence.push("user_product_seller seller tag present");
  if (userProductItems > 0) evidence.push(`${userProductItems} sampled item(s) have User Product markers`);
  if (legacyItems > 0) evidence.push(`${legacyItems} sampled item(s) have no User Product listing marker`);
  if (items.length === 0) return { model: "unknown", sellerEnabledForUserProducts, userProductItems, legacyItems, evidence: ["No listing sample was available"] };

  let model: SellerModelAssessment["model"];
  if (userProductItems > 0 && legacyItems > 0) model = "coexistence";
  else if (userProductItems > 0) model = "user-products";
  else if (!sellerEnabledForUserProducts) model = "legacy-items";
  else {
    model = "coexistence";
    evidence.push("Seller is enabled for User Products but this sample has not exposed a User Product marker; migration may be in progress");
  }
  return { model, sellerEnabledForUserProducts, userProductItems, legacyItems, evidence };
}

export function isUserProductItem(item: MeliItem): boolean {
  return item.familyName !== undefined && item.familyName !== null || item.tags?.includes("user_product_listing") === true;
}
