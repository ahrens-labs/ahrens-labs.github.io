// Hero League — page UI. Rules live in heroes-engine.js. Admin-only while it's being playtested.
(function () {
  'use strict';
  const E = window.HeroesEngine;
  const SAVE_KEY = 'ahrensHeroes.v1';
  const PREFS_KEY = 'ahrensHeroes.prefs';
  const ADMIN_EMAIL = 'calebahrens2011@gmail.com';
  const API_BASE = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
  const LEVEL_NAME = { easy: 'Easy', normal: 'Normal', hard: 'Hard', brutal: 'Brutal' };
  const LEVEL_HINT = {
    easy: 'Grabs whatever looks strong and doesn’t think about the deck.',
    normal: 'Weighs every Plaza card against what the deck might bring.',
    hard: 'Plays carefully, holds back cards you want, and is dealt 1 extra card at the start (it keeps its best 7).',
    brutal: 'Its best play, keeps good cards away from you, and is dealt 2 extra cards at the start.',
  };
  const SIM_SPEEDS = {
    turbo: { name: '⚡ Turbo', ai: 0 },
    fast: { name: '⏩ Fast', ai: 220 },
    watch: { name: '👀 Watch', ai: 900 },
  };
  const IMG = (k) => `/img/heroes/${k}.webp`;
  const PCOLOR = ['#e8432f', '#2f7fe0', '#2fae5a', '#9b4fd8', '#e8a317'];
  const SIGN = ['🦸', '🛡️', '🦅', '🌀', '⭐'];
  const LEAGUE_NAMES = ['Crimson League', 'Azure Guard', 'Emerald Watch', 'Violet Vanguard', 'Golden Legion'];
  const NEG = new Set(['pen', 'penWith', 'penNot', 'blank', 'need']);
  const SPECIAL = new Set(['clear', 'oracle', 'wild']);
  const ORD = ['1st', '2nd', '3rd', '4th', '5th'];

  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

  let G = null; // { state, mode: 'ai' | 'local' | 'sim' | 'past', level, levels, speed, view, follow, shown, gid, moved, recorded, revealed }
  const ui = { aiTimer: null, modal: false, onClose: null, rulesTab: 'overview' };

  // ---------------------------------------------------------------- persistence
  function save() {
    if (!G || G.mode === 'sim' || G.mode === 'past') return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(G));
    } catch (e) {
      /* storage full or blocked: the game still works, it just won't resume */
    }
    keepInSaves();
  }
  // Local games also go to the shared save list (Your games in the lobby, and the account), so several can be kept and resumed anywhere.
  function keepInSaves() {
    const BS = window.BoardSaves;
    if (!BS || !G || (G.mode !== 'ai' && G.mode !== 'local') || !isAdmin()) return;
    G.gid = G.gid || newLocalId();
    const s = G.state;
    if (s.phase === 'over') {
      if (BS.list('heroes').some((m) => m.id === G.gid)) BS.remove('heroes', G.gid);
      return;
    }
    if (!G.moved) return;
    BS.put('heroes', G.gid, G, { mode: G.mode, level: G.level, names: s.players.map((p) => p.name), round: s.plaza.length, rounds: E.PLAZA_END, moved: true });
  }
  addEventListener('boardsaves:removed', (e) => {
    if (G && G.gid && e.detail.some((m) => m.game === 'heroes' && m.id === G.gid)) toast('This game was removed from Your games on another device, so it won’t be saved any more.', 'bad');
  });
  const validSave = (g) => g && g.state && g.state.v === E.SAVE_V && (g.mode === 'ai' || g.mode === 'local');
  const lastStatus = (gid) => (gid && window.BoardSaves ? window.BoardSaves.status('heroes', gid) : 'here');
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
  function isAdmin() {
    try {
      return (localStorage.getItem('ahrenslabs_email') || '').trim().toLowerCase() === ADMIN_EMAIL;
    } catch (e) {
      return false;
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

  // ---------------------------------------------------------------- small helpers
  const st = () => G.state;
  const pl = (i) => st().players[i];
  const playing = () => st().phase === 'draw' || st().phase === 'discard';
  const humanTurn = () => playing() && !pl(st().turn).ai && G.mode !== 'past' && G.mode !== 'sim';
  // On a shared device the hand stays face down until its owner taps to see it.
  const canAct = () => humanTurn() && (G.mode !== 'local' || G.shown === st().turn);
  const you = (i) => G.mode === 'ai' && i === 0;
  // Hands are secret while the game is on — and after it ends, until the results have been revealed: your own in a computer
  // game, and only the player whose turn it is on a shared device.
  function secret(i) {
    const s = st();
    if ((s.phase === 'over' && G.revealed) || G.mode === 'sim' || G.mode === 'past') return false;
    if (G.mode === 'ai') return i !== 0;
    return !(i === s.turn && G.shown === s.turn);
  }
  // Scoring is left to the players while the game is on: running totals, per-card values and "what if" numbers only
  // appear once the result has been revealed, and when watching (simulations, finished games).
  const showScores = () => G.mode === 'sim' || G.mode === 'past' || (st().phase === 'over' && !!G.revealed);
  const leagueName = (i) => `<b class="who" style="--pc:${PCOLOR[i]}">${esc(pl(i).name)}</b>`;
  const C = (id) => E.CARD[id];
  const cname = (id) => esc(C(id).name);
  const suitTag = (s, extra) => `<span class="suit-tag" style="--sc:${E.SUIT[s].color}">${E.SUIT[s].icon} ${esc(E.SUIT[s].name)}${extra || ''}</span>`;
  const mission = () => E.MISSIONS[st().mission];
  function toast(html, kind, ms) {
    const root = $('#toasts');
    if (!root) return;
    const t = document.createElement('div');
    t.className = `toast ${kind || ''}`;
    t.innerHTML = html;
    root.appendChild(t);
    while (root.children.length > 4) root.firstChild.remove();
    setTimeout(() => t.classList.add('out'), ms || 3400);
    setTimeout(() => t.remove(), (ms || 3400) + 400);
  }
  function sfx(k, delay) {
    if (!window.GameMusic || !G || G.mode === 'sim') return;
    if (delay) setTimeout(() => GameMusic.sfx(k), delay);
    else GameMusic.sfx(k);
  }
  // Display order for a hand: by suit, strongest first. The saved hand order never changes.
  const SUIT_RANK = {};
  E.SUITS.forEach((s, i) => (SUIT_RANK[s] = i));
  const sorted = (ids) => ids.slice().sort((a, b) => SUIT_RANK[C(a).suit] - SUIT_RANK[C(b).suit] || C(b).power - C(a).power);

  // ---------------------------------------------------------------- cards
  const fxCls = (f) => (NEG.has(f.t) ? 'neg' : SPECIAL.has(f.t) ? 'spec' : 'pos');
  const fxHtml = (id) => C(id).fx.map((f) => `<span class="fx ${fxCls(f)}">${esc(E.fxText(f, C(id)))}</span>`).join('');
  // A hero card. row = this card's line from scoreHand (value, blanked, cleared) when it's scored in a hand.
  function cardHtml(id, o) {
    o = o || {};
    const c = C(id);
    const row = o.row;
    const suit = row && row.suit ? row.suit : c.suit;
    const S = E.SUIT[suit];
    const cls = ['hc', `s-${c.suit}`];
    if (o.small) cls.push('sm');
    if (o.big) cls.push('big');
    if (row && row.blanked) cls.push('blanked');
    if (o.cls) cls.push(o.cls);
    const asWild = row && row.suit && row.suit !== c.suit ? `<span class="hc-wild" title="Mimic is counting as a ${esc(S.name)}">as ${S.icon}</span>` : '';
    const val = row ? `<span class="hc-val${row.blanked ? ' zero' : row.value < c.power ? ' down' : row.value > c.power ? ' up' : ''}" title="What this card scores in this hand">${row.blanked ? 0 : row.value}</span>` : '';
    const stamp = row && row.blanked ? `<span class="hc-stamp" title="${row.blanked === id ? 'Its condition isn’t met' : `Blanked by ${cname(row.blanked)}`}">Blanked</span>` : '';
    const clr = row && row.cleared && !row.blanked && E.isPenalty(id) ? `<span class="hc-clear" title="Penalty cleared by ${cname(row.cleared)}">🛡️</span>` : '';
    const delay = `--d:${((c.i * 0.37) % 3).toFixed(2)}s`;
    return `<div class="${cls.join(' ')}" style="--sc:${E.SUIT[c.suit].color};${delay}"${o.attrs ? ' ' + o.attrs : ''}>
      <div class="hc-art"><img src="${IMG(id)}" alt="" loading="lazy" draggable="false"></div>
      <span class="hc-pow" title="Power">${c.power}</span>
      <span class="hc-suit" title="${esc(E.SUIT[c.suit].name)}">${E.SUIT[c.suit].icon}</span>${asWild}${clr}
      <div class="hc-body"><b class="hc-name">${cname(id)}</b><small class="hc-sn">${esc(E.SUIT[c.suit].name)}</small><p class="hc-fx">${fxHtml(id)}</p></div>
      ${val}${stamp}${o.extra || ''}
    </div>`;
  }
  const backHtml = (cls) => `<div class="hc back${cls ? ' ' + cls : ''}"><span class="hb-logo">🦸</span></div>`;
  const face = (id, cls) => `<img class="face${cls ? ' ' + cls : ''}" src="${IMG(id)}" alt="${cname(id)}" title="${cname(id)}" width="28" height="28" loading="lazy">`;

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
  function closeModal(silent) {
    const root = $('#modal-root');
    if (!root || !root.firstChild) return;
    root.innerHTML = '';
    ui.modal = false;
    const cb = ui.onClose;
    ui.onClose = null;
    if (silent) return;
    if (cb) cb();
    else scheduleAI();
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.modal) closeModal();
  });

  // ---------------------------------------------------------------- home
  function heroHtml(withTagline) {
    const sparks = Array.from({ length: 14 }, (_, i) => `<i style="left:${4 + ((i * 41) % 92)}%;top:${6 + ((i * 29) % 50)}%;animation-delay:${(i * 0.45).toFixed(2)}s"></i>`).join('');
    return `<div class="gh-top"><a class="gh-lobby" href="/board-games.html" title="Back to the game lobby">← <img class="gh-dice" src="/img/board-games-favicon-48.png?v=2" alt="" width="20" height="20"> Game lobby</a>${window.GameMusic ? GameMusic.buttonHtml('btn ghost sm gh-music', 'bt') : ''}</div>
      <div class="gh-hero">
        <img src="${IMG('cover')}" alt="Six superheroes on a rooftop at dusk while an alien mothership hovers over the city" class="gh-hero-img">
        <div class="gh-shade"></div>
        <div class="hero-sparks" aria-hidden="true">${sparks}</div>
        <div class="gh-title"><h1 class="display">Hero League</h1>${withTagline ? '<p>Build the best team of seven heroes. Each turn, draw a card and send one to the Plaza — where anyone can recruit it. Chase combos, dodge villains, and fit your team to the Mission.</p>' : ''}</div>
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
        <p>You need an Ahrens Labs account to play Hero League.</p>
        <a class="btn big" href="/account.html?return=${back}">Log in or sign up</a>
      </div></div>`;
  }

  // Only the admin can see the game while it's playtested.
  function showLocked() {
    stopAI();
    G = null;
    document.body.className = 'setup-mode';
    $('#app').innerHTML = `<div class="setup gh">${heroHtml(false)}
      <div class="setup-card gh-card panel ol-gate">
        <h2>🧪 Still in the lab</h2>
        <p>Hero League is being playtested and isn’t open yet. Check back soon!</p>
        <a class="btn big" href="/board-games.html">Back to the game shelf</a>
      </div></div>`;
  }

  function showSetup() {
    if (!sessionId()) return showGate();
    if (!isAdmin()) return showLocked();
    stopAI();
    G = null;
    if (history.replaceState && location.search) history.replaceState(null, '', location.pathname);
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
        ${canResume ? `<div class="gh-resume"><div><b>Mission in progress</b><span>${esc(saved.state.players.map((p) => p.name).join(' vs '))} · ${esc(E.MISSIONS[saved.state.mission].name)} · Plaza ${saved.state.plaza.length} of ${E.PLAZA_END}</span></div><button class="btn" id="resume">Continue</button></div>` : ''}
        <h2>New game</h2>
        <div class="gh-modes" id="mode">
          <button data-v="ai" class="gh-mode ${pr.mode !== 'local' && pr.mode !== 'online' ? 'on' : ''}"><span>🤖</span><b>Computer</b><small>Rival leagues</small></button>
          <button data-v="local" class="gh-mode ${pr.mode === 'local' ? 'on' : ''}"><span>👥</span><b>Players</b><small>2–5 on this device</small></button>
          <button data-v="online" class="gh-mode ${pr.mode === 'online' ? 'on' : ''}"><span>🌐</span><b>Online</b><small>Challenge friends</small></button>
        </div>
        <div class="online-only online-soon"><b>🌐 Online play opens at launch</b><p>Recruiting against other Ahrens Labs players arrives when Hero League leaves the lab. For now, play the computer or friends on this device.</p></div>
        <div class="field ai-only offline-only">
          <span class="label">Rival leagues</span>
          <div class="seg" id="rivals">${[1, 2, 3, 4].map((n) => `<button data-v="${n}" class="${rivals === n ? 'on' : ''}">${n} ${n === 1 ? 'rival' : 'rivals'}</button>`).join('')}</div>
        </div>
        <div class="field local-only">
          <span class="label">Leagues</span>
          <div class="seg" id="seats">${[2, 3, 4, 5].map((n) => `<button data-v="${n}" class="${seats === n ? 'on' : ''}">${n} players</button>`).join('')}</div>
        </div>
        <div class="field names offline-only" id="names"></div>
        <div class="field ai-only offline-only">
          <span class="label">Difficulty</span>
          <div class="seg" id="level">
            ${Object.keys(LEVEL_NAME).map((l) => `<button data-v="${l}" class="${(pr.level || 'normal') === l ? 'on' : ''}" title="${esc(LEVEL_HINT[l])}">${LEVEL_NAME[l]}</button>`).join('')}
          </div>
          <p class="muted level-hint" id="level-hint"></p>
        </div>
        <div class="field offline-only">
          <span class="label">Who goes first?</span>
          <div class="seg" id="first">
            <button data-v="0" class="on">Me</button>
            <button data-v="1">A rival</button>
            <button data-v="r">🎲 Random</button>
          </div>
        </div>
        <button class="btn big offline-only" id="start">🦸 Assemble the leagues</button>
        <div class="gh-links">
          <button class="btn ghost sm" id="how">📜 How to play</button>
          <button class="btn ghost sm" id="hist">🏆 Game history</button>
          <button class="btn ghost sm" id="sim">🧪 Computer vs computer</button>
        </div>
      </div>
      </div>`;
    const names = () => {
      const m = $('#mode .on').dataset.v;
      const n = m === 'local' ? Number($('#seats .on').dataset.v) : 1;
      const keep = [...document.querySelectorAll('#names input')].map((x) => x.value);
      $('#names').innerHTML = Array.from({ length: n }, (_, i) => `<label style="--pc:${PCOLOR[i]}"><span class="label"><i class="sw"></i>${m === 'local' ? `League ${i + 1}` : 'Your league'}</span><input id="n${i}" maxlength="18" value="${esc(keep[i] || pr['n' + i] || LEAGUE_NAMES[i])}"></label>`).join('');
    };
    const setMode = (m) => {
      $('.setup').classList.toggle('is-local', m === 'local');
      $('.setup').classList.toggle('is-online', m === 'online');
      $('#first').children[0].textContent = m === 'local' ? 'League 1' : 'Me';
      $('#first').children[1].textContent = m === 'local' ? 'League 2' : 'A rival';
      if (m !== 'online') names();
    };
    const hint = () => ($('#level-hint').textContent = LEVEL_HINT[$('#level .on').dataset.v]);
    $('.setup').addEventListener('click', (e) => {
      const b = e.target.closest('.seg button, .gh-modes button');
      if (!b) return;
      [...b.parentNode.children].forEach((x) => x.classList.toggle('on', x === b));
      if (b.parentNode.id === 'mode') {
        savePrefs(Object.assign(prefs(), { mode: b.dataset.v }));
        setMode(b.dataset.v);
      }
      if (b.parentNode.id === 'seats') names();
      if (b.parentNode.id === 'level') hint();
    });
    setMode(pr.mode === 'local' || pr.mode === 'online' ? pr.mode : 'ai');
    hint();
    $('#how').onclick = () => showRules();
    $('#hist').onclick = () => showHistory();
    $('#sim').onclick = openSimSetup;
    if ($('#resume')) $('#resume').onclick = () => startFrom(saved);
    $('#start').onclick = () => {
      const mode = $('#mode .on').dataset.v;
      const level = $('#level .on').dataset.v;
      const n = mode === 'local' ? Number($('#seats .on').dataset.v) : 1 + Number($('#rivals .on').dataset.v);
      const typed = [...document.querySelectorAll('#names input')].map((x, i) => x.value.trim() || LEAGUE_NAMES[i]);
      const names = Array.from({ length: n }, (_, i) => typed[i] || LEAGUE_NAMES[i]);
      let first = $('#first .on').dataset.v;
      first = first === 'r' ? Math.floor(Math.random() * n) : first === '1' && mode === 'ai' ? 1 + Math.floor(Math.random() * (n - 1)) : Number(first);
      const p = Object.assign(prefs(), { mode, level });
      typed.forEach((v, i) => (p['n' + i] = v));
      if (mode === 'local') p.seats = n;
      else p.rivals = n - 1;
      savePrefs(p);
      const ai = names.map((_, i) => mode === 'ai' && i > 0);
      const state = E.newGame({ names, ai, levels: ai.map((x) => (x ? level : null)), first });
      if (mode === 'ai') names.forEach((_, i) => i > 0 && E.aiHeadStart(state, i, level));
      startFrom({ state, mode, level, view: 0, gid: newLocalId() });
      if (mode === 'ai') showMissionIntro();
    };
  }

  // ---------------------------------------------------------------- game screen
  function startFrom(g) {
    if (!sessionId()) return showGate();
    if (!isAdmin()) return showLocked();
    stopAI();
    G = g;
    G.shown = null;
    document.body.className = 'game-mode';
    window.scrollTo(0, 0);
    save();
    // Each saved game has its own address, so reloading reopens this game and the bare page is always home.
    const q = G.gid && (G.mode === 'ai' || G.mode === 'local') ? `?local=${encodeURIComponent(G.gid)}` : '';
    if (history.replaceState && location.search !== q) history.replaceState(null, '', location.pathname + q);
    render();
    if (st().phase === 'over') showGameOver(!!G.revealed);
    else scheduleAI();
  }

  // Whose team the big hand panel shows.
  function handOwner() {
    const s = st();
    if (s.phase !== 'over') {
      if (G.mode === 'ai') return 0;
      if (G.mode === 'local') return s.turn;
      if (G.mode === 'sim' && G.follow !== false) return s.turn;
    }
    return G.view || 0;
  }

  function render() {
    if (!G) return;
    const s = st();
    const M = mission();
    const sub = G.mode === 'past' ? '📜 Finished game' : G.mode === 'sim' ? `🧪 ${SIM_SPEEDS[G.speed].name} · computer vs computer` : G.mode === 'local' ? `👥 ${s.players.length} leagues` : `🤖 vs ${plural(s.players.length - 1, 'rival')} · ${LEVEL_NAME[G.level] || ''}`;
    const home = G.mode === 'past' ? '🏆<span class="bt"> History</span>' : G.mode === 'sim' ? '⏹<span class="bt"> Stop</span>' : '🦸<span class="bt"> New game</span>';
    const pz = s.plaza.length;
    $('#app').innerHTML = `
      <header class="topbar">
        <div class="brand">
          <img src="/img/heroes-favicon-96.png?v=1" alt="" class="brand-logo" width="46" height="46">
          <div><h1>Hero League</h1><small>${esc(sub)}</small></div>
        </div>
        <div class="top-mid">
          <div class="day-meter" title="The game ends the moment the ${E.PLAZA_END}th card is sent to the Plaza"><span class="dm-label">🏙️ Plaza <b>${pz}</b> of ${E.PLAZA_END}</span><span class="dm-bar"><i style="width:${Math.round((pz / E.PLAZA_END) * 100)}%"></i></span></div>
          <div class="top-chips">
            <span class="chip" title="The Mission everyone is building for" data-act="mission">${M.icon} ${esc(M.name)}</span>
            <span class="chip" title="Cards left in the deck">🂠 Deck ${s.deck.length}</span>
            <span class="chip" title="Turns played">🔁 Turn ${s.turns + (s.phase === 'over' ? 0 : 1)}</span>
          </div>
        </div>
        <div class="top-actions">
          ${window.GameMusic ? GameMusic.buttonHtml('btn ghost sm', 'bt') : ''}
          <button class="btn ghost sm" data-act="rules" aria-label="Rules">📜<span class="bt"> Rules</span></button>
          <button class="btn ghost sm" data-act="home" aria-label="${G.mode === 'past' ? 'History' : G.mode === 'sim' ? 'Stop' : 'New game'}" title="${G.mode === 'past' ? 'Back to history' : G.mode === 'sim' ? 'Stop the simulation' : 'Start a new game (this one stays saved under Your games)'}">${home}</button>
          <a class="btn ghost sm" href="/board-games.html" title="Back to the game lobby" aria-label="Game lobby"><img class="gh-dice" src="/img/board-games-favicon-48.png?v=2" alt=""><span class="bt"> Lobby</span></a>
        </div>
      </header>
      <div class="hl">
        <section class="scores n${s.players.length}">${s.players.map((_, i) => leagueCard(i)).join('')}</section>
        ${bannerHtml()}
        <section class="table-sec">
          <div class="table">${missionHtml()}${deckHtml()}${plazaHtml()}</div>
        </section>
        ${handHtml()}
        <section class="panel"><h3>📰 The Daily Hero <small class="muted">what everyone did</small></h3><div class="log" id="log">${logHtml()}</div></section>
      </div>`;
    const lg = $('#log');
    if (lg) lg.scrollTop = lg.scrollHeight;
  }

  function leagueCard(i) {
    const s = st();
    const p = pl(i);
    const turn = playing() && s.turn === i;
    const owner = handOwner();
    const tag = turn ? `<span class="co-tag turn">${p.ai ? 'Thinking…' : G.mode === 'ai' ? 'Your turn' : 'Up now'}</span>` : '';
    const sc = secret(i) || !showScores() ? null : E.score(s, p);
    const known = p.took.length ? `<span class="co-known" title="Cards everyone saw ${esc(p.name)} recruit from the Plaza">👁️ ${p.took.slice(-4).map((c) => face(c)).join('')}</span>` : '';
    return `<div class="co${turn ? ' turn' : ''}${owner === i ? ' viewing' : ''}" style="--pc:${PCOLOR[i]}" data-view="${i}" title="${secret(i) ? `What you know about ${esc(p.name)}` : `Show ${esc(p.name)}’s team`}">
      <span class="co-flag">${SIGN[i]}</span>
      <div class="co-name"><b>${esc(p.name)}</b>${p.ai ? `<span class="co-tag">🤖 ${LEVEL_NAME[p.level] || ''}</span>` : ''}${tag}</div>
      <div class="co-stats"><span title="Cards in hand">🃏 <b>${p.hand.length}</b></span><span title="Heroes recruited from the Plaza">🏙️ <b>${p.stats.plaza}</b></span>${sc ? `<span title="Team score">⭐ <b>${sc.total}</b></span>` : '<span title="Scores are counted at the end">⭐ <b>?</b></span>'}${known}</div>
    </div>`;
  }

  function bannerHtml() {
    const s = st();
    if (G.mode === 'past') {
      const w = E.winner(s);
      return `<div class="banner">📜 ${w < 0 ? 'A tie!' : `${esc(pl(w).name)} won`} · tap a league to see its team · <button class="btn sm" data-act="scorecard">🏆 Scorecard</button></div>`;
    }
    if (s.phase === 'over') return `<div class="banner mine">🏁 ${s.ended === 'deck' ? 'The deck ran out' : `The ${E.PLAZA_END}th hero reached the Plaza`} — hands down! Tap a league to see its team. <button class="btn sm" data-act="scorecard">🏆 See who won</button></div>`;
    const p = pl(s.turn);
    const dot = `<span class="dot"></span>`;
    if (p.ai) return `<div class="banner" style="--pc:${PCOLOR[s.turn]}">${dot}${esc(p.name)} is ${s.phase === 'draw' ? 'choosing a card' : 'deciding who to send to the Plaza'}…</div>`;
    if (G.mode === 'local' && G.shown !== s.turn) return `<div class="banner mine pass" style="--pc:${PCOLOR[s.turn]}">${dot}📱 Pass the device to <b>${esc(p.name)}</b>. <button class="btn sm" data-act="reveal">👀 I’m ${esc(p.name)} — show my hand</button></div>`;
    const who = G.mode === 'local' ? `${esc(p.name)}, your turn` : 'Your turn';
    if (s.phase === 'draw') {
      const warn = s.plaza.length === E.PLAZA_END - 1 ? ` <span class="warn">⚠️ The Plaza is one card from full: drawing from the deck ends the game after you send a card.</span>` : s.deck.length === 1 ? ' <span class="warn">⚠️ Last card in the deck: drawing it ends the game after you send a card.</span>' : '';
      return `<div class="banner mine" style="--pc:${PCOLOR[s.turn]}">${dot}<b>${who}</b> — <b>1. Draw:</b> take the top card of the deck, or recruit any hero from the Plaza.${warn}</div>`;
    }
    const fresh = p.fresh ? ` (not ${cname(p.fresh)} — you just recruited them)` : '';
    return `<div class="banner mine" style="--pc:${PCOLOR[s.turn]}">${dot}<b>${who}</b> — <b>2. Send one card to the Plaza</b>${fresh}. Which one weakens your team least? That’s for you to work out.</div>`;
  }

  // ---------------------------------------------------------------- the table
  function missionCheck(hand) {
    const r = E.scoreHand(hand, st().mission);
    const live = r.cards.filter((x) => !x.blanked);
    const has = (s) => live.filter((x) => x.suit === s).length;
    return { r, has };
  }
  function missionHtml() {
    const s = st();
    const M = mission();
    const owner = handOwner();
    const chk = !secret(owner) && showScores() ? missionCheck(pl(owner).hand) : null;
    const need = M.need.map((x) => `${suitTag(x, chk ? (chk.has(x) ? ' ✓' : ' ✗') : '')}`).join(' + ');
    return `<button class="mission" data-act="mission" title="About this Mission" style="--mc:${E.SUIT[M.need[0]].color}">
      <span class="ms-art"><img src="${IMG('mission-' + s.mission)}" alt="" loading="lazy"><span class="ms-tag">🎯 The Mission</span></span>
      <span class="ms-body">
        <b class="ms-name">${M.icon} ${esc(M.name)}</b>
        <span class="ms-line${chk ? (chk.r.mission.done ? ' ok' : ' no') : ''}">Have ${need} → <b>+${E.MISSION_DONE}</b> <small>(miss: −${E.MISSION_FAIL})</small></span>
        <span class="ms-line"><span class="good">+${E.MISSION_FIT} per ${E.SUIT[M.need[0]].icon} or ${E.SUIT[M.need[1]].icon} card${chk ? ` <small>(${chk.r.mission.fit} now)</small>` : ''}</span></span>
        <span class="ms-line"><span class="good">+${M.plus.n} per ${E.SUIT[M.plus.s].icon} ${esc(E.SUIT[M.plus.s].name)}</span> · <span class="bad">−${M.minus.n} per ${E.SUIT[M.minus.s].icon} ${esc(E.SUIT[M.minus.s].name)}</span></span>
      </span>
    </button>`;
  }
  function deckHtml() {
    const s = st();
    const can = canAct() && s.phase === 'draw' && s.deck.length > 0;
    const ending = s.plaza.length === E.PLAZA_END - 1 || s.deck.length === 1;
    const layers = Math.min(4, Math.ceil(s.deck.length / 8));
    return `<div class="deck-wrap"><button class="deck${can ? ' can' : ''}${ending && playing() ? ' ending' : ''}" data-act="deck" ${can ? '' : 'disabled'} title="${can ? 'Draw the top card' : 'The deck'}">
      <span class="deck-stack">${Array.from({ length: Math.max(1, layers) }, (_, k) => `<i style="--k:${k}"></i>`).join('')}${s.deck.length ? '<span class="hb-logo">🦸</span>' : '<em>Empty</em>'}</span>
      </button><span class="deck-label"><b>${s.deck.length}</b> in the deck${can ? '<small>Tap to draw</small>' : ''}</span></div>`;
  }
  function plazaHtml() {
    const s = st();
    const can = canAct() && s.phase === 'draw';
    const slots = [];
    for (let k = 0; k < E.PLAZA_END; k++) {
      const id = s.plaza[k];
      if (!id) {
        slots.push(`<div class="pz-slot empty${k === E.PLAZA_END - 1 ? ' last' : ''}"><span>${k === E.PLAZA_END - 1 ? '🏁' : k + 1}</span>${k === E.PLAZA_END - 1 ? '<small>Game ends</small>' : ''}</div>`);
        continue;
      }
      const landed = s.last && s.last.gave === id;
      const tag = landed ? `<span class="pz-from" style="--pc:${PCOLOR[s.last.who]}">from ${esc(pl(s.last.who).name)}</span>` : '';
      slots.push(`<button class="pz-slot${can ? ' can' : ''}${landed ? ' landed' : ''}" data-plaza="${id}" style="${landed ? `--pc:${PCOLOR[s.last.who]}` : ''}" title="${can ? `Recruit ${cname(id)}` : cname(id)}">${cardHtml(id, { small: true })}${tag}</button>`);
    }
    return `<div class="plaza-wrap"><div class="plaza-head"><h2>🏙️ The Plaza</h2><small>Sent-away heroes wait here — anyone can recruit them, even the league that sent them. The game ends when space ${E.PLAZA_END} fills.</small></div>
      <div class="plaza">${slots.join('')}</div></div>`;
  }

  // ---------------------------------------------------------------- the hand
  function handHtml() {
    const s = st();
    const owner = handOwner();
    const p = pl(owner);
    const hidden = secret(owner);
    const head = `<div class="hand-head"><span class="sign" style="--pc:${PCOLOR[owner]}">${SIGN[owner]}</span><div><h2>${G.mode === 'ai' && owner === 0 ? 'Your team' : `${esc(p.name)}’s team`}</h2><small>${hidden ? 'Face down' : `${plural(p.hand.length, 'card')}`}</small></div>`;
    if (hidden) {
      return `<section class="panel hand" style="--pc:${PCOLOR[owner]}">${head}</div>
        <div class="hand-cards curtained">${p.hand.map(() => backHtml()).join('')}
          <div class="curtain"><b>📱 ${esc(p.name)}’s hand</b><span>Everyone else, look away!</span><button class="btn" data-act="reveal">👀 Show my hand</button></div>
        </div></section>`;
    }
    const scored = showScores();
    const r = E.scoreHand(p.hand, s.mission);
    const rowOf = {};
    if (scored) r.cards.forEach((x) => (rowOf[x.id] = x));
    const myDiscard = canAct() && s.phase === 'discard' && owner === s.turn;
    const cards = sorted(p.hand).map((id) => {
      const isNew = playing() && s.turn === owner && p.drew === id;
      let extra = '';
      if (myDiscard) {
        if (id === p.fresh) extra = '<span class="send no">Just recruited — keeps</span>';
        else extra = `<button class="send" data-send="${id}" title="Send ${cname(id)} to the Plaza">📤 Send</button>`;
      }
      return `<div class="hand-slot${isNew ? ' new' : ''}">${isNew ? `<span class="new-tag">${p.fresh === id ? '🏙️ Recruited' : '🂠 Drawn'}</span>` : ''}${cardHtml(id, { row: rowOf[id], attrs: `data-card="${id}"`, cls: 'live' })}${extra}</div>`;
    }).join('');
    if (!scored) {
      return `<section class="panel hand" style="--pc:${PCOLOR[owner]}">${head}
        <div class="hand-score" title="Scores are counted when the game ends"><small>Team score</small><b>?</b></div></div>
      <div class="hand-cards">${cards}</div>
      <p class="hand-tip">🧮 No running totals: add up your own team — power, bonuses, penalties and the Mission. Every league’s score is revealed at the end. Tap a card to read it.</p>
    </section>`;
    }
    const sc = E.score(s, p);
    const m = r.mission;
    const M = mission();
    const mParts = [];
    mParts.push(m.done ? `<span class="good">✓ ${E.SUIT[M.need[0]].icon}+${E.SUIT[M.need[1]].icon} done +${m.doneN}</span>` : `<span class="bad">✗ needs ${M.need.filter((x) => !r.cards.some((c) => !c.blanked && c.suit === x)).map((x) => `${E.SUIT[x].icon} ${E.SUIT[x].name}`).join(' and ')} −${m.failN}</span>`);
    if (m.fitN) mParts.push(`<span class="good">+${m.fitN} for ${plural(m.fit, 'Mission card')}</span>`);
    if (m.plusN) mParts.push(`<span class="good">+${m.plusN} ${E.SUIT[M.plus.s].plural}</span>`);
    if (m.minusN) mParts.push(`<span class="bad">−${m.minusN} ${E.SUIT[M.minus.s].plural}</span>`);
    if (m.mult > 1) mParts.push('<span class="spec">Seer Sela doubled the +' + E.MISSION_DONE + '</span>');
    return `<section class="panel hand" style="--pc:${PCOLOR[owner]}">${head}
        <div class="hand-score" title="${s.phase === 'over' ? 'Final team score' : 'Team score if the game ended now'}"><small>Team score</small><b>${sc.total}</b></div></div>
      <div class="hand-cards">${cards}</div>
      <div class="hand-sum">
        <span title="Printed power of the cards that aren’t blanked">🃏 Power <b>${sc.base}</b></span>
        <span class="good" title="Bonuses from card effects">✨ Bonuses <b>+${sc.bonus}</b></span>
        <span class="bad" title="Penalties from card effects">💥 Penalties <b>${sc.penalty ? '−' + sc.penalty : '0'}</b></span>
        <span title="Mission">${M.icon} Mission <b>${signed(sc.mission)}</b> <small>${mParts.join(' · ')}</small></span>
        ${sc.blanked ? `<span class="bad" title="Blanked cards score nothing">🚫 ${plural(sc.blanked, 'card')} blanked</span>` : ''}
      </div>
    </section>`;
  }

  function logHtml() {
    const s = st();
    return s.log.slice(-90).map((l) => (l.who == null ? `<p class="sys"><small>${l.n + 1}</small> ${esc(l.text)}</p>` : `<p style="--pc:${PCOLOR[l.who]}"><small>${l.n + 1}</small> ${esc(l.text)}</p>`)).join('');
  }

  // ---------------------------------------------------------------- clicks
  document.addEventListener('click', (e) => {
    if (!G || !$('.hl')) return;
    if (e.target.closest('#modal-root') || e.target.closest('.hl-reveal')) return;
    const vb = e.target.closest('[data-view]');
    if (vb) {
      const i = Number(vb.dataset.view);
      if (secret(i)) return showKnown(i);
      G.view = i;
      if (G.mode === 'sim') G.follow = i === st().turn;
      render();
      return;
    }
    const sb = e.target.closest('[data-send]');
    if (sb) {
      if (canAct() && st().phase === 'discard') doAction({ t: 'discard', c: sb.dataset.send });
      return;
    }
    const pb = e.target.closest('[data-plaza]');
    if (pb) {
      if (canAct() && st().phase === 'draw') openRecruit(pb.dataset.plaza);
      else showCard(pb.dataset.plaza);
      return;
    }
    const cb = e.target.closest('[data-card]');
    if (cb) return showCard(cb.dataset.card, handOwner());
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === 'rules') return showRules();
    if (act === 'home') return leaveGame();
    if (act === 'scorecard') return showGameOver(true);
    if (act === 'mission') return showMission();
    if (act === 'reveal') {
      if (G.mode === 'local' && humanTurn()) {
        G.shown = st().turn;
        sfx('card');
        render();
      }
      return;
    }
    if (!canAct()) return;
    if (act === 'deck') return drawDeck();
  });

  function leaveGame() {
    if (G.mode === 'past') return showHistory();
    if (G.mode === 'sim') return stopSim();
    save();
    // The current game stays saved: it's listed under Your games in the game lobby.
    if (window.BoardSaves) window.BoardSaves.flush();
    showSetup();
  }

  // ---------------------------------------------------------------- actions
  function doAction(a) {
    const s = st();
    const pi = s.turn;
    const actor = pl(pi);
    try {
      E.apply(s, pi, a);
    } catch (err) {
      toast(esc(err.message), 'bad');
      return;
    }
    if (!actor.ai) G.moved = true;
    const quiet = G.mode === 'sim' && G.speed === 'turbo';
    if (a.t === 'draw') {
      if (!quiet) sfx(a.from === 'plaza' ? 'join' : 'card');
      if (!actor.ai && a.from === 'deck' && !quiet) toast(`🂠 You drew <b>${cname(actor.drew)}</b> (${E.SUIT[C(actor.drew).suit].icon} ${C(actor.drew).power}).`);
    } else {
      if (!quiet) sfx('place');
      if (G.mode === 'local' && s.phase !== 'over') {
        G.shown = null;
        if (!quiet) toast(`${leagueName(pi)} sent <b>${cname(a.c)}</b> to the Plaza. Pass the device to ${leagueName(s.turn)}.`);
      } else if (actor.ai && !quiet && (G.mode !== 'sim' || G.speed === 'watch')) {
        const L = s.last;
        toast(`<span class="dot" style="--pc:${PCOLOR[pi]}"></span>${leagueName(pi)} ${L.from === 'plaza' ? `recruited <b>${cname(L.took)}</b> from the Plaza` : 'drew from the deck'} and sent <b>${cname(L.gave)}</b> to the Plaza.`);
      }
    }
    save();
    render();
    if (s.phase === 'over') {
      if (!quiet) sfx('reveal');
      setTimeout(() => G && G.state === s && showGameOver(false), quiet ? 0 : 700);
      return;
    }
    scheduleAI();
  }

  function drawDeck() {
    const s = st();
    if (s.phase !== 'draw' || !s.deck.length) return;
    if (s.plaza.length === E.PLAZA_END - 1 || s.deck.length === 1) {
      const back = openModal(`<h2>🏁 End the game?</h2>
        <p>${s.deck.length === 1 ? 'This is the last card in the deck.' : `The Plaza has ${E.PLAZA_END - 1} cards.`} If you draw from the deck, the game ends as soon as you send a card to the Plaza.</p>
        <p>Happy with your team? Recruiting from the Plaza instead keeps the game going.</p>
        <div class="btn-row"><button class="btn" id="go">🂠 Draw and finish</button><button class="btn ghost" data-close>Not yet</button></div>`, { onClose: () => {} });
      back.querySelector('#go').onclick = () => {
        closeModal(true);
        doAction({ t: 'draw', from: 'deck' });
      };
      return;
    }
    doAction({ t: 'draw', from: 'deck' });
  }

  // ---------------------------------------------------------------- dialogs
  function rowLines(row) {
    const c = C(row.id);
    const lines = [`<li><span>🃏 Power</span><b>${c.power}</b></li>`];
    if (row.blanked) {
      lines.push(`<li class="bad"><span>🚫 ${row.blanked === row.id ? `Blanked: ${esc(E.fxText(c.fx.find((f) => f.t === 'need'), c).replace(/^Blanked unless you have/, 'you don’t have'))}` : `Blanked by ${cname(row.blanked)}`}</span><b>0</b></li>`);
      return lines.join('');
    }
    row.plus.forEach((x) => lines.push(`<li class="good"><span>✨ ${esc(x.text)}</span><b>+${x.n}</b></li>`));
    row.minus.forEach((x) => lines.push(`<li class="${x.n ? 'bad' : 'spec'}"><span>${x.n ? '💥' : '🛡️'} ${esc(x.text)}</span><b>${x.n ? '−' + x.n : '0'}</b></li>`));
    if (row.cleared && E.isPenalty(row.id) && !row.minus.length) lines.push(`<li class="spec"><span>🛡️ Penalty cleared by ${cname(row.cleared)}</span><b></b></li>`);
    if (row.suit !== c.suit) lines.push(`<li class="spec"><span>🎭 Counting as a ${esc(E.SUIT[row.suit].name)}</span><b></b></li>`);
    lines.push(`<li class="tot"><span>Scores</span><b>${row.value}</b></li>`);
    return lines.join('');
  }
  function showCard(id, owner) {
    const s = st();
    let row = null;
    if (showScores() && owner != null && !secret(owner) && pl(owner).hand.includes(id)) row = E.scoreHand(pl(owner).hand, s.mission).cards.find((x) => x.id === id);
    const c = C(id);
    const body = `<div class="card-view">${cardHtml(id, { big: true, row })}
      <div class="cv-text"><h2>${cname(id)}</h2><p class="cv-suit">${suitTag(c.suit)} · power ${c.power}</p>
        <p class="cv-fx">${fxHtml(id) || '<span class="muted">No special ability.</span>'}</p>
        <p class="cv-flavor">“${esc(c.flavor)}”</p>
        ${row ? `<h3>In ${G.mode === 'ai' && owner === 0 ? 'your' : `${esc(pl(owner).name)}’s`} team</h3><ul class="cv-rows">${rowLines(row)}</ul>` : ''}
      </div></div>`;
    openModal(body, { cls: 'wide', onClose: () => scheduleAI() });
  }
  function openRecruit(id) {
    const s = st();
    const p = pl(s.turn);
    const c = C(id);
    const back = openModal(`<div class="card-view">${cardHtml(id, { big: true })}
      <div class="cv-text"><h2>Recruit ${cname(id)}?</h2><p class="cv-suit">${suitTag(c.suit)} · power ${c.power}</p>
        <p class="cv-fx">${fxHtml(id)}</p>
        <p class="cv-flavor">“${esc(c.flavor)}”</p>
        <p class="muted">You’ll then send one of your other ${plural(p.hand.length, 'card')} to the Plaza — you can’t send ${cname(id)} straight back this turn.</p>
        <div class="btn-row"><button class="btn" id="go">🦸 Recruit ${cname(id)}</button><button class="btn ghost" data-close>Keep looking</button></div>
      </div></div>`, { cls: 'wide', onClose: () => {} });
    back.querySelector('#go').onclick = () => {
      closeModal(true);
      doAction({ t: 'draw', from: 'plaza', c: id });
    };
  }
  function showMission() {
    const s = st();
    const M = mission();
    const owner = handOwner();
    const r = secret(owner) || !showScores() ? null : E.scoreHand(pl(owner).hand, s.mission).mission;
    openModal(`<div class="mission-view"><img src="${IMG('mission-' + s.mission)}" alt="">
      <h2>${M.icon} ${esc(M.name)}</h2><p>${esc(M.story)}</p>
      <ul class="cv-rows">
        <li><span>🎯 Have at least one ${suitTag(M.need[0])} and one ${suitTag(M.need[1])}</span><b>+${E.MISSION_DONE}</b></li>
        <li class="bad"><span>❌ Missing either of them</span><b>−${E.MISSION_FAIL}</b></li>
        <li class="good"><span>For each ${suitTag(M.need[0])} or ${suitTag(M.need[1])}</span><b>+${E.MISSION_FIT}</b></li>
        <li class="good"><span>For each ${suitTag(M.plus.s)}</span><b>+${M.plus.n}</b></li>
        <li class="bad"><span>For each ${suitTag(M.minus.s)}</span><b>−${M.minus.n}</b></li>
        ${r ? `<li class="tot"><span>${G.mode === 'ai' && owner === 0 ? 'Your' : `${esc(pl(owner).name)}’s`} team right now</span><b>${signed(r.total)}</b></li>` : ''}
      </ul>
      <p class="muted">Blanked cards don’t count for the Mission. Seer Sela doubles the +${E.MISSION_DONE} for having both suits.</p></div>`, { onClose: () => scheduleAI() });
  }
  // A rival's hand is secret, but everyone saw what they took from the Plaza.
  function showKnown(i) {
    const p = pl(i);
    openModal(`<h2>${SIGN[i]} ${esc(p.name)}</h2>
      <p>${plural(p.hand.length, 'card')} in hand, face down. They’ve recruited ${plural(p.stats.plaza, 'hero')} from the Plaza and drawn ${plural(p.stats.deck, 'card')} from the deck.</p>
      ${p.took.length ? `<h3>👁️ Cards you saw them recruit (still in their hand)</h3><div class="known-row">${p.took.map((c) => cardHtml(c, { small: true })).join('')}</div>` : '<p class="muted">They haven’t kept anything from the Plaza yet.</p>'}`, { cls: 'wide', onClose: () => scheduleAI() });
  }
  function showMissionIntro() {
    if (!G || G.mode !== 'ai') return;
    const s = st();
    const M = mission();
    const first = pl(s.turn);
    openModal(`<div class="mission-view"><img src="${IMG('mission-' + s.mission)}" alt="">
      <h2>${M.icon} Today’s Mission: ${esc(M.name)}</h2><p>${esc(M.story)}</p>
      <ul class="cv-rows">
        <li><span>🎯 Have a ${suitTag(M.need[0])} and a ${suitTag(M.need[1])}</span><b>+${E.MISSION_DONE}</b></li>
        <li class="bad"><span>❌ Missing either of them</span><b>−${E.MISSION_FAIL}</b></li>
        <li class="good"><span>Each ${suitTag(M.need[0])} or ${suitTag(M.need[1])}</span><b>+${E.MISSION_FIT}</b></li>
        <li class="good"><span>Each ${suitTag(M.plus.s)}</span><b>+${M.plus.n}</b></li>
        <li class="bad"><span>Each ${suitTag(M.minus.s)}</span><b>−${M.minus.n}</b></li>
      </ul>
      <p>The Mission is worth a lot — a team that misses it rarely wins.</p>
      <p>${first.ai ? `${esc(first.name)} goes first.` : 'You go first.'} Each turn: <b>draw one</b> card, then <b>send one</b> to the Plaza.</p>
      <div class="btn-row" style="justify-content:center"><button class="btn big" data-close>🦸 Let’s go</button></div></div>`);
  }

  // ---------------------------------------------------------------- computer turns
  function stopAI() {
    clearTimeout(ui.aiTimer);
    ui.aiTimer = null;
  }
  function scheduleAI() {
    stopAI();
    if (!G || ui.modal || !playing() || !pl(st().turn).ai || G.mode === 'past') return;
    const wait = G.mode === 'sim' ? SIM_SPEEDS[G.speed].ai : st().phase === 'draw' ? 800 : 1000;
    ui.aiTimer = setTimeout(aiStep, wait);
  }
  function aiStep() {
    if (!G || ui.modal || !playing()) return;
    const pi = st().turn;
    if (!pl(pi).ai) return;
    const level = G.mode === 'sim' ? G.levels[pi] : pl(pi).level || G.level;
    doAction(E.aiChoose(st(), pi, level));
  }

  // ---------------------------------------------------------------- game over
  const SCORE_ROWS = [
    ['🃏 Card power', 'base'],
    ['✨ Bonuses', 'bonus'],
    ['💥 Penalties', 'penalty'],
    ['🎯 Mission', 'mission'],
    ['🚫 Blanked cards', 'blanked'],
    ['🏙️ Recruited from the Plaza', 'plaza'],
  ];
  function showGameOver(instant) {
    const s = st();
    const n = s.players.length;
    const sc = s.players.map((p) => E.score(s, p));
    const w = E.winner(s);
    const order = E.ranking(s);
    const M = mission();
    if (G.mode === 'ai' || G.mode === 'local') recordGame();
    let head;
    if (w < 0) head = '🤝 A tie for the top league!';
    else if (G.mode === 'ai') head = w === 0 ? '🏆 Your league wins!' : `🦹 ${esc(pl(w).name)} wins!`;
    else head = `🏆 ${esc(pl(w).name)} wins!`;
    const top = sc[order[0]].total;
    const second = n > 1 ? sc[order[1]].total : top;
    const margin = top - second;
    const sub = w < 0 ? 'Same score and the same card power.' : margin === 0 ? 'Level on points — won on card power!' : margin <= 5 ? `By just ${plural(margin, 'point')}!` : `By ${plural(margin, 'point')}.`;
    // Shared places for exact ties (same score and card power).
    const place = (i) => 1 + sc.filter((x) => x.total > sc[i].total || (x.total === sc[i].total && x.base > sc[i].base)).length;
    const team = (i) => sorted(pl(i).hand).map((id) => face(id)).join('');
    const mis = (i) => (sc[i].done ? `${M.icon} ✓` : `${M.icon} ✗`);
    // Places and the margin stay out of the page until the announcement, so nothing gives the result away early.
    const side = (i) => `<div class="hr-side" style="--pc:${PCOLOR[i]}"><span class="hr-crown">👑</span><span class="hr-sign">${SIGN[i]}</span><b class="hr-name">${esc(pl(i).name)}</b><span class="hr-total">?</span><small class="hr-place">${mis(i)}</small><span class="hr-team">${team(i)}</span></div>`;
    const lead = (k, i) => {
      if (!['base', 'bonus', 'mission'].includes(k)) return false;
      const vals = sc.map((x) => x[k]);
      const best = Math.max(...vals);
      return vals[i] === best && vals.filter((x) => x === best).length === 1;
    };
    const cell = (k, v) => (k === 'penalty' && v ? `−${v}` : k === 'mission' || k === 'bonus' ? signed(v) : v);
    document.querySelectorAll('.hl-reveal').forEach((x) => x.remove());
    const el = document.createElement('div');
    el.className = 'hl-reveal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Final results');
    el.innerHTML = `<div class="hr-rays"></div><div class="hr-stage">
        <div class="hr-title">${M.icon} Mission debrief: ${esc(M.name)}</div>
        <div class="hr-shops n${n}">${s.players.map((_, i) => side(i)).join('')}</div>
        <div class="hr-verdict" aria-live="polite"></div>
        <div class="hr-sub"></div>
        <div class="hr-rows" style="--n:${n}"></div>
        <div class="hr-actions"><button class="btn" data-rv="close">🦸 See every team</button>${G.mode === 'past' ? '' : `<button class="btn" data-rv="again">${G.mode === 'sim' ? '🧪 Run again' : '🦸 Play again'}</button>`}${G.mode === 'sim' ? '' : '<button class="btn ghost" data-rv="hist">🏆 Game history</button>'}<a class="btn ghost" href="/board-games.html"><img class="gh-dice" src="/img/board-games-favicon-48.png?v=2" alt=""> All board games</a></div>
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
      sides.forEach((x, i) => x.classList.add(w < 0 ? (sc[i].total === top ? 'tie' : 'lose') : i === w ? 'win' : 'lose'));
      el.querySelector('.hr-verdict').innerHTML = `<div class="hr-head">${head}</div>`;
      el.querySelectorAll('.hr-total').forEach((t, i) => (t.textContent = `⭐${sc[i].total}`));
      el.querySelectorAll('.hr-place').forEach((t, i) => (t.textContent = `${ORD[place(i) - 1]} · ${mis(i)}`));
      el.querySelector('.hr-sub').textContent = sub;
      el.querySelector('.hr-rows').innerHTML = SCORE_ROWS.map(([label, k]) => `<div class="hr-row"><small>${label}</small>${sc.map((x, i) => `<span class="${lead(k, i) ? 'lead' : ''}" style="--pc:${PCOLOR[i]}">${cell(k, x[k])}</span>`).join('')}</div>`).join('');
      const happy = w < 0 || G.mode !== 'ai' || w === 0;
      if (!instant && happy) confetti();
      if (!instant) sfx(happy ? 'win' : 'lose');
    };
    const finish = () => {
      if (decided) return;
      decided = true;
      timers.forEach(clearTimeout);
      announce();
      el.querySelectorAll('.hr-row').forEach((r) => r.classList.add('in'));
      el.classList.add('decided');
      if (G) {
        G.revealed = true;
        if (G.view == null || G.mode === 'sim') G.view = w < 0 ? order[0] : w;
      }
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
        if (G.mode === 'sim') return startSim({ levels: G.levels, speed: G.speed });
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
    // Drumroll, then the winner, then the scorecard row by row.
    at(1300, () => {
      el.classList.add('suspense');
      el.querySelector('.hr-verdict').innerHTML = '<div class="hr-drum">The League counts the points<i>.</i><i>.</i><i>.</i></div>';
    });
    at(3500, announce);
    SCORE_ROWS.forEach((_, i) => at(5200 + i * 450, () => el.querySelectorAll('.hr-row')[i].classList.add('in')));
    at(5200 + SCORE_ROWS.length * 450 + 400, finish);
  }

  function confetti() {
    const box = document.createElement('div');
    box.className = 'confetti';
    const bits = ['🎉', '⭐', '💥', '✨', '🦸', '⚡'];
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

  // ---------------------------------------------------------------- game history
  function newLocalId() {
    const b = new Uint8Array(8);
    crypto.getRandomValues(b);
    return 'hx' + [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  function recordGame() {
    const g = G;
    if (g.recorded || !sessionId()) return;
    const s = g.state;
    g.gid = g.gid || newLocalId();
    g.recorded = true;
    save();
    api('/api/heroes/history/record', {
      id: g.gid,
      kind: g.mode,
      level: g.level,
      names: s.players.map((p) => p.name),
      cats: s.players.map((p) => E.score(s, p)),
      winner: E.winner(s),
      board: s,
    }).then((r) => {
      if (r.ok || r.status === 400 || r.status === 403 || G !== g) return;
      g.recorded = false;
      save();
    });
  }

  async function openPast(id) {
    const r = await api(`/api/heroes/history/board?id=${encodeURIComponent(id)}`);
    const state = r.ok && r.data && r.data.state;
    if (!state || !Array.isArray(state.players) || state.phase !== 'over') return toast(esc((r.data && r.data.error) || 'Couldn’t load that game.'), 'bad');
    if (state.v !== E.SAVE_V) return toast('That game was played on an older version of Hero League, so it can’t be shown.', 'bad');
    const h = (hist.items || []).find((x) => x.id === id);
    startFrom({ state, mode: 'past', level: h && h.level, view: 0, gid: id, revealed: true });
  }

  const hist = { items: null, kind: 'all' };
  const HIST_ROWS = [['⭐ Score', 'total'], ['🃏 Card power', 'base'], ['✨ Bonuses', 'bonus'], ['💥 Penalties', 'penalty'], ['🎯 Mission', 'mission'], ['🏙️ Recruits', 'plaza']];

  async function showHistory() {
    stopAI();
    G = null;
    document.body.className = 'setup-mode';
    $('#app').innerHTML = `
      <div class="setup gh">
      <div class="gh-top"><a class="gh-lobby" href="/board-games.html" title="Back to the game lobby">← <img class="gh-dice" src="/img/board-games-favicon-48.png?v=2" alt="" width="20" height="20"> Game lobby</a><button class="btn ghost sm" id="hist-new">🦸 New game</button></div>
        <div class="setup-card gh-card panel hist">
          <h2>🏆 Game history</h2>
          <div id="hist-body"><p class="muted">Loading your games…</p></div>
        </div>
    </div>`;
    $('#hist-new').onclick = () => showSetup();
    const r = await api('/api/heroes/history');
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
    const items = hist.items.filter((h) => hist.kind === 'all' || h.kind === hist.kind);
    const mine = items.filter((h) => h.me != null && h.cats);
    const count = (f) => mine.filter(f).length;
    const wins = count((h) => h.winner === h.me);
    const ties = count((h) => h.winner < 0);
    const myScores = mine.map((h) => h.cats[h.me].total);
    const stat = (n, label) => `<div class="hs"><b>${n}</b><small>${label}</small></div>`;
    const kinds = { all: 'All', ai: '🤖 Computer', local: '👥 Same device' };
    const icon = { ai: '🤖', local: '👥' };
    const row = (h) => {
      let res;
      if (h.me != null) res = h.winner < 0 ? '<span class="hg-res tie">Tie</span>' : h.winner === h.me ? '<span class="hg-res win">Win</span>' : '<span class="hg-res loss">Loss</span>';
      else res = h.winner < 0 ? '<span class="hg-res tie">Tie</span>' : `<span class="hg-res">${esc(h.names[h.winner])} won</span>`;
      const when = new Date(h.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const what = [h.kind === 'ai' ? `vs ${plural(h.names.length - 1, 'computer league')}${h.level ? ' · ' + LEVEL_NAME[h.level] : ''}` : `${h.names.length} players, one device`, when].join(' · ');
      const line = h.names.map((nm, i) => `${esc(nm)} <em>${h.cats ? '⭐' + h.cats[i].total : '–'}</em>`).join(' · ');
      const table = h.cats ? `<div class="hg-table" style="--n:${h.names.length}"><div class="hg-names"><small></small>${h.names.map((nm, i) => `<b style="--pc:${PCOLOR[i]}">${esc(nm)}</b>`).join('')}</div>${HIST_ROWS.map(([label, k]) => `<div><small>${label}</small>${h.cats.map((c) => `<span>${c[k] || 0}</span>`).join('')}</div>`).join('')}</div>` : '';
      const view = `<div class="hg-view"><button class="btn sm" data-past="${esc(h.id)}">🦸 See the teams</button></div>`;
      return `<details class="hg"><summary><span class="hg-icon">${icon[h.kind] || '🦸'}</span><span class="hg-main"><b>${line}</b><small>${esc(what)}</small></span>${res}</summary>${table}${view}</details>`;
    };
    box.innerHTML = `
      <div class="seg hist-kind">${Object.keys(kinds).map((k) => `<button data-k="${k}" class="${hist.kind === k ? 'on' : ''}">${kinds[k]}</button>`).join('')}</div>
      <div class="hist-stats">
        ${stat(items.length, 'played')}${stat(wins, 'won')}${stat(mine.length - wins - ties, 'lost')}${stat(ties, 'tied')}
        ${stat(myScores.length ? '⭐' + Math.max(...myScores) : '–', 'best')}
        ${stat(myScores.length ? '⭐' + Math.round(myScores.reduce((t, x) => t + x, 0) / myScores.length) : '–', 'average')}
      </div>
      ${items.length ? `<div class="hist-list">${items.map(row).join('')}</div>` : '<p class="muted hist-empty">No finished games yet. Games are added when the Plaza fills up.</p>'}
      <p class="muted hist-note">Wins and scores count your games against the computer. Tap a game to see how each team scored.</p>`;
    const list = box.querySelector('.hist-list');
    if (list) list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-past]');
      if (!b) return;
      b.disabled = true;
      openPast(b.dataset.past).finally(() => (b.disabled = false));
    });
    box.querySelector('.hist-kind').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      hist.kind = b.dataset.k;
      renderHistory();
    };
  }

  // ---------------------------------------------------------------- computer vs computer (admin)
  function openSimSetup() {
    const sim = Object.assign({ leagues: 3, levels: ['hard', 'normal', 'easy', 'normal', 'brutal'], speed: 'fast' }, prefs().sim);
    const speeds = {};
    Object.keys(SIM_SPEEDS).forEach((k) => (speeds[k] = SIM_SPEEDS[k].name));
    const draw = () => `<h2>🧪 Computer vs computer</h2>
      <p class="muted">Admin only. Computer leagues play a whole game while you watch. Nothing is saved or added to game history.</p>
      <div class="field"><span class="label">Leagues</span><div class="seg" data-k="leagues">${[2, 3, 4, 5].map((n) => `<button data-v="${n}" class="${sim.leagues === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      ${Array.from({ length: sim.leagues }, (_, i) => `<div class="field"><span class="label" style="color:${PCOLOR[i]}">${SIGN[i]} ${esc(LEAGUE_NAMES[i])}</span><div class="seg" data-k="l${i}">${Object.keys(LEVEL_NAME).map((l) => `<button data-v="${l}" class="${sim.levels[i] === l ? 'on' : ''}">${LEVEL_NAME[l]}</button>`).join('')}</div></div>`).join('')}
      <div class="field"><span class="label">Speed</span><div class="seg" data-k="speed">${Object.keys(speeds).map((v) => `<button data-v="${v}" class="${sim.speed === v ? 'on' : ''}">${speeds[v]}</button>`).join('')}</div></div>
      <button class="btn big" id="sim-go">▶ Start</button>`;
    const back = openModal('<div id="dlg"></div>', { onClose: () => {} });
    const root = back.querySelector('#dlg');
    root.innerHTML = draw();
    root.addEventListener('click', (e) => {
      const b = e.target.closest('.seg button');
      if (b) {
        const k = b.parentNode.dataset.k;
        if (k === 'leagues') sim.leagues = Number(b.dataset.v);
        else if (k === 'speed') sim.speed = b.dataset.v;
        else sim.levels[Number(k.slice(1))] = b.dataset.v;
        root.innerHTML = draw();
        return;
      }
      if (e.target.closest('#sim-go')) {
        savePrefs(Object.assign(prefs(), { sim }));
        startSim({ levels: sim.levels.slice(0, sim.leagues), speed: sim.speed });
      }
    });
  }
  function startSim(sim) {
    closeModal(true);
    const n = sim.levels.length;
    const state = E.newGame({ names: sim.levels.map((l, i) => LEAGUE_NAMES[i]), ai: sim.levels.map(() => true), levels: sim.levels, first: Math.floor(Math.random() * n) });
    sim.levels.forEach((l, i) => E.aiHeadStart(state, i, l));
    startFrom({ state, mode: 'sim', level: sim.levels[0], levels: sim.levels, speed: sim.speed, view: 0 });
  }
  function stopSim() {
    stopAI();
    closeModal(true);
    document.querySelectorAll('.hl-reveal').forEach((x) => x.remove());
    showSetup();
  }

  // ---------------------------------------------------------------- rules
  const RULE_CHAPTERS = [
    ['overview', 'Overview'],
    ['setup', 'Setting up'],
    ['turn', 'Your turn'],
    ['cards', 'Reading a card'],
    ['mission', 'The Mission'],
    ['score', 'The end & scoring'],
    ['gallery', 'Every card'],
    ['terms', 'Quick reference'],
  ];
  function rulesBody(tab) {
    const n = RULE_CHAPTERS.findIndex((c) => c[0] === tab) + 1;
    const sec = (i, title) => `<h4 class="rb-sec"><span>${n}.${i}</span> ${title}</h4>`;
    const head = `<h3 class="rb-ch"><small>Chapter ${n}</small>${RULE_CHAPTERS[n - 1][1]}</h3>`;
    const S = E.SUIT;
    let body = '';
    if (tab === 'overview') {
      body = `${sec(1, 'The story')}
        <p>The city needs heroes, and every league wants the best team. You start with seven hero cards. Each turn you <b>draw one</b> and <b>send one away</b> to the Plaza, where the other leagues — and you, later — can recruit it. When the Plaza fills up, every league lays down its seven cards and scores them.</p>
        ${sec(2, 'How to win')}
        <p>The league whose seven cards score the <b>most points</b> wins. Cards score their printed power, plus bonuses for good teammates, minus penalties for bad ones — and the whole team scores extra if it fits the <b>Mission</b>.</p>
        ${sec(3, 'What’s in the box')}
        <ul><li>🦸 <b>${E.CARDS.length} hero cards</b> in ${E.SUITS.length} suits of 5: ${E.SUITS.map((s) => `${S[s].icon} ${S[s].plural}`).join(', ')}.</li>
        <li>🎯 <b>${E.MISSION_ORDER.length} Mission cards</b>. One is turned face up each game.</li>
        <li>🏙️ <b>The Plaza board</b> with ${E.PLAZA_END} spaces for sent-away cards.</li>
        <li>No dice and no money — only the cards.</li></ul>
        ${sec(4, 'The game in one paragraph')}
        <p>Every card is good with some cards and bad with others. Valora hits harder with the Star Hammer; Starbolt wipes out every Shadow; Spirit Guide won’t stand next to a Villain. Build a team where the bonuses stack up, and watch what the others pick up from the Plaza — sending away a card a rival needs can cost you the game.</p>`;
    } else if (tab === 'setup') {
      body = `${sec(1, 'Deal')}
        <ol class="rb-flow"><li>Shuffle all ${E.CARDS.length} hero cards into a face-down deck.</li>
        <li>Deal <b>${E.HAND} cards</b> to each league. Keep your hand secret.</li>
        <li>Shuffle the Mission cards and turn one face up. Everyone plays for the same Mission.</li>
        <li>The Plaza starts empty.</li></ol>
        ${sec(2, 'Players')}
        <p>2 to 5 leagues. Play against 1 to 4 computer leagues, or pass one device around: each player taps to see their own hand on their turn, so everyone else should look away.</p>
        ${sec(3, 'Playing the computer')}
        <p>A <b>Hard</b> computer league is dealt 1 extra card and a <b>Brutal</b> one 2 extra; each keeps its best ${E.HAND} and puts the rest at the bottom of the deck.</p>`;
    } else if (tab === 'turn') {
      body = `<p>Turns go round the table. On your turn, do both steps:</p>
        ${sec(1, 'Draw one card')}
        <p>Either take the <b>top card of the deck</b> (a surprise), or <b>recruit any card in the Plaza</b> (you know exactly what you’re getting — and so does everyone else). You can take back a card you sent there yourself on an earlier turn.</p>
        ${sec(2, 'Send one card to the Plaza')}
        <p>You now have ${E.HAND + 1} cards. Choose one and put it face up in the Plaza. You <b>can’t send back a card you just recruited from the Plaza</b> this turn, but you can send away a card you just drew from the deck.</p>
        <p class="rb-ex">Your hand has Valora but no Star Hammer — and the Star Hammer is sitting in the Plaza. Recruit it: Valora gets +12 and the Hammer gets +8 for having a Bruiser. Then send away your weakest card. Careful: if you send away Scout, the next league might be the one with all the Bruisers.</p>
        ${sec(3, 'Watching the others')}
        <p>When a league recruits a card from the Plaza, everyone sees it. The 👁️ next to a league shows the Plaza cards they’ve taken and still hold. Use it to guess what they’re building — and to avoid sending them what they need.</p>`;
    } else if (tab === 'cards') {
      const ex = 'valora';
      body = `${sec(1, 'Anatomy of a card')}
        <div class="rb-card">${cardHtml(ex)}<ul><li><b>Power</b> (top left) — what the card scores on its own.</li><li><b>Suit</b> (top right) — ${S[C(ex).suit].icon} ${S[C(ex).suit].name}. Other cards and the Mission care about suits.</li><li><b>Ability</b> — <span class="fx pos">green</span> are bonuses, <span class="fx neg">red</span> are penalties, <span class="fx spec">blue</span> are special.</li></ul></div>
        ${sec(2, 'Bonuses')}
        <p>“+12 with Star Hammer” means +12 if the Star Hammer is in the same hand. “+5 for each other Bruiser” counts every other Bruiser. A card never counts itself.</p>
        ${sec(3, 'Penalties')}
        <p>Penalties take points away (“−5 for each Tech”). Some penalties <b>blank</b> other cards: a blanked card scores nothing, its ability does nothing, and it doesn’t count for any suit or for the Mission. “Blanked unless you have…” cards blank themselves when their partner is missing.</p>
        ${sec(4, 'Special abilities')}
        <dl class="rb-terms"><dt>🛡️ Clear</dt><dd>Hacklette, Penny Press and Skybase <b>clear</b> penalties: the cleared card’s penalties — including blanking and “blanked unless” — just don’t happen.</dd>
        <dt>🎭 Mimic</dt><dd>Counts as whichever suit scores your team best.</dd>
        <dt>🔮 Seer Sela</dt><dd>Doubles your +${E.MISSION_DONE} for completing the Mission.</dd></dl>
        ${sec(5, 'The suits')}
        <table><tr><th>Suit</th><th>Plays well with</th></tr>
        <tr><td>${S.bruiser.icon} Bruisers</td><td>Other Bruisers, the Star Hammer, Tremor and sidekicks</td></tr>
        <tr><td>${S.speed.icon} Speedsters</td><td>Tech, Cosmic and Sidekicks — but not Gear</td></tr>
        <tr><td>${S.tech.icon} Tech</td><td>Gear, Speedsters and Robo-Pup. Hated by Sorcerer Sable and Dr. Entropy</td></tr>
        <tr><td>${S.mystic.icon} Mystics</td><td>Cosmic heroes. Spirit Guide hates Villains</td></tr>
        <tr><td>${S.cosmic.icon} Cosmic</td><td>Mystics and Speedsters. Starbolt blanks every Shadow</td></tr>
        <tr><td>${S.shadow.icon} Shadows</td><td>Other Shadows, Villains and the Utility Belt. Nightshade works alone</td></tr>
        <tr><td>${S.element.icon} Elementals</td><td>Each other and Bruisers. Stormcaller blanks all Gear</td></tr>
        <tr><td>${S.sidekick.icon} Sidekicks</td><td>Whoever they follow: Bruisers, Speedsters, Tech — and the Jet Pack</td></tr>
        <tr><td>${S.gear.icon} Gear</td><td>Bruisers, Tech and Sidekicks. Skybase clears every penalty</td></tr>
        <tr><td>${S.villain.icon} Villains</td><td>Huge power with nasty penalties. Hacklette clears them; Brick Malone loves them</td></tr></table>`;
    } else if (tab === 'mission') {
      body = `${sec(1, 'How the Mission scores')}
        <ol class="rb-flow"><li><b>+${E.MISSION_DONE}</b> if your team has at least one card of <b>each</b> of the Mission’s two suits — or <b>−${E.MISSION_FAIL}</b> if it’s missing either.</li><li><b>+${E.MISSION_FIT}</b> for each card of either Mission suit, so the more of your team fits the Mission, the better.</li><li>A bonus for each card of the Mission’s helpful suit.</li><li>A penalty for each card of the suit that gets in the way.</li></ol>
        <p>Blanked cards don’t count. Mimic can count as a Mission suit. Seer Sela doubles the +${E.MISSION_DONE} for having both suits.</p>
        <p class="rb-ex">Alien Invasion needs Cosmic and Tech. A team with two Cosmic, one Tech and one Bruiser scores +${E.MISSION_DONE} + 3 × ${E.MISSION_FIT} + ${E.MISSIONS.invasion.plus.n} = <b>+${E.MISSION_DONE + 3 * E.MISSION_FIT + E.MISSIONS.invasion.plus.n}</b>. The same team without its Tech scores −${E.MISSION_FAIL} + 2 × ${E.MISSION_FIT} + ${E.MISSIONS.invasion.plus.n} = <b>${-E.MISSION_FAIL + 2 * E.MISSION_FIT + E.MISSIONS.invasion.plus.n}</b>.</p>
        ${sec(2, 'All the Missions')}
        <table><tr><th>Mission</th><th>Have both (+${E.MISSION_FIT} each)</th><th>Bonus</th><th>Penalty</th></tr>${E.MISSION_ORDER.map((k) => {
          const M = E.MISSIONS[k];
          return `<tr><td>${M.icon} ${esc(M.name)}</td><td>${M.need.map((x) => S[x].icon + ' ' + S[x].name).join(' + ')}</td><td class="good">+${M.plus.n} per ${S[M.plus.s].icon}</td><td class="bad">−${M.minus.n} per ${S[M.minus.s].icon}</td></tr>`;
        }).join('')}</table>`;
    } else if (tab === 'score') {
      body = `${sec(1, 'When the game ends')}
        <p>The game ends <b>the moment the ${E.PLAZA_END}th card lands in the Plaza</b> — usually when someone draws from the deck while the Plaza has ${E.PLAZA_END - 1}. (Recruiting from the Plaza takes a card out, so it doesn’t fill up.) It also ends if the deck runs out. Nobody gets one last turn.</p>
        <p class="rb-ex">With ${E.PLAZA_END - 1} cards in the Plaza, you decide the timing. Ahead? Draw from the deck and end it. Behind? Recruit from the Plaza and keep the game going.</p>
        ${sec(2, 'Scoring a team, step by step')}
        <ol class="rb-flow"><li>Mimic chooses its suit.</li><li>Clear penalties (Hacklette, Penny Press, Skybase).</li><li>Blank cards — all blanking happens at the same time.</li><li>Check “blanked unless…” cards.</li><li>Each card that isn’t blanked scores its power + bonuses − penalties.</li><li>Add the Mission.</li></ol>
        <p class="rb-ex">Nobody’s score is shown during the game — not even your own. Counting up your team (and guessing at everyone else’s) is part of the challenge. The full breakdown appears at the end.</p>
        ${sec(3, 'Winning')}
        <p>Highest total wins. If it’s a tie, the team with more card power wins; if that’s tied too, it’s a shared win.</p>`;
    } else if (tab === 'gallery') {
      body = E.SUITS.map((s) => `<h4 class="rb-sec">${S[s].icon} ${S[s].plural}</h4>
        <table class="gallery"><tr><th>Card</th><th>Power</th><th>Ability</th></tr>${E.CARDS.filter((c) => c.suit === s).map((c) => `<tr><td><img class="rb-face" src="${IMG(c.id)}" alt="" width="30" height="30" loading="lazy"> ${esc(c.name)}</td><td><b>${c.power}</b></td><td>${fxHtml(c.id)}</td></tr>`).join('')}</table>`).join('');
    } else {
      const terms = [
        ['Plaza', `The face-up row of sent-away cards. Anyone can recruit from it. The game ends when it holds ${E.PLAZA_END}.`],
        ['Recruit', 'Take a card from the Plaza instead of drawing from the deck.'],
        ['Send', 'Put a card from your hand into the Plaza. Every turn ends with one.'],
        ['Power', 'The number in the corner: what a card scores before bonuses and penalties.'],
        ['Blanked', 'Scores 0, has no ability, and has no suit.'],
        ['Clear', 'Cancels a card’s penalties, including blanking.'],
        ['Mission', `The face-up goal card. Fit it for big bonuses; miss it and lose ${E.MISSION_FAIL}.`],
      ];
      body = `${sec(1, 'Your turn, in short')}
        <ol class="rb-flow"><li>Draw the top card of the deck, <b>or</b> recruit a card from the Plaza.</li><li>Send one card (not one you just recruited) to the Plaza.</li><li>If the Plaza now holds ${E.PLAZA_END} cards, or the deck is empty, the game ends.</li></ol>
        ${sec(2, 'Terms')}
        <dl class="rb-terms">${terms.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')}</dl>`;
    }
    const prev = RULE_CHAPTERS[n - 2];
    const next = RULE_CHAPTERS[n];
    return `${head}${body}<div class="rb-nav">${prev ? `<button class="btn ghost sm" data-tab="${prev[0]}">← ${n - 1}. ${prev[1]}</button>` : '<span></span>'}${next ? `<button class="btn sm" data-tab="${next[0]}">${n + 1}. ${next[1]} →</button>` : ''}</div>`;
  }
  function showRules(tab) {
    ui.rulesTab = tab || ui.rulesTab;
    if (!RULE_CHAPTERS.some((c) => c[0] === ui.rulesTab)) ui.rulesTab = 'overview';
    const toc = () => RULE_CHAPTERS.map(([k, name], i) => `<button data-tab="${k}" class="${ui.rulesTab === k ? 'on' : ''}"><span>${i + 1}</span> ${name}</button>`).join('');
    const back = openModal(`<h2>📜 Hero League — Rulebook</h2>
      <div class="rulebook"><nav class="rules-tabs rb-toc" aria-label="Contents"><b class="rb-toc-head">Contents</b>${toc()}</nav>
      <article class="rules-body">${rulesBody(ui.rulesTab)}</article></div>`, { cls: 'wide rules-modal', onClose: G ? null : () => {} });
    back.querySelector('.rulebook').onclick = (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      ui.rulesTab = b.dataset.tab;
      back.querySelectorAll('.rb-toc button').forEach((x) => x.classList.toggle('on', x.dataset.tab === ui.rulesTab));
      back.querySelector('.rules-body').innerHTML = rulesBody(ui.rulesTab);
      const m = back.querySelector('.modal');
      if (m) m.scrollTop = 0;
      const on = back.querySelector('.rb-toc button.on');
      if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
  }

  // ---------------------------------------------------------------- start
  const params = new URLSearchParams(location.search);
  const localId = params.get('local');
  if (!sessionId()) showGate();
  else if (!isAdmin()) showLocked();
  else if (localId && /^[a-z0-9]{4,40}$/i.test(localId)) {
    const here = rawSave();
    if (validSave(here) && here.gid === localId && lastStatus(localId) === 'here') startFrom(here);
    else if (window.BoardSaves) {
      $('#app').innerHTML = '<p class="loading-save">Loading your game…</p>';
      window.BoardSaves.load('heroes', localId).then((g) => {
        if (validSave(g) && g.state.phase !== 'over') startFrom(g);
        else {
          showSetup();
          toast('That game couldn’t be found — it may have finished or been removed.', 'bad');
        }
      });
    } else showSetup();
  } else showSetup();
  window.__hx = { get G() { return G; }, render, E, send: (a) => doAction(a) };
})();
