// Deck — share decks, stacks, and cards with other Ahrens Labs users

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

async function resolveDeckUserId(request, env) {
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

async function notifyDeckSync(env, userId) {
  if (!env.DECK_SYNC || !userId) return;
  try {
    const stub = env.DECK_SYNC.get(env.DECK_SYNC.idFromName(String(userId)));
    await stub.fetch(
      new Request('http://do/notify', {
        method: 'POST',
        body: JSON.stringify({ type: 'deck', ts: Date.now() }),
      })
    );
  } catch {
    /* best-effort */
  }
}

function cloneCard(card, now) {
  const copy = JSON.parse(JSON.stringify(card));
  copy.id = newDeckEntityId();
  copy.createdAt = copy.createdAt || now;
  copy.updatedAt = now;
  if (Array.isArray(copy.sections)) {
    copy.sections = copy.sections.map((sec) => ({ ...sec, id: newDeckEntityId() }));
  }
  if (Array.isArray(copy.checklist)) {
    copy.checklist = copy.checklist.map((it) => ({ ...it, id: newDeckEntityId() }));
  }
  return copy;
}

function cloneStack(stack, now) {
  const copy = JSON.parse(JSON.stringify(stack));
  copy.id = newDeckEntityId();
  copy.createdAt = copy.createdAt || now;
  copy.cards = (Array.isArray(copy.cards) ? copy.cards : []).map((c) => cloneCard(c, now));
  return copy;
}

function cloneDeck(deck, now, sharedFrom) {
  const copy = JSON.parse(JSON.stringify(deck));
  copy.id = newDeckEntityId();
  copy.createdAt = copy.createdAt || now;
  copy.updatedAt = now;
  copy.cards = (Array.isArray(copy.cards) ? copy.cards : []).map((c) => cloneCard(c, now));
  copy.stacks = (Array.isArray(copy.stacks) ? copy.stacks : []).map((s) => cloneStack(s, now));
  if (sharedFrom) copy.sharedFrom = sharedFrom;
  return copy;
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

function buildSharedDeck({ type, deck, stack, card, ownerProfile }) {
  const now = Date.now();
  const sharedFrom = {
    type,
    ownerUserId: ownerProfile.userId,
    ownerUsername: ownerProfile.username || '',
    originalDeckId: deck.id,
    originalStackId: stack ? stack.id : null,
    originalCardId: card ? card.id : null,
    sharedAt: now,
  };

  if (type === 'deck') {
    const name = deck.name || 'Shared deck';
    return cloneDeck(deck, now, { ...sharedFrom, originalName: name });
  }

  if (type === 'stack' && stack) {
    const stackCopy = cloneStack(stack, now);
    return {
      id: newDeckEntityId(),
      name: (stack.name || 'Stack') + ' · ' + (deck.name || 'Deck'),
      createdAt: now,
      updatedAt: now,
      cards: [],
      stacks: [stackCopy],
      sharedFrom: { ...sharedFrom, originalName: stack.name || 'Stack' },
    };
  }

  if (type === 'card' && card) {
    const cardCopy = cloneCard(card, now);
    return {
      id: newDeckEntityId(),
      name: card.title || 'Shared card',
      createdAt: now,
      updatedAt: now,
      cards: [cardCopy],
      stacks: [],
      sharedFrom: { ...sharedFrom, originalName: card.title || 'Card' },
    };
  }

  return null;
}

export async function handleDeckShareRequest(request, env, corsHeaders) {
  const userId = await resolveDeckUserId(request, env);
  if (!userId) return jsonResponse({ error: 'Not authenticated' }, corsHeaders, 401);

  const body = await request.json();
  const deckId = String(body.deckId || '').trim();
  const stackId = body.stackId ? String(body.stackId).trim() : '';
  const cardId = body.cardId ? String(body.cardId).trim() : '';
  const usernameOrEmail = String(body.usernameOrEmail || '').trim();
  if (!deckId) return jsonResponse({ error: 'deckId required' }, corsHeaders, 400);

  const ownerProfile = await fetchUserProfile(env, userId);
  if (!ownerProfile) return jsonResponse({ error: 'Account not found' }, corsHeaders, 404);

  const ownerData = await getDeckDataForUser(env, userId);
  const deck = findDeck(ownerData.decks, deckId);
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

  const sharedDeck = buildSharedDeck({ type, deck, stack, card, ownerProfile });
  if (!sharedDeck) return jsonResponse({ error: 'Unable to share this item' }, corsHeaders, 400);

  const recipientData = await getDeckDataForUser(env, target.userId);
  const decks = Array.isArray(recipientData.decks) ? recipientData.decks.slice() : [];
  decks.unshift(sharedDeck);
  await saveDeckDataForUser(env, target.userId, {
    ...recipientData,
    decks,
    lastUpdated: Date.now(),
  });

  await notifyDeckSync(env, target.userId);

  const label = type === 'deck'
    ? (deck.name || 'deck')
    : type === 'stack'
      ? (stack.name || 'stack')
      : (card.title || 'card');

  return jsonResponse({
    success: true,
    sharedWith: target.username || target.email || target.userId,
    sharedType: type,
    sharedName: label,
    deckId: sharedDeck.id,
  }, corsHeaders);
}
