// Atlantis Expedition — rules engine and computer player. No DOM access, so it also runs in Node for simulations.
(function (root) {
  'use strict';

  const SAVE_V = 2;
  const TIDES = 10;
  const HEART_TIDE = 6;
  const START_GOLD = 7;
  const INCOME = 4;
  const MAX_SUBS = 3;
  const MAX_DIVERS = 8;
  const MARKET_SIZE = 5;
  const UNCOVERED = 3;
  const SCOUT_MAX = 3;
  const KNOWN_BONUS = 1;
  const UNCHARTED = 3;
  // Out of their depth: per level too deep, the roll penalty and the chance (on a failed dive) of losing them.
  const DIVER_DEEP_PEN = 2;
  const DIVER_LOST = 0.35;
  const SUB_DEEP_PEN = 4;
  const SUB_CRUSH = 0.35;
  // No sub: up to SWIM_CREW divers swim out from the dive boat. No sub bonus or fittings, a flat penalty, the deep
  // penalty of a sub built for the Shallows, and (on a failed dive below the Shallows) a chance per zone of losing each swimmer.
  const SWIM_CREW = 2;
  const SWIM_PEN = 3;
  const SWIM_LOST = 0.2;
  const PROMO_XP = 2;
  const DISCOVERY_PTS = 2;
  const GOLD_PER_PT = 4;
  const GOAL_COUNT = 3;

  // Hazards: what goes wrong on a failed dive when nobody on the crew (or the sub) is ready for it.
  const HAZ = {
    air: { icon: '🫧', name: 'Thin air', ready: 'Free-divers and oxygen tanks', fail: 'ran out of air and had to race for the surface', effect: 'The crew rests next tide.' },
    shark: { icon: '🦈', name: 'Sharks', ready: 'Shark wranglers and shark cages', fail: 'was attacked by a shark', effect: 'A shark eats one diver.' },
    cave: { icon: '🪨', name: 'Tight tunnels', ready: 'Cave divers and drill arms', fail: 'got stuck in a collapsing tunnel', effect: 'The sub is stuck for 2 tides.', swim: 'The swimmers rest for 2 tides.' },
    current: { icon: '🌀', name: 'Currents', ready: 'Current riders and stabilisers', fail: 'was swept away by a current', effect: 'Lose 🪙3 of gear; the sub is out next tide.', swim: 'Lose 🪙3 of gear; the swimmers rest next tide.' },
    dark: { icon: '🌑', name: 'Darkness', ready: 'Lamplighters and floodlights', fail: 'got lost in the dark', effect: 'The crew rests next tide.' },
    trap: { icon: '🗿', name: 'Atlantean traps', ready: 'Archaeologists and glyph decoders', fail: 'set off an ancient trap', effect: 'Pay 🪙2 for repairs; the sub is out next tide.', swim: 'Pay 🪙2; the swimmers rest next tide.' },
    kraken: { icon: '🐙', name: 'The Kraken', ready: 'Kraken hunters and harpoons', fail: 'woke the Kraken', effect: 'The sub is destroyed.', swim: 'The Kraken takes one swimmer.' },
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

  // Sub fittings. Each shows the icon of the hazard it makes safe.
  const MOD = {
    tanks: { name: 'Oxygen tanks', icon: '🫧', haz: 'air', cost: 3 },
    cage: { name: 'Shark cage', icon: '🦈', haz: 'shark', cost: 3 },
    drill: { name: 'Drill arm', icon: '🪨', haz: 'cave', cost: 3 },
    fins: { name: 'Stabilisers', icon: '🌀', haz: 'current', cost: 3 },
    lamps: { name: 'Floodlights', icon: '🌑', haz: 'dark', cost: 3 },
    decoder: { name: 'Glyph decoder', icon: '🗿', haz: 'trap', cost: 3 },
    harpoon: { name: 'Harpoon', icon: '🐙', haz: 'kraken', cost: 5 },
  };
  const MOD_ORDER = ['tanks', 'cage', 'drill', 'fins', 'lamps', 'decoder', 'harpoon'];

  // Divers for hire: skill is added to every dive; each specialty cancels that hazard's penalty.
  // `deep` is the deepest water a diver is trained for (1 Shallows, 2 Deep, 3 Abyss); a promotion adds one.
  const DIVER = {
    rookie: { role: 'Rookie diver', skill: 1, deep: 1, spec: [], cost: 2, wage: 1, n: 4 },
    wrangler: { role: 'Shark wrangler', skill: 1, deep: 2, spec: ['shark'], cost: 4, wage: 1, n: 2 },
    freediver: { role: 'Free-diver', skill: 1, deep: 2, spec: ['air'], cost: 4, wage: 1, n: 2 },
    caver: { role: 'Cave diver', skill: 1, deep: 2, spec: ['cave'], cost: 4, wage: 1, n: 2 },
    rider: { role: 'Current rider', skill: 1, deep: 2, spec: ['current'], cost: 4, wage: 1, n: 2 },
    lamplighter: { role: 'Lamplighter', skill: 1, deep: 2, spec: ['dark'], cost: 4, wage: 1, n: 2 },
    archaeologist: { role: 'Archaeologist', skill: 1, deep: 2, spec: ['trap'], cost: 4, wage: 1, n: 2 },
    veteran: { role: 'Veteran diver', skill: 2, deep: 2, spec: [], cost: 5, wage: 1, n: 2 },
    deepdiver: { role: 'Deep diver', skill: 2, deep: 3, spec: ['air', 'dark'], cost: 7, wage: 2, n: 1 },
    hunter: { role: 'Treasure hunter', skill: 2, deep: 3, spec: ['cave', 'trap'], cost: 7, wage: 2, n: 1 },
    stormdiver: { role: 'Storm diver', skill: 2, deep: 3, spec: ['current', 'shark'], cost: 7, wage: 2, n: 1 },
    krakenhunter: { role: 'Kraken hunter', skill: 2, deep: 3, spec: ['kraken', 'shark'], cost: 8, wage: 2, n: 1 },
    captain: { role: 'Legendary captain', skill: 3, deep: 3, spec: ['air', 'current', 'dark'], cost: 11, wage: 3, n: 1 },
    professor: { role: 'Professor of Atlantis', skill: 3, deep: 3, spec: ['trap', 'cave', 'kraken'], cost: 11, wage: 3, n: 1 },
  };
  const DIVER_ORDER = Object.keys(DIVER);
  // Names follow the diver's portrait on the page (rookies come in three looks, picked by id; the first is a woman).
  const NAMES_F = ['Marina', 'Coral', 'Nerissa', 'Maren', 'Delphine', 'Ondine', 'Shelly', 'Isla', 'Doris', 'Ripley', 'Tula', 'Dory', 'Sandy', 'Mira', 'Wren', 'Oceana'];
  const NAMES_M = ['Finn', 'Kai', 'Bruce', 'Jonah', 'Wade', 'Murray', 'Caspian', 'Neptune Jr.', 'Gil', 'Hal', 'Ahab', 'Zeke', 'Barnaby', 'Otto', 'Rex'];
  const NAMES_ANY = ['Morgan', 'Brook', 'Reef', 'Splash', 'Lagoon'];
  const FEMALE_LOOK = { wrangler: 1, caver: 1, lamplighter: 1, archaeologist: 1, deepdiver: 1, stormdiver: 1, professor: 1 };
  const femaleLook = (k, id) => (k === 'rookie' ? id % 3 === 0 : !!FEMALE_LOOK[k]);

  // Relics come from tricky and harder sites and score in sets of different kinds.
  const RELIC = {
    crown: { icon: '👑', name: 'Royal jewels' },
    scroll: { icon: '📜', name: 'Lost scrolls' },
    crystal: { icon: '🔮', name: 'Orichalcum crystals' },
    urn: { icon: '🏺', name: 'Golden urns' },
  };
  const RELIC_ORDER = ['crown', 'scroll', 'crystal', 'urn'];
  const RELIC_SET = [0, 1, 3, 6, 10];

  // Tier: 1 easy … 4 extreme; 5 is the Heart of Atlantis.
  const TIER = {
    1: { name: 'Easy', target: 6, treasure: 3, gold: 2, stars: 1, spread: 1 },
    2: { name: 'Tricky', target: 10, treasure: 5, gold: 3, stars: 2, spread: 1 },
    3: { name: 'Hard', target: 14, treasure: 8, gold: 4, stars: 3, spread: 2 },
    4: { name: 'Extreme', target: 16, treasure: 12, gold: 5, stars: 4, spread: 2 },
    5: { name: 'Legendary', target: 18, treasure: 20, gold: 6, stars: 5, spread: 3 },
  };
  const SITE = {
    reef: { name: 'Coral Gate Reef', short: 'Coral Gate', tier: 1, depth: 1, haz: ['shark'], blurb: 'Gold coins tangled in the coral at the city gate.' },
    market: { name: 'Sunken Fish Market', short: 'Fish Market', tier: 1, depth: 1, haz: ['current'], blurb: 'Stalls still full of silver scales and bronze weights.' },
    statue: { name: 'Toppled Statue', short: 'Statue', tier: 1, depth: 1, haz: ['cave'], blurb: 'A fallen giant with jewels for eyes.' },
    lighthouse: { name: 'Drowned Lighthouse', short: 'Lighthouse', tier: 1, depth: 1, haz: ['dark'], blurb: 'Its great crystal lens lies somewhere in the gloom.' },
    amphora: { name: 'Amphora Field', short: 'Amphorae', tier: 1, depth: 1, haz: ['air'], blurb: 'Hundreds of sealed jars. Some hold pearls.' },
    garden: { name: 'Kelp Garden', short: 'Kelp Garden', tier: 1, depth: 1, haz: ['current'], blurb: 'The queen’s garden, gone wild under the waves.' },
    docks: { name: 'Old Harbor Docks', short: 'Old Docks', tier: 1, depth: 1, haz: ['shark'], blurb: 'Trading ships sank here with their cargo.' },
    wreck: { name: 'Merchant Shipwreck', short: 'Shipwreck', tier: 1, depth: 1, haz: ['air'], blurb: 'A galley split in two, its hold spilling silver.' },
    meadow: { name: 'Turtle Meadow', short: 'Turtle Meadow', tier: 1, depth: 1, haz: ['current'], blurb: 'Sea turtles graze over a meadow of bronze coins.' },
    bells: { name: 'Sunken Bell Tower', short: 'Bell Tower', tier: 1, depth: 1, haz: ['dark'], blurb: 'Its bronze bells still ring when the tide turns.' },
    baths: { name: 'Royal Baths', short: 'Royal Baths', tier: 2, depth: 1, haz: ['air', 'cave'], relic: 'urn', blurb: 'Marble pools, golden taps, narrow pipes.' },
    arena: { name: 'Water Arena', short: 'Arena', tier: 2, depth: 2, haz: ['shark', 'current'], relic: 'crown', blurb: 'Champions’ crowns still lie in the sand.' },
    mosaic: { name: 'Mosaic Plaza', short: 'Mosaic Plaza', tier: 2, depth: 2, haz: ['dark', 'trap'], relic: 'crystal', blurb: 'Every tile is a tiny gem. Some tiles are traps.' },
    aqueduct: { name: 'Broken Aqueduct', short: 'Aqueduct', tier: 2, depth: 1, haz: ['cave', 'current'], relic: 'urn', blurb: 'Water still roars through the old channels.' },
    barracks: { name: 'Sunken Barracks', short: 'Barracks', tier: 2, depth: 2, haz: ['trap', 'air'], relic: 'crown', blurb: 'Orichalcum shields, guarded by old tricks.' },
    archive: { name: 'Flooded Archive', short: 'Archive', tier: 2, depth: 2, haz: ['dark', 'air'], relic: 'scroll', blurb: 'Golden scrolls deep inside a lightless hall.' },
    theater: { name: 'Drowned Theater', short: 'Theater', tier: 2, depth: 2, haz: ['dark', 'current'], relic: 'crown', blurb: 'Golden masks still watch from the empty seats.' },
    oysters: { name: 'Royal Pearl Farm', short: 'Pearl Farm', tier: 2, depth: 1, haz: ['shark', 'air'], relic: 'urn', blurb: 'Giant oysters in neat rows, and the jars their keepers left.' },
    bridge: { name: 'Fallen Sky Bridge', short: 'Sky Bridge', tier: 2, depth: 2, haz: ['cave', 'trap'], relic: 'scroll', blurb: 'Its builders carved their secrets into the rails.' },
    glassworks: { name: 'Glassblowers’ Quarter', short: 'Glassworks', tier: 2, depth: 2, haz: ['air', 'dark'], relic: 'crystal', blurb: 'Crystal vases, still sealed inside their kilns.' },
    temple: { name: 'Temple of Poseidon', short: 'Poseidon’s Temple', tier: 3, depth: 2, haz: ['trap', 'dark', 'shark'], relic: 'urn', blurb: 'The sea god’s trident rests on the altar.' },
    observatory: { name: 'Star Observatory', short: 'Observatory', tier: 3, depth: 2, haz: ['current', 'air'], relic: 'scroll', blurb: 'A brass star-map worth a kingdom.' },
    palace: { name: 'Coral Palace', short: 'Coral Palace', tier: 3, depth: 2, haz: ['shark', 'cave', 'trap'], relic: 'crown', blurb: 'The royal jewels, behind walls of living coral.' },
    mint: { name: 'Orichalcum Mint', short: 'The Mint', tier: 3, depth: 3, haz: ['trap', 'cave'], relic: 'crystal', blurb: 'Where Atlantis made its glowing coins.' },
    library: { name: 'Great Library', short: 'Great Library', tier: 3, depth: 3, haz: ['dark', 'air', 'trap'], relic: 'scroll', blurb: 'Crystal books that still glow when you touch them.' },
    tidehall: { name: 'Hall of Tides', short: 'Hall of Tides', tier: 3, depth: 2, haz: ['current', 'dark', 'air'], relic: 'crystal', blurb: 'A great hall where the sea rushes in and out like breath.' },
    armada: { name: 'Lost Royal Fleet', short: 'Lost Fleet', tier: 3, depth: 3, haz: ['shark', 'current'], relic: 'urn', blurb: 'Warships of Atlantis, sunk with the royal tribute.' },
    oracle: { name: 'Oracle’s Grotto', short: 'Oracle’s Grotto', tier: 3, depth: 2, haz: ['cave', 'dark'], relic: 'crown', blurb: 'The oracle’s jeweled circlet lies among her prophecies.' },
    throne: { name: 'Throne of the Sea Kings', short: 'Sea Throne', tier: 4, depth: 3, haz: ['trap', 'kraken', 'dark'], relic: 'crown', blurb: 'A throne carved from one enormous pearl.' },
    vault: { name: 'Golden Vault', short: 'Golden Vault', tier: 4, depth: 3, haz: ['trap', 'cave', 'air'], relic: 'urn', blurb: 'Locked for ten thousand years. Very locked.' },
    trench: { name: 'Abyssal Trench Gate', short: 'Trench Gate', tier: 4, depth: 3, haz: ['current', 'dark', 'kraken'], relic: 'crystal', blurb: 'The gate to the deepest district of all.' },
    forge: { name: 'Volcano Forge', short: 'Volcano Forge', tier: 4, depth: 3, haz: ['cave', 'current', 'air'], relic: 'crystal', blurb: 'Hot vents, molten gold, very little room.' },
    lair: { name: 'The Kraken’s Lair', short: 'Kraken’s Lair', tier: 4, depth: 3, haz: ['kraken', 'cave', 'shark'], relic: 'crown', blurb: 'The crowns of a hundred lost captains, in the Kraken’s nest.' },
    citadel: { name: 'Black Citadel', short: 'Black Citadel', tier: 4, depth: 3, haz: ['trap', 'current', 'dark'], relic: 'scroll', blurb: 'The war council’s golden battle plans, behind a hundred traps.' },
    heart: { name: 'The Heart of Atlantis', short: 'The Heart', tier: 5, depth: 3, haz: ['trap', 'kraken', 'dark'], blurb: 'The glowing crystal that once powered the whole city.' },
  };
  const SITE_ORDER = Object.keys(SITE);
  // Each site's haul is rolled when the game starts: the level's usual pearls give or take its spread, plus 1 for a site
  // deeper than the shallowest of its level and 1 for each hazard beyond the fewest of its level. Gold varies by 1 either way.
  const tierMin = (t, f) => Math.min(...SITE_ORDER.filter((k) => SITE[k].tier === t).map((k) => f(SITE[k])));
  const haulBump = (site) => (site.depth > tierMin(site.tier, (y) => y.depth) ? 1 : 0) + (site.haz.length - tierMin(site.tier, (y) => y.haz.length));
  function rewardRange(t) {
    const ks = SITE_ORDER.filter((k) => SITE[k].tier === t);
    const bumps = ks.map((k) => haulBump(SITE[k]));
    return { lo: TIER[t].treasure - TIER[t].spread + Math.min(...bumps), hi: TIER[t].treasure + TIER[t].spread + Math.max(...bumps), goldLo: Math.max(1, TIER[t].gold - 1), goldHi: TIER[t].gold + 1 };
  }

  // The chart: rows of sites from the harbor down to the Heart. links[row][i] lists the sites in the next row that site i leads to.
  // A game's map stores slot numbers, so a saved game keeps the chart it was dealt (state.chart; games before charts were numbered use 1).
  // Wide rows stagger their sites up and down (dy, in % of the chart's height) so neighbours' names don't collide.
  const CHARTS = {
    1: {
      ys: [16, 34, 52, 70, 86],
      rows: [
        { tier: 1, xs: [10, 30, 50, 70, 90] },
        { tier: 2, xs: [10, 30, 50, 70, 90] },
        { tier: 3, xs: [12.5, 37.5, 62.5, 87.5] },
        { tier: 4, xs: [25, 50, 75] },
        { tier: 5, xs: [50] },
      ],
      links: [
        [[0, 1], [1, 2], [2], [3], [3, 4]],
        [[0], [0, 1], [1, 2], [2, 3], [3]],
        [[0], [0, 1], [1, 2], [2]],
        [[0], [0], [0]],
      ],
    },
    2: {
      ys: [14, 34, 56, 76, 90],
      rows: [
        { tier: 1, xs: [7, 19.3, 31.6, 43.9, 56.1, 68.4, 80.7, 93], dy: 5 },
        { tier: 2, xs: [7, 19.3, 31.6, 43.9, 56.1, 68.4, 80.7, 93], dy: 5 },
        { tier: 3, xs: [9, 25.4, 41.8, 58.2, 74.6, 91], dy: 3 },
        { tier: 4, xs: [12, 31, 50, 69, 88], dy: 2 },
        { tier: 5, xs: [50] },
      ],
      links: [
        [[0, 1], [1, 2], [2, 3], [3], [4], [4, 5], [5, 6], [6, 7]],
        [[0], [0, 1], [1, 2], [2], [3], [3, 4], [4, 5], [5]],
        [[0], [0, 1], [1, 2], [2, 3], [3, 4], [4]],
        [[0], [0], [0], [0], [0]],
      ],
    },
  };
  const CHART = 2;
  function buildChart(c) {
    const slots = [];
    c.rows.forEach((r, row) => r.xs.forEach((x, i) => slots.push({ row, i, tier: r.tier, x, y: c.ys[row] + (r.dy && r.xs.length > 1 ? (i % 2 ? r.dy : -r.dy) : 0), kids: [], parents: [] })));
    const slotAt = (row, i) => slots.findIndex((s) => s.row === row && s.i === i);
    c.links.forEach((row, ri) => row.forEach((kids, i) => kids.forEach((j) => {
      const a = slotAt(ri, i);
      const b = slotAt(ri + 1, j);
      slots[a].kids.push(b);
      slots[b].parents.push(a);
    })));
    return slots;
  }
  const CHART_SLOTS = {};
  Object.keys(CHARTS).forEach((k) => (CHART_SLOTS[k] = buildChart(CHARTS[k])));
  const SLOTS = CHART_SLOTS[CHART];
  const ROWS = CHARTS[CHART].rows;
  const slotsOf = (state) => CHART_SLOTS[(state && state.chart) || 1];

  // Commissions: public goals. The first company to meet one scores it.
  const GOALS = {
    deep: { icon: '🌊', name: 'Deep-sea pioneers', text: 'Explore 3 sites in the Deep or the Abyss.', pts: 5, test: (p) => p.found.filter((k) => SITE[k].depth >= 2).length >= 3 },
    relics: { icon: '🏺', name: 'Collectors', text: 'Hold 3 different kinds of relic.', pts: 4, test: (p) => new Set(p.relics).size >= 3 },
    fleet: { icon: '🚢', name: 'Shipping line', text: 'Have 3 subs at once.', pts: 4, test: (p) => p.subs.length >= 3 },
    crew: { icon: '🤿', name: 'Big outfit', text: 'Have 6 divers at once.', pts: 3, test: (p) => p.divers.length >= 6 },
    kraken: { icon: '🐙', name: 'Kraken tamers', text: 'Explore a site where the Kraken lurks.', pts: 5, test: (p) => p.found.some((k) => SITE[k].haz.includes('kraken')) },
    hazards: { icon: '🧭', name: 'Seen it all', text: 'Explore sites with 5 different hazards between them.', pts: 4, test: (p) => new Set([].concat(...p.found.map((k) => SITE[k].haz))).size >= 5 },
    flagship: { icon: '🐋', name: 'Flagship', text: 'Own a Leviathan.', pts: 3, test: (p) => p.subs.some((x) => x.k === 'leviathan') },
    salts: { icon: '🎖️', name: 'Old salts', text: `Have 2 promoted divers at once.`, pts: 4, test: (p) => p.divers.filter((d) => promoted(d)).length >= 2 },
    pockets: { icon: '🪙', name: 'Deep pockets', text: 'Have 🪙15 at once.', pts: 3, test: (p) => p.gold >= 15 },
    streak: { icon: '🔥', name: 'Hot streak', text: 'Explore 3 sites in one tide.', pts: 4, test: (p) => p.tideFound >= 3 },
  };
  const GOAL_ORDER = Object.keys(GOALS);

  // Sea forecast: one per tide, known a tide ahead.
  const SEA = {
    calm: { name: 'Calm seas', icon: '☀️', note: '+1 to every dive roll.' },
    clear: { name: 'Crystal water', icon: '🔆', note: 'Darkness doesn’t count against dives.' },
    frenzy: { name: 'Feeding frenzy', icon: '🦈', note: 'Sharks nobody is ready for are −6 instead of −3.' },
    riptide: { name: 'Riptides', icon: '🌀', note: 'Currents nobody is ready for are −6 instead of −3.' },
    storm: { name: 'Storm', icon: '⛈️', note: 'Minnows stay in port: they can’t dive or salvage.' },
    bloom: { name: 'Plankton bloom', icon: '🌫️', note: 'Darkness nobody is ready for is −6 instead of −3.' },
    rumors: { name: 'Treasure rumors', icon: '🗺️', note: '+2 pearls for every successful expedition.' },
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
  const poss = (name) => (/s$/i.test(name) ? `${name}’` : `${name}’s`);
  const signed = (n) => (n < 0 ? `−${-n}` : `+${n}`);

  function log(state, text, who) {
    state.log.push({ t: state.tide, text, who: who == null ? null : who });
    if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
  }
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const sea = (state) => state.forecast[state.tide - 1];
  const promoted = (d) => (d.xp || 0) >= PROMO_XP;
  const skillOf = (d) => DIVER[d.k].skill + (promoted(d) ? 1 : 0);
  const deepOf = (d) => Math.min(3, DIVER[d.k].deep + (promoted(d) ? 1 : 0));

  function diverCard(state, k) {
    const used = new Set();
    state.players.forEach((p) => p.divers.forEach((d) => used.add(d.name)));
    state.market.forEach((d) => used.add(d.name));
    const id = nid(state);
    const free = (femaleLook(k, id) ? NAMES_F : NAMES_M).concat(NAMES_ANY).filter((n) => !used.has(n));
    const name = free.length ? free[rint(state, free.length)] : `Diver ${id + 1}`;
    return { id, k, name, wait: 0 };
  }
  const hireCost = (d) => Math.max(Math.ceil(DIVER[d.k].cost / 2), DIVER[d.k].cost - (d.wait || 0));

  // ---------------------------------------------------------------- setup
  function newGame(opts) {
    opts = opts || {};
    const names = opts.names || ['Red', 'Blue'];
    const ai = opts.ai || [false, true];
    const state = {
      v: SAVE_V,
      seed: (opts.seed != null ? opts.seed : Math.floor(Math.random() * 2 ** 31)) | 0,
      chart: CHART,
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
      goals: [],
      forecast: [],
      firsts: {},
      heartTaken: false,
      last: null,
      claimed: [],
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

    // Each game draws its own sites for every row of the chart.
    const pools = {};
    [1, 2, 3, 4, 5].forEach((t) => (pools[t] = shuffle(state, SITE_ORDER.filter((k) => SITE[k].tier === t))));
    state.map = SLOTS.map((slot, n) => {
      const k = pools[slot.tier].pop();
      const t = TIER[slot.tier];
      const pearls = t.treasure - t.spread + rint(state, 2 * t.spread + 1) + haulBump(SITE[k]);
      const gold = Math.max(1, t.gold - 1 + rint(state, 3));
      return { id: nid(state), n, k, scout: 0, by: null, pearls, gold };
    });
    state.goals = shuffle(state, GOAL_ORDER.slice()).slice(0, GOAL_COUNT).map((k) => ({ k, by: null }));

    for (let i = 0; i < 2; i++) {
      state.players.push({
        name: String(names[i] || (i ? 'Blue' : 'Red')).slice(0, 18),
        ai: !!ai[i],
        gold: START_GOLD,
        treasure: 0,
        divers: [],
        subs: [],
        found: [],
        relics: [],
        tideFound: 0,
        stats: { dives: 0, wins: 0, lost: 0, wrecked: 0 },
      });
    }
    state.players.forEach((p) => {
      p.divers.push(Object.assign(diverCard(state, 'rookie'), { used: false, tired: 0, xp: 0 }));
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
    if (h.rookie) p.divers.push(Object.assign(diverCard(state, 'rookie'), { used: false, tired: 0, xp: 0 }));
    if (h.sub) p.subs[0].k = h.sub;
  }

  function drawDiver(state) {
    if (!state.diverDeck.length) return;
    state.market.push(diverCard(state, state.diverDeck.shift()));
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
  // Games saved before sites had their own haul use the level's usual one.
  const haulOf = (x) => ({ treasure: x.pearls != null ? x.pearls : TIER[siteOf(x).tier].treasure, gold: x.gold != null ? x.gold : TIER[siteOf(x).tier].gold });
  function rewardOf(state, x) {
    const h = haulOf(x);
    return { treasure: h.treasure + (sea(state) === 'rumors' ? 2 : 0), gold: h.gold };
  }
  // Any unexplored site can be tried (the Heart only once it's sighted on tide HEART_TIDE), but a site is
  // only charted once a site leading to it has been explored; diving somewhere uncharted is much harder.
  const slotOf = (state, x) => slotsOf(state)[x.n];
  const charted = (state, x) => slotOf(state, x).row === 0 || slotOf(state, x).parents.some((n) => state.map[n].by != null);
  const isOpen = (state, x) => x.by == null && (x.k !== 'heart' || state.tide >= HEART_TIDE);
  const openSites = (state) => state.map.filter((x) => isOpen(state, x));
  const linked = (state, x) => slotOf(state, x).parents.concat(slotOf(state, x).kids);
  const knownWaters = (state, pi, x) => linked(state, x).some((n) => state.map[n].by === pi);

  function relicPoints(relics) {
    const c = {};
    relics.forEach((r) => (c[r] = (c[r] || 0) + 1));
    let pts = 0;
    for (;;) {
      const kinds = Object.keys(c).filter((k) => c[k] > 0);
      if (!kinds.length) return pts;
      pts += RELIC_SET[kinds.length];
      kinds.forEach((k) => (c[k] -= 1));
    }
  }

  // Everything that goes into a dive's roll, so the page can show the sum before the dice are thrown.
  function chance(state, pi, expId, subId, crewIds) {
    const p = state.players[pi];
    const x = expOf(state, expId);
    const s = subId == null ? null : subOf(p, subId);
    if (!x || (subId != null && !s)) return null;
    return chanceOf(state, pi, x, s, (crewIds || []).map((id) => diverOf(p, id)).filter(Boolean), sea(state));
  }
  // The same sum for any sub and crew (even ones the company doesn't have yet) under any forecast.
  function chanceOf(state, pi, x, s, crew, w) {
    const site = siteOf(x);
    const parts = [];
    const skill = crew.reduce((t, d) => t + skillOf(d), 0);
    if (skill) parts.push({ label: `Crew skill`, v: skill });
    if (!s) parts.push({ label: 'No sub (swimming from the boat)', v: -SWIM_PEN });
    else if (SUB[s.k].bonus) parts.push({ label: `${SUB[s.k].name}`, v: SUB[s.k].bonus });
    if (knownWaters(state, pi, x)) parts.push({ label: 'Known waters', v: KNOWN_BONUS });
    if (x.scout) parts.push({ label: 'Earlier attempts', v: x.scout });
    if (w === 'calm') parts.push({ label: 'Calm seas', v: 1 });
    if (w === 'lowtide' && site.depth === 1) parts.push({ label: 'Low tide', v: 2 });
    if (!charted(state, x)) parts.push({ label: 'Uncharted waters', v: -UNCHARTED });
    const subGap = Math.max(0, site.depth - (s ? SUB[s.k].depth : 1));
    if (subGap) parts.push({ label: s ? `${SUB[s.k].name} out of its depth` : `Swimming down to the ${DEPTH[site.depth].name}`, v: -SUB_DEEP_PEN * subGap });
    const risk = [];
    crew.forEach((d) => {
      const gap = Math.max(0, site.depth - deepOf(d));
      if (gap) parts.push({ label: `${d.name} out of their depth`, v: -DIVER_DEEP_PEN * gap });
      const lost = DIVER_LOST * gap + (s ? 0 : SWIM_LOST * subGap);
      if (lost) risk.push({ id: d.id, name: d.name, p: Math.min(0.9, lost) });
    });
    const crush = s && subGap ? Math.min(0.9, SUB_CRUSH * subGap) : 0;
    const haz = site.haz.map((h) => {
      const byDiver = crew.find((d) => DIVER[d.k].spec.includes(h));
      const byMod = s && s.mods.find((m) => MOD[m].haz === h);
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
    return { target, bonus, need, p: p20, parts, haz, uncovered: haz.filter((z) => !z.ready).map((z) => z.h), risk, crush, charted: charted(state, x), swim: !s };
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
        if (p.gold < hireCost(d)) return `You need 🪙${hireCost(d)} to hire ${d.name}.`;
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
        const swim = a.s == null;
        const s = swim ? null : subOf(p, a.s);
        if (!swim && !s) return 'Pick a sub.';
        if (s && !subReady(state, s)) return s.k === 'minnow' && sea(state) === 'storm' ? 'Minnows stay in port during a storm.' : s.stuck >= state.tide ? 'That sub is out of action.' : 'That sub has already been out this tide.';
        const crew = Array.isArray(a.crew) ? a.crew : [];
        if (!crew.length) return 'Pick at least one diver.';
        if (new Set(crew).size !== crew.length) return 'Pick each diver once.';
        if (swim && crew.length > SWIM_CREW) return `Only ${plural(SWIM_CREW, 'diver')} can swim out from the boat.`;
        if (s && crew.length > SUB[s.k].crew) return `A ${SUB[s.k].name} only carries ${plural(SUB[s.k].crew, 'diver')}.`;
        for (const id of crew) {
          const d = diverOf(p, id);
          if (!d) return 'That diver isn’t in your company.';
          if (!diverReady(state, d)) return `${d.name} ${d.tired >= state.tide ? 'is resting' : 'has already been out this tide'}.`;
        }
        if (a.t === 'salvage') return '';
        const x = expOf(state, a.x);
        if (!x) return 'There’s no site like that.';
        if (x.by != null) return 'That site has already been explored.';
        if (!isOpen(state, x)) return `Nobody has sighted the Heart of Atlantis yet. It appears on tide ${HEART_TIDE}.`;
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
    state.claimed = [];
    switch (a.t) {
      case 'hire': {
        const i = state.market.findIndex((x) => x.id === a.d);
        const d = state.market.splice(i, 1)[0];
        const paid = hireCost(d);
        p.gold -= paid;
        delete d.wait;
        // A new hire is ready to dive straight away.
        p.divers.push(Object.assign(d, { used: false, tired: 0, xp: 0 }));
        drawDiver(state);
        log(state, `${p.name} hired ${d.name}, ${DIVER[d.k].role.toLowerCase()}, for 🪙${paid}.`, pi);
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
        log(state, `${p.name} fitted ${MOD[a.m].name.toLowerCase()} to their ${SUB[s.k].name} for 🪙${MOD[a.m].cost}.`, pi);
        break;
      }
      case 'salvage': {
        const s = a.s == null ? null : subOf(p, a.s);
        const crew = a.crew.map((id) => diverOf(p, id));
        const gain = 1 + crew.length;
        if (s) s.used = true;
        crew.forEach((d) => (d.used = true));
        p.gold += gain;
        state.last = { t: 'salvage', pi, s: s ? s.id : null, crew: a.crew.slice(), gold: gain };
        log(state, `${poss(p.name)}${s ? ` ${SUB[s.k].name}` : ' crew'} went on a salvage run and brought back 🪙${gain}.`, pi);
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
    state.claimed = checkGoals(state, pi);
    if (state.last) state.last.goals = state.claimed.slice();
    advance(state, pi);
  }

  function checkGoals(state, pi) {
    const p = state.players[pi];
    const got = [];
    state.goals.forEach((g) => {
      if (g.by != null || !GOALS[g.k].test(p)) return;
      g.by = pi;
      got.push(g.k);
      log(state, `${GOALS[g.k].icon} ${p.name} completed the “${GOALS[g.k].name}” commission: +${GOALS[g.k].pts} points!`, pi);
    });
    return got;
  }

  function dive(state, pi, a) {
    const p = state.players[pi];
    const s = a.s == null ? null : subOf(p, a.s);
    const x = expOf(state, a.x);
    const site = siteOf(x);
    const c = chance(state, pi, a.x, s ? s.id : null, a.crew);
    const crew = a.crew.map((id) => diverOf(p, id));
    const roll = 1 + rint(state, 20);
    // rig20: admin testing switch on the page; the rng still advances so the rest of the game is unchanged.
    const d20 = a.rig20 ? 20 : roll;
    const total = d20 + c.bonus;
    const ok = d20 === 20 || (d20 !== 1 && total >= c.target);
    if (s) s.used = true;
    crew.forEach((d) => (d.used = true));
    p.stats.dives += 1;
    const out = { t: 'dive', pi, x: x.id, k: x.k, s: s ? s.id : null, sk: s ? s.k : null, crew: a.crew.slice(), crewNames: crew.map((d) => d.name), crewK: crew.map((d) => d.k), d20, bonus: c.bonus, total, target: c.target, need: c.need, ok, msgs: [] };
    if (ok) {
      const r = rewardOf(state, x);
      const extra = d20 === 20 ? 2 : 0;
      const before = state.map.filter((y) => charted(state, y)).map((y) => y.id);
      p.treasure += r.treasure;
      p.gold += r.gold + extra;
      p.found.push(x.k);
      p.tideFound += 1;
      p.stats.wins += 1;
      x.by = pi;
      out.treasure = r.treasure;
      out.gold = r.gold + extra;
      if (site.relic) {
        p.relics.push(site.relic);
        out.relic = site.relic;
      }
      if (state.firsts[site.tier] == null) {
        state.firsts[site.tier] = pi;
        out.first = true;
      }
      if (x.k === 'heart') state.heartTaken = true;
      log(state, `${p.name} explored ${site.name}${d20 === 20 ? ' with a perfect 20' : ''}: 🎲${d20}${signed(c.bonus)} = ${total} (needed ${c.target}). Found 🦪${r.treasure} pearls and 🪙${r.gold + extra}${site.relic ? ` and a relic (${RELIC[site.relic].icon})` : ''}${out.first ? ` — first to finish a ${TIER[site.tier].name.toLowerCase()} expedition!` : '.'}`, pi);
      out.promoted = [];
      crew.forEach((d) => {
        d.xp = (d.xp || 0) + 1;
        if (d.xp === PROMO_XP) out.promoted.push(d.name);
      });
      if (out.promoted.length) log(state, `🎖️ ${out.promoted.join(' and ')} ${out.promoted.length > 1 ? 'were' : 'was'} promoted: +1 skill, and trained one zone deeper.`, pi);
      out.opened = state.map.filter((y) => y.by == null && charted(state, y) && !before.includes(y.id)).map((y) => y.k);
      if (out.opened.length) log(state, `🗺️ New routes charted to ${out.opened.map((k) => SITE[k].name).join(' and ')}.`, pi);
    } else {
      // The worst hazard nobody was ready for strikes; on a 1, any hazard can.
      const pool = d20 === 1 ? site.haz : c.uncovered;
      const gold0 = p.gold;
      const stuck0 = s ? s.stuck : 0;
      const tired0 = crew.map((d) => d.tired);
      x.scout = Math.min(SCOUT_MAX, x.scout + 1);
      out.scout = x.scout;
      log(state, `${poss(p.name)} dive at ${site.name} failed: 🎲${d20}${d20 === 1 ? ' (a disaster!)' : ''}${signed(c.bonus)} = ${total}, needed ${c.target}.`, pi);
      if (!pool.length) {
        out.msgs.push(c.risk.length || c.crush ? 'The crew was ready for every hazard down there and turned back empty-handed.' : 'The crew turned back empty-handed, but everyone is safe.');
      } else {
        const h = pool[rint(state, pool.length)];
        out.strike = h;
        strike(state, pi, h, s, crew, out);
      }
      // Divers and subs sent deeper than they're built for can be lost on top of whatever else went wrong.
      out.drowned = [];
      c.risk.forEach((r) => {
        const d = diverOf(p, r.id);
        if (!d || rng(state) >= r.p) return;
        p.divers = p.divers.filter((y) => y !== d);
        p.stats.lost += 1;
        out.drowned.push(d.name);
        out.msgs.push(`🫥 ${d.name} was ${s ? 'out of their depth' : 'too deep to swim back up'} and was lost in the ${DEPTH[site.depth].name.toLowerCase()}.`);
      });
      if (c.crush && s && p.subs.includes(s) && rng(state) < c.crush) {
        p.subs = p.subs.filter((y) => y !== s);
        p.stats.wrecked += 1;
        out.wrecked = SUB[s.k].name;
        out.msgs.push(`💥 The water pressure crushed the ${SUB[s.k].name} — it was never built to go that deep.`);
      }
      out.msgs.forEach((m) => log(state, m, pi));
      // Exactly what the failure cost, for the roll screen: back = the first tide they can dive again.
      out.pen = {
        gold: gold0 - p.gold,
        lost: [out.lost, ...out.drowned].filter(Boolean),
        wrecked: out.wrecked || null,
        subBack: s && !out.wrecked && s.stuck > stuck0 ? s.stuck + 1 : 0,
        rest: crew.filter((d, i) => p.divers.includes(d) && d.tired > tired0[i]).map((d) => ({ name: d.name, back: d.tired + 1 })),
      };
    }
    state.last = out;
  }

  function strike(state, pi, h, s, crew, out) {
    const p = state.players[pi];
    const t = state.tide;
    const rest = (n) => crew.forEach((d) => p.divers.includes(d) && (d.tired = Math.max(d.tired, t + (n || 1))));
    // Swimmers have no sub to take the blow: the crew does.
    if (!s && h !== 'shark' && h !== 'air' && h !== 'dark') return strikeSwimmers(state, pi, h, crew, out, rest);
    const sub = s && SUB[s.k].name;
    if (h === 'shark') {
      const low = Math.min(...crew.map(skillOf));
      const pick = crew.filter((d) => skillOf(d) === low);
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

  function strikeSwimmers(state, pi, h, crew, out, rest) {
    const p = state.players[pi];
    if (h === 'cave') {
      rest(2);
      out.msgs.push('🪨 The swimmers got trapped in a collapsing tunnel. Digging out leaves them resting for 2 tides.');
    } else if (h === 'current') {
      const lose = Math.min(3, p.gold);
      p.gold -= lose;
      rest();
      out.msgs.push(`🌀 A current swept the swimmers away${lose ? `, with 🪙${lose} of gear` : ''}. They rest next tide.`);
    } else if (h === 'trap') {
      const pay = Math.min(2, p.gold);
      p.gold -= pay;
      rest();
      out.msgs.push(`🗿 An ancient trap went off${pay ? `. Patching up the crew costs 🪙${pay}` : ''}; they rest next tide.`);
    } else if (h === 'kraken') {
      const d = crew[rint(state, crew.length)];
      p.divers = p.divers.filter((y) => y !== d);
      p.stats.lost += 1;
      out.lost = d.name;
      rest();
      out.msgs.push(`🐙 The Kraken woke up and dragged ${d.name} into the dark! The others swam home and rest next tide.`);
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
    // What changed between the tides, for the page to explain.
    const report = { tide: state.tide, sea: w, income: INCOME + (w === 'gala' ? 3 : 0), players: [], left: null, arrived: [] };
    state.players.forEach((p, i) => {
      p.divers.forEach((d) => (d.used = false));
      p.subs.forEach((s) => (s.used = false));
      p.tideFound = 0;
      const inc = report.income;
      p.gold += inc;
      const unpaid = [];
      let paid = 0;
      p.divers.slice().sort((a, b) => DIVER[a.k].wage - DIVER[b.k].wage).forEach((d) => {
        const wage = DIVER[d.k].wage;
        if (p.gold >= wage) {
          p.gold -= wage;
          paid += wage;
        } else unpaid.push(d);
      });
      if (unpaid.length) {
        p.divers = p.divers.filter((d) => !unpaid.includes(d));
        log(state, `${p.name} couldn’t pay ${unpaid.map((d) => d.name).join(' and ')}, who quit.`, i);
      }
      report.players.push({
        paid,
        quit: unpaid.map((d) => d.name),
        gold: p.gold,
        resting: p.divers.filter((d) => d.tired >= state.tide).map((d) => d.name),
        stuck: p.subs.filter((x) => x.stuck >= state.tide).map((x) => SUB[x.k].name),
        port: w === 'storm' ? p.subs.filter((x) => x.k === 'minnow').length : 0,
      });
    });
    // The longest-waiting diver in the hall finds other work; everyone still waiting gets cheaper.
    if (state.market.length) report.left = state.market.shift().name;
    state.market.forEach((d) => (d.wait = (d.wait || 0) + 1));
    while (state.market.length < MARKET_SIZE && state.diverDeck.length) {
      drawDiver(state);
      const d = state.market[state.market.length - 1];
      report.arrived.push(`${d.name} (${DIVER[d.k].role.toLowerCase()})`);
    }
    state.report = report;
    const heart = state.map.find((x) => x.k === 'heart');
    const sighted = state.tide === HEART_TIDE ? ` The Heart of Atlantis has been sighted!${charted(state, heart) ? ' A route to it is already charted.' : ' Until someone explores an extreme site, the way there is uncharted.'}` : '';
    log(state, `Tide ${state.tide} · ${SEA[w].icon} ${SEA[w].name}: ${SEA[w].note} Everyone collects 🪙${INCOME}${w === 'gala' ? '+3' : ''} and pays wages.${sighted}`);
    state.claimed = [];
    state.players.forEach((p, i) => state.claimed.push(...checkGoals(state, i)));
  }

  // ---------------------------------------------------------------- scoring
  function score(state, p) {
    const pi = state.players.indexOf(p);
    const treasure = p.treasure;
    const discoveries = Object.values(state.firsts).filter((w) => w === pi).length * DISCOVERY_PTS;
    const relics = relicPoints(p.relics || []);
    const goals = (state.goals || []).filter((g) => g.by === pi).reduce((t, g) => t + GOALS[g.k].pts, 0);
    const gold = Math.floor(p.gold / GOLD_PER_PT);
    return { treasure, discoveries, relics, goals, gold, expeditions: p.found.length, total: treasure + discoveries + relics + goals + gold };
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
    const room = s ? SUB[s.k].crew : SWIM_CREW;
    let left = (pool || readyDivers(state, p)).slice();
    const crew = [];
    let now = -Infinity;
    while (crew.length < room && left.length) {
      let best = null;
      for (const d of left) {
        const c = chance(state, pi, x.id, s ? s.id : null, [...crew, d].map((y) => y.id));
        const v = c.bonus - skillOf(d) * 0.01 * (crew.length ? 0 : 1) - (c.risk.some((r) => r.id === d.id) ? 0.5 : 0);
        if (!best || v > best.v) best = { d, v };
      }
      // An extra diver who'd make the roll worse (out of their depth) stays home.
      if (crew.length && best.v <= now) break;
      now = best.v;
      crew.push(best.d);
      left = left.filter((y) => y !== best.d);
    }
    return crew;
  }

  const diverWorth = (d) => DIVER[d.k].cost * 0.5 + skillOf(d);
  function lossOf(state, pi, h, s, crew) {
    const p = state.players[pi];
    switch (h) {
      case 'shark': return Math.min(...crew.map(diverWorth));
      case 'kraken': return s ? SUB[s.k].cost * 0.7 + s.mods.length * 2 + 1 : crew.reduce((t, d) => t + diverWorth(d), 0) / crew.length + crew.length * 0.7;
      case 'cave': return s ? 2.4 : crew.length * 1.4;
      case 'current': return Math.min(3, p.gold) * 0.35 + 1.2;
      case 'trap': return Math.min(2, p.gold) * 0.35 + 1.2;
      default: return crew.length * 0.7;
    }
  }

  // Points from commissions this company would complete if `change` happened to it.
  function goalGain(state, pi, change) {
    const open = state.goals.filter((g) => g.by == null);
    if (!open.length) return 0;
    const q = clone(state.players[pi]);
    change(q);
    return open.reduce((t, g) => t + (GOALS[g.k].test(q) ? GOALS[g.k].pts : 0), 0);
  }

  function diveValue(state, pi, x, s, crew, level) {
    const p = state.players[pi];
    const c = chance(state, pi, x.id, s ? s.id : null, crew.map((d) => d.id));
    const site = siteOf(x);
    const r = rewardOf(state, x);
    let gain = r.treasure + r.gold * 0.35 + (state.firsts[site.tier] == null ? DISCOVERY_PTS : 0);
    if (site.relic) gain += relicPoints(p.relics.concat(site.relic)) - relicPoints(p.relics) + 0.5;
    if (x.k === 'heart') gain += 4;
    // Opening deeper routes matters early on; late in the season there's no time to use them.
    gain += slotOf(state, x).kids.filter((n) => state.map[n].by == null && !charted(state, state.map[n])).length * (tidesLeft(state) >= 4 ? 0.4 : 0.1);
    if (level !== 'easy') {
      gain += goalGain(state, pi, (q) => {
        q.found.push(x.k);
        if (site.relic) q.relics.push(site.relic);
        q.tideFound += 1;
        crew.forEach((d) => {
          const y = q.divers.find((z) => z.id === d.id);
          if (y) y.xp = (y.xp || 0) + 1;
        });
      });
    }
    const pool = c.uncovered;
    let loss = pool.length ? pool.reduce((t, h) => t + lossOf(state, pi, h, s, crew), 0) / pool.length : 0;
    const disaster = site.haz.reduce((t, h) => t + lossOf(state, pi, h, s, crew), 0) / site.haz.length;
    // Late in the game a lost sub or diver costs less; early on, keep the company whole.
    const late = tidesLeft(state) <= 2 ? 0.4 : tidesLeft(state) <= 4 ? 0.75 : 1;
    if (level === 'easy') loss *= 0.6;
    const pFail = 1 - c.p;
    const pDisaster = 0.05;
    // Out-of-depth divers and subs can be lost on any failed dive.
    let deepLoss = c.risk.reduce((t, rk) => t + rk.p * diverWorth(diverOf(p, rk.id)), 0) + (s ? c.crush * (SUB[s.k].cost * 0.7 + s.mods.length * 2 + 1) : 0);
    if (level === 'easy') deepLoss *= 0.5;
    return { v: c.p * gain - ((pFail - pDisaster) * loss + pDisaster * disaster + pFail * deepLoss) * late, p: c.p, c };
  }

  // How much the company wants a diver with these specialties, given the charted sites (and, less, the uncharted ones).
  function hazardDemand(state, pi) {
    const p = state.players[pi];
    const dem = {};
    HAZ_ORDER.forEach((h) => (dem[h] = 0));
    const depth = Math.max(maxDepth(p), 1);
    openSites(state).forEach((x) => {
      const site = siteOf(x);
      const w = (haulOf(x).treasure / 5) * (charted(state, x) ? 1 : 0.35);
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
    const goals = level !== 'easy';
    const open = openSites(state);

    const subs = readySubs(state, p);
    const crewPool = readyDivers(state, p);
    for (const s of [...subs, null]) {
      for (const x of open) {
        const crew = level === 'easy' ? crewPool.slice(0, s ? SUB[s.k].crew : SWIM_CREW) : bestCrew(state, pi, x, s, crewPool);
        if (!crew.length) continue;
        const dv = diveValue(state, pi, x, s, crew, level);
        out.push({ a: { t: 'dive', x: x.id, s: s ? s.id : null, crew: crew.map((d) => d.id) }, v: dv.v, p: dv.p });
      }
      const crew = crewPool.slice(0, s ? SUB[s.k].crew : SWIM_CREW);
      if (crew.length) out.push({ a: { t: 'salvage', s: s ? s.id : null, crew: crew.map((d) => d.id) }, v: (1 + crew.length) * 0.35 - 0.05 });
    }

    if (left >= 2 && p.divers.length < MAX_DIVERS) {
      const room = crewRoom(p);
      for (const d of state.market) {
        const info = DIVER[d.k];
        const cost = hireCost(d);
        if (p.gold - cost < reserve) continue;
        const spec = info.spec.reduce((t, h) => t + dem[h], 0);
        // An empty seat in a sub is a dive the company can't make; a diver with no seat just draws wages.
        const seat = p.divers.length < room ? 1.8 : -1.4 * (p.divers.length - room + 1);
        let v = info.skill * 0.9 + (info.deep - 1) * 0.6 + spec * 1.1 - cost * 0.3 - info.wage * Math.min(left - 1, 6) * 0.15 + seat;
        if (goals) v += goalGain(state, pi, (q) => { q.gold -= cost; q.divers.push({ k: d.k, xp: 0 }); }) * 0.8;
        out.push({ a: { t: 'hire', d: d.id }, v });
      }
    }

    const depthNow = maxDepth(p);
    const deepGain = open.filter((x) => siteOf(x).depth > depthNow).reduce((t, x) => Math.max(t, haulOf(x).treasure), 0)
      || state.map.filter((x) => x.by == null && siteOf(x).depth > depthNow).length * 0.6;
    if (left >= 2 && p.subs.length < MAX_SUBS) {
      for (const k of SUB_ORDER) {
        const b = SUB[k];
        if (p.gold - b.cost < reserve) continue;
        const crewGain = Math.min(b.crew, Math.max(0, p.divers.length - crewRoom(p)) + 1);
        const unlock = b.depth > depthNow ? deepGain * 0.45 : 0;
        let v = crewGain * 0.8 + unlock + b.bonus * 0.9 + b.slots * 0.3 - b.cost * 0.3 + (left >= 5 ? 0.8 : 0);
        if (goals) v += goalGain(state, pi, (q) => { q.gold -= b.cost; q.subs.push({ k, mods: [] }); }) * 0.8;
        out.push({ a: { t: 'build', k }, v });
      }
    }

    if (left >= 2) {
      for (const s of p.subs) {
        if (s.stuck >= state.tide) continue;
        for (const k of SUB_ORDER) {
          const b = SUB[k];
          const was = SUB[s.k];
          const cost = upgradeCost(s, k);
          if (b.cost <= was.cost || p.gold - cost < reserve) continue;
          const crewGain = Math.min(b.crew - was.crew, Math.max(0, p.divers.length - crewRoom(p)) + 1);
          const unlock = b.depth > depthNow ? deepGain * 0.45 : 0;
          let v = crewGain * 0.8 + unlock + (b.bonus - was.bonus) * 0.9 + (b.slots - was.slots) * 0.3 - cost * 0.3 + (left >= 4 ? 0.5 : 0);
          if (goals) v += goalGain(state, pi, (q) => { q.gold -= cost; q.subs.find((z) => z.id === s.id).k = k; }) * 0.8;
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
    if (level === 'hard' || level === 'brutal') return evChoose(state, pi);
    const opts = options(state, pi, level);
    const noise = level === 'easy' ? 4 : level === 'normal' ? 1.2 : 0;
    const minP = level === 'easy' ? 0.15 : level === 'normal' ? 0.3 : 0.2;
    let best = null;
    for (const o of opts) {
      if (o.a.t === 'dive' && o.p < minP) continue;
      let v = o.v;
      // Hard computers race you for the sites you're best placed to win.
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
    for (const s of [...readySubs(state, op), null]) {
      if ((s ? SUB[s.k].depth : 1) < siteOf(x).depth) continue;
      const crew = bestCrew(state, o, x, s);
      if (!crew.length) continue;
      const c = chance(state, o, x.id, s ? s.id : null, crew.map((d) => d.id));
      best = Math.max(best, c.p * haulOf(x).treasure);
    }
    return best;
  }

  // ---------------------------------------------------------------- expected-value computer player
  // Every choice is scored as its expected effect on the final margin (this company's points minus the rival's):
  // a dive is P(success) × everything the find is worth, minus the expected cost of what failure brings; a purchase
  // is how much it improves the best dive plan for this tide and the tides after it, minus what it costs.
  const EV = {
    decay: 0.5, // each later tide is worth this much of the one before: sites run out and the Heart can end the season
    goldNow: 0.06, // gold is worth 1/GOLD_PER_PT at the end, more while it can still buy divers and subs
    deny: 0.5, // share of the rival's expected haul from a site that a find takes away from them
    chart: 0.3, // routes opened by a find, per newly charted site, while there's time to use them
    promo: 0.35, // a promotion's +1 skill and depth, per remaining tide
    floor: 1, // a lost diver is worth at least this share of what hiring a replacement would cost
  };

  const goldVal = (state, tl) => 1 / GOLD_PER_PT + EV.goldNow * Math.max(0, Math.min(tl - 1, 5));
  function laterTides(tl) {
    let f = 0;
    for (let k = 1; k < tl; k++) f += Math.pow(EV.decay, k);
    return f;
  }

  // Divers, subs and forecast for a plan: right now (what's still ready) or a fresh tide (everyone back from the last one).
  function fleetOf(state, p, fresh) {
    if (!fresh) return { subs: readySubs(state, p), divers: readyDivers(state, p), w: sea(state), sites: openSites(state) };
    const t = state.tide + 1;
    const w = state.forecast[state.tide] || null;
    return {
      subs: p.subs.filter((s) => s.stuck < t && !(s.k === 'minnow' && w === 'storm')),
      divers: p.divers.filter((d) => d.tired < t),
      w,
      sites: state.map.filter((x) => x.by == null && (x.k !== 'heart' || t >= HEART_TIDE)),
    };
  }

  // A quick crew: each diver adds their skill and the hazards they make safe; out-of-depth divers need to be worth the risk.
  function quickCrew(x, s, pool, w) {
    const site = siteOf(x);
    const room = s ? SUB[s.k].crew : SWIM_CREW;
    const covered = new Set(s ? s.mods.map((m) => MOD[m].haz) : []);
    if (w === 'clear') covered.add('dark');
    const crew = [];
    let left = pool.slice();
    while (crew.length < room && left.length) {
      let best = null;
      for (const d of left) {
        const gap = Math.max(0, site.depth - deepOf(d));
        let v = skillOf(d) - (DIVER_DEEP_PEN + 1.5) * gap - DIVER[d.k].cost * 0.01;
        for (const h of DIVER[d.k].spec) if (site.haz.includes(h) && !covered.has(h)) v += SEA_DOUBLE[w] === h ? UNCOVERED * 2 : UNCOVERED;
        if (!best || v > best.v) best = { d, v };
      }
      if (crew.length && best.v <= 0) break;
      crew.push(best.d);
      DIVER[best.d.k].spec.forEach((h) => covered.add(h));
      left = left.filter((y) => y !== best.d);
    }
    return crew;
  }

  // What a company stands to gain from finding a site, before the dice: pearls, gold, first find, relic set, commissions.
  function findGain(state, pi, x, w, gv) {
    const p = state.players[pi];
    const site = siteOf(x);
    const h = haulOf(x);
    let v = h.treasure + (w === 'rumors' ? 2 : 0) + h.gold * gv + (state.firsts[site.tier] == null ? DISCOVERY_PTS : 0);
    if (site.relic) v += relicPoints(p.relics.concat(site.relic)) - relicPoints(p.relics);
    return v;
  }

  function evContext(state, pi, rough) {
    const tl = tidesLeft(state);
    const ctx = { state, pi, tl, gv: goldVal(state, tl), F: laterTides(tl), gain: {}, deny: {}, goal: {}, diverRate: {}, subRate: {}, diverVal: {}, subVal: {}, rough };
    const p = state.players[pi];
    const late = Math.min(1, ctx.F / 2.5);
    // Rough worth of divers and subs, used until the plans below measure it.
    ctx.dRate = (d) => (ctx.diverRate[d.id] != null ? ctx.diverRate[d.id] : 0.6);
    ctx.sRate = (s) => (s && ctx.subRate[s.id] != null ? ctx.subRate[s.id] : 1);
    ctx.dVal = (d) => (ctx.diverVal[d.id] != null ? ctx.diverVal[d.id] : (DIVER[d.k].cost * 0.5 + skillOf(d)) * late);
    ctx.sVal = (s) => (ctx.subVal[s.id] != null ? ctx.subVal[s.id] : (SUB[s.k].cost * 0.7 + s.mods.length * 2 + 1) * late);
    state.map.forEach((x) => {
      if (x.by != null) return;
      const site = siteOf(x);
      const open = state.goals.filter((g) => g.by == null);
      if (open.length) {
        const q = clone(p);
        q.found.push(x.k);
        if (site.relic) q.relics.push(site.relic);
        q.tideFound += 1;
        ctx.goal[x.id] = open.reduce((t, g) => t + (GOALS[g.k].test(q) ? GOALS[g.k].pts : 0), 0);
      } else ctx.goal[x.id] = 0;
    });
    if (rough) return ctx;
    // The rival's side: what they'd expect from each site (a find takes it away from them) and how fast they're scoring.
    const o = 1 - pi;
    const rctx = evContext(state, o, true);
    const rf = fleetOf(state, state.players[o], true);
    rf.sites.forEach((x) => {
      let best = 0;
      for (const s of [...rf.subs, null]) {
        const crew = quickCrew(x, s, rf.divers, rf.w);
        if (!crew.length) continue;
        best = Math.max(best, chanceOf(state, o, x, s, crew, rf.w).p * findGain(state, o, x, rf.w, rctx.gv));
      }
      ctx.deny[x.id] = best;
    });
    ctx.rivalRate = planOf(state, o, rf, rctx).total;
    if (!state.passed[o]) {
      const rn = fleetOf(state, state.players[o], false);
      ctx.rivalNow = {};
      rn.sites.forEach((x) => {
        let best = 0;
        for (const s of [...rn.subs, null]) {
          const crew = quickCrew(x, s, rn.divers, rn.w);
          if (crew.length) best = Math.max(best, chanceOf(state, o, x, s, crew, rn.w).p);
        }
        ctx.rivalNow[x.id] = best;
      });
    }
    // Measure each diver and sub by how much the company's best fresh-tide plan drops without them.
    const fresh = fleetOf(state, p, true);
    ctx.myRate = ctx.rivalRate;
    const base = planOf(state, pi, fresh, ctx).total;
    ctx.myRate = base;
    for (const d of p.divers) {
      const rate = Math.max(0, base - planOf(state, pi, Object.assign({}, fresh, { divers: fresh.divers.filter((y) => y !== d) }), ctx).total);
      ctx.diverRate[d.id] = rate;
      const replace = tl > 1 ? EV.floor * DIVER[d.k].cost * ctx.gv : 0;
      ctx.diverVal[d.id] = Math.max(replace, rate * ctx.F - DIVER[d.k].wage * (tl - 1) * ctx.gv);
    }
    for (const s of p.subs) {
      const rate = Math.max(0, base - planOf(state, pi, Object.assign({}, fresh, { subs: fresh.subs.filter((y) => y !== s) }), ctx).total);
      ctx.subRate[s.id] = rate;
      ctx.subVal[s.id] = rate * ctx.F;
    }
    return ctx;
  }

  // Expected margin from one dive: P(success) × (what the find is worth) − P(failure) × (what failure costs).
  function diveEV(ctx, x, s, crew, w) {
    const { state, pi, gv } = ctx;
    const p = state.players[pi];
    const c = chanceOf(state, pi, x, s, crew, w);
    const site = siteOf(x);
    let succ = findGain(state, pi, x, w, gv) + ctx.goal[x.id];
    if (!ctx.rough) {
      succ += EV.deny * (ctx.deny[x.id] || 0);
      if (ctx.F > 0.5) succ += slotOf(state, x).kids.filter((n) => state.map[n].by == null && !charted(state, state.map[n])).length * EV.chart;
      succ += crew.filter((d) => (d.xp || 0) + 1 === PROMO_XP).length * EV.promo * ctx.F;
      // The Heart ends the season: good when this company scores slower than its rival from here on, bad when faster.
      if (x.k === 'heart') succ -= ctx.F * (ctx.myRate - ctx.rivalRate);
    }
    const rest = (n) => (ctx.tl > n - 1 ? crew.reduce((t, d) => t + ctx.dRate(d), 0) * n : 0);
    const out = (n) => (ctx.tl > n - 1 ? ctx.sRate(s) * n : 0);
    const cost = (h) => {
      switch (h) {
        case 'shark': {
          const low = Math.min(...crew.map(skillOf));
          return Math.min(...crew.filter((d) => skillOf(d) === low).map(ctx.dVal));
        }
        case 'kraken': return (s ? ctx.sVal(s) : crew.reduce((t, d) => t + ctx.dVal(d), 0) / crew.length) + rest(1);
        case 'cave': return s ? out(2) : rest(2);
        case 'current': return Math.min(3, p.gold) * gv + (s ? out(1) : rest(1));
        case 'trap': return Math.min(2, p.gold) * gv + (s ? out(1) : rest(1));
        default: return rest(1);
      }
    };
    const avg = (hs) => (hs.length ? hs.reduce((t, h) => t + cost(h), 0) / hs.length : 0);
    const pF = 1 - c.p;
    const p1 = Math.min(pF, 0.05);
    let fail = (pF - p1) * avg(c.uncovered) + p1 * avg(site.haz);
    fail += pF * (c.risk.reduce((t, r) => t + r.p * ctx.dVal(crew.find((d) => d.id === r.id)), 0) + (s ? c.crush * ctx.sVal(s) : 0));
    // A failed attempt makes the site easier for everyone, the rival included.
    if (!ctx.rough) fail += pF * 0.05 * (ctx.deny[x.id] || 0);
    return { ev: c.p * succ - fail, p: c.p, c };
  }

  // The best set of dives for one tide: greedily give each sub (or a swim) the site and crew worth the most.
  function planOf(state, pi, fleet, ctx) {
    let subs = fleet.subs.slice();
    let divers = fleet.divers.slice();
    let sites = fleet.sites.slice();
    const dives = [];
    let total = 0;
    for (;;) {
      let best = null;
      for (const s of [...subs, null]) {
        for (const x of sites) {
          const crew = quickCrew(x, s, divers, fleet.w);
          if (!crew.length) continue;
          const r = diveEV(ctx, x, s, crew, fleet.w);
          if (r.ev > 0 && (!best || r.ev > best.ev)) best = { x, s, crew, ev: r.ev, p: r.p };
        }
      }
      if (!best) break;
      dives.push(best);
      total += best.ev;
      subs = subs.filter((y) => y !== best.s);
      divers = divers.filter((y) => !best.crew.includes(y));
      sites = sites.filter((y) => y !== best.x);
    }
    return { total, dives, subs, divers };
  }

  function evChoose(state, pi) {
    const p = state.players[pi];
    const ctx = evContext(state, pi);
    const nowFleet = fleetOf(state, p, false);
    const freshFleet = fleetOf(state, p, true);
    const now = planOf(state, pi, nowFleet, ctx);
    const later = ctx.F > 0 ? ctx.myRate : 0;
    const tl = ctx.tl;
    const income = INCOME + (state.forecast[state.tide] === 'gala' ? 3 : 0);

    // Purchases: the gain to this tide's plan plus the later tides', minus gold (and wages) at what gold is worth now.
    const buys = [];
    const consider = (a, change, gold, wage) => {
      if (legal(state, pi, a)) return;
      // Never spend so much that next tide's wages can't be paid.
      if (tl > 1 && p.gold - gold + income < wagesOf(p) + wage) return;
      const nf = change(nowFleet, false);
      const ff = change(freshFleet, true);
      const dNow = planOf(state, pi, nf.fleet, ctx).total - now.total;
      const dLater = ctx.F > 0 ? planOf(state, pi, ff.fleet, ctx).total - later : 0;
      const q = clone(p);
      q.gold -= gold;
      nf.apply(q);
      const goals = state.goals.filter((g) => g.by == null && !GOALS[g.k].test(p) && GOALS[g.k].test(q)).reduce((t, g) => t + GOALS[g.k].pts, 0);
      const v = dNow + ctx.F * dLater + goals - gold * ctx.gv - wage * (tl - 1) * ctx.gv;
      buys.push({ a, v, now: dNow });
    };
    if (tl >= 1) {
      state.market.forEach((d) => {
        const hire = Object.assign({}, d, { used: false, tired: 0, xp: 0 });
        consider({ t: 'hire', d: d.id }, (f) => ({ fleet: Object.assign({}, f, { divers: f.divers.concat(hire) }), apply: (q) => q.divers.push(hire) }), hireCost(d), DIVER[d.k].wage);
      });
      SUB_ORDER.forEach((k) => {
        const sub = { id: -1, k, mods: [], used: false, stuck: 0 };
        consider({ t: 'build', k }, (f, fresh) => ({ fleet: Object.assign({}, f, { subs: f.subs.concat(fresh || f.w !== 'storm' || k !== 'minnow' ? [sub] : []) }), apply: (q) => q.subs.push(sub) }), SUB[k].cost, 0);
      });
      p.subs.forEach((s) => {
        SUB_ORDER.forEach((k) => {
          if (SUB[k].cost <= SUB[s.k].cost) return;
          const up = Object.assign({}, s, { k });
          const swap = (list) => list.map((y) => (y === s ? up : y));
          consider({ t: 'upgrade', s: s.id, k }, (f) => ({ fleet: Object.assign({}, f, { subs: f.subs.includes(s) ? swap(f.subs) : f.subs }), apply: (q) => (q.subs.find((z) => z.id === s.id).k = k) }), upgradeCost(s, k), 0);
        });
        MOD_ORDER.forEach((m) => {
          const fit = Object.assign({}, s, { mods: s.mods.concat(m) });
          const swap = (list) => list.map((y) => (y === s ? fit : y));
          consider({ t: 'fit', s: s.id, m }, (f) => ({ fleet: Object.assign({}, f, { subs: f.subs.includes(s) ? swap(f.subs) : f.subs }), apply: () => {} }), MOD[m].cost, 0);
        });
      });
    }
    buys.sort((a, b) => b.v - a.v);
    const buy = buys[0] && buys[0].v > 0.05 ? buys[0] : null;

    // Anything that makes this tide's dives better is bought before diving.
    if (buy && buy.now > 0.05) return buy.a;
    if (now.dives.length) {
      // Dive where the rival is most likely to get there first; otherwise the most valuable dive. A dive is only
      // worth making now if it beats waiting for a better crew or forecast next tide.
      const rn = ctx.rivalNow || {};
      const ranked = now.dives
        .map((d) => {
          let wait = 0;
          if (ctx.F > 0) {
            for (const s of [...freshFleet.subs, null]) {
              const crew = quickCrew(d.x, s, freshFleet.divers, freshFleet.w);
              if (crew.length) wait = Math.max(wait, diveEV(ctx, d.x, s, crew, freshFleet.w).ev);
            }
          }
          const keep = 1 - (rn[d.x.id] || 0);
          // Dive now: d.ev, and a failed dive can still be tried again later. Wait: the later dive, if the site is still there.
          const go = d.ev + (1 - d.p) * EV.decay * wait;
          const hold = keep * EV.decay * wait;
          return Object.assign({}, d, { gain: go - hold, race: (rn[d.x.id] || 0) * d.ev });
        })
        .filter((d) => d.gain > 0)
        .sort((a, b) => b.race - a.race || b.ev - a.ev);
      if (ranked.length) {
        const d = ranked[0];
        return { t: 'dive', x: d.x.id, s: d.s ? d.s.id : null, crew: d.crew.map((y) => y.id) };
      }
    }
    if (buy) return buy.a;
    // Leftover subs and divers bring in a little gold.
    const left = now.subs.filter((s) => !s.used && s.stuck < now.tide);
    if (now.divers.length) {
      const s = left.sort((a, b) => SUB[b.k].crew - SUB[a.k].crew)[0] || null;
      const crew = now.divers.slice(0, s ? SUB[s.k].crew : SWIM_CREW);
      if ((1 + crew.length) * ctx.gv > 0.05) return { t: 'salvage', s: s ? s.id : null, crew: crew.map((d) => d.id) };
    }
    return { t: 'pass' };
  }

  const api = {
    SAVE_V, TIDES, HEART_TIDE, START_GOLD, INCOME, MAX_SUBS, MAX_DIVERS, MARKET_SIZE, UNCOVERED, SCOUT_MAX, KNOWN_BONUS, PROMO_XP, DISCOVERY_PTS, GOLD_PER_PT, GOAL_COUNT,
    HAZ, HAZ_ORDER, DEPTH, SUB, SUB_ORDER, MOD, MOD_ORDER, DIVER, DIVER_ORDER, TIER, SITE, SITE_ORDER, SEA, SEA_ORDER, SEA_DOUBLE, AI_LEVEL, AI_HEAD_START,
    RELIC, RELIC_ORDER, RELIC_SET, GOALS, GOAL_ORDER, ROWS, SLOTS, CHARTS, slotsOf,
    newGame, aiHeadStart, legal, apply, chance, score, rewardRange, winner, aiChoose, bestCrew, clone, upgradeCost, hireCost, relicPoints,
    sea, diverReady, subReady, readyDivers, readySubs, wagesOf, crewRoom, maxDepth, tidesLeft, siteOf, targetOf, rewardOf, expOf, subOf, diverOf,
    isOpen, openSites, charted, knownWaters, promoted, skillOf, deepOf, poss,
    UNCHARTED, DIVER_DEEP_PEN, DIVER_LOST, SUB_DEEP_PEN, SUB_CRUSH, SWIM_CREW, SWIM_PEN, SWIM_LOST, EV,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AtlantisEngine = api;
})(typeof window !== 'undefined' ? window : this);
