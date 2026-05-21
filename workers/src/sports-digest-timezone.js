/**
 * Sports Digest schedule times are Central (CT). Sends fire at UTC = CT − 5 hours
 * (e.g. 3:30 PM CT → 10:30 UTC). Fixed offset — not DST-aware America/Chicago.
 */

export const SPORTS_DIGEST_TIME_ZONE = 'America/Chicago';
export const SPORTS_DIGEST_CENTRAL_UTC_OFFSET_HOURS = 5;

const CENTRAL_OFFSET_MS = SPORTS_DIGEST_CENTRAL_UTC_OFFSET_HOURS * 60 * 60 * 1000;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function normalizeHm(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t).trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${pad2(h)}:${pad2(min)}`;
}

function centralDateFromUtcMs(ms) {
  return new Date(ms + CENTRAL_OFFSET_MS);
}

export function utcTimeHm(ms) {
  const d = new Date(ms);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** Central wall clock derived from a UTC instant (CT = UTC + 5h). */
export function chicagoDateYmd(ms) {
  const d = centralDateFromUtcMs(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function chicagoTimeHm(ms) {
  const d = centralDateFromUtcMs(ms);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

export function chicagoWeekdayIndex(ms) {
  return centralDateFromUtcMs(ms).getUTCDay();
}

/** Convert a Central schedule HH:MM to the UTC HH:MM when the cron should send. */
export function centralToUtcHm(ctHm) {
  const norm = normalizeHm(ctHm);
  if (!norm) return null;
  const [h, min] = norm.split(':').map((x) => parseInt(x, 10));
  let utcH = h - SPORTS_DIGEST_CENTRAL_UTC_OFFSET_HOURS;
  if (utcH < 0) utcH += 24;
  return `${pad2(utcH)}:${pad2(min)}`;
}

export function isQuarterHourHm(hm) {
  return /^([01]?\d|2[0-3]):(00|15|30|45)$/.test(hm);
}

export function chicagoNow() {
  const ms = Date.now();
  return {
    ms,
    ymd: chicagoDateYmd(ms),
    hm: chicagoTimeHm(ms),
    weekday: chicagoWeekdayIndex(ms),
    utcHm: utcTimeHm(ms),
    timeZone: SPORTS_DIGEST_TIME_ZONE,
    utcOffsetHours: -SPORTS_DIGEST_CENTRAL_UTC_OFFSET_HOURS,
  };
}
