// Deck — live shared decks, stacks, and cards (Durable Object + API handlers)

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

async function getDeckDataForUser(env, userId) {
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  const getReq = new Request('http://do/getDeckData', { method: 'GET' });
  const dataRes = await userAccount.fetch(getReq);
  if (!dataRes.ok) return { decks: [], lastUpdated: null };
  return dataRes.json();
}

async function saveDeckDataForUser(env, userId, deckData) {
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  const updateReq = new Request('http://do/updateDeckData', {
    method: 'POST',
    body: JSON.stringify(deckData),
  });
  await userAccount.fetch(updateReq);
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

async function fetchDeckShare(env, sharedId) {
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

async function saveDeckShare(env, record) {
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

function applySharePayloadToDeckEntry(entry, record) {
  if (!record || !record.payload) return entry;
  const type = record.type;
  const payload = record.payload;
  const next = { ...entry, updatedAt: record.updatedAt || Date.now() };

  if (type === 'deck') {
    next.name = payload.name || record.label || entry.name;
    next.cards = Array.isArray(payload.cards) ? payload.cards : [];
    next.stacks = Array.isArray(payload.stacks) ? payload.stacks : [];
    return next;
  }

  if (type === 'stack' && payload) {
    next.name = record.label || entry.name;
    next.cards = [];
    next.stacks = [payload];
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
    }
    for (const card of deck?.cards || []) {
      if (card?.sharedId) ids.add(card.sharedId);
    }
  }
  return ids;
}

export async function hydrateDeckDataForUser(env, userId, deckData) {
  const decks = Array.isArray(deckData?.decks) ? deckData.decks.map((d) => ({ ...d })) : [];
  const sharedIds = collectSharedIdsFromDecks(decks);
  if (!sharedIds.size || !env.DECK_SHARE) {
    return { ...deckData, decks };
  }

  const shareCache = new Map();
  await Promise.all(
    [...sharedIds].map(async (sharedId) => {
      const record = await fetchDeckShare(env, sharedId);
      if (record && userCanAccessShare(record, userId)) {
        shareCache.set(sharedId, record);
      }
    })
  );

  const hydrated = decks.map((deck) => {
    if (deck.sharedId && shareCache.has(deck.sharedId)) {
      return applySharePayloadToDeckEntry(deck, shareCache.get(deck.sharedId));
    }
    if (deck.sharedRef?.sharedId && shareCache.has(deck.sharedRef.sharedId)) {
      return applySharePayloadToDeckEntry(deck, shareCache.get(deck.sharedRef.sharedId));
    }
    return deck;
  });

  return {
    ...deckData,
    decks: hydrated,
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
  const sharedParts = [];
  for (const sharedId of [...sharedIds].sort()) {
    const record = await fetchDeckShare(env, sharedId);
    if (record && userCanAccessShare(record, userId)) {
      sharedParts.push(`${sharedId}:${record.updatedAt || 0}`);
    }
  }
  if (sharedParts.length) parts.push(sharedParts.join('|'));
  return parts.join('::');
}

export async function processDeckSyncPayload(env, userId, deckData, sourceClientId) {
  const decks = Array.isArray(deckData?.decks) ? deckData.decks : [];
  const updatedShareIds = new Set();

  if (env.DECK_SHARE) {
    for (const deck of decks) {
      if (deck.sharedId) {
        const record = await fetchDeckShare(env, deck.sharedId);
        if (record && userCanEditShare(record, userId)) {
          const payload = extractSharePayload(deck, record.type);
          if (payload) {
            const updated = {
              ...record,
              payload,
              label: record.type === 'deck' ? (deck.name || record.label) : record.label,
              updatedAt: Date.now(),
            };
            await saveDeckShare(env, updated);
            updatedShareIds.add(deck.sharedId);
          }
        }
      } else if (deck.sharedRef?.sharedId) {
        const sharedId = deck.sharedRef.sharedId;
        const record = await fetchDeckShare(env, sharedId);
        if (record && userCanEditShare(record, userId)) {
          const payload = extractSharePayload(deck, record.type);
          if (payload) {
            const updated = {
              ...record,
              payload,
              updatedAt: Date.now(),
            };
            await saveDeckShare(env, updated);
            updatedShareIds.add(sharedId);
          }
        }
      }
    }
  }

  await saveDeckDataForUser(env, userId, {
    ...deckData,
    decks,
    lastUpdated: Date.now(),
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
}

function buildShareLabel(type, deck, stack, card) {
  if (type === 'deck') return deck.name || 'Shared deck';
  if (type === 'stack') return (stack.name || 'Stack') + ' · ' + (deck.name || 'Deck');
  return card.title || 'Shared card';
}

function buildInitialSharePayload(type, deck, stack, card) {
  if (type === 'deck') {
    return {
      name: deck.name || 'Untitled',
      cards: Array.isArray(deck.cards) ? JSON.parse(JSON.stringify(deck.cards)) : [],
      stacks: Array.isArray(deck.stacks) ? JSON.parse(JSON.stringify(deck.stacks)) : [],
      createdAt: deck.createdAt || Date.now(),
    };
  }
  if (type === 'stack' && stack) {
    return JSON.parse(JSON.stringify(stack));
  }
  if (type === 'card' && card) {
    return JSON.parse(JSON.stringify(card));
  }
  return null;
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
    return;
  }
  if (type === 'stack' && stack) {
    stack.sharedId = sharedId;
    return;
  }
  if (type === 'card' && card) {
    card.sharedId = sharedId;
  }
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

  if (!env.DECK_SHARE) {
    return jsonResponse({ error: 'Live sharing unavailable — deploy worker with DECK_SHARE binding' }, corsHeaders, 503);
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

  let type = 'deck';
  let stack = null;
  let card = null;
  if (cardId) {
    type = 'card';
    const found = findCardInDeckTree(deck, cardId, stackId || null);
    if (!found) return jsonResponse({ error: 'Card not found' }, corsHeaders, 404);
    stack = found.stack;
    card = found.card;
  } else if (stackId) {
    type = 'stack';
    stack = findStack(deck, stackId);
    if (!stack) return jsonResponse({ error: 'Stack not found' }, corsHeaders, 404);
  }

  const resolved = await resolveShareTarget(env, usernameOrEmail);
  if (resolved.error) return jsonResponse({ error: resolved.error }, corsHeaders, resolved.status);
  const target = resolved.profile;
  if (target.userId === userId) {
    return jsonResponse({ error: 'You cannot share with yourself' }, corsHeaders, 400);
  }

  let sharedId = existingSharedIdForSource(deck, type, stack, card);
  let shareRecord = sharedId ? await fetchDeckShare(env, sharedId) : null;

  if (shareRecord && !userCanEditShare(shareRecord, userId)) {
    return jsonResponse({ error: 'Unable to share this item' }, corsHeaders, 403);
  }

  const now = Date.now();
  const label = buildShareLabel(type, deck, stack, card);
  const payload = buildInitialSharePayload(type, deck, stack, card);
  if (!payload) return jsonResponse({ error: 'Unable to share this item' }, corsHeaders, 400);

  if (!shareRecord) {
    sharedId = newSharedId();
    shareRecord = {
      id: sharedId,
      type,
      ownerUserId: ownerProfile.userId,
      ownerUsername: ownerProfile.username || '',
      members: [],
      label,
      contextDeckName: type !== 'deck' ? (deck.name || '') : null,
      payload,
      updatedAt: now,
      createdAt: now,
    };
  } else {
    shareRecord = {
      ...shareRecord,
      payload,
      label,
      contextDeckName: type !== 'deck' ? (deck.name || shareRecord.contextDeckName) : null,
      updatedAt: now,
    };
  }

  shareRecord.members = upsertShareMember(shareRecord.members, target);
  await saveDeckShare(env, shareRecord);
  assignSharedIdToOwnerSource(deck, type, stack, card, sharedId);

  await saveDeckDataForUser(env, userId, {
    ...ownerData,
    decks: ownerDecks,
    lastUpdated: now,
  });

  const recipientData = await getDeckDataForUser(env, target.userId);
  const recipientDecks = Array.isArray(recipientData.decks) ? recipientData.decks.slice() : [];
  let recipientDeckId = null;

  if (!recipientAlreadyHasShare(recipientDecks, sharedId)) {
    const refDeck = buildRecipientReferenceDeck({ sharedId, type, label, ownerProfile });
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
    sharedType: type,
    sharedName: label,
    sharedId,
    deckId: recipientDeckId,
  }, corsHeaders);
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
        return jsonResponse(record, {});
      }
      if (path === '/save' && request.method === 'POST') {
        const record = await request.json();
        await this.storage.put('record', record);
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
