#!/usr/bin/env node
import { loadTodoistCsv } from './parse-todoist-csv.js';
import { buildTetherTask } from './todoist-recurrence.js';

const CSV_PATH = process.argv[2] || '/home/matt/Downloads/Inbox.csv';
const IMPORT_URL = process.argv[3] || 'http://127.0.0.1:8787/';
const USER_ID = 'user_1716524694'; // matthewahrens@gmail.com
const PROJECT_TITLE = 'Inbox';

const rows = loadTodoistCsv(CSV_PATH);
const today = new Date();
const tasks = rows
  .map((row, i) => buildTetherTask(row, USER_ID, i, today))
  .filter(Boolean);

console.log(`Parsed ${tasks.length} tasks from ${CSV_PATH}`);

const res = await fetch(IMPORT_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: USER_ID, projectTitle: PROJECT_TITLE, tasks }),
});

const data = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error('Import failed:', data.error || res.statusText);
  process.exit(1);
}

console.log('Import complete:', data);
