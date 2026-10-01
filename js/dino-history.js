// Dino Board Game — game history for the signed-in Ahrens Labs account.
(() => {
  const API_BASE = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
  const IMG = '/img/dino-game/';
  const PAGE = 30;
  const LEVELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
  const MODES = { quick: '⚡ Quick', long: '🐢 Long' };
  const FILTERS = [['', 'All games'], ['online', '🌐 Online'], ['ai', '🤖 Vs computer'], ['local', '👥 Same device']];
  const app = document.getElementById('app');

  let kind = '';
  let items = [];
  let total = 0;
  let stats = null;
  let loading = false;
  let error = '';
  let signedOut = false;

  function sessionId() {
    try {
      return localStorage.getItem('ahrenslabs_sessionId') || '';
    } catch {
      return '';
    }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  async function load(reset) {
    if (loading) return;
    if (!sessionId()) {
      signedOut = true;
      render();
      return;
    }
    loading = true;
    error = '';
    if (reset) items = [];
    render();
    const q = new URLSearchParams({ offset: String(items.length), limit: String(PAGE), kind });
    try {
      const res = await fetch(`${API_BASE}/api/dino/history?${q}`, { headers: { Authorization: `Bearer ${sessionId()}` } });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) signedOut = true;
      else if (!res.ok) error = data.error || 'Couldn’t load your history right now.';
      else {
        items = items.concat(data.items || []);
        total = data.total || 0;
        stats = data.stats || stats;
      }
    } catch {
      error = 'Couldn’t reach the server. Check your connection.';
    }
    loading = false;
    render();
  }

  function when(ts) {
    const d = new Date(ts);
    return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }

  function resultBadge(h) {
    if (h.kind === 'local') {
      if (h.myScore === h.oppScore) return '<span class="hb tie">Tie</span>';
      return `<span class="hb local">${esc(h.myScore > h.oppScore ? h.names[0] : h.names[1])} won</span>`;
    }
    return { win: '<span class="hb win">🏆 Win</span>', loss: '<span class="hb loss">Loss</span>', tie: '<span class="hb tie">🤝 Tie</span>' }[h.result] || '';
  }

  function reasonText(h) {
    if (h.reason === 'resign') return h.result === 'win' ? 'they resigned' : 'you resigned';
    if (h.reason === 'timeout') return h.result === 'win' ? 'they ran out of time' : 'you ran out of time';
    return '';
  }

  function row(h) {
    let icon = '🤖';
    let title = `vs Computer <span class="hm">${esc(LEVELS[h.level] || '')}</span>`;
    if (h.kind === 'online') {
      icon = '🌐';
      title = `vs ${esc(h.opp)} <span class="hm">${MODES[h.mode] || ''}</span>`;
    } else if (h.kind === 'local') {
      icon = '👥';
      title = `${esc(h.names[0])} vs ${esc(h.names[1])} <span class="hm">same device</span>`;
    }
    const score = typeof h.myScore === 'number' ? `<b class="hs">${h.myScore}–${h.oppScore}</b>` : '<b class="hs">—</b>';
    const why = reasonText(h);
    const view = h.kind === 'online' && h.gameId ? `<a class="btn sm ghost" href="/dino-board-game.html?game=${encodeURIComponent(h.gameId)}">View board</a>` : '';
    return `<li class="hrow">
      <span class="hi">${icon}</span>
      <div class="hmain"><div class="ht">${title}</div><small>${when(h.finishedAt)}${why ? ` · ${why}` : ''}</small></div>
      <div class="hres">${resultBadge(h)}${score}</div>
      <div class="hact">${view}</div>
    </li>`;
  }

  function statsHtml() {
    if (!stats) return '';
    const rated = stats.wins + stats.losses + stats.ties;
    const rate = rated ? `${Math.round((stats.wins / rated) * 100)}%` : '—';
    const box = (label, value, sub) => `<div class="hstat"><small>${label}</small><b>${value}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
    return `<div class="hstats">
      ${box('Games played', stats.played)}
      ${box('Record', `${stats.wins}–${stats.losses}–${stats.ties}`, 'wins · losses · ties')}
      ${box('Win rate', rate, `🌐 ${stats.online.wins}/${stats.online.played} · 🤖 ${stats.ai.wins}/${stats.ai.played}`)}
      ${box('Best score', stats.best == null ? '—' : stats.best, stats.avg == null ? '' : `average ${stats.avg}`)}
    </div>`;
  }

  function render() {
    const head = `<header class="hist-top">
      <a class="brand" href="/dino-board-game.html"><img class="brand-logo" src="${IMG}trex.webp" alt=""><div><h1>Dino Board Game</h1><small>Game history</small></div></a>
      <a class="btn sm" href="/dino-board-game.html">🦖 Play</a>
    </header>`;
    if (signedOut) {
      const back = encodeURIComponent('dino-history.html');
      app.innerHTML = `${head}<main class="hist"><div class="hcard gate-card"><h2>🔒 Sign in to see your games</h2>
        <p>Your Dino Board Game history is saved to your Ahrens Labs account.</p>
        <a class="btn big" href="/account.html?return=${back}">Log in or sign up</a></div></main>`;
      return;
    }
    const filters = FILTERS.map(([k, label]) => `<button class="seg-btn${k === kind ? ' on' : ''}" data-kind="${k}"><b>${label}</b></button>`).join('');
    let list;
    if (!items.length && loading) list = '<p class="muted">Loading your games…</p>';
    else if (!items.length && error) list = `<p class="muted">${esc(error)}</p>`;
    else if (!items.length) list = '<p class="muted">No finished games here yet. Finished games show up automatically.</p>';
    else list = `<ul class="hlist">${items.map(row).join('')}</ul>`;
    const more = items.length < total ? `<button class="btn ghost hmore" data-more="1" ${loading ? 'disabled' : ''}>${loading ? 'Loading…' : `Show more (${total - items.length} left)`}</button>` : '';
    app.innerHTML = `${head}<main class="hist">
      ${statsHtml()}
      <div class="hcard">
        <div class="seg hfilter" role="radiogroup">${filters}</div>
        ${error && items.length ? `<p class="muted">${esc(error)}</p>` : ''}
        ${list}
        ${more}
      </div>
    </main>`;
  }

  app.addEventListener('click', (e) => {
    const f = e.target.closest('[data-kind]');
    if (f && f.dataset.kind !== kind) {
      kind = f.dataset.kind;
      load(true);
      return;
    }
    if (e.target.closest('[data-more]')) load(false);
  });

  render();
  load(true);
})();
