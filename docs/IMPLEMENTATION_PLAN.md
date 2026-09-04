# Implementation plan

Status: Phase 0C implemented on `feat/phase-0-meli-connectivity`; no Phase 1 work is authorized.

## Completed Phase 0C slice

The branch now contains:

- pinned Wrangler `4.129.0`, Vitest `4.1.11`, and `@cloudflare/vitest-plugin` `1.1.4`;
- `wrangler.jsonc` with the `DB` D1 binding and safe placeholders;
- `vitest.config.ts` and `test/apply-migrations.ts` using the official Cloudflare Workerd/D1 test integration;
- a minimal `src/worker.ts` with three routes only;
- encrypted OAuth-verifier storage, D1 account persistence, initial encrypted credential persistence, and lease/CAS validation;
- mocked Node-native route tests plus actual local Workerd/D1 integration tests;
- `.github/workflows/phase0-quality.yml` for reproducible checks on pull requests to `main` and pushes to this branch.

No production deployment, React UI, seller write, order operation, or Phase 1 feature was added.

## Local validation sequence

Run from a clean checkout:

```text
npm ci
npm run typecheck
npm test
npm run test:worker
npm run build
npm run d1:migrate:local
```

`npm test` is the fast Node-native suite. `npm run test:worker` runs Vitest in the Cloudflare Workers pool and applies `migrations/0001_phase0_auth.sql` to local D1. `npm run d1:migrate:local` is an optional persistent local database check; both are local-only commands. `npm run build` compiles the Worker-compatible TypeScript source and runs the compiled module smoke check.

## Staging handoff (manual, not performed here)

1. Create or select the Mercado Libre developer application and authorize the intended administrator/main seller account.
2. Choose the eventual HTTPS staging hostname. Register exactly:

   `https://<staging-hostname>/phase0/oauth/callback`

   The value must match `ML_REDIRECT_URI` byte-for-byte; HTTP, fragments, alternate paths, and trailing-slash differences are not interchangeable.
3. Create a real Cloudflare D1 database and set the `DB` binding's real database ID in staging configuration. Apply the migration with Wrangler using the documented staging environment. Never use `--remote` from routine local tests.
4. Set non-secret variables `ML_CLIENT_ID`, `ML_REDIRECT_URI`, and `ML_API_BASE_URL`.
5. Set Worker Secrets without sending values through chat:

   - `ML_CLIENT_SECRET`
   - `ML_ENCRYPTION_KEY`
   - `PHASE0_OPERATOR_TOKEN`

   Generate the encryption key with the repository's Web Crypto helper or another trusted local generator; it must be a base64url-encoded 32-byte value.

   Configure secrets interactively (never put values in Git or chat):

   ```text
   npx wrangler secret put ML_CLIENT_SECRET
   npx wrangler secret put ML_ENCRYPTION_KEY
   npx wrangler secret put PHASE0_OPERATOR_TOKEN
   ```
6. Deploy only the narrow Phase 0 Worker after reviewing the diff and secret scan. Do not add Cloudflare Access solely to make this callback work; record any Access interaction as a Phase 1 decision.
7. Visit `/phase0/oauth/start` with the operator header. Complete Mercado Libre authorization in the main/admin MPE account. Mercado Libre redirects the browser to the public callback.
8. After a successful callback, call `/phase0/capability` with the operator header. Record only sanitized aggregate results and seller-model tags.
9. If refresh rotation is exercised, use a controlled test account first where supported. Do not repeat an ambiguous refresh request with the live seller credential.
10. Compare the listing count/sample against Seller Center and update `docs/PHASE0_CAPABILITY_REPORT.md` without committing tokens, titles, buyer data, or raw payloads.

The Phase 0 callback is not an application login system. A future deployment must replace the temporary operator token with the documented owner authentication boundary and protect alternate hostnames.

## Phase 0 acceptance gate

Phase 0 is PASS only after deployed Cloudflare and real MPE read-only evidence proves OAuth, `/users/me`, `site_id = MPE`, seller item count, bounded details, relevant seller tags/model, and safe refresh rotation. Automated and local Workerd/D1 success cannot produce PASS. The current status is PARTIAL because those external steps have not run.

## Explicitly deferred

Do not implement React/Vite UI, listing management, orders, analytics, market intelligence, historical snapshots, AI/image providers, MCP, PWA, or any seller/business write until Phase 0 is reviewed and Phase 1 is explicitly authorized.