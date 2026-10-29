// Hero League — page UI. Rules live in heroes-engine.js. 
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
  const NEG = E.PENALTY;
  const SPECIAL = E.SPECIAL;
  const ORD = ['1st', '2nd', '3rd', '4th', '5th'];

  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

  let G = null; // { state, mode: 'ai' | 'local' | 'sim' | 'past', level, levels, speed, view, follow, shown, gid, moved, recorded, revealed }
  const ui = { aiTimer: null, modal: false, onClose: null, rulesTab: 'overview' };

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
  function keepInSaves() {
    const BS = window.BoardSaves;
    if (!BS || !G || (G.mode !== 'ai' && G.mode !== 'local')) return;
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

  const Online = window.BoardOnline.attach({
    apiPrefix: '/api/heroes',
    title: 'Hero League',
    onlineKey: 'ahrensHeroes.online',
    esc, toast, $, sessionId, prefs, savePrefs,
    blurb: 'Play Hero League against other Ahrens Labs players — invite up to four, add computer leagues if you like, and pick a quick game with a 2-minute turn clock or a long game where you take your turn whenever you like.',
    maxPlayers: 5,
    roundText: (g) => (g.round != null ? `Plaza progress · turn ${g.round}` : ''),
    getG: () => G,
    showSetup: (focus) => showSetup(focus),
    isMyTurn: () => G && G.state && E.waitingOn(G.state).includes(G.me),
    enterOnline: (v, mem) => {
      G = {
        mode: 'online', id: v.id, me: v.me, view: v.me, version: v.version, status: v.status, result: v.result,
        gmode: v.mode || 'long', deadline: v.deadline || null, skew: v.now ? v.now - Date.now() : 0,
        state: v.state, revealed: !!(mem && mem.revealed), moved: true,
      };
      startFrom(G);
      if (G.status === 'over' && st().phase === 'over') showGameOver(true);
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
      const me = pl(G.me);
      if (mine) sfx(mine.t === 'discard' ? 'place' : mine.t === 'draw' && mine.from === 'plaza' ? 'join' : 'card');
      render();
      if (G.gmode === 'quick' && G.status === 'active') Online.tickClock();
      // Your own move: the same notices as a game against the computer.
      if (mine && mine.t === 'identity' && me.identity) toast(`🎭 You are secretly <b>${identName(me.identity)}</b>. Keep it quiet!`);
      if (mine && mine.t === 'draw' && mine.from === 'deck' && me.drew) toast(`🂠 You drew <b>${cname(me.drew)}</b> (${E.SUIT[C(me.drew).suit].icon} ${C(me.drew).power}).`);
      // Everyone else's moves: one notice per league, with what they took and what they gave up.
      const L = s.last;
      const movers = [...new Set(fresh.filter((l) => l.who != null && l.who !== G.me).map((l) => l.who))];
      if (movers.length && !mine) sfx('place');
      movers.slice(-3).forEach((who) => {
        if (L && L.who === who && L.gave) {
          toast(`<span class="dot" style="--pc:${PCOLOR[who]}"></span>${leagueName(who)} ${L.from === 'plaza' ? `recruited <b>${cname(L.took)}</b> from the Plaza` : 'drew from the deck'} and sent <b>${cname(L.gave)}</b> to the Plaza.`, 'ai');
        } else {
          const line = fresh.filter((l) => l.who === who).pop();
          toast(`<span class="dot" style="--pc:${PCOLOR[who]}"></span>${esc(line.text)}`, 'ai');
        }
      });
      if (s.phase !== 'over' && G.status === 'active') identityPicker() || suitPicker();
      if (s.phase === 'over') {
        if (prev.phase !== 'over') sfx('reveal');
        return showGameOver(prev.phase === 'over');
      }
      if (G.status === 'over' && !G.revealed) {
        G.revealed = true;
        const r = G.result || {};
        openModal(`<h2>${r.winner === G.me ? '🏆 You win!' : '🏳️ Game over'}</h2><p>${esc(r.reason === 'resign' ? (r.winner === G.me ? 'They resigned.' : 'You resigned.') : r.reason === 'timeout' ? (r.winner === G.me ? 'They ran out of time.' : 'You ran out of time.') : 'This game has ended.')}</p><div class="btn-row"><button class="btn" data-close>OK</button></div>`);
      }
    },
  });

  // ---------------------------------------------------------------- small helpers
  const st = () => G.state;
  const pl = (i) => st().players[i];
  const playing = () => st().phase === 'draw' || st().phase === 'discard';
  // The seat a shared device is passed to: whoever's turn it is, or the next league still choosing suits.
  const activeSeat = () => (st().phase === 'suits' ? E.waitingOn(st())[0] ?? st().turn : st().turn);
  const humanTurn = () => playing() && G.mode !== 'past' && G.mode !== 'sim' && (G.mode === 'online' ? G.status === 'active' && st().turn === G.me : !pl(st().turn).ai);
  // On a shared device the hand stays face down until its owner taps to see it.
  const canAct = () => humanTurn() && (G.mode !== 'local' || G.shown === st().turn);
  const you = (i) => (G.mode === 'ai' && i === 0) || (G.mode === 'online' && i === G.me);
  // Hands are secret while the game is on — and after it ends, until the results have been revealed: your own in a computer
  // game, and only the player whose turn it is on a shared device.
  function secret(i) {
    const s = st();
    if ((s.phase === 'over' && G.revealed) || G.mode === 'sim' || G.mode === 'past') return false;
    if (G.mode === 'ai' || G.mode === 'online') return i !== (G.mode === 'online' ? G.me : 0);
    return !(i === activeSeat() && G.shown === i);
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
    if (row) cls.push('scored');
    if (row && row.blanked) cls.push('blanked');
    // Long rules (two effects, or one wordy one) are set a little tighter so they fit.
    if (E.cardText(id).length > (c.fx.length > 1 ? 48 : 58)) cls.push('long');
    if (o.cls) cls.push(o.cls);
    const asWild = row && row.suit && row.suit !== c.suit ? `<span class="hc-wild" title="${cname(id)} is counting as a ${esc(S.name)}">as ${S.icon}</span>` : '';
    const val = row ? `<span class="hc-val${row.blanked ? ' zero' : row.value < c.power ? ' down' : row.value > c.power ? ' up' : ''}" title="What this card scores in this hand">${row.blanked ? 0 : row.value}</span>` : '';
    const stamp = row && row.blanked ? `<span class="hc-stamp" title="${row.blanked === id ? 'Its condition isn’t met' : `Blanked by ${cname(row.blanked)}`}">Blanked</span>` : '';
    const clr = row && row.cleared && !row.blanked && E.isPenalty(id) ? `<span class="hc-clear" title="Penalty cleared by ${cname(row.cleared)}">🛡️</span>` : '';
    const delay = `--d:${((c.i * 0.37) % 3).toFixed(2)}s`;
    return `<div class="${cls.join(' ')}" style="--sc:${E.SUIT[c.suit].color};${delay}"${o.attrs ? ' ' + o.attrs : ''}>
      <div class="hc-art"><img src="${IMG(id)}" alt="" loading="lazy" draggable="false"></div>
      <span class="hc-band">${E.SUIT[c.suit].icon} ${esc(E.SUIT[c.suit].name)}</span>
      <span class="hc-pow" title="Power">${c.power}</span>
      <span class="hc-suit" title="${esc(E.SUIT[c.suit].name)}">${E.SUIT[c.suit].icon}</span>${asWild}${clr}
      <div class="hc-body"><b class="hc-name${c.name.length > 15 ? ' xl' : c.name.length > 11 ? ' l' : ''}">${cname(id)}</b><p class="hc-fx">${fxHtml(id)}</p></div>
      ${val}${stamp}${o.extra || ''}
    </div>`;
  }
  // Every card name shows in full: one too long for its card is set smaller until it fits, and wraps onto a second
  // line rather than get too small to read. Cards are drawn at many widths (the Plaza shrinks with the screen).
  const NAME_MIN_PX = 8;
  function fitNames() {
    const names = [...document.querySelectorAll('.hc-name')];
    names.forEach((el) => {
      el.style.fontSize = '';
      el.classList.remove('wrap');
    });
    const fits = names.map((el) => {
      const w = el.clientWidth;
      if (!w || el.scrollWidth <= w + 0.5) return null;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      return { el, size: Math.floor(fs * (w / el.scrollWidth) * 4) / 4 };
    }).filter(Boolean);
    fits.forEach((f) => {
      if (f.size >= NAME_MIN_PX) f.el.style.fontSize = `${f.size}px`;
      else {
        f.el.style.fontSize = `${NAME_MIN_PX}px`;
        f.el.classList.add('wrap');
      }
    });
    fits.forEach((f) => {
      for (let k = 0; k < 6 && !f.el.classList.contains('wrap') && f.el.scrollWidth > f.el.clientWidth + 0.5; k++) f.el.style.fontSize = `${parseFloat(f.el.style.fontSize) - 0.25}px`;
    });
  }
  const plazaSizeCache = new Map();
  function sizePlazaSlots() {
    const plaza = document.querySelector('.plaza');
    if (!plaza) return;
    const slots = [...plaza.querySelectorAll('.pz-slot')];
    slots.forEach((el) => (el.style.height = ''));
    const width = slots[0] && slots[0].getBoundingClientRect().width;
    if (!width) return;
    const key = width.toFixed(2);
    let height = plazaSizeCache.get(key);
    if (!height) {
      const measure = document.createElement('div');
      measure.className = 'plaza-measure';
      measure.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;visibility:hidden;pointer-events:none`;
      measure.innerHTML = Object.keys(E.CARD).map((id) => `<div class="pz-slot">${cardHtml(id, { small: true })}</div>`).join('');
      document.body.appendChild(measure);
      fitNames();
      height = Math.ceil(Math.max(0, ...[...measure.querySelectorAll('.hc')].map((el) => el.getBoundingClientRect().height)));
      measure.remove();
      plazaSizeCache.set(key, height);
    }
    if (height) slots.forEach((el) => (el.style.height = `${height}px`));
  }
  let fitQueued = false;
  const queueFit = () => {
    if (fitQueued) return;
    fitQueued = true;
    requestAnimationFrame(() => {
      fitQueued = false;
      fitNames();
      sizePlazaSlots();
    });
  };
  new MutationObserver((list) => {
    if (list.some((m) => [...m.addedNodes].some((n) => n.nodeType === 1 && !n.classList.contains('plaza-measure') && (n.classList.contains('hc') || n.querySelector('.hc-name'))))) queueFit();
  }).observe(document.body, { childList: true, subtree: true });
  addEventListener('resize', queueFit);
  if (document.fonts) document.fonts.ready.then(() => { plazaSizeCache.clear(); queueFit(); });
  const backHtml = (cls) => `<div class="hc back${cls ? ' ' + cls : ''}"><span class="hb-logo">🦸</span></div>`;
  const face = (id, cls) => `<img class="face${cls ? ' ' + cls : ''}" src="${IMG(id)}" alt="${cname(id)}" title="${cname(id)} · ${E.SUIT[C(id).suit].icon} ${esc(E.SUIT[C(id).suit].name)}" width="28" height="28" loading="lazy">`;

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
    const sparks = Array.from({ length: 14 }, (_, i) => `<i style="left:${4 + ((i * 41) % 92)}%;top:${6 + ((i * 29) % 50)}%;animation-delay:${(i * 0.45).toFixed(2)}s"></i>`).join('');
    return `<div class="gh-top"><a class="gh-lobby" href="/ahrens-games" title="Back to the game lobby">← <img class="gh-dice" src="/img/board-games-favicon-48.png?v=8" alt="" width="20" height="20"> Game lobby</a>${window.GameMusic ? GameMusic.buttonHtml('btn ghost sm gh-music', 'bt') : ''}</div>
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
          <button data-v="ai" class="gh-mode on"><span>🤖</span><b>Computer</b><small>Rival leagues</small></button>
          <button data-v="local" class="gh-mode"><span>👥</span><b>Players</b><small>2–5 on this device</small></button>
          <button data-v="online" class="gh-mode"><span>🌐</span><b>Online</b><small>Challenge friends</small></button>
        </div>
        <div class="online-only" id="online-box"></div>
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
          <button class="btn ghost sm" data-tutorial="heroes-ad">🎞️ Watch the trailer</button>
          <button class="btn ghost sm" data-tutorial="heroes">🎬 Watch the tutorial</button>
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
        if (b.dataset.v === 'online') Online.showLobby();
      }
      if (b.parentNode.id === 'seats') names();
      if (b.parentNode.id === 'level') hint();
    });
    setMode(focusGame ? 'online' : 'ai');
    if (focusGame || $('#mode .on').dataset.v === 'online') Online.showLobby(focusGame);
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
      aiIdentities(state);
      startFrom({ state, mode, level, view: 0, gid: newLocalId() });
      if (mode === 'ai') showMissionIntro();
    };
  }

  // ---------------------------------------------------------------- game screen
  function startFrom(g) {
    if (!sessionId()) return showGate();
    stopAI();
    G = g;
    G.shown = null;
    document.body.className = 'game-mode';
    window.scrollTo(0, 0);
    save();
    // Each saved game has its own address, so reloading reopens this game and the bare page is always home.
    const q = G.mode === 'online' && G.id ? `?game=${encodeURIComponent(G.id)}` : G.mode === 'past' && G.gid ? `?past=${encodeURIComponent(G.gid)}` : G.gid && (G.mode === 'ai' || G.mode === 'local') ? `?local=${encodeURIComponent(G.gid)}` : '';
    if (history.replaceState && location.search !== q) history.replaceState(null, '', location.pathname + q);
    render();
    if (G.mode === 'online' && G.gmode === 'quick' && G.status === 'active') Online.tickClock();
    if (st().phase === 'over') showGameOver(!!G.revealed);
    else if (G.mode !== 'online') scheduleAI();
    else if (G.status === 'active') {
      Online.connectSock();
      identityPicker() || suitPicker();
    }
  }

  // Whose team the big hand panel shows.
  function handOwner() {
    const s = st();
    if (s.phase !== 'over') {
      if (G.mode === 'ai' || G.mode === 'online') return G.mode === 'online' ? G.me : 0;
      if (G.mode === 'local') return activeSeat();
      if (G.mode === 'sim' && G.follow !== false) return s.turn;
    }
    return G.view || 0;
  }

  function render() {
    if (!G) return;
    const s = st();
    const M = mission();
    const sub = G.mode === 'past' ? '📜 Finished game' : G.mode === 'sim' ? `🧪 ${SIM_SPEEDS[G.speed].name} · computer vs computer` : G.mode === 'online' ? `🌐 ${s.players.length > 2 ? `${s.players.length}-player game` : `vs ${esc(pl(1 - G.me).name)}`}${G.gmode === 'quick' ? ' · ⚡' : ''}${G.gmode === 'quick' && G.deadline ? ' <span class="ol-clock" id="ol-clock"></span>' : ''}` : G.mode === 'local' ? `👥 ${s.players.length} leagues` : `🤖 vs ${plural(s.players.length - 1, 'rival')} · ${LEVEL_NAME[G.level] || ''}`;
    const home = G.mode === 'past' ? '🏆<span class="bt"> History</span>' : G.mode === 'sim' ? '⏹<span class="bt"> Stop</span>' : G.mode === 'online' ? '🌐<span class="bt"> Game</span>' : '🦸<span class="bt"> New game</span>';
    const pz = s.plaza.length;
    $('#app').innerHTML = `
      <header class="topbar">
        <div class="brand">
          <img src="/img/heroes-icon-180.png?v=3" alt="" class="brand-logo" width="46" height="46">
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
          ${G.mode === 'online' && G.status === 'active' ? '<button class="btn ghost sm" data-act="resignOnline" aria-label="Resign">🏳️<span class="bt"> Resign</span></button>' : ''}
          <button class="btn ghost sm" data-act="rules" aria-label="Rules">📜<span class="bt"> Rules</span></button>
          <button class="btn ghost sm" data-act="home" aria-label="${G.mode === 'past' ? 'History' : G.mode === 'sim' ? 'Stop' : 'New game'}" title="${G.mode === 'past' ? 'Back to history' : G.mode === 'sim' ? 'Stop the simulation' : 'Start a new game (this one stays saved under Your games)'}">${home}</button>
          <a class="btn ghost sm" href="/ahrens-games/settings" title="Ahrens Games settings" aria-label="Settings">⚙️<span class="bt"> Settings</span></a>
          <a class="btn ghost sm" href="/ahrens-games" title="Back to the game lobby" aria-label="Game lobby"><img class="gh-dice" src="/img/board-games-favicon-48.png?v=8" alt=""><span class="bt"> Lobby</span></a>
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
    const choosing = s.phase === 'suits' && !p.suits;
    const turn = (playing() && s.turn === i) || choosing;
    const owner = handOwner();
    const tag = choosing ? '<span class="co-tag turn">Choosing suits…</span>' : turn ? `<span class="co-tag turn">${p.ai ? 'Thinking…' : G.mode === 'ai' ? 'Your turn' : 'Up now'}</span>` : '';
    const sc = secret(i) || !showScores() ? null : E.score(s, p);
    const known = p.took.length ? `<span class="co-known" title="Cards everyone saw ${esc(p.name)} recruit from the Plaza">👁️ ${p.took.slice(-4).map((c) => face(c)).join('')}</span>` : '';
    return `<div class="co${turn ? ' turn' : ''}${owner === i ? ' viewing' : ''}" style="--pc:${PCOLOR[i]}" data-view="${i}" title="${secret(i) ? `What you know about ${esc(p.name)}` : `Show ${esc(p.name)}’s team`}">
      <span class="co-flag">${SIGN[i]}</span>
      <div class="co-name"><b>${esc(p.name)}</b>${p.ai ? `<span class="co-tag">🤖 ${LEVEL_NAME[p.level] || ''}</span>` : ''}${tag}</div>
      <div class="co-stats"><span title="Cards in hand">🃏 <b>${p.hand.length}</b></span><span title="Heroes recruited from the Plaza">🏙️ <b>${p.stats.plaza}</b></span>${sc ? `<span title="Team score">⭐ <b>${sc.total}</b></span>` : '<span title="Scores are counted at the end">⭐ <b>?</b></span>'}${p.identity || p.idOffer ? `<span title="Secret identity">🎭 <b>${p.identity && (!secret(i) || showScores()) ? E.IDENTITIES[p.identity].icon : '?'}</b></span>` : ''}${known}</div>
    </div>`;
  }

  function bannerHtml() {
    const s = st();
    if (G.mode === 'past') {
      const w = E.winner(s);
      return `<div class="banner">📜 ${w < 0 ? 'A tie!' : `${esc(pl(w).name)} won`} · tap a league to see its team · <button class="btn sm" data-act="scorecard">🏆 Scorecard</button></div>`;
    }
    if (s.phase === 'over') return `<div class="banner mine">🏁 ${s.ended === 'deck' ? 'The deck ran out' : `The ${E.PLAZA_END}th hero reached the Plaza`} — hands down! Tap a league to see its team. <button class="btn sm" data-act="scorecard">🏆 See who won</button></div>`;
    const dot = `<span class="dot"></span>`;
    if (s.phase === 'suits') {
      const pi = activeSeat();
      const q = pl(pi);
      const mine = G.mode === 'online' ? !pl(G.me).suits : G.mode === 'ai' ? !pl(0).suits : true;
      if (G.mode === 'local' && G.shown !== pi) return `<div class="banner mine pass" style="--pc:${PCOLOR[pi]}">${dot}🏁 Hands down! 📱 Pass the device to <b>${esc(q.name)}</b> to choose suits before scoring. <button class="btn sm" data-act="reveal">👀 I’m ${esc(q.name)} — choose my suits</button></div>`;
      if (mine) return `<div class="banner mine" style="--pc:${PCOLOR[G.mode === 'online' ? G.me : G.mode === 'ai' ? 0 : pi]}">${dot}🏁 Hands down! <b>Choose your suits</b> for Mimic, the Hero Signal or Penny Press before the scores are counted. <button class="btn sm" data-act="suits">🎭 Choose suits</button></div>`;
      const waiting = E.waitingOn(s).map((j) => esc(pl(j).name)).join(', ');
      return `<div class="banner">${dot}🏁 Hands down! Waiting for ${waiting} to choose suits before scoring…</div>`;
    }
    const p = pl(s.turn);
    if (p.ai) return `<div class="banner" style="--pc:${PCOLOR[s.turn]}">${dot}${esc(p.name)} is ${s.phase === 'draw' ? 'choosing a card' : 'deciding who to send to the Plaza'}…</div>`;
    if (G.mode === 'online' && !humanTurn()) return `<div class="banner">${dot}Waiting for ${esc(p.name)} to take their turn…</div>`;
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
  // What a hand scores with this league's Plaza context (Plaza cards and recruits count for some abilities).
  const scoreOf = (pi) => E.scoreFor(st(), pi);
  function missionCheck(pi) {
    const r = scoreOf(pi);
    const live = r.cards.filter((x) => !x.blanked);
    const has = (s) => live.filter((x) => x.suit === s).length;
    return { r, has };
  }
  function missionHtml() {
    const s = st();
    const M = mission();
    const owner = handOwner();
    const chk = !secret(owner) && showScores() ? missionCheck(owner) : null;
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
    const idChip = !hidden && p.identity ? `<button class="ident-chip" data-act="identity" title="Your secret identity — only you can see it">🎭 ${identName(p.identity)}<small>${esc(E.identityText(p.identity))}</small></button>` : '';
    const head = `<div class="hand-head"><span class="sign" style="--pc:${PCOLOR[owner]}">${SIGN[owner]}</span><div><h2>${G.mode === 'ai' && owner === 0 ? 'Your team' : `${esc(p.name)}’s team`}</h2><small>${hidden ? 'Face down' : `${plural(p.hand.length, 'card')}`}</small></div>${idChip}`;
    if (hidden) {
      return `<section class="panel hand" style="--pc:${PCOLOR[owner]}">${head}</div>
        <div class="hand-cards curtained">${p.hand.map(() => backHtml()).join('')}
          <div class="curtain"><b>📱 ${esc(p.name)}’s hand</b><span>Everyone else, look away!</span><button class="btn" data-act="reveal">👀 Show my hand</button></div>
        </div></section>`;
    }
    const scored = showScores();
    const r = scoreOf(owner);
    const rowOf = {};
    if (scored) r.cards.forEach((x) => (rowOf[x.id] = x));
    const myDiscard = canAct() && s.phase === 'discard' && owner === s.turn;
    let cards = sorted(p.hand).map((id) => {
      const isNew = playing() && s.turn === owner && p.drew === id;
      let extra = '';
      if (myDiscard) {
        if (id === p.fresh) extra = '<span class="send no">Just recruited — keeps</span>';
        else extra = `<button class="send" data-send="${id}" title="Send ${cname(id)} to the Plaza">📤 Send</button>`;
      }
      return `<div class="hand-slot${isNew ? ' new' : ''}">${isNew ? `<span class="new-tag">${p.fresh === id ? '🏙️ Recruited' : '🂠 Drawn'}</span>` : ''}${cardHtml(id, { row: rowOf[id], attrs: `data-card="${id}"`, cls: 'live' })}${extra}</div>`;
    }).join('');
    if (scored && r.raised) {
      cards += `<div class="hand-slot raised"><span class="new-tag">⛓️ From the Plaza</span>${cardHtml(r.raised, { row: rowOf[r.raised], cls: 'live', attrs: `title="${cname(r.raisedBy)} sprang ${cname(r.raised)} from the Plaza"` })}</div>`;
    }
    if (!scored) {
      return `<section class="panel hand" style="--pc:${PCOLOR[owner]}">${head}
        <div class="hand-score" title="Scores are counted when the game ends"><small>Team score</small><b>?</b></div></div>
      <div class="hand-cards">${cards}</div>
      <p class="hand-tip">🧮 No running totals: add up your own team — power, bonuses, penalties, the Mission and your secret identity. Every league’s score is revealed at the end. Tap a card to read it.</p>
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
        ${p.identity ? `<span title="Secret identity">🎭 Identity <b>${signed(sc.ident)}</b> <small>${identName(p.identity)}</small></span>` : ''}
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
    if (act === 'resignOnline') {
      const modal = openModal(`<h2>🏳️ Resign this game?</h2><p>Your opponent wins right away.</p><div class="btn-row"><button class="btn lava" data-resign-confirm>Yes, resign</button><button class="btn ghost" data-close>Keep playing</button></div>`);
      modal.addEventListener('click', (e) => { if (e.target.closest('[data-resign-confirm]')) { closeModal(); Online.resign(); } });
      return;
    }
    if (act === 'scorecard') return showGameOver(true);
    if (act === 'mission') return showMission();
    if (act === 'identity') return showIdentity(handOwner());
    if (act === 'reveal') {
      if (G.mode === 'local' && (humanTurn() || st().phase === 'suits')) {
        G.shown = activeSeat();
        sfx('card');
        render();
        identityPicker() || suitPicker();
      }
      return;
    }
    if (act === 'suits') return suitPicker();
    if (!canAct()) return;
    if (act === 'deck') return drawDeck();
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
  function doAction(a) {
    if (G.mode === 'online') return Online.send(a);
    const s = st();
    const pi = s.turn;
    const actor = pl(pi);
    try {
      E.apply(s, pi, a);
    } catch (err) {
      toast(esc(err.message), 'bad');
      return;
    }
    if (s.phase === 'over' && (G.mode === 'ai' || G.mode === 'local')) recordGame();
    if (!actor.ai) G.moved = true;
    if (a.t === 'identity') {
      save();
      render();
      return scheduleAI();
    }
    const quiet = G.mode === 'sim' && G.speed === 'turbo';
    if (a.t === 'draw') {
      if (!quiet) sfx(a.from === 'plaza' ? 'join' : 'card');
      if (!actor.ai && a.from === 'deck' && !quiet) toast(`🂠 You drew <b>${cname(actor.drew)}</b> (${E.SUIT[C(actor.drew).suit].icon} ${C(actor.drew).power}).`);
    } else {
      if (!quiet) sfx('place');
      if (G.mode === 'local' && s.phase !== 'over') {
        G.shown = null;
        if (!quiet) toast(`${leagueName(pi)} sent <b>${cname(a.c)}</b> to the Plaza. Pass the device to ${leagueName(activeSeat())}.`);
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
    if (row.shielded) lines.push(`<li class="spec"><span>🛡️ Saved from blanking by ${cname(row.shielded)}</span><b></b></li>`);
    if (row.suit !== c.suit) lines.push(`<li class="spec"><span>🎭 Counting as a ${esc(E.SUIT[row.suit].name)}</span><b></b></li>`);
    lines.push(`<li class="tot"><span>Scores</span><b>${row.value}</b></li>`);
    return lines.join('');
  }
  function showCard(id, owner) {
    const s = st();
    let row = null;
    if (showScores() && owner != null && !secret(owner) && pl(owner).hand.includes(id)) row = scoreOf(owner).cards.find((x) => x.id === id);
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
    const r = secret(owner) || !showScores() ? null : scoreOf(owner).mission;
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
  // ---------------------------------------------------------------- secret identities
  function aiIdentities(state) {
    state.players.forEach((p, i) => p.ai && p.idOffer && E.apply(state, i, E.aiIdentity(state, i, p.level || 'normal')));
  }
  const identName = (id) => `${E.IDENTITIES[id].icon} ${esc(E.IDENTITIES[id].name)}`;
  function identTile(id, attrs) {
    const I = E.IDENTITIES[id];
    return `<button class="ident-tile" ${attrs || ''}><span class="it-icon">${I.icon}</span><b>${esc(I.name)}</b><span class="it-rule">${esc(E.identityText(id))}</span><small>“${esc(I.story)}”</small></button>`;
  }
  // A person who still holds two identity cards picks one before their first move.
  function identityPicker() {
    if (!G || ui.modal || G.mode === 'sim' || G.mode === 'past' || st().phase === 'over') return false;
    const s = st();
    let pi = null;
    if (G.mode === 'ai' && pl(0).idOffer) pi = 0;
    else if (G.mode === 'online' && G.status === 'active' && pl(G.me).idOffer) pi = G.me;
    else if (G.mode === 'local' && G.shown === s.turn && pl(s.turn).idOffer) pi = s.turn;
    if (pi == null) return false;
    const p = pl(pi);
    const M = mission();
    const back = openModal(`<h2>🎭 Choose your secret identity</h2>
      <p>${G.mode === 'local' ? `${esc(p.name)}, you’ve` : 'You’ve'} been dealt two secret identities. Keep one — it scores extra at the end, on top of the Mission. Nobody else knows which you chose until the hands go down, so watch what the other leagues recruit and guess theirs.</p>
      <div class="ident-pick">${p.idOffer.map((id) => identTile(id, `data-ident="${id}"`)).join('')}</div>
      <h3>Your team so far</h3><div class="known-row">${sorted(p.hand).map((c) => cardHtml(c, { small: true })).join('')}</div>
      <p class="muted">Today’s Mission: ${M.icon} ${esc(M.name)} — ${suitTag(M.need[0])} + ${suitTag(M.need[1])}.</p>`, { cls: 'wide', noClose: true });
    back.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ident]');
      if (!b) return;
      if (G.mode === 'online') {
        closeModal(true);
        return Online.send({ t: 'identity', id: b.dataset.ident });
      }
      try {
        E.apply(st(), pi, { t: 'identity', id: b.dataset.ident });
      } catch (err) {
        return toast(esc(err.message), 'bad');
      }
      G.moved = true;
      closeModal(true);
      sfx('card');
      toast(`🎭 ${G.mode === 'local' ? `${leagueName(pi)} is` : 'You are'} secretly <b>${identName(b.dataset.ident)}</b>. Keep it quiet!`);
      save();
      render();
      scheduleAI();
    });
    return true;
  }
  // ---------------------------------------------------------------- suits at the end
  // When the hands go down, Mimic and the Hero Signal need a suit, and Penny Press may give one other card a new one.
  function suitSeat() {
    if (!G || G.mode === 'sim' || G.mode === 'past' || st().phase !== 'suits') return null;
    if (G.mode === 'ai') return pl(0).suits ? null : 0;
    if (G.mode === 'online') return G.status === 'active' && !pl(G.me).suits ? G.me : null;
    const pi = activeSeat();
    return G.shown === pi && !pl(pi).suits ? pi : null;
  }
  function suitPicker() {
    if (!G || ui.modal) return false;
    const pi = suitSeat();
    if (pi == null) return false;
    const s = st();
    const p = pl(pi);
    const M = mission();
    const ch = E.suitChoices(p.hand, s.mission);
    const pick = { w: {}, re: null };
    const suitBtn = (t, on, attrs) => `<button class="sp-suit${on ? ' on' : ''}" style="--sc:${E.SUIT[t].color}" ${attrs}>${E.SUIT[t].icon} ${esc(E.SUIT[t].name)}</button>`;
    const body = () => {
      const own = ch.own.map((x) => `<div class="sp-row">${cardHtml(x.id, { small: true })}<div class="sp-opts">
        <p><b>${cname(x.id)}</b> counts as ${x.suits.length < E.SUITS.length ? 'one of the Mission’s suits' : 'any suit you like'}:</p>
        <div class="sp-suits">${x.suits.map((t) => suitBtn(t, pick.w[x.id] === t, `data-own="${x.id}" data-suit="${t}"`)).join('')}</div></div></div>`).join('');
      let re = '';
      if (ch.recolor) {
        const c = pick.re && pick.re.c;
        re = `<div class="sp-row">${cardHtml(ch.recolor.by, { small: true })}<div class="sp-opts">
          <p><b>${cname(ch.recolor.by)}</b> can make one other card count as a different suit — or leave them all as they are.</p>
          <div class="sp-cards"><button class="sp-card none${c ? '' : ' on'}" data-re-card="">✋ No change</button>${ch.recolor.cards.map((id) => `<button class="sp-card${c === id ? ' on' : ''}" data-re-card="${id}">${face(id)}<span>${cname(id)}</span></button>`).join('')}</div>
          ${c ? `<p>${cname(c)} counts as:</p><div class="sp-suits">${E.SUITS.filter((t) => t !== C(c).suit).map((t) => suitBtn(t, pick.re.s === t, `data-re-suit="${t}"`)).join('')}</div>` : ''}</div></div>`;
      }
      const ready = ch.own.every((x) => pick.w[x.id]) && (!pick.re || pick.re.s);
      return `${own}${re}<p class="muted">Today’s Mission: ${M.icon} ${esc(M.name)} — ${suitTag(M.need[0])} + ${suitTag(M.need[1])}${p.identity ? ` · your secret identity: ${identName(p.identity)}` : ''}</p>
        <div class="btn-row"><button class="btn" data-lock ${ready ? '' : 'disabled'}>✅ Lock in and score</button></div>`;
    };
    const back = openModal(`<h2>🎭 ${G.mode === 'local' ? `${esc(p.name)}, choose` : 'Choose'} your suits</h2>
      <p>The hands are down! Before the scores are counted, decide what these cards count as. No scores are shown until every league has chosen, so work out what’s best for your team.</p>
      <div class="sp-body">${body()}</div>`, { cls: 'wide', noClose: true });
    const box = back.querySelector('.sp-body');
    back.addEventListener('click', (e) => {
      const own = e.target.closest('[data-own]');
      const card = e.target.closest('[data-re-card]');
      const re = e.target.closest('[data-re-suit]');
      if (own) pick.w[own.dataset.own] = own.dataset.suit;
      else if (card) pick.re = card.dataset.reCard ? { c: card.dataset.reCard, s: null } : null;
      else if (re) pick.re.s = re.dataset.reSuit;
      else if (e.target.closest('[data-lock]')) return lockSuits(pi, { t: 'suits', w: pick.w, re: pick.re });
      else return;
      box.innerHTML = body();
    });
    return true;
  }
  function lockSuits(pi, a) {
    if (G.mode === 'online') {
      closeModal(true);
      return Online.send(a);
    }
    const s = st();
    try {
      E.apply(s, pi, a);
    } catch (err) {
      return toast(esc(err.message), 'bad');
    }
    G.moved = true;
    closeModal(true);
    sfx('card');
    if (s.phase === 'over') {
      recordGame();
      save();
      render();
      sfx('reveal');
      setTimeout(() => G && G.state === s && showGameOver(false), 700);
      return;
    }
    if (G.mode === 'local') {
      G.shown = null;
      toast(`${leagueName(pi)} chose their suits. Pass the device to ${leagueName(activeSeat())}.`);
    }
    save();
    render();
  }
  function showIdentity(i) {
    const p = pl(i);
    if (!p.identity || secret(i)) return;
    const r = showScores() ? E.score(st(), p) : null;
    openModal(`<h2>🎭 ${G.mode === 'ai' && i === 0 ? 'Your' : `${esc(p.name)}’s`} secret identity</h2>
      <div class="ident-pick one">${identTile(p.identity, 'disabled')}</div>
      ${r ? `<p>It scored <b>${signed(r.ident)}</b>.</p>` : '<p class="muted">Blanked cards don’t count. Mimic and the Hero Signal count as the suit they copy. It’s scored at the end, with the Mission.</p>'}`, { onClose: () => scheduleAI() });
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
      <p>The Mission is worth a lot — a team that misses it rarely wins. Next you’ll pick a <b>secret identity</b> of your own.</p>
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
    if (identityPicker() || suitPicker()) return;
    if (!G || ui.modal || !playing() || !pl(st().turn).ai || G.mode === 'past' || G.mode === 'online') return;
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
    ['🎭 Secret identity', 'ident'],
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
    // A Villain the Ringleader sprang from the Plaza plays as an extra card.
    const team = (i) => {
      const r = scoreOf(i);
      return sorted(pl(i).hand).map((id) => face(id)).join('') + (r.raised ? face(r.raised, 'raised') : '');
    };
    const mis = (i) => (sc[i].done ? `${M.icon} ✓` : `${M.icon} ✗`);
    // Places and the margin stay out of the page until the announcement, so nothing gives the result away early.
    const side = (i) => `<div class="hr-side" style="--pc:${PCOLOR[i]}"><span class="hr-crown">👑</span><span class="hr-sign">${SIGN[i]}</span><b class="hr-name">${esc(pl(i).name)}</b><span class="hr-total">?</span><small class="hr-place">${mis(i)}</small>${pl(i).identity ? '<small class="hr-ident">🎭 ???</small>' : ''}<span class="hr-team">${team(i)}</span></div>`;
    const lead = (k, i) => {
      if (!['base', 'bonus', 'mission', 'ident'].includes(k)) return false;
      const vals = sc.map((x) => x[k]);
      const best = Math.max(...vals);
      return vals[i] === best && vals.filter((x) => x === best).length === 1;
    };
    const cell = (k, v) => (k === 'penalty' && v ? `−${v}` : k === 'mission' || k === 'bonus' || k === 'ident' ? signed(v || 0) : v);
    document.querySelectorAll('.hl-reveal').forEach((x) => x.remove());
    const el = document.createElement('div');
    el.className = 'hl-reveal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Final results');
    el.innerHTML = `<div class="hr-rays"></div><div class="hr-stage">
        <div class="hr-title">${M.icon} Mission debrief: ${esc(M.name)}</div>
        ${s.ended ? `<div class="hr-why">${s.ended === 'plaza' ? `🏙️ The ${E.PLAZA_END}th hero reached the Plaza` : '🂠 The deck ran out'}${s.last && s.last.gave ? ` when ${esc(pl(s.last.who).name)} sent ${cname(s.last.gave)} there` : ''} — hands down!</div>` : ''}
        <div class="hr-shops n${n}">${s.players.map((_, i) => side(i)).join('')}</div>
        <div class="hr-verdict" aria-live="polite"></div>
        <div class="hr-sub"></div>
        <div class="hr-rows" style="--n:${n}"></div>
        <div class="hr-actions"><button class="btn" data-rv="close">🦸 See every team</button>${G.mode === 'past' ? '' : `<button class="btn" data-rv="again">${G.mode === 'sim' ? '🧪 Run again' : '🦸 Play again'}</button>`}${G.mode === 'sim' ? '' : '<button class="btn ghost" data-rv="hist">🏆 Game history</button>'}<a class="btn ghost" href="/ahrens-games"><img class="gh-dice" src="/img/board-games-favicon-48.png?v=8" alt=""> All board games</a></div>
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
      sides.forEach((x, i) => {
        const t = x.querySelector('.hr-ident');
        if (t) t.innerHTML = `🎭 ${identName(pl(i).identity)} <b>${signed(sc[i].ident)}</b>`;
      });
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
  // Finished games wait in this browser until the server has them, so a dropped connection or an expired
  // sign-in can't lose one: they're sent again on the next visit.
  const HISTORY_QUEUE = 'ahrensHeroes.historyQueue';
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
        const r = await api('/api/heroes/history/record', item);
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
    if (!g || g.recorded || !sessionId()) return;
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
    const r = await api(`/api/heroes/history/board?id=${encodeURIComponent(id)}`);
    const state = r.ok && r.data && r.data.state;
    if (!state || !Array.isArray(state.players) || state.phase !== 'over') return toast(esc((r.data && r.data.error) || 'Couldn’t load that game.'), 'bad');
    if (state.v !== E.SAVE_V) return toast('That game was played on an older version of Hero League, so it can’t be shown.', 'bad');
    const h = (hist.items || []).find((x) => x.id === id);
    startFrom({ state, mode: 'past', level: h && h.level, view: r.data.me != null ? r.data.me : h && h.me != null ? h.me : 0, gid: id, revealed: true });
  }

  const hist = { items: null, kind: 'all' };
  const HIST_ROWS = [['⭐ Score', 'total'], ['🃏 Card power', 'base'], ['✨ Bonuses', 'bonus'], ['💥 Penalties', 'penalty'], ['🎯 Mission', 'mission'], ['🎭 Identity', 'ident'], ['🏙️ Recruits', 'plaza']];

  async function showHistory() {
    location.href = '/game-history.html?game=heroes';
    return;
    stopAI();
    G = null;
    document.body.className = 'setup-mode';
    $('#app').innerHTML = `
      <div class="setup gh">
      <div class="gh-top"><a class="gh-lobby" href="/ahrens-games" title="Back to the game lobby">← <img class="gh-dice" src="/img/board-games-favicon-48.png?v=8" alt="" width="20" height="20"> Game lobby</a><button class="btn ghost sm" id="hist-new">🦸 New game</button></div>
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
    window.BoardHistory.render(box, {
      game: 'heroes',
      fmt: (n) => `⭐${n}`,
      rows: HIST_ROWS,
      colors: PCOLOR,
      levels: LEVEL_NAME,
      foe: 'computer league',
      view: '🦸 See the teams',
      canView: () => true,
      onView: openPast,
      empty: 'No finished games yet. Games are added when the Plaza fills up.',
    }, hist);
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
    aiIdentities(state);
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
    ['identity', 'Secret identities'],
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
      body = `${window.AhrensTutorial ? '<p class="rb-video"><button class="btn sm" data-tutorial="heroes">🎬 Watch the video tutorial</button> New to the game? The video plays a real game against the computer, step by step.</p>' : ''}
        ${sec(1, 'The story')}
        <p>The city needs heroes, and every league wants the best team. You start with seven hero cards. Each turn you <b>draw one</b> and <b>send one away</b> to the Plaza, where the other leagues — and you, later — can recruit it. When the Plaza fills up, every league lays down its seven cards and scores them.</p>
        ${sec(2, 'How to win')}
        <p>The league whose seven cards score the <b>most points</b> wins. Cards score their printed power, plus bonuses for good teammates, minus penalties for bad ones — and the whole team scores extra if it fits the <b>Mission</b>. Every league also has a <b>secret identity</b>: a personal goal only they know about until the end.</p>
        ${sec(3, 'What’s in the box')}
        <ul><li>🦸 <b>${E.CARDS.length} hero cards</b> in ${E.SUITS.length} suits: ${E.SUITS.map((s) => `${S[s].icon} ${S[s].plural} (${E.CARDS.filter((c) => c.suit === s).length})`).join(', ')}.</li>
        <li>🎯 <b>${E.MISSION_ORDER.length} Mission cards</b>. One is turned face up each game.</li>
        <li>🎭 <b>${E.IDENTITY_ORDER.length} Secret Identity cards</b>. Each league keeps one, face down.</li>
        <li>🏙️ <b>The Plaza board</b> with ${E.PLAZA_END} spaces for sent-away cards.</li>
        <li>No dice and no money — only the cards.</li></ul>
        ${sec(4, 'The game in one paragraph')}
        <p>Every card has its own trick. Valora hits harder with the Star Hammer; Starbolt wipes out every Shadow; Mirra copies your strongest hero; Whisper scores for every Villain still loose in the Plaza; Prism wants a team where no two cards share a suit. Build a team where the abilities stack up, and watch what the others pick up from the Plaza — sending away a card a rival needs can cost you the game.</p>`;
    } else if (tab === 'setup') {
      body = `${sec(1, 'Deal')}
        <ol class="rb-flow"><li>Shuffle all ${E.CARDS.length} hero cards into a face-down deck.</li>
        <li>Deal <b>${E.HAND} cards</b> to each league. Keep your hand secret.</li>
        <li>Shuffle the Mission cards and turn one face up. Everyone plays for the same Mission.</li>
        <li>Deal each league <b>two Secret Identity cards</b>. Look at them, keep one face down, and put the other back in the box unseen.</li>
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
        <p class="rb-ex">Your hand has Valora but no Star Hammer — and the Star Hammer is sitting in the Plaza. Recruit it: Valora gets +12, and the Hammer adds the power of your strongest Bruiser (Valora’s 20). Then send away your weakest card. Careful: if you send away Scout, the next league might be the one with all the Bruisers.</p>
        ${sec(3, 'Watching the others')}
        <p>When a league recruits a card from the Plaza, everyone sees it. The 👁️ next to a league shows the Plaza cards they’ve taken and still hold. Use it to guess what they’re building — and to avoid sending them what they need.</p>`;
    } else if (tab === 'cards') {
      const ex = 'valora';
      body = `${sec(1, 'Anatomy of a card')}
        <div class="rb-card">${cardHtml(ex)}<ul><li><b>Power</b> (top left) — what the card scores on its own.</li><li><b>Suit</b> (top right) — ${S[C(ex).suit].icon} ${S[C(ex).suit].name}. Other cards and the Mission care about suits.</li><li><b>Ability</b> — <span class="fx pos">green</span> are bonuses, <span class="fx neg">red</span> are penalties, <span class="fx spec">blue</span> are special.</li></ul></div>
        ${sec(2, 'Bonuses')}
        <p>Bonuses come in many shapes. Read each card carefully:</p>
        <dl class="rb-terms"><dt>With / for each</dt><dd>“+12 with Star Hammer” is +12 if the Star Hammer is in your team. “+5 for each other Bruiser” counts every other Bruiser. A card never counts itself unless it says “your team”.</dd>
        <dt>Copy power</dt><dd>“Adds the power of your strongest Bruiser” (Star Hammer, Mirra, Cyberia, Gale, Echo) adds that card’s printed power on top.</dd>
        <dt>Exactly / pairs / all different</dt><dd>Baton and Coven Keeper want <b>exactly</b> three of their suit — a fourth spoils it. Verdant scores for each <b>pair</b> of cards that share a suit. Prism scores if <b>no two</b> cards share a suit.</dd>
        <dt>Combos</dt><dd>Some cards score a little with one partner and a lot with two: Valora gets +12 with the Star Hammer, but +40 instead with the Star Hammer <i>and</i> Ironclad. Doc Circuit, Stellara, Madame Moth and Cinder work the same way, and Seer Sela gets +50 if Coven Keeper and Mirra are both in your team.</dd>
        <dt>Patterns</dt><dd>Double Trouble scores for every card with an <b>even</b> power — and +40 instead if every card’s power is even. Kid Kinetic does the same for <b>odd</b> powers, with +50. The Trophy Case pays +10, +30 or +60 for 3, 4 or 5+ cards of one suit, and Pip adds the power of every other Sidekick.</dd>
        <dt>Big and small</dt><dd>Mighty Mo and Tag-Along Tess love teammates with power 20 or more; Nano Swarm loves teammates with power 10 or less.</dd>
        <dt>The Plaza</dt><dd>Some cards score from the <b>Plaza</b> when the game ends: Whisper for each Villain left there, Dash for each Gear. Blur, Phantom and Jett score extra only if you <b>recruited them from the Plaza</b>.</dd>
        <dt>Mission</dt><dd>Comet and Rookie score extra if your team completes the Mission — and lose points if it fails.</dd>
        <dt>Big swings</dt><dd>A few cards can score a huge amount in the right team. <b>Juggernaut</b> scores for every card in your biggest suit. The <b>Grand Archmage</b> scores for each full set of a Mystic, a Cosmic and a Shadow. <b>Hotshot</b> scores for every card you recruited from the Plaza. The <b>Understudy</b> scores big if every other card is small. <b>The Reaper</b> scores for every blanked card in your team, and <b>Mindbender</b> for every card with a penalty.</dd></dl>
        ${sec(3, 'Penalties')}
        <p>Penalties take points away (“−5 for each Tech”, or Raven’s “−5 for each Shadow left in the Plaza”). Some can cost a lot: <b>Singularity</b> loses points for every other big card, <b>Cataclysm</b> loses 35 if your team fails the Mission, and Juggernaut and Hotshot lose points when your team isn’t built their way. Many cards have both a bonus and a penalty — they’re only worth it in the right team. Some penalties <b>blank</b> other cards: a blanked card scores nothing, its ability does nothing, and it doesn’t count for any suit or for the Mission. The Crusher blanks every card with power 8 or less, and <b>Cataclysm</b> blanks every card that isn’t an Elemental, Cosmic, Bruiser or Villain. Some blanks spare a named card: Stormcaller blanks every Gear and Tech <i>except</i> Firewall. “Blanked unless you have…” cards blank themselves when their partner is missing.</p>
        ${sec(4, 'Special abilities')}
        <dl class="rb-terms"><dt>🛡️ Clear</dt><dd>The Banisher, Skybase and the Containment Cell <b>clear</b> penalties: the cleared card’s penalties — including blanking and “blanked unless” — just don’t happen. Scout clears the penalty on <b>any one</b> card you choose.</dd>
        <dt>🛡️ Shield</dt><dd>Lucky Cape and Firewall stop cards being <b>blanked</b> (other penalties still count). Like clears, shields always work.</dd>
        <dt>✂️ Strike a word</dt><dd>Ironclad strikes the word “Bruiser” from every penalty, and Hacklette strikes “Tech”: no penalty can count, blank or hurt those cards for their suit. Dr. Entropy can’t touch your Tech while Hacklette is on the team.</dd>
        <dt>📰 Penny Press</dt><dd>When the hands go down, you may pick one other card in your team (not Mimic or the Hero Signal): it counts as any suit you choose.</dd>
        <dt>⛓️ Ringleader</dt><dd>When the hands go down, he springs one Villain from the Plaza: it joins your team as an extra card and scores like the rest.</dd>
        <dt>🎭 Mimic</dt><dd>When the hands go down, you choose which suit it counts as.</dd>
        <dt>🔦 Hero Signal</dt><dd>When the hands go down, you choose which of the Mission’s two suits it counts as.</dd>
        <dt>⏪ Rewind</dt><dd>Your team doesn’t lose points for the Mission’s bad suit.</dd>
        <dt>🔮 Seer Sela</dt><dd>Doubles your +${E.MISSION_DONE} for completing the Mission.</dd></dl>
        ${sec(5, 'The suits')}
        <table><tr><th>Suit</th><th>Plays well with</th></tr>
        <tr><td>${S.bruiser.icon} Bruisers</td><td>The Star Hammer, Tremor, Scout and big teammates. Ironclad strikes their name from every penalty</td></tr>
        <tr><td>${S.speed.icon} Speedsters</td><td>Tech and Cyberia — but not Gear. Baton wants exactly three</td></tr>
        <tr><td>${S.tech.icon} Tech</td><td>Gear, Speedsters and Robo-Pup. Hated by Sorcerer Sable and Dr. Entropy</td></tr>
        <tr><td>${S.mystic.icon} Mystics</td><td>Cosmic heroes. Spirit Guide hates Villains; Mirra copies anyone</td></tr>
        <tr><td>${S.cosmic.icon} Cosmic</td><td>Mystics and the Mission. Starbolt blanks every Shadow; Nova shines alone</td></tr>
        <tr><td>${S.shadow.icon} Shadows</td><td>Other Shadows and the Utility Belt. Nightshade works alone; Whisper watches the Plaza</td></tr>
        <tr><td>${S.element.icon} Elementals</td><td>Each other and Bruisers. Stormcaller blanks Gear and Tech; Cataclysm blanks almost everyone else; Magma needs a friend</td></tr>
        <tr><td>${S.sidekick.icon} Sidekicks</td><td>Whoever they follow: Bruisers, Tech — and the Jet Pack and Lucky Cape</td></tr>
        <tr><td>${S.gear.icon} Gear</td><td>Bruisers, Tech and Sidekicks. Skybase clears every penalty; the Hero Signal fits any Mission</td></tr>
        <tr><td>${S.villain.icon} Villains</td><td>Huge power with nasty penalties. The Containment Cell clears them; Brick Malone loves them; the Ringleader springs one from the Plaza</td></tr></table>`;
    } else if (tab === 'mission') {
      body = `${sec(1, 'How the Mission scores')}
        <ol class="rb-flow"><li><b>+${E.MISSION_DONE}</b> if your team has at least one card of <b>each</b> of the Mission’s two suits — or <b>−${E.MISSION_FAIL}</b> if it’s missing either.</li><li><b>+${E.MISSION_FIT}</b> for each card of either Mission suit, so the more of your team fits the Mission, the better.</li><li>A bonus for each card of the Mission’s helpful suit.</li><li>A penalty for each card of the suit that gets in the way.</li></ol>
        <p>Blanked cards don’t count. Mimic and the Hero Signal can count as a Mission suit. Seer Sela doubles the +${E.MISSION_DONE} for having both suits, and Rewind cancels the bad-suit penalty.</p>
        <p class="rb-ex">Alien Invasion needs Cosmic and Tech. A team with two Cosmic, one Tech and one Bruiser scores +${E.MISSION_DONE} + 3 × ${E.MISSION_FIT} + ${E.MISSIONS.invasion.plus.n} = <b>+${E.MISSION_DONE + 3 * E.MISSION_FIT + E.MISSIONS.invasion.plus.n}</b>. The same team without its Tech scores −${E.MISSION_FAIL} + 2 × ${E.MISSION_FIT} + ${E.MISSIONS.invasion.plus.n} = <b>${-E.MISSION_FAIL + 2 * E.MISSION_FIT + E.MISSIONS.invasion.plus.n}</b>.</p>
        ${sec(2, 'All the Missions')}
        <table><tr><th>Mission</th><th>Have both (+${E.MISSION_FIT} each)</th><th>Bonus</th><th>Penalty</th></tr>${E.MISSION_ORDER.map((k) => {
          const M = E.MISSIONS[k];
          return `<tr><td>${M.icon} ${esc(M.name)}</td><td>${M.need.map((x) => S[x].icon + ' ' + S[x].name).join(' + ')}</td><td class="good">+${M.plus.n} per ${S[M.plus.s].icon}</td><td class="bad">−${M.minus.n} per ${S[M.minus.s].icon}</td></tr>`;
        }).join('')}</table>`;
    } else if (tab === 'identity') {
      body = `${sec(1, 'Keeping a secret')}
        <p>At the start, each league is dealt two Secret Identity cards and keeps one, face down. It’s a personal goal: at the end it scores extra on top of your cards and the Mission. Choose with your opening hand <i>and</i> the Mission in mind.</p>
        <p>Nobody else sees your identity until the hands go down. The cards a league recruits from the Plaza are public, though — a league that keeps grabbing Shadows might be The Vigilante, so think twice before sending them another.</p>
        ${sec(2, 'How identities score')}
        <p>They count the cards in your final seven, just like the Mission: blanked cards don’t count, and Mimic and the Hero Signal count as the suit they copy. Seer Sela doesn’t double them.</p>
        ${sec(3, 'All the identities')}
        <table><tr><th>Identity</th><th>Scores</th></tr>${E.IDENTITY_ORDER.map((k) => `<tr><td>${identName(k)}</td><td>${esc(E.identityText(k))}</td></tr>`).join('')}</table>`;
    } else if (tab === 'score') {
      body = `${sec(1, 'When the game ends')}
        <p>The game ends <b>the moment the ${E.PLAZA_END}th card lands in the Plaza</b> — usually when someone draws from the deck while the Plaza has ${E.PLAZA_END - 1}. (Recruiting from the Plaza takes a card out, so it doesn’t fill up.) It also ends if the deck runs out. Nobody gets one last turn.</p>
        <p class="rb-ex">With ${E.PLAZA_END - 1} cards in the Plaza, you decide the timing. Ahead? Draw from the deck and end it. Behind? Recruit from the Plaza and keep the game going.</p>
        ${sec(2, 'Scoring a team, step by step')}
        <ol class="rb-flow"><li>Leagues with Mimic, the Hero Signal or Penny Press choose their suits — no scores are shown until everyone has. Then the Ringleader springs a Villain from the Plaza.</li><li>Clear penalties (The Banisher, Skybase, the Containment Cell, Scout), strike words (Ironclad, Hacklette) and raise shields (Lucky Cape, Firewall).</li><li>Blank cards — all blanking happens at the same time.</li><li>Check “blanked unless…” cards.</li><li>Each card that isn’t blanked scores its power + bonuses − penalties.</li><li>Add the Mission.</li><li>Reveal and add your secret identity.</li></ol>
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
        ['Shield', 'Stops cards being blanked. Their other penalties still count.'],
        ['Left in the Plaza', 'The cards in the Plaza when the game ends. Some cards score (or lose points) for them.'],
        ['Mission', `The face-up goal card. Fit it for big bonuses; miss it and lose ${E.MISSION_FAIL}.`],
        ['Secret identity', 'Your hidden personal goal, chosen from two at the start and revealed at the end.'],
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
      window.BoardSaves.load('heroes', localId).then((g) => {
        if (validSave(g) && g.state.phase !== 'over') startFrom(g);
        else {
          showSetup();
          toast('That game couldn’t be found — it may have finished or been removed.', 'bad');
        }
      });
    } else showSetup();
  } else if (params.get('past')) {
    // A finished game linked from game history: show its board, or the history if it can't be opened.
    $('#app').innerHTML = '<p class="loading-save">Loading that game…</p>';
    openPast(params.get('past')).then(() => G || showHistory());
  } else if (params.has('history')) showHistory();
  else showSetup();
  // Phones: the table (Mission, deck and Plaza), your team and the Daily Hero each get a tab along the bottom, and the
  // game turns to the one your next step needs: the table to draw, your team to send a card.
  if (window.PhoneTabs) {
    PhoneTabs.init({
      root: '.hl',
      accent: '#ffd23f',
      tabs: [
        { id: 'table', icon: '🏙️', label: 'Plaza', show: '.hl section.table-sec' },
        { id: 'team', icon: '🦸', label: 'My team', show: '.hl section.panel.hand' },
        { id: 'log', icon: '📰', label: 'Daily Hero', show: '.hl > section.panel:not(.hand)' },
      ],
      auto: () => (G && G.state && canAct() ? (st().phase === 'discard' ? 'team' : 'table') : null),
      marks: () => ({ team: !!(G && G.state && canAct() && st().phase === 'discard') }),
    });
  }
  window.__hx = { cardHtml, get G() { return G; }, render, E, send: (a) => doAction(a) };
})();
