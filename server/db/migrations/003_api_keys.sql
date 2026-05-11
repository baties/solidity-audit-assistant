-- Migration 003: Add API keys table for public REST API authentication.
-- Users create named API keys (via GitHub OAuth session) to call POST /v1/scan.
-- Only the SHA-256 hash of each key is stored; the plaintext is shown once on creation.
-- Run after 002_users.sql.

CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash      TEXT        NOT NULL UNIQUE,
  key_prefix    TEXT        NOT NULL,
  name          TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id  ON api_keys(user_id);
-- Hash lookup must be fast — called on every /v1/scan request
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
