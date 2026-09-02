CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  ml_user_id TEXT NOT NULL UNIQUE,
  site_id TEXT NOT NULL CHECK (site_id = 'MPE'),
  tags_json TEXT NOT NULL DEFAULT '[]',
  connection_status TEXT NOT NULL DEFAULT 'connected',
  connected_at TEXT NOT NULL,
  last_verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY,
  code_verifier_ciphertext TEXT NOT NULL,
  code_verifier_iv TEXT NOT NULL,
  safe_return_path TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_credentials (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  encrypted_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  credential_version INTEGER NOT NULL DEFAULT 1,
  refresh_lease_owner TEXT,
  refresh_lease_until INTEGER,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_credentials_lease
  ON oauth_credentials (refresh_lease_until);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry
  ON oauth_states (expires_at);
