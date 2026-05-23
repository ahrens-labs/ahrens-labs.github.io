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

function tetherProjectStub(env, projectId) {
  if (!env.TETHER_PROJECT || !projectId) return null;
  return env.TETHER_PROJECT.get(env.TETHER_PROJECT.idFromName(String(projectId)));
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

export async function handleTetherRequest(request, env, corsHeaders, path) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  const userId = await sessionUserId(env, sessionId);
  if (!userId) {
    return jsonResponse({ error: 'Not authenticated' }, corsHeaders, 401);
  }

  if (path === '/api/tether/projects' && request.method === 'GET') {
    const projectIds = await getTetherProjectIds(env, userId);
    const projects = await fetchAccessibleProjectSummaries(env, projectIds, userId);
    return jsonResponse({ projects }, corsHeaders);
  }

  if (path === '/api/tether/my-tasks' && request.method === 'GET') {
    const projectIds = await getTetherProjectIds(env, userId);
    const accessible = await fetchAccessibleProjects(env, projectIds, userId);
    const tasks = [];
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
    return jsonResponse({ tasks }, corsHeaders);
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
    return jsonResponse({ project: { ...project, isOwner: true } }, corsHeaders, 201);
  }

  if (path === '/api/tether/project' && request.method === 'GET') {
    const url = new URL(request.url);
    const projectId = String(url.searchParams.get('projectId') || '').trim();
    if (!projectId) return jsonResponse({ error: 'projectId required' }, corsHeaders, 400);

    let project = await fetchProject(env, projectId);
    if (!project) return jsonResponse({ error: 'Project not found' }, corsHeaders, 404);
    if (!userCanAccessProject(project, userId)) {
      const profile = await fetchUserProfile(env, userId);
      if (!profile) return jsonResponse({ error: 'Access denied' }, corsHeaders, 403);
      project = await addMemberToProject(env, project, profile);
    }
    return jsonResponse({ project: { ...project, isOwner: userIsOwner(project, userId) } }, corsHeaders);
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

    const updated = await addMemberToProject(env, project, target);
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
    const updated = { ...project, members, updatedAt: Date.now() };
    const stub = tetherProjectStub(env, projectId);
    await stub.fetch(
      new Request('http://do/save', {
        method: 'POST',
        body: JSON.stringify(updated),
      })
    );
    await removeTetherProjectId(env, removeUserId, projectId);
    return jsonResponse({ project: { ...updated, isOwner: userIsOwner(updated, userId) } }, corsHeaders);
  }

  return null;
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
