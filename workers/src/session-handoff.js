/**
 * Carries a signed-in browser session between ahrenslabs.com and ahrensgames.com (their storage is separate).
 * Stateless on purpose — no KV or Durable Object traffic: the token is the session fields AES-GCM-sealed with a
 * key derived from APP_DATA_ENCRYPTION_KEY, valid for HANDOFF_TTL_MS. Minting needs no session lookup because a
 * token only ever holds what its caller already had.
 */
import { getAppDataKey, hexToBytes } from './app-data-crypto.js';

const HANDOFF_TTL_MS = 60 * 1000;
const FIELD_MAX = 200;
let handoffKey = null;
let handoffKeySource = null;

async function getHandoffKey(env) {
  const hex = getAppDataKey(env);
  if (!hex) return null;
  if (handoffKey && handoffKeySource === hex) return handoffKey;
  const base = await crypto.subtle.importKey('raw', hexToBytes(hex), 'HKDF', false, ['deriveKey']);
  handoffKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode('ahrens-session-handoff-v1') },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  handoffKeySource = hex;
  return handoffKey;
}

function toBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const field = (v) => (typeof v === 'string' ? v.trim().slice(0, FIELD_MAX) : '');

function reply(body, status, corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function handleSessionHandoff(request, env, corsHeaders) {
  const auth = request.headers.get('Authorization') || '';
  const sessionId = field(auth.startsWith('Bearer ') ? auth.slice(7) : '');
  if (!sessionId) return reply({ error: 'Not signed in' }, 401, corsHeaders);
  const key = await getHandoffKey(env);
  if (!key) return reply({ error: 'Handoff unavailable' }, 503, corsHeaders);
  let body = {};
  try { body = await request.json(); } catch { /* fields are optional */ }
  const payload = {
    s: sessionId,
    u: field(body.userId),
    n: field(body.username),
    e: field(body.email),
    x: Date.now() + HANDOFF_TTL_MS,
  };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(payload))));
  const token = new Uint8Array(iv.length + sealed.length);
  token.set(iv, 0);
  token.set(sealed, iv.length);
  return reply({ token: toBase64Url(token) }, 200, corsHeaders);
}

export async function handleSessionRedeem(request, env, corsHeaders) {
  const key = await getHandoffKey(env);
  if (!key) return reply({ error: 'Handoff unavailable' }, 503, corsHeaders);
  let token = '';
  try { token = String((await request.json()).token || ''); } catch { /* handled below */ }
  if (!token || token.length > 2000) return reply({ error: 'Invalid handoff' }, 400, corsHeaders);
  let payload;
  try {
    const bytes = fromBase64Url(token);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
    payload = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    return reply({ error: 'Invalid handoff' }, 400, corsHeaders);
  }
  if (!payload || !payload.s || !(payload.x > Date.now())) return reply({ error: 'Handoff expired' }, 410, corsHeaders);
  return reply({ sessionId: payload.s, userId: payload.u || '', username: payload.n || '', email: payload.e || '' }, 200, corsHeaders);
}
