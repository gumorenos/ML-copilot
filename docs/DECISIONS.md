# Decision log

Lightweight ADR format. “Accepted” means the current project direction; “Provisional” requires the stated validation before it becomes final. Superseded entries remain for history.

## ADR-001 — One Cloudflare Worker deployment

- Date: 2026-09-01
- Status: Provisional through Phase 1 build/deploy gate
- Decision: Deploy one TypeScript Worker containing the React/Vite static application, API routes, application services, and scheduled handler. Use D1 and Worker Secrets; defer R2 until images.
- Alternatives: VPS; separate frontend/API Workers; container platform; multi-service architecture.
- Evidence: Cloudflare's current React guide and Vite plugin support a full-stack SPA plus Worker API and bindings in one deployment; personal scale does not justify operational separation.
- Rationale: Smallest operational surface that meets the product and target-platform requirements.
- Consequences: Strong internal module boundaries are important; Worker/runtime limits and build compatibility must be verified in Phase 1. Split only with measured evidence and a new ADR.

## ADR-002 — Direct Mercado Libre REST adapter, not MCP transport

- Date: 2026-09-01
- Status: Accepted
- Decision: The backend calls documented Mercado Libre REST resources through a narrow typed adapter. The UI calls ML Copilot's API. A future MCP adapter may invoke the same application services.
- Alternatives: Official hosted MCP as seller backend; community MCP server; fork an existing integration.
- Evidence: The official MCP currently exposes documentation-search tools, while inspected community servers carry incompatible transports/storage and safety assumptions.
- Rationale: Direct ownership of OAuth, capability checks, confirmation, errors, and audit is simpler and safer.
- Consequences: ML Copilot must maintain endpoint schemas/tests; no generic upstream proxy is permitted.

## ADR-003 — Mercado Libre remains operational source of truth

- Date: 2026-09-01
- Status: Accepted
- Decision: Fetch current listing/order state upstream and persist only app configuration, encrypted credentials, safety/audit state, minimal justified facts, and historical observations.
- Alternatives: Full catalogue/order mirror; event-sourced local operational database.
- Evidence: Product scope is a small personal companion, notifications can be duplicated/missed, and upstream owns listing lifecycle rules.
- Rationale: Avoid stale dual ownership and unnecessary storage.
- Consequences: UI needs freshness indicators and graceful upstream failure; Cron reconciliation supplements notifications.

## ADR-004 — Fail-closed two-step writes

- Date: 2026-09-01
- Status: Accepted, product invariant
- Decision: Every material write uses server-prepared expiring intent, visible before/after preview, explicit confirmation, revalidation, single execution, verification, and audit. Missing confirmation is denial.
- Alternatives: direct form submit; optimistic mutation with undo; post-action confirmation; optional human-in-the-loop callback.
- Evidence: Listing changes can affect sales and current upstream rules can ignore/reject fields with warnings. Inspected community implementations did not consistently confirm before execution.
- Rationale: Prevent accidental, stale, AI-driven, or misleading changes.
- Consequences: More round trips and state; stale previews intentionally require re-prepare. Copilot can propose but never confirm.

## ADR-005 — Application-level encrypted tokens and D1 refresh coordination

- Date: 2026-09-01
- Status: Provisional through Phase 1 security tests
- Decision: Store AES-GCM-encrypted token fields in D1 with a versioned Worker Secret key. Serialize rotating refresh through a D1 version/lease transaction; in-process single-flight is only an optimization.
- Alternatives: rely on D1 platform encryption alone; plaintext tokens; Durable Object; KV lock; per-isolate promise only.
- Evidence: Mercado Libre security guidance calls for encrypted credential storage and rotating refresh tokens; Workers can run concurrent isolates; Web Crypto and Secrets provide required primitives.
- Rationale: Protect database disclosure and prevent refresh-token reuse.
- Consequences: Requires key rotation/recovery design and adversarial concurrency tests. If D1 coordination cannot be made unambiguous, revisit Durable Objects in a new ADR.

## ADR-006 — Cloudflare Access for the single owner

- Date: 2026-09-01
- Status: Provisional through Phase 1 hostname/policy test
- Decision: Put the owner-facing custom hostname behind Cloudflare Access and also validate the Access JWT in the Worker.
- Alternatives: build local email/password auth; OAuth login through Mercado Libre alone; publicly reachable bearer session.
- Evidence: Access supports self-hosted Workers, owner identity policies, path-specific policy, and signed JWTs. Cloudflare explicitly instructs Workers behind Access to validate the assertion.
- Rationale: Avoid building an account system for one owner while retaining defense in depth.
- Consequences: Requires a Cloudflare-managed domain/Access configuration. Public webhook/callback paths need narrowly scoped policies and independent validation; alternate hostnames must not bypass Access.

## ADR-007 — Defer Queue, R2, and image services

- Date: 2026-09-01
- Status: Accepted until measured trigger
- Decision: Use a D1 notification inbox, bounded `waitUntil()`, and Cron reconciliation initially. Add R2 only for Phase 9 originals/proposals. Do not add Queue or image provider now.
- Alternatives: Cloudflare Queue from Phase 1; R2 from foundation; external message/image services.
- Evidence: Personal catalogue volume is expected to be small; D1/Cron fit current needs; no image feature exists yet.
- Rationale: Minimize infrastructure and cost before a workload exists.
- Consequences: Monitor job lag/retry volume. A sustained backlog, inability to meet retry bounds, or image approval starts a new decision.

## ADR-008 — Capability claims need evidence labels

- Date: 2026-09-01
- Status: Accepted
- Decision: Record API behavior as officially documented, dated observation, real MPE verified, or unverified. Cross-country examples and community code do not establish MPE support.
- Alternatives: assume common Mercado Libre endpoints work for every site; trust package README claims.
- Evidence: Official docs contain site-specific availability/limitations, and nominally public MPE reads returned `403` without authentication during bootstrap.
- Rationale: Prevent architecture and product promises from outrunning current evidence.
- Consequences: Phase 0 includes a read-only MPE matrix; later endpoint changes update the research file and fixtures.

## ADR-009 — No open-source client dependency in Phase 1 by default

- Date: 2026-09-01
- Status: Provisional pending Phase 1 dependency review
- Decision: Implement the smallest Workers-native REST/OAuth adapter and borrow tested concepts, not an entire inspected SDK/MCP stack.
- Alternatives: depend on `@ar-agents/mercadolibre`; fork `MarcosNahuel/mercadolibre-mcp`; use deprecated official Node SDK; call Go service.
- Evidence: Inspected projects have combinations of non-Workers dependencies, optional/faulty confirmation, no PKCE, unverified MPE, old maintenance, or wrong runtime. The official Node SDK is deprecated.
- Rationale: A narrow adapter for the early read-only endpoints is smaller than adapting a full agent/MCP stack.
- Consequences: More local contract tests and maintenance. Re-evaluate selected MIT utilities if clean-room implementation becomes larger/riskier, after choosing this repository's license.

## ADR-010 — Conceptual D1 model grows by phase

- Date: 2026-09-01
- Status: Accepted
- Decision: Phase 1 creates only account/OAuth/audit tables. Change, order, snapshot, comparable, AI, and image tables arrive with their owning phases.
- Alternatives: build the full future schema in Phase 1; use schemaless response storage.
- Evidence: Product phases and API contracts remain partly unverified.
- Rationale: Avoid speculative migrations and unused retention obligations.
- Consequences: `DATA_MODEL.md` is guidance, not a migration specification; each added table needs its own access paths, retention, migration, and tests.
