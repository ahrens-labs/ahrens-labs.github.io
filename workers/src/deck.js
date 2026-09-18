// Deck — live shared decks, stacks, and cards (Durable Object + API handlers)

import {
  getAppDataKey,
  encryptSharePayload,
  decryptSharePayload,
  encryptString,
  decryptString,
} from './app-data-crypto.js';
import {
  deckD1WriteEnabled,
  deckD1ReadEnabled,
  deckD1PrimaryEnabled,
  deckD1CompareEnabled,
  hasDeckD1,
  d1PutUserDeckData,
  d1GetUserDeckData,
  d1PutShare,
  d1DeleteShare,
  d1GetShare,
  d1GetSharesByIds,
  deckBlobFingerprint,
} from './deck-d1.js';

function hasDeckD1Storage(env) {
  return hasDeckD1(env);
}
function normalizeEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  return e.includes('@') ? e : '';
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function generateUserId(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `user_${Math.abs(hash)}`;
}

function jsonResponse(body, corsHeaders, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function newDeckEntityId() {
  return 'd' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

function newSharedId() {
  return 'share_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

function deckShareStub(env, sharedId) {
  if (!env.DECK_SHARE || !sharedId) return null;
  return env.DECK_SHARE.get(env.DECK_SHARE.idFromName(String(sharedId)));
}

async function fetchUserProfile(env, userId) {
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const account = env.USER_ACCOUNT.get(userAccountId);
  try {
    const res = await account.fetch(new Request('http://do/getData', { method: 'GET' }));
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || (!data.username && !data.email)) return null;
    return {
      userId,
      username: String(data.username || data.email || userId),
      email: normalizeEmail(data.email || ''),
    };
  } catch {
    return null;
  }
}

async function resolveShareTarget(env, usernameOrEmail) {
  const raw = String(usernameOrEmail || '').trim();
  if (!raw) return { error: 'Enter a username or email', status: 400 };

  let userId = '';
  if (raw.includes('@')) {
    const email = normalizeEmail(raw);
    if (!email) return { error: 'Invalid email', status: 400 };
    userId = generateUserId(email);
  } else {
    const username = normalizeUsername(raw);
    if (!username) return { error: 'Invalid username', status: 400 };
    const registry = env.USERNAME_REGISTRY.get(env.USERNAME_REGISTRY.idFromName('global'));
    const res = await registry.fetch(
      new Request('http://do/resolve', {
        method: 'POST',
        body: JSON.stringify({ username }),
      })
    );
    const data = await res.json();
    if (!data.success || !data.userId) {
      return { error: 'User not found', status: 404 };
    }
    userId = data.userId;
  }

  const profile = await fetchUserProfile(env, userId);
  if (!profile) return { error: 'User not found', status: 404 };
  return { profile };
}

export async function resolveDeckUserId(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const sessionId = match ? match[1].trim() : '';
  if (!sessionId) return null;
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  const userRes = await session.fetch(new Request('http://do/getUserId', { method: 'GET' }));
  const userResult = await userRes.json();
  return userResult.userId || null;
}

async function getDeckDataFromDo(env, userId) {
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  const getReq = new Request('http://do/getDeckData', { method: 'GET' });
  const dataRes = await userAccount.fetch(getReq);
  if (!dataRes.ok) return { decks: [], lastUpdated: null };
  return dataRes.json();
}

async function getDeckDataForUser(env, userId) {
  if (deckD1ReadEnabled(env)) {
    const fromD1 = await d1GetUserDeckData(env, userId);
    if (fromD1) {
      if (deckD1CompareEnabled(env)) {
        getDeckDataFromDo(env, userId)
          .then((fromDo) => {
            const a = deckBlobFingerprint(fromDo);
            const b = deckBlobFingerprint(fromD1);
            if (a !== b) console.warn('[deck-d1] user blob compare mismatch', userId);
          })
          .catch(() => {});
      }
      return fromD1;
    }
    const fromDo = await getDeckDataFromDo(env, userId);
    if (deckD1WriteEnabled(env) && Array.isArray(fromDo?.decks) && fromDo.decks.length) {
      d1PutUserDeckData(env, userId, fromDo).catch((err) => {
        console.warn('[deck-d1] heal user blob failed', userId, err?.message || err);
      });
    }
    return fromDo;
  }
  return getDeckDataFromDo(env, userId);
}

export { getDeckDataForUser };

async function saveDeckDataForUser(env, userId, deckData) {
  const payload = {
    ...deckData,
    decks: Array.isArray(deckData?.decks) ? deckData.decks : [],
    lastUpdated: Number(deckData?.lastUpdated) || Date.now(),
  };
  if (!deckD1PrimaryEnabled(env)) {
    const userAccountId = env.USER_ACCOUNT.idFromName(userId);
    const userAccount = env.USER_ACCOUNT.get(userAccountId);
    const updateReq = new Request('http://do/updateDeckData', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await userAccount.fetch(updateReq);
  }
  if (deckD1WriteEnabled(env) || deckD1PrimaryEnabled(env)) {
    try {
      await d1PutUserDeckData(env, userId, payload);
    } catch (err) {
      if (deckD1PrimaryEnabled(env)) throw err;
      console.warn('[deck-d1] put user blob failed', userId, err?.message || err);
    }
  }
}

async function fetchDeckShareFromDo(env, sharedId) {
  const stub = deckShareStub(env, sharedId);
  if (!stub) return null;
  try {
    const res = await stub.fetch(new Request('http://do/get', { method: 'GET' }));
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchDeckShare(env, sharedId) {
  if (deckD1ReadEnabled(env)) {
    const fromD1 = await d1GetShare(env, sharedId);
    if (fromD1) {
      if (deckD1CompareEnabled(env)) {
        fetchDeckShareFromDo(env, sharedId)
          .then((fromDo) => {
            if ((fromDo?.updatedAt || 0) !== (fromD1?.updatedAt || 0)) {
              console.warn('[deck-d1] share compare mismatch', sharedId);
            }
          })
          .catch(() => {});
      }
      return fromD1;
    }
    const fromDo = await fetchDeckShareFromDo(env, sharedId);
    if (fromDo && deckD1WriteEnabled(env)) {
      d1PutShare(env, fromDo).catch((err) => {
        console.warn('[deck-d1] heal share failed', sharedId, err?.message || err);
      });
    }
    return fromDo;
  }
  return fetchDeckShareFromDo(env, sharedId);
}

async function saveDeckShare(env, record) {
  if (!deckD1PrimaryEnabled(env)) {
    const stub = deckShareStub(env, record.id);
    if (!stub) throw new Error('Shared deck storage unavailable');
    const res = await stub.fetch(
      new Request('http://do/save', {
        method: 'POST',
        body: JSON.stringify(record),
      })
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to save shared deck');
    }
  }
  if (deckD1WriteEnabled(env) || deckD1PrimaryEnabled(env)) {
    try {
      await d1PutShare(env, record);
    } catch (err) {
      if (deckD1PrimaryEnabled(env)) throw err;
      console.warn('[deck-d1] put share failed', record?.id, err?.message || err);
    }
  }
}

async function notifyDeckSync(env, userId, payload) {
  if (!env.DECK_SYNC || !userId) return;
  try {
    const stub = env.DECK_SYNC.get(env.DECK_SYNC.idFromName(String(userId)));
    await stub.fetch(
      new Request('http://do/notify', {
        method: 'POST',
        body: JSON.stringify(payload || { type: 'deck', ts: Date.now() }),
      })
    );
  } catch {
    /* best-effort */
  }
}

function shareMemberUserIds(record) {
  const ids = new Set();
  if (record?.ownerUserId) ids.add(record.ownerUserId);
  for (const member of record?.members || []) {
    if (member?.userId) ids.add(member.userId);
  }
  return ids;
}

function userCanAccessShare(record, userId) {
  if (!record || !userId) return false;
  if (record.ownerUserId === userId) return true;
  return (record.members || []).some((m) => m && m.userId === userId);
}

function userCanEditShare(record, userId) {
  if (!record || !userId) return false;
  if (record.ownerUserId === userId) return true;
  return (record.members || []).some(
    (m) => m && m.userId === userId && (m.role || 'editor') === 'editor'
  );
}

async function publishDeckShareSync(env, record, sourceClientId, extraUserIds = []) {
  const ids = shareMemberUserIds(record);
  for (const uid of extraUserIds) {
    if (uid) ids.add(uid);
  }
  const payload = {
    type: 'deck',
    shared: true,
    sharedId: record?.id || null,
    updatedAt: record?.updatedAt || Date.now(),
    ts: Date.now(),
    sourceClientId: sourceClientId || null,
  };
  await Promise.all([...ids].filter(Boolean).map((uid) => notifyDeckSync(env, uid, payload)));
}

function findDeck(decks, deckId) {
  return (decks || []).find((d) => d && d.id === deckId) || null;
}

function findStack(deck, stackId) {
  return (deck.stacks || []).find((s) => s && s.id === stackId) || null;
}

function findCardInDeckTree(deck, cardId, stackId) {
  if (stackId) {
    const stack = findStack(deck, stackId);
    if (!stack) return null;
    const card = (stack.cards || []).find((c) => c && c.id === cardId);
    return card ? { stack, card } : null;
  }
  const card = (deck.cards || []).find((c) => c && c.id === cardId);
  return card ? { stack: null, card } : null;
}

function stackToShareDeckEntry(stack) {
  if (!stack) return null;
  return {
    name: stack.name || 'Untitled stack',
    cards: Array.isArray(stack.cards) ? JSON.parse(JSON.stringify(stack.cards)) : [],
    stacks: [],
    createdAt: stack.createdAt || Date.now(),
  };
}

function extractSharePayload(deckEntry, type) {
  if (type === 'deck') {
    return {
      name: deckEntry.name || 'Untitled',
      cards: Array.isArray(deckEntry.cards) ? deckEntry.cards : [],
      stacks: Array.isArray(deckEntry.stacks) ? deckEntry.stacks : [],
      createdAt: deckEntry.createdAt || Date.now(),
    };
  }
  if (type === 'stack') {
    const stack = (deckEntry.stacks || [])[0];
    return stack ? JSON.parse(JSON.stringify(stack)) : null;
  }
  if (type === 'card') {
    const card = (deckEntry.cards || [])[0];
    return card ? JSON.parse(JSON.stringify(card)) : null;
  }
  return null;
}

function shareMembersForClient(members) {
  return (Array.isArray(members) ? members : [])
    .map((member) => ({
      userId: member?.userId || '',
      username: member?.username || '',
      email: member?.email || '',
    }))
    .filter((member) => member.userId || member.username || member.email);
}

function preserveShareMeta(target, source) {
  if (!source) return target;
  if (!target.sharedId && source.sharedId) target.sharedId = source.sharedId;
  if (source.sharedId || source.sharedOut) target.sharedOut = true;
  if (!target.sharedRef && source.sharedRef) {
    target.sharedRef = JSON.parse(JSON.stringify(source.sharedRef));
  }
  if (Array.isArray(source.sharedMembers) && source.sharedMembers.length) {
    target.sharedMembers = JSON.parse(JSON.stringify(source.sharedMembers));
  }
  return target;
}

function mergeDeckShareMetadata(incoming, existing) {
  if (!incoming) return incoming;
  if (!existing) return incoming;
  const merged = preserveShareMeta({ ...incoming }, existing);
  const prevStacks = new Map((existing.stacks || []).filter(Boolean).map((s) => [s.id, s]));
  const prevCards = new Map((existing.cards || []).filter(Boolean).map((c) => [c.id, c]));
  merged.stacks = (Array.isArray(incoming.stacks) ? incoming.stacks : []).map((stack) => {
    const prev = prevStacks.get(stack.id);
    const mergedStack = prev ? preserveShareMeta({ ...stack }, prev) : { ...stack };
    if (prev && Array.isArray(mergedStack.cards)) {
      const prevStackCards = new Map((prev.cards || []).filter(Boolean).map((c) => [c.id, c]));
      mergedStack.cards = mergedStack.cards.map((card) => {
        const prevCard = prevStackCards.get(card.id);
        return prevCard ? preserveShareMeta({ ...card }, prevCard) : card;
      });
    }
    return mergedStack;
  });
  merged.cards = (Array.isArray(incoming.cards) ? incoming.cards : []).map((card) => {
    const prev = prevCards.get(card.id);
    return prev ? preserveShareMeta({ ...card }, prev) : card;
  });
  return merged;
}

function mergeDecksShareMetadata(incomingDecks, existingDecks) {
  const existingById = new Map((existingDecks || []).filter(Boolean).map((d) => [d.id, d]));
  return (Array.isArray(incomingDecks) ? incomingDecks : []).map((deck) => {
    const existing = existingById.get(deck.id);
    return existing ? mergeDeckShareMetadata(deck, existing) : deck;
  });
}

function deckShareId(deck) {
  if (!deck) return null;
  return deck.sharedId || deck.sharedRef?.sharedId || null;
}

function userOwnsShareRecord(record, userId) {
  return !!(record && userId && record.ownerUserId === userId);
}

function shouldHydrateEntryFromShareRecord(entry, record, userId) {
  if (!record || !userId) return false;
  if (entry?.sharedRef?.sharedId === record.id) return true;
  if (userOwnsShareRecord(record, userId)) return false;
  return userCanAccessShare(record, userId);
}

function applySharePayloadToDeckEntry(entry, record) {
  if (!record || !record.payload) return entry;
  const type = record.type;
  const payload = record.payload;
  const next = preserveShareMeta({
    ...entry,
    updatedAt: record.updatedAt || Date.now(),
  }, entry);

  if (type === 'deck') {
    next.name = payload.name || record.label || entry.name;
    next.cards = Array.isArray(payload.cards) ? payload.cards : [];
    next.stacks = Array.isArray(payload.stacks) ? payload.stacks : [];
    return next;
  }

  if (type === 'stack' && payload) {
    next.name = payload.name || record.label || entry.name;
    next.cards = Array.isArray(payload.cards) ? payload.cards : [];
    next.stacks = [];
    return next;
  }

  if (type === 'card' && payload) {
    next.name = record.label || entry.name;
    next.cards = [payload];
    next.stacks = [];
    return next;
  }

  return entry;
}

function collectSharedIdsFromDecks(decks) {
  const ids = new Set();
  for (const deck of decks || []) {
    if (deck?.sharedId) ids.add(deck.sharedId);
    if (deck?.sharedRef?.sharedId) ids.add(deck.sharedRef.sharedId);
    for (const stack of deck?.stacks || []) {
      if (stack?.sharedId) ids.add(stack.sharedId);
      for (const card of stack?.cards || []) {
        if (card?.sharedId) ids.add(card.sharedId);
      }
    }
    for (const card of deck?.cards || []) {
      if (card?.sharedId) ids.add(card.sharedId);
    }
  }
  return ids;
}

function mergeStackFromShareRecord(stack, record) {
  const payload = record?.payload;
  if (!payload || typeof payload !== 'object') return stack;
  if (record.type === 'deck') {
    return preserveShareMeta({
      ...stack,
      name: payload.name || stack.name,
      cards: Array.isArray(payload.cards) ? payload.cards : (stack.cards || []),
    }, stack);
  }
  return preserveShareMeta({ ...payload }, stack);
}

function applyNestedSharePayload(deck, shareCache, userId) {
  let next = deck;
  const stacks = (deck.stacks || []).map((stack) => {
    if (stack.sharedId && shareCache.has(stack.sharedId)) {
      const record = shareCache.get(stack.sharedId);
      if (shouldHydrateEntryFromShareRecord(stack, record, userId)) {
        return mergeStackFromShareRecord(stack, record);
      }
    }
    const cards = (stack.cards || []).map((card) => {
      if (card.sharedId && shareCache.has(card.sharedId)) {
        const record = shareCache.get(card.sharedId);
        if (!shouldHydrateEntryFromShareRecord(card, record, userId)) return card;
        const payload = record?.payload;
        const merged = payload && typeof payload === 'object' ? { ...payload } : { ...card };
        return preserveShareMeta(merged, card);
      }
      return card;
    });
    return cards === stack.cards ? stack : { ...stack, cards };
  });
  if (stacks !== deck.stacks) next = { ...next, stacks };
  const cards = (deck.cards || []).map((card) => {
    if (card.sharedId && shareCache.has(card.sharedId)) {
      const record = shareCache.get(card.sharedId);
      if (!shouldHydrateEntryFromShareRecord(card, record, userId)) return card;
      const payload = record?.payload;
      const merged = payload && typeof payload === 'object' ? { ...payload } : { ...card };
      return preserveShareMeta(merged, card);
    }
    return card;
  });
  if (cards !== deck.cards) next = { ...next, cards };
  return next;
}

export async function hydrateDeckDataForUser(env, userId, deckData) {
  const decks = Array.isArray(deckData?.decks) ? deckData.decks.map((d) => ({ ...d })) : [];
  const sharedIds = collectSharedIdsFromDecks(decks);
  if (!sharedIds.size) {
    return { ...deckData, decks };
  }

  const shareCache = new Map();
  if (deckD1ReadEnabled(env)) {
    const fromD1 = await d1GetSharesByIds(env, [...sharedIds]);
    for (const [id, record] of fromD1) {
      if (record && userCanAccessShare(record, userId)) shareCache.set(id, record);
    }
    // Heal any misses from Durable Objects during cutover.
    const missing = [...sharedIds].filter((id) => !shareCache.has(id));
    if (missing.length && !deckD1PrimaryEnabled(env)) {
      await Promise.all(
        missing.map(async (sharedId) => {
          const record = await fetchDeckShareFromDo(env, sharedId);
          if (record && userCanAccessShare(record, userId)) {
            shareCache.set(sharedId, record);
            if (deckD1WriteEnabled(env)) {
              d1PutShare(env, record).catch(() => {});
            }
          }
        })
      );
    }
  } else if (env.DECK_SHARE) {
    await Promise.all(
      [...sharedIds].map(async (sharedId) => {
        const record = await fetchDeckShare(env, sharedId);
        if (record && userCanAccessShare(record, userId)) {
          shareCache.set(sharedId, record);
        }
      })
    );
  }

  if (!shareCache.size) {
    return { ...deckData, decks };
  }

  const hydrated = decks.map((deck) => {
    const shareId = deckShareId(deck);
    if (shareId && shareCache.has(shareId)) {
      const record = shareCache.get(shareId);
      if (shouldHydrateEntryFromShareRecord(deck, record, userId)) {
        return applyNestedSharePayload(
          applySharePayloadToDeckEntry(deck, record),
          shareCache,
          userId
        );
      }
    }
    return applyNestedSharePayload(deck, shareCache, userId);
  });

  return {
    ...deckData,
    decks: attachOwnerShareMembersTree(hydrated, shareCache, userId),
  };
}

export async function buildDeckSyncFingerprintForUser(env, userId) {
  const deckData = await getDeckDataForUser(env, userId);
  const decks = Array.isArray(deckData?.decks) ? deckData.decks : [];
  let cardCount = 0;
  decks.forEach((entry) => {
    cardCount += Array.isArray(entry?.cards) ? entry.cards.length : 0;
    (Array.isArray(entry?.stacks) ? entry.stacks : []).forEach((stack) => {
      cardCount += Array.isArray(stack?.cards) ? stack.cards.length : 0;
    });
  });

  const parts = [`${deckData?.lastUpdated || 0}::${decks.length}::${cardCount}`];
  const sharedIds = collectSharedIdsFromDecks(decks);
  if (!sharedIds.size) return parts.join('::');

  let shareCache = new Map();
  if (deckD1ReadEnabled(env)) {
    shareCache = await d1GetSharesByIds(env, [...sharedIds]);
  } else {
    for (const sharedId of sharedIds) {
      const record = await fetchDeckShare(env, sharedId);
      if (record) shareCache.set(sharedId, record);
    }
  }

  const sharedParts = [];
  for (const sharedId of [...sharedIds].sort()) {
    const record = shareCache.get(sharedId);
    if (record && userCanAccessShare(record, userId)) {
      sharedParts.push(`${sharedId}:${record.updatedAt || 0}`);
    }
  }
  if (sharedParts.length) parts.push(sharedParts.join('|'));
  return parts.join('::');
}

async function pushShareUpdate(env, userId, shareId, deckEntry, updatedShareIds) {
  if (!shareId || updatedShareIds.has(shareId)) return;
  const record = await fetchDeckShare(env, shareId);
  if (!record || !userCanEditShare(record, userId)) return;
  let shareType = record.type;
  let payload = extractSharePayload(deckEntry, shareType);
  if (!payload && shareType === 'stack') {
    payload = extractSharePayload(deckEntry, 'deck');
    if (payload) shareType = 'deck';
  }
  if (!payload) return;
  const updated = {
    ...record,
    type: shareType,
    payload,
    label: shareType === 'deck' ? (deckEntry.name || record.label) : record.label,
    updatedAt: Date.now(),
  };
  await saveDeckShare(env, updated);
  updatedShareIds.add(shareId);
}

function collectSharePushTargets(decks) {
  const targets = [];
  for (const deck of decks || []) {
    const deckShare = deck.sharedId || null;
    if (deckShare) targets.push({ shareId: deckShare, deckEntry: deck });
    for (const stack of deck.stacks || []) {
      if (stack.sharedId) {
        targets.push({
          shareId: stack.sharedId,
          deckEntry: stackToShareDeckEntry(stack),
        });
      }
      for (const card of stack.cards || []) {
        if (card.sharedId) {
          targets.push({
            shareId: card.sharedId,
            deckEntry: { name: card.title, cards: [card], stacks: [] },
          });
        }
      }
    }
    for (const card of deck.cards || []) {
      if (card.sharedId) {
        targets.push({
          shareId: card.sharedId,
          deckEntry: { name: card.title, cards: [card], stacks: [] },
        });
      }
    }
  }
  return targets;
}

export async function processDeckSyncPayload(env, userId, deckData, sourceClientId) {
  const existing = await getDeckDataForUser(env, userId);
  const incomingMod = Number(deckData?.clientLastModified) || 0;
  const existingMod = Number(existing?.clientLastModified) || 0;

  // Reject stale full-document overwrites from in-flight / multi-tab races.
  // Legacy clients that omit clientLastModified are still accepted.
  if (incomingMod > 0 && existingMod > 0 && incomingMod < existingMod) {
    return {
      ignored: true,
      lastUpdated: existing.lastUpdated || null,
      clientLastModified: existingMod,
    };
  }

  const decks = mergeDecksShareMetadata(
    Array.isArray(deckData?.decks) ? deckData.decks : [],
    existing.decks
  );
  const updatedShareIds = new Set();

  if (env.DECK_SHARE || deckD1WriteEnabled(env) || deckD1PrimaryEnabled(env)) {
    for (const target of collectSharePushTargets(decks)) {
      await pushShareUpdate(env, userId, target.shareId, target.deckEntry, updatedShareIds);
    }
  }

  const lastUpdated = Date.now();
  await saveDeckDataForUser(env, userId, {
    ...deckData,
    decks,
    clientLastModified: incomingMod || existingMod || lastUpdated,
    lastUpdated,
  });

  for (const sharedId of updatedShareIds) {
    const record = await fetchDeckShare(env, sharedId);
    if (record) {
      await publishDeckShareSync(env, record, sourceClientId);
    }
  }

  await notifyDeckSync(env, userId, {
    type: 'deck',
    ts: Date.now(),
    sourceClientId: sourceClientId || null,
  });

  return {
    ignored: false,
    lastUpdated,
    clientLastModified: incomingMod || existingMod || lastUpdated,
  };
}

function buildShareLabel(sourceType, deck, stack, card) {
  if (sourceType === 'deck') return deck.name || 'Shared deck';
  if (sourceType === 'stack') return stack.name || 'Untitled stack';
  return card.title || 'Shared card';
}

function buildInitialSharePayload(sourceType, deck, stack, card) {
  if (sourceType === 'deck') {
    return {
      name: deck.name || 'Untitled',
      cards: Array.isArray(deck.cards) ? JSON.parse(JSON.stringify(deck.cards)) : [],
      stacks: Array.isArray(deck.stacks) ? JSON.parse(JSON.stringify(deck.stacks)) : [],
      createdAt: deck.createdAt || Date.now(),
    };
  }
  if (sourceType === 'stack' && stack) {
    return stackToShareDeckEntry(stack);
  }
  if (sourceType === 'card' && card) {
    return JSON.parse(JSON.stringify(card));
  }
  return null;
}

function shareRecordType(sourceType) {
  return sourceType === 'stack' ? 'deck' : sourceType;
}

function recipientAlreadyHasShare(decks, sharedId) {
  return (decks || []).some(
    (d) => d?.sharedRef?.sharedId === sharedId || d?.sharedId === sharedId
  );
}

function upsertShareMember(members, profile) {
  const list = Array.isArray(members) ? [...members] : [];
  const idx = list.findIndex((m) => m && m.userId === profile.userId);
  const entry = {
    userId: profile.userId,
    username: profile.username || '',
    email: profile.email || '',
    role: 'editor',
    addedAt: Date.now(),
  };
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...entry };
    return list;
  }
  list.push(entry);
  return list;
}

function assignSharedIdToOwnerSource(deck, type, stack, card, sharedId) {
  if (type === 'deck') {
    deck.sharedId = sharedId;
    deck.sharedOut = true;
    return;
  }
  if (type === 'stack' && stack) {
    stack.sharedId = sharedId;
    stack.sharedOut = true;
    return;
  }
  if (type === 'card' && card) {
    card.sharedId = sharedId;
    card.sharedOut = true;
  }
}

function assignSharedMembersToOwnerSource(deck, type, stack, card, members) {
  const sharedMembers = shareMembersForClient(members);
  if (!sharedMembers.length) return;
  if (type === 'deck') {
    deck.sharedMembers = sharedMembers;
    return;
  }
  if (type === 'stack' && stack) {
    stack.sharedMembers = sharedMembers;
    return;
  }
  if (type === 'card' && card) {
    card.sharedMembers = sharedMembers;
  }
}

function attachOwnerShareMembers(entity, record, userId) {
  if (!entity?.sharedId || !record || record.ownerUserId !== userId) return entity;
  const sharedMembers = shareMembersForClient(record.members);
  if (!sharedMembers.length) return entity;
  return { ...entity, sharedMembers };
}

function attachOwnerShareMembersTree(decks, shareCache, userId) {
  return (decks || []).map((deck) => {
    let next = deck.sharedId && shareCache.has(deck.sharedId)
      ? attachOwnerShareMembers(deck, shareCache.get(deck.sharedId), userId)
      : deck;
    const stacks = (next.stacks || []).map((stack) => {
      let stackNext = stack.sharedId && shareCache.has(stack.sharedId)
        ? attachOwnerShareMembers(stack, shareCache.get(stack.sharedId), userId)
        : stack;
      const cards = (stackNext.cards || []).map((card) => (
        card.sharedId && shareCache.has(card.sharedId)
          ? attachOwnerShareMembers(card, shareCache.get(card.sharedId), userId)
          : card
      ));
      return cards !== stackNext.cards ? { ...stackNext, cards } : stackNext;
    });
    if (stacks !== next.stacks) next = { ...next, stacks };
    const cards = (next.cards || []).map((card) => (
      card.sharedId && shareCache.has(card.sharedId)
        ? attachOwnerShareMembers(card, shareCache.get(card.sharedId), userId)
        : card
    ));
    if (cards !== next.cards) next = { ...next, cards };
    return next;
  });
}

function existingSharedIdForSource(deck, type, stack, card) {
  if (type === 'deck') return deck.sharedId || null;
  if (type === 'stack' && stack) return stack.sharedId || null;
  if (type === 'card' && card) return card.sharedId || null;
  return null;
}

function buildRecipientReferenceDeck({ sharedId, type, label, ownerProfile }) {
  return {
    id: newDeckEntityId(),
    name: label,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    cards: [],
    stacks: [],
    sharedRef: {
      sharedId,
      type,
      ownerUserId: ownerProfile.userId,
      ownerUsername: ownerProfile.username || '',
      role: 'editor',
    },
  };
}

export async function handleDeckShareRequest(request, env, corsHeaders) {
  const userId = await resolveDeckUserId(request, env);
  if (!userId) return jsonResponse({ error: 'Not authenticated' }, corsHeaders, 401);

  if (!env.DECK_SHARE && !hasDeckD1Storage(env)) {
    return jsonResponse({ error: 'Live sharing unavailable — deploy worker with DECK_SHARE or DECK_DB binding' }, corsHeaders, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, corsHeaders, 400);
  }

  const deckId = String(body.deckId || '').trim();
  const stackId = body.stackId ? String(body.stackId).trim() : '';
  const cardId = body.cardId ? String(body.cardId).trim() : '';
  const usernameOrEmail = String(body.usernameOrEmail || '').trim();
  if (!deckId) return jsonResponse({ error: 'deckId required' }, corsHeaders, 400);

  const ownerProfile = await fetchUserProfile(env, userId);
  if (!ownerProfile) return jsonResponse({ error: 'Account not found' }, corsHeaders, 404);

  const ownerData = await getDeckDataForUser(env, userId);
  const ownerDecks = Array.isArray(ownerData.decks) ? ownerData.decks.slice() : [];
  const deck = findDeck(ownerDecks, deckId);
  if (!deck) return jsonResponse({ error: 'Deck not found' }, corsHeaders, 404);

  let sourceType = 'deck';
  let stack = null;
  let card = null;
  if (cardId) {
    sourceType = 'card';
    const found = findCardInDeckTree(deck, cardId, stackId || null);
    if (!found) return jsonResponse({ error: 'Card not found' }, corsHeaders, 404);
    stack = found.stack;
    card = found.card;
  } else if (stackId) {
    sourceType = 'stack';
    stack = findStack(deck, stackId);
    if (!stack) return jsonResponse({ error: 'Stack not found' }, corsHeaders, 404);
  }
  const shareType = shareRecordType(sourceType);

  const resolved = await resolveShareTarget(env, usernameOrEmail);
  if (resolved.error) return jsonResponse({ error: resolved.error }, corsHeaders, resolved.status);
  const target = resolved.profile;
  if (target.userId === userId) {
    return jsonResponse({ error: 'You cannot share with yourself' }, corsHeaders, 400);
  }

  let sharedId = existingSharedIdForSource(deck, sourceType, stack, card);
  let shareRecord = sharedId ? await fetchDeckShare(env, sharedId) : null;

  if (shareRecord && !userCanEditShare(shareRecord, userId)) {
    return jsonResponse({ error: 'Unable to share this item' }, corsHeaders, 403);
  }

  const now = Date.now();
  const label = buildShareLabel(sourceType, deck, stack, card);
  const payload = buildInitialSharePayload(sourceType, deck, stack, card);
  if (!payload) return jsonResponse({ error: 'Unable to share this item' }, corsHeaders, 400);

  if (!shareRecord) {
    sharedId = newSharedId();
    shareRecord = {
      id: sharedId,
      type: shareType,
      ownerUserId: ownerProfile.userId,
      ownerUsername: ownerProfile.username || '',
      members: [],
      label,
      contextDeckName: sourceType === 'stack' ? (deck.name || '') : (shareType !== 'deck' ? (deck.name || '') : null),
      payload,
      updatedAt: now,
      createdAt: now,
    };
  } else {
    shareRecord = {
      ...shareRecord,
      type: shareType,
      payload,
      label,
      contextDeckName: sourceType === 'stack' ? (deck.name || shareRecord.contextDeckName) : (shareType !== 'deck' ? (deck.name || shareRecord.contextDeckName) : null),
      updatedAt: now,
    };
  }

  shareRecord.members = upsertShareMember(shareRecord.members, target);
  await saveDeckShare(env, shareRecord);
  assignSharedIdToOwnerSource(deck, sourceType, stack, card, sharedId);
  assignSharedMembersToOwnerSource(deck, sourceType, stack, card, shareRecord.members);

  await saveDeckDataForUser(env, userId, {
    ...ownerData,
    decks: ownerDecks,
    lastUpdated: now,
  });

  const recipientData = await getDeckDataForUser(env, target.userId);
  const recipientDecks = Array.isArray(recipientData.decks) ? recipientData.decks.slice() : [];
  let recipientDeckId = null;

  if (!recipientAlreadyHasShare(recipientDecks, sharedId)) {
    const refDeck = buildRecipientReferenceDeck({ sharedId, type: shareType, label, ownerProfile });
    recipientDeckId = refDeck.id;
    recipientDecks.unshift(refDeck);
    await saveDeckDataForUser(env, target.userId, {
      ...recipientData,
      decks: recipientDecks,
      lastUpdated: now,
    });
  } else {
    const existing = recipientDecks.find((d) => d?.sharedRef?.sharedId === sharedId);
    recipientDeckId = existing?.id || null;
  }

  await publishDeckShareSync(env, shareRecord, null, [target.userId]);

  return jsonResponse({
    success: true,
    live: true,
    sharedWith: target.username || target.email || target.userId,
    sharedMembers: shareMembersForClient(shareRecord.members),
    sharedType: shareType,
    sharedName: label,
    sharedId,
    deckId: recipientDeckId,
  }, corsHeaders);
}

/**
 * Backfill one user's Deck UA blob + referenced DeckShare records into D1.
 */
export async function backfillUserDeckToD1(env, userId) {
  if (!userId || !env.DECK_DB) return { ok: false, error: 'D1 unavailable' };
  const deckData = await getDeckDataFromDo(env, userId);
  const decks = Array.isArray(deckData?.decks) ? deckData.decks : [];
  await d1PutUserDeckData(env, userId, {
    decks,
    lastUpdated: deckData?.lastUpdated || Date.now(),
  });

  const sharedIds = collectSharedIdsFromDecks(decks);
  let sharesOk = 0;
  let sharesFail = 0;
  for (const sharedId of sharedIds) {
    try {
      const record = await fetchDeckShareFromDo(env, sharedId);
      if (!record) {
        sharesFail++;
        continue;
      }
      await d1PutShare(env, record);
      sharesOk++;
    } catch (err) {
      sharesFail++;
      console.warn('[deck-d1] backfill share failed', sharedId, err?.message || err);
    }
  }

  return {
    ok: true,
    userId,
    deckCount: decks.length,
    sharesOk,
    sharesFail,
  };
}

export class DeckShare {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/get' && request.method === 'GET') {
        const record = await this.storage.get('record');
        if (!record) return jsonResponse({ error: 'Not found' }, {}, 404);
        const key = getAppDataKey(this.env);
        if (!key || !record || typeof record !== 'object') {
          return jsonResponse(record, {});
        }
        const out = { ...record };
        if (out.payload != null) out.payload = await decryptSharePayload(out.payload, key);
        if (out.label != null) out.label = await decryptString(out.label, key);
        if (out.contextDeckName != null) out.contextDeckName = await decryptString(out.contextDeckName, key);
        return jsonResponse(out, {});
      }
      if (path === '/save' && request.method === 'POST') {
        const record = await request.json();
        const key = getAppDataKey(this.env);
        let toStore = record;
        if (key && record && typeof record === 'object') {
          toStore = { ...record };
          if (toStore.payload != null) toStore.payload = await encryptSharePayload(toStore.payload, key);
          if (toStore.label != null) toStore.label = await encryptString(toStore.label, key);
          if (toStore.contextDeckName != null) {
            toStore.contextDeckName = await encryptString(toStore.contextDeckName, key);
          }
        }
        await this.storage.put('record', toStore);
        return jsonResponse({ success: true }, {});
      }
      if (path === '/delete' && request.method === 'POST') {
        await this.storage.deleteAll();
        return jsonResponse({ success: true }, {});
      }
      return jsonResponse({ error: 'Not found' }, {}, 404);
    } catch (err) {
      return jsonResponse({ error: err.message || 'Internal error' }, {}, 500);
    }
  }
}
