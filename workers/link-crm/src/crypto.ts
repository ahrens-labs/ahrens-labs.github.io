// Encryption utilities using Web Crypto API (Cloudflare compatible)

// Encrypt text using AES-GCM
export async function encrypt(text: string, key: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(text)

  const keyData = hexToBytes(key)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  )

  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.length)
  return bytesToBase64(combined)
}

// Decrypt text using AES-GCM. Legacy plaintext returns unchanged on failure.
export async function decrypt(encryptedText: string, key: string): Promise<string> {
  if (encryptedText == null || encryptedText === '') return encryptedText as string
  try {
    const combined = base64ToBytes(encryptedText)
    if (combined.length < 13) return encryptedText

    const iv = combined.slice(0, 12)
    const data = combined.slice(12)

    const keyData = hexToBytes(key)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    )

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      data
    )

    return new TextDecoder().decode(decrypted)
  } catch {
    // Likely legacy plaintext — keep as-is for lazy migration
    return encryptedText
  }
}

const CONTACT_SECRET_FIELDS = ['name', 'email', 'phone', 'title', 'company', 'notes'] as const
const INTERACTION_SECRET_FIELDS = ['title', 'notes', 'location'] as const
const REMINDER_SECRET_FIELDS = ['title', 'description'] as const

async function encryptFields<T extends Record<string, any>>(
  obj: T,
  fields: readonly string[],
  key: string
): Promise<T> {
  const out: any = { ...obj }
  for (const f of fields) {
    if (out[f] != null && String(out[f]).length > 0) {
      out[f] = await encrypt(String(out[f]), key)
    }
  }
  return out
}

async function decryptFields<T extends Record<string, any>>(
  obj: T,
  fields: readonly string[],
  key: string
): Promise<T> {
  const out: any = { ...obj }
  for (const f of fields) {
    if (out[f] != null && String(out[f]).length > 0) {
      out[f] = await decrypt(String(out[f]), key)
    }
  }
  return out
}

/** Encrypt contact PII + notes/company/title (platform-key option A). */
export async function encryptContact(contact: any, key: string) {
  return encryptFields(contact, CONTACT_SECRET_FIELDS, key)
}

/** Decrypt contact fields; plaintext legacy rows pass through. */
export async function decryptContact(contact: any, key: string) {
  return decryptFields(contact, CONTACT_SECRET_FIELDS, key)
}

export async function encryptInteraction(interaction: any, key: string) {
  return encryptFields(interaction, INTERACTION_SECRET_FIELDS, key)
}

export async function decryptInteraction(interaction: any, key: string) {
  return decryptFields(interaction, INTERACTION_SECRET_FIELDS, key)
}

export async function encryptReminder(reminder: any, key: string) {
  return encryptFields(reminder, REMINDER_SECRET_FIELDS, key)
}

export async function decryptReminder(reminder: any, key: string) {
  return decryptFields(reminder, REMINDER_SECRET_FIELDS, key)
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  const binString = String.fromCharCode(...bytes)
  return btoa(binString)
}

function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64)
  return Uint8Array.from(binString, (char) => char.charCodeAt(0))
}

export function generateId(): string {
  return crypto.randomUUID()
}
