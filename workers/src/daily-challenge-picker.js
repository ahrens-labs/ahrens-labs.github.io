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
  'daily_black_win',
  'daily_play_as_black',
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
  'daily_double_play',
  'daily_sixty_moves',
  'daily_triad_qe4_nf6_pa6',
  'daily_triad_qd5_nc3_ph5',
  'daily_triad_rc7_ne5_bb5',
  'daily_triad_ra4_bc6_pe6',
  'daily_triad_qg4_nh3_pb4',
  'daily_triad_qd4_nf3_pe5',
  'daily_triad_nf3_pd4_bc4',
  'daily_triad_qc4_nd5_pf5',
  'daily_triad_bd5_ne6_pg5',
  'daily_triad_re5_kf5_qh5',
  'daily_triad_pe5_nf6_qd4',
  'daily_triad_pc5_bb7_qc7',
  'daily_triad_ng6_ph5_qf6',
  'daily_triad_re6_qf6_pg6',
  'daily_triad_bf4_ne2_pg3',
  'daily_triad_rc3_nb5_qa4',
  'daily_triad_pb5_nc6_qb6',
  'daily_triad_kb5_rc5_qd5',
  'daily_triad_ne4_pf5_qh5',
  'daily_triad_rh3_qg3_pg4',
  'daily_triad_bc3_ne4_rg3',
  'daily_triad_pd5_nf6_bg5',
  'daily_triad_qd4_ne5_rc5',
  'daily_triad_ra3_nc4_pb5',
  'daily_triad_qh4_rf4_ph3',
  'daily_triad_pe5_nf6_be7',
  'daily_triad_pg6_nf6_bg7',
  'daily_triad_pd5_nc6_qb6',
  'daily_triad_pe6_nf6_be7',
  'daily_triad_pc6_nd7_qb6',
  'daily_triad_pa6_bg7_nf6',
  'daily_triad_pd6_nc6_bf5',
  'daily_triad_pc5_bb6_qc7',
  'daily_triad_pf6_ng7_be5',
  'daily_triad_pe7_ng6_bf5',
  'daily_triad_pg5_nf6_bg7',
  'daily_triad_pa5_nc6_qa5',
  'daily_bf_nf3_pe4_bc4',
  'daily_bf_qd5_re5_pf5',
  'daily_bf_pd4_ne5_qd5',
  'daily_bf_bd4_ne4_re5',
  'daily_bf_bc4_nd4_pe5',
  'daily_bf_ra5_nc5_pb5',
  'daily_bf_pg6_nf6_bg7',
  'daily_bf_pe5_nf6_be7',
  'daily_bf_pd5_nc6_qb6',
  'daily_pure_ke4_nf5_pd4',
  'daily_pure_qd5_ne4_pf5',
  'daily_pure_rc4_qe5_nd5',
  'daily_pure_bd4_ne3_pf4',
  'daily_pure_pe5_nf6_be7',
  'daily_pure_pg6_nf6_bg7',
  'daily_duo_qe4_nf6',
  'daily_duo_rc7_qc2',
  'daily_duo_nf3_bc4',
  'daily_duo_pd4_pe4',
  'daily_duo_nf6_bg7',
  'daily_duo_pe5_nc6',
  'daily_duo_pd5_nf6',
  'daily_blindfold_rook_ranger',
  'daily_blindfold_queen_nav',
  'daily_pure_blind_pawn_echo',
  'daily_early_bird_castle',
  'daily_finish_early_bird_ct',
  'daily_finish_before_10am_ct',
  'daily_finish_lunch_ct',
  'daily_finish_afternoon_ct',
  'daily_finish_night_owl_ct',
  'daily_end_queen_home',
  'daily_end_castled_king',
  'daily_end_center_knight',
  'daily_end_corner_rook',
  'daily_end_light_bishop_home',
  'daily_opening_italian',
  'daily_opening_roy_lopez',
  'daily_opening_sicilian',
  'daily_opening_kings_indian',
  'daily_opening_qgd',
  'daily_opening_french',
  'daily_opening_caro_kann',
  'daily_opening_scandinavian',
  'daily_mate_with_knight',
  'daily_mate_with_bishop',
  'daily_mate_with_rook',
  'daily_mate_with_queen',
  'daily_mate_with_pawn',
  'daily_queen_quiet_until_8',
  'daily_rook_quiet_until_10',
  'daily_king_quiet_until_15',
  'daily_bishop_quiet_until_6',
  'daily_crown_jewel',
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

/** @param {string} dateString Local or zoned calendar day YYYY-MM-DD (not necessarily UTC). */
export function getDailyChallengeIdsForUtcDate(dateString) {
  return getDeterministicDailyChallengeIds(dateString, FALLBACK_DAILY_CHALLENGE_IDS, 3);
}

/**
 * Display copy for daily TrifangX challenge emails — keep in sync with getAllAchievementsList() Daily entries
 * in js/trifangx_chess_app.js (name, desc, points).
 */
export const DAILY_CHALLENGE_CARD_INFO = {
  daily_explorer: { name: '🗺️ Daily Explorer', desc: 'Visit 20 unique squares in one day', points: 100 },
  daily_checker: { name: '✓ Daily Checker', desc: 'Give 8 checks in one day', points: 120 },
  daily_warrior: { name: '⚔️ Daily Warrior', desc: 'Make 12 captures in one day (any of your pieces)', points: 150 },
  daily_lightning: { name: '⚡ Daily Lightning', desc: 'Win 2 games in 25 moves or fewer today', points: 350 },
  daily_capturer: { name: '🎯 Daily Capturer', desc: 'Make 24 captures in one day (any of your pieces)', points: 180 },
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
    desc: 'Make 32 captures today, all games (any of your pieces)',
    points: 200,
  },
  daily_blitz_king: {
    name: '⚡⚡ Blitz King',
    desc: 'Win 2 games with 1-minute time control today',
    points: 300,
  },
  daily_time_master: {
    name: '⏱️ Time Master',
    desc: 'Win at least one game on each of 2 different time controls today',
    points: 300,
  },
  daily_king_safety: {
    name: "👑 King's Guard",
    desc: 'Castle in 2 different games today',
    points: 190,
  },
  daily_promotion_royalty: {
    name: '👸 Promotion Royalty',
    desc: 'Promote a pawn in any game today',
    points: 170,
  },
  daily_material_advantage: {
    name: '⚖️ Material Master',
    desc: 'Win a game where you had a material advantage of 3+ points',
    points: 260,
  },
  daily_openings_expert: {
    name: '📚 Opening Expert',
    desc: 'Play 2 different detected openings today',
    points: 230,
  },
  daily_checkmate_artist: {
    name: '🎨 Checkmate Artist',
    desc: 'Checkmate with 3 different pieces today (queen, rook, knight, bishop, or pawn)',
    points: 400,
  },
  daily_en_passant_master: {
    name: '🎯 En Passant Master',
    desc: 'Perform en passant in a game today',
    points: 320,
  },
  daily_underpromotion: {
    name: '♟️ Underpromotion Specialist',
    desc: 'Underpromote once today (to rook, bishop, or knight)',
    points: 320,
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
    desc: 'Give 14 checks today (all games)',
    points: 250,
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
    desc: 'Make 24 captures today, all games (any of your pieces)',
    points: 340,
  },
  daily_white_duo: { name: '⚪ White Hot', desc: 'Win 2 games as White today', points: 220 },
  daily_black_duo: { name: '⚫ Black Hot', desc: 'Win 2 games as Black today', points: 220 },
  daily_black_win: { name: '⚫ Black Victory', desc: 'Win 1 game as Black today', points: 180 },
  daily_play_as_black: { name: '⚫ Black Session', desc: 'Start 2 games as Black today', points: 160 },
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
    desc: 'Make 22 captures today, all games (any of your pieces)',
    points: 360,
  },
  daily_pawn_island: {
    name: '🏝️ Check Rain',
    desc: 'Give 12 checks today (all games)',
    points: 320,
  },
  daily_rook_battery: {
    name: '🏰 Four Corners',
    desc: 'Play 4 games today',
    points: 350,
  },
  daily_elite_capturer: {
    name: '⚔️ Elite Capturer',
    desc: 'Make 28 captures today, all games (any of your pieces)',
    points: 300,
  },
  daily_pawn_sweeper: {
    name: '🧹 Pawn Sweeper',
    desc: 'Take 10 enemy pawns today (victim type)',
    points: 300,
  },
  daily_knight_roundup: {
    name: '🐴 Knight Roundup',
    desc: 'Take 4 enemy knights today (victim type)',
    points: 340,
  },
  daily_bishop_ambush: {
    name: '♗ Bishop Ambush',
    desc: 'Take 4 enemy bishops today (victim type)',
    points: 310,
  },
  daily_rook_raider_adv: {
    name: '🏰 Rook Raider',
    desc: 'Take 4 enemy rooks today (victim type)',
    points: 360,
  },
  daily_queen_snatcher: {
    name: '👑 Queen Snatcher',
    desc: 'Take 2 enemy queens today (victim type)',
    points: 400,
  },
  daily_full_deck_hunter: {
    name: '🃏 Mini Deck',
    desc: 'Capture at least 7 pawns, 2 knights, and 2 rooks today (victim type, all games)',
    points: 420,
  },
  daily_checkmate_maestro: {
    name: '🎨 Checkmate Maestro',
    desc: 'Deliver checkmate with 3 different piece types today (queen, rook, knight, bishop, or pawn)',
    points: 400,
  },
  daily_double_play: { name: '🎮 Double Feature', desc: 'Play 2 complete games today', points: 140 },
  daily_sixty_moves: { name: '♟️ Sixty Steps', desc: 'Make 60 moves today (all games combined)', points: 135 },
  daily_triad_qe4_nf6_pa6: {
    name: '🧩 Triad Crown',
    desc: 'In one game: land your queen on e4, a knight on f6, and a pawn on a6.',
    points: 280,
  },
  daily_triad_qd5_nc3_ph5: { name: '🧭 Baltic Beacon', desc: 'Queen d5, knight c3, pawn h5 in the same game.', points: 275 },
  daily_triad_rc7_ne5_bb5: { name: '🏔️ Highland Trio', desc: 'Rook c7, knight e5, bishop b5 in one game.', points: 290 },
  daily_triad_ra4_bc6_pe6: { name: '🌊 Lowland March', desc: 'Rook a4, bishop c6, pawn e6 in one game.', points: 285 },
  daily_triad_qg4_nh3_pb4: { name: '🎪 Wing Walk', desc: 'Queen g4, knight h3, pawn b4 in one game.', points: 270 },
  daily_triad_qd4_nf3_pe5: { name: '🎯 Central Wedge', desc: 'Queen d4, knight f3, pawn e5 in one game.', points: 265 },
  daily_triad_nf3_pd4_bc4: { name: '🇮🇹 Italian Echo', desc: 'Knight f3, pawn d4, bishop c4 in one game.', points: 265 },
  daily_triad_qc4_nd5_pf5: { name: '📎 Central Pinch', desc: 'Queen c4, knight d5, pawn f5 in one game.', points: 285 },
  daily_triad_bd5_ne6_pg5: { name: '🪜 Minor Lead', desc: 'Bishop d5, knight e6, pawn g5 in one game.', points: 275 },
  daily_triad_re5_kf5_qh5: { name: '🎯 Forward Camp', desc: 'Rook e5, king f5, queen h5 in one game.', points: 295 },
  daily_triad_pe5_nf6_qd4: { name: '🐉 Sicilian Sketch', desc: 'Pawn e5, knight f6, queen d4 in one game.', points: 280 },
  daily_triad_pc5_bb7_qc7: { name: '♟️ Slav Trace', desc: 'Pawn c5, bishop b7, queen c7 in one game.', points: 285 },
  daily_triad_ng6_ph5_qf6: { name: '🦅 Kingside Leap', desc: 'Knight g6, pawn h5, queen f6 in one game.', points: 290 },
  daily_triad_re6_qf6_pg6: { name: '⬛ Mid Rank Storm', desc: 'Rook e6, queen f6, pawn g6 in one game.', points: 295 },
  daily_triad_bf4_ne2_pg3: { name: '🌿 English Garden', desc: 'Bishop f4, knight e2, pawn g3 in one game.', points: 270 },
  daily_triad_rc3_nb5_qa4: { name: '🔭 A-File Scope', desc: 'Rook c3, knight b5, queen a4 in one game.', points: 285 },
  daily_triad_pb5_nc6_qb6: { name: '🏙️ Queenside Stack', desc: 'Pawn b5, knight c6, queen b6 in one game.', points: 280 },
  daily_triad_kb5_rc5_qd5: { name: '🧱 Fifth Rank Net', desc: 'King b5, rook c5, queen d5 in one game.', points: 295 },
  daily_triad_ne4_pf5_qh5: { name: '🎆 H-File Burst', desc: 'Knight e4, pawn f5, queen h5 in one game.', points: 285 },
  daily_triad_rh3_qg3_pg4: { name: '🌊 G-File Surf', desc: 'Rook h3, queen g3, pawn g4 in one game.', points: 275 },
  daily_triad_bc3_ne4_rg3: { name: '🏰 Piece Storm', desc: 'Bishop c3, knight e4, rook g3 in one game.', points: 270 },
  daily_triad_pd5_nf6_bg5: { name: '🥊 Mainline Jab', desc: 'Pawn d5, knight f6, bishop g5 in one game.', points: 275 },
  daily_triad_qd4_ne5_rc5: { name: '🔄 Central Heavy', desc: 'Queen d4, knight e5, rook c5 in one game.', points: 290 },
  daily_triad_ra3_nc4_pb5: { name: '🧊 Wing Advance', desc: 'Rook a3, knight c4, pawn b5 in one game.', points: 275 },
  daily_triad_qh4_rf4_ph3: { name: '🪁 Hook Route', desc: 'Queen h4, rook f4, pawn h3 in one game.', points: 280 },
  daily_triad_pe5_nf6_be7: { name: '🐴 French Triangle', desc: 'Pawn e5, knight f6, bishop e7 in one game.', points: 275 },
  daily_triad_pg6_nf6_bg7: { name: '🦁 King\'s Indian Shell', desc: 'Pawn g6, knight f6, bishop g7 in one game.', points: 280 },
  daily_triad_pd5_nc6_qb6: { name: '♟️ Nimzo Queue', desc: 'Pawn d5, knight c6, queen b6 in one game.', points: 285 },
  daily_triad_pe6_nf6_be7: { name: '🏛️ Caro Stack', desc: 'Pawn e6, knight f6, bishop e7 in one game.', points: 270 },
  daily_triad_pc6_nd7_qb6: { name: '🌀 Queenside Nest', desc: 'Pawn c6, knight d7, queen b6 in one game.', points: 275 },
  daily_triad_pa6_bg7_nf6: { name: '🌙 Queen\'s Indian Veil', desc: 'Pawn a6, bishop g7, knight f6 in one game.', points: 285 },
  daily_triad_pd6_nc6_bf5: { name: '🗡️ Old Indian Spike', desc: 'Pawn d6, knight c6, bishop f5 in one game.', points: 280 },
  daily_triad_pc5_bb6_qc7: { name: '🌊 Slav Mirror', desc: 'Pawn c5, bishop b6, queen c7 in one game.', points: 285 },
  daily_triad_pf6_ng7_be5: { name: '🏯 Leningrad Wall', desc: 'Pawn f6, knight g7, bishop e5 in one game.', points: 290 },
  daily_triad_pe7_ng6_bf5: { name: '🛡️ Hedgehog Lite', desc: 'Pawn e7, knight g6, bishop f5 in one game.', points: 275 },
  daily_triad_pg5_nf6_bg7: { name: '⚡ Benoni Burst', desc: 'Pawn g5, knight f6, bishop g7 in one game.', points: 280 },
  daily_triad_pa5_nc6_qa5: { name: '🎯 Queenside Pinch', desc: 'Pawn a5, knight c6, queen a5 in one game.', points: 270 },
  daily_bf_nf3_pe4_bc4: {
    name: '👁️ Blind Italian',
    desc: 'Blindfold: knight f3, pawn e4, bishop c4 in one game.',
    points: 320,
  },
  daily_bf_qd5_re5_pf5: { name: '👁️ Blind Mid', desc: 'Blindfold: queen d5, rook e5, pawn f5 in one game.', points: 330 },
  daily_bf_pd4_ne5_qd5: { name: '👁️ Blind Central', desc: 'Blindfold: pawn d4, knight e5, queen d5 in one game.', points: 325 },
  daily_bf_bd4_ne4_re5: { name: '👁️ Blind Battery', desc: 'Blindfold: bishop d4, knight e4, rook e5 in one game.', points: 315 },
  daily_bf_bc4_nd4_pe5: { name: '👁️ Blind Duo Wing', desc: 'Blindfold: bishop c4, knight d4, pawn e5 in one game.', points: 310 },
  daily_bf_ra5_nc5_pb5: { name: '👁️ Blind Fifth', desc: 'Blindfold: rook a5, knight c5, pawn b5 in one game.', points: 335 },
  daily_bf_pg6_nf6_bg7: { name: '👁️ Blind KID', desc: 'Blindfold: pawn g6, knight f6, bishop g7 in one game.', points: 325 },
  daily_bf_pe5_nf6_be7: { name: '👁️ Blind French', desc: 'Blindfold: pawn e5, knight f6, bishop e7 in one game.', points: 320 },
  daily_bf_pd5_nc6_qb6: { name: '👁️ Blind Queenside', desc: 'Blindfold: pawn d5, knight c6, queen b6 in one game.', points: 330 },
  daily_pure_ke4_nf5_pd4: {
    name: '🌑 Pure Mid',
    desc: 'Pure blindfold (no history): king e4, knight f5, pawn d4.',
    points: 380,
  },
  daily_pure_qd5_ne4_pf5: { name: '🌑 Pure Fight', desc: 'Pure blindfold: queen d5, knight e4, pawn f5.', points: 390 },
  daily_pure_rc4_qe5_nd5: { name: '🌑 Pure Heavy', desc: 'Pure blindfold: rook c4, queen e5, knight d5.', points: 385 },
  daily_pure_bd4_ne3_pf4: { name: '🌑 Pure Minor', desc: 'Pure blindfold: bishop d4, knight e3, pawn f4.', points: 395 },
  daily_pure_pe5_nf6_be7: { name: '🌑 Pure French', desc: 'Pure blindfold: pawn e5, knight f6, bishop e7.', points: 385 },
  daily_pure_pg6_nf6_bg7: { name: '🌑 Pure KID', desc: 'Pure blindfold: pawn g6, knight f6, bishop g7.', points: 390 },
  daily_duo_qe4_nf6: { name: '🤝 Duo Crown', desc: 'Queen e4 and knight f6 in the same game.', points: 220 },
  daily_duo_rc7_qc2: { name: '🏰 Seventh Echo', desc: 'Rook c7 and queen c2 in the same game.', points: 230 },
  daily_duo_nf3_bc4: { name: '🍝 Italian Pair', desc: 'Knight f3 and bishop c4 in the same game.', points: 210 },
  daily_duo_pd4_pe4: { name: '📌 Central Pawns', desc: 'Pawn to d4 and pawn to e4 in the same game.', points: 225 },
  daily_duo_nf6_bg7: { name: '🦁 KID Pair', desc: 'Knight f6 and bishop g7 in the same game.', points: 215 },
  daily_duo_pe5_nc6: { name: '⚔️ Open Counter', desc: 'Pawn e5 and knight c6 in the same game.', points: 210 },
  daily_duo_pd5_nf6: { name: '🏁 d5 Anchor', desc: 'Pawn d5 and knight f6 in the same game.', points: 205 },
  daily_blindfold_rook_ranger: {
    name: '👁️🏰 Blindfold Rook Ranger',
    desc: 'Make 6 rook moves in blindfold games today (board hidden)',
    points: 260,
  },
  daily_blindfold_queen_nav: {
    name: '👁️👑 Blindfold Queen Nav',
    desc: 'Make 5 queen moves in blindfold games today (board hidden)',
    points: 270,
  },
  daily_pure_blind_pawn_echo: {
    name: '👁️♟️ Pure Blind Pawn Echo',
    desc: 'Make 6 pawn moves in pure blindfold (no move history) today',
    points: 320,
  },
  daily_early_bird_castle: {
    name: '🏰 Early Bird Castle',
    desc: 'Castle by your 12th move of the game at least once today',
    points: 200,
  },
  daily_finish_early_bird_ct: { name: '🐦 Early Bird (CT)', desc: 'Finish a game before 7:00 AM Central Time.', points: 220 },
  daily_finish_before_10am_ct: { name: '🌅 Morning Finish (CT)', desc: 'Finish a game before 10:00 AM Central Time.', points: 210 },
  daily_finish_lunch_ct: { name: '🥪 Lunch Break (CT)', desc: 'Finish a game between 1:00 PM and 2:00 PM Central Time.', points: 230 },
  daily_finish_afternoon_ct: { name: '☀️ Afternoon Session (CT)', desc: 'Finish a game between 3:00 PM and 5:00 PM Central Time.', points: 215 },
  daily_finish_night_owl_ct: { name: '🦉 Night Owl (CT)', desc: 'Finish a game after 9:00 PM Central Time.', points: 225 },
  daily_end_queen_home: { name: '👑 Queen Home', desc: 'Finish a game with your queen still on d1 (White) or d8 (Black).', points: 240 },
  daily_end_castled_king: { name: '🏠 Castled King', desc: 'Finish with your king on g1 or c1 (White) or g8 or c8 (Black).', points: 250 },
  daily_end_center_knight: { name: '🎯 Center Knight', desc: 'Finish with your knight on d4, e4, d5, or e5.', points: 235 },
  daily_end_corner_rook: { name: '🏰 Corner Rook', desc: 'Finish with a rook on a1 or h1 (White) or a8 or h8 (Black).', points: 245 },
  daily_end_light_bishop_home: { name: '♗ Light Bishop Home', desc: 'Finish with your light-squared bishop on f1 (White) or f8 (Black).', points: 230 },
  daily_opening_italian: { name: '🇮🇹 Italian Game', desc: 'Play the Italian Game today (engine follows the book): 1.e4 e5 2.Nf3 Nc6 3.Bc4', points: 260 },
  daily_opening_roy_lopez: { name: '🇪🇸 Ruy Lopez', desc: 'Play the Ruy Lopez today (engine follows the book): 1.e4 e5 2.Nf3 Nc6 3.Bb5', points: 270 },
  daily_opening_sicilian: { name: '🐉 Sicilian Main Line', desc: 'Play this Sicilian line today (engine follows the book): 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3', points: 290 },
  daily_opening_kings_indian: { name: '🦁 King\'s Indian', desc: 'Play the King\'s Indian Classical today (engine follows the book): 1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6', points: 285 },
  daily_opening_qgd: { name: '♛ Queen\'s Gambit Declined', desc: 'Play the Queen\'s Gambit Declined today (engine follows the book): 1.d4 d5 2.c4 e6', points: 255 },
  daily_opening_french: { name: '🇫🇷 French Classical', desc: 'Play the French Classical today (engine follows the book): 1.e4 e6 2.d4 d5 3.Nc3', points: 265 },
  daily_opening_caro_kann: { name: '🏛️ Caro-Kann Classical', desc: 'Play the Caro-Kann Classical today (engine follows the book): 1.e4 c6 2.d4 d5 3.Nc3', points: 265 },
  daily_opening_scandinavian: { name: '🛡️ Scandinavian Main', desc: 'Play the Scandinavian Main Line today (engine follows the book): 1.e4 d5 2.exd5 Qxd5', points: 275 },
  daily_mate_with_knight: { name: '🐴 Knight Mate', desc: 'Win a game by delivering checkmate with your knight.', points: 320 },
  daily_mate_with_bishop: { name: '♗ Bishop Mate', desc: 'Win a game by delivering checkmate with your bishop.', points: 310 },
  daily_mate_with_rook: { name: '🏰 Rook Mate', desc: 'Win a game by delivering checkmate with your rook.', points: 300 },
  daily_mate_with_queen: { name: '👑 Queen Mate', desc: 'Win a game by delivering checkmate with your queen.', points: 280 },
  daily_mate_with_pawn: { name: '♟️ Pawn Mate', desc: 'Win a game by delivering checkmate with your pawn.', points: 400 },
  daily_queen_quiet_until_8: { name: '👑 Patient Queen', desc: 'Win without moving your queen until your 8th move or later.', points: 290 },
  daily_rook_quiet_until_10: { name: '🏰 Rook Restraint', desc: 'Win without moving a rook until your 10th move or later.', points: 275 },
  daily_king_quiet_until_15: { name: '♔ King Safety', desc: 'Win without moving your king until your 15th move or later.', points: 300 },
  daily_bishop_quiet_until_6: { name: '♗ Bishop Delay', desc: 'Win without moving a bishop until your 6th move or later.', points: 265 },
  daily_crown_jewel: {
    name: '💎 The Crown Jewel',
    desc: 'Win one flawless attacking game: deliver checkmate, lose no pieces, castle, and give at least 3 checks.',
    points: 1000,
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
