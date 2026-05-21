/** Sports Digest schedules are always wall-clock America/Chicago (Central), never UTC. */

export const SPORTS_DIGEST_TIME_ZONE = 'America/Chicago';

const WEEKDAY_MAP = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function chicagoParts(ms) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: SPORTS_DIGEST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ms));
}

function part(parts, type) {
  return parts.find((p) => p.type === type)?.value ?? '';
}

export function chicagoDateYmd(ms) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SPORTS_DIGEST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

export function chicagoTimeHm(ms) {
  const parts = chicagoParts(ms);
  let hour = parseInt(part(parts, 'hour'), 10);
  const minute = part(parts, 'minute');
  if (Number.isNaN(hour)) hour = 0;
  if (hour === 24) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

export function chicagoWeekdayIndex(ms) {
  const name = part(chicagoParts(ms), 'weekday');
  return WEEKDAY_MAP[name] ?? -1;
}

export function isChicagoQuarterHour(hm) {
  return /^([01]?\d|2[0-3]):(00|15|30|45)$/.test(hm);
}

export function chicagoNow() {
  const ms = Date.now();
  return {
    ms,
    ymd: chicagoDateYmd(ms),
    hm: chicagoTimeHm(ms),
    weekday: chicagoWeekdayIndex(ms),
    timeZone: SPORTS_DIGEST_TIME_ZONE,
  };
}
