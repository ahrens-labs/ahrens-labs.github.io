-- Tether D1 schema (Phase 0): projects, tasks, membership, inbox, prefs.
-- Encrypted text columns use the same enc:1: AES-GCM format as Durable Object storage.

CREATE TABLE IF NOT EXISTS tether_projects (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tether_projects_owner ON tether_projects(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_tether_projects_updated ON tether_projects(updated_at);

CREATE TABLE IF NOT EXISTS tether_project_members (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  username TEXT,
  email TEXT,
  added_at INTEGER,
  PRIMARY KEY (project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES tether_projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tether_project_members_user ON tether_project_members(user_id);

CREATE TABLE IF NOT EXISTS tether_project_removed (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES tether_projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tether_user_projects (
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  PRIMARY KEY (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_tether_user_projects_project ON tether_user_projects(project_id);

CREATE TABLE IF NOT EXISTS tether_tasks (
  id TEXT NOT NULL,
  project_id TEXT,
  owner_user_id TEXT,
  title TEXT NOT NULL,
  definition_of_done TEXT,
  notes TEXT,
  labels_json TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  due_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  recurrence_json TEXT,
  extra_json TEXT,
  updated_at INTEGER,
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_tether_tasks_project ON tether_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tether_tasks_inbox ON tether_tasks(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_tether_tasks_status_due ON tether_tasks(status, due_date);

CREATE TABLE IF NOT EXISTS tether_task_assignees (
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (task_id, user_id),
  FOREIGN KEY (task_id) REFERENCES tether_tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tether_task_assignees_user ON tether_task_assignees(user_id);

CREATE TABLE IF NOT EXISTS tether_task_deps (
  task_id TEXT NOT NULL,
  depends_on_task_id TEXT NOT NULL,
  PRIMARY KEY (task_id, depends_on_task_id),
  FOREIGN KEY (task_id) REFERENCES tether_tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tether_user_prefs (
  user_id TEXT PRIMARY KEY NOT NULL,
  label_colors_json TEXT,
  settings_json TEXT,
  updated_at INTEGER NOT NULL
);
