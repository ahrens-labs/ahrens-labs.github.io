// Encryption utilities using Web Crypto API (Cloudflare compatible)

// Encrypt text using AES-GCM
export async function encrypt(text: string, key: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(text)
  
  // Derive key from hex string
  const keyData = hexToBytes(key)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  )
  
  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.length)
  
  // Return as base64
  return bytesToBase64(combined)
}

// Decrypt text using AES-GCM
export async function decrypt(encryptedText: string, key: string): Promise<string> {
  try {
    const combined = base64ToBytes(encryptedText)
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12)
    const data = combined.slice(12)
    
    // Derive key
    const keyData = hexToBytes(key)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    )
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      data
    )
    
    const dec = new TextDecoder()
    return dec.decode(decrypted)
  } catch (error) {
    console.error('Decryption failed:', error)
    return encryptedText // Return original if decryption fails
  }
}

// Encrypt contact PII fields
export async function encryptContact(contact: any, key: string) {
  const encrypted: any = { ...contact }
  
  if (contact.name) {
    encrypted.name = await encrypt(contact.name, key)
  }
  if (contact.email) {
    encrypted.email = await encrypt(contact.email, key)
  }
  if (contact.phone) {
    encrypted.phone = await encrypt(contact.phone, key)
  }
  
  return encrypted
}

// Decrypt contact PII fields
export async function decryptContact(contact: any, key: string) {
  const decrypted: any = { ...contact }
  
  if (contact.name) {
    decrypted.name = await decrypt(contact.name, key)
  }
  if (contact.email) {
    decrypted.email = await decrypt(contact.email, key)
  }
  if (contact.phone) {
    decrypted.phone = await decrypt(contact.phone, key)
  }
  
  return decrypted
}

// Helper functions
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

// Generate random ID
export function generateId(): string {
  return crypto.randomUUID()
}
