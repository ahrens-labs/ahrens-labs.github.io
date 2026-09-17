/**
 * One-shot Tether DO → D1 backfill against production bindings.
 * Prefer production: POST /api/tether/admin/backfill-d1 with X-Test-Secret.
 * Optional: npx wrangler dev -c wrangler-tether-backfill.toml --remote
 */
import { backfillUserTetherToD1 } from '../src/tether.js';

export { TetherProject, TetherSync } from '../src/tether.js';
export { UserAccount, Session, UsernameRegistry } from '../src/index.js';

async function listAllUserIds(env) {
  if (!env.USERNAME_REGISTRY) return [];
  const registry = env.USERNAME_REGISTRY.get(env.USERNAME_REGISTRY.idFromName('global'));
  const userIds = [];
  const seen = new Set();
  let startAfter;
  for (let pages = 0; pages < 500; pages++) {
    const res = await registry.fetch(
      new Request('http://do/listUserIdsPage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 100, ...(startAfter ? { startAfter } : {}) }),
      })
    );
    if (!res.ok) break;
    const data = await res.json();
    for (const uid of data.userIds || []) {
      const id = uid != null ? String(uid).trim() : '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      userIds.push(id);
    }
    if (!data.nextListCursor) break;
    startAfter = data.nextListCursor;
  }
  return userIds;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/' && url.pathname !== '/backfill') {
      return new Response('Not found', { status: 404 });
    }
    const userIds = await listAllUserIds(env);
    const results = [];
    for (const uid of userIds) {
      results.push(await backfillUserTetherToD1(env, uid));
    }
    const body = {
      ok: true,
      scanned: userIds.length,
      projectsOk: results.reduce((n, r) => n + (r.projectsOk || 0), 0),
      projectsFail: results.reduce((n, r) => n + (r.projectsFail || 0), 0),
      inboxTotal: results.reduce((n, r) => n + (r.inboxCount || 0), 0),
      withProjects: results.filter((r) => (r.projectIds || 0) > 0).length,
    };
    return new Response(JSON.stringify(body, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
