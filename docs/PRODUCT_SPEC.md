# Product specification

Status: planning baseline, 2026-09-01

## Product definition

ML Copilot is a personal, mobile-first web application for one Mercado Libre seller account in Peru (`MPE`). It provides a simpler operational view while Mercado Libre remains authoritative for listings, orders, shipping, and marketplace state.

The product optimizes for simplicity, reliability, safe changes, and useful decisions for a small catalogue. It is not an ERP, accounting package, invoicing system, CRM, claims/returns workflow, purchasing system, warehouse system, or multi-tenant commercial platform.

## Product principles

1. **Source truth stays upstream.** Read current operational state from Mercado Libre and store only justified app state and historical observations.
2. **Writes are deliberate.** Preview, explicit confirmation, server revalidation, execution, verification, and audit are one invariant workflow.
3. **AI proposes; the owner decides.** No autonomous listing changes.
4. **Facts before prose.** Deterministic calculations and structured attributes ground insights and suggestions.
5. **Comparables are explainable.** Statistics always link to the listings and criteria behind them.
6. **Small-system economics.** Add infrastructure only when measured need justifies it.
7. **Mobile first, not mobile only.** Core work must remain efficient on desktop.

## Primary navigation

- Home
- Publications
- Sales
- Market
- Analytics
- Settings

AI assistance should live primarily inside a listing or insight rather than in a separate, oversized AI area.

## Functional areas

### Account connection

- Connect the account with Mercado Libre OAuth.
- Show connected account identity, MPE site, token health, and last successful synchronization.
- Handle token rotation, expiry, revocation, and reconnect clearly.
- Reject or safely quarantine a connection that is not the intended `MPE` owner account.

### Publications

- List existing publications with paging/search and useful filters.
- Distinguish active, paused, closed, out-of-stock, new, and used state where API data supports it.
- Inspect title, description, category, attributes, condition, current price, actual owner-visible stock, images, status/substatus, and Mercado Libre URL.
- Identify older/closed/paused publications worth reviewing.
- Edit only fields currently allowed by Mercado Libre and the listing's state.
- Support price, stock, description, allowed attributes, images, pause, reactivate, close, and relist/recreate as separate guarded operations.
- Create and duplicate listings through category and attribute validation in the later creation phase.

The UI must explain when Mercado Libre rules prevent an edit, require relisting, manage an image, or place a listing under price automation.

### Sales

- Show recent orders, product, quantity, unit price, total, date, order/payment status, and shipping status when available.
- Show a simple order timeline assembled from authoritative timestamps/status data.
- Link to Mercado Libre for workflows deliberately left out of scope.
- Calculate revenue, orders, units, and average order value from a documented inclusion rule.

Initial sales scope excludes invoices, accounting, returns/claims workflows, CRM, suppliers, purchasing, and warehouse management.

### Analytics

Overall and per-listing analytics may include:

- revenue;
- orders and units;
- average order value;
- visits and conversion rate;
- current price and stock;
- best sellers and products with no movement;
- many visits with few or no sales;
- 7-, 30-, and 90-day windows with previous-equivalent-period comparisons.

Insights such as low stock, zero sales, falling visits, and price drift are deterministic rules with visible definitions. Metrics must name their data window and last refresh time. Relisted listings require chain-aware visit handling so inherited visits are not double-counted.

### Market intelligence

For a source listing, comparable candidates are narrowed and scored using this preference order:

1. site `MPE`;
2. category;
3. condition, with new and used separated;
4. product identifiers;
5. brand and model;
6. structured attributes;
7. title/text similarity as a supporting signal.

LLM matching is optional and cannot be the only inclusion criterion. Every comparable set records its rules and algorithm version. The owner can include/exclude candidates where automatic matching is uncertain.

For an accepted comparable set, calculate count, minimum, maximum, mean, median, useful percentiles when sample size permits, and the owner's relative market position. Always show the actual listings, observation time, condition, price, and confidence/exclusion reason behind the result.

Highlights, trends, catalogue competition, and official price-reference suggestions are contextual signals, not substitutes for explainable comparables. External marketplace data and scraping are outside the MVP.

If external reference platforms are considered later, choose sources in this order: official API, official/public feed, permitted public search/data, then carefully evaluated scraping. No fragile scraper belongs in the MVP, and terms, robots/access controls, reliability, and data provenance must be reviewed before collection.

### Historical observations

Periodic snapshots may capture:

- own listing status, price, stock, visits, and derived sales facts;
- comparable set and min/median/max market price;
- selected comparable listing observations;
- algorithm/version and observation time.

History should answer price-drift and before/after questions without attempting to mirror all upstream data.

### Text assistance (later phase)

- Analyze title and description against category, attributes, and known facts.
- Propose a better title or description and identify missing information.
- Never invent brand, model, material, dimensions, condition, compatibility, defects, or other product facts.
- Show input facts, proposed change, and a readable diff before apply.
- Record whether a suggestion was accepted, edited, or rejected when useful.

### Image improvement (later phase)

- Preserve the original image.
- Offer crop, center, exposure, sharpness, background removal/replacement, reasonable upscaling, reordering, main-image selection, and replacement upload.
- Show original and proposal before apply.
- Never change model, color, material, included accessories, markings, defects, or other meaningful product characteristics.
- Retain transformation provenance and prevent misleading output.

### Natural-language copilot (later phase)

The copilot may answer analytical questions and prepare change proposals. It uses deterministic tools/service methods and grounded data. Any write becomes the same pending change intent used by the normal UI and requires explicit confirmation. It receives no unrestricted Mercado Libre write client.

## Material action policy

Material actions include at least price, stock, description, attributes, images, state changes, close, relist, and new listing publication. The flow is:

```text
request draft
  -> fetch authoritative current state and restrictions
  -> validate and create expiring pending intent
  -> show canonical before/after preview
  -> explicit owner confirmation
  -> fetch and compare current state again
  -> execute once
  -> re-read and verify
  -> append immutable audit outcome
```

A changed precondition invalidates the preview. Missing confirmation fails closed. Close and relist require enhanced warning because they may be irreversible or create a new listing.

## Non-functional requirements

- Responsive from small phones through desktop.
- Accessible keyboard navigation, labels, focus handling, contrast, and status messaging; target WCAG 2.2 AA where applicable.
- Fast first view and resilient loading/error/retry states on mobile connections.
- Idempotent processing for notifications and scheduled jobs.
- UTC storage with explicit Peru-local presentation.
- PEN-aware but currency-explicit money handling.
- No secret or token in browser storage, source maps, errors, analytics, or logs.
- Clear freshness indicators and links back to Mercado Libre.

## MVP boundary

The first meaningful operational MVP ends after reliable existing-catalogue management and basic sales visibility, not after every phase in the roadmap. Market intelligence is important but must wait until core reads, history, and safety are reliable. AI and image work remain later phases.

## Open product decisions

- Spanish-only versus configurable interface language.
- Exact paid/cancelled order inclusion rule for revenue and AOV.
- Retention periods for order facts, snapshots, audit data, AI analyses, and originals.
- Owner correction workflow for weak comparable matches.
- Snapshot cadence appropriate to API limits and catalogue size.
- Whether Cloudflare Access email OTP is sufficient or a dedicated identity provider is preferred.
