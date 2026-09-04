# Research sources

Research and access date: 2026-09-02 unless stated otherwise. Primary documentation should be rechecked before implementation because contracts, limits, and product availability change.

## Mercado Libre official documentation

### Identity and security

- [Authentication and authorization](https://developers.mercadolibre.com.pe/es_ar/autenticacion-y-autorizacion?nocache=true)
- [Identity, access, OAuth, and tokens](https://developers.mercadolibre.com.pe/gestion-de-identidades-y-accesos-oauth-y-tokens)
- [Create a Mercado Libre application](https://developers.mercadolibre.com.pe/crea-una-aplicacion-en-mercado-libre-es)
- [Functional permissions](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/permisos-funcionales)
- [Access control and authorization](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/control-de-acceso-y-autorizacion)
- [Authorization and token recommendations](https://developers.mercadolibre.com.pe/es_ar/recomendaciones-de-autorizacion-y-token)
- [Application security](https://developers.mercadolibre.com.pe/es_ar/calidad-de-publicaciones/seguridad-apps)

### Listings and catalogue

- [Sites, categories, and listings](https://developers.mercadolivre.com.br/en_us/public-and-private-resources/categories-and-listings)
- [Items and searches](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/items-y-busquedas)
- [Synchronize and modify listings](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/producto-sincroniza-modifica-publicaciones)
- [Prices API](https://developers.mercadolibre.com.pe/es_ar/publica-productos/api-de-precios)
- [Item descriptions](https://developers.mercadolibre.com.pe/es_ar/gestiona-ventas/descripcion-de-articulos)
- [Attributes](https://developers.mercadolibre.com.pe/es_ar/publica-productos/atributos)
- [Working with images](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/trabajar-con-imagenes)
- [Images and moderation](https://developers.mercadolibre.com.pe/es_ar/gestiona-ventas/imagenes-y-moderaciones)
- [Relist](https://developers.mercadolibre.com.pe/re-publica)
- [Catalogue eligibility](https://developers.mercadolibre.com.pe/es_ar/publica-productos/elegibilidad-catalogo)
- [Product search](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/buscador-de-productos)
- [User Products](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/user-products) (last updated 2026-06-17; seller migration and item markers)
- [Price per variation](https://developers.mercadolibre.com.pe/es_ar/calidad-de-publicaciones/precio-variacion)
- [Multi-origin stock / User Products FAQ](https://developers.mercadolibre.com.pe/en_us/tools/multi-origin-stock-management-user-products) (last updated 2026-05-05)
- [Multi-origin stock](https://developers.mercadolibre.com.pe/es_ar/publica-productos/stock-multi-origen) (last updated 2026-05-15)

### Sales, analytics, and market context

- [Manage sales/orders](https://developers.mercadolibre.com.pe/es_ar/gestiona-ventas)
- [Visits resource](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/recurso-de-visitas)
- [Receive product notifications](https://developers.mercadolibre.com.pe/productos-recibe-notificaciones)
- [Price references](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/referencias-de-precios)
- [Catalogue competition](https://developers.mercadolibre.com.pe/es_ar/publica-productos/competencia-en-catalogo)
- [Best sellers/highlights](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/mas-vendidos-en-mercado-libre)
- [Trends](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/tendencias)
- [Official MCP server](https://developers.mercadolibre.com.ar/en_us/start-testing/mcp-server)

## Cloudflare official documentation

- [React on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)
- [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [D1 pricing and free/paid limits](https://developers.cloudflare.com/d1/platform/pricing/)
- [D1 data security](https://developers.cloudflare.com/d1/reference/data-security/)
- [Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Workers platform limits](https://developers.cloudflare.com/workers/platform/limits/)
- [R2 Workers API](https://developers.cloudflare.com/r2/get-started/workers-api/)
- [Images binding](https://developers.cloudflare.com/images/optimization/binding/)
- [Cloudflare Access common policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/)
- [Access application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)
- [Validate Access JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [One-time PIN identity provider](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)
- [Workers configuration](https://developers.cloudflare.com/workers/configuration/)

## Public repositories inspected

- [mercadolibre/mercadolibre-mcp-server](https://github.com/mercadolibre/mercadolibre-mcp-server), commit `6991a0d623c8b39b5372d12719976bf82aef27d5`
- [MarcosNahuel/mercadolibre-mcp](https://github.com/MarcosNahuel/mercadolibre-mcp), commit `fcff613701c85d4cfca0646610e346ee7fb4916f`
- [ar-agents/ar-agents](https://github.com/ar-agents/ar-agents/tree/main/packages/mercadolibre), commit `38b95ef6e34d6a3f3a9000c369dbe529929c294a`
- [mercadolibre/nodejs-sdk](https://github.com/mercadolibre/nodejs-sdk), commit `82c62056cec56aa089cd7d68ae1138a2fb82fa29`
- [dan1d/mercadolibre-mcp](https://github.com/dan1d/mercadolibre-mcp), commit `a085460f038a183fc4554e41bf6319ac5ae6d537`
- [ralvarezdev/mercadolibre-go-sdk](https://github.com/ralvarezdev/mercadolibre-go-sdk), commit `d88a115afeafec6a1ecfe387e885ddb53203bc6d`

Detailed license, test, runtime, MPE, and reuse findings are in [GITHUB_REUSE.md](GITHUB_REUSE.md).

## Current verification notes

- The authentication page was rechecked on 2026-09-02. It documents Authorization Code (server-side), exact static redirect URI, administrator/main-account authorization, optional-but-required-when-enabled PKCE parameters, allowed offline_access/read/write scopes, expires_in, and single-use rotating refresh tokens.
- The User Products guide was rechecked on 2026-09-02. It documents the user_product_seller migration tag, family_name marker, old/new coexistence, and the absence of a direct list-all-seller-families endpoint.
- The multi-origin FAQ and guide were rechecked on 2026-09-02. They document warehouse_management/multiwarehouse tags and per-warehouse User Product stock management.
- The Cloudflare Secrets, Web Crypto, D1 migrations, and Wrangler configuration pages were rechecked on 2026-09-02. They support Worker Secrets, Web Crypto, versioned migrations, and D1 bindings without adding another runtime service.

## Bootstrap observations

The target GitHub repository was empty at clone time: no commits and no tracked files.

Harmless unauthenticated MPE reads on 2026-09-01 returned `403`, as recorded in [MERCADOLIBRE_API.md](MERCADOLIBRE_API.md). These are observations, not authoritative endpoint contracts.

## Phase 0C Cloudflare verification (checked 2026-09-04)

- [Workers testing overview](https://developers.cloudflare.com/workers/testing/) recommends the Workers Vitest integration and whole-Worker tests.
- [Workers Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/) documents `@cloudflare/vitest-plugin`, `cloudflare:workers`, and the current plugin configuration.
- [Write your first Workers test](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/) documents `readD1Migrations` and the `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)` setup used by this branch.
- [D1 local development](https://developers.cloudflare.com/d1/best-practices/local-development/) documents Wrangler/Miniflare/workerd local D1 and `wrangler d1 migrations apply --local`.
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) documents `wrangler.jsonc`, D1 binding fields, migration directories, and environment configuration.
- [Mock outbound requests](https://developers.cloudflare.com/workers/testing/vitest-integration/mock-outbound-requests/) documents the current MSW path. Phase 0 route tests intentionally inject a small `FetchLike` mock instead of adding MSW; no third-party API mock source code was copied.

Package versions intentionally pinned for this proof: `@cloudflare/vitest-plugin@1.1.4`, `vitest@4.1.11` (plugin peer-compatible), and `wrangler@4.129.0`. These are development dependencies only; no application UI or deployment plugin was added.
## Mercado Libre recheck (2026-09-04)

- [Current Peru Authentication and Authorization](https://developers.mercadolibre.com.pe/autenticacion-y-autorizacion) was rechecked before the Phase 0C Worker. It documents Authorization Code, PKCE parameter behavior, exact configured redirect URI, `expires_in`, rotating single-use refresh tokens, and the latest-token rule.
- [Current Peru Items and Searches](https://developers.mercadolibre.com.pe/es_ar/publica-productos/items-y-busquedas) was rechecked. It keeps `/users/{User_id}/items/search`, `search_type=scan`, and a 20-entry multiget, and announces `/items/bulk` migration before 2026-10-25.
- [Current Peru User Products](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/user-products) was rechecked. It confirms `user_product_seller`, `family_name`, coexistence, and no all-families endpoint.
- [Current Peru distributed stock](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/stock-distribuido) was rechecked for `warehouse_management` and User Product stock resources.
- [Current Peru highlights](https://developers.mercadolibre.com.pe/es_ar/sobre-nuestra-api/mas-vendidos-en-mercado-libre) was rechecked; `/highlights` can mix ITEM, PRODUCT, and USER_PRODUCT entities.

Search results were accessed on 2026-09-04. Direct page fetches can return a documentation-site 403 to automated clients; the search extracts and linked official pages are retained as research leads and must be rechecked in a normal browser when a later phase depends on a detail.

## Phase 0D Cloudflare deployment-readiness verification (checked 2026-09-04)

- [Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/) states that `wrangler secret put` creates a new Worker version and deploys it immediately. The same page documents `wrangler versions secret put` as the non-deploying alternative for creating a version, followed by `wrangler versions deploy`, and documents uploading secrets alongside code with `wrangler versions upload --secrets-file`.
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) documents `secrets.required`; `wrangler deploy` and `wrangler versions upload` validate that the required names are configured, while local development loads only the declared names.
- [Versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/) distinguishes a version from an active deployment and states that ordinary `wrangler deploy` couples creation with immediate 100% deployment; version upload and deployment can be decoupled for review or gradual promotion.

These Cloudflare facts are the basis for the staging runbook in `docs/IMPLEMENTATION_PLAN.md`. No staging Worker or remote D1 was deployed during this task.