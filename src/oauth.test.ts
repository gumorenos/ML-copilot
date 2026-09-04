import test from "node:test";
import assert from "node:assert/strict";
import { buildAuthorizationUrl, consumeOAuthState, createOAuthTransaction, createPkcePair, assertHttpsRedirectUri, MemoryOAuthStateStore, sha256Base64Url } from "./oauth.ts";

test("PKCE uses a verifier and S256 challenge", async () => {
  const pair = await createPkcePair();
  assert.ok(pair.verifier.length >= 43);
  assert.match(pair.verifier, /^[A-Za-z0-9_-]+$/);
  assert.equal(pair.challenge, await sha256Base64Url(pair.verifier));
  assert.notEqual(pair.challenge, pair.verifier);
});

test("OAuth state is one-time and expires", async () => {
  const store = new MemoryOAuthStateStore();
  const transaction = await createOAuthTransaction(store, 1_000, 100);
  assert.equal(await consumeOAuthState(store, transaction.state, 1_050), transaction.codeVerifier);
  await assert.rejects(() => consumeOAuthState(store, transaction.state, 1_050), /Invalid, expired, or already-consumed/);

  const expiredStore = new MemoryOAuthStateStore();
  const expired = await createOAuthTransaction(expiredStore, 1_000, 100);
  await assert.rejects(() => consumeOAuthState(expiredStore, expired.state, 1_100), /Invalid, expired, or already-consumed/);
});

test("authorization URL includes exact redirect, state, and PKCE parameters", () => {
  const url = new URL(buildAuthorizationUrl({
    clientId: "client-123",
    redirectUri: "https://example.test/oauth/callback",
    state: "state-123",
    codeChallenge: "challenge-123",
  }));
  assert.equal(url.origin, "https://auth.mercadolibre.com.pe");
  assert.equal(url.pathname, "/authorization");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "client-123");
  assert.equal(url.searchParams.get("redirect_uri"), "https://example.test/oauth/callback");
  assert.equal(url.searchParams.get("state"), "state-123");
  assert.equal(url.searchParams.get("code_challenge"), "challenge-123");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
});

test("redirect URI validation rejects non-HTTPS callbacks", () => {
  assert.throws(() => assertHttpsRedirectUri("http://example.test/callback"), /HTTPS/);
  assert.doesNotThrow(() => assertHttpsRedirectUri("https://example.test/callback"));
});

test("state consumed at timestamp zero cannot be replayed", async () => {
  const store = new MemoryOAuthStateStore();
  const transaction = await createOAuthTransaction(store, 0, 100);
  assert.equal(await consumeOAuthState(store, transaction.state, 0), transaction.codeVerifier);
  await assert.rejects(() => consumeOAuthState(store, transaction.state, 0), /Invalid, expired, or already-consumed/);
});

test("authorization URL builder rejects an insecure redirect itself", () => {
  assert.throws(() => buildAuthorizationUrl({ clientId: "client", redirectUri: "http://example.test/callback", state: "state", codeChallenge: "challenge" }), /HTTPS/);
  assert.throws(() => buildAuthorizationUrl({ clientId: "client", redirectUri: "https://example.test/callback#fragment", state: "state", codeChallenge: "challenge" }), /fragment/);
});
