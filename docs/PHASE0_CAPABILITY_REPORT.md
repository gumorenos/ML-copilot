# Phase 0 capability report

Status: **PARTIAL** (checked 2026-09-04)

This is a review artifact, not an application feature. It must never contain access tokens, refresh tokens, client secrets, authorization codes, buyer data, full raw Mercado Libre payloads, or unnecessary account-specific details.

## Evidence classification

| Evidence level | Result in this task |
|---|---|
| **AUTOMATED / UNIT** | PASS: 46/46 Node-native tests with synthetic/mock data |
| **LOCAL WORKER+D1 INTEGRATION** | PASS: 8/8 Vitest Workerd/D1 tests; checked-in migration applied |
| **DEPLOYED CLOUDFLARE** | NOT RUN: no staging Worker or remote D1 deployment |
| **REAL MPE READ-ONLY** | NOT RUN: no Mercado Libre application credential or intended seller account was supplied |

Overall Phase 0 remains **PARTIAL**. Mock/local success cannot produce PASS.

## Automated / unit evidence

The suites cover OAuth state expiry/replay, S256 PKCE, exact HTTPS redirect validation, token exchange and returned `expires_in`, AES-GCM authenticated context and plaintext omission, rotating refresh replacement, stale-writer protection, lease recovery/failure, large opaque IDs, MPE parsing, listing pagination, multiget bound, malformed responses, 401/403/429 and retry handling, seller-model classification, sanitized probe output, and the Phase 0 Worker routes.

The route tests prove the temporary operator guard, one-time callback state, server-side exchange, wrong-site rejection, encrypted initial persistence, safe success/error pages, protected capability, bounded five-item hydration, malformed upstream handling, and redacted 401/403/429 responses. They do not call Mercado Libre.

## Local Worker+D1 integration evidence

`npm run test:worker` uses `@cloudflare/vitest-plugin` with Wrangler's Workerd environment and applies `migrations/0001_phase0_auth.sql` through `test/apply-migrations.ts`. The eight tests prove:

1. the three Phase 0 tables are created;
2. OAuth state inserts and only one concurrent consumer succeeds;
3. expired OAuth state is rejected;
4. encrypted credentials persist/read and stored JSON contains no token plaintext;
5. one refresh lease wins and a stale credential generation cannot overwrite it;
6. an expired lease can be recovered;
7. malformed encrypted data and partial lease state fail closed;
8. opaque MPE account identity and capability tags persist and round-trip.

This is local D1 engine evidence. It is not deployed Cloudflare D1 evidence.

## Deployed Cloudflare

- [ ] Staging Worker deployed from this branch after secret review.
- [ ] Staging D1 bound as `DB` and migration applied remotely by an authorized operator.
- [ ] Route reachability, HTTPS callback, and no alternate-host bypass verified.

## Real MPE read-only checklist

Complete only with the intended administrator/main MPE seller account and the exact registered callback:

- [ ] OAuth authorization completed; state matched/consumed once and PKCE accepted.
- [ ] Server-side exchange succeeded and returned `expires_in` was used.
- [ ] `/users/me` succeeded; user ID is retained as opaque text; `site_id` is `MPE`.
- [ ] Relevant tags recorded when present: `user_product_seller`, `warehouse_management`, `multiwarehouse`.
- [ ] `/users/{seller_id}/items/search` returned total and paging/scan behavior.
- [ ] Small item sample hydrated; status, condition, price representation, stock representation, pictures, attributes, and User Product markers summarized.
- [ ] Seller model classified as legacy Items, User Products, coexistence, or unknown.
- [ ] One refresh rotation exercised safely where possible; newest encrypted generation retained.
- [ ] No seller data was modified and no credential appeared in source, git history, logs, screenshots, or this report.

## Configuration handoff

Do not send secrets through chat. For staging, set non-secret `ML_CLIENT_ID`, exact `ML_REDIRECT_URI`, and optional `ML_API_BASE_URL`; set Worker Secrets `ML_CLIENT_SECRET`, `ML_ENCRYPTION_KEY`, and `PHASE0_OPERATOR_TOKEN`. The exact callback path implemented by this branch is `/phase0/oauth/callback`. The checked-in `wrangler.jsonc` intentionally contains only placeholder host/database values.

## Gate decision

Phase 0 is **PARTIAL** until deployed Cloudflare and real MPE read-only evidence are completed and reviewed. Phase 1 must not start automatically from this branch.