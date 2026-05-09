/**
 * Server-side picker for chess daily challenges.
 * Mirrors js/trifangx_chess_app.js (salt + seeded shuffle). Pool is the
 * client fallback list only (Worker cannot invoke getAllAchievementsList()).
 */

export const DAILY_CHALLENGE_PICK_SALT = 'ahrenslabs-chess-daily-v2';

/** Fallback list — keep aligned with getAllDailyChallengeIds() fallbackIds in trifangx_chess_app.js */
const FALLBACK_DAILY_CHALLENGE_IDS = [
  'daily_explorer',
  'daily_checker',
  'daily_warrior',
  'daily_lightning',
  'daily_capturer',
  'daily_longgame',
  'daily_promoter',
  'daily_castler',
  'daily_comeback',
  'daily_blindfold_bishop',
  'daily_personality_master',
  'daily_survivor',
  'daily_blitz_king',
  'daily_time_master',
  'daily_king_safety',
  'daily_promotion_royalty',
  'daily_material_advantage',
  'daily_openings_expert',
  'daily_checkmate_artist',
  'daily_en_passant_master',
  'daily_underpromotion',
  'daily_queen_sacrifice',
  'daily_time_pressure',
  'daily_opening_trap',
  'daily_endgame_grinder',
  'daily_perfect_defense',
  'daily_check_storm',
  'daily_double_castle',
  'daily_promotion_variety',
  'daily_comeback_king',
  'daily_piece_hunter',
  'daily_white_duo',
  'daily_black_duo',
  'daily_blindfold_knight',
  'daily_pawn_promotion_chain',
  'daily_queen_tour',
  'daily_rook_ladder',
  'daily_bishop_pair',
  'daily_pawn_storm',
  'daily_king_walk',
  'daily_piece_cycle',
  'daily_square_master',
  'daily_blindfold_win_no_history',
  'daily_piece_sacrifice_chain',
  'daily_center_control',
  'daily_pawn_island',
  'daily_rook_battery',
  'daily_elite_capturer',
  'daily_pawn_sweeper',
  'daily_knight_roundup',
  'daily_bishop_ambush',
  'daily_rook_raider_adv',
  'daily_queen_snatcher',
  'daily_full_deck_hunter',
  'daily_checkmate_maestro',
];

export function utcDateString(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hashStringToSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same algorithm as client's getDeterministicDailyChallengeIds (UTC calendar date string). */
export function getDeterministicDailyChallengeIds(dateString, validList, maxPick) {
  const pool = [...(validList || [])]
    .filter((id) => typeof id === 'string' && id.length > 0)
    .sort();
  if (pool.length === 0) return [];
  const seed = hashStringToSeed(DAILY_CHALLENGE_PICK_SALT + '|' + dateString);
  const rand = mulberry32(seed);
  const shuffled = pool.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = t;
  }
  const need = Math.min(maxPick || 3, shuffled.length);
  const selected = shuffled.slice(0, need);
  const validSet = new Set(pool);
  const fallback = ['daily_explorer', 'daily_warrior', 'daily_checker'];
  let fi = 0;
  while (selected.length < 3 && fi < fallback.length) {
    const id = fallback[fi++];
    if (validSet.has(id) && !selected.includes(id)) selected.push(id);
  }
  return selected.slice(0, 3);
}

export function getDailyChallengeIdsForUtcDate(dateString) {
  return getDeterministicDailyChallengeIds(dateString, FALLBACK_DAILY_CHALLENGE_IDS, 3);
}

/**
 * Display copy for nightly TrifangX challenge emails — keep in sync with getAllAchievementsList() Daily entries
 * in js/trifangx_chess_app.js (name, desc, points).
 */
export const DAILY_CHALLENGE_CARD_INFO = {
  daily_explorer: { name: '🗺️ Daily Explorer', desc: 'Visit 20 unique squares in one day', points: 100 },
  daily_checker: { name: '✓ Daily Checker', desc: 'Give 8 checks in one day', points: 120 },
  daily_warrior: { name: '⚔️ Daily Warrior', desc: 'Make 5 captures in one day (any of your pieces)', points: 150 },
  daily_lightning: { name: '⚡ Daily Lightning', desc: 'Win 2 games in 25 moves or fewer today', points: 350 },
  daily_capturer: { name: '🎯 Daily Capturer', desc: 'Make 10 captures in one day (any of your pieces)', points: 180 },
  daily_longgame: { name: '⏱️ Daily Marathon', desc: 'Make 150 total moves today (all games)', points: 150 },
  daily_promoter: { name: '👑 Daily Promoter', desc: 'Promote 3 pawns in one day', points: 250 },
  daily_castler: { name: '🏰 Daily Castler', desc: 'Castle 2 times in one day', points: 110 },
  daily_comeback: { name: '💪 Daily Comeback', desc: 'Win 3 games in one day', points: 300 },
  daily_blindfold_bishop: {
    name: '👁️♗ Blindfold Bishop Master',
    desc: 'Make 5 bishop moves in blindfold games today',
    points: 250,
  },
  daily_personality_master: { name: '🎭 Triple Duty', desc: 'Play 3 games today', points: 350 },
  daily_survivor: {
    name: '🛡️ Daily Survivor',
    desc: 'Make 25 captures today, all games (any of your pieces)',
    points: 225,
  },
  daily_blitz_king: {
    name: '⚡⚡ Blitz King',
    desc: 'Win 2 games with 1-minute time control today',
    points: 300,
  },
  daily_time_master: {
    name: '⏱️ Time Master',
    desc: 'Win games with 3 different time controls today',
    points: 280,
  },
  daily_king_safety: {
    name: "👑 King's Guard",
    desc: 'Castle in 3 different games today',
    points: 200,
  },
  daily_promotion_royalty: {
    name: '👸 Promotion Royalty',
    desc: 'Promote a pawn in 2 different games today',
    points: 240,
  },
  daily_material_advantage: {
    name: '⚖️ Material Master',
    desc: 'Win 2 games where you had a material advantage of 3+ points',
    points: 275,
  },
  daily_openings_expert: {
    name: '📚 Opening Expert',
    desc: 'Play 3 different detected openings today',
    points: 220,
  },
  daily_checkmate_artist: {
    name: '🎨 Checkmate Artist',
    desc: 'Checkmate with 3 different pieces today (queen, rook, knight, bishop, or pawn)',
    points: 400,
  },
  daily_en_passant_master: {
    name: '🎯 En Passant Master',
    desc: 'Perform en passant in 2 different games today',
    points: 400,
  },
  daily_underpromotion: {
    name: '♟️ Underpromotion Specialist',
    desc: 'Underpromote 2 times today (rook, bishop, or knight)',
    points: 450,
  },
  daily_queen_sacrifice: {
    name: '👑 Queen Sacrifice',
    desc: 'Win a game after sacrificing your queen today',
    points: 500,
  },
  daily_time_pressure: {
    name: '⏰ Time Pressure Hero',
    desc: 'Win a game with less than 10 seconds remaining on your clock',
    points: 500,
  },
  daily_opening_trap: {
    name: '🪤 Opening Trap Master',
    desc: 'Win 2 games in 30 moves or fewer today',
    points: 380,
  },
  daily_endgame_grinder: {
    name: '🔨 Endgame Grinder',
    desc: 'Play 2+ games and 120+ total moves today',
    points: 380,
  },
  daily_perfect_defense: {
    name: '🛡️ Perfect Defense',
    desc: 'Win a game without losing any pieces today',
    points: 500,
  },
  daily_check_storm: {
    name: '⚡ Check Storm',
    desc: 'Give 22 checks today (all games)',
    points: 280,
  },
  daily_double_castle: {
    name: '🏰 Double Castle',
    desc: 'Castle kingside and queenside at least once each today (across all games)',
    points: 300,
  },
  daily_promotion_variety: {
    name: '👸 Promotion Variety',
    desc: 'Promote 4 pawns today (all games)',
    points: 420,
  },
  daily_comeback_king: {
    name: '💪 Comeback King',
    desc: 'Win a game after being down by 5+ material points today',
    points: 500,
  },
  daily_piece_hunter: {
    name: '🎯 Piece Hunter',
    desc: 'Make 18 captures today, all games (any of your pieces)',
    points: 450,
  },
  daily_white_duo: { name: '⚪ White Hot', desc: 'Win 2 games as White today', points: 220 },
  daily_black_duo: { name: '⚫ Black Hot', desc: 'Win 2 games as Black today', points: 220 },
  daily_blindfold_knight: {
    name: '👁️🐴 Blindfold Knight Rider',
    desc: 'Make 7 knight moves in blindfold games without move history today',
    points: 400,
  },
  daily_pawn_promotion_chain: {
    name: '♟️ Promotion Chain',
    desc: 'Promote 5 pawns today (all games)',
    points: 550,
  },
  daily_queen_tour: { name: '👸 Busy Queen', desc: 'Play 5 games today', points: 500 },
  daily_rook_ladder: { name: '🏰 Rook Ladder', desc: 'Win 2 games today', points: 380 },
  daily_bishop_pair: {
    name: '♗♗ Bishop Pair Power',
    desc: 'Castle 4 times today (all games)',
    points: 400,
  },
  daily_pawn_storm: {
    name: '♟️ Pawn Storm',
    desc: 'Make 20 pawn moves today (all games)',
    points: 400,
  },
  daily_king_walk: {
    name: '👑 King Walk',
    desc: 'Move your king 15 times today (all games)',
    points: 320,
  },
  daily_piece_cycle: {
    name: '🔄 Both Colors',
    desc: 'Win at least one game as White and one as Black today',
    points: 500,
  },
  daily_square_master: {
    name: '🎯 Square Master',
    desc: 'Visit 35 unique squares today (all games)',
    points: 500,
  },
  daily_blindfold_win_no_history: {
    name: '👁️❌ Pure Blindfold Victory',
    desc: 'Win a blindfold game without move history today',
    points: 600,
  },
  daily_piece_sacrifice_chain: {
    name: '💎 Win Streak',
    desc: 'Win 3 games today',
    points: 550,
  },
  daily_center_control: {
    name: '🎯 Center Control',
    desc: 'Make 15 captures today, all games (any of your pieces)',
    points: 480,
  },
  daily_pawn_island: {
    name: '🏝️ Check Rain',
    desc: 'Give 18 checks today (all games)',
    points: 380,
  },
  daily_rook_battery: {
    name: '🏰 Four Corners',
    desc: 'Play 4 games today',
    points: 350,
  },
  daily_elite_capturer: {
    name: '⚔️ Elite Capturer',
    desc: 'Make 20 captures today, all games (any of your pieces)',
    points: 360,
  },
  daily_pawn_sweeper: {
    name: '🧹 Pawn Sweeper',
    desc: 'Take 8 enemy pawns today (victim type)',
    points: 380,
  },
  daily_knight_roundup: {
    name: '🐴 Knight Roundup',
    desc: 'Take 4 enemy knights today (victim type)',
    points: 460,
  },
  daily_bishop_ambush: {
    name: '♗ Bishop Ambush',
    desc: 'Take 3 enemy bishops today (victim type)',
    points: 430,
  },
  daily_rook_raider_adv: {
    name: '🏰 Rook Raider',
    desc: 'Take 3 enemy rooks today (victim type)',
    points: 480,
  },
  daily_queen_snatcher: {
    name: '👑 Queen Snatcher',
    desc: 'Take 2 enemy queens today (victim type)',
    points: 520,
  },
  daily_full_deck_hunter: {
    name: '🃏 Full Deck',
    desc: 'Take at least one enemy pawn, knight, bishop, rook, and queen today',
    points: 580,
  },
  daily_checkmate_maestro: {
    name: '🎨 Checkmate Maestro',
    desc: 'Deliver checkmate with 4 different piece types today (queen, rook, knight, bishop, or pawn)',
    points: 520,
  },
};

/** Short blurbs for plain-text fallback (subset; unknown IDs still listed by id). */
export const DAILY_CHALLENGE_DIGEST_BLURBS = {
  daily_explorer: 'Visit many unique squares',
  daily_checker: 'Give multiple checks',
  daily_warrior: 'Make several captures',
  daily_lightning: 'Quick wins in few moves',
  daily_capturer: 'Heavy capture day',
  daily_longgame: 'Long games / many moves',
  daily_promoter: 'Promote pawns',
  daily_castler: 'Castle multiple times',
  daily_comeback: 'Win several games',
};
