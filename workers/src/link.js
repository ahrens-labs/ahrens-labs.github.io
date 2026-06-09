// Link CRM — Ahrens Labs auth bridge (session → one-time token for Link worker)

function parseBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const m = authHeader.match(/^Bearer\s+(\S+)/i);
  return m ? m[1] : null;
}

function normalizeEmail(email) {
  if (email == null || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

async function sessionUserId(env, sessionId) {
  if (!sessionId || !env.SESSION) return null;
  const session = env.SESSION.get(env.SESSION.idFromName(sessionId));
  const res = await session.fetch(new Request('http://do/getUserId', { method: 'GET' }));
  const data = await res.json();
  return data.userId || null;
}

async function fetchUserProfile(env, userId) {
  if (!env.USER_ACCOUNT || !userId) return null;
  const stub = env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromName(String(userId)));
  try {
    const res = await stub.fetch(new Request('http://do/getData', { method: 'GET' }));
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || (!data.username && !data.email)) return null;
    return {
      userId,
      username: String(data.username || data.email || userId),
      email: normalizeEmail(data.email || ''),
      name: String(data.username || data.email || userId),
    };
  } catch {
    return null;
  }
}

function jsonResponse(body, corsHeaders, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function bridgeKvKey(token) {
  return `link_bridge:${token}`;
}

function newBridgeToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function linkAppBase(env) {
  const raw = String(env.LINK_APP_URL || 'https://ahrenslabs.com/link').trim();
  return raw.replace(/\/+$/, '');
}

/** POST /api/link/bridge — create one-time token for Link worker sign-in */
export async function handleLinkBridgeRequest(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  const userId = await sessionUserId(env, sessionId);
  if (!userId) {
    return jsonResponse({ error: 'Not authenticated' }, corsHeaders, 401);
  }

  const profile = await fetchUserProfile(env, userId);
  if (!profile || !profile.email) {
    return jsonResponse({ error: 'Account email required for Link' }, corsHeaders, 400);
  }

  if (!env.LINK_BRIDGE_KV) {
    return jsonResponse({ error: 'Link bridge not configured' }, corsHeaders, 503);
  }

  const token = newBridgeToken();
  const payload = {
    email: profile.email,
    username: profile.username,
    name: profile.username,
    ahrensUserId: userId,
    createdAt: Date.now(),
  };

  await env.LINK_BRIDGE_KV.put(bridgeKvKey(token), JSON.stringify(payload), { expirationTtl: 120 });

  const base = linkAppBase(env);
  return jsonResponse(
    {
      url: `${base}/auth/ahrens-bridge?token=${encodeURIComponent(token)}`,
      expiresInSeconds: 120,
    },
    corsHeaders
  );
}

/** GET /internal/link/consume-bridge?token= — used by Link worker (service binding) */
export async function handleLinkConsumeBridge(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token || !env.LINK_BRIDGE_KV) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const key = bridgeKvKey(token);
  const raw = await env.LINK_BRIDGE_KV.get(key);
  if (!raw) {
    return new Response(JSON.stringify({ error: 'Token expired or already used' }), {
      status: 410,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await env.LINK_BRIDGE_KV.delete(key);

  return new Response(raw, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleLinkRequest(request, env, corsHeaders, path) {
  if (path === '/api/link/bridge' && request.method === 'POST') {
    return handleLinkBridgeRequest(request, env, corsHeaders);
  }
  return null;
}
