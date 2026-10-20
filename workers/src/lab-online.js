// Shared online multiplayer for Atlantis Expedition, Cauldron Lane, Hero League and The Masquerade Court.
// LabGame (one Durable Object per game) owns state and runs legal/apply from the browser engines. Games with more
// than two seats can mix invited players and computer players; the computer seats move on the server.
// LabLobby (one per user) holds small summaries so the board-games shelf is a single read.
import Atlantis from '../../js/atlantis-engine.js';
import Cauldron from '../../js/cauldron-engine.js';
import Heroes from '../../js/heroes-engine.js';
import Masquerade from '../../js/masquerade-engine.js';

const PENDING_TTL_MS = { quick: 24 * 60 * 60 * 1000, long: 7 * 24 * 60 * 60 * 1000 };
const MODES = new Set(['quick', 'long']);
const QUICK_TURN_MS = 2 * 60 * 1000;
const QUICK_FIRST_TURN_MS = 5 * 60 * 1000;
const QUICK_MAX_MISSES = 3;
const MAX_PENDING_OUT = 5;
const MAX_OPEN_GAMES = 20;
const LOBBY_KEEP_FINISHED = 10;
const HISTORY_KEEP = 200;
const BOT_LEVELS = new Set(['easy', 'normal', 'hard', 'brutal']);
const MAX_BOT_STEPS = 400;
const isBot = (p) => !!(p && p.bot);

const GAMES = {
  atlantis: {
    key: 'atlantis',
    E: Atlantis,
    idPrefix: 'at',
    idRe: /^at[0-9a-f]{18}$/,
    page: 'atlantis.html',
    title: 'Atlantis Expedition',
    maxPlayers: 2,
    botNames: [],
    roundOf: (s) => (s ? s.tide : 0),
    logEntry: (s, text, who) => ({ t: s.tide, text, who }),
    rounds: () => Atlantis.TIDES,
    turnOf: (s) => (s && s.phase !== 'over' ? s.turn : null),
    offTurnOk: () => false,
    legalOk: (E, state, me, a) => {
      const why = E.legal(state, me, a);
      return why ? why : null;
    },
    afterApply: () => {},
    scoreTotal: (E, state, p) => E.score(state, p).total,
    historyCats: (E, state) => state.players.map((p) => E.score(state, p)),
    cleanAction: null,
    publicState: null,
  },
  cauldron: {
    key: 'cauldron',
    E: Cauldron,
    idPrefix: 'cl',
    idRe: /^cl[0-9a-f]{18}$/,
    page: 'cauldron.html',
    title: 'Cauldron Lane',
    maxPlayers: 4,
    botNames: ['The Red Cauldron', 'Blue Phial & Co.', 'Greenroot Remedy', 'Violet Moon'],
    roundOf: (s) => (s ? Cauldron.today(s) : 0),
    logEntry: (s, text, who) => ({ d: Cauldron.today(s), text, who }),
    rounds: () => Cauldron.DAYS,
    turnOf: (s) => (s && s.phase !== 'over' ? s.turn : null),
    offTurnOk: () => false,
    legalOk: (E, state, me, a) => E.legal(state, me, a) || null,
    afterApply: () => {},
    scoreTotal: (E, state, p) => E.score(state, p).total,
    historyCats: (E, state) => state.players.map((p) => E.score(state, p)),
    cleanAction: null,
    publicState: null,
  },
  heroes: {
    key: 'heroes',
    E: Heroes,
    idPrefix: 'he',
    idRe: /^he[0-9a-f]{18}$/,
    page: 'heroes.html',
    title: 'Hero League',
    maxPlayers: 5,
    botNames: ['Crimson League', 'Azure Guard', 'Emerald Watch', 'Violet Vanguard', 'Golden Legion'],
    // A computer league picks its secret identity as soon as it sits down.
    botSetup: (E, state, pi, level) => {
      if (state.players[pi].idOffer) E.apply(state, pi, E.aiIdentity(state, pi, level));
    },
    roundOf: (s) => (s ? s.turns : 0),
    logEntry: (s, text, who) => ({ n: s.turns, text, who }),
    rounds: () => Heroes.PLAZA_END,
    turnOf: (s) => (s && s.phase !== 'over' ? s.turn : null),
    offTurnOk: (a) => a && a.t === 'identity',
    legalOk: (E, state, me, a) => {
      if (a.t === 'identity') {
        try {
          const q = state.players[me];
          if (!q || !q.idOffer) return 'You already have a secret identity.';
          if (!q.idOffer.includes(a.id)) return 'That identity wasn’t dealt to you.';
          return null;
        } catch (e) {
          return e.message || 'Illegal move.';
        }
      }
      const moves = E.legal(state, me);
      return moves.some((m) => sameMove(m, a)) ? null : 'That isn’t a legal move right now.';
    },
    afterApply: () => {},
    scoreTotal: (E, state, p) => E.score(state, p).total,
    historyCats: (E, state) => state.players.map((p) => E.score(state, p)),
    cleanAction: null,
    publicState: null,
  },
  masquerade: {
    key: 'masquerade',
    E: Masquerade,
    idPrefix: 'mq',
    idRe: /^mq[0-9a-f]{18}$/,
    page: 'masquerade.html',
    title: 'The Masquerade Court',
    maxPlayers: 5,
    botNames: ['Contessa Rosa', 'Count Azzurro', 'Lady Verde', 'Baron Viola', 'Marchesa Oro'],
    roundOf: (s) => (s ? s.round : 0),
    logEntry: (s, text, who) => ({ r: s.round, text, who }),
    // `turn` is whoever must decide next — the noble whose turn it is, or one answering a claim.
    turnOf: (s) => (s && s.phase !== 'over' ? s.turn : null),
    offTurnOk: () => false,
    legalOk: (E, state, me, a) => E.legal(state, me, a) || null,
    afterApply: () => {},
    scoreTotal: (E, state, p) => E.score(state, p).total,
    historyCats: (E, state) => state.players.map((p) => E.score(state, p)),
    cleanAction: null,
    publicState: null,
  },
};
GAMES.masquerade.cleanAction = cleanMasquerade;
GAMES.masquerade.publicState = publicMasquerade;

function sameMove(a, b) {
  if (!a || !b || a.t !== b.t) return false;
  if (a.t === 'draw') return a.from === b.from && (a.from === 'deck' || a.c === b.c);
  if (a.t === 'discard') return a.c === b.c;
  if (a.t === 'identity') return a.id === b.id;
  return JSON.stringify(a) === JSON.stringify(b);
}

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
  return env.LAB_GAME.get(env.LAB_GAME.idFromName(`game:${id}`));
}

function lobbyStub(env, userId) {
  return env.LAB_LOBBY.get(env.LAB_LOBBY.idFromName(`lobby:${userId}`));
}

function historyStub(env, gameKey, userId) {
  return env.HEARTHHOLD_LOBBY.get(env.HEARTHHOLD_LOBBY.idFromName(`${gameKey}:${userId}`));
}

function newGameId(cfg) {
  return cfg.idPrefix + crypto.randomUUID().replace(/-/g, '').slice(0, 18);
}

function randomInt(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

const isInt = (n) => Number.isInteger(n) && n >= 0 && n < 1e6;
const isStr = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max;

function cleanAction(a) {
  if (!a || typeof a !== 'object' || typeof a.t !== 'string') return null;
  switch (a.t) {
    case 'hire':
      return isStr(a.d, 40) ? { t: 'hire', d: a.d } : null;
    case 'build':
      return isStr(a.k, 40) ? { t: 'build', k: a.k } : null;
    case 'upgrade':
      return isInt(a.s) && isStr(a.k, 40) ? { t: 'upgrade', s: a.s, k: a.k } : null;
    case 'fit':
      return isInt(a.s) && isStr(a.m, 40) ? { t: 'fit', s: a.s, m: a.m } : null;
    case 'dive':
    case 'salvage': {
      const crew = Array.isArray(a.crew) ? a.crew.filter((id) => isInt(id) || isStr(id, 40)).slice(0, 8) : null;
      if (!crew || !crew.length) return null;
      const out = { t: a.t, crew };
      if (a.s != null) {
        if (!isInt(a.s)) return null;
        out.s = a.s;
      }
      if (a.t === 'dive') {
        if (!isInt(a.x) && !isStr(a.x, 40)) return null;
        out.x = a.x;
      }
      return out;
    }
    case 'pass':
      return { t: 'pass' };
    default:
      return null;
  }
}

function cleanCauldron(a) {
  if (!a || typeof a !== 'object' || typeof a.t !== 'string') return null;
  switch (a.t) {
    case 'tag':
      return (isInt(a.s) || isStr(a.s, 40)) && isInt(a.tag) && a.tag >= 1 && a.tag <= 99 ? { t: 'tag', s: a.s, tag: a.tag } : null;
    case 'market': {
      if (!a.buy || typeof a.buy !== 'object') return null;
      const buy = {};
      for (const [k, v] of Object.entries(a.buy)) {
        if (!isStr(k, 40) || !isInt(v) || v < 0 || v > 20) return null;
        if (v) buy[k] = v;
      }
      return Object.keys(buy).length ? { t: 'market', buy } : null;
    }
    case 'hunt':
      return isInt(a.c) || isStr(a.c, 40) ? { t: 'hunt', c: a.c } : null;
    case 'brew': {
      const ks = Array.isArray(a.ks) ? a.ks.filter((k) => isStr(k, 40)).slice(0, 6) : null;
      return ks && ks.length ? { t: 'brew', ks } : null;
    }
    case 'visit': {
      const s = Array.isArray(a.s) ? a.s.filter((id) => isInt(id) || isStr(id, 40)).slice(0, 6) : null;
      return isInt(a.from) && s && s.length ? { t: 'visit', from: a.from, s } : null;
    }
    case 'guild': {
      const s = Array.isArray(a.s) ? a.s.filter((id) => isInt(id) || isStr(id, 40)).slice(0, 12) : null;
      return s && s.length ? { t: 'guild', s } : null;
    }
    case 'learn':
      return isStr(a.k, 40) ? { t: 'learn', k: a.k } : null;
    case 'wait':
      return { t: 'wait' };
    default:
      return null;
  }
}

function cleanHeroes(a) {
  if (!a || typeof a !== 'object' || typeof a.t !== 'string') return null;
  if (a.t === 'identity') return isStr(a.id, 40) ? { t: 'identity', id: a.id } : null;
  if (a.t === 'draw') {
    if (a.from === 'deck') return { t: 'draw', from: 'deck' };
    if (a.from === 'plaza' && isStr(a.c, 40)) return { t: 'draw', from: 'plaza', c: a.c };
    return null;
  }
  if (a.t === 'discard') return isStr(a.c, 40) ? { t: 'discard', c: a.c } : null;
  return null;
}

const MASK_KINDS = new Set(Masquerade.MASK_ORDER);
function cleanMasquerade(a) {
  if (!a || typeof a !== 'object' || typeof a.t !== 'string') return null;
  const idx = (n) => Number.isInteger(n) && n >= 0 && n < 8;
  switch (a.t) {
    case 'mingle': case 'toast': case 'pass': case 'challenge':
      return { t: a.t };
    case 'scandal':
      return idx(a.target) ? { t: 'scandal', target: a.target } : null;
    case 'claim':
      if (!MASK_KINDS.has(a.k)) return null;
      return { t: 'claim', k: a.k, target: idx(a.target) ? a.target : null, give: isInt(a.give) ? a.give : null, ...(a.pair === true ? { pair: true } : {}) };
    case 'whisper':
      return idx(a.target) && MASK_KINDS.has(a.k) ? { t: 'whisper', target: a.target, k: a.k } : null;
    case 'block':
      return MASK_KINDS.has(a.k) ? { t: 'block', k: a.k } : null;
    case 'lose':
      return isInt(a.id) ? { t: 'lose', id: a.id } : null;
    default:
      return null;
  }
}
// Every other noble's hidden masks, what they've peeked at, their secret Intrigue and its progress (which would give
// away bluffs), whether the claim on the table is honest, and the wardrobe stay on the server until the ball ends.
function publicMasquerade(state, me) {
  if (!state) return null;
  const s = Masquerade.clone(state);
  s.seed = 0;
  s.wardrobe = s.wardrobe.map(() => null);
  if (state.phase === 'over') return s;
  if (s.pending) delete s.pending.honest;
  s.players.forEach((p, i) => {
    if (i === me) return;
    p.masks = p.masks.map((m) => (m.up === 'hidden' ? { id: m.id, k: null, up: 'hidden' } : m));
    p.seen = [];
    p.stats = null;
    if (p.intrigue && !p.intrigue.done) p.intrigue = { id: null, done: false };
  });
  return s;
}

function publicAtlantis(state, me) {
  if (!state) return null;
  const s = Atlantis.clone(state);
  s.seed = 0;
  s.diverDeck = new Array(state.diverDeck.length).fill(null);
  if (Array.isArray(s.forecast)) s.forecast = s.forecast.map((k, i) => (i < state.tide ? k : null));
  return s;
}

function publicCauldron(state, me) {
  if (!state) return null;
  if (state.phase === 'over') return Object.assign(Cauldron.clone(state), { seed: 0 });
  const s = Cauldron.clone(state);
  s.seed = 0;
  s.beastDeck = new Array((state.beastDeck || []).length).fill(null);
  s.beastPile = [];
  s.libDeck = new Array((state.libDeck || []).length).fill(null);
  s.folkDeck = new Array((state.folkDeck || []).length).fill(null);
  s.players = s.players.map((p, i) => {
    if (i === me) return p;
    return {
      ...p,
      pantry: Object.fromEntries(Object.keys(p.pantry || {}).map((k) => [k, 0])),
      recipes: [],
    };
  });
  return s;
}

function publicHeroes(state, me) {
  if (!state) return null;
  const s = JSON.parse(JSON.stringify(state));
  s.seed = 0;
  s.deck = new Array(state.deck.length).fill(null);
  s.players = s.players.map((p, i) => {
    if (i === me || state.phase === 'over') return p;
    return {
      ...p,
      hand: p.hand.map(() => null),
      fresh: p.fresh ? true : null,
      drew: null,
      identity: null,
      idOffer: p.idOffer ? [null, null] : null,
    };
  });
  return s;
}

GAMES.atlantis.cleanAction = cleanAction;
GAMES.atlantis.publicState = publicAtlantis;
GAMES.cauldron.cleanAction = cleanCauldron;
GAMES.cauldron.publicState = publicCauldron;
GAMES.heroes.cleanAction = cleanHeroes;
GAMES.heroes.publicState = publicHeroes;

function acceptedOf(record) {
  return record.accepted || record.players.map((p, i) => i === 0 || isBot(p));
}
// "Alice, Bob + 2 computers" — everyone at the table except `me`.
function othersText(record, me) {
  const others = record.players.filter((_, i) => i !== me);
  const people = others.filter((p) => !isBot(p) || p.left).map((p) => p.username);
  const bots = others.length - people.length;
  return people.join(', ') + (bots ? `${people.length ? ' + ' : ''}${bots} computer${bots > 1 ? 's' : ''}` : '');
}

function summaryFor(cfg, record, me) {
  const acc = acceptedOf(record);
  return {
    game: cfg.key,
    id: record.id,
    status: record.status,
    me,
    opp: othersText(record, me),
    names: record.players.map((p) => p.username),
    seats: record.players.length,
    needsMe: record.status === 'pending' && me > 0 && !acc[me],
    waiting: record.status === 'pending' ? record.players.filter((p, i) => !isBot(p) && !acc[i]).map((p) => p.username) : [],
    declinedBy: record.declinedBy != null ? record.declinedBy : null,
    turn: record.turn,
    mode: record.mode || 'long',
    deadline: record.deadline || null,
    round: cfg.roundOf(record.state),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    result: record.result || null,
  };
}

function viewFor(cfg, record, me, withState) {
  return {
    game: cfg.key,
    id: record.id,
    status: record.status,
    me,
    players: record.players.map((p) => p.username),
    bots: record.players.map((p) => p.bot || null),
    waiting: record.status === 'pending' ? record.players.filter((p, i) => !isBot(p) && !acceptedOf(record)[i]).map((p) => p.username) : [],
    version: record.version,
    turn: record.turn,
    mode: record.mode || 'long',
    deadline: record.deadline || null,
    now: Date.now(),
    result: record.result || null,
    ...(withState ? { state: cfg.publicState(record.state, me) } : {}),
  };
}

function onlineHistoryItem(cfg, record, me) {
  const s = record.state;
  return {
    id: record.id,
    kind: 'online',
    at: Date.now(),
    names: record.players.map((p) => p.username.slice(0, 18)),
    cats: s ? cfg.historyCats(cfg.E, s) : null,
    winner: record.result && record.result.winner != null ? record.result.winner : -1,
    me,
    reason: record.result ? record.result.reason : null,
  };
}

function pendingTtl(record) {
  return PENDING_TTL_MS[record.mode] || PENDING_TTL_MS.long;
}

function cfgForId(id) {
  return Object.values(GAMES).find((c) => c.idRe.test(id)) || null;
}

// The last board of a finished online game, for game history. The game's own record is the saved copy, so
// nothing is duplicated; a game that ended by resigning or timing out is shown as it stood.
export async function onlineBoard(env, gameKey, id, userId) {
  const cfg = GAMES[gameKey];
  if (!cfg || !cfg.idRe.test(id) || !env.LAB_GAME) return null;
  const res = await gameStub(env, id).fetch(new Request('http://do/get', { method: 'POST', body: JSON.stringify({ userId }) }));
  if (!res.ok) return { status: res.status, body: { error: 'Game not found' } };
  const v = await res.json();
  if (v.status !== 'over' || !v.state) return { status: 409, body: { error: 'That game hasn’t finished yet.' } };
  return { status: 200, body: { state: Object.assign(v.state, { phase: 'over' }), me: v.me } };
}

export async function handleLabOnlineRequest(request, env, corsHeaders, path, gameKey, { executionCtx, notifyChallenge } = {}) {
  const cfg = GAMES[gameKey];
  if (!cfg) return jsonResponse({ error: 'Not found' }, corsHeaders, 404);
  const base = `/api/${gameKey}`;
  // Anything else (game history) belongs to the game's own handler, which still needs to read the request body.
  const ONLINE = ['live', 'games', 'challenge', 'game', 'respond', 'act', 'resign'].map((x) => `${base}/${x}`);
  if (!ONLINE.includes(path)) return null;
  if (!env.LAB_GAME || !env.LAB_LOBBY) {
    return jsonResponse({ error: 'Online play is not available yet' }, corsHeaders, 503);
  }
  const url = new URL(request.url);

  if (path === `${base}/live`) {
    const userId = await userIdForSession(env, String(url.searchParams.get('session') || '').trim() || null);
    if (!userId) return jsonResponse({ error: 'Not authenticated' }, corsHeaders, 401);
    if (request.headers.get('Upgrade') !== 'websocket') return jsonResponse({ error: 'Expected WebSocket upgrade' }, corsHeaders, 426);
    const id = String(url.searchParams.get('id') || '').trim();
    if (!cfg.idRe.test(id)) return jsonResponse({ error: 'Game not found' }, corsHeaders, 404);
    const headers = new Headers(request.headers);
    headers.set('X-Lab-User', userId);
    headers.set('X-Lab-Game', gameKey);
    return gameStub(env, id).fetch(new Request('http://do/live', { method: 'GET', headers }));
  }

  const userId = await userIdForSession(env, bearerSession(request));
  if (!userId) return jsonResponse({ error: 'Not authenticated' }, corsHeaders, 401);

  if (path === `${base}/games` && request.method === 'GET') {
    const res = await lobbyStub(env, userId).fetch(new Request('http://do/list'));
    const data = await res.json();
    const games = (data.games || []).filter((g) => g.game === gameKey);
    return jsonResponse({ games }, corsHeaders);
  }

  let body = {};
  if (request.method === 'POST') {
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, corsHeaders, 400);
    }
  }

  if (path === `${base}/challenge` && request.method === 'POST') {
    const maxSeats = cfg.maxPlayers || 2;
    const asked = (Array.isArray(body.opponents) ? body.opponents : [body.opponent])
      .map((x) => String(x || '').trim())
      .filter(Boolean);
    const bots = (Array.isArray(body.bots) ? body.bots : []).map((x) => String(x)).filter((x) => BOT_LEVELS.has(x));
    if (!asked.length) return jsonResponse({ error: 'Invite at least one player' }, corsHeaders, 400);
    if (1 + asked.length + bots.length > maxSeats) {
      return jsonResponse({ error: `${cfg.title} seats at most ${maxSeats} players` }, corsHeaders, 400);
    }
    const [me, lobbyRes, ...targets] = await Promise.all([
      fetchProfile(env, userId),
      lobbyStub(env, userId).fetch(new Request('http://do/list')),
      ...asked.map((x) => resolveOpponent(env, x)),
    ]);
    if (!me) return jsonResponse({ error: 'Account not found' }, corsHeaders, 404);
    const bad = targets.findIndex((t) => t.error);
    if (bad >= 0) {
      const msg = asked.length > 1 ? `${targets[bad].error} (“${asked[bad].slice(0, 40)}”)` : targets[bad].error;
      return jsonResponse({ error: msg }, corsHeaders, targets[bad].status);
    }
    const opps = targets.map((t) => t.profile);
    if (opps.some((o) => o.userId === userId)) return jsonResponse({ error: 'You can’t challenge yourself' }, corsHeaders, 400);
    if (new Set(opps.map((o) => o.userId)).size < opps.length) return jsonResponse({ error: 'You invited the same player twice' }, corsHeaders, 400);
    const games = ((await lobbyRes.json()).games || []).filter((g) => g.game === gameKey);
    const open = games.filter((g) => g.status === 'pending' || g.status === 'active');
    if (open.length >= MAX_OPEN_GAMES) return jsonResponse({ error: `You already have ${MAX_OPEN_GAMES} open games` }, corsHeaders, 429);
    if (open.filter((g) => g.status === 'pending' && g.me === 0).length >= MAX_PENDING_OUT) {
      return jsonResponse({ error: 'Too many challenges waiting for an answer' }, corsHeaders, 429);
    }
    if (opps.length === 1 && !bots.length && open.some((g) => g.status === 'pending' && (g.seats || 2) === 2 && g.opp.toLowerCase() === opps[0].username.toLowerCase())) {
      return jsonResponse({ error: `You already have a challenge open with ${opps[0].username}` }, corsHeaders, 409);
    }
    const taken = new Set([me, ...opps].map((p) => p.username.toLowerCase()));
    const names = (cfg.botNames || []).filter((n) => !taken.has(n.toLowerCase()));
    const botSeats = bots.map((level, i) => ({ bot: level, username: names[i] || `Computer ${i + 1}` }));
    const gameId = newGameId(cfg);
    const res = await gameStub(env, gameId).fetch(new Request('http://do/create', {
      method: 'POST',
      body: JSON.stringify({
        id: gameId,
        game: gameKey,
        mode: MODES.has(body.mode) ? body.mode : 'long',
        players: [{ userId, username: me.username }, ...opps.map((o) => ({ userId: o.userId, username: o.username })), ...botSeats],
      }),
    }));
    if (!res.ok) return jsonResponse({ error: 'Could not create the game' }, corsHeaders, 500);
    const created = await res.json();
    if (notifyChallenge) {
      const sends = opps.filter((o) => o.email && o.emailVerified).map((o) => Promise.resolve(notifyChallenge({
        to: o.email,
        recipientName: o.username,
        challengerName: me.username,
        gameId,
        mode: created.summary && created.summary.mode,
        gameKey,
        title: cfg.title,
        page: cfg.page,
      })).catch(() => {}));
      if (executionCtx && executionCtx.waitUntil) executionCtx.waitUntil(Promise.all(sends));
    }
    return jsonResponse({ success: true, game: created.summary }, corsHeaders);
  }

  const id = String(body.id || url.searchParams.get('id') || '').trim();
  if (!cfg.idRe.test(id)) return jsonResponse({ error: 'Game not found' }, corsHeaders, 404);
  const forward = async (op, payload) => {
    const res = await gameStub(env, id).fetch(new Request(`http://do/${op}`, {
      method: 'POST',
      body: JSON.stringify({ ...payload, userId }),
    }));
    return jsonResponse(await res.json(), corsHeaders, res.status);
  };

  if (path === `${base}/game` && request.method === 'GET') return forward('get', { since: Number(url.searchParams.get('v')) || 0 });
  if (path === `${base}/respond` && request.method === 'POST') return forward('respond', { accept: body.accept === true });
  if (path === `${base}/act` && request.method === 'POST') return forward('act', { base: body.base, a: body.a });
  if (path === `${base}/resign` && request.method === 'POST') return forward('resign', {});

  return null;
}

export class LabGame {
  constructor(state, env) {
    this.ctx = state;
    this.env = env;
    this.storage = state.storage;
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  cfg(record) {
    return GAMES[record && record.game] || cfgForId(record && record.id);
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
    const cfg = this.cfg(record);
    if (!cfg) return;
    await Promise.all(record.players.map(async (p, i) => {
      if (!p.userId) return;
      const summary = summaryFor(cfg, record, i);
      await lobbyStub(this.env, p.userId)
        .fetch(new Request('http://do/upsert', {
          method: 'POST',
          body: JSON.stringify({
            ...summary,
            ...(record.status === 'over' ? { history: onlineHistoryItem(cfg, record, i) } : {}),
          }),
        }))
        .catch(() => {});
      if (record.status === 'over' && this.env.HEARTHHOLD_LOBBY) {
        await historyStub(this.env, cfg.key, p.userId)
          .fetch(new Request('http://do/record', {
            method: 'POST',
            body: JSON.stringify({ item: onlineHistoryItem(cfg, record, i), board: null }),
          }))
          .catch(() => {});
      }
    }));
  }

  broadcast(record, by, skip) {
    const cfg = this.cfg(record);
    if (!cfg) return;
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === skip) continue;
      const [uid] = this.ctx.getTags(ws);
      const me = record.players.findIndex((p) => p.userId === uid);
      if (me < 0) continue;
      try {
        ws.send(JSON.stringify({ type: 'state', by, ...viewFor(cfg, record, me, true) }));
      } catch {
        /* closed */
      }
    }
  }

  playerIndex(record, userId) {
    return record && userId ? record.players.findIndex((p) => p.userId === userId) : -1;
  }

  async scheduleAlarm(record) {
    if (record.status === 'pending') await this.storage.setAlarm(record.createdAt + pendingTtl(record));
    else if (record.status === 'active' && record.deadline) await this.storage.setAlarm(record.deadline);
    else await this.storage.deleteAlarm();
  }

  // Deal the game once everyone invited has said yes, and let any computer seats that go first play.
  start(cfg, record) {
    const seats = record.players;
    record.state = cfg.E.newGame({
      seed: randomInt(2 ** 31),
      names: seats.map((p) => p.username.slice(0, 18)),
      ai: seats.map(isBot),
      levels: seats.map((p) => p.bot || 'normal'),
      first: randomInt(seats.length),
    });
    if (record.state.log) record.state.log.push(cfg.logEntry(record.state, `${record.state.players[record.state.turn].name} goes first.`, null));
    if (cfg.botSetup) seats.forEach((p, i) => isBot(p) && cfg.botSetup(cfg.E, record.state, i, p.bot));
    record.status = 'active';
    record.version = 1;
    this.runBots(cfg, record);
    record.turn = cfg.turnOf(record.state);
    if (record.state.phase === 'over') this.finishFromState(cfg, record);
    record.deadline = record.status === 'active' && record.mode === 'quick' ? Date.now() + QUICK_FIRST_TURN_MS : null;
  }

  // Computer seats move straight away, until it's a person's decision (or the game ends).
  runBots(cfg, record) {
    const state = record.state;
    let moved = 0;
    for (let i = 0; i < MAX_BOT_STEPS && state && state.phase !== 'over'; i++) {
      const t = cfg.turnOf(state);
      const seat = t == null ? null : record.players[t];
      if (!isBot(seat)) break;
      try {
        const a = cfg.E.aiChoose(state, t, seat.bot);
        if (!a) break;
        cfg.E.apply(state, t, a);
        moved += 1;
      } catch {
        break;
      }
    }
    return moved;
  }

  finishFromState(cfg, record) {
    const w = cfg.E.winner(record.state);
    this.finish(cfg, record, w < 0 ? null : w, 'finished');
  }

  // With more than two seats, a player who resigns or keeps timing out hands their seat to the computer.
  leaveSeat(cfg, record, pi, why) {
    const seat = record.players[pi];
    const state = record.state;
    seat.bot = 'normal';
    seat.left = why;
    const p = state.players[pi];
    p.ai = true;
    p.level = 'normal';
    if (state.log) {
      const what = why === 'timeout' ? 'ran out of time three turns running' : 'left the game';
      state.log.push(cfg.logEntry(state, `${p.name} ${what} — the computer plays their seat now.`, pi));
    }
    if (cfg.botSetup) cfg.botSetup(cfg.E, state, pi, 'normal');
    if (record.players.every(isBot)) return this.finish(cfg, record, null, 'abandoned');
    this.runBots(cfg, record);
    record.turn = cfg.turnOf(state);
    if (state.phase === 'over') this.finishFromState(cfg, record);
    else if (record.mode === 'quick') record.deadline = Date.now() + QUICK_TURN_MS;
  }

  finish(cfg, record, winner, reason) {
    record.status = 'over';
    record.turn = null;
    record.deadline = null;
    const scores = record.state ? record.state.players.map((p) => cfg.scoreTotal(cfg.E, record.state, p)) : null;
    record.result = { winner, reason, scores };
  }

  async fetch(request) {
    const url = new URL(request.url);
    const op = url.pathname.slice(1);

    if (op === 'live') {
      const userId = request.headers.get('X-Lab-User');
      const record = await this.load();
      const me = this.playerIndex(record, userId);
      if (me < 0) return new Response('Not found', { status: 404 });
      const cfg = this.cfg(record);
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server, [userId]);
      server.send(JSON.stringify({ type: 'state', by: null, ...viewFor(cfg, record, me, true) }));
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
      const cfg = GAMES[body.game] || cfgForId(body.id);
      if (!cfg) return Response.json({ error: 'bad game' }, { status: 400 });
      const now = Date.now();
      const record = {
        id: body.id,
        game: cfg.key,
        status: 'pending',
        mode: MODES.has(body.mode) ? body.mode : 'long',
        deadline: null,
        misses: body.players.map(() => 0),
        players: body.players,
        accepted: body.players.map((p, i) => i === 0 || isBot(p)),
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
      return Response.json({ summary: summaryFor(cfg, record, 0) });
    }

    const record = await this.load();
    const cfg = this.cfg(record);
    const me = this.playerIndex(record, body.userId);
    if (me < 0 || !cfg) return Response.json({ error: 'Game not found' }, { status: 404 });

    if (op === 'get') {
      if (body.since && body.since === record.version) return Response.json({ ...viewFor(cfg, record, me, false), unchanged: true });
      return Response.json(viewFor(cfg, record, me, true));
    }

    if (op === 'respond') {
      if (record.status !== 'pending') return Response.json({ error: 'This challenge is no longer open', ...viewFor(cfg, record, me, true) }, { status: 409 });
      if (me === 0 || isBot(record.players[me])) return Response.json({ error: 'Only an invited player can answer' }, { status: 403 });
      const acc = acceptedOf(record);
      if (acc[me]) return Response.json({ error: 'You’ve already accepted — waiting for the others', ...viewFor(cfg, record, me, false) }, { status: 409 });
      if (!body.accept) {
        record.status = 'declined';
        record.declinedBy = me;
      } else {
        acc[me] = true;
        record.accepted = acc;
        record.version += 1;
        if (acc.every(Boolean)) this.start(cfg, record);
      }
      await this.persist(record);
      await this.scheduleAlarm(record);
      await this.publishLobbies(record);
      this.broadcast(record, me);
      return Response.json(viewFor(cfg, record, me, true));
    }

    if (op === 'resign') {
      if (record.status === 'pending') {
        record.status = me === 0 ? 'cancelled' : 'declined';
        if (me !== 0) record.declinedBy = me;
      } else if (record.status === 'active' && record.players[me].left) {
        return Response.json({ error: 'You’ve already left this game', ...viewFor(cfg, record, me, false) }, { status: 409 });
      } else if (record.status === 'active' && record.players.length > 2) {
        this.leaveSeat(cfg, record, me, 'resign');
        record.version += 1;
      } else if (record.status === 'active') this.finish(cfg, record, 1 - me, 'resign');
      else return Response.json({ error: 'This game is already over', ...viewFor(cfg, record, me, false) }, { status: 409 });
      await this.persist(record);
      await this.scheduleAlarm(record);
      await this.publishLobbies(record);
      this.broadcast(record, me);
      return Response.json(viewFor(cfg, record, me, true));
    }

    if (op === 'act') {
      const out = await this.applyAction(record, me, body);
      return Response.json(out.body, { status: out.status });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  async applyAction(record, me, body, socket) {
    const cfg = this.cfg(record);
    const fresh = (error, status = 409) => ({ status, body: { error, ...viewFor(cfg, record, me, true) } });
    if (record.status !== 'active') return fresh('This game is not in progress');
    if (record.players[me].left) return fresh('You left this game — the computer plays your seat now.', 403);
    if (Number(body.base) !== record.version) return fresh('The game moved on — here is the latest.');
    const a = cfg.cleanAction(body.a);
    if (!a) return fresh('That isn’t a valid action.', 400);
    const state = record.state;
    if (!cfg.offTurnOk(a) && state.turn !== me) return fresh('It’s not your turn.');
    const why = cfg.legalOk(cfg.E, state, me, a);
    if (why) return fresh(why);
    const prevTurn = record.turn;
    const prevRound = cfg.roundOf(state);
    if (me === state.turn && record.misses) record.misses[me] = 0;
    try {
      cfg.E.apply(state, me, a);
    } catch (e) {
      return fresh(e.message || 'Illegal move.', 400);
    }
    cfg.afterApply(state, me, a);
    const botMoves = this.runBots(cfg, record);
    record.version += 1;
    record.turn = cfg.turnOf(state);
    if (state.phase === 'over') this.finishFromState(cfg, record);
    await this.persist(record);
    const newTurn = record.turn !== prevTurn || cfg.roundOf(state) !== prevRound || botMoves > 0;
    if (record.status === 'active' && record.mode === 'quick' && newTurn) record.deadline = Date.now() + QUICK_TURN_MS;
    if (record.status === 'over' || newTurn) {
      await this.scheduleAlarm(record);
      await this.publishLobbies(record);
    }
    this.broadcast(record, me, socket);
    return { status: 200, body: viewFor(cfg, record, me, true) };
  }

  async turnTimedOut(record) {
    const cfg = this.cfg(record);
    if (!cfg) return;
    if (Date.now() < record.deadline - 1000) return this.scheduleAlarm(record);
    const state = record.state;
    const pi = state.turn;
    record.misses = record.misses || record.players.map(() => 0);
    record.misses[pi] = (record.misses[pi] || 0) + 1;
    if (isBot(record.players[pi])) {
      this.runBots(cfg, record);
      record.turn = cfg.turnOf(state);
      if (state.phase === 'over') this.finishFromState(cfg, record);
      else record.deadline = Date.now() + QUICK_TURN_MS;
    } else if (record.misses[pi] >= QUICK_MAX_MISSES && record.players.length > 2) {
      this.leaveSeat(cfg, record, pi, 'timeout');
    } else if (record.misses[pi] >= QUICK_MAX_MISSES) {
      this.finish(cfg, record, 1 - pi, 'timeout');
    } else {
      if (state.log) state.log.push(cfg.logEntry(state, `${state.players[pi].name} ran out of time, so the computer took the turn.`, pi));
      const mark = cfg.roundOf(state);
      const turn0 = state.turn;
      for (let i = 0; i < 40 && state.phase !== 'over' && state.turn === turn0 && cfg.roundOf(state) === mark; i++) {
        try {
          let a;
          if (cfg.key === 'heroes' && state.players[pi].idOffer) {
            a = { t: 'identity', id: state.players[pi].idOffer[0] };
          } else {
            a = cfg.E.aiChoose(state, pi, 'easy');
          }
          if (!a) break;
          cfg.E.apply(state, pi, a);
        } catch {
          break;
        }
      }
      this.runBots(cfg, record);
      record.turn = cfg.turnOf(state);
      if (state.phase === 'over') this.finishFromState(cfg, record);
      else record.deadline = Date.now() + QUICK_TURN_MS;
    }
    record.version += 1;
    await this.persist(record);
    await this.scheduleAlarm(record);
    await this.publishLobbies(record);
    this.broadcast(record, null);
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
    if (record.status === 'active' && record.deadline) return this.turnTimedOut(record);
    if (record.status !== 'pending') return;
    if (Date.now() < record.createdAt + pendingTtl(record) - 1000) {
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

export class LabLobby {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const op = url.pathname;
    if (op === '/history') {
      return Response.json({ items: (await this.storage.get('history')) || [] });
    }
    if (op === '/record' && request.method === 'POST') {
      const { item, board } = await request.json();
      await this.addHistory(item, board || null);
      return Response.json({ ok: true });
    }
    const games = (await this.storage.get('games')) || {};
    if (op === '/list') {
      return Response.json({ games: Object.values(games).sort((a, b) => b.updatedAt - a.updatedAt) });
    }
    if (op === '/upsert' && request.method === 'POST') {
      const s = await request.json();
      if (!s || !s.id) return Response.json({ error: 'bad summary' }, { status: 400 });
      const { history, ...summary } = s;
      if (history) await this.addHistory(history);
      games[s.id] = summary;
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

  async addHistory(item) {
    if (!item || !item.id) return;
    const list = (await this.storage.get('history')) || [];
    if (list.some((h) => h.id === item.id)) return;
    list.unshift(item);
    await this.storage.put('history', list.slice(0, HISTORY_KEEP));
  }
}
