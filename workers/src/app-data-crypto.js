/**
 * Platform-key AES-GCM helpers for Deck / Tether app data at rest.
 * Ciphertext is prefixed with enc:1: for lazy migration of legacy plaintext.
 */
const ENC_PREFIX = 'enc:1:';

function hexToBytes(hex) {
  const clean = String(hex || '').trim();
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error('APP_DATA_ENCRYPTION_KEY must be a hex string');
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  if (bytes.length !== 32) {
    throw new Error('APP_DATA_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  }
  return bytes;
}

function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(base64) {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function getAppDataKey(env) {
  const key = env && typeof env.APP_DATA_ENCRYPTION_KEY === 'string' ? env.APP_DATA_ENCRYPTION_KEY.trim() : '';
  return key || null;
}

export function isEncryptedString(value) {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}

export async function encryptString(plain, keyHex) {
  if (plain == null) return plain;
  const text = String(plain);
  if (!text || !keyHex) return text;
  if (isEncryptedString(text)) return text;

  const keyData = hexToBytes(keyHex);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    new TextEncoder().encode(text)
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return ENC_PREFIX + bytesToBase64(combined);
}

export async function decryptString(value, keyHex) {
  if (value == null) return value;
  const text = String(value);
  if (!text || !keyHex || !isEncryptedString(text)) return text;

  try {
    const combined = base64ToBytes(text.slice(ENC_PREFIX.length));
    if (combined.length < 13) return text;
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const keyData = hexToBytes(keyHex);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error('app-data decrypt failed', e?.message || e);
    return text;
  }
}

async function mapFields(obj, fields, fn, keyHex) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = { ...obj };
  for (const f of fields) {
    if (out[f] != null && String(out[f]).length > 0) {
      out[f] = await fn(String(out[f]), keyHex);
    }
  }
  return out;
}

const DECK_NAME_FIELDS = ['name', 'title'];

async function encryptCard(card, keyHex) {
  if (!card || typeof card !== 'object') return card;
  let out = await mapFields({ ...card }, DECK_NAME_FIELDS, encryptString, keyHex);
  if (Array.isArray(out.sections)) {
    out.sections = await Promise.all(
      out.sections.map(async (s) => {
        if (!s || typeof s !== 'object') return s;
        return mapFields({ ...s }, ['title', 'body'], encryptString, keyHex);
      })
    );
  }
  if (Array.isArray(out.checklist)) {
    out.checklist = await Promise.all(
      out.checklist.map(async (item) => {
        if (!item || typeof item !== 'object') return item;
        return mapFields({ ...item }, ['text'], encryptString, keyHex);
      })
    );
  }
  // Legacy fields
  for (const f of ['front', 'back', 'notes']) {
    if (out[f] != null && String(out[f]).length > 0) {
      out[f] = await encryptString(String(out[f]), keyHex);
    }
  }
  return out;
}

async function decryptCard(card, keyHex) {
  if (!card || typeof card !== 'object') return card;
  let out = await mapFields({ ...card }, DECK_NAME_FIELDS, decryptString, keyHex);
  if (Array.isArray(out.sections)) {
    out.sections = await Promise.all(
      out.sections.map(async (s) => {
        if (!s || typeof s !== 'object') return s;
        return mapFields({ ...s }, ['title', 'body'], decryptString, keyHex);
      })
    );
  }
  if (Array.isArray(out.checklist)) {
    out.checklist = await Promise.all(
      out.checklist.map(async (item) => {
        if (!item || typeof item !== 'object') return item;
        return mapFields({ ...item }, ['text'], decryptString, keyHex);
      })
    );
  }
  for (const f of ['front', 'back', 'notes']) {
    if (out[f] != null && String(out[f]).length > 0) {
      out[f] = await decryptString(String(out[f]), keyHex);
    }
  }
  return out;
}

async function encryptStack(stack, keyHex) {
  if (!stack || typeof stack !== 'object') return stack;
  const out = await mapFields({ ...stack }, ['name'], encryptString, keyHex);
  if (Array.isArray(out.cards)) {
    out.cards = await Promise.all(out.cards.map((c) => encryptCard(c, keyHex)));
  }
  return out;
}

async function decryptStack(stack, keyHex) {
  if (!stack || typeof stack !== 'object') return stack;
  const out = await mapFields({ ...stack }, ['name'], decryptString, keyHex);
  if (Array.isArray(out.cards)) {
    out.cards = await Promise.all(out.cards.map((c) => decryptCard(c, keyHex)));
  }
  return out;
}

export async function encryptDeckBlob(deckData, keyHex) {
  if (!keyHex || !deckData || typeof deckData !== 'object') return deckData;
  const out = { ...deckData };
  if (Array.isArray(out.decks)) {
    out.decks = await Promise.all(
      out.decks.map(async (deck) => {
        if (!deck || typeof deck !== 'object') return deck;
        let d = await mapFields({ ...deck }, ['name'], encryptString, keyHex);
        if (Array.isArray(d.cards)) {
          d.cards = await Promise.all(d.cards.map((c) => encryptCard(c, keyHex)));
        }
        if (Array.isArray(d.stacks)) {
          d.stacks = await Promise.all(d.stacks.map((s) => encryptStack(s, keyHex)));
        }
        return d;
      })
    );
  }
  return out;
}

export async function decryptDeckBlob(deckData, keyHex) {
  if (!keyHex || !deckData || typeof deckData !== 'object') return deckData;
  const out = { ...deckData };
  if (Array.isArray(out.decks)) {
    out.decks = await Promise.all(
      out.decks.map(async (deck) => {
        if (!deck || typeof deck !== 'object') return deck;
        let d = await mapFields({ ...deck }, ['name'], decryptString, keyHex);
        if (Array.isArray(d.cards)) {
          d.cards = await Promise.all(d.cards.map((c) => decryptCard(c, keyHex)));
        }
        if (Array.isArray(d.stacks)) {
          d.stacks = await Promise.all(d.stacks.map((s) => decryptStack(s, keyHex)));
        }
        return d;
      })
    );
  }
  return out;
}

export async function encryptSharePayload(payload, keyHex) {
  if (!keyHex || !payload || typeof payload !== 'object') return payload;
  // Share payloads are deck/stack/card shaped
  if (Array.isArray(payload.stacks) || Array.isArray(payload.cards)) {
    let out = await mapFields({ ...payload }, ['name'], encryptString, keyHex);
    if (Array.isArray(out.cards)) {
      out.cards = await Promise.all(out.cards.map((c) => encryptCard(c, keyHex)));
    }
    if (Array.isArray(out.stacks)) {
      out.stacks = await Promise.all(out.stacks.map((s) => encryptStack(s, keyHex)));
    }
    return out;
  }
  return encryptCard(payload, keyHex);
}

export async function decryptSharePayload(payload, keyHex) {
  if (!keyHex || !payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload.stacks) || Array.isArray(payload.cards)) {
    let out = await mapFields({ ...payload }, ['name'], decryptString, keyHex);
    if (Array.isArray(out.cards)) {
      out.cards = await Promise.all(out.cards.map((c) => decryptCard(c, keyHex)));
    }
    if (Array.isArray(out.stacks)) {
      out.stacks = await Promise.all(out.stacks.map((s) => decryptStack(s, keyHex)));
    }
    return out;
  }
  return decryptCard(payload, keyHex);
}

const TETHER_TASK_FIELDS = ['title', 'definitionOfDone', 'notes'];

export async function encryptTetherTask(task, keyHex) {
  if (!keyHex || !task || typeof task !== 'object') return task;
  const out = await mapFields({ ...task }, TETHER_TASK_FIELDS, encryptString, keyHex);
  if (Array.isArray(out.labels)) {
    out.labels = await Promise.all(out.labels.map((l) => encryptString(String(l), keyHex)));
  }
  return out;
}

export async function decryptTetherTask(task, keyHex) {
  if (!keyHex || !task || typeof task !== 'object') return task;
  const out = await mapFields({ ...task }, TETHER_TASK_FIELDS, decryptString, keyHex);
  if (Array.isArray(out.labels)) {
    out.labels = await Promise.all(out.labels.map((l) => decryptString(String(l), keyHex)));
  }
  return out;
}

export async function encryptTetherProject(project, keyHex) {
  if (!keyHex || !project || typeof project !== 'object') return project;
  let out = await mapFields({ ...project }, ['title', 'description'], encryptString, keyHex);
  if (Array.isArray(out.tasks)) {
    out.tasks = await Promise.all(out.tasks.map((t) => encryptTetherTask(t, keyHex)));
  }
  return out;
}

export async function decryptTetherProject(project, keyHex) {
  if (!keyHex || !project || typeof project !== 'object') return project;
  let out = await mapFields({ ...project }, ['title', 'description'], decryptString, keyHex);
  if (Array.isArray(out.tasks)) {
    out.tasks = await Promise.all(out.tasks.map((t) => decryptTetherTask(t, keyHex)));
  }
  return out;
}

export async function encryptListMeta(meta, keyHex) {
  if (!keyHex || !meta || typeof meta !== 'object') return meta;
  return mapFields({ ...meta }, ['title', 'description'], encryptString, keyHex);
}

export async function decryptListMeta(meta, keyHex) {
  if (!keyHex || !meta || typeof meta !== 'object') return meta;
  return mapFields({ ...meta }, ['title', 'description'], decryptString, keyHex);
}

export async function encryptInboxTasks(tasks, keyHex) {
  if (!keyHex || !Array.isArray(tasks)) return tasks;
  return Promise.all(tasks.map((t) => encryptTetherTask(t, keyHex)));
}

export async function decryptInboxTasks(tasks, keyHex) {
  if (!keyHex || !Array.isArray(tasks)) return tasks;
  return Promise.all(tasks.map((t) => decryptTetherTask(t, keyHex)));
}
