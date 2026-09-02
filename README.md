# ML Copilot

ML Copilot is a personal, mobile-first web application for operating one small Mercado Libre seller account in Peru. It aims to make day-to-day listing, sales, analytics, and market-review work simpler while keeping Mercado Libre as the operational source of truth.

The project is **in Phase 0: research and architecture**. There is no application implementation yet. The repository currently contains the verified research, product boundaries, architecture proposal, safety rules, QA gates, and implementation sequence needed to begin development deliberately.

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
       - TypeScript API and scheduled handler
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

- TypeScript
- React and Vite
- one Cloudflare Worker serving the SPA and `/api/*`
- Cloudflare D1 with versioned SQL migrations
- Workers Secrets and Web Crypto for credential protection
- Cloudflare Cron Triggers for scheduled snapshots
- R2 only if the image phase requires private original/preview storage
- a lightweight Workers-compatible HTTP router, provisionally Hono
- Vitest, Workers test tooling, React Testing Library, and Playwright where appropriate

Versions and exact package choices will be pinned and validated when Phase 1 is authorized. They are not implied to be installed today.

## Local setup

There is no runnable application yet. For the documentation-only Phase 0 repository:

1. Clone the repository.
2. Read this file and [AGENTS.md](AGENTS.md).
3. Review [Roadmap](docs/ROADMAP.md) and the unresolved items in [Mercado Libre API research](docs/MERCADOLIBRE_API.md).
4. Obtain explicit authorization before starting the next phase.

Phase 1 will add reproducible Node, Wrangler, D1, test, and local-secret setup instructions. Local secret files such as `.dev.vars` and `.env` are ignored and must never be committed.

## Deployment model

The planned deployment is a single Cloudflare Workers project on a custom HTTPS hostname. Cloudflare Access will restrict the owner-facing application. The Worker will validate Access JWTs as defense in depth. Any endpoint that must be public, such as a Mercado Libre notification receiver, will have a narrowly scoped policy and its own application-level validation.

D1 is expected to be sufficient for the personal workload. Cron Triggers will run bounded, checkpointed history jobs. R2 and Queues remain deferred decisions rather than default infrastructure.

## Repository map

```text
.
|-- AGENTS.md                 durable instructions for coding agents
|-- README.md                 human entry point
`-- docs/
    |-- ARCHITECTURE.md       system design and module boundaries
    |-- DATA_MODEL.md         initial conceptual D1 model
    |-- DECISIONS.md          lightweight architectural decision log
    |-- GITHUB_REUSE.md       audited open-source reuse assessment
    |-- IMPLEMENTATION_PLAN.md next controlled coding sequence
    |-- MERCADOLIBRE_API.md   endpoint evidence and open questions
    |-- PRODUCT_SPEC.md       product behavior, scope, and invariants
    |-- QA.md                 test strategy and phase gates
    |-- RESEARCH_SOURCES.md   dated primary-source index
    |-- ROADMAP.md            phased delivery plan
    `-- SECURITY.md           threat model and security controls
```

## Current limitations

- No Mercado Libre application credentials or seller account were used during this bootstrap.
- Private MPE endpoints and all write behavior still require controlled real-account verification.
- Unauthenticated requests to several nominally public MPE resources returned `403` during a dated probe; authenticated behavior remains to be tested.
- API availability, quotas, response fields, category-specific rules, and Cloudflare account configuration can vary and must be checked at implementation time.
- No UI language, accessibility baseline beyond WCAG intent, AI provider, or image provider has been selected.
- The repository has no selected open-source license; no third-party source code has been copied.

## Continue from here

Do not start feature development from a broad interpretation of the product vision. First complete the read-only Phase 0 capability spike and record its evidence. The immediate next step is defined in [Implementation plan](docs/IMPLEMENTATION_PLAN.md); acceptance gates are in [QA](docs/QA.md).

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
