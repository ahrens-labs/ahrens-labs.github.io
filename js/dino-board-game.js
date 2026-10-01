(() => {
  'use strict';

  const N = 10;
  const ROUNDS = 18;
  const SAVE_KEY = 'ahrensDinoBoardGame.v1';
  const CS = 40;
  const PAD = 10;
  const W = N * CS + PAD * 2;

  const TYPE_LABEL = { event: 'When played', action: 'Dino action', scoring: 'Scores at end', none: 'No power' };
  const TYPE_HELP = {
    event: 'Happens once, right when you place this dino.',
    action: 'Use it with the “Use a dino power” action while its enclosure is active.',
    scoring: 'Adds points at the end of the game if its enclosure is active.',
    none: 'Just big, strong, and worth lots of points.',
  };

  const SPECIES = {
    compy: {
      name: 'Compy', type: 'scoring', cost: { d: 0, c: 2 }, space: 1, food: { t: 'meat', n: 1 }, prod: 1, pts: 1,
      color: '#7cb342', emoji: '🦖', code: 'COM',
      ability: '1 point for each adjacent Compy in the enclosure (diagonals don’t count).',
    },
    triceratops: {
      name: 'Triceratops', type: 'action', cost: { d: 2, c: 0 }, space: 5, food: { t: 'plant', n: 2 }, prod: 2, pts: 3,
      color: '#26a69a', emoji: '🦕', code: 'TRI',
      ability: 'Put a plant from the supply on this page. At game end, 3 points for every 2 plants here.',
    },
    spinosaurus: {
      name: 'Spinosaurus', type: 'event', cost: { d: 2, c: 1 }, space: 5, food: { t: 'meat', n: 2 }, prod: 4, pts: 8,
      color: '#e64a19', emoji: '🦖', code: 'SPI',
      ability: 'Gain 1 diamond, 5 coins, 15 food, or fill in 10 squares in your opponent’s park. Then draw the top card of the deck.',
    },
    stegosaurus: {
      name: 'Stegosaurus', type: 'event', cost: { d: 0, c: 5 }, space: 6, food: { t: 'plant', n: 2 }, prod: 2, pts: 4,
      color: '#8e6cc9', emoji: '🦕', code: 'STE',
      ability: 'Gain 10 food in any combination.',
    },
    velociraptor: {
      name: 'Velociraptor', type: 'action', cost: { d: 0, c: 10 }, space: 3, food: { t: 'meat', n: 1 }, prod: 2, pts: 5,
      color: '#f9a825', emoji: '🦖', code: 'VEL',
      ability: 'Steal 2 food per Velociraptor in this enclosure from your opponent (at most what they have).',
    },
    brachiosaurus: {
      name: 'Brachiosaurus', type: 'event', cost: { d: 1, c: 2 }, space: 9, food: { t: 'plant', n: 2 }, prod: 1, pts: 5,
      color: '#5c6bc0', emoji: '🦕', code: 'BRA',
      ability: 'Fill in 5 of your opponent’s squares.',
    },
    trex: {
      name: 'Tyrannosaurus Rex', short: 'T. Rex', type: 'event', cost: { d: 1, c: 7 }, space: 10, food: { t: 'meat', n: 3 }, prod: 4, pts: 10,
      color: '#c62828', emoji: '🦖', code: 'REX',
      ability: 'Choose a dino from your opponent’s book or cards. They can’t place any more of that dino.',
    },
    pachy: {
      name: 'Pachycephalosaurus', short: 'Pachy', type: 'scoring', cost: { d: 1, c: 5 }, space: 4, food: { t: 'plant', n: 2 }, prod: 1, pts: 2,
      color: '#8d6e63', emoji: '🦕', code: 'PAC',
      ability: '1 point for every 5 coins you have at game end, for every Pachy you have.',
    },
    allosaurus: {
      name: 'Allosaurus', type: 'action', cost: { d: 2, c: 3 }, space: 8, food: { t: 'meat', n: 2 }, prod: 3, pts: 5,
      color: '#d84315', emoji: '🦖', code: 'ALL',
      ability: 'Steal up to 3 coins from your opponent (at most what they have).',
    },
    mosasaurus: {
      name: 'Mosasaurus', type: 'none', cost: { d: 4, c: 8 }, space: 20, food: { t: 'meat', n: 4 }, prod: 5, pts: 20,
      color: '#0277bd', emoji: '🐊', code: 'MOS',
      ability: 'None.',
    },
    carnotaurus: {
      name: 'Carnotaurus', type: 'event', cost: { d: 1, c: 2 }, space: 5, food: { t: 'meat', n: 2 }, prod: 3, pts: 5,
      color: '#ad1457', emoji: '🦖', code: 'CAR',
      ability: 'Roll a die and gain 4× that many food.',
    },
    microraptor: {
      name: 'Microraptor', type: 'scoring', cost: { d: 0, c: 3 }, space: 1, food: { t: 'meat', n: 1 }, prod: 1, pts: 1,
      color: '#00897b', emoji: '🦖', code: 'MIC',
      ability: '2 points for each enclosure with a Microraptor.',
    },
    ankylosaurus: {
      name: 'Ankylosaurus', type: 'event', cost: { d: 2, c: 1 }, space: 5, food: { t: 'plant', n: 2 }, prod: 3, pts: 6,
      color: '#6d4c41', emoji: '🦕', code: 'ANK',
      ability: 'Play a dino worth 5 or fewer points for free.',
    },
    dilophosaurus: {
      name: 'Dilophosaurus', type: 'event', cost: { d: 2, c: 1 }, space: 3, food: { t: 'meat', n: 2 }, prod: 3, pts: 4,
      color: '#9ccc65', emoji: '🦖', code: 'DIL',
      ability: 'Take 5 food, draw in 5 fences, draw a card, and gain 5 coins.',
    },
    parasaurolophus: {
      name: 'Parasaurolophus', short: 'Parasaur', type: 'action', cost: { d: 1, c: 2 }, space: 4, food: { t: 'plant', n: 1 }, prod: 1, pts: 2,
      color: '#fb8c00', emoji: '🦕', code: 'PAR',
      ability: 'Gain 2 coins for each Parasaurolophus in this enclosure.',
    },
    gigantoraptor: {
      name: 'Gigantoraptor', type: 'event', cost: { d: 1, c: 4 }, space: 4, food: { t: 'flex', n: 1 }, prod: 2, pts: 4,
      color: '#ec407a', emoji: '🦖', code: 'GIG',
      ability: 'You may do one phase twice next round.',
    },
  };

  const BOOK = ['compy', 'triceratops', 'spinosaurus', 'stegosaurus', 'velociraptor', 'brachiosaurus', 'trex', 'pachy'];
  const DECK = ['allosaurus', 'mosasaurus', 'carnotaurus', 'microraptor', 'ankylosaurus', 'dilophosaurus', 'parasaurolophus', 'gigantoraptor'];

  const PHASES = {
    food: { name: 'Food & Fences', short: 'Food & Fences', icon: '🎲', desc: 'Roll a die, then split it into food and fences.' },
    feed: { name: 'Feeding', short: 'Feeding', icon: '🍖', desc: 'Feed your dinos or they go inactive.' },
    produce: { name: 'Production', short: 'Production', icon: '🪙', desc: 'Collect coins from one enclosure.' },
    action: { name: 'Actions', short: 'Actions', icon: '⚡', desc: 'Do 2 things (the same one twice is fine).' },
  };
  const PHASE_KEYS = Object.keys(PHASES);

  const ENCLOSURE_TINTS = ['#f3e5ab', '#d8ecc2', '#f6d7b0', '#cfe6e3', '#ead9f0', '#f9dede', '#dfe7f7', '#fff0c2', '#e4f2d0', '#f2e0cc'];

  const IMG = '/img/dino-game/';
  const MASCOT = ['trex', 'brachiosaurus'];
  const TOKEN_ALT = {
    coin: 'coins', diamond: 'diamonds', meat: 'meat', plant: 'plants', fence: 'fence', sleep: 'inactive',
    feeder: 'feeder', water: 'watering hole', rubble: 'filled square', fossil: 'extinct',
  };
  const EMO = { '🪙': 'coin', '💎': 'diamond', '🍖': 'meat', '🌿': 'plant', '🪵': 'fence', '💤': 'sleep', '🌾': 'feeder', '💧': 'water', '💀': 'fossil', '🪨': 'rubble' };
  const EMO_RE = new RegExp(`${Object.keys(EMO).join('|')}|⬛`, 'gu');
  const RES = [['coins', 'coin', 'Coins'], ['diamonds', 'diamond', 'Diamonds'], ['meat', 'meat', 'Meat'], ['plants', 'plant', 'Plants']];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let state = null;
  let ui = freshUi();
  let busy = false;
  let drag = null;
  let lastFocus = null;
  let animOn = false;
  let lastTurnKey = null;
  let lastClickRect = null;
  let prevRes = null;
  let resFx = [{}, {}];
  let pendingCard = null;
  let pendingConfirm = null;
  let setupVsAi = false;
  const PREFS_KEY = 'ahrensDinoBoardGame.prefs';
  const prefs = (() => {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    } catch {
      return {};
    }
  })();
  let setupLevel = prefs.level || 'medium';
  let setupPace = prefs.pace || 'medium';
  let aiTimer = null;
  let aiPending = false;
  const fxSeen = new Map();

  // ---------------------------------------------------------------- utils
  const rand = (n) => Math.floor(Math.random() * n);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const other = (p) => 1 - p;
  const cur = () => (state && state.queue[0]) || null;
  const order = () => [state.first, other(state.first)];
  const spName = (sp) => SPECIES[sp].short || SPECIES[sp].name;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function tok(n, cls) {
    return `<img class="tk${cls ? ' ' + cls : ''}" src="${IMG}${n}.webp" alt="${TOKEN_ALT[n] || ''}" draggable="false">`;
  }

  function dz(sp, cls) {
    return `<img class="tk dz${cls ? ' ' + cls : ''}" src="${IMG}${sp}.webp" alt="${esc(SPECIES[sp].name)}" draggable="false">`;
  }

  // Swap resource emoji for token art, touching text only (never tag attributes).
  function tokify(html) {
    return String(html)
      .split(/(<[^>]*>)/)
      .map((part) => (part[0] === '<' ? part : part.replace(EMO_RE, (m) => (m === '⬛' ? '<i class="sq"></i>' : tok(EMO[m])))))
      .join('');
  }

  function isFresh(key, ms) {
    const now = performance.now();
    if (!fxSeen.has(key)) fxSeen.set(key, animOn ? now : -1e9);
    return now - fxSeen.get(key) < (ms || 800);
  }

  function resetFx() {
    fxSeen.clear();
    prevRes = null;
    resFx = [{}, {}];
    lastTurnKey = null;
    pendingCard = null;
  }

  function plural(n, word, many) {
    return `${n} ${n === 1 ? word : many || word + 's'}`;
  }

  function pn(p) {
    const P = state.players[p];
    return `<span class="pn pn-${P.color}">${esc(P.name)}</span>`;
  }

  function logMsg(html) {
    state.log.push({ r: state.round, m: html });
    if (state.log.length > 300) state.log.splice(0, state.log.length - 300);
  }

  function costText(cost) {
    const parts = [];
    if (cost.d) parts.push(`💎${cost.d}`);
    if (cost.c) parts.push(`🪙${cost.c}`);
    return parts.length ? parts.join(' + ') : 'Free';
  }

  function foodText(food) {
    const icon = food.t === 'meat' ? '🍖' : food.t === 'plant' ? '🌿' : '🍖/🌿';
    return `${food.n} ${icon}`;
  }

  const canAfford = (P, cost) => P.diamonds >= cost.d && P.coins >= cost.c;

  function pay(P, cost) {
    P.diamonds -= cost.d;
    P.coins -= cost.c;
  }

  function feederCost(n) {
    return { d: 1, c: 3 + 2 * Math.max(0, n - 5) };
  }
  const WATER_COST = { d: 2, c: 4 };
  const DIAMOND_COST = { d: 0, c: 6 };

  // ---------------------------------------------------------------- board model
  function newBoard() {
    return {
      h: new Array(90).fill(0), // fence below cell (r,c): index r*10+c, r 0..8
      v: new Array(90).fill(0), // fence right of cell (r,c): index r*9+c, c 0..8
      cells: new Array(100).fill(0), // 0 empty, -1 filled by opponent, >0 item id
      items: {},
      nextId: 1,
      inactive: {},
      placedRound: {},
      dead: {},
      names: {},
      nextName: 0,
    };
  }

  function edgeCells(e) {
    const k = e[0];
    const i = +e.slice(1);
    if (k === 'h') {
      const r = Math.floor(i / N);
      const c = i % N;
      return [r * N + c, (r + 1) * N + c];
    }
    const r = Math.floor(i / 9);
    const c = i % 9;
    return [r * N + c, r * N + c + 1];
  }

  function openNbrs(b, i) {
    const r = Math.floor(i / N);
    const c = i % N;
    const out = [];
    if (r > 0 && !b.h[(r - 1) * N + c]) out.push(i - N);
    if (r < N - 1 && !b.h[r * N + c]) out.push(i + N);
    if (c > 0 && !b.v[r * 9 + c - 1]) out.push(i - 1);
    if (c < N - 1 && !b.v[r * 9 + c]) out.push(i + 1);
    return out;
  }

  function orthNbrs(i) {
    const r = Math.floor(i / N);
    const c = i % N;
    const out = [];
    if (r > 0) out.push(i - N);
    if (r < N - 1) out.push(i + N);
    if (c > 0) out.push(i - 1);
    if (c < N - 1) out.push(i + 1);
    return out;
  }

  function withEdges(b, edges) {
    const nb = Object.assign({}, b, { h: b.h.slice(), v: b.v.slice() });
    edges.forEach((e) => {
      nb[e[0]][+e.slice(1)] = 1;
    });
    return nb;
  }

  function analyze(b) {
    const compOf = new Array(100).fill(-1);
    const comps = [];
    for (let s = 0; s < 100; s++) {
      if (compOf[s] >= 0) continue;
      const idx = comps.length;
      const cells = [];
      const stack = [s];
      compOf[s] = idx;
      while (stack.length) {
        const i = stack.pop();
        cells.push(i);
        for (const j of openNbrs(b, i)) {
          if (compOf[j] < 0) {
            compOf[j] = idx;
            stack.push(j);
          }
        }
      }
      cells.sort((x, y) => x - y);
      const sides = new Set();
      cells.forEach((i) => {
        const r = Math.floor(i / N);
        const c = i % N;
        if (r === 0) sides.add('T');
        if (r === N - 1) sides.add('B');
        if (c === 0) sides.add('L');
        if (c === N - 1) sides.add('R');
      });
      comps.push({
        idx, key: cells[0], cells, sides: sides.size, valid: sides.size <= 2,
        dinos: [], feeders: [], waters: [], feederSquares: 0, species: new Set(), empty: 0, rubble: 0,
      });
    }
    const seen = new Set();
    for (let i = 0; i < 100; i++) {
      const v = b.cells[i];
      const cp = comps[compOf[i]];
      if (v === 0) { cp.empty++; continue; }
      if (v < 0) { cp.rubble++; continue; }
      if (seen.has(v)) continue;
      seen.add(v);
      const it = b.items[v];
      if (!it) continue;
      if (it.kind === 'dino') {
        cp.dinos.push(it);
        if (!it.dead) cp.species.add(it.species);
      } else if (it.kind === 'feeder') {
        cp.feeders.push(it);
        cp.feederSquares += it.cells.length;
      } else if (it.kind === 'water') {
        cp.waters.push(it);
      }
    }
    comps.forEach((cp) => {
      cp.hasItems = cp.dinos.length + cp.feeders.length + cp.waters.length > 0;
      cp.living = cp.dinos.filter((d) => !d.dead);
      cp.dead = !!b.dead[cp.key];
      cp.inactive = b.inactive[cp.key] || 0;
      cp.active = cp.valid && !cp.dead && !cp.inactive;
      cp.name = b.names[cp.key] || '';
      cp.prod = cp.living.reduce((s, d) => s + SPECIES[d.species].prod, 0);
    });
    return { compOf, comps };
  }

  function legalEdges(p) {
    return legalEdgesB(state.players[p].board);
  }

  function legalEdgesB(b) {
    const out = [];
    const splitsItem = (e) => {
      const [x, y] = edgeCells(e);
      return b.cells[x] > 0 && b.cells[x] === b.cells[y];
    };
    for (let i = 0; i < 90; i++) {
      if (!b.h[i] && !splitsItem('h' + i)) out.push('h' + i);
      if (!b.v[i] && !splitsItem('v' + i)) out.push('v' + i);
    }
    return out;
  }

  function fenceProblem(b, edges) {
    if (!edges.length) return '';
    const an = analyze(withEdges(b, edges));
    const bad = an.comps.find((cp) => cp.species.size > 1 + cp.waters.length);
    return bad ? 'Those fences would leave different species together without a watering hole.' : '';
  }

  function applyEdges(b, edges) {
    if (!edges.length) return;
    const before = analyze(b);
    edges.forEach((e) => {
      b[e[0]][+e.slice(1)] = 1;
    });
    const after = analyze(b);
    const inactive = {};
    const placedRound = {};
    const dead = {};
    const names = {};
    const namedFrom = new Set();
    const score = (cp) => cp.dinos.length * 100 + cp.feeders.length + cp.waters.length;
    const parts = after.comps.filter((cp) => cp.hasItems).sort((x, y) => score(y) - score(x));
    parts.forEach((cp) => {
      const old = before.comps[before.compOf[cp.key]];
      if (cp.dinos.length) {
        if (b.inactive[old.key]) inactive[cp.key] = b.inactive[old.key];
        if (b.placedRound[old.key] != null) placedRound[cp.key] = b.placedRound[old.key];
        if (b.dead[old.key]) dead[cp.key] = true;
      }
      const oldName = b.names[old.key];
      if (oldName && !namedFrom.has(old.key)) {
        names[cp.key] = oldName;
        namedFrom.add(old.key);
      } else {
        names[cp.key] = enclosureName(b.nextName++);
      }
    });
    b.inactive = inactive;
    b.placedRound = placedRound;
    b.dead = dead;
    b.names = names;
  }

  function emptyCount(p) {
    return state.players[p].board.cells.filter((v) => v === 0).length;
  }

  function contiguous(cells) {
    const set = new Set(cells);
    const seen = new Set([cells[0]]);
    const stack = [cells[0]];
    while (stack.length) {
      const i = stack.pop();
      for (const j of orthNbrs(i)) {
        if (set.has(j) && !seen.has(j)) {
          seen.add(j);
          stack.push(j);
        }
      }
    }
    return seen.size === set.size;
  }

  function enclosureName(n) {
    return n < 26 ? String.fromCharCode(65 + n) : String.fromCharCode(65 + (n % 26)) + Math.floor(n / 26);
  }

  function placeItem(p, kind, cells, species) {
    return placeItemB(state.players[p].board, kind, cells, species);
  }

  function placeItemB(b, kind, cells, species) {
    const id = b.nextId++;
    const sorted = cells.slice().sort((x, y) => x - y);
    b.items[id] = { id, kind, species: species || null, cells: sorted, dead: false };
    sorted.forEach((i) => {
      b.cells[i] = id;
    });
    const an = analyze(b);
    const cp = an.comps[an.compOf[sorted[0]]];
    if (!b.names[cp.key]) b.names[cp.key] = enclosureName(b.nextName++);
    return b.names[cp.key];
  }

  function validatePlacement(p, cells, spec) {
    const b = state.players[p].board;
    const an = analyze(b);
    if (!cells.length) return { ok: false, msg: 'Select squares on your board.' };
    if (spec.size && cells.length !== spec.size) {
      return { ok: false, msg: `Select exactly ${spec.size} squares (${cells.length} so far).` };
    }
    if (cells.some((i) => b.cells[i] !== 0)) return { ok: false, msg: 'Every square must be empty.' };
    if (!contiguous(cells)) return { ok: false, msg: 'Squares must connect side to side (diagonals don’t count).' };
    const ci = an.compOf[cells[0]];
    if (cells.some((i) => an.compOf[i] !== ci)) return { ok: false, msg: 'All squares must be inside one enclosure.' };
    const cp = an.comps[ci];
    if (!cp.valid) {
      return {
        ok: false,
        msg: `That area isn’t an enclosure yet — it touches ${cp.sides} sides of the board edge (max 2). Draw fences to close it in.`,
      };
    }
    if (cp.dead) return { ok: false, msg: 'That enclosure is extinct 💀 — nothing new can live there.' };
    if (spec.kind === 'dino') {
      const species = new Set(cp.species);
      species.add(spec.species);
      const allowed = 1 + cp.waters.length;
      if (species.size > allowed) {
        return {
          ok: false,
          msg: cp.waters.length
            ? `This enclosure already holds ${allowed} species (1 + one per watering hole).`
            : 'A different species already lives there — add a watering hole to mix species.',
        };
      }
    }
    return { ok: true, msg: `Fits in ${cp.name ? 'enclosure ' + cp.name : 'a new enclosure'} ✔`, comp: cp };
  }

  // ---------------------------------------------------------------- feeding / production / scoring helpers
  // Feeders take 1 food per feeder square off the enclosure's whole bill (not off each dino).
  function enclosureCost(cp) {
    const c = { meat: 0, plant: 0, flex: 0 };
    const extra = cp.inactive || 0;
    cp.living.forEach((d) => {
      const f = SPECIES[d.species].food;
      c[f.t] += f.n + extra;
    });
    let off = cp.feederSquares;
    for (const k of ['meat', 'plant', 'flex']) {
      const t = Math.min(off, c[k]);
      c[k] -= t;
      off -= t;
    }
    c.discount = cp.feederSquares - off;
    c.total = c.meat + c.plant + c.flex;
    return c;
  }

  function feedables(an) {
    return an.comps.filter((cp) => !cp.dead && cp.living.length);
  }

  function sumCosts(list) {
    const s = { meat: 0, plant: 0, flex: 0, total: 0 };
    list.forEach((c) => {
      s.meat += c.meat;
      s.plant += c.plant;
      s.flex += c.flex;
      s.total += c.total;
    });
    return s;
  }

  function canPayFood(P, c) {
    return c.meat <= P.meat && c.plant <= P.plants && c.total <= P.meat + P.plants;
  }

  function producible(p) {
    const an = analyze(state.players[p].board);
    return an.comps.filter((cp) => cp.active && cp.living.length);
  }

  function dinoSummary(cp, includeDead) {
    const counts = {};
    (includeDead ? cp.dinos : cp.living).forEach((d) => {
      counts[d.species] = (counts[d.species] || 0) + 1;
    });
    return Object.keys(counts)
      .map((sp) => `<span class="dzn">${dz(sp)} ${spName(sp)}${counts[sp] > 1 ? ' ×' + counts[sp] : ''}</span>`)
      .join(', ');
  }

  function dinoActionOptions(p) {
    const an = analyze(state.players[p].board);
    const out = [];
    an.comps.filter((cp) => cp.active).forEach((cp) => {
      const counts = {};
      cp.living.forEach((d) => {
        if (SPECIES[d.species].type === 'action') counts[d.species] = (counts[d.species] || 0) + 1;
      });
      Object.keys(counts).forEach((sp) => out.push({ sp, key: cp.key, name: cp.name, count: counts[sp] }));
    });
    return out;
  }

  function roomFor(p, sp, an) {
    const b = state.players[p].board;
    const need = SPECIES[sp].space;
    return an.comps.some((cp) => {
      if (!cp.valid || cp.dead || cp.empty < need) return false;
      const kinds = new Set(cp.species);
      kinds.add(sp);
      if (kinds.size > 1 + cp.waters.length) return false;
      const free = new Set(cp.cells.filter((i) => b.cells[i] === 0));
      const seen = new Set();
      for (const start of free) {
        if (seen.has(start)) continue;
        const reach = bfsRegion(start, free);
        reach.forEach((i) => seen.add(i));
        if (reach.length >= need) return true;
      }
      return false;
    });
  }

  function bfsRegion(start, free) {
    const out = [start];
    const seen = new Set(out);
    for (let q = 0; q < out.length; q++) {
      for (const j of orthNbrs(out[q])) {
        if (free.has(j) && !seen.has(j)) {
          seen.add(j);
          out.push(j);
        }
      }
    }
    return out;
  }

  function playOptions(p, free) {
    const P = state.players[p];
    const an = analyze(P.board);
    return P.book.map((sp) => {
      const blocked = P.blocked.includes(sp);
      let why = '';
      if (blocked) why = 'Blocked by T. Rex';
      else if (free ? SPECIES[sp].pts > 5 : !canAfford(P, SPECIES[sp].cost)) why = free ? 'Worth more than 5 points' : 'Can’t afford yet';
      else if (!roomFor(p, sp, an)) why = 'No room in your park';
      return { sp, ok: !why, why };
    });
  }

  function trexOptions(p) {
    const O = state.players[other(p)];
    return O.book.filter((sp) => !O.blocked.includes(sp));
  }

  function canShop(P) {
    return canAfford(P, DIAMOND_COST) || canAfford(P, feederCost(1)) || canAfford(P, WATER_COST);
  }

  function scorePlayer(p) {
    const P = state.players[p];
    const b = P.board;
    const an = analyze(b);
    const active = an.comps.filter((cp) => cp.active);
    const dinos = [];
    active.forEach((cp) => cp.living.forEach((d) => dinos.push({ d, cp })));
    const count = (sp) => dinos.filter((x) => x.d.species === sp).length;

    const dinoPts = dinos.reduce((s, x) => s + SPECIES[x.d.species].pts, 0);

    let compy = 0;
    dinos.filter((x) => x.d.species === 'compy').forEach(({ d }) => {
      const i = d.cells[0];
      orthNbrs(i).forEach((j) => {
        const v = b.cells[j];
        if (v > 0 && an.compOf[j] === an.compOf[i]) {
          const it = b.items[v];
          if (it && it.species === 'compy' && !it.dead) compy++;
        }
      });
    });
    const pachy = count('pachy') * Math.floor(P.coins / 5);
    const microEnclosures = active.filter((cp) => cp.living.some((d) => d.species === 'microraptor')).length;
    const micro = count('microraptor') * 2 * microEnclosures;
    const tri = count('triceratops') > 0 ? Math.floor(P.triPlants / 2) * 3 : 0;
    const diamonds = P.diamonds * 3;
    const abilities = compy + pachy + micro + tri;
    return { dinoPts, compy, pachy, micro, tri, abilities, diamonds, total: dinoPts + abilities + diamonds };
  }

  // ---------------------------------------------------------------- game setup
  function newPlayer(i, name) {
    return {
      name: name || (i === 0 ? 'Red' : 'Blue'),
      color: i === 0 ? 'red' : 'blue',
      coins: 5,
      diamonds: 0,
      meat: 0,
      plants: 0,
      board: newBoard(),
      book: BOOK.slice(),
      cards: [],
      blocked: [],
      triPlants: 0,
      bonusNext: 0,
      bonusPending: 0,
      doubles: [],
    };
  }

  function newGame(names, first, ai, level, pace) {
    resetFx();
    const deck = shuffle(DECK.slice());
    const faceUp = [deck.shift(), deck.shift()];
    state = {
      v: 1,
      ai: ai == null ? null : ai,
      aiCfg: ai == null ? null : aiProfile(level, pace),
      players: [newPlayer(0, names[0]), newPlayer(1, names[1])],
      first,
      round: 1,
      deck,
      faceUp,
      phaseOrder: shuffle(PHASE_KEYS.slice()),
      queue: [{ t: 'roundStart' }],
      log: [],
      celebrated: false,
    };
    logMsg(`🥚 New game! ${pn(first)} goes first this round. First player switches every round.`);
    logMsg('Round 1 begins.');
    commit();
  }

  function save() {
    try {
      if (state) localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked */
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.v === 1 && Array.isArray(s.queue) ? s : null;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------- task engine
  function freshUi() {
    return { mode: null, sel: null, meat: 0, plant: 0, feed: null, picks: {}, species: null, shopItem: null };
  }

  function pushFront(tasks, k) {
    tasks.forEach((t) => {
      if (t.k === undefined) t.k = k;
    });
    state.queue.unshift(...tasks);
  }

  function resolveCurrent(newTasks) {
    const T = state.queue.shift();
    pushFront(newTasks || [], T ? T.k : undefined);
    commit();
  }

  function completeAction(newTasks) {
    const T = cur();
    T.remaining--;
    pushFront(newTasks || [], T.k);
    commit();
  }

  function commit() {
    autoResolve();
    save();
    ui = freshUi();
    prepareUi();
    render();
  }

  function refreshSameTask() {
    save();
    ui = freshUi();
    prepareUi();
    render();
  }

  function buildRoundTasks() {
    const q = [];
    state.phaseOrder.forEach((ph, k) => {
      if (ph === 'food') q.push({ t: 'roll', k });
      order().forEach((p) => {
        const times = 1 + state.players[p].doubles.filter((x) => x === ph).length;
        for (let n = 0; n < times; n++) {
          const bonus = n > 0;
          if (ph === 'food') q.push({ t: 'gainFood', p, k, amount: null, bonus });
          else if (ph === 'feed') q.push({ t: 'feed', p, k, bonus });
          else if (ph === 'produce') q.push({ t: 'produce', p, k, bonus });
          else q.push({ t: 'actions', p, k, remaining: 2, bonus });
        }
      });
    });
    q.push({ t: 'roundEnd' });
    return q;
  }

  function endRound() {
    state.queue.shift();
    state.players.forEach((P) => {
      P.bonusPending = P.bonusNext;
      P.bonusNext = 0;
      P.doubles = [];
    });
    if (state.round >= ROUNDS) {
      state.queue = [{ t: 'gameOver' }];
      logMsg('🏁 Round 18 is over — final scoring!');
      return;
    }
    state.round++;
    state.first = other(state.first);
    state.phaseOrder = shuffle(PHASE_KEYS.slice());
    state.queue.push({ t: 'roundStart' });
    logMsg(`Round ${state.round} begins — ${pn(state.first)} goes first.`);
  }

  function autoResolve() {
    for (let guard = 0; guard < 500; guard++) {
      const T = cur();
      if (!T) return;
      const skip = (msg) => {
        if (msg) logMsg(msg);
        state.queue.shift();
      };
      if (T.t === 'roundEnd') { endRound(); continue; }
      if (T.t === 'actions' && T.remaining <= 0) { skip(); continue; }
      if (T.t === 'feed' && !feedables(analyze(state.players[T.p].board)).length) {
        skip(`${pn(T.p)} had no dinos to feed.`);
        continue;
      }
      if (T.t === 'produce' && !producible(T.p).length) {
        skip(`${pn(T.p)} had no active enclosure with dinos to produce from.`);
        continue;
      }
      if (T.t === 'drawCard' && !state.faceUp.length && !state.deck.length) { skip('No cards left to draw.'); continue; }
      if (T.t === 'trex' && !trexOptions(T.p).length) { skip('No dinos left to block.'); continue; }
      if (T.t === 'fillOpp' && emptyCount(other(T.p)) === 0) { skip('Opponent has no empty squares left.'); continue; }
      if (T.t === 'drawFences' && !legalEdges(T.p).length) { skip(`${pn(T.p)} has nowhere left to draw fences.`); continue; }
      if (T.t === 'steal' && T.amount <= 0) { skip(); continue; }
      if (T.t === 'freePlay' && !playOptions(T.p, true).some((o) => o.ok)) {
        skip(`${pn(T.p)} has no dino worth 5 or fewer points to play for free.`);
        continue;
      }
      return;
    }
  }

  function prepareUi() {
    const T = cur();
    if (!T) return;
    const p = T.p;
    if (T.t === 'gainFood' && T.amount != null) ui.sel = { type: 'edges', board: p, edges: new Set() };
    else if (T.t === 'drawFences') ui.sel = { type: 'edges', board: p, edges: new Set() };
    else if (T.t === 'fillOpp') {
      ui.sel = { type: 'cells', board: other(p), cells: new Set(), need: Math.min(T.count, emptyCount(other(p))), purpose: 'rubble' };
    } else if (T.t === 'feed') ui.feed = defaultFeed(p);
    else if (T.t === 'foodChoice') ui.meat = Math.floor(T.amount / 2);
    else if (T.t === 'steal') ui.meat = stealRange(T)[1];
    else if (T.t === 'roundStart' && state.ai != null && state.players[state.ai].bonusPending) {
      ui.picks[state.ai] = new Array(state.players[state.ai].bonusPending).fill('action');
    }
  }

  function defaultFeed(p) {
    const P = state.players[p];
    const an = analyze(P.board);
    const list = feedables(an).sort((a, b) => (b.inactive - a.inactive) || (enclosureCost(a).total - enclosureCost(b).total));
    const chosen = new Set();
    const costs = [];
    list.forEach((cp) => {
      const c = enclosureCost(cp);
      if (canPayFood(P, sumCosts(costs.concat([c])))) {
        chosen.add(cp.key);
        costs.push(c);
      }
    });
    return chosen;
  }

  function stealRange(T) {
    const O = state.players[other(T.p)];
    return [Math.max(0, T.amount - O.plants), Math.min(T.amount, O.meat)];
  }

  function takeCard(p, from) {
    const P = state.players[p];
    let sp;
    if (from === 'deck') {
      sp = state.deck.shift();
    } else {
      sp = state.faceUp.splice(from, 1)[0];
      if (sp && state.deck.length) state.faceUp.splice(from, 0, state.deck.shift());
    }
    if (!sp) return null;
    P.book.push(sp);
    P.cards.push(sp);
    logMsg(`${pn(p)} drew ${dz(sp)} <b>${spName(sp)}</b>${from === 'deck' ? ' from the deck' : ''} into their dino book.`);
    toast(`🃏 ${state.players[p].name} drew ${spName(sp)}`, 'good');
    pendingCard = { p, sp, from };
    return sp;
  }

  function eventTasks(p, sp) {
    const P = state.players[p];
    switch (sp) {
      case 'spinosaurus':
        return [{ t: 'spino', p }];
      case 'stegosaurus':
        return [{ t: 'foodChoice', p, amount: 10, title: 'Stegosaurus: gain 10 food' }];
      case 'brachiosaurus':
        return [{ t: 'fillOpp', p, count: 5, title: 'Brachiosaurus: fill in 5 of your opponent’s squares' }];
      case 'trex':
        return [{ t: 'trex', p }];
      case 'carnotaurus':
        return [{ t: 'carno', p }];
      case 'ankylosaurus':
        return [{ t: 'freePlay', p }];
      case 'dilophosaurus':
        P.coins += 5;
        logMsg(`${pn(p)} gained 🪙5 from Dilophosaurus.`);
        return [
          { t: 'foodChoice', p, amount: 5, title: 'Dilophosaurus: take 5 food' },
          { t: 'drawFences', p, count: 5, title: 'Dilophosaurus: draw in 5 fences' },
          { t: 'drawCard', p, source: 'any', title: 'Dilophosaurus: draw a card' },
        ];
      case 'gigantoraptor':
        if (state.round < ROUNDS) {
          P.bonusNext++;
          logMsg(`${pn(p)} may do one phase twice next round (Gigantoraptor).`);
        } else {
          logMsg('Gigantoraptor’s bonus has no next round to use.');
        }
        return [];
      default:
        return [];
    }
  }

  // ---------------------------------------------------------------- dice
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

  function dieHtml(v, small) {
    const on = PIPS[v] || [];
    let cells = '';
    for (let i = 0; i < 9; i++) cells += `<i class="${on.includes(i) ? 'on' : ''}"></i>`;
    return `<div class="die${small ? ' small' : ''}" id="${small ? '' : 'die'}">${cells}</div>`;
  }

  function animateDie(cb) {
    busy = true;
    const v = 1 + rand(6);
    const el = document.getElementById('die');
    document.querySelectorAll('[data-act="roll"],[data-act="rollBonus"],[data-act="carnoRoll"]').forEach((b) => {
      b.disabled = true;
    });
    if (!el) {
      busy = false;
      cb(v);
      return;
    }
    el.classList.add('rolling');
    let n = 0;
    const iv = setInterval(() => {
      const face = 1 + rand(6);
      el.innerHTML = dieHtml(face).replace(/^<div[^>]*>|<\/div>$/g, '');
      if (++n > 11) {
        clearInterval(iv);
        el.classList.remove('rolling');
        el.classList.add('landed');
        el.innerHTML = dieHtml(v).replace(/^<div[^>]*>|<\/div>$/g, '');
        setTimeout(() => {
          busy = false;
          cb(v);
        }, 650);
      }
    }, 75);
  }

  // ---------------------------------------------------------------- toasts / modal / confetti
  function toast(msg, kind) {
    const root = document.getElementById('toasts');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `toast ${kind || ''}`;
    el.innerHTML = tokify(esc(msg));
    root.appendChild(el);
    while (root.children.length > 3) root.removeChild(root.firstChild);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, 2600);
  }

  function openModal(html, cls) {
    document.getElementById('modal-root').innerHTML = tokify(`<div class="modal-bg" data-act="closeModal"><div class="modal ${cls || ''}" role="dialog" aria-modal="true">${html}</div></div>`);
  }

  function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
    pendingConfirm = null;
  }

  function confirmModal(title, msg, okLabel, onOk) {
    openModal(`<div class="confirm-box"><img class="confirm-dino" src="${IMG}trex.webp" alt=""><h2>${title}</h2><p>${msg}</p>
      <div class="btn-row"><button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn lava" data-act="confirmYes">${okLabel}</button></div></div>`, 'small');
    pendingConfirm = onOk;
  }

  function confetti() {
    const box = document.createElement('div');
    box.className = 'confetti';
    const icons = ['coin', 'diamond', 'meat', 'plant', 'coin', 'diamond'].concat(BOOK, DECK);
    for (let i = 0; i < 46; i++) {
      const s = document.createElement('img');
      const name = icons[rand(icons.length)];
      s.src = `${IMG}${name}.webp`;
      s.alt = '';
      if (SPECIES[name]) s.className = 'cf-dino';
      s.style.left = `${rand(100)}%`;
      s.style.animationDuration = `${2.4 + Math.random() * 2.2}s`;
      s.style.animationDelay = `${Math.random() * 1.2}s`;
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 6000);
  }

  // ---------------------------------------------------------------- tabletop effects
  const centerOf = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

  function flyTokens(fromRect, toEl, img, n) {
    if (reduceMotion.matches || !fromRect || !toEl) return;
    const to = toEl.getBoundingClientRect();
    if (!to.width) return;
    const s = centerOf(fromRect);
    const t = { x: to.left + 14, y: to.top + to.height / 2 };
    for (let i = 0; i < n; i++) {
      const el = document.createElement('img');
      el.src = `${IMG}${img}.webp`;
      el.alt = '';
      el.className = 'fly-tok';
      el.style.left = `${s.x}px`;
      el.style.top = `${s.y}px`;
      document.body.appendChild(el);
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const j = rand(36) - 18;
      const arc = -50 - rand(50);
      const a = el.animate([
        { transform: `translate(-50%,-50%) translate(${j}px,0) scale(.5) rotate(0deg)`, opacity: 0 },
        { transform: `translate(-50%,-50%) translate(${dx * 0.5 + j}px,${dy * 0.5 + arc}px) scale(1.2) rotate(${180 + j * 4}deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.65) rotate(360deg)`, opacity: 0.95 },
      ], { duration: 720, delay: i * 75, easing: 'cubic-bezier(.45,0,.4,1)', fill: 'both' });
      a.onfinish = () => el.remove();
    }
  }

  function flyCard(fromRect, toEl, sp) {
    if (reduceMotion.matches || !fromRect || !toEl) return;
    const to = toEl.getBoundingClientRect();
    if (!to.width) return;
    const s = centerOf(fromRect);
    const t = centerOf(to);
    const el = document.createElement('div');
    el.className = `fly-card t-${SPECIES[sp].type}`;
    el.innerHTML = `<img src="${IMG}${sp}.webp" alt=""><b>${esc(spName(sp))}</b>`;
    el.style.left = `${s.x}px`;
    el.style.top = `${s.y}px`;
    document.body.appendChild(el);
    const a = el.animate([
      { transform: 'translate(-50%,-50%) scale(.8) rotateY(180deg)', opacity: 0 },
      { transform: 'translate(-50%,-50%) translateY(-40px) scale(1.25) rotateY(0deg) rotate(-6deg)', opacity: 1, offset: 0.35 },
      { transform: `translate(-50%,-50%) translate(${t.x - s.x}px,${t.y - s.y}px) scale(.35) rotate(8deg)`, opacity: 0.6 },
    ], { duration: 1050, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'both' });
    a.onfinish = () => {
      el.remove();
      toEl.classList.remove('bump');
      void toEl.offsetWidth;
      toEl.classList.add('bump');
    };
  }

  function turnOverlay(T) {
    if (!T) return;
    let key = null;
    let html = '';
    if (T.t === 'roundStart') {
      key = `r${state.round}`;
      html = `<div class="to-card to-round"><small>Round</small><b>${state.round}</b><span>of ${ROUNDS}</span></div>`;
    } else if (T.p !== undefined && ['gainFood', 'feed', 'produce', 'actions'].includes(T.t)) {
      key = `p${T.p}:${state.round}:${T.k}:${T.bonus ? 1 : 0}`;
      const P = state.players[T.p];
      const phase = PHASES[state.phaseOrder[T.k]];
      html = `<div class="to-card pl-${P.color}"><img src="${IMG}${MASCOT[T.p]}.webp" alt=""><div><small>Round ${state.round} · ${phase.icon} ${phase.short}${T.bonus ? ' · bonus' : ''}</small><b>${esc(P.name)}’s turn</b></div></div>`;
    }
    if (!key || key === lastTurnKey) return;
    lastTurnKey = key;
    if (!animOn || reduceMotion.matches) return;
    document.querySelectorAll('.turn-ov').forEach((x) => x.remove());
    const ov = document.createElement('div');
    ov.className = 'turn-ov';
    ov.innerHTML = tokify(html);
    document.body.appendChild(ov);
    setTimeout(() => ov.remove(), 1500);
  }

  // ---------------------------------------------------------------- rendering: cards
  function statBox(label, value, help) {
    return `<div class="dc-stat" title="${help}"><b>${value}</b><small>${label}</small></div>`;
  }

  function cardHtml(sp, opts) {
    const o = opts || {};
    const S = SPECIES[sp];
    return `<div class="dcard t-${S.type} ${o.cls || ''}" ${o.attrs || ''} title="${esc(S.name)}">
      ${o.tag ? `<span class="dc-tag">${o.tag}</span>` : ''}
      <div class="dc-head"><div class="dc-name ${S.name.length > 11 && S.name.length <= 15 ? 'long' : ''}">${esc(S.name.length > 15 ? spName(sp) : S.name)}</div><div class="dc-pts" title="Points">${S.pts}</div></div>
      <div class="dc-art" style="--sc:${S.color}"><img src="${IMG}${sp}.webp" alt="" draggable="false">${o.lock ? `<span class="dc-lock">🔒 ${o.lock}</span>` : ''}</div>
      <div class="dc-price"><small>Cost</small><b>${costText(S.cost)}</b></div>
      <div class="dc-facts">${statBox('space', `⬛${S.space}`, 'Squares it takes up')}${statBox('eats', foodText(S.food).replace(' ', ''), 'Food it eats every Feeding')}${statBox('earns', `🪙${S.prod}`, 'Coins it adds in Production')}</div>
      <div class="dc-ab"><span class="dc-type">${TYPE_LABEL[S.type]}</span>${esc(S.ability)}</div>
      ${o.foot || ''}
    </div>`;
  }

  function miniCard(sp, attrs, cls) {
    if (!sp) return '<div class="mini empty">empty</div>';
    const S = SPECIES[sp];
    const title = `${S.name} · ${TYPE_LABEL[S.type]}: ${S.ability}`;
    return `<div class="mini t-${S.type} ${attrs ? 'pick' : ''} ${cls || ''}" ${attrs || ''} title="${esc(title)}">
      <div class="ma" style="--sc:${S.color}"><img src="${IMG}${sp}.webp" alt="" draggable="false"><span class="mp">${S.pts}</span></div>
      <div class="mn">${esc(spName(sp))}</div>
      <div class="ms">${costText(S.cost)}</div>
    </div>`;
  }

  // ---------------------------------------------------------------- rendering: board
  function pieceName(it) {
    if (it.kind === 'dino') return `${it.dead ? 'Fossil of ' : ''}${SPECIES[it.species].name}`;
    return it.kind === 'feeder' ? 'Feeder' : 'Watering hole';
  }

  function openPiece(p, id) {
    const P = state.players[p];
    const b = P.board;
    const it = b.items[id];
    if (!it) return;
    const an = analyze(b);
    const cp = an.comps[an.compOf[it.cells[0]]];
    const encl = cp.name ? `Enclosure ${cp.name}` : 'This area';
    let status;
    if (cp.dead) status = '<span class="status-pill dead">💀 Extinct</span> These dinos died. Nothing new can live here.';
    else if (!cp.valid) status = '<span class="status-pill warn">Not fenced in</span>';
    else if (cp.inactive) status = `<span class="status-pill ${cp.inactive >= 4 ? 'danger' : 'warn'}">💤 Inactive · marker ${cp.inactive}/4</span> No coins or points until every dino here is fed.${cp.inactive >= 4 ? ' <b>If not fed next Feeding, they die!</b>' : ''}`;
    else status = '<span class="status-pill ok">Active</span> Earning coins and points.';
    const facts = [`<li><b>${encl}</b> · ${status}</li>`];
    let card = '';
    if (it.kind === 'dino') {
      const S = SPECIES[it.species];
      card = cardHtml(it.species, { cls: 'solo' });
      if (!it.dead) {
        const eats = S.food.n + (cp.inactive || 0);
        const why = cp.inactive ? ` <span class="muted">(card says ${S.food.n}; +${cp.inactive} because it’s inactive)</span>` : '';
        facts.push(`<li>Eats <b>${eats} ${foodText({ t: S.food.t, n: '' }).trim()}</b> each Feeding${why}.</li>`);
        if (cp.feederSquares) facts.push(`<li>The feeder here takes <b>${cp.feederSquares} food</b> off the whole enclosure’s bill.</li>`);
        facts.push(`<li>Adds <b>🪙${S.prod}</b> when you pick ${encl.replace('Enclosure', 'enclosure')} in Production (whole enclosure makes 🪙${cp.prod}).</li>`);
        facts.push(`<li>Worth <b>${S.pts} point${S.pts === 1 ? '' : 's'}</b> at the end if active.</li>`);
        facts.push(`<li><b>${TYPE_LABEL[S.type]}:</b> ${TYPE_HELP[S.type]}</li>`);
      }
    } else if (it.kind === 'feeder') {
      card = `<div class="piece-art">🌾</div>`;
      facts.push(`<li>${plural(it.cells.length, 'square')}: ${encl.toLowerCase()} needs <b>${it.cells.length} less</b> food in total each Feeding.</li>`);
    } else {
      card = `<div class="piece-art">💧</div>`;
      facts.push(`<li>Lets ${encl.toLowerCase()} hold <b>one more species</b> (now ${cp.species.size} of ${1 + cp.waters.length} allowed).</li>`);
    }
    const living = cp.dinos.length ? `<li>Living here: ${dinoSummary(cp, true) || 'none'}</li>` : '';
    openModal(`<div class="modal-head"><h2>${esc(P.name)}’s ${esc(pieceName(it))}</h2><button class="x" data-act="closeModal" aria-label="Close">✕</button></div>
      <div class="piece-info">${card}<ul class="facts">${facts.join('')}${living}</ul></div>`, 'medium');
  }

  function tokenSpot(it, X, Y) {
    const set = new Set(it.cells);
    const cx = it.cells.reduce((s, i) => s + (i % N), 0) / it.cells.length;
    const cy = it.cells.reduce((s, i) => s + Math.floor(i / N), 0) / it.cells.length;
    let best = null;
    let bd = Infinity;
    it.cells.forEach((i) => {
      const r = Math.floor(i / N);
      const c = i % N;
      if (c < N - 1 && r < N - 1 && set.has(i + 1) && set.has(i + N) && set.has(i + N + 1)) {
        const d = (c + 0.5 - cx) ** 2 + (r + 0.5 - cy) ** 2;
        if (d < bd) {
          bd = d;
          best = { x: X(c) + CS, y: Y(r) + CS, r: 31 };
        }
      }
    });
    if (best) return best;
    let anchor = it.cells[0];
    it.cells.forEach((i) => {
      const d = (i % N - cx) ** 2 + (Math.floor(i / N) - cy) ** 2;
      if (d < bd) {
        bd = d;
        anchor = i;
      }
    });
    return { x: X(anchor % N) + CS / 2, y: Y(Math.floor(anchor / N)) + CS / 2, r: 15 };
  }

  function boardSvg(p) {
    const P = state.players[p];
    const b = P.board;
    const sel = ui.sel && ui.sel.board === p ? ui.sel : null;
    const pending = sel && sel.type === 'edges' ? sel.edges : null;
    const vb = pending && pending.size ? withEdges(b, pending) : b;
    const an = analyze(vb);
    const out = [];
    const X = (c) => PAD + c * CS;
    const Y = (r) => PAD + r * CS;

    out.push(`<defs>
      <linearGradient id="wd${p}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9a6634"/><stop offset=".45" stop-color="#744521"/><stop offset="1" stop-color="#4e2c12"/></linearGradient>
      <pattern id="gr${p}" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M7 31l2-7 2 7M25 15l2-6 2 6M31 37l1.5-5 1.5 5M15 9l1.2-4 1.2 4" stroke="rgba(28,70,18,.28)" stroke-width="1.3" fill="none" stroke-linecap="round"/></pattern>
      <clipPath id="rc${p}" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5"/></clipPath>
      <pattern id="zz${p}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="10" fill="rgba(20,30,70,.18)"/></pattern>
      <filter id="sh${p}" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.1" flood-color="#1a0d02" flood-opacity=".45"/></filter>
    </defs>`);
    out.push(`<rect x="0" y="0" width="${W}" height="${W}" rx="12" fill="url(#wd${p})" class="b-bg"/>`);

    const firstSel = sel && sel.type === 'cells' && sel.purpose !== 'rubble' && sel.cells.size ? sel.cells.values().next().value : null;
    const selComp = firstSel !== null ? an.comps[an.compOf[firstSel]] : null;

    // cells
    out.push('<g class="cells">');
    for (let i = 0; i < 100; i++) {
      const r = Math.floor(i / N);
      const c = i % N;
      const cp = an.comps[an.compOf[i]];
      let fill;
      if (cp.valid) {
        const nameIdx = cp.name ? cp.name.charCodeAt(0) - 65 : an.compOf[i] + 3;
        fill = ENCLOSURE_TINTS[((nameIdx % ENCLOSURE_TINTS.length) + ENCLOSURE_TINTS.length) % ENCLOSURE_TINTS.length];
        if (cp.dead) fill = '#b9b3a6';
        else if (cp.inactive) fill = cp.inactive >= 4 ? '#c98a80' : '#8f9dbd';
      } else {
        fill = (r + c) % 2 ? '#5f9e3f' : '#67a846';
      }
      let cls = 'cell';
      if (sel && sel.type === 'cells' && b.cells[i] === 0 && (sel.purpose === 'rubble' || (cp.valid && !cp.dead && (!selComp || selComp === cp)))) cls += ' can';
      if (sel && sel.type === 'cells' && sel.cells.has(i)) cls += ' sel';
      const it = b.cells[i] > 0 ? b.items[b.cells[i]] : null;
      const tip = it ? `<title>${esc(pieceName(it))} — tap for details</title>` : '';
      if (it) cls += ' has';
      out.push(`<rect class="${cls}" data-cell="${i}" data-p="${p}" x="${X(c)}" y="${Y(r)}" width="${CS}" height="${CS}" fill="${fill}">${tip}</rect>`);
    }
    out.push('</g>');

    // grid lines
    let grid = '';
    for (let k = 1; k < N; k++) {
      grid += `M${X(k)} ${Y(0)}V${Y(N)}M${X(0)} ${Y(k)}H${X(N)}`;
    }
    out.push(`<path d="${grid}" stroke="rgba(0,0,0,0.1)" stroke-width="1" fill="none" pointer-events="none"/>`);
    out.push(`<rect x="${PAD}" y="${PAD}" width="${N * CS}" height="${N * CS}" fill="url(#gr${p})" pointer-events="none"/>`);
    an.comps.forEach((cp) => {
      if (!cp.valid || cp.dead || !cp.inactive) return;
      out.push(cp.cells.map((i) => `<rect x="${X(i % N)}" y="${Y(Math.floor(i / N))}" width="${CS}" height="${CS}" fill="url(#zz${p})" pointer-events="none"/>`).join(''));
    });

    // pieces
    out.push(`<g class="item" filter="url(#sh${p})">`);
    Object.values(b.items).forEach((it) => {
      let col;
      if (it.kind === 'dino') col = it.dead ? '#9a9489' : SPECIES[it.species].color;
      else if (it.kind === 'feeder') col = '#d9b066';
      else col = '#5cc6ef';
      const set = new Set(it.cells);
      const fresh = isFresh(`b${p}:i${it.id}${it.dead ? 'd' : ''}`, 900);
      const itComp = an.comps[an.compOf[it.cells[0]]];
      const inactive = itComp && itComp.valid && !itComp.dead && itComp.inactive;
      const g = [];
      it.cells.forEach((i) => {
        const r = Math.floor(i / N);
        const c = i % N;
        g.push(`<rect x="${X(c) + 3}" y="${Y(r) + 3}" width="${CS - 6}" height="${CS - 6}" rx="8" fill="${col}"/>`);
        if (c < N - 1 && set.has(i + 1)) g.push(`<rect x="${X(c) + CS - 9}" y="${Y(r) + 3}" width="18" height="${CS - 6}" fill="${col}"/>`);
        if (r < N - 1 && set.has(i + N)) g.push(`<rect x="${X(c) + 3}" y="${Y(r) + CS - 9}" width="${CS - 6}" height="18" fill="${col}"/>`);
        if (c < N - 1 && r < N - 1 && set.has(i + 1) && set.has(i + N) && set.has(i + N + 1)) {
          g.push(`<rect x="${X(c) + CS - 9}" y="${Y(r) + CS - 9}" width="18" height="18" fill="${col}"/>`);
        }
        if (it.kind === 'water') {
          g.push(`<path d="M${X(c) + 9} ${Y(r) + 27}q5 -5 10 0t10 0" stroke="rgba(255,255,255,0.55)" stroke-width="2" fill="none"/>`);
        } else if (it.kind === 'feeder') {
          g.push(`<path d="M${X(c) + 10} ${Y(r) + 30}l4 -12M${X(c) + 19} ${Y(r) + 31}l1 -14M${X(c) + 28} ${Y(r) + 30}l-3 -11" stroke="rgba(120,80,20,0.45)" stroke-width="2" stroke-linecap="round"/>`);
        }
      });
      const spot = tokenSpot(it, X, Y);
      const R = spot.r;
      if (it.kind === 'dino' && !it.dead) {
        g.push(`<circle cx="${spot.x}" cy="${spot.y}" r="${R + 2.5}" fill="#fffaf0" stroke="rgba(0,0,0,.35)" stroke-width="1"/>`);
        g.push(`<image href="${IMG}${it.species}.webp" x="${spot.x - R}" y="${spot.y - R}" width="${2 * R}" height="${2 * R}" clip-path="url(#rc${p})" preserveAspectRatio="xMidYMid slice"/>`);
      } else {
        const img = it.kind === 'dino' ? 'fossil' : it.kind;
        const s = R * 2.3;
        g.push(`<image href="${IMG}${img}.webp" x="${spot.x - s / 2}" y="${spot.y - s / 2}" width="${s}" height="${s}"/>`);
      }
      out.push(`<g class="piece${fresh ? ' drop' : ''}${inactive ? ' zz' : ''}">${g.join('')}</g>`);
    });
    for (let i = 0; i < 100; i++) {
      if (b.cells[i] !== -1) continue;
      const r = Math.floor(i / N);
      const c = i % N;
      const fresh = isFresh(`b${p}:r${i}`, 900);
      out.push(`<g class="piece${fresh ? ' drop' : ''}"><rect x="${X(c) + 2}" y="${Y(r) + 2}" width="${CS - 4}" height="${CS - 4}" rx="6" fill="#857a69"/><image href="${IMG}rubble.webp" x="${X(c) + 3}" y="${Y(r) + 3}" width="${CS - 6}" height="${CS - 6}"/></g>`);
    }
    out.push('</g>');

    // fences
    const fence = (x1, y1, x2, y2, fresh) => `<g class="fence${fresh ? ' new' : ''}">`
      + `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3a210b" stroke-width="7" stroke-linecap="round"/>`
      + `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#a8692f" stroke-width="4" stroke-linecap="round"/>`
      + `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e0a868" stroke-width="1.2" stroke-linecap="round"/></g>`;
    const edgeLine = (e) => {
      const k = e[0];
      const i = +e.slice(1);
      if (k === 'h') {
        const r = Math.floor(i / N);
        const c = i % N;
        return [X(c), Y(r + 1), X(c + 1), Y(r + 1)];
      }
      const r = Math.floor(i / 9);
      const c = i % 9;
      return [X(c + 1), Y(r), X(c + 1), Y(r + 1)];
    };
    out.push('<g class="fences">');
    out.push(`<rect x="${PAD}" y="${PAD}" width="${N * CS}" height="${N * CS}" rx="3" fill="none" stroke="#2e1a08" stroke-width="5"/>`);
    const posts = new Set();
    for (let i = 0; i < 90; i++) {
      ['h', 'v'].forEach((k) => {
        if (!b[k][i]) return;
        const e = k + i;
        const [x1, y1, x2, y2] = edgeLine(e);
        posts.add(`${x1},${y1}`);
        posts.add(`${x2},${y2}`);
        out.push(fence(x1, y1, x2, y2, isFresh(`b${p}:${e}`, 700)));
      });
    }
    posts.forEach((pt) => {
      const [x, y] = pt.split(',');
      out.push(`<circle cx="${x}" cy="${y}" r="4.2" fill="#6b3f19" stroke="#2e1a08" stroke-width="1.4"/>`);
    });
    out.push('</g>');

    // badges
    out.push('<g class="badges">');
    an.comps.forEach((cp) => {
      if (!cp.name) return;
      const r = Math.floor(cp.key / N);
      const c = cp.key % N;
      out.push(`<circle cx="${X(c) + 10}" cy="${Y(r) + 10}" r="8.5" fill="#4a2a10" stroke="#f3d9a4" stroke-width="1.6"/>`);
      out.push(`<text x="${X(c) + 10}" y="${Y(r) + 13.5}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">${cp.name}</text>`);
      if (cp.dead) {
        out.push(`<image href="${IMG}fossil.webp" x="${X(c) + 18}" y="${Y(r) + 0}" width="22" height="22"/>`);
      } else if (cp.inactive) {
        const danger = cp.inactive >= 4;
        const rows = cp.cells.map((i) => Math.floor(i / N));
        const botR = Math.max(...rows);
        const bot = cp.cells.filter((i) => Math.floor(i / N) === botR).map((i) => i % N);
        const midC = bot[Math.floor(bot.length / 2)];
        const bw = 156;
        const cx = Math.min(Math.max(X(midC) + CS / 2, PAD + bw / 2 + 2), W - PAD - bw / 2 - 2);
        const cy = Y(botR) + CS - 17;
        out.push(`<g class="sleep-tok${danger ? ' danger' : ''}" pointer-events="none">`
          + `<rect x="${cx - bw / 2}" y="${cy - 14}" width="${bw}" height="28" rx="14" fill="${danger ? '#c62828' : '#22305a'}" stroke="#fff" stroke-width="2"/>`
          + `<image href="${IMG}sleep.webp" x="${cx - bw / 2 + 1}" y="${cy - 15}" width="30" height="30"/>`
          + `<text x="${cx + 14}" y="${cy + 5.5}" text-anchor="middle" font-size="15" font-weight="800" fill="#fff">${danger ? 'LAST CHANCE!' : `INACTIVE ${cp.inactive}/4`}</text></g>`);
      }
    });
    out.push('</g>');

    // pending + clickable edges
    if (sel && sel.type === 'edges') {
      const legal = legalEdges(p);
      out.push('<g class="edges">');
      legal.forEach((e) => {
        const [x1, y1, x2, y2] = edgeLine(e);
        const isPend = sel.edges.has(e);
        out.push(`<g class="edge${isPend ? ' pend' : ''}" data-act="edge" data-p="${p}" data-e="${e}"><line class="ev" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><line class="eh" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/></g>`);
      });
      out.push('</g>');
    }

    const label = `${esc(P.name)}’s park`;
    return `<svg class="board${sel ? ' selecting' : ''}" data-p="${p}" viewBox="0 0 ${W} ${W}" role="img" aria-label="${label}">${out.join('')}</svg>`;
  }

  // ---------------------------------------------------------------- rendering: shell
  function render() {
    const app = document.getElementById('app');
    if (!state) {
      renderSetup(app);
      animOn = true;
      return;
    }
    if (!document.getElementById('game-shell')) {
      app.innerHTML = tokify(`<div id="game-shell">
        <header class="topbar" id="top"></header>
        <main class="layout"><section class="boards" id="boards"></section><aside class="panel" id="panel"></aside></main>
        <footer class="legend"><details><summary>🗺️ Board key <span>· tap any dino to see its card</span></summary><div class="lg">${legendHtml()}</div></details></footer>
      </div>`);
    }
    renderTop();
    renderBoards();
    renderPanel();
    const T = cur();
    turnOverlay(T);
    if (pendingCard) {
      const pc = pendingCard;
      pendingCard = null;
      const deck = document.querySelector('.deck-back');
      const src = pc.from === 'deck' && deck ? deck.getBoundingClientRect() : lastClickRect;
      flyCard(src, document.querySelector(`[data-act="book"][data-p="${pc.p}"]`), pc.sp);
    }
    animOn = true;
    const focusP = ui.sel ? ui.sel.board : T && T.p !== undefined ? T.p : null;
    if (focusP !== null && focusP !== lastFocus && window.matchMedia('(max-width: 820px)').matches) {
      const el = document.querySelector(`[data-player="${focusP}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    lastFocus = focusP;
    if (T && T.t === 'gameOver' && !state.celebrated) {
      state.celebrated = true;
      save();
      confetti();
    }
    aiSchedule();
  }

  function legendHtml() {
    return [
      '<span><i class="sw" style="background:#67a846"></i>Open land</span>',
      '<span><i class="sw" style="background:#f3e5ab"></i>Enclosure</span>',
      '<span>🪵 Fence</span>',
      '<span>🌾 Feeder</span>',
      '<span>💧 Watering hole</span>',
      '<span>🪨 Blocked by opponent</span>',
      '<span>💤 Inactive (unfed)</span>',
      '<span>💀 Fossil</span>',
    ].join('');
  }

  function renderTop() {
    const el = document.getElementById('top');
    const T = cur();
    const k = T && T.k !== undefined ? T.k : -1;
    const over = T && T.t === 'gameOver';
    let pips = '';
    for (let r = 1; r <= ROUNDS; r++) {
      const cls = over || r < state.round ? 'done' : r === state.round ? 'cur' : '';
      pips += `<span class="pip ${cls}">${r}</span>`;
    }
    const phases = over
      ? ''
      : state.phaseOrder
        .map((ph, i) => {
          const cls = T && T.t === 'roundStart' ? '' : i < k ? 'done' : i === k ? 'cur' : '';
          return `<div class="pcard ph-${ph} ${cls}"><span class="pc-n">${i + 1}</span><span class="pc-i">${PHASES[ph].icon}</span><span class="pc-t">${PHASES[ph].short}</span></div>`;
        })
        .join('');
    const fresh = T && T.t === 'roundStart' ? ' fresh' : '';
    setHtml(el, `
      <div class="brand"><img class="brand-logo" src="${IMG}trex.webp" alt=""><div><h1>Dino Board Game</h1><small>Build the best dino park in 18 rounds</small></div></div>
      <div class="top-mid">
        <div class="tracker"><span class="tracker-label">Round</span>${pips}</div>
        <div class="phase-row${fresh}" data-round="${state.round}">${phases}</div>
      </div>
      <div class="top-actions">
        ${state.aiCfg ? `<button class="btn sm ghost" data-act="aiSettings" title="Computer settings">🤖 ${AI_LEVELS[state.aiCfg.level]} · ${AI_PACES[state.aiCfg.pace]}</button>` : ''}
        <button class="btn sm ghost" data-act="rules">📜 Rules</button>
        <button class="btn sm ghost" data-act="newGame">🥚 New game</button>
      </div>`);
  }

  function setHtml(el, html) {
    if (!el || el._html === html) return false;
    el._html = html;
    el.innerHTML = tokify(html);
    return true;
  }

  function chip(icon, val, title, key, fx) {
    const live = fx && performance.now() - fx.t < 1400;
    const cls = live ? ` bump ${fx.d > 0 ? 'up' : 'down'}` : '';
    const delta = live ? `<i class="delta">${fx.d > 0 ? '+' : ''}${fx.d}</i>` : '';
    return `<span class="chip${cls}" title="${esc(title)}"${key ? ` data-r="${key}"` : ''}>${icon} <b>${val}</b>${delta}</span>`;
  }

  function renderBoards() {
    const el = document.getElementById('boards');
    const T = cur();
    const activeP = T && T.p !== undefined ? T.p : -1;
    const target = ui.sel && ui.sel.board !== activeP ? ui.sel.board : -1;
    const now = performance.now();
    const snap = state.players.map((P) => {
      const o = {};
      RES.forEach(([k]) => { o[k] = P[k]; });
      o.triPlants = P.triPlants;
      return o;
    });
    const changes = [];
    if (prevRes && animOn) {
      snap.forEach((o, p) => {
        Object.keys(o).forEach((k) => {
          const d = o[k] - prevRes[p][k];
          if (d) {
            resFx[p][k] = { d, t: now };
            changes.push({ p, k, d });
          }
        });
      });
    }
    prevRes = snap;
    const over = cur() && cur().t === 'gameOver';
    const changed = setHtml(el, [0, 1]
      .map((p) => {
        const P = state.players[p];
        const bonus = P.bonusNext + P.bonusPending;
        const chips = RES.map(([k, img, label]) => chip(tok(img), P[k], label, k, resFx[p][k])).join('');
        return `<div class="player pl-${P.color}${p === activeP ? ' active' : ''}${p === target ? ' target' : ''}" data-player="${p}">
          <div class="p-head">
            <div class="p-name"><img class="p-mascot" src="${IMG}${MASCOT[p]}.webp" alt="">${esc(P.name)}${p === state.first ? ' <span class="tag">1st</span>' : ''}${p === activeP ? ' <span class="tag turn-tag">TURN</span>' : ''}${p === target ? ' <span class="tag target-tag">TARGET</span>' : ''}</div>
            ${over ? `<div class="p-score" title="Final score">⭐ ${scorePlayer(p).total}</div>` : ''}
          </div>
          <div class="res">
            ${chips}
            ${P.triPlants ? chip(`${dz('triceratops')}🌿`, P.triPlants, 'Plants on your Triceratops page', 'triPlants', resFx[p].triPlants) : ''}
            ${bonus ? chip('⏩', bonus, 'Gigantoraptor: do a phase twice next round') : ''}
          </div>
          <div class="board-wrap">${boardSvg(p)}</div>
          <div class="p-foot">
            <button class="btn sm ghost book-btn" data-act="book" data-p="${p}"><span class="book-ic"></span>Dino book · ${P.book.length}</button>
            ${P.blocked.length ? `<span class="blocked">🚫 Blocked: ${P.blocked.map((sp) => esc(spName(sp))).join(', ')}</span>` : ''}
          </div>
        </div>`;
      })
      .join(''));
    if (!changed || !changes.length) return;
    const chipEl = (p, k) => el.querySelector(`[data-player="${p}"] [data-r="${k}"]`);
    const panel = document.getElementById('panel');
    const fallback = panel ? panel.getBoundingClientRect() : null;
    changes.filter((c) => c.d > 0).forEach((c) => {
      const loser = changes.find((x) => x.p !== c.p && x.k === c.k && x.d < 0);
      const lostEl = loser && chipEl(loser.p, loser.k);
      const from = lostEl ? lostEl.getBoundingClientRect() : lastClickRect || fallback;
      const img = c.k === 'triPlants' ? 'plant' : RES.find((r) => r[0] === c.k)[1];
      flyTokens(from, chipEl(c.p, c.k), img, Math.min(c.d, 6));
    });
  }

  function renderPanel() {
    const el = document.getElementById('panel');
    if (!el) return;
    const T = cur();
    const scroll = el.querySelector('.panel-scroll');
    const top = scroll ? scroll.scrollTop : 0;
    const ai = isAiTask(T);
    const aiBar = ai ? `<div class="ai-bar"><img src="${IMG}${MASCOT[state.ai]}.webp" alt=""><span>🤖 ${esc(ui.aiNote || 'Computer is thinking')}<i class="dots3"><b></b><b></b><b></b></i></span></div>` : '';
    const changed = setHtml(el, `${bannerHtml(T)}<div class="panel-scroll">${aiBar}<div class="task${ai ? ' ai-run' : ''}">${taskHtml(T)}</div>${marketHtml(T)}${logHtml()}</div>`);
    const ns = el.querySelector('.panel-scroll');
    if (changed && ns && ui.keepScroll) ns.scrollTop = top;
    ui.keepScroll = false;
  }

  function bannerHtml(T) {
    if (!T) return '';
    if (T.t === 'gameOver') return '<div class="banner"><div class="b-who">🏁 Final scores</div><div class="b-phase">18 rounds complete</div></div>';
    if (T.p === undefined) {
      return `<div class="banner"><div class="b-who">Round ${state.round} of ${ROUNDS}</div><div class="b-phase">${T.t === 'roll' ? '🎲 Gain Food / Draw Fences' : 'Shuffle the phase cards'}</div></div>`;
    }
    const P = state.players[T.p];
    const phase = T.k !== undefined ? PHASES[state.phaseOrder[T.k]] : null;
    return `<div class="banner b-${P.color}"><div class="b-who">${esc(P.name)}’s turn</div><div class="b-phase">Round ${state.round} · ${phase ? `${phase.icon} ${phase.name}` : ''}${T.bonus ? ' · ⏩ bonus turn' : ''}</div></div>`;
  }

  function marketHtml(T) {
    const pickAny = T && ((T.t === 'actions' && ui.mode === 'draw') || (T.t === 'drawCard' && T.source === 'any'));
    const pickDeck = T && (pickAny || (T.t === 'drawCard' && T.source === 'deck'));
    const deckAttrs = pickDeck && state.deck.length ? 'data-act="take" data-from="deck"' : '';
    const faceUp = [0, 1]
      .map((i) => {
        const sp = state.faceUp[i];
        const deal = sp && isFresh(`m${i}:${sp}:${state.deck.length}`, 900) ? 'deal' : '';
        return miniCard(sp, pickAny && sp ? `data-act="take" data-from="${i}"` : '', deal);
      })
      .join('');
    const stack = Math.min(state.deck.length, 4);
    return `<div class="market">
      <div class="m-title">🃏 Card market</div>
      <div class="m-row">
        <div class="deck-back ${deckAttrs ? 'pick' : ''} ${state.deck.length ? '' : 'gone'}" ${deckAttrs} title="Top of the deck (face down)" style="--stack:${stack}">
          <img src="${IMG}coin.webp" alt=""><b>${state.deck.length}</b><small>deck</small>
        </div>
        ${faceUp}
      </div>
    </div>`;
  }

  function logHtml() {
    const items = state.log.slice(-6).reverse().map((l) => `<li><span class="lr">R${l.r}</span>${l.m}</li>`).join('');
    return `<div class="log"><h4>📜 What happened</h4><ul>${items}</ul></div>`;
  }

  function stepper(k, label, val, canDec, canInc) {
    return `<div class="stepper"><span class="st-l">${label}</span>
      <button data-act="step" data-k="${k}" data-d="-1" ${canDec ? '' : 'disabled'} aria-label="Less">−</button>
      <b>${val}</b>
      <button data-act="step" data-k="${k}" data-d="1" ${canInc ? '' : 'disabled'} aria-label="More">+</button></div>`;
  }

  function costChips(c) {
    if (!c.total) return '<span class="fc free">free</span>';
    return [
      c.meat ? `<span class="fc meat">🍖${c.meat}</span>` : '',
      c.plant ? `<span class="fc plant">🌿${c.plant}</span>` : '',
      c.flex ? `<span class="fc flex">🍖/🌿${c.flex}</span>` : '',
    ].join('');
  }

  // ---------------------------------------------------------------- rendering: task UIs
  function taskHtml(T) {
    if (!T) return '';
    switch (T.t) {
      case 'roundStart': return roundStartHtml();
      case 'roll': return rollHtml();
      case 'gainFood': return gainFoodHtml(T);
      case 'feed': return feedHtml(T);
      case 'produce': return produceHtml(T);
      case 'actions': return actionsHtml(T);
      case 'foodChoice': return foodChoiceHtml(T);
      case 'drawFences': return drawFencesHtml(T);
      case 'fillOpp': return fillOppHtml(T);
      case 'drawCard': return drawCardHtml(T);
      case 'spino': return spinoHtml(T);
      case 'trex': return trexHtml(T);
      case 'carno': return carnoHtml(T);
      case 'freePlay': return freePlayHtml(T);
      case 'steal': return stealHtml(T);
      case 'gameOver': return gameOverHtml();
      default: return `<p>Unknown step: ${esc(T.t)}</p>`;
    }
  }

  function roundStartHtml() {
    const list = state.phaseOrder
      .map((ph, i) => `<li><span class="po-n">${i + 1}</span><span class="po-i">${PHASES[ph].icon}</span><span class="po-t"><b>${PHASES[ph].name}</b><small>${PHASES[ph].desc}</small></span></li>`)
      .join('');
    let ready = true;
    const bonus = state.players
      .map((P, p) => {
        if (!P.bonusPending) return '';
        const picks = ui.picks[p] || [];
        if (picks.length < P.bonusPending) ready = false;
        if (p === state.ai) return `<div class="bonus-pick">⏩ ${pn(p)}’s Gigantoraptor: the computer will take <b>Actions</b> twice this round.</div>`;
        const btns = state.phaseOrder
          .map((ph) => {
            const n = picks.filter((x) => x === ph).length;
            return `<button class="btn sm ${n ? 'on' : ''}" data-act="pickDouble" data-p="${p}" data-ph="${ph}">${PHASES[ph].icon} ${PHASES[ph].short}${n > 1 ? ' ×' + n : ''}</button>`;
          })
          .join('');
        const skipped = picks.filter((x) => x === 'none').length;
        const skipBtn = `<button class="btn sm ghost ${skipped ? 'on' : ''}" data-act="pickDouble" data-p="${p}" data-ph="none">🚫 Don’t use${skipped > 1 ? ' ×' + skipped : ''}</button>`;
        return `<div class="bonus-pick"><div>⏩ ${pn(p)}’s Gigantoraptor: pick ${plural(P.bonusPending, 'phase')} to do twice this round.</div>
          <div class="btn-row">${btns}${skipBtn}</div>
          <div class="muted" style="margin-top:.4rem">${picks.length}/${P.bonusPending} chosen ${picks.length ? '<button class="link" data-act="clearDouble" data-p="' + p + '">reset</button>' : ''}</div></div>`;
      })
      .join('');
    return `<h2>Round ${state.round} of ${ROUNDS}</h2>
      <p>${pn(state.first)} goes first this round. Here’s the order:</p>
      <ol class="phase-order">${list}</ol>
      ${bonus}
      <button class="btn big" data-act="startRound" ${ready ? '' : 'disabled'}>Start round ▶</button>`;
  }

  function rollHtml() {
    return `<h3>🎲 Gain Food / Draw Fences</h3>
      <p><b>Both players</b> split the number rolled between food and fences.</p>
      <div class="die-wrap">${dieHtml(state.lastRoll || 6)}</div>
      <button class="btn big" data-act="roll">Roll the die</button>`;
  }

  function gainFoodHtml(T) {
    if (T.amount == null) {
      return `<h3>⏩ Bonus: Gain Food / Draw Fences</h3>
        <p>${pn(T.p)} takes this phase a second time (Gigantoraptor). Roll your own die!</p>
        <div class="die-wrap">${dieHtml(6)}</div>
        <button class="btn big" data-act="rollBonus">Roll bonus die</button>`;
    }
    const fences = ui.sel ? ui.sel.edges.size : 0;
    const used = ui.meat + ui.plant + fences;
    const left = T.amount - used;
    const slots = [];
    for (let i = 0; i < T.amount; i++) {
      let icon = '';
      if (i < ui.meat) icon = '🍖';
      else if (i < ui.meat + ui.plant) icon = '🌿';
      else if (i < used) icon = '🪵';
      slots.push(`<span class="slot ${icon ? 'full' : ''}">${icon}</span>`);
    }
    const canFence = legalEdges(T.p).length > 0;
    return `<div class="die-inline">${dieHtml(T.amount, true)}<div><b>Rolled ${T.amount}.</b><br><span class="muted">Split it between food and fences.</span></div></div>
      <div class="budget">${slots.join('')}</div>
      ${stepper('meat', '🍖 Meat', ui.meat, ui.meat > 0, left > 0)}
      ${stepper('plant', '🌿 Plants', ui.plant, ui.plant > 0, left > 0)}
      <div class="fence-line">🪵 Fences: <b>${fences}</b> <span class="muted">— ${canFence ? 'tap the dotted edges on your board' : 'no legal edges left'}</span></div>
      <div class="hint">Close off an area with fences to make an enclosure. The board edge can count for <b>up to 2 sides</b>.</div>
      <button class="btn big" data-act="confirmGain">${left > 0 ? `Confirm (${left} unused)` : 'Confirm'}</button>`;
  }

  function feedHtml(T) {
    const P = state.players[T.p];
    const an = analyze(P.board);
    const list = feedables(an);
    const selCosts = list.filter((cp) => ui.feed.has(cp.key)).map(enclosureCost);
    const tot = sumCosts(selCosts);
    const rows = list
      .map((cp) => {
        const c = enclosureCost(cp);
        const on = ui.feed.has(cp.key);
        const affordable = on || canPayFood(P, sumCosts(selCosts.concat([c])));
        let status;
        if (!cp.inactive) status = '<span class="status-pill ok">active</span>';
        else if (cp.inactive >= 4) status = `<span class="status-pill danger">💤 last chance!</span>`;
        else status = `<span class="status-pill warn">💤 inactive ${cp.inactive}/4</span>`;
        const extra = cp.inactive ? ` · +${cp.inactive} each` : '';
        const feeder = c.discount ? ` · feeder −${c.discount}` : '';
        return `<div class="erow ${on ? 'on' : ''} ${affordable ? '' : 'dis'}" data-act="feedToggle" data-key="${cp.key}">
          <span class="ebadge">${cp.name}</span>
          <span class="edinos">${dinoSummary(cp)}<small>${status}${extra}${feeder}</small></span>
          <span class="ecost">${costChips(c)}</span>
          <span class="echeck">${on ? '✔ feeding' : affordable ? 'tap to feed' : 'not enough food'}</span>
        </div>`;
      })
      .join('');
    const warns = [];
    list.forEach((cp) => {
      if (ui.feed.has(cp.key)) {
        if (cp.inactive) warns.push(`<div>✅ ${cp.name} will become active again.</div>`);
        return;
      }
      const placedNow = P.board.placedRound[cp.key] === state.round;
      if (!cp.inactive) warns.push(`<div>💤 ${cp.name} will go inactive.</div>`);
      else if (placedNow) warns.push(`<div>💤 ${cp.name} stays inactive.</div>`);
      else if (cp.inactive >= 4) warns.push(`<div>💀 ${cp.name}’s dinos will <b>die</b>!</div>`);
      else warns.push(`<div>💤 ${cp.name} marker moves to ${cp.inactive + 1}/4.</div>`);
    });
    return `<h3>🍖 Feed your dinos</h3>
      <p>Tap an enclosure to feed it. Unfed dinos go inactive.</p>
      <div class="pay-line">You have <span class="fc meat">🍖${P.meat}</span><span class="fc plant">🌿${P.plants}</span></div>
      ${rows}
      <div class="pay-line">Paying: ${tot.total ? costChips(tot) : '<span class="muted">nothing</span>'}</div>
      ${warns.length ? `<div class="warn-box">${warns.join('')}</div>` : ''}
      <button class="btn big" data-act="confirmFeed">Feed &amp; continue</button>`;
  }

  function produceHtml(T) {
    const list = producible(T.p);
    const best = Math.max(...list.map((cp) => cp.prod));
    const rows = list
      .map((cp) => `<button class="opt" data-act="produce" data-key="${cp.key}">
        <span class="ebadge">${cp.name}</span>
        <span class="o-t"><b>${dinoSummary(cp)}</b></span>
        <span class="fc flex" style="font-size:1rem">🪙 +${cp.prod}${cp.prod === best && list.length > 1 ? ' ⭐' : ''}</span></button>`)
      .join('');
    return `<h3>🪙 Production</h3><p>Pick <b>one active enclosure</b> and collect its coins.</p><div class="opt-list">${rows}</div>`;
  }

  function actionsHtml(T) {
    const P = state.players[T.p];
    const doneN = 2 - T.remaining;
    const dots = `<span class="dots"><i class="${doneN > 0 ? 'used' : ''}"></i><i class="${doneN > 1 ? 'used' : ''}"></i></span>`;
    const count = `<div class="act-count">Action ${doneN + 1} of 2 ${dots}</div>`;
    const head = `<div class="act-top">${count}</div>`;
    const backHead = (label) => `<div class="act-top">${backBtn('back', label)}${count}</div>`;

    if (ui.mode === 'play') return backHead(ui.species ? 'Other dinos' : 'Back') + playModeHtml(T, false);
    if (ui.mode === 'draw') {
      return `${backHead()}<h3>🃏 Draw a card</h3><p>Tap a card or the deck in the <b>card market</b> below.</p>`;
    }
    if (ui.mode === 'shop') return (ui.shopItem ? `<div class="act-top">${backBtn('shopBack', 'Shop')}${count}</div>` : backHead()) + shopHtml(P);
    if (ui.mode === 'dinoAction') {
      const opts = dinoActionOptions(T.p)
        .map((o) => {
          const desc = {
            triceratops: `Put 🌿 on your Triceratops page (now ${P.triPlants})`,
            velociraptor: `Steal up to ${2 * o.count} food`,
            allosaurus: 'Steal up to 🪙3',
            parasaurolophus: `Gain 🪙${2 * o.count}`,
          }[o.sp];
          return `<button class="opt" data-act="dinoAct" data-sp="${o.sp}" data-key="${o.key}"><span class="o-i">${dz(o.sp, 'big')}</span><span class="o-t"><b>${spName(o.sp)}${o.count > 1 ? ' ×' + o.count : ''} · enclosure ${o.name}</b><small>${desc}</small></span></button>`;
        })
        .join('');
      return `${backHead()}<h3>⚡ Use a dino power</h3><p>Use a dino power from an <b>active</b> enclosure.</p><div class="opt-list">${opts}</div>`;
    }
    if (ui.mode === 'fences2') {
      const n = ui.sel ? ui.sel.edges.size : 0;
      return `${backHead()}<h3>🪵 Build 2 fences</h3><p>Tap the dotted lines on your board.</p>
        <div class="fence-line">Fences selected: <b>${n}</b> / 2</div>
        <button class="btn big" data-act="confirmFences" ${n ? '' : 'disabled'}>Build fences</button>`;
    }

    const actOpts = dinoActionOptions(T.p);
    const plays = playOptions(T.p, false);
    const playWhy = plays.length && plays.every((o) => o.why === plays[0].why) ? plays[0].why : 'None you can play';
    const tiles = [
      { m: 'play', i: dz(MASCOT[T.p], 'big'), t: 'Play a dino', s: 'Pay & place one', ok: plays.some((o) => o.ok), why: plays.length ? playWhy : 'Your book is empty' },
      { m: 'draw', i: '<span class="mini-back"></span>', t: 'Draw a card', s: 'Add one to your book', ok: state.faceUp.length + state.deck.length > 0, why: 'No cards left' },
      { m: 'shop', i: '💎', t: 'Shop', s: 'Diamond, feeder, water', ok: canShop(P), why: 'Not enough coins' },
      { m: 'dinoAction', i: '⚡', t: 'Dino power', s: `${actOpts.length} ready`, ok: actOpts.length > 0, why: 'No active power dinos' },
      { m: 'gain3', i: '🪙', t: 'Take 3 coins', s: 'Always works', ok: true },
      { m: 'fences2', i: '🪵', t: 'Build 2 fences', s: 'Grow your land', ok: legalEdges(T.p).length > 0, why: 'No room for fences' },
    ]
      .map((x, n) => `<button class="tile" style="--n:${n}" data-act="mode" data-m="${x.m}" ${x.ok ? '' : 'disabled'}><span class="t-i">${x.i}</span><span class="t-t">${x.t}</span><span class="t-s">${x.ok ? x.s : `🔒 ${x.why}`}</span></button>`)
      .join('');
    return `${head}<p class="muted" style="margin-top:0">Pick two. The same one twice is fine.</p>
      <div class="tiles">${tiles}</div>
      <button class="btn ghost big" data-act="endTurn">Skip remaining action${T.remaining > 1 ? 's' : ''}</button>`;
  }

  function placementBox(title) {
    const s = ui.sel;
    const v = validateSel();
    const n = s.cells.size;
    return `<div class="place-box">
      <div class="pb-title">${title}</div>
      <div class="pb-count">Selected <b>${n}</b>${s.need ? ` / ${s.need}` : ''} square${n === 1 && !s.need ? '' : 's'}</div>
      <div class="pb-msg ${v.ok ? 'ok' : 'bad'}">${v.msg}</div>
      <div class="muted" style="margin-top:.4rem">Drag across squares to select. Tap one again to remove it.</div>
    </div>`;
  }

  function playModeHtml(T, free) {
    if (!ui.species) {
      const opts = playOptions(T.p, free);
      const card = (o) => cardHtml(o.sp, {
        cls: `${o.ok ? 'pick' : 'nope'} ${o.why === 'Blocked by T. Rex' ? 'blockedc' : ''}`,
        attrs: o.ok ? `data-act="pickSpecies" data-sp="${o.sp}"` : '',
        tag: state.players[T.p].cards.includes(o.sp) ? 'card' : '',
        lock: o.ok ? '' : o.why,
      });
      const can = opts.filter((o) => o.ok);
      const cant = opts.filter((o) => !o.ok);
      const cards = (can.length ? can.map(card).join('') : '<p class="grid-note">Nothing you can play right now.</p>')
        + (cant.length ? `<div class="grid-split">🔒 Not right now</div>${cant.map(card).join('')}` : '');
      return `<h3>${free ? '🎁 Pick a free dino (≤ 5 points)' : '🦖 Choose a dino to play'}</h3>
        <div class="card-grid">${cards}</div>
        ${free ? '<button class="btn ghost" data-act="skip">Skip free dino</button>' : ''}`;
    }
    const S = SPECIES[ui.species];
    const v = validateSel();
    return `<div class="place-head">${dz(ui.species, 'big')}<h3>Place ${esc(S.name)}${free ? ' (free!)' : ` · ${costText(S.cost)}`}</h3></div>
      ${placementBox(`Select ${S.space} connected square${S.space > 1 ? 's' : ''} inside one enclosure`)}
      <button class="btn big" data-act="place" ${v.ok ? '' : 'disabled'}>Place ${esc(spName(ui.species))}</button>
`;
  }

  function shopHtml(P) {
    if (ui.shopItem) {
      const isFeeder = ui.shopItem === 'feeder';
      const n = ui.sel.cells.size;
      const cost = isFeeder ? feederCost(Math.max(1, n)) : WATER_COST;
      const v = validateSel();
      return `<h3>${isFeeder ? '🌾 Place a feeder' : '💧 Place a watering hole'} · ${costText(cost)}</h3>
        ${placementBox(isFeeder ? 'Select any number of connected squares in one enclosure' : 'Select 6 connected squares in one enclosure')}
        ${isFeeder ? '<p class="muted">Each square takes 1 food off that enclosure’s total each Feeding. Over 5 squares costs +🪙2 each.</p>' : '<p class="muted">Lets one additional dino species share this enclosure.</p>'}
        <button class="btn big" data-act="place" ${v.ok ? '' : 'disabled'}>Buy &amp; place</button>
`;
    }
    return `<h3>🛒 Shop</h3>
      <div class="opt-list">
        <button class="opt" data-act="buyDiamond" ${canAfford(P, DIAMOND_COST) ? '' : 'disabled'}><span class="o-i">💎</span><span class="o-t"><b>Diamond · 🪙6</b><small>Worth 3 points at the end. Some dinos cost diamonds.</small></span></button>
        <button class="opt" data-act="shopItem" data-item="feeder" ${canAfford(P, feederCost(1)) ? '' : 'disabled'}><span class="o-i">🌾</span><span class="o-t"><b>Feeder · 💎1 + 🪙3</b><small>Each square = 1 less food for that enclosure.</small></span></button>
        <button class="opt" data-act="shopItem" data-item="water" ${canAfford(P, WATER_COST) ? '' : 'disabled'}><span class="o-i">💧</span><span class="o-t"><b>Watering hole · 💎2 + 🪙4</b><small>Takes 6 squares. One more kind of dino can live there.</small></span></button>
      </div>`;
  }

  function foodChoiceHtml(T) {
    const plant = T.amount - ui.meat;
    return `<h3>${esc(T.title)}</h3>
      <p>Choose how to split <b>${T.amount}</b> food.</p>
      ${stepper('meat', '🍖 Meat', ui.meat, ui.meat > 0, ui.meat < T.amount)}
      <div class="stepper"><span class="st-l">🌿 Plants</span><b>${plant}</b></div>
      <div class="btn-row">
        <button class="btn sm ghost" data-act="foodQuick" data-v="all">All 🍖</button>
        <button class="btn sm ghost" data-act="foodQuick" data-v="half">Half &amp; half</button>
        <button class="btn sm ghost" data-act="foodQuick" data-v="none">All 🌿</button>
      </div>
      <button class="btn big" data-act="confirmFood">Take ${ui.meat} 🍖 + ${plant} 🌿</button>`;
  }

  function drawFencesHtml(T) {
    const n = ui.sel ? ui.sel.edges.size : 0;
    return `<h3>${esc(T.title)}</h3>
      <p>Tap dotted edges on your board (tap again to undo).</p>
      <div class="fence-line">Fences selected: <b>${n}</b> / ${T.count}</div>
      <button class="btn big" data-act="confirmFences">${n < T.count ? `Done (${T.count - n} unused)` : 'Build fences'}</button>`;
  }

  function fillOppHtml(T) {
    const O = state.players[other(T.p)];
    const s = ui.sel;
    const v = validateSel();
    return `<h3>${esc(T.title)}</h3>
      <p>Tap <b>${esc(O.name)}’s</b> board (glowing orange) to fill in ${plural(s.need, 'empty square')}. Filled squares can’t be used for anything.</p>
      <div class="place-box"><div class="pb-count">Selected <b>${s.cells.size}</b> / ${s.need}</div><div class="pb-msg ${v.ok ? 'ok' : 'bad'}">${v.msg}</div></div>
      <button class="btn big lava" data-act="place" ${v.ok ? '' : 'disabled'}>Fill in squares</button>`;
  }

  function drawCardHtml(T) {
    return `<h3>${esc(T.title || 'Draw a card')}</h3>
      <p>${T.source === 'deck' ? 'Draw the top card of the deck.' : 'Tap a face-up card or the deck in the card market below.'}</p>`;
  }

  function spinoHtml() {
    return `<h3>🦖 Spinosaurus event</h3>
      <p>Choose one reward. Afterwards you draw the top card of the deck${state.deck.length ? '' : ' (the deck is empty)'}.</p>
      <div class="opt-list">
        <button class="opt" data-act="spino" data-o="dia"><span class="o-i">💎</span><span class="o-t"><b>Gain 1 diamond</b></span></button>
        <button class="opt" data-act="spino" data-o="coins"><span class="o-i">🪙</span><span class="o-t"><b>Gain 5 coins</b></span></button>
        <button class="opt" data-act="spino" data-o="food"><span class="o-i">🍖</span><span class="o-t"><b>Gain 15 food</b><small>Any mix of meat and plants</small></span></button>
        <button class="opt" data-act="spino" data-o="fill" ${emptyCount(other(cur().p)) ? '' : 'disabled'}><span class="o-i">🪨</span><span class="o-t"><b>Fill 10 squares in your opponent’s park</b></span></button>
      </div>`;
  }

  function trexHtml(T) {
    const O = state.players[other(T.p)];
    const opts = trexOptions(T.p)
      .map((sp) => `<button class="opt" data-act="trex" data-sp="${sp}"><span class="o-i">${dz(sp, 'big')}</span><span class="o-t"><b>${esc(SPECIES[sp].name)}</b><small>${costText(SPECIES[sp].cost)} · ⬛${SPECIES[sp].space} · ${SPECIES[sp].pts} pts${O.cards.includes(sp) ? ' · drawn card' : ''}</small></span></button>`)
      .join('');
    return `<h3>🦖 T. Rex roars!</h3><p>Choose a dino from <b>${esc(O.name)}’s</b> book or cards. They can’t place any more of it.</p><div class="opt-list">${opts}</div>`;
  }

  function carnoHtml() {
    return `<h3>🦖 Carnotaurus event</h3><p>Roll a die — you gain <b>4×</b> that much food.</p>
      <div class="die-wrap">${dieHtml(6)}</div>
      <button class="btn big" data-act="carnoRoll">Roll the die</button>`;
  }

  function freePlayHtml(T) {
    return (ui.species ? `<div class="act-top">${backBtn('back', 'Other dinos')}</div>` : '') + playModeHtml(T, true);
  }

  function backBtn(act, label) {
    return `<button class="btn ghost sm back-btn" data-act="${act}">← ${label || 'Back'}</button>`;
  }

  function stealHtml(T) {
    const O = state.players[other(T.p)];
    const [lo, hi] = stealRange(T);
    const plant = T.amount - ui.meat;
    return `<h3>🦖 Velociraptor raid</h3>
      <p>Steal <b>${T.amount}</b> food from ${pn(other(T.p))} (they have 🍖${O.meat} 🌿${O.plants}).</p>
      ${stepper('meat', '🍖 Meat', ui.meat, ui.meat > lo, ui.meat < hi)}
      <div class="stepper"><span class="st-l">🌿 Plants</span><b>${plant}</b></div>
      <button class="btn big" data-act="confirmSteal">Steal ${ui.meat} 🍖 + ${plant} 🌿</button>`;
  }

  function gameOverHtml() {
    const s = [scorePlayer(0), scorePlayer(1)];
    const P = state.players;
    const row = (label, k) => `<tr><td>${label}</td><td>${s[0][k]}</td><td>${s[1][k]}</td></tr>`;
    let winner;
    if (s[0].total === s[1].total) winner = '<span class="big">🤝</span>It’s a tie!';
    else {
      const w = s[0].total > s[1].total ? 0 : 1;
      winner = `<img class="big win-dino" src="${IMG}${MASCOT[w]}.webp" alt="">${pn(w)} wins!`;
    }
    return `<div class="winner">${winner}</div>
      <table class="scoreboard">
        <thead><tr><th></th><th>${pn(0)}</th><th>${pn(1)}</th></tr></thead>
        <tbody>
          ${row('🦖 Dino points', 'dinoPts')}
          ${row('🦎 Compy adjacency', 'compy')}
          ${row('🦕 Pachy coins', 'pachy')}
          ${row('🦖 Microraptor enclosures', 'micro')}
          ${row('🌿 Triceratops plants', 'tri')}
          ${row('💎 Diamonds (×3)', 'diamonds')}
        </tbody>
        <tfoot><tr><td>Total</td><td>${s[0].total}</td><td>${s[1].total}</td></tr></tfoot>
      </table>
      <p class="muted">Dinos in inactive or extinct enclosures score nothing. Leftover coins: ${esc(P[0].name)} 🪙${P[0].coins}, ${esc(P[1].name)} 🪙${P[1].coins}.</p>
      <button class="btn big" data-act="newGame">🥚 Play again</button>`;
  }

  // ---------------------------------------------------------------- selection validation
  function validateSel() {
    const s = ui.sel;
    if (!s || s.type !== 'cells') return { ok: false, msg: '' };
    const cells = [...s.cells];
    const P = state.players[s.board];
    if (s.purpose === 'rubble') {
      if (cells.length < s.need) return { ok: false, msg: `Pick ${s.need - cells.length} more.` };
      return { ok: true, msg: 'Ready to fill ✔' };
    }
    if (s.purpose === 'dino') {
      return validatePlacement(s.board, cells, { kind: 'dino', species: s.species, size: SPECIES[s.species].space });
    }
    if (s.purpose === 'feeder') {
      const v = validatePlacement(s.board, cells, { kind: 'feeder' });
      if (!v.ok) return v;
      const cost = feederCost(cells.length);
      if (!canAfford(P, cost)) return { ok: false, msg: `A ${cells.length}-square feeder costs ${costText(cost)} — too expensive.` };
      return { ok: true, msg: `${cells.length}-square feeder for ${costText(cost)} ✔` };
    }
    if (s.purpose === 'water') {
      const v = validatePlacement(s.board, cells, { kind: 'water', size: 6 });
      if (!v.ok) return v;
      if (!canAfford(P, WATER_COST)) return { ok: false, msg: 'You can’t afford a watering hole.' };
      return v;
    }
    return { ok: false, msg: '' };
  }

  function selectableCells(s) {
    const b = state.players[s.board].board;
    const out = new Set();
    if (s.purpose === 'rubble') {
      for (let i = 0; i < 100; i++) if (b.cells[i] === 0) out.add(i);
      return out;
    }
    const an = analyze(b);
    const first = s.cells.size ? s.cells.values().next().value : null;
    const only = first !== null ? an.compOf[first] : null;
    for (let i = 0; i < 100; i++) {
      const cp = an.comps[an.compOf[i]];
      if (b.cells[i] === 0 && cp.valid && !cp.dead && (only === null || an.compOf[i] === only)) out.add(i);
    }
    return out;
  }

  function applyCell(i, adding, first) {
    const s = ui.sel;
    if (!s || s.type !== 'cells') return;
    if (adding) {
      if (s.cells.has(i)) return;
      if (!selectableCells(s).has(i)) {
        if (first) toast(s.cells.size ? 'Keep all squares inside the same enclosure.' : 'Pick squares inside a fenced enclosure (touching at most 2 board sides).', 'bad');
        return;
      }
      if (s.need && s.cells.size >= s.need) {
        if (first) toast(`Already ${s.need} selected — tap one to remove it.`);
        return;
      }
      s.cells.add(i);
    } else {
      if (!s.cells.has(i)) return;
      s.cells.delete(i);
    }
    const can = selectableCells(s);
    document.querySelectorAll(`.board[data-p="${s.board}"] [data-cell]`).forEach((el) => {
      const k = +el.dataset.cell;
      el.classList.toggle('sel', s.cells.has(k));
      el.classList.toggle('can', can.has(k));
    });
    const boards = document.getElementById('boards');
    if (boards) boards._html = null;
    ui.keepScroll = true;
    renderPanel();
  }

  function edgeMax() {
    const T = cur();
    if (!T) return 0;
    if (T.t === 'gainFood') return (T.amount || 0) - ui.meat - ui.plant;
    if (T.t === 'drawFences') return T.count;
    if (T.t === 'actions' && ui.mode === 'fences2') return 2;
    return 0;
  }

  // ---------------------------------------------------------------- setup screen
  function renderSetup(app) {
    const floaters = ['coin', 'diamond', 'meat', 'plant', 'coin', 'fence', 'water', 'diamond']
      .map((t, i) => `<img class="floater f${i}" src="${IMG}${t}.webp" alt="">`)
      .join('');
    const parade = BOOK.concat(DECK)
      .map((sp, i) => `<img src="${IMG}${sp}.webp" alt="${esc(SPECIES[sp].name)}" title="${esc(SPECIES[sp].name)}" style="--i:${i}">`)
      .join('');
    app.innerHTML = tokify(`<div class="setup${setupVsAi ? ' vs-ai' : ''}">
      <div class="box-lid">
        <img class="cover" src="${IMG}cover.webp" alt="Dinosaurs in fenced enclosures in a jungle park">
        <div class="lid-title"><h1>Dino Board Game</h1><p class="tagline">Fence your land, feed your dinos, and build the best park in 18 rounds.</p></div>
        ${floaters}
      </div>
      <div class="parade">${parade}</div>
      <div class="setup-card">
        <h2>How do you want to play?</h2>
        <div class="mode-pick" role="radiogroup">
          <button class="mode-btn m-2p" data-act="setupMode" data-mode="2p" role="radio"><span>👥</span><b>Two players</b><small>Share this device</small></button>
          <button class="mode-btn m-ai" data-act="setupMode" data-mode="ai" role="radio"><span>🤖</span><b>Vs computer</b><small>You play Red</small></button>
        </div>
        <div class="name-row">
          <div class="name-field"><label for="name0"><img class="nf-dino" src="${IMG}${MASCOT[0]}.webp" alt=""><span class="dot-red"></span><span class="only-2p">Red player</span><span class="only-ai">Your name</span></label><input id="name0" maxlength="18" value="Red" autocomplete="off"></div>
          <div class="name-field only-2p"><label for="name1"><img class="nf-dino" src="${IMG}${MASCOT[1]}.webp" alt=""><span class="dot-blue"></span>Blue player</label><input id="name1" maxlength="18" value="Blue" autocomplete="off"></div>
          <div class="name-field only-ai"><label><img class="nf-dino" src="${IMG}${MASCOT[1]}.webp" alt=""><span class="dot-blue"></span>Opponent</label><div class="ai-card">🤖 Computer</div></div>
        </div>
        <div class="ai-opts only-ai">
          ${segGroup('Difficulty', 'setupOpt', 'level', AI_LEVELS, AI_LEVEL_HELP, setupLevel)}
          ${segGroup('Computer speed', 'setupOpt', 'pace', AI_PACES, AI_PACE_HELP, setupPace)}
        </div>
        <div class="first-q">🎬 Who watched a dino movie most recently? They go first.</div>
        <div class="first-btns">
          <button class="btn fr" data-act="setupStart" data-first="0"><span class="only-2p">🔴 Red did!</span><span class="only-ai">🔴 I did!</span></button>
          <button class="btn fb" data-act="setupStart" data-first="1"><span class="only-2p">🔵 Blue did!</span><span class="only-ai">🤖 Computer starts</span></button>
        </div>
        <div class="setup-foot">Everyone starts with 🪙5, an empty park, and the same 8 dinos. The first player switches every round. Your game saves in this browser.</div>
      </div>
      <div class="setup-actions"><button class="btn ghost" data-act="rules">📜 Read the rules</button></div>
    </div>`);
  }

  function segGroup(label, act, k, opts, help, val) {
    const btns = Object.keys(opts)
      .map((v) => `<button class="seg-btn${v === val ? ' on' : ''}" data-act="${act}" data-k="${k}" data-v="${v}"><b>${opts[v]}</b><small>${help[v]}</small></button>`)
      .join('');
    return `<div class="seg-group"><div class="seg-label">${label}</div><div class="seg" role="radiogroup">${btns}</div></div>`;
  }

  function savePrefs(level, pace) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ level, pace }));
    } catch {
      /* storage blocked */
    }
  }

  // ---------------------------------------------------------------- modals
  function openAiSettings() {
    const c = aiCfg();
    openModal(`<div class="modal-head"><h2>🤖 Computer settings</h2><button class="x" data-act="closeModal" aria-label="Close">✕</button></div>
      ${segGroup('Difficulty', 'setAiOpt', 'level', AI_LEVELS, AI_LEVEL_HELP, c.level)}
      ${segGroup('Speed', 'setAiOpt', 'pace', AI_PACES, AI_PACE_HELP, c.pace)}
      <p class="muted">Changes apply right away. Pick Slow to watch each of the computer’s moves.</p>`, 'small');
  }

  function openRules() {
    openModal(`<div class="modal-head"><h2>📜 How to play</h2><button class="x" data-act="closeModal" aria-label="Close">✕</button></div>
      <p>Two players each build a dino park on a 10×10 grid over <b>18 rounds</b>. Most points wins.</p>
      <h3>Setup</h3>
      <ul>
        <li>Each player gets a park, 🪙5, and a dino book (red or blue — both have the same 8 dinos).</li>
        <li>The dino cards are shuffled and 2 are placed face-up next to the deck.</li>
        <li>Whoever most recently saw a movie with a dino in it goes first in round 1.</li>
        <li><b>The first player switches every round</b> (look for the <b>1st</b> tag).</li>
      </ul>
      <h3>Each round</h3>
      <ol>
        <li><b>Place phases</b> — the 4 phase cards are shuffled into a random order.</li>
        <li><b>Resolve phases</b> in that order (the first player acts first in each phase).</li>
        <li><b>Move the round tracker</b> and pass “first player” to the other player.</li>
      </ol>
      <h3>🎲 Gain Food / Draw Fences</h3>
      <p>Roll one die. Both players split that number between food (🍖 meat / 🌿 plants) and fences. A fence fills one edge of one square.</p>
      <h3>🍖 Feeding</h3>
      <ol>
        <li><b>Feed dinos</b>: pay each dino’s food (must be a food type on its card). Dinos in an inactive enclosure cost extra food equal to the inactive marker. Feed every dino in an inactive enclosure to remove its token.</li>
        <li><b>Place inactive tokens</b> on each enclosure with an unfed dino that doesn’t already have one (marker on 1).</li>
        <li><b>Move inactive markers</b> up 1 on every token that wasn’t placed this round. If a marker was already on 4, those dinos die and the enclosure is permanently inactive (💀).</li>
      </ol>
      <h3>🪙 Production</h3>
      <p>Choose one active enclosure and gain coins equal to the production of every dino in it.</p>
      <h3>⚡ Action</h3>
      <p>Take 2 actions (you may repeat one):</p>
      <ul>
        <li><b>Play a dino</b> — pay its cost and fill its squares in one enclosure.</li>
        <li><b>Draw a card</b> — face-up or top of the deck. It joins your dino book.</li>
        <li><b>Buy from the shop</b> — 💎 Diamond (🪙6), 🌾 Feeder (💎1 + 🪙3, +🪙2 per square over 5; each square = 1 less food in total for that enclosure each Feeding), 💧 Watering hole (💎2 + 🪙4, 6 squares; allows one more species in that enclosure).</li>
        <li><b>Use a dino action</b> — a red ability of a dino in an active enclosure.</li>
        <li><b>Gain 3 coins.</b></li>
        <li><b>Draw in 2 fences.</b></li>
      </ul>
      <h3>Enclosures</h3>
      <p>An enclosure is an area completely closed off by fences. It may use at most <b>two sides</b> of the board edge as walls. Different species can’t share an enclosure unless there’s a watering hole.</p>
      <h3>Dino cards</h3>
      <p><span class="dc-type" style="background:var(--event)">Event</span> triggers when played. <span class="dc-type" style="background:var(--action)">Action</span> is used with the “Use a dino action” action. <span class="dc-type" style="background:var(--scoring)">Scoring</span> scores at the end.</p>
      <h3>Scoring</h3>
      <ul>
        <li>Each dino’s point value (the yellow circle).</li>
        <li>Purple scoring abilities.</li>
        <li>💎 Each leftover diamond = 3 points.</li>
      </ul>
      <p>Dinos in inactive or extinct enclosures score nothing.</p>
      <h3>How this digital version handles unclear spots</h3>
      <ul>
        <li>Dinos, feeders, and watering holes must fill <b>connected</b> squares inside one enclosure.</li>
        <li>Fences can’t cut through a dino, feeder, or watering hole, and can’t leave two species together without a watering hole. Splitting an inactive enclosure keeps its marker on every part that still has dinos.</li>
        <li>Squares filled by your opponent (Brachiosaurus, Spinosaurus) can’t be used, but fences can still pass them.</li>
        <li>The inactive surcharge applies to <b>each dino</b> in the enclosure; feeders take 1 food per feeder square off the enclosure’s total (never below 0).</li>
        <li>Your book dinos (and drawn cards) can be played any number of times unless T. Rex blocks them.</li>
        <li>Nothing new can be placed in an extinct (💀) enclosure.</li>
        <li>Triceratops page plants score only if you have a Triceratops in an active enclosure at the end.</li>
        <li>Every active Microraptor scores 2 points per enclosure that has a Microraptor.</li>
        <li>Gigantoraptor: at the start of next round you pick a phase; you take your part of it twice (the Gain Food bonus rolls its own die).</li>
      </ul>`);
  }

  function openBook(p) {
    const P = state.players[p];
    const cards = P.book
      .map((sp) => cardHtml(sp, {
        cls: P.blocked.includes(sp) ? 'blockedc' : '',
        tag: P.blocked.includes(sp) ? '🚫 blocked' : P.cards.includes(sp) ? 'drawn card' : '',
      }))
      .join('');
    const extra = P.triPlants ? `<p>🌿 Plants on the Triceratops page: <b>${P.triPlants}</b></p>` : '';
    openModal(`<div class="modal-head"><h2>📖 ${esc(P.name)}’s dino book</h2><button class="x" data-act="closeModal" aria-label="Close">✕</button></div>
      <p class="muted">Base book dinos plus any cards drawn. Each can be played as many times as you like (unless blocked).</p>${extra}
      <div class="card-grid">${cards}</div>`);
  }

  // ---------------------------------------------------------------- actions
  function handle(act, ds, el, ev) {
    if (busy) return;
    if (act === 'closeModal') {
      if (el.classList.contains('modal-bg') && ev.target !== el) return;
      closeModal();
      return;
    }
    if (act === 'confirmYes') {
      const fn = pendingConfirm;
      closeModal();
      if (fn) fn();
      return;
    }
    if (act === 'rules') { openRules(); return; }
    if (act === 'setupMode') {
      setupVsAi = ds.mode === 'ai';
      const box = document.querySelector('.setup');
      if (box) box.classList.toggle('vs-ai', setupVsAi);
      return;
    }
    if (act === 'setupStart') {
      const n0 = (document.getElementById('name0').value || '').trim() || 'Red';
      const n1 = setupVsAi ? 'Computer' : (document.getElementById('name1').value || '').trim() || 'Blue';
      newGame([n0, n1], +ds.first, setupVsAi ? 1 : null, setupLevel, setupPace);
      return;
    }
    if (act === 'setupOpt') {
      if (ds.k === 'level') setupLevel = ds.v;
      else setupPace = ds.v;
      savePrefs(setupLevel, setupPace);
      el.parentElement.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('on', b === el));
      return;
    }
    if (!state) return;
    if (act === 'newGame') {
      const T = cur();
      const reset = () => {
        localStorage.removeItem(SAVE_KEY);
        state = null;
        ui = freshUi();
        resetFx();
        closeModal();
        render();
      };
      if (T && T.t !== 'gameOver') confirmModal('Start a new game?', 'This park and everything in it will be lost.', 'Yes, start over', reset);
      else reset();
      return;
    }
    if (act === 'book') { openBook(+ds.p); return; }
    if (act === 'aiSettings') { openAiSettings(); return; }
    if (act === 'setAiOpt' && state.aiCfg) {
      state.aiCfg[ds.k] = ds.v;
      savePrefs(state.aiCfg.level, state.aiCfg.pace);
      save();
      openAiSettings();
      renderTop();
      return;
    }

    const T = cur();
    if (!T) return;
    const p = T.p;
    const P = p !== undefined ? state.players[p] : null;
    const O = p !== undefined ? state.players[other(p)] : null;

    switch (act) {
      case 'pickDouble': {
        const q = +ds.p;
        const need = state.players[q].bonusPending;
        const picks = ui.picks[q] || (ui.picks[q] = []);
        if (picks.length >= need) picks.pop();
        picks.push(ds.ph);
        renderPanel();
        break;
      }
      case 'clearDouble':
        ui.picks[+ds.p] = [];
        renderPanel();
        break;
      case 'startRound': {
        for (const q of [0, 1]) {
          const Q = state.players[q];
          const picks = ui.picks[q] || [];
          if (picks.length < Q.bonusPending) return;
          Q.doubles = picks.filter((ph) => ph !== 'none');
          if (Q.doubles.length) logMsg(`${pn(q)} will do ${Q.doubles.map((ph) => PHASES[ph].short).join(' and ')} twice this round.`);
          else if (Q.bonusPending) logMsg(`${pn(q)} chose not to use their Gigantoraptor bonus.`);
          Q.bonusPending = 0;
        }
        state.queue = buildRoundTasks();
        commit();
        break;
      }
      case 'roll':
        animateDie((v) => {
          state.lastRoll = v;
          state.queue.forEach((t) => {
            if (t.t === 'gainFood' && t.k === T.k && !t.bonus) t.amount = v;
          });
          logMsg(`🎲 Rolled a <b>${v}</b> for Gain Food / Draw Fences.`);
          resolveCurrent();
        });
        break;
      case 'rollBonus':
        animateDie((v) => {
          T.amount = v;
          logMsg(`🎲 ${pn(p)} rolled a <b>${v}</b> for their bonus Gain Food phase.`);
          refreshSameTask();
        });
        break;
      case 'step': {
        const d = +ds.d;
        if (T.t === 'gainFood') {
          const used = ui.meat + ui.plant + (ui.sel ? ui.sel.edges.size : 0);
          if (d > 0 && used >= T.amount) break;
          ui[ds.k] = Math.max(0, ui[ds.k] + d);
        } else if (T.t === 'foodChoice') {
          ui.meat = clamp(ui.meat + d, 0, T.amount);
        } else if (T.t === 'steal') {
          const [lo, hi] = stealRange(T);
          ui.meat = clamp(ui.meat + d, lo, hi);
        }
        ui.keepScroll = true;
        renderPanel();
        break;
      }
      case 'edge': {
        const s = ui.sel;
        if (!s || s.type !== 'edges' || +ds.p !== s.board) break;
        const e = ds.e;
        if (s.edges.has(e)) s.edges.delete(e);
        else {
          const max = edgeMax();
          if (s.edges.size >= max) {
            toast(T.t === 'gainFood' ? 'Budget used up — lower your food to draw more fences.' : `You can only draw ${plural(max, 'fence')}.`, 'bad');
            break;
          }
          s.edges.add(e);
        }
        ui.keepScroll = true;
        renderBoards();
        renderPanel();
        break;
      }
      case 'confirmGain': {
        const edges = ui.sel ? [...ui.sel.edges] : [];
        const problem = fenceProblem(P.board, edges);
        if (problem) { toast(problem, 'bad'); break; }
        P.meat += ui.meat;
        P.plants += ui.plant;
        applyEdges(P.board, edges);
        const parts = [];
        if (ui.meat) parts.push(`🍖${ui.meat}`);
        if (ui.plant) parts.push(`🌿${ui.plant}`);
        if (edges.length) parts.push(`🪵${edges.length} fence${edges.length > 1 ? 's' : ''}`);
        logMsg(`${pn(p)} took ${parts.length ? parts.join(', ') : 'nothing'}.`);
        resolveCurrent();
        break;
      }
      case 'feedToggle': {
        const key = +ds.key;
        const an = analyze(P.board);
        const list = feedables(an);
        if (ui.feed.has(key)) ui.feed.delete(key);
        else {
          const costs = list.filter((cp) => ui.feed.has(cp.key) || cp.key === key).map(enclosureCost);
          if (!canPayFood(P, sumCosts(costs))) {
            toast('Not enough food for that enclosure too.', 'bad');
            break;
          }
          ui.feed.add(key);
        }
        ui.keepScroll = true;
        renderPanel();
        break;
      }
      case 'confirmFeed':
        doFeed(p, ui.feed);
        resolveCurrent();
        break;
      case 'produce': {
        const cp = producible(p).find((c) => c.key === +ds.key);
        if (!cp) break;
        P.coins += cp.prod;
        logMsg(`${pn(p)} collected 🪙${cp.prod} from enclosure ${cp.name}.`);
        toast(`🪙 +${cp.prod} for ${P.name}`, 'good');
        resolveCurrent();
        break;
      }
      case 'mode': {
        if (T.t !== 'actions') break;
        const m = ds.m;
        if (m === 'gain3') {
          P.coins += 3;
          logMsg(`${pn(p)} gained 🪙3.`);
          completeAction();
          break;
        }
        ui.mode = m;
        if (m === 'fences2') ui.sel = { type: 'edges', board: p, edges: new Set() };
        render();
        break;
      }
      case 'back':
        if (T.t === 'freePlay' || (T.t === 'actions' && ui.mode === 'play' && ui.species)) {
          ui.species = null;
          ui.sel = null;
        } else {
          ui.mode = null;
          ui.sel = null;
          ui.species = null;
          ui.shopItem = null;
        }
        render();
        break;
      case 'shopBack':
        ui.shopItem = null;
        ui.sel = null;
        render();
        break;
      case 'endTurn':
        if (T.t !== 'actions') break;
        logMsg(`${pn(p)} skipped ${plural(T.remaining, 'action')}.`);
        T.remaining = 0;
        commit();
        break;
      case 'pickSpecies': {
        const sp = ds.sp;
        const free = T.t === 'freePlay';
        const opt = playOptions(p, free).find((o) => o.sp === sp);
        if (!opt || !opt.ok) break;
        ui.species = sp;
        ui.sel = { type: 'cells', board: p, cells: new Set(), need: SPECIES[sp].space, purpose: 'dino', species: sp };
        render();
        break;
      }
      case 'shopItem':
        ui.shopItem = ds.item;
        ui.sel = { type: 'cells', board: p, cells: new Set(), need: ds.item === 'water' ? 6 : null, purpose: ds.item };
        render();
        break;
      case 'buyDiamond':
        if (!canAfford(P, DIAMOND_COST)) break;
        pay(P, DIAMOND_COST);
        P.diamonds++;
        logMsg(`${pn(p)} bought a 💎 diamond.`);
        completeAction();
        break;
      case 'place':
        doPlace(T);
        break;
      case 'take': {
        const anyOk = (T.t === 'actions' && ui.mode === 'draw') || (T.t === 'drawCard' && T.source === 'any');
        const deckOk = anyOk || (T.t === 'drawCard' && T.source === 'deck');
        const from = ds.from === 'deck' ? 'deck' : +ds.from;
        if (from === 'deck' ? !deckOk || !state.deck.length : !anyOk || !state.faceUp[from]) break;
        takeCard(p, from);
        if (T.t === 'actions') completeAction();
        else resolveCurrent();
        break;
      }
      case 'dinoAct':
        doDinoAction(T, ds.sp, +ds.key);
        break;
      case 'confirmFences': {
        const s = ui.sel;
        if (!s) break;
        const legal = new Set(legalEdges(p));
        const edges = [...s.edges].filter((e) => legal.has(e));
        const problem = fenceProblem(P.board, edges);
        if (problem) { toast(problem, 'bad'); break; }
        if (T.t === 'actions') {
          if (!edges.length) break;
          applyEdges(P.board, edges);
          logMsg(`${pn(p)} drew ${plural(edges.length, 'fence')}.`);
          completeAction();
        } else {
          applyEdges(P.board, edges);
          logMsg(`${pn(p)} drew ${plural(edges.length, 'fence')}.`);
          resolveCurrent();
        }
        break;
      }
      case 'foodQuick':
        if (ds.v === 'all') ui.meat = T.amount;
        else if (ds.v === 'none') ui.meat = 0;
        else ui.meat = Math.floor(T.amount / 2);
        ui.keepScroll = true;
        renderPanel();
        break;
      case 'confirmFood': {
        const plant = T.amount - ui.meat;
        P.meat += ui.meat;
        P.plants += plant;
        logMsg(`${pn(p)} gained 🍖${ui.meat} 🌿${plant}.`);
        resolveCurrent();
        break;
      }
      case 'confirmSteal': {
        const [lo, hi] = stealRange(T);
        const m = clamp(ui.meat, lo, hi);
        const pl = T.amount - m;
        O.meat -= m;
        O.plants -= pl;
        P.meat += m;
        P.plants += pl;
        logMsg(`${pn(p)}’s Velociraptors stole 🍖${m} 🌿${pl} from ${pn(other(p))}!`);
        toast(`🦖 Raid! ${P.name} stole ${T.amount} food`, 'good');
        resolveCurrent();
        break;
      }
      case 'spino': {
        let tasks = [];
        if (ds.o === 'dia') {
          P.diamonds++;
          logMsg(`${pn(p)} took 💎1 from Spinosaurus.`);
        } else if (ds.o === 'coins') {
          P.coins += 5;
          logMsg(`${pn(p)} took 🪙5 from Spinosaurus.`);
        } else if (ds.o === 'food') {
          tasks = [{ t: 'foodChoice', p, amount: 15, title: 'Spinosaurus: gain 15 food' }];
        } else if (ds.o === 'fill') {
          if (!emptyCount(other(p))) break;
          tasks = [{ t: 'fillOpp', p, count: 10, title: 'Spinosaurus: fill in 10 squares in your opponent’s park' }];
        }
        if (state.deck.length) takeCard(p, 'deck');
        else logMsg('The deck is empty — no card to draw.');
        resolveCurrent(tasks);
        break;
      }
      case 'trex': {
        const sp = ds.sp;
        if (!trexOptions(p).includes(sp)) break;
        O.blocked.push(sp);
        logMsg(`🦖 ${pn(p)}’s T. Rex blocked ${pn(other(p))} from placing any more <b>${spName(sp)}</b>.`);
        toast(`🚫 ${O.name} can’t place ${spName(sp)} anymore`, 'bad');
        resolveCurrent();
        break;
      }
      case 'carnoRoll':
        animateDie((v) => {
          logMsg(`🎲 ${pn(p)} rolled a ${v} for Carnotaurus → ${4 * v} food.`);
          resolveCurrent([{ t: 'foodChoice', p, amount: 4 * v, title: `Carnotaurus: rolled ${v} — gain ${4 * v} food` }]);
        });
        break;
      case 'skip':
        if (T.t === 'freePlay') {
          logMsg(`${pn(p)} skipped the free dino.`);
          resolveCurrent();
        }
        break;
      default:
        break;
    }
  }

  function doFeed(p, keys) {
    const P = state.players[p];
    const b = P.board;
    const an = analyze(b);
    const list = feedables(an);
    const fed = list.filter((cp) => keys.has(cp.key));
    const unfed = list.filter((cp) => !keys.has(cp.key));
    const tot = sumCosts(fed.map(enclosureCost));
    if (!canPayFood(P, tot)) return;
    P.meat -= tot.meat;
    P.plants -= tot.plant;
    for (let i = 0; i < tot.flex; i++) {
      if (P.meat >= P.plants && P.meat > 0) P.meat--;
      else P.plants--;
    }
    const msgs = [];
    if (fed.length) msgs.push(`fed ${fed.map((cp) => cp.name).join(', ')}${tot.total ? ` (paid ${[tot.meat ? '🍖' + tot.meat : '', tot.plant ? '🌿' + tot.plant : '', tot.flex ? '🍖/🌿' + tot.flex : ''].filter(Boolean).join(' ')})` : ''}`);
    fed.forEach((cp) => {
      if (b.inactive[cp.key]) {
        delete b.inactive[cp.key];
        delete b.placedRound[cp.key];
        msgs.push(`${cp.name} is active again`);
      }
    });
    unfed.forEach((cp) => {
      if (!b.inactive[cp.key]) {
        b.inactive[cp.key] = 1;
        b.placedRound[cp.key] = state.round;
        msgs.push(`${cp.name} went inactive 💤`);
      }
    });
    Object.keys(b.inactive).forEach((key) => {
      if (b.placedRound[key] === state.round) return;
      const cp = an.comps.find((c) => String(c.key) === key);
      if (b.inactive[key] >= 4) {
        delete b.inactive[key];
        delete b.placedRound[key];
        b.dead[key] = true;
        if (cp) cp.dinos.forEach((d) => { d.dead = true; });
        msgs.push(`💀 the dinos in ${cp ? cp.name : '?'} died`);
        toast(`💀 ${P.name}’s dinos in enclosure ${cp ? cp.name : '?'} died!`, 'bad');
      } else {
        b.inactive[key]++;
        msgs.push(`${cp ? cp.name : '?'}’s marker moved to ${b.inactive[key]}`);
      }
    });
    logMsg(`${pn(p)} ${msgs.length ? msgs.join('; ') : 'fed nobody'}.`);
  }

  function doPlace(T) {
    const s = ui.sel;
    if (!s || s.type !== 'cells') return;
    const v = validateSel();
    if (!v.ok) {
      toast(v.msg, 'bad');
      return;
    }
    const cells = [...s.cells];
    if (s.purpose === 'rubble') {
      const b = state.players[s.board].board;
      cells.forEach((i) => { b.cells[i] = -1; });
      logMsg(`${pn(T.p)} filled in ${plural(cells.length, 'square')} in ${pn(s.board)}’s park.`);
      resolveCurrent();
      return;
    }
    const p = s.board;
    const P = state.players[p];
    if (s.purpose === 'dino') {
      const sp = s.species;
      const free = T.t === 'freePlay';
      if (!free) {
        if (!canAfford(P, SPECIES[sp].cost)) return;
        pay(P, SPECIES[sp].cost);
      }
      const encl = placeItem(p, 'dino', cells, sp);
      logMsg(`${pn(p)} played ${dz(sp)} <b>${spName(sp)}</b> in enclosure ${encl}${free ? ' for free' : ` (${costText(SPECIES[sp].cost)})`}.`);
      let tasks = [];
      if (SPECIES[sp].type === 'event') {
        toast(`⚡ ${spName(sp)} event!`, 'good');
        tasks = eventTasks(p, sp);
      }
      if (free) resolveCurrent(tasks);
      else completeAction(tasks);
      return;
    }
    if (s.purpose === 'feeder') {
      const cost = feederCost(cells.length);
      pay(P, cost);
      const encl = placeItem(p, 'feeder', cells);
      logMsg(`${pn(p)} built a ${cells.length}-square 🌾 feeder in enclosure ${encl} (${costText(cost)}).`);
      completeAction();
      return;
    }
    if (s.purpose === 'water') {
      pay(P, WATER_COST);
      const encl = placeItem(p, 'water', cells);
      logMsg(`${pn(p)} dug a 💧 watering hole in enclosure ${encl}.`);
      completeAction();
    }
  }

  function doDinoAction(T, sp, key) {
    const p = T.p;
    const P = state.players[p];
    const O = state.players[other(p)];
    const opt = dinoActionOptions(p).find((o) => o.sp === sp && o.key === key);
    if (!opt) return;
    if (sp === 'triceratops') {
      P.triPlants++;
      logMsg(`${pn(p)} put a 🌿 on their Triceratops page (${P.triPlants} now).`);
      completeAction();
    } else if (sp === 'velociraptor') {
      const amount = Math.min(2 * opt.count, O.meat + O.plants);
      if (!amount) logMsg(`${pn(p)}’s Velociraptors found no food to steal.`);
      completeAction(amount ? [{ t: 'steal', p, amount }] : []);
    } else if (sp === 'allosaurus') {
      const n = Math.min(3, O.coins);
      O.coins -= n;
      P.coins += n;
      logMsg(`${pn(p)}’s Allosaurus stole 🪙${n} from ${pn(other(p))}.`);
      if (n) toast(`🦖 ${P.name} stole 🪙${n}`, 'good');
      completeAction();
    } else if (sp === 'parasaurolophus') {
      const n = 2 * opt.count;
      P.coins += n;
      logMsg(`${pn(p)}’s Parasaurolophus herd earned 🪙${n}.`);
      completeAction();
    }
  }

  // ---------------------------------------------------------------- computer player
  const FREE_ACTS = new Set(['rules', 'book', 'closeModal', 'newGame', 'confirmYes', 'aiSettings', 'setAiOpt']);
  const AI_LEVELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
  const AI_PACES = { fast: 'Fast', medium: 'Medium', slow: 'Slow' };
  const AI_LEVEL_HELP = { easy: 'Plays for fun and makes mistakes', medium: 'Plans one move at a time', hard: 'Plays to win: plans fences, cards and the whole game' };
  const AI_PACE_HELP = { fast: 'Quick turns', medium: 'Easy to follow', slow: 'Step by step' };
  const PACE_MULT = { fast: 0.4, medium: 1, slow: 2.1 };
  const LEVEL_TUNE = {
    easy: { depth: 1, noise: 1.4, style: 1.2, foresight: 0.7, blunder: 0.25 },
    medium: { depth: 1, noise: 0.8, style: 1, foresight: 0.85, blunder: 0 },
    hard: { depth: 2, noise: 0.03, style: 0, foresight: 1, blunder: 0, proj: true },
  };
  const AI_STYLES = {
    builder: { sp: { trex: 3, mosasaurus: 3, spinosaurus: 1.5, brachiosaurus: 1.5, allosaurus: 1 }, act: { fences: 0.8, diamond: 0.4 } },
    herder: { sp: { compy: 1.5, microraptor: 2, parasaurolophus: 2, stegosaurus: 1, triceratops: 0.8 }, act: { feeder: 1.2, draw: 0.4 } },
    raider: { sp: { velociraptor: 2.5, allosaurus: 2.5, brachiosaurus: 1.5, dilophosaurus: 1.5, carnotaurus: 1 }, act: { dinoAct: 1, draw: 0.3 } },
    banker: { sp: { pachy: 3, triceratops: 2, ankylosaurus: 1, gigantoraptor: 1 }, act: { diamond: 1, gain3: 0.4 } },
  };
  // Fence layouts (the first segments build the outer pens, the rest split them). Each game picks
  // one, applies a random rotation/mirror, and shuffles the order of the splits.
  const AI_PLANS = [
    {
      head: 3,
      segs: [
        ['h40', 'h41', 'h42', 'h43', 'h44', 'v4', 'v13', 'v22', 'v31', 'v40'],
        ['h45', 'h46', 'h47', 'h48', 'h49'],
        ['v49', 'v58', 'v67', 'v76', 'v85'],
        ['h10', 'h11', 'h12', 'h13', 'h14'],
        ['h75', 'h76', 'h77', 'h78', 'h79'],
        ['h15', 'h16', 'h17', 'h18', 'h19'],
        ['h70', 'h71', 'h72', 'h73', 'h74'],
      ],
    },
    {
      head: 3,
      segs: [
        ['h20', 'h21', 'h22', 'h23', 'v3', 'v12', 'v21'],
        ['h24', 'h25', 'h26', 'h27', 'h28', 'h29'],
        ['v31', 'v40', 'v49', 'v58', 'v67', 'v76', 'v85'],
        ['h60', 'h61', 'h62', 'h63', 'h64'],
        ['h65', 'h66', 'h67', 'h68', 'h69'],
        ['v7', 'v16', 'v25'],
      ],
    },
  ];
  const FOOD_PER_PHASE = 3.2;
  // Food Hard's forecast expects per future Gain Food phase (die, after some fences).
  const FORECAST_FOOD = 3.2;
  // Points already on the board count a little more than points the forecast hopes for.
  const FORECAST_TRUST = 0.95;
  // Idle coins are worth less than the points they buy: spending them later costs an action.
  const COIN_VALUE = 0.38;
  const SURPLUS_COIN_VALUE = 0.22;
  const COIN_RESERVE = 12;
  const OPP_WEIGHT = 0.6;

  function aiProfile(level, pace) {
    const plan = AI_PLANS[rand(AI_PLANS.length)];
    const tail = shuffle(plan.segs.slice(plan.head).map((_, i) => i + plan.head));
    return {
      level: AI_LEVELS[level] ? level : 'medium',
      pace: AI_PACES[pace] ? pace : 'medium',
      style: Object.keys(AI_STYLES)[rand(4)],
      plan: { i: AI_PLANS.indexOf(plan), t: rand(8), order: plan.segs.slice(0, plan.head).map((_, i) => i).concat(tail) },
    };
  }

  function aiCfg() {
    if (!state.aiCfg) state.aiCfg = aiProfile('medium', 'medium');
    return state.aiCfg;
  }

  function edgeRC(e) {
    const i = +e.slice(1);
    return e[0] === 'h' ? ['h', Math.floor(i / N), i % N] : ['v', Math.floor(i / 9), i % 9];
  }

  function xformEdge(e, t) {
    let [k, r, c] = edgeRC(e);
    if (t & 4) [k, r, c] = [k === 'h' ? 'v' : 'h', c, r];
    if (t & 1) c = (k === 'h' ? 9 : 8) - c;
    if (t & 2) r = (k === 'h' ? 8 : 9) - r;
    return k === 'h' ? `h${r * N + c}` : `v${r * 9 + c}`;
  }

  function aiPlan() {
    const { i, t, order } = aiCfg().plan;
    const segs = AI_PLANS[i].segs;
    return order.map((n) => segs[n].map((e) => xformEdge(e, t)));
  }

  function isAiTask(T) {
    if (!state || state.ai == null || !T || T.t === 'gameOver') return false;
    if (T.p === state.ai) return true;
    return T.t === 'roll' && state.first === state.ai;
  }

  function tune() {
    return LEVEL_TUNE[aiCfg().level];
  }

  function noise(scale) {
    return (Math.random() + Math.random() + Math.random() - 1.5) * scale;
  }

  // What is still to come after the current phase: how many feedings, productions, food phases and
  // action phases, and whether food arrives before the next feeding.
  function aiTimeline(k) {
    const rest = k == null || k < 0 ? state.phaseOrder.slice() : state.phaseOrder.slice(k + 1);
    const future = ROUNDS - state.round;
    const tl = { feeds: 0, prods: 0, prodSpend: 0, prodsBeforeFeed: 0, foods: 0, acts: 0, foodBeforeFeed: 0, future };
    let seenFood = false;
    let seenFeed = false;
    rest.forEach((ph, i) => {
      if (ph === 'feed') {
        tl.feeds++;
        if (!seenFeed) tl.foodBeforeFeed = seenFood ? 1 : 0;
        seenFeed = true;
      } else if (ph === 'food') {
        tl.foods++;
        seenFood = true;
      } else if (ph === 'action') {
        tl.acts++;
      } else {
        tl.prods++;
        tl.prodSpend += rest.slice(i + 1).includes('action') || future > 0 ? 1 : 0;
        if (!seenFeed) tl.prodsBeforeFeed++;
      }
    });
    if (!seenFeed && future > 0) {
      tl.foodBeforeFeed = 0.5;
      tl.prodsBeforeFeed += 0.5;
    }
    tl.feeds += future;
    tl.prods += future;
    tl.foods += future;
    tl.acts += future;
    if (future > 0) tl.prodSpend += future - 0.5;
    return tl;
  }

  // ----- lightweight model of one player, used to try moves without touching the real game
  function cloneBoard(b) {
    return Object.assign({}, b, {
      h: b.h.slice(), v: b.v.slice(), cells: b.cells.slice(), items: Object.assign({}, b.items),
      inactive: Object.assign({}, b.inactive), placedRound: Object.assign({}, b.placedRound),
      dead: Object.assign({}, b.dead), names: Object.assign({}, b.names),
    });
  }

  function aiModel(p, actsLeft) {
    const P = state.players[p];
    const O = state.players[other(p)];
    return {
      p, actsLeft,
      coins: P.coins, diamonds: P.diamonds, meat: P.meat, plants: P.plants, triPlants: P.triPlants,
      board: cloneBoard(P.board),
      book: P.book.filter((sp) => !P.blocked.includes(sp)),
      faceUp: state.faceUp.slice(),
      deck: state.deck.length,
      opp: { coins: O.coins, food: O.meat + O.plants },
      extra: 0,
    };
  }

  function copyModel(m) {
    return Object.assign({}, m, { board: cloneBoard(m.board), book: m.book.slice(), faceUp: m.faceUp.slice(), opp: Object.assign({}, m.opp) });
  }

  const affordM = (m, cost) => m.diamonds >= cost.d && m.coins >= cost.c;
  function payM(m, cost) {
    m.diamonds -= cost.d;
    m.coins -= cost.c;
  }

  function demandOf(b) {
    return sumCosts(feedables(analyze(b)).map(enclosureCost));
  }

  // How much of `n` new food should be meat, given what the dinos eat.
  function aiSplitFood(b, meat, plants, n) {
    const d = demandOf(b);
    const needM = Math.max(0, d.meat - meat);
    const needP = Math.max(0, d.plant - plants);
    if (needM + needP >= n) return needM + needP ? Math.round((n * needM) / (needM + needP)) : 0;
    const rest = n - needM - needP;
    return needM + Math.round((rest * (d.meat + 1)) / (d.meat + d.plant + 2));
  }

  function addFood(m, n) {
    const meat = clamp(aiSplitFood(m.board, m.meat, m.plants, n), 0, n);
    m.meat += meat;
    m.plants += n - meat;
  }

  function payFoodM(m, c) {
    m.meat -= c.meat;
    m.plants -= c.plant;
    for (let i = 0; i < c.flex; i++) {
      if (m.meat >= m.plants && m.meat > 0) m.meat--;
      else m.plants--;
    }
  }

  function oppFreeValid(p) {
    const an = analyze(state.players[other(p)].board);
    return an.comps.filter((cp) => cp.valid && !cp.dead).reduce((s, cp) => s + cp.empty, 0);
  }

  function fillHarm(p, n) {
    const free = oppFreeValid(p);
    return (Math.min(n, free) * 0.3 + Math.max(0, n - free) * 0.04) * OPP_WEIGHT;
  }

  function trexHarm(p) {
    const O = state.players[other(p)];
    const opts = trexOptions(p);
    if (!opts.length) return 0;
    return Math.max(...opts.map((sp) => SPECIES[sp].pts * 0.25 + (canAfford(O, SPECIES[sp].cost) ? 1.5 : 0.5))) * OPP_WEIGHT;
  }

  function cardValue(sp, tl) {
    if (tl.acts < 2) return 0.2;
    return 0.6 + SPECIES[sp].pts * 0.15 + (tl.acts >= 6 ? 0.6 : 0);
  }

  function deckValue(m, tl) {
    const pool = state.deck.filter((sp) => !m.book.includes(sp));
    if (!pool.length) return 0;
    return (pool.reduce((s, sp) => s + cardValue(sp, tl), 0) / pool.length) * 0.85;
  }

  function growFrom(start, free, size) {
    const out = [start];
    const seen = new Set([start]);
    for (let q = 0; q < out.length && out.length < size; q++) {
      for (const j of orthNbrs(out[q])) {
        if (free.has(j) && !seen.has(j)) {
          seen.add(j);
          out.push(j);
          if (out.length >= size) break;
        }
      }
    }
    return out.length >= size ? out.slice(0, size) : null;
  }

  function aiFindCellsB(b, size, sp, onlyKey) {
    const an = analyze(b);
    let best = null;
    an.comps.forEach((cp) => {
      if (!cp.valid || cp.dead || cp.empty < size) return;
      if (onlyKey != null && cp.key !== onlyKey) return;
      if (sp) {
        const kinds = new Set(cp.species);
        kinds.add(sp);
        if (kinds.size > 1 + cp.waters.length) return;
      }
      const free = new Set(cp.cells.filter((i) => b.cells[i] === 0));
      free.forEach((start) => {
        const cells = growFrom(start, free, size);
        if (!cells) return;
        const rs = cells.map((i) => Math.floor(i / N));
        const cs = cells.map((i) => i % N);
        const box = (Math.max(...rs) - Math.min(...rs) + 1) * (Math.max(...cs) - Math.min(...cs) + 1);
        let score = (sp && cp.species.has(sp) ? 30 : 0) + cp.prod * 2 - (cp.empty - size) * 0.4 - (box - size) * 0.6 - (cp.inactive ? 20 : 0);
        if (sp === 'compy') score += cells.reduce((s, i) => s + orthNbrs(i).filter((j) => { const it = b.items[b.cells[j]]; return it && it.species === 'compy'; }).length * 6, 0);
        if (!best || score > best.score) best = { cells, score };
      });
    });
    return best ? best.cells : null;
  }

  function aiPlanEdgesB(b, max) {
    const legal = new Set(legalEdgesB(b));
    const out = [];
    for (const seg of aiPlan()) {
      if (out.length >= max) break;
      const todo = seg.filter((e) => !b[e[0]][+e.slice(1)]);
      if (!todo.length || todo.some((e) => !legal.has(e)) || fenceProblem(b, out.concat(todo))) continue;
      for (const e of todo) {
        if (out.length >= max) break;
        out.push(e);
      }
    }
    return fenceProblem(b, out) ? [] : out;
  }

  function aiFeederB(m) {
    const b = m.board;
    const an = analyze(b);
    let best = null;
    an.comps.filter((cp) => cp.valid && !cp.dead && cp.living.length && cp.empty > 0).forEach((cp) => {
      const bill = cp.living.reduce((s, d) => s + SPECIES[d.species].food.n, 0) - cp.feederSquares;
      const size = Math.min(5, cp.empty, bill);
      if (size <= 0 || !affordM(m, feederCost(size))) return;
      const cells = aiFindCellsB(b, size, null, cp.key);
      if (cells && (!best || size > best.n)) best = { kind: 'feeder', cells, n: size };
    });
    return best;
  }

  function simulateFeedB(b, list, fedKeys) {
    list.forEach((cp) => {
      if (fedKeys.has(cp.key)) {
        delete b.inactive[cp.key];
        delete b.placedRound[cp.key];
      } else if (!b.inactive[cp.key]) {
        b.inactive[cp.key] = 1;
        b.placedRound[cp.key] = state.round;
      }
    });
    Object.keys(b.inactive).forEach((key) => {
      if (b.placedRound[key] === state.round) return;
      if (b.inactive[key] >= 4) {
        delete b.inactive[key];
        delete b.placedRound[key];
        b.dead[key] = true;
        const cp = list.find((c) => String(c.key) === key);
        if (cp) cp.dinos.forEach((d) => { b.items[d.id] = Object.assign({}, d, { dead: true }); });
      } else {
        b.inactive[key]++;
      }
    });
  }

  function compyPairs(b, an, cp) {
    let n = 0;
    cp.living.forEach((d) => {
      if (d.species !== 'compy') return;
      orthNbrs(d.cells[0]).forEach((j) => {
        const it = b.items[b.cells[j]];
        if (it && it.species === 'compy' && !it.dead && an.compOf[j] === cp.idx) n++;
      });
    });
    return n;
  }

  // Estimated final score for the model, looking at the rest of the game.
  function aiEval(m, tl) {
    const T = tune();
    const b = m.board;
    const an = analyze(b);
    const live = an.comps.filter((cp) => cp.valid && !cp.dead && cp.living.length);
    const futureActs = m.actsLeft + 2 * tl.acts;
    const compVal = (cp) => cp.living.reduce((s, d) => s + SPECIES[d.species].pts, 0) + compyPairs(b, an, cp);
    const keep = new Map();
    const prodW = new Map();
    let food = { m: Infinity, p: Infinity, f: Infinity };

    if (!tl.feeds) {
      live.forEach((cp) => { keep.set(cp.key, cp.inactive ? 0 : 1); prodW.set(cp.key, cp.inactive ? 0 : 1); });
    } else {
      // Next feeding: feed what the food on hand (plus food coming first) can cover.
      let sm = m.meat;
      let sp = m.plants;
      let sf = tl.foodBeforeFeed * FOOD_PER_PHASE;
      const ranked = live
        .map((cp) => ({ cp, c: enclosureCost(cp), v: compVal(cp) + cp.prod * 1.5 }))
        .sort((x, y) => (y.v / Math.max(1, y.c.total) + (y.cp.inactive >= 3 ? 40 : 0)) - (x.v / Math.max(1, x.c.total) + (x.cp.inactive >= 3 ? 40 : 0)));
      const fed = [];
      ranked.forEach((x) => {
        const useM = Math.min(x.c.meat, sm);
        const useP = Math.min(x.c.plant, sp);
        const gap = x.c.meat - useM + x.c.plant - useP + x.c.flex;
        const flexPool = sf + (sm - useM) + (sp - useP);
        if (gap > flexPool + 1e-9) return;
        sm -= useM;
        sp -= useP;
        let g = gap;
        const fromF = Math.min(g, sf);
        sf -= fromF;
        g -= fromF;
        const fromM = Math.min(g, sm);
        sm -= fromM;
        sp -= g - fromM;
        fed.push(x.cp.key);
      });
      const fedSet = new Set(fed);
      const left = sm + sp + sf;
      const feedsAfter = tl.feeds - 1;
      const bill = (cp) => Math.max(0, cp.living.reduce((t, d) => t + SPECIES[d.species].food.n, 0) - cp.feederSquares);
      const markerOf = (cp) => Math.min(4, (cp.inactive || 0) + 1);
      const steady = live.filter((cp) => fedSet.has(cp.key)).reduce((s, cp) => s + bill(cp), 0);
      const income = left + Math.min(Math.max(0, tl.foods - tl.foodBeforeFeed), feedsAfter) * FOOD_PER_PHASE;
      const need = steady * feedsAfter;
      const ratio = need > 0 ? clamp(income / need, 0, 1) : 1;
      const r = 1 - (1 - ratio) * T.foresight;
      // Reviving an unfed enclosure later costs its bill plus the inactive surcharge, on top of everything else.
      const revive = live.filter((cp) => !fedSet.has(cp.key))
        .reduce((s, cp) => s + bill(cp) * feedsAfter + markerOf(cp) * cp.living.length, 0);
      const ratioAll = need + revive > 0 ? clamp(income / (need + revive), 0, 1) : 1;
      const rAll = 1 - (1 - ratioAll) * T.foresight;
      const typed = { meat: 0, plant: 0, flex: 0 };
      live.filter((cp) => fedSet.has(cp.key)).forEach((cp) => {
        const c = enclosureCost(Object.assign({}, cp, { inactive: 0 }));
        typed.meat += c.meat;
        typed.plant += c.plant;
        typed.flex += c.flex;
      });
      const meatBal = sm - typed.meat * feedsAfter;
      const plantBal = sp - typed.plant * feedsAfter;
      const flexIn = sf + Math.min(Math.max(0, tl.foods - tl.foodBeforeFeed), feedsAfter) * FORECAST_FOOD;
      food = {
        m: Math.max(0, meatBal),
        p: Math.max(0, plantBal),
        f: flexIn - Math.max(0, -meatBal) - Math.max(0, -plantBal) - typed.flex * feedsAfter - revive,
      };
      live.forEach((cp) => {
        if (fedSet.has(cp.key)) {
          keep.set(cp.key, feedsAfter ? Math.pow(r, 1.3) : 1);
          prodW.set(cp.key, 0.4 + 0.6 * r);
        } else {
          const survive = [1, 0.75, 0.55, 0.35, 0.12][markerOf(cp)];
          const w = feedsAfter ? Math.pow(rAll, 1.3) * (1 - T.foresight * (1 - survive)) : 0;
          keep.set(cp.key, cp.inactive >= 4 ? 0 : w);
          prodW.set(cp.key, w * 0.6);
        }
      });
      m.foodLeft = left;
    }

    let v = 0;
    let micro = 0;
    let microEncl = 0;
    let triAlive = 0;
    let pachy = 0;
    let bestProd = 0;
    let bestNow = 0;
    live.forEach((cp) => {
      if (!cp.inactive) bestNow = Math.max(bestNow, cp.prod);
      const w = keep.get(cp.key);
      v += compVal(cp) * w;
      const nm = cp.living.filter((d) => d.species === 'microraptor').length;
      if (nm) { micro += nm * w; microEncl += w; }
      if (cp.living.some((d) => d.species === 'triceratops')) triAlive = Math.max(triAlive, w);
      pachy += cp.living.filter((d) => d.species === 'pachy').length * w;
      bestProd = Math.max(bestProd, cp.prod * prodW.get(cp.key));
    });
    v += micro * 2 * microEncl;
    v += triAlive * m.triPlants * 1.5;
    v += m.diamonds * 3;

    if (T.proj) {
      if (tl.feeds) v += Math.min(m.foodLeft || 0, 6) * 0.05;
      const pens = aiVirtualPens(b);
      const fc = (extra) => pens.reduce((mx, pen) => Math.max(mx, aiForecast(m, an, tl, keep, food, { micro, microEncl, pachy }, extra, pen)),
        aiForecast(m, an, tl, keep, food, { micro, microEncl, pachy }, extra, null));
      let f = fc(null) * FORECAST_TRUST;
      if (m.pendingDeck) {
        const pool = [...new Set(state.deck)].filter((sp) => !m.book.includes(sp));
        if (pool.length) {
          const step = Math.max(1, Math.floor(pool.length / 4));
          const sample = pool.filter((_, i) => i % step === 0).slice(0, 4);
          f = (sample.reduce((sum, sp) => sum + fc(sp), 0) / sample.length) * FORECAST_TRUST;
        }
      }
      return v + f + m.extra;
    }

    const spendable = futureActs > 0;
    const prodCoins = bestProd * tl.prods;
    if (futureActs <= 2) v += Math.min(Math.floor(m.coins / 6), futureActs) * 3 + (spendable ? (m.coins % 6) * 0.05 : 0);
    else {
      const usable = Math.min(m.coins, futureActs * 6);
      v += Math.min(usable, COIN_RESERVE) * COIN_VALUE + Math.max(0, usable - COIN_RESERVE) * SURPLUS_COIN_VALUE;
    }
    const spendNow = Math.min(tl.prodsBeforeFeed, tl.prodSpend);
    v += (bestNow * spendNow + bestProd * (tl.prodSpend - spendNow)) * COIN_VALUE;
    v += (pachy * (m.coins + prodCoins * 0.5)) / 5;

    if (tl.feeds) v += Math.min(m.foodLeft || 0, 6) * 0.1;
    else v += 0;

    const freeValid = an.comps.filter((cp) => cp.valid && !cp.dead).reduce((s, cp) => s + cp.empty, 0);
    const actScale = Math.min(1, futureActs / 5);
    v += Math.min(freeValid, 30) * 0.2 * actScale;
    let progress = 0;
    aiPlan().forEach((seg) => {
      const built = seg.filter((e) => b[e[0]][+e.slice(1)]).length;
      if (built && built < seg.length) progress += built / seg.length;
    });
    v += progress * (freeValid > 25 ? 0.8 : 2) * Math.min(1, futureActs / 6);
    return v + m.extra;
  }

  const COMPY_ADJ = [0, 2, 2.5, 3];
  const EVENT_PTS = { gigantoraptor: 2.5, brachiosaurus: 1, trex: 1.5, ankylosaurus: 4, spinosaurus: 3, dilophosaurus: 1 };
  const EVENT_FOOD = { stegosaurus: 10, carnotaurus: 14, dilophosaurus: 5 };
  const EVENT_COINS = { dilophosaurus: 5 };

  // Hard: greedy play-out of the rest of the game. Spends each remaining action on the best of
  // playing a dino (buying missing diamonds first), dino powers, taking coins or buying diamonds,
  // limited by money, enclosure space, species rules and the food the park can sustain.
  // Returns the points it expects to add from here on.
  function aiForecast(m, an, tl, keep, food0, base, extraSp, pen) {
    const encl = [];
    an.comps.forEach((cp) => {
      if (!cp.valid || cp.dead) return;
      const w = cp.living.length ? keep.get(cp.key) : 1;
      if (w < 0.35) return;
      const e = { empty: cp.empty, species: new Set(cp.species), slots: 1 + cp.waters.length, prod: cp.prod, w, asleep: cp.inactive > 0, compy: 0, micro: false, para: 0, tri: false, allo: false, raptor: 0 };
      cp.living.forEach((d) => {
        if (d.species === 'compy') e.compy++;
        else if (d.species === 'microraptor') e.micro = true;
        else if (d.species === 'parasaurolophus') e.para++;
        else if (d.species === 'triceratops') e.tri = true;
        else if (d.species === 'allosaurus') e.allo = true;
        else if (d.species === 'velociraptor') e.raptor++;
      });
      encl.push(e);
    });
    const book = [...new Set(extraSp ? m.book.concat([extraSp]) : m.book)];
    const slots = [];
    for (let i = 0; i < m.actsLeft; i++) slots.push(0);
    for (let r = 1; r <= tl.acts; r++) slots.push(r, r);
    slots.splice(0, Math.min(slots.length, (m.actsPenalty || 0) + (pen ? pen.acts : 0)));
    // A planned enclosure is fenced first, using up the actions those fences take.
    if (pen) encl.push({ empty: pen.size, species: new Set(), slots: 1, prod: 0, w: 1, asleep: false, compy: 0, micro: false, para: 0, tri: false, allo: false, raptor: 0 });

    let coins = m.coins;
    let dia = m.diamonds;
    let pts = 0;
    let fm = food0.m;
    let fp = food0.p;
    let ff = food0.f;
    const canFeed = (t, need) => need <= (t === 'meat' ? fm : t === 'plant' ? fp : fm + fp) + ff + 1e-9;
    const payFeed = (t, need) => {
      if (t === 'flex') {
        const a = Math.min(need, Math.max(fm, fp) === fm ? fm : fp);
        if (fm >= fp) fm -= a; else fp -= a;
        ff -= need - a;
        return;
      }
      const a = Math.min(need, t === 'meat' ? fm : fp);
      if (t === 'meat') fm -= a; else fp -= a;
      ff -= need - a;
    };
    let micro = base.micro;
    let microEncl = base.microEncl;
    let pachy = base.pachy;
    let best = encl.reduce((mx, e) => Math.max(mx, e.w >= 0.6 ? e.prod : 0), 0);
    // Inactive enclosures earn nothing until they are fed again at the next Feeding.
    const awakeBest = () => encl.reduce((mx, e) => Math.max(mx, e.w >= 0.6 && !e.asleep ? e.prod : 0), 0);
    let lastR = 0;
    let skip = 0;
    for (let j = 0; j < slots.length; j++) {
      const r = slots[j];
      if (r !== lastR) {
        coins += r === 1 ? best - (best - awakeBest()) * Math.min(1, tl.prodsBeforeFeed) : best;
        lastR = r;
      }
      if (skip) { skip--; continue; }
      const left = slots.length - j - 1;
      const roundsLeft = Math.max(0, tl.acts - r);
      const feedsLeft = r === 0 ? tl.feeds : Math.max(0, tl.feeds - r + 0.5);
      const lam = left > 0 && coins < 6 * (left + 1) ? 0.5 : 0;
      let pick = null;
      const consider = (score, acts, apply) => {
        if (!pick || score / acts > pick.score / pick.acts) pick = { score, acts, apply };
      };
      if (left > 0) consider(3 * lam, 1, () => { coins += 3; });
      if (coins >= 6) consider(3 - 6 * lam, 1, () => { coins -= 6; dia++; pts += 3; });
      encl.forEach((e) => {
        if (e.w < 0.6) return;
        if (e.para) consider(2 * e.para * lam, 1, () => { coins += 2 * e.para; });
        if (e.tri) consider(1.5, 1, () => { pts += 1.5; });
        if (e.allo) consider(3 * lam + 0.7, 1, () => { coins += 3; });
        if (e.raptor) consider(0.6 * e.raptor, 1, () => { ff += 2 * e.raptor; });
      });
      book.forEach((sp) => {
        const S = SPECIES[sp];
        const need = S.food.n * feedsLeft;
        const gainFood = EVENT_FOOD[sp] || 0;
        let feedNeed = need;
        let cyc = false;
        if (need > 0 && !canFeed(S.food.t, need - gainFood)) {
          // Can't feed it every time: feed it every few Feedings instead (surcharge, less production).
          feedNeed = (S.food.n + 2) * Math.ceil(feedsLeft / 3.5);
          if (!canFeed(S.food.t, feedNeed - gainFood)) return;
          cyc = true;
        }
        const missing = Math.max(0, S.cost.d - dia);
        const acts = 1 + missing;
        if (acts > left + 1) return;
        const coinCost = S.cost.c + 6 * missing;
        if (coins < coinCost) return;
        encl.forEach((e) => {
          if (e.empty < S.space) return;
          if (!e.species.has(sp) && e.species.size >= e.slots) return;
          let got = S.pts;
          if (sp === 'compy') got += COMPY_ADJ[Math.min(3, e.compy)];
          if (sp === 'microraptor') got += 2 * (micro + 1) * (microEncl + (e.micro ? 0 : 1)) - 2 * micro * microEncl;
          got = got * e.w * (cyc ? 0.85 : 1) + (EVENT_PTS[sp] || 0);
          const newBest = e.w >= 0.6 && !cyc ? Math.max(best, e.prod + S.prod) : best;
          const score = got + (newBest - best) * roundsLeft * 0.45 + (EVENT_COINS[sp] || 0) * lam + gainFood * 0.05 +
            (sp === 'pachy' ? 2 : 0) - coinCost * lam - (S.cost.d - missing) * 3;
          consider(score, acts, () => {
            coins -= coinCost;
            coins += EVENT_COINS[sp] || 0;
            dia += missing - S.cost.d;
            pts += got;
            ff += gainFood;
            payFeed(S.food.t, feedNeed);
            e.empty -= S.space;
            e.species.add(sp);
            e.prod += S.prod;
            best = newBest;
            if (sp === 'compy') e.compy++;
            else if (sp === 'microraptor') {
              micro += e.w;
              if (!e.micro) { microEncl += e.w; e.micro = true; }
            } else if (sp === 'pachy') pachy += e.w;
            else if (sp === 'parasaurolophus') e.para++;
            else if (sp === 'triceratops') e.tri = true;
            else if (sp === 'allosaurus') e.allo = true;
            else if (sp === 'velociraptor') e.raptor++;
          });
        });
      });
      if (pick && pick.score > 0) {
        pick.apply();
        skip = pick.acts - 1;
      }
    }
    return pts + pachy * Math.floor(Math.max(0, coins) / 5);
  }

  // Hard plans its own fences: try rectangles of every size and place, value the finished
  // enclosure with the forecast (minus the actions the fences cost) and keep the best few.
  const aiCtx = { targets: [] };

  function rectNeed(b, r0, c0, h, w) {
    for (let r = r0; r < r0 + h; r++) {
      for (let c = c0; c < c0 + w; c++) {
        if (b.cells[r * N + c] !== 0) return null;
        if (c < c0 + w - 1 && b.v[r * 9 + c]) return null;
        if (r < r0 + h - 1 && b.h[r * N + c]) return null;
      }
    }
    const need = [];
    for (let c = c0; c < c0 + w; c++) {
      if (r0 > 0 && !b.h[(r0 - 1) * N + c]) need.push('h' + ((r0 - 1) * N + c));
      if (r0 + h < N && !b.h[(r0 + h - 1) * N + c]) need.push('h' + ((r0 + h - 1) * N + c));
    }
    for (let r = r0; r < r0 + h; r++) {
      if (c0 > 0 && !b.v[r * 9 + c0 - 1]) need.push('v' + (r * 9 + c0 - 1));
      if (c0 + w < N && !b.v[r * 9 + c0 + w - 1]) need.push('v' + (r * 9 + c0 + w - 1));
    }
    return need;
  }

  function aiTargetCands(b, book) {
    const spaces = [...new Set(book.map((sp) => SPECIES[sp].space))];
    if (!spaces.length) return [];
    const minSpace = Math.min(...spaces);
    const buckets = [[], [], [], [], []];
    const bucketOf = (n) => (n <= 3 ? 0 : n <= 6 ? 1 : n <= 10 ? 2 : n <= 16 ? 3 : 4);
    for (let r0 = 0; r0 < N; r0++) {
      for (let c0 = 0; c0 < N; c0++) {
        for (let h = 1; r0 + h <= N; h++) {
          for (let w = 1; c0 + w <= N; w++) {
            const size = h * w;
            if (size > 30) break;
            const need = rectNeed(b, r0, c0, h, w);
            if (!need) break;
            if (size < minSpace || !need.length || need.length > 14) continue;
            if ((r0 === 0) + (r0 + h === N) + (c0 === 0) + (c0 + w === N) > 2) continue;
            let fit = 0;
            spaces.forEach((sz) => { if (sz <= size) fit = Math.max(fit, (Math.floor(size / sz) * sz) / size); });
            buckets[bucketOf(size)].push({ need, size, r0, c0, h, w, score: (fit * size) / (need.length + 1.5) });
          }
        }
      }
    }
    const out = [];
    buckets.forEach((list) => {
      list.sort((x, y) => y.score - x.score);
      const seen = new Set();
      for (const c of list) {
        const key = c.need.slice().sort().join();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(c);
        if (seen.size >= 7) break;
      }
    });
    return out;
  }

  function aiPrepTargets(m0, tl) {
    aiCtx.targets = [];
    if (!tune().proj || tl.acts + m0.actsLeft === 0) return;
    const b = m0.board;
    const base = aiEval(m0, tl);
    const found = [];
    aiTargetCands(b, m0.book).forEach((c) => {
      if (fenceProblem(b, c.need)) return;
      const m2 = copyModel(m0);
      applyEdges(m2.board, c.need);
      m2.actsPenalty = Math.ceil(c.need.length / 2);
      const gain = (aiEval(m2, tl) - base) * 0.8 - 0.25 * c.need.length;
      if (gain > 1) found.push(Object.assign({}, c, { gain }));
    });
    found.sort((x, y) => y.gain - x.gain);
    aiCtx.targets = found.slice(0, 3);
  }

  // Planned enclosures not finished yet on board b, with the fence actions they still need.
  function aiVirtualPens(b) {
    const out = [];
    aiCtx.targets.forEach((t) => {
      const left = t.need.filter((e) => !b[e[0]][+e.slice(1)]).length;
      if (!left) return;
      for (let r = t.r0; r < t.r0 + t.h; r++) {
        for (let c = t.c0; c < t.c0 + t.w; c++) if (b.cells[r * N + c] !== 0) return;
      }
      out.push({ size: t.size, acts: Math.ceil(left / 2), edges: left });
    });
    return out;
  }

  function aiTargetEdges(b, t, max) {
    const legal = new Set(legalEdgesB(b));
    const todo = t.need.filter((e) => !b[e[0]][+e.slice(1)] && legal.has(e)).slice(0, max);
    return todo.length && !fenceProblem(b, todo) ? todo : [];
  }

  function aiFenceEdges(b, max) {
    if (tune().proj) {
      const out = [];
      for (const t of aiCtx.targets) {
        if (out.length >= max) break;
        const more = aiTargetEdges(withEdges(b, out), t, max - out.length);
        if (more.length && !fenceProblem(b, out.concat(more))) out.push(...more);
      }
      return out;
    }
    return aiPlanEdgesB(b, max);
  }

  function aiEvent(m, sp, tl) {
    switch (sp) {
      case 'stegosaurus': addFood(m, 10); break;
      case 'carnotaurus': addFood(m, 14); break;
      case 'brachiosaurus': m.extra += fillHarm(m.p, 5); break;
      case 'trex': m.extra += trexHarm(m.p); break;
      case 'gigantoraptor': if (tl.future > 0) m.extra += 3; break;
      case 'dilophosaurus': {
        m.coins += 5;
        addFood(m, 5);
        const edges = aiFenceEdges(m.board, 5);
        if (edges.length) applyEdges(m.board, edges);
        if (tune().proj) m.pendingDeck = (m.pendingDeck || 0) + 1;
        else m.extra += m.faceUp.some(Boolean) ? Math.max(...m.faceUp.filter(Boolean).map((x) => cardValue(x, tl))) : deckValue(m, tl);
        break;
      }
      case 'spinosaurus': {
        const opt = aiSpinoPick(m, tl);
        aiSpinoApply(m, opt);
        if (tune().proj) m.pendingDeck = (m.pendingDeck || 0) + 1;
        else m.extra += deckValue(m, tl);
        break;
      }
      case 'ankylosaurus': {
        const free = aiActions(m, tl, true);
        let best = null;
        free.forEach((a) => {
          const n = aiApply(m, a, tl, true);
          const val = aiEval(n, tl);
          if (!best || val > best.val) best = { n, val };
        });
        if (best) Object.assign(m, best.n, { actsLeft: m.actsLeft });
        break;
      }
      default: break;
    }
  }

  function aiSpinoApply(m, o) {
    if (o === 'dia') m.diamonds++;
    else if (o === 'coins') m.coins += 5;
    else if (o === 'food') addFood(m, 15);
    else m.extra += fillHarm(m.p, 10);
  }

  function aiSpinoPick(m, tl) {
    let best = null;
    ['dia', 'coins', 'food', 'fill'].forEach((o) => {
      const n = copyModel(m);
      aiSpinoApply(n, o);
      const val = aiEval(n, tl);
      if (!best || val > best.val) best = { o, val };
    });
    return best.o;
  }

  function aiActions(m, tl, freeOnly) {
    const b = m.board;
    const out = [];
    const seen = new Set();
    m.book.forEach((sp) => {
      if (seen.has(sp)) return;
      seen.add(sp);
      const S = SPECIES[sp];
      if (freeOnly ? S.pts > 5 : !affordM(m, S.cost)) return;
      if (tune().proj) {
        analyze(b).comps.forEach((cp) => {
          if (!cp.valid || cp.dead || cp.empty < S.space) return;
          const cells = aiFindCellsB(b, S.space, sp, cp.key);
          if (cells) out.push({ kind: freeOnly ? 'free' : 'play', sp, cells });
        });
        return;
      }
      const cells = aiFindCellsB(b, S.space, sp);
      if (cells) out.push({ kind: freeOnly ? 'free' : 'play', sp, cells });
    });
    if (freeOnly) return out;
    out.push({ kind: 'gain3' });
    if (tune().proj) {
      const seenE = new Set();
      aiCtx.targets.forEach((t) => {
        const edges = aiTargetEdges(b, t, 2);
        const key = edges.slice().sort().join();
        if (edges.length && !seenE.has(key)) { seenE.add(key); out.push({ kind: 'fences', edges }); }
      });
    } else {
      const edges = aiPlanEdgesB(b, 2);
      if (edges.length) out.push({ kind: 'fences', edges });
    }
    if (m.coins >= 6) out.push({ kind: 'diamond' });
    const feeder = aiFeederB(m);
    if (feeder) out.push(feeder);
    const an = analyze(b);
    an.comps.filter((cp) => cp.active).forEach((cp) => {
      const counts = {};
      cp.living.forEach((d) => { if (SPECIES[d.species].type === 'action') counts[d.species] = (counts[d.species] || 0) + 1; });
      Object.keys(counts).forEach((sp) => out.push({ kind: 'dinoAct', sp, key: cp.key, count: counts[sp] }));
    });
    m.faceUp.forEach((sp, i) => { if (sp && !m.book.includes(sp)) out.push({ kind: 'draw', from: i, sp }); });
    if (m.deck > 0) out.push({ kind: 'draw', from: 'deck' });
    return out;
  }

  function aiApply(m, a, tl, keepActs) {
    const n = copyModel(m);
    if (!keepActs) n.actsLeft = Math.max(0, m.actsLeft - 1);
    switch (a.kind) {
      case 'gain3': n.coins += 3; break;
      case 'diamond': n.coins -= 6; n.diamonds++; break;
      case 'fences': applyEdges(n.board, a.edges); break;
      case 'feeder': payM(n, feederCost(a.cells.length)); placeItemB(n.board, 'feeder', a.cells); break;
      case 'play':
      case 'free':
        if (a.kind === 'play') payM(n, SPECIES[a.sp].cost);
        placeItemB(n.board, 'dino', a.cells, a.sp);
        aiEvent(n, a.sp, tl);
        break;
      case 'dinoAct':
        if (a.sp === 'triceratops') n.triPlants++;
        else if (a.sp === 'parasaurolophus') n.coins += 2 * a.count;
        else if (a.sp === 'allosaurus') {
          const s = Math.min(3, n.opp.coins);
          n.coins += s;
          n.opp.coins -= s;
          n.extra += s * COIN_VALUE * OPP_WEIGHT;
        } else if (a.sp === 'velociraptor') {
          const s = Math.min(2 * a.count, n.opp.food);
          addFood(n, s);
          n.opp.food -= s;
          n.extra += s * 0.3 * OPP_WEIGHT;
        }
        break;
      case 'draw':
        if (a.from === 'deck') {
          if (tune().proj) n.pendingDeck = (n.pendingDeck || 0) + 1;
          else n.extra += deckValue(n, tl);
          n.deck--;
        } else {
          if (!tune().proj) n.extra += cardValue(a.sp, tl) + 0.3;
          n.book.push(a.sp);
          n.faceUp[a.from] = null;
        }
        break;
      default: break;
    }
    return n;
  }

  function styleBias(a) {
    const st = AI_STYLES[aiCfg().style];
    const sp = a.sp && (a.kind === 'play' || a.kind === 'free') ? st.sp[a.sp] || 0 : 0;
    return (sp + (st.act[a.kind] || 0)) * tune().style;
  }

  function pickBest(scored) {
    scored.sort((x, y) => y.v - x.v);
    const T = tune();
    const close = scored.filter((x, i) => i > 0 && i <= 3 && scored[0].v - x.v < 4);
    if (T.blunder && close.length && Math.random() < T.blunder) return close[rand(close.length)];
    return scored[0];
  }

  function aiChooseAction(p, T) {
    const tl = aiTimeline(T.k);
    const m0 = aiModel(p, T.remaining);
    aiPrepTargets(m0, tl);
    const depth = tune().depth;
    const scored = aiActions(m0, tl).map((a) => {
      const m1 = aiApply(m0, a, tl);
      let v = aiEval(m1, tl);
      if (depth > 1 && m1.actsLeft > 0) {
        aiActions(m1, tl).forEach((a2) => {
          v = Math.max(v, aiEval(aiApply(m1, a2, tl), tl));
        });
      }
      return { a, v: v + styleBias(a) + noise(tune().noise) };
    });
    return pickBest(scored).a;
  }

  function aiFoodPick(p, T) {
    const tl = aiTimeline(T.k);
    const P = state.players[p];
    aiPrepTargets(aiModel(p, 0), tl);
    const plan = aiFenceEdges(P.board, T.amount);
    const scored = [];
    for (let f = 0; f <= plan.length; f++) {
      const food = T.amount - f;
      const base = aiModel(p, 0);
      if (f) applyEdges(base.board, plan.slice(0, f));
      const meats = new Set([clamp(aiSplitFood(base.board, base.meat, base.plants, food), 0, food), 0, food, Math.floor(food / 2), Math.ceil(food / 2)]);
      meats.forEach((meat) => {
        const n = copyModel(base);
        n.meat += meat;
        n.plants += food - meat;
        scored.push({ edges: plan.slice(0, f), meat, plant: food - meat, v: aiEval(n, tl) + noise(tune().noise * 0.6) + (f ? (AI_STYLES[aiCfg().style].act.fences || 0) * 0.3 * tune().style : 0) });
      });
    }
    return pickBest(scored);
  }

  // How much of `amount` new food to take as meat (the rest is plants), between lo and hi.
  function aiMeatPick(p, amount, lo, hi) {
    const P = state.players[p];
    const guess = clamp(aiSplitFood(P.board, P.meat, P.plants, amount), lo, hi);
    if (!tune().proj) return guess;
    const next = state.queue.find((t) => t.k != null);
    const tl = aiTimeline(next ? next.k : null);
    const act = state.queue.find((t) => t.t === 'actions' && t.p === p);
    const base = aiModel(p, act ? act.remaining : 0);
    aiCtx.targets = [];
    let best = { meat: guess, v: -Infinity };
    new Set([guess, lo, hi, Math.floor((lo + hi) / 2), Math.ceil((lo + hi) / 2)]).forEach((meat) => {
      const n = copyModel(base);
      n.meat += meat;
      n.plants += amount - meat;
      const v = aiEval(n, tl);
      if (v > best.v) best = { meat, v };
    });
    return best.meat;
  }

  function aiFeedPick(p, T) {
    const P = state.players[p];
    const list = feedables(analyze(P.board));
    if (aiCfg().level === 'easy') return defaultFeed(p);
    const tl = aiTimeline(T.k);
    const score = (keys) => {
      const tot = sumCosts(list.filter((cp) => keys.has(cp.key)).map(enclosureCost));
      if (!canPayFood(P, tot)) return -Infinity;
      const m = aiModel(p, 0);
      payFoodM(m, tot);
      simulateFeedB(m.board, list, keys);
      return aiEval(m, tl) + noise(tune().noise * 0.3);
    };
    if (list.length <= 8) {
      let best = null;
      for (let mask = (1 << list.length) - 1; mask >= 0; mask--) {
        const keys = new Set(list.filter((_, i) => mask & (1 << i)).map((cp) => cp.key));
        const v = score(keys);
        if (v > -Infinity && (!best || v > best.v)) best = { v, keys };
      }
      return best ? best.keys : defaultFeed(p);
    }
    // Too many enclosures to try every mix: improve the default pick one swap at a time.
    let keys = defaultFeed(p);
    let v = score(keys);
    for (let pass = 0; pass < 4; pass++) {
      let improved = false;
      list.forEach((cp) => {
        const flip = new Set(keys);
        if (flip.has(cp.key)) flip.delete(cp.key); else flip.add(cp.key);
        const tries = [flip];
        if (!keys.has(cp.key)) keys.forEach((k) => { const sw = new Set(flip); sw.delete(k); tries.push(sw); });
        tries.forEach((t) => {
          const tv = score(t);
          if (tv > v + 1e-6) { v = tv; keys = t; improved = true; }
        });
      });
      if (!improved) break;
    }
    return keys;
  }

  function aiRubbleCells(q, n) {
    const b = state.players[q].board;
    const an = analyze(b);
    const scored = [];
    for (let i = 0; i < 100; i++) {
      if (b.cells[i] !== 0) continue;
      const cp = an.comps[an.compOf[i]];
      const checker = (Math.floor(i / N) + (i % N)) % 2 === 0 ? 2 : 0;
      const s = cp.valid && !cp.dead ? 10 + cp.empty * 0.4 + checker : checker * 0.5 + Math.random();
      scored.push([s + Math.random() * (aiCfg().level === 'easy' ? 8 : 0.5), i]);
    }
    return scored.sort((a, b) => b[0] - a[0]).slice(0, n).map((x) => x[1]);
  }

  function aiDrawPick(p, deckOnly) {
    const tl = aiTimeline(cur().k);
    const m = aiModel(p, 0);
    if (tune().proj) {
      aiCtx.targets = [];
      let pick = { from: 'deck', v: -Infinity };
      if (state.deck.length) pick.v = aiEval(Object.assign(copyModel(m), { pendingDeck: 1 }), tl);
      if (!deckOnly) {
        state.faceUp.forEach((sp, i) => {
          if (!sp) return;
          const n = copyModel(m);
          n.book.push(sp);
          const v = aiEval(n, tl);
          if (v > pick.v) pick = { from: i, v };
        });
      }
      return pick.from;
    }
    let best = { from: 'deck', v: state.deck.length ? deckValue(m, tl) : -1 };
    if (!deckOnly) {
      state.faceUp.forEach((sp, i) => {
        if (!sp) return;
        const v = (m.book.includes(sp) ? 0 : cardValue(sp, tl)) + noise(tune().noise * 0.3);
        if (v > best.v) best = { from: i, v };
      });
    }
    return best.from;
  }

  function aiDelay(ms) {
    return ms * PACE_MULT[aiCfg().pace];
  }

  function aiSchedule() {
    if (aiTimer || aiPending || busy) return;
    const T = cur();
    if (!isAiTask(T)) return;
    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (busy || aiPending) { aiSchedule(); return; }
      const now = cur();
      if (isAiTask(now)) aiStep(now);
    }, aiDelay(T.t === 'roll' || T.t === 'gainFood' ? 1100 : 850));
  }

  function aiShow(note, then) {
    const token = state;
    ui.aiNote = note;
    aiPending = true;
    render();
    setTimeout(() => {
      aiPending = false;
      if (state !== token) return;
      then();
    }, aiDelay(900));
  }

  function aiPlace(sp, cells, free) {
    if (!free) handle('mode', { m: 'play' });
    handle('pickSpecies', { sp });
    if (!ui.sel) {
      if (free) handle('skip', {});
      else handle('mode', { m: 'gain3' });
      return;
    }
    ui.sel.cells = new Set(cells);
    document.getElementById('boards')._html = null;
    aiShow(`Playing ${spName(sp)}${free ? ' for free' : ''}…`, () => handle('place', {}));
  }

  function aiStep(T) {
    const p = T.p;
    const panel = document.getElementById('panel');
    lastClickRect = panel ? panel.getBoundingClientRect() : null;
    switch (T.t) {
      case 'roll': aiShow('Rolling the die…', () => handle('roll', {})); return;
      case 'carno': aiShow('Rolling for Carnotaurus…', () => handle('carnoRoll', {})); return;
      case 'gainFood': {
        if (T.amount == null) { aiShow('Rolling the bonus die…', () => handle('rollBonus', {})); return; }
        const pick = aiFoodPick(p, T);
        ui.meat = pick.meat;
        ui.plant = pick.plant;
        ui.sel.edges = new Set(pick.edges);
        document.getElementById('boards')._html = null;
        const food = pick.meat + pick.plant;
        aiShow(`Taking ${food} food${pick.edges.length ? ` and ${plural(pick.edges.length, 'fence')}` : ''}…`, () => handle('confirmGain', {}));
        return;
      }
      case 'feed': {
        ui.feed = aiFeedPick(p, T);
        const names = feedables(analyze(state.players[p].board)).filter((cp) => ui.feed.has(cp.key)).map((cp) => cp.name);
        aiShow(names.length ? `Feeding enclosure${names.length > 1 ? 's' : ''} ${names.join(', ')}…` : 'Not feeding this time…', () => handle('confirmFeed', {}));
        return;
      }
      case 'produce': {
        const best = producible(p).sort((a, b) => b.prod - a.prod)[0];
        aiShow(`Collecting 🪙${best.prod} from enclosure ${best.name}…`, () => handle('produce', { key: best.key }));
        return;
      }
      case 'foodChoice': {
        const P = state.players[p];
        ui.meat = aiMeatPick(p, T.amount, 0, T.amount);
        aiShow('Choosing food…', () => handle('confirmFood', {}));
        return;
      }
      case 'steal': {
        const P = state.players[p];
        const [lo, hi] = stealRange(T);
        ui.meat = aiMeatPick(p, T.amount, lo, hi);
        aiShow('Stealing food…', () => handle('confirmSteal', {}));
        return;
      }
      case 'drawFences':
        aiPrepTargets(aiModel(p, 0), aiTimeline(T.k));
        ui.sel.edges = new Set(aiFenceEdges(state.players[p].board, T.count));
        document.getElementById('boards')._html = null;
        aiShow('Building fences…', () => handle('confirmFences', {}));
        return;
      case 'fillOpp':
        ui.sel.cells = new Set(aiRubbleCells(other(p), ui.sel.need));
        document.getElementById('boards')._html = null;
        aiShow('Filling in your squares…', () => handle('place', {}));
        return;
      case 'drawCard': {
        const from = aiDrawPick(p, T.source === 'deck');
        aiShow(from === 'deck' ? 'Drawing from the deck…' : `Taking ${spName(state.faceUp[from])}…`, () => handle('take', { from: String(from) }));
        return;
      }
      case 'spino': {
        const o = aiSpinoPick(aiModel(p, 0), aiTimeline(T.k));
        const label = { dia: 'a diamond', coins: '5 coins', food: '15 food', fill: 'to fill your squares' }[o];
        aiShow(`Spinosaurus: choosing ${label}…`, () => handle('spino', { o }));
        return;
      }
      case 'trex': {
        const O = state.players[other(p)];
        const onBoard = (sp) => Object.values(O.board.items).filter((it) => it.species === sp && !it.dead).length;
        const score = (sp) => onBoard(sp) * 3 + SPECIES[sp].pts + (canAfford(O, SPECIES[sp].cost) ? 4 : 0) + noise(tune().noise);
        const sp = trexOptions(p).map((x) => ({ x, s: score(x) })).sort((a, b) => b.s - a.s)[0].x;
        aiShow(`T. Rex: blocking your ${spName(sp)}…`, () => handle('trex', { sp }));
        return;
      }
      case 'freePlay': {
        const tl = aiTimeline(T.k);
        const m = aiModel(p, 0);
        const scored = aiActions(m, tl, true).map((a) => ({ a, v: aiEval(aiApply(m, a, tl, true), tl) + styleBias(a) + noise(tune().noise) }));
        if (!scored.length) { handle('skip', {}); return; }
        const a = pickBest(scored).a;
        aiPlace(a.sp, a.cells, true);
        return;
      }
      case 'actions': {
        const c = aiChooseAction(p, T);
        if (c.kind === 'play') { aiPlace(c.sp, c.cells, false); return; }
        if (c.kind === 'fences') {
          handle('mode', { m: 'fences2' });
          ui.sel.edges = new Set(c.edges);
          document.getElementById('boards')._html = null;
          aiShow('Building 2 fences…', () => handle('confirmFences', {}));
          return;
        }
        if (c.kind === 'diamond') { aiShow('Buying a diamond…', () => handle('buyDiamond', {})); return; }
        if (c.kind === 'feeder') {
          handle('mode', { m: 'shop' });
          handle('shopItem', { item: 'feeder' });
          ui.sel.cells = new Set(c.cells);
          document.getElementById('boards')._html = null;
          aiShow('Building a feeder…', () => handle('place', {}));
          return;
        }
        if (c.kind === 'dinoAct') { aiShow(`Using ${spName(c.sp)}’s power…`, () => handle('dinoAct', { sp: c.sp, key: String(c.key) })); return; }
        if (c.kind === 'draw') {
          aiShow(c.from === 'deck' ? 'Drawing from the deck…' : `Drawing ${spName(c.sp)}…`, () => {
            handle('mode', { m: 'draw' });
            handle('take', { from: String(c.from) });
          });
          return;
        }
        aiShow('Taking 3 coins…', () => handle('mode', { m: 'gain3' }));
        return;
      }
      default:
        break;
    }
  }

  // ---------------------------------------------------------------- events wiring
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) {
      const cell = e.target.closest && e.target.closest('[data-cell]');
      if (cell && state && !drag) {
        const v = state.players[+cell.dataset.p].board.cells[+cell.dataset.cell];
        if (v > 0) openPiece(+cell.dataset.p, v);
      }
      return;
    }
    if (el.disabled) return;
    if (isAiTask(cur()) && !FREE_ACTS.has(el.dataset.act)) {
      toast('🤖 Hang on — it’s the computer’s turn.');
      return;
    }
    lastClickRect = el.getBoundingClientRect();
    handle(el.dataset.act, el.dataset, el, e);
  });

  document.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest && e.target.closest('[data-cell]');
    if (!cell || !ui.sel || ui.sel.type !== 'cells' || busy || isAiTask(cur())) return;
    const p = +cell.dataset.p;
    if (p !== ui.sel.board) return;
    const i = +cell.dataset.cell;
    const b = state.players[p].board;
    if (b.cells[i] !== 0) return;
    e.preventDefault();
    const adding = !ui.sel.cells.has(i);
    drag = { adding, p };
    applyCell(i, adding, true);
  });

  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el && el.closest && el.closest('[data-cell]');
    if (!cell || +cell.dataset.p !== drag.p) return;
    applyCell(+cell.dataset.cell, drag.adding, false);
  });

  const endDrag = () => { drag = null; };
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // ---------------------------------------------------------------- boot
  state = load();
  if (state) {
    autoResolve();
    prepareUi();
  }
  render();
})();
