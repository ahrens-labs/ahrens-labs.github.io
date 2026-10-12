// Dino Dynasty ad: the story of a dinosaur park built on a lost island, told in a 3D paper-theatre world
// made from the game's own dino art.
(function () {
  const { W, H, clamp, lerp, seg, E, rng, el, img, caption, runAd } = AD;
  const { world, palm, fern, bush, rock, meadow, weather, prop, sign } = AD3;
  const D = (n) => `sprites/dino/${n}.png`;
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- the park
  const PENS = {
    compy: { x: [-950, -420], z: [250, 650], name: 'Compys' },
    trike: { x: [-250, 480], z: [250, 800], name: 'Triceratops' },
    brachio: { x: [650, 1500], z: [200, 1150], name: 'Brachiosaurus', h: 80 },
    maia: { x: [-1150, -520], z: [1000, 1500], name: 'Maiasaura' },
    trex: { x: [-250, 560], z: [1250, 1850], name: 'T. Rex', h: 110 },
  };
  const LAGOON = [1350, 1900, 470, 320];
  const GROUND = ['#9ccf5a', '#68a83e'];

  const r0 = rng(311);
  const JUNGLE = [];
  for (let i = 0; i < 110; i++) {
    const a = r0() * TAU;
    const rad = 2100 + r0() * 1800;
    const x = 250 + Math.sin(a) * rad * 1.25;
    const z = 900 + Math.cos(a) * rad;
    JUNGLE.push([x, z, r0() < 0.6 ? 'palm' : 'bush', Math.floor(r0() * 6), 0.8 + r0() * 0.6]);
  }
  for (let i = 0; i < 50; i++) {
    const x = (r0() - 0.5) * 3800 + 250;
    const z = -700 + r0() * 3000;
    const inPen = Object.values(PENS).some((p) => x > p.x[0] - 60 && x < p.x[1] + 60 && z > p.z[0] - 60 && z < p.z[1] + 60);
    const inLagoon = ((x - LAGOON[0]) / (LAGOON[2] + 80)) ** 2 + ((z - LAGOON[1]) / (LAGOON[3] + 80)) ** 2 < 1;
    if (!inPen && !inLagoon) JUNGLE.push([x, z, ['fern', 'fern', 'rock', 'palm'][Math.floor(r0() * 4)], Math.floor(r0() * 6), 0.7 + r0() * 0.5]);
  }

  function volcano() {
    return prop('volcano', 900, 420, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#6c5a66');
      gr.addColorStop(1, '#8f8a7a');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(0, h);
      g.quadraticCurveTo(w * 0.3, h * 0.55, w * 0.43, 30);
      g.lineTo(w * 0.57, 30);
      g.quadraticCurveTo(w * 0.7, h * 0.55, w, h);
      g.closePath();
      g.fill();
      g.fillStyle = '#ff8a3a';
      g.beginPath();
      g.ellipse(w / 2, 32, w * 0.07, 8, 0, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(255,120,40,0.75)';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(w * 0.47, 36);
      g.quadraticCurveTo(w * 0.44, h * 0.25, w * 0.4, h * 0.45);
      g.stroke();
    });
  }

  function egg(cracked) {
    return prop(`egg${cracked}`, 60, 80, (g, w, h) => {
      const gr = g.createRadialGradient(w * 0.38, h * 0.35, 4, w / 2, h * 0.55, w * 0.6);
      gr.addColorStop(0, '#fffaf0');
      gr.addColorStop(1, '#d8c7a0');
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(w / 2, h * 0.56, w * 0.42, h * 0.43, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#b89a6a';
      [[20, 30], [38, 44], [26, 58]].forEach(([x, y]) => {
        g.beginPath();
        g.arc(x, y, 3.5, 0, TAU);
        g.fill();
      });
      if (cracked) {
        g.strokeStyle = '#5a4020';
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(8, 36);
        [[16, 28], [22, 38], [30, 26], [37, 37], [44, 27], [52, 34]].forEach(([x, y]) => g.lineTo(x, y));
        g.stroke();
      }
    });
  }

  // The Maiasaura art has its nest in the corner; hatchlings are the same dino without it.
  let hatchling = null;
  function noNest() {
    const im = img(D('maiasaura'));
    if (!im.naturalWidth) return im;
    if (hatchling) return hatchling;
    const c = document.createElement('canvas');
    c.width = im.naturalWidth;
    c.height = im.naturalHeight;
    c.id = 'hatchling';
    const g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    g.clearRect(c.width * 0.53, c.height * 0.57, c.width, c.height);
    hatchling = c;
    return c;
  }

  function pen(R, k, o = {}) {
    const p = PENS[k];
    const [x0, x1] = p.x;
    const [z0, z1] = p.z;
    const grow = o.grow == null ? 1 : o.grow;
    const f = { h: p.h || 70, grow };
    R.fence(x0, z0, x1, z0, f);
    R.fence(x1, z0, x1, z1, f);
    R.fence(x1, z1, x0, z1, f);
    R.fence(x0, z1, x0, z0, f);
    if (grow >= 1 && o.sign !== false) R.bill(sign(p.name), { x: x0 + 90, z: z0 - 30, h: 100, shadowW: 0.2 });
  }
  function park(R, t, o = {}) {
    // Paths, pen floors and the lagoon.
    const path = '#cdb382';
    R.decal([[-90, -3000], [90, -3000], [90, 2100], [-90, 2100]].map(([x, z]) => [x + 540, z]), path);
    R.decal([[-1400, 880], [1600, 880], [1600, 1060], [-1400, 1060]], path);
    if (o.lagoon !== false) {
      const [lx, lz, rx, rz] = LAGOON;
      R.disc(lx, lz, rx + 40, rz + 30, '#d9c48e');
      R.disc(lx, lz, rx, rz, '#2f8fb8', '#8fd3ea', 4);
      R.disc(lx, lz, rx * 0.7, rz * 0.65, 'rgba(25,95,150,0.7)');
      for (let i = 0; i < 3; i++) {
        const q = (t * 0.25 + i / 3) % 1;
        R.disc(lx - 120 + i * 90, lz + 40 - i * 60, 30 + q * 160, 20 + q * 100, null, `rgba(220,245,255,${0.5 * (1 - q)})`, 2);
      }
    }
    if (o.meadow) o.meadow();
    R.bill(volcano(), { x: 2600, z: 9000, h: 1500, shadow: false, fog: 0.45 });
    for (let j = 0; j < 8; j++) {
      const q = (t * 0.05 + j / 8) % 1;
      R.blob(2600 + q * 900, 1500 + q * 1400, 9050, 260 + q * 500, '#8a7f86', 0.5 * (1 - q));
    }
    JUNGLE.forEach(([x, z, k, sd, sc]) => {
      if (k === 'palm') R.bill(palm(sd), { x, z, minD: 220, h: 470 * sc, shadowW: 0.18, rot: Math.sin(t * 0.9 + x) * 1.2 });
      else if (k === 'bush') R.bill(bush(sd, '#2f7f3a'), { x, z, minD: 220, h: 180 * sc, shadowW: 0.3 });
      else if (k === 'fern') R.bill(fern(sd), { x, z, minD: 160, h: 110 * sc, shadowW: 0.25, rot: Math.sin(t * 1.4 + x) * 2 });
      else R.bill(rock(sd, '#9a9184'), { x, z, minD: 220, h: 90 * sc, shadowW: 0.3 });
    });
    Object.keys(PENS).forEach((k) => {
      if (!o.pens || o.pens[k] != null) pen(R, k, { grow: o.pens ? o.pens[k] : 1 });
    });
  }

  // A dino at x, z. Every one of the game's dinos faces right in its art.
  function dino(R, n, x, z, o = {}) {
    const c = (o.walk || 0) * (o.speed || 6);
    const walking = o.walk != null;
    const lift = walking ? Math.abs(Math.sin(c)) * (o.bob || 8) : 0;
    const rot = walking ? Math.sin(c) * 3 : Math.sin((o.t || 0) * 1.2 + x) * 1.2;
    const sy = 1 + (walking ? 0.02 * Math.cos(2 * c) : 0.02 * Math.sin((o.t || 0) * 2 + x));
    return R.bill(D(n), { x, z, y: o.y, h: o.h, dir: o.dir || 1, lift: lift + (o.lift || 0), rot: rot + (o.rot || 0), sy: sy * (o.sy || 1), sx: o.sx, op: o.op, shadowW: o.shadowW || 0.32, clipY: o.clipY, flash: o.flash, flashColor: o.flashColor, bias: o.bias });
  }

  function look(R, x, y, z, tx, ty, tz) {
    Object.assign(R.cam, { x, y, z });
    const dx = tx - x;
    const dz = tz - z;
    R.cam.yaw = Math.atan2(dx, dz);
    R.cam.pitch = Math.atan2(y - ty, Math.hypot(dx, dz));
  }

  function sceneRoot(root, seed) {
    const R = world(root, { seed });
    R.env.ground = GROUND;
    R.env.mountains = { far: '#7fa6a0', near: '#5f9a6a' };
    R.env.haze = null;
    el('div', 'vignette', root);
    const flash = el('div', 'full', root, { zIndex: 8600, background: '#eef3ff', opacity: 0 });
    const inPen = (x, z) => Object.values(PENS).some((p) => Math.abs(x - p.x[0]) < 12 || Math.abs(x - p.x[1]) < 12) || (((x - LAGOON[0]) / LAGOON[2]) ** 2 + ((z - LAGOON[1]) / LAGOON[3]) ** 2 < 1.15) || Math.abs(x - 540) < 100 || Math.abs(z - 970) < 100;
    return { R, flash, meadow: meadow(R, [-2000, 2600, -900, 2600], 1100, seed + 5, { blade: '#4e8a2c', flowers: ['#ffe066', '#ff8f6b', '#ffffff'] }, inPen) };
  }

  // ---------------------------------------------------------------- scenes
  const scenes = [];

  scenes.push({
    id: 'open', min: 9.5, lead: 1.2,
    say: 'Far out at sea, past the edge of every map, there is an island where the ground still trembles.',
    build(root) {
      const bg = el('div', 'full', root, { background: `url(${D('cover')}) center/cover`, transformOrigin: '50% 45%' });
      el('div', 'vignette', root);
      const title = caption(root, '<div class="big">Dino Dynasty</div>');
      return { bg, title };
    },
    frame(t, dur, s) {
      const p = t / dur;
      s.bg.style.transform = `perspective(900px) rotateX(${lerp(4, 0, E.sine(p))}deg) scale(${lerp(1.3, 1.06, E.sine(p))}) translateY(${lerp(20, -8, p)}px)`;
      s.title.show(t, dur - 4.4, dur + 1, 'pop');
    },
  });

  scenes.push({
    id: 'fences', min: 12,
    say: 'And on that island, someone had a very big idea. A dinosaur park! Step one... fences. Big ones. Lots of them.',
    build: (root) => sceneRoot(root, 2),
    frame(t, dur, s) {
      const R = s.R;
      R.env.tod = lerp(0.1, 0.8, seg(t, 0, dur));
      R.env.sunAz = 0.3;
      R.env.fogNear = 600;
      R.env.fogFar = 3600;
      R.env.fogMax = lerp(0.85, 0.45, seg(t, 0, dur));
      const k = E.inOut(seg(t, 0, 6.5));
      const a = lerp(0, 0.5, E.inOut(seg(t, 5, dur)));
      look(R, lerp(200, 100, k) + Math.sin(a) * 600, lerp(1900, 420, k), lerp(-2600, -900, k) + (1 - Math.cos(a)) * 300, lerp(250, 100, k), 0, lerp(1500, 600, k));
      R.begin(t);
      const pens = {};
      ['trike', 'compy', 'brachio', 'maia', 'trex'].forEach((p, i) => (pens[p] = seg(t, 5 + i * 0.9, 7 + i * 0.9)));
      park(R, t, { pens, meadow: s.meadow });
      R.end();
      R.env.fogNear = 1400;
      R.env.fogFar = 5200;
      R.env.fogMax = 0.6;
    },
  });

  const COMPYS = Array.from({ length: 7 }, (_, i) => [i * 0.37, (i * 53) % 140 - 70, 0.85 + (i % 3) * 0.12]);
  scenes.push({
    id: 'compys', min: 11,
    say: 'The first guests were small, fast, and impossible to count. Seriously. Nobody ever managed to count them.',
    build: (root) => sceneRoot(root, 3),
    frame(t, dur, s) {
      const R = s.R;
      R.env.tod = 0.95;
      R.env.focus = 420;
      R.env.dof = 2.4;
      const cx = lerp(-900, -560, seg(t, 0, dur));
      R.env.focus = 300;
      look(R, cx - 80, 50, 290, cx + 60, 35, 560);
      R.begin(t);
      park(R, t, { meadow: s.meadow });
      COMPYS.forEach(([d, dz, sc], i) => {
        const run = seg(t, 0.3 + d, dur - 0.5 + d);
        const zig = Math.sin(t * 2.2 + i * 1.7) * 60;
        const x = lerp(-1000, -380, run) + Math.sin(t * 3 + i) * 30;
        dino(R, 'compy', x, 520 + dz * 0.6 + zig * 0.6, { h: 68 * sc, walk: t + i * 0.13, speed: 11, bob: 14, op: clamp(seg(x, -1000, -930)) * (1 - seg(x, -440, -390)) });
      });
      // Ferns right by the lens, out of focus.
      [[-140, 470, 2], [150, 480, 4]].forEach(([dx, dz, sd]) => R.bill(fern(sd, '#2f7f30'), { x: cx + dx, z: dz, h: 60, blur: 4, shadow: false }));
      R.end();
      R.env.focus = null;
    },
  });

  scenes.push({
    id: 'giants', min: 14,
    say: 'Then came the big ones. A Triceratops with a very bad attitude... and a Brachiosaurus so tall, the fence was more of a polite suggestion.',
    build: (root) => sceneRoot(root, 4),
    frame(t, dur, s) {
      const R = s.R;
      R.env.tod = 1;
      R.env.sunAz = 0.8;
      const split = 6.2;
      if (t < split) {
        const k = E.inOut(seg(t, 0, split));
        look(R, lerp(80, 140, k), 70, lerp(-80, 40, k), 160, 90, 500);
      } else {
        const k = E.inOut(seg(t, split, dur));
        look(R, lerp(700, 820, k), 60, lerp(-520, -430, k), lerp(1000, 1020, k), lerp(200, 560, k), 620);
      }
      R.begin(t);
      park(R, t, { meadow: s.meadow });
      const walk = seg(t, 0.4, 3.6);
      const tz = lerp(700, 470, E.out(walk));
      const snort = seg(t, 4, 4.4) * (1 - seg(t, 4.6, 5.2));
      dino(R, 'triceratops', lerp(300, 120, E.out(walk)), tz, { h: 190, walk: walk > 0 && walk < 1 ? t : undefined, speed: 4, dir: -1, rot: -6 * snort });
      for (let j = 0; j < 5; j++) {
        const q = seg(t, 4.1 + j * 0.05, 5.4);
        if (q > 0 && q < 1) R.blob(45 - q * 80, 70 + j * 6 + q * 30, tz - 30 - j * 8, 14 + q * 34, '#e8e0d0', 0.7 * (1 - q));
      }
      dino(R, 'stegosaurus', -120, 640, { h: 170, t, dir: 1 });
      dino(R, 'brachiosaurus', 1000, 640, { h: 620, t, rot: Math.sin(t * 0.6) * 1.5 });
      dino(R, 'brachiosaurus', 1300, 980, { h: 560, t: t + 2, dir: -1 });
      R.end();
    },
  });

  scenes.push({
    id: 'feeding', min: 13,
    say: 'Feeding time was always lively. Leaves for the plant eaters. Meat for the meat eaters. And never, ever mix those up.',
    build: (root) => sceneRoot(root, 5),
    frame(t, dur, s) {
      const R = s.R;
      R.env.tod = 1.1;
      R.env.sunAz = -0.3;
      const a = lerp(-0.5, 0.45, E.inOut(seg(t, 0, dur)));
      look(R, 115 + Math.sin(a) * 900, 300, 525 - Math.cos(a) * 900, 115, 60, 525);
      R.begin(t);
      park(R, t, { meadow: s.meadow });
      // Plants for the stegosaurus and triceratops, meat for the raptors in the compy pen next door.
      for (let i = 0; i < 6; i++) {
        const a0 = 0.6 + i * 1.1;
        const q = seg(t, a0, a0 + 1.1);
        const meat = i % 2 === 1;
        const tx = meat ? -700 : -40 + i * 60;
        const tz = meat ? 470 : 480 + (i % 3) * 60;
        const x = lerp(meat ? -500 : 160, tx, q);
        const z = lerp(-200, tz, q);
        const y = Math.sin(q * Math.PI) * 340;
        if (q > 0 && q < 1) R.bill(D(meat ? 'meat' : 'plant'), { x, y, z, h: 70, rot: q * 540, shadow: false });
        else if (q >= 1) {
          const gone = seg(t, a0 + 1.1, a0 + 2.6);
          if (gone < 1) R.bill(D(meat ? 'meat' : 'plant'), { x: tx, z: tz, h: 60 * (1 - gone * 0.8), shadowW: 0.3 });
        }
      }
      const munch = Math.sin(t * 9);
      dino(R, 'stegosaurus', 30, 560, { h: 175, t, rot: 4 + munch * 4 });
      dino(R, 'triceratops', 260, 620, { h: 180, t, dir: -1, rot: -3 - munch * 3 });
      [[-820, 440, 0], [-650, 560, 1.2], [-560, 380, 2.4]].forEach(([x, z, ph], i) => {
        const leap = Math.max(0, Math.sin(t * 2.4 + ph));
        dino(R, 'velociraptor', x + Math.sin(t + ph) * 60, z, { h: 115, lift: leap * 60, rot: -leap * 12, dir: i === 1 ? -1 : 1 });
      });
      R.end();
    },
  });

  scenes.push({
    id: 'babies', min: 13,
    say: 'Then one quiet morning, something in the Maiasaura nest began to wobble. Then something cracked. And then... hello there.',
    build: (root) => sceneRoot(root, 6),
    frame(t, dur, s) {
      const R = s.R;
      R.env.tod = lerp(0.4, 0.9, seg(t, 0, dur));
      R.env.sunAz = 0.1;
      R.env.focus = lerp(520, 330, E.inOut(seg(t, 0, dur)));
      R.env.dof = 2.2;
      const k = E.inOut(seg(t, 0, dur));
      look(R, lerp(-960, -840, k), lerp(175, 130, k), lerp(740, 860, k), -830, 55, 1260);
      R.begin(t);
      park(R, t, { meadow: s.meadow });
      dino(R, 'maiasaura', -960, 1320, { h: 190, t, rot: seg(t, 6.5, 7) * (1 - seg(t, 9, 9.5)) * -6 });
      [[-800, 1240], [-740, 1275], [-770, 1210]].forEach(([x, z], i) => {
        const at = 5.2 + i * 1.1;
        const wob = seg(t, 2 + i * 0.6, at) > 0 && t < at ? Math.sin(t * 22 + i) * (6 + 6 * seg(t, 2, at)) : 0;
        if (t < at) {
          R.bill(egg(t > at - 1.3), { x, z, h: 48, rot: wob, shadowW: 0.4 });
        } else {
          const q = seg(t, at, at + 0.8);
          for (let j = 0; j < 5; j++) R.blob(x + Math.cos(j * 1.3) * q * 50, 30 + Math.sin(q * Math.PI) * 50 - q * 20, z - 10, 8, '#fff3d6', 1 - q);
          const hop = Math.abs(Math.sin((t - at) * 5)) * 10 * seg(t, at + 0.5, at + 1);
          R.bill(noNest(), { x, z, h: lerp(30, 66, E.back(seg(t, at, at + 0.6))), lift: hop, dir: i % 2 ? -1 : 1, rot: Math.sin(t * 3 + i) * 3, shadowW: 0.3 });
        }
      });
      R.end();
      R.env.focus = null;
    },
  });

  scenes.push({
    id: 'lagoon', min: 12,
    say: 'Down at the lagoon, the Mosasaurus liked to say hello. Loudly. And very, very wetly.',
    build(root) {
      const s = sceneRoot(root, 7);
      s.drops = el('canvas', 'fx', root, { zIndex: 8400 });
      s.drops.width = W;
      s.drops.height = H;
      const r = rng(4);
      s.dropList = Array.from({ length: 26 }, () => [r() * W, r() * H, 10 + r() * 34, r()]);
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      R.env.tod = 1.15;
      R.env.sunAz = 0.6;
      const [lx, lz] = LAGOON;
      const breach = seg(t, 3.2, 5.6);
      const shake = breach > 0.7 && breach < 0.95 ? Math.sin(t * 50) * 8 : 0;
      look(R, lx - 120 + shake, 45, lz - 620, lx, 120 + breach * 60, lz);
      R.begin(t);
      park(R, t, { meadow: s.meadow });
      // The Mosasaurus surges up, arcs over, and slams back down.
      const my = breach > 0 ? Math.sin(breach * Math.PI) * 330 - 160 : -300;
      const mrot = lerp(-35, 40, breach);
      if (breach > 0 && breach < 1) dino(R, 'mosasaurus', lx + lerp(-160, 160, breach), lz, { h: 300, lift: my, rot: mrot, clipY: 0, shadow: false });
      // Splashes when it breaks the surface and when it lands.
      [[3.3, -120], [5.3, 150]].forEach(([at, dx]) => {
        const q = seg(t, at, at + 1.6);
        if (q <= 0 || q >= 1) return;
        for (let j = 0; j < 22; j++) {
          const a = (j / 22) * TAU;
          const sp = 0.6 + ((j * 37) % 10) / 14;
          R.blob(lx + dx + Math.cos(a) * q * 220 * sp, Math.sin(q * Math.PI) * 260 * sp, lz + Math.sin(a) * q * 90, 20 + q * 20, '#e8f8ff', 0.85 * (1 - q));
        }
        R.disc(lx + dx, lz, 60 + q * 380, 30 + q * 220, null, `rgba(255,255,255,${0.7 * (1 - q)})`, 4);
      });
      const fly = seg(t, 6.5, dur);
      if (fly > 0 && fly < 1) dino(R, 'quetzalcoatlus', lerp(lx - 900, lx + 1100, fly), lz + 300, { y: 500 + Math.sin(fly * 9) * 30, h: 240, rot: Math.sin(t * 3) * 5, shadow: false });
      R.end();
      // Water on the lens after the landing splash.
      const g = s.drops.getContext('2d');
      g.clearRect(0, 0, W, H);
      const wet = seg(t, 5.55, 5.75) * (1 - seg(t, 7.5, 10));
      if (wet > 0) {
        s.dropList.forEach(([x, y, r, ph]) => {
          const yy = y + seg(t, 5.7, 10) * 60 * ph;
          const rg = g.createRadialGradient(x - r * 0.3, yy - r * 0.3, r * 0.1, x, yy, r);
          rg.addColorStop(0, `rgba(255,255,255,${0.55 * wet})`);
          rg.addColorStop(0.7, `rgba(200,235,255,${0.18 * wet})`);
          rg.addColorStop(1, `rgba(120,180,220,${0.35 * wet})`);
          g.fillStyle = rg;
          g.beginPath();
          g.ellipse(x, yy, r * 0.8, r, 0, 0, TAU);
          g.fill();
        });
      }
    },
  });

  scenes.push({
    id: 'storm', min: 15,
    say: 'But when the storm rolled in, and the thunder shook the trees, everyone remembered who was really in charge.',
    build(root) {
      const s = sceneRoot(root, 8);
      s.roar = caption(root, '<div class="big">ROAR!</div>');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      R.env.tod = lerp(1.6, 2.6, seg(t, 0, 3));
      R.env.tint = '#7d86a8';
      R.env.clouds = 1.6;
      R.env.fogNear = 500;
      R.env.fogFar = 2400;
      R.env.fogMax = 0.7;
      R.env.hazeColor = '#4a5470';
      const roar = seg(t, 8.6, 9.0) * (1 - seg(t, 11, 11.8));
      const shake = roar > 0 ? Math.sin(t * 61) * 10 * roar : 0;
      const push = E.inOut(seg(t, 0, 8.6)) + roar * 0.15;
      look(R, 150 + shake, lerp(75, 60, push), lerp(640, 840, push), 150, lerp(160, 200, push), 1700);
      const fl = Math.max(seg(t, 2.5, 2.6) * (1 - seg(t, 2.6, 3.3)), seg(t, 6.2, 6.3) * (1 - seg(t, 6.3, 7)), 0.8 * seg(t, 8.6, 8.7) * (1 - seg(t, 8.7, 9.6)));
      s.flash.style.opacity = fl * 0.6;
      R.begin(t);
      park(R, t, {});
      const walk = E.out(seg(t, 3.2, 8.4));
      const tx = lerp(-60, 140, walk);
      const tz = lerp(1800, 1420, walk);
      dino(R, 'trex', tx, tz, { h: 330, walk: walk > 0 && walk < 0.97 ? t : undefined, speed: 3.2, bob: 6, rot: -roar * 8, sy: 1 + roar * 0.06, flash: fl * 0.7 });
      weather(R, 'rain', t, 320, 9);
      R.end();
      R.env.tint = null;
      R.env.clouds = 1;
      R.env.fogNear = 1400;
      R.env.fogFar = 5200;
      R.env.fogMax = 0.6;
      R.env.hazeColor = null;
      s.roar.show(t, 8.7, 11.2, 'pop');
      s.roar.e.style.top = '24%';
    },
  });

  const FINALE = [
    ['compy', -700, 420, 60], ['compy', -620, 500, 55], ['compy', -760, 560, 62], ['triceratops', 40, 520, 180], ['stegosaurus', 260, 660, 170],
    ['brachiosaurus', 1000, 620, 600], ['brachiosaurus', 1250, 980, 560], ['maiasaura', -880, 1240, 180], ['trex', 120, 1520, 350],
    ['parasaurolophus', -300, 1120, 200], ['spinosaurus', 900, 1600, 260], ['ankylosaurus', -1150, 1700, 140],
  ];
  scenes.push({
    id: 'finale', min: 15,
    say: 'When the clouds cleared, the park was still standing. Every pen, every dino, every egg. The greatest park the world had ever seen.',
    build: (root) => sceneRoot(root, 9),
    frame(t, dur, s) {
      const R = s.R;
      R.env.tod = lerp(1.35, 1.85, seg(t, 0, dur));
      R.env.sunAz = 0.15;
      const k = E.inOut(seg(t, 0, dur));
      const a = lerp(-0.25, 0.25, k);
      look(R, 200 + Math.sin(a) * lerp(900, 2600, k), lerp(160, 1500, k), 900 - Math.cos(a) * lerp(1300, 2900, k), 250, lerp(140, 0, k), 1000);
      R.begin(t);
      park(R, t, { meadow: s.meadow });
      FINALE.forEach(([n, x, z, h], i) => dino(R, n, x + Math.sin(t * 0.4 + i) * 30, z, { h, t: t + i, dir: Math.sin(t * 0.4 + i + 1.57) > 0 ? 1 : -1 }));
      dino(R, 'mosasaurus', LAGOON[0], LAGOON[1], { h: 280, lift: -150 + Math.sin(t * 0.8) * 20, clipY: 0, shadow: false, rot: -10 });
      [0, 1].forEach((i) => {
        const q = (t * 0.06 + i * 0.5) % 1;
        dino(R, 'quetzalcoatlus', lerp(-1600, 2200, q), 1400 + i * 600, { y: 700 + i * 200 + Math.sin(t + i) * 40, h: 250, shadow: false, rot: Math.sin(t * 2 + i) * 6 });
      });
      R.end();
    },
  });

  scenes.push({
    id: 'end', min: 9, tail: 2.4,
    say: 'Build a park of your own. Dino Dynasty. Play free at ahrens labs dot com.',
    build(root) {
      const s = sceneRoot(root, 10);
      s.title = caption(root, '<div class="big">Dino Dynasty</div><div class="sub">Build the greatest dino park on Earth</div><div class="pill">Play free at ahrenslabs.com</div>');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      R.env.tod = 1.7;
      R.env.sunAz = 0.15;
      const a = t * 0.05;
      look(R, 250 + Math.sin(a) * 2600, 1300, 900 - Math.cos(a) * 2600, 250, 0, 1000);
      R.begin(t);
      park(R, t, { meadow: s.meadow });
      FINALE.forEach(([n, x, z, h], i) => dino(R, n, x, z, { h, t: t + i }));
      R.end();
      R.cv.style.filter = 'blur(2px) brightness(0.75)';
      s.title.show(t, 0.3, dur + 2);
    },
  });

  runAd(scenes);
})();
