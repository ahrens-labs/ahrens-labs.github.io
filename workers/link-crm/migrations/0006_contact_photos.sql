-- Contact profile photos (binary stored in R2; key referenced here)
ALTER TABLE contacts ADD COLUMN photo_key TEXT;
