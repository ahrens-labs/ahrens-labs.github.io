-- Ahrens Labs account username for nav display (separate from Link/Google display name).
ALTER TABLE users ADD COLUMN ahrens_username TEXT;
CREATE INDEX IF NOT EXISTS idx_users_ahrens_username ON users(ahrens_username);
