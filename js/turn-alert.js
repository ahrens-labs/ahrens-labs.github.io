// Turn alerts for the board games: while it's your move, the tab title starts with "! " and the favicon gets a
// coloured dot in its top-right corner. Pages call TurnAlert.set(on), or hand TurnAlert.watch() a check that
// needs no network (it is re-run every second, so it follows whatever the page already knows).
(() => {
  if (window.TurnAlert) return;
  const DOT = '#ff3b30';
  const MARK = '! ';
  let on = false;
  let originals = null;
  let badge = null;
  let badgeFor = '';
  let remoteOn = false;
  const checks = [];
  const API_BASE = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';

  const iconLinks = () => [...document.querySelectorAll('link[rel~="icon"]')];
  function baseIcon() {
    const links = iconLinks();
    const size = (l) => parseInt(l.getAttribute('sizes'), 10) || 0;
    const sharp = links.filter((l) => size(l) >= 64).sort((a, b) => size(a) - size(b));
    const pick = sharp[0] || links.filter((l) => size(l)).sort((a, b) => size(b) - size(a))[0] || links[0];
    return pick ? (originals ? originals.get(pick) : pick.href) : '/favicon.ico';
  }

  function makeBadge(src) {
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        g.drawImage(im, 0, 0, 64, 64);
        g.beginPath();
        g.arc(49, 15, 13, 0, Math.PI * 2);
        g.fillStyle = DOT;
        g.fill();
        g.lineWidth = 4;
        g.strokeStyle = '#ffffff';
        g.stroke();
        try {
          resolve(c.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }

  async function applyIcon() {
    if (!on) {
      if (originals) originals.forEach((href, l) => { l.href = href; });
      originals = null;
      return;
    }
    const src = baseIcon();
    if (badgeFor !== src) {
      badgeFor = src;
      badge = await makeBadge(src);
    }
    if (!on || !badge) return;
    if (!originals) originals = new Map(iconLinks().map((l) => [l, l.href]));
    originals.forEach((_, l) => { l.href = badge; });
  }

  function applyTitle() {
    const base = document.title.startsWith(MARK) ? document.title.slice(MARK.length) : document.title;
    const want = on ? MARK + base : base;
    if (document.title !== want) document.title = want;
  }

  function set(v) {
    v = !!v;
    if (v === on) return;
    on = v;
    applyTitle();
    applyIcon();
  }

  // Ahrens Games settings (saved per account by the settings page and the lobby).
  const gamesSettings = () => {
    try {
      const uid = localStorage.getItem('ahrenslabs_userId');
      const key = `ahrensGames.settings${localStorage.getItem('ahrenslabs_sessionId') && uid ? `:${uid}` : ''}`;
      return JSON.parse(localStorage.getItem(key) || '{}') || {};
    } catch {
      return {};
    }
  };

  function tick() {
    if (gamesSettings().tabAlerts === false) return set(false);
    // Game pages have their own live turn check. The account-wide lobby result can be
    // stale briefly after a move, so only use it on pages without a local game check.
    let any = checks.length ? false : remoteOn;
    for (const fn of checks) {
      try {
        if (fn()) any = true;
      } catch {
        /* the page isn't ready yet */
      }
    }
    set(any);
  }

  function watch(fn) {
    checks.push(fn);
    if (checks.length === 1) setInterval(tick, 1000);
    tick();
  }

  // Keep game tabs informed even when their own game hasn't been opened. This lets any
  // already-loaded game page show its favicon alert while it sits in the background.
  async function refreshOnlineTurns() {
    let session = '';
    try {
      session = localStorage.getItem('ahrenslabs_sessionId') || '';
    } catch {
      return;
    }
    if (!session) {
      remoteOn = false;
      tick();
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/board-games/current`, { headers: { Authorization: `Bearer ${session}` } });
      if (!response.ok) return;
      const data = await response.json();
      remoteOn = (data.games || []).some((g) =>
        (g.needsMe != null ? g.needsMe : g.status === 'pending' && g.me === 1) ||
        (g.status === 'active' && g.turn === g.me)
      );
      tick();
    } catch {
      // Keep the last known alert state when the network is unavailable.
    }
  }
  refreshOnlineTurns();
  setInterval(refreshOnlineTurns, 15000);
  document.addEventListener('resume', refreshOnlineTurns);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshOnlineTurns();
  });
  addEventListener('focus', refreshOnlineTurns);
  addEventListener('online', refreshOnlineTurns);

  // Pages that rewrite their title (e.g. "Your turn — …") keep the "! " in front.
  addEventListener('DOMContentLoaded', () => {
    const t = document.querySelector('title');
    if (t) new MutationObserver(() => on && applyTitle()).observe(t, { childList: true, characterData: true, subtree: true });
  });

  // Background tabs run timers as rarely as once a minute; pages call check() the moment a game update lands.
  window.TurnAlert = { set, watch, check: () => checks.length && tick(), get on() { return on; } };
})();
