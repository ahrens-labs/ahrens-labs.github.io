/**
 * Link CRM field encryption tests.
 * Run: node --experimental-strip-types workers/link-crm/scripts/test-crypto.mjs
 */
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const {
  encryptContact,
  decryptContact,
  encryptInteraction,
  decryptInteraction,
  encryptReminder,
  decryptReminder,
} = await import('../src/crypto.ts');

const KEY = 'b'.repeat(64);

const contact = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '555',
  title: 'Analyst',
  company: 'Analytical Engines',
  notes: 'First programmer',
};
const encC = await encryptContact(contact, KEY);
assert.notEqual(encC.name, contact.name);
assert.notEqual(encC.company, contact.company);
assert.notEqual(encC.notes, contact.notes);
const decC = await decryptContact(encC, KEY);
assert.equal(decC.name, contact.name);
assert.equal(decC.company, contact.company);
assert.equal(decC.notes, contact.notes);
assert.equal(decC.title, contact.title);

// Legacy plaintext still decrypts as-is
const legacy = await decryptContact({ name: 'Plain Name', company: 'Plain Co' }, KEY);
assert.equal(legacy.name, 'Plain Name');
assert.equal(legacy.company, 'Plain Co');

const encI = await encryptInteraction({ title: 'Call', notes: 'Discussed Q3', location: 'Cafe' }, KEY);
const decI = await decryptInteraction(encI, KEY);
assert.equal(decI.notes, 'Discussed Q3');
assert.equal(decI.location, 'Cafe');

const encR = await encryptReminder({ title: 'Follow up', description: 'Send deck' }, KEY);
const decR = await decryptReminder(encR, KEY);
assert.equal(decR.title, 'Follow up');
assert.equal(decR.description, 'Send deck');

console.log('Link crypto tests passed');
