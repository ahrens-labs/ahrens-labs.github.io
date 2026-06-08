// Site-wide header navigation — fixed menu with hover dropdowns.
(function () {
  if (typeof window === 'undefined') return;

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
        { id: 'digest', label: 'Digest', href: 'digest.html' },
        { id: 'kyrachyng', label: 'Kyrachyng', href: 'kyrachyng.html' },
        { id: 'spud', label: 'Spud', href: 'spud.html' },
        { id: 'lotr', label: 'LOTR', href: 'lotr.html' },
      ],
    },
    { id: 'account', label: 'Account', href: 'account-dashboard.html' },
    { id: 'contact', label: 'Contact', href: 'contact.html' },
  ];

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

  function renderHeaderNav() {
    const ul = document.querySelector('header nav ul');
    if (!ul) return;

    ul.innerHTML = '';

    for (const entry of NAV_MENU) {
      const li = document.createElement('li');
      const hasChildren = Array.isArray(entry.children) && entry.children.length > 0;

      if (hasChildren) {
        li.className = 'nav-dropdown';
        if (isNavGroupActive(entry)) li.classList.add('nav-dropdown--active');

        const trigger = document.createElement('a');
        trigger.href = entry.href;
        trigger.className = 'nav-dropdown-trigger';
        if (isNavGroupActive(entry)) trigger.classList.add('active');
        trigger.innerHTML =
          escHtml(entry.label) + ' <span class="nav-caret" aria-hidden="true">▾</span>';
        li.appendChild(trigger);

        const menu = document.createElement('ul');
        menu.className = 'nav-dropdown-menu';
        for (const child of entry.children) {
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
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  window.AhrensHeaderNav = {
    MENU: NAV_MENU,
    render: renderHeaderNav,
    /** @deprecated Header menu is fixed site-wide; profile prefs are ignored. */
    syncFromProfile() {
      renderHeaderNav();
    },
  };

  window.addEventListener('DOMContentLoaded', () => {
    renderHeaderNav();
  });
})();
