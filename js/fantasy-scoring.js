// Ahrens Fantasy scoring, shared by the page and the league server (which settles each week once Monday night's
// game is final), so both always agree on every team's points. UMD: window.FantasyScoring or module.exports.
(function (root) {
  const IDP_POSITIONS = ['DL', 'DE', 'DT', 'LB', 'DB', 'CB', 'S'];
  // Scoring defaults for any stat a league has never set (same values as the scoring settings page).
  const DEFAULT_SCORING = {
    passYards: 0.04, passTD: 4, passInterceptions: -2, passTwoPoint: 2, passCompletions: 0, passAttempts: 0,
    passSacksTaken: 0, pass300YardBonus: 0, pass400YardBonus: 0, passLongTD: 0, passCompletionPct: 0,
    passYardsPerAttempt: 0, passYardsPerCompletion: 0, passerRating: 0, passingFumbles: 0, rushYards: 0.1,
    rushTD: 6, rushTwoPoint: 2, rushAttempts: 0, rush100YardBonus: 0, rushLongTD: 0, firstDownRush: 0,
    rushingFumbles: -2, rushYardsPerAttempt: 0, rushLongest: 0, receptions: 1, receivingYards: 0.1, receivingTD: 6,
    receivingTwoPoint: 2, receiving100YardBonus: 0, receivingLongTD: 0, targets: 0, receivingFumblesLost: -2,
    receivingYardsPerCatch: 0, catchRatePct: 0, receivingLongest: 0, fg0to39: 3, fg40to49: 3, fg50Plus: 3,
    fgMissed: -1, xpMade: 1, xpMissed: -1, fg60PlusBonus: 0, fgAttempts: 0, fgPercentage: 0, fgLongest: 0,
    xpAttempts: 0, kickingPoints: 0, defSack: 2, defInterception: 2, defFumbleRecovery: 2, defForcedFumble: 1,
    defTD: 6, defSafety: 2, defBlock: 2, defTwoPointReturn: 2, defPoints0: 10, defPoints1to6: 7, defPoints7to13: 4,
    defPoints14to20: 1, defPoints21to27: 0, defPoints28to34: -1, defPoints35Plus: -4, defYardsAllowed: 0,
    defTackles: 0, defSoloTackles: 0, defTacklesForLoss: 0, defPassesDefended: 0, defQbHits: 0, defTurnovers: 0,
    idpSack: 2, idpInterception: 2, idpFumbleRecovery: 2, idpForcedFumble: 1, idpTD: 6, playerSafety: 2,
    idpBlock: 2, idpTwoPointReturn: 2, idpTackles: 0, idpSoloTackles: 0, idpTacklesForLoss: 0, idpPassesDefended: 0,
    idpQbHits: 0, idpTurnovers: 0, puntAttempts: 0, puntYards: 0, puntAverage: 0, puntInside20: 0,
    puntTouchbacks: 0, fumbleLost: -2, receivingFumbles: 0, fumbleRecoveryTD: 6, kickReturnYards: 0,
    puntReturnYards: 0, kickReturnTD: 6, puntReturnTD: 6, kickReturnAttempts: 0, puntReturnAttempts: 0,
    kickReturnAvg: 0, puntReturnAvg: 0, kickReturnLongest: 0, puntReturnLongest: 0, twoPointConversion: 2,
    blockedPuntTD: 6, offensiveFumbleTD: 6,
  };
  const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST', 'DL', 'DE', 'DT', 'LB', 'DB', 'CB', 'S', 'P'];

  function safeRatio(numerator, denominator) {
    return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0
      ? numerator / denominator
      : 0;
  }

  // Starter slots in lineup order (FLEX sits after WR).
  function starterSlots(rosterSlots) {
    return POSITION_ORDER.flatMap((slot) => (slot === 'WR' ? [slot, 'FLEX'] : [slot])).flatMap((slot) => {
      const count = Number((rosterSlots || {})[slot] || 0);
      return Array.from({ length: count }, (_, index) => ({
        slot,
        index,
        label: count > 1 ? `${slot} ${index + 1}` : slot,
      }));
    });
  }

  // Starters that actually occupy a configured slot, in configured-slot order. Grouping by slot (instead of matching
  // an exact rosterSlotIndex) means a gappy index can never make a starter disappear from the lineup.
  function starters(team, slots) {
    const bySlot = new Map();
    (team.roster || []).filter((player) => player.rosterSlot && player.rosterSlot !== 'BENCH').forEach((player) => {
      if (!bySlot.has(player.rosterSlot)) bySlot.set(player.rosterSlot, []);
      bySlot.get(player.rosterSlot).push(player);
    });
    bySlot.forEach((list) => list.sort((a, b) => Number(a.rosterSlotIndex || 0) - Number(b.rosterSlotIndex || 0)));
    const displayed = [];
    slots.forEach((slot) => {
      const player = (bySlot.get(slot.slot) || [])[slot.index];
      if (player) displayed.push(player);
    });
    return { bySlot, displayed };
  }

  function scoringFor(league, position) {
    return {
      ...league.scoring,
      ...(league.positionScoring?.[position] || {}),
    };
  }

  function parseGameSummary(summary, game, { teamStats, playerStats, scoring, onAthlete } = {}) {
    const boxscore = summary.boxscore || {};
    teamStats.set(String(game.home.id), {
      ...(teamStats.get(String(game.home.id)) || {}),
      pointsAllowed: Number(game.away.score) || 0,
      gameId: game.id,
    });
    teamStats.set(String(game.away.id), {
      ...(teamStats.get(String(game.away.id)) || {}),
      pointsAllowed: Number(game.home.score) || 0,
      gameId: game.id,
    });
    const playerGroups = boxscore.players || [];
    playerGroups.forEach((teamGroup) => {
      const teamId = String(teamGroup.team?.id || '');
      (teamGroup.statistics || []).forEach((category) => {
        const categoryName = String(category.name || category.displayName || '').toLowerCase();
        const labels = category.labels || category.names || [];
        if (categoryName.includes('defensive') || categoryName.includes('defense') || categoryName.includes('interception') || categoryName.includes('fumble')) {
          const aggregate = {};
          (category.athletes || []).forEach((line) => {
            const lineStats = normalizeStatLine(categoryName, labels, line.stats || [], scoring);
            Object.entries(lineStats).forEach(([key, value]) => {
              // Defenses cannot lose fumbles: the fumbles category also
              // carries offensive fumbles lost, which must not enter the
              // D/ST stat line (it would wrongly deduct points). Only
              // fumble recoveries count for the defense.
              if (categoryName.includes('fumble') && key !== 'defFumbleRecovery') return;
              aggregate[key] = (aggregate[key] || 0) + value;
            });
          });
          teamStats.set(teamId, { ...(teamStats.get(teamId) || {}), ...aggregate, gameId: game.id });
        }
        (category.athletes || []).forEach((line) => {
          const athlete = line.athlete || {};
          if (!athlete.id) return;
          const stats = normalizeStatLine(categoryName, labels, line.stats || [], scoring);
          const previous = playerStats.get(String(athlete.id)) || {};
          const nextStats = { ...previous, ...stats, gameId: game.id, teamId, updated: Date.now() };
          playerStats.set(String(athlete.id), nextStats);
          if (onAthlete) onAthlete(String(athlete.id), previous, nextStats);
        });
      });
    });
    const teamOffensiveYards = new Map();
    (boxscore.teams || []).forEach((teamGroup) => {
      const teamId = String(teamGroup.team?.id || '');
      const stats = {};
      (teamGroup.statistics || []).forEach((item) => {
        const name = String(item.name || item.abbreviation || '').toLowerCase();
        const value = Number(String(item.displayValue ?? item.value ?? '').replace(/[^0-9.-]/g, ''));
        if (!Number.isFinite(value)) return;
        if (name.includes('totalyards') || name === 'totyds') teamOffensiveYards.set(teamId, value);
        if (name.includes('totalpointsallowed') || name === 'pointsagainst') stats.pointsAllowed = value;
        if (name.includes('yardsallowed') || name === 'yardsagainst') stats.yardsAllowed = value;
      });
      teamStats.set(teamId, { ...(teamStats.get(teamId) || {}), ...stats, gameId: game.id });
    });
    [[game.home.id, game.away.id], [game.away.id, game.home.id]].forEach(([teamId, opponentId]) => {
      if (!teamOffensiveYards.has(String(opponentId))) return;
      const current = teamStats.get(String(teamId)) || {};
      teamStats.set(String(teamId), {
        ...current,
        yardsAllowed: teamOffensiveYards.get(String(opponentId)),
        gameId: game.id,
      });
    });
  }

  function normalizeStatLine(category, labels, values, scoring = {}) {
    const result = {};
    const parsed = {};
    labels.forEach((label, index) => {
      const originalLabel = String(label).toUpperCase();
      const cleanLabel = originalLabel.replace(/[^A-Z0-9/]/g, '');
      const raw = String(values[index] ?? '0');
      if (['C/ATT', 'FG', 'FGM', 'XP', 'XPM'].includes(cleanLabel) && raw.includes('/')) {
        const [made, attempted] = raw.split('/').map((value) => Number(value) || 0);
        if (cleanLabel.startsWith('C/')) {
          parsed.C = made;
          parsed.ATT = attempted;
        } else if (cleanLabel.startsWith('XP')) {
          parsed.XPM = made;
          parsed.XPA = attempted;
        } else {
          parsed.FGM = made;
          parsed.FGA = attempted;
        }
      } else if (cleanLabel === 'C/ATT') {
        const [completions, attempts] = raw.split('/').map(Number);
        parsed.C = completions || 0;
        parsed.ATT = attempts || 0;
      } else {
        const sackMatch = cleanLabel === 'SACKS' ? raw.match(/^\s*(\d+)/) : null;
        const value = Number(sackMatch ? sackMatch[1] : raw.replace(/[^0-9.-]/g, '')) || 0;
        parsed[cleanLabel] = value;
        if (/0\s*[-–]\s*39|039/.test(originalLabel)) parsed.FG039 = value;
        if (/40\s*[-–]\s*49|4049/.test(originalLabel)) parsed.FG4049 = value;
        if (/50\s*\+|50PLUS|50PLUS/.test(originalLabel)) parsed.FG50PLUS = value;
      }
    });
    const safetyCount = parsed.SAFETY || parsed.SAF || parsed.SAFETIES || parsed.SFTY || 0;
    if (category.includes('passing')) {
      result.passCompletions = parsed.C || parsed.COM || 0;
      result.passAttempts = parsed.ATT || parsed.ATTEMPTS || 0;
      result.passYards = parsed.YDS || parsed.PYDS || 0;
      result.passTD = parsed.TD || parsed.PTD || 0;
      result.passInterceptions = parsed.INT || parsed.INTERCEPTIONS || 0;
      result.passSacksTaken = parsed.SACKS || parsed.SACK || 0;
      result.passTwoPoint = parsed['2PT'] || parsed.TWOPT || parsed.TWOPTCONVERSIONS || 0;
      result.passLongTD = parsed.LONGTD || parsed.LTD || 0;
      result.passingFumbles = parsed.PASSINGFUMBLESLOST || parsed.PASSFUMBLESLOST || parsed.PASSFUMLOST || parsed.PASSFUMBLES || parsed.FUMLOST || parsed.LOST || 0;
      result.passCompletionPct = safeRatio(result.passCompletions * 100, result.passAttempts);
      result.passYardsPerAttempt = safeRatio(result.passYards, result.passAttempts);
      result.passYardsPerCompletion = safeRatio(result.passYards, result.passCompletions);
      result.passerRating = parsed.RTG || parsed.PASSERRATING || 0;
    }
    if (category.includes('rushing')) {
      result.rushAttempts = parsed.CAR || parsed.ATT || parsed.RUSH || 0;
      result.rushYards = parsed.YDS || parsed.RYDS || 0;
      result.rushTD = parsed.TD || parsed.RTD || 0;
      result.rushTwoPoint = parsed['2PT'] || parsed.TWOPT || parsed.TWOPTCONVERSIONS || 0;
      result.firstDownRush = parsed.FD || parsed.FIRSTDOWNS || 0;
      result.rushingFumbles = parsed.LOST || parsed.FUMBLESLOST || parsed.FUMLOST || 0;
      result.rushLongTD = parsed.LONGTD || parsed.LTD || 0;
      result.rushYardsPerAttempt = safeRatio(result.rushYards, result.rushAttempts);
      result.rushLongest = parsed.LONG || parsed.LONGEST || 0;
    }
    if (category.includes('receiving')) {
      result.receptions = parsed.REC || parsed.RECEPTIONS || 0;
      result.receivingYards = parsed.YDS || parsed.RECYDS || 0;
      result.receivingTD = parsed.TD || parsed.RECTD || 0;
      result.targets = parsed.TGT || parsed.TGTS || parsed.TARGETS || 0;
      result.receivingFumbles = parsed.FUM || parsed.FUMBLES || 0;
      result.receivingFumblesLost = parsed.LOST || parsed.FUMBLESLOST || parsed.FUMLOST || 0;
      result.receivingTwoPoint = parsed['2PT'] || parsed.TWOPT || parsed.TWOPTCONVERSIONS || 0;
      result.receivingLongTD = parsed.LONGTD || parsed.LTD || 0;
      result.receivingYardsPerCatch = safeRatio(result.receivingYards, result.receptions);
      result.catchRatePct = safeRatio(result.receptions * 100, result.targets);
      result.receivingLongest = parsed.LONG || parsed.LONGEST || 0;
    }
    if (category.includes('kicking')) {
      result.fgMade = parsed.FGM || parsed.FG || 0;
      result.fgMissed = parsed.FGA ? Math.max(0, parsed.FGA - (parsed.FGM || parsed.FG || 0)) : 0;
      result.xpMade = parsed.XPM || parsed.XP || 0;
      result.xpMissed = parsed.XPA ? Math.max(0, parsed.XPA - (parsed.XPM || parsed.XP || 0)) : 0;
      result.fg0to39 = parsed.FG039 || 0;
      result.fg40to49 = parsed.FG4049 || 0;
      result.fg50Plus = parsed.FG50PLUS || 0;
      result.fgTiersReported = Boolean(parsed.FG039 || parsed.FG4049 || parsed.FG50PLUS);
      result.fg60PlusCount = (parsed.LONG || parsed.LONGEST || 0) >= 60 ? 1 : 0;
      result.fgAttempts = parsed.FGA || result.fgMade + result.fgMissed;
      result.fgPercentage = safeRatio(result.fgMade * 100, result.fgAttempts);
      result.fgLongest = parsed.LONG || parsed.LONGEST || 0;
      result.xpAttempts = parsed.XPA || result.xpMade + result.xpMissed;
      result.kickingPoints = result.fg0to39 * Number(scoring.fg0to39 || 0)
        + result.fg40to49 * Number(scoring.fg40to49 || 0)
        + result.fg50Plus * Number(scoring.fg50Plus || 0)
        + result.xpMade * Number(scoring.xpMade || 0);
    }
    if (category.includes('punting')) {
      result.puntAttempts = parsed.NO || parsed.P || parsed.PUNTS || parsed.ATT || 0;
      result.puntYards = parsed.YDS || parsed.PYDS || 0;
      result.puntAverage = parsed.AVG || safeRatio(result.puntYards, result.puntAttempts);
      result.puntInside20 = parsed.IN20 || parsed.INSIDE20 || parsed.INSIDE20YARDLINE || 0;
      result.puntTouchbacks = parsed.TB || parsed.TOUCHBACKS || 0;
    }
    if (category.includes('interception')) {
      // ESPN boxscores put interceptions in their own category (INT/YDS/TD),
      // separate from the defensive category. Only INT is taken from here:
      // pick-six TDs are already counted in the defensive category's TD.
      result.defInterception = parsed.INT || parsed.INTERCEPTIONS || 0;
    }
    if (category.includes('defensive') || category.includes('defense')) {
      result.defSack = parsed.SACK || parsed.SACKS || 0;
      // The defensive boxscore category has no INT/FF/FR columns (those
      // live in the interceptions/fumbles categories). Only set these
      // when present, otherwise a 0 here would overwrite the real
      // turnover totals aggregated from those other categories.
      if (parsed.INT != null || parsed.INTERCEPTIONS != null) result.defInterception = parsed.INT || parsed.INTERCEPTIONS || 0;
      if (parsed.FF != null || parsed.FORCEDFUMBLES != null) result.defForcedFumble = parsed.FF || parsed.FORCEDFUMBLES || 0;
      if (parsed.FR != null || parsed.FUMBLERECOVERIES != null) result.defFumbleRecovery = parsed.FR || parsed.FUMBLERECOVERIES || 0;
      result.defTD = parsed.TD || parsed.DTD || 0;
      result.defSafety = safetyCount;
      result.defBlock = parsed.BLOCKEDKICKS || parsed.BLK || 0;
      result.defTwoPointReturn = parsed.TWOPTRETURN || parsed.TWOPTRET || parsed.TWOPTCONVERSIONRETURN || 0;
      result.defTackles = parsed.TOT || parsed.TKL || parsed.TACKLES || 0;
      result.defSoloTackles = parsed.SOLO || parsed.SOLOTACKLES || 0;
      result.defTacklesForLoss = parsed.TFL || parsed.TACKLESFORLOSS || 0;
      result.defPassesDefended = parsed.PD || parsed.PASSESDEFENDED || 0;
      result.defQbHits = parsed.QBHTS || parsed.QBHITS || 0;
      result.defTurnovers = (result.defInterception || 0) + (result.defFumbleRecovery || 0);
    }
    if (category.includes('fumble')) {
      result.fumbleLost = parsed.LOST || parsed.FUMBLESLOST || parsed.FUMLOST || parsed.LOSTFUMBLES || 0;
      // REC in the fumbles boxscore category is the team's fumble
      // recoveries; for defenses (and IDP players) these are the fumble
      // recoveries that score. There is no FR column in the defensive
      // category, so without this D/ST fumble recoveries never count.
      result.defFumbleRecovery = parsed.REC || parsed.RECOVERIES || 0;
      result.fumbleRecoveryTD = parsed.TD || parsed.RECTD || parsed.FUMBLERECOVERYTD || 0;
      result.offensiveFumbleTD = parsed.OFFTD || parsed.OFFENSIVETD || parsed.OFFENSIVEFUMBLERECOVERYTD || 0;
      if (parsed.PASSINGFUMBLESLOST || parsed.PASSFUMBLESLOST || parsed.PASSFUMLOST) {
        result.passingFumbles = parsed.PASSINGFUMBLESLOST || parsed.PASSFUMBLESLOST || parsed.PASSFUMLOST;
      }
    }
    if (category.includes('return')) {
      if (category.includes('kick')) {
        result.kickReturnYards = parsed.YDS || parsed.KRYDS || 0;
        result.kickReturnTD = parsed.TD || parsed.KRTD || 0;
        result.kickReturnAttempts = parsed.NO || parsed.ATT || parsed.RET || parsed.RETURNS || 0;
        result.kickReturnAvg = safeRatio(result.kickReturnYards, result.kickReturnAttempts);
        result.kickReturnLongest = parsed.LONG || parsed.LONGEST || 0;
      }
      if (category.includes('punt')) {
        result.puntReturnYards = parsed.YDS || parsed.PRYDS || 0;
        result.puntReturnTD = parsed.TD || parsed.PRTD || 0;
        result.puntReturnAttempts = parsed.NO || parsed.ATT || parsed.RET || parsed.RETURNS || 0;
        result.puntReturnAvg = safeRatio(result.puntReturnYards, result.puntReturnAttempts);
        result.puntReturnLongest = parsed.LONG || parsed.LONGEST || 0;
      }
    }
    const blockedPuntTD = parsed.BLOCKPUNTTD || parsed.BLOCKEDPUNTTD || parsed.PUNTTDBLOCKED || parsed.BLKPUNTTD || parsed.BLOCKEDPUNTRETURNTD || 0;
    if (blockedPuntTD) result.blockedPuntTD = blockedPuntTD;
    const playerSafety = safetyCount;
    if (playerSafety) result.playerSafety = playerSafety;
    return result;
  }

  function pointsFor(player, stat, scoring) {
    let points = 0;
    const simple = [
      ['passYards', 'passYards'], ['passTD', 'passTD'], ['passInterceptions', 'passInterceptions'],
      ['passTwoPoint', 'passTwoPoint'], ['passCompletions', 'passCompletions'], ['passAttempts', 'passAttempts'],
      ['passSacksTaken', 'passSacksTaken'], ['passLongTD', 'passLongTD'], ['passCompletionPct', 'passCompletionPct'],
      ['passYardsPerAttempt', 'passYardsPerAttempt'], ['passYardsPerCompletion', 'passYardsPerCompletion'], ['passerRating', 'passerRating'], ['passingFumbles', 'passingFumbles'],
      ['rushYards', 'rushYards'], ['rushTD', 'rushTD'],
      ['rushTwoPoint', 'rushTwoPoint'], ['rushAttempts', 'rushAttempts'], ['firstDownRush', 'firstDownRush'], ['rushingFumbles', 'rushingFumbles'], ['rushLongTD', 'rushLongTD'], ['receptions', 'receptions'],
      ['rushYardsPerAttempt', 'rushYardsPerAttempt'], ['rushLongest', 'rushLongest'],
      ['receivingYards', 'receivingYards'], ['receivingTD', 'receivingTD'], ['receivingTwoPoint', 'receivingTwoPoint'], ['receivingLongTD', 'receivingLongTD'],
      ['targets', 'targets'], ['receivingFumbles', 'receivingFumbles'], ['receivingFumblesLost', 'receivingFumblesLost'],
      ['receivingYardsPerCatch', 'receivingYardsPerCatch'], ['catchRatePct', 'catchRatePct'], ['receivingLongest', 'receivingLongest'],
      ['fumbleRecoveryTD', 'fumbleRecoveryTD'], ['fumbleLost', 'fumbleLost'],
      ['offensiveFumbleTD', 'offensiveFumbleTD'],
      ['blockedPuntTD', 'blockedPuntTD'],
      ['kickReturnYards', 'kickReturnYards'], ['puntReturnYards', 'puntReturnYards'], ['kickReturnTD', 'kickReturnTD'],
      ['puntReturnTD', 'puntReturnTD'], ['kickReturnAttempts', 'kickReturnAttempts'], ['puntReturnAttempts', 'puntReturnAttempts'],
      ['kickReturnAvg', 'kickReturnAvg'], ['puntReturnAvg', 'puntReturnAvg'], ['kickReturnLongest', 'kickReturnLongest'],
      ['puntReturnLongest', 'puntReturnLongest'],
    ];
    simple.forEach(([statKey, scoringKey]) => {
      // Defenses cannot lose fumbles: never deduct fumbles lost for D/ST
      // (their stat line can carry offensive fumbles from the boxscore).
      if (player.position === 'D/ST' && statKey === 'fumbleLost') return;
      points += Number(stat[statKey] || 0) * Number(scoring[scoringKey] || 0);
    });
    // A two-point conversion is worth one score, not two: the position-
    // specific values above already count it. Only fall back to the "Any"
    // value when no position-specific two-point scoring is set, so default
    // (regular PPR) scoring matches ESPN's single 2-point value.
    const anyTwoPointConversions = Number(stat.passTwoPoint || 0)
      + Number(stat.rushTwoPoint || 0)
      + Number(stat.receivingTwoPoint || 0);
    const positionTwoPointScored = Number(scoring.passTwoPoint || 0) !== 0
      || Number(scoring.rushTwoPoint || 0) !== 0
      || Number(scoring.receivingTwoPoint || 0) !== 0;
    if (!positionTwoPointScored) {
      points += anyTwoPointConversions * Number(scoring.twoPointConversion || 0);
    }
    if (player.position === 'K') {
      ['fgAttempts', 'fgPercentage', 'fgLongest', 'xpAttempts'].forEach((key) => {
        points += Number(stat[key] || 0) * Number(scoring[key] || 0);
      });
      points += (Number(stat.fgMade || 0) * 3 + Number(stat.xpMade || 0)) * Number(scoring.kickingPoints || 0);
    }
    const bonusPoints = (bonusKey, chanceKey, reached) => {
      const multiplier = stat.expectedBonuses ? Number(stat[chanceKey] || 0) : Number(reached);
      return multiplier * Number(scoring[bonusKey] || 0);
    };
    points += bonusPoints('pass300YardBonus', 'pass300YardChance', Number(stat.passYards || 0) >= 300);
    points += bonusPoints('pass400YardBonus', 'pass400YardChance', Number(stat.passYards || 0) >= 400);
    points += bonusPoints('rush100YardBonus', 'rush100YardChance', Number(stat.rushYards || 0) >= 100);
    points += bonusPoints('receiving100YardBonus', 'receiving100YardChance', Number(stat.receivingYards || 0) >= 100);
    if (player.position === 'K') {
      const makes = stat.fgMade || 0;
      const short = stat.fgTiersReported ? stat.fg0to39 || 0 : makes;
      const mid = stat.fg40to49 || 0;
      const long = stat.fg50Plus || 0;
      points += stat.fgTiersReported
        ? short * scoring.fg0to39 + mid * scoring.fg40to49 + long * scoring.fg50Plus
        : makes * scoring.fg0to39;
      points += (stat.fgMissed || 0) * scoring.fgMissed;
      points += (stat.xpMade || 0) * scoring.xpMade + (stat.xpMissed || 0) * scoring.xpMissed;
      points += (stat.fg60PlusCount || 0) * scoring.fg60PlusBonus;
    }
    if (player.position === 'P') {
      ['puntAttempts', 'puntYards', 'puntAverage', 'puntInside20', 'puntTouchbacks'].forEach((key) => {
        points += Number(stat[key] || 0) * Number(scoring[key] || 0);
      });
    }
    if (IDP_POSITIONS.includes(player.position)) {
      const individualDefenseStats = [
        ['defSack', 'idpSack'], ['defInterception', 'idpInterception'],
        ['defFumbleRecovery', 'idpFumbleRecovery'], ['defForcedFumble', 'idpForcedFumble'],
        ['defTD', 'idpTD'], ['defSafety', 'playerSafety'], ['defBlock', 'idpBlock'],
        ['defTwoPointReturn', 'idpTwoPointReturn'], ['defTackles', 'idpTackles'],
        ['defSoloTackles', 'idpSoloTackles'], ['defTacklesForLoss', 'idpTacklesForLoss'],
        ['defPassesDefended', 'idpPassesDefended'], ['defQbHits', 'idpQbHits'],
        ['defTurnovers', 'idpTurnovers'],
      ];
      individualDefenseStats.forEach(([statKey, scoringKey]) => {
        points += Number(stat[statKey] || 0) * Number(scoring[scoringKey] || 0);
      });
    }
    if (player.position === 'D/ST') {
      const teamLine = stat;
      [
        ['defSack', 'defSack'], ['defInterception', 'defInterception'],
        ['defFumbleRecovery', 'defFumbleRecovery'], ['defForcedFumble', 'defForcedFumble'],
        ['defTD', 'defTD'], ['defSafety', 'defSafety'], ['defBlock', 'defBlock'],
        ['defTwoPointReturn', 'defTwoPointReturn'], ['defTackles', 'defTackles'],
        ['defSoloTackles', 'defSoloTackles'], ['defTacklesForLoss', 'defTacklesForLoss'],
        ['defPassesDefended', 'defPassesDefended'], ['defQbHits', 'defQbHits'],
        ['defTurnovers', 'defTurnovers'],
      ].forEach(([statKey, scoringKey]) => {
        points += Number(teamLine[statKey] || 0) * Number(scoring[scoringKey] || 0);
      });
      const allowed = teamLine.pointsAllowed;
      if (teamLine.defBucketsProjected) {
        points += Number(teamLine.defPoints0 || 0) * Number(scoring.defPoints0 || 0)
          + Number(teamLine.defPoints1to6 || 0) * Number(scoring.defPoints1to6 || 0)
          + Number(teamLine.defPoints7to13 || 0) * Number(scoring.defPoints7to13 || 0)
          + Number(teamLine.defPoints14to20 || 0) * Number(scoring.defPoints14to20 || 0)
          + Number(teamLine.defPoints21to27 || 0) * Number(scoring.defPoints21to27 || 0)
          + Number(teamLine.defPoints28to34 || 0) * Number(scoring.defPoints28to34 || 0)
          + Number(teamLine.defPoints35Plus || 0) * Number(scoring.defPoints35Plus || 0);
      } else if (allowed === 0) points += scoring.defPoints0;
      else if (allowed <= 6) points += scoring.defPoints1to6;
      else if (allowed <= 13) points += scoring.defPoints7to13;
      else if (allowed <= 20) points += scoring.defPoints14to20;
      else if (allowed <= 27) points += scoring.defPoints21to27;
      else if (allowed <= 34) points += scoring.defPoints28to34;
      else if (Number.isFinite(Number(allowed))) points += scoring.defPoints35Plus;
      points += (teamLine.yardsAllowed || 0) * scoring.defYardsAllowed;
    }
    return Number(points.toFixed(2));
  }

  const api = { DEFAULT_SCORING, IDP_POSITIONS, safeRatio, starterSlots, starters, scoringFor, parseGameSummary, normalizeStatLine, pointsFor };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FantasyScoring = api;
})(typeof window !== 'undefined' ? window : this);
