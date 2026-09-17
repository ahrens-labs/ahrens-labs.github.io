// Tether — shared project & task management (Durable Object + API handlers)

import {
  getAppDataKey,
  encryptTetherProject,
  decryptTetherProject,
  encryptListMeta,
  decryptListMeta,
} from './app-data-crypto.js';
import {
  tetherD1WriteEnabled,
  tetherD1ReadEnabled,
  tetherD1PrimaryEnabled,
  tetherD1UserDataEnabled,
  tetherD1CompareEnabled,
  d1PutProject,
  d1DeleteProject,
  d1GetProject,
  d1GetProjectListMeta,
  d1GetUserProjectIds,
  d1AddUserProjectId,
  d1RemoveUserProjectId,
  d1PutInbox,
  d1GetInbox,
  d1GetPrefs,
  d1PutLabelColors,
  d1PutSettings,
  d1GetMyTasks,
  d1ListProjectSummariesForUser,
  tetherDocFingerprint,
} from './tether-d1.js';

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
  syncVersion: 30,
  list: 0, // content endpoints: do not cache decrypted bodies
  project: 0,
  prefs: 60,
};

const TETHER_USER_CACHE_PATHS = [
  '/api/tether/bootstrap',
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
  const ttl = Number(maxAgeSec);
  const useCache = Number.isFinite(ttl) && ttl > 0;
  const key = tetherCacheRequest(userId, path, query);
  try {
    if (useCache && typeof caches !== 'undefined') {
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
    'X-Tether-Cache': useCache ? 'MISS' : 'BYPASS',
  });

  if (!useCache) return response;

  try {
    if (typeof caches !== 'undefined') {
      const cacheHeaders = new Headers(response.headers);
      cacheHeaders.set('Cache-Control', `public, max-age=${Math.max(1, ttl)}`);
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
  await bumpTetherSyncGeneration(env, userId);
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
  await bumpTetherSyncGenerationForUsers(env, memberIds);
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
  await bumpTetherSyncGenerationForUsers(env, ids);
  const payload = {
    type: 'projects',
    ts: Date.now(),
    sourceClientId,
  };
  await Promise.all([...ids].filter(Boolean).map((uid) => notifyTetherSync(env, uid, payload)));
}

async function bumpTetherSyncGeneration(env, userId) {
  const stub = userAccountStub(env, userId);
  if (!stub) return;
  try {
    await stub.fetch(new Request('http://do/bumpTetherSyncGeneration', { method: 'POST' }));
  } catch {
    /* sync meta is best-effort */
  }
}

async function bumpTetherSyncGenerationForUsers(env, userIds) {
  const ids = userIds instanceof Set ? [...userIds] : Array.isArray(userIds) ? userIds : [];
  await Promise.all(ids.filter(Boolean).map((uid) => bumpTetherSyncGeneration(env, uid)));
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

async function getTetherProjectIdsFromDo(env, userId) {
  const stub = userAccountStub(env, userId);
  if (!stub) return [];
  const res = await stub.fetch(new Request('http://do/getTetherProjectIds', { method: 'GET' }));
  const data = await res.json();
  return Array.isArray(data.projectIds) ? data.projectIds : [];
}

async function getTetherProjectIds(env, userId) {
  if (tetherD1PrimaryEnabled(env) && tetherD1UserDataEnabled(env)) {
    return d1GetUserProjectIds(env, userId);
  }
  if (tetherD1ReadEnabled(env) || tetherD1UserDataEnabled(env)) {
    const fromD1 = await d1GetUserProjectIds(env, userId);
    if (fromD1.length) return fromD1;
    // Heal empty D1 membership from UserAccount during cutover.
    const fromDo = await getTetherProjectIdsFromDo(env, userId);
    if (fromDo.length && tetherD1WriteEnabled(env)) {
      await Promise.all(fromDo.map((pid) => d1AddUserProjectId(env, userId, pid)));
    }
    return fromDo;
  }
  return getTetherProjectIdsFromDo(env, userId);
}

async function addTetherProjectId(env, userId, projectId) {
  if (!tetherD1PrimaryEnabled(env) || !tetherD1UserDataEnabled(env)) {
    const stub = userAccountStub(env, userId);
    if (stub) {
      await stub.fetch(
        new Request('http://do/addTetherProjectId', {
          method: 'POST',
          body: JSON.stringify({ projectId }),
        })
      );
    }
  }
  if (tetherD1WriteEnabled(env) || tetherD1PrimaryEnabled(env)) {
    await d1AddUserProjectId(env, userId, projectId);
  }
}

async function removeTetherProjectId(env, userId, projectId) {
  if (!tetherD1PrimaryEnabled(env) || !tetherD1UserDataEnabled(env)) {
    const stub = userAccountStub(env, userId);
    if (stub) {
      await stub.fetch(
        new Request('http://do/removeTetherProjectId', {
          method: 'POST',
          body: JSON.stringify({ projectId }),
        })
      );
    }
  }
  if (tetherD1WriteEnabled(env) || tetherD1PrimaryEnabled(env)) {
    await d1RemoveUserProjectId(env, userId, projectId);
  }
}

async function getInboxTasksFromDo(env, userId) {
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

async function getInboxTasks(env, userId) {
  if (tetherD1UserDataEnabled(env) && tetherD1PrimaryEnabled(env)) {
    return d1GetInbox(env, userId);
  }
  if (tetherD1UserDataEnabled(env)) {
    const fromD1 = await d1GetInbox(env, userId);
    if (fromD1.length) return fromD1;
    const fromDo = await getInboxTasksFromDo(env, userId);
    if (fromDo.length && tetherD1WriteEnabled(env)) {
      try {
        await d1PutInbox(env, userId, fromDo);
      } catch {
        /* heal best-effort */
      }
    }
    return fromDo;
  }
  return getInboxTasksFromDo(env, userId);
}

async function saveInboxTasks(env, userId, tasks) {
  const plain = Array.isArray(tasks) ? tasks : [];
  if (!tetherD1UserDataEnabled(env) || !tetherD1PrimaryEnabled(env)) {
    const stub = userAccountStub(env, userId);
    if (!stub) throw new Error('Account not found');
    const res = await stub.fetch(
      new Request('http://do/saveTetherInbox', {
        method: 'PUT',
        body: JSON.stringify({ tasks: plain }),
      })
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save inbox');
  }
  if (tetherD1WriteEnabled(env) || tetherD1UserDataEnabled(env)) {
    await d1PutInbox(env, userId, plain);
  }
  return plain;
}

async function getLabelColors(env, userId) {
  if (tetherD1UserDataEnabled(env) && tetherD1PrimaryEnabled(env)) {
    const prefs = await d1GetPrefs(env, userId);
    return prefs.labelColors && typeof prefs.labelColors === 'object' ? prefs.labelColors : {};
  }
  if (tetherD1UserDataEnabled(env)) {
    const prefs = await d1GetPrefs(env, userId);
    if (prefs.labelColors && Object.keys(prefs.labelColors).length) return prefs.labelColors;
  }
  const stub = userAccountStub(env, userId);
  if (!stub) return {};
  const res = await stub.fetch(new Request('http://do/getTetherLabelColors', { method: 'GET' }));
  if (!res.ok) return {};
  try {
    const data = await res.json();
    const colors = data.labelColors && typeof data.labelColors === 'object' ? data.labelColors : {};
    if (tetherD1UserDataEnabled(env) && tetherD1WriteEnabled(env) && Object.keys(colors).length) {
      try {
        await d1PutLabelColors(env, userId, colors);
      } catch {
        /* heal */
      }
    }
    return colors;
  } catch {
    return {};
  }
}

async function saveLabelColors(env, userId, labelColors) {
  if (!tetherD1UserDataEnabled(env) || !tetherD1PrimaryEnabled(env)) {
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
  }
  if (tetherD1WriteEnabled(env) || tetherD1UserDataEnabled(env)) {
    await d1PutLabelColors(env, userId, labelColors);
  }
  return labelColors && typeof labelColors === 'object' ? labelColors : {};
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
  if (tetherD1UserDataEnabled(env) && tetherD1PrimaryEnabled(env)) {
    const prefs = await d1GetPrefs(env, userId);
    return normalizeTetherSettings(prefs.settings);
  }
  if (tetherD1UserDataEnabled(env)) {
    const prefs = await d1GetPrefs(env, userId);
    if (prefs.settings && Object.keys(prefs.settings).length) {
      return normalizeTetherSettings(prefs.settings);
    }
  }
  const stub = userAccountStub(env, userId);
  if (!stub) return { ...DEFAULT_TETHER_SETTINGS };
  const res = await stub.fetch(new Request('http://do/getTetherSettings', { method: 'GET' }));
  if (!res.ok) return { ...DEFAULT_TETHER_SETTINGS };
  try {
    const data = await res.json();
    const settings = normalizeTetherSettings(data.settings);
    if (tetherD1UserDataEnabled(env) && tetherD1WriteEnabled(env)) {
      try {
        await d1PutSettings(env, userId, settings);
      } catch {
        /* heal */
      }
    }
    return settings;
  } catch {
    return { ...DEFAULT_TETHER_SETTINGS };
  }
}

async function saveTetherSettings(env, userId, settings) {
  const normalized = normalizeTetherSettings(settings);
  if (!tetherD1UserDataEnabled(env) || !tetherD1PrimaryEnabled(env)) {
    const stub = userAccountStub(env, userId);
    if (!stub) throw new Error('Account not found');
    const res = await stub.fetch(
      new Request('http://do/saveTetherSettings', {
        method: 'PUT',
        body: JSON.stringify({ settings: normalized }),
      })
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save settings');
  }
  if (tetherD1WriteEnabled(env) || tetherD1UserDataEnabled(env)) {
    await d1PutSettings(env, userId, normalized);
  }
  return normalized;
}

async function persistProjectToDo(env, project, mode = 'save') {
  const stub = tetherProjectStub(env, project.id);
  if (!stub) throw new Error('Project storage unavailable');
  const path = mode === 'create' ? '/create' : '/save';
  await stub.fetch(
    new Request(`http://do${path}`, {
      method: 'POST',
      body: JSON.stringify(project),
    })
  );
}

async function deleteProjectFromDo(env, projectId) {
  const stub = tetherProjectStub(env, projectId);
  if (!stub) return;
  await stub.fetch(new Request('http://do/delete', { method: 'POST' }));
}

/** Write project document honoring dual-write / D1-primary flags. */
async function persistProject(env, project, { create = false } = {}) {
  if (!tetherD1PrimaryEnabled(env)) {
    await persistProjectToDo(env, project, create ? 'create' : 'save');
  }
  if (tetherD1WriteEnabled(env) || tetherD1PrimaryEnabled(env)) {
    try {
      await d1PutProject(env, project);
    } catch (err) {
      if (tetherD1PrimaryEnabled(env)) throw err;
      console.warn('[tether-d1] putProject failed', project?.id, err?.message || err);
    }
  }
}

async function removeProjectStorage(env, projectId) {
  if (!tetherD1PrimaryEnabled(env)) {
    await deleteProjectFromDo(env, projectId);
  }
  if (tetherD1WriteEnabled(env) || tetherD1PrimaryEnabled(env)) {
    try {
      await d1DeleteProject(env, projectId);
    } catch (err) {
      if (tetherD1PrimaryEnabled(env)) throw err;
      console.warn('[tether-d1] deleteProject failed', projectId, err?.message || err);
    }
  }
}

function scheduleD1Compare(ctx, env, projectId, doProject, d1Project) {
  if (!tetherD1CompareEnabled(env)) return;
  const work = Promise.resolve().then(() => {
    const a = tetherDocFingerprint(doProject);
    const b = tetherDocFingerprint(d1Project);
    if (a !== b) {
      console.warn('[tether-d1] compare mismatch', projectId, { doLen: a.length, d1Len: b.length });
    }
  });
  scheduleTetherCacheWork(ctx, work);
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

function inboxTasksFromMyTasks(tasks) {
  return (tasks || [])
    .filter((t) => !t.projectId)
    .map((t) => {
      const { projectId, projectTitle, dependsOnTitles, blockedByIncomplete, ...rest } = t;
      return rest;
    });
}

async function listProjectsForUser(env, userId) {
  if (tetherD1ReadEnabled(env)) {
    const projects = await d1ListProjectSummariesForUser(env, userId);
    if (projects.length || (tetherD1PrimaryEnabled(env) && tetherD1UserDataEnabled(env))) {
      return projects;
    }
  }
  const projectIds = await getTetherProjectIds(env, userId);
  return fetchAccessibleProjectSummaries(env, projectIds, userId);
}

async function listMyTasksForUser(env, userId) {
  if (tetherD1ReadEnabled(env) && tetherD1UserDataEnabled(env)) {
    return d1GetMyTasks(env, userId);
  }
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
  return tasks;
}

/** One round-trip payload for Tether first paint: projects, my-tasks, inbox, prefs, sync fingerprint. */
async function loadTetherBootstrap(env, userId) {
  const d1Fast =
    tetherD1ReadEnabled(env) && tetherD1UserDataEnabled(env) && tetherD1PrimaryEnabled(env);

  if (d1Fast) {
    const [projects, tasks, prefs, fingerprint] = await Promise.all([
      listProjectsForUser(env, userId),
      d1GetMyTasks(env, userId),
      d1GetPrefs(env, userId),
      buildSyncFingerprint(env, userId),
    ]);
    return {
      projects,
      tasks,
      inbox: inboxTasksFromMyTasks(tasks),
      labelColors: prefs.labelColors && typeof prefs.labelColors === 'object' ? prefs.labelColors : {},
      settings: normalizeTetherSettings(prefs.settings),
      fingerprint,
      ts: Date.now(),
    };
  }

  const [projects, tasks, labelColors, settings, fingerprint] = await Promise.all([
    listProjectsForUser(env, userId),
    listMyTasksForUser(env, userId),
    getLabelColors(env, userId),
    getTetherSettings(env, userId),
    buildSyncFingerprint(env, userId),
  ]);
  return {
    projects,
    tasks,
    inbox: inboxTasksFromMyTasks(tasks),
    labelColors,
    settings,
    fingerprint,
    ts: Date.now(),
  };
}

async function fetchProjectFromDo(env, projectId) {
  const stub = tetherProjectStub(env, projectId);
  if (!stub) return null;
  const res = await stub.fetch(new Request('http://do/get', { method: 'GET' }));
  if (!res.ok) return null;
  return res.json();
}

async function fetchProject(env, projectId, ctx = null) {
  if (tetherD1ReadEnabled(env)) {
    const fromD1 = await d1GetProject(env, projectId);
    if (fromD1) {
      if (tetherD1CompareEnabled(env)) {
        scheduleTetherCacheWork(
          ctx,
          fetchProjectFromDo(env, projectId).then((fromDo) => {
            scheduleD1Compare(ctx, env, projectId, fromDo, fromD1);
          })
        );
      }
      return fromD1;
    }
    const fromDo = await fetchProjectFromDo(env, projectId);
    if (fromDo && tetherD1WriteEnabled(env)) {
      scheduleTetherCacheWork(
        ctx,
        d1PutProject(env, fromDo).catch((err) => {
          console.warn('[tether-d1] heal put failed', projectId, err?.message || err);
        })
      );
    }
    return fromDo;
  }
  return fetchProjectFromDo(env, projectId);
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
  if (tetherD1ReadEnabled(env)) {
    const meta = await d1GetProjectListMeta(env, projectId);
    if (meta) return meta;
  }
  const stub = tetherProjectStub(env, projectId);
  if (!stub) return null;
  const res = await stub.fetch(new Request('http://do/get-list-meta', { method: 'GET' }));
  if (!res.ok) return null;
  return res.json();
}

async function buildSyncFingerprint(env, userId) {
  const stub = userAccountStub(env, userId);
  if (!stub) return '0';
  try {
    const res = await stub.fetch(new Request('http://do/getTetherSyncMeta', { method: 'GET' }));
    if (!res.ok) return '0';
    const data = await res.json();
    return String(data?.syncGeneration || 0);
  } catch {
    return '0';
  }
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

/**
 * Backfill one user's Tether data from Durable Objects into D1.
 * Idempotent: overwrites D1 rows for discovered project IDs + inbox/prefs.
 */
export async function backfillUserTetherToD1(env, userId) {
  if (!userId || !env.TETHER_DB) {
    return { ok: false, error: 'D1 unavailable' };
  }
  const projectIds = await getTetherProjectIdsFromDo(env, userId);
  let projectsOk = 0;
  let projectsFail = 0;
  const seen = new Set();
  for (const pid of projectIds) {
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    try {
      const project = await fetchProjectFromDo(env, pid);
      if (!project) {
        projectsFail++;
        continue;
      }
      await d1PutProject(env, project);
      for (const m of project.members || []) {
        if (m?.userId) await d1AddUserProjectId(env, m.userId, pid);
      }
      projectsOk++;
    } catch (err) {
      projectsFail++;
      console.warn('[tether-d1] backfill project failed', pid, err?.message || err);
    }
  }

  let inboxCount = 0;
  try {
    const inbox = await getInboxTasksFromDo(env, userId);
    await d1PutInbox(env, userId, inbox);
    inboxCount = inbox.length;
  } catch (err) {
    console.warn('[tether-d1] backfill inbox failed', userId, err?.message || err);
  }

  try {
    const stub = userAccountStub(env, userId);
    if (stub) {
      const [colorsRes, settingsRes] = await Promise.all([
        stub.fetch(new Request('http://do/getTetherLabelColors', { method: 'GET' })),
        stub.fetch(new Request('http://do/getTetherSettings', { method: 'GET' })),
      ]);
      const colorsData = colorsRes.ok ? await colorsRes.json() : {};
      const settingsData = settingsRes.ok ? await settingsRes.json() : {};
      const labelColors =
        colorsData.labelColors && typeof colorsData.labelColors === 'object' ? colorsData.labelColors : {};
      const settings = normalizeTetherSettings(settingsData.settings);
      await d1PutLabelColors(env, userId, labelColors);
      await d1PutSettings(env, userId, settings);
    }
  } catch (err) {
    console.warn('[tether-d1] backfill prefs failed', userId, err?.message || err);
  }

  return {
    ok: true,
    userId,
    projectIds: projectIds.length,
    projectsOk,
    projectsFail,
    inboxCount,
  };
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
  await persistProject(env, updated);
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

  // Phase 2: DO → D1 backfill (admin / test-secret, or one-shot AUTO_BACKFILL).
  if (path === '/api/tether/admin/backfill-d1' && request.method === 'POST') {
    const testSecret = String(env.TEST_SECRET || '').trim();
    const provided = String(request.headers.get('X-Test-Secret') || '').trim();
    const autoOk = String(env.TETHER_D1_AUTO_BACKFILL || '') === '1';
    if ((!testSecret || provided !== testSecret) && !autoOk) {
      return jsonResponse({ error: 'Forbidden' }, corsHeaders, 403);
    }
    if (!env.TETHER_DB) {
      return jsonResponse({ error: 'TETHER_DB binding missing' }, corsHeaders, 503);
    }
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const singleUserId = body.userId != null ? String(body.userId).trim() : '';
    const userIds = [];
    if (singleUserId) {
      userIds.push(singleUserId);
    } else if (Array.isArray(body.userIds)) {
      for (const u of body.userIds) {
        const id = u != null ? String(u).trim() : '';
        if (id) userIds.push(id);
      }
    } else {
      // Walk username registry when no user list provided.
      if (!env.USERNAME_REGISTRY) {
        return jsonResponse({ error: 'USERNAME_REGISTRY unavailable' }, corsHeaders, 503);
      }
      const registry = env.USERNAME_REGISTRY.get(env.USERNAME_REGISTRY.idFromName('global'));
      const seen = new Set();
      let startAfter;
      for (let pages = 0; pages < 500; pages++) {
        const res = await registry.fetch(
          new Request('http://do/listUserIdsPage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: 100, ...(startAfter ? { startAfter } : {}) }),
          })
        );
        if (!res.ok) break;
        const data = await res.json();
        for (const uid of data.userIds || []) {
          const id = uid != null ? String(uid).trim() : '';
          if (!id || seen.has(id)) continue;
          seen.add(id);
          userIds.push(id);
        }
        if (!data.nextListCursor) break;
        startAfter = data.nextListCursor;
      }
    }

    const limit = Math.min(Number(body.limit) || userIds.length, userIds.length);
    const results = [];
    for (let i = 0; i < limit; i++) {
      results.push(await backfillUserTetherToD1(env, userIds[i]));
    }
    return jsonResponse(
      {
        ok: true,
        scanned: userIds.length,
        processed: results.length,
        projectsOk: results.reduce((n, r) => n + (r.projectsOk || 0), 0),
        projectsFail: results.reduce((n, r) => n + (r.projectsFail || 0), 0),
        results: body.includeResults ? results : undefined,
      },
      corsHeaders
    );
  }

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

  if (path === '/api/tether/bootstrap' && request.method === 'GET') {
    const body = await loadTetherBootstrap(env, userId);
    return jsonResponse(body, corsHeaders);
  }

  if (path === '/api/tether/projects' && request.method === 'GET') {
    return cachedTetherGet(ctx, userId, path, '', corsHeaders, async () => {
      const projects = await listProjectsForUser(env, userId);
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
      const tasks = await listMyTasksForUser(env, userId);
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
    await persistProject(env, project);
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
        await persistProject(env, sourceProject);
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
      await persistProject(env, sourceProject);
    }

    await persistProject(env, targetProject);
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
    await removeProjectStorage(env, projectId);

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

    await persistProject(env, project, { create: true });
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

    await persistProject(env, updated);
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
    await removeProjectStorage(env, projectId);
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
      await persistProject(env, projectForShare);
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
    await persistProject(env, updated);
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
        const key = getAppDataKey(this.env);
        const metaPlain = buildListMeta(project);
        await this.storage.put('project', await encryptTetherProject(project, key));
        await this.storage.put('listMeta', await encryptListMeta(metaPlain, key));
        return jsonResponse({ success: true }, {});
      }
      if (path === '/get' && request.method === 'GET') {
        const project = await this.storage.get('project');
        if (!project) return jsonResponse({ error: 'Not found' }, {}, 404);
        const key = getAppDataKey(this.env);
        return jsonResponse(await decryptTetherProject(project, key), {});
      }
      if (path === '/get-list-meta' && request.method === 'GET') {
        const key = getAppDataKey(this.env);
        let meta = await this.storage.get('listMeta');
        if (!meta) {
          const projectEnc = await this.storage.get('project');
          if (!projectEnc) return jsonResponse({ error: 'Not found' }, {}, 404);
          const project = await decryptTetherProject(projectEnc, key);
          meta = buildListMeta(project);
          await this.storage.put('listMeta', await encryptListMeta(meta, key));
          return jsonResponse(meta, {});
        }
        return jsonResponse(await decryptListMeta(meta, key), {});
      }
      if (path === '/save' && request.method === 'POST') {
        const project = await request.json();
        const key = getAppDataKey(this.env);
        const metaPlain = buildListMeta(project);
        await this.storage.put('project', await encryptTetherProject(project, key));
        await this.storage.put('listMeta', await encryptListMeta(metaPlain, key));
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
