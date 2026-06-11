/**
 * Shared TrifangX leaderboard row: row tint + flair HTML + stat cell (same logic as chess-leaderboard.html).
 */
(function (global) {
  'use strict';

  function escapeLbHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeLbHex(hex) {
    if (hex == null || typeof hex !== 'string') return null;
    var s = hex.trim();
    var m6 = /^#([0-9a-f]{6})$/i.exec(s);
    if (m6) return '#' + m6[1].toLowerCase();
    var m3 = /^#([0-9a-f]{3})$/i.exec(s);
    if (!m3) return null;
    var a = m3[1];
    return '#' + a[0] + a[0] + a[1] + a[1] + a[2] + a[2];
  }

  function hexToRgb(hex) {
    var h = (hex || '').replace(/^#/, '');
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    if (h.length !== 6 || !/^[0-9a-f]+$/i.test(h)) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  function mixRgb(a, b, t) {
    return {
      r: Math.round(a.r + (b.r - a.r) * t),
      g: Math.round(a.g + (b.g - a.g) * t),
      b: Math.round(a.b + (b.b - a.b) * t),
    };
  }

  function rgbToHex(rgb) {
    function h(c) {
      var x = Math.max(0, Math.min(255, c)).toString(16);
      return x.length === 1 ? '0' + x : x;
    }
    return '#' + h(rgb.r) + h(rgb.g) + h(rgb.b);
  }

  function relLum(rgb) {
    function f(c) {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    var R = f(rgb.r),
      G = f(rgb.g),
      B = f(rgb.b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }

  /** Keep in sync with `workers/src/index.js` — `LB_ROW_BASIC_HEXES`, shop solids, and `LB_ROW_PRESET_MIN_NODES`. */
  var LB_ROW_BASIC_HEXES = Object.freeze([
    '#ffffff',
    '#f8fafc',
    '#f1f5f9',
    '#e2e8f0',
    '#dbeafe',
    '#fef3c7',
    '#dcfce7',
    '#94a3b8',
  ]);

  var LB_ROW_SHOP_CUSTOM_HEX_ID = 'lb_row_shop_custom_hex';

  /** @type {ReadonlyArray<{ id: string, hex: string, label: string }>} */
  var LB_ROW_SHOP_SOLIDS = Object.freeze([
    { id: 'lb_row_shop_rose', hex: '#fb7185', label: 'Rose' },
    { id: 'lb_row_shop_coral_fire', hex: '#f97316', label: 'Ember' },
    { id: 'lb_row_shop_goldenrod', hex: '#ca8a04', label: 'Amber' },
    { id: 'lb_row_shop_forest_deep', hex: '#166534', label: 'Forest' },
    { id: 'lb_row_shop_teal_river', hex: '#0d9488', label: 'Teal' },
    { id: 'lb_row_shop_sapphire', hex: '#1d4ed8', label: 'Sapphire' },
    { id: 'lb_row_shop_amethyst', hex: '#7c3aed', label: 'Amethyst' },
    { id: 'lb_row_shop_magenta_pop', hex: '#c026d3', label: 'Magenta' },
  ]);

  var LB_ROW_SHOP_ID_TO_HEX = (function () {
    var o = {};
    for (var i = 0; i < LB_ROW_SHOP_SOLIDS.length; i++) {
      o[LB_ROW_SHOP_SOLIDS[i].id] = LB_ROW_SHOP_SOLIDS[i].hex;
    }
    return Object.freeze(o);
  })();

  var LB_ROW_BASIC_HEX_SET = (function () {
    var o = {};
    for (var i = 0; i < LB_ROW_BASIC_HEXES.length; i++) o[LB_ROW_BASIC_HEXES[i]] = 1;
    return o;
  })();

  function leaderboardRowShopIdsFromChess(chess) {
    if (!chess || typeof chess !== 'object') return [];
    var shop = chess.shopUnlocks && typeof chess.shopUnlocks === 'object' ? chess.shopUnlocks : {};
    var arr = shop.leaderboardRowColors;
    if (!Array.isArray(arr)) return [];
    var seen = {};
    var out = [];
    for (var j = 0; j < arr.length; j++) {
      var id = String(arr[j] || '').trim();
      if (!id || seen[id]) continue;
      seen[id] = 1;
      out.push(id);
    }
    return out;
  }

  function isLbRowShopCustomHexUnlocked(chess) {
    var ids = leaderboardRowShopIdsFromChess(chess);
    for (var i = 0; i < ids.length; i++) {
      if (ids[i] === LB_ROW_SHOP_CUSTOM_HEX_ID) return true;
    }
    return false;
  }

  function isLbRowHexAllowedForUser(hex, chess) {
    if (!hex) return false;
    if (LB_ROW_BASIC_HEX_SET[hex]) return true;
    var ids = leaderboardRowShopIdsFromChess(chess);
    for (var c = 0; c < ids.length; c++) {
      if (ids[c] === LB_ROW_SHOP_CUSTOM_HEX_ID) return true;
    }
    for (var k = 0; k < ids.length; k++) {
      if (LB_ROW_SHOP_ID_TO_HEX[ids[k]] === hex) return true;
    }
    return false;
  }

  var LB_ROW_PRESETS = Object.freeze({
    emerald_glade: {
      label: 'Emerald glade',
      minNodes: 4,
      bg: 'linear-gradient(125deg, #ecfdf5 0%, #a7f3d0 38%, #34d399 100%)',
      bgHover: 'linear-gradient(125deg, #d1fae5 0%, #6ee7b7 40%, #10b981 100%)',
      border: 'rgba(16, 185, 129, 0.45)',
      sampleHex: '#34d399',
      fgPalette: {
        fg: '#0f172a',
        rankFg: '#334155',
        statMuted: '#475569',
        statPos: '#047857',
        statNeg: '#b91c1c',
      },
    },
    glacier_ribbon: {
      label: 'Glacier ribbon',
      minNodes: 4,
      bg: 'linear-gradient(120deg, #ecfeff 0%, #a5f3fc 42%, #22d3ee 100%)',
      bgHover: 'linear-gradient(120deg, #cffafe 0%, #67e8f9 42%, #06b6d4 100%)',
      border: 'rgba(6, 182, 212, 0.4)',
      sampleHex: '#22d3ee',
      fgPalette: {
        fg: '#0f172a',
        rankFg: '#334155',
        statMuted: '#475569',
        statPos: '#0f766e',
        statNeg: '#b91c1c',
      },
    },
    violet_canopy: {
      label: 'Violet canopy',
      minNodes: 7,
      bg: 'linear-gradient(128deg, #f5f3ff 0%, #ddd6fe 38%, #a78bfa 92%)',
      bgHover: 'linear-gradient(128deg, #ede9fe 0%, #c4b5fd 38%, #8b5cf6 92%)',
      border: 'rgba(139, 92, 246, 0.42)',
      sampleHex: '#a78bfa',
      fgPalette: {
        fg: '#1e1b4b',
        rankFg: '#312e81',
        statMuted: '#5b567c',
        statPos: '#047857',
        statNeg: '#9d174d',
      },
    },
    moonlit_band: {
      label: 'Moonlit band',
      minNodes: 7,
      bg: 'linear-gradient(118deg, #0f172a 0%, #134e4a 36%, #1e3a5f 72%, #0b1f17 100%)',
      bgHover: 'linear-gradient(118deg, #020617 0%, #115e59 38%, #172554 72%, #020617 100%)',
      border: 'rgba(45, 212, 191, 0.35)',
      sampleHex: '#134e4a',
      fgPalette: {
        fg: '#f8fafc',
        rankFg: '#e2e8f0',
        statMuted: '#cbd5e1',
        statPos: '#6ee7b7',
        statNeg: '#fecaca',
      },
    },
    finale_aurora: {
      label: 'Finale aurora',
      minNodes: 10,
      bg: 'linear-gradient(132deg, #fffbeb 0%, #fcd34d 32%, #f59e0b 58%, #7c3aed 100%)',
      bgHover: 'linear-gradient(132deg, #fef3c7 0%, #fbbf24 34%, #ea580c 56%, #6d28d9 100%)',
      border: 'rgba(124, 58, 237, 0.35)',
      sampleHex: '#7c3aed',
      fgPalette: {
        fg: '#f8fafc',
        rankFg: '#e2e8f0',
        statMuted: '#cbd5e1',
        statPos: '#bbf7d0',
        statNeg: '#fecaca',
      },
    },
    golden_meadow: {
      label: 'Golden meadow',
      minNodes: 4,
      bg: 'linear-gradient(125deg, #fffbeb 0%, #fde68a 38%, #fbbf24 100%)',
      bgHover: 'linear-gradient(125deg, #fef3c7 0%, #fcd34d 40%, #f59e0b 100%)',
      border: 'rgba(245, 158, 11, 0.45)',
      sampleHex: '#fbbf24',
      fgPalette: {
        fg: '#0f172a',
        rankFg: '#334155',
        statMuted: '#475569',
        statPos: '#047857',
        statNeg: '#b91c1c',
      },
    },
    coral_ribbon: {
      label: 'Coral ribbon',
      minNodes: 4,
      bg: 'linear-gradient(120deg, #fff7ed 0%, #fed7aa 42%, #fb923c 100%)',
      bgHover: 'linear-gradient(120deg, #ffedd5 0%, #fdba74 42%, #f97316 100%)',
      border: 'rgba(249, 115, 22, 0.4)',
      sampleHex: '#fb923c',
      fgPalette: {
        fg: '#0f172a',
        rankFg: '#334155',
        statMuted: '#475569',
        statPos: '#0f766e',
        statNeg: '#b91c1c',
      },
    },
    dusk_ember: {
      label: 'Dusk ember',
      minNodes: 7,
      bg: 'linear-gradient(128deg, #fff7ed 0%, #fdba74 38%, #ea580c 92%)',
      bgHover: 'linear-gradient(128deg, #ffedd5 0%, #fb923c 38%, #c2410c 92%)',
      border: 'rgba(234, 88, 12, 0.42)',
      sampleHex: '#ea580c',
      fgPalette: {
        fg: '#1e1b4b',
        rankFg: '#312e81',
        statMuted: '#5b567c',
        statPos: '#047857',
        statNeg: '#9d174d',
      },
    },
    champagne_band: {
      label: 'Champagne band',
      minNodes: 7,
      bg: 'linear-gradient(118deg, #fffbeb 0%, #fde68a 36%, #f59e0b 72%, #fef3c7 100%)',
      bgHover: 'linear-gradient(118deg, #fef3c7 0%, #fcd34d 38%, #d97706 72%, #fffbeb 100%)',
      border: 'rgba(217, 119, 6, 0.35)',
      sampleHex: '#fde68a',
      fgPalette: {
        fg: '#0f172a',
        rankFg: '#334155',
        statMuted: '#475569',
        statPos: '#047857',
        statNeg: '#b91c1c',
      },
    },
    solstice_finale: {
      label: 'Solstice finale',
      minNodes: 10,
      bg: 'linear-gradient(132deg, #fffbeb 0%, #fbbf24 28%, #f59e0b 52%, #312e81 100%)',
      bgHover: 'linear-gradient(132deg, #fef3c7 0%, #f59e0b 30%, #ea580c 54%, #1e1b4b 100%)',
      border: 'rgba(245, 158, 11, 0.35)',
      sampleHex: '#f59e0b',
      fgPalette: {
        fg: '#f8fafc',
        rankFg: '#e2e8f0',
        statMuted: '#cbd5e1',
        statPos: '#bbf7d0',
        statNeg: '#fecaca',
      },
    },
    pitch_grass: {
      label: 'Pitch grass',
      minNodes: 4,
      bg: 'linear-gradient(125deg, #ecfdf5 0%, #86efac 38%, #22c55e 100%)',
      bgHover: 'linear-gradient(125deg, #d1fae5 0%, #4ade80 40%, #16a34a 100%)',
      border: 'rgba(34, 197, 94, 0.45)',
      sampleHex: '#22c55e',
      fgPalette: {
        fg: '#0f172a',
        rankFg: '#334155',
        statMuted: '#475569',
        statPos: '#047857',
        statNeg: '#b91c1c',
      },
    },
    stadium_lights: {
      label: 'Stadium lights',
      minNodes: 4,
      bg: 'linear-gradient(120deg, #0f172a 0%, #14532d 38%, #fbbf24 100%)',
      bgHover: 'linear-gradient(120deg, #020617 0%, #166534 40%, #f59e0b 100%)',
      border: 'rgba(251, 191, 36, 0.4)',
      sampleHex: '#fbbf24',
      fgPalette: {
        fg: '#f8fafc',
        rankFg: '#e2e8f0',
        statMuted: '#cbd5e1',
        statPos: '#6ee7b7',
        statNeg: '#fecaca',
      },
    },
    victory_march: {
      label: 'Victory march',
      minNodes: 7,
      bg: 'linear-gradient(128deg, #ecfdf5 0%, #4ade80 38%, #16a34a 92%)',
      bgHover: 'linear-gradient(128deg, #d1fae5 0%, #22c55e 38%, #15803d 92%)',
      border: 'rgba(22, 163, 74, 0.42)',
      sampleHex: '#16a34a',
      fgPalette: {
        fg: '#0f172a',
        rankFg: '#334155',
        statMuted: '#475569',
        statPos: '#047857',
        statNeg: '#b91c1c',
      },
    },
    cup_anthem: {
      label: 'Cup anthem',
      minNodes: 7,
      bg: 'linear-gradient(118deg, #fffbeb 0%, #fde68a 36%, #eab308 72%, #ca8a04 100%)',
      bgHover: 'linear-gradient(118deg, #fef3c7 0%, #fcd34d 38%, #ca8a04 72%, #a16207 100%)',
      border: 'rgba(202, 138, 4, 0.35)',
      sampleHex: '#eab308',
      fgPalette: {
        fg: '#0f172a',
        rankFg: '#334155',
        statMuted: '#475569',
        statPos: '#047857',
        statNeg: '#b91c1c',
      },
    },
    world_cup_finale: {
      label: 'World Cup finale',
      minNodes: 10,
      bg: 'linear-gradient(132deg, #14532d 0%, #22c55e 28%, #eab308 52%, #0f172a 100%)',
      bgHover: 'linear-gradient(132deg, #166534 0%, #16a34a 30%, #ca8a04 54%, #020617 100%)',
      border: 'rgba(202, 138, 4, 0.35)',
      sampleHex: '#ca8a04',
      fgPalette: {
        fg: '#f8fafc',
        rankFg: '#e2e8f0',
        statMuted: '#cbd5e1',
        statPos: '#bbf7d0',
        statNeg: '#fecaca',
      },
    },
  });

  function utcChessSeasonIdNow() {
    var d = new Date();
    var y = d.getUTCFullYear();
    var m = String(d.getUTCMonth() + 1);
    if (m.length === 1) m = '0' + m;
    return y + '-' + m;
  }

  function seasonNodesAlignedForLbRow(chess) {
    if (!chess || typeof chess !== 'object') return 0;
    var st = chess.seasonTrack && typeof chess.seasonTrack === 'object' ? chess.seasonTrack : {};
    var sid = String(st.seasonId || '').trim();
    if (!/^\d{4}-\d{2}$/.test(sid) || sid !== utcChessSeasonIdNow()) return 0;
    var n = Math.floor(Number(st.nodesCompleted) || 0);
    if (n < 0) n = 0;
    if (n > 10) n = 10;
    return n;
  }

  function isLbRowBasicHex(hex) {
    return !!(hex && LB_ROW_BASIC_HEX_SET[hex]);
  }

  function isLbRowCustomHexUnlocked(chess) {
    return isLbRowShopCustomHexUnlocked(chess);
  }

  function isLbRowPresetUnlocked(chess, presetId) {
    var def = LB_ROW_PRESETS[presetId];
    if (!def) return false;
    return seasonNodesAlignedForLbRow(chess) >= def.minNodes;
  }

  function getLbRowPresetDef(presetId) {
    return LB_ROW_PRESETS[presetId] || null;
  }

  function applyLeaderboardRowPreset(tr, presetId) {
    var def = LB_ROW_PRESETS[presetId];
    if (!def || !def.fgPalette) {
      tr.className = 'lb-row-default';
      tr.removeAttribute('style');
      return;
    }
    var pal = def.fgPalette;
    tr.className = 'lb-row-themed';
    tr.style.setProperty('--lb-bg', def.bg);
    tr.style.setProperty('--lb-bg-hover', def.bgHover);
    tr.style.setProperty('--lb-border', def.border);
    tr.style.setProperty('--lb-fg', pal.fg);
    tr.style.setProperty('--lb-rank-fg', pal.rankFg);
    tr.style.setProperty('--lb-stat-muted', pal.statMuted);
    tr.style.setProperty('--lb-stat-pos', pal.statPos);
    tr.style.setProperty('--lb-stat-neg', pal.statNeg);
  }

  function applyLeaderboardRowFromStored(tr, stored) {
    if (stored == null || typeof stored !== 'string') {
      tr.className = 'lb-row-default';
      tr.removeAttribute('style');
      return;
    }
    var s = stored.trim();
    if (!s) {
      tr.className = 'lb-row-default';
      tr.removeAttribute('style');
      return;
    }
    var low = s.toLowerCase();
    if (low.indexOf('lbrow:') === 0) {
      var pid = low.slice(6);
      if (/^[a-z0-9_]+$/.test(pid) && LB_ROW_PRESETS[pid]) {
        applyLeaderboardRowPreset(tr, pid);
        return;
      }
      tr.className = 'lb-row-default';
      tr.removeAttribute('style');
      return;
    }
    var hex = normalizeLbHex(s);
    if (hex) applyLeaderboardRowTheme(tr, hex);
    else {
      tr.className = 'lb-row-default';
      tr.removeAttribute('style');
    }
  }

  function applyLeaderboardRowTheme(tr, hexNorm) {
    var base = hexToRgb(hexNorm);
    if (!base) {
      tr.className = 'lb-row-default';
      tr.removeAttribute('style');
      return;
    }
    var L = relLum(base);
    var light = L > 0.45;
    var black = { r: 0, g: 0, b: 0 };
    var white = { r: 255, g: 255, b: 255 };
    var bgHover = rgbToHex(mixRgb(base, light ? black : white, light ? 0.1 : 0.14));
    var border = rgbToHex(mixRgb(base, black, light ? 0.12 : 0.28));
    tr.className = 'lb-row-themed';
    tr.style.setProperty('--lb-bg', hexNorm);
    tr.style.setProperty('--lb-bg-hover', bgHover);
    tr.style.setProperty('--lb-border', border);
    if (light) {
      tr.style.setProperty('--lb-fg', '#0f172a');
      tr.style.setProperty('--lb-rank-fg', '#475569');
      tr.style.setProperty('--lb-stat-muted', '#64748b');
      tr.style.setProperty('--lb-stat-pos', '#047857');
      tr.style.setProperty('--lb-stat-neg', '#b91c1c');
    } else {
      tr.style.setProperty('--lb-fg', '#f8fafc');
      tr.style.setProperty('--lb-rank-fg', '#cbd5e1');
      tr.style.setProperty('--lb-stat-muted', '#94a3b8');
      tr.style.setProperty('--lb-stat-pos', '#6ee7b7');
      tr.style.setProperty('--lb-stat-neg', '#fca5a5');
    }
  }

  var LB_FRAMES = {
    silver_lane: 1,
    amber_pulse: 1,
    violet_arc: 1,
    gold_filament: 1,
    amber_corona: 1,
    solstice_flare: 1,
  };

  function buildLbUsernameInnerHtml(r) {
    var f = r.lbFlair && typeof r.lbFlair === 'object' ? r.lbFlair : {};
    var prefix = f.prefix != null ? String(f.prefix) : '';
    var title = f.title != null ? String(f.title) : '';
    var suffix = f.suffix != null ? String(f.suffix) : '';
    var frame = f.frame != null ? String(f.frame) : '';
    var uname = escapeLbHtml(String(r.username || 'Player'));
    var bits = [];
    if (prefix)
      bits.push('<span class="lb-flair-prefix">' + escapeLbHtml(prefix) + '</span>');
    if (title) {
      bits.push(
        '<span class="lb-flair-title">' +
          escapeLbHtml(title) +
          '</span><span class="lb-flair-title-sep" aria-hidden="true"> — </span>'
      );
    }
    bits.push('<span class="lb-name-core">' + uname + '</span>');
    if (suffix) bits.push('<span class="lb-flair-suffix">' + escapeLbHtml(suffix) + '</span>');
    var inner =
      '<span class="lb-name-cell-inner">' +
      bits.join('<span class="lb-flair-gap" aria-hidden="true"> </span>') +
      '</span>';
    if (frame && LB_FRAMES[frame]) {
      return '<span class="lb-name-frame-wrap lb-flair-frame-' + frame + '">' + inner + '</span>';
    }
    return inner;
  }

  function getStatNumericForSort(sort, r) {
    if (sort === 'winPct') {
      var vp = Number(r.winPct);
      return Number.isFinite(vp) ? vp : 0;
    }
    var key =
      sort === 'checks'
        ? 'checksGiven'
        : sort === 'castles'
          ? 'castlingMoves'
          : sort;
    var n = Number(r[key]);
    return Number.isFinite(n) ? n : 0;
  }

  function formatStatCell(sort, r) {
    if (sort === 'winPct') {
      var v = Number(r.winPct);
      return (Number.isFinite(v) ? v : 0).toFixed(1) + '%';
    }
    var key =
      sort === 'checks'
        ? 'checksGiven'
        : sort === 'castles'
          ? 'castlingMoves'
          : sort;
    var n = Number(r[key]);
    return Number.isFinite(n) ? n.toLocaleString() : '0';
  }

  function statQualityClass(sort, rawVal) {
    var v = Number(rawVal);
    if (!Number.isFinite(v)) v = 0;
    if (sort === 'losses') {
      if (v >= 400) return 'lb-num-neg-t4';
      if (v >= 150) return 'lb-num-neg-t3';
      if (v >= 55) return 'lb-num-neg-t2';
      if (v >= 18) return 'lb-num-neg-t1';
      return 'lb-num-neg-t0';
    }
    if (sort === 'winPct') {
      if (v >= 72) return 'lb-num-t4';
      if (v >= 58) return 'lb-num-t3';
      if (v >= 45) return 'lb-num-t2';
      if (v >= 32) return 'lb-num-t1';
      return 'lb-num-t0';
    }
    var tables = {
      points: [40, 150, 600, 3000],
      wins: [4, 18, 75, 300],
      draws: [3, 12, 45, 140],
      games: [8, 35, 140, 550],
      captures: [40, 180, 900, 4500],
      checks: [25, 120, 600, 3000],
      promotions: [3, 12, 45, 180],
      castles: [4, 18, 60, 220],
    };
    var th = tables[sort] || [40, 150, 600, 3000];
    var tier = 0;
    for (var i = 0; i < th.length; i++) {
      if (v >= th[i]) tier = i + 1;
    }
    if (tier > 4) tier = 4;
    return 'lb-num-t' + tier;
  }

  /**
   * Fill a <tr> like chess-leaderboard renderRows (rank, player+flair, stat).
   * @param {HTMLTableRowElement} tr
   * @param {object} r row from API (rank, username, rowColor, lbFlair, stats…)
   * @param {string} sort
   */
  function renderLbDataRow(tr, r, sort) {
    while (tr.firstChild) tr.removeChild(tr.firstChild);
    applyLeaderboardRowFromStored(tr, r.rowColor);
    var tdRank = document.createElement('td');
    tdRank.className = 'lb-rank';
    tdRank.textContent = String(r.rank != null ? r.rank : '');
    var tdName = document.createElement('td');
    tdName.className = 'lb-username';
    tdName.innerHTML = buildLbUsernameInnerHtml(r);
    var tdStat = document.createElement('td');
    tdStat.className = 'lb-stat';
    var numVal = getStatNumericForSort(sort, r);
    var span = document.createElement('span');
    span.className = 'lb-num ' + statQualityClass(sort, numVal);
    span.textContent = formatStatCell(sort, r);
    tdStat.appendChild(span);
    tr.appendChild(tdRank);
    tr.appendChild(tdName);
    tr.appendChild(tdStat);
  }

  global.ChessLbRowUi = {
    escapeLbHtml: escapeLbHtml,
    normalizeLbHex: normalizeLbHex,
    applyLeaderboardRowTheme: applyLeaderboardRowTheme,
    applyLeaderboardRowFromStored: applyLeaderboardRowFromStored,
    applyLeaderboardRowPreset: applyLeaderboardRowPreset,
    LB_ROW_BASIC_HEXES: LB_ROW_BASIC_HEXES,
    LB_ROW_PRESETS: LB_ROW_PRESETS,
    LB_ROW_SHOP_CUSTOM_HEX_ID: LB_ROW_SHOP_CUSTOM_HEX_ID,
    LB_ROW_SHOP_SOLIDS: LB_ROW_SHOP_SOLIDS,
    LB_ROW_SHOP_ID_TO_HEX: LB_ROW_SHOP_ID_TO_HEX,
    leaderboardRowShopIdsFromChess: leaderboardRowShopIdsFromChess,
    isLbRowShopCustomHexUnlocked: isLbRowShopCustomHexUnlocked,
    isLbRowHexAllowedForUser: isLbRowHexAllowedForUser,
    utcChessSeasonIdNow: utcChessSeasonIdNow,
    seasonNodesAlignedForLbRow: seasonNodesAlignedForLbRow,
    isLbRowBasicHex: isLbRowBasicHex,
    isLbRowCustomHexUnlocked: isLbRowCustomHexUnlocked,
    isLbRowPresetUnlocked: isLbRowPresetUnlocked,
    getLbRowPresetDef: getLbRowPresetDef,
    buildLbUsernameInnerHtml: buildLbUsernameInnerHtml,
    renderLbDataRow: renderLbDataRow,
    getStatNumericForSort: getStatNumericForSort,
    formatStatCell: formatStatCell,
    statQualityClass: statQualityClass,
  };
})(typeof window !== 'undefined' ? window : globalThis);
