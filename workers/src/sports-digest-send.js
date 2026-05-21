/** Sports Digest scheduled sends — subscriber matching + content fetch from sports-digest worker. */

import { resolveScheduleTimes } from './sports-digest-teams.js';
import {
  chicagoDateYmd,
  chicagoTimeHm,
  chicagoWeekdayIndex,
  isQuarterHourHm,
  utcTimeHm,
} from './sports-digest-timezone.js';

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

export function subscriberAlreadySent(sub, sendKey, ymd, hm) {
  if (Array.isArray(sub.lastSentKeys) && sub.lastSentKeys.includes(sendKey)) return true;
  if (hm === '06:00' && sub.lastSentMorningYmd === ymd) return true;
  if (hm === '18:00' && sub.lastSentEveningYmd === ymd) return true;
  if (hm === '06:00' && sub.frequency === 'weekly' && sub.lastSentWeeklyYmd === ymd) return true;
  return false;
}

export function subscriberSendKey(sub, ymd, hm, weekday) {
  const tickHm = normalizeHm(hm);
  if (!tickHm || !isQuarterHourHm(tickHm)) return null;
  const { times, days } = resolveSubscriberSchedule(sub);
  if (!times.length || weekday < 0) return null;
  if (!days.includes(weekday)) return null;
  if (!times.includes(tickHm)) return null;
  const key = buildSendKey(ymd, tickHm);
  if (subscriberAlreadySent(sub, key, ymd, tickHm)) return null;
  return key;
}

export function applySendKey(sub, sendKey) {
  const keys = Array.isArray(sub.lastSentKeys) ? [...sub.lastSentKeys] : [];
  if (!keys.includes(sendKey)) keys.push(sendKey);
  return { ...sub, lastSentKeys: keys.slice(-40) };
}

/** @returns {{ ymd: string, hm: string, weekday: number, utcHm: string } | null} */
export function getSportsDigestCronTick(event) {
  const scheduledMs =
    event && typeof event.scheduledTime === 'number' && Number.isFinite(event.scheduledTime)
      ? event.scheduledTime
      : Date.now();
  const utcHm = utcTimeHm(scheduledMs);
  if (!isQuarterHourHm(utcHm)) return null;
  return {
    ymd: chicagoDateYmd(scheduledMs),
    hm: chicagoTimeHm(scheduledMs),
    weekday: chicagoWeekdayIndex(scheduledMs),
    utcHm,
    scheduledMs,
  };
}

export async function fetchSportsDigestEmailContent(env, { teams, username }) {
  const base = String(env.SPORTS_DIGEST_BUILD_URL || 'https://sports-digest.matthewahrens.workers.dev').replace(
    /\/$/,
    ''
  );
  const secret = env.SPORTS_DIGEST_INTERNAL_SECRET || env.TEST_SECRET;
  if (!secret) {
    throw new Error('Set SPORTS_DIGEST_INTERNAL_SECRET or TEST_SECRET for sports digest content builds');
  }
  const res = await fetch(`${base}/api/build-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': secret,
    },
    body: JSON.stringify({ teams, username }),
  });
  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`build-email invalid JSON (${res.status}): ${raw.slice(0, 200)}`);
  }
  if (!res.ok || !data?.subject || !data?.html) {
    throw new Error(data?.error || `build-email failed (${res.status})`);
  }
  return { subject: data.subject, html: data.html, text: data.text || '' };
}
