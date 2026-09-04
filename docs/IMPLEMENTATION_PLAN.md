# Next implementation plan

Phase 0 implementation is limited to the branch feat/phase-0-meli-connectivity. This file describes the completed read-only harness and the remaining external gate; it does not authorize Phase 1.

## Immediate next step: complete the Phase 0 read-only capability spike

Do this before the full Phase 1 foundation because it tests the riskiest external assumptions without building product features.

### Prerequisites supplied/configured by the owner

- a Mercado Libre developer application with the exact approved HTTPS callback;
- the intended main/admin MPE seller account;
- least required read permission for identity/listings and optional read capabilities under test;
- a safe local/staging secret channel, never a committed `.env` value;
- a Cloudflare account/domain decision if the callback requires the future staging hostname.

The local probe expects these variables only when the corresponding step is run:

- ML_CLIENT_ID and ML_REDIRECT_URI for authorization URL generation;
- ML_CLIENT_SECRET, ML_AUTH_CODE, and ML_CALLBACK_STATE for server-side code exchange;
- ML_ENCRYPTION_KEY for the in-memory AES-GCM round-trip check;
- ML_ACCESS_TOKEN only for a read-only diagnostic when a token already exists;
- ML_API_BASE_URL optionally overrides the API host for a mocked/local server;
- ML_SAMPLE_SIZE is optional and bounded from 1 to 20.

Do not paste values into chat. Use an ignored local environment file or a process-local shell assignment. The exact redirect URI must be registered in the Mercado Libre application and must be HTTPS.

### Deliverable

The Phase 0 branch now contains a minimal non-production TypeScript capability harness that:

1. generates/validates state and S256 PKCE;
2. exchanges and encrypts credentials without printing them;
3. validates `/users/me` and MPE account binding;
4. proves one rotating refresh and simulates concurrent callers;
5. enumerates seller listing IDs and hydrates a bounded sample;
6. probes the read-only matrix from `MERCADOLIBRE_API.md`;
7. emits only sanitized capability outcomes and fixture candidates;
8. has Node-native unit tests for state/PKCE, pagination, schema failures, encryption, redaction-by-omission, and refresh coordination;
9. makes no item/order/shipping write call and exposes only token POST plus read-only users/items methods.

The implementation is split into small modules: oauth.ts (state/PKCE), crypto.ts (AES-GCM), memory-store.ts and d1-store.ts (credential/state persistence contracts), refresh.ts (lease/CAS refresh), meli-client.ts (narrow REST adapter), schemas.ts (runtime validation), model.ts (seller-model assessment), and probe.ts (sanitized report). migrations/0001_phase0_auth.sql is the only D1 migration.

Keep the harness disposable or place reusable OAuth/client primitives behind interfaces that can move into Phase 1. Do not build a UI, migrations beyond what the refresh proof truly needs, or a generalized SDK.

### Completion

Reconcile results manually, update API evidence/decisions, add only sanitized fixtures, run the P0 checks, and obtain an explicit P0 pass. The current status is PARTIAL because no Mercado Libre application credentials or intended seller account were available for the real read-only gate. Stop if the main seller cannot authorize, token rotation is unsafe, or listing retrieval cannot be reconciled.

## Running the proof safely

1. Run npm ci with the pinned lockfile. If the host requires system trust roots, use Node's secure `--use-system-ca` mode; never disable TLS verification.
2. Run npm run typecheck. This invokes the pinned TypeScript compiler and must fail on errors.
3. Run npm test. This uses mocked responses and never contacts Mercado Libre.
4. Run npm run build. This emits compiled JavaScript to ignored `dist/` and loads the compiled runtime modules.
5. Run npm run phase0:probe with ML_CLIENT_ID and an exact HTTPS ML_REDIRECT_URI. The command writes only an ignored .phase0-oauth.json transaction containing short-lived state/PKCE material and prints an authorization URL.
6. Complete authorization in the intended administrator/main account. Capture the code and state from the registered callback without recording the full callback URL in logs or screenshots.
7. Rerun with ML_AUTH_CODE, ML_CALLBACK_STATE, ML_CLIENT_SECRET, ML_ENCRYPTION_KEY, and the same client ID/redirect URI. The probe exchanges the code server-side, checks encryption in memory, calls users/me, confirms MPE, lists seller item IDs, hydrates at most 20 items, and emits a sanitized report.
8. Review docs/PHASE0_CAPABILITY_REPORT.md and compare the aggregate count/sample to Seller Center. Record the seller tags and item markers without committing titles, URLs, buyer data, or credentials.
9. If refresh testing is approved and safe, exercise one rotation using the durable D1 path or a controlled test account. Never retry an ambiguous rotating refresh blindly.

The harness has no callback Worker or deployed endpoint yet. A real OAuth run therefore needs an already deployed HTTPS callback that can return the code/state to the operator, or a temporary approved callback implementation. Creating that staging endpoint is a Phase 1 concern unless the owner supplies an existing registered callback.

## Recommended Phase 1 implementation sequence

After P0 passes and Phase 1 is explicitly authorized:

1. **Pin the toolchain.** Select supported Node/TypeScript/Wrangler versions and scaffold the official Cloudflare React/Vite full-stack Worker. Add the smallest router only after bundle validation.
2. **Establish checks first.** Add formatter, lint, strict typecheck, Vitest/Workers tests, React tests, build, secret scan, and CI; document exact local commands.
3. **Separate environments.** Configure local, staging, and production names/bindings without values; add safe `.dev.vars.example`; generate Worker binding types.
4. **Prove the deployment shell.** Serve one accessible SPA route and `/api/health`; deploy staging on a custom hostname with no application features.
5. **Protect the owner boundary.** Configure Cloudflare Access, validate JWT signature/issuer/audience in the Worker, and test custom/alternate hostname denial.
6. **Add minimal D1 migrations.** Implement only `accounts`, `oauth_states`, `oauth_credentials`, and `audit_events`; test empty and upgrade migration paths.
7. **Build credential cryptography.** AES-GCM with unique IV, authenticated context, key versions, redaction, and rotation-oriented tests.
8. **Implement OAuth vertically.** Start/callback/reconnect with exact MPE host, state/PKCE, safe return path, `/users/me`, wrong-site/account rejection, and encrypted storage.
9. **Implement refresh coordination.** D1 version/lease and atomic new-pair persistence; concurrency, ambiguous failure, expiry, revocation, and reconnect tests.
10. **Promote the read client.** Narrow typed identity/listing-count methods, timeouts, safe read retries, error mapping, request IDs, and no generic proxy.
11. **Expose the smallest UI.** Connection status, verified account/site, last verification, listing count, and reconnect only.
12. **Run the P1 gate.** Full automation plus manual staging Access/OAuth/count verification; update docs/decisions and stop.

## Phase 1 pull-request slices

Prefer reviewable vertical slices:

1. toolchain + CI + health deployment;
2. Access/JWT boundary;
3. D1 + encryption primitives;
4. OAuth start/callback/account binding;
5. rotating refresh/reconnect;
6. listing-count endpoint + minimal status UI + P1 evidence.

Each slice includes tests and documentation. Never merge a half-protected OAuth callback or plaintext-token intermediate state to a deployed environment.

## Explicitly not part of the next step

- listing table/detail UI;
- any Mercado Libre mutation;
- order management UI;
- analytics/comparables/snapshot scheduler;
- R2, Queue, Durable Objects, AI/image providers, MCP, or PWA;
- production data migration or external marketplace scraping.
