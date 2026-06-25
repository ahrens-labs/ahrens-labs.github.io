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

const ORDINALS = { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4, fifth: 5, '5th': 5, last: -1 };

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function noonToday(today = new Date()) {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0);
}

function parseWeekday(name) {
  const raw = String(name || '').toLowerCase().replace(/day$/, '');
  const key = raw.slice(0, 3);
  const found = Object.keys(DAY_NAMES).find((k) => key.startsWith(k.slice(0, 3)) || k.startsWith(key));
  return found != null ? DAY_NAMES[found] : null;
}

function parseMonth(name) {
  return MONTH_NAMES[String(name || '').toLowerCase()] ?? null;
}

function parseOrdinal(token) {
  const t = String(token || '').toLowerCase();
  if (t === 'last') return -1;
  const n = Number(t.replace(/\D/g, ''));
  if (n >= 1 && n <= 5) return n;
  return ORDINALS[t] ?? null;
}

function nthWeekdayInMonth(year, month, nth, weekday) {
  if (nth === -1) {
    let d = new Date(year, month + 1, 0, 12, 0, 0, 0);
    while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
    return d;
  }
  let d = new Date(year, month, 1, 12, 0, 0, 0);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + (nth - 1) * 7);
  if (d.getMonth() !== month) return null;
  return d;
}

function nextOnOrAfter(d, today = new Date()) {
  return d >= noonToday(today) ? d : null;
}

/** Next occurrence of weekday (0=Sun), including today. */
export function initialWeeklyDue(recurrenceDay, today = new Date()) {
  const target = recurrenceDay != null ? Number(recurrenceDay) : 0;
  const d = noonToday(today);
  for (let i = 0; i < 7; i++) {
    if (d.getDay() === target) return isoDate(d);
    d.setDate(d.getDate() + 1);
  }
  return isoDate(d);
}

/** Next occurrence of day-of-month (1–31), including today. */
export function initialMonthlyDue(dayOfMonth, today = new Date()) {
  const dom = Math.min(Math.max(Number(dayOfMonth) || 1, 1), 31);
  const now = noonToday(today);
  let d = new Date(now.getFullYear(), now.getMonth(), dom, 12, 0, 0, 0);
  if (d < now) d = new Date(now.getFullYear(), now.getMonth() + 1, dom, 12, 0, 0, 0);
  return isoDate(d);
}

export function nextNthWeekdayDue(nth, weekday, month, today = new Date()) {
  const now = noonToday(today);
  if (month != null) {
    for (let y = now.getFullYear(); y <= now.getFullYear() + 2; y++) {
      const d = nthWeekdayInMonth(y, month, nth, weekday);
      if (d && d >= now) return isoDate(d);
    }
    return '';
  }
  for (let i = 0; i < 14; i++) {
    const abs = now.getMonth() + i;
    const y = now.getFullYear() + Math.floor(abs / 12);
    const m = abs % 12;
    const d = nthWeekdayInMonth(y, m, nth, weekday);
    if (d && d >= now) return isoDate(d);
  }
  return '';
}

function addDays(date, days) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date, months) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addYears(date, years) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function parseAnnualDate(raw, today = new Date()) {
  const s = String(raw || '').trim().toLowerCase();
  const m1 = s.match(/every\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)/i);
  if (m1) {
    const month = parseMonth(m1[2]);
    const day = Number(m1[1]);
    if (month != null && day >= 1 && day <= 31) {
      let d = new Date(today.getFullYear(), month, day, 12, 0, 0, 0);
      if (d < noonToday(today)) d = new Date(today.getFullYear() + 1, month, day, 12, 0, 0, 0);
      return isoDate(d);
    }
  }
  const m2 = s.match(/every\s+([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/i);
  if (m2) {
    const month = parseMonth(m2[1]);
    const day = Number(m2[2]);
    if (month != null && day >= 1 && day <= 31) {
      let d = new Date(today.getFullYear(), month, day, 12, 0, 0, 0);
      if (d < noonToday(today)) d = new Date(today.getFullYear() + 1, month, day, 12, 0, 0, 0);
      return isoDate(d);
    }
  }
  return '';
}

function scheduleBase(raw) {
  return {
    dueDate: '',
    recurrence: null,
    recurrenceInterval: 1,
    recurrenceDay: undefined,
    recurrenceWeekOfMonth: undefined,
    recurrenceMonth: undefined,
    todoistSchedule: raw || undefined,
    scheduleNote: undefined,
  };
}

/**
 * Todoist CSV DATE column has recurrence rules, not the next due date.
 * We compute the next occurrence from the rule using today as the anchor.
 * @returns schedule fields for a Tether task
 */
export function mapTodoistDate(raw, today = new Date()) {
  const s = String(raw || '').trim();
  const lower = s.toLowerCase();
  if (!s) return scheduleBase('');

  const out = scheduleBase(s);
  const now = noonToday(today);

  const inDays = lower.match(/^in\s+(\d+)\s+days?$/);
  if (inDays) {
    out.dueDate = isoDate(addDays(now, Number(inDays[1])));
    out.todoistSchedule = undefined;
    return out;
  }

  const lastWeekdayOfMonth = lower.match(
    /^every\s+last\s+(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thur(?:s(?:day)?)?|fri(?:day)?|sat(?:urday)?)\s+of\s+([a-z]+)\b/
  );
  if (lastWeekdayOfMonth) {
    const weekday = parseWeekday(lastWeekdayOfMonth[1]);
    const month = parseMonth(lastWeekdayOfMonth[2]);
    if (weekday != null && month != null) {
      out.recurrence = 'yearly';
      out.recurrenceDay = weekday;
      out.recurrenceWeekOfMonth = -1;
      out.recurrenceMonth = month;
      out.dueDate = nextNthWeekdayDue(-1, weekday, month, today);
      return out;
    }
  }

  const nthWeekday = lower.match(
    /^every\s+(?:(\d+(?:st|nd|rd|th)?)|first|second|third|fourth|fifth|last)\s+(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thur(?:s(?:day)?)?|fri(?:day)?|sat(?:urday)?)\b/
  );
  if (nthWeekday) {
    const nth = parseOrdinal(nthWeekday[1]);
    const weekday = parseWeekday(nthWeekday[2]);
    if (nth != null && weekday != null) {
      out.recurrence = 'monthly';
      out.recurrenceDay = weekday;
      out.recurrenceWeekOfMonth = nth;
      out.dueDate = nextNthWeekdayDue(nth, weekday, null, today);
      return out;
    }
  }

  const everyDays = lower.match(/^every\s+(\d+)\s+days?$/);
  if (everyDays) {
    const n = Number(everyDays[1]);
    out.recurrence = 'daily';
    out.recurrenceInterval = n;
    out.dueDate = isoDate(addDays(now, n));
    return out;
  }

  const everyWeeks = lower.match(/^every\s+(\d+)\s+weeks?$/);
  if (everyWeeks) {
    const n = Number(everyWeeks[1]);
    out.recurrence = 'weekly';
    out.recurrenceInterval = n;
    out.recurrenceDay = now.getDay();
    out.dueDate = isoDate(addDays(now, n * 7));
    return out;
  }

  const everyMonths = lower.match(/^every\s+(\d+)\s+months?$/);
  if (everyMonths) {
    const n = Number(everyMonths[1]);
    out.recurrence = 'monthly';
    out.recurrenceInterval = n;
    out.recurrenceDay = now.getDate();
    out.dueDate = isoDate(addMonths(now, n));
    return out;
  }

  const everyYears = lower.match(/^every\s+(\d+)\s+years?$/);
  if (everyYears) {
    const n = Number(everyYears[1]);
    out.recurrence = 'yearly';
    out.recurrenceInterval = n;
    out.recurrenceDay = now.getDate();
    out.recurrenceMonth = now.getMonth();
    out.dueDate = isoDate(addYears(now, n));
    return out;
  }

  if (/^every\s+year\b/.test(lower)) {
    out.recurrence = 'yearly';
    out.recurrenceInterval = 1;
    out.recurrenceDay = now.getDate();
    out.recurrenceMonth = now.getMonth();
    out.dueDate = isoDate(addYears(now, 1));
    return out;
  }

  if (/^every\s+1st\s+day\b/.test(lower)) {
    out.recurrence = 'monthly';
    out.recurrenceInterval = 1;
    out.recurrenceDay = 1;
    out.dueDate = initialMonthlyDue(1, today);
    return out;
  }

  if (/^every\s+month\b/.test(lower)) {
    const dom = now.getDate();
    out.recurrence = 'monthly';
    out.recurrenceInterval = 1;
    out.recurrenceDay = dom;
    out.dueDate = initialMonthlyDue(dom, today);
    return out;
  }

  if (/^every\s+day\b/.test(lower)) {
    out.recurrence = 'daily';
    out.dueDate = isoDate(now);
    return out;
  }

  if (/^every\s+week\b/.test(lower)) {
    out.recurrence = 'weekly';
    out.recurrenceDay = now.getDay();
    out.dueDate = initialWeeklyDue(out.recurrenceDay, today);
    return out;
  }

  const annualDue = parseAnnualDate(lower, today);
  if (annualDue) {
    const m2 = lower.match(/every\s+([a-z]+)\s+(\d{1,2})/);
    const m1 = lower.match(/every\s+(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)/);
    out.recurrence = 'yearly';
    out.recurrenceInterval = 1;
    if (m2) {
      out.recurrenceMonth = parseMonth(m2[1]);
      out.recurrenceDay = Number(m2[2]);
    } else if (m1) {
      out.recurrenceDay = Number(m1[1]);
      out.recurrenceMonth = parseMonth(m1[2]);
    }
    out.dueDate = annualDue;
    return out;
  }

  const weeklyDay = lower.match(
    /^every\s+(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thur(?:s(?:day)?)?|fri(?:day)?|sat(?:urday)?)\b/
  );
  if (weeklyDay) {
    const recurrenceDay = parseWeekday(weeklyDay[1]) ?? 0;
    out.recurrence = 'weekly';
    out.recurrenceDay = recurrenceDay;
    out.dueDate = initialWeeklyDue(recurrenceDay, today);
    return out;
  }

  if (/^every\b/.test(lower)) {
    out.scheduleNote = `Todoist: ${s}`;
    return out;
  }

  out.scheduleNote = s ? `Todoist: ${s}` : undefined;
  return out;
}

export function applyScheduleToTask(task, schedule) {
  if (!task || !schedule) return false;
  let changed = false;
  const set = (key, val) => {
    if (val === undefined) return;
    if (task[key] !== val) {
      task[key] = val;
      changed = true;
    }
  };

  set('dueDate', schedule.dueDate || '');
  set('recurrence', schedule.recurrence || null);
  set('recurrenceInterval', schedule.recurrenceInterval ?? 1);
  set('recurrenceDay', schedule.recurrenceDay);
  set('recurrenceWeekOfMonth', schedule.recurrenceWeekOfMonth);
  set('recurrenceMonth', schedule.recurrenceMonth);
  set('todoistSchedule', schedule.todoistSchedule);

  if (!schedule.recurrence) {
    if (task.recurrenceInterval === 1) delete task.recurrenceInterval;
    delete task.recurrenceDay;
    delete task.recurrenceWeekOfMonth;
    delete task.recurrenceMonth;
  }
  if (schedule.recurrenceInterval === 1 && task.recurrenceInterval === 1) {
    delete task.recurrenceInterval;
  }

  return changed;
}

function nthWeekdayInMonthFrom(year, month, nth, weekday) {
  return nthWeekdayInMonth(year, month, nth, weekday);
}

/** Advance a task to its next due date after completion (or for backfill). */
export function advanceRecurrenceDueDate(task, fromDate = new Date()) {
  if (!task?.recurrence) return '';
  const interval = task.recurrenceInterval || 1;
  const from = task.dueDate
    ? new Date(task.dueDate + 'T12:00:00')
    : noonToday(fromDate);
  const base = from >= noonToday(fromDate) ? from : noonToday(fromDate);

  if (task.recurrence === 'daily') {
    return isoDate(addDays(base, interval));
  }
  if (task.recurrence === 'weekly') {
    if (task.recurrenceWeekOfMonth != null) {
      return nextNthWeekdayDue(
        task.recurrenceWeekOfMonth,
        task.recurrenceDay ?? 0,
        null,
        addDays(base, 1)
      );
    }
    return isoDate(addDays(base, 7 * interval));
  }
  if (task.recurrence === 'monthly') {
    if (task.recurrenceWeekOfMonth != null) {
      return nextNthWeekdayDue(
        task.recurrenceWeekOfMonth,
        task.recurrenceDay ?? 0,
        null,
        addDays(base, 1)
      );
    }
    return isoDate(addMonths(base, interval));
  }
  if (task.recurrence === 'yearly') {
    if (task.recurrenceWeekOfMonth != null && task.recurrenceMonth != null) {
      return nextNthWeekdayDue(
        task.recurrenceWeekOfMonth,
        task.recurrenceDay ?? 0,
        task.recurrenceMonth,
        addDays(base, 1)
      );
    }
    if (task.recurrenceMonth != null && task.recurrenceDay != null) {
      let d = new Date(base.getFullYear() + interval, task.recurrenceMonth, task.recurrenceDay, 12, 0, 0, 0);
      if (d <= base) d = new Date(base.getFullYear() + interval, task.recurrenceMonth, task.recurrenceDay, 12, 0, 0, 0);
      return isoDate(d);
    }
    return isoDate(addYears(base, interval));
  }
  return '';
}

/** First due date for a Tether recurrence rule. */
export function initialDueForRecurrence(task, today = new Date()) {
  if (!task?.recurrence) return '';
  if (task.dueDate) return task.dueDate;
  if (task.todoistSchedule) {
    const schedule = mapTodoistDate(task.todoistSchedule, today);
    return schedule.dueDate || '';
  }
  if (task.recurrence === 'daily') return isoDate(noonToday(today));
  if (task.recurrence === 'weekly') {
    if (task.recurrenceWeekOfMonth != null) {
      return nextNthWeekdayDue(task.recurrenceWeekOfMonth, task.recurrenceDay ?? 0, null, today);
    }
    return initialWeeklyDue(task.recurrenceDay, today);
  }
  if (task.recurrence === 'monthly') {
    const dom = task.recurrenceDay != null ? task.recurrenceDay : noonToday(today).getDate();
    return initialMonthlyDue(dom, today);
  }
  if (task.recurrence === 'yearly') return advanceRecurrenceDueDate(task, today);
  return '';
}

/** Set dueDate on tasks imported with recurrence but no due date. Returns true if changed. */
export function backfillRecurrenceDueDate(task, today = new Date()) {
  if (task?.todoistSchedule) {
    return applyScheduleToTask(task, mapTodoistDate(task.todoistSchedule, today));
  }
  if (!task?.recurrence || task.dueDate) return false;
  const due = initialDueForRecurrence(task, today);
  if (!due) return false;
  task.dueDate = due;
  return true;
}

export function recurrenceLabelForTask(task) {
  if (!task?.recurrence) return '';
  const iv = task.recurrenceInterval || 1;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (task.recurrence === 'daily') return iv === 1 ? 'Daily' : `Every ${iv} days`;
  if (task.recurrence === 'weekly') {
    if (task.recurrenceWeekOfMonth != null) {
      const ord = task.recurrenceWeekOfMonth === -1 ? 'Last' : `${task.recurrenceWeekOfMonth}${['st', 'nd', 'rd', 'th'][Math.min(task.recurrenceWeekOfMonth - 1, 3)]}`;
      return `${ord} ${days[task.recurrenceDay ?? 0]} monthly`;
    }
    const day = days[task.recurrenceDay ?? 0] || 'Sunday';
    return iv === 1 ? `Weekly · ${day}` : `Every ${iv} weeks · ${day}`;
  }
  if (task.recurrence === 'monthly') {
    if (task.recurrenceWeekOfMonth != null) {
      const ord = task.recurrenceWeekOfMonth === -1 ? 'Last' : `${task.recurrenceWeekOfMonth}${['st', 'nd', 'rd', 'th'][Math.min(task.recurrenceWeekOfMonth - 1, 3)]}`;
      return `${ord} ${days[task.recurrenceDay ?? 0]} monthly`;
    }
    const dom = task.recurrenceDay ?? 1;
    return iv === 1 ? `Monthly · day ${dom}` : `Every ${iv} months · day ${dom}`;
  }
  if (task.recurrence === 'yearly') {
    if (task.recurrenceWeekOfMonth != null && task.recurrenceMonth != null) {
      const ord = task.recurrenceWeekOfMonth === -1 ? 'Last' : `${task.recurrenceWeekOfMonth}${['st', 'nd', 'rd', 'th'][Math.min(task.recurrenceWeekOfMonth - 1, 3)]}`;
      return `Yearly · ${ord} ${days[task.recurrenceDay ?? 0]} in ${months[task.recurrenceMonth]}`;
    }
    if (task.recurrenceMonth != null && task.recurrenceDay != null) {
      return iv === 1
        ? `Yearly · ${months[task.recurrenceMonth]} ${task.recurrenceDay}`
        : `Every ${iv} years · ${months[task.recurrenceMonth]} ${task.recurrenceDay}`;
    }
    return iv === 1 ? 'Yearly' : `Every ${iv} years`;
  }
  return task.recurrence;
}

function extractLabels(title) {
  const labels = [];
  const re = /@([a-zA-Z0-9_-]+)/g;
  let m;
  while ((m = re.exec(String(title || '')))) labels.push(m[1].toLowerCase());
  return [...new Set(labels)];
}

export function stripLabelsFromTitle(title) {
  return String(title || '').replace(/@([a-zA-Z0-9_-]+)/g, '').replace(/\s+/g, ' ').trim();
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

  applyScheduleToTask(task, schedule);
  if (!task.recurrence) {
    delete task.recurrenceInterval;
    delete task.recurrenceDay;
    delete task.recurrenceWeekOfMonth;
    delete task.recurrenceMonth;
    delete task.todoistSchedule;
  }

  return task;
}

export function scheduleFromTaskNotes(task) {
  const notes = String(task?.notes || '');
  const m = notes.match(/Todoist:\s*(.+)$/m);
  return m ? m[1].trim() : null;
}

export function reconcileTaskSchedule(task, todoistDateRaw, today = new Date()) {
  const schedule = mapTodoistDate(todoistDateRaw, today);
  applyScheduleToTask(task, schedule);
  return task;
}
