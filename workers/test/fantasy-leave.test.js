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
});
