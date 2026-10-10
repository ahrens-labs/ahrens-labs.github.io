// Background music for the board games: one looping track per game, on unless the player turns it off.
// Configured from the script tag: data-key (saved on/off), data-src, data-loop="start,end" in seconds.
// The track is only downloaded once music is wanted, and only plays while a game header with a
// [data-music] button is on screen and the tab is visible.
// Plays through an <audio> element (not Web Audio) so iPhones play it with the ringer switch on silent.
// The track is fetched into a blob first: Safari won't play media URLs from hosts that ignore Range requests.
// The file carries half a second of the loop's own audio past each loop point, so jumping back by one
// loop length anywhere in that margin is seamless.
(function () {
  const me = document.currentScript;
  const cfg = {
    key: me.dataset.key,
    src: me.dataset.src,
    loop: (me.dataset.loop || '0,0').split(',').map(Number),
    vol: Number(me.dataset.vol || 0.75),
  };
  const loopLen = cfg.loop[1] - cfg.loop[0];
  const SILENT = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
  let audio = null;
  let blobUrl = null;
  let loading = null;
  let unlocked = false;
  let target = 0;
  let fadeTimer = 0;
  let canFade = true;
  let lastError = '';

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

  function wrap() {
    if (audio && loopLen > 0 && audio.currentTime >= cfg.loop[1]) audio.currentTime -= loopLen;
  }

  function tick() {
    if (!audio || audio.paused) return;
    wrap();
    requestAnimationFrame(tick);
  }

  function el() {
    if (!audio) {
      audio = new Audio();
      audio.preload = 'auto';
      audio.setAttribute('playsinline', '');
      // iOS ignores volume changes; there the track plays at full level and fades are skipped.
      audio.volume = 0.5;
      canFade = audio.volume === 0.5;
      audio.volume = 0;
      audio.addEventListener('timeupdate', wrap);
      audio.addEventListener('playing', tick);
      audio.addEventListener('ended', () => {
        if (!blobUrl) return;
        audio.currentTime = cfg.loop[0];
        if (wanted()) audio.play().catch(() => {});
      });
      if ('mediaSession' in navigator && window.MediaMetadata) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: document.title });
      }
    }
    return audio;
  }

  function load() {
    if (!loading) {
      loading = fetch(cfg.src)
        .then((r) => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.blob();
        })
        .then((b) => new Promise((res, rej) => {
          const a = el();
          a.pause();
          a.addEventListener('loadedmetadata', () => {
            a.currentTime = cfg.loop[0];
            res();
          }, { once: true });
          a.addEventListener('error', () => rej(new Error('decode ' + (a.error && a.error.code))), { once: true });
          blobUrl = URL.createObjectURL(b.type ? b : new Blob([b], { type: 'audio/mpeg' }));
          a.src = blobUrl;
          a.load();
        }))
        .then(sync)
        .catch((e) => {
          lastError = e && e.message ? e.message : String(e);
          loading = null;
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          blobUrl = null;
        });
    }
    return loading;
  }

  function fadeTo(v, secs, done) {
    clearInterval(fadeTimer);
    if (!canFade) {
      if (done) done();
      return;
    }
    const from = audio.volume;
    const steps = Math.max(1, Math.round(secs * 20));
    let i = 0;
    fadeTimer = setInterval(() => {
      i++;
      audio.volume = Math.min(1, Math.max(0, from + ((v - from) * i) / steps));
      if (i >= steps) {
        clearInterval(fadeTimer);
        if (done) done();
      }
    }, 50);
  }

  function play() {
    const a = el();
    if (!blobUrl) {
      load();
      return;
    }
    if (target === cfg.vol && !a.paused) return;
    target = cfg.vol;
    a.muted = false;
    const p = a.play();
    if (p && p.catch) {
      p.catch((e) => {
        lastError = e && e.name ? e.name : String(e);
        target = 0;
      });
    }
    fadeTo(cfg.vol, 2);
  }

  function pause() {
    if (!audio || target === 0) return;
    target = 0;
    if (document.hidden) {
      clearInterval(fadeTimer);
      audio.pause();
      return;
    }
    fadeTo(0, 0.6, () => {
      if (!wanted()) audio.pause();
    });
  }

  function sync() {
    if (wanted()) play();
    else pause();
  }

  // Browsers only let a page start sound from inside a tap or key press. The first one plays the
  // element (muted, on a silent clip if the track isn't in yet) so later plays outside a tap are allowed.
  function gesture() {
    const first = !unlocked;
    unlocked = true;
    if (!isOn()) return sync();
    if (navigator.audioSession) {
      try { navigator.audioSession.type = 'playback'; } catch (e) {}
    }
    if (blobUrl && wanted()) return play();
    if (first) {
      const a = el();
      if (!blobUrl) a.src = SILENT;
      a.muted = true;
      const p = a.play();
      const settle = () => {
        if (target === 0 || a.src === SILENT) a.pause();
        a.muted = false;
      };
      if (p && p.then) p.then(settle, settle);
    }
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

  window.GameMusic = {
    buttonHtml,
    state: () => ({
      playing: !!audio && !audio.paused,
      time: audio ? Math.round(audio.currentTime * 100) / 100 : 0,
      volume: audio ? Math.round(audio.volume * 100) / 100 : 0,
      muted: !!audio && audio.muted,
      target,
      error: lastError,
      loaded: !!blobUrl,
    }),
    seek: (t) => { if (audio) audio.currentTime = t; },
  };
})();
