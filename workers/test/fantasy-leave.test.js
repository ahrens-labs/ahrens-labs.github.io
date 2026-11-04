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

test('league invitations use current league and team names', async () => {
  const { store } = createStore([
    ['league:league-1', {
      league: {
        leagueId: 'league-1',
        name: 'Updated League Name',
        managers: [
          { id: 'team-1', teamName: 'Renamed Team', ownerUserId: null, roster: [] },
        ],
      },
      revision: 2,
    }],
    ['user:manager', {
      leagueIds: [],
      invitations: [{
        leagueId: 'league-1',
        leagueName: 'Old League Name',
        teamId: 'team-1',
        teamName: 'Old Team Name',
      }],
    }],
  ]);

  const { data } = await storeRequest(store, 'list', { userId: 'manager', username: 'Manager' });

  assert.equal(data.invitations[0].leagueName, 'Updated League Name');
  assert.equal(data.invitations[0].teamName, 'Renamed Team');
});

test('accepting an invitation assigns the team and clears the invitation', async () => {
  const { store, storage } = createStore([
    ['league:league-1', {
      league: {
        leagueId: 'league-1',
        commissionerUserId: 'commissioner',
        managers: [
          { id: 'team-1', ownerUserId: 'commissioner', name: 'Commissioner', teamName: 'Commissioner Team', roster: [] },
          { id: 'team-2', ownerUserId: null, name: 'Open team', teamName: 'Team 2', roster: [] },
        ],
        pendingInviteUserIds: ['manager'],
      },
      revision: 1,
    }],
    ['user:manager', {
      leagueIds: [],
      invitations: [{ leagueId: 'league-1', teamId: 'team-2', teamName: 'Team 2' }],
    }],
  ]);

  const { response, data } = await storeRequest(store, 'accept-invitation', {
    userId: 'manager',
    username: 'Manager',
    leagueId: 'league-1',
    teamId: 'team-2',
    teamName: 'Manager Team',
    teamAbbreviation: 'MT',
  });

  assert.equal(response.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.leagueId, 'league-1');
  assert.equal(data.teamId, 'team-2');
  assert.equal(data.league.managers[1].ownerUserId, 'manager');
  assert.equal(data.revision, 2);
  assert.deepEqual((await storage.get('user:manager')).leagueIds, ['league-1']);
  assert.deepEqual((await storage.get('user:manager')).invitations, []);
  const leagueRecord = await storage.get('league:league-1');
  assert.equal(leagueRecord.league.managers[1].ownerUserId, 'manager');
  assert.equal(leagueRecord.league.managers[1].teamName, 'Manager Team');
  assert.equal(leagueRecord.league.managers[1].teamAbbreviation, 'MT');
  assert.deepEqual(leagueRecord.league.pendingInviteUserIds, []);
});

test('accepting an invitation is recoverable if the team was already assigned to that user', async () => {
  const { store, storage } = createStore([
    ['league:league-1', {
      league: {
        leagueId: 'league-1',
        commissionerUserId: 'commissioner',
        managers: [
          { id: 'team-1', ownerUserId: 'commissioner', name: 'Commissioner', teamName: 'Commissioner Team', roster: [] },
          { id: 'team-2', ownerUserId: 'manager', name: 'Manager', teamName: 'Manager Team', roster: [] },
        ],
        pendingInviteUserIds: ['manager'],
      },
      revision: 2,
    }],
    ['user:manager', {
      leagueIds: [],
      invitations: [{ leagueId: 'league-1', teamId: 'team-2', teamName: 'Team 2' }],
    }],
  ]);

  const { response, data } = await storeRequest(store, 'accept-invitation', {
    userId: 'manager',
    username: 'Manager',
    leagueId: 'league-1',
    teamId: 'team-2',
    teamName: 'Manager Team',
  });

  assert.equal(response.status, 200);
  assert.equal(data.success, true);
  assert.deepEqual((await storage.get('user:manager')).leagueIds, ['league-1']);
  assert.deepEqual((await storage.get('user:manager')).invitations, []);
  assert.deepEqual((await storage.get('league:league-1')).league.pendingInviteUserIds, []);
});

test('league edits, schedule, and playoff settings persist after the draft starts', async () => {
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

  const record = await storage.get(`league:${leagueId}`);
  record.league.draftStarted = true;
  await storage.put(`league:${leagueId}`, record);
  const updatedLeague = structuredClone(record.league);
  updatedLeague.scoring.passTD = 6;
  updatedLeague.positionScoring.QB = { rushYards: 0.2 };
  updatedLeague.selectedWeek = 5;
  updatedLeague.playoffSettings = {
    teamCount: 2,
    startWeek: 14,
    rounds: 1,
    weeksPerRound: 2,
    weeks: 2,
    byes: false,
    reseed: false,
    consolation: false,
  };
  updatedLeague.matchupSchedule = [
    ...updatedLeague.matchupSchedule.slice(0, 13),
    ...Array.from({ length: 5 }, () => []),
  ];
  const { response: saveResponse, data: saved } = await storeRequest(store, 'save', {
    userId: 'account-1',
    leagueId,
    league: updatedLeague,
    revision: record.revision,
  });

  assert.equal(saveResponse.status, 200);
  assert.equal(saved.revision, 2);
  const { response: loadResponse, data: loaded } = await storeRequest(store, 'load', {
    userId: 'account-1',
    leagueId,
  });
  assert.equal(loadResponse.status, 200);
  assert.equal(loaded.league.scoring.passTD, 6);
  assert.deepEqual(loaded.league.positionScoring, { QB: { rushYards: 0.2 } });
  assert.equal(loaded.league.selectedWeek, 5);
  assert.deepEqual(loaded.league.playoffSettings, updatedLeague.playoffSettings);
  assert.deepEqual(loaded.league.matchupSchedule, updatedLeague.matchupSchedule);
  assert.equal(loaded.revision, 2);

  const invalidScoringLeague = structuredClone(loaded.league);
  invalidScoringLeague.positionScoring.QB.rushYards = 1001;
  const invalidScoring = await storeRequest(store, 'save', {
    userId: 'account-1',
    leagueId,
    league: invalidScoringLeague,
    revision: loaded.revision,
  });
  assert.equal(invalidScoring.response.status, 403);
  assert.match(invalidScoring.data.error, /Position scoring values are invalid/);
});

test('new leagues get balanced matchups before the draft', async () => {
  const { store } = createStore();
  const { response, data } = await storeRequest(store, 'create', {
    userId: 'commissioner',
    username: 'Commissioner',
    league: {
      name: 'Balanced Schedule',
      teamCount: 4,
      managers: Array.from({ length: 4 }, (_, index) => ({ teamName: `Team ${index + 1}` })),
      rosterSlots: { QB: 1 },
    },
  });

  assert.equal(response.status, 200);
  assert.equal(data.league.picks.length, 0);
  assert.deepEqual(data.league.managers.map((team) => team.teamAbbreviation), ['T1', 'T2', 'T3', 'T4']);
  assert.equal(data.league.matchupSchedule.length, 18);
  const pairCounts = new Map();
  data.league.matchupSchedule.forEach((week, index) => {
    const teamsPlaying = week.flat();
    if (index >= data.league.playoffSettings.startWeek - 1) {
      assert.deepEqual(week, []);
      return;
    }
    assert.equal(new Set(teamsPlaying).size, 4);
    for (const [first, second] of week) {
      const key = [first, second].sort().join(':');
      pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
    }
  });
  assert.equal(pairCounts.size, 6);
  assert.deepEqual([...pairCounts.values()], Array(6).fill(5));
  assert.deepEqual(data.league.playoffSettings, {
    teamCount: 4,
    startWeek: 16,
    rounds: 2,
    weeksPerRound: 1,
    weeks: 2,
    byes: false,
    reseed: true,
    consolation: true,
  });
});

test('weekly schedules remain balanced for every supported league size', async () => {
  for (let teamCount = 2; teamCount <= 16; teamCount += 1) {
    const { store } = createStore();
    const { response, data } = await storeRequest(store, 'create', {
      userId: 'commissioner',
      username: 'Commissioner',
      league: {
        name: `League of ${teamCount}`,
        teamCount,
        managers: Array.from({ length: teamCount }, (_, index) => ({ teamName: `Team ${index + 1}` })),
        rosterSlots: { QB: 1 },
      },
    });

    assert.equal(response.status, 200);
    const pairCounts = new Map();
    data.league.matchupSchedule.forEach((week, index) => {
      const teamsPlaying = week.flat();
      if (index >= data.league.playoffSettings.startWeek - 1) {
        assert.deepEqual(week, []);
        return;
      }
      assert.equal(teamsPlaying.length, teamCount - (teamCount % 2));
      assert.equal(new Set(teamsPlaying).size, teamsPlaying.length);
      for (const [first, second] of week) {
        const key = [first, second].sort().join(':');
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    });
    const counts = [...pairCounts.values()];
    assert.equal(pairCounts.size, (teamCount * (teamCount - 1)) / 2);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `${teamCount}-team schedule is unbalanced`);
  }
});

test('playoff weeks are reserved and 6-team brackets require seeded byes', async () => {
  const { store, storage } = createStore();
  const { data: created } = await storeRequest(store, 'create', {
    userId: 'commissioner',
    username: 'Commissioner',
    league: {
      name: 'Six Seeds',
      teamCount: 6,
      managers: Array.from({ length: 6 }, (_, index) => ({ teamName: `Team ${index + 1}` })),
      rosterSlots: { QB: 1 },
    },
  });
  const leagueId = created.league.leagueId;
  assert.equal(created.league.playoffSettings.teamCount, 6);
  assert.equal(created.league.playoffSettings.rounds, 3);
  assert.equal(created.league.playoffSettings.byes, true);

  const record = await storage.get(`league:${leagueId}`);
  const invalidLeague = structuredClone(record.league);
  invalidLeague.matchupSchedule[invalidLeague.playoffSettings.startWeek - 1] = [
    [invalidLeague.managers[0].id, invalidLeague.managers[1].id],
  ];
  const { response, data } = await storeRequest(store, 'save', {
    userId: created.league.commissionerUserId,
    leagueId,
    league: invalidLeague,
    revision: record.revision,
  });
  assert.equal(response.status, 403, JSON.stringify(data));
  assert.match(data.error, /extends into playoff weeks/);

  invalidLeague.matchupSchedule = record.league.matchupSchedule;
  invalidLeague.playoffSettings.byes = false;
  const invalidFormat = await storeRequest(store, 'save', {
    userId: created.league.commissionerUserId,
    leagueId,
    league: invalidLeague,
    revision: record.revision,
  });
  assert.equal(invalidFormat.response.status, 403);
  assert.match(invalidFormat.data.error, /Playoff settings are invalid/);
});

test('changing league size before the draft rebuilds the schedule for all teams', async () => {
  const { store } = createStore();
  const { data: created } = await storeRequest(store, 'create', {
    userId: 'commissioner',
    username: 'Commissioner',
    league: {
      name: 'Growing League',
      teamCount: 2,
      managers: [{ teamName: 'Team 1' }, { teamName: 'Team 2' }],
      rosterSlots: { QB: 1 },
    },
  });
  const { response, data } = await storeRequest(store, 'manage-teams', {
    userId: 'commissioner',
    username: 'Commissioner',
    leagueId: created.league.leagueId,
    teamCount: 4,
    claimTeamIds: [],
    revision: created.revision,
  });

  assert.equal(response.status, 200);
  assert.equal(data.league.teamCount, 4);
  assert.equal(data.league.matchupSchedule.length, 18);
  for (const [index, week] of data.league.matchupSchedule.entries()) {
    if (index >= data.league.playoffSettings.startWeek - 1) {
      assert.deepEqual(week, []);
      continue;
    }
    assert.equal(new Set(week.flat()).size, 4);
  }
});

test('commissioner can unclaim an empty team by omitting it from selected team ids', async () => {
  const { store, storage } = createStore();
  const { data: created } = await storeRequest(store, 'create', {
    userId: 'commissioner',
    username: 'Commissioner',
    league: {
      name: 'Team Claims',
      teamCount: 2,
      managers: [{ teamName: 'Commissioner Team' }, { teamName: 'Team 2' }],
      rosterSlots: { QB: 1 },
    },
  });
  const leagueId = created.league.leagueId;
  const teamId = created.league.managers[1].id;
  const originalClaimIds = created.league.managers
    .filter((team) => team.ownerUserId === 'commissioner')
    .map((team) => team.id);
  const claimed = await storeRequest(store, 'manage-teams', {
    userId: 'commissioner',
    username: 'Commissioner',
    leagueId,
    teamCount: 2,
    claimTeamIds: [...originalClaimIds, teamId],
    revision: created.revision,
  });
  assert.equal(claimed.response.status, 200);
  assert.equal(claimed.data.league.managers[1].ownerUserId, 'commissioner');
  assert.ok(claimed.data.userTeamIds.includes(teamId));

  const released = await storeRequest(store, 'manage-teams', {
    userId: 'commissioner',
    username: 'Commissioner',
    leagueId,
    teamCount: 2,
    claimTeamIds: originalClaimIds,
    revision: claimed.data.revision,
  });
  assert.equal(released.response.status, 200);
  assert.equal(released.data.league.managers[1].ownerUserId, null);
  assert.equal(released.data.league.managers[1].name, 'Open team');
  assert.ok(!released.data.userTeamIds.includes(teamId));

  const reclaimed = await storeRequest(store, 'manage-teams', {
    userId: 'commissioner',
    username: 'Commissioner',
    leagueId,
    teamCount: 2,
    claimTeamIds: [...originalClaimIds, teamId],
    revision: released.data.revision,
  });
  assert.equal(reclaimed.response.status, 200);
  const record = await storage.get(`league:${leagueId}`);
  record.league.managers[1].roster.push({ id: 'player-1' });
  await storage.put(`league:${leagueId}`, record);
  const cannotReleaseRosteredTeam = await storeRequest(store, 'manage-teams', {
    userId: 'commissioner',
    username: 'Commissioner',
    leagueId,
    teamCount: 2,
    claimTeamIds: originalClaimIds,
    revision: reclaimed.data.revision,
  });
  assert.equal(cannotReleaseRosteredTeam.response.status, 409);
  assert.match(cannotReleaseRosteredTeam.data.error, /Move or drop players/);
});

test('loading a legacy league creates and saves missing schedule and playoff defaults', async () => {
  const { store, storage } = createStore([
    ['league:legacy-league', {
      league: {
        leagueId: 'legacy-league',
        name: 'Legacy League',
        teamCount: 2,
        commissionerUserId: 'commissioner',
        managers: [
          { id: 'team-1', ownerUserId: 'commissioner', teamName: 'Sunday Scaries', roster: [] },
          { id: 'team-2', ownerUserId: null, teamName: 'Team 2', roster: [] },
        ],
      },
      revision: 1,
    }],
  ]);
  const { response, data } = await storeRequest(store, 'load', {
    userId: 'commissioner',
    leagueId: 'legacy-league',
  });

  assert.equal(response.status, 200);
  assert.equal(data.revision, 2);
  assert.equal(data.league.matchupSchedule.length, 18);
  assert.deepEqual(data.league.playoffSettings, {
    teamCount: 2,
    startWeek: 16,
    rounds: 1,
    weeksPerRound: 1,
    weeks: 1,
    byes: false,
    reseed: true,
    consolation: true,
  });
  assert.deepEqual(data.league.managers.map((team) => team.teamAbbreviation), ['SS', 'T2']);
  assert.deepEqual((await storage.get('league:legacy-league')).league.managers.map((team) => team.teamAbbreviation), ['SS', 'T2']);
  assert.equal((await storage.get('league:legacy-league')).revision, 2);
});

test('a manager cannot change commissioner settings or another team abbreviation', async () => {
  const { store, storage } = createStore();
  const { data: created } = await storeRequest(store, 'create', {
    userId: 'commissioner',
    username: 'Commissioner',
    league: {
      name: 'Protected Settings',
      teamCount: 2,
      managers: [{ teamName: 'Team 1' }, { teamName: 'Team 2' }],
      rosterSlots: { QB: 1 },
    },
  });
  const record = await storage.get(`league:${created.league.leagueId}`);
  record.league.managers[1].ownerUserId = 'manager';
  await storage.put(`league:${created.league.leagueId}`, record);

  const updatedLeague = structuredClone(record.league);
  updatedLeague.matchupSchedule.reverse();
  updatedLeague.playoffSettings.weeks = 2;
  updatedLeague.positionScoring.QB = { rushYards: 0.2 };
  updatedLeague.managers[0].teamAbbreviation = 'NEW';
  const { response, data } = await storeRequest(store, 'save', {
    userId: 'manager',
    leagueId: created.league.leagueId,
    league: updatedLeague,
    revision: record.revision,
  });

  assert.equal(response.status, 403);
  assert.match(data.error, /Only the commissioner/);
});

test('new leagues reject invalid team abbreviations', async () => {
  const { store } = createStore();
  const { response, data } = await storeRequest(store, 'create', {
    userId: 'commissioner',
    username: 'Commissioner',
    league: {
      name: 'Invalid Abbreviation',
      teamCount: 2,
      managers: [
        { teamName: 'Home Team', teamAbbreviation: 'HOME' },
        { teamName: 'Away Team', teamAbbreviation: 'TOO-LONG' },
      ],
      rosterSlots: { QB: 1 },
    },
  });

  assert.equal(response.status, 400);
  assert.match(data.error, /abbreviation/);
});

test('a manager can save their own team abbreviation', async () => {
  const { store, storage } = createStore();
  const { data: created } = await storeRequest(store, 'create', {
    userId: 'commissioner',
    username: 'Commissioner',
    league: {
      name: 'Team Identity',
      teamCount: 2,
      managers: [{ teamName: 'Commissioner Team' }, { teamName: 'Manager Team' }],
      rosterSlots: { QB: 1 },
    },
  });
  const record = await storage.get(`league:${created.league.leagueId}`);
  record.league.managers[1].ownerUserId = 'manager';
  await storage.put(`league:${created.league.leagueId}`, record);
  const updatedLeague = structuredClone(record.league);
  updatedLeague.managers[1].teamAbbreviation = 'MGR';

  const { response, data } = await storeRequest(store, 'save', {
    userId: 'manager',
    leagueId: created.league.leagueId,
    league: updatedLeague,
    revision: record.revision,
  });

  assert.equal(response.status, 200);
  assert.equal(data.success, true);
  assert.equal((await storage.get(`league:${created.league.leagueId}`)).league.managers[1].teamAbbreviation, 'MGR');
});

test('a commissioner can invite an existing account by email', async () => {
  const inviteeEmail = 'manager@example.com';
  let inviteNotification;
  const fantasyStore = new FantasyLeagueStore({ storage: new MemoryStorage([
    ['league:league-1', {
      league: {
        leagueId: 'league-1',
        name: 'Sunday League',
        commissionerUserId: 'commissioner',
        managers: [
          { id: 'team-1', ownerUserId: 'commissioner', teamName: 'Commissioner Team', roster: [] },
          { id: 'team-2', ownerUserId: null, teamName: 'Open Team', roster: [] },
        ],
        pendingInviteUserIds: [],
      },
      revision: 1,
    }],
    ['user:commissioner', { leagueIds: ['league-1'], invitations: [] }],
  ]) });
  const identityUserId = 'commissioner';
  const invitedUserId = `user_${[...inviteeEmail].reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0)}`;
  const env = {
    SESSION: {
      idFromName: (id) => id,
      get: () => ({
        fetch: async () => Response.json({ userId: identityUserId }),
      }),
    },
    USER_ACCOUNT: {
      idFromName: (id) => id,
      get: (id) => ({
        fetch: async () => Response.json(id === identityUserId
          ? { userId: id, username: 'Commissioner' }
          : { userId: id, username: 'ManagerName', email: inviteeEmail }),
      }),
    },
    FANTASY_LEAGUE: {
      idFromName: (id) => id,
      get: () => ({
        fetch: (request) => fantasyStore.fetch(request),
      }),
    },
  };
  const request = new Request('https://ahrenslabs.com/api/fantasy/leagues/league-1/invitations', {
    method: 'POST',
    headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail: ' MANAGER@example.com ', teamId: 'team-2' }),
  });

  const response = await handleFantasyRequest(request, env, {}, '/api/fantasy/leagues/league-1/invitations', {
    notifyInvitation: async (notice) => { inviteNotification = notice; },
  });

  assert.equal(response.status, 200);
  const responseData = await response.json();
  assert.equal(responseData.success, true);
  assert.equal(responseData.revision, 2);
  assert.deepEqual(responseData.league.pendingInviteUserIds, [invitedUserId]);
  assert.deepEqual(inviteNotification, {
    inviteeUserId: invitedUserId,
    recipientName: 'ManagerName',
    inviterName: 'Commissioner',
    leagueName: 'Sunday League',
    teamName: 'Open Team',
  });
});

test('waiver claims use rolling priority and advance it after a successful award', async () => {
  const league = {
    leagueId: 'league-1',
    commissionerUserId: 'commissioner',
    teamCount: 2,
    draftStarted: true,
    managers: [
      { id: 'team-1', ownerUserId: 'commissioner', roster: [] },
      {
        id: 'team-2',
        ownerUserId: 'manager',
        roster: [{ id: 'old-1' }, { id: 'old-2' }],
      },
    ],
    rosterSlots: { QB: 1, RB: 1 },
    waiverSettings: { enabled: true, periodHours: 24 },
    waiverPriorityTeamIds: ['team-2', 'team-1'],
    waiverPriorityWeek: 0,
    draftOrder: ['team-1', 'team-2'],
    matchupSchedule: [[['team-1', 'team-2']]],
    matchupResults: { 1: { 'team-1': 100, 'team-2': 80 } },
    waiverWindows: {},
    pendingWaiverClaims: [],
  };
  const { store, storage } = createStore([['league:league-1', { league, revision: 1 }]]);
  const player = { id: 'player-1', name: 'Test Player', position: 'RB', team: 'SEA' };

  const firstClaim = await storeRequest(store, 'claim-waiver', {
    leagueId: 'league-1',
    userId: 'commissioner',
    teamId: 'team-1',
    player,
  });
  const secondClaim = await storeRequest(store, 'claim-waiver', {
    leagueId: 'league-1',
    userId: 'manager',
    teamId: 'team-2',
    player,
    dropPlayerId: 'old-1',
  });

  assert.equal(firstClaim.response.status, 200);
  assert.equal(secondClaim.response.status, 200);
  const saved = await storage.get('league:league-1');
  saved.league.waiverWindows['player-1'] = Date.now() - 1;
  await storage.put('league:league-1', saved);
  const processed = await storeRequest(store, 'process-waivers', {});

  assert.equal(processed.response.status, 200);
  const awarded = await storage.get('league:league-1');
  assert.deepEqual(awarded.league.managers[0].roster, []);
  assert.deepEqual(
    awarded.league.managers[1].roster.map((rosteredPlayer) => rosteredPlayer.id),
    ['old-2', 'player-1'],
  );
  assert.deepEqual(awarded.league.waiverPriorityTeamIds, ['team-1', 'team-2']);
  assert.equal(awarded.league.waiverPriorityWeek, 1);
  assert.deepEqual(awarded.league.pendingWaiverClaims, []);
  assert.ok(awarded.league.waiverWindows['old-1'] > Date.now());
  assert.deepEqual(awarded.league.waiverWindows['player-1'], undefined);

  awarded.league.matchupSchedule.push([['team-1', 'team-2']]);
  awarded.league.matchupResults[2] = { 'team-1': 70, 'team-2': 120 };
  await storage.put('league:league-1', awarded);
  const nextWeek = await storeRequest(store, 'process-waivers', {});
  assert.equal(nextWeek.response.status, 200);
  const reset = await storage.get('league:league-1');
  assert.equal(reset.league.waiverPriorityWeek, 2);
  assert.deepEqual(reset.league.waiverPriorityTeamIds, ['team-1', 'team-2']);
});

test('free agents without active claims can be picked up immediately', async () => {
  const league = {
    leagueId: 'league-1',
    commissionerUserId: 'commissioner',
    teamCount: 2,
    draftStarted: true,
    managers: [
      { id: 'team-1', ownerUserId: 'commissioner', roster: [{ id: 'old-player' }] },
      { id: 'team-2', ownerUserId: 'manager', roster: [] },
    ],
    rosterSlots: { QB: 1 },
    waiverSettings: { enabled: true, periodHours: 24 },
    waiverWindows: {},
    pendingWaiverClaims: [],
  };
  const { store, storage } = createStore([['league:league-1', { league, revision: 1 }]]);
  const pickedUp = await storeRequest(store, 'pickup-free-agent', {
    leagueId: 'league-1',
    userId: 'commissioner',
    teamId: 'team-1',
    player: { id: 'free-agent', name: 'Free Agent', position: 'QB', team: 'SEA' },
    dropPlayerId: 'old-player',
  });

  assert.equal(pickedUp.response.status, 200);
  assert.equal(pickedUp.data.league.managers[0].roster[0].id, 'free-agent');
  assert.ok(pickedUp.data.league.waiverWindows['old-player'] > Date.now());
  assert.deepEqual((await storage.get('league:league-1')).league.pendingWaiverClaims, []);
});

test('authenticated waiver pickup API routes immediate additions to the league store', async () => {
  const league = {
    leagueId: 'league-1',
    commissionerUserId: 'commissioner',
    teamCount: 2,
    draftStarted: true,
    managers: [
      { id: 'team-1', ownerUserId: 'commissioner', roster: [] },
      { id: 'team-2', ownerUserId: 'manager', roster: [] },
    ],
    rosterSlots: { QB: 1 },
    waiverSettings: { enabled: true, periodHours: 24 },
    waiverWindows: {},
    pendingWaiverClaims: [],
  };
  const { store } = createStore([['league:league-1', { league, revision: 1 }]]);
  const env = {
    SESSION: {
      idFromName: (id) => id,
      get: () => ({ fetch: async () => Response.json({ userId: 'commissioner' }) }),
    },
    USER_ACCOUNT: {
      idFromName: (id) => id,
      get: () => ({ fetch: async () => Response.json({ username: 'Commissioner' }) }),
    },
    FANTASY_LEAGUE: {
      idFromName: (id) => id,
      get: () => ({ fetch: (request) => store.fetch(request) }),
    },
  };
  const request = new Request('https://ahrenslabs.com/api/fantasy/leagues/league-1/waivers/pickup', {
    method: 'POST',
    headers: { Authorization: 'Bearer session-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamId: 'team-1',
      player: { id: 'free-agent', name: 'Free Agent', position: 'QB' },
    }),
  });

  const response = await handleFantasyRequest(
    request,
    env,
    {},
    '/api/fantasy/leagues/league-1/waivers/pickup',
  );
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.league.managers[0].roster[0].id, 'free-agent');
});

test('free-agent pickup rejects players with an active waiver window', async () => {
  const processAt = Date.now() + 60_000;
  const league = {
    leagueId: 'league-1',
    commissionerUserId: 'commissioner',
    teamCount: 2,
    draftStarted: true,
    managers: [
      { id: 'team-1', ownerUserId: 'commissioner', roster: [] },
      { id: 'team-2', ownerUserId: 'manager', roster: [] },
    ],
    rosterSlots: { QB: 1, BENCH: 1 },
    waiverSettings: { enabled: true, periodHours: 24 },
    waiverWindows: { 'waived-player': processAt },
    pendingWaiverClaims: [{
      id: 'claim-1',
      player: { id: 'waived-player', name: 'Waived Player', position: 'QB' },
      teamId: 'team-2',
      userId: 'manager',
      createdAt: Date.now(),
      processAt,
    }],
  };
  const { store } = createStore([['league:league-1', { league, revision: 1 }]]);
  const attemptedPickup = await storeRequest(store, 'pickup-free-agent', {
    leagueId: 'league-1',
    userId: 'commissioner',
    teamId: 'team-1',
    player: { id: 'waived-player', name: 'Waived Player', position: 'QB', team: 'SEA' },
  });

  assert.equal(attemptedPickup.response.status, 409);
  assert.match(attemptedPickup.data.error, /on waivers until/i);
});

test('a manager cannot change commissioner-controlled waiver settings', async () => {
  const schedule = Array.from({ length: 18 }, () => [['team-1', 'team-2']]);
  const league = {
    leagueId: 'league-1',
    name: 'League',
    commissionerUserId: 'commissioner',
    teamCount: 2,
    managers: [
      { id: 'team-1', ownerUserId: 'commissioner', name: 'Commissioner', teamName: 'Team 1', teamAbbreviation: 'T1', roster: [] },
      { id: 'team-2', ownerUserId: 'manager', name: 'Manager', teamName: 'Team 2', teamAbbreviation: 'T2', roster: [] },
    ],
    rosterSlots: { QB: 1 },
    scoring: {},
    draftOrder: ['team-1', 'team-2'],
    matchupSchedule: schedule,
    playoffSettings: { teamCount: 2, startWeek: 15, weeks: 3, reseed: true, consolation: true },
    waiverSettings: { enabled: true, periodHours: 48 },
    waiverPriorityTeamIds: ['team-2', 'team-1'],
    waiverWindows: {},
    pendingWaiverClaims: [],
    draftStarted: false,
    draftAt: null,
    picks: [],
    trades: [],
    pendingInviteUserIds: [],
  };
  const { store } = createStore([['league:league-1', { league, revision: 1 }]]);
  const updated = structuredClone(league);
  updated.waiverSettings.enabled = false;

  const { response, data } = await storeRequest(store, 'save', {
    leagueId: 'league-1',
    userId: 'manager',
    revision: 1,
    league: updated,
  });

  assert.equal(response.status, 403);
  assert.match(data.error, /commissioner/i);
});

test('the Fantasy API routes authenticated waiver claims to the league store', async () => {
  const league = {
    leagueId: 'league-1',
    commissionerUserId: 'manager',
    teamCount: 2,
    draftStarted: true,
    managers: [
      { id: 'team-1', ownerUserId: 'manager', roster: [] },
      { id: 'team-2', ownerUserId: 'other', roster: [] },
    ],
    rosterSlots: { QB: 1, RB: 1 },
    waiverSettings: { enabled: true, periodHours: 24 },
    waiverPriorityTeamIds: ['team-2', 'team-1'],
    waiverWindows: {},
    pendingWaiverClaims: [],
  };
  const fantasyStore = new FantasyLeagueStore({
    storage: new MemoryStorage([['league:league-1', { league, revision: 1 }]]),
  });
  const env = {
    SESSION: {
      idFromName: (id) => id,
      get: () => ({ fetch: async () => Response.json({ userId: 'manager' }) }),
    },
    USER_ACCOUNT: {
      idFromName: (id) => id,
      get: () => ({ fetch: async () => Response.json({ username: 'Manager' }) }),
    },
    FANTASY_LEAGUE: {
      idFromName: (id) => id,
      get: () => ({ fetch: (request) => fantasyStore.fetch(request) }),
    },
  };
  const request = new Request('https://ahrenslabs.com/api/fantasy/leagues/league-1/waivers/claims', {
    method: 'POST',
    headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamId: 'team-1',
      player: { id: 'player-1', name: 'Test Player', position: 'RB', team: 'SEA' },
    }),
  });

  const response = await handleFantasyRequest(
    request,
    env,
    {},
    '/api/fantasy/leagues/league-1/waivers/claims',
  );
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.userTeamId, 'team-1');
  assert.equal(data.league.pendingWaiverClaims.length, 1);
});

test('the Fantasy API accepts an invitation and returns the joined league', async () => {
  const fantasyStore = new FantasyLeagueStore({
    storage: new MemoryStorage([
      ['league:league-1', {
        league: {
          leagueId: 'league-1',
          commissionerUserId: 'commissioner',
          managers: [
            { id: 'team-1', ownerUserId: 'commissioner', roster: [] },
            { id: 'team-2', ownerUserId: null, teamName: 'Team 2', roster: [] },
          ],
          pendingInviteUserIds: ['manager'],
        },
        revision: 1,
      }],
      ['user:manager', {
        leagueIds: [],
        invitations: [{ leagueId: 'league-1', teamId: 'team-2', teamName: 'Team 2' }],
      }],
    ]),
  });
  const env = {
    SESSION: {
      idFromName: (id) => id,
      get: () => ({ fetch: async () => Response.json({ userId: 'manager' }) }),
    },
    USER_ACCOUNT: {
      idFromName: (id) => id,
      get: () => ({ fetch: async () => Response.json({ username: 'Manager' }) }),
    },
    FANTASY_LEAGUE: {
      idFromName: (id) => id,
      get: () => ({ fetch: (request) => fantasyStore.fetch(request) }),
    },
  };
  const request = new Request('https://ahrenslabs.com/api/fantasy/invitations/accept', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leagueId: 'league-1',
      teamId: 'team-2',
      teamName: "Manager's Team",
      teamAbbreviation: 'MT',
    }),
  });

  const response = await handleFantasyRequest(
    request,
    env,
    {},
    '/api/fantasy/invitations/accept',
  );
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.leagueId, 'league-1');
  assert.equal(data.userTeamId, 'team-2');
  assert.equal(data.league.managers[1].ownerUserId, 'manager');
  assert.equal(data.league.managers[1].teamAbbreviation, 'MT');
});
