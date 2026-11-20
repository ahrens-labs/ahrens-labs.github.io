// Recent online opponents shared across all Ahrens Games on this account/device.
// Only real player usernames are kept — computer seats are never stored or shown.
(function (root) {
  'use strict';

  const MAX = 12;

  // Fixed computer seat names from workers/src/lab-online.js (plus generic fallbacks).
  const KNOWN_BOT_NAMES = new Set([
    'the red cauldron',
    'blue phial & co.',
    'greenroot remedy',
    'violet moon',
    'crimson league',
    'azure guard',
    'emerald watch',
    'violet vanguard',
    'golden legion',
    'contessa rosa',
    'count azzurro',
    'lady verde',
    'baron viola',
    'marchesa oro',
    'computer crew a',
    'computer crew b',
    'computer crew c',
  ]);

  function storageKey() {
    try {
      const uid = localStorage.getItem('ahrenslabs_userId');
      const session = localStorage.getItem('ahrenslabs_sessionId');
      return `ahrensGames.recentOpponents${session && uid ? `:${uid}` : ''}`;
    } catch {
      return 'ahrensGames.recentOpponents';
    }
  }

  function isBotName(name) {
    const n = String(name || '').trim();
    if (!n) return true;
    const key = n.toLowerCase();
    if (KNOWN_BOT_NAMES.has(key)) return true;
    // Multi-seat lobby "opp" text, e.g. "Ada + 2 computers", or generic computer labels.
    if (/computer|\+\s*\d|\bbots?\b/i.test(n)) return true;
    if (/^computer\s+\d+$/i.test(n)) return true;
    // Joined summary strings are never a single username.
    if (n.includes(',')) return true;
    return false;
  }

  function cleanNames(names) {
    const seen = new Set();
    const out = [];
    (Array.isArray(names) ? names : [names]).forEach((raw) => {
      const n = String(raw || '').trim();
      if (!n || n.length > 80 || isBotName(n)) return;
      const key = n.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(n);
    });
    return out;
  }

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey()) || '[]');
      return cleanNames(Array.isArray(raw) ? raw : []);
    } catch {
      return [];
    }
  }

  function write(names) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(cleanNames(names).slice(0, MAX)));
    } catch {
      /* storage blocked */
    }
  }

  // Human usernames from a lobby/game summary. Prefers an explicit `opponents` list from the server.
  function humansFromGame(g) {
    if (!g) return [];
    if (Array.isArray(g.opponents)) return cleanNames(g.opponents);
    if (Array.isArray(g.names) && Array.isArray(g.bots)) {
      return cleanNames(g.names.map((n, i) => (i === g.me || g.bots[i] ? '' : n)));
    }
    // Without a bots[] flag, `names` can include computer seats — only trust a plain single-seat `opp`.
    const opp = String(g.opp || '').trim();
    return cleanNames(opp && !opp.includes(',') && !/\+/i.test(opp) ? [opp] : []);
  }

  function absorb(names) {
    const cleaned = cleanNames(names);
    if (!cleaned.length) {
      write(read());
      return list();
    }
    write([...cleaned, ...read()]);
    return list();
  }

  function list(lobbyGames) {
    // Persist humans from this lobby so they show up in other Ahrens Games too.
    const fromLobby = [];
    (Array.isArray(lobbyGames) ? lobbyGames : []).forEach((g) => {
      humansFromGame(g).forEach((n) => fromLobby.push(n));
    });
    // Always rewrite storage through cleanNames so previously saved bot names drop out.
    write([...fromLobby, ...read()]);
    return read().slice(0, MAX);
  }

  root.AhrensRecentOpponents = {
    list,
    remember: absorb,
    absorb,
    humansFromGame,
    isBotName,
  };
})(typeof window !== 'undefined' ? window : globalThis);
