# Security

Status: design baseline. Security controls are release gates, not backlog polish.

## Assets to protect

- Mercado Libre client secret, authorization codes, access tokens, refresh tokens, and account identifiers;
- the ability to change prices, stock, content, images, and listing lifecycle state;
- order/sales facts and any incidental personal data;
- Cloudflare credentials, Access configuration, D1 data, R2 originals, and provider secrets;
- audit integrity and the owner's understanding of a proposed change.

## Trust boundaries and primary threats

| Boundary | Representative threats | Required controls |
|---|---|---|
| Browser to Worker | unauthorized user, CSRF, stale/tampered proposal, replay | Access + JWT validation, same-origin API, schemas, change intents, short TTL, single-use confirmation |
| OAuth redirect | forged/replayed state, code interception, wrong account/site | HTTPS exact URI, state hash, PKCE, expiry/consume, server exchange, `/users/me` binding |
| Worker to Mercado Libre | token leakage, unsafe retry, confused endpoint, upstream drift | narrow client methods, bearer header, timeouts, redaction, response schemas, safe retry policy, verification |
| D1/Secrets | database disclosure, token reuse, race during rotation | AES-GCM token fields, key in versioned Secret, least bindings, CAS/lease, key rotation plan |
| Public notification path | spoof, flood, duplicate/reordered event, path injection | narrow Access policy, WAF/rate limits, size/schema/allowlists, app/user binding, dedupe inbox, authoritative re-fetch |
| AI/image provider | prompt injection, data leakage, hallucination, misleading image | provider minimization, grounded schemas, no credentials, preview, fact checks, immutable original, human apply |
| Logs/CI/source | accidental secret/PII exposure, malicious dependency | allowlisted logs, secret scanning, ignored local vars, least CI permissions, lockfile/audit/review |

## Owner authentication

Cloudflare Access is the provisional outer authentication layer on a custom hostname, restricted to the single owner identity. Email one-time PIN can work for a personal app, but the chosen identity method and session policy must be explicitly configured in Phase 1.

The Worker validates the Access JWT from `Cf-Access-Jwt-Assertion` using Cloudflare's remote signing keys, expected issuer, audience, and expiry. Cloudflare documents that Workers behind Access still need this validation. The application derives actor identity from validated claims only.

Do not expose production through an unprotected `workers.dev` or alternate route. Test the hostname/policy matrix before each release.

## OAuth controls

- Main/admin seller account only; no password collection.
- Exact registered HTTPS redirect URI.
- At least 128 bits of unpredictable, one-time state; store only its hash.
- S256 PKCE required by ML Copilot even if the provider describes it as optional.
- State/verifier expire quickly and are atomically consumed before code exchange.
- Only allow a relative, allowlisted post-login return path.
- Exchange code server-side and never persist it.
- Verify expected Mercado Libre application/account and `site_id=MPE` before activation.
- Request only permissions required by the current phase.
- Provide explicit disconnect/reconnect. Verify provider-side revocation behavior during Phase 1.

## Token storage and rotation

D1's platform encryption at rest is not the only control. Encrypt each token with Web Crypto AES-GCM and a fresh random IV. Bind account ID, token kind, credential version, and key version as authenticated additional data so ciphertext cannot be swapped between rows/fields unnoticed.

Keep a versioned 256-bit encryption key in Workers Secrets. Plan key rotation as decrypt-with-old/re-encrypt-with-new; never store the key in D1 or repository config.

Refresh tokens rotate. A D1 compare-and-swap/short lease ensures one request owns a credential version. The owner:

1. claims the current version;
2. calls the refresh endpoint once;
3. atomically persists both new encrypted tokens, expiry, and next version;
4. releases/lets the lease expire;
5. wakes/retries waiting requests against the new version.

Lease recovery must not retry an ambiguous refresh blindly. If it cannot prove which pair is current, fail closed and require reconnection.

## Authorization and write safety

All routes enforce the one connected account and expected resource ownership server-side. Frontend resource IDs are untrusted. No generic upstream URL or arbitrary JSON write endpoint exists.

Material writes use expiring single-use change intents described in `ARCHITECTURE.md`. Requirements:

- server reads current state and edit restrictions;
- canonical before/after preview identifies item, field, current and proposed value, and consequence;
- user performs an explicit confirm gesture; absence is rejection;
- server re-authenticates and re-reads before apply;
- state drift, expiry, used intent, mismatched actor/account, or invalid capability rejects the operation;
- one narrow upstream request is made; warnings are parsed;
- post-write read verifies actual state;
- audit records success, partial/mismatch, or failure.

Close, relist, image replacement, and listing creation use stronger wording and cannot be bundled with an unrelated quick action. The future copilot can create an intent but cannot confirm it.

## Input, output, and browser controls

- Runtime schemas validate query, path, body, provider, webhook, and upstream data.
- Reject unknown mutation fields and bound string/list/file sizes.
- Escape untrusted listing text; never render upstream/AI HTML directly.
- Use same-origin APIs, secure/HTTP-only/SameSite cookies where the application creates cookies, restrictive CORS, and state-changing methods protected against CSRF.
- Adopt a restrictive Content Security Policy and prevent framing where compatible with OAuth/Access.
- Do not cache authenticated API responses in shared edge/browser caches.
- Do not store Mercado tokens or sensitive order data in local/session storage.
- Use generic user-facing errors with correlation IDs; keep sanitized diagnostic details server-side.

## Notifications

Cloudflare Access Bypass disables Access security and request logging for the matched path, so any Bypass is limited to the exact webhook path. Before enabling notifications, recheck Mercado Libre's current authenticity guidance.

At minimum:

- allow POST only and bound body/time;
- validate JSON schema, known `application_id`, connected `user_id`, exact topic allowlist, and resource-path pattern;
- reject paths/hosts that could become SSRF; construct the upstream URL from a known resource family;
- deduplicate an event identifier/fingerprint in D1;
- respond promptly and fetch authoritative state with the server token;
- rate-limit at Cloudflare and application layers;
- reconcile periodically because notifications can be missed or reordered.

## Data minimization and retention

- Do not persist complete upstream payloads by default.
- Order history excludes buyer contact/address/payment details unless separately approved.
- Audit before/after JSON is allowlisted and bounded.
- Comparable/title/permalink observations are retained only as necessary for explainability/history.
- AI requests receive the minimum grounded listing facts and no seller credential/order PII.
- Define retention periods before Phase 5 history, Phase 8 AI, or Phase 9 image storage becomes production.
- Deletion/retention jobs need audit and backup/recovery consideration; do not implement destructive cleanup casually.

## Images

When Phase 9 begins:

- upload through bounded content-type/magic-byte/dimension/size validation;
- strip unnecessary metadata, including location-bearing EXIF;
- store private immutable originals and separately keyed proposals in R2;
- use short-lived authorized delivery, not public predictable object URLs;
- record content hash, transformation/provider/version, and decision;
- prevent decompression bombs and unsupported formats;
- require side-by-side review and explicit apply;
- do not hide defects or change product identity/material/color/features.

## Logging and audit

Logs are structured and allowlisted. Redact or omit:

- authorization/cookie headers;
- access/refresh tokens, secrets, OAuth code/state/verifier;
- query strings or URLs that could contain credentials;
- raw request/response bodies from orders, OAuth, AI, or webhooks;
- buyer PII and image metadata.

Audit is append-only at the application layer and records actor reference, action, item, redacted before/after, intent, outcome, upstream request/status/warnings, and time. Application logs and audit records have different purposes; neither contains credentials.

## Dependency and delivery security

- Pin runtimes and dependencies with a committed lockfile in Phase 1.
- Use minimal packages compatible with Workers; review install scripts and transitive dependencies.
- Run dependency and secret scanning in CI; use least-privilege GitHub/Cloudflare deployment credentials and protected production environments.
- Do not expose secret values to pull requests from untrusted forks.
- Generate TypeScript binding types from Wrangler configuration rather than duplicating secret values.
- Keep production and staging accounts/databases/secrets distinct.

## Incident/recovery expectations

If credentials may have leaked: disable writes, revoke/reconnect Mercado Libre authorization, rotate client/encryption/deployment secrets as applicable, inspect redacted audit events, and invalidate sessions. If refresh state is ambiguous, require reconnect rather than guessing.

D1 backup/recovery and R2 lifecycle policies must be tested before historical data becomes valuable. Mercado Libre remains able to restore current operational data, but app history/audit needs its own recovery plan.

## Security gates by phase

- Phase 0: no credential leakage in the capability harness; read-only account verification.
- Phase 1: Access/JWT, OAuth negatives, encryption, refresh concurrency, reconnect, CI secret scan.
- Phase 3: fail-closed intent state machine and controlled mutation runbook.
- Phase 5: PII minimization/retention review.
- Phase 8: prompt-injection, grounding, and provider-data review.
- Phase 9: object authorization, immutable originals, file safety, misrepresentation review.
- Phase 10: agent tool authorization and confirmation-bypass evaluation.
