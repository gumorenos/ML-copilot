# Conceptual D1 data model

Status: Phase 0C implements only the three auth/state tables below. Later operational/history tables remain conceptual until their roadmap phase is explicitly authorized.

## Modeling rules

- Mercado Libre remains operational source of truth.
- Store app configuration, encrypted credentials, account capability metadata, safety/audit state, and later bounded historical observations—not a full upstream mirror.
- Use UTC timestamps and opaque text identifiers for Mercado Libre user, item, product, family, order, and warehouse IDs. Never use 32-bit numeric IDs.
- Keep frequently queried fields as columns; use bounded JSON only for fields that do not need relational filtering.
- Never store plaintext access/refresh tokens, authorization codes, buyer PII, raw upstream payload dumps, or image binaries in D1.

## Phase 0 migration: `0001_phase0_auth.sql`

### `accounts`

One connected seller account initially.

- `id` text primary key (`meli:<opaque user id>`)
- `ml_user_id` text unique
- `site_id` text constrained to `MPE`
- `tags_json` bounded JSON snapshot of relevant seller capability tags
- `connection_status` text
- `connected_at`, `last_verified_at`, `created_at`, `updated_at` UTC text

The Phase 0 account repository stores only identity, site, connection state, timestamps, and relevant tags. It does not persist titles, descriptions, buyer data, or a complete `/users/me` payload.

### `oauth_credentials`

One current rotating token pair per account.

- `account_id` primary/foreign key
- `encrypted_json` AES-GCM ciphertext containing the complete OAuth token object
- `expires_at` derived from the provider's returned `expires_in`
- `credential_version` integer for compare-and-swap
- `refresh_lease_owner`, `refresh_lease_until` nullable short-lived coordination fields
- `updated_at` UTC text

The encryption key is a versioned Worker Secret. AES-GCM associated data binds the account ID and key version. The row never contains token plaintext, token type, or scope as queryable columns.

### `oauth_states`

Short-lived OAuth transaction state.

- `state_hash` primary key
- encrypted PKCE verifier and random IV
- `safe_return_path`
- `expires_at`, `consumed_at`, `created_at`

The callback consumes a state row with an atomic conditional update before exchanging the authorization code. Authorization codes are never persisted.

## Local D1 evidence

`npm run test:worker` applies the migration to local Workerd/D1 and verifies table creation, one-time/expired state, encrypted credential persistence, one lease winner, stale-writer rejection, expired-lease recovery, and malformed/partial-lease failure. `npm run d1:migrate:local` applies the same migration to Wrangler's persistent local database. Neither is deployed Cloudflare evidence.

## Future tables introduced by owning phases

- `audit_events` — Phase 1/3 connection, refresh, and mutation audit (append-only and redacted).
- `change_intents` — Phase 3 single-use prepare/confirm/apply state machine.
- `webhook_events`, `sync_cursors` — notification/reconciliation phases.
- `listing_snapshots`, `order_facts` — analytics and sales history.
- `comparable_sets`, `comparable_entries` — market intelligence snapshots with reproducible statistics.
- `ai_suggestions` — grounded proposals and decisions.
- `image_assets` — private R2 object metadata and immutable-original provenance.

Each future table requires its own migration, indexes, retention policy, and tests. Snapshot jobs must be bounded/checkpointed to respect D1 usage and Worker limits; avoid unnecessary full scans.

## Not in the database

- Mercado Libre passwords, authorization codes, access/refresh tokens in plaintext, or encryption keys
- complete listing/order/customer mirrors or arbitrary raw API responses
- buyer addresses/contact/payment data without a separately approved requirement
- image binaries (deferred to private R2)
- unrestricted AI transcripts or provider secrets