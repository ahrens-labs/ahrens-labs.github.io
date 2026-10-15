// Atlantis Expedition ad: a dive from the sunlit shallows to the Heart of Atlantis, through a 3D city of
// ruins. The narration is unchanged, so the cached voiceover still lines up.
(function () {
  const { W, H, clamp, lerp, seg, E, rng, el, img, caption, runAd } = AD;
  const { world, prop, rock } = AD3;
  const A = (n) => `sprites/atl/${n}.png`;
  const TAU = Math.PI * 2;
  const HEART = [0, 3920];

  const style = el('style', '', document.head);
  style.textContent = `
    .title .big { -webkit-text-stroke: 3px rgba(4, 40, 58, 0.65); text-shadow: 0 6px 0 rgba(4, 38, 56, 0.9), 0 14px 34px rgba(0, 0, 0, 0.6), 0 0 40px rgba(110, 230, 255, 0.4); }
    .title .mid { text-shadow: 0 5px 0 rgba(4, 38, 56, 0.85), 0 12px 26px rgba(0, 0, 0, 0.55); }
    .title .pill { background: #f2c14e; color: #08364a; }
    .pow { position: absolute; left: 0; top: 0; z-index: 8700; white-space: nowrap; transform-origin: 50% 50%;
      font: 72px/1 "Lilita One", sans-serif; color: #fff6d0; -webkit-text-stroke: 3px #04303c; letter-spacing: 0.02em;
      text-shadow: 0 6px 0 #04303c, 0 14px 30px rgba(0, 0, 0, 0.55); }
    .pow.bad { color: #ffb3a8; }
    .chip { position: absolute; left: 0; top: 0; z-index: 8700; white-space: nowrap; padding: 12px 24px; border-radius: 18px; transform-origin: 50% 50%;
      background: rgba(4, 30, 46, 0.88); color: #e9fbff; font: 36px/1 "Lilita One", sans-serif; box-shadow: 0 0 0 3px rgba(120, 220, 255, 0.75), 0 12px 30px rgba(0, 0, 0, 0.5); }`;

  // ---------------------------------------------------------------- drawn props
  function column(seed, broken) {
    return prop(`col${seed}${broken ? 'b' : ''}`, 220, 560, (g, w, h) => {
      const r = rng(seed + 3);
      const top = broken ? 80 + r() * 70 : 36;
      const x0 = 78;
      const bw = 64;
      const gr = g.createLinearGradient(x0, 0, x0 + bw, 0);
      gr.addColorStop(0, '#8a7352');
      gr.addColorStop(0.35, '#f0e2c4');
      gr.addColorStop(1, '#6d5a40');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x0, h - 40);
      g.lineTo(x0 + 6, top + 40);
      g.lineTo(x0 + bw - 6, top + 40);
      g.lineTo(x0 + bw, h - 40);
      g.fill();
      g.strokeStyle = 'rgba(90, 60, 30, 0.25)';
      g.lineWidth = 2;
      for (let i = 1; i <= 3; i++) {
        g.beginPath();
        g.moveTo(x0 + i * 15, top + 44);
        g.lineTo(x0 + i * 15, h - 44);
        g.stroke();
      }
      g.fillStyle = '#e2b34a';
      [0.3, 0.62].forEach((f) => g.fillRect(x0 - 4, top + (h - top) * f, bw + 8, 10));
      g.fillStyle = '#f4e6c8';
      if (!broken) {
        g.fillRect(58, top + 8, 104, 18);
        g.fillRect(46, top + 24, 128, 16);
        g.fillStyle = '#e2b34a';
        g.fillRect(46, top + 24, 128, 5);
      } else {
        g.fillStyle = '#cbb892';
        g.beginPath();
        g.moveTo(x0 - 4, top + 48);
        g.lineTo(x0 + 16, top + 10);
        g.lineTo(x0 + 40, top + 36);
        g.lineTo(x0 + bw, top + 8);
        g.lineTo(x0 + bw + 6, top + 48);
        g.fill();
      }
      g.fillStyle = '#e6d3ae';
      g.fillRect(58, h - 44, 104, 16);
      g.fillRect(42, h - 28, 136, 18);
      g.fillStyle = '#e2b34a';
      g.fillRect(42, h - 30, 136, 5);
      g.fillStyle = 'rgba(40, 140, 90, 0.7)';
      g.beginPath();
      g.ellipse(w / 2, h - 20, 40, 12, 0, 0, TAU);
      g.fill();
    });
  }
  function coral(seed, col) {
    return prop(`cor${seed}${col}`, 180, 150, (g, w, h) => {
      const r = rng(seed + 4);
      g.lineCap = 'round';
      g.lineWidth = 9;
      for (let i = 0; i < 5; i++) {
        const tipx = 20 + r() * (w - 40);
        const tipy = 8 + r() * 36;
        g.strokeStyle = col;
        g.beginPath();
        g.moveTo(w / 2, h - 4);
        g.quadraticCurveTo(w / 2 + (r() - 0.5) * 40, h * 0.45, tipx, tipy);
        g.stroke();
        g.fillStyle = AD3.mix(col, '#ffffff', 0.35);
        g.beginPath();
        g.arc(tipx, tipy, 7 + r() * 4, 0, TAU);
        g.fill();
      }
    });
  }
  function kelp(seed) {
    return prop(`kelp${seed}`, 90, 300, (g, w, h) => {
      const r = rng(seed + 9);
      g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = ['#1f7a42', '#2f9a55', '#14663a'][i];
        g.lineWidth = 7 - i;
        g.beginPath();
        g.moveTo(22 + i * 20, h);
        g.bezierCurveTo(10 + r() * 20, h * 0.65, 50 + r() * 20, h * 0.35, 18 + i * 16 + r() * 10, 12);
        g.stroke();
      }
    });
  }
  function crystal() {
    return prop('heartcrystal', 200, 300, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, '#f4ffff');
      gr.addColorStop(0.35, '#8df4ff');
      gr.addColorStop(1, '#145a86');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(w / 2, 6);
      g.lineTo(w * 0.84, h * 0.4);
      g.lineTo(w * 0.66, h - 6);
      g.lineTo(w * 0.34, h - 6);
      g.lineTo(w * 0.16, h * 0.4);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath();
      g.moveTo(w / 2, 18);
      g.lineTo(w * 0.6, h * 0.42);
      g.lineTo(w / 2, h * 0.72);
      g.closePath();
      g.fill();
    });
  }
  function chest() {
    return prop('chest', 240, 170, (g, w, h) => {
      g.fillStyle = '#7a4e1c';
      g.beginPath();
      g.roundRect(18, 62, 204, 96, 8);
      g.fill();
      g.fillStyle = '#c4893a';
      g.fillRect(18, 62, 204, 26);
      g.strokeStyle = '#f2c14e';
      g.lineWidth = 4;
      g.strokeRect(22, 66, 196, 86);
      g.fillStyle = '#f2c14e';
      g.fillRect(104, 84, 32, 22);
      ['#ffe9a0', '#f2c14e', '#fff6c8'].forEach((c, i) => {
        g.fillStyle = c;
        g.beginPath();
        g.arc(70 + i * 40, 58 - (i % 2) * 10, 16, 0, TAU);
        g.fill();
      });
    });
  }
  const FACES = {};
  function dieFace(n, col) {
    const key = col + n;
    if (FACES[key]) return FACES[key];
    return FACES[key] = prop('d20' + key, 240, 260, (g, w, h) => {
      g.fillStyle = col;
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i / 6) * TAU;
        const x = w / 2 + Math.cos(a) * 104;
        const y = h / 2 + 6 + Math.sin(a) * 112;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.closePath();
      g.fill();
      g.lineWidth = 8;
      g.strokeStyle = '#ffffff';
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.2)';
      g.beginPath();
      g.moveTo(w / 2, 46);
      g.lineTo(w / 2 + 52, h / 2 + 30);
      g.lineTo(w / 2 - 52, h / 2 + 30);
      g.fill();
      g.fillStyle = '#ffffff';
      g.font = '84px "Lilita One"';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(n), w / 2, h / 2 + 10);
    });
  }
  const MEDALS = {};
  function medal(name, label) {
    const key = name + label;
    if (MEDALS[key]) return MEDALS[key];
    const im = img(A(name));
    const c = document.createElement('canvas');
    c.width = 340;
    c.height = 400;
    const g = c.getContext('2d');
    if (im.complete && im.naturalWidth && document.fonts.check('40px "Lilita One"')) {
      g.save();
      g.beginPath();
      g.arc(170, 150, 136, 0, TAU);
      g.clip();
      const s = Math.max(272 / im.naturalWidth, 272 / im.naturalHeight);
      g.drawImage(im, 170 - (im.naturalWidth * s) / 2, 150 - (im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s);
      g.restore();
      g.strokeStyle = '#f2c14e';
      g.lineWidth = 12;
      g.beginPath();
      g.arc(170, 150, 142, 0, TAU);
      g.stroke();
      g.font = '40px "Lilita One"';
      const tw = Math.min(g.measureText(label).width + 36, 320);
      g.fillStyle = 'rgba(255,246,226,0.96)';
      g.beginPath();
      g.roundRect(170 - tw / 2, 312, tw, 52, 26);
      g.fill();
      g.fillStyle = '#08364a';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(label, 170, 340);
      MEDALS[key] = c;
    }
    return c;
  }

  // ---------------------------------------------------------------- the drowned city
  const r0 = rng(41);
  const COLS = [];
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1;
    const z = 200 + Math.floor(i / 2) * 340 + r0() * 40;
    if (z > 3000 && z < 4700) continue;
    COLS.push([side * (390 + (i % 4) * 18), z, 380 + r0() * 140, i % 8, r0() < 0.35]);
  }
  const CORAL = [];
  const KELP = [];
  const ROCKS = [];
  for (let i = 0; i < 28; i++) {
    const side = i % 2 ? 1 : -1;
    CORAL.push([side * (620 + r0() * 500), -200 + r0() * 5000, i % 6, ['#e06aa0', '#ff8a3a', '#7a5cff', '#3ecf8e'][i % 4]]);
  }
  for (let i = 0; i < 18; i++) KELP.push([(i % 2 ? 1 : -1) * (300 + r0() * 700), -100 + r0() * 4800, i % 5]);
  for (let i = 0; i < 12; i++) ROCKS.push([(i % 2 ? 1 : -1) * (260 + r0() * 800), r0() * 4600, i % 5]);
  const BUBS = Array.from({ length: 42 }, () => [(r0() - 0.5) * 1600, r0() * 600, r0() * 4800, r0(), 0.6 + r0(), 4 + r0() * 7]);
  const FISH = Array.from({ length: 14 }, () => [(r0() - 0.5) * 1400, 60 + r0() * 220, r0() * 4000, r0() < 0.5 ? 1 : -1, ['#ffd56a', '#7ee0ff', '#ff8fb8'][Math.floor(r0() * 3)]]);
  const ASPECT = { minnow: 254 / 171, barracuda: 443 / 208, nautilus: 455 / 266, leviathan: 455 / 306 };

  function shaft(R, x, z, t, ph, a) {
    if (a <= 0.01) return;
    const sway = Math.sin(t * 0.35 + ph) * 140;
    const top = R.project(x + sway * 0.3, 2600, z - 200);
    const bot = R.project(x + sway, 0, z);
    if (!top || !bot) return;
    R.add(19000, () => {
      const g = R.g;
      const gr = g.createLinearGradient(top.x, top.y, bot.x, bot.y);
      gr.addColorStop(0, `rgba(214, 250, 255, ${0.34 * a})`);
      gr.addColorStop(1, 'rgba(214, 250, 255, 0)');
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(top.x - 16, top.y);
      g.lineTo(top.x + 16, top.y);
      g.lineTo(bot.x + 90, bot.y);
      g.lineTo(bot.x - 90, bot.y);
      g.closePath();
      g.fill();
    });
  }
  function bubbles(R, t, a) {
    if (a <= 0.01) return;
    BUBS.forEach(([x, y0, z, ph, sp, rad]) => {
      const y = (y0 + t * sp * 70) % 640;
      R.at(x + Math.sin(t * 1.4 + ph) * 16, y, z, (g, p) => {
        const r = rad * p.s;
        if (r < 0.6) return;
        g.strokeStyle = `rgba(230, 250, 255, ${0.75 * a})`;
        g.lineWidth = Math.max(1, 1.4 * p.s);
        g.beginPath();
        g.arc(p.x, p.y, r, 0, TAU);
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.beginPath();
        g.arc(p.x - r * 0.3, p.y - r * 0.3, r * 0.22, 0, TAU);
        g.fill();
      });
    });
  }
  function fishSchool(R, t) {
    FISH.forEach(([x0, y, z, dir, col], i) => {
      const x = x0 + ((t * 40 * dir + i * 80) % 1600) - 800;
      R.at(x, y + Math.sin(t * 2 + i) * 8, z, (g, p) => {
        const s = p.s * 12;
        if (s < 1.2) return;
        g.fillStyle = col;
        g.beginPath();
        g.ellipse(p.x, p.y, s * 1.7, s * 0.55, 0, 0, TAU);
        g.fill();
        g.beginPath();
        g.moveTo(p.x - dir * s * 1.4, p.y);
        g.lineTo(p.x - dir * s * 2.4, p.y - s * 0.55);
        g.lineTo(p.x - dir * s * 2.4, p.y + s * 0.55);
        g.fill();
      });
    });
  }
  function platform(R, x, y, z, w, d, h, col) {
    const top = y + h;
    const x0 = x - w / 2;
    const x1 = x + w / 2;
    const z0 = z - d / 2;
    const z1 = z + d / 2;
    const c = R.project(x, top, z);
    if (!c) return;
    R.add(c.d + d, () => {
      const camZ = R.cam.z;
      R.poly([[x0, top, z0], [x1, top, z0], [x1, top, z1], [x0, top, z1]], AD3.mix(col, '#fff6d8', 0.22));
      const faces = [
        [z0, [[x0, y, z0], [x1, y, z0], [x1, top, z0], [x0, top, z0]]],
        [z1, [[x1, y, z1], [x0, y, z1], [x0, top, z1], [x1, top, z1]]],
      ];
      faces.sort((a, b) => Math.abs(camZ - b[0]) - Math.abs(camZ - a[0]));
      faces.forEach(([fz, pts]) => R.poly(pts, AD3.mix(col, '#000000', fz > z ? 0.28 : 0.08)));
    });
  }
  function pyramid(R, glow) {
    const [x, z] = HEART;
    const cols = ['#cbb98a', '#b7a67a', '#a89468', '#8f7c58', '#d9cba6'];
    for (let i = 0; i < 5; i++) platform(R, x, i * 52, z, 520 - i * 80, 380 - i * 55, 52, cols[i]);
    const pulse = 0.7 + 0.3 * Math.sin(glow * 2.4);
    R.bill(crystal(), { x, y: 268, z, h: 320 + 18 * pulse, shadow: false, bias: 10 });
    R.light(x, 420, z, 620, '#d8fbff', 0.55 * pulse);
    R.light(x, 300, z, 280, '#fff6c0', 0.35 * pulse);
  }
  function city(R, t, o = {}) {
    const [hx, hz] = HEART;
    R.decal([[-180, -600], [180, -600], [200, hz + 200], [-200, hz + 200]], '#6e8f86');
    R.disc(0, 1500, 380, 240, '#7f9e94', '#4e6e66', 3);
    R.disc(hx, hz, 520, 340, '#8aa498', '#4e6e66', 3);
    COLS.forEach(([x, z, h, sd, broken]) => R.bill(column(sd, broken), { x, z, h, shadowW: 0.2, minD: 160 }));
    CORAL.forEach(([x, z, sd, col]) => R.bill(coral(sd, col), { x, z, h: 110, shadowW: 0.3, minD: 140 }));
    KELP.forEach(([x, z, sd]) => R.bill(kelp(sd), { x, z, h: 200, rot: Math.sin(t * 0.9 + x) * 4, shadow: false, minD: 140 }));
    ROCKS.forEach(([x, z, sd]) => R.bill(rock(sd, '#9a9080'), { x, z, h: 70, shadowW: 0.3, minD: 120 }));
    if (o.heart !== false) pyramid(R, t);
    [[-700, 500], [300, 1400], [800, 2300], [-200, 3100]].forEach(([x, z], i) => shaft(R, x, z, t, i, o.shafts == null ? 1 : o.shafts));
    bubbles(R, t, o.bubbles == null ? 1 : o.bubbles);
    if (o.fish !== false) fishSchool(R, t);
  }

  function look(R, x, y, z, tx, ty, tz) {
    Object.assign(R.cam, { x, y, z });
    const dx = tx - x;
    const dz = tz - z;
    R.cam.yaw = Math.atan2(dx, dz);
    R.cam.pitch = Math.atan2(y - ty, Math.hypot(dx, dz));
  }
  function sub(R, id, x, y, z, o = {}) {
    const h = o.h || { minnow: 110, barracuda: 140, nautilus: 185, leviathan: 250 }[id];
    const dir = o.dir || 1;
    const t = o.t || 0;
    R.bill(A('sub-' + id), {
      x, y, z, h, dir, shadow: false, op: o.op, bias: o.bias,
      rot: (o.rot || 0) + Math.sin(t * 1.3 + x * 0.01) * 2,
    });
    const nose = x + dir * h * ASPECT[id] * 0.42;
    R.light(nose, y + h * 0.45, z, id === 'leviathan' ? 260 : 160, '#fff1c4', (o.lamp == null ? 0.4 : o.lamp));
    if (o.trail !== false) {
      for (let j = 0; j < 5; j++) {
        const q = (t * 0.9 + j / 5) % 1;
        R.blob(x - dir * h * ASPECT[id] * (0.2 + q * 0.45), y + h * 0.35 + Math.sin(t * 3 + j) * 8, z, 7 + q * 9, '#d7f6ff', 0.4 * (1 - q));
      }
    }
  }
  function swimmer(R, x, y, z, o = {}) {
    const t = o.t || 0;
    R.bill(A('swimmer'), {
      x, y, z, h: o.h || 150, dir: o.dir || 1, shadow: false, op: o.op, bias: o.bias,
      rot: Math.sin(t * 2.2 + (o.ph || 0)) * 5 + (o.rot || 0),
    });
  }
  function shark(R, x, y, z, o = {}) {
    R.bill(A('shark'), {
      x, y, z, h: o.h || 170, dir: o.dir || 1, shadow: false, op: o.op,
      rot: Math.sin((o.t || 0) * 1.6) * 3,
    });
  }
  function tag(R, x, y, z, text, o = {}) {
    if (o.op === 0) return;
    R.at(x, y, z, (g, p) => {
      const s = clamp(p.s * (o.k || 1), 0.4, 1.35);
      g.globalAlpha = o.op == null ? 1 : o.op;
      g.font = `${Math.round(28 * s)}px "Lilita One"`;
      const w = g.measureText(text).width + 32 * s;
      const hh = 46 * s;
      g.fillStyle = o.bg || 'rgba(255, 246, 226, 0.96)';
      g.beginPath();
      g.roundRect(p.x - w / 2, p.y - hh / 2, w, hh, hh / 2);
      g.fill();
      if (o.ring) {
        g.strokeStyle = o.ring;
        g.lineWidth = 4 * s;
        g.stroke();
      }
      g.fillStyle = o.fg || '#08364a';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, p.x, p.y + 1.5 * s);
    }, o.bias == null ? 70 : o.bias);
  }
  function pearlAt(R, x, y, z, r, a) {
    if (a <= 0.02) return;
    R.at(x, y, z, (g, p) => {
      const rr = r * p.s;
      if (rr < 0.5) return;
      const gr = g.createRadialGradient(p.x - rr * 0.3, p.y - rr * 0.35, rr * 0.1, p.x, p.y, rr);
      gr.addColorStop(0, `rgba(255,255,255,${a})`);
      gr.addColorStop(0.55, `rgba(236, 230, 240, ${a})`);
      gr.addColorStop(1, `rgba(150, 140, 170, ${a})`);
      g.fillStyle = gr;
      g.beginPath();
      g.arc(p.x, p.y, rr, 0, TAU);
      g.fill();
    }, 30);
  }
  function showDie(R, x, y, z, t, land, face, col) {
    const p = seg(t, 0, land);
    const n = p < 1 ? 1 + (Math.floor(t * 14) % 20) : face;
    R.bill(dieFace(n, col), {
      x, y: y + (p < 1 ? Math.abs(Math.sin(p * Math.PI * 3)) * 40 * (1 - p) : 0), z,
      h: 180, rot: p < 1 ? (1 - E.out(p)) * 640 : 0, shadow: false, bias: 50,
    });
    if (p >= 1) R.light(x, y + 40, z, 220, col, 0.45 * (1 - seg(t, land, land + 1.4)));
  }
  function kraken(R, x, z, t, a) {
    if (a <= 0.01) return;
    // Arms curl beside the body. They stay back from the lens, so they read as tentacles and not a spider.
    const arms = [[-2.4, 280], [-1.5, 340], [-0.7, 250], [0.15, 300], [0.9, 260], [1.7, 320], [2.5, 240]];
    arms.forEach(([ph, reach], i) => {
      const ox = x + Math.sin(ph) * 50;
      const oz = z + Math.cos(ph) * 24;
      const pts = [];
      for (let k = 0; k <= 16; k++) {
        const u = k / 16;
        const sway = Math.sin(t * 1.2 + ph + u * 5) * 28 * u;
        // Out from under the mantle, then the tip curls back down.
        const y = 150 * a * (1 - u * u) + 20 + Math.sin(u * Math.PI) * 36 * a;
        pts.push(R.project(ox + Math.sin(ph) * reach * u + sway, y, oz + Math.cos(ph) * reach * 0.22 * u));
      }
      const vis = pts.filter(Boolean);
      if (vis.length < 5) return;
      R.add(vis[0].d - 30 - i, () => {
        const g = R.g;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.strokeStyle = '#241433';
        g.lineWidth = Math.max(3, vis[0].s * 22);
        g.beginPath();
        vis.forEach((p, n) => (n ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
        g.stroke();
        g.strokeStyle = '#6a4588';
        g.lineWidth = Math.max(2, vis[0].s * 16);
        g.stroke();
        g.fillStyle = '#f0cbb8';
        vis.forEach((p, n) => {
          if (n % 2 || n < 4) return;
          g.beginPath();
          g.arc(p.x, p.y, Math.max(1.5, 4.5 * p.s), 0, TAU);
          g.fill();
        });
      });
    });
    const eye = seg(a, 0.3, 0.65);
    R.at(x, 250 * a, z + 20, (g, p) => {
      const s = p.s;
      g.fillStyle = '#3a2156';
      g.beginPath();
      g.ellipse(p.x, p.y, 92 * s, 118 * s, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#5c3b7c';
      g.beginPath();
      g.ellipse(p.x - 14 * s, p.y - 16 * s, 48 * s, 64 * s, -0.3, 0, TAU);
      g.fill();
      [-30, 28].forEach((dx, i) => {
        g.fillStyle = `rgba(214, 255, 255, ${0.95 * eye})`;
        g.beginPath();
        g.ellipse(p.x + dx * s, p.y - 6 * s, 11 * s, 14 * s, i ? 0.2 : -0.2, 0, TAU);
        g.fill();
        g.fillStyle = '#07141c';
        g.beginPath();
        g.arc(p.x + (dx + 2) * s, p.y - 4 * s, 7 * s, 0, TAU);
        g.fill();
      });
    }, -20);
    R.light(x, 260 * a, z, 140, '#b7fbff', 0.28 * eye);
  }
  function word(root, cls, html) {
    const e = el('div', cls, root);
    e.innerHTML = html;
    return e;
  }
  function slam(e, t, a, b, x, y, rot = -4) {
    const p = seg(t, a, a + 0.35);
    const q = 1 - seg(t, b - 0.3, b);
    const vis = t >= a && t < b;
    e.style.display = vis ? '' : 'none';
    if (!vis) return;
    e.style.opacity = Math.min(p * 2, q);
    e.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${rot}deg) scale(${lerp(2.1, 1, E.out(p))})`;
  }

  function sceneRoot(root, seed) {
    const R = world(root, { seed });
    el('div', 'vignette', root);
    const flash = el('div', 'full', root, { zIndex: 8600, background: '#e7fbff', opacity: 0 });
    R.env.wind = 0.6;
    return { R, flash };
  }
  // depth 0 is the sunlit shallows, 1 is the abyss.
  function sea(R, depth) {
    const d = clamp(depth);
    // Night sky, so the frame stays under the water instead of opening onto a sunny horizon.
    R.env.tod = lerp(2.82, 3, d);
    R.env.sunAz = 2.4;
    R.env.moonAz = 4;
    R.env.clouds = 0;
    R.env.stars = 0;
    R.env.hazeColor = d < 0.55 ? '#1c6e86' : '#0c3044';
    R.env.tint = d < 0.45 ? '#b9d7ea' : '#7f97b4';
    R.env.mountains = { far: d < 0.55 ? '#1a6078' : '#102838', near: d < 0.55 ? '#14505c' : '#0c2830' };
    R.env.ground = d < 0.45 ? ['#2f6d68', '#163e3c'] : ['#12343c', '#0a1c22'];
    R.env.fogNear = lerp(1200, 700, d);
    R.env.fogFar = lerp(5600, 3400, d);
    R.env.fogMax = lerp(0.42, 0.62, d);
  }
  const at = (f, dur, lead = 0.6) => lead + f * Math.max(1, dur - lead - 0.9);

  // ---------------------------------------------------------------- scenes
  const scenes = [];

  scenes.push({
    id: 'open', min: 10, lead: 1.2,
    say: 'They say a city lies beneath the waves. A city of gold, and pearls, and secrets.',
    build(root) {
      const s = sceneRoot(root, 1);
      s.title = caption(root, '<div class="big">Atlantis Expedition</div>');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      const k = E.inOut(seg(t, 0, dur - 0.6));
      sea(R, lerp(0.02, 0.22, k));
      look(R, lerp(40, 0, k), lerp(640, 280, k), lerp(-1100, -80, k), 0, 70, lerp(1500, 800, k));
      R.begin(t);
      city(R, t, { shafts: 1 });
      sub(R, 'nautilus', lerp(420, 180, k), 150, lerp(1500, 1100, k), { t, dir: -1 });
      swimmer(R, lerp(-80, -160, k), 130, lerp(980, 780, k), { t, dir: 1 });
      R.end();
      s.title.e.style.top = '20%';
      s.title.show(t, dur - 4.2, dur + 1, 'pop');
    },
  });

  scenes.push({
    id: 'legend', min: 10,
    say: 'Atlantis. And at its heart, a crystal that has waited ten thousand years for someone brave enough to find it.',
    build: (root) => sceneRoot(root, 2),
    frame(t, dur, s) {
      const R = s.R;
      const k = E.inOut(seg(t, 0, dur));
      sea(R, lerp(0.18, 0.42, k));
      const [hx, hz] = HEART;
      look(R, lerp(-30, 20, k), lerp(340, 260, k), lerp(400, 2300, k), hx, lerp(120, 280, k), hz);
      R.begin(t);
      city(R, t, { shafts: lerp(0.8, 0.35, k) });
      swimmer(R, lerp(200, 40, k), 160, lerp(900, 2500, k), { t, dir: 1 });
      R.end();
    },
  });

  scenes.push({
    id: 'race', min: 10,
    say: 'Now two diving companies are racing to get there first. One of them... is yours.',
    build(root) {
      const s = sceneRoot(root, 3);
      s.tag = word(root, 'chip', '⚓ Your company <span style="opacity:.7">vs</span> 🔱 the rival');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      const k = E.inOut(seg(t, 0, dur));
      sea(R, 0.16);
      look(R, lerp(40, -20, k), 300, lerp(280, 480, k), 0, 120, 1200);
      const p = E.inOut(seg(t, 0.15, dur - 0.8));
      R.begin(t);
      city(R, t, { shafts: 0.85 });
      const yx = lerp(-520, 180, p);
      const rx = lerp(-240, 460, p);
      sub(R, 'nautilus', yx, 120, 1120, { t, h: 190 });
      sub(R, 'barracuda', rx, 150, 1280, { t: t + 1, h: 145 });
      tag(R, yx, 340, 1100, '⚓ Your company', { k: 1.2, ring: '#8ff0b4', op: seg(t, 0.8, 1.4) });
      tag(R, rx, 320, 1260, '🔱 The rival', { k: 1.1, ring: '#ff8a6b', op: seg(t, 1.1, 1.7) });
      R.end();
      slam(s.tag, t, dur * 0.55, dur + 1, W / 2, H * 0.86, -2);
    },
  });

  const CREW = [['rookie', 'Rookie'], ['wrangler', 'Shark wrangler'], ['caver', 'Cave diver'], ['lamplighter', 'Lamplighter'], ['archaeologist', 'Archaeologist'], ['veteran', 'Veteran'], ['krakenhunter', 'Kraken hunter'], ['captain', 'Captain']];
  scenes.push({
    id: 'crew', min: 13,
    say: 'Hire your crew. Rookies and veterans, shark wranglers and cave divers, lamplighters for the dark, and kraken hunters for... well, the kraken.',
    build: (root) => sceneRoot(root, 4),
    frame(t, dur, s) {
      const R = s.R;
      const k = E.inOut(seg(t, 0, dur));
      sea(R, 0.2);
      look(R, lerp(-160, 140, k), lerp(340, 280, k), 700, 0, 140, 1500);
      R.env.focus = 780;
      R.env.dof = 1.1;
      const order = [0, 5, 1, 2, 3, 4, 6, 7];
      const when = [0.06, 0.14, 0.26, 0.34, 0.46, 0.58, 0.7, 0.8].map((f) => at(f, dur));
      R.begin(t);
      city(R, t, { heart: false, shafts: 0.55 });
      swimmer(R, -20, 70, 1180, { t, h: 130 });
      CREW.forEach(([id, name], i) => {
        const kth = order.indexOf(i);
        const p = seg(t, when[kth], when[kth] + 0.55);
        if (p <= 0) return;
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = -400 + col * 260;
        const z = 1480 + row * 280;
        const y = 230 + Math.sin(t * 1.5 + i) * 10;
        R.bill(medal('diver-' + id, name), { x, y, z, h: 230, shadow: false, bias: 20, op: clamp(p * 2) });
      });
      R.end();
      R.env.focus = null;
    },
  });

  const FLEET = [['minnow', 'Minnow', 120], ['barracuda', 'Barracuda', 155], ['nautilus', 'Nautilus', 200], ['leviathan', 'Leviathan', 270]];
  scenes.push({
    id: 'fleet', min: 11,
    say: 'Build your fleet, from a little Minnow all the way up to the mighty Leviathan.',
    build: (root) => sceneRoot(root, 5),
    frame(t, dur, s) {
      const R = s.R;
      const k = E.inOut(seg(t, 0, dur));
      sea(R, 0.14);
      look(R, lerp(-30, 30, k), 300, 360, 0, 80, 1100);
      const step = (dur - 1.2) / FLEET.length;
      R.begin(t);
      city(R, t, { heart: false, shafts: 0.6 });
      FLEET.forEach(([id, name, h], i) => {
        const a = 0.2 + i * step;
        const p = seg(t, a, a + step * 1.35);
        if (p <= 0 || p >= 1) return;
        const x = lerp(-1200, 1300, E.inOut(p));
        sub(R, id, x, 90, 1080, { t, h });
        const near = clamp(seg(p, 0.25, 0.4)) * (1 - seg(p, 0.62, 0.78));
        tag(R, x, h + 150, 1000, name, { k: 1.3, op: near, bg: '#f2c14e', fg: '#08364a' });
      });
      R.end();
    },
  });

  // A site on the avenue: the sub arrives, the number is already known, the die is in the water.
  function siteCam(R, t, dur, depth) {
    const k = E.inOut(seg(t, 0, dur));
    sea(R, depth);
    look(R, lerp(360, 150, k), lerp(320, 240, k), lerp(820, 1020, k), -20, 80, 1520);
  }
  scenes.push({
    id: 'dive', min: 9,
    say: 'Pick a site, and you will always know the exact number you need. Then... roll the die.',
    build(root) {
      const s = sceneRoot(root, 6);
      s.need = word(root, 'chip', '🎲 You need 9 or higher');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      siteCam(R, t, dur, 0.22);
      const arr = E.out(seg(t, 0.2, 2.4));
      R.begin(t);
      city(R, t, { heart: false, shafts: 0.5 });
      R.bill(chest(), { x: 40, z: 1560, h: 130, shadowW: 0.4 });
      sub(R, 'nautilus', lerp(-700, -180, arr), 120, lerp(1900, 1480, arr), { t, dir: 1 });
      const out = E.out(seg(t, 2.2, 4.2));
      if (out > 0) swimmer(R, lerp(-40, 200, out), 90, lerp(1460, 1320, out), { t, h: 140 });
      if (t > dur - 2.2) showDie(R, 260, 150, 1360, t - (dur - 2.2), 4, 17, '#e0a020');
      R.end();
      slam(s.need, t, dur * 0.42, dur + 1, W * 0.62, 150, -2);
    },
  });

  scenes.push({
    id: 'roll', min: 6, lead: 1.1,
    say: 'Seventeen! The pearls are yours.',
    build(root) {
      const s = sceneRoot(root, 6);
      s.pow = word(root, 'pow', 'Pearls!');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      siteCam(R, t, dur, 0.22);
      R.begin(t);
      city(R, t, { heart: false, shafts: 0.45 });
      R.bill(chest(), { x: 40, z: 1560, h: 130, shadowW: 0.4 });
      sub(R, 'nautilus', -180, 120, 1480, { t });
      swimmer(R, 200, 90, 1320, { t, h: 140 });
      showDie(R, 260, 160, 1360, t + 0.15, 1.15, 17, '#e0a020');
      const burst = seg(t, 0.7, 0.9);
      if (burst > 0) {
        const r = rng(41);
        for (let i = 0; i < 18; i++) {
          const ang = r() * TAU;
          const sp = 70 + r() * 160;
          const q = seg(t, 0.75 + r() * 0.15, 2.6 + r() * 0.4);
          if (q <= 0) continue;
          pearlAt(R, 40 + Math.cos(ang) * sp * E.out(q), 80 + Math.sin(q * Math.PI) * 180, 1500 + Math.sin(ang) * 40, 10 + r() * 6, 1 - seg(q, 0.7, 1));
        }
      }
      R.end();
      slam(s.pow, t, 0.85, dur + 1, W * 0.7, H * 0.78, -6);
    },
  });

  const HAZ = [['🦈 Sharks', 0.08], ['🌀 Currents', 0.28], ['🌑 Darkness', 0.5], ['🏺 Ancient traps', 0.7]];
  scenes.push({
    id: 'danger', min: 12,
    say: 'But the deep is dangerous. Sharks. Currents. Darkness. Ancient traps. Every hazard your crew is not ready for makes the dive harder.',
    build(root) {
      const s = sceneRoot(root, 7);
      s.tags = HAZ.map(([txt]) => word(root, 'chip', txt));
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      const k = E.inOut(seg(t, 0, dur));
      const dark = clamp(seg(t, at(0.48, dur), at(0.56, dur))) * (1 - seg(t, at(0.68, dur), at(0.76, dur)));
      sea(R, lerp(0.28, 0.55, k) + dark * 0.3);
      R.env.fogMax = Math.min(0.8, R.env.fogMax + dark * 0.25);
      look(R, lerp(180, -40, k), lerp(300, 220, k), lerp(720, 960, k), 40, 70, 1450);
      R.begin(t);
      city(R, t, { heart: false, shafts: 0.5 * (1 - dark), fish: dark < 0.4 });
      const sp = seg(t, at(0.02, dur), at(0.28, dur));
      if (sp > 0 && sp < 1) shark(R, lerp(-700, 760, sp), 90, 1320, { t, h: 150, dir: 1 });
      const cur = clamp(seg(t, at(0.26, dur), at(0.34, dur))) * (1 - seg(t, at(0.46, dur), at(0.52, dur)));
      if (cur > 0) {
        for (let j = 0; j < 16; j++) {
          const a = (j / 16) * TAU * 1.4 + t * 2.4;
          const rad = 40 + j * 14;
          R.blob(Math.cos(a) * rad, 40 + (j % 4) * 20, 1500 + Math.sin(a) * rad * 0.4, 16, '#c8f4ff', 0.35 * cur);
        }
      }
      const trap = seg(t, at(0.68, dur), at(0.78, dur));
      if (trap > 0) {
        R.at(-430, 180, 1480, (g, p) => {
          g.strokeStyle = `rgba(255, 214, 110, ${0.9 * trap})`;
          g.lineWidth = 4 * p.s;
          for (let i = 0; i < 3; i++) {
            g.beginPath();
            g.moveTo(p.x - 30 * p.s, p.y + (i - 1) * 22 * p.s);
            g.lineTo(p.x, p.y + (i - 1) * 22 * p.s - 14 * p.s);
            g.lineTo(p.x + 30 * p.s, p.y + (i - 1) * 22 * p.s);
            g.stroke();
          }
        }, 15);
        R.light(-430, 180, 1470, 200, '#ffd36a', 0.45 * trap);
      }
      R.end();
      s.flash.style.background = '#02060e';
      s.flash.style.opacity = 0.55 * dark;
      HAZ.forEach(([, f], i) => slam(s.tags[i], t, at(f, dur), at(f + 0.2, dur), W * (0.3 + (i % 2) * 0.4), 150 + (i % 2) * 40, i % 2 ? 3 : -3));
    },
  });

  scenes.push({
    id: 'kraken', min: 7, lead: 1,
    say: 'And far below... something stirs.',
    build: (root) => sceneRoot(root, 8),
    frame(t, dur, s) {
      const R = s.R;
      const k = E.inOut(seg(t, 0, dur));
      sea(R, lerp(0.62, 0.95, k));
      R.env.fogMax = 0.5;
      const shake = t > dur - 2.2 ? Math.sin(t * 40) * 8 * (1 - seg(t, dur - 1.1, dur)) : 0;
      look(R, shake * 0.4, lerp(220, 170, k), lerp(1180, 1360, k), 50, 130, 1720);
      const rise = E.out(seg(t, 0.6, dur - 1.4));
      R.begin(t);
      city(R, t, { heart: false, shafts: 0.15 * (1 - k), bubbles: 0.7, fish: false });
      kraken(R, 60, 1680, t, rise);
      R.end();
      s.flash.style.opacity = 0.45 * seg(t, dur - 2.2, dur - 2.05) * (1 - seg(t, dur - 2.05, dur - 1.4));
    },
  });

  scenes.push({
    id: 'one', min: 6, lead: 1.1,
    say: 'Roll a one... and the Kraken keeps your sub.',
    build(root) {
      const s = sceneRoot(root, 9);
      s.pow = word(root, 'pow bad', 'A natural 1!');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      sea(R, 0.9);
      R.env.fogMax = 0.48;
      const shake = t > 1.1 && t < 2 ? Math.sin(t * 48) * 7 : 0;
      look(R, -140 + shake, 210, 980, 40, 120, 1620);
      const drag = E.in(seg(t, 1.3, 3.2));
      R.begin(t);
      city(R, t, { heart: false, shafts: 0, bubbles: 0.5, fish: false });
      kraken(R, 200, 1720, t, 1);
      sub(R, 'nautilus', lerp(-40, 280, drag), lerp(130, 40, drag), lerp(1400, 1680, drag), { t, op: 1 - seg(t, 2.6, 3.4), rot: drag * 18, lamp: 0.5 * (1 - drag) });
      showDie(R, -260, 170, 1240, t, 1.15, 1, '#d04545');
      R.end();
      slam(s.pow, t, 1.05, dur + 1, W * 0.32, H * 0.78, 5);
    },
  });

  const SEAS = [['⛈️', 'Storm'], ['🦈', 'Feeding frenzy'], ['🗺️', 'Treasure rumors'], ['🐙', 'The Kraken stirs'], ['🥂', 'Sponsors’ gala']];
  const STONE = (i) => [-80 + Math.sin(i * 0.7) * 90, 500 + i * 240];
  scenes.push({
    id: 'tides', min: 12,
    say: 'Ten tides. Every tide the sea changes: storms, shark frenzies, rumours of treasure. Plan ahead, because your rival is planning too.',
    build(root) {
      const s = sceneRoot(root, 10);
      s.sea = word(root, 'pow', '');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      const n = Math.min(10, Math.floor(seg(t, 0.3, dur - 1.4) * 10.99));
      const [fx, fz] = STONE(Math.max(0, n - 1));
      sea(R, 0.34);
      look(R, fx + 180, 340, fz - 280, fx, 20, fz + 220);
      R.begin(t);
      city(R, t, { shafts: 0.4, bubbles: 0.6 });
      for (let i = 0; i < 10; i++) {
        const [x, z] = STONE(i);
        const on = i < n;
        const heart = i === 5;
        R.disc(x, z, heart ? 70 : 48, heart ? 48 : 32, on ? (heart ? '#9aecff' : '#f2c14e') : '#9a907c', on ? '#fff6d0' : '#5c5140', 3, 2);
        tag(R, x, heart ? 90 : 40, z, heart ? '6 · Heart' : String(i + 1), { k: heart ? 1.15 : 0.85, op: 0.95, bg: on ? (heart ? '#d8fbff' : '#f2c14e') : 'rgba(4,30,46,0.82)', fg: on ? '#08364a' : '#e9fbff' });
        if (on && heart) R.light(x, 40, z, 180, '#bff6ff', 0.4);
      }
      R.end();
      const per = (dur - 1.6) / SEAS.length;
      const i = clamp(Math.floor((t - 0.4) / per), 0, SEAS.length - 1);
      const lt = t - 0.4 - i * per;
      s.sea.innerHTML = `${SEAS[i][0]} ${SEAS[i][1]}`;
      slam(s.sea, t, 0.4 + i * per, 0.4 + (i + 1) * per + (i === SEAS.length - 1 ? 2 : 0), W / 2, 120, i % 2 ? 3 : -3);
      if (lt < 0) s.sea.style.display = 'none';
    },
  });

  scenes.push({
    id: 'heart', min: 11,
    say: 'Hire well. Dive smart. Roll high. And claim the Heart of Atlantis.',
    build: (root) => sceneRoot(root, 11),
    frame(t, dur, s) {
      const R = s.R;
      const k = E.inOut(seg(t, 0, dur - 1.6));
      sea(R, lerp(0.5, 0.22, k));
      const [hx, hz] = HEART;
      look(R, lerp(-220, 10, k), lerp(520, 360, k), lerp(2500, 3120, k), hx, lerp(140, 300, k), hz);
      R.begin(t);
      city(R, t, { shafts: lerp(0.2, 0.9, k) });
      sub(R, 'leviathan', lerp(-500, -180, k), 80, hz - 520, { t, dir: 1 });
      swimmer(R, lerp(-360, -200, k), 150, hz - 340, { t });
      const rain = seg(t, dur - 4.5, dur - 3.6);
      if (rain > 0) {
        const r = rng(77);
        for (let i = 0; i < 24; i++) {
          const y = 700 - ((t * (80 + r() * 60) + r() * 700) % 700);
          pearlAt(R, hx + (r() - 0.5) * 500, y, hz + (r() - 0.5) * 200, 8 + r() * 5, rain);
        }
      }
      R.end();
      s.flash.style.background = '#fffbe8';
      s.flash.style.opacity = E.in(seg(t, dur - 1.6, dur)) * 0.92;
    },
  });

  scenes.push({
    id: 'end', min: 9, tail: 2.4,
    say: 'Atlantis Expedition. Coming soon, to Ahrens Labs.',
    build(root) {
      const s = sceneRoot(root, 12);
      s.title = caption(root, '<div class="big">Atlantis Expedition</div><div class="sub">A treasure-diving board game</div><div class="pill">Coming soon to ahrenslabs.com</div>');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      sea(R, 0.3);
      const a = t * 0.07;
      const [hx, hz] = HEART;
      look(R, hx + Math.sin(a) * 980, 640, hz - Math.cos(a) * 980, hx, 160, hz);
      R.begin(t);
      city(R, t, { shafts: 0.7 });
      sub(R, 'leviathan', -220, 90, hz - 480, { t });
      swimmer(R, 160, 180, hz - 260, { t: t + 1, dir: -1 });
      R.end();
      R.cv.style.filter = 'blur(2px) brightness(0.72)';
      s.title.show(t, 0.3, dur + 2);
    },
  });

  runAd(scenes);
})();
