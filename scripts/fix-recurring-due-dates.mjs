#!/usr/bin/env node
/** Backfill due dates on personal tasks that have recurrence but no dueDate. */
const IMPORT_URL = process.argv[2] || 'http://127.0.0.1:8787/';
const USER_ID = process.argv[3] || 'user_1716524694';

const res = await fetch(IMPORT_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'fix-recurrence-due-dates', userId: USER_ID }),
});

const data = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error('Fix failed:', data.error || res.statusText);
  process.exit(1);
}

console.log('Fix complete:', data);
