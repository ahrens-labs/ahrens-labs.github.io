/**
 * Standalone game history page (chess_engine/game_history/).
 * Loads cloud chess data, lists/filter/favorite/export; "Play on board" goes to chess_engine.html?replayIndex=
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
        const plyCount = Array.isArray(rec.historySan) ? rec.historySan.length : 0;
        const whiteMoveCount = plyCount > 0 ? Math.ceil(plyCount / 2) : 0;
        const movesDisplay = whiteMoveCount > 0 ? String(whiteMoveCount) : '—';
        const sideLabel = rec.playerColor === 'black' ? 'Black' : 'White';
        const sidePillClass =
          rec.playerColor === 'black' ? 'gh-stat-pill--side-black' : 'gh-stat-pill--side-white';
        let badgeClass = 'gh-outcome-badge--draw';
        if (outcomeClass === 'game-history-row--win') badgeClass = 'gh-outcome-badge--win';
        else if (outcomeClass === 'game-history-row--loss') badgeClass = 'gh-outcome-badge--loss';
        return (
          '<div class="game-history-row ' +
          outcomeClass +
          '">' +
          '<div class="game-history-row-fav">' +
          '<button type="button" class="gh-btn-favorite' +
          (isFav ? ' gh-btn-favorite--on' : '') +
          '" onclick="window.toggleGameHistoryFavoriteAt(' +
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
          '<div class="gh-stat-chips">' +
          '<span class="gh-stat-pill gh-stat-pill--played"><span class="gh-stat-pill-label">Played</span>' +
          '<span class="gh-stat-pill-value">' +
          ds +
          '</span></span>' +
          '<span class="gh-stat-pill gh-stat-pill--clock"><span class="gh-stat-pill-label">Clock</span>' +
          '<span class="gh-stat-pill-value">' +
          tcLabel +
          '</span></span>' +
          '<span class="gh-stat-pill gh-stat-pill--moves"><span class="gh-stat-pill-label">Moves</span>' +
          '<span class="gh-stat-pill-value">' +
          movesDisplay +
          '</span></span>' +
          '<span class="gh-stat-pill ' +
          sidePillClass +
          '"><span class="gh-stat-pill-label">Your side</span>' +
          '<span class="gh-stat-pill-value">' +
          sideLabel +
          '</span></span>' +
          '</div></div>' +
          '<div class="game-history-row-actions">' +
          '<button type="button" class="gh-btn-export" onclick="window.exportGameHistoryRecordAt(' +
          idx +
          ')">Export</button>' +
          '<button type="button" class="gh-btn-play" onclick="window.playGameHistoryRecordAt(' +
          idx +
          ')">Play on board</button>' +
          '</div></div>'
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
    window.location.href = '../../chess_engine.html?replayIndex=' + encodeURIComponent(String(index));
  }

  window.refreshGameHistoryModal = refreshGameHistoryModal;
  window.clearGameHistoryFilters = clearGameHistoryFilters;
  window.toggleGameHistoryFavoriteAt = toggleGameHistoryFavoriteAt;
  window.exportGameHistoryRecordAt = exportGameHistoryRecordAt;
  window.playGameHistoryRecordAt = playGameHistoryRecordAt;

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
