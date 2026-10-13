// Atlantis Expedition — page UI. Rules live in atlantis-engine.js. Admin-only while it's being playtested.
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

  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const pct = (p) => `${Math.round(p * 100)}%`;
  const oddsColor = (p) => (p >= 0.7 ? '#1f9d55' : p >= 0.5 ? '#c99a12' : p >= 0.3 ? '#e07b28' : '#c0392b');

  let G = null; // { state, mode: 'ai' | 'local' | 'sim' | 'past', level, levels, speed, view, gid, recorded, revealed }
  const ui = { aiTimer: null, modal: false, onClose: null, busy: false, rulesTab: 'basics', lastTide: 0 };

  // ---------------------------------------------------------------- persistence
  function save() {
    if (!G || G.mode === 'sim' || G.mode === 'past') return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(G));
    } catch (e) {
      /* storage full or blocked: the game still works, it just won't resume */
    }
  }
  function loadSave() {
    try {
      const g = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return g && g.state && g.state.v === E.SAVE_V && (g.mode === 'ai' || g.mode === 'local') ? g : null;
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
  function toast(html, kind) {
    const root = $('#toasts');
    if (!root) return;
    const t = document.createElement('div');
    t.className = `toast ${kind || ''}`;
    t.innerHTML = html;
    root.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2800);
    setTimeout(() => t.remove(), 3200);
  }
  function sfx(k, delay) {
    if (!window.GameMusic || !G || G.mode === 'sim') return;
    if (delay) setTimeout(() => GameMusic.sfx(k), delay);
    else GameMusic.sfx(k);
  }
  const hz = (h, cls) => `<span class="hz${cls ? ' ' + cls : ''}" title="${esc(E.HAZ[h].name)}">${E.HAZ[h].icon} ${esc(E.HAZ[h].name)}</span>`;
  const stars = (t) => '★'.repeat(E.TIER[t].stars);
  const diverPic = (d) => `<span class="pic" aria-hidden="true">${ROLE_ICON[d.k] || '🤿'}</span>`;
  const subPic = (k) => `<img class="pic" src="${IMG('sub-' + k)}" alt="">`;
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
    return `<div class="gh-top"><a class="gh-lobby" href="/board-games.html" title="Back to the game lobby">← <img class="gh-dice" src="/img/board-games-favicon-48.png?v=2" alt="" width="20" height="20"> Game lobby</a>${window.GameMusic ? GameMusic.buttonHtml('btn ghost sm gh-music', 'bt') : ''}</div>
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
        <p>You need an Ahrens Labs account to play Atlantis Expedition.</p>
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
        <p>Atlantis Expedition is being playtested and isn’t open yet. Check back soon!</p>
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
    const canResume = saved && saved.state.phase !== 'over' && (saved.state.tide > 1 || saved.state.log.some((l) => l.who != null));
    document.body.className = 'setup-mode';
    $('#app').innerHTML = `
      <div class="setup gh">
        ${heroHtml(true)}
        <div class="setup-card gh-card panel">
          ${canResume ? `<div class="gh-resume"><div><b>Expedition in progress</b><span>${esc(saved.state.players.map((p) => p.name).join(' vs '))} · tide ${saved.state.tide} of ${E.TIDES}</span></div><button class="btn" id="resume">Continue</button></div>` : ''}
          <h2>New game</h2>
          <div class="gh-modes" id="mode">
            <button data-v="ai" class="gh-mode ${pr.mode !== 'local' && pr.mode !== 'online' ? 'on' : ''}"><span>🤖</span><b>Computer</b><small>Race a rival company</small></button>
            <button data-v="local" class="gh-mode ${pr.mode === 'local' ? 'on' : ''}"><span>👥</span><b>Two players</b><small>Share this device</small></button>
            <button data-v="online" class="gh-mode ${pr.mode === 'online' ? 'on' : ''}"><span>🌐</span><b>Online</b><small>Challenge a friend</small></button>
          </div>
          <div class="online-only online-soon"><b>🌐 Online play opens at launch</b><p>Challenging other Ahrens Labs players arrives when Atlantis Expedition leaves the lab. For now, play the computer or a friend on this device.</p></div>
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
      }
    });
    setMode(pr.mode === 'local' || pr.mode === 'online' ? pr.mode : 'ai');
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
    if (!isAdmin()) return showLocked();
    stopAI();
    G = g;
    ui.lastTide = st().tide;
    document.body.className = 'game-mode';
    window.scrollTo(0, 0);
    save();
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
    const sea = E.SEA[E.sea(s)];
    const next = s.tide < E.TIDES ? E.SEA[s.forecast[s.tide]] : null;
    const sub = G.mode === 'past' ? '📜 Finished game' : G.mode === 'sim' ? `🧪 ${SIM_SPEEDS[G.speed].name} · computer vs computer` : G.mode === 'local' ? '👥 Two players' : `🤖 vs computer · ${LEVEL_NAME[G.level] || ''}`;
    $('#app').innerHTML = `
      <div class="at">
        <header class="at-top">
          <a class="gh-lobby" href="/board-games.html" title="Back to the game lobby">← <img class="gh-dice" src="/img/board-games-favicon-48.png?v=2" alt="" width="20" height="20"></a>
          <div class="at-title">Atlantis Expedition<span class="at-sub">${esc(sub)}</span></div>
          <span class="chip" title="Tide ${s.tide} of ${E.TIDES}">🌊 Tide ${s.tide}/${E.TIDES}</span>
          <span class="chip" title="${esc(sea.note)}">${sea.icon} ${esc(sea.name)}</span>
          ${next && s.phase === 'act' ? `<span class="chip next" title="Next tide: ${esc(next.note)}">Next: ${next.icon} ${esc(next.name)}</span>` : ''}
          ${window.GameMusic ? GameMusic.buttonHtml('btn ghost sm', 'bt') : ''}
          <button class="btn ghost sm" data-act="rules">📜 Rules</button>
          <button class="btn ghost sm" data-act="home">${G.mode === 'past' ? '🏆 History' : G.mode === 'sim' ? '⏹ Stop' : '🏠 Home'}</button>
        </header>
        <section class="scores">${s.players.map((p, i) => companyCard(i, v)).join('')}</section>
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
      <div class="co-stats"><span title="Pearls">🦪 <b>${p.treasure}</b></span><span>🪙 <b>${p.gold}</b></span><span>🤿 <b>${p.divers.length}</b></span><span>🚢 <b>${p.subs.length}</b></span><span title="Points so far">⭐ <b>${sc.total}</b></span></div>
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
    if (p.ai) return `<div class="banner" style="--pc:${PCOLOR[s.turn]}"><span class="dot"></span>${esc(p.name)} is planning their next move…</div>`;
    const who = G.mode === 'local' ? `${esc(p.name)}, your move` : 'Your move';
    const otherDone = s.passed[1 - s.turn] ? ` ${esc(pl(1 - s.turn).name)} is done for this tide, so you can keep going until you end yours.` : '';
    return `<div class="banner mine" style="--pc:${PCOLOR[s.turn]}"><span class="dot"></span><b>${who}:</b> pick a site on the chart to dive, hire from the dive hall, build or salvage.${otherDone}</div>`;
  }

  // The best odds this company could get on an expedition right now (best ready sub, best crew).
  function bestOdds(pi, x) {
    const s = st();
    const p = pl(pi);
    let best = null;
    for (const sub of E.readySubs(s, p)) {
      const crew = E.bestCrew(s, pi, x, sub);
      if (!crew.length) continue;
      const c = E.chance(s, pi, x.id, sub.id, crew.map((d) => d.id));
      if (!best || c.p > best.p) best = Object.assign(c, { sub, crew });
    }
    return best;
  }

  // ---------------------------------------------------------------- the chart
  const ROW_Y = [16, 34, 52, 70, 86];
  const HARBOR_Y = 4;
  function chartHtml(v) {
    const s = st();
    const canPlan = humanTurn();
    const actor = canPlan ? s.turn : v;
    const lines = [];
    E.SLOTS.filter((slot) => slot.row === 0).forEach((slot) => lines.push(`<line x1="50" y1="${HARBOR_Y}" x2="${slot.x}" y2="${ROW_Y[0]}" class="route"/>`));
    E.SLOTS.forEach((slot, n) => slot.kids.forEach((k) => {
      const a = s.map[n];
      const b = s.map[k];
      const cls = a.by != null ? (b.by != null ? 'done' : 'route') : '';
      lines.push(`<line x1="${slot.x}" y1="${ROW_Y[slot.row]}" x2="${E.SLOTS[k].x}" y2="${ROW_Y[E.SLOTS[k].row]}" class="${cls}"${a.by != null ? ` style="--pc:${PCOLOR[a.by]}"` : ''}/>`);
    }));
    return `<div class="chart">
      <svg class="chart-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines.join('')}</svg>
      <div class="harbor" style="top:${HARBOR_Y}%">⚓ Harbor</div>
      ${s.map.map((x) => nodeHtml(x, actor, canPlan)).join('')}
    </div>`;
  }

  function nodeHtml(x, actor, canPlan) {
    const s = st();
    const site = E.SITE[x.k];
    const slot = E.SLOTS[x.n];
    const done = x.by != null;
    const open = E.isOpen(s, x);
    const state = done ? 'done' : !open ? 'hidden' : E.charted(s, x) ? 'open' : 'far';
    let badge = '';
    if (state === 'open' || state === 'far') {
      const o = canPlan ? bestOdds(actor, x) : null;
      if (o) badge = `<span class="nd-odds" style="--oc:${oddsColor(o.p)}">${pct(o.p)}</span>`;
    }
    const meta = `${site.haz.map((h) => E.HAZ[h].icon).join('')}${site.relic ? E.RELIC[site.relic].icon : ''}`;
    const label = state === 'hidden' ? `🔒 Tide ${E.HEART_TIDE}` : esc(site.short);
    return `<button class="node t${site.tier} ${state}${x.k === 'heart' ? ' heart' : ''}" data-site="${x.id}" style="left:${slot.x}%;top:${ROW_Y[slot.row]}%;--bg:url('${expImg(x)}')${done ? `;--pc:${PCOLOR[x.by]}` : ''}" title="${esc(site.name)} · ${E.TIER[site.tier].name}">
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
    const slot = E.SLOTS[x.n];
    const r = E.rewardOf(s, x);
    const names = (ns) => ns.map((n) => esc(E.SITE[s.map[n].k].name)).join(', ');
    let status;
    if (x.by != null) status = `<p class="site-status" style="--pc:${PCOLOR[x.by]}">${FLAG[x.by]} Explored by <b>${esc(pl(x.by).name)}</b>.</p>`;
    else if (!E.isOpen(s, x)) status = `<p class="site-status">🔒 Nobody has sighted it yet. It appears on tide ${E.HEART_TIDE}.</p>`;
    else if (E.charted(s, x)) status = `<p class="site-status">🗺️ Charted — a route leads here.</p>`;
    else status = `<p class="site-status far">🌫️ Uncharted: −${E.UNCHARTED} to dives until someone explores ${names(slot.parents)}.</p>`;
    openModal(`<div class="plan-head"><img src="${expImg(x)}" alt=""><div><h2>${esc(site.name)}</h2><div class="haz">${site.haz.map((h) => hz(h)).join('')}</div>
        <small class="muted">${E.TIER[site.tier].name} · ${E.DEPTH[site.depth].name} · roll ${E.TIER[site.tier].target}+ · reward 🦪${r.treasure} 🪙${r.gold}${site.relic ? ` · ${E.RELIC[site.relic].icon} ${esc(E.RELIC[site.relic].name.toLowerCase())}` : ''}</small></div></div>
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
    }).join('') || '<p class="empty">No submarines — build one at the shipyard.</p>';
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
    return s.log.slice(-80).map((l) => (l.who == null ? `<p class="tide">${esc(l.text)}</p>` : `<p style="--pc:${PCOLOR[l.who]}">${esc(l.text)}</p>`)).join('');
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
    save();
    showSetup();
  }

  // ---------------------------------------------------------------- actions
  function doAction(a) {
    const s = st();
    const pi = s.turn;
    const tideBefore = s.tide;
    const goldBefore = pl(pi).gold;
    try {
      E.apply(s, pi, a);
    } catch (err) {
      toast(esc(err.message), 'bad');
      return;
    }
    if (a.t === 'hire') sfx('join');
    else if (a.t === 'build' || a.t === 'upgrade' || a.t === 'fit') sfx('build');
    else if (a.t === 'salvage') sfx('coin');
    else if (a.t === 'pass') sfx('turn');
    if (a.t !== 'dive' && pl(pi).gold < goldBefore && a.t !== 'salvage') sfx('pay', 160);
    if (G.mode === 'local' && G.follow !== false) G.view = s.phase === 'act' ? s.turn : G.view;
    if (s.phase === 'act' && G.mode === 'ai' && !pl(pi).ai) G.view = 0;
    save();
    const after = () => {
      render();
      if (s.tide !== tideBefore) tideSplash();
      if (a.t !== 'dive' && !(G.mode === 'sim' && G.speed === 'turbo')) {
        (s.claimed || []).forEach((k) => {
          const g = s.goals.find((y) => y.k === k);
          toast(`${E.GOALS[k].icon} <b>${esc(pl(g.by).name)}</b> completed the <b>${esc(E.GOALS[k].name)}</b> commission: +${E.GOALS[k].pts} points!`);
          sfx('reveal');
        });
      }
      if (s.phase === 'over') return showGameOver(false);
      scheduleAI();
    };
    if (a.t === 'dive' && s.last) {
      render();
      showRoll(s.last, { auto: pl(pi).ai, done: after });
    } else after();
  }

  function tideSplash() {
    const s = st();
    if (G.mode === 'sim' && G.speed === 'turbo') return;
    const w = E.SEA[E.sea(s)];
    toast(`🌊 <b>Tide ${s.tide}</b> · ${w.icon} ${esc(w.name)}: ${esc(w.note)}${s.tide === E.HEART_TIDE ? '<br>💠 <b>The Heart of Atlantis has been sighted!</b> Anyone can dive for it now.' : ''}`);
    if (s.tide === E.HEART_TIDE) sfx('reveal');
  }

  function confirmPass() {
    const s = st();
    const p = pl(s.turn);
    const canStill = E.readySubs(s, p).some((sub) => E.readyDivers(s, p).length && sub);
    if (!canStill) return doAction({ t: 'pass' });
    const back = openModal(`<h2>⏭ End your tide?</h2>
      <p>You still have a sub and divers ready. Once you end your tide you can’t act again until the next one${s.passed[1 - s.turn] ? '' : `, and ${esc(pl(1 - s.turn).name)} can keep going on their own`}.</p>
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
    const subGap = (sub) => (x ? Math.max(0, site.depth - E.SUB[sub.k].depth) : 0);
    const diverGap = (d) => (x ? Math.max(0, site.depth - E.deepOf(d)) : 0);
    const plan = { s: null, crew: [] };
    if (x) {
      const best = bestOdds(pi, x);
      if (best) {
        plan.s = best.sub.id;
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
    if (!plan.s) {
      const first = p.subs.find((sub) => E.subReady(s, sub));
      plan.s = first ? first.id : null;
    }
    const subWhy = (sub) => {
      if (sub.stuck >= s.tide) return 'Out of action';
      if (sub.k === 'minnow' && E.sea(s) === 'storm') return 'In port (storm)';
      if (sub.used) return 'Already out this tide';
      return '';
    };
    const diverWhy = (d) => (d.tired >= s.tide ? 'Resting' : d.used ? 'Out this tide' : '');
    const draw = () => {
      const sub = plan.s != null ? E.subOf(p, plan.s) : null;
      const seats = sub ? E.SUB[sub.k].crew : 0;
      const head = x
        ? `<div class="plan-head"><img src="${expImg(x)}" alt=""><div><h2>${esc(site.name)}</h2><div class="haz">${site.haz.map((h) => hz(h)).join('')}${E.charted(s, x) ? '' : `<span class="hz risk">🌫️ Uncharted</span>`}</div><small class="muted">${E.TIER[site.tier].name} · ${E.DEPTH[site.depth].name} · roll ${E.TIER[site.tier].target}+ · reward 🦪${E.rewardOf(s, x).treasure} 🪙${E.rewardOf(s, x).gold}${site.relic ? ` · ${E.RELIC[site.relic].icon} relic` : ''}</small></div></div>`
        : `<h2>🪙 Salvage run</h2><p class="muted">A safe trip to pick over old wrecks. No dice, no danger: earns 🪙1 plus 🪙1 per diver. The sub and divers are out for the rest of this tide.</p>`;
      const subs = p.subs.map((q) => {
        const why = subWhy(q);
        const B = E.SUB[q.k];
        const deep = subGap(q) ? `<em class="warn">⚠️ Too deep: −${E.SUB_DEEP_PEN * subGap(q)}</em>` : '';
        return `<button data-sub="${q.id}" class="${q.id === plan.s ? 'on' : ''}${deep ? ' risky' : ''}" ${why ? 'disabled' : ''}>${subPic(q.k)}<b>${esc(B.name)}</b><small>${why || `${plural(B.crew, 'seat')}${B.bonus ? ` · +${B.bonus}` : ''}${q.mods.length ? ' · ' + q.mods.map((m) => E.MOD[m].icon).join('') : ''}`}${why ? '' : deep}</small></button>`;
      }).join('');
      const divers = p.divers.map((d) => {
        const why = diverWhy(d);
        const D = E.DIVER[d.k];
        const deep = diverGap(d) ? `<em class="warn">⚠️ Out of depth: −${E.DIVER_DEEP_PEN * diverGap(d)}</em>` : '';
        return `<button data-diver="${d.id}" class="${plan.crew.includes(d.id) ? 'on' : ''}${deep ? ' risky' : ''}" ${why ? 'disabled' : ''}>${diverPic(d)}<b>${esc(d.name)}</b><small>${why || `${'⭐'.repeat(E.skillOf(d))} ${D.spec.map((h) => E.HAZ[h].icon).join('')} · 🌊 ${esc(E.DEPTH[E.deepOf(d)].name)}`}${why ? '' : deep}</small></button>`;
      }).join('');
      let box = '';
      if (x && sub && plan.crew.length) {
        const c = E.chance(s, pi, x.id, sub.id, plan.crew);
        const risks = c.uncovered.map((h) => `${E.HAZ[h].icon} ${E.HAZ[h].effect}`);
        const deepRisks = c.risk.map((r) => `🫥 ${esc(r.name)} could be lost (${pct(r.p)})`);
        if (c.crush) deepRisks.push(`💥 the ${esc(E.SUB[sub.k].name)} could be crushed (${pct(c.crush)})`);
        box = `<div class="odds-box" style="--oc:${oddsColor(c.p)}">
          <div class="odds-big"><span>Chance of success</span><b>${pct(c.p)}</b></div>
          <div class="odds-bar"><i style="width:${pct(c.p)}"></i></div>
          <div class="parts">${c.parts.map((q) => `<div class="${q.v < 0 ? 'neg' : 'pos'}"><span>${esc(q.label)}</span><span>${q.v > 0 ? '+' : ''}${q.v}</span></div>`).join('')}
            <div><span>Roll needed on the d20</span><b>${c.need}+</b></div></div>
          ${risks.length ? `<div class="risk-note">If it fails: ${risks.map(esc).join(' or ')}</div>` : '<div class="risk-note safe">Your crew is ready for every hazard — a failed dive just comes home empty-handed (unless you roll a 1).</div>'}
          ${deepRisks.length ? `<div class="risk-note deep">Too deep! If it fails, as well: ${deepRisks.join(', ')}.</div>` : ''}
        </div>`;
      } else if (!x && sub && plan.crew.length) {
        box = `<div class="odds-box" style="--oc:#8ff0b4"><div class="odds-big"><span>Salvage</span><b>🪙${1 + plan.crew.length}</b></div></div>`;
      }
      const go = x ? `🎲 Dive!` : `🪙 Go salvaging`;
      return `${head}
        <h3>🚢 Submarine</h3><div class="pick" id="pk-sub">${subs || '<p class="empty">No subs.</p>'}</div>
        <h3>🤿 Crew <small class="muted">${plan.crew.length}/${seats} seats</small></h3><div class="pick" id="pk-crew">${divers || '<p class="empty">No divers.</p>'}</div>
        ${box}
        <div class="btn-row"><button class="btn big" id="plan-go" ${sub && plan.crew.length ? '' : 'disabled'}>${go}</button></div>`;
    };
    const back = openModal('<div id="plan"></div>', { cls: 'wide', onClose: () => {} });
    const root = back.querySelector('#plan');
    root.innerHTML = draw();
    root.addEventListener('click', (e) => {
      const sb = e.target.closest('[data-sub]');
      if (sb && !sb.disabled) {
        plan.s = Number(sb.dataset.sub);
        const seats = E.SUB[E.subOf(p, plan.s).k].crew;
        if (x) {
          const best = E.bestCrew(s, pi, x, E.subOf(p, plan.s));
          plan.crew = best.map((d) => d.id);
        } else plan.crew = plan.crew.slice(0, seats);
        root.innerHTML = draw();
        return;
      }
      const db = e.target.closest('[data-diver]');
      if (db && !db.disabled) {
        const id = Number(db.dataset.diver);
        const sub = plan.s != null ? E.subOf(p, plan.s) : null;
        if (plan.crew.includes(id)) plan.crew = plan.crew.filter((y) => y !== id);
        else if (sub && plan.crew.length >= E.SUB[sub.k].crew) toast(`A ${esc(E.SUB[sub.k].name)} only has ${plural(E.SUB[sub.k].crew, 'seat')}.`, 'bad');
        else plan.crew.push(id);
        root.innerHTML = draw();
        return;
      }
      if (e.target.closest('#plan-go')) {
        closeModal(true);
        doAction(x ? { t: 'dive', x: x.id, s: plan.s, crew: plan.crew.slice() } : { t: 'salvage', s: plan.s, crew: plan.crew.slice() });
      }
    });
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
        <p><span class="who" style="color:${PCOLOR[r.pi]}">${esc(p.name)}</span>’s ${esc(E.SUB[r.sk].name)} dives with ${crew}.</p>
        <div class="d20" id="d20">${D20_SVG(PCOLOR[r.pi])}<span>?</span></div>
        <div class="roll-sum" id="roll-sum">Needs ${r.target} (a ${r.need}+ on the die)</div>
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
    const landAt = fast ? Math.min(900, fast / 2) : 1200;
    timers.push(setTimeout(() => {
      clearInterval(spin);
      die.classList.remove('spin');
      die.classList.add('land');
      num.textContent = r.d20;
      back.querySelector('#roll-sum').innerHTML = `🎲 ${r.d20} ${r.bonus >= 0 ? '+' : '−'} ${Math.abs(r.bonus)} = <b>${r.total}</b> · needed ${r.target}${r.d20 === 20 ? ' · a natural 20!' : r.d20 === 1 ? ' · a natural 1!' : ''}`;
      const v = back.querySelector('#roll-verdict');
      v.className = `roll-verdict ${r.ok ? 'ok' : 'fail'}`;
      v.textContent = r.ok ? '🦪 Pearls!' : '💥 The dive failed';
      const msgs = [];
      if (r.ok) {
        msgs.push(`Found <b>🦪${r.treasure} pearls</b> and <b>🪙${r.gold}</b>${r.d20 === 20 ? ' (with 🪙2 of extra loot)' : ''}.`);
        if (r.relic) msgs.push(`${E.RELIC[r.relic].icon} A relic for the collection: <b>${esc(E.RELIC[r.relic].name.toLowerCase())}</b>.`);
        if (r.first) msgs.push(`🏆 First company to finish a ${esc(E.TIER[site.tier].name.toLowerCase())} expedition: +${E.DISCOVERY_PTS} points!`);
        if (r.promoted && r.promoted.length) msgs.push(`🎖️ ${r.promoted.map(esc).join(' and ')} ${r.promoted.length > 1 ? 'were' : 'was'} promoted: +1 skill, and trained one zone deeper.`);
        if (r.opened && r.opened.length) msgs.push(`🗺️ New routes charted to ${r.opened.map((k) => esc(E.SITE[k].name)).join(' and ')}.`);
        if (r.k === 'heart') msgs.push('💠 <b>The Heart of Atlantis!</b> The season ends after this tide.');
      } else {
        r.msgs.forEach((m) => msgs.push(esc(m)));
        msgs.push(`🧭 The next dive here gets +${r.scout} from what was learned.`);
      }
      (r.goals || []).forEach((k) => msgs.push(`${E.GOALS[k].icon} Commission complete — <b>${esc(E.GOALS[k].name)}</b>: +${E.GOALS[k].pts} points!`));
      back.querySelector('#roll-msgs').innerHTML = msgs.map((m) => `<p>${m}</p>`).join('');
      sfx(r.ok ? 'good' : 'bad');
      if (r.ok) sfx('coin', 300);
      const ok = back.querySelector('#roll-ok');
      ok.hidden = false;
      ok.onclick = finish;
      ok.focus();
      if (opts.auto) timers.push(setTimeout(finish, fast || 3200));
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
    const wait = G.mode === 'sim' ? SIM_SPEEDS[G.speed].ai : 900;
    ui.aiTimer = setTimeout(aiStep, wait);
  }
  function aiStep() {
    if (!G || ui.modal || st().phase !== 'act') return;
    const pi = st().turn;
    if (!pl(pi).ai) return;
    const level = G.mode === 'sim' ? G.levels[pi] : G.level;
    const a = E.aiChoose(st(), pi, level);
    const fast = G.mode === 'sim' && G.speed === 'turbo';
    if (!fast && a.t !== 'dive') aiToast(pi, a);
    doAction(a);
  }
  function aiToast(pi, a) {
    const s = st();
    const p = pl(pi);
    let text = '';
    if (a.t === 'hire') {
      const d = s.market.find((x) => x.id === a.d);
      text = `hires ${esc(d.name)}, ${esc(E.DIVER[d.k].role.toLowerCase())}, for 🪙${E.hireCost(d)}`;
    } else if (a.t === 'build') text = `builds a ${esc(E.SUB[a.k].name)}`;
    else if (a.t === 'upgrade') text = `rebuilds a ${esc(E.SUB[E.subOf(p, a.s).k].name)} as a ${esc(E.SUB[a.k].name)}`;
    else if (a.t === 'fit') text = `fits ${esc(E.MOD[a.m].name.toLowerCase())}`;
    else if (a.t === 'salvage') text = `goes on a salvage run (+🪙${1 + a.crew.length})`;
    else if (a.t === 'pass') text = 'is done for this tide';
    toast(`<span class="dot" style="--pc:${PCOLOR[pi]}"></span><b>${esc(p.name)}</b> ${text}.`);
  }

  // ---------------------------------------------------------------- game over
  function showGameOver(instant) {
    const s = st();
    const sc = s.players.map((p) => E.score(s, p));
    const w = E.winner(s);
    const rows = [
      ['🦪 Pearls', 'treasure'],
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
        <div class="hr-actions"><button class="btn" data-rv="close">🗺️ See the chart</button>${G.mode === 'past' ? '' : `<button class="btn" data-rv="again">${G.mode === 'sim' ? '🧪 Run again' : '🔱 Play again'}</button>`}${G.mode === 'sim' ? '' : '<button class="btn ghost" data-rv="hist">🏆 Game history</button>'}<a class="btn ghost" href="/board-games.html"><img class="gh-dice" src="/img/board-games-favicon-48.png?v=2" alt=""> All board games</a></div>
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
    return 'al' + [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  function recordGame() {
    const g = G;
    if (g.recorded || !sessionId()) return;
    const s = g.state;
    g.gid = g.gid || newLocalId();
    g.recorded = true;
    save();
    api('/api/atlantis/history/record', {
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
    const r = await api(`/api/atlantis/history/board?id=${encodeURIComponent(id)}`);
    const state = r.ok && r.data && r.data.state;
    if (!state || !Array.isArray(state.players) || state.phase !== 'over') return toast(esc((r.data && r.data.error) || 'Couldn’t load that game.'), 'bad');
    if (state.v !== E.SAVE_V) return toast('That game was played before the chart of Atlantis was drawn, so its board can’t be shown.', 'bad');
    const h = (hist.items || []).find((x) => x.id === id);
    startFrom({ state, mode: 'past', level: h && h.level, view: 0, gid: id, revealed: true });
  }

  const hist = { items: null, kind: 'all' };
  const SCORE_ROWS = [['🦪 Pearls', 'treasure'], ['🏆 First finds', 'discoveries'], ['🏺 Relic sets', 'relics'], ['📜 Commissions', 'goals'], ['🪙 Gold', 'gold'], ['🗺️ Expeditions', 'expeditions']];

  async function showHistory() {
    stopAI();
    G = null;
    document.body.className = 'setup-mode';
    $('#app').innerHTML = `
      <div class="setup gh">
        <div class="gh-top"><a class="gh-lobby" href="/board-games.html" title="Back to the game lobby">← <img class="gh-dice" src="/img/board-games-favicon-48.png?v=2" alt="" width="20" height="20"> Game lobby</a><button class="btn ghost sm" id="hist-new">🔱 New game</button></div>
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
    const items = hist.items.filter((h) => hist.kind === 'all' || h.kind === hist.kind);
    const mine = items.filter((h) => h.me != null && h.cats);
    const count = (f) => mine.filter(f).length;
    const wins = count((h) => h.winner === h.me);
    const ties = count((h) => h.winner < 0);
    const myScores = mine.map((h) => h.cats[h.me].total);
    const stat = (n, label) => `<div class="hs"><b>${n}</b><small>${label}</small></div>`;
    const kinds = { all: 'All', ai: '🤖 Computer', local: '👥 Two players' };
    const icon = { ai: '🤖', local: '👥' };
    const row = (h) => {
      const total = (i) => (h.cats ? h.cats[i].total : '–');
      let res;
      if (h.me != null) res = h.winner < 0 ? '<span class="hg-res tie">Tie</span>' : h.winner === h.me ? '<span class="hg-res win">Win</span>' : '<span class="hg-res loss">Loss</span>';
      else res = h.winner < 0 ? '<span class="hg-res tie">Tie</span>' : `<span class="hg-res">${esc(h.names[h.winner])} won</span>`;
      const when = new Date(h.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const what = [h.kind === 'ai' ? `Computer${h.level ? ' · ' + LEVEL_NAME[h.level] : ''}` : 'Two players, one device', when].join(' · ');
      const table = h.cats ? `<div class="hg-table">${SCORE_ROWS.map(([label, k]) => `<div><span>${h.cats[0][k] || 0}</span><small>${label}</small><span>${h.cats[1][k] || 0}</span></div>`).join('')}</div>` : '';
      const view = h.board ? `<div class="hg-view"><button class="btn sm" data-past="${esc(h.id)}">🗺️ View the chart</button></div>` : '';
      return `<details class="hg"><summary><span class="hg-icon">${icon[h.kind] || '🔱'}</span><span class="hg-main"><b>${esc(h.names[0])} <em>${total(0)}</em> – <em>${total(1)}</em> ${esc(h.names[1])}</b><small>${esc(what)}</small></span>${res}</summary>${table}${view}</details>`;
    };
    box.innerHTML = `
      <div class="seg hist-kind">${Object.keys(kinds).map((k) => `<button data-k="${k}" class="${hist.kind === k ? 'on' : ''}">${kinds[k]}</button>`).join('')}</div>
      <div class="hist-stats">
        ${stat(items.length, 'played')}${stat(wins, 'won')}${stat(mine.length - wins - ties, 'lost')}${stat(ties, 'tied')}
        ${stat(myScores.length ? Math.max(...myScores) : '–', 'best score')}
        ${stat(myScores.length ? Math.round(myScores.reduce((t, x) => t + x, 0) / myScores.length) : '–', 'average')}
      </div>
      ${items.length ? `<div class="hist-list">${items.map(row).join('')}</div>` : '<p class="muted hist-empty">No finished expeditions yet. Games are added when they end.</p>'}
      <p class="muted hist-note">Wins and scores count your games against the computer. Tap a game to see how the points were scored.</p>`;
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
  function rulesBody(tab) {
    const T = E.TIER;
    if (tab === 'basics') {
      return `<p>You run a diving company racing a rival to the treasures of sunken Atlantis. Over <b>${E.TIDES} tides</b> you hire <b>scuba divers</b>, build <b>submarines</b> and send them on <b>expeditions</b> to the sites on the chart. Every expedition is a gamble: roll a d20, add your bonuses, and beat the target.</p>
        <p>You can try <b>any site with any sub and any crew</b> — but deeper, harder sites pay far more and are far more dangerous. Send a rookie or a little Minnow into the Abyss and you’ll probably fail, and you may never see them again.</p>
        <p>Better divers, divers who are <b>ready for the hazards</b> down there, divers and subs <b>built for that depth</b>, and a <b>charted route</b> all make your odds better.</p>
        <p>The company with the most points when the season ends wins. Points come from 🦪 pearls, 🏆 first finds, 🏺 relic sets, 📜 commissions and leftover 🪙 gold.</p>
        <p>You start with 🪙${E.START_GOLD}, a Minnow sub and one rookie diver.</p>`;
    }
    if (tab === 'map') {
      return `<p>The chart shows every site in this game, from the harbor down to the Heart of Atlantis. Each game draws different sites. Each row is harder (and richer) than the one above it.</p>
        <ul><li>🗺️ <b>Charted</b> sites have a route: the top row, and every site that an explored site leads to. Lines on the chart show where each site leads.</li>
        <li>🌫️ <b>Uncharted</b> sites can still be tried, at <b>−${E.UNCHARTED}</b> to the roll. Exploring a site charts the routes beyond it — for both companies.</li>
        <li>🧭 <b>Known waters:</b> +${E.KNOWN_BONUS} on sites linked to one your company explored.</li>
        <li>⚑ Each site can only be explored once. Whoever explores it first takes the pearls.</li>
        <li>💠 <b>The Heart of Atlantis</b> is sighted on tide ${E.HEART_TIDE}. Whoever finds it ends the season at the end of that tide.</li></ul>`;
    }
    if (tab === 'tide') {
      return `<p>Each tide, the two companies take turns making <b>one move</b> at a time:</p>
        <ul><li><b>🎲 Dive</b> — send a ready sub and crew to a site on the chart.</li>
        <li><b>🪙 Salvage run</b> — a safe trip: 🪙1 plus 🪙1 per diver. No dice.</li>
        <li><b>🤿 Hire</b> a diver from the dive hall. Both companies hire from the same hall, so a good diver you don’t take may end up working for your rival.</li>
        <li><b>🛠️ Build</b> a sub, <b>rebuild</b> one as a bigger model (pay the difference), or add a <b>fitting</b>.</li>
        <li><b>⏭ End your tide</b> — you’re done until the next tide. The other company can keep going alone.</li></ul>
        <p>Each sub and each diver can go out <b>once per tide</b>. When both companies have ended their tide, the next one begins: everyone collects 🪙${E.INCOME} and pays every diver’s wage (a diver you can’t pay quits). In the dive hall, the longest-waiting diver leaves, everyone still waiting gets 🪙1 cheaper (down to half price) and new divers arrive.</p>
        <p>The <b>sea forecast</b> changes every tide — you can always see the next one coming.</p>
        <table><tr><th>Forecast</th><th>Effect</th></tr>${E.SEA_ORDER.map((k) => `<tr><td>${E.SEA[k].icon} ${esc(E.SEA[k].name)}</td><td>${esc(E.SEA[k].note)}</td></tr>`).join('')}</table>`;
    }
    if (tab === 'dive') {
      return `<p>Pick a site, a ready sub, and a crew that fits in the sub. Then roll a d20 and add:</p>
        <ul><li>⭐ every diver’s <b>skill</b></li><li>the <b>sub’s bonus</b> (Barracuda +1, Nautilus +2, Leviathan +3)</li><li>🧭 <b>+${E.KNOWN_BONUS} for known waters</b> and <b>+1 for each earlier failed attempt</b> at that site, by anyone (up to +${E.SCOUT_MAX})</li><li>the forecast, if it helps</li></ul>
        <p>and subtract:</p>
        <ul><li><b>${E.UNCOVERED} for every hazard nobody is ready for</b>. A diver with that specialty, or a sub with the matching fitting, makes a hazard safe.</li>
        <li><b>${E.UNCHARTED}</b> if the site is uncharted.</li>
        <li><b>${E.SUB_DEEP_PEN} per zone</b> a sub is below the depth it’s built for (a Minnow only reaches the Shallows, a Barracuda the Deep).</li>
        <li><b>${E.DIVER_DEEP_PEN} per zone</b> for every diver out of their depth (rookies are only trained for the Shallows).</li></ul>
        <p>Beat the target to win the pearls and gold. A <b>natural 20</b> always succeeds (with 🪙2 extra loot); a <b>natural 1</b> always fails — and then any hazard can strike, even one you were ready for.</p>
        <p>When a dive fails, one hazard nobody was ready for strikes (see Hazards). On top of that, <b>every diver out of their depth has a ${pct(E.DIVER_LOST)} chance per zone of being lost</b>, and a sub out of its depth has a ${pct(E.SUB_CRUSH)} chance per zone of being crushed.</p>
        <p>🎖️ Every diver on a successful dive gains experience. After ${E.PROMO_XP} successful dives a diver is <b>promoted</b>: +1 skill, and trained one zone deeper.</p>
        <table><tr><th>Level</th><th>Target</th><th>Pearls</th><th>Gold</th></tr>${[1, 2, 3, 4, 5].map((t) => `<tr><td>${'★'.repeat(T[t].stars)} ${T[t].name}</td><td>${T[t].target}+</td><td>🦪${T[t].treasure}</td><td>🪙${T[t].gold}</td></tr>`).join('')}</table>`;
    }
    if (tab === 'hazards') {
      return `<table><tr><th>Hazard</th><th>Who is ready for it</th><th>If it strikes</th></tr>${E.HAZ_ORDER.map((h) => `<tr><td>${E.HAZ[h].icon} ${esc(E.HAZ[h].name)}</td><td>${esc(E.HAZ[h].ready)}</td><td>${esc(E.HAZ[h].effect)}</td></tr>`).join('')}</table>
        <p>A shark always takes the least skilled diver on the crew.</p>`;
    }
    if (tab === 'crew') {
      return `<h3>Divers</h3><table><tr><th>Diver</th><th>Skill</th><th>Trained to</th><th>Ready for</th><th>Hire</th><th>Wage</th></tr>${E.DIVER_ORDER.map((k) => {
        const D = E.DIVER[k];
        return `<tr><td>${ROLE_ICON[k]} ${esc(D.role)}</td><td>${'⭐'.repeat(D.skill)}</td><td>${E.DEPTH[D.deep].name}</td><td>${D.spec.map((h) => E.HAZ[h].icon + ' ' + esc(E.HAZ[h].name)).join(', ') || '—'}</td><td>🪙${D.cost}</td><td>🪙${D.wage}</td></tr>`;
      }).join('')}</table>
        <h3>Submarines</h3><table><tr><th>Sub</th><th>Seats</th><th>Built for</th><th>Bonus</th><th>Fittings</th><th>Cost</th></tr>${E.SUB_ORDER.map((k) => {
          const B = E.SUB[k];
          return `<tr><td>${esc(B.name)}</td><td>${B.crew}</td><td>${E.DEPTH[B.depth].name}</td><td>${B.bonus ? '+' + B.bonus : '—'}</td><td>${B.slots}</td><td>🪙${B.cost}</td></tr>`;
        }).join('')}</table>
        <p>You can keep ${E.MAX_SUBS} subs and ${E.MAX_DIVERS} divers.</p>
        <h3>Fittings</h3><table><tr><th>Fitting</th><th>Makes safe</th><th>Cost</th></tr>${E.MOD_ORDER.map((m) => `<tr><td>${E.MOD[m].icon} ${esc(E.MOD[m].name)}</td><td>${E.HAZ[E.MOD[m].haz].icon} ${esc(E.HAZ[E.MOD[m].haz].name)}</td><td>🪙${E.MOD[m].cost}</td></tr>`).join('')}</table>`;
    }
    return `<p>When the last tide ends (or the Heart of Atlantis is found), add up:</p>
      <ul><li>🦪 every <b>pearl</b> you found</li><li>🏆 <b>${E.DISCOVERY_PTS} points</b> for each level of expedition (easy, tricky, hard, extreme, legendary) your company finished <b>first</b></li>
      <li>🏺 <b>relic sets</b>: tricky and harder sites each hold a relic (👑 royal jewels, 📜 lost scrolls, 🔮 orichalcum crystals or 🏺 golden urns). Group your relics into sets of different kinds: ${E.RELIC_SET.slice(1).map((pts, i) => `${i + 1} kind${i ? 's' : ''} = ${pts}`).join(', ')} points.</li>
      <li>📜 <b>commissions</b>: each game has ${E.GOAL_COUNT} public commissions. The first company to do one scores it.</li>
      <li>🪙 <b>1 point per ${E.GOLD_PER_PT} gold</b> left over</li></ul>
      <p>Most points wins. If it’s a tie, the company with more pearls wins, then the one with more expeditions.</p>
      <h3>Possible commissions</h3><table><tr><th>Commission</th><th>Do this first</th><th>Points</th></tr>${E.GOAL_ORDER.map((k) => `<tr><td>${E.GOALS[k].icon} ${esc(E.GOALS[k].name)}</td><td>${esc(E.GOALS[k].text)}</td><td>+${E.GOALS[k].pts}</td></tr>`).join('')}</table>`;
  }
  function showRules(tab) {
    ui.rulesTab = tab || ui.rulesTab;
    const tabs = { basics: '🌊 Basics', map: '🗺️ The chart', tide: '🔁 A tide', dive: '🎲 Diving', hazards: '🦈 Hazards', crew: '🤿 Divers & subs', score: '🏆 Scoring' };
    const back = openModal(`<h2>📜 How to play Atlantis Expedition</h2>
      <div class="rules-tabs">${Object.keys(tabs).map((k) => `<button data-tab="${k}" class="${ui.rulesTab === k ? 'on' : ''}">${tabs[k]}</button>`).join('')}</div>
      <div class="rules-body">${rulesBody(ui.rulesTab)}</div>`, { cls: 'wide', onClose: G ? null : () => {} });
    back.querySelector('.rules-tabs').onclick = (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      ui.rulesTab = b.dataset.tab;
      back.querySelectorAll('.rules-tabs button').forEach((x) => x.classList.toggle('on', x === b));
      back.querySelector('.rules-body').innerHTML = rulesBody(ui.rulesTab);
    };
  }

  // ---------------------------------------------------------------- start
  const params = new URLSearchParams(location.search);
  const saved = loadSave();
  if (!sessionId()) showGate();
  else if (!isAdmin()) showLocked();
  else if (params.has('home') || !saved || saved.state.phase === 'over') showSetup();
  else startFrom(saved);
  window.__atl = { get G() { return G; }, render, E, send: (a) => doAction(a) };
})();
