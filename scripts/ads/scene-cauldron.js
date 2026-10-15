// Cauldron Lane ad: a cosy walk through a potion-seller's month, from market to Moon Fair, told with the
// game's painted lane, beasts and townsfolk.
(function () {
  const { W, H, clamp, lerp, seg, E, rng, el, img, caption, runAd } = AD;
  const A = (n) => `sprites/cl/${n}.png`;
  const TAU = Math.PI * 2;

  const style = el('style', '', document.head);
  style.textContent = `
    .plate { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 50% 50%; will-change: transform; }
    .plate > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
    .glow { position: absolute; border-radius: 50%; transform: translate(-50%, -50%); mix-blend-mode: screen; pointer-events: none; }
    .tint { position: absolute; inset: 0; pointer-events: none; }
    .title .big { -webkit-text-stroke: 3px rgba(50, 15, 70, 0.65); text-shadow: 0 6px 0 rgba(55, 18, 75, 0.9), 0 14px 34px rgba(0, 0, 0, 0.6), 0 0 40px rgba(170, 255, 140, 0.3); }
    .title .mid { text-shadow: 0 5px 0 rgba(55, 18, 75, 0.85), 0 12px 26px rgba(0, 0, 0, 0.55); }
    .ring { position: absolute; left: 0; top: 0; z-index: 100; width: 190px; text-align: center; transform-origin: 50% 50%; }
    .ring .pic { width: 160px; height: 160px; margin: 0 auto; border-radius: 50%; overflow: hidden; background: #3b2257;
      box-shadow: 0 0 0 5px #f2c14e, 0 0 0 9px rgba(50, 20, 70, 0.7), 0 14px 30px rgba(0, 0, 0, 0.5); }
    .ring .pic img { width: 100%; height: 100%; display: block; object-fit: cover; }
    .ring .nm { display: inline-block; margin-top: 12px; padding: 5px 14px; border-radius: 999px; background: rgba(255, 246, 226, 0.96); color: #3a1450;
      font: 24px/1.1 "Lilita One", sans-serif; white-space: nowrap; box-shadow: 0 4px 0 rgba(55, 18, 75, 0.55), 0 8px 18px rgba(0, 0, 0, 0.3); }
    .ring .sub { display: block; margin-top: 6px; font: 600 20px/1 Fredoka, sans-serif; color: #fff; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9); }
    .ring .need { position: absolute; right: 6px; top: -8px; width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center; font-size: 30px;
      background: #fff; box-shadow: 0 0 0 3px #f2c14e, 0 6px 14px rgba(0, 0, 0, 0.45); }
    .chip { position: absolute; left: 0; top: 0; z-index: 7400; white-space: nowrap; padding: 12px 24px; border-radius: 18px; transform-origin: 50% 50%;
      background: rgba(40, 16, 58, 0.86); color: #fff6e2; font: 38px/1 "Lilita One", sans-serif; box-shadow: 0 0 0 3px rgba(242, 193, 78, 0.8), 0 12px 30px rgba(0, 0, 0, 0.5); }
    .tok { position: absolute; left: 0; top: 0; z-index: 200; width: 112px; text-align: center; transform-origin: 50% 50%; }
    .tok .ic { width: 96px; height: 96px; margin: 0 auto; border-radius: 50%; display: grid; place-items: center; font-size: 54px;
      background: radial-gradient(circle at 35% 30%, #fffbe9, #e9dcc0); box-shadow: 0 0 0 4px #7a4fa0, 0 10px 22px rgba(0, 0, 0, 0.45); }
    .tok .pr { display: inline-block; margin-top: 10px; padding: 4px 14px; border-radius: 999px; background: #ffd24d; color: #4a2a00; font: 26px/1 "Lilita One", sans-serif;
      box-shadow: 0 4px 0 #b8860b; }
    .tok.next .ic { box-shadow: 0 0 0 5px #8ff07a, 0 0 30px rgba(143, 240, 122, 0.7), 0 10px 22px rgba(0, 0, 0, 0.45); }
    .flask { position: absolute; left: 0; top: 0; z-index: 300; width: 170px; height: 220px; transform-origin: 50% 100%; }
    .flask svg { width: 100%; height: 100%; filter: drop-shadow(0 12px 22px rgba(0, 0, 0, 0.5)); overflow: visible; }
    .label { position: absolute; left: 0; top: 0; z-index: 7400; white-space: nowrap; transform-origin: 50% 50%; padding: 8px 20px; border-radius: 999px;
      background: rgba(255, 246, 226, 0.96); color: #3a1450; font: 32px/1.1 "Lilita One", sans-serif; box-shadow: 0 4px 0 rgba(55, 18, 75, 0.55), 0 10px 22px rgba(0, 0, 0, 0.35); }
    .label b { color: #d99a00; font-weight: 400; }
    .emo { position: absolute; left: 0; top: 0; z-index: 400; font-size: 64px; line-height: 1; transform-origin: 50% 50%; filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.5)); }
    .shop { position: absolute; left: 0; top: 0; z-index: 150; width: 330px; padding: 18px 0; border-radius: 22px; text-align: center; transform: translate(-50%, -50%);
      background: rgba(40, 16, 58, 0.86); color: #fff6e2; font: 40px/1 "Lilita One", sans-serif; box-shadow: 0 0 0 4px var(--c), 0 14px 30px rgba(0, 0, 0, 0.5); }
    .shop .coins { margin-top: 12px; font: 600 34px/1 Fredoka, sans-serif; color: #ffd24d; }
    .track { position: absolute; left: 50%; top: 58%; z-index: 150; display: grid; grid-template-columns: repeat(14, 72px); gap: 8px; transform: translate(-50%, -50%); }
    .track i { position: relative; height: 72px; border-radius: 12px; display: grid; place-items: center; font: normal 26px/1 "Lilita One", sans-serif; color: rgba(255, 246, 226, 0.75);
      background: rgba(40, 16, 58, 0.78); box-shadow: inset 0 0 0 3px rgba(242, 193, 78, 0.35); }
    .track i.mk { background: rgba(80, 40, 20, 0.85); box-shadow: inset 0 0 0 3px rgba(242, 193, 78, 0.8); }
    .track i.moon { background: radial-gradient(circle, #fff8d8, #e8c35a); color: #4a2a00; box-shadow: 0 0 26px rgba(255, 230, 140, 0.8); }
    .pawn { position: absolute; left: 0; top: 0; z-index: 300; width: 40px; height: 40px; border-radius: 50%; border: 4px solid #fff; transform-origin: 50% 100%;
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.5); }`;

  const FLASK = (c) => `<svg viewBox="0 0 100 130"><path d="M38 6h24v10h-4v24c18 7 30 24 30 44 0 26-20 42-38 42S12 110 12 84c0-20 12-37 30-44V16h-4z" fill="rgba(255,255,255,0.35)" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><path d="M15 88c10-6 26-6 35 0s25 6 35 0c-1 22-18 34-35 34S16 110 15 88z" fill="${c}"/><circle cx="34" cy="70" r="6" fill="rgba(255,255,255,0.7)"/><rect x="34" y="0" width="32" height="12" rx="4" fill="#9a6a3a" stroke="#fff" stroke-width="3"/></svg>`;

  // ---------------------------------------------------------------- building blocks
  function plate(root, src, glows = []) {
    const p = el('div', 'plate', root);
    const im = el('img', '', p);
    im.src = src;
    img(src);
    const g = glows.map(([x, y, r, c]) => el('div', 'glow', p, { left: `${x * 100}%`, top: `${y * 100}%`, width: `${r * 2}px`, height: `${r * 2}px`, background: `radial-gradient(closest-side, ${c}, rgba(0,0,0,0))` }));
    return {
      p, g,
      at(s, x = 0, y = 0) {
        p.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
      },
    };
  }
  function ring(root, src, name, sub = '', need = '') {
    const e = el('div', 'ring', root);
    e.innerHTML = `<div class="pic"><img src="${src}"></div>${need ? `<i class="need">${need}</i>` : ''}<span class="nm">${name}</span>${sub ? `<span class="sub">${sub}</span>` : ''}`;
    img(src);
    return e;
  }
  function word(root, cls, html) {
    const e = el('div', cls, root);
    e.innerHTML = html;
    return e;
  }
  // Pop an element in at `a` (and out at `b`), centred on x, y.
  function pop(e, t, a, b, x, y, rot = 0, from = 0.5) {
    const p = seg(t, a, a + 0.45);
    const q = 1 - seg(t, b - 0.35, b);
    const vis = t >= a && t < b;
    e.style.display = vis ? '' : 'none';
    if (!vis) return;
    e.style.opacity = Math.min(p * 2, q);
    e.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${rot}deg) scale(${lerp(from, 1, E.back(p))})`;
  }

  // Fireflies and glittering motes; optional rising steam.
  function motes(root, seed, z = 5000) {
    const c = el('canvas', 'fx', root, { zIndex: z });
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const r = rng(seed);
    const flies = Array.from({ length: 50 }, () => [r() * W, r() * H, 1.2 + r() * 2.6, 8 + r() * 26, r() * TAU]);
    const puffs = Array.from({ length: 26 }, () => [r(), r(), 18 + r() * 30, r() * TAU]);
    return (t, k = {}) => {
      g.clearRect(0, 0, W, H);
      const a = k.flies == null ? 1 : k.flies;
      flies.forEach(([x0, y0, rad, sp, ph]) => {
        const y = (((y0 - t * sp) % H) + H) % H;
        const x = x0 + Math.sin(t * 0.8 + ph) * 22;
        const al = (0.35 + 0.35 * Math.sin(t * 2.3 + ph)) * a;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad * 4);
        gr.addColorStop(0, `rgba(255,240,170,${al})`);
        gr.addColorStop(1, 'rgba(255,240,170,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y, rad * 4, 0, TAU);
        g.fill();
      });
      if (k.steam) {
        const [sx, sy, col] = k.steam;
        puffs.forEach(([u, v, rad, ph]) => {
          const life = (t * 0.35 + v) % 1;
          const x = sx + (u - 0.5) * 120 + Math.sin(t * 1.4 + ph) * 18 * life;
          const y = sy - life * 260;
          g.fillStyle = `rgba(${col},${0.22 * (1 - life) * Math.min(1, life * 6)})`;
          g.beginPath();
          g.arc(x, y, rad * (0.6 + life), 0, TAU);
          g.fill();
        });
      }
    };
  }

  function coin(g, x, y, r, a = 1, spin = 0) {
    g.save();
    g.globalAlpha = a;
    g.translate(x, y);
    g.scale(Math.max(0.15, Math.abs(Math.cos(spin))), 1);
    const gr = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    gr.addColorStop(0, '#fff6c0');
    gr.addColorStop(0.55, '#f2c14e');
    gr.addColorStop(1, '#a8740c');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(120,70,0,0.6)';
    g.lineWidth = r * 0.12;
    g.beginPath();
    g.arc(0, 0, r * 0.7, 0, TAU);
    g.stroke();
    g.restore();
  }

  const at = (f, dur, lead = 0.6) => lead + f * Math.max(1, dur - lead - 0.9);

  // ---------------------------------------------------------------- scenes
  const scenes = [];

  scenes.push({
    id: 'open', min: 8.5, lead: 1.2,
    say: 'Welcome to Cauldron Lane, where the potion shops stand side by side... and only one can be the richest.',
    build(root) {
      const bg = plate(root, A('cover'), [[0.475, 0.15, 130, 'rgba(255,245,200,0.7)'], [0.11, 0.73, 90, 'rgba(160,255,120,0.55)']]);
      const fx = motes(root, 1);
      el('div', 'vignette', root);
      const title = caption(root, '<div class="big">Cauldron Lane</div>');
      return { bg, fx, title };
    },
    frame(t, dur, s) {
      const p = E.sine(seg(t, 0, dur));
      s.bg.at(lerp(1.35, 1.05, p), lerp(0, 0, p), lerp(160, 0, p));
      s.bg.g[0].style.opacity = 0.6 + 0.3 * Math.sin(t * 1.5);
      s.bg.g[1].style.opacity = 0.5 + 0.4 * Math.sin(t * 2.4);
      s.fx(t, { steam: [140, 560, '170,255,140'] });
      s.title.show(t, dur - 3.8, dur + 1, 'pop');
      s.title.e.style.top = '40%';
    },
  });

  const ING = [['🌿', 'Silverleaf'], ['🍄', 'Glowcap'], ['💎', 'Moonstone'], ['💧', 'Starlight dew']];
  const PRICES = [2, 2, 3, 3, 4, 5];
  scenes.push({
    id: 'market', min: 10.5,
    say: 'Buy silverleaf, glowcaps and moonstones at the market. But careful: the more everyone buys, the higher the price climbs.',
    build(root) {
      const bg = plate(root, A('market'));
      el('div', 'tint', root, { background: 'linear-gradient(rgba(40,10,50,0.05), rgba(40,10,50,0.5))', zIndex: 20 });
      const fx = motes(root, 2);
      const ings = ING.map(([i, n]) => word(root, 'label', `${i} ${n}`));
      const toks = PRICES.map((p) => word(root, 'tok', `<div class="ic">🌿</div><span class="pr">🪙${p}</span>`));
      const tag = word(root, 'chip', '📈 Every buy raises the price');
      const c = el('canvas', 'fx', root, { zIndex: 7300 });
      c.width = W;
      c.height = H;
      el('div', 'vignette', root);
      return { bg, fx, ings, toks, tag, g: c.getContext('2d') };
    },
    frame(t, dur, s) {
      s.bg.at(lerp(1.08, 1.2, seg(t, 0, dur)), lerp(30, -30, seg(t, 0, dur)), 0);
      s.fx(t, { flies: 0.4 });
      const swap = at(0.42, dur);
      // First the four market goods, then the silverleaf supply on its price ladder.
      s.ings.forEach((e, i) => pop(e, t, at(0.04 + i * 0.09, dur), swap, 250 + i * 260, 150 + (i % 2) * 30, (i % 2 ? 3 : -3)));
      const buys = [0.6, 0.72, 0.84].map((f) => at(f, dur));
      const g = s.g;
      g.clearRect(0, 0, W, H);
      s.toks.forEach((e, i) => {
        const p = seg(t, swap + i * 0.12, swap + 0.4 + i * 0.12);
        const bought = i < 3 ? seg(t, buys[i], buys[i] + 0.6) : 0;
        const nextIdx = buys.filter((b) => t >= b + 0.6).length;
        e.classList.toggle('next', i === nextIdx);
        const x = 300 + i * 136;
        const y = 300 + (1 - E.out(p)) * 60 - E.in(bought) * 260;
        e.style.display = p > 0 && bought < 1 ? '' : 'none';
        e.style.opacity = Math.min(clamp(p * 2), 1 - bought);
        e.style.transform = `translate(${x - 56}px, ${y - 60}px) scale(${lerp(0.6, 1, E.back(p)) * (i === nextIdx ? 1 + 0.05 * Math.sin(t * 6) : 1)})`;
        if (bought > 0 && bought < 1) coin(g, x + bought * 40, 470 + bought * 120, 18, 1 - bought, t * 8);
      });
      pop(s.tag, t, at(0.62, dur), dur + 1, W / 2, 560, -2);
    },
  });

  const BEASTS = [['griffin', 'Griffin', '2 days'], ['mermaid', 'Mermaid', '2 days'], ['unicorn', 'Unicorn', '3 days'], ['dragon', 'Dragon', '4 days']];
  const BEAST_AT = [0.25, 0.4, 0.55, 0.72];
  scenes.push({
    id: 'hunt', min: 10,
    say: 'For rarer potions, go hunting. Griffin feathers. Mermaid scales. Unicorn hair. Even dragon scales... if you can spare the days.',
    build(root) {
      const bg = plate(root, A('wild'), [[0.71, 0.27, 110, 'rgba(255,140,60,0.6)']]);
      el('div', 'tint', root, { background: 'linear-gradient(rgba(40,10,50,0), rgba(40,10,50,0.45))', zIndex: 20 });
      const fx = motes(root, 3);
      const rings = BEASTS.map(([k, n, d]) => ring(root, A('beast-' + k), n, `⏳ ${d}`));
      el('div', 'vignette', root);
      return { bg, fx, rings };
    },
    frame(t, dur, s) {
      const p = E.inOut(seg(t, 0, dur));
      s.bg.at(lerp(1.05, 1.3, p), lerp(0, -120, p), lerp(-20, 30, p));
      s.bg.g[0].style.opacity = 0.5 + 0.4 * Math.sin(t * 2.6);
      s.fx(t, { steam: [W * 0.71 - 120 * p, H * 0.28, '120,90,80'] });
      s.rings.forEach((e, i) => {
        const a = at(BEAST_AT[i], dur);
        const q = seg(t, a, a + 0.5);
        const x = 200 + i * 290;
        const y = 330 + Math.sin(t * 1.5 + i) * 8 + (i % 2) * 40;
        e.style.display = q > 0 ? '' : 'none';
        e.style.opacity = clamp(q * 2);
        e.style.transform = `translate(${x - 95}px, ${y - 90 + (1 - E.out(q)) * 60}px) scale(${lerp(0.5, 1, E.back(q))}) rotate(${Math.sin(t + i * 2) * 2}deg)`;
      });
    },
  });

  scenes.push({
    id: 'brew', min: 10.5,
    say: 'Back in your shop, brew them into potions. Learn a rare recipe, and you will be the only shop on the lane that can make it.',
    build(root) {
      const bg = plate(root, A('shop'), [[0.47, 0.6, 190, 'rgba(150,255,110,0.65)']]);
      const fx = motes(root, 4);
      const emos = ['🦄', '🌿', '💧'].map((x) => word(root, 'emo', x));
      const flask = word(root, 'flask', FLASK('#e9e4ff'));
      const name = word(root, 'label', 'Unicorn Remedy <b>★★</b>');
      const only = word(root, 'chip', '📜 Only you know this recipe');
      const flash = el('div', 'full', root, { background: 'radial-gradient(circle at 47% 60%, rgba(220,255,200,0.95), rgba(220,255,200,0) 45%)', opacity: 0, zIndex: 250 });
      el('div', 'vignette', root);
      return { bg, fx, emos, flask, name, only, flash };
    },
    frame(t, dur, s) {
      s.bg.at(lerp(1.05, 1.22, E.inOut(seg(t, 0, dur))), 0, lerp(0, -40, seg(t, 0, dur)));
      s.bg.g[0].style.opacity = 0.55 + 0.35 * Math.sin(t * 3);
      const cx = W * 0.47;
      const cy = H * 0.6;
      s.fx(t, { steam: [cx, cy - 20, '170,255,140'], flies: 0.6 });
      s.emos.forEach((e, i) => {
        const a = at(0.08 + i * 0.1, dur);
        const p = seg(t, a, a + 1.0);
        const sx = [180, 640, 1100][i];
        const x = lerp(sx, cx, E.inOut(p));
        const y = lerp(200, cy - 30, E.inOut(p)) - Math.sin(p * Math.PI) * 120;
        e.style.display = p > 0 && p < 1 ? '' : 'none';
        e.style.transform = `translate(${x - 32}px, ${y - 32}px) rotate(${p * 360}deg) scale(${lerp(1, 0.5, p)})`;
      });
      const done = at(0.42, dur);
      s.flash.style.opacity = seg(t, done, done + 0.15) * (1 - seg(t, done + 0.15, done + 0.9));
      const up = seg(t, done + 0.1, done + 0.9);
      s.flask.style.display = up > 0 ? '' : 'none';
      s.flask.style.transform = `translate(${cx - 85 + E.out(up) * 220}px, ${lerp(cy - 220, 160, E.out(up)) + Math.sin(t * 2) * 6}px) scale(${lerp(0.3, 1.1, E.back(up))})`;
      pop(s.name, t, done + 0.6, dur + 1, cx + 220, 430, -2);
      pop(s.only, t, at(0.66, dur), dur + 1, W / 2, 630, 2);
    },
  });

  const FOLK = [['knight', 'Sir Roland', '🛡️'], ['farmer', 'Farmer Bess', '❤️'], ['noble', 'Lady Vane', '✨']];
  const FOLK_AT = [0.3, 0.55, 0.78];
  scenes.push({
    id: 'customers', min: 10.5,
    say: 'Then sell to the townsfolk who ring your doorbell. Knights want protection, farmers want healing, and the baroness wants a little charm.',
    build(root) {
      const bg = plate(root, A('cover'));
      el('div', 'tint', root, { background: 'rgba(30,10,50,0.35)', zIndex: 20 });
      const fx = motes(root, 5);
      const bell = word(root, 'chip', '🔔 Ding-a-ling!');
      const folk = FOLK.map(([k, n, need]) => ring(root, A('folk-' + k), n, '', need));
      const pays = ['+🪙19', '+🪙11', '+🪙30'].map((x) => word(root, 'label', x));
      const c = el('canvas', 'fx', root, { zIndex: 7300 });
      c.width = W;
      c.height = H;
      el('div', 'vignette', root);
      return { bg, fx, bell, folk, pays, g: c.getContext('2d') };
    },
    frame(t, dur, s) {
      s.bg.at(1.15, lerp(60, -60, seg(t, 0, dur)), 40);
      s.bg.p.style.filter = 'blur(2px)';
      s.fx(t);
      pop(s.bell, t, 0.3, at(0.28, dur), W / 2, 130, -3);
      const g = s.g;
      g.clearRect(0, 0, W, H);
      s.folk.forEach((e, i) => {
        const a = at(FOLK_AT[i], dur);
        const p = E.out(seg(t, a - 0.5, a + 0.4));
        const x = lerp(W + 150, 260 + i * 380, p);
        const y = 330 + Math.abs(Math.sin(t * 6 + i)) * 10 * (1 - p);
        e.style.display = p > 0 ? '' : 'none';
        e.style.transform = `translate(${x - 95}px, ${y - 90}px) rotate(${Math.sin(t * 6 + i) * 3 * (1 - p)}deg)`;
        const paid = seg(t, a + 0.9, a + 1.6);
        pop(s.pays[i], t, a + 0.9, dur + 1, 260 + i * 380, 560, (i - 1) * 3);
        const r = rng(10 + i);
        for (let j = 0; j < 8; j++) {
          const ang = -Math.PI / 2 + (r() - 0.5) * 2;
          const q = seg(paid, r() * 0.3, 0.6 + r() * 0.4);
          if (q <= 0 || q >= 1) continue;
          coin(g, 260 + i * 380 + Math.cos(ang) * 140 * q, 470 + Math.sin(ang) * 120 * q + q * q * 120, 14, 1 - q, t * 9 + j);
        }
      });
    },
  });

  scenes.push({
    id: 'rivals', min: 10,
    say: 'Short on stock? Buy from the shop next door. But every potion a rival buys from you puts coins in your pocket.',
    build(root) {
      const bg = plate(root, A('cover'));
      el('div', 'tint', root, { background: 'rgba(30,10,50,0.5)', zIndex: 20 });
      const fx = motes(root, 6);
      const me = word(root, 'shop', '🏠 Your shop<div class="coins"></div>');
      me.style.setProperty('--c', '#8ff07a');
      const them = word(root, 'shop', '🏚️ Next door<div class="coins"></div>');
      them.style.setProperty('--c', '#ff8a6b');
      const f1 = word(root, 'flask', FLASK('#e0464b'));
      const f2 = word(root, 'flask', FLASK('#2aa8c9'));
      const gain = word(root, 'chip', '🪙 +19 for you!');
      const c = el('canvas', 'fx', root, { zIndex: 7300 });
      c.width = W;
      c.height = H;
      el('div', 'vignette', root);
      return { bg, fx, me, them, f1, f2, gain, g: c.getContext('2d') };
    },
    frame(t, dur, s) {
      s.bg.at(1.2, 0, 20);
      s.bg.p.style.filter = 'blur(3px)';
      s.fx(t, { flies: 0.6 });
      const L = 300;
      const R = W - 300;
      const Y = 250;
      const a1 = at(0.12, dur);
      const a2 = at(0.62, dur);
      const p1 = E.inOut(seg(t, a1, a1 + 1.2));
      const p2 = E.inOut(seg(t, a2, a2 + 1.2));
      const mine = 42 - (p1 >= 1 ? 19 : 0) + (p2 >= 1 ? 19 : 0);
      const theirs = 35 + (p1 >= 1 ? 19 : 0) - (p2 >= 1 ? 19 : 0);
      [[s.me, L, mine], [s.them, R, theirs]].forEach(([e, x, n]) => {
        const q = seg(t, 0.2, 0.7);
        e.style.opacity = q;
        e.style.left = `${x}px`;
        e.style.top = `${Y}px`;
        e.querySelector('.coins').textContent = `🪙 ${n}`;
      });
      const arc = (p) => Math.sin(p * Math.PI) * 140;
      const fly = (e, p, x0, x1) => {
        e.style.display = p > 0 && p < 1 ? '' : 'none';
        e.style.transform = `translate(${lerp(x0, x1, p) - 85}px, ${Y + 140 - arc(p)}px) scale(0.55) rotate(${(x1 - x0 > 0 ? 1 : -1) * p * 20}deg)`;
      };
      fly(s.f1, p1, R, L);
      fly(s.f2, p2, L, R);
      const g = s.g;
      g.clearRect(0, 0, W, H);
      [[p1, L, R], [p2, R, L]].forEach(([p, x0, x1]) => {
        for (let j = 0; j < 6; j++) {
          const q = clamp(p * 1.4 - j * 0.08);
          if (q <= 0 || q >= 1) continue;
          coin(g, lerp(x0, x1, q), Y + 420 + Math.sin(q * Math.PI) * -120, 16, 1, t * 8 + j);
        }
      });
      pop(s.gain, t, a2 + 1.2, dur + 1, L, 560, -3);
    },
  });

  const PAWNS = ['#8ff07a', '#ff8a6b', '#6bb8ff', '#e9a7ff'];
  scenes.push({
    id: 'days', min: 10,
    say: 'Every action costs days, and whoever is furthest behind always goes next. Plan carefully... the Moon Fair will not wait.',
    build(root) {
      const bg = plate(root, A('market'));
      el('div', 'tint', root, { background: 'rgba(30,10,50,0.62)', zIndex: 20 });
      const fx = motes(root, 7);
      const track = el('div', 'track', root);
      track.innerHTML = Array.from({ length: 28 }, (_, i) => {
        const d = i + 1;
        return `<i class="${d === 28 ? 'moon' : [4, 8, 12, 16, 20, 24].includes(d) ? 'mk' : ''}">${d === 28 ? '🌕' : [4, 8, 12, 16, 20, 24].includes(d) ? '🛒' : d}</i>`;
      }).join('');
      const pawns = PAWNS.map((c) => el('div', 'pawn', root, { background: c }));
      const tag = word(root, 'chip', '📅 28 days to the Moon Fair');
      el('div', 'vignette', root);
      return { bg, fx, cells: [...track.children], pawns, tag };
    },
    frame(t, dur, s) {
      s.bg.at(1.1, 0, 0);
      s.fx(t, { flies: 0.5 });
      pop(s.tag, t, 0.3, dur + 1, W / 2, 140, -2);
      // Whoever is furthest behind moves next, so the pawns leapfrog each other.
      const pos = [0, 0, 0, 0];
      const cost = [2, 1, 1, 2, 2, 1, 4, 1, 2, 2, 1, 3, 2, 2, 1, 2, 3, 1, 2, 2];
      const step = (dur - 2.4) / cost.length;
      let hop = -1;
      let hp = 0;
      cost.forEach((c, k) => {
        const a = 1.2 + k * step;
        if (t < a) return;
        const who = pos.indexOf(Math.min(...pos));
        const p = seg(t, a, a + step * 0.8);
        if (p < 1) {
          hop = who;
          hp = p;
          pos[who] += c * E.inOut(p);
        } else pos[who] += c;
      });
      const rect = (d) => s.cells[clamp(Math.floor(d), 0, 27)].getBoundingClientRect();
      s.pawns.forEach((e, i) => {
        const d = pos[i];
        const lo = rect(d);
        const hi = rect(Math.min(27, Math.floor(d) + 1));
        const f = d - Math.floor(d);
        const sameRow = Math.abs(lo.top - hi.top) < 2;
        const x = sameRow ? lerp(lo.left, hi.left, f) : f < 0.5 ? lo.left : hi.left;
        const y = sameRow ? lo.top : f < 0.5 ? lo.top : hi.top;
        const lift = hop === i ? Math.sin(hp * Math.PI) * 30 : 0;
        e.style.transform = `translate(${x + 4 + (i % 2) * 28}px, ${y - 22 + Math.floor(i / 2) * 26 - lift}px) scale(0.8)`;
        e.style.zIndex = 300 + (hop === i ? 10 : 0);
      });
    },
  });

  scenes.push({
    id: 'fair', min: 8,
    say: 'And when the Moon Fair arrives, the richest shop on the lane wins.',
    build(root) {
      const bg = plate(root, A('fair'), [[0.445, 0.14, 150, 'rgba(255,245,200,0.75)'], [0.51, 0.68, 110, 'rgba(255,220,120,0.6)']]);
      const fx = motes(root, 8);
      const c = el('canvas', 'fx', root, { zIndex: 7000 });
      c.width = W;
      c.height = H;
      const win = word(root, 'chip', '🏆 The richest shop wins!');
      el('div', 'vignette', root);
      return { bg, fx, g: c.getContext('2d'), win };
    },
    frame(t, dur, s) {
      const p = E.inOut(seg(t, 0, dur));
      s.bg.at(lerp(1.3, 1.42, p), lerp(110, 130, p), lerp(40, 80, p));
      s.bg.g[0].style.opacity = 0.6 + 0.3 * Math.sin(t * 1.4);
      s.bg.g[1].style.opacity = 0.5 + 0.4 * Math.sin(t * 2.2);
      s.fx(t);
      const g = s.g;
      g.clearRect(0, 0, W, H);
      const rain = seg(t, at(0.55, dur), at(0.55, dur) + 0.6);
      if (rain > 0) {
        const r = rng(91);
        for (let i = 0; i < 46; i++) {
          const x = r() * W;
          const sp = 160 + r() * 200;
          const y = ((t * sp + r() * H) % (H + 80)) - 40;
          coin(g, x + Math.sin(t + i) * 20, y, 10 + r() * 8, 0.9 * rain, t * 6 + i);
        }
      }
      pop(s.win, t, at(0.6, dur), dur + 1, W / 2, 600, -2);
    },
  });

  scenes.push({
    id: 'end', min: 8, tail: 2.4,
    say: 'Cauldron Lane. Coming soon, to Ahrens Labs.',
    build(root) {
      const bg = plate(root, A('cover'));
      const fx = motes(root, 9);
      el('div', 'vignette', root);
      const title = caption(root, '<div class="big">Cauldron Lane</div><div class="sub">A potion-shop board game</div><div class="pill">Coming soon to ahrenslabs.com</div>');
      return { bg, fx, title };
    },
    frame(t, dur, s) {
      s.bg.at(1.08 + t * 0.004, 0, 0);
      s.bg.p.style.filter = 'blur(3px) brightness(0.65)';
      s.fx(t, { steam: [140, 560, '170,255,140'] });
      s.title.show(t, 0.3, dur + 2);
    },
  });

  runAd(scenes);
})();
