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
    action: 'Use it with the “Use a dino power” action while its enclosure is awake.',
    scoring: 'Adds points at the end of the game if its enclosure is awake.',
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
    feed: { name: 'Feeding', short: 'Feeding', icon: '🍖', desc: 'Feed your dinos or they fall asleep.' },
    produce: { name: 'Production', short: 'Production', icon: '🪙', desc: 'Collect coins from one enclosure.' },
    action: { name: 'Actions', short: 'Actions', icon: '⚡', desc: 'Do 2 things (the same one twice is fine).' },
  };
  const PHASE_KEYS = Object.keys(PHASES);

  const ENCLOSURE_TINTS = ['#f3e5ab', '#d8ecc2', '#f6d7b0', '#cfe6e3', '#ead9f0', '#f9dede', '#dfe7f7', '#fff0c2', '#e4f2d0', '#f2e0cc'];

  const IMG = '/img/dino-game/';
  const MASCOT = ['trex', 'brachiosaurus'];
  const TOKEN_ALT = {
    coin: 'coins', diamond: 'diamonds', meat: 'meat', plant: 'plants', fence: 'fence', sleep: 'asleep',
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
    const b = state.players[p].board;
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
    const b = state.players[p].board;
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
  function enclosureCost(cp) {
    const c = { meat: 0, plant: 0, flex: 0 };
    const extra = cp.inactive || 0;
    cp.living.forEach((d) => {
      const f = SPECIES[d.species].food;
      c[f.t] += Math.max(0, f.n + extra - cp.feederSquares);
    });
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

  function newGame(names, first, ai) {
    resetFx();
    const deck = shuffle(DECK.slice());
    const faceUp = [deck.shift(), deck.shift()];
    state = {
      v: 1,
      ai: ai == null ? null : ai,
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
    else if (cp.inactive) status = `<span class="status-pill ${cp.inactive >= 4 ? 'danger' : 'warn'}">💤 Asleep · marker ${cp.inactive}</span> No coins or points until every dino here is fed.${cp.inactive >= 4 ? ' <b>If not fed next Feeding, they die!</b>' : ''}`;
    else status = '<span class="status-pill ok">Awake</span> Earning coins and points.';
    const facts = [`<li><b>${encl}</b> · ${status}</li>`];
    let card = '';
    if (it.kind === 'dino') {
      const S = SPECIES[it.species];
      card = cardHtml(it.species, { cls: 'solo' });
      if (!it.dead) {
        const eats = Math.max(0, S.food.n + (cp.inactive || 0) - cp.feederSquares);
        const why = [];
        if (cp.inactive) why.push(`+${cp.inactive} because it’s asleep`);
        if (cp.feederSquares) why.push(`−${cp.feederSquares} from the feeder`);
        facts.push(`<li>Eats <b>${eats} ${foodText({ t: S.food.t, n: '' }).trim()}</b> each Feeding${why.length ? ` <span class="muted">(card says ${S.food.n}; ${why.join(', ')})</span>` : ''}.</li>`);
        facts.push(`<li>Adds <b>🪙${S.prod}</b> when you pick ${encl.replace('Enclosure', 'enclosure')} in Production (whole enclosure makes 🪙${cp.prod}).</li>`);
        facts.push(`<li>Worth <b>${S.pts} point${S.pts === 1 ? '' : 's'}</b> at the end if awake.</li>`);
        facts.push(`<li><b>${TYPE_LABEL[S.type]}:</b> ${TYPE_HELP[S.type]}</li>`);
      }
    } else if (it.kind === 'feeder') {
      card = `<div class="piece-art">🌾</div>`;
      facts.push(`<li>${plural(it.cells.length, 'square')}: every dino in ${encl.toLowerCase()} eats <b>${it.cells.length} less</b> food (never below 0).</li>`);
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
      const asleep = itComp && itComp.valid && !itComp.dead && itComp.inactive;
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
      out.push(`<g class="piece${fresh ? ' drop' : ''}${asleep ? ' zz' : ''}">${g.join('')}</g>`);
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
        const bw = danger ? 150 : 132;
        const cx = Math.min(Math.max(X(midC) + CS / 2, PAD + bw / 2 + 2), W - PAD - bw / 2 - 2);
        const cy = Y(botR) + CS - 17;
        out.push(`<g class="sleep-tok${danger ? ' danger' : ''}" pointer-events="none">`
          + `<rect x="${cx - bw / 2}" y="${cy - 14}" width="${bw}" height="28" rx="14" fill="${danger ? '#c62828' : '#22305a'}" stroke="#fff" stroke-width="2"/>`
          + `<image href="${IMG}sleep.webp" x="${cx - bw / 2 + 1}" y="${cy - 15}" width="30" height="30"/>`
          + `<text x="${cx + 14}" y="${cy + 5.5}" text-anchor="middle" font-size="15" font-weight="800" fill="#fff">${danger ? 'LAST CHANCE!' : `ASLEEP ${cp.inactive}/4`}</text></g>`);
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
      '<span>💤 Asleep (hungry)</span>',
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
    const changed = setHtml(el, [0, 1]
      .map((p) => {
        const P = state.players[p];
        const sc = scorePlayer(p).total;
        const bonus = P.bonusNext + P.bonusPending;
        const chips = RES.map(([k, img, label]) => chip(tok(img), P[k], label, k, resFx[p][k])).join('');
        return `<div class="player pl-${P.color}${p === activeP ? ' active' : ''}${p === target ? ' target' : ''}" data-player="${p}">
          <div class="p-head">
            <div class="p-name"><img class="p-mascot" src="${IMG}${MASCOT[p]}.webp" alt="">${esc(P.name)}${p === state.first ? ' <span class="tag">1st</span>' : ''}${p === activeP ? ' <span class="tag turn-tag">TURN</span>' : ''}${p === target ? ' <span class="tag target-tag">TARGET</span>' : ''}</div>
            <div class="p-score" title="Score if the game ended right now">⭐ ${sc}</div>
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
        if (!cp.inactive) status = '<span class="status-pill ok">awake</span>';
        else if (cp.inactive >= 4) status = `<span class="status-pill danger">💤 last chance!</span>`;
        else status = `<span class="status-pill warn">💤 asleep ${cp.inactive}/4</span>`;
        const extra = cp.inactive ? ` · +${cp.inactive} each` : '';
        const feeder = cp.feederSquares ? ` · feeder −${cp.feederSquares}` : '';
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
      if (!cp.inactive) warns.push(`<div>💤 ${cp.name} will fall asleep.</div>`);
      else if (placedNow) warns.push(`<div>💤 ${cp.name} stays asleep.</div>`);
      else if (cp.inactive >= 4) warns.push(`<div>💀 ${cp.name}’s dinos will <b>die</b>!</div>`);
      else warns.push(`<div>💤 ${cp.name} gets hungrier (${cp.inactive + 1}/4).</div>`);
    });
    return `<h3>🍖 Feed your dinos</h3>
      <p>Tap an enclosure to feed it. Hungry dinos fall asleep.</p>
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
    return `<h3>🪙 Production</h3><p>Pick <b>one awake enclosure</b> and collect its coins.</p><div class="opt-list">${rows}</div>`;
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
      return `${backHead()}<h3>⚡ Use a dino power</h3><p>Use a dino power from an <b>awake</b> enclosure.</p><div class="opt-list">${opts}</div>`;
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
      { m: 'dinoAction', i: '⚡', t: 'Dino power', s: `${actOpts.length} ready`, ok: actOpts.length > 0, why: 'No awake power dinos' },
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
        ${isFeeder ? '<p class="muted">Each square makes every dino there eat 1 less. Over 5 squares costs +🪙2 each.</p>' : '<p class="muted">Lets one additional dino species share this enclosure.</p>'}
        <button class="btn big" data-act="place" ${v.ok ? '' : 'disabled'}>Buy &amp; place</button>
`;
    }
    return `<h3>🛒 Shop</h3>
      <div class="opt-list">
        <button class="opt" data-act="buyDiamond" ${canAfford(P, DIAMOND_COST) ? '' : 'disabled'}><span class="o-i">💎</span><span class="o-t"><b>Diamond · 🪙6</b><small>Worth 3 points at the end. Some dinos cost diamonds.</small></span></button>
        <button class="opt" data-act="shopItem" data-item="feeder" ${canAfford(P, feederCost(1)) ? '' : 'disabled'}><span class="o-i">🌾</span><span class="o-t"><b>Feeder · 💎1 + 🪙3</b><small>Each square makes dinos there eat 1 less.</small></span></button>
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

  // ---------------------------------------------------------------- modals
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
        <li><b>Buy from the shop</b> — 💎 Diamond (🪙6), 🌾 Feeder (💎1 + 🪙3, +🪙2 per square over 5; each square = 1 less food per dino in that enclosure), 💧 Watering hole (💎2 + 🪙4, 6 squares; allows one more species in that enclosure).</li>
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
        <li>The inactive surcharge applies to <b>each dino</b> in the enclosure; feeders reduce each dino’s total food by 1 per feeder square (never below 0).</li>
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
      newGame([n0, n1], +ds.first, setupVsAi ? 1 : null);
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
  const FREE_ACTS = new Set(['rules', 'book', 'closeModal', 'newGame', 'confirmYes']);
  // Fence plan: close four quadrants, then split each quadrant into a 2-row and a 3-row pen.
  const AI_PLAN = [
    ['h40', 'h41', 'h42', 'h43', 'h44', 'v4', 'v13', 'v22', 'v31', 'v40'],
    ['h45', 'h46', 'h47', 'h48', 'h49'],
    ['v49', 'v58', 'v67', 'v76', 'v85'],
    ['h10', 'h11', 'h12', 'h13', 'h14'],
    ['h75', 'h76', 'h77', 'h78', 'h79'],
    ['h15', 'h16', 'h17', 'h18', 'h19'],
    ['h70', 'h71', 'h72', 'h73', 'h74'],
  ];
  const ACT_VALUE = { triceratops: 0.5, velociraptor: 0.45, allosaurus: 0.6, parasaurolophus: 0.5 };
  const EVENT_VALUE = { spinosaurus: 5, stegosaurus: 4, brachiosaurus: 2.5, trex: 3, carnotaurus: 5, ankylosaurus: 4, dilophosaurus: 7, gigantoraptor: 2 };

  function isAiTask(T) {
    if (!state || state.ai == null || !T || T.t === 'gameOver') return false;
    if (T.p === state.ai) return true;
    return T.t === 'roll' && state.first === state.ai;
  }

  function roundsLeft() {
    return ROUNDS - state.round + 1;
  }

  function feedingLeft() {
    const T = cur();
    if (state.round < ROUNDS) return true;
    const fk = state.phaseOrder.indexOf('feed');
    return !T || T.k === undefined || T.k <= fk;
  }

  function foodDemand(p) {
    return sumCosts(feedables(analyze(state.players[p].board)).map(enclosureCost));
  }

  function dinoValue(p, sp) {
    const S = SPECIES[sp];
    const left = roundsLeft();
    const P = state.players[p];
    let v = S.pts;
    if (!feedingLeft()) return v + (sp === 'pachy' ? Math.floor(P.coins / 5) : 0);
    v += S.prod * Math.min(left, 12) * 0.4 - S.food.n * Math.min(left, 12) * 0.22;
    v += EVENT_VALUE[sp] || 0;
    if (ACT_VALUE[sp]) v += ACT_VALUE[sp] * Math.min(left, 10);
    if (sp === 'pachy') v += Math.floor(P.coins / 5);
    if (sp === 'microraptor' || sp === 'compy') v += 1.5;
    return v;
  }

  function foodOk(p, sp) {
    if (!feedingLeft()) return true;
    const P = state.players[p];
    const d = foodDemand(p).total;
    const cap = 4 + (P.meat + P.plants) / Math.max(2, roundsLeft());
    return d + SPECIES[sp].food.n <= cap;
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

  function aiFindCells(p, size, sp, onlyKey) {
    const b = state.players[p].board;
    const an = analyze(b);
    let best = null;
    an.comps.forEach((cp) => {
      if (!cp.valid || cp.dead || cp.empty < size) return;
      if (onlyKey != null && cp.key !== onlyKey) return;
      if (sp) {
        const s = new Set(cp.species);
        s.add(sp);
        if (s.size > 1 + cp.waters.length) return;
      }
      const free = new Set(cp.cells.filter((i) => b.cells[i] === 0));
      free.forEach((start) => {
        const cells = growFrom(start, free, size);
        if (!cells) return;
        const rs = cells.map((i) => Math.floor(i / N));
        const cs = cells.map((i) => i % N);
        const box = (Math.max(...rs) - Math.min(...rs) + 1) * (Math.max(...cs) - Math.min(...cs) + 1);
        const score = (sp && cp.species.has(sp) ? 30 : 0) - (cp.empty - size) * 0.4 - (box - size) * 0.6 - (cp.inactive ? 20 : 0);
        if (!best || score > best.score) best = { cells, score };
      });
    });
    return best ? best.cells : null;
  }

  function aiFreeSpace(p) {
    const an = analyze(state.players[p].board);
    return an.comps.filter((cp) => cp.valid && !cp.dead).reduce((m, cp) => Math.max(m, cp.empty), 0);
  }

  function aiPlanEdges(p, max) {
    const b = state.players[p].board;
    const legal = new Set(legalEdges(p));
    const out = [];
    for (const seg of AI_PLAN) {
      if (out.length >= max) break;
      const todo = seg.filter((e) => !b[e[0]][+e.slice(1)]);
      if (!todo.length || todo.some((e) => !legal.has(e)) || fenceProblem(b, todo)) continue;
      for (const e of todo) {
        if (out.length >= max) break;
        out.push(e);
      }
    }
    return fenceProblem(b, out) ? [] : out;
  }

  function aiMeatShare(p, total) {
    const P = state.players[p];
    const d = foodDemand(p);
    const needM = Math.max(0, d.meat - P.meat);
    const needP = Math.max(0, d.plant - P.plants);
    if (needM + needP === 0) return Math.round((total * (d.meat + 1)) / (d.meat + d.plant + 2));
    return Math.round((total * needM) / (needM + needP));
  }

  function aiTarget(p) {
    const P = state.players[p];
    return P.book
      .filter((sp) => !P.blocked.includes(sp) && aiFindCells(p, SPECIES[sp].space, sp))
      .sort((a, b) => dinoValue(p, b) - dinoValue(p, a))[0];
  }

  function aiFeederOption(p) {
    const P = state.players[p];
    const an = analyze(P.board);
    let best = null;
    an.comps.filter((cp) => cp.valid && !cp.dead && cp.living.length >= 2 && cp.empty > 0).forEach((cp) => {
      const maxFood = Math.max(...cp.living.map((d) => SPECIES[d.species].food.n + (cp.inactive || 0))) - cp.feederSquares;
      const size = Math.min(5, cp.empty, maxFood);
      if (size <= 0 || !canAfford(P, feederCost(size))) return;
      const saving = cp.living.reduce((s, d) => s + Math.min(size, Math.max(0, SPECIES[d.species].food.n + (cp.inactive || 0) - cp.feederSquares)), 0);
      const cells = aiFindCells(p, size, null, cp.key);
      const score = saving * Math.min(roundsLeft(), 8) * 0.22;
      if (cells && (!best || score > best.score)) best = { kind: 'feeder', cells, score };
    });
    return best;
  }

  function aiDeckValue(p) {
    const P = state.players[p];
    const pool = state.deck.filter((sp) => !P.book.includes(sp));
    if (!pool.length) return 0;
    return (pool.reduce((s, sp) => s + dinoValue(p, sp), 0) / state.deck.length) * 0.8;
  }

  function aiDrawChoice(p) {
    const P = state.players[p];
    let best = { from: state.deck.length ? 'deck' : null, v: state.deck.length ? aiDeckValue(p) : -1 };
    state.faceUp.forEach((sp, i) => {
      if (!sp) return;
      const v = P.book.includes(sp) ? 0 : dinoValue(p, sp);
      if (v > best.v) best = { from: i, v };
    });
    return best;
  }

  function aiChooseAction(p) {
    const P = state.players[p];
    const O = state.players[other(p)];
    const left = roundsLeft();
    const opts = [{ kind: 'gain3', score: !feedingLeft() && left === 1 ? 0.3 : 2.4 }];
    const plays = playOptions(p, false)
      .filter((o) => o.ok && foodOk(p, o.sp))
      .map((o) => ({ sp: o.sp, v: dinoValue(p, o.sp) }))
      .sort((a, b) => b.v - a.v);
    for (const x of plays) {
      const cells = aiFindCells(p, SPECIES[x.sp].space, x.sp);
      if (cells && x.v > 2) {
        opts.push({ kind: 'play', sp: x.sp, cells, score: 3 + x.v });
        break;
      }
    }
    const edges = aiPlanEdges(p, 2);
    if (edges.length) {
      const space = aiFreeSpace(p);
      opts.push({ kind: 'fences', edges, score: space < 5 ? 6 : space < 10 ? 3 : 0.8 });
    }
    if (canAfford(P, DIAMOND_COST)) {
      const target = aiTarget(p);
      let s = left === 1 ? 3.3 : 0.8;
      if (target && P.diamonds < SPECIES[target].cost.d) s = 4.5;
      opts.push({ kind: 'diamond', score: s });
    }
    const feeder = aiFeederOption(p);
    if (feeder) opts.push(feeder);
    dinoActionOptions(p).forEach((o) => {
      let s = 0;
      if (o.sp === 'triceratops') s = 1.6;
      else if (o.sp === 'velociraptor') s = Math.min(2 * o.count, O.meat + O.plants) * 0.75;
      else if (o.sp === 'allosaurus') s = Math.min(3, O.coins) * 0.85;
      else if (o.sp === 'parasaurolophus') s = 2 * o.count * 0.85;
      opts.push({ kind: 'dinoAct', sp: o.sp, key: o.key, score: s });
    });
    const draw = aiDrawChoice(p);
    if (draw.from !== null && left > 3) opts.push({ kind: 'draw', from: draw.from, score: Math.min(4.2, draw.v * 0.3) });
    return opts.sort((a, b) => b.score - a.score)[0];
  }

  function aiRubbleCells(q, n) {
    const b = state.players[q].board;
    const an = analyze(b);
    const scored = [];
    for (let i = 0; i < 100; i++) {
      if (b.cells[i] !== 0) continue;
      const cp = an.comps[an.compOf[i]];
      const checker = (Math.floor(i / N) + (i % N)) % 2 === 0 ? 2 : 0;
      const s = cp.valid && !cp.dead ? 10 + cp.empty * 0.2 + checker : checker * 0.5 + Math.random();
      scored.push([s, i]);
    }
    return scored.sort((a, b) => b[0] - a[0]).slice(0, n).map((x) => x[1]);
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
    }, T.t === 'roll' || T.t === 'gainFood' ? 1100 : 850);
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
    }, 900);
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
    aiShow(`Placing ${spName(sp)}…`, () => handle('place', {}));
  }

  function aiStep(T) {
    const p = T.p;
    const P = p !== undefined ? state.players[p] : null;
    const panel = document.getElementById('panel');
    lastClickRect = panel ? panel.getBoundingClientRect() : null;
    switch (T.t) {
      case 'roll': handle('roll', {}); return;
      case 'carno': handle('carnoRoll', {}); return;
      case 'gainFood': {
        if (T.amount == null) { handle('rollBonus', {}); return; }
        const d = foodDemand(p);
        const short = Math.max(0, d.total + 1 - (P.meat + P.plants));
        const edges = aiPlanEdges(p, T.amount - Math.min(T.amount, short));
        const food = T.amount - edges.length;
        ui.meat = clamp(aiMeatShare(p, food), 0, food);
        ui.plant = food - ui.meat;
        ui.sel.edges = new Set(edges);
        document.getElementById('boards')._html = null;
        aiShow(`Taking ${food} food${edges.length ? ` and ${plural(edges.length, 'fence')}` : ''}…`, () => handle('confirmGain', {}));
        return;
      }
      case 'feed':
        ui.feed = defaultFeed(p);
        aiShow('Feeding dinos…', () => handle('confirmFeed', {}));
        return;
      case 'produce': {
        const best = producible(p).sort((a, b) => b.prod - a.prod)[0];
        handle('produce', { key: best.key });
        return;
      }
      case 'foodChoice':
        ui.meat = clamp(aiMeatShare(p, T.amount), 0, T.amount);
        aiShow('Choosing food…', () => handle('confirmFood', {}));
        return;
      case 'steal': {
        const [lo, hi] = stealRange(T);
        ui.meat = clamp(aiMeatShare(p, T.amount), lo, hi);
        handle('confirmSteal', {});
        return;
      }
      case 'drawFences':
        ui.sel.edges = new Set(aiPlanEdges(p, T.count));
        document.getElementById('boards')._html = null;
        aiShow('Building fences…', () => handle('confirmFences', {}));
        return;
      case 'fillOpp':
        ui.sel.cells = new Set(aiRubbleCells(other(p), ui.sel.need));
        document.getElementById('boards')._html = null;
        aiShow('Filling in your squares…', () => handle('place', {}));
        return;
      case 'drawCard': {
        const d = T.source === 'deck' ? { from: 'deck' } : aiDrawChoice(p);
        handle('take', { from: String(d.from === null ? 'deck' : d.from) });
        return;
      }
      case 'spino': {
        const target = aiTarget(p);
        const d = foodDemand(p);
        let o = 'coins';
        if (target && P.diamonds < SPECIES[target].cost.d) o = 'dia';
        else if (d.total * 2 > P.meat + P.plants) o = 'food';
        else if (emptyCount(other(p)) >= 10) o = 'fill';
        handle('spino', { o });
        return;
      }
      case 'trex': {
        const O = state.players[other(p)];
        const onBoard = (sp) => Object.values(O.board.items).filter((it) => it.species === sp && !it.dead).length;
        const sp = trexOptions(p).sort((a, b) => (onBoard(b) * 4 + SPECIES[b].pts) - (onBoard(a) * 4 + SPECIES[a].pts))[0];
        handle('trex', { sp });
        return;
      }
      case 'freePlay': {
        const opts = playOptions(p, true).filter((o) => o.ok).sort((a, b) => dinoValue(p, b.sp) - dinoValue(p, a.sp));
        for (const o of opts) {
          const cells = aiFindCells(p, SPECIES[o.sp].space, o.sp);
          if (cells) { aiPlace(o.sp, cells, true); return; }
        }
        handle('skip', {});
        return;
      }
      case 'actions': {
        const c = aiChooseAction(p);
        if (c.kind === 'play') { aiPlace(c.sp, c.cells, false); return; }
        if (c.kind === 'fences') {
          handle('mode', { m: 'fences2' });
          ui.sel.edges = new Set(c.edges);
          document.getElementById('boards')._html = null;
          aiShow('Building 2 fences…', () => handle('confirmFences', {}));
          return;
        }
        if (c.kind === 'diamond') { handle('buyDiamond', {}); return; }
        if (c.kind === 'feeder') {
          handle('mode', { m: 'shop' });
          handle('shopItem', { item: 'feeder' });
          ui.sel.cells = new Set(c.cells);
          document.getElementById('boards')._html = null;
          aiShow('Building a feeder…', () => handle('place', {}));
          return;
        }
        if (c.kind === 'dinoAct') { handle('dinoAct', { sp: c.sp, key: String(c.key) }); return; }
        if (c.kind === 'draw') {
          handle('mode', { m: 'draw' });
          handle('take', { from: String(c.from) });
          return;
        }
        handle('mode', { m: 'gain3' });
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
