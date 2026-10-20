import { handleLabOnlineRequest, onlineBoard } from './lab-online.js';
import Masquerade from '../../js/masquerade-engine.js';
// The Masquerade Court — game history. Finished local games are kept per user in a
// HearthholdLobby Durable Object under their own name, so they never mix with the other games' history.
const LOCAL_ID_RE = /^mq[0-9a-f]{16}$/;
const MAX_BOARD_BYTES = 64 * 1024;
const SCORE_KEYS = ['total', 'favor', 'ducats', 'masks', 'out'];
const OPTIONAL_SCORE_KEYS = [];
const MAX_PLAYERS = 5;
const BOARD_VERSIONS = new Set([1]);
const LEVELS = new Set(['easy', 'normal', 'hard', 'brutal']);
const ENDINGS = new Set(['favor', 'last']);

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
  return env.HEARTHHOLD_LOBBY.get(env.HEARTHHOLD_LOBBY.idFromName(`masquerade:${userId}`));
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
  // Seats are drawn at random, so the browser says which seat was the person's; a ball is won by Favor or by being
  // the last noble masked, so the finishing order comes from the game, not from the scores.
  const me = kind === 'ai' ? int(b.me, 0, n - 1) : null;
  const order = Array.isArray(b.order) && b.order.length === n && new Set(b.order).size === n && b.order.every((i) => Number.isInteger(i) && i >= 0 && i < n) ? b.order : null;
  return {
    id: b.id, kind, at: Date.now(), names, cats, winner, me: kind === 'ai' ? (me == null ? 0 : me) : null,
    ended: ENDINGS.has(b.ended) ? b.ended : null, order, level: kind === 'ai' && LEVELS.has(b.level) ? b.level : null,
  };
}

// Rows saved before seats were shuffled (and before the order was kept) are worked out again from their final
// boards, once: one read for all the boards and one write for the fixes.
export async function repairMasqueradeHistory(stub, items) {
  const todo = (items || []).filter((h) => (h.kind === 'ai' || h.kind === 'local') && !h.fixed);
  if (!todo.length) return items;
  const res = await stub.fetch(new Request('http://do/boards', { method: 'POST', body: JSON.stringify({ ids: todo.filter((h) => h.board).map((h) => h.id) }) }));
  const { boards = {} } = await res.json().catch(() => ({}));
  const patches = todo.map((h) => {
    const b = boards[h.id];
    if (!b || !Array.isArray(b.players) || b.players.length !== h.names.length || b.phase !== 'over') return { id: h.id, fields: { fixed: 1 } };
    const me = h.kind === 'ai' ? b.players.findIndex((p) => !p.ai) : null;
    return { id: h.id, fields: { fixed: 1, me: me < 0 ? h.me : me, winner: Masquerade.winner(b), ended: ENDINGS.has(b.ended) ? b.ended : null, order: Masquerade.ranking(b) } };
  });
  const out = await stub.fetch(new Request('http://do/patch', { method: 'POST', body: JSON.stringify({ patches }) }));
  return ((await out.json().catch(() => ({}))).items) || items;
}

// The finished ballroom, so history can show it (the log goes if it's too big).
function cleanBoard(b) {
  if (!b || typeof b !== 'object' || !BOARD_VERSIONS.has(b.v) || b.phase !== 'over' || !Array.isArray(b.players) || b.players.length < 2 || b.players.length > MAX_PLAYERS) return null;
  if (JSON.stringify(b).length <= MAX_BOARD_BYTES) return b;
  const lean = { ...b, log: [] };
  return JSON.stringify(lean).length <= MAX_BOARD_BYTES ? lean : null;
}

export async function handleMasqueradeRequest(request, env, corsHeaders, path, opts = {}) {
  const online = await handleLabOnlineRequest(request, env, corsHeaders, path, 'masquerade', opts);
  if (online) return online;
  if (!env.HEARTHHOLD_LOBBY) return jsonResponse({ error: 'Not available' }, corsHeaders, 503);
  const userId = await sessionUserId(env, request);
  if (!userId) return jsonResponse({ error: 'Not authenticated' }, corsHeaders, 401);
  const stub = historyStub(env, userId);
  const url = new URL(request.url);

  if (path === '/api/masquerade/history' && request.method === 'GET') {
    const res = await stub.fetch(new Request('http://do/history'));
    const data = await res.json();
    return jsonResponse({ ...data, items: await repairMasqueradeHistory(stub, data.items) }, corsHeaders);
  }
  if (path === '/api/masquerade/history/board' && request.method === 'GET') {
    const gid = String(url.searchParams.get('id') || '');
    const online = await onlineBoard(env, 'masquerade', gid, userId);
    if (online) return jsonResponse(online.body, corsHeaders, online.status);
    if (!LOCAL_ID_RE.test(gid)) return jsonResponse({ error: 'Game not found' }, corsHeaders, 404);
    const res = await stub.fetch(new Request(`http://do/board?id=${gid}`));
    return jsonResponse(await res.json(), corsHeaders, res.status);
  }
  if (path === '/api/masquerade/history/record' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, corsHeaders, 400);
    }
    const item = historyItem(body);
    if (item) item.fixed = 1;
    if (!item) return jsonResponse({ error: 'Invalid game record' }, corsHeaders, 400);
    const res = await stub.fetch(new Request('http://do/record', { method: 'POST', body: JSON.stringify({ item, board: cleanBoard(body.board) }) }));
    return jsonResponse(await res.json(), corsHeaders, res.status);
  }
  return jsonResponse({ error: 'Not found' }, corsHeaders, 404);
}
