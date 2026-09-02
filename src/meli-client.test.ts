import test from "node:test";
import assert from "node:assert/strict";
import { MercadoLibreApiError, MercadoLibreClient, MercadoLibreSchemaError } from "./meli-client.ts";

function jsonResponse(payload: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json", ...headers } });
}

test("token exchange sends Authorization Code and PKCE parameters and honors expires_in", async () => {
  let request: { url: string; init: RequestInit } | undefined;
  const client = new MercadoLibreClient({
    apiBaseUrl: "https://api.example.test",
    now: () => 1_000,
    fetchImpl: async (url, init) => {
      request = { url: url.toString(), init: init! };
      return jsonResponse({ access_token: "a", refresh_token: "r", token_type: "Bearer", expires_in: 123, user_id: "9223372036854775807" });
    },
  });
  const tokens = await client.exchangeCode({ clientId: "client", clientSecret: "secret", code: "code", redirectUri: "https://app.example.test/callback", codeVerifier: "verifier" });
  assert.equal(tokens.expiresAt, 124_000);
  assert.equal(tokens.userId, "9223372036854775807");
  assert.equal(request?.url, "https://api.example.test/oauth/token");
  assert.equal(request?.init.method, "POST");
  const body = String(request?.init.body);
  assert.match(body, /grant_type=authorization_code/);
  assert.match(body, /code_verifier=verifier/);
  assert.match(body, /redirect_uri=https%3A%2F%2Fapp.example.test%2Fcallback/);
});

test("users/me preserves large opaque IDs and MPE site", async () => {
  const client = new MercadoLibreClient({
    apiBaseUrl: "https://api.example.test",
    fetchImpl: async () => jsonResponse({ id: "9223372036854775807", site_id: "MPE", tags: ["user_product_seller"], status: "active" }),
  });
  assert.deepEqual(await client.getMe("access"), { id: "9223372036854775807", siteId: "MPE", tags: ["user_product_seller"], status: "active" });
});

test("seller item search parses total, pagination, status and opaque item IDs", async () => {
  let requestedUrl = "";
  const client = new MercadoLibreClient({
    apiBaseUrl: "https://api.example.test",
    fetchImpl: async (url) => {
      requestedUrl = url.toString();
      return jsonResponse({ seller_id: "9223372036854775807", paging: { total: 2, limit: 20, offset: 0 }, results: ["MPE123", "MPE456"] });
    },
  });
  const page = await client.searchSellerItems("access", "9223372036854775807", { status: "active" });
  assert.deepEqual(page.itemIds, ["MPE123", "MPE456"]);
  assert.equal(page.total, 2);
  assert.match(requestedUrl, /status=active/);
  assert.match(requestedUrl, /limit=20/);
});

test("item multiget returns valid items and isolates per-item failures", async () => {
  const client = new MercadoLibreClient({
    apiBaseUrl: "https://api.example.test",
    fetchImpl: async () => jsonResponse([
      { code: 200, body: { id: "MPE123", site_id: "MPE", title: "Producto", price: 10, available_quantity: 2, family_name: "familia", tags: ["user_product_listing"] } },
      { code: 403, body: { id: "MPE456", message: "forbidden" } },
    ]),
  });
  const result = await client.getItems("access", ["MPE123", "MPE456"]);
  assert.equal(result.items[0]?.id, "MPE123");
  assert.deepEqual(result.failures, [{ id: "MPE456", code: 403 }]);
  assert.equal(result.items[0]?.familyName, "familia");
});

test("malformed Mercado Libre payloads fail runtime validation", async () => {
  const client = new MercadoLibreClient({
    apiBaseUrl: "https://api.example.test",
    fetchImpl: async () => jsonResponse({ seller_id: "seller", results: [] }),
  });
  await assert.rejects(() => client.searchSellerItems("access", "seller"), MercadoLibreSchemaError);
});

test("read-only GET retries one rate-limited response and classifies 401", async () => {
  let calls = 0;
  const sleeps: number[] = [];
  const client = new MercadoLibreClient({
    apiBaseUrl: "https://api.example.test",
    sleep: async (milliseconds) => { sleeps.push(milliseconds); },
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({ message: "slow down", error: "too_many_requests" }, 429, { "retry-after": "0" });
      return jsonResponse({ id: "seller", site_id: "MPE", tags: [] });
    },
  });
  assert.equal((await client.getMe("access")).siteId, "MPE");
  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [0]);

  const unauthorized = new MercadoLibreClient({
    apiBaseUrl: "https://api.example.test",
    fetchImpl: async () => jsonResponse({ message: "unauthorized" }, 401),
  });
  await assert.rejects(() => unauthorized.getMe("access"), (error: unknown) => error instanceof MercadoLibreApiError && error.status === 401);
});

test("item multiget bounds request size", async () => {
  const client = new MercadoLibreClient({ fetchImpl: async () => jsonResponse([]) });
  await assert.rejects(() => client.getItems("access", Array.from({ length: 21 }, (_, index) => String(index))), /at most 20/);
});
