CREATE TABLE IF NOT EXISTS phase0_refresh_verifications (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'ambiguous')),
  attempted_at INTEGER NOT NULL,
  completed_at INTEGER,
  credential_version_before INTEGER NOT NULL,
  credential_version_after INTEGER,
  error_code TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_phase0_refresh_verifications_status
  ON phase0_refresh_verifications (status);
