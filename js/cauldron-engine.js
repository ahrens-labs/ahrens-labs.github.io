// Cauldron Lane — rules engine and computer player. No DOM access, so it also runs in Node for simulations.
// There are no rounds: every action costs days on the calendar, and whoever is furthest behind always moves next.
(function (root) {
  'use strict';

  const SAVE_V = 1;
  const DAYS = 28; // the Moon Fair
  const MARKET_DAYS = [4, 8, 12, 16, 20, 24];
  // Doorbell spaces: whenever your own token passes one, a customer walks into your shop.
  const BELLS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26];
  const QUEUE = 3;
  const START_CUSTOMERS = 2;
  const START_COINS = 15;
  const SHELF = 4;
  const BESTIARY = 5;
  const LIBRARY = 3;
  const MARKET_BUY = 6;
  const VISIT_MAX = 2;
  const BREW_MAX = 2;
  const BREW_DAYS = 2;
  const LADDER = [1, 1, 2, 2, 3, 3, 4, 5]; // the next token always costs LADDER[8 - supply]
  const SUPPLY_START = 6;
  const GUILD_DROP = 1;
  const GUILD_FLOOR = 3; // a Guild price never falls more than this below its usual price
  const GUILD_RECOVER = 1;
  const LEARN_COST = { 2: 4, 3: 7, 4: 10 };
  const PATIENCE = [6, 9];

  // Common ingredients (bought at the market) and creature parts (brought back from hunts).
  const ING = {
    herb: { icon: '🌿', name: 'Silverleaf', kind: 'common' },
    shroom: { icon: '🍄', name: 'Glowcap', kind: 'common' },
    crystal: { icon: '💎', name: 'Moonstone', kind: 'common' },
    dew: { icon: '💧', name: 'Starlight dew', kind: 'common' },
    griffin: { icon: '🦅', name: 'Griffin feather', kind: 'part', beast: 'Griffin' },
    mermaid: { icon: '🧜', name: 'Mermaid scale', kind: 'part', beast: 'Mermaid' },
    basilisk: { icon: '🐍', name: 'Basilisk fang', kind: 'part', beast: 'Basilisk' },
    unicorn: { icon: '🦄', name: 'Unicorn hair', kind: 'part', beast: 'Unicorn' },
    dragon: { icon: '🐉', name: 'Dragon scale', kind: 'part', beast: 'Dragon' },
    phoenix: { icon: '🔥', name: 'Phoenix feather', kind: 'part', beast: 'Phoenix' },
  };
  const COMMONS = ['herb', 'shroom', 'crystal', 'dew'];
  const PARTS = ['griffin', 'mermaid', 'basilisk', 'unicorn', 'dragon', 'phoenix'];
  // How many days a hunt takes, and where the beast is found.
  const BEAST = {
    griffin: { days: 2, where: 'the windy crags' },
    mermaid: { days: 2, where: 'the singing reef' },
    basilisk: { days: 3, where: 'the sunken temple' },
    unicorn: { days: 3, where: 'the silver wood' },
    dragon: { days: 4, where: 'the smoking mountain' },
    phoenix: { days: 4, where: 'the ash desert' },
  };

  // What customers come in for. Each need has potions at several tiers; better potions pay more.
  const NEED = {
    heal: { icon: '❤️', name: 'Healing' },
    protect: { icon: '🛡️', name: 'Protection' },
    travel: { icon: '🧭', name: 'Travel' },
    charm: { icon: '✨', name: 'Charm & mischief' },
  };
  const NEED_ORDER = Object.keys(NEED);
  const TIER = {
    1: { name: 'Common', stars: 1, pay: 11, guild: 6 },
    2: { name: 'Rare', stars: 2, pay: 19, guild: 12 },
    3: { name: 'Mythic', stars: 3, pay: 30, guild: 19 },
    4: { name: 'Legendary', stars: 4, pay: 44, guild: 28 },
  };
  // Common recipes are known by every shop. Every other recipe card exists once: whoever holds it is the only shop that can brew it.
  const POTION = {
    healing: { name: 'Healing Draught', need: 'heal', tier: 1, color: '#e0464b', ing: { herb: 2, dew: 1 } },
    ward: { name: 'Warding Tonic', need: 'protect', tier: 1, color: '#7f9bb8', ing: { crystal: 2, shroom: 1 } },
    nighteye: { name: 'Night-Eye Drops', need: 'travel', tier: 1, color: '#3fa36b', ing: { herb: 1, shroom: 1, crystal: 1 } },
    sleep: { name: 'Sleeping Tonic', need: 'charm', tier: 1, color: '#8a7be0', ing: { shroom: 2, dew: 1 } },
    remedy: { name: 'Unicorn Remedy', need: 'heal', tier: 2, color: '#e9e4ff', ing: { unicorn: 1, herb: 1, dew: 1 } },
    ember: { name: 'Phoenix Ember', need: 'heal', tier: 2, color: '#ff9f1c', ing: { phoenix: 1, herb: 1, crystal: 1 } },
    stoneskin: { name: 'Stoneskin Salve', need: 'protect', tier: 2, color: '#9a9284', ing: { basilisk: 1, crystal: 1, shroom: 1 } },
    courage: { name: 'Courage Brew', need: 'protect', tier: 2, color: '#e8862b', ing: { griffin: 1, herb: 1, shroom: 1 } },
    deep: { name: 'Breath of the Deep', need: 'travel', tier: 2, color: '#2aa8c9', ing: { mermaid: 1, dew: 2 } },
    firebelly: { name: 'Firebelly Tonic', need: 'travel', tier: 2, color: '#d9381e', ing: { dragon: 1, shroom: 1, crystal: 1 } },
    tears: { name: 'Phoenix Tears', need: 'heal', tier: 3, color: '#ff9fbf', ing: { phoenix: 1, unicorn: 1, dew: 1 } },
    dragonbreath: { name: 'Dragon’s Breath', need: 'protect', tier: 3, color: '#a61e1e', ing: { dragon: 1, griffin: 1, shroom: 1 } },
    flight: { name: 'Potion of Flight', need: 'travel', tier: 3, color: '#8fcbff', ing: { griffin: 1, phoenix: 1, dew: 1 } },
    invisible: { name: 'Invisibility Draught', need: 'charm', tier: 3, color: '#cfe8f2', ing: { basilisk: 1, mermaid: 1, crystal: 1 } },
    life: { name: 'Elixir of Life', need: 'heal', tier: 4, color: '#ffd23f', ing: { dragon: 1, phoenix: 1, unicorn: 1, crystal: 1 } },
    philter: { name: 'Moonlight Philter', need: 'charm', tier: 4, color: '#d45ac8', ing: { mermaid: 1, unicorn: 1, basilisk: 1, herb: 1 } },
  };
  const POTION_ORDER = Object.keys(POTION);
  const BASIC = POTION_ORDER.filter((k) => POTION[k].tier === 1);

  // Townsfolk who come to the lane to buy.
  const FOLK = {
    knight: { name: 'Sir Roland', role: 'knight', icon: '🛡️', needs: ['protect', 'heal'] },
    healer: { name: 'Sister Agnes', role: 'healer', icon: '🕯️', needs: ['heal'] },
    farmer: { name: 'Farmer Bess', role: 'farmer', icon: '🌾', needs: ['heal', 'charm'] },
    noble: { name: 'Lady Vane', role: 'baroness', icon: '👑', needs: ['charm', 'heal', 'travel'] },
    bard: { name: 'Pip', role: 'bard', icon: '🎻', needs: ['charm', 'travel'] },
    miner: { name: 'Grum', role: 'miner', icon: '⛏️', needs: ['protect', 'travel'] },
    thief: { name: 'Shady Nell', role: 'thief', icon: '🗝️', needs: ['charm', 'travel'] },
    sailor: { name: 'Captain Mo', role: 'sailor', icon: '⚓', needs: ['travel', 'protect'] },
    wizard: { name: 'Old Mortimer', role: 'wizard', icon: '🧙', needs: ['charm', 'protect', 'heal'] },
  };
  const FOLK_ORDER = Object.keys(FOLK);
  // The townsfolk deck, per need: most customers take any potion for their need, some insist on Rare or better.
  const FOLK_MINS = [1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 4];

  const AI = {
    easy: { margin: 3, markup: 2, noise: 0.5, wait: 1.6, learn: false, pairs: false, coins: 0 },
    normal: { margin: 2, markup: 3, noise: 0.15, wait: 1.2, learn: true, pairs: true, coins: 0 },
    hard: { margin: 2, markup: 3, noise: 0, wait: 1.0, learn: true, pairs: true, coins: 3 },
    brutal: { margin: 1, markup: 3, noise: 0, wait: 1.0, learn: true, pairs: true, coins: 6 },
  };

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
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const ingText = (bag) => Object.keys(bag).filter((k) => bag[k] > 0).map((k) => (bag[k] > 1 ? `${bag[k]}×${ING[k].icon}` : ING[k].icon)).join(' ');
  function log(state, text, who) {
    state.log.push({ d: today(state), text, who: who == null ? null : who });
    if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
  }
  const tier = (k) => POTION[k].tier;
  const restock = (state) => 2 + state.players.length;
  // Does this potion do for this customer, and what do they pay for it?
  const suits = (o, k) => POTION[k].need === o.need && tier(k) >= o.min;
  const payFor = (o, k) => TIER[tier(k)].pay + o.bonus;
  const wantText = (o) => `${NEED[o.need].icon} ${NEED[o.need].name.toLowerCase()}${o.min > 1 ? ` (${TIER[o.min].name} or better)` : ''}`;

  // ---------------------------------------------------------------- setup
  function newGame(opts) {
    opts = opts || {};
    const names = opts.names || ['Red', 'Blue'];
    const n = names.length;
    const ai = opts.ai || names.map((_, i) => i > 0);
    const levels = opts.levels || names.map(() => 'normal');
    const state = {
      v: SAVE_V,
      seed: (opts.seed != null ? opts.seed : Math.floor(Math.random() * 2 ** 31)) | 0,
      nextId: 0,
      arrSeq: 0,
      phase: 'act',
      turn: 0,
      market: 0,
      players: [],
      supply: {},
      guild: {},
      beasts: [],
      beastDeck: [],
      beastPile: [],
      library: [],
      libDeck: [],
      folkDeck: [],
      log: [],
      sold: [],
      sales: [], // every potion sold to a customer or another shop, for "since your last turn" recaps
      report: null,
    };
    COMMONS.forEach((k) => (state.supply[k] = SUPPLY_START));
    POTION_ORDER.forEach((k) => (state.guild[k] = TIER[tier(k)].guild));
    for (let i = 0; i < n; i++) {
      state.players.push({
        name: names[i], ai: !!ai[i], level: ai[i] ? levels[i] || 'normal' : null,
        coins: START_COINS, pos: 0, arr: 0,
        pantry: Object.fromEntries(Object.keys(ING).map((k) => [k, 0])),
        recipes: [], shelf: [], queue: [],
        stats: { served: 0, custCoins: 0, toRivals: 0, rivalCoins: 0, fromRivals: 0, guild: 0, guildCoins: 0, fair: 0, spent: 0, hunts: 0, lost: 0, walked: 0 },
      });
    }
    // Turn order on day 0: the first player's token sits on top of the stack.
    const first = opts.first == null ? 0 : opts.first;
    names.map((_, i) => (first + i) % n).reverse().forEach((pi) => (state.players[pi].arr = ++state.arrSeq));
    // Later shops pick from a picked-over bestiary and library, so they open with a coin more each.
    names.forEach((_, i) => (state.players[(first + i) % n].coins += i));
    state.players.forEach((p) => (p.start = p.coins));
    // Every shop starts knowing one rare recipe of its own, each for a different need where possible.
    const rares = shuffle(state, POTION_ORDER.filter((k) => tier(k) === 2));
    const dealt = [];
    const order = names.map((_, i) => state.players[(first + i) % n]);
    order.forEach((p) => {
      const pick = rares.find((k) => !dealt.includes(k) && !dealt.some((d) => POTION[d].need === POTION[k].need)) || rares.find((k) => !dealt.includes(k));
      dealt.push(pick);
      p.recipes.push(pick);
    });
    const deck = shuffle(state, POTION_ORDER.filter((k) => tier(k) >= 2 && !dealt.includes(k)));
    // Legendary recipes only turn up once the library has turned over a few times.
    state.libDeck = deck.filter((k) => tier(k) !== 4);
    deck.filter((k) => tier(k) === 4).forEach((k) => state.libDeck.splice(LIBRARY + 1 + rint(state, Math.max(1, state.libDeck.length - LIBRARY)), 0, k));
    while (state.library.length < LIBRARY && state.libDeck.length) state.library.push(state.libDeck.shift());
    // Creature sightings: four single cards, two pairs and a herd of three per beast (bigger hunts take longer).
    PARTS.forEach((k) => {
      [1, 1, 1, 1, 2, 2, 3].forEach((n) => state.beastDeck.push({ id: nid(state), k, n, days: BEAST[k].days + n - 1 }));
    });
    shuffle(state, state.beastDeck);
    refillBeasts(state);
    // Each shop opens with two customers who'll take any potion for their need.
    order.forEach((p) => {
      for (let c = 0; c < START_CUSTOMERS; c++) {
        const card = drawFolk(state, 0, (o) => o.min === 1);
        if (card) p.queue.push(card);
      }
    });
    state.turn = nextTurn(state);
    log(state, `The shops on Cauldron Lane open their doors. ${DAYS} days until the Moon Fair.`);
    return state;
  }

  // Can anyone serve this customer — a shop that knows a suitable recipe, or one in the library?
  const servable = (state, o) => POTION_ORDER.some((k) => suits(o, k) && (tier(k) === 1 || state.library.includes(k) || state.players.some((p) => p.recipes.includes(k))));

  // Draw a customer from the townsfolk deck, skipping anyone nobody could serve.
  function drawFolk(state, day, ok) {
    for (let tries = 0; tries < 2; tries++) {
      if (!state.folkDeck.length) {
        NEED_ORDER.forEach((need) => {
          const top = Math.max(...POTION_ORDER.filter((k) => POTION[k].need === need).map(tier));
          FOLK_MINS.forEach((min) => state.folkDeck.push({ need, min: Math.min(min, top) }));
        });
        shuffle(state, state.folkDeck);
      }
      const i = state.folkDeck.findIndex((o) => servable(state, o) && (!ok || ok(o)));
      if (i < 0) {
        state.folkDeck = [];
        continue;
      }
      const c = state.folkDeck.splice(i, 1)[0];
      const folk = FOLK_ORDER.filter((f) => FOLK[f].needs.includes(c.need));
      return {
        id: nid(state), need: c.need, min: c.min, who: folk[rint(state, folk.length)], bonus: rint(state, 3),
        leave: Math.min(DAYS, day + PATIENCE[0] + rint(state, PATIENCE[1] - PATIENCE[0] + 1)), came: day,
      };
    }
    return null;
  }

  function refillBeasts(state) {
    while (state.beasts.length < BESTIARY) {
      if (!state.beastDeck.length) {
        if (!state.beastPile.length) break;
        state.beastDeck = shuffle(state, state.beastPile);
        state.beastPile = [];
      }
      state.beasts.push(state.beastDeck.shift());
    }
  }

  function aiHeadStart(state, pi, level) {
    const L = AI[level];
    const p = state.players[pi];
    p.level = level;
    if (L && L.coins) {
      p.coins += L.coins;
      p.start += L.coins;
    }
  }

  // ---------------------------------------------------------------- time
  // The day is where the token furthest behind stands: that player always moves next.
  function today(state) {
    const live = state.players.filter((p) => p.pos < DAYS);
    return live.length ? Math.min(...live.map((p) => p.pos)) : DAYS;
  }
  function nextTurn(state) {
    let best = -1;
    state.players.forEach((p, i) => {
      if (p.pos >= DAYS) return;
      const b = state.players[best];
      if (best < 0 || p.pos < b.pos || (p.pos === b.pos && p.arr > b.arr)) best = i;
    });
    return best;
  }
  // Move a token: customers who ran out of patience leave, and every doorbell passed brings a new one.
  function move(state, pi, days, report) {
    const p = state.players[pi];
    const from = p.pos;
    p.pos = Math.min(DAYS, p.pos + days);
    p.arr = ++state.arrSeq;
    const gone = p.queue.filter((o) => o.leave < p.pos);
    p.queue = p.queue.filter((o) => o.leave >= p.pos);
    gone.forEach((o) => {
      p.stats.lost++;
      report.left.push({ who: pi, o });
      log(state, `${FOLK[o.who].name} gave up waiting at ${p.name} and left.`, pi);
    });
    BELLS.filter((b) => b > from && b <= p.pos).forEach((b) => {
      if (p.queue.length >= QUEUE) {
        p.stats.walked++;
        report.missed.push({ who: pi, day: b });
        log(state, `🔔 Day ${b}: a customer looked in at ${p.name}, saw the queue and walked on by.`, pi);
        return;
      }
      const o = drawFolk(state, b);
      if (!o) return;
      p.queue.push(o);
      report.came.push({ who: pi, o });
      log(state, `🔔 Day ${b}: ${FOLK[o.who].name} the ${FOLK[o.who].role} came into ${p.name} wanting ${wantText(o)}, and will wait until day ${o.leave}.`, pi);
      autoSell(state, pi);
    });
  }

  // ---------------------------------------------------------------- prices
  const price = (state, k) => (state.supply[k] > 0 ? LADDER[LADDER.length - state.supply[k]] : null);
  // What buying these commons costs, one token at a time.
  function marketCost(state, buy) {
    let total = 0;
    for (const k of COMMONS) {
      const n = buy[k] || 0;
      if (n > state.supply[k]) return null;
      for (let i = 0; i < n; i++) total += LADDER[LADDER.length - state.supply[k] + i];
    }
    return total;
  }
  const guildMin = (k) => TIER[tier(k)].guild - GUILD_FLOOR;
  const beastDays = (state, c) => Math.max(1, c.days - (state.beasts[0] && state.beasts[0].id === c.id ? 1 : 0));
  const canBrew = (p, k, bag) => Object.keys(POTION[k].ing).every((i) => (bag || p.pantry)[i] >= POTION[k].ing[i]);
  const knows = (p, k) => tier(k) === 1 || p.recipes.includes(k);
  const brewers = (state, k) => state.players.map((p, i) => (knows(p, k) ? i : -1)).filter((i) => i >= 0);
  // Customers at other shops who'd take potion k and can't be served from their own shelf.
  function rivalWants(state, pi, k) {
    const out = [];
    state.players.forEach((q, qi) => {
      if (qi === pi) return;
      q.queue.filter((o) => suits(o, k) && !q.shelf.some((s) => suits(o, s.k))).forEach((o) => out.push({ qi, o, pay: payFor(o, k) }));
    });
    return out.sort((a, b) => b.pay - a.pay);
  }
  // A price tag: just under what a rival's customer would pay, so they can still profit by buying — or a little over the Guild.
  function suggestTag(state, pi, k, markup) {
    const p = state.players[pi];
    const mine = p.queue.filter((o) => suits(o, k)).map((o) => payFor(o, k));
    if (mine.length) return Math.max(...mine) + 2;
    const theirs = rivalWants(state, pi, k);
    if (theirs.length) return Math.max(state.guild[k] + 1, theirs[0].pay - (markup == null ? 3 : markup));
    return state.guild[k] + 3;
  }

  // ---------------------------------------------------------------- actions
  const DAYS_OF = { market: 1, visit: 1, guild: 1, learn: 1, brew: BREW_DAYS };
  function legal(state, pi, a) {
    if (state.phase !== 'act') return 'The game is over.';
    if (pi !== state.turn) return 'It isn’t your turn.';
    const p = state.players[pi];
    if (!a || !a.t) return 'Pick an action.';
    if (a.t === 'tag') {
      if (!p.shelf.some((x) => x.id === a.s)) return 'That potion isn’t on your shelf.';
      if (!Number.isInteger(a.tag) || a.tag < 1 || a.tag > 99) return 'Price tags go from 🪙1 to 🪙99.';
      return null;
    }
    if (a.t === 'market') {
      const buy = a.buy || {};
      if (Object.keys(buy).some((k) => !COMMONS.includes(k) || !Number.isInteger(buy[k]) || buy[k] < 0)) return 'Only common ingredients are sold at the market.';
      const n = COMMONS.reduce((t, k) => t + (buy[k] || 0), 0);
      if (n < 1) return 'Pick at least one ingredient.';
      if (n > MARKET_BUY) return `You can buy up to ${MARKET_BUY} ingredients per trip.`;
      const cost = marketCost(state, buy);
      if (cost == null) return 'The market doesn’t have that many.';
      if (cost > p.coins) return `That costs 🪙${cost}; you have 🪙${p.coins}.`;
      return null;
    }
    if (a.t === 'hunt') return state.beasts.some((x) => x.id === a.c) ? null : 'That sighting is gone.';
    if (a.t === 'brew') {
      const ks = a.ks || [];
      if (ks.length < 1 || ks.length > BREW_MAX) return `Brew 1 or ${BREW_MAX} potions.`;
      if (p.shelf.length + ks.length > SHELF) return `Your shelf only holds ${SHELF} potions.`;
      const bag = Object.assign({}, p.pantry);
      for (const k of ks) {
        if (!POTION[k]) return 'Unknown potion.';
        if (!knows(p, k)) return `You don’t know the recipe for ${POTION[k].name}.`;
        if (!canBrew(p, k, bag)) return `Not enough ingredients for ${POTION[k].name}.`;
        Object.keys(POTION[k].ing).forEach((i) => (bag[i] -= POTION[k].ing[i]));
      }
      return null;
    }
    if (a.t === 'visit') {
      const q = state.players[a.from];
      if (!q || a.from === pi) return 'Pick a rival’s shop.';
      const ids = a.s || [];
      if (ids.length < 1 || ids.length > VISIT_MAX) return `Buy 1 or ${VISIT_MAX} potions.`;
      if (new Set(ids).size !== ids.length || ids.some((id) => !q.shelf.some((y) => y.id === id))) return 'That potion has been sold.';
      const cost = ids.reduce((t, id) => t + q.shelf.find((y) => y.id === id).tag, 0);
      if (cost > p.coins) return `That costs 🪙${cost}; you have 🪙${p.coins}.`;
      if (p.shelf.length + ids.length > SHELF) return `Your shelf only holds ${SHELF} potions.`;
      return null;
    }
    if (a.t === 'guild') {
      const ss = a.s || [];
      if (!ss.length) return 'Pick potions to sell.';
      if (new Set(ss).size !== ss.length || ss.some((id) => !p.shelf.some((y) => y.id === id))) return 'Those potions aren’t on your shelf.';
      return null;
    }
    if (a.t === 'learn') {
      if (!state.library.includes(a.k)) return 'That recipe isn’t in the library.';
      const cost = LEARN_COST[tier(a.k)];
      if (p.coins < cost) return `It costs 🪙${cost}; you have 🪙${p.coins}.`;
      return null;
    }
    if (a.t === 'wait') return null;
    return 'Unknown action.';
  }

  // How far "Mind the shop" moves you: one day past the next token ahead (or one day if nobody is ahead).
  function waitDays(state, pi) {
    const p = state.players[pi];
    const ahead = state.players.filter((q, i) => i !== pi && q.pos > p.pos).map((q) => q.pos);
    const to = ahead.length ? Math.min(...ahead) + 1 : p.pos + 1;
    return Math.max(1, Math.min(DAYS, to) - p.pos);
  }
  function actionDays(state, pi, a) {
    if (a.t === 'hunt') {
      const c = state.beasts.find((x) => x.id === a.c);
      return c ? beastDays(state, c) : 0;
    }
    if (a.t === 'wait') return waitDays(state, pi);
    if (a.t === 'tag') return 0;
    return DAYS_OF[a.t] || 1;
  }

  // Waiting customers buy the moment something that suits them is on the shelf: pickiest first, and each takes the
  // most ordinary potion that will do.
  function autoSell(state, pi) {
    const p = state.players[pi];
    p.queue.slice().sort((a, b) => b.min - a.min || a.leave - b.leave).forEach((o) => {
      const s = p.shelf.filter((y) => suits(o, y.k)).sort((a, b) => tier(a.k) - tier(b.k))[0];
      if (!s) return;
      const pay = payFor(o, s.k);
      p.shelf = p.shelf.filter((y) => y.id !== s.id);
      p.queue = p.queue.filter((y) => y.id !== o.id);
      p.coins += pay;
      p.stats.served++;
      p.stats.custCoins += pay;
      recordSale(state, { to: 'folk', who: pi, k: s.k, coins: pay, folk: o.who });
      log(state, `${FOLK[o.who].name} bought ${POTION[s.k].name} at ${p.name} for 🪙${pay}.`, pi);
    });
  }

  function recordSale(state, x) {
    state.sold.push(x);
    (state.sales || (state.sales = [])).push(x);
  }
  // Sales by this shop since it last took a turn (including customers served on that turn).
  const salesSince = (state, pi) => (state.sales || []).slice(state.players[pi].seen || 0).filter((x) => x.who === pi);

  function apply(state, pi, a) {
    const err = legal(state, pi, a);
    if (err) throw new Error(err);
    const p = state.players[pi];
    state.sold = [];
    state.report = null;
    if (a.t === 'tag') {
      p.shelf.find((x) => x.id === a.s).tag = a.tag;
      return state;
    }
    p.seen = (state.sales || []).length;
    const days = actionDays(state, pi, a);
    if (a.t === 'market') {
      const cost = marketCost(state, a.buy);
      COMMONS.forEach((k) => {
        const n = a.buy[k] || 0;
        state.supply[k] -= n;
        p.pantry[k] += n;
      });
      p.coins -= cost;
      p.stats.spent += cost;
      log(state, `${p.name} went to market: ${ingText(a.buy)} for 🪙${cost}.`, pi);
    } else if (a.t === 'hunt') {
      const c = state.beasts.find((x) => x.id === a.c);
      state.beasts = state.beasts.filter((x) => x.id !== c.id);
      state.beastPile.push(c);
      refillBeasts(state);
      p.pantry[c.k] += c.n;
      p.stats.hunts++;
      log(state, `${p.name} tracked the ${ING[c.k].beast} to ${BEAST[c.k].where} (${plural(days, 'day')}) and brought back ${c.n > 1 ? `${c.n} ${ING[c.k].name.toLowerCase()}s` : `a ${ING[c.k].name.toLowerCase()}`} ${ING[c.k].icon}.`, pi);
    } else if (a.t === 'brew') {
      a.ks.forEach((k, i) => {
        Object.keys(POTION[k].ing).forEach((x) => (p.pantry[x] -= POTION[k].ing[x]));
        const t = a.tags && Number.isInteger(a.tags[i]) && a.tags[i] >= 1 && a.tags[i] <= 99 ? a.tags[i] : suggestTag(state, pi, k);
        p.shelf.push({ id: nid(state), k, tag: t });
      });
      log(state, `${p.name} brewed ${a.ks.map((k) => POTION[k].name).join(' and ')}.`, pi);
    } else if (a.t === 'visit') {
      const q = state.players[a.from];
      const bits = a.s.map((id) => {
        const s = q.shelf.find((y) => y.id === id);
        q.shelf = q.shelf.filter((y) => y.id !== s.id);
        p.coins -= s.tag;
        q.coins += s.tag;
        p.stats.fromRivals++;
        p.stats.spent += s.tag;
        q.stats.toRivals++;
        q.stats.rivalCoins += s.tag;
        recordSale(state, { to: 'rival', who: a.from, buyer: pi, k: s.k, coins: s.tag });
        p.shelf.push({ id: s.id, k: s.k, tag: Math.max(s.tag + 2, suggestTag(state, pi, s.k)) });
        return `${POTION[s.k].name} for 🪙${s.tag}`;
      });
      log(state, `${p.name} shopped at ${q.name}: bought ${bits.join(' and ')}.`, pi);
    } else if (a.t === 'guild') {
      const bits = a.s.map((id) => {
        const s = p.shelf.find((y) => y.id === id);
        return `${POTION[s.k].name} (🪙${guildSale(state, pi, s, 'guild')})`;
      });
      log(state, `${p.name} sold to the Guild: ${bits.join(', ')}.`, pi);
    } else if (a.t === 'learn') {
      const cost = LEARN_COST[tier(a.k)];
      p.coins -= cost;
      p.stats.spent += cost;
      p.recipes.push(a.k);
      state.library = state.library.filter((k) => k !== a.k);
      if (state.libDeck.length) state.library.push(state.libDeck.shift());
      log(state, `${p.name} bought the recipe for ${POTION[a.k].name} for 🪙${cost}. Only their shop can brew it.`, pi);
    } else if (a.t === 'wait') {
      p.coins += days;
      log(state, `${p.name} minded the shop for ${plural(days, 'day')} and took 🪙${days} from walk-in trade.`, pi);
    }
    autoSell(state, pi);
    const report = { days: [], left: [], came: [], missed: [] };
    move(state, pi, days, report);
    afterMove(state, report);
    return state;
  }

  function guildSale(state, pi, s, why) {
    const p = state.players[pi];
    const c = state.guild[s.k];
    p.coins += c;
    p.shelf = p.shelf.filter((y) => y.id !== s.id);
    state.guild[s.k] = Math.max(guildMin(s.k), c - GUILD_DROP);
    if (why === 'fair') p.stats.fair += c;
    else {
      p.stats.guild++;
      p.stats.guildCoins += c;
    }
    state.sold.push({ to: why, who: pi, k: s.k, coins: c });
    return c;
  }

  // After a move: market days the calendar has reached, then the next turn (or the Moon Fair).
  function afterMove(state, report) {
    const day = today(state);
    while (state.market < MARKET_DAYS.length && day >= MARKET_DAYS[state.market]) {
      report.days.push(marketDay(state, MARKET_DAYS[state.market]));
      state.market++;
    }
    state.report = report;
    if (state.players.every((p) => p.pos >= DAYS)) return moonFair(state);
    state.turn = nextTurn(state);
    // Computer shops re-price whenever the customers around them change.
    state.players.forEach((p, i) => p.ai && retag(state, i));
  }

  function marketDay(state, d) {
    const r = { day: d, restock: {}, guild: [], beastOut: null, beastIn: [], libOut: null, libIn: null };
    COMMONS.forEach((k) => {
      const before = state.supply[k];
      state.supply[k] = Math.min(LADDER.length, before + restock(state));
      r.restock[k] = state.supply[k] - before;
    });
    POTION_ORDER.forEach((k) => {
      const base = TIER[tier(k)].guild;
      if (state.guild[k] < base) {
        state.guild[k] = Math.min(base, state.guild[k] + GUILD_RECOVER);
        r.guild.push(k);
      }
    });
    if (state.beasts.length) {
      r.beastOut = state.beasts.shift();
      state.beastPile.push(r.beastOut);
    }
    const had = new Set(state.beasts.map((c) => c.id));
    refillBeasts(state);
    r.beastIn = state.beasts.filter((c) => !had.has(c.id));
    if (state.library.length && state.libDeck.length) {
      r.libOut = state.library.shift();
      state.libDeck.push(r.libOut);
      r.libIn = state.libDeck.shift();
      state.library.push(r.libIn);
    }
    log(state, `🔔 Market day ${d}: the market restocks, the Guild’s prices recover, new creatures are sighted${r.libIn ? ' and a new recipe reaches the library' : ''}.`);
    return r;
  }

  // Day 28: every potion still on a shelf goes to the Guild, then the richest shop wins.
  function moonFair(state) {
    state.phase = 'over';
    state.turn = -1;
    state.players.forEach((p, i) => {
      p.shelf.slice().sort((a, b) => state.guild[b.k] - state.guild[a.k]).forEach((s) => guildSale(state, i, s, 'fair'));
    });
    log(state, '🌕 The Moon Fair! Every potion left on a shelf was sold to the Guild.');
    const w = winner(state);
    log(state, w < 0 ? '🤝 A tie for the richest shop!' : `🏆 ${state.players[w].name} is the most profitable shop on Cauldron Lane.`);
  }

  function score(state, p) {
    return {
      coins: p.coins,
      start: p.start,
      profit: p.coins - p.start,
      served: p.stats.served,
      custCoins: p.stats.custCoins,
      toRivals: p.stats.toRivals,
      rivalCoins: p.stats.rivalCoins,
      guildCoins: p.stats.guildCoins + p.stats.fair,
      spent: p.stats.spent,
      walk: p.coins - p.start - p.stats.custCoins - p.stats.rivalCoins - p.stats.guildCoins - p.stats.fair + p.stats.spent,
      recipes: p.recipes.length,
      total: p.coins,
    };
  }
  // Index of the richest shop, or -1 for a tie (customers served breaks ties).
  function winner(state) {
    const key = (p) => p.coins * 1000 + p.stats.served;
    const best = Math.max(...state.players.map(key));
    const top = state.players.map((p, i) => (key(p) === best ? i : -1)).filter((i) => i >= 0);
    return top.length === 1 ? top[0] : -1;
  }
  function ranking(state) {
    return state.players.map((p, i) => i).sort((a, b) => state.players[b].coins - state.players[a].coins || state.players[b].stats.served - state.players[a].stats.served);
  }

  // ---------------------------------------------------------------- computer player
  function retag(state, pi) {
    const p = state.players[pi];
    const L = AI[p.level] || AI.normal;
    p.shelf.forEach((s) => (s.tag = suggestTag(state, pi, s.k, L.markup)));
  }

  const noise = (L) => (L.noise ? 1 + (Math.random() * 2 - 1) * L.noise : 1);

  // What it takes to make potion k from what's in the pantry (bag): commons to buy and parts to hunt.
  function shortfall(k, bag) {
    const ing = POTION[k].ing;
    const buy = {};
    const hunt = [];
    Object.keys(ing).forEach((i) => {
      const miss = Math.max(0, ing[i] - (bag[i] || 0));
      if (!miss) return;
      if (ING[i].kind === 'common') buy[i] = miss;
      else for (let n = 0; n < miss; n++) hunt.push(i);
    });
    return { buy, hunt };
  }

  // Who would pay for potion k made by this shop: its own customers it can't already serve, then rivals' customers.
  function demand(state, pi, k, L, ready) {
    const p = state.players[pi];
    const own = p.queue.filter((o) => suits(o, k) && o.leave >= ready && !p.shelf.some((s) => suits(o, s.k))).map((o) => payFor(o, k));
    const others = brewers(state, k).filter((i) => i !== pi).length;
    const theirs = rivalWants(state, pi, k).map((x) => (x.pay - L.markup) * (x.o.min > 1 ? (others ? 0.4 : 0.85) : 0.25));
    return own.concat(theirs).sort((a, b) => b - a);
  }
  // A potion with no buyer yet still sells: a later customer may want it, and the Guild buys whatever is left at the Fair.
  function stockValue(state, pi, k) {
    const p = state.players[pi];
    const left = DAYS - p.pos;
    const same = p.shelf.filter((s) => POTION[s.k].need === POTION[k].need).length;
    const hope = left > 5 ? Math.max(0, (TIER[tier(k)].pay - state.guild[k]) * (same ? 0.25 : 0.6)) : 0;
    return state.guild[k] + hope;
  }

  // Plan value for each recipe this shop could chase: coins it should bring in, per day of work.
  function plans(state, pi, L) {
    const p = state.players[pi];
    const left = DAYS - p.pos;
    const out = [];
    const consider = (k, learn) => {
      const sf = shortfall(k, p.pantry);
      let days = BREW_DAYS;
      let cost = 0;
      if (learn) {
        // A recipe keeps paying after this brew, so only part of its price counts against it.
        days += 1;
        cost += LEARN_COST[tier(k)] / (left > 16 ? 3 : left > 10 ? 2 : 1);
      }
      if (Object.keys(sf.buy).length) {
        const c = marketCost(state, sf.buy);
        if (c == null) return;
        cost += c;
        days += 1;
      }
      if (sf.hunt.length && L.hunt === false) return;
      for (const part of sf.hunt) {
        const cards = state.beasts.filter((c) => c.k === part);
        if (!cards.length) return;
        days += Math.min(...cards.map((c) => beastDays(state, c)));
      }
      if (days > left) return;
      const want = demand(state, pi, k, L, p.pos + days);
      let value = Math.max(want.length ? want[0] : 0, stockValue(state, pi, k));
      if (want.length > 1 && sf.hunt.length) value += want[1] * 0.3;
      const rate = ((value - cost) / days) * noise(L);
      out.push({ k, learn, sf, days, cost, value, rate });
    };
    POTION_ORDER.forEach((k) => knows(p, k) && consider(k, false));
    if (L.learn) state.library.forEach((k) => p.coins >= LEARN_COST[tier(k)] + 6 && consider(k, true));
    // Two potions from one market trip share the trip and the brewing days.
    if (L.pairs) {
      const easy = out.filter((x) => !x.learn && !x.sf.hunt.length && Object.keys(x.sf.buy).length);
      const pairs = [];
      easy.forEach((a, i) => easy.slice(i).forEach((b) => {
        const both = Object.assign({}, a.sf.buy);
        const bag = Object.assign({}, p.pantry);
        Object.keys(POTION[a.k].ing).forEach((x) => (bag[x] = Math.max(0, (bag[x] || 0) - POTION[a.k].ing[x])));
        const more = shortfall(b.k, bag).buy;
        Object.keys(more).forEach((x) => (both[x] = (both[x] || 0) + more[x]));
        const n = Object.values(both).reduce((t, x) => t + x, 0);
        if (!n || n > MARKET_BUY) return;
        const cost = marketCost(state, both);
        if (cost == null || cost > p.coins) return;
        const second = a.k === b.k || POTION[a.k].need === POTION[b.k].need ? Math.min(b.value, state.guild[b.k] + 2) : b.value;
        const days = 1 + BREW_DAYS;
        pairs.push({ k: a.k, k2: b.k, learn: false, sf: { buy: both, hunt: [] }, days, cost, value: a.value + second, rate: ((a.value + second - cost) / days) * noise(L) });
      }));
      out.push(...pairs);
    }
    return out.sort((a, b) => b.rate - a.rate);
  }

  // The best buys from one rival shelf for my waiting customers.
  function bestShopping(state, pi) {
    const p = state.players[pi];
    let shop = null;
    state.players.forEach((q, qi) => {
      if (qi === pi) return;
      const used = new Set();
      const ids = [];
      let gain = 0;
      let cost = 0;
      p.queue.filter((o) => !p.shelf.some((s) => suits(o, s.k))).sort((x, y) => y.min - x.min).forEach((o) => {
        if (ids.length >= VISIT_MAX || p.shelf.length + ids.length >= SHELF) return;
        const pick = q.shelf.filter((y) => suits(o, y.k) && !used.has(y.id) && cost + y.tag <= p.coins)
          .map((y) => ({ y, g: payFor(o, y.k) - y.tag })).sort((a, b) => b.g - a.g)[0];
        const canMake = POTION_ORDER.some((k) => suits(o, k) && knows(p, k));
        if (!pick || pick.g < (canMake ? 3 : 1)) return;
        used.add(pick.y.id);
        cost += pick.y.tag;
        gain += pick.g;
        ids.push(pick.y.id);
      });
      if (ids.length && (!shop || gain > shop.gain)) shop = { gain, a: { t: 'visit', from: qi, s: ids } };
    });
    return shop;
  }

  function aiChoose(state, pi, level) {
    const p = state.players[pi];
    const L = AI[level || p.level] || AI.normal;
    const left = DAYS - p.pos;
    const best = plans(state, pi, L);
    // 1. A rival's shelf has what my customers want, at a price that leaves a profit.
    const shop = bestShopping(state, pi);
    if (shop && shop.gain >= L.margin && (!best.length || shop.gain >= best[0].rate * 0.9)) return shop.a;
    // 2. Brew what the pantry already allows.
    const room = SHELF - p.shelf.length;
    if (room > 0) {
      const bag = Object.assign({}, p.pantry);
      const ks = [];
      const want = (k) => {
        const d = demand(state, pi, k, L, p.pos + BREW_DAYS).length;
        const same = p.shelf.concat(ks.map((x) => ({ k: x }))).some((s) => POTION[s.k].need === POTION[k].need);
        return (d > 0 && !ks.includes(k) ? 100 : 0) + (same ? 0 : 20) + tier(k) * 10 + state.guild[k];
      };
      for (let n = 0; n < Math.min(room, BREW_MAX); n++) {
        const can = POTION_ORDER.filter((k) => knows(p, k) && canBrew(p, k, bag)).sort((a, b) => want(b) - want(a));
        if (!can.length) break;
        ks.push(can[0]);
        Object.keys(POTION[can[0]].ing).forEach((i) => (bag[i] -= POTION[can[0]].ing[i]));
      }
      if (ks.length) {
        const urgent = ks.some((k) => p.queue.some((o) => suits(o, k) && o.leave - p.pos <= 4));
        const top = best[0];
        const waitForPair = ks.length === 1 && room > 1 && top && top.k !== ks[0] && !top.learn && !top.sf.hunt.length && top.days <= 3 && !urgent && left > 6;
        if (!waitForPair) return { t: 'brew', ks };
      }
    }
    // 3. Chase the best plan.
    const top = best[0];
    if (top && top.rate > L.wait) {
      if (top.learn) return { t: 'learn', k: top.k };
      if (top.sf.hunt.length) {
        const part = top.sf.hunt[0];
        const twice = top.sf.hunt.filter((x) => x === part).length > 1;
        const cards = state.beasts.filter((c) => c.k === part).sort((a, b) => (twice ? b.n - a.n : 0) || beastDays(state, a) - beastDays(state, b));
        return { t: 'hunt', c: cards[0].id };
      }
      const buy = Object.assign({}, top.sf.buy);
      if (!top.k2) {
        // Fill the rest of the basket for the next-best plan, or a second copy.
        let n = COMMONS.reduce((t, k) => t + (buy[k] || 0), 0);
        const bag = Object.assign({}, p.pantry);
        Object.keys(POTION[top.k].ing).forEach((i) => (bag[i] = Math.max(0, (bag[i] || 0) - POTION[top.k].ing[i])));
        for (const extra of best.slice(1).filter((x) => !x.learn && !x.sf.hunt.length && !x.k2).concat([top])) {
          const more = shortfall(extra.k, bag).buy;
          const total = Object.values(more).reduce((t, x) => t + x, 0);
          if (!total || n + total > MARKET_BUY) continue;
          const trial = Object.assign({}, buy);
          Object.keys(more).forEach((k) => (trial[k] = (trial[k] || 0) + more[k]));
          const c = marketCost(state, trial);
          if (c == null || c > p.coins) continue;
          Object.assign(buy, trial);
          n += total;
          Object.keys(POTION[extra.k].ing).forEach((i) => (bag[i] = Math.max(0, (bag[i] || 0) - POTION[extra.k].ing[i])));
        }
      }
      const n = COMMONS.reduce((t, k) => t + (buy[k] || 0), 0);
      if (n > 0 && marketCost(state, buy) <= p.coins) return { t: 'market', buy };
    }
    if (shop && shop.gain >= 1) return shop.a;
    // 4. A full shelf nobody wants: clear room at the Guild.
    if (p.shelf.length >= SHELF) {
      const idle = p.shelf.filter((s) => !demand(state, pi, s.k, L, p.pos).length).sort((a, b) => state.guild[b.k] - state.guild[a.k]);
      if (idle.length) return { t: 'guild', s: idle.slice(0, 2).map((s) => s.id) };
    }
    return { t: 'wait' };
  }

  const api = {
    SAVE_V, DAYS, MARKET_DAYS, BELLS, QUEUE, START_CUSTOMERS, START_COINS, SHELF, BESTIARY, LIBRARY, MARKET_BUY, VISIT_MAX, BREW_MAX, BREW_DAYS, LADDER,
    SUPPLY_START, GUILD_DROP, GUILD_FLOOR, GUILD_RECOVER, LEARN_COST, PATIENCE, ING, COMMONS, PARTS, BEAST, NEED, NEED_ORDER, TIER, POTION, POTION_ORDER,
    BASIC, FOLK, FOLK_ORDER, FOLK_MINS, AI,
    newGame, aiHeadStart, legal, apply, aiChoose, score, winner, ranking, clone, today, nextTurn, price, marketCost, guildMin, beastDays, restock,
    canBrew, knows, suggestTag, brewers, salesSince, rivalWants, waitDays, actionDays, bestShopping, tier, ingText, suits, payFor, wantText,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CauldronEngine = api;
})(typeof window !== 'undefined' ? window : this);
