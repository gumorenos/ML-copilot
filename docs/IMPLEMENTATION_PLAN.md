# Implementation plan
Status: Phase 0D deployment-readiness patch implemented on `feat/phase-0-meli-connectivity`; no Phase 1 work is authorized.

## Completed Phase 0D slice

The branch now contains:

- pinned Wrangler `4.129.0`, Vitest `4.1.11`, and `@cloudflare/vitest-plugin` `1.1.4`;
- `wrangler.jsonc` with the `DB` D1 binding and safe placeholders;
- `vitest.config.ts` and `test/apply-migrations.ts` using the official Cloudflare Workerd/D1 test integration;
- a minimal `src/worker.ts` with four narrow routes, including one-time forced refresh verification;
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

`npm test` is the fast Node-native suite. `npm run test:worker` runs Vitest in the Cloudflare Workers pool and applies the checked-in migrations to local D1. `npm run d1:migrate:local` is an optional persistent local database check; both are local-only commands. `npm run build` compiles the Worker-compatible TypeScript source and runs the compiled module smoke check.

## Staging handoff (manual, not performed here)

1. Create or select the Mercado Libre developer application and authorize the intended administrator/main seller account.
2. Choose the eventual HTTPS staging hostname. Register exactly:

   `https://<staging-hostname>/phase0/oauth/callback`

   The value must match `ML_REDIRECT_URI` byte-for-byte; HTTP, fragments, alternate paths, and trailing-slash differences are not interchangeable.
3. Copy `wrangler.staging.example.jsonc` to the ignored `wrangler.staging.local.jsonc`; fill in the real staging D1 UUID, hostname, and non-secret variables. Run `npm run staging:validate` before any staging command. Routine tests continue to use `wrangler.jsonc`.
4. Apply only the staging migration, explicitly remote:

   ```text
   npx wrangler d1 migrations apply ml-copilot-phase0-staging --remote --config wrangler.staging.local.jsonc
   ```

   `--remote` is intentionally absent from local test commands.
5. Prepare an ignored `.phase0-staging-secrets.json` containing `ML_CLIENT_SECRET`, `ML_ENCRYPTION_KEY`, and `PHASE0_OPERATOR_TOKEN`. Never commit it or place its values in chat.
6. Deployment boundary: Cloudflare documents that `wrangler secret put KEY` creates a Worker version **and deploys it immediately**. Do not run those commands as a configuration-only step. For a reviewable staging release, upload code and secrets as an undeployed version, inspect it, then promote that exact version:

   ```text
   npx wrangler versions upload --config wrangler.staging.local.jsonc --secrets-file .phase0-staging-secrets.json --message phase0-staging
   npx wrangler versions list --config wrangler.staging.local.jsonc
   npx wrangler versions deploy --config wrangler.staging.local.jsonc --version-id <reviewed-version-id> -y
   ```

   `wrangler versions upload` creates a version; `wrangler versions deploy` makes it serve traffic. If the operator uses `wrangler deploy` or the dashboard Deploy action, that action publishes immediately. `wrangler versions secret put KEY` is also non-deploying but still requires a later `wrangler versions deploy`.
7. Visit `/phase0/oauth/start` with the operator header and complete Mercado Libre authorization in the main/admin MPE account.
8. Call `/phase0/capability` with the operator header and record only sanitized aggregate results.
9. Verify one rotating refresh safely with one authenticated `POST /phase0/refresh/verify` and JSON body `{"confirm":"rotate-once"}`. The endpoint rejects later attempts; ambiguous network outcomes are terminal and must not be retried blindly.
10. Compare the listing count/sample against Seller Center and update `docs/PHASE0_CAPABILITY_REPORT.md` without committing tokens, titles, buyer data, raw payloads, or complete callback URLs.

The Phase 0 callback is not an application login system. A future deployment must replace the temporary operator token with the documented owner authentication boundary and protect alternate hostnames.

## Phase 0 acceptance gate

Phase 0 is PASS only after deployed Cloudflare and real MPE read-only evidence proves OAuth, `/users/me`, `site_id = MPE`, seller item count, bounded details, relevant seller tags/model, and safe refresh rotation. Automated and local Workerd/D1 success cannot produce PASS. The current status is PARTIAL because those external steps have not run.

## Explicitly deferred

Do not implement React/Vite UI, listing management, orders, analytics, market intelligence, historical snapshots, AI/image providers, MCP, PWA, or any seller/business write until Phase 0 is reviewed and Phase 1 is explicitly authorized.
