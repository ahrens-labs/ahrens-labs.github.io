// Dino Board Game — online games between Ahrens Labs accounts.
// DinoGame (one Durable Object per game) holds the shared game state, turn clock and live sockets.
// DinoLobby (one per user) holds small summaries so the game list is a single read.
// The rules engine runs in the browser; the server enforces who may move, version order and the turn clock.

const QUICK_TURN_MS = 2 * 60 * 1000;
// Extra time before a quick-game forfeit: the timed-out player's browser auto-finishes the turn first.
const QUICK_FORFEIT_GRACE_MS = 30 * 1000;
// The challenger may not be watching when a quick game is accepted, so the first turn is longer.
const QUICK_FIRST_TURN_MS = 5 * 60 * 1000;
const PENDING_TTL_MS = { quick: 24 * 60 * 60 * 1000, long: 7 * 24 * 60 * 60 * 1000 };
const MAX_STATE_BYTES = 400 * 1024;
const MAX_PENDING_OUT = 5;
const MAX_OPEN_GAMES = 20;
const LOBBY_KEEP_FINISHED = 10;
const HISTORY_MAX = 500;
const HISTORY_PAGE_MAX = 50;
const MAX_BOARD_BYTES = 64 * 1024;
const LOCAL_ID_RE = /^g[0-9a-z]{6,30}$/;
// Bump with RULES_VERSION in js/dino-board-game.js so tabs still running old rules can't move in online games.
const RULES_VERSION = 9;
const LEVELS = new Set(['easy', 'medium', 'hard']);
const MODES = new Set(['quick', 'long']);

function jsonResponse(body, corsHeaders, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  return e.includes('@') ? e : '';
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function generateUserId(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash) + email.charCodeAt(i);
    hash = hash & hash;
  }
  return `user_${Math.abs(hash)}`;
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

async function fetchProfile(env, userId) {
  try {
    const account = env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromName(userId));
    const res = await account.fetch(new Request('http://do/getData', { method: 'GET' }));
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || (!data.username && !data.email)) return null;
    return {
      userId,
      username: String(data.username || 'Player').slice(0, 40),
      email: normalizeEmail(data.email || ''),
      emailVerified: data.emailVerified !== false,
    };
  } catch {
    return null;
  }
}

async function resolveOpponent(env, raw) {
  const value = String(raw || '').trim();
  if (!value) return { error: 'Enter a username or email', status: 400 };
  let userId = '';
  if (value.includes('@')) {
    const email = normalizeEmail(value);
    if (!email) return { error: 'Invalid email', status: 400 };
    userId = generateUserId(email);
  } else {
    const username = normalizeUsername(value);
    if (!username) return { error: 'Invalid username', status: 400 };
    const registry = env.USERNAME_REGISTRY.get(env.USERNAME_REGISTRY.idFromName('global'));
    const res = await registry.fetch(new Request('http://do/resolve', { method: 'POST', body: JSON.stringify({ username }) }));
    const data = await res.json().catch(() => ({}));
    if (!data.success || !data.userId) return { error: 'No Ahrens Labs user with that name', status: 404 };
    userId = data.userId;
  }
  const profile = await fetchProfile(env, userId);
  if (!profile) return { error: 'No Ahrens Labs user with that name', status: 404 };
  return { profile };
}

function gameStub(env, id) {
  return env.DINO_GAME.get(env.DINO_GAME.idFromName(`game:${id}`));
}

function lobbyStub(env, userId) {
  return env.DINO_LOBBY.get(env.DINO_LOBBY.idFromName(`lobby:${userId}`));
}

function newGameId() {
  return 'dg' + crypto.randomUUID().replace(/-/g, '').slice(0, 18);
}

/** Player index whose input the game is waiting for (mirrors the client's onlineOwner). */
export function dinoTurnOwner(state) {
  const T = state && Array.isArray(state.queue) ? state.queue[0] : null;
  if (!T || T.t === 'gameOver') return null;
  if (T.p === 0 || T.p === 1) return T.p;
  const first = state.first === 1 ? 1 : 0;
  if (T.t === 'roundStart' && !state.proto) {
    const picks = T.picks || {};
    for (const q of [first, 1 - first]) {
      const need = (state.players[q] && state.players[q].bonusPending) || 0;
      if (need && !(Array.isArray(picks[q]) && picks[q].length >= need)) return q;
    }
  }
  return first;
}

function validState(state) {
  if (!state || typeof state !== 'object' || state.v !== 1) return false;
  if (!Array.isArray(state.players) || state.players.length !== 2) return false;
  if (!Array.isArray(state.queue)) return false;
  return JSON.stringify(state).length <= MAX_STATE_BYTES;
}

function cleanScores(scores) {
  if (!Array.isArray(scores) || scores.length !== 2) return null;
  const s = scores.map((n) => Math.max(0, Math.min(999, Math.round(Number(n) || 0))));
  return s;
}

function summaryFor(record, me) {
  const opp = record.players[1 - me];
  const st = record.state;
  return {
    id: record.id,
    mode: record.mode,
    status: record.status,
    me,
    opp: opp ? opp.username : '',
    turn: record.turn,
    deadline: record.deadline || null,
    round: st ? st.round : 0,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    result: record.result || null,
  };
}

function viewFor(record, me, extra) {
  return {
    id: record.id,
    mode: record.mode,
    status: record.status,
    me,
    players: record.players.map((p) => p.username),
    version: record.version,
    turn: record.turn,
    deadline: record.deadline || null,
    result: record.result || null,
    serverNow: Date.now(),
    ...(extra || {}),
  };
}

// History rows are the same shape for online, vs-computer and same-device games.
function onlineHistoryItem(s) {
  const r = s.result || {};
  const scores = Array.isArray(r.scores) ? r.scores : null;
  return {
    id: s.id,
    kind: 'online',
    mode: s.mode,
    gameId: s.id,
    opp: s.opp,
    result: r.winner == null ? 'tie' : r.winner === s.me ? 'win' : 'loss',
    reason: r.reason || 'finished',
    myScore: scores ? scores[s.me] : null,
    oppScore: scores ? scores[1 - s.me] : null,
    finishedAt: s.updatedAt,
  };
}

function cleanName(n, fallback) {
  return String(n || '').replace(/\s+/g, ' ').trim().slice(0, 18) || fallback;
}

// Finished vs-computer / same-device game, kept so history can show the final boards.
function cleanBoard(board) {
  if (!board || typeof board !== 'object' || board.v !== 1) return null;
  if (!Array.isArray(board.players) || board.players.length !== 2 || !Array.isArray(board.queue)) return null;
  if (!board.queue[0] || board.queue[0].t !== 'gameOver') return null;
  const snap = { ...board, log: [] };
  return JSON.stringify(snap).length <= MAX_BOARD_BYTES ? snap : null;
}

function localHistoryItem(body) {
  const id = String(body.gid || '');
  if (!LOCAL_ID_RE.test(id)) return null;
  const kind = body.kind === 'ai' ? 'ai' : body.kind === 'local' ? 'local' : null;
  const scores = cleanScores(body.scores);
  if (!kind || !scores) return null;
  const names = Array.isArray(body.names) ? body.names : [];
  const item = { id, kind, myScore: scores[0], oppScore: scores[1], reason: 'finished', finishedAt: Date.now() };
  if (kind === 'ai') {
    item.level = LEVELS.has(body.level) ? body.level : 'medium';
    item.opp = 'Computer';
    item.result = scores[0] === scores[1] ? 'tie' : scores[0] > scores[1] ? 'win' : 'loss';
  } else {
    item.names = [cleanName(names[0], 'Red'), cleanName(names[1], 'Blue')];
    item.opp = item.names[1];
    item.result = null;
  }
  return item;
}

function historyStats(items) {
  const rated = items.filter((h) => h.result);
  const scored = items.filter((h) => h.kind !== 'local' && typeof h.myScore === 'number');
  const count = (f) => rated.filter(f).length;
  return {
    played: items.length,
    wins: count((h) => h.result === 'win'),
    losses: count((h) => h.result === 'loss'),
    ties: count((h) => h.result === 'tie'),
    online: { wins: count((h) => h.kind === 'online' && h.result === 'win'), played: count((h) => h.kind === 'online') },
    ai: { wins: count((h) => h.kind === 'ai' && h.result === 'win'), played: count((h) => h.kind === 'ai') },
    best: scored.length ? Math.max(...scored.map((h) => h.myScore)) : null,
    avg: scored.length ? Math.round(scored.reduce((t, h) => t + h.myScore, 0) / scored.length) : null,
  };
}

// ---------------------------------------------------------------- Worker routes

export async function handleDinoRequest(request, env, corsHeaders, path, { executionCtx, notifyChallenge } = {}) {
  if (!env.DINO_GAME || !env.DINO_LOBBY) {
    return jsonResponse({ error: 'Online play is not available yet' }, corsHeaders, 503);
  }
  const url = new URL(request.url);

  if (path === '/api/dino/live') {
    const userId = await userIdForSession(env, String(url.searchParams.get('session') || '').trim() || null);
    if (!userId) return jsonResponse({ error: 'Not authenticated' }, corsHeaders, 401);
    if (request.headers.get('Upgrade') !== 'websocket') return jsonResponse({ error: 'Expected WebSocket upgrade' }, corsHeaders, 426);
    const id = String(url.searchParams.get('id') || '').trim();
    if (!/^dg[0-9a-f]{18}$/.test(id)) return jsonResponse({ error: 'Game not found' }, corsHeaders, 404);
    const headers = new Headers(request.headers);
    headers.set('X-Dino-User', userId);
    return gameStub(env, id).fetch(new Request('http://do/live', { method: 'GET', headers }));
  }

  const userId = await userIdForSession(env, bearerSession(request));
  if (!userId) return jsonResponse({ error: 'Not authenticated' }, corsHeaders, 401);

  if (path === '/api/dino/games' && request.method === 'GET') {
    const res = await lobbyStub(env, userId).fetch(new Request('http://do/list'));
    return jsonResponse(await res.json(), corsHeaders);
  }

  if (path === '/api/dino/history' && request.method === 'GET') {
    const q = new URLSearchParams({ offset: url.searchParams.get('offset') || '0', limit: url.searchParams.get('limit') || '30', kind: url.searchParams.get('kind') || '' });
    const res = await lobbyStub(env, userId).fetch(new Request(`http://do/history?${q}`));
    return jsonResponse(await res.json(), corsHeaders);
  }

  if (path === '/api/dino/history/board' && request.method === 'GET') {
    const gid = String(url.searchParams.get('id') || '');
    if (!LOCAL_ID_RE.test(gid)) return jsonResponse({ error: 'Game not found' }, corsHeaders, 404);
    const res = await lobbyStub(env, userId).fetch(new Request(`http://do/board?id=${gid}`));
    return jsonResponse(await res.json(), corsHeaders, res.status);
  }

  let body = {};
  if (request.method === 'POST') {
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, corsHeaders, 400);
    }
  }
  const id = String(body.id || url.searchParams.get('id') || '').trim();

  if (path === '/api/dino/challenge' && request.method === 'POST') {
    const mode = MODES.has(body.mode) ? body.mode : 'long';
    const [me, target, lobbyRes] = await Promise.all([
      fetchProfile(env, userId),
      resolveOpponent(env, body.opponent),
      lobbyStub(env, userId).fetch(new Request('http://do/list')),
    ]);
    if (!me) return jsonResponse({ error: 'Account not found' }, corsHeaders, 404);
    if (target.error) return jsonResponse({ error: target.error }, corsHeaders, target.status);
    const opp = target.profile;
    if (opp.userId === userId) return jsonResponse({ error: 'You can’t challenge yourself' }, corsHeaders, 400);
    const games = ((await lobbyRes.json()).games || []);
    const open = games.filter((g) => g.status === 'pending' || g.status === 'active');
    if (open.length >= MAX_OPEN_GAMES) return jsonResponse({ error: `You already have ${MAX_OPEN_GAMES} open games` }, corsHeaders, 429);
    if (open.filter((g) => g.status === 'pending' && g.me === 0).length >= MAX_PENDING_OUT) {
      return jsonResponse({ error: 'Too many challenges waiting for an answer' }, corsHeaders, 429);
    }
    if (open.some((g) => g.status === 'pending' && g.opp.toLowerCase() === opp.username.toLowerCase())) {
      return jsonResponse({ error: `You already have a challenge open with ${opp.username}` }, corsHeaders, 409);
    }
    const gameId = newGameId();
    const res = await gameStub(env, gameId).fetch(new Request('http://do/create', {
      method: 'POST',
      body: JSON.stringify({
        id: gameId,
        mode,
        players: [{ userId, username: me.username }, { userId: opp.userId, username: opp.username }],
      }),
    }));
    if (!res.ok) return jsonResponse({ error: 'Could not create the game' }, corsHeaders, 500);
    const created = await res.json();
    if (notifyChallenge && opp.email && opp.emailVerified) {
      const send = notifyChallenge({ to: opp.email, recipientName: opp.username, challengerName: me.username, mode, gameId });
      if (executionCtx && executionCtx.waitUntil) executionCtx.waitUntil(Promise.resolve(send).catch(() => {}));
    }
    return jsonResponse({ success: true, game: created.summary }, corsHeaders);
  }

  if (path === '/api/dino/history/record' && request.method === 'POST') {
    const item = localHistoryItem(body);
    if (!item) return jsonResponse({ error: 'Invalid game record' }, corsHeaders, 400);
    const board = cleanBoard(body.board);
    const res = await lobbyStub(env, userId).fetch(new Request('http://do/record', { method: 'POST', body: JSON.stringify({ item, board }) }));
    return jsonResponse(await res.json(), corsHeaders, res.status);
  }

  if (!/^dg[0-9a-f]{18}$/.test(id)) return jsonResponse({ error: 'Game not found' }, corsHeaders, 404);
  const stub = gameStub(env, id);
  const forward = async (op, payload) => {
    const res = await stub.fetch(new Request(`http://do/${op}`, {
      method: 'POST',
      body: JSON.stringify({ ...payload, userId }),
    }));
    return jsonResponse(await res.json(), corsHeaders, res.status);
  };

  if (path === '/api/dino/game' && request.method === 'GET') return forward('get', { since: Number(url.searchParams.get('v')) || 0 });
  if (path === '/api/dino/respond' && request.method === 'POST') return forward('respond', { accept: body.accept === true, state: body.state });
  if (path === '/api/dino/move' && request.method === 'POST') return forward('move', { base: body.base, rules: body.rules, state: body.state, scores: body.scores });
  if (path === '/api/dino/resign' && request.method === 'POST') return forward('resign', {});

  return jsonResponse({ error: 'Not found' }, corsHeaders, 404);
}

// ---------------------------------------------------------------- Durable Objects

export class DinoGame {
  constructor(state, env) {
    this.ctx = state;
    this.env = env;
    this.storage = state.storage;
  }

  async load() {
    if (!this.record) this.record = (await this.storage.get('game')) || null;
    return this.record;
  }

  async persist(record) {
    record.updatedAt = Date.now();
    this.record = record;
    await this.storage.put('game', record);
  }

  async publishLobbies(record) {
    await Promise.all(record.players.map((p, i) =>
      lobbyStub(this.env, p.userId)
        .fetch(new Request('http://do/upsert', { method: 'POST', body: JSON.stringify(summaryFor(record, i)) }))
        .catch(() => {})
    ));
  }

  broadcast(record, by, skip) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === skip) continue;
      const [uid] = this.ctx.getTags(ws);
      const me = record.players.findIndex((p) => p.userId === uid);
      if (me < 0) continue;
      try {
        ws.send(JSON.stringify({ type: 'state', by, ...viewFor(record, me, { state: record.state }) }));
      } catch {
        /* closed socket */
      }
    }
  }

  playerIndex(record, userId) {
    return record ? record.players.findIndex((p) => p.userId === userId) : -1;
  }

  async scheduleAlarm(record) {
    if (record.status === 'pending') await this.storage.setAlarm(record.createdAt + PENDING_TTL_MS[record.mode]);
    else if (record.status === 'active' && record.deadline) await this.storage.setAlarm(record.deadline + QUICK_FORFEIT_GRACE_MS);
    else await this.storage.deleteAlarm();
  }

  async finish(record, winner, reason, scores) {
    record.status = 'over';
    record.turn = null;
    record.deadline = null;
    record.result = { winner, reason, scores: scores || null };
  }

  async fetch(request) {
    const url = new URL(request.url);
    const op = url.pathname.slice(1);

    if (op === 'live') {
      const record = await this.load();
      const userId = request.headers.get('X-Dino-User') || '';
      const me = this.playerIndex(record, userId);
      if (me < 0) return new Response('Not found', { status: 404 });
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server, [userId]);
      server.send(JSON.stringify({ type: 'state', by: null, ...viewFor(record, me, { state: record.state }) }));
      return new Response(null, { status: 101, webSocket: client });
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      /* empty */
    }

    if (op === 'create') {
      if (await this.load()) return Response.json({ error: 'exists' }, { status: 409 });
      const now = Date.now();
      const record = {
        id: body.id,
        mode: body.mode,
        status: 'pending',
        players: body.players,
        createdAt: now,
        updatedAt: now,
        version: 0,
        state: null,
        turn: null,
        deadline: null,
        result: null,
      };
      await this.persist(record);
      await this.scheduleAlarm(record);
      await this.publishLobbies(record);
      return Response.json({ summary: summaryFor(record, 0) });
    }

    const record = await this.load();
    const me = this.playerIndex(record, body.userId);
    if (me < 0) return Response.json({ error: 'Game not found' }, { status: 404 });

    if (op === 'get') {
      if (body.since && body.since === record.version) return Response.json(viewFor(record, me, { unchanged: true }));
      return Response.json(viewFor(record, me, { state: record.state }));
    }

    if (op === 'respond') {
      if (record.status !== 'pending') return Response.json({ error: 'This challenge is no longer open', ...viewFor(record, me) }, { status: 409 });
      if (me !== 1) return Response.json({ error: 'Only the challenged player can answer' }, { status: 403 });
      if (!body.accept) {
        record.status = 'declined';
      } else {
        if (!validState(body.state)) return Response.json({ error: 'Invalid game' }, { status: 400 });
        const state = body.state;
        state.players.forEach((P, i) => { P.name = record.players[i].username.slice(0, 18); });
        state.ai = null;
        state.aiCfg = null;
        record.state = state;
        record.status = 'active';
        record.version = 1;
        record.turn = dinoTurnOwner(state);
        record.deadline = record.mode === 'quick' ? Date.now() + QUICK_FIRST_TURN_MS : null;
      }
      await this.persist(record);
      await this.scheduleAlarm(record);
      await this.publishLobbies(record);
      this.broadcast(record, me);
      return Response.json(viewFor(record, me, { state: record.state }));
    }

    if (op === 'resign') {
      if (record.status === 'pending') record.status = me === 0 ? 'cancelled' : 'declined';
      else if (record.status === 'active') await this.finish(record, 1 - me, 'resign');
      else return Response.json({ error: 'This game is already over', ...viewFor(record, me) }, { status: 409 });
      await this.persist(record);
      await this.scheduleAlarm(record);
      await this.publishLobbies(record);
      this.broadcast(record, me);
      return Response.json(viewFor(record, me));
    }

    if (op === 'move') {
      const out = await this.applyMove(record, me, body);
      return Response.json(out.body, { status: out.status });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  async applyMove(record, me, body, socket) {
    if (record.status !== 'active') return { status: 409, body: { error: 'This game is not in progress', ...viewFor(record, me, { state: record.state }) } };
    if (record.turn !== me) return { status: 409, body: { error: 'It’s not your turn', ...viewFor(record, me, { state: record.state }) } };
    if ((Number(body.rules) || 1) < RULES_VERSION) {
      return { status: 409, body: { error: 'The game rules were updated. Reload the page to keep playing.', ...viewFor(record, me, { state: record.state }) } };
    }
    if (Number(body.base) !== record.version) return { status: 409, body: { error: 'Out of date', ...viewFor(record, me, { state: record.state }) } };
    if (!validState(body.state)) return { status: 400, body: { error: 'Invalid game' } };
    const state = body.state;
    state.players.forEach((P, i) => { P.name = record.players[i].username.slice(0, 18); });
    state.ai = null;
    state.aiCfg = null;
    const prevTurn = record.turn;
    record.state = state;
    record.version += 1;
    record.turn = dinoTurnOwner(state);
    const over = state.queue[0] && state.queue[0].t === 'gameOver';
    if (over) {
      const scores = cleanScores(body.scores);
      const winner = scores ? (scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1) : null;
      await this.finish(record, winner, 'finished', scores);
    } else if (record.turn !== prevTurn) {
      record.deadline = record.mode === 'quick' ? Date.now() + QUICK_TURN_MS : null;
    }
    const handoff = over || record.turn !== prevTurn;
    await this.persist(record);
    if (handoff) {
      await this.scheduleAlarm(record);
      await this.publishLobbies(record);
    }
    this.broadcast(record, me, socket);
    return { status: 200, body: viewFor(record, me) };
  }

  async webSocketMessage(ws, message) {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
    if (text === 'ping') {
      try { ws.send('pong'); } catch { /* closed */ }
      return;
    }
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (!msg || msg.type !== 'move') return;
    const record = await this.load();
    const [uid] = this.ctx.getTags(ws);
    const me = this.playerIndex(record, uid);
    if (me < 0) return;
    const out = await this.applyMove(record, me, msg, ws);
    try {
      ws.send(JSON.stringify(out.status === 200 ? { type: 'ack', ...out.body } : { type: 'reject', ...out.body }));
    } catch {
      /* closed */
    }
  }

  async webSocketClose(ws, code, reason) {
    try { ws.close(code, reason); } catch { /* already closed */ }
  }

  async alarm() {
    const record = await this.load();
    if (!record) return;
    const now = Date.now();
    if (record.status === 'pending' && now >= record.createdAt + PENDING_TTL_MS[record.mode] - 1000) {
      record.status = 'expired';
    } else if (record.status === 'active' && record.deadline && now >= record.deadline + QUICK_FORFEIT_GRACE_MS - 1000) {
      await this.finish(record, 1 - record.turn, 'timeout');
    } else {
      await this.scheduleAlarm(record);
      return;
    }
    await this.persist(record);
    await this.scheduleAlarm(record);
    await this.publishLobbies(record);
    this.broadcast(record, null);
  }
}

export class DinoLobby {
  constructor(state, env) {
    this.storage = state.storage;
  }

  async loadHistory(games) {
    let history = await this.storage.get('history');
    if (!history) {
      history = Object.values(games || (await this.storage.get('games')) || {})
        .filter((g) => g.status === 'over')
        .map(onlineHistoryItem)
        .sort((a, b) => b.finishedAt - a.finishedAt);
    }
    return history;
  }

  // Local games keep their final boards under board:<id>, dropped together with the history row.
  async addHistory(item, games, board) {
    const history = await this.loadHistory(games);
    const known = history.find((h) => h.id === item.id);
    if (known) {
      if (!board || known.board) return false;
      known.board = true;
      await this.storage.put({ history, [`board:${item.id}`]: board });
      return true;
    }
    if (board) item.board = true;
    history.unshift(item);
    const dropped = history.slice(HISTORY_MAX).filter((h) => h.board).map((h) => `board:${h.id}`);
    await this.storage.put({ history: history.slice(0, HISTORY_MAX), ...(board ? { [`board:${item.id}`]: board } : {}) });
    if (dropped.length) await this.storage.delete(dropped);
    return true;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const op = url.pathname;
    if (op === '/history') {
      const all = await this.loadHistory();
      const kind = url.searchParams.get('kind');
      const items = kind ? all.filter((h) => h.kind === kind) : all;
      const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
      const limit = Math.min(HISTORY_PAGE_MAX, Math.max(1, Number(url.searchParams.get('limit')) || 30));
      return Response.json({ items: items.slice(offset, offset + limit), total: items.length, stats: historyStats(all) });
    }
    if (op === '/record' && request.method === 'POST') {
      const { item, board } = await request.json();
      const added = await this.addHistory(item, null, board || null);
      return Response.json({ ok: true, added });
    }
    if (op === '/board') {
      const board = await this.storage.get(`board:${url.searchParams.get('id')}`);
      if (!board) return Response.json({ error: 'This game’s board wasn’t saved.' }, { status: 404 });
      return Response.json({ state: board });
    }
    const games = (await this.storage.get('games')) || {};
    if (op === '/list') {
      const list = Object.values(games).sort((a, b) => b.updatedAt - a.updatedAt);
      return Response.json({ games: list });
    }
    if (op === '/upsert' && request.method === 'POST') {
      const s = await request.json();
      if (!s || !s.id) return Response.json({ error: 'bad summary' }, { status: 400 });
      if (s.status === 'over' && !(games[s.id] && games[s.id].status === 'over')) await this.addHistory(onlineHistoryItem(s), games);
      games[s.id] = s;
      const done = Object.values(games)
        .filter((g) => g.status !== 'pending' && g.status !== 'active')
        .sort((a, b) => b.updatedAt - a.updatedAt);
      done.slice(LOBBY_KEEP_FINISHED).forEach((g) => { delete games[g.id]; });
      await this.storage.put('games', games);
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
}
