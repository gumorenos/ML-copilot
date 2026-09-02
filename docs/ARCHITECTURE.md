# Architecture

Status: proposed baseline; decisions marked provisional remain gated by implementation evidence.

## Context and constraints

ML Copilot serves one owner and a small MPE catalogue. It must run primarily on Cloudflare, protect sensitive seller access, avoid unnecessary infrastructure, and preserve Mercado Libre as operational source of truth.

## System context

```text
                         +-------------------------+
                         | Mercado Libre REST API |
                         +------------^------------+
                                      |
+---------+   Access + HTTPS   +-------+--------------------+
| Browser | ----------------> | Cloudflare Worker          |
+---------+                    |                            |
                               | React/Vite static assets   |
                               | /api routes + middleware   |
                               | application/domain layer   |
                               | scheduled jobs             |
                               +-----+----------------+------+
                                     |                |
                                  +--v--+       +-----v------+
                                  | D1  |       | R2, later  |
                                  +--^--+       +------------+
                                     |
                         Cron Triggers invoke Worker

Optional later:
AI agent -> MCP adapter -> same application services
```

## Deployment unit

Use one TypeScript Cloudflare Worker project containing:

- a React SPA built by Vite and served through Workers Static Assets;
- `/api/*` routes in the Worker;
- a `scheduled()` handler for bounded snapshot and reconciliation jobs;
- D1 bindings and Worker Secrets;
- R2 bindings only when an approved image phase needs private objects.

The Cloudflare Vite plugin's full-stack React model allows assets and the Worker API to deploy as one unit. SPA fallback is configured for client-side routes. Browser code cannot access bindings; all D1, secret, and Mercado Libre operations remain in the Worker.

Hono is the provisional API router because it is small, Workers-native, and provides middleware/routing structure. It is not a service boundary; it may be removed if the Phase 1 spike demonstrates that a smaller router is clearer.

### Cloudflare platform fit

- The current official React/Workers path is React + Vite + the Cloudflare Vite plugin, with static assets and the Worker API deployed together.
- D1 provides versioned migrations and is expected to fit a personal catalogue. Its row/storage quotas and single-writer behavior make indexes, bounded scans, and chunked snapshot jobs important; the exact account plan limits must be captured in Phase 1 rather than assumed.
- Cron Trigger schedules are UTC. Jobs must convert display periods deliberately to Peru time and persist UTC observations.
- Worker post-response and scheduled execution are bounded. Jobs checkpoint after small pages/batches and never depend on an unbounded `waitUntil()` run.
- Worker Secrets and Web Crypto supply the primitives for server-only configuration and application-level token encryption.
- R2 is appropriate for private image objects later; D1 is not object storage.

## Request and trust boundaries

### Owner-facing traffic

Cloudflare Access protects the custom application hostname for the single approved owner identity. The Worker also validates the `Cf-Access-Jwt-Assertion` signature, issuer, audience, expiry, and intended identity. It does not accept a header merely because it exists.

The production Worker must not be reachable through an alternate unprotected hostname such as a forgotten development route. Environment isolation and route checks are Phase 1 release gates.

### OAuth callback

The callback is a browser navigation that should remain behind the owner's Access session if Mercado Libre redirect behavior permits it. If a public callback path is proven necessary, it receives the narrowest separate Access path policy and must validate one-time `state`, PKCE verifier, expiry, redirect URI, and account/site before storing credentials.

### Notifications

A future Mercado Libre webhook receiver must be public. A narrowly scoped Access Bypass policy may be required, but Bypass disables Access controls and logging for that path. The endpoint therefore validates `application_id`, account/user association, topic and resource allowlists, payload size/schema, and deduplication before storing an event. The notification is only a reference; the Worker fetches authoritative data using its own token.

## Module boundaries

The proposed source layout is illustrative; Phase 1 may refine names without changing the boundaries.

```text
src/
|-- client/                    React application
|   |-- app/                   routing, layout, query/error boundaries
|   |-- features/              account, publications, sales, market, analytics
|   `-- shared/                accessible UI components and formatting
|-- worker/
|   |-- index.ts               fetch/scheduled entry points
|   |-- http/                  routes, schemas, auth, errors, rate controls
|   |-- application/           use cases and transaction orchestration
|   |-- domain/                policies, values, calculations, change intents
|   |-- integrations/
|   |   `-- mercadolibre/      OAuth, typed client, resources, error mapping
|   |-- repositories/          D1 implementations
|   |-- jobs/                  snapshots, notification/reconciliation work
|   `-- providers/             later text/image provider adapters
`-- shared/                    transport DTOs/schemas with no secret types
```

### Domain and application layer

Owns:

- change-intent state machine and precondition hashing;
- money, time-window, condition, and metric definitions;
- comparable filtering/scoring and deterministic insights;
- use-case authorization and orchestration;
- interfaces for repositories, Mercado Libre capabilities, clock, ID generation, and later AI/image providers.

It must not import React, Hono request objects, D1 statements, raw environment bindings, or provider SDKs.

### Mercado Libre adapter

Owns:

- OAuth URL/token exchange and rotating refresh;
- bearer injection and redaction;
- endpoint-specific request/response validation;
- pagination, multiget, bounded concurrency, retry/backoff, `429` handling, request IDs, and warnings;
- mapping unstable upstream responses into explicit application types.

Writes are narrow named methods. There is no generic `PUT /items/:id` proxy available to the client or copilot. Idempotent reads may retry; writes do not retry automatically unless an endpoint's idempotency behavior is proven and designed.

### Repositories

D1 adapters persist app data, encrypted credentials, change intents, audit events, minimal historical facts, and job cursors. Migrations are versioned SQL and tested from an empty database.

### Frontend

The React client owns presentation and user interaction. It never owns authorization, capability decisions, mutation validation, or token refresh. Server responses expose capabilities and reasons, not secrets or raw upstream payloads.

## Credential lifecycle

1. Generate high-entropy `state` and PKCE verifier server-side.
2. Store only a hash of state plus an encrypted verifier, expiry, and safe return path.
3. Exchange the one-time authorization code server-side.
4. Verify `/users/me`, expected account, and `site_id = MPE` before activating the connection.
5. Encrypt access and refresh tokens with AES-GCM through Web Crypto. Keep the encryption key only in a versioned Worker Secret.
6. Use the API-provided `expires_in`; refresh shortly before expiry with jitter.
7. Acquire a D1-backed version/lease before refresh so only one isolate uses a rotating refresh token.
8. Atomically replace the encrypted token pair and increment its version before releasing the lease.
9. On invalid refresh/revocation, disable operations, redact diagnostics, and require reconnection.

In-process promise deduplication may reduce work but is not the correctness mechanism because Workers run in multiple isolates.

## Material write protocol

Every write uses a fail-closed two-step protocol:

1. `prepare`: authenticate owner, read current upstream state and restrictions, validate the requested change, generate canonical before/after data, store an expiring single-use intent with a precondition hash.
2. `confirm/apply`: authenticate owner again, load pending intent, re-read upstream state, reject drift/expiry/reuse, perform exactly one narrow write, parse warnings, re-read to verify, record outcome.

The audit event records redacted before/after data, action, resource, actor reference, upstream status/request ID, warning/error code, and time. It never records credentials, full authorization data, or unnecessary PII.

## Reads, caching, and source of truth

- Listing/order details are fetched live when freshness matters.
- Short-lived cache data may improve UI performance but must display freshness and remain discardable.
- D1 snapshots are observations, not current operational truth.
- Public search stock quantities are not treated as owner inventory.
- Webhook events trigger re-fetches; they are not trusted state.
- Cron reconciliation covers missed or duplicated notifications.

## Scheduled work

Cron invokes the same Worker. Jobs are bounded and checkpointed in D1:

1. claim a job/cursor lease;
2. fetch a limited page or item batch;
3. persist idempotently;
4. update watermark/cursor;
5. stop before execution limits and continue next run.

`waitUntil()` is used only for short post-response work, not unbounded synchronization. A queue is deferred; it becomes an option only if measured event volume or retry reliability cannot be handled by a D1 inbox plus reconciliation.

## Historical and comparable pipeline

```text
source listing
  -> normalize site/category/condition/identifiers/brand/model/attributes
  -> retrieve documented MPE candidate sources
  -> hard exclusions and structured scoring
  -> optional text score
  -> persist inspectable candidate set + algorithm version
  -> deterministic statistics
  -> owner review/corrections
```

New and used sets remain separate. Missing identifiers reduce confidence; they do not authorize an LLM to invent matches. Catalogue `price_to_win`, official price suggestions, highlights, and trends are shown as labeled auxiliary signals.

## Error and resilience model

- Map upstream validation, authentication, authorization, moderation, conflict, automation, rate-limit, and transient errors separately.
- Honor `Retry-After` where present and use jittered backoff for safe reads.
- Bound concurrency by account and endpoint; adjust from measured responses rather than an undocumented global quota.
- Retain upstream request IDs and sanitized error codes for support.
- A `200` response with warnings does not prove the requested state changed.
- Show stale data with its observation time rather than presenting it as current.

## Observability

Use structured, allowlisted logs containing correlation ID, route/use case, duration, result class, upstream endpoint family, status, and request ID. Never log URLs containing credentials, authorization headers, cookies, tokens, OAuth codes, raw order payloads, or AI inputs with sensitive data.

Initial operational measures should include OAuth/refresh failures, upstream error classes, `429` rate, job lag, webhook backlog, mutation verification failures, and D1 errors.

## Deliberately deferred architecture

- R2 and image-processing bindings: Phase 9.
- AI provider SDKs and prompt storage: Phase 8 onward.
- MCP adapter: Phase 10 or an independently approved integration.
- Cloudflare Queues/Durable Objects: only after measured need.
- PWA service worker/offline behavior: Phase 11; seller writes must not be queued offline.
- External marketplace data and scraping: outside MVP.

## Evidence

Primary architectural sources and access dates are indexed in [RESEARCH_SOURCES.md](RESEARCH_SOURCES.md). Material choices are recorded in [DECISIONS.md](DECISIONS.md).
