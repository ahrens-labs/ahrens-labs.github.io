// Oakhaven ad: a day (and a night) in a little medieval village, built from the game's own pieces.
(function () {
  const { W, H, clamp, lerp, seg, E, rng, el, sprite, pose, canvasLayer, caption, runAd } = AD;
  const O = (n) => `sprites/oak/${n}.png`;
  const GROUND = 440;
  const BACK = 575; // where the back row of buildings stands
  const STREET = 668; // villagers' feet, hidden behind the front hedge (the art is drawn waist-up)

  // ---------------------------------------------------------------- colour helpers
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, k) => {
    const x = hex(a);
    const y = hex(b);
    return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], clamp(k)))).join(',')})`;
  };
  // Time of day: 0 dawn, 1 day, 2 dusk, 3 night.
  const SKY = [
    ['#6f86c9', '#f4b38c', '#ffe3ae'],
    ['#4fa7e4', '#a6daf4', '#eef2d2'],
    ['#3d3f7e', '#d5786b', '#f6b67a'],
    ['#0b1230', '#1b2756', '#36477a'],
  ];
  const skyAt = (tod) => {
    const i = Math.min(2, Math.floor(tod));
    const k = tod - i;
    return SKY[0].map((_, j) => mix(SKY[i][j], SKY[i + 1][j], k));
  };

  // ---------------------------------------------------------------- painted backdrop
  function wave(x, seed, amp) {
    return Math.sin(x * 0.0019 + seed) * amp + Math.sin(x * 0.0047 + seed * 2.3) * amp * 0.45 + Math.sin(x * 0.012 + seed * 5.1) * amp * 0.15;
  }
  function ridge(width, base, amp, seed, fill) {
    let d = `M0 ${H} L0 ${base}`;
    for (let x = 0; x <= width; x += 40) d += ` L${x} ${(base - Math.abs(wave(x, seed, amp))).toFixed(1)}`;
    return `<path d="${d} L${width} ${H} Z" fill="${fill}"/>`;
  }
  function pines(width, base, seed, cols) {
    const r = rng(seed);
    let s = '';
    for (let x = -40; x < width; x += 26 + r() * 30) {
      const h = 60 + r() * 70;
      const y = base + r() * 14;
      const c = cols[Math.floor(r() * cols.length)];
      s += `<path d="M${x} ${y - h} L${x + h * 0.32} ${y} L${x - h * 0.32} ${y} Z" fill="${c}"/>`;
    }
    return s;
  }

  function backdrop(root, o = {}) {
    const width = o.width || 5200;
    const sky = el('div', 'full', root, { zIndex: 0 });
    const stars = el('div', 'full', root, { zIndex: 1 });
    const r = rng(o.seed || 7);
    let sh = [];
    for (let i = 0; i < 120; i++) sh.push(`${Math.round(r() * 1400)}px ${Math.round(r() * 380)}px 0 ${r() < 0.15 ? 1 : 0}px rgba(255,255,240,${(0.5 + r() * 0.5).toFixed(2)})`);
    el('div', '', stars, { position: 'absolute', left: 0, top: 0, width: '2px', height: '2px', borderRadius: '50%', boxShadow: sh.join(',') });
    const sun = el('div', '', root, {
      position: 'absolute', width: '220px', height: '220px', borderRadius: '50%', zIndex: 1,
      background: 'radial-gradient(circle, #fffbe0 0 22%, rgba(255, 233, 150, 0.7) 36%, rgba(255, 220, 120, 0) 68%)',
    });
    const moon = el('div', '', root, {
      position: 'absolute', width: '90px', height: '90px', borderRadius: '50%', zIndex: 1,
      background: 'radial-gradient(circle at 40% 40%, #fffdf0, #e8e2c4 60%, #cfc7a3)', boxShadow: '0 0 50px 12px rgba(255,250,220,0.35)',
    });
    const clouds = [];
    for (let i = 0; i < 7; i++) {
      const c = el('div', '', root, {
        position: 'absolute', zIndex: 1, width: `${90 + r() * 70}px`, height: '42px', borderRadius: '42px', background: '#fff',
        boxShadow: '40px -22px 0 6px #fff, 86px -6px 0 0 #fff, -30px -10px 0 -2px #fff',
      });
      clouds.push({ c, x: r() * 1700, y: 40 + r() * 140, v: 5 + r() * 9 });
    }
    const far = el('div', 'layer', root, { zIndex: 2 });
    far.innerHTML = `<svg width="${width}" height="${H}">${ridge(width, 350, 110, 1.7, '#9db9c9')}${ridge(width, 395, 70, 3.9, '#88b08f')}</svg>`;
    const mid = el('div', 'layer', root, { zIndex: 3 });
    mid.innerHTML = `<svg width="${width}" height="${H}">${pines(width, GROUND + 4, o.seed || 3, ['#2f6b3a', '#285e33', '#357642'])}</svg>`;
    const shade = el('div', 'full', root, { zIndex: 4, background: '#0b1230', opacity: 0 });
    return {
      // tod: 0 dawn .. 1 day .. 2 dusk .. 3 night
      update(t, camX, tod = 1) {
        const [a, b, c] = skyAt(tod);
        sky.style.background = `linear-gradient(180deg, ${a} 0%, ${b} 46%, ${c} 64%, ${c} 100%)`;
        const night = clamp(tod - 2);
        stars.style.opacity = night;
        const sy = tod <= 1 ? lerp(330, 40, E.out(clamp(tod))) : lerp(40, 360, clamp(tod - 1));
        sun.style.transform = `translate(${(o.sunX || 960) - camX * 0.05}px, ${sy}px)`;
        sun.style.opacity = 1 - night;
        moon.style.transform = `translate(${(o.moonX || 1020) - camX * 0.05}px, ${lerp(300, 60, E.out(night))}px)`;
        moon.style.opacity = night;
        clouds.forEach((k) => {
          const x = ((k.x + t * k.v - camX * 0.1) % 1700 + 1700) % 1700 - 200;
          k.c.style.transform = `translate(${x}px, ${k.y}px)`;
          k.c.style.opacity = 0.85 * (1 - night * 0.8);
        });
        far.style.transform = `translateX(${-camX * 0.25}px)`;
        mid.style.transform = `translateX(${-camX * 0.55}px)`;
        shade.style.opacity = night * 0.45 + clamp(tod - 1.4) * 0.1;
      },
    };
  }

  // The world layer pans and zooms like a camera: grass, a dirt street, and a hedge along the front.
  function world(root, o = {}) {
    const w = el('div', 'world', root, { zIndex: 10 });
    const grass = el('div', '', w, { position: 'absolute', left: '-3000px', top: `${GROUND}px`, width: '12000px', height: '900px' });
    const road = el('div', '', w, {
      position: 'absolute', left: '-3000px', top: `${BACK + 8}px`, width: '12000px', height: '120px', zIndex: 2,
      background: 'linear-gradient(#b48a57, #c79c66 25%, #b88d5a 80%, #9d784a)', borderTop: '4px solid #8f6c40', borderBottom: '4px solid #8f6c40',
    });
    const r = rng(o.seed || 11);
    let tufts = '';
    for (let i = 0; i < 220; i++) {
      const x = -1000 + r() * 7000;
      const y = GROUND + 14 + r() * 125;
      tufts += `<path d="M${x} ${y} l-5 -12 M${x} ${y} l0 -15 M${x} ${y} l6 -11" stroke="#4f8f33" stroke-width="3" stroke-linecap="round"/>`;
      if (i % 4 === 0) tufts += `<circle cx="${x + 9}" cy="${y - 6}" r="4" fill="${['#ffe066', '#ff8fb1', '#ffffff', '#b59cff'][i % 16 / 4]}"/>`;
    }
    for (let i = 0; i < 70; i++) tufts += `<ellipse cx="${-1000 + r() * 7000}" cy="${BACK + 30 + r() * 80}" rx="${4 + r() * 6}" ry="${2 + r() * 3}" fill="#9a7447" opacity="0.6"/>`;
    const deco = el('div', '', w, { position: 'absolute', left: 0, top: 0, zIndex: 3 });
    deco.innerHTML = `<svg width="7000" height="800" style="position:absolute;left:0;top:0;overflow:visible">${tufts}</svg>`;
    // The hedge hides villagers' waists: the art is drawn as busts.
    let hedge = '';
    const hr = rng(21);
    for (let x = -1200; x < 7000; x += 34 + hr() * 20) {
      const rr = 34 + hr() * 18;
      hedge += `<ellipse cx="${x}" cy="${702 + hr() * 8}" rx="${rr * 1.25}" ry="${rr}" fill="${hr() < 0.5 ? '#3f8a3a' : '#4a9a43'}"/>`;
    }
    for (let x = -1200; x < 7000; x += 22 + hr() * 30) hedge += `<circle cx="${x}" cy="${684 + hr() * 40}" r="${4 + hr() * 3}" fill="${['#ffe066', '#ff8fb1', '#ffffff', '#ff6b6b'][Math.floor(hr() * 4)]}"/>`;
    const front = el('div', '', w, { position: 'absolute', left: 0, top: 0, zIndex: 2000 });
    front.innerHTML = `<svg width="7000" height="900" style="position:absolute;left:0;top:0;overflow:visible"><rect x="-1300" y="712" width="8400" height="300" fill="#3d8538"/>${hedge}</svg>`;
    const snow = el('div', '', w, { position: 'absolute', left: '-3000px', top: `${GROUND}px`, width: '12000px', height: '900px', zIndex: 1, background: '#f4f8ff', opacity: 0 });
    const c = { x: 0, z: 1, y: 400, sx: 0, sy: 0 };
    const set = (season = 'summer', k = 1) => {
      const G = { spring: ['#a6d86a', '#6fb24a'], summer: ['#9fd463', '#5ea33c'], autumn: ['#cdbb5a', '#a68a3a'], winter: ['#c9d6c9', '#9fb3a3'] }[season];
      grass.style.background = `linear-gradient(${G[0]}, ${G[1]} 40%)`;
      snow.style.opacity = season === 'winter' ? 0.75 * k : 0;
    };
    set();
    return {
      el: w, front, set,
      hideHedge() { front.style.display = 'none'; },
      at(x, y) {
        return [W / 2 + c.sx + c.z * (x - (c.x + W / 2)), c.y + c.sy + c.z * (y - c.y)];
      },
      cam(x, z = 1, y = 400, shakeX = 0, shakeY = 0) {
        Object.assign(c, { x, z, y, sx: shakeX, sy: shakeY });
        w.style.transform = `translate(${W / 2 + shakeX}px, ${y + shakeY}px) scale(${z}) translate(${-(x + W / 2)}px, ${-y}px)`;
      },
    };
  }

  // A row of buildings along the back of the street: [name, x, h].
  function buildings(parent, list) {
    return list.map(([n, x, h, y]) => {
      const s = sprite(parent, O(n), { x, y: y || BACK, h: h * 1.22, shadow: false });
      s.place();
      return s;
    });
  }
  // A villager walking the street (feet hidden by the hedge).
  function folk(parent, n, h = 190) {
    return sprite(parent, O(n), { h, y: STREET, shadow: false });
  }
  function nameTag(parent) {
    const e = el('div', 'name', parent, { zIndex: 4000 });
    return (text, x, y, a = 1) => {
      e.textContent = text;
      e.style.display = a > 0.01 ? '' : 'none';
      e.style.opacity = a;
      e.style.transform = `translate(${x}px, ${y}px) translateX(-50%)`;
    };
  }

  const tag = (root) => {
    const e = el('div', 'tag', root, { top: '30px', bottom: 'auto' });
    return (text, t, a, b) => {
      e.textContent = text;
      const vis = t >= a && t <= b;
      e.style.display = vis ? '' : 'none';
      const p = E.out(seg(t, a, a + 0.5)) * (1 - seg(t, b - 0.4, b));
      e.style.opacity = p;
      e.style.transform = `translateX(-50%) translateY(${(1 - p) * -30}px)`;
    };
  };

  function emoji(g, ch, x, y, size, a = 1, rot = 0) {
    g.save();
    g.globalAlpha = clamp(a);
    g.translate(x, y);
    g.rotate(rot);
    g.font = `${size}px "Noto Color Emoji", "Apple Color Emoji", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, 0, 0);
    g.restore();
  }
  // A resource popping up from a worker and drifting away.
  function rise(g, ch, x, y, k, size = 40) {
    if (k <= 0 || k >= 1) return;
    emoji(g, ch, x + Math.sin(k * 6) * 6, y - E.out(k) * 90, size * lerp(0.6, 1, E.back(Math.min(1, k * 4))), 1 - seg(k, 0.7, 1));
  }
  function puff(g, x, y, k, size, col = '235,232,225') {
    if (k <= 0 || k >= 1) return;
    g.fillStyle = `rgba(${col},${(1 - k) * 0.75})`;
    g.beginPath();
    g.arc(x, y, size * (0.4 + k), 0, Math.PI * 2);
    g.fill();
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
  function stamp(g, text, x, y, k, col = '#ffd24d', stroke = '#4a2600') {
    if (k <= 0 || k >= 1) return;
    g.save();
    g.globalAlpha = 1 - seg(k, 0.75, 1);
    g.translate(x, y);
    g.rotate(-0.06);
    const s = lerp(1.6, 1, E.out(seg(k, 0, 0.15)));
    g.scale(s, s);
    g.font = '86px "Lilita One"';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = stroke;
    g.fillStyle = col;
    g.strokeText(text, 0, 0);
    g.fillText(text, 0, 0);
    g.restore();
  }

  // ---------------------------------------------------------------- scenes
  const scenes = [];

  scenes.push({
    id: 'open', min: 9, lead: 1.4,
    say: 'Long ago, at the edge of the old forest, a little village woke with the sun.',
    build(root) {
      const bg = el('div', 'full', root, { background: `url(${O('cover')}) center/cover`, transformOrigin: '50% 50%' });
      el('div', 'vignette', root);
      const title = caption(root, '<div class="big">Oakhaven</div><div class="sub">Build the finest village in the land</div>');
      const fx = canvasLayer(root, 8000);
      return { bg, title, fx };
    },
    frame(t, dur, s) {
      const p = t / dur;
      s.bg.style.transform = `scale(${lerp(1.24, 1.04, E.sine(p))}) translate(${lerp(24, -10, p)}px, ${lerp(12, -6, p)}px)`;
      s.title.show(t, dur - 4.2, dur + 1, 'pop');
      s.fx.clear();
      if (t > dur - 4.2) sparkle(s.fx.g, W / 2, H / 2 - 30, (t - (dur - 4.2)) / 1.2, 26, 60, 420, 3);
    },
  });

  scenes.push({
    id: 'morning', min: 12,
    say: 'Farmers head out to the fields, the baker fires up her ovens, and one by one, the people of Oakhaven start their day.',
    build(root) {
      const bd = backdrop(root, { seed: 4, sunX: 900 });
      const w = world(root);
      const b = buildings(w.el, [['house', 120, 200], ['farm', 470, 190], ['well', 760, 150], ['bakery', 1030, 205], ['house', 1330, 200], ['inn', 1620, 220]]);
      const farmer = folk(w.el, 'farmer');
      const peasant = folk(w.el, 'peasant');
      const baker = folk(w.el, 'baker');
      const chef = folk(w.el, 'chef');
      return { bd, w, b, farmer, peasant, baker, chef, fx: canvasLayer(root), tag: tag(root), names: [0, 1, 2, 3].map(() => nameTag(w.el)) };
    },
    frame(t, dur, s) {
      const cx = lerp(-120, 520, E.inOut(seg(t, 0.2, dur - 0.4)));
      s.bd.update(t, cx, lerp(0, 1, E.out(seg(t, 0, dur * 0.7))));
      s.w.cam(cx, 1, 400);
      const g = s.fx.g;
      s.fx.clear();
      // Farmer and peasant stroll out to the farm; the baker stands at her bakery; the chef ambles to the inn.
      const walkers = [
        [s.farmer, lerp(-60, 430, seg(t, 0.4, 6)), 'Farmer'],
        [s.peasant, lerp(-220, 560, seg(t, 1.2, 7.5)), 'Peasant'],
        [s.baker, 1040 + Math.sin(t * 0.7) * 20, 'Baker'],
        [s.chef, lerp(1980, 1640, seg(t, 3, 10)), 'Chef'],
      ];
      walkers.forEach(([sp, x, label], i) => {
        const moving = Math.abs(x - (sp._px == null ? x : sp._px)) > 0.05;
        sp.dir = sp._px != null && x < sp._px ? -1 : 1;
        sp._px = x;
        sp.x = x;
        sp.y = STREET + (i % 2) * 6;
        if (moving) pose.walk(sp, t, 0.8, i, 8);
        else pose.breathe(sp, t, i);
        sp.place();
        const [sx] = s.w.at(x, 0);
        s.names[i](label, x, STREET - sp.h - 46, clamp(seg(t, 1 + i * 0.6, 2 + i * 0.6)) * (sx > 60 && sx < W - 60 ? 1 : 0));
      });
      // Smoke from the bakery chimney, bread popping out.
      for (let i = 0; i < 9; i++) {
        const k = (t * 0.35 + i / 9) % 1;
        const [px, py] = s.w.at(1000 + k * 60 + Math.sin(k * 8) * 10, 400 - k * 160);
        puff(g, px, py, k, 16);
      }
      for (let i = 0; i < 6; i++) {
        const a = 2 + i * 1.4;
        const [px, py] = s.w.at(1040, 500);
        rise(g, '🍞', px, py, seg(t, a, a + 1.6), 40);
      }
      for (let i = 0; i < 4; i++) {
        const a = 5 + i * 1.6;
        const [px, py] = s.w.at(470, 470);
        rise(g, '🍞', px + 30, py, seg(t, a, a + 1.6), 38);
      }
      s.tag('Wake your village', t, 1, dur - 0.3);
    },
  });

  scenes.push({
    id: 'work', min: 13,
    say: 'Everyone has a trade. Woodcutters, stonecutters and miners turn the wild land into timber, stone, iron and gold.',
    build(root) {
      const bd = backdrop(root, { seed: 8, sunX: 700 });
      const w = world(root);
      const b = buildings(w.el, [['lumber', 200, 200], ['quarry', 620, 190], ['mine', 1040, 200], ['smithy', 1460, 200]]);
      const who = [['woodcutter', 330], ['stonecutter', 740], ['miner', 1160], ['blacksmith', 1570]].map(([n, x]) => ({ sp: folk(w.el, n), x, n }));
      return { bd, w, b, who, fx: canvasLayer(root), tag: tag(root), names: who.map(() => nameTag(w.el)) };
    },
    frame(t, dur, s) {
      const cx = lerp(-160, 900, E.inOut(seg(t, 0.3, dur - 0.5)));
      s.bd.update(t, cx, 1);
      s.w.cam(cx, 1, 400);
      const g = s.fx.g;
      s.fx.clear();
      const icons = { woodcutter: '🪵', stonecutter: '🪨', miner: '🔩', blacksmith: '🪙' };
      s.who.forEach(({ sp, x, n }, i) => {
        sp.x = x;
        sp.dir = -1;
        pose.work(sp, t, 0.6, i);
        sp.place();
        const [px, py] = s.w.at(x - 20, STREET - sp.h - 10);
        for (let j = 0; j < 5; j++) {
          const a = 0.8 + i * 0.5 + j * 1.9;
          rise(g, icons[n], px, py, seg(t, a, a + 1.6), 46);
          if (n === 'miner' && j % 2) rise(g, '🪙', px + 40, py + 10, seg(t, a + 0.5, a + 2.1), 40);
        }
        s.names[i](n.charAt(0).toUpperCase() + n.slice(1), x, STREET - sp.h - 50, seg(t, 0.6 + i * 0.4, 1.2 + i * 0.4));
      });
      // Hammer sparks at the smithy.
      for (let j = 0; j < 8; j++) {
        const k = (t * 1.3 + j / 8) % 1;
        const [px, py] = s.w.at(1500, 520);
        sparkle(g, px, py, k, 6, 4, 40, j + 3, '255,180,80');
      }
      s.tag('Gather wood, stone, iron & gold', t, 1, dur - 0.3);
    },
  });

  scenes.push({
    id: 'market', min: 11,
    say: 'At the market, the merchant drives a hard bargain. The steward keeps the books, and down at the inn, there is always something on the stove.',
    build(root) {
      const bd = backdrop(root, { seed: 12, sunX: 500 });
      const w = world(root);
      const b = buildings(w.el, [['market', 260, 190], ['house', 560, 200], ['inn', 860, 220], ['chapel', 1180, 210]]);
      const merchant = folk(w.el, 'merchant');
      const steward = folk(w.el, 'steward');
      const chef = folk(w.el, 'chef');
      return { bd, w, b, merchant, steward, chef, fx: canvasLayer(root), tag: tag(root), names: [0, 1, 2].map(() => nameTag(w.el)) };
    },
    frame(t, dur, s) {
      const cx = lerp(-80, 300, E.inOut(seg(t, 0.3, dur - 0.5)));
      s.bd.update(t, cx, 1);
      s.w.cam(cx, 1, 400);
      const g = s.fx.g;
      s.fx.clear();
      [[s.merchant, 330, 'Merchant'], [s.steward, 600, 'Steward'], [s.chef, 900, 'Chef']].forEach(([sp, x, label], i) => {
        sp.x = x + Math.sin(t * 0.6 + i) * 14;
        sp.dir = i === 1 ? -1 : 1;
        pose.breathe(sp, t * 1.3, i);
        if (i === 0) sp.rot = Math.sin(t * 3) * 3;
        sp.place();
        s.names[i](label, x, STREET - sp.h - 50, seg(t, 0.6 + i * 0.5, 1.2 + i * 0.5));
      });
      // The merchant trades three of one thing for one of another.
      const trades = [['🪵', '🪙'], ['🪨', '🍞'], ['🍞', '🔩']];
      trades.forEach(([give, get], i) => {
        const a = 1.2 + i * 2.6;
        const k = seg(t, a, a + 2.2);
        if (k <= 0 || k >= 1) return;
        const [px, py] = s.w.at(330, 470);
        for (let j = 0; j < 3; j++) emoji(g, give, px - 120 + j * 34 + E.in(seg(k, 0, 0.45)) * (120 - j * 34), py - 30, 36, 1 - seg(k, 0.35, 0.5));
        emoji(g, get, px + E.out(seg(k, 0.45, 0.9)) * 120, py - 30 - Math.sin(seg(k, 0.45, 0.9) * Math.PI) * 50, 46, seg(k, 0.4, 0.5) * (1 - seg(k, 0.85, 1)));
      });
      for (let i = 0; i < 8; i++) {
        const k = (t * 0.3 + i / 8) % 1;
        const [px, py] = s.w.at(910 + Math.sin(k * 7) * 8, 380 - k * 120);
        puff(g, px, py, k, 14);
      }
      s.tag('Trade, plan & feed your people', t, 1, dur - 0.3);
    },
  });

  scenes.push({
    id: 'build', min: 12,
    say: 'With enough timber and stone, the carpenters get to work. Houses, workshops, a chapel... the village grows, one building at a time.',
    build(root) {
      const bd = backdrop(root, { seed: 16, sunX: 1000 });
      const w = world(root);
      const plots = [['house', 260, 200], ['workshop', 620, 190], ['chapel', 980, 215], ['barracks', 1340, 200]].map(([n, x, h]) => ({ sp: sprite(w.el, O(n), { x, y: BACK, h: h * 1.22, shadow: false }), x, n }));
      const carp = folk(w.el, 'carpenter');
      const peasant = folk(w.el, 'peasant');
      return { bd, w, plots, carp, peasant, fx: canvasLayer(root), tag: tag(root) };
    },
    frame(t, dur, s) {
      const cx = lerp(-120, 700, E.inOut(seg(t, 0.3, dur - 0.6)));
      s.bd.update(t, cx, 1);
      s.w.cam(cx, 1, 400);
      const g = s.fx.g;
      s.fx.clear();
      s.plots.forEach(({ sp, x }, i) => {
        const a = 1 + i * 2.4;
        const p = seg(t, a, a + 1.4);
        sp.op = p > 0 ? 1 : 0;
        sp.sy = E.back(p);
        sp.sx = lerp(0.85, 1, E.out(p));
        sp.place();
        for (let j = 0; j < 7; j++) {
          const k = seg(t, a - 0.2 + j * 0.05, a + 1.4);
          const [px, py] = s.w.at(x + (j - 3) * 34, BACK - 10 - (j % 3) * 14);
          puff(g, px + (j - 3) * k * 30, py - k * 30, k, 26, '205,185,150');
        }
        if (t > a + 0.9 && t < a + 2) {
          const [px, py] = s.w.at(x, BACK - sp.h * 0.6);
          sparkle(g, px, py, (t - a - 0.9) / 1.1, 14, 20, 140, i + 1);
        }
      });
      // The carpenter hurries from plot to plot, hammering.
      const idx = clamp(Math.floor((t - 0.4) / 2.4), 0, 3);
      const target = s.plots[idx].x + 110;
      const from = idx ? s.plots[idx - 1].x + 110 : -100;
      const local = (t - 0.4) - idx * 2.4;
      const x = lerp(from, target, E.inOut(seg(local, 0, 0.8)));
      s.carp.x = x;
      s.carp.dir = -1;
      if (local < 0.8) pose.walk(s.carp, t, 1.1, 0, 8);
      else pose.work(s.carp, t, 1.2, 0);
      s.carp.place();
      s.peasant.x = x - 140;
      s.peasant.dir = 1;
      pose.walk(s.peasant, t, 0.9, 1, 7);
      s.peasant.place();
      s.tag('Build up your village', t, 1, dur - 0.3);
    },
  });

  scenes.push({
    id: 'crossroads', min: 13,
    say: 'Word spreads. Travellers gather at the crossroads: a bard, a knight, a priest... even a wizard. Each one will join your village, if you can pay their way.',
    build(root) {
      const bd = backdrop(root, { seed: 20, sunX: 380 });
      const w = world(root);
      const b = buildings(w.el, [['inn', 160, 220], ['tower', 1150, 230]]);
      const post = el('div', '', w.el, { position: 'absolute', left: 0, top: 0, zIndex: BACK + 1, transform: `translate(600px, ${BACK - 210}px)` });
      post.innerHTML = `<svg width="200" height="220" style="overflow:visible"><rect x="92" y="20" width="14" height="200" rx="3" fill="#6b4018"/>
        <path d="M30 40 h120 l22 18 l-22 18 h-120 z" fill="#a8703c" stroke="#5a3412" stroke-width="4"/>
        <path d="M168 90 h-120 l-22 18 l22 18 h120 z" fill="#a8703c" stroke="#5a3412" stroke-width="4"/>
        <text x="88" y="66" font-family="Lilita One" font-size="22" fill="#fff6dc" text-anchor="middle">Oakhaven</text>
        <text x="100" y="116" font-family="Lilita One" font-size="22" fill="#fff6dc" text-anchor="middle">Crossroads</text></svg>`;
      const who = ['bard', 'knight', 'priest', 'wizard', 'guard', 'archer'].map((n) => ({ n, sp: folk(w.el, n) }));
      return { bd, w, b, who, fx: canvasLayer(root), tag: tag(root), names: who.map(() => nameTag(w.el)) };
    },
    frame(t, dur, s) {
      s.bd.update(t, 0, 1);
      s.w.cam(0, lerp(1, 1.06, seg(t, 0, dur)), 420);
      const g = s.fx.g;
      s.fx.clear();
      s.who.forEach(({ n, sp }, i) => {
        const a = 0.6 + i * 1.3;
        const slot = 300 + i * 150;
        const x = lerp(1500 + i * 60, slot, E.out(seg(t, a, a + 2.2)));
        const moving = t > a && t < a + 2;
        sp.x = x;
        sp.y = STREET + (i % 2) * 8;
        sp.dir = -1;
        if (moving) pose.walk(sp, t, 0.9, i, 8);
        else pose.breathe(sp, t, i);
        sp.place();
        s.names[i](n.charAt(0).toUpperCase() + n.slice(1), x, STREET - sp.h - 46, seg(t, a + 1.4, a + 2));
        if (n === 'bard' && t > a + 1.8) {
          for (let j = 0; j < 4; j++) {
            const k = (t * 0.6 + j / 4) % 1;
            const [px, py] = s.w.at(x + 40 + k * 40, STREET - 150 - k * 90);
            emoji(g, j % 2 ? '🎵' : '🎶', px + Math.sin(k * 9) * 10, py, 30, (1 - k) * seg(t, a + 1.8, a + 2.4));
          }
        }
        if (n === 'wizard' && t > a + 2) {
          const [px, py] = s.w.at(x - 50, STREET - sp.h + 10);
          sparkle(g, px, py, ((t - a - 2) % 1.4) / 1.4, 10, 10, 70, i + 9, '190,160,255');
        }
      });
      s.tag('Recruit travellers', t, 1, dur - 0.3);
    },
  });

  scenes.push({
    id: 'seasons', min: 14,
    say: 'The seasons turn. Spring planting, summer sun, an autumn harvest... and then winter, when the firewood burns low and the walls begin to crack.',
    build(root) {
      const bd = backdrop(root, { seed: 24, sunX: 840 });
      const w = world(root);
      const b = buildings(w.el, [['farm', 180, 190], ['house', 500, 200], ['well', 760, 150], ['house', 1000, 195], ['lumber', 1300, 195]]);
      const farmer = folk(w.el, 'farmer');
      const wood = folk(w.el, 'woodcutter');
      const label = caption(root, '', 'title');
      return { bd, w, b, farmer, wood, label, fx: canvasLayer(root), tag: tag(root) };
    },
    frame(t, dur, s) {
      const q = dur / 4;
      const si = clamp(Math.floor(t / q), 0, 3);
      const name = ['spring', 'summer', 'autumn', 'winter'][si];
      const lt = t - si * q;
      s.bd.update(t, 0, si === 3 ? 1.25 : 1);
      s.w.set(name, seg(lt, 0, 1));
      s.w.cam(0, 1, 400);
      s.b.forEach((sp) => {
        sp.filter = si === 3 ? 'brightness(1.05) saturate(0.7)' : si === 2 ? 'sepia(0.15)' : '';
        sp.place();
      });
      s.farmer.x = 320 + Math.sin(t * 0.5) * 60;
      s.farmer.dir = Math.cos(t * 0.5) >= 0 ? 1 : -1;
      pose.walk(s.farmer, t, 0.6, 0, 6);
      s.farmer.place();
      s.wood.x = 1180;
      s.wood.dir = -1;
      pose.work(s.wood, t, 0.6, 1);
      s.wood.place();
      const g = s.fx.g;
      s.fx.clear();
      const r = rng(si + 3);
      for (let i = 0; i < 46; i++) {
        const x0 = r() * (W + 100);
        const v = si === 3 ? 60 + r() * 50 : 50 + r() * 40;
        const y = ((r() * H + lt * v) % (H + 40)) - 20;
        const x = x0 + Math.sin(lt * 1.3 + i) * 30;
        if (si === 0 && i < 26) emoji(g, '🌸', x, y, 18 + (i % 3) * 4, 0.9, lt + i);
        if (si === 2) emoji(g, '🍂', x, y, 24 + (i % 3) * 5, 0.95, lt * 2 + i);
        if (si === 3) {
          g.fillStyle = 'rgba(255,255,255,0.9)';
          g.beginPath();
          g.arc(x, y, 2 + (i % 3) * 1.5, 0, Math.PI * 2);
          g.fill();
        }
      }
      if (si === 1) {
        for (let i = 0; i < 3; i++) {
          const k = seg(lt, 0.5 + i * 0.8, 2 + i * 0.8);
          const [px, py] = s.w.at(180, 480);
          if (k > 0 && k < 1) emoji(g, '🍞', px - 40 + i * 40, py - E.out(k) * 90, 40, 1 - seg(k, 0.7, 1));
        }
      }
      if (si === 3) {
        for (let i = 0; i < 4; i++) {
          const k = seg(lt, 0.4 + i * 0.6, 1.8 + i * 0.6);
          const [px, py] = s.w.at(1180, 520);
          if (k > 0 && k < 1) emoji(g, '🪵', px + E.out(k) * -160, py - Math.sin(k * Math.PI) * 60, 40, 1 - seg(k, 0.75, 1));
        }
      }
      s.label.e.innerHTML = `<div class="mid">${['🌱 Spring', '☀️ Summer', '🍂 Autumn', '❄️ Winter'][si]}</div>`;
      s.label.e.style.top = '27%';
      s.label.show(lt, 0.15, q - 0.1, 'rise');
      s.tag('12 rounds · 4 seasons a year', t, 1, dur - 0.3);
    },
  });

  scenes.push({
    id: 'night', min: 13, music: 'night',
    say: 'But when night falls, things stir in the forest. Wolves at the walls! Guards and archers, to your posts!',
    build(root) {
      const bd = backdrop(root, { seed: 28, moonX: 980 });
      const w = world(root);
      w.hideHedge();
      const back = buildings(w.el, [['house', 180, 190, 520], ['keep', 520, 240, 520], ['house', 840, 190, 520]]);
      const walls = [];
      for (let i = 0; i < 6; i++) walls.push(sprite(w.el, O('wall'), { x: 60 + i * 190, y: 640, h: 120, shadow: false, z: 640 }));
      const tower = sprite(w.el, O('tower'), { x: 1180, y: 680, h: 280, shadow: false });
      const guard = sprite(w.el, O('guard'), { h: 160, shadow: false, z: 630 });
      const guard2 = sprite(w.el, O('guard'), { h: 150, shadow: false, z: 630, dir: -1 });
      const archer = sprite(w.el, O('archer'), { h: 110, shadow: false, z: 690 });
      const wolves = [0, 1].map(() => sprite(w.el, O('wolves'), { h: 120, face: -1 }));
      return { bd, w, back, walls, tower, guard, guard2, archer, wolves, fx: canvasLayer(root), tag: tag(root) };
    },
    frame(t, dur, s) {
      const tod = lerp(2, 3, E.inOut(seg(t, 0, 3.5)));
      s.bd.update(t, 0, tod);
      s.w.cam(lerp(0, 90, E.inOut(seg(t, 3, dur))), 1, 400);
      const dark = clamp(tod - 1.8);
      const f = `brightness(${lerp(1, 0.55, dark)}) saturate(${lerp(1, 0.7, dark)})`;
      s.w.el.style.filter = f;
      [...s.back, ...s.walls].forEach((sp) => sp.place());
      s.tower.place();
      // The guard pops up behind the wall, the archer at the tower.
      const up = E.back(seg(t, 4.2, 4.9));
      s.guard.x = 760;
      s.guard.y = 575 + (1 - up) * 40;
      s.guard.op = clamp(seg(t, 4.2, 4.6));
      s.guard.place();
      const up2 = E.back(seg(t, 4.6, 5.3));
      s.guard2.x = 420;
      s.guard2.y = 580 + (1 - up2) * 40;
      s.guard2.op = clamp(seg(t, 4.6, 5));
      s.guard2.place();
      s.archer.x = 1185;
      s.archer.y = 540 + (1 - up) * 60;
      s.archer.op = up > 0.01 ? 1 : 0;
      s.archer.dir = 1;
      s.archer.place();
      const g = s.fx.g;
      s.fx.clear();
      // Wolves slink in from the forest, then flee from the arrows.
      const fleeAt = 8.6;
      s.wolves.forEach((sp, i) => {
        const inX = lerp(1550 + i * 200, 760 + i * 230, E.out(seg(t, 2.5 + i * 0.4, 6.5)));
        const out = E.in(seg(t, fleeAt, fleeAt + 2));
        sp.x = lerp(inX, 1900, out);
        sp.y = 700 + i * 6;
        sp.z = 900;
        sp.dir = out > 0 ? 1 : -1;
        pose.walk(sp, t, out > 0 ? 1.6 : 0.6, i, out > 0 ? 10 : 4);
        sp.filter = `brightness(${lerp(1, 0.75, dark)})`;
        sp.place();
        // glowing eyes in the dark
      });
      for (let i = 0; i < 7; i++) {
        const a = 5.2 + i * 0.45;
        const k = seg(t, a, a + 0.5);
        if (k <= 0 || k >= 1) continue;
        const [x0, y0] = s.w.at(1210, 380);
        const [x1, y1] = s.w.at(780 + (i % 3) * 110, 680);
        const x = lerp(x0, x1, k);
        const y = lerp(y0, y1, k) - Math.sin(k * Math.PI) * 60;
        const ang = Math.atan2(y1 - y0 + Math.cos(k * Math.PI) * -190, x1 - x0);
        g.save();
        g.translate(x, y);
        g.rotate(ang);
        g.strokeStyle = '#f3e6c4';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(-22, 0);
        g.lineTo(14, 0);
        g.stroke();
        g.fillStyle = '#d9d9d9';
        g.beginPath();
        g.moveTo(20, 0);
        g.lineTo(12, -5);
        g.lineTo(12, 5);
        g.fill();
        g.restore();
      }
      const [sx, sy] = s.w.at(1000, 300);
      stamp(g, 'Driven off!', sx, sy, seg(t, fleeAt + 0.3, fleeAt + 3.2));
      s.tag(t < 7 ? 'Defend your village at night' : 'Walls + guards = defense', t, 1, dur - 0.3);
    },
  });

  const BEASTS = [
    ['goblins', 'Goblin raiders', 140], ['spiders', 'Giant spider', 130], ['harpies', 'Harpy', 150, true], ['skeletons', 'Skeleton host', 140],
    ['troll', 'Troll', 200], ['ogre', 'Ogre', 190], ['griffin', 'Griffin', 170, true], ['wyvern', 'Wyvern', 160, true],
    ['hydra', 'Hydra', 210], ['basilisk', 'Basilisk', 190], ['lich', 'Lich king', 210], ['giant', 'Hill giant', 250],
  ];
  scenes.push({
    id: 'monsters', min: 14, music: 'night',
    say: 'And it isn’t only wolves. Goblins, trolls, skeletons, a hydra, a lich king... Every night brings a new threat, and you never know which one, until it’s at the gates.',
    build(root) {
      const bd = backdrop(root, { seed: 32, moonX: 300 });
      const w = world(root);
      w.hideHedge();
      w.el.style.filter = 'brightness(0.78) saturate(0.8)';
      const list = BEASTS.map(([n, label, h, fly], i) => ({ n, label, fly, x: 260 + i * 250, sp: sprite(w.el, O(n), { h }), name: nameTag(w.el) }));
      const fog = el('div', 'full', root, { zIndex: 4500, background: 'linear-gradient(180deg, rgba(20,30,60,0) 55%, rgba(120,140,190,0.25) 80%, rgba(20,30,60,0.35))' });
      return { bd, w, list, fog, tag: tag(root) };
    },
    frame(t, dur, s) {
      const cx = lerp(-120, 260 + 11 * 250 - 1000, E.inOut(seg(t, 0.3, dur - 0.5)));
      s.bd.update(t, cx, 3);
      s.w.cam(cx, 1, 400);
      s.list.forEach(({ n, label, fly, x, sp, name }, i) => {
        sp.x = x + Math.sin(t * 0.8 + i) * 14;
        sp.y = 620 - (i % 2) * 36;
        if (fly) {
          sp.lift = 140 + Math.sin(t * 2 + i) * 18;
          sp.sy = 1 + 0.06 * Math.sin(t * 8 + i);
        } else pose.walk(sp, t, 0.45, i, 5);
        sp.place();
        // Threats arrive face-down: a card flip before each one is revealed.
        const [scx] = s.w.at(x, 0);
        const rev = seg(scx, W * 0.95, W * 0.7);
        sp.op = 1;
        sp.filter = `brightness(${lerp(0, 1, rev)})`;
        name(rev > 0.6 ? label : '?', x, sp.y + 8, scx > -150 && scx < W + 150 ? 1 : 0);
      });
      s.tag('Hidden threats every night', t, 1, dur - 0.3);
    },
  });

  scenes.push({
    id: 'dragon', min: 13, music: 'night',
    say: 'And once in a long while... a dragon! Walls won’t stop it. Only the bravest knights and the wisest wizards can drive it away.',
    build(root) {
      const bd = backdrop(root, { seed: 36, moonX: 1080 });
      const w = world(root);
      w.hideHedge();
      const back = buildings(w.el, [['house', 120, 190, 560], ['keep', 430, 250, 560], ['wizardtower', 760, 300, 560], ['house', 1040, 190, 560]]);
      const knight = sprite(w.el, O('knight'), { h: 200, shadow: false, z: 700 });
      const wizard = sprite(w.el, O('wizard'), { h: 200, shadow: false, z: 700 });
      const walls = [];
      for (let i = 0; i < 7; i++) walls.push(sprite(w.el, O('wall'), { x: 40 + i * 190, y: 700, h: 110, shadow: false, z: 800 }));
      const dragon = sprite(w.el, O('dragon'), { h: 260, shadow: false, z: 3000 });
      return { bd, w, back, walls, knight, wizard, dragon, fx: canvasLayer(root), tag: tag(root) };
    },
    frame(t, dur, s) {
      s.bd.update(t, 0, 3);
      const shake = t > 3 && t < 5.5 ? Math.sin(t * 40) * 4 : 0;
      s.w.cam(0, 1, 400, shake, shake * 0.5);
      s.w.el.style.filter = 'brightness(0.66) saturate(0.8)';
      [...s.back, ...s.walls].forEach((sp) => sp.place());
      const g = s.fx.g;
      s.fx.clear();
      // The dragon swoops in from the left, breathes fire, takes the hits and flees up and away.
      const inP = E.out(seg(t, 0.5, 3));
      const outP = E.in(seg(t, dur - 4, dur - 1.2));
      s.dragon.x = lerp(-300, 360, inP) + outP * 1400 + Math.sin(t * 1.4) * 30;
      s.dragon.y = lerp(240, 330, inP) - outP * 420 + Math.sin(t * 2.4) * 16;
      s.dragon.sy = 1 + 0.07 * Math.sin(t * 7);
      s.dragon.rot = outP > 0 ? -12 * outP : Math.sin(t * 1.4) * 4;
      const hit = seg(t, 6.2, 6.6) * (1 - seg(t, 7.5, 8));
      s.dragon.filter = hit > 0 ? `brightness(${1 + hit})` : '';
      s.dragon.place();
      if (t > 2.6 && t < 5.4) {
        const [dx, dy] = s.w.at(s.dragon.x + 120, s.dragon.y - 170);
        for (let i = 0; i < 28; i++) {
          const k = ((t - 2.6) * 1.6 + i / 28) % 1;
          const x = dx + k * 260;
          const y = dy + k * 120 + Math.sin(i * 3.7 + t * 12) * k * 30;
          g.fillStyle = `rgba(255,${Math.round(lerp(230, 70, k))},40,${(1 - k) * 0.9})`;
          g.beginPath();
          g.arc(x, y, 6 + k * 22, 0, Math.PI * 2);
          g.fill();
        }
      }
      // Knight and wizard step up.
      const up = E.back(seg(t, 4.6, 5.3));
      s.knight.x = 660;
      s.knight.y = 640 + (1 - up) * 50;
      s.knight.op = clamp(seg(t, 4.6, 5));
      s.knight.place();
      s.wizard.x = 900;
      s.wizard.y = 640 + (1 - up) * 50;
      s.wizard.op = clamp(seg(t, 4.6, 5));
      s.wizard.dir = -1;
      s.wizard.place();
      if (t > 5.8 && t < 8) {
        const k = seg(t, 5.8, 6.4);
        const [x0, y0] = s.w.at(760, 290);
        const [x1, y1] = s.w.at(s.dragon.x, s.dragon.y - 130);
        const fade = 1 - seg(t, 7.4, 8);
        g.save();
        g.globalAlpha = fade;
        g.strokeStyle = 'rgba(190,150,255,0.9)';
        g.lineWidth = 14 + Math.sin(t * 40) * 4;
        g.shadowColor = '#c9a6ff';
        g.shadowBlur = 30;
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(lerp(x0, x1, k), lerp(y0, y1, k));
        g.stroke();
        g.restore();
        if (k >= 1) sparkle(g, x1, y1, ((t - 6.4) % 0.8) / 0.8, 16, 10, 120, 4, '200,170,255');
      }
      if (t > 6 && t < 8) {
        const [kx, ky] = s.w.at(700, 540);
        sparkle(g, kx, ky, ((t - 6) % 0.7) / 0.7, 10, 10, 80, 7, '255,240,190');
      }
      const [sx, sy] = s.w.at(640, 250);
      stamp(g, 'Victory!', sx, sy, seg(t, dur - 3.4, dur - 0.2));
      s.tag(t < 5 ? 'Flying foes ignore walls' : 'Knights & wizards to the rescue', t, 1, dur - 0.3);
    },
  });

  scenes.push({
    id: 'festival', min: 13,
    say: 'Survive the night, and the whole village celebrates. Raise a castle, a cathedral, a mighty keep... and become the most renowned village in the land.',
    build(root) {
      const bd = backdrop(root, { seed: 40, sunX: 980 });
      const w = world(root);
      const b = buildings(w.el, [['castle', 260, 270], ['cathedral', 640, 280], ['keep', 980, 240], ['barracks', 1300, 210], ['wizardtower', 1580, 290]]);
      const crowd = ['bard', 'farmer', 'baker', 'knight', 'peasant', 'priest', 'merchant', 'wizard', 'chef'].map((n, i) => ({ n, sp: folk(w.el, n, 170), x: 120 + i * 175 }));
      return { bd, w, b, crowd, fx: canvasLayer(root), tag: tag(root) };
    },
    frame(t, dur, s) {
      const cx = lerp(-40, 520, E.inOut(seg(t, 0.3, dur - 0.5)));
      s.bd.update(t, cx, lerp(0.4, 1, seg(t, 0, 3)));
      s.w.cam(cx, 1, 400);
      const g = s.fx.g;
      s.fx.clear();
      s.crowd.forEach(({ n, sp, x }, i) => {
        sp.x = x + Math.sin(t * 1.5 + i) * 12;
        sp.y = STREET + (i % 2) * 8;
        sp.dir = i % 2 ? -1 : 1;
        pose.hop(sp, t, 1.4, i * 0.31, 22);
        sp.place();
        if (n === 'bard') {
          for (let j = 0; j < 4; j++) {
            const k = (t * 0.6 + j / 4) % 1;
            const [px, py] = s.w.at(x + 40 + k * 50, STREET - 150 - k * 100);
            emoji(g, j % 2 ? '🎵' : '🎶', px + Math.sin(k * 9) * 10, py, 32, 1 - k);
          }
        }
      });
      // Bunting confetti and renown stars.
      const r = rng(9);
      for (let i = 0; i < 40; i++) {
        const x = r() * W + Math.sin(t * 1.2 + i) * 30;
        const y = ((r() * H + t * (70 + r() * 60)) % (H + 40)) - 20;
        g.fillStyle = ['#ffd24d', '#ff6b6b', '#6bc5ff', '#8ee06b', '#ff9de2'][i % 5];
        g.save();
        g.translate(x, y);
        g.rotate(t * 3 + i);
        g.fillRect(-5, -3, 10, 6);
        g.restore();
      }
      for (let i = 0; i < 5; i++) {
        const a = 2 + i * 1.8;
        const [px, py] = s.w.at(260 + i * 340, 360);
        const k = seg(t, a, a + 1.8);
        if (k > 0 && k < 1) emoji(g, '⭐', px, py - E.out(k) * 100, 50 * lerp(0.5, 1, E.back(Math.min(1, k * 3))), 1 - seg(k, 0.7, 1));
      }
      s.tag('Earn renown · win the game', t, 1, dur - 0.3);
    },
  });

  scenes.push({
    id: 'end', min: 10, tail: 2.6,
    say: 'Oakhaven. Play free against the computer, a friend, or online, at Ahrens Labs.',
    build(root) {
      const bg = el('div', 'full', root, { background: `url(${O('cover')}) center/cover`, filter: 'blur(3px) brightness(0.6)', transform: 'scale(1.06)' });
      const a = sprite(root, O('knight'), { h: 330, x: 200, y: 740, shadow: false });
      const b = sprite(root, O('wizard'), { h: 330, x: 1080, y: 740, dir: -1, shadow: false });
      const title = caption(root, '<div class="big">Oakhaven</div><div class="sub">Build · Recruit · Defend · Score</div><div class="pill">Play free at ahrens-labs.github.io</div><div class="sub" style="font-size:24px;margin-top:16px">vs the computer · a friend · online</div>');
      return { bg, a, b, title, fx: canvasLayer(root) };
    },
    frame(t, dur, s) {
      s.title.show(t, 0.2, dur + 2);
      [s.a, s.b].forEach((sp, i) => {
        const p = seg(t, 0.4 + i * 0.25, 1.2 + i * 0.25);
        pose.breathe(sp, t, i);
        sp.lift = (1 - E.back(p)) * -300;
        sp.place();
      });
      s.fx.clear();
      sparkle(s.fx.g, W / 2, 300, (t - 0.3) / 1.3, 30, 80, 520, 4);
    },
  });

  runAd(scenes);
})();
