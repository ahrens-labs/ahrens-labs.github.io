// Site-wide header navigation — customizable from the account dashboard.
(function () {
  if (typeof window === 'undefined') return;

  const STORAGE_KEY = 'ahrenslabs_headerNav';
  const DEFAULT_NAV_IDS = ['home', 'labs', 'account'];

  const NAV_CATALOG = [
    { id: 'home', label: 'Home', href: 'index.html', group: 'Main' },
    { id: 'labs', label: 'Labs & Projects', href: 'labs.html', group: 'Main' },
    { id: 'account', label: 'Account', href: 'account-dashboard.html', group: 'Main' },
    { id: 'chessEngine', label: 'Chess Engine', href: 'chess_engine.html', group: 'TrifangX' },
    { id: 'chessShop', label: 'Chess Shop', href: 'chess-shop.html', group: 'TrifangX' },
    { id: 'chessLeaderboard', label: 'Leaderboard', href: 'chess-leaderboard.html', group: 'TrifangX' },
    { id: 'chessSeasonTrack', label: 'Season Track', href: 'chess-season-track.html', group: 'TrifangX' },
    { id: 'achievements', label: 'Achievements', href: 'achievements.html', group: 'TrifangX' },
    { id: 'trifangx', label: 'TrifangX', href: 'trifangx.html', group: 'TrifangX' },
    { id: 'codingLab', label: 'Coding Lab', href: 'coding-lab.html', group: 'Labs' },
    { id: 'roboticsLab', label: 'Robotics Lab', href: 'robotics-lab.html', group: 'Labs' },
    { id: 'musicLab', label: 'Music Lab', href: 'music-lab.html', group: 'Labs' },
    { id: 'languageLab', label: 'Language Lab', href: 'language-lab.html', group: 'Labs' },
    { id: 'writingLab', label: 'Writing Lab', href: 'writing-lab.html', group: 'Labs' },
    { id: 'dungeonGame', label: 'Dungeon Game', href: 'dungeon_game.html', group: 'Projects' },
    { id: 'classify', label: 'Classify Planner', href: 'classify.html', group: 'Projects' },
    { id: 'tether', label: 'Tether', href: 'tether.html', group: 'Projects' },
    { id: 'sportsDigest', label: 'Sports Digest', href: 'sports-digest.html', group: 'Projects' },
    { id: 'spud', label: 'Spud', href: 'spud.html', group: 'Projects' },
    { id: 'lotr', label: 'LOTR', href: 'lotr.html', group: 'Projects' },
    { id: 'kyrachyng', label: 'Kyrachyng', href: 'kyrachyng.html', group: 'Projects' },
    { id: 'contact', label: 'Contact', href: 'contact.html', group: 'Other' },
  ];

  const NAV_BY_ID = Object.fromEntries(NAV_CATALOG.map((item) => [item.id, item]));

  function normalizeNavIds(raw) {
    if (!Array.isArray(raw)) return DEFAULT_NAV_IDS.slice();
    const seen = new Set();
    const out = [];
    for (const id of raw) {
      if (typeof id === 'string' && NAV_BY_ID[id] && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    return out.length ? out : DEFAULT_NAV_IDS.slice();
  }

  function getStoredNavIds() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_NAV_IDS.slice();
      return normalizeNavIds(JSON.parse(raw));
    } catch {
      return DEFAULT_NAV_IDS.slice();
    }
  }

  function saveNavIdsToLocal(ids) {
    const normalized = normalizeNavIds(ids);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function getCurrentPageBasename() {
    const part = window.location.pathname.split('/').pop() || '';
    return part.toLowerCase();
  }

  function isNavItemActive(item) {
    const current = getCurrentPageBasename();
    const target = item.href.toLowerCase();

    if (target === 'index.html') {
      return !current || current === 'index.html';
    }
    if (item.id === 'labs') {
      return current === 'labs.html';
    }
    if (item.id === 'kyrachyng') {
      return current.startsWith('kyrachyng');
    }
    if (item.id === 'chessEngine') {
      return current === 'chess_engine.html' || current === 'trifangx_live.html';
    }
    return current === target;
  }

  function renderHeaderNav() {
    const ul = document.querySelector('header nav ul');
    if (!ul) return;

    const ids = getStoredNavIds();
    ul.innerHTML = '';

    for (const id of ids) {
      const item = NAV_BY_ID[id];
      if (!item) continue;
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = item.href;
      a.textContent = item.label;
      if (isNavItemActive(item)) a.classList.add('active');
      li.appendChild(a);
      ul.appendChild(li);
    }
  }

  function syncFromProfile(headerNavItems) {
    saveNavIdsToLocal(headerNavItems);
    renderHeaderNav();
  }

  window.AhrensHeaderNav = {
    CATALOG: NAV_CATALOG,
    DEFAULT_IDS: DEFAULT_NAV_IDS.slice(),
    normalizeNavIds,
    getNavIds: getStoredNavIds,
    saveNavIdsLocal: saveNavIdsToLocal,
    render: renderHeaderNav,
    syncFromProfile,
  };

  window.addEventListener('DOMContentLoaded', () => {
    renderHeaderNav();
  });

  window.addEventListener('storage', (ev) => {
    if (ev.key === STORAGE_KEY) renderHeaderNav();
  });
})();
