import test from 'node:test';
import assert from 'node:assert/strict';
import { FantasyLeagueStore, handleFantasyRequest } from '../src/fantasy.js';

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
  }

  async get(key) {
    return this.values.get(key);
  }

  async put(key, value) {
    this.values.set(key, value);
  }
}

function createStore() {
  const managers = [
    { id: 'team-1', ownerUserId: 'user-1', name: 'One', teamName: 'Team 1', roster: [] },
    { id: 'team-2', ownerUserId: 'user-2', name: 'Two', teamName: 'Team 2', roster: [] },
  ];
  const league = {
    leagueId: 'league-1',
    name: 'Test League',
    teamCount: 2,
    commissionerUserId: 'user-1',
    managers,
    rosterSlots: { QB: 1, BENCH: 1 },
    draftOrder: managers.map((team) => team.id),
    draftSettings: { type: 'snake', order: managers.map((team) => team.id) },
    draftStarted: true,
    draftPickStartedAt: Date.now() - 90_001,
    picks: [],
  };
  const storage = new MemoryStorage([['league:league-1', { league, revision: 1 }]]);
  return { store: new FantasyLeagueStore({ storage }), storage };
}

async function autoPick(store, userId, player = {
  id: 'player-1',
  name: 'Quarterback One',
  position: 'QB',
  team: 'NFL',
  espnRank: 1,
  projectedPoints: 12.5,
  projectedStats: { passYards: 200 },
}) {
  const response = await store.fetch(new Request('https://fantasy.internal/draft-pick', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leagueId: 'league-1', userId, player }),
  }));
  return { response, data: await response.json() };
}

test('an expired snake-draft pick is made once by the server', async () => {
  const { store, storage } = createStore();

  const { response, data } = await autoPick(store, 'user-2');

  assert.equal(response.status, 200);
  assert.equal(data.league.picks.length, 1);
  assert.equal(data.league.picks[0].teamId, 'team-1');
  assert.equal(data.league.managers[0].roster[0].rosterSlot, 'QB');
  assert.equal(data.league.managers[0].roster[0].projectedPoints, 12.5);
  assert.deepEqual(data.league.managers[0].roster[0].projectedStats, { passYards: 200 });
  assert.ok(data.league.draftPickStartedAt > Date.now() - 5_000);

  const staleRetry = await autoPick(store, 'user-2');
  assert.equal(staleRetry.response.status, 409);
  assert.equal((await storage.get('league:league-1')).league.picks.length, 1);
});

test('a snake-draft pick cannot be auto-picked before its 90-second deadline', async () => {
  const { store, storage } = createStore();
  const record = await storage.get('league:league-1');
  record.league.draftPickStartedAt = Date.now() - 80_000;
  await storage.put('league:league-1', record);

  const { response, data } = await autoPick(store, 'user-2');

  assert.equal(response.status, 409);
  assert.match(data.error, /time remaining/i);
  assert.equal((await storage.get('league:league-1')).league.picks.length, 0);
});

test('auto-pick requests require league membership', async () => {
  const { store } = createStore();

  const { response } = await autoPick(store, 'outsider');

  assert.equal(response.status, 403);
});

test('the authenticated Fantasy API routes timed auto-picks to the league store', async () => {
  const { store } = createStore();
  const env = {
    SESSION: {
      idFromName: (id) => id,
      get: () => ({ fetch: async () => Response.json({ userId: 'user-2' }) }),
    },
    USER_ACCOUNT: {
      idFromName: (id) => id,
      get: () => ({ fetch: async () => Response.json({ username: 'Manager Two' }) }),
    },
    FANTASY_LEAGUE: {
      idFromName: (id) => id,
      get: () => ({ fetch: (request) => store.fetch(request) }),
    },
  };
  const request = new Request('https://ahrenslabs.com/api/fantasy/leagues/league-1/draft-pick', {
    method: 'POST',
    headers: { Authorization: 'Bearer session-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player: { id: 'player-1', name: 'Quarterback One', position: 'QB', team: 'NFL' },
    }),
  });

  const response = await handleFantasyRequest(
    request,
    env,
    {},
    '/api/fantasy/leagues/league-1/draft-pick',
  );
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.userId, 'user-2');
  assert.equal(data.league.picks[0].teamId, 'team-1');
});
