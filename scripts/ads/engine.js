// Tiny deterministic animation engine for the ad videos: every scene draws itself as a pure function of
// time, so render.js can step frame by frame and get the same, perfectly smooth video every run.
(function () {
  const W = 1280;
  const H = 720;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const E = {
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
    back: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
    sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  };
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function el(tag, cls, parent, css) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (css) Object.assign(e.style, css);
    if (parent) parent.appendChild(e);
    return e;
  }

  const IMG = {};
  function img(src) {
    if (!IMG[src]) {
      const i = new Image();
      i.src = src;
      IMG[src] = i;
    }
    return IMG[src];
  }

  // A cut-out character or prop, anchored at its feet (bottom centre). `face` is the way the art looks
  // (1 = right); set `dir` to make it look the other way.
  function sprite(parent, src, o = {}) {
    const s = {
      x: o.x || 0, y: o.y || 0, h: o.h || 200, face: o.face || 1, dir: o.dir || o.face || 1,
      rot: 0, sx: 1, sy: 1, lift: 0, op: 1, filter: '', z: o.z, shadow: o.shadow !== false, hidden: false,
    };
    s.sh = s.shadow ? el('div', 'shadow', parent) : null;
    s.wrap = el('div', 'spr', parent);
    s.img = el('img', '', s.wrap);
    s.img.src = src;
    s.img.draggable = false;
    s.place = () => {
      const vis = !s.hidden && s.op > 0.001;
      s.wrap.style.display = vis ? '' : 'none';
      if (s.sh) s.sh.style.display = vis ? '' : 'none';
      if (!vis) return;
      const ar = s.img.naturalWidth ? s.img.naturalWidth / s.img.naturalHeight : 1;
      s.wrap.style.height = `${s.h}px`;
      s.wrap.style.width = `${s.h * ar}px`;
      const flip = s.dir === s.face ? 1 : -1;
      s.wrap.style.transform = `translate(${s.x}px, ${s.y - s.lift}px) translate(-50%, -100%) rotate(${s.rot}deg) scale(${s.sx * flip}, ${s.sy})`;
      s.wrap.style.opacity = s.op;
      s.wrap.style.filter = s.filter;
      const z = Math.round(s.z != null ? s.z : s.y);
      s.wrap.style.zIndex = z;
      if (s.sh) {
        const w = s.h * ar * 0.62 * (1 - clamp(s.lift / 400) * 0.5);
        s.sh.style.width = `${w}px`;
        s.sh.style.height = `${Math.max(8, w * 0.16)}px`;
        s.sh.style.transform = `translate(${s.x - w / 2}px, ${s.y - w * 0.08}px)`;
        s.sh.style.opacity = s.op * (0.55 - clamp(s.lift / 300) * 0.35);
        s.sh.style.zIndex = z - 1;
      }
    };
    return s;
  }

  // Puppet motions on top of a sprite's base pose.
  const pose = {
    breathe(s, t, ph = 0) {
      s.sy = 1 + 0.018 * Math.sin(t * 2.2 + ph);
      s.sx = 1 - 0.008 * Math.sin(t * 2.2 + ph);
      s.rot = 0.6 * Math.sin(t * 1.1 + ph);
      s.lift = 0;
    },
    walk(s, t, speed = 1, ph = 0, amp = 10) {
      const c = t * 7 * speed + ph;
      s.lift = Math.abs(Math.sin(c)) * amp;
      s.rot = Math.sin(c) * 3.5;
      s.sy = 1 + 0.02 * Math.cos(2 * c);
      s.sx = 1;
    },
    hop(s, t, speed = 1, ph = 0, amp = 30) {
      const c = (t * speed + ph) % 1;
      s.lift = Math.sin(c * Math.PI) * amp;
      s.sy = c < 0.08 || c > 0.92 ? 0.9 : 1.04;
      s.sx = 2 - s.sy;
      s.rot = Math.sin(c * Math.PI * 2) * 5;
    },
    graze(s, t, ph = 0) {
      const c = Math.sin(t * 1.6 + ph);
      s.rot = 4 + c * 4;
      s.sy = 1 + 0.015 * Math.sin(t * 2.2 + ph);
      s.sx = 1;
      s.lift = 0;
    },
    work(s, t, speed = 1, ph = 0) {
      const c = Math.sin(t * 6 * speed + ph);
      s.rot = c * 7;
      s.sy = 1 - Math.max(0, c) * 0.04;
      s.sx = 1;
      s.lift = 0;
    },
  };

  // Particles are drawn into a canvas covering the scene, as a pure function of time.
  function canvasLayer(parent, z = 5000) {
    const c = el('canvas', 'fx', parent, { zIndex: z });
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    return { c, g, clear: () => g.clearRect(0, 0, W, H) };
  }

  // Big title text that pops in and fades out.
  function caption(parent, html, cls = 'title') {
    const e = el('div', cls, parent);
    e.innerHTML = html;
    return {
      e,
      show(t, a, b, from = 'pop') {
        const p = seg(t, a, a + 0.55);
        const q = 1 - seg(t, b - 0.45, b);
        const vis = t >= a && t <= b;
        e.style.display = vis ? '' : 'none';
        if (!vis) return;
        const s = from === 'pop' ? lerp(0.6, 1, E.back(p)) : 1;
        const dy = from === 'rise' ? (1 - E.out(p)) * 40 : 0;
        e.style.opacity = Math.min(p * 1.6, q);
        e.style.transform = `translate(-50%, -50%) translateY(${dy}px) scale(${s})`;
      },
    };
  }

  // ---------------------------------------------------------------- timeline
  const LEAD = 0.6;
  const TAIL = 0.9;
  const XF = 0.7;
  function runAd(scenes) {
    const dur = window.SAY_DUR || {};
    const stage = document.getElementById('stage');
    let t0 = 0;
    const tl = scenes.map((sc, i) => {
      const lead = sc.lead != null ? sc.lead : LEAD;
      const speak = sc.say ? dur[sc.id] || sc.say.split(' ').length / 2.6 : 0;
      const d = Math.max(sc.min || 4, sc.say ? lead + speak + (sc.tail != null ? sc.tail : TAIL) : 0);
      const root = el('div', 'scene', stage, { zIndex: i + 1 });
      const st = sc.build(root) || {};
      const item = { id: sc.id, start: t0, dur: d, sayAt: t0 + lead, say: sc.say || '', music: sc.music || 'main', root, st, sc };
      t0 += d;
      return item;
    });
    window.TIMELINE = tl.map(({ id, start, dur: d, sayAt, say, music }) => ({ id, start, dur: d, sayAt, say, music }));
    window.DURATION = t0;
    window.SAY_LINES = scenes.filter((s) => s.say).map((s) => ({ id: s.id, text: s.say }));
    window.frame = (t) => {
      tl.forEach((it, i) => {
        const last = i === tl.length - 1;
        const on = t >= it.start - (i ? XF : 0) && (t < it.start + it.dur || last);
        it.root.style.display = on ? '' : 'none';
        if (!on) return;
        it.root.style.opacity = i ? E.sine(seg(t, it.start - XF, it.start)) : 1;
        it.sc.frame(t - it.start, it.dur, it.st);
      });
    };
    window.frame(0);
  }

  const loaded = () => Promise.all(Object.values(IMG).concat([...document.images]).map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
  window.AD = { loaded, W, H, clamp, lerp, seg, E, rng, el, img, sprite, pose, canvasLayer, caption, runAd };
})();
