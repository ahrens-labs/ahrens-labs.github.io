// Dino Dynasty ad: a side-on tour of a living dino park, built from the game's own pieces.
(function () {
  const { W, H, clamp, lerp, seg, E, rng, el, img, sprite, pose, canvasLayer, caption, runAd } = AD;
  const D = (n) => `sprites/dino/${n}.png`;
  const GROUND = 430;

  // ---------------------------------------------------------------- painted backdrop
  function wave(x, seed, amp) {
    return Math.sin(x * 0.0021 + seed) * amp + Math.sin(x * 0.0053 + seed * 2.3) * amp * 0.45 + Math.sin(x * 0.011 + seed * 5.1) * amp * 0.18;
  }
  function ridge(width, base, amp, seed, fill) {
    let d = `M0 ${H} L0 ${base}`;
    for (let x = 0; x <= width; x += 40) d += ` L${x} ${(base - Math.abs(wave(x, seed, amp))).toFixed(1)}`;
    return `<path d="${d} L${width} ${H} Z" fill="${fill}"/>`;
  }
  function palm(x, base, h, lean, r) {
    const tx = x + lean;
    const ty = base - h;
    let s = `<path d="M${x} ${base} Q${x + lean * 0.3} ${base - h * 0.55} ${tx} ${ty}" stroke="#6f4a2a" stroke-width="${7 + h / 40}" fill="none" stroke-linecap="round"/>`;
    [-170, -140, -105, -75, -40, -10].forEach((a, i) => {
      const len = h * (0.42 + r() * 0.12);
      const rad = (a * Math.PI) / 180;
      const ex = tx + Math.cos(rad) * len;
      const ey = ty + Math.sin(rad) * len * 0.55 + len * 0.35;
      const cx = tx + Math.cos(rad) * len * 0.5;
      const cy = ty + Math.sin(rad) * len * 0.5 - len * 0.12;
      s += `<path d="M${tx} ${ty} Q${cx} ${cy} ${ex} ${ey}" stroke="${i % 2 ? '#2f7a34' : '#3b9140'}" stroke-width="${6 + h / 30}" fill="none" stroke-linecap="round"/>`;
    });
    return s;
  }
  function jungle(width, seed) {
    const r = rng(seed);
    let s = '';
    for (let x = -60; x < width; x += 70 + r() * 60) {
      const y = GROUND + 16;
      const rr = 40 + r() * 55;
      s += `<ellipse cx="${x}" cy="${y}" rx="${rr * 1.3}" ry="${rr}" fill="${r() < 0.5 ? '#3f8f3c' : '#357f36'}"/>`;
    }
    for (let x = 30; x < width; x += 150 + r() * 170) s += palm(x, GROUND + 10, 130 + r() * 110, (r() - 0.5) * 70, r);
    for (let x = 0; x < width; x += 55 + r() * 40) {
      const rr = 22 + r() * 26;
      s += `<ellipse cx="${x}" cy="${GROUND + 6}" rx="${rr * 1.4}" ry="${rr}" fill="${r() < 0.5 ? '#4ea347' : '#459a40'}"/>`;
    }
    return s;
  }

  function backdrop(root, o = {}) {
    const width = o.width || 5200;
    el('div', 'full', root, { zIndex: 0, background: o.sky || 'linear-gradient(180deg, #4aa8e2 0%, #9fd8f2 44%, #f7e6b4 66%, #f7e6b4 100%)' });
    const sun = el('div', '', root, {
      position: 'absolute', width: '220px', height: '220px', borderRadius: '50%', zIndex: 1,
      background: 'radial-gradient(circle, #fffbe0 0 22%, rgba(255, 233, 150, 0.7) 36%, rgba(255, 220, 120, 0) 68%)',
    });
    const clouds = [];
    const r = rng(o.seed || 7);
    for (let i = 0; i < 7; i++) {
      const c = el('div', '', root, {
        position: 'absolute', zIndex: 1, width: `${90 + r() * 70}px`, height: '44px', borderRadius: '44px', background: '#fff', opacity: 0.85,
        boxShadow: '40px -22px 0 6px #fff, 86px -6px 0 0 #fff, -30px -10px 0 -2px #fff',
      });
      clouds.push({ c, x: r() * 1700, y: 50 + r() * 150, v: 6 + r() * 10 });
    }
    const far = el('div', 'layer', root, { zIndex: 2 });
    far.innerHTML = `<svg width="${width}" height="${H}">${ridge(width, 330, 120, 1.3, '#9cc3c8')}
      <path d="M${1500} ${360} L${1700} ${170} L${1745} ${178} L${1960} ${360} Z" fill="#8aaab0"/><path d="M1700 170 L1745 178 L1735 196 L1708 192 Z" fill="#5b6f73"/>
      ${ridge(width, 380, 80, 4.1, '#86b7a0')}</svg>`;
    const smoke = el('div', 'layer', root, { zIndex: 2 });
    const puffs = [];
    for (let i = 0; i < 8; i++) puffs.push(el('div', '', smoke, { position: 'absolute', borderRadius: '50%', background: 'rgba(240,240,235,0.75)' }));
    const mid = el('div', 'layer', root, { zIndex: 3 });
    mid.innerHTML = `<svg width="${width}" height="${H}">${jungle(width, o.seed || 3)}</svg>`;
    return {
      update(t, camX) {
        sun.style.transform = `translate(${(o.sunX || 980) - camX * 0.05}px, ${o.sunY || 40}px)`;
        clouds.forEach((k) => {
          const x = ((k.x + t * k.v - camX * 0.1) % 1700 + 1700) % 1700 - 200;
          k.c.style.transform = `translate(${x}px, ${k.y}px)`;
        });
        far.style.transform = `translateX(${-camX * 0.25}px)`;
        smoke.style.transform = `translateX(${-camX * 0.25}px)`;
        puffs.forEach((p, i) => {
          const c = (t * 0.12 + i / puffs.length) % 1;
          const s = 30 + c * 90;
          p.style.width = p.style.height = `${s}px`;
          p.style.opacity = (1 - c) * 0.8;
          p.style.transform = `translate(${1722 + c * 160 - s / 2}px, ${170 - c * 150 - s / 2}px)`;
        });
        mid.style.transform = `translateX(${-camX * 0.55}px)`;
      },
    };
  }

  // The world layer pans and zooms like a camera; ground and every sprite live inside it.
  function world(root) {
    const w = el('div', 'world', root, { zIndex: 10 });
    el('div', '', w, { position: 'absolute', left: '-3000px', top: `${GROUND}px`, width: '12000px', height: '900px', background: 'linear-gradient(#9fd463, #74b947 30%, #5ea33c)' });
    const r = rng(11);
    let tufts = '';
    for (let i = 0; i < 260; i++) {
      const x = -1000 + r() * 7000;
      const y = GROUND + 20 + r() * 300;
      tufts += `<path d="M${x} ${y} l-5 -12 M${x} ${y} l0 -15 M${x} ${y} l6 -11" stroke="${r() < 0.5 ? '#4f9a33' : '#5daa3c'}" stroke-width="3" stroke-linecap="round"/>`;
    }
    const svg = el('div', '', w, { position: 'absolute', left: 0, top: 0 });
    svg.innerHTML = `<svg width="7000" height="800" style="position:absolute;left:0;top:0;overflow:visible">${tufts}</svg>`;
    const c = { x: 0, z: 1, y: 380, sx: 0, sy: 0 };
    return {
      el: w,
      // Where a world point lands on screen with the current camera.
      at(x, y) {
        return [W / 2 + c.sx + c.z * (x - (c.x + W / 2)), c.y + c.sy + c.z * (y - c.y)];
      },
      cam(x, z = 1, y = 380, shakeX = 0, shakeY = 0) {
        Object.assign(c, { x, z, y, sx: shakeX, sy: shakeY });
        w.style.transform = `translate(${W / 2 + shakeX}px, ${y + shakeY}px) scale(${z}) translate(${-(x + W / 2)}px, ${-y}px)`;
      },
    };
  }

  // An enclosure: fence pieces from the game in a back row, two receding sides and a front row.
  function pen(parent, x0, x1, o = {}) {
    const yb = o.yb || 470;
    const yf = o.yf || 650;
    const pieces = [];
    const add = (x, y, h) => {
      const s = sprite(parent, D('fence'), { x, y, h, shadow: false });
      pieces.push(s);
    };
    const floor = el('div', '', parent, {
      position: 'absolute', left: 0, top: 0, zIndex: yb - 2,
      width: `${x1 - x0 + 80}px`, height: `${yf - yb}px`, transform: `translate(${x0 - 40}px, ${yb}px)`,
      background: o.floor || 'radial-gradient(ellipse at 50% 55%, rgba(196, 160, 90, 0.45), rgba(196, 160, 90, 0.12) 70%, rgba(0,0,0,0) 72%)',
    });
    const nb = Math.max(2, Math.round((x1 - x0) / 54));
    for (let i = 0; i < nb; i++) add(lerp(x0, x1, (i + 0.5) / nb), yb, 54);
    for (let i = 1; i <= 4; i++) {
      const f = i / 4.6;
      add(lerp(x0, x0 - 46, f), lerp(yb, yf, f), lerp(54, 76, f));
    }
    const nf = Math.max(2, Math.round((x1 - x0 + 92) / 70));
    for (let i = 0; i < nf; i++) add(lerp(x0 - 46, x1 + 46, (i + 0.5) / nf), yf, 78);
    for (let i = 4; i >= 1; i--) {
      const f = i / 4.6;
      add(lerp(x1, x1 + 46, f), lerp(yb, yf, f), lerp(54, 76, f));
    }
    let sign = null;
    if (o.name) {
      sign = el('div', 'sign', parent, { zIndex: yb - 1 });
      sign.textContent = o.name;
    }
    const cx = (x0 + x1) / 2;
    return {
      x0, x1, yb, yf, cx, pieces, floor,
      // Pieces drop in one after another between a and b (all standing once t >= b).
      draw(t, a = -1, b = -0.5) {
        pieces.forEach((s, i) => {
          const at = lerp(a, b, i / pieces.length);
          const p = seg(t, at, at + 0.35);
          s.op = p > 0 ? 1 : 0;
          s.lift = (1 - E.back(p)) * 70;
          s.rot = (1 - p) * 8;
          s.place();
        });
        floor.style.opacity = seg(t, a, b);
        if (sign) {
          const p = seg(t, b - 0.2, b + 0.4);
          sign.style.opacity = p;
          sign.style.transform = `translate(${cx}px, ${yb - 64}px) translate(-50%, -100%) scale(${lerp(0.4, 1, E.back(p))})`;
        }
      },
    };
  }

  function deco(parent, list) {
    return list.map(([n, x, y, h]) => {
      const s = sprite(parent, D(n), { x, y, h, shadow: n !== 'plant' });
      s.place();
      return s;
    });
  }

  const tag = (root) => {
    const e = el('div', 'tag', root);
    return (text, t, a, b) => {
      e.textContent = text;
      const vis = t >= a && t <= b;
      e.style.display = vis ? '' : 'none';
      const p = E.out(seg(t, a, a + 0.5)) * (1 - seg(t, b - 0.4, b));
      e.style.opacity = p;
      e.style.transform = `translateX(-50%) translateY(${(1 - p) * 30}px)`;
    };
  };

  // Things flying along an arc in screen space, drawn into the effects canvas.
  function arcItem(g, src, x0, y0, x1, y1, p, size, spin = 0, peak = 160) {
    if (p <= 0 || p >= 1) return;
    const x = lerp(x0, x1, p);
    const y = lerp(y0, y1, p) - Math.sin(p * Math.PI) * peak;
    g.save();
    g.translate(x, y);
    g.rotate(spin * p * Math.PI * 2);
    g.drawImage(img(src), -size / 2, -size / 2, size, size);
    g.restore();
  }
  function emoji(g, ch, x, y, size, a = 1) {
    g.globalAlpha = clamp(a);
    g.font = `${size}px "Noto Color Emoji", "Apple Color Emoji", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, x, y);
    g.globalAlpha = 1;
  }
  function sparkle(g, x, y, t, n = 10, r0 = 20, r1 = 90, seed = 1, color = '255,230,120') {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const rr = lerp(r0, r1, clamp(t)) * (0.6 + r() * 0.6);
      const s = (1 - clamp(t)) * (6 + r() * 6);
      if (s <= 0) continue;
      g.fillStyle = `rgba(${color},${1 - clamp(t)})`;
      g.beginPath();
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      g.moveTo(px, py - s);
      g.lineTo(px + s * 0.35, py);
      g.lineTo(px, py + s);
      g.lineTo(px - s * 0.35, py);
      g.fill();
    }
  }

  // Wander inside a pen: a smooth looping path between its fences.
  function roam(pn, t, k, speed = 0.12, margin = 60) {
    const u = t * speed + k * 1.7;
    const x = lerp(pn.x0 + margin, pn.x1 - margin, 0.5 + 0.5 * Math.sin(u * 2 * Math.PI * 0.5 + k));
    const y = lerp(pn.yb + 40, pn.yf - 40, 0.5 + 0.5 * Math.sin(u * 2 * Math.PI * 0.37 + k * 2.1));
    const dx = Math.cos(u * 2 * Math.PI * 0.5 + k);
    return { x, y, dir: dx >= 0 ? 1 : -1 };
  }

  // ---------------------------------------------------------------- scenes
  const scenes = [];

  scenes.push({
    id: 'open', min: 9, lead: 1.4,
    say: 'Deep in a hidden valley, where the ferns grow tall and the ground still trembles... a park is waiting to be built.',
    build(root) {
      const bg = el('div', 'full', root, { background: `url(${D('cover')}) center/cover`, transformOrigin: '60% 50%' });
      el('div', 'vignette', root);
      const title = caption(root, '<div class="big">Dino Dynasty</div><div class="sub">Build the greatest dino park of all time</div>');
      const fx = canvasLayer(root, 8000);
      return { bg, title, fx };
    },
    frame(t, dur, s) {
      const p = t / dur;
      s.bg.style.transform = `scale(${lerp(1.22, 1.04, E.sine(p))}) translate(${lerp(-30, 10, p)}px, ${lerp(10, -6, p)}px)`;
      s.title.show(t, dur - 4.2, dur + 1, 'pop');
      s.fx.clear();
      if (t > dur - 4.2) sparkle(s.fx.g, W / 2, H / 2 - 30, (t - (dur - 4.2)) / 1.2, 26, 60, 420, 3);
    },
  });

  scenes.push({
    id: 'fence', min: 9,
    say: 'Every great park starts with a fence. Draw your enclosures, square by square, and close them off tight.',
    build(root) {
      const bd = backdrop(root);
      const w = world(root);
      const pn = pen(w.el, 430, 960, { name: 'Compy Corner' });
      deco(w.el, [['plant', 300, 520, 70], ['plant', 1080, 560, 80], ['plant', 1180, 500, 60], ['water', 220, 640, 60]]);
      return { bd, w, pn, tag: tag(root) };
    },
    frame(t, dur, s) {
      const cx = lerp(-40, 60, E.sine(t / dur));
      s.bd.update(t, cx);
      s.w.cam(cx, lerp(1.08, 1, E.out(seg(t, 0, dur))));
      s.pn.draw(t, 0.8, dur - 2.2);
      s.tag('Fence your enclosures', t, 1, dur - 0.3);
    },
  });

  scenes.push({
    id: 'compys', min: 10,
    say: 'Then the dinos move in! A pack of Compys scampers through the gate. They love company, so the more you keep together, the more they’re worth.',
    build(root) {
      const bd = backdrop(root);
      const w = world(root);
      const pn = pen(w.el, 430, 960, { name: 'Compy Corner' });
      deco(w.el, [['plant', 300, 520, 70], ['plant', 1080, 560, 80], ['plant', 1180, 500, 60], ['water', 220, 640, 60], ['feeder', 880, 520, 54]]);
      const c = [0, 1, 2, 3, 4].map(() => sprite(w.el, D('compy'), { h: 78 }));
      return { bd, w, pn, c, fx: canvasLayer(root), tag: tag(root) };
    },
    frame(t, dur, s) {
      s.bd.update(t, 0);
      s.w.cam(0, lerp(1, 1.12, E.sine(seg(t, dur * 0.45, dur))), 470);
      s.pn.draw(t);
      s.fx.clear();
      s.c.forEach((sp, i) => {
        const enter = 0.4 + i * 0.45;
        const p = seg(t, enter, enter + 2);
        const r = roam(s.pn, t, i, 0.16, 70);
        if (p < 1) {
          sp.x = lerp(-120 - i * 40, r.x, E.inOut(p));
          sp.y = lerp(600, r.y, E.inOut(p));
          sp.dir = 1;
        } else {
          sp.x = r.x;
          sp.y = r.y;
          sp.dir = r.dir;
        }
        pose.hop(sp, t, 2.2, i * 0.37, 18);
        sp.place();
      });
      // Hearts between neighbours: Compys score for each Compy next to them.
      if (t > dur * 0.55) {
        for (let i = 0; i < 4; i++) {
          const a = s.c[i];
          const b = s.c[i + 1];
          const k = ((t - dur * 0.55 + i * 0.3) % 1.4) / 1.4;
          const [hx, hy] = s.w.at((a.x + b.x) / 2, (a.y + b.y) / 2 - 80 - k * 40);
          emoji(s.fx.g, '💛', hx, hy, 26, 1 - k);
        }
      }
      s.tag('Fill them with dinos', t, 1.2, dur - 0.3);
    },
  });

  scenes.push({
    id: 'giants', min: 11,
    say: 'Every dino has its own shape, so plan your pens with care. Room for a Triceratops, a Stegosaurus... and one very tall Brachiosaurus.',
    build(root) {
      const bd = backdrop(root, { seed: 5 });
      const w = world(root);
      const p1 = pen(w.el, 200, 720, { name: 'Triceratops' });
      const p2 = pen(w.el, 880, 1400, { name: 'Stegosaurus' });
      const p3 = pen(w.el, 1560, 2160, { name: 'Brachiosaurus' });
      deco(w.el, [['plant', 120, 520, 70], ['plant', 800, 540, 76], ['plant', 1480, 520, 70], ['feeder', 640, 530, 54], ['feeder', 1320, 530, 54], ['plant', 2250, 540, 80]]);
      const tri = [sprite(w.el, D('triceratops'), { h: 150 }), sprite(w.el, D('triceratops'), { h: 140 })];
      const ste = [sprite(w.el, D('stegosaurus'), { h: 150 }), sprite(w.el, D('stegosaurus'), { h: 138 })];
      const bra = sprite(w.el, D('brachiosaurus'), { h: 330 });
      return { bd, w, pens: [p1, p2, p3], tri, ste, bra, tag: tag(root) };
    },
    frame(t, dur, s) {
      const cx = lerp(-60, 1300, E.inOut(seg(t, 0.4, dur - 1.6)));
      s.bd.update(t, cx);
      s.w.cam(cx, 1, 390);
      s.pens.forEach((p) => p.draw(t));
      s.tri.forEach((sp, i) => {
        const r = roam(s.pens[0], t, i * 2 + 1, 0.05, 110);
        sp.x = r.x;
        sp.y = r.y;
        sp.dir = r.dir;
        if (i) pose.graze(sp, t, i);
        else pose.walk(sp, t, 0.45, i, 5);
        sp.place();
      });
      s.ste.forEach((sp, i) => {
        const r = roam(s.pens[1], t, i * 3 + 2, 0.05, 110);
        sp.x = r.x;
        sp.y = r.y;
        sp.dir = r.dir;
        pose.walk(sp, t, 0.4, i * 2, 5);
        sp.place();
      });
      s.bra.x = lerp(1760, 1930, 0.5 + 0.5 * Math.sin(t * 0.25));
      s.bra.y = 590;
      s.bra.dir = Math.cos(t * 0.25) >= 0 ? 1 : -1;
      pose.breathe(s.bra, t);
      s.bra.rot = 1.5 * Math.sin(t * 0.8);
      s.bra.place();
      s.tag('Every dino has its own shape', t, 1, dur - 0.3);
    },
  });

  scenes.push({
    id: 'feeding', min: 13,
    say: 'Feeding time! Meat for the meat eaters, plants for the plant eaters. But forget an enclosure, and its dinos get hungry... and sleepy. Leave them too long, and they’re gone for good.',
    build(root) {
      const bd = backdrop(root, { seed: 9 });
      const w = world(root);
      const p1 = pen(w.el, 160, 700, { name: 'Raptor Run' });
      const p2 = pen(w.el, 860, 1400, { name: 'Duckbill Meadow' });
      const p3 = pen(w.el, 1560, 2100, { name: 'Allosaurus' });
      deco(w.el, [['plant', 90, 520, 70], ['plant', 780, 540, 70], ['plant', 1480, 520, 74], ['plant', 2200, 540, 70]]);
      const rap = [0, 1, 2].map(() => sprite(w.el, D('velociraptor'), { h: 120 }));
      const par = [0, 1].map(() => sprite(w.el, D('parasaurolophus'), { h: 150 }));
      const allo = sprite(w.el, D('allosaurus'), { h: 190 });
      const zz = sprite(w.el, D('sleep'), { h: 70, shadow: false });
      return { bd, w, p1, p2, p3, rap, par, allo, zz, fx: canvasLayer(root), tag: tag(root) };
    },
    frame(t, dur, s) {
      const pan = E.inOut(seg(t, dur * 0.42, dur * 0.42 + 2.2));
      const cx = lerp(lerp(120, 760, E.inOut(seg(t, 0, dur * 0.4))), 1470, pan);
      s.bd.update(t, cx);
      s.w.cam(cx, 1, 390);
      [s.p1, s.p2, s.p3].forEach((p) => p.draw(t));
      const g = s.fx.g;
      s.fx.clear();
      s.rap.forEach((sp, i) => {
        const r = roam(s.p1, t, i * 1.3, 0.14, 70);
        sp.x = r.x;
        sp.y = r.y;
        sp.dir = r.dir;
        const leap = (t * 0.9 + i * 0.33) % 1;
        pose.walk(sp, t, 1.2, i, 7);
        if (t > 1 && leap < 0.3) sp.lift = Math.sin((leap / 0.3) * Math.PI) * 60;
        sp.place();
      });
      s.par.forEach((sp, i) => {
        const r = roam(s.p2, t, i * 2.2, 0.06, 100);
        sp.x = r.x;
        sp.y = r.y;
        sp.dir = r.dir;
        pose.graze(sp, t, i * 1.4);
        sp.place();
      });
      // Meat and plants arc in from the keeper's side of the screen.
      for (let i = 0; i < 10; i++) {
        const a = 0.6 + i * 0.42;
        const p = seg(t, a, a + 1.1);
        const toRap = i % 2 === 0;
        const tx = (toRap ? 300 + (i % 3) * 120 : 1000 + (i % 3) * 140) - cx;
        arcItem(g, D(toRap ? 'meat' : 'plant'), -40, 520, tx, 560, p, 58, toRap ? 1.2 : 0.4, 230);
      }
      // The unfed pen: a sleepy Allosaurus, greying out.
      const sleepy = seg(t, dur * 0.5, dur * 0.62);
      s.allo.x = 1830;
      s.allo.y = 590;
      s.allo.dir = -1;
      pose.breathe(s.allo, t * 0.6);
      s.allo.rot = lerp(0, -6, sleepy);
      s.allo.sy *= lerp(1, 0.92, sleepy);
      s.allo.filter = `grayscale(${sleepy * 0.75}) brightness(${1 - sleepy * 0.15})`;
      s.allo.place();
      s.zz.x = 1740;
      s.zz.y = 400 - Math.sin(t * 2) * 6;
      s.zz.op = sleepy;
      s.zz.sy = s.zz.sx = lerp(0.6, 1, E.back(sleepy));
      s.zz.place();
      if (sleepy > 0) {
        for (let i = 0; i < 3; i++) {
          const k = ((t * 0.5 + i / 3) % 1);
          g.globalAlpha = sleepy * (1 - k);
          g.fillStyle = '#ffffff';
          g.font = `${22 + k * 18}px "Lilita One"`;
          g.fillText('z', 1700 - cx + k * 60, 330 - k * 90);
          g.globalAlpha = 1;
        }
      }
      s.tag(t < dur * 0.48 ? 'Feed every enclosure' : 'Unfed dinos go inactive', t, 1, dur - 0.3);
    },
  });

  scenes.push({
    id: 'babies', min: 11,
    say: 'Keep a pair happy and well fed, and before long... babies! Raise them up, and watch your herds grow.',
    build(root) {
      const bd = backdrop(root, { seed: 13, sunX: 700 });
      const w = world(root);
      const pn = pen(w.el, 300, 980, { name: 'Nursery' });
      deco(w.el, [['plant', 230, 520, 70], ['plant', 1070, 520, 80], ['feeder', 920, 520, 52], ['plant', 1180, 600, 66]]);
      const a = sprite(w.el, D('parasaurolophus'), { h: 165 });
      const b = sprite(w.el, D('parasaurolophus'), { h: 158 });
      const baby = sprite(w.el, D('parasaurolophus'), { h: 82 });
      const maia = sprite(w.el, D('maiasaura'), { h: 150 });
      return { bd, w, pn, a, b, baby, maia, fx: canvasLayer(root), tag: tag(root) };
    },
    frame(t, dur, s) {
      s.bd.update(t, 0);
      const born = dur * 0.42;
      s.w.cam(0, lerp(1, 1.18, E.inOut(seg(t, 0, born + 1))), 500);
      s.pn.draw(t);
      const g = s.fx.g;
      s.fx.clear();
      s.a.x = 520;
      s.a.y = 580;
      s.a.dir = 1;
      pose.breathe(s.a, t);
      s.b.x = 760;
      s.b.y = 585;
      s.b.dir = -1;
      pose.breathe(s.b, t, 1.3);
      [s.a, s.b].forEach((x) => x.place());
      for (let i = 0; i < 4; i++) {
        const k = ((t * 0.6 + i / 4) % 1);
        const [hx, hy] = s.w.at(640 + Math.sin(i * 2 + t) * 30, 470 - k * 120);
        if (t < born + 0.6) emoji(g, '❤️', hx, hy, 30 + k * 10, (1 - k) * seg(t, 0.5, 1.2));
      }
      const p = seg(t, born, born + 0.6);
      s.baby.op = p > 0 ? 1 : 0;
      s.baby.x = lerp(640, lerp(640, 600, seg(t, born + 1.5, dur)), 1);
      s.baby.y = 610;
      s.baby.dir = 1;
      s.baby.sx = s.baby.sy = lerp(0.2, 1, E.back(p));
      if (p >= 1) pose.hop(s.baby, t, 1.6, 0, 22);
      s.baby.place();
      if (t > born) sparkle(g, ...s.w.at(640, 560), (t - born) / 1.2, 24, 10, 160, 9);
      s.maia.x = 900;
      s.maia.y = 625;
      s.maia.dir = -1;
      pose.breathe(s.maia, t, 2);
      s.maia.place();
      s.tag(t < born ? 'Breed a pair' : 'Raise the babies', t, 1, dur - 0.3);
    },
  });

  scenes.push({
    id: 'water', min: 11,
    say: 'Dig a watering hole, and the wildest guests arrive. A Mosasaurus in the lagoon! A Quetzalcoatlus overhead!',
    build(root) {
      const bd = backdrop(root, { seed: 17, sunX: 300 });
      const w = world(root);
      const pn = pen(w.el, 260, 1020, { name: 'Lagoon', floor: 'rgba(0,0,0,0)' });
      const pool = el('div', '', w.el, {
        position: 'absolute', left: 0, top: 0, width: '640px', height: '150px', borderRadius: '50%', zIndex: 520,
        transform: 'translate(320px, 488px)', background: 'radial-gradient(ellipse at 50% 40%, #6fd3ff, #2f9be0 55%, #1d6fb3)', boxShadow: '0 0 0 10px #9aa3a8, 0 0 0 16px #7d868b, inset 0 8px 18px rgba(0,0,0,0.25)',
      });
      deco(w.el, [['water', 1120, 600, 70], ['plant', 1180, 520, 70], ['plant', 190, 540, 76], ['plant', 1090, 640, 60]]);
      const mosa = sprite(w.el, D('mosasaurus'), { h: 170, shadow: false });
      const qz = sprite(w.el, D('quetzalcoatlus'), { h: 170, shadow: false, z: 3000 });
      const dilo = sprite(w.el, D('dilophosaurus'), { h: 140 });
      return { bd, w, pn, pool, mosa, qz, dilo, fx: canvasLayer(root), tag: tag(root) };
    },
    frame(t, dur, s) {
      s.bd.update(t, 0);
      s.w.cam(0, 1, 400);
      s.pn.draw(t);
      const g = s.fx.g;
      s.fx.clear();
      // Mosasaurus leaps out of the lagoon in an arc, twice.
      const L = [1.4, dur * 0.55];
      let shown = false;
      L.forEach((a, k) => {
        const p = seg(t, a, a + 1.8);
        if (p > 0 && p < 1) {
          shown = true;
          s.mosa.x = lerp(420 + k * 60, 900 - k * 40, p);
          s.mosa.y = 560;
          s.mosa.lift = Math.sin(p * Math.PI) * 230;
          s.mosa.rot = lerp(-38, 38, p);
          s.mosa.dir = 1;
        }
        [a + 0.05, a + 1.75].forEach((sx, j) => {
          const q = seg(t, sx, sx + 0.9);
          if (q <= 0 || q >= 1) return;
          const r = rng(31 + k * 7 + j);
          for (let i = 0; i < 26; i++) {
            const ang = -Math.PI * (0.15 + r() * 0.7);
            const v = 120 + r() * 260;
            const x = (j ? 900 - k * 40 : 420 + k * 60) + Math.cos(ang) * v * q;
            const y = 560 + Math.sin(ang) * v * q + 420 * q * q;
            g.fillStyle = `rgba(${200 + r() * 55},${235 + r() * 20},255,${1 - q})`;
            g.beginPath();
            g.arc(x, y, 4 + r() * 6, 0, Math.PI * 2);
            g.fill();
          }
        });
      });
      s.mosa.op = shown ? 1 : 0;
      s.mosa.place();
      // Ripples on the lagoon.
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.4 + i / 3) % 1;
        g.strokeStyle = `rgba(255,255,255,${0.5 * (1 - k)})`;
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(640, 560, 60 + k * 230, 14 + k * 50, 0, 0, Math.PI * 2);
        g.stroke();
      }
      // Quetzalcoatlus glides across the sky, flapping.
      const f = seg(t, dur * 0.45, dur - 0.5);
      s.qz.x = lerp(1450, -250, f);
      s.qz.y = 300 + Math.sin(f * 7) * 30;
      s.qz.dir = -1;
      s.qz.sy = 1 + 0.12 * Math.sin(t * 9);
      s.qz.rot = -6 + Math.sin(t * 3) * 4;
      s.qz.op = f > 0 && f < 1 ? 1 : 0;
      s.qz.place();
      s.dilo.x = 1130;
      s.dilo.y = 650;
      s.dilo.dir = -1;
      pose.breathe(s.dilo, t);
      s.dilo.place();
      s.tag('Watering holes welcome more species', t, 1, dur - 0.3);
    },
  });

  scenes.push({
    id: 'trex', min: 12,
    say: 'And then there’s the king. A T. Rex brings in the crowds, and the crowds bring coins. Lots and lots of coins.',
    build(root) {
      const bd = backdrop(root, { seed: 21, sunX: 820 });
      const w = world(root);
      const pn = pen(w.el, 260, 1060, { name: 'T. Rex Kingdom' });
      const p2 = pen(w.el, 1240, 1900, { name: 'Giganotosaurus' });
      deco(w.el, [['plant', 190, 520, 76], ['plant', 1140, 540, 70], ['feeder', 980, 530, 56]]);
      const rex = sprite(w.el, D('trex'), { h: 260 });
      const gig = sprite(w.el, D('giganotosaurus'), { h: 230 });
      const counter = el('div', 'name', root, { zIndex: 9000, fontSize: '34px', transform: 'translate(1040px, 40px)' });
      return { bd, w, pn, p2, rex, gig, counter, fx: canvasLayer(root), tag: tag(root) };
    },
    frame(t, dur, s) {
      const roar = 2.2;
      const shake = t > roar && t < roar + 1.4 ? (1 - seg(t, roar, roar + 1.4)) * 14 : 0;
      const cx = lerp(0, 240, E.inOut(seg(t, dur * 0.55, dur)));
      s.bd.update(t, cx);
      s.w.cam(cx, lerp(1.12, 1, E.inOut(seg(t, roar + 1, dur * 0.6))), 430, Math.sin(t * 60) * shake, Math.cos(t * 47) * shake);
      s.pn.draw(t);
      s.p2.draw(t);
      const g = s.fx.g;
      s.fx.clear();
      s.rex.x = lerp(560, 760, 0.5 + 0.5 * Math.sin(t * 0.3));
      s.rex.y = 600;
      s.rex.dir = 1;
      pose.walk(s.rex, t, 0.35, 0, 6);
      if (t > roar - 0.3 && t < roar + 1.4) {
        const p = seg(t, roar - 0.3, roar + 0.2);
        s.rex.rot = -8 * E.out(p) + Math.sin(t * 50) * 1.2;
        s.rex.sx = s.rex.sy = 1 + 0.06 * E.out(p);
      }
      s.rex.place();
      s.gig.x = 1560 + Math.sin(t * 0.35) * 120;
      s.gig.y = 600;
      s.gig.dir = Math.cos(t * 0.35) > 0 ? 1 : -1;
      pose.walk(s.gig, t, 0.35, 1, 6);
      s.gig.place();
      if (t > roar && t < roar + 1.6) {
        const k = seg(t, roar, roar + 1.6);
        g.globalAlpha = 1 - k;
        g.font = `${70 + k * 50}px "Lilita One"`;
        g.textAlign = 'center';
        g.lineWidth = 8;
        g.strokeStyle = '#5a1a00';
        g.fillStyle = '#ffd24d';
        const [rx, ry] = s.w.at(s.rex.x + 60, 300);
        g.strokeText('ROAR!', rx, ry);
        g.fillText('ROAR!', rx, ry);
        g.globalAlpha = 1;
      }
      // A fountain of coins, then a few diamonds.
      let n = 0;
      for (let i = 0; i < 40; i++) {
        const a = roar + 1.2 + i * 0.13;
        const p = seg(t, a, a + 1.3);
        if (t > a + 1.3) n++;
        const r = rng(100 + i);
        const [ox, oy] = s.w.at(s.rex.x + (r() - 0.5) * 80, 420);
        arcItem(g, D(i % 9 === 8 ? 'diamond' : 'coin'), ox, oy, 1120 + (r() - 0.5) * 60, 60, p, 52, 2 + r(), 120 + r() * 160);
      }
      s.counter.style.display = t > roar + 1 ? '' : 'none';
      s.counter.innerHTML = `<img src="${D('coin')}" style="height:38px;vertical-align:middle;margin-right:8px">${n * 3}`;
      s.tag('Big dinos, big crowds', t, 1, dur - 0.3);
    },
  });

  scenes.push({
    id: 'storm', min: 11,
    say: 'Every round brings a surprise. A heatwave. A stampede. A sudden storm! Adapt fast, or your rival will.',
    build(root) {
      const bd = backdrop(root, { seed: 29, sky: 'linear-gradient(180deg, #4b5d73 0%, #7f93a6 50%, #b7b39a 100%)', sunY: -400 });
      const dark = el('div', 'full', root, { zIndex: 6, background: 'rgba(25,35,55,0.28)' });
      const w = world(root);
      const pn = pen(w.el, 300, 1000, { name: 'Ankylosaurus' });
      const ank = [sprite(w.el, D('ankylosaurus'), { h: 120, face: -1 }), sprite(w.el, D('ankylosaurus'), { h: 112, face: -1 })];
      const rocks = [0, 1, 2].map(() => sprite(w.el, D('rubble'), { h: 80 }));
      const flash = el('div', 'full', root, { zIndex: 7000, background: '#fff' });
      return { bd, dark, w, pn, ank, rocks, flash, fx: canvasLayer(root), tag: tag(root) };
    },
    frame(t, dur, s) {
      s.bd.update(t, 0);
      s.w.cam(0, 1, 400);
      s.pn.draw(t);
      const g = s.fx.g;
      s.fx.clear();
      s.ank.forEach((sp, i) => {
        sp.x = 560 + i * 150 + Math.sin(t * 0.8 + i) * 20;
        sp.y = 590 + i * 20;
        sp.dir = i ? -1 : 1;
        pose.breathe(sp, t * 2, i);
        sp.rot += Math.sin(t * 13 + i) * 1.2;
        sp.place();
      });
      s.rocks.forEach((sp, i) => {
        const a = 3 + i * 0.6;
        const p = seg(t, a, a + 0.5);
        sp.x = 400 + i * 60;
        sp.y = 540 + i * 30;
        sp.op = p > 0 ? 1 : 0;
        sp.lift = (1 - E.out(p)) * 400;
        sp.place();
      });
      const r = rng(5);
      g.strokeStyle = 'rgba(210,225,255,0.55)';
      g.lineWidth = 2;
      for (let i = 0; i < 160; i++) {
        const x0 = r() * (W + 200);
        const v = 900 + r() * 500;
        const y = ((r() * H + t * v) % (H + 60)) - 30;
        const x = x0 - ((t * v * 0.25) % (W + 200));
        const xx = ((x % (W + 200)) + W + 200) % (W + 200) - 100;
        g.beginPath();
        g.moveTo(xx, y);
        g.lineTo(xx - 6, y + 22);
        g.stroke();
      }
      const bolts = [1.6, 2.9, dur * 0.7];
      let fl = 0;
      bolts.forEach((b) => {
        fl = Math.max(fl, t > b && t < b + 0.35 ? 1 - seg(t, b, b + 0.35) : 0);
      });
      s.flash.style.opacity = fl * 0.75;
      s.tag('A new event every round', t, 1, dur - 0.3);
    },
  });

  const PARADE = ['microraptor', 'compy', 'oviraptor', 'velociraptor', 'dilophosaurus', 'pachy', 'gigantoraptor', 'parasaurolophus', 'triceratops', 'carnotaurus', 'ankylosaurus', 'maiasaura', 'stegosaurus', 'spinosaurus', 'allosaurus', 'quetzalcoatlus', 'brachiosaurus', 'giganotosaurus', 'trex', 'sauroposeidon', 'mosasaurus'];
  const HGT = { microraptor: 90, compy: 80, oviraptor: 110, velociraptor: 115, dilophosaurus: 140, pachy: 120, gigantoraptor: 160, parasaurolophus: 160, triceratops: 150, carnotaurus: 170, ankylosaurus: 115, maiasaura: 150, stegosaurus: 150, spinosaurus: 210, allosaurus: 200, quetzalcoatlus: 190, brachiosaurus: 320, giganotosaurus: 230, trex: 250, sauroposeidon: 330, mosasaurus: 170 };
  scenes.push({
    id: 'parade', min: 14,
    say: 'Twenty-one kinds of dino, from the tiny Microraptor to the mighty Mosasaurus, each with its own shape, its own appetite, and its own special power. Which will you collect?',
    build(root) {
      const bd = backdrop(root, { seed: 33, sunX: 600 });
      const w = world(root);
      const list = PARADE.map((n, i) => {
        const sp = sprite(w.el, D(n), { h: HGT[n], face: n === 'ankylosaurus' ? -1 : 1 });
        return { n, sp, x: 200 + i * 230 };
      });
      deco(w.el, PARADE.map((_, i) => ['plant', 300 + i * 230, 470 + (i % 2) * 8, 50 + (i % 3) * 10]));
      const names = list.map(({ n }) => {
        const e = el('div', 'name', w.el, { zIndex: 4000 });
        e.textContent = { trex: 'T. Rex', pachy: 'Pachycephalosaurus' }[n] || n.charAt(0).toUpperCase() + n.slice(1);
        return e;
      });
      return { bd, w, list, names, tag: tag(root) };
    },
    frame(t, dur, s) {
      const cx = lerp(-200, 200 + 20 * 230 - 900, E.inOut(seg(t, 0.3, dur - 0.6)));
      s.bd.update(t, cx);
      s.w.cam(cx, 1, 400);
      s.list.forEach(({ n, sp, x }, i) => {
        sp.x = x + Math.sin(t * 0.7 + i) * 18;
        sp.y = 620 - (i % 2) * 40;
        sp.dir = 1;
        if (n === 'quetzalcoatlus') {
          sp.lift = 140 + Math.sin(t * 2) * 20;
          sp.sy = 1 + 0.1 * Math.sin(t * 9);
        } else if (n === 'mosasaurus') {
          sp.lift = 30 + Math.sin(t * 2) * 15;
          sp.rot = Math.sin(t * 2) * 8;
        } else pose.walk(sp, t, 0.5, i, 6);
        sp.place();
        const ne = s.names[i];
        const sx = x - cx;
        const vis = sx > -150 && sx < W + 150;
        ne.style.display = vis ? '' : 'none';
        ne.style.transform = `translate(${x}px, ${sp.y + 8}px) translateX(-50%)`;
      });
      s.tag('21 species to collect', t, 1, dur - 0.3);
    },
  });

  scenes.push({
    id: 'rival', min: 12,
    say: 'But you’re not alone. A rival park is growing right next door. Fifteen rounds. Two parks. Only one dynasty.',
    build(root) {
      const halves = ['#e53935', '#1e88e5'].map((col, i) => {
        const h = el('div', '', root, { position: 'absolute', top: 0, left: `${i * 640}px`, width: '640px', height: `${H}px`, overflow: 'hidden', zIndex: 1 });
        const bd = backdrop(h, { seed: 40 + i, sunX: i ? 200 : 900 });
        const w = world(h);
        const pn = pen(w.el, 60 + 640 * 0, 560, { name: i ? 'Rival park' : 'Your park' });
        const sp = sprite(w.el, D(i ? 'brachiosaurus' : 'trex'), { h: i ? 300 : 240 });
        const sp2 = sprite(w.el, D(i ? 'stegosaurus' : 'velociraptor'), { h: i ? 130 : 110 });
        const bar = el('div', '', h, { position: 'absolute', left: 0, right: 0, top: 0, height: '10px', background: col, zIndex: 50 });
        return { h, bd, w, pn, sp, sp2, bar };
      });
      el('div', '', root, { position: 'absolute', left: '636px', top: 0, width: '8px', height: `${H}px`, background: '#fff6e2', zIndex: 60, boxShadow: '0 0 18px rgba(0,0,0,0.4)' });
      const vs = caption(root, '<div class="big" style="font-size:96px">VS</div>');
      const track = el('div', '', root, { position: 'absolute', left: '50%', top: '34px', transform: 'translateX(-50%)', zIndex: 9000, display: 'flex', gap: '8px' });
      const chips = [];
      for (let i = 1; i <= 15; i++) {
        const c = el('div', '', track, { width: '40px', height: '40px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontFamily: 'Lilita One', fontSize: '20px', background: '#fff6e2', color: '#6b4a2a', boxShadow: '0 3px 0 rgba(0,0,0,0.3)' });
        c.textContent = i;
        chips.push(c);
      }
      return { halves, vs, chips, tag: tag(root) };
    },
    frame(t, dur, s) {
      s.halves.forEach((h, i) => {
        h.bd.update(t, 0);
        h.w.cam(0, 1, 400);
        h.pn.draw(t);
        h.sp.x = 300 + Math.sin(t * 0.5 + i) * 60;
        h.sp.y = 600;
        h.sp.dir = i ? -1 : 1;
        pose.walk(h.sp, t, 0.4, i, 5);
        h.sp.place();
        h.sp2.x = 180 + i * 230 + Math.sin(t * 0.8) * 30;
        h.sp2.y = 620;
        h.sp2.dir = i ? -1 : 1;
        pose.walk(h.sp2, t, 0.9, i, 7);
        h.sp2.place();
      });
      s.vs.show(t, 1.2, dur + 1);
      const lit = Math.floor(clamp(seg(t, 2, dur - 1.5)) * 15);
      s.chips.forEach((c, i) => {
        c.style.background = i < lit ? '#ffd24d' : '#fff6e2';
        c.style.transform = i === lit - 1 ? 'scale(1.18)' : '';
      });
      s.tag('15 rounds · 2 parks', t, 1, dur - 0.3);
    },
  });

  scenes.push({
    id: 'end', min: 10, tail: 2.6,
    say: 'Dino Dynasty. Play free against the computer, a friend, or online, at Ahrens Labs.',
    build(root) {
      const bg = el('div', 'full', root, { background: `url(${D('cover')}) center/cover`, filter: 'blur(3px) brightness(0.62)', transform: 'scale(1.06)' });
      const a = sprite(root, D('trex'), { h: 300, x: 210, y: 690 });
      const b = sprite(root, D('brachiosaurus'), { h: 360, x: 1080, y: 690, dir: -1 });
      const title = caption(root, '<div class="big">Dino Dynasty</div><div class="sub">Fence · Feed · Breed · Score</div><div class="pill">Play free at ahrens-labs.github.io</div><div class="sub" style="font-size:24px;margin-top:16px">vs the computer · a friend · online</div>');
      return { bg, a, b, title, fx: canvasLayer(root) };
    },
    frame(t, dur, s) {
      s.title.show(t, 0.2, dur + 2);
      [s.a, s.b].forEach((sp, i) => {
        const p = seg(t, 0.4 + i * 0.25, 1.2 + i * 0.25);
        sp.lift = (1 - E.back(p)) * -260;
        pose.breathe(sp, t, i);
        sp.lift = (1 - E.back(p)) * -260;
        sp.place();
      });
      s.fx.clear();
      sparkle(s.fx.g, W / 2, 300, (t - 0.3) / 1.3, 30, 80, 520, 4);
    },
  });

  runAd(scenes);
})();
