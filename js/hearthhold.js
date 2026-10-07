// Hearthhold — page UI. Rules live in hearthhold-engine.js.
(function () {
  'use strict';
  const E = window.HearthholdEngine;
  const SAVE_KEY = 'ahrensHearthhold.v1';
  const PREFS_KEY = 'ahrensHearthhold.prefs';
  const IMG = (k) => `/img/hearthhold/${k}.webp`;
  const S = 38;
  const SQ3 = Math.sqrt(3);
  const FACE = 4.4 * S;
  const RAD = FACE / Math.cos(Math.PI / 6);
  const SMOKY = ['keep', 'house', 'inn', 'bakery', 'smithy', 'workshop'];
  const PCOLOR = ['#e05a4f', '#3f8fd8'];

  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  let G = null; // { state, mode: 'ai' | 'local', level, view }
  const ui = { pick: null, boardSig: '', fresh: new Set(), freshSide: null, aiTimer: null, modal: false, rulesTab: 'basics' };

  // ---------------------------------------------------------------- persistence
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(G));
    } catch (e) {
      /* storage full or blocked: the game still works, it just won't resume */
    }
  }
  function loadSave() {
    try {
      const g = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return g && g.state && g.state.v === 1 ? g : null;
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
  const myTurnHere = () => humanTurn() && st().turn === G.view;
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
  function showSetup() {
    clearTimeout(ui.aiTimer);
    G = null;
    const pr = prefs();
    const saved = loadSave();
    const canResume = saved && saved.state.phase !== 'over';
    document.body.className = 'setup-mode';
    $('#app').innerHTML = `
      <div class="setup">
        <div class="setup-hero">
          <img src="${IMG('cover')}" alt="" class="hero-img">
          <div class="hero-shade"></div>
          <div class="hero-text">
            <h1 class="display">Hearthhold</h1>
            <p>Raise a village. Keep its people fed, warm and housed. Hold the walls when the dragons come.</p>
          </div>
          <div class="hero-particles" aria-hidden="true">${particles('autumn', 10)}</div>
        </div>
        <div class="setup-card panel">
          ${canResume ? `<div class="resume"><div><b>Game in progress</b><span class="muted">${esc(saved.state.players.map((p) => p.name).join(' vs '))} · ${E.SEASON[E.seasonOf(saved.state.round)].name}, year ${E.yearOf(saved.state.round)}</span></div><button class="btn" id="resume">Continue</button></div>` : ''}
          <h2>New game</h2>
          <div class="field">
            <span class="label">Opponent</span>
            <div class="seg" id="mode">
              <button data-v="ai" class="${pr.mode !== 'local' ? 'on' : ''}">🤖 Computer</button>
              <button data-v="local" class="${pr.mode === 'local' ? 'on' : ''}">👥 Two players, one device</button>
            </div>
          </div>
          <div class="field ai-only">
            <span class="label">Difficulty</span>
            <div class="seg" id="level">
              ${['easy', 'normal', 'hard'].map((l) => `<button data-v="${l}" class="${(pr.level || 'normal') === l ? 'on' : ''}">${l[0].toUpperCase() + l.slice(1)}</button>`).join('')}
            </div>
          </div>
          <div class="field names">
            <label><span class="label">Your village</span><input id="n0" maxlength="18" value="${esc(pr.n0 || 'Oakvale')}"></label>
            <label class="local-only"><span class="label">Second village</span><input id="n1" maxlength="18" value="${esc(pr.n1 || 'Stonebrook')}"></label>
          </div>
          <div class="field">
            <span class="label">Who starts?</span>
            <div class="seg" id="first">
              <button data-v="0" class="on">First village</button>
              <button data-v="1">Second village</button>
              <button data-v="r">🎲 Random</button>
            </div>
          </div>
          <button class="btn big" id="start">Found your village</button>
          <div class="btn-row center">
            <button class="btn ghost sm" id="how">📜 How to play</button>
            <a class="btn ghost sm" href="/board-games.html">🎲 All board games</a>
          </div>
        </div>
      </div>`;
    const setMode = (m) => {
      $('.setup').classList.toggle('is-local', m === 'local');
      $('#first').children[0].textContent = m === 'local' ? 'First village' : 'Me';
      $('#first').children[1].textContent = m === 'local' ? 'Second village' : 'Computer';
    };
    $('.setup').addEventListener('click', (e) => {
      const b = e.target.closest('.seg button');
      if (!b) return;
      [...b.parentNode.children].forEach((x) => x.classList.toggle('on', x === b));
      if (b.parentNode.id === 'mode') setMode(b.dataset.v);
    });
    setMode(pr.mode === 'local' ? 'local' : 'ai');
    $('#how').onclick = () => showRules();
    if (canResume) $('#resume').onclick = () => startFrom(saved);
    $('#start').onclick = () => {
      const pick = (id) => $(`#${id} .on`).dataset.v;
      const mode = pick('mode');
      const level = pick('level');
      let first = pick('first');
      first = first === 'r' ? (Math.random() < 0.5 ? 0 : 1) : +first;
      const n0 = $('#n0').value.trim() || 'Oakvale';
      const n1 = mode === 'local' ? $('#n1').value.trim() || 'Stonebrook' : 'Computer';
      savePrefs({ mode, level, n0, n1: $('#n1').value.trim() || 'Stonebrook' });
      const state = E.newGame({ names: [n0, n1], ai: [false, mode === 'ai'], first });
      startFrom({ state, mode, level, view: mode === 'local' ? state.turn : 0 });
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
    if (st().phase === 'over') showGameOver();
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
          <div><h1>Hearthhold</h1><small id="subtitle"></small></div>
        </div>
        <div class="top-mid">
          <div class="tracker" id="tracker"></div>
          <div class="turn-banner" id="banner"></div>
        </div>
        <div class="top-actions">
          <button class="btn ghost sm" id="rules-btn">📜 Rules</button>
          <button class="btn ghost sm" id="new-btn">🏰 New game</button>
          <a class="btn ghost sm" href="/board-games.html" title="All board games" aria-label="All board games">🎲</a>
        </div>
      </header>
      <section class="threats" id="threats"></section>
      <main class="layout">
        <section class="board-wrap">
          <div class="board-tabs" id="tabs"></div>
          <div class="board" id="board"><svg id="svg" viewBox="-258 -240 516 480" role="img" aria-label="Village map"></svg><div class="particles" id="particles"></div></div>
          <div class="pickbar" id="pickbar"></div>
        </section>
        <aside class="side">
          <div class="panel" id="res"></div>
          <div class="panel" id="actions"></div>
        </aside>
      </main>
      <section class="panel" id="row"></section>
      <section class="lower">
        <div class="panel" id="people"></div>
        <div class="panel" id="log"></div>
      </section>`;
    $('#rules-btn').onclick = () => showRules();
    $('#new-btn').onclick = newGame;
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
    renderRes();
    renderActions();
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
      pips += `${r > 1 && (r - 1) % 4 === 0 ? '<span class="yr-gap"></span>' : ''}<span class="pip ${cls}" title="${sea.name}, year ${E.yearOf(r)}">${sea.icon}</span>`;
    }
    $('#tracker').innerHTML = pips;
    let b;
    if (s.phase === 'over') b = '<b>The game is over</b>';
    else {
      const p = s.players[s.turn];
      const dots = s.players
        .map((q, i) => `<span class="who" style="--pc:${PCOLOR[i]}"><i></i>${esc(q.name)} ${'●'.repeat(Math.max(0, q.actions))}${'○'.repeat(Math.max(0, E.BASE_ACTIONS - q.actions))}</span>`)
        .join('');
      const lead = s.lead === s.turn && s.players[s.turn].actions === actionsAtStart(s.turn) && s.round > 1 ? ' <span class="muted">(went first: behind on points)</span>' : '';
      b = p.ai
        ? `<b class="thinking">${esc(p.name)} is thinking<span class="dots"><i>.</i><i>.</i><i>.</i></span></b>${dots}`
        : `<b style="--pc:${PCOLOR[s.turn]}" class="turn-name">${G.mode === 'ai' ? 'Your turn' : `${esc(p.name)}’s turn`}</b><span class="acts">${plural(p.actions, 'action')} left${lead}</span>${dots}`;
    }
    $('#banner').innerHTML = b;
  }
  function actionsAtStart(pi) {
    const p = st().players[pi];
    return E.BASE_ACTIONS + E.workers(p).filter((w) => w.v.k === 'steward' && w.spec).length;
  }

  // ---------------------------------------------------------------- threats
  function renderThreats() {
    const s = st();
    const p = me();
    const list = E.upcoming(s, 3);
    const when = ['Tonight', 'Next round', 'In 2 rounds'];
    $('#threats').innerHTML =
      `<div class="threats-head"><h3>Threats</h3><span class="muted">${plural(Math.max(0, E.ROUNDS - s.round), 'more creature')} after tonight</span></div>` +
      list
        .map((t, j) => {
          const B = E.BEAST[t.k];
          const bt = E.beastText(t.k);
          const d = E.defense(p, t.k, t.side, j > 0);
          const ok = d >= B.str;
          const kind = B.kind === 'fly' ? '🪽 Flies over walls' : `⬆ Hits the ${sideName(t.side)} side`;
          return `<div class="threat${j === 0 ? ' tonight' : ''} tier${B.tier}" data-beast="${t.k}">
            <div class="th-when">${when[j]} · ${E.SEASON[E.seasonOf(s.round + j)].icon}</div>
            <div class="th-art"><img src="${IMG(t.k)}" alt=""></div>
            <div class="th-body">
              <div class="th-name">${esc(B.name)} <span class="th-str" title="Strength">⚔️${B.str}</span></div>
              <div class="th-kind">${kind}${B.undead ? ' · 💀 Undead' : ''}</div>
              <div class="th-def ${ok ? 'ok' : 'bad'}">${esc(p.name)}: 🛡️${d} ${ok ? '✓ holds' : `✗ short by ${B.str - d}`}</div>
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
        const sc = E.score(s, p).total;
        return `<button class="tab${G.view === i ? ' on' : ''}" data-view="${i}" style="--pc:${PCOLOR[i]}"><i></i>${esc(p.name)}${G.mode === 'ai' && !p.ai ? ' (you)' : ''} <span class="tab-score">⭐${sc}</span></button>`;
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
    const sig = JSON.stringify([G.view, p.bld, p.walls, p.vil, p.castle, ui.pick, s.round, s.phase, s.turn === G.view, [...ui.fresh], ui.freshSide]);
    if (sig === ui.boardSig) return;
    ui.boardSig = sig;
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
    </defs>`;
    // ground and the ring road
    const big = [0, 60, 120, 180, 240, 300].map((a) => polar(a, RAD + 10).map((n) => n.toFixed(1)).join(',')).join(' ');
    h += `<polygon class="ground" points="${big}" fill="url(#g-ground)"/>`;
    h += `<polygon class="road" points="${[0, 60, 120, 180, 240, 300].map((a) => polar(a, RAD - 4).map((n) => n.toFixed(1)).join(',')).join(' ')}"/>`;
    // cells
    E.CELLS.forEach((c, i) => {
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
      const [lx, ly] = polar(E.SIDES[i].ang, FACE + 18);
      const [tx, ty] = polar(E.SIDES[i].ang + 19, FACE + 14);
      if (lvl) h += `<text class="wall-tag" x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}">🛡️${E.WALL[lvl].def}</text>`;
      if (pick && pick.t === 'wall') {
        const c = E.wallCost(p, i);
        h += `<g class="side-pick${c ? '' : ' maxed'}" data-side="${i}"><line class="side-hit" ${line}/>`;
        h += `<text class="side-cost" x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}">${c ? `${lvl ? 'Stone' : 'Palisade'} ${E.costText(c)}` : 'Stone ✓'}</text></g>`;
      }
    }
    // tonight's creature
    if (thr && s.phase !== 'over') {
      const B = E.BEAST[thr.k];
      if (B.kind === 'fly') {
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

  function buildingSvg(p, b, x, y) {
    const B = E.BUILD[b.b];
    const k = b.b === 'keep' && p.castle ? 'castle' : b.b;
    const occ = E.occupants(p, b.id);
    const slots = E.slotsOf(b.b);
    const worked = !slots || occ.some((v) => E.canWork(v.k, b.b));
    const r = S * 0.78;
    let h = `<g class="bld b-${b.b}${ui.fresh.has(b.id) ? ' fresh' : ''}${worked ? '' : ' unstaffed'}" data-cell="${b.cell}" data-bld="${b.id}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})">`;
    h += `<title>${esc(bldTitle(p, b))}</title>`;
    h += `<circle r="${r}" class="bld-bg" fill="${B.color}"/>`;
    h += `<image href="${IMG(k)}" x="${-S * 0.95}" y="${-S * 0.95}" width="${S * 1.9}" height="${S * 1.9}" clip-path="url(#clip-b)" preserveAspectRatio="xMidYMid slice"/>`;
    h += `<circle r="${S * 0.72}" class="bld-ring"/>`;
    if (b.b === 'keep') h += `<g class="flag" transform="translate(${S * 0.42},${-S * 0.98})"><line y1="0" y2="16" class="pole"/><path class="pennant" d="M0,0 L15,4 L0,8 Z" fill="${PCOLOR[st().players.indexOf(p)]}"/></g>`;
    if (SMOKY.includes(b.b)) h += `<g class="smoke" transform="translate(${S * 0.3},${-S * 0.62})"><circle r="3.5"/><circle r="4.5"/><circle r="5.5"/></g>`;
    if (b.b === 'well') h += `<circle r="${S * 0.72}" class="shimmer"/>`;
    if (slots) {
      for (let j = 0; j < slots; j++) {
        const vx = (j - (slots - 1) / 2) * 18;
        const vy = S * 0.64;
        const v = occ[j];
        h += `<g transform="translate(${vx},${vy})">`;
        h += v ? `<circle r="9.5" class="slot full${E.canWork(v.k, b.b) === 'spec' ? ' spec' : ''}"/><image href="${IMG(v.k)}" x="-11" y="-11" width="22" height="22" clip-path="url(#clip-v)"/>` : '<circle r="8.5" class="slot empty"/><text class="slot-q" y="4">+</text>';
        h += '</g>';
      }
    }
    h += '</g>';
    return h;
  }
  function bldTitle(p, b) {
    const B = E.BUILD[b.b];
    const pr = E.production(p, season()).by[b.id];
    let t = `${B.name}${b.b === 'keep' && p.castle ? ' (Castle)' : ''}`;
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
    const msg = pk.t === 'build' ? `Pick a glowing spot for your <b>${E.BUILD[pk.b].name}</b> (${cost(E.buildCost(p, pk.b), p)})` : 'Pick a side to wall: a <b>Palisade</b> (🛡️2) or upgrade one to <b>Stone</b> (🛡️4)';
    bar.innerHTML = `<span>${msg}</span><button class="btn ghost sm" data-act="cancel-pick">Cancel</button>`;
  }

  // ---------------------------------------------------------------- side panels
  function renderRes() {
    const s = st();
    const p = me();
    const pr = E.production(p, season());
    const chip = (icon, n, plus, label) => `<div class="rchip" title="${label}"><span class="ri">${icon}</span><b>${n}</b>${plus ? `<small>+${plus}</small>` : ''}</div>`;
    const sc = E.score(s, p);
    const pop = p.vil.length;
    const beds = E.beds(p);
    const water = E.water(p);
    const room = E.room(p);
    const thr = tonight();
    const B = thr && E.BEAST[thr.k];
    const d = thr ? E.defense(p, thr.k, thr.side) : 0;
    const foodAfter = p.res.food + pr.food - pop;
    const wneed = E.woodNeed(p, season());
    const woodAfter = p.res.wood + pr.wood - wneed;
    const roomWhy = room > 0 ? `<span class="good">room for ${room} more</span>` : beds <= water ? '<span class="warn">full — build a House</span>' : '<span class="warn">full — dig a Well</span>';
    $('#res').innerHTML = `
      <div class="res-head"><h3 style="--pc:${PCOLOR[G.view]}"><i></i>${esc(p.name)}</h3><span class="score-pill" title="Renown ${sc.renown} · Buildings ${sc.buildings} · Villagers ${sc.villagers} · Stone walls ${sc.walls} · Gold ${sc.gold} · Fortified ${sc.fortified}">⭐ ${sc.total} points</span></div>
      <div class="rchips">
        ${E.RES.map((r) => chip(E.RES_ICON[r], p.res[r], pr[r], `${r} (+${pr[r]} at dusk)`)).join('')}
        ${chip('⭐', p.renown, pr.renown, 'renown')}
        ${p.arms || pr.forge ? chip('⚒️', `${p.arms}/${E.ARMS_MAX}`, pr.forge && p.arms < E.ARMS_MAX && (p.res.iron + pr.iron) > 0 ? 1 : 0, 'arms: each adds 🛡️1') : ''}
      </div>
      <ul class="vstats">
        <li><span>👥</span>${plural(pop, 'villager')} · 🛏️${beds} beds · 💧${water} water · ${roomWhy}</li>
        <li class="${foodAfter < 0 ? 'bad' : ''}"><span>🍞</span>Supper: make ${pr.food}, eat ${pop} → ${foodAfter < 0 ? `<b>short ${-foodAfter} — ${plural(-foodAfter, 'villager')} will leave!</b>` : `${foodAfter} left`}</li>
        ${wneed ? `<li class="${woodAfter < 0 ? 'bad' : ''}"><span>❄️</span>Firewood: burn ${wneed} 🪵 → ${woodAfter < 0 ? `<b>short ${-woodAfter} — villagers will freeze!</b>` : `${woodAfter} left`}</li>` : ''}
        ${B ? `<li class="${d >= B.str ? 'good-li' : 'bad'}"><span>🛡️</span>Tonight vs ${esc(B.name)} ⚔️${B.str}: 🛡️${d} ${d >= B.str ? '✓ we hold' : `✗ short by ${B.str - d}`}${p.muster ? ` <small>(incl. militia +${p.muster})</small>` : ''}</li>` : ''}
      </ul>`;
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
    if (s.players[s.turn].ai) {
      box.innerHTML = `<h3>Actions</h3><p class="muted waiting">${esc(s.players[s.turn].name)} is taking a turn…</p>`;
      return;
    }
    if (s.turn !== pi) {
      box.innerHTML = `<h3>Actions</h3><p class="muted">It’s ${esc(s.players[s.turn].name)}’s turn.</p><button class="btn sm" data-view="${s.turn}">Show ${esc(s.players[s.turn].name)}’s village</button>`;
      return;
    }
    const L = (a) => E.legal(s, pi, a);
    const btn = (a, icon, title, sub, extraCls) => {
      const why = a ? L(a) : null;
      return `<button class="act${extraCls ? ' ' + extraCls : ''}" ${a ? `data-a='${JSON.stringify(a)}'` : ''} ${why ? `disabled title="${esc(why)}"` : ''}><span class="ai">${icon}</span><span class="at">${title}</span><span class="as">${sub}</span></button>`;
    };
    const anyBuild = E.BUILD_ORDER.some((b) => !E.buildBlock(s, pi, b) && E.canPay(p, E.buildCost(p, b)));
    const anyWall = [0, 1, 2, 3, 4, 5].some((i) => E.wallCost(p, i) && E.canPay(p, E.wallCost(p, i)));
    const rate = E.hasMerchant(p) ? '1:1' : '2:1';
    box.innerHTML = `
      <h3>Actions <span class="muted">${p.actions} left</span></h3>
      <div class="acts-grid">
        <button class="act wide" data-act="build"${anyBuild ? '' : ' title="Nothing affordable yet — you can still look"'}><span class="ai">🏗️</span><span class="at">Build</span><span class="as">${anyBuild ? 'a building' : 'browse buildings'}</span></button>
        <button class="act" data-act="wall" ${anyWall ? '' : 'disabled title="Walls cost 🪵2 (palisade) or 🪨3 (stone)"'}><span class="ai">🧱</span><span class="at">Wall</span><span class="as">🪵2 / 🪨3</span></button>
        <button class="act" data-act="recruit"><span class="ai">🧑‍🌾</span><span class="at">Recruit</span><span class="as">${E.room(p) > 0 ? 'from the Crossroads' : 'no room!'}</span></button>
        ${btn({ t: 'gather', r: 'food' }, '🍞', 'Gather', `+${E.gatherAmount('food')} food`)}
        ${btn({ t: 'gather', r: 'wood' }, '🪵', 'Gather', `+${E.gatherAmount('wood')} wood`)}
        ${btn({ t: 'gather', r: 'stone' }, '🪨', 'Gather', `+${E.gatherAmount('stone')} stone`)}
        ${btn({ t: 'tax' }, '🪙', 'Tax', `+${E.taxAmount(p)} gold`)}
        <button class="act" data-act="trade"><span class="ai">⚖️</span><span class="at">Trade</span><span class="as">up to 3 at ${rate}</span></button>
        ${btn({ t: 'muster' }, '⚔️', 'Muster', p.muster ? 'done this round' : `+🛡️${E.musterAmount(p)} tonight`)}
        <button class="act ghosty" data-act="pass"><span class="ai">⏭️</span><span class="at">Pass</span><span class="as">end your round</span></button>
      </div>
      <p class="tip">Moving villagers between jobs is free — click one below or a building on the map.</p>`;
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
        const pr = E.rowPrice(s, i);
        const disc = E.VIL[k].cost - pr.gold;
        const tag = i === 0 ? `Leaves at dusk${disc ? ` · −🪙${disc}` : ''}` : disc ? `−🪙${disc}` : '';
        return card(k, pr, i, tag);
      })
      .join('');
    $('#row').innerHTML = `
      <div class="row-head"><h3>🛤️ The Crossroads</h3><span class="muted">Travellers looking for a home. The first is cheapest but leaves tonight. ${plural(s.deck.length, 'more traveller')} on the road.</span>
      ${room <= 0 ? '<span class="warn-pill">No room — build a House or Well</span>' : `<span class="ok-pill">Room for ${room}</span>`}</div>
      <div class="vrow">${cards}${card('peasant', { gold: E.VIL.peasant.cost }, null, 'Always here')}</div>`;
  }

  function renderPeople() {
    const p = me();
    const own = !p.ai && st().phase === 'act' && (G.mode === 'local' ? st().turn === G.view : true);
    const chips = p.vil
      .map((v) => {
        const b = v.at != null && p.bld.find((x) => x.id === v.at);
        const how = b && E.canWork(v.k, b.b);
        const where = b ? `${E.BUILD[b.b].name}${how === 'spec' ? ' ★' : ''}` : 'Idle';
        return `<button class="pchip${b ? '' : ' idle'}${how === 'spec' ? ' spec' : ''}" data-vil="${v.id}" ${own ? '' : 'disabled'}><img src="${IMG(v.k)}" alt=""><span><b>${E.VIL[v.k].name}</b><small>${where}</small></span></button>`;
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
      render();
      return;
    }
    const a = e.target.closest('[data-a]');
    if (a && !a.disabled) {
      doAction(JSON.parse(a.dataset.a));
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
    if (what === 'wall') {
      ui.pick = { t: 'wall' };
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
    if (what === 'pass') confirmPass();
    if (what === 'show-final') showGameOver();
  }

  function onBoardClick(e) {
    if (!G) return;
    const side = e.target.closest('[data-side]');
    if (side && ui.pick && ui.pick.t === 'wall') {
      const i = +side.dataset.side;
      const why = E.legal(st(), G.view, { t: 'wall', side: i });
      if (why) return toast(esc(why), 'bad');
      ui.pick = null;
      ui.freshSide = i;
      doAction({ t: 'wall', side: i });
      return;
    }
    const cell = e.target.closest('[data-cell]');
    if (!cell) return;
    const i = +cell.dataset.cell;
    if (ui.pick && ui.pick.t === 'build') {
      const a = { t: 'build', b: ui.pick.b, cell: i };
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
    el.textContent = `${s.players[s.turn].name}’s turn`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  // ---------------------------------------------------------------- computer turns
  function scheduleAI() {
    clearTimeout(ui.aiTimer);
    if (!G || ui.modal) return;
    const s = st();
    if (s.phase !== 'act' || !s.players[s.turn].ai) return;
    ui.aiTimer = setTimeout(aiStep, 850);
  }
  function aiStep() {
    if (!G || ui.modal) return;
    const s = st();
    if (s.phase !== 'act' || !s.players[s.turn].ai) return;
    const pi = s.turn;
    const p = s.players[pi];
    const a = E.aiChoose(s, pi, G.level);
    const before = p.bld.length;
    let msg;
    try {
      msg = E.apply(s, pi, a);
    } catch (err) {
      msg = E.apply(s, pi, { t: 'pass' });
    }
    if (a.t === 'build' && p.bld.length > before) ui.fresh.add(p.bld[p.bld.length - 1].id);
    if (a.t === 'wall' && G.view === pi) ui.freshSide = a.side;
    toast(`<span class="dot" style="--pc:${PCOLOR[pi]}"></span><b>${esc(p.name)}</b> ${esc(msg)}`, 'ai');
    afterAction();
  }

  // ---------------------------------------------------------------- build picker
  function showBuildPicker() {
    const s = st();
    const pi = G.view;
    const p = me();
    const card = (b) => {
      const B = E.BUILD[b];
      const c = E.buildCost(p, b);
      const block = E.buildBlock(s, pi, b);
      const afford = E.canPay(p, c);
      const why = block || (afford ? null : 'Not enough resources');
      const where = B.upgrade ? 'Upgrades your Keep' : `On ${B.on.map((t) => E.TERRAIN[t].name.toLowerCase()).join(' or ')}`;
      const pts = B.pts ? (B.wonder ? `⭐${B.pts}` : B.slots ? `⭐${B.pts} while staffed` : `⭐${B.pts}`) : 'no points';
      const n = p.bld.filter((x) => x.b === b).length;
      return `<button class="bcard${why ? ' off' : ''}${B.wonder ? ' wonder' : ''}" data-pick="${b}" ${why ? `title="${esc(why)}"` : ''}>
        <div class="b-art" style="--bc:${B.color}"><img src="${IMG(b)}" alt="">${n ? `<span class="b-n">×${n}</span>` : ''}</div>
        <div class="b-name">${B.name}${B.wonder ? ' <span class="wtag">Wonder</span>' : ''}</div>
        <div class="b-cost">${cost(c, p)}</div>
        <div class="b-text">${B.text}</div>
        ${jobLine(b)}
        <div class="b-foot"><span>${where}</span><span>${pts}</span></div>
        ${why ? `<div class="b-why">${esc(why)}</div>` : ''}
      </button>`;
    };
    const back = openModal(`<h2>🏗️ Build</h2><p class="muted">Your stores: ${E.RES.map((r) => `${E.RES_ICON[r]}${p.res[r]}`).join(' ')}${E.hasMerchant(p) ? '' : ' · short? Trade first (2:1).'}</p><div class="bgrid">${E.BUILD_ORDER.map(card).join('')}</div>`, { cls: 'wide' });
    back.addEventListener('click', (e) => {
      const c = e.target.closest('[data-pick]');
      if (!c || c.classList.contains('off')) return;
      const b = c.dataset.pick;
      if (!myTurnHere()) return;
      ui.onClose = null;
      closeModal();
      if (E.BUILD[b].upgrade) {
        doAction({ t: 'build', b, cell: null });
        return;
      }
      ui.pick = { t: 'build', b };
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
    const own = !p.ai && s.phase === 'act' && (G.mode === 'local' ? s.turn === G.view : true);
    const slots = E.slotsOf(b.b);
    const movers = own && slots && occ.length < slots ? p.vil.filter((v) => v.at !== b.id && E.canWork(v.k, b.b)) : [];
    const prodTxt = pr ? Object.entries(pr).map(([r, n]) => (r === 'forge' ? '⚒️ forges arms' : `${r === 'renown' ? '⭐' : E.RES_ICON[r]}${n}`)).join(' ') : 'nothing this round';
    const back = openModal(`
      <div class="binfo">
        <div class="b-art big" style="--bc:${B.color}"><img src="${IMG(k)}" alt=""></div>
        <div>
          <h2>${b.b === 'keep' && p.castle ? 'Castle' : B.name}</h2>
          <p>${B.text}${b.b === 'keep' && p.castle ? ' ' + E.BUILD.castle.text : ''}</p>
          <p><b>This round:</b> ${prodTxt}</p>
          ${slots ? `<p><b>Workers (${occ.length}/${slots}):</b> ${occ.map((v) => `<button class="pchip sm" data-move="${v.id}" ${own ? '' : 'disabled'}><img src="${IMG(v.k)}" alt=""><span><b>${E.VIL[v.k].name}</b><small>${E.canWork(v.k, b.b) === 'spec' ? 'own trade ★' : 'labor'}</small></span></button>`).join(' ') || '<span class="muted">nobody — it earns no points until someone works here</span>'}</p>` : ''}
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
    const targets = E.moveTargets(p, v);
    const back = openModal(`
      <div class="binfo">
        <div class="b-art big v"><img src="${IMG(v.k)}" alt=""></div>
        <div>
          <h2>${V.name}</h2>
          <p>${V.text}</p>
          <p class="muted">Now: ${whereOf(p, v)} · worth ⭐${V.pts}</p>
          <p><b>Move to (free):</b></p>
          <div class="pchips">
            ${targets.map((b) => `<button class="pchip sm${E.canWork(v.k, b.b) === 'spec' ? ' spec' : ''}" data-to="${b.id}"><img src="${IMG(b.b)}" alt=""><span><b>${E.BUILD[b.b].name}</b><small>${E.canWork(v.k, b.b) === 'spec' ? 'own trade ★' : 'labor'}</small></span></button>`).join('') || '<span class="muted">No free job they can do. Build one first.</span>'}
            ${v.at != null ? '<button class="pchip sm idle" data-to="idle"><span><b>Rest</b><small>make idle</small></span></button>' : ''}
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
    const rate = E.hasMerchant(p) ? 1 : 2;
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
        <p class="muted">Give ${rate} of one thing for 1 of another — up to 3 trades for one action.${rate === 2 ? ' A working Merchant makes it 1 for 1.' : ''}</p>
        <div class="tr-step"><b>1. Give ${rate}:</b> ${E.RES.map((r) => `<button class="rbtn${give === r ? ' on' : ''}" data-give="${r}" ${res[r] < rate || trades.length >= 3 ? 'disabled' : ''}>${E.RES_ICON[r]}<small>${res[r]}</small></button>`).join('')}</div>
        <div class="tr-step"><b>2. Get 1:</b> ${E.RES.map((r) => `<button class="rbtn" data-get="${r}" ${!give || give === r ? 'disabled' : ''}>${E.RES_ICON[r]}</button>`).join('')}</div>
        <div class="tr-list">${trades.map(([g, t], i) => `<span class="tr-item">${E.RES_ICON[g]}${rate} → ${E.RES_ICON[t]}1 <button class="link" data-undo="${i}">✕</button></span>`).join('') || '<span class="muted">No trades yet.</span>'}</div>
        <p>After: ${E.RES.map((r) => `${E.RES_ICON[r]}${res[r]}`).join(' ')}</p>
        <div class="btn-row"><button class="btn" data-ok ${trades.length ? '' : 'disabled'}>Trade (uses 1 action)</button><button class="btn ghost" data-close>Cancel</button></div>`;
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

  function confirmPass() {
    const p = me();
    if (p.actions <= 1) return doAction({ t: 'pass' });
    const back = openModal(`<h2>End your round?</h2><p>You still have ${plural(p.actions, 'action')}. Passing gives them up for this round.</p><div class="btn-row"><button class="btn lava" data-yes>Pass</button><button class="btn ghost" data-close>Keep playing</button></div>`);
    back.addEventListener('click', (e) => {
      if (!e.target.closest('[data-yes]')) return;
      ui.onClose = null;
      closeModal();
      doAction({ t: 'pass' });
    });
  }

  // ---------------------------------------------------------------- dusk
  function runDusk() {
    const s = st();
    if (s.phase !== 'dusk') return;
    clearTimeout(ui.aiTimer);
    const rowBefore = s.row.slice();
    const rep = E.resolveDusk(s);
    const kept = rowBefore.length - (rep.leftRow ? 1 : 0);
    const arrived = s.row.slice(kept);
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
          if (a.wallFrom != null && a.wallFrom !== a.wallTo) bits.push(`the ${sideName(rep.threat.side)} ${E.WALL[a.wallFrom].name.toLowerCase()} ${a.wallTo ? 'was damaged' : 'was destroyed'}`);
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
          <div><b>${B.name}</b> attacks${B.kind === 'fly' ? ' from the sky' : ` from the ${sideName(rep.threat.side)}`}! <span class="muted">⚔️${B.str} · win ${bt.win}</span></div>
        </div>
        <div class="dcols">${cols}</div>
        <p class="crossroads muted">🛤️ ${crossroads}</p>
        <button class="btn big" data-close>${s.phase === 'over' ? 'See final scores' : `On to ${E.SEASON[E.seasonOf(s.round)].name} ${E.SEASON[E.seasonOf(s.round)].icon}`}</button>
      </div>`;
    render();
    openModal(html, {
      cls: 'dusk-back locked',
      noClose: true,
      onClose: () => {
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
  }

  function seasonBanner() {
    const s = st();
    const sea = E.SEASON[season()];
    const el = document.createElement('div');
    el.className = `season-banner sb-${season()}`;
    const first = s.players[s.turn];
    el.innerHTML = `<div class="sb-in"><span class="sb-icon">${sea.icon}</span><div><b>${sea.name}</b><small>Year ${E.yearOf(s.round)} · round ${s.round} of ${E.ROUNDS}</small><em>${sea.note}</em><em>${esc(first.name)} goes first${s.round > 1 ? ' (behind or tied on points)' : ''}.</em></div></div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2300);
    setTimeout(() => el.remove(), 2800);
  }

  // ---------------------------------------------------------------- game over
  function showGameOver() {
    const s = st();
    const sc = s.players.map((p) => E.score(s, p));
    const w = E.winner(s);
    const rows = [
      ['⭐ Renown (trophies, Bards, Priests…)', 'renown'],
      ['🏠 Buildings (staffed) & wonders', 'buildings'],
      ['👥 Villagers', 'villagers'],
      ['🧱 Stone wall sections', 'walls'],
      ['🪙 Gold (1 per 5)', 'gold'],
      ['🏰 Fully walled (+3)', 'fortified'],
    ];
    let title;
    if (w < 0) title = 'A perfect tie!';
    else if (G.mode === 'ai') title = s.players[w].ai ? `${esc(s.players[w].name)} wins` : 'Your village thrives — you win!';
    else title = `${esc(s.players[w].name)} wins!`;
    const humanWon = w >= 0 && !s.players[w].ai;
    const html = `
      <div class="final">
        <div class="final-art"><img src="${IMG(humanWon ? 'castle' : w >= 0 ? 'dragon' : 'keep')}" alt=""></div>
        <h2 class="final-title">${title}</h2>
        <table class="final-table">
          <thead><tr><th></th>${s.players.map((p, i) => `<th style="--pc:${PCOLOR[i]}"><i></i>${esc(p.name)}${w === i ? ' 👑' : ''}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(([label, k]) => `<tr><td>${label}</td>${sc.map((x) => `<td>${x[k]}</td>`).join('')}</tr>`).join('')}</tbody>
          <tfoot><tr><td>Total</td>${sc.map((x, i) => `<td class="${w === i ? 'win' : ''}">${x.total}</td>`).join('')}</tr></tfoot>
        </table>
        <p class="muted">${s.players.map((p) => `${esc(p.name)}: ${plural(p.vil.length, 'villager')}, ${plural(p.trophies.length, 'creature')} driven off`).join(' · ')}</p>
        <div class="btn-row center"><button class="btn" data-again>Play again</button><button class="btn ghost" data-close>Look at the villages</button><a class="btn ghost" href="/board-games.html">All board games</a></div>
      </div>`;
    const back = openModal(html, { cls: 'final-back', onClose: () => render() });
    back.addEventListener('click', (e) => {
      if (e.target.closest('[data-again]')) {
        ui.onClose = null;
        closeModal();
        try {
          localStorage.removeItem(SAVE_KEY);
        } catch (err) {
          /* ignore */
        }
        showSetup();
      }
    });
    if (humanWon || (G.mode === 'local' && w >= 0)) confetti();
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
    const go = () => {
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch (err) {
        /* ignore */
      }
      showSetup();
    };
    if (st().phase === 'over') return go();
    const back = openModal('<h2>🏰 Start a new game?</h2><p>This ends the current game. Your progress so far will be lost.</p><div class="btn-row"><button class="btn lava" data-yes>New game</button><button class="btn ghost" data-close>Keep playing</button></div>');
    back.addEventListener('click', (e) => {
      if (!e.target.closest('[data-yes]')) return;
      ui.onClose = null;
      closeModal();
      go();
    });
  }

  // ---------------------------------------------------------------- rules
  const RULE_TABS = [
    ['basics', 'Basics'],
    ['round', 'A round'],
    ['actions', 'Actions'],
    ['buildings', 'Buildings'],
    ['villagers', 'Villagers'],
    ['creatures', 'Creatures'],
    ['scoring', 'Scoring'],
  ];
  function rulesBody(tab) {
    if (tab === 'basics')
      return `
      <p class="lead">Two villages grow side by side for <b>3 years</b> — 12 seasons. Build homes, wells and workshops, take in travellers with useful trades, and keep everyone fed, watered and warm. Every night a creature attacks <i>both</i> villages. The village with the most <b>⭐ points</b> after the last winter wins.</p>
      <h4>Your village</h4>
      <p>Each village sits on the same map of 19 hexes around its <b>Keep</b>. The land decides what can go where:</p>
      <table class="rules-table"><tr><th>Land</th><th>What fits</th></tr>
        <tr><td>🌼 Meadow</td><td>Farms — or any town building</td></tr>
        <tr><td>🟫 Plains</td><td>Any town building (Houses, Wells, Inns, Markets…)</td></tr>
        <tr><td>🌲 Forest</td><td>Lumber camps only</td></tr>
        <tr><td>⛰️ Hills</td><td>Quarries only</td></tr>
        <tr><td>🏔️ Mountain</td><td>Mines only</td></tr></table>
      <h4>Keeping people alive</h4>
      <ul>
        <li><b>Beds and water:</b> you can only take someone in if you have both a bed (🛏️ Keep, Houses, Inns, Barracks) and water (💧 Keep, Wells) for them.</li>
        <li><b>Food:</b> every villager eats 🍞1 at the end of every round.</li>
        <li><b>Firewood:</b> in Winter every 3 villagers burn 🪵1.</li>
        <li>If you come up short, villagers <b>leave</b> and you lose ⭐1 for each.</li>
      </ul>
      <h4>Start</h4>
      <p>You begin with a Keep, a Farm, two Peasants and 🍞4 🪵5 🪨2 🪙4. The second village gets 🪙5.</p>`;
    if (tab === 'round')
      return `
      <ol class="steps">
        <li><b>Day.</b> Each village has <b>3 actions</b> (+1 for each Steward). Players take turns, one action at a time. Round 1 starts with the chosen player; after that, <b>whoever is behind on points goes first</b> (on a tie it alternates).</li>
        <li><b>Work.</b> Every staffed building produces. Farms: Summer +1, Autumn +2, nothing in Winter.</li>
        <li><b>Night.</b> Tonight’s creature attacks both villages. If your 🛡️ defense is at least its ⚔️ strength, you drive it off and take its trophy (⭐ and sometimes 🪙 loot). If not, it does damage.</li>
        <li><b>Supper.</b> Everyone eats 🍞1. In Winter, burn firewood. Anyone who can’t be fed or kept warm leaves (−⭐1 each).</li>
        <li><b>Crossroads.</b> The traveller who has waited longest moves on and new ones arrive.</li>
      </ol>
      <h4>Seasons</h4>
      <table class="rules-table">${E.SEASONS.map((k) => `<tr><td>${E.SEASON[k].icon} ${E.SEASON[k].name}</td><td>${E.SEASON[k].note}</td></tr>`).join('')}</table>
      <h4>Plan ahead</h4>
      <p>You can always see the next <b>3 creatures</b> and which side they’ll hit. Creatures get tougher every year: year 1 ⚔️2–3, year 2 ⚔️5–7, year 3 ⚔️9–10.</p>`;
    if (tab === 'actions')
      return `
      <table class="rules-table">
        <tr><th>Action</th><th>What it does</th></tr>
        <tr><td>🏗️ Build</td><td>Pay the cost and place a building on a free hex of the right land.</td></tr>
        <tr><td>🧱 Wall</td><td>Build a Palisade (🪵2, 🛡️2) on one of your 6 sides, or upgrade it to Stone (🪨3, 🛡️4). Walls only stop creatures that attack <i>that side</i> on foot — flyers ignore them.</td></tr>
        <tr><td>🧑‍🌾 Recruit</td><td>Take in a traveller from the Crossroads and pay their 🪙 price. The first in line costs 🪙2 less, the second 🪙1 less. A Peasant (🪙1) is always available. Needs a free bed <i>and</i> water.</td></tr>
        <tr><td>🍞🪵🪨 Gather</td><td>Take 🍞3, 🪵3 or 🪨2 from the wilds.</td></tr>
        <tr><td>🪙 Tax</td><td>Collect 🪙3, +1 for every 2 villagers.</td></tr>
        <tr><td>⚖️ Trade</td><td>Up to 3 trades of 2-for-1 (1-for-1 with a working Merchant).</td></tr>
        <tr><td>⚔️ Muster</td><td>Call out the militia: +🛡️2, +1 per 3 villagers, against <i>tonight’s</i> creature. Once per round.</td></tr>
        <tr><td>⏭️ Pass</td><td>Give up the rest of your actions this round.</td></tr>
        <tr><td>🔁 Move (free)</td><td>Move villagers between jobs any time on your turn.</td></tr>
      </table>
      <h4>Jobs</h4>
      <p>Each villager has a trade (★). Working their own building gives the full effect. <b>Anyone</b> can work a Farm, Lumber camp, Quarry or Mine as plain labor, for less. A villager without a job is idle and makes nothing — but still eats.</p>`;
    if (tab === 'buildings')
      return `<p>Buildings with a job slot only score their ⭐ while someone works there. Wonders can only be built by <b>one</b> village.</p><div class="gallery">${E.BUILD_ORDER.concat(['keep'])
        .map((b) => {
          const B = E.BUILD[b];
          return `<div class="gcard" style="--bc:${B.color}"><img src="${IMG(b)}" alt=""><div><b>${B.name}</b>${B.wonder ? ' <span class="wtag">Wonder</span>' : ''}<div class="g-cost">${B.start ? 'You start with it' : cost(B.cost)}${B.on ? ` · ${B.on.map((t) => E.TERRAIN[t].name).join('/')}` : ''}${B.pts ? ` · ⭐${B.pts}` : ''}</div><p>${B.text}</p>${jobLine(b)}</div></div>`;
        })
        .join('')}</div>`;
    if (tab === 'villagers')
      return `<p>Prices are in 🪙. The deck holds ${Object.values(E.DECK).reduce((a, b) => a + b, 0)} travellers.</p><div class="gallery">${E.VIL_ORDER.map((k) => {
        const V = E.VIL[k];
        return `<div class="gcard v"><img src="${IMG(k)}" alt=""><div><b>${V.name}</b><div class="g-cost">🪙${V.cost}${V.iron ? ` 🔩${V.iron}` : ''} · ⭐${V.pts}${E.DECK[k] ? ` · ×${E.DECK[k]} in deck` : ' · always available'}</div><p>${V.text}</p><small class="muted">Works at: ${V.at ? E.BUILD[V.at].name : 'any labor building'}</small></div></div>`;
      }).join('')}</div>`;
    if (tab === 'creatures')
      return `<p>Year 1 brings the Wolf pack first, then three more from tier 1. Year 2 and year 3 each draw four.</p>${[1, 2, 3]
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
        .join('')}
      <h4>Defense</h4>
      <ul>
        <li>Keep 🛡️1 (Castle +3), each Watchtower or Wizard’s Tower 🛡️1, each set of arms 🛡️1.</li>
        <li>Guards 🛡️2, Knights 🛡️4, Archers 🛡️2 (+3 vs flyers), Wizards 🛡️3 (+4 vs flyers and undead), Priests +4 vs undead.</li>
        <li>The wall on the side being attacked (ground creatures only), and Muster for tonight.</li>
      </ul>`;
    if (tab === 'scoring')
      return `
      <table class="rules-table">
        <tr><th>Source</th><th>Points</th></tr>
        <tr><td>⭐ Renown</td><td>Creature trophies, Bards, Priests and the Wizard each round, minus anyone who left hungry or cold or was lost to undead.</td></tr>
        <tr><td>🏠 Buildings</td><td>The ⭐ printed on each building — but job buildings only while staffed. Wonders: Castle ⭐6, Wizard’s Tower ⭐5, Cathedral ⭐10.</td></tr>
        <tr><td>👥 Villagers</td><td>Every villager still living with you: Peasants ⭐1, most trades ⭐2, Knights and Stewards ⭐3, the Wizard ⭐4.</td></tr>
        <tr><td>🧱 Stone walls</td><td>⭐1 per stone section.</td></tr>
        <tr><td>🏰 Fully walled</td><td>⭐3 if all 6 sides have a wall.</td></tr>
        <tr><td>🪙 Gold</td><td>⭐1 per 🪙5 left over.</td></tr>
      </table>
      <p>Ties go to the village with more villagers.</p>
      <h4>Strategy tips</h4>
      <ul>
        <li>Food first: a Farm next to a Well with a Farmer makes 🍞4 most seasons. Stock up before Winter.</li>
        <li>Look at the threat track. A palisade on the right side is cheap; flyers need Archers, Towers or a Wizard.</li>
        <li>Muster when you are just short — it’s one action for a trophy.</li>
        <li>Grab the first traveller in the Crossroads: it’s cheapest, and it leaves tonight anyway.</li>
        <li>Race for a wonder — but you need 5 or 7 villagers first.</li>
      </ul>`;
    return '';
  }
  function showRules(tab) {
    ui.rulesTab = tab || ui.rulesTab || 'basics';
    const back = openModal(`<div class="rules"><h2>📜 How to play Hearthhold</h2><div class="rules-tabs">${RULE_TABS.map(([k, n]) => `<button class="rules-tab${k === ui.rulesTab ? ' on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div><div class="rules-body">${rulesBody(ui.rulesTab)}</div></div>`, { cls: 'wide', onClose: G ? null : () => {} });
    back.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (!t) return;
      ui.rulesTab = t.dataset.tab;
      back.querySelectorAll('.rules-tab').forEach((b) => b.classList.toggle('on', b === t));
      back.querySelector('.rules-body').innerHTML = rulesBody(ui.rulesTab);
      back.querySelector('.rules-body').scrollTop = 0;
      t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }

  // ---------------------------------------------------------------- boot
  const saved = loadSave();
  if (saved && saved.state.phase !== 'over' && /[?&]resume\b/.test(location.search)) startFrom(saved);
  else showSetup();
  window.__hh = { get G() { return G; }, render, E };
})();
