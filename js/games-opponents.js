// Recent online opponents shared across all Ahrens Games on this account/device.
// Only real player usernames are kept — computer seats are never stored or shown.
(function (root) {
  'use strict';

  const MAX = 12;

  function storageKey() {
    try {
      const uid = localStorage.getItem('ahrenslabs_userId');
      const session = localStorage.getItem('ahrenslabs_sessionId');
      return `ahrensGames.recentOpponents${session && uid ? `:${uid}` : ''}`;
    } catch {
      return 'ahrensGames.recentOpponents';
    }
  }

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey()) || '[]');
      return Array.isArray(raw) ? raw.map((n) => String(n || '').trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function write(names) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(names.slice(0, MAX)));
    } catch {
      /* storage blocked */
    }
  }

  function isLikelyBotName(name) {
    const n = String(name || '').trim();
    if (!n) return true;
    // Multi-seat lobby "opp" text, e.g. "Ada + 2 computers", or generic computer labels.
    if (/computer|\+\s*\d|\bbots?\b/i.test(n)) return true;
    if (n.includes(',')) return true;
    return false;
  }

  // Human usernames from a lobby/game summary. Prefers an explicit `opponents` list from the server.
  function humansFromGame(g) {
    if (!g) return [];
    if (Array.isArray(g.opponents)) {
      return g.opponents.map((n) => String(n || '').trim()).filter((n) => n && !isLikelyBotName(n));
    }
    if (Array.isArray(g.names)) {
      const bots = Array.isArray(g.bots) ? g.bots : null;
      return g.names
        .map((n, i) => (i === g.me || (bots && bots[i]) ? '' : String(n || '').trim()))
        .filter((n) => n && !isLikelyBotName(n));
    }
    const opp = String(g.opp || '').trim();
    return opp && !isLikelyBotName(opp) ? [opp] : [];
  }

  function absorb(names) {
    const cleaned = (Array.isArray(names) ? names : [names])
      .map((n) => String(n || '').trim())
      .filter((n) => n && n.length <= 80 && !isLikelyBotName(n));
    if (!cleaned.length) return list();
    const seen = new Set();
    const next = [];
    [...cleaned, ...read()].forEach((n) => {
      const key = n.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      next.push(n);
    });
    write(next);
    return next.slice(0, MAX);
  }

  function list(lobbyGames) {
    // Persist humans from this lobby so they show up in other Ahrens Games too.
    const fromLobby = [];
    (Array.isArray(lobbyGames) ? lobbyGames : []).forEach((g) => {
      humansFromGame(g).forEach((n) => fromLobby.push(n));
    });
    if (fromLobby.length) absorb(fromLobby);

    const seen = new Set();
    const out = [];
    const add = (n) => {
      const name = String(n || '').trim();
      if (!name || name.length > 80 || isLikelyBotName(name)) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(name);
    };
    read().forEach(add);
    return out.slice(0, MAX);
  }

  root.AhrensRecentOpponents = {
    list,
    remember: absorb,
    absorb,
    humansFromGame,
  };
})(typeof window !== 'undefined' ? window : globalThis);
