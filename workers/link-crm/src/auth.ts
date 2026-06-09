import type { Env, User, Session } from './types'

// Session management using Cloudflare KV

const SESSION_PREFIX = 'session:'
const SESSION_DURATION = 30 * 24 * 60 * 60 // 30 days in seconds

export async function createSession(
  env: Env,
  userId: string,
  ahrensUserId?: string
): Promise<string> {
  const sessionId = crypto.randomUUID()
  const session: Session = {
    userId,
    expiresAt: Date.now() + SESSION_DURATION * 1000,
    ...(ahrensUserId ? { ahrensUserId } : {}),
  }
  
  await env.SESSIONS.put(
    SESSION_PREFIX + sessionId,
    JSON.stringify(session),
    { expirationTtl: SESSION_DURATION }
  )
  
  return sessionId
}

export async function getSession(env: Env, sessionId: string | null): Promise<Session | null> {
  if (!sessionId) return null
  
  const data = await env.SESSIONS.get(SESSION_PREFIX + sessionId)
  if (!data) return null
  
  const session: Session = JSON.parse(data)
  
  // Check expiration
  if (session.expiresAt < Date.now()) {
    await deleteSession(env, sessionId)
    return null
  }
  
  return session
}

export async function deleteSession(env: Env, sessionId: string): Promise<void> {
  await env.SESSIONS.delete(SESSION_PREFIX + sessionId)
}

export async function getUserFromSession(env: Env, sessionId: string | null): Promise<User | null> {
  const session = await getSession(env, sessionId)
  if (!session) return null
  
  const result = await env.DB.prepare(
    'SELECT id, email, name, image, ahrens_user_id, ahrens_username FROM users WHERE id = ?'
  ).bind(session.userId).first()
  
  return result as User | null
}

export async function fetchAhrensUsername(env: Env, ahrensUserId: string): Promise<string | null> {
  if (!env.CHESS_ACCOUNTS || !ahrensUserId) return null
  try {
    const res = await env.CHESS_ACCOUNTS.fetch(
      new Request(
        `https://internal/internal/user-profile?userId=${encodeURIComponent(ahrensUserId)}`,
        { method: 'GET' }
      )
    )
    if (!res.ok) return null
    const data = await res.json() as { username?: string }
    const username = String(data.username || '').trim()
    return username || null
  } catch {
    return null
  }
}

export async function setAhrensUsername(env: Env, userId: string, username: string): Promise<void> {
  const value = String(username || '').trim()
  if (!value) return
  await env.DB.prepare(
    'UPDATE users SET ahrens_username = ?, updated_at = ? WHERE id = ?'
  ).bind(value, Date.now(), userId).run()
}

/** Resolve Ahrens Labs account username for nav (never Link/Google display name). */
export async function enrichUserForNav(env: Env, user: User): Promise<User> {
  let ahrensUsername = String(user.ahrens_username || '').trim()
  if (ahrensUsername) return { ...user, ahrens_username: ahrensUsername }

  let ahrensId = user.ahrens_user_id
  if (!ahrensId) {
    const row = await env.DB.prepare(
      'SELECT ahrens_user_id, ahrens_username FROM users WHERE id = ?'
    ).bind(user.id).first() as { ahrens_user_id: string | null; ahrens_username: string | null } | null
    ahrensUsername = String(row?.ahrens_username || '').trim()
    if (ahrensUsername) {
      return { ...user, ahrens_user_id: row?.ahrens_user_id || null, ahrens_username: ahrensUsername }
    }
    ahrensId = row?.ahrens_user_id || null
  }

  if (!ahrensId) return user

  ahrensUsername = (await fetchAhrensUsername(env, ahrensId)) || ''
  if (ahrensUsername) {
    await setAhrensUsername(env, user.id, ahrensUsername)
    return { ...user, ahrens_user_id: ahrensId, ahrens_username: ahrensUsername }
  }

  return user
}

export async function userHasAhrensBinding(env: Env, userId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT ahrens_user_id FROM users WHERE id = ?'
  ).bind(userId).first() as { ahrens_user_id: string | null } | null
  return !!row?.ahrens_user_id
}

// Extract session ID from cookie
export function getSessionIdFromCookie(request: Request): string | null {
  const cookie = request.headers.get('Cookie')
  if (!cookie) return null
  
  const match = cookie.match(/session=([^;]+)/)
  return match ? match[1] : null
}

// Set session cookie in response
export function setSessionCookie(
  response: Response,
  sessionId: string,
  isSecure: boolean = true,
  cookiePath: string = '/'
): Response {
  const headers = new Headers(response.headers)
  const path = cookiePath || '/'

  headers.set(
    'Set-Cookie',
    `session=${sessionId}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION}${
      isSecure ? '; Secure' : ''
    }`
  )
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

// Clear session cookie
export function clearSessionCookie(response: Response, cookiePath: string = '/'): Response {
  const headers = new Headers(response.headers)
  const path = cookiePath || '/'
  headers.set(
    'Set-Cookie',
    `session=; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=0`
  )
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

// Secure password hashing using PBKDF2 with salt
const PBKDF2_ITERATIONS = 100000 // OWASP recommended minimum

// Generate cryptographically secure random salt
function generateSalt(): string {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Hash password using PBKDF2 with salt
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const passwordData = encoder.encode(password)
  const saltData = hexToBytes(salt)
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  
  // Derive hash using PBKDF2
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltData,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 256 bits = 32 bytes
  )
  
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Verify password against stored hash and salt
async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const passwordHash = await hashPassword(password, salt)
  return passwordHash === hash
}

// Helper function to convert hex string to bytes
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  return bytes
}

// Local authentication functions
export async function createLocalUser(
  env: Env,
  email: string,
  password: string,
  name: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first()

    if (existing) {
      return { success: false, error: 'Email already exists' }
    }

    const userId = crypto.randomUUID()
    const salt = generateSalt()
    const passwordHash = await hashPassword(password, salt)

    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(userId, email, name, Date.now(), Date.now()),
      env.DB.prepare(
        'INSERT INTO credentials (id, user_id, email, password_hash, salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), userId, email, passwordHash, salt, Date.now(), Date.now())
    ])

    return { success: true, userId }
  } catch (error) {
    console.error('Error creating local user:', error)
    return { success: false, error: 'Failed to create account' }
  }
}

/** Ahrens bridge display name — username always wins over any prior Link name. */
function ahrensBridgeDisplayName(username?: string, fallbackName?: string): string {
  const u = String(username || '').trim()
  if (u) return u
  const n = String(fallbackName || '').trim()
  if (n && !n.includes('@')) return n
  return ''
}

/** Find or create a Link CRM user tied to an Ahrens Labs account (by email + ahrens_user_id). */
export async function ensureUserForAhrensEmail(
  env: Env,
  email: string,
  name: string,
  ahrensUserId?: string,
  username?: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    const normalized = email.trim().toLowerCase()
    const ahrensId = ahrensUserId ? String(ahrensUserId).trim() : ''
    const displayName = ahrensBridgeDisplayName(username, name)
    const forceUsername = String(username || '').trim()

    async function applyAhrensProfile(userId: string) {
      const updates: Promise<unknown>[] = []
      if (ahrensId) {
        updates.push(
          env.DB.prepare(
            'UPDATE users SET ahrens_user_id = ?, updated_at = ? WHERE id = ?'
          ).bind(ahrensId, Date.now(), userId).run()
        )
      }
      if (forceUsername) {
        updates.push(
          env.DB.prepare(
            'UPDATE users SET ahrens_username = ?, updated_at = ? WHERE id = ?'
          ).bind(forceUsername, Date.now(), userId).run()
        )
      }
      if (updates.length) await Promise.all(updates)
    }

    if (ahrensId) {
      const byAhrens = await env.DB.prepare(
        'SELECT id FROM users WHERE ahrens_user_id = ?'
      ).bind(ahrensId).first() as { id: string } | null
    if (byAhrens?.id) {
      await applyAhrensProfile(byAhrens.id)
      return { success: true, userId: byAhrens.id }
    }
    }

    const existing = await env.DB.prepare(
      'SELECT id, ahrens_user_id FROM users WHERE email = ?'
    ).bind(normalized).first() as { id: string; ahrens_user_id: string | null } | null

    if (existing?.id) {
      await applyAhrensProfile(existing.id)
      return { success: true, userId: existing.id }
    }

    const userId = crypto.randomUUID()
    await env.DB.prepare(
      'INSERT INTO users (id, email, name, ahrens_user_id, ahrens_username, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      userId,
      normalized,
      name || forceUsername || normalized,
      ahrensId || null,
      forceUsername || null,
      Date.now(),
      Date.now()
    ).run()

    return { success: true, userId }
  } catch (error) {
    console.error('Error ensuring Ahrens Link user:', error)
    return { success: false, error: 'Failed to open Link account' }
  }
}

export async function authenticateLocalUser(
  env: Env,
  email: string,
  password: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    // Get credentials
    const result = await env.DB.prepare(
      'SELECT user_id, password_hash, salt FROM credentials WHERE email = ?'
    ).bind(email).first() as { user_id: string; password_hash: string; salt: string } | null
    
    if (!result) {
      return { success: false, error: 'Invalid email or password' }
    }
    
    // Check if user needs migration (no salt = old SHA-256 hash)
    if (!result.salt) {
      // Try to verify with old SHA-256 method
      const isValidOld = await verifyPasswordLegacy(password, result.password_hash)
      
      if (!isValidOld) {
        return { success: false, error: 'Invalid email or password' }
      }
      
      // Automatically migrate to new PBKDF2 + salt
      console.log('Migrating account to PBKDF2:', email)
      const newSalt = generateSalt()
      const newHash = await hashPassword(password, newSalt)
      
      await env.DB.prepare(
        'UPDATE credentials SET password_hash = ?, salt = ?, updated_at = ? WHERE email = ?'
      ).bind(newHash, newSalt, Date.now(), email).run()
      
      return { success: true, userId: result.user_id }
    }
    
    // Verify password with PBKDF2
    const isValid = await verifyPassword(password, result.password_hash, result.salt)
    if (!isValid) {
      return { success: false, error: 'Invalid email or password' }
    }
    
    return { success: true, userId: result.user_id }
  } catch (error) {
    console.error('Error authenticating user:', error)
    return { success: false, error: 'Authentication failed' }
  }
}

// Legacy SHA-256 verification for migration
async function verifyPasswordLegacy(password: string, hash: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return passwordHash === hash
}
