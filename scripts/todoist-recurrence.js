/** Map Todoist DATE column strings to Tether task fields. */

const DAY_NAMES = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

const MONTH_NAMES = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function extractLabels(title) {
  const labels = [];
  const re = /@([a-zA-Z0-9_-]+)/g;
  let m;
  while ((m = re.exec(String(title || '')))) labels.push(m[1].toLowerCase());
  return [...new Set(labels)];
}

function parseAnnualDate(raw, today = new Date()) {
  const s = String(raw || '').trim().toLowerCase();
  const m1 = s.match(/every\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)/i);
  if (m1) {
    const month = MONTH_NAMES[m1[2].toLowerCase()];
    const day = Number(m1[1]);
    if (month != null && day >= 1 && day <= 31) {
      let d = new Date(today.getFullYear(), month, day, 12, 0, 0, 0);
      if (d < new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0)) {
        d = new Date(today.getFullYear() + 1, month, day, 12, 0, 0, 0);
      }
      return isoDate(d);
    }
  }
  const m2 = s.match(/every\s+([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/i);
  if (m2) {
    const month = MONTH_NAMES[m2[1].toLowerCase()];
    const day = Number(m2[2]);
    if (month != null && day >= 1 && day <= 31) {
      let d = new Date(today.getFullYear(), month, day, 12, 0, 0, 0);
      if (d < new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0)) {
        d = new Date(today.getFullYear() + 1, month, day, 12, 0, 0, 0);
      }
      return isoDate(d);
    }
  }
  return '';
}

/**
 * @returns {{ dueDate: string, recurrence: string|null, recurrenceDay?: number, scheduleNote?: string }}
 */
export function mapTodoistDate(raw, today = new Date()) {
  const s = String(raw || '').trim();
  const lower = s.toLowerCase();
  if (!s) return { dueDate: '', recurrence: null };

  const inDays = lower.match(/^in\s+(\d+)\s+days?$/);
  if (inDays) {
    const d = new Date(today);
    d.setDate(d.getDate() + Number(inDays[1]));
    return { dueDate: isoDate(d), recurrence: null };
  }

  const weeklyDay = lower.match(
    /every\s+(?:(?:1st|first)\s+)?(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thur(?:s(?:day)?)?|fri(?:day)?|sat(?:urday)?)\b/
  );
  if (weeklyDay) {
    const key = weeklyDay[1].replace(/day$/, '').slice(0, 3);
    const dayKey = Object.keys(DAY_NAMES).find((k) => key.startsWith(k.slice(0, 3))) || weeklyDay[1];
    const recurrenceDay = DAY_NAMES[dayKey] ?? DAY_NAMES[weeklyDay[1].slice(0, 3)] ?? 0;
    return { dueDate: '', recurrence: 'weekly', recurrenceDay };
  }

  if (/^every\s+week\b/.test(lower)) {
    return { dueDate: '', recurrence: 'weekly', recurrenceDay: 0 };
  }

  if (/^every\s+month\b/.test(lower) || /^every\s+1st\s+day\b/.test(lower)) {
    return { dueDate: '', recurrence: 'monthly' };
  }

  if (/^every\s+day\b/.test(lower)) {
    return { dueDate: '', recurrence: 'daily' };
  }

  const annualDue = parseAnnualDate(lower, today);
  if (annualDue) {
    return { dueDate: annualDue, recurrence: null, scheduleNote: `Todoist: ${s}` };
  }

  if (/^every\b/.test(lower)) {
    return { dueDate: '', recurrence: null, scheduleNote: `Todoist: ${s}` };
  }

  return { dueDate: '', recurrence: null, scheduleNote: s ? `Todoist: ${s}` : undefined };
}

export function buildTetherTask(row, userId, sortOrder, today = new Date()) {
  const title = String(row.content || '').trim();
  if (!title) return null;

  let notes = String(row.description || '').trim();
  const schedule = mapTodoistDate(row.date, today);
  if (schedule.scheduleNote) {
    notes = notes ? `${notes}\n\n${schedule.scheduleNote}` : schedule.scheduleNote;
  }

  const task = {
    id: crypto.randomUUID(),
    title,
    definitionOfDone: '',
    notes,
    dueDate: schedule.dueDate || '',
    status: 'todo',
    assigneeUserIds: [userId],
    dependsOnTaskIds: [],
    labels: extractLabels(title),
    sortOrder,
  };

  if (schedule.recurrence) {
    task.recurrence = schedule.recurrence;
    if (schedule.recurrence === 'weekly' && schedule.recurrenceDay != null) {
      task.recurrenceDay = schedule.recurrenceDay;
    }
  }

  return task;
}
