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
      name: 'Spinosaurus', type: 'event', cost: { d: 2, c: 5 }, space: 5, food: { t: 'meat', n: 2 }, prod: 3, pts: 8,
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
      name: 'Tyrannosaurus Rex', short: 'T. Rex', type: 'event', cost: { d: 2, c: 1 }, space: 10, food: { t: 'meat', n: 3 }, prod: 3, pts: 10,
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

  // Bump with RULES_VERSION in workers/src/dino.js when costs or rules change, so open tabs on old rules must reload.
  const RULES_VERSION = 8;

  const BOOK = ['compy', 'triceratops', 'spinosaurus', 'stegosaurus', 'velociraptor', 'brachiosaurus', 'trex', 'pachy'];
  const DECK = ['allosaurus', 'mosasaurus', 'carnotaurus', 'microraptor', 'ankylosaurus', 'dilophosaurus', 'parasaurolophus', 'gigantoraptor'];

  // ---------------------------------------------------------------- the 15-round rules ("proto" games; older saves may use the classic 18-round rules)
  // Shared dino market, worker spaces, park scoring, 12 rounds, round events and free powers.
  const PROTO_ROUNDS = 15;
  const PROTO_WORKERS = 3;
  const PROTO_HAND_MAX = 5;
  const PROTO_MARKET = 5;
  // Herd dinos (their powers grow with every copy) get extra copies; one-off giants get fewer.
  const PROTO_COPIES = { compy: 6, microraptor: 5, parasaurolophus: 5, pachy: 5, trex: 2, mosasaurus: 2, spinosaurus: 2, dilophosaurus: 2, ankylosaurus: 2 };
  const PROTO_TREX_ROUNDS = 3;
  // A bred dino starts as an egg, hatches into a baby next round, and grows up after this many Feedings.
  const PROTO_BABY_FEEDS = 2;
  // 15 end-game goal cards; each game uses 3, revealed at the start of these rounds.
  // "Enclosure" here means an active enclosure with at least one living dino.
  const PROTO_GOAL_ROUNDS = [1, 6, 11];
  const PROTO_GEM_PTS = 2;
  const PROTO_RESERVE_OFF = 1;
  const PROTO_GOALS = {
    full: { icon: '🧱', name: 'Full house', desc: '3 points for every 2 enclosures with no empty squares, after your first', pts: (c) => Math.floor(1.5 * Math.max(0, c.pens.filter((x) => x.empty === 0).length - 1)) },
    mixed: { icon: '🤝', name: 'Mixed company', desc: '4 points per species in each enclosure with a watering hole', pts: (c) => 4 * c.pens.reduce((s, x) => s + (x.waters ? x.kinds.size : 0), 0) },
    variety: { icon: '🌈', name: 'Variety show', desc: '1 point per different species in your park', pts: (c) => new Set(c.dinos).size },
    meat: { icon: '🍖', name: 'Meat lovers', desc: '1 point per meat-eating dino after your first', pts: (c) => Math.max(0, c.dinos.filter((sp) => SPECIES[sp].food.t !== 'plant').length - 1) },
    plant: { icon: '🌿', name: 'Leaf eaters', desc: '3 points for every 2 plant-eating dinos', pts: (c) => Math.floor(1.5 * c.dinos.filter((sp) => SPECIES[sp].food.t !== 'meat').length) },
    giants: { icon: '🦕', name: 'Giants', desc: '2 points per dino that takes 5 or more squares', pts: (c) => 2 * c.dinos.filter((sp) => spec(sp).space >= 5).length },
    little: { icon: '🐣', name: 'Little ones', desc: '1 point per dino that takes 4 or fewer squares, after your first', pts: (c) => Math.max(0, c.dinos.filter((sp) => spec(sp).space <= 4).length - 1) },
    water: { icon: '💧', name: 'Oasis', desc: '5 points per watering hole in an enclosure', pts: (c) => 5 * c.pens.reduce((s, x) => s + x.waters, 0) },
    feeders: { icon: '🌾', name: 'Well stocked', desc: '3 points for every 2 feeder squares in enclosures', pts: (c) => Math.floor(1.5 * c.pens.reduce((s, x) => s + x.feeders, 0)) },
    pens: { icon: '🏰', name: 'Many pens', desc: '1 point per enclosure after your first', pts: (c) => Math.max(0, c.pens.length - 1) },
    herds: { icon: '🦖', name: 'Big herds', desc: '5 points per enclosure with 2 or more dinos', pts: (c) => 5 * c.pens.filter((x) => x.n >= 2).length },
    roomy: { icon: '🗺️', name: 'Wide open', desc: '3 points per enclosure of 9 or more squares', pts: (c) => 3 * c.pens.filter((x) => x.size >= 9).length },
    coins: { icon: '🪙', name: 'Treasury', desc: '1 point per 6 coins you have left', pts: (c) => Math.floor(c.P.coins / 6) },
    gems: { icon: '💎', name: 'Gem collector', desc: `${PROTO_GEM_PTS} points per diamond you have left`, pts: (c) => PROTO_GEM_PTS * c.P.diamonds },
    earners: { icon: '💰', name: 'Big earners', desc: '3 points for every 2 coins your best enclosure produces', pts: (c) => Math.floor(1.5 * c.pens.reduce((m, x) => Math.max(m, x.prod), 0)) },
  };
  const PROTO_PACHY_COINS = 5;
  const PROTO_REFRESH = 2;
  const PROTO_GOLDRUSH = 2;
  // Seven kinds of worker space in three tiers. A top or middle tier holds one worker per round;
  // the bottom tier ("open") takes any number of workers from either player.
  const PROTO_SPACES = {
    buy1: { type: 'buy', name: 'Play a dino', icon: '🦖', extra: 0, desc: 'Buy a market or reserved card and place it' },
    buy2: { type: 'buy', name: 'Play a dino', icon: '🦕', extra: 1, desc: 'Play a dino for 🪙1 extra' },
    buy3: { type: 'buy', name: 'Play a dino', icon: '🐊', extra: 2, open: true, desc: 'Play a dino for 🪙2 extra' },
    breed1: { type: 'breed', name: 'Breed', icon: '🥚', extra: 0, desc: 'Add a baby next to a pair of your dinos: half its coins, 💎1 less' },
    breed2: { type: 'breed', name: 'Breed', icon: '🥚', extra: 1, desc: 'Add a baby next to a pair of your dinos: half its coins +🪙1, 💎1 less' },
    breed3: { type: 'breed', name: 'Breed', icon: '🥚', extra: 2, open: true, desc: 'Add a baby next to a pair of your dinos: half its coins +🪙2, 💎1 less' },
    coins1: { type: 'coins', name: 'Coins', icon: '🪙', n: 3, desc: 'Take 3 coins' },
    coins2: { type: 'coins', name: 'Coins', icon: '🪙', n: 2, desc: 'Take 2 coins' },
    coins3: { type: 'coins', name: 'Coins', icon: '🪙', n: 1, open: true, desc: 'Take 1 coin' },
    gem1: { type: 'gem', name: 'Gems', icon: '💎', cost: 5, desc: 'Buy a diamond for 🪙5' },
    gem2: { type: 'gem', name: 'Gems', icon: '💎', cost: 6, desc: 'Buy a diamond for 🪙6' },
    gem3: { type: 'gem', name: 'Gems', icon: '💎', cost: 7, open: true, desc: 'Buy a diamond for 🪙7' },
    forage1: { type: 'forage', name: 'Forage', icon: '🍖', n: 4, desc: 'Take 4 food' },
    forage2: { type: 'forage', name: 'Forage', icon: '🍖', n: 3, desc: 'Take 3 food' },
    forage3: { type: 'forage', name: 'Forage', icon: '🍖', n: 1, open: true, desc: 'Take 1 food' },
    fences1: { type: 'fences', name: 'Fences', icon: '🪵', n: 5, desc: 'Draw 5 fences' },
    fences2: { type: 'fences', name: 'Fences', icon: '🪵', n: 4, desc: 'Draw 4 fences' },
    fences3: { type: 'fences', name: 'Fences', icon: '🪵', n: 2, open: true, desc: 'Draw 2 fences' },
    build1: { type: 'build', name: 'Builder', icon: '🌾', extra: 0, desc: 'Build a feeder or a watering hole' },
    build2: { type: 'build', name: 'Builder', icon: '🌾', extra: 1, desc: 'Build for 🪙1 extra' },
    build3: { type: 'build', name: 'Builder', icon: '🌾', extra: 2, open: true, desc: 'Build for 🪙2 extra' },
    scout1: { type: 'scout', name: 'Scout', icon: '🔭', cards: 2, coin: 1, first: true, desc: 'Reserve 2 cards, take 🪙1, and go first next round' },
    scout2: { type: 'scout', name: 'Scout', icon: '🔭', cards: 1, coin: 1, desc: 'Reserve 1 card and take 🪙1' },
    scout3: { type: 'scout', name: 'Scout', icon: '🔭', cards: 1, open: true, desc: 'Reserve 1 card' },
  };
  const PROTO_EVENTS = {
    drought: { name: 'Drought', icon: '🏜️', desc: 'Forage spaces give half their food (rounded down) this round.' },
    goldrush: { name: 'Gold rush', icon: '💰', desc: `Collect from ${PROTO_GOLDRUSH} enclosures in Production this round.` },
    stampede: { name: 'Stampede', icon: '🐾', desc: 'Fences spaces draw 3 more fences this round.' },
    migration: { name: 'Migration', icon: '🦤', desc: 'The whole market is replaced, and everyone reserves the top card of the deck (if their hand has room).' },
    breeding: { name: 'Breeding season', icon: '🥚', desc: 'Dinos cost 2 coins less, and Breed spaces charge no extra coins this round.' },
    tax: { name: 'Tax day', icon: '🧾', desc: 'Everyone loses a third of their coins (rounded down).' },
    fossil: { name: 'Fossil find', icon: '🦴', desc: 'Whoever has the most enclosures with dinos gains 1 diamond (nobody on a tie).' },
    flood: { name: 'Flood', icon: '🌊', desc: 'Watering holes cost no diamonds this round.' },
    feast: { name: 'Feast', icon: '🍗', desc: 'Everyone gains 3 meat and 3 plants.' },
    tourists: { name: 'Tourists', icon: '📸', desc: 'Everyone gains 2 coins per species in their park.' },
    storm: { name: 'Storm', icon: '⛈️', desc: 'Each park has 4 empty squares filled in, inside enclosures where possible.' },
    heatwave: { name: 'Heatwave', icon: '🔥', desc: 'Every enclosure with dinos eats 1 more food at Feeding this round.' },
    harvest: { name: 'Bumper crop', icon: '🌽', desc: 'Forage spaces give 2 more food this round.' },
    mild: { name: 'Mild weather', icon: '🌤️', desc: 'Every enclosure with dinos eats 1 less food at Feeding this round.' },
    hiring: { name: 'Hiring fair', icon: '🧑‍🌾', desc: 'Everyone places 1 extra worker this round.' },
    gemsale: { name: 'Gem sale', icon: '💎', desc: 'Gems spaces cost 2 coins less this round.' },
    payday: { name: 'Payday', icon: '💵', desc: 'Coins spaces give 2 more coins this round.' },
    boom: { name: 'Building boom', icon: '🏗️', desc: 'Feeders cost no diamonds, and Builder spaces charge no extra coins this round.' },
    inflation: { name: 'Inflation', icon: '📈', desc: 'Dinos cost 2 coins more this round (babies 1 more).' },
    nursery: { name: 'Nursery', icon: '🍼', desc: 'Babies fed at Feeding this round count as fed twice.' },
    scouting: { name: 'Scouting party', icon: '🧭', desc: 'Scout spaces reserve 1 more card this round (if your hand has room).' },
    spoilage: { name: 'Spoilage', icon: '🦠', desc: 'Everyone’s food above 6 spoils (from the bigger pile first).' },
  };
  const PROTO_SP = {
    compy: { space: 2 },
    microraptor: { space: 2 },
    trex: { ability: `Choose a dino. Your opponent can’t place that dino for the next ${PROTO_TREX_ROUNDS} rounds.` },
    gigantoraptor: { ability: 'Place one extra worker next round.' },
    pachy: { ability: `1 point for every ${PROTO_PACHY_COINS} coins you have at game end, for every Pachy you have.` },
    parasaurolophus: { ability: 'Every round: +1 coin for each Parasaurolophus in this enclosure.' },
    allosaurus: { pts: 5, ability: 'Every round: steal 1 coin from your opponent.' },
    velociraptor: { ability: 'Every round: steal 1 food from your opponent.' },
    ankylosaurus: { cost: { d: 1, c: 7 } },
    mosasaurus: { cost: { d: 3, c: 6 }, space: 16 },
    triceratops: { cost: { d: 1, c: 3 }, ability: 'Every round: pay a plant from your supply to put it on your Triceratops page. At game end, 1 point per plant.' },
    spinosaurus: { ability: 'Gain 1 diamond, 5 coins, 15 food, or fill in 10 squares in your opponent’s park. Then reserve the top card of the deck if your hand has room.' },
    dilophosaurus: { ability: 'Take 5 food, draw in 5 fences, reserve a market card, and gain 5 coins.' },
  };
  const protoSpCache = {};

  // A species as the current game's rules define it (prototype games change points and some powers).
  function spec(sp) {
    if (!state || !state.proto) return SPECIES[sp];
    if (!protoSpCache[sp]) {
      protoSpCache[sp] = Object.assign({}, SPECIES[sp], { pts: Math.max(1, Math.round((SPECIES[sp].pts * 2) / 3)) }, PROTO_SP[sp]);
    }
    return protoSpCache[sp];
  }

  function typeLabel(S) {
    return state && state.proto && S.type === 'action' ? 'Every round' : TYPE_LABEL[S.type];
  }

  function typeHelp(S) {
    return state && state.proto && S.type === 'action' ? 'Triggers by itself each round in an active enclosure.' : TYPE_HELP[S.type];
  }

  const rounds = () => (state && state.proto ? PROTO_ROUNDS : ROUNDS);

  function cardCost(sp) {
    return state && state.proto ? protoCost(sp) : SPECIES[sp].cost;
  }

  function protoPhases() {
    return ['food', 'action', 'produce', 'feed'];
  }

  const PROTO_PHASES = {
    action: { name: 'Workers', short: 'Workers', icon: '👷', desc: 'Take turns placing workers on shared action spaces.' },
    produce: { name: 'Production & powers', short: 'Production', icon: '🪙', desc: 'Collect from one active enclosure, then use your dinos’ production powers.' },
  };

  function phaseInfo(ph) {
    return (state && state.proto && PROTO_PHASES[ph]) || PHASES[ph];
  }

  function protoDeck() {
    const out = [];
    BOOK.concat(DECK).forEach((sp) => {
      for (let i = 0; i < (PROTO_COPIES[sp] || 3); i++) out.push(sp);
    });
    return shuffle(out);
  }

  function protoCost(sp) {
    const c = spec(sp).cost;
    if (state.event === 'breeding') return { d: c.d, c: Math.max(0, c.c - 2) };
    return state.event === 'inflation' ? { d: c.d, c: c.c + 2 } : c;
  }

  // What playing a card costs from where it sits: reserved cards (src 'h') cost 1 coin less.
  function playCost(sp, src) {
    const c = protoCost(sp);
    return src === 'h' ? { d: c.d, c: Math.max(0, c.c - PROTO_RESERVE_OFF) } : c;
  }

  // A baby costs half the card's coins (rounded up) and 1 diamond less than the card.
  function breedCost(sp) {
    const c = protoCost(sp);
    return { d: Math.max(0, c.d - 1), c: Math.ceil(c.c / 2) };
  }

  function protoNextEvent() {
    if (!state.events.length) state.events = shuffle(Object.keys(PROTO_EVENTS));
    state.event = state.events.shift();
  }

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
  let setupOnline = false;
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

  const withExtra = (cost, extra) => (extra ? { d: cost.d, c: cost.c + extra } : cost);

  // Extra coins charged by the worker space being used right now (middle and bottom tiers).
  function spaceExtra() {
    const X = state && state.proto && ui && ui.space ? PROTO_SPACES[ui.space] : null;
    return X ? protoExtra(X) : 0;
  }

  // A space's surcharge (Breeding season waives it on Breed spaces).
  const protoExtra = (X) => ((X.type === 'breed' && state.event === 'breeding') || (X.type === 'build' && state.event === 'boom') ? 0 : X.extra || 0);
  const gemCost = (X) => Math.max(0, X.cost - (state.event === 'gemsale' ? 2 : 0));
  const scoutCards = (X) => X.cards + (state.event === 'scouting' ? 1 : 0);

  const handMax = () => PROTO_HAND_MAX;

  // Workers on a space this round (older saves stored a single player index).
  const spaceWorkers = (k) => [].concat(state.spaces[k] == null ? [] : state.spaces[k]);

  function feederCost(n) {
    if (state && state.proto) return { d: state.event === 'boom' ? 0 : 1, c: n };
    return { d: 1, c: 3 + 2 * Math.max(0, n - 5) };
  }
  const WATER_COST = { d: 1, c: 2 };

  function waterCost() {
    return state && state.proto && state.event === 'flood' ? { d: 0, c: WATER_COST.c } : WATER_COST;
  }
  const WATER_SQUARES = 6;
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
      cp.prod = cp.living.reduce((s, d) => s + dinoProd(d), 0);
    });
    return { compOf, comps };
  }

  function legalEdges(p) {
    return legalEdgesB(state.players[p].board);
  }

  // A fence between two squares of the same dino, feeder or watering hole would cut it in half.
  function splitsItemB(b, e) {
    const [x, y] = edgeCells(e);
    return b.cells[x] > 0 && b.cells[x] === b.cells[y];
  }

  function legalEdgesB(b) {
    const out = [];
    for (let i = 0; i < 90; i++) {
      if (!b.h[i] && !splitsItemB(b, 'h' + i)) out.push('h' + i);
      if (!b.v[i] && !splitsItemB(b, 'v' + i)) out.push('v' + i);
    }
    return out;
  }

  function fenceProblem(b, edges) {
    if (!edges.length) return '';
    const an = analyze(withEdges(b, edges));
    const bad = an.comps.find((cp) => cp.species.size > 1 + cp.waters.length);
    return bad ? 'Those fences would leave different species together without a watering hole.' : '';
  }

  function applyEdges(b, list) {
    const edges = list.filter((e) => !splitsItemB(b, e));
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
    const set = new Set(cells);
    const fenced = cells.some((i) => (i % N < N - 1 && set.has(i + 1) && b.v[Math.floor(i / N) * 9 + (i % N)]) || (set.has(i + N) && b.h[i]));
    if (fenced) return { ok: false, msg: 'A piece can’t sit across a fence.' };
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
  // Eggs and babies (prototype breeding): eggs do nothing; babies take half the squares (rounded down) and
  // have half the production and points and eat half the food (all rounded up). Pieces without a stage are adults.
  const babySize = (sp) => Math.max(1, Math.floor(spec(sp).space / 2));
  const isAdult = (d) => !d.stage;
  const hatched = (d) => d.stage !== 'egg';

  function dinoFood(d) {
    const n = SPECIES[d.species].food.n;
    return d.stage === 'egg' ? 0 : d.stage === 'baby' ? Math.ceil(n / 2) : n;
  }

  function dinoProd(d) {
    const n = SPECIES[d.species].prod;
    return d.stage === 'egg' ? 0 : d.stage === 'baby' ? Math.ceil(n / 2) : n;
  }

  function dinoPoints(d) {
    const n = spec(d.species).pts;
    return d.stage === 'egg' ? 0 : d.stage === 'baby' ? Math.ceil(n / 2) : n;
  }

  // Feeders take 1 food per feeder square off the enclosure's whole bill (not off each dino).
  function enclosureCost(cp) {
    const c = { meat: 0, plant: 0, flex: 0 };
    const extra = cp.inactive || 0;
    cp.living.forEach((d) => {
      if (d.stage === 'egg') return;
      c[SPECIES[d.species].food.t] += dinoFood(d) + extra;
    });
    let off = cp.feederSquares;
    for (const k of ['meat', 'plant', 'flex']) {
      const t = Math.min(off, c[k]);
      c[k] -= t;
      off -= t;
    }
    c.discount = cp.feederSquares - off;
    const eaters = cp.living.filter((d) => d.stage !== 'egg');
    if (state && state.proto && state.event === 'heatwave' && eaters.length) c[SPECIES[eaters[0].species].food.t]++;
    if (state && state.proto && state.event === 'mild' && eaters.length) {
      const k = ['meat', 'plant', 'flex'].find((t) => c[t] > 0);
      if (k) c[k]--;
    }
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

  // How much of a "meat or plant" food bill can come from meat: [fewest, most].
  function flexMeatRange(P, c) {
    return [Math.max(0, c.flex - (P.plants - c.plant)), Math.max(0, Math.min(c.flex, P.meat - c.meat))];
  }

  // Meat spent on the flexible part of a food bill: the player's choice if given, else from the bigger pile.
  function flexMeatPick(P, c, want) {
    const [lo, hi] = flexMeatRange(P, c);
    if (want != null) return clamp(want, lo, hi);
    let m = P.meat - c.meat;
    let pl = P.plants - c.plant;
    let fm = 0;
    for (let i = 0; i < c.flex; i++) {
      if (m >= pl && m > 0) { m--; fm++; } else pl--;
    }
    return clamp(fm, lo, hi);
  }

  function producible(p) {
    const an = analyze(state.players[p].board);
    return an.comps.filter((cp) => cp.active && cp.living.length);
  }

  function bestProdB(b) {
    return analyze(b).comps.reduce((mx, cp) => (cp.active && cp.living.length ? Math.max(mx, cp.prod) : mx), 0);
  }

  function dinoSummary(cp, includeDead) {
    const counts = {};
    (includeDead ? cp.dinos : cp.living).forEach((d) => {
      const k = `${d.species}|${d.stage || ''}`;
      counts[k] = (counts[k] || 0) + 1;
    });
    const label = { egg: ' egg', baby: ' baby' };
    return Object.keys(counts)
      .map((k) => {
        const [sp, stage] = k.split('|');
        return `<span class="dzn">${dz(sp)} ${spName(sp)}${label[stage] || ''}${counts[k] > 1 ? ' ×' + counts[k] : ''}</span>`;
      })
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
    const need = spec(sp).space;
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

  // Prototype games have no dino books, so T. Rex can block any dino the opponent could still get.
  function trexOptions(p) {
    const O = state.players[other(p)];
    const pool = state.proto ? [...new Set(O.hand.concat(state.faceUp, state.deck).filter(Boolean))] : O.book;
    return pool.filter((sp) => !O.blocked.includes(sp));
  }

  function canShop(P) {
    return canAfford(P, DIAMOND_COST) || canAfford(P, feederCost(1)) || canAfford(P, waterCost());
  }

  function scorePlayer(p) {
    if (state.proto) return protoScore(p);
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
    const micro = 2 * microEnclosures;
    const tri = count('triceratops') > 0 ? Math.floor(P.triPlants / 2) * 3 : 0;
    const diamonds = P.diamonds * 3;
    const abilities = compy + pachy + micro + tri;
    return { dinoPts, compy, pachy, micro, tri, abilities, diamonds, total: dinoPts + abilities + diamonds };
  }

  function compyAdjacency(b, an, dinos) {
    let n = 0;
    dinos.filter((x) => x.d.species === 'compy').forEach(({ d }) => {
      const i = d.cells[0];
      orthNbrs(i).forEach((j) => {
        const v = b.cells[j];
        if (v > 0 && an.compOf[j] === an.compOf[i]) {
          const it = b.items[v];
          if (it && it.species === 'compy' && !it.dead) n++;
        }
      });
    });
    return n;
  }

  // Each Compy scores 1 per other Compy touching any of its squares in the same enclosure (babies half).
  function protoCompyAdjacency(b, an, dinos) {
    let n = 0;
    dinos.filter((x) => x.d.species === 'compy').forEach(({ d }) => {
      const near = new Set();
      d.cells.forEach((i) => orthNbrs(i).forEach((j) => {
        const it = b.items[b.cells[j]];
        if (it && it !== d && it.species === 'compy' && !it.dead && hatched(it) && an.compOf[j] === an.compOf[i]) near.add(it.id);
      }));
      n += isAdult(d) ? near.size : Math.ceil(near.size / 2);
    });
    return n;
  }

  // What the goal cards look at: active enclosures that hold living dinos, plus leftovers.
  function protoGoalCtx(P, b, extra) {
    const live = analyze(b).comps.filter((cp) => cp.active && cp.living.some(hatched));
    const pens = live.map((cp) => ({
      empty: cp.empty, kinds: cp.species, n: cp.living.filter(hatched).length, size: cp.cells.length, waters: cp.waters.length, feeders: cp.feederSquares, prod: cp.prod,
    }));
    const dinos = live.flatMap((cp) => cp.living.filter(hatched).map((d) => d.species));
    return { P, pens, dinos: extra ? dinos.concat(extra) : dinos };
  }

  // "one is revealed at the start, one after round 4, ..."
  function protoGoalSchedule() {
    const after = PROTO_GOAL_ROUNDS.slice(1).map((r) => `one after round ${r - 1}`);
    return ['one is revealed at the start'].concat(after.slice(0, -1)).join(', ') + ` and ${after[after.length - 1]}`;
  }

  function protoGoalsShown() {
    if (!state.goals) return 0;
    if (state.queue[0] && state.queue[0].t === 'gameOver') return state.goals.length;
    return PROTO_GOAL_ROUNDS.filter((r) => state.round >= r).length;
  }

  function protoNewGoal() {
    const i = PROTO_GOAL_ROUNDS.indexOf(state.round);
    return i >= 0 && state.goals ? PROTO_GOALS[state.goals[i]] : null;
  }

  function logNewGoal() {
    const G = protoNewGoal();
    if (G) logMsg(`🎯 New goal revealed: ${G.icon} <b>${G.name}</b> — ${G.desc}.`);
  }

  // Prototype scoring: dino points, dino abilities, the goal cards, diamonds and a little for leftover coins.
  function protoScore(p) {
    const P = state.players[p];
    const b = P.board;
    const an = analyze(b);
    const active = an.comps.filter((cp) => cp.active && cp.living.length);
    const dinos = [];
    active.forEach((cp) => cp.living.filter(hatched).forEach((d) => dinos.push({ d, cp })));
    const count = (sp, adult) => dinos.filter((x) => x.d.species === sp && isAdult(x.d) === adult).length;
    // Babies score half (rounded up) of their card points and of each scoring ability.
    const half = (n, adult) => (adult ? n : Math.ceil(n / 2));
    const dinoPts = dinos.reduce((s, x) => s + dinoPoints(x.d), 0);
    const compy = protoCompyAdjacency(b, an, dinos);
    const perPachy = Math.floor(P.coins / PROTO_PACHY_COINS);
    const pachy = count('pachy', true) * perPachy + count('pachy', false) * half(perPachy, false);
    const micro = active.reduce((s, cp) => s + (cp.living.some((d) => d.species === 'microraptor' && isAdult(d)) ? 2 : cp.living.some((d) => d.species === 'microraptor' && d.stage === 'baby') ? 1 : 0), 0);
    const triFull = P.triPlants;
    const tri = count('triceratops', true) ? triFull : count('triceratops', false) ? half(triFull, false) : 0;
    const ctx = protoGoalCtx(P, b);
    const out = { dinoPts, compy, pachy, micro, tri };
    let goals = 0;
    (state.goals || []).forEach((id, i) => {
      out[`g${i}`] = PROTO_GOALS[id].pts(ctx);
      goals += out[`g${i}`];
    });
    const diamonds = P.diamonds;
    const coins = Math.min(3, Math.floor(P.coins / 10));
    const abilities = compy + pachy + micro + tri;
    return Object.assign(out, { goals, abilities, diamonds, coins, total: dinoPts + abilities + goals + diamonds + coins });
  }

  function scoreRows() {
    if (state && state.proto) {
      return [
        ['🦖 Dino points', 'dinoPts'], ...(state.goals || []).map((id, i) => [`🎯 ${PROTO_GOALS[id].icon} ${PROTO_GOALS[id].name}`, `g${i}`]),
        ['🦎 Compy adjacency', 'compy'], ['🦕 Pachy coins', 'pachy'], ['🦖 Microraptor enclosures', 'micro'],
        ['🌿 Triceratops plants', 'tri'], ['💎 Diamonds (×1)', 'diamonds'], ['🪙 Leftover coins', 'coins'],
      ];
    }
    return REVEAL_ROWS;
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
      hand: [],
    };
  }

  function newGame(names, first, ai, level, pace, proto) {
    buildGame(names, first, ai, level, pace, proto);
    commit();
  }

  function buildGame(names, first, ai, level, pace, proto) {
    resetFx();
    const deck = shuffle(DECK.slice());
    const faceUp = [deck.shift(), deck.shift()];
    state = {
      v: 1,
      gid: newGid(),
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
    if (proto) {
      state.proto = true;
      state.deck = protoDeck();
      state.faceUp = state.deck.splice(0, PROTO_MARKET);
      state.players.forEach((P) => { P.book = []; });
      state.events = shuffle(Object.keys(PROTO_EVENTS));
      state.spaces = {};
      state.workers = [0, 0];
      state.nextFirst = null;
      state.phaseOrder = protoPhases(1);
      protoNextEvent();
      logMsg(`🦖 New game! ${pn(first)} goes first. ${PROTO_ROUNDS} rounds, with an event every round.`);
      state.goals = shuffle(Object.keys(PROTO_GOALS)).slice(0, PROTO_GOAL_ROUNDS.length);
      logMsg(`Round 1 begins. Event: ${PROTO_EVENTS[state.event].icon} <b>${PROTO_EVENTS[state.event].name}</b>.`);
      logNewGoal();
      return;
    }
    logMsg(`🥚 New game! ${pn(first)} goes first this round. First player switches every round.`);
    logMsg('Round 1 begins.');
  }

  function save() {
    if (online) {
      onlinePush();
      return;
    }
    if (state && (state.sim || state.past)) return;
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
      return s && s.v === 1 && Array.isArray(s.queue) ? repairFences(s) : null;
    } catch {
      return null;
    }
  }

  // Older versions could draw a fence through a placed piece; lift those fences so every piece is whole.
  // Prototype games saved before goal cards existed get a fresh set.
  function repairFences(s) {
    if (s.proto) {
      s.events = (s.events || []).filter((k) => PROTO_EVENTS[k]);
      if (!PROTO_EVENTS[s.event]) s.event = 'heatwave';
    }
    if (s.proto && !Array.isArray(s.goals)) s.goals = shuffle(Object.keys(PROTO_GOALS)).slice(0, PROTO_GOAL_ROUNDS.length);
    if (s.proto && s.goals.length > PROTO_GOAL_ROUNDS.length) s.goals = s.goals.slice(0, PROTO_GOAL_ROUNDS.length);
    if (s.proto && s.goals.length < PROTO_GOAL_ROUNDS.length) s.goals = s.goals.concat(shuffle(Object.keys(PROTO_GOALS).filter((id) => !s.goals.includes(id))).slice(0, PROTO_GOAL_ROUNDS.length - s.goals.length));
    (s.players || []).forEach((P) => {
      const b = P.board;
      if (!b || !b.h || !b.v) return;
      for (let i = 0; i < 90; i++) {
        if (b.h[i] && splitsItemB(b, 'h' + i)) b.h[i] = 0;
        if (b.v[i] && splitsItemB(b, 'v' + i)) b.v[i] = 0;
      }
    });
    return s;
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
    if (T.work && ui.space) state.spaces[ui.space] = spaceWorkers(ui.space).concat(T.p);
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
    if (state.proto) return protoRoundTasks();
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
    if (state.round >= rounds()) {
      state.queue = [{ t: 'gameOver' }];
      logMsg(`🏁 Round ${rounds()} is over — final scoring!`);
      return;
    }
    state.round++;
    if (state.proto) {
      state.first = state.nextFirst != null ? state.nextFirst : other(state.first);
      state.nextFirst = null;
      state.phaseOrder = protoPhases(state.round);
      protoExpireBlocks();
      protoNextEvent();
      state.queue.push({ t: 'roundStart' });
      logMsg(`Round ${state.round} begins — ${pn(state.first)} goes first. Event: ${PROTO_EVENTS[state.event].icon} <b>${PROTO_EVENTS[state.event].name}</b>.`);
      logNewGoal();
      return;
    }
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
      if (T.t === 'actions' && T.work && !protoOpenSpaces().length) { skip(`${pn(T.p)} had no action space left for a worker.`); continue; }
      if (T.t === 'feed' && !feedables(analyze(state.players[T.p].board)).length) {
        skip(`${pn(T.p)} had no dinos to feed.`);
        continue;
      }
      if (T.t === 'produce' && !producible(T.p).length) {
        skip(`${pn(T.p)} had no active enclosure with dinos to produce from.`);
        continue;
      }
      if (T.t === 'drawCard' && !state.faceUp.length && !state.deck.length) { skip('No cards left to draw.'); continue; }
      if (T.t === 'drawCard' && state.proto && state.players[T.p].hand.length >= handMax(state.players[T.p])) { skip(`${pn(T.p)}’s hand is full, so no card was reserved.`); continue; }
      if (T.t === 'trex' && !trexOptions(T.p).length) { skip('No dinos left to block.'); continue; }
      if (T.t === 'fillOpp' && emptyCount(other(T.p)) === 0) { skip('Opponent has no empty squares left.'); continue; }
      if (T.t === 'drawFences' && !legalEdges(T.p).length) { skip(`${pn(T.p)} has nowhere left to draw fences.`); continue; }
      if (T.t === 'steal' && T.amount <= 0) { skip(); continue; }
      if (T.t === 'grow') {
        const b = state.players[T.p].board;
        const it = b.items[T.id];
        if (!it || it.stage !== 'baby') { skip(''); continue; }
        if (!growMore(b, it, growExtra(it))) {
          it.cells.forEach((i) => { b.cells[i] = 0; });
          delete b.items[T.id];
          skip(`💀 ${pn(T.p)}’s baby ${spName(it.species)} had no room to grow up and died.`);
          continue;
        }
      }
      if (T.t === 'power' && powerEffect(T)[1] <= 0) { skip(`${pn(T.p)}’s ${spName(T.sp)} had nothing to take.`); continue; }
      if (T.t === 'freePlay' && !(state.proto ? protoPlayOptions(T.p, T) : playOptions(T.p, true)).some((o) => o.ok)) {
        skip(`${pn(T.p)} has no dino worth ${T.limit || 5} or fewer points to play for free.`);
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
    else if (T.t === 'grow' && state.players[p].board.items[T.id]) ui.sel = { type: 'cells', board: p, cells: new Set(), need: growExtra(state.players[p].board.items[T.id]), purpose: 'grow', id: T.id };
    else if (T.t === 'fillOpp') {
      ui.sel = { type: 'cells', board: other(p), cells: new Set(), need: Math.min(T.count, emptyCount(other(p))), purpose: 'rubble' };
    } else if (T.t === 'feed') ui.feed = defaultFeed(p);
    else if (T.t === 'foodChoice') ui.meat = Math.floor(T.amount / 2);
    else if (T.t === 'steal') ui.meat = stealRange(T)[1];
    else if (T.t === 'power' && T.sp === 'triceratops') ui.triPay = triDefault(T);
    else if (T.t === 'roundStart' && state.ai != null && state.players[state.ai].bonusPending) {
      ui.picks[state.ai] = aiBonusPicks(state.ai);
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
    if (state.proto) return protoReserve(p, from);
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
    if (state.proto) {
      if (sp === 'gigantoraptor') {
        if (state.round < rounds()) {
          P.bonusNext++;
          logMsg(`${pn(p)} will place an extra worker next round (Gigantoraptor).`);
        } else logMsg('Gigantoraptor’s bonus has no next round to use.');
        return [];
      }
    }
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
        if (state.round < rounds()) {
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

  // ---------------------------------------------------------------- prototype round engine
  function protoOpenSpaces() {
    return Object.keys(PROTO_SPACES).filter((k) => PROTO_SPACES[k].open || !spaceWorkers(k).length);
  }

  // Workers alternate, starting with the first player; whoever has more workers places the rest at the end.
  function protoRoundTasks() {
    const q = [];
    state.phaseOrder.forEach((ph, k) => {
      if (ph === 'food') {
        q.push({ t: 'roll', k });
        order().forEach((p) => q.push({ t: 'gainFood', p, k, amount: null }));
      } else if (ph === 'action') {
        const left = state.workers.slice();
        let p = state.first;
        while (left[0] + left[1] > 0) {
          if (left[p] > 0) {
            q.push({ t: 'actions', p, k, remaining: 1, work: true });
            left[p]--;
          }
          p = other(p);
        }
      } else if (ph === 'produce') order().forEach((p) => q.push({ t: 'produce', p, k }));
      else if (ph === 'feed') order().forEach((p) => q.push({ t: 'feed', p, k }));
    });
    q.push({ t: 'roundEnd' });
    return q;
  }

  // Two random market cards go to the bottom of the deck and are replaced from the top.
  function protoRefreshMarket() {
    const slots = shuffle(state.faceUp.map((sp, i) => (sp ? i : -1)).filter((i) => i >= 0)).slice(0, PROTO_REFRESH);
    const gone = [];
    slots.forEach((i) => {
      if (!state.deck.length) return;
      gone.push(state.faceUp[i]);
      state.faceUp[i] = state.deck.shift();
    });
    state.deck.push(...gone);
    if (gone.length) logMsg(`🔄 Market refresh: ${gone.map((sp) => `<b>${spName(sp)}</b>`).join(' and ')} ${gone.length > 1 ? 'were' : 'was'} replaced.`);
  }

  function protoStartRound() {
    state.spaces = {};
    state.workers = state.players.map((P) => PROTO_WORKERS + P.bonusPending + (state.event === 'hiring' ? 1 : 0));
    state.players.forEach((P, p) => {
      if (P.bonusPending) logMsg(`${pn(p)} has ${plural(state.workers[p], 'worker')} this round (Gigantoraptor).`);
      P.bonusPending = 0;
    });
    const ev = state.event;
    if (ev !== 'migration' && state.round > 1) protoRefreshMarket();
    if (ev === 'migration') {
      state.deck.push(...state.faceUp);
      state.faceUp = state.deck.splice(0, PROTO_MARKET);
      logMsg('🦤 Migration: the market was replaced.');
      [state.first, other(state.first)].forEach((p) => {
        const P = state.players[p];
        if (P.hand.length < handMax(P) && state.deck.length) {
          P.hand.push(state.deck.shift());
          logMsg(`🦤 ${pn(p)} reserved the top card of the deck.`);
        }
      });
    } else if (ev === 'tax') {
      state.players.forEach((P, p) => {
        const lose = Math.floor(P.coins / 3);
        if (lose) {
          P.coins -= lose;
          logMsg(`🧾 ${pn(p)} lost 🪙${lose} to tax.`);
        }
      });
    } else if (ev === 'fossil') {
      const n = state.players.map((P) => analyze(P.board).comps.filter((cp) => cp.valid && !cp.dead && cp.living.length).length);
      if (n[0] !== n[1]) {
        const w = n[0] > n[1] ? 0 : 1;
        state.players[w].diamonds++;
        logMsg(`🦴 ${pn(w)} has the most enclosures and found 💎1.`);
      } else {
        logMsg('🦴 Fossil find: tied for most enclosures, so nobody found a diamond.');
      }
    } else if (ev === 'feast') {
      state.players.forEach((P) => { P.meat += 3; P.plants += 3; });
      logMsg('🍗 Feast: everyone gained 🍖3 🌿3.');
    } else if (ev === 'tourists') {
      state.players.forEach((P, p) => {
        const n = new Set(analyze(P.board).comps.filter((cp) => cp.active).flatMap((cp) => [...cp.species])).size;
        P.coins += 2 * n;
        if (n) logMsg(`📸 Tourists paid ${pn(p)} 🪙${2 * n}.`);
      });
    } else if (ev === 'storm') {
      state.players.forEach((P, p) => {
        const an = analyze(P.board);
        const inside = [];
        const open = [];
        for (let i = 0; i < 100; i++) if (P.board.cells[i] === 0) (an.comps[an.compOf[i]].valid ? inside : open).push(i);
        const hit = shuffle(inside).slice(0, 4);
        const pens = hit.length;
        hit.push(...shuffle(open).slice(0, 4 - pens));
        hit.forEach((i) => { P.board.cells[i] = -1; });
        if (hit.length) logMsg(`⛈️ The storm filled in ${plural(hit.length, 'square')} of ${pn(p)}’s park${pens ? ` (${pens} inside enclosures)` : ''}.`);
      });
    } else if (ev === 'spoilage') {
      state.players.forEach((P, p) => {
        let lose = Math.max(0, P.meat + P.plants - 6);
        const gone = lose;
        while (lose > 0) {
          if (P.meat >= P.plants) P.meat--;
          else P.plants--;
          lose--;
        }
        if (gone) logMsg(`🦠 ${pn(p)} lost ${gone} food to spoilage.`);
      });
    } else if (ev === 'hiring') {
      logMsg('🧑‍🌾 Hiring fair: everyone places 1 extra worker this round.');
    }
  }

  // Enclosures still on offer in this Production task (Gold rush lets a player collect from several).
  function produceChoices(T) {
    const got = T.got || [];
    return producible(T.p).filter((cp) => !got.includes(cp.key));
  }

  // Production powers become one step each, so the player sees and triggers every one of them.
  function protoPowerTasks(p) {
    const O = state.players[other(p)];
    const comps = producible(p);
    const n = (sp) => comps.reduce((s, cp) => s + cp.living.filter((d) => d.species === sp && isAdult(d)).length, 0);
    const tasks = [];
    if (n('parasaurolophus')) tasks.push({ t: 'power', p, sp: 'parasaurolophus', n: n('parasaurolophus') });
    if (n('allosaurus')) tasks.push({ t: 'power', p, sp: 'allosaurus', n: n('allosaurus') });
    const raid = Math.min(n('velociraptor'), O.meat + O.plants);
    if (raid) tasks.push({ t: 'steal', p, amount: raid });
    else if (n('velociraptor')) logMsg(`${pn(p)}’s Velociraptors found no food to steal.`);
    if (n('triceratops') && state.players[p].plants) tasks.push({ t: 'power', p, sp: 'triceratops', n: n('triceratops') });
    else if (n('triceratops')) logMsg(`${pn(p)} had no 🌿 to put on their Triceratops page.`);
    return tasks;
  }

  // What a production power does right now: [text for the button, amount].
  function powerEffect(T) {
    const O = state.players[other(T.p)];
    if (T.sp === 'parasaurolophus') return [`Collect 🪙${T.n}`, T.n];
    if (T.sp === 'allosaurus') {
      const n = Math.min(T.n, O.coins);
      return [`Steal 🪙${n} from ${O.name}`, n];
    }
    const n = triPay(T);
    return [n ? `Pay 🌿${n}: put ${n} on your Triceratops page` : 'Pay nothing this round', n];
  }

  // Triceratops: at most one plant per adult, from the player's own supply.
  const triMax = (T) => Math.min(T.n, state.players[T.p].plants);
  const triPay = (T) => clamp(ui.triPay == null ? triMax(T) : ui.triPay, 0, triMax(T));

  // Plants the coming Feeding needs, so the default payment doesn't starve plant eaters.
  function triDefault(T) {
    const P = state.players[T.p];
    const need = sumCosts(feedables(analyze(P.board)).map(enclosureCost)).plant;
    return clamp(P.plants - need, 0, triMax(T));
  }

  function usePower(T) {
    const p = T.p;
    const P = state.players[p];
    const O = state.players[other(p)];
    const n = powerEffect(T)[1];
    if (T.sp === 'parasaurolophus') {
      P.coins += n;
      logMsg(`${pn(p)}’s Parasaurolophus earned 🪙${n}.`);
      toast(`🦕 +🪙${n} for ${P.name}`, 'good');
    } else if (T.sp === 'allosaurus') {
      O.coins -= n;
      P.coins += n;
      logMsg(`${pn(p)}’s Allosaurus stole 🪙${n} from ${pn(other(p))}.`);
      toast(`🦖 ${P.name} stole 🪙${n}`, 'good');
    } else if (n) {
      P.plants -= n;
      P.triPlants += n;
      logMsg(`${pn(p)} paid 🌿${n} onto their Triceratops page (${P.triPlants} now).`);
      toast(`🌿 Triceratops page +${n}`, 'good');
    } else {
      logMsg(`${pn(p)} kept their plants instead of feeding the Triceratops page.`);
    }
    resolveCurrent();
  }

  // Market cards and reserved cards a player could place now (or for free with Ankylosaurus).
  function protoPlayOptions(p, freeTask, extra) {
    const P = state.players[p];
    const an = analyze(P.board);
    const free = !!freeTask;
    const limit = free ? freeTask.limit || 5 : 0;
    const src = state.faceUp.map((sp, i) => ({ sp, src: 'm', i })).filter((o) => o.sp);
    if (!free || !freeTask.marketOnly) P.hand.forEach((sp, i) => src.push({ sp, src: 'h', i }));
    return src.map((o) => {
      let why = '';
      if (P.blocked.includes(o.sp)) why = 'Blocked by T. Rex';
      else if (free ? spec(o.sp).pts > limit : !canAfford(P, withExtra(playCost(o.sp, o.src), extra || 0))) why = free ? `Worth more than ${limit} points` : 'Can’t afford yet';
      else if (!roomFor(p, o.sp, an)) why = 'No room in your park';
      return Object.assign(o, { ok: !why, why });
    });
  }

  // Breeding: an egg of a species that has an adult pair in one enclosure. The egg goes in that enclosure.
  function breedPens(an, sp) {
    return an.comps.filter((cp) => cp.valid && !cp.dead && cp.living.filter((d) => d.species === sp && isAdult(d)).length >= 2);
  }

  function protoBreedOptions(p, extra) {
    const P = state.players[p];
    const b = P.board;
    const an = analyze(b);
    const kinds = [...new Set(Object.values(b.items).filter((it) => it.kind === 'dino' && !it.dead && isAdult(it)).map((it) => it.species))]
      .filter((sp) => breedPens(an, sp).length);
    return kinds.map((sp, i) => {
      let why = '';
      if (P.blocked.includes(sp)) why = 'Blocked by T. Rex';
      else if (!canAfford(P, withExtra(breedCost(sp), extra || 0))) why = 'Can’t afford yet';
      else if (!protoBreedCells(p, sp)) why = 'No room next to the pair';
      return { sp, src: 'b', i, ok: !why, why };
    });
  }

  // `roomy`: only spots that leave the new baby (and any babies already there) room to grow up.
  function protoBreedCells(p, sp, roomy) {
    const b = state.players[p].board;
    const an = analyze(b);
    for (const cp of breedPens(an, sp)) {
      if (roomy) {
        const free = cp.cells.filter((i) => b.cells[i] === 0).length;
        const owed = cp.dinos.filter((d) => d.stage).reduce((s, d) => s + growExtra(d), 0);
        if (free - owed < spec(sp).space) continue;
      }
      const cells = aiFindCellsB(b, babySize(sp), sp, cp.key);
      if (!cells) continue;
      if (roomy) {
        const nb = cloneBoard(b);
        placeItemB(nb, 'dino', cells, sp);
        const egg = nb.items[nb.nextId - 1];
        if (!growMore(nb, egg, spec(sp).space - cells.length)) continue;
      }
      return cells;
    }
    return null;
  }

  // Squares a baby could grow into: `extra` empty squares joined to it inside its enclosure, with no fence inside.
  function growMore(b, it, extra) {
    const an = analyze(b);
    const home = an.compOf[it.cells[0]];
    const free = new Set(an.comps[home].cells.filter((i) => b.cells[i] === 0));
    const seen = new Set(it.cells);
    const queue = it.cells.slice();
    const out = [];
    for (let q = 0; q < queue.length && out.length < extra; q++) {
      for (const j of orthNbrs(queue[q])) {
        if (out.length >= extra) break;
        if (free.has(j) && !seen.has(j) && !orthNbrs(j).some((x) => seen.has(x) && fenceBetween(b, x, j))) {
          seen.add(j);
          queue.push(j);
          out.push(j);
        }
      }
    }
    return out.length >= extra ? out : null;
  }

  const growExtra = (it) => spec(it.species).space - it.cells.length;

  function validateGrow(p, id, cells) {
    const b = state.players[p].board;
    const it = b.items[id];
    if (!it || it.stage !== 'baby') return { ok: false, msg: 'This baby is gone.' };
    const extra = growExtra(it);
    if (cells.length !== extra) return { ok: false, msg: `Select ${extra} more square${extra === 1 ? '' : 's'} next to the baby (${cells.length} so far).` };
    if (cells.some((i) => b.cells[i] !== 0)) return { ok: false, msg: 'Every square must be empty.' };
    const an = analyze(b);
    const home = an.compOf[it.cells[0]];
    if (cells.some((i) => an.compOf[i] !== home)) return { ok: false, msg: 'It has to grow inside its own enclosure.' };
    const all = it.cells.concat(cells);
    if (!contiguous(all)) return { ok: false, msg: 'The new squares must join the baby side to side.' };
    const set = new Set(all);
    if (all.some((i) => (i % N < N - 1 && set.has(i + 1) && b.v[Math.floor(i / N) * 9 + (i % N)]) || (set.has(i + N) && b.h[i]))) return { ok: false, msg: 'A piece can’t sit across a fence.' };
    return { ok: true, msg: `Room for an adult ${spName(it.species)} ✔` };
  }

  // Eggs laid last round hatch; babies fed enough times grow up (the player picks the new squares).
  function protoHatchAndGrow() {
    const tasks = [];
    [state.first, other(state.first)].forEach((p) => {
      Object.values(state.players[p].board.items).forEach((it) => {
        if (it.kind !== 'dino' || it.dead) return;
        if (it.stage === 'egg' && it.born < state.round) {
          it.stage = 'baby';
          it.fed = 0;
          logMsg(`🐣 ${pn(p)}’s ${spName(it.species)} egg hatched into a baby.`);
        } else if (it.stage === 'baby' && (it.fed || 0) >= PROTO_BABY_FEEDS) {
          tasks.push({ t: 'grow', p, id: it.id, title: `Baby ${spName(it.species)} is growing up` });
        }
      });
    });
    return tasks;
  }

  const protoBreeding = () => !!(ui.space && PROTO_SPACES[ui.space] && PROTO_SPACES[ui.space].type === 'breed');

  // The dinos the current task can place: free play, a Breed space, or a Play a dino space.
  function protoPickOptions(p, T) {
    if (T.t === 'freePlay') return protoPlayOptions(p, T, 0);
    return protoBreeding() ? protoBreedOptions(p, spaceExtra()) : protoPlayOptions(p, null, spaceExtra());
  }

  function protoExpireBlocks() {
    state.players.forEach((P, p) => {
      P.blockEnd = P.blockEnd || {};
      P.blocked = P.blocked.filter((sp) => {
        if (P.blockEnd[sp] == null) P.blockEnd[sp] = state.round + PROTO_TREX_ROUNDS - 1;
        if (state.round <= P.blockEnd[sp]) return true;
        delete P.blockEnd[sp];
        logMsg(`🦖 The T. Rex block on ${pn(p)}’s <b>${spName(sp)}</b> has ended.`);
        return false;
      });
    });
  }

  function protoTakeFromMarket(i) {
    const sp = state.faceUp[i];
    const nx = state.deck.shift();
    if (nx) state.faceUp[i] = nx;
    else state.faceUp.splice(i, 1);
    return sp;
  }

  function protoReserve(p, from) {
    const P = state.players[p];
    if (P.hand.length >= handMax(P)) return null;
    const sp = from === 'deck' ? state.deck.shift() : protoTakeFromMarket(from);
    if (!sp) return null;
    P.hand.push(sp);
    logMsg(`${pn(p)} reserved ${from === 'deck' ? 'the top card of the deck' : `${dz(sp)} <b>${spName(sp)}</b>`}.`);
    pendingCard = { p, sp, from };
    return sp;
  }

  function protoSpaceAmount(k) {
    const X = PROTO_SPACES[k];
    if (!X) return 0;
    if (X.type === 'forage') return state.event === 'drought' ? Math.max(1, Math.floor(X.n / 2)) : X.n + (state.event === 'harvest' ? 2 : 0);
    if (X.type === 'coins') return X.n + (state.event === 'payday' ? 2 : 0);
    if (X.type === 'fences') return X.n + (state.event === 'stampede' ? 3 : 0);
    return X.n || 0;
  }

  function protoSpaceDesc(k) {
    const X = PROTO_SPACES[k];
    const n = protoSpaceAmount(k);
    if (X.type === 'forage') return `Take ${n} food`;
    if (X.type === 'fences') return `Draw ${n} fences`;
    if (X.type === 'coins') return `Take ${plural(n, 'coin')}`;
    if (X.type === 'gem') return `Buy a diamond for 🪙${gemCost(X)}`;
    if (X.type === 'scout' && scoutCards(X) !== X.cards) return X.desc.replace(/Reserve \d+ cards?/, `Reserve ${plural(scoutCards(X), 'card')}`);
    return X.desc;
  }

  function protoSpaceStatus(p, k) {
    const P = state.players[p];
    const X = PROTO_SPACES[k];
    const on = spaceWorkers(k);
    if (!X.open && on.length) return { ok: false, why: `Taken by ${state.players[on[0]].name}` };
    switch (X.type) {
      case 'buy': {
        const opts = protoPlayOptions(p, null, protoExtra(X));
        if (opts.some((o) => o.ok)) return { ok: true };
        return { ok: false, why: opts.length && opts.every((o) => o.why === opts[0].why) ? opts[0].why : 'Nothing you can play' };
      }
      case 'breed': {
        const opts = protoBreedOptions(p, protoExtra(X));
        if (opts.some((o) => o.ok)) return { ok: true };
        return { ok: false, why: !opts.length ? 'Needs a pair in one enclosure' : opts.every((o) => o.why === opts[0].why) ? opts[0].why : 'Nothing you can breed' };
      }
      case 'gem':
        return P.coins >= gemCost(X) ? { ok: true } : { ok: false, why: 'Not enough coins' };
      case 'fences':
        return legalEdges(p).length ? { ok: true } : { ok: false, why: 'No room for fences' };
      case 'build':
        return canAfford(P, withExtra(feederCost(1), protoExtra(X))) || canAfford(P, withExtra(waterCost(), protoExtra(X))) ? { ok: true } : { ok: false, why: 'Can’t afford' };
      case 'scout': {
        const cards = state.faceUp.filter(Boolean).length + state.deck.length;
        if (X.coin) return { ok: true };
        if (P.hand.length >= handMax(P)) return { ok: false, why: 'Hand is full' };
        return cards ? { ok: true } : { ok: false, why: 'No cards left' };
      }
      default:
        return { ok: true };
    }
  }

  function protoSpace(T, k) {
    const p = T.p;
    const P = state.players[p];
    const X = PROTO_SPACES[k];
    if (!X || !protoSpaceStatus(p, k).ok) return;
    ui.space = k;
    const n = protoSpaceAmount(k);
    switch (X.type) {
      case 'coins':
        P.coins += n;
        logMsg(`${pn(p)} took 🪙${n}.`);
        completeAction();
        break;
      case 'gem':
        P.coins -= gemCost(X);
        P.diamonds++;
        logMsg(`${pn(p)} bought a 💎 diamond for 🪙${gemCost(X)}.`);
        completeAction();
        break;
      case 'forage':
        completeAction([{ t: 'foodChoice', p, amount: n, title: `Forage: take ${n} food` }]);
        break;
      case 'fences':
        completeAction([{ t: 'drawFences', p, count: n, title: `Fences: draw in ${n} fences` }]);
        break;
      case 'buy':
      case 'breed':
        ui.mode = 'play';
        render();
        break;
      case 'build':
        ui.mode = 'shop';
        render();
        break;
      case 'scout': {
        const notes = [];
        if (X.coin) { P.coins += X.coin; notes.push(`took 🪙${X.coin}`); }
        if (X.first) { state.nextFirst = p; notes.push('will go first next round'); }
        if (notes.length) logMsg(`${pn(p)} scouted: ${notes.join(', ')}.`);
        const nc = scoutCards(X);
        const draws = Array.from({ length: nc }, (_, i) => ({ t: 'drawCard', p, source: 'any', title: `Scout: reserve a card${nc > 1 ? ` (${i + 1} of ${nc})` : ''}` }));
        completeAction(draws);
        break;
      }
      default:
        break;
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
    if (!el || (state && state.sim && state.sim.speed !== 'watch')) {
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
    if (!root || (state && state.sim && state.sim.speed !== 'watch')) return;
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

  // ---------------------------------------------------------------- winner reveal
  const REVEAL_ROWS = [
    ['🦖 Dino points', 'dinoPts'], ['🦎 Compy adjacency', 'compy'], ['🦕 Pachy coins', 'pachy'],
    ['🦖 Microraptor enclosures', 'micro'], ['🌿 Triceratops plants', 'tri'], ['💎 Diamonds (×3)', 'diamonds'],
  ];
  const REVEAL_SEEN_KEY = 'dinoRevealSeen';
  let reveal = null;

  function firstReveal(id) {
    try {
      const seen = JSON.parse(localStorage.getItem(REVEAL_SEEN_KEY) || '[]');
      if (seen.includes(id)) return false;
      localStorage.setItem(REVEAL_SEEN_KEY, JSON.stringify([id, ...seen].slice(0, 40)));
    } catch {
      /* storage blocked */
    }
    return true;
  }

  function revealVerdict(s, w) {
    const P = state.players;
    if (w === null) return { head: '🤝 It’s a tie!', sub: `Both parks scored ${s[0].total} points.` };
    const margin = Math.abs(s[0].total - s[1].total);
    const name = esc(P[w].name);
    let head = `${name} wins!`;
    if (online) head = w === online.me ? 'You win!' : `${name} wins!`;
    else if (state.ai != null && w === state.ai) head = 'The Computer wins!';
    const sub = margin === 1 ? 'By a single point — what a finish!'
      : margin <= 5 ? `A nail-biter — by ${margin} points!`
        : margin >= 25 ? `A total stampede — by ${margin} points!`
          : `By ${margin} points.`;
    return { head: `🏆 ${head}`, sub };
  }

  function closeReveal() {
    if (!reveal) return;
    reveal.timers.forEach(clearTimeout);
    document.removeEventListener('keydown', reveal.onKey);
    reveal.el.remove();
    reveal = null;
  }

  function revealWinner() {
    closeReveal();
    const s = [scorePlayer(0), scorePlayer(1)];
    const tot = [s[0].total, s[1].total];
    const w = tot[0] === tot[1] ? null : tot[0] > tot[1] ? 0 : 1;
    const verdict = revealVerdict(s, w);
    const rows = scoreRows().filter(([, k]) => k === 'dinoPts' || s[0][k] || s[1][k]);
    const side = (p) => `<div class="rv-side pl-${state.players[p].color}">
        <span class="rv-crown">👑</span>
        <img class="rv-mascot" src="${IMG}${MASCOT[p]}.webp" alt="">
        <b class="rv-name">${esc(state.players[p].name)}</b>
        <span class="rv-total">?</span>
      </div>`;
    const el = document.createElement('div');
    el.className = 'reveal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Final results');
    el.innerHTML = tokify(`<div class="rv-bg"><div class="rv-rays"></div></div>
      <div class="rv-stage">
        <div class="rv-title">🏁 The results are in</div>
        <div class="rv-duel">${side(0)}<div class="rv-vs">VS</div>${side(1)}</div>
        <div class="rv-verdict" aria-live="polite"></div>
        <div class="rv-sub">${verdict.sub}</div>
        <div class="rv-rows">${rows.map(([label, k]) => `<div class="rv-row">
          <span class="${s[0][k] > s[1][k] ? 'lead' : ''}">${s[0][k]}</span><small>${label}</small><span class="${s[1][k] > s[0][k] ? 'lead' : ''}">${s[1][k]}</span>
        </div>`).join('')}</div>
        <div class="rv-actions"><button class="btn big" data-rv="close">🏞️ See the final park</button></div>
      </div>
      <button class="rv-skip" data-rv="skip">Skip ▸</button>`);
    document.body.appendChild(el);

    const q = (sel) => [...el.querySelectorAll(sel)];
    const totals = q('.rv-total');
    const sides = q('.rv-side');
    const verdictEl = el.querySelector('.rv-verdict');
    const R = { el, timers: [], announced: false, decided: false };
    reveal = R;
    const at = (ms, fn) => R.timers.push(setTimeout(fn, ms));

    const announce = () => {
      if (R.announced) return;
      R.announced = true;
      sides.forEach((x, i) => x.classList.add(w === null ? 'tie' : i === w ? 'win' : 'lose'));
      el.classList.remove('suspense');
      el.classList.add('announced');
      verdictEl.innerHTML = tokify(`<div class="rv-head">${verdict.head}</div>`);
      totals.forEach((t, i) => { t.textContent = tot[i]; t.classList.add('done'); });
      if (!reduceMotion.matches) confetti();
    };

    const finish = () => {
      if (R.decided) return;
      R.decided = true;
      R.timers.forEach(clearTimeout);
      announce();
      q('.rv-row').forEach((r) => r.classList.add('in'));
      el.classList.add('decided');
      const btn = el.querySelector('[data-rv="close"]');
      if (btn) btn.focus();
    };

    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rv]');
      if (b && b.dataset.rv === 'close') closeReveal();
      else if (!R.decided) finish();
    });
    R.onKey = (e) => {
      if (e.key !== 'Escape' && e.key !== 'Enter' && e.key !== ' ') return;
      if (e.key !== 'Escape' && e.target.closest && e.target.closest('[data-rv="close"]')) return;
      e.preventDefault();
      if (R.decided) closeReveal();
      else finish();
    };
    document.addEventListener('keydown', R.onKey);

    if (reduceMotion.matches) {
      finish();
      return;
    }
    const DRUM = 1400;
    const ANNOUNCE = DRUM + 2200;
    const ROW_START = ANNOUNCE + 1900;
    const ROW_GAP = 600;
    at(DRUM, () => {
      el.classList.add('suspense');
      verdictEl.innerHTML = '<div class="rv-drum">And the winner is<i>.</i><i>.</i><i>.</i></div>';
    });
    at(ANNOUNCE, announce);
    q('.rv-row').forEach((r, i) => at(ROW_START + i * ROW_GAP, () => r.classList.add('in')));
    at(ROW_START + rows.length * ROW_GAP + 400, finish);
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
    if (!T || state.sim) return;
    let key = null;
    let html = '';
    if (T.t === 'roundStart' && state.proto) {
      if (lastTurnKey === `r${state.round}` || !animOn) return;
      lastTurnKey = `r${state.round}`;
      revealEvent();
      return;
    }
    if (T.t === 'roundStart') {
      key = `r${state.round}`;
      html = `<div class="to-card to-round"><small>Round</small><b>${state.round}</b><span>of ${rounds()}</span></div>`;
    } else if (T.p !== undefined && ['gainFood', 'feed', 'produce', 'actions'].includes(T.t)) {
      key = `p${T.p}:${state.round}:${T.k}:${T.bonus ? 1 : 0}`;
      const P = state.players[T.p];
      const phase = phaseInfo(state.phaseOrder[T.k]);
      const who = online && T.p === online.me ? 'Your turn!' : `${esc(P.name)}’s turn`;
      html = `<div class="to-card pl-${P.color}"><img src="${IMG}${MASCOT[T.p]}.webp" alt=""><div><small>Round ${state.round} · ${phase.icon} ${phase.short}${T.bonus ? ' · bonus' : ''}</small><b>${who}</b></div></div>`;
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
    const S = spec(sp);
    return `<div class="dcard t-${S.type} ${o.cls || ''}" ${o.attrs || ''} title="${esc(S.name)}">
      ${o.tag ? `<span class="dc-tag">${o.tag}</span>` : ''}
      <div class="dc-head"><div class="dc-name ${S.name.length > 11 && S.name.length <= 15 ? 'long' : ''}">${esc(S.name.length > 15 ? spName(sp) : S.name)}</div><div class="dc-pts" title="Points">${S.pts}</div></div>
      <div class="dc-art" style="--sc:${S.color}"><img src="${IMG}${sp}.webp" alt="" draggable="false">${o.lock ? `<span class="dc-lock">🔒 ${o.lock}</span>` : ''}</div>
      <div class="dc-price"><small>${o.costLabel || 'Cost'}</small><b>${costText(o.cost || cardCost(sp))}</b></div>
      <div class="dc-facts">${statBox('space', `⬛${S.space}`, 'Squares it takes up')}${statBox('eats', foodText(S.food).replace(' ', ''), 'Food it eats every Feeding')}${statBox('earns', `🪙${S.prod}`, 'Coins it adds in Production')}</div>
      <div class="dc-ab"><span class="dc-type">${typeLabel(S)}</span>${esc(S.ability)}</div>
      ${o.foot || ''}
    </div>`;
  }

  function miniCard(sp, attrs, cls, from) {
    if (!sp) return '<div class="mini empty">empty</div>';
    const S = spec(sp);
    const title = `${S.name} · ${typeLabel(S)}: ${S.ability}`;
    const view = `data-act="viewCard" data-sp="${sp}" data-from="${from}"`;
    return `<div class="mini t-${S.type} ${attrs ? 'pick' : 'view'} ${cls || ''}" ${attrs || view} title="${esc(title)}">
      <div class="ma" style="--sc:${S.color}"><img src="${IMG}${sp}.webp" alt="" draggable="false"><span class="mp">${S.pts}</span></div>
      <div class="mn">${esc(spName(sp))}</div>
      <div class="ms">${costText(cardCost(sp))}</div>
      ${attrs ? `<button class="m-info" ${view} aria-label="See what ${esc(S.name)} does">i</button>` : ''}
    </div>`;
  }

  function openMarketCard(sp, from) {
    const S = spec(sp);
    const T = cur();
    const mine = T && !theirTurn(T);
    const canTake = mine && state.faceUp[from] === sp && ((T.t === 'actions' && ui.mode === 'draw') || (T.t === 'drawCard' && T.source === 'any'));
    const viewer = online ? online.me : state.aiCfg ? 0 : T && T.p != null ? T.p : 0;
    const owned = state.players[viewer] && state.players[viewer].book.includes(sp);
    const facts = [
      `<li>Costs <b>${costText(cardCost(sp))}</b> to play and fills <b>${plural(S.space, 'square')}</b> in one enclosure.</li>`,
      `<li>Eats <b>${foodText(S.food)}</b> every Feeding.</li>`,
      state.proto ? `<li>Adds <b>🪙${S.prod}</b> to its enclosure when you collect from it in Production.</li>` : `<li>Adds <b>🪙${S.prod}</b> when its enclosure is picked in Production.</li>`,
      `<li>Worth <b>${plural(S.pts, 'point')}</b> at the end if its enclosure is active.</li>`,
      S.type === 'none'
        ? `<li>${TYPE_HELP.none}</li>`
        : `<li><b>${typeLabel(S)}:</b> ${esc(S.ability)} <span class="muted">${typeHelp(S)}</span></li>`,
    ];
    if (owned) facts.push(`<li class="muted">${online || state.aiCfg ? 'You already have' : `${esc(state.players[viewer].name)} already has`} this dino in ${online || state.aiCfg ? 'your' : 'their'} book.</li>`);
    openModal(`<div class="modal-head"><h2>🃏 ${esc(S.name)}</h2><button class="x" data-act="closeModal" aria-label="Close">✕</button></div>
      <div class="piece-info">${cardHtml(sp, { cls: 'solo' })}<div><ul class="facts">${facts.join('')}</ul>
      ${canTake ? `<button class="btn" data-act="take" data-from="${from}">🃏 ${state.proto ? 'Reserve' : 'Draw'} this card</button>` : ''}</div></div>`, 'medium');
  }

  // ---------------------------------------------------------------- rendering: board
  function pieceName(it) {
    if (it.kind === 'dino') return `${it.dead ? 'Fossil of ' : it.stage === 'baby' ? 'Baby ' : ''}${SPECIES[it.species].name}${!it.dead && it.stage === 'egg' ? ' egg' : ''}`;
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
      const S = spec(it.species);
      card = cardHtml(it.species, { cls: 'solo' });
      if (!it.dead && it.stage === 'egg') {
        facts.push('<li>🥚 <b>Egg.</b> It hatches into a baby at the start of next round. Until then it eats nothing, earns nothing and scores nothing.</li>');
      } else if (!it.dead && it.stage === 'baby') {
        facts.push(`<li>🍼 <b>Baby.</b> Eats <b>${dinoFood(it) + (cp.inactive || 0)} ${foodText({ t: S.food.t, n: '' }).trim()}</b>, adds <b>🪙${dinoProd(it)}</b> and is worth <b>${plural(dinoPoints(it), 'point')}</b> (half an adult). No when-played or every-round power; scoring powers count half.</li>`);
        facts.push(`<li>Grows up after being fed in <b>${PROTO_BABY_FEEDS} Feedings</b> (${it.fed || 0} so far). It then needs ${S.space} squares in this enclosure — if there’s no room, it dies.</li>`);
      } else if (!it.dead) {
        const eats = S.food.n + (cp.inactive || 0);
        const why = cp.inactive ? ` <span class="muted">(card says ${S.food.n}; +${cp.inactive} because it’s inactive)</span>` : '';
        facts.push(`<li>Eats <b>${eats} ${foodText({ t: S.food.t, n: '' }).trim()}</b> each Feeding${why}.</li>`);
        if (cp.feederSquares) facts.push(`<li>The feeder here takes <b>${cp.feederSquares} food</b> off the whole enclosure’s bill.</li>`);
        facts.push(`<li>Adds <b>🪙${S.prod}</b> ${state.proto ? `when you collect from ${encl.replace('Enclosure', 'enclosure')} in Production (whole enclosure makes 🪙${cp.prod})` : `when you pick ${encl.replace('Enclosure', 'enclosure')} in Production (whole enclosure makes 🪙${cp.prod})`}.</li>`);
        facts.push(`<li>Worth <b>${S.pts} point${S.pts === 1 ? '' : 's'}</b> at the end if active.</li>`);
        facts.push(`<li><b>${typeLabel(S)}:</b> ${typeHelp(S)}</li>`);
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
      if (it.kind === 'dino') col = it.dead ? '#9a9489' : it.stage === 'egg' ? '#efe2bf' : SPECIES[it.species].color;
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
      if (it.kind === 'dino' && !it.dead && it.stage === 'egg') {
        const dot = SPECIES[it.species].color;
        g.push(`<ellipse cx="${spot.x}" cy="${spot.y + 1}" rx="${R * 0.62}" ry="${R * 0.82}" fill="#fff8e6" stroke="#a5813f" stroke-width="1.6"/>`);
        g.push(`<circle cx="${spot.x - R * 0.2}" cy="${spot.y - R * 0.18}" r="${R * 0.14}" fill="${dot}"/><circle cx="${spot.x + R * 0.22}" cy="${spot.y + R * 0.28}" r="${R * 0.11}" fill="${dot}"/><circle cx="${spot.x + R * 0.12}" cy="${spot.y - R * 0.45}" r="${R * 0.08}" fill="${dot}"/>`);
      } else if (it.kind === 'dino' && !it.dead) {
        const r = it.stage === 'baby' ? R * 0.72 : R;
        g.push(`<circle cx="${spot.x}" cy="${spot.y}" r="${r + 2.5}" fill="#fffaf0" stroke="${it.stage === 'baby' ? '#d9a441' : 'rgba(0,0,0,.35)'}" stroke-width="${it.stage === 'baby' ? 2 : 1}"${it.stage === 'baby' ? ' stroke-dasharray="3 2"' : ''}/>`);
        g.push(`<image href="${IMG}${it.species}.webp" x="${spot.x - r}" y="${spot.y - r}" width="${2 * r}" height="${2 * r}" clip-path="url(#rc${p})" preserveAspectRatio="xMidYMid slice"/>`);
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
    if (!sessionId() || authFailed) {
      renderGate(app);
      return;
    }
    if (!state && pastLoading) {
      app.innerHTML = '<div class="setup gate"><div class="setup-card"><h2>🏆 Opening that game…</h2><p class="muted">Loading the final boards from your history.</p></div></div>';
      return;
    }
    if (!state) {
      renderSetup(app);
      animOn = true;
      return;
    }
    if (state.sim && state.sim.speed === 'turbo' && document.getElementById('game-shell')) {
      const T0 = cur();
      const now = performance.now();
      if (T0 && T0.t !== 'gameOver' && now - simPaintAt < SIM_PAINT_MS) {
        pendingCard = null;
        aiSchedule();
        return;
      }
      simPaintAt = now;
    }
    if (!document.getElementById('game-shell')) {
      app.innerHTML = tokify(`<div id="game-shell">
        <header class="topbar" id="top"></header>
        <main class="layout"><div class="main-col"><section class="boards" id="boards"></section><section class="big-market" id="bigmarket"></section></div><aside class="panel" id="panel"></aside></main>
        <footer class="legend"><details><summary>🗺️ Board key <span>· tap any dino to see its card</span></summary><div class="lg">${legendHtml()}</div></details></footer>
      </div>`);
    }
    renderTop();
    renderBoards();
    renderPanel();
    renderBigMarket();
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
    if (!state.sim && focusP !== null && lastFocus !== null && focusP !== lastFocus && boardsStacked()) {
      const el = document.querySelector(`[data-player="${focusP}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    lastFocus = focusP;
    if (T && T.t === 'gameOver' && !state.celebrated) {
      state.celebrated = true;
      save();
      if (!state.sim && (!online || firstReveal(online.id))) revealWinner();
      recordLocalGame();
    }
    aiSchedule();
  }

  function boardsStacked() {
    const els = document.querySelectorAll('#boards [data-player]');
    return els.length === 2 && els[1].offsetTop > els[0].offsetTop + 20;
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
    ].concat(state && state.proto ? [
      `<span>🍼 Baby (small token, grows up after ${PROTO_BABY_FEEDS} Feedings)</span>`,
    ] : []).join('');
  }

  function renderTop() {
    const el = document.getElementById('top');
    const T = cur();
    const k = T && T.k !== undefined ? T.k : -1;
    const over = T && T.t === 'gameOver';
    let pips = '';
    for (let r = 1; r <= rounds(); r++) {
      const cls = over || r < state.round ? 'done' : r === state.round ? 'cur' : '';
      pips += `<span class="pip ${cls}">${r}</span>`;
    }
    const phases = over
      ? ''
      : state.phaseOrder
        .map((ph, i) => {
          const cls = T && T.t === 'roundStart' ? '' : i < k ? 'done' : i === k ? 'cur' : '';
          return `<div class="pcard ph-${ph} ${cls}"><span class="pc-n">${i + 1}</span><span class="pc-i">${phaseInfo(ph).icon}</span><span class="pc-t">${phaseInfo(ph).short}</span></div>`;
        })
        .join('');
    const E = state.proto && !over && PROTO_EVENTS[state.event];
    const evChip = E ? `<div class="pcard ev-chip" title="${esc(E.desc)}"><span class="pc-i">${E.icon}</span><span class="pc-t">${E.name}</span></div>` : '';
    const fresh = T && T.t === 'roundStart' ? ' fresh' : '';
    setHtml(el, `
      <div class="brand"><img class="brand-logo" src="${IMG}trex.webp" alt=""><div><h1>Dino Board Game</h1><small>Build the best dino park in ${rounds()} rounds</small></div></div>
      <div class="top-mid">
        <div class="tracker"><span class="tracker-label">Round</span>${pips}</div>
        <div class="phase-row${fresh}" data-round="${state.round}">${evChip}${phases}</div>
      </div>
      <div class="top-actions">
        ${state.past ? '' : '<button class="btn sm ghost log-btn" data-act="fullLog" title="What happened" aria-label="What happened">🗒️<span class="lb-t"> What happened</span></button>'}
        ${state.aiCfg && !online && !state.past ? `<button class="btn sm ghost" data-act="aiSettings" title="Computer settings">🤖 ${AI_LEVELS[state.aiCfg.level]} · ${AI_PACES[state.aiCfg.pace]}</button>` : ''}
        ${!online && !state.sim && !state.past && isAdmin() ? '<button class="btn sm ghost" data-act="simOpen" title="Computer vs computer (admin)" aria-label="Computer vs computer (admin)">🧪</button>' : ''}
        ${state.sim ? `<button class="btn sm ghost" data-act="simSpeed" title="Change simulation speed">${SIM_SPEEDS[state.sim.speed].icon} ${SIM_SPEEDS[state.sim.speed].name}</button>` : `${state.goals ? '<button class="btn sm ghost" data-act="goals" title="Goal cards">🎯 Goals</button>' : ''}<button class="btn sm ghost" data-act="rules">📜 Rules</button>`}
        ${online
    ? `<button class="btn sm ghost" data-act="onlineLeave">🏠 My games</button>${online.status === 'active' ? '<button class="btn sm ghost" data-act="onlineResign">🏳️ Resign</button>' : ''}`
    : state.sim ? '<button class="btn sm ghost" data-act="simStop">⏹ Exit simulation</button>'
      : state.past ? '<a class="btn sm ghost" href="/dino-history.html">🏆 Back to history</a>' : '<button class="btn sm ghost" data-act="newGame">🥚 New game</button>'}
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
    el.classList.toggle('watching', theirTurn(T));
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
            ${bonus ? chip('⏩', bonus, state.proto ? 'Gigantoraptor: extra worker next round' : 'Gigantoraptor: do a phase twice next round') : ''}
          </div>
          <div class="board-wrap">${boardSvg(p)}</div>
          <div class="p-foot">
            <button class="btn sm ghost book-btn" data-act="book" data-p="${p}">${state.proto ? `✋ Reserved · ${P.hand.length}/${handMax(P)}` : `<span class="book-ic"></span>Dino book · ${P.book.length}`}</button>
            ${P.blocked.length ? `<span class="blocked">🚫 Blocked: ${P.blocked.map((sp) => esc(spName(sp)) + (state.proto && P.blockEnd && P.blockEnd[sp] ? ` (through round ${P.blockEnd[sp]})` : '')).join(', ')}</span>` : ''}
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
    const ended = online && online.status !== 'active' && !(T && T.t === 'gameOver');
    const body = ended ? onlineEndHtml() : theirTurn(T) ? watchHtml(T) : taskHtml(T);
    const changed = setHtml(el, `${bannerHtml(T)}<div class="panel-scroll"><div class="task">${body}</div></div>${marketHtml(T)}`);
    const ns = el.querySelector('.panel-scroll');
    if (changed && ns && ui.keepScroll) ns.scrollTop = top;
    ui.keepScroll = false;
  }

  // The computer's turn, or the other online player's turn: you can watch but not act.
  function theirTurn(T) {
    if (!T || T.t === 'gameOver') return false;
    return isAiTask(T) || (!!online && online.status === 'active' && onlineBlocked());
  }

  function watchHtml(T) {
    const who = online ? onlineOwner() : state.sim ? (T.p != null ? T.p : state.first) : state.ai;
    const P = state.players[who];
    if (state.proto && T.t === 'actions' && T.work && !ui.mode) {
      return `<div class="watch-mini pl-${P.color}">${meeple(P.color, 'mini')} <b>${esc(P.name)}</b> · ${esc(online ? 'Placing a worker' : ui.aiNote || 'Thinking')}<i class="dots3"><b></b><b></b><b></b></i></div>${eventNote()}${protoBoardHtml(T, false)}`;
    }
    const phase = T.k !== undefined ? phaseInfo(state.phaseOrder[T.k]) : null;
    const step = T.t === 'roundStart' ? 'Starting the round' : T.t === 'roll' ? '🎲 Rolling the die' : phase ? `${phase.icon} ${phase.name}${T.bonus ? ' · bonus turn' : ''}` : '';
    const dots = '<i class="dots3"><b></b><b></b><b></b></i>';
    if (online && online.timedOut) {
      return `<div class="watch pl-${P.color}"><img src="${IMG}${MASCOT[who]}.webp" alt=""><div>
        <h3>⏰ Time’s up</h3><p class="w-step">${step}</p>
        <p class="w-doing">Finishing your turn${dots}</p>
        <p class="w-help">Remaining actions and food/fence gains are skipped; Feeding and Production happen automatically.</p></div></div>`;
    }
    const doing = online ? `Waiting for ${esc(P.name)} to move` : `🤖 ${esc(ui.aiNote || 'Thinking')}`;
    const help = online
      ? `You can’t play ${esc(P.name)}’s turn. Their moves show up on the board as they make them, and you’ll get the controls back when it’s your turn.`
      : state.sim ? `🧪 Simulation · round ${state.round} of ${rounds()}. Both players are computers; nothing here is saved.`
        : 'You can’t play the computer’s turn. Watch its moves on the board — you’ll get the controls back when it’s your turn.';
    return `<div class="watch pl-${P.color}"><img src="${IMG}${MASCOT[who]}.webp" alt=""><div>
      <h3>${state.sim ? '🤖' : '🔒'} ${esc(P.name)}’s turn</h3><p class="w-step">${step}</p>
      <p class="w-doing">${doing}${dots}</p>
      <p class="w-help">${help}</p></div></div>`;
  }

  function bannerHtml(T) {
    if (!T) return '';
    if (online && online.mode === 'quick' && online.status === 'active' && online.deadline) {
      const mine = onlineMyTurn();
      return bannerCore(T).replace(/<\/div>$/, `<div class="b-clock${mine ? ' mine' : ''}">⏱ <span id="ol-clock">${clockText()}</span></div></div>`);
    }
    return bannerCore(T);
  }

  function bannerCore(T) {
    if (T.t === 'gameOver') return `<div class="banner"><div class="b-who">🏁 Final scores</div><div class="b-phase">${rounds()} rounds complete</div></div>`;
    if (T.p === undefined) {
      return `<div class="banner"><div class="b-who">Round ${state.round} of ${rounds()}</div><div class="b-phase">${T.t === 'roll' ? '🎲 Gain Food / Draw Fences' : 'Shuffle the phase cards'}</div></div>`;
    }
    const P = state.players[T.p];
    const phase = T.k !== undefined ? phaseInfo(state.phaseOrder[T.k]) : null;
    return `<div class="banner b-${P.color}"><div class="b-who">${esc(P.name)}’s turn</div><div class="b-phase">Round ${state.round} · ${phase ? `${phase.icon} ${phase.name}` : ''}${T.bonus ? ' · ⏩ bonus turn' : ''}</div></div>`;
  }

  function marketHtml(T) {
    const mine = T && !theirTurn(T);
    const pickAny = mine && ((T.t === 'actions' && ui.mode === 'draw') || (T.t === 'drawCard' && T.source === 'any'));
    const pickDeck = mine && (pickAny || (T.t === 'drawCard' && T.source === 'deck'));
    const deckAttrs = pickDeck && state.deck.length ? 'data-act="take" data-from="deck"' : '';
    const faceUp = (state.proto ? [...Array(PROTO_MARKET).keys()] : [0, 1])
      .map((i) => {
        const sp = state.faceUp[i];
        const deal = sp && isFresh(`m${i}:${sp}:${state.deck.length}`, 900) ? 'deal' : '';
        return miniCard(sp, pickAny && sp ? `data-act="take" data-from="${i}"` : '', deal, i);
      })
      .join('');
    const stack = Math.min(state.deck.length, 4);
    return `<div class="market${pickAny || pickDeck ? ' picking' : ''}${state.proto ? ' proto' : ''}">
      <div class="m-title">🃏 ${state.proto ? 'Dino market' : 'Card market'}${pickAny || pickDeck ? ` <span class="m-hint">tap one to ${state.proto ? 'reserve' : 'draw'}</span>` : ''}</div>
      <div class="m-row">
        <div class="deck-back ${deckAttrs ? 'pick' : ''} ${state.deck.length ? '' : 'gone'}" ${deckAttrs} title="Top of the deck (face down)" style="--stack:${stack}">
          <b>${state.deck.length}</b><small>deck</small>
        </div>
        ${faceUp}
      </div>
    </div>`;
  }

  // Prototype games buy straight from a shared market, so it gets full-size cards under the parks.
  function renderBigMarket() {
    const el = document.getElementById('bigmarket');
    if (!el) return;
    const T = cur();
    if (!state.proto || !T || T.t === 'gameOver') {
      setHtml(el, '');
      return;
    }
    const mine = !theirTurn(T);
    const picking = mine && ((T.t === 'actions' && ui.mode === 'draw') || (T.t === 'drawCard' && T.source === 'any'));
    const deckOk = mine && state.deck.length > 0 && (picking || (T.t === 'drawCard' && T.source === 'deck'));
    const buying = mine && !ui.species && ((T.t === 'actions' && ui.mode === 'play') || T.t === 'freePlay');
    const breeding = buying && T.t === 'actions' && protoBreeding();
    const opts = buying ? protoPickOptions(T.p, T) : [];
    const card = (sp, src, i) => {
      let attrs = `data-act="viewCard" data-sp="${sp}" data-from="${src === 'm' ? i : -1}"`;
      let cls = 'view';
      let lock = '';
      const o = opts.find((x) => x.src === src && x.i === i);
      if (picking && src === 'm') {
        attrs = `data-act="take" data-from="${i}"`;
        cls = 'pick';
      } else if (buying && o && o.ok) {
        attrs = `data-act="pickSpecies" data-sp="${sp}" data-src="${src}" data-i="${i}"`;
        cls = 'pick';
      } else if (buying) {
        cls = 'view nope';
        lock = o ? o.why : breeding ? 'Breed from your park' : 'Market cards only';
      }
      const deal = src === 'm' && isFresh(`bm${i}:${sp}:${state.deck.length}`, 900) ? ' deal' : '';
      const where = src === 'h' ? ' held' : src === 'b' ? ' bred' : ' shop';
      return cardHtml(sp, { cls: cls + deal + where, attrs, lock, cost: src === 'b' ? breedCost(sp) : src === 'h' ? playCost(sp, 'h') : null, costLabel: src === 'b' ? 'Baby' : '', tag: src === 'h' ? '✋ Reserved' : src === 'b' ? `🐣 Baby · ⬛${babySize(sp)}` : '' });
    };
    const hint = picking ? 'Tap a card or the deck to reserve it'
      : breeding ? `Tap a 🥚 dino, then place its baby in the enclosure with the pair (half its coins${spaceExtra() ? ` +🪙${spaceExtra()}` : ''}, 💎1 less)`
      : buying ? `Tap a dino to buy it, then place it in your park${T.t !== 'freePlay' && spaceExtra() ? ` (costs 🪙${spaceExtra()} extra on this space)` : ''}`
        : 'Tap any card for details. Buy with a 🦖 Play a dino worker, or 🥚 Breed dinos you already have.';
    const viewer = buying || picking ? T.p : state.ai != null ? other(state.ai) : T.p != null ? T.p : state.first;
    const P = state.players[viewer];
    const hand = P.hand.length
      ? `<div class="bm-hand pl-${P.color}"><div class="bm-sub">✋ ${esc(P.name)}’s hand <small>reserved cards only ${esc(P.name)} can buy · ${P.hand.length}/${handMax(P)}</small></div><div class="bm-row">${P.hand.map((sp, i) => card(sp, 'h', i)).join('')}</div></div>`
      : '';
    const stack = Math.min(state.deck.length, 4);
    setHtml(el, `<div class="bm-head"><h2>🃏 Dino market</h2><span class="bm-hint${picking || buying ? ' live' : ''}">${hint}</span></div>
      ${goalStripHtml()}
      <div class="bm-sub bm-shop-sub">🏪 Market <small>face-up cards anyone can buy</small></div>
      <div class="bm-row">
        <div class="deck-back bm-deck ${deckOk ? 'pick' : ''} ${state.deck.length ? '' : 'gone'}" ${deckOk ? 'data-act="take" data-from="deck"' : ''} title="Top of the deck (face down)" style="--stack:${stack}"><b>${state.deck.length}</b><small>deck</small></div>
        ${state.faceUp.map((sp, i) => card(sp, 'm', i)).join('')}
      </div>${breeding ? `<div class="bm-hand bm-breed pl-${P.color}"><div class="bm-sub">🥚 Breed <small>species with an adult pair in one of ${esc(P.name)}’s enclosures · babies take half the squares · half the coins${spaceExtra() ? ` +🪙${spaceExtra()}` : ''}, 💎1 less</small></div><div class="bm-row">${opts.map((o) => card(o.sp, 'b', o.i)).join('')}</div></div>` : ''}${hand}`);
  }

  function logItems(list) {
    return list.slice().reverse().map((l) => `<li><span class="lr">R${l.r}</span>${l.m}</li>`).join('');
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
      case 'power': return powerHtml(T);
      case 'grow': return growHtml(T);
      case 'gameOver': return gameOverHtml();
      default: return `<p>Unknown step: ${esc(T.t)}</p>`;
    }
  }

  function roundStartHtml() {
    const list = state.phaseOrder
      .map((ph, i) => `<li><span class="po-n">${i + 1}</span><span class="po-i">${phaseInfo(ph).icon}</span><span class="po-t"><b>${phaseInfo(ph).name}</b><small>${phaseInfo(ph).desc}</small></span></li>`)
      .join('');
    if (state.proto) return protoRoundStartHtml(list);
    let ready = true;
    const T = cur();
    const bonus = state.players
      .map((P, p) => {
        if (!P.bonusPending) return '';
        const picks = ui.picks[p] || [];
        if (online && p !== online.me) {
          const done = ((T.picks || {})[p] || []).length >= P.bonusPending;
          return `<div class="bonus-pick">⏩ ${pn(p)}’s Gigantoraptor: ${done ? 'bonus chosen ✅' : `${pn(p)} picks ${plural(P.bonusPending, 'phase')} to do twice.`}</div>`;
        }
        if (picks.length < P.bonusPending) ready = false;
        if (p === state.ai) {
          const names = [...new Set(picks)].map((ph) => `<b>${PHASES[ph].short}</b>${picks.filter((x) => x === ph).length > 1 ? ' ×' + picks.filter((x) => x === ph).length : ''}`);
          return `<div class="bonus-pick">⏩ ${pn(p)}’s Gigantoraptor: the computer will do ${names.join(' and ') || '<b>Actions</b>'} twice this round.</div>`;
        }
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
    return `<h2>Round ${state.round} of ${rounds()}</h2>
      <p>${pn(state.first)} goes first this round. Here’s the order:</p>
      <ol class="phase-order">${list}</ol>
      ${bonus}
      ${online && !onlineMyTurn() ? '' : `<button class="btn big" data-act="startRound" ${ready ? '' : 'disabled'}>${onlineLockIn() ? 'Lock in bonus ▶' : 'Start round ▶'}</button>`}`;
  }

  function protoRoundStartHtml(list) {
    const extra = state.players.filter((P) => P.bonusPending).map((P) => `${esc(P.name)} has ${PROTO_WORKERS + P.bonusPending} workers this round (Gigantoraptor).`).join(' ');
    return `<h2>Round ${state.round} of ${rounds()}</h2>
      ${eventCardHtml()}
      <p>${pn(state.first)} goes first this round.${extra ? ` ${extra}` : ''}</p>
      ${protoNewGoal() ? `<div class="ev-card goal"><span class="evc-ic">${protoNewGoal().icon}</span><div><small>New goal revealed</small><b>${protoNewGoal().name}</b><p>${protoNewGoal().desc} at the end of the game.</p></div></div>` : ''}
      <ol class="phase-order">${list}</ol>
      ${online && !onlineMyTurn() ? '' : '<button class="btn big" data-act="startRound">Start round ▶</button>'}`;
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
    let flexHtml = '';
    let paying = '<span class="muted">nothing</span>';
    if (tot.total && canPayFood(P, tot)) {
      const fm = flexMeatPick(P, tot, ui.flexMeat);
      const [lo, hi] = flexMeatRange(P, tot);
      const pm = tot.meat + fm;
      const pp = tot.plant + tot.flex - fm;
      paying = [pm ? `<span class="fc meat">🍖${pm}</span>` : '', pp ? `<span class="fc plant">🌿${pp}</span>` : ''].join('');
      if (tot.flex && hi > lo) {
        const who = [...new Set(list.filter((cp) => ui.feed.has(cp.key)).flatMap((cp) => cp.living.filter((d) => SPECIES[d.species].food.t === 'flex').map((d) => spName(d.species))))].join(', ');
        flexHtml = `<div class="flex-pick"><p><b>${who}</b> can eat meat or plants (${tot.flex} food). Choose what to pay with:</p>
          ${stepper('flex', '🍖 Meat', fm, fm > lo, fm < hi)}
          <div class="stepper"><span class="st-l">🌿 Plants</span><b>${tot.flex - fm}</b></div></div>`;
      }
    }
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
      ${flexHtml}
      <div class="pay-line">Paying: ${paying}</div>
      ${warns.length ? `<div class="warn-box">${warns.join('')}</div>` : ''}
      <button class="btn big" data-act="confirmFeed">Feed &amp; continue</button>`;
  }

  function produceHtml(T) {
    const list = produceChoices(T);
    const best = Math.max(...list.map((cp) => cp.prod));
    const again = !!(T.got && T.got.length);
    let lead = 'Pick <b>one active enclosure</b> and collect its coins.';
    if (state.proto && state.event === 'goldrush') lead = `💰 Gold rush: collect from <b>${again ? `up to ${plural(PROTO_GOLDRUSH - T.got.length, 'more active enclosure')}` : `${PROTO_GOLDRUSH} active enclosures`}</b>.`;
    if (state.proto) lead += ' Dino powers in every active enclosure trigger afterwards.';
    const rows = list
      .map((cp) => `<button class="opt" data-act="produce" data-key="${cp.key}">
        <span class="ebadge">${cp.name}</span>
        <span class="o-t"><b>${dinoSummary(cp)}</b></span>
        <span class="fc flex" style="font-size:1rem">🪙 +${cp.prod}${cp.prod === best && list.length > 1 ? ' ⭐' : ''}</span></button>`)
      .join('');
    return `<h3>🪙 Production</h3><p>${lead}</p><div class="opt-list">${rows}</div>`;
  }

  function eventCardHtml() {
    const E = PROTO_EVENTS[state.event];
    return E ? `<div class="ev-card"><span class="evc-ic">${E.icon}</span><div><small>Round ${state.round} event</small><b>${E.name}</b><p>${E.desc}</p></div></div>` : '';
  }

  // Flips this round's event card (and a newly revealed goal card) face up in the middle of the screen.
  // Tap anywhere to dismiss each one.
  function revealEvent() {
    const cards = [];
    const E = PROTO_EVENTS[state.event];
    if (E) cards.push({ cls: '', back: ['🦖', 'Event'], small: `Round ${state.round} event`, icon: E.icon, name: E.name, desc: E.desc });
    const G = protoNewGoal();
    if (G) cards.push({ cls: ' goal', back: ['🎯', 'Goal'], small: `New goal · ${PROTO_GOAL_ROUNDS.indexOf(state.round) + 1} of ${PROTO_GOAL_ROUNDS.length}`, icon: G.icon, name: G.name, desc: `${G.desc} at the end of the game.` });
    revealCards(cards);
  }

  function revealCards(cards) {
    if (!cards.length) return;
    const [c, ...rest] = cards;
    document.querySelectorAll('.ev-reveal').forEach((x) => x.remove());
    const ov = document.createElement('div');
    ov.className = 'ev-reveal';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', `${c.small}: ${c.name}`);
    ov.innerHTML = tokify(`<div class="evr-card${c.cls}"><div class="evr-inner">
      <div class="evr-back"><span>${c.back[0]}</span><b>${c.back[1]}</b></div>
      <div class="evr-front"><small>${c.small}</small><span class="evr-ic">${c.icon}</span><b>${c.name}</b><p>${c.desc}</p><em>Tap to continue</em></div>
    </div></div>`);
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      ov.remove();
      revealCards(rest);
    };
    ov.addEventListener('click', close);
    document.body.appendChild(ov);
    setTimeout(close, 5000);
  }

  // Goal points each player would score if the game ended now.
  function protoGoalNow(id) {
    return state.players.map((P) => PROTO_GOALS[id].pts(protoGoalCtx(P, P.board)));
  }

  function goalCardHtml(id, i, shown) {
    if (i >= shown) {
      return `<button class="goal-card hidden" data-act="goals"><span class="gc-ic">❔</span><b>Goal ${i + 1}</b><small>Revealed at the start of round ${PROTO_GOAL_ROUNDS[i]}</small></button>`;
    }
    const G = PROTO_GOALS[id];
    const now = protoGoalNow(id);
    const pts = state.players.map((P, p) => `<span class="gc-p pl-${P.color}">${esc(P.name)} ${now[p]}</span>`).join('');
    return `<button class="goal-card" data-act="goals"><span class="gc-ic">${G.icon}</span><b>${G.name}</b><small>${G.desc}</small><span class="gc-pts">${pts}</span></button>`;
  }

  function goalStripHtml() {
    if (!state.proto || !state.goals) return '';
    const shown = protoGoalsShown();
    return `<div class="goal-strip"><div class="bm-sub">🎯 Goals <small>score at the end · ${shown} of ${state.goals.length} revealed · tap for details</small></div>
      <div class="goal-row">${state.goals.map((id, i) => goalCardHtml(id, i, shown)).join('')}</div></div>`;
  }

  function openGoals() {
    const shown = protoGoalsShown();
    const known = state.goals.map((id, i) => {
      if (i >= shown) return `<li class="gm-hidden">❔ <b>Goal ${i + 1}</b> — revealed at the start of round ${PROTO_GOAL_ROUNDS[i]}.</li>`;
      const G = PROTO_GOALS[id];
      const now = protoGoalNow(id);
      return `<li>${G.icon} <b>${G.name}</b> — ${G.desc}.<br><span class="muted">Right now: ${state.players.map((P, p) => `${esc(P.name)} ${now[p]}`).join(' · ')}</span></li>`;
    }).join('');
    const all = Object.values(PROTO_GOALS).map((G) => `<li>${G.icon} <b>${G.name}</b> — ${G.desc}</li>`).join('');
    openModal(`<div class="modal-head"><h2>🎯 Goals</h2><button class="x" data-act="closeModal" aria-label="Close">✕</button></div>
      <p class="muted">${PROTO_GOAL_ROUNDS.length} of ${Object.keys(PROTO_GOALS).length} goal cards score at the end of this game. ${protoGoalSchedule()}. Enclosures only count if they’re active and have a living dino.</p>
      <ul class="goal-list">${known}</ul>
      <details><summary>All ${Object.keys(PROTO_GOALS).length} possible goals</summary><ul class="goal-list all">${all}</ul></details>`, 'small');
  }

  function eventNote() {
    const E = state.proto && PROTO_EVENTS[state.event];
    return E ? `<div class="ev-note">${E.icon} <b>${E.name}</b> · ${E.desc}</div>` : '';
  }

  const MEEPLE_PATH = 'M16 3c2.8 0 5 2.2 5 5 0 1.7-.8 3.1-2 4l7.6 2.6c1.6.6 2.6 1.6 2.3 3-.3 1.3-1.6 1.7-3.1 1.4L21 17.6l3.4 9.6c.4 1.3-.4 2.3-1.7 2.3h-4.4L16 24.3l-2.3 5.2H9.3c-1.3 0-2.1-1-1.7-2.3l3.4-9.6-4.8 1.4c-1.5.3-2.8-.1-3.1-1.4-.3-1.4.7-2.4 2.3-3L13 12c-1.2-.9-2-2.3-2-4 0-2.8 2.2-5 5-5z';

  function meeple(color, cls) {
    return `<svg class="meeple m-${color} ${cls || ''}" viewBox="0 0 32 32" aria-hidden="true"><path d="${MEEPLE_PATH}"/></svg>`;
  }

  // Workers still to place this round (the one being placed right now counts as placed).
  function protoWorkersLeft(p, pending) {
    const n = state.queue.filter((t) => t.t === 'actions' && t.work && t.p === p && t.remaining > 0).length;
    return Math.max(0, n - (pending && cur() && cur().p === p ? 1 : 0));
  }

  // The shared worker board: each player's supply on top, the action spaces below.
  function protoBoardHtml(T, live) {
    const me = T.p;
    const pending = ui.space || ui.aiTarget || null;
    const pool = (p) => {
      const P = state.players[p];
      const n = protoWorkersLeft(p, pending);
      const ms = Array.from({ length: n }, (_, i) => meeple(P.color, live && p === me && i === 0 && !pending ? 'grab' : '')).join('');
      return `<div class="wb-pool pl-${P.color}${p === me ? ' turn' : ''}"><span class="wb-name">${esc(P.name)}</span><span class="wb-meeples">${ms || '<small>all placed</small>'}</span></div>`;
    };
    const spaces = Object.keys(PROTO_SPACES)
      .map((k) => {
        const X = PROTO_SPACES[k];
        const on = spaceWorkers(k);
        const owner = X.open ? null : on[0];
        const st = protoSpaceStatus(me, k);
        const desc = protoSpaceDesc(k);
        const placed = on.map((q, n) => meeple(state.players[q].color, `placed${isFresh(`ws:${state.round}:${k}:${n}:${q}`, 900) ? ' drop' : ''}`));
        if (pending === k) placed.push(meeple(state.players[me].color, 'placed hover'));
        const slot = placed.length ? placed.join('') : '<i class="ws-ring"></i>';
        const can = live && st.ok && !pending;
        const note = owner != null ? `${esc(state.players[owner].name)}’s worker` : pending === k ? 'Placing…' : live && !st.ok ? `🔒 ${st.why}` : desc;
        const cls = `${owner != null ? ` occ o-${state.players[owner].color}` : ''}${can ? ' open' : ''}${pending === k ? ' pend' : ''}${X.open ? ' unl' : ''}`;
        const tier = X.open ? '<span class="ws-tier">∞ any number</span>' : '';
        return `<button class="wspace${cls}" data-act="space" data-s="${k}" ${can ? '' : 'disabled'} title="${esc(desc)}">
          <span class="ws-slot${placed.length > 1 ? ' many' : ''}">${slot}</span><span class="ws-ic">${X.icon}</span><b class="ws-name">${X.name}</b><small class="ws-desc">${note}</small>${tier}</button>`;
      })
      .join('');
    return `<div class="wboard"><div class="wb-pools">${pool(0)}${pool(1)}</div><div class="wb-grid">${spaces}</div></div>`;
  }

  function protoActionsHtml(T) {
    const P = state.players[T.p];
    const total = state.workers[T.p];
    const count = `<div class="act-count">Worker ${Math.min(total - protoWorkersLeft(T.p, false) + 1, total)} of ${total}</div>`;
    const X = ui.space && PROTO_SPACES[ui.space];
    const onSpace = X ? `<div class="pend-chip">${meeple(P.color, 'mini')} Your worker is on <b>${X.icon} ${X.name}</b></div>` : '';
    const backHead = (label) => `<div class="act-top">${backBtn('back', label)}${count}</div>${onSpace}`;
    if (ui.mode === 'play') return backHead(ui.species ? 'Other dinos' : 'Pick up worker') + playModeHtml(T, false);
    if (ui.mode === 'draw') {
      return `${backHead('Pick up worker')}<h3>🔭 Scout</h3><p>Tap a card or the deck in the <b>Dino market</b> to reserve it. Hand: <b>${P.hand.length}/${handMax(P)}</b>.</p>`;
    }
    if (ui.mode === 'shop') return (ui.shopItem ? `<div class="act-top">${backBtn('shopBack', 'Builder')}${count}</div>${onSpace}` : backHead('Pick up worker')) + shopHtml(P);
    return `<div class="act-top">${count}<button class="btn sm ghost" data-act="endTurn">Pass ▸</button></div>
      ${eventNote()}
      <p class="act-help">Drag a worker from your supply onto an open space, or tap the space. Top spaces hold one worker per round; ∞ spaces take any number.</p>
      ${protoBoardHtml(T, true)}`;
  }

  function actionsHtml(T) {
    if (T.work) return protoActionsHtml(T);
    const P = state.players[T.p];
    const doneN = 2 - T.remaining;
    const dots = `<span class="dots"><i class="${doneN > 0 ? 'used' : ''}"></i><i class="${doneN > 1 ? 'used' : ''}"></i></span>`;
    const count = `<div class="act-count">Action ${doneN + 1} of 2 ${dots}</div>`;
    const backHead = (label) => `<div class="act-top">${backBtn('back', label)}${count}</div>`;

    if (ui.mode === 'play') return backHead(ui.species ? 'Other dinos' : 'Back') + playModeHtml(T, false);
    if (ui.mode === 'draw') {
      return `${backHead()}<h3>🃏 Draw a card</h3><p>Tap a face-up card or the deck in the <b>card market</b> at the bottom of this panel.</p>`;
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
      { m: 'gain3', i: '🪙', t: 'Take 2 coins', s: 'Always works', ok: true },
      { m: 'fences2', i: '🪵', t: 'Build 2 fences', s: 'Grow your land', ok: legalEdges(T.p).length > 0, why: 'No room for fences' },
    ]
      .map((x, n) => `<button class="tile" style="--n:${n}" data-act="mode" data-m="${x.m}" ${x.ok ? '' : 'disabled'}><span class="t-i">${x.i}</span><span class="t-t">${x.t}</span><span class="t-s">${x.ok ? x.s : `🔒 ${x.why}`}</span></button>`)
      .join('');
    return `<div class="act-top">${count}<button class="btn sm ghost" data-act="endTurn">Skip ${T.remaining > 1 ? 'both' : 'last'} ▸</button></div>
      <p class="act-help">Pick two. The same one twice is fine.</p>
      <div class="tiles">${tiles}</div>`;
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
      const opts = state.proto ? protoPickOptions(T.p, T) : playOptions(T.p, free);
      const card = (o) => cardHtml(o.sp, {
        cls: `${o.ok ? 'pick' : 'nope'} ${o.why === 'Blocked by T. Rex' ? 'blockedc' : ''}`,
        attrs: o.ok ? `data-act="pickSpecies" data-sp="${o.sp}"${state.proto ? ` data-src="${o.src}" data-i="${o.i}"` : ''}` : '',
        tag: state.proto ? ({ h: 'reserved', b: 'breed' }[o.src] || 'market') : state.players[T.p].cards.includes(o.sp) ? 'card' : '',
        lock: o.ok ? '' : o.why,
        cost: o.src === 'b' ? breedCost(o.sp) : o.src === 'h' ? playCost(o.sp, 'h') : null,
        costLabel: o.src === 'b' ? 'Baby' : '',
      });
      const can = opts.filter((o) => o.ok);
      const cant = opts.filter((o) => !o.ok);
      const cards = (can.length ? can.map(card).join('') : '<p class="grid-note">Nothing you can play right now.</p>')
        + (cant.length ? `<div class="grid-split">🔒 Not right now</div>${cant.map(card).join('')}` : '');
      const title = free ? `🎁 Pick a free dino (≤ ${T.limit || 5} points)` : state.proto ? (protoBreeding() ? `🥚 Breed a dino you already have (half its coins${spaceExtra() ? ` +🪙${spaceExtra()}` : ''}, 💎1 less)` : '🦖 Buy a dino from the market or your hand') : '🦖 Choose a dino to play';
      return `<h3>${title}</h3>
        <div class="card-grid">${cards}</div>
        ${free ? '<button class="btn ghost" data-act="skip">Skip free dino</button>' : ''}`;
    }
    const S = spec(ui.species);
    const v = validateSel();
    const egg = !!(ui.sel && ui.sel.breed);
    const need = ui.sel && ui.sel.need ? ui.sel.need : S.space;
    const price = free ? ' (free!)' : ` · ${costText(state.proto ? withExtra(egg ? breedCost(ui.species) : playCost(ui.species, ui.pick && ui.pick.src), spaceExtra()) : cardCost(ui.species))}`;
    return `<div class="place-head">${dz(ui.species, 'big')}<h3>${egg ? `Breed a baby ${esc(S.name)}` : `Place ${esc(S.name)}`}${price}</h3></div>
      ${placementBox(`Select ${plural(need, 'connected square')} ${egg ? 'in the enclosure with the pair' : 'inside one enclosure'}`)}
      <button class="btn big" data-act="place" ${v.ok ? '' : 'disabled'}>${egg ? 'Place baby' : `Place ${esc(spName(ui.species))}`}</button>
`;
  }

  function shopHtml(P) {
    if (ui.shopItem) {
      const isFeeder = ui.shopItem === 'feeder';
      const n = ui.sel.cells.size;
      const cost = withExtra(isFeeder ? feederCost(Math.max(1, n)) : waterCost(), spaceExtra());
      const v = validateSel();
      return `<h3>${isFeeder ? '🌾 Place a feeder' : '💧 Place a watering hole'} · ${costText(cost)}</h3>
        ${placementBox(isFeeder ? 'Select any number of connected squares in one enclosure' : 'Select 6 connected squares in one enclosure')}
        ${isFeeder ? `<p class="muted">Each square takes 1 food off that enclosure’s total each Feeding. ${state.proto ? 'Costs 💎1 + 🪙1 per square.' : 'Over 5 squares costs +🪙2 each.'}</p>` : '<p class="muted">Lets one additional dino species share this enclosure.</p>'}
        <button class="btn big" data-act="place" ${v.ok ? '' : 'disabled'}>Buy &amp; place</button>
`;
    }
    if (state.proto) {
      const x = spaceExtra();
      const water = withExtra(waterCost(), x);
      return `<h3>🌾 Builder${x ? ` <small>(+🪙${x} extra)</small>` : ''}</h3>
      <div class="opt-list">
        <button class="opt" data-act="shopItem" data-item="feeder" ${canAfford(P, withExtra(feederCost(1), x)) ? '' : 'disabled'}><span class="o-i">🌾</span><span class="o-t"><b>Feeder · 💎1 + 🪙1 per square${x ? ` + 🪙${x}` : ''}</b><small>Each square = 1 less food for that enclosure.</small></span></button>
        <button class="opt" data-act="shopItem" data-item="water" ${canAfford(P, water) ? '' : 'disabled'}><span class="o-i">💧</span><span class="o-t"><b>Watering hole · ${costText(water)}</b><small>Takes 6 squares. One more kind of dino can live there.</small></span></button>
      </div>`;
    }
    return `<h3>🛒 Shop</h3>
      <div class="opt-list">
        <button class="opt" data-act="buyDiamond" ${canAfford(P, DIAMOND_COST) ? '' : 'disabled'}><span class="o-i">💎</span><span class="o-t"><b>Diamond · 🪙6</b><small>Worth 3 points at the end. Some dinos cost diamonds.</small></span></button>
        <button class="opt" data-act="shopItem" data-item="feeder" ${canAfford(P, feederCost(1)) ? '' : 'disabled'}><span class="o-i">🌾</span><span class="o-t"><b>Feeder · 💎1 + 🪙3</b><small>Each square = 1 less food for that enclosure.</small></span></button>
        <button class="opt" data-act="shopItem" data-item="water" ${canAfford(P, waterCost()) ? '' : 'disabled'}><span class="o-i">💧</span><span class="o-t"><b>Watering hole · ${costText(waterCost())}</b><small>Takes 6 squares. One more kind of dino can live there.</small></span></button>
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
      <p>${T.source === 'deck' ? 'Draw the top card of the deck.' : `Tap a face-up card or the deck in the card market below${state.proto ? ' to reserve it' : ''}.`}</p>`;
  }

  function spinoHtml() {
    return `<h3>🦖 Spinosaurus event</h3>
      <p>Choose one reward. Afterwards you ${state.proto ? 'reserve' : 'draw'} the top card of the deck${state.deck.length ? '' : ' (the deck is empty)'}${state.proto && state.players[cur().p].hand.length >= handMax(state.players[cur().p]) ? ' (your hand is full)' : ''}.</p>
      <div class="opt-list">
        <button class="opt" data-act="spino" data-o="dia"><span class="o-i">💎</span><span class="o-t"><b>Gain 1 diamond</b></span></button>
        <button class="opt" data-act="spino" data-o="coins"><span class="o-i">🪙</span><span class="o-t"><b>Gain 5 coins</b></span></button>
        <button class="opt" data-act="spino" data-o="food"><span class="o-i">🍖</span><span class="o-t"><b>Gain 15 food</b><small>Any mix of meat and plants</small></span></button>
        <button class="opt" data-act="spino" data-o="fill" ${emptyCount(other(cur().p)) ? '' : 'disabled'}><span class="o-i">🪨</span><span class="o-t"><b>Fill 10 squares in your opponent’s park</b></span></button>
      </div>`;
  }

  function trexHtml(T) {
    const O = state.players[other(T.p)];
    const where = (sp) => {
      if (!state.proto) return O.cards.includes(sp) ? ' · drawn card' : '';
      if (O.hand.includes(sp)) return ' · in their hand';
      return state.faceUp.includes(sp) ? ' · in the market' : '';
    };
    const opts = trexOptions(T.p)
      .map((sp) => `<button class="opt" data-act="trex" data-sp="${sp}"><span class="o-i">${dz(sp, 'big')}</span><span class="o-t"><b>${esc(SPECIES[sp].name)}</b><small>${costText(cardCost(sp))} · ⬛${spec(sp).space} · ${spec(sp).pts} pts${where(sp)}</small></span></button>`)
      .join('');
    const from = state.proto ? 'Choose a dino' : `Choose a dino from <b>${esc(O.name)}’s</b> book or cards`;
    const block = state.proto ? `<b>${esc(O.name)}</b> can’t place it for the next ${PROTO_TREX_ROUNDS} rounds (through round ${state.round + PROTO_TREX_ROUNDS})` : 'They can’t place any more of it';
    return `<h3>🦖 T. Rex roars!</h3><p>${from}. ${block}.</p><div class="opt-list">${opts}</div>`;
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

  function growHtml(T) {
    const it = state.players[T.p].board.items[T.id];
    if (!it || !ui.sel) return '';
    const S = spec(it.species);
    const extra = growExtra(it);
    const v = validateSel();
    const mine = !theirTurn(T);
    return `<div class="place-head">${dz(it.species, 'big')}<h3>🍼 Baby ${esc(S.name)} is growing up!</h3></div>
      <p>It’s been fed ${PROTO_BABY_FEEDS} times, so it grows into an adult. Pick <b>${plural(extra, 'more square')}</b> joined to it in its enclosure (an adult takes ${S.space}).${SPECIES[it.species].type === 'event' ? ' Its when-played power triggers once it’s grown.' : ''}</p>
      ${placementBox(`Select ${plural(extra, 'empty square')} next to the baby`)}
      ${mine ? `<div class="btn-row"><button class="btn ghost" data-act="growAuto">Pick squares for me</button><button class="btn big" data-act="place" ${v.ok ? '' : 'disabled'}>Grow up</button></div>` : ''}`;
  }

  function powerHtml(T) {
    const [label] = powerEffect(T);
    const S = spec(T.sp);
    return `<h3>⚡ Production power</h3>
      <div class="power-card"><img src="${IMG}${T.sp}.webp" alt=""><div><b>${esc(S.name)}${T.n > 1 ? ` ×${T.n}` : ''}</b><p>${esc(S.ability)}</p></div></div>
      ${T.sp === 'triceratops' ? triPayHtml(T) : ''}
      <button class="btn big" data-act="usePower">${label}</button>`;
  }

  function triPayHtml(T) {
    const P = state.players[T.p];
    const need = sumCosts(feedables(analyze(P.board)).map(enclosureCost)).plant;
    const n = triPay(T);
    return `<p>You have 🌿${P.plants}; this round’s Feeding needs 🌿${need}. Each plant on the page is worth 1½ points at the end.</p>
      ${triMax(T) > 0 ? stepper('triPay', '🌿 Plants to pay', n, n > 0, n < triMax(T)) : ''}`;
  }

  function stealHtml(T) {
    const O = state.players[other(T.p)];
    const [lo, hi] = stealRange(T);
    const plant = T.amount - ui.meat;
    return `<h3>🦖 Velociraptor raid</h3>
      ${state.proto ? '<p class="muted">⚡ Production power: choose what to take.</p>' : ''}
      <p>Steal <b>${T.amount}</b> food from ${pn(other(T.p))} (they have 🍖${O.meat} 🌿${O.plants}).</p>
      ${stepper('meat', '🍖 Meat', ui.meat, ui.meat > lo, ui.meat < hi)}
      <div class="stepper"><span class="st-l">🌿 Plants</span><b>${plant}</b></div>
      <button class="btn big" data-act="confirmSteal">Steal ${ui.meat} 🍖 + ${plant} 🌿</button>`;
  }

  function aiPlanNote() {
    if (state.proto) return '';
    const cfg = state.aiCfg;
    const st = cfg && !online && cfg.level === 'hard' && HARD_STRATS[cfg.strat];
    return st ? `<p class="ai-plan">🤖 The computer’s game plan: <b>${st.name}</b> — ${st.desc}.</p>` : '';
  }

  function simPlanNote() {
    if (state.proto) return '';
    const notes = state.sim.cfgs.map((c, p) => {
      const st = c.level === 'hard' && HARD_STRATS[c.strat];
      return st ? `${pn(p)}: <b>${st.name}</b> — ${st.desc}` : '';
    }).filter(Boolean);
    return notes.length ? `<p class="ai-plan">🤖 Game plans: ${notes.join('<br>')}</p>` : '';
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
          ${scoreRows().map(([label, k]) => row(label, k)).join('')}
        </tbody>
        <tfoot><tr><td>Total</td><td>${s[0].total}</td><td>${s[1].total}</td></tr></tfoot>
      </table>
      ${state.proto ? `<p class="muted">Goals: ${(state.goals || []).map((id) => `${PROTO_GOALS[id].icon} ${PROTO_GOALS[id].name} (${PROTO_GOALS[id].desc})`).join('; ')}. Diamonds 1 point each, 1 point per 10 leftover coins (max 3).</p>` : ''}
      <p class="muted">Dinos in inactive or extinct enclosures score nothing. Leftover coins: ${esc(P[0].name)} 🪙${P[0].coins}, ${esc(P[1].name)} 🪙${P[1].coins}.</p>
      ${state.sim ? simPlanNote() : aiPlanNote()}
      ${state.sim
    ? '<div class="btn-row"><button class="btn big" data-act="simAgain">🔁 Run again</button><button class="btn big ghost" data-act="simStop">⏹ Exit simulation</button></div>'
    : online
    ? '<div class="btn-row"><button class="btn big" data-act="olRematch">🦖 Rematch</button><button class="btn big ghost" data-act="onlineLeave">🏠 My games</button></div>'
    : state.past
    ? '<div class="btn-row"><a class="btn big" href="/dino-history.html">🏆 Back to history</a><a class="btn big ghost" href="/dino-board-game.html">🦖 Play</a></div>'
    : '<button class="btn big" data-act="newGame">🥚 Play again</button>'}
      ${state.sim ? '' : `<div class="btn-row"><button class="btn ghost" data-act="replayReveal">🎬 Replay the reveal</button>${state.past ? '' : '<a class="btn ghost" href="/dino-history.html">🏆 Game history</a>'}</div>`}`;
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
      const v = validatePlacement(s.board, cells, { kind: 'dino', species: s.species, size: s.breed ? babySize(s.species) : spec(s.species).space });
      if (v.ok && s.breed && v.comp.living.filter((d) => d.species === s.species && isAdult(d)).length < 2) return { ok: false, msg: `The baby must go in an enclosure with a pair of adult ${spName(s.species)}.` };
      return v.ok && s.breed ? Object.assign({}, v, { msg: `Baby fits in enclosure ${v.comp.name} ✔` }) : v;
    }
    if (s.purpose === 'grow') return validateGrow(s.board, s.id, cells);
    if (s.purpose === 'feeder') {
      const v = validatePlacement(s.board, cells, { kind: 'feeder' });
      if (!v.ok) return v;
      const cost = withExtra(feederCost(cells.length), spaceExtra());
      if (!canAfford(P, cost)) return { ok: false, msg: `A ${cells.length}-square feeder costs ${costText(cost)} — too expensive.` };
      return { ok: true, msg: `${cells.length}-square feeder for ${costText(cost)} ✔` };
    }
    if (s.purpose === 'water') {
      const v = validatePlacement(s.board, cells, { kind: 'water', size: 6 });
      if (!v.ok) return v;
      if (!canAfford(P, withExtra(waterCost(), spaceExtra()))) return { ok: false, msg: 'You can’t afford a watering hole.' };
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
    const first = s.purpose === 'grow' && b.items[s.id] ? b.items[s.id].cells[0] : s.cells.size ? s.cells.values().next().value : null;
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
    const saved = load();
    const canResume = saved && saved.queue[0] && saved.queue[0].t !== 'gameOver';
    app.innerHTML = tokify(`<div class="setup${setupOnline ? ' vs-online' : setupVsAi ? ' vs-ai' : ''}">
      <div class="box-lid">
        <img class="cover" src="${IMG}cover.webp" alt="Dinosaurs in fenced enclosures in a jungle park">
        <div class="lid-title"><h1>Dino Board Game</h1><p class="tagline">Fence your land, feed your dinos, and build the best park in ${PROTO_ROUNDS} rounds.</p></div>
        ${floaters}
      </div>
      <div class="parade">${parade}</div>
      <div class="setup-card">
        <h2>How do you want to play?</h2>
        <div class="mode-pick" role="radiogroup">
          <button class="mode-btn m-2p" data-act="setupMode" data-mode="2p" role="radio"><span>👥</span><b>Two players</b><small>Share this device</small></button>
          <button class="mode-btn m-ai" data-act="setupMode" data-mode="ai" role="radio"><span>🤖</span><b>Vs computer</b><small>You play Red</small></button>
          <button class="mode-btn m-online" data-act="setupMode" data-mode="online" role="radio"><span>🌐</span><b>Online</b><small id="ol-badge">Challenge a friend</small></button>
        </div>
        <div class="online-box only-online">
          <div class="ol-form">
            <label for="ol-opp">Challenge another Ahrens Labs player</label>
            <input id="ol-opp" maxlength="80" placeholder="Their username or email" autocomplete="off">
            <div class="seg ol-mode" role="radiogroup">
              <button class="seg-btn${olMode === 'quick' ? ' on' : ''}" data-act="olMode" data-v="quick"><b>⚡ Quick game</b><small>2 minutes per move — play it now</small></button>
              <button class="seg-btn${olMode === 'long' ? ' on' : ''}" data-act="olMode" data-v="long"><b>🐢 Long game</b><small>No time limit — move whenever it’s your turn, over days</small></button>
            </div>
            <button class="btn big" data-act="olChallenge">🦖 Send challenge</button>
            <p class="muted">They get an email, and the challenge shows up here when they sign in.</p>
          </div>
          <div id="ol-list"></div>
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
        <div class="setup-foot">Everyone starts with 🪙5 and an empty park, buying dinos from a shared market. Your game saves in this browser.</div>
      </div>
      <div class="setup-actions">${canResume ? '<button class="btn" data-act="resumeLocal">▶ Resume saved game</button>' : ''}<a class="btn ghost" href="/dino-history.html">🏆 Game history</a><button class="btn ghost" data-act="rules">📜 Read the rules</button>${isAdmin() ? '<button class="btn ghost" data-act="simOpen">🧪 Computer vs computer</button>' : ''}</div>
    </div>`);
    renderLobby();
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

  function openProtoRules() {
    const spaces = Object.values(PROTO_SPACES).map((X) => `<li>${X.icon} <b>${X.name}</b> — ${X.desc}${X.open ? ' <i>(any number of workers)</i>' : ''}</li>`).join('');
    const events = Object.values(PROTO_EVENTS).map((E) => `<li>${E.icon} <b>${E.name}</b> — ${E.desc}</li>`).join('');
    openModal(`<div class="modal-head"><h2>📜 How to play</h2><button class="x" data-act="closeModal" aria-label="Close">✕</button></div>
      <p>Two players each build a dino park on a 10×10 grid over <b>${PROTO_ROUNDS} rounds</b>. Most points wins.</p>
      <h3>Setup</h3>
      <ul>
        <li>Each player gets an empty park and 🪙5.</li>
        <li>The dino deck is shuffled and ${PROTO_MARKET} cards are dealt face up as a shared market.</li>
        <li>Whoever most recently watched a dino movie goes first in round 1. After that the first player switches every round, unless someone takes the top 🔭 Scout space.</li>
        <li>${PROTO_GOAL_ROUNDS.length} of ${Object.keys(PROTO_GOALS).length} goal cards are picked at random: ${protoGoalSchedule()}. Tap 🎯 Goals to see the revealed ones and what they’re worth right now.</li>
      </ul>
      <h3>Each round</h3>
      <ol>
        <li><b>Event</b> — a new event card changes something for this round.</li>
        <li><b>🎲 Food &amp; Fences</b> — roll a die. Each player splits that number between food (🍖 meat / 🌿 plants) and fences. A fence fills one edge of one square.</li>
        <li><b>👷 Workers</b> — each player has ${PROTO_WORKERS} workers. Starting with the first player, take turns placing one at a time on the worker spaces below.</li>
        <li><b>🪙 Production &amp; powers</b> — collect coins from one active enclosure (the production of every dino in it), then use your dinos’ every-round powers.</li>
        <li><b>🍖 Feeding</b> — feed your dinos. An enclosure with an unfed dino goes inactive: its dinos cost extra food equal to its marker, which rises each round it stays unfed. If the marker was already on 4, those dinos die and the enclosure is extinct (💀).</li>
      </ol>
      <h3>Worker spaces</h3>
      <p>Every kind of space comes in three tiers. The top two hold one worker per round, so you can block your opponent; the weaker bottom tier takes any number of workers.</p>
      <ul>${spaces}</ul>
      <h3>Buying dinos</h3>
      <ul>
        <li>Buy a face-up market card, or one you reserved, with a 🦖 Play a dino worker. Pay its cost and fill its squares in one enclosure. Bought cards are gone for your opponent.</li>
        <li>Reserve cards with 🔭 Scout (up to ${PROTO_HAND_MAX} in your hand). Only you can buy your reserved cards, and they cost 🪙${PROTO_RESERVE_OFF} less to play.</li>
        <li>From round 2, ${PROTO_REFRESH} random market cards are replaced at the start of each round.</li>
      </ul>
      <h3>Enclosures</h3>
      <ul>
        <li>An enclosure is an area completely closed off by fences. It may use at most <b>two sides</b> of the board edge as walls.</li>
        <li>Dinos, feeders and watering holes fill <b>connected</b> squares inside one enclosure, and fences can’t cut through them.</li>
        <li>Each enclosure holds one species, plus one more for each 💧 watering hole in it (${costText(WATER_COST)}, ${WATER_SQUARES} squares).</li>
        <li>🌾 Feeders cost 💎1 + 🪙1 per square. Each feeder square takes 1 food off that enclosure’s bill every Feeding.</li>
      </ul>
      <h3>Breeding</h3>
      <p>A 🥚 Breed space adds a baby of a species you have an adult pair of in one enclosure; the baby goes in that enclosure and costs half the dino’s coins (rounded up) plus the space’s extra coins, and 1 diamond less than the card. Babies take half the squares (rounded down), eat half and have half the production, points and scoring powers (all rounded up), with no when-played or every-round powers. After being fed in ${PROTO_BABY_FEEDS} Feedings a baby grows up: you add squares for its full size (or it dies if there’s no room), and its when-played power triggers.</p>
      <h3>Scoring</h3>
      <ul>
        <li>Each dino’s points (the yellow circle).</li>
        <li>Scoring powers (Compy, Microraptor, Pachy, the Triceratops page).</li>
        <li>The ${PROTO_GOAL_ROUNDS.length} goal cards.</li>
        <li>💎 Each leftover diamond = 1 point. 🪙 1 point per 10 leftover coins (max 3).</li>
      </ul>
      <p>Dinos in inactive or extinct enclosures score nothing.</p>
      <h3>Goal cards</h3><ul>${Object.values(PROTO_GOALS).map((G) => `<li>${G.icon} <b>${G.name}</b> — ${G.desc}</li>`).join('')}</ul>
      <h3>Events</h3><ul>${events}</ul>
      <p class="muted">The deck has more copies of herd dinos (Compy ${PROTO_COPIES.compy}, Microraptor ${PROTO_COPIES.microraptor}, Parasaurolophus ${PROTO_COPIES.parasaurolophus}, Pachy ${PROTO_COPIES.pachy}); Spinosaurus, Dilophosaurus, Ankylosaurus, T. Rex and Mosasaurus have 2. Everything else has 3.</p>`);
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
        <li><b>Buy from the shop</b> — 💎 Diamond (🪙6), 🌾 Feeder (💎1 + 🪙3, +🪙2 per square over 5; each square = 1 less food in total for that enclosure each Feeding), 💧 Watering hole (${costText(WATER_COST)}, 6 squares; allows one more species in that enclosure).</li>
        <li><b>Use a dino action</b> — a red ability of a dino in an active enclosure.</li>
        <li><b>Gain 2 coins.</b></li>
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
        <li>Microraptor scores 2 points per active enclosure that has a Microraptor (once per enclosure, no matter how many Microraptors you have).</li>
        <li>Gigantoraptor: at the start of next round you pick a phase; you take your part of it twice (the Gain Food bonus rolls its own die).</li>
      </ul>`);
  }

  function openBook(p) {
    const P = state.players[p];
    if (state.proto) {
      openModal(`<div class="modal-head"><h2>✋ ${esc(P.name)}’s reserved cards</h2><button class="x" data-act="closeModal" aria-label="Close">✕</button></div>
        <p class="muted">Reserved with Scout (or Spinosaurus / Dilophosaurus). Buy them with a Play a dino worker. Hand limit ${handMax(P)}.</p>
        <div class="card-grid hand-grid pl-${P.color}">${P.hand.map((sp) => cardHtml(sp, { cls: 'held', tag: '✋ Reserved' })).join('') || '<p class="grid-note">No reserved cards.</p>'}</div>`);
      return;
    }
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
    if (act === 'take' && el && el.closest('.modal')) closeModal();
    if (act === 'confirmYes') {
      const fn = pendingConfirm;
      closeModal();
      if (fn) fn();
      return;
    }
    if (act === 'goals') {
      if (state && state.goals) openGoals();
      return;
    }
    if (act === 'rules') {
      if (state && !state.proto && !state.sim) openRules();
      else openProtoRules();
      return;
    }
    if (act === 'setupMode') {
      setupVsAi = ds.mode === 'ai';
      setupOnline = ds.mode === 'online';
      setupTouched = true;
      const box = document.querySelector('.setup');
      if (box) {
        box.classList.toggle('vs-ai', setupVsAi);
        box.classList.toggle('vs-online', setupOnline);
      }
      if (setupOnline) loadLobby();
      return;
    }
    if (act.startsWith('ol') || act === 'resumeLocal' || act === 'onlineLeave' || act === 'onlineResign') {
      onlineAct(act, ds, el);
      return;
    }
    if (act === 'setupStart') {
      const n0 = (document.getElementById('name0').value || '').trim() || 'Red';
      const n1 = setupVsAi ? 'Computer' : (document.getElementById('name1').value || '').trim() || 'Blue';
      newGame([n0, n1], +ds.first, setupVsAi ? 1 : null, setupLevel, setupPace, true);
      return;
    }
    if (act === 'simOpen') { if (isAdmin()) openSimSetup(); return; }
    if (act === 'simOpt') {
      simSetup[ds.k] = ds.v;
      el.parentElement.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('on', b === el));
      return;
    }
    if (act === 'simStart') { if (isAdmin()) startSim([simSetup.l0, simSetup.l1], simSetup.speed, true); return; }
    if (act === 'simStop') { stopSim(); return; }
    if (act === 'setupOpt') {
      if (ds.k === 'level') setupLevel = ds.v;
      else setupPace = ds.v;
      savePrefs(setupLevel, setupPace);
      el.parentElement.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('on', b === el));
      return;
    }
    if (!state) return;
    if (act === 'viewCard') {
      if (SPECIES[ds.sp]) openMarketCard(ds.sp, +ds.from);
      return;
    }
    if (act === 'fullLog') {
      openModal(`<div class="modal-head"><h2>🗒️ What happened</h2><button class="btn sm ghost" data-act="closeModal">Close</button></div>
        ${state.log.length ? `<ul class="log-list full">${logItems(state.log)}</ul>` : '<p class="muted">Nothing yet.</p>'}`);
      return;
    }
    if (act === 'replayReveal') {
      if (cur() && cur().t === 'gameOver') revealWinner();
      return;
    }
    if (act === 'newGame') {
      if (state && state.past) {
        location.href = '/dino-board-game.html';
        return;
      }
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
    if (act === 'simAgain' && state.sim) { startSim(state.sim.levels, state.sim.speed, state.sim.proto); return; }
    if (act === 'simSpeed' && state.sim) {
      const keys = Object.keys(SIM_SPEEDS);
      state.sim.speed = keys[(keys.indexOf(state.sim.speed) + 1) % keys.length];
      simSetup.speed = state.sim.speed;
      renderTop();
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
        if (state.proto) {
          protoStartRound();
          state.queue = protoHatchAndGrow().concat(buildRoundTasks());
          commit();
          break;
        }
        if (online) {
          T.picks = T.picks || {};
          const need = state.players[online.me].bonusPending;
          if (need) {
            const mine = ui.picks[online.me] || [];
            if (mine.length < need) return;
            T.picks[online.me] = mine.slice();
          }
          if (onlineLockIn()) {
            commit();
            break;
          }
          ui.picks = { 0: T.picks[0] || [], 1: T.picks[1] || [] };
        }
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
        } else if (T.t === 'power' && T.sp === 'triceratops') {
          ui.triPay = clamp(triPay(T) + d, 0, triMax(T));
        } else if (T.t === 'feed') {
          const tot = sumCosts(feedables(analyze(P.board)).filter((cp) => ui.feed.has(cp.key)).map(enclosureCost));
          ui.flexMeat = flexMeatPick(P, tot, flexMeatPick(P, tot, ui.flexMeat) + d);
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
        const legal = new Set(legalEdges(p));
        const edges = ui.sel ? [...ui.sel.edges].filter((e) => legal.has(e)) : [];
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
        doFeed(p, ui.feed, ui.flexMeat);
        resolveCurrent();
        break;
      case 'produce': {
        const cp = produceChoices(T).find((c) => c.key === +ds.key);
        if (!cp) break;
        P.coins += cp.prod;
        logMsg(`${pn(p)} collected 🪙${cp.prod} from enclosure ${cp.name}.`);
        toast(`🪙 +${cp.prod} for ${P.name}`, 'good');
        if (state.proto) {
          T.got = (T.got || []).concat(cp.key);
          if (state.event === 'goldrush' && T.got.length < PROTO_GOLDRUSH && produceChoices(T).length) {
            commit();
            break;
          }
          resolveCurrent(protoPowerTasks(p));
          break;
        }
        resolveCurrent();
        break;
      }
      case 'usePower':
        if (T.t === 'power') usePower(T);
        break;
      case 'space':
        if (T.t === 'actions' && T.work) protoSpace(T, ds.s);
        break;
      case 'mode': {
        if (T.t !== 'actions') break;
        const m = ds.m;
        if (m === 'gain3') {
          P.coins += 2;
          logMsg(`${pn(p)} gained 🪙2.`);
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
          ui.space = null;
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
        const opt = state.proto
          ? protoPickOptions(p, T).find((o) => o.src === ds.src && o.i === +ds.i && o.sp === sp)
          : playOptions(p, free).find((o) => o.sp === sp);
        if (!opt || !opt.ok) break;
        if (state.proto) ui.pick = { src: opt.src, i: opt.i };
        ui.species = sp;
        const breed = state.proto && opt.src === 'b';
        ui.sel = { type: 'cells', board: p, cells: new Set(), need: breed ? babySize(sp) : spec(sp).space, purpose: 'dino', species: sp, breed };
        render();
        break;
      }
      case 'shopItem':
        ui.shopItem = ds.item;
        ui.sel = { type: 'cells', board: p, cells: new Set(), need: ds.item === 'water' ? 6 : null, purpose: ds.item };
        render();
        break;
      case 'buyDiamond':
        if (state.proto || !canAfford(P, DIAMOND_COST)) break;
        pay(P, DIAMOND_COST);
        P.diamonds++;
        logMsg(`${pn(p)} bought a 💎 diamond.`);
        completeAction();
        break;
      case 'place':
        doPlace(T);
        break;
      case 'growAuto': {
        const it = T.t === 'grow' && ui.sel && state.players[p].board.items[T.id];
        const cells = it && growMore(state.players[p].board, it, growExtra(it));
        if (!cells) break;
        ui.sel.cells = new Set(cells);
        render();
        break;
      }
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
        if (state.proto) {
          O.blockEnd = Object.assign({}, O.blockEnd, { [sp]: state.round + PROTO_TREX_ROUNDS });
          logMsg(`🦖 ${pn(p)}’s T. Rex blocked ${pn(other(p))} from placing <b>${spName(sp)}</b> until the end of round ${O.blockEnd[sp]}.`);
          toast(`🚫 ${O.name} can’t place ${spName(sp)} until round ${O.blockEnd[sp] + 1}`, 'bad');
        } else {
          logMsg(`🦖 ${pn(p)}’s T. Rex blocked ${pn(other(p))} from placing any more <b>${spName(sp)}</b>.`);
          toast(`🚫 ${O.name} can’t place ${spName(sp)} anymore`, 'bad');
        }
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

  function doFeed(p, keys, flexMeat) {
    const P = state.players[p];
    const b = P.board;
    const an = analyze(b);
    const list = feedables(an);
    const fed = list.filter((cp) => keys.has(cp.key));
    const unfed = list.filter((cp) => !keys.has(cp.key));
    const tot = sumCosts(fed.map(enclosureCost));
    if (!canPayFood(P, tot)) return;
    const fm = flexMeatPick(P, tot, flexMeat);
    P.meat -= tot.meat + fm;
    P.plants -= tot.plant + tot.flex - fm;
    const msgs = [];
    const paidM = tot.meat + fm;
    const paidP = tot.plant + tot.flex - fm;
    if (fed.length) msgs.push(`fed ${fed.map((cp) => cp.name).join(', ')}${tot.total ? ` (paid ${[paidM ? '🍖' + paidM : '', paidP ? '🌿' + paidP : ''].filter(Boolean).join(' ')})` : ''}`);
    if (state.proto) fed.forEach((cp) => cp.living.forEach((d) => { if (d.stage === 'baby') d.fed = (d.fed || 0) + (state.event === 'nursery' ? 2 : 1); }));
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
      const cost = state.proto ? withExtra(s.breed ? breedCost(sp) : playCost(sp, ui.pick && ui.pick.src), spaceExtra()) : SPECIES[sp].cost;
      if (state.proto) {
        const pk = ui.pick;
        if (!pk) return;
        if (pk.src === 'b') {
          if (free || !protoBreedOptions(p, spaceExtra()).some((o) => o.i === pk.i && o.sp === sp && o.ok)) return;
        } else {
          const list = pk.src === 'h' ? P.hand : state.faceUp;
          if (list[pk.i] !== sp) return;
          if (!free && !canAfford(P, cost)) return;
          if (pk.src === 'h') P.hand.splice(pk.i, 1);
          else protoTakeFromMarket(pk.i);
          P.cards.push(sp);
        }
        if (!free) pay(P, cost);
      } else if (!free) {
        if (!canAfford(P, cost)) return;
        pay(P, cost);
      }
      const encl = placeItem(p, 'dino', cells, sp);
      if (s.breed) {
        const baby = P.board.items[P.board.nextId - 1];
        baby.stage = 'baby';
        baby.fed = 0;
        baby.born = state.round;
        logMsg(`🐣 ${pn(p)} bred ${dz(sp)} <b>${spName(sp)}</b>: a baby in enclosure ${encl} (${costText(cost)}).`);
        completeAction();
        return;
      }
      logMsg(`${pn(p)} played ${dz(sp)} <b>${spName(sp)}</b> in enclosure ${encl}${free ? ' for free' : ` (${costText(cost)})`}.`);
      let tasks = [];
      if (SPECIES[sp].type === 'event') {
        toast(`⚡ ${spName(sp)} event!`, 'good');
        tasks = eventTasks(p, sp);
      }
      if (free) resolveCurrent(tasks);
      else completeAction(tasks);
      return;
    }
    if (s.purpose === 'grow') {
      const it = P.board.items[s.id];
      it.cells = it.cells.concat(cells).sort((x, y) => x - y);
      cells.forEach((i) => { P.board.cells[i] = it.id; });
      delete it.stage;
      delete it.fed;
      delete it.born;
      logMsg(`🦖 ${pn(p)}’s baby ${dz(it.species)} <b>${spName(it.species)}</b> grew up!`);
      toast(`🦖 ${spName(it.species)} grew up!`, 'good');
      let tasks = [];
      if (SPECIES[it.species].type === 'event') {
        toast(`⚡ ${spName(it.species)} event!`, 'good');
        tasks = eventTasks(p, it.species);
      }
      resolveCurrent(tasks);
      return;
    }
    if (s.purpose === 'feeder') {
      const cost = withExtra(feederCost(cells.length), spaceExtra());
      pay(P, cost);
      const encl = placeItem(p, 'feeder', cells);
      logMsg(`${pn(p)} built a ${cells.length}-square 🌾 feeder in enclosure ${encl} (${costText(cost)}).`);
      completeAction();
      return;
    }
    if (s.purpose === 'water') {
      const cost = withExtra(waterCost(), spaceExtra());
      pay(P, cost);
      const encl = placeItem(p, 'water', cells);
      logMsg(`${pn(p)} dug a 💧 watering hole in enclosure ${encl} (${costText(cost)}).`);
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
  const FREE_ACTS = new Set(['simOpen', 'simOpt', 'simStart', 'simSpeed', 'simStop', 'simAgain', 'fullLog', 'viewCard', 'rules', 'goals', 'book', 'closeModal', 'newGame', 'confirmYes', 'aiSettings', 'setAiOpt', 'onlineLeave', 'onlineResign', 'olRematch', 'replayReveal']);
  const AI_LEVELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
  const AI_PACES = { fast: 'Fast', medium: 'Medium', slow: 'Slow' };
  const AI_LEVEL_HELP = { easy: 'Plays for fun and makes mistakes', medium: 'Plans one move at a time', hard: 'Plays to win: plans fences, cards and the whole game' };
  const AI_PACE_HELP = { fast: 'Quick turns', medium: 'Easy to follow', slow: 'Step by step' };
  const PACE_MULT = { fast: 0.35, medium: 0.7, slow: 2.1 };
  // Admin computer-vs-computer simulations. Turbo skips the pauses and repaints a few times a second.
  const SIM_SPEEDS = {
    turbo: { name: 'Turbo', icon: '⚡', help: 'As fast as it can go', mult: 0 },
    fast: { name: 'Fast', icon: '⏩', help: 'Quick but watchable', mult: 0.15 },
    watch: { name: 'Watch', icon: '👀', help: 'Follow each move', mult: 0.5 },
  };
  const SIM_PAINT_MS = 120;
  const ADMIN_EMAIL = 'calebahrens2011@gmail.com';
  let simPaintAt = 0;
  const simSetup = { l0: 'hard', l1: 'medium', speed: 'turbo' };

  function isAdmin() {
    try {
      return (localStorage.getItem('ahrenslabs_email') || '').trim().toLowerCase() === ADMIN_EMAIL;
    } catch {
      return false;
    }
  }

  function openSimSetup() {
    const speeds = {};
    const speedHelp = {};
    Object.keys(SIM_SPEEDS).forEach((k) => { speeds[k] = `${SIM_SPEEDS[k].icon} ${SIM_SPEEDS[k].name}`; speedHelp[k] = SIM_SPEEDS[k].help; });
    openModal(`<div class="modal-head"><h2>🧪 Computer vs computer</h2><button class="x" data-act="closeModal" aria-label="Close">✕</button></div>
      <p class="muted">Admin only. Two computers play a full game while you watch both parks. Nothing is saved or added to game history.</p>
      ${segGroup('🔴 Red computer', 'simOpt', 'l0', AI_LEVELS, AI_LEVEL_HELP, simSetup.l0)}
      ${segGroup('🔵 Blue computer', 'simOpt', 'l1', AI_LEVELS, AI_LEVEL_HELP, simSetup.l1)}
      ${segGroup('Speed', 'simOpt', 'speed', speeds, speedHelp, simSetup.speed)}
      <button class="btn big" data-act="simStart">▶ Start simulation</button>`, 'small');
  }

  function startSim(levels, speed, proto) {
    closeModal();
    closeReveal();
    clearTimeout(aiTimer);
    aiTimer = null;
    aiPending = false;
    buildGame([`Red · ${AI_LEVELS[levels[0]]}`, `Blue · ${AI_LEVELS[levels[1]]}`], rand(2), null, undefined, undefined, proto);
    state.sim = { levels: levels.slice(), speed, cfgs: levels.map((l) => aiProfile(l, 'fast')), proto: !!proto };
    lastFocus = null;
    simPaintAt = 0;
    commit();
  }

  function stopSim() {
    clearTimeout(aiTimer);
    aiTimer = null;
    aiPending = false;
    closeModal();
    closeReveal();
    state = null;
    ui = freshUi();
    resetFx();
    lastFocus = null;
    render();
  }
  const LEVEL_TUNE = {
    easy: { depth: 1, noise: 1.4, style: 1.2, foresight: 0.7, blunder: 0.25 },
    medium: { depth: 1, noise: 0.8, style: 1, foresight: 0.85, blunder: 0 },
    hard: { depth: 2, noise: 0.03, style: 0, foresight: 1, blunder: 0, proj: true, water: true, deep: true, strat: true, prune: 6, big: true, giga: true, bank: true, feed2: true },
  };
  const AI_STYLES = {
    builder: { sp: { trex: 3, mosasaurus: 3, spinosaurus: 1.5, brachiosaurus: 1.5, allosaurus: 1 }, act: { fences: 0.8, diamond: 0.4 } },
    herder: { sp: { compy: 1.5, microraptor: 2, parasaurolophus: 2, stegosaurus: 1, triceratops: 0.8 }, act: { feeder: 1.2, draw: 0.4 } },
    raider: { sp: { velociraptor: 2.5, allosaurus: 2.5, brachiosaurus: 1.5, dilophosaurus: 1.5, carnotaurus: 1 }, act: { dinoAct: 1, draw: 0.3 } },
    banker: { sp: { pachy: 3, triceratops: 2, ankylosaurus: 1, gigantoraptor: 1 }, act: { diamond: 1, gain3: 0.4 } },
  };
  // Hard picks one of these game plans per game: it values its favourite dinos a little higher, so it
  // sizes enclosures and spends actions differently from game to game.
  const HARD_STRATS = {
    giants: { name: 'Big game', desc: 'huge dinos in big enclosures', sp: { trex: 1.15, mosasaurus: 1.2, spinosaurus: 1.12, brachiosaurus: 1.1, allosaurus: 1.08 } },
    herds: { name: 'Herds', desc: 'lots of small dinos', sp: { compy: 1.25, microraptor: 1.2, stegosaurus: 1.12, parasaurolophus: 1.15, velociraptor: 1.1 } },
    mixed: { name: 'Mixed park', desc: 'species sharing enclosures around watering holes', water: 0.8, sp: { triceratops: 1.1, ankylosaurus: 1.1, carnotaurus: 1.1, stegosaurus: 1.05 } },
    economy: { name: 'Economy', desc: 'coins, Pachys and Parasaurs', sp: { pachy: 1.25, parasaurolophus: 1.15, triceratops: 1.12, allosaurus: 1.1 } },
    raiders: { name: 'Raiders', desc: 'stealing and filling in your park', sp: { velociraptor: 1.2, allosaurus: 1.15, brachiosaurus: 1.12, dilophosaurus: 1.12, carnotaurus: 1.08 } },
  };
  // Forced first picks Hard tries in its deep play-outs (index into the ranked options at each step).
  const DEEP_FORCES = [[1], [2], [0, 1], [0, 2], [1, 0], [1, 1], [2, 0]];
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
  // Hard measures T. Rex blocks and filled squares with the opponent's own forecast, so it can trust them more.
  const TREX_WEIGHT = 0.8;
  // Dinos are where the points are: Hard breaks near-ties toward playing one.
  const PLAY_PRIORITY = 0.5;
  // Production pays out from one enclosure, so each coin added to the best one repays every round.
  const PROD_GROWTH = 0.6;
  // What Hard thinks a bonus Production coin is worth, and how much of its remaining actions can go to spending coins.
  const BONUS_COIN_VALUE = 0.55;
  const BONUS_SPEND_SHARE = 0.6;
  // Points per food a feeder saves beyond what the dino placed with it eats.
  const FEEDER_FOOD = 0.25;

  function aiProfile(level, pace) {
    const plan = AI_PLANS[rand(AI_PLANS.length)];
    const tail = shuffle(plan.segs.slice(plan.head).map((_, i) => i + plan.head));
    return {
      level: AI_LEVELS[level] ? level : 'medium',
      pace: AI_PACES[pace] ? pace : 'medium',
      style: Object.keys(AI_STYLES)[rand(4)],
      strat: Object.keys(HARD_STRATS)[rand(5)],
      anchor: rand(4),
      plan: { i: AI_PLANS.indexOf(plan), t: rand(8), order: plan.segs.slice(0, plan.head).map((_, i) => i).concat(tail) },
    };
  }

  function aiCfg() {
    if (state.sim) {
      const T = cur();
      return state.sim.cfgs[T && T.p != null ? T.p : state.first];
    }
    if (!state.aiCfg) state.aiCfg = aiProfile('medium', 'medium');
    return state.aiCfg;
  }

  function playerTune(p) {
    return LEVEL_TUNE[(state.sim ? state.sim.cfgs[p] : aiCfg()).level];
  }

  // Gigantoraptor bonuses stack, so Hard doubles Production while its best enclosure pays more than
  // two extra actions would, and while it still has actions left in the game to spend the coins.
  function aiBonusPicks(p) {
    const P = state.players[p];
    const picks = new Array(P.bonusPending).fill('action');
    if (!playerTune(p).giga) return picks;
    const prod = producible(p).reduce((mx, cp) => Math.max(mx, cp.prod), 0);
    const cap = (ROUNDS - state.round + 1) * 2 * 6 * BONUS_SPEND_SHARE;
    let coins = P.coins;
    return picks.map(() => {
      const acts = (coins >= 6 ? 2 : 0.8) + (coins >= 12 ? 2 : 0.8);
      if (Math.min(prod, Math.max(0, cap - coins)) * BONUS_COIN_VALUE <= acts) return 'action';
      coins += prod;
      return 'produce';
    });
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
    if (online) return false;
    if (state && state.sim) return !!T && T.t !== 'gameOver' && T.t !== 'roundEnd';
    if (!state || state.ai == null || !T || T.t === 'gameOver') return false;
    if (T.p === state.ai) return true;
    return T.t === 'roll' && state.first === state.ai;
  }

  function tune() {
    if (aiSafe) return LEVEL_TUNE.medium;
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

  // Points the opponent's own forecast loses if n of their squares get filled in (Hard).
  function oppFillLoss(p, n) {
    const q = other(p);
    const key = ['fill', state.round, cur() && cur().k, n, state.players[q].board.cells.join(), state.players[q].coins].join('|');
    const memo = aiCtx.oppLoss || (aiCtx.oppLoss = new Map());
    if (memo.has(key)) return memo.get(key);
    if (memo.size > 200) memo.clear();
    const saved = aiCtx.targets;
    aiCtx.targets = [];
    const tl = aiTimeline(cur() ? cur().k : null);
    const m = aiModel(q, 0);
    const before = aiEval(m, tl);
    aiRubbleCells(q, n).forEach((i) => { m.board.cells[i] = -1; });
    const loss = Math.max(0, before - aiEval(m, tl));
    aiCtx.targets = saved;
    memo.set(key, loss);
    return loss;
  }

  function fillHarm(p, n) {
    if (tune().proj) return oppFillLoss(p, n) * TREX_WEIGHT;
    const free = oppFreeValid(p);
    return (Math.min(n, free) * 0.3 + Math.max(0, n - free) * 0.04) * OPP_WEIGHT;
  }

  // Points the opponent's own forecast loses if they can't place sp any more (Hard).
  function oppSpeciesLoss(p, sp) {
    const O = state.players[other(p)];
    const key = [state.round, cur() && cur().k, O.book.join(), O.blocked.join(), O.coins, O.diamonds, sp].join('|');
    const memo = aiCtx.oppLoss || (aiCtx.oppLoss = new Map());
    if (memo.has(key)) return memo.get(key);
    if (memo.size > 200) memo.clear();
    const saved = aiCtx.targets;
    aiCtx.targets = [];
    const tl = aiTimeline(cur() ? cur().k : null);
    const m = aiModel(other(p), 0);
    const withIt = aiEval(m, tl);
    m.book = m.book.filter((x) => x !== sp);
    const loss = Math.max(0, withIt - aiEval(m, tl));
    aiCtx.targets = saved;
    memo.set(key, loss);
    return loss;
  }

  function trexHarm(p) {
    const O = state.players[other(p)];
    const opts = trexOptions(p);
    if (!opts.length) return 0;
    if (tune().proj) return Math.max(...opts.map((sp) => oppSpeciesLoss(p, sp))) * TREX_WEIGHT;
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

  function fenceBetween(b, i, j) {
    const lo = Math.min(i, j);
    return Math.abs(i - j) === N ? !!b.h[lo] : !!b.v[Math.floor(lo / N) * 9 + (lo % N)];
  }

  function growFrom(start, free, size, b) {
    const out = [start];
    const seen = new Set([start]);
    for (let q = 0; q < out.length && out.length < size; q++) {
      for (const j of orthNbrs(out[q])) {
        if (free.has(j) && !seen.has(j) && !orthNbrs(j).some((x) => seen.has(x) && fenceBetween(b, x, j))) {
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
    const mixing = !!sp && !!state.proto && protoKnownGoals().includes('mixed');
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
        const cells = growFrom(start, free, size, b);
        if (!cells) return;
        const rs = cells.map((i) => Math.floor(i / N));
        const cs = cells.map((i) => i % N);
        const box = (Math.max(...rs) - Math.min(...rs) + 1) * (Math.max(...cs) - Math.min(...cs) + 1);
        let score = (sp && cp.species.has(sp) ? 30 : 0) + cp.prod * 2 - (cp.empty - size) * 0.4 - (box - size) * 0.6 - (cp.inactive ? 20 : 0);
        if (mixing && cp.species.size === 1 && !cp.species.has(sp)) score += 25;
        if (sp === 'compy') score += cells.reduce((s, i) => s + orthNbrs(i).filter((j) => { const it = b.items[b.cells[j]]; return it && it.species === 'compy'; }).length * 6, 0);
        if (!best || score > best.score) best = { cells, score };
      });
    });
    return best ? best.cells : null;
  }

  // Six squares for a watering hole that leave the biggest connected space for the next dino.
  function aiWaterCells(b, cp) {
    const free = new Set(cp.cells.filter((i) => b.cells[i] === 0));
    let best = null;
    const tried = new Set();
    free.forEach((start) => {
      const cells = growFrom(start, free, 6, b);
      if (!cells) return;
      const key = cells.slice().sort((x, y) => x - y).join();
      if (tried.has(key)) return;
      tried.add(key);
      const rest = new Set([...free].filter((i) => !cells.includes(i)));
      let biggest = 0;
      const seen = new Set();
      rest.forEach((i) => {
        if (seen.has(i)) return;
        let n = 0;
        const stack = [i];
        seen.add(i);
        while (stack.length) {
          const x = stack.pop();
          n++;
          orthNbrs(x).forEach((j) => { if (rest.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); } });
        }
        biggest = Math.max(biggest, n);
      });
      const rs = cells.map((i) => Math.floor(i / N));
      const cs = cells.map((i) => i % N);
      const box = (Math.max(...rs) - Math.min(...rs) + 1) * (Math.max(...cs) - Math.min(...cs) + 1);
      const score = biggest * 2 - (box - 6);
      if (!best || score > best.score) best = { cells, score, biggest };
    });
    return best;
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
      const size = bill <= 0 ? 0 : Math.min(5, cp.empty, tune().feed2 ? 5 : bill);
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
    v += 2 * microEncl;
    v += triAlive * m.triPlants * 1.5;
    v += m.diamonds * 3;

    if (T.proj) {
      if (tl.feeds) v += Math.min(m.foodLeft || 0, 6) * 0.05;
      const pens = aiVirtualPens(b);
      const run = (extra, pen, force) => aiForecast(m, an, tl, keep, food, { micro, microEncl, pachy }, extra, pen, force);
      let lift = 0;
      const fc = (extra) => {
        let bestPen = null;
        let bv = run(extra, null);
        pens.forEach((pen) => {
          const v = run(extra, pen);
          if (v > bv) { bv = v; bestPen = pen; }
        });
        if (!aiCtx.deep) return bv;
        // Deep: also try the runner-up first moves of the play-out instead of only the greedy one.
        // Possible draws reuse the no-draw gain so a draw costs one play-out per species, not eight.
        if (extra) return bv + lift;
        const greedy = bv;
        DEEP_FORCES.forEach((fz) => { bv = Math.max(bv, run(extra, bestPen, fz)); });
        lift = bv - greedy;
        return bv;
      };
      let f = fc(null) * FORECAST_TRUST;
      if (m.pendingDeck && state.deck.length) {
        // Expected forecast over what the draw could be, weighted by the copies left in the deck.
        const counts = {};
        state.deck.forEach((sp) => { counts[sp] = (counts[sp] || 0) + 1; });
        let sum = 0;
        let dup = 0;
        Object.keys(counts).forEach((sp) => {
          if (m.book.includes(sp)) dup += counts[sp];
          else sum += counts[sp] * fc(sp);
        });
        f = ((sum + dup * f / FORECAST_TRUST) / state.deck.length) * FORECAST_TRUST;
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
  function aiForecast(m, an, tl, keep, food0, base, extraSp, pen, force) {
    const T = tune();
    const strat = T.strat ? HARD_STRATS[aiCfg().strat] : null;
    const smul = (sp) => (strat && strat.sp[sp]) || 1;
    const encl = [];
    an.comps.forEach((cp) => {
      if (!cp.valid || cp.dead) return;
      const w = cp.living.length ? keep.get(cp.key) : 1;
      if (w < 0.35) return;
      const e = { empty: cp.empty, species: new Set(cp.species), slots: 1 + cp.waters.length, prod: cp.prod, w, asleep: cp.inactive > 0, compy: 0, micro: false, para: 0, tri: false, allo: false, raptor: 0,
        bill: cp.living.reduce((t, d) => t + SPECIES[d.species].food.n, 0), disc: cp.feederSquares };
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
    const newPen = (size) => ({ empty: size, species: new Set(), slots: 1, prod: 0, w: 1, asleep: false, compy: 0, micro: false, para: 0, tri: false, allo: false, raptor: 0, bill: 0, disc: 0 });
    if (pen) encl.push(newPen(pen.size));
    // Open land left for enclosures the forecast fences on demand later.
    let open = an.comps.reduce((sum, cp) => sum + (cp.valid ? 0 : cp.empty), 0) - (pen ? pen.size : 0);

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
    let dk = 0;
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
      const spendV = left > 0 && coins < 6 * (left + 1) ? 0.5 : 0;
      // Coins kept to the end are worth 1/5 point per Pachy, so with enough Pachys they beat buying diamonds.
      const lam = T.bank ? Math.max(spendV, pachy / 5) : spendV;
      let pick = null;
      const cands = force && dk < force.length ? [] : null;
      const consider = (score, acts, apply) => {
        if (cands) {
          if (score > 0) cands.push({ score, acts, apply });
        } else if (!pick || score / acts > pick.score / pick.acts) pick = { score, acts, apply };
      };
      if (left > 0) consider(2 * lam, 1, () => { coins += 2; });
      if (coins >= 6) consider(3 - 6 * lam, 1, () => { coins -= 6; dia++; pts += 3; });
      encl.forEach((e) => {
        if (e.w < 0.6) return;
        if (e.para) consider(2 * e.para * lam, 1, () => { coins += 2 * e.para; });
        if (e.tri) consider(1.5, 1, () => { pts += 1.5; });
        if (e.allo) consider(3 * lam + 0.7, 1, () => { coins += 3; });
        if (e.raptor) consider(0.6 * e.raptor, 1, () => { ff += 2 * e.raptor; });
        // A feeder covering the part of this enclosure's bill not yet discounted.
        const k = e.bill - e.disc > 0 ? Math.min(5, e.empty, T.feed2 ? 5 : e.bill - e.disc) : 0;
        const fMissing = dia >= 1 ? 0 : 1;
        if (k > 0 && feedsLeft >= 1 && coins >= 3 + 6 * fMissing && 1 + fMissing <= left + 1) {
          const saved = Math.min(k, e.bill - e.disc) * Math.floor(feedsLeft);
          consider(saved * 0.25 - (3 + 6 * fMissing) * lam - (1 - fMissing) * 3, 1 + fMissing, () => {
            coins -= 3 + 6 * fMissing;
            dia += fMissing - 1;
            ff += saved;
            e.disc += k;
            e.empty -= k;
          });
        }
      });
      book.forEach((sp) => {
        const S = SPECIES[sp];
        const need = S.food.n * feedsLeft;
        const gainFood = EVENT_FOOD[sp] || 0;
        let feedNeed = need;
        let cyc = false;
        let starving = false;
        if (need > 0 && !canFeed(S.food.t, need - gainFood)) {
          // Can't feed it every time: feed it every few Feedings instead (surcharge, less production).
          feedNeed = (S.food.n + 2) * Math.ceil(feedsLeft / 3.5);
          if (canFeed(S.food.t, feedNeed - gainFood)) cyc = true;
          else if (T.feed2) starving = true;
          else return;
        }
        const missing = Math.max(0, S.cost.d - dia);
        const acts = 1 + missing;
        if (acts > left + 1) return;
        const coinCost = S.cost.c + 6 * missing;
        if (coins < coinCost) return;
        const place = (e, fenceActs, size) => {
          if (acts + fenceActs > left + 1) return;
          if (e.empty < S.space) return;
          // A full enclosure can still take a new species by adding a watering hole first.
          let wActs = 0;
          let wCoins = 0;
          let wDia = 0;
          if (!e.species.has(sp) && e.species.size >= e.slots) {
            if (!T.big || e.empty < S.space + WATER_SQUARES) return;
            const wMissing = Math.max(0, S.cost.d + WATER_COST.d - dia) - missing;
            wActs = 1 + wMissing;
            wCoins = WATER_COST.c + 6 * wMissing;
            wDia = WATER_COST.d - wMissing;
            if (acts + wActs + fenceActs > left + 1 || coins < coinCost + wCoins) return;
          }
          // When the park can't feed it, a feeder in the same enclosure can: it takes food off every Feeding.
          const spare = T.feed2 ? Math.max(0, e.disc - e.bill) : 0;
          const needHere = Math.max(0, S.food.n - spare) * feedsLeft;
          const coveredHere = spare > 0 && canFeed(S.food.t, needHere - gainFood);
          let fK = 0;
          let fSaved = 0;
          let fActs = 0;
          let fCoins = 0;
          let fDia = 0;
          if (T.feed2 && (starving || cyc) && !coveredHere && feedsLeft >= 1) {
            // Feeders cost the same up to 5 squares, so build the full 5 when there's room for later dinos too.
            const k = Math.min(5, e.empty - S.space - (wActs ? WATER_SQUARES : 0));
            const saved = Math.min(k, e.bill + S.food.n - e.disc) * Math.floor(feedsLeft);
            if (k > 0 && canFeed(S.food.t, need - gainFood - saved)) {
              const fMissing = dia - (S.cost.d - missing) - wDia >= 1 ? 0 : 1;
              fK = k;
              fSaved = saved;
              fActs = 1 + fMissing;
              fCoins = 3 + 6 * fMissing;
              fDia = 1 - fMissing;
            }
          }
          if (starving && !fK && !coveredHere) return;
          if (fK && (acts + wActs + fActs + fenceActs > left + 1 || coins < coinCost + wCoins + fCoins)) return;
          const cycHere = cyc && !fK && !coveredHere;
          let got = S.pts;
          if (sp === 'compy') got += COMPY_ADJ[Math.min(3, e.compy)];
          if (sp === 'microraptor' && !e.micro) got += 2;
          const newBest = e.w >= 0.6 && !cycHere ? Math.max(best, e.prod + S.prod) : best;
          // Gigantoraptor's bonus is worth an extra Production from the best enclosure next round.
          const eventPts = sp === 'gigantoraptor' && T.giga
            ? (roundsLeft > 0 ? Math.max(EVENT_PTS.gigantoraptor, newBest * BONUS_COIN_VALUE) : 0) : EVENT_PTS[sp] || 0;
          got = got * e.w * (cycHere ? 0.85 : 1) + eventPts;
          // After the last Feeding a Pachy eats nothing and scores the coins Hard will end with.
          const pachyPts = sp !== 'pachy' ? 0 : T.bank && feedsLeft < 1
            ? e.w * Math.max(0, coins - coinCost - wCoins - fCoins + best * roundsLeft) / 5 : 2;
          const score = got * smul(sp) + (newBest - best) * roundsLeft * (T.big ? Math.max(PROD_GROWTH, lam) : 0.45) + (EVENT_COINS[sp] || 0) * lam + gainFood * 0.05 +
            pachyPts + Math.max(0, fSaved - need) * FEEDER_FOOD - (coinCost + wCoins + fCoins) * lam - (S.cost.d - missing + wDia + fDia) * 3;
          consider(score, acts + wActs + fActs + fenceActs, () => {
            if (aiCtx.planLog) aiCtx.planLog.push(sp);
            if (size) { encl.push(e); open -= size; }
            if (wActs) {
              e.slots++;
              e.empty -= WATER_SQUARES;
              coins -= wCoins;
              dia -= wDia;
            }
            if (fK) {
              e.disc += fK;
              e.empty -= fK;
              ff += fSaved;
              coins -= fCoins;
              dia -= fDia;
            }
            coins -= coinCost;
            coins += EVENT_COINS[sp] || 0;
            dia += missing - S.cost.d;
            pts += got;
            ff += gainFood;
            payFeed(S.food.t, fK ? need : coveredHere ? needHere : feedNeed);
            e.empty -= S.space;
            e.species.add(sp);
            e.prod += S.prod;
            e.bill += S.food.n;
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
        };
        encl.forEach((e) => place(e, 0, 0));
        // Or fence a fresh enclosure for it on open land (rough fence count for a pen against existing edges).
        const size = Math.min(open, S.space * 2);
        if (size >= S.space) place(newPen(size), Math.ceil(Math.round(1.5 * Math.sqrt(size) + 2) / 2), size);
      });
      if (cands) {
        cands.sort((x, y) => y.score / y.acts - x.score / x.acts);
        pick = cands[force[dk]];
        if (!pick) return -Infinity;
      }
      dk++;
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
    const spaces = [...new Set(book.map((sp) => spec(sp).space))];
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
    // See which dinos the forecast wants to play, and fence enclosures that fit those.
    aiCtx.planLog = [];
    const base = aiEval(m0, tl);
    const wanted = [...new Set(aiCtx.planLog)].slice(0, 2);
    aiCtx.planLog = null;
    // Each game leans toward building in a different corner of the park.
    const anchor = tune().strat ? aiCfg().anchor : null;
    const lean = (c) => {
      if (anchor == null) return 0;
      const ar = anchor & 1 ? N - 1 : 0;
      const ac = anchor & 2 ? N - 1 : 0;
      const d = Math.abs(c.r0 + (c.h - 1) / 2 - ar) + Math.abs(c.c0 + (c.w - 1) / 2 - ac);
      return 0.4 * (1 - d / 18);
    };
    const found = [];
    aiTargetCands(b, wanted.length ? wanted : m0.book).forEach((c) => {
      if (fenceProblem(b, c.need)) return;
      const m2 = copyModel(m0);
      applyEdges(m2.board, c.need);
      m2.actsPenalty = Math.ceil(c.need.length / 2);
      const gain = (aiEval(m2, tl) - base) * 0.8 - 0.25 * c.need.length + lean(c);
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
      const legal = new Set(legalEdgesB(b));
      return out.filter((e) => legal.has(e));
    }
    return aiPlanEdgesB(b, max);
  }

  function aiEvent(m, sp, tl) {
    switch (sp) {
      case 'stegosaurus': addFood(m, 10); break;
      case 'carnotaurus': addFood(m, 14); break;
      case 'brachiosaurus': m.extra += fillHarm(m.p, 5); break;
      case 'trex': m.extra += trexHarm(m.p); break;
      case 'gigantoraptor':
        if (tl.future > 0) m.extra += tune().giga ? Math.max(3, bestProdB(m.board) * BONUS_COIN_VALUE) : 3;
        break;
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
    if (tune().water && affordM(m, WATER_COST) && m.book.length) {
      const minSpace = Math.min(...m.book.map((sp) => spec(sp).space));
      analyze(b).comps.forEach((cp) => {
        if (!cp.valid || cp.dead || !cp.living.length || cp.species.size < 1 + cp.waters.length || cp.empty < 6 + minSpace) return;
        const w = aiWaterCells(b, cp);
        if (w && w.biggest >= minSpace) out.push({ kind: 'water', cells: w.cells });
      });
    }
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
      case 'gain3': n.coins += 2; break;
      case 'diamond': n.coins -= 6; n.diamonds++; break;
      case 'fences': applyEdges(n.board, a.edges); break;
      case 'feeder': payM(n, feederCost(a.cells.length)); placeItemB(n.board, 'feeder', a.cells); break;
      case 'water': payM(n, WATER_COST); placeItemB(n.board, 'water', a.cells); break;
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
    const strat = tune().strat ? HARD_STRATS[aiCfg().strat] : null;
    const bonus = (a) => styleBias(a) + noise(tune().noise) + (tune().proj && a.kind === 'play' ? PLAY_PRIORITY : 0) +
      (a.kind === 'water' && strat && strat.water ? strat.water : 0);
    const scored = aiActions(m0, tl).map((a) => {
      const m1 = aiApply(m0, a, tl);
      return { a, m1, v: aiEval(m1, tl), b: bonus(a) };
    });
    // Only the most promising first actions get a second-action search.
    const wide = tune().prune ? scored.slice().sort((x, y) => y.v + y.b - x.v - x.b).slice(0, tune().prune) : scored;
    scored.forEach((x) => { x.end = x.m1; });
    wide.forEach((x) => {
      if (depth < 2 || x.m1.actsLeft <= 0) return;
      aiActions(x.m1, tl).forEach((a2) => {
        const m2 = aiApply(x.m1, a2, tl);
        const v2 = aiEval(m2, tl);
        if (v2 > x.v) { x.v = v2; x.end = m2; }
      });
    });
    scored.forEach((x) => { x.v += x.b; });
    if (tune().deep && scored.length > 1) {
      // Look further ahead on the most promising few before committing.
      const top = scored.sort((x, y) => y.v - x.v).slice(0, 5);
      aiCtx.deep = true;
      try {
        top.forEach((x) => { x.v = aiEval(x.end, tl) + bonus(x.a); });
      } finally {
        aiCtx.deep = false;
      }
      return pickBest(top).a;
    }
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
    const costOf = (keys) => sumCosts(list.filter((cp) => keys.has(cp.key)).map(enclosureCost));
    // Feeding is never worth skipping: feed everything when the food covers it.
    const all = new Set(list.map((cp) => cp.key));
    if (canPayFood(P, costOf(all))) return all;
    if (aiCfg().level === 'easy') return defaultFeed(p);
    // Otherwise only consider choices that leave no affordable enclosure unfed.
    const full = (keys) => list.every((cp) => keys.has(cp.key) || !canPayFood(P, costOf(new Set(keys).add(cp.key))));
    const tl = aiTimeline(T.k);
    const score = (keys) => {
      const tot = costOf(keys);
      if (!canPayFood(P, tot) || !full(keys)) return -Infinity;
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
        if (keys.has(cp.key)) return;
        keys.forEach((k) => {
          const sw = new Set(keys);
          sw.delete(k);
          sw.add(cp.key);
          list.forEach((x) => { if (!sw.has(x.key) && canPayFood(P, costOf(new Set(sw).add(x.key)))) sw.add(x.key); });
          const tv = score(sw);
          if (tv > v + 1e-6) { v = tv; keys = sw; improved = true; }
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
    if (state.sim) return ms * SIM_SPEEDS[state.sim.speed].mult;
    return ms * PACE_MULT[aiCfg().pace];
  }

  // If Hard's planning throws, play this step like Medium instead of freezing the game.
  let aiSafe = false;

  function aiRun(T) {
    try {
      aiStep(T);
    } catch (e) {
      console.error('Computer move failed; retrying with simpler play.', e);
      if (aiPending || aiSafe) return;
      aiSafe = true;
      try {
        aiStep(T);
      } finally {
        aiSafe = false;
      }
    }
  }

  function aiSchedule() {
    if (aiTimer || aiPending || busy) return;
    const T = cur();
    if (!isAiTask(T)) return;
    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (busy || aiPending) { aiSchedule(); return; }
      const now = cur();
      aiThinkAt = performance.now();
      if (isAiTask(now)) aiRun(now);
    }, aiDelay(T.t === 'roll' || T.t === 'gainFood' ? 600 : 300));
  }

  // Time spent deciding counts toward the pause, so harder levels don't take longer turns.
  let aiThinkAt = 0;

  // Follow-up choices inside an action (a dino's event, picking food) get a shorter pause.
  const AI_FOLLOW_MS = 550;

  function aiShow(note, then, ms = 900) {
    const token = state;
    const spent = aiThinkAt ? performance.now() - aiThinkAt : 0;
    aiThinkAt = 0;
    ui.aiNote = note;
    aiPending = true;
    render();
    setTimeout(() => {
      aiPending = false;
      if (state !== token) return;
      then();
    }, Math.max(aiDelay(250), aiDelay(ms) - spent));
  }

  // Recheck planned squares on the real board; a plan that can't be placed must not stall the turn.
  function aiFixCells(sp) {
    if (validateSel().ok) return true;
    const alt = ui.sel.breed ? protoBreedCells(ui.sel.board, sp, true) : aiFindCellsB(state.players[ui.sel.board].board, spec(sp).space, sp);
    if (!alt) return false;
    ui.sel.cells = new Set(alt);
    return validateSel().ok;
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
    if (!aiFixCells(sp)) {
      handle('back', {});
      if (free) { handle('skip', {}); return; }
      handle('back', {});
      handle('mode', { m: 'gain3' });
      return;
    }
    document.getElementById('boards')._html = null;
    aiShow(`Playing ${spName(sp)}${free ? ' for free' : ''}…`, () => handle('place', {}));
  }

  // ---------------------------------------------------------------- prototype computer player
  // A one-step greedy player for the prototype rules: it scores each open worker space by rough point
  // value and takes the best. Lower levels add more random noise.
  const PROTO_POWER = { trex: 3, gigantoraptor: 2, spinosaurus: 4, dilophosaurus: 4, stegosaurus: 2.5, brachiosaurus: 2, carnotaurus: 2.5, ankylosaurus: 3 };

  function protoNoise() {
    const lv = aiCfg().level;
    return noise(lv === 'easy' ? 2.5 : lv === 'medium' ? 1 : 0.2);
  }

  function protoRoundsLeft() {
    return rounds() - state.round + 1;
  }

  // Each coin kept to the end is worth a share of a point per Pachy, so Pachy owners value coins more.
  function protoCoinValue(p) {
    const left = protoRoundsLeft();
    const goal = protoKnownGoals().includes('coins') ? 1 / 6 : 0;
    if (p == null) return (left <= 1 ? 0.1 : left <= 3 ? 0.3 : 0.5) + goal;
    const P = state.players[p];
    // Leftover coins stop scoring at 30, so a pile bigger than that is worth less unless it's spent.
    const spare = clamp((P.coins - 30) / 10, 0, 1);
    const base = (left <= 1 ? 0.1 : left <= 3 ? 0.3 : 0.5) * (1 - 0.75 * spare);
    const pachys = Object.values(P.board.items).filter((it) => it.species === 'pachy' && !it.dead).length;
    return base + goal + pachys / PROTO_PACHY_COINS;
  }

  // What spending one diamond costs in points: buying it back (a Gems turn) if a wanted card still needs it,
  // otherwise just what it scores at the end.
  function protoDiamondPts(p) {
    const P = state.players[p];
    const cv = protoCoinValue(p);
    const end = 1 + (protoKnownGoals().includes('gems') ? PROTO_GEM_PTS : 0);
    const want = protoRoundsLeft() > 1 && state.faceUp.concat(P.hand).some((sp) => sp && !P.blocked.includes(sp) && protoCost(sp).d >= P.diamonds);
    return Math.max(end, want ? 5 * cv + 1 : 0);
  }

  // Food still missing for this round's Feeding.
  function protoFoodShort(p) {
    const P = state.players[p];
    const d = demandOf(P.board);
    // Meat can't feed plant eaters (or the reverse), so count each kind's shortfall on its own.
    const needM = Math.max(0, d.meat - P.meat);
    const needP = Math.max(0, d.plant - P.plants);
    const left = Math.max(0, P.meat - d.meat) + Math.max(0, P.plants - d.plant);
    return needM + needP + Math.max(0, d.flex - left);
  }

  // Food of the kind `sp` eats that's left after this round's Feeding.
  function protoFoodSpare(p, sp) {
    const P = state.players[p];
    const d = demandOf(P.board);
    const t = SPECIES[sp].food.t;
    const m = P.meat - d.meat;
    const pl = P.plants - d.plant;
    const both = Math.max(0, m) + Math.max(0, pl) - d.flex;
    if (t === 'meat') return Math.min(m, both);
    if (t === 'plant') return Math.min(pl, both);
    return both;
  }

  // The computer only knows the goals revealed so far, and plays for them as they stand right now.
  function protoKnownGoals() {
    return (state.goals || []).slice(0, protoGoalsShown());
  }

  function protoGoalScore(p, b, extra) {
    const ids = protoKnownGoals();
    if (!ids.length) return 0;
    const ctx = protoGoalCtx(state.players[p], b, extra);
    return ids.reduce((s, id) => s + PROTO_GOALS[id].pts(ctx), 0);
  }

  // Goal points gained by changing a copy of the player's board (placing a dino, feeder, ...).
  function protoGoalGain(p, change) {
    const b = state.players[p].board;
    if (!protoKnownGoals().length) return 0;
    const b2 = cloneBoard(b);
    change(b2);
    return protoGoalScore(p, b2) - protoGoalScore(p, b);
  }

  function protoDinoValue(p, sp, cells) {
    const P = state.players[p];
    const S = spec(sp);
    const an = analyze(P.board);
    const goals = cells ? protoGoalGain(p, (b2) => placeItemB(b2, 'dino', cells, sp)) : protoGoalScore(p, P.board, [sp]) - protoGoalScore(p, P.board);
    const left = protoRoundsLeft();
    let power = PROTO_POWER[sp] || 0;
    if (sp === 'gigantoraptor' && left <= 1) power = 0;
    if (sp === 'parasaurolophus' || sp === 'allosaurus') power = left * 0.4;
    if (sp === 'velociraptor') power = left * 0.3;
    if (sp === 'triceratops') power = left * 0.3;
    if (sp === 'pachy') power = (P.coins + left * 3) / PROTO_PACHY_COINS;
    if (sp === 'microraptor') power = 1.5;
    // Only one enclosure pays each round, so production counts by how much it lifts the best one.
    const top = bestProdB(P.board);
    const home = an.comps.filter((cp) => cp.valid && !cp.dead && cp.species.has(sp)).reduce((m, cp) => Math.max(m, cp.prod), 0);
    const coins = Math.max(S.prod * 0.35, home + S.prod - top) * left * protoCoinValue(p) * 0.6;
    const food = S.food.n * left * 0.35;
    return S.pts + goals + power + coins - food;
  }

  const PROTO_FOOD_INCOME = 5;

  // Feeding is every round, so weigh a new dino's bill against roughly what one player gathers per round.
  function protoHunger(p, sp, spare) {
    const b = state.players[p].board;
    const n = SPECIES[sp].food.n;
    const deficit = Math.max(0, demandOf(b).total + n - PROTO_FOOD_INCOME);
    return Math.max(0, n - Math.max(0, spare)) * 0.8 + Math.min(deficit, n) * protoRoundsLeft() * 0.6;
  }

  // A card's price in points: coins at their current worth, and each missing diamond costs a Gems turn.
  function protoPricePts(p, sp, cost) {
    const c = cost || protoCost(sp);
    const cv = protoCoinValue(p);
    const needD = Math.max(0, c.d - state.players[p].diamonds);
    return c.c * cv + needD * (5 * cv + 1.5);
  }

  function protoBestBuy(p, freeTask, extra, breed) {
    const P = state.players[p];
    const b = P.board;
    const an = analyze(b);
    const left = protoRoundsLeft();
    const grown = left - PROTO_BABY_FEEDS;
    let best = null;
    (breed ? protoBreedOptions(p, extra) : protoPlayOptions(p, freeTask, extra)).filter((o) => o.ok).forEach((o) => {
      const cells = breed ? protoBreedCells(p, o.sp, true) : aiFindCellsB(b, spec(o.sp).space, o.sp);
      if (!cells) return;
      const hungry = protoHunger(p, o.sp, protoFoodSpare(p, o.sp));
      let value;
      if (breed) {
        // A baby takes PROTO_BABY_FEEDS Feedings to grow up and scores half until then, so it's worth less
        // near the end, but it's much cheaper than buying the card.
        const saved = Math.max(0, protoPricePts(p, o.sp) - protoPricePts(p, o.sp, breedCost(o.sp)));
        value = (protoDinoValue(p, o.sp) * 0.7 + saved * 0.4) * (grown >= 1 ? 1 : grown >= 0 ? 0.6 : 0.35);
      } else {
        // Completing an adult pair opens up cheap eggs while there's still time for them to grow up.
        const home = an.comps[an.compOf[cells[0]]];
        const pair = grown >= 2 && home && home.living.filter((d) => d.species === o.sp && isAdult(d)).length === 1 ? 1.5 : 0;
        value = protoDinoValue(p, o.sp, cells) + pair;
      }
      const v = value - hungry * (breed ? 0.5 : 1) - (extra || 0) * protoCoinValue(p) + protoNoise();
      if (!best || v > best.v) best = Object.assign({}, o, { cells, v });
    });
    return best;
  }

  function protoBuilderPick(p, extra) {
    const P = state.players[p];
    const b = P.board;
    const an = analyze(b);
    const x = extra || 0;
    let best = null;
    an.comps.filter((cp) => cp.valid && !cp.dead && cp.living.length && cp.empty > 0).forEach((cp) => {
      const bill = enclosureCost(cp).total;
      const size = Math.min(cp.empty, bill, Math.max(0, P.coins - x));
      if (size <= 0 || !canAfford(P, withExtra(feederCost(size), x))) return;
      const cells = aiFindCellsB(b, size, null, cp.key);
      if (!cells) return;
      const dia = feederCost(size).d * protoDiamondPts(p);
      const v = size * protoRoundsLeft() * 0.35 - (size + x) * protoCoinValue(p) - dia + protoGoalGain(p, (b2) => placeItemB(b2, 'feeder', cells));
      if (!best || v > best.v) best = { item: 'feeder', cells, v };
    });
    if (canAfford(P, withExtra(waterCost(), x))) {
      // With a watering-hole goal revealed, any enclosure with dinos and room is worth digging in.
      const known = protoKnownGoals();
      const forGoal = known.some((id) => id === 'water' || id === 'mixed');
      an.comps.filter((cp) => cp.valid && !cp.dead && (forGoal ? cp.living.length && cp.empty >= WATER_SQUARES : cp.species.size >= 1 + cp.waters.length && cp.empty >= 9)).forEach((cp) => {
        const w = aiWaterCells(b, cp);
        if (!w || (!forGoal && w.biggest < 3)) return;
        if (!forGoal && protoRoundsLeft() <= 1) return;
        const mixing = known.includes('mixed') && cp.species.size === 1 && !cp.waters.length && w.biggest >= 2 ? 2 : 0;
        const dia = waterCost().d * protoDiamondPts(p) - 1;
        const v = 2.5 + mixing + (protoRoundsLeft() > 3 ? 1 : 0) - (2 + x) * protoCoinValue(p) - dia + protoGoalGain(p, (b2) => placeItemB(b2, 'water', w.cells));
        if (!best || v > best.v) best = { item: 'water', cells: w.cells, v };
      });
    }
    return best;
  }

  // A reserved card only scores if it gets played. Most plays come straight from the market, so only a
  // few held cards are useful, and fewer as rounds run out.
  function protoHandRoom(p, more) {
    const held = state.players[p].hand.length + (more || 0);
    return Math.max(0, 1 - held / Math.max(1, (protoRoundsLeft() - 1) * 0.4));
  }

  // Reserve choices, best first: what playing the card would be worth after its food bill and price
  // (missing diamonds included), and only part of that since it could be bought from the market anyway.
  // An unknown deck card is a small gamble.
  function protoScoutPicks(p) {
    const P = state.players[p];
    const O = state.players[other(p)];
    const out = state.deck.length ? [{ from: 'deck', v: 0.5 }] : [];
    state.faceUp.forEach((sp, i) => {
      if (!sp) return;
      const mine = P.blocked.includes(sp) ? 0 : Math.max(0, protoDinoValue(p, sp) - protoHunger(p, sp, protoFoodSpare(p, sp)) - protoPricePts(p, sp, playCost(sp, 'h'))) * 0.4;
      const denial = aiCfg().level === 'hard' && canAfford(O, protoCost(sp)) && !O.blocked.includes(sp) ? Math.max(0, protoDinoValue(other(p), sp) - protoPricePts(other(p), sp)) * 0.1 : 0;
      out.push({ from: i, v: mine + denial });
    });
    return out.sort((a, b) => b.v - a.v);
  }

  function protoScoutPick(p) {
    return protoScoutPicks(p)[0] || null;
  }

  // Fences chosen fresh every turn: enclose the best rectangle of open land for a dino the computer
  // could buy now (market or hand), finishing it this turn if the fences allow.
  function protoFencePlan(p, max) {
    const P = state.players[p];
    const b = P.board;
    if (max <= 0) return { edges: [], v: 0 };
    const known = protoKnownGoals();
    const spare = analyze(b).comps.filter((cp) => cp.valid && !cp.dead && !cp.inactive).map((cp) => cp.empty);
    const wants = [...new Set(state.faceUp.concat(P.hand).filter(Boolean))].filter((sp) => !P.blocked.includes(sp)).map((sp) => {
      const space = spec(sp).space;
      let v = Math.max(0.5, protoDinoValue(p, sp)) * (canAfford(P, protoCost(sp)) ? 1 : 0.6);
      if (spare.some((n) => n >= space)) v *= 0.35;
      return { space, v };
    });
    if (!wants.length) wants.push({ space: 4, v: 2 });
    const waste = known.includes('full') ? 0.35 : 0.2;
    const fit = (area) => {
      let best = -Infinity;
      wants.forEach((w) => { if (w.space <= area) best = Math.max(best, w.v - (area - w.space) * waste); });
      return best + (known.includes('roomy') && area >= 12 ? 1 : 0);
    };
    let edges = [];
    let v = 0;
    for (let pass = 0; pass < 3 && edges.length < max; pass++) {
      const pen = protoBestPen(withEdges(b, edges), max - edges.length, fit);
      if (!pen || pen.v <= 0) break;
      const add = pen.need.slice(0, max - edges.length);
      if (fenceProblem(b, edges.concat(add))) break;
      edges = edges.concat(add);
      v += pen.v;
      if (pen.partial) break;
    }
    return { edges, v };
  }

  function protoBestPen(b, budget, fit) {
    const an = analyze(b);
    const legal = new Set(legalEdgesB(b));
    let best = null;
    for (let r0 = 0; r0 < N; r0++) {
      for (let c0 = 0; c0 < N; c0++) {
        const home = an.compOf[r0 * N + c0];
        if (b.cells[r0 * N + c0] !== 0 || an.comps[home].valid) continue;
        for (let r1 = r0; r1 < N; r1++) {
          for (let c1 = c0; c1 < N; c1++) {
            const area = (r1 - r0 + 1) * (c1 - c0 + 1);
            if (area > 20) break;
            if ((r0 === 0) + (r1 === N - 1) + (c0 === 0) + (c1 === N - 1) > 2) continue;
            let ok = true;
            for (let r = r0; r <= r1 && ok; r++) {
              for (let c = c0; c <= c1 && ok; c++) {
                const i = r * N + c;
                if (b.cells[i] !== 0 || an.compOf[i] !== home || (c < c1 && b.v[r * 9 + c]) || (r < r1 && b.h[i])) ok = false;
              }
            }
            if (!ok) continue;
            const need = [];
            for (let c = c0; c <= c1; c++) {
              if (r0 > 0 && !b.h[(r0 - 1) * N + c]) need.push(`h${(r0 - 1) * N + c}`);
              if (r1 < N - 1 && !b.h[r1 * N + c]) need.push(`h${r1 * N + c}`);
            }
            for (let r = r0; r <= r1; r++) {
              if (c0 > 0 && !b.v[r * 9 + c0 - 1]) need.push(`v${r * 9 + c0 - 1}`);
              if (c1 < N - 1 && !b.v[r * 9 + c1]) need.push(`v${r * 9 + c1}`);
            }
            if (!need.length || need.some((e) => !legal.has(e))) continue;
            const f = fit(area);
            if (f <= 0) continue;
            const partial = need.length > budget;
            const v = partial ? f * 0.5 * (budget / need.length) - 0.2 : f - need.length * 0.1;
            if (!best || v > best.v) best = { need, v, partial };
          }
        }
      }
    }
    return best;
  }

  function protoSpacePlans(p) {
    const P = state.players[p];
    const b = P.board;
    const cv = protoCoinValue(p);
    const left = protoRoundsLeft();
    const out = [];
    const known = protoKnownGoals();
    Object.keys(PROTO_SPACES).forEach((k) => {
      if (!protoSpaceStatus(p, k).ok) return;
      const X = PROTO_SPACES[k];
      let plan = null;
      const wantGem = state.faceUp.concat(P.hand).some((sp) => protoCost(sp).d > P.diamonds) && left > 1;
      if (X.type === 'buy' || X.type === 'breed') {
        const buy = protoBestBuy(p, null, protoExtra(X), X.type === 'breed');
        if (buy) plan = { v: buy.v + 1, buy };
      } else if (X.type === 'coins') plan = { v: protoSpaceAmount(k) * cv + 0.4 };
      else if (X.type === 'gem') plan = { v: 1 + (wantGem ? 2 : 0) + (known.includes('gems') ? 0.75 * PROTO_GEM_PTS : 0) - gemCost(X) * cv * 0.7 };
      else if (X.type === 'forage') {
        const n = protoSpaceAmount(k);
        // Unfed enclosures score nothing at the end, so the last Feeding matters most.
        const short = protoFoodShort(p);
        let v = Math.min(n, short) * (left <= 1 ? 3 : 1.3) + 0.3 + n * 0.05;
        if (left > 1) {
          // Next round starts with only the die (about 3), so food carried over keeps enclosures fed.
          const d = demandOf(b).total;
          const over = Math.max(0, P.meat + P.plants - d);
          const next = Math.max(0, d - 3 - over);
          v += Math.min(Math.max(0, n - short), next) * 0.6;
        }
        plan = { v };
      } else if (X.type === 'fences') {
        const fp = protoFencePlan(p, protoSpaceAmount(k));
        if (fp.edges.length) plan = { v: fp.v * (left <= 1 ? 0.1 : 0.4) + fp.edges.length * 0.05 };
      } else if (X.type === 'build') {
        const bp = protoBuilderPick(p, protoExtra(X));
        if (bp) plan = { v: bp.v, build: bp };
      } else if (X.type === 'scout') {
        // Scouting forces the reserve, and cards it won't get to play just clog the hand.
        const picks = protoScoutPicks(p).slice(0, Math.min(scoutCards(X), handMax(P) - P.hand.length));
        const cards = picks.reduce((s, pk, n) => {
          const room = left > 1 ? protoHandRoom(p, n) : 0;
          return s + pk.v * 0.6 * room - 0.2 * (1 - room);
        }, 0);
        const first = X.first && left > 1 ? 0.45 : 0;
        const v = cards + (X.coin || 0) * cv + first;
        if (v > 0) plan = { v };
      }
      if (plan) out.push(Object.assign(plan, { k, v: plan.v + protoNoise() * 0.5 }));
    });
    return out.sort((a, b) => b.v - a.v);
  }

  // The last Feeding decides the score, and an unfed enclosure scores nothing whether it dies or not, so
  // feed whichever enclosures keep the most points (every combination, when there aren't too many).
  function protoLastFeed(p) {
    const P = state.players[p];
    const b = P.board;
    const list = feedables(analyze(b));
    if (list.length > 10) return defaultFeed(p);
    const costs = list.map(enclosureCost);
    const saved = b.inactive;
    let best = null;
    for (let mask = 0; mask < 1 << list.length; mask++) {
      const pick = list.filter((cp, i) => mask & (1 << i));
      if (!canPayFood(P, sumCosts(pick.map((cp) => costs[list.indexOf(cp)])))) continue;
      b.inactive = Object.assign({}, saved);
      list.forEach((cp, i) => { if (mask & (1 << i)) delete b.inactive[cp.key]; else b.inactive[cp.key] = (saved[cp.key] || 0) + 1; });
      const v = protoScore(p).total;
      if (!best || v > best.v) best = { v, keys: pick.map((cp) => cp.key) };
    }
    b.inactive = saved;
    return best ? new Set(best.keys) : defaultFeed(p);
  }

  function protoAiPlaceBuy(buy, free, space) {
    if (space) handle('space', { s: space });
    handle('pickSpecies', { sp: buy.sp, src: buy.src, i: String(buy.i) });
    if (!ui.sel) {
      if (free) handle('skip', {});
      else handle('endTurn', {});
      return;
    }
    ui.sel.cells = new Set(buy.cells);
    if (!aiFixCells(buy.sp)) {
      handle('back', {});
      if (free) { handle('skip', {}); return; }
      handle('back', {});
      handle('endTurn', {});
      return;
    }
    document.getElementById('boards')._html = null;
    aiShow(`Playing ${spName(buy.sp)}${free ? ' for free' : ''}…`, () => handle('place', {}));
  }

  function protoAiStep(T) {
    const p = T.p;
    const P = p != null ? state.players[p] : null;
    switch (T.t) {
      case 'roundStart': handle('startRound', {}); return true;
      case 'feed':
        ui.feed = protoRoundsLeft() <= 1 ? protoLastFeed(p) : defaultFeed(p);
        aiShow('Feeding…', () => handle('confirmFeed', {}));
        return true;
      case 'gainFood': {
        if (T.amount == null) return false;
        const n = T.amount;
        const short = protoFoodShort(p);
        const want = protoRoundsLeft() <= 2 ? n : Math.min(n, short + 1);
        const edges = protoFencePlan(p, n - want).edges;
        const food = n - edges.length;
        ui.meat = clamp(aiSplitFood(P.board, P.meat, P.plants, food), 0, food);
        ui.plant = food - ui.meat;
        ui.sel.edges = new Set(edges);
        document.getElementById('boards')._html = null;
        aiShow(`Taking ${food} food${edges.length ? ` and ${plural(edges.length, 'fence')}` : ''}…`, () => handle('confirmGain', {}));
        return true;
      }
      case 'foodChoice':
        ui.meat = clamp(aiSplitFood(P.board, P.meat, P.plants, T.amount), 0, T.amount);
        aiShow('Choosing food…', () => handle('confirmFood', {}), AI_FOLLOW_MS);
        return true;
      case 'drawFences':
        ui.sel.edges = new Set(protoFencePlan(p, T.count).edges);
        document.getElementById('boards')._html = null;
        aiShow('Building fences…', () => handle('confirmFences', {}), AI_FOLLOW_MS);
        return true;
      case 'drawCard': {
        const sc = protoScoutPick(p);
        if (!sc) { handle('skip', {}); return true; }
        aiShow('Reserving a card…', () => handle('take', { from: String(sc.from) }), AI_FOLLOW_MS);
        return true;
      }
      case 'spino': {
        const want = state.faceUp.concat(P.hand).some((sp) => protoCost(sp).d > P.diamonds);
        const o = protoFoodShort(p) >= 8 ? 'food' : want ? 'dia' : protoRoundsLeft() > 2 ? 'coins' : 'dia';
        aiShow('Spinosaurus: choosing a reward…', () => handle('spino', { o }), AI_FOLLOW_MS);
        return true;
      }
      case 'grow': {
        const it = P.board.items[T.id];
        const cells = it && ui.sel && growMore(P.board, it, growExtra(it));
        if (!cells) return false;
        ui.sel.cells = new Set(cells);
        document.getElementById('boards')._html = null;
        aiShow(`Baby ${spName(it.species)} is growing up…`, () => handle('place', {}), AI_FOLLOW_MS);
        return true;
      }
      case 'power':
        aiShow(`${spName(T.sp)}: ${powerEffect(T)[0]}…`, () => handle('usePower', {}), AI_FOLLOW_MS);
        return true;
      case 'freePlay': {
        const buy = protoBestBuy(p, T);
        if (!buy) { handle('skip', {}); return true; }
        protoAiPlaceBuy(buy, true);
        return true;
      }
      case 'trex': {
        // Block what the opponent is most likely to place: cards they hold or can afford now.
        const o = other(p);
        const O = state.players[o];
        const score = (sp) => protoDinoValue(o, sp) + (O.hand.includes(sp) ? 4 : 0) + (state.faceUp.includes(sp) && canAfford(O, protoCost(sp)) ? 3 : 0) + protoNoise();
        const sp = trexOptions(p).map((x) => ({ x, s: score(x) })).sort((a, b) => b.s - a.s)[0].x;
        aiShow(`T. Rex: blocking your ${spName(sp)}…`, () => handle('trex', { sp }), AI_FOLLOW_MS);
        return true;
      }
      case 'actions': {
        if (!T.work) return false;
        const plan = protoSpacePlans(p)[0];
        if (!plan) { aiShow('Passing', () => handle('endTurn', {})); return true; }
        const X = PROTO_SPACES[plan.k];
        if (plan.buy) { protoAiPlaceBuy(plan.buy, false, plan.k); return true; }
        if (plan.build) {
          handle('space', { s: plan.k });
          handle('shopItem', { item: plan.build.item });
          ui.sel.cells = new Set(plan.build.cells);
          document.getElementById('boards')._html = null;
          aiShow(plan.build.item === 'feeder' ? 'Building a feeder…' : 'Digging a watering hole…', () => handle('place', {}));
          return true;
        }
        ui.aiTarget = plan.k;
        aiShow(`Placing a worker on ${X.icon} ${X.name}`, () => handle('space', { s: plan.k }));
        return true;
      }
      default:
        return false;
    }
  }

  function aiStep(T) {
    const p = T.p;
    const panel = document.getElementById('panel');
    lastClickRect = panel ? panel.getBoundingClientRect() : null;
    if (state.proto && protoAiStep(T)) return;
    switch (T.t) {
      case 'roundStart':
        [0, 1].forEach((q) => { ui.picks[q] = aiBonusPicks(q); });
        handle('startRound', {});
        return;
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
        const best = produceChoices(T).sort((a, b) => b.prod - a.prod)[0];
        aiShow(`Collecting 🪙${best.prod} from enclosure ${best.name}…`, () => handle('produce', { key: best.key }));
        return;
      }
      case 'foodChoice': {
        const P = state.players[p];
        ui.meat = aiMeatPick(p, T.amount, 0, T.amount);
        aiShow('Choosing food…', () => handle('confirmFood', {}), AI_FOLLOW_MS);
        return;
      }
      case 'steal': {
        const P = state.players[p];
        const [lo, hi] = stealRange(T);
        ui.meat = aiMeatPick(p, T.amount, lo, hi);
        aiShow('Stealing food…', () => handle('confirmSteal', {}), AI_FOLLOW_MS);
        return;
      }
      case 'drawFences':
        aiPrepTargets(aiModel(p, 0), aiTimeline(T.k));
        ui.sel.edges = new Set(aiFenceEdges(state.players[p].board, T.count));
        document.getElementById('boards')._html = null;
        aiShow('Building fences…', () => handle('confirmFences', {}), AI_FOLLOW_MS);
        return;
      case 'fillOpp':
        ui.sel.cells = new Set(aiRubbleCells(other(p), ui.sel.need));
        document.getElementById('boards')._html = null;
        aiShow('Filling in your squares…', () => handle('place', {}), AI_FOLLOW_MS);
        return;
      case 'drawCard': {
        const from = aiDrawPick(p, T.source === 'deck');
        aiShow(from === 'deck' ? 'Drawing from the deck…' : `Taking ${spName(state.faceUp[from])}…`, () => handle('take', { from: String(from) }), AI_FOLLOW_MS);
        return;
      }
      case 'spino': {
        const o = aiSpinoPick(aiModel(p, 0), aiTimeline(T.k));
        const label = { dia: 'a diamond', coins: '5 coins', food: '15 food', fill: 'to fill your squares' }[o];
        aiShow(`Spinosaurus: choosing ${label}…`, () => handle('spino', { o }), AI_FOLLOW_MS);
        return;
      }
      case 'trex': {
        const O = state.players[other(p)];
        const onBoard = (sp) => Object.values(O.board.items).filter((it) => it.species === sp && !it.dead).length;
        const score = (sp) => (tune().proj ? oppSpeciesLoss(p, sp) : onBoard(sp) * 3 + SPECIES[sp].pts + (canAfford(O, SPECIES[sp].cost) ? 4 : 0)) + noise(tune().noise);
        const sp = trexOptions(p).map((x) => ({ x, s: score(x) })).sort((a, b) => b.s - a.s)[0].x;
        aiShow(`T. Rex: blocking your ${spName(sp)}…`, () => handle('trex', { sp }), AI_FOLLOW_MS);
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
        if (c.kind === 'water') {
          handle('mode', { m: 'shop' });
          handle('shopItem', { item: 'water' });
          ui.sel.cells = new Set(c.cells);
          document.getElementById('boards')._html = null;
          aiShow('Digging a watering hole…', () => handle('place', {}));
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
        aiShow('Taking 2 coins…', () => handle('mode', { m: 'gain3' }));
        return;
      }
      default:
        break;
    }
  }

  // ---------------------------------------------------------------- online play (Ahrens Labs accounts)
  const API_BASE = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
  const MODE_LABEL = { quick: '⚡ Quick', long: '🐢 Long' };
  const BASE_TITLE = document.title;
  let online = null;
  let lobby = { games: null, error: '', busy: false };
  let olMode = 'quick';
  let setupTouched = false;
  let authFailed = false;
  let sock = null;
  let sockPing = null;
  let sockRetry = null;
  let pollTimer = null;
  let clockSkew = 0;
  let moveChain = Promise.resolve();

  function sessionId() {
    try {
      return localStorage.getItem('ahrenslabs_sessionId') || '';
    } catch {
      return '';
    }
  }

  function myUsername() {
    try {
      return localStorage.getItem('ahrenslabs_username') || 'You';
    } catch {
      return 'You';
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
    } catch {
      return { ok: false, status: 0, data: { error: 'Couldn’t reach the server. Check your connection.' } };
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      authFailed = true;
      stopOnline();
      online = null;
      render();
    }
    return { ok: res.ok, status: res.status, data };
  }

  function newGid() {
    return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }

  // Vs-computer and same-device games go into the account's game history once they end.
  async function recordLocalGame() {
    if (online || !state || state.sim || state.past || (state.recorded && state.boardSaved) || !sessionId()) return;
    const s = state;
    if (!s.gid) s.gid = newGid();
    const me = s.ai === 0 ? 1 : 0;
    const { log, recorded, boardSaved, celebrated, ...board } = s;
    const r = await api('/api/dino/history/record', {
      gid: s.gid,
      kind: s.ai != null ? 'ai' : 'local',
      level: s.aiCfg ? s.aiCfg.level : null,
      names: [s.players[me].name, s.players[1 - me].name],
      scores: [scorePlayer(me).total, scorePlayer(1 - me).total],
      board,
    });
    if (r.ok && state === s) {
      s.recorded = true;
      s.boardSaved = true;
      save();
    }
  }

  // Read-only view of a finished local game from the account's history (never saved over the current game).
  let pastLoading = false;

  async function openPastGame(id) {
    pastLoading = true;
    render();
    const r = await api(`/api/dino/history/board?id=${encodeURIComponent(id)}`);
    pastLoading = false;
    if (!r.ok || !r.data.state) {
      if (r.status !== 401) toast(r.data.error || 'Couldn’t open that game.');
      history.replaceState(null, '', location.pathname);
      state = load();
      if (state) {
        autoResolve();
        prepareUi();
      }
      render();
      return;
    }
    state = Object.assign(r.data.state, { past: true, celebrated: true, log: [] });
    ui = freshUi();
    resetFx();
    prepareUi();
    render();
  }

  function renderGate(app) {
    const back = encodeURIComponent(location.pathname.replace(/^\//, '') + location.search);
    app.innerHTML = tokify(`<div class="setup gate">
      <div class="box-lid">
        <img class="cover" src="${IMG}cover.webp" alt="Dinosaurs in fenced enclosures in a jungle park">
        <div class="lid-title"><h1>Dino Board Game</h1><p class="tagline">Fence your land, feed your dinos, and build the best park in ${PROTO_ROUNDS} rounds.</p></div>
      </div>
      <div class="setup-card">
        <h2>🔒 Sign in to play</h2>
        <p>You need an Ahrens Labs account to play — against the computer, with a friend on this device, or online against other Ahrens Labs players.</p>
        <a class="btn big" href="/account.html?return=${back}">Log in or sign up</a>
      </div>
    </div>`);
  }

  // Player index whose input the game is waiting for (the server computes the same thing).
  function onlineOwner() {
    const T = cur();
    if (!T || T.t === 'gameOver') return null;
    if (T.p === 0 || T.p === 1) return T.p;
    if (T.t === 'roundStart' && !state.proto) {
      const picks = T.picks || {};
      for (const q of order()) {
        const need = state.players[q].bonusPending;
        if (need && !((picks[q] || []).length >= need)) return q;
      }
    }
    return state.first;
  }

  function onlineMyTurn() {
    return !!online && online.status === 'active' && onlineOwner() === online.me;
  }

  function onlineBlocked() {
    return !!online && (!onlineMyTurn() || online.timedOut);
  }

  // After my bonus pick, is the other player still choosing theirs?
  function onlineLockIn() {
    if (!online) return false;
    const T = cur();
    const o = other(online.me);
    const need = state.players[o].bonusPending;
    return !!need && !(((T.picks || {})[o] || []).length >= need);
  }

  function onlineWaitMsg() {
    if (online.status !== 'active') return 'This game is over.';
    if (online.timedOut) return '⏰ Time’s up — finishing your turn automatically.';
    const who = onlineOwner();
    return `⏳ Waiting for ${who == null ? 'the other player' : state.players[who].name}…`;
  }

  function clockLeft() {
    return online && online.deadline ? online.deadline - (Date.now() + clockSkew) : null;
  }

  function clockText() {
    const left = clockLeft();
    const sec = Math.max(0, Math.ceil((left || 0) / 1000));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }

  function tickClock() {
    if (!online || online.status !== 'active' || online.mode !== 'quick' || !state) return;
    const left = clockLeft();
    if (left == null) return;
    const el = document.getElementById('ol-clock');
    if (el) {
      el.textContent = clockText();
      el.parentElement.classList.toggle('low', left <= 15000);
    }
    if (left <= 0 && onlineMyTurn() && !online.timedOut) {
      online.timedOut = true;
      closeModal();
      const t = cur().t;
      toast(t === 'feed' ? '⏰ Time’s up — your dinos were fed automatically.'
        : t === 'produce' ? '⏰ Time’s up — you collected from your best enclosure.'
          : t === 'gainFood' ? '⏰ Time’s up — you skipped your food and fences.'
            : t === 'roundStart' || t === 'roll' ? '⏰ Time’s up — continuing automatically.'
              : '⏰ Time’s up — your remaining actions were skipped.');
      timeoutStep();
    }
  }

  // Out of time: actions and food/fence gains are skipped; Feeding, Production and shared steps happen automatically.
  function timeoutStep() {
    if (!online || !online.timedOut || !onlineMyTurn()) return;
    if (busy) {
      setTimeout(timeoutStep, 200);
      return;
    }
    const me = online.me;
    const T = cur();
    ui = freshUi();
    if (T.t === 'roundStart') {
      ui.picks[me] = new Array(state.players[me].bonusPending).fill('none');
      handle('startRound', {});
    } else if (T.t === 'roll') {
      handle('roll', {});
    } else if (T.t === 'feed') {
      ui.feed = defaultFeed(me);
      handle('confirmFeed', {});
    } else if (T.t === 'produce') {
      const best = produceChoices(T).sort((a, b) => b.prod - a.prod)[0];
      handle('produce', { key: best.key });
    } else if (T.t === 'power') {
      handle('usePower', {});
    } else if (T.t === 'grow') {
      prepareUi();
      const b = state.players[me].board;
      const it = b.items[T.id];
      if (it && ui.sel && growMore(b, it, growExtra(it))) {
        handle('growAuto', {});
        handle('place', {});
      } else {
        state.queue.shift();
        commit();
      }
    } else if (T.t === 'actions') {
      logMsg(`⏰ ${pn(me)} ran out of time and skipped ${T.work ? 'a worker' : plural(T.remaining, 'action')}.`);
      state.queue.shift();
      commit();
    } else if (T.t === 'gainFood') {
      logMsg(`⏰ ${pn(me)} ran out of time and skipped their food and fences.`);
      state.queue.shift();
      commit();
    } else {
      logMsg(`⏰ ${pn(me)} ran out of time — the rest of that action was skipped.`);
      state.queue.shift();
      commit();
    }
    setTimeout(timeoutStep, 60);
  }

  function setTurnTitle() {
    document.title = onlineMyTurn() ? `🦖 Your turn — ${BASE_TITLE}` : BASE_TITLE;
  }

  function applyMeta(v) {
    Object.assign(online, {
      mode: v.mode,
      status: v.status,
      version: v.version,
      turn: v.turn,
      deadline: v.deadline,
      result: v.result,
      players: v.players,
    });
    if (v.serverNow) clockSkew = v.serverNow - Date.now();
    if (online.turn !== online.me) online.timedOut = false;
    setTurnTitle();
  }

  // Server snapshot is the source of truth for anything I didn't just send.
  function applyView(v) {
    if (!online || v.id !== online.id) return;
    applyMeta(v);
    if (v.state) {
      state = repairFences(v.state);
      ui = freshUi();
      prepareUi();
    }
    render();
  }

  function enterOnline(view) {
    if (!view || !view.state) {
      toast('That game hasn’t started yet.');
      return;
    }
    stopOnline();
    online = { id: view.id, me: view.me, timedOut: false };
    state = repairFences(view.state);
    resetFx();
    prevRes = null;
    lastTurnKey = null;
    applyMeta(view);
    ui = freshUi();
    prepareUi();
    closeModal();
    history.replaceState(null, '', `${location.pathname}?game=${encodeURIComponent(view.id)}`);
    connectSock();
    render();
  }

  function leaveOnline() {
    stopOnline();
    online = null;
    state = null;
    ui = freshUi();
    setupOnline = true;
    document.title = BASE_TITLE;
    history.replaceState(null, '', location.pathname);
    render();
    loadLobby();
  }

  function stopOnline() {
    const s = sock;
    sock = null;
    if (s) {
      try {
        s.close();
      } catch {
        /* already closed */
      }
    }
    clearInterval(sockPing);
    clearTimeout(sockRetry);
    clearInterval(pollTimer);
    pollTimer = null;
  }

  function onlinePush() {
    if (!online || online.status !== 'active' || online.turn !== online.me || !state) return;
    const base = online.version;
    online.version = base + 1;
    online.turn = onlineOwner();
    const over = cur() && cur().t === 'gameOver';
    if (over) online.status = 'over';
    if (online.turn !== online.me) {
      online.timedOut = false;
      online.deadline = null;
    }
    setTurnTitle();
    const msg = { type: 'move', id: online.id, base, rules: RULES_VERSION, state, scores: over ? [scorePlayer(0).total, scorePlayer(1).total] : null };
    if (sock && sock.readyState === 1) {
      try {
        sock.send(JSON.stringify(msg));
        return;
      } catch {
        /* fall back to HTTP */
      }
    }
    const body = JSON.parse(JSON.stringify(msg));
    const id = online.id;
    moveChain = moveChain.then(async () => {
      const r = await api('/api/dino/move', body);
      if (!online || online.id !== id) return;
      if (r.ok) {
        if (r.data.version === online.version) applyMeta(r.data);
      } else if (r.data && r.data.state) {
        toast(r.data.error || 'The game moved on — showing the latest board.');
        applyView(r.data);
      } else if (r.status !== 401) {
        toast('Couldn’t save that move — reloading the game.');
        refreshOnline(true);
      }
    });
  }

  function connectSock() {
    if (!online || sock || document.hidden) return;
    const url = `${API_BASE.replace(/^http/, 'ws')}/api/dino/live?id=${encodeURIComponent(online.id)}&session=${encodeURIComponent(sessionId())}`;
    let ws;
    try {
      ws = new WebSocket(url);
    } catch {
      startPoll();
      return;
    }
    sock = ws;
    ws.addEventListener('open', () => {
      clearInterval(pollTimer);
      pollTimer = null;
      clearInterval(sockPing);
      sockPing = setInterval(() => {
        if (sock === ws && ws.readyState === 1) ws.send('ping');
      }, 30000);
    });
    ws.addEventListener('message', (e) => {
      if (sock !== ws || e.data === 'pong') return;
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (!online || m.id !== online.id) return;
      if (m.type === 'ack') {
        if (m.version === online.version) applyMeta(m);
      } else if (m.type === 'reject') {
        toast(m.error || 'That move didn’t go through.');
        if (m.state) applyView(m);
        else refreshOnline(true);
      } else if (m.type === 'state') {
        if (m.by === online.me && m.version <= online.version) {
          if (m.version === online.version) applyMeta(m);
          return;
        }
        applyView(m);
      }
    });
    ws.addEventListener('close', () => {
      if (sock !== ws) return;
      sock = null;
      clearInterval(sockPing);
      if (!online) return;
      startPoll();
      clearTimeout(sockRetry);
      sockRetry = setTimeout(connectSock, 5000);
    });
    ws.addEventListener('error', () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    });
  }

  function startPoll() {
    if (pollTimer || !online) return;
    pollTimer = setInterval(() => refreshOnline(false), online.mode === 'quick' ? 4000 : 20000);
  }

  async function refreshOnline(force) {
    if (!online || (!force && document.hidden)) return;
    const id = online.id;
    const r = await api(`/api/dino/game?id=${encodeURIComponent(id)}&v=${force ? 0 : online.version}`);
    if (!r.ok || !online || online.id !== id) return;
    if (!force && r.data.version < online.version) return;
    if (r.data.unchanged) {
      applyMeta(r.data);
      renderTop();
      return;
    }
    applyView(r.data);
  }

  async function openOnlineGame(id) {
    const r = await api(`/api/dino/game?id=${encodeURIComponent(id)}`);
    if (!r.ok) {
      if (r.status !== 401) toast(r.data.error || 'Couldn’t open that game.');
      history.replaceState(null, '', location.pathname);
      loadLobby();
      return;
    }
    if (r.data.state) {
      enterOnline(r.data);
      return;
    }
    if (r.data.status === 'pending' && r.data.me === 1) toast(`🦖 ${r.data.players[0]} challenged you — accept below!`);
    loadLobby();
  }

  // ---- lobby
  async function loadLobby() {
    if (!sessionId() || lobby.busy) return;
    lobby.busy = true;
    const r = await api('/api/dino/games');
    lobby.busy = false;
    if (r.ok) {
      lobby.games = r.data.games || [];
      lobby.error = '';
    } else if (r.status !== 401) {
      lobby.error = r.data.error || 'Couldn’t load your games right now.';
    }
    const needsMe = (lobby.games || []).some((g) => (g.status === 'pending' && g.me === 1) || (g.status === 'active' && g.turn === g.me));
    if (needsMe && !setupTouched && !state && !setupOnline) {
      setupOnline = true;
      setupVsAi = false;
      const box = document.querySelector('.setup');
      if (box) {
        box.classList.remove('vs-ai');
        box.classList.add('vs-online');
      }
    }
    renderLobby();
  }

  function lobbyNote(g) {
    if (g.status === 'pending') return g.me === 1 ? 'challenged you' : 'waiting for them to accept';
    if (g.status === 'active') {
      const mine = g.turn === g.me;
      const clock = g.mode === 'quick' && g.deadline ? ` · ⏱ ${Math.max(0, Math.ceil((g.deadline - Date.now() - clockSkew) / 1000))}s` : '';
      return `Round ${g.round} · ${mine ? '<b>your turn</b>' : 'their turn'}${clock}`;
    }
    if (g.status === 'over') {
      const r = g.result || {};
      const how = r.reason === 'resign' ? (r.winner === g.me ? ' — they resigned' : ' — you resigned') : r.reason === 'timeout' ? ' — on time' : '';
      const score = r.scores ? ` ${r.scores[g.me]}–${r.scores[1 - g.me]}` : '';
      if (r.winner == null) return `🤝 Tie${score}`;
      return `${r.winner === g.me ? '🏆 You won' : 'You lost'}${score}${how}`;
    }
    return { declined: 'Declined', cancelled: 'Cancelled', expired: 'Expired' }[g.status] || g.status;
  }

  function lobbyRow(g, btns) {
    return `<div class="ol-game"><div class="olg-main"><b>${esc(g.opp)}</b> <span class="olg-mode">${MODE_LABEL[g.mode] || ''}</span><small>${lobbyNote(g)}</small></div><div class="olg-btns">${btns}</div></div>`;
  }

  function renderLobby() {
    const el = document.getElementById('ol-list');
    if (!el) return;
    const games = lobby.games;
    const badge = document.getElementById('ol-badge');
    if (!games) {
      el.innerHTML = `<p class="muted">${lobby.error ? esc(lobby.error) : 'Loading your games…'}</p>`;
      return;
    }
    const by = (f) => games.filter(f);
    const incoming = by((g) => g.status === 'pending' && g.me === 1);
    const yours = by((g) => g.status === 'active' && g.turn === g.me);
    const theirs = by((g) => g.status === 'active' && g.turn !== g.me);
    const sent = by((g) => g.status === 'pending' && g.me === 0);
    const done = by((g) => g.status !== 'pending' && g.status !== 'active');
    const need = incoming.length + yours.length;
    if (badge) badge.textContent = need ? `${need} waiting for you` : 'Challenge a friend';
    const id = (g) => `data-id="${esc(g.id)}"`;
    const group = (title, list, btns) => (list.length ? `<h3 class="ol-h">${title}</h3>${list.map((g) => lobbyRow(g, btns(g))).join('')}` : '');
    el.innerHTML = tokify([
      lobby.error ? `<p class="muted">${esc(lobby.error)}</p>` : '',
      group('🦖 Challenges for you', incoming, (g) => `<button class="btn sm" data-act="olAccept" ${id(g)}>Accept</button><button class="btn sm ghost" data-act="olDecline" ${id(g)}>Decline</button>`),
      group('▶ Your turn', yours, (g) => `<button class="btn sm" data-act="olOpen" ${id(g)}>Play</button>`),
      group('⏳ Their turn', theirs, (g) => `<button class="btn sm ghost" data-act="olOpen" ${id(g)}>Watch</button>`),
      group('📨 Sent challenges', sent, (g) => `<button class="btn sm ghost" data-act="olCancel" ${id(g)}>Cancel</button>`),
      group('🏁 Finished', done, (g) => (g.status === 'over' ? `<button class="btn sm ghost" data-act="olOpen" ${id(g)}>View</button>` : '')),
      games.length ? '' : '<p class="muted">No online games yet. Challenge someone above!</p>',
      `<button class="link ol-refresh" data-act="olRefresh">↻ Refresh</button>`,
    ].join(''));
  }

  function updateLobbyGame(summary) {
    if (!lobby.games || !summary) return;
    lobby.games = [summary, ...lobby.games.filter((g) => g.id !== summary.id)];
    renderLobby();
  }

  async function onlineAct(act, ds, el) {
    if (act === 'olMode') {
      olMode = ds.v;
      el.parentElement.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('on', b === el));
      return;
    }
    if (act === 'olRefresh') { loadLobby(); return; }
    if (act === 'resumeLocal') {
      state = load();
      if (!state) return;
      autoResolve();
      ui = freshUi();
      prepareUi();
      render();
      return;
    }
    if (act === 'onlineLeave') { leaveOnline(); return; }
    if (act === 'onlineResign') {
      confirmModal('Resign this game?', 'Your opponent wins right away.', 'Yes, resign', async () => {
        const r = await api('/api/dino/resign', { id: online.id });
        if (r.ok) applyView(r.data);
        else if (r.data.error) toast(r.data.error);
      });
      return;
    }
    if (act === 'olChallenge' || act === 'olRematch') {
      const input = document.getElementById('ol-opp');
      const opponent = act === 'olRematch' ? online && online.players[other(online.me)] : input && input.value.trim();
      const mode = act === 'olRematch' ? online.mode : olMode;
      if (!opponent) {
        toast('Type their username or email first.');
        return;
      }
      if (el) el.disabled = true;
      const r = await api('/api/dino/challenge', { opponent, mode });
      if (el) el.disabled = false;
      if (!r.ok) {
        if (r.status !== 401) toast(r.data.error || 'Couldn’t send the challenge.');
        return;
      }
      toast(`📨 Challenge sent to ${r.data.game.opp}!`);
      if (input) input.value = '';
      updateLobbyGame(r.data.game);
      if (act === 'olRematch') leaveOnline();
      return;
    }
    const g = (lobby.games || []).find((x) => x.id === ds.id);
    if (act === 'olOpen') { openOnlineGame(ds.id); return; }
    if (!g) return;
    if (act === 'olAccept') {
      const names = g.me === 1 ? [g.opp, myUsername()] : [myUsername(), g.opp];
      const keep = state;
      buildGame(names, rand(2), null, 'medium', 'medium', true);
      const start = state;
      state = keep;
      if (el) el.disabled = true;
      const r = await api('/api/dino/respond', { id: g.id, accept: true, state: start });
      if (el) el.disabled = false;
      if (!r.ok) {
        if (r.status !== 401) toast(r.data.error || 'Couldn’t start the game.');
        loadLobby();
        return;
      }
      enterOnline(r.data);
      return;
    }
    if (act === 'olDecline' || act === 'olCancel') {
      const r = act === 'olDecline'
        ? await api('/api/dino/respond', { id: g.id, accept: false })
        : await api('/api/dino/resign', { id: g.id });
      if (!r.ok && r.status !== 401) toast(r.data.error || 'Something went wrong.');
      loadLobby();
    }
  }

  function onlineEndHtml() {
    const r = online.result || {};
    const opp = esc(online.players[other(online.me)]);
    let head = 'Game over';
    if (online.status === 'over') {
      if (r.winner == null) head = '🤝 It’s a tie!';
      else if (r.winner === online.me) head = r.reason === 'resign' ? `🏆 ${opp} resigned — you win!` : r.reason === 'timeout' ? `🏆 ${opp} ran out of time — you win!` : '🏆 You win!';
      else head = r.reason === 'resign' ? 'You resigned.' : r.reason === 'timeout' ? 'You ran out of time.' : `${opp} wins!`;
    } else head = { declined: 'Challenge declined.', cancelled: 'Challenge cancelled.', expired: 'Challenge expired.' }[online.status] || head;
    return `<div class="winner">${head}</div>
      <div class="btn-row"><button class="btn big" data-act="olRematch">🦖 Rematch</button><button class="btn big ghost" data-act="onlineLeave">🏠 My games</button></div>`;
  }

  setInterval(tickClock, 500);
  setInterval(() => {
    if (!state && setupOnline && !document.hidden && sessionId() && !authFailed) loadLobby();
  }, 30000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (online) {
      connectSock();
      if (!sock || sock.readyState !== 1) refreshOnline(false);
    } else if (!state && setupOnline) loadLobby();
  });


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
    if (state && onlineBlocked() && !FREE_ACTS.has(el.dataset.act)) {
      toast(onlineWaitMsg());
      return;
    }
    if (isAiTask(cur()) && !FREE_ACTS.has(el.dataset.act)) {
      toast('🤖 Hang on — it’s the computer’s turn.');
      return;
    }
    lastClickRect = el.getBoundingClientRect();
    handle(el.dataset.act, el.dataset, el, e);
  });

  document.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest && e.target.closest('[data-cell]');
    if (!cell || !ui.sel || ui.sel.type !== 'cells' || busy || isAiTask(cur()) || onlineBlocked()) return;
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

  // Drag a worker from your supply onto a worker-board space (prototype rules).
  let meepleDrag = null;
  document.addEventListener('pointerdown', (e) => {
    const m = e.target.closest && e.target.closest('.meeple.grab');
    if (!m || busy || isAiTask(cur()) || onlineBlocked()) return;
    e.preventDefault();
    const ghost = m.cloneNode(true);
    ghost.classList.remove('grab');
    ghost.classList.add('meeple-ghost');
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;
    document.body.appendChild(ghost);
    m.classList.add('lifted');
    meepleDrag = { ghost, src: m, over: null };
  });

  document.addEventListener('pointermove', (e) => {
    if (!meepleDrag) return;
    meepleDrag.ghost.style.left = `${e.clientX}px`;
    meepleDrag.ghost.style.top = `${e.clientY}px`;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const sp = el && el.closest && el.closest('.wspace.open');
    if (sp !== meepleDrag.over) {
      if (meepleDrag.over) meepleDrag.over.classList.remove('drop-hover');
      if (sp) sp.classList.add('drop-hover');
      meepleDrag.over = sp;
    }
  });

  const endMeepleDrag = (e) => {
    if (!meepleDrag) return;
    const { ghost, src, over } = meepleDrag;
    meepleDrag = null;
    ghost.remove();
    src.classList.remove('lifted');
    if (over) over.classList.remove('drop-hover');
    if (e.type === 'pointerup' && over && !over.disabled) over.click();
  };
  document.addEventListener('pointerup', endMeepleDrag);
  document.addEventListener('pointercancel', endMeepleDrag);

  const endDrag = () => { drag = null; };
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // ---------------------------------------------------------------- boot
  const params = new URLSearchParams(location.search);
  const linkedGame = params.get('game');
  const pastGame = linkedGame ? null : params.get('past');
  state = linkedGame || pastGame ? null : load();
  if (state) {
    autoResolve();
    prepareUi();
  }
  if (linkedGame) setupOnline = true;
  if (pastGame && sessionId()) pastLoading = true;
  render();
  if (sessionId()) {
    if (linkedGame) openOnlineGame(linkedGame);
    else if (pastGame) openPastGame(pastGame);
    else loadLobby();
    if (state && cur() && cur().t === 'gameOver') recordLocalGame();
  }
})();
