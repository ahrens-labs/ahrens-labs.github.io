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

  // Local games only count once a person has made a move; online games always count.
  const hhMoved = (s) => (s.round || 1) > 1 || (s.log || []).some((e) => e && e.who != null && s.players[e.who] && !s.players[e.who].ai);
  // Dino saves from before the moved flag existed keep showing.
  const dinoMoved = (d) => d.moved !== false;
  const BS = window.BoardSaves;
  const randomId = (prefix) => {
    const b = new Uint8Array(8);
    crypto.getRandomValues(b);
    return prefix + [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  };

  // Games saved before the shared save list existed (one per game, in this browser only) join the list.
  function adoptOldSaves() {
    if (!BS) return;
    const hh = read('ahrensHearthhold.v1');
    if (hh && hh.state && hh.state.phase !== 'over' && Array.isArray(hh.state.players) && (hh.mode === 'ai' || hh.mode === 'local') && hhMoved(hh.state)) {
      if (!hh.gid) {
        hh.gid = randomId('hl');
        try {
          localStorage.setItem('ahrensHearthhold.v1', JSON.stringify(hh));
        } catch {
          /* ignore */
        }
      }
      if (!BS.getLocal('hearthhold', hh.gid) && !BS.list('hearthhold').some((m) => m.id === hh.gid)) {
        BS.put('hearthhold', hh.gid, hh, { mode: hh.mode, level: hh.level, names: hh.state.players.map((p) => p.name), round: hh.state.round, rounds: 12, moved: true });
      }
    }
    const dino = read('ahrensDinoBoardGame.v1');
    if (dino && dino.v === 1 && Array.isArray(dino.queue) && !dino.sim && !dino.past && !(dino.queue[0] && dino.queue[0].t === 'gameOver') && Array.isArray(dino.players) && dinoMoved(dino)) {
      if (!dino.gid) {
        dino.gid = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
        try {
          localStorage.setItem('ahrensDinoBoardGame.v1', JSON.stringify(dino));
        } catch {
          /* ignore */
        }
      }
      if (!BS.getLocal('dino', dino.gid) && !BS.list('dino').some((m) => m.id === dino.gid)) {
        BS.put('dino', dino.gid, dino, { mode: dino.ai != null ? 'ai' : 'local', level: dino.aiCfg && dino.aiCfg.level, names: dino.players.map((p) => p.name), round: dino.round || 1, rounds: dino.proto ? 15 : 18, moved: true });
      }
    }
  }

  function savedItem(m) {
    const s = m.summary || {};
    const r = s.round || 1;
    const names = (s.names || []).join(' vs ');
    return {
      game: m.game,
      id: m.id,
      href: `${GAMES[m.game].page}?local=${encodeURIComponent(m.id)}`,
      who: s.mode === 'ai' ? `vs Computer${LEVELS[s.level] ? ` · ${LEVELS[s.level]}` : ''}` : `${names || 'Two players'} · same device`,
      note: m.game === 'hearthhold'
        ? `${SEASONS[(r - 1) % 4]}, year ${Math.floor((r - 1) / 4) + 1} · round ${r} of ${s.rounds || 12}`
        : `Round ${r}${s.rounds ? ` of ${s.rounds}` : ''}`,
      where: m.local === false ? 'cloud' : 'local',
      updatedAt: m.updatedAt || 0,
      removable: true,
    };
  }

  function localGames() {
    if (!BS) return [];
    return BS.list().filter((m) => GAMES[m.game] && (!m.summary || m.summary.moved !== false)).map(savedItem);
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
    const tag = it.where === 'online' ? '🌐 Online' : session() ? '☁️ Saved to your account' : '💾 This device';
    const x = it.removable ? `<button class="mg-x" data-remove="${esc(it.game)}" data-id="${esc(it.id)}" title="Remove this saved game" aria-label="Remove this saved game">✕</button>` : '';
    return `<div class="mg-item"><a class="mg-card${it.yours ? ' yours' : ''}" href="${it.href}">
      <img src="${G.img}" alt="" loading="lazy">
      <span class="mg-body">
        <span class="mg-game">${G.icon} ${G.name}<small>${tag}</small></span>
        <b class="mg-who">${esc(it.who)}</b>
        <span class="mg-state">${it.noteHtml || esc(it.note)}</span>
      </span>
      ${it.yours ? '<span class="mg-flag">Your move</span>' : ''}
    </a>${x}</div>`;
  }

  let lastOnline = [];
  let lastStatus = 'done';
  let lastItems = [];
  let dialog = null;
  function confirmRemove(it) {
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'mg-dialog';
      document.body.appendChild(dialog);
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close('cancel');
      });
      dialog.addEventListener('close', () => {
        const target = dialog.target;
        dialog.target = null;
        if (dialog.returnValue !== 'remove' || !target) return;
        BS.remove(target.game, target.id);
        render(lastOnline, lastStatus);
      });
    }
    const G = GAMES[it.game];
    dialog.target = { game: it.game, id: it.id };
    dialog.returnValue = '';
    dialog.innerHTML = `<form method="dialog">
      <h2>Remove this game?</h2>
      <div class="mg-dialog-game"><img src="${G.img}" alt=""><span><b>${G.icon} ${G.name}</b><span>${esc(it.who)}</span><small>${esc(it.note)}</small></span></div>
      <p>It will be gone from Your games${session() ? ' on all your devices' : ''}. This can’t be undone.</p>
      <div class="mg-dialog-btns"><button value="cancel" class="mg-keep" autofocus>Keep it</button><button value="remove" class="mg-remove">Remove game</button></div>
    </form>`;
    dialog.showModal();
  }
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove]');
    if (!b || !BS) return;
    e.preventDefault();
    const it = lastItems.find((x) => x.game === b.dataset.remove && x.id === b.dataset.id);
    if (it) confirmRemove(it);
  });

  function render(online, status) {
    lastOnline = online;
    lastStatus = status;
    const items = online.map(onlineItem).concat(localGames());
    lastItems = items;
    items.sort((a, b) => (b.yours ? 1 : 0) - (a.yours ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0));
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

  adoptOldSaves();
  const signedIn = !!session();
  let cached = [];
  try {
    cached = signedIn ? JSON.parse(sessionStorage.getItem(CACHE_KEY) || '[]') : [];
  } catch {
    cached = [];
  }
  render(cached, signedIn ? 'loading' : 'done');
  if (!signedIn) return;

  // Coming back to this tab picks up games removed or played on other devices (at most every 20s).
  let lastFetch = 0;
  const refresh = () => {
    if (!session() || Date.now() - lastFetch < 20000) return;
    lastFetch = Date.now();
    load();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
  addEventListener('focus', refresh);
  addEventListener('pageshow', (e) => {
    if (e.persisted) refresh();
  });
  lastFetch = Date.now();
  load();

  function load() {
    fetch(`${API_BASE}/api/board-games/current`, { headers: { Authorization: `Bearer ${session()}` } })
      .then((r) => {
        if (r.status === 401) return { games: [], signedOut: true };
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((data) => {
        const games = (data.games || []).filter((g) => GAMES[g.game]);
        if (BS && data.saves) BS.merge(data.saves);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(games));
        } catch {
          /* storage blocked */
        }
        cached = games;
        render(games, 'done');
      })
      .catch(() => render(cached, 'error'));
  }
})();
