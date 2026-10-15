// Cauldron Lane ad: a fairy-tale movie trailer down a lantern-lit lane of potion shops, out into the wilds and on to
// the Moon Fair, with full-body cut-outs of the game's shops, townsfolk and beasts.
(function () {
  const { W, H, clamp, lerp, seg, E, rng, el, img, caption, runAd } = AD;
  const { world, prop, pine, oak, bush, rock } = AD3;
  const A = (n) => `sprites/cl/${n}.png`;
  const TAU = Math.PI * 2;

  const style = el('style', '', document.head);
  style.textContent = `
    .title .big { -webkit-text-stroke: 3px rgba(50, 15, 70, 0.65); text-shadow: 0 6px 0 rgba(55, 18, 75, 0.9), 0 14px 34px rgba(0, 0, 0, 0.6), 0 0 40px rgba(170, 255, 140, 0.35); }
    .title .mid { text-shadow: 0 5px 0 rgba(55, 18, 75, 0.85), 0 12px 26px rgba(0, 0, 0, 0.55); }
    .title .pill { background: #8ff07a; color: #1f3a12; }
    .chip { position: absolute; left: 0; top: 0; z-index: 8700; white-space: nowrap; padding: 12px 24px; border-radius: 18px; transform-origin: 50% 50%;
      background: rgba(40, 16, 58, 0.86); color: #fff6e2; font: 38px/1 "Lilita One", sans-serif; box-shadow: 0 0 0 3px rgba(242, 193, 78, 0.8), 0 12px 30px rgba(0, 0, 0, 0.5); }
    .chip.good { box-shadow: 0 0 0 3px #8ff07a, 0 12px 30px rgba(0, 0, 0, 0.5); }`;

  // ---------------------------------------------------------------- small drawn props
  const FLASK = new Path2D('M38 6h24v10h-4v24c18 7 30 24 30 44 0 26-20 42-38 42S12 110 12 84c0-20 12-37 30-44V16h-4z');
  const LIQUID = new Path2D('M15 88c10-6 26-6 35 0s25 6 35 0c-1 22-18 34-35 34S16 110 15 88z');
  const potion = (col) => prop(`potion${col}`, 200, 260, (g) => {
    g.scale(2, 2);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fill(FLASK);
    g.fillStyle = col;
    g.fill(LIQUID);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 4;
    g.lineJoin = 'round';
    g.stroke(FLASK);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath();
    g.arc(34, 70, 6, 0, TAU);
    g.fill();
    g.fillStyle = '#9a6a3a';
    g.beginPath();
    g.roundRect(34, 0, 32, 12, 4);
    g.fill();
    g.stroke();
  });
  // A round portrait of a beast (for the mermaid, who has no full-body cut-out), drawn once its art loads.
  const MEDALS = {};
  function medal(name) {
    if (MEDALS[name]) return MEDALS[name];
    const im = img(A(name));
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 320;
    const g = c.getContext('2d');
    if (im.complete && im.naturalWidth) {
      g.save();
      g.beginPath();
      g.arc(160, 160, 148, 0, TAU);
      g.clip();
      g.drawImage(im, 12, 12, 296, 296);
      g.restore();
      g.strokeStyle = '#f2c14e';
      g.lineWidth = 12;
      g.beginPath();
      g.arc(160, 160, 150, 0, TAU);
      g.stroke();
      MEDALS[name] = c;
    }
    return c;
  }

  function coinAt(R, x, y, z, r, spin, a = 1, bias = 30) {
    if (a <= 0.01) return;
    R.at(x, y, z, (g, p) => {
      const rr = r * p.s;
      if (rr < 0.6) return;
      g.globalAlpha = a;
      g.translate(p.x, p.y);
      g.scale(Math.max(0.15, Math.abs(Math.cos(spin))), 1);
      const gr = g.createRadialGradient(-rr * 0.3, -rr * 0.3, rr * 0.1, 0, 0, rr);
      gr.addColorStop(0, '#fff6c0');
      gr.addColorStop(0.55, '#f2c14e');
      gr.addColorStop(1, '#a8740c');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, rr, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(120,70,0,0.6)';
      g.lineWidth = rr * 0.12;
      g.beginPath();
      g.arc(0, 0, rr * 0.7, 0, TAU);
      g.stroke();
    }, bias);
  }
  // A burst of coins flying out of a point and tumbling down.
  function coinBurst(R, x, y, z, t, a, seed, n = 10) {
    const p = seg(t, a, a + 1.3);
    if (p <= 0 || p >= 1) return;
    const r = rng(seed);
    for (let j = 0; j < n; j++) {
      const ang = r() * TAU;
      const sp = 80 + r() * 120;
      const up = 260 + r() * 200;
      coinAt(R, x + Math.cos(ang) * sp * p, y + up * p - 420 * p * p, z + Math.sin(ang) * sp * 0.6 * p, 15, t * 9 + j, 1 - seg(p, 0.7, 1));
    }
    R.light(x, y + 60, z, 240, '#ffd24d', 0.45 * (1 - p));
  }
  // A name tag floating in the world, always in front of what is around it.
  function tag(R, x, y, z, text, o = {}) {
    if (o.op === 0) return;
    R.at(x, y, z, (g, p) => {
      const s = clamp(p.s * (o.k || 1), 0.35, 1.3) * (o.pop == null ? 1 : lerp(0.4, 1, E.back(o.pop)));
      g.globalAlpha = o.op == null ? 1 : o.op;
      g.font = `${Math.round(28 * s)}px "Lilita One"`;
      const w = g.measureText(text).width + 30 * s;
      const hh = 44 * s;
      g.fillStyle = o.bg || 'rgba(255,246,226,0.96)';
      g.shadowColor = 'rgba(0,0,0,0.35)';
      g.shadowBlur = 12 * s;
      g.beginPath();
      g.roundRect(p.x - w / 2, p.y - hh / 2, w, hh, hh / 2);
      g.fill();
      g.shadowBlur = 0;
      if (o.ring) {
        g.strokeStyle = o.ring;
        g.lineWidth = 4 * s;
        g.stroke();
      }
      g.fillStyle = o.fg || '#3a1450';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, p.x, p.y + 1.5 * s);
    }, o.bias == null ? 80 : o.bias);
  }
  // A round ingredient token with an emoji (and optionally a price pill underneath).
  function token(R, x, y, z, icon, o = {}) {
    R.at(x, y, z, (g, p) => {
      const s = p.s * (o.k || 1);
      const r = 40 * s;
      g.globalAlpha = o.op == null ? 1 : o.op;
      if (o.glow) {
        g.shadowColor = '#8ff07a';
        g.shadowBlur = 30 * s * o.glow;
      }
      const gr = g.createRadialGradient(p.x - r * 0.3, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
      gr.addColorStop(0, '#fffbe9');
      gr.addColorStop(1, '#e2d2b0');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(p.x, p.y, r, 0, TAU);
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = o.glow ? '#8ff07a' : '#7a4fa0';
      g.lineWidth = 5 * s;
      g.stroke();
      g.font = `${Math.round(44 * s)}px sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(icon, p.x, p.y + 3 * s);
      if (o.price != null) {
        g.font = `${Math.round(24 * s)}px "Lilita One"`;
        const label = `🪙${o.price}`;
        const w = g.measureText(label).width + 22 * s;
        g.fillStyle = '#ffd24d';
        g.beginPath();
        g.roundRect(p.x - w / 2, p.y + r + 6 * s, w, 32 * s, 16 * s);
        g.fill();
        g.fillStyle = '#4a2a00';
        g.fillText(label, p.x, p.y + r + 23 * s);
      }
    }, o.bias == null ? 40 : o.bias);
  }

  // ---------------------------------------------------------------- the lane
  const SHOP_Z = [300, 820, 1340, 1860, 3420, 3940, 4460];
  const LEFT = ['blue', 'green', 'red', 'purple', 'blue', 'red', 'green'];
  const RIGHT = ['purple', 'red', 'blue', 'green', 'purple', 'green', 'blue'];
  const HOME = [-560, 820];
  const NEXT = [-560, 1340];
  const CAUL = [-330, 700];
  const PLAZA = [0, 2600];
  const LANTERNS = [];
  [560, 1080, 1600, 3680, 4200].forEach((z) => {
    if (z !== 560) LANTERNS.push([-300, z]);
    LANTERNS.push([300, z]);
  });
  const r0 = rng(17);
  const TREES = [];
  for (let i = 0; i < 110; i++) {
    const side = i % 2 ? 1 : -1;
    TREES.push([side * (880 + r0() * 2200), -1800 + r0() * 7400, r0() < 0.55 ? 'oak' : 'pine', Math.floor(r0() * 9), 0.85 + r0() * 0.5]);
  }
  const FLIES = Array.from({ length: 70 }, () => [(r0() - 0.5) * 1500, 40 + r0() * 380, r0() * 4800, r0() * TAU, 0.5 + r0()]);
  const STALLS = [[-480, 2780], [-160, 2820], [160, 2820], [480, 2780]];

  function lantern(R, x, z, glow = 1) {
    R.bill(A('full-lantern'), { x, z, h: 250, shadowW: 0.25 });
    R.light(x + (x < 0 ? 18 : -18), 205, z, 120, '#ffc66b', 0.24 * glow);
  }
  function fireflies(R, t, a = 1) {
    FLIES.forEach(([x, y, z, ph, sp]) => {
      const fx = x + Math.sin(t * 0.6 * sp + ph) * 60;
      const fy = y + Math.sin(t * 0.9 * sp + ph * 2) * 30;
      R.blob(fx, fy, z, 9, '#fff2a8', a * (0.4 + 0.4 * Math.sin(t * 2.6 * sp + ph)));
    });
  }
  function steam(R, t, x, z, col = '#a8ff8a', a = 1) {
    for (let j = 0; j < 10; j++) {
      const q = (t * 0.45 + j / 10) % 1;
      R.blob(x + Math.sin(t * 1.3 + j * 2) * 30 * q, 130 + q * 320, z, 26 + q * 50, col, 0.38 * a * (1 - q) * Math.min(1, q * 6));
    }
    R.light(x, 120, z, 260, col, 0.35 * a);
  }

  function lane(R, t, o = {}) {
    R.decal([[-250, -4000], [250, -4000], [250, 5600], [-250, 5600]], '#7d6c5e');
    for (let z = -3800; z < 5400; z += 120) R.decal([[-250, z], [250, z], [250, z + 8], [-250, z + 8]], 'rgba(60,45,35,0.35)');
    R.disc(PLAZA[0], PLAZA[1], 780, 500, '#86735f', '#5d4c40', 4);
    R.disc(PLAZA[0], PLAZA[1], 520, 330, '#8f7b66', '#6a5747', 3);
    TREES.forEach(([x, z, k, sd, sc]) => R.bill(k === 'pine' ? pine(sd) : oak(sd, 1), { x, z, h: (k === 'pine' ? 460 : 400) * sc, shadowW: 0.25, rot: Math.sin(t * 0.8 + x) * 0.6 }));
    SHOP_Z.forEach((z, i) => {
      [[-560, LEFT[i]], [560, RIGHT[i]]].forEach(([x, c]) => {
        const lit = o.lit == null ? 1 : o.lit;
        R.bill(A('full-shop-' + c), { x, z, h: 470, dir: x < 0 ? 1 : -1, shadowW: 0.4, bias: -30, flash: o.glowShop && o.glowShop[0] === x && o.glowShop[1] === z ? o.glowShop[2] : 0, flashColor: '#c8ffb0' });
        R.light(x + (x < 0 ? 40 : -40), 150, z - 40, 170, '#ffbe5c', 0.14 * lit);
      });
    });
    LANTERNS.forEach(([x, z]) => lantern(R, x, z, o.lit == null ? 1 : o.lit));
    if (o.cauldron !== false) {
      R.bill(A('full-cauldron'), { x: CAUL[0], z: CAUL[1], h: 150, shadowW: 0.45 });
      steam(R, t, CAUL[0], CAUL[1] + 5);
    }
    if (o.stalls) STALLS.forEach(([x, z], i) => R.bill(A('full-stall'), { x, z, h: 300, dir: i < 2 ? 1 : -1, shadowW: 0.4 }));
    if (o.flies !== false) fireflies(R, t, o.flies || 1);
  }

  function look(R, x, y, z, tx, ty, tz) {
    Object.assign(R.cam, { x, y, z });
    const dx = tx - x;
    const dz = tz - z;
    R.cam.yaw = Math.atan2(dx, dz);
    R.cam.pitch = Math.atan2(y - ty, Math.hypot(dx, dz));
  }
  // A cut-out person or beast; `walk` makes them bob along.
  function fig(R, n, x, z, h, o = {}) {
    const t = o.t || 0;
    const bob = o.walk != null ? Math.abs(Math.sin(o.walk * 7)) * 8 : 0;
    const rot = o.walk != null ? Math.sin(o.walk * 7) * 3 : Math.sin(t * 1.3 + x) * 0.8;
    R.bill(A('full-' + n), {
      x, y: o.y || 0, z, h, dir: o.dir || 1, lift: bob + (o.lift || 0), rot: rot + (o.rot || 0), sy: 1 + 0.015 * Math.sin(t * 2.2 + x),
      op: o.op, flash: o.flash, flashColor: o.flashColor, bias: o.bias, shadowW: 0.3, shadow: o.y ? false : undefined,
    });
  }

  function word(root, cls, html) {
    const e = el('div', cls, root);
    e.innerHTML = html;
    return e;
  }
  // Pop a DOM chip in at `a` (and out at `b`), centred on x, y.
  function pop(e, t, a, b, x, y, rot = 0) {
    const p = seg(t, a, a + 0.45);
    const q = 1 - seg(t, b - 0.35, b);
    const vis = t >= a && t < b;
    e.style.display = vis ? '' : 'none';
    if (!vis) return;
    e.style.opacity = Math.min(p * 2, q);
    e.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${rot}deg) scale(${lerp(0.5, 1, E.back(p))})`;
  }

  function sceneRoot(root, seed) {
    const R = world(root, { seed });
    el('div', 'vignette', root);
    const flash = el('div', 'full', root, { zIndex: 8600, background: '#eaffd8', opacity: 0 });
    R.env.ground = ['#46663c', '#2f4a2a'];
    R.env.mountains = { far: '#7d86a8', near: '#4e6650' };
    R.env.fogNear = 1800;
    R.env.fogFar = 7500;
    R.env.fogMax = 0.5;
    R.env.wind = 2;
    return { R, flash };
  }
  const dusk = (R, k = 0) => {
    R.env.tod = lerp(2.3, 2.6, k);
    R.env.sunAz = 0.4;
    R.env.moonAz = -0.25;
    R.env.tint = '#f2dcec';
  };
  const night = (R, az = -0.25) => {
    R.env.tod = 3;
    R.env.moonAz = az;
    R.env.tint = '#bcc0ea';
  };
  const at = (f, dur, lead = 0.6) => lead + f * Math.max(1, dur - lead - 0.9);

  // ---------------------------------------------------------------- scenes
  const scenes = [];

  scenes.push({
    id: 'open', min: 8.5, lead: 1.2,
    say: 'Welcome to Cauldron Lane, where the potion shops stand side by side... and only one can be the richest.',
    build(root) {
      const s = sceneRoot(root, 1);
      s.title = caption(root, '<div class="big">Cauldron Lane</div>');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      const k = E.inOut(seg(t, 0, dur - 0.6));
      dusk(R, k);
      look(R, lerp(160, 40, k), lerp(1500, 175, k), lerp(-2600, -260, k), lerp(0, -60, k), lerp(500, 170, k), lerp(2600, 1300, k));
      R.begin(t);
      lane(R, t);
      fig(R, 'wizard', 120, lerp(1500, 900, seg(t, 0, dur)), 205, { walk: t, dir: -1 });
      fig(R, 'farmer', -120, lerp(450, 1050, seg(t, 0, dur)), 185, { walk: t + 0.4 });
      fig(R, 'noble', 150, 1900, 200, { t, dir: -1 });
      R.end();
      s.title.e.style.top = '22%';
      s.title.show(t, dur - 3.8, dur + 1, 'pop');
    },
  });

  const ING = [['🌿', 'Silverleaf'], ['🍄', 'Glowcap'], ['💎', 'Moonstone'], ['💧', 'Starlight dew']];
  const PRICES = [2, 2, 3, 3, 4, 5];
  scenes.push({
    id: 'market', min: 10.5,
    say: 'Buy silverleaf, glowcaps and moonstones at the market. But careful: the more everyone buys, the higher the price climbs.',
    build(root) {
      const s = sceneRoot(root, 2);
      s.tag = word(root, 'chip', '📈 Every buy raises the price');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      dusk(R, 0.4);
      const swap = at(0.42, dur);
      const k = E.inOut(seg(t, 0, swap));
      const pin = E.inOut(seg(t, swap - 0.6, swap + 1.4));
      const [sx, sz] = STALLS[0];
      look(R, lerp(lerp(-560, 520, k), sx + 60, pin), lerp(230, 270, pin), lerp(2100, 2120, pin), lerp(lerp(-480, 420, k), sx, pin), lerp(190, 300, pin), lerp(2800, 2700, pin));
      R.begin(t);
      lane(R, t, { stalls: true, cauldron: false, flies: 0.6 });
      fig(R, 'knight', -330, 2640, 200, { t, dir: -1 });
      fig(R, 'farmer', 300, 2660, 185, { t: t + 1 });
      fig(R, 'wizard', 20, 2900, 205, { t: t + 2 });
      // The four market goods, one over each stall.
      STALLS.forEach(([x, z], i) => {
        const a = at(0.04 + i * 0.09, dur);
        const p = seg(t, a, a + 0.5);
        if (p > 0 && t < swap + 0.4) tag(R, x, 330 + Math.sin(t * 2 + i) * 8, z - 40, `${ING[i][0]} ${ING[i][1]}`, { k: 1.25, pop: p, op: clamp(p * 2) * (1 - seg(t, swap, swap + 0.4)) });
      });
      // Then the silverleaf supply on its price ladder: each buy takes the cheapest leaf.
      const buys = [0.6, 0.72, 0.84].map((f) => at(f, dur));
      const next = buys.filter((b) => t >= b + 0.6).length;
      PRICES.forEach((pr, i) => {
        const p = seg(t, swap + 0.4 + i * 0.12, swap + 0.8 + i * 0.12);
        if (p <= 0) return;
        const b = i < 3 ? seg(t, buys[i], buys[i] + 0.7) : 0;
        if (b >= 1) return;
        const x = sx + (i - 2.5) * 92;
        token(R, x + b * 120, 380 + (1 - E.out(p)) * 60 + E.in(b) * 200, sz - 120 - b * 150, '🌿', { price: pr, op: clamp(p * 2) * (1 - b), glow: i === next ? 0.6 + 0.4 * Math.sin(t * 6) : 0, k: i === next ? 1 + 0.06 * Math.sin(t * 6) : 1 });
        if (i < 3) coinBurst(R, x, 300, sz - 140, t, buys[i] + 0.1, 40 + i, 6);
      });
      R.end();
      pop(s.tag, t, at(0.62, dur), dur + 1, W / 2, 610, -2);
    },
  });

  // ---------------------------------------------------------------- the wilds
  const r1 = rng(23);
  const FOREST = [];
  for (let i = 0; i < 130; i++) {
    const x = (r1() - 0.5) * 6400;
    const z = 300 + r1() * 5200;
    if (z < 2100 && Math.abs(x) < 1350) continue;
    FOREST.push([x, z, r1() < 0.6 ? 'pine' : 'oak', Math.floor(r1() * 9), 0.9 + r1() * 0.6]);
  }
  const ROCKS = Array.from({ length: 16 }, (_, i) => [(r1() - 0.5) * 2600, 500 + r1() * 1500, i % 5]);
  const POND = [-150, 1650];
  const BEASTS = [
    ['griffin', '🪶 Griffin feather', '2 days', -760, 1450],
    ['mermaid', '🐚 Mermaid scale', '2 days', POND[0], POND[1]],
    ['unicorn', '🦄 Unicorn hair', '3 days', 420, 1400],
    ['dragon', '🐉 Dragon scale', '4 days', 980, 1650],
  ];
  const BEAST_AT = [0.2, 0.36, 0.52, 0.7];
  scenes.push({
    id: 'hunt', min: 10,
    say: 'For rarer potions, go hunting. Griffin feathers. Mermaid scales. Unicorn hair. Even dragon scales... if you can spare the days.',
    build(root) {
      const s = sceneRoot(root, 3);
      s.R.env.ground = ['#5c7a40', '#3c5a2c'];
      s.R.env.mountains = { far: '#8d90b8', near: '#5d7a58' };
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      R.env.tod = lerp(2.05, 2.3, seg(t, 0, dur));
      R.env.sunAz = 0.15;
      R.env.tint = '#f6e2d6';
      const k = E.inOut(seg(t, 0.3, dur - 0.5));
      const cx = lerp(-900, 900, k);
      look(R, cx - 100, lerp(330, 230, k), lerp(380, 560, k), cx, 210, 1550);
      R.begin(t);
      R.disc(POND[0], POND[1], 330, 170, '#3d6f9a', '#6d9ac0', 4);
      R.disc(POND[0] + 40, POND[1] - 20, 200, 90, 'rgba(160,210,240,0.35)');
      FOREST.forEach(([x, z, kind, sd, sc]) => R.bill(kind === 'pine' ? pine(sd) : oak(sd, 1), { x, z, h: (kind === 'pine' ? 480 : 420) * sc, shadowW: 0.25, rot: Math.sin(t * 0.8 + x) * 0.8 }));
      ROCKS.forEach(([x, z, sd]) => R.bill(rock(sd), { x, z, h: 70, shadowW: 0.3 }));
      [[-1200, 700], [1300, 650], [-300, 900], [1500, 1100]].forEach(([x, z], i) => R.bill(bush(i + 3), { x, z, h: 90, shadowW: 0.3 }));
      BEASTS.forEach(([n, label, days, x, z], i) => {
        const a = at(BEAST_AT[i], dur);
        const p = seg(t, a - 0.6, a + 0.6);
        if (p <= 0) return;
        const e = E.out(p);
        if (n === 'griffin') {
          const fx = lerp(x - 900, x, e);
          fig(R, n, fx, z, 240, { y: lerp(700, 330, e) + Math.sin(t * 3) * 25, rot: Math.sin(t * 6) * 4, t });
          tag(R, x, 680, z, `${label} · ⏳ ${days}`, { k: 1.4, pop: seg(t, a, a + 0.5), op: clamp(seg(t, a, a + 0.3) * 2) });
        } else if (n === 'mermaid') {
          R.bill(medal('beast-mermaid'), { x, y: lerp(-150, 60, e), z, h: 260, clipY: 0, shadow: false });
          for (let j = 0; j < 8; j++) {
            const q = (seg(t, a - 0.4, a + 1.2) + j / 8) % 1;
            R.blob(x + Math.cos(j * 0.8) * (60 + q * 160), 10 + Math.sin(q * Math.PI) * 120, z - 30, 18 + 10 * (1 - q), '#d8f0ff', 0.6 * (1 - q) * (p < 1 ? 1 : 0.4));
          }
          tag(R, x, 400, z, `${label} · ⏳ ${days}`, { k: 1.4, pop: seg(t, a, a + 0.5), op: clamp(seg(t, a, a + 0.3) * 2) });
        } else if (n === 'unicorn') {
          fig(R, n, lerp(x + 700, x, e), z, 230, { walk: p < 1 ? t * 1.4 : null, t, dir: -1 });
          sparkle(R, x, z, t, '#f3d9ff', p);
          tag(R, x, 340, z, `${label} · ⏳ ${days}`, { k: 1.4, pop: seg(t, a, a + 0.5), op: clamp(seg(t, a, a + 0.3) * 2) });
        } else {
          R.bill(rock(4), { x: x + 10, z: z + 10, h: 120, shadowW: 0.5 });
          fig(R, n, x, z, 250, { y: lerp(400, 95, E.back(p)), t, dir: -1, bias: -5 });
          const fire = seg(t, a + 0.7, a + 1.0) * (1 - seg(t, a + 2.4, a + 2.9));
          for (let j = 0; j < 12; j++) {
            const q = (t * 1.6 + j / 12) % 1;
            R.blob(x - 120 - q * 380, 270 - q * 60 + Math.sin(j) * 20 * q, z - 20, 18 + q * 46, j % 2 ? '#ffb347' : '#ff6a2a', 0.8 * fire * (1 - q));
          }
          R.light(x - 260, 250, z - 20, 420, '#ff8a3a', 0.5 * fire);
          tag(R, x, 560, z, `${label} · ⏳ ${days}`, { k: 1.4, pop: seg(t, a, a + 0.5), op: clamp(seg(t, a, a + 0.3) * 2) });
        }
      });
      R.end();
    },
  });
  function sparkle(R, x, z, t, col, a = 1) {
    for (let j = 0; j < 12; j++) {
      const q = (t * 0.8 + j / 12) % 1;
      R.blob(x + Math.cos(j * 2.4 + t) * 90 * (0.4 + q), 30 + q * 240, z + Math.sin(j * 2.4 + t) * 40, 6 + 5 * (1 - q), col, a * (1 - q));
    }
  }

  scenes.push({
    id: 'brew', min: 10.5,
    say: 'Back in your shop, brew them into potions. Learn a rare recipe, and you will be the only shop on the lane that can make it.',
    build(root) {
      const s = sceneRoot(root, 4);
      s.only = word(root, 'chip good', '📜 Only you know this recipe');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      dusk(R, 0.7);
      const k = E.inOut(seg(t, 0, dur));
      const [cx, cz] = CAUL;
      look(R, lerp(-60, -200, k), lerp(230, 175, k), lerp(240, 400, k), cx, 120, cz);
      R.begin(t);
      lane(R, t, { cauldron: false, flies: 0.7 });
      const done = at(0.42, dur);
      const boil = seg(t, done, done + 0.2) * (1 - seg(t, done + 0.3, done + 1.2));
      R.bill(A('full-cauldron'), { x: cx, z: cz, h: 150, shadowW: 0.45, flash: 0.6 * boil, flashColor: '#d8ffc0', sy: 1 + 0.06 * boil * Math.sin(t * 40) });
      steam(R, t, cx, cz + 5, '#a8ff8a', 1 + 1.5 * boil);
      // Three ingredients tumble in from around the shop.
      [['🦄', -700, 460, 560], ['🌿', -330, 560, 900], ['💧', 20, 440, 600]].forEach(([ic, x0, y0, z0], i) => {
        const a = at(0.06 + i * 0.1, dur);
        const p = seg(t, a, a + 1.1);
        if (p <= 0 || p >= 1) return;
        const e = E.inOut(p);
        token(R, lerp(x0, cx, e), lerp(y0, 150, e) + Math.sin(p * Math.PI) * 140, lerp(z0, cz, e), ic, { k: lerp(1, 0.5, p), bias: 50 });
      });
      for (let j = 0; j < 14; j++) {
        const q = seg(t, done, done + 1.2);
        if (q <= 0 || q >= 1) break;
        const ang = (j / 14) * TAU;
        R.blob(cx + Math.cos(ang) * q * 220, 170 + Math.sin(ang) * q * 160 + q * 60, cz - 20, 20, j % 2 ? '#c8ff9a' : '#ffffff', 0.9 * (1 - q), 40);
      }
      // The finished potion rises out and hangs beside the cauldron.
      const up = seg(t, done + 0.1, done + 1.0);
      if (up > 0) {
        const px = lerp(cx, cx + 150, E.out(up));
        const py = lerp(120, 250, E.out(up)) + Math.sin(t * 2) * 8;
        R.bill(potion('#e6dcff'), { x: px, y: py, z: cz - 70, h: lerp(40, 130, E.back(up)), shadow: false, rot: Math.sin(t * 1.5) * 5, bias: 60 });
        R.light(px, py + 60, cz - 70, 200, '#e9dcff', 0.5);
        sparkle(R, px, cz - 70, t, '#ffffff', up);
        tag(R, px, py + 175, cz - 70, 'Unicorn Remedy ★★', { k: 1.15, pop: seg(t, done + 0.6, done + 1.1), op: clamp(seg(t, done + 0.6, done + 0.9) * 3), bias: 90 });
      }
      R.end();
      s.flash.style.opacity = 0.5 * seg(t, done, done + 0.1) * (1 - seg(t, done + 0.1, done + 0.7));
      pop(s.only, t, at(0.66, dur), dur + 1, W / 2, 640, 2);
    },
  });

  const FOLK = [['knight', 'Sir Roland', '🛡️ Protection', 200, -430, 520, '+🪙19'], ['farmer', 'Farmer Bess', '❤️ Healing', 185, -230, 590, '+🪙11'], ['noble', 'Lady Vane', '✨ Charm', 205, -40, 650, '+🪙30']];
  const FOLK_AT = [0.3, 0.55, 0.78];
  scenes.push({
    id: 'customers', min: 10.5,
    say: 'Then sell to the townsfolk who ring your doorbell. Knights want protection, farmers want healing, and the baroness wants a little charm.',
    build(root) {
      const s = sceneRoot(root, 5);
      s.bell = word(root, 'chip', '🔔 Ding-a-ling!');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      dusk(R, 0.9);
      const k = E.inOut(seg(t, 0, dur));
      look(R, lerp(300, 200, k), lerp(240, 210, k), lerp(-40, 40, k), lerp(-260, -300, k), 160, 780);
      R.begin(t);
      lane(R, t, { glowShop: [HOME[0], HOME[1], 0.25 * Math.max(0, Math.sin(t * 9)) * (1 - seg(t, 0.3, 2.2))] });
      FOLK.forEach(([n, name, need, h, x, z, pay], i) => {
        const a = at(FOLK_AT[i], dur);
        const p = seg(t, a - 2.2, a);
        if (p <= 0) return;
        const e = E.out(p);
        fig(R, n, lerp(-60, x, e), lerp(2400, z, e), h, { walk: p < 1 ? t + i : null, t, dir: x < -100 ? 1 : -1 });
        const ask = seg(t, a - 0.1, a + 0.4);
        if (ask > 0) tag(R, lerp(-60, x, e), h + 70, z, need, { k: 1.1, pop: ask, op: clamp(ask * 3) });
        tag(R, x, -26, z - 10, name, { k: 0.85, op: clamp(seg(t, a, a + 0.3) * 2), bg: 'rgba(40,16,58,0.85)', fg: '#fff6e2' });
        coinBurst(R, x, 120, z - 30, t, a + 0.9, 10 + i);
        const paid = seg(t, a + 0.9, a + 1.3);
        if (paid > 0) tag(R, x + 70, h + 150 + paid * 20, z - 20, pay, { k: 1.25, pop: paid, bg: '#ffd24d', fg: '#4a2a00', bias: 100 });
      });
      R.end();
      pop(s.bell, t, 0.3, at(0.26, dur), W / 2, 110, -3);
    },
  });

  scenes.push({
    id: 'rivals', min: 10,
    say: 'Short on stock? Buy from the shop next door. But every potion a rival buys from you puts coins in your pocket.',
    build(root) {
      const s = sceneRoot(root, 6);
      s.gain = word(root, 'chip good', '🪙 +19 for you!');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      dusk(R, 1);
      const k = E.inOut(seg(t, 0, dur));
      const midZ = (HOME[1] + NEXT[1]) / 2;
      look(R, lerp(250, 190, k), lerp(300, 250, k), midZ + lerp(-140, 60, k), -560, 250, midZ);
      R.begin(t);
      lane(R, t, { cauldron: false });
      const a1 = at(0.12, dur);
      const a2 = at(0.62, dur);
      const p1 = seg(t, a1, a1 + 1.3);
      const p2 = seg(t, a2, a2 + 1.3);
      const mine = 42 - (p1 >= 1 ? 19 : 0) + (p2 >= 1 ? 19 : 0);
      const theirs = 35 + (p1 >= 1 ? 19 : 0) - (p2 >= 1 ? 19 : 0);
      const lit = (a) => seg(t, a + 1.3, a + 1.4) * (1 - seg(t, a + 1.6, a + 2.4));
      tag(R, HOME[0] + 40, 500, HOME[1], `🏠 Your shop  🪙${mine}`, { k: 1.2, ring: '#8ff07a', op: seg(t, 0.2, 0.7), bias: 200 });
      tag(R, NEXT[0] + 40, 500, NEXT[1], `🏚️ Next door  🪙${theirs}`, { k: 1.2, ring: '#ff8a6b', op: seg(t, 0.2, 0.7), bias: 200 });
      // A potion one way, its price the other.
      [[p1, NEXT, HOME, '#e0464b'], [p2, HOME, NEXT, '#2aa8c9']].forEach(([p, from, to, col], i) => {
        if (p <= 0 || p >= 1) return;
        const e = E.inOut(p);
        const x = -330;
        R.bill(potion(col), { x, y: 160 + Math.sin(e * Math.PI) * 260, z: lerp(from[1], to[1], e), h: 120, shadow: false, rot: (to[1] > from[1] ? 1 : -1) * e * 25, bias: 60 });
        for (let j = 0; j < 6; j++) {
          const q = clamp(p * 1.4 - j * 0.08);
          if (q <= 0 || q >= 1) continue;
          coinAt(R, x - 40, 90 + Math.sin(q * Math.PI) * 180, lerp(to[1], from[1], q), 16, t * 8 + j + i);
        }
      });
      R.light(HOME[0] + 60, 250, HOME[1], 360, '#ffd24d', 0.5 * lit(a2));
      R.end();
      pop(s.gain, t, a2 + 1.3, dur + 1, W * 0.3, 620, -3);
    },
  });

  const PAWNS = ['#8ff07a', '#ff8a6b', '#6bb8ff', '#e9a7ff'];
  const MARKETS = [4, 8, 12, 16, 20, 24];
  const STONE = (d) => [Math.sin(d * 0.55) * 110, 300 + d * 150];
  function pawn(R, x, y, z, col, glow) {
    R.at(x, y, z, (g, p) => {
      const s = p.s;
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath();
      g.ellipse(p.x, p.y + (y > 0 ? y * s : 0), 26 * s, 9 * s, 0, 0, TAU);
      g.fill();
      if (glow) {
        g.shadowColor = '#fff6c0';
        g.shadowBlur = 30 * s;
      }
      g.fillStyle = col;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 4 * s;
      g.beginPath();
      g.moveTo(p.x - 26 * s, p.y);
      g.quadraticCurveTo(p.x - 20 * s, p.y - 50 * s, p.x - 8 * s, p.y - 58 * s);
      g.lineTo(p.x + 8 * s, p.y - 58 * s);
      g.quadraticCurveTo(p.x + 20 * s, p.y - 50 * s, p.x + 26 * s, p.y);
      g.closePath();
      g.fill();
      g.stroke();
      g.beginPath();
      g.arc(p.x, p.y - 70 * s, 16 * s, 0, TAU);
      g.fill();
      g.stroke();
    });
  }
  scenes.push({
    id: 'days', min: 10,
    say: 'Every action costs days, and whoever is furthest behind always goes next. Plan carefully... the Moon Fair will not wait.',
    build(root) {
      const s = sceneRoot(root, 7);
      s.tag = word(root, 'chip', '📅 28 days to the Moon Fair');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      night(R, 0.02);
      R.env.fogMax = 0.35;
      // Whoever is furthest behind moves next, so the pawns leapfrog each other.
      const pos = [0, 0, 0, 0];
      const cost = [2, 1, 1, 2, 2, 1, 4, 1, 2, 2, 1, 3, 2, 2, 1, 2, 3, 1, 2, 2];
      const step = (dur - 2.4) / cost.length;
      let hop = -1;
      let hp = 0;
      cost.forEach((c, i) => {
        const a = 1.2 + i * step;
        if (t < a) return;
        const who = pos.indexOf(Math.min(...pos));
        const p = seg(t, a, a + step * 0.8);
        if (p < 1) {
          hop = who;
          hp = p;
          pos[who] += c * E.inOut(p);
        } else pos[who] += c;
      });
      const avg = pos.reduce((a, b) => a + b, 0) / 4;
      const [fx, fz] = STONE(avg);
      look(R, fx * 0.4 + 260, 330, fz - 560, fx * 0.3, 60, fz + 520);
      R.begin(t);
      lane(R, t, { cauldron: false, lit: 1.4 });
      for (let d = 1; d <= 28; d++) {
        const [x, z] = STONE(d);
        const moon = d === 28;
        const mk = MARKETS.includes(d);
        R.disc(x, z, moon ? 80 : 50, moon ? 56 : 34, moon ? '#f4e2a0' : mk ? '#d6b05a' : '#b7a68f', moon ? '#fff4c8' : '#5d4c40', 3, 1);
        tag(R, x, moon ? 150 : mk ? 70 : 30, z, moon ? '🌕 Moon Fair' : mk ? `🛒 ${d}` : String(d), { k: moon ? 1.4 : mk ? 0.85 : 0.7, bias: 10, bg: moon ? '#ffe9a0' : mk ? 'rgba(255,233,160,0.95)' : 'rgba(40,16,58,0.8)', fg: moon ? '#4a2a00' : mk ? '#4a2a00' : '#fff6e2' });
        if (moon) R.light(x, 60, z, 300, '#fff1b0', 0.5);
      }
      pos.forEach((d, i) => {
        const [x, z] = STONE(d);
        const lift = hop === i ? Math.sin(hp * Math.PI) * 70 : 0;
        pawn(R, x + (i % 2 ? 22 : -22), lift, z + (i < 2 ? -14 : 14), PAWNS[i], hop === i);
        if (hop === i) R.light(x, 60 + lift, z, 160, PAWNS[i], 0.45);
      });
      R.end();
      pop(s.tag, t, 0.3, dur + 1, W / 2, 96, -2);
    },
  });

  const BURSTS = Array.from({ length: 7 }, (_, i) => [(r0() - 0.5) * 2400, 1100 + r0() * 700, 4300 + r0() * 900, 0.4 + i * 1.05, ['#ffd24d', '#8ff07a', '#ff8fd0', '#9fd8ff', '#ffb347'][i % 5]]);
  scenes.push({
    id: 'fair', min: 8,
    say: 'And when the Moon Fair arrives, the richest shop on the lane wins.',
    build(root) {
      const s = sceneRoot(root, 8);
      s.win = word(root, 'chip', '🏆 The richest shop wins!');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      night(R, 0.08);
      const k = E.inOut(seg(t, 0, dur));
      const [px, pz] = PLAZA;
      look(R, lerp(-200, 120, k), lerp(150, 330, k), pz - lerp(1400, 1000, k), px, lerp(260, 300, k), pz + 200);
      R.begin(t);
      lane(R, t, { cauldron: false, lit: 1.5 });
      // Lanterns ring the plaza for the fair.
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        lantern(R, px + Math.cos(a) * 650, pz + 200 + Math.sin(a) * 420, 1.3);
      }
      const h = 140;
      R.at(px, 0, pz + 200, (g, p) => {
        const s2 = p.s;
        g.fillStyle = '#5d3c7a';
        g.beginPath();
        g.ellipse(p.x, p.y - h * s2, 120 * s2, 30 * s2, 0, 0, TAU);
        g.fill();
        g.fillRect(p.x - 120 * s2, p.y - h * s2, 240 * s2, h * s2);
        g.fillStyle = '#7a52a0';
        g.beginPath();
        g.ellipse(p.x, p.y - h * s2, 120 * s2, 30 * s2, 0, 0, TAU);
        g.fill();
        g.strokeStyle = '#f2c14e';
        g.lineWidth = 5 * s2;
        g.stroke();
      }, -20);
      const gleam = seg(t, at(0.5, dur), at(0.5, dur) + 0.5);
      R.bill(A('full-trophy'), { x: px, y: h, z: pz + 200, h: 240, shadow: false, flash: 0.5 * gleam * (1 - seg(t, at(0.5, dur) + 0.5, at(0.5, dur) + 1.4)), flashColor: '#fff6c0', bias: 30 });
      R.light(px, h + 140, pz + 200, 460, '#ffd24d', 0.35 + 0.35 * gleam);
      // The phoenix circles the fair, trailing sparks.
      const pa = t * 0.7;
      const phx = px + Math.cos(pa) * 800;
      const phz = pz + 300 + Math.sin(pa) * 450;
      fig(R, 'phoenix', phx, phz, 210, { y: 640 + Math.sin(t * 2) * 40, rot: Math.sin(t * 5) * 5, dir: Math.sin(pa) > 0 ? 1 : -1, t });
      for (let j = 0; j < 10; j++) {
        const b = pa - (j + 1) * 0.06;
        R.blob(px + Math.cos(b) * 800, 720 + Math.sin(t * 2) * 40, pz + 300 + Math.sin(b) * 450, 30 - j * 2, j % 2 ? '#ffb347' : '#ff6a2a', 0.6 * (1 - j / 10));
      }
      R.light(phx, 730, phz, 300, '#ff9a3a', 0.35);
      // Fireworks over the far hills.
      BURSTS.forEach(([bx, by, bz, a, col]) => {
        const q = seg(t, a, a + 1.6);
        if (q <= 0 || q >= 1) return;
        for (let j = 0; j < 18; j++) {
          const ang = (j / 18) * TAU;
          R.blob(bx + Math.cos(ang) * 420 * E.out(q), by + Math.sin(ang) * 420 * E.out(q) - 160 * q * q, bz, 34, col, 0.9 * (1 - q), -9000);
        }
        R.light(bx, by, bz, 900, col, 0.35 * (1 - q));
      });
      // Gold rains on the winner.
      const rain = seg(t, at(0.55, dur), at(0.55, dur) + 0.6);
      if (rain > 0) {
        const r = rng(91);
        for (let i = 0; i < 50; i++) {
          const x = px + (r() - 0.5) * 1100;
          const z = pz + (r() - 0.5) * 500;
          const sp = 260 + r() * 260;
          const y = 900 - ((t * sp + r() * 900) % 900);
          coinAt(R, x, y, z, 14, t * 6 + i, 0.95 * rain);
        }
      }
      R.end();
      pop(s.win, t, at(0.6, dur), dur + 1, W / 2, 620, -2);
    },
  });

  scenes.push({
    id: 'end', min: 8, tail: 2.4,
    say: 'Cauldron Lane. Coming soon, to Ahrens Labs.',
    build(root) {
      const s = sceneRoot(root, 9);
      s.title = caption(root, '<div class="big">Cauldron Lane</div><div class="sub">A potion-shop board game</div><div class="pill">Coming soon to ahrenslabs.com</div>');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      dusk(R, 0.8);
      const a = t * 0.05 - 0.35;
      look(R, Math.sin(a) * 1500, 650, 1200 - Math.cos(a) * 1500, 0, 140, 1200);
      R.begin(t);
      lane(R, t);
      fig(R, 'wizard', 120, 1100, 205, { t });
      fig(R, 'knight', -140, 1500, 200, { t });
      R.end();
      R.cv.style.filter = 'blur(2px) brightness(0.72)';
      s.title.show(t, 0.3, dur + 2);
    },
  });

  runAd(scenes);
})();
