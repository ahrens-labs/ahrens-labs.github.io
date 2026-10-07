// Hearthhold — rules engine and computer player. No DOM access, so it also runs in Node for simulations.
(function (root) {
  'use strict';

  const SAVE_V = 2;
  const ROUNDS = 12;
  const BASE_WORKERS = 2;
  const LOCS_PER_GAME = 5;
  const ROW_SIZE = 5;
  const ARMS_MAX = 6;
  const RES = ['food', 'wood', 'stone', 'iron', 'gold'];
  const RES_ICON = { food: '🍞', wood: '🪵', stone: '🪨', iron: '🔩', gold: '🪙' };
  const RES_NAME = { food: 'food', wood: 'wood', stone: 'stone', iron: 'iron', gold: 'gold' };
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const SEASON = {
    spring: { name: 'Spring', icon: '🌸', note: 'Farms work normally.' },
    summer: { name: 'Summer', icon: '☀️', note: 'Worked farms make +1 food.' },
    autumn: { name: 'Autumn', icon: '🍂', note: 'Harvest: worked farms make +2 food.' },
    winter: { name: 'Winter', icon: '❄️', note: 'Farms make nothing, and every 3 villagers burn 1 wood to stay warm.' },
  };

  // Sides of the village, clockwise from the top. Angles are screen degrees (0 = east, 90 = north).
  const SIDES = [
    { k: 'N', name: 'North', ang: 90 },
    { k: 'NE', name: 'North-east', ang: 30 },
    { k: 'SE', name: 'South-east', ang: 330 },
    { k: 'S', name: 'South', ang: 270 },
    { k: 'SW', name: 'South-west', ang: 210 },
    { k: 'NW', name: 'North-west', ang: 150 },
  ];
  const WALL = [
    { name: 'No wall', def: 0 },
    { name: 'Palisade', def: 2, cost: { wood: 2 } },
    { name: 'Stone wall', def: 4, cost: { stone: 3 } },
  ];

  const TERRAIN = {
    plains: { name: 'Plains', icon: '🟫' },
    meadow: { name: 'Meadow', icon: '🌼' },
    forest: { name: 'Forest', icon: '🌲' },
    hills: { name: 'Hills', icon: '⛰️' },
    mountain: { name: 'Mountain', icon: '🏔️' },
  };
  const OPEN = ['plains', 'meadow'];
  const LABOR = ['farm', 'lumber', 'quarry', 'mine'];

  const BUILD = {
    keep: { name: 'Keep', start: true, beds: 3, water: 3, def: 1, slots: 1, pts: 0, color: '#8d6e63', text: 'Your village’s heart. Sleeps 3, has a spring for 3, and adds 🛡️1 on every side. A Steward can work here.' },
    house: { name: 'House', cost: { wood: 2 }, on: OPEN, beds: 3, pts: 0, color: '#f4a261', text: 'Sleeps 3 villagers.' },
    well: { name: 'Well', cost: { stone: 2 }, on: OPEN, water: 4, pts: 0, color: '#4fc3f7', text: 'Water for 4 more villagers. Each Farm next to a Well makes +1 food.' },
    farm: { name: 'Farm', cost: { wood: 1 }, on: ['meadow'], slots: 1, pts: 1, color: '#c0ca33', text: 'Worked by a Farmer: 🍞3. Anyone else: 🍞2. +1 next to a Well. Summer +1, Autumn +2, nothing in Winter.' },
    lumber: { name: 'Lumber camp', cost: { wood: 1 }, on: ['forest'], slots: 1, pts: 1, color: '#66bb6a', text: 'Worked by a Woodcutter: 🪵3. Anyone else: 🪵2.' },
    quarry: { name: 'Quarry', cost: { wood: 2 }, on: ['hills'], slots: 1, pts: 1, color: '#9e9e9e', text: 'Worked by a Stonecutter: 🪨3. Anyone else: 🪨2.' },
    mine: { name: 'Mine', cost: { wood: 2, stone: 1 }, on: ['mountain'], slots: 1, pts: 1, color: '#607d8b', text: 'Worked by a Miner: 🔩2. Anyone else: 🔩1.' },
    inn: { name: 'Inn', cost: { wood: 3, stone: 1 }, on: OPEN, beds: 2, slots: 1, pts: 2, color: '#ffb74d', text: 'Sleeps 2. A Chef or Bard can work here.' },
    workshop: { name: 'Workshop', cost: { wood: 2, stone: 1 }, on: OPEN, slots: 1, pts: 1, color: '#d7a86e', text: 'A Carpenter works here.' },
    smithy: { name: 'Smithy', cost: { stone: 2, iron: 1 }, on: OPEN, slots: 1, pts: 2, color: '#ff7043', text: 'A Blacksmith works here.' },
    bakery: { name: 'Bakery', cost: { wood: 2, stone: 1 }, on: OPEN, slots: 1, pts: 1, color: '#ffcc80', text: 'A Baker works here.' },
    barracks: { name: 'Barracks', cost: { wood: 2, stone: 2 }, on: OPEN, beds: 1, slots: 2, pts: 1, color: '#e57373', text: 'Sleeps 1. Two Guards or Knights can work here.' },
    tower: { name: 'Watchtower', cost: { wood: 1, stone: 3 }, on: OPEN, def: 1, slots: 1, pts: 1, color: '#64b5f6', text: 'Adds 🛡️1 on every side. An Archer can work here.' },
    market: { name: 'Market', cost: { wood: 2, stone: 2 }, on: OPEN, slots: 1, pts: 1, color: '#ffd54f', text: 'Makes 🪙1 every round (+1 more next to an Inn). A Merchant can work here.' },
    chapel: { name: 'Chapel', cost: { stone: 3, gold: 2 }, on: OPEN, slots: 1, pts: 3, color: '#b39ddb', text: 'A Priest can work here.' },
    cathedral: { name: 'Cathedral', wonder: true, need: 7, cost: { wood: 2, stone: 7, gold: 5 }, on: OPEN, pts: 10, color: '#80cbc4', text: 'Wonder — only one village can build it, and you need 7 villagers. Worth ⭐10.' },
    wizardtower: { name: 'Wizard’s Tower', wonder: true, need: 5, cost: { stone: 4, iron: 2, gold: 4 }, on: OPEN, def: 1, slots: 1, pts: 5, color: '#9575cd', text: 'Wonder — only one village can build it, and you need 5 villagers. Adds 🛡️1 on every side. A Wizard can work here.' },
    castle: { name: 'Castle', wonder: true, need: 5, upgrade: true, cost: { stone: 6, iron: 2, gold: 3 }, beds: 3, def: 3, pts: 6, color: '#5c6bc0', text: 'Wonder — only one village can build it, and you need 5 villagers. Upgrades your Keep: sleeps 3 more and adds 🛡️3 more on every side.' },
  };
  const BUILD_ORDER = ['house', 'well', 'farm', 'lumber', 'quarry', 'mine', 'inn', 'bakery', 'workshop', 'smithy', 'market', 'barracks', 'tower', 'chapel', 'castle', 'wizardtower', 'cathedral'];

  const VIL = {
    peasant: { name: 'Peasant', cost: 1, at: null, pts: 1, text: 'Can work any Farm, Lumber camp, Quarry or Mine.' },
    farmer: { name: 'Farmer', cost: 2, at: 'farm', pts: 2, text: 'Farm: 🍞3 instead of 🍞2.' },
    woodcutter: { name: 'Woodcutter', cost: 2, at: 'lumber', pts: 2, text: 'Lumber camp: 🪵3 instead of 🪵2.' },
    stonecutter: { name: 'Stonecutter', cost: 3, at: 'quarry', pts: 2, text: 'Quarry: 🪨3 instead of 🪨2.' },
    miner: { name: 'Miner', cost: 3, at: 'mine', pts: 2, text: 'Mine: 🔩2 instead of 🔩1.' },
    chef: { name: 'Chef', cost: 3, at: 'inn', pts: 2, text: 'Inn: cooks 🍞2 and earns 🪙2 every round.' },
    bard: { name: 'Bard', cost: 3, at: 'inn', pts: 2, text: 'Inn: ⭐1 every round.' },
    baker: { name: 'Baker', cost: 2, at: 'bakery', pts: 2, text: 'Bakery: 🍞1 per Farm you have (at least 🍞2) every round — even in Winter.' },
    carpenter: { name: 'Carpenter', cost: 3, at: 'workshop', pts: 2, text: 'Workshop: 🪵1 every round, and everything you build costs 🪵1 less.' },
    blacksmith: { name: 'Blacksmith', cost: 3, at: 'smithy', pts: 2, text: 'Smithy: forges 🔩1 into 1 set of arms every round. Each set adds 🛡️1 on every side (max 6).' },
    merchant: { name: 'Merchant', cost: 3, at: 'market', pts: 2, text: 'Market: 🪙2 every round, and your trades are 1 for 1.' },
    priest: { name: 'Priest', cost: 3, at: 'chapel', pts: 2, text: 'Chapel: ⭐1 every round and 🛡️4 against the undead.' },
    guard: { name: 'Guard', cost: 2, at: 'barracks', pts: 2, text: 'Barracks: 🛡️2 on every side.' },
    knight: { name: 'Knight', cost: 4, iron: 1, at: 'barracks', pts: 3, text: 'Barracks: 🛡️4 on every side.' },
    archer: { name: 'Archer', cost: 3, at: 'tower', pts: 2, text: 'Watchtower: 🛡️2 on every side, and 🛡️3 more against flyers.' },
    wizard: { name: 'Wizard', cost: 6, at: 'wizardtower', pts: 4, text: 'Wizard’s Tower: 🛡️3 on every side, 🛡️4 more against flyers and the undead, and ⭐1 every round.' },
    steward: { name: 'Steward', cost: 5, at: 'keep', pts: 3, text: 'Keep: you get 1 extra worker every round (from the next round).' },
  };
  const VIL_ORDER = ['peasant', 'farmer', 'woodcutter', 'stonecutter', 'miner', 'chef', 'bard', 'baker', 'carpenter', 'blacksmith', 'merchant', 'priest', 'guard', 'knight', 'archer', 'wizard', 'steward'];
  const DECK = { farmer: 4, woodcutter: 3, stonecutter: 3, miner: 3, chef: 2, bard: 2, baker: 2, carpenter: 2, blacksmith: 2, merchant: 2, priest: 2, guard: 4, knight: 2, archer: 3, wizard: 1, steward: 2 };

  // fly: walls don't help. undead: Priests and Wizards add extra defense.
  const BEAST = {
    wolves: { name: 'Wolf pack', tier: 1, str: 3, kind: 'ground', win: 1, fail: { res: { food: 3 } } },
    goblins: { name: 'Goblin raiders', tier: 1, str: 4, kind: 'ground', win: 2, loot: 1, fail: { res: { gold: 3 } } },
    spiders: { name: 'Giant spider', tier: 1, str: 4, kind: 'ground', win: 2, fail: { res: { wood: 3 } } },
    harpies: { name: 'Harpy', tier: 1, str: 3, kind: 'fly', win: 2, fail: { res: { food: 2, gold: 1 } } },
    imps: { name: 'Imps', tier: 1, str: 4, kind: 'fly', win: 2, fail: { res: { wood: 2, stone: 2 } } },
    troll: { name: 'Troll', tier: 2, str: 8, kind: 'ground', win: 3, fail: { res: { food: 3 }, wall: 1 } },
    griffin: { name: 'Griffin', tier: 2, str: 7, kind: 'fly', win: 3, fail: { leave: 1 } },
    skeletons: { name: 'Skeleton host', tier: 2, str: 7, kind: 'ground', undead: true, win: 3, fail: { leave: 1, renown: 2 } },
    ogre: { name: 'Ogre', tier: 2, str: 9, kind: 'ground', win: 4, loot: 2, fail: { res: { stone: 4, food: 2 } } },
    wyvern: { name: 'Wyvern', tier: 2, str: 8, kind: 'fly', win: 4, fail: { res: { food: 4, wood: 2 } } },
    dragon: { name: 'Dragon', tier: 3, str: 14, kind: 'fly', win: 6, loot: 4, fail: { burn: 1, res: { gold: 3 } } },
    hydra: { name: 'Hydra', tier: 3, str: 13, kind: 'ground', win: 5, fail: { leave: 1, res: { food: 3 } } },
    lich: { name: 'Lich king', tier: 3, str: 13, kind: 'ground', undead: true, win: 5, fail: { leave: 1, renown: 3 } },
    giant: { name: 'Hill giant', tier: 3, str: 14, kind: 'ground', win: 5, fail: { wall: 2, res: { stone: 4 } } },
    basilisk: { name: 'Basilisk', tier: 3, str: 13, kind: 'ground', win: 5, fail: { stone: 1 } },
  };
  const BEAST_ORDER = ['wolves', 'goblins', 'spiders', 'harpies', 'imps', 'troll', 'griffin', 'skeletons', 'ogre', 'wyvern', 'dragon', 'hydra', 'lich', 'giant', 'basilisk'];

  // Locations: each game uses one from every group. Each holds one worker per round.
  const LOC_GROUPS = [
    { k: 'food', name: 'Food', icon: '🍞' },
    { k: 'goods', name: 'Materials', icon: '🪵' },
    { k: 'gold', name: 'Coin & trade', icon: '🪙' },
    { k: 'folk', name: 'People & renown', icon: '👥' },
    { k: 'guard', name: 'Defense', icon: '🛡️' },
  ];
  const LOC = {
    mill: { name: 'Mill fields', group: 'food', img: 'farm', text: 'Take 🍞3, plus 🍞1 for each Farm you have (up to +3).' },
    pier: { name: 'Fishing pier', group: 'food', img: 'well', text: 'Take 🍞5.' },
    hunt: { name: 'Hunting grounds', group: 'food', img: 'archer', text: 'Take 🍞3 and 🪵2.' },
    granary: { name: 'Granary', group: 'food', img: 'bakery', text: 'Take 🍞2. Tonight each of your worked Farms makes 🍞2 more — even in Winter.' },
    woods: { name: 'Timber woods', group: 'goods', img: 'lumber', text: 'Take 🪵4.' },
    pits: { name: 'Stone pits', group: 'goods', img: 'quarry', text: 'Take 🪨3.' },
    yard: { name: 'Builders’ yard', group: 'goods', img: 'workshop', text: 'Take 🪵2 and 🪨2.' },
    ruins: { name: 'Old ruins', group: 'goods', img: 'castle', text: 'Take 🪵1, 🪨1, 🔩1 and 🪙1.' },
    square: { name: 'Market square', group: 'gold', img: 'market', text: 'Take 🪙2, plus 🪙1 for every 2 villagers you have.' },
    post: { name: 'Trading post', group: 'gold', img: 'merchant', text: 'Take 🪙1. For the rest of this round all your trades are 1 for 1.' },
    vein: { name: 'Silver vein', group: 'gold', img: 'mine', text: 'Take 🔩2 and 🪙2.' },
    lender: { name: 'Moneylender', group: 'gold', img: 'steward', text: 'Take 🪙5, but lose ⭐1.' },
    tavern: { name: 'Tavern', group: 'folk', img: 'inn', text: 'Take 🍞1. For the rest of this round your recruits cost 🪙2 less (never below 🪙0).' },
    guild: { name: 'Guild hall', group: 'folk', img: 'house', text: 'Every traveller at the Crossroads moves on and 5 new ones arrive. Your recruits cost 🪙1 less for the rest of this round.' },
    festival: { name: 'Festival green', group: 'folk', img: 'bard', text: 'Gain ⭐2, plus ⭐1 for each Inn you have.' },
    crier: { name: 'Town crier', group: 'folk', img: 'peasant', text: 'A Peasant joins you for free if you have room for them (otherwise take 🪙2). Also take 🍞1.' },
    militia: { name: 'Militia yard', group: 'guard', img: 'guard', text: 'Tonight you get 🛡️2 on every side, plus 🛡️1 for every 3 villagers.' },
    masons: { name: 'Mason’s lodge', group: 'guard', img: 'wall', text: 'Raise the walls on 2 sides by one level for free — tonight’s side first, then your weakest. A bare side gets a Palisade, a Palisade becomes Stone.' },
    watch: { name: 'Watch post', group: 'guard', img: 'tower', text: 'Tonight you get 🛡️3 on every side, or 🛡️5 if tonight’s creature flies.' },
    armory: { name: 'Armory', group: 'guard', img: 'smithy', text: 'Forge 1 set of arms for free (🛡️1 on every side for the rest of the game, max 6) and take 🔩1.' },
    // In every game, with no worker limit — weak on purpose, for workers with nowhere better to go.
    commons: { name: 'Village commons', group: 'open', img: 'peasant', text: 'Take 🍞1. Any number of workers can go here.' },
    odd: { name: 'Odd jobs', group: 'open', img: 'workshop', text: 'Take 🪙1. Any number of workers can go here.' },
  };
  const OPEN_LOCS = ['commons', 'odd'];
  const LOC_ORDER = Object.keys(LOC).filter((k) => LOC[k].group !== 'open');

  // ---------------------------------------------------------------- helpers
  function rng(state) {
    let t = (state.seed = (state.seed + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function shuffle(state, a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng(state) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const seasonOf = (round) => SEASONS[(round - 1) % 4];
  const yearOf = (round) => Math.floor((round - 1) / 4) + 1;

  function costText(c) {
    return RES.filter((r) => c && c[r]).map((r) => `${RES_ICON[r]}${c[r]}`).join(' ') || 'free';
  }
  function fmtRes(c) {
    return RES.filter((r) => c[r]).map((r) => `${RES_ICON[r]}${c[r]}`).join(' ');
  }

  function beastText(k) {
    const b = BEAST[k];
    const f = b.fail;
    const parts = [];
    if (f.res) parts.push(`lose ${fmtRes(f.res)}`);
    if (f.wall === 1) parts.push('the wall on that side drops a level');
    if (f.wall === 2) parts.push('the wall on that side is smashed');
    if (f.leave) parts.push(`${f.leave === 1 ? 'a villager is' : `${f.leave} villagers are`} carried off`);
    if (f.stone) parts.push('your most valuable villager is turned to stone');
    if (f.burn) parts.push('your most valuable building burns down');
    if (f.renown) parts.push(`lose ⭐${f.renown}`);
    return { lose: parts.join(', '), win: `⭐${b.win}${b.loot ? ` and 🪙${b.loot} of loot` : ''}` };
  }
  function beastKind(k) {
    const b = BEAST[k];
    if (b.kind === 'fly') return 'Flies over walls';
    if (b.undead) return 'Undead · attacks one side';
    return 'Attacks one side';
  }

  // ---------------------------------------------------------------- map
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  function hexCells() {
    const cells = [{ q: 0, r: 0 }];
    for (let ring = 1; ring <= 2; ring++) {
      let q = -ring;
      let r = ring;
      // walk the ring starting west-south-west
      for (let d = 0; d < 6; d++) {
        for (let s = 0; s < ring; s++) {
          cells.push({ q, r });
          q += DIRS[d][0];
          r += DIRS[d][1];
        }
      }
    }
    return cells;
  }
  const CELLS = hexCells();
  const ringOf = (c) => Math.max(Math.abs(c.q), Math.abs(c.r), Math.abs(c.q + c.r));
  const NEIGH = CELLS.map((c) =>
    DIRS.map(([dq, dr]) => CELLS.findIndex((o) => o.q === c.q + dq && o.r === c.r + dr)).filter((i) => i >= 0),
  );

  function makeMap(state) {
    for (let tries = 0; tries < 500; tries++) {
      const bag = shuffle(state, [].concat(Array(6).fill('meadow'), Array(3).fill('forest'), Array(3).fill('hills'), Array(2).fill('mountain'), Array(4).fill('plains')));
      const t = ['plains'].concat(bag);
      const ring1 = t.slice(1, 7);
      const ok = ring1.filter((x) => x === 'meadow').length >= 2 && ring1.includes('forest') && ring1.includes('plains') && !ring1.includes('mountain');
      if (ok) return t;
    }
    return ['plains', 'meadow', 'forest', 'plains', 'meadow', 'hills', 'plains', 'mountain', 'meadow', 'forest', 'plains', 'hills', 'meadow', 'mountain', 'forest', 'meadow', 'hills', 'plains', 'meadow'];
  }

  // ---------------------------------------------------------------- setup
  function newGame(opts) {
    const state = {
      v: SAVE_V,
      seed: (opts.seed != null ? opts.seed : Math.floor(Math.random() * 2 ** 31)) | 0,
      round: 1,
      phase: 'act',
      first: opts.first || 0,
      turn: opts.first || 0,
      nextId: 1,
      players: [],
      row: [],
      deck: [],
      threats: [],
      wonders: {},
      log: [],
      dusk: null,
      locs: [],
      spots: {},
    };
    state.terrain = makeMap(state);
    state.locs = LOC_GROUPS.map((g) => {
      const opts = LOC_ORDER.filter((k) => LOC[k].group === g.k);
      return opts[Math.floor(rng(state) * opts.length)];
    });
    const farmCell = [1, 2, 3, 4, 5, 6].find((i) => state.terrain[i] === 'meadow');
    for (let i = 0; i < 2; i++) {
      const p = {
        name: (opts.names && opts.names[i]) || (i ? 'Blue' : 'Red'),
        ai: !!(opts.ai && opts.ai[i]),
        res: { food: 4, wood: 5, stone: 2, iron: 0, gold: i === state.first ? 4 : 5 },
        renown: 0,
        arms: 0,
        muster: 0,
        walls: [0, 0, 0, 0, 0, 0],
        bld: [],
        vil: [],
        castle: false,
        workers: 0,
        done: false,
        flags: {},
        trophies: [],
        lost: 0,
      };
      const keep = { id: state.nextId++, b: 'keep', cell: 0 };
      const farm = { id: state.nextId++, b: 'farm', cell: farmCell };
      p.bld.push(keep, farm);
      p.vil.push({ id: state.nextId++, k: 'peasant', at: farm.id }, { id: state.nextId++, k: 'peasant', at: null });
      state.players.push(p);
    }
    const deck = [];
    Object.keys(DECK).forEach((k) => {
      for (let i = 0; i < DECK[k]; i++) deck.push(k);
    });
    state.deck = shuffle(state, deck);
    state.row = state.deck.splice(0, ROW_SIZE);
    const tier = (n) => shuffle(state, BEAST_ORDER.filter((k) => BEAST[k].tier === n && k !== 'wolves')).slice(0, n === 1 ? 3 : 4);
    const order = ['wolves'].concat(tier(1), tier(2), tier(3));
    state.threats = order.map((k) => ({ k, side: BEAST[k].kind === 'fly' ? null : Math.floor(rng(state) * 6) }));
    startRound(state);
    return state;
  }

  function workerCount(p) {
    return BASE_WORKERS + (workers(p).some((w) => w.v.k === 'steward' && w.spec) ? 1 : 0);
  }
  function startRound(state) {
    state.phase = 'act';
    state.spots = {};
    state.crowd = {};
    state.players.forEach((p) => {
      p.workers = workerCount(p);
      p.done = false;
      p.flags = {};
      p.muster = 0;
    });
    state.turn = state.first;
  }
  function freeLocs(state) {
    return state.locs.filter((k) => state.spots[k] == null).concat(OPEN_LOCS);
  }
  // Workers each player has on an always-open place this round.
  function crowdAt(state, k) {
    return (state.crowd && state.crowd[k]) || [];
  }

  // ---------------------------------------------------------------- village queries
  function bldById(p, id) {
    return p.bld.find((b) => b.id === id);
  }
  function count(p, b) {
    return p.bld.filter((x) => x.b === b).length;
  }
  function slotsOf(b) {
    return BUILD[b].slots || 0;
  }
  function occupants(p, bid) {
    return p.vil.filter((v) => v.at === bid);
  }
  // Can villager kind k work in building b, and would it be its own trade?
  function canWork(k, b) {
    if (VIL[k].at === b) return 'spec';
    if (LABOR.includes(b)) return 'labor';
    return null;
  }
  function workers(p) {
    const out = [];
    p.vil.forEach((v) => {
      if (v.at == null) return;
      const b = bldById(p, v.at);
      if (!b) return;
      const how = canWork(v.k, b.b);
      if (how) out.push({ v, b, spec: how === 'spec' });
    });
    return out;
  }
  function beds(p) {
    let n = 0;
    p.bld.forEach((b) => (n += BUILD[b.b].beds || 0));
    if (p.castle) n += BUILD.castle.beds;
    return n;
  }
  function water(p) {
    let n = 0;
    p.bld.forEach((b) => (n += BUILD[b.b].water || 0));
    return n;
  }
  function room(p) {
    return Math.min(beds(p), water(p)) - p.vil.length;
  }
  function adjacent(p, cell, b) {
    return NEIGH[cell].some((c) => p.bld.some((x) => x.cell === c && x.b === b));
  }
  function hasMerchant(p) {
    return workers(p).some((w) => w.v.k === 'merchant' && w.spec);
  }
  function tradeRate(p) {
    return hasMerchant(p) || (p.flags && p.flags.post) ? 1 : 2;
  }
  function hasCarpenter(p) {
    return workers(p).some((w) => w.v.k === 'carpenter' && w.spec);
  }

  // Muster only counts against this round's creature (k given, later not set).
  function defense(p, k, side, later) {
    const b = BEAST[k];
    let d = BUILD.keep.def + (p.castle ? BUILD.castle.def : 0) + p.arms + (k && !later ? p.muster || 0 : 0);
    p.bld.forEach((x) => {
      if (x.b !== 'keep') d += BUILD[x.b].def || 0;
    });
    workers(p).forEach(({ v, spec }) => {
      if (!spec) return;
      if (v.k === 'guard') d += 2;
      if (v.k === 'knight') d += 4;
      if (v.k === 'archer') d += 2 + (b && b.kind === 'fly' ? 3 : 0);
      if (v.k === 'wizard') d += 3 + (b && (b.kind === 'fly' || b.undead) ? 4 : 0);
      if (v.k === 'priest' && b && b.undead) d += 4;
    });
    if (b && b.kind !== 'fly' && side != null) d += WALL[p.walls[side]].def;
    return d;
  }
  function baseDefense(p) {
    return defense(p, null, null);
  }

  // What each worked building makes this round. Returns totals plus per-building notes for the UI.
  function production(p, season) {
    const out = { food: 0, wood: 0, stone: 0, iron: 0, gold: 0, renown: 0, forge: 0, by: {} };
    const add = (bid, r, n) => {
      if (!n) return;
      out[r] += n;
      (out.by[bid] = out.by[bid] || {})[r] = (out.by[bid][r] || 0) + n;
    };
    const farms = count(p, 'farm');
    p.bld.forEach((b) => {
      if (b.b === 'market') add(b.id, 'gold', 1 + (adjacent(p, b.cell, 'inn') ? 1 : 0));
    });
    workers(p).forEach(({ v, b, spec }) => {
      switch (b.b) {
        case 'farm': {
          const granary = p.flags && p.flags.granary ? 2 : 0;
          if (season === 'winter') {
            add(b.id, 'food', granary);
            break;
          }
          let n = (spec ? 3 : 2) + granary;
          if (season === 'summer') n += 1;
          if (season === 'autumn') n += 2;
          if (adjacent(p, b.cell, 'well')) n += 1;
          add(b.id, 'food', n);
          break;
        }
        case 'lumber': add(b.id, 'wood', spec ? 3 : 2); break;
        case 'quarry': add(b.id, 'stone', spec ? 3 : 2); break;
        case 'mine': add(b.id, 'iron', spec ? 2 : 1); break;
        case 'inn':
          if (v.k === 'chef') { add(b.id, 'food', 2); add(b.id, 'gold', 2); }
          if (v.k === 'bard') add(b.id, 'renown', 1);
          break;
        case 'workshop': add(b.id, 'wood', 1); break;
        case 'smithy': out.forge += 1; (out.by[b.id] = out.by[b.id] || {}).forge = 1; break;
        case 'market': add(b.id, 'gold', 2); break;
        case 'chapel': add(b.id, 'renown', 1); break;
        case 'bakery': add(b.id, 'food', Math.max(2, farms)); break;
        case 'wizardtower': add(b.id, 'renown', 1); break;
        default: break;
      }
    });
    return out;
  }

  function foodNeed(p) {
    return p.vil.length;
  }
  function woodNeed(p, season) {
    return season === 'winter' ? Math.ceil(p.vil.length / 3) : 0;
  }

  function buildCost(p, b) {
    const c = Object.assign({}, BUILD[b].cost);
    if (c.wood && hasCarpenter(p)) c.wood -= 1;
    return c;
  }
  function wallCost(p, side) {
    const lvl = p.walls[side];
    if (lvl >= 2) return null;
    const c = Object.assign({}, WALL[lvl + 1].cost);
    if (c.wood && hasCarpenter(p)) c.wood -= 1;
    return c;
  }
  function canPay(p, c) {
    return RES.every((r) => (p.res[r] || 0) >= (c[r] || 0));
  }
  function pay(p, c) {
    RES.forEach((r) => (p.res[r] -= c[r] || 0));
  }
  // The first traveller in line costs 2 less and the second 1 less (never below 1); Tavern and Guild hall discounts come off after that.
  function rowPrice(state, i, p) {
    const k = state.row[i];
    const disc = i === 0 ? 2 : i === 1 ? 1 : 0;
    const extra = (p && p.flags && p.flags.disc) || 0;
    return { gold: Math.max(0, Math.max(1, VIL[k].cost - disc) - extra), iron: VIL[k].iron || 0 };
  }
  function peasantPrice(p) {
    return { gold: Math.max(0, VIL.peasant.cost - ((p && p.flags && p.flags.disc) || 0)) };
  }

  function freeCells(state, p, b) {
    const on = BUILD[b].on;
    if (!on) return [];
    const used = new Set(p.bld.map((x) => x.cell));
    return state.terrain.map((t, i) => i).filter((i) => !used.has(i) && on.includes(state.terrain[i]));
  }
  function buildBlock(state, pi, b) {
    const p = state.players[pi];
    const B = BUILD[b];
    if (B.wonder && state.wonders[b] != null) return state.wonders[b] === pi ? 'You already built it.' : `${state.players[state.wonders[b]].name} built it first.`;
    if (B.need && p.vil.length < B.need) return `You need ${B.need} villagers first.`;
    if (B.upgrade) return p.castle ? 'Already built.' : null;
    if (!freeCells(state, p, b).length) return `No free ${B.on.map((t) => TERRAIN[t].name.toLowerCase()).join(' or ')} left.`;
    return null;
  }

  // Put a villager in the best free spot: its own trade first, then a labor job, else idle.
  function placeVillager(p, v) {
    const free = (b) => occupants(p, b.id).length < slotsOf(b.b);
    let spot = p.bld.find((b) => VIL[v.k].at === b.b && free(b));
    if (!spot) {
      const order = ['farm', 'lumber', 'quarry', 'mine'];
      const short = p.res.food < p.vil.length * 2 ? order : ['lumber', 'farm', 'quarry', 'mine'];
      for (const t of short) {
        spot = p.bld.find((b) => b.b === t && free(b));
        if (spot) break;
      }
    }
    v.at = spot ? spot.id : null;
  }
  // After building: idle villagers who belong here move in.
  function fillBuilding(p, bld) {
    const cap = slotsOf(bld.b);
    const idle = p.vil.filter((v) => v.at == null);
    const pick = idle.filter((v) => VIL[v.k].at === bld.b).concat(LABOR.includes(bld.b) ? idle.filter((v) => VIL[v.k].at !== bld.b) : []);
    // Also pull specialists out of labor jobs into their own building.
    p.vil.forEach((v) => {
      if (v.at != null && VIL[v.k].at === bld.b && !pick.includes(v)) {
        const cur = bldById(p, v.at);
        if (cur && canWork(v.k, cur.b) !== 'spec') pick.push(v);
      }
    });
    pick.slice(0, cap - occupants(p, bld.id).length).forEach((v) => (v.at = bld.id));
    // Anyone who just left a labor job leaves room for an idle villager.
    p.vil.filter((v) => v.at == null).forEach((v) => placeVillager(p, v));
  }

  function moveTargets(p, v) {
    return p.bld.filter((b) => b.id !== v.at && canWork(v.k, b.b) && occupants(p, b.id).length < slotsOf(b.b));
  }

  // ---------------------------------------------------------------- actions
  function legal(state, pi, a) {
    const p = state.players[pi];
    if (state.phase !== 'act') return 'Not now.';
    if (a.t === 'move') {
      const v = p.vil.find((x) => x.id === a.v);
      if (!v) return 'No such villager.';
      if (a.to == null) return null;
      const b = bldById(p, a.to);
      if (!b || !canWork(v.k, b.b)) return 'They can’t work there.';
      if (b.id !== v.at && occupants(p, b.id).length >= slotsOf(b.b)) return 'That building is full.';
      return null;
    }
    if (state.turn !== pi) return 'It isn’t your turn.';
    if (p.done) return 'You already ended your round.';
    switch (a.t) {
      case 'build': {
        const B = BUILD[a.b];
        if (!B || B.start) return 'Can’t build that.';
        const why = buildBlock(state, pi, a.b);
        if (why) return why;
        if (!B.upgrade && !freeCells(state, p, a.b).includes(a.cell)) return 'You can’t build that there.';
        if (!canPay(p, buildCost(p, a.b))) return 'You can’t afford it.';
        return null;
      }
      case 'wall': {
        const c = wallCost(p, a.side);
        if (!c) return 'That wall is already stone.';
        return canPay(p, c) ? null : 'You can’t afford it.';
      }
      case 'recruit': {
        if (room(p) <= 0) return beds(p) <= water(p) ? 'You need more beds — build a House.' : 'You need more water — build a Well.';
        const price = a.peasant ? peasantPrice(p) : state.row[a.i] ? rowPrice(state, a.i, p) : null;
        if (!price) return 'Nobody there.';
        return canPay(p, price) ? null : 'You can’t afford them.';
      }
      case 'place': {
        if (!state.locs.includes(a.loc) && !OPEN_LOCS.includes(a.loc)) return 'That place isn’t in this game.';
        if (p.workers <= 0) return 'You have no workers left this round.';
        if (OPEN_LOCS.includes(a.loc)) return null;
        if (state.spots[a.loc] != null) return `${state.players[state.spots[a.loc]].name}’s worker is already there.`;
        return null;
      }
      case 'trade': {
        if (!a.trades || !a.trades.length) return 'Make at least one trade.';
        const rate = tradeRate(p);
        const r = Object.assign({}, p.res);
        for (const [give, get] of a.trades) {
          if (!RES.includes(give) || !RES.includes(get) || give === get) return 'Bad trade.';
          if (r[give] < rate) return `Not enough ${RES_NAME[give]}.`;
          r[give] -= rate;
          r[get] += 1;
        }
        return null;
      }
      case 'end':
        return null;
      default:
        return 'Unknown action.';
    }
  }

  function musterAmount(p) {
    return 2 + Math.floor(p.vil.length / 3);
  }
  function squareAmount(p) {
    return 2 + Math.floor(p.vil.length / 2);
  }
  function gain(p, c) {
    RES.forEach((r) => (p.res[r] += c[r] || 0));
  }
  // Sides the Mason's lodge raises: tonight's side first (for creatures on foot), then the weakest.
  function masonSides(state, p) {
    const t = state.threats[state.round - 1];
    const order = [0, 1, 2, 3, 4, 5].filter((i) => p.walls[i] < 2).sort((a, b) => p.walls[a] - p.walls[b] || a - b);
    if (t && t.side != null && p.walls[t.side] < 2) order.splice(order.indexOf(t.side), 1), order.unshift(t.side);
    return order.slice(0, 2);
  }
  // What a location would give player p right now, as a short description.
  function locGain(state, p, k) {
    switch (k) {
      case 'mill': return { food: 3 + Math.min(3, count(p, 'farm')) };
      case 'pier': return { food: 5 };
      case 'hunt': return { food: 3, wood: 2 };
      case 'granary': return { food: 2 };
      case 'woods': return { wood: 4 };
      case 'pits': return { stone: 3 };
      case 'yard': return { wood: 2, stone: 2 };
      case 'ruins': return { wood: 1, stone: 1, iron: 1, gold: 1 };
      case 'square': return { gold: squareAmount(p) };
      case 'post': return { gold: 1 };
      case 'vein': return { iron: 2, gold: 2 };
      case 'lender': return { gold: 5 };
      case 'tavern': return { food: 1 };
      case 'crier': return room(p) > 0 ? { food: 1 } : { food: 1, gold: 2 };
      case 'armory': return { iron: 1 };
      case 'commons': return { food: 1 };
      case 'odd': return { gold: 1 };
      default: return {};
    }
  }
  function useLoc(state, pi, k) {
    const p = state.players[pi];
    const g = locGain(state, p, k);
    gain(p, g);
    const got = fmtRes(g);
    const t = state.threats[state.round - 1];
    switch (k) {
      case 'granary': p.flags.granary = true; return `took ${got} and filled the Granary`;
      case 'post': p.flags.post = true; return `took ${got} — trades are 1 for 1 this round`;
      case 'lender': p.renown -= 1; return `borrowed ${got} (−⭐1)`;
      case 'tavern': p.flags.disc = (p.flags.disc || 0) + 2; return `took ${got} — recruits cost 🪙2 less this round`;
      case 'guild': {
        state.deck.push(...state.row.splice(0));
        while (state.row.length < ROW_SIZE && state.deck.length) state.row.push(state.deck.shift());
        p.flags.disc = (p.flags.disc || 0) + 1;
        return 'called new travellers to the Crossroads — recruits cost 🪙1 less this round';
      }
      case 'festival': {
        const n = 2 + count(p, 'inn');
        p.renown += n;
        return `held a festival (+⭐${n})`;
      }
      case 'crier': {
        if (room(p) > 0) {
          const v = { id: state.nextId++, k: 'peasant' };
          p.vil.push(v);
          placeVillager(p, v);
          return `took ${got} and a Peasant answered the crier`;
        }
        return `took ${got}`;
      }
      case 'militia': p.muster += musterAmount(p); return `mustered the militia (🛡️+${musterAmount(p)} tonight)`;
      case 'watch': {
        const n = t && BEAST[t.k].kind === 'fly' ? 5 : 3;
        p.muster += n;
        return `manned the watch post (🛡️+${n} tonight)`;
      }
      case 'masons': {
        const sides = masonSides(state, p);
        sides.forEach((i) => (p.walls[i] += 1));
        return sides.length ? `raised the ${sides.map((i) => SIDES[i].name.toLowerCase()).join(' and ')} walls` : 'found nothing left to wall';
      }
      case 'armory': {
        if (p.arms < ARMS_MAX) p.arms += 1;
        return `forged arms (${p.arms}/${ARMS_MAX}) and took ${got}`;
      }
      default: return `took ${got}`;
    }
  }

  // Apply a legal action. Returns a short description for the log.
  function apply(state, pi, a) {
    const why = legal(state, pi, a);
    if (why) throw new Error(why);
    const p = state.players[pi];
    let msg = '';
    switch (a.t) {
      case 'move': {
        const v = p.vil.find((x) => x.id === a.v);
        v.at = a.to;
        return null;
      }
      case 'build': {
        const c = buildCost(p, a.b);
        pay(p, c);
        if (BUILD[a.b].wonder) state.wonders[a.b] = pi;
        if (BUILD[a.b].upgrade) {
          p.castle = true;
        } else {
          const nb = { id: state.nextId++, b: a.b, cell: a.cell };
          p.bld.push(nb);
          fillBuilding(p, nb);
        }
        msg = `built ${BUILD[a.b].wonder ? 'the ' : 'a '}${BUILD[a.b].name}`;
        break;
      }
      case 'wall': {
        pay(p, wallCost(p, a.side));
        p.walls[a.side] += 1;
        msg = `built a ${WALL[p.walls[a.side]].name.toLowerCase()} on the ${SIDES[a.side].name.toLowerCase()} side`;
        break;
      }
      case 'recruit': {
        let k;
        if (a.peasant) {
          k = 'peasant';
          pay(p, peasantPrice(p));
        } else {
          const price = rowPrice(state, a.i, p);
          pay(p, price);
          k = state.row.splice(a.i, 1)[0];
        }
        const v = { id: state.nextId++, k };
        p.vil.push(v);
        placeVillager(p, v);
        msg = `took in a ${VIL[k].name}`;
        break;
      }
      case 'place': {
        if (OPEN_LOCS.includes(a.loc)) {
          state.crowd = state.crowd || {};
          (state.crowd[a.loc] = state.crowd[a.loc] || []).push(pi);
        } else state.spots[a.loc] = pi;
        p.workers -= 1;
        msg = `sent a worker to the ${LOC[a.loc].name} and ${useLoc(state, pi, a.loc)}`;
        break;
      }
      case 'trade': {
        const rate = tradeRate(p);
        const parts = [];
        a.trades.forEach(([give, get]) => {
          p.res[give] -= rate;
          p.res[get] += 1;
          parts.push(`${RES_ICON[give]}${rate}→${RES_ICON[get]}1`);
        });
        msg = `traded ${parts.join(', ')}`;
        break;
      }
      case 'end':
        p.done = true;
        msg = p.workers > 0 ? `ended the round (${p.workers} worker${p.workers > 1 ? 's' : ''} unused)` : 'ended the round';
        p.workers = 0;
        break;
      default:
        break;
    }
    log(state, `${p.name} ${msg}.`, pi);
    // Placing a worker ends your turn, unless it was your last one: then finish your free actions and end the round.
    if (a.t === 'end' || (a.t === 'place' && p.workers > 0)) advanceTurn(state);
    return msg;
  }

  function advanceTurn(state) {
    const o = 1 - state.turn;
    if (!state.players[o].done) state.turn = o;
    else if (state.players[state.turn].done) state.phase = 'dusk';
  }

  function log(state, text, who) {
    state.log.push({ r: state.round, text, who });
    if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
  }

  // ---------------------------------------------------------------- dusk
  function villagerValue(v) {
    return VIL[v.k].pts + VIL[v.k].cost;
  }
  function loseVillagers(p, n, prefer) {
    const gone = [];
    for (let i = 0; i < n && p.vil.length; i++) {
      const sorted = p.vil.slice().sort((a, b) => {
        if (prefer === 'best') return villagerValue(b) - villagerValue(a);
        const ia = a.at == null ? 0 : 1;
        const ib = b.at == null ? 0 : 1;
        return ia - ib || villagerValue(a) - villagerValue(b);
      });
      const v = sorted[0];
      p.vil.splice(p.vil.indexOf(v), 1);
      gone.push(v.k);
      p.lost += 1;
    }
    p.vil.filter((v) => v.at == null).forEach((v) => placeVillager(p, v));
    return gone;
  }
  function loseRes(p, c) {
    const lost = {};
    RES.forEach((r) => {
      if (!c[r]) return;
      const n = Math.min(p.res[r], c[r]);
      p.res[r] -= n;
      if (n) lost[r] = n;
    });
    return lost;
  }
  function bestBuilding(p) {
    const val = (b) => BUILD[b.b].pts * 10 + RES.reduce((s, r) => s + (BUILD[b.b].cost[r] || 0), 0);
    return p.bld.filter((b) => !BUILD[b.b].start && !BUILD[b.b].wonder).sort((a, b) => val(b) - val(a))[0] || null;
  }

  // Resolve production, the night's attack and upkeep for both villages. Returns a report for the UI.
  function resolveDusk(state) {
    if (state.phase !== 'dusk') throw new Error('Not dusk.');
    const season = seasonOf(state.round);
    const threat = state.threats[state.round - 1];
    const B = BEAST[threat.k];
    const rep = { round: state.round, season, threat, players: [] };
    state.players.forEach((p, pi) => {
      const r = { prod: null, forged: 0, attack: null, ate: 0, burned: 0, left: [], cold: [], hungry: [] };
      // 1. production
      const pr = production(p, season);
      ['food', 'wood', 'stone', 'iron', 'gold'].forEach((x) => (p.res[x] += pr[x]));
      p.renown += pr.renown;
      for (let i = 0; i < pr.forge; i++) {
        if (p.res.iron > 0 && p.arms < ARMS_MAX) {
          p.res.iron -= 1;
          p.arms += 1;
          r.forged += 1;
        }
      }
      r.prod = pr;
      // 2. the attack
      const d = defense(p, threat.k, threat.side);
      const a = { def: d, str: B.str, won: d >= B.str };
      if (a.won) {
        p.renown += B.win;
        if (B.loot) p.res.gold += B.loot;
        p.trophies.push(threat.k);
      } else {
        const f = B.fail;
        if (f.res) a.lost = loseRes(p, f.res);
        if (f.wall && threat.side != null) {
          a.wallFrom = p.walls[threat.side];
          p.walls[threat.side] = f.wall === 2 ? 0 : Math.max(0, p.walls[threat.side] - 1);
          a.wallTo = p.walls[threat.side];
        }
        if (f.leave) a.left = loseVillagers(p, f.leave);
        if (f.stone) a.left = loseVillagers(p, 1, 'best');
        if (f.renown) {
          p.renown -= f.renown;
          a.renown = f.renown;
        }
        if (f.burn) {
          const bb = bestBuilding(p);
          if (bb) {
            p.bld.splice(p.bld.indexOf(bb), 1);
            p.vil.forEach((v) => {
              if (v.at === bb.id) v.at = null;
            });
            p.vil.filter((v) => v.at == null).forEach((v) => placeVillager(p, v));
            a.burned = bb.b;
          }
        }
      }
      r.attack = a;
      // 3. upkeep
      const need = foodNeed(p);
      const eat = Math.min(need, p.res.food);
      p.res.food -= eat;
      r.ate = eat;
      if (eat < need) {
        r.hungry = loseVillagers(p, need - eat);
        p.renown -= r.hungry.length;
      }
      const wneed = woodNeed(p, season);
      if (wneed) {
        const burn = Math.min(wneed, p.res.wood);
        p.res.wood -= burn;
        r.burned = burn;
        if (burn < wneed) {
          r.cold = loseVillagers(p, wneed - burn);
          p.renown -= r.cold.length;
        }
      }
      rep.players.push(r);
      log(state, duskLine(p, threat, a, r), pi);
    });
    // 4. the crossroads: the longest-waiting traveller moves on, newcomers arrive
    if (state.row.length) rep.leftRow = state.row.shift();
    const kept = state.row.length;
    while (state.row.length < ROW_SIZE && state.deck.length) state.row.push(state.deck.shift());
    rep.arrived = state.row.slice(kept);
    state.dusk = rep;
    if (state.round >= ROUNDS) {
      state.phase = 'over';
      rep.final = state.players.map((p) => score(state, p));
    } else {
      state.round += 1;
      state.first = 1 - state.first;
      startRound(state);
    }
    return rep;
  }

  function duskLine(p, threat, a, r) {
    const nm = BEAST[threat.k].name;
    let s = a.won ? `${p.name} drove off the ${nm} (🛡️${a.def} vs ${a.str}).` : `The ${nm} broke through ${p.name}’s defenses (🛡️${a.def} vs ${a.str}).`;
    const gone = r.hungry.length + r.cold.length;
    if (gone) s += ` ${gone} villager${gone > 1 ? 's' : ''} left — not enough ${r.hungry.length ? 'food' : 'firewood'}.`;
    return s;
  }

  // ---------------------------------------------------------------- scoring
  function score(state, p) {
    const s = { renown: p.renown, buildings: 0, villagers: 0, walls: 0, gold: Math.floor(p.res.gold / 5), fortified: 0 };
    p.bld.forEach((b) => {
      if (scores(p, b)) s.buildings += BUILD[b.b].pts;
    });
    if (p.castle) s.buildings += BUILD.castle.pts;
    p.vil.forEach((v) => (s.villagers += VIL[v.k].pts));
    s.walls = p.walls.filter((w) => w === 2).length;
    s.fortified = p.walls.every((w) => w > 0) ? 3 : 0;
    s.total = s.renown + s.buildings + s.villagers + s.walls + s.gold + s.fortified;
    return s;
  }
  // Buildings with jobs only count if someone works there; wonders always count.
  function scores(p, b) {
    const B = BUILD[b.b];
    return B.wonder || !B.slots || occupants(p, b.id).some((v) => canWork(v.k, b.b));
  }

  function winner(state) {
    const sc = state.players.map((p) => score(state, p));
    if (sc[0].total !== sc[1].total) return sc[0].total > sc[1].total ? 0 : 1;
    const v = state.players.map((p) => p.vil.length);
    if (v[0] !== v[1]) return v[0] > v[1] ? 0 : 1;
    return -1;
  }

  // ---------------------------------------------------------------- computer player
  const VAL = { food: 0.3, wood: 0.35, stone: 0.42, iron: 0.55, gold: 0.38, renown: 1 };

  function upcoming(state, n) {
    return state.threats.slice(state.round - 1, state.round - 1 + n);
  }

  function lossValue(state, p, t) {
    const f = BEAST[t.k].fail;
    let v = 0;
    if (f.res) RES.forEach((r) => (v += Math.min(p.res[r] + 4, f.res[r] || 0) * VAL[r]));
    if (f.wall && t.side != null) v += p.walls[t.side] ? (f.wall === 2 ? p.walls[t.side] * 2 : 2) : 0;
    if (f.leave) v += f.leave * 3.2;
    if (f.stone) v += 4.5;
    if (f.burn) {
      const bb = bestBuilding(p);
      if (bb) v += BUILD[bb.b].pts + 3;
    }
    if (f.renown) v += f.renown;
    return v;
  }

  function evaluate(state, pi, level) {
    const p = state.players[pi];
    const R = ROUNDS - state.round + 1;
    const sc = score(state, p);
    let v = sc.total - sc.gold;
    const later = Math.max(0, Math.min(1, (R - 1) / 3));
    const income = production(p, 'spring');
    const winterNext = (() => {
      for (let r = state.round; r <= ROUNDS; r++) if (seasonOf(r) === 'winter') return r - state.round;
      return -1;
    })();
    const fut = Math.min(R, 6) * 0.75;
    // what the village makes each round, net of food
    v += fut * (income.wood * VAL.wood + income.stone * VAL.stone + income.iron * VAL.iron + income.gold * VAL.gold + income.renown);
    v += fut * Math.min(income.forge, Math.max(0, ARMS_MAX - p.arms)) * 0.45;
    const netFood = income.food - p.vil.length;
    v += fut * Math.min(netFood, 2) * VAL.food;
    // stock on hand
    RES.forEach((r) => {
      const unit = r === 'gold' ? Math.max(1 / 3, VAL.gold * later) : VAL[r] * later;
      const cap = r === 'food' ? Math.max(10, p.vil.length * 3) : 14;
      v += Math.min(p.res[r], cap) * unit + Math.max(0, p.res[r] - cap) * unit * 0.25;
    });
    // starving or freezing is very bad
    const horizon = Math.min(R, 3);
    const foodShort = Math.max(0, -(p.res.food + netFood * horizon - (winterNext >= 0 && winterNext < horizon ? income.food : 0)));
    v -= foodShort * 3.5;
    if (winterNext >= 0 && winterNext <= 2) {
      const wneed = Math.ceil((p.vil.length + 1) / 3);
      const wHave = p.res.wood + income.wood * winterNext;
      v -= Math.max(0, wneed - wHave) * 2;
    }
    // room to grow
    const rm = room(p);
    if (R > 1) {
      const n = p.vil.length;
      // capacity is worth having; filling it never counts against you
      v += 0.9 * Math.min(beds(p), n + 3) + 0.9 * Math.min(water(p), n + 3) + (rm > 0 ? 0.6 : 0);
    }
    // empty job buildings are worth something if someone for them is on offer
    p.bld.forEach((b) => {
      if (BUILD[b.b].slots && !BUILD[b.b].wonder && !scores(p, b) && R > 2 && state.row.some((k) => VIL[k].at === b.b)) v += BUILD[b.b].pts * 0.6;
    });
    // idle hands
    v -= p.vil.filter((x) => x.at == null).length * (R > 1 ? 0.4 : 0);
    // threats on the horizon
    const look = level === 'easy' ? 1 : 3;
    const w = [1, 0.75, 0.5];
    upcoming(state, look).forEach((t, j) => {
      const d = defense(p, t.k, t.side, j > 0);
      const B = BEAST[t.k];
      if (d >= B.str) v += w[j] * (B.win + (B.loot || 0) * VAL.gold);
      else v -= w[j] * (lossValue(state, p, t) * (B.str - d <= 3 ? 1 : 0.8) + Math.min(B.str - d, 5) * 0.35);
    });
    // later creatures hit harder: keep building towards them
    const aim = state.round >= 8 ? 11 : state.round >= 4 ? 7 : 4;
    if (R > 1) v += Math.min(baseDefense(p) + 2, aim) * 0.3;
    return v;
  }

  function bestCell(state, p, b) {
    const cells = freeCells(state, p, b);
    if (!cells.length) return null;
    const score1 = (c) => {
      let s = 0;
      if (b === 'farm' && adjacent(p, c, 'well')) s += 3;
      if (b === 'well') s += NEIGH[c].filter((n) => p.bld.some((x) => x.cell === n && x.b === 'farm')).length * 2 + NEIGH[c].filter((n) => state.terrain[n] === 'meadow' && !p.bld.some((x) => x.cell === n)).length;
      if (b === 'inn' && adjacent(p, c, 'market')) s += 2;
      if (b === 'market' && adjacent(p, c, 'inn')) s += 2;
      if (b !== 'farm' && state.terrain[c] === 'meadow') s -= 2;
      return s - ringOf(CELLS[c]) * 0.1;
    };
    return cells.sort((a, c) => score1(c) - score1(a))[0];
  }

  // Free actions worth considering (moves are handled automatically when villagers arrive).
  function freeCandidates(state, pi) {
    const p = state.players[pi];
    const out = [];
    BUILD_ORDER.forEach((b) => {
      if (buildBlock(state, pi, b)) return;
      const cell = BUILD[b].upgrade ? null : bestCell(state, p, b);
      out.push({ t: 'build', b, cell });
    });
    for (let s = 0; s < 6; s++) out.push({ t: 'wall', side: s });
    state.row.forEach((k, i) => out.push({ t: 'recruit', i }));
    out.push({ t: 'recruit', peasant: true });
    return out;
  }

  // Trades that would make action a affordable, or null.
  function tradesFor(state, p, a) {
    let c;
    if (a.t === 'build') c = buildCost(p, a.b);
    else if (a.t === 'wall') c = wallCost(p, a.side);
    else if (a.t === 'recruit') c = a.peasant ? peasantPrice(p) : rowPrice(state, a.i, p);
    if (!c) return null;
    const rate = tradeRate(p);
    const res = Object.assign({}, p.res);
    const trades = [];
    for (const r of RES) {
      while ((res[r] || 0) < (c[r] || 0)) {
        if (trades.length >= 4) return null;
        const give = RES.filter((g) => g !== r && res[g] - (c[g] || 0) >= rate).sort((x, y) => res[y] - (c[y] || 0) - (res[x] - (c[x] || 0)) || VAL[x] - VAL[y])[0];
        if (!give) return null;
        res[give] -= rate;
        res[r] += 1;
        trades.push([give, r]);
      }
    }
    return trades.length ? trades : null;
  }

  function sim(state, pi, acts) {
    const s2 = clone(state);
    s2.log = [];
    for (const a of acts) {
      if (legal(s2, pi, a)) return null;
      apply(s2, pi, a);
    }
    return s2;
  }

  // The best single free action and how much it improves the position.
  function bestFree(state, pi, level) {
    const p = state.players[pi];
    const base = evaluate(state, pi, level);
    let best = null;
    freeCandidates(state, pi).forEach((a) => {
      let s2 = sim(state, pi, [a]);
      let first = a;
      let pen = 0;
      if (!s2 && level !== 'easy') {
        const tr = tradesFor(state, p, a);
        if (tr) {
          s2 = sim(state, pi, [{ t: 'trade', trades: tr }, a]);
          first = { t: 'trade', trades: tr };
          pen = 0.3;
        }
      }
      if (!s2) return;
      const gainV = evaluate(s2, pi, level) - base - pen;
      if (!best || gainV > best.gain) best = { a: first, gain: gainV };
    });
    return best;
  }

  // Greedily apply worthwhile free actions to a copy (used to judge what a location enables).
  function settle(state, pi, level, steps) {
    let s2 = state;
    for (let i = 0; i < steps; i++) {
      const b = bestFree(s2, pi, level);
      if (!b || b.gain <= 0.2) break;
      const n = sim(s2, pi, [b.a]);
      if (!n) break;
      s2 = n;
    }
    return s2;
  }

  // One step of the computer's turn: a free action, a worker placement, or ending the round.
  function aiChoose(state, pi, level) {
    level = level || 'normal';
    const p = state.players[pi];
    if (p.done || state.turn !== pi || state.phase !== 'act') return { t: 'end' };
    const noise = level === 'easy' ? 1.6 : level === 'hard' ? 0 : 0.4;
    const jitter = () => (noise ? (rng(state) - 0.5) * noise : 0);
    const free = bestFree(state, pi, level);
    if (free && free.gain + jitter() * 0.5 > (level === 'easy' ? 0.5 : level === 'hard' ? 0.6 : 0.2)) return free.a;
    const open = p.workers > 0 ? freeLocs(state) : [];
    if (!open.length) return { t: 'end' };
    const deny = level === 'easy' ? 0 : 0.25;
    const oi = 1 - pi;
    const opp = state.players[oi];
    const depth = level === 'easy' ? 0 : 3;
    const mine0 = evaluate(settle(state, pi, level, depth), pi, level);
    let oppBase = null;
    let best = null;
    open.forEach((k) => {
      const s2 = sim(state, pi, [{ t: 'place', loc: k }]);
      if (!s2) return;
      s2.turn = pi;
      let v = evaluate(settle(s2, pi, level, depth), pi, level) - mine0;
      if (deny && !opp.done && opp.workers > 0 && !OPEN_LOCS.includes(k)) {
        const so = clone(state);
        so.log = [];
        so.turn = oi;
        if (oppBase == null) oppBase = evaluate(so, oi, level);
        if (!legal(so, oi, { t: 'place', loc: k })) {
          apply(so, oi, { t: 'place', loc: k });
          v += deny * (evaluate(so, oi, level) - oppBase);
        }
      }
      v += jitter();
      if (!best || v > best.v) best = { k, v };
    });
    return best ? { t: 'place', loc: best.k } : { t: 'end' };
  }

  const api = {
    SAVE_V, ROUNDS, BASE_WORKERS, LOCS_PER_GAME, LOC, LOC_GROUPS, LOC_ORDER, OPEN_LOCS, ROW_SIZE, ARMS_MAX, RES, RES_ICON, RES_NAME, SEASONS, SEASON, SIDES, WALL, TERRAIN, LABOR,
    BUILD, BUILD_ORDER, VIL, VIL_ORDER, DECK, BEAST, BEAST_ORDER, CELLS, NEIGH,
    newGame, legal, apply, resolveDusk, score, winner, aiChoose, evaluate,
    seasonOf, yearOf, costText, beastText, beastKind, ringOf,
    beds, water, room, workers, production, defense, baseDefense, buildCost, wallCost, canPay, rowPrice, freeCells, buildBlock,
    occupants, moveTargets, canWork, slotsOf, adjacent, hasMerchant, tradeRate, peasantPrice, squareAmount, locGain, masonSides, freeLocs, crowdAt, workerCount, musterAmount, foodNeed, woodNeed, upcoming, clone,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HearthholdEngine = api;
})(typeof window !== 'undefined' ? window : this);
