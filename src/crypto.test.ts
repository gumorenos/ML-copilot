import test from "node:test";
import assert from "node:assert/strict";
import { decryptTokens, encryptTokens, generateEncryptionSecret, importEncryptionKey } from "./crypto.ts";
import type { OAuthTokens } from "./types.ts";

const tokens: OAuthTokens = {
  accessToken: "access-token-test-value",
  refreshToken: "refresh-token-test-value",
  tokenType: "Bearer",
  expiresIn: 3_600,
  expiresAt: 4_600_000,
  scope: "offline_access read",
  userId: "9223372036854775807",
};

test("AES-GCM credential encryption round-trips and stores no plaintext token", async () => {
  const key = await importEncryptionKey(generateEncryptionSecret());
  const encrypted = await encryptTokens(tokens, key, "account-1");
  assert.equal(encrypted.algorithm, "AES-GCM");
  assert.notEqual(encrypted.iv.length, 0);
  assert.notEqual(encrypted.ciphertext.length, 0);
  assert.equal(JSON.stringify(encrypted).includes(tokens.accessToken), false);
  assert.equal(JSON.stringify(encrypted).includes(tokens.refreshToken), false);
  assert.deepEqual(await decryptTokens(encrypted, key, "account-1"), tokens);
});

test("AES-GCM authenticated data binds credentials to the account", async () => {
  const key = await importEncryptionKey(generateEncryptionSecret());
  const encrypted = await encryptTokens(tokens, key, "account-1");
  await assert.rejects(() => decryptTokens(encrypted, key, "account-2"));
});

test("encryption key material must be exactly 256 bits", async () => {
  await assert.rejects(() => importEncryptionKey("c2hvcnQ"), /256-bit/);
});
