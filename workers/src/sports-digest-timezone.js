/**
 * Sports Digest schedule times are US Central (America/Chicago), including DST.
 */

export const SPORTS_DIGEST_TIME_ZONE = 'America/Chicago';

/** @deprecated Use {@link chicagoHoursEastOfCentral} — was a fixed CDT-only offset. */
export const SPORTS_DIGEST_CENTRAL_UTC_OFFSET_HOURS = 5;

const WEEKDAY_SHORT = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

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

function chicagoParts(ms, fields) {
  return new Intl.DateTimeFormat('en-US', { timeZone: SPORTS_DIGEST_TIME_ZONE, ...fields }).formatToParts(
    new Date(ms),
  );
}

function partValue(parts, type) {
  return parts.find((p) => p.type === type)?.value;
}

export function utcTimeHm(ms) {
  const d = new Date(ms);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** Central calendar date YYYY-MM-DD for a UTC instant. */
export function chicagoDateYmd(ms) {
  const parts = chicagoParts(ms, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const y = partValue(parts, 'year');
  const mo = partValue(parts, 'month');
  const d = partValue(parts, 'day');
  if (!y || !mo || !d) return '';
  return `${y}-${mo}-${d}`;
}

export function chicagoTimeHm(ms) {
  const parts = chicagoParts(ms, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  let h = partValue(parts, 'hour');
  const min = partValue(parts, 'minute');
  if (h === '24') h = '00';
  if (h == null || min == null) return '';
  return `${pad2(parseInt(h, 10))}:${min}`;
}

export function chicagoWeekdayIndex(ms) {
  const wd = partValue(chicagoParts(ms, { weekday: 'short' }), 'weekday');
  return wd != null && wd in WEEKDAY_SHORT ? WEEKDAY_SHORT[wd] : 0;
}

/**
 * UTC epoch ms for a Central wall-clock date + time (handles CST/CDT).
 * @returns {number | null}
 */
export function centralLocalToUtcMs(ymd, hm) {
  const norm = normalizeHm(hm);
  if (!norm || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return null;
  const [y, mo, d] = ymd.split('-').map((x) => parseInt(x, 10));
  if (![y, mo, d].every(Number.isFinite)) return null;
  const start = Date.UTC(y, mo - 1, d, 0, 0) - 8 * 60 * 60 * 1000;
  const end = Date.UTC(y, mo - 1, d, 0, 0) + 32 * 60 * 60 * 1000;
  for (let ms = start; ms < end; ms += 60 * 1000) {
    if (chicagoDateYmd(ms) === ymd && chicagoTimeHm(ms) === norm) return ms;
  }
  return null;
}

/** Hours to add to Central local time to get UTC (5 in CDT, 6 in CST). */
export function chicagoHoursEastOfCentral(ms = Date.now()) {
  const tz =
    partValue(
      chicagoParts(ms, { timeZoneName: 'shortOffset' }),
      'timeZoneName',
    ) || '';
  const m = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(tz);
  if (m) {
    const sign = m[1] === '+' ? -1 : 1;
    const hours = parseInt(m[2], 10);
    const mins = m[3] ? parseInt(m[3], 10) : 0;
    return sign * (hours + mins / 60);
  }
  const noon = centralLocalToUtcMs(chicagoDateYmd(ms), '12:00');
  const probe = noon != null ? noon : ms;
  const utcNoon = Date.UTC(
    new Date(probe).getUTCFullYear(),
    new Date(probe).getUTCMonth(),
    new Date(probe).getUTCDate(),
    12,
    0,
  );
  return Math.round(((utcNoon - probe) / (60 * 60 * 1000) + 12) * 2) / 2;
}

/** Convert a Central schedule HH:MM (today in Chicago) to the UTC HH:MM at that send. */
export function centralToUtcHm(ctHm) {
  const ms = centralLocalToUtcMs(chicagoDateYmd(Date.now()), ctHm);
  if (ms === null) return null;
  return utcTimeHm(ms);
}

export function isQuarterHourHm(hm) {
  return /^([01]?\d|2[0-3]):(00|15|30|45)$/.test(hm);
}

export function chicagoNow() {
  const ms = Date.now();
  const east = chicagoHoursEastOfCentral(ms);
  return {
    ms,
    ymd: chicagoDateYmd(ms),
    hm: chicagoTimeHm(ms),
    weekday: chicagoWeekdayIndex(ms),
    utcHm: utcTimeHm(ms),
    timeZone: SPORTS_DIGEST_TIME_ZONE,
    utcOffsetHours: -east,
  };
}