-- Add contact_dates table for tracking important dates
-- Allows multiple custom dates per contact (birthdays, anniversaries, etc.)

CREATE TABLE IF NOT EXISTS contact_dates (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  type TEXT NOT NULL, -- e.g., "Birthday", "Anniversary", "Work Anniversary"
  month INTEGER NOT NULL, -- 1-12
  day INTEGER NOT NULL, -- 1-31
  year INTEGER, -- optional, can be null for recurring dates without specific year
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contact_dates_contact_id ON contact_dates(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_dates_month_day ON contact_dates(month, day);
