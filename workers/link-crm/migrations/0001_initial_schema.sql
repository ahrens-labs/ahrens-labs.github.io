-- Initial schema for link CRM
-- Based on original Prisma schema converted to D1 SQL

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  image TEXT,
  email_verified INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- OAuth accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  refresh_token_expires_in INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- Contacts table (PII fields will be encrypted)
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL, -- encrypted
  email TEXT, -- encrypted
  phone TEXT, -- encrypted
  title TEXT,
  company TEXT,
  birthday INTEGER, -- unix timestamp
  relationship_status TEXT NOT NULL DEFAULT 'MONTHLY',
  tags TEXT, -- JSON array stored as text
  notes TEXT,
  next_follow_up_date INTEGER, -- unix timestamp
  significant_date1 INTEGER, -- unix timestamp
  significant_date1_label TEXT,
  significant_date2 INTEGER,
  significant_date2_label TEXT,
  significant_date3 INTEGER,
  significant_date3_label TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts(tags);

-- Interactions table
CREATE TABLE IF NOT EXISTS interactions (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  type TEXT NOT NULL, -- EMAIL, MEETING, PHONE_CALL, VOICE_NOTE, MANUAL
  date INTEGER NOT NULL, -- unix timestamp
  title TEXT,
  notes TEXT,
  duration INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interactions_contact_id ON interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_date ON interactions(date DESC);

-- Voice notes table
CREATE TABLE IF NOT EXISTS voice_notes (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  transcription TEXT,
  audio_url TEXT,
  duration INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_voice_notes_contact_id ON voice_notes(contact_id);

-- Reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  type TEXT NOT NULL, -- BIRTHDAY, SIGNIFICANT_DATE, FOLLOW_UP, INACTIVITY
  date INTEGER NOT NULL, -- unix timestamp
  title TEXT NOT NULL,
  description TEXT,
  dismissed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reminders_contact_id ON reminders(contact_id);
CREATE INDEX IF NOT EXISTS idx_reminders_date ON reminders(date);
CREATE INDEX IF NOT EXISTS idx_reminders_dismissed ON reminders(dismissed);
