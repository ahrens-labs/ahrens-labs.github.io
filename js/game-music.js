// Background music and sound effects for the board games.
// Configured from the script tag: data-key (saved setting), data-src + data-loop="start,end" (seconds) for the
// main track, and optionally data-alt-src / data-alt-loop / data-alt-when (a CSS selector) for a second track
// that plays instead while that selector matches, e.g. Oakhaven's night.
// The setting cycles: music and sounds → sounds only → off. Tracks are only downloaded once they're wanted,
// and only play while a game header with a [data-music] button is on screen and the tab is visible.
// Music plays through <audio> elements (not Web Audio) so iPhones play it with the ringer switch on silent.
// Each track is fetched into a blob first: Safari won't play media URLs from hosts that ignore Range requests.
// The files carry half a second of the loop's own audio past each loop point, so jumping back by one loop
// length anywhere in that margin is seamless.
// Sound effects are synthesized once into short WAV clips and played through <audio> elements too.
(function () {
  const me = document.currentScript;
  const ds = me.dataset;
  const VOL = Number(ds.vol || 0.9);
  const SILENT = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

  function trackOf(src, loop, vol, when) {
    if (!src) return null;
    const [a, b] = (loop || '0,0').split(',').map(Number);
    return { src, a, b, len: b - a, vol, when, el: null, blobUrl: null, loading: null, target: 0, fadeTimer: 0, lastError: '' };
  }
  const main = trackOf(ds.src, ds.loop, VOL, null);
  const alt = trackOf(ds.altSrc, ds.altLoop, Math.min(1, VOL * Number(ds.altVol || 1)), ds.altWhen);
  const tracks = [main, alt].filter(Boolean);

  let unlocked = false;
  let canFade = true;

  // 'all' (music + sounds), 'sfx' (sounds only) or 'off'. Older saves only ever stored 'off'.
  const mode = () => {
    const v = localStorage.getItem(ds.key);
    return v === 'off' || v === 'sfx' ? v : 'all';
  };
  const musicOn = () => mode() === 'all';
  const sfxOn = () => mode() !== 'off';
  const onScreen = () => !document.hidden && !!document.querySelector('[data-music]');
  const current = () => (alt && alt.when && document.querySelector(alt.when) ? alt : main);
  const wanted = (t) => unlocked && musicOn() && onScreen() && current() === t;

  const LOOK = {
    all: ['🎵', 'Music', 'Music and sounds on — tap for sounds only'],
    sfx: ['🔔', 'Sounds', 'Sounds only — tap to turn everything off'],
    off: ['🔇', 'Muted', 'Muted — tap to turn music and sounds on'],
  };
  function inner(m, labelCls) {
    return `${LOOK[m][0]}${labelCls ? `<span class="${labelCls}"> ${LOOK[m][1]}</span>` : ''}`;
  }

  function buttonHtml(cls, labelCls) {
    const m = mode();
    return `<button type="button" class="${cls} music-btn${m === 'all' ? '' : ' off'}" data-music data-label="${labelCls || ''}" aria-label="Sound: ${LOOK[m][1]}" title="${LOOK[m][2]}">${inner(m, labelCls)}</button>`;
  }

  function paintButtons() {
    const m = mode();
    document.querySelectorAll('[data-music]').forEach((b) => {
      b.classList.toggle('off', m !== 'all');
      b.setAttribute('aria-label', `Sound: ${LOOK[m][1]}`);
      b.title = LOOK[m][2];
      b.innerHTML = inner(m, b.dataset.label);
    });
  }

  // ---------------------------------------------------------------- music
  function wrap(t) {
    const e = t.el;
    if (e && t.blobUrl && t.len > 0 && e.currentTime >= t.b) e.currentTime -= t.len;
  }

  function el(t) {
    if (!t.el) {
      const e = new Audio();
      t.el = e;
      e.preload = 'auto';
      e.setAttribute('playsinline', '');
      // iOS ignores volume changes; there tracks play at full level and fades are skipped.
      e.volume = 0.5;
      canFade = e.volume === 0.5;
      e.volume = 0;
      e.addEventListener('timeupdate', () => wrap(t));
      e.addEventListener('playing', function tick() {
        if (e.paused) return;
        wrap(t);
        requestAnimationFrame(() => tick());
      });
      e.addEventListener('ended', () => {
        if (!t.blobUrl) return;
        e.currentTime = t.a;
        if (wanted(t)) e.play().catch(() => {});
      });
    }
    return t.el;
  }

  function load(t) {
    if (!t.loading) {
      t.loading = fetch(t.src)
        .then((r) => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.blob();
        })
        .then((b) => new Promise((res, rej) => {
          const e = el(t);
          e.pause();
          e.addEventListener('loadedmetadata', () => {
            e.currentTime = t.a;
            res();
          }, { once: true });
          e.addEventListener('error', () => rej(new Error('decode ' + (e.error && e.error.code))), { once: true });
          t.blobUrl = URL.createObjectURL(b.type ? b : new Blob([b], { type: 'audio/mpeg' }));
          e.src = t.blobUrl;
          e.load();
        }))
        .then(sync)
        .catch((err) => {
          t.lastError = err && err.message ? err.message : String(err);
          t.loading = null;
          if (t.blobUrl) URL.revokeObjectURL(t.blobUrl);
          t.blobUrl = null;
        });
    }
    return t.loading;
  }

  function fadeTo(t, v, secs, done) {
    clearInterval(t.fadeTimer);
    clearTimeout(t.duckTimer);
    t.fading = false;
    if (!canFade) {
      if (done) done();
      return;
    }
    t.fading = true;
    const e = t.el;
    const from = e.volume;
    const steps = Math.max(1, Math.round(secs * 20));
    let i = 0;
    t.fadeTimer = setInterval(() => {
      i++;
      e.volume = Math.min(1, Math.max(0, from + ((v - from) * i) / steps));
      if (i >= steps) {
        clearInterval(t.fadeTimer);
        t.fading = false;
        if (done) done();
      }
    }, 50);
  }

  function play(t) {
    const e = el(t);
    if (!t.blobUrl) {
      load(t);
      return;
    }
    if (t.target === t.vol && !e.paused) return;
    t.target = t.vol;
    e.muted = false;
    const p = e.play();
    if (p && p.catch) {
      p.catch((err) => {
        t.lastError = err && err.name ? err.name : String(err);
        t.target = 0;
      });
    }
    fadeTo(t, t.vol, 1.5);
  }

  function pause(t) {
    if (!t.el || t.target === 0) return;
    t.target = 0;
    if (document.hidden) {
      clearInterval(t.fadeTimer);
      t.el.pause();
      return;
    }
    fadeTo(t, 0, 0.8, () => {
      if (!wanted(t)) t.el.pause();
    });
  }

  let prefetch = 0;
  function sync() {
    tracks.forEach((t) => (wanted(t) ? play(t) : pause(t)));
    // Fetch the other track once the first is playing, so switching to it is instant.
    if (alt && !alt.loading && !prefetch && musicOn() && main.target > 0) {
      prefetch = setTimeout(() => {
        if (musicOn()) load(alt);
      }, 15000);
    }
  }

  // ---------------------------------------------------------------- sound effects
  // Each effect is synthesized once into a short WAV clip (an offline Web Audio render, which needs no tap
  // and no speaker), then played through <audio> elements like the music, so effects are heard wherever
  // the music is (including iPhones on silent). The music dips briefly under each effect.
  let ctx = null; // the offline context currently being rendered into
  let bus = null;
  let noiseBuf = null;
  const clips = {};
  let rendering = null;
  const POOL = 6;
  const pool = [];
  let poolNext = 0;
  const lastAt = {};

  // One enveloped tone. o: { type, vol, to (glide target Hz), attack }
  function tone(at, freq, dur, o = {}) {
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const v = o.vol == null ? 0.3 : o.vol;
    const atk = o.attack || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // A filtered noise burst. o: { type (filter), freq, to, q, vol }
  function noise(at, dur, o = {}) {
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1500, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  function wav(data, sr) {
    const buf = new ArrayBuffer(44 + data.length * 2);
    const v = new DataView(buf);
    const str = (o, x) => [...x].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
    str(0, 'RIFF');
    v.setUint32(4, 36 + data.length * 2, true);
    str(8, 'WAVEfmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, sr, true);
    v.setUint32(28, sr * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    str(36, 'data');
    v.setUint32(40, data.length * 2, true);
    for (let i = 0; i < data.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 32767, true);
    return new Blob([buf], { type: 'audio/wav' });
  }

  function renderClips() {
    if (rendering) return rendering;
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return (rendering = Promise.resolve());
    const sr = 44100;
    const jobs = Object.keys(SFX).map((name) => {
      ctx = new OAC(1, sr * 2, sr);
      bus = ctx.createGain();
      bus.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, sr, sr);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      SFX[name]();
      const c = ctx;
      return new Promise((res) => {
        c.oncomplete = (e) => res(e.renderedBuffer);
        const p = c.startRendering();
        if (p && p.then) p.then(res, () => res(null));
      }).then((b) => [name, b]);
    });
    rendering = Promise.all(jobs).then((list) => {
      // Every clip goes out near full scale with gentle saturation, so short blips still cut through music.
      const drive = 1.8;
      const norm = Math.tanh(drive);
      list.forEach(([name, b]) => {
        if (!b) return;
        const x = b.getChannelData(0);
        const p = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
        if (!p) return;
        let end = x.length;
        while (end > 1 && Math.abs(x[end - 1]) < p * 1e-3) end--;
        const out = new Float32Array(Math.min(x.length, end + 441));
        for (let i = 0; i < out.length; i++) out[i] = (0.94 * Math.tanh((drive * x[i]) / p)) / norm;
        clips[name] = URL.createObjectURL(wav(out, sr));
      });
    }).catch(() => {});
    return rendering;
  }

  function poolEl(i) {
    if (!pool[i]) {
      const e = new Audio();
      e.preload = 'auto';
      e.setAttribute('playsinline', '');
      pool[i] = e;
    }
    return pool[i];
  }

  // Dip whichever music is playing under an effect, then bring it back.
  function duck() {
    if (!canFade) return;
    tracks.forEach((t) => {
      if (!t.el || t.el.paused || t.target <= 0 || t.fading) return;
      t.el.volume = t.target * 0.45;
      clearTimeout(t.duckTimer);
      t.duckTimer = setTimeout(() => fadeTo(t, t.target, 0.5), 450);
    });
  }

  const SFX = {
    // Gaining coins: the classic two-note bling.
    coin: () => {
      tone(0, 1318.5, 0.09, { type: 'triangle', vol: 0.22 });
      tone(0.075, 1975.5, 0.45, { type: 'triangle', vol: 0.22 });
      tone(0.075, 3951, 0.25, { vol: 0.04 });
    },
    // Spending or losing coins: a single soft clink.
    pay: () => {
      tone(0, 1046.5, 0.16, { type: 'triangle', vol: 0.14 });
      tone(0.04, 784, 0.18, { type: 'triangle', vol: 0.1 });
    },
    // Gaining food, materials or other goods.
    gain: () => {
      tone(0, 659.3, 0.12, { vol: 0.2 });
      tone(0.06, 987.8, 0.18, { vol: 0.18 });
    },
    // Putting a piece down: a wooden tock.
    place: () => {
      tone(0, 190, 0.1, { vol: 0.4, to: 110 });
      noise(0, 0.035, { freq: 2200, q: 2, vol: 0.18 });
    },
    // Construction: two hammer knocks.
    build: () => {
      [0, 0.16].forEach((at, i) => {
        tone(at, 240 - i * 30, 0.08, { type: 'triangle', vol: 0.3, to: 140 });
        noise(at, 0.05, { freq: 2800, q: 1.5, vol: 0.22 });
      });
    },
    // A big footstep.
    stomp: () => {
      tone(0, 95, 0.28, { vol: 0.55, to: 45 });
      noise(0, 0.2, { type: 'lowpass', freq: 400, vol: 0.3 });
    },
    // Drawing or taking a card: a paper swish.
    card: () => noise(0, 0.2, { freq: 1200, to: 4200, q: 0.8, vol: 0.16 }),
    // Rolling a die: a short rattle.
    dice: () => {
      for (let i = 0; i < 6; i++) {
        const at = i * 0.07 + Math.random() * 0.03;
        noise(at, 0.03, { type: 'highpass', freq: 2600, vol: 0.18 });
        tone(at, 320 + Math.random() * 260, 0.04, { type: 'triangle', vol: 0.08 });
      }
    },
    // Something new hatching or joining.
    hatch: () => {
      tone(0, 523.3, 0.16, { vol: 0.18, to: 1046.5 });
      tone(0.12, 1568, 0.25, { type: 'triangle', vol: 0.1 });
    },
    // Feeding: a few quick bites.
    munch: () => {
      [0, 0.11, 0.22].forEach((at) => noise(at, 0.07, { type: 'lowpass', freq: 900, vol: 0.28 }));
    },
    // A card or event turning over.
    reveal: () => {
      [1046.5, 1318.5, 1568].forEach((f, i) => tone(i * 0.06, f, 0.5, { vol: 0.08 }));
      noise(0, 0.25, { freq: 3000, to: 6000, q: 0.7, vol: 0.06 });
    },
    // It's your turn again.
    turn: () => {
      tone(0, 784, 0.25, { vol: 0.14 });
      tone(0.12, 1046.5, 0.4, { vol: 0.14 });
    },
    // Success: driven off, goal scored.
    good: () => {
      [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(i * 0.07, f, 0.35, { type: 'triangle', vol: 0.15 }));
    },
    // Setback: breach, villagers leave, dinos lost.
    bad: () => {
      tone(0, 330, 0.3, { type: 'triangle', vol: 0.22, to: 262 });
      tone(0.22, 262, 0.5, { type: 'triangle', vol: 0.22, to: 196 });
    },
    // Night falls / the attack: a low boom.
    night: () => {
      tone(0, 72, 1.2, { vol: 0.6, to: 38 });
      noise(0, 0.9, { type: 'lowpass', freq: 260, vol: 0.35 });
    },
    win: () => {
      [523.3, 659.3, 784].forEach((f, i) => tone(i * 0.12, f, 0.3, { type: 'triangle', vol: 0.16 }));
      [523.3, 659.3, 784, 1046.5].forEach((f) => tone(0.38, f, 1.2, { type: 'triangle', vol: 0.11 }));
    },
    lose: () => {
      [392, 349.2, 311.1].forEach((f, i) => tone(i * 0.22, f, 0.4, { type: 'triangle', vol: 0.16 }));
      tone(0.66, 261.6, 1, { type: 'triangle', vol: 0.15 });
    },
  };

  function sfx(name) {
    if (!sfxOn() || !unlocked || document.hidden || !clips[name]) return;
    const now = performance.now();
    if (lastAt[name] && now - lastAt[name] < 90) return;
    lastAt[name] = now;
    const e = poolEl(poolNext++ % POOL);
    e.pause();
    e.muted = false;
    e.src = clips[name];
    e.volume = 1;
    const p = e.play();
    if (p && p.catch) p.catch(() => {});
    duck();
  }

  // ---------------------------------------------------------------- unlocking
  // Browsers only let a page start sound from inside a tap or key press. The first one plays each music
  // element (muted, on a silent clip if its track isn't in yet) so later plays outside a tap are allowed,
  // and starts the sound-effects engine.
  function gesture() {
    const first = !unlocked;
    unlocked = true;
    if (mode() === 'off') return sync();
    if (navigator.audioSession) {
      try { navigator.audioSession.type = 'playback'; } catch (e) {}
    }
    renderClips();
    if (first) {
      for (let i = 0; i < POOL; i++) {
        const e = poolEl(i);
        e.src = SILENT;
        e.muted = true;
        const p = e.play();
        const settle = () => {
          if (e.src === SILENT) e.pause();
          e.muted = false;
        };
        if (p && p.then) p.then(settle, settle);
      }
      tracks.forEach((t) => {
        if (t.blobUrl && wanted(t)) return;
        const e = el(t);
        if (!t.blobUrl) e.src = SILENT;
        e.muted = true;
        const p = e.play();
        const settle = () => {
          if (t.target === 0 || e.src === SILENT) e.pause();
          e.muted = false;
        };
        if (p && p.then) p.then(settle, settle);
      });
    }
    sync();
  }
  ['click', 'touchend', 'keydown'].forEach((t) => document.addEventListener(t, gesture, true));

  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-music]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    const next = { all: 'sfx', sfx: 'off', off: 'all' }[mode()];
    localStorage.setItem(ds.key, next === 'all' ? 'on' : next);
    paintButtons();
    if (next !== 'off') renderClips();
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

  const trackState = (t) => ({
    playing: !!t.el && !t.el.paused,
    time: t.el ? Math.round(t.el.currentTime * 100) / 100 : 0,
    volume: t.el ? Math.round(t.el.volume * 100) / 100 : 0,
    muted: !!t.el && t.el.muted,
    target: t.target,
    error: t.lastError,
    loaded: !!t.blobUrl,
  });
  window.GameMusic = {
    buttonHtml,
    sfx,
    state: () => Object.assign(trackState(main), { mode: mode(), sfx: Object.keys(clips).length, alt: alt ? trackState(alt) : null }),
    clip: (name) => clips[name] || null,
    pool: () => pool.map((e) => ({ src: (e.src || '').slice(0, 5), paused: e.paused, t: Math.round(e.currentTime * 100) / 100 })),
    seek: (s) => { if (main.el) main.el.currentTime = s; },
  };
})();
