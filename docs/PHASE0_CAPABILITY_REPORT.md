# Phase 0 capability report

Status: PARTIAL (2026-09-03)

This file is a review artifact, not an application feature. It records what the Phase 0 branch can prove, what was tested with mocks, and what still requires the owner's approved Mercado Libre application and intended MPE seller account. It must never contain access tokens, refresh tokens, client secrets, authorization codes, buyer data, or a complete private seller payload.

Automated result for this branch: npm test passed 26/26 tests; npm run build passed the runtime module-load check. Static TypeScript typechecking was not available because the compiler is not installed in the checkout. No real MPE read-only call was run.

## Scope and safety

The proof is strictly read-only with respect to Mercado Libre seller/business data. The adapter contains token exchange/refresh POST calls and read-only users/items calls only. It has no listing, order, shipping, message, image, price, stock, pause, activate, close, relist, or purchase operation.

The intended chain is:

MPE seller account -> OAuth Authorization Code + S256 PKCE + state -> server-side token exchange -> authenticated users/me -> site MPE -> seller item IDs -> bounded item-detail sample -> seller model classification.

## Evidence classification

| Area | Automated / mocked | Real MPE read-only | Current result |
|---|---|---|---|
| Authorization URL and exact HTTPS redirect | Tested | Not run | PASS in mock; external gate pending |
| state one-time consumption and expiry | Tested | Not applicable | PASS |
| S256 PKCE verifier/challenge | Tested | Not applicable | PASS |
| token exchange and returned expires_in | Request/response mocked | Not run | PASS in mock; external gate pending |
| encrypted credential round-trip | AES-GCM tested | Not run with real token | PASS with synthetic tokens |
| rotating refresh replacement | Mocked rotating response | Not run against account | PASS in mock; external gate pending |
| concurrent refresh serialization | Two managers, one mocked upstream refresh | Not run in deployed D1 | PASS in memory store; D1 integration pending |
| users/me parsing and MPE detection | MPE and wrong-site fixtures | Not run | PASS in mock; external gate pending |
| seller item search/pagination parsing | Fixture with opaque IDs and paging | Not run | PASS in mock; external gate pending |
| representative item detail parsing | Multiget success plus per-item failure | Not run | PASS in mock; external gate pending |
| legacy/User Products/coexistence classifier | Marker/tag fixtures | Not run | PASS in mock; account model unknown |

## Real MPE read-only checklist

Complete only with the intended administrator/main account and a registered HTTPS callback. Record aggregate facts and sanitized field-presence results, not raw private payloads.

- [ ] OAuth authorization completed with the intended administrator/main account.
- [ ] Callback state matched and was consumed once; PKCE verifier was accepted.
- [ ] Server-side token exchange succeeded; returned expires_in was used.
- [ ] users/me succeeded and site_id was MPE.
- [ ] User ID and relevant tags were recorded as opaque strings, including user_product_seller, warehouse_management, and multiwarehouse when present.
- [ ] users/{seller_id}/items/search succeeded; total, first-page size, paging, and any scroll behavior were recorded.
- [ ] A small item sample was hydrated; available status/condition/price/stock/pictures/attributes and User Product markers were summarized.
- [ ] Seller model was classified as legacy Items, User Products, coexistence, or unknown with evidence.
- [ ] One refresh rotation was exercised safely, preferably first with an approved Mercado Libre test user; newest credentials replaced the old generation.
- [ ] No seller data was modified and no credential appeared in source, git history, logs, screenshots, or this report.

## Configuration handoff

Do not send secrets through chat. The local probe reads process-local variables described in docs/IMPLEMENTATION_PLAN.md:

- ML_CLIENT_ID and ML_REDIRECT_URI to print the authorization URL;
- ML_CLIENT_SECRET, ML_AUTH_CODE, and ML_CALLBACK_STATE to exchange a callback code;
- ML_ENCRYPTION_KEY to exercise the in-memory AES-GCM check;
- ML_ACCESS_TOKEN only for a deliberately read-only diagnostic mode;
- ML_API_BASE_URL and ML_SAMPLE_SIZE are optional bounded test controls.

The registered redirect URI must exactly equal ML_REDIRECT_URI and use HTTPS. The current branch does not deploy an OAuth callback Worker; it therefore needs an existing approved callback or a separately authorized staging callback before the real run.

## Reviewable implementation inventory

- src/oauth.ts and src/oauth.test.ts: state, S256 PKCE, MPE authorization URL.
- src/crypto.ts and src/crypto.test.ts: AES-GCM encryption with authenticated account context.
- src/refresh.ts, src/memory-store.ts, src/d1-store.ts, and src/refresh.test.ts: rotating refresh lease/CAS contract and race tests.
- src/meli-client.ts and src/meli-client.test.ts: narrow REST adapter, runtime response validation, bounded read retries, and error mapping.
- src/model.ts and src/model.test.ts: conservative seller-model classification.
- src/probe.ts and src/probe.test.ts: sanitized MPE read-only capability report.
- scripts/phase0-probe.ts: operator-run read-only probe; no UI or seller mutation route.
- migrations/0001_phase0_auth.sql: minimal auth/state D1 schema only.
- docs/: durable design, evidence, security, QA, roadmap, and reuse documentation.

## Gate decision

Phase 0 cannot be marked PASS from mocked tests. It remains PARTIAL until the real MPE checklist is completed and reviewed. Phase 1 must not start automatically from this branch.
