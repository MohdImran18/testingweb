-- Clearbot Admin Management System schema.
-- server.js runs equivalent idempotent migrations automatically on startup.
CREATE TABLE IF NOT EXISTS admin_records (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_records_collection_idx ON admin_records(collection, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_idx ON admin_records ((lower(data->>'email'))) WHERE collection = 'users';
CREATE UNIQUE INDEX IF NOT EXISTS admin_blogs_slug_idx ON admin_records ((data->>'slug')) WHERE collection = 'blogs';
CREATE TABLE IF NOT EXISTS admin_media (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
