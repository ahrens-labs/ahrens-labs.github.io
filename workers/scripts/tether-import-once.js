/**
 * One-shot Todoist → Tether import against production Durable Objects.
 * Run: cd workers && npx wrangler dev -c wrangler-import.toml --remote
 * Then: node ../scripts/run-tether-import.mjs
 */

import { TetherProject } from '../src/tether.js';

export { TetherProject };

function userAccountStub(env, userId) {
  return env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromName(String(userId)));
}

function tetherProjectStub(env, projectId) {
  return env.TETHER_PROJECT.get(env.TETHER_PROJECT.idFromName(String(projectId)));
}

function newProjectId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function fetchUserProfile(env, userId) {
  const stub = userAccountStub(env, userId);
  const res = await stub.fetch(new Request('http://do/getData', { method: 'GET' }));
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || (!data.username && !data.email)) return null;
  return {
    userId,
    username: String(data.username || data.email || userId),
    email: String(data.email || '').trim().toLowerCase(),
  };
}

async function getTetherProjectIds(env, userId) {
  const stub = userAccountStub(env, userId);
  const res = await stub.fetch(new Request('http://do/getTetherProjectIds', { method: 'GET' }));
  const data = await res.json();
  return Array.isArray(data.projectIds) ? data.projectIds : [];
}

async function addTetherProjectId(env, userId, projectId) {
  const stub = userAccountStub(env, userId);
  await stub.fetch(
    new Request('http://do/addTetherProjectId', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    })
  );
}

async function fetchProject(env, projectId) {
  const stub = tetherProjectStub(env, projectId);
  const res = await stub.fetch(new Request('http://do/get', { method: 'GET' }));
  if (!res.ok) return null;
  return res.json();
}

async function saveProject(env, project) {
  const stub = tetherProjectStub(env, project.id);
  await stub.fetch(
    new Request('http://do/save', {
      method: 'POST',
      body: JSON.stringify(project),
    })
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.searchParams.get('projectId')) {
      const project = await fetchProject(env, url.searchParams.get('projectId'));
      if (!project) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({
        title: project.title,
        taskCount: (project.tasks || []).length,
        sample: (project.tasks || []).slice(0, 5).map((t) => ({
          title: t.title,
          dueDate: t.dueDate,
          recurrence: t.recurrence,
          recurrenceDay: t.recurrenceDay,
          labels: t.labels,
        })),
      });
    }

    if (request.method !== 'POST') {
      return new Response('POST JSON { userId, projectTitle, tasks } to import Todoist tasks.', { status: 405 });
    }

    try {
      const body = await request.json();
      const userId = String(body.userId || '').trim();
      const projectTitle = String(body.projectTitle || 'Inbox').trim();
      const incomingTasks = Array.isArray(body.tasks) ? body.tasks : [];
      if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });
      if (!incomingTasks.length) return Response.json({ error: 'No tasks to import' }, { status: 400 });

      const profile = await fetchUserProfile(env, userId);
      if (!profile) return Response.json({ error: 'User profile not found' }, { status: 404 });

      const projectIds = await getTetherProjectIds(env, userId);
      let project = null;
      for (const pid of projectIds) {
        const p = await fetchProject(env, pid);
        if (p && String(p.title || '').trim().toLowerCase() === projectTitle.toLowerCase()) {
          project = p;
          break;
        }
      }

      const now = Date.now();
      if (!project) {
        const projectId = newProjectId();
        project = {
          id: projectId,
          title: projectTitle,
          description: 'Imported from Todoist Inbox export.',
          ownerUserId: userId,
          members: [
            {
              userId,
              username: profile.username,
              email: profile.email,
              role: 'owner',
              addedAt: now,
            },
          ],
          tasks: [],
          createdAt: now,
          updatedAt: now,
        };
        const stub = tetherProjectStub(env, projectId);
        await stub.fetch(
          new Request('http://do/create', {
            method: 'POST',
            body: JSON.stringify(project),
          })
        );
        await addTetherProjectId(env, userId, projectId);
      }

      const existingTitles = new Set((project.tasks || []).map((t) => String(t.title || '').trim().toLowerCase()));
      const startOrder = (project.tasks || []).length;
      let added = 0;
      let skipped = 0;

      for (const task of incomingTasks) {
        const key = String(task.title || '').trim().toLowerCase();
        if (!key || existingTitles.has(key)) {
          skipped++;
          continue;
        }
        existingTitles.add(key);
        project.tasks.push({ ...task, sortOrder: startOrder + added });
        added++;
      }

      project.updatedAt = Date.now();
      await saveProject(env, project);

      return Response.json({
        success: true,
        projectId: project.id,
        projectTitle: project.title,
        added,
        skipped,
        totalTasks: project.tasks.length,
      });
    } catch (err) {
      return Response.json({ error: err.message || 'Import failed' }, { status: 500 });
    }
  },
};
