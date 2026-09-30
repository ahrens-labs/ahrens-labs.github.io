(() => {
  'use strict';

  const N = 10;
  const ROUNDS = 18;
  const SAVE_KEY = 'ahrensDinoBoardGame.v1';
  const CS = 40;
  const PAD = 10;
  const W = N * CS + PAD * 2;

  const TYPE_LABEL = { event: 'Event', action: 'Action', scoring: 'Scoring', none: 'No ability' };

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
    food: { name: 'Gain Food / Draw Fences', short: 'Food & Fences', icon: '🎲', desc: 'Roll a die. Each player splits the number between food and fences.' },
    feed: { name: 'Feeding', short: 'Feeding', icon: '🍖', desc: 'Feed your dinos. Unfed enclosures go inactive.' },
    produce: { name: 'Production', short: 'Production', icon: '🪙', desc: 'Collect coins from one active enclosure.' },
    action: { name: 'Action', short: 'Actions', icon: '⚡', desc: 'Take 2 actions (you may repeat one).' },
  };
  const PHASE_KEYS = Object.keys(PHASES);

  const ENCLOSURE_TINTS = ['#f3e5ab', '#d8ecc2', '#f6d7b0', '#cfe6e3', '#ead9f0', '#f9dede', '#dfe7f7', '#fff0c2', '#e4f2d0', '#f2e0cc'];

  let state = null;
  let ui = freshUi();
  let busy = false;
  let drag = null;
  let lastFocus = null;

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
      .map((sp) => `${SPECIES[sp].emoji} ${spName(sp)}${counts[sp] > 1 ? ' ×' + counts[sp] : ''}`)
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

  function playOptions(p, free) {
    const P = state.players[p];
    return P.book.map((sp) => {
      const blocked = P.blocked.includes(sp);
      const ok = !blocked && (free ? SPECIES[sp].pts <= 5 : canAfford(P, SPECIES[sp].cost));
      let why = '';
      if (blocked) why = 'Blocked by T. Rex';
      else if (!ok) why = free ? 'Worth more than 5 points' : 'Can’t afford yet';
      return { sp, ok, why };
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

  function newGame(names, first) {
    const deck = shuffle(DECK.slice());
    const faceUp = [deck.shift(), deck.shift()];
    state = {
      v: 1,
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
    logMsg(`🥚 New game! ${pn(first)} watched a dino movie most recently and goes first.`);
    logMsg(`Round 1 begins.`);
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
    state.phaseOrder = shuffle(PHASE_KEYS.slice());
    state.queue.push({ t: 'roundStart' });
    logMsg(`Round ${state.round} begins.`);
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
    logMsg(`${pn(p)} drew ${SPECIES[sp].emoji} <b>${spName(sp)}</b>${from === 'deck' ? ' from the deck' : ''} into their dino book.`);
    toast(`🃏 ${state.players[p].name} drew ${spName(sp)}`, 'good');
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
      if (++n > 9) {
        clearInterval(iv);
        el.classList.remove('rolling');
        el.innerHTML = dieHtml(v).replace(/^<div[^>]*>|<\/div>$/g, '');
        setTimeout(() => {
          busy = false;
          cb(v);
        }, 380);
      }
    }, 70);
  }

  // ---------------------------------------------------------------- toasts / modal / confetti
  function toast(msg, kind) {
    const root = document.getElementById('toasts');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `toast ${kind || ''}`;
    el.textContent = msg;
    root.appendChild(el);
    while (root.children.length > 3) root.removeChild(root.firstChild);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, 2600);
  }

  function openModal(html) {
    document.getElementById('modal-root').innerHTML = `<div class="modal-bg" data-act="closeModal"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  }

  function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  }

  function confetti() {
    const box = document.createElement('div');
    box.className = 'confetti';
    const icons = ['🦖', '🦕', '🥚', '🌿', '🍖', '💎', '🪙', '⭐'];
    for (let i = 0; i < 46; i++) {
      const s = document.createElement('span');
      s.textContent = icons[rand(icons.length)];
      s.style.left = `${rand(100)}%`;
      s.style.animationDuration = `${2.4 + Math.random() * 2.2}s`;
      s.style.animationDelay = `${Math.random() * 1.2}s`;
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 6000);
  }

  // ---------------------------------------------------------------- rendering: cards
  function statBox(label, value) {
    return `<div class="dc-stat"><small>${label}</small>${value}</div>`;
  }

  function cardHtml(sp, opts) {
    const o = opts || {};
    const S = SPECIES[sp];
    return `<div class="dcard t-${S.type} ${o.cls || ''}" ${o.attrs || ''} title="${esc(S.name)}">
      ${o.tag ? `<span class="dc-tag">${o.tag}</span>` : ''}
      <div class="dc-head"><div class="dc-name">${esc(S.name)}</div><div class="dc-pts" title="Points">${S.pts}</div></div>
      <div class="dc-art" style="--sc:${S.color}"><span>${S.emoji}</span></div>
      <div class="dc-stats">${statBox('Cost', costText(S.cost))}${statBox('Size', `⬛${S.space}`)}${statBox('Food', foodText(S.food))}${statBox('Prod', `🪙${S.prod}`)}</div>
      <div class="dc-ab"><span class="dc-type">${TYPE_LABEL[S.type]}</span>${esc(S.ability)}</div>
      ${o.foot || ''}
    </div>`;
  }

  function miniCard(sp, attrs) {
    if (!sp) return '<div class="mini empty">—</div>';
    const S = SPECIES[sp];
    const title = `${S.name} · ${TYPE_LABEL[S.type]}: ${S.ability}`;
    return `<div class="mini t-${S.type} ${attrs ? 'pick' : ''}" ${attrs || ''} title="${esc(title)}">
      <div class="mn"><span>${esc(spName(sp))}</span><span class="mp">${S.pts}</span></div>
      <div class="ma">${S.emoji}</div>
      <div>${costText(S.cost)} · ⬛${S.space}</div>
      <div>${foodText(S.food)} · 🪙${S.prod}</div>
    </div>`;
  }

  // ---------------------------------------------------------------- rendering: board
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

    out.push(`<rect x="0" y="0" width="${W}" height="${W}" rx="12" class="b-bg"/>`);

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
      } else {
        fill = (r + c) % 2 ? '#5f9e3f' : '#67a846';
      }
      let cls = 'cell';
      if (sel && sel.type === 'cells' && b.cells[i] === 0 && (sel.purpose === 'rubble' || (cp.valid && !cp.dead && (!selComp || selComp === cp)))) cls += ' can';
      if (sel && sel.type === 'cells' && sel.cells.has(i)) cls += ' sel';
      out.push(`<rect class="${cls}" data-cell="${i}" data-p="${p}" x="${X(c)}" y="${Y(r)}" width="${CS}" height="${CS}" fill="${fill}"/>`);
    }
    out.push('</g>');

    // grid lines
    let grid = '';
    for (let k = 1; k < N; k++) {
      grid += `M${X(k)} ${Y(0)}V${Y(N)}M${X(0)} ${Y(k)}H${X(N)}`;
    }
    out.push(`<path d="${grid}" stroke="rgba(0,0,0,0.1)" stroke-width="1" fill="none" pointer-events="none"/>`);

    // items
    out.push('<g class="item">');
    Object.values(b.items).forEach((it) => {
      let col;
      if (it.kind === 'dino') col = it.dead ? '#8a8a8a' : SPECIES[it.species].color;
      else if (it.kind === 'feeder') col = '#c8a165';
      else col = '#4fc3f7';
      const set = new Set(it.cells);
      it.cells.forEach((i) => {
        const r = Math.floor(i / N);
        const c = i % N;
        out.push(`<rect x="${X(c) + 3}" y="${Y(r) + 3}" width="${CS - 6}" height="${CS - 6}" rx="7" fill="${col}"/>`);
        if (c < N - 1 && set.has(i + 1)) out.push(`<rect x="${X(c) + CS - 4}" y="${Y(r) + 3}" width="8" height="${CS - 6}" fill="${col}"/>`);
        if (r < N - 1 && set.has(i + N)) out.push(`<rect x="${X(c) + 3}" y="${Y(r) + CS - 4}" width="${CS - 6}" height="8" fill="${col}"/>`);
        if (it.kind === 'water') {
          out.push(`<path d="M${X(c) + 9} ${Y(r) + 24}q5 -5 10 0t10 0" stroke="rgba(255,255,255,0.7)" stroke-width="2" fill="none"/>`);
        }
      });
    });
    for (let i = 0; i < 100; i++) {
      if (b.cells[i] !== -1) continue;
      const r = Math.floor(i / N);
      const c = i % N;
      out.push(`<rect x="${X(c) + 2}" y="${Y(r) + 2}" width="${CS - 4}" height="${CS - 4}" rx="6" fill="#7d7468"/>`);
      out.push(`<path d="M${X(c) + 8} ${Y(r) + 30}l7 -12l6 7l4 -5l7 10z" fill="#5c554b"/>`);
    }
    out.push('</g>');

    // labels
    out.push('<g class="labels">');
    Object.values(b.items).forEach((it) => {
      const cx = it.cells.reduce((s, i) => s + (i % N), 0) / it.cells.length;
      const cy = it.cells.reduce((s, i) => s + Math.floor(i / N), 0) / it.cells.length;
      let anchor = it.cells[0];
      let best = Infinity;
      it.cells.forEach((i) => {
        const d = (i % N - cx) ** 2 + (Math.floor(i / N) - cy) ** 2;
        if (d < best) {
          best = d;
          anchor = i;
        }
      });
      const x = X(anchor % N) + CS / 2;
      const y = Y(Math.floor(anchor / N)) + CS / 2;
      let emoji;
      let code;
      if (it.kind === 'dino') {
        emoji = it.dead ? '💀' : SPECIES[it.species].emoji;
        code = SPECIES[it.species].code;
      } else if (it.kind === 'feeder') {
        emoji = '🌾';
        code = 'FEED';
      } else {
        emoji = '💧';
        code = 'H₂O';
      }
      out.push(`<text x="${x}" y="${y + 3}" text-anchor="middle" font-size="18">${emoji}</text>`);
      out.push(`<text x="${x}" y="${y + 16}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fff" stroke="rgba(0,0,0,0.45)" stroke-width="2.2" paint-order="stroke">${code}</text>`);
    });
    out.push('</g>');

    // fences
    const fence = (x1, y1, x2, y2, cls) => {
      if (cls === 'pend') {
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ffd54f" stroke-width="5" stroke-linecap="round"/>`;
      }
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#4a2c12" stroke-width="6" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#b07a3c" stroke-width="2" stroke-linecap="round"/>`;
    };
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
    for (let i = 0; i < 90; i++) {
      if (b.h[i]) out.push(fence(...edgeLine('h' + i)));
      if (b.v[i]) out.push(fence(...edgeLine('v' + i)));
    }
    out.push('</g>');

    // badges
    out.push('<g class="badges">');
    an.comps.forEach((cp) => {
      if (!cp.name) return;
      const r = Math.floor(cp.key / N);
      const c = cp.key % N;
      out.push(`<circle cx="${X(c) + 10}" cy="${Y(r) + 10}" r="8.5" fill="#2b1d0e" stroke="#fff6e2" stroke-width="1.5"/>`);
      out.push(`<text x="${X(c) + 10}" y="${Y(r) + 13.5}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">${cp.name}</text>`);
      if (cp.dead) {
        out.push(`<rect x="${X(c) + 19}" y="${Y(r) + 2}" width="24" height="16" rx="8" fill="#37474f"/><text x="${X(c) + 31}" y="${Y(r) + 14}" text-anchor="middle" font-size="10">💀</text>`);
      } else if (cp.inactive) {
        const danger = cp.inactive >= 4;
        out.push(`<rect x="${X(c) + 19}" y="${Y(r) + 2}" width="32" height="16" rx="8" fill="${danger ? '#c62828' : '#ef6c00'}" stroke="#fff" stroke-width="1"/><text x="${X(c) + 35}" y="${Y(r) + 14}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">💤${cp.inactive}</text>`);
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
      return;
    }
    if (!document.getElementById('game-shell')) {
      app.innerHTML = `<div id="game-shell">
        <header class="topbar" id="top"></header>
        <main class="layout"><section class="boards" id="boards"></section><aside class="panel" id="panel"></aside></main>
        <footer class="legend">${legendHtml()}</footer>
      </div>`;
    }
    renderTop();
    renderBoards();
    renderPanel();
    const T = cur();
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
  }

  function legendHtml() {
    return [
      '<span><i class="sw" style="background:#67a846"></i>Open land (not enclosed)</span>',
      '<span><i class="sw" style="background:#f3e5ab"></i>Enclosure (touches ≤ 2 board sides)</span>',
      '<span><i class="sw" style="background:#4a2c12"></i>Fence</span>',
      '<span>🌾 Feeder</span>',
      '<span>💧 Watering hole</span>',
      '<span><i class="sw" style="background:#7d7468"></i>Filled by opponent</span>',
      '<span>💤 Inactive (marker)</span>',
      '<span>💀 Extinct</span>',
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
          return `<div class="pcard ${cls}"><span class="pc-n">${i + 1}</span><span>${PHASES[ph].icon}</span><span>${PHASES[ph].short}</span></div>`;
        })
        .join('');
    const fresh = T && T.t === 'roundStart' ? ' fresh' : '';
    setHtml(el, `
      <div class="brand"><span class="brand-logo">🦖</span><div><h1>Dino Board Game</h1><small>Build the best dino park in 18 rounds</small></div></div>
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
    el.innerHTML = html;
    return true;
  }

  function chip(icon, val, title) {
    return `<span class="chip" title="${esc(title)}">${icon} <b>${val}</b></span>`;
  }

  function renderBoards() {
    const el = document.getElementById('boards');
    const T = cur();
    const activeP = T && T.p !== undefined ? T.p : -1;
    const target = ui.sel && ui.sel.board !== activeP ? ui.sel.board : -1;
    setHtml(el, [0, 1]
      .map((p) => {
        const P = state.players[p];
        const sc = scorePlayer(p).total;
        const bonus = P.bonusNext + P.bonusPending;
        return `<div class="player pl-${P.color}${p === activeP ? ' active' : ''}${p === target ? ' target' : ''}" data-player="${p}">
          <div class="p-head">
            <div class="p-name"><span class="dot"></span>${esc(P.name)}${p === state.first ? ' <span class="tag">1st</span>' : ''}${p === activeP ? ' <span class="tag turn-tag">TURN</span>' : ''}${p === target ? ' <span class="tag" style="background:#ff6d2e">TARGET</span>' : ''}</div>
            <div class="p-score" title="Score if the game ended right now">⭐ ${sc}</div>
          </div>
          <div class="res">
            ${chip('🪙', P.coins, 'Coins')}${chip('💎', P.diamonds, 'Diamonds')}${chip('🍖', P.meat, 'Meat')}${chip('🌿', P.plants, 'Plants')}
            ${P.triPlants ? chip('🦕🌿', P.triPlants, 'Plants on your Triceratops page') : ''}
            ${bonus ? chip('⏩', bonus, 'Gigantoraptor: do a phase twice next round') : ''}
          </div>
          <div class="board-wrap">${boardSvg(p)}</div>
          <div class="p-foot">
            <button class="btn sm ghost" data-act="book" data-p="${p}">📖 Dino book · ${P.book.length}</button>
            ${P.blocked.length ? `<span class="blocked">🚫 Blocked: ${P.blocked.map((sp) => esc(spName(sp))).join(', ')}</span>` : ''}
          </div>
        </div>`;
      })
      .join(''));
  }

  function renderPanel() {
    const el = document.getElementById('panel');
    if (!el) return;
    const T = cur();
    const scroll = el.querySelector('.panel-scroll');
    const top = scroll ? scroll.scrollTop : 0;
    const changed = setHtml(el, `${bannerHtml(T)}<div class="panel-scroll"><div class="task">${taskHtml(T)}</div>${marketHtml(T)}${logHtml()}</div>`);
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
    const faceUp = [0, 1].map((i) => miniCard(state.faceUp[i], pickAny && state.faceUp[i] ? `data-act="take" data-from="${i}"` : '')).join('');
    return `<div class="market">
      <div class="m-title">🃏 Card market</div>
      <div class="m-row">
        <div class="deck-back ${deckAttrs ? 'pick' : ''}" ${deckAttrs} title="Top of the deck (face down)"><span>🦴</span><b>${state.deck.length}</b><small>deck</small></div>
        ${faceUp}
      </div>
    </div>`;
  }

  function logHtml() {
    const items = state.log.slice(-10).reverse().map((l) => `<li><span class="lr">R${l.r}</span>${l.m}</li>`).join('');
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
        const btns = state.phaseOrder
          .map((ph) => {
            const n = picks.filter((x) => x === ph).length;
            return `<button class="btn sm ${n ? 'on' : ''}" data-act="pickDouble" data-p="${p}" data-ph="${ph}">${PHASES[ph].icon} ${PHASES[ph].short}${n > 1 ? ' ×' + n : ''}</button>`;
          })
          .join('');
        const skipped = picks.filter((x) => x === 'none').length;
        const skipBtn = `<button class="btn sm ghost ${skipped ? 'on' : ''}" data-act="pickDouble" data-p="${p}" data-ph="none">🚫 Don’t use${skipped > 1 ? ' ×' + skipped : ''}</button>`;
        return `<div class="bonus-pick"><div>⏩ ${pn(p)}’s Gigantoraptor: you may pick ${plural(P.bonusPending, 'phase')} to take twice this round.</div>
          <div class="btn-row">${btns}${skipBtn}</div>
          <div class="muted" style="margin-top:.4rem">${picks.length}/${P.bonusPending} chosen ${picks.length ? '<button class="link" data-act="clearDouble" data-p="' + p + '">reset</button>' : ''}</div></div>`;
      })
      .join('');
    return `<h2>Round ${state.round} of ${ROUNDS}</h2>
      <p>The phase cards were shuffled. This round they resolve in this order:</p>
      <ol class="phase-order">${list}</ol>
      ${bonus}
      <button class="btn big" data-act="startRound" ${ready ? '' : 'disabled'}>Start round ▶</button>`;
  }

  function rollHtml() {
    return `<h3>🎲 Gain Food / Draw Fences</h3>
      <p>Roll one die. <b>Both players</b> get that many points to split between food and fences.</p>
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
      <div class="hint">An enclosure is any area fully closed off by fences. It can use <b>at most 2 sides</b> of the board edge as walls.</div>
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
        else if (cp.inactive >= 4) status = `<span class="status-pill danger">💤 ${cp.inactive} — last chance!</span>`;
        else status = `<span class="status-pill warn">💤 inactive ${cp.inactive}</span>`;
        const extra = cp.inactive ? ` · +${cp.inactive} per dino` : '';
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
      if (!cp.inactive) warns.push(`<div>💤 ${cp.name} will go inactive (marker on 1).</div>`);
      else if (placedNow) warns.push(`<div>💤 ${cp.name} stays inactive.</div>`);
      else if (cp.inactive >= 4) warns.push(`<div>💀 ${cp.name}’s dinos will <b>die</b>!</div>`);
      else warns.push(`<div>💤 ${cp.name}’s marker moves to ${cp.inactive + 1}.</div>`);
    });
    return `<h3>🍖 Feed your dinos</h3>
      <p>Tap enclosures to feed them. Each dino eats the food shown on its card.</p>
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
        <span class="o-t"><b>${dinoSummary(cp)}</b><small>Production of every dino in this enclosure</small></span>
        <span class="fc flex" style="font-size:1rem">🪙 +${cp.prod}${cp.prod === best && list.length > 1 ? ' ⭐' : ''}</span></button>`)
      .join('');
    return `<h3>🪙 Production</h3><p>Pick <b>one active enclosure</b>. You gain coins equal to the production of all its dinos.</p><div class="opt-list">${rows}</div>`;
  }

  function actionsHtml(T) {
    const P = state.players[T.p];
    const doneN = 2 - T.remaining;
    const dots = `<span class="dots"><i class="${doneN > 0 ? 'used' : ''}"></i><i class="${doneN > 1 ? 'used' : ''}"></i></span>`;
    const head = `<div class="act-count">Action ${doneN + 1} of 2 ${dots}</div>`;

    if (ui.mode === 'play') return head + playModeHtml(T, false);
    if (ui.mode === 'draw') {
      return `${head}<h3>🃏 Draw a card</h3><p>Tap a face-up card or the deck in the <b>card market</b> below. It joins your dino book.</p>
        <button class="btn ghost" data-act="back">← Back</button>`;
    }
    if (ui.mode === 'shop') return head + shopHtml(P);
    if (ui.mode === 'dinoAction') {
      const opts = dinoActionOptions(T.p)
        .map((o) => {
          const desc = {
            triceratops: `Put 🌿 on your Triceratops page (now ${P.triPlants})`,
            velociraptor: `Steal up to ${2 * o.count} food`,
            allosaurus: 'Steal up to 🪙3',
            parasaurolophus: `Gain 🪙${2 * o.count}`,
          }[o.sp];
          return `<button class="opt" data-act="dinoAct" data-sp="${o.sp}" data-key="${o.key}"><span class="o-i">${SPECIES[o.sp].emoji}</span><span class="o-t"><b>${spName(o.sp)}${o.count > 1 ? ' ×' + o.count : ''} · enclosure ${o.name}</b><small>${desc}</small></span></button>`;
        })
        .join('');
      return `${head}<h3>⚡ Use a dino action</h3><p>Activate a red-ability dino in an <b>active</b> enclosure.</p><div class="opt-list">${opts}</div><button class="btn ghost" data-act="back">← Back</button>`;
    }
    if (ui.mode === 'fences2') {
      const n = ui.sel ? ui.sel.edges.size : 0;
      return `${head}<h3>🪵 Draw in 2 fences</h3><p>Tap dotted edges on your board. Tap again to undo.</p>
        <div class="fence-line">Fences selected: <b>${n}</b> / 2</div>
        <button class="btn big" data-act="confirmFences" ${n ? '' : 'disabled'}>Build fences</button>
        <button class="btn ghost" data-act="back" style="margin-top:.6rem">← Back</button>`;
    }

    const actOpts = dinoActionOptions(T.p);
    const tiles = [
      { m: 'play', i: '🦖', t: 'Play a dino', s: 'Pay its cost and place it', ok: playOptions(T.p, false).some((o) => o.ok) },
      { m: 'draw', i: '🃏', t: 'Draw a card', s: `Face-up or deck (${state.deck.length})`, ok: state.faceUp.length + state.deck.length > 0 },
      { m: 'shop', i: '🛒', t: 'Buy from shop', s: 'Diamond · Feeder · Watering hole', ok: canShop(P) },
      { m: 'dinoAction', i: '⚡', t: 'Use a dino action', s: actOpts.length ? `${actOpts.length} available` : 'No active action dinos', ok: actOpts.length > 0 },
      { m: 'gain3', i: '🪙', t: 'Gain 3 coins', s: 'Straight from the supply', ok: true },
      { m: 'fences2', i: '🪵', t: 'Draw in 2 fences', s: 'Grow your enclosures', ok: legalEdges(T.p).length > 0 },
    ]
      .map((x) => `<button class="tile" data-act="mode" data-m="${x.m}" ${x.ok ? '' : 'disabled'}><span class="t-i">${x.i}</span><span class="t-t">${x.t}</span><span class="t-s">${x.s}</span></button>`)
      .join('');
    return `${head}<p class="muted" style="margin-top:0">You may pick the same action twice.</p>
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
      <div class="muted" style="margin-top:.4rem">Drag across squares to paint them. Tap a selected square to remove it.</div>
    </div>`;
  }

  function playModeHtml(T, free) {
    if (!ui.species) {
      const cards = playOptions(T.p, free)
        .map((o) => cardHtml(o.sp, {
          cls: `${o.ok ? 'pick' : 'nope'} ${o.why === 'Blocked by T. Rex' ? 'blockedc' : ''}`,
          attrs: o.ok ? `data-act="pickSpecies" data-sp="${o.sp}"` : '',
          tag: state.players[T.p].cards.includes(o.sp) ? 'card' : '',
          foot: o.ok ? '' : `<div class="dc-why">${o.why}</div>`,
        }))
        .join('');
      return `<h3>${free ? '🎁 Pick a free dino (≤ 5 points)' : '🦖 Choose a dino to play'}</h3>
        <div class="card-grid">${cards}</div>
        ${free ? '<button class="btn ghost" data-act="skip">Skip free dino</button>' : '<button class="btn ghost" data-act="back">← Back</button>'}`;
    }
    const S = SPECIES[ui.species];
    const v = validateSel();
    return `<h3>${S.emoji} Place ${esc(S.name)}${free ? ' (free!)' : ` · ${costText(S.cost)}`}</h3>
      ${placementBox(`Select ${S.space} connected square${S.space > 1 ? 's' : ''} inside one enclosure`)}
      <button class="btn big" data-act="place" ${v.ok ? '' : 'disabled'}>Place ${esc(spName(ui.species))}</button>
      <button class="btn ghost" data-act="back" style="margin-top:.6rem">← Pick a different dino</button>`;
  }

  function shopHtml(P) {
    if (ui.shopItem) {
      const isFeeder = ui.shopItem === 'feeder';
      const n = ui.sel.cells.size;
      const cost = isFeeder ? feederCost(Math.max(1, n)) : WATER_COST;
      const v = validateSel();
      return `<h3>${isFeeder ? '🌾 Place a feeder' : '💧 Place a watering hole'} · ${costText(cost)}</h3>
        ${placementBox(isFeeder ? 'Select any number of connected squares in one enclosure' : 'Select 6 connected squares in one enclosure')}
        ${isFeeder ? '<p class="muted">Each feeder square lowers the food cost of every dino in its enclosure by 1. Up to 5 squares costs 💎1 + 🪙3; each square beyond 5 costs +🪙2.</p>' : '<p class="muted">Lets one additional dino species share this enclosure.</p>'}
        <button class="btn big" data-act="place" ${v.ok ? '' : 'disabled'}>Buy &amp; place</button>
        <button class="btn ghost" data-act="shopBack" style="margin-top:.6rem">← Back to shop</button>`;
    }
    return `<h3>🛒 Shop</h3>
      <div class="opt-list">
        <button class="opt" data-act="buyDiamond" ${canAfford(P, DIAMOND_COST) ? '' : 'disabled'}><span class="o-i">💎</span><span class="o-t"><b>Diamond · 🪙6</b><small>Used to buy dinos and shop items. Worth 3 points at the end.</small></span></button>
        <button class="opt" data-act="shopItem" data-item="feeder" ${canAfford(P, feederCost(1)) ? '' : 'disabled'}><span class="o-i">🌾</span><span class="o-t"><b>Feeder · 💎1 + 🪙3</b><small>Any number of connected squares; +🪙2 per square beyond 5. Each square = 1 less food per dino in that enclosure.</small></span></button>
        <button class="opt" data-act="shopItem" data-item="water" ${canAfford(P, WATER_COST) ? '' : 'disabled'}><span class="o-i">💧</span><span class="o-t"><b>Watering hole · 💎2 + 🪙4</b><small>Takes 6 squares. Allows one more dino species in that enclosure.</small></span></button>
      </div>
      <button class="btn ghost" data-act="back">← Back</button>`;
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
      .map((sp) => `<button class="opt" data-act="trex" data-sp="${sp}"><span class="o-i">${SPECIES[sp].emoji}</span><span class="o-t"><b>${esc(SPECIES[sp].name)}</b><small>${costText(SPECIES[sp].cost)} · ⬛${SPECIES[sp].space} · ${SPECIES[sp].pts} pts${O.cards.includes(sp) ? ' · drawn card' : ''}</small></span></button>`)
      .join('');
    return `<h3>🦖 T. Rex roars!</h3><p>Choose a dino from <b>${esc(O.name)}’s</b> book or cards. They can’t place any more of it.</p><div class="opt-list">${opts}</div>`;
  }

  function carnoHtml() {
    return `<h3>🦖 Carnotaurus event</h3><p>Roll a die — you gain <b>4×</b> that much food.</p>
      <div class="die-wrap">${dieHtml(6)}</div>
      <button class="btn big" data-act="carnoRoll">Roll the die</button>`;
  }

  function freePlayHtml(T) {
    return playModeHtml(T, true);
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
      winner = `<span class="big">${w === 0 ? '🦖' : '🦕'}</span>${pn(w)} wins!`;
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
    app.innerHTML = `<div class="setup">
      <div class="setup-hero"><span>🦕</span><span>🥚</span><span>🦖</span></div>
      <h1>Dino Board Game</h1>
      <p class="tagline">Fence your land, feed your dinos, and build the best park in 18 rounds.</p>
      <div class="setup-card">
        <h2>Who’s playing?</h2>
        <div class="name-row">
          <div class="name-field"><label for="name0"><span class="dot-red"></span>Red book</label><input id="name0" maxlength="18" value="Red" autocomplete="off"></div>
          <div class="name-field"><label for="name1"><span class="dot-blue"></span>Blue book</label><input id="name1" maxlength="18" value="Blue" autocomplete="off"></div>
        </div>
        <div class="first-q">🎬 Who most recently watched a movie with a dino in it? They go first.</div>
        <div class="first-btns">
          <button class="btn fr" data-act="setupStart" data-first="0">🔴 Red did!</button>
          <button class="btn fb" data-act="setupStart" data-first="1">🔵 Blue did!</button>
        </div>
        <div class="setup-foot">Both players share this device and take turns. Each starts with 🪙5, an empty 10×10 park, and the same 8-dino book. The game saves automatically in this browser.</div>
      </div>
      <div class="setup-actions"><button class="btn ghost" data-act="rules">📜 Read the rules</button></div>
    </div>`;
  }

  // ---------------------------------------------------------------- modals
  function openRules() {
    openModal(`<div class="modal-head"><h2>📜 How to play</h2><button class="x" data-act="closeModal" aria-label="Close">✕</button></div>
      <p>Two players each build a dino park on a 10×10 grid over <b>18 rounds</b>. Most points wins.</p>
      <h3>Setup</h3>
      <ul>
        <li>Each player gets a park, 🪙5, and a dino book (red or blue — both have the same 8 dinos).</li>
        <li>The dino cards are shuffled and 2 are placed face-up next to the deck.</li>
        <li>Whoever most recently saw a movie with a dino in it goes first.</li>
      </ul>
      <h3>Each round</h3>
      <ol>
        <li><b>Place phases</b> — the 4 phase cards are shuffled into a random order.</li>
        <li><b>Resolve phases</b> in that order (the first player acts first in each phase).</li>
        <li><b>Move the round tracker.</b></li>
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
    if (act === 'rules') { openRules(); return; }
    if (act === 'setupStart') {
      const n0 = (document.getElementById('name0').value || '').trim() || 'Red';
      const n1 = (document.getElementById('name1').value || '').trim() || 'Blue';
      newGame([n0, n1], +ds.first);
      return;
    }
    if (!state) return;
    if (act === 'newGame') {
      const T = cur();
      if (T && T.t !== 'gameOver' && !window.confirm('Start a new game? The current game will be lost.')) return;
      localStorage.removeItem(SAVE_KEY);
      state = null;
      ui = freshUi();
      closeModal();
      render();
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
      logMsg(`${pn(p)} played ${SPECIES[sp].emoji} <b>${spName(sp)}</b> in enclosure ${encl}${free ? ' for free' : ` (${costText(SPECIES[sp].cost)})`}.`);
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

  // ---------------------------------------------------------------- events wiring
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    handle(el.dataset.act, el.dataset, el, e);
  });

  document.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest && e.target.closest('[data-cell]');
    if (!cell || !ui.sel || ui.sel.type !== 'cells' || busy) return;
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
