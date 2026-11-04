const STORE_ID = 'fantasy-leagues-v1';
const LEAGUE_PREFIX = 'league:';
const USER_PREFIX = 'user:';
const MAX_TEAMS = 16;
const MAX_ROSTER_SLOTS = 30;
const SEASON_WEEKS = 18;
const ROSTER_POSITIONS = [
  'QB', 'RB', 'WR', 'TE', 'K', 'D/ST', 'DL', 'DE', 'DT', 'LB', 'DB', 'CB', 'S', 'P', 'FLEX', 'BENCH',
];

function randomIndex(max) {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return Math.floor((value[0] / 0x100000000) * max);
}

function shuffled(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function generateMatchupSchedule(teamIds, playoffSettings) {
  const regularSeasonWeeks = Math.max(0, Math.min(SEASON_WEEKS, Number(playoffSettings?.startWeek || SEASON_WEEKS + 1) - 1));
  if (!regularSeasonWeeks) return Array.from({ length: SEASON_WEEKS }, () => []);
  const rotation = shuffled(teamIds);
  if (rotation.length % 2) rotation.push(null);
  const rounds = [];
  for (let round = 0; round < rotation.length - 1; round += 1) {
    const matchups = [];
    for (let index = 0; index < rotation.length / 2; index += 1) {
      const first = rotation[index];
      const second = rotation[rotation.length - 1 - index];
      if (first && second) {
        matchups.push(randomIndex(2) ? [first, second] : [second, first]);
      }
    }
    rounds.push(matchups);
    rotation.splice(1, 0, rotation.pop());
  }
  const roundInstances = [];
  if (regularSeasonWeeks % 2 === 0 && rounds.length <= regularSeasonWeeks / 2) {
    const baseCount = Math.floor((regularSeasonWeeks / 2) / rounds.length);
    const extraCount = Math.floor(regularSeasonWeeks / 2) % rounds.length;
    const extraRounds = new Set(shuffled(rounds.map((_, index) => index)).slice(0, extraCount));
    rounds.forEach((round, index) => {
      const repeats = 2 * (baseCount + Number(extraRounds.has(index)));
      for (let repeat = 0; repeat < repeats; repeat += 1) roundInstances.push(round);
    });
  } else {
    const baseCount = Math.floor(regularSeasonWeeks / rounds.length);
    const extraCount = regularSeasonWeeks % rounds.length;
    const extraRounds = new Set(shuffled(rounds.map((_, index) => index)).slice(0, extraCount));
    rounds.forEach((round, index) => {
      const repeats = baseCount + Number(extraRounds.has(index));
      for (let repeat = 0; repeat < repeats; repeat += 1) roundInstances.push(round);
    });
  }
  while (roundInstances.length < regularSeasonWeeks) {
    roundInstances.push(rounds[randomIndex(rounds.length)]);
  }
  const regularSchedule = shuffled(roundInstances).map((round) =>
    round.map((matchup) => (randomIndex(2) ? [...matchup] : [...matchup].reverse())));
  return [
    ...regularSchedule,
    ...Array.from({ length: SEASON_WEEKS - regularSchedule.length }, () => []),
  ];
}

function validMatchupSchedule(schedule, teamIds, playoffSettings) {
  if (!Array.isArray(schedule) || schedule.length !== SEASON_WEEKS) return false;
  const validIds = new Set(teamIds);
  return schedule.every((matchups, weekIndex) => {
    if (!Array.isArray(matchups)) return false;
    const weekTeams = matchups.flat();
    if (matchups.some((pair) => !Array.isArray(pair) || pair.length !== 2
      || pair[0] === pair[1] || pair.some((id) => typeof id !== 'string' || !validIds.has(id)))) return false;
    if (new Set(weekTeams).size !== weekTeams.length) return false;
    if (playoffSettings && weekIndex >= Number(playoffSettings.startWeek) - 1) return weekTeams.length === 0;
    return weekTeams.length === teamIds.length - (teamIds.length % 2);
  });
}

function validPlayoffSettings(settings, teamCount) {
  const allowedTeamCounts = [2, 4, 6, 8];
  const playoffTeamCount = Number(settings?.teamCount);
  const rounds = Math.ceil(Math.log2(playoffTeamCount));
  return settings && typeof settings === 'object'
    && allowedTeamCounts.includes(playoffTeamCount)
    && playoffTeamCount <= teamCount
    && (playoffTeamCount !== 6 || settings.byes === true)
    && Number(settings.rounds) === rounds
    && [1, 2].includes(Number(settings.weeksPerRound))
    && Number(settings.weeks) === rounds * Number(settings.weeksPerRound)
    && Number.isInteger(Number(settings.startWeek))
    && Number(settings.startWeek) >= 1
    && Number(settings.startWeek) <= SEASON_WEEKS
    && Number.isInteger(Number(settings.weeks))
    && Number(settings.weeks) >= 1
    && Number(settings.startWeek) + Number(settings.weeks) - 1 <= SEASON_WEEKS
    && typeof settings.byes === 'boolean'
    && typeof settings.reseed === 'boolean'
    && typeof settings.consolation === 'boolean';
}

function defaultPlayoffSettings(teamCount, previous = {}) {
  const playoffTeamCount = [8, 6, 4, 2].find((count) => count <= teamCount) || 2;
  const rounds = Math.ceil(Math.log2(playoffTeamCount));
  const weeksPerRound = Number(previous.weeks) >= rounds * 2 ? 2 : 1;
  const weeks = rounds * weeksPerRound;
  const startWeek = Math.min(
    Math.max(1, Number(previous.startWeek) || 16),
    SEASON_WEEKS - weeks + 1,
  );
  return {
    teamCount: playoffTeamCount,
    startWeek,
    rounds,
    weeksPerRound,
    weeks,
    byes: playoffTeamCount === 6 || previous.byes === true,
    reseed: previous.reseed !== false,
    consolation: previous.consolation !== false,
  };
}

function validWaiverSettings(settings) {
  return settings && typeof settings === 'object'
    && typeof settings.enabled === 'boolean'
    && [24, 48, 72, 168].includes(Number(settings.periodHours));
}

function validDraftSettings(settings, teamCount) {
  return settings && typeof settings === 'object'
    && ['snake', 'auction'].includes(settings.type)
    && Number.isInteger(Number(settings.auctionBudget))
    && Number(settings.auctionBudget) >= 100
    && Number(settings.auctionBudget) <= 1000
    && [15, 30, 45, 60].includes(Number(settings.auctionClockSeconds))
    && Array.isArray(settings.order)
    && settings.order.length === teamCount
    && new Set(settings.order).size === teamCount;
}

export async function processScheduledFantasyWaivers(env) {
  if (!env.FANTASY_LEAGUE) throw new Error('Fantasy league storage is not configured.');
  const store = env.FANTASY_LEAGUE.get(env.FANTASY_LEAGUE.idFromName(STORE_ID));
  const response = await store.fetch(new Request('https://fantasy.internal/process-waivers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }));
  if (!response.ok) throw new Error(`Fantasy waiver processing failed with status ${response.status}.`);
}

export async function handleFantasyRequest(request, env, corsHeaders, path, { executionCtx, notifyInvitation } = {}) {
  const identity = await getIdentity(request, env);
  if (!identity) return fantasyJson({ error: 'Sign in with an Ahrens Labs account to use Fantasy Football.' }, 401, corsHeaders);

  if (!env.FANTASY_LEAGUE) {
    return fantasyJson({ error: 'Fantasy league storage is not configured.' }, 503, corsHeaders);
  }

  const store = env.FANTASY_LEAGUE.get(env.FANTASY_LEAGUE.idFromName(STORE_ID));
  const send = async (action, data = {}) => {
    const response = await store.fetch(new Request(`https://fantasy.internal/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, userId: identity.userId, username: identity.username }),
    }));
    const result = await response.json();
    result.userId = identity.userId;
    if (Array.isArray(result.league?.managers)) {
      result.userTeamIds = result.league.managers
        .filter((team) => team.ownerUserId === identity.userId)
        .map((team) => team.id);
      result.userTeamId = result.userTeamIds[0] || '';
    }
    return fantasyJson(result, response.status, corsHeaders);
  };

  try {
    if (path === '/api/fantasy/leagues' && request.method === 'GET') {
      return send('list', { username: identity.username });
    }
    if (path === '/api/fantasy/leagues' && request.method === 'POST') {
      const body = await readFantasyBody(request);
      if (!body) return fantasyJson({ error: 'Invalid request body.' }, 400, corsHeaders);
      return send('create', { league: body.league });
    }
    if (path === '/api/fantasy/invitations/accept' && request.method === 'POST') {
      const body = await readFantasyBody(request);
      if (!body) return fantasyJson({ error: 'Invalid request body.' }, 400, corsHeaders);
      return send('accept-invitation', body);
    }
    if (path === '/api/fantasy/invitations/decline' && request.method === 'POST') {
      const body = await readFantasyBody(request);
      if (!body) return fantasyJson({ error: 'Invalid request body.' }, 400, corsHeaders);
      return send('decline-invitation', body);
    }

    const match = path.match(/^\/api\/fantasy\/leagues\/([^/]+)(?:\/(invitations|schedule|teams|leave|draft-settings|auction|draft-pick|waivers\/claims(?:\/[^/]+)?))?$/);
    if (!match) return fantasyJson({ error: 'Not found.' }, 404, corsHeaders);
    const leagueId = decodeURIComponent(match[1]);
    if (!leagueId || leagueId.length > 100) return fantasyJson({ error: 'Invalid league id.' }, 400, corsHeaders);

    if (!match[2] && request.method === 'GET') return send('load', { leagueId });
    if (!match[2] && request.method === 'PUT') {
      const body = await readFantasyBody(request);
      if (!body) return fantasyJson({ error: 'Invalid request body.' }, 400, corsHeaders);
      return send('save', { leagueId, league: body.league, revision: body.revision });
    }
    if (match[2] === 'waivers/claims' && request.method === 'POST') {
      const body = await readFantasyBody(request);
      if (!body) return fantasyJson({ error: 'Invalid request body.' }, 400, corsHeaders);
      return send('claim-waiver', {
        leagueId,
        teamId: body.teamId,
        player: body.player,
        dropPlayerId: body.dropPlayerId,
      });
    }
    if (match[2]?.startsWith('waivers/claims/') && request.method === 'DELETE') {
      return send('cancel-waiver-claim', {
        leagueId,
        claimId: decodeURIComponent(match[2].slice('waivers/claims/'.length)),
      });
    }
    if (match[2] === 'draft-settings' && request.method === 'PUT') {
      const body = await readFantasyBody(request);
      if (!body) return fantasyJson({ error: 'Invalid request body.' }, 400, corsHeaders);
      return send('draft-settings', { leagueId, ...body });
    }
    if (match[2] === 'auction' && request.method === 'POST') {
      const body = await readFantasyBody(request);
      if (!body) return fantasyJson({ error: 'Invalid request body.' }, 400, corsHeaders);
      return send('auction', { leagueId, ...body });
    }
    if (match[2] === 'draft-pick' && request.method === 'POST') {
      const body = await readFantasyBody(request);
      if (!body) return fantasyJson({ error: 'Invalid request body.' }, 400, corsHeaders);
      return send('draft-pick', { leagueId, ...body });
    }
    if (match[2] === 'invitations' && request.method === 'POST') {
      const body = await readFantasyBody(request);
      const inviteTarget = String(body?.usernameOrEmail ?? body?.username ?? '').trim();
      const teamId = String(body?.teamId || '').trim();
      if (!inviteTarget || inviteTarget.length > 254 || !teamId) {
        return fantasyJson({ error: 'Enter an Ahrens Labs username or email and choose an open team.' }, 400, corsHeaders);
      }
      let inviteeUserId;
      let inviteeUsername;
      if (inviteTarget.includes('@')) {
        const email = normalizeEmail(inviteTarget);
        if (!isValidInviteEmail(email)) return fantasyJson({ error: 'Enter a valid email address.' }, 400, corsHeaders);
        if (!env.USER_ACCOUNT) return fantasyJson({ error: 'Ahrens Labs account lookup is unavailable.' }, 503, corsHeaders);
        inviteeUserId = generateUserId(email);
        const accountStub = env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromName(inviteeUserId));
        const accountResponse = await accountStub.fetch(new Request('https://account.internal/getData'));
        const account = accountResponse.ok ? await accountResponse.json() : null;
        if (normalizeEmail(account?.email) !== email) {
          return fantasyJson({ error: 'No Ahrens Labs account was found with that email address.' }, 404, corsHeaders);
        }
        inviteeUsername = String(account.username || '').trim();
      } else {
        const username = normalizeUsername(inviteTarget);
        if (!username) return fantasyJson({ error: 'Enter a valid Ahrens Labs username.' }, 400, corsHeaders);
        if (!env.USERNAME_REGISTRY) return fantasyJson({ error: 'Ahrens Labs username lookup is unavailable.' }, 503, corsHeaders);
        const registry = env.USERNAME_REGISTRY.get(env.USERNAME_REGISTRY.idFromName('global'));
        const resolved = await registry.fetch(new Request('https://accounts.internal/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        }));
        const account = await resolved.json();
        if (!resolved.ok || !account.userId) {
          return fantasyJson({ error: account.error || 'That Ahrens Labs username was not found.' }, 404, corsHeaders);
        }
        inviteeUserId = account.userId;
        inviteeUsername = username;
      }
      const response = await send('invite', {
        leagueId,
        teamId,
        inviteeUserId,
        inviteeUsername,
      });
      if (response.ok && notifyInvitation) {
        const result = await response.clone().json();
        const notification = Promise.resolve(notifyInvitation({
          inviteeUserId,
          recipientName: inviteeUsername,
          inviterName: identity.username,
          leagueName: result.invitation?.leagueName || '',
          teamName: result.invitation?.teamName || '',
        })).catch((error) => {
          console.error('Fantasy invitation email failed:', error);
        });
        if (executionCtx?.waitUntil) executionCtx.waitUntil(notification);
        else await notification;
      }
      return response;
    }
    if (match[2] === 'schedule' && request.method === 'PUT') {
      const body = await readFantasyBody(request);
      if (!body) return fantasyJson({ error: 'Invalid request body.' }, 400, corsHeaders);
      return send('schedule', { leagueId, draftAt: body.draftAt, revision: body.revision });
    }
    if (match[2] === 'teams' && request.method === 'PUT') {
      const body = await readFantasyBody(request);
      if (!body) return fantasyJson({ error: 'Invalid request body.' }, 400, corsHeaders);
      return send('manage-teams', {
        leagueId,
        teamCount: body.teamCount,
        claimTeamIds: body.claimTeamIds,
        revision: body.revision,
      });
    }
    if (match[2] === 'leave' && request.method === 'POST') {
      return send('leave', { leagueId });
    }
    return fantasyJson({ error: 'Method not allowed.' }, 405, corsHeaders);
  } catch (error) {
    console.error('Fantasy API request failed:', error);
    return fantasyJson({ error: 'The fantasy league request could not be completed.' }, 500, corsHeaders);
  }
}

async function getIdentity(request, env) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId || !env.SESSION || !env.USER_ACCOUNT) return null;
  const sessionStub = env.SESSION.get(env.SESSION.idFromName(sessionId));
  const sessionResponse = await sessionStub.fetch(new Request('https://session.internal/getUserId'));
  const session = await sessionResponse.json();
  if (!session.userId) return null;
  const accountStub = env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromName(session.userId));
  const accountResponse = await accountStub.fetch(new Request('https://account.internal/getData'));
  if (!accountResponse.ok) return null;
  const account = await accountResponse.json();
  const username = String(account?.username || '').trim();
  return { userId: String(session.userId), username: username || 'Ahrens Labs member' };
}

function parseBearerToken(header) {
  const match = typeof header === 'string' ? header.match(/^Bearer\s+(\S+)$/i) : null;
  return match?.[1] || null;
}

function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().slice(0, 40) : '';
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidInviteEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function generateUserId(email) {
  let hash = 0;
  for (let index = 0; index < email.length; index += 1) {
    hash = ((hash << 5) - hash + email.charCodeAt(index)) | 0;
  }
  return `user_${Math.abs(hash)}`;
}

function fantasyJson(value, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function readFantasyBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

function validString(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function defaultTeamAbbreviation(teamName) {
  const words = String(teamName || '').match(/[A-Za-z0-9]+/g) || [];
  if (!words.length) return 'TEAM';
  if (words.length > 1) return words.slice(0, 4).map((word) => word[0]).join('').toUpperCase();
  const teamNumber = words[0].match(/^team(\d+)$/i);
  return teamNumber ? `T${teamNumber[1]}`.slice(0, 4).toUpperCase() : words[0].slice(0, 4).toUpperCase();
}

function validTeamAbbreviation(value) {
  return typeof value === 'string' && /^[A-Z0-9]{1,4}$/.test(value);
}

function normalizeSetup(input, userId, username) {
  if (!input || typeof input !== 'object') return { error: 'League setup is missing.' };
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 60) : '';
  const teamCount = Number(input.teamCount);
  if (!name || !Number.isInteger(teamCount) || teamCount < 2 || teamCount > MAX_TEAMS
    || !Array.isArray(input.managers) || input.managers.length !== teamCount) {
    return { error: `Enter a league name and between 2 and ${MAX_TEAMS} teams.` };
  }
  const sourceSlots = input.rosterSlots && typeof input.rosterSlots === 'object' ? input.rosterSlots : {};
  const rosterSlots = {};
  for (const position of ROSTER_POSITIONS) {
    const count = Number(sourceSlots[position] ?? 0);
    if (!Number.isInteger(count) || count < 0 || count > MAX_ROSTER_SLOTS) {
      return { error: 'Roster slots must be whole numbers from 0 to 30.' };
    }
    rosterSlots[position] = count;
  }
  if (Object.entries(rosterSlots)
    .filter(([position]) => position !== 'BENCH')
    .reduce((sum, [, count]) => sum + count, 0) < 1) {
    return { error: 'Configure at least one starting roster slot.' };
  }
  const scoring = {};
  if (input.scoring && typeof input.scoring === 'object' && !Array.isArray(input.scoring)) {
    for (const [key, value] of Object.entries(input.scoring)) {
      const numeric = Number(value);
      if (!/^[a-zA-Z0-9_]{1,60}$/.test(key) || !Number.isFinite(numeric) || Math.abs(numeric) > 1000) {
        return { error: 'League scoring values are invalid.' };
      }
      scoring[key] = numeric;
    }
  }
  const managers = input.managers.map((manager, index) => {
    const source = manager && typeof manager === 'object' ? manager : {};
    const teamName = typeof source.teamName === 'string' ? source.teamName.trim().slice(0, 40) : '';
    if (!teamName) return null;
    const teamAbbreviation = typeof source.teamAbbreviation === 'string' && source.teamAbbreviation.trim()
      ? source.teamAbbreviation.trim().toUpperCase()
      : defaultTeamAbbreviation(teamName);
    if (!validTeamAbbreviation(teamAbbreviation)) return null;
    return {
      id: `team-${crypto.randomUUID()}`,
      name: index === 0 ? username : 'Open team',
      teamName,
      teamAbbreviation,
      ownerUserId: index === 0 ? userId : null,
      roster: [],
    };
  });
  if (managers.some((manager) => !manager)) return { error: 'Each fantasy team needs a name and a 1 to 4 character abbreviation.' };
  const leagueId = `af-${crypto.randomUUID()}`;
  const draftOrder = managers.map((manager) => manager.id);
  const playoffSettings = defaultPlayoffSettings(teamCount);
  return {
    league: {
      leagueId,
      name,
      teamCount,
      commissionerUserId: userId,
      managerName: username,
      managers,
      rosterSlots,
      scoring,
      draftOrder,
      matchupSchedule: generateMatchupSchedule(managers.map((manager) => manager.id), playoffSettings),
      playoffSettings,
      waiverSettings: { enabled: true, periodHours: 48 },
      waiverPriorityTeamIds: [...draftOrder].reverse(),
      waiverWindows: {},
      pendingWaiverClaims: [],
      draftSettings: {
        type: 'snake',
        order: [...draftOrder],
        auctionBudget: 200,
        auctionClockSeconds: 30,
      },
      auctionState: null,
      picks: [],
      trades: [],
      pendingInviteUserIds: [],
      draftStarted: false,
      draftAt: null,
      selectedRoster: 0,
      selectedWeek: Math.max(1, Math.min(18, Number(input.selectedWeek) || 1)),
      createdAt: Date.now(),
    },
  };
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function managerById(league, teamId) {
  return league.managers.find((team) => team.id === teamId) || null;
}

function allPlayerIds(league) {
  return new Set((league.managers || []).flatMap((team) => (team.roster || []).map((player) => String(player.id))));
}

function removeWaiverClaimsForTeam(league, teamId) {
  const removedPlayerIds = new Set((league.pendingWaiverClaims || [])
    .filter((claim) => claim.teamId === teamId)
    .map((claim) => String(claim.player?.id)));
  league.pendingWaiverClaims = (league.pendingWaiverClaims || [])
    .filter((claim) => claim.teamId !== teamId);
  removedPlayerIds.forEach((playerId) => {
    if (!league.pendingWaiverClaims.some((claim) => String(claim.player?.id) === playerId)) {
      delete league.waiverWindows?.[playerId];
    }
  });
}

function teamPickAt(league, index) {
  const count = league.teamCount;
  if (!Number.isInteger(count) || count < 1) return null;
  const round = Math.floor(index / count);
  const offset = index % count;
  const orderIndex = round % 2 === 0 ? offset : count - offset - 1;
  return league.draftOrder?.[orderIndex] || null;
}

function sameIds(left, right) {
  const a = left.map((player) => String(player.id)).sort();
  const b = right.map((player) => String(player.id)).sort();
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function sameRosterPlacement(left, right) {
  if (!sameIds(left, right)) return false;
  const rightById = new Map(right.map((player) => [String(player.id), player]));
  return left.every((player) => {
    const updated = rightById.get(String(player.id));
    return updated
      && (player.rosterSlot || 'BENCH') === (updated.rosterSlot || 'BENCH')
      && Number(player.rosterSlotIndex || 0) === Number(updated.rosterSlotIndex || 0);
  });
}

function sameValue(left, right) {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => sameValue(value, right[index]));
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && sameValue(left[key], right[key]));
}

function sameStringSet(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === rightSet.size && [...leftSet].every((value) => rightSet.has(value));
}

function idsForTradeAcceptance(previous, candidate, userId, previousTrade, nextTrade) {
  if (!previousTrade || previousTrade.status !== 'pending' || nextTrade.status !== 'accepted') return false;
  const from = managerById(previous, previousTrade.fromId);
  const to = managerById(previous, previousTrade.toId);
  const fromNext = managerById(candidate, previousTrade.fromId);
  const toNext = managerById(candidate, previousTrade.toId);
  if (!from || !to || !fromNext || !toNext || to.ownerUserId !== userId) return false;

  const offerIds = previousTrade.offerIds || [];
  const requestIds = previousTrade.requestIds || [];
  const dropFromIds = previousTrade.dropFromIds || [];
  const dropToIds = previousTrade.dropToIds || [];
  const ids = (team) => new Set(team.roster.map((player) => String(player.id)));
  const fromIds = ids(from);
  const toIds = ids(to);
  if (!offerIds.length || !requestIds.length
    || offerIds.some((id) => !fromIds.has(String(id)))
    || requestIds.some((id) => !toIds.has(String(id)))
    || dropFromIds.some((id) => !fromIds.has(String(id)) || offerIds.includes(id))
    || dropToIds.some((id) => !toIds.has(String(id)) || requestIds.includes(id))) return false;

  const capacity = Object.values(previous.rosterSlots || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const requiredFromDrops = Math.max(0, from.roster.length - offerIds.length + requestIds.length - capacity);
  const requiredToDrops = Math.max(0, to.roster.length - requestIds.length + offerIds.length - capacity);
  if (dropFromIds.length !== requiredFromDrops || dropToIds.length !== requiredToDrops) return false;

  const expectedFrom = new Set([...fromIds]);
  offerIds.concat(dropFromIds).forEach((id) => expectedFrom.delete(String(id)));
  requestIds.forEach((id) => expectedFrom.add(String(id)));
  const expectedTo = new Set([...toIds]);
  requestIds.concat(dropToIds).forEach((id) => expectedTo.delete(String(id)));
  offerIds.forEach((id) => expectedTo.add(String(id)));
  return expectedFrom.size === fromNext.roster.length
    && fromNext.roster.every((player) => expectedFrom.has(String(player.id)))
    && expectedTo.size === toNext.roster.length
    && toNext.roster.every((player) => expectedTo.has(String(player.id)));
}

function validateLeagueSave(previous, incoming, userId) {
  if (!incoming || typeof incoming !== 'object' || incoming.leagueId !== previous.leagueId
    || !Array.isArray(incoming.managers) || incoming.managers.length !== previous.managers.length
    || Number(incoming.teamCount) !== previous.teamCount) {
    return 'League identity and team membership cannot be changed here.';
  }
  const commissioner = previous.commissionerUserId === userId;
  if (!validWaiverSettings(incoming.waiverSettings)) return 'Waiver settings are invalid.';
  const previousDraftSettings = previous.draftSettings || {
    type: 'snake',
    order: previous.draftOrder || previous.managers.map((team) => team.id),
    auctionBudget: 200,
    auctionClockSeconds: 30,
  };
  const incomingDraftSettings = incoming.draftSettings || previousDraftSettings;
  if (!validDraftSettings(incomingDraftSettings, previous.teamCount)
    || incomingDraftSettings.order.some((id) => !previous.managers.some((team) => team.id === id))
    || !sameValue(incomingDraftSettings.order, incoming.draftOrder)) {
    return 'Draft settings are invalid.';
  }
  const ownTeams = previous.managers.filter((team) => team.ownerUserId === userId);
  if (!ownTeams.length) return 'You do not manage a team in this league.';
  const ownTeamIds = new Set(ownTeams.map((team) => team.id));
  const byId = new Map(incoming.managers.map((team) => [team.id, team]));
  if (previous.managers.some((team, index) => incoming.managers[index]?.id !== team.id)) {
    return 'Team order cannot be changed after league creation.';
  }
  if (previous.managers.some((team) => !byId.has(team.id)
    || (byId.get(team.id)?.ownerUserId || null) !== (team.ownerUserId || null))) {
    return 'Team ownership can only be changed by accepting a league invitation.';
  }
  if (!commissioner && (incoming.name !== previous.name
    || !sameValue(incoming.rosterSlots, previous.rosterSlots)
    || !sameValue(incoming.scoring, previous.scoring)
    || !sameValue(incoming.draftOrder, previous.draftOrder)
    || !sameValue(incoming.matchupSchedule, previous.matchupSchedule)
    || !sameValue(incoming.playoffSettings, previous.playoffSettings)
    || !sameValue(incoming.waiverSettings, previous.waiverSettings)
    || !sameValue(incomingDraftSettings, previousDraftSettings)
    || incoming.draftAt !== previous.draftAt)) {
    return 'Only the commissioner can change league settings, draft order, or draft time.';
  }
  if (commissioner && (incoming.draftAt !== previous.draftAt)) return 'Use the draft scheduler to change the draft time.';
  if (!sameValue(incomingDraftSettings, previousDraftSettings)) {
    return 'Use Draft settings to change the draft type or order.';
  }
  if (JSON.stringify(incoming.draftOrder) !== JSON.stringify(previous.draftOrder)) return 'Draft order cannot be changed after league creation.';
  for (const [position, count] of Object.entries(incoming.rosterSlots || {})) {
    if (!ROSTER_POSITIONS.includes(position) || !Number.isInteger(Number(count))
      || Number(count) < 0 || Number(count) > MAX_ROSTER_SLOTS) return 'Roster settings are invalid.';
  }
  const capacity = Object.values(incoming.rosterSlots || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  if (capacity < 1 || incoming.managers.some((team) => !Array.isArray(team.roster) || team.roster.length > capacity)) {
    return 'Roster size exceeds the configured league limits.';
  }
  if (incoming.managers.some((team) => !Array.isArray(team.roster)
    || !validString(team.teamName, 40)
    || !validTeamAbbreviation(team.teamAbbreviation)
    || team.roster.some((player) => !player || !validString(String(player.id || ''), 100)))) {
    return 'Roster player data is invalid.';
  }
  const teamIds = previous.managers.map((team) => team.id);
  if (!validPlayoffSettings(incoming.playoffSettings, previous.teamCount)) return 'Playoff settings are invalid.';
  if (!validMatchupSchedule(incoming.matchupSchedule, teamIds, incoming.playoffSettings)) {
    return 'The weekly matchup schedule is invalid or extends into playoff weeks.';
  }
  const nextIds = incoming.managers.flatMap((team) => team.roster.map((player) => String(player.id)));
  if (new Set(nextIds).size !== nextIds.length) return 'A player cannot be on more than one team.';

  const acceptedTrades = [];
  const previousTrades = previous.trades || [];
  const nextTrades = incoming.trades;
  if (!Array.isArray(incoming.picks) || !Array.isArray(nextTrades)) return 'Draft or trade data is invalid.';
  for (const nextTrade of nextTrades) {
    const oldTrade = previousTrades.find((trade) => trade.id === nextTrade.id);
    if (!oldTrade) {
      if (nextTrade.status !== 'pending' || !ownTeamIds.has(nextTrade.fromId)
        || !managerById(previous, nextTrade.toId) || ownTeamIds.has(nextTrade.toId)
        || !Array.isArray(nextTrade.offerIds) || !nextTrade.offerIds.length
        || !Array.isArray(nextTrade.requestIds) || !nextTrade.requestIds.length) {
        return 'Trade offers must be sent from your own team to a league member.';
      }
      const from = managerById(previous, nextTrade.fromId);
      const to = managerById(previous, nextTrade.toId);
      if (nextTrade.offerIds.some((id) => !from.roster.some((player) => String(player.id) === String(id)))
        || nextTrade.requestIds.some((id) => !to.roster.some((player) => String(player.id) === String(id)))) {
        return 'Trade selections must be players currently on the selected teams.';
      }
      if (!Array.isArray(nextTrade.dropFromIds) || !Array.isArray(nextTrade.dropToIds)) return 'Trade drop selections are invalid.';
      const rosterCapacity = Object.values(previous.rosterSlots || {}).reduce((sum, value) => sum + Number(value || 0), 0);
      if (nextTrade.dropFromIds.length !== Math.max(0, from.roster.length - nextTrade.offerIds.length + nextTrade.requestIds.length - rosterCapacity)
        || nextTrade.dropToIds.length !== Math.max(0, to.roster.length - nextTrade.requestIds.length + nextTrade.offerIds.length - rosterCapacity)) {
        return 'Trade drop selections must match the roster limits.';
      }
      continue;
    }
    if (!sameValue(
      { ...oldTrade, status: null, updatedAt: null },
      { ...nextTrade, status: null, updatedAt: null },
    )) return 'Trade details cannot be changed after an offer is sent.';
    if (nextTrade.status === 'accepted' && oldTrade.status === 'pending') {
      if (!idsForTradeAcceptance(previous, incoming, userId, oldTrade, nextTrade)) {
        return 'Only the receiving team can accept a valid trade offer.';
      }
      acceptedTrades.push(oldTrade);
    } else if (['declined', 'cancelled', 'expired'].includes(nextTrade.status)
      && nextTrade.status !== oldTrade.status) {
      if (oldTrade.status !== 'pending') return 'Resolved trade history cannot be changed.';
      const from = managerById(previous, oldTrade.fromId);
      const to = managerById(previous, oldTrade.toId);
      if (![from?.ownerUserId, to?.ownerUserId].includes(userId)) return 'Only a team in this trade can resolve it.';
    } else if (nextTrade.status !== oldTrade.status) {
      return 'Trade status is invalid.';
    } else {
      if (nextTrade.updatedAt !== oldTrade.updatedAt) return 'Trade history cannot be changed.';
    }
  }
  if (nextTrades.length < previousTrades.length
    || previousTrades.some((trade) => !nextTrades.some((next) => next.id === trade.id))) {
    return 'Trade history cannot be removed.';
  }

  const tradeTeams = new Set(acceptedTrades.flatMap((trade) => [trade.fromId, trade.toId]));
  let draftPickAdvanced = false;
  for (const oldTeam of previous.managers) {
    const nextTeam = byId.get(oldTeam.id);
    const isOwn = ownTeamIds.has(oldTeam.id);
    const isAcceptedTradeTeam = tradeTeams.has(oldTeam.id);
    if (!isOwn && !isAcceptedTradeTeam && !sameRosterPlacement(oldTeam.roster || [], nextTeam.roster || [])) {
      return 'You can only make roster changes to your own team.';
    }
    if (!commissioner && !isOwn
      && (oldTeam.teamName !== nextTeam.teamName || oldTeam.teamAbbreviation !== nextTeam.teamAbbreviation
        || oldTeam.name !== nextTeam.name)) {
      return 'Only the commissioner can rename another team.';
    }
    if (!isOwn && isAcceptedTradeTeam) continue;
    if (isOwn) {
      const oldIds = new Set((oldTeam.roster || []).map((player) => String(player.id)));
      const newIds = new Set((nextTeam.roster || []).map((player) => String(player.id)));
      for (const id of newIds) {
        const oldOwner = previous.managers.find((team) => !ownTeamIds.has(team.id)
          && team.roster.some((player) => String(player.id) === id));
        const receivedThroughTrade = oldOwner && acceptedTrades.some((trade) =>
          trade.fromId === oldOwner.id
          && trade.toId === oldTeam.id
          && trade.offerIds.some((offeredId) => String(offeredId) === id));
        if (oldOwner && !receivedThroughTrade) return 'A rostered player can only move through an accepted trade.';
      }
      const added = [...newIds].filter((id) => !oldIds.has(id));
      const removed = [...oldIds].filter((id) => !newIds.has(id));
      if (added.length && incoming.picks?.length === previous.picks.length
        && !previous.draftStarted && !isAcceptedTradeTeam) {
        return 'Free-agent claims are unavailable until the draft starts.';
      }
      if (added.length > 1 && incoming.picks?.length === previous.picks.length && !isAcceptedTradeTeam) {
        return 'Add one free agent at a time.';
      }
      if (added.length && incoming.picks?.length > previous.picks.length) {
        if (added.length !== 1 || incoming.picks.length !== previous.picks.length + 1
          || !ownTeamIds.has(teamPickAt(previous, previous.picks.length))
              || previous.draftSettings?.type === 'auction'
          || !ownTeamIds.has(incoming.picks.at(-1)?.teamId)
          || Number(incoming.picks.at(-1)?.pick) !== previous.picks.length + 1
          || String(incoming.picks.at(-1)?.playerId) !== added[0]) {
          return 'Draft picks must follow the league order and belong to your team.';
        }
        draftPickAdvanced = true;
        if (previous.draftAt && Date.parse(previous.draftAt) > Date.now()) {
          return 'The draft cannot start before its scheduled time.';
        }
      }
      if (added.length > 0 && (!incoming.draftStarted && incoming.picks?.length > previous.picks.length)) {
        return 'Start the draft before making a pick.';
      }
      if (removed.length > 0 && incoming.picks?.length < previous.picks.length) {
        return 'Draft picks cannot be undone in a shared league.';
      }
    }
  }
  if (incoming.picks.length > previous.picks.length && !draftPickAdvanced) {
    return 'Draft history can only advance one pick at a time.';
  }
  if (!Array.isArray(incoming.picks) || incoming.picks.length < previous.picks.length
    || previous.picks.some((pick, index) => !sameValue(incoming.picks[index], pick))) {
    return 'Draft history cannot be changed or removed.';
  }
  if (!commissioner && incoming.draftStarted !== previous.draftStarted) {
    if (!(incoming.draftStarted === true && !previous.draftStarted
      && (previous.draftAt
        ? Date.parse(previous.draftAt) <= Date.now()
        : commissioner))) {
      return 'Only the commissioner can change draft status before draft time.';
    }
  }
  if (commissioner) {
    if (typeof incoming.name !== 'string' || !incoming.name.trim() || incoming.name.length > 60) return 'League name is invalid.';
    for (const [key, value] of Object.entries(incoming.scoring || {})) {
      if (!/^[a-zA-Z0-9_]{1,60}$/.test(key) || !Number.isFinite(Number(value)) || Math.abs(Number(value)) > 1000) {
        return 'Scoring values are invalid.';
      }
    }
  }
  return null;
}

export class FantasyLeagueStore {
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;
    this.requestQueue = Promise.resolve();
  }

  async fetch(request) {
    const previousRequest = this.requestQueue;
    let releaseRequest;
    this.requestQueue = new Promise((resolve) => { releaseRequest = resolve; });
    await previousRequest;
    try {
      return await this.handleRequest(request);
    } finally {
      releaseRequest();
    }
  }

  async handleRequest(request) {
    const path = new URL(request.url).pathname;
    let body;
    try {
      body = await request.json();
    } catch {
      return fantasyJson({ error: 'Invalid internal request.' }, 400);
    }
    try {
      let result;
      if (path === '/list') result = await this.list(body.userId, body.username);
      else if (path === '/create') result = await this.create(body);
      else if (path === '/load') result = await this.load(body);
      else if (path === '/invite') result = await this.invite(body);
      else if (path === '/accept-invitation') result = await this.acceptInvitation(body);
      else if (path === '/decline-invitation') result = await this.declineInvitation(body);
      else if (path === '/schedule') result = await this.schedule(body);
      else if (path === '/manage-teams') result = await this.manageTeams(body);
      else if (path === '/leave') result = await this.leave(body);
      else if (path === '/draft-settings') result = await this.updateDraftSettings(body);
      else if (path === '/auction') result = await this.auction(body);
      else if (path === '/draft-pick') result = await this.autoPickDraft(body);
      else if (path === '/claim-waiver') result = await this.claimWaiver(body);
      else if (path === '/cancel-waiver-claim') result = await this.cancelWaiverClaim(body);
      else if (path === '/process-waivers') result = await this.processAllWaivers();
      else if (path === '/save') result = await this.save(body);
      else result = { status: 404, error: 'Not found.' };
      return fantasyJson(result, result.status || 200);
    } catch (error) {
      console.error('Fantasy league store failed:', error);
      return fantasyJson({ error: 'League storage could not complete the request.' }, 500);
    }
  }

  async getUser(userId) {
    const user = await this.storage.get(`${USER_PREFIX}${userId}`) || {};
    return {
      ...user,
      leagueIds: Array.isArray(user.leagueIds) ? user.leagueIds : [],
      invitations: Array.isArray(user.invitations) ? user.invitations : [],
    };
  }

  async putUser(userId, value) {
    await this.storage.put(`${USER_PREFIX}${userId}`, value);
  }

  async getLeague(leagueId) {
    return await this.storage.get(`${LEAGUE_PREFIX}${leagueId}`) || null;
  }

  async putLeague(value) {
    await this.storage.put(`${LEAGUE_PREFIX}${value.league.leagueId}`, value);
  }

  async list(userId, username) {
    const user = await this.getUser(userId);
    const leagues = [];
    const leagueIds = [...new Set(user.leagueIds || [])];
    for (const leagueId of leagueIds) {
      const record = await this.getLeague(leagueId);
      if (!record) continue;
      const team = record.league.managers.find((manager) => manager.ownerUserId === userId);
      if (!team) continue;
      leagues.push({
        leagueId,
        name: record.league.name,
        teamName: team?.teamName || '',
        teamAbbreviation: team?.teamAbbreviation || defaultTeamAbbreviation(team?.teamName),
        userTeamId: team?.id || '',
        role: record.league.commissionerUserId === userId ? 'commissioner' : 'manager',
        revision: record.revision,
        draftAt: record.league.draftAt || null,
      });
    }
    const validLeagueIds = leagues.map((entry) => entry.leagueId);
    const validInvitations = [];
    for (const invitation of user.invitations || []) {
      const record = await this.getLeague(invitation.leagueId);
      if (!record) continue;
      const team = managerById(record.league, invitation.teamId);
      if (!team || (team.ownerUserId && team.ownerUserId !== userId)) continue;
      validInvitations.push({
        ...invitation,
        leagueName: record.league.name || invitation.leagueName,
        teamName: team.teamName || '',
        teamAbbreviation: team.teamAbbreviation || defaultTeamAbbreviation(team.teamName),
      });
    }
    if (validLeagueIds.length !== (user.leagueIds || []).length
      || validInvitations.length !== (user.invitations || []).length) {
      user.leagueIds = validLeagueIds;
      user.invitations = validInvitations;
      await this.putUser(userId, user);
    }
    return { username: String(username || ''), leagues, invitations: validInvitations };
  }

  async create(body) {
    const userId = String(body.userId || '');
    const setup = normalizeSetup(body.league, userId, String(body.username || 'Manager').slice(0, 40));
    if (setup.error) return { status: 400, error: setup.error };
    const league = setup.league;
    const user = await this.getUser(userId);
    user.leagueIds = [...new Set([...user.leagueIds, league.leagueId])];
    await this.putLeague({ league, revision: 1 });
    await this.putUser(userId, user);
    return { league, revision: 1, userTeamId: league.managers[0].id, isCommissioner: true };
  }

  async load(body) {
    const record = await this.getLeague(String(body.leagueId || ''));
    if (!record) return { status: 404, error: 'League not found.' };
    const ownTeam = record.league.managers.find((team) => team.ownerUserId === body.userId);
    if (!ownTeam) return { status: 403, error: 'You are not a member of this league.' };
    const teamIds = record.league.managers.map((team) => team.id);
    let migrated = false;
    record.league.managers.forEach((team) => {
      const abbreviation = typeof team.teamAbbreviation === 'string'
        ? team.teamAbbreviation.trim().toUpperCase()
        : '';
      if (!validTeamAbbreviation(abbreviation)) {
        team.teamAbbreviation = defaultTeamAbbreviation(team.teamName);
        migrated = true;
      } else if (team.teamAbbreviation !== abbreviation) {
        team.teamAbbreviation = abbreviation;
        migrated = true;
      }
      if (!validDraftSettings(record.league.draftSettings, record.league.teamCount)
        || record.league.draftSettings.order.some((id) => !teamIds.includes(id))) {
        record.league.draftSettings = {
          type: 'snake',
          order: [...(record.league.draftOrder || teamIds)],
          auctionBudget: 200,
          auctionClockSeconds: 30,
        };
        migrated = true;
      }
      if (!Array.isArray(record.league.draftOrder)
        || !sameValue(record.league.draftOrder, record.league.draftSettings.order)) {
        record.league.draftOrder = [...record.league.draftSettings.order];
        migrated = true;
      }
    });
    if (!validPlayoffSettings(record.league.playoffSettings, record.league.teamCount)) {
      record.league.playoffSettings = defaultPlayoffSettings(
        record.league.teamCount,
        record.league.playoffSettings || {},
      );
      migrated = true;
    }
    if (!validMatchupSchedule(record.league.matchupSchedule, teamIds, record.league.playoffSettings)) {
      record.league.matchupSchedule = generateMatchupSchedule(teamIds, record.league.playoffSettings);
      migrated = true;
    }
    if (!validWaiverSettings(record.league.waiverSettings)) {
      record.league.waiverSettings = { enabled: true, periodHours: 48 };
      migrated = true;
    }
    if (!Array.isArray(record.league.waiverPriorityTeamIds)
      || record.league.waiverPriorityTeamIds.length !== teamIds.length
      || new Set(record.league.waiverPriorityTeamIds).size !== teamIds.length
      || record.league.waiverPriorityTeamIds.some((id) => !teamIds.includes(id))) {
      record.league.waiverPriorityTeamIds = [...(record.league.draftOrder || teamIds)].reverse();
      migrated = true;
    }
    if (!record.league.waiverWindows || typeof record.league.waiverWindows !== 'object'
      || Array.isArray(record.league.waiverWindows)) {
      record.league.waiverWindows = {};
      migrated = true;
    }
    if (!Array.isArray(record.league.pendingWaiverClaims)) {
      record.league.pendingWaiverClaims = [];
      migrated = true;
    }
    if (this.resolveDueWaivers(record)) migrated = true;
    if (this.finishAuction(record)) migrated = true;
    if (migrated) {
      record.revision += 1;
      await this.putLeague(record);
    }
    return {
      league: record.league,
      revision: record.revision,
      userTeamId: ownTeam.id,
      userTeamIds: record.league.managers
        .filter((team) => team.ownerUserId === body.userId)
        .map((team) => team.id),
      isCommissioner: record.league.commissionerUserId === body.userId,
    };
  }

  async manageTeams(body) {
    const record = await this.getLeague(String(body.leagueId || ''));
    if (!record) return { status: 404, error: 'League not found.' };
    if (record.league.commissionerUserId !== body.userId) {
      return { status: 403, error: 'Only the commissioner can manage league teams.' };
    }
    if (Number(body.revision) !== record.revision) {
      return { status: 409, error: 'This league changed on another device. Reload the latest league before managing teams.', league: record.league, revision: record.revision };
    }
    const teamCount = Number(body.teamCount);
    if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > MAX_TEAMS) {
      return { status: 400, error: `League size must be between 2 and ${MAX_TEAMS} teams.` };
    }
    const claimTeamIds = body.claimTeamIds;
    if (!Array.isArray(claimTeamIds)
      || claimTeamIds.some((id) => typeof id !== 'string')
      || new Set(claimTeamIds).size !== claimTeamIds.length) {
      return { status: 400, error: 'Choose valid open teams to claim.' };
    }

    const league = record.league;
    const previousTeamCount = league.teamCount;
    const previouslyClaimedIds = league.managers
      .filter((team) => team.ownerUserId === body.userId)
      .map((team) => team.id);
    const selectedClaimIds = claimTeamIds.length ? claimTeamIds : previouslyClaimedIds;
    if (teamCount !== league.teamCount && (league.draftStarted || league.picks.length)) {
      return { status: 409, error: 'League size can only change before the draft starts.' };
    }
    if ((league.draftStarted || league.picks.length)
      && !sameStringSet(selectedClaimIds, previouslyClaimedIds)) {
      return { status: 409, error: 'Team assignments can only change before the draft starts.' };
    }
    const validTeamIds = new Set(league.managers
      .slice(0, teamCount)
      .filter((team) => !team.ownerUserId || team.ownerUserId === body.userId)
      .map((team) => team.id));
    if (selectedClaimIds.some((teamId) => !validTeamIds.has(teamId))) {
      return { status: 409, error: 'Choose only open teams or teams you already manage.' };
    }
    const desiredClaimIds = new Set(selectedClaimIds);
    if (!league.managers.slice(0, teamCount).some((team) =>
      (team.ownerUserId === body.userId && desiredClaimIds.has(team.id))
      || (!team.ownerUserId && desiredClaimIds.has(team.id)))) {
      return { status: 400, error: 'Keep at least one team assigned to yourself.' };
    }
    const releasedTeams = league.managers
      .slice(0, Math.min(teamCount, league.managers.length))
      .filter((team) => team.ownerUserId === body.userId && !desiredClaimIds.has(team.id));
    if (releasedTeams.some((team) => team.roster.length)) {
      return { status: 409, error: 'Move or drop players from a team before unclaiming it.' };
    }
    if (teamCount < league.teamCount) {
      const removedTeams = league.managers.slice(teamCount);
      if (removedTeams.some((team) => (team.ownerUserId && team.ownerUserId !== body.userId) || team.roster.length)) {
        return { status: 409, error: 'To reduce league size, trailing teams must be open or yours and have empty rosters.' };
      }
      const removedIds = new Set(removedTeams.map((team) => team.id));
      if ((league.trades || []).some((trade) => trade.status === 'pending'
        && (removedIds.has(trade.fromId) || removedIds.has(trade.toId)))) {
        return { status: 409, error: 'Resolve pending trades involving teams before reducing league size.' };
      }
      league.managers = league.managers.slice(0, teamCount);
      league.draftOrder = league.draftOrder.filter((teamId) => !removedIds.has(teamId));
    } else if (teamCount > league.teamCount) {
      for (let index = league.managers.length; index < teamCount; index += 1) {
        const team = {
          id: `team-${crypto.randomUUID()}`,
          name: 'Open team',
          teamName: `Team ${index + 1}`,
          teamAbbreviation: `T${index + 1}`.slice(0, 4),
          ownerUserId: null,
          roster: [],
        };
        league.managers.push(team);
        league.draftOrder.push(team.id);
      }
    }
    league.teamCount = teamCount;
    if (teamCount !== previousTeamCount) {
      const currentTeamIds = league.managers.map((team) => team.id);
      const existingPriority = league.waiverPriorityTeamIds || [...league.draftOrder].reverse();
      const currentDraftOrder = league.draftSettings?.order || league.draftOrder;
      const draftOrder = [
        ...currentDraftOrder.filter((teamId) => currentTeamIds.includes(teamId)),
        ...currentTeamIds.filter((teamId) => !currentDraftOrder.includes(teamId)),
      ];
      league.draftOrder = draftOrder;
      league.draftSettings = {
        ...(league.draftSettings || { type: 'snake', auctionBudget: 200, auctionClockSeconds: 30 }),
        order: [...draftOrder],
      };
      league.waiverPriorityTeamIds = [
        ...existingPriority.filter((teamId) => currentTeamIds.includes(teamId)),
        ...currentTeamIds.filter((teamId) => !existingPriority.includes(teamId)),
      ];
      if (league.playoffSettings?.teamCount > teamCount) {
        league.playoffSettings = defaultPlayoffSettings(teamCount, league.playoffSettings);
      }
      league.matchupSchedule = generateMatchupSchedule(
        league.managers.map((team) => team.id),
        league.playoffSettings,
      );
    }

    for (const team of releasedTeams) {
      removeWaiverClaimsForTeam(league, team.id);
      team.ownerUserId = null;
      team.name = 'Open team';
    }
    for (const teamId of desiredClaimIds) {
      const team = managerById(league, teamId);
      if (team.ownerUserId === body.userId) continue;
      team.ownerUserId = body.userId;
      team.name = String(body.username || 'Commissioner').slice(0, 40);
    }
    record.revision += 1;
    await this.putLeague(record);
    return {
      league,
      revision: record.revision,
      userTeamId: league.managers.find((team) => team.ownerUserId === body.userId)?.id || '',
      userTeamIds: league.managers.filter((team) => team.ownerUserId === body.userId).map((team) => team.id),
      isCommissioner: true,
    };
  }

  async invite(body) {
    const record = await this.getLeague(String(body.leagueId || ''));
    if (!record) return { status: 404, error: 'League not found.' };
    if (record.league.commissionerUserId !== body.userId) return { status: 403, error: 'Only the commissioner can invite managers.' };
    const inviteeUserId = String(body.inviteeUserId || '');
    if (!inviteeUserId || inviteeUserId === body.userId) return { status: 400, error: 'Choose a different Ahrens Labs user.' };
    const team = managerById(record.league, String(body.teamId || ''));
    if (!team) return { status: 404, error: 'That team was not found.' };
    if (team.ownerUserId) return { status: 409, error: 'That team already has a manager.' };
    if (record.league.managers.some((manager) => manager.ownerUserId === inviteeUserId)) {
      return { status: 409, error: 'That user already manages a team in this league.' };
    }
    const invitee = await this.getUser(inviteeUserId);
    if (invitee.invitations.some((invite) => invite.leagueId === record.league.leagueId)) {
      return { status: 409, error: 'That user already has a pending invitation.' };
    }
    const invitation = {
      leagueId: record.league.leagueId,
      leagueName: record.league.name,
      teamId: team.id,
      teamName: team.teamName,
      teamAbbreviation: team.teamAbbreviation || defaultTeamAbbreviation(team.teamName),
      inviterUsername: String(body.username || 'Commissioner'),
      invitedAt: Date.now(),
    };
    invitee.invitations.push(invitation);
    record.league.pendingInviteUserIds = [...new Set([...(record.league.pendingInviteUserIds || []), inviteeUserId])];
    record.revision += 1;
    await this.putLeague(record);
    await this.putUser(inviteeUserId, invitee);
    const ownTeam = record.league.managers.find((manager) => manager.ownerUserId === body.userId);
    return {
      success: true,
      invitation,
      league: record.league,
      revision: record.revision,
      userTeamId: ownTeam?.id || '',
    };
  }

  async leave(body) {
    const userId = String(body.userId || '');
    const leagueId = String(body.leagueId || '');
    const record = await this.getLeague(leagueId);
    if (!record) return { status: 404, error: 'League not found.' };
    const user = await this.getUser(userId);
    const ownTeams = record.league.managers.filter((team) => team.ownerUserId === userId);
    if (!ownTeams.length || !user.leagueIds.includes(leagueId)) {
      return { status: 403, error: 'You are not a member of this league.' };
    }

    if (record.league.commissionerUserId === userId) {
      let cursor;
      do {
        const options = { prefix: USER_PREFIX, limit: 1000 };
        if (cursor) options.cursor = cursor;
        const page = await this.storage.list(options);
        for (const [key, affectedUser] of page) {
          const leagueIds = (affectedUser.leagueIds || []).filter((id) => id !== leagueId);
          const invitations = (affectedUser.invitations || []).filter((invite) => invite.leagueId !== leagueId);
          if (leagueIds.length !== (affectedUser.leagueIds || []).length
            || invitations.length !== (affectedUser.invitations || []).length) {
            await this.storage.put(key, { ...affectedUser, leagueIds, invitations });
          }
        }
        cursor = page.list_complete ? null : page.cursor;
        if (!page.list_complete && !cursor) throw new Error('Could not finish cleaning up league memberships.');
      } while (cursor);
      await this.storage.delete(`${LEAGUE_PREFIX}${leagueId}`);
      return { success: true, deleted: true };
    }

    ownTeams.forEach((team) => {
      removeWaiverClaimsForTeam(record.league, team.id);
      team.ownerUserId = null;
      team.name = 'Open team';
      team.teamName = `Team ${record.league.managers.indexOf(team) + 1}`;
      team.teamAbbreviation = `T${record.league.managers.indexOf(team) + 1}`.slice(0, 4);
      team.roster = [];
    });
    user.leagueIds = user.leagueIds.filter((id) => id !== leagueId);
    await this.putLeague({ ...record, revision: record.revision + 1 });
    await this.putUser(userId, user);
    return { success: true, deleted: false };
  }

  async acceptInvitation(body) {
    const userId = String(body.userId || '');
    const leagueId = String(body.leagueId || '');
    const teamId = String(body.teamId || '');
    const user = await this.getUser(userId);
    const invitationIndex = user.invitations.findIndex((invite) => invite.leagueId === leagueId && invite.teamId === teamId);
    if (invitationIndex < 0) return { status: 404, error: 'Invitation not found.' };
    const discardInvitation = async (record = null) => {
      user.invitations.splice(invitationIndex, 1);
      if (record && !user.invitations.some((invite) => invite.leagueId === leagueId)) {
        record.league.pendingInviteUserIds = (record.league.pendingInviteUserIds || []).filter((id) => id !== userId);
        await this.putLeague(record);
      }
      await this.putUser(userId, user);
    };
    const record = await this.getLeague(leagueId);
    if (!record) {
      await discardInvitation();
      return { status: 404, error: 'League no longer exists. The expired invitation was removed.' };
    }
    const team = managerById(record.league, teamId);
    const invitedTeam = user.invitations[invitationIndex];
    if (!team) {
      await discardInvitation(record);
      return { status: 404, error: 'That team no longer exists. The expired invitation was removed.' };
    }
    if (team.ownerUserId && team.ownerUserId !== userId) {
      await discardInvitation(record);
      return { status: 409, error: 'That team is no longer available. The expired invitation was removed.' };
    }
    const requestedTeamName = typeof body.teamName === 'string' ? body.teamName.trim() : '';
    const teamName = requestedTeamName || invitedTeam.teamName || team.teamName;
    if (!validString(teamName, 40)) return { status: 400, error: 'Enter a fantasy team name of 1 to 40 characters.' };
    const requestedAbbreviation = typeof body.teamAbbreviation === 'string' ? body.teamAbbreviation.trim().toUpperCase() : '';
    const teamAbbreviation = requestedAbbreviation || invitedTeam.teamAbbreviation
      || team.teamAbbreviation || defaultTeamAbbreviation(teamName);
    if (!validTeamAbbreviation(teamAbbreviation)) {
      return { status: 400, error: 'Enter a team abbreviation of 1 to 4 letters or numbers.' };
    }
    if (!team.ownerUserId) {
      removeWaiverClaimsForTeam(record.league, team.id);
      team.ownerUserId = userId;
      team.name = String(body.username || 'Manager').slice(0, 40);
      team.teamName = teamName;
      team.teamAbbreviation = teamAbbreviation;
      record.revision += 1;
    }
    user.invitations.splice(invitationIndex, 1);
    user.leagueIds = [...new Set([...user.leagueIds, leagueId])];
    record.league.pendingInviteUserIds = (record.league.pendingInviteUserIds || []).filter((id) => id !== userId);
    await this.putLeague(record);
    await this.putUser(userId, user);
    return {
      leagueId,
      teamId,
      success: true,
      league: record.league,
      revision: record.revision,
    };
  }

  async declineInvitation(body) {
    const userId = String(body.userId || '');
    const leagueId = String(body.leagueId || '');
    const teamId = String(body.teamId || '');
    const user = await this.getUser(userId);
    const countBefore = user.invitations.length;
    user.invitations = user.invitations.filter((invite) => invite.leagueId !== leagueId || invite.teamId !== teamId);
    if (user.invitations.length === countBefore) return { status: 404, error: 'Invitation not found.' };
    const record = await this.getLeague(leagueId);
    if (record) {
      record.league.pendingInviteUserIds = (record.league.pendingInviteUserIds || []).filter((id) => id !== userId);
      await this.putLeague(record);
    }
    await this.putUser(userId, user);
    return { success: true };
  }

  async schedule(body) {
    const record = await this.getLeague(String(body.leagueId || ''));
    if (!record) return { status: 404, error: 'League not found.' };
    if (record.league.commissionerUserId !== body.userId) return { status: 403, error: 'Only the commissioner can schedule the draft.' };
    if (body.revision !== undefined && Number(body.revision) !== record.revision) {
      return { status: 409, error: 'This league changed on another device. Reload before changing the draft schedule.', league: record.league, revision: record.revision };
    }
    let draftAt = null;
    if (body.draftAt != null && body.draftAt !== '') {
      const timestamp = Date.parse(body.draftAt);
      if (!Number.isFinite(timestamp) || timestamp < Date.now()
        || timestamp > Date.now() + 180 * 24 * 60 * 60 * 1000) {
        return { status: 400, error: 'Choose a draft time between now and six months from now.' };
      }
      draftAt = new Date(timestamp).toISOString();
    }
    record.league.draftAt = draftAt;
    record.revision += 1;
    await this.putLeague(record);
    const ownTeam = record.league.managers.find((team) => team.ownerUserId === body.userId);
    return {
      league: record.league,
      revision: record.revision,
      userTeamId: ownTeam?.id || '',
      isCommissioner: true,
    };
  }

  async save(body) {
    const leagueId = String(body.leagueId || '');
    const record = await this.getLeague(leagueId);
    if (!record) return { status: 404, error: 'League not found.' };
    const ownTeams = record.league.managers.filter((team) => team.ownerUserId === body.userId);
    if (!ownTeams.length) return { status: 403, error: 'You are not a member of this league.' };
    const ownTeamIds = new Set(ownTeams.map((team) => team.id));
    if (Number(body.revision) !== record.revision) {
      return { status: 409, error: 'This league changed on another device. Reload the latest league before saving.', league: record.league, revision: record.revision };
    }
    const validationError = validateLeagueSave(record.league, body.league, body.userId);
    if (validationError) return { status: 403, error: validationError, league: record.league, revision: record.revision };
    const league = jsonClone(body.league);
    league.draftAt = record.league.draftAt;
    league.commissionerUserId = record.league.commissionerUserId;
    league.draftPickStartedAt = league.draftSettings?.type === 'auction' || !league.draftStarted
      ? null
      : !record.league.draftStarted || body.league.picks.length > record.league.picks.length
        ? Date.now()
        : record.league.draftPickStartedAt || record.league.picks.at(-1)?.timestamp || Date.now();
    league.pendingInviteUserIds = record.league.pendingInviteUserIds || [];
    league.draftSettings = record.league.draftSettings || {
      type: 'snake',
      order: [...record.league.draftOrder],
      auctionBudget: 200,
      auctionClockSeconds: 30,
    };
    league.draftOrder = [...league.draftSettings.order];
    league.auctionState = record.league.auctionState || null;
    league.waiverPriorityTeamIds = record.league.waiverPriorityTeamIds || [...record.league.draftOrder].reverse();
    league.waiverWindows = record.league.waiverWindows || {};
    league.pendingWaiverClaims = record.league.pendingWaiverClaims || [];
    const acceptedTradeTeams = new Set(
      league.trades
        .filter((trade) => trade.status === 'accepted'
          && record.league.trades.some((old) => old.id === trade.id && old.status === 'pending'))
        .flatMap((trade) => [trade.fromId, trade.toId]),
    );
    const existingPlayers = new Map(
      record.league.managers.flatMap((team) => team.roster.map((player) => [String(player.id), player])),
    );
    league.managers.forEach((team, index) => {
      const previousTeam = record.league.managers.find((entry) => entry.id === team.id);
      team.ownerUserId = previousTeam?.ownerUserId || null;
      if (!ownTeamIds.has(team.id) && !acceptedTradeTeams.has(team.id)) {
        team.roster = jsonClone(previousTeam.roster || []);
      } else if (acceptedTradeTeams.has(team.id)) {
        team.roster = team.roster.map((player) => {
          const previousPlayer = existingPlayers.get(String(player.id));
          return previousPlayer
            ? {
              ...jsonClone(previousPlayer),
              rosterSlot: player.rosterSlot || 'BENCH',
              rosterSlotIndex: Number(player.rosterSlotIndex) || 0,
              draftedBy: team.id,
            }
            : player;
        });
      }
    });
    record.league = league;
    record.revision += 1;
    await this.putLeague(record);
    return { success: true, revision: record.revision };
  }

  async autoPickDraft(body) {
    const record = await this.getLeague(String(body.leagueId || ''));
    if (!record) return { status: 404, error: 'League not found.' };
    const league = record.league;
    if (!league.managers.some((team) => team.ownerUserId === body.userId)) {
      return { status: 403, error: 'You are not a member of this league.' };
    }
    if (league.draftSettings?.type === 'auction') {
      return { status: 409, error: 'Timed auto-picks are only available for snake drafts.' };
    }
    if (!league.draftStarted) return { status: 409, error: 'The draft has not started.' };
    if (league.draftAt && Date.parse(league.draftAt) > Date.now()) {
      return { status: 409, error: 'The scheduled draft time has not arrived yet.' };
    }
    const pickIndex = league.picks.length;
    const capacity = Object.values(league.rosterSlots || {})
      .reduce((sum, count) => sum + Number(count || 0), 0);
    if (pickIndex >= league.teamCount * capacity) {
      return { status: 409, error: 'This draft is already complete.', league, revision: record.revision };
    }
    const now = Date.now();
    const pickStartedAt = Number(league.draftPickStartedAt || league.picks.at(-1)?.timestamp);
    if (!Number.isFinite(pickStartedAt) || pickStartedAt <= 0) {
      league.draftPickStartedAt = now;
      record.revision += 1;
      await this.putLeague(record);
      return { status: 409, error: 'The pick clock was initialized. Try again after 90 seconds.', league, revision: record.revision };
    }
    if (now - pickStartedAt < 90_000) {
      return { status: 409, error: 'This pick still has time remaining.', league, revision: record.revision };
    }
    const teamId = teamPickAt(league, pickIndex);
    const team = managerById(league, teamId);
    const source = body.player;
    const playerId = String(source?.id || '');
    const positions = ROSTER_POSITIONS.filter((position) => !['FLEX', 'BENCH'].includes(position));
    if (!team || !validString(playerId, 100) || !validString(source?.name, 100)
      || !positions.includes(source?.position) || allPlayerIds(league).has(playerId)) {
      return { status: 400, error: 'Choose an available player with valid roster data.', league, revision: record.revision };
    }
    const player = {
      id: playerId,
      name: source.name.trim(),
      firstName: String(source.firstName || '').slice(0, 60),
      lastName: String(source.lastName || '').slice(0, 60),
      position: source.position,
      team: String(source.team || '').slice(0, 20),
      teamName: String(source.teamName || '').slice(0, 60),
      teamId: String(source.teamId || '').slice(0, 30),
      jersey: String(source.jersey || '').slice(0, 10),
      headshot: typeof source.headshot === 'string' && source.headshot.startsWith('https://')
        ? source.headshot.slice(0, 500)
        : '',
      href: typeof source.href === 'string' && source.href.startsWith('https://')
        ? source.href.slice(0, 500)
        : '',
      status: String(source.status || 'ACTIVE').slice(0, 40),
      statusUpdatedAt: typeof source.statusUpdatedAt === 'string'
        ? source.statusUpdatedAt.slice(0, 80)
        : null,
      espnRank: typeof source.espnRank === 'number' && Number.isFinite(source.espnRank)
        ? source.espnRank
        : null,
      projectedPoints: typeof source.projectedPoints === 'number' && Number.isFinite(source.projectedPoints)
        ? source.projectedPoints
        : null,
      projectedStats: source.projectedStats && typeof source.projectedStats === 'object'
        && !Array.isArray(source.projectedStats)
        ? Object.fromEntries(Object.entries(source.projectedStats)
          .filter(([key, value]) => /^[a-zA-Z0-9_]{1,60}$/.test(key)
            && typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1000))
        : null,
    };
    const slots = league.rosterSlots || {};
    const positionCount = team.roster.filter((member) =>
      member.position === player.position && member.rosterSlot === player.position).length;
    const flexCount = team.roster.filter((member) => member.rosterSlot === 'FLEX').length;
    let rosterSlot = positionCount < Number(slots[player.position] || 0)
      ? player.position
      : ['RB', 'WR', 'TE'].includes(player.position) && flexCount < Number(slots.FLEX || 0)
        ? 'FLEX'
        : 'BENCH';
    const starterCapacity = Object.entries(slots)
      .filter(([position]) => position !== 'BENCH')
      .reduce((sum, [, count]) => sum + Number(count || 0), 0);
    const openStartingSlots = Math.max(0, starterCapacity - team.roster.filter((member) => member.rosterSlot !== 'BENCH').length);
    if (capacity <= team.roster.length || (capacity - team.roster.length <= openStartingSlots && rosterSlot === 'BENCH')
      || (rosterSlot === 'BENCH' && team.roster.filter((member) => member.rosterSlot === 'BENCH').length >= Number(slots.BENCH || 0))) {
      return { status: 409, error: 'No eligible roster slot is available for this auto-pick.', league, revision: record.revision };
    }
    const rosterSlotIndex = team.roster.reduce((highest, member) =>
      member.rosterSlot === rosterSlot ? Math.max(highest, Number(member.rosterSlotIndex) || 0) : highest, -1) + 1;
    const timestamp = Date.now();
    team.roster.push({
      ...player,
      draftedBy: team.id,
      rosterSlot,
      rosterSlotIndex,
      gameStats: {},
    });
    league.picks.push({
      pick: pickIndex + 1,
      round: Math.floor(pickIndex / league.teamCount) + 1,
      teamId: team.id,
      playerId,
      playerName: player.name,
      position: player.position,
      nflTeam: player.team,
      timestamp,
    });
    league.draftPickStartedAt = timestamp;
    record.revision += 1;
    await this.putLeague(record);
    const ownTeamIds = league.managers.filter((entry) => entry.ownerUserId === body.userId).map((entry) => entry.id);
    return {
      success: true,
      league,
      revision: record.revision,
      userTeamId: ownTeamIds[0] || '',
      userTeamIds: ownTeamIds,
      isCommissioner: league.commissionerUserId === body.userId,
    };
  }

  async updateDraftSettings(body) {
    const record = await this.getLeague(String(body.leagueId || ''));
    if (!record) return { status: 404, error: 'League not found.' };
    const league = record.league;
    if (league.commissionerUserId !== body.userId) {
      return { status: 403, error: 'Only the commissioner can change draft settings.' };
    }
    if (Number(body.revision) !== record.revision) {
      return { status: 409, error: 'This league changed on another device. Reload before saving draft settings.', league, revision: record.revision };
    }
    if (league.draftStarted || league.picks.length) {
      return { status: 409, error: 'Draft settings and order cannot change after the draft starts.' };
    }
    const teamIds = league.managers.map((team) => team.id);
    const settings = body.draftSettings;
    if (!validDraftSettings(settings, league.teamCount)
      || settings.order.some((teamId) => !teamIds.includes(teamId))) {
      return { status: 400, error: 'Choose a draft type, valid auction settings, and every team exactly once in the draft order.' };
    }
    league.draftOrder = [...settings.order];
    league.draftSettings = {
      type: settings.type,
      order: [...settings.order],
      auctionBudget: Number(settings.auctionBudget),
      auctionClockSeconds: Number(settings.auctionClockSeconds),
    };
    league.auctionState = null;
    record.revision += 1;
    await this.putLeague(record);
    const ownTeam = league.managers.find((team) => team.ownerUserId === body.userId);
    return {
      league,
      revision: record.revision,
      userTeamId: ownTeam?.id || '',
      isCommissioner: true,
    };
  }

  auctionTeamSpent(league, team) {
    return league.picks
      .filter((pick) => pick.teamId === team.id)
      .reduce((sum, pick) => sum + Math.max(0, Number(pick.auctionPrice) || 0), 0);
  }

  finishAuction(record, now = Date.now()) {
    const league = record.league;
    const auction = league.auctionState;
    if (!auction || Number(auction.endsAt) > now) return false;
    const winner = managerById(league, auction.highBidTeamId);
    const playerId = String(auction.player?.id || '');
    const rosterCapacity = Object.values(league.rosterSlots || {})
      .reduce((sum, count) => sum + Number(count || 0), 0);
    if (!winner || !winner.ownerUserId || !playerId || allPlayerIds(league).has(playerId)
      || winner.roster.length >= rosterCapacity) {
      league.auctionState = null;
      return true;
    }
    const player = auction.player;
    const positionSlots = Number(league.rosterSlots[player.position] || 0);
    const positionCount = winner.roster.filter((entry) => entry.position === player.position).length;
    const flexCount = winner.roster.filter((entry) => entry.rosterSlot === 'FLEX').length;
    let rosterSlot = 'BENCH';
    if (positionCount < positionSlots) rosterSlot = player.position;
    else if (['RB', 'WR', 'TE'].includes(player.position)
      && flexCount < Number(league.rosterSlots.FLEX || 0)) rosterSlot = 'FLEX';
    winner.roster.push({
      ...player,
      draftedBy: winner.id,
      auctionPrice: Number(auction.highBid),
      rosterSlot,
      rosterSlotIndex: winner.roster.filter((entry) => (entry.rosterSlot || 'BENCH') === rosterSlot).length,
      gameStats: {},
    });
    const pickIndex = league.picks.length;
    league.picks.push({
      pick: pickIndex + 1,
      round: Math.floor(pickIndex / league.teamCount) + 1,
      teamId: winner.id,
      playerId,
      playerName: player.name,
      position: player.position,
      nflTeam: player.team,
      auctionPrice: Number(auction.highBid),
      nominatedBy: auction.nominatedBy,
      timestamp: now,
    });
    league.auctionState = null;
    return true;
  }

  async auction(body) {
    const record = await this.getLeague(String(body.leagueId || ''));
    if (!record) return { status: 404, error: 'League not found.' };
    const league = record.league;
    const action = String(body.action || 'poll');
    let changed = this.finishAuction(record);
    if (changed) {
      record.revision += 1;
      await this.putLeague(record);
    }
    if (action !== 'poll') {
      const team = league.managers.find((manager) => manager.id === body.teamId
        && manager.ownerUserId === body.userId);
      if (!team) return { status: 403, error: 'You can only run the auction for your own team.' };
      if (league.draftSettings?.type !== 'auction') {
        return { status: 409, error: 'This league is not configured for an auction draft.' };
      }
      if (league.draftAt && Date.parse(league.draftAt) > Date.now()) {
        return { status: 409, error: 'The scheduled draft time has not arrived yet.' };
      }
      if (league.picks.length >= league.teamCount * Object.values(league.rosterSlots || {})
        .reduce((sum, count) => sum + Number(count || 0), 0)) {
        return { status: 409, error: 'This draft is already complete.' };
      }
      if (action === 'start') {
        const nominatorId = league.draftOrder[league.picks.length % league.teamCount];
        if (team.id !== nominatorId) return { status: 403, error: 'It is not your team’s turn to nominate.' };
        league.draftStarted = true;
      } else if (action === 'nominate') {
        if (league.auctionState) return { status: 409, error: 'Finish the current auction before nominating another player.' };
        const nominatorId = league.draftOrder[league.picks.length % league.teamCount];
        if (team.id !== nominatorId) return { status: 403, error: 'It is not your team’s turn to nominate.' };
        const source = body.player;
        const playerId = String(source?.id || '');
        const positions = ROSTER_POSITIONS.filter((position) => !['FLEX', 'BENCH'].includes(position));
        if (!validString(playerId, 100) || !validString(source?.name, 100) || !positions.includes(source?.position)
          || allPlayerIds(league).has(playerId)) {
          return { status: 400, error: 'Choose an available player with valid roster data.' };
        }
        const player = {
          id: playerId,
          name: source.name.trim(),
          position: source.position,
          team: String(source.team || '').slice(0, 20),
          teamName: String(source.teamName || '').slice(0, 60),
          teamId: String(source.teamId || '').slice(0, 30),
          headshot: typeof source.headshot === 'string' && source.headshot.startsWith('https://')
            ? source.headshot.slice(0, 500)
            : '',
          status: String(source.status || 'ACTIVE').slice(0, 40),
        };
        const remainingSlots = Object.values(league.rosterSlots || {})
          .reduce((sum, count) => sum + Number(count || 0), 0) - team.roster.length;
        const openingBid = 1;
        if (this.auctionTeamSpent(league, team) + openingBid + Math.max(0, remainingSlots - 1) > league.draftSettings.auctionBudget) {
          return { status: 409, error: 'Your team needs to save $1 for each remaining open roster slot.' };
        }
        league.auctionState = {
          player,
          nominatedBy: team.id,
          highBidTeamId: team.id,
          highBid: openingBid,
          endsAt: Date.now() + Number(league.draftSettings.auctionClockSeconds) * 1000,
        };
        league.draftStarted = true;
      } else if (action === 'bid') {
        const auction = league.auctionState;
        if (!auction) return { status: 409, error: 'There is no active player auction.' };
        const amount = Number(body.amount);
        const capacity = Object.values(league.rosterSlots || {})
          .reduce((sum, count) => sum + Number(count || 0), 0);
        const remainingSlots = capacity - team.roster.length;
        if (!Number.isInteger(amount) || amount <= Number(auction.highBid)) {
          return { status: 400, error: `Your bid must be a whole dollar amount above $${auction.highBid}.` };
        }
        if (team.roster.length >= capacity
          || this.auctionTeamSpent(league, team) + amount + Math.max(0, remainingSlots - 1) > league.draftSettings.auctionBudget) {
          return { status: 409, error: 'That bid exceeds your available salary-cap budget.' };
        }
        auction.highBid = amount;
        auction.highBidTeamId = team.id;
        auction.endsAt = Date.now() + Number(league.draftSettings.auctionClockSeconds) * 1000;
      } else {
        return { status: 400, error: 'Auction action is invalid.' };
      }
      record.revision += 1;
      await this.putLeague(record);
    }
    const ownTeam = league.managers.find((team) => team.ownerUserId === body.userId);
    return {
      success: true,
      league,
      revision: record.revision,
      userTeamId: ownTeam?.id || '',
      userTeamIds: league.managers.filter((team) => team.ownerUserId === body.userId).map((team) => team.id),
      isCommissioner: league.commissionerUserId === body.userId,
    };
  }

  resolveDueWaivers(record, now = Date.now()) {
    const league = record.league;
    if (!league.waiverWindows || !Array.isArray(league.pendingWaiverClaims)) return false;
    const duePlayerIds = Object.entries(league.waiverWindows)
      .filter(([, processAt]) => Number(processAt) <= now)
      .map(([playerId]) => playerId);
    if (!duePlayerIds.length) return false;
    const capacity = Object.values(league.rosterSlots || {}).reduce((sum, count) => sum + Number(count || 0), 0);
    let priority = Array.isArray(league.waiverPriorityTeamIds) ? league.waiverPriorityTeamIds : [];
    duePlayerIds.forEach((playerId) => {
      const claims = league.pendingWaiverClaims
        .filter((claim) => String(claim.player?.id) === playerId)
        .sort((left, right) => {
          const leftRank = priority.indexOf(left.teamId);
          const rightRank = priority.indexOf(right.teamId);
          return (leftRank < 0 ? Number.MAX_SAFE_INTEGER : leftRank)
            - (rightRank < 0 ? Number.MAX_SAFE_INTEGER : rightRank)
            || Number(left.createdAt) - Number(right.createdAt);
        });
      for (const claim of claims) {
        const team = managerById(league, claim.teamId);
        if (!team || !team.ownerUserId || team.ownerUserId !== claim.userId
          || allPlayerIds(league).has(playerId)) continue;
        const drop = claim.dropPlayerId
          ? team.roster.find((player) => String(player.id) === String(claim.dropPlayerId))
          : null;
        if (team.roster.length >= capacity && !drop) continue;
        if (drop) team.roster = team.roster.filter((player) => String(player.id) !== String(drop.id));
        team.roster.push({
          ...claim.player,
          draftedBy: team.id,
          rosterSlot: 'BENCH',
          rosterSlotIndex: 0,
          gameStats: {},
        });
        priority = [
          ...priority.filter((teamId) => teamId !== team.id),
          team.id,
        ];
        league.waiverPriorityTeamIds = priority;
        break;
      }
      league.pendingWaiverClaims = league.pendingWaiverClaims
        .filter((claim) => String(claim.player?.id) !== playerId);
      delete league.waiverWindows[playerId];
    });
    return true;
  }

  async processAllWaivers() {
    let cursor;
    let processedLeagues = 0;
    do {
      const page = await this.storage.list({ prefix: LEAGUE_PREFIX, cursor, limit: 1000 });
      for (const record of page.values()) {
        if (!this.resolveDueWaivers(record)) continue;
        record.revision += 1;
        await this.putLeague(record);
        processedLeagues += 1;
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return { success: true, processedLeagues };
  }

  async claimWaiver(body) {
    const record = await this.getLeague(String(body.leagueId || ''));
    if (!record) return { status: 404, error: 'League not found.' };
    const league = record.league;
    const team = league.managers.find((manager) => manager.ownerUserId === body.userId
      && manager.id === body.teamId);
    if (!team) return { status: 403, error: 'Choose one of your own teams to place this claim.' };
    if (!league.draftStarted) return { status: 409, error: 'Waiver claims are available after the draft starts.' };
    if (!validWaiverSettings(league.waiverSettings) || !league.waiverSettings.enabled) {
      return { status: 409, error: 'The commissioner has disabled waivers. Add free agents directly instead.' };
    }
    const source = body.player;
    const playerId = String(source?.id || '');
    const playerPositions = ROSTER_POSITIONS.filter((position) => !['FLEX', 'BENCH'].includes(position));
    if (!validString(playerId, 100) || !validString(source?.name, 100)
      || !playerPositions.includes(source?.position)) {
      return { status: 400, error: 'Player data is invalid.' };
    }
    if (this.resolveDueWaivers(record)) {
      record.revision += 1;
      await this.putLeague(record);
    }
    if (allPlayerIds(league).has(playerId)) return { status: 409, error: 'This player is already on a fantasy team.' };
    const player = {
      id: playerId,
      name: source.name.trim(),
      position: source.position,
      team: String(source.team || '').slice(0, 20),
      teamName: String(source.teamName || '').slice(0, 60),
      teamId: String(source.teamId || '').slice(0, 30),
      headshot: typeof source.headshot === 'string' && source.headshot.startsWith('https://')
        ? source.headshot.slice(0, 500)
        : '',
      status: String(source.status || 'ACTIVE').slice(0, 40),
    };
    const capacity = Object.values(league.rosterSlots || {}).reduce((sum, count) => sum + Number(count || 0), 0);
    const dropPlayerId = body.dropPlayerId ? String(body.dropPlayerId) : '';
    if (team.roster.length >= capacity
      && (!dropPlayerId || !team.roster.some((member) => String(member.id) === dropPlayerId))) {
      return { status: 400, error: 'Choose a player on your team to drop when your roster is full.' };
    }
    if (team.roster.length < capacity && dropPlayerId) {
      return { status: 400, error: 'A roster drop is only allowed when your team is full.' };
    }
    const pending = league.pendingWaiverClaims || [];
    if (pending.some((claim) => claim.teamId === team.id && String(claim.player?.id) === playerId)) {
      return { status: 409, error: 'You already have a pending claim for this player.' };
    }
    const now = Date.now();
    if (!league.waiverWindows || typeof league.waiverWindows !== 'object') league.waiverWindows = {};
    const processAt = Number(league.waiverWindows[playerId])
      || now + Number(league.waiverSettings.periodHours) * 60 * 60 * 1000;
    league.waiverWindows[playerId] = processAt;
    const claim = {
      id: crypto.randomUUID(),
      player,
      teamId: team.id,
      userId: body.userId,
      dropPlayerId,
      createdAt: now,
      processAt,
    };
    league.pendingWaiverClaims = [...pending, claim];
    record.revision += 1;
    await this.putLeague(record);
    return { success: true, claim, league, revision: record.revision, userTeamId: team.id };
  }

  async cancelWaiverClaim(body) {
    const record = await this.getLeague(String(body.leagueId || ''));
    if (!record) return { status: 404, error: 'League not found.' };
    const league = record.league;
    const claim = (league.pendingWaiverClaims || []).find((entry) => entry.id === body.claimId);
    if (!claim) return { status: 404, error: 'Pending waiver claim not found.' };
    if (claim.userId !== body.userId
      || !league.managers.some((team) => team.id === claim.teamId && team.ownerUserId === body.userId)) {
      return { status: 403, error: 'You can only cancel your own waiver claims.' };
    }
    league.pendingWaiverClaims = league.pendingWaiverClaims.filter((entry) => entry.id !== claim.id);
    if (!league.pendingWaiverClaims.some((entry) => String(entry.player?.id) === String(claim.player?.id))) {
      delete league.waiverWindows?.[String(claim.player?.id)];
    }
    record.revision += 1;
    await this.putLeague(record);
    return { success: true, league, revision: record.revision, userTeamId: claim.teamId };
  }
}
