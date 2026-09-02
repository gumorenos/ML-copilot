# Open-source reuse assessment

Assessment date: 2026-09-01. Repositories were inspected at the commits listed below. Maintenance status and dependencies can change; recheck before reuse.

No third-party source code was copied into ML Copilot during this bootstrap. Concepts are not a substitute for verifying current official Mercado Libre contracts.

## Decision summary

Use Mercado Libre's official REST API directly from ML Copilot's backend. Do not make an MCP server or an existing seller platform the application's internal transport. Reuse design ideas and test cases selectively; do not adopt any inspected package as the Phase 1 production client without a new compatibility/security review.

| Repository | Inspected commit | License evidence | MPE | Reuse decision |
|---|---|---|---|---|
| `mercadolibre/mercadolibre-mcp-server` | `6991a0d6` (2025-10-01) | no license file found | documentation search only | hosted research aid; no source to reuse |
| `MarcosNahuel/mercadolibre-mcp` | `fcff6137` (2026-07-31) | MIT file | not listed; generic setting only | concepts only |
| `ar-agents/ar-agents` Mercado Libre package | `38b95ef6` (2026-07-28) | MIT file | explicitly modeled | concepts; selected code only after review/attribution |
| `mercadolibre/nodejs-sdk` | `82c62056` (2021-03-07) | package says MIT; no repo license file found | old generic SDK | do not use; deprecated |
| `dan1d/mercadolibre-mcp` | `a085460f` (2026-03-08) | MIT file | explicitly listed | endpoint/test ideas only |
| `ralvarezdev/mercadolibre-go-sdk` | `d88a115a` (2026-06-12) | MIT file | explicitly modeled | strong concepts/checklist; wrong runtime |

### Functional coverage observed

“None” means no dedicated implementation was found in the inspected source, not that the upstream API lacks the capability.

| Repository | OAuth and refresh | Seller listings / orders / visits | Price or stock writes | Market/competitor support | Test and security signal |
|---|---|---|---|---|---|
| Official MCP | hosted OAuth/bearer; refresh is opaque to clients | none; documentation tools only | none | documentation search only | no source, tests, or license to audit |
| MarcosNahuel MCP | accepts Supabase/static credentials or performs refresh; cross-process lease only with Supabase; no inspected authorization callback/PKCE | listings, orders, item visits/metrics | yes | keyword marketplace search, catalogue price-to-win, price-history endpoint | six test files, no CI found; writes happen before its returned “confirmation” |
| ar-agents package | authorization code + rotating refresh/store; inspected URL builder lacks PKCE; refresh coalescing is per isolate unless host store adds atomicity | listings and orders; no dedicated visits module found | item create/update including price/stock | no dedicated explainable comparable module found | 19 package tests and monorepo CI; HITL defaults to approved when callback is absent |
| Deprecated official Node SDK | old OAuth helpers and generic REST methods | only generic old methods, not a current seller-domain client | generic POST/PUT/DELETE | generic GET only | 13 tests, no current CI; officially deprecated/non-functional |
| dan1d MCP | optional static token; no OAuth callback or refresh | no seller inventory, orders, or visits | none | read-only marketplace item search, categories, trends, currencies | five tests and CI; simplistic client/no robust schemas or retries |
| Go SDK | authorization code + PKCE, rotating refresh store/single-flight | typed listing scan, orders, and item/user visits | typed item price/stock/update | public site search/trends; no ML Copilot-style comparable engine | CI, nine root test files and integration harness; new/small project and wrong runtime |

## Official Mercado Libre MCP server

Repository: [mercadolibre/mercadolibre-mcp-server](https://github.com/mercadolibre/mercadolibre-mcp-server)

The current official [MCP documentation](https://developers.mercadolibre.com.ar/en_us/start-testing/mcp-server) describes a hosted server at `https://mcp.mercadolibre.com/mcp` with OAuth/bearer access. Its currently documented tools search and fetch Mercado Libre developer documentation; they are not seller listing/order/write tools.

The inspected repository contained one README and no implementation, tests, or license file. It can help an agent research documentation, but it offers no licensable client code and is not an operational backend. ML Copilot's web UI will not depend on it.

## MarcosNahuel/mercadolibre-mcp

Repository: [MarcosNahuel/mercadolibre-mcp](https://github.com/MarcosNahuel/mercadolibre-mcp)

### Findings

- TypeScript/Node ESM MCP server; inspected package version `1.2.0-alpha.2`.
- MIT license present.
- Recent inspected commit, but no CI workflow was found; six test files were present.
- Uses Supabase and a multi-tenant MCP-oriented token/store architecture.
- README lists MLA, MLU, MLB, MLC, MLM, MCO, and CBT, but not MPE. The code accepts a generic site environment value, so Peru is plausible but unverified—not supported evidence.
- Covers seller products, orders, questions, price/stock, metrics, competitors, reputation, and ads.

### Useful concepts

- a lease/version approach to rotating-token single-flight;
- pagination and item multiget helpers;
- retry/backoff and redaction patterns;
- deterministic stockout-risk calculations;
- an explicit tool restriction surface.

### Blocking incompatibilities

- Supabase and the MCP transport conflict with the selected Worker/D1 service architecture.
- Inspected `update_price` and `update_stock` methods performed the upstream write before returning data described as confirmation. That is post-action reporting, not pre-write confirmation, and violates ML Copilot's central invariant.
- Price updates are too generic for current price-automation behavior.
- The destructive-tool allowlist restricts available methods but does not prove explicit user confirmation.
- Tests are primarily mocked and do not establish MPE compatibility.

Decision: no direct dependency or fork. Adapt concepts only, from scratch, with official endpoint evidence and ML Copilot tests.

## ar-agents Mercado Libre package

Repository: [ar-agents/ar-agents, `packages/mercadolibre`](https://github.com/ar-agents/ar-agents/tree/main/packages/mercadolibre)

### Findings

- TypeScript ESM package, inspected version `0.6.1`, Node 20+, MIT.
- MPE is represented in site types and authorization host mappings.
- The package had 19 local test files; the monorepo included CI and scheduled integration workflows.
- Includes OAuth storage interfaces, schemas, pagination, retry policy, webhook support, telemetry redaction, and human-in-the-loop hooks.
- Depends on monorepo core packages and peers such as the AI SDK and Zod; its Cloudflare Worker bundle/runtime compatibility was not established.

### Useful concepts

- narrow store interfaces and validated resource schemas;
- safe-by-default retry rules for idempotent operations;
- structured telemetry redaction;
- pagination and webhook test cases;
- MPE site/host fixtures.

### Blocking incompatibilities

- Cross-isolate refresh correctness remains the host/store's responsibility; an in-process single-flight is insufficient for Workers.
- The inspected HITL gate treats a missing HITL callback as approved. ML Copilot requires missing confirmation to fail closed.
- The inspected authorization URL builder did not expose PKCE challenge parameters.
- Runtime/bundle compatibility and upstream endpoint currency still need proof.

Decision: best TypeScript concept reference inspected, but not a Phase 1 dependency. Re-evaluate individual MIT-licensed utilities only if adaptation costs more than a clean Workers-native client, then document attribution and add contract tests.

## Official deprecated Node SDK

Repository: [mercadolibre/nodejs-sdk](https://github.com/mercadolibre/nodejs-sdk)

The official repository states that Mercado Libre SDKs stopped being maintained in April 2021 and the project is not functional. The inspected code was last updated in 2021, used an old Node API surface, and had no current CI. Package metadata says MIT, but the cloned repository contained no standalone license file.

Decision: do not depend on or copy it. At most, use old tests as historical endpoint clues that must be reconfirmed officially.

## dan1d/mercadolibre-mcp

Repository: [dan1d/mercadolibre-mcp](https://github.com/dan1d/mercadolibre-mcp)

This is a small MIT TypeScript, read-only MCP server. Its README explicitly includes MPE and it had CI plus five tests. The client is a simple GET wrapper with an optional static token; it has no OAuth refresh, robust retry/rate-limit policy, or comprehensive response validation. Its anonymous-public-access assumption is contradicted by ML Copilot's dated `403` probe and must not be adopted.

Decision: no dependency. Endpoint mappings and fixture ideas may inform Phase 0, after official verification.

## ralvarezdev/mercadolibre-go-sdk

Repository: [ralvarezdev/mercadolibre-go-sdk](https://github.com/ralvarezdev/mercadolibre-go-sdk)

This recent MIT Go SDK explicitly models MPE and includes OAuth PKCE, rotating-refresh single-flight, `429`/`5xx` handling with `Retry-After`, pagination, typed resources, tests, CI, and an integration harness. It is a young/small project and uses the wrong runtime for Cloudflare Workers.

Decision: no code reuse. Use it as a strong behavior/test checklist, especially for refresh races, retries, pagination, and MPE mapping, while validating every endpoint against official documentation.

## Reuse rules for future work

Before copying or adding any third-party dependency:

1. inspect the exact version/commit and repository license file;
2. confirm license compatibility with ML Copilot's license, which has not yet been selected;
3. create an attribution record where required;
4. scan dependency and transitive security posture;
5. prove Cloudflare Workers runtime/bundle compatibility;
6. compare endpoint behavior with current official docs and MPE fixtures;
7. prove token redaction, refresh concurrency, and fail-closed confirmation;
8. prefer a narrow extracted utility over adopting an entire MCP/Supabase/agent architecture.

Until a project license is selected, concepts may be learned from, but third-party source should not be copied.
