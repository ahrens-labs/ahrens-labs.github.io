-- Deck D1 schema (Phase 0): per-user deck blobs + share records.
-- Deck trees stay document-shaped (full sync LWW); shares are relational for hydrate batching.

CREATE TABLE IF NOT EXISTS deck_user_data (
  user_id TEXT PRIMARY KEY NOT NULL,
  decks_json TEXT NOT NULL,
  last_updated INTEGER,
  deck_count INTEGER NOT NULL DEFAULT 0,
  card_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS deck_shares (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  owner_username TEXT,
  label TEXT,
  context_deck_name TEXT,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deck_shares_owner ON deck_shares(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_deck_shares_updated ON deck_shares(updated_at);

CREATE TABLE IF NOT EXISTS deck_share_members (
  share_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  username TEXT,
  email TEXT,
  added_at INTEGER,
  PRIMARY KEY (share_id, user_id),
  FOREIGN KEY (share_id) REFERENCES deck_shares(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deck_share_members_user ON deck_share_members(user_id);
