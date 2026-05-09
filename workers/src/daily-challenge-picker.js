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

/** Short blurbs for digest emails (subset; unknown IDs still listed by id). */
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
