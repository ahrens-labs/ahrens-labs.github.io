// Saved local board games (vs computer or same device), several per game. Kept in this browser and,
// when signed in, in the account so they continue on other devices. Shared by the game pages and the lobby.
(() => {
  if (window.BoardSaves) return;
  const API_BASE = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
  const INDEX_KEY = 'ahrensBoardSaves.index';
  const bodyKey = (game, id) => `ahrensBoardSaves.${game}.${id}`;
  const FLUSH_MS = 6000;
  const KEEPALIVE_MAX = 60000;

  const session = () => {
    try {
      return localStorage.getItem('ahrenslabs_sessionId') || '';
    } catch {
      return '';
    }
  };
  const readIndex = () => {
    try {
      return JSON.parse(localStorage.getItem(INDEX_KEY) || '{}') || {};
    } catch {
      return {};
    }
  };
  const writeIndex = (ix) => {
    try {
      localStorage.setItem(INDEX_KEY, JSON.stringify(ix));
    } catch {
      /* storage full or blocked */
    }
  };

  let timer = null;
  function schedule(ms) {
    if (!session()) return;
    clearTimeout(timer);
    timer = setTimeout(() => flush(false), ms == null ? FLUSH_MS : ms);
  }

  function put(game, id, save, summary) {
    if (!game || !id || !save) return;
    const ix = readIndex();
    const k = `${game}:${id}`;
    try {
      localStorage.setItem(bodyKey(game, id), JSON.stringify(save));
    } catch {
      return;
    }
    ix[k] = { game, id, summary: summary || {}, updatedAt: Date.now(), dirty: true, local: true };
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
    ix[`${game}:${id}`] = { game, id, updatedAt: Date.now(), deleted: true, dirty: true };
    writeIndex(ix);
    schedule(500);
  }

  function getLocal(game, id) {
    try {
      return JSON.parse(localStorage.getItem(bodyKey(game, id)) || 'null');
    } catch {
      return null;
    }
  }

  // The save body, from this browser or else from the account.
  async function load(game, id) {
    const here = getLocal(game, id);
    if (here) return here;
    if (!session()) return null;
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
      ix[`${game}:${id}`] = { game, id, summary: data.summary || {}, updatedAt: data.updatedAt || Date.now(), local: true };
      writeIndex(ix);
      return data.save;
    } catch {
      return null;
    }
  }

  // Saved games not deleted, newest first. Entries with local: false live only in the account so far.
  function list(game) {
    return Object.values(readIndex())
      .filter((m) => !m.deleted && (!game || m.game === game))
      .sort((a, b) => b.updatedAt - a.updatedAt);
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
    const ix = readIndex();
    const old = Date.now() - 60 * 864e5;
    Object.keys(ix).forEach((k) => {
      if (ix[k].deleted && !ix[k].dirty && ix[k].updatedAt < old) delete ix[k];
    });
    remote.forEach((m) => {
      if (!m || !m.game || !m.id) return;
      const k = `${m.game}:${m.id}`;
      const cur = ix[k];
      if (cur && (cur.dirty || cur.updatedAt >= m.updatedAt)) return;
      if (m.deleted) {
        try {
          localStorage.removeItem(bodyKey(m.game, m.id));
        } catch {
          /* ignore */
        }
        ix[k] = { game: m.game, id: m.id, updatedAt: m.updatedAt, deleted: true };
        return;
      }
      if (cur && cur.local) {
        // A newer copy exists elsewhere: drop ours so the next open fetches it.
        try {
          localStorage.removeItem(bodyKey(m.game, m.id));
        } catch {
          /* ignore */
        }
      }
      ix[k] = { game: m.game, id: m.id, summary: m.summary || {}, updatedAt: m.updatedAt, local: false };
    });
    writeIndex(ix);
  }

  // Send everything changed since the last sync in one request.
  function flush(leaving) {
    clearTimeout(timer);
    timer = null;
    const sid = session();
    if (!sid) return;
    const ix = readIndex();
    const dirty = Object.values(ix).filter((m) => m.dirty).slice(0, 10);
    if (!dirty.length) return;
    const ops = dirty.map((m) => (m.deleted
      ? { op: 'del', game: m.game, id: m.id, updatedAt: m.updatedAt }
      : { op: 'put', game: m.game, id: m.id, updatedAt: m.updatedAt, summary: m.summary, save: getLocal(m.game, m.id) }))
      .filter((o) => o.op === 'del' || o.save);
    const body = JSON.stringify({ ops });
    const sent = dirty.map((m) => [`${m.game}:${m.id}`, m.updatedAt]);
    fetch(`${API_BASE}/api/board-games/saves`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sid}`, 'Content-Type': 'application/json' },
      body,
      keepalive: !!leaving && body.length < KEEPALIVE_MAX,
    })
      .then((r) => {
        if (!r.ok) return;
        const now = readIndex();
        sent.forEach(([k, at]) => {
          if (now[k] && now[k].updatedAt === at) delete now[k].dirty;
        });
        writeIndex(now);
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
  // Anything left unsent from last time goes up shortly after the page opens.
  if (Object.values(readIndex()).some((m) => m.dirty)) schedule(2000);

  window.BoardSaves = { put, remove, load, getLocal, list, status, merge, flush };
})();
