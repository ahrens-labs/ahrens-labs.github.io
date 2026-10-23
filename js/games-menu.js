// Ahrens Games menu: a ☰ button in the top left of every board game page that opens a drawer with the lobby,
// each game, game history and the way back to Ahrens Labs. The games redraw their headers often, so the button
// stays fixed to the window and the headers (.topbar, .gh-top, .lobby-nav) make room for it. Games reset the body's
// classes when they start, so the open state lives on <html>.
(function () {
  const GAMES = [
    { href: '/dino-board-game.html?home', name: 'Dino Dynasty', icon: '/img/dino-favicon-48.png', page: 'dino-board-game' },
    { href: '/oakhaven.html?home', name: 'Oakhaven', icon: '/img/oakhaven-favicon-48.png', page: 'oakhaven' },
    { href: '/atlantis.html?home', name: 'Atlantis Expedition', icon: '/img/atlantis-favicon-48.png', page: 'atlantis' },
    { href: '/cauldron.html?home', name: 'Cauldron Lane', icon: '/img/cauldron-favicon-48.png', page: 'cauldron' },
    { href: '/heroes.html?home', name: 'Hero League', icon: '/img/heroes-favicon-48.png', page: 'heroes' },
    { href: '/masquerade.html?home', name: 'The Masquerade Court', icon: '/img/masquerade-favicon-48.png', page: 'masquerade' },
  ];
  const here = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  const cur = (page) => (page === here ? ' aria-current="page" class="on"' : '');

  const css = document.createElement('style');
  css.textContent = `
  :is(.topbar, .gh-top, .lobby-nav) { padding-left: calc(54px + 0.6rem) !important; }
  .gm-burger { position: fixed; top: 10px; left: 10px; z-index: 70; width: 44px; height: 44px; display: grid; place-items: center; padding: 0;
    border: 0; border-radius: 12px; cursor: pointer; background: #0a1228; box-shadow: inset 0 0 0 1.5px rgba(120, 170, 255, 0.45), 0 4px 12px rgba(0, 0, 0, 0.45);
    -webkit-tap-highlight-color: transparent; transition: background 0.15s, transform 0.15s; }
  .gm-burger:hover, .gm-burger:focus-visible { background: #14244a; outline: none; transform: scale(1.05); }
  @media (max-width: 640px) {
    :is(.topbar, .gh-top, .lobby-nav) { padding-left: 52px !important; }
    .gm-burger { top: 8px; left: 7px; width: 38px; height: 38px; border-radius: 10px; }
    .gm-burger i, .gm-burger i::before, .gm-burger i::after { width: 18px; }
  }
  .gm-burger i { position: relative; display: block; width: 20px; height: 2.5px; border-radius: 2px; background: #fff; }
  .gm-burger i::before, .gm-burger i::after { content: ""; position: absolute; left: 0; width: 20px; height: 2.5px; border-radius: 2px; background: #fff; }
  .gm-burger i::before { top: -6.5px; }
  .gm-burger i::after { top: 6.5px; }
  .gm-back { position: fixed; inset: 0; z-index: 110; background: rgba(3, 6, 16, 0.55); opacity: 0; pointer-events: none; transition: opacity 0.2s; }
  .gm-drawer { position: fixed; top: 0; bottom: 0; left: 0; z-index: 111; width: min(300px, 86vw); display: flex; flex-direction: column; gap: 0.2rem;
    padding: 0.9rem 0.8rem calc(1rem + env(safe-area-inset-bottom, 0px)); overflow-y: auto; color: #eef3ff;
    font: 500 0.98rem "Fredoka", system-ui, sans-serif; background: linear-gradient(180deg, #0d1a38, #070b16);
    box-shadow: 8px 0 30px rgba(0, 0, 0, 0.5); transform: translateX(-105%); transition: transform 0.25s cubic-bezier(.2, .8, .2, 1); }
  html.gm-open .gm-back { opacity: 1; pointer-events: auto; }
  html.gm-open .gm-drawer { transform: none; }
  .gm-head { display: flex; align-items: center; gap: 0.6rem; padding: 0.2rem 0.3rem 0.8rem; margin-bottom: 0.3rem; border-bottom: 1px solid rgba(120, 170, 255, 0.2); }
  .gm-head img { width: 44px; height: 44px; }
  .gm-word { display: inline-flex; flex-direction: column; gap: 0.1em; font-size: 1.32rem; line-height: 0.95; text-transform: uppercase; }
  .gm-word .a { font: 900 1em "Archivo", "Montserrat", sans-serif; font-stretch: 125%; color: #fff; }
  .gm-word .g { display: flex; align-items: center; gap: 0.4em; font: 800 0.42em "Archivo", "Montserrat", sans-serif; font-stretch: 125%; color: #ffd21f; }
  .gm-word .g i { font-style: normal; letter-spacing: 0.5em; margin-right: -0.5em; }
  .gm-word .g::before, .gm-word .g::after { content: ""; flex: 1; height: 0.18em; border-radius: 999px; background: currentColor; }
  .gm-x { margin-left: auto; width: 36px; height: 36px; border: 0; border-radius: 10px; cursor: pointer; font-size: 1.1rem; color: #cfe0ff; background: rgba(255, 255, 255, 0.07); }
  .gm-x:hover, .gm-x:focus-visible { background: rgba(255, 255, 255, 0.15); outline: none; }
  .gm-label { margin: 0.7rem 0.4rem 0.2rem; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #8cb4ef; }
  .gm-drawer a { display: flex; align-items: center; gap: 0.7rem; min-height: 44px; padding: 0.35rem 0.6rem; border-radius: 10px; color: inherit; text-decoration: none; }
  .gm-drawer a:hover, .gm-drawer a:focus-visible { background: rgba(58, 155, 255, 0.16); outline: none; }
  .gm-drawer a.on { background: rgba(58, 155, 255, 0.24); box-shadow: inset 3px 0 0 #3a9bff; font-weight: 700; }
  .gm-drawer a img { width: 30px; height: 30px; border-radius: 8px; flex: none; }
  .gm-drawer a .gm-i { width: 30px; text-align: center; font-size: 1.25rem; flex: none; }
  .gm-foot { margin-top: auto; padding-top: 0.8rem; border-top: 1px solid rgba(120, 170, 255, 0.2); }
  @media (prefers-reduced-motion: reduce) { .gm-drawer, .gm-back { transition: none; } }`;
  document.head.appendChild(css);
  if (!document.querySelector('link[href*="family=Archivo"]')) {
    const font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,800;125,900&display=swap';
    document.head.appendChild(font);
  }

  const burger = document.createElement('button');
  burger.type = 'button';
  burger.className = 'gm-burger';
  burger.setAttribute('aria-label', 'Menu');
  burger.setAttribute('aria-expanded', 'false');
  burger.setAttribute('aria-controls', 'gm-drawer');
  burger.innerHTML = '<i aria-hidden="true"></i>';

  const back = document.createElement('div');
  back.className = 'gm-back';

  const drawer = document.createElement('nav');
  drawer.className = 'gm-drawer';
  drawer.id = 'gm-drawer';
  drawer.setAttribute('aria-label', 'Ahrens Games');
  drawer.setAttribute('aria-hidden', 'true');
  drawer.innerHTML = `
    <div class="gm-head"><img src="/img/ahrens-games-logo.webp?v=6" alt=""><span class="gm-word"><span class="a">Ahrens</span> <span class="g"><i>Games</i></span></span><button type="button" class="gm-x" aria-label="Close menu">✕</button></div>
    <a href="/board-games.html"${cur('board-games')}><img src="/img/board-games-favicon-48.png?v=8" alt="">All games</a>
    <a href="/game-history.html"${cur('game-history')}><span class="gm-i" aria-hidden="true">🏆</span>Game history</a>
    <p class="gm-label">Games</p>
    ${GAMES.map((g) => `<a href="${g.href}"${cur(g.page)}><img src="${g.icon}" alt="" loading="lazy">${g.name}</a>`).join('')}
    <div class="gm-foot">
      <a href="/index.html"><span class="gm-i" aria-hidden="true">←</span>Ahrens Labs home</a>
      <a href="/account-dashboard.html"><span class="gm-i" aria-hidden="true">👤</span>Account</a>
    </div>`;

  const links = () => [...drawer.querySelectorAll('a, button')];
  function open() {
    document.documentElement.classList.add('gm-open');
    burger.setAttribute('aria-expanded', 'true');
    drawer.setAttribute('aria-hidden', 'false');
    (drawer.querySelector('a.on') || links()[1]).focus();
  }
  function close(refocus) {
    document.documentElement.classList.remove('gm-open');
    burger.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    if (refocus) burger.focus();
  }
  burger.addEventListener('click', () => (document.documentElement.classList.contains('gm-open') ? close(true) : open()));
  back.addEventListener('click', () => close(false));
  drawer.querySelector('.gm-x').addEventListener('click', () => close(true));
  drawer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return close(true);
    if (e.key !== 'Tab') return;
    const l = links();
    if (e.shiftKey && document.activeElement === l[0]) {
      e.preventDefault();
      l[l.length - 1].focus();
    } else if (!e.shiftKey && document.activeElement === l[l.length - 1]) {
      e.preventDefault();
      l[0].focus();
    }
  });

  document.body.append(burger, back, drawer);
})();
