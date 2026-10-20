// Background music and sound effects for the board games.
// Configured from the script tag: data-key (this page's old setting, read once if there's no shared one yet),
// data-src + data-loop="start,end" (seconds) for the
// main track, and optionally data-alt-src / data-alt-loop / data-alt-when (a CSS selector) for a second track
// that plays instead while that selector matches, e.g. Oakhaven's night.
// The setting cycles: music and sounds → sounds only → off, and is shared by every page (and open tab).
// data-sfx="none" (a page with no sound effects, like the lobby) makes it just music → off there.
// Music and sound effects stop while any video with sound is playing, and come back when it stops. Tracks are only downloaded once they're wanted,
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
  const SFX_USED = ds.sfx !== 'none';
  const MODES = SFX_USED ? ['all', 'sfx', 'off'] : ['all', 'off'];
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

  // 'all' (music + sounds), 'sfx' (sounds only) or 'off', saved once for the whole site. Pages used to keep their
  // own setting; the first page opened since then carries its setting over.
  const KEY = 'ahrens_sound';
  const read = (k) => {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  };
  const store = (v) => {
    try {
      localStorage.setItem(KEY, v);
    } catch (e) {
      /* storage blocked: the setting lasts until the page closes */
    }
  };
  let fallback = 'all';
  if (read(KEY) == null) {
    const old = ds.key ? read(ds.key) : null;
    fallback = old === 'off' || old === 'sfx' ? old : 'all';
    store(fallback);
  }
  const mode = () => {
    const v = read(KEY) || fallback;
    return v === 'off' || v === 'sfx' ? v : 'all';
  };
  const musicOn = () => mode() === 'all';
  const sfxOn = () => SFX_USED && mode() !== 'off' && !videoOn();
  const nextMode = (m) => MODES[(MODES.indexOf(m) + 1) % MODES.length];
  const onScreen = () => !document.hidden && !!document.querySelector('[data-music]');
  const current = () => (alt && alt.when && document.querySelector(alt.when) ? alt : main);
  // Hold the music and sounds while a video with sound plays (tutorials and trailers).
  const videoOn = () => [...document.querySelectorAll('video')].some((v) => !v.paused && !v.ended && !v.muted && v.volume > 0);
  const wanted = (t) => unlocked && musicOn() && onScreen() && !videoOn() && current() === t;

  const LOOK = {
    all: ['🎵', 'Music', SFX_USED ? 'Music and sounds on' : 'Music on'],
    sfx: ['🔔', 'Sounds', 'Sounds only'],
    off: ['🔇', 'Muted', 'Muted'],
  };
  const TAP = { all: SFX_USED ? 'tap to turn music and sounds on' : 'tap for music', sfx: 'tap for sounds only', off: SFX_USED ? 'tap to turn everything off' : 'tap to mute' };
  const title = (m) => `${LOOK[m][2]} — ${TAP[nextMode(m)]}`;
  function inner(m, labelCls) {
    return `${LOOK[m][0]}${labelCls ? `<span class="${labelCls}"> ${LOOK[m][1]}</span>` : ''}`;
  }

  function buttonHtml(cls, labelCls) {
    const m = mode();
    return `<button type="button" class="${cls} music-btn${m === 'all' ? '' : ' off'}" data-music data-label="${labelCls || ''}" aria-label="Sound: ${LOOK[m][1]}" title="${title(m)}">${inner(m, labelCls)}</button>`;
  }

  function paintButtons() {
    const m = mode();
    document.querySelectorAll('[data-music]').forEach((b) => {
      b.classList.toggle('off', m !== 'all');
      b.setAttribute('aria-label', `Sound: ${LOOK[m][1]}`);
      b.title = title(m);
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
    // A video starting cuts the music straight away rather than fading it under the video's own sound.
    if (document.hidden || videoOn()) {
      clearInterval(t.fadeTimer);
      t.el.pause();
      if (canFade) t.el.volume = 0;
      return;
    }
    fadeTo(t, 0, 0.8, () => {
      if (!wanted(t)) t.el.pause();
    });
  }

  let prefetch = 0;
  function sync() {
    tracks.forEach((t) => (wanted(t) ? play(t) : pause(t)));
    if (videoOn()) pool.forEach((e) => e.pause());
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
  const clipLen = {};
  let rendering = null;
  const POOL = 6;
  const pool = [];
  let poolNext = 0;
  const lastAt = {};

  // One enveloped oscillator. o: { type, vol, to (glide target Hz), glide (secs), attack, hold, detune,
  // lp / lpTo / lpAt (a lowpass that sweeps), q, vib (depth as a fraction of freq), vibRate }
  function tone(at, freq, dur, o = {}) {
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.detune) osc.detune.value = o.detune;
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
    if (o.vib) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = o.vibRate || 5.5;
      depth.gain.value = freq * o.vib;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    const v = o.vol == null ? 0.3 : o.vol;
    const atk = o.attack || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + atk);
    if (o.hold) g.gain.setValueAtTime(v, t + atk + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = osc;
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(o.lp, t);
      if (o.lpTo) f.frequency.exponentialRampToValueAtTime(o.lpTo, t + (o.lpAt || dur));
      f.Q.value = o.q || 0.7;
      osc.connect(f);
      out = f;
    }
    out.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // A filtered noise burst. o: { type (filter), freq, to, q, vol, attack }
  function noise(at, dur, o = {}) {
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1500, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // Struck metal or glass: inharmonic partials, the higher ones dying first.
  const BAR = [1, 2.756, 5.404, 8.933];
  const BELL = [0.5, 1, 1.183, 1.506, 2, 2.514, 3.011];
  function strike(at, f, dur, vol, ratios = BAR) {
    ratios.forEach((r, i) => tone(at, f * r, dur / (1 + i * 0.5), { vol: vol / (1 + i * 0.7), attack: 0.002 }));
  }
  // A hollow wooden knock.
  function knock(at, f, vol) {
    noise(at, 0.05, { freq: f * 2.5, q: 6, vol: vol * 0.6, attack: 0.001 });
    tone(at, f, 0.12, { vol, to: f * 0.7, attack: 0.001 });
    tone(at, f * 2.3, 0.05, { vol: vol * 0.4, attack: 0.001 });
  }
  function marimba(at, f, vol) {
    tone(at, f, 0.4, { vol, attack: 0.002 });
    tone(at, f * 4, 0.09, { vol: vol * 0.35, attack: 0.001 });
    tone(at, f * 10, 0.03, { vol: vol * 0.1, attack: 0.001 });
  }
  function pluck(at, f, vol, dur = 0.7) {
    tone(at, f, dur, { type: 'triangle', vol, attack: 0.002 });
    tone(at, f * 2, dur * 0.4, { vol: vol * 0.4, attack: 0.002 });
  }
  function drum(at, f, dur, vol) {
    tone(at, f * 2.2, dur, { vol, to: f, glide: 0.06, attack: 0.002 });
    noise(at, Math.min(0.15, dur), { type: 'lowpass', freq: f * 8, vol: vol * 0.5, attack: 0.001 });
  }
  // A horn note: two detuned saws whose lowpass opens as it speaks.
  function brass(at, f, dur, vol, o = {}) {
    [-7, 7].forEach((det) => tone(at, f, dur, Object.assign({ type: 'sawtooth', vol: vol / 2, attack: 0.035, hold: dur * 0.55, detune: det, lp: f * 1.2, lpTo: f * (o.bright || 5), lpAt: 0.09, q: 1.2 }, o)));
  }
  function room(c, secs) {
    const n = Math.floor(c.sampleRate * secs);
    const ir = c.createBuffer(1, n, c.sampleRate);
    const d = ir.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3) * (i < 200 ? i / 200 : 1);
    return ir;
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

  // RBJ high-pass biquad, used to level clips by what a phone speaker can actually play.
  function highpass(x, sr, f) {
    const w = (2 * Math.PI * f) / sr;
    const al = Math.sin(w) / (2 * Math.SQRT1_2);
    const c = Math.cos(w);
    const a0 = 1 + al;
    const b0 = (1 + c) / 2 / a0;
    const b1 = -(1 + c) / a0;
    const a1 = (-2 * c) / a0;
    const a2 = (1 - al) / a0;
    const y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = b0 * x[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x[i];
      y2 = y1;
      y1 = v;
      y[i] = v;
    }
    return y;
  }

  function renderClips() {
    if (rendering) return rendering;
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return (rendering = Promise.resolve());
    const sr = 44100;
    const jobs = Object.keys(SFX).map((name) => {
      const def = SFX[name];
      ctx = new OAC(1, sr * 3, sr);
      bus = ctx.createGain();
      bus.connect(ctx.destination);
      const verb = ctx.createConvolver();
      verb.buffer = room(ctx, 1.4);
      const wet = ctx.createGain();
      wet.gain.value = def.wet == null ? 0.15 : def.wet;
      bus.connect(verb);
      verb.connect(wet);
      wet.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, sr, sr);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      def.fn();
      const c = ctx;
      return new Promise((res) => {
        c.oncomplete = (e) => res(e.renderedBuffer);
        const p = c.startRendering();
        if (p && p.then) p.then(res, () => res(null));
      }).then((b) => [name, b]);
    });
    rendering = Promise.all(jobs).then((list) => {
      // Each clip is levelled by its loudest 300 ms above 350 Hz (what phone and laptop speakers play, so
      // short clicks and thuds aren't lost under the music), with sub-bass trimmed and peaks soft-limited.
      list.forEach(([name, b]) => {
        if (!b) return;
        const x = highpass(b.getChannelData(0), sr, 90);
        const p = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
        if (!p) return;
        const band = highpass(x, sr, 350);
        const w = Math.floor(sr * 0.3);
        let loud = 0;
        for (let i = 0; i + w <= band.length; i += 1024) {
          let e = 0;
          for (let j = i; j < i + w; j += 2) e += band[j] * band[j];
          loud = Math.max(loud, (2 * e) / w);
        }
        const g = Math.min(Math.pow(10, (SFX[name].level || -10) / 20) / Math.sqrt(loud || 1e-9), 4 / p);
        let end = x.length;
        while (end > 1 && Math.abs(x[end - 1]) < p * 1e-3) end--;
        const out = new Float32Array(Math.min(x.length, end + 441));
        for (let i = 0; i < out.length; i++) out[i] = 0.95 * Math.tanh((x[i] * g) / 0.95);
        clips[name] = URL.createObjectURL(wav(out, sr));
        clipLen[name] = out.length / sr;
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
  function duck(secs) {
    if (!canFade) return;
    tracks.forEach((t) => {
      if (!t.el || t.el.paused || t.target <= 0 || t.fading) return;
      t.el.volume = t.target * 0.45;
      clearTimeout(t.duckTimer);
      t.duckTimer = setTimeout(() => fadeTo(t, t.target, 0.5), Math.min(1800, Math.max(450, secs * 800)));
    });
  }

  // Each sound: fn schedules it; wet is how much room echo; level is its loudness in dB (default −10).
  const SFX = {
    // Coins tumbling onto a pile, then a bright ring.
    coin: { wet: 0.18, fn: () => {
      [0, 0.055, 0.095, 0.125, 0.15].forEach((at, i) => strike(at + Math.random() * 0.01, 2300 + Math.random() * 900, 0.32 - i * 0.04, 0.16 - i * 0.02));
      noise(0, 0.03, { type: 'highpass', freq: 5000, vol: 0.12 });
      strike(0.19, 2637, 0.8, 0.12, BELL.slice(1));
    } },
    // Paying: a purse rustles open and coins are counted out.
    pay: { fn: () => {
      noise(0, 0.14, { freq: 1800, to: 900, q: 0.9, vol: 0.14 });
      [0.12, 0.24, 0.36].forEach((at, i) => strike(at, 1900 - i * 160, 0.24, 0.15));
    } },
    // Goods arrive: a sack thumps down, then a wooden tok-tok.
    gain: { fn: () => {
      tone(0, 140, 0.16, { vol: 0.35, to: 80 });
      noise(0, 0.14, { type: 'lowpass', freq: 700, vol: 0.28 });
      noise(0.02, 0.18, { freq: 2500, q: 0.6, vol: 0.08 });
      marimba(0.13, 784, 0.22);
      marimba(0.22, 1174.7, 0.24);
    } },
    // A wooden piece slides and is set down.
    place: { wet: 0.1, level: -11, fn: () => {
      noise(0, 0.07, { freq: 3500, q: 1.2, vol: 0.06, attack: 0.03 });
      knock(0.06, 620, 0.45);
    } },
    // Construction: a run of hammer blows, light taps then full swings, each nail ringing.
    build: { wet: 0.2, level: -6, fn: () => {
      [[0, 0.55], [0.17, 0.65], [0.42, 0.8], [0.6, 0.85], [0.78, 0.9], [1.02, 0.9], [1.2, 1], [1.38, 1], [1.7, 1]].forEach(([at, v], i) => {
        noise(at, 0.025, { type: 'highpass', freq: 3000, vol: 0.22 * v, attack: 0.001 });
        strike(at, 1650 + (i % 5) * 45 + Math.random() * 60, 0.3, 0.14 * v);
        tone(at, 220, 0.26, { vol: 0.6 * v, to: 95, attack: 0.002 });
        knock(at, 380, 0.4 * v);
        tone(at, 440, 0.12, { type: 'triangle', vol: 0.2 * v, to: 260, attack: 0.002 });
        noise(at, 0.16, { type: 'lowpass', freq: 1000, vol: 0.4 * v, attack: 0.002 });
      });
    } },
    // A stone block is dropped into place, with grit trickling off it.
    wall: { wet: 0.18, level: -8, fn: () => {
      [0, 0.3].forEach((at, i) => {
        tone(at, 130 - i * 15, 0.22, { vol: 0.22, to: 70, attack: 0.002 });
        knock(at, 420 - i * 40, 0.6);
        noise(at, 0.12, { freq: 1600, q: 1.2, vol: 0.5, attack: 0.001 });
        noise(at, 0.25, { freq: 700, q: 0.8, vol: 0.3, attack: 0.001 });
      });
      for (let i = 0; i < 14; i++) noise(0.34 + i * 0.028 + Math.random() * 0.03, 0.025, { freq: 2000 + Math.random() * 3000, q: 1.5, vol: 0.22, attack: 0.001 });
      noise(0.34, 0.45, { freq: 3500, q: 0.7, vol: 0.08, attack: 0.05 });
    } },
    // A crossbow is cranked and loosed.
    bow: { wet: 0.15, fn: () => {
      for (let i = 0; i < 4; i++) noise(i * 0.07, 0.04, { freq: 900 + i * 120, q: 10, vol: 0.25 });
      tone(0.32, 146.8, 0.6, { type: 'sawtooth', vol: 0.4, lp: 3500, lpTo: 400, lpAt: 0.3, vib: 0.012, vibRate: 9 });
      knock(0.32, 420, 0.35);
      noise(0.34, 0.25, { freq: 2500, to: 600, q: 1, vol: 0.12 });
    } },
    // Someone new walks up and whistles hello.
    join: { wet: 0.15, fn: () => {
      [0, 0.17].forEach((at) => {
        noise(at, 0.05, { type: 'lowpass', freq: 1200, vol: 0.3 });
        tone(at, 150, 0.08, { vol: 0.25, to: 90 });
      });
      tone(0.38, 1318.5, 0.15, { vol: 0.16, attack: 0.02, vib: 0.01, vibRate: 7 });
      tone(0.54, 1760, 0.35, { vol: 0.16, attack: 0.02, vib: 0.015, vibRate: 7 });
    } },
    // A big dinosaur footstep: a thud through the ground and pebbles bouncing.
    stomp: { wet: 0.2, level: -8, fn: () => {
      tone(0, 90, 0.4, { vol: 0.25, to: 40, attack: 0.004 });
      tone(0, 300, 0.2, { type: 'triangle', vol: 0.55, to: 140, attack: 0.003 });
      noise(0, 0.28, { freq: 700, q: 0.7, vol: 0.6, attack: 0.002 });
      noise(0.01, 0.08, { freq: 1500, q: 1, vol: 0.25, attack: 0.001 });
      for (let i = 0; i < 9; i++) noise(0.08 + Math.random() * 0.35, 0.025, { freq: 2000 + Math.random() * 3000, q: 1.5, vol: 0.18, attack: 0.001 });
    } },
    // A card flicked off the deck.
    card: { wet: 0.08, level: -12, fn: () => {
      noise(0, 0.12, { freq: 1200, to: 5000, q: 0.7, vol: 0.3, attack: 0.03 });
      noise(0.1, 0.02, { type: 'highpass', freq: 3500, vol: 0.2, attack: 0.001 });
      noise(0.11, 0.2, { freq: 4000, to: 1500, q: 0.6, vol: 0.18 });
    } },
    // Dice rattled in a cup, then tumbling across the table.
    dice: { wet: 0.12, fn: () => {
      for (let i = 0; i < 7; i++) knock(i * 0.045 + Math.random() * 0.02, 1700 + Math.random() * 900, 0.12);
      [0.42, 0.56, 0.66, 0.73, 0.78].forEach((at, i) => knock(at, 900 + Math.random() * 300, 0.35 - i * 0.05));
    } },
    // An egg cracks open and the hatchling chirps.
    hatch: { level: -11, fn: () => {
      [0, 0.14, 0.24].forEach((at, i) => {
        noise(at, 0.05, { freq: 3000 + i * 500, q: 2.5, vol: 0.25, attack: 0.001 });
        noise(at + 0.01, 0.03, { type: 'highpass', freq: 6000, vol: 0.12, attack: 0.001 });
      });
      [0.42, 0.6, 0.72].forEach((at, i) => tone(at, 2100 + i * 150, 0.14, { vol: 0.3, to: 3200, vib: 0.04, vibRate: 30, attack: 0.01 }));
    } },
    // A baby dinosaur grows up: a little growl that rises into a roar.
    grow: { wet: 0.2, fn: () => {
      tone(0, 170, 0.7, { type: 'sawtooth', vol: 0.3, to: 290, glide: 0.5, attack: 0.06, hold: 0.3, lp: 900, lpTo: 2600, lpAt: 0.45, vib: 0.03, vibRate: 24 });
      noise(0, 0.7, { freq: 900, to: 1600, q: 1.2, vol: 0.12, attack: 0.06 });
      knock(0.05, 300, 0.2);
    } },
    // Crunchy bites.
    munch: { wet: 0.06, level: -11, fn: () => {
      [0, 0.16, 0.32].forEach((at) => {
        knock(at, 320, 0.3);
        noise(at, 0.08, { freq: 1800, q: 0.8, vol: 0.3, attack: 0.002 });
        for (let i = 0; i < 6; i++) noise(at + i * 0.012 + Math.random() * 0.01, 0.04, { freq: 1200 + Math.random() * 2800, q: 1.5, vol: 0.3, attack: 0.001 });
      });
    } },
    // A whoosh and a harp run as something turns over.
    reveal: { wet: 0.3, fn: () => {
      noise(0, 0.35, { freq: 500, to: 4000, q: 0.8, vol: 0.16, attack: 0.15 });
      [523.3, 659.3, 784, 1046.5, 1318.5, 1568].forEach((f, i) => pluck(0.12 + i * 0.045, f, 0.12));
    } },
    // Your turn: a handbell rung twice.
    turn: { wet: 0.25, fn: () => {
      strike(0, 880, 1.1, 0.12, BELL);
      strike(0.2, 1174.7, 1.1, 0.1, BELL);
    } },
    // Success: a short horn call and a cymbal shimmer.
    good: { wet: 0.25, fn: () => {
      brass(0, 392, 0.2, 0.16);
      brass(0.13, 523.3, 0.2, 0.16);
      [523.3, 659.3, 784].forEach((f) => brass(0.26, f, 0.7, 0.11));
      noise(0.26, 0.8, { type: 'highpass', freq: 6000, vol: 0.07, attack: 0.002 });
    } },
    // Setback: a muted horn sagging down.
    bad: { wet: 0.15, fn: () => {
      tone(0, 311.1, 0.3, { type: 'sawtooth', vol: 0.16, attack: 0.02, hold: 0.15, lp: 900, lpTo: 400 });
      tone(0.32, 261.6, 0.75, { type: 'sawtooth', vol: 0.16, attack: 0.02, hold: 0.3, to: 220, glide: 0.65, lp: 800, lpTo: 300, vib: 0.02, vibRate: 6 });
      knock(0.32, 200, 0.35);
    } },
    // Night falls and the attack comes: war drums, a gong and wind.
    night: { wet: 0.35, level: -7, fn: () => {
      [[0, 0.7], [0.42, 0.7], [0.66, 0.85]].forEach(([at, v]) => {
        drum(at, 55, 0.6, 0.4 * v);
        tone(at, 220, 0.22, { type: 'triangle', vol: 0.5 * v, to: 120, attack: 0.002 });
        noise(at, 0.12, { freq: 900, q: 0.9, vol: 0.5 * v, attack: 0.001 });
      });
      strike(0.66, 196, 1.8, 0.2, BELL);
      brass(0.7, 146.8, 1.3, 0.18, { bright: 6 });
      noise(0.5, 1.4, { freq: 400, to: 1200, q: 0.6, vol: 0.14, attack: 0.5 });
    } },
    // Victory fanfare with a timpani hit and cymbal.
    win: { wet: 0.3, fn: () => {
      [0, 0.15, 0.3].forEach((at) => brass(at, 392, 0.13, 0.15));
      [523.3, 659.3, 784].forEach((f) => brass(0.45, f, 1.4, 0.12));
      drum(0.45, 65, 0.6, 0.55);
      noise(0.45, 1.4, { type: 'highpass', freq: 5000, vol: 0.1, attack: 0.002 });
    } },
    // Defeat: a sad trombone.
    lose: { wet: 0.2, fn: () => {
      [293.7, 277.2, 261.6].forEach((f, i) => brass(i * 0.38, f, 0.34, 0.16, { bright: 3 }));
      brass(1.14, 246.9, 1.2, 0.16, { bright: 3, vib: 0.025, vibRate: 5 });
    } },
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
    duck(clipLen[name] || 0.5);
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
    if (SFX_USED) renderClips();
    if (first) {
      for (let i = 0; i < (SFX_USED ? POOL : 0); i++) {
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
  ['pointerdown', 'click', 'touchend', 'keydown'].forEach((t) => document.addEventListener(t, gesture, true));

  // Start as soon as the page opens where the browser allows sound without a tap (a site you often play
  // media on, or autoplay allowed in its settings). Elsewhere a play() is refused and the first tap starts it.
  let autoTried = false;
  function tryAutoplay() {
    if (autoTried || unlocked || !musicOn() || !onScreen() || videoOn()) return;
    autoTried = true;
    if (navigator.getAutoplayPolicy && navigator.getAutoplayPolicy('mediaelement') !== 'allowed') return;
    const t = current();
    load(t).then(() => {
      if (unlocked || !t.blobUrl || !musicOn() || !onScreen() || videoOn()) return;
      const e = el(t);
      e.muted = false;
      const p = e.play();
      if (!p || !p.then) return;
      p.then(() => {
        if (unlocked) return;
        unlocked = true;
        t.target = 0;
        if (SFX_USED) renderClips();
        sync();
      }, () => {});
    });
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-music]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    const next = nextMode(mode());
    fallback = next;
    store(next);
    paintButtons();
    if (next !== 'off' && SFX_USED) renderClips();
    sync();
  });

  document.addEventListener('visibilitychange', sync);
  // Video events don't bubble, so they're caught on the way down. timeupdate is a backstop in case a start is missed.
  ['play', 'playing', 'pause', 'ended', 'volumechange', 'emptied', 'timeupdate'].forEach((t) => document.addEventListener(t, (e) => e.target.tagName === 'VIDEO' && sync(), true));
  // The setting changed in another tab, or this page came back from the back/forward cache.
  addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    paintButtons();
    if (mode() !== 'off' && SFX_USED && unlocked) renderClips();
    sync();
  });
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    paintButtons();
    sync();
  });
  const ready = () => {
    paintButtons();
    tryAutoplay();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync();
      tryAutoplay();
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
