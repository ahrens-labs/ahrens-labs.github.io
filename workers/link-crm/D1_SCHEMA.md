# Link CRM — D1 schema

**Database:** `link-crm-db`  
**Worker binding:** `DB` (`workers/link-crm/wrangler.toml`)  
**Migrations:** `workers/link-crm/migrations/`

Platform-key AES-GCM encryption (`ENCRYPTION_KEY`) applies to contact PII and related text fields. Login emails and foreign keys stay plaintext for query.

---

## Tables

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `email` | TEXT UNIQUE NOT NULL | Plaintext (login / lookup) |
| `name` | TEXT | Display name |
| `image` | TEXT | |
| `email_verified` | INTEGER | |
| `ahrens_user_id` | TEXT | Link ↔ Ahrens Labs account (migration 0004) |
| `ahrens_username` | TEXT | Nav username (migration 0005) |
| `created_at` | INTEGER | unixepoch default |
| `updated_at` | INTEGER | unixepoch default |

**Indexes:** `idx_users_ahrens_user_id`, `idx_users_ahrens_username`

### `accounts` (OAuth)

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `user_id` | TEXT NOT NULL | FK → `users(id)` CASCADE |
| `type` | TEXT NOT NULL | |
| `provider` | TEXT NOT NULL | |
| `provider_account_id` | TEXT NOT NULL | UNIQUE with `provider` |
| `refresh_token` | TEXT | |
| `access_token` | TEXT | |
| `expires_at` | INTEGER | |
| `token_type` | TEXT | |
| `scope` | TEXT | |
| `id_token` | TEXT | |
| `session_state` | TEXT | |
| `refresh_token_expires_in` | INTEGER | |
| `created_at` / `updated_at` | INTEGER | |

**Indexes:** `idx_accounts_user_id`

### `credentials` (local auth)

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `user_id` | TEXT NOT NULL UNIQUE | FK → `users(id)` CASCADE |
| `email` | TEXT UNIQUE NOT NULL | Plaintext |
| `password_hash` | TEXT NOT NULL | Hashed, not encrypted |
| `created_at` / `updated_at` | INTEGER | |

**Indexes:** `idx_credentials_email`, `idx_credentials_user_id`

### `contacts`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `user_id` | TEXT NOT NULL | FK → `users(id)` CASCADE |
| `name` | TEXT NOT NULL | **Encrypted** |
| `email` | TEXT | **Encrypted** |
| `phone` | TEXT | **Encrypted** |
| `title` | TEXT | **Encrypted** (extended coverage) |
| `company` | TEXT | **Encrypted** (extended coverage) |
| `birthday` | INTEGER | unix timestamp |
| `relationship_status` | TEXT NOT NULL | default `MONTHLY` |
| `tags` | TEXT | JSON array as text |
| `notes` | TEXT | **Encrypted** (extended coverage) |
| `next_follow_up_date` | INTEGER | |
| `significant_date1` / `_label` | INTEGER / TEXT | legacy columns |
| `significant_date2` / `_label` | INTEGER / TEXT | |
| `significant_date3` / `_label` | INTEGER / TEXT | |
| `photo_key` | TEXT | R2 key (migration 0006) |
| `photo_data` | TEXT | base64 blob (migration 0007) |
| `photo_content_type` | TEXT | |
| `created_at` / `updated_at` | INTEGER | |

**Indexes:** `idx_contacts_user_id`, `idx_contacts_tags`

### `contact_dates`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `contact_id` | TEXT NOT NULL | FK → `contacts(id)` CASCADE |
| `type` | TEXT NOT NULL | e.g. Birthday, Anniversary |
| `month` | INTEGER NOT NULL | 1–12 |
| `day` | INTEGER NOT NULL | 1–31 |
| `year` | INTEGER | optional |
| `created_at` / `updated_at` | INTEGER | |

**Indexes:** `idx_contact_dates_contact_id`, `idx_contact_dates_month_day`

### `interactions`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `contact_id` | TEXT NOT NULL | FK → `contacts(id)` CASCADE |
| `type` | TEXT NOT NULL | EMAIL, MEETING, PHONE_CALL, VOICE_NOTE, MANUAL |
| `date` | INTEGER NOT NULL | |
| `title` | TEXT | **Encrypted** (extended coverage) |
| `notes` | TEXT | **Encrypted** (extended coverage) |
| `duration` | INTEGER | |
| `created_at` | INTEGER | |

**Indexes:** `idx_interactions_contact_id`, `idx_interactions_date`

### `voice_notes`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `contact_id` | TEXT NOT NULL | FK → `contacts(id)` CASCADE |
| `transcription` | TEXT | **Encrypted** (extended coverage) |
| `audio_url` | TEXT | |
| `duration` | INTEGER | |
| `created_at` | INTEGER | |

**Indexes:** `idx_voice_notes_contact_id`

### `reminders`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `contact_id` | TEXT NOT NULL | FK → `contacts(id)` CASCADE |
| `type` | TEXT NOT NULL | BIRTHDAY, SIGNIFICANT_DATE, FOLLOW_UP, INACTIVITY |
| `date` | INTEGER NOT NULL | |
| `title` | TEXT NOT NULL | **Encrypted** (extended coverage) |
| `description` | TEXT | **Encrypted** (extended coverage) |
| `dismissed` | INTEGER NOT NULL | default 0 |
| `created_at` | INTEGER | |

**Indexes:** `idx_reminders_contact_id`, `idx_reminders_date`, `idx_reminders_dismissed`

---

## Source migrations

1. `0001_initial_schema.sql` — users, accounts, contacts, interactions, voice_notes, reminders  
2. `0002_credentials_table.sql` — credentials  
3. `0003_contact_dates.sql` — contact_dates  
4. `0004_ahrens_user_id.sql` — `users.ahrens_user_id`  
5. `0005_ahrens_username.sql` — `users.ahrens_username`  
6. `0006_contact_photos.sql` — `contacts.photo_key`  
7. `0007_contact_photo_data.sql` — `contacts.photo_data`, `photo_content_type`
