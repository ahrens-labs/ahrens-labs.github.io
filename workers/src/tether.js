// Tether — shared project & task management (Durable Object + API handlers)

function parseBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const m = authHeader.match(/^Bearer\s+(\S+)/i);
  return m ? m[1] : null;
}

function normalizeEmail(email) {
  if (email == null || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function normalizeUsername(username) {
  if (username == null || typeof username !== 'string') return '';
  return username.trim().toLowerCase();
}

function generateUserId(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `user_${Math.abs(hash)}`;
}

function jsonResponse(body, corsHeaders, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Short TTLs for authenticated GETs; keys are partitioned by userId. */
const TETHER_CACHE_TTL = {
  syncVersion: 5,
  list: 15,
  project: 15,
  prefs: 60,
};

const TETHER_USER_CACHE_PATHS = [
  '/api/tether/projects',
  '/api/tether/sync-version',
  '/api/tether/my-tasks',
  '/api/tether/inbox',
  '/api/tether/label-colors',
  '/api/tether/settings',
];

function tetherCacheRequest(userId, path, query = '') {
  const q = String(query || '').replace(/^\?/, '');
  const suffix = q ? `?${q}` : '';
  return new Request(`https://tether-cache.internal/v1/${encodeURIComponent(String(userId))}${path}${suffix}`, {
    method: 'GET',
  });
}

function scheduleTetherCacheWork(ctx, promise) {
  if (!promise) return;
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(promise.catch(() => {}));
    return;
  }
  promise.catch(() => {});
}

async function invalidateTetherUserCache(userId, { projectIds = [] } = {}) {
  if (!userId || typeof caches === 'undefined') return;
  try {
    const cache = caches.default;
    const deletes = TETHER_USER_CACHE_PATHS.map((path) => cache.delete(tetherCacheRequest(userId, path)));
    for (const projectId of projectIds) {
      if (!projectId) continue;
      deletes.push(
        cache.delete(tetherCacheRequest(userId, '/api/tether/project', `projectId=${encodeURIComponent(projectId)}`))
      );
    }
    await Promise.all(deletes);
  } catch {
    /* cache is best-effort */
  }
}

async function invalidateTetherUsersCache(userIds, opts) {
  const ids = userIds instanceof Set ? [...userIds] : Array.isArray(userIds) ? userIds : [];
  await Promise.all(ids.filter(Boolean).map((uid) => invalidateTetherUserCache(uid, opts)));
}

/**
 * Serve an authenticated Tether GET from the Workers Cache API when fresh.
 * Cache keys include userId so responses are never shared across accounts.
 */
async function cachedTetherGet(ctx, userId, path, query, corsHeaders, load, maxAgeSec) {
  const key = tetherCacheRequest(userId, path, query);
  try {
    if (typeof caches !== 'undefined') {
      const hit = await caches.default.match(key);
      if (hit) {
        const headers = new Headers(hit.headers);
        Object.entries(corsHeaders || {}).forEach(([k, v]) => headers.set(k, v));
        headers.set('Content-Type', 'application/json');
        headers.set('Cache-Control', 'private, no-store');
        headers.set('X-Tether-Cache', 'HIT');
        return new Response(hit.body, { status: hit.status, headers });
      }
    }
  } catch {
    /* miss and continue */
  }

  const body = await load();
  const response = jsonResponse(body, {
    ...corsHeaders,
    'Cache-Control': 'private, no-store',
    'X-Tether-Cache': 'MISS',
  });

  try {
    if (typeof caches !== 'undefined') {
      const cacheHeaders = new Headers(response.headers);
      cacheHeaders.set('Cache-Control', `public, max-age=${Math.max(1, Number(maxAgeSec) || 15)}`);
      cacheHeaders.delete('Set-Cookie');
      const stored = new Response(response.clone().body, {
        status: response.status,
        headers: cacheHeaders,
      });
      scheduleTetherCacheWork(ctx, caches.default.put(key, stored));
    }
  } catch {
    /* ignore cache put failures */
  }

  return response;
}

function tetherProjectStub(env, projectId) {
  if (!env.TETHER_PROJECT || !projectId) return null;
  return env.TETHER_PROJECT.get(env.TETHER_PROJECT.idFromName(String(projectId)));
}

function tetherSyncStub(env, userId) {
  if (!env.TETHER_SYNC || !userId) return null;
  return env.TETHER_SYNC.get(env.TETHER_SYNC.idFromName(String(userId)));
}

function readSyncClientId(request, body) {
  const fromHeader = String(request.headers.get('X-Tether-Sync-Client') || '').trim();
  if (fromHeader) return fromHeader.slice(0, 64);
  if (body && typeof body.syncClientId === 'string') {
    const id = body.syncClientId.trim();
    if (id) return id.slice(0, 64);
  }
  return null;
}

function projectMemberIds(project) {
  const ids = new Set();
  if (project?.ownerUserId) ids.add(project.ownerUserId);
  for (const member of project?.members || []) {
    if (member?.userId) ids.add(member.userId);
  }
  return ids;
}

async function notifyTetherSync(env, userId, payload) {
  const stub = tetherSyncStub(env, userId);
  if (!stub) return;
  try {
    await stub.fetch(
      new Request('http://do/notify', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
  } catch {
    /* sync is best-effort */
  }
}

async function publishInboxSync(env, userId, sourceClientId, ctx) {
  scheduleTetherCacheWork(ctx, invalidateTetherUserCache(userId));
  await notifyTetherSync(env, userId, {
    type: 'inbox',
    ts: Date.now(),
    sourceClientId,
  });
}

async function publishProjectSync(env, project, sourceClientId, ctx) {
  const memberIds = [...projectMemberIds(project)];
  const projectId = project?.id || null;
  scheduleTetherCacheWork(
    ctx,
    invalidateTetherUsersCache(memberIds, { projectIds: projectId ? [projectId] : [] })
  );
  const payload = {
    type: 'project',
    projectId,
    ts: Date.now(),
    sourceClientId,
  };
  await Promise.all(memberIds.map((uid) => notifyTetherSync(env, uid, payload)));
}

async function publishProjectsListSync(env, userIds, sourceClientId, ctx) {
  const ids = userIds instanceof Set ? userIds : new Set(userIds || []);
  scheduleTetherCacheWork(ctx, invalidateTetherUsersCache(ids));
  const payload = {
    type: 'projects',
    ts: Date.now(),
    sourceClientId,
  };
  await Promise.all([...ids].filter(Boolean).map((uid) => notifyTetherSync(env, uid, payload)));
}

function userAccountStub(env, userId) {
  if (!env.USER_ACCOUNT || !userId) return null;
  return env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromName(String(userId)));
}

async function sessionUserId(env, sessionId) {
  if (!sessionId) return null;
  const session = env.SESSION.get(env.SESSION.idFromName(sessionId));
  const res = await session.fetch(new Request('http://do/getUserId', { method: 'GET' }));
  const data = await res.json();
  return data.userId || null;
}

async function fetchUserProfile(env, userId) {
  const stub = userAccountStub(env, userId);
  if (!stub) return null;
  try {
    const res = await stub.fetch(new Request('http://do/getData', { method: 'GET' }));
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || (!data.username && !data.email)) return null;
    return {
      userId,
      username: String(data.username || data.email || userId),
      email: normalizeEmail(data.email || ''),
    };
  } catch {
    return null;
  }
}

async function getTetherProjectIds(env, userId) {
  const stub = userAccountStub(env, userId);
  if (!stub) return [];
  const res = await stub.fetch(new Request('http://do/getTetherProjectIds', { method: 'GET' }));
  const data = await res.json();
  return Array.isArray(data.projectIds) ? data.projectIds : [];
}

async function addTetherProjectId(env, userId, projectId) {
  const stub = userAccountStub(env, userId);
  if (!stub) return;
  await stub.fetch(
    new Request('http://do/addTetherProjectId', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    })
  );
}

async function removeTetherProjectId(env, userId, projectId) {
  const stub = userAccountStub(env, userId);
  if (!stub) return;
  await stub.fetch(
    new Request('http://do/removeTetherProjectId', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    })
  );
}

async function getInboxTasks(env, userId) {
  const stub = userAccountStub(env, userId);
  if (!stub) return [];
  const res = await stub.fetch(new Request('http://do/getTetherInbox', { method: 'GET' }));
  if (!res.ok) return [];
  try {
    const data = await res.json();
    return Array.isArray(data.tasks) ? data.tasks : [];
  } catch {
    return [];
  }
}

async function saveInboxTasks(env, userId, tasks) {
  const stub = userAccountStub(env, userId);
  if (!stub) throw new Error('Account not found');
  const res = await stub.fetch(
    new Request('http://do/saveTetherInbox', {
      method: 'PUT',
      body: JSON.stringify({ tasks }),
    })
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save inbox');
  return Array.isArray(data.tasks) ? data.tasks : tasks;
}

async function getLabelColors(env, userId) {
  const stub = userAccountStub(env, userId);
  if (!stub) return {};
  const res = await stub.fetch(new Request('http://do/getTetherLabelColors', { method: 'GET' }));
  if (!res.ok) return {};
  try {
    const data = await res.json();
    return data.labelColors && typeof data.labelColors === 'object' ? data.labelColors : {};
  } catch {
    return {};
  }
}

async function saveLabelColors(env, userId, labelColors) {
  const stub = userAccountStub(env, userId);
  if (!stub) throw new Error('Account not found');
  const res = await stub.fetch(
    new Request('http://do/saveTetherLabelColors', {
      method: 'PUT',
      body: JSON.stringify({ labelColors }),
    })
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save label colors');
  return data.labelColors && typeof data.labelColors === 'object' ? data.labelColors : labelColors;
}

const DEFAULT_TETHER_SETTINGS = { myTasksShowAllDays: false };

function normalizeTetherSettings(raw) {
  const settings = { ...DEFAULT_TETHER_SETTINGS };
  if (raw && typeof raw === 'object' && typeof raw.myTasksShowAllDays === 'boolean') {
    settings.myTasksShowAllDays = raw.myTasksShowAllDays;
  }
  return settings;
}

async function getTetherSettings(env, userId) {
  const stub = userAccountStub(env, userId);
  if (!stub) return { ...DEFAULT_TETHER_SETTINGS };
  const res = await stub.fetch(new Request('http://do/getTetherSettings', { method: 'GET' }));
  if (!res.ok) return { ...DEFAULT_TETHER_SETTINGS };
  try {
    const data = await res.json();
    return normalizeTetherSettings(data.settings);
  } catch {
    return { ...DEFAULT_TETHER_SETTINGS };
  }
}

async function saveTetherSettings(env, userId, settings) {
  const stub = userAccountStub(env, userId);
  if (!stub) throw new Error('Account not found');
  const normalized = normalizeTetherSettings(settings);
  const res = await stub.fetch(
    new Request('http://do/saveTetherSettings', {
      method: 'PUT',
      body: JSON.stringify({ settings: normalized }),
    })
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save settings');
  return normalizeTetherSettings(data.settings);
}

function enrichTaskWithDeps(task, allTasks) {
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  const depIds = task.dependsOnTaskIds || [];
  const dependsOnTitles = depIds.map((id) => byId.get(id)?.title).filter(Boolean);
  const blockedByIncomplete = depIds
    .map((id) => byId.get(id))
    .filter((dep) => dep && (dep.status || 'todo') !== 'done')
    .map((dep) => dep.title);
  return { dependsOnTitles, blockedByIncomplete };
}

async function fetchProject(env, projectId) {
  const stub = tetherProjectStub(env, projectId);
  if (!stub) return null;
  const res = await stub.fetch(new Request('http://do/get', { method: 'GET' }));
  if (!res.ok) return null;
  return res.json();
}

function userCanAccessProject(project, userId) {
  if (!project || !userId) return false;
  if (project.ownerUserId === userId) return true;
  if (Array.isArray(project.memberUserIds)) {
    return project.memberUserIds.includes(userId);
  }
  return Array.isArray(project.members) && project.members.some((m) => m.userId === userId);
}

function userIsOwner(project, userId) {
  return project && project.ownerUserId === userId;
}

function userWasRemovedFromProject(project, userId) {
  return (
    !!userId &&
    Array.isArray(project?.removedMemberUserIds) &&
    project.removedMemberUserIds.includes(userId)
  );
}

function rememberRemovedMember(project, userId) {
  const removed = Array.isArray(project.removedMemberUserIds)
    ? [...project.removedMemberUserIds]
    : [];
  if (userId && !removed.includes(userId)) removed.push(userId);
  return removed;
}

function clearRemovedMember(project, userId) {
  if (!userId || !Array.isArray(project?.removedMemberUserIds)) return project.removedMemberUserIds;
  return project.removedMemberUserIds.filter((id) => id !== userId);
}

function projectDescription(project) {
  if (!project) return '';
  if (project.description != null && String(project.description).trim()) {
    return String(project.description).trim();
  }
  if (project.definitionOfDone != null && String(project.definitionOfDone).trim()) {
    return String(project.definitionOfDone).trim();
  }
  return '';
}

function projectListItem(project, userId) {
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  const taskCount = project.taskCount != null ? project.taskCount : tasks.length;
  const tasksDoneCount =
    project.tasksDoneCount != null
      ? project.tasksDoneCount
      : tasks.filter((t) => (t.status || 'todo') === 'done').length;
  return {
    id: project.id,
    title: project.title,
    description: project.description != null ? project.description : projectDescription(project),
    ownerUserId: project.ownerUserId,
    isOwner: userIsOwner(project, userId),
    memberCount: project.memberCount != null ? project.memberCount : (Array.isArray(project.members) ? project.members.length : 0),
    taskCount,
    tasksDoneCount,
    updatedAt: project.updatedAt,
  };
}

function buildListMeta(project) {
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  const members = Array.isArray(project.members) ? project.members : [];
  return {
    id: project.id,
    title: project.title,
    description: projectDescription(project),
    ownerUserId: project.ownerUserId,
    memberUserIds: members.map((m) => m.userId).filter(Boolean),
    memberCount: members.length,
    taskCount: tasks.length,
    tasksDoneCount: tasks.filter((t) => (t.status || 'todo') === 'done').length,
    updatedAt: project.updatedAt,
  };
}

async function fetchProjectListMeta(env, projectId) {
  const stub = tetherProjectStub(env, projectId);
  if (!stub) return null;
  const res = await stub.fetch(new Request('http://do/get-list-meta', { method: 'GET' }));
  if (!res.ok) return null;
  return res.json();
}

async function buildSyncFingerprint(env, userId) {
  const projectIds = await getTetherProjectIds(env, userId);
  const metas = await Promise.all(projectIds.map((pid) => fetchProjectListMeta(env, pid)));
  const inbox = await getInboxTasks(env, userId);
  const projectParts = metas
    .filter(Boolean)
    .filter((m) => userCanAccessProject(m, userId))
    .map((m) => `${m.id}:${m.updatedAt || 0}:${m.taskCount || 0}:${m.tasksDoneCount || 0}`)
    .sort();
  const inboxParts = inbox
    .map((t) => `${t.id}:${t.status || 'todo'}:${String(t.title || '').slice(0, 48)}:${t.dueDate || ''}`)
    .sort();
  return `${projectParts.join('|')}::inbox::${inboxParts.join(';')}`;
}

async function fetchAccessibleProjectSummaries(env, projectIds, userId) {
  const results = await Promise.all(
    projectIds.map(async (pid) => {
      const meta = await fetchProjectListMeta(env, pid);
      if (!meta || !userCanAccessProject(meta, userId)) return null;
      return projectListItem(meta, userId);
    })
  );
  return results.filter(Boolean);
}

async function fetchAccessibleProjects(env, projectIds, userId) {
  const results = await Promise.all(
    projectIds.map(async (pid) => {
      const project = await fetchProject(env, pid);
      if (!project || !userCanAccessProject(project, userId)) return null;
      return project;
    })
  );
  return results.filter(Boolean);
}

/** Reject saves where a done task still has incomplete dependencies. */
function validateTaskDependencyCompletion(tasks) {
  if (!Array.isArray(tasks)) return null;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const task of tasks) {
    if ((task.status || 'todo') !== 'done') continue;
    for (const depId of task.dependsOnTaskIds || []) {
      const dep = byId.get(depId);
      if (dep && (dep.status || 'todo') !== 'done') {
        const taskTitle = String(task.title || 'Task').trim() || 'Task';
        const depTitle = String(dep.title || 'another task').trim() || 'another task';
        return {
          error: `Cannot complete "${taskTitle}" before "${depTitle}" is done`,
          status: 400,
        };
      }
    }
  }
  return null;
}

async function addMemberToProject(env, project, profile) {
  if (!project || !profile?.userId) return project;
  const members = Array.isArray(project.members) ? [...project.members] : [];
  if (members.some((m) => m.userId === profile.userId)) return project;

  members.push({
    userId: profile.userId,
    username: profile.username,
    email: profile.email,
    role: 'member',
    addedAt: Date.now(),
  });

  const updated = { ...project, members, updatedAt: Date.now() };
  const stub = tetherProjectStub(env, project.id);
  await stub.fetch(
    new Request('http://do/save', {
      method: 'POST',
      body: JSON.stringify(updated),
    })
  );
  await addTetherProjectId(env, profile.userId, project.id);
  return updated;
}

async function resolveShareTarget(env, usernameOrEmail) {
  const raw = String(usernameOrEmail || '').trim();
  if (!raw) return { error: 'Enter a username or email', status: 400 };

  let userId = '';
  if (raw.includes('@')) {
    const email = normalizeEmail(raw);
    if (!email) return { error: 'Invalid email', status: 400 };
    userId = generateUserId(email);
  } else {
    const username = normalizeUsername(raw);
    if (!username) return { error: 'Invalid username', status: 400 };
    const registry = env.USERNAME_REGISTRY.get(env.USERNAME_REGISTRY.idFromName('global'));
    const res = await registry.fetch(
      new Request('http://do/resolve', {
        method: 'POST',
        body: JSON.stringify({ username }),
      })
    );
    const data = await res.json();
    if (!data.success || !data.userId) {
      return { error: 'User not found', status: 404 };
    }
    userId = data.userId;
  }

  const profile = await fetchUserProfile(env, userId);
  if (!profile) return { error: 'User not found', status: 404 };
  return { profile };
}

function newProjectId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function handleTetherRequest(request, env, corsHeaders, path, ctx) {
  const url = new URL(request.url);
  let sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    sessionId = String(url.searchParams.get('session') || '').trim() || null;
  }
  const userId = await sessionUserId(env, sessionId);

  if (path === '/api/tether/sync') {
    if (!userId) return jsonResponse({ error: 'Not authenticated' }, corsHeaders, 401);
    const stub = tetherSyncStub(env, userId);
    if (!stub) return jsonResponse({ error: 'Sync unavailable' }, corsHeaders, 503);
    if (request.headers.get('Upgrade') !== 'websocket') {
      return jsonResponse({ error: 'Expected WebSocket upgrade' }, corsHeaders, 426);
    }
    return stub.fetch(request);
  }

  if (!userId) {
    return jsonResponse({ error: 'Not authenticated' }, corsHeaders, 401);
  }

  if (path === '/api/tether/projects' && request.method === 'GET') {
    return cachedTetherGet(ctx, userId, path, '', corsHeaders, async () => {
      const projectIds = await getTetherProjectIds(env, userId);
      const projects = await fetchAccessibleProjectSummaries(env, projectIds, userId);
      return { projects };
    }, TETHER_CACHE_TTL.list);
  }

  if (path === '/api/tether/sync-version' && request.method === 'GET') {
    return cachedTetherGet(ctx, userId, path, '', corsHeaders, async () => {
      const fingerprint = await buildSyncFingerprint(env, userId);
      return { fingerprint, ts: Date.now() };
    }, TETHER_CACHE_TTL.syncVersion);
  }

  if (path === '/api/tether/my-tasks' && request.method === 'GET') {
    return cachedTetherGet(ctx, userId, path, '', corsHeaders, async () => {
      const projectIds = await getTetherProjectIds(env, userId);
      const accessible = await fetchAccessibleProjects(env, projectIds, userId);
      const inboxTasks = await getInboxTasks(env, userId);
      const tasks = [];

      for (const task of inboxTasks) {
        const { dependsOnTitles, blockedByIncomplete } = enrichTaskWithDeps(task, inboxTasks);
        tasks.push({
          ...task,
          projectId: null,
          projectTitle: 'None',
          dependsOnTitles,
          blockedByIncomplete,
        });
      }

      for (const project of accessible) {
        const projectTasks = project.tasks || [];
        const byId = new Map(projectTasks.map((t) => [t.id, t]));
        for (const task of projectTasks) {
          if (!(task.assigneeUserIds || []).includes(userId)) continue;
          const depIds = task.dependsOnTaskIds || [];
          const dependsOnTitles = depIds.map((id) => byId.get(id)?.title).filter(Boolean);
          const blockedByIncomplete = depIds
            .map((id) => byId.get(id))
            .filter((dep) => dep && (dep.status || 'todo') !== 'done')
            .map((dep) => dep.title);
          tasks.push({
            ...task,
            projectId: project.id,
            projectTitle: project.title,
            dependsOnTitles,
            blockedByIncomplete,
          });
        }
      }
      tasks.sort((a, b) => {
        const da = a.dueDate || '';
        const db = b.dueDate || '';
        if (da && db && da !== db) return da.localeCompare(db);
        if (da && !db) return -1;
        if (!da && db) return 1;
        return String(a.title || '').localeCompare(String(b.title || ''));
      });
      return { tasks };
    }, TETHER_CACHE_TTL.list);
  }

  if (path === '/api/tether/inbox' && request.method === 'GET') {
    return cachedTetherGet(ctx, userId, path, '', corsHeaders, async () => {
      const tasks = await getInboxTasks(env, userId);
      return { tasks };
    }, TETHER_CACHE_TTL.list);
  }

  if (path === '/api/tether/inbox' && request.method === 'PUT') {
    const body = await request.json();
    const tasks = Array.isArray(body.tasks) ? body.tasks : [];
    const depError = validateTaskDependencyCompletion(tasks);
    if (depError) return jsonResponse({ error: depError.error }, corsHeaders, depError.status);
    const saved = await saveInboxTasks(env, userId, tasks);
    await publishInboxSync(env, userId, readSyncClientId(request, body), ctx);
    return jsonResponse({ tasks: saved }, corsHeaders);
  }

  if (path === '/api/tether/label-colors' && request.method === 'GET') {
    return cachedTetherGet(ctx, userId, path, '', corsHeaders, async () => {
      const labelColors = await getLabelColors(env, userId);
      return { labelColors };
    }, TETHER_CACHE_TTL.prefs);
  }

  if (path === '/api/tether/label-colors' && request.method === 'PUT') {
    const body = await request.json();
    const raw = body.labelColors && typeof body.labelColors === 'object' ? body.labelColors : {};
    const labelColors = {};
    for (const [key, val] of Object.entries(raw)) {
      const label = String(key || '').trim().toLowerCase();
      const idx = Number(val);
      if (!label || !Number.isInteger(idx) || idx < 0 || idx > 11) continue;
      labelColors[label] = idx;
    }
    const saved = await saveLabelColors(env, userId, labelColors);
    scheduleTetherCacheWork(ctx, invalidateTetherUserCache(userId));
    return jsonResponse({ labelColors: saved }, corsHeaders);
  }

  if (path === '/api/tether/settings' && request.method === 'GET') {
    return cachedTetherGet(ctx, userId, path, '', corsHeaders, async () => {
      const settings = await getTetherSettings(env, userId);
      return { settings };
    }, TETHER_CACHE_TTL.prefs);
  }

  if (path === '/api/tether/settings' && request.method === 'PUT') {
    const body = await request.json();
    const saved = await saveTetherSettings(env, userId, body.settings);
    scheduleTetherCacheWork(ctx, invalidateTetherUserCache(userId));
    return jsonResponse({ settings: saved }, corsHeaders);
  }

  if (path === '/api/tether/inbox/move-to-project' && request.method === 'POST') {
    const body = await request.json();
    const taskId = String(body.taskId || '').trim();
    const projectId = String(body.projectId || '').trim();
    if (!taskId || !projectId) {
      return jsonResponse({ error: 'taskId and projectId required' }, corsHeaders, 400);
    }

    const inboxTasks = await getInboxTasks(env, userId);
    const taskIdx = inboxTasks.findIndex((t) => t.id === taskId);
    if (taskIdx < 0) return jsonResponse({ error: 'Task not found in inbox' }, corsHeaders, 404);

    const project = await fetchProject(env, projectId);
    if (!project) return jsonResponse({ error: 'Project not found' }, corsHeaders, 404);
    if (!userCanAccessProject(project, userId)) {
      return jsonResponse({ error: 'Access denied' }, corsHeaders, 403);
    }

    const [task] = inboxTasks.splice(taskIdx, 1);
    const moved = {
      ...task,
      dependsOnTaskIds: [],
      assigneeUserIds: [userId],
      sortOrder: (project.tasks || []).length,
    };
    project.tasks = [...(project.tasks || []), moved];
    project.updatedAt = Date.now();

    const depError = validateTaskDependencyCompletion(project.tasks);
    if (depError) return jsonResponse({ error: depError.error }, corsHeaders, depError.status);

    await saveInboxTasks(env, userId, inboxTasks);
    const stub = tetherProjectStub(env, projectId);
    await stub.fetch(
      new Request('http://do/save', {
        method: 'POST',
        body: JSON.stringify(project),
      })
    );
    const syncClientId = readSyncClientId(request, body);
    await publishInboxSync(env, userId, syncClientId, ctx);
    await publishProjectSync(env, project, syncClientId, ctx);
    return jsonResponse({ task: moved, projectId, tasks: inboxTasks }, corsHeaders);
  }

  if (path === '/api/tether/task/move' && request.method === 'POST') {
    const body = await request.json();
    const taskId = String(body.taskId || '').trim();
    const fromProjectId = body.fromProjectId != null && String(body.fromProjectId).trim() !== ''
      ? String(body.fromProjectId).trim()
      : null;
    const toProjectId = body.toProjectId != null && String(body.toProjectId).trim() !== ''
      ? String(body.toProjectId).trim()
      : null;

    if (!taskId) return jsonResponse({ error: 'taskId required' }, corsHeaders, 400);
    if (fromProjectId === toProjectId) {
      return jsonResponse({ error: 'Task is already there' }, corsHeaders, 400);
    }

    let targetProject = null;
    if (toProjectId) {
      targetProject = await fetchProject(env, toProjectId);
      if (!targetProject) return jsonResponse({ error: 'Target project not found' }, corsHeaders, 404);
      if (!userCanAccessProject(targetProject, userId)) {
        return jsonResponse({ error: 'Access denied' }, corsHeaders, 403);
      }
    }

    let sourceProject = null;
    let inboxTasks = null;
    let task = null;

    if (!fromProjectId) {
      inboxTasks = await getInboxTasks(env, userId);
      const taskIdx = inboxTasks.findIndex((t) => t.id === taskId);
      if (taskIdx < 0) return jsonResponse({ error: 'Task not found in inbox' }, corsHeaders, 404);
      [task] = inboxTasks.splice(taskIdx, 1);
    } else {
      sourceProject = await fetchProject(env, fromProjectId);
      if (!sourceProject) return jsonResponse({ error: 'Source project not found' }, corsHeaders, 404);
      if (!userCanAccessProject(sourceProject, userId)) {
        return jsonResponse({ error: 'Access denied' }, corsHeaders, 403);
      }
      const taskIdx = (sourceProject.tasks || []).findIndex((t) => t.id === taskId);
      if (taskIdx < 0) return jsonResponse({ error: 'Task not found in project' }, corsHeaders, 404);
      [task] = sourceProject.tasks.splice(taskIdx, 1);
      sourceProject.updatedAt = Date.now();
    }

    const moved = { ...task, dependsOnTaskIds: [] };

    if (!toProjectId) {
      moved.assigneeUserIds = [];
      if (!inboxTasks) inboxTasks = await getInboxTasks(env, userId);
      moved.sortOrder = inboxTasks.length;
      inboxTasks.push(moved);
      await saveInboxTasks(env, userId, inboxTasks);
      if (sourceProject) {
        const stub = tetherProjectStub(env, sourceProject.id);
        await stub.fetch(
          new Request('http://do/save', { method: 'POST', body: JSON.stringify(sourceProject) })
        );
      }
      const syncClientId = readSyncClientId(request, body);
      await publishInboxSync(env, userId, syncClientId, ctx);
      if (sourceProject) await publishProjectSync(env, sourceProject, syncClientId, ctx);
      return jsonResponse({ task: moved, fromProjectId, toProjectId: null }, corsHeaders);
    }

    if (!fromProjectId) {
      moved.assigneeUserIds = [userId];
    }
    moved.sortOrder = (targetProject.tasks || []).length;
    targetProject.tasks = [...(targetProject.tasks || []), moved];
    targetProject.updatedAt = Date.now();

    const depError = validateTaskDependencyCompletion(targetProject.tasks);
    if (depError) return jsonResponse({ error: depError.error }, corsHeaders, depError.status);

    if (!fromProjectId) {
      await saveInboxTasks(env, userId, inboxTasks);
    } else if (sourceProject) {
      const sourceStub = tetherProjectStub(env, sourceProject.id);
      await sourceStub.fetch(
        new Request('http://do/save', { method: 'POST', body: JSON.stringify(sourceProject) })
      );
    }

    const targetStub = tetherProjectStub(env, toProjectId);
    await targetStub.fetch(
      new Request('http://do/save', { method: 'POST', body: JSON.stringify(targetProject) })
    );
    const syncClientId = readSyncClientId(request, body);
    await publishInboxSync(env, userId, syncClientId, ctx);
    if (sourceProject) await publishProjectSync(env, sourceProject, syncClientId, ctx);
    await publishProjectSync(env, targetProject, syncClientId, ctx);
    return jsonResponse({ task: moved, fromProjectId, toProjectId }, corsHeaders);
  }

  if (path === '/api/tether/inbox/unpack-project' && request.method === 'POST') {
    const body = await request.json();
    const projectId = String(body.projectId || '').trim();
    if (!projectId) return jsonResponse({ error: 'projectId required' }, corsHeaders, 400);

    const project = await fetchProject(env, projectId);
    if (!project) return jsonResponse({ error: 'Project not found' }, corsHeaders, 404);
    if (!userIsOwner(project, userId)) {
      return jsonResponse({ error: 'Only the project owner can move tasks to inbox' }, corsHeaders, 403);
    }

    const inboxTasks = await getInboxTasks(env, userId);
    const existingTitles = new Set(inboxTasks.map((t) => String(t.title || '').trim().toLowerCase()));
    let moved = 0;
    for (const task of project.tasks || []) {
      const key = String(task.title || '').trim().toLowerCase();
      if (!key || existingTitles.has(key)) continue;
      existingTitles.add(key);
      inboxTasks.push({
        ...task,
        dependsOnTaskIds: [],
        assigneeUserIds: [],
        sortOrder: inboxTasks.length,
      });
      moved++;
    }

    await saveInboxTasks(env, userId, inboxTasks);
    for (const member of project.members || []) {
      if (member.userId) await removeTetherProjectId(env, member.userId, projectId);
    }
    const stub = tetherProjectStub(env, projectId);
    await stub.fetch(new Request('http://do/delete', { method: 'POST' }));

    const syncClientId = readSyncClientId(request, body);
    await publishInboxSync(env, userId, syncClientId, ctx);
    await publishProjectsListSync(env, projectMemberIds(project), syncClientId, ctx);
    return jsonResponse({ moved, inboxTaskCount: inboxTasks.length }, corsHeaders);
  }

  if (path === '/api/tether/projects' && request.method === 'POST') {
    const body = await request.json();
    const title = String(body.title || '').trim();
    const description = String(body.description ?? body.definitionOfDone ?? '').trim();
    if (!title) return jsonResponse({ error: 'Project title is required' }, corsHeaders, 400);

    const profile = await fetchUserProfile(env, userId);
    if (!profile) return jsonResponse({ error: 'Account profile not found' }, corsHeaders, 400);

    const projectId = newProjectId();
    const now = Date.now();
    const project = {
      id: projectId,
      title,
      description,
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
    await publishProjectsListSync(env, [userId], readSyncClientId(request, body), ctx);
    return jsonResponse({ project: { ...project, isOwner: true } }, corsHeaders, 201);
  }

  if (path === '/api/tether/project' && request.method === 'GET') {
    const projectId = String(url.searchParams.get('projectId') || '').trim();
    if (!projectId) return jsonResponse({ error: 'projectId required' }, corsHeaders, 400);
    const cacheQuery = `projectId=${encodeURIComponent(projectId)}`;

    // Cache lookup before Durable Object reads when the user already has access.
    try {
      if (typeof caches !== 'undefined') {
        const hit = await caches.default.match(tetherCacheRequest(userId, path, cacheQuery));
        if (hit) {
          const headers = new Headers(hit.headers);
          Object.entries(corsHeaders || {}).forEach(([k, v]) => headers.set(k, v));
          headers.set('Content-Type', 'application/json');
          headers.set('Cache-Control', 'private, no-store');
          headers.set('X-Tether-Cache', 'HIT');
          return new Response(hit.body, { status: hit.status, headers });
        }
      }
    } catch {
      /* miss */
    }

    let project = await fetchProject(env, projectId);
    if (!project) return jsonResponse({ error: 'Project not found' }, corsHeaders, 404);
    if (!userCanAccessProject(project, userId)) {
      // Share-link join has a side effect — never cache this branch.
      if (userWasRemovedFromProject(project, userId)) {
        return jsonResponse({ error: 'Access denied' }, corsHeaders, 403);
      }
      const profile = await fetchUserProfile(env, userId);
      if (!profile) return jsonResponse({ error: 'Access denied' }, corsHeaders, 403);
      project = await addMemberToProject(env, project, profile);
      scheduleTetherCacheWork(
        ctx,
        invalidateTetherUsersCache([userId, ...projectMemberIds(project)], {
          projectIds: [projectId],
        })
      );
      return jsonResponse({ project: { ...project, isOwner: userIsOwner(project, userId) } }, corsHeaders);
    }

    return cachedTetherGet(
      ctx,
      userId,
      path,
      cacheQuery,
      corsHeaders,
      async () => ({ project: { ...project, isOwner: userIsOwner(project, userId) } }),
      TETHER_CACHE_TTL.project
    );
  }

  if (path === '/api/tether/project' && request.method === 'PUT') {
    const body = await request.json();
    const projectId = String(body.projectId || '').trim();
    if (!projectId) return jsonResponse({ error: 'projectId required' }, corsHeaders, 400);

    const existing = await fetchProject(env, projectId);
    if (!existing) return jsonResponse({ error: 'Project not found' }, corsHeaders, 404);
    if (!userCanAccessProject(existing, userId)) {
      return jsonResponse({ error: 'Access denied' }, corsHeaders, 403);
    }

    const updated = {
      ...existing,
      title: body.title != null ? String(body.title).trim() : existing.title,
      description:
        body.description != null
          ? String(body.description).trim()
          : body.definitionOfDone != null
            ? String(body.definitionOfDone).trim()
            : projectDescription(existing),
      tasks: Array.isArray(body.tasks) ? body.tasks : existing.tasks,
      updatedAt: Date.now(),
    };
    delete updated.definitionOfDone;

    if (!updated.title) return jsonResponse({ error: 'Project title is required' }, corsHeaders, 400);

    const depError = validateTaskDependencyCompletion(updated.tasks);
    if (depError) return jsonResponse({ error: depError.error }, corsHeaders, depError.status);

    const stub = tetherProjectStub(env, projectId);
    await stub.fetch(
      new Request('http://do/save', {
        method: 'POST',
        body: JSON.stringify(updated),
      })
    );
    await publishProjectSync(env, updated, readSyncClientId(request, body), ctx);
    return jsonResponse({ project: { ...updated, isOwner: userIsOwner(updated, userId) } }, corsHeaders);
  }

  if (path === '/api/tether/project' && request.method === 'DELETE') {
    const url = new URL(request.url);
    const projectId = String(url.searchParams.get('projectId') || '').trim();
    if (!projectId) return jsonResponse({ error: 'projectId required' }, corsHeaders, 400);

    const project = await fetchProject(env, projectId);
    if (!project) return jsonResponse({ error: 'Project not found' }, corsHeaders, 404);
    if (!userIsOwner(project, userId)) {
      return jsonResponse({ error: 'Only the project owner can delete it' }, corsHeaders, 403);
    }

    for (const member of project.members || []) {
      if (member.userId) await removeTetherProjectId(env, member.userId, projectId);
    }
    const stub = tetherProjectStub(env, projectId);
    await stub.fetch(new Request('http://do/delete', { method: 'POST' }));
    await publishProjectsListSync(env, projectMemberIds(project), readSyncClientId(request, null), ctx);
    return jsonResponse({ success: true }, corsHeaders);
  }

  if (path === '/api/tether/share' && request.method === 'POST') {
    const body = await request.json();
    const projectId = String(body.projectId || '').trim();
    const usernameOrEmail = String(body.usernameOrEmail || '').trim();
    if (!projectId) return jsonResponse({ error: 'projectId required' }, corsHeaders, 400);

    const project = await fetchProject(env, projectId);
    if (!project) return jsonResponse({ error: 'Project not found' }, corsHeaders, 404);
    if (!userIsOwner(project, userId)) {
      return jsonResponse({ error: 'Only the project owner can share' }, corsHeaders, 403);
    }

    const resolved = await resolveShareTarget(env, usernameOrEmail);
    if (resolved.error) return jsonResponse({ error: resolved.error }, corsHeaders, resolved.status);

    const target = resolved.profile;
    if (target.userId === userId) {
      return jsonResponse({ error: 'You already have access to this project' }, corsHeaders, 400);
    }

    if ((project.members || []).some((m) => m.userId === target.userId)) {
      return jsonResponse({ error: 'User already has access' }, corsHeaders, 409);
    }

    const clearedRemoved = clearRemovedMember(project, target.userId);
    const projectForShare =
      clearedRemoved === project.removedMemberUserIds
        ? project
        : { ...project, removedMemberUserIds: clearedRemoved, updatedAt: Date.now() };
    if (projectForShare !== project) {
      const shareStub = tetherProjectStub(env, projectId);
      await shareStub.fetch(
        new Request('http://do/save', {
          method: 'POST',
          body: JSON.stringify(projectForShare),
        })
      );
    }
    const updated = await addMemberToProject(env, projectForShare, target);
    await publishProjectSync(env, updated, readSyncClientId(request, body), ctx);
    await publishProjectsListSync(env, [target.userId], readSyncClientId(request, body), ctx);
    return jsonResponse({ project: { ...updated, isOwner: userIsOwner(updated, userId) } }, corsHeaders);
  }

  if (path === '/api/tether/unshare' && request.method === 'POST') {
    const body = await request.json();
    const projectId = String(body.projectId || '').trim();
    const removeUserId = String(body.userId || '').trim();
    if (!projectId || !removeUserId) {
      return jsonResponse({ error: 'projectId and userId required' }, corsHeaders, 400);
    }

    const project = await fetchProject(env, projectId);
    if (!project) return jsonResponse({ error: 'Project not found' }, corsHeaders, 404);
    if (!userIsOwner(project, userId)) {
      return jsonResponse({ error: 'Only the project owner can remove members' }, corsHeaders, 403);
    }
    if (removeUserId === project.ownerUserId) {
      return jsonResponse({ error: 'Cannot remove the project owner' }, corsHeaders, 400);
    }

    const members = (project.members || []).filter((m) => m.userId !== removeUserId);
    const updated = {
      ...project,
      members,
      removedMemberUserIds: rememberRemovedMember(project, removeUserId),
      updatedAt: Date.now(),
    };
    const stub = tetherProjectStub(env, projectId);
    await stub.fetch(
      new Request('http://do/save', {
        method: 'POST',
        body: JSON.stringify(updated),
      })
    );
    await removeTetherProjectId(env, removeUserId, projectId);
    const syncClientId = readSyncClientId(request, body);
    await publishProjectSync(env, updated, syncClientId, ctx);
    await publishProjectsListSync(env, [removeUserId], syncClientId, ctx);
    return jsonResponse({ project: { ...updated, isOwner: userIsOwner(updated, userId) } }, corsHeaders);
  }

  return null;
}

export class TetherSync {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/notify' && request.method === 'POST') {
      const payload = await request.json();
      this.broadcast(payload);
      return jsonResponse({ ok: true }, {});
    }

    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.state.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return jsonResponse({ error: 'Not found' }, {}, 404);
  }

  broadcast(payload) {
    const message = JSON.stringify(payload);
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(message);
      } catch {
        /* ignore closed sockets */
      }
    }
  }

  async webSocketClose(ws, code, reason) {
    try {
      ws.close(code, reason);
    } catch {
      /* already closed */
    }
  }

  async webSocketMessage(ws, message) {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
    if (text === 'ping') {
      try {
        ws.send('pong');
      } catch {
        /* ignore */
      }
    }
  }
}

export class TetherProject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/create' && request.method === 'POST') {
        const project = await request.json();
        await this.storage.put('project', project);
        await this.storage.put('listMeta', buildListMeta(project));
        return jsonResponse({ success: true }, {});
      }
      if (path === '/get' && request.method === 'GET') {
        const project = await this.storage.get('project');
        if (!project) return jsonResponse({ error: 'Not found' }, {}, 404);
        return jsonResponse(project, {});
      }
      if (path === '/get-list-meta' && request.method === 'GET') {
        let meta = await this.storage.get('listMeta');
        if (!meta) {
          const project = await this.storage.get('project');
          if (!project) return jsonResponse({ error: 'Not found' }, {}, 404);
          meta = buildListMeta(project);
          await this.storage.put('listMeta', meta);
        }
        return jsonResponse(meta, {});
      }
      if (path === '/save' && request.method === 'POST') {
        const project = await request.json();
        await this.storage.put('project', project);
        await this.storage.put('listMeta', buildListMeta(project));
        return jsonResponse({ success: true }, {});
      }
      if (path === '/delete' && request.method === 'POST') {
        await this.storage.deleteAll();
        return jsonResponse({ success: true }, {});
      }
      return jsonResponse({ error: 'Not found' }, {}, 404);
    } catch (err) {
      return jsonResponse({ error: err.message || 'Internal error' }, {}, 500);
    }
  }
}
