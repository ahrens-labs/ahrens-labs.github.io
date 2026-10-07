// Hearthhold — online games between Ahrens Labs accounts.
// HearthholdGame (one Durable Object per game) owns the game state and runs every action through the
// same rules engine the browser uses, so a player can only make legal moves. HearthholdLobby (one per
// user) keeps small summaries so the game list is a single read.
import E from '../../js/hearthhold-engine.js';

const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PENDING_OUT = 5;
const MAX_OPEN_GAMES = 20;
const LOBBY_KEEP_FINISHED = 10;
const MAX_TRADES = 40;
const GAME_ID_RE = /^hh[0-9a-f]{18}$/;
const RES = new Set(E.RES);

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
  return env.HEARTHHOLD_GAME.get(env.HEARTHHOLD_GAME.idFromName(`game:${id}`));
}

function lobbyStub(env, userId) {
  return env.HEARTHHOLD_LOBBY.get(env.HEARTHHOLD_LOBBY.idFromName(`lobby:${userId}`));
}

function newGameId() {
  return 'hh' + crypto.randomUUID().replace(/-/g, '').slice(0, 18);
}

function randomInt(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

const isInt = (n) => Number.isInteger(n) && n >= 0 && n < 1e6;

// Only the fields each action needs, with the right types. The engine then decides if it's legal.
function cleanAction(a) {
  if (!a || typeof a !== 'object') return null;
  switch (a.t) {
    case 'build':
      if (!Object.prototype.hasOwnProperty.call(E.BUILD, a.b)) return null;
      if (a.cell != null && !isInt(a.cell)) return null;
      return { t: 'build', b: a.b, cell: a.cell == null ? null : a.cell };
    case 'wall':
      return isInt(a.side) && a.side < 6 ? { t: 'wall', side: a.side } : null;
    case 'recruit':
      if (a.peasant === true) return { t: 'recruit', peasant: true };
      return isInt(a.i) ? { t: 'recruit', i: a.i } : null;
    case 'place':
      return Object.prototype.hasOwnProperty.call(E.LOC, a.loc) ? { t: 'place', loc: a.loc } : null;
    case 'trade': {
      if (!Array.isArray(a.trades) || !a.trades.length || a.trades.length > MAX_TRADES) return null;
      const trades = a.trades.map((x) => (Array.isArray(x) && RES.has(x[0]) && RES.has(x[1]) ? [x[0], x[1]] : null));
      return trades.every(Boolean) ? { t: 'trade', trades } : null;
    }
    case 'move':
      if (!isInt(a.v) || (a.to != null && !isInt(a.to))) return null;
      return { t: 'move', v: a.v, to: a.to == null ? null : a.to };
    case 'end':
      return { t: 'end' };
    default:
      return null;
  }
}

// What a player may see: the deck order, the random seed and creatures beyond the visible three stay on the server.
function publicState(state) {
  if (!state) return null;
  const s = E.clone(state);
  s.deck = new Array(state.deck.length).fill(0);
  s.seed = 0;
  s.threats = s.threats.map((t, i) => (i < state.round - 1 + 3 ? t : null));
  return s;
}

function summaryFor(record, me) {
  const opp = record.players[1 - me];
  return {
    id: record.id,
    status: record.status,
    me,
    opp: opp ? opp.username : '',
    turn: record.turn,
    round: record.state ? record.state.round : 0,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    result: record.result || null,
  };
}

function viewFor(record, me, withState) {
  return {
    id: record.id,
    status: record.status,
    me,
    players: record.players.map((p) => p.username),
    version: record.version,
    turn: record.turn,
    result: record.result || null,
    ...(withState ? { state: publicState(record.state) } : {}),
  };
}

const turnOf = (state) => (state && state.phase === 'act' ? state.turn : null);

// ---------------------------------------------------------------- Worker routes

export async function handleHearthholdRequest(request, env, corsHeaders, path, { executionCtx, notifyChallenge } = {}) {
  if (!env.HEARTHHOLD_GAME || !env.HEARTHHOLD_LOBBY) {
    return jsonResponse({ error: 'Online play is not available yet' }, corsHeaders, 503);
  }
  const url = new URL(request.url);

  if (path === '/api/hearthhold/live') {
    const userId = await userIdForSession(env, String(url.searchParams.get('session') || '').trim() || null);
    if (!userId) return jsonResponse({ error: 'Not authenticated' }, corsHeaders, 401);
    if (request.headers.get('Upgrade') !== 'websocket') return jsonResponse({ error: 'Expected WebSocket upgrade' }, corsHeaders, 426);
    const id = String(url.searchParams.get('id') || '').trim();
    if (!GAME_ID_RE.test(id)) return jsonResponse({ error: 'Game not found' }, corsHeaders, 404);
    const headers = new Headers(request.headers);
    headers.set('X-Hearthhold-User', userId);
    return gameStub(env, id).fetch(new Request('http://do/live', { method: 'GET', headers }));
  }

  const userId = await userIdForSession(env, bearerSession(request));
  if (!userId) return jsonResponse({ error: 'Not authenticated' }, corsHeaders, 401);

  if (path === '/api/hearthhold/games' && request.method === 'GET') {
    const res = await lobbyStub(env, userId).fetch(new Request('http://do/list'));
    return jsonResponse(await res.json(), corsHeaders);
  }

  let body = {};
  if (request.method === 'POST') {
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, corsHeaders, 400);
    }
  }

  if (path === '/api/hearthhold/challenge' && request.method === 'POST') {
    const [me, target, lobbyRes] = await Promise.all([
      fetchProfile(env, userId),
      resolveOpponent(env, body.opponent),
      lobbyStub(env, userId).fetch(new Request('http://do/list')),
    ]);
    if (!me) return jsonResponse({ error: 'Account not found' }, corsHeaders, 404);
    if (target.error) return jsonResponse({ error: target.error }, corsHeaders, target.status);
    const opp = target.profile;
    if (opp.userId === userId) return jsonResponse({ error: 'You can’t challenge yourself' }, corsHeaders, 400);
    const games = (await lobbyRes.json()).games || [];
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
        players: [{ userId, username: me.username }, { userId: opp.userId, username: opp.username }],
      }),
    }));
    if (!res.ok) return jsonResponse({ error: 'Could not create the game' }, corsHeaders, 500);
    const created = await res.json();
    if (notifyChallenge && opp.email && opp.emailVerified) {
      const send = notifyChallenge({ to: opp.email, recipientName: opp.username, challengerName: me.username, gameId });
      if (executionCtx && executionCtx.waitUntil) executionCtx.waitUntil(Promise.resolve(send).catch(() => {}));
    }
    return jsonResponse({ success: true, game: created.summary }, corsHeaders);
  }

  const id = String(body.id || url.searchParams.get('id') || '').trim();
  if (!GAME_ID_RE.test(id)) return jsonResponse({ error: 'Game not found' }, corsHeaders, 404);
  const forward = async (op, payload) => {
    const res = await gameStub(env, id).fetch(new Request(`http://do/${op}`, {
      method: 'POST',
      body: JSON.stringify({ ...payload, userId }),
    }));
    return jsonResponse(await res.json(), corsHeaders, res.status);
  };

  if (path === '/api/hearthhold/game' && request.method === 'GET') return forward('get', { since: Number(url.searchParams.get('v')) || 0 });
  if (path === '/api/hearthhold/respond' && request.method === 'POST') return forward('respond', { accept: body.accept === true });
  if (path === '/api/hearthhold/act' && request.method === 'POST') return forward('act', { base: body.base, a: body.a });
  if (path === '/api/hearthhold/resign' && request.method === 'POST') return forward('resign', {});

  return jsonResponse({ error: 'Not found' }, corsHeaders, 404);
}

// ---------------------------------------------------------------- Durable Objects

export class HearthholdGame {
  constructor(state, env) {
    this.ctx = state;
    this.env = env;
    this.storage = state.storage;
    // Keep-alive pings are answered without waking the object.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
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
        ws.send(JSON.stringify({ type: 'state', by, ...viewFor(record, me, true) }));
      } catch {
        /* closed socket */
      }
    }
  }

  playerIndex(record, userId) {
    return record ? record.players.findIndex((p) => p.userId === userId) : -1;
  }

  async scheduleAlarm(record) {
    if (record.status === 'pending') await this.storage.setAlarm(record.createdAt + PENDING_TTL_MS);
    else await this.storage.deleteAlarm();
  }

  finish(record, winner, reason) {
    record.status = 'over';
    record.turn = null;
    const scores = record.state ? record.state.players.map((p) => E.score(record.state, p).total) : null;
    record.result = { winner, reason, scores };
  }

  async fetch(request) {
    const url = new URL(request.url);
    const op = url.pathname.slice(1);

    if (op === 'live') {
      const userId = request.headers.get('X-Hearthhold-User');
      const record = await this.load();
      const me = this.playerIndex(record, userId);
      if (me < 0) return new Response('Not found', { status: 404 });
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server, [userId]);
      server.send(JSON.stringify({ type: 'state', by: null, ...viewFor(record, me, true) }));
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
        status: 'pending',
        players: body.players,
        createdAt: now,
        updatedAt: now,
        version: 0,
        state: null,
        turn: null,
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
      if (body.since && body.since === record.version) return Response.json({ ...viewFor(record, me, false), unchanged: true });
      return Response.json(viewFor(record, me, true));
    }

    if (op === 'respond') {
      if (record.status !== 'pending') return Response.json({ error: 'This challenge is no longer open', ...viewFor(record, me, true) }, { status: 409 });
      if (me !== 1) return Response.json({ error: 'Only the challenged player can answer' }, { status: 403 });
      if (!body.accept) {
        record.status = 'declined';
      } else {
        record.state = E.newGame({
          seed: randomInt(2 ** 31),
          names: record.players.map((p) => p.username.slice(0, 18)),
          ai: [false, false],
          first: randomInt(2),
        });
        record.state.log.push({ r: 1, text: `${record.state.players[record.state.first].name} goes first.`, who: record.state.first });
        record.status = 'active';
        record.version = 1;
        record.turn = turnOf(record.state);
      }
      await this.persist(record);
      await this.scheduleAlarm(record);
      await this.publishLobbies(record);
      this.broadcast(record, me);
      return Response.json(viewFor(record, me, true));
    }

    if (op === 'resign') {
      if (record.status === 'pending') record.status = me === 0 ? 'cancelled' : 'declined';
      else if (record.status === 'active') this.finish(record, 1 - me, 'resign');
      else return Response.json({ error: 'This game is already over', ...viewFor(record, me, false) }, { status: 409 });
      await this.persist(record);
      await this.scheduleAlarm(record);
      await this.publishLobbies(record);
      this.broadcast(record, me);
      return Response.json(viewFor(record, me, true));
    }

    if (op === 'act') {
      const out = await this.applyAction(record, me, body);
      return Response.json(out.body, { status: out.status });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  async applyAction(record, me, body, socket) {
    const fresh = (error, status = 409) => ({ status, body: { error, ...viewFor(record, me, true) } });
    if (record.status !== 'active') return fresh('This game is not in progress');
    if (Number(body.base) !== record.version) return fresh('The game moved on — here is the latest.');
    const a = cleanAction(body.a);
    if (!a) return fresh('That isn’t a valid action.', 400);
    const state = record.state;
    if (a.t !== 'move' && state.turn !== me) return fresh('It’s not your turn.');
    const why = E.legal(state, me, a);
    if (why) return fresh(why);
    const prevTurn = record.turn;
    E.apply(state, me, a);
    if (state.phase === 'dusk') E.resolveDusk(state);
    record.version += 1;
    record.turn = turnOf(state);
    if (state.phase === 'over') {
      const w = E.winner(state);
      this.finish(record, w < 0 ? null : w, 'finished');
    }
    await this.persist(record);
    if (record.status === 'over' || record.turn !== prevTurn) {
      await this.scheduleAlarm(record);
      await this.publishLobbies(record);
    }
    this.broadcast(record, me, socket);
    return { status: 200, body: viewFor(record, me, true) };
  }

  async webSocketMessage(ws, message) {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (!msg || msg.type !== 'act') return;
    const record = await this.load();
    const [uid] = this.ctx.getTags(ws);
    const me = this.playerIndex(record, uid);
    if (me < 0) return;
    const out = await this.applyAction(record, me, msg, ws);
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
    if (record.status !== 'pending') return;
    if (Date.now() < record.createdAt + PENDING_TTL_MS - 1000) {
      await this.scheduleAlarm(record);
      return;
    }
    record.status = 'expired';
    await this.persist(record);
    await this.scheduleAlarm(record);
    await this.publishLobbies(record);
    this.broadcast(record, null);
  }
}

export class HearthholdLobby {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    const op = new URL(request.url).pathname;
    const games = (await this.storage.get('games')) || {};
    if (op === '/list') {
      return Response.json({ games: Object.values(games).sort((a, b) => b.updatedAt - a.updatedAt) });
    }
    if (op === '/upsert' && request.method === 'POST') {
      const s = await request.json();
      if (!s || !s.id) return Response.json({ error: 'bad summary' }, { status: 400 });
      games[s.id] = s;
      Object.values(games)
        .filter((g) => g.status !== 'pending' && g.status !== 'active')
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(LOBBY_KEEP_FINISHED)
        .forEach((g) => { delete games[g.id]; });
      await this.storage.put('games', games);
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
}
