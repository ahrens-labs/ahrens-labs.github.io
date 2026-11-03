const STORE_ID = 'fantasy-leagues-v1';
const LEAGUE_PREFIX = 'league:';
const USER_PREFIX = 'user:';
const MAX_TEAMS = 16;
const MAX_ROSTER_SLOTS = 30;
const ROSTER_POSITIONS = [
  'QB', 'RB', 'WR', 'TE', 'K', 'D/ST', 'DL', 'DE', 'DT', 'LB', 'DB', 'CB', 'S', 'P', 'FLEX', 'BENCH',
];

export async function handleFantasyRequest(request, env, corsHeaders, path) {
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

    const match = path.match(/^\/api\/fantasy\/leagues\/([^/]+)(?:\/(invitations|schedule|teams))?$/);
    if (!match) return fantasyJson({ error: 'Not found.' }, 404, corsHeaders);
    const leagueId = decodeURIComponent(match[1]);
    if (!leagueId || leagueId.length > 100) return fantasyJson({ error: 'Invalid league id.' }, 400, corsHeaders);

    if (!match[2] && request.method === 'GET') return send('load', { leagueId });
    if (!match[2] && request.method === 'PUT') {
      const body = await readFantasyBody(request);
      if (!body) return fantasyJson({ error: 'Invalid request body.' }, 400, corsHeaders);
      return send('save', { leagueId, league: body.league, revision: body.revision });
    }
    if (match[2] === 'invitations' && request.method === 'POST') {
      const body = await readFantasyBody(request);
      const username = normalizeUsername(body?.username);
      const teamId = String(body?.teamId || '').trim();
      if (!username || !teamId) return fantasyJson({ error: 'Enter an Ahrens Labs username and choose an open team.' }, 400, corsHeaders);
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
      return send('invite', { leagueId, teamId, inviteeUserId: account.userId, inviteeUsername: username });
    }
    if (match[2] === 'schedule' && request.method === 'PUT') {
      const body = await readFantasyBody(request);
      if (!body) return fantasyJson({ error: 'Invalid request body.' }, 400, corsHeaders);
      return send('schedule', { leagueId, draftAt: body.draftAt });
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
    return {
      id: `team-${crypto.randomUUID()}`,
      name: index === 0 ? username : 'Open team',
      teamName,
      ownerUserId: index === 0 ? userId : null,
      roster: [],
    };
  });
  if (managers.some((manager) => !manager)) return { error: 'Each fantasy team needs a team name.' };
  const leagueId = `af-${crypto.randomUUID()}`;
  const draftOrder = managers.map((manager) => manager.id);
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
      picks: [],
      trades: [],
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
    || incoming.draftAt !== previous.draftAt)) {
    return 'Only the commissioner can change league settings, draft order, or draft time.';
  }
  if (commissioner && (incoming.draftAt !== previous.draftAt)) return 'Use the draft scheduler to change the draft time.';
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
    || team.roster.some((player) => !player || !validString(String(player.id || ''), 100)))) {
    return 'Roster player data is invalid.';
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
      && (oldTeam.teamName !== nextTeam.teamName || oldTeam.name !== nextTeam.name)) {
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
      if (added.length > 1 && incoming.picks?.length === previous.picks.length && !isAcceptedTradeTeam) {
        return 'Add one free agent at a time.';
      }
      if (added.length && incoming.picks?.length > previous.picks.length) {
        if (added.length !== 1 || incoming.picks.length !== previous.picks.length + 1
          || !ownTeamIds.has(teamPickAt(previous, previous.picks.length))
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
      else if (path === '/save') result = await this.save(body);
      else result = { status: 404, error: 'Not found.' };
      return fantasyJson(result, result.status || 200);
    } catch (error) {
      console.error('Fantasy league store failed:', error);
      return fantasyJson({ error: 'League storage could not complete the request.' }, 500);
    }
  }

  async getUser(userId) {
    return await this.storage.get(`${USER_PREFIX}${userId}`) || { leagueIds: [], invitations: [] };
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
    for (const leagueId of user.leagueIds) {
      const record = await this.getLeague(leagueId);
      if (!record) continue;
      const team = record.league.managers.find((manager) => manager.ownerUserId === userId);
      leagues.push({
        leagueId,
        name: record.league.name,
        teamName: team?.teamName || '',
        userTeamId: team?.id || '',
        role: record.league.commissionerUserId === userId ? 'commissioner' : 'manager',
        revision: record.revision,
        draftAt: record.league.draftAt || null,
      });
    }
    return { username: String(username || ''), leagues, invitations: user.invitations };
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
    if (teamCount !== league.teamCount && (league.draftStarted || league.picks.length)) {
      return { status: 409, error: 'League size can only change before the draft starts.' };
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
          ownerUserId: null,
          roster: [],
        };
        league.managers.push(team);
        league.draftOrder.push(team.id);
      }
    }
    league.teamCount = teamCount;

    const claimedIds = new Set();
    for (const teamId of claimTeamIds) {
      const team = managerById(league, teamId);
      if (!team || team.ownerUserId) {
        return { status: 409, error: 'One or more selected teams are no longer available to claim.' };
      }
      claimedIds.add(teamId);
    }
    for (const teamId of claimedIds) {
      const team = managerById(league, teamId);
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
      inviterUsername: String(body.username || 'Commissioner'),
      invitedAt: Date.now(),
    };
    invitee.invitations.push(invitation);
    await this.putUser(inviteeUserId, invitee);
    return { success: true, invitation };
  }

  async acceptInvitation(body) {
    const userId = String(body.userId || '');
    const leagueId = String(body.leagueId || '');
    const teamId = String(body.teamId || '');
    const user = await this.getUser(userId);
    const invitationIndex = user.invitations.findIndex((invite) => invite.leagueId === leagueId && invite.teamId === teamId);
    if (invitationIndex < 0) return { status: 404, error: 'Invitation not found.' };
    const record = await this.getLeague(leagueId);
    if (!record) return { status: 404, error: 'League no longer exists.' };
    const team = managerById(record.league, teamId);
    if (!team || team.ownerUserId) return { status: 409, error: 'That team is no longer available.' };
    team.ownerUserId = userId;
    team.name = String(body.username || 'Manager').slice(0, 40);
    record.revision += 1;
    user.invitations.splice(invitationIndex, 1);
    user.leagueIds = [...new Set([...user.leagueIds, leagueId])];
    await this.putLeague(record);
    await this.putUser(userId, user);
    return { leagueId, teamId, success: true };
  }

  async declineInvitation(body) {
    const userId = String(body.userId || '');
    const leagueId = String(body.leagueId || '');
    const teamId = String(body.teamId || '');
    const user = await this.getUser(userId);
    const countBefore = user.invitations.length;
    user.invitations = user.invitations.filter((invite) => invite.leagueId !== leagueId || invite.teamId !== teamId);
    if (user.invitations.length === countBefore) return { status: 404, error: 'Invitation not found.' };
    await this.putUser(userId, user);
    return { success: true };
  }

  async schedule(body) {
    const record = await this.getLeague(String(body.leagueId || ''));
    if (!record) return { status: 404, error: 'League not found.' };
    if (record.league.commissionerUserId !== body.userId) return { status: 403, error: 'Only the commissioner can schedule the draft.' };
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
}
