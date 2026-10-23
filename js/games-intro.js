// Ahrens Games welcome tour: shown once per account (the server remembers, so it follows the player across
// devices) or once per browser for guests. board-games.js passes on the server's answer with the lobby's
// existing /api/board-games/current request, so the tour costs no extra round-trip to decide.
(() => {
  const API_BASE = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';
  const GUEST_KEY = 'ahrensGames.introSeen';
  const userKey = (id) => `ahrensGames.introSeen:${id}`;
  const read = (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const write = (k) => {
    try {
      localStorage.setItem(k, '1');
    } catch {
      /* storage blocked */
    }
  };
  const session = () => read('ahrenslabs_sessionId') || '';
  const userId = () => read('ahrenslabs_userId') || '';

  const GAMES = [
    ['Dino Dynasty', '/img/dino-game/cover.webp'],
    ['Oakhaven', '/img/hearthhold/cover.webp'],
    ['Atlantis Expedition', '/img/atlantis/cover.webp?v=2'],
    ['Cauldron Lane', '/img/cauldron/cover.webp?v=3'],
    ['Hero League', '/img/heroes/cover.webp?v=2'],
    ['The Masquerade Court', '/img/masquerade/cover.webp?v=2'],
  ];
  const STEPS = [
    {
      body: `<img class="gi-logo" src="/img/ahrens-games-logo-official-dark.webp?v=1" alt="Ahrens Games" width="520" height="429">
        <h2>Welcome to Ahrens Games</h2>
        <p>A shelf of original board games, designed and built at Ahrens Labs. Every one plays right here in your browser, with nothing to download.</p>`,
    },
    {
      body: `<h2>Six games to open</h2>
        <p>Each box is a different world, from a dino park to a masked ball in Venice.</p>
        <ul class="gi-games">${GAMES.map(([n, src]) => `<li><img src="${src}" alt="" loading="lazy"><span>${n}</span></li>`).join('')}</ul>`,
    },
    {
      body: `<h2>Play your way</h2>
        <ul class="gi-ways">
          <li><b>🤖 Vs the computer</b><span>Pick Easy to Brutal and play any time.</span></li>
          <li><b>📱 Same device</b><span>Pass the phone or share the screen with friends and family.</span></li>
          <li><b>🌐 Online</b><span>Challenge other Ahrens Labs players and take turns whenever you like.</span></li>
        </ul>`,
    },
    {
      body: `<h2>Never lose your place</h2>
        <ul class="gi-ways">
          <li><b>▶️ Your games</b><span>Games in progress wait at the top of the lobby${session() ? ', saved to your account on every device' : ''}.</span></li>
          <li><b>🎬 Tutorials &amp; trailers</b><span>Every box has a short video that teaches the rules.</span></li>
          <li><b>🏆 Game history</b><span>See your wins, scores and finished boards.</span></li>
          <li><b>🎲 Surprise me</b><span>Can't choose? Get a random game against the computer.</span></li>
        </ul>`,
    },
  ];

  let shown = false;
  function markSeen() {
    const id = userId();
    if (session() && id) {
      write(userKey(id));
      fetch(`${API_BASE}/api/board-games/intro-seen`, { method: 'POST', headers: { Authorization: `Bearer ${session()}` }, keepalive: true }).catch(() => {});
    } else {
      write(GUEST_KEY);
    }
  }

  function show() {
    if (shown) return;
    shown = true;
    markSeen();
    const dlg = document.createElement('dialog');
    dlg.className = 'gi';
    dlg.setAttribute('aria-label', 'Welcome to Ahrens Games');
    dlg.innerHTML = `<div class="gi-step" aria-live="polite"></div>
      <div class="gi-foot">
        <button type="button" class="gi-skip">Skip</button>
        <span class="gi-dots">${STEPS.map(() => '<i></i>').join('')}</span>
        <span class="gi-nav"><button type="button" class="gi-back">Back</button><button type="button" class="gi-next">Next</button></span>
      </div>`;
    document.body.appendChild(dlg);
    const stepEl = dlg.querySelector('.gi-step');
    const dots = [...dlg.querySelectorAll('.gi-dots i')];
    const back = dlg.querySelector('.gi-back');
    const next = dlg.querySelector('.gi-next');
    let at = 0;
    const go = (i) => {
      at = i;
      stepEl.innerHTML = STEPS[i].body;
      stepEl.classList.remove('in');
      void stepEl.offsetWidth;
      stepEl.classList.add('in');
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
      back.hidden = i === 0;
      next.textContent = i === STEPS.length - 1 ? "Let's play!" : 'Next';
    };
    const close = () => {
      dlg.close();
      dlg.remove();
    };
    back.addEventListener('click', () => go(Math.max(0, at - 1)));
    next.addEventListener('click', () => (at === STEPS.length - 1 ? close() : go(at + 1)));
    dlg.querySelector('.gi-skip').addEventListener('click', close);
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      close();
    });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' && at < STEPS.length - 1) go(at + 1);
      if (e.key === 'ArrowLeft' && at > 0) go(at - 1);
    });
    go(0);
    dlg.showModal();
    next.focus();
  }

  window.AhrensGamesIntro = {
    // Called by board-games.js with the server's flag once the lobby's games have loaded.
    fromServer(seen) {
      const id = userId();
      if (seen) {
        if (id) write(userKey(id));
        return;
      }
      if (id && read(userKey(id))) markSeen();
      else show();
    },
    show,
  };

  if (new URLSearchParams(location.search).has('intro')) {
    addEventListener('DOMContentLoaded', show);
    return;
  }
  // Guests: once per browser. Signed in: wait for the server, unless this browser already knows.
  if (!session() && !read(GUEST_KEY)) addEventListener('DOMContentLoaded', show);
})();
