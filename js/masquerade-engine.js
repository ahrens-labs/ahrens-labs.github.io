// The Masquerade Court — rules engine and computer player. No DOM access, so it also runs in Node and on the server.
// Each noble wears two masks, face down. On your turn you may claim any mask's power — whether you wear it or not.
// Anyone may call "Unmask!": a liar loses a mask; an honest noble shuffles the shown mask back into the wardrobe and
// draws a fresh one, and the accuser pays ⭐2 Favor for the insult (or a mask, with less to give). First to 7 Favor wins; so does the last noble still masked.
// Beyond single claims: a Whisper names the mask a noble wears (right, and they lose it; wrong, and you pay), pairs of
// masks claimed together unlock stronger powers, and every noble holds a secret Intrigue worth Favor when it comes true.
(function (root) {
  'use strict';

  const SAVE_V = 1;
  const COPIES = 3;
  const START_DUCATS = 2;
  const FAVOR_WIN = 7;
  const TOAST_COST = 3;
  const SCANDAL_COST = 7;
  const CUT_IN_COST = 1;
  const WORN = 2;
  const INSULT_FAVOR = 2;
  const WHISPER_COST = 5;
  const INTRIGUE_FAVOR = 2;

  // Each mask's power, and which power it can stop. cost is paid when the power is claimed, whatever happens.
  const MASKS = {
    doge: { name: 'The Doge', icon: '👑', color: '#b8282e', power: 'Patronage', text: 'Take 🪙3 from the Doge’s treasury.', blocks: 'jester' },
    duchess: { name: 'The Duchess', icon: '💃', color: '#d9668f', power: 'Waltz', text: 'Gain ⭐1 Favor — unless a rival Duchess cuts in.' },
    jester: { name: 'The Jester', icon: '🃏', color: '#7a3fb0', power: 'Rumour', text: 'Steal ⭐1 Favor from a noble.', target: true },
    poisoner: { name: 'The Poisoner', icon: '🧪', color: '#1f7a4a', power: 'Poison', text: 'Pay 🪙4: a noble loses a mask.', target: true, cost: 4 },
    doctor: { name: 'The Plague Doctor', icon: '⚕️', color: '#1f6f78', power: 'Remedy', text: 'Pay 🪙4: if you’re down to one mask, take a fresh one from the wardrobe. The lost mask stays out of play.', cost: 4, blocks: 'poisoner' },
    gondolier: { name: 'The Gondolier', icon: '🛶', color: '#2a4fa0', power: 'Secret passage', text: 'Swap one of your masks for a hidden mask of a noble. You both see what you get.', target: true },
    spy: { name: 'The Spy', icon: '🕵️', color: '#4a5263', power: 'Eavesdrop', text: 'Peek at one of a noble’s hidden masks and take 🪙1.', target: true, blocks: 'gondolier' },
  };
  const MASK_ORDER = Object.keys(MASKS);
  // Two masks claimed together: the power of the first, made stronger. Blocks still work against them.
  const PAIRS = {
    duchess: { with: 'doge', name: 'Royal Court', icon: '👑💃', text: 'A Waltz worth ⭐2 Favor.' },
    jester: { with: 'doge', name: 'Court Fool', icon: '👑🃏', text: 'Steal ⭐1 Favor and 🪙2 from a noble.', target: true },
    poisoner: { with: 'doctor', name: 'Apothecary', icon: '🧪⚕️', text: 'Poison for only 🪙2.', target: true, cost: 2 },
    spy: { with: 'gondolier', name: 'Smuggler', icon: '🕵️🛶', text: 'See every hidden mask a noble wears and take 🪙2.', target: true },
  };
  const PAIR_ORDER = Object.keys(PAIRS);
  // Secret goals, one per noble. `stat` is the counter that tracks it; meeting `need` reveals it for ⭐2 Favor.
  const INTRIGUES = {
    liar: { name: 'Liar’s Luck', icon: '🤥', text: 'Have 2 of your bluffs go unchallenged.', stat: 'bluffs', need: 2 },
    sleuth: { name: 'Truth Seeker', icon: '🔎', text: 'Catch a liar with “Unmask!”.', stat: 'caught', need: 1 },
    honest: { name: 'Honest Face', icon: '😇', text: 'Be wrongly accused of lying.', stat: 'wronged', need: 1 },
    purse: { name: 'Deep Purse', icon: '💰', text: 'Hold 🪙7 at once.', stat: 'purse', need: 7 },
    heart: { name: 'Heartbreaker', icon: '💔', text: 'Cut in on a Waltz.', stat: 'cutIns', need: 1 },
    gossip: { name: 'Gossipmonger', icon: '🗣️', text: 'Make a Whisper that turns out true.', stat: 'whispers', need: 1 },
    social: { name: 'Socialite', icon: '🥂', text: 'Claim 3 different masks.', stat: 'kinds', need: 3 },
    wall: { name: 'Iron Mask', icon: '🛡️', text: 'Block a power aimed at you.', stat: 'blocks', need: 1 },
    rumour: { name: 'Rumour Mill', icon: '📣', text: 'Steal Favor with the Jester twice.', stat: 'rumours', need: 2 },
    patron: { name: 'Patron of the Arts', icon: '🎻', text: 'Toast the Doge twice.', stat: 'toasts', need: 2 },
    pair: { name: 'Perfect Match', icon: '🤝', text: 'Use a pair power.', stat: 'pairs', need: 1 },
  };
  const INTRIGUE_ORDER = Object.keys(INTRIGUES);
  // The mask that can stop each targeted power.
  const BLOCKER = {};
  MASK_ORDER.forEach((k) => MASKS[k].blocks && (BLOCKER[MASKS[k].blocks] = k));
  // Any rival may cut in on a Waltz by claiming the Duchess; the other blocks belong to the noble targeted.
  BLOCKER.duchess = 'duchess';

  const LEVELS = {
    easy: { noise: 8, bluff: 0.15, read: 0.25, wild: 0.12 },
    normal: { noise: 3, bluff: 0.35, read: 0.7, wild: 0.04 },
    hard: { noise: 2, bluff: 0.4, read: 0.85, wild: 0.02 },
    brutal: { noise: 0, bluff: 0.3, read: 1, wild: 0 },
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
    state.log.push({ r: state.round, text, who: who == null ? null : who });
    if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const live = (p) => p.masks.filter((m) => m.up !== 'lost');
  const hidden = (p) => p.masks.filter((m) => m.up === 'hidden');
  const inGame = (p) => !p.out;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const maskName = (k) => MASKS[k].name;
  const pairPartner = (k, pair) => (pair && PAIRS[k] ? PAIRS[k].with : null);
  const claimName = (k, pair) => (pair && PAIRS[k] ? `the ${PAIRS[k].name} (${maskName(k)} and ${maskName(PAIRS[k].with)})` : maskName(k));
  // Counters behind the Intrigues. Games saved before Intrigues existed get an empty set the first time it's needed.
  function stats(p) {
    if (!p.stats) p.stats = { bluffs: 0, caught: 0, wronged: 0, cutIns: 0, whispers: 0, kinds: [], blocks: 0, rumours: 0, toasts: 0, pairs: 0 };
    return p.stats;
  }
  function bump(p, key, n) {
    const st = stats(p);
    st[key] = (st[key] || 0) + (n == null ? 1 : n);
  }
  function intrigueProgress(p) {
    if (!p.intrigue || !INTRIGUES[p.intrigue.id]) return null;
    const I = INTRIGUES[p.intrigue.id];
    const st = stats(p);
    const have = I.stat === 'purse' ? p.ducats : I.stat === 'kinds' ? st.kinds.length : st[I.stat] || 0;
    return { have: Math.min(have, I.need), need: I.need };
  }
  const costOf = (k, pair) => (pair && PAIRS[k] && PAIRS[k].cost != null ? PAIRS[k].cost : MASKS[k].cost || 0);

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
      phase: 'act',
      round: 1,
      first: 0,
      actor: 0,
      turn: 0,
      nextId: 1,
      wardrobe: [],
      players: [],
      pending: null,
      last: null,
      log: [],
      ended: null,
    };
    const deck = [];
    MASK_ORDER.forEach((k) => {
      for (let i = 0; i < COPIES; i++) deck.push({ id: state.nextId++, k, up: 'hidden' });
    });
    shuffle(state, deck);
    names.forEach((name, i) => {
      state.players.push({
        name, ai: !!ai[i], level: ai[i] ? levels[i] || 'normal' : null,
        masks: [deck.pop(), deck.pop()], ducats: START_DUCATS, favor: 0, out: false,
        claims: {}, seen: [],
      });
    });
    state.wardrobe = deck;
    const plots = shuffle(state, INTRIGUE_ORDER.slice());
    state.players.forEach((p, i) => {
      p.intrigue = { id: plots[i % plots.length], done: false };
      stats(p);
    });
    const first = opts.first != null ? ((opts.first % n) + n) % n : 0;
    state.first = first;
    state.actor = first;
    state.turn = first;
    log(state, `The ball begins. ${n} nobles are masked; the first to win ⭐${FAVOR_WIN} Favor with the Doge — or the last still masked — wins.`);
    return state;
  }

  // ---------------------------------------------------------------- what can be done
  const targets = (state, pi) => state.players.map((_, i) => i).filter((i) => i !== pi && inGame(state.players[i]));
  // A mask power's own requirement (besides ducats and a target), or '' if it can be claimed.
  function claimProblem(state, pi, k, target, give, pair) {
    const p = state.players[pi];
    const M = MASKS[k];
    if (!M) return 'There’s no such mask.';
    if (pair && !PAIRS[k]) return 'That mask has no pair power.';
    const cost = costOf(k, pair);
    if (cost && p.ducats < cost) return `${pair ? PAIRS[k].name : M.power} costs 🪙${cost}.`;
    if (M.target) {
      const t = state.players[target];
      if (target == null || target === pi || !t || !inGame(t)) return 'Pick a noble who is still at the ball.';
      if (k === 'jester' && t.favor < 1) return `${t.name} has no Favor to steal.`;
      if (k === 'spy' && !hidden(t).length) return `${t.name} has no hidden masks to peek at.`;
      if (k === 'gondolier' && !live(t).length) return `${t.name} has no masks to swap.`;
    }
    if (k === 'gondolier' && !live(p).some((m) => m.id === give)) return 'Pick one of your masks to give away.';
    if (k === 'doctor' && live(p).length >= WORN) return 'The Remedy only works once you’ve lost a mask.';
    if (k === 'doctor' && !state.wardrobe.length) return 'The wardrobe is empty — there’s no fresh mask to take.';
    return '';
  }

  function legal(state, pi, a) {
    if (state.phase !== 'act') return 'The ball is over.';
    if (!a || typeof a !== 'object') return 'That isn’t a move.';
    const p = state.players[pi];
    if (!p || !inGame(p)) return 'You’ve left the ball.';
    const P = state.pending;
    if (!P) {
      if (pi !== state.actor) return 'It isn’t your turn.';
      if (a.t === 'mingle') return '';
      if (a.t === 'toast') return p.ducats >= TOAST_COST ? '' : `A toast to the Doge costs 🪙${TOAST_COST}.`;
      if (a.t === 'scandal') {
        if (p.ducats < SCANDAL_COST) return `A scandal costs 🪙${SCANDAL_COST}.`;
        const t = state.players[a.target];
        return a.target !== pi && t && inGame(t) ? '' : 'Pick a noble who is still at the ball.';
      }
      if (a.t === 'claim') return claimProblem(state, pi, a.k, a.target, a.give, !!a.pair);
      if (a.t === 'whisper') {
        if (p.ducats < WHISPER_COST) return `A whisper costs 🪙${WHISPER_COST}.`;
        const t = state.players[a.target];
        if (a.target === pi || !t || !inGame(t)) return 'Pick a noble who is still at the ball.';
        return MASKS[a.k] ? '' : 'Name one of the seven masks.';
      }
      return 'That isn’t a move.';
    }
    if (P.stage === 'challenge') {
      if (!P.responders.includes(pi) || P.passed.includes(pi)) return 'It isn’t your turn to answer.';
      if (a.t === 'challenge') return '';
      if (a.t === 'pass') return pi === state.turn ? '' : 'Wait for your turn to answer.';
      return 'Call “Unmask!” or let it pass.';
    }
    if (pi !== state.turn) return 'It isn’t your turn to answer.';
    if (P.stage === 'block') {
      if (a.t === 'pass') return '';
      if (a.t === 'block') {
        if (a.k !== BLOCKER[P.act.k]) return `Only ${maskName(BLOCKER[P.act.k])} can stop that.`;
        return P.act.k === 'duchess' && p.ducats < CUT_IN_COST ? `Cutting in costs 🪙${CUT_IN_COST}.` : '';
      }
      return 'Block it or let it happen.';
    }
    if (P.stage === 'blockChallenge') return a.t === 'pass' || a.t === 'challenge' ? '' : 'Call “Unmask!” or accept the block.';
    if (P.stage === 'lose') {
      if (a.t !== 'lose') return 'Choose a mask to lose.';
      return live(p).some((m) => m.id === a.id) ? '' : 'Pick one of your masks.';
    }
    return 'That isn’t a move.';
  }

  // ---------------------------------------------------------------- playing
  function apply(state, pi, a) {
    const why = legal(state, pi, a);
    if (why) throw new Error(why);
    const p = state.players[pi];
    const P = state.pending;
    if (!P) {
      state.last = { t: a.t, who: pi };
      if (a.t === 'mingle') {
        p.ducats += 1;
        log(state, `${p.name} mingled and pocketed 🪙1.`, pi);
        return endTurn(state);
      }
      if (a.t === 'toast') {
        p.ducats -= TOAST_COST;
        p.favor += 1;
        bump(p, 'toasts');
        log(state, `${p.name} raised a toast to the Doge (🪙${TOAST_COST}) and won ⭐1 Favor.`, pi);
        return endTurn(state);
      }
      if (a.t === 'scandal') {
        p.ducats -= SCANDAL_COST;
        state.last.target = a.target;
        log(state, `${p.name} spent 🪙${SCANDAL_COST} on a scandal about ${state.players[a.target].name}, who must lose a mask.`, pi);
        state.pending = { act: { t: 'scandal', target: a.target }, actor: pi, stage: null, next: [{ s: 'lose', who: a.target, why: 'scandal' }, { s: 'end' }] };
        return run(state);
      }
      if (a.t === 'whisper') return whisper(state, pi, a.target, a.k);
      // A mask power: paid for up front, then anyone may challenge it.
      const M = MASKS[a.k];
      const partner = pairPartner(a.k, a.pair);
      const act = { t: 'claim', k: a.k, pair: !!partner, target: M.target ? a.target : null, give: a.k === 'gondolier' ? a.give : null };
      p.ducats -= costOf(a.k, act.pair);
      const st = stats(p);
      [a.k, partner].filter(Boolean).forEach((k) => {
        p.claims[k] = (p.claims[k] || 0) + 1;
        if (!st.kinds.includes(k)) st.kinds.push(k);
      });
      Object.assign(state.last, { k: a.k, pair: act.pair, target: act.target });
      log(state, `${p.name} claims ${claimName(a.k, act.pair)}: ${powerLine(state, pi, act)}`, pi);
      const honest = !!wearing(p, [a.k, partner].filter(Boolean));
      state.pending = { act, actor: pi, stage: null, claimer: pi, k: a.k, pair: partner, honest, responders: [], passed: [], next: [] };
      return openChallenge(state, pi, a.k);
    }
    if (P.stage === 'challenge') {
      if (a.t === 'pass') {
        P.passed.push(pi);
        const left = P.responders.filter((x) => !P.passed.includes(x));
        if (left.length) {
          state.turn = left[0];
          return state;
        }
        P.stage = null;
        if (!P.honest) bump(state.players[P.claimer], 'bluffs');
        P.next = P.blocking ? [{ s: 'blocked' }] : [{ s: 'afterClaim' }];
        return run(state);
      }
      return resolveChallenge(state, pi);
    }
    if (P.stage === 'block') {
      if (a.t === 'pass') {
        const left = P.blockers.filter((x) => x !== pi && P.blockers.indexOf(x) > P.blockers.indexOf(pi));
        if (left.length) {
          state.turn = left[0];
          return state;
        }
        P.stage = null;
        P.next = [{ s: 'effect' }, { s: 'end' }];
        return run(state);
      }
      const t = state.players[pi];
      t.claims[a.k] = (t.claims[a.k] || 0) + 1;
      if (P.act.k === 'duchess') t.ducats -= CUT_IN_COST;
      log(state, P.act.k === 'duchess' ? `${t.name} claims ${maskName(a.k)}, pays the band 🪙${CUT_IN_COST} and cuts in on the waltz.` : `${t.name} claims ${maskName(a.k)} to stop it.`, pi);
      P.blocking = true;
      P.blocker = pi;
      P.claimer = pi;
      P.k = a.k;
      P.pair = null;
      P.honest = live(t).some((m) => m.k === a.k);
      // Only the noble who was blocked may call the blocker a liar.
      P.stage = 'blockChallenge';
      state.turn = P.actor;
      return state;
    }
    if (P.stage === 'blockChallenge') {
      if (a.t === 'pass') {
        P.stage = null;
        if (!P.honest) bump(state.players[P.claimer], 'bluffs');
        P.next = [{ s: 'blocked' }];
        return run(state);
      }
      return resolveChallenge(state, pi);
    }
    if (P.stage === 'lose') {
      loseMask(state, pi, a.id, P.why);
      P.stage = null;
      return run(state);
    }
    return state;
  }

  function powerLine(state, pi, act) {
    const t = act.target != null ? state.players[act.target].name : '';
    if (act.pair) {
      switch (act.k) {
        case 'duchess': return 'a royal Waltz — win ⭐2 Favor.';
        case 'jester': return `a Court Fool’s rumour — steal ⭐1 Favor and 🪙2 from ${t}.`;
        case 'poisoner': return `the Apothecary’s poison (🪙2) — ${t} loses a mask.`;
        case 'spy': return `the Smuggler’s ears — see every hidden mask ${t} wears and take 🪙2.`;
        default: break;
      }
    }
    switch (act.k) {
      case 'doge': return 'Patronage — take 🪙3.';
      case 'duchess': return 'a Waltz — win ⭐1 Favor.';
      case 'jester': return `a Rumour — steal ⭐1 Favor from ${t}.`;
      case 'poisoner': return `Poison (🪙4) — ${t} loses a mask.`;
      case 'doctor': return 'a Remedy (🪙4) — a fresh mask from the wardrobe.';
      case 'gondolier': return `a Secret passage — swap a mask with ${t}.`;
      case 'spy': return `Eavesdrop — peek at one of ${t}’s masks and take 🪙1.`;
      default: return '';
    }
  }

  function rivalsInOrder(state, from) {
    const n = state.players.length;
    const out = [];
    for (let s = 1; s < n; s++) {
      const j = (from + s) % n;
      if (inGame(state.players[j])) out.push(j);
    }
    return out;
  }
  // Put a mask back in the wardrobe, face down; anyone who had peeked at it loses track of it.
  function toWardrobe(state, m) {
    m.up = 'hidden';
    delete m.revealed;
    state.players.forEach((q) => (q.seen = q.seen.filter((x) => x.id !== m.id)));
    state.wardrobe.push(m);
    shuffle(state, state.wardrobe);
  }

  // The masks (one of each kind asked for) a noble would show to prove a claim, or null if they can't.
  function wearing(p, kinds) {
    const used = [];
    for (const k of kinds) {
      const m = live(p).find((x) => x.k === k && !used.includes(x));
      if (!m) return null;
      used.push(m);
    }
    return used;
  }

  // A Whisper: name the mask a noble wears. Right, and it's torn off; wrong, and the slander costs you.
  function whisper(state, pi, ti, k) {
    const p = state.players[pi];
    const t = state.players[ti];
    p.ducats -= WHISPER_COST;
    const hit = live(t).find((m) => m.k === k);
    state.last = { t: 'whisper', who: pi, target: ti, k, truth: !!hit };
    log(state, `${p.name} pays 🪙${WHISPER_COST} to whisper that ${t.name} is wearing ${maskName(k)}…`, pi);
    if (hit) {
      bump(p, 'whispers');
      log(state, `…and it’s true! ${maskName(k)} is torn from ${t.name}’s face.`, pi);
      loseMask(state, ti, hit.id, 'whisper');
      return endTurn(state);
    }
    log(state, `…but ${t.name} wears no ${maskName(k)}.`, ti);
    if (p.favor >= INSULT_FAVOR) {
      p.favor -= INSULT_FAVOR;
      log(state, `${p.name} pays for the slander with ⭐${INSULT_FAVOR} Favor.`, pi);
      return endTurn(state);
    }
    log(state, `${p.name} hasn’t ⭐${INSULT_FAVOR} Favor to lose, so pays with a mask.`, pi);
    state.pending = { act: { t: 'whisper', target: ti, k }, actor: pi, stage: null, next: [{ s: 'lose', who: pi, why: 'slander' }, { s: 'end' }] };
    return run(state);
  }

  // Everyone else still at the ball may call "Unmask!", in seat order from the claimer.
  function openChallenge(state, claimer) {
    const P = state.pending;
    P.responders = rivalsInOrder(state, claimer);
    P.passed = [];
    P.stage = 'challenge';
    state.turn = P.responders[0];
    return state;
  }

  function resolveChallenge(state, by) {
    const P = state.pending;
    const c = state.players[by];
    const cl = state.players[P.claimer];
    const kinds = [P.k, P.pair].filter(Boolean);
    const shown = wearing(cl, kinds);
    log(state, `${c.name} calls “Unmask!” on ${cl.name}.`, by);
    state.last = Object.assign({}, state.last, { challenge: { by, of: P.claimer, k: P.k, pair: P.pair || null, truth: !!shown } });
    P.stage = null;
    if (shown) {
      // Honest: the shown masks go back into the wardrobe and the claimer draws fresh ones. The claims made with
      // them no longer say anything about what this noble wears now.
      const slots = shown.map((m) => cl.masks.indexOf(m));
      shown.forEach((m) => toWardrobe(state, m));
      slots.forEach((slot) => (cl.masks[slot] = state.wardrobe.shift()));
      kinds.forEach((k) => delete cl.claims[k]);
      bump(cl, 'wronged');
      const what = kinds.length > 1 ? `${maskName(kinds[0])} and ${maskName(kinds[1])}! Both masks are` : `${maskName(P.k)}! The mask is`;
      log(state, `${cl.name} really is ${what} shuffled back into the wardrobe and ${cl.name} draws ${kinds.length > 1 ? 'fresh ones' : 'a fresh one'}.`, P.claimer);
      // A false accusation costs the accuser Favor; without enough to give, a mask.
      if (c.favor >= INSULT_FAVOR) {
        c.favor -= INSULT_FAVOR;
        log(state, `${c.name} pays for the insult with ⭐${INSULT_FAVOR} Favor.`, by);
        P.next = P.blocking ? [{ s: 'blocked' }] : [{ s: 'afterClaim' }];
      } else {
        log(state, `${c.name} hasn’t ⭐${INSULT_FAVOR} Favor to lose, so pays with a mask.`, by);
        P.next = [{ s: 'lose', who: by, why: 'wrong' }].concat(P.blocking ? [{ s: 'blocked' }] : [{ s: 'afterClaim' }]);
      }
    } else {
      bump(c, 'caught');
      const missing = kinds.filter((k) => !live(cl).some((m) => m.k === k));
      log(state, `${cl.name} was bluffing — no ${missing.map(maskName).join(' or ')} under there! ${cl.name} must lose a mask.`, P.claimer);
      if (P.blocking) P.next = [{ s: 'lose', who: P.claimer, why: 'lie' }, { s: 'effect' }, { s: 'end' }];
      else {
        log(state, `${P.pair ? `The ${PAIRS[P.k].name}` : `${maskName(P.k)}’s ${MASKS[P.k].power}`} fails.`);
        P.next = [{ s: 'lose', who: P.claimer, why: 'lie' }, { s: 'end' }];
      }
    }
    return run(state);
  }

  // Works through what has to happen next until someone has a decision to make or the turn is over.
  function run(state) {
    for (let guard = 0; guard < 50; guard++) {
      const P = state.pending;
      if (!P || state.phase !== 'act') return state;
      if (checkWin(state)) return state;
      const step = P.next.shift();
      if (!step) return endTurn(state);
      if (step.s === 'end') return endTurn(state);
      if (step.s === 'lose') {
        const v = state.players[step.who];
        if (!inGame(v)) continue;
        const ms = live(v);
        if (ms.length <= 1) {
          if (ms.length) loseMask(state, step.who, ms[0].id, step.why);
          continue;
        }
        P.stage = 'lose';
        P.loser = step.who;
        P.why = step.why;
        state.turn = step.who;
        return state;
      }
      if (step.s === 'afterClaim') {
        const act = P.act;
        const blocker = BLOCKER[act.k];
        const t = act.target != null ? state.players[act.target] : null;
        P.blockers = !blocker || !inGame(state.players[P.actor]) ? []
          : act.k === 'duchess' ? rivalsInOrder(state, P.actor).filter((j) => state.players[j].ducats >= CUT_IN_COST)
            : t && inGame(t) ? [act.target] : [];
        if (P.blockers.length) {
          P.stage = 'block';
          state.turn = P.blockers[0];
          return state;
        }
        if (!inGame(state.players[P.actor])) return endTurn(state);
        P.next.unshift({ s: 'effect' });
        continue;
      }
      if (step.s === 'blocked') {
        bump(state.players[P.blocker], P.act.k === 'duchess' ? 'cutIns' : 'blocks');
        log(state, P.act.k === 'duchess' ? `${state.players[P.blocker].name} takes the Doge’s hand — the waltz wins no Favor.` : `${state.players[P.blocker].name} blocked it.`, P.blocker);
        state.last = Object.assign({}, state.last, { blocked: true });
        return endTurn(state);
      }
      if (step.s === 'effect') {
        effect(state);
        continue;
      }
    }
    return state;
  }

  function effect(state) {
    const P = state.pending;
    const act = P.act;
    const pi = P.actor;
    const p = state.players[pi];
    if (!inGame(p)) return;
    const t = act.target != null ? state.players[act.target] : null;
    if (t && !inGame(t)) return;
    state.last = Object.assign({}, state.last, { done: true });
    if (act.pair) bump(p, 'pairs');
    switch (act.k) {
      case 'doge':
        p.ducats += 3;
        log(state, `${p.name} takes 🪙3 from the treasury.`, pi);
        break;
      case 'duchess': {
        const n = act.pair ? 2 : 1;
        p.favor += n;
        log(state, `${p.name} ${act.pair ? 'leads the royal waltz' : 'waltzes with the Doge'} and wins ⭐${n} Favor.`, pi);
        break;
      }
      case 'jester': {
        const n = Math.min(1, t.favor);
        t.favor -= n;
        p.favor += n;
        if (n) bump(p, 'rumours');
        const coins = act.pair ? Math.min(2, t.ducats) : 0;
        t.ducats -= coins;
        p.ducats += coins;
        log(state, `${p.name}’s rumour costs ${t.name} ⭐${n} Favor${coins ? ` and 🪙${coins}` : ''} — and ${p.name} gains ${coins ? 'them' : 'it'}.`, pi);
        break;
      }
      case 'poisoner':
        log(state, `The poison works: ${t.name} must lose a mask.`, pi);
        P.next.unshift({ s: 'lose', who: act.target, why: 'poison' });
        break;
      case 'doctor': {
        // The lost mask stays face up and out of play; the fresh one is worn beside it.
        if (live(p).length < WORN && state.wardrobe.length) {
          const fresh = state.wardrobe.shift();
          fresh.up = 'hidden';
          p.masks.push(fresh);
          log(state, `${p.name} takes a fresh mask from the wardrobe.`, pi);
        }
        break;
      }
      case 'gondolier': {
        const mine = p.masks.find((m) => m.id === act.give && m.up !== 'lost');
        const pool = hidden(t).length ? hidden(t) : live(t);
        if (!mine || !pool.length) break;
        const theirs = pool[rint(state, pool.length)];
        const a = p.masks.indexOf(mine);
        const b = t.masks.indexOf(theirs);
        p.masks[a] = theirs;
        t.masks[b] = mine;
        // A noble always knows the mask in their own hand; what they gave away, they now know is with the other.
        p.seen = p.seen.filter((x) => x.id !== theirs.id).concat({ id: mine.id, k: mine.k });
        t.seen = t.seen.filter((x) => x.id !== mine.id).concat({ id: theirs.id, k: theirs.k });
        log(state, `${p.name} slips through a secret passage and swaps a mask with ${t.name}.`, pi);
        break;
      }
      case 'spy': {
        const pool = hidden(t);
        p.ducats += act.pair ? 2 : 1;
        const heard = act.pair ? pool : pool.length ? [pool[rint(state, pool.length)]] : [];
        heard.forEach((m) => (p.seen = p.seen.filter((x) => x.id !== m.id).concat({ id: m.id, k: m.k })));
        log(state, act.pair ? `${p.name} smuggles a look at every mask ${t.name} hides, and takes 🪙2.` : `${p.name} eavesdrops on ${t.name}, learns one of their masks, and takes 🪙1.`, pi);
        break;
      }
      default:
        break;
    }
  }

  function loseMask(state, pi, id, why) {
    const p = state.players[pi];
    const m = p.masks.find((x) => x.id === id);
    if (!m || m.up === 'lost') return;
    m.up = 'lost';
    log(state, `${p.name} loses a mask: ${maskName(m.k)} is turned face up and out of play.`, pi);
    state.last = Object.assign({}, state.last, { lost: (state.last && state.last.lost || []).concat({ who: pi, k: m.k }) });
    if (!live(p).length) {
      p.out = true;
      p.ducats = 0;
      log(state, `${p.name} has no masks left and leaves the ball.`, pi);
    }
  }

  // A noble at 7 Favor wins at once; so does the last one still masked.
  function checkWin(state) {
    checkIntrigues(state);
    const atBall = state.players.filter(inGame);
    const champ = state.players.findIndex((p) => inGame(p) && p.favor >= FAVOR_WIN);
    if (champ >= 0) return finish(state, 'favor', champ);
    if (atBall.length <= 1) return finish(state, 'last', state.players.indexOf(atBall[0]));
    return false;
  }
  // An Intrigue that has come true is revealed at once, and its Favor may win the ball.
  function checkIntrigues(state) {
    state.players.forEach((p, i) => {
      if (!inGame(p) || !p.intrigue || p.intrigue.done) return;
      const pr = intrigueProgress(p);
      if (pr.have < pr.need) return;
      const I = INTRIGUES[p.intrigue.id];
      p.intrigue.done = true;
      p.favor += INTRIGUE_FAVOR;
      log(state, `${I.icon} ${p.name} reveals a secret Intrigue — “${I.name}”: ${I.text} ⭐${INTRIGUE_FAVOR} Favor!`, i);
    });
  }
  function finish(state, why, w) {
    state.phase = 'over';
    state.pending = null;
    state.turn = null;
    state.ended = why;
    if (why === 'favor') log(state, `${state.players[w].name} has won ⭐${FAVOR_WIN} Favor — the Doge names them the star of the ball!`);
    else if (why === 'last') log(state, `${state.players[w].name} is the last noble still masked and wins the ball!`);
    state.players.forEach((p) => p.masks.forEach((m) => m.up === 'hidden' && (m.revealed = true)));
    return true;
  }

  function endTurn(state) {
    state.pending = null;
    if (state.phase !== 'act') return state;
    if (checkWin(state)) return state;
    const n = state.players.length;
    let wrapped = false;
    for (let s = 1; s <= n; s++) {
      const j = (state.actor + s) % n;
      if (j === state.first) wrapped = true;
      if (inGame(state.players[j])) {
        if (wrapped) state.round += 1;
        state.actor = j;
        state.turn = j;
        break;
      }
    }
    return state;
  }

  // ---------------------------------------------------------------- results
  function score(state, p) {
    return { total: p.favor, favor: p.favor, ducats: p.ducats, masks: live(p).length, out: p.out ? 1 : 0 };
  }
  // Favor first; then nobles still at the ball, masks left, and ducats.
  function ranking(state) {
    const key = (i) => {
      const p = state.players[i];
      if (state.ended === 'last' && inGame(p)) return [1e6];
      return [p.favor, inGame(p) ? 1 : 0, live(p).length, p.ducats];
    };
    return state.players.map((_, i) => i).sort((a, b) => {
      const x = key(a);
      const y = key(b);
      for (let k = 0; k < Math.max(x.length, y.length); k++) if ((y[k] || 0) !== (x[k] || 0)) return (y[k] || 0) - (x[k] || 0);
      return 0;
    });
  }
  function winner(state) {
    if (state.phase !== 'over') return -1;
    const r = ranking(state);
    if (state.ended !== 'midnight') return r[0];
    const a = state.players[r[0]];
    const b = state.players[r[1]];
    if (b && a.favor === b.favor && inGame(a) === inGame(b) && live(a).length === live(b).length && a.ducats === b.ducats) return -1;
    return r[0];
  }

  // ---------------------------------------------------------------- what a noble knows
  // The masks a noble can see: their own, every face-up mask, and the hidden masks they've peeked at that are still where they saw them.
  function knowledge(state, pi) {
    const me = state.players[pi];
    const known = {};
    const add = (k) => (known[k] = (known[k] || 0) + 1);
    state.players.forEach((p, i) => p.masks.forEach((m) => {
      if (i === pi || m.up !== 'hidden') add(m.k);
      else if (me.seen.some((x) => x.id === m.id)) add(m.k);
    }));
    const unknown = state.players.reduce((t, p, i) => t + (i === pi ? 0 : p.masks.filter((m) => m.up === 'hidden' && !me.seen.some((x) => x.id === m.id)).length), 0) + state.wardrobe.length;
    return { known, unknown };
  }
  const choose = (n, k) => {
    if (k < 0 || k > n) return 0;
    let r = 1;
    for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
    return r;
  };
  // How likely, from pi's point of view, that `who` really wears a mask of kind k.
  function holdsChance(state, pi, who, k) {
    const me = state.players[pi];
    const p = state.players[who];
    const hid = hidden(p);
    if (hid.some((m) => m.k === k && me.seen.some((x) => x.id === m.id))) return 1;
    const unseenHere = hid.filter((m) => !me.seen.some((x) => x.id === m.id)).length;
    if (!unseenHere) return 0;
    const { known, unknown } = knowledge(state, pi);
    const left = Math.max(0, COPIES - (known[k] || 0));
    if (!left) return 0;
    return 1 - choose(unknown - left, unseenHere) / Math.max(1, choose(unknown, unseenHere));
  }
  // How likely a claim of k by `who` is a lie: rarer masks and nobles who've claimed many different masks are less believable.
  function lieChance(state, pi, who, k) {
    const h = holdsChance(state, pi, who, k);
    if (h >= 1) return 0;
    if (h <= 0) return 1;
    const p = state.players[who];
    const kinds = Object.keys(p.claims).length;
    let b = Math.min(0.8, 0.09 + Math.max(0, kinds - live(p).length - 1) * 0.07);
    // Nobles down to their last mask rarely risk a lie, and the same claim made again and again is usually true.
    if (live(p).length <= 1) b *= 0.5;
    b *= Math.pow(0.8, Math.max(0, (p.claims[k] || 0) - 1));
    return ((1 - h) * b) / ((1 - h) * b + h);
  }

  // ---------------------------------------------------------------- computer player
  const DUCAT = 2.4;
  const FAVOR = 11;
  const maskCost = (p) => (live(p).length <= 1 ? 80 : 14);
  // How threatening a noble is: Favor matters most, then masks left.
  const threat = (p) => p.favor * 3 + live(p).length * 2 + p.ducats * 0.3;
  function leader(state, pi, filter) {
    const opts = targets(state, pi).filter((i) => !filter || filter(state.players[i]));
    return opts.sort((a, b) => threat(state.players[b]) - threat(state.players[a]))[0];
  }
  const holds = (p, k) => live(p).some((m) => m.k === k);
  // A computer noble leans toward whatever its own secret Intrigue needs.
  const plot = (p) => (p.intrigue && !p.intrigue.done ? p.intrigue.id : null);
  // How sure pi is that noble ti wears a mask of kind k: certain if peeked at, otherwise from the cards seen and what they've claimed.
  function wearsChance(state, pi, ti, k) {
    const t = state.players[ti];
    const me = state.players[pi];
    if (hidden(t).some((m) => m.k === k && me.seen.some((x) => x.id === m.id))) return 1;
    const h = holdsChance(state, pi, ti, k);
    if (h <= 0) return 0;
    return t.claims[k] ? Math.max(h, (1 - lieChance(state, pi, ti, k)) * 0.85) : h;
  }

  function aiChoose(state, pi, level) {
    const L = LEVELS[level] || LEVELS.normal;
    const P = state.pending;
    const p = state.players[pi];
    const jitter = () => (Math.random() * 2 - 1) * L.noise;
    if (P && P.stage === 'lose') return { t: 'lose', id: worstMask(p).id };
    if (P && P.stage === 'challenge') return challengeOrPass(state, pi, L) ? { t: 'challenge' } : { t: 'pass' };
    if (P && P.stage === 'blockChallenge') return challengeOrPass(state, pi, L) ? { t: 'challenge' } : { t: 'pass' };
    if (P && P.stage === 'block') {
      const bk = BLOCKER[P.act.k];
      if (P.act.k === 'duchess') {
        // Cutting in costs ducats, so save it for a dancer who is getting close (or leading).
        const d = state.players[P.actor];
        const urgent = d.favor + 1 >= FAVOR_WIN;
        const worth = urgent || d.favor >= FAVOR_WIN - (P.act.pair ? 4 : 3) || (leader(state, pi) === P.actor && d.favor >= p.favor + 1) || plot(p) === 'heart';
        if (!worth && !(holds(p, bk) && Math.random() < 0.15)) return { t: 'pass' };
        if (holds(p, bk) || urgent) return { t: 'block', k: bk };
        return Math.random() < L.bluff * 0.6 ? { t: 'block', k: bk } : { t: 'pass' };
      }
      if (holds(p, bk)) return { t: 'block', k: bk };
      // Bluff a block: always worth it if the poison would end the ball for you anyway.
      if (P.act.k === 'poisoner' && live(p).length <= 1) return { t: 'block', k: bk };
      const odds = (plot(p) === 'wall' ? 0.2 : 0) + P.act.k === 'poisoner' ? L.bluff * 0.8 : P.act.k === 'jester' ? L.bluff * (p.favor >= FAVOR_WIN - 2 ? 0.9 : 0.4) : L.bluff * 0.25;
      return Math.random() < odds ? { t: 'block', k: bk } : { t: 'pass' };
    }
    // My turn: weigh every move by what it gains, what it risks, and how likely it is to work.
    const opts = [];
    const win = (gainFavor) => p.favor + gainFavor >= FAVOR_WIN;
    // Ducats are only worth what they can buy: once a scandal is affordable, more coin matters much less.
    const coin = p.ducats >= SCANDAL_COST + 3 ? 0.4 : p.ducats >= SCANDAL_COST ? 1.2 : DUCAT;
    const want = plot(p);
    opts.push({ a: { t: 'mingle' }, v: coin + (want === 'purse' && p.ducats < 7 ? 2 : 0) });
    if (p.ducats >= TOAST_COST) opts.push({ a: { t: 'toast' }, v: win(1) ? 1000 : FAVOR - TOAST_COST * coin + 1.5 + (want === 'patron' ? 5 : 0) - (want === 'purse' && p.ducats < 10 ? 3 : 0) });
    if (p.ducats >= SCANDAL_COST) {
      const t = leader(state, pi);
      if (t != null) opts.push({ a: { t: 'scandal', target: t }, v: 14 + threat(state.players[t]) * 1.2 - SCANDAL_COST * coin + (live(state.players[t]).length <= 1 ? 25 : 0) });
    }
    // How likely someone calls "Unmask!" if I claim k without wearing it.
    const exposure = (k) => {
      const { known } = knowledge(state, pi);
      if ((known[k] || 0) - (holds(p, k) ? 1 : 0) >= COPIES) return 0.95;
      const seenClaims = state.players.reduce((t, q, i) => t + (i === pi ? 0 : q.claims[k] || 0), 0);
      return Math.min(0.85, 0.22 + 0.06 * (state.players.filter(inGame).length - 2) + 0.05 * seenClaims + (p.claims[k] ? 0 : 0.04));
    };
    // A Whisper: the noble and mask I'm surest of, if the odds beat the price of slander.
    if (p.ducats >= WHISPER_COST) {
      let best = null;
      targets(state, pi).forEach((ti) => {
        const t = state.players[ti];
        MASK_ORDER.forEach((k) => {
          const w = wearsChance(state, pi, ti, k);
          if (w < 0.3) return;
          const out = live(t).length <= 1;
          const prize = out && state.players.filter(inGame).length <= 2 ? 1000 : 14 + threat(t) + (out ? 25 : 0);
          const loss = p.favor >= INSULT_FAVOR ? FAVOR * INSULT_FAVOR : maskCost(p);
          const v = w * prize - (1 - w) * loss - WHISPER_COST * coin + (want === 'gossip' ? 6 : 0);
          if (!best || v > best.v) best = { a: { t: 'whisper', target: ti, k }, v };
        });
      });
      if (best) opts.push(best);
    }
    // Claiming a mask I really wear tells the table what I have, which a Whisper can use.
    const whisperers = targets(state, pi).filter((j) => state.players[j].ducats >= WHISPER_COST).length;
    const consider = (k, gain, target, give, pair) => {
      const a = pair ? { t: 'claim', k, target, give, pair: true } : { t: 'claim', k, target, give };
      if (claimProblem(state, pi, k, target, give, !!pair)) return;
      const kinds = [k, pairPartner(k, pair)].filter(Boolean);
      const honest = !!wearing(p, kinds);
      let v = gain + (want === 'social' ? kinds.filter((x) => !stats(p).kinds.includes(x)).length * 2.5 : 0) + (pair && want === 'pair' ? 6 : 0);
      if (honest) v -= Math.min(2.5, 0.8 * whisperers) * kinds.length;
      // A blockable power may be stopped by its target.
      if (BLOCKER[k] && target != null) {
        const bh = holdsChance(state, pi, target, BLOCKER[k]);
        v *= 1 - Math.min(0.9, bh + (1 - bh) * 0.15);
      }
      // A waltz may be cut in on by any rival who wears (or claims) the Duchess.
      if (k === 'duchess') {
        const close = p.favor >= FAVOR_WIN - 4;
        const free = rivalsInOrder(state, pi).filter((j) => state.players[j].ducats >= CUT_IN_COST).reduce((t, j) => {
          const bh = holdsChance(state, pi, j, 'duchess') * (close ? 1 : 0.3);
          return t * (1 - Math.min(0.9, bh + (1 - bh) * 0.05));
        }, 1);
        v *= free;
      }
      if (!honest) {
        const daring = L.bluff + 0.15 + (want === 'liar' ? 0.25 : 0);
        if (Math.random() > daring * (kinds.length > 1 ? 0.5 : 1)) return; // some nobles simply don't lie much
        const ex = kinds.length > 1 ? 1 - (1 - exposure(kinds[0])) * (1 - exposure(kinds[1])) * 0.85 : exposure(k);
        const e = ex * L.read + (1 - L.read) * 0.3;
        v = v * (1 - e) - e * maskCost(p) + (want === 'liar' ? 3 : 0);
      }
      v -= costOf(k, pair) * coin;
      opts.push({ a, v });
    };
    consider('doge', 3 * coin + 0.5);
    consider('duchess', win(1) ? 1000 : FAVOR);
    consider('duchess', win(2) ? 1000 : FAVOR * 2, null, null, true);
    const rich = leader(state, pi, (q) => q.favor > 0);
    const jest = rich == null ? 0 : (win(1) ? 1000 : FAVOR * 1.6 + (state.players[rich].favor >= FAVOR_WIN - 1 ? 30 : 0)) + (want === 'rumour' ? 5 : 0);
    if (rich != null) consider('jester', jest, rich);
    if (rich != null) consider('jester', jest + Math.min(2, state.players[rich].ducats) * coin, rich, null, true);
    const big = leader(state, pi);
    const poison = big == null ? 0 : 14 + threat(state.players[big]) + (live(state.players[big]).length <= 1 ? 25 : 0);
    if (big != null) consider('poisoner', poison, big);
    if (big != null) consider('poisoner', poison, big, null, true);
    if (live(p).length < WORN) consider('doctor', 26);
    const peek = leader(state, pi, (q) => hidden(q).length > 0);
    if (peek != null) consider('spy', coin + 2.5, peek);
    if (peek != null) consider('spy', 2 * coin + 2.5 * hidden(state.players[peek]).length, peek, null, true);
    // Swap away my least useful mask.
    const swapTo = leader(state, pi, (q) => live(q).length > 0);
    if (swapTo != null && live(p).length) consider('gondolier', worstMask(p).k === 'gondolier' ? 1 : 3.5, swapTo, worstMask(p).id);
    if (Math.random() < L.wild && opts.length > 1) return opts[Math.floor(Math.random() * opts.length)].a;
    opts.forEach((o) => (o.v += jitter()));
    opts.sort((x, y) => y.v - x.v);
    return opts[0].a;
  }

  // Call "Unmask!" when a lie is likely enough to be worth risking a mask.
  function challengeOrPass(state, pi, L) {
    const P = state.pending;
    const me = state.players[pi];
    if (Math.random() < L.wild) return Math.random() < 0.2;
    const act = P.act;
    const claimer = state.players[P.claimer];
    const kinds = [P.k, P.pair].filter(Boolean);
    const each = kinds.map((k) => lieChance(state, pi, P.claimer, k));
    let lie = (1 - each.reduce((t, l) => t * (1 - l), 1)) * L.read + (1 - L.read) * 0.22;
    if (plot(me) === 'sleuth') lie = Math.min(1, lie + 0.08);
    // A noble on their last mask has nothing to lose by bluffing a block against poison.
    if (P.stage === 'blockChallenge' && act.k === 'poisoner' && live(claimer).length <= 1 && lie > 0) lie = Math.max(lie, 0.5);
    // A ball that drags on long past the usual length makes everyone more suspicious, so it can't stall.
    if (state.round > 30) lie = Math.min(1, lie + (state.round - 30) * 0.02);
    let stake = 6;
    if (P.stage === 'blockChallenge') stake = act.k === 'poisoner' ? 16 : act.k === 'jester' ? 9 : act.k === 'duchess' ? (me.favor + 1 >= FAVOR_WIN ? 200 : 9) : 4;
    else if (act.k === 'duchess' || (act.k === 'jester' && act.target !== pi)) stake = claimer.favor + (act.pair && act.k === 'duchess' ? 2 : 1) >= FAVOR_WIN ? 200 : act.pair ? 14 : 8;
    else if (act.k === 'jester') stake = 14;
    else if (act.k === 'poisoner') stake = act.target === pi ? (live(me).length <= 1 ? 120 : 22) : 7;
    else if (act.k === 'doge') stake = 5;
    else if (act.k === 'doctor') stake = 9;
    else if (act.k === 'gondolier') stake = act.target === pi ? 6 : 2;
    else if (act.k === 'spy') stake = act.target === pi ? 4 : 2;
    // Knocking out a noble on their last mask wins the ball outright only when just two are left.
    const knock = live(claimer).length > 1 ? maskCost(claimer) * 0.6 : state.players.filter(inGame).length <= 2 ? 80 : 22;
    const gain = lie * (stake + knock);
    const risk = (1 - lie) * (me.favor >= INSULT_FAVOR ? FAVOR * INSULT_FAVOR * (me.favor >= FAVOR_WIN - 2 ? 1.5 : 1) : maskCost(me));
    return gain - risk > 0;
  }

  // The mask a noble would rather lose: the least useful kind.
  const KEEP = { duchess: 7, doge: 6, poisoner: 5, doctor: 4, jester: 4, spy: 3, gondolier: 2 };
  function worstMask(p) {
    const ms = live(p);
    const val = (m) => KEEP[m.k] + (m.k === 'doctor' && live(p).length < WORN ? 3 : 0);
    return ms.slice().sort((a, b) => val(a) - val(b))[0];
  }

  const api = {
    SAVE_V, COPIES, START_DUCATS, FAVOR_WIN, TOAST_COST, SCANDAL_COST, CUT_IN_COST, INSULT_FAVOR, WHISPER_COST, INTRIGUE_FAVOR, MASKS, MASK_ORDER, PAIRS, PAIR_ORDER,
    INTRIGUES, INTRIGUE_ORDER, BLOCKER, LEVELS, newGame, legal, apply, aiChoose, score, ranking, winner, clone, live, hidden, targets, claimProblem, holdsChance,
    knowledge, powerLine, intrigueProgress, costOf, wearing,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MasqueradeEngine = api;
})(typeof window !== 'undefined' ? window : this);
