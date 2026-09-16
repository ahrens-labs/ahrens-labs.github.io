const MAX_PHOTO_BYTES = 200_000
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function validatePhotoPayload(
  data: ArrayBuffer,
  contentType: string,
): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_TYPES.has(contentType)) {
    return { ok: false, error: 'Photo must be JPEG, PNG, or WebP' }
  }
  if (data.byteLength === 0) {
    return { ok: false, error: 'Photo data is empty' }
  }
  if (data.byteLength > MAX_PHOTO_BYTES) {
    return { ok: false, error: `Photo must be under ${Math.round(MAX_PHOTO_BYTES / 1024)}KB` }
  }
  return { ok: true }
}

function arrayBufferToBase64(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data)
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export function decodeBase64Photo(base64: string): ArrayBuffer {
  const normalized = base64.replace(/^data:[^;]+;base64,/, '')
  return base64ToArrayBuffer(normalized)
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local')) return true
  if (host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return true
  if (host.startsWith('10.')) return true
  if (host.startsWith('192.168.')) return true
  const parts = host.split('.').map(Number)
  if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  if (host.startsWith('169.254.')) return true
  return false
}

export async function fetchPhotoFromUrl(url: string): Promise<{ data: ArrayBuffer; contentType: string }> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid photo URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Photo URL must use http or https')
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error('Photo URL host is not allowed')
  }

  const response = await fetch(parsed.toString(), {
    redirect: 'follow',
    headers: { Accept: 'image/*' },
  })
  if (!response.ok) {
    throw new Error('Could not download photo from URL')
  }

  const contentType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new Error('URL must point to a JPEG, PNG, or WebP image')
  }

  const data = await response.arrayBuffer()
  const validation = validatePhotoPayload(data, contentType)
  if (!validation.ok) {
    throw new Error(validation.error)
  }

  return { data, contentType }
}

export function encodePhotoForStorage(data: ArrayBuffer, contentType: string): { photoData: string; photoContentType: string } {
  const validation = validatePhotoPayload(data, contentType)
  if (!validation.ok) {
    throw new Error(validation.error)
  }
  return {
    photoData: arrayBufferToBase64(data),
    photoContentType: contentType,
  }
}

export function decodeStoredPhoto(photoData: string): ArrayBuffer {
  return base64ToArrayBuffer(photoData)
}
