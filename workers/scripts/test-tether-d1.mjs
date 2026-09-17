/**
 * In-memory D1 mock + round-trip tests for tether-d1.js
 * Run: node workers/scripts/test-tether-d1.mjs
 */
import { webcrypto } from 'node:crypto';
import assert from 'node:assert/strict';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.btoa) {
  globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
}
if (!globalThis.atob) {
  globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
}

const {
  d1PutProject,
  d1GetProject,
  d1DeleteProject,
  d1PutInbox,
  d1GetInbox,
  d1GetMyTasks,
  d1GetUserProjectIds,
  d1PutLabelColors,
  d1PutSettings,
  d1GetPrefs,
  tetherDocFingerprint,
  tetherD1WriteEnabled,
  tetherD1PrimaryEnabled,
} = await import('../src/tether-d1.js');

const KEY = 'b'.repeat(64);

/** Minimal D1-like store for unit tests (supports the SQL we emit). */
function createMemoryDb() {
  const tables = {
    tether_projects: new Map(),
    tether_project_members: new Map(),
    tether_project_removed: new Map(),
    tether_user_projects: new Map(),
    tether_tasks: new Map(),
    tether_task_assignees: new Map(),
    tether_task_deps: new Map(),
    tether_user_prefs: new Map(),
  };

  function keyMembers(projectId, userId) {
    return `${projectId}|${userId}`;
  }

  class Stmt {
    constructor(sql, binds = []) {
      this.sql = sql;
      this.binds = binds;
    }
    bind(...args) {
      return new Stmt(this.sql, args);
    }
    async first() {
      const all = await this.all();
      return all.results[0] || null;
    }
    async run() {
      await this.all();
      return { success: true };
    }
    async all() {
      const sql = this.sql.replace(/\s+/g, ' ').trim();
      const b = this.binds;

      if (sql.startsWith('SELECT id FROM tether_tasks WHERE project_id')) {
        const results = [...tables.tether_tasks.values()]
          .filter((t) => t.project_id === b[0])
          .map((t) => ({ id: t.id }));
        return { results };
      }
      if (sql.startsWith('SELECT id FROM tether_tasks WHERE owner_user_id') && sql.includes('project_id IS NULL')) {
        const results = [...tables.tether_tasks.values()]
          .filter((t) => t.owner_user_id === b[0] && t.project_id == null)
          .map((t) => ({ id: t.id }));
        return { results };
      }
      if (sql.startsWith('DELETE FROM tether_task_assignees WHERE task_id IN')) {
        let taskIds;
        if (sql.includes('project_id = ?') && !sql.includes('owner_user_id')) {
          taskIds = new Set([...tables.tether_tasks.values()].filter((t) => t.project_id === b[0]).map((t) => t.id));
        } else if (sql.includes('owner_user_id = ?')) {
          taskIds = new Set(
            [...tables.tether_tasks.values()]
              .filter((t) => t.owner_user_id === b[0] && t.project_id == null)
              .map((t) => t.id)
          );
        } else {
          taskIds = new Set(b);
        }
        for (const k of [...tables.tether_task_assignees.keys()]) {
          const tid = k.split('|')[0];
          if (taskIds.has(tid)) tables.tether_task_assignees.delete(k);
        }
        return { results: [] };
      }
      if (sql.startsWith('DELETE FROM tether_task_assignees WHERE task_id')) {
        for (const k of [...tables.tether_task_assignees.keys()]) {
          if (k.startsWith(`${b[0]}|`)) tables.tether_task_assignees.delete(k);
        }
        return { results: [] };
      }
      if (sql.startsWith('DELETE FROM tether_task_deps WHERE task_id IN')) {
        let taskIds;
        if (sql.includes('project_id = ?') && !sql.includes('owner_user_id')) {
          taskIds = new Set([...tables.tether_tasks.values()].filter((t) => t.project_id === b[0]).map((t) => t.id));
        } else if (sql.includes('owner_user_id = ?')) {
          taskIds = new Set(
            [...tables.tether_tasks.values()]
              .filter((t) => t.owner_user_id === b[0] && t.project_id == null)
              .map((t) => t.id)
          );
        } else {
          taskIds = new Set(b);
        }
        for (const k of [...tables.tether_task_deps.keys()]) {
          const tid = k.split('|')[0];
          if (taskIds.has(tid)) tables.tether_task_deps.delete(k);
        }
        return { results: [] };
      }
      if (sql.startsWith('DELETE FROM tether_task_deps WHERE task_id')) {
        for (const k of [...tables.tether_task_deps.keys()]) {
          if (k.startsWith(`${b[0]}|`)) tables.tether_task_deps.delete(k);
        }
        return { results: [] };
      }
      if (sql.startsWith('DELETE FROM tether_tasks WHERE project_id')) {
        for (const [id, t] of [...tables.tether_tasks.entries()]) {
          if (t.project_id === b[0]) tables.tether_tasks.delete(id);
        }
        return { results: [] };
      }
      if (sql.startsWith('DELETE FROM tether_tasks WHERE owner_user_id') && sql.includes('project_id IS NULL')) {
        for (const [id, t] of [...tables.tether_tasks.entries()]) {
          if (t.owner_user_id === b[0] && t.project_id == null) tables.tether_tasks.delete(id);
        }
        return { results: [] };
      }
      if (sql.startsWith('DELETE FROM tether_project_members')) {
        for (const k of [...tables.tether_project_members.keys()]) {
          if (k.startsWith(`${b[0]}|`)) tables.tether_project_members.delete(k);
        }
        return { results: [] };
      }
      if (sql.startsWith('DELETE FROM tether_project_removed')) {
        for (const k of [...tables.tether_project_removed.keys()]) {
          if (k.startsWith(`${b[0]}|`)) tables.tether_project_removed.delete(k);
        }
        return { results: [] };
      }
      if (sql.startsWith('DELETE FROM tether_user_projects WHERE project_id')) {
        for (const k of [...tables.tether_user_projects.keys()]) {
          if (k.endsWith(`|${b[0]}`)) tables.tether_user_projects.delete(k);
        }
        return { results: [] };
      }
      if (sql.startsWith('DELETE FROM tether_user_projects WHERE user_id')) {
        tables.tether_user_projects.delete(`${b[0]}|${b[1]}`);
        return { results: [] };
      }
      if (sql.startsWith('DELETE FROM tether_projects WHERE id')) {
        tables.tether_projects.delete(b[0]);
        return { results: [] };
      }
      if (sql.startsWith('INSERT INTO tether_projects')) {
        const row = {
          id: b[0],
          owner_user_id: b[1],
          title: b[2],
          description: b[3],
          created_at: b[4],
          updated_at: b[5],
        };
        tables.tether_projects.set(row.id, row);
        return { results: [] };
      }
      if (sql.startsWith('INSERT INTO tether_project_members')) {
        const row = {
          project_id: b[0],
          user_id: b[1],
          role: b[2],
          username: b[3],
          email: b[4],
          added_at: b[5],
        };
        tables.tether_project_members.set(keyMembers(row.project_id, row.user_id), row);
        return { results: [] };
      }
      if (sql.startsWith('INSERT OR IGNORE INTO tether_user_projects')) {
        tables.tether_user_projects.set(`${b[0]}|${b[1]}`, { user_id: b[0], project_id: b[1] });
        return { results: [] };
      }
      if (sql.startsWith('INSERT OR IGNORE INTO tether_project_removed')) {
        tables.tether_project_removed.set(keyMembers(b[0], b[1]), { project_id: b[0], user_id: b[1] });
        return { results: [] };
      }
      if (sql.startsWith('INSERT INTO tether_tasks')) {
        const row = {
          id: b[0],
          project_id: b[1],
          owner_user_id: b[2],
          title: b[3],
          definition_of_done: b[4],
          notes: b[5],
          labels_json: b[6],
          status: b[7],
          due_date: b[8],
          sort_order: b[9],
          recurrence_json: b[10],
          extra_json: b[11],
          updated_at: b[12],
        };
        tables.tether_tasks.set(row.id, row);
        return { results: [] };
      }
      if (sql.startsWith('INSERT OR IGNORE INTO tether_task_assignees')) {
        tables.tether_task_assignees.set(`${b[0]}|${b[1]}`, { task_id: b[0], user_id: b[1] });
        return { results: [] };
      }
      if (sql.startsWith('INSERT OR IGNORE INTO tether_task_deps')) {
        tables.tether_task_deps.set(`${b[0]}|${b[1]}`, { task_id: b[0], depends_on_task_id: b[1] });
        return { results: [] };
      }
      if (sql.startsWith('SELECT id, owner_user_id, title, description, created_at, updated_at FROM tether_projects')) {
        const row = tables.tether_projects.get(b[0]);
        return { results: row ? [row] : [] };
      }
      if (sql.startsWith('SELECT user_id, role, username, email, added_at FROM tether_project_members')) {
        const results = [...tables.tether_project_members.values()].filter((m) => m.project_id === b[0]);
        return { results };
      }
      if (sql.startsWith('SELECT user_id FROM tether_project_removed')) {
        const results = [...tables.tether_project_removed.values()]
          .filter((m) => m.project_id === b[0])
          .map((m) => ({ user_id: m.user_id }));
        return { results };
      }
      if (sql.startsWith('SELECT id, project_id, owner_user_id, title') && sql.includes('WHERE project_id = ?')) {
        const results = [...tables.tether_tasks.values()]
          .filter((t) => t.project_id === b[0])
          .sort((a, c) => (a.sort_order || 0) - (c.sort_order || 0));
        return { results };
      }
      if (sql.startsWith('SELECT id, project_id, owner_user_id, title') && sql.includes('project_id IS NULL')) {
        const results = [...tables.tether_tasks.values()]
          .filter((t) => t.owner_user_id === b[0] && t.project_id == null)
          .sort((a, c) => (a.sort_order || 0) - (c.sort_order || 0));
        return { results };
      }
      if (sql.startsWith('SELECT task_id, user_id FROM tether_task_assignees WHERE task_id IN')) {
        const ids = new Set(b);
        const results = [...tables.tether_task_assignees.values()].filter((a) => ids.has(a.task_id));
        return { results };
      }
      if (sql.startsWith('SELECT task_id, depends_on_task_id FROM tether_task_deps WHERE task_id IN')) {
        const ids = new Set(b);
        const results = [...tables.tether_task_deps.values()].filter((a) => ids.has(a.task_id));
        return { results };
      }
      if (sql.startsWith('SELECT project_id FROM tether_user_projects WHERE user_id')) {
        const results = [...tables.tether_user_projects.values()]
          .filter((r) => r.user_id === b[0])
          .map((r) => ({ project_id: r.project_id }))
          .sort((a, c) => String(a.project_id).localeCompare(String(c.project_id)));
        return { results };
      }
      if (sql.startsWith('SELECT label_colors_json, settings_json FROM tether_user_prefs')) {
        const row = tables.tether_user_prefs.get(b[0]);
        return { results: row ? [row] : [] };
      }
      if (sql.startsWith('INSERT INTO tether_user_prefs')) {
        const existing = tables.tether_user_prefs.get(b[0]) || {};
        tables.tether_user_prefs.set(b[0], {
          user_id: b[0],
          label_colors_json: b[1] != null ? b[1] : existing.label_colors_json,
          settings_json: b[2] != null ? b[2] : existing.settings_json,
          updated_at: b[3],
        });
        // ON CONFLICT updates — detect which field from SQL
        if (sql.includes('label_colors_json = excluded')) {
          tables.tether_user_prefs.set(b[0], {
            user_id: b[0],
            label_colors_json: b[1],
            settings_json: b[2],
            updated_at: b[3],
          });
        }
        return { results: [] };
      }
      if (sql.startsWith('SELECT t.id, t.project_id') && sql.includes('tether_task_assignees')) {
        const uid = b[0];
        const results = [];
        for (const a of tables.tether_task_assignees.values()) {
          if (a.user_id !== uid) continue;
          const t = tables.tether_tasks.get(a.task_id);
          if (!t || !t.project_id) continue;
          const up = tables.tether_user_projects.get(`${uid}|${t.project_id}`);
          if (!up) continue;
          const p = tables.tether_projects.get(t.project_id);
          results.push({ ...t, project_title: p?.title });
        }
        return { results };
      }
      if (sql.startsWith('SELECT COUNT(*)')) {
        if (sql.includes('tether_projects') && !sql.includes('user')) {
          return { results: [{ c: tables.tether_projects.size }] };
        }
      }
      throw new Error('Unhandled SQL in mock: ' + sql);
    }
  }

  return {
    prepare(sql) {
      return new Stmt(sql);
    },
    async batch(stmts) {
      for (const s of stmts) await s.run();
    },
  };
}

function sampleProject(owner = 'user_1') {
  return {
    id: 'proj-1',
    title: 'Launch plan',
    description: 'Ship D1',
    ownerUserId: owner,
    members: [
      { userId: owner, username: 'owner', email: 'o@ex.com', role: 'owner', addedAt: 1 },
      { userId: 'user_2', username: 'mate', email: 'm@ex.com', role: 'member', addedAt: 2 },
    ],
    removedMemberUserIds: ['user_x'],
    tasks: [
      {
        id: 'task-a',
        title: 'Schema',
        definitionOfDone: 'migrated',
        notes: 'secret',
        labels: ['infra'],
        status: 'todo',
        dueDate: '2026-09-20',
        sortOrder: 0,
        assigneeUserIds: [owner],
        dependsOnTaskIds: [],
        recurrence: 'weekly',
        recurrenceInterval: 1,
        recurrenceDay: 1,
      },
      {
        id: 'task-b',
        title: 'Backfill',
        status: 'done',
        sortOrder: 1,
        assigneeUserIds: ['user_2', owner],
        dependsOnTaskIds: ['task-a'],
      },
    ],
    createdAt: 100,
    updatedAt: 200,
  };
}

async function testProjectRoundTrip() {
  const env = { TETHER_DB: createMemoryDb(), APP_DATA_ENCRYPTION_KEY: KEY };
  const project = sampleProject();
  await d1PutProject(env, project);
  const loaded = await d1GetProject(env, project.id);
  assert.equal(loaded.title, 'Launch plan');
  assert.equal(loaded.description, 'Ship D1');
  assert.equal(loaded.tasks.length, 2);
  assert.equal(loaded.tasks[0].notes, 'secret');
  assert.deepEqual(loaded.tasks[0].labels, ['infra']);
  assert.equal(loaded.tasks[0].recurrence, 'weekly');
  assert.equal(loaded.tasks[0].recurrenceInterval, 1);
  assert.equal(loaded.tasks[0].recurrenceDay, 1);
  assert.deepEqual(loaded.tasks[1].dependsOnTaskIds, ['task-a']);
  assert.deepEqual(loaded.removedMemberUserIds, ['user_x']);
  assert.equal(tetherDocFingerprint(loaded), tetherDocFingerprint(project));
  const ids = await d1GetUserProjectIds(env, 'user_1');
  assert.deepEqual(ids, ['proj-1']);
}

async function testInboxAndMyTasks() {
  const env = { TETHER_DB: createMemoryDb(), APP_DATA_ENCRYPTION_KEY: KEY };
  await d1PutProject(env, sampleProject());
  await d1PutInbox(env, 'user_1', [
    { id: 'in-1', title: 'Buy milk', status: 'todo', sortOrder: 0, dependsOnTaskIds: [] },
  ]);
  const inbox = await d1GetInbox(env, 'user_1');
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].title, 'Buy milk');
  const mine = await d1GetMyTasks(env, 'user_1');
  assert.ok(mine.some((t) => t.id === 'in-1' && t.projectTitle === 'None'));
  assert.ok(mine.some((t) => t.id === 'task-a'));
  assert.ok(mine.some((t) => t.id === 'task-b'));
}

async function testDeleteAndPrefs() {
  const env = { TETHER_DB: createMemoryDb(), APP_DATA_ENCRYPTION_KEY: KEY };
  await d1PutProject(env, sampleProject());
  await d1DeleteProject(env, 'proj-1');
  assert.equal(await d1GetProject(env, 'proj-1'), null);
  await d1PutLabelColors(env, 'user_1', { work: 3 });
  await d1PutSettings(env, 'user_1', { myTasksShowAllDays: true });
  const prefs = await d1GetPrefs(env, 'user_1');
  assert.equal(prefs.labelColors.work, 3);
  assert.equal(prefs.settings.myTasksShowAllDays, true);
}

async function testFlags() {
  assert.equal(tetherD1WriteEnabled({ TETHER_DB: {} }), true);
  assert.equal(tetherD1WriteEnabled({ TETHER_DB: {}, TETHER_D1_WRITE: '0' }), false);
  assert.equal(tetherD1PrimaryEnabled({ TETHER_DB: {}, TETHER_D1_PRIMARY: '1' }), true);
}


async function testLargeProjectChunking() {
  const env = { TETHER_DB: createMemoryDb(), APP_DATA_ENCRYPTION_KEY: KEY };
  const tasks = [];
  for (let i = 0; i < 150; i++) {
    tasks.push({
      id: `task-${i}`,
      title: `T${i}`,
      status: 'todo',
      sortOrder: i,
      assigneeUserIds: i % 2 === 0 ? ['user_1'] : [],
      dependsOnTaskIds: i > 0 ? [`task-${i - 1}`] : [],
    });
  }
  const project = {
    id: 'proj-big',
    title: 'Big',
    description: '',
    ownerUserId: 'user_1',
    members: [{ userId: 'user_1', role: 'owner', addedAt: 1 }],
    tasks,
    createdAt: 1,
    updatedAt: 2,
  };
  await d1PutProject(env, project);
  const loaded = await d1GetProject(env, 'proj-big');
  assert.equal(loaded.tasks.length, 150);
  assert.equal(loaded.tasks[10].title, 'T10');
  assert.deepEqual(loaded.tasks[10].dependsOnTaskIds, ['task-9']);
}

await testProjectRoundTrip();
await testInboxAndMyTasks();
await testDeleteAndPrefs();
await testFlags();
await testLargeProjectChunking();
console.log('tether-d1 tests passed');

