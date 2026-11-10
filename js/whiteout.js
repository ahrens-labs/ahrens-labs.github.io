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
  const veilOpen = () => !!$('.veil');

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
      ${topRow(`<span class="wo-ttl">❄️ Whiteout Station</span>${G.mode === 'local' ? '<button type="button" class="btn ghost sm" id="new-mission">New mission</button>' : ''}`)}
      ${statusBar(s)}
      <div class="layout">
        <section class="board" aria-label="Map of Whiteout Station and the ice">${board(s, vis, ci)}</section>
        <div class="side">${turnPanel(s, vis, ci)}${crewPanel(s, vis)}<section class="panel"><h2>Station log</h2><ul class="log">${s.log.slice(-14).reverse().map((l) => `<li>${esc(l.text)}</li>`).join('')}</ul></section></div>
      </div>`;
    wire(s, ci);
    if (G.mode === 'online' && G.gmode === 'quick' && G.status === 'active' && Online && Online.tickClock) Online.tickClock();
  }
  function currentSignaller() {
    const s = st();
    const seat = E.waitingOn(s).find((x) => !s.players[x].ai && (G.mode === 'online' ? x === G.me : solo() || x === G.privy));
    return seat == null ? -1 : E.deciding(s, seat);
  }
  function statusBar(s) {
    const left = s.stormsLeft != null ? s.stormsLeft : s.storms.length;
    const broken = E.MODULES.filter((m) => s.damaged[m]);
    const chips = [
      `<span class="chip">Round ${s.round}</span>`,
      `<span class="chip storm">⛈️ ${left} storm${left === 1 ? '' : 's'} left</span>`,
      `<span class="chip ${s.fuel <= 1 ? 'bad' : ''}">⛽ Fuel ${s.fuel}</span>`,
      `<span class="chip ${s.installed >= E.PARTS ? 'good' : ''}">📻 Radio ${s.installed}/${E.PARTS}</span>`,
      `<span class="chip ${s.verified >= s.need ? 'good' : ''}">🧪 Samples ${s.verified}/${s.need}</span>`,
      s.plane ? `<span class="chip good">🛩️ Plane lands end of round ${s.plane.round + E.PLANE_ROUNDS}</span>` : '',
      broken.length ? `<span class="chip bad">⚠️ ${broken.length}/${E.DAMAGE_LOSS} modules damaged</span>` : '',
    ];
    const clock = G.mode === 'online' && G.gmode === 'quick' && G.status === 'active' ? '<span class="ol-clock" id="ol-clock"></span>' : '';
    return `<div class="status">${chips.join('')}${clock}<button class="btn sm ghost" id="rules-btn">📜 Rules</button></div>`;
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
        ${secret}
        <div class="sigpick"><p class="hint">${pick ? `Signal at <b>${E.PLACES[pick].name}</b>:` : 'Tap a place on the map, then choose what your signal says. No other talking!'}</p>
        <div class="seg">${Object.keys(SIG).map((k) => `<button type="button" data-sig="${k}" ${pick ? '' : 'disabled'}>${SIG[k]} ${SIG_TEXT[k]}</button>`).join('')}</div>
        <button type="button" class="act end" data-sig="none">🤐 Send no signal</button></div></section>`;
    }
    const c = s.crew[ci];
    const R = E.ROLES[c.role];
    const mine = canControl(ci);
    const left = s.acts;
    const dots = `<span class="acts-left" aria-label="${left} action${left === 1 ? '' : 's'} left">${Array.from({ length: E.ACTIONS }, (_, j) => `<i class="${j < left ? '' : 'off'}"></i>`).join('')}</span>`;
    const head = `<div class="who"><img src="${crewImg(c.role)}" alt=""><div><b>${R.icon} ${R.name}</b>${dots}<div class="muted">${s.players[c.seat].ai ? '🤖 Computer crewmate' : esc(s.players[c.seat].name)}${c.carry ? ` · carrying ${E.itemName(c.carry)}` : ''}</div></div></div>`;
    if (!mine) return `<section class="panel turn" style="--rc:${ROLE_COLOR[c.role]}">${head}<p class="hint">${s.players[c.seat].ai ? 'The computer crewmate is working…' : 'Waiting for their move…'}</p>${G.mode === 'online' ? secret : ''}</section>`;
    const opts = E.actionsFor(s, ci).filter((a) => a.t !== 'move');
    const peekBtn = !solo() && G.mode === 'local' ? `<button type="button" class="btn sm ghost" id="peek">${G.peek ? '🙈 Hide my secret' : '🔒 Show my secret'}</button>` : '';
    return `<section class="panel turn" style="--rc:${ROLE_COLOR[c.role]}">${head}
      ${peekBtn}${secret}
      <p class="hint">Tap a glowing place on the map to walk there${E.cost(s, ci, 'move') > 1 ? ' (2 actions while carrying someone)' : ''}.</p>
      <div class="actions">${opts.map((a) => actionButton(s, ci, a)).join('')}</div></section>`;
  }
  function actionButton(s, ci, a) {
    const c = s.crew[ci];
    const cost = (k) => E.cost(s, ci, k);
    const n = (x) => `<small>${x} action${x > 1 ? 's' : ''}</small>`;
    const rn = (i) => E.ROLES[s.crew[i].role].name;
    const data = `data-a='${esc(JSON.stringify(a))}'`;
    const B = (label, x, key) => `<button type="button" class="act${key ? ' key' : ''}${a.t === 'end' ? ' end' : ''}" ${data}>${label}${x ? n(x) : ''}</button>`;
    switch (a.t) {
      case 'end': return B('⏭️ End turn', 0);
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
      history.replaceState(null, '', location.pathname);
      showSetup();
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

  // ---------------------------------------------------------------- rules
  function showRules() {
    const v = document.createElement('div');
    v.className = 'veil';
    v.innerHTML = `<div class="card" role="dialog" aria-modal="true" aria-label="How to play" style="width:min(720px,100%)"><div class="body rules">
      <h2>How to play Whiteout Station</h2>
      <p>A cooperative game: the whole crew wins or loses together.</p>
      <h3>🎯 Win</h3><ol><li>Find the <b>3 radio parts</b> on the ice and install them in the <b>Radio Room</b>.</li><li>Take samples at the field sites and <b>analyze</b> them in the <b>Lab</b> until enough clean ones are verified.</li><li>From the Radio Room, <b>call the plane</b>. It lands at the end of the second round after the call — the Hangar must be undamaged and <b>every</b> crewmate in it (frozen ones carried in).</li></ol>
      <h3>❄️ Lose</h3><ul><li>The storm deck runs out: the final whiteout.</li><li>A crewmate stays frozen to the end of the round after they froze.</li><li>Three modules are damaged at once.</li></ul>
      <h3>🔁 Each round</h3><ol><li><b>Signals.</b> Each crewmate secretly picks one place on the map and says ✅ go here, ⚠️ avoid here or ❓ check here (or nothing). They’re revealed together. That’s the only way to share your secret — no other talking about it!</li><li><b>Actions.</b> In order (Meteorologist, Engineer, Researcher, Medic), each crewmate takes up to <b>3 actions</b>.</li><li><b>Storm.</b> The next storm card hits, then the generator burns fuel. Inside a heated station you warm up by 1; out on the ice you lose 1.</li></ol>
      <h3>🦶 Actions</h3><ul><li><b>Walk</b> one step along a path (2 actions while carrying a frozen crewmate, unless you’re the Medic).</li><li><b>Search</b> a field site: if a radio part is there you pick it up.</li><li><b>Take</b> a sample, a fuel drum, something lying on the ground, or a frozen crewmate. You carry one thing at a time; <b>put down</b> to swap.</li><li><b>Install</b> a part (Radio Room), <b>analyze</b> a sample (Lab), <b>feed the generator</b> a fuel drum (+2 fuel), <b>repair</b> a damaged module. Installing and repairing take the Engineer 1 action and everyone else 2; analyzing takes the Researcher 1 and everyone else 2.</li><li><b>Warm up</b> anyone in the station (+1, or +2 in the Infirmary).</li></ul>
      <h3>🕵️ The roles</h3><ul>${E.ROLE_ORDER.map((r) => `<li><b>${E.ROLES[r].icon} ${E.ROLES[r].name}.</b> ${E.ROLES[r].secret} ${E.ROLES[r].power}</li>`).join('')}</ul>
      <h3>⛈️ Storms</h3><ul><li><b>Blizzard:</b> anyone in that part of the ice loses 2 warmth.</li><li><b>Whiteout:</b> a site is cut off — nobody moves in or out next round.</li><li><b>Ice storm:</b> a module is damaged until repaired (a damaged Generator gives no heat).</li><li><b>Deep freeze:</b> the generator burns an extra fuel.</li><li><b>Calm:</b> nobody outside gets colder.</li></ul>
      <h3>🧊 Warmth</h3><p>Everyone starts with 5. At 0 you freeze where you stand and drop what you carry. You can’t act until someone warms you up — carry them inside before the end of the next round.</p>
    </div><div class="body" style="padding-top:0"><button class="btn" id="rules-close">Got it</button></div></div>`;
    document.body.appendChild(v);
    const close = () => {
      v.remove();
      if (G && G.mode === 'local') loop();
    };
    $('#rules-close', v).onclick = close;
    v.addEventListener('click', (e) => e.target === v && close());
    $('#rules-close', v).focus();
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
