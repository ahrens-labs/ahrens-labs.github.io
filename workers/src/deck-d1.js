/**
 * Deck D1 storage — per-user deck blobs + share records.
 * Dual-write / read-flip / primary cutover from UserAccount + DeckShare DOs.
 */
import {
  getAppDataKey,
  encryptDeckBlob,
  decryptDeckBlob,
  encryptSharePayload,
  decryptSharePayload,
  encryptString,
  decryptString,
} from './app-data-crypto.js';

const D1_MAX_BOUND_PARAMS = 99;

function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function safeJsonParse(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function hasDeckD1(env) {
  return !!(env && env.DECK_DB);
}

export function deckD1WriteEnabled(env) {
  return hasDeckD1(env) && String(env.DECK_D1_WRITE ?? '1') !== '0';
}

export function deckD1ReadEnabled(env) {
  return hasDeckD1(env) && (String(env.DECK_D1_READ || '') === '1' || deckD1PrimaryEnabled(env));
}

export function deckD1PrimaryEnabled(env) {
  return hasDeckD1(env) && String(env.DECK_D1_PRIMARY || '') === '1';
}

export function deckD1CompareEnabled(env) {
  return hasDeckD1(env) && String(env.DECK_D1_COMPARE || '') === '1';
}

function countDeckCards(decks) {
  let cardCount = 0;
  for (const entry of decks || []) {
    cardCount += Array.isArray(entry?.cards) ? entry.cards.length : 0;
    for (const stack of entry?.stacks || []) {
      cardCount += Array.isArray(stack?.cards) ? stack.cards.length : 0;
    }
  }
  return cardCount;
}

export async function d1PutUserDeckData(env, userId, deckData) {
  if (!hasDeckD1(env) || !userId) return;
  const key = getAppDataKey(env);
  const uid = String(userId);
  const decks = Array.isArray(deckData?.decks) ? deckData.decks : [];
  const lastUpdated = Number(deckData?.lastUpdated) || Date.now();
  const clientLastModified = Number(deckData?.clientLastModified) || 0;
  const encrypted = await encryptDeckBlob({ decks, lastUpdated, clientLastModified }, key);
  const decksJson = JSON.stringify({
    decks: encrypted.decks || [],
    clientLastModified: encrypted.clientLastModified || clientLastModified || 0,
  });
  await env.DECK_DB.prepare(
    `INSERT INTO deck_user_data (user_id, decks_json, last_updated, deck_count, card_count, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       decks_json = excluded.decks_json,
       last_updated = excluded.last_updated,
       deck_count = excluded.deck_count,
       card_count = excluded.card_count,
       updated_at = excluded.updated_at`
  )
    .bind(uid, decksJson, lastUpdated, decks.length, countDeckCards(decks), Date.now())
    .run();
}

export async function d1GetUserDeckData(env, userId) {
  if (!hasDeckD1(env) || !userId) return null;
  const key = getAppDataKey(env);
  const row = await env.DECK_DB.prepare(
    `SELECT decks_json, last_updated FROM deck_user_data WHERE user_id = ?`
  )
    .bind(String(userId))
    .first();
  if (!row) return null;
  const parsed = safeJsonParse(row.decks_json, []);
  // Legacy rows stored a bare decks array; newer rows wrap { decks, clientLastModified }.
  const decksRaw = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.decks) ? parsed.decks : []);
  const storedClientMod = Array.isArray(parsed) ? 0 : (Number(parsed?.clientLastModified) || 0);
  const decrypted = await decryptDeckBlob(
    {
      decks: decksRaw,
      lastUpdated: Number(row.last_updated) || null,
      clientLastModified: storedClientMod,
    },
    key
  );
  return {
    decks: Array.isArray(decrypted?.decks) ? decrypted.decks : [],
    lastUpdated: decrypted?.lastUpdated != null ? decrypted.lastUpdated : Number(row.last_updated) || null,
    clientLastModified: Number(decrypted?.clientLastModified) || storedClientMod || 0,
  };
}

export async function d1PutShare(env, record) {
  if (!hasDeckD1(env) || !record?.id) return;
  const db = env.DECK_DB;
  const key = getAppDataKey(env);
  const id = String(record.id);
  const type = String(record.type || 'deck');
  const ownerUserId = String(record.ownerUserId || '');
  const ownerUsername = record.ownerUsername != null ? String(record.ownerUsername) : null;
  const labelEnc = await encryptString(record.label != null ? String(record.label) : '', key);
  const contextEnc =
    record.contextDeckName != null
      ? await encryptString(String(record.contextDeckName), key)
      : null;
  const payloadEnc = await encryptSharePayload(record.payload, key);
  const createdAt = Number(record.createdAt) || Date.now();
  const updatedAt = Number(record.updatedAt) || Date.now();
  const members = Array.isArray(record.members) ? record.members : [];

  const stmts = [
    db
      .prepare(
        `INSERT INTO deck_shares (
           id, type, owner_user_id, owner_username, label, context_deck_name,
           payload_json, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           type = excluded.type,
           owner_user_id = excluded.owner_user_id,
           owner_username = excluded.owner_username,
           label = excluded.label,
           context_deck_name = excluded.context_deck_name,
           payload_json = excluded.payload_json,
           updated_at = excluded.updated_at`
      )
      .bind(
        id,
        type,
        ownerUserId,
        ownerUsername,
        labelEnc || '',
        contextEnc,
        JSON.stringify(payloadEnc ?? null),
        createdAt,
        updatedAt
      ),
    db.prepare(`DELETE FROM deck_share_members WHERE share_id = ?`).bind(id),
  ];

  for (const m of members) {
    if (!m?.userId) continue;
    stmts.push(
      db
        .prepare(
          `INSERT INTO deck_share_members (share_id, user_id, role, username, email, added_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          String(m.userId),
          String(m.role || 'editor'),
          m.username != null ? String(m.username) : null,
          m.email != null ? String(m.email) : null,
          Number(m.addedAt) || updatedAt
        )
    );
  }

  for (const chunk of chunkArray(stmts, 200)) {
    await db.batch(chunk);
  }
}

export async function d1DeleteShare(env, shareId) {
  if (!hasDeckD1(env) || !shareId) return;
  const id = String(shareId);
  await env.DECK_DB.batch([
    env.DECK_DB.prepare(`DELETE FROM deck_share_members WHERE share_id = ?`).bind(id),
    env.DECK_DB.prepare(`DELETE FROM deck_shares WHERE id = ?`).bind(id),
  ]);
}

async function rowToShareRecord(env, row, members) {
  if (!row) return null;
  const key = getAppDataKey(env);
  const payloadRaw = safeJsonParse(row.payload_json, null);
  const payload = await decryptSharePayload(payloadRaw, key);
  const label = await decryptString(row.label || '', key);
  const contextDeckName =
    row.context_deck_name != null ? await decryptString(row.context_deck_name, key) : null;
  return {
    id: row.id,
    type: row.type,
    ownerUserId: row.owner_user_id,
    ownerUsername: row.owner_username || '',
    members: members || [],
    label: label || '',
    contextDeckName,
    payload,
    createdAt: Number(row.created_at) || 0,
    updatedAt: Number(row.updated_at) || 0,
  };
}

export async function d1GetShare(env, shareId) {
  if (!hasDeckD1(env) || !shareId) return null;
  const db = env.DECK_DB;
  const id = String(shareId);
  const row = await db
    .prepare(
      `SELECT id, type, owner_user_id, owner_username, label, context_deck_name,
              payload_json, created_at, updated_at
       FROM deck_shares WHERE id = ?`
    )
    .bind(id)
    .first();
  if (!row) return null;
  const members =
    (
      await db
        .prepare(
          `SELECT user_id, role, username, email, added_at
           FROM deck_share_members WHERE share_id = ?`
        )
        .bind(id)
        .all()
    ).results || [];
  return rowToShareRecord(
    env,
    row,
    members.map((m) => ({
      userId: m.user_id,
      role: m.role || 'editor',
      username: m.username || '',
      email: m.email || '',
      addedAt: Number(m.added_at) || 0,
    }))
  );
}

/** Batch-load shares by id (chunked for D1's 100-variable limit). */
export async function d1GetSharesByIds(env, shareIds) {
  if (!hasDeckD1(env) || !shareIds?.length) return new Map();
  const db = env.DECK_DB;
  const ids = [...new Set([...shareIds].map(String).filter(Boolean))];
  const byId = new Map();
  if (!ids.length) return byId;

  const rows = [];
  for (const chunk of chunkArray(ids, D1_MAX_BOUND_PARAMS)) {
    const placeholders = chunk.map(() => '?').join(',');
    const part =
      (
        await db
          .prepare(
            `SELECT id, type, owner_user_id, owner_username, label, context_deck_name,
                    payload_json, created_at, updated_at
             FROM deck_shares WHERE id IN (${placeholders})`
          )
          .bind(...chunk)
          .all()
      ).results || [];
    rows.push(...part);
  }

  if (!rows.length) return byId;

  const memberRows = [];
  for (const chunk of chunkArray(
    rows.map((r) => r.id),
    D1_MAX_BOUND_PARAMS
  )) {
    const placeholders = chunk.map(() => '?').join(',');
    const part =
      (
        await db
          .prepare(
            `SELECT share_id, user_id, role, username, email, added_at
             FROM deck_share_members WHERE share_id IN (${placeholders})`
          )
          .bind(...chunk)
          .all()
      ).results || [];
    memberRows.push(...part);
  }

  const membersByShare = new Map();
  for (const m of memberRows) {
    if (!membersByShare.has(m.share_id)) membersByShare.set(m.share_id, []);
    membersByShare.get(m.share_id).push({
      userId: m.user_id,
      role: m.role || 'editor',
      username: m.username || '',
      email: m.email || '',
      addedAt: Number(m.added_at) || 0,
    });
  }

  for (const row of rows) {
    byId.set(row.id, await rowToShareRecord(env, row, membersByShare.get(row.id) || []));
  }
  return byId;
}

export function deckBlobFingerprint(deckData) {
  const decks = Array.isArray(deckData?.decks) ? deckData.decks : [];
  return JSON.stringify({
    lastUpdated: deckData?.lastUpdated || 0,
    deckCount: decks.length,
    cardCount: countDeckCards(decks),
    ids: decks.map((d) => d?.id).filter(Boolean).sort(),
  });
}

export async function d1CountDecksForUser(env, userId) {
  if (!hasDeckD1(env) || !userId) return 0;
  const row = await env.DECK_DB.prepare(
    `SELECT deck_count AS c FROM deck_user_data WHERE user_id = ?`
  )
    .bind(String(userId))
    .first();
  return Number(row?.c) || 0;
}

export async function d1CountCardsForUser(env, userId) {
  if (!hasDeckD1(env) || !userId) return 0;
  const row = await env.DECK_DB.prepare(
    `SELECT card_count AS c FROM deck_user_data WHERE user_id = ?`
  )
    .bind(String(userId))
    .first();
  return Number(row?.c) || 0;
}
