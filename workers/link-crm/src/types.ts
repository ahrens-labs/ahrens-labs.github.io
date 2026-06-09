// Type definitions for Cloudflare Workers environment
export interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  AI: any
  ENCRYPTION_KEY: string
  SESSION_SECRET: string
  CHESS_ACCOUNTS?: Fetcher
}

export interface User {
  id: string
  email: string
  name: string | null
  image: string | null
  ahrens_user_id?: string | null
  ahrens_username?: string | null
}

export interface Session {
  userId: string
  expiresAt: number
  ahrensUserId?: string
}

export interface Contact {
  id: string
  userId: string
  name: string
  email: string | null
  phone: string | null
  title: string | null
  company: string | null
  birthday: number | null
  relationshipStatus: string
  tags: string[]
  notes: string | null
  nextFollowUpDate: number | null
  significantDate1: number | null
  significantDate1Label: string | null
  significantDate2: number | null
  significantDate2Label: string | null
  significantDate3: number | null
  significantDate3Label: string | null
  createdAt: number
  updatedAt: number
}

export interface Interaction {
  id: string
  contactId: string
  type: 'EMAIL' | 'MEETING' | 'PHONE_CALL' | 'VOICE_NOTE' | 'MANUAL'
  date: number
  title: string | null
  notes: string | null
  location: string | null
  duration: number | null
  createdAt: number
}

export interface Reminder {
  id: string
  contactId: string
  type: 'BIRTHDAY' | 'SIGNIFICANT_DATE' | 'FOLLOW_UP' | 'INACTIVITY'
  date: number
  title: string
  description: string | null
  dismissed: number
  createdAt: number
}
