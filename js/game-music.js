// Background music for the board games: one looping track per game, on unless the player turns it off.
// Configured from the script tag: data-key (saved on/off), data-src, data-loop="start,end" in seconds.
// The track is only downloaded once music is wanted, and only plays while a game header with a
// [data-music] button is on screen and the tab is visible.
(function () {
  const me = document.currentScript;
  const cfg = {
    key: me.dataset.key,
    src: me.dataset.src,
    loop: (me.dataset.loop || '0,0').split(',').map(Number),
    vol: Number(me.dataset.vol || 0.5),
  };
  let ctx = null;
  let gain = null;
  let source = null;
  let buffer = null;
  let loading = null;
  let unlocked = false;
  let idleTimer = 0;
  let target = 0;

  const isOn = () => localStorage.getItem(cfg.key) !== 'off';
  const wanted = () => unlocked && isOn() && !document.hidden && !!document.querySelector('[data-music]');

  function inner(on, labelCls) {
    return `${on ? '🎵' : '🔇'}${labelCls ? `<span class="${labelCls}"> Music</span>` : ''}`;
  }

  function buttonHtml(cls, labelCls) {
    const on = isOn();
    return `<button type="button" class="${cls} music-btn${on ? '' : ' off'}" data-music data-label="${labelCls || ''}" aria-pressed="${on}" aria-label="Music" title="${on ? 'Music is on' : 'Music is off'}">${inner(on, labelCls)}</button>`;
  }

  function paintButtons() {
    const on = isOn();
    document.querySelectorAll('[data-music]').forEach((b) => {
      b.classList.toggle('off', !on);
      b.setAttribute('aria-pressed', String(on));
      b.title = on ? 'Music is on' : 'Music is off';
      b.innerHTML = inner(on, b.dataset.label);
    });
  }

  function fadeTo(v, secs) {
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(v, t + secs);
  }

  function load() {
    if (!loading) {
      loading = fetch(cfg.src)
        .then((r) => r.arrayBuffer())
        .then((a) => new Promise((res, rej) => ctx.decodeAudioData(a, res, rej)))
        .then((b) => { buffer = b; return b; })
        .catch(() => { loading = null; return null; });
    }
    return loading;
  }

  // Must first run inside a tap or key press so the browser lets the page make sound.
  function wake() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  async function play() {
    wake();
    if (!ctx) return;
    clearTimeout(idleTimer);
    const b = buffer || (await load());
    if (!b || !wanted()) return;
    if (!source) {
      source = ctx.createBufferSource();
      source.buffer = b;
      source.loop = true;
      source.loopStart = cfg.loop[0];
      source.loopEnd = cfg.loop[1] || b.duration;
      source.connect(gain);
      source.start(0, cfg.loop[0]);
    }
    if (target !== cfg.vol) {
      target = cfg.vol;
      fadeTo(cfg.vol, 2);
    }
  }

  function pause() {
    if (!ctx || !source || target === 0) return;
    target = 0;
    fadeTo(0, 0.6);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!wanted() && ctx.state === 'running') ctx.suspend().catch(() => {});
    }, 700);
  }

  function sync() {
    if (wanted()) play();
    else pause();
  }

  function gesture() {
    unlocked = true;
    if (isOn()) wake();
    sync();
  }
  ['click', 'touchend', 'keydown'].forEach((t) => document.addEventListener(t, gesture, true));

  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-music]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    localStorage.setItem(cfg.key, isOn() ? 'off' : 'on');
    paintButtons();
    sync();
  });

  document.addEventListener('visibilitychange', sync);
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync();
    });
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });

  window.GameMusic = { buttonHtml, state: () => ({ ctx: ctx ? ctx.state : null, playing: !!source, target, loaded: !!buffer }) };
})();
