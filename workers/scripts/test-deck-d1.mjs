/**
 * Unit tests for deck-d1.js (in-memory D1 mock).
 * Run: node workers/scripts/test-deck-d1.mjs
 */
import { webcrypto } from 'node:crypto';
import assert from 'node:assert/strict';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.btoa) globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
if (!globalThis.atob) globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');

const {
  d1PutUserDeckData,
  d1GetUserDeckData,
  d1PutShare,
  d1GetShare,
  d1GetSharesByIds,
  d1CountDecksForUser,
  deckD1WriteEnabled,
  deckD1PrimaryEnabled,
} = await import('../src/deck-d1.js');

const KEY = 'c'.repeat(64);

function createMemoryDb() {
  const tables = {
    deck_user_data: new Map(),
    deck_shares: new Map(),
    deck_share_members: new Map(),
  };
  class Stmt {
    constructor(sql, binds = []) {
      this.sql = sql;
      this.binds = binds;
    }
    bind(...args) {
      return new Stmt(this.sql, args);
    }
    async first() {
      return (await this.all()).results[0] || null;
    }
    async run() {
      await this.all();
      return { success: true };
    }
    async all() {
      const sql = this.sql.replace(/\s+/g, ' ').trim();
      const b = this.binds;
      if (sql.startsWith('INSERT INTO deck_user_data')) {
        tables.deck_user_data.set(b[0], {
          user_id: b[0],
          decks_json: b[1],
          last_updated: b[2],
          deck_count: b[3],
          card_count: b[4],
          updated_at: b[5],
        });
        return { results: [] };
      }
      if (sql.startsWith('SELECT decks_json, last_updated FROM deck_user_data')) {
        const row = tables.deck_user_data.get(b[0]);
        return { results: row ? [row] : [] };
      }
      if (sql.startsWith('SELECT deck_count AS c FROM deck_user_data')) {
        const row = tables.deck_user_data.get(b[0]);
        return { results: row ? [{ c: row.deck_count }] : [] };
      }
      if (sql.startsWith('INSERT INTO deck_shares')) {
        tables.deck_shares.set(b[0], {
          id: b[0],
          type: b[1],
          owner_user_id: b[2],
          owner_username: b[3],
          label: b[4],
          context_deck_name: b[5],
          payload_json: b[6],
          created_at: b[7],
          updated_at: b[8],
        });
        return { results: [] };
      }
      if (sql.startsWith('DELETE FROM deck_share_members WHERE share_id')) {
        for (const k of [...tables.deck_share_members.keys()]) {
          if (k.startsWith(`${b[0]}|`)) tables.deck_share_members.delete(k);
        }
        return { results: [] };
      }
      if (sql.startsWith('INSERT INTO deck_share_members')) {
        tables.deck_share_members.set(`${b[0]}|${b[1]}`, {
          share_id: b[0],
          user_id: b[1],
          role: b[2],
          username: b[3],
          email: b[4],
          added_at: b[5],
        });
        return { results: [] };
      }
      if (sql.startsWith('SELECT id, type, owner_user_id') && sql.includes('WHERE id = ?')) {
        const row = tables.deck_shares.get(b[0]);
        return { results: row ? [row] : [] };
      }
      if (sql.startsWith('SELECT id, type, owner_user_id') && sql.includes('WHERE id IN')) {
        const ids = new Set(b);
        return { results: [...tables.deck_shares.values()].filter((r) => ids.has(r.id)) };
      }
      if (sql.startsWith('SELECT user_id, role, username, email, added_at FROM deck_share_members')) {
        return {
          results: [...tables.deck_share_members.values()].filter((m) => m.share_id === b[0]),
        };
      }
      if (sql.startsWith('SELECT share_id, user_id, role') && sql.includes('WHERE share_id IN')) {
        const ids = new Set(b);
        return {
          results: [...tables.deck_share_members.values()].filter((m) => ids.has(m.share_id)),
        };
      }
      throw new Error('Unhandled SQL: ' + sql);
    }
  }
  return {
    prepare(sql) {
      return new Stmt(sql);
    },
    async batch(stmts) {
      for (const s of stmts) await s.run();
    },
  };
}

async function testUserBlobRoundTrip() {
  const env = { DECK_DB: createMemoryDb(), APP_DATA_ENCRYPTION_KEY: KEY };
  const deckData = {
    lastUpdated: 100,
    clientLastModified: 90,
    decks: [
      {
        id: 'd1',
        name: 'Notes',
        cards: [{ id: 'c1', title: 'Hello', notes: 'secret', checklist: [{ text: 'one', done: false }] }],
        stacks: [],
      },
    ],
  };
  await d1PutUserDeckData(env, 'user_1', deckData);
  const loaded = await d1GetUserDeckData(env, 'user_1');
  assert.equal(loaded.decks[0].name, 'Notes');
  assert.equal(loaded.decks[0].cards[0].notes, 'secret');
  assert.equal(loaded.decks[0].cards[0].checklist[0].text, 'one');
  assert.equal(loaded.clientLastModified, 90);
  assert.equal(await d1CountDecksForUser(env, 'user_1'), 1);
}

async function testLegacyDecksJsonArray() {
  const db = createMemoryDb();
  const env = { DECK_DB: db, APP_DATA_ENCRYPTION_KEY: KEY };
  const { encryptDeckBlob } = await import('../src/app-data-crypto.js');
  const encrypted = await encryptDeckBlob(
    {
      decks: [{ id: 'd1', name: 'Legacy', cards: [], stacks: [] }],
      lastUpdated: 50,
    },
    KEY
  );
  // Simulate pre-wrapper rows that stored a bare decks array.
  await db.prepare(
    `INSERT INTO deck_user_data (user_id, decks_json, last_updated, deck_count, card_count, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind('user_legacy', JSON.stringify(encrypted.decks || []), 50, 1, 0, 50)
    .run();
  const loaded = await d1GetUserDeckData(env, 'user_legacy');
  assert.equal(loaded.decks[0].name, 'Legacy');
  assert.equal(loaded.clientLastModified, 0);
}

async function testShareBatch() {
  const env = { DECK_DB: createMemoryDb(), APP_DATA_ENCRYPTION_KEY: KEY };
  await d1PutShare(env, {
    id: 'share_a',
    type: 'deck',
    ownerUserId: 'user_1',
    ownerUsername: 'owner',
    label: 'Shared',
    payload: { name: 'Shared', cards: [{ id: 'c1', title: 'Card' }], stacks: [] },
    members: [{ userId: 'user_2', role: 'editor', username: 'mate', email: 'm@x.com', addedAt: 1 }],
    createdAt: 1,
    updatedAt: 2,
  });
  const one = await d1GetShare(env, 'share_a');
  assert.equal(one.label, 'Shared');
  assert.equal(one.payload.cards[0].title, 'Card');
  assert.equal(one.members[0].userId, 'user_2');
  const map = await d1GetSharesByIds(env, ['share_a', 'missing']);
  assert.equal(map.size, 1);
  assert.ok(map.has('share_a'));
}

function sharedCardEnv() {
  return { DECK_DB: createMemoryDb(), APP_DATA_ENCRYPTION_KEY: KEY, DECK_D1_PRIMARY: '1' };
}

async function seedSharedCard(env, { ownerChecklistDone = false, ownerUpdatedAt = 100 } = {}) {
  const ownerCard = {
    id: 'c1',
    title: 'Groceries',
    createdAt: 10,
    updatedAt: ownerUpdatedAt,
    checklist: [{ id: 'i1', text: 'milk', done: ownerChecklistDone, doneAt: null }],
    sharedId: 'share_c',
    sharedOut: true,
  };
  await d1PutUserDeckData(env, 'owner', {
    decks: [{ id: 'd1', name: 'Home', createdAt: 1, updatedAt: 1, cards: [ownerCard], stacks: [] }],
    lastUpdated: 200,
  });
  await d1PutShare(env, {
    id: 'share_c',
    type: 'card',
    ownerUserId: 'owner',
    ownerUsername: 'owner',
    label: 'Groceries',
    // Initial share payloads are snapshotted before the owner card gains its sharedId.
    payload: {
      id: 'c1',
      title: 'Groceries',
      createdAt: 10,
      updatedAt: 100,
      checklist: [{ id: 'i1', text: 'milk', done: false, doneAt: null }],
    },
    members: [{ userId: 'mate', role: 'editor', username: 'mate', email: 'm@x.com', addedAt: 1 }],
    createdAt: 50,
    updatedAt: 150,
  });
  const refDeck = {
    id: 'ref1',
    name: 'Groceries',
    createdAt: 60,
    updatedAt: 60,
    cards: [],
    stacks: [],
    sharedRef: { sharedId: 'share_c', type: 'card', ownerUserId: 'owner', ownerUsername: 'owner', role: 'editor' },
  };
  await d1PutUserDeckData(env, 'mate', { decks: [refDeck], lastUpdated: 300 });
}

async function testSharedCardChecklistReachesOwner() {
  const { processDeckSyncPayload, hydrateDeckDataForUser, getDeckDataForUser } = await import('../src/deck.js');
  const env = sharedCardEnv();
  await seedSharedCard(env);

  const mateLoaded = await hydrateDeckDataForUser(env, 'mate', await getDeckDataForUser(env, 'mate'));
  const mateDecks = JSON.parse(JSON.stringify(mateLoaded.decks));
  const mateCard = mateDecks[0].cards[0];
  assert.equal(mateCard.id, 'c1');
  mateCard.checklist[0].done = true;
  mateCard.checklist[0].doneAt = 500;
  mateCard.updatedAt = 500;
  await processDeckSyncPayload(env, 'mate', { decks: mateDecks, baseLastUpdated: 300 }, 'mate-client');

  const share = await d1GetShare(env, 'share_c');
  assert.equal(share.payload.checklist[0].done, true, 'collaborator edit must reach the share record');

  const ownerLoaded = await hydrateDeckDataForUser(env, 'owner', await getDeckDataForUser(env, 'owner'));
  const ownerCard = ownerLoaded.decks[0].cards[0];
  assert.equal(ownerCard.checklist[0].done, true, 'owner must see collaborator checklist edit');
  assert.equal(ownerCard.sharedId, 'share_c');
}

async function testOwnerNewerEditNotRolledBackByShare() {
  const { hydrateDeckDataForUser, getDeckDataForUser } = await import('../src/deck.js');
  const env = sharedCardEnv();
  await seedSharedCard(env, { ownerChecklistDone: true, ownerUpdatedAt: 900 });
  const ownerLoaded = await hydrateDeckDataForUser(env, 'owner', await getDeckDataForUser(env, 'owner'));
  assert.equal(ownerLoaded.decks[0].cards[0].checklist[0].done, true);
}

async function testSharedDeckCardEditReachesOwner() {
  const { processDeckSyncPayload, hydrateDeckDataForUser, getDeckDataForUser } = await import('../src/deck.js');
  const env = sharedCardEnv();
  const card = { id: 'c1', title: 'Task', createdAt: 10, updatedAt: 100, checklist: [{ id: 'i1', text: 'a', done: false }] };
  const other = { id: 'c2', title: 'Other', createdAt: 10, updatedAt: 100, checklist: [] };
  await d1PutUserDeckData(env, 'owner', {
    decks: [{ id: 'd1', name: 'Team', createdAt: 1, updatedAt: 1, sharedId: 'share_d', sharedOut: true, cards: [card, other], stacks: [] }],
    lastUpdated: 200,
  });
  await d1PutShare(env, {
    id: 'share_d',
    type: 'deck',
    ownerUserId: 'owner',
    ownerUsername: 'owner',
    label: 'Team',
    payload: { name: 'Team', cards: [card, other], stacks: [], createdAt: 1 },
    members: [{ userId: 'mate', role: 'editor', username: 'mate', email: 'm@x.com', addedAt: 1 }],
    createdAt: 50,
    updatedAt: 150,
  });
  await d1PutUserDeckData(env, 'mate', {
    decks: [{
      id: 'ref1', name: 'Team', createdAt: 60, updatedAt: 60, cards: [], stacks: [],
      sharedRef: { sharedId: 'share_d', type: 'deck', ownerUserId: 'owner', ownerUsername: 'owner', role: 'editor' },
    }],
    lastUpdated: 300,
  });

  const mateLoaded = await hydrateDeckDataForUser(env, 'mate', await getDeckDataForUser(env, 'mate'));
  const mateDecks = JSON.parse(JSON.stringify(mateLoaded.decks));
  mateDecks[0].cards[0].checklist[0].done = true;
  mateDecks[0].cards[0].updatedAt = 500;
  await processDeckSyncPayload(env, 'mate', { decks: mateDecks, baseLastUpdated: 300 }, 'mate-client');

  const ownerLoaded = await hydrateDeckDataForUser(env, 'owner', await getDeckDataForUser(env, 'owner'));
  const ownerDeck = ownerLoaded.decks[0];
  assert.equal(ownerDeck.cards.length, 2);
  assert.equal(ownerDeck.cards.find((c) => c.id === 'c1').checklist[0].done, true);
  assert.equal(ownerDeck.sharedId, 'share_d');
}

async function testFlags() {
  assert.equal(deckD1WriteEnabled({ DECK_DB: {} }), true);
  assert.equal(deckD1PrimaryEnabled({ DECK_DB: {}, DECK_D1_PRIMARY: '1' }), true);
}

await testUserBlobRoundTrip();
await testLegacyDecksJsonArray();
await testShareBatch();
await testSharedCardChecklistReachesOwner();
await testOwnerNewerEditNotRolledBackByShare();
await testSharedDeckCardEditReachesOwner();
await testFlags();
console.log('deck-d1 tests passed');
