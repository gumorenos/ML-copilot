# Mercado Libre API research

Research baseline: 2026-09-01. Official documentation is authoritative at implementation time; this file records what was found, not a permanent guarantee.

## Evidence labels

- **Officially documented**: current official Mercado Libre documentation states the behavior.
- **Observed without credentials**: a dated, harmless HTTP read was attempted without a token.
- **Real MPE verified**: exercised against the intended authenticated MPE seller account with sanitized evidence.
- **Unverified**: not yet proven for the intended account/site or current contract.

No endpoint in this document is marked real MPE verified yet. No seller credentials or write calls were used during repository bootstrap.

## Peru applicability

- `MPE` is an official Mercado Libre site identifier in the [sites/categories documentation](https://developers.mercadolivre.com.br/en_us/public-and-private-resources/categories-and-listings). **Officially documented.**
- Peru's authorization host is `https://auth.mercadolibre.com.pe/authorization`, following the country-domain instruction in the [Peru authentication guide](https://developers.mercadolibre.com.pe/es_ar/autenticacion-y-autorizacion?nocache=true). **Officially documented.**
- Product/catalogue search is listed as available for Peru in [Product search](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/buscador-de-productos). **Officially documented.**
- Weekly search trends include Peru in [Trends](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/tendencias). **Officially documented.**
- Catalogue eligibility includes Peru in [Catalogue eligibility](https://developers.mercadolibre.com.pe/es_ar/publica-productos/elegibilidad-catalogo). **Officially documented.**
- The Prices API documents a Peru-specific limitation: buyer-loyalty context is not available for MPE, while standard/channel price behavior remains documented. See [Prices API](https://developers.mercadolibre.com.pe/es_ar/publica-productos/api-de-precios). **Officially documented.**

These statements establish platform recognition, not that every cross-site example or endpoint behaves identically for the intended seller. The Phase 0 matrix must verify that distinction.

## OAuth and identity

### Required flow

Use server-side Authorization Code flow:

1. Generate high-entropy `state` and PKCE verifier/challenge.
2. Redirect to the Peru authorization host with the exact registered HTTPS redirect URI.
3. Validate and consume `state`, then exchange the code at `POST https://api.mercadolibre.com/oauth/token` as form data.
4. Keep client secret, code exchange, access token, and refresh token server-side.
5. Call `/users/me`, confirm the expected account and `site_id = MPE`, then activate the connection.

PKCE is described as optional but recommended in the current [authentication guide](https://developers.mercadolibre.com.pe/es_ar/autenticacion-y-autorizacion?nocache=true); ML Copilot will require it as defense in depth. The redirect URI must be HTTPS and match exactly. An administrator/main account must authorize; an operator/collaborator grant is not valid for the application connection.

### Token behavior

- Send the access token in `Authorization: Bearer ...`, never in a URL.
- Use returned `expires_in`; do not hardcode a lifetime. Current official pages/examples are not fully consistent about the number of hours.
- Refresh tokens rotate and the newest token replaces the previous one. Serialize refresh across Worker isolates and atomically store the new pair.
- The authorization guidance says a refresh token can expire after six months and tokens may invalidate early after password/client-secret changes, revocation, or prolonged API inactivity.
- Reconnection is a normal state, not an exceptional crash path.

See [Identity/access and tokens](https://developers.mercadolibre.com.pe/gestion-de-identidades-y-accesos-oauth-y-tokens), [authorization recommendations](https://developers.mercadolibre.com.pe/es_ar/recomendaciones-de-autorizacion-y-token), and [functional permissions](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/permisos-funcionales).

### Credential security requirements

Mercado Libre's [application security guidance](https://developers.mercadolibre.com.pe/es_ar/calidad-de-publicaciones/seguridad-apps) requires secure credential storage and warns against exposing tokens/authorization data in logs. Its encryption guidance names AES-256 and secret-manager-held keys. ML Copilot therefore adds application-level AES-GCM token encryption even though D1 is encrypted at rest.

## Seller listings and item reads

The main seller inventory discovery path in [Items and searches](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/items-y-busquedas) is:

```http
GET /users/{USER_ID}/items/search
```

Documented behavior includes status filtering, paging, and `search_type=scan` for more than 1,000 results. Scan pages use a short-lived scroll identifier, with a documented maximum page size of 100 and roughly five-minute scroll lifetime. Hydrate item IDs with multiget in batches no larger than 20:

```http
GET /items?ids={ID1,ID2,...}
```

Do not use public marketplace search as the owner inventory source. Public `available_quantity` is intentionally represented in ranges, while an authenticated owner item read is needed for actual stock. `/sites/{SITE_ID}/search?seller_id=...` is also oriented to active marketplace results and will omit historical states.

Phase 0 must compare returned listing IDs/counts/status/substatus against Seller Center, including a sample of active, paused, closed, and out-of-stock states when available.

## Item mutations and lifecycle

The general update shape in [Synchronize and modify listings](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/producto-sincroniza-modifica-publicaciones) is:

```http
PUT /items/{ITEM_ID}
```

Allowed fields depend on listing state, sales history, catalogue relationship, variations, moderation, offers, and price automation. The UI must query capabilities and show a specific reason instead of assuming any field is editable.

Important current rules:

- State includes `active`, `paused`, and `closed`, with meaningful `sub_status` values such as out-of-stock and seller pause.
- A closed listing cannot simply be reactivated; relisting/recreation may be required.
- Quantity reaching zero may pause a listing as out of stock; restocking behavior differs from a seller-explicit pause.
- Title and other fields can become restricted after sales or by listing/category rules.
- A successful HTTP status may include warnings and ignored fields. Always re-read and verify.
- Before any price update, inspect price automation. The current item-update documentation says that from 2026-03-18 a price-only item update under active automation is rejected, while price in a multi-field update can be ignored with a warning.
- Current price reads are moving away from legacy item price fields toward `/items/{id}/sale_price` and `/items/{id}/prices`; use the current Prices API at implementation time.

No write endpoint will be enabled until the Phase 3 controlled-write gate.

### Descriptions

[Item descriptions](https://developers.mercadolibre.com.pe/es_ar/gestiona-ventas/descripcion-de-articulos) document separate read/create/replace resources, including:

```http
GET /items/{ITEM_ID}/description
PUT /items/{ITEM_ID}/description
```

Descriptions are handled as plain text in the documented API. Exact create/update applicability must be checked for item state before enabling the action.

### Attributes and categories

[Attributes](https://developers.mercadolibre.com.pe/es_ar/publica-productos/atributos) and category resources determine required/conditional fields. Updating attributes can replace a submitted set; the client must submit the complete required retained set rather than accidentally dropping values. Category-specific validation belongs in the server adapter and creation workflow.

### Images

[Working with images](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/trabajar-con-imagenes) and [image moderation](https://developers.mercadolibre.com.pe/es_ar/gestiona-ventas/imagenes-y-moderaciones) document JPG/JPEG/PNG upload, a 10 MB limit, category-specific image counts, moderation, and managed catalogue-image restrictions. Image changes must preflight these rules. Original image storage and AI transformations remain deferred to Phase 9.

### Relisting

[Relist](https://developers.mercadolibre.com.pe/re-publica) documents `POST /items/{ITEM_ID}/relist` for eligible closed items. It creates a new item with a parent relationship and is constrained, including one relist per parent in the documented rules. Treat it as a high-consequence create operation, not a status toggle.

## Orders and shipping

[Manage sales](https://developers.mercadolibre.com.pe/es_ar/gestiona-ventas) documents seller order search and individual order resources:

```http
GET /orders/search?seller={SELLER_ID}
GET /orders/{ORDER_ID}
```

Order responses include order items, quantity, unit/gross amounts, statuses, payments, and a shipping reference where applicable. Shipping detail can be fetched through its resource when needed. MPE appears in current order examples, but the intended seller's scopes, fields, pagination, and status behavior remain a real-account gate.

Revenue and AOV definitions must be fixed before implementation—especially paid versus cancelled orders and gross versus actually paid amounts—and reconciled against Seller Center.

## Visits and analytics

[Visits](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/recurso-de-visitas) documents seller/item totals and time windows, including:

```http
GET /users/{USER_ID}/items_visits
GET /users/{USER_ID}/items_visits/time_window
GET /items/{ITEM_ID}/visits/time_window
```

The documented date range is at most 150 days and item total history can reach two years. Relisted items can inherit parent visits. Analytics must record observation windows and avoid adding inherited totals across a relist chain.

## Notifications and reconciliation

[Receive product notifications](https://developers.mercadolibre.com.pe/productos-recibe-notificaciones) documents topics including item and order changes. A notification contains a resource reference; the application should return `200` promptly, deduplicate deliveries, and fetch the authoritative resource. Delivery can be duplicated or retried.

The initial design uses a D1 inbox plus short `waitUntil()` processing and periodic Cron reconciliation. A Queue is not required until measured backlog/retry behavior proves otherwise.

## Market intelligence sources

### Marketplace and catalogue search

Documented candidate sources include:

- `GET /sites/MPE/search` for marketplace search, subject to authenticated access and result constraints;
- catalogue [product search](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/buscador-de-productos);
- category, item, and product resources for structured attributes.

Candidate matching must enforce site/category/condition first, prefer identifiers/brand/model/attributes, and use text only as a later score. Exclude the owner's source listing and handle product/variation duplicates deliberately.

### Auxiliary sources

- [Price references](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/referencias-de-precios) can expose price suggestions and benchmark metadata for eligible items. A `404` can mean no suggestion, and the result is supplemental unless it exposes inspectable comparables.
- Catalogue [competition and price-to-win](https://developers.mercadolibre.com.pe/es_ar/publica-productos/competencia-en-catalogo) applies to catalogue competition, not the entire marketplace.
- [Best sellers/highlights](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/mas-vendidos-en-mercado-libre) and [trends](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/tendencias) provide context, not same-product comparables. Highlights must still be verified for MPE.

No official general historical marketplace-price API was established. This is the basis for storing ML Copilot's own dated comparable snapshots.

## Rate limiting and request policy

No single current official global quota was found that can safely be applied to every endpoint. Implement:

- per-account/endpoint bounded concurrency;
- batching/multiget where documented;
- `429` handling with `Retry-After` where present;
- jittered exponential backoff only for safe/idempotent reads and explicitly safe operations;
- no blind automatic retries for writes;
- response-header and error-shape capture during Phase 0.

Do not copy a community library's numeric requests-per-second default and present it as an official limit.

## Dated unauthenticated observations

On 2026-09-01, harmless requests without an access token returned `403` for:

- `GET /sites/MPE` (`PolicyAgent` response);
- `GET /sites/MPE/search?q=iphone&limit=1` (`forbidden` response);
- `GET /trends/MPE` (`PolicyAgent` response).

This observation is not an API contract. It means ML Copilot must not assume nominally public reads work anonymously; Phase 0 must repeat the matrix with an authorized MPE token.

## Phase 0 read-only verification matrix

| Capability | Evidence required | No-go signal |
|---|---|---|
| OAuth/PKCE | exact MPE callback, state rejection tests, successful main-account grant | operator-only grant or insecure callback requirement |
| Identity | `/users/me` returns expected seller and `site_id=MPE` | wrong site/account or missing required permissions |
| Refresh | one controlled rotation; concurrent callers use one token; newest pair works | old token reused, lost pair, or token appears in logs |
| Seller listings | IDs/count/status sample reconciles with Seller Center | material unexplained mismatch |
| Hydration | item multiget, description, current price and owner stock shapes captured/sanitized | required data unavailable |
| Orders | read-only search shape and pagination captured if account has orders | required permission/data unavailable |
| Visits | time-window response and relist behavior sampled if available | unsupported MPE resource without alternative |
| Marketplace search | authenticated MPE results and candidate fields recorded | no permitted way to retrieve inspectable candidates |
| Catalogue/auxiliary | product search, trends, highlights, suggestions probed and classified | architecture assumes unsupported source |
| Limits/errors | request IDs, headers, `401/403/404/429` shapes documented safely | retries cannot be bounded or errors cannot be classified |

Sanitized fixtures from successful probes may be committed only after secret/PII review. No item mutation is part of this matrix.

## Remaining unknowns

- Exact functional permissions/scopes granted to the intended application and MPE seller.
- Current authenticated MPE availability and field completeness for marketplace search, catalogue, highlights, price suggestions, visits, and notifications.
- Effective rate limits and headers per endpoint/account.
- Which price fields/endpoints are current for every MPE listing type and price automation mode.
- Category/listing-specific editable fields, image rules, and catalogue restrictions.
- Order metric inclusion definition and available history for this account.
- Notification authenticity options beyond application/user/resource validation; current docs must be rechecked before exposing the endpoint.
