// Saved local board games (vs computer or same device), several per game. Kept in this browser and,
// when signed in, in the account so they continue on other devices. Shared by the game pages and the lobby.
//
// Local index/bodies are scoped per account so two open sessions never flush each other's games
// into the wrong UserAccount.
(() => {
  if (window.BoardSaves) return;
  const API_BASE = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
  const LEGACY_INDEX_KEY = 'ahrensBoardSaves.index';
  const FLUSH_MS = 6000;
  const KEEPALIVE_MAX = 60000;

  const session = () => {
    try {
      return localStorage.getItem('ahrenslabs_sessionId') || '';
    } catch {
      return '';
    }
  };
  const userId = () => {
    try {
      return localStorage.getItem('ahrenslabs_userId') || '';
    } catch {
      return '';
    }
  };
  const multiUserBrowser = () => {
    try {
      return localStorage.getItem('ahrenslabs_multiUserBrowser') === 'true';
    } catch {
      return false;
    }
  };
  const scopeId = () => userId() || 'local';

  const indexKey = () => `ahrensBoardSaves.index:${scopeId()}`;
  const bodyKey = (game, id) => `ahrensBoardSaves.${scopeId()}.${game}.${id}`;
  const legacyBodyKey = (game, id) => `ahrensBoardSaves.${game}.${id}`;

  const readIndex = () => {
    migrateLegacyIfNeeded();
    try {
      return JSON.parse(localStorage.getItem(indexKey()) || '{}') || {};
    } catch {
      return {};
    }
  };
  const writeIndex = (ix) => {
    try {
      localStorage.setItem(indexKey(), JSON.stringify(ix));
    } catch {
      /* storage full or blocked */
    }
  };

  // Claim the old unscoped store once for a single-account browser. With multiple accounts open,
  // leave legacy alone so we never push one person's dirty games into another's cloud.
  function migrateLegacyIfNeeded() {
    const uid = userId();
    if (!uid) return;
    const scopedKey = `ahrensBoardSaves.index:${uid}`;
    let scopedRaw = null;
    try {
      scopedRaw = localStorage.getItem(scopedKey);
    } catch {
      return;
    }
    if (scopedRaw) return;

    let legacyRaw = null;
    try {
      legacyRaw = localStorage.getItem(LEGACY_INDEX_KEY);
    } catch {
      return;
    }
    if (!legacyRaw) return;

    if (multiUserBrowser()) {
      try {
        const legacy = JSON.parse(legacyRaw) || {};
        Object.values(legacy).forEach((m) => {
          if (m) m.dirty = false;
        });
        localStorage.setItem(LEGACY_INDEX_KEY, JSON.stringify(legacy));
      } catch {
        /* ignore */
      }
      return;
    }

    let legacy = {};
    try {
      legacy = JSON.parse(legacyRaw) || {};
    } catch {
      return;
    }
    const next = {};
    Object.keys(legacy).forEach((k) => {
      const m = legacy[k];
      if (!m || !m.game || !m.id) return;
      next[k] = m;
      if (m.deleted) return;
      try {
        const body = localStorage.getItem(legacyBodyKey(m.game, m.id));
        if (body) {
          localStorage.setItem(`ahrensBoardSaves.${uid}.${m.game}.${m.id}`, body);
          localStorage.removeItem(legacyBodyKey(m.game, m.id));
        }
      } catch {
        /* ignore */
      }
    });
    try {
      localStorage.setItem(scopedKey, JSON.stringify(next));
      localStorage.removeItem(LEGACY_INDEX_KEY);
    } catch {
      /* ignore */
    }
  }

  // Guest (`local`) games that were played before sign-in move into the signed-in account once.
  function adoptLocalGuestSaves() {
    const uid = userId();
    if (!uid || !session()) return;
    let guestRaw = null;
    try {
      guestRaw = localStorage.getItem('ahrensBoardSaves.index:local');
    } catch {
      return;
    }
    if (!guestRaw) return;
    let guest = {};
    try {
      guest = JSON.parse(guestRaw) || {};
    } catch {
      return;
    }
    const ix = readIndex();
    let moved = false;
    Object.keys(guest).forEach((k) => {
      const m = guest[k];
      if (!m || !m.game || !m.id) return;
      if (ix[k] && !ix[k].deleted && ix[k].updatedAt >= (m.updatedAt || 0)) return;
      if (!m.deleted) {
        try {
          const body = localStorage.getItem(`ahrensBoardSaves.local.${m.game}.${m.id}`);
          if (body) {
            localStorage.setItem(`ahrensBoardSaves.${uid}.${m.game}.${m.id}`, body);
            localStorage.removeItem(`ahrensBoardSaves.local.${m.game}.${m.id}`);
          }
        } catch {
          /* ignore */
        }
      }
      ix[k] = { ...m, dirty: !m.deleted };
      moved = true;
    });
    if (!moved) return;
    writeIndex(ix);
    try {
      localStorage.removeItem('ahrensBoardSaves.index:local');
    } catch {
      /* ignore */
    }
    schedule(500);
  }

  let timer = null;
  function schedule(ms) {
    if (!session() || !userId()) return;
    clearTimeout(timer);
    timer = setTimeout(() => flush(false), ms == null ? FLUSH_MS : ms);
  }

  function put(game, id, save, summary) {
    if (!game || !id || !save) return;
    adoptLocalGuestSaves();
    const ix = readIndex();
    const k = `${game}:${id}`;
    if (ix[k] && ix[k].deleted) delete ix[k].deleted;
    try {
      localStorage.setItem(bodyKey(game, id), JSON.stringify(save));
    } catch {
      return;
    }
    ix[k] = {
      game,
      id,
      summary: summary || {},
      updatedAt: Date.now(),
      dirty: !!session() && !!userId(),
      local: true,
      owner: scopeId(),
    };
    writeIndex(ix);
    schedule();
  }

  function remove(game, id) {
    const ix = readIndex();
    try {
      localStorage.removeItem(bodyKey(game, id));
    } catch {
      /* ignore */
    }
    ix[`${game}:${id}`] = {
      game,
      id,
      updatedAt: Date.now(),
      deleted: true,
      dirty: !!session() && !!userId(),
      owner: scopeId(),
    };
    writeIndex(ix);
    flush(document.visibilityState === 'hidden');
  }

  // Forget a game here for good (removed on this or another device).
  function tombstone(ix, game, id, updatedAt) {
    try {
      localStorage.removeItem(bodyKey(game, id));
    } catch {
      /* ignore */
    }
    ix[`${game}:${id}`] = { game, id, updatedAt: updatedAt || Date.now(), deleted: true, owner: scopeId() };
  }

  function readIndexForScope(scope) {
    migrateLegacyIfNeeded();
    const key =
      scope === 'local'
        ? 'ahrensBoardSaves.index:local'
        : scope
          ? `ahrensBoardSaves.index:${scope}`
          : indexKey();
    try {
      return JSON.parse(localStorage.getItem(key) || '{}') || {};
    } catch {
      return {};
    }
  }

  function getLocal(game, id) {
    adoptLocalGuestSaves();
    const uid = userId();
    const bodyKeys = [];
    if (uid) bodyKeys.push(`ahrensBoardSaves.${uid}.${game}.${id}`);
    bodyKeys.push(`ahrensBoardSaves.local.${game}.${id}`);
    bodyKeys.push(legacyBodyKey(game, id));
    bodyKeys.push(bodyKey(game, id));
    for (const k of bodyKeys) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) return JSON.parse(raw);
      } catch {
        /* try next key */
      }
    }
    return null;
  }

  // The save body, from this browser or else from the account.
  async function load(game, id) {
    adoptLocalGuestSaves();
    const here = getLocal(game, id);
    if (here) return here;
    if (!session() || !userId()) return null;
    try {
      const r = await fetch(`${API_BASE}/api/board-games/save?game=${encodeURIComponent(game)}&id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${session()}` },
      });
      if (!r.ok) return null;
      const data = await r.json();
      if (!data.save) return null;
      try {
        localStorage.setItem(bodyKey(game, id), JSON.stringify(data.save));
      } catch {
        /* still playable this time */
      }
      const ix = readIndex();
      ix[`${game}:${id}`] = {
        game,
        id,
        summary: data.summary || {},
        updatedAt: data.updatedAt || Date.now(),
        local: true,
        owner: scopeId(),
      };
      writeIndex(ix);
      return data.save;
    } catch {
      return null;
    }
  }

  // Saved games not deleted, newest first. Entries with local: false live only in the account so far.
  function list(game) {
    adoptLocalGuestSaves();
    const merged = new Map();
    const addFrom = (ix) => {
      Object.values(ix || {}).forEach((m) => {
        if (!m || m.deleted || (game && m.game !== game)) return;
        const k = `${m.game}:${m.id}`;
        const cur = merged.get(k);
        if (!cur || (m.updatedAt || 0) > (cur.updatedAt || 0)) merged.set(k, m);
      });
    };
    const uid = userId();
    if (uid) addFrom(readIndexForScope(uid));
    addFrom(readIndexForScope('local'));
    try {
      const legRaw = localStorage.getItem(LEGACY_INDEX_KEY);
      if (legRaw) addFrom(JSON.parse(legRaw) || {});
    } catch {
      /* ignore */
    }
    return [...merged.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  // 'removed' (deleted here or on another device), 'elsewhere' (a newer copy is in the account), or 'here'.
  function status(game, id) {
    const m = readIndex()[`${game}:${id}`];
    if (!m) return 'here';
    if (m.deleted) return 'removed';
    return m.local === false ? 'elsewhere' : 'here';
  }

  // Fold in the account's list (from /api/board-games/current): newer saves and deletions from other devices.
  function merge(remote) {
    if (!Array.isArray(remote)) return;
    if (!userId()) return;
    adoptLocalGuestSaves();
    const ix = readIndex();
    const old = Date.now() - 60 * 864e5;
    Object.keys(ix).forEach((k) => {
      if (ix[k].deleted && !ix[k].dirty && ix[k].updatedAt < old) delete ix[k];
    });
    remote.forEach((m) => {
      if (!m || !m.game || !m.id) return;
      const k = `${m.game}:${m.id}`;
      const cur = ix[k];
      // Removals win over anything still unsent here.
      if (m.deleted) {
        if (!(cur && cur.deleted)) tombstone(ix, m.game, m.id, m.updatedAt);
        return;
      }
      if (cur && (cur.deleted || cur.dirty || cur.updatedAt >= m.updatedAt)) return;
      if (cur && cur.local) {
        // A newer copy exists elsewhere: drop ours so the next open fetches it.
        try {
          localStorage.removeItem(bodyKey(m.game, m.id));
        } catch {
          /* ignore */
        }
      }
      ix[k] = {
        game: m.game,
        id: m.id,
        summary: m.summary || {},
        updatedAt: m.updatedAt,
        local: false,
        owner: scopeId(),
      };
    });
    writeIndex(ix);
  }

  // Send everything changed since the last sync in one request — only for this tab's account.
  function flush(leaving) {
    clearTimeout(timer);
    timer = null;
    const sid = session();
    const uid = userId();
    if (!sid || !uid) return;
    adoptLocalGuestSaves();
    const owner = uid;
    const ix = readIndex();
    const dirty = Object.values(ix)
      .filter((m) => m.dirty && (!m.owner || m.owner === owner || m.owner === 'local'))
      .slice(0, 10);
    if (!dirty.length) return;
    const ops = dirty.map((m) => (m.deleted
      ? { op: 'del', game: m.game, id: m.id, updatedAt: m.updatedAt }
      : { op: 'put', game: m.game, id: m.id, updatedAt: m.updatedAt, summary: m.summary, save: getLocal(m.game, m.id) }))
      .filter((o) => o.op === 'del' || o.save);
    if (!ops.length) return;
    const body = JSON.stringify({ ops });
    const sent = dirty.map((m) => [`${m.game}:${m.id}`, m.updatedAt]);
    const flushFor = owner;
    fetch(`${API_BASE}/api/board-games/saves`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sid}`, 'Content-Type': 'application/json' },
      body,
      keepalive: !!leaving && body.length < KEEPALIVE_MAX,
    })
      .then((r) => (r.ok ? r.json().catch(() => ({})) : null))
      .then((data) => {
        if (!data) return;
        // Another account may have become active in this tab; only clear dirty on the owner we flushed.
        if (userId() !== flushFor) return;
        const now = readIndex();
        sent.forEach(([k, at]) => {
          if (now[k] && now[k].updatedAt === at) delete now[k].dirty;
        });
        (data.removed || []).forEach((m) => tombstone(now, m.game, m.id, m.updatedAt));
        writeIndex(now);
        if (data.removed && data.removed.length) dispatchEvent(new CustomEvent('boardsaves:removed', { detail: data.removed }));
        if (Object.values(now).some((m) => m.dirty)) schedule(1000);
      })
      .catch(() => {});
  }

  const leave = () => {
    if (timer) flush(true);
  };
  addEventListener('pagehide', leave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') leave();
  });
  // Anything left unsent from last time goes up shortly after the page opens — for this account only.
  adoptLocalGuestSaves();
  if (session() && userId() && Object.values(readIndex()).some((m) => m.dirty)) schedule(2000);

  window.BoardSaves = { put, remove, load, getLocal, list, status, merge, flush };
})();
