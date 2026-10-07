// Narrated video tutorials for the board games, shown in a lightweight modal.
// Usage: any element with data-tutorial="dino" | "hearthhold" opens that video,
// or call window.AhrensTutorial.open('dino').
(function () {
  const VIDEOS = {
    dino: { title: 'Dino Board Game — video tutorial', src: '/video/dino-tutorial.mp4', poster: '/video/dino-tutorial.jpg' },
    hearthhold: { title: 'Hearthhold — video tutorial', src: '/video/hearthhold-tutorial.mp4', poster: '/video/hearthhold-tutorial.jpg' },
  };

  const css = `
    .tutv-back { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; padding: 1rem;
      background: rgba(10, 6, 2, 0.78); backdrop-filter: blur(3px); animation: tutvIn 0.2s ease; }
    @keyframes tutvIn { from { opacity: 0; } to { opacity: 1; } }
    .tutv { width: min(1100px, 100%); background: #1d140b; border-radius: 16px; overflow: hidden;
      box-shadow: 0 0 0 3px #6b4a2a, 0 24px 60px rgba(0, 0, 0, 0.6); }
    .tutv-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.6rem 0.8rem 0.6rem 1.1rem;
      color: #ffe7a8; font: 700 1.05rem/1.2 Fredoka, system-ui, sans-serif; }
    .tutv-x { flex: none; width: 2.2rem; height: 2.2rem; border-radius: 50%; border: 0; cursor: pointer; font-size: 1.1rem;
      background: #3a2a18; color: #fff; }
    .tutv-x:hover { background: #5a4026; }
    .tutv video { display: block; width: 100%; max-height: calc(100vh - 7rem); aspect-ratio: 16 / 10; background: #000; }`;

  let back = null;
  let lastFocus = null;

  function close() {
    if (!back) return;
    const v = back.querySelector('video');
    if (v) v.pause();
    back.remove();
    back = null;
    document.removeEventListener('keydown', onKey, true);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function onKey(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  }

  function open(id) {
    const v = VIDEOS[id];
    if (!v) return;
    if (!document.getElementById('tutv-style')) {
      const st = document.createElement('style');
      st.id = 'tutv-style';
      st.textContent = css;
      document.head.appendChild(st);
    }
    close();
    lastFocus = document.activeElement;
    back = document.createElement('div');
    back.className = 'tutv-back';
    back.setAttribute('role', 'dialog');
    back.setAttribute('aria-modal', 'true');
    back.setAttribute('aria-label', v.title);
    back.innerHTML = `<div class="tutv"><div class="tutv-head"><span>🎬 ${v.title}</span><button class="tutv-x" aria-label="Close video">✕</button></div>
      <video controls autoplay playsinline preload="metadata" poster="${v.poster}" src="${v.src}"></video></div>`;
    back.addEventListener('click', (e) => {
      if (e.target === back || e.target.closest('.tutv-x')) close();
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(back);
    back.querySelector('.tutv-x').focus();
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('[data-tutorial]');
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    open(t.dataset.tutorial);
  }, true);

  // The dino game re-renders its toolbars, so keep a Tutorial button next to every Rules button.
  const auto = document.currentScript && document.currentScript.dataset.autoButton;
  if (auto) {
    const place = () => {
      document.querySelectorAll('[data-act="rules"]').forEach((r) => {
        const next = r.nextElementSibling;
        if (next && next.dataset && next.dataset.tutorial) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = r.className;
        b.dataset.tutorial = auto;
        b.textContent = '🎬 Tutorial';
        b.title = 'Watch the video tutorial';
        r.after(b);
      });
    };
    new MutationObserver(place).observe(document.documentElement, { childList: true, subtree: true });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', place);
    else place();
  }

  window.AhrensTutorial = { open, close };
})();
