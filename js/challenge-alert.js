// Site-wide game challenge toasts (ahrenslabs.com + ahrensgames.com).
// Polls /api/board-games/online (or accepts sync() from TurnAlert / lobby) and pops an
// achievement-style card with Accept / Decline when someone challenges you.
(() => {
  if (window.AhrensChallengeAlert) return;

  const API_BASE = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
  const GAMES_HOST = 'ahrensgames.com';
  const GAMES = {
    dino: { name: 'Dino Dynasty', icon: '🦖', page: '/dino-board-game.html', respond: '/api/dino/respond' },
    hearthhold: { name: 'Oakhaven', icon: '🏰', page: '/oakhaven.html', respond: '/api/oakhaven/respond' },
    atlantis: { name: 'Atlantis Expedition', icon: '🔱', page: '/atlantis.html', respond: '/api/atlantis/respond' },
    cauldron: { name: 'Cauldron Lane', icon: '⚗️', page: '/cauldron.html', respond: '/api/cauldron/respond' },
    heroes: { name: 'Hero League', icon: '🦸', page: '/heroes.html', respond: '/api/heroes/respond' },
    masquerade: { name: 'The Masquerade Court', icon: '🎭', page: '/masquerade.html', respond: '/api/masquerade/respond' },
    whiteout: { name: 'Whiteout Station', icon: '❄️', page: '/whiteout.html', respond: '/api/whiteout/respond' },
  };
  const SHOWN_KEY = 'ahrensChallenge.shown';
  const openToasts = new Map();
  let polling = false;
  let styleReady = false;
  let lastFetch = 0;
  let lastGames = [];
  let lastGamesAt = 0;
  let bus = null;
  const POLL_MS = 30000;

  function session() {
    try {
      return localStorage.getItem('ahrenslabs_sessionId') || '';
    } catch {
      return '';
    }
  }

  function bareHost(host) {
    return String(host || '').toLowerCase().replace(/^www\./, '');
  }

  function onSite() {
    const h = bareHost(location.hostname);
    return h === 'ahrenslabs.com' || h === GAMES_HOST || h === 'localhost' || h === '127.0.0.1';
  }

  function gamesOrigin() {
    return bareHost(location.hostname) === GAMES_HOST ? '' : `https://${GAMES_HOST}`;
  }

  function inviteKey(g) {
    return `${g.game}:${g.id}`;
  }

  function isInvite(g) {
    if (!g || !GAMES[g.game] || !g.id) return false;
    if (g.needsMe != null) return !!g.needsMe && g.status === 'pending';
    return g.status === 'pending' && g.me === 1;
  }

  function readShown() {
    try {
      const raw = sessionStorage.getItem(SHOWN_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(list) ? list : []);
    } catch {
      return new Set();
    }
  }

  function writeShown(set) {
    try {
      sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...set].slice(-40)));
    } catch {
      /* ignore */
    }
  }

  function markShown(key) {
    const set = readShown();
    set.add(key);
    writeShown(set);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  function ensureStyle() {
    if (styleReady || typeof document === 'undefined') return;
    styleReady = true;
    if (document.getElementById('ahrens-challenge-alert-style')) return;
    const s = document.createElement('style');
    s.id = 'ahrens-challenge-alert-style';
    s.textContent = `
@keyframes chalSlideIn{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:none}}
@keyframes chalSlideOut{from{opacity:1;transform:none}to{opacity:0;transform:translateX(28px)}}
.chal-toast-stack{position:fixed;top:16px;right:16px;z-index:10060;display:flex;flex-direction:column;gap:10px;
  max-width:min(340px,calc(100vw - 24px));pointer-events:none}
.chal-toast{pointer-events:auto;color:#fff;padding:18px 18px 16px;border-radius:14px;
  background:linear-gradient(135deg,#2ecc71,#27ae60);box-shadow:0 10px 28px rgba(39,174,96,.42);
  font:600 15px/1.35 system-ui,Segoe UI,sans-serif;animation:chalSlideIn .45s ease-out both}
.chal-toast.quick{background:linear-gradient(135deg,#f59e0b,#d97706);box-shadow:0 10px 28px rgba(217,119,6,.4)}
.chal-toast-kicker{font-size:.68rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;opacity:.92;margin:0 0 8px}
.chal-toast-title{font-size:1.35rem;font-weight:800;line-height:1.2;margin:0 0 6px}
.chal-toast-body{font-size:.92rem;opacity:.95;margin:0 0 14px;line-height:1.4}
.chal-toast-actions{display:flex;gap:8px;flex-wrap:wrap}
.chal-toast-actions button{flex:1 1 auto;min-width:6.5rem;padding:.55rem .85rem;border:0;border-radius:10px;
  cursor:pointer;font:800 .9rem/1.1 system-ui,Segoe UI,sans-serif}
.chal-toast-actions button:disabled{opacity:.65;cursor:wait}
.chal-toast-accept{color:#14532d;background:#ecfdf5;box-shadow:0 2px 0 #86efac}
.chal-toast-decline{color:#fff;background:rgba(0,0,0,.22);box-shadow:0 2px 0 rgba(0,0,0,.18)}
.chal-toast-err{margin:8px 0 0;font-size:.82rem;font-weight:700;color:#fef3c7}
@media (prefers-reduced-motion:reduce){.chal-toast{animation:none}}
`;
    document.head.appendChild(s);
  }

  function stack() {
    let el = document.getElementById('chal-toast-stack');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'chal-toast-stack';
    el.className = 'chal-toast-stack';
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
    return el;
  }

  function dismissToast(key, animate) {
    const el = openToasts.get(key);
    if (!el) return;
    openToasts.delete(key);
    if (!animate) {
      el.remove();
      return;
    }
    el.style.animation = 'chalSlideOut .35s ease-in forwards';
    setTimeout(() => el.remove(), 360);
  }

  function gameHref(meta, id, accept) {
    const q = `game=${encodeURIComponent(id)}${accept ? '&accept=1' : ''}`;
    return `${gamesOrigin()}${meta.page}?${q}`;
  }

  async function apiRespond(path, body) {
    const sid = session();
    if (!sid) return { ok: false, error: 'Sign in to respond.' };
    const r = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sid}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data, error: data.error };
  }

  function showToast(g) {
    const key = inviteKey(g);
    if (openToasts.has(key)) return;
    const meta = GAMES[g.game];
    if (!meta) return;
    ensureStyle();
    markShown(key);

    const el = document.createElement('div');
    el.className = 'chal-toast' + (g.mode === 'quick' ? ' quick' : '');
    el.dataset.chalKey = key;
    const pace = g.mode === 'quick' ? 'Quick match · ~90s to answer' : 'Long match';
    el.innerHTML = `
      <p class="chal-toast-kicker">${esc(meta.icon)} Challenge</p>
      <p class="chal-toast-title">${esc(g.opp || 'Someone')} challenged you</p>
      <p class="chal-toast-body">${esc(meta.name)} · ${esc(pace)}</p>
      <div class="chal-toast-actions">
        <button type="button" class="chal-toast-accept" data-chal="accept">Accept</button>
        <button type="button" class="chal-toast-decline" data-chal="decline">Decline</button>
      </div>
    `;
    stack().appendChild(el);
    openToasts.set(key, el);

    const setBusy = (busy) => {
      el.querySelectorAll('button').forEach((b) => {
        b.disabled = !!busy;
      });
    };
    const showErr = (msg) => {
      let err = el.querySelector('.chal-toast-err');
      if (!err) {
        err = document.createElement('p');
        err.className = 'chal-toast-err';
        el.appendChild(err);
      }
      err.textContent = msg || 'That didn’t work.';
    };

    el.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('[data-chal]');
      if (!btn || btn.disabled) return;
      const act = btn.getAttribute('data-chal');
      setBusy(true);
      try {
        if (act === 'decline') {
          const r = await apiRespond(meta.respond, { id: g.id, accept: false });
          if (!r.ok) {
            setBusy(false);
            showErr(r.error || 'Couldn’t decline.');
            return;
          }
          dismissToast(key, true);
          broadcast({ type: 'gone', key });
          return;
        }
        if (act === 'accept') {
          // Dino needs a full starting board; finish accept on the game page.
          if (g.game === 'dino') {
            location.assign(gameHref(meta, g.id, true));
            return;
          }
          const r = await apiRespond(meta.respond, { id: g.id, accept: true });
          if (!r.ok) {
            setBusy(false);
            showErr(r.error || 'Couldn’t accept.');
            return;
          }
          dismissToast(key, true);
          broadcast({ type: 'gone', key });
          location.assign(gameHref(meta, g.id, false));
        }
      } catch {
        setBusy(false);
        showErr('Network error — try again.');
      }
    });
  }

  function sync(games) {
    if (!onSite()) return;
    const list = Array.isArray(games) ? games : [];
    lastGames = list;
    lastGamesAt = Date.now();
    const invites = list.filter(isInvite);
    const live = new Set(invites.map(inviteKey));

    for (const key of [...openToasts.keys()]) {
      if (!live.has(key)) dismissToast(key, true);
    }

    const shown = readShown();
    invites.forEach((g) => {
      const key = inviteKey(g);
      if (openToasts.has(key) || shown.has(key)) return;
      showToast(g);
    });
  }

  function broadcast(msg) {
    try {
      if (!bus) bus = new BroadcastChannel('ahrens-challenges');
      bus.postMessage(msg);
    } catch {
      /* unsupported */
    }
  }

  async function refresh() {
    if (!onSite()) return;
    const sid = session();
    if (!sid) {
      [...openToasts.keys()].forEach((k) => dismissToast(k, false));
      if (window.TurnAlert && typeof window.TurnAlert.fromRemote === 'function') {
        window.TurnAlert.fromRemote([]);
      }
      return;
    }
    if (Date.now() - lastFetch < 2500) return;
    lastFetch = Date.now();
    try {
      const response = await fetch(`${API_BASE}/api/board-games/online`, {
        headers: { Authorization: `Bearer ${sid}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      const games = data.games || [];
      sync(games);
      if (window.TurnAlert && typeof window.TurnAlert.fromRemote === 'function') {
        window.TurnAlert.fromRemote(games, { skipChallengeSync: true });
      }
    } catch {
      /* keep last toasts */
    }
  }

  function start() {
    if (polling || !onSite()) return;
    polling = true;
    ensureStyle();
    try {
      bus = new BroadcastChannel('ahrens-challenges');
      bus.addEventListener('message', (ev) => {
        const msg = ev && ev.data;
        if (!msg || msg.type !== 'gone' || !msg.key) return;
        dismissToast(msg.key, true);
        markShown(msg.key);
      });
    } catch {
      bus = null;
    }
    refresh();
    setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      refresh();
    }, POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh();
    });
    addEventListener('focus', refresh);
    addEventListener('online', refresh);
    document.addEventListener('resume', refresh);
  }

  function getSnapshot() {
    if (!lastGamesAt) return null;
    return { games: lastGames, at: lastGamesAt };
  }

  window.AhrensChallengeAlert = { sync, start, refresh, getSnapshot };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
