# Quality assurance and acceptance gates

## Evidence levels

Every result is labeled separately:

- **AUTOMATED / UNIT**: Node-native contract, crypto, OAuth, client, refresh, probe, and Worker route tests with synthetic data.
- **LOCAL WORKER+D1 INTEGRATION**: official Cloudflare Vitest plugin running Workerd against the real Phase 0 migration and local D1 engine.
- **DEPLOYED CLOUDFLARE**: a staging Worker and D1 account; not run in this task.
- **REAL MPE READ-ONLY**: the intended administrator/main seller account through the deployed callback; not run in this task.

No mock or local result is presented as deployed or real-account evidence.

## Current Phase 0C checks

Required local commands are:

```text
npm ci
npm run typecheck
npm test
npm run test:worker
npm run build
npm run d1:migrate:local
```

Current results in this work session:

- `npm ci`: completed with the pinned lockfile using Node secure system-CA support; no TLS bypass; 0 audit vulnerabilities reported.
- `npm run typecheck`: real TypeScript compiler, 0 errors.
- `npm test`: 46/46 passed (Node native; mocked API and D1-shaped contracts).
- `npm run test:worker`: 8/8 passed (local Workerd/D1; migration applied by setup).
- `npm run build`: TypeScript emitted compiled JavaScript and the compiled runtime smoke check passed.
- `npm run d1:migrate:local`: migration `0001_phase0_auth.sql` applied successfully to the local-only Wrangler database.
- `npx wrangler deploy --dry-run --outdir .wrangler/dry-run`: Worker bundle validation passed; no deployment occurred.
- `git diff --check` and secret-pattern scan remain mandatory before commit.

## Automated / mocked coverage

Keep tests for state/PKCE, HTTPS redirects, returned `expires_in`, AES-GCM authenticated context, plaintext omission, rotating refresh replacement, stale writers, lease recovery/failure, large opaque identifiers, MPE parsing, pagination, multiget bound, malformed responses, 401/403/429, retry-after, network failure, seller-model classification, sanitized probe output, route authorization, callback replay/error/wrong-site/success paths, protected capability, bounded hydration, and route redaction.

Use only synthetic values. Do not point routine tests at Mercado Libre or a live seller. Read-only upstream mocks may return 401/403/429 and malformed JSON; writes are absent.

## Local Workerd/D1 integration coverage

`test/d1.integration.test.ts` applies the checked-in migration and proves: required tables exist; OAuth state is inserted and consumed once; expired state is rejected; encrypted credentials persist/read without plaintext; exactly one lease wins; stale credential generation cannot overwrite; expired lease recovery works; and malformed encrypted/partial-lease data fails closed. This is local engine evidence, not deployed D1 evidence.

## CI

`.github/workflows/phase0-quality.yml` runs on pull requests targeting `main` and pushes to `feat/phase-0-meli-connectivity`. It performs `npm ci`, typecheck, Node tests, Worker+D1 tests, build, and `git diff --check`. It has read-only repository permissions and no Mercado Libre or Cloudflare secrets; it does not deploy.

## Real-account safety

The real MPE gate may perform only OAuth token exchange/refresh and read-only `/users/me`, seller search, and item reads. Never create or modify listings, price, stock, descriptions, images, status, orders, shipping, messages, or purchases. Use a test user for future write scenarios where the platform supports one. Do not capture credentials, raw payloads, buyer data, or complete callback URLs.

## Phase gates

- **Phase 0C local gate**: the automated and local Workerd/D1 checks above pass, the Worker routes are documented, and the branch remains read-only.
- **Phase 0 external gate**: staging deployment plus real MPE read-only checklist in `docs/PHASE0_CAPABILITY_REPORT.md`; required for PASS.
- **Phase 1 gate**: only after explicit authorization, adds the application shell, Access/JWT boundary, and minimal connection UI. It is not started here.

## Review checklist

Before committing or pushing, inspect the full diff; run checks from a clean install when practical; scan for secret patterns and account-specific data; verify relative documentation links and phase/status consistency; and confirm no generated `.wrangler`, `dist`, local vars, credentials, or database exports are tracked.