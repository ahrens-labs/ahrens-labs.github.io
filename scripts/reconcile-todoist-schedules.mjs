#!/usr/bin/env node
/** Re-apply Todoist DATE rules from CSV to existing personal tasks (by title match). */
import { loadTodoistCsv } from './parse-todoist-csv.js';
import { stripLabelsFromTitle } from './todoist-recurrence.js';

const CSV_PATH = process.argv[2] || '/home/matt/Downloads/Inbox.csv';
const IMPORT_URL = process.argv[3] || 'http://127.0.0.1:8787/';
const USER_ID = process.argv[4] || 'user_1716524694';

const rows = loadTodoistCsv(CSV_PATH);
const schedules = rows.map((row) => ({
  title: stripLabelsFromTitle(row.content),
  date: row.date,
}));

console.log(`Reconciling ${schedules.length} Todoist schedules from ${CSV_PATH}`);

const res = await fetch(IMPORT_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'reconcile-todoist-schedules', userId: USER_ID, schedules }),
});

const data = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error('Reconcile failed:', data.error || res.statusText);
  process.exit(1);
}

console.log('Reconcile complete:', data);
