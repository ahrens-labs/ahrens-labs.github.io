// Hearthhold — page UI. Rules live in hearthhold-engine.js.
(function () {
  'use strict';
  const E = window.HearthholdEngine;
  const SAVE_KEY = 'ahrensHearthhold.v1';
  const PREFS_KEY = 'ahrensHearthhold.prefs';
  const ONLINE_KEY = 'ahrensHearthhold.online';
  const ADMIN_EMAIL = 'calebahrens2011@gmail.com';
  const LEVEL_NAME = { easy: 'Easy', normal: 'Normal', hard: 'Hard', brutal: 'Brutal' };
  const LEVEL_HINT = {
    easy: 'Makes plenty of mistakes.',
    normal: 'A fair game.',
    hard: 'Plans further ahead, blocks your best spots, and starts with a few extra supplies.',
    brutal: 'Its best play, and a big head start of supplies.',
  };
  const SIM_SPEEDS = {
    turbo: { name: '⚡ Turbo', ai: 0, dusk: 350 },
    fast: { name: '⏩ Fast', ai: 160, dusk: 1600 },
    watch: { name: '👀 Watch', ai: 850, dusk: 4500 },
  };
  const API_BASE = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
  const IMG = (k) => `/img/hearthhold/${k}.webp`;
  const S = 38;
  const SQ3 = Math.sqrt(3);
  // Distance from the village centre to the wall faces / corners; set per game by sizeBoard().
  let FACE = 4.4 * S;
  let RAD = FACE / Math.cos(Math.PI / 6);
  function sizeBoard(s) {
    FACE = (E.mapRings(s) * SQ3 + 0.94) * S;
    RAD = FACE / Math.cos(Math.PI / 6);
    const w = FACE + 91;
    const h = FACE + 73;
    $('#svg').setAttribute('viewBox', `${(-w).toFixed(0)} ${(-h).toFixed(0)} ${(2 * w).toFixed(0)} ${(2 * h).toFixed(0)}`);
  }
  const SMOKY = ['keep', 'house', 'inn', 'bakery', 'smithy', 'workshop'];
  const PCOLOR = ['#e05a4f', '#3f8fd8'];

  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  let G = null; // { state, mode: 'ai' | 'local' | 'online', level, view } — online adds { id, me, version, status, result }
  const ui = { pick: null, boardSig: '', fresh: new Set(), freshSide: null, aiTimer: null, modal: false, rulesTab: 'basics' };

  // ---------------------------------------------------------------- persistence
  function save() {
    if (G && G.mode === 'sim') return;
    try {
      if (G && G.mode === 'online') localStorage.setItem(ONLINE_KEY, JSON.stringify({ id: G.id, revealed: !!G.revealed, duskSeen: G.duskSeen || 0 }));
      else localStorage.setItem(SAVE_KEY, JSON.stringify(G));
    } catch (e) {
      /* storage full or blocked: the game still works, it just won't resume */
    }
    keepInSaves();
  }
  // Local games also go to the shared save list (and the account), so several can be kept and resumed anywhere.
  const playerMoved = (s) => s.round > 1 || (s.log || []).some((l) => l && l.who != null && s.players[l.who] && !s.players[l.who].ai);
  function keepInSaves() {
    const BS = window.BoardSaves;
    if (!BS || !G || (G.mode !== 'ai' && G.mode !== 'local')) return;
    G.gid = G.gid || newLocalId();
    const s = G.state;
    if (s.phase === 'over') {
      if (BS.list('hearthhold').some((m) => m.id === G.gid)) BS.remove('hearthhold', G.gid);
      return;
    }
    if (!playerMoved(s)) return;
    BS.put('hearthhold', G.gid, G, { mode: G.mode, level: G.level, names: s.players.map((p) => p.name), round: s.round, rounds: E.ROUNDS, moved: true });
  }
  const validSave = (g) => g && g.state && g.state.v >= 2 && g.state.v <= E.SAVE_V && (g.mode === 'ai' || g.mode === 'local');
  // The last game played here may since have been removed, or played further on another device.
  const lastStatus = (gid) => (gid && window.BoardSaves ? window.BoardSaves.status('hearthhold', gid) : 'here');
  const lastGid = () => {
    try {
      return (JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') || {}).gid || null;
    } catch (e) {
      return null;
    }
  };
  function loadSave() {
    try {
      const g = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!g || !g.state || g.state.v < 2 || g.state.v > E.SAVE_V) return null;
      return lastStatus(g.gid) === 'here' ? g : null;
    } catch (e) {
      return null;
    }
  }
  function prefs() {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }
  function savePrefs(p) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch (e) {
      /* ignore */
    }
  }

  // ---------------------------------------------------------------- small helpers
  const st = () => G.state;
  const me = () => st().players[G.view];
  const season = () => E.seasonOf(st().round);
  const tonight = () => st().threats[st().round - 1];
  const humanTurn = () => st().phase === 'act' && !st().players[st().turn].ai;
  const myTurnHere = () => humanTurn() && st().turn === G.view && (G.mode !== 'online' || G.view === G.me);
  // May the viewer move villagers in the village on screen right now?
  const canManage = () => st().phase === 'act' && !me().ai && (G.mode === 'local' ? st().turn === G.view : G.mode === 'online' ? G.view === G.me && G.status === 'active' : true);
  function cost(c, p) {
    const parts = E.RES.filter((r) => c && c[r]).map((r) => {
      const short = p && p.res[r] < c[r];
      return `<span class="cost${short ? ' short' : ''}">${E.RES_ICON[r]}${c[r]}</span>`;
    });
    return parts.join(' ') || '<span class="cost">free</span>';
  }
  function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many || one + 's'}`;
  }
  function sideName(i) {
    return E.SIDES[i].name.toLowerCase();
  }
  function toast(html, kind) {
    const root = $('#toasts');
    if (!root) return;
    const t = document.createElement('div');
    t.className = `toast ${kind || ''}`;
    t.innerHTML = html;
    root.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3000);
  }

  // ---------------------------------------------------------------- modal
  function openModal(html, opts) {
    opts = opts || {};
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-back${opts.cls ? ' ' + opts.cls : ''}"><div class="modal" role="dialog" aria-modal="true">${opts.noClose ? '' : '<button class="modal-x" data-close aria-label="Close">✕</button>'}${html}</div></div>`;
    ui.modal = true;
    ui.onClose = opts.onClose || null;
    const back = root.firstChild;
    back.addEventListener('click', (e) => {
      if ((e.target === back && !opts.noClose) || e.target.closest('[data-close]')) closeModal();
    });
    return back;
  }
  function closeModal() {
    const root = $('#modal-root');
    if (!root.firstChild) return;
    root.innerHTML = '';
    ui.modal = false;
    const cb = ui.onClose;
    ui.onClose = null;
    if (cb) cb();
    else scheduleAI();
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (ui.modal && !$('.modal-back.locked')) closeModal();
    else if (ui.pick) {
      ui.pick = null;
      render();
    }
  });

  // ---------------------------------------------------------------- setup screen
  function showSetup(focusGame) {
    clearTimeout(ui.aiTimer);
    stopOnline();
    G = null;
    if (history.replaceState && location.search) history.replaceState(null, '', location.pathname);
    const pr = prefs();
    const saved = loadSave();
    const canResume = saved && saved.state.phase !== 'over';
    document.body.className = 'setup-mode';
    $('#app').innerHTML = `
      <div class="setup gh">
        <div class="gh-top"><a class="gh-lobby" href="/board-games.html" title="Back to the game lobby">← 🎲 Game lobby</a></div>
        <div class="gh-hero">
          <img src="${IMG('cover')}" alt="" class="gh-hero-img">
          <div class="gh-shade"></div>
          <div class="hero-particles" aria-hidden="true">${particles('autumn', 10)}</div>
          <div class="gh-title">
            <h1 class="display">Oakhaven</h1>
            <p>Raise a village. Keep its people fed, warm and housed. Hold the walls when the dragons come.</p>
          </div>
        </div>
        <div class="setup-card gh-card panel">
          ${canResume ? `<div class="gh-resume"><div><b>Game in progress</b><span>${esc(saved.state.players.map((p) => p.name).join(' vs '))} · ${E.SEASON[E.seasonOf(saved.state.round)].name}, year ${E.yearOf(saved.state.round)}</span>${window.BoardSaves && window.BoardSaves.list('hearthhold').length > 1 ? '<a class="gh-more" href="/board-games.html#my-games">All your saved games →</a>' : ''}</div><button class="btn" id="resume">Continue</button></div>` : ''}
          <h2>New game</h2>
          <div class="gh-modes" id="mode">
            <button data-v="ai" class="gh-mode ${pr.mode !== 'local' && pr.mode !== 'online' ? 'on' : ''}"><span>🤖</span><b>Computer</b><small>You build one village</small></button>
            <button data-v="local" class="gh-mode ${pr.mode === 'local' ? 'on' : ''}"><span>👥</span><b>Two players</b><small>Share this device</small></button>
            <button data-v="online" class="gh-mode ${pr.mode === 'online' ? 'on' : ''}"><span>🌐</span><b>Online</b><small>Challenge a friend</small></button>
          </div>
          <div class="online-only" id="online-box"></div>
          <div class="field names offline-only">
            <label><span class="label">Your village</span><input id="n0" maxlength="18" value="${esc(pr.n0 || 'Oakvale')}"></label>
            <label class="local-only"><span class="label">Second village</span><input id="n1" maxlength="18" value="${esc(pr.n1 || 'Stonebrook')}"></label>
          </div>
          <div class="field ai-only offline-only">
            <span class="label">Difficulty</span>
            <div class="seg" id="level">
              ${Object.keys(LEVEL_NAME).map((l) => `<button data-v="${l}" class="${(pr.level || 'normal') === l ? 'on' : ''}" title="${esc(LEVEL_HINT[l])}">${LEVEL_NAME[l]}</button>`).join('')}
            </div>
          </div>
          <div class="field offline-only">
            <span class="label">Who starts?</span>
            <div class="seg" id="first">
              <button data-v="0" class="on">First village</button>
              <button data-v="1">Second village</button>
              <button data-v="r">🎲 Random</button>
            </div>
          </div>
          <button class="btn big offline-only" id="start">Start game</button>
          <div class="gh-links">
            <button class="btn ghost sm" id="how">📜 How to play</button>
            <button class="btn ghost sm" id="hist">🏆 Game history</button>
            ${isAdmin() ? '<button class="btn ghost sm" id="sim">🧪 Computer vs computer</button>' : ''}
          </div>
        </div>
      </div>`;
    const setMode = (m) => {
      $('.setup').classList.toggle('is-local', m === 'local');
      $('.setup').classList.toggle('is-online', m === 'online');
      if (m === 'online') showLobby(focusGame);
      $('#first').children[0].textContent = m === 'local' ? 'First village' : 'Me';
      $('#first').children[1].textContent = m === 'local' ? 'Second village' : 'Computer';
    };
    $('.setup').addEventListener('click', (e) => {
      const b = e.target.closest('.seg button, .gh-modes button');
      if (!b) return;
      [...b.parentNode.children].forEach((x) => x.classList.toggle('on', x === b));
      if (b.parentNode.id === 'mode') {
        savePrefs(Object.assign(prefs(), { mode: b.dataset.v }));
        setMode(b.dataset.v);
      }
    });
    setMode(focusGame ? 'online' : pr.mode === 'local' || pr.mode === 'online' ? pr.mode : 'ai');
    if (focusGame) [...$('#mode').children].forEach((x) => x.classList.toggle('on', x.dataset.v === 'online'));
    $('#how').onclick = () => showRules();
    $('#hist').onclick = () => showHistory();
    if ($('#sim')) $('#sim').onclick = openSimSetup;
    if (canResume) $('#resume').onclick = () => {
      forgetOnline();
      startFrom(saved);
    };
    $('#start').onclick = () => {
      const pick = (id) => $(`#${id} .on`).dataset.v;
      const mode = pick('mode');
      if (mode === 'online') return;
      const level = pick('level');
      let first = pick('first');
      first = first === 'r' ? (Math.random() < 0.5 ? 0 : 1) : +first;
      const n0 = $('#n0').value.trim() || 'Oakvale';
      const n1 = mode === 'local' ? $('#n1').value.trim() || 'Stonebrook' : 'Computer';
      savePrefs({ mode, level, n0, n1: $('#n1').value.trim() || 'Stonebrook' });
      forgetOnline();
      const state = E.newGame({ names: [n0, n1], ai: [false, mode === 'ai'], first });
      if (mode === 'ai') E.aiHeadStart(state, 1, level);
      startFrom({ state, mode, level, view: mode === 'local' ? state.turn : 0, gid: newLocalId() });
    };
  }

  function startFrom(g) {
    G = g;
    ui.pick = null;
    ui.boardSig = '';
    ui.fresh.clear();
    document.body.className = '';
    buildShell();
    save();
    render();
    if (G.mode === 'online') connectSock();
    if (G.mode === 'online' && st().dusk && st().dusk.round > (G.duskSeen || 0)) showOnlineDusk();
    else if (G.dusk) showDusk(G.dusk.rep, G.dusk.arrived);
    else if (st().phase === 'over') showGameOver(!!G.revealed);
    else if (st().phase === 'dusk') runDusk();
    else {
      seasonBanner();
      scheduleAI();
    }
  }

  // ---------------------------------------------------------------- game shell
  function buildShell() {
    $('#app').innerHTML = `
      <header class="topbar">
        <div class="brand">
          <img src="${IMG('keep')}" alt="" class="brand-logo">
          <div><h1>Oakhaven</h1><small id="subtitle"></small></div>
        </div>
        <div class="top-mid">
          <div class="tracker" id="tracker"></div>
          <div class="turn-banner" id="banner"></div>
        </div>
        <div class="top-actions">
          <button class="btn ghost sm" id="rules-btn">📜 Rules</button>
          ${G && G.mode === 'sim' ? '<button class="btn ghost sm" id="sim-speed"></button>' : ''}
          <button class="btn ghost sm" id="new-btn">${G && G.mode === 'online' ? '🌐 Game' : G && G.mode === 'sim' ? '⏹ Stop' : '🏰 New game'}</button>
          <a class="btn ghost sm" href="/board-games.html" title="All board games" aria-label="All board games">🎲</a>
        </div>
      </header>
      <section class="threats" id="threats"></section>
      <section class="locs panel" id="locs"></section>
      <main class="layout">
        <section class="board-wrap">
          <div class="board-tabs" id="tabs"></div>
          <div class="board" id="board"><svg id="svg" viewBox="-258 -240 516 480" role="img" aria-label="Village map"></svg><div class="particles" id="particles"></div></div>
          <div class="pickbar" id="pickbar"></div>
        </section>
        <aside class="side">
          <div class="panel" id="res"></div>
          <div class="panel event-panel" id="event" hidden></div>
          <div class="panel" id="actions"></div>
          <div class="panel goals-panel" id="goals" hidden></div>
        </aside>
      </main>
      <section class="panel" id="row"></section>
      <section class="lower">
        <div class="panel" id="people"></div>
        <div class="panel" id="log"></div>
      </section>`;
    $('#rules-btn').onclick = () => showRules();
    $('#new-btn').onclick = newGame;
    if ($('#sim-speed')) {
      const paint = () => ($('#sim-speed').textContent = SIM_SPEEDS[G.speed].name);
      paint();
      $('#sim-speed').onclick = () => {
        const keys = Object.keys(SIM_SPEEDS);
        G.speed = keys[(keys.indexOf(G.speed) + 1) % keys.length];
        paint();
        scheduleAI();
      };
    }
    $('#svg').addEventListener('click', onBoardClick);
    $('#app').addEventListener('click', onAppClick);
  }

  function render() {
    if (!G) return;
    renderTop();
    renderThreats();
    renderTabs();
    renderBoard();
    renderPickbar();
    renderLocs();
    renderRes();
    renderEvent();
    renderActions();
    renderGoals();
    renderRow();
    renderPeople();
    renderLog();
  }

  function renderTop() {
    const s = st();
    const se = E.SEASON[season()];
    $('#subtitle').textContent = `${se.icon} ${se.name}, year ${E.yearOf(s.round)} · round ${s.round} of ${E.ROUNDS}`;
    let pips = '';
    for (let r = 1; r <= E.ROUNDS; r++) {
      const cls = r < s.round ? 'done' : r === s.round ? 'now' : '';
      const sea = E.SEASON[E.seasonOf(r)];
      const ev = r <= s.round && s.events && E.EVENTS[s.events[r - 1]] ? s.events[r - 1] : null;
      const evTitle = ev ? ` · event: ${E.EVENTS[ev].name}` : '';
      pips += `${r > 1 && (r - 1) % 4 === 0 ? '<span class="yr-gap"></span>' : ''}<span class="pip ${cls}${ev ? ' ev' : ''}" title="${sea.name}, year ${E.yearOf(r)}${esc(evTitle)}">${sea.icon}</span>`;
    }
    $('#tracker').innerHTML = pips;
    let b;
    if (s.phase === 'over' || (G.mode === 'online' && G.status !== 'active')) b = '<b>The game is over</b>';
    else {
      const p = s.players[s.turn];
      const dots = s.players
        .map((q, i) => `<span class="who" style="--pc:${PCOLOR[i]}" title="Workers left"><i></i>${esc(q.name)} ${q.done ? '<small>done</small>' : '🧍'.repeat(Math.max(0, q.workers)) || '<small>no workers</small>'}</span>`)
        .join('');
      const what = p.workers > 0 ? `${plural(p.workers, 'worker')} to place` : 'free actions, then End round';
      b = p.ai
        ? `<b class="thinking">${esc(p.name)} is thinking<span class="dots"><i>.</i><i>.</i><i>.</i></span></b>${dots}`
        : `<b style="--pc:${PCOLOR[s.turn]}" class="turn-name">${turnLabel(p)}</b><span class="acts">${what}</span>${dots}`;
    }
    if (G.mode === 'online' && G.gmode === 'quick' && G.status === 'active' && G.deadline) b += '<span class="ol-clock" id="ol-clock"></span>';
    $('#banner').innerHTML = b;
    tickClock();
  }
  function turnLabel(p) {
    if (G.mode === 'online') return st().turn === G.me ? 'Your turn' : `${esc(p.name)}’s turn`;
    return G.mode === 'ai' ? 'Your turn' : `${esc(p.name)}’s turn`;
  }

  // ---------------------------------------------------------------- threats
  function renderThreats() {
    const s = st();
    const p = me();
    const when = ['Tonight', 'Next round', 'In 2 rounds'];
    const list = E.threatsFor(s, G.view, 3);
    const hint = E.newRules(s) ? '<span class="muted th-hint">🔭 A Watchtower shows where the next creature attacks; an Archer in it shows the one after.</span>' : '';
    $('#threats').innerHTML =
      `<div class="threats-head"><h3>Threats</h3><span class="muted">${plural(Math.max(0, E.ROUNDS - s.round), 'more creature')} after tonight</span>${hint}</div>` +
      list
        .map((t, j) => {
          const sea = E.SEASON[E.seasonOf(s.round + j)].icon;
          if (!t.k) {
            return `<div class="threat unknown tier${t.tier}">
              <div class="th-when">${when[j]} · ${sea}</div>
              <div class="th-art"><span class="th-q">?</span></div>
              <div class="th-body">
                <div class="th-name">An unknown creature <span class="th-str" title="Strength">${strRange(t.tier)}</span></div>
                <div class="th-kind">${t.kind === 'fly' ? '🪽 Flies over walls' : '⬆ Comes on foot, side unknown'}</div>
                <div class="th-out"><span class="muted">Year ${t.tier} creature. Put an Archer in a Watchtower to see it sooner.</span></div>
              </div>
            </div>`;
          }
          const B = E.BEAST[t.k];
          const bt = E.beastText(t.k);
          const hidden = t.side === -1;
          let defTxt;
          if (hidden) {
            const ds = [0, 1, 2, 3, 4, 5].map((sd) => E.defense(p, t.k, sd, j > 0));
            const lo = Math.min(...ds);
            const hi = Math.max(...ds);
            const ok = lo >= B.str;
            defTxt = `<div class="th-def ${ok ? 'ok' : hi >= B.str ? 'maybe' : 'bad'}">${esc(p.name)}: 🛡️${lo === hi ? lo : `${lo}–${hi}`} ${ok ? '✓ holds on every side' : hi >= B.str ? '≈ depends on the side' : `✗ short by ${B.str - hi}+`}</div>`;
          } else {
            const d = E.defense(p, t.k, t.side, j > 0);
            const ok = d >= B.str;
            defTxt = `<div class="th-def ${ok ? 'ok' : 'bad'}">${esc(p.name)}: 🛡️${d} ${ok ? '✓ holds' : `✗ short by ${B.str - d}`}</div>`;
          }
          const kind = B.kind === 'fly' ? '🪽 Flies over walls' : hidden ? '⬆ Side unknown — 🔭 a Watchtower shows it' : `⬆ Hits the ${sideName(t.side)} side`;
          return `<div class="threat${j === 0 ? ' tonight' : ''} tier${B.tier}" data-beast="${t.k}">
            <div class="th-when">${when[j]} · ${sea}</div>
            <div class="th-art"><img src="${IMG(t.k)}" alt=""></div>
            <div class="th-body">
              <div class="th-name">${esc(B.name)} <span class="th-str" title="Strength">⚔️${B.str}</span></div>
              <div class="th-kind">${kind}${B.undead ? ' · 💀 Undead' : ''}</div>
              ${defTxt}
              <div class="th-out"><span class="win">Win: ${bt.win}</span><span class="lose">If not: ${bt.lose}</span></div>
            </div>
          </div>`;
        })
        .join('');
  }

  // ---------------------------------------------------------------- board
  function renderTabs() {
    const s = st();
    $('#tabs').innerHTML = s.players
      .map((p, i) => {
        return `<button class="tab${G.view === i ? ' on' : ''}" data-view="${i}" style="--pc:${PCOLOR[i]}"><i></i>${esc(p.name)}${(G.mode === 'ai' && !p.ai) || (G.mode === 'online' && i === G.me) ? ' (you)' : ''}</button>`;
      })
      .join('');
  }

  function cellXY(i) {
    const c = E.CELLS[i];
    return [S * SQ3 * (c.q + c.r / 2), S * 1.5 * c.r];
  }
  function hexPoints(x, y, s) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      pts.push(`${(x + s * Math.cos(a)).toFixed(1)},${(y + s * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(' ');
  }
  function polar(deg, r) {
    const a = (deg * Math.PI) / 180;
    return [r * Math.cos(a), -r * Math.sin(a)];
  }
  function sidePoints(i, r) {
    const a = E.SIDES[i].ang;
    return [polar(a - 30, r), polar(a + 30, r)];
  }

  const DECOR = {
    forest: [['🌲', -13, -2, 17], ['🌲', 11, -7, 15], ['🌲', 1, 13, 16]],
    hills: [['⛰️', -4, 6, 22], ['🪨', 14, 12, 10]],
    mountain: [['🏔️', 0, 8, 28]],
    meadow: [['🌼', -12, -6, 10], ['🌷', 10, 10, 10], ['🌱', 12, -12, 9]],
    plains: [['🌾', -10, 10, 11], ['🌿', 12, -4, 9]],
  };

  function renderBoard() {
    const s = st();
    const p = me();
    const thr = tonight();
    const sig = JSON.stringify([G.view, p.bld, p.walls, p.bows, p.vil, p.castle, p.flags && p.flags.site, p.flags && p.flags.siteCastle, p.flags && p.flags.busy, p.flags && p.flags.by, ui.pick, s.round, s.phase, s.turn === G.view, [...ui.fresh], ui.freshSide]);
    if (sig === ui.boardSig) return;
    ui.boardSig = sig;
    sizeBoard(s);
    const board = $('#board');
    board.className = `board season-${season()}${ui.pick ? ' picking' : ''}`;
    board.style.setProperty('--pc', PCOLOR[G.view]);
    const at = {};
    p.bld.forEach((b) => (at[b.cell] = b));
    const pick = ui.pick;
    const okCells = pick && pick.t === 'build' ? new Set(E.freeCells(s, p, pick.b)) : null;

    let h = `<defs>
      <radialGradient id="g-plains"><stop offset="0" stop-color="#e8d9a0"/><stop offset="1" stop-color="#cdb575"/></radialGradient>
      <radialGradient id="g-meadow"><stop offset="0" stop-color="#b8e08a"/><stop offset="1" stop-color="#86c25c"/></radialGradient>
      <radialGradient id="g-forest"><stop offset="0" stop-color="#5fa058"/><stop offset="1" stop-color="#36723c"/></radialGradient>
      <radialGradient id="g-hills"><stop offset="0" stop-color="#cdb68c"/><stop offset="1" stop-color="#a48d63"/></radialGradient>
      <radialGradient id="g-mountain"><stop offset="0" stop-color="#b2bac3"/><stop offset="1" stop-color="#7d8792"/></radialGradient>
      <radialGradient id="g-ground"><stop offset="0" stop-color="#9ccf73"/><stop offset="0.8" stop-color="#6ea64d"/><stop offset="1" stop-color="#4f8a38"/></radialGradient>
      <clipPath id="clip-b"><circle r="${S * 0.72}"/></clipPath>
      <clipPath id="clip-v"><circle r="8"/></clipPath>
      <clipPath id="clip-t"><circle r="21"/></clipPath>
      <pattern id="p-site" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(45)"><rect width="6" height="12" fill="rgba(255,193,7,.55)"/><rect x="6" width="6" height="12" fill="rgba(33,33,33,.35)"/></pattern>
    </defs>`;
    // ground and the ring road
    const big = [0, 60, 120, 180, 240, 300].map((a) => polar(a, RAD + 10).map((n) => n.toFixed(1)).join(',')).join(' ');
    h += `<polygon class="ground" points="${big}" fill="url(#g-ground)"/>`;
    h += `<polygon class="road" points="${[0, 60, 120, 180, 240, 300].map((a) => polar(a, RAD - 4).map((n) => n.toFixed(1)).join(',')).join(' ')}"/>`;
    // cells
    E.CELLS.forEach((c, i) => {
      if (i >= s.terrain.length) return;
      const [x, y] = cellXY(i);
      const t = s.terrain[i];
      const b = at[i];
      const can = okCells && okCells.has(i);
      h += `<g class="cell t-${t}${can ? ' can' : ''}${okCells && !can ? ' dim' : ''}" data-cell="${i}">`;
      h += `<polygon class="hex" points="${hexPoints(x, y, S - 1.5)}" fill="url(#g-${t})"/>`;
      if (!b) {
        DECOR[t].forEach(([e, dx, dy, fs], k) => {
          h += `<text class="decor d-${t}" x="${x + dx}" y="${y + dy}" font-size="${fs}" style="animation-delay:${-((i * 7 + k * 3) % 10) / 3}s">${e}</text>`;
        });
      }
      if (can) h += `<polygon class="can-ring" points="${hexPoints(x, y, S - 4)}"/><image class="ghost-img" href="${IMG(pick.b)}" x="${x - S * 0.6}" y="${y - S * 0.6}" width="${S * 1.2}" height="${S * 1.2}"/>`;
      if (can && E.RANGE[pick.b] && p.rules >= 3) {
        const cov = [0, 1, 2, 3, 4, 5].filter((sd) => E.sideDepth(i, sd) <= E.RANGE[pick.b]).map((sd) => E.SIDES[sd].k);
        h += `<text class="cover-tag" x="${x}" y="${y + S * 0.78}">🛡️${cov.join('·')}</text>`;
      }
      h += '</g>';
      if (b) h += buildingSvg(p, b, x, y);
    });
    // walls
    for (let i = 0; i < 6; i++) {
      const [a, b] = sidePoints(i, RAD);
      const lvl = p.walls[i];
      const fresh = ui.freshSide === i ? ' fresh' : '';
      const line = `x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}"`;
      if (lvl === 0) h += `<line class="wall w0" ${line}/>`;
      if (lvl === 1) h += `<g class="wall w1${fresh}"><line class="w1-base" ${line}/><line class="w1-stakes" ${line}/></g>`;
      if (lvl === 2) h += `<g class="wall w2${fresh}"><line class="w2-base" ${line}/><line class="w2-top" ${line}/></g>`;
      if (lvl === 3) h += `<g class="wall w3${fresh}"><line class="w3-base" ${line}/><line class="w3-top" ${line}/></g>`;
      const [lx, ly] = polar(E.SIDES[i].ang, FACE + 18);
      const [tx, ty] = polar(E.SIDES[i].ang + 19, FACE + 14);
      if (lvl) h += `<text class="wall-tag" x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}">🛡️${E.WALL[lvl].def}</text>`;
      if (E.hasBow(p, i)) {
        const [bx, by] = polar(E.SIDES[i].ang - 19, FACE + 14);
        h += `<text class="bow-tag${fresh}" x="${bx.toFixed(1)}" y="${(by + 4).toFixed(1)}"><title>Crossbow: 🛡️${E.BOW.def} against flyers on this side</title>🏹${E.BOW.def}</text>`;
      }
      if (pick && pick.t === 'masons') {
        const first = E.masonFirst(s, p);
        const open = E.masonChoices(s, p).includes(i);
        const after = lvl + (i === first ? 1 : 0);
        const label = open ? `${i === first ? 'Tonight ✓ + ' : ''}${after ? 'Stone' : 'Palisade'}` : i === first ? 'Tonight ✓' : 'Stone ✓';
        const [mx, my] = i === first ? polar(E.SIDES[i].ang, FACE - 22) : [lx, ly];
        h += `<g class="side-pick${open ? '' : ' maxed'}${i === first ? ' mason-first' : ''}" data-side="${i}"><line class="side-hit" ${line}/>`;
        h += `<text class="side-cost" x="${mx.toFixed(1)}" y="${(my + 4).toFixed(1)}">${label}</text></g>`;
      }
      if (pick && pick.t === 'wall') {
        const c = E.wallCost(p, i);
        h += `<g class="side-pick${c ? '' : ' maxed'}" data-side="${i}"><line class="side-hit" ${line}/>`;
        h += `<text class="side-cost" x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}">${c ? `${E.WALL[lvl + 1].name.replace(' wall', '')} ${E.costText(c)}` : 'Iron ✓'}</text></g>`;
      }
      if (pick && pick.t === 'bow') {
        const why = E.bowBlock(s, p, i);
        const label = !why ? `🏹 ${E.costText(E.BOW.cost)}` : E.hasBow(p, i) ? '🏹 ✓' : 'needs a wall';
        h += `<g class="side-pick${why ? ' maxed' : ''}" data-side="${i}"><line class="side-hit" ${line}/>`;
        h += `<text class="side-cost" x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}">${label}</text></g>`;
      }
    }
    // tonight's creature
    if (thr && s.phase !== 'over') {
      const B = E.BEAST[thr.k];
      if (B.kind === 'fly' && thr.side == null) {
        h += `<g class="foe fly" transform="translate(${(RAD * 0.8).toFixed(1)},${(-RAD * 0.84).toFixed(1)})"><g class="foe-bob">${foeToken(thr.k, B.str)}</g></g>`;
      } else {
        const ang = E.SIDES[thr.side].ang;
        const [fx, fy] = polar(ang, FACE + 42);
        const [ax, ay] = polar(ang, FACE + 18);
        h += `<g class="foe" transform="translate(${fx.toFixed(1)},${fy.toFixed(1)})"><g class="foe-bob">${foeToken(thr.k, B.str)}</g></g>`;
        h += `<g transform="translate(${ax.toFixed(1)},${ay.toFixed(1)}) rotate(${-ang + 180})"><path class="foe-arrow" d="M-9,-7 L4,0 L-9,7 Z"/></g>`;
      }
    }
    if (season() === 'winter') h += `<polygon class="frost" points="${big}"/>`;
    $('#svg').innerHTML = h;
    $('#particles').innerHTML = particles(season(), 14);
    ui.fresh.clear();
    ui.freshSide = null;
  }

  function foeToken(k, str) {
    return `<circle r="23" class="foe-ring"/><image href="${IMG(k)}" x="-25" y="-25" width="50" height="50" clip-path="url(#clip-t)"/><g transform="translate(17,17)"><circle r="12" class="foe-badge"/><text class="foe-str" y="4">${str}</text></g>`;
  }

  // Who is building this site this round (builders are off their usual job until next season).
  function builderOf(p, b) {
    const by = (p.flags && p.flags.by) || {};
    const id = by[b.b === 'keep' ? 'castle' : b.id];
    return id == null ? null : p.vil.find((v) => v.id === id) || null;
  }
  function siteName(p, v) {
    const by = (p.flags && p.flags.by) || {};
    const k = Object.keys(by).find((x) => by[x] === v.id);
    if (k == null) return null;
    if (k === 'castle') return 'Castle';
    const b = p.bld.find((x) => String(x.id) === k);
    return b ? E.BUILD[b.b].name : null;
  }
  // Built this round, so it does nothing until next season.
  function underConstruction(p, b) {
    if (st().phase === 'over') return false;
    return b.b === 'keep' ? p.castle && !E.castleReady(p) : !E.ready(p, b);
  }
  function buildingSvg(p, b, x, y) {
    const B = E.BUILD[b.b];
    const k = b.b === 'keep' && p.castle ? 'castle' : b.b;
    const occ = E.occupants(p, b.id);
    const slots = E.slotsOf(b.b);
    const site = underConstruction(p, b);
    const worked = !slots || occ.some((v) => E.canWork(v.k, b.b));
    const r = S * 0.78;
    // Position lives on an outer group: the drop-in animation's CSS transform would replace an SVG transform attribute.
    let h = `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><g class="bld b-${b.b}${ui.fresh.has(b.id) ? ' fresh' : ''}${worked || site ? '' : ' unstaffed'}${site ? ' site' : ''}" data-cell="${b.cell}" data-bld="${b.id}">`;
    h += `<title>${esc(bldTitle(p, b))}</title>`;
    h += `<circle r="${r}" class="bld-bg" fill="${B.color}"/>`;
    h += `<image href="${IMG(k)}" x="${-S * 0.95}" y="${-S * 0.95}" width="${S * 1.9}" height="${S * 1.9}" clip-path="url(#clip-b)" preserveAspectRatio="xMidYMid slice"/>`;
    h += `<circle r="${S * 0.72}" class="bld-ring"/>`;
    if (b.b === 'keep') h += `<g class="flag" transform="translate(${S * 0.42},${-S * 0.98})"><line y1="0" y2="16" class="pole"/><path class="pennant" d="M0,0 L15,4 L0,8 Z" fill="${PCOLOR[st().players.indexOf(p)]}"/></g>`;
    if (SMOKY.includes(b.b)) h += `<g class="smoke" transform="translate(${S * 0.3},${-S * 0.62})"><circle r="3.5"/><circle r="4.5"/><circle r="5.5"/></g>`;
    if (b.b === 'well' && !site) h += `<circle r="${S * 0.72}" class="shimmer"/>`;
    if (site) {
      h += `<circle r="${S * 0.72}" class="site-hatch" fill="url(#p-site)"/><circle r="${S * 0.72}" class="site-ring"/>`;
      h += `<g class="site-tag" transform="translate(0,${(-S * 0.18).toFixed(1)})"><rect x="-27" y="-9" width="54" height="17" rx="8.5"/><text y="4">🚧 Building</text></g>`;
      const bv = builderOf(p, b);
      if (bv && !occ.includes(bv)) h += `<g class="site-builder" transform="translate(0,${(-S * 0.62).toFixed(1)})"><circle r="10.5" class="slot full"/><image href="${IMG(bv.k)}" x="-12" y="-12" width="24" height="24" clip-path="url(#clip-v)"/><g transform="translate(9,-8)"><circle r="7" class="away-badge"/><text class="away-ico" y="3.5">🔨</text></g></g>`;
    }
    if (slots) {
      for (let j = 0; j < slots; j++) {
        const vx = (j - (slots - 1) / 2) * 18;
        const vy = S * 0.64;
        const v = occ[j];
        h += `<g transform="translate(${vx},${vy})">`;
        // Someone already in the slot of the site they're building is shown once, with the hammer, not greyed out.
        const onSite = v && site && builderOf(p, b) === v;
        const away = v && E.busy(p, v) && !onSite;
        h += v ? `<g class="${away ? 'away' : ''}"><circle r="9.5" class="slot full${E.canWork(v.k, b.b) === 'spec' ? ' spec' : ''}"/><image href="${IMG(v.k)}" x="-11" y="-11" width="22" height="22" clip-path="url(#clip-v)"/></g>${away || onSite ? '<g transform="translate(8,-8)"><circle r="6.5" class="away-badge"/><text class="away-ico" y="3">🔨</text></g>' : ''}` : '<circle r="8.5" class="slot empty"/><text class="slot-q" y="4">+</text>';
        h += '</g>';
      }
    }
    h += '</g></g>';
    return h;
  }
  function bldTitle(p, b) {
    const B = E.BUILD[b.b];
    const pr = E.production(p, season()).by[b.id];
    let t = `${B.name}${b.b === 'keep' && p.castle ? ' (Castle)' : ''}`;
    if (underConstruction(p, b)) {
      const bv = builderOf(p, b);
      return `${t} — 🚧 under construction${bv ? ` (your ${E.VIL[bv.k].name} is building it)` : ''}, ready next season`;
    }
    const away = E.occupants(p, b.id).filter((v) => E.busy(p, v));
    if (away.length) t += ` — 🔨 ${away.map((v) => E.VIL[v.k].name).join(', ')} off building, not working here tonight`;
    if (pr) t += ` — makes ${Object.entries(pr).map(([r, n]) => (r === 'forge' ? '⚒️ arms' : `${r === 'renown' ? '⭐' : E.RES_ICON[r]}${n}`)).join(' ')} this round`;
    return t;
  }

  function particles(sea, n) {
    const set = { spring: ['🌸', '🌸', '🌼'], summer: ['✨', '🦋', '✨'], autumn: ['🍂', '🍁', '🍂'], winter: ['❄️', '❄️', '❅'] }[sea] || ['✨'];
    let h = '';
    for (let i = 0; i < n; i++) {
      const left = (i * 37 + 11) % 100;
      const dur = 7 + ((i * 13) % 7);
      const delay = -((i * 29) % 70) / 10;
      const size = 0.7 + ((i * 7) % 5) / 10;
      h += `<span class="pt pt-${sea}" style="left:${left}%;animation-duration:${dur}s;animation-delay:${delay}s;font-size:${size}rem">${set[i % set.length]}</span>`;
    }
    return h;
  }

  function renderPickbar() {
    const bar = $('#pickbar');
    const pk = ui.pick;
    if (!pk) {
      bar.innerHTML = '';
      bar.className = 'pickbar';
      return;
    }
    bar.className = 'pickbar on';
    const p = me();
    const first = pk.t === 'masons' ? E.masonFirst(st(), p) : null;
    const msg = pk.t === 'masons'
      ? `<b>Mason’s lodge:</b> the ${first != null ? sideName(first) : ''} wall goes up for free tonight — pick <b>one more side</b> to raise`
      : pk.t === 'build' ? `Pick a glowing spot for your <b>${E.BUILD[pk.b].name}</b> (${cost(E.buildCost(p, pk.b), p)}${(() => {
          const v = p.vil.find((x) => x.id === pk.by);
          return v ? `, built by your ${E.VIL[v.k].name}` : '';
        })()})${p.rules >= 3 ? ' — it must touch your village' : ''}`
      : pk.t === 'bow' ? `Pick a wall for a <b>crossbow</b> (${cost(E.BOW.cost, p)}): 🛡️${E.BOW.def} against flyers coming from that side. It falls if the wall does.`
      : 'Pick a side to wall: a <b>Palisade</b> (🛡️2), upgraded to <b>Stone</b> (🛡️4), then <b>Iron</b> (🛡️6)';
    bar.innerHTML = `<span>${msg}</span><button class="btn ghost sm" data-act="cancel-pick">Cancel</button>`;
  }

  // ---------------------------------------------------------------- side panels
  function renderRes() {
    const s = st();
    const p = me();
    const pr = E.production(p, season());
    const chip = (icon, n, plus, label) => `<div class="rchip" title="${label}"><span class="ri">${icon}</span><b>${n}</b>${plus ? `<small>+${plus}</small>` : ''}</div>`;
    const pop = p.vil.length;
    const beds = E.beds(p);
    const water = E.water(p);
    const room = E.room(p);
    const thr = tonight();
    const B = thr && E.BEAST[thr.k];
    const d = thr ? E.defense(p, thr.k, thr.side) : 0;
    const foodAfter = p.res.food + pr.food - pop;
    const wneed = E.woodNeed(p, season());
    const v3 = E.newRules(s);
    const mend = v3 && season() === 'winter' ? p.walls.filter((w) => w === 1).length : 0;
    const woodAfter = p.res.wood + pr.wood - wneed - mend;
    const toPay = v3 ? E.roundsToWages(s) : -1;
    const wages = E.wagesDue(p);
    const goldAt = p.res.gold + pr.gold;
    const loud = v3 ? p.bld.filter((b) => E.noisy(p, b)).length : 0;
    const roomWhy = room > 0 ? `<span class="good">room for ${room} more</span>` : beds <= water ? '<span class="warn">full — build a House</span>' : '<span class="warn">full — dig a Well</span>';
    $('#res').innerHTML = `
      <div class="res-head"><h3 style="--pc:${PCOLOR[G.view]}"><i></i>${esc(p.name)}</h3><span class="score-pill hidden-score" title="Scores stay secret until the final reveal">⭐ ?? points</span></div>
      <div class="rchips">
        ${E.RES.map((r) => chip(E.RES_ICON[r], p.res[r], pr[r], `${r} (+${pr[r]} at dusk)`)).join('')}
        ${p.arms || pr.forge ? chip('⚒️', `${p.arms}/${E.ARMS_MAX}`, pr.forge && p.arms < E.ARMS_MAX && (p.res.iron + pr.iron) > 0 ? 1 : 0, 'arms: each adds 🛡️1') : ''}
      </div>
      <ul class="vstats">
        <li><span>👥</span>${plural(pop, 'villager')} · 🛏️${beds} beds · 💧${water} water · ${roomWhy}${loud ? ` <small class="warn" title="Houses and Inns next to a Smithy, Barracks or Market sleep 1 fewer">🔊 ${plural(loud, 'noisy home')}</small>` : ''}</li>
        <li class="${foodAfter < 0 ? 'bad' : ''}"><span>🍞</span>Supper: make ${pr.food}, eat ${pop} → ${foodAfter < 0 ? `<b>short ${-foodAfter} — ${plural(-foodAfter, 'villager')} will leave!</b>` : `${foodAfter} left`}</li>
        ${wneed || mend ? `<li class="${woodAfter < 0 ? 'bad' : ''}"><span>❄️</span>${wneed ? `Firewood: burn ${wneed} 🪵` : ''}${wneed && mend ? ' · ' : ''}${mend ? `mend ${plural(mend, 'palisade')} (🪵1 each)` : ''} → ${woodAfter < 0 ? `<b>short ${-woodAfter} — ${wneed > p.res.wood + pr.wood ? 'villagers will freeze!' : 'a palisade will fall!'}</b>` : `${woodAfter} left`}</li>` : ''}
        ${toPay > 0 && toPay <= 4 && wages ? `<li class="${toPay === 1 && goldAt < wages ? 'bad' : ''}"><span>💰</span>Wages ${toPay === 1 ? 'tonight, as Spring begins' : `in ${plural(toPay, 'round')}`}: 🪙${wages} for ${plural(wages, 'working villager')} ${goldAt >= wages ? '<small>(you’ll have enough)</small>' : `<b>— ${toPay === 1 ? `short ${wages - goldAt}, unpaid villagers will leave!` : `you’re ${wages - goldAt} short so far`}</b>`}</li>` : ''}
        ${B ? `<li class="${d >= B.str ? 'good-li' : 'bad'}"><span>🛡️</span>Tonight vs ${esc(B.name)} ⚔️${B.str}: 🛡️${d} ${d >= B.str ? '✓ we hold' : `✗ short by ${B.str - d}`}${p.muster ? ` <small>(incl. +${p.muster} for tonight)</small>` : ''}</li>` : ''}
      </ul>`;
  }

  function renderEvent() {
    const box = $('#event');
    const s = st();
    const k = s.phase === 'act' ? E.eventNow(s) : null;
    if (!k) {
      box.hidden = true;
      return;
    }
    const ev = E.EVENTS[k];
    const p = me();
    const pi = G.view;
    const chose = p.flags && p.flags.ev;
    const mine = myTurnHere() && chose == null;
    const opts = ev.opts
      .map((o, i) => {
        const why = E.eventBlock(s, p, i);
        const pickd = chose === i;
        if (!mine) return `<div class="ev-opt${pickd ? ' picked' : ''}"><b>${esc(o.label)}</b><small>${o.text}</small></div>`;
        return `<button class="ev-opt" data-a='${JSON.stringify({ t: 'event', o: i })}' ${why ? `disabled title="${esc(why)}"` : ''}><b>${esc(o.label)}</b><small>${o.text}${why ? ` <em>(${esc(why)})</em>` : ''}</small></button>`;
      })
      .join('');
    const other = s.players[1 - pi];
    const otherTxt = other.flags && other.flags.ev != null ? `${esc(other.name)} chose “${esc(ev.opts[other.flags.ev].label)}”.` : '';
    box.hidden = false;
    box.className = `panel event-panel${mine ? ' pending' : ''}`;
    box.innerHTML = `<div class="ev-head"><span class="ev-icon">${ev.icon}</span><div><small>${E.SEASON[season()].name} event</small><h3>${esc(ev.name)}</h3></div></div>
      <p class="ev-text">${esc(ev.text)} ${mine ? '<b>Choose one before you end the round.</b>' : chose != null ? `You chose “${esc(ev.opts[chose].label)}”.` : ''}</p>
      <div class="ev-opts">${opts}</div>${otherTxt ? `<p class="muted small">${otherTxt}</p>` : ''}`;
  }

  function renderGoals() {
    const box = $('#goals');
    const s = st();
    const legacy = E.legacyGoals(s);
    const year = E.yearOf(s.round);
    const now = E.goalsOfYear(s, year);
    if (!now.length) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const pts = legacy ? E.LEGACY_GOAL_PTS : E.GOAL_PTS;
    const head = legacy
      ? `🎯 Goals <span class="muted">⭐${pts} to the village with the most at the end (⭐${pts / 2} each on a tie)</span>`
      : `🎯 Year ${year} goals <span class="muted">⭐${pts} each to the village that does most this year, scored after Winter (⭐${pts / 2} each on a tie)</span>`;
    const past = legacy ? [] : (s.goalLog || []).filter((y) => y.year < year || s.phase === 'over');
    const pastHtml = past.length
      ? `<div class="goal-past">${past.map((y) => `<span><b>Year ${y.year}:</b> ${s.players.map((p, i) => `<i style="--pc:${PCOLOR[i]}">${esc(p.name)} ⭐${y.list.reduce((t, x) => t + x.pts[i], 0)}</i>`).join(' ')}</span>`).join('')}</div>`
      : '';
    box.innerHTML = `<h3>${head}</h3><ul class="goal-list">${now
      .map((g) => {
        const G2 = E.GOALS[g];
        const v = s.players.map((p) => E.goalGain(s, p, g));
        const lead = v[0] === v[1] ? -1 : v[0] > v[1] ? 0 : 1;
        return `<li><span class="gl-ic">${G2.icon}</span><div><b>${esc(G2.name)}</b><small>${esc(E.goalText(s, g))}${legacy ? '' : G2.stock ? '' : ' this year'}</small></div><span class="gl-vals">${v.map((n, i) => `<i class="${lead === i ? 'lead' : ''}" style="--pc:${PCOLOR[i]}" title="${esc(s.players[i].name)}">${n}</i>`).join('')}</span></li>`;
      })
      .join('')}</ul>${pastHtml}`;
  }

  function renderActions() {
    const s = st();
    const pi = G.view;
    const p = me();
    const box = $('#actions');
    if (s.phase === 'over') {
      box.innerHTML = '<h3>Game over</h3><button class="btn big" data-act="show-final">See final scores</button>';
      return;
    }
    if (G.mode === 'online' && G.status !== 'active') {
      box.innerHTML = `<h3>Game over</h3><p class="muted">${esc(onlineEndText())}</p><button class="btn big" data-act="lobby">🌐 Back to your games</button>`;
      return;
    }
    if (G.mode === 'online' && pi !== G.me) {
      box.innerHTML = `<h3>Actions</h3><p class="muted">You’re looking at ${esc(p.name)}’s village.</p><button class="btn sm" data-view="${G.me}">Back to my village</button>`;
      return;
    }
    if (G.mode === 'online' && s.turn !== G.me) {
      box.innerHTML = `<h3>Actions</h3><p class="muted waiting">Waiting for ${esc(s.players[s.turn].name)}<span class="dots"><i>.</i><i>.</i><i>.</i></span></p><p class="tip">You can still move your villagers between jobs. ${esc(s.players[s.turn].name)}’s moves show up here as they happen.</p><button class="btn sm" data-view="${s.turn}">Watch ${esc(s.players[s.turn].name)}’s village</button>`;
      return;
    }
    if (s.players[s.turn].ai) {
      box.innerHTML = `<h3>Actions</h3><p class="muted waiting">${esc(s.players[s.turn].name)} is taking a turn…</p>`;
      return;
    }
    if (s.turn !== pi) {
      box.innerHTML = `<h3>Actions</h3><p class="muted">It’s ${esc(s.players[s.turn].name)}’s turn.</p><button class="btn sm" data-view="${s.turn}">Show ${esc(s.players[s.turn].name)}’s village</button>`;
      return;
    }
    const anyBuild = E.BUILD_ORDER.some((b) => !E.buildBlock(s, pi, b) && E.canPay(p, E.buildCost(p, b)));
    const anyWall = [0, 1, 2, 3, 4, 5].some((i) => E.wallCost(p, i) && E.canPay(p, E.wallCost(p, i)));
    const bowsOk = s.v >= 3;
    const bowSpots = bowsOk ? [0, 1, 2, 3, 4, 5].filter((i) => !E.bowBlock(s, p, i)) : [];
    const bowWhy = !bowsOk ? 'Not part of this older game' : !p.walls.some((w) => w) ? 'Build a wall first — crossbows stand on walls' : !bowSpots.length ? 'Every wall already has a crossbow' : !E.canPay(p, E.BOW.cost) ? `Crossbows cost ${E.costText(E.BOW.cost)}` : '';
    const rate = E.tradeRate(p) === 1 ? '1:1' : '2:1';
    const open = E.freeLocs(s).length;
    const workerMsg = p.workers > 0
      ? `Place ${plural(p.workers, 'worker')} on the locations above — placing one ends your turn.${E.freeLocs(s).length === E.OPEN_LOCS.length ? ' The main spots are taken, but the always-open ones still have room.' : ''}`
      : 'All your workers are out. Finish your free actions, then end your round.';
    box.innerHTML = `
      <h3>Free actions <span class="muted">as many as you can pay for</span></h3>
      <div class="acts-grid">
        <button class="act wide" data-act="build"${anyBuild ? '' : ' title="Nothing affordable yet — you can still look"'}><span class="ai">🏗️</span><span class="at">Build</span><span class="as">${!E.freeBuilders(p).length ? 'nobody free to build' : anyBuild ? 'a building' : 'browse buildings'}</span></button>
        <button class="act" data-act="wall" ${anyWall ? '' : 'disabled title="Walls cost 🪵2 (palisade), 🪨3 (stone) or 🪨1 🔩2 (iron)"'}><span class="ai">🧱</span><span class="at">Wall</span><span class="as">🪵2 / 🪨3 / 🔩2</span></button>
        <button class="act" data-act="bow" ${bowWhy ? `disabled title="${esc(bowWhy)}"` : ''}><span class="ai">🏹</span><span class="at">Crossbow</span><span class="as">${bowsOk ? 'vs flyers · 🪵2 🔩1' : 'older game'}</span></button>
        <button class="act" data-act="recruit"><span class="ai">🧑‍🌾</span><span class="at">Recruit</span><span class="as">${E.room(p) > 0 ? 'from the Crossroads' : 'no room!'}</span></button>
        <button class="act" data-act="trade"><span class="ai">⚖️</span><span class="at">Trade</span><span class="as">${rate}, any number</span></button>
        <button class="act" data-act="train"${p.flags && p.flags.trained ? ' disabled title="You already trained someone this round"' : ''}><span class="ai">🎓</span><span class="at">Train</span><span class="as">${p.flags && p.flags.trained ? 'done this round' : E.trainee(p) ? 'a Peasant' : 'needs a Peasant'}</span></button>
      </div>
      <p class="tip">🧍 ${workerMsg}</p>
      <button class="btn ${p.workers > 0 && open ? 'ghost' : 'big'} end-btn" data-act="end">⏭️ End round${p.workers > 0 && open ? ` <small>(${plural(p.workers, 'worker')} unused)</small>` : ''}</button>
      <p class="tip">Moving villagers between jobs is free too — click one below or a building on the map.</p>`;
  }

  // ---------------------------------------------------------------- locations
  function renderLocs() {
    const s = st();
    const p = me();
    const can = myTurnHere() && p.workers > 0;
    const gainTxt = (k) => {
      const g = E.locGain(s, p, k);
      return E.RES.filter((r) => g[r]).map((r) => `${E.RES_ICON[r]}${g[r]}`).join(' ');
    };
    const cards = s.locs
      .concat(E.FIXED_LOCS)
      .map((k) => {
        const L = E.LOC[k];
        const grp = E.LOC_GROUPS.find((g) => g.k === L.group) || { icon: '🔨', name: 'Every game' };
        const who = s.spots[k];
        const why = who != null ? `${s.players[who].name}’s worker is here` : !can ? (s.phase === 'act' && myTurnHere() ? 'No workers left' : 'Not your turn') : null;
        const g = gainTxt(k);
        return `<button class="loc${who != null ? ' taken' : ''}${can && who == null ? ' open' : ''}" data-loc="${k}" ${why ? `aria-disabled="true" title="${esc(why)}"` : 'title="Send a worker here"'}>
          <span class="loc-grp">${grp.icon} ${grp.name}</span>
          <span class="loc-art"><img src="${IMG(L.img)}" alt=""></span>
          <b class="loc-name">${L.name}</b>
          <span class="loc-text">${L.text}</span>
          ${g && who == null ? `<span class="loc-now">You’d get ${g}${k === 'crew' ? ` · ${(() => { const n = ((p.flags && p.flags.site) || []).length + (p.flags && p.flags.siteCastle ? 1 : 0); return n ? `finish ${n} 🚧 now` : 'nothing under construction yet'; })()}` : ''}</span>` : ''}
          ${who != null ? `<span class="meeple" style="--pc:${PCOLOR[who]}" title="${esc(s.players[who].name)}">🧍</span>` : ''}
        </button>`;
      })
      .join('');
    const extra = E.OPEN_LOCS.map((k) => {
      const L = E.LOC[k];
      const crowd = E.crowdAt(s, k);
      const g = gainTxt(k);
      return `<button class="loc mini${can ? ' open' : ''}" data-loc="${k}" ${can ? 'title="Send a worker here"' : `aria-disabled="true" title="${s.phase === 'act' && myTurnHere() ? 'No workers left' : 'Not your turn'}"`}>
          <span class="loc-art"><img src="${IMG(L.img)}" alt=""></span>
          <b class="loc-name">${L.name}</b>
          <span class="loc-text">Take ${g}. No limit.</span>
          ${crowd.length ? `<span class="crowd">${crowd.map((pi) => `<i style="--pc:${PCOLOR[pi]}" title="${esc(s.players[pi].name)}">🧍</i>`).join('')}</span>` : ''}
        </button>`;
    }).join('');
    $('#locs').innerHTML = `<div class="locs-head"><h3>📍 Locations</h3><span class="muted">Each holds one worker per round — whoever gets there first. This game’s five are drawn from ${E.LOC_ORDER.length}; the Work crew is in every game.</span></div><div class="loc-row">${cards}</div>
      <div class="locs-head open-head"><h4>Always open</h4><span class="muted">Weaker, but any number of workers fit — for a worker with nowhere better to go.</span></div><div class="loc-row extra">${extra}</div>`;
  }

  function renderRow() {
    const s = st();
    const p = me();
    const can = myTurnHere();
    const room = E.room(p);
    const card = (k, price, i, tag) => {
      const V = E.VIL[k];
      const a = i == null ? { t: 'recruit', peasant: true } : { t: 'recruit', i };
      const why = can ? E.legal(s, G.view, a) : 'Not your turn';
      const where = V.at ? E.BUILD[V.at].name : 'any Farm, Lumber camp, Quarry or Mine';
      const has = V.at && p.bld.some((b) => b.b === V.at);
      return `<div class="vcard${why ? ' off' : ''}" data-recruit='${JSON.stringify(a)}' title="${esc(why || 'Take them in')}">
        ${tag ? `<span class="vtag">${tag}</span>` : ''}
        <div class="v-art"><img src="${IMG(k)}" alt=""></div>
        <div class="v-name">${V.name}</div>
        <div class="v-price">${cost(price, p)} <span class="v-pts">⭐${V.pts}</span></div>
        <div class="v-text">${V.text}</div>
        <div class="v-where${V.at && !has ? ' need' : ''}">Works at: ${where}${V.at && !has ? ' (you have none)' : ''}</div>
      </div>`;
    };
    const cards = s.row
      .map((k, i) => {
        const pr = E.rowPrice(s, i, p);
        const disc = E.VIL[k].cost - pr.gold;
        const tag = i === 0 ? `Leaves at dusk${disc ? ` · −🪙${disc}` : ''}` : disc ? `−🪙${disc}` : '';
        return card(k, pr, i, tag);
      })
      .join('');
    $('#row').innerHTML = `
      <div class="row-head"><h3>🛤️ The Crossroads</h3><span class="muted">Travellers looking for a home. The first is cheapest but leaves tonight. ${plural(s.deck.length, 'more traveller')} on the road.</span>
      ${room <= 0 ? '<span class="warn-pill">No room — build a House or Well</span>' : `<span class="ok-pill">Room for ${room}</span>`}</div>
      <div class="vrow">${cards}${card('peasant', E.peasantPrice(p), null, 'Always here')}</div>`;
  }

  function renderPeople() {
    const p = me();
    const own = canManage();
    const chips = p.vil
      .map((v) => {
        const b = v.at != null && p.bld.find((x) => x.id === v.at);
        const how = b && E.canWork(v.k, b.b);
        const job = b ? `${E.BUILD[b.b].name}${how === 'spec' ? ' ★' : ''}` : 'Idle';
        const away = E.busy(p, v);
        const waiting = !away && b && how && underConstruction(p, b);
        const site = away && siteName(p, v);
        const where = away
          ? `<span class="away-note">🔨 Building${site ? ` the ${site}` : ''} — off work tonight</span>${b && how ? `<span class="usual">${underConstruction(p, b) && builderOf(p, b) === v ? 'works there once it opens' : `usually: ${job}`}</span>` : ''}`
          : waiting ? `${job} <span class="wait-note">🚧 opens next season</span>` : job;
        return `<button class="pchip${b ? '' : ' idle'}${away ? ' busy' : ''}${waiting ? ' waiting' : ''}${how === 'spec' ? ' spec' : ''}" data-vil="${v.id}" ${own ? '' : 'disabled'}><img src="${IMG(v.k)}" alt=""><span><b>${E.VIL[v.k].name}</b><small>${where}</small></span></button>`;
      })
      .join('');
    $('#people').innerHTML = `<h3>👥 Villagers <span class="muted">${p.vil.length} · ★ = their own trade</span></h3><div class="pchips">${chips || '<p class="muted">Nobody lives here any more…</p>'}</div>${p.trophies.length ? `<div class="trophies"><span class="muted">Trophies:</span> ${p.trophies.map((k) => `<img src="${IMG(k)}" alt="${E.BEAST[k].name}" title="${E.BEAST[k].name}">`).join('')}</div>` : ''}`;
  }

  function renderLog() {
    const items = st().log.slice(-40).reverse();
    $('#log').innerHTML = `<h3>📖 Chronicle</h3><ol class="log">${items.map((l) => `<li style="--pc:${l.who != null ? PCOLOR[l.who] : '#999'}"><span class="lr">R${l.r}</span>${esc(l.text)}</li>`).join('')}</ol>`;
  }

  // ---------------------------------------------------------------- input
  function onAppClick(e) {
    if (!G) return;
    const v = e.target.closest('[data-view]');
    if (v) {
      G.view = +v.dataset.view;
      ui.pick = null;
      save();
      render();
      return;
    }
    const a = e.target.closest('[data-a]');
    if (a && !a.disabled) {
      doAction(JSON.parse(a.dataset.a));
      return;
    }
    const lc = e.target.closest('[data-loc]');
    if (lc) {
      if (!myTurnHere()) return toast('Not your turn right now.');
      const act = { t: 'place', loc: lc.dataset.loc };
      const why = E.legal(st(), G.view, act);
      if (why) return toast(esc(why), 'bad');
      if (act.loc === 'masons' && E.masonChoices(st(), me()).length > 1) {
        ui.pick = { t: 'masons' };
        render();
        $('#board').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      doAction(act);
      return;
    }
    const r = e.target.closest('[data-recruit]');
    if (r) {
      if (!myTurnHere()) return toast('Not your turn right now.');
      const act = JSON.parse(r.dataset.recruit);
      const why = E.legal(st(), G.view, act);
      if (why) return toast(esc(why), 'bad');
      doAction(act);
      return;
    }
    const pc = e.target.closest('[data-vil]');
    if (pc && !pc.disabled) {
      showMove(+pc.dataset.vil);
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const what = b.dataset.act;
    if (what === 'build') showBuildPicker();
    if (what === 'wall' || what === 'bow') {
      ui.pick = { t: what };
      render();
    }
    if (what === 'cancel-pick') {
      ui.pick = null;
      render();
    }
    if (what === 'recruit') {
      const row = $('#row');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.remove('flash');
      void row.offsetWidth;
      row.classList.add('flash');
    }
    if (what === 'trade') showTrade();
    if (what === 'train') showTrain();
    if (what === 'end') confirmEnd();
    if (what === 'show-final') showGameOver(true);
    if (what === 'lobby') showSetup(G.id);
  }

  function onBoardClick(e) {
    if (!G) return;
    const side = e.target.closest('[data-side]');
    if (side && ui.pick && ui.pick.t === 'masons') {
      const i = +side.dataset.side;
      const act = { t: 'place', loc: 'masons', side: i };
      const why = E.legal(st(), G.view, act);
      if (why) return toast(esc(why), 'bad');
      if (!E.masonChoices(st(), me()).includes(i)) return toast('That side will already be Stone.', 'bad');
      ui.pick = null;
      ui.freshSide = i;
      doAction(act);
      return;
    }
    if (side && ui.pick && (ui.pick.t === 'wall' || ui.pick.t === 'bow')) {
      const i = +side.dataset.side;
      const act = { t: ui.pick.t, side: i };
      const why = E.legal(st(), G.view, act);
      if (why) return toast(esc(why), 'bad');
      ui.pick = null;
      ui.freshSide = i;
      doAction(act);
      return;
    }
    const cell = e.target.closest('[data-cell]');
    if (!cell) return;
    const i = +cell.dataset.cell;
    if (ui.pick && ui.pick.t === 'build') {
      const a = { t: 'build', b: ui.pick.b, cell: i, by: ui.pick.by };
      const why = E.legal(st(), G.view, a);
      if (why) return toast(esc(why), 'bad');
      ui.pick = null;
      doAction(a);
      return;
    }
    const b = me().bld.find((x) => x.cell === i);
    if (b) showBuilding(b);
    else {
      const t = E.TERRAIN[st().terrain[i]];
      const fits = E.BUILD_ORDER.filter((k) => E.BUILD[k].on && E.BUILD[k].on.includes(st().terrain[i])).map((k) => E.BUILD[k].name);
      toast(`<b>${t.icon} ${t.name}</b> — can hold: ${fits.join(', ')}`);
    }
  }

  function doAction(a) {
    if (G.mode === 'online') return sendOnline(a);
    const s = st();
    const pi = a.t === 'move' ? G.view : s.turn;
    const before = s.players[pi].bld.length;
    try {
      E.apply(s, pi, a);
    } catch (err) {
      toast(esc(err.message), 'bad');
      return;
    }
    const p = s.players[pi];
    if (a.t === 'build' && p.bld.length > before) ui.fresh.add(p.bld[p.bld.length - 1].id);
    if (a.t === 'recruit') toast(`${esc(p.name)} took in a <b>${E.VIL[p.vil[p.vil.length - 1].k].name}</b>.`);
    if (a.t === 'place') toast(`🧍 ${esc(s.log[s.log.length - 1].text)}`);
    afterAction();
  }

  function afterAction() {
    const s = st();
    if (G.mode === 'local' && s.phase === 'act' && G.view !== s.turn) {
      G.view = s.turn;
      ui.pick = null;
      handoff();
    }
    save();
    if (s.phase === 'dusk') {
      render();
      setTimeout(runDusk, 450);
      return;
    }
    render();
    scheduleAI();
  }

  function handoff() {
    const s = st();
    const el = document.createElement('div');
    el.className = 'handoff';
    el.style.setProperty('--pc', PCOLOR[s.turn]);
    el.textContent = G.mode === 'online' && s.turn === G.me ? 'Your turn' : `${s.players[s.turn].name}’s turn`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  // ---------------------------------------------------------------- computer turns
  function scheduleAI() {
    clearTimeout(ui.aiTimer);
    if (!G || ui.modal) return;
    const s = st();
    if (s.phase !== 'act' || !s.players[s.turn].ai) return;
    ui.aiTimer = setTimeout(aiStep, G.mode === 'sim' ? SIM_SPEEDS[G.speed].ai : ui.aiFast ? 450 : 850);
  }
  function aiStep() {
    if (!G || ui.modal) return;
    const s = st();
    if (s.phase !== 'act' || !s.players[s.turn].ai) return;
    const pi = s.turn;
    const p = s.players[pi];
    const a = E.aiChoose(s, pi, G.levels ? G.levels[pi] : G.level);
    const before = p.bld.length;
    let msg;
    try {
      msg = E.apply(s, pi, a);
    } catch (err) {
      msg = E.apply(s, pi, { t: 'end' });
    }
    ui.aiFast = a.t !== 'place' && a.t !== 'end';
    if (a.t === 'build' && p.bld.length > before) ui.fresh.add(p.bld[p.bld.length - 1].id);
    if ((a.t === 'wall' || a.t === 'bow') && G.view === pi) ui.freshSide = a.side;
    if (G.mode !== 'sim' || G.speed !== 'turbo') toast(`<span class="dot" style="--pc:${PCOLOR[pi]}"></span><b>${esc(p.name)}</b> ${esc(msg)}`, 'ai');
    afterAction();
  }

  // ---------------------------------------------------------------- build picker
  function showTrain() {
    const p = me();
    const v = E.trainee(p);
    const card = (k) => {
      const V = E.VIL[k];
      const why = E.trainBlock(p, k);
      const home = V.at ? E.BUILD[V.at] : null;
      const has = home && p.bld.some((b) => b.b === V.at);
      return `<button class="bcard${why ? ' off' : ''}" data-train="${k}" ${why ? `title="${esc(why)}"` : ''}>
        <div class="b-art" style="--bc:${home ? home.color : '#8d6e63'}"><img src="${IMG(k)}" alt=""></div>
        <div class="b-body">
          <div class="b-name">${V.name}</div>
          <div class="b-cost">${cost(E.trainPrice(p, k), p)}</div>
          <div class="b-text">${V.text}</div>
          <div class="b-foot"><span>${home ? (has ? `Works in your ${home.name}` : `<span class="warn">No ${home.name} yet</span>`) : ''}</span><span>⭐${V.pts}</span></div>
          ${why ? `<div class="b-why">${esc(why)}</div>` : ''}
        </div>
      </button>`;
    };
    const lead = !v
      ? 'You need a Peasant to train. A Peasant from the Crossroads costs 🪙1.'
      : p.flags && p.flags.trained
        ? 'You’ve already trained someone this round.'
        : `Once a round, one of your Peasants can learn any trade. It costs the trade’s full price plus 🪙${E.TRAIN_FEE}, and needs no new bed or water. They move into their own building if you have one.`;
    const back = openModal(`<h2>🎓 Train a Peasant</h2><p class="muted">${lead} Your stores: ${E.RES.map((r) => `${E.RES_ICON[r]}${p.res[r]}`).join(' ')}</p><div class="bgrid">${E.VIL_ORDER.filter((k) => k !== 'peasant').map(card).join('')}</div>`, { cls: 'wide' });
    back.addEventListener('click', (e) => {
      const c = e.target.closest('[data-train]');
      if (!c || c.classList.contains('off')) return;
      if (!myTurnHere()) return;
      closeModal();
      doAction({ t: 'train', k: c.dataset.train });
    });
  }

  function showBuildPicker() {
    const s = st();
    const pi = G.view;
    const p = me();
    const card = (b) => {
      const B = E.BUILD[b];
      const c = E.buildCost(p, b);
      const block = E.buildBlock(s, pi, b);
      const afford = E.canPay(p, c);
      const why = block || (afford ? null : 'Not enough resources') || (E.freeBuilders(p).length ? null : 'Nobody is free to build');
      const where = B.upgrade ? 'Upgrades your Keep' : `On ${B.on.map((t) => E.TERRAIN[t].name.toLowerCase()).join(' or ')}`;
      const pts = B.pts ? (B.wonder ? `⭐${B.pts}` : B.slots ? `⭐${B.pts} while staffed` : `⭐${B.pts}`) : 'no points';
      const n = p.bld.filter((x) => x.b === b).length;
      return `<button class="bcard${why ? ' off' : ''}${B.wonder ? ' wonder' : ''}" data-pick="${b}" ${why ? `title="${esc(why)}"` : ''}>
        <div class="b-art" style="--bc:${B.color}"><img src="${IMG(b)}" alt="">${n ? `<span class="b-n">×${n}</span>` : ''}</div>
        <div class="b-body">
          <div class="b-name">${B.name}${B.wonder ? ' <span class="wtag">Wonder</span>' : ''}</div>
          <div class="b-cost">${cost(c, p)}</div>
          <div class="b-text">${B.text}</div>
          ${jobLine(b)}
          <div class="b-foot"><span>${where}</span><span>${pts}</span></div>
          ${why ? `<div class="b-why">${esc(why)}</div>` : ''}
        </div>
      </button>`;
    };
    const free = E.freeBuilders(p);
    const sugg = E.builderFor(p);
    if (!free.some((v) => v.id === ui.builder)) ui.builder = sugg ? sugg.id : null;
    const vWhere = (v) => {
      const b = v.at != null && p.bld.find((x) => x.id === v.at);
      return b && E.canWork(v.k, b.b) ? `${E.BUILD[b.b].name}${E.canWork(v.k, b.b) === 'spec' ? ' ★' : ''}` : 'Idle';
    };
    const builders = p.vil.length
      ? `<div class="builders"><b>🔨 Who builds it?</b> <span class="muted">They leave their job — anyone idle steps into it — and won’t work or defend until the building is finished. It opens next season, when they take a free job — or right away if you send a worker to the Work crew, which frees them to work or build again.</span><div class="bchips">${p.vil
          .map((v) => {
            const isBusy = E.hasBuilt(p, v);
            return `<button class="bchip${v.id === ui.builder ? ' on' : ''}" data-builder="${v.id}" ${isBusy ? 'disabled title="Still building — free once that building is finished"' : ''}><img src="${IMG(v.k)}" alt=""><span><b>${E.VIL[v.k].name}</b><small>${isBusy ? '🔨 building' : esc(vWhere(v))}</small></span></button>`;
          })
          .join('')}</div></div>`
      : '';
    const none = !free.length ? '<p class="b-why">Everyone is busy building — nobody is free until those buildings are finished (next season, or now with the Work crew).</p>' : '';
    const back = openModal(`<h2>🏗️ Build</h2><p class="muted">Your stores: ${E.RES.map((r) => `${E.RES_ICON[r]}${p.res[r]}`).join(' ')}${E.tradeRate(p) === 1 ? ' · trades are 1:1 for you' : ' · short? Trading (2:1) is free.'}</p>${builders}${none}<div class="bgrid">${E.BUILD_ORDER.map(card).join('')}</div>`, { cls: 'wide' });
    back.addEventListener('click', (e) => {
      const bc = e.target.closest('[data-builder]');
      if (bc && !bc.disabled) {
        ui.builder = +bc.dataset.builder;
        back.querySelectorAll('[data-builder]').forEach((x) => x.classList.toggle('on', x === bc));
        return;
      }
      const c = e.target.closest('[data-pick]');
      if (!c || c.classList.contains('off')) return;
      const b = c.dataset.pick;
      if (!myTurnHere()) return;
      ui.onClose = null;
      closeModal();
      if (E.BUILD[b].upgrade) {
        doAction({ t: 'build', b, cell: null, by: ui.builder });
        return;
      }
      ui.pick = { t: 'build', b, by: ui.builder };
      render();
      $('#board').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function jobLine(b) {
    if (E.LABOR.includes(b)) return '';
    const who = E.VIL_ORDER.filter((k) => E.VIL[k].at === b);
    if (!who.length) return '';
    return `<div class="b-job">👷 ${who.map((k) => `<b>${E.VIL[k].name}</b>: ${E.VIL[k].text.replace(/^[^:]+: /, '')}`).join('<br>')}</div>`;
  }

  // ---------------------------------------------------------------- building info / moving people
  function showBuilding(b) {
    const s = st();
    const p = me();
    const B = E.BUILD[b.b];
    const k = b.b === 'keep' && p.castle ? 'castle' : b.b;
    const occ = E.occupants(p, b.id);
    const pr = E.production(p, season()).by[b.id];
    const own = canManage();
    const slots = E.slotsOf(b.b);
    const movers = own && slots && occ.length < slots ? p.vil.filter((v) => v.at !== b.id && E.canWork(v.k, b.b) && !E.busy(p, v)) : [];
    const prodTxt = pr ? Object.entries(pr).map(([r, n]) => (r === 'forge' ? '⚒️ forges arms' : `${r === 'renown' ? '⭐' : E.RES_ICON[r]}${n}`)).join(' ') : 'nothing this round';
    const back = openModal(`
      <div class="binfo">
        <div class="b-art big" style="--bc:${B.color}"><img src="${IMG(k)}" alt=""></div>
        <div>
          <h2>${b.b === 'keep' && p.castle ? 'Castle' : B.name}</h2>
          <p>${B.text}${b.b === 'keep' && p.castle ? ' ' + E.BUILD.castle.text : ''}</p>
          ${underConstruction(p, b) && builderOf(p, b) ? `<p class="warn">🔨 Your <b>${E.VIL[builderOf(p, b).k].name}</b> is building it, so they’re off their usual work tonight.</p>` : ''}
          ${occ.some((v) => E.busy(p, v)) ? `<p class="warn">🔨 ${occ.filter((v) => E.busy(p, v)).map((v) => `Your <b>${E.VIL[v.k].name}</b>`).join(' and ')} ${occ.filter((v) => E.busy(p, v)).length > 1 ? 'are' : 'is'} off building this round, so they don’t work here or defend tonight. Back next season.</p>` : ''}
          ${underConstruction(p, b) ? `<p class="warn">🚧 <b>Under construction</b> — ${b.b === 'keep' ? 'the Castle’s beds and defense' : 'it'} can’t be used until next season: no work, beds, water or defense this round. A worker at the Work crew finishes it now.</p>` : ''}
          <p><b>This round:</b> ${prodTxt}</p>
          ${E.RANGE[b.b] && p.rules >= 3 ? `<p><b>Defends:</b> ${[0, 1, 2, 3, 4, 5].filter((sd) => E.sideDepth(b.cell, sd) <= E.RANGE[b.b]).map((sd) => E.SIDES[sd].name).join(', ')} <small class="muted">(sides within ${E.RANGE[b.b]} rows)</small></p>` : ''}
          ${E.noisy(p, b) ? '<p class="warn">🔊 Next to a noisy building, so it sleeps 1 fewer.</p>' : ''}
          ${slots ? `<p><b>Workers (${occ.length}/${slots}):</b> ${occ.map((v) => `<button class="pchip sm" data-move="${v.id}" ${own ? '' : 'disabled'}><img src="${IMG(v.k)}" alt=""><span><b>${E.VIL[v.k].name}</b><small>${E.busy(p, v) ? '🔨 off building' : E.canWork(v.k, b.b) === 'spec' ? 'own trade ★' : 'labor'}</small></span></button>`).join(' ') || '<span class="muted">nobody — it earns no points until someone works here</span>'}</p>` : ''}
          ${movers.length ? `<p><b>Move someone here (free):</b></p><div class="pchips">${movers.map((v) => `<button class="pchip sm" data-movehere="${v.id}"><img src="${IMG(v.k)}" alt=""><span><b>${E.VIL[v.k].name}</b><small>${whereOf(p, v)}</small></span></button>`).join('')}</div>` : ''}
        </div>
      </div>`);
    back.addEventListener('click', (e) => {
      const mh = e.target.closest('[data-movehere]');
      if (mh) {
        ui.onClose = null;
        closeModal();
        doAction({ t: 'move', v: +mh.dataset.movehere, to: b.id });
        return;
      }
      const m = e.target.closest('[data-move]');
      if (m && !m.disabled) {
        ui.onClose = null;
        closeModal();
        showMove(+m.dataset.move);
      }
    });
  }
  function whereOf(p, v) {
    const b = v.at != null && p.bld.find((x) => x.id === v.at);
    return b ? E.BUILD[b.b].name : 'idle';
  }

  function showMove(vid) {
    const p = me();
    const v = p.vil.find((x) => x.id === vid);
    if (!v) return;
    const V = E.VIL[v.k];
    const away = E.busy(p, v);
    const targets = away ? [] : E.moveTargets(p, v);
    const back = openModal(`
      <div class="binfo">
        <div class="b-art big v"><img src="${IMG(v.k)}" alt=""></div>
        <div>
          <h2>${V.name}</h2>
          <p>${V.text}</p>
          <p class="muted">Now: ${whereOf(p, v)} · worth ⭐${V.pts}</p>
          ${away ? `<p class="warn">🔨 Building${siteName(p, v) ? ` the ${siteName(p, v)}` : ''} this round, so they can’t take a job until next season. They’ll find one on their own then.</p>` : '<p><b>Move to (free):</b></p>'}
          <div class="pchips">
            ${targets.map((b) => `<button class="pchip sm${E.canWork(v.k, b.b) === 'spec' ? ' spec' : ''}" data-to="${b.id}"><img src="${IMG(b.b)}" alt=""><span><b>${E.BUILD[b.b].name}</b><small>${E.canWork(v.k, b.b) === 'spec' ? 'own trade ★' : 'labor'}</small></span></button>`).join('') || '<span class="muted">No free job they can do. Build one first.</span>'}
            ${v.at != null && !away ? '<button class="pchip sm idle" data-to="idle"><span><b>Rest</b><small>make idle</small></span></button>' : ''}
          </div>
        </div>
      </div>`);
    back.addEventListener('click', (e) => {
      const t = e.target.closest('[data-to]');
      if (!t) return;
      ui.onClose = null;
      closeModal();
      doAction({ t: 'move', v: vid, to: t.dataset.to === 'idle' ? null : +t.dataset.to });
    });
  }

  // ---------------------------------------------------------------- trade
  function showTrade() {
    const s = st();
    const p = me();
    const rate = E.tradeRate(p);
    const trades = [];
    let give = null;
    const draw = () => {
      const res = Object.assign({}, p.res);
      trades.forEach(([g, t]) => {
        res[g] -= rate;
        res[t] += 1;
      });
      const box = $('.trade');
      box.innerHTML = `
        <h2>⚖️ Trade at the market</h2>
        <p class="muted">Give ${rate} of one thing for 1 of another, as many times as you like. Trading is a free action.${rate === 2 ? ' A working Merchant (or the Trading post this round) makes it 1 for 1.' : ''}</p>
        <div class="tr-step"><b>1. Give ${rate}:</b> ${E.RES.map((r) => `<button class="rbtn${give === r ? ' on' : ''}" data-give="${r}" ${res[r] < rate ? 'disabled' : ''}>${E.RES_ICON[r]}<small>${res[r]}</small></button>`).join('')}</div>
        <div class="tr-step"><b>2. Get 1:</b> ${E.RES.map((r) => `<button class="rbtn" data-get="${r}" ${!give || give === r ? 'disabled' : ''}>${E.RES_ICON[r]}</button>`).join('')}</div>
        <div class="tr-list">${trades.map(([g, t], i) => `<span class="tr-item">${E.RES_ICON[g]}${rate} → ${E.RES_ICON[t]}1 <button class="link" data-undo="${i}">✕</button></span>`).join('') || '<span class="muted">No trades yet.</span>'}</div>
        <p>After: ${E.RES.map((r) => `${E.RES_ICON[r]}${res[r]}`).join(' ')}</p>
        <div class="btn-row"><button class="btn" data-ok ${trades.length ? '' : 'disabled'}>Trade</button><button class="btn ghost" data-close>Cancel</button></div>`;
    };
    const back = openModal('<div class="trade"></div>');
    draw();
    back.addEventListener('click', (e) => {
      const g = e.target.closest('[data-give]');
      if (g && !g.disabled) {
        give = g.dataset.give;
        draw();
        return;
      }
      const t = e.target.closest('[data-get]');
      if (t && !t.disabled) {
        trades.push([give, t.dataset.get]);
        give = null;
        draw();
        return;
      }
      const u = e.target.closest('[data-undo]');
      if (u) {
        trades.splice(+u.dataset.undo, 1);
        draw();
        return;
      }
      if (e.target.closest('[data-ok]') && trades.length) {
        const why = E.legal(s, G.view, { t: 'trade', trades });
        if (why) return toast(esc(why), 'bad');
        ui.onClose = null;
        closeModal();
        doAction({ t: 'trade', trades });
      }
    });
  }

  function confirmEnd() {
    const p = me();
    const open = E.freeLocs(st()).length;
    if (p.workers <= 0 || !open) return doAction({ t: 'end' });
    const back = openModal(`<h2>End your round?</h2><p>You still have ${plural(p.workers, 'worker')} and ${plural(open, 'open location')}. Ending now gives them up for this round.</p><div class="btn-row"><button class="btn lava" data-yes>End round</button><button class="btn ghost" data-close>Keep playing</button></div>`);
    back.addEventListener('click', (e) => {
      if (!e.target.closest('[data-yes]')) return;
      ui.onClose = null;
      closeModal();
      doAction({ t: 'end' });
    });
  }


  // ---------------------------------------------------------------- dusk
  function runDusk() {
    if (!G) return;
    const s = st();
    if (s.phase !== 'dusk') return;
    clearTimeout(ui.aiTimer);
    const rep = E.resolveDusk(s);
    const arrived = rep.arrived;
    G.dusk = { rep, arrived };
    save();
    showDusk(rep, arrived);
  }

  function showDusk(rep, arrived) {
    const s = st();
    const B = E.BEAST[rep.threat.k];
    const bt = E.beastText(rep.threat.k);
    const sea = E.SEASON[rep.season];
    const resLine = (o) => {
      const parts = E.RES.filter((r) => o[r]).map((r) => `<span class="gain">+${o[r]}${E.RES_ICON[r]}</span>`);
      if (o.renown) parts.push(`<span class="gain">+${o.renown}⭐</span>`);
      return parts.join(' ') || '<span class="muted">nothing</span>';
    };
    const lostLine = (o) => (o ? E.RES.filter((r) => o[r]).map((r) => `−${o[r]}${E.RES_ICON[r]}`).join(' ') : '');
    const names = (list) => list.map((k) => E.VIL[k].name).join(', ');
    const anyBreach = rep.players.some((r) => !r.attack.won);
    const cols = rep.players
      .map((r, i) => {
        const p = s.players[i];
        const a = r.attack;
        const pct = Math.min(100, Math.round((a.def / Math.max(a.str, a.def, 1)) * 100));
        const spct = Math.min(100, Math.round((a.str / Math.max(a.str, a.def, 1)) * 100));
        let out = '';
        if (a.won) out = `<div class="stamp ok">Driven off!</div><p class="good">+${B.win}⭐${B.loot ? ` · +${B.loot}🪙 loot` : ''}</p>`;
        else {
          const bits = [];
          if (a.lost && Object.keys(a.lost).length) bits.push(lostLine(a.lost));
          if (a.wallFrom != null && a.wallFrom !== a.wallTo) bits.push(`the ${sideName(rep.threat.side)} ${E.WALL[a.wallFrom].name.toLowerCase()} ${a.wallTo ? 'was damaged' : 'was destroyed'}${a.bowLost ? ', and its crossbow with it' : ''}`);
          if (a.left && a.left.length) bits.push(`${names(a.left)} ${B.fail.stone ? 'turned to stone' : 'carried off'}`);
          if (a.burned) bits.push(`the ${E.BUILD[a.burned].name} burned down`);
          if (a.renown) bits.push(`−${a.renown}⭐`);
          out = `<div class="stamp bad">Broke through!</div><p class="bad">${bits.join(' · ') || 'Luckily, nothing was lost.'}</p>`;
        }
        const leftBits = [];
        if (r.hungry.length) leftBits.push(`${names(r.hungry)} left hungry (−${r.hungry.length}⭐)`);
        if (r.cold.length) leftBits.push(`${names(r.cold)} left — too cold (−${r.cold.length}⭐)`);
        return `<div class="dcol${a.won ? '' : ' breach'}" style="--pc:${PCOLOR[i]}">
          <h3><i></i>${esc(p.name)}</h3>
          <div class="dstep s1"><span class="dlabel">Work</span>${resLine(r.prod)}${r.forged ? ` <span class="gain">+${r.forged}⚒️</span>` : ''}</div>
          <div class="dstep s2"><span class="dlabel">Night</span>
            <div class="bars"><div class="bar def"><span style="width:${pct}%"></span><b>🛡️${a.def}</b></div><div class="bar str"><span style="width:${spct}%"></span><b>⚔️${a.str}</b></div></div>
            ${out}
          </div>
          <div class="dstep s3"><span class="dlabel">Supper</span>ate ${r.ate}🍞${r.burned ? ` · burned ${r.burned}🪵` : ''}${leftBits.length ? `<p class="bad">${leftBits.join('<br>')}</p>` : ' · <span class="good">everyone’s fed</span>'}</div>
          ${r.frost && (r.frost.fixed || r.frost.fell.length) ? `<div class="dstep s4"><span class="dlabel">Frost</span>${r.frost.fixed ? `mended ${plural(r.frost.fixed, 'palisade')} (−${r.frost.fixed}🪵)` : ''}${r.frost.fell.length ? `<p class="bad">${r.frost.fell.map((i) => `the ${sideName(i)}`).join(', ')} palisade fell — no wood to mend it${r.frost.bows ? ` (${plural(r.frost.bows, 'crossbow')} fell with it)` : ''}</p>` : ''}</div>` : ''}
          ${r.wages ? `<div class="dstep s5"><span class="dlabel">Wages</span>paid 🪙${r.wages.paid}${r.wages.left.length ? `<p class="bad">${names(r.wages.left)} left unpaid (−${r.wages.left.length}⭐)</p>` : ' · <span class="good">everyone paid</span>'}</div>` : ''}
        </div>`;
      })
      .join('');
    const crossroads = `${rep.leftRow ? `The ${E.VIL[rep.leftRow].name} moved on.` : ''} ${arrived.length ? `Arriving: ${arrived.map((k) => E.VIL[k].name).join(', ')}.` : ''}`;
    const html = `
      <div class="dusk${anyBreach ? ' shake' : ''}">
        <div class="dusk-sky"><div class="moon"></div>${'<i class="star"></i>'.repeat(14)}</div>
        <h2>${sea.icon} Dusk — ${sea.name}, year ${E.yearOf(rep.round)}</h2>
        <div class="dusk-foe ${B.kind === 'fly' ? 'swoop' : 'charge'}">
          <img src="${IMG(rep.threat.k)}" alt="">
          <div><b>${B.name}</b> attacks${B.kind === 'fly' ? ` from the sky${rep.threat.side != null ? `, out of the ${sideName(rep.threat.side)}` : ''}` : ` from the ${sideName(rep.threat.side)}`}! <span class="muted">⚔️${B.str} · win ${bt.win}</span></div>
        </div>
        <div class="dcols">${cols}</div>
        ${rep.goals ? `<div class="dusk-goals"><h3>🎯 Year ${rep.goals.year} goals</h3><ul>${rep.goals.list.map((x) => {
          const G2 = E.GOALS[x.g];
          const win = x.pts[0] === x.pts[1] ? (x.pts[0] ? 'Tie' : 'Nobody scores') : `${esc(s.players[x.pts[0] > x.pts[1] ? 0 : 1].name)} +⭐${Math.max(...x.pts)}`;
          return `<li><span>${G2.icon} <b>${esc(G2.name)}</b></span><span class="gl-vals">${x.v.map((n, i) => `<i style="--pc:${PCOLOR[i]}">${n}</i>`).join('')}</span><span class="dg-win">${x.pts[0] === x.pts[1] && x.pts[0] ? `Tie · +⭐${x.pts[0]} each` : win}</span></li>`;
        }).join('')}</ul></div>` : ''}
        <p class="crossroads muted">🛤️ ${crossroads}</p>
        <button class="btn big" data-close>${s.phase === 'over' ? 'See final scores' : `On to ${E.SEASON[E.seasonOf(s.round)].name} ${E.SEASON[E.seasonOf(s.round)].icon}`}</button>
      </div>`;
    render();
    openModal(html, {
      cls: 'dusk-back locked',
      noClose: true,
      onClose: () => {
        delete G.dusk;
        save();
        if (s.phase === 'over') showGameOver();
        else {
          if (G.mode === 'local') G.view = s.turn;
          save();
          render();
          seasonBanner();
          scheduleAI();
        }
      },
    });
    if (G.mode === 'sim') {
      clearTimeout(ui.simTimer);
      ui.simTimer = setTimeout(() => {
        if ($('.dusk-back')) closeModal();
      }, SIM_SPEEDS[G.speed].dusk);
    }
  }

  function seasonBanner() {
    const s = st();
    const sea = E.SEASON[season()];
    const el = document.createElement('div');
    el.className = `season-banner sb-${season()}`;
    const first = s.players[s.turn];
    el.innerHTML = `<div class="sb-in"><span class="sb-icon">${sea.icon}</span><div><b>${sea.name}</b><small>Year ${E.yearOf(s.round)} · round ${s.round} of ${E.ROUNDS}</small><em>${sea.note}</em><em>${esc(first.name)} goes first${s.round > 1 ? ' (it alternates every round)' : ''}.</em></div></div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2300);
    setTimeout(() => el.remove(), 2800);
  }

  // ---------------------------------------------------------------- game over
  // Scores stay hidden all game; this is the big reveal at the end (instant when replayed).
  function showGameOver(instant) {
    const s = st();
    const sc = s.players.map((p) => E.score(s, p));
    const w = E.winner(s);
    const rows = [
      ['⭐ Renown', 'renown'],
      ['🏠 Buildings & wonders', 'buildings'],
      ['👥 Villagers', 'villagers'],
      ['🧱 Stone & Iron wall sections', 'walls'],
      ['🏰 Fully walled', 'fortified'],
      ['🪙 Gold (1 per 5)', 'gold'],
      ['🎯 Goals', 'goals'],
    ].filter(([, k]) => k === 'renown' || sc[0][k] || sc[1][k]);
    let head;
    if (G.mode === 'ai' || G.mode === 'local') recordGame();
    if (w < 0) head = '🤝 A perfect tie!';
    else if (G.mode === 'ai') head = s.players[w].ai ? '🐉 The Computer wins!' : '🏆 You win!';
    else if (G.mode === 'online') head = w === G.me ? '🏆 You win!' : `🏆 ${esc(s.players[w].name)} wins!`;
    else head = `🏆 ${esc(s.players[w].name)} wins!`;
    const margin = Math.abs(sc[0].total - sc[1].total);
    const sub = w < 0 ? `Both villages scored ${sc[0].total} — ${s.players[0].vil.length === s.players[1].vil.length ? 'and have the same number of villagers' : 'the tie-break is villagers'}.`
      : margin === 0 ? 'Level on points — won on villagers!'
        : margin === 1 ? 'By a single point — what a finish!'
          : margin <= 5 ? `A nail-biter — by ${margin} points!` : `By ${margin} points.`;
    const side = (i) => `<div class="hr-side" style="--pc:${PCOLOR[i]}"><span class="hr-crown">👑</span><img src="${IMG(s.players[i].castle ? 'castle' : 'keep')}" alt=""><b class="hr-name">${esc(s.players[i].name)}</b><span class="hr-total">?</span><small class="muted">${plural(s.players[i].vil.length, 'villager')} · ${plural(s.players[i].trophies.length, 'trophy', 'trophies')}</small></div>`;
    document.querySelectorAll('.hh-reveal').forEach((x) => x.remove());
    const el = document.createElement('div');
    el.className = 'hh-reveal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Final results');
    el.innerHTML = `<div class="hr-rays"></div><div class="hr-stage">
        <div class="hr-title">🏁 The three years are over</div>
        <div class="hr-duel">${side(0)}<div class="hr-vs">VS</div>${side(1)}</div>
        <div class="hr-verdict" aria-live="polite"></div>
        <div class="hr-sub">${sub}</div>
        <div class="hr-rows">${rows.map(([label, k]) => `<div class="hr-row"><span class="${sc[0][k] > sc[1][k] ? 'lead' : ''}">${sc[0][k]}</span><small>${label}</small><span class="${sc[1][k] > sc[0][k] ? 'lead' : ''}">${sc[1][k]}</span></div>`).join('')}</div>
        <div class="hr-actions"><button class="btn" data-rv="close">🏘️ See the villages</button><button class="btn" data-rv="again">${G.mode === 'online' ? '🌐 Your games' : G.mode === 'sim' ? '🧪 Run again' : '🏰 Play again'}</button>${G.mode === 'sim' ? '' : '<button class="btn ghost" data-rv="hist">🏆 Game history</button>'}<a class="btn ghost" href="/board-games.html">🎲 All board games</a></div>
      </div><button class="hr-skip" data-rv="skip">Skip ▸</button>`;
    document.body.appendChild(el);
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const sides = [...el.querySelectorAll('.hr-side')];
    let announced = false;
    let decided = false;
    const announce = () => {
      if (announced) return;
      announced = true;
      el.classList.remove('suspense');
      el.classList.add('announced');
      sides.forEach((x, i) => x.classList.add(w < 0 ? 'tie' : i === w ? 'win' : 'lose'));
      el.querySelector('.hr-verdict').innerHTML = `<div class="hr-head">${head}</div>`;
      el.querySelectorAll('.hr-total').forEach((t, i) => (t.textContent = sc[i].total));
      if (!instant && (w < 0 || (G.mode === 'online' ? w === G.me : !s.players[w].ai))) confetti();
    };
    const finish = () => {
      if (decided) return;
      decided = true;
      timers.forEach(clearTimeout);
      announce();
      el.querySelectorAll('.hr-row').forEach((r) => r.classList.add('in'));
      el.classList.add('decided');
      if (G) G.revealed = true;
      save();
    };
    const close = () => {
      timers.forEach(clearTimeout);
      document.removeEventListener('keydown', onKey);
      el.remove();
      render();
    };
    const onKey = (e) => {
      if (e.key !== 'Escape' && e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest && e.target.closest('[data-rv], a')) return;
      e.preventDefault();
      if (decided) close();
      else finish();
    };
    document.addEventListener('keydown', onKey);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rv]');
      if (b && b.dataset.rv === 'close') return close();
      if (b && b.dataset.rv === 'hist') {
        close();
        return showHistory();
      }
      if (b && b.dataset.rv === 'again') {
        close();
        if (G.mode === 'online') return showSetup(G.id);
        if (G.mode === 'sim') return startSim({ l0: G.levels[0], l1: G.levels[1], speed: G.speed });
        try {
          localStorage.removeItem(SAVE_KEY);
        } catch (err) {
          /* ignore */
        }
        return showSetup();
      }
      if (!decided) finish();
    });
    if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches) return finish();
    at(1300, () => {
      el.classList.add('suspense');
      el.querySelector('.hr-verdict').innerHTML = '<div class="hr-drum">And the winner is<i>.</i><i>.</i><i>.</i></div>';
    });
    at(3500, announce);
    rows.forEach((_, i) => at(5200 + i * 550, () => el.querySelectorAll('.hr-row')[i].classList.add('in')));
    at(5200 + rows.length * 550 + 400, finish);
  }

  function confetti() {
    const box = document.createElement('div');
    box.className = 'confetti';
    const bits = ['🎉', '✨', '🏰', '⭐', '🎊', '🌟'];
    for (let i = 0; i < 40; i++) {
      const sp = document.createElement('span');
      sp.textContent = bits[i % bits.length];
      sp.style.left = `${(i * 23) % 100}%`;
      sp.style.animationDelay = `${(i % 10) * 0.18}s`;
      sp.style.animationDuration = `${2.6 + (i % 5) * 0.4}s`;
      box.appendChild(sp);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 6000);
  }

  // ---------------------------------------------------------------- new game
  function newGame() {
    if (G.mode === 'online') return onlineMenu();
    if (G.mode === 'sim') return stopSim();
    // The current game stays saved: it's listed under Your games in the game lobby.
    if (window.BoardSaves) window.BoardSaves.flush();
    showSetup();
  }

  // ---------------------------------------------------------------- game history
  function newLocalId() {
    const b = new Uint8Array(8);
    crypto.getRandomValues(b);
    return 'hl' + [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  // Finished computer and two-player games go to the account's history (online games are added by the server).
  function recordGame() {
    const g = G;
    if (g.recorded || !sessionId()) return;
    const s = g.state;
    g.gid = g.gid || newLocalId();
    g.recorded = true;
    save();
    api('/api/oakhaven/history/record', {
      id: g.gid,
      kind: g.mode,
      level: g.level,
      names: s.players.map((p) => p.name),
      cats: s.players.map((p) => E.score(s, p)),
      winner: E.winner(s),
    }).then((r) => {
      if (r.ok || r.status === 400 || G !== g) return;
      g.recorded = false;
      save();
    });
  }

  const hist = { items: null, kind: 'all' };
  const SCORE_ROWS = [
    ['⭐ Renown', 'renown'],
    ['🏠 Buildings & wonders', 'buildings'],
    ['👥 Villagers', 'villagers'],
    ['🧱 Stone & Iron wall sections', 'walls'],
    ['🏰 Fully walled', 'fortified'],
    ['🪙 Gold', 'gold'],
    ['🎯 Goals', 'goals'],
  ];

  async function showHistory() {
    clearTimeout(ui.aiTimer);
    stopOnline();
    G = null;
    document.body.className = 'setup-mode';
    $('#app').innerHTML = `
      <div class="setup gh">
        <div class="gh-top"><a class="gh-lobby" href="/board-games.html" title="Back to the game lobby">← 🎲 Game lobby</a><button class="btn ghost sm" id="hist-new">🏰 New game</button></div>
        <div class="setup-card gh-card panel hist">
          <h2>🏆 Game history</h2>
          <div id="hist-body"><p class="muted">Loading your games…</p></div>
        </div>
      </div>`;
    $('#hist-new').onclick = () => showSetup();
    if (!sessionId()) {
      const back = encodeURIComponent(location.pathname.replace(/^\//, ''));
      $('#hist-body').innerHTML = `<div class="ol-gate"><p>Sign in to keep a history of your Oakhaven games — against the computer, on one device, or online.</p><a class="btn big" href="/account.html?return=${back}">Log in or sign up</a></div>`;
      return;
    }
    const r = await api('/api/oakhaven/history');
    if (!$('#hist-body')) return;
    if (r.status === 401) {
      try {
        localStorage.removeItem('ahrenslabs_sessionId');
      } catch (e) {
        /* ignore */
      }
      return showHistory();
    }
    if (!r.ok) {
      $('#hist-body').innerHTML = `<p class="bad">${esc(r.data.error || 'Couldn’t load your games.')}</p><button class="btn ghost sm" id="hist-retry">Try again</button>`;
      $('#hist-retry').onclick = showHistory;
      return;
    }
    hist.items = r.data.items || [];
    renderHistory();
  }

  function renderHistory() {
    const box = $('#hist-body');
    if (!box) return;
    const items = hist.items.filter((h) => hist.kind === 'all' || h.kind === hist.kind);
    const mine = items.filter((h) => h.me != null && h.cats);
    const count = (f) => mine.filter(f).length;
    const wins = count((h) => h.winner === h.me);
    const ties = count((h) => h.winner < 0);
    const myScores = mine.map((h) => h.cats[h.me].total);
    const stat = (n, label) => `<div class="hs"><b>${n}</b><small>${label}</small></div>`;
    const kinds = { all: 'All', ai: '🤖 Computer', local: '👥 Two players', online: '🌐 Online' };
    const icon = { ai: '🤖', local: '👥', online: '🌐' };
    const row = (h) => {
      const a = h.me === 1 ? 1 : 0;
      const b = 1 - a;
      const total = (i) => (h.cats ? h.cats[i].total : '–');
      let res = '';
      if (h.me != null) res = h.winner < 0 ? '<span class="hg-res tie">Tie</span>' : h.winner === h.me ? '<span class="hg-res win">Win</span>' : '<span class="hg-res loss">Loss</span>';
      else res = h.winner < 0 ? '<span class="hg-res tie">Tie</span>' : `<span class="hg-res">${esc(h.names[h.winner])} won</span>`;
      const when = new Date(h.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const what = [h.kind === 'ai' ? `Computer${h.level ? ' · ' + LEVEL_NAME[h.level] : ''}` : h.kind === 'local' ? 'Two players, one device' : 'Online', h.reason === 'resign' ? 'ended by resignation' : h.reason === 'timeout' ? 'ended on time' : '', when].filter(Boolean).join(' · ');
      const table = h.cats
        ? `<div class="hg-table">${SCORE_ROWS.map(([label, k]) => `<div><span>${h.cats[a][k] || 0}</span><small>${label}</small><span>${h.cats[b][k] || 0}</span></div>`).join('')}</div>`
        : '';
      return `<details class="hg"><summary><span class="hg-icon">${icon[h.kind] || '🏰'}</span><span class="hg-main"><b>${esc(h.names[a])} <em>${total(a)}</em> – <em>${total(b)}</em> ${esc(h.names[b])}</b><small>${esc(what)}</small></span>${res}</summary>${table}</details>`;
    };
    box.innerHTML = `
      <div class="seg hist-kind">${Object.keys(kinds).map((k) => `<button data-k="${k}" class="${hist.kind === k ? 'on' : ''}">${kinds[k]}</button>`).join('')}</div>
      <div class="hist-stats">
        ${stat(items.length, 'played')}
        ${stat(wins, 'won')}
        ${stat(mine.length - wins - ties, 'lost')}
        ${stat(ties, 'tied')}
        ${stat(myScores.length ? Math.max(...myScores) : '–', 'best score')}
        ${stat(myScores.length ? Math.round(myScores.reduce((t, x) => t + x, 0) / myScores.length) : '–', 'average')}
      </div>
      ${items.length ? `<div class="hist-list">${items.map(row).join('')}</div>` : '<p class="muted hist-empty">No finished games here yet. Games are added when they end.</p>'}
      <p class="muted hist-note">Wins and scores count your computer and online games. Tap a game to see how the points were scored.</p>`;
    box.querySelector('.hist-kind').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      hist.kind = b.dataset.k;
      renderHistory();
    };
  }

  // ---------------------------------------------------------------- computer vs computer (admin)
  function isAdmin() {
    try {
      return (localStorage.getItem('ahrenslabs_email') || '').trim().toLowerCase() === ADMIN_EMAIL;
    } catch (e) {
      return false;
    }
  }

  function openSimSetup() {
    if (!isAdmin()) return;
    const sim = Object.assign({ l0: 'hard', l1: 'normal', speed: 'fast' }, prefs().sim);
    const speeds = {};
    Object.keys(SIM_SPEEDS).forEach((k) => (speeds[k] = SIM_SPEEDS[k].name));
    const seg = (k, opts) => `<div class="seg" data-k="${k}">${Object.keys(opts).map((v) => `<button data-v="${v}" class="${sim[k] === v ? 'on' : ''}">${opts[v]}</button>`).join('')}</div>`;
    const back = openModal(`<h2>🧪 Computer vs computer</h2>
      <p class="muted">Admin only. Two computers play a whole game while you watch. Nothing is saved or added to game history.</p>
      <div class="field"><span class="label">🔴 Red village</span>${seg('l0', LEVEL_NAME)}</div>
      <div class="field"><span class="label">🔵 Blue village</span>${seg('l1', LEVEL_NAME)}</div>
      <div class="field"><span class="label">Speed</span>${seg('speed', speeds)}</div>
      <button class="btn big" id="sim-go">▶ Start</button>`);
    back.addEventListener('click', (e) => {
      const b = e.target.closest('.seg button');
      if (b) {
        sim[b.parentNode.dataset.k] = b.dataset.v;
        [...b.parentNode.children].forEach((x) => x.classList.toggle('on', x === b));
      }
      if (e.target.closest('#sim-go')) {
        savePrefs(Object.assign(prefs(), { sim }));
        startSim(sim);
      }
    });
  }

  function startSim(sim) {
    clearTimeout(ui.simTimer);
    ui.onClose = null;
    closeModal();
    const state = E.newGame({ names: [`Red · ${LEVEL_NAME[sim.l0]}`, `Blue · ${LEVEL_NAME[sim.l1]}`], ai: [true, true], first: Math.random() < 0.5 ? 0 : 1 });
    E.aiHeadStart(state, 0, sim.l0);
    E.aiHeadStart(state, 1, sim.l1);
    startFrom({ state, mode: 'sim', level: sim.l0, levels: [sim.l0, sim.l1], speed: sim.speed, view: 0 });
  }

  function stopSim() {
    clearTimeout(ui.aiTimer);
    clearTimeout(ui.simTimer);
    ui.onClose = null;
    closeModal();
    document.querySelectorAll('.hh-reveal').forEach((x) => x.remove());
    showSetup();
  }

  // ---------------------------------------------------------------- online play (Ahrens Labs accounts)
  // The server runs the same engine and is the only one that applies actions; the page sends an action
  // and draws whatever state comes back. One WebSocket per open game carries both directions.
  const net = { sock: null, ping: null, retry: null, poll: null, pending: null, lobby: null, err: '', focus: null, autoOpen: null };

  function sessionId() {
    try {
      return localStorage.getItem('ahrenslabs_sessionId') || '';
    } catch (e) {
      return '';
    }
  }
  function forgetOnline() {
    try {
      localStorage.removeItem(ONLINE_KEY);
    } catch (e) {
      /* ignore */
    }
  }
  function savedOnline() {
    try {
      return JSON.parse(localStorage.getItem(ONLINE_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }
  async function api(path, body) {
    let res;
    try {
      res = await fetch(API_BASE + path, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${sessionId()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      return { ok: false, status: 0, data: { error: 'Couldn’t reach the server. Check your connection.' } };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  function stopOnline() {
    clearInterval(net.ping);
    clearTimeout(net.retry);
    clearInterval(net.poll);
    net.ping = net.retry = net.poll = null;
    net.pending = null;
    const ws = net.sock;
    net.sock = null;
    if (ws) {
      try {
        ws.close();
      } catch (e) {
        /* ignore */
      }
    }
  }

  // ---- lobby (inside the setup screen)
  async function showLobby(focus) {
    net.focus = focus || net.focus;
    const box = $('#online-box');
    if (!box) return;
    if (!sessionId()) {
      const back = encodeURIComponent(location.pathname.replace(/^\//, '') + location.search);
      box.innerHTML = `<div class="ol-gate"><p>Play Oakhaven against another Ahrens Labs player — a quick game with a 2-minute turn clock, or a long game where you take your turn whenever you like.</p><a class="btn big" href="/account.html?return=${back}">Log in or sign up</a></div>`;
      return;
    }
    box.innerHTML = lobbyHtml(true);
    const r = await api('/api/oakhaven/games');
    if (!$('#online-box')) return;
    if (r.status === 401) {
      try {
        localStorage.removeItem('ahrenslabs_sessionId');
      } catch (e) {
        /* ignore */
      }
      return showLobby();
    }
    net.lobby = r.ok ? r.data.games || [] : null;
    net.err = r.ok ? '' : r.data.error || 'Couldn’t load your games.';
    renderLobby();
    const f = net.focus && net.lobby && net.lobby.find((g) => g.id === net.focus);
    net.focus = null;
    const auto = net.autoOpen;
    net.autoOpen = null;
    if (f && f.status === 'active' && G == null && auto === f.id) openOnline(f.id);
  }
  function renderLobby() {
    const box = $('#online-box');
    if (box) box.innerHTML = lobbyHtml(false);
  }
  function onlineStatus(g) {
    if (g.status === 'pending') return g.me === 1 ? `<b>${esc(g.opp)}</b> challenged you` : `Waiting for <b>${esc(g.opp)}</b> to accept`;
    if (g.status === 'active') return `${g.turn === g.me ? '<b class="ol-you">Your turn</b>' : `${esc(g.opp)}’s turn`} · round ${g.round} of ${E.ROUNDS} · ${g.mode === 'quick' ? '⚡ quick' : '🐢 long'}`;
    if (g.status === 'declined') return `${g.me === 1 ? 'You' : esc(g.opp)} declined`;
    if (g.status === 'cancelled') return 'Challenge cancelled';
    if (g.status === 'expired') return 'Nobody answered in a week';
    const r = g.result || {};
    const sc = r.scores ? ` · ${r.scores[g.me]}–${r.scores[1 - g.me]}` : '';
    const why = r.reason === 'resign' ? (r.winner === g.me ? ' — they resigned' : ' — you resigned') : r.reason === 'timeout' ? (r.winner === g.me ? ' — they ran out of time' : ' — you ran out of time') : '';
    return `${r.winner == null ? '🤝 Tie' : r.winner === g.me ? '🏆 You won' : 'You lost'}${sc}${why}`;
  }
  function lobbyHtml(loading) {
    const games = net.lobby || [];
    const btns = (g) => {
      if (g.status === 'pending' && g.me === 1) return `<button class="btn sm" data-ol="accept" data-id="${g.id}">Accept</button><button class="btn ghost sm" data-ol="decline" data-id="${g.id}">Decline</button>`;
      if (g.status === 'pending') return `<button class="btn ghost sm" data-ol="cancel" data-id="${g.id}">Cancel</button>`;
      if (g.status === 'active') return `<button class="btn sm" data-ol="open" data-id="${g.id}">${g.turn === g.me ? 'Play' : 'Open'}</button>`;
      if (g.status === 'over') return `<button class="btn ghost sm" data-ol="open" data-id="${g.id}">View</button>`;
      return '';
    };
    const list = games.length
      ? games.map((g) => `<li class="ol-game${g.status === 'active' && g.turn === g.me ? ' mine' : ''}${g.status === 'pending' && g.me === 1 ? ' invite' : ''}"><span class="ol-who">vs <b>${esc(g.opp)}</b><small>${onlineStatus(g)}</small></span><span class="ol-btns">${btns(g)}</span></li>`).join('')
      : `<li class="muted ol-empty">${loading ? 'Loading your games…' : 'No online games yet — challenge someone below.'}</li>`;
    return `<div class="ol">
      <div class="ol-head"><span class="label">Your online games</span><button class="btn ghost sm" data-ol="refresh" title="Refresh">↻</button></div>
      ${net.err ? `<p class="bad">${esc(net.err)}</p>` : ''}
      <ul class="ol-list">${list}</ul>
      <form class="ol-new" data-ol-form>
        <label><span class="label">Challenge a player</span><input id="ol-opp" maxlength="80" placeholder="Username or email" autocomplete="off"></label>
        <div class="seg ol-mode" id="ol-mode">${['quick', 'long'].map((m) => `<button type="button" data-v="${m}" class="${(prefs().olMode || 'quick') === m ? 'on' : ''}">${m === 'quick' ? '<b>⚡ Quick game</b><small>2 minutes per turn — play it now</small>' : '<b>🐢 Long game</b><small>No time limit — take your turn whenever, over days</small>'}</button>`).join('')}</div>
        <button class="btn" type="submit">Send challenge</button>
      </form>
      <p class="muted small">In a quick game, if your time runs out the computer takes that turn for you; miss three turns in a row and you lose. You’ll see each other’s moves live while you both have the game open.</p>
    </div>`;
  }
  document.addEventListener('submit', async (e) => {
    if (!e.target.closest('[data-ol-form]')) return;
    e.preventDefault();
    const inp = $('#ol-opp');
    const opponent = inp.value.trim();
    if (!opponent) return inp.focus();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    const pick = $('#ol-mode .on');
    const mode = pick ? pick.dataset.v : 'quick';
    savePrefs(Object.assign(prefs(), { olMode: mode }));
    const r = await api('/api/oakhaven/challenge', { opponent, mode });
    btn.disabled = false;
    if (!r.ok) return toast(esc(r.data.error || 'Couldn’t send the challenge.'), 'bad');
    toast(`Challenge sent to <b>${esc(r.data.game.opp)}</b>.`);
    net.lobby = [r.data.game].concat((net.lobby || []).filter((g) => g.id !== r.data.game.id));
    renderLobby();
  });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ol]');
    if (!b || b.disabled) return;
    const id = b.dataset.id;
    const what = b.dataset.ol;
    if (what === 'refresh') return showLobby();
    if (what === 'open') return openOnline(id);
    b.disabled = true;
    if (what === 'accept' || what === 'decline') {
      const r = await api('/api/oakhaven/respond', { id, accept: what === 'accept' });
      if (!r.ok) {
        b.disabled = false;
        toast(esc(r.data.error || 'That didn’t work.'), 'bad');
        return showLobby();
      }
      if (what === 'accept') return enterOnline(r.data);
      return showLobby();
    }
    if (what === 'cancel') {
      await api('/api/oakhaven/resign', { id });
      showLobby();
    }
  });

  // ---- an online game
  async function openOnline(id) {
    if (!G && !$('.setup')) $('#app').innerHTML = '<p class="ol-loading">Loading your game…</p>';
    const r = await api(`/api/oakhaven/game?id=${encodeURIComponent(id)}`);
    if (!r.ok || !r.data.state) {
      forgetOnline();
      toast(esc(r.data.error || 'Couldn’t open that game.'), 'bad');
      if (!G && !$('.setup')) showSetup();
      return;
    }
    enterOnline(r.data);
  }
  function enterOnline(v) {
    const mem = savedOnline();
    const same = mem && mem.id === v.id;
    const s = v.state;
    G = {
      mode: 'online',
      id: v.id,
      me: v.me,
      view: v.me,
      version: v.version,
      status: v.status,
      result: v.result,
      gmode: v.mode || 'long',
      deadline: v.deadline || null,
      skew: v.now ? v.now - Date.now() : 0,
      state: s,
      revealed: same ? mem.revealed : false,
      duskSeen: same ? mem.duskSeen : 0,
    };
    if (history.replaceState) history.replaceState(null, '', `${location.pathname}?game=${v.id}`);
    startFrom(G);
    if (G.status === 'over' && s.phase !== 'over' && !G.revealed) showResigned();
  }
  function onlineEndText() {
    const r = G.result || {};
    const opp = st().players[1 - G.me].name;
    if (G.status === 'over' && r.reason === 'resign') return r.winner === G.me ? `${opp} resigned — you win!` : 'You resigned.';
    if (G.status === 'over' && r.reason === 'timeout') return r.winner === G.me ? `${opp} ran out of time three turns in a row — you win!` : 'You ran out of time three turns in a row, so the game is over.';
    return 'This game has ended.';
  }
  function showResigned() {
    G.revealed = true;
    save();
    openModal(`<h2>${G.result && G.result.winner === G.me ? '🏆 You win!' : '🏳️ Game over'}</h2><p>${esc(onlineEndText())}</p><div class="btn-row"><button class="btn" data-close>See the villages</button><button class="btn ghost" data-ol-lobby>Your games</button></div>`).addEventListener('click', (e) => {
      if (!e.target.closest('[data-ol-lobby]')) return;
      ui.onClose = null;
      closeModal();
      showSetup(G.id);
    });
  }
  function showOnlineDusk() {
    const rep = st().dusk;
    G.duskSeen = rep.round;
    save();
    showDusk(rep, rep.arrived || []);
  }
  function onlineMenu() {
    const active = G.status === 'active';
    const back = openModal(`<h2>🌐 Online game</h2><p>Playing <b>${esc(st().players[1 - G.me].name)}</b>. The game is saved on the server — you can come back to it any time.</p><div class="btn-row"><button class="btn" data-m="lobby">Back to your games</button>${active ? '<button class="btn lava" data-m="resign">Resign</button>' : ''}<button class="btn ghost" data-close>Keep playing</button></div>`);
    back.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      if (b.dataset.m === 'lobby') {
        ui.onClose = null;
        closeModal();
        forgetOnline();
        return showSetup(G.id);
      }
      if (b.dataset.m === 'resign') {
        b.disabled = true;
        const r = await api('/api/oakhaven/resign', { id: G.id });
        ui.onClose = null;
        closeModal();
        if (r.ok) applyView(r.data);
        else toast(esc(r.data.error || 'Couldn’t resign.'), 'bad');
      }
    });
  }

  function sendOnline(a) {
    if (G.status !== 'active') return toast('This game is over.');
    if (net.pending) return toast('One moment…');
    net.pending = { a, at: Date.now() };
    $('#app').classList.add('ol-wait');
    const msg = { type: 'act', id: G.id, base: G.version, a };
    if (net.sock && net.sock.readyState === 1) {
      net.sock.send(JSON.stringify(msg));
      setTimeout(() => {
        if (net.pending && Date.now() - net.pending.at >= 7900) actViaHttp(msg);
      }, 8000);
    } else actViaHttp(msg);
  }
  async function actViaHttp(msg) {
    const r = await api('/api/oakhaven/act', { id: msg.id, base: msg.base, a: msg.a });
    if (!G || G.id !== msg.id) return;
    if (!r.ok && r.data.error) toast(esc(r.data.error), 'bad');
    if (r.data.state || r.data.version) applyView(r.data);
    else settlePending();
  }
  function settlePending() {
    net.pending = null;
    const app = $('#app');
    if (app) app.classList.remove('ol-wait');
  }

  // Draw a fresh server view: toasts for the opponent's moves, the dusk report, the final reveal.
  function applyView(v) {
    if (!G || G.mode !== 'online' || v.id !== G.id) return;
    settlePending();
    if (v.version < G.version) return;
    const prev = G.state;
    G.version = v.version;
    G.status = v.status;
    G.result = v.result;
    G.deadline = v.deadline || null;
    if (v.now) G.skew = v.now - Date.now();
    if (!v.state) return render();
    const s = v.state;
    G.state = s;
    const opp = 1 - G.me;
    const oldIds = new Set(prev.players.flatMap((p) => p.bld.map((b) => b.id)));
    s.players.forEach((p) => p.bld.forEach((b) => !oldIds.has(b.id) && ui.fresh.add(b.id)));
    if (s.round === prev.round && s.phase === 'act') {
      const last = prev.log[prev.log.length - 1];
      let from = 0;
      if (last) for (let i = s.log.length - 1; i >= 0; i--) if (s.log[i].text === last.text && s.log[i].r === last.r) { from = i + 1; break; }
      s.log.slice(from).filter((l) => l.who === opp).forEach((l) => toast(`<span class="dot" style="--pc:${PCOLOR[opp]}"></span>${esc(l.text)}`, 'ai'));
    }
    ui.pick = null;
    save();
    render();
    if (s.dusk && s.dusk.round > (G.duskSeen || 0)) {
      if (ui.modal) closeModal();
      return showOnlineDusk();
    }
    if (G.status === 'over' && s.phase !== 'over' && !G.revealed) return showResigned();
    if (prev.turn !== s.turn && s.turn === G.me && s.phase === 'act') handoff();
  }

  // Quick online games: count down the current turn's time limit (the server enforces it).
  function tickClock() {
    clearTimeout(net.clock);
    const el = $('#ol-clock');
    if (!el || !G || !G.deadline) return;
    const left = Math.max(0, Math.round((G.deadline - Date.now() - (G.skew || 0)) / 1000));
    const mine = st().turn === G.me;
    el.textContent = `⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}${mine ? '' : ' them'}`;
    el.className = `ol-clock${mine ? ' mine' : ''}${left <= 20 ? ' low' : ''}`;
    el.title = mine ? 'Time left for your turn. If it runs out, the computer takes the turn for you.' : 'Time left for their turn.';
    net.clock = setTimeout(tickClock, 1000);
  }

  function connectSock() {
    if (!G || G.mode !== 'online' || net.sock || G.status !== 'active') return;
    const id = G.id;
    const url = `${API_BASE.replace(/^http/, 'ws')}/api/oakhaven/live?id=${encodeURIComponent(id)}&session=${encodeURIComponent(sessionId())}`;
    let ws;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      return startPoll();
    }
    net.sock = ws;
    ws.addEventListener('open', () => {
      clearInterval(net.poll);
      net.poll = null;
      clearInterval(net.ping);
      net.ping = setInterval(() => net.sock === ws && ws.readyState === 1 && ws.send('ping'), 30000);
    });
    ws.addEventListener('message', (e) => {
      if (net.sock !== ws || e.data === 'pong') return;
      let m;
      try {
        m = JSON.parse(e.data);
      } catch (err) {
        return;
      }
      if (m.type === 'reject') toast(esc(m.error || 'That move didn’t go through.'), 'bad');
      if (m.type === 'state' && m.by === G.me && m.version <= G.version) return;
      applyView(m);
    });
    ws.addEventListener('close', () => {
      if (net.sock !== ws) return;
      net.sock = null;
      clearInterval(net.ping);
      if (!G || G.id !== id || G.status !== 'active') return;
      if (net.pending) actViaHttp({ id, base: G.version, a: net.pending.a });
      startPoll();
      clearTimeout(net.retry);
      net.retry = setTimeout(connectSock, 5000);
    });
    ws.addEventListener('error', () => {
      try {
        ws.close();
      } catch (err) {
        /* ignore */
      }
    });
  }
  // Fallback while the live connection is down: check for changes now and then (cheap "unchanged" replies).
  function startPoll() {
    if (net.poll) return;
    net.poll = setInterval(async () => {
      if (!G || G.mode !== 'online' || document.hidden || net.sock) return;
      const r = await api(`/api/oakhaven/game?id=${encodeURIComponent(G.id)}&v=${G.version}`);
      if (r.ok && !r.data.unchanged) applyView(r.data);
    }, 20000);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !G || G.mode !== 'online') return;
    if (!net.sock) connectSock();
  });

  // ---------------------------------------------------------------- rules
  const RULE_TABS = [
    ['video', '🎬 Video tutorial'],
    ['basics', 'Basics'],
    ['round', 'A round'],
    ['places', 'Workers & places'],
    ['free', 'Free actions'],
    ['night', 'Night & supper'],
    ['goals', 'Goals & events'],
    ['buildings', 'Buildings'],
    ['villagers', 'Villagers'],
    ['creatures', 'Creatures'],
    ['scoring', 'Scoring & end'],
  ];
  function strRange(t) {
    const s = E.BEAST_ORDER.filter((k) => E.BEAST[k].tier === t).map((k) => E.BEAST[k].str);
    return `⚔️${Math.min(...s)}–${Math.max(...s)}`;
  }
  function rulesBody(tab) {
    if (tab === 'video')
      return window.AhrensTutorial
        ? `<p class="lead">Watch a full game explained step by step. Use the chapter buttons to jump to any part, and turn on captions if you like.</p>${window.AhrensTutorial.embed('hearthhold')}`
        : '<p>The video tutorial couldn’t load. Please refresh the page.</p>';
    if (tab === 'basics')
      return `
      <p class="lead">Two villages grow side by side for <b>3 years</b> — 12 rounds, one per season. Each round you send your <b>workers</b> to the places on offer, build and recruit as much as you can pay for, and then the night comes: your village works, a creature attacks <i>both</i> villages, and everyone eats. After the 12th round the village with the most <b>⭐ points</b> wins.</p>
      <h4>Your village</h4>
      <p>Each village has its own copy of the same map: 37 hexes in three rings around the <b>Keep</b> in the middle — 13 meadow, 13 plains, 4 forest, 3 hills and 3 mountain. One building fits on each hex, and the land decides which:</p>
      <table class="rules-table"><tr><th>Land</th><th>What fits</th></tr>
        <tr><td>🌼 Meadow</td><td>Farms — or any town building</td></tr>
        <tr><td>🟫 Plains</td><td>Any town building (Houses, Wells, Inns, Markets, wonders…) — not Farms</td></tr>
        <tr><td>🌲 Forest</td><td>Lumber camps only</td></tr>
        <tr><td>⛰️ Hills</td><td>Quarries only</td></tr>
        <tr><td>🏔️ Mountain</td><td>Mines only</td></tr></table>
      <h4>Where you build</h4>
      <ul>
        <li>Your village grows <b>outwards from the Keep</b>: every new building must sit next to one you already have. To reach a far-off forest, hill or mountain, build your way towards it.</li>
        <li><b>Distance matters.</b> Watchtowers and the Wizard’s Tower only defend the sides close to them, and when a creature breaks through it burns the building — and carries off the villagers — <b>nearest the side it attacked</b>. Keep your best buildings away from your weakest walls.</li>
        <li><b>Neighbours matter.</b> A Farm next to a Well makes more food, a Market next to an Inn makes more gold, a House next to a Chapel scores ⭐1 — but a House or Inn next to a noisy <b>Smithy, Barracks or Market</b> sleeps 1 fewer.</li>
      </ul>
      <h4>Resources</h4>
      <table class="rules-table"><tr><th>Resource</th><th>Used for</th></tr>
        <tr><td>🍞 Food</td><td>Every villager eats 🍞1 every night.</td></tr>
        <tr><td>🪵 Wood</td><td>Buildings and Palisades. In Winter it is also firewood.</td></tr>
        <tr><td>🪨 Stone</td><td>Buildings, Wells and Stone walls.</td></tr>
        <tr><td>🔩 Iron</td><td>Mines, Smithies, wonders, Knights, Iron walls, crossbows, and the Blacksmith’s arms.</td></tr>
        <tr><td>🪙 Gold</td><td>Recruiting travellers, a few buildings and <b>wages</b>: as Spring begins in years 2 and 3, every villager with a job is paid 🪙1. Left-over gold scores ⭐1 per 🪙5.</td></tr></table>
      <p>There is no limit on how much you can store. You can never pay with resources you don’t have.</p>
      <h4>Room for villagers</h4>
      <ul>
        <li>Every villager needs a <b>bed</b> 🛏️ and <b>water</b> 💧. Your room is the smaller of your beds and your water, minus the villagers you already have. With no room you can’t take anyone in.</li>
        <li>Beds: Keep 3, House 4, Inn 3, Barracks 2, Castle +3 — a House or Inn next to a Smithy, Barracks or Market sleeps 1 fewer. Water: Keep 3, Well 5.</li>
        <li>Villagers who aren’t working a building are <b>idle</b>: they make nothing but still eat.</li>
      </ul>
      <h4>How you start</h4>
      <ul>
        <li>A Keep, a Farm on a meadow next to it, and two Peasants — one works the Farm, the other is idle until you give them a job.</li>
        <li>🍞4 🪵5 🪨2 and 🪙4. The village that goes second in round 1 gets 🪙5 instead.</li>
        <li>2 workers every round (3 once a Steward works your Keep).</li>
      </ul>
      <h4>Where workers go</h4>
      <p>Five main places are drawn for each game, and each takes only one worker per round. Two weaker <b>always-open</b> places — the Village commons and Odd jobs — take any number of workers.</p>
      <h4>Scores are secret</h4>
      <p>You can always look at both villages, the places, the Crossroads, the goals and the creatures coming, but nobody’s ⭐ total is shown during the game. It is revealed, category by category, after the last night.</p>
      <h4>Playing the computer</h4>
      <p>Easy makes plenty of mistakes and Normal plays a fair game. Hard plans further ahead, blocks the places you need and starts with 🍞1 🪵3 🪨2 🪙3 extra. Brutal plays its best and starts with 🍞3 🪵5 🪨4 🔩1 🪙5 extra.</p>`;
    if (tab === 'round')
      return `
      <h4>1. Morning</h4>
      <p>Each village gets its workers: <b>${E.BASE_WORKERS}</b>, plus 1 if a Steward works the Keep. Every place is empty again.</p>
      <h4>2. Day — take turns</h4>
      <ol class="steps">
        <li>On your turn, do as many <b>free actions</b> as you like and can pay for, in any order: build, wall, recruit, train, trade and move villagers. In two seasons each year, kept secret until they arrive, there is also a <b>season event</b> to answer (see Goals &amp; events) — you must choose before you end the round.</li>
        <li>Then either <b>send one worker</b> to an empty place (or one of the always-open places) — you get its reward straight away and your turn ends — or press <b>End round</b>.</li>
        <li>If that was your <b>last</b> worker, your turn doesn’t end: finish any free actions (you can use what the place just gave you) and then press End round.</li>
        <li>Once you end the round you can’t do anything more until tomorrow. Any workers you didn’t place are wasted. Your rival keeps taking turns until they end too.</li>
      </ol>
      <h4>3. Dusk</h4>
      <p>When both villages have ended, the night plays out for both at once — see <i>Night &amp; supper</i>. Then the next round starts.</p>
      <h4>Who goes first</h4>
      <p>You choose who starts round 1 (or pick at random). After that it <b>alternates every round</b>. Going first means first pick of the places.</p>
      <h4>What only lasts one round</h4>
      <p>Everything a place gives you for “tonight” or “this round” wears off when the next round starts: the Militia yard and Watch post defense, the Granary bonus, Trading post trades and the Tavern and Guild hall discounts.</p>
      <h4>Seasons</h4>
      <table class="rules-table">${E.SEASONS.map((k) => `<tr><td>${E.SEASON[k].icon} ${E.SEASON[k].name}</td><td>${E.SEASON[k].note}</td></tr>`).join('')}</table>
      <p>Rounds 1–4 are year 1, 5–8 year 2 and 9–12 year 3. Each year runs Spring, Summer, Autumn, Winter.</p>`;
    if (tab === 'places') {
      const inGame = G ? new Set(st().locs) : null;
      return `
      <p class="lead">Places are the only thing you need workers for. Every game uses <b>${E.LOCS_PER_GAME}</b> places — one drawn from each group below, ${E.LOC_ORDER.length} in all — so each game plays a little differently.${inGame ? ' This game’s places are marked <b>✓</b>.' : ''}</p>
      <ul>
        <li>Each place holds <b>one worker per round</b>, from either village. Whoever gets there first takes it; the other village can’t use it that round.</li>
        <li>You get the reward the moment you place the worker. The place card shows exactly what you would get right now.</li>
        <li>You can’t place two workers on the same place, and you never have to place all your workers.</li>
        <li>The <b>Work crew</b> is in every game too, and holds one worker per round like the main places. It finishes every building you have under construction straight away and sends their builders back to work tonight — free to build again, too. So build first, then send the worker. Anything you build after that is a normal building site again.</li>
        <li>Two <b>always-open places</b> are in every game as well. They give much less, but they have <b>no limit</b>: any number of workers from either village can go there, even several of yours in the same round. They’re there so a spare worker — say when you have 3 workers with a Steward and the five main places are full — still does something.</li>
      </ul>
      ${E.LOC_GROUPS.map(
        (g) => `<h4>${g.icon} ${g.name}</h4><table class="rules-table fixed">${E.LOC_ORDER.filter((k) => E.LOC[k].group === g.k)
          .map((k) => `<tr><td>${inGame && inGame.has(k) ? '✓ ' : ''}<b>${E.LOC[k].name}</b></td><td>${E.LOC[k].text}</td></tr>`)
          .join('')}</table>`,
      ).join('')}
      <h4>🔨 In every game (one worker)</h4><table class="rules-table fixed">${E.FIXED_LOCS.map((k) => `<tr><td><b>${E.LOC[k].name}</b></td><td>${E.LOC[k].text}</td></tr>`).join('')}</table>
      <h4>♾️ Always open (every game, no limit)</h4><table class="rules-table fixed">${E.OPEN_LOCS.map((k) => `<tr><td><b>${E.LOC[k].name}</b></td><td>${E.LOC[k].text}</td></tr>`).join('')}</table>
      <h4>The fine print</h4>
      <ul>
        <li><b>Mill fields</b> counts every Farm you have built, worked or not.</li>
        <li><b>Granary</b> only helps Farms that someone works tonight.</li>
        <li><b>Market square</b> counts all your villagers, working or idle (2 villagers = 🪙3, 4 = 🪙4…).</li>
        <li><b>Trading post</b> makes trades 1 for 1 from then until the round ends.</li>
        <li><b>Moneylender</b> can take your ⭐ below zero.</li>
        <li><b>Tavern</b> and <b>Guild hall</b> discounts add up and come off after the Crossroads discount. They work on Peasants too, and a recruit can become free.</li>
        <li><b>Guild hall</b> sends all the travellers at the Crossroads back to the bottom of the deck and draws 5 new ones.</li>
        <li><b>Town crier</b>: the Peasant needs a bed and water like anyone else, and takes a free labor job if there is one.</li>
        <li><b>Festival green</b> counts every Inn you have, worked or not.</li>
        <li><b>Militia yard</b> counts your villagers when you place the worker.</li>
        <li><b>Mason’s lodge</b> raises tonight’s side for free, then you pick one more side (it can be the same side, to take it from bare to Stone). It never goes above Stone. If tonight’s creature flies, or its side is already Stone, the free raise goes to your weakest side instead. If every side is already Stone, nothing happens.</li>
        <li><b>Armory</b> still gives 🔩1 when you already have 6 sets of arms.</li>
      </ul>`;
    }
    if (tab === 'free')
      return `
      <p class="lead">Free actions don’t need a worker. On your turn you can do them <b>as often as you like</b> — before or after placing a worker — as long as you can pay.</p>
      <table class="rules-table">
        <tr><th>Action</th><th>Exactly what happens</th></tr>
        <tr><td>🏗️ Build</td><td>Pay the cost, pick a <b>villager to build it</b>, and put the building on a free hex of the right land <b>next to one of your buildings</b>. The builder <b>leaves their job</b> (an idle villager steps into it if you have one) and spends the rest of the round on the site: they don’t work, defend or build anything else until it is finished, and next season they take any free job. Idle villagers make the best builders. <b>New buildings are under construction 🚧 until next season</b>: they make nothing, add no beds, water or defense, and their workers don’t work yet. A worker at the <b>Work crew</b> finishes them early and frees your builders to work — or build again — straight away. Build as many as you can afford, even several of the same kind. Wonders also need enough villagers and only one village can build each (see Buildings).</td></tr>
        <tr><td>🧱 Wall</td><td>Each of your 6 sides can have a wall. A bare side becomes a <b>Palisade</b> (🪵2, 🛡️2); a Palisade becomes <b>Stone</b> (🪨3, 🛡️4 in total); Stone becomes <b>Iron</b> (🪨1 🔩2, 🛡️6 in total). A wall only defends against creatures on foot attacking <i>that side</i>.</td></tr>
        <tr><td>🏹 Crossbow</td><td>Mount a crossbow on any wall (🪵2 🔩1, one per side): 🛡️4 against <b>flyers</b> attacking that side. If the wall is destroyed — or a Palisade falls to frost — its crossbow falls too.</td></tr>
        <tr><td>🧑‍🌾 Recruit</td><td>Take a traveller from the Crossroads and pay their 🪙 price (Knights also cost 🔩1). You need room: a free bed and free water. A Peasant for 🪙1 is always available.</td></tr>
        <tr><td>🎓 Train</td><td><b>Once a round</b>, one of your Peasants learns any trade you choose. Pay that trade’s full price plus 🪙${E.TRAIN_FEE} (Knights also cost 🔩1); discounts from the Tavern or Guild hall count. They need no new bed or water, and they move into their own building if you have one — an untrained worker there goes back to the fields.</td></tr>
        <tr><td>⚖️ Trade</td><td>Give 2 of any one resource for 1 of any other, as many times as you want. With a working Merchant, or after using the Trading post this round, it’s 1 for 1.</td></tr>
        <tr><td>🔁 Move</td><td>Move a villager to another building they can work that has a free job, or make them idle. Click a villager in the list or a building on the map.</td></tr>
        <tr><td>⏭️ End round</td><td>You’re done for today. Unplaced workers are lost.</td></tr>
      </table>
      <h4>The Crossroads</h4>
      <ul>
        <li>Five travellers wait in a line. The <b>first</b> costs 🪙2 less and the <b>second</b> 🪙1 less, but never less than 🪙1 — then Tavern and Guild hall discounts come off.</li>
        <li>When you take someone, everyone behind them moves up a spot. The line refills only at night.</li>
        <li>Each night the traveller at the front of the line moves on — back to the bottom of the deck, so they may turn up again later.</li>
      </ul>
      <h4>Jobs</h4>
      <ul>
        <li>Each traveller has a trade (★) and works best in their own building. Inns, Workshops, Smithies, Bakeries, Markets, Chapels, Barracks, Watchtowers, the Wizard’s Tower and the Keep only take their own trade.</li>
        <li><b>Anyone</b> can work a Farm, Lumber camp, Quarry or Mine as plain labor; their own trade there makes more.</li>
        <li>New villagers take a job automatically: their own building if it has room, otherwise a free Farm, Lumber camp, Quarry or Mine, otherwise idle.</li>
        <li>When you build, idle villagers who fit move in, and specialists doing labor move to their own new building.</li>
        <li>Each building holds 1 worker (Barracks 2). Houses, Wells and wonders without a job hold none.</li>
        <li>A Carpenter in a Workshop makes everything with wood in its cost 🪵1 cheaper, Palisades too.</li>
      </ul>`;
    if (tab === 'night')
      return `
      <p class="lead">Once both villages have ended the round, these steps happen in order for each village.</p>
      <ol class="steps">
        <li><b>Work.</b> Every worked building produces (see Buildings and Villagers). Markets make 🪙1 even with nobody in them (+1 next to an Inn).</li>
        <li><b>Forge.</b> Each working Blacksmith turns 🔩1 into 1 set of arms if you have iron (most 6 sets).</li>
        <li><b>Attack.</b> Tonight’s creature attacks both villages. If your 🛡️ defense is <b>at least</b> its ⚔️ strength you drive it off: gain its ⭐ trophy and any 🪙 loot. Otherwise its damage happens.</li>
        <li><b>Supper.</b> Each villager eats 🍞1. For each 🍞 you are short, one villager leaves and you lose ⭐1.</li>
        <li><b>Firewood (Winter only).</b> Burn 🪵1 for every 3 villagers, rounded up (4 villagers burn 🪵2). For each 🪵 you are short, one villager leaves and you lose ⭐1.</li>
        <li><b>Frost (Winter only).</b> Each Palisade needs 🪵1 of repairs, paid after firewood. With no wood left, it falls. Stone and Iron walls don’t need mending. A crossbow on a fallen palisade falls with it.</li>
        <li><b>Wages (the night before Spring in years 2 and 3).</b> Every villager with a job is paid 🪙1, the most valuable first. Anyone you can’t pay leaves, and you lose ⭐1 for each.</li>
        <li><b>Goals (after Winter).</b> The year’s 3 goals are scored — see Goals &amp; events.</li>
        <li><b>Crossroads.</b> The traveller at the front moves on; new ones arrive until there are 5 again.</li>
      </ol>
      <h4>Your defense tonight</h4>
      <ul>
        <li>Keep 🛡️1, plus 🛡️3 with the Castle.</li>
        <li>Each Watchtower 🛡️2 and the Wizard’s Tower 🛡️1, even with nobody inside — but only against attacks from a side within <b>2 rows</b> (Watchtower) or <b>3 rows</b> (Wizard’s Tower) of the tower. A hex on the edge is 0 rows from that side; the Keep is 3 rows from every side. When you place a tower, the map shows which sides it would cover.</li>
        <li>Each set of arms 🛡️1.</li>
        <li>Working Guards 🛡️2 and Knights 🛡️4 on any side. Archers 🛡️2 (+3 against flyers) and the Wizard 🛡️3 (+4 against flyers and the undead) only on the sides their tower covers. Priests +4 against the undead only.</li>
        <li>The wall on the side being attacked: Palisade 🛡️2, Stone 🛡️4, Iron 🛡️6. Flyers ignore walls, but they still come from one side, so towers must be in range — and a crossbow on that side's wall adds 🛡️4 against them.</li>
        <li>Anything a place gave you for tonight (Militia yard, Watch post).</li>
      </ul>
      <h4>When a creature breaks through</h4>
      <table class="rules-table">
        <tr><th>Damage</th><th>Exactly what happens</th></tr>
        <tr><td>Lose resources</td><td>You lose up to the amount shown; you can’t go below 0.</td></tr>
        <tr><td>Wall drops a level</td><td>Iron becomes Stone, Stone becomes a Palisade and a Palisade becomes bare, on the side attacked. A crossbow falls if its wall does.</td></tr>
        <tr><td>Wall smashed</td><td>The wall on that side is gone completely.</td></tr>
        <tr><td>Villager carried off</td><td>Whoever works nearest the side attacked (idle villagers count as being at the Keep); on a tie the least valuable. No ⭐ lost unless the creature says so.</td></tr>
        <tr><td>Turned to stone</td><td>Your most valuable villager (price + points) is lost.</td></tr>
        <tr><td>Building burns</td><td>The building nearest the side attacked (not the Keep or a wonder) is destroyed — the most valuable one on a tie. Its workers move to another job or go idle.</td></tr>
        <tr><td>Lose ⭐</td><td>Comes off your renown and can take it below 0.</td></tr>
      </table>
      <p>Villagers lost to the attack don’t eat at supper, and firewood is counted after supper.</p>`;
    if (tab === 'goals')
      return `
      <h4>🎯 Goals</h4>
      <p>Each year brings <b>3 new goals</b>, drawn from the ${E.GOAL_ORDER.length} below, so a game uses 9 different ones. A year’s goals are revealed when its Spring begins and shown beside the map, with what each village has done towards them so far.</p>
      <p>Goals count only what you do <b>during that year</b>: Farms built, villagers gained, creatures driven off and so on, counted from the start of Spring. Fat purse and Full larder look at what you have when the year ends. Right after Winter’s night, the village that did most on each goal scores ⭐${E.GOAL_PTS}; a tie gives ⭐${E.GOAL_PTS / 2} each, and nobody scores if both did nothing.${G && E.goalsOfYear(st(), E.yearOf(st().round)).length && !E.legacyGoals(st()) ? ' This year’s goals are marked <b>✓</b>.' : ''}</p>
      <table class="rules-table">${E.GOAL_ORDER.map((g) => `<tr><td>${G && E.goalsOfYear(st(), E.yearOf(st().round)).includes(g) ? '✓ ' : ''}${E.GOALS[g].icon} <b>${E.GOALS[g].name}</b></td><td>${E.GOALS[g].text}${E.GOALS[g].stock ? '' : ' this year'}</td></tr>`).join('')}</table>
      <h4>📰 Season events</h4>
      <p><b>Two seasons each year</b>, picked at random when the game starts (never the very first round), bring an <b>event</b> that both villages face. Which seasons they are, and which event it is, stay secret until that round begins; past events are marked 📰 on the season track. Each village picks one of its options on its own turn, and must do so before ending the round. Effects happen at once, or tonight if they say so. If you can’t pay for an option, you can’t pick it — there is always one you can. Events never repeat in a game, and some only happen in certain seasons.</p>
      <div class="gallery">${Object.keys(E.EVENTS).map((k) => {
        const ev = E.EVENTS[k];
        return `<div class="gcard ev"><span class="ev-icon">${ev.icon}</span><div><b>${esc(ev.name)}</b>${ev.when ? `<div class="g-cost">${ev.when.map((w) => E.SEASON[w].name).join(' or ')} only</div>` : ''}<p class="muted">${esc(ev.text)}</p><ul>${ev.opts.map((o) => `<li><b>${esc(o.label)}:</b> ${o.text}</li>`).join('')}</ul></div></div>`;
      }).join('')}</div>`;
    if (tab === 'buildings')
      return `<ul>
        <li>Buildings with a job only score their ⭐ while someone who can work there is in them. Houses, Wells and wonders always score.</li>
        <li><b>Wonders</b> (Castle, Wizard’s Tower, Cathedral): only <b>one</b> village can build each, and you need enough villagers when you build it. The Castle upgrades your Keep and doesn’t take a hex.</li>
        <li>A Well next to a Farm gives that Farm +🍞1 whenever it produces. A Market next to an Inn makes +🪙1. Each House next to a Chapel scores ⭐1.</li>
        <li>Smithies, Barracks and Markets are <b>noisy</b>: a House or Inn next to one sleeps 1 fewer.</li>
        <li>Every new building must touch one you already have, so plan a path to the land you need.</li>
      </ul><div class="gallery">${E.BUILD_ORDER.concat(['keep'])
        .map((b) => {
          const B = E.BUILD[b];
          return `<div class="gcard" style="--bc:${B.color}"><img src="${IMG(b)}" alt=""><div><b>${B.name}</b>${B.wonder ? ' <span class="wtag">Wonder</span>' : ''}<div class="g-cost">${B.start ? 'You start with it' : cost(B.cost)}${B.on ? ` · ${B.on.map((t) => E.TERRAIN[t].name).join('/')}` : ''}${B.pts ? ` · ⭐${B.pts}` : ''}</div><p>${B.text}</p>${jobLine(b)}</div></div>`;
        })
        .join('')}</div>`;
    if (tab === 'villagers')
      return `<p>Prices are in 🪙 before discounts. The deck holds ${Object.values(E.DECK).reduce((a, b) => a + b, 0)} travellers (the number of each is shown); a traveller who leaves the Crossroads at night goes back to the bottom of the deck. Each villager scores the ⭐ shown at the end of the game as long as they still live with you.</p><div class="gallery">${E.VIL_ORDER.map((k) => {
        const V = E.VIL[k];
        return `<div class="gcard v"><img src="${IMG(k)}" alt=""><div><b>${V.name}</b><div class="g-cost">🪙${V.cost}${V.iron ? ` 🔩${V.iron}` : ''} · ⭐${V.pts}${E.DECK[k] ? ` · ×${E.DECK[k]} in deck` : ' · always available'}</div><p>${V.text}</p><small class="muted">Works at: ${V.at ? E.BUILD[V.at].name : 'any labor building'}</small></div></div>`;
      }).join('')}</div>`;
    if (tab === 'creatures')
      return `<ul>
        <li>Round 1 is always the <b>Wolf pack</b>. Rounds 2–4 bring three of the other year-1 creatures, rounds 5–8 four of the five year-2 creatures, and rounds 9–12 four of the five year-3 creatures, in a random order.</li>
        <li>Strength rises each year: year 1 ${strRange(1)}, year 2 ${strRange(2)}, year 3 ${strRange(3)}.</li>
        <li>Every creature attacks from <b>one side</b>. Creatures on foot have to get past the wall there; flyers come over the walls, but towers only defend nearby sides against them too.</li>
        <li>You don’t see everything coming. <b>Tonight’s</b> creature and its side are always shown. <b>Tomorrow’s</b> creature is shown, but its side only if you have a <b>Watchtower</b>. The one <b>after that</b> only shows whether it flies — unless an <b>Archer</b> works in one of your Watchtowers. A scholar’s reading (an event) shows everything for one round.</li>
        <li>The same creature attacks both villages, and each village fights it separately.</li>
      </ul>${[1, 2, 3]
        .map(
          (t) =>
            `<h4>${['', 'Year 1', 'Year 2', 'Year 3'][t]}</h4><div class="gallery">${E.BEAST_ORDER.filter((k) => E.BEAST[k].tier === t)
              .map((k) => {
                const B = E.BEAST[k];
                const bt = E.beastText(k);
                return `<div class="gcard c"><img src="${IMG(k)}" alt=""><div><b>${B.name}</b> <span class="th-str">⚔️${B.str}</span><div class="g-cost">${E.beastKind(k)}</div><p><span class="good">Drive off: ${bt.win}</span><br><span class="bad">If not: ${bt.lose}</span></p></div></div>`;
              })
              .join('')}</div>`,
        )
        .join('')}`;
    if (tab === 'scoring')
      return `
      <p>After the 12th night the game ends and the scores are revealed one category at a time.</p>
      <table class="rules-table">
        <tr><th>Source</th><th>Points</th></tr>
        <tr><td>⭐ Renown</td><td>Gained from trophies, working Bards, Priests and the Wizard (⭐1 each per round) and the Festival green. Lost when villagers leave hungry or cold (⭐1 each), to undead creatures and at the Moneylender. Can be negative.</td></tr>
        <tr><td>🏠 Buildings</td><td>The ⭐ printed on each building — job buildings only if someone works there. Castle ⭐6, Wizard’s Tower ⭐5, Cathedral ⭐10.</td></tr>
        <tr><td>👥 Villagers</td><td>Every villager still with you: Peasants ⭐1, most trades ⭐2, Knights and Stewards ⭐3, the Wizard ⭐4.</td></tr>
        <tr><td>🧱 Stone walls</td><td>⭐1 per side with a Stone or Iron wall.</td></tr>
        <tr><td>🏰 Fully walled</td><td>⭐3 if all 6 sides have a wall (any kind).</td></tr>
        <tr><td>🪙 Gold</td><td>⭐1 per full 🪙5 left over (🪙9 = ⭐1).</td></tr>
        <tr><td>🎯 Goals</td><td>Everything scored on the 3 goals of each year: ⭐${E.GOAL_PTS} per goal to the village that did most that year, or ⭐${E.GOAL_PTS / 2} each on a tie (nobody scores if both did nothing).</td></tr>
      </table>
      <p>Most ⭐ wins. On a tie, the village with more villagers wins; if that’s tied too, it’s a draw.</p>
      <h4>Strategy tips</h4>
      <ul>
        <li>Food first: a Farm next to a Well with a Farmer makes 🍞4 in Spring and 🍞6 in Autumn. Save up before Winter, when Farms make nothing.</li>
        <li>Check the threat track. A Palisade on the right side is cheap; flyers need Archers, Watchtowers, crossbows, arms or a Wizard. Spread your towers so they cover different sides, and build one early to see where tomorrow’s creature comes from.</li>
        <li>Keep gold for wages before each Spring, and wood for firewood and palisade repairs before each Winter.</li>
        <li>Watch each year’s goals: a small lead by the end of Winter is worth ⭐${E.GOAL_PTS}, and then the race starts again.</li>
        <li>Going first? Take the place your rival needs most.</li>
        <li>Grab the first traveller at the Crossroads: they’re cheapest and leave tonight anyway.</li>
        <li>A Steward early gives you an extra worker every round for the rest of the game.</li>
        <li>Race for a wonder — but you need 5 or 7 villagers first.</li>
      </ul>`;
    return '';
  }
  function showRules(tab) {
    ui.rulesTab = tab || ui.rulesTab || 'basics';
    const back = openModal(`<div class="rules"><h2>📜 How to play Oakhaven</h2><div class="rules-tabs">${RULE_TABS.map(([k, n]) => `<button class="rules-tab${k === ui.rulesTab ? ' on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div><div class="rules-body">${rulesBody(ui.rulesTab)}</div></div>`, { cls: 'wide', onClose: G ? null : () => {} });
    if (window.AhrensTutorial) window.AhrensTutorial.mount(back);
    back.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (!t) return;
      ui.rulesTab = t.dataset.tab;
      back.querySelectorAll('.rules-tab').forEach((b) => b.classList.toggle('on', b === t));
      back.querySelector('.rules-body').innerHTML = rulesBody(ui.rulesTab);
      if (window.AhrensTutorial) window.AhrensTutorial.mount(back);
      back.querySelector('.rules-body').scrollTop = 0;
      t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }

  // ---------------------------------------------------------------- boot
  const saved = loadSave();
  const params = new URLSearchParams(location.search);
  const linked = params.get('game');
  const mem = savedOnline();
  let localId = params.get('local');
  if (!saved && !localId && !linked && !(mem && sessionId()) && lastStatus(lastGid()) === 'elsewhere') localId = lastGid();
  if ((params.has('resume') || localId) && history.replaceState) history.replaceState(null, '', location.pathname);
  if (localId && /^[a-z0-9]{4,40}$/i.test(localId) && window.BoardSaves) {
    $('#app').innerHTML = '<p class="loading-save">Loading your game…</p>';
    window.BoardSaves.load('hearthhold', localId).then((g) => {
      if (validSave(g) && g.state.phase !== 'over') startFrom(g);
      else {
        showSetup();
        toast('That game couldn’t be found — it may have finished or been removed.', 'warn');
      }
    });
  } else if (saved && params.get('resume') === 'local') startFrom(saved);
  else if (linked && /^hh[0-9a-f]{18}$/.test(linked)) {
    if (mem && mem.id === linked && sessionId()) openOnline(linked);
    else {
      net.autoOpen = linked;
      showSetup(linked);
    }
  } else if (mem && sessionId()) openOnline(mem.id);
  else if (saved) startFrom(saved);
  else showSetup();
  window.__hh = { get G() { return G; }, render, E, send: (a) => doAction(a) };
})();
