/** Schedule + validation for Sports Digest — team list in sports-digest-team-catalog.js */

import { SPORTS_DIGEST_TEAM_CATALOG } from './sports-digest-team-catalog.js';

export { SPORTS_DIGEST_TEAM_CATALOG };

export const SPORTS_DIGEST_MAX_TEAMS = 25;
export const SPORTS_DIGEST_MAX_CUSTOM_TIMES = 6;

export const SPORTS_DIGEST_LEAGUES = [
  { id: 'mlb', label: 'MLB', sport: 'MLB', emoji: '⚾' },
  { id: 'nfl', label: 'NFL', sport: 'NFL', emoji: '🏈' },
  { id: 'nba', label: 'NBA', sport: 'NBA', emoji: '🏀' },
];

/** Preset send schedules — all times America/Chicago (Central), 24h HH:MM. */
export const SPORTS_DIGEST_PRESETS = [
  { id: 'twice_daily', label: 'Twice daily', detail: '6:00 AM & 6:00 PM Central', times: ['06:00', '18:00'], days: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'morning', label: 'Once daily — morning', detail: '6:00 AM Central', times: ['06:00'], days: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'evening', label: 'Once daily — evening', detail: '6:00 PM Central', times: ['18:00'], days: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'weekly', label: 'Weekly', detail: 'Sundays at 6:00 AM Central', times: ['06:00'], days: [0] },
  { id: 'noon', label: 'Lunchtime', detail: '12:00 PM Central every day', times: ['12:00'], days: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'custom', label: 'Custom', detail: 'Pick your own times and days (Central Time)', times: [], days: [0, 1, 2, 3, 4, 5, 6] },
];

/** @deprecated use SPORTS_DIGEST_PRESETS */
export const SPORTS_DIGEST_FREQUENCIES = SPORTS_DIGEST_PRESETS.filter((p) => p.id !== 'custom');

const LEGACY_TEAM_ID_MAP = {
  brewers: 'mlb-8',
  packers: 'nfl-9',
  bucks: 'nba-15',
};

const TEAM_ID_SET = new Set(SPORTS_DIGEST_TEAM_CATALOG.map((t) => t.id));
const PRESET_ID_SET = new Set(SPORTS_DIGEST_PRESETS.map((p) => p.id));

/** Any minute 00–59 (Central Time). Cron runs every minute. */
const CUSTOM_TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export const DEFAULT_SPORTS_DIGEST_PREFS = {
  enabled: false,
  teams: [],
  frequency: 'twice_daily',
  customTimes: ['09:00'],
  customDays: [0, 1, 2, 3, 4, 5, 6],
};

function mapLegacyTeamId(id) {
  if (typeof id !== 'string') return null;
  if (TEAM_ID_SET.has(id)) return id;
  return LEGACY_TEAM_ID_MAP[id] || null;
}

function normalizeCustomTimes(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const t of raw) {
    if (typeof t !== 'string') continue;
    const m = t.trim();
    if (!CUSTOM_TIME_RE.test(m)) continue;
    const [h, min] = m.split(':');
    const norm = `${String(parseInt(h, 10)).padStart(2, '0')}:${min}`;
    if (!out.includes(norm)) out.push(norm);
  }
  return out.slice(0, SPORTS_DIGEST_MAX_CUSTOM_TIMES);
}

function normalizeCustomDays(raw) {
  if (!Array.isArray(raw)) return [0, 1, 2, 3, 4, 5, 6];
  const out = [...new Set(raw.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
  return out.length ? out.sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6];
}

export function normalizeSportsDigestPrefs(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const teams = Array.isArray(src.teams)
    ? [...new Set(src.teams.map(mapLegacyTeamId).filter(Boolean))]
    : [];
  const customTimes = normalizeCustomTimes(src.customTimes);
  const customDays = normalizeCustomDays(src.customDays);
  let frequency =
    typeof src.frequency === 'string' && PRESET_ID_SET.has(src.frequency)
      ? src.frequency
      : DEFAULT_SPORTS_DIGEST_PREFS.frequency;
  // Any non-empty custom times always use the custom schedule (ignore preset frequency).
  if (customTimes.length > 0) {
    frequency = 'custom';
  } else if (frequency === 'custom') {
    frequency = 'twice_daily';
  }
  return {
    enabled: src.enabled === true,
    teams,
    frequency,
    customTimes: frequency === 'custom' ? customTimes : customTimes,
    customDays,
  };
}

export function resolveScheduleTimes(prefs) {
  const p = normalizeSportsDigestPrefs(prefs);
  if (p.frequency === 'custom') {
    return { times: p.customTimes, days: p.customDays };
  }
  const preset = SPORTS_DIGEST_PRESETS.find((x) => x.id === p.frequency);
  if (preset) return { times: preset.times, days: preset.days };
  return { times: ['06:00', '18:00'], days: [0, 1, 2, 3, 4, 5, 6] };
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
  const teams = [...new Set(body.teams.map(mapLegacyTeamId).filter(Boolean))];
  if (body.enabled && teams.length === 0) {
    return { ok: false, error: 'Choose at least one team when Sports Digest is on.' };
  }
  if (body.enabled && teams.length > SPORTS_DIGEST_MAX_TEAMS) {
    return {
      ok: false,
      error: `Choose at most ${SPORTS_DIGEST_MAX_TEAMS} teams per digest (you selected ${teams.length}).`,
    };
  }
  const frequency =
    typeof body.frequency === 'string' && PRESET_ID_SET.has(body.frequency)
      ? body.frequency
      : DEFAULT_SPORTS_DIGEST_PREFS.frequency;
  const customTimes = normalizeCustomTimes(body.customTimes);
  const customDays = normalizeCustomDays(body.customDays);
  if (body.enabled && frequency === 'custom' && customTimes.length === 0) {
    return { ok: false, error: 'Add at least one custom time (Central Time, HH:MM).' };
  }
  return {
    ok: true,
    prefs: {
      enabled: body.enabled,
      teams,
      frequency,
      customTimes: frequency === 'custom' ? customTimes : customTimes,
      customDays,
    },
  };
}
