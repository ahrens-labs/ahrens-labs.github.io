// Hero League ad: comic-book energy over the game's painted city, with real cards from the deck
// showing off the tricks that make each hero different.
(function () {
  const { W, H, clamp, lerp, seg, E, rng, el, img, caption, runAd } = AD;
  const A = (n) => `sprites/hx/${n}.png`;
  const TAU = Math.PI * 2;
  const SUIT = {
    bruiser: ['💪', '#d9473f'], speed: ['⚡', '#e0a514'], tech: ['🔧', '#3b7fd6'], mystic: ['🔮', '#9b59d0'], cosmic: ['🌌', '#4b4fc7'],
    shadow: ['🌑', '#4a5263'], element: ['🔥', '#e8742a'], sidekick: ['⭐', '#3fa860'], gear: ['🛡️', '#a07a3c'], villain: ['💀', '#8c1c3a'],
  };
  const CARD = {
    ironclad: ['Ironclad', 'bruiser', 18], valora: ['Valora', 'bruiser', 20], blur: ['Blur', 'speed', 13], sable: ['Sorcerer Sable', 'mystic', 22],
    mirra: ['Mirra', 'mystic', 1], starbolt: ['Starbolt', 'cosmic', 25], nova: ['Nova', 'cosmic', 14], nightshade: ['Nightshade', 'shadow', 15],
    cinder: ['Cinder', 'element', 15], scout: ['Scout', 'sidekick', 10], hammer: ['Star Hammer', 'gear', 1], kaos: ['Kaos', 'villain', 40],
    crusher: ['The Crusher', 'villain', 30], firewall: ['Firewall', 'tech', 8], mecha: ['Mecha-Max', 'tech', 26],
  };

  const style = el('style', '', document.head);
  style.textContent = `
    .plate { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 50% 50%; will-change: transform; }
    .plate > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
    .tint { position: absolute; inset: 0; pointer-events: none; }
    .title .big { -webkit-text-stroke: 3px rgba(30, 10, 60, 0.7); text-shadow: 0 6px 0 rgba(40, 12, 70, 0.95), 0 14px 34px rgba(0, 0, 0, 0.6), 0 0 40px rgba(255, 200, 80, 0.35); }
    .title .mid { text-shadow: 0 5px 0 rgba(40, 12, 70, 0.9), 0 12px 26px rgba(0, 0, 0, 0.55); }
    .title .pill { background: #ffd24d; color: #3a1d00; }
    .hcard { position: absolute; left: 0; top: 0; z-index: 100; width: 180px; height: 252px; padding: 8px; box-sizing: border-box; border-radius: 16px; transform-origin: 50% 50%;
      background: linear-gradient(160deg, color-mix(in srgb, var(--c) 80%, #fff) 0%, var(--c) 45%, color-mix(in srgb, var(--c) 70%, #000) 100%);
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.75), 0 14px 30px rgba(0, 0, 0, 0.5); }
    .hcard .art { width: 164px; height: 164px; border-radius: 10px; overflow: hidden; background: #111; box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.3); }
    .hcard .art img { width: 100%; height: 100%; display: block; }
    .hcard .pw { position: absolute; left: -14px; top: -14px; width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center;
      background: #ffd24d; color: #3a1d00; font: 30px/1 "Lilita One", sans-serif; box-shadow: 0 0 0 3px #fff, 0 6px 14px rgba(0, 0, 0, 0.45); }
    .hcard .su { position: absolute; right: -10px; top: -10px; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center;
      background: #fff; font-size: 24px; font-style: normal; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4); }
    .hcard .nm { margin-top: 10px; text-align: center; color: #fff; font: 24px/1.05 "Lilita One", sans-serif; white-space: nowrap; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.45); }
    .hback { position: absolute; left: 0; top: 0; z-index: 100; width: 180px; height: 252px; border-radius: 16px; transform-origin: 50% 50%; display: grid; place-items: center;
      background: repeating-linear-gradient(45deg, #2b1d6e 0 14px, #34248a 14px 28px); color: #ffd24d; font: 70px/1 "Lilita One", sans-serif;
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.75), 0 14px 30px rgba(0, 0, 0, 0.5); }
    .pow { position: absolute; left: 0; top: 0; z-index: 7500; white-space: nowrap; transform-origin: 50% 50%;
      font: 74px/1 "Lilita One", sans-serif; color: #ffe14d; -webkit-text-stroke: 3px #2a0d3d; letter-spacing: 0.02em;
      text-shadow: 0 6px 0 #2a0d3d, 0 14px 30px rgba(0, 0, 0, 0.55); }
    .chip { position: absolute; left: 0; top: 0; z-index: 7400; white-space: nowrap; padding: 12px 26px; border-radius: 18px; transform-origin: 50% 50%;
      background: rgba(22, 10, 48, 0.86); color: #fff; font: 40px/1 "Lilita One", sans-serif; box-shadow: 0 0 0 3px rgba(255, 210, 77, 0.8), 0 12px 30px rgba(0, 0, 0, 0.5); }
    .chip.good { box-shadow: 0 0 0 3px #6fe08f, 0 12px 30px rgba(0, 0, 0, 0.5); }
    .chip.bad { box-shadow: 0 0 0 3px #ff6b5e, 0 12px 30px rgba(0, 0, 0, 0.5); }
    .mframe { position: absolute; left: 0; top: 0; z-index: 100; width: 336px; transform-origin: 50% 50%; text-align: center; }
    .mframe .pic { width: 336px; height: 252px; border-radius: 16px; overflow: hidden; box-shadow: 0 0 0 4px #ffd24d, 0 16px 34px rgba(0, 0, 0, 0.55); }
    .mframe .pic img { width: 100%; height: 100%; display: block; object-fit: cover; }
    .mframe .nm { display: inline-block; margin-top: 14px; padding: 6px 18px; border-radius: 999px; background: rgba(255, 246, 226, 0.96); color: #2a0d3d;
      font: 28px/1.1 "Lilita One", sans-serif; white-space: nowrap; box-shadow: 0 4px 0 rgba(40, 12, 70, 0.6), 0 8px 18px rgba(0, 0, 0, 0.3); }
    .ident { position: absolute; left: 50%; top: 46%; z-index: 100; width: 420px; height: 300px; margin: -150px 0 0 -210px; border-radius: 22px; transform-origin: 50% 50%;
      background: linear-gradient(160deg, #3a2470, #1c0f3c); box-shadow: 0 0 0 4px #ffd24d, 0 18px 40px rgba(0, 0, 0, 0.6); text-align: center; color: #fff; }
    .ident .ic { margin-top: 26px; font-size: 96px; line-height: 1; }
    .ident .nm { margin-top: 12px; font: 50px/1 "Lilita One", sans-serif; }
    .ident .rule { margin-top: 12px; font: 600 28px/1.2 Fredoka, sans-serif; color: #ffe9a8; }
    .ident .stamp { position: absolute; right: -36px; top: -26px; padding: 8px 18px; border: 5px solid #ff4b4b; border-radius: 10px; color: #ff4b4b; background: rgba(255, 255, 255, 0.9);
      font: 34px/1 "Lilita One", sans-serif; transform: rotate(12deg); letter-spacing: 0.04em; }
    .pips { position: absolute; left: 50%; top: 62%; z-index: 7000; display: flex; gap: 12px; transform: translate(-50%, -50%); }
    .pips i { width: 70px; height: 96px; border-radius: 10px; display: grid; place-items: center; font: normal 30px/1 "Lilita One", sans-serif; color: rgba(255, 255, 255, 0.55);
      background: rgba(22, 10, 48, 0.7); box-shadow: inset 0 0 0 3px rgba(255, 210, 77, 0.35); }
    .pips i.on { color: #3a1d00; background: #ffd24d; box-shadow: 0 0 22px rgba(255, 210, 77, 0.7); }
    .board { position: absolute; left: 50%; top: 50%; z-index: 7000; width: 760px; transform: translate(-50%, -50%); }
    .row { display: flex; align-items: center; gap: 18px; margin: 18px 0; padding: 14px 24px; border-radius: 18px; background: rgba(22, 10, 48, 0.82);
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.25), 0 12px 26px rgba(0, 0, 0, 0.45); color: #fff; font: 40px/1 "Lilita One", sans-serif; }
    .row .who { width: 330px; white-space: nowrap; }
    .row .bar { flex: 1; height: 22px; border-radius: 999px; background: rgba(255, 255, 255, 0.12); overflow: hidden; }
    .row .bar b { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #ffb13b, #ffe14d); }
    .row .sc { width: 110px; text-align: right; }
    .row.win { box-shadow: 0 0 0 4px #ffd24d, 0 0 40px rgba(255, 210, 77, 0.55), 0 12px 26px rgba(0, 0, 0, 0.45); }`;

  // ---------------------------------------------------------------- building blocks
  function plate(root, src) {
    const p = el('div', 'plate', root);
    const im = el('img', '', p);
    im.src = src;
    img(src);
    return {
      p,
      at(s, x = 0, y = 0) {
        p.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
      },
    };
  }

  function card(root, id) {
    const [name, suit, power] = CARD[id];
    const c = el('div', 'hcard', root);
    c.style.setProperty('--c', SUIT[suit][1]);
    c.innerHTML = `<div class="art"><img src="${A(id)}"></div><b class="pw">${power}</b><i class="su">${SUIT[suit][0]}</i><div class="nm">${name}</div>`;
    img(A(id));
    c.pw = c.querySelector('.pw');
    return c;
  }
  function put(c, x, y, s = 1, rot = 0, op = 1) {
    c.style.display = op > 0.001 ? '' : 'none';
    c.style.opacity = clamp(op);
    c.style.transform = `translate(${x - 90}px, ${y - 126}px) rotate(${rot}deg) scale(${s})`;
  }
  function word(root, cls, html) {
    const e = el('div', cls, root);
    e.innerHTML = html;
    return e;
  }
  // A comic "POW" label that slams in at `a` and leaves at `b`.
  function slam(e, t, a, b, x, y, rot = -6) {
    const p = seg(t, a, a + 0.35);
    const q = 1 - seg(t, b - 0.3, b);
    const vis = t >= a && t < b;
    e.style.display = vis ? '' : 'none';
    if (!vis) return;
    e.style.opacity = Math.min(p * 2, q);
    e.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${rot}deg) scale(${lerp(2.2, 1, E.out(p))})`;
  }

  // Comic speed rays and drifting sparks.
  function rays(root, seed, z = 30) {
    const c = el('canvas', 'fx', root, { zIndex: z });
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const r = rng(seed);
    const sparks = Array.from({ length: 60 }, () => [r() * W, r() * H, 1 + r() * 2.5, 20 + r() * 50, r() * TAU]);
    return (t, k = {}) => {
      g.clearRect(0, 0, W, H);
      const a = k.rays == null ? 0 : k.rays;
      if (a > 0) {
        g.save();
        g.translate(k.x || W / 2, k.y || H / 2);
        g.rotate(t * 0.12);
        const n = 28;
        for (let i = 0; i < n; i++) {
          g.fillStyle = i % 2 ? `rgba(255,214,90,${0.16 * a})` : `rgba(255,120,60,${0.1 * a})`;
          g.beginPath();
          g.moveTo(0, 0);
          g.arc(0, 0, 1600, (i / n) * TAU, ((i + 0.5) / n) * TAU);
          g.closePath();
          g.fill();
        }
        g.restore();
      }
      const sp = k.sparks == null ? 1 : k.sparks;
      sparks.forEach(([x0, y0, rad, s, ph]) => {
        const y = (((y0 - t * s) % H) + H) % H;
        const x = x0 + Math.sin(t * 0.7 + ph) * 16;
        g.fillStyle = `rgba(255,236,170,${(0.25 + 0.25 * Math.sin(t * 2 + ph)) * sp})`;
        g.beginPath();
        g.arc(x, y, rad, 0, TAU);
        g.fill();
      });
    };
  }

  // Narration fraction → scene time (speech starts at `lead` and ends ~0.9s before the cut).
  const at = (f, dur, lead = 0.6) => lead + f * Math.max(1, dur - lead - 0.9);

  // ---------------------------------------------------------------- scenes
  const scenes = [];

  scenes.push({
    id: 'open', min: 8, lead: 1.2,
    say: 'When the city is in trouble, one hero is never enough. You need a league.',
    build(root) {
      const bg = plate(root, A('cover'));
      const fx = rays(root, 1, 40);
      el('div', 'vignette', root);
      const title = caption(root, '<div class="big">Hero League</div>');
      return { bg, fx, title };
    },
    frame(t, dur, s) {
      const p = E.sine(seg(t, 0, dur));
      s.bg.at(lerp(1.3, 1.06, p), lerp(120, 0, p), lerp(-40, 0, p));
      s.fx(t);
      s.title.show(t, dur - 3.6, dur + 1, 'pop');
      s.title.e.style.top = '30%';
    },
  });

  const TEAM = ['starbolt', 'ironclad', 'blur', 'sable', 'scout', 'hammer', 'kaos'];
  const TEAM_AT = [0.12, 0.4, 0.47, 0.55, 0.63, 0.72, 0.86];
  scenes.push({
    id: 'recruit', min: 11,
    say: 'Build a team of seven, from seventy-five heroes. Bruisers and speedsters, mystics and sidekicks, gadgets... and even a villain or two.',
    build(root) {
      const bg = plate(root, A('night'));
      el('div', 'tint', root, { background: 'linear-gradient(rgba(20,8,50,0.35), rgba(20,8,50,0.65))', zIndex: 20 });
      const fx = rays(root, 2, 25);
      const cards = TEAM.map((id) => card(root, id));
      el('div', 'vignette', root);
      return { bg, fx, cards };
    },
    frame(t, dur, s) {
      s.bg.at(1.12 + t * 0.006, lerp(40, -40, seg(t, 0, dur)), 30);
      s.fx(t, { rays: 0.4, y: H * 0.9 });
      s.cards.forEach((c, i) => {
        const a = at(TEAM_AT[i], dur);
        const p = E.out(seg(t, a, a + 0.5));
        const k = i - 3;
        const x = W / 2 + k * 150;
        const y = 380 + k * k * 9 + Math.sin(t * 1.4 + i) * 5;
        put(c, lerp(W / 2, x, p), lerp(H + 200, y, p), lerp(0.6, 1, E.back(seg(t, a, a + 0.5))), lerp(-30, k * 5, p), p > 0 ? 1 : 0);
        c.style.zIndex = 100 + i;
      });
    },
  });

  const PLAZA = ['cinder', 'nova', 'scout', 'mecha'];
  scenes.push({
    id: 'plaza', min: 9,
    say: 'Every turn, draw a hero, then send one to the Plaza... where any rival can snap it up.',
    build(root) {
      const bg = plate(root, A('plaza'));
      el('div', 'tint', root, { background: 'linear-gradient(rgba(30,10,40,0.15), rgba(30,10,40,0.55))', zIndex: 20 });
      const fx = rays(root, 3, 25);
      const lay = PLAZA.map((id) => card(root, id));
      const back = word(root, 'hback', '★');
      const mine = card(root, 'blur');
      const tag = word(root, 'chip', '🏙️ The Plaza');
      const rival = word(root, 'chip bad', '😈 A rival grabs it!');
      el('div', 'vignette', root);
      return { bg, fx, lay, back, mine, tag, rival };
    },
    frame(t, dur, s) {
      s.bg.at(lerp(1.15, 1.25, seg(t, 0, dur)), 60, lerp(10, -10, seg(t, 0, dur)));
      s.fx(t, { sparks: 0.6 });
      const sx = (i) => 300 + i * 170;
      s.lay.forEach((c, i) => put(c, sx(i), 300, 0.82, (i % 2 ? 2 : -2), 1));
      s.tag.style.transform = `translate(${W / 2}px, 110px) translate(-50%, -50%)`;
      // Draw: a face-down card slides off the deck into your hand.
      const d = E.inOut(seg(t, at(0.05, dur), at(0.05, dur) + 0.7));
      const flip = seg(t, at(0.2, dur), at(0.2, dur) + 0.4);
      const sq = Math.abs(Math.cos(flip * Math.PI));
      s.back.style.display = d > 0 && flip < 0.5 ? '' : 'none';
      s.back.style.transform = `translate(${lerp(W + 120, W / 2, d) - 90}px, ${lerp(160, 560, d) - 126}px) rotate(${lerp(25, 0, d)}deg) scale(${sq}, 1)`;
      // ...then the hero you send goes to the Plaza, and a rival takes it.
      const up = E.inOut(seg(t, at(0.42, dur), at(0.42, dur) + 0.8));
      const gone = E.in(seg(t, at(0.86, dur), at(0.86, dur) + 0.7));
      const x = lerp(lerp(W / 2, sx(4), up), W + 260, gone);
      const y = lerp(lerp(560, 300, up), 120, gone);
      const sc = lerp(1, 0.82, up);
      s.mine.style.display = flip >= 0.5 ? '' : 'none';
      s.mine.style.zIndex = 300;
      s.mine.style.transform = `translate(${x - 90}px, ${y - 126}px) rotate(${lerp(0, 2, up) + gone * 30}deg) scale(${sc * sq}, ${sc})`;
      slam(s.rival, t, at(0.74, dur), dur + 1, W * 0.72, 560, -4);
    },
  });

  scenes.push({
    id: 'tricks', min: 14,
    say: 'Every hero has a trick. Valora powers up with the Star Hammer. Starbolt wipes out shadows. Firewall shields your team... and Mirra copies the mightiest hero in the room.',
    build(root) {
      const bg = plate(root, A('night'));
      el('div', 'tint', root, { background: 'rgba(16,6,40,0.55)', zIndex: 20 });
      const fx = rays(root, 4, 25);
      const pairs = [['valora', 'hammer'], ['starbolt', 'nightshade'], ['firewall', 'crusher'], ['mirra', 'kaos']].map((ids) => ids.map((id) => card(root, id)));
      const pows = ['POWER UP!', 'BLANKED!', 'SHIELDED!', 'COPIED!'].map((w) => word(root, 'pow', w));
      const c = el('canvas', 'fx', root, { zIndex: 7300 });
      c.width = W;
      c.height = H;
      el('div', 'vignette', root);
      return { bg, fx, pairs, pows, g: c.getContext('2d') };
    },
    frame(t, dur, s) {
      s.bg.at(1.2, lerp(-60, 60, seg(t, 0, dur)), -40);
      const win = [[0.15, 0.43], [0.43, 0.58], [0.58, 0.71], [0.71, 1.2]].map(([a, b]) => [at(a, dur), Math.min(dur + 1, at(b, dur))]);
      const cur = win.findIndex(([a, b]) => t >= a && t < b);
      s.fx(t, { rays: cur >= 0 ? 0.5 : 0.15, y: H * 0.45 });
      const g = s.g;
      g.clearRect(0, 0, W, H);
      s.pairs.forEach(([l, r], i) => {
        const [a, b] = win[i];
        const p = E.out(seg(t, a, a + 0.5));
        const q = E.in(seg(t, b - 0.35, b));
        const hit = a + (b - a) * 0.4;
        const h = seg(t, hit, hit + 0.3);
        const op = t >= a && t < b ? 1 : 0;
        const bump = Math.sin(h * Math.PI) * 30;
        put(l, lerp(-200, 470, p) + bump, 330 - q * 600, 1.15, -4, op);
        put(r, lerp(W + 200, 810, p) - bump, 330 + q * 600, 1.15, 4, op);
        r.style.filter = '';
        l.style.filter = '';
        if (i === 1) r.style.filter = `grayscale(${h}) brightness(${1 - 0.45 * h})`;
        if (i === 3) {
          l.pw.textContent = h >= 0.5 ? '40' : '1';
          l.pw.style.transform = `scale(${1 + 0.6 * Math.sin(h * Math.PI)})`;
        }
        if (i === 0) l.pw.textContent = h >= 0.5 ? '32' : '20';
        if (op && h > 0 && (i === 0 || i === 2 || i === 3)) {
          // Glow around the card that benefits.
          const cx = 470 + bump;
          g.save();
          g.globalCompositeOperation = 'lighter';
          const col = i === 2 ? '120,220,255' : '255,214,90';
          const gr = g.createRadialGradient(cx, 330, 60, cx, 330, 220);
          gr.addColorStop(0, `rgba(${col},${0.5 * h * (1 - q)})`);
          gr.addColorStop(1, `rgba(${col},0)`);
          g.fillStyle = gr;
          g.fillRect(0, 0, W, H);
          if (i === 2) {
            g.strokeStyle = `rgba(150,230,255,${0.9 * h * (1 - q)})`;
            g.lineWidth = 6;
            g.beginPath();
            g.ellipse(cx, 330, 150 + 6 * Math.sin(t * 6), 190 + 6 * Math.sin(t * 6), 0, 0, TAU);
            g.stroke();
          }
          g.restore();
        }
        slam(s.pows[i], t, hit, b - 0.1, W / 2, 600, i % 2 ? 5 : -5);
      });
    },
  });

  const MISSIONS = [['invasion', 'Alien Invasion'], ['heist', 'The Bank Heist'], ['volcano', 'Volcano Rescue']];
  scenes.push({
    id: 'mission', min: 13.5,
    say: 'Every game has a Mission. Fight off an alien invasion, stop a bank heist, or rescue the city from a volcano. Fit the Mission and score big... or miss it, and pay the price.',
    build(root) {
      const bg = plate(root, A('night'));
      el('div', 'tint', root, { background: 'rgba(16,6,40,0.5)', zIndex: 20 });
      const fx = rays(root, 5, 25);
      const frames = MISSIONS.map(([k, n]) => {
        const f = el('div', 'mframe', root);
        f.innerHTML = `<div class="pic"><img src="${A('mission-' + k)}"></div><span class="nm">${n}</span>`;
        img(A('mission-' + k));
        return f;
      });
      const good = word(root, 'chip good', '✅ Mission complete: +25');
      const bad = word(root, 'chip bad', '❌ Missing a suit: −10');
      el('div', 'vignette', root);
      return { bg, fx, frames, good, bad };
    },
    frame(t, dur, s) {
      s.bg.at(1.15 + t * 0.005, 0, 20);
      s.fx(t, { rays: 0.3 });
      const ts = [0.2, 0.36, 0.5].map((f) => at(f, dur));
      const focus = E.inOut(seg(t, at(0.66, dur), at(0.66, dur) + 0.8));
      s.frames.forEach((f, i) => {
        const p = seg(t, ts[i], ts[i] + 0.5);
        const x = 240 + i * 400;
        const fx = lerp(x, W / 2, focus);
        const sc = i === 0 ? lerp(1, 1.35, focus) : lerp(1, 0.7, focus);
        const op = i === 0 ? 1 : 1 - focus;
        f.style.display = p > 0 ? '' : 'none';
        f.style.opacity = Math.min(clamp(p * 2), op);
        f.style.zIndex = i === 0 ? 200 : 100;
        f.style.transform = `translate(${fx - 168}px, ${lerp(220, 120, focus) + (1 - E.out(p)) * 50}px) scale(${sc * lerp(0.6, 1, E.back(p))}) rotate(${(i - 1) * 3 * (1 - focus)}deg)`;
      });
      slam(s.good, t, at(0.7, dur), dur + 1, W / 2 - 230, 620, -3);
      slam(s.bad, t, at(0.88, dur), dur + 1, W / 2 + 250, 620, 3);
    },
  });

  scenes.push({
    id: 'identity', min: 8,
    say: 'And every league hides a secret identity... a bonus that nobody else knows about.',
    build(root) {
      const bg = plate(root, A('lair'));
      el('div', 'tint', root, { background: 'rgba(20,0,20,0.35)', zIndex: 20 });
      const fx = rays(root, 6, 25);
      const back = word(root, 'hback', '?');
      const id = word(root, 'ident', '<div class="ic">🦇</div><div class="nm">The Vigilante</div><div class="rule">+14 for each Shadow in your hand</div><div class="stamp">TOP SECRET</div>');
      el('div', 'vignette', root);
      return { bg, fx, back, id };
    },
    frame(t, dur, s) {
      s.bg.at(lerp(1.1, 1.3, E.inOut(seg(t, 0, dur))), 0, lerp(0, 30, seg(t, 0, dur)));
      s.fx(t, { sparks: 0.5 });
      const f = seg(t, at(0.45, dur), at(0.45, dur) + 0.6);
      const sx = Math.abs(Math.cos(f * Math.PI));
      const bob = Math.sin(t * 1.5) * 6;
      const sBack = 1.6 * lerp(0.6, 1, E.back(seg(t, 0.3, 1)));
      s.back.style.display = f < 0.5 ? '' : 'none';
      s.back.style.opacity = clamp(seg(t, 0.3, 0.8));
      s.back.style.transform = `translate(${W / 2 - 90}px, ${H * 0.46 - 126 + bob}px) scale(${sBack * sx}, ${sBack})`;
      s.id.style.display = f >= 0.5 ? '' : 'none';
      s.id.style.transform = `translateY(${bob}px) scale(${sx}, 1)`;
    },
  });

  scenes.push({
    id: 'clock', min: 6.5,
    say: 'When the twelfth hero lands in the Plaza... hands down!',
    build(root) {
      const bg = plate(root, A('plaza'));
      el('div', 'tint', root, { background: 'linear-gradient(rgba(20,8,50,0.45), rgba(20,8,50,0.75))', zIndex: 20 });
      const fx = rays(root, 7, 25);
      const pips = el('div', 'pips', root);
      pips.innerHTML = Array.from({ length: 12 }, (_, i) => `<i>${i + 1}</i>`).join('');
      const pow = word(root, 'pow', 'HANDS DOWN!');
      const flash = el('div', 'full', root, { background: '#fff6d0', opacity: 0, zIndex: 8600 });
      el('div', 'vignette', root);
      return { bg, fx, pips: [...pips.children], pow, flash };
    },
    frame(t, dur, s) {
      s.bg.at(1.2, -80, 0);
      const end = dur - 1.9;
      const n = Math.floor(seg(t, 0.5, end) * 11.999) + (t >= end ? 1 : 0);
      s.pips.forEach((e, i) => {
        e.classList.toggle('on', i < n);
        const pop = i === n - 1 ? 1 + 0.25 * (1 - seg(t, 0.5 + (i / 12) * (end - 0.5), 0.8 + (i / 12) * (end - 0.5))) : 1;
        e.style.transform = `scale(${pop})`;
      });
      s.fx(t, { rays: t >= end ? 0.8 : 0, y: H * 0.35 });
      s.flash.style.opacity = 0.7 * seg(t, end, end + 0.05) * (1 - seg(t, end + 0.05, end + 0.5));
      slam(s.pow, t, end, dur + 1, W / 2, H * 0.3, -5);
    },
  });

  const LEAGUES = [['🦸 Your league', 187], ['🤖 Titan Squad', 164], ['🌙 Night Watch', 152]];
  scenes.push({
    id: 'reveal', min: 11,
    say: 'No running scores. Work it out in your head, guess what your rivals are hiding... then flip the cards for the big reveal.',
    build(root) {
      const bg = plate(root, A('night'));
      el('div', 'tint', root, { background: 'rgba(16,6,40,0.6)', zIndex: 20 });
      const fx = rays(root, 8, 25);
      const board = el('div', 'board', root);
      board.innerHTML = LEAGUES.map(([n]) => `<div class="row"><span class="who">${n}</span><span class="bar"><b></b></span><span class="sc">???</span></div>`).join('');
      const crown = word(root, 'pow', '👑 WINNER!');
      el('div', 'vignette', root);
      return { bg, fx, rows: [...board.children], crown };
    },
    frame(t, dur, s) {
      s.bg.at(1.15, 0, lerp(-20, 20, seg(t, 0, dur)));
      const go = at(0.7, dur);
      const p = E.out(seg(t, go, go + 2));
      s.fx(t, { rays: 0.15 + 0.6 * seg(t, go + 2, go + 2.4), y: H * 0.3 });
      s.rows.forEach((r, i) => {
        const e = seg(t, 0.3 + i * 0.25, 0.8 + i * 0.25);
        r.style.opacity = e;
        r.style.transform = `translateX(${(1 - E.out(e)) * -80}px) rotate(${t < go ? Math.sin(t * 9 + i) * 0.6 : 0}deg)`;
        const v = LEAGUES[i][1];
        r.querySelector('.sc').textContent = t < go ? '???' : Math.round(v * p);
        r.querySelector('.bar b').style.width = `${(v / 200) * 100 * p}%`;
        r.classList.toggle('win', i === 0 && p >= 1);
      });
      slam(s.crown, t, go + 2.1, dur + 1, W / 2, 110, -4);
    },
  });

  scenes.push({
    id: 'end', min: 8, tail: 2.4,
    say: 'Hero League. Coming soon, to Ahrens Labs.',
    build(root) {
      const bg = plate(root, A('cover'));
      const fx = rays(root, 9, 40);
      el('div', 'vignette', root);
      const title = caption(root, '<div class="big">Hero League</div><div class="sub">A superhero card game</div><div class="pill">Coming soon to ahrenslabs.com</div>');
      return { bg, fx, title };
    },
    frame(t, dur, s) {
      s.bg.at(1.08 + t * 0.004, 0, 0);
      s.bg.p.style.filter = 'blur(3px) brightness(0.65)';
      s.fx(t, { rays: 0.35 });
      s.title.show(t, 0.3, dur + 2);
    },
  });

  runAd(scenes);
})();
