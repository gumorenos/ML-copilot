# Architecture
Status: Phase 0D implementation; production application architecture remains provisional until the Phase 1 deployment gate.

## Scope and trust boundaries

ML Copilot serves one owner and a small Mercado Libre Peru (MPE) catalogue. Mercado Libre is the operational source of truth. Phase 0D remains a read-only connectivity proof and is deliberately not the product UI.

```text
Operator with temporary token
  -> Phase 0 Worker
       GET /phase0/oauth/start       protected
       GET /phase0/oauth/callback    public browser callback
       GET /phase0/capability        protected read-only probe
       POST /phase0/refresh/verify protected one-time refresh proof
       OAuth/PKCE, encrypted storage, refresh CAS/lease
       typed Mercado Libre adapter
       D1 repositories
  -> Mercado Libre REST API
```

The callback is public only because Mercado Libre must navigate the browser to it. It has no operator bypass: state, PKCE, code exchange, site, and credential persistence are all validated server-side. The protected routes use a temporary `PHASE0_OPERATOR_TOKEN` header guard for staging proof. Cloudflare Access and Access-JWT validation remain Phase 1 work.

There is no React UI, static asset bundle, generic proxy, seller mutation, order mutation, analytics, market engine, AI provider, image provider, Queue, Durable Object, Redis, or R2 binding in Phase 0D.

## Worker entry point and configuration

`src/worker.ts` exports `createPhase0Worker()` and a default Cloudflare Worker handler. `wrangler.jsonc` is the checked-in configuration with safe placeholder values. The D1 binding is `DB`; migrations `0001_phase0_auth.sql` and `0002_phase0_refresh_verification.sql` create the minimal auth, credential, state, and one-time refresh-verification tables plus their indexes. Local Workerd tests load the same migration through `@cloudflare/vitest-plugin`; `npm run d1:migrate:local` applies it to Wrangler's persistent local database.

Required non-secret variables are `ML_CLIENT_ID`, exact HTTPS `ML_REDIRECT_URI`, and optional `ML_API_BASE_URL`. Required secrets are `ML_CLIENT_SECRET`, `ML_ENCRYPTION_KEY` (base64url 256-bit AES key), and `PHASE0_OPERATOR_TOKEN`. They are never checked in, returned, or logged.

## Module boundaries

- `oauth.ts`: high-entropy state/PKCE creation, S256 challenge, exact HTTPS redirect validation, MPE authorization URL, and one-time state consumption.
- `state-crypto.ts`: AES-GCM encryption/authentication of the stored PKCE verifier using fixed associated data.
- `crypto.ts`: AES-GCM encryption of the OAuth token pair; account ID and key version are authenticated context.
- `meli-client.ts` and `schemas.ts`: narrow token exchange/refresh plus read-only `/users/me`, seller item search, and item multiget/detail calls with runtime validation, bounded read retries, `Retry-After`, and mapped errors.
- `d1-store.ts` and `memory-store.ts`: account/credential/state persistence contracts. D1 refresh updates use conditional version/lease predicates; memory stores are only test doubles.
- `refresh.ts`: rotating refresh-token manager. It decrypts the current generation, claims a short lease, performs one refresh, and atomically saves the new encrypted pair/version. A waiting caller rereads the newer generation; expiry or failure releases/reclaims the lease safely.
- `model.ts` and `probe.ts`: conservative legacy/User Products/coexistence/unknown classification and sanitized read-only evidence. Item hydration is bounded to five in the probe and never exceeds the Mercado Libre multiget limit of 20.
- `worker.ts`: route authorization, OAuth orchestration, account binding, safe responses, error mapping, and the protected one-time refresh verification route. It does not expose raw upstream payloads or credentials.

The future application can promote these interfaces into a service layer. Phase 1 may add a Worker router and React/Vite assets only after this gate is explicitly closed.

## OAuth and credential lifecycle

1. Protected start creates a one-time state and S256 PKCE verifier; D1 stores only the state hash, encrypted verifier, expiry, and safe return path.
2. Public callback validates and consumes state exactly once before exchanging the code server-side.
3. The Worker calls `/users/me` and accepts only `site_id = MPE`.
4. It stores opaque account identity/tags and AES-GCM encrypted credentials. `expires_in` returned by Mercado Libre is converted to `expiresAt`; no token lifetime is hardcoded.
5. Capability calls use the stored generation. If near expiry, `RotatingAccessTokenManager` acquires the D1 lease/CAS, refreshes once, replaces the complete encrypted pair, increments the version, and clears the lease.
6. Invalid/revoked refresh credentials fail closed and require reconnection. Ambiguous refresh outcomes are not blindly retried.

The local Workerd/D1 suite proves the SQL path against the local engine, including one lease winner, stale-writer rejection, expired-lease recovery, one-time state consumption, encrypted persistence, malformed-data rejection, and a durable one-time forced-refresh claim. It is not deployed Cloudflare evidence.

## Read-only capability flow

The protected capability route reads the connected account and encrypted credential, obtains a current access token, calls `/users/me`, confirms MPE, searches `/users/{seller_id}/items/search`, and hydrates at most five item IDs through `/items?ids=...`. The response contains only aggregate counts, opaque IDs, field-presence flags, tags, failures, and seller-model evidence. It never persists or returns titles, descriptions, buyer data, raw responses, authorization codes, or tokens.

The classifier records `user_product_seller`, `warehouse_management`, and `multiwarehouse` tags when present and checks sampled `family_name`, `user_product_id`, and listing markers. It does not perform User Product or legacy item mutations. The intended account's actual model remains unverified until the real MPE run.

## Future architecture (deferred)

The target production shape remains one Cloudflare Worker with React/Vite static assets, `/api/*` services, D1, Worker Secrets, Cron snapshots, and optional private R2 image objects. Cloudflare Access is the planned owner boundary. Orders, catalogue UI, analytics, market snapshots, AI/image providers, MCP, and writes enter only in their roadmap phases with separate acceptance gates.

## Evidence

- Official Cloudflare Workers testing, D1 local-development, Wrangler configuration, and Vitest-plugin recipes were checked on 2026-09-04; links are in `docs/RESEARCH_SOURCES.md`.
- Automated/mock evidence and local Workerd/D1 evidence are recorded in `docs/PHASE0_CAPABILITY_REPORT.md`.
- Deployed Cloudflare and real MPE evidence are explicitly separate and currently absent.
