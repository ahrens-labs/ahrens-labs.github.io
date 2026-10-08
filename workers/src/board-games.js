// Board game lobby: every game the signed-in player has going, across all board games, in one request —
// online games from the lobby DOs plus cloud copies of local (vs computer / same device) games.

// Lobby DO names must match lobbyStub() in dino.js and hearthhold.js.
const LOBBIES = [
  { game: 'dino', binding: 'DINO_LOBBY' },
  { game: 'hearthhold', binding: 'HEARTHHOLD_LOBBY' },
];
const CURRENT = new Set(['pending', 'active']);

// Cloud saves of local games live in the player's UserAccount DO, outside the userData blob.
const SAVE_GAMES = new Set(['dino', 'hearthhold']);
const SAVE_ID_RE = /^[a-z0-9]{4,40}$/i;
const SAVE_MAX_BYTES = 120 * 1024;
const SAVES_MAX_LIVE = 30;
const SAVE_OPS_MAX = 10;
const TOMBSTONE_MS = 60 * 86400000;
const INDEX_KEY = 'bgsIndex';
const bodyKey = (game, id) => `bgs:${game}:${id}`;

function jsonResponse(body, corsHeaders, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function bearerSession(request) {
  const m = (request.headers.get('Authorization') || '').match(/^Bearer\s+(\S+)/i);
  return m ? m[1] : null;
}

async function userIdForSession(env, sessionId) {
  if (!sessionId) return null;
  const session = env.SESSION.get(env.SESSION.idFromName(sessionId));
  const res = await session.fetch(new Request('http://do/getUserId', { method: 'GET' }));
  const data = await res.json().catch(() => ({}));
  return data.userId || null;
}

const needsMe = (g) => (g.status === 'pending' && g.me === 1) || (g.status === 'active' && g.turn === g.me);

function accountStub(env, userId) {
  return env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromName(userId));
}

// Only short display fields are kept in the index.
function cleanSummary(s) {
  const out = {};
  if (!s || typeof s !== 'object') return out;
  const str = (v, n) => String(v == null ? '' : v).slice(0, n);
  if (s.mode === 'ai' || s.mode === 'local') out.mode = s.mode;
  if (s.level) out.level = str(s.level, 12);
  if (Array.isArray(s.names)) out.names = s.names.slice(0, 2).map((n) => str(n, 24));
  if (Number.isFinite(s.round)) out.round = Math.max(0, Math.min(99, Math.floor(s.round)));
  if (Number.isFinite(s.rounds)) out.rounds = Math.max(0, Math.min(99, Math.floor(s.rounds)));
  out.moved = s.moved !== false;
  return out;
}

async function onlineGames(env, userId) {
  const lists = await Promise.all(LOBBIES.filter((l) => env[l.binding]).map(async (l) => {
    try {
      const ns = env[l.binding];
      const res = await ns.get(ns.idFromName(`lobby:${userId}`)).fetch(new Request('http://do/list'));
      const data = await res.json();
      return (data.games || []).filter((g) => CURRENT.has(g.status)).map((g) => ({
        game: l.game,
        id: g.id,
        status: g.status,
        me: g.me,
        opp: g.opp,
        turn: g.turn,
        mode: g.mode || 'long',
        deadline: g.deadline || null,
        round: g.round || 0,
        updatedAt: g.updatedAt || 0,
      }));
    } catch {
      return [];
    }
  }));
  return lists.flat().sort((a, b) => needsMe(b) - needsMe(a) || b.updatedAt - a.updatedAt);
}

async function savedGames(env, userId) {
  try {
    const res = await accountStub(env, userId).fetch(new Request('http://do/boardSaves/index'));
    const data = await res.json();
    return Object.values(data.index || {});
  } catch {
    return [];
  }
}

export async function handleBoardGamesRequest(request, env, corsHeaders, path) {
  const userId = await userIdForSession(env, bearerSession(request));
  if (!userId) return jsonResponse({ error: 'Not authenticated' }, corsHeaders, 401);

  if (path === '/api/board-games/current' && request.method === 'GET') {
    const [games, saves] = await Promise.all([onlineGames(env, userId), savedGames(env, userId)]);
    return jsonResponse({ games, saves }, corsHeaders);
  }

  if (path === '/api/board-games/save' && request.method === 'GET') {
    const url = new URL(request.url);
    const game = url.searchParams.get('game') || '';
    const id = url.searchParams.get('id') || '';
    if (!SAVE_GAMES.has(game) || !SAVE_ID_RE.test(id)) return jsonResponse({ error: 'Bad game' }, corsHeaders, 400);
    const res = await accountStub(env, userId).fetch(new Request(`http://do/boardSaves/get?game=${game}&id=${id}`));
    const data = await res.json().catch(() => ({}));
    if (!data.save) return jsonResponse({ error: 'Not found' }, corsHeaders, 404);
    return jsonResponse(data, corsHeaders);
  }

  if (path === '/api/board-games/saves' && request.method === 'POST') {
    const text = await request.text();
    if (text.length > SAVE_OPS_MAX * SAVE_MAX_BYTES) return jsonResponse({ error: 'Too big' }, corsHeaders, 413);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return jsonResponse({ error: 'Bad JSON' }, corsHeaders, 400);
    }
    const ops = [];
    for (const o of (Array.isArray(body && body.ops) ? body.ops : []).slice(0, SAVE_OPS_MAX)) {
      if (!o || !SAVE_GAMES.has(o.game) || !SAVE_ID_RE.test(String(o.id || ''))) continue;
      const updatedAt = Math.min(Number(o.updatedAt) || Date.now(), Date.now() + 60000);
      if (o.op === 'del') ops.push({ op: 'del', game: o.game, id: o.id, updatedAt });
      else if (o.op === 'put' && o.save && typeof o.save === 'object') {
        if (JSON.stringify(o.save).length > SAVE_MAX_BYTES) continue;
        ops.push({ op: 'put', game: o.game, id: o.id, updatedAt, save: o.save, summary: cleanSummary(o.summary) });
      }
    }
    if (!ops.length) return jsonResponse({ ok: true, applied: 0 }, corsHeaders);
    const res = await accountStub(env, userId).fetch(new Request('http://do/boardSaves/apply', { method: 'POST', body: JSON.stringify({ ops }) }));
    const data = await res.json().catch(() => ({}));
    return jsonResponse({ ok: true, applied: data.applied || 0 }, corsHeaders);
  }

  return jsonResponse({ error: 'Not found' }, corsHeaders, 404);
}

// ---------------------------------------------------------------- UserAccount DO side

// Handles /boardSaves/* inside the UserAccount DO. Returns null for other paths.
export async function handleBoardSavesDO(storage, request, path) {
  if (!path.startsWith('/boardSaves/')) return null;
  const index = (await storage.get(INDEX_KEY)) || {};
  if (path === '/boardSaves/index') {
    return Response.json({ index });
  }
  if (path === '/boardSaves/get') {
    const url = new URL(request.url);
    const game = url.searchParams.get('game');
    const id = url.searchParams.get('id');
    const meta = index[`${game}:${id}`];
    if (!meta || meta.deleted) return Response.json({});
    const save = await storage.get(bodyKey(game, id));
    return Response.json(save ? { save, summary: meta.summary, updatedAt: meta.updatedAt } : {});
  }
  if (path === '/boardSaves/apply' && request.method === 'POST') {
    const { ops } = await request.json();
    let applied = 0;
    const puts = {};
    const dels = [];
    for (const o of ops || []) {
      const k = `${o.game}:${o.id}`;
      const cur = index[k];
      if (cur && cur.updatedAt > o.updatedAt) continue;
      if (o.op === 'del') {
        index[k] = { game: o.game, id: o.id, updatedAt: o.updatedAt, deleted: true };
        dels.push(bodyKey(o.game, o.id));
        delete puts[bodyKey(o.game, o.id)];
      } else {
        index[k] = { game: o.game, id: o.id, updatedAt: o.updatedAt, summary: o.summary };
        puts[bodyKey(o.game, o.id)] = o.save;
      }
      applied++;
    }
    // Keep the newest live saves and recent deletions (so other devices hear about them).
    const now = Date.now();
    const live = Object.values(index).filter((m) => !m.deleted).sort((a, b) => b.updatedAt - a.updatedAt);
    live.slice(SAVES_MAX_LIVE).forEach((m) => {
      index[`${m.game}:${m.id}`] = { game: m.game, id: m.id, updatedAt: now, deleted: true };
      dels.push(bodyKey(m.game, m.id));
      delete puts[bodyKey(m.game, m.id)];
    });
    Object.keys(index).forEach((k) => {
      if (index[k].deleted && now - index[k].updatedAt > TOMBSTONE_MS) delete index[k];
    });
    if (Object.keys(puts).length) await storage.put(puts);
    if (dels.length) await storage.delete(dels);
    await storage.put(INDEX_KEY, index);
    return Response.json({ applied });
  }
  return Response.json({ error: 'Not found' }, { status: 404 });
}

// Called when an account is deleted.
export async function deleteBoardSaves(storage) {
  const keys = [...(await storage.list({ prefix: 'bgs' })).keys()];
  for (let i = 0; i < keys.length; i += 128) await storage.delete(keys.slice(i, i + 128));
}
