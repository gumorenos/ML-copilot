# Roadmap

Status date: 2026-09-02. A phase starts only with explicit instruction after its predecessor's gate is met or deliberately waived with a recorded decision.

## Delivery rules

- Deliver small vertical increments with tests and documentation.
- Gates combine automated evidence, mocked/sandbox evidence, and explicitly labeled manual real-account verification.
- Real-account writes begin only in Phase 3 and use a dedicated controlled listing plus an approved runbook.
- If official API evidence contradicts a planned capability, stop, document it, and adjust scope before coding around it.
- Do not pull later infrastructure or AI scope into an earlier phase.

## Phase 0 — Research, architecture, and MPE capability proof

### Repository bootstrap and read-only harness completed

- Product boundaries and safety invariants documented.
- Official Mercado Libre and Cloudflare documentation researched.
- Public repository/license/runtime assessments recorded.
- Architecture, conceptual D1 model, threat controls, test strategy, and decisions proposed.
- A minimal dependency-free read-only harness is implemented on the Phase 0 branch: OAuth/PKCE, encrypted credential round-trip, refresh lease/CAS contract, MPE identity/listing/item reads, runtime schemas, and seller-model classification.
- No seller credentials were available for this work session; no real MPE read-only call has been made and no seller data has been modified.

### Remaining work

- Register/configure the Mercado Libre application with exact MPE HTTPS callback and least required functional permissions.
- Configure the local probe without exposing secrets and complete the real read-only capability run.
- Connect the intended main/admin MPE seller account.
- Exercise the read-only matrix in `MERCADOLIBRE_API.md` and commit sanitized fixtures/evidence.
- Reconcile seller listing count and representative states against Seller Center.
- Rotate a refresh token once and test concurrent refresh serialization without writes.
- Record authenticated MPE behavior, headers, error shapes, and unavailable capabilities.

### Gate P0

All of the following are required:

1. The main/admin MPE account authorizes through exact redirect URI, `state`, and PKCE.
2. `/users/me` identifies the expected seller and `site_id=MPE`.
3. A refresh rotation succeeds, the newest pair is durably retained, concurrent callers do not reuse the old refresh token, and no credential appears in output/logs.
4. Seller listing IDs/count and a sample of statuses match Seller Center or every discrepancy is explained.
5. Item hydration provides the minimum catalogue fields needed for Phase 2.
6. Authenticated MPE marketplace/product discovery is classified well enough to prove or narrow the proposed market-intelligence route; it need not be built yet.
7. Order, visit, trend, highlight, price-reference, and notification capabilities are each labeled verified, unavailable, or deferred with evidence.
8. Retry/rate/error behavior is bounded and documented.
9. All checks are read-only; no seller listing is changed.

Current gate status: PARTIAL pending the external credential and real MPE read-only checks. Automated/mocked checks must pass before the manual run, but they cannot promote this gate to PASS. If item discovery or secure token rotation cannot be proven, Phase 1 is a no-go. If only a later optional capability fails, revise that later phase rather than hiding the gap.

## Phase 1 — Cloudflare foundation and OAuth

### Scope

- React/Vite full-stack Worker scaffold and minimal accessible connection screen.
- custom-hostname environments, Cloudflare Access, and Worker JWT validation.
- D1 migrations for account, OAuth transaction/credential, and audit state.
- Worker Secrets and AES-GCM credential encryption with key versioning.
- OAuth start/callback/reconnect; exact state/PKCE/account/site validation.
- D1-backed cross-isolate rotating refresh coordination.
- typed Mercado Libre client foundation with redaction, safe retries, and errors.
- `/users/me` and listing-count read only.
- CI for formatting/lint/typecheck/unit/integration/migrations/build.

### Gate P1

- A clean checkout can install, test, build, migrate an empty local D1, and run locally from documented commands.
- Staging is accessible only to the approved owner; alternate deployment hostnames are not an auth bypass.
- OAuth negative tests cover forged/replayed/expired state, bad PKCE, wrong account/site, callback errors, and missing configuration.
- Encrypted tokens are never returned to the browser or present in logs/D1 plaintext.
- Concurrent refresh test proves one upstream rotation and atomic new-pair storage.
- A manual staging connection identifies the MPE account and shows an accurate listing count.
- Revocation/expiration produces a clear reconnect state.

## Phase 2 — Existing catalogue, read only

### Scope

- paged listing index, search, status/condition filters, and freshness indicators;
- item details, current price source, stock, images, category, attributes, description, status/substatus, and upstream links;
- active/paused/closed/old listing review;
- bounded loading/error/partial-data behavior.

### Gate P2

- Mocked contract tests cover paging, scan/scroll expiry, multiget partial errors, missing descriptions, catalogue restrictions, and price sources.
- Representative listing counts, fields, and states reconcile with Seller Center.
- Public stock is never shown as actual inventory.
- No mutation route exists.

## Phase 3 — Existing listing management

### Scope

- server-created change intents, expiry/preconditions, confirmation UI, verification, and audit;
- price, stock, description, allowed attributes, images, pause, activate, close, and eligible relist as separate capabilities;
- price automation, warnings, moderation, catalogue, sales-history, and state restrictions.

### Gate P3

- Unit/state-machine and UI tests prove missing confirmation, expiry, replay, drift, and duplicate submit fail closed.
- Mocked API tests cover warning-with-success, partial/ignored update, rate limit, network timeout, and re-read mismatch.
- A dedicated controlled listing completes approved reversible price/stock/pause tests one at a time and reconciles with Seller Center.
- Close and relist receive separate, explicit manual test authorization; they are not implied by the normal smoke test.
- Audit records are complete and redacted.

## Phase 4 — Create and duplicate listings

### Scope

- guided category/attribute validation, condition, price, quantity, images, description, review, and create;
- create from an existing listing as a prefilled draft, never blind cloning;
- validation/moderation feedback and upstream verification.

### Gate P4

- Mocked category/attribute/image validation and stale-draft tests pass.
- On an approved controlled product: create, verify, modify, and pause succeeds.
- Duplicate flow does not carry forbidden IDs, status, sales history, catalogue constraints, or stale stock automatically.

## Phase 5 — Sales

### Scope

- recent orders, item/quantity/amount/status/date, shipping status when practical, timeline, and upstream links;
- documented revenue/order/unit/AOV definitions;
- minimal non-PII order facts for history/reconciliation.

### Gate P5

- Paging, order-status transitions, multi-item orders, cancellation, payment, currency, and partial shipping are contract-tested.
- A meaningful sample reconciles with Seller Center under the documented metric definition.
- No buyer PII is stored or logged outside an approved requirement.

## Phase 6 — Analytics

### Scope

- visits, revenue, orders, units, AOV, conversion, listing/overall views;
- 7/30/90-day and previous-equivalent periods;
- deterministic insight rules and snapshot/delta handling.

### Gate P6

- Metric formulas have fixture-based boundary tests and visible definitions.
- Date-zone boundaries, zero denominators, cancellations, relist chains, inherited visits, late order updates, and missing data are tested.
- Sample totals reconcile against source views within a documented tolerance/reason.

## Phase 7 — Market intelligence and history

### Scope

- MPE candidate retrieval, normalized structured matching, new/used separation, explainable scoring;
- inspectable comparable sets and min/max/mean/median/percentiles;
- own-price position, auxiliary official signals, scheduled snapshots, and history views.

### Gate P7

- Gold-standard manual labels cover a meaningful range of categories and difficult near-matches.
- Precision/coverage thresholds are defined before tuning and reported by condition/category.
- Every statistic is reproducible from visible included entries.
- Manual review confirms comparable quality and catches misleading variants/bundles/conditions.
- Snapshot jobs are idempotent, checkpointed, rate-bounded, and fit D1/Worker limits.

## Phase 8 — AI text assistance

### Scope

- provider-neutral interface, grounded title/description/listing review, factual validation, diff/preview, explicit apply;
- suggestion provenance and useful decision history.

### Gate P8

- Adversarial fixtures test invented facts, prompt injection in listing text, missing attributes, conflicting data, and unsafe apply attempts.
- Suggestions cite the facts used and ungrounded claims are blocked or highlighted.
- Provider outage cannot block normal seller operations.
- All applies use the Phase 3 change-intent path.

## Phase 9 — Image improvement

### Scope

- private original/proposal storage, provider abstraction, crop/center/exposure/sharpness/background/upscale, compare, reorder/main image, explicit apply.

### Gate P9

- Original is immutable and recoverable; provenance and retention are verified.
- Human visual QA across varied products confirms no meaningful product alteration or hidden defects.
- EXIF/metadata, content type, size, decompression, moderation, access control, and deletion tests pass.
- Replacement requires explicit confirmation and upstream verification.

## Phase 10 — Natural-language copilot

### Scope

- grounded analytical questions and controlled proposal tools over the same service layer;
- no general REST/write tool.

### Gate P10

- Prompt-injection and authorization evaluations prove the copilot cannot bypass service policies or confirmation.
- Read answers expose metric freshness/source; writes only create pending intents.
- Tool arguments and outputs are schema-validated and sensitive data is redacted.

## Phase 11 — PWA and polish

### Scope

- optional installability, camera uploads, quick stock actions, accessibility/performance/error refinement.

### Gate P11

- WCAG 2.2 AA review for core flows, mobile device coverage, performance budgets, and resilient update behavior.
- Offline mode never queues or replays seller writes.
- Install/update/cache behavior cannot serve stale confirmation state.
