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

  var LB_FRAMES = { silver_lane: 1, amber_pulse: 1, violet_arc: 1 };

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
    var hex = normalizeLbHex(r.rowColor);
    if (hex) applyLeaderboardRowTheme(tr, hex);
    else {
      tr.className = 'lb-row-default';
      tr.removeAttribute('style');
    }
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
    buildLbUsernameInnerHtml: buildLbUsernameInnerHtml,
    renderLbDataRow: renderLbDataRow,
    getStatNumericForSort: getStatNumericForSort,
    formatStatCell: formatStatCell,
    statQualityClass: statQualityClass,
  };
})(typeof window !== 'undefined' ? window : globalThis);
