import { handleLabOnlineRequest, onlineBoard } from './lab-online.js';
// Hero League — game history. Finished local games are kept per user in a
// HearthholdLobby Durable Object under their own name, so they never mix with the other games' history.
const LOCAL_ID_RE = /^hx[0-9a-f]{16}$/;
const MAX_BOARD_BYTES = 64 * 1024;
const SCORE_KEYS = ['total', 'cards', 'mission', 'done', 'blanked', 'bonus', 'penalty', 'base', 'plaza'];
const OPTIONAL_SCORE_KEYS = ['ident'];
const MAX_PLAYERS = 5;
const BOARD_VERSIONS = new Set([1]);
const LEVELS = new Set(['easy', 'normal', 'hard', 'brutal']);

function jsonResponse(body, corsHeaders, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function bearerSession(request) {
  const m = (request.headers.get('Authorization') || '').match(/^Bearer\s+(\S+)/i);
  return m ? m[1] : null;
}

async function sessionUserId(env, request) {
  const sessionId = bearerSession(request);
  if (!sessionId) return null;
  const session = env.SESSION.get(env.SESSION.idFromName(sessionId));
  const sres = await session.fetch(new Request('http://do/getUserId', { method: 'GET' }));
  const { userId } = await sres.json().catch(() => ({}));
  return userId || null;
}

function historyStub(env, userId) {
  return env.HEARTHHOLD_LOBBY.get(env.HEARTHHOLD_LOBBY.idFromName(`heroes:${userId}`));
}

const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);

function cleanCats(c) {
  if (!c || typeof c !== 'object') return null;
  const out = {};
  for (const k of SCORE_KEYS) {
    const v = int(c[k], -9999, 9999);
    if (v == null) return null;
    out[k] = v;
  }
  for (const k of OPTIONAL_SCORE_KEYS) {
    if (c[k] == null) continue;
    const v = int(c[k], -9999, 9999);
    if (v == null) return null;
    out[k] = v;
  }
  return out;
}

function historyItem(b) {
  if (!b || !LOCAL_ID_RE.test(String(b.id || ''))) return null;
  const kind = b.kind === 'ai' || b.kind === 'local' ? b.kind : null;
  const n = Array.isArray(b.names) ? b.names.length : 0;
  if (n < 2 || n > MAX_PLAYERS) return null;
  const names = b.names.map((x) => String(x || '').trim().slice(0, 18));
  const cats = Array.isArray(b.cats) && b.cats.length === n ? b.cats.map(cleanCats) : null;
  const winner = int(b.winner, -1, n - 1);
  if (!kind || names.some((x) => !x) || !cats || cats.some((c) => !c) || winner == null) return null;
  return { id: b.id, kind, at: Date.now(), names, cats, winner, me: kind === 'ai' ? 0 : null, level: kind === 'ai' && LEVELS.has(b.level) ? b.level : null };
}

// The finished table, so history can show it (the log goes if it's too big).
function cleanBoard(b) {
  if (!b || typeof b !== 'object' || !BOARD_VERSIONS.has(b.v) || b.phase !== 'over' || !Array.isArray(b.players) || b.players.length < 2 || b.players.length > MAX_PLAYERS) return null;
  if (JSON.stringify(b).length <= MAX_BOARD_BYTES) return b;
  const lean = { ...b, log: [] };
  return JSON.stringify(lean).length <= MAX_BOARD_BYTES ? lean : null;
}

export async function handleHeroesRequest(request, env, corsHeaders, path, opts = {}) {
  const online = await handleLabOnlineRequest(request, env, corsHeaders, path, 'heroes', opts);
  if (online) return online;
  if (!env.HEARTHHOLD_LOBBY) return jsonResponse({ error: 'Not available' }, corsHeaders, 503);
  const userId = await sessionUserId(env, request);
  if (!userId) return jsonResponse({ error: 'Not authenticated' }, corsHeaders, 401);
  const stub = historyStub(env, userId);
  const url = new URL(request.url);

  if (path === '/api/heroes/history' && request.method === 'GET') {
    const res = await stub.fetch(new Request('http://do/history'));
    return jsonResponse(await res.json(), corsHeaders);
  }
  if (path === '/api/heroes/history/board' && request.method === 'GET') {
    const gid = String(url.searchParams.get('id') || '');
    const online = await onlineBoard(env, 'heroes', gid, userId);
    if (online) return jsonResponse(online.body, corsHeaders, online.status);
    if (!LOCAL_ID_RE.test(gid)) return jsonResponse({ error: 'Game not found' }, corsHeaders, 404);
    const res = await stub.fetch(new Request(`http://do/board?id=${gid}`));
    return jsonResponse(await res.json(), corsHeaders, res.status);
  }
  if (path === '/api/heroes/history/record' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, corsHeaders, 400);
    }
    const item = historyItem(body);
    if (!item) return jsonResponse({ error: 'Invalid game record' }, corsHeaders, 400);
    const res = await stub.fetch(new Request('http://do/record', { method: 'POST', body: JSON.stringify({ item, board: cleanBoard(body.board) }) }));
    return jsonResponse(await res.json(), corsHeaders, res.status);
  }
  return jsonResponse({ error: 'Not found' }, corsHeaders, 404);
}
