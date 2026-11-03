import test from 'node:test';
import assert from 'node:assert/strict';
import { FantasyLeagueStore } from '../src/fantasy.js';

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

function createLeague() {
  const managers = [
    { id: 'team-1', ownerUserId: 'user-1', name: 'One', teamName: 'Team 1', roster: [] },
    { id: 'team-2', ownerUserId: 'user-2', name: 'Two', teamName: 'Team 2', roster: [] },
  ];
  return {
    leagueId: 'league-1',
    name: 'Test League',
    teamCount: 2,
    commissionerUserId: 'user-1',
    managers,
    rosterSlots: { QB: 1, BENCH: 1 },
    draftOrder: managers.map((team) => team.id),
    draftSettings: {
      type: 'snake',
      order: managers.map((team) => team.id),
      auctionBudget: 100,
      auctionClockSeconds: 15,
    },
    auctionState: null,
    draftAt: null,
    draftStarted: false,
    picks: [],
    trades: [],
  };
}

function createStore() {
  const league = createLeague();
  const storage = new MemoryStorage([['league:league-1', { league, revision: 1 }]]);
  return { store: new FantasyLeagueStore({ storage }), storage };
}

async function request(store, path, body) {
  const response = await store.fetch(new Request(`https://fantasy.internal/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
  return { response, data: await response.json() };
}

test('only the commissioner can update draft settings with the current revision', async () => {
  const { store, storage } = createStore();
  const draftSettings = {
    type: 'auction',
    order: ['team-2', 'team-1'],
    auctionBudget: 200,
    auctionClockSeconds: 30,
  };

  const unauthorized = await request(store, 'draft-settings', {
    leagueId: 'league-1',
    userId: 'user-2',
    revision: 1,
    draftSettings,
  });
  assert.equal(unauthorized.response.status, 403);

  const stale = await request(store, 'draft-settings', {
    leagueId: 'league-1',
    userId: 'user-1',
    revision: 0,
    draftSettings,
  });
  assert.equal(stale.response.status, 409);

  const saved = await request(store, 'draft-settings', {
    leagueId: 'league-1',
    userId: 'user-1',
    revision: 1,
    draftSettings,
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.data.league.draftSettings.type, 'auction');
  assert.deepEqual(saved.data.league.draftOrder, ['team-2', 'team-1']);
  assert.equal((await storage.get('league:league-1')).revision, 2);
});

test('draft schedule updates reject stale revisions', async () => {
  const { store } = createStore();
  const stale = await request(store, 'schedule', {
    leagueId: 'league-1',
    userId: 'user-1',
    revision: 0,
    draftAt: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.equal(stale.response.status, 409);

  const saved = await request(store, 'schedule', {
    leagueId: 'league-1',
    userId: 'user-1',
    revision: 1,
    draftAt: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.equal(saved.response.status, 200);
  assert.ok(saved.data.league.draftAt);
});

test('auction enforces team ownership and roster-slot budget reserves, then awards the player', async () => {
  const { store, storage } = createStore();
  await request(store, 'draft-settings', {
    leagueId: 'league-1',
    userId: 'user-1',
    revision: 1,
    draftSettings: {
      type: 'auction',
      order: ['team-1', 'team-2'],
      auctionBudget: 100,
      auctionClockSeconds: 15,
    },
  });

  const wrongNominator = await request(store, 'auction', {
    leagueId: 'league-1',
    userId: 'user-2',
    teamId: 'team-2',
    action: 'start',
  });
  assert.equal(wrongNominator.response.status, 403);

  const started = await request(store, 'auction', {
    leagueId: 'league-1',
    userId: 'user-1',
    teamId: 'team-1',
    action: 'start',
  });
  assert.equal(started.response.status, 200);

  const player = { id: 'player-1', name: 'Quarterback One', position: 'QB', team: 'NFL' };
  const nominated = await request(store, 'auction', {
    leagueId: 'league-1',
    userId: 'user-1',
    teamId: 'team-1',
    action: 'nominate',
    player,
  });
  assert.equal(nominated.response.status, 200);
  assert.equal(nominated.data.league.auctionState.highBid, 1);

  const overBudget = await request(store, 'auction', {
    leagueId: 'league-1',
    userId: 'user-2',
    teamId: 'team-2',
    action: 'bid',
    amount: 100,
  });
  assert.equal(overBudget.response.status, 409);

  const bid = await request(store, 'auction', {
    leagueId: 'league-1',
    userId: 'user-2',
    teamId: 'team-2',
    action: 'bid',
    amount: 99,
  });
  assert.equal(bid.response.status, 200);

  const record = await storage.get('league:league-1');
  record.league.auctionState.endsAt = Date.now() - 1;
  await storage.put('league:league-1', record);
  const awarded = await request(store, 'auction', {
    leagueId: 'league-1',
    userId: 'user-2',
    action: 'poll',
  });
  assert.equal(awarded.response.status, 200);
  assert.equal(awarded.data.league.auctionState, null);
  assert.equal(awarded.data.league.managers[1].roster[0].auctionPrice, 99);
  assert.equal(awarded.data.league.picks[0].teamId, 'team-2');
  assert.equal(awarded.data.league.picks[0].auctionPrice, 99);

  const league = awarded.data.league;
  league.managers[1].roster = [];
  assert.equal(store.auctionTeamSpent(league, league.managers[1]), 99);
});
