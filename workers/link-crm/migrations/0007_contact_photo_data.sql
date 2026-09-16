-- Store compressed contact photos in D1 (small JPEG/PNG/WebP blobs as base64)
ALTER TABLE contacts ADD COLUMN photo_data TEXT;
ALTER TABLE contacts ADD COLUMN photo_content_type TEXT;
