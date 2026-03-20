-- SolidityGuard AI — canonical database schema.
-- This file reflects the current intended state of the DB.
-- Never edit this file directly for schema changes — add a new migration instead.
-- Mounted as /docker-entrypoint-initdb.d/001_schema.sql in Docker for auto-init.

CREATE TABLE IF NOT EXISTS scans (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  target        TEXT        NOT NULL,
  target_type   TEXT        NOT NULL CHECK (target_type IN ('github', 'address')),
  chain         TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  risk_score    INTEGER     CHECK (risk_score BETWEEN 0 AND 100),
  risk_label    TEXT        CHECK (risk_label IN ('critical', 'high', 'medium', 'low', 'safe')),
  summary       TEXT,
  duration_ms   INTEGER,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS findings (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id        UUID        NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  severity       TEXT        NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  title          TEXT        NOT NULL,
  description    TEXT        NOT NULL,
  recommendation TEXT        NOT NULL,
  filename       TEXT,
  line_number    INTEGER,
  swc_id         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_findings_scan_id   ON findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_scans_created_at   ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_status       ON scans(status);
