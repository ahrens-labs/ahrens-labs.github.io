/**
 * Standalone game history page (chess_engine/game_history/).
 * Loads cloud chess data, lists/filter/favorite/export; "Play on board" goes to trifangx_live.html?replayIndex=
 */
(function () {
  'use strict';

  const API_BASE_URL = 'https://chess-accounts.matthewahrens.workers.dev';

  /** Matches shop time control labels in chess_engine.html */
  const GH_TIME_CONTROLS = [
    { id: 'none', name: 'None' },
    { id: '60', name: '1 min' },
    { id: '180|2', name: '3 | 2' },
    { id: '300|0', name: '5 min' },
    { id: '600|0', name: '10 min' },
    { id: '900|5', name: '15 | 5' },
    { id: '3600|0', name: '60 min' }
  ];

  let cloudChessData = null;
  let currentSessionId = null;
  let saveTimeout = null;
  let dataLoaded = false;

  function getChessPgnPlayerName() {
    try {
      const u = localStorage.getItem('ahrenslabs_username');
      if (u && String(u).trim()) return sanitizePgnTagPlayerName(String(u).trim());
    } catch (e) {}
    return 'Player';
  }

  function sanitizePgnTagPlayerName(s) {
    const t = s.replace(/[\r\n\f\v\[\]"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    return t || 'Player';
  }

  function slugForPgnFilename(name) {
    const raw = String(name || 'player').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_|_$/g, '');
    return raw.slice(0, 40) || 'player';
  }

  function buildPgnFromHistoryRecord(rec) {
    if (!rec || !Array.isArray(rec.historySan) || rec.historySan.length === 0) return '';
    const human = getChessPgnPlayerName();
    const pc = rec.playerColor === 'black' ? 'black' : 'white';
    let dateStr = '';
    if (rec.savedAt) {
      const s = String(rec.savedAt);
      if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) {
        dateStr = s.slice(0, 10).replace(/-/g, '.');
      }
    }
    if (!dateStr) {
      dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '.');
    }
    const r = rec.result || '*';
    let pgn = '[Event "Chess vs TrifangX"]\n';
    pgn += '[Site "Ahrens Labs"]\n';
    pgn += `[Date "${dateStr}"]\n`;
    pgn += '[Round "1"]\n';
    pgn += `[White "${pc === 'white' ? human : 'TrifangX'}"]\n`;
    pgn += `[Black "${pc === 'black' ? human : 'TrifangX'}"]\n`;
    pgn += `[Result "${r}"]\n\n`;
    const history = rec.historySan;
    let moveText = '';
    for (let i = 0; i < history.length; i++) {
      if (i % 2 === 0) {
        moveText += `${Math.floor(i / 2) + 1}. `;
      }
      moveText += history[i] + ' ';
      if (i % 2 === 1) {
        moveText += '\n';
      }
    }
    pgn += moveText.trim() + (history.length ? ` ${r}` : r);
    return pgn;
  }

  function applyUsernameToLegacyPgnString(pgn, playerColorRec) {
    if (!pgn) return pgn;
    const human = getChessPgnPlayerName();
    if (human === 'Player') return pgn;
    const pc = playerColorRec === 'black' ? 'black' : 'white';
    const whiteName = pc === 'white' ? human : 'TrifangX';
    const blackName = pc === 'black' ? human : 'TrifangX';
    let out = pgn;
    out = out.replace(/\[White "[^"]*"\]/, `[White "${whiteName}"]`);
    out = out.replace(/\[Black "[^"]*"\]/, `[Black "${blackName}"]`);
    return out;
  }

  function downloadPgnString(pgn, filenameBase) {
    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filenameBase + '.pgn';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  function gameHistoryRecordIsFavorite(rec) {
    return !!(rec && rec.favorite === true);
  }

  function trimGameHistoryToCap() {
    if (!cloudChessData || !Array.isArray(cloudChessData.gameHistory)) return;
    const items = cloudChessData.gameHistory;
    let nonFavKept = 0;
    const out = [];
    for (let i = 0; i < items.length; i++) {
      const r = items[i];
      if (!r) continue;
      if (gameHistoryRecordIsFavorite(r)) {
        out.push(r);
      } else if (nonFavKept < 50) {
        out.push(r);
        nonFavKept++;
      }
    }
    cloudChessData.gameHistory = out;
  }

  async function saveChessDataToCloud(immediate) {
    if (!currentSessionId || !cloudChessData) return;
    clearTimeout(saveTimeout);
    const doSave = async () => {
      try {
        await fetch(`${API_BASE_URL}/api/chess/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentSessionId}`
          },
          body: JSON.stringify(cloudChessData)
        });
      } catch (e) {
        console.error('Save to cloud error:', e);
      }
    };
    if (immediate) await doSave();
    else saveTimeout = setTimeout(doSave, 2000);
  }

  function formatGameHistoryTimeControlLabel(tc) {
    const v = tc == null || tc === '' ? 'none' : String(tc);
    if (v === 'none') return 'None';
    const found = GH_TIME_CONTROLS.find(function (t) {
      return t.id === v;
    });
    return found ? found.name : v;
  }

  /** bullet | blitz | rapid | classical — matches chess_engine shop ids */
  function timeControlCategory(tc) {
    const v = tc == null || tc === '' ? 'none' : String(tc);
    if (v === '60') return 'bullet';
    if (v === '180|2' || v === '300|0') return 'blitz';
    if (v === '600|0' || v === '900|5') return 'rapid';
    if (v === '3600|0' || v === 'none') return 'classical';
    return 'classical';
  }

  /** Visual tier for the moves KPI from full-move count (plies / 2 rounded up). */
  function movesVisualTier(fullMoves) {
    const n = typeof fullMoves === 'number' ? fullMoves : 0;
    if (n <= 0) return 'empty';
    if (n <= 18) return 'brief';
    if (n <= 42) return 'standard';
    if (n <= 70) return 'long';
    return 'epic';
  }

  function timeControlGlyph(kind) {
    if (kind === 'bullet') {
      return (
        '<svg class="gh-stat-clock-svg gh-stat-clock-svg--bullet" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<g stroke="currentColor" stroke-linecap="round" opacity="0.45">' +
        '<line x1="1" y1="9" x2="5" y2="9" stroke-width="1.6"/>' +
        '<line x1="0" y1="12" x2="6.5" y2="12" stroke-width="2"/>' +
        '<line x1="1" y1="15" x2="5" y2="15" stroke-width="1.6"/>' +
        '</g>' +
        '<rect x="7" y="7.5" width="15" height="9" rx="4.5" fill="currentColor"/>' +
        '</svg>'
      );
    }
    if (kind === 'blitz') return '\u26a1';
    if (kind === 'rapid') return '\u23f1';
    if (kind === 'classical') {
      return (
        '<svg class="gh-stat-clock-svg gh-stat-clock-svg--classical" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path fill="none" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round" stroke-linecap="round" d="M6 3.5H18L12 12L18 20.5H6L12 12L6 3.5z"/>' +
        '<line x1="9.5" y1="12" x2="14.5" y2="12" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" opacity="0.4"/>' +
        '</svg>'
      );
    }
    return '\u23f1';
  }

  function gameHistoryRecordDateKey(rec) {
    if (!rec || !rec.savedAt) return '';
    const s = String(rec.savedAt);
    if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    try {
      return new Date(rec.savedAt).toISOString().slice(0, 10);
    } catch (e) {
      return '';
    }
  }

  function playerResultFromRecord(rec) {
    if (!rec) return 'loss';
    if (rec.result === '1/2-1/2') return 'draw';
    if (rec.playerColor === 'white') return rec.result === '1-0' ? 'win' : 'loss';
    return rec.result === '0-1' ? 'win' : 'loss';
  }

  function whiteMoveCountFromRecord(rec) {
    const plyCount = Array.isArray(rec.historySan) ? rec.historySan.length : 0;
    return plyCount > 0 ? Math.ceil(plyCount / 2) : 0;
  }

  function populateGameHistoryTimeControlFilter() {
    const sel = document.getElementById('game-history-filter-tc');
    if (!sel || !cloudChessData) return;
    const items = cloudChessData.gameHistory || [];
    const seen = new Set();
    items.forEach(function (rec) {
      seen.add(rec.timeControl != null && rec.timeControl !== '' ? rec.timeControl : 'none');
    });
    const prev = sel.value;
    sel.innerHTML = '<option value="">Any</option>';
    Array.from(seen)
      .sort()
      .forEach(function (tc) {
        const opt = document.createElement('option');
        opt.value = tc;
        opt.textContent = formatGameHistoryTimeControlLabel(tc);
        sel.appendChild(opt);
      });
    if (prev && Array.from(sel.options).some(function (o) {
      return o.value === prev;
    })) {
      sel.value = prev;
    }
  }

  function getGameHistoryFilteredEntries() {
    const items = (cloudChessData && cloudChessData.gameHistory) ? cloudChessData.gameHistory : [];
    const fromEl = document.getElementById('game-history-date-from');
    const toEl = document.getElementById('game-history-date-to');
    const fromVal = fromEl && fromEl.value ? fromEl.value : '';
    const toVal = toEl && toEl.value ? toEl.value : '';
    const outcomeEl = document.getElementById('game-history-filter-outcome');
    const outcomeVal = outcomeEl && outcomeEl.value ? outcomeEl.value : '';
    const tcEl = document.getElementById('game-history-filter-tc');
    const tcVal = tcEl && tcEl.value !== undefined && tcEl.value !== '' ? tcEl.value : '';
    const minEl = document.getElementById('game-history-filter-moves-min');
    const maxEl = document.getElementById('game-history-filter-moves-max');
    const minMoves = minEl && minEl.value !== '' ? parseInt(minEl.value, 10) : NaN;
    const maxMoves = maxEl && maxEl.value !== '' ? parseInt(maxEl.value, 10) : NaN;
    const favOnlyEl = document.getElementById('game-history-filter-favorites-only');
    const favoritesOnly = !!(favOnlyEl && favOnlyEl.checked);

    return items
      .map(function (rec, idx) {
        return { rec: rec, idx: idx };
      })
      .filter(function (entry) {
        const rec = entry.rec;
        if (favoritesOnly && !gameHistoryRecordIsFavorite(rec)) return false;
        if (fromVal || toVal) {
          const key = gameHistoryRecordDateKey(rec);
          if (!key) return false;
          if (fromVal && key < fromVal) return false;
          if (toVal && key > toVal) return false;
        }
        if (outcomeVal) {
          if (playerResultFromRecord(rec) !== outcomeVal) return false;
        }
        if (tcVal !== '') {
          const rtc = rec.timeControl != null && rec.timeControl !== '' ? rec.timeControl : 'none';
          if (rtc !== tcVal) return false;
        }
        const wm = whiteMoveCountFromRecord(rec);
        if (!isNaN(minMoves) && wm < minMoves) return false;
        if (!isNaN(maxMoves) && wm > maxMoves) return false;
        return true;
      });
  }

  function renderGameHistoryList() {
    const list = document.getElementById('game-history-list');
    if (!list || !cloudChessData) return;
    const fullCount = (cloudChessData.gameHistory || []).length;
    const entries = getGameHistoryFilteredEntries();
    const favOnlyEl = document.getElementById('game-history-filter-favorites-only');
    const favoritesOnlyFilter = !!(favOnlyEl && favOnlyEl.checked);
    const anyFavorite = (cloudChessData.gameHistory || []).some(gameHistoryRecordIsFavorite);
    if (fullCount === 0) {
      list.innerHTML =
        '<p style="color:#666;font-family:Inter,sans-serif;">No completed games yet. Finish a game and it will appear here.</p>';
      return;
    }
    if (entries.length === 0) {
      if (favoritesOnlyFilter && !anyFavorite) {
        list.innerHTML =
          '<p style="color:#666;font-family:Inter,sans-serif;">No favorited games yet. Use the star on a row to favorite a game; favorites are kept even when older games roll off.</p>';
      } else {
        list.innerHTML =
          '<p style="color:#666;font-family:Inter,sans-serif;">No games match your filters. Try changing or clearing filters.</p>';
      }
      return;
    }
    list.innerHTML = entries
      .map(function (entry) {
        const rec = entry.rec;
        const idx = entry.idx;
        const isFav = gameHistoryRecordIsFavorite(rec);
        const d = rec.savedAt ? new Date(rec.savedAt) : new Date();
        const ds = d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        let label = '';
        let outcomeClass = 'game-history-row--draw';
        if (rec.result === '1/2-1/2') {
          label = 'Draw';
          outcomeClass = 'game-history-row--draw';
        } else if (rec.playerColor === 'white') {
          if (rec.result === '1-0') {
            label = 'You won';
            outcomeClass = 'game-history-row--win';
          } else {
            label = 'You lost';
            outcomeClass = 'game-history-row--loss';
          }
        } else {
          if (rec.result === '0-1') {
            label = 'You won';
            outcomeClass = 'game-history-row--win';
          } else {
            label = 'You lost';
            outcomeClass = 'game-history-row--loss';
          }
        }
        const tcLabel = formatGameHistoryTimeControlLabel(rec.timeControl);
        const tcCat = timeControlCategory(rec.timeControl);
        const tcGlyph = timeControlGlyph(tcCat);
        const plyCount = Array.isArray(rec.historySan) ? rec.historySan.length : 0;
        const whiteMoveCount = plyCount > 0 ? Math.ceil(plyCount / 2) : 0;
        const movesDisplay = whiteMoveCount > 0 ? String(whiteMoveCount) : '—';
        const movesTier = movesVisualTier(whiteMoveCount);
        const sideLabel = rec.playerColor === 'black' ? 'Black' : 'White';
        const sideStatClass =
          rec.playerColor === 'black' ? 'gh-stat-side--black' : 'gh-stat-side--white';
        let badgeClass = 'gh-outcome-badge--draw';
        if (outcomeClass === 'game-history-row--win') badgeClass = 'gh-outcome-badge--win';
        else if (outcomeClass === 'game-history-row--loss') badgeClass = 'gh-outcome-badge--loss';
        return (
          '<div class="game-history-row ' +
          outcomeClass +
          ' game-history-row--playable" tabindex="0" title="Open this game on the board" ' +
          'onclick="window.playGameHistoryRecordAt(' +
          idx +
          ')" onkeydown="window.ghGameHistoryRowKeydown(event,' +
          idx +
          ')">' +
          '<div class="game-history-row-fav" onclick="event.stopPropagation()">' +
          '<button type="button" class="gh-btn-favorite' +
          (isFav ? ' gh-btn-favorite--on' : '') +
          '" onclick="event.stopPropagation(); window.toggleGameHistoryFavoriteAt(' +
          idx +
          ')" aria-pressed="' +
          (isFav ? 'true' : 'false') +
          '" title="' +
          (isFav ? 'Remove from favorites' : 'Add to favorites') +
          '">' +
          (isFav ? '★' : '☆') +
          '</button></div>' +
          '<div class="game-history-row-meta">' +
          '<div class="gh-row-head">' +
          '<div class="gh-row-head-main">' +
          '<span class="gh-outcome-badge ' +
          badgeClass +
          '">' +
          label +
          '</span>' +
          '<span class="gh-result-chip">' +
          (rec.result || '—') +
          '</span>' +
          (isFav ? '<span class="gh-fav-inline">Favorite</span>' : '') +
          '</div>' +
          '<button type="button" class="gh-btn-export gh-btn-export--head" onclick="event.stopPropagation(); window.exportGameHistoryRecordAt(' +
          idx +
          ')">Export</button>' +
          '</div>' +
          '<div class="gh-stat-chips">' +
          '<div class="gh-stat gh-stat--played" role="group" aria-label="When played">' +
          '<span class="gh-stat-played-rail" aria-hidden="true"></span>' +
          '<div class="gh-stat-played-text">' +
          '<span class="gh-stat-played-label">Played</span>' +
          '<span class="gh-stat-played-value">' +
          ds +
          '</span></div></div>' +
          '<div class="gh-stat gh-stat--clock gh-stat-clock--' +
          tcCat +
          '" role="group" aria-label="Time control">' +
          '<span class="gh-stat-clock-glyph gh-stat-clock-glyph--' +
          tcCat +
          '" aria-hidden="true">' +
          tcGlyph +
          '</span>' +
          '<div class="gh-stat-clock-lines">' +
          '<span class="gh-stat-clock-label">Time Control</span>' +
          '<span class="gh-stat-clock-value">' +
          tcLabel +
          '</span></div></div>' +
          '<div class="gh-stat gh-stat--moves gh-stat-moves--' +
          movesTier +
          '" role="group" aria-label="Moves">' +
          '<span class="gh-stat-moves-value">' +
          movesDisplay +
          '</span>' +
          '<span class="gh-stat-moves-caption">Moves</span></div>' +
          '<div class="gh-stat gh-stat--side ' +
          sideStatClass +
          '" role="group" aria-label="Your side">' +
          '<span class="gh-stat-side-swatch" aria-hidden="true"></span>' +
          '<div class="gh-stat-side-text">' +
          '<span class="gh-stat-side-label">Your side</span>' +
          '<span class="gh-stat-side-value">' +
          sideLabel +
          '</span></div></div>' +
          '</div></div></div>'
        );
      })
      .join('');
  }

  function refreshGameHistoryModal() {
    renderGameHistoryList();
  }

  function clearGameHistoryFilters() {
    const fromEl = document.getElementById('game-history-date-from');
    const toEl = document.getElementById('game-history-date-to');
    if (fromEl) fromEl.value = '';
    if (toEl) toEl.value = '';
    const outcomeEl = document.getElementById('game-history-filter-outcome');
    if (outcomeEl) outcomeEl.value = '';
    const tcEl = document.getElementById('game-history-filter-tc');
    if (tcEl) tcEl.value = '';
    const minEl = document.getElementById('game-history-filter-moves-min');
    const maxEl = document.getElementById('game-history-filter-moves-max');
    if (minEl) minEl.value = '';
    if (maxEl) maxEl.value = '';
    const favOnlyEl = document.getElementById('game-history-filter-favorites-only');
    if (favOnlyEl) favOnlyEl.checked = false;
    populateGameHistoryTimeControlFilter();
    refreshGameHistoryModal();
  }

  function toggleGameHistoryFavoriteAt(index) {
    const items = (cloudChessData && cloudChessData.gameHistory) ? cloudChessData.gameHistory : [];
    const rec = items[index];
    if (!rec) {
      alert('Game not found');
      return;
    }
    rec.favorite = !gameHistoryRecordIsFavorite(rec);
    trimGameHistoryToCap();
    saveChessDataToCloud(true);
    refreshGameHistoryModal();
  }

  function exportGameHistoryRecordAt(index) {
    const items = (cloudChessData && cloudChessData.gameHistory) ? cloudChessData.gameHistory : [];
    const rec = items[index];
    if (!rec) {
      alert('Game not found');
      return;
    }
    let pgn = '';
    if (Array.isArray(rec.historySan) && rec.historySan.length > 0) {
      pgn = buildPgnFromHistoryRecord(rec);
    } else if (rec.pgn) {
      pgn = applyUsernameToLegacyPgnString(rec.pgn, rec.playerColor);
    }
    if (!pgn) {
      alert('Game not found');
      return;
    }
    const slug = slugForPgnFilename(getChessPgnPlayerName());
    const datePart =
      (rec.savedAt || '').slice(0, 10).replace(/-/g, '.') ||
      new Date().toISOString().split('T')[0].replace(/-/g, '.');
    downloadPgnString(pgn, 'chess_game_' + slug + '_' + datePart);
  }

  function playGameHistoryRecordAt(index) {
    window.location.href = '../../trifangx_live.html?replayIndex=' + encodeURIComponent(String(index));
  }

  function ghGameHistoryRowKeydown(ev, index) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault();
    playGameHistoryRecordAt(index);
  }

  window.refreshGameHistoryModal = refreshGameHistoryModal;
  window.clearGameHistoryFilters = clearGameHistoryFilters;
  window.toggleGameHistoryFavoriteAt = toggleGameHistoryFavoriteAt;
  window.exportGameHistoryRecordAt = exportGameHistoryRecordAt;
  window.playGameHistoryRecordAt = playGameHistoryRecordAt;
  window.ghGameHistoryRowKeydown = ghGameHistoryRowKeydown;

  async function loadChessDataFromCloud() {
    currentSessionId = localStorage.getItem('ahrenslabs_sessionId');
    if (!currentSessionId) {
      window.location.href = '../../account.html?return=' + encodeURIComponent('chess_engine/game_history/');
      return false;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/chess/load`, {
        headers: { Authorization: `Bearer ${currentSessionId}` }
      });
      if (!response.ok) {
        window.location.href = '../../account.html?return=' + encodeURIComponent('chess_engine/game_history/');
        return false;
      }
      const data = await response.json();
      cloudChessData = {
        achievements: data.achievements || {},
        points: data.points || 0,
        shopUnlocks: data.shopUnlocks || {},
        settings: data.settings || {},
        stats: data.stats || {},
        pointsSpent: data.pointsSpent || 0,
        cheatPoints: data.cheatPoints || 0,
        gameHistory: Array.isArray(data.gameHistory) ? data.gameHistory : []
      };
      const gameHistoryLenBeforeTrim = (cloudChessData.gameHistory || []).length;
      trimGameHistoryToCap();
      dataLoaded = true;
      if ((cloudChessData.gameHistory || []).length !== gameHistoryLenBeforeTrim) {
        await saveChessDataToCloud(true);
      }
      return true;
    } catch (e) {
      console.error(e);
      window.location.href = '../../account.html?return=' + encodeURIComponent('chess_engine/game_history/');
      return false;
    }
  }

  document.addEventListener('DOMContentLoaded', async function () {
    const ok = await loadChessDataFromCloud();
    if (!ok) return;
    populateGameHistoryTimeControlFilter();
    renderGameHistoryList();
  });
})();
