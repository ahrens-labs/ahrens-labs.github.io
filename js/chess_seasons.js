/**
 * TrifangX quarterly season track (client + worker merge for `seasonTrack` / `seasonBonusPoints`).
 *
 * =============================================================================
 * SEASON DESIGN GUIDELINES (apply every month; update this block when rules change)
 * =============================================================================
 *
 * 1) Calendar
 *    - Season id is UTC: `YYYY-MM` where `MM` is the quarter anchor (`02` spring, `05` summer, `08` autumn, `11` winter).
 *    - Each season runs three months: Feb–Apr, May–Jul, Aug–Oct, Nov–Jan (winter id uses the year November starts).
 *    - Bounds: `seasonBoundsUtc` (first instant of opening month through last instant of closing month UTC).
 *
 * 2) Track shape
 *    - One linear track of steps (currently 10). Each step = exactly one existing achievement id
 *      (`challengeAchievementId`) from `trifangx_chess_app.js` — do not invent ids here without adding
 *      the achievement in the app first. Steps can mix wins, tactics, material, and checkmates.
 *    - Progress is stored in cloud chess as `seasonTrack.nodesCompleted` (integer: how many steps
 *      have been fully claimed). Next step index = that value. Gating is sequential.
 *    - `seasonTrack.earnBaseline` (games, wins, castlingMoves, …) is updated on each successful claim
 *      so the *next* step only counts stats gained after prior steps were claimed (not retroactive).
 *    - Optional buyout: each step has a shop-points price (`getSeasonStepBuyoutCost`), spent from the same
 *      pool as the TrifangX shop (achievement points + cheat minus `pointsSpent`). Paying on claim skips
 *      the season-relative progress check only — it does not unlock the achievement in cloud; rewards and
 *      season bonus still apply. Must match worker `SEASON_STEP_BUYOUT_POINTS`.
 *
 * 3) Bonus points
 *    - Each step awards `bonusPoints` when claimed (cumulative in `seasonBonusPoints`). They count
 *      toward public leaderboard career “points” column on the worker (achievement points + bonus).
 *    - Curve: exponential by step index (~base × growth^i), rounded; keep in sync with worker
 *      `SEASON_CLAIM_NODES` bonusPoints.
 *
 * 4) Rewards
 *    - `shop` rewards use ids that are NOT sold in the regular shop; unlock goes into `shopUnlocks`
 *      like any other cosmetic. Add piece URLs / board CSS / highlight `colorMap` in the engine when
 *      adding a new id. Finale step grants only `season_*` shop ids (not career-shop duplicates).
 *    - Leaderboard row gradient finishes (season): earned at `nodesCompleted` thresholds (see worker
 *      `LB_ROW_PRESET_MIN_NODES` + `js/chess_lb_row.js`); list on the matching track step via
 *      `lb_row_finish` rewards. On claim, presets persist as `lbrow:<id>` in `shopUnlocks.leaderboardRowColors`
 *      and stay unlocked across future months (current-month nodes still gate until first earn).
 *    - Leaderboard flair: `lb_frame` (allowlist in worker `sanitizeChessLbFlair`), `lb_title`,
 *      `lb_prefix`, `lb_suffix`. Keep strings short; worker sanitizes length / charset.
 *
 * 5) Theming (optional per quarter)
 *    - Keys in `SEASON_THEMES_BY_UTC_MONTH` are quarter anchors `'02'`, `'05'`, `'08'`, `'11'`.
 *    - If present, `stepTitles` MUST have the same length as `SEASON_TRACK_MECHANICAL` (copy only;
 *      mechanics stay in the mechanical template). Flavor text must not contradict the real rule.
 *    - Months without an entry use `DEFAULT_STEP_TITLES`.
 *
 * 6) Adding a new month
 *    - Add `SEASON_TRACK_MECHANICAL_MM`, worker `SEASON_CLAIM_NODES_MM`, and `SEASON_THEMES_BY_UTC_MONTH['MM']`.
 *    - If mechanics change (different achievements or rewards), edit `SEASON_TRACK_MECHANICAL` or
 *      introduce a month-keyed mechanical table (not needed until you intentionally fork the ladder).
 *    - Deploy worker + static site together when changing ids that the worker must recognize.
 *    - Account dashboard can equip `seasonTrack.lbFlair` via POST /api/chess/lb-flair (unlocked ids only).
 *    - Leaderboard row background: standard hex swatches for everyone; extra solids and custom hex from
 *      `shopUnlocks.leaderboardRowColors` (TrifangX shop); season gradients gated by current-month
 *      `seasonTrack.nodesCompleted` (see `workers/src/index.js` + `js/chess_lb_row.js`, keep in sync).
 *
 * 7) Season reset (optional player action)
 *    - POST `/api/chess/season-reset` (session) → durable `resetSeasonTrack`: only for `seasonTrack.seasonId`
 *      equal to current UTC month; zeros `nodesCompleted`, refreshes `earnBaseline`, strips shop + flair
 *      granted by `SEASON_CLAIM_NODES` for claimed steps, subtracts matching `seasonBonusPoints`, clears
 *      finale email key for that month. Does not remove global achievements; buyouts are not refunded.
 *
 * =============================================================================
 */
(function (global) {
  'use strict';

  /** @typedef {{ challengeAchievementId: string, challengeTitle: string, bonusPoints: number, rewards: Array<{ kind: string, category?: string, id?: string, title?: string, frame?: string, prefix?: string, suffix?: string, presets?: string[] }> }} ChessSeasonNode */

  /** @typedef {{ key: string, name: string, tagline: string, stepTitles: string[] }} SeasonThemeDef */

  const GUIDELINES = Object.freeze([
    'UTC quarter boundaries; shared season id YYYY-{02|05|08|11}.',
    'Linear gated steps; each step = one real TrifangX achievement id.',
    'Bonus points on claim; leaderboard uses achievement points + season bonus.',
    'Exclusive cosmetics via shopUnlocks ids; flair allowlisted on the worker.',
    'Optional theme: SEASON_THEMES_BY_UTC_MONTH[MM].stepTitles same length as mechanical track.',
    'Buyout: SEASON_STEP_BUYOUT_POINTS must match worker; spend shop points (pointsSpent) to skip achievement only.',
  ]);

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  /** Quarter anchors in calendar order (also season id suffix). */
  const SEASON_QUARTER_ANCHORS = Object.freeze(['02', '05', '08', '11']);

  /**
   * Map any legacy monthly `YYYY-MM` or canonical quarter id to anchor + canonical season id.
   * @returns {{ canonicalId: string, anchor: string, startYear: number } | null}
   */
  function parseSeasonQuarter(seasonId) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(seasonId || '').trim());
    if (!m) return null;
    const y = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (mm === 2 || mm === 5 || mm === 8 || mm === 11) {
      return { canonicalId: y + '-' + pad2(mm), anchor: pad2(mm), startYear: y };
    }
    if (mm === 1) return { canonicalId: y - 1 + '-11', anchor: '11', startYear: y - 1 };
    if (mm >= 2 && mm <= 4) return { canonicalId: y + '-02', anchor: '02', startYear: y };
    if (mm >= 5 && mm <= 7) return { canonicalId: y + '-05', anchor: '05', startYear: y };
    if (mm >= 8 && mm <= 10) return { canonicalId: y + '-08', anchor: '08', startYear: y };
    if (mm >= 11 && mm <= 12) return { canonicalId: y + '-11', anchor: '11', startYear: y };
    return null;
  }

  function getChessSeasonIdUtc(d) {
    const x = d || new Date();
    const y = x.getUTCFullYear();
    const mo = x.getUTCMonth() + 1;
    if (mo >= 11) return y + '-11';
    if (mo === 1) return y - 1 + '-11';
    if (mo <= 4) return y + '-02';
    if (mo <= 7) return y + '-05';
    return y + '-08';
  }

  /** Season id anchor month (`02`|`05`|`08`|`11`) or legacy month digits. */
  function utcMonthFromSeasonId(seasonId) {
    const q = parseSeasonQuarter(seasonId);
    return q ? q.anchor : null;
  }

  function seasonBoundsUtc(seasonId) {
    const q = parseSeasonQuarter(seasonId);
    if (!q) return null;
    const y = q.startYear;
    const a = q.anchor;
    if (a === '11') {
      return {
        startMs: Date.UTC(y, 10, 1, 0, 0, 0, 0),
        endMs: Date.UTC(y + 1, 1, 1, 0, 0, 0, 0) - 1,
        label: y + ' · Winter holiday (Nov–Jan)',
      };
    }
    if (a === '02') {
      return {
        startMs: Date.UTC(y, 1, 1, 0, 0, 0, 0),
        endMs: Date.UTC(y, 4, 1, 0, 0, 0, 0) - 1,
        label: y + ' · Spring (Feb–Apr)',
      };
    }
    if (a === '05') {
      return {
        startMs: Date.UTC(y, 4, 1, 0, 0, 0, 0),
        endMs: Date.UTC(y, 7, 1, 0, 0, 0, 0) - 1,
        label: y + ' · Summer (May–Jul)',
      };
    }
    if (a === '08') {
      return {
        startMs: Date.UTC(y, 7, 1, 0, 0, 0, 0),
        endMs: Date.UTC(y, 10, 1, 0, 0, 0, 0) - 1,
        label: y + ' · Autumn (Aug–Oct)',
      };
    }
    return null;
  }

  /** Quarters whose season page / cosmetics stay hidden until the season opens (UTC). */
  const SEASON_MONTHS_HIDDEN_UNTIL_START = new Set(['11']);

  /** Quarter anchors with season-exclusive shop catalog entries (retire when the next quarter starts). */
  const SEASON_SHOP_CATALOG_MONTHS = SEASON_QUARTER_ANCHORS.slice();

  /** @returns {string} mechanical track key (`05`|`06`|`07`|`11`) */
  function getSeasonMechanicalMonthKey(seasonId) {
    const q = parseSeasonQuarter(seasonId);
    if (!q) return '05';
    const a = q.anchor;
    if (a === '11') return '11';
    if (a === '08') return '07';
    if (a === '05') return '06';
    if (a === '02') return '05';
    return '05';
  }

  function compareSeasonIds(a, b) {
    const ba = seasonBoundsUtc(a);
    const bb = seasonBoundsUtc(b);
    if (ba && bb) return ba.startMs - bb.startMs;
    return String(a || '').trim().localeCompare(String(b || '').trim());
  }

  /**
   * Mechanical ladder (achievement ids + rewards + bonus). Order is the product truth.
   * @type {Array<Omit<ChessSeasonNode, 'challengeTitle'>>}
   */
  const SEASON_TRACK_MECHANICAL_05 = [
    { challengeAchievementId: 'first_game', bonusPoints: 40, rewards: [{ kind: 'lb_prefix', prefix: '🌲' }] },
    {
      challengeAchievementId: 'knight_to_f3',
      bonusPoints: 57,
      rewards: [{ kind: 'shop', category: 'boards', id: 'season_awakening' }],
    },
    {
      challengeAchievementId: 'bishop_to_f4',
      bonusPoints: 82,
      rewards: [{ kind: 'shop', category: 'highlightColors', id: 'season_glacier_glow' }],
    },
    {
      challengeAchievementId: 'en_passant',
      bonusPoints: 118,
      rewards: [
        { kind: 'shop', category: 'pieces', id: 'season_trail' },
        { kind: 'lb_row_finish', presets: ['emerald_glade', 'glacier_ribbon'] },
      ],
    },
    {
      challengeAchievementId: 'queen_capturer',
      bonusPoints: 169,
      rewards: [{ kind: 'lb_frame', frame: 'silver_lane' }],
    },
    {
      challengeAchievementId: 'capture_master',
      bonusPoints: 242,
      rewards: [{ kind: 'lb_title', title: 'Emerald grove hunter' }],
    },
    {
      challengeAchievementId: 'castler',
      bonusPoints: 347,
      rewards: [
        { kind: 'lb_frame', frame: 'amber_pulse' },
        { kind: 'lb_row_finish', presets: ['violet_canopy', 'moonlit_band'] },
      ],
    },
    {
      challengeAchievementId: 'promoter',
      bonusPoints: 496,
      rewards: [{ kind: 'shop', category: 'boards', id: 'season_rift' }],
    },
    {
      challengeAchievementId: 'checkmate_rook',
      bonusPoints: 709,
      rewards: [{ kind: 'lb_title', title: 'Canopy spire sniper' }],
    },
    {
      challengeAchievementId: 'checkmate_queen',
      bonusPoints: 1015,
      rewards: [
        { kind: 'lb_frame', frame: 'violet_arc' },
        { kind: 'lb_title', title: 'Emerald ascendant' },
        { kind: 'lb_title', title: 'Emerald crown' },
        { kind: 'lb_title', title: 'Canopy finisher' },
        { kind: 'lb_suffix', suffix: '✦' },
        { kind: 'shop', category: 'boards', id: 'season_canopy_crown' },
        { kind: 'shop', category: 'pieces', id: 'season_canopy_pieces' },
        { kind: 'shop', category: 'highlightColors', id: 'season_gilded_leaf' },
        { kind: 'shop', category: 'arrowColors', id: 'season_grove_arrow' },
        { kind: 'shop', category: 'themes', id: 'season_moonlit_canopy' },
        { kind: 'shop', category: 'checkmateEffects', id: 'season_finale_flare' },
        { kind: 'shop', category: 'legalMoveDots', id: 'season_emerald_star' },
        { kind: 'lb_row_finish', presets: ['finale_aurora'] },
      ],
    },
  ];

  /** Winter holiday quarter (Nov–Jan) — festive + trackable; keep worker `SEASON_CLAIM_NODES_11` in sync. */
  const SEASON_TRACK_MECHANICAL_11 = [
    { challengeAchievementId: 'first_win', bonusPoints: 40, rewards: [{ kind: 'lb_prefix', prefix: '🎄' }] },
    {
      challengeAchievementId: 'solstice_win_night_ct',
      bonusPoints: 57,
      rewards: [{ kind: 'shop', category: 'boards', id: 'season_winter_frostline' }],
    },
    {
      challengeAchievementId: 'pawn_to_e4',
      bonusPoints: 82,
      rewards: [{ kind: 'shop', category: 'highlightColors', id: 'season_winter_lantern_glow' }],
    },
    {
      challengeAchievementId: 'castle_on_10',
      bonusPoints: 118,
      rewards: [
        { kind: 'shop', category: 'pieces', id: 'season_winter_snowsilhouette' },
        { kind: 'lb_row_finish', presets: ['emerald_glade', 'glacier_ribbon'] },
      ],
    },
    {
      challengeAchievementId: 'underpromote',
      bonusPoints: 169,
      rewards: [{ kind: 'lb_frame', frame: 'silver_lane' }],
    },
    {
      challengeAchievementId: 'solstice_win_dawn_ct',
      bonusPoints: 242,
      rewards: [{ kind: 'lb_title', title: 'Ornament skewer' }],
    },
    {
      challengeAchievementId: 'checkmate_bishop',
      bonusPoints: 347,
      rewards: [
        { kind: 'lb_frame', frame: 'amber_pulse' },
        { kind: 'lb_row_finish', presets: ['violet_canopy', 'moonlit_band'] },
      ],
    },
    {
      challengeAchievementId: 'castler',
      bonusPoints: 496,
      rewards: [{ kind: 'shop', category: 'boards', id: 'season_winter_aurora_path' }],
    },
    {
      challengeAchievementId: 'checkmate_knight',
      bonusPoints: 709,
      rewards: [{ kind: 'lb_title', title: 'Generous gambit' }],
    },
    {
      challengeAchievementId: 'checkmate_queen',
      bonusPoints: 1015,
      rewards: [
        { kind: 'lb_frame', frame: 'violet_arc' },
        { kind: 'lb_title', title: 'Holiday ascendant' },
        { kind: 'lb_title', title: 'Frost crown' },
        { kind: 'lb_title', title: 'Hearthside finisher' },
        { kind: 'lb_suffix', suffix: '❄' },
        { kind: 'shop', category: 'boards', id: 'season_winter_hearth_crown' },
        { kind: 'shop', category: 'pieces', id: 'season_winter_regalia' },
        { kind: 'shop', category: 'highlightColors', id: 'season_winter_holly_gleam' },
        { kind: 'shop', category: 'arrowColors', id: 'season_winter_starfall_arrow' },
        { kind: 'shop', category: 'themes', id: 'season_winter_holiday' },
        { kind: 'shop', category: 'checkmateEffects', id: 'season_winter_hearth_flare' },
        { kind: 'shop', category: 'legalMoveDots', id: 'season_winter_snowflake_star' },
        { kind: 'lb_row_finish', presets: ['finale_aurora'] },
      ],
    },
  ];

  /** June 2026+ — Solstice Gold (month-keyed; keep worker `SEASON_CLAIM_NODES_06` in sync). */
  const SEASON_TRACK_MECHANICAL_06 = [
    { challengeAchievementId: 'first_win', bonusPoints: 40, rewards: [{ kind: 'lb_prefix', prefix: '☀️' }] },
    {
      challengeAchievementId: 'solstice_win_dawn_ct',
      bonusPoints: 57,
      rewards: [{ kind: 'shop', category: 'boards', id: 'season_golden_hour' }],
    },
    {
      challengeAchievementId: 'pawn_to_e4',
      bonusPoints: 82,
      rewards: [{ kind: 'shop', category: 'highlightColors', id: 'season_honey_glow' }],
    },
    {
      challengeAchievementId: 'flair_center_1',
      bonusPoints: 118,
      rewards: [
        { kind: 'shop', category: 'pieces', id: 'season_solstice_pieces' },
        { kind: 'lb_row_finish', presets: ['golden_meadow', 'coral_ribbon'] },
      ],
    },
    {
      challengeAchievementId: 'solstice_win_golden_hour_ct',
      bonusPoints: 169,
      rewards: [{ kind: 'lb_frame', frame: 'gold_filament' }],
    },
    {
      challengeAchievementId: 'flair_windmill_1',
      bonusPoints: 242,
      rewards: [{ kind: 'lb_title', title: 'Solstice striker' }],
    },
    {
      challengeAchievementId: 'castle_on_10',
      bonusPoints: 347,
      rewards: [
        { kind: 'lb_frame', frame: 'amber_corona' },
        { kind: 'lb_row_finish', presets: ['dusk_ember', 'champagne_band'] },
      ],
    },
    {
      challengeAchievementId: 'underpromote',
      bonusPoints: 496,
      rewards: [{ kind: 'shop', category: 'boards', id: 'season_high_sun' }],
    },
    {
      challengeAchievementId: 'checkmate_bishop',
      bonusPoints: 709,
      rewards: [{ kind: 'lb_title', title: 'High-noon hunter' }],
    },
    {
      challengeAchievementId: 'solstice_win_night_ct',
      bonusPoints: 1015,
      rewards: [
        { kind: 'lb_frame', frame: 'solstice_flare' },
        { kind: 'lb_title', title: 'Solstice ascendant' },
        { kind: 'lb_title', title: 'Golden crown' },
        { kind: 'lb_title', title: 'Long-day finisher' },
        { kind: 'lb_suffix', suffix: '✧' },
        { kind: 'shop', category: 'boards', id: 'season_solstice_crown' },
        { kind: 'shop', category: 'pieces', id: 'season_crown_regalia' },
        { kind: 'shop', category: 'highlightColors', id: 'season_gilded_ray' },
        { kind: 'shop', category: 'arrowColors', id: 'season_solar_arrow' },
        { kind: 'shop', category: 'themes', id: 'season_solstice_gold' },
        { kind: 'shop', category: 'checkmateEffects', id: 'season_solar_bloom' },
        { kind: 'shop', category: 'legalMoveDots', id: 'season_solar_star' },
        { kind: 'lb_row_finish', presets: ['solstice_finale'] },
      ],
    },
  ];

  /** July 2026+ — World Cup (month-keyed; keep worker `SEASON_CLAIM_NODES_07` in sync). */
  const SEASON_TRACK_MECHANICAL_07 = [
    { challengeAchievementId: 'first_win', bonusPoints: 40, rewards: [{ kind: 'lb_prefix', prefix: '⚽' }] },
    {
      challengeAchievementId: 'flair_orchestra_1',
      bonusPoints: 57,
      rewards: [{ kind: 'shop', category: 'boards', id: 'season_kickoff_pitch' }],
    },
    {
      challengeAchievementId: 'flair_pawn_storm_1',
      bonusPoints: 82,
      rewards: [{ kind: 'shop', category: 'highlightColors', id: 'season_pitch_glow' }],
    },
    {
      challengeAchievementId: 'flair_rook_highway_1',
      bonusPoints: 118,
      rewards: [
        { kind: 'shop', category: 'pieces', id: 'season_world_cup_kit' },
        { kind: 'lb_row_finish', presets: ['pitch_grass', 'stadium_lights'] },
      ],
    },
    {
      challengeAchievementId: 'flair_windmill_1',
      bonusPoints: 169,
      rewards: [{ kind: 'lb_frame', frame: 'cup_filament' }],
    },
    {
      challengeAchievementId: 'en_passant',
      bonusPoints: 242,
      rewards: [{ kind: 'lb_title', title: 'Cup striker' }],
    },
    {
      challengeAchievementId: 'flair_triple_promo_1',
      bonusPoints: 347,
      rewards: [
        { kind: 'lb_frame', frame: 'stadium_corona' },
        { kind: 'lb_row_finish', presets: ['victory_march', 'cup_anthem'] },
      ],
    },
    {
      challengeAchievementId: 'flair_queen_tour_1',
      bonusPoints: 496,
      rewards: [{ kind: 'shop', category: 'boards', id: 'season_championship_pitch' }],
    },
    {
      challengeAchievementId: 'underpromote',
      bonusPoints: 709,
      rewards: [{ kind: 'lb_title', title: 'Golden boot' }],
    },
    {
      challengeAchievementId: 'flair_phoenix_1',
      bonusPoints: 1015,
      rewards: [
        { kind: 'lb_frame', frame: 'world_cup_flare' },
        { kind: 'lb_title', title: 'World Cup ascendant' },
        { kind: 'lb_title', title: 'Trophy bearer' },
        { kind: 'lb_title', title: 'Final whistle finisher' },
        { kind: 'lb_suffix', suffix: '🏆' },
        { kind: 'shop', category: 'boards', id: 'season_world_cup_final' },
        { kind: 'shop', category: 'pieces', id: 'season_trophy_regalia' },
        { kind: 'shop', category: 'highlightColors', id: 'season_golden_goal' },
        { kind: 'shop', category: 'arrowColors', id: 'season_cup_arrow' },
        { kind: 'shop', category: 'themes', id: 'season_world_cup' },
        { kind: 'shop', category: 'checkmateEffects', id: 'season_cup_celebration' },
        { kind: 'shop', category: 'legalMoveDots', id: 'season_pitch_star' },
        { kind: 'lb_row_finish', presets: ['world_cup_finale'] },
      ],
    },
  ];

  /** @deprecated alias — May track */
  const SEASON_TRACK_MECHANICAL = SEASON_TRACK_MECHANICAL_05;

  /**
   * @param {string} [seasonId]
   * @returns {Array<Omit<ChessSeasonNode, 'challengeTitle'>>}
   */
  function getSeasonMechanicalRows(seasonId) {
    const key = getSeasonMechanicalMonthKey(seasonId || getChessSeasonIdUtc());
    if (key === '11') return SEASON_TRACK_MECHANICAL_11;
    if (key === '07') return SEASON_TRACK_MECHANICAL_07;
    if (key === '06') return SEASON_TRACK_MECHANICAL_06;
    return SEASON_TRACK_MECHANICAL_05;
  }

  /** Human-readable lines for the season track UI (keep in sync with mechanical track rewards). */
  const SEASON_REWARD_LABELS = Object.freeze({
    'boards:season_awakening': 'Board style · Emerald Awakening (season exclusive)',
    'highlightColors:season_glacier_glow': 'Square highlights · Glacier Glow (season exclusive)',
    'pieces:season_trail': 'Piece set · Forest Trail (season exclusive)',
    'boards:season_rift': 'Board style · Violet Rift (season exclusive)',
    'boards:season_canopy_crown': 'Board style · Canopy Crown (season exclusive)',
    'pieces:season_canopy_pieces': 'Piece set · Canopy Regalia (season exclusive)',
    'highlightColors:season_gilded_leaf': 'Square highlights · Gilded leaf (season exclusive)',
    'arrowColors:season_grove_arrow': 'Move arrows · Grove gold (season exclusive)',
    'themes:season_moonlit_canopy': 'Page theme · Moonlit canopy (season exclusive)',
    'checkmateEffects:season_finale_flare': 'Checkmate effect · Finale flare (season exclusive)',
    'legalMoveDots:season_emerald_star': 'Legal move markers · Emerald star (season exclusive)',
    'boards:season_golden_hour': 'Board style · Golden Hour — dawn honey light / indigo horizon (season exclusive)',
    'highlightColors:season_honey_glow': 'Square highlights · Honey Glow (season exclusive)',
    'pieces:season_solstice_pieces': 'Piece set · Solstice Regalia (season exclusive)',
    'boards:season_high_sun': 'Board style · High Sun — solar zenith / terracotta heat (season exclusive)',
    'boards:season_solstice_crown': 'Board style · Solstice Crown — ember dusk / starlit night (season exclusive)',
    'pieces:season_crown_regalia': 'Piece set · Crown Regalia (season exclusive)',
    'highlightColors:season_gilded_ray': 'Square highlights · Gilded ray (season exclusive)',
    'arrowColors:season_solar_arrow': 'Move arrows · Solar gold (season exclusive)',
    'themes:season_solstice_gold': 'Page theme · Solstice gold (season exclusive)',
    'checkmateEffects:season_solar_bloom': 'Checkmate effect · Solar bloom (season exclusive)',
    'legalMoveDots:season_solar_star': 'Legal move markers · Solar star (season exclusive)',
    'boards:season_kickoff_pitch': 'Board style · Kickoff Pitch — fresh turf stripes under stadium lights (season exclusive)',
    'highlightColors:season_pitch_glow': 'Square highlights · Pitch Glow (season exclusive)',
    'pieces:season_world_cup_kit': 'Piece set · World Cup Kit (season exclusive)',
    'boards:season_championship_pitch': 'Board style · Championship Pitch — deep green under floodlights (season exclusive)',
    'boards:season_world_cup_final': 'Board style · World Cup Final — trophy gold over midnight turf (season exclusive)',
    'pieces:season_trophy_regalia': 'Piece set · Trophy Regalia (season exclusive)',
    'highlightColors:season_golden_goal': 'Square highlights · Golden goal (season exclusive)',
    'arrowColors:season_cup_arrow': 'Move arrows · Cup gold (season exclusive)',
    'themes:season_world_cup': 'Page theme · World Cup (season exclusive)',
    'checkmateEffects:season_cup_celebration': 'Checkmate effect · Cup celebration (season exclusive)',
    'legalMoveDots:season_pitch_star': 'Legal move markers · Pitch star (season exclusive)',
    'boards:season_winter_frostline': 'Board style · Frostline — moonlit snow over midnight blue (season exclusive)',
    'highlightColors:season_winter_lantern_glow': 'Square highlights · Lantern glow (season exclusive)',
    'pieces:season_winter_snowsilhouette': 'Piece set · Snow Silhouette (season exclusive)',
    'boards:season_winter_aurora_path': 'Board style · Aurora Path — northern lights over polar night (season exclusive)',
    'boards:season_winter_hearth_crown': 'Board style · Hearth Crown — ember gold over frost and flame (season exclusive)',
    'pieces:season_winter_regalia': 'Piece set · Winter Regalia (season exclusive)',
    'highlightColors:season_winter_holly_gleam': 'Square highlights · Holly gleam (season exclusive)',
    'arrowColors:season_winter_starfall_arrow': 'Move arrows · Starfall (season exclusive)',
    'themes:season_winter_holiday': 'Page theme · Winter holiday hearth (season exclusive)',
    'checkmateEffects:season_winter_hearth_flare': 'Checkmate effect · Hearth flare (season exclusive)',
    'legalMoveDots:season_winter_snowflake_star': 'Legal move markers · Snowflake star (season exclusive)',
  });

  const SEASON_LB_FRAME_LABELS = Object.freeze({
    silver_lane: 'Silver Lane',
    amber_pulse: 'Amber Pulse',
    violet_arc: 'Violet Arc',
    gold_filament: 'Gold Filament',
    amber_corona: 'Amber Corona',
    solstice_flare: 'Solstice Flare',
    cup_filament: 'Cup Filament',
    stadium_corona: 'Stadium Corona',
    world_cup_flare: 'World Cup Flare',
  });

  /** Sample colors for season leaderboard row gradients — keep in sync with `js/chess_lb_row.js` LB_ROW_PRESETS. */
  const SEASON_LB_ROW_PRESET_SWATCHES = Object.freeze({
    emerald_glade: { label: 'Emerald glade', sampleHex: '#34d399' },
    glacier_ribbon: { label: 'Glacier ribbon', sampleHex: '#22d3ee' },
    violet_canopy: { label: 'Violet canopy', sampleHex: '#a78bfa' },
    moonlit_band: { label: 'Moonlit band', sampleHex: '#134e4a' },
    finale_aurora: { label: 'Finale aurora', sampleHex: '#7c3aed' },
    golden_meadow: { label: 'Golden meadow', sampleHex: '#fbbf24' },
    coral_ribbon: { label: 'Coral ribbon', sampleHex: '#fb923c' },
    dusk_ember: { label: 'Dusk ember', sampleHex: '#ea580c' },
    champagne_band: { label: 'Champagne band', sampleHex: '#fde68a' },
    solstice_finale: { label: 'Solstice finale', sampleHex: '#f59e0b' },
    pitch_grass: { label: 'Pitch grass', sampleHex: '#22c55e' },
    stadium_lights: { label: 'Stadium lights', sampleHex: '#fbbf24' },
    victory_march: { label: 'Victory march', sampleHex: '#16a34a' },
    cup_anthem: { label: 'Cup anthem', sampleHex: '#eab308' },
    world_cup_finale: { label: 'World Cup finale', sampleHex: '#ca8a04' },
  });

  /**
   * @param {{ kind: string, category?: string, id?: string, title?: string, frame?: string, prefix?: string, suffix?: string, presets?: string[] }} r
   * @returns {string}
   */
  function formatSeasonRewardLine(r) {
    if (!r || !r.kind) return '';
    if (r.kind === 'shop' && r.category && r.id) {
      const cat = String(r.category);
      const id = String(r.id);
      const key = cat + ':' + id;
      if (SEASON_REWARD_LABELS[key]) return SEASON_REWARD_LABELS[key];
      if (r.title && String(r.title).trim()) return String(r.title).trim();
      const pretty = id.replace(/_/g, ' ');
      if (cat === 'boards') return 'Board style · ' + pretty;
      if (cat === 'pieces') return 'Piece set · ' + pretty;
      if (cat === 'highlightColors') return 'Square highlights · ' + pretty;
      if (cat === 'arrowColors') return 'Move arrows · ' + pretty;
      if (cat === 'legalMoveDots') return 'Legal move markers · ' + pretty;
      if (cat === 'themes') return 'Page theme · ' + pretty;
      if (cat === 'checkmateEffects') return 'Checkmate effect · ' + pretty;
      if (cat === 'timeControls') return 'Time control · ' + pretty;
      return 'Unlock · ' + pretty;
    }
    if (r.kind === 'lb_frame' && r.frame) {
      const f = String(r.frame);
      if (SEASON_LB_FRAME_LABELS[f]) return 'Leaderboard frame · Season · ' + SEASON_LB_FRAME_LABELS[f];
      const raw = f.replace(/_/g, ' ');
      const label = raw.replace(/\b\w/g, (m) => m.toUpperCase());
      return 'Leaderboard frame · Season · ' + label;
    }
    if (r.kind === 'lb_title' && r.title) {
      const t = String(r.title).trim();
      if (t) return 'Leaderboard title · Season · “' + t + '”';
    }
    if (r.kind === 'lb_prefix' && r.prefix != null && String(r.prefix).trim() !== '') {
      return 'Leaderboard prefix · Season · ' + String(r.prefix);
    }
    if (r.kind === 'lb_suffix' && r.suffix != null && String(r.suffix).trim() !== '') {
      return 'Leaderboard suffix · Season · ' + String(r.suffix);
    }
    if (r.kind === 'lb_row_finish' && Array.isArray(r.presets) && r.presets.length) {
      const parts = [];
      for (let pi = 0; pi < r.presets.length; pi++) {
        const id = String(r.presets[pi] || '').trim();
        const sw = id && SEASON_LB_ROW_PRESET_SWATCHES[id];
        if (sw && sw.label) parts.push(sw.label);
      }
      if (parts.length)
        return 'Leaderboard row finishes · ' + parts.join(' · ') + ' (gradient row styles for the public leaderboard)';
    }
    return '';
  }

  /**
   * @param {string} presetId
   * @returns {{ label: string, sampleHex: string } | null}
   */
  function getSeasonLbRowPresetSwatch(presetId) {
    const id = String(presetId || '').trim();
    if (!id || !SEASON_LB_ROW_PRESET_SWATCHES[id]) return null;
    return SEASON_LB_ROW_PRESET_SWATCHES[id];
  }

  /** Shop spendable points to skip the challenge for that step (claim with buyWithPoints). Sync with worker. */
  const SEASON_STEP_BUYOUT_POINTS = Object.freeze([
    500, 1000, 3000, 5000, 8000, 12000, 15000, 18000, 20000, 30000,
  ]);

  function getSeasonStepBuyoutCost(stepIndex) {
    const i = Math.max(0, Math.floor(Number(stepIndex)) || 0);
    if (i < 0 || i >= SEASON_STEP_BUYOUT_POINTS.length) return 0;
    return Math.max(0, Math.floor(Number(SEASON_STEP_BUYOUT_POINTS[i])) || 0);
  }

  const DEFAULT_STEP_TITLES = [
    'First light — win your first game of the golden month',
    'Dawn victory — win a game before 10:00 AM Central Time',
    'Sunrise push — advance a pawn to e4',
    'Sun in the center — win after your pieces occupy d4, d5, e4, and e5 at least once each in the same game (not all at once)',
    'Golden hour — win a game between 6:00 PM and 7:59 PM Central Time',
    'Rolling heat — win a game where you gave 5+ consecutive checks (tracked automatically)',
    'Fortress at ten — castle on your 10th move',
    'Hidden crown — underpromote once (rook, bishop, or knight)',
    'Diagonal dusk — checkmate with a bishop',
    'Night crown — win a game after 9:00 PM Central Time',
  ];

  /**
   * Optional themed copy keyed by quarter anchor (`02` spring, `05` summer, `08` autumn, `11` winter).
   * @type {Record<string, SeasonThemeDef>}
   */
  const SEASON_THEMES_BY_UTC_MONTH = {
    '11': {
      key: 'winter_holiday',
      name: 'Winter holiday',
      tagline:
        'November through January — carols after dark, king’s-pawn gifts, hearthside castling, humble promotions, dawn victories, and crowning mates. Every step is counted from stats TrifangX records when you play.',
      stepTitles: [
        'Lighting the tree — win your first game of the winter season',
        'Carols at nine — win a game after 9:00 PM Central Time',
        'King’s pawn gift — advance a pawn to e4',
        'Hearth by ten — castle on your 10th move of a game',
        'Humble coronation — underpromote once (knight, bishop, or rook)',
        'Morning carol — win a game before 10:00 AM Central Time',
        'Blessing diagonal — checkmate with a bishop',
        'Five hearths — castle 5 times',
        'Knight’s delivery — checkmate with a knight',
        'Hearth crown — checkmate with a queen',
      ],
    },
    '02': {
      key: 'may_emerald_ascent',
      name: 'Emerald ascent',
      tagline:
        'Spring’s track is a forest climb: step in, develop knights and bishops like branches, spring a trap, trade tempest, fortify, grow new queens, then endgames from the treeline to the crown. Each step is a different skill — not a win ladder.',
      stepTitles: [
        'Cross the threshold — your first game of the spring season',
        'First leap — develop a knight to f3 (the path opens)',
        'Shaft of green light — slide a bishop to f4',
        'Secret forest path — one en passant capture',
        'Storm along the files — 10 captures made by your queen',
        'Harvest tempo — 50 total captures with any piece',
        'Ring the grove — castle 5 times',
        'Crown saplings — promote 5 pawns',
        'Strike from the spires — checkmate with a rook',
        'Canopy apex — checkmate with a queen',
      ],
    },
    '05': {
      key: 'june_solstice_gold',
      name: 'Solstice Gold',
      tagline:
        'Summer burns gold — win at dawn, hold the center, ride the heat, and crown the board from golden hour to night. Each step is a different skill — not a win ladder.',
      stepTitles: [
        'First light — win your first game of the summer season',
        'Dawn victory — win a game before 10:00 AM Central Time',
        'Sunrise push — advance a pawn to e4',
        'Sun in the center — win after your pieces occupy d4, d5, e4, and e5 at least once each in the same game (not all at once)',
        'Golden hour — win a game between 6:00 PM and 7:59 PM Central Time',
        'Rolling heat — win a game where you gave 5+ consecutive checks (tracked automatically)',
        'Fortress at ten — castle on your 10th move',
        'Hidden crown — underpromote once (rook, bishop, or knight)',
        'Diagonal dusk — checkmate with a bishop',
        'Night crown — win a game after 9:00 PM Central Time',
      ],
    },
    '08': {
      key: 'july_world_cup',
      name: 'World Cup',
      tagline:
        'Autumn is tournament season — field the full squad, flood the wings, press with checks, spring traps, score a hat trick, tour every corner, and rise from behind like a phoenix goal. Each step is a different skill — not a win ladder.',
      stepTitles: [
        'Opening whistle — win your first game of the autumn season',
        'Full squad — win after moving every piece type in one game',
        'Pawn wave — win with 5+ of your pawns reaching the 6th rank (as White) or 3rd rank (as Black) at least once each in the same game (they need not still be there at the end)',
        'Wing overlap — win a game where, after one of your rook moves, both your rooks stand on the 7th rank (as White) or 2nd rank (as Black) at the same time (not required at checkmate)',
        'Pressing surge — win a game where you gave 5+ consecutive checks (tracked automatically)',
        'Offside trap — one en passant capture',
        'Hat trick — win a game with 3+ pawn promotions in the same game',
        'Captain’s circuit — win with your queen visiting all four corner squares (a1, h1, a8, h8) at least once each in the same game',
        'Hidden sub — underpromote once to a rook, bishop, or knight (not a queen)',
        'Phoenix goal — win a game after losing your queen',
      ],
    },
  };

  /**
   * Whether a season id may appear on the public season page (hidden months until UTC month start).
   * @param {string} seasonId
   * @returns {boolean}
   */
  function isSeasonPubliclyVisible(seasonId) {
    const mm = utcMonthFromSeasonId(seasonId);
    if (!mm || !SEASON_MONTHS_HIDDEN_UNTIL_START.has(mm)) return true;
    const bounds = seasonBoundsUtc(seasonId);
    if (!bounds) return false;
    return Date.now() >= bounds.startMs;
  }

  /** Shop reward ids from a season mechanical track for a quarter anchor. */
  function seasonShopRewardIdsForMonth(mm) {
    const anchor = String(mm || '').padStart(2, '0');
    const sid = new Date().getUTCFullYear() + '-' + anchor;
    const rows = getSeasonMechanicalRows(sid);
    const ids = new Set();
    rows.forEach(function (row) {
      (row.rewards || []).forEach(function (r) {
        if (r && r.kind === 'shop' && r.id) ids.add(String(r.id));
      });
    });
    return ids;
  }

  /**
   * Whether a season-exclusive shop item may appear in the shop catalog.
   * June cosmetics stay hidden until UTC June 1; May cosmetics leave the catalog from June 1
   * onward unless the player already unlocked them.
   * @param {string} itemId
   * @param {boolean} [alreadyUnlocked]
   * @returns {boolean}
   */
  function isSeasonShopItemPubliclyVisible(itemId, alreadyUnlocked) {
    if (!itemId) return true;
    const id = String(itemId);
    const y = new Date().getUTCFullYear();
    for (let i = 0; i < SEASON_SHOP_CATALOG_MONTHS.length; i++) {
      const anchor = SEASON_SHOP_CATALOG_MONTHS[i];
      if (!seasonShopRewardIdsForMonth(anchor).has(id)) continue;
      const sid = y + '-' + anchor;
      const nextAnchor = SEASON_SHOP_CATALOG_MONTHS[i + 1];
      if (nextAnchor) {
        const nextY = anchor === '11' && nextAnchor === '02' ? y + 1 : y;
        const nextSid = nextY + '-' + nextAnchor;
        const nextBounds = seasonBoundsUtc(nextSid);
        if (nextBounds && Date.now() >= nextBounds.startMs) {
          return !!alreadyUnlocked;
        }
      }
      if (SEASON_MONTHS_HIDDEN_UNTIL_START.has(anchor)) {
        return isSeasonPubliclyVisible(sid);
      }
      return true;
    }
    return true;
  }

  /**
   * Upcoming hidden season id for admin preview (month before that season starts UTC).
   * @returns {string|null}
   */
  function getUpcomingPreviewSeasonId() {
    const d = new Date();
    const utcMon = d.getUTCMonth() + 1;
    const y = d.getUTCFullYear();
    if (utcMon === 10) {
      const sid = y + '-11';
      if (!isSeasonPubliclyVisible(sid)) return sid;
    }
    return null;
  }

  /** @deprecated alias — use getUpcomingPreviewSeasonId */
  function getUpcomingJunePreviewSeasonId() {
    return getUpcomingPreviewSeasonId();
  }

  /**
   * @param {string} seasonId
   * @returns {{ seasonId: string, nodes: ChessSeasonNode[], bounds: { startMs: number, endMs: number, label: string }, theme: null | { key: string, name: string, tagline: string } }}
   */
  function getChessSeasonTrack(seasonId) {
    const sid = seasonId || getChessSeasonIdUtc();
    const bounds = seasonBoundsUtc(sid) || seasonBoundsUtc(getChessSeasonIdUtc());
    const anchor = utcMonthFromSeasonId(sid);
    const theme =
      anchor && SEASON_THEMES_BY_UTC_MONTH[anchor] ? SEASON_THEMES_BY_UTC_MONTH[anchor] : null;
    const mechanical = getSeasonMechanicalRows(sid);
    const titles =
      theme && Array.isArray(theme.stepTitles) && theme.stepTitles.length === mechanical.length
        ? theme.stepTitles
        : DEFAULT_STEP_TITLES.slice(0, mechanical.length);
    const nodes = mechanical.map(function (row, i) {
      return {
        challengeAchievementId: row.challengeAchievementId,
        challengeTitle: titles[i] || DEFAULT_STEP_TITLES[i] || row.challengeAchievementId,
        bonusPoints: row.bonusPoints,
        rewards: row.rewards,
      };
    });
    const themeOut = theme
      ? { key: theme.key, name: theme.name, tagline: theme.tagline }
      : null;
    return { seasonId: sid, nodes, bounds, theme: themeOut };
  }

  const LB_FRAMES = new Set([
    'silver_lane',
    'amber_pulse',
    'violet_arc',
    'gold_filament',
    'amber_corona',
    'solstice_flare',
    'cup_filament',
    'stadium_corona',
    'world_cup_flare',
  ]);

  /** Achievement ids in monthly season track order for a given season id. */
  function getSeasonTrackAchievementIds(seasonId) {
    return getSeasonMechanicalRows(seasonId || getChessSeasonIdUtc()).map(function (row) {
      return row.challengeAchievementId;
    });
  }

  /** Keys stored on `seasonTrack.earnBaseline` after each claim (superset for all months). */
  function emptySeasonEarnBaseline() {
    return {
      games: 0,
      wins: 0,
      castlingMoves: 0,
      promotions: 0,
      capturedRooks: 0,
      checkmateWithQueen: 0,
      knightToF3: 0,
      bishopToF4: 0,
      enPassants: 0,
      capturesByQueen: 0,
      totalCaptures: 0,
      checkmateWithRook: 0,
      pawnToE4: 0,
      castledOnMove10: 0,
      underpromotions: 0,
      checkmateWithBishop: 0,
      creativeCenterDominationWins: 0,
      creativeWindmillWins: 0,
      winsFinishedBefore10amCt: 0,
      winsFinishedGoldenHourCt: 0,
      winsFinishedAfter9pmCt: 0,
      creativeFullOrchestraWins: 0,
      creativeRookLadderWins: 0,
      creativeForkFeastWins: 0,
      checkmateWithKnight: 0,
      creativeQueenDownWins: 0,
      creativePawnStormWins: 0,
      creativeSacrificeSymphonyWins: 0,
      creativeRookBatteryWins: 0,
      creativeQueenGrandTourWins: 0,
      creativeTriplePromotionWins: 0,
      creativePinGalleryWins: 0,
      creativeSkewerSalonWins: 0,
      creativeKingMarathonWins: 0,
      creativeZwischenzugWins: 0,
      comebackWins: 0,
    };
  }

  /** Fresh track for the current UTC month (e.g. after full achievement reset). */
  function createFreshSeasonTrackState() {
    const seasonId = getChessSeasonIdUtc();
    return {
      seasonId: seasonId,
      nodesCompleted: 0,
      lbFlair: { frame: null, title: null, prefix: '', suffix: '' },
      lbFlairUnlocked: { frames: [], titles: [], prefixes: [], suffixes: [] },
      earnBaseline: emptySeasonEarnBaseline(),
    };
  }

  /**
   * Roll a stale save forward to the live UTC month (June+ no longer reads May progress).
   * Admin June preview during May UTC is preserved until June 1.
   * @param {object|null|undefined} trackState
   * @param {{ earnBaseline?: object }} [opts]
   * @returns {{ changed: boolean, track: object, dropSavedPreview: boolean }}
   */
  function ensureSeasonTrackForCurrentMonth(trackState, opts) {
    const utcSid = getChessSeasonIdUtc();
    const previewSid = getUpcomingPreviewSeasonId();
    const st = trackState && typeof trackState === 'object' ? trackState : {};
    const stSid = String(st.seasonId || '').trim();
    const dropSavedPreview = !previewSid;

    if (previewSid && stSid === previewSid) {
      return { changed: false, track: st, dropSavedPreview: false };
    }
    if (stSid === utcSid) {
      return { changed: false, track: st, dropSavedPreview };
    }

    const prevOwned =
      st.lbFlairUnlocked && typeof st.lbFlairUnlocked === 'object' ? st.lbFlairUnlocked : {};
    const prevFlair = st.lbFlair && typeof st.lbFlair === 'object' ? st.lbFlair : {};
    const baseline =
      opts && opts.earnBaseline && typeof opts.earnBaseline === 'object'
        ? opts.earnBaseline
        : emptySeasonEarnBaseline();

    if (!/^\d{4}-\d{2}$/.test(stSid) || compareSeasonIds(stSid, utcSid) < 0) {
      return {
        changed: true,
        track: {
          seasonId: utcSid,
          nodesCompleted: 0,
          lbFlair: {
            frame: prevFlair.frame != null ? prevFlair.frame : null,
            title: prevFlair.title != null ? prevFlair.title : null,
            prefix: prevFlair.prefix != null ? String(prevFlair.prefix) : '',
            suffix: prevFlair.suffix != null ? String(prevFlair.suffix) : '',
          },
          lbFlairUnlocked: {
            frames: Array.isArray(prevOwned.frames) ? prevOwned.frames.slice() : [],
            titles: Array.isArray(prevOwned.titles) ? prevOwned.titles.slice() : [],
            prefixes: Array.isArray(prevOwned.prefixes) ? prevOwned.prefixes.slice() : [],
            suffixes: Array.isArray(prevOwned.suffixes) ? prevOwned.suffixes.slice() : [],
          },
          earnBaseline: baseline,
        },
        dropSavedPreview: true,
      };
    }

    return { changed: false, track: st, dropSavedPreview };
  }

  /**
   * Same mechanical targets as achievements / worker claim validation.
   * @type {Record<string, { type: 'games' | 'wins' | 'lifetime', target: number, key?: string }>}
   */
  const SEASON_STEP_EARN_RULES = Object.freeze({
    first_game: { type: 'games', target: 1 },
    knight_to_f3: { type: 'lifetime', key: 'knightToF3', target: 1 },
    bishop_to_f4: { type: 'lifetime', key: 'bishopToF4', target: 1 },
    en_passant: { type: 'lifetime', key: 'enPassants', target: 1 },
    queen_capturer: { type: 'lifetime', key: 'capturesByQueen', target: 10 },
    capture_master: { type: 'lifetime', key: 'totalCaptures', target: 50 },
    castler: { type: 'lifetime', key: 'castlingMoves', target: 5 },
    promoter: { type: 'lifetime', key: 'promotions', target: 5 },
    checkmate_rook: { type: 'lifetime', key: 'checkmateWithRook', target: 1 },
    checkmate_queen: { type: 'lifetime', key: 'checkmateWithQueen', target: 1 },
    first_win: { type: 'wins', target: 1 },
    solstice_win_dawn_ct: { type: 'lifetime', key: 'winsFinishedBefore10amCt', target: 1 },
    pawn_to_e4: { type: 'lifetime', key: 'pawnToE4', target: 1 },
    flair_center_1: { type: 'lifetime', key: 'creativeCenterDominationWins', target: 1 },
    solstice_win_golden_hour_ct: { type: 'lifetime', key: 'winsFinishedGoldenHourCt', target: 1 },
    flair_windmill_1: { type: 'lifetime', key: 'creativeWindmillWins', target: 1 },
    castle_on_10: { type: 'lifetime', key: 'castledOnMove10', target: 1 },
    underpromote: { type: 'lifetime', key: 'underpromotions', target: 1 },
    checkmate_bishop: { type: 'lifetime', key: 'checkmateWithBishop', target: 1 },
    solstice_win_night_ct: { type: 'lifetime', key: 'winsFinishedAfter9pmCt', target: 1 },
    flair_orchestra_1: { type: 'lifetime', key: 'creativeFullOrchestraWins', target: 1 },
    flair_rook_highway_1: { type: 'lifetime', key: 'creativeRookLadderWins', target: 1 },
    flair_forks_1: { type: 'lifetime', key: 'creativeForkFeastWins', target: 1 },
    checkmate_knight: { type: 'lifetime', key: 'checkmateWithKnight', target: 1 },
    flair_phoenix_1: { type: 'lifetime', key: 'creativeQueenDownWins', target: 1 },
    flair_pawn_storm_1: { type: 'lifetime', key: 'creativePawnStormWins', target: 1 },
    flair_sacrifice_1: { type: 'lifetime', key: 'creativeSacrificeSymphonyWins', target: 1 },
    flair_battery_1: { type: 'lifetime', key: 'creativeRookBatteryWins', target: 1 },
    flair_queen_tour_1: { type: 'lifetime', key: 'creativeQueenGrandTourWins', target: 1 },
    flair_triple_promo_1: { type: 'lifetime', key: 'creativeTriplePromotionWins', target: 1 },
    flair_pins_1: { type: 'lifetime', key: 'creativePinGalleryWins', target: 1 },
    flair_skewer_1: { type: 'lifetime', key: 'creativeSkewerSalonWins', target: 1 },
    flair_king_hike_1: { type: 'lifetime', key: 'creativeKingMarathonWins', target: 1 },
    flair_zwischen_1: { type: 'lifetime', key: 'creativeZwischenzugWins', target: 1 },
    flair_comeback_1: { type: 'lifetime', key: 'comebackWins', target: 1 },
  });

  function readEarnBaselineField(baseline, key) {
    if (!baseline || typeof baseline !== 'object') return 0;
    return Math.max(0, Number(baseline[key]) || 0);
  }

  /** Merge stored baseline with zero defaults so missing keys do not behave like “count full career”. */
  function coalesceEarnBaseline(stored) {
    const base = emptySeasonEarnBaseline();
    if (!stored || typeof stored !== 'object') return base;
    const out = { ...base };
    Object.keys(stored).forEach(function (k) {
      out[k] = Math.max(0, Number(stored[k]) || 0);
    });
    return out;
  }

  /**
   * Whether cloud chess stats since `earnBaseline` satisfy this track step (independent of global achievement flags).
   * @param {object} chess - `games.chess` payload (stats.playerStats, stats.lifetimeStats).
   * @param {object} baseline - `seasonTrack.earnBaseline` or {}.
   * @param {string} achId
   */
  function seasonChallengeMetSinceBaseline(chess, baseline, achId) {
    const id = String(achId || '');
    const rule = SEASON_STEP_EARN_RULES[id];
    if (!rule) return false;
    baseline = coalesceEarnBaseline(baseline);
    const ps =
      chess && chess.stats && chess.stats.playerStats && typeof chess.stats.playerStats === 'object'
        ? chess.stats.playerStats
        : {};
    const w = Math.max(0, Number(ps.wins) || 0);
    const l = Math.max(0, Number(ps.losses) || 0);
    const dr = Math.max(0, Number(ps.draws) || 0);
    const games = w + l + dr;
    const lt =
      chess && chess.stats && chess.stats.lifetimeStats && typeof chess.stats.lifetimeStats === 'object'
        ? chess.stats.lifetimeStats
        : {};
    const g = (k) => Math.max(0, Number(lt[k]) || 0);
    if (rule.type === 'games') {
      return games - readEarnBaselineField(baseline, 'games') >= rule.target;
    }
    if (rule.type === 'wins') {
      return w - readEarnBaselineField(baseline, 'wins') >= rule.target;
    }
    if (rule.type === 'lifetime') {
      return g(rule.key) - readEarnBaselineField(baseline, rule.key) >= rule.target;
    }
    return false;
  }

  global.ChessSeasons = {
    GUIDELINES: GUIDELINES,
    getChessSeasonIdUtc: getChessSeasonIdUtc,
    parseSeasonQuarter: parseSeasonQuarter,
    utcMonthFromSeasonId: utcMonthFromSeasonId,
    seasonBoundsUtc: seasonBoundsUtc,
    SEASON_QUARTER_ANCHORS: SEASON_QUARTER_ANCHORS,
    getChessSeasonTrack: getChessSeasonTrack,
    getSeasonMechanicalRows: getSeasonMechanicalRows,
    isSeasonPubliclyVisible: isSeasonPubliclyVisible,
    isSeasonShopItemPubliclyVisible: isSeasonShopItemPubliclyVisible,
    getUpcomingPreviewSeasonId: getUpcomingPreviewSeasonId,
    getUpcomingJunePreviewSeasonId: getUpcomingJunePreviewSeasonId,
    compareSeasonIds: compareSeasonIds,
    ensureSeasonTrackForCurrentMonth: ensureSeasonTrackForCurrentMonth,
    emptySeasonEarnBaseline: emptySeasonEarnBaseline,
    LB_FRAMES: LB_FRAMES,
    SEASON_STEP_EARN_RULES: SEASON_STEP_EARN_RULES,
    getSeasonTrackAchievementIds: getSeasonTrackAchievementIds,
    getSeasonStepBuyoutCost: getSeasonStepBuyoutCost,
    createFreshSeasonTrackState: createFreshSeasonTrackState,
    formatSeasonRewardLine: formatSeasonRewardLine,
    getSeasonLbRowPresetSwatch: getSeasonLbRowPresetSwatch,
    seasonChallengeMetSinceBaseline: seasonChallengeMetSinceBaseline,
    coalesceEarnBaseline: coalesceEarnBaseline,
  };
})(typeof window !== 'undefined' ? window : globalThis);
