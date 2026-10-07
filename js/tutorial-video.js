// Narrated video tutorials for the board games, with chapters and optional captions.
// - Any element with data-tutorial="dino" | "hearthhold" opens that video in a modal.
// - AhrensTutorial.embed(id) returns markup for an inline player (e.g. a Rules tab);
//   call AhrensTutorial.mount(container) after inserting it.
(function () {
  const VIDEOS = {
    dino: { title: 'Dino Dynasty — video tutorial', base: '/video/dino-tutorial' },
    hearthhold: { title: 'Oakhaven — video tutorial', base: '/video/hearthhold-tutorial' },
  };
  const V = '?v=5';
  const CC_KEY = 'ahrensTutorial.cc';

  const css = `
    .tutv-back { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; padding: 1rem;
      background: rgba(10, 6, 2, 0.78); backdrop-filter: blur(3px); animation: tutvIn 0.2s ease; overflow: auto; }
    @keyframes tutvIn { from { opacity: 0; } to { opacity: 1; } }
    .tutv { width: min(1100px, 100%); background: #1d140b; border-radius: 16px; overflow: hidden;
      box-shadow: 0 0 0 3px #6b4a2a, 0 24px 60px rgba(0, 0, 0, 0.6); }
    .tutv-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.6rem 0.8rem 0.6rem 1.1rem;
      color: #ffe7a8; font: 700 1.05rem/1.2 Fredoka, system-ui, sans-serif; }
    .tutv-x { flex: none; width: 2.2rem; height: 2.2rem; border-radius: 50%; border: 0; cursor: pointer; font-size: 1.1rem;
      background: #3a2a18; color: #fff; }
    .tutv-x:hover { background: #5a4026; }
    .tutv .tutv-embed { padding: 0 0.8rem 0.8rem; color: #ffe7a8; }
    .tutv-embed video { display: block; width: 100%; max-height: min(70vh, calc(100vh - 14rem)); aspect-ratio: 160 / 99; background: #000; border-radius: 10px; }
    .tutv-bar { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; margin: 0.55rem 0 0.4rem; }
    .tutv-bar button, .tutv-chaps button { font-family: inherit; font-size: 0.85rem; font-weight: 600; line-height: 1.2; cursor: pointer; border-radius: 999px; border: 0;
      padding: 0.38rem 0.75rem; background: #3a2a18; color: #fff; box-shadow: inset 0 0 0 1.5px #6b4a2a; }
    .tutv-bar button:hover, .tutv-chaps button:hover { background: #5a4026; }
    .tutv-bar button[aria-pressed="true"] { background: #f2c14e; color: #3b2300; box-shadow: none; }
    .tutv-bar .tutv-hint { font-size: 0.78rem; opacity: 0.75; margin-left: auto; }
    .tutv-chaps { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .tutv-chaps button { border-radius: 10px; text-align: left; }
    .tutv-chaps button small { opacity: 0.7; margin-right: 0.35rem; font-variant-numeric: tabular-nums; }
    .tutv-chaps button.on { background: #f2c14e; color: #3b2300; box-shadow: none; }
    .rules .tutv-embed { color: inherit; }
    .rules .tutv-embed video { max-height: 55vh; }
    .rules .tutv-bar button, .rules .tutv-chaps button { background: #fff6e0; color: #4a3218; box-shadow: inset 0 0 0 1.5px #d9c08a; }
    .rules .tutv-bar button:hover, .rules .tutv-chaps button:hover { background: #ffeec2; }
    .rules .tutv-bar button[aria-pressed="true"], .rules .tutv-chaps button.on { background: #f2c14e; color: #3b2300; box-shadow: none; }
    .tutv-embed video::cue { font-size: 1.05em; background: rgba(0, 0, 0, 0.78); }`;

  function addStyle() {
    if (document.getElementById('tutv-style')) return;
    const st = document.createElement('style');
    st.id = 'tutv-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  const ccOn = () => {
    try {
      return localStorage.getItem(CC_KEY) === '1';
    } catch (e) {
      return false;
    }
  };
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  function embed(id, { autoplay = false } = {}) {
    const v = VIDEOS[id];
    if (!v) return '';
    addStyle();
    return `<div class="tutv-embed" data-tutv="${id}">
      <video controls playsinline preload="metadata"${autoplay ? ' autoplay' : ''} poster="${v.base}.jpg${V}" src="${v.base}.mp4${V}">
        <track kind="captions" srclang="en" label="English" src="${v.base}.vtt${V}">
      </video>
      <div class="tutv-bar">
        <button type="button" data-tutv-skip="-10" title="Back 10 seconds">⏪ 10s</button>
        <button type="button" data-tutv-skip="10" title="Forward 10 seconds">10s ⏩</button>
        <button type="button" data-tutv-cc aria-pressed="false" title="Show or hide captions">💬 Captions</button>
        <span class="tutv-hint">Jump to a part:</span>
      </div>
      <div class="tutv-chaps"></div>
    </div>`;
  }

  const chapterCache = {};
  function chapters(id) {
    if (!chapterCache[id]) {
      chapterCache[id] = fetch(VIDEOS[id].base + '.json' + V)
        .then((r) => (r.ok ? r.json() : { chapters: [] }))
        .then((j) => j.chapters || [])
        .catch(() => []);
    }
    return chapterCache[id];
  }

  function setCaptions(box, on) {
    const video = box.querySelector('video');
    const tr = video && video.textTracks && video.textTracks[0];
    if (tr) tr.mode = on ? 'showing' : 'hidden';
    const b = box.querySelector('[data-tutv-cc]');
    if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function mount(root) {
    (root || document).querySelectorAll('.tutv-embed:not([data-mounted])').forEach((box) => {
      box.dataset.mounted = '1';
      const id = box.dataset.tutv;
      const video = box.querySelector('video');
      setCaptions(box, ccOn());
      video.addEventListener('loadedmetadata', () => setCaptions(box, ccOn()));
      // Keep our button in step with the player's own CC menu.
      if (video.textTracks)
        video.textTracks.addEventListener('change', () => {
          const tr = video.textTracks[0];
          const b = box.querySelector('[data-tutv-cc]');
          if (tr && b) b.setAttribute('aria-pressed', tr.mode === 'showing' ? 'true' : 'false');
        });
      chapters(id).then((list) => {
        const wrap = box.querySelector('.tutv-chaps');
        if (!list.length) {
          box.querySelector('.tutv-hint').textContent = 'Drag the bar under the video to skip ahead.';
          return;
        }
        wrap.innerHTML = list.map((c, i) => `<button type="button" data-tutv-seek="${c.t}" data-i="${i}"><small>${fmt(c.t)}</small>${c.title}</button>`).join('');
        const btns = [...wrap.querySelectorAll('button')];
        const mark = () => {
          let cur = -1;
          list.forEach((c, i) => {
            if (video.currentTime + 0.25 >= c.t) cur = i;
          });
          btns.forEach((b, i) => b.classList.toggle('on', i === cur));
        };
        video.addEventListener('timeupdate', mark);
        video.addEventListener('seeked', mark);
      });
    });
  }

  function seek(video, t) {
    const go = () => {
      const max = isFinite(video.duration) ? video.duration - 0.5 : t;
      video.currentTime = Math.max(0, Math.min(max, t));
      video.play().catch(() => {});
    };
    if (video.readyState >= 1) go();
    else video.addEventListener('loadedmetadata', go, { once: true });
  }

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
    addStyle();
    close();
    lastFocus = document.activeElement;
    back = document.createElement('div');
    back.className = 'tutv-back';
    back.setAttribute('role', 'dialog');
    back.setAttribute('aria-modal', 'true');
    back.setAttribute('aria-label', v.title);
    back.innerHTML = `<div class="tutv"><div class="tutv-head"><span>🎬 ${v.title}</span><button class="tutv-x" aria-label="Close video">✕</button></div>${embed(id, { autoplay: true })}</div>`;
    back.addEventListener('click', (e) => {
      if (e.target === back || e.target.closest('.tutv-x')) close();
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(back);
    mount(back);
    back.querySelector('.tutv-x').focus();
  }

  document.addEventListener(
    'click',
    (e) => {
      const t = e.target.closest && e.target.closest('[data-tutorial], [data-tutv-seek], [data-tutv-skip], [data-tutv-cc]');
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      if (t.dataset.tutorial) return open(t.dataset.tutorial);
      const box = t.closest('.tutv-embed');
      const video = box && box.querySelector('video');
      if (!video) return;
      if (t.dataset.tutvSeek != null) seek(video, parseFloat(t.dataset.tutvSeek));
      else if (t.dataset.tutvSkip != null) seek(video, video.currentTime + parseFloat(t.dataset.tutvSkip));
      else {
        const on = t.getAttribute('aria-pressed') !== 'true';
        try {
          localStorage.setItem(CC_KEY, on ? '1' : '0');
        } catch (err) {}
        setCaptions(box, on);
      }
    },
    true
  );

  window.AhrensTutorial = { open, close, embed, mount };
})();
