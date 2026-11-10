// Whiteout Station — rules engine and computer crew. No DOM access, so it also runs in Node for simulations and
// on the server for online games.
// A cooperative game: four crew roles (shared out among 1–4 players and computer crewmates) repair the radio,
// verify research samples and call in a rescue plane before the storm deck runs out. Each role holds a secret the
// others can't see; the only way to share it is one signal per round, pointed at a place on the map.
(function (root) {
  'use strict';

  const SAVE_V = 1;
  const MAX_WARMTH = 5;
  const ACTIONS = 3;
  const PARTS = 3;
  const DAMAGE_LOSS = 3; // this many damaged modules at once and the station is lost
  const PLANE_ROUNDS = 2; // the plane lands at the end of the second round after the call

  const ROLES = {
    weather: { name: 'Meteorologist', icon: '🌦️', color: '#38a3c9', secret: 'You can see the next two storms.', power: 'Reroute: in the Radio Room, send the next storm to the bottom of the deck (once a round).' },
    engineer: { name: 'Engineer', icon: '🧰', color: '#e0902b', secret: 'You know which field sites hide the radio parts.', power: 'Installs radio parts and repairs modules in 1 action (others need 2).' },
    researcher: { name: 'Researcher', icon: '🔬', color: '#7c5cd6', secret: 'You know which samples are clean.', power: 'Analyzes a sample in 1 action (others need 2).' },
    medic: { name: 'Medic', icon: '🩺', color: '#d9475a', secret: 'You can see exactly how warm everyone is.', power: 'Treat: +2 warmth to anyone in the same place. Carries a frozen crewmate at full speed.' },
  };
  const ROLE_ORDER = ['weather', 'engineer', 'researcher', 'medic'];

  const PLACES = {
    radio: { name: 'Radio Room', icon: '📻', inside: true },
    lab: { name: 'Lab', icon: '🧪', inside: true },
    infirmary: { name: 'Infirmary', icon: '🛏️', inside: true },
    generator: { name: 'Generator', icon: '⚙️', inside: true },
    hangar: { name: 'Hangar', icon: '🛩️', inside: true },
    mast: { name: 'Antenna Mast', icon: '📡', inside: false },
    lake: { name: 'Glacier Lake', icon: '🧊', inside: false },
    ridge: { name: 'Ice Ridge', icon: '🏔️', inside: false },
    crash: { name: 'Crash Site', icon: '✈️', inside: false },
  };
  const MODULES = ['radio', 'lab', 'infirmary', 'generator', 'hangar'];
  const SITES = ['mast', 'lake', 'ridge', 'crash'];
  // The station is a ring of modules; the Hangar's airlock opens onto the ice.
  const EDGES = [
    ['hangar', 'radio'], ['radio', 'lab'], ['lab', 'infirmary'], ['infirmary', 'generator'], ['generator', 'hangar'],
    ['hangar', 'mast'], ['hangar', 'lake'], ['mast', 'crash'], ['lake', 'ridge'], ['ridge', 'crash'],
  ];
  const ADJ = {};
  Object.keys(PLACES).forEach((p) => (ADJ[p] = []));
  EDGES.forEach(([a, b]) => {
    ADJ[a].push(b);
    ADJ[b].push(a);
  });
  const REGIONS = {
    east: { name: 'the eastern ice', sites: ['mast', 'crash'] },
    west: { name: 'the western ice', sites: ['lake', 'ridge'] },
    far: { name: 'the far ice', sites: ['ridge', 'crash'] },
    near: { name: 'the near ice', sites: ['mast', 'lake'] },
    all: { name: 'all the ice', sites: SITES.slice() },
  };

  const DIFF = {
    // Tuned by simulation: an all-computer crew (which reads every signal perfectly) wins about 98% / 64% / 24% of
    // the time; people sharing only one signal a round do worse.
    easy: { name: 'New Team', storms: 11, fuel: 5, clean: 5, need: 2, harsh: 0 },
    standard: { name: 'Standard', storms: 10, fuel: 4, clean: 4, need: 3, harsh: 1 },
    veteran: { name: 'Veteran', storms: 9, fuel: 3, clean: 3, need: 3, harsh: 2 },
  };

  // ---------------------------------------------------------------- randomness (seeded, kept in the state)
  function rnd(state) {
    let t = (state.seed = (state.seed + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rint = (state, n) => Math.floor(rnd(state) * n);
  function shuffle(state, a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = rint(state, i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------------------------------------------------------------- storms
  // Cards: calm (no cold outside this round), blizzard (a region: −2 warmth there), whiteout (a site is cut off for
  // the next round), ice (a module is damaged), freeze (the generator burns an extra fuel).
  function stormText(c) {
    if (c.t === 'calm') return { title: 'Calm skies', text: 'The wind drops. Nobody outside gets colder this round.' };
    if (c.t === 'blizzard') return { title: `Blizzard over ${REGIONS[c.r].name}`, text: `Anyone at ${REGIONS[c.r].sites.map((s) => PLACES[s].name).join(', ')} loses 2 warmth.` };
    if (c.t === 'whiteout') return { title: `Whiteout at ${PLACES[c.s].name}`, text: `Nobody can move into or out of ${PLACES[c.s].name} next round.` };
    if (c.t === 'ice') return { title: `Ice storm hits the ${PLACES[c.m].name}`, text: `The ${PLACES[c.m].name} is damaged until someone repairs it.` };
    if (c.t === 'freeze') return { title: 'Deep freeze', text: 'The generator burns an extra fuel tonight.' };
    return { title: 'Storm', text: '' };
  }
  function buildStorms(state) {
    const d = DIFF[state.diff];
    const n = d.storms;
    const third = Math.ceil(n / 3);
    const pick = (a) => a[rint(state, a.length)];
    const early = [];
    const mid = [];
    const late = [];
    for (let i = 0; i < third; i++) {
      early.push(i % 3 === 0 ? { t: 'calm' } : i % 3 === 1 ? { t: 'blizzard', r: pick(['east', 'west', 'near', 'far']) } : { t: 'whiteout', s: pick(SITES) });
    }
    for (let i = 0; i < third; i++) {
      mid.push([{ t: 'blizzard', r: pick(['east', 'west', 'near', 'far']) }, { t: 'ice', m: pick(MODULES) }, { t: 'freeze' }, d.harsh ? { t: 'whiteout', s: pick(SITES) } : { t: 'calm' }][i % 4]);
    }
    for (let i = 0; early.length + mid.length + late.length < n; i++) {
      late.push([{ t: 'blizzard', r: d.harsh >= 2 ? 'all' : pick(['east', 'west', 'far']) }, { t: 'ice', m: pick(MODULES) }, { t: 'blizzard', r: pick(['near', 'far', 'east', 'west']) }, { t: 'freeze' }][i % 4]);
    }
    // Drawn from the end: early cards come first.
    return shuffle(state, late).concat(shuffle(state, mid), shuffle(state, early));
  }

  // ---------------------------------------------------------------- setup
  // opts: { seed, diff, crew: [seat for weather, engineer, researcher, medic], names: [seat names], ai: [seat is a computer] }
  function newGame(opts) {
    opts = opts || {};
    const names = opts.names || ['Crew'];
    const seats = names.length;
    const crewSeats = opts.crew || ROLE_ORDER.map((_, i) => i % seats);
    const state = {
      v: SAVE_V,
      seed: (opts.seed != null ? opts.seed : Math.floor(Math.random() * 2 ** 31)) | 0,
      diff: DIFF[opts.diff] ? opts.diff : 'standard',
      phase: 'signal',
      round: 1,
      turn: 0,
      acts: ACTIONS,
      rerouted: false,
      players: names.map((name, i) => ({ name: String(name || `Player ${i + 1}`).slice(0, 18), ai: !!(opts.ai && opts.ai[i]), level: 'normal' })),
      crew: ROLE_ORDER.map((role, i) => ({ role, seat: crewSeats[i], at: 'hangar', warmth: MAX_WARMTH, frozen: null, carry: null, carriedBy: null })),
      sites: {},
      ground: {},
      fuel: 0,
      installed: 0,
      verified: 0,
      need: 0,
      damaged: {},
      whiteout: {},
      storms: [],
      past: [],
      signals: ROLE_ORDER.map(() => null),
      plane: null,
      result: null,
      log: [],
      last: null,
    };
    const d = DIFF[state.diff];
    state.fuel = d.fuel;
    state.need = d.need;
    Object.keys(PLACES).forEach((p) => (state.ground[p] = []));
    const partSites = shuffle(state, SITES.slice()).slice(0, PARTS);
    const clean = shuffle(state, Array.from({ length: SITES.length * 2 }, (_, i) => i < d.clean));
    let sid = 0;
    SITES.forEach((s, i) => {
      state.sites[s] = {
        part: partSites.includes(s),
        searched: false,
        samples: [0, 1].map((k) => ({ id: `s${++sid}`, clean: clean[i * 2 + k], taken: false, tested: null })),
        fuel: s === 'crash' ? 3 : s === 'lake' ? 2 : 0,
      };
    });
    state.storms = buildStorms(state);
    log(state, `The crew reaches Whiteout Station. The radio is dead, ${PARTS} radio parts are scattered across the ice, and a storm is building.`);
    beginSignals(state);
    return state;
  }

  function log(state, text, who) {
    state.log.push({ n: state.round, text, who: who == null ? null : who });
    if (state.log.length > 160) state.log.splice(0, state.log.length - 160);
  }

  // ---------------------------------------------------------------- helpers
  const crewOf = (state, seat) => state.crew.map((c, i) => i).filter((i) => state.crew[i].seat === seat);
  const inside = (place) => !!(PLACES[place] && PLACES[place].inside);
  const radioReady = (state) => state.installed >= PARTS;
  const stormsLeft = (state) => (state.storms ? state.storms.length : state.stormsLeft || 0);
  const researchReady = (state) => state.verified >= state.need;
  const cut = (state, place) => !!state.whiteout[place] && state.whiteout[place] >= state.round;
  function band(w) {
    if (w <= 0) return 'frozen';
    if (w === 1) return 'freezing';
    if (w <= 3) return 'cold';
    return 'warm';
  }
  function cost(state, ci, kind) {
    const role = state.crew[ci].role;
    if (kind === 'install' || kind === 'repair') return role === 'engineer' ? 1 : 2;
    if (kind === 'analyze') return role === 'researcher' ? 1 : 2;
    if (kind === 'move') return state.crew[ci].carry && state.crew[ci].carry.t === 'crew' && role !== 'medic' ? 2 : 1;
    return 1;
  }
  function itemName(it) {
    if (!it) return '';
    if (it.t === 'part') return 'a radio part';
    if (it.t === 'sample') return 'a sample';
    if (it.t === 'fuel') return 'a fuel drum';
    if (it.t === 'crew') return 'a frozen crewmate';
    return 'something';
  }
  const crewName = (state, ci) => ROLES[state.crew[ci].role].name;
  function sampleById(state, id) {
    for (const s of SITES) {
      const x = state.sites[s].samples.find((o) => o.id === id);
      if (x) return x;
    }
    return null;
  }

  // ---------------------------------------------------------------- phases
  function beginSignals(state) {
    state.phase = 'signal';
    state.signals = ROLE_ORDER.map(() => null);
    // Frozen crew can't signal; nothing to wait for from them.
    state.crew.forEach((c, i) => {
      if (c.frozen != null) state.signals[i] = { none: true };
    });
    if (state.signals.every(Boolean)) beginActions(state);
  }
  function beginActions(state) {
    state.phase = 'act';
    state.rerouted = false;
    state.turn = -1;
    nextTurn(state);
  }
  function nextTurn(state) {
    for (let i = state.turn + 1; i < state.crew.length; i++) {
      if (state.crew[i].frozen == null) {
        state.turn = i;
        state.acts = ACTIONS;
        return;
      }
    }
    endRound(state);
  }

  function endRound(state) {
    state.phase = 'storm';
    const card = state.storms.pop();
    state.past.push(card);
    const t = stormText(card);
    const hits = [];
    log(state, `⛈️ ${t.title}. ${t.text}`);
    if (card.t === 'blizzard') {
      state.crew.forEach((c, i) => {
        if (REGIONS[card.r].sites.includes(c.at)) {
          chill(state, i, 2);
          hits.push(i);
        }
      });
    } else if (card.t === 'whiteout') {
      state.whiteout[card.s] = state.round + 1;
    } else if (card.t === 'ice') {
      if (!state.damaged[card.m]) state.damaged[card.m] = true;
    }
    // Upkeep: the generator heats the station; the ice is cold.
    const burn = card.t === 'freeze' ? 2 : 1;
    const heat = !state.damaged.generator && state.fuel > 0;
    if (!state.damaged.generator) state.fuel = Math.max(0, state.fuel - burn);
    state.crew.forEach((c, i) => {
      if (inside(c.at)) {
        if (heat) warm(state, i, 1);
        else chill(state, i, 1);
      } else if (card.t !== 'calm') chill(state, i, 1);
    });
    if (!heat) log(state, state.damaged.generator ? '🥶 The generator is down: the station has no heat.' : '🥶 The fuel has run out: the station has no heat.');
    state.last = { t: 'storm', card, hits };
    // Losses.
    const lost = state.crew.findIndex((c) => c.frozen != null && c.frozen < state.round);
    if (lost >= 0) return finish(state, false, `The ${crewName(state, lost)} froze on the ice before anyone could bring them in.`);
    const broken = MODULES.filter((m) => state.damaged[m]).length;
    if (broken >= DAMAGE_LOSS) return finish(state, false, `With ${broken} modules wrecked, the station can’t hold out any longer.`);
    // The plane.
    if (state.plane && state.round >= state.plane.round + PLANE_ROUNDS) {
      const all = state.crew.every((c) => c.at === 'hangar');
      if (all && !state.damaged.hangar) return finish(state, true, 'The rescue plane touches down through the whiteout. The whole crew — and the research — make it home!');
      log(state, state.damaged.hangar ? '🛩️ The plane circles overhead, but the Hangar is damaged and it can’t land.' : '🛩️ The plane circles overhead: everyone must be in the Hangar for it to land.');
    }
    if (!state.storms.length) return finish(state, false, 'The final whiteout swallows the station before rescue can arrive.');
    state.round += 1;
    beginSignals(state);
  }

  function chill(state, ci, n) {
    const c = state.crew[ci];
    if (c.frozen != null) return;
    c.warmth = Math.max(0, c.warmth - n);
    if (c.warmth === 0) {
      c.frozen = state.round;
      if (c.carry) drop(state, ci);
      log(state, `🧊 The ${crewName(state, ci)} has frozen at ${PLACES[c.at].name}! Bring them inside before the end of next round.`, ci);
    }
  }
  function warm(state, ci, n) {
    const c = state.crew[ci];
    c.warmth = Math.min(MAX_WARMTH, c.warmth + n);
    if (c.frozen != null && c.warmth > 0) {
      c.frozen = null;
      if (c.carriedBy != null) {
        state.crew[c.carriedBy].carry = null;
        c.carriedBy = null;
      }
      log(state, `🔥 The ${crewName(state, ci)} thaws out.`, ci);
    }
  }
  function drop(state, ci) {
    const c = state.crew[ci];
    if (!c.carry) return;
    if (c.carry.t === 'crew') state.crew[c.carry.i].carriedBy = null;
    else state.ground[c.at].push(c.carry);
    c.carry = null;
  }

  function finish(state, win, reason) {
    state.phase = 'over';
    state.result = { win, reason, round: state.round };
    log(state, `${win ? '🏆' : '❄️'} ${reason}`);
  }

  // ---------------------------------------------------------------- moves
  // Which crew members a seat must decide for right now.
  function waitingOn(state) {
    if (state.phase === 'over') return [];
    if (state.phase === 'signal') return [...new Set(state.crew.map((c, i) => (state.signals[i] ? null : c.seat)).filter((s) => s != null))];
    if (state.phase === 'act') return [state.crew[state.turn].seat];
    return [];
  }
  // The crew member a seat is deciding for now (the signal phase goes through a seat's crew in role order).
  function deciding(state, seat) {
    if (state.phase === 'signal') return state.crew.findIndex((c, i) => c.seat === seat && !state.signals[i]);
    if (state.phase === 'act' && state.crew[state.turn].seat === seat) return state.turn;
    return -1;
  }

  function legal(state, seat) {
    const ci = deciding(state, seat);
    if (ci < 0) return [];
    if (state.phase === 'signal') {
      const out = [{ t: 'signal', ci, none: true }];
      Object.keys(PLACES).forEach((at) => ['go', 'avoid', 'check'].forEach((kind) => out.push({ t: 'signal', ci, at, kind })));
      return out;
    }
    return actionsFor(state, ci);
  }

  function actionsFor(state, ci) {
    const c = state.crew[ci];
    const out = [{ t: 'end' }];
    const left = state.acts;
    const here = c.at;
    const can = (kind) => cost(state, ci, kind) <= left;
    if (can('move')) ADJ[here].forEach((to) => {
      if (!cut(state, here) && !cut(state, to)) out.push({ t: 'move', to });
    });
    const site = state.sites[here];
    if (site && !site.searched) out.push({ t: 'search' });
    if (!c.carry) {
      if (site) site.samples.forEach((s) => !s.taken && out.push({ t: 'take', what: 'sample', id: s.id }));
      if (site && site.fuel > 0) out.push({ t: 'take', what: 'fuel' });
      state.ground[here].forEach((it, k) => out.push({ t: 'take', what: 'ground', k }));
      state.crew.forEach((o, i) => {
        if (i !== ci && o.at === here && o.frozen != null && o.carriedBy == null) out.push({ t: 'take', what: 'crew', i });
      });
    } else out.push({ t: 'drop' });
    if (here === 'radio' && c.carry && c.carry.t === 'part' && !state.damaged.radio && can('install')) out.push({ t: 'install' });
    if (here === 'lab' && c.carry && c.carry.t === 'sample' && !state.damaged.lab && can('analyze')) out.push({ t: 'analyze' });
    if (here === 'generator' && c.carry && c.carry.t === 'fuel' && !state.damaged.generator) out.push({ t: 'refuel' });
    if (state.damaged[here] && can('repair')) out.push({ t: 'repair' });
    if (inside(here)) {
      state.crew.forEach((o, i) => {
        if (o.at === here && o.warmth < MAX_WARMTH) out.push({ t: 'warm', i });
      });
    }
    if (c.role === 'medic') state.crew.forEach((o, i) => {
      if (o.at === here && o.warmth < MAX_WARMTH) out.push({ t: 'treat', i });
    });
    if (c.role === 'weather' && here === 'radio' && !state.damaged.radio && !state.rerouted && stormsLeft(state) > 1) out.push({ t: 'reroute' });
    if (here === 'radio' && !state.damaged.radio && radioReady(state) && researchReady(state) && !state.plane) out.push({ t: 'call' });
    return out;
  }

  const sameMove = (a, b) => ['t', 'to', 'what', 'id', 'k', 'i', 'at', 'kind', 'none'].every((k) => (a[k] ?? null) === (b[k] ?? null));

  function apply(state, seat, a) {
    if (state.phase === 'over') throw new Error('The game is over.');
    if (!a || !a.t) throw new Error('No move.');
    const ci = deciding(state, seat);
    if (ci < 0) throw new Error('It’s not your turn.');
    if (state.phase === 'signal') {
      if (a.t !== 'signal') throw new Error('Send a signal first.');
      if (!a.none && (!PLACES[a.at] || !['go', 'avoid', 'check'].includes(a.kind))) throw new Error('That isn’t a signal.');
      state.signals[ci] = a.none ? { none: true } : { at: a.at, kind: a.kind };
      state.last = { t: 'signal', ci };
      if (state.signals.every(Boolean)) {
        const sent = state.signals.map((s, i) => (s && !s.none ? `${ROLES[state.crew[i].role].icon} ${SIGNAL_WORD[s.kind]} ${PLACES[s.at].name}` : null)).filter(Boolean);
        log(state, sent.length ? `📡 Signals: ${sent.join(' · ')}` : '📡 No signals this round.');
        beginActions(state);
      }
      return state;
    }
    const opts = actionsFor(state, ci);
    if (!opts.some((o) => sameMove(o, a))) throw new Error('That isn’t possible right now.');
    const c = state.crew[ci];
    const who = ci;
    const nm = crewName(state, ci);
    let spent = 1;
    state.last = { t: a.t, ci };
    switch (a.t) {
      case 'end':
        state.last = { t: 'end', ci };
        nextTurn(state);
        return state;
      case 'move': {
        spent = cost(state, ci, 'move');
        const from = c.at;
        c.at = a.to;
        if (c.carry && c.carry.t === 'crew') state.crew[c.carry.i].at = a.to;
        state.last = { t: 'move', ci, from, to: a.to };
        break;
      }
      case 'search': {
        const s = state.sites[c.at];
        s.searched = true;
        if (s.part) {
          s.part = false;
          if (!c.carry) c.carry = { t: 'part' };
          else state.ground[c.at].push({ t: 'part' });
          log(state, `🔧 The ${nm} found a radio part at ${PLACES[c.at].name}!`, who);
          state.last = { t: 'search', ci, found: true };
        } else {
          log(state, `The ${nm} searched ${PLACES[c.at].name}: no radio part here.`, who);
          state.last = { t: 'search', ci, found: false };
        }
        break;
      }
      case 'take': {
        if (a.what === 'sample') {
          const smp = state.sites[c.at].samples.find((o) => o.id === a.id);
          smp.taken = true;
          c.carry = { t: 'sample', id: smp.id, from: c.at };
          log(state, `The ${nm} took a sample at ${PLACES[c.at].name}.`, who);
        } else if (a.what === 'fuel') {
          state.sites[c.at].fuel -= 1;
          c.carry = { t: 'fuel' };
          log(state, `The ${nm} picked up a fuel drum.`, who);
        } else if (a.what === 'ground') {
          c.carry = state.ground[c.at].splice(a.k, 1)[0];
          log(state, `The ${nm} picked up ${itemName(c.carry)}.`, who);
        } else if (a.what === 'crew') {
          c.carry = { t: 'crew', i: a.i };
          state.crew[a.i].carriedBy = ci;
          log(state, `The ${nm} lifts the frozen ${crewName(state, a.i)}.`, who);
        }
        break;
      }
      case 'drop':
        log(state, `The ${nm} put down ${itemName(c.carry)} at ${PLACES[c.at].name}.`, who);
        drop(state, ci);
        break;
      case 'install':
        spent = cost(state, ci, 'install');
        c.carry = null;
        state.installed += 1;
        log(state, state.installed >= PARTS ? `📻 The ${nm} installed the last part — the radio is working!` : `📻 The ${nm} installed a radio part (${state.installed}/${PARTS}).`, who);
        break;
      case 'analyze': {
        spent = cost(state, ci, 'analyze');
        const smp = sampleById(state, c.carry.id);
        c.carry = null;
        smp.tested = smp.clean;
        if (smp.clean) {
          state.verified += 1;
          log(state, `🧪 The ${nm} verified a clean sample (${state.verified}/${state.need}).`, who);
        } else log(state, `🧪 The ${nm} analyzed a sample — contaminated. It’s useless.`, who);
        state.last = { t: 'analyze', ci, clean: smp.clean };
        break;
      }
      case 'refuel':
        c.carry = null;
        state.fuel += 2;
        log(state, `⛽ The ${nm} fed the generator: fuel ${state.fuel}.`, who);
        break;
      case 'repair':
        spent = cost(state, ci, 'repair');
        delete state.damaged[c.at];
        log(state, `🔩 The ${nm} repaired the ${PLACES[c.at].name}.`, who);
        break;
      case 'warm': {
        const gain = c.at === 'infirmary' && !state.damaged.infirmary ? 2 : 1;
        warm(state, a.i, gain);
        log(state, a.i === ci ? `The ${nm} warmed up (+${gain}).` : `The ${nm} warmed the ${crewName(state, a.i)} (+${gain}).`, who);
        break;
      }
      case 'treat':
        warm(state, a.i, 2);
        log(state, a.i === ci ? 'The Medic treated their own frostbite (+2).' : `🩺 The Medic treated the ${crewName(state, a.i)} (+2).`, who);
        break;
      case 'reroute': {
        const top = state.storms.pop();
        state.storms.unshift(top);
        state.rerouted = true;
        log(state, '🌦️ The Meteorologist rerouted the coming storm.', who);
        break;
      }
      case 'call':
        state.plane = { round: state.round };
        log(state, `🛩️ The ${nm} radioed for rescue! The plane lands at the end of round ${state.round + PLANE_ROUNDS} — everyone must be in the Hangar.`, who);
        break;
      default:
        throw new Error('Unknown move.');
    }
    state.acts -= spent;
    if (state.acts <= 0) nextTurn(state);
    return state;
  }
  const SIGNAL_WORD = { go: '✅ go to', avoid: '⚠️ avoid', check: '❓ check' };

  // ---------------------------------------------------------------- what each seat may see
  // A copy of the state with everyone else's secrets hidden: radio part sites (Engineer), clean samples
  // (Researcher), the coming storms (Meteorologist) and exact warmth (Medic, and your own crew).
  function knows(state, seat) {
    const roles = new Set(state.crew.filter((c) => c.seat === seat).map((c) => c.role));
    return { weather: roles.has('weather'), engineer: roles.has('engineer'), researcher: roles.has('researcher'), medic: roles.has('medic') };
  }
  function publicState(state, seat) {
    const s = JSON.parse(JSON.stringify(state));
    const k = knows(state, seat);
    const over = state.phase === 'over';
    SITES.forEach((p) => {
      const site = s.sites[p];
      if (!k.engineer && !over && !site.searched) site.part = null;
      site.samples.forEach((smp) => {
        if (!k.researcher && !over && smp.tested == null) smp.clean = null;
      });
    });
    s.crew.forEach((c, i) => {
      // Signals stay secret until everyone has sent theirs.
      if (state.phase === 'signal' && c.seat !== seat && s.signals[i]) s.signals[i] = { sent: true, none: true };
      if (k.medic || over || c.seat === seat) return;
      c.band = band(c.warmth);
      c.warmth = null;
    });
    s.stormsLeft = state.storms.length;
    s.forecast = k.weather || over ? state.storms.slice(-2).reverse() : null;
    s.storms = null;
    s.seed = 0;
    return s;
  }

  // ---------------------------------------------------------------- computer crew
  // A computer crewmate only uses what its own role knows, the public board and everyone's signals.
  function dist(from, to, state) {
    if (from === to) return 0;
    const seen = { [from]: 0 };
    const q = [from];
    while (q.length) {
      const p = q.shift();
      for (const n of ADJ[p]) {
        if (seen[n] != null) continue;
        if (state && (cut(state, n) || cut(state, p)) && n !== to) continue;
        seen[n] = seen[p] + 1;
        if (n === to) return seen[n];
        q.push(n);
      }
    }
    return 99;
  }
  function stepToward(state, from, to) {
    let best = null;
    let bd = 99;
    for (const n of ADJ[from]) {
      if (cut(state, from) || cut(state, n)) continue;
      const d = dist(n, to, state);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  // What a crewmate believes about the board from its own knowledge and the signals.
  function beliefs(state, ci) {
    const me = state.crew[ci];
    const k = knows(state, me.seat);
    const sig = (role) => {
      const i = state.crew.findIndex((c) => c.role === role);
      const s = state.signals[i];
      return s && !s.none ? s : null;
    };
    const partSites = SITES.filter((p) => !state.sites[p].searched && (k.engineer ? state.sites[p].part : true));
    const eng = sig('engineer');
    const engHint = !k.engineer && eng && eng.kind === 'go' && SITES.includes(eng.at) && !state.sites[eng.at].searched ? eng.at : null;
    const res = sig('researcher');
    const resHint = !k.researcher && res && res.kind === 'go' && SITES.includes(res.at) ? res.at : null;
    const met = sig('weather');
    const danger = met && met.kind === 'avoid' ? met.at : null;
    return { k, partSites, engHint, resHint, danger };
  }
  // The storm a computer Meteorologist (or anyone, in the Meteorologist's eyes) expects next.
  const nextStorm = (state) => state.storms[state.storms.length - 1];

  function aiSignal(state, ci) {
    const c = state.crew[ci];
    const role = c.role;
    if (role === 'engineer') {
      const left = SITES.filter((p) => state.sites[p].part && !state.sites[p].searched);
      if (left.length) {
        const nearest = left.sort((a, b) => dist('hangar', a) - dist('hangar', b))[0];
        return { t: 'signal', ci, at: nearest, kind: 'go' };
      }
      const broken = MODULES.find((m) => state.damaged[m]);
      return broken ? { t: 'signal', ci, at: broken, kind: 'check' } : { t: 'signal', ci, none: true };
    }
    if (role === 'researcher') {
      const need = state.need - state.verified - state.crew.filter((x) => x.carry && x.carry.t === 'sample' && sampleById(state, x.carry.id).clean).length;
      if (need > 0) {
        const good = SITES.filter((p) => state.sites[p].samples.some((s) => s.clean && !s.taken));
        good.sort((a, b) => dist('hangar', a) - dist('hangar', b));
        if (good.length) return { t: 'signal', ci, at: good[0], kind: 'go' };
      }
      return { t: 'signal', ci, none: true };
    }
    if (role === 'weather') {
      const n = nextStorm(state);
      if (n && n.t === 'blizzard') return { t: 'signal', ci, at: REGIONS[n.r].sites[0], kind: 'avoid' };
      if (n && n.t === 'whiteout') return { t: 'signal', ci, at: n.s, kind: 'avoid' };
      if (n && n.t === 'ice') return { t: 'signal', ci, at: n.m, kind: 'check' };
      return { t: 'signal', ci, none: true };
    }
    // Medic: point at whoever is coldest, if anyone is in trouble.
    const cold = state.crew.map((x, i) => i).filter((i) => i !== ci).sort((a, b) => state.crew[a].warmth - state.crew[b].warmth)[0];
    if (cold != null && state.crew[cold].warmth <= 2) return { t: 'signal', ci, at: state.crew[cold].at, kind: 'check' };
    return { t: 'signal', ci, none: true };
  }

  // Decide one action for the computer crewmate whose turn it is.
  function aiAct(state, ci) {
    const c = state.crew[ci];
    const opts = actionsFor(state, ci);
    const has = (m) => opts.find((o) => sameMove(o, m));
    const b = beliefs(state, ci);
    const left = state.acts;
    const roundsLeft = state.storms.length;
    const go = (to) => {
      if (c.at === to) return null;
      const n = stepToward(state, c.at, to);
      return n ? has({ t: 'move', to: n }) : null;
    };
    const danger = (place) => {
      if (!b.k.weather) return place === b.danger;
      const n = nextStorm(state);
      return !!(n && n.t === 'blizzard' && REGIONS[n.r].sites.includes(place));
    };
    const myW = c.warmth;
    // 1. A frozen crewmate: carry them home (Medic treats on the spot).
    const frozen = state.crew.findIndex((o, i) => i !== ci && o.frozen != null);
    if (frozen >= 0) {
      const f = state.crew[frozen];
      if (c.carry && c.carry.t === 'crew') {
        if (inside(c.at)) {
          const w = has({ t: 'warm', i: c.carry.i });
          if (w) return w;
        }
        return go('hangar') || has({ t: 'end' });
      }
      if (f.carriedBy == null && dist(c.at, f.at, state) <= 3) {
        if (c.at === f.at) {
          if (c.role === 'medic') return has({ t: 'treat', i: frozen }) || has({ t: 'end' });
          if (inside(c.at)) return has({ t: 'warm', i: frozen }) || has({ t: 'end' });
          if (c.carry) return has({ t: 'drop' });
          return has({ t: 'take', what: 'crew', i: frozen }) || has({ t: 'end' });
        }
        const step = go(f.at);
        if (step) return step;
      }
    }
    // 2. Medic: treat whoever is cold nearby.
    if (c.role === 'medic') {
      const cold = state.crew.map((o, i) => i).filter((i) => state.crew[i].at === c.at && state.crew[i].warmth <= 3).sort((x, y) => state.crew[x].warmth - state.crew[y].warmth)[0];
      if (cold != null) {
        const t = has({ t: 'treat', i: cold });
        if (t) return t;
      }
    }
    // 3. Too cold to be outside: head in and warm up.
    if (!inside(c.at) && myW <= 2) return go('hangar') || has({ t: 'end' });
    if (inside(c.at) && myW <= 2) {
      if (c.at !== 'infirmary' && dist(c.at, 'infirmary') <= 1 && left >= 2) return go('infirmary');
      return has({ t: 'warm', i: ci }) || has({ t: 'end' });
    }
    // 4. Deliver what you're carrying.
    if (c.carry) {
      const target = c.carry.t === 'part' ? 'radio' : c.carry.t === 'sample' ? 'lab' : c.carry.t === 'fuel' ? 'generator' : 'hangar';
      if (c.at === target) {
        const act = has({ t: c.carry.t === 'part' ? 'install' : c.carry.t === 'sample' ? 'analyze' : 'refuel' });
        if (act) return act;
        if (state.damaged[target]) return has({ t: 'repair' }) || has({ t: 'end' });
        return has({ t: 'end' });
      }
      // A Researcher doesn't carry a sample it knows is contaminated.
      if (c.carry.t === 'sample' && b.k.researcher && !sampleById(state, c.carry.id).clean) return has({ t: 'drop' });
      return go(target) || has({ t: 'end' });
    }
    // 5. Repairs that matter: generator always, others if two are down (Engineer handles any).
    const broken = MODULES.filter((m) => state.damaged[m]);
    const urgent = broken.find((m) => m === 'generator') || (broken.length >= 2 ? broken[0] : null) || (c.role === 'engineer' ? broken[0] : null) || (state.plane && state.damaged.hangar ? 'hangar' : null);
    if (urgent && (c.role === 'engineer' || dist(c.at, urgent) <= 2)) {
      if (c.at === urgent) return has({ t: 'repair' }) || has({ t: 'end' });
      return go(urgent) || has({ t: 'end' });
    }
    // 6. The plane is coming: everyone to the Hangar.
    if (state.plane) return go('hangar') || has({ t: 'end' });
    if (radioReady(state) && researchReady(state)) return go('radio') || has({ t: 'call' }) || has({ t: 'end' });
    if (c.at === 'radio' && has({ t: 'call' })) return has({ t: 'call' });
    // 7. Meteorologist: reroute a nasty storm from the Radio Room.
    if (c.role === 'weather' && !state.rerouted) {
      const n = nextStorm(state);
      const bad = n && (n.t === 'ice' || n.t === 'freeze' || (n.t === 'blizzard' && state.crew.some((o) => REGIONS[n.r].sites.includes(o.at))));
      if (bad && dist(c.at, 'radio') <= 1) {
        if (c.at === 'radio') return has({ t: 'reroute' }) || has({ t: 'end' });
        return go('radio');
      }
    }
    // 8. Fuel: one computer crewmate keeps the generator going (the Medic first, the Engineer last), so the others
    // can chase parts and samples.
    const burnLeft = Math.min(roundsLeft, 6);
    const fuelHauled = state.crew.filter((o) => o.carry && o.carry.t === 'fuel').length * 2;
    const fuelSites = SITES.filter((p) => state.sites[p].fuel > 0);
    const runner = ['medic', 'weather', 'researcher', 'engineer'].map((r) => state.crew.findIndex((o) => o.role === r)).find((i) => state.players[state.crew[i].seat].ai && state.crew[i].frozen == null);
    const fuelLow = state.fuel + fuelHauled < Math.min(roundsLeft, 3);
    if (fuelLow && ci === runner && fuelSites.length && myW >= 3) {
      const tgt = fuelSites.sort((x, y) => dist(c.at, x) - dist(c.at, y))[0];
      if (c.at === tgt) return has({ t: 'take', what: 'fuel' }) || has({ t: 'end' });
      if (!danger(tgt)) return go(tgt) || has({ t: 'end' });
    }
    // Items lying around nearby (a part dropped on the ice, say).
    const groundHere = state.ground[c.at];
    const useful = groundHere.findIndex((it) => it.t === 'part' || (it.t === 'fuel' && state.fuel < burnLeft + 2));
    if (useful >= 0) return has({ t: 'take', what: 'ground', k: useful });
    // 9. Radio parts.
    const partsLeft = PARTS - state.installed - state.crew.filter((o) => o.carry && o.carry.t === 'part').length - Object.values(state.ground).flat().filter((it) => it.t === 'part').length;
    const groundPart = Object.keys(state.ground).find((p) => state.ground[p].some((it) => it.t === 'part'));
    if (groundPart && myW >= 3) {
      if (c.at === groundPart) return has({ t: 'take', what: 'ground', k: state.ground[groundPart].findIndex((it) => it.t === 'part') });
      return go(groundPart) || has({ t: 'end' });
    }
    // 10. Samples.
    const samplesWanted = state.need - state.verified - state.crew.filter((o) => o.carry && o.carry.t === 'sample').length;
    const pickSample = (site) => {
      const avail = state.sites[site].samples.filter((s) => !s.taken);
      if (b.k.researcher) return avail.find((s) => s.clean);
      return avail[0];
    };
    const sampleSites = SITES.filter((p) => (b.k.researcher ? state.sites[p].samples.some((s) => s.clean && !s.taken) : state.sites[p].samples.some((s) => !s.taken)));
    // Who goes where: Engineer and whoever got its hint chase parts; Researcher and its hint chase samples.
    const wantsPart = partsLeft > 0 && (c.role === 'engineer' || c.role === 'weather' || (c.role === 'medic' && !b.engHint));
    const wantsSample = samplesWanted > 0 && (c.role === 'researcher' || c.role === 'medic' || !wantsPart);
    const outFor = (site) => myW >= 3 && !(danger(site) && myW <= 4);
    if (wantsPart) {
      let sites = b.k.engineer ? b.partSites : b.engHint ? [b.engHint] : b.partSites;
      sites = sites.filter(outFor);
      if (sites.length) {
        // Don't all chase the same site: skip one a crewmate is already standing on.
        const others = state.crew.filter((o, i) => i !== ci && !inside(o.at)).map((o) => o.at);
        sites.sort((x, y) => dist(c.at, x) + (others.includes(x) ? 3 : 0) - dist(c.at, y) - (others.includes(y) ? 3 : 0));
        const tgt = sites[0];
        if (c.at === tgt) return has({ t: 'search' }) || has({ t: 'end' });
        return go(tgt) || has({ t: 'end' });
      }
    }
    if (wantsSample) {
      let sites = b.k.researcher ? sampleSites : b.resHint && sampleSites.includes(b.resHint) ? [b.resHint] : sampleSites;
      sites = sites.filter(outFor);
      if (sites.length) {
        sites.sort((x, y) => dist(c.at, x) - dist(c.at, y));
        const tgt = sites[0];
        if (c.at === tgt) {
          if (has({ t: 'search' }) && b.k.engineer && state.sites[tgt].part) return has({ t: 'search' });
          const s = pickSample(tgt);
          return (s && has({ t: 'take', what: 'sample', id: s.id })) || has({ t: 'end' });
        }
        return go(tgt) || has({ t: 'end' });
      }
    }
    // 11. Searching on the way is free information.
    if (has({ t: 'search' }) && myW >= 2) return has({ t: 'search' });
    // Nothing to do: get warm or wait inside.
    if (!inside(c.at)) return go('hangar') || has({ t: 'end' });
    if (myW < MAX_WARMTH) return has({ t: 'warm', i: ci }) || has({ t: 'end' });
    return has({ t: 'end' });
  }

  function aiChoose(state, seat) {
    const ci = deciding(state, seat);
    if (ci < 0) return null;
    if (state.phase === 'signal') return aiSignal(state, ci);
    return aiAct(state, ci) || { t: 'end' };
  }

  // Plays computer seats until a person has a decision (or the game ends).
  function runComputers(state, maxSteps = 400) {
    for (let k = 0; k < maxSteps && state.phase !== 'over'; k++) {
      const seat = waitingOn(state).find((s) => state.players[s].ai);
      if (seat == null) return;
      apply(state, seat, aiChoose(state, seat));
    }
  }

  function winner(state) {
    if (!state.result) return null;
    return state.result.win ? 'crew' : 'storm';
  }

  const api = {
    SAVE_V, MAX_WARMTH, ACTIONS, PARTS, PLANE_ROUNDS, DAMAGE_LOSS, ROLES, ROLE_ORDER, PLACES, MODULES, SITES, EDGES, ADJ, REGIONS, DIFF, SIGNAL_WORD,
    newGame, legal, actionsFor, apply, waitingOn, deciding, publicState, knows, aiChoose, runComputers, winner,
    stormText, band, cost, crewOf, dist, radioReady, researchReady, itemName, sampleById, cut, stormsLeft,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WhiteoutEngine = api;
})(typeof window !== 'undefined' ? window : this);
