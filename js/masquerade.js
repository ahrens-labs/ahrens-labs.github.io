// The Masquerade Court — page UI. Rules live in masquerade-engine.js.
(function () {
  'use strict';
  const E = window.MasqueradeEngine;
  const SAVE_KEY = 'ahrensMasquerade.v1';
  const PREFS_KEY = 'ahrensMasquerade.prefs';
  const API_BASE = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
  const LEVEL_NAME = { easy: 'Easy', normal: 'Normal', hard: 'Hard', brutal: 'Brutal' };
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
  const WHY = { lie: 'caught bluffing', wrong: 'a false accusation', poison: 'poison', scandal: 'a scandal' };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;

  let G = null; // { state, mode: 'ai' | 'local' | 'online' | 'past', level, shown, gid, moved, recorded, revealed }
  const ui = { aiTimer: null, modal: false, locked: false, onClose: null, rulesTab: 'overview', pick: null };

  // ---------------------------------------------------------------- persistence
  function save() {
    if (!G || G.mode === 'past' || G.mode === 'online') {
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
    BS.put('masquerade', G.gid, G, { mode: G.mode, level: G.level, names: s.players.map((p) => p.name), round: s.round, rounds: E.CHIMES, moved: true });
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
    blurb: 'Play The Masquerade Court against another Ahrens Labs player — a quick game with a 2-minute clock for every decision, or a long game where you answer whenever you like.',
    roundText: (g) => (g.round ? `chime ${g.round} of ${E.CHIMES}` : ''),
    getG: () => G,
    showSetup: (focus) => showSetup(focus),
    isMyTurn: () => G && G.state && G.state.turn === G.me,
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
  const privateOk = () => G.mode !== 'local' || G.shown === viewer() || st().phase === 'over';
  const deciding = () => st().phase === 'act' && st().turn != null && isHuman(st().turn) && (G.mode !== 'online' || G.status === 'active');
  const myDecision = () => deciding() && st().turn === viewer();
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
    if (!window.GameMusic) return;
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
    return `<div class="gh-top"><a class="gh-lobby" href="/board-games.html" title="Back to the game lobby">← <img class="gh-dice" src="/img/board-games-favicon-48.png?v=2" alt="" width="20" height="20"> Game lobby</a>${window.GameMusic ? GameMusic.buttonHtml('btn ghost sm gh-music', 'bt') : ''}</div>
      <div class="gh-hero">
        <img src="${IMG('cover')}" alt="Masked nobles in a candlelit Venetian ballroom: a duchess, a jester and a plague doctor share a secret" class="gh-hero-img">
        <div class="gh-shade"></div>
        <div class="hero-sparks" aria-hidden="true">${sparks}</div>
        <div class="gh-title"><h1 class="display">The Masquerade Court</h1>${withTagline ? '<p>Wear two masks. Claim any power you like — truthfully or not. Call out the liars, win the Doge’s Favor, and still be masked when midnight strikes.</p>' : ''}</div>
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
        ${canResume ? `<div class="gh-resume"><div><b>A ball in progress</b><span>${esc(saved.state.players.map((p) => p.name).join(' · '))} · chime ${saved.state.round} of ${E.CHIMES}</span></div><button class="btn" id="resume">Continue</button></div>` : ''}
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
        <div class="field offline-only">
          <span class="label">Who goes first?</span>
          <div class="seg" id="first"><button data-v="0" class="on">Me</button><button data-v="1">A rival</button><button data-v="r">🎲 Random</button></div>
        </div>
        <button class="btn big offline-only" id="start">🎭 Open the ball</button>
        <div class="gh-links">
          <button class="btn ghost sm" id="how">📜 How to play</button>
          <button class="btn ghost sm" id="hist">🏆 Game history</button>
        </div>
      </div>
      </div>`;
    const names = () => {
      const m = $('#mode .on').dataset.v;
      const n = m === 'local' ? Number($('#seats .on').dataset.v) : 1;
      const keep = [...document.querySelectorAll('#names input')].map((x) => x.value);
      $('#names').innerHTML = Array.from({ length: n }, (_, i) => `<label style="--pc:${PCOLOR[i]}"><span class="label"><i class="sw"></i>${m === 'local' ? `Noble ${i + 1}` : 'Your noble'}</span><input id="n${i}" maxlength="18" value="${esc(keep[i] || pr['n' + i] || NOBLE_NAMES[i])}"></label>`).join('');
    };
    const setMode = (m) => {
      $('.setup').classList.toggle('is-local', m === 'local');
      $('.setup').classList.toggle('is-online', m === 'online');
      $('#first').children[0].textContent = m === 'local' ? 'Noble 1' : 'Me';
      $('#first').children[1].textContent = m === 'local' ? 'Noble 2' : 'A rival';
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
    if ($('#resume')) $('#resume').onclick = () => startFrom(saved);
    $('#start').onclick = () => {
      const mode = $('#mode .on').dataset.v;
      const level = $('#level .on').dataset.v;
      const n = mode === 'local' ? Number($('#seats .on').dataset.v) : 1 + Number($('#rivals .on').dataset.v);
      const typed = [...document.querySelectorAll('#names input')].map((x, i) => x.value.trim() || NOBLE_NAMES[i]);
      const names = Array.from({ length: n }, (_, i) => typed[i] || NOBLE_NAMES[i]);
      let first = $('#first .on').dataset.v;
      first = first === 'r' ? Math.floor(Math.random() * n) : first === '1' && mode === 'ai' ? 1 + Math.floor(Math.random() * (n - 1)) : Number(first);
      const p = Object.assign(prefs(), { mode, level });
      typed.forEach((v, i) => (p['n' + i] = v));
      if (mode === 'local') p.seats = n;
      else p.rivals = n - 1;
      savePrefs(p);
      const ai = names.map((_, i) => mode === 'ai' && i > 0);
      const state = E.newGame({ names, ai, levels: ai.map((x) => (x ? level : null)), first });
      startFrom({ state, mode, level, gid: newLocalId() });
    };
  }

  // ---------------------------------------------------------------- the ballroom
  function startFrom(g) {
    if (!sessionId()) return showGate();
    stopAI();
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
    const sub = G.mode === 'past' ? '📜 Finished ball' : G.mode === 'online' ? `🌐 vs ${esc(pl(1 - G.me).name)}${G.gmode === 'quick' ? ' · ⚡' : ''}${G.gmode === 'quick' && G.deadline ? ' <span class="ol-clock" id="ol-clock"></span>' : ''}` : G.mode === 'local' ? `👥 ${s.players.length} nobles` : `🤖 vs ${plural(s.players.length - 1, 'rival')} · ${LEVEL_NAME[G.level] || ''}`;
    const home = G.mode === 'past' ? '🏆<span class="bt"> History</span>' : G.mode === 'online' ? '🌐<span class="bt"> Game</span>' : '🎭<span class="bt"> New game</span>';
    $('#app').innerHTML = `
      <header class="topbar">
        <div class="brand"><img src="/img/masquerade-favicon-96.png?v=1" alt="" class="brand-logo" width="46" height="46"><div><h1>The Masquerade Court</h1><small>${sub}</small></div></div>
        <div class="top-mid">
          <div class="clock" title="Midnight strikes after ${E.CHIMES} rounds: then the most Favor wins">🕰️ <span>Chime <b>${s.round}</b> of ${E.CHIMES}</span>${pips(s.round, E.CHIMES, 'chimes')}</div>
          <div class="top-chips"><span class="chip">⭐ ${E.FAVOR_WIN} Favor wins</span><span class="chip">🎭 or be the last still masked</span></div>
        </div>
        <div class="top-actions">
          ${window.GameMusic ? GameMusic.buttonHtml('btn ghost sm', 'bt') : ''}
          <button class="btn ghost sm" data-act="rules" aria-label="Rules">📜<span class="bt"> Rules</span></button>
          <button class="btn ghost sm" data-act="home" aria-label="${G.mode === 'past' ? 'History' : 'New game'}">${home}</button>
          <a class="btn ghost sm" href="/board-games.html" aria-label="Game lobby"><img class="gh-dice" src="/img/board-games-favicon-48.png?v=2" alt=""><span class="bt"> Lobby</span></a>
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
  }

  function nobleHtml(i, v) {
    const s = st();
    const p = pl(i);
    const P = s.pending;
    const me = i === v;
    const turn = s.phase === 'act' && s.actor === i;
    const deciding = s.phase === 'act' && s.turn === i && !turn;
    let tag = '';
    if (p.out) tag = '<span class="nb-tag out">Left the ball</span>';
    else if (turn) tag = `<span class="nb-tag turn">${p.ai && s.turn === i ? 'Thinking…' : 'Their move'}</span>`;
    else if (deciding) tag = `<span class="nb-tag ans">${P && P.stage === 'lose' ? 'Losing a mask' : 'Answering…'}</span>`;
    if (turn && you(i)) tag = '<span class="nb-tag turn">Your move</span>';
    const seen = viewerSeen();
    const tiles = p.masks.map((m) => maskTile(m, i, v, seen)).join('');
    const claims = E.MASK_ORDER.filter((k) => p.claims[k]).map((k) => `<span class="rumour" title="${esc(p.name)} has claimed ${esc(M(k).name)} ${plural(p.claims[k], 'time')}">${M(k).icon}${p.claims[k] > 1 ? `<b>×${p.claims[k]}</b>` : ''}</span>`).join('');
    const pick = ui.pick && ui.pick.need === 'target' && E.targets(s, viewer()).includes(i) && !(ui.pick.k && E.claimProblem(s, viewer(), ui.pick.k, i, ui.pick.give || (E.live(pl(viewer()))[0] || {}).id));
    return `<div class="noble${turn ? ' turn' : ''}${deciding ? ' deciding' : ''}${p.out ? ' out' : ''}${me ? ' me' : ''}${pick ? ' pickable' : ''}" style="--pc:${PCOLOR[i]}" ${pick ? `data-target="${i}" role="button" tabindex="0" title="Choose ${esc(p.name)}"` : ''}>
      <div class="nb-head"><span class="nb-sign">${SIGN[i]}</span><b class="nb-name">${esc(p.name)}${you(i) ? ' <em>you</em>' : ''}</b>${p.ai && G.mode !== 'past' ? `<span class="nb-ai">🤖 ${LEVEL_NAME[p.level] || ''}</span>` : ''}</div>
      ${tag}
      <div class="nb-favor" title="${p.favor} of ${E.FAVOR_WIN} Favor">⭐ <b>${p.favor}</b>${pips(p.favor, E.FAVOR_WIN, 'favor')}</div>
      <div class="nb-stats"><span title="Ducats">🪙 <b>${p.ducats}</b></span><span title="Masks still worn">🎭 <b>${E.live(p).length}</b></span></div>
      <div class="nb-masks">${tiles}</div>
      <div class="nb-rumours" title="Every mask this noble has claimed tonight">${claims ? `<small>Claimed:</small>${claims}` : '<small>No claims yet</small>'}</div>
      ${pick ? '<span class="nb-pick">👉 Choose</span>' : ''}
    </div>`;
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
    if (m.up === 'proven') return `<span class="tile proven" title="${esc(M(m.k).name)} — proven: it can’t be challenged">${maskImg(m.k)}<i>🔒</i></span>`;
    const mine = owner === v && privateOk();
    if (m.k && (mine || over || G.mode === 'past')) return `<span class="tile face${mine && !over ? ' secret' : ''}" title="${esc(M(m.k).name)}${mine && !over ? ' — only you can see this' : ''}">${maskImg(m.k)}</span>`;
    const known = seen.find((x) => x.id === m.id);
    if (known) return `<span class="tile back peeked" title="You know this is ${esc(M(known.k).name)}"><img src="${IMG('back')}" alt=""><i>${M(known.k).icon}</i></span>`;
    return '<span class="tile back" title="A hidden mask"><img src="' + IMG('back') + '" alt=""></span>';
  }

  const blocksLine = (k) => {
    const m = M(k);
    if (!m.blocks) return '';
    return k === 'duchess' ? `Blocks ${M(m.blocks).power} · cuts in on a Waltz (🪙${E.CUT_IN_COST})` : `Blocks ${M(m.blocks).power}`;
  };

  function bannerHtml() {
    const s = st();
    const P = s.pending;
    if (s.phase === 'over') return `<div class="banner over">🕛 The ball is over. <button class="btn sm" data-act="reveal">🏆 See who won</button></div>`;
    if (G.mode === 'online' && G.status !== 'active') return '<div class="banner">The game has ended.</div>';
    const a = s.actor;
    if (!P) return `<div class="banner" style="--pc:${PCOLOR[a]}">${you(a) ? '<b>Your move.</b> Claim a mask’s power — any one, worn or not — or take a plain action.' : `${nobleName(a)} is choosing a move…`}</div>`;
    const claim = P.act && P.act.t === 'claim' ? `${nobleName(P.actor)} claims <b>${esc(M(P.act.k).name)}</b>` : '';
    if (P.stage === 'challenge') return `<div class="banner" style="--pc:${PCOLOR[s.turn]}">${claim}. ${you(s.turn) ? '<b>Do you believe it?</b>' : `${nobleName(s.turn)} is deciding whether to call “Unmask!”…`}</div>`;
    if (P.stage === 'block' && P.act.k === 'duchess') return `<div class="banner" style="--pc:${PCOLOR[s.turn]}">${claim} for a Waltz. ${you(s.turn) ? '<b>Will you cut in?</b>' : `${nobleName(s.turn)} may cut in…`}</div>`;
    if (P.stage === 'block') return `<div class="banner" style="--pc:${PCOLOR[s.turn]}">${claim} against ${nobleName(P.act.target)}. ${you(s.turn) ? '<b>Will you block it?</b>' : `${nobleName(s.turn)} may block it…`}</div>`;
    if (P.stage === 'blockChallenge') return `<div class="banner" style="--pc:${PCOLOR[s.turn]}">${nobleName(P.claimer)} claims <b>${esc(M(P.k).name)}</b> ${P.act.k === 'duchess' ? 'to cut in' : 'to block'}. ${you(s.turn) ? '<b>Do you believe them?</b>' : `${nobleName(s.turn)} is deciding…`}</div>`;
    if (P.stage === 'lose') return `<div class="banner bad" style="--pc:${PCOLOR[s.turn]}">${you(s.turn) ? '<b>You must lose a mask.</b> Choose which one.' : `${nobleName(s.turn)} must lose a mask (${esc(WHY[P.why] || 'bad luck')})…`}</div>`;
    return '<div class="banner">…</div>';
  }

  // ---------------------------------------------------------------- the middle: what to do now
  function stageHtml() {
    const s = st();
    if (s.phase === 'over') return `<h3>🕛 Midnight</h3><p class="muted">Every mask has come off. <button class="btn sm" data-act="reveal">See the results</button></p>`;
    if (G.mode === 'past') return '<h3>📜 A finished ball</h3>';
    const P = s.pending;
    const v = viewer();
    if (G.mode === 'local' && deciding() && G.shown !== s.turn && (!P || P.stage !== 'challenge')) {
      return `<div class="curtain"><b>📱 Pass the device to ${nobleName(s.turn)}</b><span>Everyone else, look away — masks are about to show.</span><button class="btn" data-act="show">👀 I’m ${esc(pl(s.turn).name)}</button></div>`;
    }
    if (!myDecision()) {
      const who = s.turn != null ? s.turn : s.actor;
      return `<h3>⏳ Waiting</h3><p class="muted">${nobleName(who)} ${P ? 'is answering' : 'is taking a turn'}…</p>${recentHtml()}`;
    }
    if (!P) return actionsHtml(v);
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
      const proven = E.proven(p, k);
      const why = m.target ? (anyTarget(k) ? (m.cost && p.ducats < m.cost ? `Needs 🪙${m.cost}` : '') : 'No one to target') : E.claimProblem(s, v, k);
      const tag = proven ? '<span class="pw-tag proven">🔒 Proven</span>' : worn ? '<span class="pw-tag worn">✓ You wear it</span>' : '<span class="pw-tag bluff">🎭 Bluff</span>';
      const block = m.blocks ? `<small class="pw-block">🛡️ ${esc(blocksLine(k))}</small>` : '';
      return `<button class="power${why ? ' off' : ''}${ui.pick && ui.pick.k === k ? ' picked' : ''}" data-claim="${k}" ${why ? 'disabled' : ''} style="--mc:${m.color}">
        ${maskImg(k)}<span class="pw-body"><span class="pw-top"><b>${m.icon} ${esc(m.name)}</b>${why ? `<span class="pw-why">${esc(why)}</span>` : tag}</span><span class="pw-name">${esc(m.power)}</span><span class="pw-text">${esc(m.text)}</span>${block}</span></button>`;
    };
    const basic = (t, icon, label, text, why) => `<button class="basic${why ? ' off' : ''}" data-basic="${t}" ${why ? 'disabled' : ''}><span>${icon}</span><b>${label}</b><small>${why || text}</small></button>`;
    const picking = ui.pick ? `<div class="picking">👉 ${ui.pick.need === 'target' ? `Choose a noble above for <b>${esc(ui.pick.k ? M(ui.pick.k).power : 'the scandal')}</b>.` : ''} <button class="btn ghost sm" data-act="cancel">Cancel</button></div>` : '';
    return `<h3>🎭 Your move <small>claim any mask — the ones you don’t wear are bluffs</small></h3>
      ${picking}
      <div class="powers">${E.MASK_ORDER.map(power).join('')}</div>
      <h3>🥂 Or simply…</h3>
      <div class="basics">
        ${basic('mingle', '🪙', 'Mingle', 'Take 🪙1. Nobody can stop it.')}
        ${basic('toast', '🥂', 'Toast the Doge', `Pay 🪙${E.TOAST_COST}: win ⭐1 Favor. Nobody can stop it.`, p.ducats < E.TOAST_COST ? `Needs 🪙${E.TOAST_COST}` : '')}
        ${basic('scandal', '📜', 'Start a scandal', `Pay 🪙${E.SCANDAL_COST}: a noble loses a mask. Nobody can stop it.`, p.ducats < E.SCANDAL_COST ? `Needs 🪙${E.SCANDAL_COST}` : '')}
      </div>`;
  }
  function challengeHtml(P, v) {
    const m = M(P.k);
    const me = pl(v);
    const cost = me.favor > 0 ? '⭐1 Favor' : 'a mask';
    return `<div class="ask" style="--mc:${m.color}">
      ${maskImg(P.k, 'big')}
      <div><h3>${nobleName(P.claimer)} claims ${esc(m.name)}</h3>
      <p>${esc(E.powerLine(st(), P.claimer, P.act))}</p>
      <p class="muted">Call <b>“Unmask!”</b> if you think it’s a bluff. A liar loses a mask and the power fails. If they’re honest, their mask is proven for good and you pay ${cost}.</p>
      <p>${countHtml(P.k)}</p>
      <div class="btn-row"><button class="btn danger" data-ans="challenge">🎭 Unmask!</button><button class="btn ghost" data-ans="pass">Let it pass</button></div></div>
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
      <p>Unless someone cuts in, they win ⭐1 Favor (they have ⭐${d.favor} of ${E.FAVOR_WIN}). Pay the band 🪙${E.CUT_IN_COST} and claim the Duchess to take the Doge’s hand — ${worn ? '<b class="good">you wear her.</b>' : '<b class="bad">you don’t wear her, so it would be a bluff</b> (if they call “Unmask!”, you lose a mask and they waltz anyway).'}</p>
      <div class="btn-row"><button class="btn" data-ans="block" data-k="duchess">💃 Cut in (🪙${E.CUT_IN_COST})</button><button class="btn ghost" data-ans="pass">Let them dance</button></div></div>
    </div>`;
    }
    const what = { jester: 'lose ⭐1 Favor to their rumour', poisoner: 'lose a mask to the poison', gondolier: 'have a mask swapped' }[P.act.k];
    return `<div class="ask" style="--mc:${M(P.act.k).color}">
      ${maskImg(P.act.k, 'big')}
      <div><h3>${nobleName(P.actor)} uses ${esc(M(P.act.k).power)} on you</h3>
      <p>Unless you stop it, you’ll ${what}. ${esc(M(bk).name)} can block it — ${worn ? '<b class="good">and you wear it.</b>' : '<b class="bad">you don’t wear it, so blocking would be a bluff</b> (if they call “Unmask!”, you lose a mask and it happens anyway).'}</p>
      <div class="btn-row"><button class="btn" data-ans="block" data-k="${bk}">${M(bk).icon} Block as ${esc(M(bk).name)}</button><button class="btn ghost" data-ans="pass">Let it happen</button></div></div>
    </div>`;
  }
  function blockChallengeHtml(P, v) {
    const me = pl(v);
    return `<div class="ask" style="--mc:${M(P.k).color}">
      ${maskImg(P.k, 'big')}
      <div><h3>${nobleName(P.claimer)} ${P.act.k === 'duchess' ? 'cuts in as' : 'blocks with'} ${esc(M(P.k).name)}</h3>
      <p>Believe them and your ${esc(M(P.act.k).power)} is stopped. Call “Unmask!”: if they’re bluffing they lose a mask and your power goes ahead; if they’re honest, you pay ${me.favor > 0 ? '⭐1 Favor' : 'a mask'}.</p>
      <p>${countHtml(P.k)}</p>
      <div class="btn-row"><button class="btn danger" data-ans="challenge">🎭 Unmask!</button><button class="btn ghost" data-ans="pass">Accept the block</button></div></div>
    </div>`;
  }
  function loseHtml(v) {
    const p = pl(v);
    const P = st().pending;
    const note = P.onlyProven
      ? 'Your proven masks are famous, so poison and scandal strike them first. Choose which proven mask goes.'
      : 'It’s turned face up and out of play. A face-down mask you keep can still be bluffed around; a proven one can’t be challenged.';
    return `<h3>💔 You must lose a mask <small>${esc(WHY[P.why] || '')}</small></h3>
      <p class="muted">${note}</p>
      <div class="lose-pick">${E.losable(st(), v).map((m) => `<button class="lose-opt" data-lose="${m.id}" style="--mc:${M(m.k).color}">${maskImg(m.k)}<b>${esc(M(m.k).name)}</b><small>${m.up === 'proven' ? '🔒 proven' : '🙈 hidden'}</small></button>`).join('')}</div>`;
  }

  function myMasksHtml(v) {
    const p = pl(v);
    if (!privateOk()) return `<h3>🎭 Behind the mask</h3><div class="curtain small"><b>Masks hidden</b><span>${esc(p.name)}, tap to look — make sure nobody else can see.</span><button class="btn sm" data-act="show">👀 Show ${esc(p.name)}’s masks</button></div>`;
    const card = (m) => {
      const mk = M(m.k);
      const st_ = m.up === 'lost' ? '<span class="mc-state lost">✗ Lost</span>' : m.up === 'proven' ? '<span class="mc-state proven">🔒 Proven — face up</span>' : '<span class="mc-state">🙈 Hidden</span>';
      return `<div class="mcard ${m.up}" style="--mc:${mk.color}">${maskImg(m.k)}<div class="mc-body"><b>${mk.icon} ${esc(mk.name)}</b><span>${esc(mk.power)}: ${esc(mk.text)}</span>${mk.blocks ? `<small>🛡️ ${esc(blocksLine(m.k))}</small>` : ''}${st_}</div></div>`;
    };
    const seen = (p.seen || []).map((x) => {
      const holder = st().players.findIndex((q, i) => i !== v && q.masks.some((m) => m.id === x.id && m.up === 'hidden'));
      return holder >= 0 ? `<li>${M(x.k).icon} ${nobleName(holder)} wears <b>${esc(M(x.k).name)}</b></li>` : '';
    }).filter(Boolean);
    return `<h3>🎭 ${you(v) || G.mode === 'local' ? 'Your masks' : `${esc(p.name)}’s masks`} <small>only you can see the hidden ones</small></h3>
      <div class="mcards">${p.masks.map(card).join('')}</div>
      ${seen.length ? `<h3>👁️ What you know</h3><ul class="known">${seen.join('')}</ul>` : ''}`;
  }

  function logHtml() {
    return st().log.slice(-80).map((l) => `<p${l.who == null ? ' class="sys"' : ''} style="--pc:${l.who != null ? PCOLOR[l.who] : 'transparent'}"><small>${l.r}</small> ${esc(l.text)}</p>`).join('');
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
    const b = e.target.closest('[data-basic]');
    if (b && !b.disabled) {
      if (b.dataset.basic === 'scandal') {
        ui.pick = { need: 'target', scandal: true };
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
      return doAction({ t: ans.dataset.ans });
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
  function startClaim(k) {
    const m = M(k);
    if (!m.target) return claim({ t: 'claim', k });
    ui.pick = { need: 'target', k };
    render();
  }
  function pickTarget(t) {
    const pk = ui.pick;
    ui.pick = null;
    if (pk.scandal) return doAction({ t: 'scandal', target: t });
    if (pk.k === 'gondolier') return chooseGive(t);
    claim({ t: 'claim', k: pk.k, target: t });
  }
  // The Gondolier: which of your masks goes to the other noble.
  function chooseGive(t) {
    const p = pl(viewer());
    const back = openModal(`<h2>🛶 Which mask do you give ${esc(pl(t).name)}?</h2>
      <p>You’ll get one of their hidden masks at random — and you’ll both see what you got.</p>
      <div class="lose-pick">${E.live(p).map((m) => `<button class="lose-opt" data-give="${m.id}" style="--mc:${M(m.k).color}">${maskImg(m.k)}<b>${esc(M(m.k).name)}</b><small>${m.up === 'proven' ? '🔒 proven' : '🙈 hidden'}</small></button>`).join('')}</div>`, { onClose: () => render() });
    back.addEventListener('click', (e) => {
      const b = e.target.closest('[data-give]');
      if (!b) return;
      closeModal(true);
      claim({ t: 'claim', k: 'gondolier', target: t, give: Number(b.dataset.give) });
    });
  }
  // Claiming a mask you don't wear is a bluff: say so before it's done.
  function claim(a) {
    const worn = E.live(pl(viewer())).some((x) => x.k === a.k);
    if (worn) return doAction(a);
    confirmBluff(a.k, () => doAction(a), 'claim');
  }
  function confirmBluff(k, go, what) {
    const m = M(k);
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
  function doAction(a) {
    if (G.mode === 'online') return Online.send(a);
    const s = st();
    const pi = s.turn;
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
    if (!lines.length) return;
    const s = st();
    const v = viewer();
    const ch = s.last && s.last.challenge;
    lines.forEach((l) => {
      if (/calls “Unmask!”/.test(l.text)) return;
      if (l.who === v && (G.mode === 'ai' || G.mode === 'online') && !/loses a mask|leaves the ball|pays for the insult|really is|bluffing/.test(l.text)) return;
      toast(`${l.who != null ? `<span class="dot" style="--pc:${PCOLOR[l.who]}"></span>` : ''}${esc(l.text)}`, /loses a mask|bluffing|leaves/.test(l.text) ? 'bad' : '');
    });
    if (ch && lines.some((l) => /calls “Unmask!”/.test(l.text))) {
      const involved = ch.by === v || ch.of === v || G.mode === 'local';
      if (involved) unmaskReveal(ch);
      sfx(ch.truth ? (ch.of === v ? 'good' : 'bad') : ch.of === v ? 'bad' : 'good', 300);
    }
    if (lines.some((l) => l.who != null && /takes 🪙|pocketed|won ⭐|wins ⭐|gains/.test(l.text))) sfx('coin', 150);
    void prev;
  }
  function unmaskReveal(ch) {
    const k = ch.k;
    const by = pl(ch.by).name;
    const of = pl(ch.of).name;
    const lost = (st().last.lost || []).map((x) => `<span class="lost-mask">${maskImg(x.k)}<small>${esc(pl(x.who).name)} lost ${esc(M(x.k).name)}</small></span>`).join('');
    openModal(`<div class="unmask ${ch.truth ? 'truth' : 'lie'}">
      <div class="um-title">🎭 “Unmask!”</div>
      <p><b>${esc(by)}</b> challenged <b>${esc(of)}</b>’s claim to be <b>${esc(M(k).name)}</b>.</p>
      <div class="um-card ${ch.truth ? 'flip' : 'shake'}">${ch.truth ? maskImg(k, 'big') : `<img class="mk-img big" src="${IMG('back')}" alt="">`}<span class="um-verdict">${ch.truth ? '✓ Honest!' : '✗ A bluff!'}</span></div>
      <p>${ch.truth ? `${esc(of)} really is ${esc(M(k).name)} — the mask is now <b>proven</b>, face up for the rest of the ball. ${esc(by)} pays for the insult.` : `${esc(of)} was bluffing and loses a mask.`}</p>
      ${lost ? `<div class="um-lost">${lost}</div>` : ''}
      <div class="btn-row" style="justify-content:center"><button class="btn" data-close>Back to the ball</button></div></div>`, { cls: 'locked' });
    if (G.mode === 'ai' && ch.by !== viewer() && ch.of !== viewer()) setTimeout(() => ui.modal && $('.unmask') && closeModal(), 2600);
  }

  // ---------------------------------------------------------------- the computer nobles
  function scheduleAI() {
    stopAI();
    if (!G || G.mode === 'online' || G.mode === 'past' || ui.modal) return;
    const s = st();
    if (s.phase !== 'act' || s.turn == null || !pl(s.turn).ai) return;
    const P = s.pending;
    ui.aiTimer = setTimeout(aiStep, P && P.stage === 'challenge' ? 650 : P ? 800 : 1000);
  }
  function stopAI() {
    clearTimeout(ui.aiTimer);
    ui.aiTimer = null;
  }
  function aiStep() {
    if (!G || ui.modal) return;
    const s = st();
    if (s.phase !== 'act' || !pl(s.turn).ai) return;
    doAction(E.aiChoose(s, s.turn, pl(s.turn).level || G.level));
  }

  function leaveGame() {
    if (G.mode === 'past') return showHistory();
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
    const why = s.ended === 'favor' ? `⭐ ${esc(pl(w).name)} won ${E.FAVOR_WIN} Favor with the Doge` : s.ended === 'last' ? `🎭 ${esc(pl(w).name)} was the last noble still masked` : `🕛 Midnight struck after ${E.CHIMES} chimes — the most Favor wins`;
    const head = w < 0 ? '🤝 The Doge can’t choose — it’s a tie!' : you(w) ? '🏆 You are the star of the ball!' : `🏆 ${esc(pl(w).name)} is the star of the ball!`;
    const row = (i, k) => {
      const p = pl(i);
      return `<div class="fin-row${i === w ? ' win' : ''}" style="--pc:${PCOLOR[i]};--d:${instant ? 0 : 0.5 + k * 0.35}s">
        <span class="fin-place">${i === w ? '👑' : ['1st', '2nd', '3rd', '4th', '5th'][k]}</span>
        <b class="fin-name">${SIGN[i]} ${esc(p.name)}${you(i) ? ' <em>you</em>' : ''}</b>
        <span class="fin-favor">⭐ ${p.favor}</span>
        <span class="fin-masks">${p.masks.map((m) => `<span class="tile ${m.up === 'lost' ? 'lost' : 'face'}" title="${esc(M(m.k).name)}">${maskImg(m.k)}${m.up === 'lost' ? '<i>✗</i>' : ''}</span>`).join('')}</span>
        <small class="fin-note">${p.out ? 'left the ball' : `${plural(E.live(p).length, 'mask')} · 🪙${p.ducats}`}</small>
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
        ${G.mode === 'past' ? '' : `<button class="btn ghost" data-fin="again">${G.mode === 'online' ? '🌐 Your games' : '🎭 Play again'}</button>`}
        <button class="btn ghost" data-fin="hist">🏆 Game history</button>
      </div></div>`, { cls: 'wide', onClose: () => render() }).addEventListener('click', (e) => {
      const b = e.target.closest('[data-fin]');
      if (!b) return;
      closeModal(true);
      if (b.dataset.fin === 'hist') return showHistory();
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
    return { id: g.gid, kind: g.mode, level: g.level, names: s.players.map((p) => p.name), cats: s.players.map((p) => E.score(s, p)), winner: E.winner(s), board: s };
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
      <div class="gh-top"><a class="gh-lobby" href="/board-games.html">← <img class="gh-dice" src="/img/board-games-favicon-48.png?v=2" alt="" width="20" height="20"> Game lobby</a><button class="btn ghost sm" id="hist-new">🎭 New game</button></div>
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
      empty: 'No finished balls yet. Games are added the moment midnight strikes — or someone wins.',
    }, hist);
  }

  // ---------------------------------------------------------------- rules
  const RULE_TABS = [['overview', 'The ball'], ['turn', 'Your turn'], ['masks', 'The masks'], ['unmask', '“Unmask!”'], ['blocks', 'Blocks'], ['winning', 'Winning']];
  function rulesBody(tab) {
    const maskRow = (k) => `<tr><td>${maskImg(k, 'tiny')} <b>${esc(M(k).name)}</b></td><td><b>${esc(M(k).power)}</b>: ${esc(M(k).text)}</td><td>${M(k).blocks ? esc(blocksLine(k)) : '—'}</td></tr>`;
    if (tab === 'overview') return `<p>Venice, carnival night. Every noble at the Doge’s ball wears <b>two masks, face down</b>. Each mask has a power — but on your turn you may claim <b>any</b> mask’s power, whether you’re wearing it or not.</p>
      <p>Everyone else can call <b>“Unmask!”</b> on a claim they don’t believe. Liars lose a mask. Honest nobles have their mask turned face up — <b>proven</b> for the rest of the ball — and the accuser pays for the insult.</p>
      <p>Win by earning <b>⭐${E.FAVOR_WIN} Favor</b> with the Doge, by being the <b>last noble still masked</b>, or by having the most Favor when <b>midnight</b> strikes after ${E.CHIMES} rounds.</p>
      <ul><li>🎭 ${E.MASK_ORDER.length} kinds of mask, ${E.COPIES} of each. The rest wait in the wardrobe.</li><li>🪙 Each noble starts with ${E.START_DUCATS} ducats and no Favor.</li><li>📰 The Gazette records every claim — and each noble’s row shows which masks they’ve claimed, so you can catch a liar who claims too many.</li></ul>`;
    if (tab === 'turn') return `<p>On your turn, do <b>one</b> thing:</p>
      <ul><li>🪙 <b>Mingle</b> — take 🪙1.</li><li>🥂 <b>Toast the Doge</b> — pay 🪙${E.TOAST_COST} to win ⭐1 Favor.</li><li>📜 <b>Start a scandal</b> — pay 🪙${E.SCANDAL_COST}: a noble loses a mask.</li><li>🎭 <b>Claim a mask’s power</b> — any of the seven. Others may call “Unmask!”.</li></ul>
      <p>The plain actions can’t be challenged or blocked. A claimed power can be challenged by anyone, and some can be blocked — by the noble they’re aimed at, or, for a Waltz, by any rival who cuts in.</p>`;
    if (tab === 'masks') return `<table class="rules-table"><tr><th>Mask</th><th>Power</th><th>Block</th></tr>${E.MASK_ORDER.map(maskRow).join('')}</table>
      <p class="muted">The Gondolier makes bluffing slippery: after a swap, the mask you were counting on might be in someone else’s hands — and they know exactly what they got.</p>`;
    if (tab === 'unmask') return `<p>When someone claims a power — or a block — any other noble may call <b>“Unmask!”</b>. The claimer must show a mask of that kind:</p>
      <ul><li><b>Bluffing?</b> They lose a mask of their choice (it’s turned face up and out of play) and the power fails. A bluffed block fails, and the power goes ahead.</li>
      <li><b>Honest?</b> Their mask is turned face up and stays that way — <b>proven</b>. Nobody can challenge that power from them again, but now everyone knows. The accuser pays <b>⭐1 Favor</b>, or a mask if they have no Favor.</li></ul>
      <p><b>Fame has a price:</b> a proven mask can’t be challenged, but poison and scandal strike proven masks first.</p>
      <p class="muted">Losing both masks means leaving the ball. The Plague Doctor’s Remedy brings a lost mask back.</p>`;
    if (tab === 'blocks') return `<p>Three powers can be blocked by the noble they target:</p>
      <ul><li>🃏 The Jester’s Rumour — blocked by 💃 the Duchess.</li><li>🧪 The Poisoner’s Poison — blocked by ⚕️ the Plague Doctor.</li><li>🛶 The Gondolier’s Secret passage — blocked by 🕵️ the Spy.</li></ul>
      <p><b>Cutting in:</b> when someone claims the Duchess’s Waltz, any rival may pay the band 🪙${E.CUT_IN_COST} and claim the Duchess to take the Doge’s hand instead — the waltz wins no Favor.</p>
      <p>A block is a claim too: only the noble who was blocked may call “Unmask!” on it. A proven blocking mask can’t be challenged.</p>`;
    return `<ul><li>⭐ Reach <b>${E.FAVOR_WIN} Favor</b> and you win at once.</li><li>🎭 Be the <b>last noble still masked</b> and you win.</li><li>🕛 After <b>${E.CHIMES} rounds</b> midnight strikes: the most Favor wins. Ties go to the noble still at the ball with more masks, then more ducats.</li></ul>
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
  window.__mq = { get G() { return G; }, render, E, send: (a) => doAction(a) };
})();
