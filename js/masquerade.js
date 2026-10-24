// The Masquerade Court — page UI. Rules live in masquerade-engine.js.
(function () {
  'use strict';
  const E = window.MasqueradeEngine;
  const SAVE_KEY = 'ahrensMasquerade.v1';
  const PREFS_KEY = 'ahrensMasquerade.prefs';
  const API_BASE = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
  const ADMIN_EMAIL = 'calebahrens2011@gmail.com';
  const LEVEL_NAME = { easy: 'Easy', normal: 'Normal', hard: 'Hard', brutal: 'Brutal' };
  const SIM_SPEEDS = {
    turbo: { name: '⚡ Turbo', ai: 0 },
    fast: { name: '⏩ Fast', ai: 250 },
    watch: { name: '👀 Watch', ai: 1000 },
  };
  const LEVEL_HINT = {
    easy: 'Rarely bluffs, often guesses, and believes most of what it hears.',
    normal: 'Bluffs now and then and calls “Unmask!” when a claim looks shaky.',
    hard: 'Counts every face-up mask, bluffs boldly, and catches careless liars.',
    brutal: 'Its sharpest read of the room and its boldest lies.',
  };
  const IMG = (k) => `/img/masquerade/${k}.webp`;
  const PCOLOR = ['#d6453c', '#3d86d9', '#2fae6a', '#a35ad8', '#e0a91d'];
  const SIGN = ['🌹', '🦢', '🍀', '🔮', '⭐'];
  const NOBLE_NAMES = ['Contessa Rosa', 'Count Azzurro', 'Lady Verde', 'Baron Viola', 'Marchesa Oro'];
  const WHY = { lie: 'caught bluffing', wrong: 'a false accusation', poison: 'poison', scandal: 'a scandal', slander: 'a whisper that wasn’t true', whisper: 'a true whisper' };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;

  let G = null; // { state, mode: 'ai' | 'local' | 'online' | 'past' | 'sim', level, levels, speed, shown, gid, moved, recorded, revealed }
  const ui = { aiTimer: null, modal: false, locked: false, onClose: null, rulesTab: 'overview', pick: null };

  // ---------------------------------------------------------------- persistence
  function save() {
    if (!G || G.mode === 'past' || G.mode === 'online' || G.mode === 'sim') {
      if (G && G.mode === 'online') Online.rememberOnline();
      return;
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(G));
    } catch (e) {
      /* storage full or blocked: the game still works, it just won't resume */
    }
    keepInSaves();
  }
  function keepInSaves() {
    const BS = window.BoardSaves;
    if (!BS || !G || (G.mode !== 'ai' && G.mode !== 'local')) return;
    G.gid = G.gid || newLocalId();
    const s = G.state;
    if (s.phase === 'over') {
      if (BS.list('masquerade').some((m) => m.id === G.gid)) BS.remove('masquerade', G.gid);
      return;
    }
    if (!G.moved) return;
    BS.put('masquerade', G.gid, G, { mode: G.mode, level: G.level, names: s.players.map((p) => p.name), favor: Math.max(...s.players.map((p) => p.favor)), moved: true });
  }
  addEventListener('boardsaves:removed', (e) => {
    if (G && G.gid && e.detail.some((m) => m.game === 'masquerade' && m.id === G.gid)) toast('This game was removed from Your games on another device, so it won’t be saved any more.', 'bad');
  });
  const validSave = (g) => g && g.state && g.state.v === E.SAVE_V && (g.mode === 'ai' || g.mode === 'local');
  const lastStatus = (gid) => (gid && window.BoardSaves ? window.BoardSaves.status('masquerade', gid) : 'here');
  function rawSave() {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }
  function loadSave() {
    const g = rawSave();
    return validSave(g) && lastStatus(g.gid) === 'here' ? g : null;
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
  function isAdmin() {
    try {
      return (localStorage.getItem('ahrenslabs_email') || '').trim().toLowerCase() === ADMIN_EMAIL;
    } catch (e) {
      return false;
    }
  }
  function sessionId() {
    try {
      return localStorage.getItem('ahrenslabs_sessionId') || '';
    } catch (e) {
      return '';
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

  const Online = window.BoardOnline.attach({
    apiPrefix: '/api/masquerade',
    title: 'The Masquerade Court',
    onlineKey: 'ahrensMasquerade.online',
    esc, toast, $, sessionId, prefs, savePrefs,
    blurb: 'Play The Masquerade Court against other Ahrens Labs players — invite up to four, add computer nobles if you like, and pick a quick game with a 2-minute clock for every decision or a long game where you answer whenever you like.',
    maxPlayers: 5,
    roundText: () => '',
    getG: () => G,
    showSetup: (focus) => showSetup(focus),
    isMyTurn: () => G && G.state && E.waitingOn(G.state).includes(G.me),
    enterOnline: (v, mem) => {
      G = {
        mode: 'online', id: v.id, me: v.me, version: v.version, status: v.status, result: v.result,
        gmode: v.mode || 'long', deadline: v.deadline || null, skew: v.now ? v.now - Date.now() : 0,
        state: v.state, revealed: !!(mem && mem.revealed), moved: true,
      };
      startFrom(G);
    },
    applyView: (v, fresh, mine) => {
      const prev = G.state;
      G.version = v.version;
      G.status = v.status;
      G.result = v.result;
      G.deadline = v.deadline || null;
      if (v.now) G.skew = v.now - Date.now();
      if (!v.state) return render();
      G.state = v.state;
      if (mine) sfx(mine.t === 'challenge' ? 'dice' : mine.t === 'mingle' ? 'coin' : 'card');
      ui.pick = null;
      render();
      if (G.gmode === 'quick' && G.status === 'active') Online.tickClock();
      tellFresh(fresh, prev);
      if (v.state.phase === 'over' && prev.phase !== 'over') return setTimeout(() => G && showGameOver(false), 600);
      if (v.state.phase === 'over') return showGameOver(true);
      if (G.status === 'over' && !G.revealed) {
        G.revealed = true;
        const r = G.result || {};
        openModal(`<h2>${r.winner === G.me ? '🏆 You win!' : '🎭 The ball is over'}</h2><p>${esc(r.reason === 'resign' ? (r.winner === G.me ? 'They left the ball.' : 'You left the ball.') : r.reason === 'timeout' ? (r.winner === G.me ? 'They ran out of time.' : 'You ran out of time.') : 'This game has ended.')}</p><div class="btn-row"><button class="btn" data-close>OK</button></div>`);
      }
    },
  });

  // ---------------------------------------------------------------- small helpers
  const st = () => G.state;
  const pl = (i) => st().players[i];
  const M = (k) => E.MASKS[k];
  const isHuman = (i) => (G.mode === 'online' ? i === G.me : G.mode === 'past' ? false : !pl(i).ai);
  // Whose eyes the screen is for: you against the computer or online, the decider on a shared device.
  function viewer() {
    const s = st();
    if (G.mode === 'online') return G.me;
    if (G.mode === 'past') return G.view || 0;
    if (G.mode === 'ai') return s.players.findIndex((p) => !p.ai);
    return s.turn != null ? s.turn : s.actor;
  }
  // On a shared device a noble's masks stay face down until they say it's them looking.
  // (While a claim is open on a shared device everyone is looking, so nobody's masks show.)
  const answering = () => !!(st().pending && st().pending.stage === 'challenge');
  const privateOk = () => G.mode !== 'local' || st().phase === 'over' || (!answering() && G.shown === viewer());
  const deciding = () => E.waitingOn(st()).some(isHuman) && (G.mode !== 'online' || G.status === 'active');
  // On a shared device the "Unmask!" prompt is for every person at once; otherwise it's for you.
  const myDecision = () => deciding() && (G.mode === 'local' && answering() ? true : E.waitingOn(st()).includes(viewer()));
  const nobleName = (i) => `<b class="who" style="--pc:${PCOLOR[i]}">${esc(pl(i).name)}</b>`;
  const you = (i) => (G.mode === 'ai' || G.mode === 'online') && i === viewer();
  const nameOf = (i) => (you(i) ? 'you' : esc(pl(i).name));
  function toast(html, kind, ms) {
    const root = $('#toasts');
    if (!root) return;
    const t = document.createElement('div');
    t.className = `toast ${kind || ''}`;
    t.innerHTML = html;
    root.appendChild(t);
    while (root.children.length > 3) root.firstChild.remove();
    setTimeout(() => t.classList.add('out'), ms || 3800);
    setTimeout(() => t.remove(), (ms || 3800) + 400);
  }
  function sfx(k, delay) {
    if (!window.GameMusic || (G && G.mode === 'sim' && G.speed !== 'watch')) return;
    if (delay) setTimeout(() => GameMusic.sfx(k), delay);
    else GameMusic.sfx(k);
  }
  const maskImg = (k, cls) => `<img class="mk-img${cls ? ' ' + cls : ''}" src="${IMG(k)}" alt="${esc(M(k).name)}" draggable="false">`;
  const pips = (n, max, cls) => `<span class="pips ${cls || ''}" aria-label="${n} of ${max}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;

  // ---------------------------------------------------------------- modal
  function openModal(html, opts) {
    opts = opts || {};
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-back${opts.cls ? ' ' + opts.cls : ''}"><div class="modal" role="dialog" aria-modal="true">${opts.noClose ? '' : '<button class="modal-x" data-close aria-label="Close">✕</button>'}${html}</div></div>`;
    ui.modal = true;
    ui.locked = !!opts.noClose;
    ui.onClose = opts.onClose || null;
    const back = root.firstChild;
    back.addEventListener('click', (e) => {
      if ((e.target === back && !opts.noClose) || e.target.closest('[data-close]')) closeModal();
    });
    return back;
  }
  function closeModal(silent) {
    const root = $('#modal-root');
    if (!root || !root.firstChild) return;
    root.innerHTML = '';
    ui.modal = false;
    ui.locked = false;
    const cb = ui.onClose;
    ui.onClose = null;
    if (silent) return;
    if (cb) cb();
    else scheduleAI();
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.modal && !ui.locked) closeModal();
  });

  // ---------------------------------------------------------------- home
  function heroHtml(withTagline) {
    const sparks = Array.from({ length: 16 }, (_, i) => `<i style="left:${4 + ((i * 37) % 92)}%;top:${6 + ((i * 23) % 60)}%;animation-delay:${(i * 0.4).toFixed(2)}s"></i>`).join('');
    return `<div class="gh-top"><a class="gh-lobby" href="/ahrens-games" title="Back to the game lobby">← <img class="gh-dice" src="/img/board-games-favicon-48.png?v=8" alt="" width="20" height="20"> Game lobby</a>${window.GameMusic ? GameMusic.buttonHtml('btn ghost sm gh-music', 'bt') : ''}</div>
      <div class="gh-hero">
        <img src="${IMG('cover')}" alt="Masked nobles in a candlelit Venetian ballroom: a duchess, a jester and a plague doctor share a secret" class="gh-hero-img">
        <div class="gh-shade"></div>
        <div class="hero-sparks" aria-hidden="true">${sparks}</div>
        <div class="gh-title"><h1 class="display">The Masquerade Court</h1>${withTagline ? '<p>Wear two masks. Claim any power you like — truthfully or not. Call out the liars, and win the Doge’s Favor before anyone else.</p>' : ''}</div>
      </div>`;
  }
  function showGate() {
    stopAI();
    G = null;
    document.body.className = 'setup-mode';
    const back = encodeURIComponent(location.pathname.replace(/^\//, ''));
    $('#app').innerHTML = `<div class="setup gh">${heroHtml(false)}
      <div class="setup-card gh-card panel ol-gate">
        <h2>🔒 Sign in to play</h2>
        <a class="btn big" href="/account.html?return=${back}">Log in or sign up</a>
      </div></div>`;
  }

  function showSetup(focusGame) {
    if (!sessionId()) return showGate();
    stopAI();
    Online.disconnect();
    G = null;
    ui.pick = null;
    if (history.replaceState && location.search && !focusGame && !new URLSearchParams(location.search).get('game')) history.replaceState(null, '', location.pathname);
    const pr = prefs();
    const saved = loadSave();
    const canResume = saved && saved.state.phase !== 'over' && saved.moved;
    const rivals = pr.rivals || 2;
    const seats = pr.seats || 3;
    document.body.className = 'setup-mode';
    $('#app').innerHTML = `
      <div class="setup gh">
        ${heroHtml(true)}
      <div class="setup-card gh-card panel">
        ${canResume ? `<div class="gh-resume"><div><b>A ball in progress</b><span>${esc(saved.state.players.map((p) => p.name).join(' · '))} · top Favor ⭐${Math.max(...saved.state.players.map((p) => p.favor))} of ${E.FAVOR_WIN}</span></div><button class="btn" id="resume">Continue</button></div>` : ''}
        <h2>New game</h2>
        <div class="gh-modes" id="mode">
          <button data-v="ai" class="gh-mode ${pr.mode !== 'local' && pr.mode !== 'online' ? 'on' : ''}"><span>🤖</span><b>Computer</b><small>Rival nobles</small></button>
          <button data-v="local" class="gh-mode ${pr.mode === 'local' ? 'on' : ''}"><span>👥</span><b>Players</b><small>2–5 on this device</small></button>
          <button data-v="online" class="gh-mode ${pr.mode === 'online' ? 'on' : ''}"><span>🌐</span><b>Online</b><small>Challenge a friend</small></button>
        </div>
        <div class="online-only" id="online-box"></div>
        <div class="field ai-only offline-only">
          <span class="label">Rival nobles</span>
          <div class="seg" id="rivals">${[1, 2, 3, 4].map((n) => `<button data-v="${n}" class="${rivals === n ? 'on' : ''}">${n} ${n === 1 ? 'rival' : 'rivals'}</button>`).join('')}</div>
        </div>
        <div class="field local-only">
          <span class="label">Nobles</span>
          <div class="seg" id="seats">${[2, 3, 4, 5].map((n) => `<button data-v="${n}" class="${seats === n ? 'on' : ''}">${n} players</button>`).join('')}</div>
        </div>
        <div class="field names offline-only" id="names"></div>
        <div class="field ai-only offline-only">
          <span class="label">Difficulty</span>
          <div class="seg" id="level">${Object.keys(LEVEL_NAME).map((l) => `<button data-v="${l}" class="${(pr.level || 'normal') === l ? 'on' : ''}">${LEVEL_NAME[l]}</button>`).join('')}</div>
          <p class="muted level-hint" id="level-hint"></p>
        </div>
        <p class="muted offline-only">🎲 The seating and the first noble to move are drawn at random each ball.</p>
        <button class="btn big offline-only" id="start">🎭 Open the ball</button>
        <div class="gh-links">
          <button class="btn ghost sm" data-tutorial="masquerade-ad">🎞️ Watch the trailer</button>
          <button class="btn ghost sm" data-tutorial="masquerade">🎬 Watch the tutorial</button>
          <button class="btn ghost sm" id="how">📜 How to play</button>
          <button class="btn ghost sm" id="hist">🏆 Game history</button>
          ${isAdmin() ? '<button class="btn ghost sm" id="sim">🧪 Computer vs computer</button>' : ''}
        </div>
      </div>
      </div>`;
    const names = () => {
      const m = $('#mode .on').dataset.v;
      const n = m === 'local' ? Number($('#seats .on').dataset.v) : 1;
      const keep = [...document.querySelectorAll('#names input')].map((x) => x.value);
      $('#names').innerHTML = Array.from({ length: n }, (_, i) => `<label><span class="label">${m === 'local' ? `Noble ${i + 1}` : 'Your noble'}</span><input id="n${i}" maxlength="18" value="${esc(keep[i] || pr['n' + i] || NOBLE_NAMES[i])}"></label>`).join('');
    };
    const setMode = (m) => {
      $('.setup').classList.toggle('is-local', m === 'local');
      $('.setup').classList.toggle('is-online', m === 'online');
      if (m !== 'online') names();
    };
    const hint = () => ($('#level-hint').textContent = LEVEL_HINT[$('#level .on').dataset.v]);
    $('.setup').addEventListener('click', (e) => {
      const b = e.target.closest('.seg button, .gh-modes button');
      if (!b || b.closest('#ol-mode')) return;
      [...b.parentNode.children].forEach((x) => x.classList.toggle('on', x === b));
      if (b.parentNode.id === 'mode') {
        savePrefs(Object.assign(prefs(), { mode: b.dataset.v }));
        setMode(b.dataset.v);
        if (b.dataset.v === 'online') Online.showLobby();
      }
      if (b.parentNode.id === 'seats') names();
      if (b.parentNode.id === 'level') hint();
    });
    setMode(focusGame ? 'online' : pr.mode === 'local' || pr.mode === 'online' ? pr.mode : 'ai');
    if (focusGame || $('#mode .on').dataset.v === 'online') Online.showLobby(focusGame);
    hint();
    $('#how').onclick = () => showRules();
    $('#hist').onclick = () => showHistory();
    if ($('#sim')) $('#sim').onclick = openSimSetup;
    if ($('#resume')) $('#resume').onclick = () => startFrom(saved);
    $('#start').onclick = () => {
      const mode = $('#mode .on').dataset.v;
      const level = $('#level .on').dataset.v;
      const n = mode === 'local' ? Number($('#seats .on').dataset.v) : 1 + Number($('#rivals .on').dataset.v);
      const typed = [...document.querySelectorAll('#names input')].map((x, i) => x.value.trim() || NOBLE_NAMES[i]);
      // Seats are shuffled, and whoever is drawn first moves first.
      const seats = Array.from({ length: n }, (_, i) => ({ name: typed[i] || NOBLE_NAMES[i], ai: mode === 'ai' && i > 0 }));
      for (let i = seats.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [seats[i], seats[j]] = [seats[j], seats[i]];
      }
      const names = seats.map((x) => x.name);
      const first = Math.floor(Math.random() * n);
      const p = Object.assign(prefs(), { mode, level });
      typed.forEach((v, i) => (p['n' + i] = v));
      if (mode === 'local') p.seats = n;
      else p.rivals = n - 1;
      savePrefs(p);
      const ai = seats.map((x) => x.ai);
      const state = E.newGame({ names, ai, levels: ai.map((x) => (x ? level : null)), first });
      startFrom({ state, mode, level, gid: newLocalId() });
    };
  }

  // ---------------------------------------------------------------- the ballroom
  function startFrom(g) {
    if (!sessionId()) return showGate();
    stopAI();
    clearAnswers();
    G = g;
    G.shown = null;
    ui.pick = null;
    document.body.className = 'game-mode';
    window.scrollTo(0, 0);
    save();
    const q = G.mode === 'online' && G.id ? `?game=${encodeURIComponent(G.id)}` : G.mode === 'past' && G.gid ? `?past=${encodeURIComponent(G.gid)}` : G.gid && (G.mode === 'ai' || G.mode === 'local') ? `?local=${encodeURIComponent(G.gid)}` : '';
    if (history.replaceState && location.search !== q) history.replaceState(null, '', location.pathname + q);
    render();
    if (G.mode === 'online' && G.gmode === 'quick' && G.status === 'active') Online.tickClock();
    if (st().phase === 'over') showGameOver(true);
    else if (G.mode === 'online') {
      if (G.status === 'active') Online.connectSock();
    } else scheduleAI();
  }

  function render() {
    if (!G) return;
    const s = st();
    const v = viewer();
    const sub = G.mode === 'past' ? '📜 Finished ball' : G.mode === 'sim' ? `🧪 ${SIM_SPEEDS[G.speed].name} · computer vs computer` : G.mode === 'online' ? `🌐 ${s.players.length > 2 ? `${s.players.length}-player game` : `vs ${esc(pl(1 - G.me).name)}`}${G.gmode === 'quick' ? ' · ⚡' : ''}${G.gmode === 'quick' && G.deadline ? ' <span class="ol-clock" id="ol-clock"></span>' : ''}` : G.mode === 'local' ? `👥 ${s.players.length} nobles` : `🤖 vs ${plural(s.players.length - 1, 'rival')} · ${LEVEL_NAME[G.level] || ''}`;
    const home = G.mode === 'past' ? '🏆<span class="bt"> History</span>' : G.mode === 'sim' ? '⏹<span class="bt"> Stop</span>' : G.mode === 'online' ? '🌐<span class="bt"> Game</span>' : '🎭<span class="bt"> New game</span>';
    $('#app').innerHTML = `
      <header class="topbar">
        <div class="brand"><img src="/img/masquerade-icon-180.png?v=3" alt="" class="brand-logo" width="46" height="46"><div><h1>The Masquerade Court</h1><small>${sub}</small></div></div>
        <div class="top-mid">
          <div class="top-chips"><span class="chip">⭐ ${E.FAVOR_WIN} Favor wins</span><span class="chip">🎭 or be the last still masked</span></div>
        </div>
        <div class="top-actions">
          ${window.GameMusic ? GameMusic.buttonHtml('btn ghost sm', 'bt') : ''}
          ${G.mode === 'online' && G.status === 'active' ? '<button class="btn ghost sm" data-act="resignOnline" aria-label="Resign">🏳️<span class="bt"> Resign</span></button>' : ''}
          <button class="btn ghost sm" data-act="rules" aria-label="Rules">📜<span class="bt"> Rules</span></button>
          <button class="btn ghost sm" data-act="home" aria-label="${G.mode === 'past' ? 'History' : G.mode === 'sim' ? 'Stop' : 'New game'}" title="${G.mode === 'past' ? 'Back to history' : G.mode === 'sim' ? 'Stop the simulation' : 'Start a new game (this one stays saved under Your games)'}">${home}</button>
          <a class="btn ghost sm" href="/ahrens-games/settings" title="Ahrens Games settings" aria-label="Settings">⚙️<span class="bt"> Settings</span></a>
          <a class="btn ghost sm" href="/ahrens-games" title="Back to the game lobby" aria-label="Game lobby"><img class="gh-dice" src="/img/board-games-favicon-48.png?v=8" alt=""><span class="bt"> Lobby</span></a>
        </div>
      </header>
      <div class="mq">
        <section class="nobles n${s.players.length}">${s.players.map((_, i) => nobleHtml(i, v)).join('')}</section>
        ${bannerHtml()}
        <div class="mq-main">
          <section class="panel stage">${stageHtml()}</section>
          <section class="panel mine" style="--pc:${PCOLOR[v]}">${myMasksHtml(v)}</section>
        </div>
        <section class="panel gazette"><h3>📰 The Gazette of the Ball <small>everything said and done tonight</small></h3><div class="log" id="log">${logHtml()}</div></section>
      </div>`;
    const lg = $('#log');
    if (lg) lg.scrollTop = lg.scrollHeight;
    phoneFocus();
  }

  // On a phone the decision panel sits above the nobles. A new decision for you brings it into view (answers are
  // timed), and choosing a target brings the nobles' cards into view.
  const PHONE = window.matchMedia('(max-width: 640px)');
  function phoneFocus() {
    if (!PHONE.matches || G.mode === 'sim' || G.mode === 'past') return;
    const s = st();
    const P = s.pending;
    const key = s.phase === 'act' && myDecision() ? `${s.log.length}:${P ? P.stage : 'turn'}` : null;
    const pick = ui.pick ? 'pick' : null;
    const under = ($('.topbar') || { offsetHeight: 0 }).offsetHeight;
    const into = (el) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top < under || r.top > innerHeight * 0.55) window.scrollTo(0, Math.max(0, r.top + scrollY - under - 8));
    };
    if (pick && ui.focused !== pick) into($('.nobles'));
    else if (key && key !== ui.focused) into($('.mq-main .stage'));
    ui.focused = pick || key;
  }

  function nobleHtml(i, v) {
    const s = st();
    const p = pl(i);
    const P = s.pending;
    const me = i === v;
    const turn = s.phase === 'act' && s.actor === i;
    // Everyone asked about a claim shows as deciding until it's settled, so nobody can tell who has let it pass.
    const deciding = s.phase === 'act' && !turn && (P && P.stage === 'challenge' ? P.responders.includes(i) : s.turn === i);
    let tag = '';
    if (p.out) tag = '<span class="nb-tag out">Left the ball</span>';
    else if (turn) tag = `<span class="nb-tag turn">${p.ai && s.turn === i ? 'Thinking…' : 'Their move'}</span>`;
    else if (deciding) tag = `<span class="nb-tag ans">${P && P.stage === 'lose' ? 'Losing a mask' : P && P.stage === 'challenge' ? 'Deciding…' : 'Answering…'}</span>`;
    if (turn && you(i)) tag = '<span class="nb-tag turn">Your move</span>';
    const seen = viewerSeen();
    const tiles = p.masks.map((m) => maskTile(m, i, v, seen)).join('');
    const claims = E.MASK_ORDER.filter((k) => p.claims[k]).map((k) => `<span class="rumour" title="${esc(p.name)} has claimed ${esc(M(k).name)} ${plural(p.claims[k], 'time')}">${M(k).icon}${p.claims[k] > 1 ? `<b>×${p.claims[k]}</b>` : ''}</span>`).join('');
    const pick = ui.pick && ui.pick.need === 'target' && E.targets(s, viewer()).includes(i) && !(ui.pick.k && E.claimProblem(s, viewer(), ui.pick.k, i, ui.pick.give || (E.live(pl(viewer()))[0] || {}).id, !!ui.pick.pair));
    return `<div class="noble${turn ? ' turn' : ''}${deciding ? ' deciding' : ''}${p.out ? ' out' : ''}${me ? ' me' : ''}${pick ? ' pickable' : ''}" style="--pc:${PCOLOR[i]}" ${pick ? `data-target="${i}" role="button" tabindex="0" title="Choose ${esc(p.name)}"` : ''}>
      <div class="nb-head"><span class="nb-sign">${SIGN[i]}</span><b class="nb-name">${esc(p.name)}${you(i) ? ' <em>you</em>' : ''}</b>${p.ai && G.mode !== 'past' ? `<span class="nb-ai">🤖 ${LEVEL_NAME[p.level] || ''}</span>` : ''}</div>
      ${tag}
      <div class="nb-favor" title="${p.favor} of ${E.FAVOR_WIN} Favor">⭐ <b>${p.favor}</b>${pips(p.favor, E.FAVOR_WIN, 'favor')}</div>
      <div class="nb-stats"><span title="Ducats">🪙 <b>${p.ducats}</b></span><span title="Masks still worn">🎭 <b>${E.live(p).length}</b></span></div>
      <div class="nb-masks">${tiles}</div>
      <div class="nb-rumours" title="Every mask this noble has claimed since they last showed one">${claims ? `<small>Claimed:</small>${claims}` : '<small>No claims yet</small>'}</div>
      ${intrigueLine(i, v)}
      ${pick ? '<span class="nb-pick">👉 Choose</span>' : ''}
    </div>`;
  }
  // Each noble's secret Intrigue: hidden from everyone else until it comes true (or the ball ends).
  function intrigueLine(i, v) {
    const ig = pl(i).intrigue;
    if (!ig) return '';
    const I = E.INTRIGUES[ig.id];
    const open = I && (ig.done || st().phase === 'over' || G.mode === 'past' || G.mode === 'sim' || (i === v && privateOk()));
    if (!open) return '<div class="nb-intrigue" title="A secret goal worth Favor when it comes true">📜 A secret Intrigue</div>';
    const pr = E.intrigueProgress(pl(i));
    return `<div class="nb-intrigue${ig.done ? ' done' : ''}" title="${esc(I.text)}">${I.icon} ${esc(I.name)} ${ig.done ? '✓' : `<small>${pr ? `${pr.have}/${pr.need}` : ''}</small>`}</div>`;
  }
  // The masks the viewer has peeked at (or been handed), by card.
  function viewerSeen() {
    if (!privateOk() || G.mode === 'past') return [];
    const p = pl(viewer());
    return p && p.seen ? p.seen : [];
  }
  function maskTile(m, owner, v, seen) {
    const over = st().phase === 'over';
    if (m.up === 'lost') return `<span class="tile lost" title="${esc(M(m.k).name)} — lost">${maskImg(m.k)}<i>✗</i></span>`;
    const mine = owner === v && privateOk();
    if (m.k && (mine || over || G.mode === 'past' || G.mode === 'sim')) return `<span class="tile face${mine && !over ? ' secret' : ''}" title="${esc(M(m.k).name)}${mine && !over ? ' — only you can see this' : ''}">${maskImg(m.k)}</span>`;
    const known = seen.find((x) => x.id === m.id);
    if (known) return `<span class="tile back peeked" title="You know this is ${esc(M(known.k).name)}"><img src="${IMG('back')}" alt=""><i>${M(known.k).icon}</i></span>`;
    return '<span class="tile back" title="A hidden mask"><img src="' + IMG('back') + '" alt=""></span>';
  }

  const blocksLine = (k) => (k === 'duchess' ? `Cuts in on a Waltz (🪙${E.CUT_IN_COST})` : M(k).blocks ? `Blocks ${M(M(k).blocks).power}` : '');
  const insultCost = (p) => (p.favor >= E.INSULT_FAVOR ? `⭐${E.INSULT_FAVOR} Favor` : 'a mask');

  function bannerHtml() {
    const s = st();
    const P = s.pending;
    if (s.phase === 'over') return `<div class="banner over">🕛 The ball is over. <button class="btn sm" data-act="reveal">🏆 See who won</button></div>`;
    if (G.mode === 'online' && G.status !== 'active') return '<div class="banner">The game has ended.</div>';
    const a = s.actor;
    if (!P) return `<div class="banner" style="--pc:${PCOLOR[a]}">${you(a) ? '<b>Your move.</b> Claim a mask’s power — any one, worn or not — or take a plain action.' : `${nobleName(a)} is choosing a move…`}</div>`;
    const claim = P.act && P.act.t === 'claim' ? `${nobleName(P.actor)} claims <b>${esc(P.act.pair ? `the ${E.PAIRS[P.act.k].name}` : M(P.act.k).name)}</b>` : '';
    if (P.stage === 'challenge') {
      const v = viewer();
      const ask = G.mode === 'local' ? '<b>Does anyone call “Unmask!”?</b> First to speak up is the challenger.'
        : P.responders.includes(v) && G.mode !== 'sim' ? (P.passed.includes(v) ? 'You let it pass — waiting to see whether anyone else calls “Unmask!”…' : '<b>Do you believe it?</b> Everyone decides at once — the first to call “Unmask!” is the challenger.')
          : 'The other nobles are deciding whether to call “Unmask!”…';
      return `<div class="banner" style="--pc:${PCOLOR[P.claimer]}">${claim}. ${ask}</div>`;
    }
    if (P.stage === 'block' && P.act.k === 'duchess') return `<div class="banner" style="--pc:${PCOLOR[s.turn]}">${claim} for a Waltz. ${you(s.turn) ? '<b>Will you cut in?</b>' : `${nobleName(s.turn)} may cut in…`}</div>`;
    if (P.stage === 'block') return `<div class="banner" style="--pc:${PCOLOR[s.turn]}">${claim} against ${nobleName(P.act.target)}. ${you(s.turn) ? '<b>Will you block it?</b>' : `${nobleName(s.turn)} may block it…`}</div>`;
    if (P.stage === 'blockChallenge') return `<div class="banner" style="--pc:${PCOLOR[s.turn]}">${nobleName(P.claimer)} claims <b>${esc(M(P.k).name)}</b> ${P.act.k === 'duchess' ? 'to cut in' : 'to block'}. ${you(s.turn) ? '<b>Do you believe them?</b>' : `${nobleName(s.turn)} is deciding…`}</div>`;
    if (P.stage === 'lose') return `<div class="banner bad" style="--pc:${PCOLOR[s.turn]}">${you(s.turn) ? '<b>You must lose a mask.</b> Choose which one.' : `${nobleName(s.turn)} must lose a mask (${esc(WHY[P.why] || 'bad luck')})…`}</div>`;
    return '<div class="banner">…</div>';
  }

  // ---------------------------------------------------------------- the middle: what to do now
  function stageHtml() {
    const s = st();
    if (s.phase === 'over') return `<h3>🎭 The ball is over</h3><p class="muted">Every mask has come off. <button class="btn sm" data-act="reveal">See the results</button></p>`;
    if (G.mode === 'past') return '<h3>📜 A finished ball</h3>';
    const P = s.pending;
    const v = viewer();
    if (G.mode === 'local' && deciding() && G.shown !== s.turn && (!P || P.stage !== 'challenge')) {
      return `<div class="curtain"><b>📱 Pass the device to ${nobleName(s.turn)}</b><span>Everyone else, look away — masks are about to show.</span><button class="btn" data-act="show">👀 I’m ${esc(pl(s.turn).name)}</button></div>`;
    }
    if (!myDecision()) {
      if (P && P.stage === 'challenge') {
        const mine = P.passed.includes(v);
        return `<h3>⏳ ${mine ? 'You let it pass' : 'Everyone is deciding'}</h3><p class="muted">${mine ? 'Waiting to see whether anyone else calls “Unmask!”…' : 'Will anyone call “Unmask!”? You’ll know the moment someone does.'}</p>${recentHtml()}`;
      }
      const who = s.turn != null ? s.turn : s.actor;
      return `<h3>⏳ Waiting</h3><p class="muted">${nobleName(who)} ${P ? 'is answering' : 'is taking a turn'}…</p>${recentHtml()}`;
    }
    if (!P) return actionsHtml(v);
    if (P.stage === 'challenge' && G.mode === 'local') return localChallengeHtml(P);
    if (P.stage === 'challenge') return challengeHtml(P, v);
    if (P.stage === 'block') return blockHtml(P, v);
    if (P.stage === 'blockChallenge') return blockChallengeHtml(P, v);
    if (P.stage === 'lose') return loseHtml(v);
    return '';
  }
  function recentHtml() {
    const lines = st().log.slice(-3).reverse();
    return `<div class="recent">${lines.map((l) => `<p style="--pc:${l.who != null ? PCOLOR[l.who] : 'transparent'}">${esc(l.text)}</p>`).join('')}</div>`;
  }
  // How many masks of a kind the viewer can see — the honest way to judge a claim.
  function countHtml(k) {
    const kn = E.knowledge(st(), viewer());
    const n = kn.known[k] || 0;
    return `<span class="count" title="Masks of this kind you can see: your own, face-up ones and ones you’ve peeked at">👁️ ${n} of ${E.COPIES} ${esc(M(k).name)} seen</span>`;
  }

  function actionsHtml(v) {
    const s = st();
    const p = pl(v);
    const anyTarget = (k) => E.targets(s, v).some((t) => !E.claimProblem(s, v, k, t, (E.live(p)[0] || {}).id));
    const power = (k) => {
      const m = M(k);
      const worn = E.live(p).some((x) => x.k === k);
      const why = m.target ? (anyTarget(k) ? (m.cost && p.ducats < m.cost ? `Needs 🪙${m.cost}` : '') : 'No one to target') : E.claimProblem(s, v, k);
      const tag = worn ? '<span class="pw-tag worn">✓ You wear it</span>' : '<span class="pw-tag bluff">🎭 Bluff</span>';
      const block = blocksLine(k) ? `<small class="pw-block">🛡️ ${esc(blocksLine(k))}</small>` : '';
      return `<button class="power${why ? ' off' : ''}${ui.pick && ui.pick.k === k ? ' picked' : ''}" data-claim="${k}" ${why ? 'disabled' : ''} style="--mc:${m.color}">
        ${maskImg(k)}<span class="pw-body"><span class="pw-top"><b>${m.icon} ${esc(m.name)}</b>${why ? `<span class="pw-why">${esc(why)}</span>` : tag}</span><span class="pw-name">${esc(m.power)}</span><span class="pw-text">${esc(m.text)}</span>${block}</span></button>`;
    };
    const anyPairTarget = (k) => E.targets(s, v).some((t) => !E.claimProblem(s, v, k, t, null, true));
    const pairCard = (k) => {
      const pr = E.PAIRS[k];
      const both = !!E.wearing(p, [k, pr.with]);
      const cost = E.costOf(k, true);
      const why = cost && p.ducats < cost ? `Needs 🪙${cost}` : pr.target ? (anyPairTarget(k) ? '' : 'No one to target') : E.claimProblem(s, v, k, null, null, true);
      const tag = both ? '<span class="pw-tag worn">✓ You wear both</span>' : '<span class="pw-tag bluff">🎭 Bluff</span>';
      const stop = k === 'duchess' ? 'A rival Duchess can still cut in' : E.BLOCKER[k] ? `Blocked by ${M(E.BLOCKER[k]).name}, like the ${M(k).power}` : 'Can’t be blocked — only challenged';
      return `<button class="power pair${why ? ' off' : ''}${ui.pick && ui.pick.k === k && ui.pick.pair ? ' picked' : ''}" data-pair="${k}" ${why ? 'disabled' : ''} style="--mc:${M(k).color}">
        <span class="pair-imgs">${maskImg(k, 'mini')}${maskImg(pr.with, 'mini')}</span><span class="pw-body"><span class="pw-top"><b>${esc(pr.name)}</b>${why ? `<span class="pw-why">${esc(why)}</span>` : tag}</span><span class="pw-name">${esc(M(k).name)} + ${esc(M(pr.with).name)}</span><span class="pw-text">${esc(pr.text)}</span><small class="pw-block">🛡️ ${esc(stop)}</small></span></button>`;
    };
    const basic = (t, icon, label, text, why) => `<button class="basic${why ? ' off' : ''}" data-basic="${t}" ${why ? 'disabled' : ''}><span>${icon}</span><b>${label}</b><small>${why || text}</small></button>`;
    const pickWhat = !ui.pick ? '' : ui.pick.whisper ? 'your whisper' : ui.pick.k ? (ui.pick.pair ? `the ${E.PAIRS[ui.pick.k].name}` : M(ui.pick.k).power) : 'the scandal';
    const picking = ui.pick ? `<div class="picking">👉 ${ui.pick.need === 'target' ? `Choose a noble for <b>${esc(pickWhat)}</b> — tap their card.` : ''} <button class="btn ghost sm" data-act="cancel">Cancel</button></div>` : '';
    return `<h3>🎭 Your move <small>claim any mask — the ones you don’t wear are bluffs</small></h3>
      ${picking}
      <div class="powers">${E.MASK_ORDER.map(power).join('')}</div>
      <h3>🤝 Pair powers <small>claim two masks at once — both must be real</small></h3>
      <div class="powers pairs">${E.PAIR_ORDER.map(pairCard).join('')}</div>
      <h3>🥂 Or simply…</h3>
      <div class="basics">
        ${basic('mingle', '🪙', 'Mingle', 'Take 🪙1. Nobody can stop it.')}
        ${basic('toast', '🥂', 'Toast the Doge', `Pay 🪙${E.TOAST_COST}: win ⭐1 Favor. Nobody can stop it.`, p.ducats < E.TOAST_COST ? `Needs 🪙${E.TOAST_COST}` : '')}
        ${basic('whisper', '🗣️', 'Whisper', `Pay 🪙${E.WHISPER_COST}: name a mask a noble wears. Right — it’s torn off. Wrong — you pay ${insultCost(p)}.`, p.ducats < E.WHISPER_COST ? `Needs 🪙${E.WHISPER_COST}` : '')}
        ${basic('scandal', '📜', 'Start a scandal', `Pay 🪙${E.SCANDAL_COST}: a noble loses a mask. Nobody can stop it.`, p.ducats < E.SCANDAL_COST ? `Needs 🪙${E.SCANDAL_COST}` : '')}
      </div>`;
  }
  function challengeHtml(P, v) {
    const m = M(P.k);
    const me = pl(v);
    const cost = insultCost(me);
    const pair = P.pair ? E.PAIRS[P.k] : null;
    return `<div class="ask" style="--mc:${m.color}">
      ${pair ? `<span class="pair-imgs big">${maskImg(P.k, 'big')}${maskImg(P.pair, 'big')}</span>` : maskImg(P.k, 'big')}
      <div><h3>${nobleName(P.claimer)} claims ${pair ? `the ${esc(pair.name)}` : esc(m.name)}</h3>
      ${pair ? `<p class="muted">That means wearing both <b>${esc(m.name)}</b> and <b>${esc(M(P.pair).name)}</b>.</p>` : ''}
      <p>${esc(E.powerLine(st(), P.claimer, P.act))}</p>
      <p class="muted">Everyone decides at once, and nobody knows who has let it pass — the first to call <b>“Unmask!”</b> is the challenger. Call it if you think it’s a bluff${pair ? ' — if either mask is missing, it’s a lie' : ''}. A liar loses a mask and the power fails. If they’re honest, they shuffle ${pair ? 'both masks' : 'that mask'} back into the wardrobe, draw ${pair ? 'fresh ones' : 'a fresh one'}, and you pay ${cost}.</p>
      <p>${countHtml(P.k)}${pair ? ` ${countHtml(P.pair)}` : ''}</p>
      <div class="btn-row"><button class="btn danger" data-ans="challenge">🎭 Unmask!</button><button class="btn ghost" data-ans="pass">Let it pass</button></div></div>
    </div>`;
  }
  // On a shared device: whoever speaks up first taps their name.
  function localChallengeHtml(P) {
    const pair = P.pair ? E.PAIRS[P.k] : null;
    const people = E.waitingOn(st()).filter(isHuman);
    return `<div class="ask" style="--mc:${M(P.k).color}">
      ${pair ? `<span class="pair-imgs big">${maskImg(P.k, 'big')}${maskImg(P.pair, 'big')}</span>` : maskImg(P.k, 'big')}
      <div><h3>${nobleName(P.claimer)} claims ${pair ? `the ${esc(pair.name)}` : esc(M(P.k).name)}</h3>
      <p>${esc(E.powerLine(st(), P.claimer, P.act))}</p>
      <p class="muted">Anyone may call <b>“Unmask!”</b> — the first to speak up is the challenger. A liar loses a mask; an honest noble draws a fresh mask and the challenger pays ⭐${E.INSULT_FAVOR} Favor (or a mask).</p>
      <p>${countHtml(P.k)}${pair ? ` ${countHtml(P.pair)}` : ''}</p>
      <div class="btn-row">${people.map((i) => `<button class="btn danger" data-ans="challenge" data-who="${i}">🎭 ${esc(pl(i).name)}: Unmask!</button>`).join('')}<button class="btn ghost" data-ans="passall">Nobody calls — let it pass</button></div></div>
    </div>`;
  }
  function blockHtml(P, v) {
    const bk = E.BLOCKER[P.act.k];
    const worn = E.live(pl(v)).some((x) => x.k === bk);
    if (P.act.k === 'duchess') {
      const d = pl(P.actor);
      return `<div class="ask" style="--mc:${M('duchess').color}">
      ${maskImg('duchess', 'big')}
      <div><h3>${nobleName(P.actor)} waltzes with the Doge</h3>
      <p>Unless someone cuts in, they win ⭐${P.act.pair ? 2 : 1} Favor (they have ⭐${d.favor} of ${E.FAVOR_WIN}). Pay the band 🪙${E.CUT_IN_COST} and claim the Duchess to take the Doge’s hand — ${worn ? '<b class="good">you wear her.</b>' : '<b class="bad">you don’t wear her, so it would be a bluff</b> (if they call “Unmask!”, you lose a mask and they waltz anyway).'}</p>
      <div class="btn-row"><button class="btn" data-ans="block" data-k="duchess">💃 Cut in (🪙${E.CUT_IN_COST})</button><button class="btn ghost" data-ans="pass">Let them dance</button></div></div>
    </div>`;
    }
    const what = { jester: P.act.pair ? 'lose ⭐1 Favor and 🪙2 to their rumour' : 'lose ⭐1 Favor to their rumour', poisoner: 'lose a mask to the poison', gondolier: 'have a mask swapped' }[P.act.k];
    return `<div class="ask" style="--mc:${M(P.act.k).color}">
      ${maskImg(P.act.k, 'big')}
      <div><h3>${nobleName(P.actor)} uses ${esc(P.act.pair ? `the ${E.PAIRS[P.act.k].name}` : M(P.act.k).power)} on you</h3>
      <p>Unless you stop it, you’ll ${what}. ${esc(M(bk).name)} can block it — ${worn ? '<b class="good">and you wear it.</b>' : '<b class="bad">you don’t wear it, so blocking would be a bluff</b> (if they call “Unmask!”, you lose a mask and it happens anyway).'}</p>
      <div class="btn-row"><button class="btn" data-ans="block" data-k="${bk}">${M(bk).icon} Block as ${esc(M(bk).name)}</button><button class="btn ghost" data-ans="pass">Let it happen</button></div></div>
    </div>`;
  }
  function blockChallengeHtml(P, v) {
    const me = pl(v);
    return `<div class="ask" style="--mc:${M(P.k).color}">
      ${maskImg(P.k, 'big')}
      <div><h3>${nobleName(P.claimer)} ${P.act.k === 'duchess' ? 'cuts in as' : 'blocks with'} ${esc(M(P.k).name)}</h3>
      <p>Believe them and your ${esc(M(P.act.k).power)} is stopped. Call “Unmask!”: if they’re bluffing they lose a mask and your power goes ahead; if they’re honest, they draw a fresh mask and you pay ${insultCost(me)}.</p>
      <p>${countHtml(P.k)}</p>
      <div class="btn-row"><button class="btn danger" data-ans="challenge">🎭 Unmask!</button><button class="btn ghost" data-ans="pass">Accept the block</button></div></div>
    </div>`;
  }
  function loseHtml(v) {
    const p = pl(v);
    const P = st().pending;
    return `<h3>💔 You must lose a mask <small>${esc(WHY[P.why] || '')}</small></h3>
      <p class="muted">It’s turned face up and out of play. Keep the mask you’d rather wear — and bluff around.</p>
      <div class="lose-pick">${E.live(p).map((m) => `<button class="lose-opt" data-lose="${m.id}" style="--mc:${M(m.k).color}">${maskImg(m.k)}<b>${esc(M(m.k).name)}</b><small>🙈 hidden</small></button>`).join('')}</div>`;
  }

  function myMasksHtml(v) {
    const p = pl(v);
    if (!privateOk()) return `<h3>🎭 Behind the mask</h3><div class="curtain small"><b>Masks hidden</b><span>${esc(p.name)}, tap to look — make sure nobody else can see.</span><button class="btn sm" data-act="show">👀 Show ${esc(p.name)}’s masks</button></div>`;
    const card = (m) => {
      const mk = M(m.k);
      const st_ = m.up === 'lost' ? '<span class="mc-state lost">✗ Lost</span>' : '<span class="mc-state">🙈 Hidden</span>';
      return `<div class="mcard ${m.up}" style="--mc:${mk.color}">${maskImg(m.k)}<div class="mc-body"><b>${mk.icon} ${esc(mk.name)}</b><span>${esc(mk.power)}: ${esc(mk.text)}</span>${blocksLine(m.k) ? `<small>🛡️ ${esc(blocksLine(m.k))}</small>` : ''}${st_}</div></div>`;
    };
    const seen = (p.seen || []).map((x) => {
      const holder = st().players.findIndex((q, i) => i !== v && q.masks.some((m) => m.id === x.id && m.up === 'hidden'));
      return holder >= 0 ? `<li>${M(x.k).icon} ${nobleName(holder)} wears <b>${esc(M(x.k).name)}</b></li>` : '';
    }).filter(Boolean);
    const I = p.intrigue && E.INTRIGUES[p.intrigue.id];
    const pr = E.intrigueProgress(p);
    const intrigue = I ? `<div class="intrigue${p.intrigue.done ? ' done' : ''}"><span class="ig-icon">${I.icon}</span><div><b>${p.intrigue.done ? 'Intrigue revealed' : 'Secret Intrigue'}: ${esc(I.name)}</b><span>${esc(I.text)}</span><small>${p.intrigue.done ? `✓ Done — it won ⭐${E.INTRIGUE_FAVOR} Favor` : `${pr.have} of ${pr.need} · worth ⭐${E.INTRIGUE_FAVOR} Favor the moment it comes true`}</small></div></div>` : '';
    return `<h3>🎭 ${you(v) || G.mode === 'local' ? 'Your masks' : `${esc(p.name)}’s masks`} <small>${G.mode === 'sim' ? 'whoever is deciding right now' : 'only you can see the hidden ones'}</small></h3>
      ${intrigue}
      <div class="mcards">${p.masks.map(card).join('')}</div>
      ${seen.length ? `<h3>👁️ What you know</h3><ul class="known">${seen.join('')}</ul>` : ''}`;
  }

  function logHtml() {
    return st().log.slice(-80).map((l) => `<p${l.who == null ? ' class="sys"' : ''} style="--pc:${l.who != null ? PCOLOR[l.who] : 'transparent'}">${esc(l.text)}</p>`).join('');
  }

  // ---------------------------------------------------------------- clicks
  document.addEventListener('click', (e) => {
    if (!G || !$('.mq')) return;
    if (e.target.closest('#modal-root')) return;
    const act = e.target.closest('[data-act]');
    if (act) return onAct(act.dataset.act);
    const t = e.target.closest('[data-target]');
    if (t && ui.pick) return pickTarget(Number(t.dataset.target));
    if (!myDecision()) return;
    const c = e.target.closest('[data-claim]');
    if (c && !c.disabled) return startClaim(c.dataset.claim);
    const pc = e.target.closest('[data-pair]');
    if (pc && !pc.disabled) return startClaim(pc.dataset.pair, true);
    const b = e.target.closest('[data-basic]');
    if (b && !b.disabled) {
      if (b.dataset.basic === 'scandal' || b.dataset.basic === 'whisper') {
        ui.pick = { need: 'target', [b.dataset.basic]: true };
        return render();
      }
      return doAction({ t: b.dataset.basic });
    }
    const ans = e.target.closest('[data-ans]');
    if (ans) {
      if (ans.dataset.ans === 'block') {
        const worn = E.live(pl(viewer())).some((x) => x.k === ans.dataset.k);
        if (!worn) return confirmBluff(ans.dataset.k, () => doAction({ t: 'block', k: ans.dataset.k }), 'block');
        return doAction({ t: 'block', k: ans.dataset.k });
      }
      if (ans.dataset.ans === 'passall') {
        E.waitingOn(st()).filter(isHuman).forEach((i) => G && answering() && doAction({ t: 'pass' }, i));
        return;
      }
      return doAction({ t: ans.dataset.ans }, ans.dataset.who != null ? Number(ans.dataset.who) : undefined);
    }
    const lose = e.target.closest('[data-lose]');
    if (lose) return doAction({ t: 'lose', id: Number(lose.dataset.lose) });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target.closest && e.target.closest('[data-target]');
    if (t && ui.pick) {
      e.preventDefault();
      pickTarget(Number(t.dataset.target));
    }
  });
  function onAct(a) {
    if (a === 'rules') return showRules();
    if (a === 'home') return leaveGame();
    if (a === 'resignOnline') { if (confirm('Resign this game? Your opponent wins right away.')) return Online.resign(); return; }
    if (a === 'reveal') return showGameOver(true);
    if (a === 'cancel') {
      ui.pick = null;
      return render();
    }
    if (a === 'show') {
      G.shown = viewer();
      return render();
    }
  }
  function startClaim(k, pair) {
    const m = M(k);
    if (!m.target) return claim({ t: 'claim', k, ...(pair ? { pair: true } : {}) });
    ui.pick = { need: 'target', k, pair: !!pair };
    render();
  }
  function pickTarget(t) {
    const pk = ui.pick;
    ui.pick = null;
    if (pk.scandal) return doAction({ t: 'scandal', target: t });
    if (pk.whisper) return chooseWhisper(t);
    if (pk.k === 'gondolier') return chooseGive(t);
    claim({ t: 'claim', k: pk.k, target: t, ...(pk.pair ? { pair: true } : {}) });
  }
  // A Whisper: which mask do you say they're wearing? What you've seen and what they've claimed helps you choose.
  function chooseWhisper(t) {
    const v = viewer();
    const q = pl(t);
    const seen = (pl(v).seen || []).filter((x) => q.masks.some((m) => m.id === x.id && m.up === 'hidden'));
    const opt = (k) => {
      const sure = seen.some((x) => x.k === k);
      const claimed = q.claims[k] || 0;
      return `<button class="lose-opt whisper-opt${sure ? ' sure' : ''}" data-wk="${k}" style="--mc:${M(k).color}">${maskImg(k)}<b>${esc(M(k).name)}</b><small>${sure ? '👁️ You’ve seen it on them' : claimed ? `Claimed ×${claimed}` : 'Never claimed'}</small><small class="muted">${(E.knowledge(st(), v).known[k] || 0)} of ${E.COPIES} seen</small></button>`;
    };
    const back = openModal(`<h2>🗣️ Whisper about ${esc(q.name)}</h2>
      <p>Which mask is ${esc(q.name)} wearing? Right, and it’s torn off. Wrong, and you pay ${insultCost(pl(v))} for the slander. (🪙${E.WHISPER_COST} either way.)</p>
      <div class="lose-pick whisper-pick">${E.MASK_ORDER.map(opt).join('')}</div>`, { onClose: () => render() });
    back.addEventListener('click', (e) => {
      const b = e.target.closest('[data-wk]');
      if (!b) return;
      closeModal(true);
      doAction({ t: 'whisper', target: t, k: b.dataset.wk });
    });
  }
  // The Gondolier: which of your masks goes to the other noble.
  function chooseGive(t) {
    const p = pl(viewer());
    const back = openModal(`<h2>🛶 Which mask do you give ${esc(pl(t).name)}?</h2>
      <p>You’ll get one of their hidden masks at random — and you’ll both see what you got.</p>
      <div class="lose-pick">${E.live(p).map((m) => `<button class="lose-opt" data-give="${m.id}" style="--mc:${M(m.k).color}">${maskImg(m.k)}<b>${esc(M(m.k).name)}</b><small>🙈 hidden</small></button>`).join('')}</div>`, { onClose: () => render() });
    back.addEventListener('click', (e) => {
      const b = e.target.closest('[data-give]');
      if (!b) return;
      closeModal(true);
      claim({ t: 'claim', k: 'gondolier', target: t, give: Number(b.dataset.give) });
    });
  }
  // Claiming a mask you don't wear is a bluff: say so before it's done.
  function claim(a) {
    const worn = !!E.wearing(pl(viewer()), [a.k, a.pair ? E.PAIRS[a.k].with : null].filter(Boolean));
    if (worn) return doAction(a);
    confirmBluff(a.k, () => doAction(a), 'claim', a.pair);
  }
  function confirmBluff(k, go, what, pair) {
    const m = M(k);
    if (pair) {
      const w = M(E.PAIRS[k].with);
      const back = openModal(`<div class="bluff-ask"><span class="pair-imgs big">${maskImg(k, 'big')}${maskImg(E.PAIRS[k].with, 'big')}</span><div><h2>🎭 A bluff</h2>
        <p>You don’t wear both <b>${esc(m.name)}</b> and <b>${esc(w.name)}</b>. Claim the ${esc(E.PAIRS[k].name)} anyway — and hope nobody calls <b>“Unmask!”</b></p>
        <p class="muted">If someone does, you lose a mask and the power fails${E.costOf(k, true) ? ` (the 🪙${E.costOf(k, true)} is spent either way)` : ''}.</p>
        <div class="btn-row"><button class="btn danger" data-go>🎭 Bluff it</button><button class="btn ghost" data-close>Think again</button></div></div></div>`, { onClose: () => render() });
      back.querySelector('[data-go]').onclick = () => {
        closeModal(true);
        go();
      };
      return;
    }
    const back = openModal(`<div class="bluff-ask">${maskImg(k, 'big')}<div><h2>🎭 A bluff</h2>
      <p>You don’t wear <b>${esc(m.name)}</b>. ${what === 'block' ? 'Block anyway' : 'Claim it anyway'} — and hope nobody calls <b>“Unmask!”</b></p>
      <p class="muted">If someone does, you lose a mask${what === 'block' ? ' and it happens anyway' : ' and the power fails'}${m.cost && what !== 'block' ? ` (the 🪙${m.cost} is spent either way)` : ''}.</p>
      <div class="btn-row"><button class="btn danger" data-go>🎭 Bluff it</button><button class="btn ghost" data-close>Think again</button></div></div></div>`, { onClose: () => render() });
    back.querySelector('[data-go]').onclick = () => {
      closeModal(true);
      go();
    };
  }

  // ---------------------------------------------------------------- moves
  function doAction(a, who) {
    if (G.mode === 'online') return Online.send(a);
    const s = st();
    const pi = who != null ? who : answering() ? viewer() : s.turn;
    const mark = s.log[s.log.length - 1];
    try {
      E.apply(s, pi, a);
    } catch (err) {
      toast(esc(err.message), 'bad');
      return;
    }
    if (!pl(pi).ai) G.moved = true;
    if (s.phase === 'over') recordGame();
    ui.pick = null;
    if (a.t === 'mingle') sfx('coin');
    else if (a.t === 'toast') sfx('reveal');
    else if (a.t === 'claim' || a.t === 'block') sfx('card');
    else if (a.t === 'challenge') sfx('dice');
    else if (a.t === 'lose') sfx('bad');
    save();
    render();
    tellFresh(s.log.slice(s.log.lastIndexOf(mark) + 1), null);
    if (s.phase === 'over') {
      setTimeout(() => G && G.state === s && showGameOver(false), 700);
      return;
    }
    scheduleAI();
  }

  // What just happened, said once: a short notice for each new line, and a reveal when a mask is unmasked.
  function tellFresh(lines, prev) {
    if (!lines.length || (G.mode === 'sim' && G.speed === 'turbo')) return;
    const s = st();
    const v = viewer();
    const ch = s.last && s.last.challenge;
    lines.forEach((l) => {
      if (/calls “Unmask!”/.test(l.text)) return;
      if (l.who === v && (G.mode === 'ai' || G.mode === 'online') && !/loses a mask|leaves the ball|pays for the insult|really is|bluffing/.test(l.text)) return;
      toast(`${l.who != null ? `<span class="dot" style="--pc:${PCOLOR[l.who]}"></span>` : ''}${esc(l.text)}`, /loses a mask|bluffing|leaves/.test(l.text) ? 'bad' : '');
    });
    if (ch && lines.some((l) => /calls “Unmask!”/.test(l.text))) {
      const involved = G.mode === 'sim' ? G.speed === 'watch' : ch.by === v || ch.of === v || G.mode === 'local';
      if (involved) unmaskReveal(ch);
      sfx(ch.truth ? (ch.of === v ? 'good' : 'bad') : ch.of === v ? 'bad' : 'good', 300);
    }
    const wh = s.last && s.last.t === 'whisper' ? s.last : null;
    if (wh && lines.some((l) => /to whisper that/.test(l.text))) {
      const involved = G.mode === 'sim' ? G.speed === 'watch' : wh.who === v || wh.target === v || G.mode === 'local';
      if (involved) whisperReveal(wh);
      sfx(wh.truth ? (wh.target === v ? 'bad' : 'good') : wh.who === v ? 'bad' : 'good', 300);
    }
    if (lines.some((l) => l.who != null && /takes 🪙|pocketed|won ⭐|wins ⭐|gains/.test(l.text))) sfx('coin', 150);
    void prev;
  }
  function whisperReveal(wh) {
    const by = pl(wh.who).name;
    const of = pl(wh.target).name;
    openModal(`<div class="unmask ${wh.truth ? 'lie' : 'truth'}">
      <div class="um-title">🗣️ A whisper</div>
      <p><b>${esc(by)}</b> whispered that <b>${esc(of)}</b> is wearing <b>${esc(M(wh.k).name)}</b>.</p>
      <div class="um-card ${wh.truth ? 'shake' : 'flip'}">${wh.truth ? maskImg(wh.k, 'big') : `<img class="mk-img big" src="${IMG('back')}" alt="">`}<span class="um-verdict">${wh.truth ? '✓ True!' : '✗ Not so!'}</span></div>
      <p>${wh.truth ? `${esc(of)}’s ${esc(M(wh.k).name)} is torn off and out of play.` : `${esc(of)} wears no ${esc(M(wh.k).name)}, so ${esc(by)} pays for the slander.`}</p>
      <div class="btn-row" style="justify-content:center"><button class="btn" data-close>Back to the ball</button></div></div>`, { cls: 'locked' });
    if (G.mode === 'sim' || (G.mode === 'ai' && wh.who !== viewer() && wh.target !== viewer())) setTimeout(() => ui.modal && $('.unmask') && closeModal(), 2600);
  }
  function unmaskReveal(ch) {
    const k = ch.k;
    const by = pl(ch.by).name;
    const of = pl(ch.of).name;
    const lost = (st().last.lost || []).map((x) => `<span class="lost-mask">${maskImg(x.k)}<small>${esc(pl(x.who).name)} lost ${esc(M(x.k).name)}</small></span>`).join('');
    openModal(`<div class="unmask ${ch.truth ? 'truth' : 'lie'}">
      <div class="um-title">🎭 “Unmask!”</div>
      <p><b>${esc(by)}</b> challenged <b>${esc(of)}</b>’s claim to be <b>${esc(M(k).name)}</b>${ch.pair ? ` and <b>${esc(M(ch.pair).name)}</b>` : ''}.</p>
      <div class="um-card ${ch.truth ? 'flip' : 'shake'}">${ch.truth ? (ch.pair ? `<span class="pair-imgs big">${maskImg(k, 'big')}${maskImg(ch.pair, 'big')}</span>` : maskImg(k, 'big')) : `<img class="mk-img big" src="${IMG('back')}" alt="">`}<span class="um-verdict">${ch.truth ? '✓ Honest!' : '✗ A bluff!'}</span></div>
      <p>${ch.truth ? `${esc(of)} really is ${esc(M(k).name)}${ch.pair ? ` and ${esc(M(ch.pair).name)} — both masks are` : ' — the mask is'} shuffled back into the wardrobe and ${esc(of)} draws ${ch.pair ? 'fresh ones' : 'a fresh one'}. ${esc(by)} pays for the insult.` : `${esc(of)} was bluffing and loses a mask.`}</p>
      ${lost ? `<div class="um-lost">${lost}</div>` : ''}
      <div class="btn-row" style="justify-content:center"><button class="btn" data-close>Back to the ball</button></div></div>`, { cls: 'locked' });
    if (G.mode === 'sim' || (G.mode === 'ai' && ch.by !== viewer() && ch.of !== viewer())) setTimeout(() => ui.modal && $('.unmask') && closeModal(), 2600);
  }

  // ---------------------------------------------------------------- the computer nobles
  function scheduleAI() {
    stopAI();
    if (!G || G.mode === 'online' || G.mode === 'past' || ui.modal) return;
    const s = st();
    const P = s.pending;
    if (s.phase === 'act' && onlyComputersLeft()) {
      if (!G.rushing) {
        G.rushing = true;
        toast('⏩ Only computer nobles are left at the ball — racing to the finish.');
      }
      ui.aiTimer = setTimeout(rushStep, 60);
      return;
    }
    if (s.phase === 'act' && answering()) return scheduleAnswers();
    if (s.phase !== 'act' || s.turn == null || !pl(s.turn).ai) return;
    ui.aiTimer = setTimeout(aiStep, G.mode === 'sim' ? SIM_SPEEDS[G.speed].ai : P && P.stage === 'challenge' ? 650 : P ? 800 : 1000);
  }
  // A claim is open: each computer noble makes up its mind now. Those letting it pass do so quietly; those who
  // want to call "Unmask!" wait a moment first (a person can beat them to it).
  function scheduleAnswers() {
    const s = st();
    const P = s.pending;
    const key = `${s.log.length}|${P.claimer}|${P.k}`;
    if (!ui.answers || ui.answers.key !== key) {
      clearAnswers();
      ui.answers = { key, decided: [], timers: [] };
    }
    const fast = G.mode === 'sim' ? SIM_SPEEDS[G.speed].ai : null;
    E.waitingOn(s).filter((i) => pl(i).ai && !ui.answers.decided.includes(i)).forEach((i) => {
      ui.answers.decided.push(i);
      const call = E.aiChoose(s, i, pl(i).level || G.level).t === 'challenge';
      const wait = call ? (fast != null ? fast * (0.5 + Math.random()) : 1200 + Math.random() * 2800) : fast != null ? fast : 300 + Math.random() * 500;
      ui.answers.timers.push(setTimeout(() => {
        if (!G || G.state !== s || !answering() || ui.answers.key !== key || !E.waitingOn(st()).includes(i)) return;
        if (ui.modal) {
          // A pop-up is open: think again once it closes.
          ui.answers.decided = ui.answers.decided.filter((x) => x !== i);
          return;
        }
        doAction({ t: call ? 'challenge' : 'pass' }, i);
      }, wait));
    });
  }
  function clearAnswers() {
    if (ui.answers) ui.answers.timers.forEach(clearTimeout);
    ui.answers = null;
  }
  // Once every person has left the ball there's nothing to decide, so the computers play on in quick batches.
  const onlyComputersLeft = () => (G.mode === 'ai' || G.mode === 'local') && !st().players.some((p) => !p.ai && !p.out);
  function rushStep() {
    if (!G || ui.modal) return;
    const s = st();
    for (let i = 0; i < 40 && s.phase === 'act'; i++) {
      const w = E.waitingOn(s);
      if (!w.length || !w.every((x) => pl(x).ai)) break;
      try {
        if (answering()) {
          const calls = w.filter((x) => E.aiChoose(s, x, pl(x).level || G.level).t === 'challenge');
          if (calls.length) E.apply(s, calls[Math.floor(Math.random() * calls.length)], { t: 'challenge' });
          else w.forEach((x) => E.apply(s, x, { t: 'pass' }));
        } else E.apply(s, w[0], E.aiChoose(s, w[0], pl(w[0]).level || G.level));
      } catch (err) {
        break;
      }
    }
    if (s.phase === 'over') recordGame();
    save();
    render();
    if (s.phase === 'over') {
      setTimeout(() => G && G.state === s && showGameOver(false), 400);
      return;
    }
    scheduleAI();
  }
  function stopAI() {
    clearTimeout(ui.aiTimer);
    ui.aiTimer = null;
  }
  // A safety net: if a computer noble is due to act and nothing has changed for a while, wake it up again.
  let stall = { sig: '', at: 0 };
  setInterval(() => {
    if (!G || G.mode === 'online' || G.mode === 'past' || ui.modal || st().phase !== 'act') return;
    const s = st();
    const sig = `${s.log.length}|${s.turn}|${s.pending ? `${s.pending.stage}:${(s.pending.passed || []).length}` : ''}`;
    if (sig !== stall.sig) {
      stall = { sig, at: Date.now() };
      return;
    }
    if (Date.now() - stall.at < 5000 || !E.waitingOn(s).some((i) => pl(i).ai)) return;
    stall.at = Date.now();
    clearAnswers();
    scheduleAI();
  }, 1000);
  function aiStep() {
    if (!G || ui.modal) return;
    const s = st();
    if (s.phase !== 'act' || s.turn == null || !pl(s.turn).ai) return;
    doAction(E.aiChoose(s, s.turn, pl(s.turn).level || G.level));
  }

  function leaveGame() {
    clearAnswers();
    if (G.mode === 'past') return showHistory();
    if (G.mode === 'sim') return stopSim();
    if (G.mode === 'online') {
      const id = G.id;
      Online.forgetOnline();
      return showSetup(id);
    }
    save();
    if (window.BoardSaves) window.BoardSaves.flush();
    showSetup();
  }

  // ---------------------------------------------------------------- the final unmasking
  function showGameOver(instant) {
    const s = st();
    const w = E.winner(s);
    const order = E.ranking(s);
    const why = s.ended === 'favor' ? `⭐ ${esc(pl(w).name)} won ${E.FAVOR_WIN} Favor with the Doge` : s.ended === 'last' ? `🎭 ${esc(pl(w).name)} was the last noble still masked` : '🕛 Midnight struck — the most Favor won';
    const head = w < 0 ? '🤝 The Doge can’t choose — it’s a tie!' : you(w) ? '🏆 You are the star of the ball!' : `🏆 ${esc(pl(w).name)} is the star of the ball!`;
    const row = (i, k) => {
      const p = pl(i);
      return `<div class="fin-row${i === w ? ' win' : ''}" style="--pc:${PCOLOR[i]};--d:${instant ? 0 : 0.5 + k * 0.35}s">
        <span class="fin-place">${i === w ? '👑' : ['1st', '2nd', '3rd', '4th', '5th'][k]}</span>
        <b class="fin-name">${SIGN[i]} ${esc(p.name)}${you(i) ? ' <em>you</em>' : ''}</b>
        <span class="fin-favor">⭐ ${p.favor}</span>
        <span class="fin-masks">${p.masks.map((m) => `<span class="tile ${m.up === 'lost' ? 'lost' : 'face'}" title="${esc(M(m.k).name)}">${maskImg(m.k)}${m.up === 'lost' ? '<i>✗</i>' : ''}</span>`).join('')}</span>
        <small class="fin-note">${p.out ? 'left the ball' : `${plural(E.live(p).length, 'mask')} · 🪙${p.ducats}`}${p.intrigue && E.INTRIGUES[p.intrigue.id] ? ` · ${E.INTRIGUES[p.intrigue.id].icon} ${esc(E.INTRIGUES[p.intrigue.id].name)} ${p.intrigue.done ? '✓' : '✗'}` : ''}</small>
      </div>`;
    };
    if (!instant) sfx(w >= 0 && you(w) ? 'win' : w >= 0 && (G.mode === 'ai' || G.mode === 'online') ? 'lose' : 'reveal');
    G.revealed = true;
    if (G.mode !== 'past') save();
    openModal(`<div class="finale${instant ? ' instant' : ''}">
      <div class="fin-title">🎭 Unmasked!</div>
      <p class="fin-why">${why}</p>
      <h2>${head}</h2>
      <div class="fin-rows">${order.map(row).join('')}</div>
      <div class="btn-row" style="justify-content:center">
        <button class="btn" data-close>🎭 See the ballroom</button>
        ${G.mode === 'past' ? '' : `<button class="btn ghost" data-fin="again">${G.mode === 'online' ? '🌐 Your games' : G.mode === 'sim' ? '🧪 Run again' : '🎭 Play again'}</button>`}
        <button class="btn ghost" data-fin="hist">🏆 Game history</button>
      </div></div>`, { cls: 'wide', onClose: () => render() }).addEventListener('click', (e) => {
      const b = e.target.closest('[data-fin]');
      if (!b) return;
      closeModal(true);
      if (b.dataset.fin === 'hist') return showHistory();
      if (G.mode === 'sim') return startSim({ levels: G.levels, speed: G.speed });
      if (G.mode === 'online') {
        Online.forgetOnline();
        return showSetup(G.id);
      }
      showSetup();
    });
  }

  // ---------------------------------------------------------------- game history
  function newLocalId() {
    const b = new Uint8Array(8);
    crypto.getRandomValues(b);
    return 'mq' + [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  // Finished games wait in this browser until the server has them, so a dropped connection or an expired
  // sign-in can't lose one: they're sent again on the next visit.
  const HISTORY_QUEUE = 'ahrensMasquerade.historyQueue';
  const queued = () => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_QUEUE) || '[]');
    } catch (e) {
      return [];
    }
  };
  function setQueued(list) {
    try {
      localStorage.setItem(HISTORY_QUEUE, JSON.stringify(list.slice(-8)));
    } catch (e) {
      try {
        localStorage.setItem(HISTORY_QUEUE, JSON.stringify(list.slice(-8).map((x) => Object.assign({}, x, { board: x.board && Object.assign({}, x.board, { log: [] }) }))));
      } catch (err) {
        /* storage blocked */
      }
    }
  }
  let sending = false;
  async function sendQueued() {
    if (sending || !sessionId()) return;
    sending = true;
    try {
      for (const item of queued()) {
        const r = await api('/api/masquerade/history/record', item);
        if (!r.ok && r.status !== 400) break;
        setQueued(queued().filter((x) => x.id !== item.id));
        if (r.ok) markSaved(item.id);
      }
    } finally {
      sending = false;
    }
  }
  function markSaved(id) {
    if (G && G.gid === id) G.historyOk = true;
    const g = rawSave();
    if (g && g.gid === id && !g.historyOk) {
      g.historyOk = true;
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(g));
      } catch (e) {
        /* storage full */
      }
    }
  }
  function historyItem(g) {
    const s = g.state;
    return {
      id: g.gid, kind: g.mode, level: g.level, names: s.players.map((p) => p.name), cats: s.players.map((p) => E.score(s, p)), winner: E.winner(s),
      // Seats are drawn at random, and the winner may be the last noble masked rather than the one with the most Favor.
      me: g.mode === 'ai' ? s.players.findIndex((p) => !p.ai) : null, ended: s.ended, order: E.ranking(s), board: s,
    };
  }
  function recordGame() {
    const g = G;
    if (!g || g.recorded || (g.mode !== 'ai' && g.mode !== 'local') || !sessionId()) return;
    g.gid = g.gid || newLocalId();
    g.recorded = true;
    save();
    const item = historyItem(g);
    setQueued(queued().filter((x) => x.id !== item.id).concat(item));
    sendQueued();
  }
  function requeueLastGame() {
    const g = rawSave();
    if (!g || !g.state || g.state.phase !== 'over' || g.historyOk || !g.gid || (g.mode !== 'ai' && g.mode !== 'local')) return;
    if (!queued().some((x) => x.id === g.gid)) setQueued(queued().concat(historyItem(g)));
  }
  async function openPast(id) {
    const r = await api(`/api/masquerade/history/board?id=${encodeURIComponent(id)}`);
    const state = r.ok && r.data && r.data.state;
    if (!state || !Array.isArray(state.players) || state.phase !== 'over') return toast(esc((r.data && r.data.error) || 'Couldn’t load that game.'), 'bad');
    const h = (hist.items || []).find((x) => x.id === id);
    startFrom({ state, mode: 'past', level: h && h.level, view: r.data.me != null ? r.data.me : h && h.me != null ? h.me : 0, gid: id, revealed: true });
  }
  const hist = { items: null, kind: 'all' };
  async function showHistory() {
    stopAI();
    G = null;
    document.body.className = 'setup-mode';
    $('#app').innerHTML = `
      <div class="setup gh">
      <div class="gh-top"><a class="gh-lobby" href="/ahrens-games">← <img class="gh-dice" src="/img/board-games-favicon-48.png?v=8" alt="" width="20" height="20"> Game lobby</a><button class="btn ghost sm" id="hist-new">🎭 New game</button></div>
        <div class="setup-card gh-card panel hist">
          <h2>🏆 Game history</h2>
          <div id="hist-body"><p class="muted">Loading your games…</p></div>
        </div>
    </div>`;
    $('#hist-new').onclick = () => showSetup();
    const r = await api('/api/masquerade/history');
    if (!$('#hist-body')) return;
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
    window.BoardHistory.render(box, {
      game: 'masquerade',
      fmt: (n) => `⭐${n}`,
      rows: [['⭐ Favor', 'favor'], ['🪙 Ducats', 'ducats'], ['🎭 Masks left', 'masks']],
      colors: PCOLOR,
      levels: LEVEL_NAME,
      foe: 'computer noble',
      view: '🎭 See the ballroom',
      canView: () => true,
      onView: openPast,
      empty: 'No finished balls yet. Games are added the moment someone wins.',
      ending: (h) => (h.ended === 'favor' ? `⭐ won with ${E.FAVOR_WIN} Favor` : h.ended === 'last' ? '🎭 won as the last noble masked' : ''),
    }, hist);
  }

  // ---------------------------------------------------------------- computer vs computer (admin)
  function openSimSetup() {
    const sim = Object.assign({ nobles: 4, levels: ['hard', 'normal', 'easy', 'brutal', 'normal'], speed: 'fast' }, prefs().sim);
    const draw = () => `<h2>🧪 Computer vs computer</h2>
      <p class="muted">Admin only. Computer nobles play a whole ball while you watch, every mask face up. Nothing is saved or added to game history.</p>
      <div class="field"><span class="label">Nobles</span><div class="seg" data-k="nobles">${[2, 3, 4, 5].map((n) => `<button data-v="${n}" class="${sim.nobles === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      ${Array.from({ length: sim.nobles }, (_, i) => `<div class="field"><span class="label" style="color:${PCOLOR[i]}">${SIGN[i]} ${esc(NOBLE_NAMES[i])}</span><div class="seg" data-k="l${i}">${Object.keys(LEVEL_NAME).map((l) => `<button data-v="${l}" class="${sim.levels[i] === l ? 'on' : ''}">${LEVEL_NAME[l]}</button>`).join('')}</div></div>`).join('')}
      <div class="field"><span class="label">Speed</span><div class="seg" data-k="speed">${Object.keys(SIM_SPEEDS).map((v) => `<button data-v="${v}" class="${sim.speed === v ? 'on' : ''}">${SIM_SPEEDS[v].name}</button>`).join('')}</div></div>
      <button class="btn big" id="sim-go">▶ Start</button>`;
    const back = openModal('<div id="dlg"></div>');
    const root = back.querySelector('#dlg');
    root.innerHTML = draw();
    root.addEventListener('click', (e) => {
      const b = e.target.closest('.seg button');
      if (b) {
        const k = b.parentNode.dataset.k;
        if (k === 'nobles') sim.nobles = Number(b.dataset.v);
        else if (k === 'speed') sim.speed = b.dataset.v;
        else sim.levels[Number(k.slice(1))] = b.dataset.v;
        root.innerHTML = draw();
        return;
      }
      if (e.target.closest('#sim-go')) {
        savePrefs(Object.assign(prefs(), { sim }));
        startSim({ levels: sim.levels.slice(0, sim.nobles), speed: sim.speed });
      }
    });
  }
  function startSim(sim) {
    closeModal(true);
    const n = sim.levels.length;
    const state = E.newGame({ names: NOBLE_NAMES.slice(0, n), ai: sim.levels.map(() => true), levels: sim.levels, first: Math.floor(Math.random() * n) });
    startFrom({ state, mode: 'sim', level: sim.levels[0], levels: sim.levels, speed: sim.speed });
  }
  function stopSim() {
    stopAI();
    closeModal(true);
    showSetup();
  }

  // ---------------------------------------------------------------- rules
  const RULE_TABS = [['overview', 'The ball'], ['turn', 'Your turn'], ['masks', 'The masks'], ['pairs', 'Pairs'], ['whisper', 'Whispers'], ['unmask', '“Unmask!”'], ['blocks', 'Blocks'], ['intrigue', 'Intrigues'], ['winning', 'Winning']];
  function rulesBody(tab) {
    const maskRow = (k) => `<tr><td>${maskImg(k, 'tiny')} <b>${esc(M(k).name)}</b></td><td><b>${esc(M(k).power)}</b>: ${esc(M(k).text)}</td><td>${esc(blocksLine(k)) || '—'}</td></tr>`;
    if (tab === 'overview') return `${window.AhrensTutorial ? '<p class="rb-video"><button class="btn sm" data-tutorial="masquerade">🎬 Watch the video tutorial</button> New to the ball? The video plays a real game against the computer, step by step.</p>' : ''}<p>Venice, carnival night. Every noble at the Doge’s ball wears <b>two masks, face down</b>. Each mask has a power — but on your turn you may claim <b>any</b> mask’s power, whether you’re wearing it or not.</p>
      <p>Everyone else can call <b>“Unmask!”</b> on a claim they don’t believe. Liars lose a mask. Honest nobles shuffle the mask they showed back into the wardrobe and draw a fresh one — and the accuser pays for the insult.</p>
      <p>Win by earning <b>⭐${E.FAVOR_WIN} Favor</b> with the Doge, or by being the <b>last noble still masked</b>. There’s no clock — the ball goes on until one of those happens.</p>
      <ul><li>🎭 ${E.MASK_ORDER.length} kinds of mask, ${E.COPIES} of each. The rest wait in the wardrobe.</li><li>🪙 Each noble starts with ${E.START_DUCATS} ducats and no Favor.</li><li>📰 The Gazette records every claim — and each noble’s row shows which masks they’ve claimed, so you can catch a liar who claims too many.</li></ul>`;
    if (tab === 'turn') return `<p>On your turn, do <b>one</b> thing:</p>
      <ul><li>🪙 <b>Mingle</b> — take 🪙1.</li><li>🥂 <b>Toast the Doge</b> — pay 🪙${E.TOAST_COST} to win ⭐1 Favor.</li><li>🗣️ <b>Whisper</b> — pay 🪙${E.WHISPER_COST} and name a mask a noble wears. Right, and it’s torn off; wrong, and you pay ⭐${E.INSULT_FAVOR} Favor (or a mask).</li><li>📜 <b>Start a scandal</b> — pay 🪙${E.SCANDAL_COST}: a noble loses a mask.</li><li>🤝 <b>Claim a pair</b> — two masks at once, for a stronger power.</li><li>🎭 <b>Claim a mask’s power</b> — any of the seven. Others may call “Unmask!”.</li></ul>
      <p>The plain actions can’t be challenged or blocked. A claimed power can be challenged by anyone, and some can be blocked — by the noble they’re aimed at, or, for a Waltz, by any rival who cuts in.</p>`;
    if (tab === 'pairs') return `<p>Claim <b>two masks at once</b> for a stronger version of the first mask’s power. Anyone may call “Unmask!” — and the claim is only honest if you wear <b>both</b>. If either is missing, it’s a bluff and you lose a mask.</p>
      <table class="rules-table"><tr><th>Pair</th><th>Masks</th><th>Power</th></tr>${E.PAIR_ORDER.map((k) => `<tr><td><b>${esc(E.PAIRS[k].name)}</b></td><td>${maskImg(k, 'tiny')} ${maskImg(E.PAIRS[k].with, 'tiny')}</td><td>${esc(E.PAIRS[k].text)}</td></tr>`).join('')}</table>
      <p class="muted">Blocks still work on pairs: the Doge stops the Court Fool, the Plague Doctor stops the Apothecary, and a rival Duchess can cut in on the Royal Court’s waltz. An honest pair sends both masks back into the wardrobe.</p>`;
    if (tab === 'whisper') return `<p>Instead of claiming, you can <b>whisper</b>: pay 🪙${E.WHISPER_COST}, pick a noble, and name a mask you think they’re wearing.</p>
      <ul><li><b>Right?</b> That mask is torn off and out of play — they don’t get to choose.</li><li><b>Wrong?</b> You pay for the slander: ⭐${E.INSULT_FAVOR} Favor, or a mask if you have less.</li></ul>
      <p>A whisper can’t be challenged or blocked. It rewards paying attention: the Spy’s peeks, the Gondolier’s swaps, and every honest claim tell you something. Which means claiming a mask you really wear can give it away.</p>
      <p class="muted">Each noble’s card shows the masks they’ve claimed since they last showed one. When an honest mask is shown and shuffled away, its claims are wiped — it isn’t there any more.</p>`;
    if (tab === 'intrigue') return `<p>Every noble is dealt one <b>secret Intrigue</b> — a goal only they know. The moment it comes true it’s revealed and wins <b>⭐${E.INTRIGUE_FAVOR} Favor</b>, which can win the ball outright.</p>
      <table class="rules-table"><tr><th>Intrigue</th><th>Comes true when you…</th></tr>${E.INTRIGUE_ORDER.map((k) => `<tr><td>${E.INTRIGUES[k].icon} <b>${esc(E.INTRIGUES[k].name)}</b></td><td>${esc(E.INTRIGUES[k].text)}</td></tr>`).join('')}</table>
      <p class="muted">Watch what your rivals chase: a noble toasting again and again, or bluffing boldly, may be one step from their Intrigue.</p>`;
    if (tab === 'masks') return `<table class="rules-table"><tr><th>Mask</th><th>Power</th><th>Block</th></tr>${E.MASK_ORDER.map(maskRow).join('')}</table>
      <p class="muted">The Gondolier makes bluffing slippery: after a swap, the mask you were counting on might be in someone else’s hands — and they know exactly what they got.</p>`;
    if (tab === 'unmask') return `<p>When someone claims a power, every other noble decides <b>at the same time</b> whether to call <b>“Unmask!”</b>. Nobody can see who has already let it pass, and the <b>first</b> to call it is the challenger. (A block can only be challenged by the noble who was blocked.) The claimer must show a mask of that kind:</p>
      <ul><li><b>Bluffing?</b> They lose a mask of their choice (it’s turned face up and out of play) and the power fails. A bluffed block fails, and the power goes ahead.</li>
      <li><b>Honest?</b> They show the mask, shuffle it back into the wardrobe and draw a fresh one, so nobody knows what they wear now. The power still happens. The accuser pays <b>⭐${E.INSULT_FAVOR} Favor</b> — or, with less than ⭐${E.INSULT_FAVOR}, a mask.</li></ul>
      <p class="muted">There are always ${E.COPIES} of each mask in play — between the nobles, the lost pile and the wardrobe.</p>
      <p class="muted">Losing both masks means leaving the ball. The Plague Doctor’s Remedy gives you a fresh mask from the wardrobe — but a lost mask is never shuffled back in; it stays face up and out of play.</p>`;
    if (tab === 'blocks') return `<p>Three powers can be blocked by the noble they target:</p>
      <ul><li>🃏 The Jester’s Rumour — blocked by 👑 the Doge.</li><li>🧪 The Poisoner’s Poison — blocked by ⚕️ the Plague Doctor.</li><li>🛶 The Gondolier’s Secret passage — blocked by 🕵️ the Spy.</li></ul>
      <p><b>Cutting in:</b> when someone claims the Duchess’s Waltz, any rival may pay the band 🪙${E.CUT_IN_COST} and claim the Duchess to take the Doge’s hand instead — the waltz wins no Favor.</p>
      <p>A block is a claim too: only the noble who was blocked may call “Unmask!” on it.</p>`;
    return `<ul><li>⭐ Reach <b>${E.FAVOR_WIN} Favor</b> and you win at once.</li><li>🎭 Be the <b>last noble still masked</b> and you win.</li><li>🕰️ There are no rounds — the ball goes on until someone does one of those.</li></ul>
      <p class="muted">Favor comes from the Duchess’s Waltz, the Jester’s Rumour, and toasts — and goes when you accuse an honest noble. Waltzes can be cut in on, so a toast is the one sure way to win Favor.</p>`;
  }
  function showRules(tab) {
    ui.rulesTab = tab || ui.rulesTab;
    const toc = () => RULE_TABS.map(([k, name]) => `<button data-tab="${k}" class="${ui.rulesTab === k ? 'on' : ''}">${name}</button>`).join('');
    const back = openModal(`<h2>📜 The Masquerade Court — how to play</h2><nav class="rules-tabs">${toc()}</nav><article class="rules-body">${rulesBody(ui.rulesTab)}</article>`, { cls: 'wide', onClose: G ? null : () => {} });
    back.querySelector('.rules-tabs').onclick = (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      ui.rulesTab = b.dataset.tab;
      back.querySelectorAll('.rules-tabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === ui.rulesTab));
      back.querySelector('.rules-body').innerHTML = rulesBody(ui.rulesTab);
    };
  }

  // ---------------------------------------------------------------- start
  requeueLastGame();
  sendQueued();
  const params = new URLSearchParams(location.search);
  const localId = params.get('local');
  const gameId = params.get('game');
  if (!sessionId()) showGate();
  else if (gameId) showSetup(gameId);
  else if (localId && /^[a-z0-9]{4,40}$/i.test(localId)) {
    const here = rawSave();
    if (validSave(here) && here.gid === localId && lastStatus(localId) === 'here') startFrom(here);
    else if (window.BoardSaves) {
      $('#app').innerHTML = '<p class="loading-save">Loading your game…</p>';
      window.BoardSaves.load('masquerade', localId).then((g) => {
        if (validSave(g) && g.state.phase !== 'over') startFrom(g);
        else {
          showSetup();
          toast('That game couldn’t be found — it may have finished or been removed.', 'bad');
        }
      });
    } else showSetup();
  } else if (params.get('past')) {
    $('#app').innerHTML = '<p class="loading-save">Loading that game…</p>';
    openPast(params.get('past')).then(() => G || showHistory());
  } else if (params.has('history')) showHistory();
  else showSetup();
  window.__mq = { get G() { return G; }, render, E, send: (a) => doAction(a), schedule: () => scheduleAI() };
})();
