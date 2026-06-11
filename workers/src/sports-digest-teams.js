/** Schedule + validation for Sports Digest — team list in sports-digest-team-catalog.js */

import { SPORTS_DIGEST_TEAM_CATALOG } from './sports-digest-team-catalog.js';
import {
  SPORTS_DIGEST_WORLD_CUP_CATALOG,
  SPORTS_DIGEST_WORLD_CUP_AVAILABLE_UNTIL,
} from './sports-digest-world-cup-catalog.js';

export { SPORTS_DIGEST_TEAM_CATALOG, SPORTS_DIGEST_WORLD_CUP_CATALOG, SPORTS_DIGEST_WORLD_CUP_AVAILABLE_UNTIL };

export const SPORTS_DIGEST_MAX_TEAMS = 25;
export const SPORTS_DIGEST_MAX_CUSTOM_TIMES = 6;

const SPORTS_DIGEST_LEAGUES_BASE = [
  { id: 'mlb', label: 'MLB', sport: 'MLB', emoji: '⚾' },
  { id: 'nfl', label: 'NFL', sport: 'NFL', emoji: '🏈' },
  { id: 'nba', label: 'NBA', sport: 'NBA', emoji: '🏀' },
  { id: 'nhl', label: 'NHL', sport: 'NHL', emoji: '🏒' },
  { id: 'epl', label: 'Premier League', sport: 'Premier League', emoji: '⚽' },
  { id: 'cfb-b10', label: 'Big Ten Football', sport: 'Big Ten Football', emoji: '🏈' },
  { id: 'cfb-sec', label: 'SEC Football', sport: 'SEC Football', emoji: '🏈' },
  { id: 'cbb-b10', label: 'Big Ten Basketball', sport: 'Big Ten Basketball', emoji: '🏀' },
  { id: 'cbb-sec', label: 'SEC Basketball', sport: 'SEC Basketball', emoji: '🏀' },
];

const WORLD_CUP_LEAGUE = {
  id: 'wc26',
  label: 'World Cup 2026',
  sport: 'FIFA World Cup',
  emoji: '🏆',
  limitedTime: true,
  availableUntil: SPORTS_DIGEST_WORLD_CUP_AVAILABLE_UNTIL,
};

export function isWorldCupDigestAvailable(now = new Date()) {
  if (!Array.isArray(SPORTS_DIGEST_WORLD_CUP_CATALOG) || SPORTS_DIGEST_WORLD_CUP_CATALOG.length === 0) {
    return false;
  }
  const until = Date.parse(SPORTS_DIGEST_WORLD_CUP_AVAILABLE_UNTIL);
  return Number.isFinite(until) && now.getTime() <= until;
}

export function getSportsDigestTeamCatalog(now = new Date()) {
  if (!isWorldCupDigestAvailable(now)) return SPORTS_DIGEST_TEAM_CATALOG.slice();
  return SPORTS_DIGEST_TEAM_CATALOG.concat(SPORTS_DIGEST_WORLD_CUP_CATALOG);
}

export function getSportsDigestLeagues(now = new Date()) {
  if (!isWorldCupDigestAvailable(now)) return SPORTS_DIGEST_LEAGUES_BASE.slice();
  return SPORTS_DIGEST_LEAGUES_BASE.concat([WORLD_CUP_LEAGUE]);
}

/** @deprecated use getSportsDigestLeagues() */
export const SPORTS_DIGEST_LEAGUES = SPORTS_DIGEST_LEAGUES_BASE;

/** Preset send schedules — Central (CT) HH:MM. Worker sends at UTC = CT + 5 hours. */
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

function teamIdSet(now = new Date()) {
  return new Set(getSportsDigestTeamCatalog(now).map((t) => t.id));
}
const PRESET_ID_SET = new Set(SPORTS_DIGEST_PRESETS.map((p) => p.id));

/** Central Time HH:MM on 15-minute grid (:00, :15, :30, :45). Cron runs every 15 minutes. */
const CUSTOM_TIME_RE = /^([01]?\d|2[0-3]):(00|15|30|45)$/;

export const DEFAULT_SPORTS_DIGEST_PREFS = {
  enabled: false,
  teams: [],
  frequency: 'twice_daily',
  customTimes: ['09:00'],
  customDays: [0, 1, 2, 3, 4, 5, 6],
  includeTopHeadlines: false,
};

function mapLegacyTeamId(id, now = new Date()) {
  if (typeof id !== 'string') return null;
  const allowed = teamIdSet(now);
  if (allowed.has(id)) return id;
  return LEGACY_TEAM_ID_MAP[id] || null;
}

/** Dedupe team ids while preserving first-seen order (user priority). */
export function normalizeTeamIdsOrdered(raw, now = new Date()) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const id of raw) {
    const mapped = mapLegacyTeamId(id, now);
    if (!mapped || seen.has(mapped)) continue;
    seen.add(mapped);
    out.push(mapped);
  }
  return out;
}

/** Ordered team rows for admin UI — preserves user priority order from saved prefs. */
export function resolveDigestTeamDisplayRows(teamIds, now = new Date()) {
  const ids = Array.isArray(teamIds) ? teamIds : [];
  const byId = new Map(getSportsDigestTeamCatalog(now).map((t) => [t.id, t]));
  return ids.map((id, index) => {
    const t = byId.get(id);
    return {
      order: index + 1,
      id,
      label: t?.label || id,
      sport: t?.sport || '',
      abbr: t?.abbr || '',
    };
  });
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

export function normalizeSportsDigestPrefs(raw, now = new Date()) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const teams = normalizeTeamIdsOrdered(src.teams, now);
  const customTimes = normalizeCustomTimes(src.customTimes);
  const customDays = normalizeCustomDays(src.customDays);
  let frequency =
    typeof src.frequency === 'string' && PRESET_ID_SET.has(src.frequency)
      ? src.frequency
      : DEFAULT_SPORTS_DIGEST_PREFS.frequency;
  if (frequency === 'custom' && customTimes.length === 0) {
    frequency = DEFAULT_SPORTS_DIGEST_PREFS.frequency;
  }
  return {
    enabled: src.enabled === true,
    teams,
    frequency,
    customTimes: customTimes.length ? customTimes : DEFAULT_SPORTS_DIGEST_PREFS.customTimes.slice(),
    customDays,
    includeTopHeadlines: src.includeTopHeadlines === true,
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
  if (body.includeTopHeadlines != null && typeof body.includeTopHeadlines !== 'boolean') {
    return { ok: false, error: 'includeTopHeadlines must be a boolean' };
  }
  if (!Array.isArray(body.teams)) {
    return { ok: false, error: 'Send teams (array of team ids)' };
  }
  const teams = normalizeTeamIdsOrdered(body.teams);
  if (body.enabled && teams.length === 0) {
    return { ok: false, error: 'Choose at least one team when Digest is on.' };
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
  if (body.enabled && Array.isArray(body.customTimes)) {
    for (const t of body.customTimes) {
      if (typeof t === 'string' && t.trim() && !CUSTOM_TIME_RE.test(t.trim())) {
        return {
          ok: false,
          error: 'Custom times must be on 15-minute marks (:00, :15, :30, :45 Central Time).',
        };
      }
    }
  }
  const usesCustomSchedule = frequency === 'custom';
  if (body.enabled && usesCustomSchedule && customTimes.length === 0) {
    return { ok: false, error: 'Add at least one custom time (Central Time, every 15 minutes — :00, :15, :30, or :45).' };
  }
  return {
    ok: true,
    prefs: {
      enabled: body.enabled,
      teams,
      frequency,
      customTimes: customTimes.length ? customTimes : DEFAULT_SPORTS_DIGEST_PREFS.customTimes.slice(),
      customDays,
      includeTopHeadlines: body.includeTopHeadlines === true,
    },
  };
}
