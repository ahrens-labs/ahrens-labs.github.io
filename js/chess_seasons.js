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
 *      the achievement in the app first.
 *    - Progress is stored in cloud chess as `seasonTrack.nodesCompleted` (integer: how many steps
 *      have been fully claimed). Next step index = that value. Gating is sequential.
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
      challengeAchievementId: 'first_win',
      bonusPoints: 22,
      rewards: [{ kind: 'shop', category: 'boards', id: 'season_awakening' }],
    },
    {
      challengeAchievementId: 'three_wins',
      bonusPoints: 32,
      rewards: [{ kind: 'shop', category: 'highlightColors', id: 'season_glacier_glow' }],
    },
    {
      challengeAchievementId: 'five_wins',
      bonusPoints: 48,
      rewards: [{ kind: 'shop', category: 'pieces', id: 'season_trail' }],
    },
    {
      challengeAchievementId: 'castler',
      bonusPoints: 55,
      rewards: [{ kind: 'lb_frame', frame: 'silver_lane' }],
    },
    {
      challengeAchievementId: 'ten_wins',
      bonusPoints: 72,
      rewards: [{ kind: 'lb_title', title: 'Trailblazer' }],
    },
    {
      challengeAchievementId: 'promoter',
      bonusPoints: 65,
      rewards: [{ kind: 'lb_frame', frame: 'amber_pulse' }],
    },
    {
      challengeAchievementId: 'rook_hunter_10',
      bonusPoints: 95,
      rewards: [{ kind: 'shop', category: 'boards', id: 'season_rift' }],
    },
    {
      challengeAchievementId: 'fifteen_wins',
      bonusPoints: 120,
      rewards: [{ kind: 'lb_frame', frame: 'violet_arc' }],
    },
    {
      challengeAchievementId: 'checkmate_queen',
      bonusPoints: 220,
      rewards: [
        { kind: 'lb_title', title: 'Finisher' },
        { kind: 'lb_suffix', suffix: '✦' },
      ],
    },
  ];

  const DEFAULT_STEP_TITLES = [
    'Play your first game',
    'Win your first game',
    'Win 3 games',
    'Win 5 games',
    'Castle 5 times (lifetime)',
    'Win 10 games',
    'Promote a pawn 5 times',
    'Capture 10 enemy rooks',
    'Win 15 games',
    'Checkmate with a queen',
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
        'May is for opening well: take space on the calendar, develop habits (and your king), then finish with a clear crown strike. Same rules as the core track — this is the month’s story on top.',
      stepTitles: [
        'Step onto the field — play your first game of the month’s climb',
        'First light — win a game',
        'Triple sprout — three wins',
        'Deep roots — five wins',
        'Raise the walls — castle five times (lifetime)',
        'Wide canopy — ten wins',
        'Lift toward the sun — promote pawns five times',
        'Clear the old growth — capture ten enemy rooks',
        'Full grove — fifteen wins',
        'Crown strike — checkmate with a queen',
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
    createFreshSeasonTrackState: createFreshSeasonTrackState,
  };
})(typeof window !== 'undefined' ? window : globalThis);
