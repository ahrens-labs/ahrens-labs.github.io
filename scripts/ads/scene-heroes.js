// Hero League ad: a superhero movie trailer in a 3D city plaza, with full-body cut-outs of the game's heroes,
// the cards themselves flying through the scene, and comic-book captions.
(function () {
  const { W, H, clamp, lerp, seg, E, rng, el, img, caption, runAd } = AD;
  const { world, prop } = AD3;
  const X = (n) => `sprites/hx/${n}.png`;
  const TAU = Math.PI * 2;
  const SUIT = {
    bruiser: ['💪', '#d9473f'], speed: ['⚡', '#e0a514'], tech: ['🔧', '#3b7fd6'], mystic: ['🔮', '#9b59d0'], cosmic: ['🌌', '#4b4fc7'],
    shadow: ['🌑', '#4a5263'], element: ['🔥', '#e8742a'], sidekick: ['⭐', '#3fa860'], gear: ['🛡️', '#a07a3c'], villain: ['💀', '#8c1c3a'],
  };
  const CARD = {
    ironclad: ['Ironclad', 'bruiser', 18], valora: ['Valora', 'bruiser', 20], blur: ['Blur', 'speed', 13], sable: ['Sorcerer Sable', 'mystic', 22],
    mirra: ['Mirra', 'mystic', 1], starbolt: ['Starbolt', 'cosmic', 25], nova: ['Nova', 'cosmic', 14], nightshade: ['Nightshade', 'shadow', 15],
    cinder: ['Cinder', 'element', 15], scout: ['Scout', 'sidekick', 10], hammer: ['Star Hammer', 'gear', 1], kaos: ['Kaos', 'villain', 40],
    crusher: ['The Crusher', 'villain', 30], firewall: ['Firewall', 'tech', 8], mecha: ['Mecha-Max', 'tech', 26], prism: ['Prism', 'cosmic', 8],
    gale: ['Gale', 'element', 12], tess: ['Tess', 'sidekick', 9], cape: ['Cape of Ages', 'gear', 21], whisper: ['Whisper', 'shadow', 11],
  };
  const TALL = { crusher: 255, mecha: 240, ironclad: 225, kaos: 225, scout: 178, blur: 196 };

  const style = el('style', '', document.head);
  style.textContent = `
    .title .big { -webkit-text-stroke: 3px rgba(30, 10, 60, 0.7); text-shadow: 0 6px 0 rgba(40, 12, 70, 0.95), 0 14px 34px rgba(0, 0, 0, 0.6), 0 0 40px rgba(255, 200, 80, 0.35); }
    .title .mid { text-shadow: 0 5px 0 rgba(40, 12, 70, 0.9), 0 12px 26px rgba(0, 0, 0, 0.55); }
    .title .pill { background: #ffd24d; color: #3a1d00; }
    .pow { position: absolute; left: 0; top: 0; z-index: 8700; white-space: nowrap; transform-origin: 50% 50%;
      font: 78px/1 "Lilita One", sans-serif; color: #ffe14d; -webkit-text-stroke: 3px #2a0d3d; letter-spacing: 0.02em;
      text-shadow: 0 6px 0 #2a0d3d, 0 14px 30px rgba(0, 0, 0, 0.55); }
    .chip { position: absolute; left: 0; top: 0; z-index: 8700; white-space: nowrap; padding: 12px 26px; border-radius: 18px; transform-origin: 50% 50%;
      background: rgba(22, 10, 48, 0.86); color: #fff; font: 38px/1 "Lilita One", sans-serif; box-shadow: 0 0 0 3px rgba(255, 210, 77, 0.8), 0 12px 30px rgba(0, 0, 0, 0.5); }
    .chip.good { box-shadow: 0 0 0 3px #6fe08f, 0 12px 30px rgba(0, 0, 0, 0.5); }
    .chip.bad { box-shadow: 0 0 0 3px #ff6b5e, 0 12px 30px rgba(0, 0, 0, 0.5); }
    .ident { position: absolute; left: 50%; top: 46%; z-index: 8700; width: 420px; height: 300px; margin: -150px 0 0 -210px; border-radius: 22px; transform-origin: 50% 50%;
      background: linear-gradient(160deg, #3a2470, #1c0f3c); box-shadow: 0 0 0 4px #ffd24d, 0 18px 40px rgba(0, 0, 0, 0.6), 0 0 80px rgba(160, 110, 255, 0.45); text-align: center; color: #fff; }
    .ident .ic { margin-top: 26px; font-size: 96px; line-height: 1; }
    .ident .nm { margin-top: 12px; font: 50px/1 "Lilita One", sans-serif; }
    .ident .rule { margin-top: 12px; font: 600 28px/1.2 Fredoka, sans-serif; color: #ffe9a8; }
    .ident .stamp { position: absolute; right: -36px; top: -26px; padding: 8px 18px; border: 5px solid #ff4b4b; border-radius: 10px; color: #ff4b4b; background: rgba(255, 255, 255, 0.9);
      font: 34px/1 "Lilita One", sans-serif; transform: rotate(12deg); letter-spacing: 0.04em; }`;

  // ---------------------------------------------------------------- props
  // A lit skyscraper, drawn once per seed.
  function skyscraper(seed) {
    return prop(`sky${seed}`, 260, 1000, (g, w, h) => {
      const r = rng(seed * 13 + 5);
      const bw = 130 + r() * 110;
      const x0 = (w - bw) / 2;
      const top = 40 + r() * 200;
      const body = ['#2b3358', '#31406a', '#3a2f5e', '#283a52', '#41365f'][seed % 5];
      const gr = g.createLinearGradient(x0, 0, x0 + bw, 0);
      gr.addColorStop(0, body);
      gr.addColorStop(0.6, '#5b6390');
      gr.addColorStop(1, body);
      g.fillStyle = gr;
      g.fillRect(x0, top, bw, h - top);
      if (r() < 0.5) {
        g.fillRect(x0 + bw * 0.2, top - 60, bw * 0.6, 60);
        g.fillStyle = '#9aa3d0';
        g.fillRect(w / 2 - 3, top - 170, 6, 110);
        g.fillStyle = '#ff5a5a';
        g.beginPath();
        g.arc(w / 2, top - 172, 7, 0, TAU);
        g.fill();
      }
      const cols = Math.floor(bw / 24);
      for (let y = top + 22; y < h - 20; y += 30) {
        for (let i = 0; i < cols; i++) {
          const lit = r();
          g.fillStyle = lit < 0.42 ? ['#ffd98a', '#ffe9b8', '#9fd8ff'][Math.floor(r() * 3)] : 'rgba(10,14,40,0.55)';
          g.fillRect(x0 + 8 + i * 24, y, 12, 16);
        }
      }
    });
  }
  // A playing card, drawn from the game's art once that art has loaded.
  const CARDS = {};
  function cardProp(id) {
    if (CARDS[id]) return CARDS[id];
    const im = img(X(id));
    const c = document.createElement('canvas');
    c.width = 360;
    c.height = 504;
    const g = c.getContext('2d');
    const [name, suit, power] = CARD[id];
    const col = SUIT[suit][1];
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.roundRect(0, 0, 360, 504, 32);
    g.fill();
    const gr = g.createLinearGradient(0, 0, 360, 504);
    gr.addColorStop(0, AD3.mix(col, '#ffffff', 0.25));
    gr.addColorStop(0.5, col);
    gr.addColorStop(1, AD3.mix(col, '#000000', 0.3));
    g.fillStyle = gr;
    g.beginPath();
    g.roundRect(9, 9, 342, 486, 26);
    g.fill();
    const ok = im.complete && im.naturalWidth;
    if (ok) {
      g.save();
      g.beginPath();
      g.roundRect(24, 24, 312, 312, 18);
      g.clip();
      g.drawImage(im, 24, 24, 312, 312);
      g.restore();
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let fs = 44;
    g.font = `${fs}px "Lilita One"`;
    while (g.measureText(name).width > 310 && fs > 20) g.font = `${(fs -= 2)}px "Lilita One"`;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillText(name, 180, 412);
    g.fillStyle = '#ffffff';
    g.fillText(name, 180, 408);
    g.fillStyle = '#ffd24d';
    g.strokeStyle = '#ffffff';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(56, 56, 40, 0, TAU);
    g.fill();
    g.stroke();
    g.fillStyle = '#3a1d00';
    g.font = '44px "Lilita One"';
    g.fillText(String(power), 56, 59);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(308, 52, 32, 0, TAU);
    g.fill();
    g.font = '34px sans-serif';
    g.fillText(SUIT[suit][0], 308, 55);
    if (ok && document.fonts.check('44px "Lilita One"')) CARDS[id] = c;
    return c;
  }
  const back = () => prop('cardback', 360, 504, (g) => {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.roundRect(0, 0, 360, 504, 32);
    g.fill();
    g.save();
    g.beginPath();
    g.roundRect(9, 9, 342, 486, 26);
    g.clip();
    for (let i = -20; i < 40; i++) {
      g.fillStyle = i % 2 ? '#2b1d6e' : '#34248a';
      g.beginPath();
      g.moveTo(i * 28, 0);
      g.lineTo(i * 28 + 28, 0);
      g.lineTo(i * 28 + 28 - 504, 504);
      g.lineTo(i * 28 - 504, 504);
      g.fill();
    }
    g.restore();
    g.fillStyle = '#ffd24d';
    g.font = '150px "Lilita One"';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('★', 180, 262);
  });

  // ---------------------------------------------------------------- the city
  const r0 = rng(31);
  const TOWERS = [];
  for (let i = 0; i < 140; i++) {
    const a = r0() * TAU;
    const rad = 1700 + r0() * 3600;
    const x = Math.sin(a) * rad * 1.15;
    const z = 650 + Math.cos(a) * rad;
    // Leave the avenue the camera flies down clear.
    if (Math.abs(x) < 900 && z < 600) continue;
    TOWERS.push([x, z, i % 23, 900 + r0() * 2100]);
  }
  const SPIRES = [[-1500, 2700, 2900], [1800, 2500, 2600], [300, 3900, 3400], [-2700, 1300, 2400], [2600, 900, 2500]];
  const LIGHTS = [[-620, 250], [620, 250], [-760, 900], [760, 900], [-300, 1500], [300, 1500]];

  function lamp(R, x, z, night) {
    R.at(x, 0, z, (g, p) => {
      const s = p.s;
      g.fillStyle = '#2a2d44';
      g.fillRect(p.x - 4 * s, p.y - 210 * s, 8 * s, 210 * s);
      g.beginPath();
      g.ellipse(p.x, p.y - 214 * s, 18 * s, 10 * s, 0, 0, TAU);
      g.fillStyle = '#fff1c4';
      g.fill();
    });
    R.light(x, 205, z, 260, '#ffd27a', 0.25 + 0.2 * night);
  }

  function city(R, t, o = {}) {
    const night = o.night || 0;
    R.decal([[-260, -4000], [260, -4000], [260, 120], [-260, 120]], '#3a3d52');
    R.decal([[-4000, 1900], [4000, 1900], [4000, 2300], [-4000, 2300]], '#3a3d52');
    for (let i = 0; i < 18; i++) R.decal([[-12, -3800 + i * 220], [12, -3800 + i * 220], [12, -3700 + i * 220], [-12, -3700 + i * 220]], '#d9cf8a');
    R.disc(0, 650, 820, 600, '#5d6283', '#8d93b8', 4);
    R.disc(0, 650, 640, 470, '#666b8e', '#9da3c8', 3);
    R.disc(0, 650, 360, 260, '#7076a0', '#b1b7da', 3);
    if (o.fountain !== false) {
      R.bill(X('full-fountain'), { x: 0, z: 1250, h: 330, shadowW: 0.4 });
      for (let j = 0; j < 8; j++) {
        const q = (t * 0.7 + j / 8) % 1;
        R.blob((j % 2 ? 1 : -1) * (60 + q * 90), 300 - q * 200, 1240, 14 + q * 18, '#cfe8ff', 0.35 * (1 - q));
      }
    }
    TOWERS.forEach(([x, z, s, h]) => R.bill(skyscraper(s), { x, z, h, shadow: false }));
    SPIRES.forEach(([x, z, h]) => R.bill(X('full-tower'), { x, z, h, shadow: false }));
    if (o.lamps !== false) LIGHTS.forEach(([x, z]) => lamp(R, x, z, night));
  }

  function look(R, x, y, z, tx, ty, tz) {
    Object.assign(R.cam, { x, y, z });
    const dx = tx - x;
    const dz = tz - z;
    R.cam.yaw = Math.atan2(dx, dz);
    R.cam.pitch = Math.atan2(y - ty, Math.hypot(dx, dz));
  }

  function hero(R, id, x, z, o = {}) {
    const t = o.t || 0;
    const h = o.h || TALL[id] || 205;
    R.bill(X('full-' + id), {
      x, y: o.y || 0, z, h, dir: o.dir || 1, lift: o.lift || 0, op: o.op, flash: o.flash, flashColor: o.flashColor, bias: o.bias,
      rot: (o.rot || 0) + Math.sin(t * 1.3 + x) * 0.8, sy: 1 + 0.015 * Math.sin(t * 2.2 + x), sx: o.sx || 1, shadowW: 0.3, shadow: o.y ? false : undefined,
    });
  }
  function card(R, id, x, y, z, o = {}) {
    R.bill(id === 'back' ? back() : cardProp(id), { x, y, z, h: o.h || 170, sx: o.sx == null ? 1 : o.sx, rot: o.rot || 0, op: o.op, shadow: false, bias: o.bias || 0, flash: o.flash, flashColor: o.flashColor });
  }
  // A name tag floating in the world, always in front of what is around it.
  function tag(R, x, y, z, text, o = {}) {
    R.at(x, y, z, (g, p) => {
      const s = clamp(p.s * (o.k || 1), 0.4, 1.25);
      g.globalAlpha = o.op == null ? 1 : o.op;
      g.font = `${Math.round(28 * s)}px "Lilita One"`;
      const w = g.measureText(text).width + 30 * s;
      const hh = 44 * s;
      g.fillStyle = o.bg || 'rgba(255,246,226,0.96)';
      g.beginPath();
      g.roundRect(p.x - w / 2, p.y - hh / 2, w, hh, hh / 2);
      g.fill();
      g.fillStyle = o.fg || '#2a0d3d';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, p.x, p.y + 1.5 * s);
    }, o.bias == null ? 60 : o.bias);
  }
  // An energy beam between two world points.
  function beam(R, a, b, col, w, alpha, k = 1) {
    const pa = R.project(a[0], a[1], a[2]);
    const pb0 = R.project(b[0], b[1], b[2]);
    if (!pa || !pb0 || alpha <= 0) return;
    const pb = { x: lerp(pa.x, pb0.x, k), y: lerp(pa.y, pb0.y, k) };
    R.add(Math.min(pa.d, pb0.d) - 40, () => {
      const g = R.g;
      g.globalCompositeOperation = 'lighter';
      g.lineCap = 'round';
      g.globalAlpha = alpha;
      [[w * 2.2, col], [w, col], [w * 0.4, '#ffffff']].forEach(([lw, c]) => {
        g.strokeStyle = c;
        g.lineWidth = lw * pa.s;
        g.beginPath();
        g.moveTo(pa.x, pa.y);
        g.lineTo(pb.x, pb.y);
        g.stroke();
      });
    });
  }
  // A searchlight sweeping the sky behind everything.
  function skybeam(R, x, z, t, ph, a = 1) {
    const base = R.project(x, 150, z);
    const tipx = x + Math.sin(t * 0.35 + ph) * 2800;
    const tip = R.project(tipx, 5200, z + 3500);
    if (!base || !tip) return;
    R.add(20000, () => {
      const g = R.g;
      const dx = tip.x - base.x;
      const dy = tip.y - base.y;
      const L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L;
      const ny = dx / L;
      const gr = g.createLinearGradient(base.x, base.y, tip.x, tip.y);
      gr.addColorStop(0, `rgba(230,240,255,${0.45 * a})`);
      gr.addColorStop(1, 'rgba(230,240,255,0)');
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(base.x + nx * 6, base.y + ny * 6);
      g.lineTo(base.x - nx * 6, base.y - ny * 6);
      g.lineTo(tip.x - nx * 160, tip.y - ny * 160);
      g.lineTo(tip.x + nx * 160, tip.y + ny * 160);
      g.closePath();
      g.fill();
    });
  }
  // Glittering sparks rising around a point.
  function sparks(R, x, y, z, t, col, n = 14, a = 1, rad = 90) {
    for (let j = 0; j < n; j++) {
      const q = (t * 0.9 + j / n) % 1;
      const ang = j * 2.4;
      R.blob(x + Math.cos(ang + t) * rad * (0.4 + q), y + q * 220, z + Math.sin(ang + t) * rad * 0.5, 7 + 5 * (1 - q), col, a * (1 - q));
    }
  }
  function pillar(R, x, z, w, h, col) {
    const c = R.project(x, h / 2, z);
    if (!c || h <= 0) return;
    const d = w / 2;
    R.add(c.d + w, () => {
      if (R.cam.x < x - d) R.poly([[x - d, 0, z + d], [x - d, 0, z - d], [x - d, h, z - d], [x - d, h, z + d]], AD3.mix(col, '#000000', 0.35));
      if (R.cam.x > x + d) R.poly([[x + d, 0, z - d], [x + d, 0, z + d], [x + d, h, z + d], [x + d, h, z - d]], AD3.mix(col, '#000000', 0.35));
      R.poly([[x - d, 0, z - d], [x + d, 0, z - d], [x + d, h, z - d], [x - d, h, z - d]], col, AD3.mix(col, '#ffffff', 0.4), 2);
      R.poly([[x - d, h, z - d], [x + d, h, z - d], [x + d, h, z + d], [x - d, h, z + d]], AD3.mix(col, '#ffffff', 0.3));
    });
  }

  function word(root, cls, html) {
    const e = el('div', cls, root);
    e.innerHTML = html;
    return e;
  }
  // A comic "POW" that slams in at `a` and leaves at `b`.
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
    const flash = el('div', 'full', root, { zIndex: 8600, background: '#fff6d8', opacity: 0 });
    R.env.ground = ['#4b5070', '#33364c'];
    R.env.mountains = false;
    R.env.fogNear = 2200;
    R.env.fogFar = 8000;
    R.env.fogMax = 0.55;
    R.env.wind = 3;
    return { R, flash };
  }
  const dusk = (R, k = 0) => {
    R.env.tod = lerp(2.25, 2.6, k);
    R.env.sunAz = 0.2;
    R.env.tint = '#eadcf0';
  };
  const night = (R) => {
    R.env.tod = 3;
    R.env.moonAz = 0.35;
    R.env.tint = '#b4bbea';
  };
  const at = (f, dur, lead = 0.6) => lead + f * Math.max(1, dur - lead - 0.9);

  // ---------------------------------------------------------------- scenes
  const LINEUP = [['scout', -420, 520], ['mecha', -270, 560], ['starbolt', -100, 500], ['valora', 70, 480], ['sable', 240, 540], ['nightshade', 400, 520]];
  const scenes = [];

  scenes.push({
    id: 'open', min: 8, lead: 1.2,
    say: 'When the city is in trouble, one hero is never enough. You need a league.',
    build(root) {
      const s = sceneRoot(root, 1);
      s.title = caption(root, '<div class="big">Hero League</div>');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      const k = E.inOut(seg(t, 0, dur - 0.8));
      dusk(R, k);
      look(R, lerp(-200, 0, k), lerp(1700, 120, k), lerp(-2600, -360, k), 0, lerp(400, 190, k), lerp(1400, 600, k));
      R.begin(t);
      city(R, t, {});
      skybeam(R, -900, 1700, t, 0);
      skybeam(R, 1100, 1900, t, 2.2);
      LINEUP.forEach(([id, x, z], i) => hero(R, id, x, z, { t: t + i }));
      R.end();
      s.title.e.style.top = '24%';
      s.title.show(t, dur - 3.4, dur + 1, 'pop');
    },
  });

  const TEAM = [['starbolt', 'Starbolt'], ['ironclad', 'Ironclad'], ['blur', 'Blur'], ['sable', 'Sorcerer Sable'], ['scout', 'Scout'], ['mecha', 'Mecha-Max'], ['kaos', 'Kaos']];
  const TEAM_AT = [0.1, 0.38, 0.46, 0.54, 0.62, 0.71, 0.86];
  scenes.push({
    id: 'recruit', min: 11,
    say: 'Build a team of seven, from seventy-five heroes. Bruisers and speedsters, mystics and sidekicks, gadgets... and even a villain or two.',
    build: (root) => sceneRoot(root, 2),
    frame(t, dur, s) {
      const R = s.R;
      dusk(R, 0.3);
      const xs = TEAM.map((_, i) => -900 + i * 300);
      const ts = TEAM_AT.map((f) => at(f, dur));
      // The camera trucks along the line, arriving at each hero as they're named.
      let tx = xs[0];
      for (let i = 0; i < ts.length - 1; i++) if (t >= ts[i]) tx = lerp(xs[i], xs[i + 1], E.inOut(seg(t, ts[i + 1] - 0.9, ts[i + 1])));
      if (t < ts[0]) tx = lerp(xs[0] - 300, xs[0], E.out(seg(t, 0, ts[0])));
      R.env.focus = 520;
      R.env.dof = 1.6;
      look(R, tx - 160, 175, -60, tx + 30, 135, 460);
      R.begin(t);
      city(R, t, { fountain: false });
      TEAM.forEach(([id, name], i) => {
        const a = ts[i];
        const p = seg(t, a - 0.25, a + 0.35);
        if (p <= 0) return;
        const x = xs[i];
        const z = 430 + (i % 2) * 40;
        const v = id === 'kaos';
        hero(R, id, x, z, { t: t + i, op: clamp(p * 2), flash: 1 - p, flashColor: v ? '#ff3b3b' : '#ffffff', lift: (1 - E.out(p)) * 60 });
        R.light(x, 120, z - 30, 260, v ? '#ff3b3b' : '#ffd27a', 0.5 * (1 - seg(t, a, a + 1.5)) + (v ? 0.25 : 0));
        if (v) beam(R, [x - 70 + Math.sin(t * 30) * 20, 900, z], [x - 60, 190, z], '#ff4a4a', 10, Math.sin(t * 25) > 0.2 ? 0.8 * (1 - seg(t, a + 0.5, a + 1)) : 0);
        tag(R, x, -6, z - 60, name, { op: clamp(seg(t, a, a + 0.4)) });
      });
      R.end();
      R.env.focus = null;
    },
  });

  const PLAZA = ['cinder', 'nova', 'scout', 'mecha'];
  scenes.push({
    id: 'plaza', min: 9,
    say: 'Every turn, draw a hero, then send one to the Plaza... where any rival can snap it up.',
    build(root) {
      const s = sceneRoot(root, 3);
      s.rival = word(root, 'chip bad', '😈 A rival grabs it!');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      dusk(R, 0.5);
      const k = E.inOut(seg(t, 0, dur));
      look(R, lerp(-120, 80, k), lerp(230, 200, k), lerp(-260, -120, k), 60, 140, 700);
      R.begin(t);
      city(R, t, {});
      tag(R, 0, 330, 720, '🏙️ The Plaza', { k: 1.5 });
      const sx = (i) => -400 + i * 200;
      PLAZA.forEach((id, i) => card(R, id, sx(i), 40, 720, { rot: (i % 2 ? 2 : -2) }));
      for (let i = 0; i < 5; i++) R.disc(sx(i), 720, 80, 30, 'rgba(255,214,90,0.25)', 'rgba(255,214,90,0.7)', 2);
      // Draw: a card spins in from the deck and turns over.
      const d = E.inOut(seg(t, at(0.04, dur), at(0.04, dur) + 0.8));
      const flip = seg(t, at(0.2, dur), at(0.2, dur) + 0.45);
      const sq = Math.abs(Math.cos(flip * Math.PI));
      const up = E.inOut(seg(t, at(0.42, dur), at(0.42, dur) + 0.9));
      const grab = seg(t, at(0.78, dur), at(0.78, dur) + 1.1);
      const hold = [lerp(lerp(700, 40, d), sx(4), up), lerp(lerp(500, 70, d), 40, up), lerp(lerp(300, 140, d), 720, up)];
      if (d > 0 && grab < 0.45) {
        const id = flip < 0.5 ? 'back' : 'blur';
        card(R, id, hold[0], hold[1] + Math.sin(up * Math.PI) * 140, hold[2], { sx: sq, rot: lerp(30, 0, d) + Math.sin(up * Math.PI) * 10, h: lerp(150, 170, up), bias: 20 });
      }
      // ...and a rival dashes through and takes it.
      if (grab > 0) {
        const bx = lerp(1200, -1300, grab);
        hero(R, 'nightshade', bx, 640, { t, dir: -1, rot: -8, lift: Math.abs(Math.sin(t * 14)) * 10 });
        if (grab >= 0.45) card(R, 'blur', bx - 40, 120, 630, { rot: -14, h: 120, bias: 10 });
        for (let j = 0; j < 8; j++) R.blob(bx + 60 + j * 40, 60 + (j % 3) * 30, 650, 26, '#b08cff', 0.35 * (1 - j / 8));
      }
      R.end();
      slam(s.rival, t, at(0.8, dur), dur + 1, W * 0.5, 620, -4);
    },
  });

  scenes.push({
    id: 'tricks', min: 14,
    say: 'Every hero has a trick. Valora powers up with the Star Hammer. Starbolt wipes out shadows. Firewall shields your team... and Mirra copies the mightiest hero in the room.',
    build(root) {
      const s = sceneRoot(root, 4);
      s.pows = ['POWER UP!', 'BLANKED!', 'SHIELDED!', 'COPIED!'].map((w) => word(root, 'pow', w));
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      dusk(R, 0.8);
      const win = [[0, 0.15], [0.15, 0.43], [0.43, 0.58], [0.58, 0.71], [0.71, 1.3]].map(([a, b]) => [a ? at(a, dur) : 0, b > 1 ? dur + 1 : at(b, dur)]);
      const beat = win.findIndex(([a, b]) => t >= a && t < b);
      const [ba, bb] = win[Math.max(0, beat)];
      const lt = t - ba;
      const bk = seg(t, ba, bb);
      // Where each pair stands, and where the camera looks from for its beat.
      const SPOT = [null, [-520, 520], [180, 520], [-260, 980], [420, 1020]];
      if (beat <= 0) look(R, lerp(-100, 100, bk), lerp(320, 260, bk), -520, 0, 130, 760);
      else {
        const [cx, cz] = SPOT[beat];
        look(R, cx + lerp(-120, 60, bk), lerp(190, 165, bk), cz - lerp(470, 400, bk), cx + 60, 150, cz);
        R.env.focus = 430;
        R.env.dof = 1.3;
      }
      R.begin(t);
      city(R, t, {});
      const hit = (i) => win[i][0] + (win[i][1] - win[i][0]) * 0.38;
      // Valora and the Star Hammer.
      const v = seg(t, hit(1), hit(1) + 0.3);
      hero(R, 'valora', -520, 520, { t, flash: v * 0.35 * (1 - seg(t, hit(1) + 0.6, hit(1) + 1.6)), flashColor: '#ffe27a' });
      if (beat === 1 && v > 0) {
        beam(R, [-560 + Math.sin(t * 40) * 30, 1400, 520], [-575, 205, 515], '#ffe27a', 12, Math.sin(t * 30) > -0.2 ? 0.9 * (1 - seg(t, hit(1) + 0.4, hit(1) + 0.9)) : 0);
        R.light(-570, 200, 500, 420, '#ffd24d', 0.6);
        sparks(R, -520, 40, 500, t, '#ffd24d', 18, 0.9);
      }
      // Starbolt blanks Nightshade.
      const b = seg(t, hit(2), hit(2) + 0.6);
      hero(R, 'starbolt', 120, 520, { t });
      hero(R, 'nightshade', 360, 560, { t, dir: -1, flash: b * 0.85, flashColor: '#7a7f8c', op: 1 - 0.5 * seg(t, hit(2) + 0.8, hit(2) + 1.6) });
      if (beat === 2 && t > hit(2) - 0.3) {
        beam(R, [65, 175, 515], [350, 130, 555], '#ffe9a0', 16, 1 - seg(t, hit(2) + 0.5, hit(2) + 0.9), E.out(seg(t, hit(2) - 0.3, hit(2))));
        R.light(65, 175, 510, 300, '#fff1b0', 0.6);
      }
      // Firewall's shield turns the Crusher away.
      const c = seg(t, win[3][0], hit(3));
      const bounce = E.out(seg(t, hit(3), hit(3) + 0.6));
      const crx = lerp(lerp(500, -60, E.in(c)), 200, bounce);
      hero(R, 'firewall', -300, 980, { t });
      hero(R, 'crusher', crx, 1000, { t, dir: -1, op: 1 - seg(t, win[3][1] - 0.2, win[3][1] + 0.2), rot: c > 0 && c < 1 ? -6 : bounce > 0 && bounce < 1 ? 10 : 0, lift: c < 1 ? Math.abs(Math.sin(t * 12)) * 8 * c : 0 });
      if (beat === 3) {
        const sh = 0.35 + 0.65 * Math.max(seg(t, hit(3) - 0.1, hit(3)) * (1 - seg(t, hit(3) + 0.2, hit(3) + 0.8)), 0.4);
        R.at(-300, 120, 960, (g, p) => {
          g.globalCompositeOperation = 'lighter';
          g.strokeStyle = `rgba(140,220,255,${sh})`;
          g.fillStyle = `rgba(90,180,255,${0.12 * sh})`;
          g.lineWidth = 5 * p.s;
          g.beginPath();
          g.ellipse(p.x, p.y, 150 * p.s, 190 * p.s, 0, 0, TAU);
          g.fill();
          g.stroke();
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU + t;
            g.beginPath();
            g.moveTo(p.x, p.y);
            g.lineTo(p.x + Math.cos(a) * 150 * p.s, p.y + Math.sin(a) * 190 * p.s);
            g.stroke();
          }
        }, -30);
        R.light(-300, 120, 950, 300, '#7fd0ff', 0.4 * sh);
      }
      // Mirra copies Kaos.
      const m = seg(t, hit(4), hit(4) + 0.8);
      hero(R, 'mirra', 300, 1020, { t });
      hero(R, 'kaos', 650, 1080, { t, dir: -1 });
      if (m > 0) {
        hero(R, 'kaos', 470, 950, { t: t + 2, op: 0.75 * m, flash: 0.45, flashColor: '#c79bff', lift: (1 - m) * 40, h: 205 });
        beam(R, [235, 195, 1015], [470, 150, 950], '#c79bff', 8, 0.7 * (1 - seg(t, hit(4) + 0.6, hit(4) + 1.2)), E.out(seg(t, hit(4) - 0.2, hit(4) + 0.3)));
        R.light(470, 160, 940, 300, '#b48cff', 0.5 * m);
        sparks(R, 470, 20, 940, t, '#c79bff', 12, m);
      }
      R.end();
      R.env.focus = null;
      s.pows.forEach((e, i) => slam(e, t, hit(i + 1) + 0.15, win[i + 1][1] - 0.05, W / 2, 610, i % 2 ? 5 : -5));
    },
  });

  const MISSIONS = [['invasion', '👽 Alien Invasion'], ['heist', '🏦 The Bank Heist'], ['volcano', '🌋 Volcano Rescue']];
  scenes.push({
    id: 'mission', min: 13.5,
    say: 'Every game has a Mission. Fight off an alien invasion, stop a bank heist, or rescue the city from a volcano. Fit the Mission and score big... or miss it, and pay the price.',
    build(root) {
      const s = sceneRoot(root, 5);
      s.good = word(root, 'chip good', '✅ Mission complete: +25');
      s.bad = word(root, 'chip bad', '❌ Missing a suit: −10');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      night(R);
      const focus = E.inOut(seg(t, at(0.64, dur), at(0.64, dur) + 1.4));
      const k = E.inOut(seg(t, 0, dur));
      look(R, lerp(0, -420, focus), lerp(70, 520, focus), lerp(-520, 820, focus), lerp(0, -560, focus), lerp(560, 720, focus), lerp(1800, 1600, focus));
      R.begin(t);
      city(R, t, { night: 1 });
      skybeam(R, -900, 1700, t, 1);
      // Saucers drift over the skyline, beams sweeping the streets.
      [[-1300, 1100, 2700, 0], [400, 1400, 3300, 2], [1500, 950, 2400, 4]].forEach(([x, y, z, ph]) => {
        const sx = x + Math.sin(t * 0.4 + ph) * 160;
        const sy = y + Math.sin(t * 1.1 + ph) * 30;
        R.bill(X('full-saucer'), { x: sx, y: sy, z, h: 190, shadow: false });
        R.add((R.project(sx, sy / 2, z) || { d: 5000 }).d + 30, () => {
          const top = R.project(sx, sy, z);
          const l = R.project(sx - 260, 0, z);
          const r = R.project(sx + 260, 0, z);
          if (!top || !l || !r) return;
          const g = R.g;
          g.globalCompositeOperation = 'lighter';
          const gr = g.createLinearGradient(0, top.y, 0, l.y);
          gr.addColorStop(0, 'rgba(120,255,170,0.35)');
          gr.addColorStop(1, 'rgba(120,255,170,0.05)');
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(top.x - 18 * top.s, top.y);
          g.lineTo(top.x + 18 * top.s, top.y);
          g.lineTo(r.x, r.y);
          g.lineTo(l.x, l.y);
          g.closePath();
          g.fill();
        });
      });
      // The three Missions hang over the plaza like giant screens.
      MISSIONS.forEach(([m, name], i) => {
        const a = at([0.2, 0.36, 0.5][i], dur);
        const p = seg(t, a, a + 0.6);
        if (p <= 0) return;
        const x = -560 + i * 560;
        const op = clamp(p * 2) * (i === 0 ? 1 : 1 - focus);
        R.bill(X('mission-' + m), { x, y: 560 + Math.sin(t + i) * 10, z: 1600, h: lerp(150, 330, E.back(p)), shadow: false, op, flash: (1 - p) * 0.8, flashColor: '#9fe6ff', bias: -400 });
        R.light(x, 720, 1590, 480, '#7fd0ff', 0.25 * op);
        tag(R, x, 520, 1590, name, { op, k: 1.8, bias: 420 });
      });
      hero(R, 'starbolt', -300, 120, { t, op: 1 - focus });
      hero(R, 'valora', 260, 160, { t: t + 1, op: 1 - focus });
      R.end();
      void k;
      slam(s.good, t, at(0.72, dur), dur + 1, W / 2 - 230, 640, -3);
      slam(s.bad, t, at(0.88, dur), dur + 1, W / 2 + 250, 640, 3);
    },
  });

  scenes.push({
    id: 'identity', min: 8,
    say: 'And every league hides a secret identity... a bonus that nobody else knows about.',
    build(root) {
      const s = sceneRoot(root, 6);
      s.id = word(root, 'ident', '<div class="ic">🦇</div><div class="nm">The Vigilante</div><div class="rule">+14 for each Shadow in your hand</div><div class="stamp">TOP SECRET</div>');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      night(R);
      R.env.fogNear = 250;
      R.env.fogFar = 1700;
      R.env.fogMax = 0.8;
      R.env.hazeColor = '#241a46';
      const k = E.inOut(seg(t, 0, dur));
      look(R, lerp(-80, 40, k), lerp(150, 165, k), lerp(-260, 220, k), 0, 160, 760);
      R.begin(t);
      city(R, t, { night: 1, fountain: false });
      R.light(0, 260, 820, 420, '#a57bff', 0.45);
      hero(R, 'nightshade', 0, 760, { t, flash: 0.93, flashColor: '#07060f' });
      R.blob(0, 40, 700, 260, '#2c2160', 0.5);
      R.end();
      R.env.fogNear = 2200;
      R.env.fogFar = 8000;
      R.env.fogMax = 0.55;
      R.env.hazeColor = null;
      const f = seg(t, at(0.45, dur), at(0.45, dur) + 0.6);
      s.id.style.display = f > 0 ? '' : 'none';
      s.id.style.opacity = clamp(f * 2);
      s.id.style.transform = `translateY(${Math.sin(t * 1.5) * 6 + (1 - E.out(f)) * 40}px) scale(${lerp(0.6, 1, E.back(f))}) rotateY(${(1 - E.out(f)) * 80}deg)`;
      R.cv.style.filter = f > 0 ? `blur(${3 * f}px) brightness(${1 - 0.3 * f})` : '';
    },
  });

  const TWELVE = ['cinder', 'nova', 'scout', 'mecha', 'prism', 'gale', 'tess', 'cape', 'whisper', 'ironclad', 'firewall', 'kaos'];
  scenes.push({
    id: 'clock', min: 6.5,
    say: 'When the twelfth hero lands in the Plaza... hands down!',
    build(root) {
      const s = sceneRoot(root, 7);
      s.pow = word(root, 'pow', 'HANDS DOWN!');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      dusk(R, 1);
      const end = dur - 1.9;
      const shake = t > end && t < end + 0.5 ? Math.sin(t * 60) * 8 * (1 - seg(t, end, end + 0.5)) : 0;
      const k = E.inOut(seg(t, 0, dur));
      look(R, lerp(-420, 300, k) + shake, lerp(520, 380, k), lerp(-300, -160, k), 0, 40, 760);
      R.begin(t);
      city(R, t, {});
      TWELVE.forEach((id, i) => {
        const a = 0.4 + (i / 12) * (end - 0.4);
        const p = seg(t, a, a + 0.35);
        if (p <= 0) return;
        const col = i % 6;
        const row = Math.floor(i / 6);
        const x = -500 + col * 200;
        const z = 640 + row * 220;
        const fall = 1 - E.in(p);
        card(R, id, x, fall * 700, z, { rot: fall * (i % 2 ? 30 : -30), h: 165 });
        if (p >= 1) {
          const q = seg(t, a + 0.35, a + 1);
          for (let j = 0; j < 6; j++) R.blob(x + Math.cos(j) * q * 110, 10, z - 10 + Math.sin(j) * q * 40, 30 + q * 30, '#c9c2e0', 0.5 * (1 - q));
        }
        tag(R, x, -20, z - 20, String(i + 1), { k: 0.8, bg: i === 11 ? '#ffd24d' : 'rgba(22,10,48,0.85)', fg: i === 11 ? '#3a1d00' : '#ffffff', op: p });
      });
      R.end();
      s.flash.style.opacity = 0.7 * seg(t, end, end + 0.05) * (1 - seg(t, end + 0.05, end + 0.5));
      slam(s.pow, t, end, dur + 1, W / 2, H * 0.24, -5);
    },
  });

  const LEAGUES = [['valora', 'Your league', 187, '#ffb13b'], ['mecha', 'Titan Squad', 164, '#5b8dff'], ['nightshade', 'Night Watch', 152, '#9b6bff']];
  scenes.push({
    id: 'reveal', min: 11,
    say: 'No running scores. Work it out in your head, guess what your rivals are hiding... then flip the cards for the big reveal.',
    build(root) {
      const s = sceneRoot(root, 8);
      s.crown = word(root, 'pow', '👑 WINNER!');
      const r = rng(19);
      s.confetti = Array.from({ length: 120 }, () => [(r() - 0.5) * 1300, r() * 900, 300 + r() * 900, r(), Math.floor(r() * 5)]);
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      dusk(R, 0.9);
      const go = at(0.7, dur);
      const p = E.out(seg(t, go, go + 2));
      const k = E.inOut(seg(t, 0, dur));
      look(R, lerp(260, -120, k), lerp(240, 330, k), lerp(-420, -520, k), 0, lerp(160, 300, p), 760);
      R.begin(t);
      city(R, t, {});
      skybeam(R, -700, 1400, t, 0.5, p);
      skybeam(R, 800, 1500, t, 2.5, p);
      LEAGUES.forEach(([id, name, score, col], i) => {
        const x = (i === 0 ? 0 : i === 1 ? -380 : 380);
        const z = 760 + (i ? 60 : 0);
        const h = 30 + score * 1.5 * p;
        pillar(R, x, z, 170, h, col);
        hero(R, id, x, z - 20, { t: t + i, y: h, bias: -10 });
        tag(R, x, -30, z - 100, name, { k: 1.1 });
        const shown = t < go ? '???' : String(Math.round(score * p));
        tag(R, x, h + (TALL[id] || 205) + 50, z - 20, shown, { k: 1.6, bg: i === 0 && p >= 1 ? '#ffd24d' : 'rgba(22,10,48,0.88)', fg: i === 0 && p >= 1 ? '#3a1d00' : '#ffffff' });
        if (i === 0 && p >= 1) R.light(x, h + 120, z - 30, 380, '#ffd24d', 0.45);
      });
      const cf = seg(t, go + 2, go + 2.4);
      if (cf > 0) s.confetti.forEach(([x, y0, z, ph, ci]) => {
        const y = ((y0 - (t - go) * 120) % 900 + 900) % 900;
        R.at(x + Math.sin(t + ph * 9) * 30, y, z, (g, q) => {
          g.translate(q.x, q.y);
          g.rotate(t * 3 + ph * 10);
          g.fillStyle = ['#ffd24d', '#ff6b6b', '#6bc5ff', '#8ee06b', '#ff9de2'][ci];
          g.fillRect(-6 * q.s, -3 * q.s, 12 * q.s, 6 * q.s);
        });
      });
      R.end();
      slam(s.crown, t, go + 2.1, dur + 1, W / 2, 90, -4);
    },
  });

  scenes.push({
    id: 'end', min: 8, tail: 2.4,
    say: 'Hero League. Coming soon, to Ahrens Labs.',
    build(root) {
      const s = sceneRoot(root, 9);
      s.title = caption(root, '<div class="big">Hero League</div><div class="sub">A superhero card game</div><div class="pill">Coming soon to ahrenslabs.com</div>');
      return s;
    },
    frame(t, dur, s) {
      const R = s.R;
      dusk(R, 0.6);
      const a = t * 0.06 - 0.3;
      look(R, Math.sin(a) * 1300, 700, 650 - Math.cos(a) * 1300, 0, 120, 650);
      R.begin(t);
      city(R, t, {});
      skybeam(R, -900, 1700, t, 0);
      skybeam(R, 1100, 1900, t, 2.2);
      LINEUP.forEach(([id, x, z], i) => hero(R, id, x, z, { t: t + i }));
      R.end();
      R.cv.style.filter = 'blur(2px) brightness(0.72)';
      s.title.show(t, 0.3, dur + 2);
    },
  });

  runAd(scenes);
})();
