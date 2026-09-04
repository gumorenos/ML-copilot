# ML Copilot

ML Copilot is a personal, mobile-first web application for operating one small Mercado Libre seller account in Peru. It aims to make day-to-day listing, sales, analytics, and market-review work simpler while keeping Mercado Libre as the operational source of truth.

The project is **in Phase 0: read-only connectivity proof**. The repository contains the planning baseline plus a small TypeScript harness for OAuth/PKCE helpers, encrypted credentials, rotating-refresh coordination, MPE identity/listing reads, item hydration, and seller-model classification. It is not the product UI and it cannot perform seller writes.

## Target user and scope

The initial user is one owner managing a relatively small MPE catalogue. ML Copilot is not an ERP, accounting system, warehouse platform, CRM, or multi-tenant SaaS.

Planned capabilities are grouped into these areas:

- seller-account connection through Mercado Libre OAuth;
- listing discovery, inspection, safe editing, creation, duplication, and relisting;
- recent orders and simple sales metrics;
- deterministic listing and sales analytics;
- explainable comparable-listing analysis and historical market snapshots;
- later, grounded text and image assistance with preview and explicit apply;
- later, a natural-language copilot that cannot silently execute writes.

See [Product specification](docs/PRODUCT_SPEC.md) for the complete scope and exclusions.

## Safety invariants

- The application never collects or stores a Mercado Libre password.
- Mercado Libre client secrets and tokens never reach frontend code, Git, or logs.
- Every material write is prepared and previewed, explicitly confirmed, revalidated server-side, executed once, verified, and audited.
- AI output is a proposal. It cannot silently change a listing or invent product facts.
- Original images are preserved; image transformations must not misrepresent the product.
- Real-account destructive tests are never run casually.

The detailed threat model and controls are in [Security](docs/SECURITY.md).

## Proposed architecture

The current proposal is intentionally small:

```text
Owner browser
  -> Cloudflare Access
  -> one Cloudflare Worker
       - React/Vite static application
       - TypeScript 5.9.3 (development compiler) API and scheduled handler
       - application/domain services
       - Mercado Libre REST client
       - D1 repositories
  -> Mercado Libre API

Cloudflare Cron Triggers -> same Worker -> snapshot/reconciliation jobs
D1 -> OAuth metadata, encrypted tokens, app state, snapshots, audit data
R2 -> deferred until original/derived image storage is justified
```

The web UI calls the application API, not an MCP server. An optional MCP adapter may be added later over the same service layer. No VPS, production Docker, Kubernetes, Redis, Postgres, Supabase, queue, or microservice is currently justified.

See [Architecture](docs/ARCHITECTURE.md), [conceptual data model](docs/DATA_MODEL.md), and [decision log](docs/DECISIONS.md).

## Intended development stack

- TypeScript 5.9.3 (development compiler)
- @types/node 26.4.1 (development-only Node typings)
- React and Vite
- one Cloudflare Worker serving the SPA and `/api/*`
- Cloudflare D1 with versioned SQL migrations
- Workers Secrets and Web Crypto for credential protection
- Cloudflare Cron Triggers for scheduled snapshots
- R2 only if the image phase requires private original/preview storage
- a lightweight Workers-compatible HTTP router, provisionally Hono
- Node native test runner is used for the current proof to avoid an unverified dependency stack. Vitest, Workers test tooling, React Testing Library, and Playwright remain Phase 1 choices.

The Phase 0 compiler dependencies are pinned in package.json/package-lock.json. The Cloudflare Worker, React, Vite, router, and deployment toolchain remain deferred until Phase 1 is authorized.

## Local setup

The current proof is runnable with Node 24 or newer:

1. Clone the repository.
2. Read this file and [AGENTS.md](AGENTS.md).
3. Run npm ci to install the pinned development toolchain.
4. Run npm run typecheck for strict static TypeScript validation.
5. Run npm test for the mocked security/API matrix.
6. Run npm run build to emit dist/ and load the compiled runtime modules.
7. Review [Phase 0 capability report](docs/PHASE0_CAPABILITY_REPORT.md).
8. To start the real read-only check, configure the local variables documented in [Implementation plan](docs/IMPLEMENTATION_PLAN.md) and run npm run phase0:probe.
9. Obtain explicit authorization before starting Phase 1.

The probe first prints an authorization URL and creates an ignored short-lived transaction file. After the owner completes authorization, rerun it with the returned code and callback state. Local secret files such as .dev.vars and .env are ignored and must never be committed.

## Deployment model

The planned deployment is a single Cloudflare Workers project on a custom HTTPS hostname. Cloudflare Access will restrict the owner-facing application. The Worker will validate Access JWTs as defense in depth. Any endpoint that must be public, such as a Mercado Libre notification receiver, will have a narrowly scoped policy and its own application-level validation.

D1 is expected to be sufficient for the personal workload. Cron Triggers will run bounded, checkpointed history jobs. R2 and Queues remain deferred decisions rather than default infrastructure.

## Repository map

```text
.
|-- AGENTS.md                 durable instructions for coding agents
|-- README.md                 human entry point
|-- migrations/               minimal Phase 0 D1 schema
|-- scripts/                  read-only probe and runtime checks
|-- src/                      OAuth, crypto, refresh, API, schemas, and tests
`-- docs/
    |-- ARCHITECTURE.md       system design and module boundaries
    |-- DATA_MODEL.md         initial conceptual D1 model
    |-- DECISIONS.md          lightweight architectural decision log
    |-- GITHUB_REUSE.md       audited open-source reuse assessment
    |-- IMPLEMENTATION_PLAN.md next controlled coding sequence
    |-- PHASE0_CAPABILITY_REPORT.md read-only gate template and current status
    |-- MERCADOLIBRE_API.md   endpoint evidence and open questions
    |-- PRODUCT_SPEC.md       product behavior, scope, and invariants
    |-- QA.md                 test strategy and phase gates
    |-- RESEARCH_SOURCES.md   dated primary-source index
    |-- ROADMAP.md            phased delivery plan
    `-- SECURITY.md           threat model and security controls
```

## Current limitations

- No Mercado Libre application credentials or seller account were available in this work session. The real MPE read-only gate is therefore pending.
- Private MPE endpoint behavior, seller/listing model, and all write behavior still require controlled verification.
- Unauthenticated requests to several nominally public MPE resources returned `403` during a dated probe; authenticated behavior remains to be tested.
- Real TypeScript typechecking is now available through the pinned compiler and passes for the current Phase 0 code. The build emits compiled JavaScript to ignored dist/ and performs a compiled runtime-module smoke check.
- API availability, quotas, response fields, category-specific rules, and Cloudflare account configuration can vary and must be checked at implementation time.
- No UI language, accessibility baseline beyond WCAG intent, AI provider, or image provider has been selected.
- The repository has no selected open-source license; no third-party source code has been copied.

## Continue from here

Do not start feature development from a broad interpretation of the product vision. First complete the real read-only Phase 0 capability spike and record its evidence. The exact runbook and stop conditions are in [Implementation plan](docs/IMPLEMENTATION_PLAN.md); acceptance gates are in [QA](docs/QA.md).

When behavior or architecture changes, update the relevant documentation and [decision log](docs/DECISIONS.md) in the same change.

## Documentation

- [Product specification](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Mercado Libre API research](docs/MERCADOLIBRE_API.md)
- [Open-source reuse assessment](docs/GITHUB_REUSE.md)
- [Security](docs/SECURITY.md)
- [QA and acceptance gates](docs/QA.md)
- [Decision log](docs/DECISIONS.md)
- [Research sources](docs/RESEARCH_SOURCES.md)
- [Next implementation plan](docs/IMPLEMENTATION_PLAN.md)
