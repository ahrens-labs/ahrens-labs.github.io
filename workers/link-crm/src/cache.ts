/** Cloudflare Workers Cache API helpers for Link CRM. */

import { linkBasePath } from './host'

const GEN_KEY_PREFIX = 'link-cache-gen:'

export const LINK_CACHE_TTL = {
  /** Favicons / PWA icons */
  asset: 604800,
  /** Manifest */
  manifest: 3600,
  /** Auth identity JSON */
  identity: 60,
  /** Contact/search JSON APIs */
  api: 15,
  /** Heavy HTML list/detail pages */
  page: 15,
  /** Rarely changing legal pages */
  legal: 300,
} as const

type CacheEnv = { SESSIONS: KVNamespace }

export function scheduleCacheWork(c: { executionCtx?: { waitUntil?: (p: Promise<unknown>) => void } }, promise: Promise<unknown>) {
  if (!promise) return
  if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
    c.executionCtx.waitUntil(promise.catch(() => {}))
    return
  }
  promise.catch(() => {})
}

export async function getLinkCacheGen(env: CacheEnv, userId: string): Promise<string> {
  if (!userId || !env?.SESSIONS) return '0'
  try {
    const v = await env.SESSIONS.get(`${GEN_KEY_PREFIX}${userId}`)
    return v && String(v).trim() ? String(v).trim() : '0'
  } catch {
    return '0'
  }
}

/** Bump generation so all prior per-user Cache API entries miss. */
export async function bumpLinkCacheGen(env: CacheEnv, userId: string): Promise<void> {
  if (!userId || !env?.SESSIONS) return
  try {
    await env.SESSIONS.put(`${GEN_KEY_PREFIX}${userId}`, String(Date.now()), {
      expirationTtl: 60 * 60 * 24 * 14,
    })
  } catch {
    /* best-effort */
  }
}

export function invalidateLinkUserCache(
  c: { env: CacheEnv; executionCtx?: { waitUntil?: (p: Promise<unknown>) => void } },
  userId: string,
) {
  scheduleCacheWork(c, bumpLinkCacheGen(c.env, userId))
}

function publicAssetKey(assetPath: string): Request {
  return new Request(`https://link-cache.internal/asset/v1${assetPath}`, { method: 'GET' })
}

function userCacheKey(
  userId: string,
  gen: string,
  request: Request,
  path: string,
  query = '',
): Request {
  const host = new URL(request.url).host
  const base = linkBasePath(request) || ''
  const q = String(query || '').replace(/^\?/, '')
  const suffix = q ? `?${q}` : ''
  return new Request(
    `https://link-cache.internal/u/v1/${encodeURIComponent(host)}${base}/g/${encodeURIComponent(gen)}/uid/${encodeURIComponent(userId)}${path}${suffix}`,
    { method: 'GET' },
  )
}

async function matchCache(key: Request): Promise<Response | null> {
  if (typeof caches === 'undefined') return null
  try {
    return (await caches.default.match(key)) || null
  } catch {
    return null
  }
}

function storeCache(
  c: { executionCtx?: { waitUntil?: (p: Promise<unknown>) => void } },
  key: Request,
  response: Response,
  maxAgeSec: number,
) {
  if (typeof caches === 'undefined') return
  try {
    const headers = new Headers(response.headers)
    headers.set('Cache-Control', `public, max-age=${Math.max(1, maxAgeSec)}`)
    headers.delete('Set-Cookie')
    const stored = new Response(response.clone().body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
    scheduleCacheWork(c, caches.default.put(key, stored))
  } catch {
    /* ignore */
  }
}

function withClientNoStore(response: Response, hit: boolean): Response {
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'private, no-store')
  headers.set('X-Link-Cache', hit ? 'HIT' : 'MISS')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/** Cache static public assets (icons) under a stable key. */
export async function cachedPublicAsset(
  c: { executionCtx?: { waitUntil?: (p: Promise<unknown>) => void } },
  assetPath: string,
  maxAgeSec: number,
  build: () => Response,
): Promise<Response> {
  const key = publicAssetKey(assetPath)
  const hit = await matchCache(key)
  if (hit) {
    const headers = new Headers(hit.headers)
    headers.set('X-Link-Cache', 'HIT')
    return new Response(hit.body, { status: hit.status, headers })
  }
  const response = build()
  storeCache(c, key, response, maxAgeSec)
  const headers = new Headers(response.headers)
  headers.set('X-Link-Cache', 'MISS')
  return new Response(response.body, { status: response.status, headers })
}

/** Cache an authenticated JSON/HTML GET for a single user. */
export async function cachedUserGet(
  c: {
    env: CacheEnv
    req: { raw: Request; query: (key: string) => string | undefined }
    executionCtx?: { waitUntil?: (p: Promise<unknown>) => void }
  },
  userId: string,
  path: string,
  maxAgeSec: number,
  build: () => Promise<Response> | Response,
  query?: string,
): Promise<Response> {
  const q =
    query != null
      ? query
      : (() => {
          const url = new URL(c.req.raw.url)
          return url.searchParams.toString()
        })()
  const gen = await getLinkCacheGen(c.env, userId)
  const key = userCacheKey(userId, gen, c.req.raw, path, q)
  const hit = await matchCache(key)
  if (hit) return withClientNoStore(hit, true)

  const response = await build()
  if (response.status >= 200 && response.status < 300) {
    storeCache(c, key, response, maxAgeSec)
  }
  return withClientNoStore(response, false)
}
