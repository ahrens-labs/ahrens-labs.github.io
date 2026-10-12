// Atlantis Expedition — rules engine and computer player. No DOM access, so it also runs in Node for simulations.
(function (root) {
  'use strict';

  const SAVE_V = 1;
  const TIDES = 10;
  const HEART_TIDE = 6;
  const START_GOLD = 7;
  const INCOME = 4;
  const MAX_SUBS = 3;
  const MAX_DIVERS = 8;
  const MARKET_SIZE = 4;
  const MAP_MAX = 6;
  const MAP_MIN = 3;
  const UNCOVERED = 3;
  const SCOUT_MAX = 3;
  const DISCOVERY_PTS = 2;
  const GOLD_PER_PT = 4;

  // Hazards: what goes wrong on a failed dive when nobody on the crew (or the sub) is ready for it.
  const HAZ = {
    air: { icon: '🫧', name: 'Thin air', ready: 'Free-divers and oxygen tanks', fail: 'ran out of air and had to race for the surface', effect: 'The crew rests next tide.' },
    shark: { icon: '🦈', name: 'Sharks', ready: 'Shark wranglers and shark cages', fail: 'was attacked by a shark', effect: 'A shark eats one diver.' },
    cave: { icon: '🪨', name: 'Tight tunnels', ready: 'Cave divers and drill arms', fail: 'got stuck in a collapsing tunnel', effect: 'The sub is stuck for 2 tides.' },
    current: { icon: '🌀', name: 'Currents', ready: 'Current riders and stabilisers', fail: 'was swept away by a current', effect: 'Lose 🪙3 of gear; the sub is out next tide.' },
    dark: { icon: '🌑', name: 'Darkness', ready: 'Lamplighters and floodlights', fail: 'got lost in the dark', effect: 'The crew rests next tide.' },
    trap: { icon: '🗿', name: 'Atlantean traps', ready: 'Archaeologists and glyph decoders', fail: 'set off an ancient trap', effect: 'Pay 🪙2 for repairs; the sub is out next tide.' },
    kraken: { icon: '🐙', name: 'The Kraken', ready: 'Kraken hunters and harpoons', fail: 'woke the Kraken', effect: 'The sub is destroyed.' },
  };
  const HAZ_ORDER = ['air', 'shark', 'cave', 'current', 'dark', 'trap', 'kraken'];

  const DEPTH = { 1: { name: 'Shallows', icon: '🌊' }, 2: { name: 'Deep', icon: '🌊🌊' }, 3: { name: 'Abyss', icon: '🌊🌊🌊' } };

  const SUB = {
    minnow: { name: 'Minnow', icon: '🐟', cost: 3, crew: 1, depth: 1, bonus: 0, slots: 0, note: 'A one-diver runabout for the shallows.' },
    barracuda: { name: 'Barracuda', icon: '🚤', cost: 6, crew: 2, depth: 2, bonus: 1, slots: 1, note: 'Quick and sturdy. Reaches the deep ruins.' },
    nautilus: { name: 'Nautilus', icon: '🐚', cost: 10, crew: 3, depth: 3, bonus: 2, slots: 2, note: 'A proper expedition sub that can reach the abyss.' },
    leviathan: { name: 'Leviathan', icon: '🐋', cost: 15, crew: 4, depth: 3, bonus: 3, slots: 3, note: 'The finest sub on the sea. Big crew, big bonus.' },
  };
  const SUB_ORDER = ['minnow', 'barracuda', 'nautilus', 'leviathan'];

  const MOD = {
    tanks: { name: 'Oxygen tanks', icon: '🧯', haz: 'air', cost: 3 },
    cage: { name: 'Shark cage', icon: '🔒', haz: 'shark', cost: 3 },
    drill: { name: 'Drill arm', icon: '🔩', haz: 'cave', cost: 3 },
    fins: { name: 'Stabilisers', icon: '🪁', haz: 'current', cost: 3 },
    lamps: { name: 'Floodlights', icon: '🔦', haz: 'dark', cost: 3 },
    decoder: { name: 'Glyph decoder', icon: '📜', haz: 'trap', cost: 3 },
    harpoon: { name: 'Harpoon', icon: '🔱', haz: 'kraken', cost: 5 },
  };
  const MOD_ORDER = ['tanks', 'cage', 'drill', 'fins', 'lamps', 'decoder', 'harpoon'];

  // Divers for hire: skill is added to every dive; each specialty cancels that hazard's penalty.
  const DIVER = {
    rookie: { role: 'Rookie diver', skill: 1, spec: [], cost: 2, wage: 1, n: 4 },
    wrangler: { role: 'Shark wrangler', skill: 1, spec: ['shark'], cost: 4, wage: 1, n: 2 },
    freediver: { role: 'Free-diver', skill: 1, spec: ['air'], cost: 4, wage: 1, n: 2 },
    caver: { role: 'Cave diver', skill: 1, spec: ['cave'], cost: 4, wage: 1, n: 2 },
    rider: { role: 'Current rider', skill: 1, spec: ['current'], cost: 4, wage: 1, n: 2 },
    lamplighter: { role: 'Lamplighter', skill: 1, spec: ['dark'], cost: 4, wage: 1, n: 2 },
    archaeologist: { role: 'Archaeologist', skill: 1, spec: ['trap'], cost: 4, wage: 1, n: 2 },
    veteran: { role: 'Veteran diver', skill: 2, spec: [], cost: 5, wage: 1, n: 2 },
    deepdiver: { role: 'Deep diver', skill: 2, spec: ['air', 'dark'], cost: 7, wage: 2, n: 1 },
    hunter: { role: 'Treasure hunter', skill: 2, spec: ['cave', 'trap'], cost: 7, wage: 2, n: 1 },
    stormdiver: { role: 'Storm diver', skill: 2, spec: ['current', 'shark'], cost: 7, wage: 2, n: 1 },
    krakenhunter: { role: 'Kraken hunter', skill: 2, spec: ['kraken', 'shark'], cost: 8, wage: 2, n: 1 },
    captain: { role: 'Legendary captain', skill: 3, spec: ['air', 'current', 'dark'], cost: 11, wage: 3, n: 1 },
    professor: { role: 'Professor of Atlantis', skill: 3, spec: ['trap', 'cave', 'kraken'], cost: 11, wage: 3, n: 1 },
  };
  const DIVER_ORDER = Object.keys(DIVER);
  const NAMES = ['Marina', 'Coral', 'Finn', 'Nerissa', 'Kai', 'Pearl', 'Morgan', 'Delphine', 'Bruce', 'Ondine', 'Jonah', 'Shelly', 'Wade', 'Isla',
    'Murray', 'Doris', 'Caspian', 'Brook', 'Neptune Jr.', 'Ripley', 'Tula', 'Gil', 'Reef', 'Dory', 'Splash', 'Hal', 'Lagoon', 'Ahab', 'Sandy', 'Zeke'];

  // Tier: 1 easy … 4 extreme; 5 is the Heart of Atlantis, which appears at tide 6.
  const TIER = {
    1: { name: 'Easy', target: 6, treasure: 3, gold: 2, stars: 1 },
    2: { name: 'Tricky', target: 10, treasure: 5, gold: 3, stars: 2 },
    3: { name: 'Hard', target: 14, treasure: 8, gold: 4, stars: 3 },
    4: { name: 'Extreme', target: 16, treasure: 12, gold: 5, stars: 4 },
    5: { name: 'Legendary', target: 18, treasure: 20, gold: 6, stars: 5 },
  };
  const SITE = {
    reef: { name: 'Coral Gate Reef', tier: 1, depth: 1, haz: ['shark'], blurb: 'Gold coins tangled in the coral at the city gate.' },
    market: { name: 'Sunken Fish Market', tier: 1, depth: 1, haz: ['current'], blurb: 'Stalls still full of silver scales and bronze weights.' },
    statue: { name: 'Toppled Statue', tier: 1, depth: 1, haz: ['cave'], blurb: 'A fallen giant with jewels for eyes.' },
    lighthouse: { name: 'Drowned Lighthouse', tier: 1, depth: 1, haz: ['dark'], blurb: 'Its great crystal lens lies somewhere in the gloom.' },
    amphora: { name: 'Amphora Field', tier: 1, depth: 1, haz: ['air'], blurb: 'Hundreds of sealed jars. Some hold pearls.' },
    garden: { name: 'Kelp Garden', tier: 1, depth: 1, haz: ['current'], blurb: 'The queen’s garden, gone wild under the waves.' },
    docks: { name: 'Old Harbor Docks', tier: 1, depth: 1, haz: ['shark'], blurb: 'Trading ships sank here with their cargo.' },
    baths: { name: 'Royal Baths', tier: 2, depth: 1, haz: ['air', 'cave'], blurb: 'Marble pools, golden taps, narrow pipes.' },
    arena: { name: 'Water Arena', tier: 2, depth: 2, haz: ['shark', 'current'], blurb: 'Champions’ crowns still lie in the sand.' },
    mosaic: { name: 'Mosaic Plaza', tier: 2, depth: 2, haz: ['dark', 'trap'], blurb: 'Every tile is a tiny gem. Some tiles are traps.' },
    aqueduct: { name: 'Broken Aqueduct', tier: 2, depth: 1, haz: ['cave', 'current'], blurb: 'Water still roars through the old channels.' },
    barracks: { name: 'Sunken Barracks', tier: 2, depth: 2, haz: ['trap', 'air'], blurb: 'Orichalcum shields, guarded by old tricks.' },
    archive: { name: 'Flooded Archive', tier: 2, depth: 2, haz: ['dark', 'air'], blurb: 'Golden scrolls deep inside a lightless hall.' },
    temple: { name: 'Temple of Poseidon', tier: 3, depth: 2, haz: ['trap', 'dark', 'shark'], blurb: 'The sea god’s trident rests on the altar.' },
    observatory: { name: 'Star Observatory', tier: 3, depth: 2, haz: ['current', 'air'], blurb: 'A brass star-map worth a kingdom.' },
    palace: { name: 'Coral Palace', tier: 3, depth: 2, haz: ['shark', 'cave', 'trap'], blurb: 'The royal jewels, behind walls of living coral.' },
    mint: { name: 'Orichalcum Mint', tier: 3, depth: 3, haz: ['trap', 'cave'], blurb: 'Where Atlantis made its glowing coins.' },
    library: { name: 'Great Library', tier: 3, depth: 3, haz: ['dark', 'air', 'trap'], blurb: 'Crystal books that still glow when you touch them.' },
    throne: { name: 'Throne of the Sea Kings', tier: 4, depth: 3, haz: ['trap', 'kraken', 'dark'], blurb: 'A throne carved from one enormous pearl.' },
    vault: { name: 'Golden Vault', tier: 4, depth: 3, haz: ['trap', 'cave', 'air'], blurb: 'Locked for ten thousand years. Very locked.' },
    trench: { name: 'Abyssal Trench Gate', tier: 4, depth: 3, haz: ['current', 'dark', 'kraken'], blurb: 'The gate to the deepest district of all.' },
    forge: { name: 'Volcano Forge', tier: 4, depth: 3, haz: ['cave', 'current', 'air'], blurb: 'Hot vents, molten gold, very little room.' },
    heart: { name: 'The Heart of Atlantis', tier: 5, depth: 3, haz: ['trap', 'kraken', 'dark'], blurb: 'The glowing crystal that once powered the whole city.' },
  };
  const SITE_ORDER = Object.keys(SITE);

  // Sea forecast: one per tide, known a tide ahead.
  const SEA = {
    calm: { name: 'Calm seas', icon: '☀️', note: '+1 to every dive roll.' },
    clear: { name: 'Crystal water', icon: '💎', note: 'Darkness doesn’t count against dives.' },
    frenzy: { name: 'Feeding frenzy', icon: '🦈', note: 'Sharks nobody is ready for are −6 instead of −3.' },
    riptide: { name: 'Riptides', icon: '🌀', note: 'Currents nobody is ready for are −6 instead of −3.' },
    storm: { name: 'Storm', icon: '⛈️', note: 'Minnows stay in port: they can’t dive or salvage.' },
    bloom: { name: 'Plankton bloom', icon: '🌫️', note: 'Darkness nobody is ready for is −6 instead of −3.' },
    rumors: { name: 'Treasure rumors', icon: '🗺️', note: '+2 💎 for every successful expedition.' },
    gala: { name: 'Sponsors’ gala', icon: '🥂', note: 'Every company gets 🪙3 extra this tide.' },
    stirs: { name: 'The Kraken stirs', icon: '🐙', note: 'The Kraken is −6 instead of −3 if nobody is ready for it.' },
    lowtide: { name: 'Low tide', icon: '🏖️', note: '+2 to dives in the Shallows.' },
  };
  const SEA_ORDER = Object.keys(SEA);
  const SEA_DOUBLE = { frenzy: 'shark', riptide: 'current', bloom: 'dark', stirs: 'kraken' };

  const AI_LEVEL = { easy: 'easy', normal: 'normal', hard: 'hard', brutal: 'brutal' };
  const AI_HEAD_START = { easy: null, normal: null, hard: { gold: 3 }, brutal: { gold: 4, rookie: true, sub: 'barracuda' } };

  // ---------------------------------------------------------------- helpers
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function rng(state) {
    let t = (state.seed = (state.seed + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rint = (state, n) => Math.floor(rng(state) * n);
  function shuffle(state, a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = rint(state, i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const nid = (state) => ++state.nextId;
  function log(state, text, who) {
    state.log.push({ t: state.tide, text, who: who == null ? null : who });
    if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
  }
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const sea = (state) => state.forecast[state.tide - 1];

  function diverCard(state, k) {
    const used = new Set();
    state.players.forEach((p) => p.divers.forEach((d) => used.add(d.name)));
    state.market.forEach((d) => used.add(d.name));
    const free = NAMES.filter((n) => !used.has(n));
    const name = free.length ? free[rint(state, free.length)] : `Diver ${state.nextId + 1}`;
    return { id: nid(state), k, name };
  }
  function expCard(state, k) {
    return { id: nid(state), k, scout: 0 };
  }

  // ---------------------------------------------------------------- setup
  function newGame(opts) {
    opts = opts || {};
    const names = opts.names || ['Red', 'Blue'];
    const ai = opts.ai || [false, true];
    const state = {
      v: SAVE_V,
      seed: (opts.seed != null ? opts.seed : Math.floor(Math.random() * 2 ** 31)) | 0,
      tide: 1,
      phase: 'act',
      first: opts.first === 1 ? 1 : 0,
      turn: opts.first === 1 ? 1 : 0,
      passed: [false, false],
      nextId: 0,
      players: [],
      market: [],
      diverDeck: [],
      map: [],
      expDeck: [],
      forecast: [],
      firsts: {},
      heartTaken: false,
      last: null,
      log: [],
    };
    state.forecast = shuffle(state, SEA_ORDER.slice()).slice(0, TIDES);
    // Tide 1 is always calm so nobody loses a diver before they can hire anyone.
    const c = state.forecast.indexOf('calm');
    if (c > 0) [state.forecast[0], state.forecast[c]] = [state.forecast[c], state.forecast[0]];

    const deck = [];
    DIVER_ORDER.forEach((k) => {
      for (let i = 0; i < DIVER[k].n; i++) deck.push(k);
    });
    state.diverDeck = shuffle(state, deck);

    const byTier = (t) => shuffle(state, SITE_ORDER.filter((k) => SITE[k].tier === t));
    const [t1, t2, t3, t4] = [1, 2, 3, 4].map(byTier);
    state.map = [t1.pop(), t1.pop(), t1.pop(), t2.pop()].map((k) => expCard(state, k));
    state.expDeck = [
      ...shuffle(state, [...t1, t2.pop(), t2.pop()]),
      ...shuffle(state, [...t2, t3.pop(), t3.pop()]),
      ...shuffle(state, [...t3, ...t4]),
    ];

    for (let i = 0; i < 2; i++) {
      const p = {
        name: String(names[i] || (i ? 'Blue' : 'Red')).slice(0, 18),
        ai: !!ai[i],
        gold: START_GOLD,
        treasure: 0,
        divers: [],
        subs: [],
        found: [],
        stats: { dives: 0, wins: 0, lost: 0, wrecked: 0 },
      };
      state.players.push(p);
    }
    state.players.forEach((p) => {
      p.divers.push(Object.assign(diverCard(state, 'rookie'), { used: false, tired: 0 }));
      p.subs.push({ id: nid(state), k: 'minnow', mods: [], used: false, stuck: 0 });
    });
    for (let i = 0; i < MARKET_SIZE; i++) drawDiver(state);
    log(state, `Tide 1 · ${SEA[sea(state)].icon} ${SEA[sea(state)].name}. ${state.players[state.first].name} sets out first.`);
    return state;
  }

  function aiHeadStart(state, pi, level) {
    const h = AI_HEAD_START[level];
    if (!h) return;
    const p = state.players[pi];
    p.gold += h.gold || 0;
    if (h.rookie) p.divers.push(Object.assign(diverCard(state, 'rookie'), { used: false, tired: 0 }));
    if (h.sub) p.subs[0].k = h.sub;
  }

  function drawDiver(state) {
    if (!state.diverDeck.length) return;
    state.market.push(diverCard(state, state.diverDeck.shift()));
  }
  function drawExp(state) {
    if (!state.expDeck.length) return false;
    state.map.push(expCard(state, state.expDeck.shift()));
    return true;
  }

  // ---------------------------------------------------------------- queries
  const diverOf = (p, id) => p.divers.find((d) => d.id === id);
  const subOf = (p, id) => p.subs.find((s) => s.id === id);
  const expOf = (state, id) => state.map.find((x) => x.id === id);
  const diverReady = (state, d) => !d.used && d.tired < state.tide;
  const subReady = (state, s) => !s.used && s.stuck < state.tide && !(s.k === 'minnow' && sea(state) === 'storm');
  const readyDivers = (state, p) => p.divers.filter((d) => diverReady(state, d));
  const readySubs = (state, p) => p.subs.filter((s) => subReady(state, s));
  const wagesOf = (p) => p.divers.reduce((t, d) => t + DIVER[d.k].wage, 0);
  const crewRoom = (p) => p.subs.reduce((t, s) => t + SUB[s.k].crew, 0);
  const maxDepth = (p) => p.subs.reduce((m, s) => Math.max(m, SUB[s.k].depth), 0);
  const tidesLeft = (state) => TIDES - state.tide + 1;
  // Rebuilding a sub as a bigger model costs the difference; its fittings stay on.
  const upgradeCost = (s, k) => SUB[k].cost - SUB[s.k].cost;

  function siteOf(x) {
    return SITE[x.k];
  }
  function targetOf(x) {
    return TIER[siteOf(x).tier].target;
  }
  function rewardOf(state, x) {
    const t = TIER[siteOf(x).tier];
    return { treasure: t.treasure + (sea(state) === 'rumors' ? 2 : 0), gold: t.gold };
  }

  // Everything that goes into a dive's roll, so the page can show the sum before the dice are thrown.
  function chance(state, pi, expId, subId, crewIds) {
    const p = state.players[pi];
    const x = expOf(state, expId);
    const s = subOf(p, subId);
    if (!x || !s) return null;
    const site = siteOf(x);
    const crew = (crewIds || []).map((id) => diverOf(p, id)).filter(Boolean);
    const parts = [];
    const skill = crew.reduce((t, d) => t + DIVER[d.k].skill, 0);
    if (skill) parts.push({ label: `Crew skill`, v: skill });
    if (SUB[s.k].bonus) parts.push({ label: `${SUB[s.k].name}`, v: SUB[s.k].bonus });
    if (x.scout) parts.push({ label: 'Earlier attempts', v: x.scout });
    const w = sea(state);
    if (w === 'calm') parts.push({ label: 'Calm seas', v: 1 });
    if (w === 'lowtide' && site.depth === 1) parts.push({ label: 'Low tide', v: 2 });
    const haz = site.haz.map((h) => {
      const byDiver = crew.find((d) => DIVER[d.k].spec.includes(h));
      const byMod = s.mods.find((m) => MOD[m].haz === h);
      const ignored = w === 'clear' && h === 'dark';
      const ready = !!(byDiver || byMod) || ignored;
      const pen = ready ? 0 : SEA_DOUBLE[w] === h ? UNCOVERED * 2 : UNCOVERED;
      if (pen) parts.push({ label: `${HAZ[h].icon} ${HAZ[h].name}`, v: -pen });
      return { h, ready, by: byDiver ? byDiver.name : byMod ? MOD[byMod].name : ignored ? 'Crystal water' : null, pen };
    });
    const bonus = parts.reduce((t, x2) => t + x2.v, 0);
    const target = targetOf(x);
    // A natural 20 always works and a natural 1 always fails.
    const need = Math.min(20, Math.max(2, target - bonus));
    const p20 = (21 - need) / 20;
    return { target, bonus, need, p: p20, parts, haz, uncovered: haz.filter((z) => !z.ready).map((z) => z.h) };
  }

  function legal(state, pi, a) {
    if (state.phase !== 'act') return 'The game is over.';
    if (!a || typeof a !== 'object') return 'That isn’t an action.';
    if (state.turn !== pi) return 'It’s not your turn.';
    if (state.passed[pi]) return 'You’ve already ended this tide.';
    const p = state.players[pi];
    switch (a.t) {
      case 'hire': {
        const d = state.market.find((x) => x.id === a.d);
        if (!d) return 'That diver isn’t for hire any more.';
        if (p.divers.length >= MAX_DIVERS) return `Your company can only keep ${MAX_DIVERS} divers.`;
        if (p.gold < DIVER[d.k].cost) return `You need 🪙${DIVER[d.k].cost} to hire ${d.name}.`;
        return '';
      }
      case 'build': {
        const b = SUB[a.k];
        if (!b) return 'There’s no sub like that.';
        if (p.subs.length >= MAX_SUBS) return `Your dock only has room for ${MAX_SUBS} subs.`;
        if (p.gold < b.cost) return `You need 🪙${b.cost} to build a ${b.name}.`;
        return '';
      }
      case 'upgrade': {
        const s = subOf(p, a.s);
        const b = SUB[a.k];
        if (!s || !b) return 'Pick a sub and what to turn it into.';
        if (b.cost <= SUB[s.k].cost) return `A ${b.name} wouldn’t be an upgrade for a ${SUB[s.k].name}.`;
        if (s.stuck >= state.tide) return 'That sub is out of action.';
        if (p.gold < upgradeCost(s, a.k)) return `You need 🪙${upgradeCost(s, a.k)} to rebuild it as a ${b.name}.`;
        return '';
      }
      case 'fit': {
        const s = subOf(p, a.s);
        const m = MOD[a.m];
        if (!s || !m) return 'Pick a sub and a fitting.';
        if (s.mods.length >= SUB[s.k].slots) return `A ${SUB[s.k].name} has no room for ${s.mods.length ? 'more fittings' : 'fittings'}.`;
        if (s.mods.includes(a.m)) return `That sub already has ${m.name.toLowerCase()}.`;
        if (p.gold < m.cost) return `You need 🪙${m.cost} for ${m.name.toLowerCase()}.`;
        return '';
      }
      case 'dive':
      case 'salvage': {
        const s = subOf(p, a.s);
        if (!s) return 'Pick a sub.';
        if (!subReady(state, s)) return s.k === 'minnow' && sea(state) === 'storm' ? 'Minnows stay in port during a storm.' : s.stuck >= state.tide ? 'That sub is out of action.' : 'That sub has already been out this tide.';
        const crew = Array.isArray(a.crew) ? a.crew : [];
        if (!crew.length) return 'Pick at least one diver.';
        if (new Set(crew).size !== crew.length) return 'Pick each diver once.';
        if (crew.length > SUB[s.k].crew) return `A ${SUB[s.k].name} only carries ${plural(SUB[s.k].crew, 'diver')}.`;
        for (const id of crew) {
          const d = diverOf(p, id);
          if (!d) return 'That diver isn’t in your company.';
          if (!diverReady(state, d)) return `${d.name} ${d.tired >= state.tide ? 'is resting' : 'has already been out this tide'}.`;
        }
        if (a.t === 'salvage') return '';
        const x = expOf(state, a.x);
        if (!x) return 'That expedition is gone.';
        if (SUB[s.k].depth < siteOf(x).depth) return `A ${SUB[s.k].name} can’t reach the ${DEPTH[siteOf(x).depth].name.toLowerCase()}.`;
        return '';
      }
      case 'pass':
        return '';
      default:
        return 'That isn’t an action.';
    }
  }

  function apply(state, pi, a) {
    const why = legal(state, pi, a);
    if (why) throw new Error(why);
    const p = state.players[pi];
    state.last = null;
    switch (a.t) {
      case 'hire': {
        const i = state.market.findIndex((x) => x.id === a.d);
        const d = state.market.splice(i, 1)[0];
        p.gold -= DIVER[d.k].cost;
        // A new hire is ready to dive straight away.
        p.divers.push(Object.assign(d, { used: false, tired: 0 }));
        drawDiver(state);
        log(state, `${p.name} hired ${d.name}, ${DIVER[d.k].role.toLowerCase()}, for 🪙${DIVER[d.k].cost}.`, pi);
        break;
      }
      case 'build': {
        p.gold -= SUB[a.k].cost;
        p.subs.push({ id: nid(state), k: a.k, mods: [], used: false, stuck: 0 });
        log(state, `${p.name} built a ${SUB[a.k].name} for 🪙${SUB[a.k].cost}.`, pi);
        break;
      }
      case 'upgrade': {
        const s = subOf(p, a.s);
        const was = SUB[s.k].name;
        const paid = upgradeCost(s, a.k);
        p.gold -= paid;
        s.k = a.k;
        log(state, `${p.name} rebuilt their ${was} as a ${SUB[a.k].name} for 🪙${paid}.`, pi);
        break;
      }
      case 'fit': {
        const s = subOf(p, a.s);
        p.gold -= MOD[a.m].cost;
        s.mods.push(a.m);
        log(state, `${p.name} fitted ${MOD[a.m].name.toLowerCase()} to their ${SUB[s.k].name}.`, pi);
        break;
      }
      case 'salvage': {
        const s = subOf(p, a.s);
        const crew = a.crew.map((id) => diverOf(p, id));
        const gain = 1 + crew.length;
        s.used = true;
        crew.forEach((d) => (d.used = true));
        p.gold += gain;
        state.last = { t: 'salvage', pi, s: s.id, crew: a.crew.slice(), gold: gain };
        log(state, `${p.name}’s ${SUB[s.k].name} went on a salvage run and brought back 🪙${gain}.`, pi);
        break;
      }
      case 'dive':
        dive(state, pi, a);
        break;
      case 'pass':
        state.passed[pi] = true;
        log(state, `${p.name} is done for this tide.`, pi);
        break;
    }
    advance(state, pi);
  }

  function dive(state, pi, a) {
    const p = state.players[pi];
    const s = subOf(p, a.s);
    const x = expOf(state, a.x);
    const site = siteOf(x);
    const c = chance(state, pi, a.x, a.s, a.crew);
    const crew = a.crew.map((id) => diverOf(p, id));
    const d20 = 1 + rint(state, 20);
    const total = d20 + c.bonus;
    const ok = d20 === 20 || (d20 !== 1 && total >= c.target);
    s.used = true;
    crew.forEach((d) => (d.used = true));
    p.stats.dives += 1;
    const out = { t: 'dive', pi, x: x.id, k: x.k, s: s.id, sk: s.k, crew: a.crew.slice(), crewNames: crew.map((d) => d.name), d20, bonus: c.bonus, total, target: c.target, need: c.need, ok, msgs: [] };
    if (ok) {
      const r = rewardOf(state, x);
      const extra = d20 === 20 ? 2 : 0;
      p.treasure += r.treasure;
      p.gold += r.gold + extra;
      p.found.push(x.k);
      p.stats.wins += 1;
      state.map = state.map.filter((y) => y.id !== x.id);
      out.treasure = r.treasure;
      out.gold = r.gold + extra;
      if (state.firsts[site.tier] == null) {
        state.firsts[site.tier] = pi;
        out.first = true;
      }
      if (x.k === 'heart') state.heartTaken = true;
      log(state, `${p.name} explored ${site.name}${d20 === 20 ? ' with a perfect 20' : ''}: 🎲${d20}+${c.bonus} = ${total} (needed ${c.target}). Found 💎${r.treasure} and 🪙${r.gold + extra}${out.first ? ` — first to finish a ${TIER[site.tier].name.toLowerCase()} expedition!` : '.'}`, pi);
      while (state.map.length < MAP_MIN && drawExp(state));
    } else {
      // The worst hazard nobody was ready for strikes; on a 1, any hazard can.
      const pool = d20 === 1 ? site.haz : c.uncovered;
      x.scout = Math.min(SCOUT_MAX, x.scout + 1);
      out.scout = x.scout;
      log(state, `${p.name}’s dive at ${site.name} failed: 🎲${d20}${d20 === 1 ? ' (a disaster!)' : ''}+${c.bonus} = ${total}, needed ${c.target}.`, pi);
      if (!pool.length) {
        out.msgs.push('The crew turned back empty-handed, but everyone is safe.');
      } else {
        const h = pool[rint(state, pool.length)];
        out.strike = h;
        strike(state, pi, h, s, crew, out);
      }
      out.msgs.forEach((m) => log(state, m, pi));
    }
    state.last = out;
  }

  function strike(state, pi, h, s, crew, out) {
    const p = state.players[pi];
    const t = state.tide;
    const sub = SUB[s.k].name;
    const rest = () => crew.forEach((d) => p.divers.includes(d) && (d.tired = Math.max(d.tired, t + 1)));
    if (h === 'shark') {
      const low = Math.min(...crew.map((d) => DIVER[d.k].skill));
      const pick = crew.filter((d) => DIVER[d.k].skill === low);
      const d = pick[rint(state, pick.length)];
      p.divers = p.divers.filter((y) => y !== d);
      p.stats.lost += 1;
      out.lost = d.name;
      out.msgs.push(`🦈 A shark ate ${d.name}!`);
    } else if (h === 'air' || h === 'dark') {
      rest();
      out.msgs.push(`${HAZ[h].icon} The crew ${HAZ[h].fail}. They rest next tide.`);
    } else if (h === 'cave') {
      s.stuck = Math.max(s.stuck, t + 2);
      out.msgs.push(`🪨 The ${sub} got stuck in a collapsing tunnel. Digging it out takes 2 tides.`);
    } else if (h === 'current') {
      const lose = Math.min(3, p.gold);
      p.gold -= lose;
      s.stuck = Math.max(s.stuck, t + 1);
      out.msgs.push(`🌀 A current swept the ${sub} away${lose ? `, with 🪙${lose} of gear` : ''}. It’s out next tide.`);
    } else if (h === 'trap') {
      const pay = Math.min(2, p.gold);
      p.gold -= pay;
      s.stuck = Math.max(s.stuck, t + 1);
      out.msgs.push(`🗿 An ancient trap went off${pay ? `. Repairs cost 🪙${pay}` : ''}; the ${sub} is out next tide.`);
    } else if (h === 'kraken') {
      p.subs = p.subs.filter((y) => y !== s);
      p.stats.wrecked += 1;
      rest();
      out.wrecked = sub;
      out.msgs.push(`🐙 The Kraken woke up and crushed the ${sub}! The crew swam home and rests next tide.`);
    }
  }

  function advance(state, pi) {
    if (state.passed[0] && state.passed[1]) return endTide(state);
    const o = 1 - pi;
    state.turn = state.passed[o] ? pi : o;
  }

  function endTide(state) {
    if (state.tide >= TIDES || state.heartTaken) {
      state.phase = 'over';
      state.turn = null;
      log(state, state.heartTaken ? 'The Heart of Atlantis has been found — the expedition season is over!' : 'The last tide is over — the expedition season ends.');
      return;
    }
    state.tide += 1;
    state.passed = [false, false];
    state.turn = (state.first + state.tide - 1) % 2;
    const w = sea(state);
    state.players.forEach((p, i) => {
      p.divers.forEach((d) => (d.used = false));
      p.subs.forEach((s) => (s.used = false));
      const inc = INCOME + (w === 'gala' ? 3 : 0);
      p.gold += inc;
      const unpaid = [];
      p.divers.slice().sort((a, b) => DIVER[a.k].wage - DIVER[b.k].wage).forEach((d) => {
        const wage = DIVER[d.k].wage;
        if (p.gold >= wage) p.gold -= wage;
        else unpaid.push(d);
      });
      if (unpaid.length) {
        p.divers = p.divers.filter((d) => !unpaid.includes(d));
        log(state, `${p.name} couldn’t pay ${unpaid.map((d) => d.name).join(' and ')}, who quit.`, i);
      }
    });
    // The longest-waiting diver in the hall finds other work; one new expedition is charted.
    if (state.market.length) state.market.shift();
    while (state.market.length < MARKET_SIZE && state.diverDeck.length) drawDiver(state);
    if (state.map.length >= MAP_MAX) {
      const old = state.map.findIndex((x) => x.k !== 'heart');
      if (old >= 0) state.map.splice(old, 1);
    }
    drawExp(state);
    while (state.map.length < MAP_MIN && drawExp(state));
    let heart = '';
    if (state.tide === HEART_TIDE) {
      state.map.push(expCard(state, 'heart'));
      heart = ' The Heart of Atlantis has been sighted!';
    }
    log(state, `Tide ${state.tide} · ${SEA[w].icon} ${SEA[w].name}: ${SEA[w].note} Everyone collects 🪙${INCOME}${w === 'gala' ? '+3' : ''} and pays wages.${heart}`);
  }

  // ---------------------------------------------------------------- scoring
  function score(state, p) {
    const pi = state.players.indexOf(p);
    const treasure = p.treasure;
    const discoveries = Object.values(state.firsts).filter((w) => w === pi).length * DISCOVERY_PTS;
    const gold = Math.floor(p.gold / GOLD_PER_PT);
    return { treasure, discoveries, gold, expeditions: p.found.length, total: treasure + discoveries + gold };
  }
  function winner(state) {
    const [a, b] = state.players.map((p) => score(state, p));
    if (a.total !== b.total) return a.total > b.total ? 0 : 1;
    if (a.treasure !== b.treasure) return a.treasure > b.treasure ? 0 : 1;
    if (a.expeditions !== b.expeditions) return a.expeditions > b.expeditions ? 0 : 1;
    return -1;
  }

  // ---------------------------------------------------------------- computer player
  // The crew that gives the best roll: each diver is worth their skill plus any hazard they make safe.
  function bestCrew(state, pi, x, s, pool) {
    const p = state.players[pi];
    const room = SUB[s.k].crew;
    let left = (pool || readyDivers(state, p)).slice();
    const crew = [];
    while (crew.length < room && left.length) {
      let best = null;
      for (const d of left) {
        const c = chance(state, pi, x.id, s.id, [...crew, d].map((y) => y.id));
        const v = c.bonus - DIVER[d.k].skill * 0.01 * (crew.length ? 0 : 1);
        if (!best || v > best.v) best = { d, v };
      }
      crew.push(best.d);
      left = left.filter((y) => y !== best.d);
    }
    // Drop divers who add nothing but risk (only skill-0 divers would, so keep everyone useful).
    return crew;
  }

  const diverWorth = (d) => DIVER[d.k].cost * 0.5 + DIVER[d.k].skill;
  function lossOf(state, pi, h, s, crew) {
    const p = state.players[pi];
    switch (h) {
      case 'shark': return Math.min(...crew.map(diverWorth));
      case 'kraken': return SUB[s.k].cost * 0.7 + s.mods.length * 2 + 1;
      case 'cave': return 2.4;
      case 'current': return Math.min(3, p.gold) * 0.35 + 1.2;
      case 'trap': return Math.min(2, p.gold) * 0.35 + 1.2;
      default: return crew.length * 0.7;
    }
  }

  function diveValue(state, pi, x, s, crew, level) {
    const c = chance(state, pi, x.id, s.id, crew.map((d) => d.id));
    const site = siteOf(x);
    const r = rewardOf(state, x);
    let gain = r.treasure + r.gold * 0.35 + (state.firsts[site.tier] == null ? DISCOVERY_PTS : 0);
    if (x.k === 'heart') gain += 4;
    const pool = c.uncovered;
    let loss = pool.length ? pool.reduce((t, h) => t + lossOf(state, pi, h, s, crew), 0) / pool.length : 0;
    const disaster = site.haz.reduce((t, h) => t + lossOf(state, pi, h, s, crew), 0) / site.haz.length;
    // Late in the game a lost sub or diver costs less; early on, keep the company whole.
    const late = tidesLeft(state) <= 2 ? 0.4 : tidesLeft(state) <= 4 ? 0.75 : 1;
    if (level === 'easy') loss *= 0.6;
    const pFail = 1 - c.p;
    const pDisaster = 0.05;
    return { v: c.p * gain - ((pFail - pDisaster) * loss + pDisaster * disaster) * late, p: c.p, c };
  }

  // How much the company wants a diver with these specialties, given the expeditions on the map.
  function hazardDemand(state, pi) {
    const p = state.players[pi];
    const dem = {};
    HAZ_ORDER.forEach((h) => (dem[h] = 0));
    const depth = Math.max(maxDepth(p), 1);
    state.map.forEach((x) => {
      const site = siteOf(x);
      const w = TIER[site.tier].treasure / 5;
      const reach = site.depth <= depth + 1 ? 1 : 0.4;
      site.haz.forEach((h) => (dem[h] += w * reach));
    });
    p.divers.forEach((d) => DIVER[d.k].spec.forEach((h) => (dem[h] *= 0.45)));
    p.subs.forEach((s) => s.mods.forEach((m) => (dem[MOD[m].haz] *= 0.6)));
    return dem;
  }

  function options(state, pi, level) {
    const p = state.players[pi];
    const out = [];
    const left = tidesLeft(state);
    const wages = wagesOf(p);
    const reserve = Math.max(0, wages - INCOME);
    const dem = hazardDemand(state, pi);

    const subs = readySubs(state, p);
    const crewPool = readyDivers(state, p);
    for (const s of subs) {
      for (const x of state.map) {
        if (SUB[s.k].depth < siteOf(x).depth) continue;
        const crew = level === 'easy' ? crewPool.slice(0, SUB[s.k].crew) : bestCrew(state, pi, x, s, crewPool);
        if (!crew.length) continue;
        const dv = diveValue(state, pi, x, s, crew, level);
        out.push({ a: { t: 'dive', x: x.id, s: s.id, crew: crew.map((d) => d.id) }, v: dv.v, p: dv.p });
      }
      const crew = crewPool.slice(0, SUB[s.k].crew);
      if (crew.length) out.push({ a: { t: 'salvage', s: s.id, crew: crew.map((d) => d.id) }, v: (1 + crew.length) * 0.35 - 0.05 });
    }

    if (left >= 2 && p.divers.length < MAX_DIVERS) {
      const room = crewRoom(p);
      for (const d of state.market) {
        const info = DIVER[d.k];
        if (p.gold - info.cost < reserve) continue;
        const spec = info.spec.reduce((t, h) => t + dem[h], 0);
        // An empty seat in a sub is a dive the company can't make; a diver with no seat just draws wages.
        const seat = p.divers.length < room ? 1.8 : -1.4 * (p.divers.length - room + 1);
        const v = info.skill * 0.9 + spec * 1.1 - info.cost * 0.3 - info.wage * Math.min(left - 1, 6) * 0.15 + seat;
        out.push({ a: { t: 'hire', d: d.id }, v });
      }
    }

    if (left >= 2 && p.subs.length < MAX_SUBS) {
      const depthNow = maxDepth(p);
      const deep = state.map.filter((x) => siteOf(x).depth > depthNow);
      const deepGain = deep.reduce((t, x) => Math.max(t, TIER[siteOf(x).tier].treasure), 0);
      for (const k of SUB_ORDER) {
        const b = SUB[k];
        if (p.gold - b.cost < reserve) continue;
        const crewGain = Math.min(b.crew, Math.max(0, p.divers.length - crewRoom(p)) + 1);
        const unlock = b.depth > depthNow ? deepGain * 0.45 : 0;
        const v = crewGain * 0.8 + unlock + b.bonus * 0.9 + b.slots * 0.3 - b.cost * 0.3 + (left >= 5 ? 0.8 : 0);
        out.push({ a: { t: 'build', k }, v });
      }
    }

    if (left >= 2) {
      const depthNow = maxDepth(p);
      const deepGain = state.map.filter((x) => siteOf(x).depth > depthNow).reduce((t, x) => Math.max(t, TIER[siteOf(x).tier].treasure), 0);
      for (const s of p.subs) {
        if (s.stuck >= state.tide) continue;
        for (const k of SUB_ORDER) {
          const b = SUB[k];
          const was = SUB[s.k];
          if (b.cost <= was.cost || p.gold - upgradeCost(s, k) < reserve) continue;
          const crewGain = Math.min(b.crew - was.crew, Math.max(0, p.divers.length - crewRoom(p)) + 1);
          const unlock = b.depth > depthNow ? deepGain * 0.45 : 0;
          const v = crewGain * 0.8 + unlock + (b.bonus - was.bonus) * 0.9 + (b.slots - was.slots) * 0.3 - upgradeCost(s, k) * 0.3 + (left >= 4 ? 0.5 : 0);
          out.push({ a: { t: 'upgrade', s: s.id, k }, v });
        }
      }
    }

    if (left >= 1 && level !== 'easy') {
      for (const s of p.subs) {
        if (s.mods.length >= SUB[s.k].slots) continue;
        for (const m of MOD_ORDER) {
          if (s.mods.includes(m) || p.gold - MOD[m].cost < reserve) continue;
          const v = dem[MOD[m].haz] * 0.9 * Math.min(1, left / 3) - MOD[m].cost * 0.3 + SUB[s.k].bonus * 0.15;
          out.push({ a: { t: 'fit', s: s.id, m }, v });
        }
      }
    }
    out.push({ a: { t: 'pass' }, v: 0 });
    return out;
  }

  function aiChoose(state, pi, level) {
    level = AI_LEVEL[level] || 'normal';
    const opts = options(state, pi, level);
    const noise = level === 'easy' ? 4 : level === 'normal' ? 1.2 : 0;
    const minP = level === 'easy' ? 0.15 : level === 'normal' ? 0.3 : 0.2;
    let best = null;
    for (const o of opts) {
      if (o.a.t === 'dive' && o.p < minP) continue;
      let v = o.v;
      // Hard computers race you for the expeditions you're best placed to win.
      if ((level === 'hard' || level === 'brutal') && o.a.t === 'dive') v += rivalThreat(state, pi, o.a.x) * 0.3;
      if (noise) v += (Math.random() - 0.5) * noise;
      if (!best || v > best.v) best = { a: o.a, v };
    }
    return best ? best.a : { t: 'pass' };
  }

  function rivalThreat(state, pi, xid) {
    const o = 1 - pi;
    const op = state.players[o];
    if (state.passed[o]) return 0;
    const x = expOf(state, xid);
    let best = 0;
    for (const s of readySubs(state, op)) {
      if (SUB[s.k].depth < siteOf(x).depth) continue;
      const crew = bestCrew(state, o, x, s);
      if (!crew.length) continue;
      const c = chance(state, o, x.id, s.id, crew.map((d) => d.id));
      best = Math.max(best, c.p * TIER[siteOf(x).tier].treasure);
    }
    return best;
  }

  const api = {
    SAVE_V, TIDES, HEART_TIDE, START_GOLD, INCOME, MAX_SUBS, MAX_DIVERS, MARKET_SIZE, UNCOVERED, SCOUT_MAX, DISCOVERY_PTS, GOLD_PER_PT,
    HAZ, HAZ_ORDER, DEPTH, SUB, SUB_ORDER, MOD, MOD_ORDER, DIVER, DIVER_ORDER, TIER, SITE, SITE_ORDER, SEA, SEA_ORDER, SEA_DOUBLE, AI_LEVEL, AI_HEAD_START,
    newGame, aiHeadStart, legal, apply, chance, score, winner, aiChoose, bestCrew, clone, upgradeCost,
    sea, diverReady, subReady, readyDivers, readySubs, wagesOf, crewRoom, maxDepth, tidesLeft, siteOf, targetOf, rewardOf, expOf, subOf, diverOf,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AtlantisEngine = api;
})(typeof window !== 'undefined' ? window : this);
