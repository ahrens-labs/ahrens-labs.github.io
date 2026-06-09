-- Tie Link CRM users to Ahrens Labs accounts
ALTER TABLE users ADD COLUMN ahrens_user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_users_ahrens_user_id ON users(ahrens_user_id);
