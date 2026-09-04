# Roadmap

Status date: 2026-09-04. A phase starts only with explicit instruction after its predecessor gate is met or deliberately waived with a recorded decision.

## Delivery rules

- Deliver small vertical increments with tests and synchronized documentation.
- Distinguish automated, local Workerd/D1, deployed Cloudflare, and real MPE evidence.
- Real seller-data writes begin no earlier than Phase 3 and require a dedicated controlled runbook.
- Do not add infrastructure or later product scope before measured need and an ADR.

## Phase 0 — Research, architecture, and MPE capability proof

### Phase 0D completed in this branch

- Real TypeScript compiler/build tooling and pinned lockfile.
- Independent GitHub Actions quality workflow; no deployment or secrets.
- Minimal Cloudflare Worker with protected start/capability routes and public OAuth callback.
- AES-GCM state/token persistence, D1 account/credential/state stores, rotating refresh lease/CAS.
- Actual local Workerd/D1 migration and persistence tests.
- Mocked Worker route tests with read-only Mercado Libre responses.
- Reviewable staging configuration template, required-secret validation, and one-time forced refresh verification route.

### Remaining external gate

- Create/configure the Mercado Libre application and exact HTTPS callback.
- Deploy the narrow Worker and bind a staging D1 database.
- Authorize the intended administrator/main MPE account.
- Verify `/users/me`, `site_id=MPE`, seller count/paging, bounded item sample, tags, and seller model.
- Exercise one safe refresh rotation where possible and reconcile results with Seller Center.
- Record only sanitized evidence in `docs/PHASE0_CAPABILITY_REPORT.md`.

### Phase 0 status and gate

Current status: **PARTIAL**. Local automated and Workerd/D1 gates pass; deployed and real MPE evidence are absent. PASS requires the external checklist. No seller/business write is allowed.

## Phase 1 — Cloudflare foundation and owner authentication (deferred)

React/Vite application shell, staging/production environments, Cloudflare Access/JWT boundary, minimal connection screen, promoted service/repository boundaries, and an authenticated listing-count read. Start only after Phase 0 PASS or an explicitly recorded waiver.

## Later phases (not started)

- Phase 2: catalogue read UI and listing details.
- Phase 3: controlled listing management and audit intents.
- Phase 4: create/duplicate listings.
- Phase 5: sales/order facts.
- Phase 6: deterministic analytics.
- Phase 7: market intelligence and history.
- Phase 8: grounded AI text assistance.
- Phase 9: image improvement with immutable originals.
- Phase 10: natural-language copilot with confirmation-bound actions.
- Phase 11: PWA and polish.

Each later phase needs its own documented acceptance gate. This branch must stop after Phase 0D.
