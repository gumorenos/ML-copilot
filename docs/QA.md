# Quality assurance and acceptance gates

## Philosophy

Automated tests prove our code; mocked contract tests prove how our adapter handles known upstream shapes; controlled real-account smoke tests verify the integration. None substitutes for the others.

Never run a destructive real-account test merely because automated tests pass. Every gate lists manual evidence separately.

## Required check classes

### Static and build checks

- formatting and Markdown/local-link validation;
- linting and strict TypeScript typecheck;
- Worker/client production build;
- dependency/secret scan;
- generated Cloudflare binding types are current.

### Unit tests

Prioritize deterministic/security-sensitive logic:

- OAuth state/PKCE and safe redirects;
- encryption/authenticated-data/key-version behavior;
- refresh lease/version races and recovery;
- capability/edit rules and change-intent transitions;
- money/date-window/metric calculations;
- comparable normalization/scoring/statistics;
- deterministic insights and relist-chain handling;
- log/audit redaction.

### API/client contract tests

Use sanitized static fixtures for successful and error responses. Cover missing/unknown fields, partial multiget results, pagination/scroll expiry, warnings, automation conflicts, moderation, `401/403/404/409/429/5xx`, timeouts, and malformed upstream data.

Do not make routine CI dependent on Mercado Libre availability or real credentials.

### D1 tests

- apply every migration to an empty local database;
- apply supported upgrades from previous schemas;
- verify constraints, indexes, foreign keys, transactions, and idempotent upserts;
- simulate refresh/change-intent concurrency;
- prove snapshot/job retry does not duplicate facts;
- test retention only after a retention policy is approved.

### UI behavior tests

- phone and desktop layouts;
- keyboard, focus, labels, validation, loading/empty/error/stale states;
- before/after preview and material consequence text;
- confirm/cancel, double-click, refresh/back navigation, expiry, and drift;
- freshness/source links and partial data;
- no sensitive data in rendered output/browser storage.

### End-to-end tests

Run the built Worker against local D1 and a deterministic fake Mercado Libre server. Cover OAuth callback, refresh, catalogue reads, notification dedupe, and the complete prepare/confirm/verify protocol. Playwright should not point to a real seller in routine CI.

## Real Mercado Libre verification policy

### Read-only tests

- Use the intended main/admin MPE account through the approved application.
- Keep command output sanitized; do not capture tokens, headers, buyer PII, or complete raw payloads.
- Record endpoint, time, site, HTTP class, response shape/version, and manual comparison result.
- Prefer aggregate evidence and synthetic/sanitized fixtures committed to the repository.

### Write tests

Write testing starts no earlier than Phase 3 and requires explicit authorization for the exact run. The runbook must identify:

1. a dedicated low-risk test listing owned by the user;
2. its current state and expected change;
3. why the action is reversible and the planned rollback where possible;
4. allowed fields and exact bounds;
5. one action at a time with preview and confirmation;
6. post-write API and Seller Center verification;
7. audit evidence and final state.

Never casually test close, relist, create, image replacement, zero stock, or a price that could create an unintended sale. These need separate authorization and consequence review. Do not use a live buyer or create fake transactions.

## Gate evidence format

Each gate report should state:

- application commit and environment;
- automated commands/results;
- fixture/API documentation version or access date;
- manual steps, account/site (redacted), and observed result;
- deviations and unresolved risks;
- explicit pass, conditional pass, or fail decision;
- reviewer/user authorization for any real write.

## Phase acceptance summary

Detailed scope is in `ROADMAP.md`; this section defines the minimum QA character of each gate.

### P0 — MPE capability proof

- Automated: harness tests for state/PKCE, redaction, pagination, and refresh coordination.
- Mocked: OAuth/read/error fixtures.
- Manual real account: OAuth, `/users/me`, one refresh rotation, listing count/status reconciliation, authenticated read matrix.
- Writes: none.

### P1 — Foundation/OAuth

- Automated: clean install, format/lint/typecheck, unit/integration, empty/upgrade migrations, build, secret scan.
- Mocked: all OAuth negative paths, concurrent refresh, revocation/reconnect.
- Manual staging: Access policy matrix, MPE connection identity/count, no credential in browser/log/D1 plaintext.
- Writes: none.

### P2 — Catalogue read

- Automated: pagination/multiget/partial error/UI/a11y contracts.
- Manual: representative listing/status/field reconciliation with Seller Center.
- Writes: none; no mutation route deployed.

### P3 — Listing management

- Automated: intent transition/property tests, replay/drift/expiry, warning/mismatch, audit/redaction, UI confirmation.
- Mocked: every mutation family and current error/restriction shapes.
- Manual: individually authorized controlled listing operations; close/relist separate.

### P4 — Create/duplicate

- Automated: category/attribute/image/draft validation and duplicate sanitization.
- Manual: explicitly authorized create -> verify -> modify -> pause on controlled product.

### P5 — Sales

- Automated: order transitions, totals, cancellation, multi-line, shipping gaps, PII redaction.
- Manual: sample reconciliation under the written metric definition.
- Writes: none to orders/shipping.

### P6 — Analytics

- Automated: formula/golden fixtures, date-zone boundaries, relist/visits/delta/idempotency.
- Manual: source reconciliation and tolerance explanation.

### P7 — Market intelligence

- Automated: candidate normalization, hard exclusions, scoring, statistics, algorithm versioning, snapshot jobs.
- Manual: labeled gold set with precision/coverage reporting across representative categories and new/used condition.

### P8 — AI text

- Automated/evaluations: factual grounding, prompt injection, conflicting/missing facts, provider errors, confirmation bypass.
- Manual: quality and factual review; all applies follow P3.

### P9 — Images

- Automated: file/object security, immutable original, access, provenance, moderation/error behavior.
- Manual: side-by-side truthfulness review on varied products and approved replacement smoke.

### P10 — Copilot

- Automated/evaluations: tool authorization, schema validation, indirect prompt injection, stale data, write bypass attempts.
- Manual: analytical answer accuracy and confirmation flow.

### P11 — PWA/polish

- Automated/manual: WCAG 2.2 AA core flows, device matrix, performance budgets, install/update/cache/offline safety.

## Phase 0 local checks

For the current Phase 0 branch, required local checks are:

- npm test (native Node tests; mocked Mercado Libre only);
- npm run build (runtime module-load check);
- npm run typecheck, recorded as unavailable until a TypeScript compiler is installed;
- every required document exists, including the Phase 0 capability report;
- every relative Markdown link resolves;
- no trailing whitespace or patch conflict marker;
- no secret-like local environment file is tracked;
- `git diff --check` passes;
- terminology and status do not contradict across README, architecture, roadmap, API, security, QA, and decisions;
- no UI, seller mutation, order mutation, analytics, image, AI, or PWA feature was introduced.

The real-account result must be reported separately as REAL MPE READ-ONLY. Mock success cannot mark P0 PASS. The explicit report template is docs/PHASE0_CAPABILITY_REPORT.md.
