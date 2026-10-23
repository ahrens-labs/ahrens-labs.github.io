import { repairMasqueradeHistory } from './masquerade.js';
// Board game lobby: every game the signed-in player has going, across all board games, in one request —
// online games from the lobby DOs plus cloud copies of local (vs computer / same device) games.

// Lobby DO names must match lobbyStub() in dino.js and hearthhold.js.
const LOBBIES = [
  { game: 'dino', binding: 'DINO_LOBBY' },
  { game: 'hearthhold', binding: 'HEARTHHOLD_LOBBY' },
  { game: null, binding: 'LAB_LOBBY', fromSummary: true },
];
const CURRENT = new Set(['pending', 'active']);

// Cloud saves of local games live in the player's UserAccount DO, outside the userData blob.
const SAVE_GAMES = new Set(['dino', 'hearthhold', 'atlantis', 'cauldron', 'heroes', 'masquerade']);
const SAVE_ID_RE = /^[a-z0-9]{4,40}$/i;
const SAVE_MAX_BYTES = 120 * 1024;
const SAVES_MAX_LIVE = 30;
const SAVE_OPS_MAX = 10;
const TOMBSTONE_MS = 365 * 86400000;
const INDEX_KEY = 'bgsIndex';
// Set once the player has seen the lobby's welcome tour (kept under the bgs prefix so account deletion clears it).
const INTRO_KEY = 'bgsIntroSeen';

// Ahrens Games settings live in the account (userData.gamesSettings) so the game servers see them too: turn
// reminder emails and challenge emails honour them. Only known keys and values are kept.
const REMINDER_DAYS = [1, 2, 3, 5, 7];
const REPLAY_SPEEDS = ['slow', 'normal', 'fast', 'off'];
function cleanGamesSettings(s) {
  const out = {};
  if (!s || typeof s !== 'object') return out;
  ['turnReminders', 'challengeEmails', 'tabAlerts'].forEach((k) => {
    if (typeof s[k] === 'boolean') out[k] = s[k];
  });
  if (REMINDER_DAYS.includes(Number(s.reminderDays))) out.reminderDays = Number(s.reminderDays);
  if (REPLAY_SPEEDS.includes(s.replaySpeed)) out.replaySpeed = s.replaySpeed;
  return out;
}
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
  if (Array.isArray(s.names)) out.names = s.names.slice(0, 5).map((n) => str(n, 24));
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
        game: l.fromSummary ? g.game : l.game,
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
  return lists.flat().filter((g) => g.game && SAVE_GAMES.has(g.game)).sort((a, b) => needsMe(b) - needsMe(a) || b.updatedAt - a.updatedAt);
}

async function savedGames(env, userId) {
  try {
    const res = await accountStub(env, userId).fetch(new Request('http://do/boardSaves/index'));
    const data = await res.json();
    return { saves: Object.values(data.index || {}), introSeen: !!data.introSeen, settings: data.settings || {} };
  } catch {
    return { saves: [], introSeen: true, settings: null };
  }
}

// ---------------------------------------------------------------- combined history

// Every game's finished-game history, in one request. Dino keeps its own lobby; Oakhaven keeps history in its
// lobby, and the other games keep theirs in a HearthholdLobby under their own name.
const HISTORY_SOURCES = [
  { game: 'dino', binding: 'DINO_LOBBY', name: (u) => `lobby:${u}`, path: '/history?limit=50' },
  { game: 'hearthhold', binding: 'HEARTHHOLD_LOBBY', name: (u) => `lobby:${u}`, path: '/history' },
  { game: 'atlantis', binding: 'HEARTHHOLD_LOBBY', name: (u) => `atlantis:${u}`, path: '/history' },
  { game: 'cauldron', binding: 'HEARTHHOLD_LOBBY', name: (u) => `cauldron:${u}`, path: '/history' },
  { game: 'heroes', binding: 'HEARTHHOLD_LOBBY', name: (u) => `heroes:${u}`, path: '/history' },
  { game: 'masquerade', binding: 'HEARTHHOLD_LOBBY', name: (u) => `masquerade:${u}`, path: '/history' },
];
const HISTORY_RETURN = 120;
const KINDS = new Set(['ai', 'local', 'online']);
const num = (v) => (Number.isFinite(v) ? v : null);
const str = (v, n) => String(v == null ? '' : v).slice(0, n);

function dinoRow(h) {
  if (!h || !KINDS.has(h.kind)) return null;
  const scores = [num(h.myScore), num(h.oppScore)];
  const names = h.kind === 'local' && Array.isArray(h.names) ? h.names.map((n) => str(n, 18)) : [null, str(h.opp || (h.kind === 'ai' ? 'Computer' : 'a player'), 18)];
  const winner = scores[0] == null || scores[1] == null ? null : scores[0] === scores[1] ? -1 : scores[0] > scores[1] ? 0 : 1;
  return {
    game: 'dino', id: str(h.id, 40), kind: h.kind, at: num(h.finishedAt) || 0, names, scores,
    me: h.kind === 'local' ? null : 0, winner, result: h.result || null, level: h.level || null, reason: h.reason || null,
    board: !!h.board, gameId: h.kind === 'online' && h.gameId ? str(h.gameId, 40) : null,
  };
}

function scoredRow(game, h) {
  if (!h || !KINDS.has(h.kind) || !Array.isArray(h.names)) return null;
  const scores = Array.isArray(h.cats) ? h.cats.map((c) => (c ? num(c.total) : null)) : h.names.map(() => null);
  const me = Number.isInteger(h.me) ? h.me : null;
  const winner = Number.isInteger(h.winner) ? h.winner : null;
  const result = me == null || winner == null ? null : winner < 0 ? 'tie' : winner === me ? 'win' : 'loss';
  return {
    game, id: str(h.id, 40), kind: h.kind, at: num(h.at) || 0, names: h.names.map((n) => str(n, 18)), scores,
    me, winner, result, level: h.level || null, reason: h.reason || null, ended: h.ended || null,
    // Online games keep their final board in the game's own record.
    board: !!h.board || h.kind === 'online',
  };
}

async function combinedHistory(env, userId) {
  const lists = await Promise.all(HISTORY_SOURCES.filter((s) => env[s.binding]).map(async (s) => {
    try {
      const ns = env[s.binding];
      const stub = ns.get(ns.idFromName(s.name(userId)));
      const res = await stub.fetch(new Request(`http://do${s.path}`));
      const data = await res.json();
      if (s.game === 'masquerade') data.items = await repairMasqueradeHistory(stub, data.items);
      const items = (data.items || []).map((h) => (s.game === 'dino' ? dinoRow(h) : scoredRow(s.game, h))).filter(Boolean);
      // Dino pages its history, so its totals come from its own stats.
      const st = s.game === 'dino' && data.stats ? data.stats : null;
      const rated = items.filter((h) => h.result);
      const stats = st
        ? { played: st.played || 0, wins: st.wins || 0, losses: st.losses || 0, ties: st.ties || 0 }
        : {
          played: items.length,
          wins: rated.filter((h) => h.result === 'win').length,
          losses: rated.filter((h) => h.result === 'loss').length,
          ties: rated.filter((h) => h.result === 'tie').length,
        };
      return { game: s.game, items, stats };
    } catch {
      return { game: s.game, items: [], stats: null };
    }
  }));
  const stats = {};
  lists.forEach((l) => { if (l.stats) stats[l.game] = l.stats; });
  const items = lists.flatMap((l) => l.items).sort((a, b) => b.at - a.at).slice(0, HISTORY_RETURN);
  return { items, stats };
}

export async function handleBoardGamesRequest(request, env, corsHeaders, path) {
  const userId = await userIdForSession(env, bearerSession(request));
  if (!userId) return jsonResponse({ error: 'Not authenticated' }, corsHeaders, 401);

  if (path === '/api/board-games/current' && request.method === 'GET') {
    const [games, { saves, introSeen, settings }] = await Promise.all([onlineGames(env, userId), savedGames(env, userId)]);
    return jsonResponse({ games, saves, introSeen, ...(settings ? { settings } : {}) }, corsHeaders);
  }

  if (path === '/api/board-games/settings') {
    if (request.method === 'GET') {
      const res = await accountStub(env, userId).fetch(new Request('http://do/boardSaves/settings'));
      return jsonResponse(await res.json().catch(() => ({ settings: {} })), corsHeaders);
    }
    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Bad JSON' }, corsHeaders, 400);
      }
      const res = await accountStub(env, userId).fetch(new Request('http://do/boardSaves/settings', { method: 'POST', body: JSON.stringify(cleanGamesSettings(body && body.settings)) }));
      return jsonResponse(await res.json().catch(() => ({ error: 'Could not save' })), corsHeaders, res.ok ? 200 : 500);
    }
  }

  if (path === '/api/board-games/intro-seen' && request.method === 'POST') {
    await accountStub(env, userId).fetch(new Request('http://do/boardSaves/intro', { method: 'POST' }));
    return jsonResponse({ ok: true }, corsHeaders);
  }

  if (path === '/api/board-games/history' && request.method === 'GET') {
    return jsonResponse(await combinedHistory(env, userId), corsHeaders);
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
    return jsonResponse({ ok: true, applied: data.applied || 0, removed: data.removed || [] }, corsHeaders);
  }

  return jsonResponse({ error: 'Not found' }, corsHeaders, 404);
}

// ---------------------------------------------------------------- UserAccount DO side

// Handles /boardSaves/* inside the UserAccount DO. Returns null for other paths.
export async function handleBoardSavesDO(storage, request, path) {
  if (!path.startsWith('/boardSaves/')) return null;
  const index = (await storage.get(INDEX_KEY)) || {};
  if (path === '/boardSaves/index') {
    const [intro, userData] = await Promise.all([storage.get(INTRO_KEY), storage.get('userData')]);
    return Response.json({ index, introSeen: !!intro, settings: cleanGamesSettings(userData && userData.gamesSettings) });
  }
  if (path === '/boardSaves/settings') {
    const userData = await storage.get('userData');
    if (!userData) return Response.json({ error: 'Account not found' }, { status: 404 });
    if (request.method === 'POST') {
      userData.gamesSettings = { ...cleanGamesSettings(userData.gamesSettings), ...cleanGamesSettings(await request.json()) };
      await storage.put('userData', userData);
    }
    return Response.json({ settings: cleanGamesSettings(userData.gamesSettings), email: !!userData.email, emailVerified: userData.emailVerified !== false });
  }
  if (path === '/boardSaves/intro' && request.method === 'POST') {
    await storage.put(INTRO_KEY, Date.now());
    return Response.json({ ok: true });
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
    // A removed game stays removed: a device that still has it open can't bring it back by saving.
    const removed = [];
    for (const o of ops || []) {
      const k = `${o.game}:${o.id}`;
      const cur = index[k];
      if (cur && cur.deleted) {
        if (o.op === 'put') removed.push({ game: o.game, id: o.id, updatedAt: cur.updatedAt, deleted: true });
        continue;
      }
      if (o.op === 'del') {
        index[k] = { game: o.game, id: o.id, updatedAt: Math.max(o.updatedAt, cur ? cur.updatedAt : 0), deleted: true };
        dels.push(bodyKey(o.game, o.id));
        delete puts[bodyKey(o.game, o.id)];
      } else {
        if (cur && cur.updatedAt > o.updatedAt) continue;
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
    return Response.json({ applied, removed });
  }
  return Response.json({ error: 'Not found' }, { status: 404 });
}

// Called when an account is deleted.
export async function deleteBoardSaves(storage) {
  const keys = [...(await storage.list({ prefix: 'bgs' })).keys()];
  for (let i = 0; i < keys.length; i += 128) await storage.delete(keys.slice(i, i + 128));
}
