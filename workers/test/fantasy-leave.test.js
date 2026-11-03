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

  async delete(key) {
    return this.values.delete(key);
  }

  async list({ prefix = '', cursor, limit = 1000 } = {}) {
    const entries = [...this.values.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .sort(([left], [right]) => left.localeCompare(right));
    const offset = Number(cursor) || 0;
    const page = new Map(entries.slice(offset, offset + limit));
    page.list_complete = offset + limit >= entries.length;
    page.cursor = page.list_complete ? undefined : String(offset + limit);
    return page;
  }
}

function createStore(entries) {
  const storage = new MemoryStorage(entries);
  return { store: new FantasyLeagueStore({ storage }), storage };
}

async function leave(store, userId, leagueId = 'league-1') {
  const response = await store.fetch(new Request('https://fantasy.internal/leave', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, leagueId }),
  }));
  return { response, data: await response.json() };
}

async function storeRequest(store, path, body) {
  const response = await store.fetch(new Request(`https://fantasy.internal/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
  return { response, data: await response.json() };
}

test('a manager can leave without removing draft history', async () => {
  const league = {
    leagueId: 'league-1',
    commissionerUserId: 'commissioner',
    managers: [
      { id: 'team-1', ownerUserId: 'commissioner', name: 'Commissioner', roster: [] },
      { id: 'team-2', ownerUserId: 'manager', name: 'Manager', roster: [{ id: 'player-1' }] },
    ],
    picks: [{ teamId: 'team-2', playerId: 'player-1' }],
  };
  const { store, storage } = createStore([
    ['league:league-1', { league, revision: 4 }],
    ['user:manager', { leagueIds: ['league-1'], invitations: [] }],
  ]);

  const { response, data } = await leave(store, 'manager');

  assert.equal(response.status, 200);
  assert.deepEqual(data, { success: true, deleted: false });
  const saved = await storage.get('league:league-1');
  assert.equal(saved.revision, 5);
  assert.equal(saved.league.managers[1].ownerUserId, null);
  assert.equal(saved.league.managers[1].name, 'Open team');
  assert.equal(saved.league.managers[1].teamName, 'Team 2');
  assert.deepEqual(saved.league.managers[1].roster, []);
  assert.deepEqual(saved.league.picks, [{ teamId: 'team-2', playerId: 'player-1' }]);
  assert.deepEqual((await storage.get('user:manager')).leagueIds, []);
});

test('a commissioner leaving deletes the league and cleans member and pending invitations', async () => {
  const entries = [
    ['league:league-1', {
      league: {
        leagueId: 'league-1',
        commissionerUserId: 'commissioner',
        managers: [
          { id: 'team-1', ownerUserId: 'commissioner', roster: [] },
          { id: 'team-2', ownerUserId: 'manager', roster: [] },
        ],
        pendingInviteUserIds: [],
      },
      revision: 2,
    }],
    ['user:commissioner', { leagueIds: ['league-1'], invitations: [] }],
    ['user:manager', { leagueIds: ['league-1'], invitations: [] }],
  ];
  for (let index = 0; index < 1000; index += 1) {
    entries.push([`user:member-${String(index).padStart(4, '0')}`, { leagueIds: [], invitations: [] }]);
  }
  entries.push(['user:zz-legacy-invitee', {
    leagueIds: [],
    invitations: [{ leagueId: 'league-1', teamId: 'team-3' }],
  }]);
  const { store, storage } = createStore(entries);

  const { response, data } = await leave(store, 'commissioner');

  assert.equal(response.status, 200);
  assert.deepEqual(data, { success: true, deleted: true });
  assert.equal(await storage.get('league:league-1'), undefined);
  assert.deepEqual((await storage.get('user:commissioner')).leagueIds, []);
  assert.deepEqual((await storage.get('user:manager')).leagueIds, []);
  assert.deepEqual((await storage.get('user:zz-legacy-invitee')).invitations, []);

  const { data: managerLeagues } = await storeRequest(store, 'list', {
    userId: 'manager',
    username: 'Manager',
  });
  assert.deepEqual(managerLeagues.leagues, []);
  const { response: loadResponse } = await storeRequest(store, 'load', {
    userId: 'manager',
    leagueId: 'league-1',
  });
  assert.equal(loadResponse.status, 404);
});

test('league lists discard deleted league references and invitations', async () => {
  const { store, storage } = createStore([
    ['league-no-longer-owned', {
      league: {
        leagueId: 'league-no-longer-owned',
        commissionerUserId: 'other-user',
        managers: [{ id: 'team-1', ownerUserId: 'other-user', roster: [] }],
      },
      revision: 1,
    }],
    ['user:manager', {
      leagueIds: ['league-1', 'league-no-longer-owned', 'league-deleted'],
      invitations: [{ leagueId: 'league-deleted', teamId: 'team-2' }],
    }],
  ]);

  const { data } = await storeRequest(store, 'list', { userId: 'manager', username: 'Manager' });

  assert.deepEqual(data.leagues, []);
  assert.deepEqual(data.invitations, []);
  assert.deepEqual(await storage.get('user:manager'), { leagueIds: [], invitations: [] });
});

test('league edits persist in shared storage linked from the account', async () => {
  const { store, storage } = createStore();
  const { response: createResponse, data: created } = await storeRequest(store, 'create', {
    userId: 'account-1',
    username: 'Manager',
    league: {
      name: 'Sunday League',
      teamCount: 2,
      managers: [{ teamName: 'Home Team' }, { teamName: 'Away Team' }],
      rosterSlots: { QB: 1 },
      scoring: { passTD: 4 },
    },
  });

  assert.equal(createResponse.status, 200);
  const leagueId = created.league.leagueId;
  assert.deepEqual((await storage.get('user:account-1')).leagueIds, [leagueId]);

  const updatedLeague = structuredClone(created.league);
  updatedLeague.scoring.passTD = 6;
  updatedLeague.selectedWeek = 5;
  const { response: saveResponse, data: saved } = await storeRequest(store, 'save', {
    userId: 'account-1',
    leagueId,
    league: updatedLeague,
    revision: created.revision,
  });

  assert.equal(saveResponse.status, 200);
  assert.equal(saved.revision, 2);
  const { response: loadResponse, data: loaded } = await storeRequest(store, 'load', {
    userId: 'account-1',
    leagueId,
  });
  assert.equal(loadResponse.status, 200);
  assert.equal(loaded.league.scoring.passTD, 6);
  assert.equal(loaded.league.selectedWeek, 5);
  assert.equal(loaded.revision, 2);
});
