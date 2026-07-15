// Platter — shared weekly meal menus (Durable Object + API handlers)

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

function newMenuId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function userAccountStub(env, userId) {
  if (!env.USER_ACCOUNT || !userId) return null;
  return env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromName(String(userId)));
}

function platterMenuStub(env, menuId) {
  if (!env.PLATTER_MENU || !menuId) return null;
  return env.PLATTER_MENU.get(env.PLATTER_MENU.idFromName(String(menuId)));
}

function platterSyncStub(env, userId) {
  if (!env.PLATTER_SYNC || !userId) return null;
  return env.PLATTER_SYNC.get(env.PLATTER_SYNC.idFromName(String(userId)));
}

function readSyncClientId(request, body) {
  const fromHeader = String(request.headers.get('X-Platter-Sync-Client') || '').trim();
  if (fromHeader) return fromHeader.slice(0, 64);
  if (body && typeof body.syncClientId === 'string') {
    const id = body.syncClientId.trim();
    if (id) return id.slice(0, 64);
  }
  return null;
}

function menuMemberIds(menu) {
  const ids = new Set();
  if (menu?.ownerUserId) ids.add(menu.ownerUserId);
  for (const member of menu?.members || []) {
    if (member?.userId) ids.add(member.userId);
  }
  return ids;
}

async function notifyPlatterSync(env, userId, payload) {
  const stub = platterSyncStub(env, userId);
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

async function publishMenuSync(env, menu, sourceClientId, extraUserIds = []) {
  const ids = menuMemberIds(menu);
  for (const uid of extraUserIds) {
    if (uid) ids.add(uid);
  }
  const payload = {
    type: 'menu',
    menuId: menu?.id || null,
    updatedAt: menu?.updatedAt || Date.now(),
    ts: Date.now(),
    sourceClientId,
  };
  await Promise.all([...ids].filter(Boolean).map((uid) => notifyPlatterSync(env, uid, payload)));
}

async function buildSyncFingerprint(env, userId) {
  const menus = await listAccessibleMenus(env, userId);
  const state = await getPlatterState(env, userId);
  const parts = menus.map((m) => `${m.id}:${m.updatedAt || 0}`).sort();
  return `${state.activeMenuId || ''}::${parts.join('|')}`;
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

async function getPlatterState(env, userId) {
  const stub = userAccountStub(env, userId);
  if (!stub) return { menuIds: [], activeMenuId: null };
  const res = await stub.fetch(new Request('http://do/getPlatterState', { method: 'GET' }));
  if (!res.ok) return { menuIds: [], activeMenuId: null };
  try {
    const data = await res.json();
    return {
      menuIds: Array.isArray(data.menuIds) ? data.menuIds.filter((id) => typeof id === 'string' && id.trim()) : [],
      activeMenuId: typeof data.activeMenuId === 'string' && data.activeMenuId.trim() ? data.activeMenuId.trim() : null,
    };
  } catch {
    return { menuIds: [], activeMenuId: null };
  }
}

async function setPlatterState(env, userId, state) {
  const stub = userAccountStub(env, userId);
  if (!stub) return;
  await stub.fetch(
    new Request('http://do/setPlatterState', {
      method: 'POST',
      body: JSON.stringify(state || {}),
    })
  );
}

async function addPlatterMenuId(env, userId, menuId) {
  const stub = userAccountStub(env, userId);
  if (!stub) return;
  await stub.fetch(
    new Request('http://do/addPlatterMenuId', {
      method: 'POST',
      body: JSON.stringify({ menuId }),
    })
  );
}

async function removePlatterMenuId(env, userId, menuId) {
  const stub = userAccountStub(env, userId);
  if (!stub) return;
  await stub.fetch(
    new Request('http://do/removePlatterMenuId', {
      method: 'POST',
      body: JSON.stringify({ menuId }),
    })
  );
}

async function fetchMenu(env, menuId) {
  const stub = platterMenuStub(env, menuId);
  if (!stub) return null;
  const res = await stub.fetch(new Request('http://do/get', { method: 'GET' }));
  if (!res.ok) return null;
  return res.json();
}

async function saveMenu(env, menu) {
  const stub = platterMenuStub(env, menu.id);
  if (!stub) throw new Error('Menu storage unavailable');
  const res = await stub.fetch(
    new Request('http://do/save', {
      method: 'POST',
      body: JSON.stringify(menu),
    })
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save menu');
  }
}

function userCanAccessMenu(menu, userId) {
  if (!menu || !userId) return false;
  if (menu.ownerUserId === userId) return true;
  return Array.isArray(menu.members) && menu.members.some((m) => m && m.userId === userId);
}

function userIsOwner(menu, userId) {
  return !!(menu && userId && menu.ownerUserId === userId);
}

function normalizeMinutes(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(24 * 60, Math.round(n));
}

function normalizeMealFields(raw) {
  return {
    name: String(raw.name || '').trim().slice(0, 120),
    details: String(raw.details || '').trim().slice(0, 2000),
    cookMinutes: normalizeMinutes(raw.cookMinutes),
  };
}

function normalizeSlot(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const fields = normalizeMealFields(raw);
  if (!fields.name) return null;
  const savedId = raw.savedId != null ? String(raw.savedId).slice(0, 64) : null;
  return { ...fields, savedId };
}

function normalizeSlots(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key !== 'string' || key.length > 48) continue;
    if (!/^\d{4}-\d{2}-\d{2}:(breakfast|lunch|dinner)$/.test(key)) continue;
    const slot = normalizeSlot(value);
    if (slot) out[key] = slot;
  }
  return out;
}

function normalizeSaved(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw.slice(0, 500)) {
    if (!item || typeof item !== 'object') continue;
    const fields = normalizeMealFields(item);
    if (!fields.name) continue;
    const id = String(item.id || '').trim().slice(0, 64) || newMenuId();
    out.push({ id, ...fields, ready: !!item.ready });
  }
  return out;
}

function menuSummary(menu, userId) {
  const members = Array.isArray(menu.members) ? menu.members : [];
  return {
    id: menu.id,
    name: menu.name || 'Menu',
    ownerUserId: menu.ownerUserId,
    ownerUsername: menu.ownerUsername || '',
    isOwner: userIsOwner(menu, userId),
    memberCount: members.length,
    members: members.map((m) => ({
      userId: m.userId,
      username: m.username,
      role: m.role || 'member',
    })),
    updatedAt: menu.updatedAt || 0,
  };
}

function publicMenu(menu, userId) {
  return {
    ...menuSummary(menu, userId),
    slots: menu.slots && typeof menu.slots === 'object' ? menu.slots : {},
    saved: Array.isArray(menu.saved) ? menu.saved : [],
    updatedAt: menu.updatedAt || 0,
  };
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

async function createPersonalMenu(env, profile) {
  const id = newMenuId();
  const now = Date.now();
  const username = String(profile.username || 'user').trim() || 'user';
  const menu = {
    id,
    name: username + "'s menu",
    ownerUserId: profile.userId,
    ownerUsername: profile.username,
    members: [
      {
        userId: profile.userId,
        username: profile.username,
        email: profile.email,
        role: 'owner',
        addedAt: now,
      },
    ],
    slots: {},
    saved: [],
    createdAt: now,
    updatedAt: now,
  };
  await saveMenu(env, menu);
  await addPlatterMenuId(env, profile.userId, id);
  const state = await getPlatterState(env, profile.userId);
  if (!state.activeMenuId) {
    await setPlatterState(env, profile.userId, { activeMenuId: id, menuIds: state.menuIds.includes(id) ? state.menuIds : [...state.menuIds, id] });
  }
  return menu;
}

async function listAccessibleMenus(env, userId) {
  const state = await getPlatterState(env, userId);
  const menus = [];
  const keepIds = [];
  for (const menuId of state.menuIds) {
    const menu = await fetchMenu(env, menuId);
    if (!menu || !userCanAccessMenu(menu, userId)) continue;
    keepIds.push(menuId);
    menus.push(menu);
  }
  if (keepIds.length !== state.menuIds.length) {
    await setPlatterState(env, userId, {
      menuIds: keepIds,
      activeMenuId: keepIds.includes(state.activeMenuId) ? state.activeMenuId : keepIds[0] || null,
    });
  }
  menus.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return menus;
}

async function ensureBootstrap(env, userId) {
  const profile = await fetchUserProfile(env, userId);
  if (!profile) return { error: 'Account not found', status: 404 };

  let menus = await listAccessibleMenus(env, userId);
  const owned = menus.filter((m) => m.ownerUserId === userId);
  // Every account always has a personal owned menu named "{username}'s menu".
  if (!owned.length) {
    const personal = await createPersonalMenu(env, profile);
    menus = [personal, ...menus.filter((m) => m.id !== personal.id)];
  } else {
    const username = String(profile.username || 'user').trim() || 'user';
    const desired = username + "'s menu";
    for (const menu of owned) {
      // Migrate the old default name only — leave custom renames alone.
      if (menu.name === 'My menu') {
        menu.name = desired;
        menu.updatedAt = Date.now();
        await saveMenu(env, menu);
      }
    }
  }

  let state = await getPlatterState(env, userId);
  let activeMenuId = state.activeMenuId;
  if (!activeMenuId || !menus.some((m) => m.id === activeMenuId)) {
    activeMenuId = menus.find((m) => m.ownerUserId === userId)?.id || menus[0].id;
    await setPlatterState(env, userId, {
      menuIds: menus.map((m) => m.id),
      activeMenuId,
    });
  }

  const active = menus.find((m) => m.id === activeMenuId) || (await fetchMenu(env, activeMenuId));
  return {
    menus: menus.map((m) => menuSummary(m, userId)),
    menu: publicMenu(active, userId),
    activeMenuId,
  };
}

export async function handlePlatterRequest(request, env, corsHeaders, path) {
  const url = new URL(request.url);
  let sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    sessionId = String(url.searchParams.get('session') || '').trim() || null;
  }
  const userId = await sessionUserId(env, sessionId);

  if (path === '/api/platter/sync') {
    if (!userId) return jsonResponse({ error: 'Not authenticated' }, corsHeaders, 401);
    const stub = platterSyncStub(env, userId);
    if (!stub) return jsonResponse({ error: 'Sync unavailable' }, corsHeaders, 503);
    if (request.headers.get('Upgrade') !== 'websocket') {
      return jsonResponse({ error: 'Expected WebSocket upgrade' }, corsHeaders, 426);
    }
    return stub.fetch(request);
  }

  if (!env.PLATTER_MENU) {
    return jsonResponse({ error: 'Platter unavailable — deploy worker with PLATTER_MENU binding' }, corsHeaders, 503);
  }

  if (!userId) {
    return jsonResponse({ error: 'Not authenticated' }, corsHeaders, 401);
  }

  if (path === '/api/platter/sync-version' && request.method === 'GET') {
    const fingerprint = await buildSyncFingerprint(env, userId);
    return jsonResponse({ fingerprint, ts: Date.now() }, corsHeaders);
  }

  if (path === '/api/platter/bootstrap' && request.method === 'GET') {
    const result = await ensureBootstrap(env, userId);
    if (result.error) return jsonResponse({ error: result.error }, corsHeaders, result.status);
    return jsonResponse(result, corsHeaders);
  }

  if (path === '/api/platter/menus' && request.method === 'GET') {
    const result = await ensureBootstrap(env, userId);
    if (result.error) return jsonResponse({ error: result.error }, corsHeaders, result.status);
    return jsonResponse({ menus: result.menus, activeMenuId: result.activeMenuId }, corsHeaders);
  }

  if (path === '/api/platter/menu' && request.method === 'GET') {
    let menuId = String(url.searchParams.get('menuId') || '').trim();
    if (!menuId) {
      const boot = await ensureBootstrap(env, userId);
      if (boot.error) return jsonResponse({ error: boot.error }, corsHeaders, boot.status);
      return jsonResponse({ menu: boot.menu, menus: boot.menus, activeMenuId: boot.activeMenuId }, corsHeaders);
    }
    const menu = await fetchMenu(env, menuId);
    if (!menu || !userCanAccessMenu(menu, userId)) {
      return jsonResponse({ error: 'Menu not found' }, corsHeaders, 404);
    }
    return jsonResponse({ menu: publicMenu(menu, userId) }, corsHeaders);
  }

  if (path === '/api/platter/menu' && request.method === 'PUT') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, corsHeaders, 400);
    }
    const menuId = String(body.menuId || '').trim();
    if (!menuId) return jsonResponse({ error: 'menuId required' }, corsHeaders, 400);
    const existing = await fetchMenu(env, menuId);
    if (!existing || !userCanAccessMenu(existing, userId)) {
      return jsonResponse({ error: 'Menu not found' }, corsHeaders, 404);
    }

    const clientUpdatedAt = Number(body.updatedAt);
    if (
      Number.isFinite(clientUpdatedAt) &&
      clientUpdatedAt > 0 &&
      (existing.updatedAt || 0) > clientUpdatedAt
    ) {
      return jsonResponse(
        {
          error: 'Menu was updated elsewhere',
          conflict: true,
          menu: publicMenu(existing, userId),
        },
        corsHeaders,
        409
      );
    }

    const next = {
      ...existing,
      slots: body.slots !== undefined ? normalizeSlots(body.slots) : existing.slots || {},
      saved: body.saved !== undefined ? normalizeSaved(body.saved) : existing.saved || [],
      updatedAt: Date.now(),
    };
    if (typeof body.name === 'string' && body.name.trim() && userIsOwner(existing, userId)) {
      next.name = body.name.trim().slice(0, 80);
    }

    await saveMenu(env, next);
    await publishMenuSync(env, next, readSyncClientId(request, body));
    return jsonResponse({ menu: publicMenu(next, userId), success: true }, corsHeaders);
  }

  if (path === '/api/platter/active' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, corsHeaders, 400);
    }
    const menuId = String(body.menuId || '').trim();
    if (!menuId) return jsonResponse({ error: 'menuId required' }, corsHeaders, 400);
    const menu = await fetchMenu(env, menuId);
    if (!menu || !userCanAccessMenu(menu, userId)) {
      return jsonResponse({ error: 'Menu not found' }, corsHeaders, 404);
    }
    await addPlatterMenuId(env, userId, menuId);
    const state = await getPlatterState(env, userId);
    await setPlatterState(env, userId, { menuIds: state.menuIds, activeMenuId: menuId });
    return jsonResponse({ menu: publicMenu(menu, userId), activeMenuId: menuId }, corsHeaders);
  }

  if (path === '/api/platter/share' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, corsHeaders, 400);
    }
    const menuId = String(body.menuId || '').trim();
    const usernameOrEmail = String(body.usernameOrEmail || '').trim();
    if (!menuId) return jsonResponse({ error: 'menuId required' }, corsHeaders, 400);

    const menu = await fetchMenu(env, menuId);
    if (!menu) return jsonResponse({ error: 'Menu not found' }, corsHeaders, 404);
    if (!userIsOwner(menu, userId)) {
      return jsonResponse({ error: 'Only the menu owner can share' }, corsHeaders, 403);
    }

    const resolved = await resolveShareTarget(env, usernameOrEmail);
    if (resolved.error) return jsonResponse({ error: resolved.error }, corsHeaders, resolved.status);

    const target = resolved.profile;
    if (target.userId === userId) {
      return jsonResponse({ error: 'You already own this menu' }, corsHeaders, 400);
    }
    if ((menu.members || []).some((m) => m.userId === target.userId)) {
      return jsonResponse({ error: 'User already has access' }, corsHeaders, 409);
    }

    const members = Array.isArray(menu.members) ? [...menu.members] : [];
    members.push({
      userId: target.userId,
      username: target.username,
      email: target.email,
      role: 'member',
      addedAt: Date.now(),
    });
    const updated = { ...menu, members, updatedAt: Date.now() };
    await saveMenu(env, updated);
    await addPlatterMenuId(env, target.userId, menuId);
    await publishMenuSync(env, updated, readSyncClientId(request, body), [target.userId]);
    return jsonResponse({ menu: publicMenu(updated, userId), success: true }, corsHeaders);
  }

  if (path === '/api/platter/unshare' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, corsHeaders, 400);
    }
    const menuId = String(body.menuId || '').trim();
    const removeUserId = String(body.userId || '').trim();
    if (!menuId || !removeUserId) {
      return jsonResponse({ error: 'menuId and userId required' }, corsHeaders, 400);
    }

    const menu = await fetchMenu(env, menuId);
    if (!menu) return jsonResponse({ error: 'Menu not found' }, corsHeaders, 404);
    if (!userIsOwner(menu, userId)) {
      return jsonResponse({ error: 'Only the menu owner can remove members' }, corsHeaders, 403);
    }
    if (removeUserId === menu.ownerUserId) {
      return jsonResponse({ error: 'Cannot remove the menu owner' }, corsHeaders, 400);
    }

    const members = (menu.members || []).filter((m) => m.userId !== removeUserId);
    const updated = { ...menu, members, updatedAt: Date.now() };
    await saveMenu(env, updated);
    await removePlatterMenuId(env, removeUserId, menuId);
    await publishMenuSync(env, updated, readSyncClientId(request, body), [removeUserId]);
    return jsonResponse({ menu: publicMenu(updated, userId), success: true }, corsHeaders);
  }

  if (path === '/api/platter/leave' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, corsHeaders, 400);
    }
    const menuId = String(body.menuId || '').trim();
    if (!menuId) return jsonResponse({ error: 'menuId required' }, corsHeaders, 400);

    const menu = await fetchMenu(env, menuId);
    if (!menu || !userCanAccessMenu(menu, userId)) {
      return jsonResponse({ error: 'Menu not found' }, corsHeaders, 404);
    }
    if (userIsOwner(menu, userId)) {
      return jsonResponse({ error: 'Owners cannot leave their own menu' }, corsHeaders, 400);
    }

    const members = (menu.members || []).filter((m) => m.userId !== userId);
    const updated = { ...menu, members, updatedAt: Date.now() };
    await saveMenu(env, updated);
    await removePlatterMenuId(env, userId, menuId);
    await publishMenuSync(env, updated, readSyncClientId(request, body), [userId]);
    const boot = await ensureBootstrap(env, userId);
    return jsonResponse({ success: true, ...boot }, corsHeaders);
  }

  return null;
}

export class PlatterMenu {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/get' && request.method === 'GET') {
        const menu = await this.storage.get('menu');
        if (!menu) return jsonResponse({ error: 'Not found' }, {}, 404);
        return jsonResponse(menu, {});
      }
      if (path === '/save' && request.method === 'POST') {
        const menu = await request.json();
        await this.storage.put('menu', menu);
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
