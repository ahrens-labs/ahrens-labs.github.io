// Cauldron Lane — page UI. Rules live in cauldron-engine.js. Admin-only while it's being playtested.
(function () {
  'use strict';
  const E = window.CauldronEngine;
  const SAVE_KEY = 'ahrensCauldron.v1';
  const PREFS_KEY = 'ahrensCauldron.prefs';
  const ADMIN_EMAIL = 'calebahrens2011@gmail.com';
  const API_BASE = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
  const LEVEL_NAME = { easy: 'Easy', normal: 'Normal', hard: 'Hard', brutal: 'Brutal' };
  const LEVEL_HINT = {
    easy: 'Brews whatever it can, never buys recipes, and prices carelessly.',
    normal: 'A fair game.',
    hard: 'Plans every day carefully, prices to squeeze you, and opens with 🪙3 extra.',
    brutal: 'Its best play, the tightest margins, and 🪙6 extra to start.',
  };
  const SIM_SPEEDS = {
    turbo: { name: '⚡ Turbo', ai: 0 },
    fast: { name: '⏩ Fast', ai: 250 },
    watch: { name: '👀 Watch', ai: 1100 },
  };
  const IMG = (k) => `/img/cauldron/${k}.webp?v=2`;
  const PCOLOR = ['#d9473f', '#3b7fd6', '#3fa860', '#9b59d0'];
  const SIGN = ['⚗️', '🧪', '🌿', '🔮'];
  const SHOP_NAMES = ['The Red Cauldron', 'Blue Phial & Co.', 'Greenroot Remedy', 'Violet Moon'];

  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const stars = (t) => '★'.repeat(t);

  let G = null; // { state, mode: 'ai' | 'local' | 'sim' | 'past', level, levels, speed, view, follow, gid, moved, recorded, revealed }
  const ui = { aiTimer: null, modal: false, onClose: null, rulesTab: 'overview', moved: -1 };

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
      if (BS.list('cauldron').some((m) => m.id === G.gid)) BS.remove('cauldron', G.gid);
      return;
    }
    if (!G.moved) return;
    BS.put('cauldron', G.gid, G, { mode: G.mode, level: G.level, names: s.players.map((p) => p.name), round: E.today(s), rounds: E.DAYS, moved: true });
  }
  addEventListener('boardsaves:removed', (e) => {
    if (G && G.gid && e.detail.some((m) => m.game === 'cauldron' && m.id === G.gid)) toast('This game was removed from Your games on another device, so it won’t be saved any more.', 'bad');
  });
  const validSave = (g) => g && g.state && g.state.v === E.SAVE_V && (g.mode === 'ai' || g.mode === 'local');
  const lastStatus = (gid) => (gid && window.BoardSaves ? window.BoardSaves.status('cauldron', gid) : 'here');
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
  const humanTurn = () => st().phase === 'act' && !pl(st().turn).ai && G.mode !== 'past';
  const shopName = (i) => `<b class="who" style="--pc:${PCOLOR[i]}">${esc(pl(i).name)}</b>`;
  const you = (i) => G.mode === 'ai' && i === 0;
  function toast(html, kind, ms) {
    const root = $('#toasts');
    if (!root) return;
    const t = document.createElement('div');
    t.className = `toast ${kind || ''}`;
    t.innerHTML = html;
    root.appendChild(t);
    while (root.children.length > 5) root.firstChild.remove();
    setTimeout(() => t.classList.add('out'), ms || 3200);
    setTimeout(() => t.remove(), (ms || 3200) + 400);
  }
  function sfx(k, delay) {
    if (!window.GameMusic || !G || G.mode === 'sim') return;
    if (delay) setTimeout(() => GameMusic.sfx(k), delay);
    else GameMusic.sfx(k);
  }
  const tok = (k, n) => `<span class="tok ${E.ING[k].kind}" title="${esc(E.ING[k].name)}">${E.ING[k].icon}${n > 1 ? `<b>×${n}</b>` : ''}</span>`;
  const toks = (bag) => Object.keys(bag).filter((k) => bag[k] > 0).map((k) => tok(k, bag[k])).join('');
  const bottle = (k, cls) => `<span class="bottle${cls ? ' ' + cls : ''}" style="--c:${E.POTION[k].color}" aria-hidden="true"><i></i></span>`;
  const needTag = (need) => `<span class="need n-${need}">${E.NEED[need].icon} ${esc(E.NEED[need].name)}</span>`;
  const tierTag = (t) => `<span class="tier t${t}" title="${E.TIER[t].name}">${stars(t)} ${E.TIER[t].name}</span>`;
  const folkPic = (o) => `<img class="folk-pic" src="${IMG('folk-' + o.who)}" alt="" width="56" height="56" loading="lazy">`;
  const beastPic = (k) => `<img class="beast-pic" src="${IMG('beast-' + k)}" alt="" loading="lazy">`;
  // Every tier a customer would accept for their need, with what they'd pay for it.
  function payList(o) {
    return [1, 2, 3, 4].filter((t) => t >= o.min && E.POTION_ORDER.some((k) => E.POTION[k].need === o.need && E.tier(k) === t))
      .map((t) => `<span class="pay t${t}">${stars(t)} 🪙${E.TIER[t].pay + o.bonus}</span>`).join('');
  }
  const nextBell = (p) => E.BELLS.find((b) => b > p.pos);
  // Turn order from here: furthest back first; on a shared space, whoever arrived last goes first.
  function turnOrder(s) {
    return s.players.map((_, i) => i).filter((i) => s.players[i].pos < E.DAYS).sort((a, b) => s.players[a].pos - s.players[b].pos || s.players[b].arr - s.players[a].arr);
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
    if (e.key === 'Escape' && ui.modal && !$('.modal-back.locked')) closeModal();
  });

  // ---------------------------------------------------------------- home
  function heroHtml(withTagline) {
    const bubbles = Array.from({ length: 12 }, (_, i) => `<i style="left:${8 + ((i * 37) % 30)}%;animation-delay:${(i * 0.7).toFixed(1)}s;width:${6 + (i % 4) * 3}px;height:${6 + (i % 4) * 3}px"></i>`).join('');
    return `<div class="gh-top"><a class="gh-lobby" href="/board-games.html" title="Back to the game lobby">← <img class="gh-dice" src="/img/board-games-favicon-48.png?v=2" alt="" width="20" height="20"> Game lobby</a>${window.GameMusic ? GameMusic.buttonHtml('btn ghost sm gh-music', 'bt') : ''}</div>
      <div class="gh-hero">
        <img src="${IMG('cover')}" alt="Four glowing potion shops side by side on a cobbled lane under a full moon, with a baby dragon and a phoenix chick in the sky" class="gh-hero-img">
        <div class="gh-shade"></div>
        <div class="hero-bubbles" aria-hidden="true">${bubbles}</div>
        <div class="gh-title"><h1 class="display">Cauldron Lane</h1>${withTagline ? '<p>Run a potion shop on a crowded lane. Buy herbs, hunt griffins and dragons for rare parts, and sell to townsfolk — or to the shop next door. Every action costs days, and the richest shop at the Moon Fair wins.</p>' : ''}</div>
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
        <p>You need an Ahrens Labs account to play Cauldron Lane.</p>
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
        <p>Cauldron Lane is being playtested and isn’t open yet. Check back soon!</p>
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
    const rivals = pr.rivals || 1;
    const seats = pr.seats || 2;
    document.body.className = 'setup-mode';
    $('#app').innerHTML = `
      <div class="setup gh">
        ${heroHtml(true)}
      <div class="setup-card gh-card panel">
        ${canResume ? `<div class="gh-resume"><div><b>Shop open</b><span>${esc(saved.state.players.map((p) => p.name).join(' vs '))} · day ${E.today(saved.state)} of ${E.DAYS}</span></div><button class="btn" id="resume">Continue</button></div>` : ''}
        <h2>New game</h2>
        <div class="gh-modes" id="mode">
          <button data-v="ai" class="gh-mode ${pr.mode !== 'local' && pr.mode !== 'online' ? 'on' : ''}"><span>🤖</span><b>Computer</b><small>Out-sell rival shops</small></button>
          <button data-v="local" class="gh-mode ${pr.mode === 'local' ? 'on' : ''}"><span>👥</span><b>Players</b><small>2–4 on this device</small></button>
          <button data-v="online" class="gh-mode ${pr.mode === 'online' ? 'on' : ''}"><span>🌐</span><b>Online</b><small>Challenge friends</small></button>
        </div>
        <div class="online-only online-soon"><b>🌐 Online play opens at launch</b><p>Running shops against other Ahrens Labs players arrives when Cauldron Lane leaves the lab. For now, play the computer or friends on this device.</p></div>
        <div class="field ai-only offline-only">
          <span class="label">Rival shops</span>
          <div class="seg" id="rivals">${[1, 2, 3].map((n) => `<button data-v="${n}" class="${rivals === n ? 'on' : ''}">${n} ${n === 1 ? 'rival' : 'rivals'}</button>`).join('')}</div>
        </div>
        <div class="field local-only">
          <span class="label">Shops</span>
          <div class="seg" id="seats">${[2, 3, 4].map((n) => `<button data-v="${n}" class="${seats === n ? 'on' : ''}">${n} players</button>`).join('')}</div>
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
          <span class="label">Who opens first?</span>
          <div class="seg" id="first">
            <button data-v="0" class="on">Me</button>
            <button data-v="1">A rival</button>
            <button data-v="r">🎲 Random</button>
          </div>
        </div>
        <button class="btn big offline-only" id="start">Open the shops</button>
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
      $('#names').innerHTML = Array.from({ length: n }, (_, i) => `<label style="--pc:${PCOLOR[i]}"><span class="label"><i class="sw"></i>${m === 'local' ? `Shop ${i + 1}` : 'Your shop'}</span><input id="n${i}" maxlength="18" value="${esc(keep[i] || pr['n' + i] || SHOP_NAMES[i])}"></label>`).join('');
    };
    const setMode = (m) => {
      $('.setup').classList.toggle('is-local', m === 'local');
      $('.setup').classList.toggle('is-online', m === 'online');
      $('#first').children[0].textContent = m === 'local' ? 'Shop 1' : 'Me';
      $('#first').children[1].textContent = m === 'local' ? 'Shop 2' : 'A rival';
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
      const typed = [...document.querySelectorAll('#names input')].map((x, i) => x.value.trim() || SHOP_NAMES[i]);
      const names = Array.from({ length: n }, (_, i) => typed[i] || SHOP_NAMES[i]);
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
    };
  }

  // ---------------------------------------------------------------- game screen
  function startFrom(g) {
    if (!sessionId()) return showGate();
    if (!isAdmin()) return showLocked();
    stopAI();
    G = g;
    ui.moved = -1;
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

  function viewIndex() {
    const s = st();
    if (G.mode === 'local' && s.phase === 'act' && G.follow !== false) return s.turn;
    return G.view || 0;
  }

  function render() {
    if (!G) return;
    const s = st();
    const v = viewIndex();
    const day = E.today(s);
    const nextMarket = E.MARKET_DAYS[s.market];
    const sub = G.mode === 'past' ? '📜 Finished game' : G.mode === 'sim' ? `🧪 ${SIM_SPEEDS[G.speed].name} · computer vs computer` : G.mode === 'local' ? `👥 ${s.players.length} players` : `🤖 vs ${plural(s.players.length - 1, 'rival')} · ${LEVEL_NAME[G.level] || ''}`;
    const home = G.mode === 'past' ? '🏆<span class="bt"> History</span>' : G.mode === 'sim' ? '⏹<span class="bt"> Stop</span>' : '⚗️<span class="bt"> New game</span>';
    $('#app').innerHTML = `
      <header class="topbar">
        <div class="brand">
          <img src="/img/cauldron-favicon-96.png?v=2" alt="" class="brand-logo" width="46" height="46">
          <div><h1>Cauldron Lane</h1><small>${esc(sub)}</small></div>
        </div>
        <div class="top-mid">
          <div class="day-meter" title="The calendar runs to the Moon Fair on day ${E.DAYS}"><span class="dm-label">📅 Day <b>${s.phase === 'over' ? E.DAYS : day}</b> of ${E.DAYS}</span><span class="dm-bar"><i style="width:${Math.round(((s.phase === 'over' ? E.DAYS : day) / E.DAYS) * 100)}%"></i></span></div>
          <div class="top-chips">
            ${s.phase === 'act' && nextMarket ? `<span class="chip" title="On market day the market restocks, Guild prices recover, and the bestiary and library change">🛒 Market day ${nextMarket}</span>` : ''}
            <span class="chip" title="The game ends at the Moon Fair">🌕 Moon Fair: day ${E.DAYS}</span>
          </div>
        </div>
        <div class="top-actions">
          ${window.GameMusic ? GameMusic.buttonHtml('btn ghost sm', 'bt') : ''}
          <button class="btn ghost sm" data-act="rules" aria-label="Rules">📜<span class="bt"> Rules</span></button>
          <button class="btn ghost sm" data-act="home" aria-label="${G.mode === 'past' ? 'History' : G.mode === 'sim' ? 'Stop' : 'New game'}" title="${G.mode === 'past' ? 'Back to history' : G.mode === 'sim' ? 'Stop the simulation' : 'Start a new game (this one stays saved under Your games)'}">${home}</button>
          <a class="btn ghost sm" href="/board-games.html" title="Back to the game lobby" aria-label="Game lobby"><img class="gh-dice" src="/img/board-games-favicon-48.png?v=2" alt=""><span class="bt"> Lobby</span></a>
        </div>
      </header>
      <div class="cl">
        <section class="scores n${s.players.length}">${s.players.map((_, i) => shopCard(i, v)).join('')}</section>
        ${bannerHtml()}
        <section class="board-sec">
          <div class="sec-head"><h2>📅 The calendar</h2><small>${calendarNote()}</small></div>
          ${calendarHtml()}
        </section>
        <div class="main">
          <section class="square">${marketHtml()}${bestiaryHtml()}${libraryHtml()}${guildHtml()}</section>
          <section class="panel shop" style="--pc:${PCOLOR[v]}">${shopHtml(v)}</section>
        </div>
        <section class="panel"><h3>📜 The lane ledger</h3><div class="log" id="log">${logHtml()}</div></section>
      </div>`;
    const lg = $('#log');
    if (lg) lg.scrollTop = lg.scrollHeight;
  }

  function shopCard(i, v) {
    const s = st();
    const p = pl(i);
    const turn = s.phase === 'act' && s.turn === i;
    const done = s.phase === 'act' && p.pos >= E.DAYS;
    const tag = done ? '<span class="co-tag">At the Fair</span>' : turn ? `<span class="co-tag turn">${p.ai ? 'Thinking…' : G.mode === 'ai' ? 'Your move' : 'Up now'}</span>` : '';
    return `<div class="co${turn ? ' turn' : ''}${v === i ? ' viewing' : ''}" style="--pc:${PCOLOR[i]}" data-view="${i}" title="Show ${esc(p.name)}’s shop">
      <span class="co-flag">${SIGN[i]}</span>
      <div class="co-name"><b>${esc(p.name)}</b>${p.ai ? `<span class="co-tag">🤖 ${LEVEL_NAME[p.level] || ''}</span>` : ''}${tag}</div>
      <div class="co-stats"><span title="Coins">🪙 <b>${p.coins}</b></span><span title="Day on the calendar">📅 <b>${p.pos}</b></span><span title="Customers waiting">🔔 <b>${p.queue.length}</b></span><span title="Potions on the shelf">🧴 <b>${p.shelf.length}</b></span><span title="Customers served">😊 <b>${p.stats.served}</b></span></div>
    </div>`;
  }

  function bannerHtml() {
    const s = st();
    if (G.mode === 'past') {
      const w = E.winner(s);
      return `<div class="banner">📜 ${w < 0 ? 'A tie!' : `${esc(pl(w).name)} won`} · <button class="btn sm" data-act="scorecard">🏆 Scorecard</button></div>`;
    }
    if (s.phase === 'over') return `<div class="banner mine">🌕 The Moon Fair is over. <button class="btn sm" data-act="scorecard">🏆 See who won</button></div>`;
    const p = pl(s.turn);
    if (p.ai) return `<div class="banner" style="--pc:${PCOLOR[s.turn]}"><span class="dot"></span>${esc(p.name)} is on day ${p.pos}, furthest back on the calendar, so they move next…</div>`;
    const who = G.mode === 'local' ? `${esc(p.name)}, your move` : 'Your move';
    const ahead = s.players.filter((q, i) => i !== s.turn && q.pos < E.DAYS);
    const lead = ahead.length ? Math.min(...ahead.map((q) => q.pos)) : null;
    const when = lead == null ? 'Everyone else is at the Moon Fair, so you keep moving until you get there too.' : lead === p.pos ? 'You’re level with a rival and arrived first, so you go.' : `You keep moving until you pass day ${lead}.`;
    return `<div class="banner mine" style="--pc:${PCOLOR[s.turn]}"><span class="dot"></span><b>${who}</b> — you’re on day ${p.pos}. ${when}</div>`;
  }

  // ---------------------------------------------------------------- the calendar track
  function calendarNote() {
    const s = st();
    if (s.phase === 'over') return 'Everyone reached the Moon Fair.';
    const order = turnOrder(s);
    return `Next up: ${order.slice(0, 3).map((i) => `<span class="ord" style="--pc:${PCOLOR[i]}">${esc(pl(i).name)}</span>`).join(' → ')}${order.length > 3 ? ' → …' : ''}`;
  }
  function calendarHtml() {
    const s = st();
    const day = E.today(s);
    const cells = [];
    for (let d = 0; d <= E.DAYS; d++) {
      const mk = E.MARKET_DAYS.indexOf(d);
      const bell = E.BELLS.includes(d);
      const here = s.players.map((p, i) => ({ p, i })).filter((x) => x.p.pos === d).sort((a, b) => b.p.arr - a.p.arr);
      const cls = ['sp'];
      if (mk >= 0) cls.push(mk < s.market ? 'mk done' : 'mk');
      if (d === E.DAYS) cls.push('fair');
      if (s.phase === 'act' && d === day) cls.push('today');
      if (d < day && s.phase === 'act') cls.push('past');
      const pawns = here.map((x, j) => `<span class="pawn${s.phase === 'act' && x.i === s.turn ? ' up' : ''}${ui.moved === x.i ? ' moved' : ''}" style="--pc:${PCOLOR[x.i]};--j:${j}" title="${esc(x.p.name)}${j === 0 && here.length > 1 ? ' (on top: arrived last, moves first)' : ''}"></span>`).join('');
      const label = d === E.DAYS ? '🌕' : mk >= 0 ? '🛒' : bell ? '🔔' : '';
      cells.push(`<div class="${cls.join(' ')}" title="Day ${d}${mk >= 0 ? ' · market day' : ''}${bell ? ' · doorbell: a customer comes in when your pawn passes' : ''}${d === E.DAYS ? ' · the Moon Fair' : ''}"><span class="sp-n">${d}</span><span class="sp-i">${label}</span><span class="pawns">${pawns}</span></div>`);
    }
    return `<div class="cal">${cells.join('')}</div>
      <div class="legend"><span>🔔 doorbell: a customer arrives at your shop when your pawn passes it</span><span>🛒 market day</span><span>🌕 Moon Fair</span><span><i class="lg-pawn"></i> stacked pawns: the top one arrived last and moves first</span></div>`;
  }

  // ---------------------------------------------------------------- the market square (shared)
  function marketHtml() {
    const s = st();
    const rows = E.COMMONS.map((k) => {
      const sup = s.supply[k];
      const slots = E.LADDER.map((price, i) => {
        const has = i >= E.LADDER.length - sup;
        const next = i === E.LADDER.length - sup;
        return `<span class="slot${has ? ' full' : ''}${next ? ' next' : ''}"><em>🪙${price}</em>${has ? `<span class="tok common">${E.ING[k].icon}</span>` : ''}</span>`;
      }).join('');
      return `<div class="lad"><div class="lad-k">${tok(k)}<b>${esc(E.ING[k].name)}</b><small>${sup ? `next 🪙${E.price(s, k)}` : 'sold out'}</small></div><div class="lad-slots">${slots}</div></div>`;
    }).join('');
    return `<div class="panel sq market"><h3>🛒 The market <small>buy up to ${E.MARKET_BUY} per trip · 1 day</small></h3>
      <p class="muted">The cheapest token goes first, so prices climb as stock runs low. Each market day adds ${E.restock(s)} of each back.</p>${rows}</div>`;
  }

  function bestiaryHtml() {
    const s = st();
    const can = humanTurn();
    const cards = s.beasts.map((c, i) => {
      const d = E.beastDays(s, c);
      return `<button class="beast" data-hunt="${c.id}" ${can ? '' : 'tabindex="-1"'}>
        ${beastPic(c.k)}<span class="b-days" title="Days the hunt takes">⏳ ${plural(d, 'day')}</span>${i === 0 ? '<span class="b-old" title="The oldest sighting: its tracks are fresh-trodden, so the hunt is a day shorter. It leaves on the next market day.">🐾 −1 day</span>' : ''}
        <span class="b-name"><b>${esc(E.ING[c.k].beast)}</b><small>${c.n > 1 ? `${tok(c.k, 2)} a pair` : `${tok(c.k)} one`} · ${esc(E.BEAST[c.k].where)}</small></span>
      </button>`;
    }).join('');
    return `<div class="panel sq bestiary"><h3>🐾 The bestiary <small>creature sightings · ${plural(s.beastDeck.length, 'more')} in the deck</small></h3>
      <p class="muted">Hunting takes days instead of coins. Take a sighting and the next one is drawn. On market day the oldest (left) goes and a new one appears.</p>
      <div class="beasts">${cards || '<p class="empty">No sightings.</p>'}</div></div>`;
  }

  function recipeCard(k, extra) {
    const P = E.POTION[k];
    return `<div class="rcp t${P.tier}">${bottle(k)}<div class="rcp-main"><b>${esc(P.name)}</b><div class="rcp-tags">${tierTag(P.tier)}${needTag(P.need)}</div><div class="rcp-ing">${toks(P.ing)}</div></div>${extra || ''}</div>`;
  }

  function libraryHtml() {
    const s = st();
    const can = humanTurn();
    const p = can ? pl(s.turn) : null;
    const cards = s.library.map((k) => {
      const cost = E.LEARN_COST[E.tier(k)];
      const btn = can ? `<button class="btn sm" data-learn="${k}" ${p.coins < cost ? 'disabled' : ''}>${p.coins < cost ? `Need 🪙${cost}` : `Buy 🪙${cost}`}</button>` : `<span class="price">🪙${cost}</span>`;
      return recipeCard(k, btn);
    }).join('');
    return `<div class="panel sq library"><h3>📚 The library <small>recipe cards · 1 day + coins</small></h3>
      <p class="muted">Every recipe here exists once. Buy it and only your shop can brew it — everyone else has to buy those potions from you.</p>
      <div class="rcps">${cards || '<p class="empty">The library is empty.</p>'}</div></div>`;
  }

  function guildHtml() {
    const s = st();
    const known = new Set(s.players.flatMap((p) => p.recipes).concat(E.BASIC));
    const list = E.POTION_ORDER.filter((k) => known.has(k)).map((k) => {
      const base = E.TIER[E.tier(k)].guild;
      const now = s.guild[k];
      return `<div class="gp${now < base ? ' low' : ''}">${bottle(k, 'sm')}<span>${esc(E.POTION[k].name)}</span><b>🪙${now}</b>${now < base ? `<small>(usually ${base})</small>` : ''}</div>`;
    }).join('');
    return `<div class="panel sq guild"><h3>🏛️ Guild prices <small>sell any potion here · 1 day</small></h3>
      <p class="muted">The Guild buys anything, but cheaply. Each sale drops that potion’s price by 🪙${E.GUILD_DROP}; market day brings it back up by ${E.GUILD_RECOVER}. Showing potions someone can brew.</p>
      <div class="gps">${list}</div></div>`;
  }

  // ---------------------------------------------------------------- a shop mat
  function shopHtml(v) {
    const s = st();
    const p = pl(v);
    const mine = humanTurn() && s.turn === v;
    const tabs = `<div class="tabs">${s.players.map((q, i) => `<button class="${i === v ? 'on' : ''}" style="--pc:${PCOLOR[i]}" data-view="${i}">${SIGN[i]} ${esc(q.name)}</button>`).join('')}</div>`;
    const bell = nextBell(p);
    const queue = p.queue.map((o) => {
      const F = E.FOLK[o.who];
      const left = o.leave - p.pos;
      return `<div class="cust">${folkPic(o)}<div class="cust-main"><b>${esc(F.name)} <small>the ${esc(F.role)}</small></b>
        <div class="cust-want">Wants ${needTag(o.need)}${o.min > 1 ? ` <span class="picky">${stars(o.min)} ${E.TIER[o.min].name} or better</span>` : ''}</div>
        <div class="pays">${payList(o)}</div></div>
        <span class="cust-wait${left <= 2 ? ' soon' : ''}" title="Leaves once ${esc(p.name)}’s pawn passes day ${o.leave}">⏳ until day ${o.leave}</span></div>`;
    });
    for (let i = p.queue.length; i < E.QUEUE; i++) queue.push('<div class="cust empty-slot">An empty spot in the queue</div>');
    const shelf = p.shelf.map((x) => {
      const P = E.POTION[x.k];
      return `<div class="shelf-slot full">${bottle(x.k)}<b>${esc(P.name)}</b><small>${stars(P.tier)} · ${E.NEED[P.need].icon}</small>
        ${mine ? `<button class="tagbtn" data-tag="${x.id}" title="Change the price tag (free)">🏷️ 🪙${x.tag}</button>` : `<span class="tagbtn ro" title="Price tag: what another shop pays to buy it">🏷️ 🪙${x.tag}</span>`}</div>`;
    });
    for (let i = p.shelf.length; i < E.SHELF; i++) shelf.push('<div class="shelf-slot">empty</div>');
    const pantry = Object.keys(E.ING).filter((k) => p.pantry[k] > 0);
    const book = E.POTION_ORDER.filter((k) => E.knows(p, k)).map((k) => recipeCard(k, E.tier(k) > 1 ? '<span class="own" title="Only this shop can brew it">Only here</span>' : '')).join('');
    const acts = mine ? actionsHtml(v) : humanTurn() ? `<div class="acts"><button class="btn end" data-view="${s.turn}">← Back to ${esc(pl(s.turn).name)}</button></div>` : '';
    return `${tabs}
      <div class="mat-head"><span class="sign" style="--pc:${PCOLOR[v]}">${SIGN[v]}</span><div><h2>${esc(p.name)}</h2><small>🪙${p.coins} · day ${p.pos} · ${plural(p.stats.served, 'customer')} served${p.ai ? ` · 🤖 ${LEVEL_NAME[p.level] || ''}` : ''}</small></div></div>
      ${acts}
      <h3>🔔 Waiting customers <small>${p.queue.length}/${E.QUEUE}${bell && p.pos < E.DAYS ? ` · next doorbell: day ${bell}` : ''}</small></h3>
      <div class="queue">${queue.join('')}</div>
      <h3>🧴 Shelf <small>${p.shelf.length}/${E.SHELF} · customers buy the moment something suits them</small></h3>
      <div class="shelf">${shelf.join('')}</div>
      <h3>🧺 Pantry</h3>
      <div class="pantry">${pantry.length ? pantry.map((k) => tok(k, p.pantry[k])).join('') : '<p class="empty">Empty — go to market or on a hunt.</p>'}</div>
      <h3>📖 Recipe book <small>${plural(p.recipes.length, 'recipe')} of their own</small></h3>
      <div class="rcps book">${book}</div>`;
  }

  // What each action would do right now, and why it can't be done.
  function actionsHtml(pi) {
    const s = st();
    const p = pl(pi);
    const room = E.SHELF - p.shelf.length;
    const cheapest = Math.min(...E.COMMONS.map((k) => (s.supply[k] ? E.price(s, k) : 99)));
    const brewable = E.POTION_ORDER.some((k) => E.knows(p, k) && E.canBrew(p, k));
    const rivalStock = s.players.some((q, i) => i !== pi && q.shelf.some((x) => x.tag <= p.coins));
    const minLearn = s.library.length ? Math.min(...s.library.map((k) => E.LEARN_COST[E.tier(k)])) : null;
    const wait = E.waitDays(s, pi);
    const b = (act, icon, label, days, why, cls) => `<button class="act-btn${cls ? ' ' + cls : ''}" data-act="${act}" ${why ? 'disabled' : ''}><span class="a-i">${icon}</span><span class="a-t"><b>${label}</b><small>${why || days}</small></span></button>`;
    return `<div class="acts">
      ${b('market', '🛒', 'Go to market', '1 day', cheapest > p.coins ? 'Not enough coins' : '')}
      ${b('hunt', '🏹', 'Go hunting', 'pick a sighting', s.beasts.length ? '' : 'No sightings')}
      ${b('brew', '⚗️', 'Brew', `${E.BREW_DAYS} days · up to ${E.BREW_MAX}`, !room ? 'Shelf full' : !brewable ? 'Missing ingredients' : '', 'brew')}
      ${b('visit', '🏪', 'Shop at a rival', '1 day · up to 2', !room ? 'Shelf full' : !rivalStock ? 'Nothing you can afford' : '')}
      ${b('guild', '🏛️', 'Sell to the Guild', '1 day', p.shelf.length ? '' : 'Shelf empty')}
      ${b('learn', '📚', 'Buy a recipe', '1 day + coins', minLearn == null ? 'Library empty' : minLearn > p.coins ? 'Not enough coins' : '')}
      ${b('wait', '🧹', 'Mind the shop', `${plural(wait, 'day')} · +🪙${wait}`, '')}
    </div>`;
  }

  function logHtml() {
    const s = st();
    return s.log.slice(-90).map((l) => (l.who == null ? `<p class="sys"><small>Day ${l.d}</small> ${esc(l.text)}</p>` : `<p style="--pc:${PCOLOR[l.who]}"><small>Day ${l.d}</small> ${esc(l.text)}</p>`)).join('');
  }

  // ---------------------------------------------------------------- clicks
  document.addEventListener('click', (e) => {
    if (!G || !$('.cl')) return;
    if (e.target.closest('#modal-root') || e.target.closest('.cl-reveal')) return;
    const vb = e.target.closest('[data-view]');
    if (vb) {
      G.view = Number(vb.dataset.view);
      G.follow = G.mode === 'local' ? G.view === st().turn : G.follow;
      render();
      return;
    }
    const hb = e.target.closest('[data-hunt]');
    if (hb) return humanTurn() ? openHunt(Number(hb.dataset.hunt)) : showBeast(Number(hb.dataset.hunt));
    const lb = e.target.closest('[data-learn]');
    if (lb) {
      if (!lb.disabled && humanTurn()) openLearn(lb.dataset.learn);
      return;
    }
    const tb = e.target.closest('[data-tag]');
    if (tb) {
      if (humanTurn()) openTag(Number(tb.dataset.tag));
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === 'rules') return showRules();
    if (act === 'home') return leaveGame();
    if (act === 'scorecard') return showGameOver(true);
    if (!humanTurn()) return;
    if (act === 'market') return openMarket();
    if (act === 'hunt') return openHuntList();
    if (act === 'brew') return openBrew();
    if (act === 'visit') return openVisit();
    if (act === 'guild') return openGuild();
    if (act === 'learn') return openLearnList();
    if (act === 'wait') return openWait();
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
    const mark = s.log[s.log.length - 1];
    const coins = s.players.map((p) => p.coins);
    try {
      E.apply(s, pi, a);
    } catch (err) {
      toast(esc(err.message), 'bad');
      return;
    }
    if (a.t === 'tag') {
      save();
      render();
      return;
    }
    if (!actor.ai) G.moved = true;
    ui.moved = pi;
    const fresh = s.log.slice(s.log.lastIndexOf(mark) + 1);
    if (G.mode === 'local' && G.follow !== false && s.phase === 'act') G.view = s.turn;
    if (G.mode === 'ai' && !actor.ai) G.view = 0;
    save();
    render();
    const quiet = G.mode === 'sim' && G.speed === 'turbo';
    if (!quiet) {
      if (a.t === 'brew') sfx('grow');
      else if (a.t === 'hunt') sfx('stomp');
      else if (a.t === 'learn') sfx('card');
      else if (a.t === 'wait') sfx('turn');
      if (s.players.some((p, i) => p.coins < coins[i] && i === pi)) sfx('pay', 120);
      if (s.sold.length) sfx('coin', 260);
      tell(pi, a, fresh);
    }
    if (s.phase === 'over') return showGameOver(false);
    if (!quiet && s.report && s.report.days.length) return marketDaySplash(s.report.days);
    scheduleAI();
  }

  // What just happened, as toasts: the computer's move, sales, and customers coming and going at people's shops.
  function tell(pi, a, fresh) {
    const s = st();
    const actor = pl(pi);
    const humanShop = (i) => !pl(i).ai;
    if (actor.ai) {
      const line = fresh.find((l) => l.who === pi && !/^🔔|gave up|bought .* at /.test(l.text));
      if (line) toast(`<span class="dot" style="--pc:${PCOLOR[pi]}"></span>${esc(line.text)}`);
    }
    s.sold.forEach((x) => {
      if (x.to === 'folk' && (humanShop(x.who) || G.mode === 'sim')) toast(`💰 ${esc(E.FOLK[x.folk].name)} bought ${esc(E.POTION[x.k].name)} at ${shopName(x.who)} for <b>🪙${x.coins}</b>.`, 'good');
      if (x.to === 'rival' && humanShop(x.who) && pl(x.buyer).ai) toast(`🤝 ${shopName(x.buyer)} bought ${you(x.who) ? 'your' : `${esc(pl(x.who).name)}’s`} ${esc(E.POTION[x.k].name)} for <b>🪙${x.coins}</b>.`, 'good');
    });
    const r = s.report;
    if (!r) return;
    r.came.filter((c) => humanShop(c.who)).forEach((c) => toast(`🔔 ${esc(E.FOLK[c.o.who].name)} came into ${you(c.who) ? 'your shop' : shopName(c.who)} wanting ${E.wantText(c.o)}.`));
    r.left.filter((c) => humanShop(c.who)).forEach((c) => toast(`😤 ${esc(E.FOLK[c.o.who].name)} gave up waiting at ${you(c.who) ? 'your shop' : shopName(c.who)}.`, 'bad'));
    r.missed.filter((c) => humanShop(c.who)).forEach((c) => toast(`🚶 A customer saw the full queue at ${you(c.who) ? 'your shop' : shopName(c.who)} and walked on by.`, 'bad'));
  }

  function marketDaySplash(days) {
    const s = st();
    const blocks = days.map((r) => {
      const re = E.COMMONS.filter((k) => r.restock[k]).map((k) => `${tok(k)} +${r.restock[k]}`).join(' ');
      const lines = [];
      lines.push(`🛒 <b>The market restocks:</b> ${re || 'it was already full.'}`);
      if (r.guild.length) lines.push(`🏛️ <b>Guild prices recover</b> by 🪙${E.GUILD_RECOVER} for ${r.guild.map((k) => esc(E.POTION[k].name)).join(', ')}.`);
      if (r.beastOut) lines.push(`🐾 <b>The ${esc(E.ING[r.beastOut.k].beast)} wandered off</b> (the oldest sighting)${r.beastIn.length ? `, and ${r.beastIn.map((c) => `a ${c.n > 1 ? 'pair of ' : ''}${esc(E.ING[c.k].beast)}${c.n > 1 ? 's' : ''}`).join(' and ')} ${r.beastIn.length > 1 ? 'were' : 'was'} sighted` : ''}.`);
      if (r.libIn) lines.push(`📚 <b>The library swaps a recipe:</b> ${esc(E.POTION[r.libOut].name)} goes back on the pile and <b>${esc(E.POTION[r.libIn].name)}</b> (${E.TIER[E.tier(r.libIn)].name}) comes in.`);
      return `<div class="md-block"><h3>🔔 Market day ${r.day}</h3><ul class="tr-list">${lines.map((l) => `<li>${l}</li>`).join('')}</ul></div>`;
    }).join('');
    const back = openModal(`<div class="md-report"><div class="tr-turn"><span>The calendar reached day ${days[days.length - 1].day}</span><b>🛒 Market day!</b></div>${blocks}
      <p class="muted">Market days fall on days ${E.MARKET_DAYS.join(', ')}. ${s.market < E.MARKET_DAYS.length ? `The next one is day ${E.MARKET_DAYS[s.market]}.` : 'That was the last one before the Moon Fair.'}</p>
      <div class="btn-row" style="justify-content:center"><button class="btn big" data-close>Back to the lane</button></div></div>`, { cls: 'wide' });
    sfx('reveal');
    if (G.mode === 'sim') setTimeout(() => back.isConnected && closeModal(), G.speed === 'fast' ? 1800 : 5000);
  }

  // ---------------------------------------------------------------- action dialogs
  const go = (label, days, extra) => `<button class="btn big" id="go" ${extra || ''}>${label}${days ? ` <small class="go-days">· ${plural(days, 'day')}</small>` : ''}</button>`;
  const dayLine = (pi, days) => {
    const p = pl(pi);
    const to = Math.min(E.DAYS, p.pos + days);
    const bells = E.BELLS.filter((b) => b > p.pos && b <= to);
    const leaving = p.queue.filter((o) => o.leave < to);
    const bits = [`Your pawn moves from day ${p.pos} to <b>day ${to}</b>.`];
    if (bells.length) bits.push(`🔔 You pass ${bells.length > 1 ? `${bells.length} doorbells` : 'a doorbell'} (day ${bells.join(', ')}): ${bells.length > 1 ? 'customers come' : 'a customer comes'} in if your queue has room.`);
    if (leaving.length) bits.push(`<span class="warn">😤 ${leaving.map((o) => esc(E.FOLK[o.who].name)).join(' and ')} will give up and leave unless served first.</span>`);
    return `<div class="day-line">${bits.map((x) => `<p>${x}</p>`).join('')}</div>`;
  };

  function openMarket() {
    const s = st();
    const pi = s.turn;
    const p = pl(pi);
    const buy = {};
    const draw = () => {
      const n = E.COMMONS.reduce((t, k) => t + (buy[k] || 0), 0);
      const cost = E.marketCost(s, buy) || 0;
      const bag = Object.assign({}, p.pantry);
      E.COMMONS.forEach((k) => (bag[k] += buy[k] || 0));
      const could = E.POTION_ORDER.filter((k) => E.knows(p, k) && E.canBrew(p, k, bag));
      const rows = E.COMMONS.map((k) => {
        const have = buy[k] || 0;
        const sup = s.supply[k] - have;
        const next = sup > 0 ? E.LADDER[E.LADDER.length - sup] : null;
        const full = n >= E.MARKET_BUY || sup <= 0 || cost + (next || 0) > p.coins;
        return `<div class="buy-row">${tok(k)}<div><b>${esc(E.ING[k].name)}</b><small>${sup > 0 ? `next one 🪙${next} · ${s.supply[k]} in stock` : 'sold out'} · you have ${p.pantry[k]}</small></div>
          <div class="step"><button data-dn="${k}" ${have ? '' : 'disabled'} aria-label="One less">−</button><b>${have}</b><button data-up="${k}" ${full ? 'disabled' : ''} aria-label="One more">+</button></div></div>`;
      }).join('');
      return `<h2>🛒 Go to market</h2>
        <p class="muted">Buy up to ${E.MARKET_BUY} common ingredients. Each token costs what its space on the ladder says, so the more you take of one kind, the pricier it gets.</p>
        <div class="buy">${rows}</div>
        <div class="sum-line"><span>${n}/${E.MARKET_BUY} tokens</span><b>Total 🪙${cost}</b><span>You have 🪙${p.coins}</span></div>
        ${n ? `<p class="could">${could.length ? `With this you could brew: ${could.map((k) => `${bottle(k, 'sm')} ${esc(E.POTION[k].name)}`).join(', ')}` : 'Not enough yet for any recipe you know.'}</p>` : ''}
        ${dayLine(pi, 1)}
        <div class="btn-row">${go(n ? `Buy for 🪙${cost}` : 'Pick ingredients', 1, n ? '' : 'disabled')}</div>`;
    };
    const back = openModal('<div id="dlg"></div>', { onClose: () => {} });
    const root = back.querySelector('#dlg');
    root.innerHTML = draw();
    root.addEventListener('click', (e) => {
      const up = e.target.closest('[data-up]');
      const dn = e.target.closest('[data-dn]');
      if (up && !up.disabled) buy[up.dataset.up] = (buy[up.dataset.up] || 0) + 1;
      else if (dn && !dn.disabled) buy[dn.dataset.dn] = Math.max(0, (buy[dn.dataset.dn] || 0) - 1);
      else if (e.target.closest('#go')) {
        const clean = {};
        Object.keys(buy).forEach((k) => buy[k] > 0 && (clean[k] = buy[k]));
        closeModal(true);
        return doAction({ t: 'market', buy: clean });
      } else return;
      root.innerHTML = draw();
    });
  }

  function usesOf(part) {
    return E.POTION_ORDER.filter((k) => E.POTION[k].ing[part]);
  }
  function beastBody(c, pi) {
    const s = st();
    const d = E.beastDays(s, c);
    const p = pi == null ? null : pl(pi);
    const uses = usesOf(c.k).map((k) => {
      const mine = p && E.knows(p, k);
      const who = E.brewers(s, k).map((i) => SIGN[i]).join('');
      return `<li class="${mine ? 'mine' : ''}">${bottle(k, 'sm')} <b>${esc(E.POTION[k].name)}</b> ${stars(E.tier(k))} ${mine ? '<span class="own">you know it</span>' : who ? `<small>brewed by ${who}</small>` : E.tier(k) > 1 && s.library.includes(k) ? '<small>in the library</small>' : '<small>recipe not out yet</small>'}</li>`;
    }).join('');
    return `<div class="hunt-head">${beastPic(c.k)}<div><h2>🏹 The ${esc(E.ING[c.k].beast)}</h2>
      <p>Track it to ${esc(E.BEAST[c.k].where)}: <b>${plural(d, 'day')}</b>${d < c.days ? ' (the oldest sighting is a day quicker)' : ''}. Bring back <b>${c.n > 1 ? `two ${esc(E.ING[c.k].name.toLowerCase())}s` : `one ${esc(E.ING[c.k].name.toLowerCase())}`}</b> ${tok(c.k, c.n)}.</p></div></div>
      <h3>Used in</h3><ul class="uses">${uses}</ul>`;
  }
  function showBeast(id) {
    const c = st().beasts.find((x) => x.id === id);
    if (c) openModal(beastBody(c, null), { onClose: () => {} });
  }
  function openHunt(id) {
    const s = st();
    const pi = s.turn;
    const c = s.beasts.find((x) => x.id === id);
    if (!c) return;
    const back = openModal(`${beastBody(c, pi)}${dayLine(pi, E.beastDays(s, c))}<div class="btn-row">${go(`🏹 Go hunting`, E.beastDays(s, c))}</div>`, { onClose: () => {} });
    back.querySelector('#go').onclick = () => {
      closeModal(true);
      doAction({ t: 'hunt', c: id });
    };
  }
  function openHuntList() {
    const s = st();
    const back = openModal(`<h2>🏹 Go hunting</h2><p class="muted">Pick a sighting from the bestiary. Hunts cost days, not coins.</p>
      <div class="beasts">${s.beasts.map((c, i) => `<button class="beast" data-pick="${c.id}">${beastPic(c.k)}<span class="b-days">⏳ ${plural(E.beastDays(s, c), 'day')}</span>${i === 0 ? '<span class="b-old">🐾 −1 day</span>' : ''}<span class="b-name"><b>${esc(E.ING[c.k].beast)}</b><small>${c.n > 1 ? `${tok(c.k, 2)} a pair` : `${tok(c.k)} one`}</small></span></button>`).join('')}</div>`, { cls: 'wide', onClose: () => {} });
    back.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      closeModal(true);
      openHunt(Number(b.dataset.pick));
    });
  }

  function openBrew() {
    const s = st();
    const pi = s.turn;
    const p = pl(pi);
    const picks = [];
    const tags = [];
    const room = Math.min(E.BREW_MAX, E.SHELF - p.shelf.length);
    const left = () => {
      const bag = Object.assign({}, p.pantry);
      picks.forEach((k) => Object.keys(E.POTION[k].ing).forEach((i) => (bag[i] -= E.POTION[k].ing[i])));
      return bag;
    };
    const draw = () => {
      const bag = left();
      const list = E.POTION_ORDER.filter((k) => E.knows(p, k)).map((k) => {
        const ok = picks.length < room && E.canBrew(p, k, bag);
        const want = p.queue.filter((o) => E.suits(o, k));
        const missing = Object.keys(E.POTION[k].ing).filter((i) => bag[i] < E.POTION[k].ing[i]).map((i) => tok(i, E.POTION[k].ing[i] - Math.max(0, bag[i]))).join('');
        return `<button class="brew-opt${ok ? '' : ' no'}" data-pk="${k}" ${ok ? '' : 'disabled'}>${bottle(k)}<span><b>${esc(E.POTION[k].name)}</b><small>${stars(E.tier(k))} · ${toks(E.POTION[k].ing)}${want.length ? ` · 🔔 ${want.map((o) => esc(E.FOLK[o.who].name)).join(', ')} wants it` : ''}</small>${!ok && picks.length < room ? `<small class="warn">Missing ${missing}</small>` : ''}</span></button>`;
      }).join('');
      const chosen = picks.map((k, i) => {
        const buyer = p.queue.filter((o) => E.suits(o, k)).sort((a, b) => b.min - a.min)[0];
        const rivals = E.rivalWants(s, pi, k);
        const note = buyer
          ? `🔔 ${esc(E.FOLK[buyer.who].name)} buys it the moment it’s on your shelf, for 🪙${E.payFor(buyer, k)}. The tag doesn’t matter to your own customers.`
          : rivals.length ? `🏪 ${esc(pl(rivals[0].qi).name)}’s customer ${esc(E.FOLK[rivals[0].o.who].name)} would pay them 🪙${rivals[0].pay} — price it so they still profit.` : `The Guild pays 🪙${s.guild[k]} for it now. Rivals only buy when it helps them.`;
        return `<div class="chosen"><button class="x" data-rm="${i}" aria-label="Remove">✕</button>${bottle(k)}<div><b>${esc(E.POTION[k].name)}</b><small>${note}</small></div>
          <div class="step" title="Price tag: what a rival shop pays to buy it from your shelf"><span>🏷️</span><button data-tdn="${i}">−</button><b>🪙${tags[i]}</b><button data-tup="${i}">+</button></div></div>`;
      }).join('');
      return `<h2>⚗️ Brew</h2>
        <p class="muted">Brew 1 or 2 potions from your pantry. They go on your shelf with a price tag — what another shop pays to buy one. Your own waiting customers pay by quality (⭐), whatever the tag says.</p>
        <div class="brew-opts">${list}</div>
        ${picks.length ? `<h3>Into the cauldron</h3>${chosen}` : `<p class="empty">Pick ${room > 1 ? 'up to 2 potions' : 'a potion'} to brew${room < E.BREW_MAX ? ` (your shelf has room for ${room})` : ''}.</p>`}
        ${dayLine(pi, E.BREW_DAYS)}
        <div class="btn-row">${go(picks.length ? `⚗️ Brew ${picks.length > 1 ? 'both' : 'it'}` : 'Pick a potion', E.BREW_DAYS, picks.length ? '' : 'disabled')}</div>`;
    };
    const back = openModal('<div id="dlg"></div>', { cls: 'wide', onClose: () => {} });
    const root = back.querySelector('#dlg');
    root.innerHTML = draw();
    root.addEventListener('click', (e) => {
      const pk = e.target.closest('[data-pk]');
      const rm = e.target.closest('[data-rm]');
      const up = e.target.closest('[data-tup]');
      const dn = e.target.closest('[data-tdn]');
      if (pk && !pk.disabled) {
        picks.push(pk.dataset.pk);
        tags.push(E.suggestTag(s, pi, pk.dataset.pk));
      } else if (rm) {
        picks.splice(Number(rm.dataset.rm), 1);
        tags.splice(Number(rm.dataset.rm), 1);
      } else if (up) tags[up.dataset.tup] = Math.min(99, tags[up.dataset.tup] + 1);
      else if (dn) tags[dn.dataset.tdn] = Math.max(1, tags[dn.dataset.tdn] - 1);
      else if (e.target.closest('#go') && picks.length) {
        closeModal(true);
        return doAction({ t: 'brew', ks: picks.slice(), tags: tags.slice() });
      } else return;
      root.innerHTML = draw();
    });
  }

  function openVisit() {
    const s = st();
    const pi = s.turn;
    const p = pl(pi);
    const shops = s.players.map((_, i) => i).filter((i) => i !== pi);
    let from = shops.find((i) => pl(i).shelf.length) ?? shops[0];
    let picks = [];
    const room = Math.min(E.VISIT_MAX, E.SHELF - p.shelf.length);
    const draw = () => {
      const q = pl(from);
      const cost = picks.reduce((t, id) => t + q.shelf.find((x) => x.id === id).tag, 0);
      const tabs = `<div class="tabs">${shops.map((i) => `<button class="${i === from ? 'on' : ''}" style="--pc:${PCOLOR[i]}" data-from="${i}">${SIGN[i]} ${esc(pl(i).name)} <small>(${pl(i).shelf.length})</small></button>`).join('')}</div>`;
      const items = q.shelf.map((x) => {
        const on = picks.includes(x.id);
        const can = on || (picks.length < room && cost + x.tag <= p.coins);
        const buyer = p.queue.filter((o) => E.suits(o, x.k) && !p.shelf.some((y) => E.suits(o, y.k))).sort((a, b) => b.min - a.min)[0];
        const gain = buyer ? E.payFor(buyer, x.k) - x.tag : null;
        const note = buyer ? `🔔 ${esc(E.FOLK[buyer.who].name)} would pay you 🪙${E.payFor(buyer, x.k)}: <b class="${gain > 0 ? 'good' : 'bad'}">${gain >= 0 ? 'profit' : 'loss'} 🪙${Math.abs(gain)}</b>` : `None of your customers want it · Guild 🪙${s.guild[x.k]}`;
        return `<button class="visit-opt${on ? ' on' : ''}" data-buy="${x.id}" ${can ? '' : 'disabled'}>${bottle(x.k)}<span><b>${esc(E.POTION[x.k].name)}</b><small>${stars(E.tier(x.k))} ${E.NEED[E.POTION[x.k].need].icon} · ${note}</small></span><span class="price">🪙${x.tag}</span></button>`;
      }).join('') || '<p class="empty">Their shelf is empty.</p>';
      return `<h2>🏪 Shop at a rival</h2>
        <p class="muted">Buy up to ${E.VISIT_MAX} potions from one shop at their price tags. The coins go to them; the potions go straight onto your shelf, where your waiting customers snap them up.</p>
        ${tabs}<div class="visit-opts">${items}</div>
        <div class="sum-line"><span>${picks.length}/${room}</span><b>Total 🪙${cost}</b><span>You have 🪙${p.coins}</span></div>
        ${dayLine(pi, 1)}
        <div class="btn-row">${go(picks.length ? `Buy for 🪙${cost}` : 'Pick potions', 1, picks.length ? '' : 'disabled')}</div>`;
    };
    const back = openModal('<div id="dlg"></div>', { cls: 'wide', onClose: () => {} });
    const root = back.querySelector('#dlg');
    root.innerHTML = draw();
    root.addEventListener('click', (e) => {
      const f = e.target.closest('[data-from]');
      const b = e.target.closest('[data-buy]');
      if (f) {
        from = Number(f.dataset.from);
        picks = [];
      } else if (b && !b.disabled) {
        const id = Number(b.dataset.buy);
        picks = picks.includes(id) ? picks.filter((x) => x !== id) : picks.concat(id);
      } else if (e.target.closest('#go') && picks.length) {
        closeModal(true);
        return doAction({ t: 'visit', from, s: picks.slice() });
      } else return;
      root.innerHTML = draw();
    });
  }

  function openGuild() {
    const s = st();
    const pi = s.turn;
    const p = pl(pi);
    let picks = [];
    const draw = () => {
      const g = Object.assign({}, s.guild);
      const got = {};
      picks.forEach((id) => {
        const x = p.shelf.find((y) => y.id === id);
        got[id] = g[x.k];
        g[x.k] = Math.max(E.guildMin(x.k), g[x.k] - E.GUILD_DROP);
      });
      const total = Object.values(got).reduce((t, x) => t + x, 0);
      const items = p.shelf.map((x) => {
        const want = s.players.some((q, i) => i !== pi && q.queue.some((o) => E.suits(o, x.k))) || p.queue.some((o) => E.suits(o, x.k));
        return `<button class="visit-opt${picks.includes(x.id) ? ' on' : ''}" data-sell="${x.id}">${bottle(x.k)}<span><b>${esc(E.POTION[x.k].name)}</b><small>${stars(E.tier(x.k))} ${E.NEED[E.POTION[x.k].need].icon}${want ? ' · someone on the lane wants this' : ''}</small></span><span class="price">🪙${picks.includes(x.id) ? got[x.id] : s.guild[x.k]}</span></button>`;
      }).join('');
      return `<h2>🏛️ Sell to the Guild</h2>
        <p class="muted">The Guild buys any potions you like, at its posted price. Every sale knocks 🪙${E.GUILD_DROP} off that potion’s price, so a second one sells for less.</p>
        <div class="visit-opts">${items}</div>
        <div class="sum-line"><span>${plural(picks.length, 'potion')}</span><b>You get 🪙${total}</b></div>
        ${dayLine(pi, 1)}
        <div class="btn-row">${go(picks.length ? `Sell for 🪙${total}` : 'Pick potions', 1, picks.length ? '' : 'disabled')}</div>`;
    };
    const back = openModal('<div id="dlg"></div>', { onClose: () => {} });
    const root = back.querySelector('#dlg');
    root.innerHTML = draw();
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sell]');
      if (b) {
        const id = Number(b.dataset.sell);
        picks = picks.includes(id) ? picks.filter((x) => x !== id) : picks.concat(id);
      } else if (e.target.closest('#go') && picks.length) {
        closeModal(true);
        return doAction({ t: 'guild', s: picks.slice() });
      } else return;
      root.innerHTML = draw();
    });
  }

  function openLearn(k) {
    const s = st();
    const pi = s.turn;
    const p = pl(pi);
    const P = E.POTION[k];
    const cost = E.LEARN_COST[P.tier];
    const parts = Object.keys(P.ing).filter((i) => E.ING[i].kind === 'part');
    const sighted = parts.map((i) => `${tok(i)} ${s.beasts.some((c) => c.k === i) ? `<span class="good">${esc(E.ING[i].beast)} sighted now</span>` : `<span class="muted">no ${esc(E.ING[i].beast)} sighted yet</span>`}`).join('<br>');
    const fans = s.players.reduce((t, q) => t + q.queue.filter((o) => o.need === P.need && o.min <= P.tier).length, 0);
    const back = openModal(`<h2>📚 Buy a recipe</h2>${recipeCard(k)}
      <ul class="tr-list"><li>Costs <b>🪙${cost}</b> and a day. You have 🪙${p.coins}.</li>
      <li>Customers pay <b>🪙${E.TIER[P.tier].pay}+</b> for it, and the Guild 🪙${s.guild[k]}.</li>
      <li>Only your shop will be able to brew it. Right now ${plural(fans, 'customer')} on the lane would take it.</li>
      ${parts.length ? `<li>Needs creature parts:<br>${sighted}</li>` : ''}</ul>
      ${dayLine(pi, 1)}
      <div class="btn-row">${go(`Buy for 🪙${cost}`, 1, p.coins < cost ? 'disabled' : '')}</div>`, { onClose: () => {} });
    back.querySelector('#go').onclick = () => {
      closeModal(true);
      doAction({ t: 'learn', k });
    };
  }
  function openLearnList() {
    const s = st();
    const p = pl(s.turn);
    const back = openModal(`<h2>📚 Buy a recipe</h2><div class="rcps">${s.library.map((k) => recipeCard(k, `<button class="btn sm" data-pick="${k}" ${p.coins < E.LEARN_COST[E.tier(k)] ? 'disabled' : ''}>🪙${E.LEARN_COST[E.tier(k)]}</button>`)).join('')}</div>`, { onClose: () => {} });
    back.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]');
      if (!b || b.disabled) return;
      closeModal(true);
      openLearn(b.dataset.pick);
    });
  }

  function openWait() {
    const s = st();
    const pi = s.turn;
    const days = E.waitDays(s, pi);
    const back = openModal(`<h2>🧹 Mind the shop</h2>
      <p>Stay behind the counter and take walk-in trade: <b>🪙1 per day</b>. Your pawn moves to one day past the next pawn ahead, so you go after them.</p>
      ${dayLine(pi, days)}
      <div class="btn-row">${go(`🧹 Mind the shop (+🪙${days})`, days)}</div>`, { onClose: () => {} });
    back.querySelector('#go').onclick = () => {
      closeModal(true);
      doAction({ t: 'wait' });
    };
  }

  function openTag(id) {
    const s = st();
    const pi = s.turn;
    const p = pl(pi);
    const x = p.shelf.find((y) => y.id === id);
    if (!x) return;
    let tag = x.tag;
    const rivals = E.rivalWants(s, pi, x.k);
    const draw = () => `<h2>🏷️ Price tag</h2>${recipeCard(x.k)}
      <p class="muted">The tag is what another shop pays to buy this potion from your shelf. Changing it is free and doesn’t use any days. Your own customers always pay by quality instead.</p>
      <ul class="tr-list">${rivals.length ? rivals.slice(0, 3).map((r) => `<li>${esc(E.FOLK[r.o.who].name)} at ${shopName(r.qi)} would pay them 🪙${r.pay}.</li>`).join('') : '<li>No customer at another shop wants it right now.</li>'}
      <li>The Guild would pay you 🪙${s.guild[x.k]} for it.</li></ul>
      <div class="step big"><button data-tdn aria-label="Lower">−</button><b>🪙${tag}</b><button data-tup aria-label="Raise">+</button></div>
      <div class="btn-row"><button class="btn big" id="go">Set the tag</button></div>`;
    const back = openModal('<div id="dlg"></div>', { onClose: () => {} });
    const root = back.querySelector('#dlg');
    root.innerHTML = draw();
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-tup]')) tag = Math.min(99, tag + 1);
      else if (e.target.closest('[data-tdn]')) tag = Math.max(1, tag - 1);
      else if (e.target.closest('#go')) {
        closeModal(true);
        return doAction({ t: 'tag', s: id, tag });
      } else return;
      root.innerHTML = draw();
    });
  }

  // ---------------------------------------------------------------- computer turns
  function stopAI() {
    clearTimeout(ui.aiTimer);
    ui.aiTimer = null;
  }
  function scheduleAI() {
    stopAI();
    if (!G || ui.modal || st().phase !== 'act' || !pl(st().turn).ai) return;
    const wait = G.mode === 'sim' ? SIM_SPEEDS[G.speed].ai : 750;
    ui.aiTimer = setTimeout(aiStep, wait);
  }
  function aiStep() {
    if (!G || ui.modal || st().phase !== 'act') return;
    const pi = st().turn;
    if (!pl(pi).ai) return;
    const level = G.mode === 'sim' ? G.levels[pi] : pl(pi).level || G.level;
    doAction(E.aiChoose(st(), pi, level));
  }

  // ---------------------------------------------------------------- game over
  const SCORE_ROWS = [
    ['😊 Customers served', 'served'],
    ['💰 From customers', 'custCoins'],
    ['🤝 Sold to other shops', 'rivalCoins'],
    ['🏛️ Guild & Moon Fair', 'guildCoins'],
    ['🧹 Minding the shop', 'walk'],
    ['🛒 Spent', 'spent'],
    ['🪙 Started with', 'start'],
  ];
  function showGameOver(instant) {
    const s = st();
    const n = s.players.length;
    const sc = s.players.map((p) => E.score(s, p));
    const w = E.winner(s);
    const order = E.ranking(s);
    if (G.mode === 'ai' || G.mode === 'local') recordGame();
    let head;
    if (w < 0) head = '🤝 A tie for the richest shop!';
    else if (G.mode === 'ai') head = w === 0 ? '🏆 Your shop wins!' : `🌕 ${esc(pl(w).name)} wins!`;
    else head = `🏆 ${esc(pl(w).name)} wins!`;
    const top = sc[order[0]].coins;
    const second = n > 1 ? sc[order[1]].coins : top;
    const margin = top - second;
    const sub = w < 0 ? 'Same coins and the same number of customers served.' : margin === 0 ? 'Level on coins — won on customers served!' : margin <= 3 ? `By just 🪙${margin}!` : `By 🪙${margin}.`;
    const place = (i) => order.indexOf(i) + 1;
    const side = (i) => `<div class="hr-side" style="--pc:${PCOLOR[i]}"><span class="hr-crown">👑</span><span class="hr-sign">${SIGN[i]}</span><b class="hr-name">${esc(pl(i).name)}</b><span class="hr-total">?</span><small class="hr-place">${['1st', '2nd', '3rd', '4th'][place(i) - 1]} · 😊 ${sc[i].served}</small></div>`;
    const lead = (k, i) => {
      const vals = sc.map((x) => x[k]);
      const best = k === 'spent' || k === 'start' ? null : Math.max(...vals);
      return best != null && vals[i] === best && vals.filter((x) => x === best).length === 1;
    };
    document.querySelectorAll('.cl-reveal').forEach((x) => x.remove());
    const el = document.createElement('div');
    el.className = 'cl-reveal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Final results');
    el.innerHTML = `<div class="hr-rays"></div><div class="hr-stage">
        <div class="hr-title">🌕 The Moon Fair</div>
        <div class="hr-shops n${n}">${s.players.map((_, i) => side(i)).join('')}</div>
        <div class="hr-verdict" aria-live="polite"></div>
        <div class="hr-sub">${sub}</div>
        <div class="hr-rows" style="--n:${n}">${SCORE_ROWS.map(([label, k]) => `<div class="hr-row"><small>${label}</small>${sc.map((x, i) => `<span class="${lead(k, i) ? 'lead' : ''}" style="--pc:${PCOLOR[i]}">${k === 'spent' && x[k] ? '−' : ''}${x[k]}</span>`).join('')}</div>`).join('')}</div>
        <div class="hr-actions"><button class="btn" data-rv="close">⚗️ See the lane</button>${G.mode === 'past' ? '' : `<button class="btn" data-rv="again">${G.mode === 'sim' ? '🧪 Run again' : '⚗️ Play again'}</button>`}${G.mode === 'sim' ? '' : '<button class="btn ghost" data-rv="hist">🏆 Game history</button>'}<a class="btn ghost" href="/board-games.html"><img class="gh-dice" src="/img/board-games-favicon-48.png?v=2" alt=""> All board games</a></div>
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
      sides.forEach((x, i) => x.classList.add(w < 0 ? (place(i) === 1 || sc[i].coins === top ? 'tie' : 'lose') : i === w ? 'win' : 'lose'));
      el.querySelector('.hr-verdict').innerHTML = `<div class="hr-head">${head}</div>`;
      el.querySelectorAll('.hr-total').forEach((t, i) => (t.textContent = `🪙${sc[i].coins}`));
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
    // Drumroll, then the winner, then the ledger row by row.
    at(1300, () => {
      el.classList.add('suspense');
      el.querySelector('.hr-verdict').innerHTML = '<div class="hr-drum">The Guild counts the coins<i>.</i><i>.</i><i>.</i></div>';
    });
    at(3500, announce);
    SCORE_ROWS.forEach((_, i) => at(5200 + i * 450, () => el.querySelectorAll('.hr-row')[i].classList.add('in')));
    at(5200 + SCORE_ROWS.length * 450 + 400, finish);
  }

  function confetti() {
    const box = document.createElement('div');
    box.className = 'confetti';
    const bits = ['🎉', '🪙', '🧪', '✨', '🌕', '⚗️'];
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
    return 'cl' + [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  function recordGame() {
    const g = G;
    if (g.recorded || !sessionId()) return;
    const s = g.state;
    g.gid = g.gid || newLocalId();
    g.recorded = true;
    save();
    api('/api/cauldron/history/record', {
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
    const r = await api(`/api/cauldron/history/board?id=${encodeURIComponent(id)}`);
    const state = r.ok && r.data && r.data.state;
    if (!state || !Array.isArray(state.players) || state.phase !== 'over') return toast(esc((r.data && r.data.error) || 'Couldn’t load that game.'), 'bad');
    if (state.v !== E.SAVE_V) return toast('That game was played on an older version of the lane, so it can’t be shown.', 'bad');
    const h = (hist.items || []).find((x) => x.id === id);
    startFrom({ state, mode: 'past', level: h && h.level, view: 0, gid: id, revealed: true });
  }

  const hist = { items: null, kind: 'all' };
  const HIST_ROWS = [['🪙 Coins', 'coins'], ['😊 Served', 'served'], ['💰 From customers', 'custCoins'], ['🤝 Sold to shops', 'rivalCoins'], ['🏛️ Guild & Fair', 'guildCoins'], ['🛒 Spent', 'spent']];

  async function showHistory() {
    stopAI();
    G = null;
    document.body.className = 'setup-mode';
    $('#app').innerHTML = `
      <div class="setup gh">
      <div class="gh-top"><a class="gh-lobby" href="/board-games.html" title="Back to the game lobby">← <img class="gh-dice" src="/img/board-games-favicon-48.png?v=2" alt="" width="20" height="20"> Game lobby</a><button class="btn ghost sm" id="hist-new">⚗️ New game</button></div>
        <div class="setup-card gh-card panel hist">
          <h2>🏆 Game history</h2>
          <div id="hist-body"><p class="muted">Loading your games…</p></div>
        </div>
    </div>`;
    $('#hist-new').onclick = () => showSetup();
    const r = await api('/api/cauldron/history');
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
    const myScores = mine.map((h) => h.cats[h.me].coins);
    const stat = (n, label) => `<div class="hs"><b>${n}</b><small>${label}</small></div>`;
    const kinds = { all: 'All', ai: '🤖 Computer', local: '👥 Same device' };
    const icon = { ai: '🤖', local: '👥' };
    const row = (h) => {
      let res;
      if (h.me != null) res = h.winner < 0 ? '<span class="hg-res tie">Tie</span>' : h.winner === h.me ? '<span class="hg-res win">Win</span>' : '<span class="hg-res loss">Loss</span>';
      else res = h.winner < 0 ? '<span class="hg-res tie">Tie</span>' : `<span class="hg-res">${esc(h.names[h.winner])} won</span>`;
      const when = new Date(h.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const what = [h.kind === 'ai' ? `vs ${plural(h.names.length - 1, 'computer shop')}${h.level ? ' · ' + LEVEL_NAME[h.level] : ''}` : `${h.names.length} players, one device`, when].join(' · ');
      const line = h.names.map((nm, i) => `${esc(nm)} <em>${h.cats ? '🪙' + h.cats[i].coins : '–'}</em>`).join(' · ');
      const table = h.cats ? `<div class="hg-table" style="--n:${h.names.length}"><div class="hg-names"><small></small>${h.names.map((nm, i) => `<b style="--pc:${PCOLOR[i]}">${esc(nm)}</b>`).join('')}</div>${HIST_ROWS.map(([label, k]) => `<div><small>${label}</small>${h.cats.map((c) => `<span>${c[k] || 0}</span>`).join('')}</div>`).join('')}</div>` : '';
      const view = `<div class="hg-view"><button class="btn sm" data-past="${esc(h.id)}">⚗️ View the lane</button></div>`;
      return `<details class="hg"><summary><span class="hg-icon">${icon[h.kind] || '⚗️'}</span><span class="hg-main"><b>${line}</b><small>${esc(what)}</small></span>${res}</summary>${table}${view}</details>`;
    };
    box.innerHTML = `
      <div class="seg hist-kind">${Object.keys(kinds).map((k) => `<button data-k="${k}" class="${hist.kind === k ? 'on' : ''}">${kinds[k]}</button>`).join('')}</div>
      <div class="hist-stats">
        ${stat(items.length, 'played')}${stat(wins, 'won')}${stat(mine.length - wins - ties, 'lost')}${stat(ties, 'tied')}
        ${stat(myScores.length ? '🪙' + Math.max(...myScores) : '–', 'best')}
        ${stat(myScores.length ? '🪙' + Math.round(myScores.reduce((t, x) => t + x, 0) / myScores.length) : '–', 'average')}
      </div>
      ${items.length ? `<div class="hist-list">${items.map(row).join('')}</div>` : '<p class="muted hist-empty">No finished games yet. Games are added when the Moon Fair ends.</p>'}
      <p class="muted hist-note">Wins and coins count your games against the computer. Tap a game to see where the money came from.</p>`;
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
    const sim = Object.assign({ shops: 3, levels: ['hard', 'normal', 'easy', 'normal'], speed: 'fast' }, prefs().sim);
    const speeds = {};
    Object.keys(SIM_SPEEDS).forEach((k) => (speeds[k] = SIM_SPEEDS[k].name));
    const draw = () => `<h2>🧪 Computer vs computer</h2>
      <p class="muted">Admin only. Computer shops play a whole game while you watch. Nothing is saved or added to game history.</p>
      <div class="field"><span class="label">Shops</span><div class="seg" data-k="shops">${[2, 3, 4].map((n) => `<button data-v="${n}" class="${sim.shops === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      ${Array.from({ length: sim.shops }, (_, i) => `<div class="field"><span class="label" style="color:${PCOLOR[i]}">${SIGN[i]} ${esc(SHOP_NAMES[i])}</span><div class="seg" data-k="l${i}">${Object.keys(LEVEL_NAME).map((l) => `<button data-v="${l}" class="${sim.levels[i] === l ? 'on' : ''}">${LEVEL_NAME[l]}</button>`).join('')}</div></div>`).join('')}
      <div class="field"><span class="label">Speed</span><div class="seg" data-k="speed">${Object.keys(speeds).map((v) => `<button data-v="${v}" class="${sim.speed === v ? 'on' : ''}">${speeds[v]}</button>`).join('')}</div></div>
      <button class="btn big" id="sim-go">▶ Start</button>`;
    const back = openModal('<div id="dlg"></div>', { onClose: () => {} });
    const root = back.querySelector('#dlg');
    root.innerHTML = draw();
    root.addEventListener('click', (e) => {
      const b = e.target.closest('.seg button');
      if (b) {
        const k = b.parentNode.dataset.k;
        if (k === 'shops') sim.shops = Number(b.dataset.v);
        else if (k === 'speed') sim.speed = b.dataset.v;
        else sim.levels[Number(k.slice(1))] = b.dataset.v;
        root.innerHTML = draw();
        return;
      }
      if (e.target.closest('#sim-go')) {
        savePrefs(Object.assign(prefs(), { sim }));
        startSim({ levels: sim.levels.slice(0, sim.shops), speed: sim.speed });
      }
    });
  }
  function startSim(sim) {
    closeModal(true);
    const n = sim.levels.length;
    const state = E.newGame({ names: sim.levels.map((l, i) => `${SHOP_NAMES[i]}`), ai: sim.levels.map(() => true), levels: sim.levels, first: Math.floor(Math.random() * n) });
    sim.levels.forEach((l, i) => E.aiHeadStart(state, i, l));
    startFrom({ state, mode: 'sim', level: sim.levels[0], levels: sim.levels, speed: sim.speed, view: 0 });
  }
  function stopSim() {
    stopAI();
    closeModal(true);
    document.querySelectorAll('.cl-reveal').forEach((x) => x.remove());
    showSetup();
  }

  // ---------------------------------------------------------------- rules
  const RULE_CHAPTERS = [
    ['overview', 'Overview'],
    ['setup', 'Setting up'],
    ['calendar', 'The calendar'],
    ['actions', 'Your actions'],
    ['selling', 'Customers & selling'],
    ['making', 'Ingredients, creatures & recipes'],
    ['score', 'The Moon Fair & winning'],
    ['terms', 'Quick reference'],
  ];
  function rulesBody(tab) {
    const n = RULE_CHAPTERS.findIndex((c) => c[0] === tab) + 1;
    const sec = (i, title) => `<h4 class="rb-sec"><span>${n}.${i}</span> ${title}</h4>`;
    const head = `<h3 class="rb-ch"><small>Chapter ${n}</small>${RULE_CHAPTERS[n - 1][1]}</h3>`;
    const T = E.TIER;
    let body = '';
    if (tab === 'overview') {
      body = `${sec(1, 'The story')}
        <p>Every shop on Cauldron Lane sells potions, and the Moon Fair is ${E.DAYS} days away. You buy herbs and crystals at the market, hunt griffins, mermaids and dragons for rare parts, brew potions and sell them — to the townsfolk who come through your door, and to the <b>rival shops next door</b> when they’re short of something their own customers want.</p>
        ${sec(2, 'How to win')}
        <p>When every shop reaches the Moon Fair, the shop with the <b>most coins</b> wins. If coins are tied, the shop that served more customers wins.</p>
        ${sec(3, 'What’s in the box')}
        <ul><li>📅 <b>The calendar</b> — a track of ${E.DAYS + 1} spaces (day 0 to the Moon Fair) with one pawn per shop.</li>
        <li>🛒 <b>The market board</b> — a price ladder for each of the 4 common ingredients, with ingredient tokens on it.</li>
        <li>🐾 <b>Creature cards</b> — ${E.PARTS.length} beasts, 3 sightings each; ${E.BESTIARY} are face up in the bestiary.</li>
        <li>📚 <b>Recipe cards</b> — 4 common recipes everyone knows, and ${E.POTION_ORDER.length - 4} rare, mythic and legendary ones that exist once each; ${E.LIBRARY} are face up in the library.</li>
        <li>🧑‍🤝‍🧑 <b>Townsfolk cards</b> — the customers. Each wants one kind of potion, sometimes of a certain quality.</li>
        <li>🏪 <b>A shop mat for each player</b> — a 3-spot queue, a ${E.SHELF}-slot shelf with price tags, and a pantry.</li>
        <li>🏛️ <b>The Guild board</b> — what the Guild pays for each potion, with price markers.</li>
        <li>🪙 Coins. <b>No dice</b> — nothing in this game is left to a roll.</li></ul>
        ${sec(4, 'The game in one paragraph')}
        <p>There are no rounds. Every action costs days, and you move your pawn that far along the calendar. <b>Whoever is furthest behind always moves next</b>, so a long hunt now means watching your rivals take several turns before you go again. Customers walk in when your pawn passes a 🔔 doorbell and wait a few days; put a potion that suits them on your shelf and they buy it at once. Price your shelf for the other shops too — when their customers want something only you can brew, they have to come to you.</p>`;
    } else if (tab === 'setup') {
      body = `${sec(1, 'The boards')}
        <ul><li>Put ${E.SUPPLY_START} tokens of each common ingredient on the market ladders, filling the dearest spaces first.</li>
        <li>Set every Guild price marker to its usual price (${[1, 2, 3, 4].map((t) => `${T[t].name} 🪙${T[t].guild}`).join(', ')}).</li>
        <li>Shuffle the creature cards and lay ${E.BESTIARY} face up in a row: the bestiary.</li>
        <li>Shuffle the rare and mythic recipe cards and lay ${E.LIBRARY} face up: the library. The legendary recipes are shuffled into the lower part of the pile, so they turn up later.</li></ul>
        ${sec(2, 'Each shop starts with')}
        <ul><li>🪙 <b>${E.START_COINS} coins</b>, plus 🪙1 for each seat after the first player (later shops pick from a picked-over bestiary).</li>
        <li>📖 the 4 <b>common recipes</b>, and <b>one rare recipe of its own</b> — every shop gets a different one, for a different need where possible.</li>
        <li>🔔 <b>${E.START_CUSTOMERS} customers</b> already waiting, who’ll take any potion for their need.</li>
        <li>An empty shelf and pantry, and its pawn on day 0 of the calendar.</li></ul>
        ${sec(3, 'Who goes first')}
        <p>All pawns start stacked on day 0. Stack them so the first player’s pawn is on top: <b>on a shared space, the pawn on top moves first</b>.</p>
        ${sec(4, 'Playing the computer')}
        <p>Play against 1 to 3 computer shops. A <b>Hard</b> computer opens with 🪙3 extra and a <b>Brutal</b> one with 🪙6 extra.</p>`;
    } else if (tab === 'calendar') {
      body = `${sec(1, 'No rounds — just days')}
        <p>Every action costs a number of days (shown on its button). When you take it, move your pawn that many spaces along the calendar. Then <b>the pawn furthest behind moves next</b> — which might be you again.</p>
        <p class="rb-ex">Red is on day 5 and goes hunting the dragon: 4 days, to day 9. Blue is on day 6 and Green on day 7, so Blue moves, then whoever is further behind after that — Red won’t move again until everyone else has passed day 9.</p>
        ${sec(2, 'Sharing a space')}
        <p>If two pawns are on the same day, the one that <b>arrived last</b> goes on top of the stack and <b>moves first</b>.</p>
        ${sec(3, '🔔 Doorbells')}
        <p>Every even day from 2 to ${E.BELLS[E.BELLS.length - 1]} has a doorbell. Each time <b>your</b> pawn passes or lands on one, draw a townsfolk card: a customer comes into your shop and joins your queue. If your queue already has ${E.QUEUE} customers, they look in, see the line, and <b>walk on by</b>.</p>
        ${sec(4, '🛒 Market days')}
        <p>Days ${E.MARKET_DAYS.join(', ')} are market days. The moment the <b>rearmost pawn</b> reaches one (so the whole lane has got there):</p>
        <ol class="rb-flow"><li>Each common ingredient gets ${E.restock({ players: [1, 2] })}–${E.restock({ players: [1, 2, 3, 4] })} tokens back (2 plus 1 per shop), up to a full ladder.</li>
        <li>Every Guild price below its usual price goes up 🪙${E.GUILD_RECOVER}.</li>
        <li>The oldest creature sighting leaves and a new one is drawn.</li>
        <li>The oldest recipe in the library goes to the bottom of the pile and a new one comes in.</li></ol>
        ${sec(5, '🌕 The Moon Fair')}
        <p>Day ${E.DAYS} is the Moon Fair. An action can carry you to it but never past it. Once your pawn is there you’re done; the others keep going until every pawn has arrived. Then the Fair is held (chapter 7).</p>`;
    } else if (tab === 'actions') {
      body = `<p>On your move, take <b>one</b> action and move your pawn.</p>
        ${sec(1, '🛒 Go to market — 1 day')}
        <p>Buy up to ${E.MARKET_BUY} common ingredient tokens. Each costs the price printed under it on the ladder, taking the cheapest token first (chapter 6).</p>
        ${sec(2, '🏹 Go hunting — the card’s days')}
        <p>Take a creature card from the bestiary and gain its part (or pair of parts). A hunt costs the days on the card: 2 to 4 depending on the beast, a day more for a pair sighting, and a day less for the oldest card in the row (the leftmost). Draw a new card into the row.</p>
        ${sec(3, `⚗️ Brew — ${E.BREW_DAYS} days`)}
        <p>Brew 1 or ${E.BREW_MAX} potions whose recipes you know, paying their ingredients from your pantry, and put them on your shelf with a <b>price tag</b> each. Your shelf holds ${E.SHELF}.</p>
        ${sec(4, '🏪 Shop at a rival — 1 day')}
        <p>Buy 1 or ${E.VISIT_MAX} potions from one other shop’s shelf, paying the price on their tags to that shop. They go on your shelf, where your own customers can buy them.</p>
        ${sec(5, '🏛️ Sell to the Guild — 1 day')}
        <p>Sell any number of potions from your shelf to the Guild at its posted prices. Each sale lowers that potion’s Guild price by 🪙${E.GUILD_DROP} (never more than 🪙${E.GUILD_FLOOR} below usual).</p>
        ${sec(6, '📚 Buy a recipe — 1 day')}
        <p>Pay for a recipe card in the library (Rare 🪙${E.LEARN_COST[2]}, Mythic 🪙${E.LEARN_COST[3]}, Legendary 🪙${E.LEARN_COST[4]}) and add it to your recipe book. Nobody else can ever brew it. A new card fills the library.</p>
        ${sec(7, '🧹 Mind the shop — until you pass the next pawn')}
        <p>Move your pawn to <b>one day past the next pawn ahead</b> of you and take 🪙1 of walk-in trade per day moved. Use it when there’s nothing worth doing — or to wait for a market day.</p>
        ${sec(8, '🏷️ Free: change a price tag')}
        <p>Before your action, you may change any of your price tags. It costs nothing and doesn’t move your pawn.</p>`;
    } else if (tab === 'selling') {
      body = `${sec(1, 'Customers')}
        <p>Each townsfolk card shows a <b>need</b> — ❤️ Healing, 🛡️ Protection, 🧭 Travel or ✨ Charm & mischief — and sometimes a <b>minimum quality</b> (“Rare or better”). They pay by the quality of the potion they get, not by your tag:</p>
        <table><tr><th>Potion quality</th><th>Customer pays</th><th>Guild pays (usual)</th></tr>${[1, 2, 3, 4].map((t) => `<tr><td>${stars(t)} ${T[t].name}</td><td>🪙${T[t].pay} + the customer’s tip (0–2)</td><td>🪙${T[t].guild}</td></tr>`).join('')}</table>
        ${sec(2, 'Patience')}
        <p>Each customer waits until a day written on their card (${E.PATIENCE[0]}–${E.PATIENCE[1]} days after arriving). When <b>your pawn</b> moves past that day, they give up and leave.</p>
        ${sec(3, 'Sales happen by themselves')}
        <p>Whenever a potion that suits a waiting customer is on your shelf — after you brew, after you buy from a rival, or the moment a customer walks in — <b>they buy it at once</b>. The pickiest customer buys first, and each takes the most ordinary potion that will do.</p>
        ${sec(4, 'Selling to other shops')}
        <p>Your price tags are for the other shops. When a rival has a customer you can serve and they can’t, they may <b>shop at your shelf</b> (an action on their move) and pay your tag. Price it below what their customer pays them, or they won’t buy — above it, and you leave money on the table. Rare and better recipes exist once each, so whoever holds one is the only place on the lane to get that potion.</p>
        <p class="rb-ex">Blue has Lady Vane waiting for a Rare charm potion, but only you know the Invisibility Draught. She’ll pay Blue 🪙${T[3].pay}. You tag yours at 🪙${T[3].pay - 4}: Blue makes 🪙4, and you make 🪙${T[3].pay - 4} without serving anyone.</p>
        ${sec(5, 'The Guild')}
        <p>The Guild buys anything as an action, but cheaply, and its prices sink as people sell to it. At the Moon Fair it buys every potion still on a shelf.</p>`;
    } else if (tab === 'making') {
      body = `${sec(1, 'Common ingredients')}
        <p>${E.COMMONS.map((k) => `${E.ING[k].icon} ${esc(E.ING[k].name)}`).join(', ')}. Each has its own price ladder: ${E.LADDER.map((x) => `🪙${x}`).join(' · ')}. Tokens fill the dearest spaces; you always take the cheapest one left, so a popular ingredient gets expensive fast until market day refills it.</p>
        ${sec(2, 'Creature parts')}
        <table><tr><th>Beast</th><th>Part</th><th>Hunt</th><th>Where</th></tr>${E.PARTS.map((k) => `<tr><td><img class="rb-face" src="${IMG('beast-' + k)}" alt="" width="30" height="30" loading="lazy"> ${esc(E.ING[k].beast)}</td><td>${E.ING[k].icon} ${esc(E.ING[k].name)}</td><td>${plural(E.BEAST[k].days, 'day')} (pair +1)</td><td>${esc(E.BEAST[k].where)}</td></tr>`).join('')}</table>
        ${sec(3, 'Recipes')}
        <table><tr><th>Potion</th><th>Quality</th><th>For</th><th>Ingredients</th></tr>${E.POTION_ORDER.map((k) => `<tr><td>${bottle(k, 'sm')} ${esc(E.POTION[k].name)}</td><td>${stars(E.tier(k))}</td><td>${E.NEED[E.POTION[k].need].icon}</td><td>${toks(E.POTION[k].ing)}</td></tr>`).join('')}</table>
        <p>The ${stars(1)} common recipes are known by everyone. Every other recipe card exists once.</p>`;
    } else if (tab === 'score') {
      body = `${sec(1, 'The Moon Fair')}
        <p>When every pawn has reached day ${E.DAYS}, the Guild buys <b>every potion still on every shelf</b> at its current prices (dropping 🪙${E.GUILD_DROP} after each sale, as usual). Customers still waiting go home.</p>
        ${sec(2, 'Winning')}
        <p>The shop with the most coins wins. Ties go to the shop that served the most customers. Ingredients, parts and recipes are worth nothing at the end — spend them before the Fair.</p>
        ${sec(3, 'The final ledger')}
        <p>The results show where every shop’s money came from: customers, sales to other shops, the Guild and the Fair, minding the shop, and what it spent.</p>`;
    } else {
      const terms = [
        ['Day', 'A space on the calendar. Every action costs days.'],
        ['Rearmost pawn', `The pawn furthest back. It always moves next; “today” is wherever it stands.`],
        ['Doorbell 🔔', 'Even days 2–26. Your pawn passing one brings a customer into your shop.'],
        ['Queue', `Up to ${E.QUEUE} customers wait at each shop.`],
        ['Need', 'The kind of potion a customer wants.'],
        ['Quality ★', 'Common, Rare, Mythic or Legendary. Customers pay by quality.'],
        ['Price tag', 'What another shop pays to buy a potion from your shelf.'],
        ['Market day 🛒', `Days ${E.MARKET_DAYS.join(', ')}: restock, Guild recovery, new sightings and a new library recipe.`],
        ['Mind the shop', '🪙1 a day until you pass the next pawn ahead.'],
        ['Moon Fair 🌕', `Day ${E.DAYS}. Shelves are sold to the Guild and the richest shop wins.`],
      ];
      body = `${sec(1, 'Your move, in short')}
        <ol class="rb-flow"><li>Optionally change price tags (free).</li><li>Take one action: market, hunt, brew, shop at a rival, Guild, buy a recipe or mind the shop.</li><li>Move your pawn that many days. Customers arrive at doorbells and leave if you pass their day.</li><li>Whoever is furthest back goes next.</li></ol>
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
    const back = openModal(`<h2>📜 Cauldron Lane — Rulebook</h2>
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
      window.BoardSaves.load('cauldron', localId).then((g) => {
        if (validSave(g) && g.state.phase !== 'over') startFrom(g);
        else {
          showSetup();
          toast('That game couldn’t be found — it may have finished or been removed.', 'bad');
        }
      });
    } else showSetup();
  } else showSetup();
  window.__cl = { get G() { return G; }, render, E, send: (a) => doAction(a) };
})();
