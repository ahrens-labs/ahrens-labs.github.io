// Board game lobby: "Your games" — local saves in this browser plus online games across every board game.
(() => {
  const API_BASE = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
  const CACHE_KEY = 'ahrensBoardGames.current';
  const GAMES = {
    dino: { name: 'Dino Dynasty', icon: '🦖', page: '/dino-board-game.html', img: '/img/dino-game/cover.webp' },
    hearthhold: { name: 'Oakhaven', icon: '🏰', page: '/oakhaven.html', img: '/img/hearthhold/cover.webp' },
  };
  const LEVELS = { easy: 'Easy', normal: 'Normal', medium: 'Medium', hard: 'Hard', brutal: 'Brutal' };
  const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

  const box = document.getElementById('my-games');
  if (!box) return;
  const list = box.querySelector('.mg-list');
  const note = box.querySelector('.mg-note');

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const read = (k) => {
    try {
      return JSON.parse(localStorage.getItem(k) || 'null');
    } catch {
      return null;
    }
  };
  const session = () => {
    try {
      return localStorage.getItem('ahrenslabs_sessionId') || '';
    } catch {
      return '';
    }
  };

  function localGames() {
    const out = [];
    const hh = read('ahrensHearthhold.v1');
    if (hh && hh.state && hh.state.phase !== 'over' && Array.isArray(hh.state.players) && (hh.mode === 'ai' || hh.mode === 'local')) {
      const r = hh.state.round || 1;
      out.push({
        game: 'hearthhold',
        href: `${GAMES.hearthhold.page}?resume=local`,
        who: hh.mode === 'ai' ? `vs Computer${LEVELS[hh.level] ? ` · ${LEVELS[hh.level]}` : ''}` : `${hh.state.players.map((p) => p.name).join(' vs ')} · same device`,
        note: `${SEASONS[(r - 1) % 4]}, year ${Math.floor((r - 1) / 4) + 1} · round ${r} of 12`,
        where: 'local',
      });
    }
    const dino = read('ahrensDinoBoardGame.v1');
    if (dino && dino.v === 1 && Array.isArray(dino.queue) && !dino.sim && !dino.past && !(dino.queue[0] && dino.queue[0].t === 'gameOver') && Array.isArray(dino.players)) {
      const level = dino.aiCfg && LEVELS[dino.aiCfg.level];
      out.push({
        game: 'dino',
        href: GAMES.dino.page,
        who: dino.ai != null ? `vs Computer${level ? ` · ${level}` : ''}` : `${dino.players.map((p) => p.name).join(' vs ')} · same device`,
        note: `Round ${dino.round || 1} of ${dino.proto ? 15 : 18}`,
        where: 'local',
      });
    }
    return out;
  }

  function onlineItem(g) {
    const yours = (g.status === 'pending' && g.me === 1) || (g.status === 'active' && g.turn === g.me);
    let note;
    if (g.status === 'pending') note = g.me === 1 ? '<b>Challenged you</b> — accept or decline' : 'Waiting for them to accept';
    else note = `${yours ? '<b>Your turn</b>' : 'Their turn'}${g.round ? ` · round ${g.round}${g.game === 'hearthhold' ? ' of 12' : ''}` : ''}`;
    return {
      game: g.game,
      href: `${GAMES[g.game].page}?game=${encodeURIComponent(g.id)}`,
      who: `vs ${g.opp || 'a player'}`,
      noteHtml: `${note} · ${g.mode === 'quick' ? '⚡ quick' : '🐢 long'}`,
      where: 'online',
      yours,
    };
  }

  function card(it) {
    const G = GAMES[it.game];
    const tag = it.where === 'online' ? '🌐 Online' : '💾 This device';
    return `<a class="mg-card${it.yours ? ' yours' : ''}" href="${it.href}">
      <img src="${G.img}" alt="" loading="lazy">
      <span class="mg-body">
        <span class="mg-game">${G.icon} ${G.name}<small>${tag}</small></span>
        <b class="mg-who">${esc(it.who)}</b>
        <span class="mg-state">${it.noteHtml || esc(it.note)}</span>
      </span>
      ${it.yours ? '<span class="mg-flag">Your move</span>' : ''}
    </a>`;
  }

  function render(online, status) {
    const items = online.map(onlineItem).concat(localGames());
    items.sort((a, b) => (b.yours ? 1 : 0) - (a.yours ? 1 : 0));
    list.innerHTML = items.map(card).join('');
    const waiting = items.filter((x) => x.yours).length;
    box.querySelector('.mg-count').textContent = waiting ? `${waiting} waiting on you` : '';
    note.textContent = status === 'loading' && !items.length
      ? 'Checking your online games…'
      : status === 'error'
        ? 'Couldn’t load your online games right now.'
        : items.length
          ? ''
          : 'No games in progress. Pick a box below to start one!';
    box.hidden = !items.length && status !== 'loading' && !session();
  }

  const signedIn = !!session();
  let cached = [];
  try {
    cached = signedIn ? JSON.parse(sessionStorage.getItem(CACHE_KEY) || '[]') : [];
  } catch {
    cached = [];
  }
  render(cached, signedIn ? 'loading' : 'done');
  if (!signedIn) return;

  fetch(`${API_BASE}/api/board-games/current`, { headers: { Authorization: `Bearer ${session()}` } })
    .then((r) => {
      if (r.status === 401) return { games: [], signedOut: true };
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then((data) => {
      const games = (data.games || []).filter((g) => GAMES[g.game]);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(games));
      } catch {
        /* storage blocked */
      }
      render(games, 'done');
    })
    .catch(() => render(cached, 'error'));
})();
