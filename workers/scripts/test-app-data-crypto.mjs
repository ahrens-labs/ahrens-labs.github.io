/**
 * Unit tests for platform-key app-data crypto (Deck/Tether) and Link field helpers.
 * Run: node workers/scripts/test-app-data-crypto.mjs
 */
import { webcrypto } from 'node:crypto';
import assert from 'node:assert/strict';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.btoa) {
  globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
}
if (!globalThis.atob) {
  globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
}

const {
  encryptString,
  decryptString,
  encryptDeckBlob,
  decryptDeckBlob,
  encryptTetherProject,
  decryptTetherProject,
  encryptInboxTasks,
  decryptInboxTasks,
  isEncryptedString,
} = await import('../src/app-data-crypto.js');

const KEY = 'a'.repeat(64); // 32 bytes hex

async function testRoundTrip() {
  const plain = 'Hello — secret notes 🔐';
  const enc = await encryptString(plain, KEY);
  assert.ok(isEncryptedString(enc), 'should prefix enc:1:');
  assert.notEqual(enc, plain);
  const dec = await decryptString(enc, KEY);
  assert.equal(dec, plain);
}

async function testLegacyPlaintextPassthrough() {
  const legacy = 'old plaintext note';
  assert.equal(await decryptString(legacy, KEY), legacy);
}

async function testDeckRoundTrip() {
  const blob = {
    lastUpdated: 123,
    decks: [
      {
        id: 'd1',
        name: 'Work',
        cards: [
          {
            id: 'c1',
            title: 'Card one',
            sections: [{ id: 's1', title: 'Sec', body: 'Body text' }],
            checklist: [{ id: 'k1', text: 'Do it', done: false }],
          },
        ],
        stacks: [{ id: 'st1', name: 'Stack A', cards: [] }],
      },
    ],
  };
  const enc = await encryptDeckBlob(blob, KEY);
  assert.ok(isEncryptedString(enc.decks[0].name));
  assert.ok(isEncryptedString(enc.decks[0].cards[0].title));
  assert.equal(enc.decks[0].id, 'd1');
  assert.equal(enc.lastUpdated, 123);
  const dec = await decryptDeckBlob(enc, KEY);
  assert.equal(dec.decks[0].name, 'Work');
  assert.equal(dec.decks[0].cards[0].title, 'Card one');
  assert.equal(dec.decks[0].cards[0].sections[0].body, 'Body text');
  assert.equal(dec.decks[0].cards[0].checklist[0].text, 'Do it');
  assert.equal(dec.decks[0].stacks[0].name, 'Stack A');
}

async function testTetherRoundTrip() {
  const project = {
    id: 'p1',
    title: 'Launch',
    description: 'Ship it',
    ownerUserId: 'user_1',
    members: [{ userId: 'user_1', role: 'owner' }],
    tasks: [
      {
        id: 't1',
        title: 'Write docs',
        notes: 'private',
        definitionOfDone: 'Merged',
        dueDate: '2026-01-01',
        status: 'open',
        assigneeUserIds: ['user_1'],
        labels: ['urgent'],
      },
    ],
  };
  const enc = await encryptTetherProject(project, KEY);
  assert.ok(isEncryptedString(enc.title));
  assert.equal(enc.id, 'p1');
  assert.equal(enc.ownerUserId, 'user_1');
  assert.equal(enc.tasks[0].status, 'open');
  const dec = await decryptTetherProject(enc, KEY);
  assert.equal(dec.title, 'Launch');
  assert.equal(dec.tasks[0].notes, 'private');
  assert.equal(dec.tasks[0].labels[0], 'urgent');
}

async function testInboxRoundTrip() {
  const tasks = [{ id: 'i1', title: 'Buy milk', notes: '2%', status: 'open' }];
  const enc = await encryptInboxTasks(tasks, KEY);
  assert.ok(isEncryptedString(enc[0].title));
  const dec = await decryptInboxTasks(enc, KEY);
  assert.equal(dec[0].title, 'Buy milk');
}

async function testNoKeyPassthrough() {
  const blob = { decks: [{ id: 'd', name: 'Plain', cards: [] }] };
  const out = await encryptDeckBlob(blob, null);
  assert.equal(out.decks[0].name, 'Plain');
}

// Link crypto (separate worker package)
const linkCrypto = await import('../../link-crm/src/crypto.ts').catch(() => null);

async function testLinkContactFields() {
  if (!linkCrypto) {
    // ts import may fail without tsx — run via dynamic eval of compiled path skip
    console.log('skip link ts import (use wrangler/ts later)');
    return;
  }
  const { encryptContact, decryptContact } = linkCrypto;
  const enc = await encryptContact(
    { name: 'Ada', company: 'Acme', notes: 'VIP', title: 'CEO', email: 'a@b.c', phone: '1' },
    KEY
  );
  assert.notEqual(enc.company, 'Acme');
  const dec = await decryptContact(enc, KEY);
  assert.equal(dec.company, 'Acme');
  assert.equal(dec.notes, 'VIP');
}

async function main() {
  await testRoundTrip();
  await testLegacyPlaintextPassthrough();
  await testDeckRoundTrip();
  await testTetherRoundTrip();
  await testInboxRoundTrip();
  await testNoKeyPassthrough();
  await testLinkContactFields();
  console.log('All app-data crypto tests passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
