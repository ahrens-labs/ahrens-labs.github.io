import type { Env } from './types'
import { generateId } from './crypto'
import { createSession, setSessionCookie } from './auth'

// Google OAuth flow for Cloudflare Workers

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

export function getGoogleAuthUrl(env: Env, callbackUrl: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/contacts.readonly'
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent'
  })
  
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export async function handleGoogleCallback(
  env: Env,
  code: string,
  callbackUrl: string
): Promise<Response> {
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code'
      })
    })
    
    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for tokens')
    }
    
    const tokens = await tokenResponse.json() as any
    
    // Get user info
    const userResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    })
    
    if (!userResponse.ok) {
      throw new Error('Failed to fetch user info')
    }
    
    const googleUser = await userResponse.json() as any
    
    // Find or create user in database
    let user = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(googleUser.email).first()
    
    if (!user) {
      // Create new user
      const userId = generateId()
      await env.DB.prepare(
        `INSERT INTO users (id, email, name, image, email_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        userId,
        googleUser.email,
        googleUser.name || null,
        googleUser.picture || null,
        1,
        Date.now(),
        Date.now()
      ).run()
      
      user = { id: userId }
    }
    
    // Store or update OAuth account
    const accountId = generateId()
    await env.DB.prepare(
      `INSERT OR REPLACE INTO accounts 
       (id, user_id, type, provider, provider_account_id, access_token, refresh_token, 
        expires_at, token_type, scope, id_token, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      accountId,
      (user as any).id,
      'oauth',
      'google',
      googleUser.id,
      tokens.access_token,
      tokens.refresh_token || null,
      tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : null,
      tokens.token_type,
      tokens.scope,
      tokens.id_token || null,
      Date.now(),
      Date.now()
    ).run()
    
    // Create session
    const sessionId = await createSession(env, (user as any).id)
    
    // Redirect to dashboard with session cookie
    const response = new Response(null, {
      status: 302,
      headers: { Location: '/dashboard' }
    })
    
    // Use secure cookies in production (https), not in local dev
    const isSecure = callbackUrl.startsWith('https://')
    return setSessionCookie(response, sessionId, isSecure)
  } catch (error) {
    console.error('OAuth callback error:', error)
    return new Response(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`, { status: 500 })
  }
}
