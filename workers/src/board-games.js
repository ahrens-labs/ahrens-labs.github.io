// Board game lobby: every online game the signed-in player is in, across all board games, in one request.

// Lobby DO names must match lobbyStub() in dino.js and hearthhold.js.
const LOBBIES = [
  { game: 'dino', binding: 'DINO_LOBBY' },
  { game: 'hearthhold', binding: 'HEARTHHOLD_LOBBY' },
];
const CURRENT = new Set(['pending', 'active']);

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

export async function handleBoardGamesRequest(request, env, corsHeaders, path) {
  if (path !== '/api/board-games/current' || request.method !== 'GET') return jsonResponse({ error: 'Not found' }, corsHeaders, 404);
  const userId = await userIdForSession(env, bearerSession(request));
  if (!userId) return jsonResponse({ error: 'Not authenticated' }, corsHeaders, 401);

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
  const games = lists.flat().sort((a, b) => needsMe(b) - needsMe(a) || b.updatedAt - a.updatedAt);
  return jsonResponse({ games }, corsHeaders);
}
