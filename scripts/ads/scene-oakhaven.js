// Oakhaven ad: a storybook tale of a village growing at the edge of the forest, told in a 3D paper-theatre
// world built from the game's own art.
(function () {
  const { W, H, clamp, lerp, seg, E, rng, el, img, caption, runAd } = AD;
  const { world, pine, oak, bush, rock, meadow, weather, prop } = AD3;
  const O = (n) => `sprites/oak/${n}.png`;
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- the village
  const BLD = {
    keep: [0, 700, 'keep', 450], well: [-210, 330, 'well', 225], house1: [-540, 520, 'house', 345], house2: [500, 560, 'house', 345],
    farm: [-1050, 420, 'farm', 315], lumber: [1080, 900, 'lumber', 330], bakery: [340, 170, 'bakery', 330], market: [-430, 110, 'market', 322],
    smithy: [720, 280, 'smithy', 330], house3: [-780, 920, 'house', 330], house4: [800, 1010, 'house', 330], inn: [-300, 1080, 'inn', 368],
    chapel: [340, 1180, 'chapel', 390], tower: [980, -170, 'tower', 450], castle: [0, 700, 'castle', 525], cathedral: [-720, 1400, 'cathedral', 555],
    wizardtower: [680, 1480, 'wizardtower', 585], barracks: [-980, 1250, 'barracks', 345],
  };
  const CHIMNEY = { house1: [-45, 300], house2: [-45, 300], house3: [-45, 285], house4: [-45, 285], bakery: [38, 305], inn: [45, 320], smithy: [-60, 285] };
  const START = ['keep', 'well', 'farm'];
  const GROWN = ['keep', 'well', 'farm', 'house1', 'house2', 'lumber', 'bakery', 'market', 'smithy', 'house3', 'house4', 'inn', 'chapel'];
  const FINAL = GROWN.filter((k) => k !== 'keep').concat(['castle', 'cathedral', 'wizardtower', 'barracks', 'tower']);

  const r0 = rng(77);
  const TREES = [];
  for (let i = 0; i < 120; i++) {
    const a = r0() * TAU;
    const rad = 2100 + r0() * 1700;
    const x = Math.sin(a) * rad * 1.2;
    const z = 700 + Math.cos(a) * rad;
    if (Math.abs(x) < 260 && z < 200) continue;
    TREES.push([x, z, r0() < 0.75 ? 'pine' : 'oak', Math.floor(r0() * 6), 0.85 + r0() * 0.5]);
  }
  for (let i = 0; i < 26; i++) {
    const a = r0() * TAU;
    const rad = 1500 + r0() * 500;
    const x = Math.sin(a) * rad * 1.15;
    const z = 700 + Math.cos(a) * rad;
    if (Math.abs(x) < 300 && z < 300) continue;
    TREES.push([x, z, 'oak', Math.floor(r0() * 6), 0.8 + r0() * 0.4]);
  }
  const BUSHES = Array.from({ length: 40 }, () => [(r0() - 0.5) * 3000, -600 + r0() * 2400, Math.floor(r0() * 5), r0() < 0.3]).filter(([x, z]) => Math.abs(x) > 260 || z > 1600);

  const GROUND = { 0: ['#9ccf62', '#6aae45'], 1: ['#8cc356', '#5e9f3a'], 2: ['#c3b45a', '#9a8a3c'], 3: ['#e3eaf2', '#f4f8ff'] };

  // A villager is drawn waist-up, so they always stand in a tuft of tall grass (or a snow drift).
  const FADE = new Map();
  function faded(src) {
    const im = img(src);
    if (!im.naturalWidth) return im;
    if (FADE.has(src)) return FADE.get(src);
    const c = document.createElement('canvas');
    c.width = im.naturalWidth;
    c.height = im.naturalHeight;
    c.id = 'fade' + src;
    const g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    g.globalCompositeOperation = 'destination-out';
    const gr = g.createLinearGradient(0, c.height * 0.82, 0, c.height);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = gr;
    g.fillRect(0, 0, c.width, c.height);
    FADE.set(src, c);
    return c;
  }
  function tuft(seed, snow) {
    return prop(`tuft${seed}:${snow}`, 240, 90, (g, w, h) => {
      const r = rng(seed);
      if (snow) {
        const gr = g.createLinearGradient(0, 20, 0, h);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(1, '#dfe8f3');
        g.fillStyle = gr;
        g.beginPath();
        g.ellipse(w / 2, h, w / 2 - 4, h - 22, 0, Math.PI, 0);
        g.fill();
        return;
      }
      const base = g.createRadialGradient(w / 2, h, 4, w / 2, h, w / 2);
      base.addColorStop(0, 'rgba(30,70,20,0.85)');
      base.addColorStop(1, 'rgba(30,70,20,0)');
      g.fillStyle = base;
      g.fillRect(0, h - 30, w, 30);
      for (let i = 0; i < 90; i++) {
        const x = 14 + r() * (w - 28);
        const e = (x - w / 2) / (w / 2);
        const hh = (34 + r() * 50) * (1 - e * e * 0.85);
        g.strokeStyle = ['#3f7f2c', '#4f9a36', '#5eaa3f', '#2f6a24'][i % 4];
        g.lineWidth = 3 + r() * 2;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x, h);
        g.quadraticCurveTo(x + (r() - 0.5) * 16, h - hh * 0.6, x + (r() - 0.5) * 26, h - hh);
        g.stroke();
      }
    });
  }
  // A villager (or knight, wizard...) standing at x, z.
  function folk(R, n, x, z, o = {}) {
    const h = o.h || 165;
    const bob = o.walk ? Math.abs(Math.sin(o.walk * 7)) * 7 : 0;
    const rot = o.walk ? Math.sin(o.walk * 7) * 3 : o.talk ? Math.sin(o.talk * 9) * 2 : Math.sin((o.t || 0) * 1.3 + x) * 0.8;
    const sy = 1 + (o.talk ? 0.012 * Math.sin(o.talk * 11) : 0.015 * Math.sin((o.t || 0) * 2.2 + x));
    R.bill(faded(O(n)), { x, z, h, dir: o.dir || 1, lift: bob + (o.lift || 0), rot: rot + (o.rot || 0), sy, op: o.op, shadowW: 0.3, flash: o.flash, flashColor: o.flashColor });
    if (o.grass !== false) R.bill(tuft(Math.round(Math.abs(x + z)) % 7, o.snow), { x, z: z - 8, h: h * 0.3, sx: 1, shadow: false, op: o.op, rot: Math.sin((o.t || 0) * 1.7 + x) * 1.5 });
  }

  // The whole village. `built` maps building ids to how far they have risen (0..1).
  function village(R, t, o) {
    const season = o.season == null ? 1 : o.season;
    const snow = season === 3;
    // Roads, plaza and fields.
    const road = snow ? '#d8d4cc' : '#b8935f';
    R.decal([[-80, -4000], [80, -4000], [95, 380], [-95, 380]], road);
    R.decal([[-4000, -1680], [4000, -1680], [4000, -1540], [-4000, -1540]], road);
    R.disc(0, 400, 330, 250, snow ? '#e4e0d8' : '#cdb78d', snow ? '#cfc8bb' : '#a88f63', 3);
    if (o.built.farm) {
      for (let i = 0; i < 6; i++) {
        const z0 = 520 + i * 70;
        R.decal([[-1320, z0], [-820, z0], [-820, z0 + 44], [-1320, z0 + 44]], snow ? '#eef2f7' : season === 2 ? '#e2b84a' : season === 0 ? '#86b04a' : '#c9c45a');
      }
    }
    if (o.meadow && !snow) o.meadow();
    // Trees and bushes.
    TREES.forEach(([x, z, k, sd, sc]) => {
      const im = k === 'pine' ? pine(sd, snow ? 1 : 0) : oak(sd, season);
      R.bill(im, { x, z, h: (k === 'pine' ? 430 : 390) * sc, shadowW: 0.25, rot: Math.sin(t * 0.8 + x) * 0.6 });
    });
    BUSHES.forEach(([x, z, sd, isRock]) => R.bill(isRock ? rock(sd) : bush(sd, snow ? '#9fb3a3' : '#3f8a3a'), { x, z, minD: 200, h: isRock ? 70 : 80, shadowW: 0.3 }));
    // Buildings.
    Object.entries(o.built).forEach(([id, p]) => {
      if (!(p > 0)) return;
      const [x, z, n, h] = BLD[id];
      const k = clamp(p);
      R.bill(O(n), { x, z, h, sy: k < 1 ? Math.max(0.02, E.back(k)) : 1, sx: k < 1 ? lerp(0.8, 1, E.out(k)) : 1, shadowW: 0.42, shadowA: 0.45, bias: -30 });
      if (k < 1) {
        for (let j = 0; j < 8; j++) {
          const a = (j / 8) * TAU;
          const d = E.out(seg(k, 0, 1)) * 120;
          R.blob(x + Math.cos(a) * (60 + d), 20 + d * 0.3, z + Math.sin(a) * (40 + d * 0.6), 40 + d * 0.4, '#d9c7a4', 0.75 * (1 - k));
        }
      }
      if (o.night && k >= 1) R.light(x, h * 0.35, z - 20, h * 0.9, '#ffb347', 0.22 * o.night);
      if (o.smoke && CHIMNEY[id] && k >= 1) {
        const [cx, cy] = CHIMNEY[id];
        for (let j = 0; j < 7; j++) {
          const q = (t * 0.28 + j / 7 + (x % 1)) % 1;
          R.blob(x + cx + q * 70 + Math.sin(q * 7) * 10, cy + q * 260, z, 18 + q * 40, snow ? '#e8e8ee' : '#ece8e0', 0.55 * (1 - q) * o.smoke);
        }
      }
    });
    if (o.walls) {
      for (let i = 0; i < 10; i++) R.bill(O('wall'), { x: -900 + i * 190, z: -260, h: 112, shadowW: 0.4 });
      R.bill(O('tower'), { x: 1020, z: -240, h: 300, shadowW: 0.35 });
      if (o.night) [-710, -330, 50, 430, 810].forEach((x, i) => {
        const f = 0.8 + 0.2 * Math.sin(t * 13 + i * 2.1) * Math.sin(t * 7.3 + i);
        R.light(x, 120, -270, 150, '#ff9a3c', 0.5 * f * o.night);
        R.blob(x, 125, -275, 10, '#ffd27a', 0.9 * f * o.night);
      });
    }
  }

  function look(R, x, y, z, tx, ty, tz) {
    Object.assign(R.cam, { x, y, z });
    const dx = tx - x;
    const dz = tz - z;
    R.cam.yaw = Math.atan2(dx, dz);
    R.cam.pitch = Math.atan2(y - ty, Math.hypot(dx, dz));
  }
  const builtOf = (list, k = 1) => Object.fromEntries(list.map((id) => [id, k]));

  // Stars of music from the bard.
  function notes(R, x, z, t, h = 165) {
    for (let j = 0; j < 4; j++) {
      const k = (t * 0.55 + j / 4) % 1;
      R.at(x + 40 + k * 60 + Math.sin(k * 9) * 12, h * 0.75 + k * 110, z - 10, (g, p) => {
        const s = p.s * 1.1;
        g.globalAlpha = 1 - k;
        g.fillStyle = '#ffd24d';
        g.strokeStyle = '#5a3412';
        g.lineWidth = 2.5 * s;
        g.translate(p.x, p.y);
        g.rotate(-0.2);
        const heads = j % 2 ? [[0, 0]] : [[0, 0], [16 * s, -4 * s]];
        heads.forEach(([hx, hy]) => {
          g.beginPath();
          g.ellipse(hx, hy, 7 * s, 5 * s, -0.4, 0, TAU);
          g.fill();
          g.stroke();
          g.fillRect(hx + 5 * s, hy - 26 * s, 3 * s, 26 * s);
        });
        g.fillRect(5 * s, -28 * s, heads.length > 1 ? 19 * s : 10 * s, 5 * s);
      });
    }
  }

  function sceneRoot(root, seed) {
    const R = world(root, { seed });
    el('div', 'vignette', root);
    const flash = el('div', 'full', root, { zIndex: 8600, background: '#eef3ff', opacity: 0 });
    R.env.ground = GROUND[1];
    const offPath = (x, z) => ((x / 360) ** 2 + ((z - 400) / 280) ** 2 < 1) || (Math.abs(x) < 110 && z < 400) || Math.abs(z + 1610) < 80;
    return { R, flash, meadow: meadow(R, [-2400, 2400, -1400, 2200], 900, seed + 3, undefined, offPath) };
  }

  // ---------------------------------------------------------------- scenes
  const scenes = [];

  scenes.push({
    id: 'open', min: 9.5, lead: 1.2,
    say: 'Once upon a time, at the edge of a great old forest, there was a clearing.',
    build(root) {
      const bg = el('div', 'full', root, { background: `url(${O('cover')}) center/cover`, transformOrigin: '50% 45%' });
      el('div', 'vignette', root);
      const title = caption(root, '<div class="big">Oakhaven</div>');
      return { bg, title };
    },
    frame(t, dur, s) {
      const p = t / dur;
      s.bg.style.transform = `perspective(900px) rotateX(${lerp(4, 0, E.sine(p))}deg) scale(${lerp(1.3, 1.06, E.sine(p))}) translateY(${lerp(20, -8, p)}px)`;
      s.title.show(t, dur - 4.4, dur + 1, 'pop');
    },
  });

  scenes.push({
    id: 'dawn', min: 11,
    say: 'In it stood an old keep, a well, a single farm... and a handful of hopeful people, ready to begin.',
    build: (root) => sceneRoot(root, 2),
    frame(t, dur, s) {
      const R = s.R;
      const k = E.inOut(seg(t, 0, dur - 0.5));
      R.env.tod = lerp(0.05, 0.75, seg(t, 0, dur));
      R.env.sunAz = 0.15;
      look(R, lerp(-300, 100, k), lerp(1500, 175, k), lerp(-2200, -560, k), lerp(0, -60, k), lerp(0, 130, k), lerp(900, 300, k));
      R.begin(t);
      village(R, t, { built: builtOf(START), meadow: s.meadow, smoke: 0 });
      [['peasant', -150, 90, 1], ['farmer', -40, 60, -1], ['steward', 90, 80, -1], ['woodcutter', 220, 110, -1], ['carpenter', -290, 140, 1]].forEach(([n, x, z, d], i) =>
        folk(R, n, x, z, { dir: d, t: t + i }));
      R.end();
    },
  });

  scenes.push({
    id: 'plan', min: 11,
    say: 'Their steward, a careful old man, had a plan. Houses first, he said. Then a bakery. Then, we shall see.',
    build: (root) => sceneRoot(root, 3),
    frame(t, dur, s) {
      const R = s.R;
      const k = E.inOut(seg(t, 0, dur));
      R.env.tod = 0.85;
      R.env.focus = lerp(560, 390, k);
      R.env.dof = 2.2;
      const a = lerp(-0.35, 0.2, k);
      look(R, 60 + Math.sin(a) * lerp(560, 380, k), 150, 110 - Math.cos(a) * lerp(560, 380, k), 30, 140, 160);
      R.begin(t);
      village(R, t, { built: builtOf(START), meadow: s.meadow });
      const talk = t > 1 && t < dur - 1.5 ? t : 0;
      folk(R, 'steward', -40, 120, { dir: 1, talk, t });
      folk(R, 'carpenter', 110, 130, { dir: -1, t: t + 2, talk: Math.sin(t * 0.7) > 0.6 ? t : 0 });
      folk(R, 'peasant', 280, 200, { dir: -1, t: t + 4 });
      R.end();
      R.env.focus = null;
    },
  });

  const RISE = ['house1', 'house2', 'bakery', 'lumber', 'market', 'smithy', 'house3', 'house4', 'inn', 'chapel'];
  scenes.push({
    id: 'build', min: 12,
    say: 'So the carpenter hammered, the woodcutter chopped, and stone by stone, the village rose.',
    build: (root) => sceneRoot(root, 4),
    frame(t, dur, s) {
      const R = s.R;
      R.env.tod = 1;
      R.env.sunAz = 0.6;
      const a = lerp(-0.7, 0.75, E.inOut(seg(t, 0, dur)));
      look(R, Math.sin(a) * 1700, lerp(700, 520, seg(t, 0, dur)), 650 - Math.cos(a) * 1700, 0, 80, 650);
      R.begin(t);
      const built = builtOf(START);
      RISE.forEach((id, i) => (built[id] = seg(t, 0.8 + i * 0.95, 2.1 + i * 0.95)));
      village(R, t, { built, meadow: s.meadow, smoke: 1 });
      const site = RISE[clamp(Math.floor((t - 0.8) / 0.95), 0, RISE.length - 1)];
      const [sx, sz] = BLD[site];
      folk(R, 'carpenter', sx + 150, sz - 90, { dir: -1, t, rot: Math.sin(t * 14) * 8 });
      folk(R, 'woodcutter', 860, 760, { dir: 1, t, rot: Math.sin(t * 9) * 9 });
      folk(R, 'stonecutter', -200, 520, { dir: 1, t, rot: Math.sin(t * 10 + 1) * 8 });
      folk(R, 'peasant', lerp(-600, 400, seg(t, 0, dur)), 260, { walk: t, dir: 1 });
      R.end();
    },
  });

  scenes.push({
    id: 'life', min: 12,
    say: 'Soon there was bread in the ovens, a merchant in the market, and a blacksmith whose hammer rang from dawn till dusk.',
    build: (root) => sceneRoot(root, 5),
    frame(t, dur, s) {
      const R = s.R;
      R.env.tod = 1;
      R.env.sunAz = -0.4;
      R.env.focus = 360;
      R.env.dof = 1.6;
      R.env.focus = 470;
      const bx = lerp(-650, 760, seg(t, 0.3, dur));
      look(R, bx - 60, 165, -280, bx + 40, 120, 200);
      R.begin(t);
      village(R, t, { built: builtOf(GROWN), meadow: s.meadow, smoke: 1 });
      folk(R, 'baker', bx, 180, { walk: t, dir: 1 });
      folk(R, 'merchant', -560, 300, { t, talk: t, dir: 1 });
      folk(R, 'blacksmith', 640, 215, { t, dir: -1, rot: Math.sin(t * 12) * 9 });
      folk(R, 'chef', lerp(400, -200, seg(t, 0, dur)), 420, { walk: t + 1, dir: -1 });
      folk(R, 'farmer', lerp(-900, -300, seg(t, 0, dur)), 520, { walk: t + 2, dir: 1 });
      folk(R, 'peasant', lerp(900, 100, seg(t, 0, dur)), 60, { walk: t + 3, dir: -1 });
      // The smith's sparks.
      for (let j = 0; j < 10; j++) {
        const q = (t * 1.6 + j / 10) % 1;
        R.blob(600 + Math.cos(j * 2.4) * q * 70, 90 + Math.sin(j * 1.7) * 20 + q * 40 - q * q * 60, 205, 6, '#ffb347', 1 - q);
      }
      R.end();
      R.env.focus = null;
    },
  });

  const TRAVELLERS = ['bard', 'knight', 'priest', 'wizard'];
  scenes.push({
    id: 'road', min: 14,
    say: 'Word travelled. Strangers came down the road: a bard with a song, a knight in shining armour, a priest, and a wizard who never said where he came from.',
    build: (root) => sceneRoot(root, 6),
    frame(t, dur, s) {
      const R = s.R;
      R.env.tod = lerp(1.15, 1.45, seg(t, 0, dur));
      R.env.sunAz = 0.1;
      const k = E.inOut(seg(t, 0, dur));
      look(R, lerp(160, 260, k), lerp(110, 140, k), lerp(-2100, -1950, k), lerp(-40, 40, k), 120, lerp(-1200, -1500, k));
      R.begin(t);
      village(R, t, { built: builtOf(GROWN), meadow: s.meadow, smoke: 1, walls: false });
      R.bill(AD3.sign('Oakhaven'), { x: 280, z: -1580, h: 120, shadowW: 0.2 });
      TRAVELLERS.forEach((n, i) => {
        const a = 0.4 + i * 2.6;
        const p = seg(t, a, a + 7);
        const z = lerp(-500, -1640 + i * 80, E.out(p));
        const x = lerp(-30 + (i % 2) * 60, [-170, -50, 70, 190][i], E.out(p));
        const walking = p > 0 && p < 0.95;
        folk(R, n, x, z, { walk: walking ? t + i : 0, t: t + i, dir: i % 2 ? -1 : 1, op: clamp(seg(t, a - 0.3, a + 0.4)) });
        if (n === 'bard' && p > 0) notes(R, x, z, t);
        if (n === 'wizard' && p > 0) R.light(x - 50, 150, z, 70, '#b48cff', 0.35 + 0.15 * Math.sin(t * 5));
      });
      R.end();
    },
  });

  scenes.push({
    id: 'seasons', min: 15,
    say: 'The seasons turned. Spring was gentle. Summer was kind. Autumn was golden. But winter was long, and cold, and dark.',
    build(root) {
      const s = sceneRoot(root, 7);
      s.label = caption(root, '', 'title');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      const q = dur / 4;
      const si = clamp(Math.floor(t / q), 0, 3);
      const lt = t - si * q;
      R.env.tod = si === 3 ? lerp(1.2, 1.7, seg(lt, 0, q)) : 1;
      R.env.sunAz = 0.4;
      R.env.ground = GROUND[si];
      R.env.clouds = si === 3 ? 1.4 : 1;
      R.env.tint = si === 3 ? '#c9d4ee' : si === 2 ? '#ffe2b8' : null;
      const a = lerp(0.5, -0.4, E.inOut(seg(t, 0, dur)));
      look(R, Math.sin(a) * 1300, 380, 500 - Math.cos(a) * 1300, 0, 90, 600);
      R.begin(t);
      village(R, t, { built: builtOf(GROWN), meadow: s.meadow, smoke: si === 3 ? 1.4 : 0.6, season: si });
      const snow = si === 3;
      folk(R, 'farmer', -760 + Math.sin(t * 0.5) * 120, 470, { walk: t, dir: Math.cos(t * 0.5) > 0 ? 1 : -1, snow });
      folk(R, 'woodcutter', 300, 350, { walk: snow ? t : 0, t, dir: -1, snow, rot: snow ? 0 : Math.sin(t * 9) * 8 });
      folk(R, 'peasant', -120, 260, { t, dir: 1, snow });
      if (si === 0) weather(R, 'petals', t, 140, 3);
      if (si === 2) weather(R, 'leaves', t, 160, 4);
      if (si === 3) weather(R, 'snow', t, 420, 5, seg(lt, 0, 1.2));
      R.end();
      R.env.tint = null;
      s.label.e.innerHTML = `<div class="mid">${['Spring', 'Summer', 'Autumn', 'Winter'][si]}</div>`;
      s.label.e.style.top = '20%';
      s.label.show(lt, 0.2, q - 0.1, 'rise');
    },
  });

  scenes.push({
    id: 'wolves', min: 14, music: 'night',
    say: 'And on the darkest nights, things crept out of the forest. To the walls! cried the guards. And the archers did not miss.',
    build: (root) => sceneRoot(root, 8),
    frame(t, dur, s) {
      const R = s.R;
      R.env.tod = lerp(2.3, 3, seg(t, 0, 3));
      R.env.moonAz = 0.25;
      const k = E.inOut(seg(t, 0, dur));
      look(R, lerp(-380, -120, k), lerp(150, 120, k), lerp(-1350, -1150, k), lerp(300, 380, k), 110, -260);
      R.begin(t);
      village(R, t, { built: builtOf(GROWN), smoke: 0.5, walls: true, night: clamp(R.env.tod - 2) });
      const night = clamp(R.env.tod - 2);
      // Eyes in the dark, then the pack.
      for (let i = 0; i < 6; i++) {
        const ex = -700 + i * 70;
        const a = clamp(seg(t, 1.5 + i * 0.25, 2.2 + i * 0.25)) * (1 - seg(t, 4.2, 4.6));
        const blink = Math.sin(t * 2 + i * 3) > 0.96 ? 0 : 1;
        if (a > 0) R.at(ex, 50, -820 - (i % 3) * 90, (g, p) => {
          g.fillStyle = `rgba(255,236,120,${a * blink})`;
          [-1, 1].forEach((sd) => {
            g.beginPath();
            g.ellipse(p.x + sd * 7 * p.s, p.y, 3.2 * p.s, 2.2 * p.s, 0, 0, TAU);
            g.fill();
          });
          g.shadowBlur = 0;
        });
      }
      const flee = seg(t, 9.2, 11.5);
      [[-60, -760], [260, -820], [520, -720]].forEach(([x0, z0], i) => {
        const inP = E.out(seg(t, 4 + i * 0.4, 8));
        const x = lerp(x0 - 500, x0, inP) - E.in(flee) * 900;
        const z = lerp(-1100, z0, inP) - E.in(flee) * 500;
        const c = t * 7 + i;
        R.bill(O('wolves'), { x, z, h: 115, face: -1, dir: flee > 0 ? -1 : 1, lift: Math.abs(Math.sin(c)) * 8, rot: Math.sin(c) * 3, op: clamp(seg(t, 4 + i * 0.4, 4.6 + i * 0.4)) });
      });
      // Guards behind the wall, the archer up in the tower.
      [[-520, 0], [140, 0.3], [600, 0.6]].forEach(([x, d]) => {
        const up = E.back(seg(t, 5.6 + d, 6.3 + d));
        if (up > 0) R.bill(faded(O('guard')), { x, z: -240, h: 150, lift: lerp(-40, 30, up), op: clamp(seg(t, 5.6 + d, 6 + d)), shadow: false, bias: -5 });
      });
      const up = E.back(seg(t, 5.8, 6.5));
      if (up > 0) R.bill(O('archer'), { x: 1015, z: -250, h: 110, lift: lerp(120, 160, up), dir: -1, op: clamp(seg(t, 5.8, 6.2)), shadow: false, bias: 2 });
      // Arrows.
      for (let i = 0; i < 6; i++) {
        const a = 6.6 + i * 0.45;
        const q = seg(t, a, a + 0.7);
        if (q <= 0 || q >= 1) continue;
        const tx = [-60, 260, 520][i % 3];
        const tz = [-760, -820, -720][i % 3];
        const pos = (u) => [lerp(990, tx, u), lerp(270, 50, u) + Math.sin(u * Math.PI) * 120, lerp(-250, tz, u)];
        const p0 = pos(q);
        const p1 = pos(Math.max(0, q - 0.06));
        R.at(p0[0], p0[1], p0[2], (g, p) => {
          const pb = R.project(p1[0], p1[1], p1[2]);
          if (!pb) return;
          g.strokeStyle = '#f3e6c4';
          g.lineWidth = Math.max(1.5, 3 * p.s);
          g.beginPath();
          g.moveTo(pb.x, pb.y);
          g.lineTo(p.x, p.y);
          g.stroke();
        });
      }
      R.end();
    },
  });

  const BEASTS = [['goblins', 140], ['troll', 230], ['skeletons', 150], ['ogre', 220], ['spiders', 130], ['hydra', 240], ['lich', 220], ['giant', 300], ['basilisk', 200]];
  scenes.push({
    id: 'monsters', min: 14, music: 'night',
    say: 'Goblins. Trolls. Skeletons that rattled in the moonlight. Every night brought something new, and nobody ever knew what, until it was at the gates.',
    build: (root) => sceneRoot(root, 9),
    frame(t, dur, s) {
      const R = s.R;
      R.env.tod = 3;
      R.env.moonAz = Math.PI - 0.25;
      R.env.fogNear = 300;
      R.env.fogFar = 1700;
      R.env.fogMax = 0.85;
      R.env.hazeColor = '#2a3760';
      R.env.ground = ['#33503a', '#2a4430'];
      const k = E.inOut(seg(t, 0, dur));
      look(R, 0, lerp(80, 110, k), lerp(-420, -340, k), 0, lerp(150, 120, k), -2000);
      R.begin(t);
      // Lightning: two flashes that reveal what is coming.
      const fl = Math.max(seg(t, 4.2, 4.3) * (1 - seg(t, 4.3, 4.9)), seg(t, 9.4, 9.5) * (1 - seg(t, 9.5, 10.3)), 0.6 * seg(t, 9.75, 9.8) * (1 - seg(t, 9.8, 10.1)));
      s.flash.style.opacity = fl * 0.55;
      village(R, t, { built: builtOf(GROWN), walls: true, night: 1 });
      BEASTS.forEach(([n, h], i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const p = seg(t, 0.3 + row * 1.2, dur);
        const x = (col - 1) * 330 + (row % 2) * 120;
        const z = lerp(-1700 - row * 240, -950 - row * 240, E.out(p));
        const c = t * 3 + i;
        R.bill(O(n), { x, z, h, lift: Math.abs(Math.sin(c)) * 4, rot: Math.sin(c) * 2, flash: (1 - fl) * 0.92, flashColor: '#0c1124', op: clamp(seg(t, 0.3 + row * 1.2, 1.5 + row * 1.2)) });
      });
      weather(R, 'rain', t, 200, 6, 0.6);
      R.end();
      R.env.fogNear = 1400;
      R.env.fogFar = 5200;
      R.env.fogMax = 0.6;
      R.env.hazeColor = null;
      R.env.ground = GROUND[1];
    },
  });

  scenes.push({
    id: 'dragon', min: 15, music: 'night',
    say: 'Then, one night... a dragon. Walls could not stop it. But the knight held his ground, the wizard raised his staff, and the beast fled, roaring, into the clouds.',
    build: (root) => sceneRoot(root, 10),
    frame(t, dur, s) {
      const R = s.R;
      R.env.tod = 3;
      R.env.tint = '#8590c4';
      R.env.moonAz = 0.15;
      const shake = t > 4 && t < 6.5 ? Math.sin(t * 47) * 6 : 0;
      const k = E.inOut(seg(t, 0, dur));
      look(R, lerp(-200, 120, k), lerp(110, 150, k) + shake * 0.5, lerp(-300, -420, k), 40 + shake, lerp(330, 240, seg(t, 0, 6)), 600);
      R.begin(t);
      village(R, t, { built: builtOf(GROWN.concat(['wizardtower'])), walls: false, night: 1, smoke: 0.3 });
      // The dragon comes in from the far sky, swoops low over the square, takes the blow and flees upward.
      const inP = E.inOut(seg(t, 0.5, 4.2));
      const outP = E.in(seg(t, dur - 4.5, dur - 1.2));
      const dx = lerp(-1600, -120, inP) + outP * 1700 + Math.sin(t * 1.3) * 40;
      const dz = lerp(2600, 620, inP) + outP * 900;
      const dy = lerp(900, 380, inP) + outP * 900 + Math.sin(t * 2.4) * 22;
      const hit = seg(t, 8.2, 8.5) * (1 - seg(t, 9.3, 9.8));
      R.bill(O('dragon'), { x: dx, y: dy, z: dz, h: 430, sy: 1 + 0.07 * Math.sin(t * 7), rot: outP > 0 ? -14 * outP : Math.sin(t * 1.3) * 5, flash: hit * 0.8, flashColor: '#e6d6ff' });
      R.shadowAt(dx, dz, 220, 0.25 * (1 - clamp(dy / 1500)));
      // Fire.
      if (t > 4 && t < 6.8) {
        for (let j = 0; j < 26; j++) {
          const q = ((t - 4) * 1.5 + j / 26) % 1;
          R.blob(dx + 130 + q * 260, dy + 180 - q * 260 + Math.sin(j * 3.7 + t * 12) * q * 30, dz - 40 - q * 120, 18 + q * 40, q < 0.3 ? '#fff0a0' : q < 0.6 ? '#ff9a2a' : '#d2401a', 0.85 * (1 - q));
        }
        R.light(dx + 250, dy, dz - 100, 900, '#ff7a1a', 0.45);
      }
      // Knight and wizard step out into the square.
      const step = E.out(seg(t, 5.2, 6.6));
      folk(R, 'knight', lerp(-260, -110, step), 300, { t, dir: 1, op: clamp(seg(t, 5.2, 5.6)), h: 175 });
      folk(R, 'wizard', lerp(260, 120, step), 290, { t, dir: -1, op: clamp(seg(t, 5.4, 5.8)), h: 175 });
      if (t > 7.4 && t < 9.8) {
        const q = seg(t, 7.4, 8.2);
        const a = 1 - seg(t, 9.2, 9.8);
        const p0 = R.project(80, 230, 285);
        const p1 = R.project(dx, dy + 160, dz);
        if (p0 && p1) R.add(1, () => {
          const g = R.g;
          g.globalAlpha = a;
          g.strokeStyle = '#d8c2ff';
          g.shadowColor = '#b48cff';
          g.shadowBlur = 30;
          g.lineWidth = 12 + Math.sin(t * 40) * 4;
          g.beginPath();
          g.moveTo(p0.x, p0.y);
          g.lineTo(lerp(p0.x, p1.x, q), lerp(p0.y, p1.y, q));
          g.stroke();
        });
        R.light(80, 230, 285, 260, '#b48cff', 0.6 * a);
        R.light(dx, dy + 160, dz, 500, '#c9a6ff', 0.4 * a * q);
      }
      R.end();
      R.env.tint = null;
    },
  });

  scenes.push({
    id: 'dawnfest', min: 15,
    say: 'At dawn, the whole village gathered in the square. They had built a castle, and a cathedral, and something better still. A home worth defending.',
    build(root) {
      const s = sceneRoot(root, 11);
      const r = rng(19);
      s.confetti = Array.from({ length: 140 }, () => [(r() - 0.5) * 1100, r() * 600, 120 + r() * 700, r(), Math.floor(r() * 5)]);
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      R.env.tod = lerp(0.3, 0.95, seg(t, 0, dur));
      R.env.sunAz = 0.05;
      const k = E.inOut(seg(t, 1.5, dur));
      look(R, lerp(-60, 0, k), lerp(190, 1250, k), lerp(-480, -1900, k), lerp(-20, 0, k), lerp(130, 100, k), lerp(330, 700, k));
      R.begin(t);
      village(R, t, { built: builtOf(FINAL), meadow: s.meadow, smoke: 1, walls: true });
      const crowd = ['bard', 'farmer', 'baker', 'knight', 'peasant', 'priest', 'merchant', 'wizard', 'chef', 'blacksmith', 'steward', 'carpenter'];
      crowd.forEach((n, i) => {
        const a = (i / crowd.length) * TAU;
        const x = Math.sin(a) * 360;
        const z = 400 + Math.cos(a) * 275;
        const c = (t * 1.4 + i * 0.31) % 1;
        folk(R, n, x, z, { t: t + i, dir: x > 0 ? -1 : 1, lift: Math.sin(c * Math.PI) * 18 });
        if (n === 'bard') notes(R, x, z, t);
      });
      const g = R.g;
      s.confetti.forEach(([x, y0, z, ph, ci]) => {
        const y = ((y0 - t * 80) % 600 + 600) % 600;
        R.at(x + Math.sin(t + ph * 9) * 30, y, z, (g2, p) => {
          g2.save();
          g2.translate(p.x, p.y);
          g2.rotate(t * 3 + ph * 10);
          g2.fillStyle = ['#ffd24d', '#ff6b6b', '#6bc5ff', '#8ee06b', '#ff9de2'][ci];
          g2.fillRect(-5 * p.s, -3 * p.s, 10 * p.s, 6 * p.s);
          g2.restore();
        });
      });
      R.end();
      void g;
    },
  });

  scenes.push({
    id: 'end', min: 9, tail: 2.4,
    say: 'Build a village of your own. Oakhaven. Play free at ahrens labs dot com.',
    build(root) {
      const s = sceneRoot(root, 12);
      s.title = caption(root, '<div class="big">Oakhaven</div><div class="sub">A storybook village game</div><div class="pill">Play free at ahrenslabs.com</div>');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      R.env.tod = 1.6;
      R.env.sunAz = 0.05;
      const a = t * 0.05;
      look(R, Math.sin(a) * 1900, 900, 700 - Math.cos(a) * 1900, 0, 60, 700);
      R.begin(t);
      village(R, t, { built: builtOf(FINAL), meadow: s.meadow, smoke: 1, walls: true, night: 0.4 });
      R.end();
      R.cv.style.filter = 'blur(2px) brightness(0.75)';
      s.title.show(t, 0.3, dur + 2);
    },
  });

  runAd(scenes);
})();
