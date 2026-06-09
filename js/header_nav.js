// Site-wide header navigation — customizable from the account dashboard.
(function () {
  if (typeof window === 'undefined') return;

  const STORAGE_KEY = 'ahrenslabs_headerNav';
  const DEFAULT_NAV_IDS = ['home', 'labs', 'chessEngine', 'account'];

  /** @typedef {{ id: string, label: string, href: string, children?: Array<{ id: string, label: string, href: string }> }} NavEntry */

  /** @type {NavEntry[]} */
  const NAV_MENU = [
    { id: 'home', label: 'Home', href: 'index.html' },
    {
      id: 'chessEngine',
      label: 'Chess Engine',
      href: 'chess_engine.html',
      children: [
        { id: 'play', label: 'Play', href: 'chess_engine.html' },
        { id: 'trifangxDetails', label: 'TrifangX details', href: 'trifangx.html' },
        { id: 'seasonTrack', label: 'Season track', href: 'chess-season-track.html' },
        { id: 'leaderboard', label: 'Leaderboard', href: 'chess-leaderboard.html' },
        { id: 'gameHistory', label: 'Game history', href: 'chess_engine/game_history/' },
        { id: 'achievements', label: 'Achievements', href: 'achievements.html' },
        { id: 'chessShop', label: 'Chess shop', href: 'chess-shop.html' },
      ],
    },
    {
      id: 'labs',
      label: 'Labs',
      href: 'labs.html',
      children: [
        { id: 'labsOverview', label: 'All labs', href: 'labs.html' },
        { id: 'codingLab', label: 'Coding Lab', href: 'coding-lab.html' },
        { id: 'roboticsLab', label: 'Robotics Lab', href: 'robotics-lab.html' },
        { id: 'musicLab', label: 'Music Lab', href: 'music-lab.html' },
        { id: 'languageLab', label: 'Language Lab', href: 'language-lab.html' },
        { id: 'writingLab', label: 'Writing Lab', href: 'writing-lab.html' },
      ],
    },
    {
      id: 'projects',
      label: 'Projects',
      href: 'coding-lab.html',
      children: [
        { id: 'dungeonGame', label: 'Dungeon Game', href: 'dungeon_game.html' },
        { id: 'classify', label: 'Classify Planner', href: 'classify.html' },
        { id: 'tether', label: 'Tether', href: 'tether.html' },
        { id: 'link', label: 'link', href: '/link/dashboard' },
        { id: 'digest', label: 'Digest', href: 'digest.html' },
        { id: 'kyrachyng', label: 'Kyrachyng', href: 'kyrachyng.html' },
        { id: 'spud', label: 'Spud', href: 'spud.html' },
        { id: 'lotr', label: 'LOTR', href: 'lotr.html' },
      ],
    },
    { id: 'account', label: 'Account', href: 'account-dashboard.html' },
    { id: 'contact', label: 'Contact', href: 'contact.html' },
  ];

  const NAV_MENU_BY_ID = Object.fromEntries(NAV_MENU.map((entry) => [entry.id, entry]));

  const NAV_CATALOG = [
    { id: 'home', label: 'Home', group: 'Main' },
    { id: 'labs', label: 'Labs', group: 'Main' },
    { id: 'account', label: 'Account', group: 'Main' },
    { id: 'chessEngine', label: 'Chess Engine', group: 'Optional dropdowns' },
    { id: 'projects', label: 'Projects', group: 'Optional dropdowns' },
    { id: 'contact', label: 'Contact', group: 'Optional dropdowns' },
  ];

  const NAV_CATALOG_BY_ID = Object.fromEntries(NAV_CATALOG.map((item) => [item.id, item]));

  /** Maps stored preference ids and menu child ids to a top-level nav group. */
  const ID_TO_TOP_LEVEL = {
    home: 'home',
    account: 'account',
    contact: 'contact',
    labs: 'labs',
    codingLab: 'labs',
    roboticsLab: 'labs',
    musicLab: 'labs',
    languageLab: 'labs',
    writingLab: 'labs',
    chessEngine: 'chessEngine',
    chessShop: 'chessEngine',
    chessLeaderboard: 'chessEngine',
    chessSeasonTrack: 'chessEngine',
    achievements: 'chessEngine',
    trifangx: 'chessEngine',
    projects: 'projects',
    dungeonGame: 'projects',
    classify: 'projects',
    tether: 'projects',
    link: 'projects',
    sportsDigest: 'projects',
    spud: 'projects',
    lotr: 'projects',
    kyrachyng: 'projects',
  };

  const MENU_CHILD_CATALOG_ID = {
    play: 'chessEngine',
    trifangxDetails: 'trifangx',
    seasonTrack: 'chessSeasonTrack',
    leaderboard: 'chessLeaderboard',
    gameHistory: 'chessEngine',
    achievements: 'achievements',
    chessShop: 'chessShop',
    labsOverview: 'labs',
    codingLab: 'codingLab',
    roboticsLab: 'roboticsLab',
    musicLab: 'musicLab',
    languageLab: 'languageLab',
    writingLab: 'writingLab',
    dungeonGame: 'dungeonGame',
    classify: 'classify',
    tether: 'tether',
    link: 'link',
    digest: 'sportsDigest',
    kyrachyng: 'kyrachyng',
    spud: 'spud',
    lotr: 'lotr',
  };

  function normalizeNavIds(raw) {
    if (!Array.isArray(raw)) return DEFAULT_NAV_IDS.slice();
    const seen = new Set();
    const out = [];
    for (const id of raw) {
      if (typeof id !== 'string') continue;
      const top = ID_TO_TOP_LEVEL[id] || id;
      if (!NAV_MENU_BY_ID[top] && !NAV_CATALOG_BY_ID[id]) continue;
      const storeId = NAV_CATALOG_BY_ID[top] ? top : id;
      if (seen.has(storeId)) continue;
      seen.add(storeId);
      out.push(storeId);
    }
    return out.length ? out : DEFAULT_NAV_IDS.slice();
  }

  function catalogSelectionFromNavIds(raw) {
    const selected = new Set();
    for (const id of normalizeNavIds(raw)) {
      const top = ID_TO_TOP_LEVEL[id] || id;
      if (NAV_CATALOG_BY_ID[top]) selected.add(top);
      else if (NAV_CATALOG_BY_ID[id]) selected.add(id);
    }
    return selected;
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

  function getCurrentPathLower() {
    return (window.location.pathname || '').toLowerCase();
  }

  function hrefBasename(href) {
    const clean = String(href || '').split('?')[0].split('#')[0];
    const parts = clean.split('/').filter(Boolean);
    return (parts[parts.length - 1] || '').toLowerCase();
  }

  function isNavLinkActive(item, parentId) {
    const current = getCurrentPageBasename();
    const path = getCurrentPathLower();
    const target = String(item.href || '').toLowerCase();

    if (item.id === 'home' || target.endsWith('index.html')) {
      return !current || current === 'index.html';
    }

    if (item.id === 'gameHistory' || target.includes('game_history')) {
      return path.includes('game_history');
    }

    if (item.id === 'kyrachyng') {
      return current.startsWith('kyrachyng');
    }

    if (item.id === 'play' || (parentId === 'chessEngine' && target.endsWith('chess_engine.html'))) {
      return (
        current === 'chess_engine.html' ||
        current === 'trifangx_live.html' ||
        current === 'chess-replay.html'
      );
    }

    if (item.id === 'labsOverview' || (parentId === 'labs' && target.endsWith('labs.html'))) {
      return current === 'labs.html';
    }

    if (item.id === 'account') {
      return (
        current === 'account-dashboard.html' ||
        current === 'account.html' ||
        current === 'delete-account.html' ||
        current === 'reset-password.html'
      );
    }

    if (item.id === 'digest') {
      return current === 'digest.html' || current === 'sports-digest.html';
    }

    const base = hrefBasename(item.href);
    if (!base) return false;
    return current === base;
  }

  function isNavGroupActive(entry) {
    if (entry.children && entry.children.length) {
      if (entry.children.some((child) => isNavLinkActive(child, entry.id))) return true;
    }
    return isNavLinkActive(entry, entry.id);
  }

  function selectedIdSet(selectedIds) {
    return new Set(normalizeNavIds(selectedIds));
  }

  function isTopLevelSelected(entry, selected) {
    if (selected.has(entry.id)) return true;
    if (!entry.children || !entry.children.length) return false;
    return entry.children.some((child) => {
      const catalogId = MENU_CHILD_CATALOG_ID[child.id] || child.id;
      return selected.has(catalogId) || selected.has(ID_TO_TOP_LEVEL[catalogId] || catalogId);
    });
  }

  function filterChildren(entry, selected) {
    if (!entry.children || !entry.children.length) return [];
    if (selected.has(entry.id)) return entry.children.slice();
    return entry.children.filter((child) => {
      const catalogId = MENU_CHILD_CATALOG_ID[child.id] || child.id;
      return selected.has(catalogId);
    });
  }

  function deriveVisibleEntries(selectedIds) {
    const selected = selectedIdSet(selectedIds);
    const seen = new Set();
    const out = [];

    for (const id of normalizeNavIds(selectedIds)) {
      const topId = ID_TO_TOP_LEVEL[id] || id;
      const entry = NAV_MENU_BY_ID[topId];
      if (!entry || seen.has(entry.id)) continue;
      if (!isTopLevelSelected(entry, selected)) continue;
      seen.add(entry.id);
      out.push(entry);
    }

    if (out.length) return out;
    return DEFAULT_NAV_IDS.map((id) => NAV_MENU_BY_ID[id]).filter(Boolean);
  }

  function renderNavEntry(ul, entry, selected) {
    const li = document.createElement('li');
    const children = filterChildren(entry, selected);
    const hasDropdown = children.length > 0;

    if (hasDropdown) {
      li.className = 'nav-dropdown';
      if (isNavGroupActive({ ...entry, children })) li.classList.add('nav-dropdown--active');

      const trigger = document.createElement('a');
      trigger.href = entry.href;
      trigger.className = 'nav-dropdown-trigger';
      if (isNavGroupActive({ ...entry, children })) trigger.classList.add('active');
      trigger.innerHTML =
        escHtml(entry.label) + ' <span class="nav-caret" aria-hidden="true">▾</span>';
      li.appendChild(trigger);

      const menu = document.createElement('ul');
      menu.className = 'nav-dropdown-menu';
      for (const child of children) {
        const childLi = document.createElement('li');
        const childA = document.createElement('a');
        childA.href = child.href;
        childA.textContent = child.label;
        if (isNavLinkActive(child, entry.id)) childA.classList.add('active');
        childLi.appendChild(childA);
        menu.appendChild(childLi);
      }
      li.appendChild(menu);
    } else {
      const a = document.createElement('a');
      a.href = entry.href;
      a.textContent = entry.label;
      if (isNavLinkActive(entry, entry.id)) a.classList.add('active');
      li.appendChild(a);
    }

    ul.appendChild(li);
  }

  const DROPDOWN_CLOSE_DELAY_MS = 320;

  function closeOtherHeaderDropdowns(ul, keepLi) {
    ul.querySelectorAll('li.nav-dropdown').forEach((dropdown) => {
      if (dropdown === keepLi) return;
      if (dropdown._closeTimer) {
        clearTimeout(dropdown._closeTimer);
        dropdown._closeTimer = null;
      }
      dropdown.classList.remove('nav-dropdown--open');
    });
  }

  function wireHeaderDropdownHover() {
    const ul = document.querySelector('header nav ul');
    if (!ul || ul.dataset.dropdownHoverWired === '1') return;
    ul.dataset.dropdownHoverWired = '1';

    ul.addEventListener('mouseover', (ev) => {
      const li = ev.target.closest('li.nav-dropdown');
      if (!li || !ul.contains(li)) return;
      if (li._closeTimer) {
        clearTimeout(li._closeTimer);
        li._closeTimer = null;
      }
      closeOtherHeaderDropdowns(ul, li);
      li.classList.add('nav-dropdown--open');
    });

    ul.addEventListener('mouseout', (ev) => {
      const li = ev.target.closest('li.nav-dropdown');
      if (!li || !ul.contains(li)) return;
      const related = ev.relatedTarget;
      if (related && li.contains(related)) return;
      if (li._closeTimer) clearTimeout(li._closeTimer);
      li._closeTimer = setTimeout(() => {
        li.classList.remove('nav-dropdown--open');
        li._closeTimer = null;
      }, DROPDOWN_CLOSE_DELAY_MS);
    });

    ul.addEventListener('focusin', (ev) => {
      const li = ev.target.closest('li.nav-dropdown');
      if (!li || !ul.contains(li)) return;
      if (li._closeTimer) {
        clearTimeout(li._closeTimer);
        li._closeTimer = null;
      }
      closeOtherHeaderDropdowns(ul, li);
      li.classList.add('nav-dropdown--open');
    });

    ul.addEventListener('focusout', (ev) => {
      const li = ev.target.closest('li.nav-dropdown');
      if (!li || !ul.contains(li)) return;
      const related = ev.relatedTarget;
      if (related && li.contains(related)) return;
      if (li._closeTimer) clearTimeout(li._closeTimer);
      li._closeTimer = setTimeout(() => {
        li.classList.remove('nav-dropdown--open');
        li._closeTimer = null;
      }, DROPDOWN_CLOSE_DELAY_MS);
    });
  }

  function renderHeaderNav() {
    const ul = document.querySelector('header nav ul');
    if (!ul) return;

    const selectedIds = getStoredNavIds();
    const entries = deriveVisibleEntries(selectedIds);
    const selected = selectedIdSet(selectedIds);

    ul.innerHTML = '';
    for (const entry of entries) {
      renderNavEntry(ul, entry, selected);
    }
    wireHeaderDropdownHover();
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function syncFromProfile(headerNavItems) {
    saveNavIdsToLocal(headerNavItems);
    renderHeaderNav();
  }

  window.AhrensHeaderNav = {
    MENU: NAV_MENU,
    CATALOG: NAV_CATALOG,
    DEFAULT_IDS: DEFAULT_NAV_IDS.slice(),
    normalizeNavIds,
    catalogSelectionFromNavIds,
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
