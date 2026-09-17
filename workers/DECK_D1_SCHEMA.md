# Deck — D1 schema

**Database:** `deck-db`  
**Worker binding:** `DECK_DB` (`workers/wrangler.toml`, chess-accounts)  
**Migrations:** `workers/migrations/deck/`

Platform-key AES-GCM (`APP_DATA_ENCRYPTION_KEY`, `enc:1:` prefix) on deck tree text and share payloads (same helpers as former DO storage).

Cutover docs: [`DECK_D1_MIGRATION.md`](./DECK_D1_MIGRATION.md)

---

## Design notes

- **User library** is still a document: encrypted JSON array of decks (with nested stacks/cards) in `deck_user_data.decks_json`. Matches full-document `/api/deck/sync` LWW.
- **Shares** are relational so hydrate/fingerprint can batch-load by `sharedId` without N Durable Object fetches.

```
deck_user_data          — one row per user (full library blob)
deck_shares             — one row per sharedId
  └── deck_share_members
```

---

## Tables

### `deck_user_data`

| Column | Type | Notes |
|---|---|---|
| `user_id` | TEXT PK | Ahrens Labs user id |
| `decks_json` | TEXT NOT NULL | JSON array of decks; field-encrypted via `encryptDeckBlob` (names, card title/notes/front/back, sections, checklist text, stack names) |
| `last_updated` | INTEGER | Client/library sync timestamp |
| `deck_count` | INTEGER NOT NULL | Denormalized count (admin / fingerprint helpers) |
| `card_count` | INTEGER NOT NULL | Denormalized (deck cards + stack cards) |
| `updated_at` | INTEGER NOT NULL | Row write time |

**Logical deck entry shape** (inside `decks_json`, after decrypt):

- Deck: `id`, `name`, `cards[]`, `stacks[]`, `sharedId` / `sharedRef` / `sharedMembers`, timestamps, …
- Stack: `id`, `name`, `cards[]`, `sharedId`, …
- Card: `id`, `title`, `notes`, `front`, `back`, `sections[]`, `checklist[]`, `sharedId`, …

### `deck_shares`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | `sharedId` (e.g. `share_…`) |
| `type` | TEXT NOT NULL | `deck`, `stack`, or `card` (stack shares may be stored as type `deck` payload shape) |
| `owner_user_id` | TEXT NOT NULL | Plaintext |
| `owner_username` | TEXT | |
| `label` | TEXT | **Encrypted** |
| `context_deck_name` | TEXT | **Encrypted** (optional context) |
| `payload_json` | TEXT NOT NULL | JSON; payload encrypted via `encryptSharePayload` |
| `created_at` | INTEGER NOT NULL | |
| `updated_at` | INTEGER NOT NULL | Used in sync fingerprints |

**Indexes:** `idx_deck_shares_owner`, `idx_deck_shares_updated`

### `deck_share_members`

| Column | Type | Notes |
|---|---|---|
| `share_id` | TEXT | PK part; FK → `deck_shares(id)` CASCADE |
| `user_id` | TEXT | PK part |
| `role` | TEXT NOT NULL | default `editor` |
| `username` | TEXT | |
| `email` | TEXT | |
| `added_at` | INTEGER | |

**Indexes:** `idx_deck_share_members_user`

---

## Source migrations

1. `0001_deck_schema.sql` — `deck_user_data`, `deck_shares`, `deck_share_members`
