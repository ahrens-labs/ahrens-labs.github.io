#!/usr/bin/env node
/** Move all tasks from a Tether project into personal inbox and delete the project. */
const IMPORT_URL = process.argv[2] || 'http://127.0.0.1:8787/';
const USER_ID = process.argv[3] || 'user_1716524694';
const PROJECT_ID = process.argv[4] || '5f4407bf-9ebd-4d67-9ce2-62cbcd40bae8';

const res = await fetch(IMPORT_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'unpack-project', userId: USER_ID, projectId: PROJECT_ID }),
});

const data = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error('Unpack failed:', data.error || res.statusText);
  process.exit(1);
}

console.log('Unpack complete:', data);
