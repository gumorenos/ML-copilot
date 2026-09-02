# Research sources

Research and access date: 2026-09-01 unless stated otherwise. Primary documentation should be rechecked before implementation because contracts, limits, and product availability change.

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

## Public repositories inspected

- [mercadolibre/mercadolibre-mcp-server](https://github.com/mercadolibre/mercadolibre-mcp-server), commit `6991a0d623c8b39b5372d12719976bf82aef27d5`
- [MarcosNahuel/mercadolibre-mcp](https://github.com/MarcosNahuel/mercadolibre-mcp), commit `fcff613701c85d4cfca0646610e346ee7fb4916f`
- [ar-agents/ar-agents](https://github.com/ar-agents/ar-agents/tree/main/packages/mercadolibre), commit `38b95ef6e34d6a3f3a9000c369dbe529929c294a`
- [mercadolibre/nodejs-sdk](https://github.com/mercadolibre/nodejs-sdk), commit `82c62056cec56aa089cd7d68ae1138a2fb82fa29`
- [dan1d/mercadolibre-mcp](https://github.com/dan1d/mercadolibre-mcp), commit `a085460f038a183fc4554e41bf6319ac5ae6d537`
- [ralvarezdev/mercadolibre-go-sdk](https://github.com/ralvarezdev/mercadolibre-go-sdk), commit `d88a115afeafec6a1ecfe387e885ddb53203bc6d`

Detailed license, test, runtime, MPE, and reuse findings are in [GITHUB_REUSE.md](GITHUB_REUSE.md).

## Bootstrap observations

The target GitHub repository was empty at clone time: no commits and no tracked files.

Harmless unauthenticated MPE reads on 2026-09-01 returned `403`, as recorded in [MERCADOLIBRE_API.md](MERCADOLIBRE_API.md). These are observations, not authoritative endpoint contracts.
