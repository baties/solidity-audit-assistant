-- Migration 002: Add users table and associate scans with users.
-- Adds GitHub OAuth users table and an optional user_id FK on scans.
-- Run after 001_initial.sql.

CREATE TABLE IF NOT EXISTS users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id   TEXT        NOT NULL UNIQUE,
  name        TEXT,
  email       TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
