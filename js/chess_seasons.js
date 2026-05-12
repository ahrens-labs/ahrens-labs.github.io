/**
 * TrifangX monthly season track (client + worker merge for `seasonTrack` / `seasonBonusPoints`).
 *
 * =============================================================================
 * SEASON DESIGN GUIDELINES (apply every month; update this block when rules change)
 * =============================================================================
 *
 * 1) Calendar
 *    - Season id is UTC: `YYYY-MM` (see `getChessSeasonIdUtc`). All players share the same window.
 *    - Start: first instant of the month UTC. End: last instant before next month UTC (`seasonBoundsUtc`).
 *
 * 2) Track shape
 *    - One linear track of steps (currently 10). Each step = exactly one existing achievement id
 *      (`challengeAchievementId`) from `trifangx_chess_app.js` — do not invent ids here without adding
 *      the achievement in the app first. Steps can mix wins, tactics, material, and checkmates.
 *    - Progress is stored in cloud chess as `seasonTrack.nodesCompleted` (integer: how many steps
 *      have been fully claimed). Next step index = that value. Gating is sequential.
 *    - `seasonTrack.earnBaseline` (games, wins, castlingMoves, …) is updated on each successful claim
 *      so the *next* step only counts stats gained after prior steps were claimed (not retroactive).
 *    - Optional buyout: each step has a large career-points price (`getSeasonStepBuyoutCost`). Paying on
 *      claim skips the achievement check only — it does not unlock the achievement in cloud; rewards
 *      and season bonus still apply. Must match worker `SEASON_STEP_BUYOUT_POINTS`.
 *
 * 3) Bonus points
 *    - Each step awards `bonusPoints` when claimed (cumulative in `seasonBonusPoints`). They count
 *      toward public leaderboard career “points” column on the worker (achievement points + bonus).
 *    - Tune curve: early steps cheap encouragement; mid ramp; finale largest. Keep monthly total sane.
 *
 * 4) Rewards
 *    - `shop` rewards use ids that are NOT sold in the regular shop; unlock goes into `shopUnlocks`
 *      like any other cosmetic. Add piece URLs / board CSS / highlight `colorMap` in the engine when
 *      adding a new id.
 *    - Leaderboard flair: `lb_frame` (allowlist in worker `sanitizeChessLbFlair`), `lb_title`,
 *      `lb_prefix`, `lb_suffix`. Keep strings short; worker sanitizes length / charset.
 *
 * 5) Theming (optional per month)
 *    - Keys in `SEASON_THEMES_BY_UTC_MONTH` are two-digit UTC month strings `'01'` … `'12'`.
 *    - If present, `stepTitles` MUST have the same length as `SEASON_TRACK_MECHANICAL` (copy only;
 *      mechanics stay in the mechanical template). Flavor text must not contradict the real rule.
 *    - Months without an entry use `DEFAULT_STEP_TITLES`.
 *
 * 6) Adding June (or any new month)
 *    - Copy the May block under `SEASON_THEMES_BY_UTC_MONTH['06']`, replace key/name/tagline/stepTitles.
 *    - If mechanics change (different achievements or rewards), edit `SEASON_TRACK_MECHANICAL` or
 *      introduce a month-keyed mechanical table (not needed until you intentionally fork the ladder).
 *    - Deploy worker + static site together when changing ids that the worker must recognize.
 *    - Account dashboard can equip `seasonTrack.lbFlair` via POST /api/chess/lb-flair (unlocked ids only).
 *
 * =============================================================================
 */
(function (global) {
  'use strict';

  /** @typedef {{ challengeAchievementId: string, challengeTitle: string, bonusPoints: number, rewards: Array<{ kind: string, category?: string, id?: string, title?: string, frame?: string, prefix?: string, suffix?: string }> }} ChessSeasonNode */

  /** @typedef {{ key: string, name: string, tagline: string, stepTitles: string[] }} SeasonThemeDef */

  const GUIDELINES = Object.freeze([
    'UTC month boundaries; shared season id YYYY-MM.',
    'Linear gated steps; each step = one real TrifangX achievement id.',
    'Bonus points on claim; leaderboard uses achievement points + season bonus.',
    'Exclusive cosmetics via shopUnlocks ids; flair allowlisted on the worker.',
    'Optional theme: SEASON_THEMES_BY_UTC_MONTH[MM].stepTitles same length as mechanical track.',
    'Buyout: SEASON_STEP_BUYOUT_POINTS must match worker; spend career points to skip achievement only.',
  ]);

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function getChessSeasonIdUtc(d) {
    const x = d || new Date();
    return x.getUTCFullYear() + '-' + pad2(x.getUTCMonth() + 1);
  }

  function utcMonthFromSeasonId(seasonId) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(seasonId || '').trim());
    return m ? m[2] : null;
  }

  function seasonBoundsUtc(seasonId) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(seasonId || '').trim());
    if (!m) return null;
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    if (mo < 0 || mo > 11) return null;
    const startMs = Date.UTC(y, mo, 1, 0, 0, 0, 0);
    const endMs = Date.UTC(y, mo + 1, 1, 0, 0, 0, 0) - 1;
    return { startMs, endMs, label: m[1] + ' · ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mo] };
  }

  /**
   * Mechanical ladder (achievement ids + rewards + bonus). Order is the product truth.
   * @type {Array<Omit<ChessSeasonNode, 'challengeTitle'>>}
   */
  const SEASON_TRACK_MECHANICAL = [
    { challengeAchievementId: 'first_game', bonusPoints: 12, rewards: [{ kind: 'lb_prefix', prefix: '♟' }] },
    {
      challengeAchievementId: 'knight_to_f3',
      bonusPoints: 16,
      rewards: [{ kind: 'shop', category: 'boards', id: 'season_awakening' }],
    },
    {
      challengeAchievementId: 'bishop_to_f4',
      bonusPoints: 18,
      rewards: [{ kind: 'shop', category: 'highlightColors', id: 'season_glacier_glow' }],
    },
    {
      challengeAchievementId: 'en_passant',
      bonusPoints: 28,
      rewards: [{ kind: 'shop', category: 'pieces', id: 'season_trail' }],
    },
    {
      challengeAchievementId: 'queen_capturer',
      bonusPoints: 42,
      rewards: [{ kind: 'lb_frame', frame: 'silver_lane' }],
    },
    {
      challengeAchievementId: 'capture_master',
      bonusPoints: 52,
      rewards: [{ kind: 'lb_title', title: 'Grove hunter' }],
    },
    {
      challengeAchievementId: 'castler',
      bonusPoints: 58,
      rewards: [{ kind: 'lb_frame', frame: 'amber_pulse' }],
    },
    {
      challengeAchievementId: 'promoter',
      bonusPoints: 62,
      rewards: [{ kind: 'shop', category: 'boards', id: 'season_rift' }],
    },
    {
      challengeAchievementId: 'checkmate_rook',
      bonusPoints: 130,
      rewards: [{ kind: 'lb_title', title: 'Spire sniper' }],
    },
    {
      challengeAchievementId: 'checkmate_queen',
      bonusPoints: 210,
      rewards: [
        { kind: 'lb_frame', frame: 'violet_arc' },
        { kind: 'lb_title', title: 'Ascendant' },
        { kind: 'lb_title', title: 'Emerald crown' },
        { kind: 'lb_title', title: 'Finisher' },
        { kind: 'lb_suffix', suffix: '✦' },
        { kind: 'shop', category: 'boards', id: 'royal' },
        { kind: 'shop', category: 'pieces', id: 'tatiana' },
        { kind: 'shop', category: 'highlightColors', id: 'gold' },
        { kind: 'shop', category: 'arrowColors', id: 'gold' },
        { kind: 'shop', category: 'themes', id: 'forest' },
        { kind: 'shop', category: 'checkmateEffects', id: 'fireworks' },
        { kind: 'shop', category: 'legalMoveDots', id: 'gold-star' },
      ],
    },
  ];

  /** Career points to skip the challenge for that step (claim with buyWithPoints). Sync with worker. */
  const SEASON_STEP_BUYOUT_POINTS = Object.freeze([
    500, 9000, 15000, 26000, 36000, 47000, 42000, 55000, 78000, 125000,
  ]);

  function getSeasonStepBuyoutCost(stepIndex) {
    const i = Math.max(0, Math.floor(Number(stepIndex)) || 0);
    if (i < 0 || i >= SEASON_STEP_BUYOUT_POINTS.length) return 0;
    return Math.max(0, Math.floor(Number(SEASON_STEP_BUYOUT_POINTS[i])) || 0);
  }

  const DEFAULT_STEP_TITLES = [
    'Play your first game of the month',
    'Develop a knight to f3 (classic spring square)',
    'Slide a bishop to f4 (diagonal light)',
    'Land an en passant capture (path between the pawns)',
    'Make 10 captures with your queen as the moving piece',
    'Make 50 captures total with any of your pieces',
    'Castle 5 times (lifetime) — tuck the king into cover',
    'Promote 5 pawns (lifetime) — new queens from the soil',
    'Deliver checkmate with a rook',
    'Deliver checkmate with a queen — canopy apex',
  ];

  /**
   * Optional themed copy keyed by UTC month `MM`. June (`06`): add when ready with Matt.
   * @type {Record<string, SeasonThemeDef>}
   */
  const SEASON_THEMES_BY_UTC_MONTH = {
    '05': {
      key: 'may_emerald_ascent',
      name: 'Emerald ascent',
      tagline:
        'May’s track is a forest climb: step in, develop knights and bishops like branches, spring a trap, trade tempest, fortify, grow new queens, then endgames from the treeline to the crown. Each step is a different skill — not a win ladder.',
      stepTitles: [
        'Cross the threshold — your first game in the emerald month',
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
    // '06': { key: '', name: '', tagline: '', stepTitles: [ ...10 ] },
  };

  /**
   * @param {string} seasonId
   * @returns {{ seasonId: string, nodes: ChessSeasonNode[], bounds: { startMs: number, endMs: number, label: string }, theme: null | { key: string, name: string, tagline: string } }}
   */
  function getChessSeasonTrack(seasonId) {
    const sid = seasonId || getChessSeasonIdUtc();
    const bounds = seasonBoundsUtc(sid) || seasonBoundsUtc(getChessSeasonIdUtc());
    const mm = utcMonthFromSeasonId(sid);
    const theme = mm && SEASON_THEMES_BY_UTC_MONTH[mm] ? SEASON_THEMES_BY_UTC_MONTH[mm] : null;
    const titles =
      theme && Array.isArray(theme.stepTitles) && theme.stepTitles.length === SEASON_TRACK_MECHANICAL.length
        ? theme.stepTitles
        : DEFAULT_STEP_TITLES;
    const nodes = SEASON_TRACK_MECHANICAL.map(function (row, i) {
      return {
        challengeAchievementId: row.challengeAchievementId,
        challengeTitle: titles[i] || DEFAULT_STEP_TITLES[i],
        bonusPoints: row.bonusPoints,
        rewards: row.rewards,
      };
    });
    const themeOut = theme
      ? { key: theme.key, name: theme.name, tagline: theme.tagline }
      : null;
    return { seasonId: sid, nodes, bounds, theme: themeOut };
  }

  const LB_FRAMES = new Set(['silver_lane', 'amber_pulse', 'violet_arc']);

  /** Achievement ids in monthly season track order (same as `SEASON_TRACK_MECHANICAL`). */
  function getSeasonTrackAchievementIds() {
    return SEASON_TRACK_MECHANICAL.map(function (row) {
      return row.challengeAchievementId;
    });
  }

  /** Fresh track for the current UTC month (e.g. after full achievement reset). */
  function createFreshSeasonTrackState() {
    const seasonId = getChessSeasonIdUtc();
    return {
      seasonId: seasonId,
      nodesCompleted: 0,
      lbFlair: { frame: null, title: null, prefix: '', suffix: '' },
      lbFlairUnlocked: { frames: [], titles: [], prefixes: [], suffixes: [] },
      earnBaseline: {
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
      },
    };
  }

  global.ChessSeasons = {
    GUIDELINES: GUIDELINES,
    getChessSeasonIdUtc: getChessSeasonIdUtc,
    utcMonthFromSeasonId: utcMonthFromSeasonId,
    seasonBoundsUtc: seasonBoundsUtc,
    getChessSeasonTrack: getChessSeasonTrack,
    LB_FRAMES: LB_FRAMES,
    getSeasonTrackAchievementIds: getSeasonTrackAchievementIds,
    getSeasonStepBuyoutCost: getSeasonStepBuyoutCost,
    createFreshSeasonTrackState: createFreshSeasonTrackState,
  };
})(typeof window !== 'undefined' ? window : globalThis);
