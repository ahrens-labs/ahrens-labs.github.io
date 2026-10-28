// Atlantis Expedition — page UI. Rules live in atlantis-engine.js.
(function () {
  'use strict';
  const E = window.AtlantisEngine;
  const SAVE_KEY = 'ahrensAtlantis.v1';
  const PREFS_KEY = 'ahrensAtlantis.prefs';
  const ADMIN_EMAIL = 'calebahrens2011@gmail.com';
  const API_BASE = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
  const LEVEL_NAME = { easy: 'Easy', normal: 'Normal', hard: 'Hard', brutal: 'Brutal' };
  const LEVEL_HINT = {
    easy: 'Takes wild risks and picks crews carelessly.',
    normal: 'A fair game.',
    hard: 'Picks its crews carefully, races you for the expeditions you want, and starts with 🪙3 extra.',
    brutal: 'Its best play, plus a Barracuda, an extra diver and 🪙4 to start.',
  };
  const SIM_SPEEDS = {
    turbo: { name: '⚡ Turbo', ai: 0, roll: 0 },
    fast: { name: '⏩ Fast', ai: 250, roll: 1400 },
    watch: { name: '👀 Watch', ai: 900, roll: 3200 },
  };
  const IMG = (k) => `/img/atlantis/${k}.webp`;
  const PCOLOR = ['#e05a4f', '#3f8fd8'];
  const FLAG = ['⚓', '🔱'];
  const ROLE_ICON = {
    rookie: '🤿', wrangler: '🦈', freediver: '🫧', caver: '🧗', rider: '🏄', lamplighter: '🏮', archaeologist: '🧭', veteran: '🎖️',
    deepdiver: '🌌', hunter: '💰', stormdiver: '⛈️', krakenhunter: '🔱', captain: '🧑‍✈️', professor: '🎓',
  };
  const DEPTH_IMG = { 1: 'depth-1', 2: 'depth-2', 3: 'depth-3' };
  // What each sea forecast does, in plain words.
  const SEA_PLAIN = {
    calm: 'Every dive roll gets +1.',
    clear: '🌑 Darkness can’t hurt anyone, so no lamplighter or floodlights are needed.',
    frenzy: 'A 🦈 Sharks hazard nobody is ready for costs −6 on the roll instead of −3.',
    riptide: 'A 🌀 Currents hazard nobody is ready for costs −6 on the roll instead of −3.',
    storm: 'Minnows must stay in port and can’t dive or salvage. Bigger subs and swimmers can still go out.',
    bloom: 'A 🌑 Darkness hazard nobody is ready for costs −6 on the roll instead of −3.',
    rumors: 'Every successful dive finds 2 extra pearls.',
    gala: 'Every company gets 🪙3 extra at the start of the tide.',
    stirs: 'A 🐙 Kraken hazard nobody is ready for costs −6 on the roll instead of −3.',
    lowtide: 'Dives in the Shallows get +2.',
  };
  // What the die has to show, in words.
  const needText = (need) => (need <= 2 ? 'anything but a 1' : need >= 20 ? 'a 20' : `${need} or higher`);
  const dieTrack = (need, rolled) => `<div class="d20-track" aria-hidden="true">${Array.from({ length: 20 }, (_, i) => {
    const n = i + 1;
    const ok = n === 20 || (n !== 1 && n >= need);
    return `<i class="${ok ? 'ok' : 'no'}${rolled === n ? ' hit' : ''}">${n}</i>`;
  }).join('')}</div>`;
  // Pearls get their own drawn symbol; 🦪 marks the spot in the engine's log text and is swapped when shown.
  const PEARL = '<i class="pearl" role="img" aria-label="pearls"></i>';
  const pearls = (html) => String(html).replace(/🦪/g, PEARL);

  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const pct = (p) => `${Math.round(p * 100)}%`;
  const oddsColor = (p) => (p >= 0.7 ? '#1f9d55' : p >= 0.5 ? '#c99a12' : p >= 0.3 ? '#e07b28' : '#c0392b');

  let G = null; // { state, mode: 'ai' | 'local' | 'sim' | 'past', level, levels, speed, view, gid, recorded, revealed }
  const ui = { aiTimer: null, modal: false, onClose: null, busy: false, rulesTab: 'overview', lastTide: 0 };

  // ---------------------------------------------------------------- persistence
  function save() {
    if (!G || G.mode === 'sim' || G.mode === 'past' || G.mode === 'online') { if (G && G.mode === 'online') Online.rememberOnline(); return; }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(G));
    } catch (e) {
      /* storage full or blocked: the game still works, it just won't resume */
    }
    keepInSaves();
  }
  // Local games also go to the shared save list (Your games in the lobby, and the account), so several can be kept and resumed anywhere.
  const playerMoved = (s) => s.tide > 1 || s.log.some((l) => l && l.who != null && s.players[l.who] && !s.players[l.who].ai);
  function keepInSaves() {
    const BS = window.BoardSaves;
    if (!BS || !G || (G.mode !== 'ai' && G.mode !== 'local')) return;
    G.gid = G.gid || newLocalId();
    const s = G.state;
    if (s.phase === 'over') {
      if (BS.list('atlantis').some((m) => m.id === G.gid)) BS.remove('atlantis', G.gid);
      return;
    }
    if (!playerMoved(s)) return;
    BS.put('atlantis', G.gid, G, { mode: G.mode, level: G.level, names: s.players.map((p) => p.name), round: s.tide, rounds: E.TIDES, moved: true });
  }
  addEventListener('boardsaves:removed', (e) => {
    if (G && G.gid && e.detail.some((m) => m.game === 'atlantis' && m.id === G.gid)) toast('This game was removed from Your games on another device, so it won’t be saved any more.', 'warn');
  });
  const validSave = (g) => g && g.state && g.state.v === E.SAVE_V && (g.mode === 'ai' || g.mode === 'local');
  // 'removed' (deleted here or on another device), 'elsewhere' (played further on another device) or 'here'.
  const lastStatus = (gid) => (gid && window.BoardSaves ? window.BoardSaves.status('atlantis', gid) : 'here');
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
  // Admin testing: every dive a human sends rolls a natural 20. Games played this way stay out of history.
  const rig20On = () => isAdmin() && !!prefs().rig20;
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

  const Online = window.BoardOnline.attach({
    apiPrefix: '/api/atlantis',
    title: 'Atlantis Expedition',
    onlineKey: 'ahrensAtlantis.online',
    esc, toast, $, sessionId, prefs, savePrefs,
    blurb: 'Play Atlantis Expedition against another Ahrens Labs player — a quick game with a 2-minute turn clock, or a long game where you take your turn whenever you like.',
    roundText: (g) => (g.round ? `tide ${g.round} of ${E.TIDES}` : ''),
    getG: () => G,
    showSetup: (focus) => showSetup(focus),
    isMyTurn: () => G && G.state && G.state.turn === G.me,
    enterOnline: (v, mem) => {
      G = {
        mode: 'online', id: v.id, me: v.me, view: v.me, version: v.version, status: v.status, result: v.result,
        gmode: v.mode || 'long', deadline: v.deadline || null, skew: v.now ? v.now - Date.now() : 0,
        state: v.state, revealed: !!(mem && mem.revealed),
      };
      startFrom(G);
      if (G.status === 'over' && st().phase === 'over') showGameOver(true);
      else if (G.status === 'over' && !G.revealed) {
        G.revealed = true;
        openModal(`<h2>${G.result && G.result.winner === G.me ? '🏆 You win!' : '🏳️ Game over'}</h2><p>${esc(onlineEndText())}</p><div class="btn-row"><button class="btn" data-close>See the chart</button><button class="btn ghost" data-ol-lobby>Your games</button></div>`).addEventListener('click', (e) => {
          if (!e.target.closest('[data-ol-lobby]')) return;
          ui.onClose = null; closeModal(); Online.forgetOnline(); showSetup(G.id);
        });
      }
    },
    applyView: (v, fresh, mine) => {
      const prev = G.state;
      G.version = v.version;
      G.status = v.status;
      G.result = v.result;
      G.deadline = v.deadline || null;
      if (v.now) G.skew = v.now - Date.now();
      if (!v.state) { render(); return; }
      G.state = v.state;
      const s = v.state;
      const dive = s.last && s.last.t === 'dive' && fresh.some((l) => l.who === s.last.pi) ? s.last : null;
      if (mine) actionSfx(mine.t);
      render();
      if (G.gmode === 'quick' && G.status === 'active') Online.tickClock();
      if (!dive) [G.me, 1 - G.me].forEach((pi) => tellMove(pi, fresh, prev.players[pi].gold, pi === G.me));
      const after = () => {
        if (s.tide !== prev.tide) tideSplash();
        if (!dive) tellGoals(s);
        if (s.phase === 'over') return showGameOver(prev.phase === 'over');
        if (G.status === 'over' && !G.revealed) {
          G.revealed = true;
          openModal(`<h2>${G.result && G.result.winner === G.me ? '🏆 You win!' : '🏳️ Game over'}</h2><p>${esc(onlineEndText())}</p><div class="btn-row"><button class="btn" data-close>See the chart</button></div>`);
        }
      };
      if (dive) showRoll(dive, { auto: dive.pi !== G.me, done: after });
      else after();
    },
  });
  function onlineEndText() {
    const r = G.result || {};
    const opp = st().players[1 - G.me].name;
    if (r.reason === 'resign') return r.winner === G.me ? `${opp} resigned — you win!` : 'You resigned.';
    if (r.reason === 'timeout') return r.winner === G.me ? `${opp} ran out of time three turns in a row — you win!` : 'You ran out of time three turns in a row, so the game is over.';
    return 'This game has ended.';
  }

  // ---------------------------------------------------------------- small helpers
  const st = () => G.state;
  const pl = (i) => st().players[i];
  const humanTurn = () => st().phase === 'act' && G.mode !== 'past' && (G.mode === 'online' ? G.status === 'active' && st().turn === G.me : !pl(st().turn).ai);
  function toast(html, kind) {
    const root = $('#toasts');
    if (!root) return;
    const t = document.createElement('div');
    t.className = `toast ${kind || ''}`;
    t.innerHTML = html;
    root.appendChild(t);
    while (root.children.length > 3) root.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3600);
  }
  function sfx(k, delay) {
    if (!window.GameMusic || !G || G.mode === 'sim') return;
    if (delay) setTimeout(() => GameMusic.sfx(k), delay);
    else GameMusic.sfx(k);
  }
  const hz = (h, cls) => `<span class="hz${cls ? ' ' + cls : ''}" title="${esc(E.HAZ[h].name)}">${E.HAZ[h].icon} ${esc(E.HAZ[h].name)}</span>`;
  const stars = (t) => '★'.repeat(E.TIER[t].stars);
  // Every diver is drawn as their own person: rookies come in three looks, and a second hire of any other role is mirrored.
  const DIVER_LOOKS = { rookie: ['rookie', 'rookie2', 'rookie3'] };
  const diverArt = (d) => `diver-${DIVER_LOOKS[d.k] ? DIVER_LOOKS[d.k][d.id % DIVER_LOOKS[d.k].length] : d.k}`;
  const diverPic = (d, extra) => {
    const rest = G && d.tired != null && d.tired >= st().tide;
    const flip = !DIVER_LOOKS[d.k] && d.id % 2;
    const promo = d.xp != null && E.promoted(d);
    return `<span class="pic dv${rest ? ' zz' : ''}${flip ? ' flip' : ''}${promo ? ' promo' : ''}${extra ? ' ' + extra : ''}" style="--dl:-${((d.id * 0.73) % 4).toFixed(2)}s" aria-hidden="true"><img src="${IMG(diverArt(d))}" alt="" width="64" height="64" loading="lazy"></span>`;
  };
  const subPic = (k) => `<img class="pic" src="${IMG('sub-' + k)}" alt="">`;
  const swimPic = '<span class="pic" aria-hidden="true">🏊</span>';
  const expImg = (x) => IMG(x.k === 'heart' ? 'depth-heart' : DEPTH_IMG[E.SITE[x.k].depth]);
  function diverLine(d) {
    const D = E.DIVER[d.k];
    const promo = E.promoted(d) ? ' · 🎖️ promoted' : ` · ${d.xp || 0}/${E.PROMO_XP} finds to promotion`;
    return `${'⭐'.repeat(E.skillOf(d))} ${esc(D.role)} · 🪙${D.wage}/tide${promo}`;
  }
  const depthTag = (d) => `<span class="tag deep" title="Trained to dive as deep as the ${esc(E.DEPTH[E.deepOf(d)].name)}">🌊 ${esc(E.DEPTH[E.deepOf(d)].name)}</span>`;
  function specTags(d) {
    return E.DIVER[d.k].spec.map((h) => `<span class="tag spec">${E.HAZ[h].icon} ${esc(E.HAZ[h].name)}</span>`).join('');
  }
  function diverStatus(s, d) {
    if (d.tired >= s.tide) return '<span class="st out">Resting</span>';
    if (d.used) return '<span class="st busy">Out this tide</span>';
    return '<span class="st">Ready</span>';
  }
  function subStatus(s, sub) {
    if (sub.stuck >= s.tide) return `<span class="st out">${sub.stuck - s.tide + 1 > 1 ? `Out ${sub.stuck - s.tide + 1} tides` : 'Out this tide'}</span>`;
    if (sub.k === 'minnow' && E.sea(s) === 'storm') return '<span class="st out">In port (storm)</span>';
    if (sub.used) return '<span class="st busy">Back in port</span>';
    return '<span class="st">Ready</span>';
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
    const bubbles = Array.from({ length: 12 }, (_, i) => `<i style="left:${(i * 37) % 100}%;animation-delay:${(i * 0.8).toFixed(1)}s;width:${6 + (i % 4) * 4}px;height:${6 + (i % 4) * 4}px"></i>`).join('');
    return `<div class="gh-top"><a class="gh-lobby" href="/ahrens-games" title="Back to the game lobby">← <img class="gh-dice" src="/img/board-games-favicon-48.png?v=8" alt="" width="20" height="20"> Game lobby</a>${window.GameMusic ? GameMusic.buttonHtml('btn ghost sm gh-music', 'bt') : ''}</div>
      <div class="gh-hero">
        <img src="${IMG('cover')}" alt="A brass submarine and two divers swimming toward the glowing ruins of Atlantis" class="gh-hero-img">
        <div class="gh-shade"></div>
        <div class="hero-bubbles" aria-hidden="true">${bubbles}</div>
        <div class="gh-title"><h1 class="display">Atlantis Expedition</h1>${withTagline ? '<p>Hire divers, build submarines, and race a rival company to the treasures of the lost city. Roll high, dive deep — and watch out for sharks.</p>' : ''}</div>
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
    if (history.replaceState && location.search && !focusGame && !new URLSearchParams(location.search).get('game')) history.replaceState(null, '', location.pathname);
    const pr = prefs();
    const saved = loadSave();
    const canResume = saved && saved.state.phase !== 'over' && (saved.state.tide > 1 || saved.state.log.some((l) => l.who != null));
    document.body.className = 'setup-mode';
    $('#app').innerHTML = `
      <div class="setup gh">
        ${heroHtml(true)}
      <div class="setup-card gh-card panel">
        ${canResume ? `<div class="gh-resume"><div><b>Expedition in progress</b><span>${esc(saved.state.players.map((p) => p.name).join(' vs '))} · tide ${saved.state.tide} of ${E.TIDES}</span></div><button class="btn" id="resume">Continue</button></div>` : ''}
        <h2>New game</h2>
        <div class="gh-modes" id="mode">
          <button data-v="ai" class="gh-mode on"><span>🤖</span><b>Computer</b><small>Race a rival company</small></button>
          <button data-v="local" class="gh-mode"><span>👥</span><b>Two players</b><small>Share this device</small></button>
          <button data-v="online" class="gh-mode"><span>🌐</span><b>Online</b><small>Challenge a friend</small></button>
        </div>
          <div class="online-only" id="online-box"></div>
        <div class="field names offline-only">
          <label><span class="label">Your company</span><input id="n0" maxlength="18" value="${esc(pr.n0 || 'Coral Divers')}"></label>
          <label class="local-only"><span class="label">Second company</span><input id="n1" maxlength="18" value="${esc(pr.n1 || 'Deep Blue Co.')}"></label>
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
              <button data-v="0" class="on">Me</button>
              <button data-v="1">Computer</button>
              <button data-v="r">🎲 Random</button>
            </div>
        </div>
        <button class="btn big offline-only" id="start">Start game</button>
        <div class="gh-links">
            <button class="btn ghost sm" data-tutorial="atlantis-ad">🎞️ Watch the trailer</button>
            <button class="btn ghost sm" data-tutorial="atlantis">🎬 Watch the tutorial</button>
          <button class="btn ghost sm" id="how">📜 How to play</button>
          <button class="btn ghost sm" id="hist">🏆 Game history</button>
          <button class="btn ghost sm" id="sim">🧪 Computer vs computer</button>
        </div>
        </div>
      </div>`;
    const setMode = (m) => {
      $('.setup').classList.toggle('is-local', m === 'local');
      $('.setup').classList.toggle('is-online', m === 'online');
      $('#first').children[0].textContent = m === 'local' ? 'First company' : 'Me';
      $('#first').children[1].textContent = m === 'local' ? 'Second company' : 'Computer';
    };
    $('.setup').addEventListener('click', (e) => {
      const b = e.target.closest('.seg button, .gh-modes button');
      if (!b) return;
      [...b.parentNode.children].forEach((x) => x.classList.toggle('on', x === b));
      if (b.parentNode.id === 'mode') {
        savePrefs(Object.assign(prefs(), { mode: b.dataset.v }));
        setMode(b.dataset.v);
        if (b.dataset.v === 'online') Online.showLobby();
      }
    });
    setMode(focusGame ? 'online' : 'ai');
    if (focusGame || $('#mode .on').dataset.v === 'online') Online.showLobby(focusGame);
    $('#how').onclick = () => showRules();
    $('#hist').onclick = () => showHistory();
    $('#sim').onclick = openSimSetup;
    if ($('#resume')) $('#resume').onclick = () => startFrom(saved);
    $('#start').onclick = () => {
      const mode = $('#mode .on').dataset.v;
      const level = $('#level .on').dataset.v;
      const n0 = $('#n0').value.trim() || 'Coral Divers';
      const n1 = mode === 'local' ? $('#n1').value.trim() || 'Deep Blue Co.' : `Rival · ${LEVEL_NAME[level]}`;
      let first = $('#first .on').dataset.v;
      first = first === 'r' ? (Math.random() < 0.5 ? 0 : 1) : Number(first);
      savePrefs(Object.assign(prefs(), { mode, level, n0, ...(mode === 'local' ? { n1 } : {}) }));
      const state = E.newGame({ names: [n0, n1], ai: [false, mode === 'ai'], first });
      if (mode === 'ai') E.aiHeadStart(state, 1, level);
      startFrom({ state, mode, level, view: 0, gid: newLocalId() });
    };
  }

  // ---------------------------------------------------------------- game screen
  function startFrom(g) {
    if (!sessionId()) return showGate();
    stopAI();
    G = g;
    ui.lastTide = st().tide;
    document.body.className = 'game-mode';
    window.scrollTo(0, 0);
    if (G.mode !== 'online') save();
    else Online.rememberOnline();
    // Each saved game has its own address, so reloading reopens this game and the bare page is always home.
    const q = G.mode === 'online' && G.id ? `?game=${encodeURIComponent(G.id)}` : G.mode === 'past' && G.gid ? `?past=${encodeURIComponent(G.gid)}` : G.gid && (G.mode === 'ai' || G.mode === 'local') ? `?local=${encodeURIComponent(G.gid)}` : '';
    if (history.replaceState && location.search !== q) history.replaceState(null, '', location.pathname + q);
    render();
    if (G.mode === 'online' && G.gmode === 'quick' && G.status === 'active') Online.tickClock();
    if (st().phase === 'over') showGameOver(!!G.revealed);
    else if (G.mode !== 'online') scheduleAI();
    else if (G.status === 'active') Online.connectSock();
  }

  function viewIndex() {
    const s = st();
    if (G.mode === 'online') return G.view != null ? G.view : G.me;
    if (G.mode === 'local' && s.phase === 'act' && G.follow !== false) return s.turn;
    return G.view || 0;
  }

  function render() {
    if (!G) return;
    const s = st();
    const v = viewIndex();
    const sea = E.SEA[E.sea(s)];
    const next = s.tide < E.TIDES ? E.SEA[s.forecast[s.tide]] : null;
    const sub = G.mode === 'past' ? '📜 Finished game' : G.mode === 'sim' ? `🧪 ${SIM_SPEEDS[G.speed].name} · computer vs computer` : G.mode === 'online' ? `🌐 vs ${esc(pl(1 - G.me).name)}${G.gmode === 'quick' ? ' · ⚡' : ''}${G.gmode === 'quick' && G.deadline ? ' <span class="ol-clock" id="ol-clock"></span>' : ''}` : G.mode === 'local' ? '👥 Two players' : `🤖 vs computer · ${LEVEL_NAME[G.level] || ''}`;
    let pips = '';
    for (let t = 1; t <= E.TIDES; t++) {
      const cls = s.phase === 'over' || t < s.tide ? 'done' : t === s.tide ? 'cur' : '';
      const heart = t === E.HEART_TIDE ? ' heart' : '';
      pips += `<span class="pip ${cls}${heart}" title="Tide ${t}${heart ? ' · the Heart of Atlantis is sighted' : ''}">${t}</span>`;
    }
    const home = G.mode === 'past' ? '🏆<span class="bt"> History</span>' : G.mode === 'sim' ? '⏹<span class="bt"> Stop</span>' : G.mode === 'online' ? '🌐<span class="bt"> Game</span>' : '🔱<span class="bt"> New game</span>';
    $('#app').innerHTML = `
      <header class="topbar">
        <div class="brand">
          <img src="/img/atlantis-icon-180.png?v=3" alt="" class="brand-logo" width="46" height="46">
          <div><h1>Atlantis Expedition</h1><small>${esc(sub)}</small></div>
        </div>
        <div class="top-mid">
          <div class="tracker"><span class="tracker-label">Tide</span>${pips}</div>
          <div class="top-sea">
            <span class="chip" title="${esc(sea.note)}">${sea.icon} ${esc(sea.name)}</span>
            ${next && s.phase === 'act' ? `<span class="chip next" title="Next tide: ${esc(next.note)}">Next: ${next.icon} ${esc(next.name)}</span>` : ''}
          </div>
        </div>
        <div class="top-actions">
          ${isAdmin() && (G.mode === 'ai' || G.mode === 'local') ? `<button class="btn ghost sm${rig20On() ? ' on' : ''}" data-act="rig20" aria-pressed="${rig20On()}" title="Admin testing: make your dives always roll a natural 20">🎯<span class="bt"> 20s ${rig20On() ? 'on' : 'off'}</span></button>` : ''}
          ${window.GameMusic ? GameMusic.buttonHtml('btn ghost sm', 'bt') : ''}
          ${G.mode === 'online' && G.status === 'active' ? '<button class="btn ghost sm" data-act="resignOnline" aria-label="Resign">🏳️<span class="bt"> Resign</span></button>' : ''}
          <button class="btn ghost sm" data-act="rules" aria-label="Rules">📜<span class="bt"> Rules</span></button>
          <button class="btn ghost sm" data-act="home" aria-label="${G.mode === 'past' ? 'History' : G.mode === 'sim' ? 'Stop' : 'New game'}" title="${G.mode === 'past' ? 'Back to history' : G.mode === 'sim' ? 'Stop the simulation' : 'Start a new game (this one stays saved under Your games)'}">${home}</button>
          <a class="btn ghost sm" href="/ahrens-games/settings" title="Ahrens Games settings" aria-label="Settings">⚙️<span class="bt"> Settings</span></a>
          <a class="btn ghost sm" href="/ahrens-games" title="Back to the game lobby" aria-label="Game lobby"><img class="gh-dice" src="/img/board-games-favicon-48.png?v=8" alt=""><span class="bt"> Lobby</span></a>
        </div>
      </header>
      <div class="at">
        <section class="scores">${s.players.map((p, i) => companyCard(i, v)).join('')}</section>
        ${s.phase === 'act' ? `<div class="tide-strip"><span class="ts-tide">🌊 Tide <b>${s.tide}</b> of ${E.TIDES}${s.tide === E.TIDES ? ' · <b class="ts-last">last tide!</b>' : ''}</span><span class="ts-sea">${sea.icon} <b>${esc(sea.name)}:</b> ${SEA_PLAIN[E.sea(s)]}</span>${next ? `<span class="ts-next">Next tide: ${next.icon} ${esc(next.name)}</span>` : ''}</div>` : ''}
        ${bannerHtml()}
      <div class="main">
          <section class="sea">
            <div class="sec-head"><h2>🗺️ Chart of Atlantis</h2><small>${s.map.filter((x) => x.by != null).length} of ${s.map.length} sites explored</small></div>
            ${chartHtml(v)}
            <div class="legend"><span><i class="lg open"></i>Charted</span><span><i class="lg far"></i>Uncharted (−${E.UNCHARTED})</span><span><i class="lg done"></i>Explored</span><span>🏺 relic</span></div>
        </section>
          <section class="panel company" style="--pc:${PCOLOR[v]}">${companyHtml(v)}</section>
        </div>
        <div class="lower">${hallHtml()}${goalsHtml()}</div>
        <section class="panel"><h3>📓 Captain’s log</h3><div class="log" id="log">${logHtml()}</div></section>
    </div>`;
    const lg = $('#log');
    if (lg) lg.scrollTop = lg.scrollHeight;
  }

  function companyCard(i, v) {
    const s = st();
    const p = pl(i);
    const sc = E.score(s, p);
    const turn = s.phase === 'act' && s.turn === i;
    const tag = s.phase !== 'act' ? '' : s.passed[i] ? '<span class="co-tag">Done this tide</span>' : turn ? `<span class="co-tag turn">${p.ai ? 'Thinking…' : G.mode === 'ai' ? 'Your move' : 'Up now'}</span>` : '';
    return `<div class="co${turn ? ' turn' : ''}${v === i ? ' viewing' : ''}" style="--pc:${PCOLOR[i]}" data-view="${i}" title="Show ${esc(p.name)}’s company">
      <span class="co-flag">${FLAG[i]}</span>
      <div class="co-name"><b>${esc(p.name)}</b>${p.ai ? '<span class="co-tag">🤖</span>' : ''}${tag}</div>
      <div class="co-stats"><span title="Pearls">${PEARL} <b>${p.treasure}</b></span><span>🪙 <b>${p.gold}</b></span><span>🤿 <b>${p.divers.length}</b></span><span>🚢 <b>${p.subs.length}</b></span><span title="Points so far">⭐ <b>${sc.total}</b></span></div>
    </div>`;
  }

  function bannerHtml() {
    const s = st();
    if (G.mode === 'past') {
      const w = E.winner(s);
      return `<div class="banner">📜 ${w < 0 ? 'A tie!' : `${esc(pl(w).name)} won`} · <button class="btn sm" data-act="scorecard">🏆 Scorecard</button></div>`;
    }
    if (s.phase === 'over') return `<div class="banner mine">🏁 The expedition season is over. <button class="btn sm" data-act="scorecard">🏆 See who won</button></div>`;
    const p = pl(s.turn);
    if (p.ai) {
      const human = s.players.findIndex((q) => !q.ai);
      const waiting = human >= 0 && s.passed[human] ? ` You’ve ended tide ${s.tide}; tide ${s.tide + 1 > E.TIDES ? '— the last one —' : s.tide + 1} starts when they end theirs.` : '';
      return `<div class="banner" style="--pc:${PCOLOR[s.turn]}"><span class="dot"></span>${esc(p.name)} is planning their next move…${waiting}</div>`;
    }
    if (G.mode === 'online' && (!humanTurn() || s.passed[G.me])) {
      const waiting = s.passed[G.me] ? `You’ve ended tide ${s.tide}; waiting for ${esc(p.name)} to end theirs.` : `Waiting for ${esc(p.name)} to take their turn…`;
      return `<div class="banner"><span class="dot"></span>${waiting}</div>`;
    }
    const who = G.mode === 'local' ? `${esc(p.name)}, your move` : 'Your move';
    const otherDone = s.passed[1 - s.turn] ? ` ${esc(pl(1 - s.turn).name)} is done for this tide, so you can keep going until you end yours.` : '';
    return `<div class="banner mine" style="--pc:${PCOLOR[s.turn]}"><span class="dot"></span><b>${who}:</b> pick a site on the chart to dive, hire from the dive hall, build or salvage.${otherDone}</div>`;
  }

  // The best odds this company could get on an expedition right now (best ready sub or swimming, best crew).
  function bestOdds(pi, x) {
    const s = st();
    const p = pl(pi);
    let best = null;
    for (const sub of [...E.readySubs(s, p), null]) {
      const crew = E.bestCrew(s, pi, x, sub);
      if (!crew.length) continue;
      const c = E.chance(s, pi, x.id, sub ? sub.id : null, crew.map((d) => d.id));
      if (!best || c.p > best.p) best = Object.assign(c, { sub, crew });
    }
    return best;
  }

  // ---------------------------------------------------------------- the chart
  const HARBOR_Y = 4;
  function chartHtml(v) {
    const s = st();
    const canPlan = humanTurn();
    const actor = canPlan ? s.turn : v;
    const slots = E.slotsOf(s);
    const lines = [];
    slots.filter((slot) => slot.row === 0).forEach((slot) => lines.push(`<line x1="50" y1="${HARBOR_Y}" x2="${slot.x}" y2="${slot.y}" class="route"/>`));
    slots.forEach((slot, n) => slot.kids.forEach((k) => {
      const a = s.map[n];
      const b = s.map[k];
      const cls = a.by != null ? (b.by != null ? 'done' : 'route') : '';
      lines.push(`<line x1="${slot.x}" y1="${slot.y}" x2="${slots[k].x}" y2="${slots[k].y}" class="${cls}"${a.by != null ? ` style="--pc:${PCOLOR[a.by]}"` : ''}/>`);
    }));
    return `<div class="chart${slots.length > 20 ? ' wide' : ''}"><div class="chart-in">
      <svg class="chart-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines.join('')}</svg>
      <div class="harbor" style="top:${HARBOR_Y}%">⚓ Harbor</div>
      ${s.map.map((x) => nodeHtml(x, actor, canPlan)).join('')}
    </div></div>`;
  }

  function nodeHtml(x, actor, canPlan) {
    const s = st();
    const site = E.SITE[x.k];
    const slot = E.slotsOf(s)[x.n];
    const done = x.by != null;
    const open = E.isOpen(s, x);
    const state = done ? 'done' : !open ? 'hidden' : E.charted(s, x) ? 'open' : 'far';
    let badge = '';
    if (state === 'open' || state === 'far') {
      const o = canPlan ? bestOdds(actor, x) : null;
      if (o) badge = `<span class="nd-odds" style="--oc:${oddsColor(o.p)}">${pct(o.p)}</span>`;
    }
    const meta = `${state === 'hidden' ? '' : `<span class="nd-haul">${PEARL}${E.rewardOf(s, x).treasure}</span>`}${site.haz.map((h) => E.HAZ[h].icon).join('')}${site.relic ? E.RELIC[site.relic].icon : ''}`;
    const label = state === 'hidden' ? `🔒 Tide ${E.HEART_TIDE}` : esc(site.short);
    return `<button class="node t${site.tier} ${state}${x.k === 'heart' ? ' heart' : ''}" data-site="${x.id}" style="left:${slot.x}%;top:${slot.y}%;--bg:url('${expImg(x)}')${done ? `;--pc:${PCOLOR[x.by]}` : ''}" title="${esc(site.name)} · ${E.TIER[site.tier].name} · ${E.rewardOf(s, x).treasure} pearls">
      <span class="nd-dot"><span class="nd-stars">${stars(site.tier)}</span>${done ? `<span class="nd-flag">${FLAG[x.by]}</span>` : ''}${x.scout && !done ? `<span class="nd-scout">🧭${x.scout}</span>` : ''}</span>
      ${badge}
      <span class="nd-name">${label}</span>
      <span class="nd-meta">${meta}</span>
    </button>`;
  }

  // Details for a site you can't (or don't want to) dive right now.
  function showSite(x) {
    const s = st();
    const site = E.SITE[x.k];
    const slot = E.slotsOf(s)[x.n];
    const r = E.rewardOf(s, x);
    const names = (ns) => ns.map((n) => esc(E.SITE[s.map[n].k].name)).join(', ');
    let status;
    if (x.by != null) status = `<p class="site-status" style="--pc:${PCOLOR[x.by]}">${FLAG[x.by]} Explored by <b>${esc(pl(x.by).name)}</b>.</p>`;
    else if (!E.isOpen(s, x)) status = `<p class="site-status">🔒 Nobody has sighted it yet. It appears on tide ${E.HEART_TIDE}.</p>`;
    else if (E.charted(s, x)) status = `<p class="site-status">🗺️ Charted — a route leads here.</p>`;
    else status = `<p class="site-status far">🌫️ Uncharted: −${E.UNCHARTED} to dives until someone explores ${names(slot.parents)}.</p>`;
    openModal(`<div class="plan-head"><img src="${expImg(x)}" alt=""><div><h2>${esc(site.name)}</h2><div class="haz">${site.haz.map((h) => hz(h)).join('')}</div>
        <small class="muted">${E.TIER[site.tier].name} · ${E.DEPTH[site.depth].name} · roll ${E.TIER[site.tier].target}+ · reward ${PEARL}${r.treasure} 🪙${r.gold}${site.relic ? ` · ${E.RELIC[site.relic].icon} ${esc(E.RELIC[site.relic].name.toLowerCase())}` : ''}</small></div></div>
      <p>${esc(site.blurb)}</p>${status}
      ${slot.kids.length ? `<p class="muted">Leads to: ${names(slot.kids)}</p>` : ''}`, { onClose: () => {} });
  }

  // ---------------------------------------------------------------- dive hall (shared by both companies)
  function hallHtml() {
    const s = st();
    const can = humanTurn();
    const p = can ? pl(s.turn) : null;
    const cards = s.market.map((d) => {
      const D = E.DIVER[d.k];
      const cost = E.hireCost(d);
      const why = !can ? '' : p.divers.length >= E.MAX_DIVERS ? 'Company full' : p.gold < cost ? `Need 🪙${cost}` : '';
      const price = `${cost < D.cost ? `<s>🪙${D.cost}</s> ` : ''}🪙${cost}`;
      return `<div class="hire">${diverPic(d)}<div class="hire-main"><b>${esc(d.name)}</b><small>${'⭐'.repeat(D.skill)} ${esc(D.role)} · 🪙${D.wage}/tide</small><div class="tags">${depthTag(d)}${specTags(d)}</div></div>
        ${can ? `<button class="btn sm" data-hire="${d.id}" ${why ? 'disabled' : ''}>${why || `Hire ${price}`}</button>` : `<span class="hire-price">${price}</span>`}</div>`;
    }).join('') || '<p class="empty">Nobody is looking for work.</p>';
    return `<section class="panel hall"><h3>🤿 The dive hall <small>shared by both companies · ${plural(s.diverDeck.length, 'more diver')} to come</small></h3>
      <p class="muted">Divers get 🪙1 cheaper for every tide they wait, down to half price. The longest-waiting one leaves at the end of each tide. Hiring uses your move.</p>
      <div class="hall-grid">${cards}</div></section>`;
  }

  function goalsHtml() {
    const s = st();
    const goals = s.goals.map((g) => {
      const G = E.GOALS[g.k];
      return `<div class="goal${g.by != null ? ' done' : ''}"${g.by != null ? ` style="--pc:${PCOLOR[g.by]}"` : ''}><span class="g-icon">${G.icon}</span><div><b>${esc(G.name)}</b><small>${esc(G.text)}</small></div><span class="g-pts">${g.by != null ? FLAG[g.by] + ' ' : ''}+${G.pts}</span></div>`;
    }).join('');
    return `<section class="panel goals"><h3>📜 Commissions <small>first company to do it scores</small></h3>${goals}
      <h3>🏺 Relic sets</h3><p class="muted">Tricky and harder sites hold a relic (👑 📜 🔮 🏺). Each set of different kinds scores: ${E.RELIC_SET.slice(1).map((pts, i) => `${i + 1} kind${i ? 's' : ''} ${pts}`).join(' · ')}.</p></section>`;
  }

  function companyHtml(v) {
    const s = st();
    const p = pl(v);
    const mine = humanTurn() && s.turn === v;
    const tabs = `<div class="tabs">${s.players.map((q, i) => `<button class="${i === v ? 'on' : ''}" style="--pc:${PCOLOR[i]}" data-view="${i}">${FLAG[i]} ${esc(q.name)}</button>`).join('')}</div>`;
    const subs = p.subs.map((sub) => {
      const B = E.SUB[sub.k];
      const mods = sub.mods.map((m) => `<span class="tag spec">${E.MOD[m].icon} ${esc(E.MOD[m].name)}</span>`).join('');
      const free = B.slots - sub.mods.length;
      return `<div class="card${E.subReady(s, sub) ? '' : ' dim'}">${subPic(sub.k)}<b>${esc(B.name)}</b>${subStatus(s, sub)}
        <div><small>${plural(B.crew, 'seat')} · built for the ${esc(E.DEPTH[B.depth].name)}${B.bonus ? ` · +${B.bonus} to rolls` : ''}</small><div class="tags">${mods}${free > 0 ? `<span class="tag">${plural(free, 'free fitting slot')}</span>` : ''}</div></div></div>`;
    }).join('') || '<p class="empty">No submarines — your divers can still swim out from the boat, or build one at the shipyard.</p>';
    const divers = p.divers.map((d) => `<div class="card${E.diverReady(s, d) ? '' : ' dim'}">${diverPic(d)}<b>${esc(d.name)}</b>${diverStatus(s, d)}<div><small>${diverLine(d)}</small><div class="tags">${depthTag(d)}${specTags(d)}</div></div></div>`).join('') || '<p class="empty">No divers — hire some at the dive hall.</p>';
    const canSalvage = E.readySubs(s, p).length && E.readyDivers(s, p).length;
    const relicCount = (r) => p.relics.filter((y) => y === r).length;
    const relics = p.relics.length
      ? `<h3>🏺 Relics <small>${plural(E.relicPoints(p.relics), 'point')}</small></h3><div class="tags">${E.RELIC_ORDER.filter(relicCount).map((r) => `<span class="tag">${E.RELIC[r].icon} ${esc(E.RELIC[r].name)} ×${relicCount(r)}</span>`).join('')}</div>`
      : '';
    const acts = mine
      ? `<div class="acts">
        <button class="btn sea" data-act="yard">🛠️ Shipyard</button>
        <button class="btn" data-act="salvage" ${canSalvage ? '' : 'disabled'}>🪙 Salvage run</button>
          <button class="btn ghost" data-act="rival">👀 ${esc(pl(1 - v).name)}</button>
          <button class="btn danger" data-act="pass">⏭ End my tide</button>
        </div>`
      : humanTurn() ? `<div class="acts"><button class="btn end" data-view="${s.turn}">← Back to ${esc(pl(s.turn).name)}</button></div>`
        : s.phase === 'act' && G.mode !== 'past' && G.mode !== 'sim' && !p.ai && s.turn !== v ? `<p class="muted wait-note">Waiting for ${esc(pl(s.turn).name)}…</p>` : '';
    return `${tabs}
      <h3>🚢 Fleet <small>${p.subs.length}/${E.MAX_SUBS} docks</small></h3><div class="cards">${subs}</div>
      <h3>🤿 Crew <small>wages 🪙${E.wagesOf(p)}/tide · ${p.divers.length}/${E.MAX_DIVERS}</small></h3><div class="cards">${divers}</div>
      ${p.found.length ? `<h3>🗺️ Sites explored <small>${plural(p.found.length, 'expedition')}</small></h3><div class="tags">${p.found.map((k) => `<span class="tag">${stars(E.SITE[k].tier)} ${esc(E.SITE[k].name)}</span>`).join('')}</div>` : ''}
      ${relics}
      ${acts}`;
  }

  function logHtml() {
    const s = st();
    return s.log.slice(-80).map((l) => (l.who == null ? `<p class="tide">${pearls(esc(l.text))}</p>` : `<p style="--pc:${PCOLOR[l.who]}">${pearls(esc(l.text))}</p>`)).join('');
  }

  // ---------------------------------------------------------------- clicks
  document.addEventListener('click', (e) => {
    if (!G || !$('.at')) return;
    if (e.target.closest('#modal-root') || e.target.closest('.at-reveal')) return;
    const vb = e.target.closest('[data-view]');
    if (vb) {
      G.view = Number(vb.dataset.view);
      G.follow = G.mode === 'local' && G.view === st().turn ? true : G.mode === 'local' ? false : G.follow;
      render();
      return;
    }
    const xb = e.target.closest('[data-site]');
    if (xb) {
      const x = E.expOf(st(), Number(xb.dataset.site));
      if (x && humanTurn() && !ui.busy && E.isOpen(st(), x)) return openPlanner(x.id);
      return x && showSite(x);
    }
    const hb = e.target.closest('[data-hire]');
    if (hb) {
      if (!hb.disabled && humanTurn() && !ui.busy) doAction({ t: 'hire', d: Number(hb.dataset.hire) });
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'rules') return showRules();
    if (act === 'home') return leaveGame();
    if (act === 'resignOnline') {
      const modal = openModal(`<h2>🏳️ Resign this game?</h2><p>Your opponent wins right away.</p><div class="btn-row"><button class="btn lava" data-resign-confirm>Yes, resign</button><button class="btn ghost" data-close>Keep playing</button></div>`);
      modal.addEventListener('click', (e) => { if (e.target.closest('[data-resign-confirm]')) { closeModal(); Online.resign(); } });
      return;
    }
    if (act === 'rig20' && isAdmin()) {
      const on = !prefs().rig20;
      savePrefs(Object.assign(prefs(), { rig20: on }));
      toast(on ? '🎯 Testing: your dives now always roll a 20. Games played this way won’t go into your history.' : '🎯 Rolls are random again.');
      return render();
    }
    if (act === 'scorecard') return showGameOver(true);
    if (!humanTurn() || ui.busy) return;
    if (act === 'yard') return openYard();
    if (act === 'salvage') return openPlanner(null);
    if (act === 'rival') {
      G.view = 1 - st().turn;
      G.follow = false;
      return render();
    }
    if (act === 'pass') return confirmPass();
  });

  function leaveGame() {
    if (G.mode === 'past') return showHistory();
    if (G.mode === 'sim') return stopSim();
    if (G.mode === 'online') {
      const id = G.id;
      Online.forgetOnline();
      return showSetup(id);
    }
    save();
    // The current game stays saved: it's listed under Your games in the game lobby.
    if (window.BoardSaves) window.BoardSaves.flush();
    showSetup();
  }

  // ---------------------------------------------------------------- actions
  // One sound per move.
  function actionSfx(t) {
    if (t === 'hire') sfx('join');
    else if (t === 'build' || t === 'upgrade' || t === 'fit') sfx('build');
    else if (t === 'salvage') sfx('coin');
    else if (t === 'pass') sfx('turn');
  }
  function doAction(a) {
    if (G.mode === 'online') return Online.send(a);
    const s = st();
    const pi = s.turn;
    const tideBefore = s.tide;
    const goldBefore = pl(pi).gold;
    const mark = s.log[s.log.length - 1];
    try {
    E.apply(s, pi, a);
    } catch (err) {
      toast(esc(err.message), 'bad');
      return;
    }
    if (s.phase === 'over' && (G.mode === 'ai' || G.mode === 'local')) recordGame();
    actionSfx(a.t);
    if (a.t !== 'dive') tellMove(pi, s.log.slice(s.log.lastIndexOf(mark) + 1), goldBefore, isOwn(pi));
    if (G.mode === 'local' && G.follow !== false) G.view = s.phase === 'act' ? s.turn : G.view;
    if (s.phase === 'act' && G.mode === 'ai' && !pl(pi).ai) G.view = 0;
    save();
    const after = () => {
        render();
      if (s.tide !== tideBefore) tideSplash();
      if (a.t !== 'dive') tellGoals(s);
      if (s.phase === 'over') return showGameOver(false);
      scheduleAI();
    };
    if (a.t === 'dive' && s.last) {
      render();
      showRoll(s.last, { auto: pl(pi).ai, done: after });
    } else after();
  }

  // Between tides: what just happened, and what the new tide's forecast means.
  function tideSplash() {
    const s = st();
    if (G.mode === 'sim' && G.speed === 'turbo') return;
    const k = E.sea(s);
    const w = E.SEA[k];
    const r = s.report && s.report.tide === s.tide ? s.report : null;
    const next = s.tide < E.TIDES ? E.SEA[s.forecast[s.tide]] : null;
    const first = pl(s.turn);
    const lines = [];
    if (r) {
      s.players.forEach((p, i) => {
        const q = r.players[i];
        const bits = [`collected 🪙${r.income}${k === 'gala' ? ' (with the gala’s 🪙3)' : ''}`, q.paid ? `paid 🪙${q.paid} in wages` : 'had no wages to pay', `now has 🪙${q.gold}`];
        let line = `<b style="color:${PCOLOR[i]}">${FLAG[i]} ${esc(p.name)}</b> ${bits.join(', ')}.`;
        if (q.quit.length) line += ` <span class="bad">${q.quit.map(esc).join(' and ')} couldn’t be paid and quit.</span>`;
        if (q.resting.length) line += ` ${q.resting.map(esc).join(' and ')} ${q.resting.length > 1 ? 'are' : 'is'} resting this tide.`;
        if (q.stuck.length) line += ` Their ${q.stuck.map(esc).join(' and ')} ${q.stuck.length > 1 ? 'are' : 'is'} out of action this tide.`;
        if (q.port) line += ` ${q.port > 1 ? `Their ${q.port} Minnows stay` : 'Their Minnow stays'} in port (storm).`;
        lines.push(line);
      });
      const hall = [];
      if (r.left) hall.push(`${esc(r.left)} left the dive hall for other work`);
      if (r.arrived.length) hall.push(`new for hire: ${r.arrived.map(esc).join(', ')}`);
      if (hall.length) lines.push(`🤿 <b>Dive hall:</b> ${hall.join('; ')}. Everyone still waiting is 🪙1 cheaper.`);
    }
    const heart = s.tide === E.HEART_TIDE ? '<p class="tr-heart">💠 <b>The Heart of Atlantis has been sighted!</b> Anyone can dive for it from now on. Whoever finds it ends the season at the end of that tide.</p>' : '';
    const back = openModal(`<div class="tide-report">
        <div class="tr-turn"><span>Tide ${s.tide - 1} is over</span><b>🌊 Tide ${s.tide} of ${E.TIDES} begins</b>${s.tide === E.TIDES ? '<em>This is the last tide!</em>' : ''}</div>
        <div class="tr-sea"><span class="tr-icon">${w.icon}</span><div><b>${esc(w.name)}</b><p>${SEA_PLAIN[k]}</p></div></div>
        ${heart}
        ${lines.length ? `<h3>Between the tides</h3><ul class="tr-list">${lines.map((l) => `<li>${l}</li>`).join('')}</ul>` : ''}
        <p class="tr-next">${next ? `Coming next tide: ${next.icon} <b>${esc(next.name)}</b> — ${SEA_PLAIN[s.forecast[s.tide]]}` : 'There are no more tides after this one: the season ends when it’s over.'}</p>
        <p class="tr-first"><b style="color:${PCOLOR[s.turn]}">${esc(first.name)}</b> moves first this tide. Every sub and diver that isn’t resting or stuck is ready to go out again.</p>
        <div class="btn-row" style="justify-content:center"><button class="btn big" data-close>▶ Start tide ${s.tide}</button></div>
      </div>`, { cls: 'wide' });
    sfx(s.tide === E.HEART_TIDE ? 'reveal' : 'turn');
    if (G.mode === 'sim') setTimeout(() => back.isConnected && closeModal(), G.speed === 'fast' ? 2500 : 6000);
  }

  function confirmPass() {
    const s = st();
    const p = pl(s.turn);
    const canStill = E.readyDivers(s, p).length && (E.readySubs(s, p).length || E.openSites(s).length);
    if (!canStill) return doAction({ t: 'pass' });
    const back = openModal(`<h2>⏭ End your tide?</h2>
      <p>You still have divers ready. Once you end your tide you can’t act again until the next one${s.passed[1 - s.turn] ? '' : `, and ${esc(pl(1 - s.turn).name)} can keep going on their own`}.</p>
      <div class="btn-row"><button class="btn danger" id="pass-yes">End my tide</button><button class="btn ghost" data-close>Keep going</button></div>`, { onClose: () => {} });
    back.querySelector('#pass-yes').onclick = () => {
      closeModal(true);
      doAction({ t: 'pass' });
    };
  }

  // ---------------------------------------------------------------- dive planner (and salvage runs)
  function openPlanner(xid) {
    const s = st();
    const pi = s.turn;
    const p = pl(pi);
    const x = xid == null ? null : E.expOf(s, xid);
    const site = x && E.SITE[x.k];
    const subGap = (sub) => (x ? Math.max(0, site.depth - (sub ? E.SUB[sub.k].depth : 1)) : 0);
    const diverGap = (d) => (x ? Math.max(0, site.depth - E.deepOf(d)) : 0);
    const plan = { s: null, crew: [] };
    if (x) {
      const best = bestOdds(pi, x);
      if (best) {
        plan.s = best.sub ? best.sub.id : 'swim';
        plan.crew = best.crew.map((d) => d.id);
      }
    } else {
      const sub = E.readySubs(s, p)[0];
      if (sub) {
        plan.s = sub.id;
        // A salvage run doesn't need skill: send the least skilled divers and keep the best for real dives.
        plan.crew = E.readyDivers(s, p).slice().sort((a, b) => E.DIVER[a.k].skill - E.DIVER[b.k].skill).slice(0, E.SUB[sub.k].crew).map((d) => d.id);
      }
    }
    if (plan.s == null) {
      const first = p.subs.find((sub) => E.subReady(s, sub));
      plan.s = first ? first.id : x ? 'swim' : null;
    }
    const subWhy = (sub) => {
      if (sub.stuck >= s.tide) return 'Out of action';
      if (sub.k === 'minnow' && E.sea(s) === 'storm') return 'In port (storm)';
      if (sub.used) return 'Already out this tide';
      return '';
    };
    const diverWhy = (d) => (d.tired >= s.tide ? 'Resting' : d.used ? 'Out this tide' : '');
    const draw = () => {
      const swim = plan.s === 'swim';
      const sub = plan.s != null && !swim ? E.subOf(p, plan.s) : null;
      const seats = sub ? E.SUB[sub.k].crew : swim ? E.SWIM_CREW : 0;
      const head = x
        ? `<div class="plan-head"><img src="${expImg(x)}" alt=""><div><h2>${esc(site.name)}</h2><div class="haz">${site.haz.map((h) => hz(h)).join('')}${E.charted(s, x) ? '' : `<span class="hz risk">🌫️ Uncharted</span>`}</div><small class="muted">${E.TIER[site.tier].name} · ${E.DEPTH[site.depth].name} · roll ${E.TIER[site.tier].target}+ · reward ${PEARL}${E.rewardOf(s, x).treasure} 🪙${E.rewardOf(s, x).gold}${site.relic ? ` · ${E.RELIC[site.relic].icon} relic` : ''}</small></div></div>`
        : `<h2>🪙 Salvage run</h2><p class="muted">A safe trip to pick over old wrecks. No dice, no danger: earns 🪙1 plus 🪙1 per diver. The sub and divers are out for the rest of this tide.</p>`;
      const subs = p.subs.map((q) => {
        const why = subWhy(q);
        const B = E.SUB[q.k];
        const deep = subGap(q) ? `<em class="warn">⚠️ Too deep: −${E.SUB_DEEP_PEN * subGap(q)}</em>` : '';
        return `<button data-sub="${q.id}" class="${q.id === plan.s ? 'on' : ''}${deep ? ' risky' : ''}" ${why ? 'disabled' : ''}>${subPic(q.k)}<b>${esc(B.name)}</b><small>${why || `${plural(B.crew, 'seat')}${B.bonus ? ` · +${B.bonus}` : ''}${q.mods.length ? ' · ' + q.mods.map((m) => E.MOD[m].icon).join('') : ''}`}${why ? '' : deep}</small></button>`;
      }).join('') + (x ? (() => {
        const deep = subGap(null) ? `<em class="warn">⚠️ Too deep: −${E.SUB_DEEP_PEN * subGap(null)}</em>` : '';
        return `<button data-sub="swim" class="${swim ? 'on' : ''}${deep ? ' risky' : ''}">${swimPic}<b>No sub: swim</b><small>${plural(E.SWIM_CREW, 'diver')} · −${E.SWIM_PEN}${deep}</small></button>`;
      })() : '');
      const divers = p.divers.map((d) => {
        const why = diverWhy(d);
        const D = E.DIVER[d.k];
        const deep = diverGap(d) ? `<em class="warn">⚠️ Out of depth: −${E.DIVER_DEEP_PEN * diverGap(d)}</em>` : '';
        return `<button data-diver="${d.id}" class="${plan.crew.includes(d.id) ? 'on' : ''}${deep ? ' risky' : ''}" ${why ? 'disabled' : ''}>${diverPic(d)}<b>${esc(d.name)}</b><small>${why || `${'⭐'.repeat(E.skillOf(d))} ${D.spec.map((h) => E.HAZ[h].icon).join('')} · 🌊 ${esc(E.DEPTH[E.deepOf(d)].name)}`}${why ? '' : deep}</small></button>`;
      }).join('');
      let box = '';
      if (x && (sub || swim) && plan.crew.length) {
        const c = E.chance(s, pi, x.id, sub ? sub.id : null, plan.crew);
        const crew = plan.crew.map((id) => E.diverOf(p, id));
        const fates = c.uncovered.map((h) => `<li>${hazardFate(h, sub, crew, p.gold)}</li>`);
        const ready = site.haz.filter((h) => !c.uncovered.includes(h));
        const deep = c.risk.map((r) => `<li>🫥 <b>${esc(r.name)}</b> is ${c.swim ? 'swimming deeper than is safe' : 'out of their depth'}: a <b>${pct(r.p)}</b> chance of being lost for good.</li>`);
        if (c.crush) deep.push(`<li>💥 The <b>${esc(E.SUB[sub.k].name)}</b> is out of its depth: a <b>${pct(c.crush)}</b> chance of being crushed.</li>`);
        box = `<div class="odds-box" style="--oc:${oddsColor(c.p)}">
          <div class="need-big">🎲 You need to roll <b>${needText(c.need)}</b> on the d20${c.need >= 20 ? ' — nothing else will do' : ''}</div>
          ${rig20On() && x ? '<div class="need-note rig-note">🎯 Admin testing is on: this dive will roll a 20.</div>' : ''}
          ${dieTrack(c.need)}
          <div class="odds-big"><span>Chance of success</span><b>${pct(c.p)}</b></div>
          <div class="odds-bar"><i style="width:${pct(c.p)}"></i></div>
          <div class="parts"><div><span>Target for this site</span><b>${c.target}</b></div>${c.parts.map((q) => `<div class="${q.v < 0 ? 'neg' : 'pos'}"><span>${esc(q.label)}</span><span>${q.v > 0 ? '+' : ''}${q.v}</span></div>`).join('')}
            <div><span>Die roll + ${c.bonus >= 0 ? c.bonus : `(${c.bonus})`} must reach ${c.target}, so the die must show</span><b>${c.need}+</b></div></div>
          <p class="need-note">A natural 20 always succeeds and a natural 1 always fails, whatever the bonuses.</p>
          <div class="fail-box"><b>💥 If the dive fails:</b><ul>
            ${fates.length ? `<li>${fates.length > 1 ? `One of these strikes (each equally likely, because nobody is ready for them):` : 'This strikes, because nobody is ready for it:'}<ul>${fates.join('')}</ul></li>` : '<li>✅ Your crew is ready for every hazard here, so a normal failure just comes home empty-handed.</li>'}
            ${ready.length ? `<li>🎲 On a natural 1, any hazard here can strike — even ${ready.map((h) => `${E.HAZ[h].icon} ${esc(E.HAZ[h].name)}`).join(' or ')}, which you’re ready for.</li>` : ''}
            ${deep.join('')}
            <li>🧭 The next dive here (by either company) gets +1.</li>
          </ul></div>
        </div>`;
      } else if (!x && sub && plan.crew.length) {
        box = `<div class="odds-box" style="--oc:#8ff0b4"><div class="odds-big"><span>Salvage</span><b>🪙${1 + plan.crew.length}</b></div></div>`;
      }
      const go = x ? `🎲 Dive!` : `🪙 Go salvaging`;
      return `${head}
        <h3>🚢 Submarine${x ? ' <small class="muted">or swim out from the dive boat</small>' : ''}</h3><div class="pick" id="pk-sub">${subs || '<p class="empty">No subs.</p>'}</div>
        <h3>🤿 Crew <small class="muted">${plan.crew.length}/${seats} ${swim ? 'swimmers' : 'seats'}</small></h3><div class="pick" id="pk-crew">${divers || '<p class="empty">No divers.</p>'}</div>
        ${box}
        <div class="btn-row"><button class="btn big" id="plan-go" ${(sub || swim) && plan.crew.length ? '' : 'disabled'}>${go}</button></div>`;
    };
    const back = openModal('<div id="plan"></div>', { cls: 'wide', onClose: () => {} });
    const root = back.querySelector('#plan');
    root.innerHTML = draw();
    root.addEventListener('click', (e) => {
      const sb = e.target.closest('[data-sub]');
      if (sb && !sb.disabled) {
        plan.s = sb.dataset.sub === 'swim' ? 'swim' : Number(sb.dataset.sub);
        const sub = plan.s === 'swim' ? null : E.subOf(p, plan.s);
        const seats = sub ? E.SUB[sub.k].crew : E.SWIM_CREW;
        if (x) {
          const best = E.bestCrew(s, pi, x, sub);
          plan.crew = best.map((d) => d.id);
        } else plan.crew = plan.crew.slice(0, seats);
        root.innerHTML = draw();
        return;
      }
      const db = e.target.closest('[data-diver]');
      if (db && !db.disabled) {
        const id = Number(db.dataset.diver);
        const sub = plan.s != null && plan.s !== 'swim' ? E.subOf(p, plan.s) : null;
        if (plan.crew.includes(id)) plan.crew = plan.crew.filter((y) => y !== id);
        else if (sub && plan.crew.length >= E.SUB[sub.k].crew) toast(`A ${esc(E.SUB[sub.k].name)} only has ${plural(E.SUB[sub.k].crew, 'seat')}.`, 'bad');
        else if (plan.s === 'swim' && plan.crew.length >= E.SWIM_CREW) toast(`Only ${plural(E.SWIM_CREW, 'diver')} can swim out from the boat.`, 'bad');
        else plan.crew.push(id);
        root.innerHTML = draw();
        return;
      }
      if (e.target.closest('#plan-go')) {
        closeModal(true);
        if (x && rig20On()) G.rigged = true;
        doAction(x ? { t: 'dive', x: x.id, s: plan.s === 'swim' ? null : plan.s, crew: plan.crew.slice(), ...(rig20On() ? { rig20: true } : {}) } : { t: 'salvage', s: plan.s, crew: plan.crew.slice() });
      }
    });
  }

  // Exactly what a hazard would do to this crew and sub.
  function hazardFate(h, sub, crew, gold) {
    const H = E.HAZ[h];
    const names = (list) => list.map((d) => `<b>${esc(d.name)}</b>`).join(' and ');
    const subName = sub ? `<b>${esc(E.SUB[sub.k].name)}</b>` : '';
    switch (h) {
      case 'shark': {
        const low = Math.min(...crew.map(E.skillOf));
        const weak = crew.filter((d) => E.skillOf(d) === low);
        return `${H.icon} ${esc(H.name)}: a shark eats ${weak.length > 1 ? `one of ${names(weak)}` : names(weak)} (the least skilled) — gone for good.`;
      }
      case 'kraken':
        return sub ? `${H.icon} ${esc(H.name)}: the Kraken destroys the ${subName}${sub.mods.length ? ' and its fittings' : ''}; ${names(crew)} swim home and rest next tide.` : `${H.icon} ${esc(H.name)}: the Kraken drags off one of ${names(crew)} for good; the rest swim home and rest next tide.`;
      case 'cave':
        return sub ? `${H.icon} ${esc(H.name)}: the ${subName} gets stuck and is out of action for the next 2 tides.` : `${H.icon} ${esc(H.name)}: ${names(crew)} get trapped and rest for the next 2 tides.`;
      case 'current':
        return `${H.icon} ${esc(H.name)}: you lose 🪙${Math.min(3, gold)} of gear, and ${sub ? `the ${subName} is out next tide` : `${names(crew)} rest next tide`}.`;
      case 'trap':
        return `${H.icon} ${esc(H.name)}: you pay 🪙${Math.min(2, gold)} for repairs, and ${sub ? `the ${subName} is out next tide` : `${names(crew)} rest next tide`}.`;
      default:
        return `${H.icon} ${esc(H.name)}: ${names(crew)} ${H.fail}, and rest next tide.`;
    }
  }

  // The penalty for a failed dive, item by item, with when everything comes back.
  function penaltyHtml(r, p) {
    const s = st();
    const whose = (G.mode === 'ai' && !p.ai) || (G.mode === 'online' && r.pi === G.me) ? 'you' : esc(p.name);
    const back = (t) => {
      if (t > E.TIDES) return 'for the rest of the season';
      const n = t - s.tide - 1;
      return `${n === 1 ? 'next tide' : `for the next ${n} tides`} (back on tide ${t})`;
    };
    const pen = r.pen;
    const items = [];
    if (!pen) {
      return `<div class="pen-box"><h4>⚖️ The penalty</h4><p>See “What happened” above.</p></div>`;
    }
    pen.lost.forEach((n) => items.push(`💀 <b>${esc(n)} is gone for good</b> — that diver leaves the company.`));
    if (pen.wrecked) items.push(`💥 <b>The ${esc(pen.wrecked)} is destroyed</b>, along with any fittings on it.`);
    if (pen.gold) items.push(`🪙 <b>−${pen.gold} gold</b> (${whose === 'you' ? 'you have' : `${whose} has`} 🪙${p.gold} left).`);
    if (pen.subBack) items.push(`🔧 <b>The ${esc(E.SUB[r.sk].name)} is out of action ${back(pen.subBack)}.</b>`);
    const groups = {};
    pen.rest.forEach((d) => (groups[d.back] = groups[d.back] || []).push(esc(d.name)));
    Object.keys(groups).forEach((t) => {
      const names = groups[t];
      const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
      items.push(`😴 <b>${list} ${names.length > 1 ? 'are' : 'is'} resting and can’t dive ${back(+t)}.</b>`);
    });
    const none = !items.length;
    const kept = [];
    if (!pen.wrecked && r.sk && !pen.subBack) kept.push(`the ${esc(E.SUB[r.sk].name)} is fine and can dive again next tide`);
    const fine = r.crewNames.filter((n) => !pen.lost.includes(n) && !pen.rest.some((d) => d.name === n));
    if (fine.length) kept.push(`${fine.map(esc).join(' and ')} ${fine.length > 1 ? 'are' : 'is'} fine and can dive again next tide`);
    return `<div class="pen-box${none ? ' none' : ''}"><h4>${none ? '✅ No penalty' : `⚖️ The penalty${whose === 'you' ? '' : ` for ${whose}`}`}</h4>
      ${none ? '<p>Everyone came home safe. The only cost is the turn: no pearls or gold this time.</p>' : `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul><p class="pen-plus">Plus no pearls or gold from this dive.</p>`}
      ${kept.length && !none ? `<p class="pen-kept">Still OK: ${kept.join('; ')}.</p>` : ''}</div>`;
  }

  // ---------------------------------------------------------------- the dice
  const D20_SVG = (c) => `<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill="${c}" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><polygon points="50,22 76,66 24,66" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.75)" stroke-width="2"/><path d="M50 3 50 22 M93 27 76 66 M7 27 24 66 M50 97 24 66 M50 97 76 66 M93 73 76 66 M7 73 24 66 M7 27 50 22 M93 27 50 22" stroke="rgba(255,255,255,0.5)" stroke-width="1.6" fill="none"/></svg>`;

  function showRoll(r, opts) {
    const s = st();
    const p = pl(r.pi);
    const site = E.SITE[r.k];
    const fast = G.mode === 'sim' ? SIM_SPEEDS[G.speed].roll : null;
    if (fast === 0) return opts.done();
    ui.busy = true;
    const crew = r.crewNames.map(esc).join(', ');
    const back = openModal(`<div class="roll">
        <h2>${esc(site.name)}</h2>
        <p>${r.sk ? `<span class="who" style="color:${PCOLOR[r.pi]}">${esc(E.poss(p.name))}</span> ${esc(E.SUB[r.sk].name)} dives with ${crew}.` : `<span class="who" style="color:${PCOLOR[r.pi]}">${esc(p.name)}</span>: ${crew} ${r.crew.length > 1 ? 'swim' : 'swims'} out from the dive boat.`}</p>
        ${r.crewK ? `<div class="roll-crew">${r.crew.map((id, i) => diverPic({ id, k: r.crewK[i] }, 'diving')).join('')}</div>` : ''}
        <div class="roll-need">Hoping for <b>${needText(r.need)}</b> on the die</div>
        <div class="d20" id="d20">${D20_SVG('#78858c')}<span>?</span></div>
        <div id="roll-track">${dieTrack(r.need)}</div>
        <div class="roll-sum" id="roll-sum">Target ${r.target}: the die plus ${r.bonus >= 0 ? r.bonus : `(${r.bonus})`} in bonuses must reach it.</div>
        <div class="roll-verdict" id="roll-verdict"></div>
        <div class="roll-msgs" id="roll-msgs"></div>
        <div class="btn-row" style="justify-content:center"><button class="btn" id="roll-ok" hidden>${opts.auto ? 'Continue' : 'OK'}</button></div>
      </div>`, { noClose: true, cls: 'locked' });
    const die = back.querySelector('#d20');
    const num = die.querySelector('span');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(spin);
      timers.forEach(clearTimeout);
      ui.busy = false;
      closeModal(true);
      opts.done();
    };
    const timers = [];
    die.classList.add('spin');
    sfx('dice');
    const spin = setInterval(() => (num.textContent = 1 + Math.floor(Math.random() * 20)), 70);
    const rival = opts.auto && !fast;
    const landAt = fast ? Math.min(900, fast / 2) : rival ? 650 : 1200;
    timers.push(setTimeout(() => {
      clearInterval(spin);
      die.classList.remove('spin');
      die.classList.add('land');
      die.classList.add(r.ok ? 'success' : 'failure');
      num.textContent = r.d20;
      back.querySelector('#roll-track').innerHTML = dieTrack(r.need, r.d20);
      back.querySelectorAll('.roll-crew .pic').forEach((el, i) => {
        el.classList.remove('diving');
        el.classList.add(r.ok ? 'cheer' : r.pen && r.pen.lost.includes(r.crewNames[i]) ? 'lost' : 'sad');
      });
      const why = r.d20 === 20 ? 'A natural 20 always succeeds!' : r.d20 === 1 ? 'A natural 1 always fails!' : r.ok ? `That’s ${needText(r.need)}.` : `It needed ${needText(r.need)} — missed by ${r.need - r.d20}.`;
      back.querySelector('#roll-sum').innerHTML = `The die shows <b>${r.d20}</b>. ${why}<br><small>${r.d20} ${r.bonus >= 0 ? '+' : '−'} ${Math.abs(r.bonus)} = ${r.total < 0 ? `−${-r.total}` : r.total} against a target of ${r.target}.</small>`;
      const v = back.querySelector('#roll-verdict');
      v.className = `roll-verdict ${r.ok ? 'ok' : 'fail'}`;
      v.innerHTML = r.ok ? `${PEARL} Pearls!` : '💥 The dive failed';
      const msgs = [];
      if (r.ok) {
        msgs.push(`Found <b>${PEARL}${r.treasure} pearls</b> and <b>🪙${r.gold}</b>${r.d20 === 20 ? ' (with 🪙2 of extra loot)' : ''}.`);
        if (r.relic) msgs.push(`${E.RELIC[r.relic].icon} A relic for the collection: <b>${esc(E.RELIC[r.relic].name.toLowerCase())}</b>.`);
        if (r.first) msgs.push(`🏆 First company to finish a ${esc(E.TIER[site.tier].name.toLowerCase())} expedition: +${E.DISCOVERY_PTS} points!`);
        if (r.promoted && r.promoted.length) msgs.push(`🎖️ ${r.promoted.map(esc).join(' and ')} ${r.promoted.length > 1 ? 'were' : 'was'} promoted: +1 skill, and trained one zone deeper.`);
        if (r.opened && r.opened.length) msgs.push(`🗺️ New routes charted to ${r.opened.map((k) => esc(E.SITE[k].name)).join(' and ')}.`);
        if (r.k === 'heart') msgs.push('💠 <b>The Heart of Atlantis!</b> The season ends after this tide.');
      } else {
        const H = r.strike && E.HAZ[r.strike];
        const story = H
          ? `${H.icon} <b>${esc(H.name)}</b> struck. ${r.d20 === 1 ? 'On a natural 1 any hazard at the site can strike, even one the crew was ready for.' : `Nobody on the dive was ready for it — ${esc(H.ready.toLowerCase())} keep it away.`}`
          : 'The crew was ready for every hazard down there, so nothing attacked them.';
        msgs.push(`<div class="what-box"><h4>📖 What happened</h4><p>${story}</p>${r.msgs.map((m) => `<p>${esc(m)}</p>`).join('')}</div>`);
        msgs.push(penaltyHtml(r, p));
        msgs.push(`🧭 The next dive here, by either company, gets +${r.scout} from what was learned.`);
      }
      (r.goals || []).forEach((k) => msgs.push(`${E.GOALS[k].icon} Commission complete — <b>${esc(E.GOALS[k].name)}</b>: +${E.GOALS[k].pts} points!`));
      back.querySelector('#roll-msgs').innerHTML = msgs.map((m) => (m.startsWith('<div') ? m : `<p>${m}</p>`)).join('');
      sfx(r.ok ? 'good' : 'bad');
      if (r.ok) sfx('coin', 300);
      const ok = back.querySelector('#roll-ok');
      ok.hidden = false;
      ok.onclick = finish;
      ok.focus();
      if (opts.auto) timers.push(setTimeout(finish, fast || (r.ok ? 2200 : 4500)));
    }, landAt));
  }

  // ---------------------------------------------------------------- shipyard
  function openYard() {
    const s = st();
    const p = pl(s.turn);
    const full = p.subs.length >= E.MAX_SUBS;
    const builds = E.SUB_ORDER.map((k) => {
      const B = E.SUB[k];
      const why = full ? 'Docks full' : p.gold < B.cost ? `Need 🪙${B.cost}` : '';
      return `<div class="card">${subPic(k)}<b>${esc(B.name)}</b><button class="btn sm" data-build="${k}" ${why ? 'disabled' : ''}>${why || `Build 🪙${B.cost}`}</button><div><small>${plural(B.crew, 'seat')} · built for the ${esc(E.DEPTH[B.depth].name)} · ${B.bonus ? `+${B.bonus} to rolls` : 'no roll bonus'} · ${plural(B.slots, 'fitting slot')}</small><br><small>${esc(B.note)}</small></div></div>`;
    }).join('');
    const ups = p.subs.map((sub) => {
      const opts = E.SUB_ORDER.filter((k) => E.SUB[k].cost > E.SUB[sub.k].cost).map((k) => {
        const cost = E.upgradeCost(sub, k);
        const why = sub.stuck >= s.tide ? 'Out of action' : p.gold < cost ? `Need 🪙${cost}` : '';
        return `<button class="btn sm ghost" data-up="${sub.id}:${k}" ${why ? 'disabled' : ''} title="${why ? esc(why) : ''}">→ ${esc(E.SUB[k].name)} 🪙${cost}</button>`;
      }).join(' ');
      return opts ? `<div class="card">${subPic(sub.k)}<b>${esc(E.SUB[sub.k].name)}</b><span></span><div class="tags">${opts}</div></div>` : '';
    }).join('');
    const fits = p.subs.filter((sub) => sub.mods.length < E.SUB[sub.k].slots).map((sub) => {
      const opts = E.MOD_ORDER.filter((m) => !sub.mods.includes(m)).map((m) => {
        const M = E.MOD[m];
        const why = p.gold < M.cost ? `Need 🪙${M.cost}` : '';
        return `<button class="btn sm ghost" data-fit="${sub.id}:${m}" ${why ? 'disabled' : ''} title="Makes ${esc(E.HAZ[M.haz].name)} safe on this sub">${M.icon} ${esc(M.name)} 🪙${M.cost}</button>`;
      }).join(' ');
      return `<div class="card">${subPic(sub.k)}<b>${esc(E.SUB[sub.k].name)}</b><span class="tag">${plural(E.SUB[sub.k].slots - sub.mods.length, 'slot')} free</span><div class="tags">${opts}</div></div>`;
    }).join('');
    const back = openModal(`<h2>🛠️ The shipyard</h2>
      <p class="muted">Bigger subs carry more divers, reach deeper ruins and add to every roll. Fittings make one hazard safe for any crew in that sub. Each purchase uses your move.</p>
      <p class="gold-line">🪙${p.gold} · ${p.subs.length}/${E.MAX_SUBS} docks used</p>
      <div class="shop"><h3>Build a new sub</h3>${builds}
      ${ups ? `<h3>Rebuild a sub as a bigger model <small class="muted">(pay the difference, fittings stay)</small></h3>${ups}` : ''}
      ${fits ? `<h3>Fittings</h3>${fits}` : '<p class="muted">Barracudas and bigger subs have room for fittings.</p>'}</div>`, { cls: 'wide', onClose: () => {} });
    back.addEventListener('click', (e) => {
      const b = e.target.closest('[data-build], [data-up], [data-fit]');
      if (!b || b.disabled) return;
      closeModal(true);
      if (b.dataset.build) return doAction({ t: 'build', k: b.dataset.build });
      if (b.dataset.up) {
        const [id, k] = b.dataset.up.split(':');
        return doAction({ t: 'upgrade', s: Number(id), k });
      }
      const [id, m] = b.dataset.fit.split(':');
      doAction({ t: 'fit', s: Number(id), m });
    });
  }

  // ---------------------------------------------------------------- computer turns
  function stopAI() {
    clearTimeout(ui.aiTimer);
    ui.aiTimer = null;
  }
  function scheduleAI() {
    stopAI();
    if (!G || ui.modal || ui.busy || st().phase !== 'act' || !pl(st().turn).ai) return;
    const wait = G.mode === 'sim' ? SIM_SPEEDS[G.speed].ai : 400;
    ui.aiTimer = setTimeout(aiStep, wait);
  }
  function aiStep() {
    if (!G || ui.modal || st().phase !== 'act') return;
    const pi = st().turn;
    if (!pl(pi).ai) return;
    const level = G.mode === 'sim' ? G.levels[pi] : G.level;
    const a = E.aiChoose(st(), pi, level);
    const fast = G.mode === 'sim' && G.speed === 'turbo';
    doAction(a);
  }
  // One line saying what a move did, straight from the captain's log, plus the gold it left.
  // Your own pass isn't announced (the banner says it); dives get the roll instead.
  function tellMove(pi, lines, goldBefore, own) {
    if (G.mode === 'sim' && G.speed === 'turbo') return;
    const line = lines.find((l) => l.who === pi && !/commission/.test(l.text));
    if (!line || (own && /is done for this tide/.test(line.text))) return;
    const p = pl(pi);
    const gold = p.gold === goldBefore ? '' : ` <small>· 🪙${p.gold} ${p.gold < goldBefore ? 'left' : 'now'}</small>`;
    toast(`<span class="dot" style="--pc:${PCOLOR[pi]}"></span>${esc(line.text)}${gold}`, own ? '' : 'ai');
  }
  function tellGoals(s) {
    if (G.mode === 'sim' && G.speed === 'turbo') return;
    (s.claimed || []).forEach((k) => {
      const g = s.goals.find((y) => y.k === k);
      if (!g || g.by == null) return;
      toast(`${E.GOALS[k].icon} <b>${esc(pl(g.by).name)}</b> completed the <b>${esc(E.GOALS[k].name)}</b> commission: +${E.GOALS[k].pts} points!`);
      sfx('reveal');
    });
  }
  const isOwn = (pi) => (G.mode === 'online' ? pi === G.me : !pl(pi).ai);

  // ---------------------------------------------------------------- game over
  function showGameOver(instant) {
    const s = st();
    const sc = s.players.map((p) => E.score(s, p));
    const w = E.winner(s);
    const rows = [
      [`${PEARL} Pearls`, 'treasure'],
      ['🏆 First finds', 'discoveries'],
      ['🏺 Relic sets', 'relics'],
      ['📜 Commissions', 'goals'],
      [`🪙 Gold (1 per ${E.GOLD_PER_PT})`, 'gold'],
    ];
    if (G.mode === 'ai' || G.mode === 'local') recordGame();
    let head;
    if (w < 0) head = '🤝 A perfect tie!';
    else if (G.mode === 'ai') head = pl(w).ai ? '🦈 The rival wins!' : '🏆 You win!';
    else head = `🏆 ${esc(pl(w).name)} wins!`;
    const margin = Math.abs(sc[0].total - sc[1].total);
    const sub = w < 0 ? 'Same points, same pearls, same number of expeditions.'
      : margin === 0 ? 'Level on points — won on pearls!'
        : margin === 1 ? 'By a single point — what a finish!'
          : margin <= 5 ? `A nail-biter — by ${margin} points!` : `By ${margin} points.`;
    const flagImg = (p) => {
      const top = p.subs.slice().sort((a, b) => E.SUB[b.k].cost - E.SUB[a.k].cost)[0];
      return IMG('sub-' + (top ? top.k : 'minnow'));
    };
    const side = (i) => `<div class="hr-side" style="--pc:${PCOLOR[i]}"><span class="hr-crown">👑</span><img src="${flagImg(pl(i))}" alt=""><b class="hr-name">${esc(pl(i).name)}</b><span class="hr-total">?</span><small>${plural(pl(i).found.length, 'expedition')}${pl(i).found.includes('heart') ? ' · 💠 the Heart!' : ''}</small></div>`;
    document.querySelectorAll('.at-reveal').forEach((x) => x.remove());
    const el = document.createElement('div');
    el.className = 'at-reveal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Final results');
    el.innerHTML = `<div class="hr-rays"></div><div class="hr-stage">
        <div class="hr-title">🏁 The expedition season is over</div>
        <div class="hr-duel">${side(0)}<div class="hr-vs">VS</div>${side(1)}</div>
        <div class="hr-verdict" aria-live="polite"></div>
        <div class="hr-sub">${sub}</div>
        <div class="hr-rows">${rows.map(([label, k]) => `<div class="hr-row"><span class="${sc[0][k] > sc[1][k] ? 'lead' : ''}">${sc[0][k]}</span><small>${label}</small><span class="${sc[1][k] > sc[0][k] ? 'lead' : ''}">${sc[1][k]}</span></div>`).join('')}</div>
        <div class="hr-actions"><button class="btn" data-rv="close">🗺️ See the chart</button>${G.mode === 'past' ? '' : `<button class="btn" data-rv="again">${G.mode === 'online' ? '🌐 Your games' : G.mode === 'sim' ? '🧪 Run again' : '🔱 Play again'}</button>`}${G.mode === 'sim' ? '' : '<button class="btn ghost" data-rv="hist">🏆 Game history</button>'}<a class="btn ghost" href="/ahrens-games"><img class="gh-dice" src="/img/board-games-favicon-48.png?v=8" alt=""> All board games</a></div>
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
      const happy = w < 0 || G.mode !== 'ai' || !pl(w).ai;
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
        if (G.mode === 'online') { Online.forgetOnline(); return showSetup(G.id); }
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
    // Drumroll, then the winner, then the scorecard row by row.
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
    const bits = ['🎉', '🦪', '🪙', '🐚', '✨', '🔱'];
    for (let i = 0; i < 40; i++) {
      const sp = document.createElement('span');
      sp.innerHTML = pearls(bits[i % bits.length]);
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
    return 'al' + [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  // Finished games wait in this browser until the server has them, so a dropped connection or an expired
  // sign-in can't lose one: they're sent again on the next visit.
  const HISTORY_QUEUE = 'ahrensAtlantis.historyQueue';
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
      // Out of room: keep the results and drop the move-by-move logs from the saved boards.
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
        const r = await api('/api/atlantis/history/record', item);
        // A record the server turns down as invalid would never be taken, so it isn't retried.
        if (!r.ok && r.status !== 400) break;
        setQueued(queued().filter((x) => x.id !== item.id));
        if (r.ok) markSaved(item.id);
      }
    } finally {
      sending = false;
    }
  }
  // Remember the server has this game, in the current game and in the save slot.
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
      id: g.gid,
      kind: g.mode,
      level: g.level,
      names: s.players.map((p) => p.name),
      cats: s.players.map((p) => E.score(s, p)),
      winner: E.winner(s),
      board: s,
    };
  }
  function recordGame() {
    const g = G;
    if (!g || g.recorded || g.rigged || !sessionId()) return;
    g.gid = g.gid || newLocalId();
    g.recorded = true;
      save();
    const item = historyItem(g);
    setQueued(queued().filter((x) => x.id !== item.id).concat(item));
    sendQueued();
  }
  // A finished game left in this browser's save slot that the server never confirmed goes back in the queue
  // (games that ended while history couldn't be saved).
  function requeueLastGame() {
    const g = rawSave();
    if (!g || !g.state || g.state.phase !== 'over' || g.historyOk || !g.gid || (g.mode !== 'ai' && g.mode !== 'local') || g.rigged) return;
    if (!queued().some((x) => x.id === g.gid)) setQueued(queued().concat(historyItem(g)));
  }

  async function openPast(id) {
    const r = await api(`/api/atlantis/history/board?id=${encodeURIComponent(id)}`);
    const state = r.ok && r.data && r.data.state;
    if (!state || !Array.isArray(state.players) || state.phase !== 'over') return toast(esc((r.data && r.data.error) || 'Couldn’t load that game.'), 'bad');
    if (state.v !== E.SAVE_V) return toast('That game was played before the chart of Atlantis was drawn, so its board can’t be shown.', 'bad');
    const h = (hist.items || []).find((x) => x.id === id);
    startFrom({ state, mode: 'past', level: h && h.level, view: r.data.me != null ? r.data.me : h && h.me != null ? h.me : 0, gid: id, revealed: true });
  }

  const hist = { items: null, kind: 'all' };
  const SCORE_ROWS = [[`${PEARL} Pearls`, 'treasure'], ['🏆 First finds', 'discoveries'], ['🏺 Relic sets', 'relics'], ['📜 Commissions', 'goals'], ['🪙 Gold', 'gold'], ['🗺️ Expeditions', 'expeditions']];

  async function showHistory() {
    location.href = '/game-history.html?game=atlantis';
    return;
    stopAI();
    G = null;
    document.body.className = 'setup-mode';
    $('#app').innerHTML = `
      <div class="setup gh">
      <div class="gh-top"><a class="gh-lobby" href="/ahrens-games" title="Back to the game lobby">← <img class="gh-dice" src="/img/board-games-favicon-48.png?v=8" alt="" width="20" height="20"> Game lobby</a><button class="btn ghost sm" id="hist-new">🔱 New game</button></div>
        <div class="setup-card gh-card panel hist">
          <h2>🏆 Game history</h2>
          <div id="hist-body"><p class="muted">Loading your games…</p></div>
        </div>
    </div>`;
    $('#hist-new').onclick = () => showSetup();
    const r = await api('/api/atlantis/history');
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
      game: 'atlantis',
      fmt: (n) => `${n} pts`,
      rows: SCORE_ROWS,
      colors: PCOLOR,
      levels: LEVEL_NAME,
      foe: 'rival company',
      view: '🗺️ View the chart',
      canView: (h) => h.board || h.kind === 'online',
      onView: openPast,
      empty: 'No finished expeditions yet. Games are added when they end.',
    }, hist);
  }

  // ---------------------------------------------------------------- computer vs computer (admin)
  function openSimSetup() {
    const sim = Object.assign({ l0: 'hard', l1: 'normal', speed: 'fast' }, prefs().sim);
    const speeds = {};
    Object.keys(SIM_SPEEDS).forEach((k) => (speeds[k] = SIM_SPEEDS[k].name));
    const seg = (k, opts) => `<div class="seg" data-k="${k}">${Object.keys(opts).map((v) => `<button data-v="${v}" class="${sim[k] === v ? 'on' : ''}">${opts[v]}</button>`).join('')}</div>`;
    const back = openModal(`<h2>🧪 Computer vs computer</h2>
      <p class="muted">Admin only. Two computers play a whole season while you watch. Nothing is saved or added to game history.</p>
      <div class="field"><span class="label">🔴 Red company</span>${seg('l0', LEVEL_NAME)}</div>
      <div class="field"><span class="label">🔵 Blue company</span>${seg('l1', LEVEL_NAME)}</div>
      <div class="field"><span class="label">Speed</span>${seg('speed', speeds)}</div>
      <button class="btn big" id="sim-go">▶ Start</button>`, { onClose: () => {} });
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
    closeModal(true);
    const state = E.newGame({ names: [`Red · ${LEVEL_NAME[sim.l0]}`, `Blue · ${LEVEL_NAME[sim.l1]}`], ai: [true, true], first: Math.random() < 0.5 ? 0 : 1 });
    E.aiHeadStart(state, 0, sim.l0);
    E.aiHeadStart(state, 1, sim.l1);
    startFrom({ state, mode: 'sim', level: sim.l0, levels: [sim.l0, sim.l1], speed: sim.speed, view: 0 });
  }
  function stopSim() {
    stopAI();
    ui.busy = false;
    closeModal(true);
    document.querySelectorAll('.at-reveal').forEach((x) => x.remove());
    showSetup();
  }

  // ---------------------------------------------------------------- rules
  const RULE_CHAPTERS = [
    ['overview', 'Overview'],
    ['setup', 'Setting up'],
    ['play', 'How a season plays'],
    ['actions', 'Your actions'],
    ['dive', 'Diving'],
    ['hazards', 'Hazards & penalties'],
    ['crew', 'Divers, subs & fittings'],
    ['chart', 'The chart & the sea'],
    ['score', 'Scoring & winning'],
    ['terms', 'Quick reference'],
  ];
  function rulesBody(tab) {
    const T = E.TIER;
    const n = RULE_CHAPTERS.findIndex((c) => c[0] === tab) + 1;
    const sec = (i, title) => `<h4 class="rb-sec"><span>${n}.${i}</span> ${title}</h4>`;
    const head = `<h3 class="rb-ch"><small>Chapter ${n}</small>${RULE_CHAPTERS[n - 1][1]}</h3>`;
    const wage = (k) => E.DIVER[k].wage;
    let body = '';
    if (tab === 'overview') {
      body = `${window.AhrensTutorial ? '<p class="rb-video"><button class="btn sm" data-tutorial="atlantis">🎬 Watch the video tutorial</button> New to the game? The video plays a real game against the computer, step by step.</p>' : ''}
        ${sec(1, 'The story')}
        <p>You run a diving company racing a rival company to the treasures of sunken Atlantis. Over one season of <b>${E.TIDES} tides</b> you hire <b>divers</b>, build <b>submarines</b> and send them on <b>expeditions</b> to the sites on the chart.</p>
        ${sec(2, 'How to win')}
        <p>When the season ends, the company with the <b>most points</b> wins. Points come from ${PEARL} <b>pearls</b> you bring up, 🏆 being <b>first</b> to finish each level of expedition, 🏺 <b>relic sets</b>, 📜 <b>commissions</b> and leftover 🪙 <b>gold</b>. (See chapter 9.)</p>
        ${sec(3, 'What’s in the game')}
        <ul><li>🗺️ <b>The chart</b> — the dive sites, in five rows from the easy shallows down to the Heart of Atlantis.</li>
        <li>🚩 <b>Two companies</b> — each has gold, divers, subs, pearls and relics.</li>
        <li>🤿 <b>The dive hall</b> — ${E.MARKET_SIZE} divers looking for work, shared by both companies.</li>
        <li>🌤️ <b>The sea forecast</b> — one sea event per tide, changing what’s easy and what’s dangerous.</li>
        <li>📜 <b>${E.GOAL_COUNT} commissions</b> — public bonus goals that the first company to complete scores.</li>
        <li>🎲 <b>A twenty-sided die (d20)</b> — rolled for every dive.</li></ul>
        ${sec(4, 'The game in one paragraph')}
        <p>Each tide, the two companies take turns doing one thing at a time — diving, hiring, building or a safe salvage run — until both have ended their tide. Then the sea changes, everyone is paid and pays wages, and the next tide begins. Every dive is a gamble: roll the d20, add your bonuses, and beat the site’s target. Win and you take its pearls; lose and a hazard may cost you gold, time, divers or even a sub.</p>`;
    } else if (tab === 'setup') {
      body = `${sec(1, 'The chart')}
        <p>Each game draws its own dive sites for every row of the chart, and every site gets its own haul of pearls and gold. The top row is charted from the start; everything below has to be reached by exploring.</p>
        ${sec(2, 'Each company starts with')}
        <ul><li>🪙 <b>${E.START_GOLD} gold</b></li><li>🚢 <b>one Minnow</b> submarine (seats 1, built for the Shallows)</li><li>🤿 <b>one rookie diver</b></li><li>no pearls and no relics</li></ul>
        ${sec(3, 'The dive hall')}
        <p>${E.MARKET_SIZE} divers are drawn into the dive hall, ready to be hired by either company.</p>
        ${sec(4, 'The forecast and commissions')}
        <p>A sea event is drawn for every tide of the season. <b>Tide 1 is always ${E.SEA.calm.icon} ${E.SEA.calm.name}</b>, so nobody loses a diver before they can hire anyone. You can always see the current tide’s event and the next one coming. Then ${E.GOAL_COUNT} commissions are drawn for this game.</p>
        ${sec(5, 'Who goes first')}
        <p>One company is picked to move first on tide 1. After that, the first move <b>alternates every tide</b>.</p>
        ${sec(6, 'Playing the computer')}
        <p>Easy and Normal computers start like you. A <b>Hard</b> computer starts with 🪙${E.AI_HEAD_START.hard.gold} extra; a <b>Brutal</b> one starts with 🪙${E.AI_HEAD_START.brutal.gold} extra, a second rookie and a Barracuda instead of a Minnow.</p>`;
    } else if (tab === 'play') {
      body = `${sec(1, 'A season at a glance')}
        <p>The game lasts <b>${E.TIDES} tides</b> (rounds). Every tide goes the same way:</p>
        <ol class="rb-flow"><li><b>The tide begins</b> — its sea event takes effect.</li><li><b>Turns</b> — the companies take turns, one action each, back and forth.</li><li><b>Ending the tide</b> — each company ends its tide when it’s done.</li><li><b>Between the tides</b> — income, wages and the dive hall are sorted out.</li><li>The next tide begins — or the season ends.</li></ol>
        <p>A tide counter (🌊 Tide 3 of ${E.TIDES}) is always shown at the top of the board, and a report pops up between tides showing exactly what changed.</p>
        ${sec(2, 'The start of a tide')}
        <p>The tide’s <b>sea event</b> lasts for the whole tide, for both companies — for example, 🌀 Riptides make currents more dangerous, and ⛈️ a Storm keeps Minnows in port. Every sub and diver that isn’t resting or out of action is <b>ready</b> again. On tide ${E.HEART_TIDE}, 💠 <b>the Heart of Atlantis is sighted</b> and can be dived for from then on.</p>
        ${sec(3, 'Taking turns')}
        <p>On your turn you take <b>exactly one action</b> (see chapter 4): dive, salvage, hire, build/rebuild/fit, or end your tide. Then it’s the other company’s turn. Each sub and each diver can only go out <b>once per tide</b>, so your number of dives each tide is limited by your ready subs and divers.</p>
        ${sec(4, 'Ending your tide')}
        <p>When you have nothing more you want to do, choose <b>⏭ End tide</b>. You can’t take any more actions this tide. If your rival hasn’t ended theirs yet, <b>they keep taking turns on their own</b> until they end it too. The tide is over once <b>both</b> companies have ended it.</p>
        ${sec(5, 'Between the tides')}
        <p>When both companies have ended the tide, these steps happen in order:</p>
        <ol class="rb-flow"><li><b>Is the season over?</b> If that was tide ${E.TIDES}, or the Heart of Atlantis was found this tide, the game ends now (section ${n}.6).</li>
        <li><b>The tide counter moves on</b> and the next sea event begins.</li>
        <li><b>Income:</b> each company collects 🪙${E.INCOME} (🪙${E.INCOME + 3} during a ${E.SEA.gala.icon} ${E.SEA.gala.name}).</li>
        <li><b>Wages:</b> each company pays every diver’s wage, cheapest first. A diver you can’t pay <b>quits</b> and leaves your company.</li>
        <li><b>Rest and repairs:</b> divers who were told to rest and subs that were out of action come back when their time is up (the tide report lists who is still out).</li>
        <li><b>The dive hall changes:</b> the diver who has waited longest leaves, everyone still waiting gets 🪙1 cheaper (down to half price), and new divers arrive until there are ${E.MARKET_SIZE} again.</li>
        <li><b>Commissions</b> are checked for both companies.</li></ol>
        ${sec(6, 'The end of the season')}
        <p>The season ends after <b>tide ${E.TIDES}</b>, or at the end of the tide in which someone finds 💠 <b>the Heart of Atlantis</b> — whichever comes first. Finding the Heart doesn’t end the tide early: both companies still finish it. Then points are counted (chapter 9).</p>
        ${sec(7, 'An example tide')}
        <p class="rb-ex">It’s tide 3, ${E.SEA.frenzy.icon} ${E.SEA.frenzy.name}. Red moves first and hires a shark wrangler. Blue sends its Barracuda to a tricky site and fails — a current costs 🪙3, and the Barracuda is out next tide. Red dives with its new wrangler and wins 7 pearls. Blue has nothing left ready, so it ends its tide. Red does a salvage run with its rookie for 🪙2, then ends its tide too. Between the tides each company collects 🪙${E.INCOME} and pays wages, the dive hall changes, and tide 4 begins with Blue moving first.</p>`;
    } else if (tab === 'actions') {
      body = `<p>On your turn, take <b>one</b> of these actions.</p>
        ${sec(1, '🎲 Dive')}
        <p>Send one ready sub and a crew that fits in it to any site on the chart — or have up to ${E.SWIM_CREW} divers swim out from the dive boat with no sub at all. Roll the die to see if it works (chapter 5).</p>
        ${sec(2, '🪙 Salvage run')}
        <p>A safe trip with a ready sub and crew: gain 🪙1 plus 🪙1 per diver. No dice, no danger, no pearls. The sub and divers count as having gone out this tide.</p>
        ${sec(3, '🤿 Hire a diver')}
        <p>Pay a diver’s price to hire them from the dive hall. They join ready to dive this tide. Both companies hire from the same hall, so a diver you leave may end up working for your rival. You can keep up to ${E.MAX_DIVERS} divers.</p>
        ${sec(4, '🛠️ Build, rebuild or fit')}
        <ul><li><b>Build</b> a new sub (up to ${E.MAX_SUBS}).</li><li><b>Rebuild</b> a sub as a bigger model by paying the difference in price. It keeps its fittings.</li><li><b>Fit</b> a sub with equipment that makes one hazard safe (chapter 7).</li></ul>
        ${sec(5, '⏭ End your tide')}
        <p>You’re done until the next tide. See section 3.4.</p>`;
    } else if (tab === 'dive') {
      body = `${sec(1, 'Choosing a dive')}
        <p>Pick a site, then a ready sub (or swim) and a crew. You can try <b>any site with any sub and any crew</b>, but deeper sites are much harder, and sending divers or subs deeper than they’re built for is dangerous. The planner shows your exact odds before you commit.</p>
        ${sec(2, 'The number you need')}
        <p>Every site has a <b>target</b> (by level, from ${T[1].target} for easy sites to ${T[5].target} for the Heart). Your crew’s bonuses are added to the die, so the number the die itself has to show is:</p>
        <p class="rb-key"><b>number needed on the die = target − your total bonus</b></p>
        <p class="rb-ex">Example: the target is 12 and your bonuses add up to +3. You need the die to show <b>9 or higher</b>.</p>
        <p>The planner and the dice screen both show this number and highlight every winning face of the die.</p>
        ${sec(3, 'Bonuses (added)')}
        <ul><li>⭐ every diver’s <b>skill</b></li><li>the <b>sub’s bonus</b> (Barracuda +1, Nautilus +2, Leviathan +3)</li><li>🧭 <b>+${E.KNOWN_BONUS} for known waters</b>: a site linked to one your company explored</li><li><b>+1 for each earlier failed attempt</b> at that site, by either company (up to +${E.SCOUT_MAX})</li><li>the sea event, if it helps</li></ul>
        ${sec(4, 'Penalties (subtracted)')}
        <ul><li><b>−${E.UNCOVERED} for every hazard nobody is ready for</b> (chapter 6) — doubled to −${E.UNCOVERED * 2} for some hazards by the sea event</li>
        <li><b>−${E.UNCHARTED}</b> if the site is uncharted</li>
        <li><b>−${E.SUB_DEEP_PEN} per zone</b> the sub is below the depth it’s built for</li>
        <li><b>−${E.DIVER_DEEP_PEN} per zone</b> for every diver out of their depth (rookies are trained only for the Shallows)</li>
        <li>🏊 <b>−${E.SWIM_PEN}</b> for swimming with no sub, plus −${E.SUB_DEEP_PEN} per zone below the Shallows</li></ul>
        ${sec(5, 'Rolling')}
        <p>Roll the d20 and add your bonus. If the total reaches the target, the dive succeeds. A <b>natural 20</b> always succeeds and brings 🪙2 extra loot; a <b>natural 1</b> always fails.</p>
        ${sec(6, 'If the dive succeeds')}
        <ul><li>Take the site’s ${PEARL} pearls and 🪙 gold. The site is explored — nobody can dive it again.</li>
        <li>🏆 If you’re the first company to finish an expedition of that level, score ${E.DISCOVERY_PTS} points.</li>
        <li>🏺 Tricky and harder sites hold a <b>relic</b>.</li>
        <li>🗺️ The routes beyond it become <b>charted</b> for both companies.</li>
        <li>🎖️ Every diver on the crew gains experience; after ${E.PROMO_XP} successful dives a diver is <b>promoted</b> (+1 skill, trained one zone deeper).</li></ul>
        ${sec(7, 'If the dive fails')}
        <p>You get no pearls or gold, and you take the penalty for whatever went wrong (chapter 6). Whatever happens, the next dive at that site — by either company — gets +1 from what was learned.</p>`;
    } else if (tab === 'hazards') {
      body = `${sec(1, 'Being ready')}
        <p>Each site lists its hazards. A hazard is <b>covered</b> if a diver on the crew has that specialty or the sub has the matching fitting. Every hazard nobody is ready for costs −${E.UNCOVERED} on the roll.</p>
        ${sec(2, 'What happens when a dive fails')}
        <ol class="rb-flow"><li><b>One hazard strikes</b>, picked at random from the hazards nobody was ready for. If you were ready for them all, nothing strikes. On a <b>natural 1</b> any hazard at the site can strike — even one you were ready for.</li>
        <li><b>Out of their depth:</b> each diver below their training has a ${pct(E.DIVER_LOST)} chance per zone of being lost for good, and a sub below its depth has a ${pct(E.SUB_CRUSH)} chance per zone of being crushed. Swimmers below the Shallows have a ${pct(E.SWIM_LOST)} chance per zone of being lost.</li></ol>
        <p>The dice screen shows a <b>📖 What happened</b> story and an itemised <b>⚖️ penalty</b> box, including the tide each diver or sub is back.</p>
        ${sec(3, 'The hazards')}
        <table><tr><th>Hazard</th><th>Who is ready for it</th><th>Penalty with a sub</th><th>Penalty when swimming</th></tr>${E.HAZ_ORDER.map((h) => `<tr><td>${E.HAZ[h].icon} ${esc(E.HAZ[h].name)}</td><td>${esc(E.HAZ[h].ready)}</td><td>${esc(E.HAZ[h].effect)}</td><td>${esc(E.HAZ[h].swim || E.HAZ[h].effect)}</td></tr>`).join('')}</table>
        <p>A shark always takes the least skilled diver on the crew.</p>
        ${sec(4, 'Resting and out of action')}
        <p><b>😴 Resting</b> divers and <b>🔧 out of action</b> subs can’t dive or salvage until they’re back. “Rests next tide” means they miss the next tide and are ready the tide after.</p>`;
    } else if (tab === 'crew') {
      body = `${sec(1, 'Divers')}
        <p>Each diver has a skill, a depth they’re trained for, and maybe a specialty that makes one or more hazards safe. Wages are paid between every tide.</p>
        <table><tr><th>Diver</th><th>Skill</th><th>Trained to</th><th>Ready for</th><th>Hire</th><th>Wage</th></tr>${E.DIVER_ORDER.map((k) => {
          const D = E.DIVER[k];
          return `<tr><td><img class="rb-face" src="${IMG('diver-' + k)}" alt="" width="30" height="30" loading="lazy"> ${esc(D.role)}</td><td>${'⭐'.repeat(D.skill)}</td><td>${E.DEPTH[D.deep].name}</td><td>${D.spec.map((h) => E.HAZ[h].icon + ' ' + esc(E.HAZ[h].name)).join(', ') || '—'}</td><td>🪙${D.cost}</td><td>🪙${wage(k)}</td></tr>`;
        }).join('')}</table>
        ${sec(2, 'Submarines')}
        <table><tr><th>Sub</th><th>Seats</th><th>Built for</th><th>Bonus</th><th>Fittings</th><th>Cost</th></tr>${E.SUB_ORDER.map((k) => {
          const B = E.SUB[k];
          return `<tr><td>${esc(B.name)}</td><td>${B.crew}</td><td>${E.DEPTH[B.depth].name}</td><td>${B.bonus ? '+' + B.bonus : '—'}</td><td>${B.slots}</td><td>🪙${B.cost}</td></tr>`;
        }).join('')}</table>
        ${sec(3, 'Fittings')}
        <table><tr><th>Fitting</th><th>Makes safe</th><th>Cost</th></tr>${E.MOD_ORDER.map((m) => `<tr><td>${E.MOD[m].icon} ${esc(E.MOD[m].name)}</td><td>${E.HAZ[E.MOD[m].haz].icon} ${esc(E.HAZ[E.MOD[m].haz].name)}</td><td>🪙${E.MOD[m].cost}</td></tr>`).join('')}</table>
        ${sec(4, 'Limits')}
        <p>A company can keep up to ${E.MAX_SUBS} subs and ${E.MAX_DIVERS} divers. Up to ${E.SWIM_CREW} divers can swim out together.</p>`;
    } else if (tab === 'chart') {
      body = `${sec(1, 'Rows and depth')}
        <p>The chart runs from the harbor down to the Heart of Atlantis. Each row is harder and richer than the one above, and every site is in one of three depths: 🌊 Shallows, 🌊🌊 Deep or 🌊🌊🌊 Abyss.</p>
        <table><tr><th>Level</th><th>Target</th><th>Pearls</th><th>Gold</th></tr>${[1, 2, 3, 4, 5].map((t) => {
          const r = E.rewardRange(t);
          return `<tr><td>${'★'.repeat(T[t].stars)} ${T[t].name}</td><td>${T[t].target}+</td><td>${PEARL}${r.lo}–${r.hi}</td><td>🪙${r.goldLo}–${r.goldHi}</td></tr>`;
        }).join('')}</table>
        <p>Every site has its own haul, shown on the chart. Within a level, deeper sites and sites with more hazards tend to hold more.</p>
        ${sec(2, 'Charted and uncharted')}
        <ul><li>🗺️ <b>Charted</b> sites have a route: the top row, and every site an explored site leads to. Lines on the chart show the routes.</li>
        <li>🌫️ <b>Uncharted</b> sites can still be tried, at −${E.UNCHARTED} on the roll.</li>
        <li>🧭 <b>Known waters:</b> +${E.KNOWN_BONUS} on sites linked to one <i>your</i> company explored.</li>
        <li>⚑ Each site can only be explored once.</li>
        <li>💠 <b>The Heart of Atlantis</b> is sighted on tide ${E.HEART_TIDE}. Finding it ends the season at the end of that tide.</li></ul>
        ${sec(3, 'Sea events')}
        <p>Every tide has one sea event that lasts the whole tide for both companies.</p>
        <table><tr><th>Event</th><th>What it does</th></tr>${E.SEA_ORDER.map((k) => `<tr><td>${E.SEA[k].icon} ${esc(E.SEA[k].name)}</td><td>${SEA_PLAIN[k] || esc(E.SEA[k].note)}</td></tr>`).join('')}</table>`;
    } else if (tab === 'score') {
      body = `${sec(1, 'Counting points')}
        <p>When the season ends, each company adds up:</p>
        <ul><li>${PEARL} <b>1 point per pearl</b></li><li>🏆 <b>${E.DISCOVERY_PTS} points</b> for each level of expedition (easy, tricky, hard, extreme, legendary) your company finished <b>first</b></li>
        <li>🏺 <b>relic sets</b>: group your relics (👑 royal jewels, 📜 lost scrolls, 🔮 orichalcum crystals, 🏺 golden urns) into sets of different kinds: ${E.RELIC_SET.slice(1).map((pts, i) => `${i + 1} kind${i ? 's' : ''} = ${pts}`).join(', ')} points</li>
        <li>📜 <b>commissions</b> you completed first</li><li>🪙 <b>1 point per ${E.GOLD_PER_PT} gold</b> left over</li></ul>
        ${sec(2, 'Winning')}
        <p>Most points wins. If it’s a tie, the company with more pearls wins, then the one with more expeditions.</p>
        ${sec(3, 'Commissions')}
        <p>Each game uses ${E.GOAL_COUNT} of these. They’re checked after every action and between tides; the first company to complete one scores it.</p>
        <table><tr><th>Commission</th><th>Do this first</th><th>Points</th></tr>${E.GOAL_ORDER.map((k) => `<tr><td>${E.GOALS[k].icon} ${esc(E.GOALS[k].name)}</td><td>${esc(E.GOALS[k].text)}</td><td>+${E.GOALS[k].pts}</td></tr>`).join('')}</table>`;
    } else {
      const terms = [
        ['Tide', `One round of the game. A season is ${E.TIDES} tides.`],
        ['Action / turn', 'On your turn you take one action, then the other company takes one.'],
        ['End tide', 'You’re done for this tide; your rival can keep going alone.'],
        ['Ready', 'A sub or diver that hasn’t gone out this tide and isn’t resting or out of action.'],
        ['Target', 'The total your die plus bonuses must reach.'],
        ['Number needed', 'What the die itself has to show: the target minus your bonus.'],
        ['Natural 20 / 1', 'The die showing 20 always succeeds; showing 1 always fails.'],
        ['Covered hazard', 'A hazard someone on the dive is ready for. Uncovered hazards cost −' + E.UNCOVERED + '.'],
        ['Charted', 'A site with a known route. Uncharted sites cost −' + E.UNCHARTED + '.'],
        ['Known waters', `+${E.KNOWN_BONUS} on sites next to one your company explored.`],
        ['Out of their depth', 'A diver or sub below the depth they’re built for. They take penalties and can be lost if the dive fails.'],
        ['Resting', 'A diver who can’t dive or salvage until a later tide.'],
        ['Out of action', 'A sub that can’t dive or salvage until a later tide.'],
        ['Swimming', `Diving with no sub: up to ${E.SWIM_CREW} divers, −${E.SWIM_PEN}.`],
        ['Salvage run', 'A safe trip for 🪙1 plus 🪙1 per diver.'],
      ];
      body = `${sec(1, 'Your turn, in short')}
        <ol class="rb-flow"><li>Dive, salvage, hire, build/rebuild/fit — or end your tide.</li><li>Each sub and diver goes out once per tide.</li><li>When both companies end the tide: 🪙${E.INCOME} income, pay wages, dive hall changes, next sea event.</li></ol>
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
    const back = openModal(`<h2>📜 Atlantis Expedition — Rulebook</h2>
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
  requeueLastGame();
  sendQueued();
  const params = new URLSearchParams(location.search);
  const localId = params.get('local');
  const gameId = params.get('game');
  if (!sessionId()) showGate();
  else if (gameId) {
    showSetup(gameId);
  } else if (localId && /^[a-z0-9]{4,40}$/i.test(localId)) {
    const here = rawSave();
    if (validSave(here) && here.gid === localId && lastStatus(localId) === 'here') startFrom(here);
    else if (window.BoardSaves) {
      $('#app').innerHTML = '<p class="loading-save">Loading your game…</p>';
      window.BoardSaves.load('atlantis', localId).then((g) => {
        if (validSave(g) && g.state.phase !== 'over') startFrom(g);
        else {
          showSetup();
          toast('That game couldn’t be found — it may have finished or been removed.', 'warn');
        }
      });
    } else showSetup();
  } else if (params.get('past')) {
    // A finished game linked from game history: show its board, or the history if it can't be opened.
    $('#app').innerHTML = '<p class="loading-save">Loading that game…</p>';
    openPast(params.get('past')).then(() => G || showHistory());
  } else if (params.has('history')) showHistory();
  else showSetup();
  // Phones: the chart, your company, the dive hall and the rest each get a tab along the bottom.
  if (window.PhoneTabs) {
    PhoneTabs.init({
      root: '.at',
      accent: '#2ec4b6',
      tabs: [
        { id: 'chart', icon: '🗺️', label: 'Chart', show: '.at section.sea' },
        { id: 'company', icon: '⚓', label: 'Company', show: '.at section.panel.company' },
        { id: 'hall', icon: '🤿', label: 'Dive hall', show: '.at section.panel.hall' },
        { id: 'more', icon: '📜', label: 'Goals · log', show: '.at section.panel.goals, .at > section.panel' },
      ],
      auto: () => (G && G.state && humanTurn() ? 'chart' : null),
    });
  }
  window.__atl = { get G() { return G; }, render, E, send: (a) => doAction(a) };
})();
