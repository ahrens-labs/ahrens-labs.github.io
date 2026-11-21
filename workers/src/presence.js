// Ephemeral “who’s online” via the Worker Cache API — no KV and no Durable Objects.
// Entries last PRESENCE_TTL_SEC; each authenticated ping refreshes the caller’s keys.
// Note: Cache is per colo, so presence is best-effort for people hitting the same edge.

const PRESENCE_TTL_SEC = 90;
const PRESENCE_ORIGIN = 'https://presence.ahrenslabs.internal';

function idRequest(userId) {
  return new Request(`${PRESENCE_ORIGIN}/id/${encodeURIComponent(String(userId || '').trim())}`);
}

function nameRequest(username) {
  const key = String(username || '')
    .trim()
    .toLowerCase()
    .slice(0, 80);
  return new Request(`${PRESENCE_ORIGIN}/name/${encodeURIComponent(key)}`);
}

function presenceResponse(payload) {
  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${PRESENCE_TTL_SEC}`,
    },
  });
}

async function readHit(req) {
  try {
    const hit = await caches.default.match(req);
    if (!hit) return null;
    const data = await hit.json().catch(() => null);
    if (!data || typeof data !== 'object') return null;
    const at = Number(data.at) || 0;
    if (!at || Date.now() - at > PRESENCE_TTL_SEC * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

/** Mark this account as online right now (call after auth succeeds). */
export async function markPresent(userId, username) {
  const id = String(userId || '').trim();
  if (!id) return;
  const name = String(username || '').trim().slice(0, 80);
  const payload = { userId: id, username: name, at: Date.now() };
  const body = presenceResponse(payload);
  const nameBody = name ? presenceResponse(payload) : null;
  try {
    const jobs = [caches.default.put(idRequest(id), body)];
    if (name && nameBody) jobs.push(caches.default.put(nameRequest(name), nameBody));
    await Promise.all(jobs);
  } catch {
    /* cache unavailable in some runtimes — presence is best-effort */
  }
}

export async function isPresentByUserId(userId) {
  const id = String(userId || '').trim();
  if (!id) return false;
  return !!(await readHit(idRequest(id)));
}

export async function isPresentByUsername(username) {
  const name = String(username || '').trim();
  if (!name) return false;
  return !!(await readHit(nameRequest(name)));
}

/** Batch check — returns lowercase username keys and userIds that are online. */
export async function checkPresent({ userIds = [], usernames = [] } = {}) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : []).map((x) => String(x || '').trim()).filter(Boolean))];
  const names = [
    ...new Set(
      (Array.isArray(usernames) ? usernames : [])
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .map((x) => x.slice(0, 80))
    ),
  ];
  const onlineUserIds = [];
  const onlineUsernames = [];
  await Promise.all([
    ...ids.map(async (id) => {
      if (await isPresentByUserId(id)) onlineUserIds.push(id);
    }),
    ...names.map(async (name) => {
      if (await isPresentByUsername(name)) onlineUsernames.push(name);
    }),
  ]);
  return { onlineUserIds, onlineUsernames, ttlSec: PRESENCE_TTL_SEC };
}

export { PRESENCE_TTL_SEC };
