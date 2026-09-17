/**
 * Tether D1 storage layer — projects, tasks, membership, inbox, prefs.
 * Used for dual-write / read-flip / primary cutover from TetherProject DOs.
 */
import {
  getAppDataKey,
  encryptString,
  decryptString,
  encryptTetherTask,
  decryptTetherTask,
} from './app-data-crypto.js';

const TASK_CORE_KEYS = new Set([
  'id',
  'title',
  'definitionOfDone',
  'notes',
  'labels',
  'status',
  'dueDate',
  'sortOrder',
  'assigneeUserIds',
  'dependsOnTaskIds',
  'recurrence',
]);

export function hasTetherD1(env) {
  return !!(env && env.TETHER_DB);
}

/** Shadow-write to D1 (Phase 1+). Default on when binding exists unless explicitly "0". */
export function tetherD1WriteEnabled(env) {
  return hasTetherD1(env) && String(env.TETHER_D1_WRITE ?? '1') !== '0';
}

/** Serve reads from D1 (Phase 4+). */
export function tetherD1ReadEnabled(env) {
  return (
    hasTetherD1(env) &&
    (String(env.TETHER_D1_READ || '') === '1' || tetherD1PrimaryEnabled(env))
  );
}

/** Stop Durable Object project writes (Phase 5+). */
export function tetherD1PrimaryEnabled(env) {
  return hasTetherD1(env) && String(env.TETHER_D1_PRIMARY || '') === '1';
}

/** Inbox / label colors / settings live in D1 (Phase 6). */
export function tetherD1UserDataEnabled(env) {
  return (
    hasTetherD1(env) &&
    (String(env.TETHER_D1_USER_DATA || '') === '1' || tetherD1PrimaryEnabled(env))
  );
}

/** Log DO vs D1 mismatches without changing responses (Phase 3). */
export function tetherD1CompareEnabled(env) {
  return hasTetherD1(env) && String(env.TETHER_D1_COMPARE || '') === '1';
}

function safeJsonParse(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function taskExtra(task) {
  const extra = {};
  for (const [k, v] of Object.entries(task || {})) {
    if (!TASK_CORE_KEYS.has(k)) extra[k] = v;
  }
  return Object.keys(extra).length ? extra : null;
}

async function encryptTaskRow(task, keyHex) {
  const enc = await encryptTetherTask(task, keyHex);
  return {
    id: String(task.id),
    title: enc.title != null ? String(enc.title) : '',
    definition_of_done: enc.definitionOfDone != null ? String(enc.definitionOfDone) : null,
    notes: enc.notes != null ? String(enc.notes) : null,
    labels_json: Array.isArray(enc.labels) ? JSON.stringify(enc.labels) : null,
    status: String(task.status || 'todo'),
    due_date: task.dueDate != null && String(task.dueDate).trim() ? String(task.dueDate) : null,
    sort_order: Number.isFinite(Number(task.sortOrder)) ? Number(task.sortOrder) : 0,
    recurrence_json: task.recurrence && typeof task.recurrence === 'object' ? JSON.stringify(task.recurrence) : null,
    extra_json: (() => {
      const ex = taskExtra(task);
      return ex ? JSON.stringify(ex) : null;
    })(),
    assigneeUserIds: Array.isArray(task.assigneeUserIds)
      ? task.assigneeUserIds.map(String).filter(Boolean)
      : [],
    dependsOnTaskIds: Array.isArray(task.dependsOnTaskIds)
      ? task.dependsOnTaskIds.map(String).filter(Boolean)
      : [],
  };
}

async function rowToTask(row, keyHex) {
  if (!row) return null;
  const labels = safeJsonParse(row.labels_json, []);
  const base = {
    id: row.id,
    title: row.title,
    definitionOfDone: row.definition_of_done || '',
    notes: row.notes || '',
    labels: Array.isArray(labels) ? labels : [],
    status: row.status || 'todo',
    dueDate: row.due_date || '',
    sortOrder: Number(row.sort_order) || 0,
  };
  if (row.recurrence_json) {
    const rec = safeJsonParse(row.recurrence_json, null);
    if (rec) base.recurrence = rec;
  }
  const extra = safeJsonParse(row.extra_json, null);
  if (extra && typeof extra === 'object') Object.assign(base, extra);
  const decrypted = await decryptTetherTask(base, keyHex);
  decrypted.assigneeUserIds = Array.isArray(row._assignees) ? row._assignees : [];
  decrypted.dependsOnTaskIds = Array.isArray(row._deps) ? row._deps : [];
  return decrypted;
}

const D1_MAX_BOUND_PARAMS = 99;

function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function queryByTaskIdIn(db, sqlPrefix, ids) {
  if (!ids.length) return [];
  const rows = [];
  for (const chunk of chunkArray(ids, D1_MAX_BOUND_PARAMS)) {
    const placeholders = chunk.map(() => '?').join(',');
    const part =
      (
        await db
          .prepare(`${sqlPrefix} IN (${placeholders})`)
          .bind(...chunk)
          .all()
      ).results || [];
    rows.push(...part);
  }
  return rows;
}

/**
 * Replace a full project document in D1 (last-write-wins).
 * Updates members, removed list, tasks, assignees, deps, and membership index.
 */
export async function d1PutProject(env, project) {
  if (!hasTetherD1(env) || !project?.id) return;
  const db = env.TETHER_DB;
  const key = getAppDataKey(env);
  const projectId = String(project.id);
  const ownerUserId = String(project.ownerUserId || '');
  const now = Number(project.updatedAt) || Date.now();
  const createdAt = Number(project.createdAt) || now;
  const titleEnc = await encryptString(String(project.title || ''), key);
  const descEnc = await encryptString(String(project.description || ''), key);
  const members = Array.isArray(project.members) ? project.members : [];
  const removed = Array.isArray(project.removedMemberUserIds) ? project.removedMemberUserIds : [];
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];

  const stmts = [];

  // Single-bind deletes (avoid per-task IN lists that hit D1's 100-variable limit).
  stmts.push(
    db
      .prepare(
        `DELETE FROM tether_task_assignees WHERE task_id IN (
           SELECT id FROM tether_tasks WHERE project_id = ?
         )`
      )
      .bind(projectId)
  );
  stmts.push(
    db
      .prepare(
        `DELETE FROM tether_task_deps WHERE task_id IN (
           SELECT id FROM tether_tasks WHERE project_id = ?
         )`
      )
      .bind(projectId)
  );
  stmts.push(db.prepare('DELETE FROM tether_tasks WHERE project_id = ?').bind(projectId));
  stmts.push(db.prepare('DELETE FROM tether_project_members WHERE project_id = ?').bind(projectId));
  stmts.push(db.prepare('DELETE FROM tether_project_removed WHERE project_id = ?').bind(projectId));
  stmts.push(db.prepare('DELETE FROM tether_user_projects WHERE project_id = ?').bind(projectId));

  stmts.push(
    db
      .prepare(
        `INSERT INTO tether_projects (id, owner_user_id, title, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           owner_user_id = excluded.owner_user_id,
           title = excluded.title,
           description = excluded.description,
           updated_at = excluded.updated_at`
      )
      .bind(projectId, ownerUserId, titleEnc || '', descEnc || '', createdAt, now)
  );

  for (const m of members) {
    if (!m?.userId) continue;
    const uid = String(m.userId);
    stmts.push(
      db
        .prepare(
          `INSERT INTO tether_project_members (project_id, user_id, role, username, email, added_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          projectId,
          uid,
          String(m.role || (uid === ownerUserId ? 'owner' : 'member')),
          m.username != null ? String(m.username) : null,
          m.email != null ? String(m.email) : null,
          Number(m.addedAt) || now
        )
    );
    stmts.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO tether_user_projects (user_id, project_id) VALUES (?, ?)`
        )
        .bind(uid, projectId)
    );
  }

  for (const uid of removed) {
    if (!uid) continue;
    stmts.push(
      db
        .prepare(`INSERT OR IGNORE INTO tether_project_removed (project_id, user_id) VALUES (?, ?)`)
        .bind(projectId, String(uid))
    );
  }

  for (const task of tasks) {
    if (!task?.id) continue;
    const row = await encryptTaskRow(task, key);
    stmts.push(
      db
        .prepare(
          `INSERT INTO tether_tasks (
             id, project_id, owner_user_id, title, definition_of_done, notes, labels_json,
             status, due_date, sort_order, recurrence_json, extra_json, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          row.id,
          projectId,
          null,
          row.title,
          row.definition_of_done,
          row.notes,
          row.labels_json,
          row.status,
          row.due_date,
          row.sort_order,
          row.recurrence_json,
          row.extra_json,
          now
        )
    );
    for (const aid of row.assigneeUserIds) {
      stmts.push(
        db.prepare(`INSERT OR IGNORE INTO tether_task_assignees (task_id, user_id) VALUES (?, ?)`).bind(row.id, aid)
      );
    }
    for (const dep of row.dependsOnTaskIds) {
      stmts.push(
        db
          .prepare(`INSERT OR IGNORE INTO tether_task_deps (task_id, depends_on_task_id) VALUES (?, ?)`)
          .bind(row.id, dep)
      );
    }
  }

  // D1 batches can be large; chunk to keep each batch manageable.
  for (const chunk of chunkArray(stmts, 200)) {
    await db.batch(chunk);
  }
}

export async function d1DeleteProject(env, projectId) {
  if (!hasTetherD1(env) || !projectId) return;
  const db = env.TETHER_DB;
  const pid = String(projectId);
  const stmts = [
    db
      .prepare(
        `DELETE FROM tether_task_assignees WHERE task_id IN (
           SELECT id FROM tether_tasks WHERE project_id = ?
         )`
      )
      .bind(pid),
    db
      .prepare(
        `DELETE FROM tether_task_deps WHERE task_id IN (
           SELECT id FROM tether_tasks WHERE project_id = ?
         )`
      )
      .bind(pid),
    db.prepare('DELETE FROM tether_tasks WHERE project_id = ?').bind(pid),
    db.prepare('DELETE FROM tether_project_members WHERE project_id = ?').bind(pid),
    db.prepare('DELETE FROM tether_project_removed WHERE project_id = ?').bind(pid),
    db.prepare('DELETE FROM tether_user_projects WHERE project_id = ?').bind(pid),
    db.prepare('DELETE FROM tether_projects WHERE id = ?').bind(pid),
  ];
  await db.batch(stmts);
}

async function loadTaskGraph(db, taskRows, keyHex) {
  if (!taskRows.length) return [];
  const ids = taskRows.map((r) => r.id);
  const assigneeRows = await queryByTaskIdIn(
    db,
    'SELECT task_id, user_id FROM tether_task_assignees WHERE task_id',
    ids
  );
  const depRows = await queryByTaskIdIn(
    db,
    'SELECT task_id, depends_on_task_id FROM tether_task_deps WHERE task_id',
    ids
  );
  const assigneesByTask = new Map();
  for (const a of assigneeRows) {
    if (!assigneesByTask.has(a.task_id)) assigneesByTask.set(a.task_id, []);
    assigneesByTask.get(a.task_id).push(a.user_id);
  }
  const depsByTask = new Map();
  for (const d of depRows) {
    if (!depsByTask.has(d.task_id)) depsByTask.set(d.task_id, []);
    depsByTask.get(d.task_id).push(d.depends_on_task_id);
  }
  const out = [];
  for (const row of taskRows) {
    row._assignees = assigneesByTask.get(row.id) || [];
    row._deps = depsByTask.get(row.id) || [];
    out.push(await rowToTask(row, keyHex));
  }
  out.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return out;
}

export async function d1GetProject(env, projectId) {
  if (!hasTetherD1(env) || !projectId) return null;
  const db = env.TETHER_DB;
  const key = getAppDataKey(env);
  const pid = String(projectId);
  const proj = await db
    .prepare(
      `SELECT id, owner_user_id, title, description, created_at, updated_at
       FROM tether_projects WHERE id = ?`
    )
    .bind(pid)
    .first();
  if (!proj) return null;

  const members =
    (
      await db
        .prepare(
          `SELECT user_id, role, username, email, added_at
           FROM tether_project_members WHERE project_id = ?`
        )
        .bind(pid)
        .all()
    ).results || [];
  const removed =
    (
      await db
        .prepare(`SELECT user_id FROM tether_project_removed WHERE project_id = ?`)
        .bind(pid)
        .all()
    ).results || [];
  const taskRows =
    (
      await db
        .prepare(
          `SELECT id, project_id, owner_user_id, title, definition_of_done, notes, labels_json,
                  status, due_date, sort_order, recurrence_json, extra_json, updated_at
           FROM tether_tasks WHERE project_id = ? ORDER BY sort_order ASC`
        )
        .bind(pid)
        .all()
    ).results || [];

  const title = await decryptString(proj.title, key);
  const description = await decryptString(proj.description || '', key);
  const tasks = await loadTaskGraph(db, taskRows, key);

  return {
    id: proj.id,
    title: title || '',
    description: description || '',
    ownerUserId: proj.owner_user_id,
    members: members.map((m) => ({
      userId: m.user_id,
      role: m.role,
      username: m.username || '',
      email: m.email || '',
      addedAt: Number(m.added_at) || 0,
    })),
    removedMemberUserIds: removed.map((r) => r.user_id),
    tasks,
    createdAt: Number(proj.created_at) || 0,
    updatedAt: Number(proj.updated_at) || 0,
  };
}

export async function d1GetProjectListMeta(env, projectId) {
  const project = await d1GetProject(env, projectId);
  if (!project) return null;
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  const members = Array.isArray(project.members) ? project.members : [];
  return {
    id: project.id,
    title: project.title,
    description: project.description || '',
    ownerUserId: project.ownerUserId,
    memberUserIds: members.map((m) => m.userId).filter(Boolean),
    memberCount: members.length,
    taskCount: tasks.length,
    tasksDoneCount: tasks.filter((t) => (t.status || 'todo') === 'done').length,
    updatedAt: project.updatedAt,
  };
}

export async function d1GetUserProjectIds(env, userId) {
  if (!hasTetherD1(env) || !userId) return [];
  const rows =
    (
      await env.TETHER_DB.prepare(
        `SELECT project_id FROM tether_user_projects WHERE user_id = ? ORDER BY project_id`
      )
        .bind(String(userId))
        .all()
    ).results || [];
  return rows.map((r) => r.project_id);
}

export async function d1AddUserProjectId(env, userId, projectId) {
  if (!hasTetherD1(env) || !userId || !projectId) return;
  await env.TETHER_DB.prepare(
    `INSERT OR IGNORE INTO tether_user_projects (user_id, project_id) VALUES (?, ?)`
  )
    .bind(String(userId), String(projectId))
    .run();
}

export async function d1RemoveUserProjectId(env, userId, projectId) {
  if (!hasTetherD1(env) || !userId || !projectId) return;
  await env.TETHER_DB.prepare(
    `DELETE FROM tether_user_projects WHERE user_id = ? AND project_id = ?`
  )
    .bind(String(userId), String(projectId))
    .run();
}

/** Replace inbox tasks for a user (project_id IS NULL). */
export async function d1PutInbox(env, userId, tasks) {
  if (!hasTetherD1(env) || !userId) return;
  const db = env.TETHER_DB;
  const key = getAppDataKey(env);
  const uid = String(userId);
  const list = Array.isArray(tasks) ? tasks : [];

  const stmts = [
    db
      .prepare(
        `DELETE FROM tether_task_assignees WHERE task_id IN (
           SELECT id FROM tether_tasks WHERE owner_user_id = ? AND project_id IS NULL
         )`
      )
      .bind(uid),
    db
      .prepare(
        `DELETE FROM tether_task_deps WHERE task_id IN (
           SELECT id FROM tether_tasks WHERE owner_user_id = ? AND project_id IS NULL
         )`
      )
      .bind(uid),
    db.prepare(`DELETE FROM tether_tasks WHERE owner_user_id = ? AND project_id IS NULL`).bind(uid),
  ];

  const now = Date.now();
  for (let i = 0; i < list.length; i++) {
    const task = list[i];
    if (!task?.id) continue;
    const withOrder = { ...task, sortOrder: task.sortOrder != null ? task.sortOrder : i };
    const row = await encryptTaskRow(withOrder, key);
    stmts.push(
      db
        .prepare(
          `INSERT INTO tether_tasks (
             id, project_id, owner_user_id, title, definition_of_done, notes, labels_json,
             status, due_date, sort_order, recurrence_json, extra_json, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          row.id,
          null,
          uid,
          row.title,
          row.definition_of_done,
          row.notes,
          row.labels_json,
          row.status,
          row.due_date,
          row.sort_order,
          row.recurrence_json,
          row.extra_json,
          now
        )
    );
    for (const dep of row.dependsOnTaskIds) {
      stmts.push(
        db
          .prepare(`INSERT OR IGNORE INTO tether_task_deps (task_id, depends_on_task_id) VALUES (?, ?)`)
          .bind(row.id, dep)
      );
    }
  }
  for (const chunk of chunkArray(stmts, 200)) {
    await db.batch(chunk);
  }
}

export async function d1GetInbox(env, userId) {
  if (!hasTetherD1(env) || !userId) return [];
  const db = env.TETHER_DB;
  const key = getAppDataKey(env);
  const rows =
    (
      await db
        .prepare(
          `SELECT id, project_id, owner_user_id, title, definition_of_done, notes, labels_json,
                  status, due_date, sort_order, recurrence_json, extra_json, updated_at
           FROM tether_tasks
           WHERE owner_user_id = ? AND project_id IS NULL
           ORDER BY sort_order ASC`
        )
        .bind(String(userId))
        .all()
    ).results || [];
  return loadTaskGraph(db, rows, key);
}

export async function d1GetPrefs(env, userId) {
  if (!hasTetherD1(env) || !userId) return { labelColors: {}, settings: {} };
  const row = await env.TETHER_DB.prepare(
    `SELECT label_colors_json, settings_json FROM tether_user_prefs WHERE user_id = ?`
  )
    .bind(String(userId))
    .first();
  return {
    labelColors: safeJsonParse(row?.label_colors_json, {}) || {},
    settings: safeJsonParse(row?.settings_json, {}) || {},
  };
}

export async function d1PutLabelColors(env, userId, labelColors) {
  if (!hasTetherD1(env) || !userId) return;
  const uid = String(userId);
  const existing = await d1GetPrefs(env, uid);
  await env.TETHER_DB.prepare(
    `INSERT INTO tether_user_prefs (user_id, label_colors_json, settings_json, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       label_colors_json = excluded.label_colors_json,
       updated_at = excluded.updated_at`
  )
    .bind(uid, JSON.stringify(labelColors || {}), JSON.stringify(existing.settings || {}), Date.now())
    .run();
}

export async function d1PutSettings(env, userId, settings) {
  if (!hasTetherD1(env) || !userId) return;
  const uid = String(userId);
  const existing = await d1GetPrefs(env, uid);
  await env.TETHER_DB.prepare(
    `INSERT INTO tether_user_prefs (user_id, label_colors_json, settings_json, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       settings_json = excluded.settings_json,
       updated_at = excluded.updated_at`
  )
    .bind(uid, JSON.stringify(existing.labelColors || {}), JSON.stringify(settings || {}), Date.now())
    .run();
}

/**
 * My Tasks via SQL: inbox for user + project tasks where user is assignee.
 * Returns plaintext task objects with projectId / projectTitle attached.
 */
export async function d1GetMyTasks(env, userId) {
  if (!hasTetherD1(env) || !userId) return [];
  const db = env.TETHER_DB;
  const key = getAppDataKey(env);
  const uid = String(userId);

  const inbox = await d1GetInbox(env, uid);
  const tasks = inbox.map((t) => ({
    ...t,
    projectId: null,
    projectTitle: 'None',
  }));

  const assignedRows =
    (
      await db
        .prepare(
          `SELECT t.id, t.project_id, t.owner_user_id, t.title, t.definition_of_done, t.notes, t.labels_json,
                  t.status, t.due_date, t.sort_order, t.recurrence_json, t.extra_json, t.updated_at,
                  p.title AS project_title
           FROM tether_task_assignees a
           JOIN tether_tasks t ON t.id = a.task_id
           JOIN tether_projects p ON p.id = t.project_id
           JOIN tether_user_projects up ON up.project_id = t.project_id AND up.user_id = ?
           WHERE a.user_id = ? AND t.project_id IS NOT NULL`
        )
        .bind(uid, uid)
        .all()
    ).results || [];

  // Need full project task graphs for dependency titles — load per distinct project.
  const projectIds = [...new Set(assignedRows.map((r) => r.project_id).filter(Boolean))];
  const projectCache = new Map();
  for (const pid of projectIds) {
    projectCache.set(pid, await d1GetProject(env, pid));
  }

  for (const pid of projectIds) {
    const project = projectCache.get(pid);
    if (!project) continue;
    const projectTasks = project.tasks || [];
    const byId = new Map(projectTasks.map((t) => [t.id, t]));
    const titleDecrypted = project.title;
    for (const task of projectTasks) {
      if (!(task.assigneeUserIds || []).includes(uid)) continue;
      const depIds = task.dependsOnTaskIds || [];
      const dependsOnTitles = depIds.map((id) => byId.get(id)?.title).filter(Boolean);
      const blockedByIncomplete = depIds
        .map((id) => byId.get(id))
        .filter((dep) => dep && (dep.status || 'todo') !== 'done')
        .map((dep) => dep.title);
      tasks.push({
        ...task,
        projectId: project.id,
        projectTitle: titleDecrypted,
        dependsOnTitles,
        blockedByIncomplete,
      });
    }
  }

  for (const task of tasks) {
    if (task.projectId != null) continue;
    const { dependsOnTitles, blockedByIncomplete } = enrichLocalDeps(task, inbox);
    task.dependsOnTitles = dependsOnTitles;
    task.blockedByIncomplete = blockedByIncomplete;
  }

  tasks.sort((a, b) => {
    const da = a.dueDate || '';
    const db_ = b.dueDate || '';
    if (da && db_ && da !== db_) return da.localeCompare(db_);
    if (da && !db_) return -1;
    if (!da && db_) return 1;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
  return tasks;
}

function enrichLocalDeps(task, allTasks) {
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  const depIds = task.dependsOnTaskIds || [];
  const dependsOnTitles = depIds.map((id) => byId.get(id)?.title).filter(Boolean);
  const blockedByIncomplete = depIds
    .map((id) => byId.get(id))
    .filter((dep) => dep && (dep.status || 'todo') !== 'done')
    .map((dep) => dep.title);
  return { dependsOnTitles, blockedByIncomplete };
}

/** Stable fingerprint for dual-read compare (ignores ephemeral ordering noise). */
export function tetherDocFingerprint(project) {
  if (!project) return 'null';
  const norm = {
    id: project.id,
    title: project.title,
    description: project.description || '',
    ownerUserId: project.ownerUserId,
    members: (project.members || [])
      .map((m) => ({ userId: m.userId, role: m.role }))
      .sort((a, b) => String(a.userId).localeCompare(String(b.userId))),
    removedMemberUserIds: [...(project.removedMemberUserIds || [])].map(String).sort(),
    tasks: (project.tasks || [])
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status || 'todo',
        dueDate: t.dueDate || '',
        sortOrder: t.sortOrder || 0,
        assigneeUserIds: [...(t.assigneeUserIds || [])].map(String).sort(),
        dependsOnTaskIds: [...(t.dependsOnTaskIds || [])].map(String).sort(),
      }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id))),
  };
  return JSON.stringify(norm);
}

export async function d1CountProjects(env) {
  if (!hasTetherD1(env)) return 0;
  const row = await env.TETHER_DB.prepare(`SELECT COUNT(*) AS c FROM tether_projects`).first();
  return Number(row?.c) || 0;
}

export async function d1CountInboxTasksForUser(env, userId) {
  if (!hasTetherD1(env) || !userId) return 0;
  const row = await env.TETHER_DB.prepare(
    `SELECT COUNT(*) AS c FROM tether_tasks WHERE owner_user_id = ? AND project_id IS NULL`
  )
    .bind(String(userId))
    .first();
  return Number(row?.c) || 0;
}

export async function d1CountProjectsForUser(env, userId) {
  if (!hasTetherD1(env) || !userId) return 0;
  const row = await env.TETHER_DB.prepare(
    `SELECT COUNT(*) AS c FROM tether_user_projects WHERE user_id = ?`
  )
    .bind(String(userId))
    .first();
  return Number(row?.c) || 0;
}
