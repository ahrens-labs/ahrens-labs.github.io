// Game history: every finished game across all the board games, with a link to each saved board.
(() => {
  const API_BASE = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
  const CACHE_KEY = 'ahrensBoardGames.history';
  // Shown straight away on the next visit, then refreshed if it's more than a few seconds old.
  const FRESH_MS = 30 * 1000;
  const PAGE = 25;
  const GAMES = {
    dino: { name: 'Dino Dynasty', icon: '🦖', page: '/dino-board-game.html', history: '/dino-history.html', img: '/img/dino-game/cover.webp', view: '🦖 View the parks' },
    hearthhold: { name: 'Oakhaven', icon: '🏰', page: '/oakhaven.html', history: '/oakhaven.html?history', img: '/img/hearthhold/cover.webp', view: '🏘️ View the villages' },
    atlantis: { name: 'Atlantis Expedition', icon: '🔱', page: '/atlantis.html', history: '/atlantis.html?history', img: '/img/atlantis/cover.webp', view: '🗺️ View the chart' },
    cauldron: { name: 'Cauldron Lane', icon: '⚗️', page: '/cauldron.html', history: '/cauldron.html?history', img: '/img/cauldron/cover.webp?v=2', view: '⚗️ View the lane' },
    heroes: { name: 'Hero League', icon: '🦸', page: '/heroes.html', history: '/heroes.html?history', img: '/img/heroes/cover.webp', view: '🦸 See the teams' },
    masquerade: { name: 'The Masquerade Court', icon: '🎭', page: '/masquerade.html', history: '/masquerade.html?history', img: '/img/masquerade/cover.webp', view: '🎭 See the ballroom' },
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
  const params = new URLSearchParams(location.search);
  const view = { data: null, game: GAMES[params.get('game')] ? params.get('game') : 'all', shown: PAGE, loading: false };

  function signedOutBox() {
    const back = encodeURIComponent('game-history.html');
    box.innerHTML = `<div class="mg-head"><h2 id="gh-title">🏆 Game history</h2></div><p class="mg-note">Sign in to see every game you’ve finished.</p><a class="play hx-signin" href="/account.html?return=${back}">Log in or sign up</a>`;
  }
  if (!session()) return signedOutBox();

  // Where a row leads: its saved board, or the game's own history when no board was kept.
  function hrefOf(h) {
    const G = GAMES[h.game];
    if (h.game === 'dino') {
      if (h.kind === 'online' && h.gameId) return `${G.page}?game=${encodeURIComponent(h.gameId)}`;
      return h.board ? `${G.page}?past=${encodeURIComponent(h.id)}` : G.history;
    }
    return h.board ? `${G.page}?past=${encodeURIComponent(h.id)}` : G.history;
  }
  const hasBoard = (h) => (h.game === 'dino' && h.kind === 'online' ? !!h.gameId : !!h.board);

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
    const who = h.me == null ? h.names.join(' vs ') : opponents(h);
    const when = h.at ? new Date(h.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const why = h.reason === 'resign' ? (h.result === 'win' ? ' · they resigned' : ' · resigned') : h.reason === 'timeout' ? ' · out of time' : '';
    const sc = scoreText(h);
    const meta = [`${G.icon} ${G.name}`, `${KIND[h.kind] || ''}${h.kind === 'ai' && LEVELS[h.level] ? ` · ${LEVELS[h.level]}` : ''}${why}`, when].filter(Boolean).join(' · ');
    const board = hasBoard(h);
    return `<li><a class="hx-row" href="${hrefOf(h)}" title="${board ? `Open this game’s final board` : `Open ${esc(G.name)} history`}">
      <img src="${G.img}" alt="" loading="lazy">
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
    const own = view.game !== 'all' ? `<a href="${GAMES[view.game].history}">All of your ${esc(GAMES[view.game].name)} games, with every score →</a>` : '';
    $('.hx-note').innerHTML = items.length
      ? (stats.dino && stats.dino.played > 50 && (view.game === 'all' || view.game === 'dino') && items.length <= view.shown ? 'Older Dino Dynasty games are in <a href="/dino-history.html">its own history</a>.' : own)
      : 'No finished games yet. Games show up here when they end.';
  }

  function cached() {
    try {
      return JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
    } catch {
      return null;
    }
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
    fetch(`${API_BASE}/api/board-games/history`, { headers: { Authorization: `Bearer ${session()}` } })
      .then((r) => {
        if (r.status === 401) {
          signedOutBox();
          return null;
        }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        view.data = { items: data.items || [], stats: data.stats || {} };
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: view.data }));
        } catch {
          /* storage blocked */
        }
        render();
      })
      .catch(() => {
        if (!view.data) $('.hx-note').textContent = 'Couldn’t load your game history right now.';
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
      // Each filter has its own address, so it can be shared or bookmarked.
      if (history.replaceState) history.replaceState(null, '', view.game === 'all' ? location.pathname : `${location.pathname}?game=${view.game}`);
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
  load();
})();
