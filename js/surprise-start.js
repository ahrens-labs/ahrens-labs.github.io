// "Surprise me" from the board-game lobby: a link with ?surprise=N opens a game page, picks a game against N
// computer rivals (games for two always have one), and presses start, using the page's own setup screen.
// Load it before the game's own script, which tidies the address bar as it boots.
(function () {
  const n = Number(new URLSearchParams(location.search).get('surprise'));
  if (!n) return;
  const dino = location.pathname.startsWith('/dino-board-game');
  const steps = dino
    ? ['[data-act="setupMode"][data-mode="ai"]', '[data-act="setupStart"]']
    : ['#mode [data-v="ai"]', `#rivals [data-v="${n}"]`, '#start'];
  const until = Date.now() + 8000;
  let i = 0;
  const step = () => {
    if (i >= steps.length || Date.now() > until) return;
    const sel = steps[i];
    const el = document.querySelector(sel);
    // Two-player games have no rivals picker; skip it once the start button is there.
    if (!el && sel.startsWith('#rivals') && document.querySelector('#start')) {
      i += 1;
      return setTimeout(step, 0);
    }
    if (!el) return setTimeout(step, 100);
    el.click();
    i += 1;
    setTimeout(step, 150);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(step, 100));
  else setTimeout(step, 100);
})();
