// Rate limiting utilities for authentication endpoints
import type { Env } from './types'

const RATE_LIMIT_PREFIX = 'ratelimit:'
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 // 15 minutes in seconds
const ATTEMPT_WINDOW = 60 * 60 // 1 hour in seconds

interface RateLimitRecord {
  attempts: number
  firstAttempt: number
  lockedUntil?: number
}

export async function checkRateLimit(
  env: Env, 
  identifier: string, 
  type: 'login' | 'signup'
): Promise<{ allowed: boolean; remainingAttempts?: number; lockedUntil?: number }> {
  const key = `${RATE_LIMIT_PREFIX}${type}:${identifier}`
  const now = Date.now()
  
  const data = await env.SESSIONS.get(key)
  
  if (!data) {
    // First attempt, allow and create record
    const record: RateLimitRecord = {
      attempts: 1,
      firstAttempt: now
    }
    await env.SESSIONS.put(key, JSON.stringify(record), { expirationTtl: ATTEMPT_WINDOW })
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS - 1 }
  }
  
  const record: RateLimitRecord = JSON.parse(data)
  
  // Check if account is locked
  if (record.lockedUntil && record.lockedUntil > now) {
    return { 
      allowed: false, 
      lockedUntil: record.lockedUntil 
    }
  }
  
  // Reset if window expired
  if (now - record.firstAttempt > ATTEMPT_WINDOW * 1000) {
    const newRecord: RateLimitRecord = {
      attempts: 1,
      firstAttempt: now
    }
    await env.SESSIONS.put(key, JSON.stringify(newRecord), { expirationTtl: ATTEMPT_WINDOW })
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS - 1 }
  }
  
  // Increment attempts
  record.attempts++
  
  // Lock account if max attempts reached
  if (record.attempts >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = now + (LOCKOUT_DURATION * 1000)
    await env.SESSIONS.put(key, JSON.stringify(record), { expirationTtl: LOCKOUT_DURATION })
    return { 
      allowed: false, 
      lockedUntil: record.lockedUntil 
    }
  }
  
  // Update record
  await env.SESSIONS.put(key, JSON.stringify(record), { expirationTtl: ATTEMPT_WINDOW })
  
  return { 
    allowed: true, 
    remainingAttempts: MAX_LOGIN_ATTEMPTS - record.attempts 
  }
}

export async function clearRateLimit(env: Env, identifier: string, type: 'login' | 'signup'): Promise<void> {
  const key = `${RATE_LIMIT_PREFIX}${type}:${identifier}`
  await env.SESSIONS.delete(key)
}

export function formatLockoutMessage(lockedUntil: number): string {
  const remainingMs = lockedUntil - Date.now()
  const remainingMinutes = Math.ceil(remainingMs / (60 * 1000))
  return `Too many failed attempts. Account locked for ${remainingMinutes} minutes.`
}
