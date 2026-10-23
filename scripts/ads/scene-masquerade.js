// The Masquerade Court ad: a carnival-night movie trailer in a 3D Venetian piazza, from a gondola on the lagoon
// up to the Doge's palace, with full-body cut-outs of the game's masked nobles and the mask cards themselves
// flipping, flying and tearing away in the scene.
(function () {
  const { W, H, clamp, lerp, seg, E, rng, el, img, caption, runAd } = AD;
  const { world, prop } = AD3;
  const M = (n) => `sprites/mq/${n}.png`;
  const ART = (k) => `/img/masquerade/${k}.webp`;
  const TAU = Math.PI * 2;
  const MASKS = {
    doge: ['The Doge', '#b8282e'], duchess: ['The Duchess', '#d9668f'], jester: ['The Jester', '#7a3fb0'], poisoner: ['The Poisoner', '#1f7a4a'],
    doctor: ['The Plague Doctor', '#1f6f78'], gondolier: ['The Gondolier', '#2a4fa0'], spy: ['The Spy', '#4a5263'],
  };
  const ORDER = Object.keys(MASKS);
  const TALL = { doge: 190, duchess: 205, jester: 200, poisoner: 205, doctor: 215, gondolier: 200, spy: 188, dancer: 200 };

  const style = el('style', '', document.head);
  style.textContent = `
    .title .big { font-size: 100px; -webkit-text-stroke: 3px rgba(74, 13, 29, 0.7); text-shadow: 0 6px 0 rgba(74, 13, 29, 0.95), 0 14px 34px rgba(0, 0, 0, 0.6), 0 0 40px rgba(255, 190, 90, 0.4); }
    .title .mid { text-shadow: 0 5px 0 rgba(74, 13, 29, 0.9), 0 12px 26px rgba(0, 0, 0, 0.55); }
    .title .pill { background: #ffd24d; color: #4a0d1d; }
    .pow { position: absolute; left: 0; top: 0; z-index: 8700; white-space: nowrap; transform-origin: 50% 50%;
      font: 96px/1 "Lilita One", sans-serif; color: #ffd24d; -webkit-text-stroke: 3px #4a0d1d; letter-spacing: 0.02em;
      text-shadow: 0 6px 0 #4a0d1d, 0 14px 30px rgba(0, 0, 0, 0.55), 0 0 50px rgba(255, 190, 90, 0.5); }
    .chip { position: absolute; left: 0; top: 0; z-index: 8700; white-space: nowrap; padding: 12px 26px; border-radius: 18px; transform-origin: 50% 50%;
      background: rgba(58, 10, 24, 0.88); color: #fff6e2; font: 38px/1 "Lilita One", sans-serif; box-shadow: 0 0 0 3px rgba(255, 210, 77, 0.85), 0 12px 30px rgba(0, 0, 0, 0.5); }
    .chip.good { box-shadow: 0 0 0 3px #6fe08f, 0 12px 30px rgba(0, 0, 0, 0.5); }
    .chip.bad { box-shadow: 0 0 0 3px #ff6b5e, 0 12px 30px rgba(0, 0, 0, 0.5); }
    .bubble { position: absolute; left: 0; top: 0; z-index: 8600; padding: 16px 26px; border-radius: 26px; background: rgba(255, 248, 232, 0.97); color: #4a0d1d;
      font: 600 34px/1.2 Fredoka, sans-serif; white-space: nowrap; box-shadow: 0 14px 34px rgba(0, 0, 0, 0.5); transform-origin: 0% 100%; }
    .bubble b { font-family: "Lilita One", sans-serif; font-weight: 400; }
    .bubble::after { content: ""; position: absolute; left: 34px; bottom: -22px; border: 14px solid transparent; border-top: 24px solid rgba(255, 248, 232, 0.97); }
    .letter { position: absolute; left: 0; top: 0; z-index: 8600; width: 520px; height: 330px; transform-origin: 50% 50%; border-radius: 12px;
      background: linear-gradient(160deg, #fbf0d6, #ead3a0); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55), inset 0 0 0 4px #c9a45c, 0 0 80px rgba(255, 200, 110, 0.35);
      color: #4a0d1d; text-align: center; overflow: hidden; }
    .letter .seal { position: absolute; left: 50%; top: 50%; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #e0484f, #8a1420); box-shadow: 0 6px 14px rgba(0, 0, 0, 0.4); display: grid; place-items: center; font-size: 56px; }
    .letter .txt { position: absolute; inset: 40px 30px; display: flex; flex-direction: column; justify-content: center; gap: 12px; }
    .letter .txt b { font: 44px/1.1 "Lilita One", sans-serif; font-weight: 400; }
    .letter .txt span { font: 600 30px/1.3 Fredoka, sans-serif; }
    .letter .txt em { font: 40px/1 "Lilita One", sans-serif; font-style: normal; color: #a06a10; }
    .letter .stamp { position: absolute; right: 18px; top: 16px; padding: 6px 14px; border: 4px solid #c0262d; border-radius: 10px; color: #c0262d;
      font: 26px/1 "Lilita One", sans-serif; transform: rotate(10deg); letter-spacing: 0.05em; }`;

  // ---------------------------------------------------------------- the cards
  // A mask card drawn from the game's art once that art has loaded: gold frame, art, a burgundy name banner.
  const CARDS = {};
  function cardProp(k) {
    if (CARDS[k]) return CARDS[k];
    const im = img(ART(k));
    const c = document.createElement('canvas');
    c.width = 360;
    c.height = 504;
    const g = c.getContext('2d');
    const gold = g.createLinearGradient(0, 0, 360, 504);
    gold.addColorStop(0, '#fff0b0');
    gold.addColorStop(0.45, '#e8c068');
    gold.addColorStop(1, '#a5741b');
    g.fillStyle = gold;
    g.beginPath();
    g.roundRect(0, 0, 360, 504, 30);
    g.fill();
    g.fillStyle = '#5a1324';
    g.beginPath();
    g.roundRect(12, 12, 336, 480, 22);
    g.fill();
    const ok = im.complete && im.naturalWidth;
    if (ok) {
      g.save();
      g.beginPath();
      g.roundRect(22, 22, 316, 340, 16);
      g.clip();
      const s = Math.max(316 / im.naturalWidth, 340 / im.naturalHeight);
      g.drawImage(im, 180 - (im.naturalWidth * s) / 2, 192 - (im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s);
      g.restore();
    }
    if (k !== 'back') {
      const band = g.createLinearGradient(0, 372, 0, 480);
      band.addColorStop(0, '#7e1f34');
      band.addColorStop(1, '#3a0b16');
      g.fillStyle = band;
      g.beginPath();
      g.roundRect(22, 372, 316, 108, 14);
      g.fill();
      const name = MASKS[k][0];
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      let fs = 46;
      g.font = `${fs}px "Lilita One"`;
      while (g.measureText(name).width > 290 && fs > 20) g.font = `${(fs -= 2)}px "Lilita One"`;
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillText(name, 180, 430);
      g.fillStyle = '#ffe9a8';
      g.fillText(name, 180, 426);
    }
    if (ok && document.fonts.check('44px "Lilita One"')) CARDS[k] = c;
    return c;
  }
  const back = () => {
    if (CARDS.back) return CARDS.back;
    const im = img(ART('back'));
    const c = document.createElement('canvas');
    c.width = 360;
    c.height = 504;
    const g = c.getContext('2d');
    g.fillStyle = '#e8c068';
    g.beginPath();
    g.roundRect(0, 0, 360, 504, 30);
    g.fill();
    if (im.complete && im.naturalWidth) {
      g.save();
      g.beginPath();
      g.roundRect(10, 10, 340, 484, 22);
      g.clip();
      g.drawImage(im, -72, 10, 504, 484);
      g.restore();
      CARDS.back = c;
    }
    return c;
  };
  // A card standing in the world. `flip` 0 is face down, 1 face up; it turns edge-on through the middle.
  function card(R, k, x, y, z, o = {}) {
    const f = o.flip == null ? 1 : o.flip;
    const sq = Math.max(0.02, Math.abs(Math.cos(f * Math.PI)));
    R.bill(f < 0.5 ? back() : cardProp(k), {
      x, y, z, h: o.h || 150, sx: sq * (o.sx || 1), rot: o.rot || 0, op: o.op, shadow: false, bias: o.bias == null ? 30 : o.bias,
      flash: o.flash, flashColor: o.flashColor,
    });
    if (o.glow) R.light(x, y + (o.h || 150) / 2, z - 10, (o.h || 150) * 1.1, '#ffd27a', 0.55 * o.glow);
  }

  // ---------------------------------------------------------------- the piazza
  const QUAY = -160;
  const PALAZZI = [];
  [-1, 1].forEach((side) => [80, 600, 1120, 1640, 2160].forEach((z, i) => PALAZZI.push([side * 1290, z, (i + (side > 0 ? 1 : 0)) % 2 ? 'gold' : 'pink'])));
  const BACKROW = [[-860, 3050, 'gold'], [860, 3050, 'pink'], [-1500, 3150, 'pink'], [1500, 3150, 'gold']];
  const LAMPS = [];
  [260, 980, 1700, 2400].forEach((z) => LAMPS.push([-640, z], [640, z]));
  const POLES = [[-980, -380], [-820, -420], [760, -400], [930, -360]];
  const STANDS = [[-420, 1500], [430, 1900], [-300, 2500]];
  const BUNTING = [420, 1300, 2050];
  const r0 = rng(41);
  const GUESTS = Array.from({ length: 16 }, (_, i) => [(r0() - 0.5) * 1700, 1300 + r0() * 1500, r0() < 0.5 ? 1 : -1, 0.85 + r0() * 0.25, r0() * TAU, i]);
  const SHIMMER = Array.from({ length: 140 }, () => [(r0() - 0.5) * 5200, -3600 + r0() * 3400, r0() * TAU, 0.6 + r0()]);
  const FLAGS = ['#ffd24d', '#ff6b9a', '#6bc5ff', '#8ee06b', '#c79bff', '#ff9f43'];

  function look(R, x, y, z, tx, ty, tz) {
    Object.assign(R.cam, { x, y, z });
    const dx = tx - x;
    const dz = tz - z;
    R.cam.yaw = Math.atan2(dx, dz);
    R.cam.pitch = Math.atan2(y - ty, Math.hypot(dx, dz));
  }

  function lagoon(R, t) {
    R.decal([[-6000, -9000], [6000, -9000], [6000, QUAY], [-6000, QUAY]], '#2f5f8f');
    R.decal([[-6000, -1400], [6000, -1400], [6000, QUAY], [-6000, QUAY]], 'rgba(90,150,200,0.35)');
    SHIMMER.forEach(([x, z, ph, sp]) => {
      const a = 0.25 + 0.25 * Math.sin(t * 2.2 * sp + ph);
      R.at(x + Math.sin(t * 0.5 + ph) * 30, 0, z, (g, p) => {
        const w = 34 * p.s;
        if (w < 0.5) return;
        g.globalAlpha = a;
        g.fillStyle = '#ffe2a8';
        g.fillRect(p.x - w / 2, p.y, w, Math.max(1, 3 * p.s));
      }, -4000);
    });
    R.decal([[-6000, QUAY - 40], [6000, QUAY - 40], [6000, QUAY + 30], [-6000, QUAY + 30]], '#e2d3b2', '#a8977a', 2);
  }
  // Big white marble bands across the warm stone, like the paving of St Mark's.
  function paving(R) {
    for (let x = -1200; x <= 1200; x += 300) R.decal([[x - 10, QUAY + 30], [x + 10, QUAY + 30], [x + 10, 3200], [x - 10, 3200]], 'rgba(255,246,226,0.45)');
    for (let z = 200; z < 3200; z += 360) R.decal([[-1300, z - 10], [1300, z - 10], [1300, z + 10], [-1300, z + 10]], 'rgba(255,246,226,0.45)');
  }
  function bunting(R, z, t) {
    const n = 26;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = lerp(-1180, 1180, u);
      const y = 640 - Math.sin(u * Math.PI) * 140 + Math.sin(t * 1.4 + u * 6) * 4;
      pts.push([x, y, z]);
    }
    const mid = R.project(0, 520, z);
    if (!mid) return;
    R.add(mid.d, () => {
      const g = R.g;
      const P = pts.map(([x, y, zz]) => R.project(x, y, zz));
      g.strokeStyle = 'rgba(70,40,30,0.8)';
      g.lineWidth = Math.max(1, 2 * mid.s);
      g.beginPath();
      P.forEach((p, i) => p && (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.stroke();
      for (let i = 0; i < n; i++) {
        const a = P[i];
        const b = P[i + 1];
        if (!a || !b) continue;
        const s = (a.s + b.s) / 2;
        g.fillStyle = FLAGS[i % FLAGS.length];
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.lineTo((a.x + b.x) / 2 + Math.sin(t * 3 + i) * 3 * s, (a.y + b.y) / 2 + 52 * s);
        g.closePath();
        g.fill();
      }
    });
  }
  function lamp(R, x, z, glow = 1) {
    R.bill(M('full-lamp'), { x, z, h: 330, shadowW: 0.2 });
    R.light(x, 300, z - 10, 190, '#ffc66b', 0.32 * glow);
  }
  function piazza(R, t, o = {}) {
    const glow = o.glow == null ? 1 : o.glow;
    lagoon(R, t);
    paving(R);
    R.bill(M('full-palace'), { x: 0, z: 3000, h: 980, shadow: false, bias: -200 });
    R.light(0, 160, 2900, 520, '#ffbe5c', 0.22 * glow);
    R.bill(M('full-campanile'), { x: 1000, z: 2650, h: 2000, shadow: false, bias: -200 });
    BACKROW.forEach(([x, z, c]) => R.bill(M('full-palazzo-' + c), { x, z, h: 900, shadow: false, bias: -200 }));
    PALAZZI.forEach(([x, z, c]) => {
      R.bill(M('full-palazzo-' + c), { x, z, h: 920, shadow: false, bias: -60 });
      R.light(x + (x < 0 ? 120 : -120), 300, z - 30, 260, '#ffbe5c', 0.12 * glow);
    });
    LAMPS.forEach(([x, z]) => z >= (o.nearZ || -1e9) && lamp(R, x, z, glow));
    POLES.forEach(([x, z], i) => R.bill(M('full-pole'), { x, z, h: 380, shadow: false, rot: Math.sin(t * 0.8 + i) * 1.2 }));
    if (o.stands !== false) STANDS.filter(([, z]) => z >= (o.nearZ || -1e9)).forEach(([x, z], i) => R.bill(M('full-maskstand'), { x, z, h: 250, shadowW: 0.2, rot: Math.sin(t * 1.1 + i) * 1.5 }));
    BUNTING.forEach((z) => bunting(R, z, t));
    if (o.guests !== false) {
      GUESTS.forEach(([x, z, dir, sc, ph]) => {
        // Pairs of guests turn slowly round each other, dancing.
        const sway = Math.sin(t * 1.2 + ph);
        R.bill(M('full-dancer'), { x: x + sway * 30, z, h: 200 * sc, dir, rot: sway * 3, lift: Math.abs(Math.sin(t * 2.4 + ph)) * 6, shadowW: 0.3 });
      });
    }
    if (o.gondola !== false) gondola(R, t, o.gx == null ? lerp(-1400, 1400, ((t * 0.03) % 1)) : o.gx, o.gz || -900);
  }
  function gondola(R, t, x, z, dir = 1) {
    const bob = Math.sin(t * 1.6) * 5;
    R.bill(M('full-gondola'), { x, y: bob, z, h: 170, dir, shadow: false, clipY: -2, rot: Math.sin(t * 1.3) * 1.2 });
    R.bill(M('full-gondolier'), { x: x - dir * 120, y: 48 + bob, z: z - 5, h: TALL.gondolier, shadow: false, bias: 6, rot: Math.sin(t * 1.3) * 2 });
    for (let j = 0; j < 6; j++) {
      const q = (t * 0.5 + j / 6) % 1;
      R.blob(x - dir * (230 + q * 260), 0, z + (j % 2 ? 30 : -30), 22 + q * 40, '#cfe6ff', 0.3 * (1 - q), -10);
    }
  }
  // A firework bursting high over the city, as a pure function of time.
  function firework(R, x, y, z, t, a, col, k = 1) {
    const p = seg(t, a, a + 1.8);
    if (p <= 0 || p >= 1) return;
    const rise = seg(t, a - 0.6, a);
    const c = R.project(x, y, z);
    if (!c) return;
    R.add(30000, () => {
      const g = R.g;
      g.globalCompositeOperation = 'lighter';
      if (rise < 1) return;
      const n = 28;
      const r = 900 * c.s * E.out(p) * k;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU;
        const px = c.x + Math.cos(ang) * r;
        const py = c.y + Math.sin(ang) * r + p * p * 120 * c.s * 6;
        const rr = Math.max(1.5, 7 * c.s * 4 * (1 - p));
        g.globalAlpha = (1 - p) * 0.95;
        g.fillStyle = col;
        g.beginPath();
        g.arc(px, py, rr, 0, TAU);
        g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(px, py, rr * 0.45, 0, TAU);
        g.fill();
      }
    });
    if (rise > 0 && rise < 1) {
      const s = R.project(x, lerp(400, y, E.out(rise)), z);
      if (s) R.add(30000, () => {
        const g = R.g;
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = '#fff1c4';
        g.beginPath();
        g.arc(s.x, s.y, 3, 0, TAU);
        g.fill();
      });
    }
  }
  const SHOW = [[-1600, 2600, 7000, '#ffd24d'], [1400, 3000, 7400, '#ff6b9a'], [200, 3300, 7800, '#6bc5ff'], [-500, 2400, 6800, '#8ee06b'], [1900, 2700, 7200, '#c79bff']];
  function fireworks(R, t, from = 0, rate = 1) {
    if (t < from) return;
    SHOW.forEach(([x, y, z, col], i) => {
      const per = 2.6 / rate;
      const ph = (i * 0.53 * per) % per;
      const cyc = Math.floor((t - from - ph) / per);
      if (t - from < ph) return;
      firework(R, x + (cyc % 3) * 400, y, z, t, from + ph + cyc * per + 0.6, col);
    });
  }
  // Confetti drifting down around the camera.
  function confetti(R, t, n = 120, amt = 1, seed = 9) {
    const r = rng(seed);
    const { cam } = R;
    for (let i = 0; i < n * amt; i++) {
      const u = r();
      const v = r();
      const w = r();
      const ph = r();
      const depth = 220 + w * 1400;
      const span = depth * 1.6;
      const yTop = cam.y + depth * 0.7;
      const yBot = cam.y - depth * 0.6;
      const range = yTop - yBot;
      const y = yTop - ((v * range + t * 60) % range + range) % range;
      const lx = ((u * span + Math.sin(t + ph * 9) * 30) % span + span) % span - span / 2;
      const x = cam.x + lx * Math.cos(cam.yaw) + depth * Math.sin(cam.yaw);
      const z = cam.z + depth * Math.cos(cam.yaw) - lx * Math.sin(cam.yaw);
      R.at(x, y, z, (g, p) => {
        const k = Math.min(p.s, 1.6);
        g.translate(p.x, p.y);
        g.rotate(t * 3 + ph * 10);
        g.scale(Math.abs(Math.cos(t * 4 + ph * 7)) + 0.2, 1);
        g.fillStyle = FLAGS[i % FLAGS.length];
        g.fillRect(-6 * k, -3 * k, 12 * k, 6 * k);
      });
    }
  }

  function noble(R, n, x, z, o = {}) {
    const t = o.t || 0;
    R.bill(M('full-' + n), {
      x, y: o.y || 0, z, h: o.h || TALL[n], dir: o.dir || 1, lift: (o.lift || 0) + (o.walk != null ? Math.abs(Math.sin(o.walk * 7)) * 8 : 0),
      rot: (o.rot || 0) + (o.walk != null ? Math.sin(o.walk * 7) * 3 : Math.sin(t * 1.3 + x) * 0.8), sy: 1 + 0.015 * Math.sin(t * 2.2 + x),
      op: o.op, flash: o.flash, flashColor: o.flashColor, bias: o.bias, shadowW: 0.3, shadow: o.y ? false : undefined,
    });
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
      g.fillStyle = o.fg || '#4a0d1d';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, p.x, p.y + 1.5 * s);
    }, o.bias == null ? 80 : o.bias);
  }
  // A gold favor star in the world.
  function star(R, x, y, z, o = {}) {
    if ((o.op == null ? 1 : o.op) <= 0.01) return;
    R.at(x, y, z, (g, p) => {
      const r = 34 * p.s * (o.k || 1);
      g.globalAlpha = o.op == null ? 1 : o.op;
      g.translate(p.x, p.y);
      g.rotate(o.rot || 0);
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.45 : r;
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      const gr = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      gr.addColorStop(0, o.dim ? '#8a8a9a' : '#fff6c0');
      gr.addColorStop(1, o.dim ? '#4a4a5a' : '#e8a920');
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = o.dim ? 'rgba(255,255,255,0.3)' : '#fff1b0';
      g.lineWidth = 3 * p.s;
      g.stroke();
    }, o.bias == null ? 60 : o.bias);
    if (o.glow) R.light(x, y, z - 10, 90 * (o.k || 1), '#ffd24d', 0.5 * o.glow);
  }

  function word(root, cls, html) {
    const e = el('div', cls, root);
    e.innerHTML = html;
    e.style.display = 'none';
    return e;
  }
  // A shout or chip slammed onto the screen at `a` (and gone by `b`).
  function slam(e, t, a, b, x, y, rot = -6) {
    const p = seg(t, a, a + 0.35);
    const q = 1 - seg(t, b - 0.3, b);
    const vis = t >= a && t < b;
    e.style.display = vis ? '' : 'none';
    if (!vis) return;
    e.style.opacity = Math.min(p * 2, q);
    e.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${rot}deg) scale(${lerp(2.2, 1, E.out(p))})`;
  }

  function sceneRoot(root, seed) {
    const R = world(root, { seed });
    el('div', 'vignette', root);
    R.env.ground = ['#c9ab86', '#9c8063'];
    R.env.mountains = false;
    R.env.fogNear = 2600;
    R.env.fogFar = 9000;
    R.env.fogMax = 0.5;
    R.env.clouds = 0.6;
    return { R };
  }
  const dusk = (R, k = 0) => {
    R.env.tod = lerp(2.35, 2.75, k);
    R.env.sunAz = 0.1;
    R.env.moonAz = -0.4;
    R.env.tint = '#f4dcd8';
  };
  const night = (R) => {
    R.env.tod = 3;
    R.env.moonAz = 0.3;
    R.env.tint = '#c4bce6';
  };

  // ---------------------------------------------------------------- scenes
  // Narration starts `lead` seconds into each scene (0.6 unless set); times below follow the spoken lines.
  const LINEUP = [['doge', -480, 900], ['duchess', -320, 940], ['jester', -160, 880], ['poisoner', 0, 950], ['doctor', 160, 900], ['gondolier', 320, 940], ['spy', 480, 890]];
  const scenes = [];

  scenes.push({
    id: 'open', min: 8, lead: 1.4,
    say: 'Venice. Carnival night. The Doge has thrown open his palace... and every guest wears a mask.',
    build(root) {
      const s = sceneRoot(root, 1);
      s.title = caption(root, '<div class="big">The Masquerade Court</div>');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      const k = E.inOut(seg(t, 0, dur - 0.6));
      dusk(R, k * 0.5);
      look(R, lerp(-420, 0, k), lerp(70, 210, k), lerp(-2300, -420, k), lerp(-200, 0, k), lerp(160, 260, k), lerp(600, 1600, k));
      R.begin(t);
      piazza(R, t, { gx: lerp(-700, 500, seg(t, 0, dur)), gz: -1250 });
      fireworks(R, t, 3.0, 1.2);
      LINEUP.forEach(([n, x, z], i) => noble(R, n, x, z, { t: t + i }));
      confetti(R, t, 90, seg(t, 4, 6));
      R.end();
      s.title.e.style.top = '22%';
      s.title.show(t, dur - 3.4, dur + 1, 'pop');
    },
  });

  // When each mask is named in the narration.
  const NAMED = [2.9, 3.82, 4.88, 5.82, 6.88, 7.95, 9.25];
  scenes.push({
    id: 'masks', min: 11,
    say: 'Each noble hides two masks. The Doge. The Duchess. The Jester. The Poisoner. The Plague Doctor. The Gondolier... and the Spy. Every mask holds a power.',
    build: (root) => sceneRoot(root, 2),
    frame(t, dur, s) {
      const R = s.R;
      dusk(R, 0.6);
      const xs = ORDER.map((_, i) => -900 + i * 300);
      // The camera trucks along the line, arriving at each noble as they're named, then pulls back.
      let tx = xs[0];
      for (let i = 0; i < NAMED.length - 1; i++) if (t >= NAMED[i]) tx = lerp(xs[i], xs[i + 1], E.inOut(seg(t, NAMED[i + 1] - 0.8, NAMED[i + 1])));
      if (t < NAMED[0]) tx = lerp(xs[0] - 260, xs[0], E.out(seg(t, 0.6, NAMED[0])));
      const back = E.inOut(seg(t, 10.0, 11.6));
      R.env.focus = lerp(520, 1200, back);
      R.env.dof = 1.5 * (1 - back);
      look(R, lerp(tx - 150, 0, back), lerp(195, 480, back), lerp(-60, -1100, back), lerp(tx + 30, 0, back), lerp(165, 180, back), 470);
      R.begin(t);
      piazza(R, t, { gondola: false, nearZ: 600 });
      ORDER.forEach((n, i) => {
        const a = NAMED[i];
        const p = seg(t, a - 0.25, a + 0.35);
        const x = xs[i];
        const z = 450 + (i % 2) * 40;
        // Before they're named, each noble waits in the shadows holding two face-down masks.
        noble(R, n, x, z, { t: t + i, op: lerp(0.35, 1, clamp(p * 2)), flash: p > 0 ? (1 - p) * 0.9 : 0.55, flashColor: p > 0 ? '#fff1c4' : '#2a1838', lift: p > 0 ? (1 - E.out(p)) * 40 : 0 });
        const top = TALL[n] + 12;
        const turn = E.inOut(seg(t, a, a + 0.5));
        card(R, n, x - 44, top + Math.sin(t * 1.6 + i) * 6, z - 20, { h: 96, flip: turn, rot: -8, glow: Math.sin(turn * Math.PI) });
        card(R, 'back', x + 44, top + Math.cos(t * 1.6 + i) * 6, z - 22, { h: 96, flip: 0, rot: 8 });
        if (p > 0) R.light(x, 120, z - 30, 240, '#ffd27a', 0.45 * (1 - seg(t, a, a + 1.5)));
        tag(R, x, -8, z - 60, MASKS[n][0], { op: clamp(seg(t, a, a + 0.4)), k: 0.9 });
      });
      R.end();
      R.env.focus = null;
    },
  });

  scenes.push({
    id: 'claim', min: 8.5,
    say: 'On your turn, claim any power you like... whether you really wear that mask, or not.',
    build(root) {
      const s = sceneRoot(root, 3);
      s.title = caption(root, '<div class="mid">Claim <i>any</i> power</div>');
      s.q = word(root, 'pow', '🎭 Bluff?');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      dusk(R, 0.7);
      const k = E.inOut(seg(t, 0, dur));
      look(R, lerp(-160, 60, k), lerp(200, 185, k), lerp(-380, -120, k), 0, 190, 700);
      R.env.focus = lerp(1080, 820, k);
      R.env.dof = 1.4;
      R.begin(t);
      piazza(R, t, { gondola: false });
      noble(R, 'jester', 0, 700, { t, rot: Math.sin(t * 3) * 2 });
      // His claim: the Doge's card rises over him in a golden glow...
      const up = E.back(seg(t, 1.6, 2.5));
      card(R, 'doge', 20, lerp(60, 250, up), 680, { h: lerp(60, 170, up), op: clamp(seg(t, 1.6, 1.9) * 2), glow: up * (0.8 + 0.2 * Math.sin(t * 4)), rot: Math.sin(t * 1.4) * 3 });
      // ...while the two masks he really wears stay hidden behind his back.
      const hid = seg(t, 3.4, 4.0);
      [-1, 1].forEach((sd) => card(R, 'back', sd * 70, 40 + hid * 10, 740, { h: 90, op: hid, rot: sd * 12, bias: -30 }));
      if (hid > 0) tag(R, 0, 160, 760, '?', { k: 1.6, op: hid * (0.6 + 0.4 * Math.sin(t * 5)), bias: -40 });
      R.end();
      R.env.focus = null;
      s.title.show(t, 1.6, dur + 1, 'rise');
      s.title.e.style.top = '12%';
      slam(s.q, t, 5.1, dur + 1, W / 2 + 260, 360, 8);
    },
  });

  scenes.push({
    id: 'unmask', min: 11.5,
    say: 'Don\'t believe them? Call... Unmask! Catch a liar, and they lose a mask for good. But accuse an honest noble... and you pay the price.',
    build(root) {
      const s = sceneRoot(root, 4);
      s.shout = word(root, 'pow', 'UNMASK!');
      s.bad = word(root, 'chip bad', '✗ A bluff! Lose a mask');
      s.good = word(root, 'chip good', '✓ Honest!');
      s.cost = word(root, 'chip bad', '−2 ⭐ Favor for the accuser');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      dusk(R, 0.8);
      // Beat one: the Jester's bluff. Beat two: the Duchess tells the truth.
      const pan = E.inOut(seg(t, 6.0, 7.2));
      const k = seg(t, 0, dur);
      look(R, lerp(-180, 520, pan) + k * 40, lerp(195, 190, pan), lerp(-80, 40, pan), lerp(-180, 520, pan), 180, 720);
      R.begin(t);
      piazza(R, t, { gondola: false, nearZ: 800 });
      const call = 3.3;
      // The Doctor points his beak at the Jester.
      noble(R, 'doctor', 130, 760, { t, dir: -1, rot: t > 2.4 && t < 4 ? -6 : 0, lift: t > call && t < call + 0.4 ? 12 : 0 });
      const shake = t > call && t < call + 0.9 ? Math.sin(t * 60) * 5 : 0;
      noble(R, 'jester', -380, 720, { t, rot: shake });
      const reveal = E.inOut(seg(t, call + 0.6, call + 1.1));
      const claimFall = E.in(seg(t, call + 1.2, call + 2.0));
      card(R, 'doge', -360, 250 - claimFall * 260, 700, { h: 150, op: 1 - claimFall, rot: claimFall * 40, glow: (1 - reveal) * 0.6, flash: claimFall * 0.6, flashColor: '#55505a' });
      // His real mask turns over: the Jester, not the Doge. Torn away for good.
      const torn = E.in(seg(t, call + 2.0, call + 3.2));
      card(R, 'jester', -440 - torn * 500, 60 + Math.sin(reveal * Math.PI) * 60 + torn * 380, 680 - torn * 100, { h: 120, flip: reveal, rot: -10 - torn * 160, op: 1 - torn * 0.9, flash: torn * 0.7, flashColor: '#5a5a66' });
      card(R, 'back', -320, 60, 682, { h: 120, rot: 10 });
      // The Duchess, accused by the Poisoner, shows her mask is true.
      const acc = 7.2;
      noble(R, 'duchess', 420, 720, { t });
      const shame = seg(t, 8.5, 8.8) * (1 - seg(t, 9.6, 10.4));
      noble(R, 'poisoner', 680, 760, { t, dir: -1, rot: t > acc - 0.3 && t < acc + 0.6 ? -6 : 0, flash: shame * 0.22, flashColor: '#ff4b4b' });
      card(R, 'duchess', 450, 250, 700, { h: 150, glow: 0.6, rot: Math.sin(t * 1.4) * 3 });
      const hflip = E.inOut(seg(t, acc + 0.3, acc + 0.8));
      card(R, 'duchess', 360, 60 + Math.sin(hflip * Math.PI) * 60, 690, { h: 120, flip: hflip, rot: -8, glow: hflip * 0.9 });
      // ...and the Poisoner pays two favor, which fly back to the Doge's palace.
      [0, 1].forEach((j) => {
        const f = seg(t, 8.6 + j * 0.2, 9.8 + j * 0.2);
        if (f <= 0 || f >= 1) return;
        star(R, lerp(680, 1000 + j * 100, f), 300 + Math.sin(f * Math.PI) * 140 + f * 200, lerp(740, 1400, f), { op: 1 - seg(f, 0.7, 1), rot: f * 6, glow: 1 });
      });
      R.end();
      slam(s.shout, t, call - 0.1, call + 1.9, W / 2, 130, -4);
      slam(s.bad, t, call + 1.3, 6.4, W / 2, 620, -3);
      slam(s.good, t, acc + 0.9, dur + 1, W / 2 - 300, 640, -3);
      slam(s.cost, t, 8.6, dur + 1, W / 2 + 200, 560, 3);
    },
  });

  scenes.push({
    id: 'pairs', min: 9,
    say: 'Wear the right two masks, and claim them both... for a royal power. If you dare.',
    build(root) {
      const s = sceneRoot(root, 5);
      s.title = caption(root, '<div class="mid">👑 The Royal Court</div><div class="sub">A Waltz worth ⭐⭐</div>');
      s.flash = el('div', 'full', root, { zIndex: 8600, background: '#fff3c8', opacity: 0 });
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      dusk(R, 0.85);
      const a = t * 0.05 - 0.2;
      look(R, Math.sin(a) * 620, 230, 700 - Math.cos(a) * 620, 0, 200, 700);
      R.begin(t);
      piazza(R, t, { gondola: false });
      fireworks(R, t, 4.2, 1.6);
      const join = E.inOut(seg(t, 0.4, 2.6));
      const walk = join > 0 && join < 1 ? t : null;
      noble(R, 'duchess', lerp(-420, -90, join), 700, { t, walk });
      noble(R, 'doge', lerp(420, 90, join), 700, { t, walk, dir: -1 });
      // Their two masks drift together over them and flare into one royal power.
      const meet = E.inOut(seg(t, 2.2, 3.4));
      const flare = Math.sin(seg(t, 3.3, 4.4) * Math.PI);
      const y = lerp(220, 250, meet) + Math.sin(t * 1.6) * 6;
      card(R, 'duchess', lerp(lerp(-420, -90, join), -62, meet), y, 690, { h: 150, rot: lerp(-6, -10, meet), glow: 0.4 + flare, flash: flare * 0.4, flashColor: '#fff1c4' });
      card(R, 'doge', lerp(lerp(420, 90, join), 62, meet), y, 688, { h: 150, rot: lerp(6, 10, meet), glow: 0.4 + flare, flash: flare * 0.4, flashColor: '#fff1c4' });
      if (flare > 0) {
        for (let j = 0; j < 16; j++) {
          const q = (t * 0.9 + j / 16) % 1;
          R.blob(Math.cos(j * 2.4 + t) * 120 * (0.4 + q), 260 + q * 260, 680 + Math.sin(j * 2.4 + t) * 40, 8 + 6 * (1 - q), '#ffd24d', flare * (1 - q));
        }
        R.light(0, 340, 670, 420, '#ffd24d', 0.6 * flare);
      }
      confetti(R, t, 120, seg(t, 3.6, 4.6));
      R.end();
      s.flash.style.opacity = 0.5 * seg(t, 3.5, 3.6) * (1 - seg(t, 3.6, 4.2));
      s.title.show(t, 3.9, dur + 1, 'pop');
      s.title.e.style.top = '84%';
    },
  });

  scenes.push({
    id: 'whisper', min: 10,
    say: 'Or lean in close, and whisper what a rival is really wearing. Guess right... and their mask is torn away.',
    build(root) {
      const s = sceneRoot(root, 6);
      s.bubble = word(root, 'bubble', '🗣️ …she wears <b>the Spy</b>.');
      s.tear = word(root, 'chip bad', '✂️ Torn away!');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      dusk(R, 0.95);
      const k = E.inOut(seg(t, 0, dur));
      look(R, lerp(-140, -40, k), lerp(200, 190, k), lerp(-40, 260, k), 60, 170, 760);
      R.env.focus = lerp(800, 500, k);
      R.env.dof = 1.3;
      R.begin(t);
      piazza(R, t, { gondola: false });
      // The Jester leans in to the Gondolier's ear...
      const lean = E.inOut(seg(t, 0.6, 1.6));
      noble(R, 'jester', -180, 760, { t, rot: lean * 9 });
      noble(R, 'gondolier', -20, 790, { t, dir: -1 });
      // ...naming what the Spy, across the way, is really wearing.
      noble(R, 'spy', 300, 740, { t, dir: -1 });
      const turn = E.inOut(seg(t, 5.3, 5.9));
      const rip = E.in(seg(t, 6.5, 7.6));
      card(R, 'spy', 250 + rip * 300, 40 + Math.sin(turn * Math.PI) * 60 + rip * 420, 700 - rip * 80, { h: 120, flip: turn, rot: -8 + rip * 150, op: 1 - rip * 0.9, glow: turn * (1 - rip), flash: rip * 0.6, flashColor: '#5a5a66' });
      card(R, 'back', 360, 40, 702, { h: 120, rot: 8 });
      if (rip > 0 && rip < 1) {
        for (let j = 0; j < 10; j++) {
          const q = (rip + j / 10) % 1;
          R.blob(250 + rip * 300 + Math.cos(j) * 60 * q, 120 + rip * 420 + Math.sin(j) * 50 * q, 690, 10, '#ffd24d', 0.7 * (1 - q));
        }
      }
      R.end();
      R.env.focus = null;
      const bv = t >= 1.9 && t < 6.6;
      s.bubble.style.display = bv ? '' : 'none';
      if (bv) {
        s.bubble.style.opacity = Math.min(seg(t, 1.9, 2.2) * 2, 1 - seg(t, 6.2, 6.6));
        s.bubble.style.transform = `translate(250px, 150px) scale(${lerp(0.6, 1, E.back(seg(t, 1.9, 2.4)))})`;
      }
      slam(s.tear, t, 6.9, dur + 1, W / 2 + 200, 620, -5);
    },
  });

  scenes.push({
    id: 'intrigue', min: 8.5,
    say: 'And every noble keeps a secret intrigue... worth the Doge\'s favor, the moment it comes true.',
    build(root) {
      const s = sceneRoot(root, 7);
      s.letter = word(root, 'letter', '<div class="txt"><b>🎻 Patron of the Arts</b><span>Toast the Doge twice.</span><em>+2 ⭐ Favor</em></div><div class="seal">🎭</div><div class="stamp">SECRET</div>');
      s.seal = s.letter.querySelector('.seal');
      s.txt = s.letter.querySelector('.txt');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      night(R);
      R.env.fogNear = 300;
      R.env.fogFar = 1900;
      R.env.fogMax = 0.8;
      R.env.hazeColor = '#2a1838';
      const k = E.inOut(seg(t, 0, dur));
      look(R, lerp(-80, 40, k), lerp(170, 180, k), lerp(-240, 180, k), 0, 170, 760);
      R.begin(t);
      piazza(R, t, { gondola: false, guests: false, glow: 1.4 });
      R.light(0, 260, 820, 420, '#a57bff', 0.4);
      noble(R, 'dancer', 0, 760, { t, flash: 0.88, flashColor: '#0d0816' });
      R.blob(0, 40, 700, 260, '#2c1a40', 0.5);
      R.end();
      R.env.fogNear = 2600;
      R.env.fogFar = 9000;
      R.env.fogMax = 0.5;
      R.env.hazeColor = null;
      const f = seg(t, 0.8, 1.6);
      s.letter.style.display = f > 0 ? '' : 'none';
      s.letter.style.opacity = clamp(f * 2);
      s.letter.style.transform = `translate(${W / 2 - 260}px, ${H / 2 - 175 + (1 - E.out(f)) * 60}px) scale(${lerp(0.6, 1, E.back(f))}) rotate(${lerp(-10, -2, E.out(f)) + Math.sin(t) * 1}deg)`;
      const open = E.inOut(seg(t, 3.3, 4.0));
      s.seal.style.transform = `scale(${1 + open * 0.6}) rotate(${open * 40}deg)`;
      s.seal.style.opacity = 1 - open;
      s.txt.style.opacity = seg(t, 3.6, 4.2);
      R.cv.style.filter = f > 0 ? `blur(${3 * f}px) brightness(${1 - 0.3 * f})` : '';
    },
  });

  scenes.push({
    id: 'win', min: 9,
    say: 'Win seven favor with the Doge... or be the last noble still wearing a mask.',
    build(root) {
      const s = sceneRoot(root, 8);
      s.title = caption(root, '<div class="mid">⭐ 7 Favor wins</div><div class="sub">…or be the last one still masked</div>');
      s.crown = word(root, 'pow', '👑 WINNER!');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      dusk(R, 1);
      // First the Doge hands out favor; then the court thins until one masked noble is left.
      const out = E.inOut(seg(t, 3.6, 4.8));
      look(R, 0, lerp(120, 250, out), lerp(1700, 160, out), 0, lerp(330, 170, out), lerp(2600, 900, out));
      R.begin(t);
      piazza(R, t, { gondola: false, guests: false, stands: false });
      fireworks(R, t, 0.5, 1.4);
      noble(R, 'doge', 0, 2380, { t, op: 1 - out, h: 210 });
      for (let i = 0; i < 7; i++) {
        const a = 1.0 + i * 0.3;
        const p = seg(t, a, a + 0.4);
        const ang = Math.PI + (i / 6) * Math.PI;
        star(R, Math.cos(ang) * 280, 300 - Math.sin(ang) * 130, 2360, { k: lerp(0.3, 0.9, E.back(p)), op: p * (1 - out), rot: Math.sin(t * 2 + i) * 0.2, glow: p * (1 - out), bias: 20 });
      }
      LINEUP.forEach(([n, x], i) => {
        if (out <= 0) return;
        const last = n === 'spy';
        const gone = last ? 0 : seg(t, 4.9 + i * 0.32, 5.4 + i * 0.32);
        const step = last ? E.inOut(seg(t, 6.9, 7.9)) : 0;
        const nx = lerp(x * 0.9, 0, step);
        noble(R, n, nx, 900 + (i % 2) * 40, { t: t + i, walk: step > 0 && step < 1 ? t : null, dir: last && step < 1 && step > 0 ? -1 : 1, op: out * (1 - gone), flash: last ? 0.25 * seg(t, 7.6, 8.0) : gone * 0.8, flashColor: last ? '#ffe9a0' : '#3a3346', lift: -gone * 40 });
        if (last) R.light(nx, 140, 870, 260, '#ffd24d', 0.35 * seg(t, 7.6, 8.0));
      });
      confetti(R, t, 100, seg(t, 7.0, 7.6));
      R.end();
      s.title.show(t, 0.6, 4.2, 'rise');
      s.title.e.style.top = '12%';
      slam(s.crown, t, 7.8, dur + 1, W * 0.5, 170, -4);
    },
  });

  scenes.push({
    id: 'end', min: 8, tail: 2.6,
    say: 'The Masquerade Court. Play the computer, friends, or rivals online... now, at Ahrens Labs.',
    build(root) {
      const s = sceneRoot(root, 9);
      s.title = caption(root, '<div class="big">The Masquerade Court</div><div class="sub">A game of masks and bluffs</div><div class="pill">Play now at ahrenslabs.com</div>');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      dusk(R, 0.7);
      const a = t * 0.06 - 0.3;
      look(R, Math.sin(a) * 1500, 620, 900 - Math.cos(a) * 1500, 0, 160, 1000);
      R.begin(t);
      piazza(R, t, { gx: lerp(-600, 600, seg(t, 0, dur)), gz: -700 });
      fireworks(R, t, 0, 1.6);
      LINEUP.forEach(([n, x, z], i) => noble(R, n, x, z, { t: t + i }));
      confetti(R, t, 80, 1);
      R.end();
      R.cv.style.filter = 'blur(2px) brightness(0.7)';
      s.title.show(t, 0.3, dur + 2);
    },
  });

  runAd(scenes);
})();
