/** Sports Digest scheduled sends — subscriber matching + content fetch from sports-digest worker. */

import { resolveScheduleTimes } from './sports-digest-teams.js';
import {
  centralLocalToUtcMs,
  chicagoDateYmd,
  chicagoTimeHm,
  chicagoWeekdayIndex,
  isQuarterHourHm,
  utcTimeHm,
} from './sports-digest-timezone.js';

/** Bump when schedule/dedup semantics change (e.g. America/Chicago DST). Clears stale send locks. */
export const SPORTS_DIGEST_SCHEDULE_EPOCH = 2;
export const SPORTS_DIGEST_QUARTER_CRON = '0,15,30,45 * * * *';
const DEFAULT_DIGEST_SINCE_MS = 12 * 60 * 60 * 1000;
const SLOT_MATCH_MS = 2 * 60 * 1000;
function normalizeHm(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function resolveSubscriberSchedule(sub) {
  return resolveScheduleTimes(sub);
}

export function buildSendKey(ymd, hm) {
  return `${ymd}|${hm}`;
}

/** Reset dedup after schedule epoch changes (fixed UTC offset used to mark sends at the wrong instant). */
export function migrateSubscriberSendState(sub) {
  if (!sub || typeof sub !== 'object') return sub;
  if (sub.scheduleEpoch === SPORTS_DIGEST_SCHEDULE_EPOCH) return sub;
  return {
    ...sub,
    scheduleEpoch: SPORTS_DIGEST_SCHEDULE_EPOCH,
    lastSentKeys: [],
    lastSentSlots: [],
    lastSentMorningYmd: undefined,
    lastSentEveningYmd: undefined,
    lastSentWeeklyYmd: undefined,
  };
}

export function subscriberAlreadySent(sub, sendKey, _ymd, _hm, scheduledMs) {
  if (sub?.scheduleEpoch !== SPORTS_DIGEST_SCHEDULE_EPOCH) return false;
  const slots = Array.isArray(sub.lastSentSlots) ? sub.lastSentSlots : [];
  for (const slot of slots) {
    if (!slot || slot.key !== sendKey) continue;
    if (typeof slot.scheduledMs === 'number' && typeof scheduledMs === 'number') {
      if (Math.abs(slot.scheduledMs - scheduledMs) <= SLOT_MATCH_MS) return true;
      continue;
    }
    return true;
  }
  if (Array.isArray(sub.lastSentKeys) && sub.lastSentKeys.includes(sendKey)) {
    const slotMs = parseSendKeyToUtcMs(sendKey);
    if (slotMs !== null && typeof scheduledMs === 'number' && Math.abs(slotMs - scheduledMs) <= SLOT_MATCH_MS) {
      return true;
    }
  }
  return false;
}

export function subscriberSendKey(sub, ymd, hm, weekday, scheduledMs) {
  const tickHm = normalizeHm(hm);
  if (!tickHm || !isQuarterHourHm(tickHm)) return null;
  const { times, days } = resolveSubscriberSchedule(sub);
  if (!times.length || weekday < 0) return null;
  if (!days.includes(weekday)) return null;
  if (!times.includes(tickHm)) return null;
  const key = buildSendKey(ymd, tickHm);
  if (subscriberAlreadySent(sub, key, ymd, tickHm, scheduledMs)) return null;
  return key;
}

export function applySendKey(sub, sendKey, scheduledMs) {
  const keys = Array.isArray(sub.lastSentKeys) ? [...sub.lastSentKeys] : [];
  if (!keys.includes(sendKey)) keys.push(sendKey);
  const slots = Array.isArray(sub.lastSentSlots) ? [...sub.lastSentSlots] : [];
  if (typeof scheduledMs === 'number' && Number.isFinite(scheduledMs)) {
    slots.push({ key: sendKey, scheduledMs });
  }
  return {
    ...sub,
    lastSentKeys: keys.slice(-40),
    lastSentSlots: slots.slice(-40),
    scheduleEpoch: SPORTS_DIGEST_SCHEDULE_EPOCH,
  };
}

/** Parse `ymd|HH:MM` (Central schedule) to UTC epoch ms. */
export function parseSendKeyToUtcMs(sendKey) {
  const m = /^(\d{4}-\d{2}-\d{2})\|(\d{2}:\d{2})$/.exec(String(sendKey || '').trim());
  if (!m) return null;
  const [y, mo, d] = m[1].split('-').map((x) => parseInt(x, 10));
  const [h, min] = m[2].split(':').map((x) => parseInt(x, 10));
  if (![y, mo, d, h, min].every(Number.isFinite)) return null;
  return centralLocalToUtcMs(m[1], m[2]);
}

/** News/social window start: last successful send, or 12h fallback for first digest. */
export function resolveSubscriberSinceMs(sub, nowMs = Date.now()) {
  if (!sub || typeof sub !== 'object') return nowMs - DEFAULT_DIGEST_SINCE_MS;
  let best = null;
  const keys = Array.isArray(sub.lastSentKeys) ? sub.lastSentKeys : [];
  for (const k of keys) {
    const ms = parseSendKeyToUtcMs(k);
    if (ms !== null && ms <= nowMs && (best === null || ms > best)) best = ms;
  }
  if (sub.lastSentMorningYmd) {
    const ms = parseSendKeyToUtcMs(`${sub.lastSentMorningYmd}|06:00`);
    if (ms !== null && ms <= nowMs && (best === null || ms > best)) best = ms;
  }
  if (sub.lastSentEveningYmd) {
    const ms = parseSendKeyToUtcMs(`${sub.lastSentEveningYmd}|18:00`);
    if (ms !== null && ms <= nowMs && (best === null || ms > best)) best = ms;
  }
  if (sub.lastSentWeeklyYmd) {
    const ms = parseSendKeyToUtcMs(`${sub.lastSentWeeklyYmd}|06:00`);
    if (ms !== null && ms <= nowMs && (best === null || ms > best)) best = ms;
  }
  if (best === null) return nowMs - DEFAULT_DIGEST_SINCE_MS;
  return best;
}

/** @returns {{ ymd: string, hm: string, weekday: number, utcHm: string } | null} */
export function getSportsDigestCronTick(event) {
  const scheduledMs =
    event && typeof event.scheduledTime === 'number' && Number.isFinite(event.scheduledTime)
      ? event.scheduledTime
      : Date.now();
  const hm = chicagoTimeHm(scheduledMs);
  if (!hm || !isQuarterHourHm(hm)) return null;
  const utcHm = utcTimeHm(scheduledMs);
  return {
    ymd: chicagoDateYmd(scheduledMs),
    hm,
    weekday: chicagoWeekdayIndex(scheduledMs),
    utcHm,
    scheduledMs,
  };
}

export async function fetchSportsDigestEmailContent(env, { teams, username, sinceMs, includeTopHeadlines }) {
  const secret = env.SPORTS_DIGEST_INTERNAL_SECRET || env.TEST_SECRET;
  if (!secret) {
    throw new Error('Set SPORTS_DIGEST_INTERNAL_SECRET or TEST_SECRET for sports digest content builds');
  }
  if (!Array.isArray(teams) || teams.length === 0) {
    throw new Error('No teams to build — save at least one team, then try preview again');
  }
  const payload = { teams, username };
  if (typeof sinceMs === 'number' && Number.isFinite(sinceMs)) {
    payload.sinceMs = sinceMs;
  }
  if (includeTopHeadlines === true) {
    payload.includeTopHeadlines = true;
  }
  const init = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': secret,
    },
    body: JSON.stringify(payload),
  };

  let res;
  if (env.SPORTS_DIGEST && typeof env.SPORTS_DIGEST.fetch === 'function') {
    res = await env.SPORTS_DIGEST.fetch(new Request('https://sports-digest/api/build-email', init));
  } else {
    const base = String(env.SPORTS_DIGEST_BUILD_URL || 'https://sports-digest.matthewahrens.workers.dev').replace(
      /\/$/,
      ''
    );
    res = await fetch(`${base}/api/build-email`, init);
  }

  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    if (raw.includes('1042')) {
      throw new Error(
        'Sports digest build blocked (Cloudflare 1042) — redeploy chess-accounts with SPORTS_DIGEST service binding'
      );
    }
    throw new Error(`build-email invalid JSON (${res.status}): ${raw.slice(0, 200)}`);
  }
  if (!res.ok || !data?.subject || !data?.html) {
    if (res.status === 401) {
      throw new Error(
        'Sports digest build unauthorized — TEST_SECRET on chess-accounts must match sports-digest worker'
      );
    }
    throw new Error(data?.error || `build-email failed (${res.status})`);
  }
  return { subject: data.subject, html: data.html, text: data.text || '' };
}
