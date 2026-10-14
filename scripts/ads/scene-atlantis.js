// Atlantis Expedition ad: a dive from the surface to the Heart of Atlantis, told with the game's painted
// art in layered, drifting underwater shots.
(function () {
  const { W, H, clamp, lerp, seg, E, rng, el, img, sprite, caption, runAd } = AD;
  const A = (n) => `sprites/atl/${n}.png`;
  const TAU = Math.PI * 2;

  const style = el('style', '', document.head);
  style.textContent = `
    .plate { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 50% 50%; will-change: transform; }
    .plate > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
    .glow { position: absolute; border-radius: 50%; transform: translate(-50%, -50%); mix-blend-mode: screen; pointer-events: none; }
    .tint { position: absolute; inset: 0; pointer-events: none; }
    .title .big { -webkit-text-stroke: 3px rgba(4, 40, 58, 0.6); text-shadow: 0 6px 0 rgba(4, 38, 56, 0.9), 0 14px 34px rgba(0, 0, 0, 0.6), 0 0 40px rgba(110, 230, 255, 0.35); }
    .title .mid { text-shadow: 0 5px 0 rgba(4, 38, 56, 0.85), 0 12px 26px rgba(0, 0, 0, 0.55); }
    .tag { background: rgba(4, 30, 46, 0.78); color: #e9fbff; box-shadow: 0 0 0 2px rgba(120, 220, 255, 0.35), 0 8px 24px rgba(0, 0, 0, 0.35); }
    .dcard { position: absolute; left: 0; top: 0; width: 170px; text-align: center; transform-origin: 50% 50%; z-index: 50; }
    .dcard .ring { width: 150px; height: 150px; margin: 0 auto; border-radius: 50%; overflow: hidden; background: #0d4a63;
      box-shadow: 0 0 0 5px #f2c14e, 0 0 0 9px rgba(4, 30, 46, 0.7), 0 14px 30px rgba(0, 0, 0, 0.5), 0 0 40px rgba(120, 220, 255, 0.35); }
    .dcard .ring img { width: 100%; height: 100%; display: block; }
    .dcard .nm { display: inline-block; margin-top: 12px; padding: 5px 14px; border-radius: 999px; background: rgba(255, 246, 226, 0.96); color: #08364a;
      font: 22px/1.1 "Lilita One", sans-serif; white-space: nowrap; box-shadow: 0 4px 0 rgba(4, 38, 56, 0.55), 0 8px 18px rgba(0, 0, 0, 0.3); }
    .name { background: rgba(255, 246, 226, 0.96); color: #08364a; box-shadow: 0 4px 0 rgba(4, 38, 56, 0.55), 0 8px 18px rgba(0, 0, 0, 0.3); }
    .die { position: absolute; left: 0; top: 0; width: 210px; height: 210px; z-index: 7000; transform-origin: 50% 50%; }
    .die svg { position: absolute; inset: 0; width: 100%; height: 100%; filter: drop-shadow(0 14px 22px rgba(0, 0, 0, 0.55)); }
    .die b { position: absolute; inset: 0; display: grid; place-items: center; padding-top: 14px; font: 78px/1 "Lilita One", sans-serif; color: #fff;
      text-shadow: 0 4px 0 rgba(0, 0, 0, 0.35); }
    .need { position: absolute; left: 0; top: 0; z-index: 7001; padding: 10px 24px; border-radius: 16px; white-space: nowrap; transform: translate(-50%, -50%);
      background: rgba(4, 30, 46, 0.86); color: #e9fbff; font: 600 30px/1.1 Fredoka, sans-serif; box-shadow: 0 0 0 2px rgba(120, 220, 255, 0.4), 0 10px 26px rgba(0, 0, 0, 0.4); }
    .need b { color: #8ff0b4; font-family: "Lilita One", sans-serif; font-weight: 400; }
    .verdict { position: absolute; left: 50%; top: 0; z-index: 7002; transform: translate(-50%, -50%); white-space: nowrap; font: 64px/1 "Lilita One", sans-serif;
      color: #fff; -webkit-text-stroke: 2px rgba(4, 40, 58, 0.6); text-shadow: 0 5px 0 rgba(4, 38, 56, 0.85), 0 12px 30px rgba(0, 0, 0, 0.55); }
    .hz { position: absolute; left: 0; top: 0; z-index: 7000; padding: 12px 26px; border-radius: 18px; transform: translate(-50%, -50%); white-space: nowrap;
      background: rgba(4, 22, 36, 0.82); color: #fff; font: 44px/1 "Lilita One", sans-serif; letter-spacing: 0.02em;
      box-shadow: 0 0 0 3px rgba(255, 110, 90, 0.75), 0 12px 30px rgba(0, 0, 0, 0.5); }
    .pips { position: absolute; left: 50%; top: 66%; z-index: 7000; display: flex; gap: 16px; transform: translate(-50%, -50%); }
    .pips i { width: 66px; height: 66px; border-radius: 50%; display: grid; place-items: center; font: normal 30px/1 "Lilita One", sans-serif; color: rgba(233, 251, 255, 0.55);
      background: rgba(4, 30, 46, 0.7); box-shadow: inset 0 0 0 3px rgba(120, 220, 255, 0.35); }
    .pips i.on { color: #08364a; background: #f2c14e; box-shadow: 0 0 22px rgba(242, 193, 78, 0.7); }
    .pips i.heart { box-shadow: inset 0 0 0 3px #7ff3ff, 0 0 18px rgba(127, 243, 255, 0.6); }
    .sea { position: absolute; left: 50%; top: 34%; z-index: 7000; transform: translate(-50%, -50%); text-align: center; white-space: nowrap; }
    .sea .ic { font-size: 96px; line-height: 1; filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.5)); }
    .sea .nm { margin-top: 10px; font: 56px/1 "Lilita One", sans-serif; color: #fff; text-shadow: 0 5px 0 rgba(4, 38, 56, 0.85), 0 12px 26px rgba(0, 0, 0, 0.55); }`;

  const D20 = (c) => `<svg viewBox="0 0 100 100"><polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill="${c}" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><polygon points="50,22 76,66 24,66" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.75)" stroke-width="2"/><path d="M50 3 50 22 M93 27 76 66 M7 27 24 66 M50 97 24 66 M50 97 76 66 M93 73 76 66 M7 73 24 66 M7 27 50 22 M93 27 50 22" stroke="rgba(255,255,255,0.5)" stroke-width="1.6" fill="none"/></svg>`;

  // ---------------------------------------------------------------- building blocks
  // A painted backdrop that drifts (Ken Burns). Glows ride along with it.
  function plate(root, src, glows = []) {
    const p = el('div', 'plate', root);
    const im = el('img', '', p);
    im.src = src;
    img(src);
    const g = glows.map(([x, y, r, c]) => el('div', 'glow', p, { left: `${x * 100}%`, top: `${y * 100}%`, width: `${r * 2}px`, height: `${r * 2}px`, background: `radial-gradient(closest-side, ${c}, rgba(0,0,0,0))` }));
    return {
      p, g,
      at(s, x = 0, y = 0, rot = 0) {
        p.style.transform = `translate(${x}px, ${y}px) scale(${s}) rotate(${rot}deg)`;
      },
    };
  }

  // Sun shafts, bubbles and drifting specks, all a pure function of time.
  function waterFx(root, seed, o = {}) {
    const c = el('canvas', 'fx', root, { zIndex: o.z || 5000 });
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const r = rng(seed);
    const bubbles = Array.from({ length: o.bubbles == null ? 46 : o.bubbles }, () => [r() * W, r() * H, 2 + r() * 7, 40 + r() * 90, r() * TAU]);
    const specks = Array.from({ length: o.specks == null ? 90 : o.specks }, () => [r() * W, r() * H, 0.6 + r() * 1.8, 6 + r() * 14, r() * TAU]);
    const rays = Array.from({ length: o.rays == null ? 7 : o.rays }, () => [r() * W, 40 + r() * 120, 0.3 + r() * 0.7, r() * TAU]);
    return (t, k = {}) => {
      g.clearRect(0, 0, W, H);
      const ray = k.rays == null ? 1 : k.rays;
      if (ray > 0) {
        g.save();
        g.globalCompositeOperation = 'screen';
        rays.forEach(([x0, w, a, ph]) => {
          const sway = Math.sin(t * 0.35 + ph) * 60;
          const al = (0.05 + 0.05 * Math.sin(t * 0.8 + ph * 2)) * a * ray;
          const gr = g.createLinearGradient(0, 0, 0, H);
          gr.addColorStop(0, `rgba(210,250,255,${al * 2})`);
          gr.addColorStop(1, 'rgba(210,250,255,0)');
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(x0 + sway - w / 2, -10);
          g.lineTo(x0 + sway + w / 2, -10);
          g.lineTo(x0 + sway * 2.4 + w * 1.6 - 120, H);
          g.lineTo(x0 + sway * 2.4 - w * 0.4 - 120, H);
          g.closePath();
          g.fill();
        });
        g.restore();
      }
      const bub = k.bubbles == null ? 1 : k.bubbles;
      bubbles.forEach(([x0, y0, rad, sp, ph]) => {
        const y = (((y0 - t * sp) % (H + 40)) + H + 40) % (H + 40) - 20;
        const x = x0 + Math.sin(t * 1.6 + ph) * 8;
        g.globalAlpha = 0.55 * bub;
        g.strokeStyle = 'rgba(220,250,255,0.9)';
        g.lineWidth = 1.4;
        g.beginPath();
        g.arc(x, y, rad, 0, TAU);
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.beginPath();
        g.arc(x - rad * 0.35, y - rad * 0.35, rad * 0.25, 0, TAU);
        g.fill();
      });
      g.globalAlpha = 1;
      specks.forEach(([x0, y0, rad, sp, ph]) => {
        const y = (((y0 + t * sp) % H) + H) % H;
        const x = x0 + Math.sin(t * 0.5 + ph) * 14;
        g.fillStyle = `rgba(230,250,255,${0.25 + 0.2 * Math.sin(t + ph)})`;
        g.beginPath();
        g.arc(x, y, rad, 0, TAU);
        g.fill();
      });
    };
  }

  function pearl(g, x, y, r, a = 1) {
    g.save();
    g.globalAlpha = a;
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.5, '#f3ece6');
    gr.addColorStop(0.85, '#cfc4d6');
    gr.addColorStop(1, '#9d93ad');
    g.fillStyle = gr;
    g.shadowColor = 'rgba(255,255,255,0.7)';
    g.shadowBlur = r * 0.8;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.restore();
  }

  // A d20 that tumbles, then lands on `face` at time `land`.
  function die(root, color) {
    const e = el('div', 'die', root);
    e.innerHTML = D20(color) + '<b></b>';
    const n = e.querySelector('b');
    return {
      e,
      at(t, x, y, land, face, o = {}) {
        const vis = t >= (o.from || 0);
        e.style.display = vis ? '' : 'none';
        if (!vis) return;
        const p = seg(t, o.from || 0, land);
        const spin = p < 1 ? (1 - E.out(p)) * 900 : 0;
        const pop = t > land ? 1 + 0.25 * Math.max(0, 1 - (t - land) * 3) * Math.sin(Math.min(1, (t - land) * 3) * Math.PI) : lerp(0.4, 1, E.out(seg(t, o.from || 0, (o.from || 0) + 0.4)));
        const hop = p < 1 ? Math.abs(Math.sin(p * Math.PI * 3)) * 60 * (1 - p) : 0;
        e.style.transform = `translate(${x - 105}px, ${y - 105 - hop}px) rotate(${spin}deg) scale(${pop})`;
        n.textContent = t < land ? 1 + (Math.floor(t * 14) * 7919) % 20 : face;
        e.style.filter = t >= land && o.glow ? `drop-shadow(0 0 ${30 * clamp(1 - (t - land) / 2) + 10}px ${o.glow})` : '';
      },
    };
  }

  // A cut-out that swims: gentle bob and tilt on top of its path.
  function swim(s, t, x, y, ph = 0, amp = 8) {
    s.x = x;
    s.y = y + Math.sin(t * 1.8 + ph) * amp;
    s.rot = Math.sin(t * 1.8 + ph + 1) * 2.5;
    s.place();
  }

  // ---------------------------------------------------------------- scenes
  const scenes = [];

  scenes.push({
    id: 'open', min: 10, lead: 1.2,
    say: 'They say a city lies beneath the waves. A city of gold, and pearls, and secrets.',
    build(root) {
      const bg = plate(root, A('cover'), [[0.63, 0.15, 120, 'rgba(140,255,255,0.75)']]);
      const fx = waterFx(root, 1);
      el('div', 'vignette', root);
      const title = caption(root, '<div class="big">Atlantis Expedition</div>');
      return { bg, fx, title };
    },
    frame(t, dur, s) {
      const p = E.sine(seg(t, 0, dur));
      s.bg.at(lerp(1.28, 1.06, p), lerp(-60, 0, p), lerp(-40, 10, p));
      s.bg.g[0].style.opacity = 0.6 + 0.4 * Math.sin(t * 2.2);
      s.fx(t);
      s.title.show(t, dur - 4.2, dur + 1, 'pop');
    },
  });

  scenes.push({
    id: 'legend', min: 10,
    say: 'Atlantis. And at its heart, a crystal that has waited ten thousand years for someone brave enough to find it.',
    build(root) {
      const bg = plate(root, A('heart'), [[0.63, 0.17, 170, 'rgba(255,240,170,0.8)'], [0.63, 0.17, 70, 'rgba(160,255,255,0.9)']]);
      const fx = waterFx(root, 2, { rays: 9 });
      el('div', 'vignette', root);
      return { bg, fx };
    },
    frame(t, dur, s) {
      const p = E.inOut(seg(t, 0, dur));
      s.bg.at(lerp(1.05, 1.5, p), lerp(0, -150, p), lerp(-20, 170, p));
      s.bg.g[0].style.opacity = 0.55 + 0.35 * Math.sin(t * 1.7);
      s.bg.g[1].style.opacity = 0.5 + 0.5 * Math.sin(t * 3.1);
      s.fx(t);
    },
  });

  scenes.push({
    id: 'race', min: 10,
    say: 'Now two diving companies are racing to get there first. One of them... is yours.',
    build(root) {
      const bg = plate(root, A('surface'), [[0.72, 0.21, 90, 'rgba(255,240,170,0.8)']]);
      const fx = waterFx(root, 3, { bubbles: 30 });
      el('div', 'vignette', root);
      const tag = caption(root, '<div class="mid">⚓ Your company <span style="opacity:.75">vs</span> 🔱 the rival</div>');
      return { bg, fx, tag };
    },
    frame(t, dur, s) {
      const p = E.inOut(seg(t, 0, dur));
      s.bg.at(lerp(1.3, 1.12, p), lerp(30, -20, p), lerp(130, -60, p));
      s.bg.g[0].style.opacity = 0.7 + 0.3 * Math.sin(t * 2);
      s.fx(t, { rays: 0.6 });
      s.tag.e.style.top = '80%';
      s.tag.show(t, dur * 0.5, dur + 1, 'rise');
    },
  });

  const CREW = [['rookie', 'Rookie'], ['wrangler', 'Shark wrangler'], ['caver', 'Cave diver'], ['lamplighter', 'Lamplighter'], ['archaeologist', 'Archaeologist'], ['veteran', 'Veteran'], ['krakenhunter', 'Kraken hunter'], ['captain', 'Captain']];
  scenes.push({
    id: 'crew', min: 13,
    say: 'Hire your crew. Rookies and veterans, shark wranglers and cave divers, lamplighters for the dark, and kraken hunters for... well, the kraken.',
    build(root) {
      const bg = plate(root, A('reef'));
      el('div', 'tint', root, { background: 'linear-gradient(rgba(3,40,60,0.55), rgba(3,30,50,0.75))', zIndex: 20 });
      const fx = waterFx(root, 4, { rays: 5 });
      const cards = CREW.map(([k, n]) => {
        const c = el('div', 'dcard', root);
        c.innerHTML = `<div class="ring"><img src="${A('diver-' + k)}"></div><span class="nm">${n}</span>`;
        img(A('diver-' + k));
        return c;
      });
      el('div', 'vignette', root);
      return { bg, fx, cards };
    },
    frame(t, dur, s) {
      s.bg.at(1.1 + t * 0.006, Math.sin(t * 0.2) * 20, 0);
      s.fx(t, { rays: 0.6 });
      // In the order the narrator names them.
      const order = [0, 5, 1, 2, 3, 4, 6, 7];
      const at = [1.2, 1.9, 3.0, 3.7, 4.8, 6.6, 8.2, 9.2].map((x) => x * Math.max(1, (dur - 2.2) / 10));
      s.cards.forEach((c, i) => {
        const k = order.indexOf(i);
        const p = seg(t, at[k], at[k] + 0.55);
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = 220 + col * 280;
        const y = 205 + row * 255 + Math.sin(t * 1.6 + i) * 7;
        c.style.display = p > 0 ? '' : 'none';
        c.style.opacity = clamp(p * 2);
        c.style.transform = `translate(${x - 85}px, ${y - 90 + (1 - E.out(p)) * 60}px) scale(${lerp(0.5, 1, E.back(p))}) rotate(${Math.sin(t * 1.1 + i * 2) * 2}deg)`;
      });
    },
  });

  const FLEET = [['minnow', 'Minnow', 150, 470], ['barracuda', 'Barracuda', 175, 330], ['nautilus', 'Nautilus', 215, 520], ['leviathan', 'Leviathan', 270, 330]];
  scenes.push({
    id: 'fleet', min: 11,
    say: 'Build your fleet, from a little Minnow all the way up to the mighty Leviathan.',
    build(root) {
      const bg = plate(root, A('reef'));
      el('div', 'tint', root, { background: 'linear-gradient(rgba(3,60,80,0.25), rgba(3,40,60,0.45))', zIndex: 20 });
      const fx = waterFx(root, 5);
      const subs = FLEET.map(([k]) => sprite(root, A('sub-' + k), { h: 100, face: 1, shadow: false }));
      const tags = FLEET.map(([, n]) => {
        const e = el('div', 'name', root, { zIndex: 6000 });
        e.textContent = n;
        return e;
      });
      el('div', 'vignette', root);
      return { bg, fx, subs, tags };
    },
    frame(t, dur, s) {
      s.bg.at(1.12, lerp(30, -30, seg(t, 0, dur)), 0);
      s.fx(t);
      const step = (dur - 1.5) / FLEET.length;
      FLEET.forEach(([, , h, y], i) => {
        const a = -0.4 + i * step;
        const p = seg(t, a, a + step * 2.2);
        const sp = s.subs[i];
        sp.h = h;
        sp.op = p > 0 && p < 1 ? 1 : 0;
        const x = lerp(-300, W + 320, p);
        swim(sp, t, x, y + h / 2, i, 6);
        const tg = s.tags[i];
        const near = clamp(seg(p, 0.2, 0.32)) * (1 - seg(p, 0.68, 0.8));
        tg.style.display = near > 0 ? '' : 'none';
        tg.style.opacity = near;
        tg.style.transform = `translate(${x - 60}px, ${y + h / 2 + 18}px)`;
      });
    },
  });

  // The dive: a crew swims down to a site, sees the number they need, and rolls.
  function diveScene(root, seed) {
    const bg = plate(root, A('reef'));
    const fx = waterFx(root, seed);
    const sub = sprite(root, A('sub-nautilus'), { h: 130, face: 1, shadow: false });
    const divers = [sprite(root, A('swimmer'), { h: 120, face: 1, shadow: false })];
    const need = el('div', 'need', root);
    need.innerHTML = '🎲 You need <b>9 or higher</b>';
    const d = die(root, '#e05a4f');
    const c = el('canvas', 'fx', root, { zIndex: 6900 });
    c.width = W;
    c.height = H;
    const verdict = el('div', 'verdict', root);
    el('div', 'vignette', root);
    return { bg, fx, sub, divers, need, die: d, g: c.getContext('2d'), verdict };
  }
  function drawDive(t, s, o) {
    s.bg.at(lerp(1.12, 1.2, seg(o.T, 0, 20)), lerp(10, -20, seg(o.T, 0, 20)), -10);
    s.fx(o.T);
    swim(s.sub, o.T, lerp(-200, 330, E.out(seg(o.T, 0, 4))), lerp(200, 300, E.out(seg(o.T, 0, 4))), 0, 6);
    s.divers.forEach((dv, i) => {
      const p = E.out(seg(o.T, 1.2 + i * 0.5, 5 + i * 0.5));
      dv.op = clamp(seg(o.T, 1.2 + i * 0.5, 1.6 + i * 0.5));
      dv.h = 125;
      swim(dv, o.T + i, lerp(400, 600, p), lerp(330, 460, p), i * 2, 10);
    });
  }

  scenes.push({
    id: 'dive', min: 9,
    say: 'Pick a site, and you will always know the exact number you need. Then... roll the die.',
    build: (root) => diveScene(root, 6),
    frame(t, dur, s) {
      drawDive(t, s, { T: t });
      const np = seg(t, dur * 0.45, dur * 0.45 + 0.5);
      s.need.style.display = np > 0 ? '' : 'none';
      s.need.style.opacity = np;
      s.need.style.transform = `translate(-50%, -50%) translate(${W * 0.72}px, ${H * 0.2 + (1 - E.out(np)) * 30}px)`;
      s.die.at(t, W * 0.72, H * 0.5, dur + 5, 17, { from: dur - 1.6 });
      s.verdict.style.display = 'none';
    },
  });

  scenes.push({
    id: 'roll', min: 6, lead: 1.1,
    say: 'Seventeen! The pearls are yours.',
    build: (root) => diveScene(root, 6),
    frame(t, dur, s) {
      const T0 = 12;
      drawDive(t, s, { T: T0 + t });
      s.need.style.display = '';
      s.need.style.opacity = 1;
      s.need.style.transform = `translate(-50%, -50%) translate(${W * 0.72}px, ${H * 0.2}px)`;
      s.die.at(t + 0.9, W * 0.72, H * 0.5, 1.75, 17, { from: 0, glow: '#8ff0b4' });
      const v = seg(t, 0.85, 1.3);
      s.verdict.style.display = v > 0 ? '' : 'none';
      s.verdict.style.opacity = v;
      s.verdict.style.top = `${H * 0.8}px`;
      s.verdict.style.left = `${W * 0.72}px`;
      s.verdict.style.transform = `translate(-50%, -50%) scale(${lerp(0.6, 1, E.back(v))})`;
      s.verdict.textContent = 'Pearls!';
      const g = s.g;
      g.clearRect(0, 0, W, H);
      const r = rng(41);
      for (let i = 0; i < 26; i++) {
        const a = r() * TAU;
        const sp = 160 + r() * 260;
        const q = seg(t, 0.85 + r() * 0.3, 3.2 + r() * 0.6);
        if (q <= 0) continue;
        const x = W * 0.72 + Math.cos(a) * sp * E.out(q);
        const y = H * 0.5 + Math.sin(a) * sp * E.out(q) * 0.7 - q * 80 + q * q * 160;
        pearl(g, x, y, 9 + r() * 9, 1 - seg(q, 0.75, 1));
      }
    },
  });

  const HAZ = [['🦈 Sharks', 0.24, 0.24], ['🌀 Currents', 0.74, 0.3], ['🌑 Darkness', 0.3, 0.72], ['🏺 Ancient traps', 0.7, 0.78]];
  scenes.push({
    id: 'danger', min: 12,
    say: 'But the deep is dangerous. Sharks. Currents. Darkness. Ancient traps. Every hazard your crew is not ready for makes the dive harder.',
    build(root) {
      const bg = plate(root, A('kraken'));
      el('div', 'tint', root, { background: 'rgba(2,14,30,0.55)', zIndex: 20 });
      const fx = waterFx(root, 7, { rays: 3, bubbles: 24 });
      const shark = sprite(root, A('shark'), { h: 190, face: 1, shadow: false });
      const c = el('canvas', 'fx', root, { zIndex: 4000 });
      c.width = W;
      c.height = H;
      const tags = HAZ.map(([txt]) => {
        const e = el('div', 'hz', root);
        e.textContent = txt;
        return e;
      });
      el('div', 'vignette', root);
      return { bg, fx, shark, g: c.getContext('2d'), tags };
    },
    frame(t, dur, s) {
      s.bg.at(lerp(1.35, 1.2, seg(t, 0, dur)), 240, 60);
      const dark = clamp(seg(t, dur * 0.42, dur * 0.52)) * (1 - seg(t, dur * 0.62, dur * 0.7));
      s.fx(t, { rays: 1 - dark });
      // The shark cruises past, the current spirals, then the lights dim.
      const sp = seg(t, 0.6, 6);
      s.shark.op = sp > 0 && sp < 1 ? 1 : 0;
      swim(s.shark, t, lerp(-350, W + 380, sp), 360, 0, 12);
      const g = s.g;
      g.clearRect(0, 0, W, H);
      const cur = clamp(seg(t, 2.2, 3)) * (1 - seg(t, 6, 7));
      if (cur > 0) {
        g.save();
        g.translate(W * 0.74, H * 0.52);
        g.strokeStyle = `rgba(190,245,255,${0.45 * cur})`;
        g.lineWidth = 4;
        for (let j = 0; j < 5; j++) {
          g.beginPath();
          for (let a = 0; a < TAU * 1.6; a += 0.08) {
            const rr = 12 + a * 30 + j * 6;
            const aa = a - t * 2.6 + j * 1.25;
            g.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr * 0.55);
          }
          g.stroke();
        }
        g.restore();
      }
      if (dark > 0) {
        g.fillStyle = `rgba(0,0,8,${0.6 * dark})`;
        g.fillRect(0, 0, W, H);
      }
      const at = [0.9, 2.2, 3.4, 4.7].map((x) => x * Math.max(1, (dur - 3) / 7));
      s.tags.forEach((e, i) => {
        const p = seg(t, at[i], at[i] + 0.45);
        e.style.display = p > 0 ? '' : 'none';
        e.style.opacity = clamp(p * 2) * (1 - seg(t, dur - 1.2, dur - 0.6));
        e.style.left = `${HAZ[i][1] * W}px`;
        e.style.top = `${HAZ[i][2] * H}px`;
        e.style.transform = `translate(-50%, -50%) scale(${lerp(0.5, 1, E.back(p))}) rotate(${(i % 2 ? 1 : -1) * 3}deg)`;
      });
    },
  });

  scenes.push({
    id: 'kraken', min: 7, lead: 1,
    say: 'And far below... something stirs.',
    build(root) {
      const bg = plate(root, A('kraken'), [[0.72, 0.3, 40, 'rgba(255,240,170,0.7)']]);
      const fx = waterFx(root, 8, { rays: 4, bubbles: 30 });
      const flash = el('div', 'full', root, { background: '#d8f6ff', opacity: 0, zIndex: 8600 });
      el('div', 'vignette', root);
      return { bg, fx, flash };
    },
    frame(t, dur, s) {
      const p = E.inOut(seg(t, 0, dur));
      const shake = t > dur - 2.4 ? Math.sin(t * 43) * 5 * (1 - seg(t, dur - 1.2, dur)) : 0;
      s.bg.at(lerp(1.0, 1.32, p), lerp(0, -230, p) + shake, lerp(0, 20, p) + shake * 0.6);
      s.bg.g[0].style.opacity = 0;
      s.fx(t, { rays: 0.5 });
      s.flash.style.opacity = 0.5 * seg(t, dur - 2.4, dur - 2.3) * (1 - seg(t, dur - 2.3, dur - 1.7));
    },
  });

  scenes.push({
    id: 'one', min: 6, lead: 1.1,
    say: 'Roll a one... and the Kraken keeps your sub.',
    build(root) {
      const bg = plate(root, A('kraken'));
      el('div', 'tint', root, { background: 'rgba(40,0,10,0.25)', zIndex: 20 });
      const fx = waterFx(root, 9, { rays: 2, bubbles: 30 });
      const d = die(root, '#3f8fd8');
      const verdict = el('div', 'verdict', root);
      el('div', 'vignette', root);
      return { bg, fx, die: d, verdict };
    },
    frame(t, dur, s) {
      const shake = t > 0.9 && t < 1.8 ? Math.sin(t * 50) * 9 : 0;
      s.bg.at(1.32 + t * 0.01, -230 + shake, 20);
      s.fx(t, { rays: 0.4 });
      s.die.at(t + 0.9, W * 0.3, H * 0.42, 1.75, 1, { from: 0, glow: '#ff5a4a' });
      const v = seg(t, 0.85, 1.3);
      s.verdict.style.display = v > 0 ? '' : 'none';
      s.verdict.style.opacity = v;
      s.verdict.style.top = `${H * 0.78}px`;
      s.verdict.style.left = `${W * 0.3}px`;
      s.verdict.style.color = '#ffb3a8';
      s.verdict.style.transform = `translate(-50%, -50%) scale(${lerp(0.6, 1, E.back(v))})`;
      s.verdict.textContent = 'A natural 1!';
    },
  });

  const SEAS = [['⛈️', 'Storm'], ['🦈', 'Feeding frenzy'], ['🗺️', 'Treasure rumors'], ['🐙', 'The Kraken stirs'], ['🥂', 'Sponsors’ gala']];
  scenes.push({
    id: 'tides', min: 12,
    say: 'Ten tides. Every tide the sea changes: storms, shark frenzies, rumours of treasure. Plan ahead, because your rival is planning too.',
    build(root) {
      const bg = plate(root, A('surface'));
      el('div', 'tint', root, { background: 'linear-gradient(rgba(2,30,50,0.6), rgba(2,20,40,0.85))', zIndex: 20 });
      const fx = waterFx(root, 10);
      const pips = el('div', 'pips', root);
      pips.innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${i === 5 ? 'heart' : ''}">${i + 1}</i>`).join('');
      const sea = el('div', 'sea', root);
      el('div', 'vignette', root);
      return { bg, fx, pips: [...pips.children], sea };
    },
    frame(t, dur, s) {
      s.bg.at(1.15, 0, lerp(-80, -110, seg(t, 0, dur)));
      s.fx(t);
      const n = Math.floor(seg(t, 0.4, dur - 1) * 10.99);
      s.pips.forEach((e, i) => e.classList.toggle('on', i < n));
      const per = (dur - 1.2) / SEAS.length;
      const i = clamp(Math.floor((t - 0.6) / per), 0, SEAS.length - 1);
      const lt = t - 0.6 - i * per;
      const p = seg(lt, 0, 0.4);
      const q = i === SEAS.length - 1 ? 0 : seg(lt, per - 0.3, per);
      s.sea.innerHTML = `<div class="ic">${SEAS[i][0]}</div><div class="nm">${SEAS[i][1]}</div>`;
      s.sea.style.opacity = t < 0.6 ? 0 : Math.min(p, 1 - q);
      s.sea.style.transform = `translate(-50%, -50%) scale(${lerp(0.7, 1, E.back(p))})`;
    },
  });

  scenes.push({
    id: 'heart', min: 11,
    say: 'Hire well. Dive smart. Roll high. And claim the Heart of Atlantis.',
    build(root) {
      const bg = plate(root, A('heart'), [[0.63, 0.17, 260, 'rgba(255,240,170,0.85)'], [0.63, 0.17, 90, 'rgba(170,255,255,0.95)']]);
      const fx = waterFx(root, 11, { rays: 10 });
      const c = el('canvas', 'fx', root, { zIndex: 7000 });
      c.width = W;
      c.height = H;
      const white = el('div', 'full', root, { background: '#fffbe8', opacity: 0, zIndex: 8700 });
      el('div', 'vignette', root);
      return { bg, fx, g: c.getContext('2d'), white };
    },
    frame(t, dur, s) {
      const p = E.inOut(seg(t, 0, dur));
      s.bg.at(lerp(1.0, 1.9, p), lerp(0, -250, p), lerp(0, 290, p));
      const burst = seg(t, dur - 2.6, dur - 0.4);
      s.bg.g[0].style.opacity = 0.5 + 0.3 * Math.sin(t * 2) + burst;
      s.bg.g[1].style.opacity = 0.6 + 0.4 * Math.sin(t * 3.3);
      s.fx(t);
      const g = s.g;
      g.clearRect(0, 0, W, H);
      const r = rng(77);
      for (let i = 0; i < 40; i++) {
        const x0 = r() * W;
        const sp = 30 + r() * 50;
        const y = H + 30 - ((t * sp + r() * H) % (H + 60));
        pearl(g, x0 + Math.sin(t + i) * 20, y, 5 + r() * 8, 0.75);
      }
      s.white.style.opacity = E.in(seg(t, dur - 1.8, dur)) * 0.9;
    },
  });

  scenes.push({
    id: 'end', min: 9, tail: 2.4,
    say: 'Atlantis Expedition. Coming soon, to Ahrens Labs.',
    build(root) {
      const bg = plate(root, A('cover'));
      const fx = waterFx(root, 12);
      el('div', 'vignette', root);
      const title = caption(root, '<div class="big">Atlantis Expedition</div><div class="sub">A treasure-diving board game</div><div class="pill">Coming soon to ahrenslabs.com</div>');
      return { bg, fx, title };
    },
    frame(t, dur, s) {
      s.bg.at(1.08 + t * 0.004, 0, 0);
      s.bg.p.style.filter = 'blur(3px) brightness(0.7)';
      s.fx(t);
      s.title.show(t, 0.3, dur + 2);
    },
  });

  runAd(scenes);
})();
