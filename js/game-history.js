// Game history: every finished game across all the board games, with a link to each saved board.
// Admins can open another player's history with ?viewUserId= / viewEmail= / viewUsername=.
(() => {
  const API_BASE = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
  const ADMIN_BROADCAST_EMAIL = 'calebahrens2011@gmail.com';
  const CACHE_KEY = 'ahrensBoardGames.history';
  // Shown straight away on the next visit, then refreshed if it's more than a few seconds old.
  const FRESH_MS = 30 * 1000;
  const PAGE = 25;
  const GAMES = {
    dino: { name: 'Dino Dynasty', icon: '🦖', page: '/dino-board-game.html', history: '/game-history.html?game=dino', logo: '/img/dino-favicon-128.png?v=2', view: '🦖 View the parks' },
    hearthhold: { name: 'Oakhaven', icon: '🏰', page: '/oakhaven.html', history: '/game-history.html?game=hearthhold', logo: '/img/oakhaven-favicon-128.png?v=2', view: '🏘️ View the villages' },
    atlantis: { name: 'Atlantis Expedition', icon: '🔱', page: '/atlantis.html', history: '/game-history.html?game=atlantis', logo: '/img/atlantis-favicon-128.png?v=3', view: '🗺️ View the chart' },
    cauldron: { name: 'Cauldron Lane', icon: '⚗️', page: '/cauldron.html', history: '/game-history.html?game=cauldron', logo: '/img/cauldron-favicon-128.png?v=3', view: '⚗️ View the lane' },
    heroes: { name: 'Hero League', icon: '🦸', page: '/heroes.html', history: '/game-history.html?game=heroes', logo: '/img/heroes-favicon-128.png?v=3', view: '🦸 See the teams' },
    masquerade: { name: 'The Masquerade Court', icon: '🎭', page: '/masquerade.html', history: '/game-history.html?game=masquerade', logo: '/img/masquerade-favicon-128.png?v=3', view: '🎭 See the ballroom' },
  };
  const KIND = { ai: '🤖 vs computer', local: '👥 same device', online: '🌐 online' };
  const LEVELS = { easy: 'Easy', normal: 'Normal', medium: 'Normal', hard: 'Hard', brutal: 'Brutal' };

  const box = document.getElementById('history');
  if (!box) return;
  const $ = (sel) => box.querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const session = () => {
    try {
      return localStorage.getItem('ahrenslabs_sessionId') || '';
    } catch {
      return '';
    }
  };
  const isAdminViewer = () => {
    try {
      return (localStorage.getItem('ahrenslabs_email') || '').trim().toLowerCase() === ADMIN_BROADCAST_EMAIL;
    } catch {
      return false;
    }
  };

  function parseAdminViewTarget() {
    if (!isAdminViewer()) return null;
    const u = new URLSearchParams(location.search);
    const userId = (u.get('viewUserId') || '').trim();
    const email = (u.get('viewEmail') || '').trim();
    const username = (u.get('viewUsername') || '').trim();
    if (!userId && !email && !username) return null;
    const out = {};
    if (userId) out.userId = userId;
    if (email) out.email = email;
    if (username) out.username = username;
    return out;
  }

  function buildQuery(extra) {
    const q = new URLSearchParams();
    if (view.game && view.game !== 'all') q.set('game', view.game);
    if (view.adminTarget) {
      if (view.adminTarget.userId) q.set('viewUserId', view.adminTarget.userId);
      if (view.adminTarget.email) q.set('viewEmail', view.adminTarget.email);
      if (view.adminTarget.username) q.set('viewUsername', view.adminTarget.username);
    }
    if (extra) {
      Object.entries(extra).forEach(([k, v]) => {
        if (v == null || v === '') q.delete(k);
        else q.set(k, v);
      });
    }
    const s = q.toString();
    return s ? `?${s}` : '';
  }

  const params = new URLSearchParams(location.search);
  const view = {
    data: null,
    game: GAMES[params.get('game')] ? params.get('game') : 'all',
    shown: PAGE,
    loading: false,
    adminTarget: parseAdminViewTarget(),
    subject: null,
  };

  function signedOutBox() {
    const back = encodeURIComponent('game-history.html' + location.search);
    box.innerHTML = `<div class="mg-head"><h2 id="gh-title">🏆 Game history</h2></div><p class="mg-note">Sign in to see every game you’ve finished.</p><a class="play hx-signin" href="/account.html?return=${back}">Log in or sign up</a>`;
  }
  if (!session()) return signedOutBox();

  function updateAdminBanner() {
    const banner = document.getElementById('gh-admin-viewing-banner');
    const title = document.querySelector('.lobby-title h1');
    const blurb = document.querySelector('.lobby-title p');
    if (!view.adminTarget) {
      if (banner) banner.hidden = true;
      if (title) title.textContent = 'Game history';
      if (blurb) blurb.textContent = 'Every game you’ve finished, across all the boxes. Tap a game to see its final board.';
      return;
    }
    const label =
      (view.subject && (view.subject.username || view.subject.email)) ||
      view.adminTarget.username ||
      view.adminTarget.email ||
      view.adminTarget.userId ||
      'Player';
    if (banner) {
      banner.hidden = false;
      banner.textContent =
        'Admin view — read-only Ahrens Games history for ' +
        label +
        (view.subject && view.subject.email && view.subject.username ? ` (${view.subject.email})` : '') +
        '.';
    }
    if (title) title.textContent = `Game history · ${label}`;
    if (blurb) blurb.textContent = 'Finished games for this account across all Ahrens Games titles.';
  }

  // Where a row leads: its saved board, or the game's own history when no board was kept.
  function hrefOf(h) {
    const G = GAMES[h.game];
    if (!G) return '/game-history.html';
    // Admin viewing someone else: don't open their private past boards as if they were yours.
    if (view.adminTarget) return G.history;
    if (h.game === 'dino') {
      if (h.kind === 'online' && h.gameId) return `${G.page}?game=${encodeURIComponent(h.gameId)}`;
      return h.board ? `${G.page}?past=${encodeURIComponent(h.id)}` : G.history;
    }
    return h.board ? `${G.page}?past=${encodeURIComponent(h.id)}` : G.history;
  }
  const hasBoard = (h) => {
    if (view.adminTarget) return false;
    return h.game === 'dino' && h.kind === 'online' ? !!h.gameId : !!h.board;
  };

  function opponents(h) {
    const others = h.names.map((n, i) => ({ n, i })).filter((x) => x.i !== h.me);
    if (h.kind === 'ai' && others.length > 1) return `vs ${others.length} computer players`;
    return `vs ${others.map((x) => x.n || 'a player').join(', ')}`;
  }
  function scoreText(h) {
    const sc = h.scores || [];
    if (!sc.length || sc.every((x) => x == null)) return '';
    if (h.me == null) return sc.map((x) => (x == null ? '–' : x)).join(' – ');
    const mine = sc[h.me];
    const rest = sc.filter((_, i) => i !== h.me);
    return `${mine == null ? '–' : mine} – ${rest.map((x) => (x == null ? '–' : x)).join(' / ')}`;
  }
  function resultHtml(h) {
    if (h.result === 'win') return '<span class="hx-res win">Won</span>';
    if (h.result === 'loss') return '<span class="hx-res loss">Lost</span>';
    if (h.result === 'tie') return '<span class="hx-res tie">Tie</span>';
    if (h.winner != null && h.winner >= 0 && h.names[h.winner]) return `<span class="hx-res">${esc(h.names[h.winner])} won</span>`;
    if (h.winner === -1) return '<span class="hx-res tie">Tie</span>';
    return '';
  }
  function row(h) {
    const G = GAMES[h.game];
    if (!G) return '';
    const who = h.me == null ? h.names.join(' vs ') : opponents(h);
    const when = h.at ? new Date(h.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const why = h.reason === 'resign' ? (h.result === 'win' ? ' · they resigned' : ' · resigned') : h.reason === 'timeout' ? ' · out of time' : '';
    const sc = scoreText(h);
    const meta = [`${G.icon} ${G.name}`, `${KIND[h.kind] || ''}${h.kind === 'ai' && LEVELS[h.level] ? ` · ${LEVELS[h.level]}` : ''}${why}`, when].filter(Boolean).join(' · ');
    const board = hasBoard(h);
    return `<li><a class="hx-row" href="${hrefOf(h)}" title="${board ? `Open this game’s final board` : `Open ${esc(G.name)} history`}">
      <img class="hx-logo" src="${G.logo}" alt="" loading="lazy">
      <span class="hx-main"><b>${esc(who)}${sc ? ` <span class="hx-score">· ${esc(sc)}</span>` : ''}</b><small>${esc(meta)}</small></span>
      <span class="hx-end">${resultHtml(h)}${board ? `<small class="hx-view">${esc(G.view)} →</small>` : ''}</span></a></li>`;
  }

  function totals(stats, game) {
    const keys = game === 'all' ? Object.keys(stats) : [game];
    return keys.reduce((t, k) => {
      const s = stats[k];
      if (!s) return t;
      t.played += s.played; t.wins += s.wins; t.losses += s.losses; t.ties += s.ties;
      return t;
    }, { played: 0, wins: 0, losses: 0, ties: 0 });
  }

  function render() {
    const d = view.data;
    if (!d) return;
    updateAdminBanner();
    const stats = d.stats || {};
    const t = totals(stats, view.game);
    const rated = t.wins + t.losses + t.ties;
    const stat = (n, label) => `<div class="hx-stat"><b>${n}</b><small>${label}</small></div>`;
    $('.hx-stats').innerHTML = t.played
      ? stat(t.played, 'played') + stat(t.wins, 'won') + stat(t.losses, 'lost') + stat(t.ties, 'tied') + (rated ? stat(`${Math.round((t.wins / rated) * 100)}%`, 'win rate') : '')
      : '';
    const games = Object.keys(GAMES).filter((g) => stats[g] && stats[g].played);
    $('.hx-filter').innerHTML = games.length > 1 || view.game !== 'all'
      ? [['all', 'All games', totals(stats, 'all').played]].concat(games.map((g) => [g, `${GAMES[g].icon} ${GAMES[g].name}`, stats[g].played]))
        .map(([k, label, n]) => `<button type="button" role="tab" aria-selected="${view.game === k}" class="${view.game === k ? 'on' : ''}" data-hx="${k}">${esc(label)} <small>${n}</small></button>`).join('')
      : '';
    const items = d.items.filter((h) => GAMES[h.game] && (view.game === 'all' || h.game === view.game));
    $('.hx-list').innerHTML = items.slice(0, view.shown).map(row).join('');
    $('.hx-more').hidden = items.length <= view.shown;
    $('.hx-note').innerHTML = items.length
      ? ''
      : view.adminTarget
        ? 'No finished Ahrens Games for this account yet.'
        : 'No finished games yet. Games show up here when they end.';
  }

  function cached() {
    if (view.adminTarget) return null;
    try {
      return JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function fetchHistory() {
    if (view.adminTarget) {
      return fetch(`${API_BASE}/api/admin/board-games/load-for-user`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(view.adminTarget),
      }).then(async (r) => {
        if (r.status === 401 || r.status === 403) {
          throw new Error(r.status === 403 ? 'Admin only' : 'Unauthorized');
        }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.json();
        if (!data.success) throw new Error(data.error || 'Failed');
        view.subject = { username: data.username || '', email: data.email || '', userId: data.userId || '' };
        return { items: data.items || [], stats: data.stats || {} };
      });
    }
    return fetch(`${API_BASE}/api/board-games/history`, { headers: { Authorization: `Bearer ${session()}` } }).then(
      async (r) => {
        if (r.status === 401) {
          signedOutBox();
          return null;
        }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }
    );
  }

  function load() {
    if (view.loading) return;
    const c = cached();
    if (c && c.data && !view.data) {
      view.data = c.data;
      render();
    }
    if (c && Date.now() - c.at < FRESH_MS) return;
    view.loading = true;
    fetchHistory()
      .then((data) => {
        if (!data) return;
        view.data = { items: data.items || [], stats: data.stats || {} };
        if (!view.adminTarget) {
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: view.data }));
          } catch {
            /* storage blocked */
          }
        }
        render();
      })
      .catch((err) => {
        if (!view.data) {
          const note = $('.hx-note');
          if (note) {
            note.textContent =
              err && String(err.message || '').includes('Admin')
                ? 'Admin access is required to view another player’s history.'
                : 'Couldn’t load game history right now.';
          }
        }
      })
      .finally(() => {
        view.loading = false;
      });
  }

  box.addEventListener('click', (e) => {
    const f = e.target.closest('[data-hx]');
    if (f) {
      view.game = f.dataset.hx;
      view.shown = PAGE;
      if (history.replaceState) history.replaceState(null, '', location.pathname + buildQuery());
      return render();
    }
    if (e.target.closest('.hx-more')) {
      view.shown += PAGE;
      render();
    }
  });
  addEventListener('pageshow', (e) => {
    if (e.persisted) load();
  });
  updateAdminBanner();
  load();
})();
