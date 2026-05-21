/** Team catalog for Sports Digest — keep team `id` values in sync with sports-digest worker `TEAMS[].id`. */

export const SPORTS_DIGEST_TEAMS = [
  { id: 'brewers', label: 'Milwaukee Brewers', sport: 'MLB', emoji: '⚾' },
  { id: 'packers', label: 'Green Bay Packers', sport: 'NFL', emoji: '🏈' },
  { id: 'bucks', label: 'Milwaukee Bucks', sport: 'NBA', emoji: '🏀' },
];

export const SPORTS_DIGEST_FREQUENCIES = [
  { id: 'twice_daily', label: 'Twice daily', detail: '6:00 AM & 6:00 PM Central' },
  { id: 'morning', label: 'Once daily — morning', detail: '6:00 AM Central' },
  { id: 'evening', label: 'Once daily — evening', detail: '6:00 PM Central' },
  { id: 'weekly', label: 'Weekly', detail: 'Sundays at 6:00 AM Central' },
];

const TEAM_ID_SET = new Set(SPORTS_DIGEST_TEAMS.map((t) => t.id));
const FREQUENCY_ID_SET = new Set(SPORTS_DIGEST_FREQUENCIES.map((f) => f.id));

export const DEFAULT_SPORTS_DIGEST_PREFS = {
  enabled: false,
  teams: [],
  frequency: 'twice_daily',
};

export function normalizeSportsDigestPrefs(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const teams = Array.isArray(src.teams)
    ? [...new Set(src.teams.filter((id) => typeof id === 'string' && TEAM_ID_SET.has(id)))]
    : [];
  const frequency =
    typeof src.frequency === 'string' && FREQUENCY_ID_SET.has(src.frequency)
      ? src.frequency
      : DEFAULT_SPORTS_DIGEST_PREFS.frequency;
  return {
    enabled: src.enabled === true,
    teams,
    frequency,
  };
}

export function validateSportsDigestSave(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body' };
  }
  if (typeof body.enabled !== 'boolean') {
    return { ok: false, error: 'Send enabled (boolean)' };
  }
  if (!Array.isArray(body.teams)) {
    return { ok: false, error: 'Send teams (array of team ids)' };
  }
  const teams = [...new Set(body.teams.filter((id) => typeof id === 'string' && TEAM_ID_SET.has(id)))];
  if (body.enabled && teams.length === 0) {
    return { ok: false, error: 'Choose at least one team when Sports Digest is on.' };
  }
  const frequency =
    typeof body.frequency === 'string' && FREQUENCY_ID_SET.has(body.frequency)
      ? body.frequency
      : DEFAULT_SPORTS_DIGEST_PREFS.frequency;
  return {
    ok: true,
    prefs: { enabled: body.enabled, teams, frequency },
  };
}
