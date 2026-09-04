# Security

Status: Phase 0D design and implementation baseline. Controls are release gates, not optional polish.

## Assets and boundaries

Protect the Mercado Libre client secret, OAuth codes, access/refresh tokens, account identity, seller capability, D1 data, Worker secrets, and the ability to perform future listing writes. The current Worker has no seller-data write method.

```text
Public browser callback -> state/PKCE validation -> server-side token exchange
Temporary operator header -> protected start/capability routes
Worker Secret + D1 -> encrypted credential and lease state
Worker -> typed, read-only Mercado Libre client
```

The OAuth callback is public only because Mercado Libre must redirect to it. The temporary operator token is required for start/capability and is not included in URLs or logs. Cloudflare Access/JWT validation is a future Phase 1 owner boundary, not a Phase 0 prerequisite.

## OAuth controls implemented

- Authorization Code flow; no Mercado Libre password collection.
- Exact HTTPS redirect URI, validated by the URL builder and configured as `ML_REDIRECT_URI`.
- High-entropy one-time state stored as a hash; state is atomically consumed and expires.
- S256 PKCE verifier/challenge; verifier is encrypted before D1 persistence.
- `offline_access read` scope only; no write scope requested by Phase 0.
- Server-side exchange; authorization codes and tokens never reach the browser.
- `/users/me` site binding; only `site_id = MPE` activates the account.
- Generic success/failure pages with `Cache-Control: no-store` and restrictive CSP.

## Token encryption and storage

`ML_ENCRYPTION_KEY` is a base64url-encoded 256-bit Worker Secret. Web Crypto AES-GCM uses a fresh random 12-byte IV per value. Token ciphertext is authenticated with account ID and key version as associated data. The PKCE verifier uses separate fixed associated data. Decryption, malformed JSON, invalid IV, and authentication failures fail closed.

D1 stores only encrypted token material and opaque account metadata. `ML_CLIENT_SECRET`, `ML_ENCRYPTION_KEY`, `PHASE0_OPERATOR_TOKEN`, tokens, codes, and authorization headers are never committed, returned, or logged. `.dev.vars`, `.env`, `.wrangler`, and build artifacts are ignored.

## Rotating refresh safety

Mercado Libre refresh tokens rotate and are single-use. The D1 repository claims a credential version only when no unexpired lease exists, then saves the complete replacement pair only if version, owner, and unexpired lease still match. The update increments the version and clears the lease atomically. Failed refreshes release the owner's lease; an expired lease can be recovered. Waiting callers reread a newer generation and do not blindly retry an ambiguous refresh.

The local Workerd/D1 tests prove these SQL predicates against the local engine. They do not prove a deployed Cloudflare D1 account or network failure after the provider consumes a token; that remains an external security gate.

## Worker route controls

- `GET /phase0/oauth/start`: temporary operator token required; creates state/PKCE and redirects only to the configured MPE authorization host.
- `GET /phase0/oauth/callback`: public; validates state, exchanges code, confirms MPE, encrypts credentials, and returns no raw payload.
- `GET /phase0/capability`: temporary operator token required; reads only `/users/me`, seller item search, and bounded item details.
- `POST /phase0/refresh/verify`: temporary operator token plus JSON `{ "confirm": "rotate-once" }`; one durable refresh verification.

Unknown routes return safe errors. Capability errors map 401/403/429 without returning upstream bodies. The Worker has no generic URL proxy and no mutation route.

## Forced refresh verification

The Phase 0-only `POST /phase0/refresh/verify` route is an explicit operator action, not a normal application feature. It requires the operator token and an exact JSON confirmation phrase. A D1 row is claimed with `ON CONFLICT DO NOTHING` before the upstream refresh; only one attempt per connected account can proceed. The refresh manager bypasses the healthy-token shortcut but uses the same lease acquisition, rotating-token replacement, credential-version CAS, and lease release path as normal access-token refresh.

A successful response contains only the before/after credential generation, expiry timestamp, and verification time. A definite upstream error is recorded as failed; a network/timeout outcome is recorded as ambiguous. Neither state is automatically retried, and later forced attempts are rejected. No seller/business resource is written.

## Logging, source, and CI

No Phase 0 code logs request URLs, query strings, headers, bodies, tokens, codes, secrets, or buyer data. If operational logs are added later, use an allowlist and sanitized correlation/request IDs. GitHub Actions has read-only repository permissions, installs from the lockfile, runs checks, and never receives Mercado Libre or Cloudflare secrets. Secret scans and `git diff --check` are required before commit.

## Future controls

Phase 1 must add owner authentication (Access/JWT or a recorded alternative), alternate-host protection, session/CSRF policy, deployment environment separation, and binding type generation. Phases with writes must use expiring server-side intents, visible before/after previews, explicit confirmation, re-read/precondition checks, one narrow request, post-write verification, and redacted audit records. Image/AI phases require separate data minimization, provenance, and truthfulness controls.
