# Tether — D1 schema

**Database:** `tether-db`  
**Worker binding:** `TETHER_DB` (`workers/wrangler.toml`, chess-accounts)  
**Migrations:** `workers/migrations/tether/`

Platform-key AES-GCM (`APP_DATA_ENCRYPTION_KEY`, `enc:1:` prefix) on title/notes/DoD/labels and related text. IDs, status, due dates, membership stay plaintext for indexing.

Cutover docs: [`TETHER_D1_MIGRATION.md`](./TETHER_D1_MIGRATION.md)

---

## Entity relationship (summary)

```
tether_projects
  ├── tether_project_members
  ├── tether_project_removed
  └── tether_tasks (project_id set)
        ├── tether_task_assignees
        └── tether_task_deps

tether_tasks (inbox: project_id NULL, owner_user_id set)
tether_user_projects   — membership index per user
tether_user_prefs      — label colors + settings
```

---

## Tables

### `tether_projects`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `owner_user_id` | TEXT NOT NULL | Plaintext |
| `title` | TEXT NOT NULL | **Encrypted** |
| `description` | TEXT | **Encrypted** |
| `created_at` | INTEGER NOT NULL | |
| `updated_at` | INTEGER NOT NULL | |

**Indexes:** `idx_tether_projects_owner`, `idx_tether_projects_updated`

### `tether_project_members`

| Column | Type | Notes |
|---|---|---|
| `project_id` | TEXT | PK part; FK → `tether_projects` CASCADE |
| `user_id` | TEXT | PK part |
| `role` | TEXT NOT NULL | default `member` |
| `username` | TEXT | |
| `email` | TEXT | |
| `added_at` | INTEGER | |

**Indexes:** `idx_tether_project_members_user`

### `tether_project_removed`

| Column | Type | Notes |
|---|---|---|
| `project_id` | TEXT | PK part; FK CASCADE |
| `user_id` | TEXT | PK part — blocked from share-link rejoin |

### `tether_user_projects`

| Column | Type | Notes |
|---|---|---|
| `user_id` | TEXT | PK part — list membership index |
| `project_id` | TEXT | PK part |

**Indexes:** `idx_tether_user_projects_project`

### `tether_tasks`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `project_id` | TEXT | NULL for inbox tasks |
| `owner_user_id` | TEXT | Set for inbox (`project_id` IS NULL) |
| `title` | TEXT NOT NULL | **Encrypted** |
| `definition_of_done` | TEXT | **Encrypted** |
| `notes` | TEXT | **Encrypted** |
| `labels_json` | TEXT | JSON array of **encrypted** label strings |
| `status` | TEXT NOT NULL | default `todo` (plaintext) |
| `due_date` | TEXT | Plaintext ISO date string |
| `sort_order` | INTEGER NOT NULL | default 0 |
| `recurrence_json` | TEXT | Flat client fields: `recurrence`, `recurrenceInterval`, `recurrenceDay`, `recurrenceWeekOfMonth`, `recurrenceMonth` |
| `extra_json` | TEXT | Other task fields (e.g. `todoistSchedule`) |
| `updated_at` | INTEGER | |

**Indexes:** `idx_tether_tasks_project`, `idx_tether_tasks_inbox`, `idx_tether_tasks_status_due`

### `tether_task_assignees`

| Column | Type | Notes |
|---|---|---|
| `task_id` | TEXT | PK part; FK → `tether_tasks` CASCADE |
| `user_id` | TEXT | PK part |

**Indexes:** `idx_tether_task_assignees_user`

### `tether_task_deps`

| Column | Type | Notes |
|---|---|---|
| `task_id` | TEXT | PK part; FK CASCADE |
| `depends_on_task_id` | TEXT | PK part |

### `tether_user_prefs`

| Column | Type | Notes |
|---|---|---|
| `user_id` | TEXT PK | |
| `label_colors_json` | TEXT | `{ "label": colorIndex }` |
| `settings_json` | TEXT | e.g. `{ "myTasksShowAllDays": false }` |
| `updated_at` | INTEGER NOT NULL | |

---

## Source migrations

1. `0001_tether_schema.sql` — all tables above  

Runtime may also create `tether_migration_meta` for one-shot auto-backfill bookkeeping (not in the formal migration file).
