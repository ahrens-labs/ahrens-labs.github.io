// Hero League — rules engine and computer player. No DOM access, so it also runs in Node for simulations.
// A hand-building card game: draw one, discard one into the shared Plaza, and score your best 7-card team at the end.
(function (root) {
  'use strict';

  const SAVE_V = 1;
  const HAND = 7;
  const PLAZA_END = 12; // the game ends the moment the 12th card lands in the Plaza
  const MISSION_DONE = 25; // have both Mission suits
  const MISSION_FIT = 4; // each card of either Mission suit
  const MISSION_FAIL = 10; // missing a Mission suit

  const SUIT = {
    bruiser: { name: 'Bruiser', plural: 'Bruisers', icon: '💪', color: '#d9473f' },
    speed: { name: 'Speedster', plural: 'Speedsters', icon: '⚡', color: '#e0a514' },
    tech: { name: 'Tech', plural: 'Tech', icon: '🔧', color: '#3b7fd6' },
    mystic: { name: 'Mystic', plural: 'Mystics', icon: '🔮', color: '#9b59d0' },
    cosmic: { name: 'Cosmic', plural: 'Cosmics', icon: '🌌', color: '#4b4fc7' },
    shadow: { name: 'Shadow', plural: 'Shadows', icon: '🌑', color: '#4a5263' },
    element: { name: 'Elemental', plural: 'Elementals', icon: '🔥', color: '#e8742a' },
    sidekick: { name: 'Sidekick', plural: 'Sidekicks', icon: '⭐', color: '#3fa860' },
    gear: { name: 'Gear', plural: 'Gear', icon: '🛡️', color: '#a07a3c' },
    villain: { name: 'Villain', plural: 'Villains', icon: '💀', color: '#8c1c3a' },
  };
  const SUITS = Object.keys(SUIT);

  // Effects:
  //   per      +n for each other card of the suits
  //   with     +n if you also have any of the cards (c) or suits (s)
  //   without  +n if you have none of the suits
  //   variety  +n for each different suit in your hand (counting this card)
  //   oracle   your bonus for having both Mission suits is doubled
  //   wild     counts as whichever suit scores best
  //   clear    clears the penalties of every card of the suits ('*' = every card)
  //   pen      −n for each other card of the suits                 (penalty)
  //   penWith  −n if you also have any of the cards                 (penalty)
  //   penNot   −n for each other card that isn't one of the suits   (penalty)
  //   blank    blanks every other card of the suits                 (penalty)
  //   need     this card is blanked unless you have one of c / s    (penalty)
  const PENALTY = new Set(['pen', 'penWith', 'penNot', 'blank', 'need']);
  const CARDS = [
    // Bruisers
    { id: 'ironclad', name: 'Ironclad', suit: 'bruiser', power: 16, fx: [{ t: 'per', s: ['bruiser'], n: 5 }], flavor: 'Steel skin, softer heart.' },
    { id: 'valora', name: 'Valora', suit: 'bruiser', power: 20, fx: [{ t: 'with', c: ['hammer'], n: 12 }], flavor: 'Only she can lift the Star Hammer.' },
    { id: 'rampage', name: 'Rampage', suit: 'bruiser', power: 32, fx: [{ t: 'need', s: ['mystic', 'sidekick'] }], flavor: 'Mighty, if someone keeps him calm.' },
    { id: 'bedrock', name: 'Bedrock', suit: 'bruiser', power: 10, fx: [{ t: 'with', c: ['tremor'], n: 15 }], flavor: 'Made of mountain.' },
    { id: 'brick', name: 'Brick Malone', suit: 'bruiser', power: 4, fx: [{ t: 'per', s: ['villain'], n: 6 }], flavor: 'Lives for a good scrap.' },
    // Speedsters
    { id: 'blur', name: 'Blur', suit: 'speed', power: 12, fx: [{ t: 'per', s: ['speed', 'sidekick'], n: 3 }], flavor: 'First on every scene.' },
    { id: 'flashfire', name: 'Flashfire', suit: 'speed', power: 16, fx: [{ t: 'with', c: ['cinder'], n: 12 }], flavor: 'Runs so fast her trail catches fire.' },
    { id: 'zip', name: 'Zip', suit: 'speed', power: 10, fx: [{ t: 'with', s: ['tech'], n: 14 }], flavor: 'Rocket skates, built by a friend.' },
    { id: 'velocity', name: 'Velocity', suit: 'speed', power: 24, fx: [{ t: 'pen', s: ['gear'], n: 5 }], flavor: 'Travels light. Very light.' },
    { id: 'kinetic', name: 'Kid Kinetic', suit: 'speed', power: 3, fx: [{ t: 'variety', n: 3 }], flavor: 'Wants to team up with everyone.' },
    // Tech
    { id: 'mecha', name: 'Mecha-Max', suit: 'tech', power: 26, fx: [{ t: 'need', s: ['gear'] }], flavor: 'A walking tank that needs a charge.' },
    { id: 'gizmo', name: 'Gizmo', suit: 'tech', power: 12, fx: [{ t: 'per', s: ['gear', 'tech'], n: 4 }], flavor: 'Can fix anything with a paperclip.' },
    { id: 'circuit', name: 'Doc Circuit', suit: 'tech', power: 12, fx: [{ t: 'with', c: ['mecha'], n: 12 }], flavor: 'Built Mecha-Max in his garage.' },
    { id: 'cyberia', name: 'Cyberia', suit: 'tech', power: 15, fx: [{ t: 'with', s: ['speed'], n: 10 }], flavor: 'Thinks at the speed of light.' },
    { id: 'hacklette', name: 'Hacklette', suit: 'tech', power: 6, fx: [{ t: 'clear', s: ['villain'] }], flavor: 'Shuts down evil plans from her laptop.' },
    // Mystics
    { id: 'sable', name: 'Sorcerer Sable', suit: 'mystic', power: 22, fx: [{ t: 'pen', s: ['tech'], n: 5 }], flavor: 'Magic and machines don’t mix.' },
    { id: 'seer', name: 'Seer Sela', suit: 'mystic', power: 1, fx: [{ t: 'oracle' }], flavor: 'She saw this mission coming.' },
    { id: 'hexa', name: 'Hexa', suit: 'mystic', power: 14, fx: [{ t: 'per', s: ['cosmic'], n: 5 }], flavor: 'Draws her spells from the stars.' },
    { id: 'spirit', name: 'Spirit Guide', suit: 'mystic', power: 10, fx: [{ t: 'without', s: ['villain'], n: 22 }], flavor: 'Won’t share a room with evil.' },
    { id: 'moth', name: 'Madame Moth', suit: 'mystic', power: 8, fx: [{ t: 'with', c: ['rampage'], n: 12 }], flavor: 'Sings Rampage to sleep.' },
    // Cosmic
    { id: 'starbolt', name: 'Starbolt', suit: 'cosmic', power: 25, fx: [{ t: 'blank', s: ['shadow'] }], flavor: 'So bright no shadow survives.' },
    { id: 'stellara', name: 'Stellara', suit: 'cosmic', power: 14, fx: [{ t: 'with', c: ['starbolt'], n: 14 }], flavor: 'Starbolt’s twin sister.' },
    { id: 'stargazer', name: 'Old Stargazer', suit: 'cosmic', power: 6, fx: [{ t: 'per', s: ['cosmic', 'mystic'], n: 5 }], flavor: 'Has watched the sky for a thousand years.' },
    { id: 'comet', name: 'Comet', suit: 'cosmic', power: 11, fx: [{ t: 'with', s: ['speed'], n: 10 }], flavor: 'Races speedsters across the sky.' },
    { id: 'gravitas', name: 'Gravitas', suit: 'cosmic', power: 28, fx: [{ t: 'pen', s: ['sidekick'], n: 6 }], flavor: 'Too much gravity for little heroes.' },
    // Shadows
    { id: 'nightshade', name: 'Nightshade', suit: 'shadow', power: 15, fx: [{ t: 'without', s: ['sidekick'], n: 15 }], flavor: 'Works alone. Always.' },
    { id: 'shade', name: 'Shade', suit: 'shadow', power: 11, fx: [{ t: 'per', s: ['shadow'], n: 6 }], flavor: 'Leader of the rooftop crew.' },
    { id: 'whisper', name: 'Whisper', suit: 'shadow', power: 11, fx: [{ t: 'with', s: ['villain'], n: 10 }], flavor: 'Knows every villain’s secret.' },
    { id: 'nyx', name: 'Nyx', suit: 'shadow', power: 18, fx: [{ t: 'pen', s: ['element'], n: 4 }], flavor: 'Hates bright, noisy heroes.' },
    { id: 'mimic', name: 'Mimic', suit: 'shadow', power: 12, fx: [{ t: 'wild' }], flavor: 'Becomes whoever the team needs.' },
    // Elementals
    { id: 'cinder', name: 'Cinder', suit: 'element', power: 15, fx: [{ t: 'with', c: ['flashfire'], n: 10 }], flavor: 'Flashfire’s best friend.' },
    { id: 'frostbite', name: 'Frostbite', suit: 'element', power: 18, fx: [{ t: 'penWith', c: ['cinder'], n: 12 }], flavor: 'Melts near Cinder.' },
    { id: 'tremor', name: 'Tremor', suit: 'element', power: 13, fx: [{ t: 'per', s: ['bruiser'], n: 3 }], flavor: 'Shakes the ground for the big hitters.' },
    { id: 'storm', name: 'Stormcaller', suit: 'element', power: 21, fx: [{ t: 'blank', s: ['gear'] }], flavor: 'Lightning fries every gadget.' },
    { id: 'tidal', name: 'Tidal', suit: 'element', power: 12, fx: [{ t: 'per', s: ['element'], n: 4 }], flavor: 'Brings the elements together.' },
    // Sidekicks
    { id: 'scout', name: 'Scout', suit: 'sidekick', power: 10, fx: [{ t: 'with', s: ['bruiser'], n: 12 }], flavor: 'Carries the big hero’s cape.' },
    { id: 'pip', name: 'Pip', suit: 'sidekick', power: 10, fx: [{ t: 'per', s: ['sidekick'], n: 7 }], flavor: 'Founded the Sidekick Club.' },
    { id: 'robopup', name: 'Robo-Pup', suit: 'sidekick', power: 10, fx: [{ t: 'with', s: ['tech'], n: 12 }], flavor: 'Good boy. Laser eyes.' },
    { id: 'jett', name: 'Jett', suit: 'sidekick', power: 8, fx: [{ t: 'with', s: ['speed'], n: 12 }], flavor: 'Always one step behind. On purpose.' },
    { id: 'penny', name: 'Penny Press', suit: 'sidekick', power: 12, fx: [{ t: 'clear', s: ['bruiser', 'speed'] }], flavor: 'Her headlines keep heroes out of trouble.' },
    // Gear
    { id: 'hammer', name: 'Star Hammer', suit: 'gear', power: 12, fx: [{ t: 'with', s: ['bruiser'], n: 8 }], flavor: 'Forged in a dying star.' },
    { id: 'core', name: 'Power Core', suit: 'gear', power: 3, fx: [{ t: 'per', s: ['tech'], n: 5 }], flavor: 'Runs every machine in the city.' },
    { id: 'jetpack', name: 'Jet Pack', suit: 'gear', power: 12, fx: [{ t: 'with', s: ['sidekick'], n: 12 }], flavor: 'Sidekicks love a jet pack.' },
    { id: 'belt', name: 'Utility Belt', suit: 'gear', power: 10, fx: [{ t: 'per', s: ['shadow', 'sidekick'], n: 4 }], flavor: 'A pouch for every problem.' },
    { id: 'skybase', name: 'Skybase', suit: 'gear', power: 1, fx: [{ t: 'clear', s: ['*'] }], flavor: 'The league’s floating headquarters.' },
    // Villains
    { id: 'entropy', name: 'Dr. Entropy', suit: 'villain', power: 31, fx: [{ t: 'blank', s: ['tech'] }], flavor: 'Every machine he touches breaks.' },
    { id: 'puppeteer', name: 'The Puppeteer', suit: 'villain', power: 30, fx: [{ t: 'blank', s: ['sidekick'] }], flavor: 'Pulls the strings of little heroes.' },
    { id: 'vex', name: 'Viper Vex', suit: 'villain', power: 28, fx: [{ t: 'pen', s: ['sidekick', 'mystic'], n: 6 }], flavor: 'Her venom cuts through any spell.' },
    { id: 'stoneglare', name: 'Stoneglare', suit: 'villain', power: 30, fx: [{ t: 'blank', s: ['bruiser'] }], flavor: 'One look turns muscle to stone.' },
    { id: 'kaos', name: 'Kaos', suit: 'villain', power: 40, fx: [{ t: 'penNot', s: ['villain'], n: 4 }], flavor: 'Wants to watch the whole city fall.' },
  ];
  const CARD = {};
  CARDS.forEach((c, i) => {
    c.i = i;
    CARD[c.id] = c;
  });

  // The Mission: one is turned face up at the start. Hands that fit it score extra.
  const MISSIONS = {
    invasion: { name: 'Alien Invasion', icon: '👽', need: ['cosmic', 'tech'], plus: { s: 'bruiser', n: 6 }, minus: { s: 'sidekick', n: 6 }, story: 'Saucers over the city! Beat them back with cosmic power and clever tech. Bruisers help; sidekicks get in the way.' },
    heist: { name: 'The Bank Heist', icon: '🏦', need: ['speed', 'shadow'], plus: { s: 'gear', n: 6 }, minus: { s: 'bruiser', n: 6 }, story: 'Thieves in the vault. Catch them fast and quietly — gadgets help, but bruisers wreck the bank.' },
    volcano: { name: 'Volcano Rescue', icon: '🌋', need: ['element', 'speed'], plus: { s: 'sidekick', n: 6 }, minus: { s: 'gear', n: 6 }, story: 'The mountain is erupting. Hold back the lava and race everyone to safety. Sidekicks help evacuate; gear melts.' },
    robots: { name: 'Robot Uprising', icon: '🤖', need: ['tech', 'bruiser'], plus: { s: 'element', n: 6 }, minus: { s: 'mystic', n: 6 }, story: 'The city’s robots have turned. Hack them and smash them. Lightning and fire help; spells bounce off steel.' },
    ritual: { name: 'The Dark Ritual', icon: '🕯️', need: ['mystic', 'shadow'], plus: { s: 'cosmic', n: 6 }, minus: { s: 'tech', n: 6 }, story: 'A cult is opening a portal under the city. Fight magic with magic, in the dark. Machines go haywire down there.' },
    prison: { name: 'Prison Break', icon: '⛓️', need: ['bruiser', 'shadow'], plus: { s: 'villain', n: 8 }, minus: { s: 'cosmic', n: 6 }, story: 'Every villain is loose. Every villain in your hand counts as recaptured. Cosmic heroes are off-world.' },
    meteor: { name: 'Meteor Strike', icon: '☄️', need: ['cosmic', 'bruiser'], plus: { s: 'speed', n: 6 }, minus: { s: 'shadow', n: 6 }, story: 'A meteor is heading for downtown. Push it back into space! Speedsters clear the streets; shadows aren’t much use.' },
    parade: { name: 'Hero Parade', icon: '🎉', need: ['sidekick', 'gear'], plus: { s: 'speed', n: 6 }, minus: { s: 'villain', n: 8 }, story: 'The city throws a parade for its heroes. Bring the sidekicks and the shiny gear — and keep villains far away.' },
  };
  const MISSION_ORDER = Object.keys(MISSIONS);

  // Secret identities: each league is dealt two and secretly keeps one. Only revealed when the hands go down.
  //   per      +n for each card of the suits
  //   variety  +n for each different suit
  //   without  +n if you have none of the suits
  const IDENTITIES = {
    brawler: { name: 'The Brawler', icon: '🥊', rule: { t: 'per', s: ['bruiser'], n: 10 }, story: 'Grew up fighting in the docks.' },
    racer: { name: 'The Racer', icon: '🏁', rule: { t: 'per', s: ['speed'], n: 11 }, story: 'Never lost a race. Never will.' },
    inventor: { name: 'The Inventor', icon: '🧪', rule: { t: 'per', s: ['tech', 'gear'], n: 7 }, story: 'Owns a secret lab under the city.' },
    sorcerer: { name: 'The Sorcerer', icon: '📜', rule: { t: 'per', s: ['mystic'], n: 11 }, story: 'Last student of an ancient order.' },
    stranger: { name: 'The Stranger', icon: '🛸', rule: { t: 'per', s: ['cosmic'], n: 10 }, story: 'Fell from the stars as a baby.' },
    vigilante: { name: 'The Vigilante', icon: '🦇', rule: { t: 'per', s: ['shadow'], n: 12 }, story: 'Patrols the rooftops every night.' },
    elemental: { name: 'The Storm-Born', icon: '🌪️', rule: { t: 'per', s: ['element'], n: 12 }, story: 'Born in the eye of a hurricane.' },
    mentor: { name: 'The Mentor', icon: '🎓', rule: { t: 'per', s: ['sidekick'], n: 12 }, story: 'Trained half the heroes in town.' },
    turncoat: { name: 'The Turncoat', icon: '🃏', rule: { t: 'per', s: ['villain'], n: 9 }, story: 'Used to work for the other side.' },
    allrounder: { name: 'The Captain', icon: '🎖️', rule: { t: 'variety', n: 3 }, story: 'Can lead any team, any day.' },
    lonewolf: { name: 'The Lone Wolf', icon: '🐺', rule: { t: 'without', s: ['sidekick', 'gear'], n: 20 }, story: 'No helpers. No gadgets. No problem.' },
    paragon: { name: 'The Paragon', icon: '😇', rule: { t: 'without', s: ['villain'], n: 22 }, story: 'Has never broken a rule. Not once.' },
  };
  const IDENTITY_ORDER = Object.keys(IDENTITIES);
  function identityText(id) {
    const r = IDENTITIES[id].rule;
    const names = (ss) => ss.map((x) => SUIT[x].name).join(' or ');
    if (r.t === 'per') return `+${r.n} for each ${names(r.s)}`;
    if (r.t === 'variety') return `+${r.n} for each different suit in your team`;
    return `+${r.n} if you have no ${r.s.map((x) => SUIT[x].plural).join(' or ')}`;
  }

  const LEVELS = {
    easy: { look: false, noise: 9, deny: 0, extra: 0 },
    normal: { look: true, noise: 4, deny: 0, extra: 0 },
    hard: { look: true, noise: 0, deny: 0.15, extra: 1 },
    brutal: { look: true, noise: 0, deny: 0.2, extra: 2 },
  };

  // ---------------------------------------------------------------- helpers
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
  function log(state, text, who) {
    state.log.push({ n: state.turns, text, who: who == null ? null : who });
    if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
  }
  const suitList = (ss) => {
    const names = ss.map((s) => SUIT[s].plural);
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0];
  };
  const suitOne = (ss) => {
    const names = ss.map((s) => `${/^[AEIOU]/.test(SUIT[s].name) ? 'an' : 'a'} ${SUIT[s].name}`);
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0];
  };
  const cardList = (cs) => cs.map((c) => CARD[c].name).join(' or ');

  // The rules text printed on a card, written from its effect data so it can't drift.
  function fxText(f, self) {
    const other = (ss) => (self && ss.includes(self.suit) ? 'other ' : '');
    switch (f.t) {
      case 'per':
        return `+${f.n} for each ${other(f.s)}${f.s.map((s) => SUIT[s].name).join(' and ')}`;
      case 'with':
        return `+${f.n} with ${f.c ? cardList(f.c) : `any ${f.s.map((s) => SUIT[s].name).join(' or ')}`}`;
      case 'without':
        return `+${f.n} if you have no ${f.s.map((s) => SUIT[s].name).join(' or ')}`;
      case 'variety':
        return `+${f.n} for each different suit in your hand`;
      case 'oracle':
        return `Doubles your bonus for completing the Mission`;
      case 'wild':
        return `Counts as any one suit you like`;
      case 'clear':
        return f.s[0] === '*' ? 'Clears every penalty in your hand' : `Clears the penalty on every ${f.s.map((s) => SUIT[s].name).join(' and ')}`;
      case 'pen':
        return `−${f.n} for each ${other(f.s)}${f.s.map((s) => SUIT[s].name).join(' and ')}`;
      case 'penWith':
        return `−${f.n} with ${cardList(f.c)}`;
      case 'penNot':
        return `−${f.n} for each other card that isn’t a ${f.s.map((s) => SUIT[s].name).join(' or ')}`;
      case 'blank':
        return `Blanks every ${f.s.map((s) => SUIT[s].name).join(' and ')}`;
      case 'need':
        return `Blanked unless you have ${f.c ? cardList(f.c) : suitOne(f.s)}`;
      default:
        return '';
    }
  }
  const cardText = (id) => CARD[id].fx.map((f) => fxText(f, CARD[id])).join('. ');
  const isPenalty = (id) => CARD[id].fx.some((f) => PENALTY.has(f.t));

  // ---------------------------------------------------------------- scoring
  // Order: suits are fixed (Mimic picks one) → penalties are cleared → blanking (all at once) → "blanked unless" →
  // each card scores its power, bonuses and uncleared penalties → the Mission.
  function scoreWith(ids, mission, wildSuit, identity) {
    const cs = ids.map((id) => CARD[id]);
    const suitOf = {};
    cs.forEach((c) => (suitOf[c.id] = c.fx.some((f) => f.t === 'wild') && wildSuit ? wildSuit : c.suit));
    const clearers = cs.flatMap((c) => c.fx.filter((f) => f.t === 'clear').map((f) => ({ by: c.id, s: f.s })));
    const clearedBy = {};
    cs.forEach((c) => {
      const cl = clearers.find((x) => x.by !== c.id && (x.s[0] === '*' || x.s.includes(suitOf[c.id])));
      if (cl) clearedBy[c.id] = cl.by;
    });
    const live = (c) => !clearedBy[c.id];
    const blankedBy = {};
    cs.forEach((c) => {
      if (!live(c)) return;
      c.fx.filter((f) => f.t === 'blank').forEach((f) => {
        cs.forEach((o) => {
          if (o.id !== c.id && f.s.includes(suitOf[o.id]) && !blankedBy[o.id]) blankedBy[o.id] = c.id;
        });
      });
    });
    const matches = (o, f) => (f.c ? f.c.includes(o.id) : f.s.includes(suitOf[o.id]));
    for (let changed = true; changed; ) {
      changed = false;
      cs.forEach((c) => {
        if (blankedBy[c.id] || !live(c)) return;
        c.fx.filter((f) => f.t === 'need').forEach((f) => {
          if (blankedBy[c.id]) return;
          if (!cs.some((o) => o.id !== c.id && !blankedBy[o.id] && matches(o, f))) {
            blankedBy[c.id] = c.id;
            changed = true;
          }
        });
      });
    }
    const on = cs.filter((c) => !blankedBy[c.id]);
    const others = (c) => on.filter((o) => o.id !== c.id);
    const cards = cs.map((c) => {
      const row = { id: c.id, suit: suitOf[c.id], base: c.power, plus: [], minus: [], blanked: blankedBy[c.id] || null, cleared: clearedBy[c.id] || null, value: 0 };
      if (row.blanked) return row;
      c.fx.forEach((f) => {
        const pen = PENALTY.has(f.t);
        let n = 0;
        if (f.t === 'per') n = others(c).filter((o) => f.s.includes(suitOf[o.id])).length * f.n;
        else if (f.t === 'with') n = others(c).some((o) => matches(o, f)) ? f.n : 0;
        else if (f.t === 'without') n = others(c).some((o) => f.s.includes(suitOf[o.id])) ? 0 : f.n;
        else if (f.t === 'variety') n = new Set(on.map((o) => suitOf[o.id])).size * f.n;
        else if (f.t === 'pen') n = others(c).filter((o) => f.s.includes(suitOf[o.id])).length * f.n;
        else if (f.t === 'penWith') n = others(c).some((o) => f.c.includes(o.id)) ? f.n : 0;
        else if (f.t === 'penNot') n = others(c).filter((o) => !f.s.includes(suitOf[o.id])).length * f.n;
        if (!n) return;
        if (pen) {
          if (row.cleared) row.minus.push({ n: 0, text: `${fxText(f, c)} (cleared)` });
          else row.minus.push({ n, text: fxText(f, c) });
        } else row.plus.push({ n, text: fxText(f, c) });
      });
      row.value = row.base + row.plus.reduce((t, x) => t + x.n, 0) - row.minus.reduce((t, x) => t + x.n, 0);
      return row;
    });
    const M = MISSIONS[mission];
    const count = (s) => on.filter((o) => suitOf[o.id] === s).length;
    const mult = on.some((c) => c.fx.some((f) => f.t === 'oracle')) ? 2 : 1;
    const done = M.need.every((s) => count(s) > 0);
    const fit = M.need.reduce((t, s) => t + count(s), 0);
    const m = {
      done,
      doneN: done ? MISSION_DONE * mult : 0,
      fit,
      fitN: fit * MISSION_FIT,
      failN: done ? 0 : MISSION_FAIL,
      plusN: count(M.plus.s) * M.plus.n,
      minusN: count(M.minus.s) * M.minus.n,
      mult,
    };
    m.total = m.doneN + m.fitN + m.plusN - m.minusN - m.failN;
    // The secret identity: blanked cards don't count, Mimic counts as its chosen suit.
    let idN = 0;
    if (identity && IDENTITIES[identity]) {
      const r = IDENTITIES[identity].rule;
      if (r.t === 'per') idN = r.s.reduce((t, x) => t + count(x), 0) * r.n;
      else if (r.t === 'variety') idN = new Set(on.map((o) => suitOf[o.id])).size * r.n;
      else if (r.t === 'without') idN = r.s.some((x) => count(x) > 0) ? 0 : r.n;
    }
    const cardsTotal = cards.reduce((t, r) => t + r.value, 0);
    return { total: cardsTotal + m.total + idN, cardsTotal, cards, mission: m, ident: identity ? { id: identity, n: idN } : null, wild: wildSuit || null };
  }
  function scoreHand(ids, mission, identity) {
    if (!ids.some((id) => CARD[id].fx.some((f) => f.t === 'wild'))) return scoreWith(ids, mission, null, identity);
    let best = null;
    SUITS.forEach((s) => {
      const r = scoreWith(ids, mission, s, identity);
      if (!best || r.total > best.total) best = r;
    });
    return best;
  }
  const handScore = (ids, mission, identity) => scoreHand(ids, mission, identity).total;

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
      phase: 'draw',
      turn: 0,
      first: 0,
      turns: 0,
      mission: null,
      deck: [],
      plaza: [],
      players: [],
      log: [],
      last: null,
      ended: null,
    };
    state.mission = opts.mission && MISSIONS[opts.mission] ? opts.mission : MISSION_ORDER[rint(state, MISSION_ORDER.length)];
    state.deck = shuffle(state, CARDS.map((c) => c.id));
    names.forEach((name, i) => {
      state.players.push({ name, ai: !!ai[i], level: ai[i] ? levels[i] || 'normal' : null, hand: [], fresh: null, drew: null, stats: { plaza: 0, deck: 0 }, took: [], identity: null, idOffer: null });
    });
    const ids = shuffle(state, IDENTITY_ORDER.slice());
    state.players.forEach((p, i) => (p.idOffer = [ids[2 * i], ids[2 * i + 1]]));
    const first = opts.first != null ? ((opts.first % n) + n) % n : 0;
    state.first = first;
    state.turn = first;
    for (let r = 0; r < HAND; r++) for (let k = 0; k < n; k++) state.players[(first + k) % n].hand.push(state.deck.pop());
    log(state, `Today’s Mission: ${MISSIONS[state.mission].name}. ${n} leagues are recruiting.`);
    return state;
  }

  // Hard and Brutal computer leagues are dealt extra cards and put their weakest back on the bottom of the deck.
  function aiHeadStart(state, pi, level) {
    const L = LEVELS[level];
    if (!L || !L.extra) return;
    const p = state.players[pi];
    for (let k = 0; k < L.extra; k++) {
      p.hand.push(state.deck.pop());
      const out = bestDiscard(p.hand, state.mission, null, null, null, null, p.identity).id;
      p.hand.splice(p.hand.indexOf(out), 1);
      state.deck.unshift(out);
    }
  }

  // ---------------------------------------------------------------- moves
  function legal(state, pi) {
    const p = state.players[pi];
    if (state.phase === 'draw') {
      const out = state.plaza.map((c) => ({ t: 'draw', from: 'plaza', c }));
      if (state.deck.length) out.unshift({ t: 'draw', from: 'deck' });
      return out;
    }
    if (state.phase === 'discard') return p.hand.filter((c) => c !== p.fresh).map((c) => ({ t: 'discard', c }));
    return [];
  }

  function apply(state, pi, a) {
    if (state.phase === 'over') throw new Error('The game is over.');
    // Choosing a secret identity can happen before your first turn comes round.
    if (a.t === 'identity') {
      const q = state.players[pi];
      if (!q || !q.idOffer) throw new Error('You already have a secret identity.');
      if (!q.idOffer.includes(a.id)) throw new Error('That identity wasn’t dealt to you.');
      q.identity = a.id;
      q.idOffer = null;
      log(state, `${q.name} chose a secret identity.`, pi);
      return state;
    }
    if (pi !== state.turn) throw new Error('It isn’t your turn.');
    const p = state.players[pi];
    if (p.idOffer) throw new Error('Choose your secret identity first.');
    if (a.t === 'draw') {
      if (state.phase !== 'draw') throw new Error('You’ve already drawn this turn.');
      if (a.from === 'deck') {
        if (!state.deck.length) throw new Error('The deck is empty.');
        const c = state.deck.pop();
        p.hand.push(c);
        p.fresh = null;
        p.drew = c;
        p.stats.deck++;
        log(state, `${p.name} drew from the deck.`, pi);
      } else {
        const k = state.plaza.indexOf(a.c);
        if (k < 0) throw new Error('That card isn’t in the Plaza.');
        state.plaza.splice(k, 1);
        p.hand.push(a.c);
        p.fresh = a.c;
        p.drew = a.c;
        p.stats.plaza++;
        p.took.push(a.c);
        log(state, `${p.name} recruited ${CARD[a.c].name} from the Plaza.`, pi);
      }
      state.phase = 'discard';
      state.last = { who: pi, from: a.from, took: a.from === 'plaza' ? a.c : null, gave: null };
      return state;
    }
    if (a.t === 'discard') {
      if (state.phase !== 'discard') throw new Error('Draw a card first.');
      if (a.c === p.fresh) throw new Error('You can’t send back the card you just recruited from the Plaza.');
      const k = p.hand.indexOf(a.c);
      if (k < 0) throw new Error('That card isn’t in your hand.');
      p.hand.splice(k, 1);
      state.plaza.push(a.c);
      p.took = p.took.filter((c) => c !== a.c);
      p.fresh = null;
      p.drew = null;
      state.last.gave = a.c;
      state.turns++;
      log(state, `${p.name} sent ${CARD[a.c].name} to the Plaza.`, pi);
      if (state.plaza.length >= PLAZA_END || !state.deck.length) {
        state.ended = state.plaza.length >= PLAZA_END ? 'plaza' : 'deck';
        state.phase = 'over';
        log(state, state.ended === 'plaza' ? `The ${PLAZA_END}th hero reached the Plaza. Hands down — time to score!` : 'The deck ran out. Hands down — time to score!');
        return state;
      }
      state.turn = (pi + 1) % state.players.length;
      state.phase = 'draw';
      return state;
    }
    throw new Error('Unknown move.');
  }

  // ---------------------------------------------------------------- results
  function score(state, p) {
    const r = scoreHand(p.hand, state.mission, p.identity);
    return {
      total: r.total,
      cards: r.cardsTotal,
      mission: r.mission.total,
      ident: r.ident ? r.ident.n : 0,
      done: r.mission.done ? 1 : 0,
      blanked: r.cards.filter((c) => c.blanked).length,
      bonus: r.cards.reduce((t, c) => t + c.plus.reduce((u, x) => u + x.n, 0), 0),
      penalty: r.cards.reduce((t, c) => t + c.minus.reduce((u, x) => u + x.n, 0), 0),
      base: r.cards.reduce((t, c) => t + (c.blanked ? 0 : c.base), 0),
      plaza: p.stats.plaza,
    };
  }
  function ranking(state) {
    const sc = state.players.map((p) => score(state, p));
    // Ties go to the hand with more base power (the stronger team on paper), then to the later seat.
    return state.players.map((_, i) => i).sort((a, b) => sc[b].total - sc[a].total || sc[b].base - sc[a].base || b - a);
  }
  function winner(state) {
    const sc = state.players.map((p) => score(state, p));
    const r = ranking(state);
    if (r.length > 1 && sc[r[0]].total === sc[r[1]].total && sc[r[0]].base === sc[r[1]].base) return -1;
    return r[0];
  }

  // ---------------------------------------------------------------- computer player
  // The best card to let go from a hand (never the one just recruited from the Plaza).
  function bestDiscard(hand, mission, keep, L, state, pi, identity) {
    let best = null;
    hand.forEach((c) => {
      if (c === keep) return;
      const rest = hand.filter((x) => x !== c);
      let v = handScore(rest, mission, identity);
      if (L && L.deny) v -= L.deny * gift(state, pi, c);
      if (L && L.noise) v += (Math.random() * 2 - 1) * L.noise;
      if (!best || v > best.v) best = { id: c, v };
    });
    return best;
  }
  // Roughly how much a card would help whoever gets it next: its power, plus what it adds to the cards they've been seen taking.
  function gift(state, pi, c) {
    if (!state) return 0;
    let worst = CARD[c].power * 0.5;
    state.players.forEach((q, qi) => {
      if (qi === pi || !q.took.length) return;
      const seen = q.took.slice(-6);
      const gain = handScore(seen.concat(c), state.mission) - handScore(seen, state.mission) - CARD[c].power;
      worst = Math.max(worst, CARD[c].power * 0.5 + Math.max(0, gain));
    });
    return worst;
  }
  // Cards this player hasn't seen: not in their hand and not in the Plaza.
  const unseen = (state, pi) => {
    const mine = new Set(state.players[pi].hand.concat(state.plaza));
    return CARDS.map((c) => c.id).filter((id) => !mine.has(id));
  };

  // The identity that suits this hand best (with a little guesswork on Easy).
  function aiIdentity(state, pi, level) {
    const L = LEVELS[level] || LEVELS.normal;
    const p = state.players[pi];
    let best = null;
    p.idOffer.forEach((id) => {
      const v = handScore(p.hand, state.mission, id) + (L.noise ? (Math.random() * 2 - 1) * L.noise * 2 : 0);
      if (!best || v > best.v) best = { id, v };
    });
    return { t: 'identity', id: best.id };
  }
  function aiChoose(state, pi, level) {
    const L = LEVELS[level] || LEVELS.normal;
    const p = state.players[pi];
    if (p.idOffer) return aiIdentity(state, pi, level);
    const idt = p.identity;
    if (state.phase === 'discard') return { t: 'discard', c: bestDiscard(p.hand, state.mission, p.fresh, L, state, pi, idt).id };
    const now = handScore(p.hand, state.mission, idt);
    let best = null;
    state.plaza.forEach((c) => {
      const d = bestDiscard(p.hand.concat(c), state.mission, c, null, null, null, idt);
      let v = d.v;
      if (L.noise) v += (Math.random() * 2 - 1) * L.noise;
      if (!best || v > best.v) best = { a: { t: 'draw', from: 'plaza', c }, v };
    });
    if (!state.deck.length) return best.a;
    let deckV;
    if (L.look) {
      const pool = unseen(state, pi);
      deckV = pool.reduce((t, c) => t + Math.max(now, bestDiscard(p.hand.concat(c), state.mission, null, null, null, null, idt).v), 0) / pool.length;
    } else deckV = now + 2;
    // Drawing from the deck with the Plaza one short of full ends the game: only do that when it's a good moment.
    if (state.plaza.length === PLAZA_END - 1 && L.look) deckV += endBias(state, pi, now);
    if (!best || deckV >= best.v) return { t: 'draw', from: 'deck' };
    return best.a;
  }
  // Ending the game now is good if this hand already looks like a winner, bad if it's still weak.
  function endBias(state, pi, now) {
    const par = 95 + state.players.length * 4;
    return Math.max(-12, Math.min(12, (now - par) * 0.3));
  }

  const api = {
    SAVE_V, HAND, PLAZA_END, MISSION_DONE, MISSION_FIT, MISSION_FAIL, SUIT, SUITS, CARDS, CARD, MISSIONS, MISSION_ORDER, LEVELS,
    IDENTITIES, IDENTITY_ORDER, identityText, aiIdentity,
    newGame, aiHeadStart, legal, apply, aiChoose, score, ranking, winner,
    scoreHand, handScore, fxText, cardText, isPenalty, bestDiscard, unseen,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HeroesEngine = api;
})(typeof window !== 'undefined' ? window : this);
