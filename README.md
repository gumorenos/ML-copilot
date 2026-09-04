# ML Copilot

ML Copilot is a personal, mobile-first web application for operating one small Mercado Libre seller account in Peru. Mercado Libre remains the operational source of truth; ML Copilot is not an ERP, accounting system, warehouse platform, CRM, or multi-tenant SaaS.

## Current status

The repository is on **Phase 0C: read-only connectivity proof hardening**. This branch contains a narrow OAuth/capability Worker, encrypted credential and refresh-coordination primitives, a typed read-only Mercado Libre adapter, deterministic seller-model classification, mocked route tests, and real local Workerd/D1 integration tests.

Overall Phase 0 is **PARTIAL**. Automated and local Worker+D1 evidence pass. No staging deployment or real MPE seller-account verification has been performed in this work session. Phase 1 and seller-data writes are not started or authorized.

## Scope and safety

The intended user is one owner with a relatively small MPE catalogue. Planned later areas are listing operations, sales, deterministic analytics, market intelligence, grounded text/image assistance, and a controlled natural-language copilot.

The current implementation is strictly read-only with respect to seller/business data. It has no listing, price, stock, description, image, order, shipping, message, pause, activate, close, relist, or purchase operation. Token exchange and refresh POSTs are authentication operations only.

Secrets and tokens stay server-side. Mercado Libre passwords are never collected. Material writes, when a later phase is explicitly authorized, must use a preview, confirmation, revalidation, verification, and audit record.

## Phase 0C architecture

```text
Operator (temporary header)
  -> Phase 0 Cloudflare Worker
       - /phase0/oauth/start       protected
       - /phase0/oauth/callback    public browser callback
       - /phase0/capability        protected read-only probe
       - OAuth/PKCE and safe response handling
       - Mercado Libre typed read-only client
       - D1 repositories
  -> Mercado Libre API

Worker Secrets: ML_CLIENT_SECRET, ML_ENCRYPTION_KEY, PHASE0_OPERATOR_TOKEN
Worker variables: ML_CLIENT_ID, ML_REDIRECT_URI, ML_API_BASE_URL
D1 binding: DB
```

The callback is public only because Mercado Libre must redirect to it. It validates one-time state and S256 PKCE, exchanges the code server-side, confirms `site_id = MPE`, encrypts credentials with AES-GCM, and returns a generic page. The capability route uses the rotating refresh lease/CAS mechanism, calls `/users/me`, searches seller item IDs, hydrates at most five items for the report (and never more than the API multiget limit of 20), and returns sanitized aggregate evidence.

The future application remains a single Cloudflare Worker with React/Vite static assets, service boundaries, D1, Worker Secrets, and optional R2 only when image storage is justified. Cloudflare Access is a Phase 1 owner-authentication decision; it is not required for this temporary proof.

## Development stack

- Node 24.x (current validated environment)
- TypeScript 5.9.3 and `@types/node` 26.4.1
- Cloudflare Wrangler 4.129.0
- `@cloudflare/vitest-plugin` 1.1.4 and Vitest 4.1.11 for local Workerd/D1 integration
- Node native test runner for fast contract and Worker route mocks
- Cloudflare D1 migration `migrations/0001_phase0_auth.sql`
- Web Crypto AES-GCM for application-level credential encryption

The React UI, Vite application shell, router, Access JWT boundary, production deployment, and all later product features remain deferred to Phase 1 or later.

## Local checks

From a clean checkout:

```text
npm ci
npm run typecheck
npm test
npm run test:worker
npm run build
npm run d1:migrate:local   # optional persistent Wrangler D1 check
```

`npm test` is the Node-native unit/contract suite. `npm run test:worker` runs the official Cloudflare Vitest plugin against local Workerd/D1 and applies the migration in `test/apply-migrations.ts`. `npm run build` emits ignored `dist/` JavaScript and loads the compiled runtime modules. The npm registry may require Node's secure system-CA mode on this host (`NODE_OPTIONS=--use-system-ca`); never disable TLS verification.

Copy `.dev.vars.example` to a local ignored `.dev.vars` only for an explicitly configured staging proof. Do not paste secrets into chat or commit local values.

## Phase 0 Worker routes

| Route | Exposure | Purpose |
|---|---|---|
| `GET /phase0/oauth/start` | temporary operator token | Create one-time state/PKCE and redirect to the MPE authorization host |
| `GET /phase0/oauth/callback` | public callback | Consume state, exchange code server-side, confirm MPE, persist encrypted credentials |
| `GET /phase0/capability` | temporary operator token | Read `/users/me`, seller listing IDs, bounded item details, and seller-model evidence |

Use `X-Phase0-Operator-Token: <value>` or `Authorization: Bearer <value>` for protected routes. The operator token is a staging guard, not the future application authentication model.

## Staging configuration (not deployed by this task)

Register the exact HTTPS redirect URI:

```text
https://<staging-hostname>/phase0/oauth/callback
```

Set non-secret Worker variables `ML_CLIENT_ID`, `ML_REDIRECT_URI`, and optionally `ML_API_BASE_URL`. Set Worker Secrets `ML_CLIENT_SECRET`, `ML_ENCRYPTION_KEY` (base64url-encoded 256-bit key), and `PHASE0_OPERATOR_TOKEN` with Wrangler. The D1 binding is named `DB`, with database name `ml-copilot-phase0`; use a real database ID only in staging configuration, never in this repository's placeholder file. No deployment is performed here.

## Repository map

```text
.
|-- .github/workflows/phase0-quality.yml  independent quality CI
|-- migrations/                            minimal Phase 0 D1 schema
|-- scripts/                               read-only probe and build checks
|-- src/                                   OAuth, crypto, refresh, API, Worker, schemas, tests
|-- test/                                  local Workerd/D1 setup and integration tests
|-- wrangler.jsonc                         Worker/D1 config with safe placeholders
|-- vitest.config.ts                       official Cloudflare test configuration
`-- docs/                                  product, architecture, API, security, QA, decisions, evidence
```

## Documentation

- [Product specification](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Conceptual data model](docs/DATA_MODEL.md)
- [Mercado Libre API evidence](docs/MERCADOLIBRE_API.md)
- [Security](docs/SECURITY.md)
- [QA and acceptance gates](docs/QA.md)
- [Roadmap](docs/ROADMAP.md)
- [Phase 0 capability report](docs/PHASE0_CAPABILITY_REPORT.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Research sources](docs/RESEARCH_SOURCES.md)
- [Open-source reuse assessment](docs/GITHUB_REUSE.md)
- [Decision log](docs/DECISIONS.md)
- [Agent instructions](AGENTS.md)

## How to continue

Read `AGENTS.md` and the listed documentation before changing code. Keep Phase 0 read-only, update evidence when behavior changes, run all applicable checks, and stop at the documented Phase 0 external gate. Do not start Phase 1 or add UI/product features from this branch without explicit instruction.