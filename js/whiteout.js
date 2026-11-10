// Whiteout Station — the game page. The rules live in whiteout-engine.js; this draws the map, hands the device
// between players for their private briefings, plays the computer crew and shows each storm as it lands.
(() => {
  'use strict';
  const E = window.WhiteoutEngine;
  const app = document.querySelector('#app');
  const API_BASE = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
  const SAVE_KEY = 'whiteout.save';
  const read = (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const session = () => read('ahrenslabs_sessionId') || '';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const $ = (sel, r = document) => r.querySelector(sel);

  // ---------------------------------------------------------------- the home screen frame (shared game-home.css)
  const topRow = (extra = '') => `<div class="gh-top"><a class="gh-lobby" href="/ahrens-games" title="Back to the game lobby">← <img class="gh-dice" src="/img/board-games-favicon-48.png?v=10" alt="" width="20" height="20"> Game lobby</a>${extra}</div>`;
  function heroHtml(withTagline) {
    const snow = Array.from({ length: 18 }, (_, i) => `<i style="left:${(i * 37) % 100}%;animation-delay:${(-i * 0.7).toFixed(1)}s;animation-duration:${(6 + (i % 5)).toFixed(1)}s"></i>`).join('');
    return `${topRow()}
      <div class="gh-hero">
        <img src="/img/whiteout/cover.webp" alt="Four researchers trudge toward Whiteout Station as a storm rolls in under the aurora" class="gh-hero-img">
        <div class="gh-shade"></div>
        <div class="hero-snow" aria-hidden="true">${snow}</div>
        <div class="gh-title"><h1 class="display">Whiteout Station</h1>${withTagline ? '<p>The radio is dead and a storm is coming. Each of you knows something the others don’t — and can share it only one signal a round. Fix the radio, verify the research and call in the plane before the final whiteout.</p>' : ''}</div>
      </div>`;
  }

  // ---------------------------------------------------------------- gates: an account, and (for now) the admin only
  function gate(html) {
    app.innerHTML = `<div class="setup gh">${heroHtml(false)}<div class="setup-card gh-card panel ol-gate">${html}</div></div>`;
  }
  if (!session()) {
    const back = encodeURIComponent(location.pathname.replace(/^\//, '') + location.search);
    gate(`<h2>🔒 Sign in to play</h2><a class="btn big" href="/account.html?return=${back}">Log in or sign up</a>`);
    return;
  }
  if ((read('ahrenslabs_email') || '').trim().toLowerCase() !== 'calebahrens2011@gmail.com') {
    gate('<h2>This game is in private testing</h2><a class="btn big" href="/ahrens-games">Back to Ahrens Games</a>');
    return;
  }

  // ---------------------------------------------------------------- art and layout
  const ROLE_COLOR = { weather: '#38a3c9', engineer: '#e0902b', researcher: '#7c5cd6', medic: '#d9475a' };
  const POS = { radio: [27, 20], lab: [10, 35], infirmary: [11, 64], generator: [27, 77], hangar: [40, 47], mast: [58, 22], lake: [58, 72], crash: [86, 25], ridge: [86, 68] };
  const placeImg = (p) => `/img/whiteout/${E.PLACES[p].inside ? 'mod' : 'site'}-${p}.webp`;
  const crewImg = (role) => `/img/whiteout/crew-${role}.webp`;
  const itemImg = (t) => `/img/whiteout/item-${t === 'crew' ? 'sample' : t}.webp`;
  const stormImg = (c) => `/img/whiteout/storm-${c.t}.webp`;
  const SIG = { go: '✅', avoid: '⚠️', check: '❓' };
  const SIG_TEXT = { go: 'Go here', avoid: 'Avoid here', check: 'Check here' };
  const AI_STEP = 650;
  const AI_SIGNAL = 260;

  // ---------------------------------------------------------------- game state
  // G: { mode: 'local' | 'online', state, gid, privy (seat holding the device for a private moment), peek, seen (storms shown) }
  let G = null;
  let timer = null;
  let setup = { mode: 'ai', role: 'engineer', diff: 'standard', crew: E.ROLE_ORDER.map((r, i) => ({ human: i < 2, name: '' })) };
  try {
    const s = JSON.parse(read('whiteout.setup') || 'null');
    if (s && s.crew && s.crew.length === 4) setup = { ...setup, ...s };
  } catch {
    /* defaults */
  }
  if (!setup.crew[0].name) setup.crew[0].name = (read('ahrenslabs_username') || 'You').slice(0, 18);

  const st = () => G.state;
  const humanSeats = () => st().players.map((p, i) => (p.ai ? null : i)).filter((i) => i != null);
  const solo = () => G.mode === 'online' || humanSeats().length <= 1;
  const mySeat = () => (G.mode === 'online' ? G.me : humanSeats()[0]);

  // Whose secrets may be shown right now.
  function visibleRoles() {
    const s = st();
    if (s.phase === 'over') return new Set(E.ROLE_ORDER);
    let seat = null;
    if (G.mode === 'online') seat = G.me;
    else if (solo()) seat = mySeat();
    else if (G.privy != null && G.peek) seat = G.privy;
    if (seat == null) return new Set();
    return new Set(s.crew.filter((c) => c.seat === seat).map((c) => c.role));
  }
  const ownSeat = () => (G.mode === 'online' ? G.me : solo() ? mySeat() : G.privy);

  // ---------------------------------------------------------------- saving (local games)
  function newId() {
    return Array.from({ length: 12 }, () => '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 36)]).join('');
  }
  function save() {
    if (!G || G.mode !== 'local') return;
    const data = { mode: 'local', state: st(), gid: G.gid, seen: G.seen, moved: true };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* storage full: the game still plays */
    }
    const BS = window.BoardSaves;
    if (!BS) return;
    if (st().phase === 'over') {
      if (BS.list('whiteout').some((m) => m.id === G.gid)) BS.remove('whiteout', G.gid);
      return;
    }
    BS.put('whiteout', G.gid, data, { mode: humanSeats().length > 1 ? 'local' : 'ai', level: st().diff, names: st().players.filter((p) => !p.ai).map((p) => p.name), round: st().round, rounds: st().round + st().storms.length - 1, moved: true });
  }
  const validSave = (g) => g && g.state && g.state.v === E.SAVE_V && g.mode === 'local' && g.state.phase !== 'over';

  // ---------------------------------------------------------------- toasts and overlays
  function toast(html, ms = 3200) {
    let box = $('.toasts');
    if (!box) {
      box = document.createElement('div');
      box.className = 'toasts';
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = html;
    box.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }
  function veil(html, onGo, label = 'Continue') {
    closeVeil();
    const v = document.createElement('div');
    v.className = 'veil';
    v.innerHTML = `<div class="card" role="dialog" aria-modal="true">${html}<div class="body" style="padding-top:0"><button class="btn" id="veil-go">${label}</button></div></div>`;
    document.body.appendChild(v);
    const go = v.querySelector('#veil-go');
    go.focus();
    go.onclick = () => {
      closeVeil();
      onGo && onGo();
    };
  }
  function closeVeil() {
    document.querySelectorAll('.veil').forEach((v) => v.remove());
  }
  const veilOpen = () => !!$('.veil, .modal-back');

  // ---------------------------------------------------------------- setup screen
  function showSetup() {
    stop();
    G = null;
    if (Online) Online.disconnect();
    const saved = (() => {
      try {
        const g = JSON.parse(read(SAVE_KEY) || 'null');
        return validSave(g) ? g : null;
      } catch {
        return null;
      }
    })();
    const d = E.DIFF[setup.diff];
    const mode = ['ai', 'local', 'online'].includes(setup.mode) ? setup.mode : 'ai';
    const role = (r) => E.ROLES[r];
    const resume = saved ? `<div class="gh-resume"><div><b>Mission in progress</b><span>Round ${saved.state.round} · ${esc(E.DIFF[saved.state.diff].name)} · radio ${saved.state.installed}/${E.PARTS} · samples ${saved.state.verified}/${saved.state.need}</span></div><button class="btn" id="resume">Continue</button></div>` : '';
    app.innerHTML = `
      <div class="setup gh${mode === 'local' ? ' is-local' : ''}${mode === 'online' ? ' is-online' : ''}">
        ${heroHtml(true)}
        <div class="setup-card gh-card panel">
          ${resume}
          <h2>New mission</h2>
          <div class="gh-modes" id="mode">
            <button type="button" data-v="ai" class="gh-mode${mode === 'ai' ? ' on' : ''}"><span>🤖</span><b>Computer</b><small>You and a computer crew</small></button>
            <button type="button" data-v="local" class="gh-mode${mode === 'local' ? ' on' : ''}"><span>👥</span><b>Players</b><small>2–4 on this device</small></button>
            <button type="button" data-v="online" class="gh-mode${mode === 'online' ? ' on' : ''}"><span>🌐</span><b>Online</b><small>Invite your crew</small></button>
          </div>
          <div class="field ai-only offline-only">
            <span class="label">Your role</span>
            <div class="role-pick" role="radiogroup" aria-label="Your role">${E.ROLE_ORDER.map((r) => `<button type="button" data-role="${r}" class="${setup.role === r ? 'on' : ''}" style="--rc:${ROLE_COLOR[r]}" role="radio" aria-checked="${setup.role === r}"><img src="${crewImg(r)}" alt=""><b>${role(r).icon} ${role(r).name}</b><small>${role(r).secret}</small></button>`).join('')}</div>
            <p class="muted">Computer crewmates play the other three roles — and they only share what they know through signals, too.</p>
          </div>
          <div class="field local-only">
            <span class="label">The crew</span>
            <p class="muted" style="margin-top:0">Each role is a player on this device or a computer. Give two roles the same name to play both.</p>
            <div class="roster">${E.ROLE_ORDER.map((r, i) => {
              const c = setup.crew[i];
              return `<div class="rrow" style="--rc:${ROLE_COLOR[r]}"><img src="${crewImg(r)}" alt=""><div><b>${role(r).icon} ${role(r).name}</b><small>${role(r).secret}</small>${c.human ? `<input data-name="${i}" value="${esc(c.name || '')}" maxlength="18" placeholder="Player name" aria-label="${role(r).name} player name">` : ''}</div>
                <div class="seg" role="radiogroup" aria-label="${role(r).name}"><button type="button" data-who="${i}" data-v="p" class="${c.human ? 'on' : ''}">👤 Player</button><button type="button" data-who="${i}" data-v="c" class="${c.human ? '' : 'on'}">🤖 Computer</button></div></div>`;
            }).join('')}</div>
          </div>
          <div class="field">
            <span class="label">Difficulty${mode === 'online' ? ' <small class="muted">(for new invites)</small>' : ''}</span>
            <div class="seg" id="diff" role="radiogroup" aria-label="Difficulty">${Object.entries(E.DIFF).map(([k, v]) => `<button type="button" data-diff="${k}" class="${setup.diff === k ? 'on' : ''}">${v.name}</button>`).join('')}</div>
            <p class="muted level-hint">${d.storms} storms before the final whiteout · ${d.fuel} fuel to start · verify ${d.need} clean samples.</p>
          </div>
          <div class="online-only" id="online-box"></div>
          <button class="btn big offline-only" id="start">❄️ Start the mission</button>
          <div class="gh-links">
            <button type="button" class="btn ghost sm" id="rules">📜 How to play</button>
            <a class="btn ghost sm" href="/game-history.html">🏆 Game history</a>
          </div>
        </div>
      </div>`;
    app.querySelectorAll('#mode [data-v]').forEach((b) => b.addEventListener('click', () => {
      setup.mode = b.dataset.v;
      keepSetup();
      showSetup();
    }));
    app.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', () => {
      setup.role = b.dataset.role;
      keepSetup();
      showSetup();
    }));
    app.querySelectorAll('[data-who]').forEach((b) => b.addEventListener('click', () => {
      const c = setup.crew[+b.dataset.who];
      c.human = b.dataset.v === 'p';
      if (c.human && !c.name) c.name = `Player ${+b.dataset.who + 1}`;
      keepSetup();
      showSetup();
    }));
    app.querySelectorAll('[data-name]').forEach((inp) => inp.addEventListener('input', () => {
      setup.crew[+inp.dataset.name].name = inp.value.slice(0, 18);
      keepSetup();
    }));
    app.querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => {
      setup.diff = b.dataset.diff;
      keepSetup();
      showSetup();
    }));
    $('#start').onclick = startLocal;
    if (saved) $('#resume').onclick = () => startFrom(saved);
    $('#rules').onclick = showRules;
    if (Online && mode === 'online') Online.showLobby();
  }
  function keepSetup() {
    try {
      localStorage.setItem('whiteout.setup', JSON.stringify(setup));
    } catch {
      /* ignore */
    }
  }

  function startLocal() {
    if (setup.mode !== 'local') {
      const me = (read('ahrenslabs_username') || 'You').slice(0, 18);
      const names = [me];
      const ai = [false];
      const crew = E.ROLE_ORDER.map((r) => {
        if (r === setup.role) return 0;
        names.push(`Computer ${E.ROLES[r].name}`);
        ai.push(true);
        return names.length - 1;
      });
      startFrom({ mode: 'local', state: E.newGame({ diff: setup.diff, names, ai, crew }), gid: newId(), seen: 0 });
      showRoundIntro();
      return;
    }
    if (!setup.crew.some((c) => c.human)) return toast('At least one role needs a player.');
    // One seat per distinct player name; each computer crewmate gets a seat of its own.
    const names = [];
    const ai = [];
    const crew = setup.crew.map((c, i) => {
      if (!c.human) {
        names.push(`Computer ${E.ROLES[E.ROLE_ORDER[i]].name}`);
        ai.push(true);
        return names.length - 1;
      }
      const nm = (c.name || `Player ${i + 1}`).trim() || `Player ${i + 1}`;
      const k = names.findIndex((n, j) => !ai[j] && n.toLowerCase() === nm.toLowerCase());
      if (k >= 0) return k;
      names.push(nm);
      ai.push(false);
      return names.length - 1;
    });
    const state = E.newGame({ diff: setup.diff, names, ai, crew });
    startFrom({ mode: 'local', state, gid: newId(), seen: 0 });
    showRoundIntro();
  }

  function startFrom(g) {
    G = { mode: 'local', state: g.state, gid: g.gid || newId(), seen: g.seen || g.state.past.length, privy: null, peek: false, lastSeat: null };
    history.replaceState(null, '', `${location.pathname}?local=${G.gid}`);
    save();
    render();
    loop();
  }

  // ---------------------------------------------------------------- the main loop
  function stop() {
    clearTimeout(timer);
    timer = null;
  }
  function loop() {
    stop();
    if (!G || G.mode !== 'local') return;
    const s = st();
    if (s.phase === 'over') return showEnd();
    if (veilOpen()) return;
    const waiting = E.waitingOn(s);
    const aiSeat = waiting.find((seat) => s.players[seat].ai);
    if (aiSeat != null) {
      timer = setTimeout(() => {
        if (veilOpen()) return loop();
        act(E.aiChoose(s, aiSeat), aiSeat);
      }, s.phase === 'signal' ? AI_SIGNAL : AI_STEP);
      return;
    }
    // A person decides: hand the device over if that's someone else (only when several people share it).
    const seat = waiting[0];
    if (seat == null) return;
    if (!solo() && G.privy !== seat) {
      const ci = E.deciding(s, seat);
      const c = s.crew[ci];
      const R = E.ROLES[c.role];
      G.privy = null;
      G.peek = false;
      render();
      veil(`<img class="portrait" src="${crewImg(c.role)}" alt="" style="--rc:${ROLE_COLOR[c.role]}"><div class="body"><h2>${esc(s.players[seat].name)}, take the device</h2><p>${s.phase === 'signal' ? `Time to send the ${R.name}’s signal. Keep the screen to yourself while you read your secret.` : `It’s the ${R.name}’s turn.`}</p></div>`, () => {
        G.privy = seat;
        G.peek = s.phase === 'signal';
        render();
      }, `I’m ${esc(s.players[seat].name)}`);
    }
  }

  function act(a, seat) {
    const s = st();
    if (seat == null) seat = E.waitingOn(s).find((x) => !s.players[x].ai);
    const phase = s.phase;
    const round = s.round;
    const mineNow = phase === 'act' && !s.players[seat].ai;
    const what = mineNow ? actLabel(s, s.turn, a) : '';
    try {
      E.apply(s, seat, a);
    } catch (e) {
      toast(esc(e.message || 'That isn’t possible right now.'));
      return;
    }
    // When the decision passes to someone else, close the private moment before anything is drawn.
    const next = E.waitingOn(s).find((x) => !s.players[x].ai);
    if (!solo() && (next !== seat || s.phase !== phase)) {
      G.privy = null;
      G.peek = false;
    }
    if (phase === 'act' && s.phase !== 'act') G.peek = false;
    G.pick = null;
    save();
    render();
    if (mineNow && a.t !== 'end') {
      const more = s.phase === 'act' && E.waitingOn(s)[0] === seat && s.crew[s.turn].seat === seat ? s.acts : 0;
      toast(`✔ ${esc(what)}${more ? ` · ${more} action${more === 1 ? '' : 's'} left` : ' · turn over'}`, 2200);
    }
    if (s.past.length > G.seen) return showStorm(round);
    loop();
  }

  // ---------------------------------------------------------------- storms, rounds and the end
  function showRoundIntro() {
    const s = st();
    const left = s.storms.length;
    veil(`<img class="art" src="/img/whiteout/scene-signal.webp" alt=""><div class="body"><h2>Round ${s.round}</h2><p>${left} storm${left === 1 ? '' : 's'} left before the final whiteout. First, each crewmate sends one signal — pick a place on the map and say <b>✅ go</b>, <b>⚠️ avoid</b> or <b>❓ check</b>. Then everyone takes 3 actions, in order.</p></div>`, () => loop(), 'Begin');
  }
  function showStorm(round) {
    const s = st();
    G.seen = s.past.length;
    save();
    const card = s.past[s.past.length - 1];
    const t = E.stormText(card);
    const hit = s.last && s.last.t === 'storm' ? s.last.hits : [];
    const notes = [];
    if (hit.length) notes.push(`Caught in the storm: ${hit.map((i) => `${E.ROLES[s.crew[i].role].icon} ${E.ROLES[s.crew[i].role].name}`).join(', ')}.`);
    notes.push(s.damaged.generator ? 'The generator is down — no heat tonight.' : s.fuel > 0 || card.t === 'freeze' ? `The generator burned fuel to heat the station (⛽ ${s.fuel} left).` : 'The fuel ran out — no heat tonight.');
    const out = s.crew.filter((c) => !E.PLACES[c.at].inside).length;
    if (out && card.t !== 'calm') notes.push(`${out} crewmate${out > 1 ? 's' : ''} out on the ice got colder.`);
    const frozen = s.crew.filter((c) => c.frozen != null);
    if (frozen.length && s.phase !== 'over') notes.push(`🧊 Frozen: ${frozen.map((c) => E.ROLES[c.role].name).join(', ')} — bring them inside this round!`);
    if (s.plane && s.phase !== 'over') notes.push(s.round >= s.plane.round + E.PLANE_ROUNDS ? '🛩️ The plane is overhead now: get everyone to the Hangar!' : `🛩️ The plane lands at the end of round ${s.plane.round + E.PLANE_ROUNDS}.`);
    veil(`<img class="art" src="${stormImg(card)}" alt=""><div class="body"><p class="muted" style="margin:0">End of round ${round} — the storm hits</p><h2>${esc(t.title)}</h2><p>${esc(t.text)}</p><ul>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`, () => {
      if (s.phase === 'over') return showEnd();
      loop();
    }, s.phase === 'over' ? 'See what happened' : `On to round ${s.round}`);
  }
  function showEnd() {
    stop();
    const s = st();
    const r = s.result;
    save();
    const facts = [`Rounds survived: ${r.round}`, `Radio parts installed: ${s.installed}/${E.PARTS}`, `Samples verified: ${s.verified}/${s.need}`, `Difficulty: ${E.DIFF[s.diff].name}`];
    render();
    veil(`<img class="art" src="/img/whiteout/${r.win ? 'scene-rescue' : 'scene-lost'}.webp" alt=""><div class="body"><h2>${r.win ? '🏆 Rescued!' : '❄️ Mission lost'}</h2><p>${esc(r.reason)}</p><ul>${facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>`, () => {
      if (G && G.mode === 'local') {
        try {
          localStorage.removeItem(SAVE_KEY);
        } catch {
          /* ignore */
        }
        history.replaceState(null, '', location.pathname);
        showSetup();
      } else leaveOnline();
    }, G && G.mode === 'online' ? 'Back to the lobby' : r.win ? 'Play again' : 'Try again');
  }

  // ---------------------------------------------------------------- drawing
  function render() {
    if (!G) return;
    const s = st();
    const vis = visibleRoles();
    const ci = s.phase === 'act' ? s.turn : s.phase === 'signal' ? currentSignaller() : -1;
    app.innerHTML = `
      ${topbar(s)}
      <div class="wo">
      <div class="layout">
        <section class="board" aria-label="Map of Whiteout Station and the ice">${board(s, vis, ci)}</section>
        <div class="side">${turnPanel(s, vis, ci)}${crewPanel(s, vis)}<section class="panel"><h2>Station log</h2><ul class="log">${s.log.slice(-14).reverse().map((l) => `<li>${esc(l.text)}</li>`).join('')}</ul></section></div>
      </div>
      </div>`;
    wire(s, ci);
    if (G.mode === 'online' && G.gmode === 'quick' && G.status === 'active' && Online && Online.tickClock) Online.tickClock();
  }
  function currentSignaller() {
    const s = st();
    const seat = E.waitingOn(s).find((x) => !s.players[x].ai && (G.mode === 'online' ? x === G.me : solo() || x === G.privy));
    return seat == null ? -1 : E.deciding(s, seat);
  }
  function topbar(s) {
    const left = E.stormsLeft(s);
    const total = s.past.length + left;
    const done = s.phase === 'over' ? total : Math.min(total, s.past.length + 1);
    const humans = s.players.filter((p) => !p.ai).length;
    const sub = G.mode === 'online'
      ? `🌐 Online · ${s.players.length} player${s.players.length > 1 ? 's' : ''}${G.gmode === 'quick' ? ' · ⚡' : ''}${G.gmode === 'quick' && G.status === 'active' ? ' <span class="ol-clock" id="ol-clock"></span>' : ''}`
      : humans > 1 ? `👥 ${humans} players on this device` : '🤖 You and a computer crew';
    const broken = E.MODULES.filter((m) => s.damaged[m]);
    const chips = [
      `<span class="chip${s.fuel <= 1 ? ' bad' : ''}" title="Fuel left in the generator; it burns 1 each round">⛽ Fuel ${s.fuel}</span>`,
      `<span class="chip${s.installed >= E.PARTS ? ' good' : ''}" title="Radio parts installed">📻 Radio ${s.installed}/${E.PARTS}</span>`,
      `<span class="chip${s.verified >= s.need ? ' good' : ''}" title="Clean samples verified">🧪 Samples ${s.verified}/${s.need}</span>`,
      s.plane ? `<span class="chip good" title="Everyone must be in the Hangar when it lands">🛩️ Lands end of round ${s.plane.round + E.PLANE_ROUNDS}</span>` : '',
      broken.length ? `<span class="chip bad" title="${E.DAMAGE_LOSS} damaged modules at once and the station is lost">⚠️ ${broken.length}/${E.DAMAGE_LOSS} damaged</span>` : '',
    ];
    const home = G.mode === 'online' ? '🌐<span class="bt"> Game</span>' : '❄️<span class="bt"> New mission</span>';
    return `<header class="topbar">
        <div class="brand">
          <img src="/img/whiteout-icon-180.png?v=1" alt="" class="brand-logo" width="46" height="46">
          <div><h1>Whiteout Station</h1><small>${sub} · ${esc(E.DIFF[s.diff].name)}</small></div>
        </div>
        <div class="top-mid">
          <div class="day-meter" title="When the storm deck runs out, the final whiteout ends the mission"><span class="dm-label">⛈️ Storm <b>${done}</b> of ${total}</span><span class="dm-bar"><i style="width:${Math.round((done / Math.max(1, total)) * 100)}%"></i></span></div>
          <div class="top-chips">${chips.join('')}</div>
        </div>
        <div class="top-actions">
          ${G.mode === 'online' && G.status === 'active' ? '<button type="button" class="btn ghost sm" id="leave-online" aria-label="Leave the mission">🏳️<span class="bt"> Leave</span></button>' : ''}
          <button type="button" class="btn ghost sm" id="rules-btn" aria-label="Rules">📜<span class="bt"> Rules</span></button>
          <button type="button" class="btn ghost sm" id="new-mission" aria-label="${G.mode === 'online' ? 'Online games' : 'New mission'}" title="${G.mode === 'online' ? 'Back to your online games' : 'Start a new mission (this one stays saved under Your games)'}">${home}</button>
          <a class="btn ghost sm" href="/ahrens-games/settings" title="Ahrens Games settings" aria-label="Settings">⚙️<span class="bt"> Settings</span></a>
          <a class="btn ghost sm" href="/ahrens-games" title="Back to the game lobby" aria-label="Game lobby"><img class="gh-dice" src="/img/board-games-favicon-48.png?v=10" alt=""><span class="bt"> Lobby</span></a>
        </div>
      </header>`;
  }

  function board(s, vis, ci) {
    const me = ci >= 0 ? s.crew[ci] : null;
    const myTurn = s.phase === 'act' && ci >= 0 && canControl(ci);
    const moves = myTurn ? E.actionsFor(s, ci).filter((a) => a.t === 'move').map((a) => a.to) : [];
    const signalling = s.phase === 'signal' && ci >= 0 && canControl(ci);
    const y = (p) => POS[p][1] * 0.5625;
    const lines = E.EDGES.map(([a, b]) => {
      const inside = E.PLACES[a].inside && E.PLACES[b].inside;
      const cut = E.cut(s, a) || E.cut(s, b);
      const d = `M${POS[a][0]} ${y(a)} L${POS[b][0]} ${y(b)}`;
      return inside ? `<path class="hall" d="${d}"/><path class="hall-in" d="${d}"/>` : `<path class="trail${cut ? ' cut' : ''}" d="${d}"/>`;
    }).join('');
    const nodes = Object.keys(E.PLACES).map((p) => {
      const P = E.PLACES[p];
      const site = s.sites[p];
      const tags = [];
      if (site) {
        if (site.searched) tags.push('<span class="tag">🔎 searched</span>');
        else if (vis.has('engineer') && site.part) tags.push('<span class="tag secret">🔧 radio part</span>');
        const left = site.samples.filter((x) => !x.taken);
        if (left.length) {
          const marks = left.map((x) => (x.clean == null ? '·' : vis.has('researcher') ? (x.clean ? '✅' : '❌') : '·')).join('');
          tags.push(`<span class="tag${vis.has('researcher') ? ' secret' : ''}">🧪 ${vis.has('researcher') ? marks : `×${left.length}`}</span>`);
        }
        if (site.fuel) tags.push(`<span class="tag">🛢️ ×${site.fuel}</span>`);
      }
      s.crew.forEach((c, i) => {
        const g = s.signals[i];
        if (g && !g.none && g.at === p && (s.phase !== 'signal' || G.mode === 'online' || visibleRoles().has(c.role))) {
          tags.push(`<span class="tag sig" style="--rc:${ROLE_COLOR[c.role]}" title="${E.ROLES[c.role].name}: ${SIG_TEXT[g.kind]}">${E.ROLES[c.role].icon}${SIG[g.kind]}</span>`);
        }
      });
      const ground = (s.ground[p] || []).map((it) => `<img src="${itemImg(it.t)}" alt="${esc(E.itemName(it))}">`).join('');
      const cls = ['node', s.damaged[p] ? 'dmg' : '', E.cut(s, p) ? 'fog' : '', moves.includes(p) ? 'go' : '', signalling ? 'pick' : '', G.pick === p ? 'chosen' : ''].filter(Boolean).join(' ');
      const clickable = moves.includes(p) || signalling;
      return `<${clickable ? 'button type="button"' : 'div'} class="${cls}" data-place="${p}" style="left:${POS[p][0]}%;top:${POS[p][1]}%;${P.inside ? '' : 'width:15%;'}" ${clickable ? `aria-label="${moves.includes(p) ? 'Walk to' : 'Signal at'} ${P.name}"` : ''}>
        <img class="art" src="${placeImg(p)}" alt="" draggable="false"><span class="lbl">${P.icon} ${P.name}</span>
        ${tags.length ? `<span class="tags">${tags.join('')}</span>` : ''}${ground ? `<span class="ground">${ground}</span>` : ''}</${clickable ? 'button' : 'div'}>`;
    }).join('');
    // Crew tokens fan out around the place they stand.
    const at = {};
    const tokens = s.crew.map((c, i) => {
      if (c.carriedBy != null) return '';
      const list = (at[c.at] = at[c.at] || []);
      const k = list.push(i) - 1;
      const n = s.crew.filter((o) => o.at === c.at && o.carriedBy == null).length;
      const off = (k - (n - 1) / 2) * 5;
      const x = POS[c.at][0] + off;
      const yy = POS[c.at][1] + 15;
      const exact = c.warmth != null && (vis.has('medic') || seatOf(i) === ownSeat() || s.phase === 'over');
      const warmth = exact ? `<span class="pips">${Array.from({ length: E.MAX_WARMTH }, (_, j) => `<i class="${j < c.warmth ? '' : 'off'}"></i>`).join('')}</span>` : `<span class="band ${c.band || E.band(c.warmth)}">${c.band || E.band(c.warmth)}</span>`;
      const carry = c.carry ? `<img class="carry" src="${c.carry.t === 'crew' ? crewImg(s.crew[c.carry.i].role) : itemImg(c.carry.t)}" alt="">` : '';
      return `<div class="token${i === ci && s.phase === 'act' ? ' now' : ''}${c.frozen != null ? ' frozen' : ''}" style="--rc:${ROLE_COLOR[c.role]};left:${x}%;top:${yy}%" title="${E.ROLES[c.role].name}"><img src="${crewImg(c.role)}" alt="${E.ROLES[c.role].name}">${carry}${warmth}</div>`;
    }).join('');
    return `<div class="compound"></div><svg class="paths" viewBox="0 0 100 56.25" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${nodes}${tokens}`;
  }
  const seatOf = (ci) => st().crew[ci].seat;
  function canControl(ci) {
    const s = st();
    const seat = s.crew[ci].seat;
    if (G.mode === 'online') return seat === G.me;
    return !s.players[seat].ai && (solo() || G.privy === seat);
  }

  function turnPanel(s, vis, ci) {
    if (s.phase === 'over') return `<section class="panel"><h2>${s.result.win ? '🏆 Rescued!' : '❄️ Mission lost'}</h2><p>${esc(s.result.reason)}</p><div class="start-row"><button class="btn" id="again">${G.mode === 'local' ? 'New mission' : 'Back to the lobby'}</button></div></section>`;
    const secret = secretBox(s, vis);
    if (s.phase === 'signal') {
      if (ci < 0) {
        const wait = E.waitingOn(s).map((seat) => esc(s.players[seat].name));
        return `<section class="panel"><h2>📡 Signals</h2><p class="muted">Waiting for ${wait.join(', ') || 'the crew'} to send ${wait.length === 1 ? 'a signal' : 'signals'}…</p>${secret}</section>`;
      }
      const c = s.crew[ci];
      const R = E.ROLES[c.role];
      const pick = G.pick;
      return `<section class="panel turn" style="--rc:${ROLE_COLOR[c.role]}">
        <div class="who"><img src="${crewImg(c.role)}" alt=""><div><b>${R.icon} ${R.name}</b><div class="muted">${esc(s.players[c.seat].name)} · send one signal</div></div></div>
        <div class="yourturn">📡 Send your signal</div>
        <p class="hint" style="margin-top:0.2rem">Share what your secret tells you — but only by pointing at one place. No other talking about it!</p>
        ${secret}
        ${suggestBox(s, ci)}
        <div class="sigpick">
          <p class="step${pick ? ' done' : ''}"><b>1</b> ${pick ? `Place: <b>${E.PLACES[pick].icon} ${E.PLACES[pick].name}</b> <span class="muted">(tap another to change)</span>` : 'Tap a place on the map'}</p>
          <p class="step"><b>2</b> Choose what it means</p>
          <div class="seg">${Object.keys(SIG).map((k) => `<button type="button" data-sig="${k}" ${pick ? '' : 'disabled'}>${SIG[k]} ${SIG_TEXT[k]}</button>`).join('')}</div>
          <button type="button" class="act end" data-sig="none">🤐 Send no signal this round</button></div></section>`;
    }
    const c = s.crew[ci];
    const R = E.ROLES[c.role];
    const mine = canControl(ci);
    const left = s.acts;
    const dots = `<span class="acts-left" aria-label="${left} action${left === 1 ? '' : 's'} left">${Array.from({ length: E.ACTIONS }, (_, j) => `<i class="${j < left ? '' : 'off'}"></i>`).join('')}</span>`;
    const head = `<div class="who"><img src="${crewImg(c.role)}" alt=""><div><b>${R.icon} ${R.name}</b>${dots}<div class="muted">${s.players[c.seat].ai ? '🤖 Computer crewmate' : esc(s.players[c.seat].name)}${c.carry ? ` · carrying ${E.itemName(c.carry)}` : ''}</div></div></div>`;
    if (!mine) return `<section class="panel turn" style="--rc:${ROLE_COLOR[c.role]}">${head}<p class="hint">${s.players[c.seat].ai ? 'The computer crewmate is working…' : 'Waiting for their move…'}</p>${G.mode === 'online' ? secret : ''}</section>`;
    const all = E.actionsFor(s, ci);
    const here = all.filter((a) => a.t !== 'move' && a.t !== 'end');
    const walks = all.filter((a) => a.t === 'move');
    const mc = E.cost(s, ci, 'move');
    const peekBtn = !solo() && G.mode === 'local' ? `<button type="button" class="btn sm ghost" id="peek">${G.peek ? '🙈 Hide my secret' : '🔒 Show my secret'}</button>` : '';
    const P = E.PLACES[c.at];
    return `<section class="panel turn" style="--rc:${ROLE_COLOR[c.role]}">${head}
      <div class="yourturn">🎯 Your turn — ${left} action${left === 1 ? '' : 's'} left</div>
      <p class="hint" style="margin-top:0.2rem">Each action is one step on the map <i>or</i> one thing where you stand. Use up to ${E.ACTIONS}, then end your turn.</p>
      ${peekBtn}${secret}
      ${suggestBox(s, ci)}
      <h3 class="act-h">📍 At the ${esc(P.name)}</h3>
      <div class="actions">${here.length ? here.map((a) => actionButton(s, ci, a)).join('') : `<p class="hint" style="margin:0">Nothing to do here${c.carry ? ` with ${E.itemName(c.carry)}` : ''} — walk somewhere.</p>`}</div>
      <h3 class="act-h">🦶 Walk <small>${mc} action${mc > 1 ? 's' : ''} a step — or tap a glowing place on the map</small></h3>
      <div class="actions">${walks.length ? walks.map((a) => walkButton(s, ci, a)).join('') : '<p class="hint" style="margin:0">You can’t walk anywhere right now.</p>'}</div>
      <div class="actions" style="margin-top:0.8rem"><button type="button" class="act end" data-a='{"t":"end"}'>⏭️ End turn${left ? ` <small>skips ${left} action${left === 1 ? '' : 's'}</small>` : ''}</button></div></section>`;
  }
  // A walk button with what's known about the place.
  function walkButton(s, ci, a) {
    const p = a.to;
    const P = E.PLACES[p];
    const site = s.sites[p];
    const vis = visibleRoles();
    const notes = [];
    if (!P.inside) notes.push('out on the ice');
    if (site) {
      if (vis.has('engineer') && site.part) notes.push('🔧 radio part');
      else if (!site.searched) notes.push('not searched');
      const left = site.samples.filter((x) => !x.taken).length;
      if (left) notes.push(`🧪×${left}`);
      if (site.fuel) notes.push(`🛢️×${site.fuel}`);
    }
    if (s.damaged[p]) notes.push('⚠️ damaged');
    if ((s.ground[p] || []).length) notes.push(`${s.ground[p].length} item${s.ground[p].length > 1 ? 's' : ''} on the ground`);
    return `<button type="button" class="act walk" data-a='${esc(JSON.stringify(a))}'><span>${P.icon} Walk to ${esc(P.name)}${notes.length ? `<em>${notes.join(' · ')}</em>` : ''}</span></button>`;
  }
  // The computer crew's advice for this crewmate, using only what its role knows (and never shown while that
  // role's secret is hidden on a shared device).
  function suggestion(s, ci) {
    if (!visibleRoles().has(s.crew[ci].role)) return null;
    try {
      const view = G.mode === 'online' ? { ...JSON.parse(JSON.stringify(s)), storms: (s.forecast || []).slice().reverse() } : s;
      const a = E.aiChoose(view, s.crew[ci].seat);
      if (!a) return null;
      if (s.phase === 'act' && !E.actionsFor(s, ci).some((o) => JSON.stringify(o) === JSON.stringify(a))) return null;
      return a;
    } catch {
      return null;
    }
  }
  function suggestBox(s, ci) {
    const a = suggestion(s, ci);
    if (!a) return '';
    const text = a.t === 'signal' ? (a.none ? '🤐 Send no signal' : `${SIG[a.kind]} ${SIG_TEXT[a.kind]} at ${E.PLACES[a.at].name}`) : actLabel(s, ci, a);
    return `<div class="suggest"><span>💡 <b>Suggested:</b> ${text}</span><button type="button" class="btn sm" id="suggest-go" data-sa='${esc(JSON.stringify(a))}'>Do it</button></div>`;
  }
  // Plain words for an action (for buttons, suggestions and confirmations).
  function actLabel(s, ci, a) {
    const c = s.crew[ci];
    const rn = (i) => E.ROLES[s.crew[i].role].name;
    switch (a.t) {
      case 'end': return '⏭️ End your turn';
      case 'move': return `${E.PLACES[a.to].icon} Walk to ${E.PLACES[a.to].name}`;
      case 'search': return '🔎 Search the site for a radio part';
      case 'take':
        if (a.what === 'sample') return `🧪 Take sample ${'AB'[s.sites[c.at].samples.findIndex((x) => x.id === a.id)]}`;
        if (a.what === 'fuel') return '🛢️ Pick up a fuel drum';
        if (a.what === 'crew') return `🫴 Carry the frozen ${rn(a.i)}`;
        return `🤲 Pick up ${E.itemName(s.ground[c.at][a.k])}`;
      case 'drop': return `📥 Put down ${E.itemName(c.carry)}`;
      case 'install': return '📻 Install the radio part';
      case 'analyze': return '🔬 Analyze the sample';
      case 'refuel': return '⛽ Feed the generator';
      case 'repair': return `🔩 Repair the ${E.PLACES[c.at].name}`;
      case 'warm': return a.i === ci ? '♨️ Warm up' : `♨️ Warm the ${rn(a.i)}`;
      case 'treat': return a.i === ci ? '🩺 Treat yourself' : `🩺 Treat the ${rn(a.i)}`;
      case 'reroute': return '🌦️ Reroute the next storm';
      case 'call': return '🛩️ Call the rescue plane';
      default: return '';
    }
  }
  function actionButton(s, ci, a) {
    const c = s.crew[ci];
    const cost = (k) => E.cost(s, ci, k);
    const n = (x) => `<small>${x} action${x > 1 ? 's' : ''}</small>`;
    const rn = (i) => E.ROLES[s.crew[i].role].name;
    const data = `data-a='${esc(JSON.stringify(a))}'`;
    const B = (label, x, key) => `<button type="button" class="act${key ? ' key' : ''}${a.t === 'end' ? ' end' : ''}" ${data}>${label}${x ? n(x) : ''}</button>`;
    switch (a.t) {
      case 'end': return '';
      case 'search': return B('🔎 Search the site for a radio part', 1, true);
      case 'take':
        if (a.what === 'sample') {
          const k = s.sites[c.at].samples.findIndex((x) => x.id === a.id);
          const smp = s.sites[c.at].samples[k];
          const tag = visibleRoles().has('researcher') && smp.clean != null ? (smp.clean ? ' ✅ clean' : ' ❌ contaminated') : '';
          return B(`🧪 Take sample ${'AB'[k]}${tag}`, 1);
        }
        if (a.what === 'fuel') return B('🛢️ Pick up a fuel drum', 1);
        if (a.what === 'crew') return B(`🫴 Carry the frozen ${rn(a.i)}`, 1, true);
        return B(`🤲 Pick up ${E.itemName(s.ground[c.at][a.k])}`, 1);
      case 'drop': return B(`📥 Put down ${E.itemName(c.carry)}`, 1);
      case 'install': return B('📻 Install the radio part', cost('install'), true);
      case 'analyze': return B('🔬 Analyze the sample', cost('analyze'), true);
      case 'refuel': return B('⛽ Feed the generator (+2 fuel)', 1, true);
      case 'repair': return B(`🔩 Repair the ${E.PLACES[c.at].name}`, cost('repair'), true);
      case 'warm': {
        const gain = c.at === 'infirmary' && !s.damaged.infirmary ? 2 : 1;
        return B(a.i === ci ? `♨️ Warm up (+${gain})` : `♨️ Warm the ${rn(a.i)} (+${gain})`, 1, s.crew[a.i].frozen != null);
      }
      case 'treat': return B(a.i === ci ? '🩺 Treat yourself (+2)' : `🩺 Treat the ${rn(a.i)} (+2)`, 1, s.crew[a.i].frozen != null);
      case 'reroute': return B('🌦️ Reroute the next storm', 1, true);
      case 'call': return B('🛩️ Call the rescue plane!', 1, true);
      default: return '';
    }
  }
  function secretBox(s, vis) {
    if (!vis.size || s.phase === 'over') return '';
    const parts = [];
    if (vis.has('weather')) {
      const f = s.forecast || (s.storms ? s.storms.slice(-2).reverse() : []);
      parts.push(`<b>🌦️ Next storms</b><div class="forecast">${f.map((c, k) => {
        const t = E.stormText(c);
        return `<figure><img src="${stormImg(c)}" alt=""><figcaption><b>${k ? 'After that' : 'Next'}:</b> ${esc(t.title)}</figcaption></figure>`;
      }).join('') || '<p class="muted">No storms left.</p>'}</div>`);
    }
    if (vis.has('engineer')) {
      const parts2 = E.SITES.filter((p) => s.sites[p].part).map((p) => E.PLACES[p].name);
      parts.push(`<b>🧰 Radio parts are at:</b> ${parts2.length ? parts2.join(', ') : 'none left out there'} <span class="muted">(marked 🔧 on the map)</span>`);
    }
    if (vis.has('researcher')) parts.push('<b>🔬 Clean samples</b> are marked ✅ on the map (❌ = contaminated).');
    if (vis.has('medic')) parts.push('<b>🩺 You can see everyone’s exact warmth</b> on the map.');
    return `<div class="secret">${parts.map((p) => `<div style="margin:0.25rem 0">${p}</div>`).join('')}</div>`;
  }
  function crewPanel(s, vis) {
    return `<section class="panel"><h2>Crew</h2><div class="crewlist">${s.crew.map((c, i) => {
      const exact = c.warmth != null && (vis.has('medic') || seatOf(i) === ownSeat() || s.phase === 'over');
      const w = c.frozen != null ? '🧊 frozen' : exact ? `🔥 ${c.warmth}/${E.MAX_WARMTH}` : c.band || E.band(c.warmth);
      return `<div class="crow" style="--rc:${ROLE_COLOR[c.role]}"><img src="${crewImg(c.role)}" alt=""><span><b>${E.ROLES[c.role].name}</b> · ${E.PLACES[c.at].name}${c.carry ? ` · 🎒 ${E.itemName(c.carry)}` : ''}<br><span class="muted">${s.players[c.seat].ai ? '🤖 Computer' : `👤 ${esc(s.players[c.seat].name)}`}</span></span><span class="w">${w}</span></div>`;
    }).join('')}</div></section>`;
  }

  // ---------------------------------------------------------------- input
  function wire(s, ci) {
    const rb = $('#rules-btn');
    if (rb) rb.onclick = showRules;
    const nm = $('#new-mission');
    if (nm) nm.onclick = () => {
      if (G.mode === 'online') {
        setup.mode = 'online';
        return leaveOnline();
      }
      history.replaceState(null, '', location.pathname);
      showSetup();
    };
    const lv = $('#leave-online');
    if (lv) lv.onclick = () => {
      if (confirm('Leave this mission? A computer crewmate takes over your roles, and the rest of the crew plays on.') && Online) Online.resign();
    };
    const again = $('#again');
    if (again) again.onclick = () => showEnd();
    app.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => send(JSON.parse(b.dataset.a))));
    app.querySelectorAll('.node.go').forEach((n) => n.addEventListener('click', () => send({ t: 'move', to: n.dataset.place })));
    if (s.phase === 'signal' && ci >= 0 && canControl(ci)) {
      app.querySelectorAll('.node.pick').forEach((n) => n.addEventListener('click', () => {
        G.pick = n.dataset.place;
        render();
      }));
      app.querySelectorAll('[data-sig]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.sig;
        if (k === 'none') return send({ t: 'signal', ci, none: true });
        if (!G.pick) return;
        send({ t: 'signal', ci, at: G.pick, kind: k });
      }));
    }
    const sg = $('#suggest-go');
    if (sg) sg.onclick = () => send(JSON.parse(sg.dataset.sa));
    const peek = $('#peek');
    if (peek) peek.onclick = () => {
      G.peek = !G.peek;
      render();
    };
  }
  function send(a) {
    if (!G) return;
    if (G.mode === 'online') return Online && Online.send(a);
    act(a);
  }

  // ---------------------------------------------------------------- rules: the same chaptered rulebook as the other games
  const RULE_CHAPTERS = [
    ['overview', 'Overview'],
    ['setup', 'Setting up'],
    ['round', 'A round'],
    ['signals', 'Signals'],
    ['actions', 'Actions'],
    ['crew', 'The crew'],
    ['map', 'The map'],
    ['storms', 'Storms'],
    ['warmth', 'Warmth & freezing'],
    ['end', 'Winning & losing'],
    ['terms', 'Quick reference'],
  ];
  let rulesTab = 'overview';
  function rulesBody(tab) {
    const n = RULE_CHAPTERS.findIndex((c) => c[0] === tab) + 1;
    const sec = (i, title) => `<h4 class="rb-sec"><span>${n}.${i}</span> ${title}</h4>`;
    const head = `<h3 class="rb-ch"><small>Chapter ${n}</small>${RULE_CHAPTERS[n - 1][1]}</h3>`;
    const P = E.PLACES;
    const R = E.ROLES;
    let body = '';
    if (tab === 'overview') {
      body = `<p>Whiteout Station is a <b>cooperative</b> game for 1–4 players: the whole crew wins or loses together, against the storm. A game takes about 30–45 minutes.</p>
        <div class="rb-crew">${E.ROLE_ORDER.map((r) => `<figure style="--rc:${ROLE_COLOR[r]}"><img src="${crewImg(r)}" alt=""><figcaption>${R[r].icon} ${R[r].name}</figcaption></figure>`).join('')}</div>
        ${sec(1, 'The story')}
        <p>Your research crew is stranded at an Arctic station. The radio is dead, its parts are scattered across the ice, and a storm is building. You need to get the radio working, prove your research was worth it, and get everyone onto the rescue plane before the final whiteout.</p>
        ${sec(2, 'The twist')}
        <p>Each crewmate holds a <b>secret</b> the others can’t see — where the radio parts are, which samples are clean, which storms are coming, or how cold everyone really is. You can’t just say it: the only way to share what you know is <b>one signal a round</b>, pointed at a place on the map.</p>
        ${sec(3, 'The mission')}
        <ol class="rb-flow"><li>Find the <b>${E.PARTS} radio parts</b> out on the ice and install them in the Radio Room.</li><li>Collect samples and <b>verify enough clean ones</b> in the Lab.</li><li><b>Call the plane</b> and have the whole crew in the Hangar when it lands.</li></ol>
        <p class="rb-ex">Do it before the storm deck runs out — and keep everyone warm, the generator fuelled and the station standing along the way.</p>`;
    } else if (tab === 'setup') {
      body = `${sec(1, 'The crew')}
        <p>There are always four roles: ${E.ROLE_ORDER.map((r) => `${R[r].icon} ${R[r].name}`).join(', ')}. Each is played by a person or a computer crewmate. Playing alone, you take one role and computers take the rest; on one device or online, roles can be shared out however you like (one person can play two).</p>
        ${sec(2, 'The board')}
        <ul class="rb-flow"><li>Everyone starts in the <b>Hangar</b> with ${E.MAX_WARMTH} warmth.</li><li>${E.PARTS} of the 4 field sites hide a radio part (the Engineer knows which).</li><li>Each field site has 2 samples; some are clean and some contaminated (the Researcher knows which).</li><li>Fuel drums wait at the Crash Site (3) and Glacier Lake (2).</li><li>The storm deck is shuffled with milder storms on top and harsher ones underneath.</li></ul>
        ${sec(3, 'Difficulty')}
        <table><tr><th></th>${Object.values(E.DIFF).map((d) => `<th>${d.name}</th>`).join('')}</tr>
          <tr><td>Storms in the deck</td>${Object.values(E.DIFF).map((d) => `<td>${d.storms}</td>`).join('')}</tr>
          <tr><td>Starting fuel</td>${Object.values(E.DIFF).map((d) => `<td>${d.fuel}</td>`).join('')}</tr>
          <tr><td>Clean samples (of 8)</td>${Object.values(E.DIFF).map((d) => `<td>${d.clean}</td>`).join('')}</tr>
          <tr><td>Samples to verify</td>${Object.values(E.DIFF).map((d) => `<td>${d.need}</td>`).join('')}</tr></table>`;
    } else if (tab === 'round') {
      body = `<p>Each round has three steps.</p>
        ${sec(1, 'Signals')}
        <p>Every crewmate secretly picks one signal (or none). All the signals are revealed together. See chapter 4.</p>
        ${sec(2, 'Actions')}
        <p>In role order — ${E.ROLE_ORDER.map((r) => R[r].name).join(', ')} — each crewmate takes up to <b>${E.ACTIONS} actions</b>, then ends their turn. You see what everyone before you did. A frozen crewmate skips their turn.</p>
        ${sec(3, 'The storm')}
        <ol class="rb-flow"><li>Reveal the next storm card and apply it (chapter 8).</li><li>The generator burns 1 fuel (2 in a deep freeze). If it has fuel and isn’t damaged, the station is heated: everyone inside warms up by 1. If not, everyone inside loses 1.</li><li>Everyone out on the ice loses 1 warmth (not in calm skies).</li><li>Check whether the mission is won or lost (chapter 10).</li></ol>`;
    } else if (tab === 'signals') {
      body = `${sec(1, 'Sending a signal')}
        <p>Pick a place on the map and say one of:</p>
        <dl class="rb-terms"><dt>✅ Go here</dt><dd>Something good is here — or someone should come.</dd><dt>⚠️ Avoid here</dt><dd>Danger: stay away.</dd><dt>❓ Check here</dt><dd>Worth a look — something needs attention.</dd><dt>🤐 No signal</dt><dd>Say nothing this round.</dd></dl>
        <p>Every signal shows the sender’s role, and stays on the map for the rest of the round.</p>
        ${sec(2, 'The one rule')}
        <p><b>No other talking about your secret.</b> You can talk about plans and what’s on the board — but not what only you can see. On one device, keep the screen to yourself when you’re told to.</p>
        ${sec(3, 'Reading signals')}
        <p>A signal means different things from different roles. That’s the puzzle.</p>
        <p class="rb-ex">The Engineer signals ✅ at the Ice Ridge: there’s probably a radio part there. The Researcher signals ✅ at Glacier Lake: a clean sample, most likely. The Meteorologist signals ⚠️ at the Antenna Mast: a storm is about to hit that part of the ice.</p>`;
    } else if (tab === 'actions') {
      const cost = (r, k) => (r ? `<b>1</b> for the ${R[r].name}, <b>2</b> for everyone else` : '<b>1</b>');
      body = `<p>Each action costs 1 unless it says otherwise. You can stop early. You can carry <b>one</b> thing at a time.</p>
        <dl class="rb-terms">
          <dt>🦶 Walk</dt><dd>Move one step along a path. ${cost()} — or 2 while carrying a frozen crewmate (the Medic still pays 1).</dd>
          <dt>🔎 Search</dt><dd>At a field site you haven’t searched: if a radio part is there, you find it and pick it up (or leave it on the ground if your hands are full).</dd>
          <dt>🧪 Take a sample</dt><dd>Pick up one of the site’s samples.</dd>
          <dt>🛢️ Take fuel</dt><dd>Pick up a fuel drum.</dd>
          <dt>🤲 Pick up / 📥 Put down</dt><dd>Pick up something lying here, or put down what you carry.</dd>
          <dt>🫴 Carry a crewmate</dt><dd>Lift a frozen crewmate in the same place; they move with you.</dd>
          <dt>📻 Install</dt><dd>In the Radio Room, install the part you carry. ${cost('engineer')}.</dd>
          <dt>🔬 Analyze</dt><dd>In the Lab, analyze the sample you carry. A clean one counts toward the mission; a contaminated one is wasted. ${cost('researcher')}.</dd>
          <dt>⛽ Feed the generator</dt><dd>In the Generator room, burn the fuel drum you carry: +2 fuel.</dd>
          <dt>🔩 Repair</dt><dd>Fix the damaged module you’re in. ${cost('engineer')}.</dd>
          <dt>♨️ Warm up</dt><dd>Inside the station: +1 warmth to you or someone with you (+2 in the Infirmary).</dd>
          <dt>🩺 Treat</dt><dd>Medic only, anywhere: +2 warmth to anyone in the same place.</dd>
          <dt>🌦️ Reroute</dt><dd>Meteorologist only, in the Radio Room, once a round: send the next storm to the bottom of the deck.</dd>
          <dt>🛩️ Call the plane</dt><dd>In the Radio Room, once the radio works and the research is verified.</dd>
        </dl>`;
    } else if (tab === 'crew') {
      body = E.ROLE_ORDER.map((r, i) => `${sec(i + 1, `${R[r].icon} ${R[r].name}`)}
        <div class="rb-role" style="--rc:${ROLE_COLOR[r]}"><img src="${crewImg(r)}" alt=""><dl class="rb-terms"><dt>Secret</dt><dd>${R[r].secret}</dd><dt>Power</dt><dd>${R[r].power}</dd></dl></div>`).join('');
    } else if (tab === 'map') {
      const place = (p, txt) => `<div class="rb-place"><img src="${placeImg(p)}" alt=""><div><b>${P[p].icon} ${P[p].name}</b><p>${txt}</p></div></div>`;
      body = `${sec(1, 'The station')}
        <p>Five modules joined in a ring. Moving between neighbouring modules is one step. Inside, the generator keeps you warm.</p>
        ${place('hangar', 'Where everyone starts — and the airlock onto the ice. The plane lands here, so it must not be damaged at the end.')}
        ${place('radio', 'Install radio parts, call the plane, and (Meteorologist) reroute storms.')}
        ${place('lab', 'Analyze samples.')}
        ${place('infirmary', 'Warming up here gives +2 instead of +1.')}
        ${place('generator', 'Feed it fuel drums. Damaged or empty, the station goes cold.')}
        ${sec(2, 'The ice')}
        <p>Four field sites, linked by icy paths. Out here you get colder every round.</p>
        ${place('mast', 'One step from the Hangar.')}
        ${place('lake', 'One step from the Hangar. Two fuel drums.')}
        ${place('crash', 'Two steps out, past the Antenna Mast. Three fuel drums.')}
        ${place('ridge', 'Two steps out, past Glacier Lake.')}
        <p class="rb-ex">Each site has 2 samples, and 3 of the 4 hide a radio part. Searched sites are marked on the map.</p>`;
    } else if (tab === 'storms') {
      const card = (t, title, txt) => `<div class="rb-place rb-storm"><img src="/img/whiteout/storm-${t}.webp" alt=""><div><b>${title}</b><p>${txt}</p></div></div>`;
      body = `<p>At the end of every round the next storm card is revealed. The deck starts gentle and gets rougher; when it’s empty, the final whiteout ends the game.</p>
        ${card('blizzard', '🌨️ Blizzard', 'Over part of the ice (east, west, near, far — or late in the deck, all of it). Anyone there loses 2 warmth.')}
        ${card('whiteout', '🌫️ Whiteout', 'A field site is cut off: nobody can move into or out of it during the next round.')}
        ${card('ice', '🧊 Ice storm', 'A station module is damaged. It can’t be used until someone repairs it. Three damaged at once and the station is lost.')}
        ${card('freeze', '🥶 Deep freeze', 'The generator burns an extra fuel tonight.')}
        ${card('calm', '🌅 Calm skies', 'The wind drops: nobody out on the ice gets colder this round.')}
        <p class="rb-ex">Only the Meteorologist sees what’s coming — the next two cards — and can push the next one to the bottom of the deck from the Radio Room.</p>`;
    } else if (tab === 'warmth') {
      body = `${sec(1, 'Warmth')}
        <p>Everyone has up to ${E.MAX_WARMTH} warmth. You can always see your own exactly; everyone else shows as <b>warm</b>, <b>cold</b> or <b>freezing</b> — unless you’re the Medic, who sees it all.</p>
        <ul class="rb-flow"><li>Out on the ice: −1 each round (not in calm skies), and −2 more in a blizzard.</li><li>Inside a heated station: +1 each round.</li><li>Warm up (+1, or +2 in the Infirmary) and the Medic’s treatment (+2) help too.</li></ul>
        ${sec(2, 'Freezing')}
        <p>At 0 warmth you <b>freeze</b> where you stand and drop what you’re carrying. A frozen crewmate can’t act or signal.</p>
        <p>Someone must bring them back: carry them, warm them up or treat them. <b>If they’re still frozen at the end of the round after they froze, the mission is lost.</b> Carrying them into the heated station is enough — the station warms them overnight.</p>`;
    } else if (tab === 'end') {
      body = `${sec(1, 'Winning')}
        <ol class="rb-flow"><li>All ${E.PARTS} radio parts installed.</li><li>Enough clean samples verified (see the difficulty table).</li><li>The plane called from the Radio Room. It lands at the end of the <b>second round after the call</b>.</li><li>When it lands, the Hangar is undamaged and <b>every</b> crewmate is in it (frozen ones carried in). If not, it circles and tries again at the end of the next round.</li></ol>
        ${sec(2, 'Losing')}
        <ul class="rb-flow"><li>The storm deck runs out — the final whiteout.</li><li>A crewmate stays frozen past the end of the round after they froze.</li><li>${E.DAMAGE_LOSS} station modules are damaged at the same time.</li></ul>`;
    } else if (tab === 'terms') {
      body = `<dl class="rb-terms">
        <dt>Round</dt><dd>Signals, then everyone’s turn in role order, then a storm.</dd>
        <dt>Actions</dt><dd>${E.ACTIONS} per turn; installing and repairing cost the Engineer 1 and others 2; analyzing costs the Researcher 1 and others 2.</dd>
        <dt>Carry</dt><dd>One thing at a time: a part, a sample, a fuel drum or a frozen crewmate.</dd>
        <dt>Fuel</dt><dd>1 burned per round (2 in a deep freeze); a drum gives +2.</dd>
        <dt>Heat</dt><dd>Fuel left and Generator undamaged: +1 warmth inside. Otherwise −1 inside.</dd>
        <dt>Cold</dt><dd>−1 on the ice each round (none in calm skies), −2 more in a blizzard.</dd>
        <dt>Frozen</dt><dd>At 0 warmth. Must be warmed by the end of the next round.</dd>
        <dt>Damage</dt><dd>A damaged module can’t be used until repaired. ${E.DAMAGE_LOSS} at once loses the game.</dd>
        <dt>Signals</dt><dd>One per crewmate per round: ✅ go, ⚠️ avoid or ❓ check, at one place.</dd>
        <dt>The plane</dt><dd>Lands at the end of the second round after the call — everyone in an undamaged Hangar.</dd>
      </dl>`;
    }
    const prev = RULE_CHAPTERS[n - 2];
    const next = RULE_CHAPTERS[n];
    return `${head}${body}<div class="rb-nav">${prev ? `<button type="button" class="btn ghost sm" data-tab="${prev[0]}">← ${n - 1}. ${prev[1]}</button>` : '<span></span>'}${next ? `<button type="button" class="btn sm" data-tab="${next[0]}">${n + 1}. ${next[1]} →</button>` : ''}</div>`;
  }
  function showRules(tab) {
    if (typeof tab === 'string' && RULE_CHAPTERS.some((c) => c[0] === tab)) rulesTab = tab;
    const toc = () => RULE_CHAPTERS.map(([k, name], i) => `<button type="button" data-tab="${k}" class="${rulesTab === k ? 'on' : ''}"><span>${i + 1}</span> ${name}</button>`).join('');
    const back = document.createElement('div');
    back.className = 'modal-back wide rules-modal';
    back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Whiteout Station rulebook"><button type="button" class="modal-x" data-close aria-label="Close">✕</button>
      <h2>📜 Whiteout Station — Rulebook</h2>
      <div class="rulebook"><nav class="rules-tabs rb-toc" aria-label="Contents"><b class="rb-toc-head">Contents</b>${toc()}</nav>
      <article class="rules-body">${rulesBody(rulesTab)}</article></div></div>`;
    document.body.appendChild(back);
    const close = () => {
      back.remove();
      removeEventListener('keydown', onKey);
      if (G && G.mode === 'local') loop();
    };
    const onKey = (e) => e.key === 'Escape' && close();
    addEventListener('keydown', onKey);
    back.addEventListener('click', (e) => {
      if (e.target === back || e.target.closest('[data-close]')) return close();
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      rulesTab = b.dataset.tab;
      back.querySelectorAll('.rb-toc button').forEach((x) => x.classList.toggle('on', x.dataset.tab === rulesTab));
      back.querySelector('.rules-body').innerHTML = rulesBody(rulesTab);
      back.querySelector('.modal').scrollTop = 0;
      const on = back.querySelector('.rb-toc button.on');
      if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    back.querySelector('.modal-x').focus();
  }

  // ---------------------------------------------------------------- online (the shared board-online.js lobby and live moves)
  let olPrefs = {};
  try {
    olPrefs = JSON.parse(read('whiteout.olprefs') || '{}') || {};
  } catch {
    olPrefs = {};
  }
  const Online = window.BoardOnline ? window.BoardOnline.attach({
    apiPrefix: '/api/whiteout',
    title: 'Whiteout Station',
    onlineKey: 'whiteout.online',
    maxPlayers: 4,
    blurb: 'Play Whiteout Station with other Ahrens Labs players: invite up to three crewmates, and computer crewmates take any roles left over. Choose quick (2 minutes a turn) or long (take your turn whenever).',
    esc,
    toast: (m) => toast(m),
    sessionId: session,
    prefs: () => olPrefs,
    savePrefs: (p) => {
      olPrefs = p;
      try {
        localStorage.setItem('whiteout.olprefs', JSON.stringify(p));
      } catch {
        /* ignore */
      }
    },
    roundText: (g) => (g.round ? `round ${g.round}` : ''),
    getG: () => G,
    isMyTurn: () => !!G && G.mode === 'online' && G.status === 'active' && E.waitingOn(G.state).includes(G.me),
    showSetup: () => showSetup(),
    challengeExtra: () => ({ opts: { diff: setup.diff } }),
    enterOnline: (v) => {
      stop();
      closeVeil();
      G = { mode: 'online', id: v.id, me: v.me, version: v.version, status: v.status, result: v.result, deadline: v.deadline || null, gmode: v.mode, skew: v.now ? v.now - Date.now() : 0, state: v.state, seen: v.state.past.length, privy: v.me, peek: true };
      render();
      if (v.state.phase === 'over') showEnd();
    },
    applyView: (v) => {
      if (!G || G.mode !== 'online') return;
      const round = G.state.round;
      Object.assign(G, { version: v.version, status: v.status, result: v.result, deadline: v.deadline || null });
      if (v.now) G.skew = v.now - Date.now();
      if (v.state) G.state = v.state;
      G.pick = null;
      render();
      if (G.state.past.length > G.seen) showStorm(round);
      else if (G.state.phase === 'over' && !veilOpen()) showEnd();
    },
  }) : null;
  function leaveOnline() {
    if (Online) Online.forgetOnline();
    history.replaceState(null, '', location.pathname);
    showSetup();
  }

  const params = new URLSearchParams(location.search);
  const localId = params.get('local');
  let saved = null;
  try {
    saved = JSON.parse(read(SAVE_KEY) || 'null');
  } catch {
    saved = null;
  }
  if (localId && validSave(saved) && saved.gid === localId) startFrom(saved);
  else if (localId && window.BoardSaves) {
    app.innerHTML = '<p class="muted" style="text-align:center;margin:3rem">Loading your mission…</p>';
    window.BoardSaves.load('whiteout', localId).then((g) => (validSave(g) ? startFrom(g) : showSetup()));
  } else showSetup(); // a ?game= link opens from the online lobby
})();
