// The Masquerade Court ad: a candlelit Venetian ballroom, the game's seven mask cards dealt, flipped, accused and
// torn away, with gilded captions. Everything is drawn from the site's own art (/img/masquerade).
(function () {
  const { W, H, clamp, lerp, seg, E, rng, el, img, caption, canvasLayer, runAd } = AD;
  const ART = (k) => `/img/masquerade/${k}.webp`;
  const TAU = Math.PI * 2;
  const MASKS = {
    doge: ['The Doge', '#b8282e'], duchess: ['The Duchess', '#d9668f'], jester: ['The Jester', '#7a3fb0'], poisoner: ['The Poisoner', '#1f7a4a'],
    doctor: ['The Plague Doctor', '#1f6f78'], gondolier: ['The Gondolier', '#2a4fa0'], spy: ['The Spy', '#4a5263'],
  };
  const ORDER = Object.keys(MASKS);
  window.AD_FONTS = ['700 60px Cinzel', '900 60px "Cinzel Decorative"'];
  const fonts = el('link', '', document.head);
  fonts.rel = 'stylesheet';
  fonts.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Cinzel+Decorative:wght@700;900&display=swap';
  ['cover', 'back', ...ORDER].forEach((k) => img(ART(k)));

  const style = el('style', '', document.head);
  style.textContent = `
    .mq-bg { position: absolute; left: -40px; top: -40px; width: 1360px; height: 800px; will-change: transform, filter; }
    .mq-dim { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 45%, rgba(40, 6, 18, 0.15), rgba(20, 2, 8, 0.82)); }
    .mq-card { position: absolute; left: 0; top: 0; width: 230px; height: 316px; perspective: 1100px; will-change: transform, opacity; }
    .mq-card .in { position: absolute; inset: 0; transform-style: preserve-3d; }
    .mq-card .face { position: absolute; inset: 0; border-radius: 18px; overflow: hidden; backface-visibility: hidden;
      box-shadow: 0 0 0 5px #e8c068, 0 0 0 8px #5a1324, 0 18px 40px rgba(0, 0, 0, 0.6); background: #2a0b14; }
    .mq-card .face img { position: absolute; left: 0; top: 0; width: 100%; height: 78%; object-fit: cover; }
    .mq-card .face .nm { position: absolute; left: 0; right: 0; bottom: 0; height: 22%; display: grid; place-items: center;
      font: 700 25px/1 Cinzel, serif; color: #fbe7b0; background: linear-gradient(#6e1a2c, #3a0b16); letter-spacing: 0.02em; }
    .mq-card .face.back { transform: rotateY(180deg); }
    .mq-card .face.back img { height: 100%; }
    .mq-card .glow { position: absolute; inset: -30px; border-radius: 40px; background: radial-gradient(closest-side, rgba(255, 214, 120, 0.85), rgba(255, 214, 120, 0)); opacity: 0; }
    .stamp { position: absolute; left: 0; top: 0; z-index: 8700; padding: 10px 24px; border: 6px solid currentColor; border-radius: 14px; white-space: nowrap;
      font: 900 52px/1 Cinzel, serif; letter-spacing: 0.05em; background: rgba(255, 248, 232, 0.92); transform-origin: 50% 50%; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45); }
    .stamp.bad { color: #c0262d; }
    .stamp.good { color: #1f8a4c; }
    .stamp.gold { color: #8a5a10; }
    .shout { position: absolute; left: 0; top: 0; z-index: 8700; white-space: nowrap; transform-origin: 50% 50%;
      font: 900 108px/1 "Cinzel Decorative", serif; color: #f6d98b; -webkit-text-stroke: 2px #4a0d1d;
      text-shadow: 0 6px 0 #4a0d1d, 0 16px 40px rgba(0, 0, 0, 0.7), 0 0 60px rgba(255, 190, 90, 0.5); }
    .title.mq .big { font: 900 96px/1.02 "Cinzel Decorative", serif; color: #f6d98b; -webkit-text-stroke: 2px #4a0d1d;
      text-shadow: 0 6px 0 #4a0d1d, 0 16px 36px rgba(0, 0, 0, 0.75), 0 0 50px rgba(255, 190, 90, 0.45); }
    .title.mq .mid { font: 700 56px/1.1 Cinzel, serif; color: #fbe7b0; text-shadow: 0 4px 0 #4a0d1d, 0 12px 28px rgba(0, 0, 0, 0.75); }
    .title.mq .sub { font: 600 30px/1.3 Fredoka, sans-serif; color: #fff3d6; }
    .title.mq .pill { background: linear-gradient(#f6d98b, #d9a640); color: #4a0d1d; box-shadow: 0 6px 0 #7a4f12, 0 12px 26px rgba(0, 0, 0, 0.45); }
    .bubble { position: absolute; left: 0; top: 0; z-index: 8600; padding: 18px 28px; border-radius: 26px; background: rgba(255, 248, 232, 0.96); color: #4a0d1d;
      font: 600 34px/1.2 Fredoka, sans-serif; white-space: nowrap; box-shadow: 0 14px 34px rgba(0, 0, 0, 0.5); transform-origin: 0% 100%; }
    .bubble::after { content: ""; position: absolute; left: 34px; bottom: -22px; border: 14px solid transparent; border-top: 24px solid rgba(255, 248, 232, 0.96); }
    .letter { position: absolute; left: 0; top: 0; z-index: 8600; width: 520px; height: 330px; transform-origin: 50% 50%; border-radius: 10px;
      background: linear-gradient(160deg, #fbf0d6, #ead3a0); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55), inset 0 0 0 3px #c9a45c; color: #4a0d1d; text-align: center; overflow: hidden; }
    .letter .seal { position: absolute; left: 50%; top: 50%; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #e0484f, #8a1420); box-shadow: 0 6px 14px rgba(0, 0, 0, 0.4); display: grid; place-items: center; font-size: 56px; }
    .letter .txt { position: absolute; inset: 40px 30px; display: flex; flex-direction: column; justify-content: center; gap: 12px; }
    .letter .txt b { font: 900 34px/1.15 Cinzel, serif; }
    .letter .txt span { font: 600 28px/1.3 Fredoka, sans-serif; }
    .letter .txt em { font: 700 34px/1 Fredoka, sans-serif; font-style: normal; color: #8a5a10; }
    .favor { position: absolute; left: 50%; top: 66%; z-index: 8600; display: flex; gap: 18px; transform: translateX(-50%); }
    .favor i { width: 78px; height: 78px; border-radius: 50%; display: grid; place-items: center; font-style: normal; font-size: 44px;
      background: rgba(255, 255, 255, 0.12); box-shadow: inset 0 0 0 3px rgba(246, 217, 139, 0.45); }
    .favor i.on { background: radial-gradient(circle at 35% 35%, #fff2b0, #e8b84a); box-shadow: 0 0 0 3px #a5741b, 0 0 30px rgba(255, 200, 90, 0.7); }`;

  // ---------------------------------------------------------------- pieces
  // The ballroom, painted once onto a canvas with its blur baked in (a live CSS blur on something this big bands).
  function backdrop(root, o = {}) {
    const bg = el('canvas', 'mq-bg', root);
    bg.width = 1360;
    bg.height = 800;
    bg.blurPx = o.blur || 0;
    el('div', 'mq-dim', root, { opacity: o.dim != null ? o.dim : 1 });
    const fx = canvasLayer(root, 8000);
    el('div', 'vignette', root);
    return { bg, fx };
  }
  function paint(bg) {
    const im = img(ART('cover'));
    if (bg.painted || !im.complete || !im.naturalWidth) return;
    const g = bg.getContext('2d');
    const k = Math.max(bg.width / im.naturalWidth, bg.height / im.naturalHeight) * (bg.blurPx ? 1.06 : 1);
    const w = im.naturalWidth * k;
    const h = im.naturalHeight * k;
    g.filter = bg.blurPx ? `blur(${bg.blurPx}px)` : 'none';
    g.drawImage(im, (bg.width - w) / 2, (bg.height - h) / 2, w, h);
    bg.painted = true;
  }
  // The ballroom drifts slowly behind everything.
  function drift(bg, t, o = {}) {
    paint(bg);
    const z = (o.z0 || 1.08) + t * (o.zs || 0.012);
    bg.style.transform = `translate(${(o.x || 0) + Math.sin(t * 0.3) * 10}px, ${(o.y || 0) + Math.cos(t * 0.25) * 6}px) scale(${z})`;
    bg.style.filter = `brightness(${o.light || 0.75}) saturate(1.1)`;
  }
  // Warm candle sparks rising through the hall, as a pure function of time.
  const SPARKS = (() => {
    const r = rng(77);
    return Array.from({ length: 70 }, () => [r() * W, r() * H, 0.4 + r() * 1.6, r() * TAU, 10 + r() * 26]);
  })();
  function sparks(fx, t, k = 1) {
    fx.clear();
    const g = fx.g;
    SPARKS.forEach(([x0, y0, sz, ph, sp]) => {
      const y = ((y0 - t * sp) % H + H) % H;
      const x = x0 + Math.sin(t * 0.6 + ph) * 18;
      const a = (0.35 + 0.35 * Math.sin(t * 2 + ph)) * k;
      const r = sz * 4;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,220,140,${a})`);
      gr.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    });
  }
  function card(root, k, z = 100) {
    const e = el('div', 'mq-card', root, { zIndex: z });
    const glow = el('div', 'glow', e);
    const inner = el('div', 'in', e);
    const front = el('div', 'face', inner);
    el('img', '', front).src = ART(k);
    const nm = el('div', 'nm', front);
    nm.textContent = MASKS[k][0];
    nm.style.fontSize = MASKS[k][0].length > 14 ? '19px' : MASKS[k][0].length > 10 ? '22px' : '25px';
    const back = el('div', 'face back', inner);
    el('img', '', back).src = ART('back');
    // flip: 0 = face down, 1 = face up.
    return {
      e,
      set(o) {
        const vis = (o.op == null ? 1 : o.op) > 0.001;
        e.style.display = vis ? '' : 'none';
        if (!vis) return;
        e.style.opacity = o.op == null ? 1 : o.op;
        e.style.transform = `translate(${o.x - 115}px, ${o.y - 158}px) rotate(${o.r || 0}deg) scale(${o.s || 1})`;
        inner.style.transform = `rotateY(${180 * (1 - (o.flip == null ? 1 : o.flip))}deg) rotateZ(${o.shake || 0}deg)`;
        glow.style.opacity = o.glow || 0;
        e.style.filter = o.filter || '';
      },
    };
  }
  function word(root, cls, html) {
    const e = el('div', cls, root);
    e.innerHTML = html;
    e.style.display = 'none';
    return e;
  }
  // A stamp or shout slammed onto the screen at time a (and gone by b).
  function slam(e, t, a, b, x, y, rot = -6) {
    const vis = t >= a && t <= b;
    e.style.display = vis ? '' : 'none';
    if (!vis) return;
    const p = seg(t, a, a + 0.32);
    const q = 1 - seg(t, b - 0.4, b);
    const s = lerp(2.4, 1, E.out(p)) * (1 + 0.04 * Math.sin((t - a) * 3));
    e.style.opacity = Math.min(1, p * 2) * q;
    e.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${rot}deg) scale(${s})`;
  }
  const at = (f, dur) => f * dur;
  function sceneRoot(root, seed, o) {
    const s = backdrop(root, o);
    s.seed = seed;
    return s;
  }

  // ---------------------------------------------------------------- scenes
  const scenes = [];

  scenes.push({
    id: 'open', min: 8, lead: 1.4,
    say: 'Venice. Carnival night. The Doge has thrown open his palace... and every guest wears a mask.',
    build(root) {
      const s = sceneRoot(root, 1, { dim: 0.55 });
      s.title = caption(root, '<div class="mid">Venice · Carnival night</div>', 'title mq');
      return s;
    },
    frame(t, dur, s) {
      drift(s.bg, t, { z0: 1.0, zs: 0.03, light: lerp(0.35, 0.95, E.out(seg(t, 0, 2.5))) });
      sparks(s.fx, t, 1);
      s.title.show(t, 1.2, dur - 0.6, 'rise');
      s.title.e.style.top = '80%';
    },
  });

  scenes.push({
    id: 'masks', min: 11,
    say: 'Each noble hides two masks. The Doge. The Duchess. The Jester. The Poisoner. The Plague Doctor. The Gondolier... and the Spy. Every mask holds a power.',
    build(root) {
      const s = sceneRoot(root, 2, { blur: 6 });
      s.cards = ORDER.map((k, i) => card(root, k, 100 + i));
      return s;
    },
    frame(t, dur, s) {
      drift(s.bg, t, { blur: 6, light: 0.45 });
      sparks(s.fx, t, 0.6);
      const n = ORDER.length;
      const span = dur - 2.4;
      s.cards.forEach((c, i) => {
        const deal = seg(t, 0.2 + i * 0.12, 0.9 + i * 0.12);
        const turn = seg(t, 1.6 + (i * span) / (n + 1), 2.2 + (i * span) / (n + 1));
        const ang = (i - (n - 1) / 2) * 6;
        const x = W / 2 + (i - (n - 1) / 2) * 162;
        const y = 380 + Math.abs(i - (n - 1) / 2) * 16;
        const lift = Math.sin(turn * Math.PI) * 60;
        c.set({ x: lerp(W / 2, x, E.out(deal)), y: lerp(900, y, E.out(deal)) - lift, r: lerp(0, ang, E.out(deal)), s: 0.64 + 0.1 * Math.sin(turn * Math.PI), flip: E.inOut(turn), glow: Math.sin(turn * Math.PI) * 0.8, op: deal > 0 ? 1 : 0 });
      });
    },
  });

  scenes.push({
    id: 'claim', min: 8.5,
    say: 'On your turn, claim any power you like... whether you really wear that mask, or not.',
    build(root) {
      const s = sceneRoot(root, 3, { blur: 5 });
      s.a = card(root, 'doge', 200);
      s.q = word(root, 'stamp gold', '🎭 Bluff?');
      s.title = caption(root, '<div class="mid">Claim <i>any</i> power</div>', 'title mq');
      return s;
    },
    frame(t, dur, s) {
      drift(s.bg, t, { blur: 5, light: 0.5, x: -40 });
      sparks(s.fx, t, 0.7);
      const up = E.back(seg(t, 0.2, 1.1));
      const flip = E.inOut(seg(t, 2.2, 3.0));
      s.a.set({ x: W / 2, y: lerp(820, 380, up), s: 1.25, r: Math.sin(t * 1.4) * 2, flip, glow: flip * 0.9 });
      s.title.show(t, 0.6, dur, 'rise');
      s.title.e.style.top = '12%';
      slam(s.q, t, 3.6, dur + 1, W / 2 + 190, 230, 10);
    },
  });

  scenes.push({
    id: 'unmask', min: 13.5,
    say: 'Don\'t believe them? Call... Unmask! Catch a liar, and they lose a mask for good. But accuse an honest noble... and you pay the price.',
    build(root) {
      const s = sceneRoot(root, 4, { blur: 6 });
      s.shout = word(root, 'shout', 'Unmask!');
      s.liar = card(root, 'jester', 200);
      s.honest = card(root, 'duchess', 201);
      s.bad = word(root, 'stamp bad', '✗ A bluff!');
      s.good = word(root, 'stamp good', '✓ Honest!');
      s.cost = word(root, 'stamp gold', '−⭐2 Favor');
      return s;
    },
    frame(t, dur, s) {
      drift(s.bg, t, { blur: 6, light: 0.45, y: -20 });
      sparks(s.fx, t, 0.6);
      const k = dur / 13.5;
      slam(s.shout, t, 0.9 * k, 3.3 * k, W / 2, 140, -4);
      // A liar: the card shakes, stays face down, and is torn away.
      const lin = E.out(seg(t, 0.2, 0.9));
      const shake = t > 2.3 * k && t < 3.4 * k ? Math.sin(t * 60) * 7 : 0;
      const gone = E.in(seg(t, 5.6 * k, 6.6 * k));
      s.liar.set({ x: lerp(-200, 380, lin) - gone * 120, y: 430 + gone * 520, s: 1.05, r: -6 - gone * 40, flip: 0, shake, op: 1 - gone, filter: `grayscale(${gone})` });
      slam(s.bad, t, 3.4 * k, 6.4 * k, 380, 610, -8);
      // An honest noble: the card flips gold, and the accuser pays.
      const hin = E.out(seg(t, 6.2 * k, 7.0 * k));
      const hflip = E.inOut(seg(t, 8.0 * k, 8.8 * k));
      s.honest.set({ x: lerp(W + 200, 900, hin), y: 420, s: 1.05, r: 5, flip: hflip, glow: hflip * 0.9, op: t > 6.1 * k ? 1 : 0 });
      slam(s.good, t, 8.9 * k, dur + 1, 900, 640, 6);
      slam(s.cost, t, 10.4 * k, dur + 1, 560, 300, -6);
    },
  });

  scenes.push({
    id: 'pairs', min: 9,
    say: 'Wear the right two masks, and claim them both... for a royal power. If you dare.',
    build(root) {
      const s = sceneRoot(root, 5, { blur: 6 });
      s.a = card(root, 'duchess', 200);
      s.b = card(root, 'doge', 201);
      s.title = caption(root, '<div class="mid">👑 The Royal Court</div><div class="sub">A Waltz worth ⭐⭐</div>', 'title mq');
      return s;
    },
    frame(t, dur, s) {
      drift(s.bg, t, { blur: 6, light: 0.5, x: 30 });
      sparks(s.fx, t, 0.9);
      const join = E.inOut(seg(t, 0.4, 2.4));
      const flare = Math.sin(seg(t, 2.2, 3.4) * Math.PI);
      s.a.set({ x: lerp(160, W / 2 - 95, join), y: 400, r: lerp(-14, -7, join), s: 1.05, glow: flare });
      s.b.set({ x: lerp(W - 160, W / 2 + 95, join), y: 400, r: lerp(14, 7, join), s: 1.05, glow: flare });
      s.title.show(t, 2.6, dur, 'pop');
      s.title.e.style.top = '86%';
    },
  });

  scenes.push({
    id: 'whisper', min: 10,
    say: 'Or lean in close, and whisper what a rival is really wearing. Guess right... and their mask is torn away.',
    build(root) {
      const s = sceneRoot(root, 6, { blur: 5 });
      s.bubble = word(root, 'bubble', '🗣️ …she wears <b>the Spy</b>.');
      s.spy = card(root, 'spy', 200);
      s.mask2 = card(root, 'gondolier', 199);
      s.tear = word(root, 'stamp bad', 'Torn away!');
      return s;
    },
    frame(t, dur, s) {
      drift(s.bg, t, { blur: 5, light: 0.5, x: -30, y: 10 });
      sparks(s.fx, t, 0.7);
      const pin = E.out(seg(t, 0.1, 0.8));
      s.mask2.set({ x: 880 + 70, y: 420, s: 0.95, r: 8, flip: 0, op: pin });
      const turn = E.inOut(seg(t, 3.6, 4.3));
      const rip = E.in(seg(t, 5.2, 6.4));
      s.spy.set({ x: 880 - 70 - rip * 260, y: 410 - rip * 140, s: 0.98, r: -6 - rip * 70, flip: turn, glow: turn * (1 - rip) * 0.8, op: pin * (1 - rip) });
      const bv = t >= 1.0 && t <= dur;
      s.bubble.style.display = bv ? '' : 'none';
      if (bv) {
        const p = E.back(seg(t, 1.0, 1.5));
        s.bubble.style.opacity = Math.min(1, seg(t, 1.0, 1.3) * 2);
        s.bubble.style.transform = `translate(150px, 210px) scale(${lerp(0.6, 1, p)})`;
      }
      slam(s.tear, t, 5.4, dur + 1, 640, 600, -8);
    },
  });

  scenes.push({
    id: 'intrigue', min: 8.5,
    say: 'And every noble keeps a secret intrigue... worth the Doge\'s favor, the moment it comes true.',
    build(root) {
      const s = sceneRoot(root, 7, { blur: 6 });
      s.letter = word(root, 'letter', '<div class="txt"><b>🎻 Patron of the Arts</b><span>Toast the Doge twice.</span><em>+⭐2 Favor</em></div><div class="seal">🎭</div>');
      s.seal = s.letter.querySelector('.seal');
      s.txt = s.letter.querySelector('.txt');
      return s;
    },
    frame(t, dur, s) {
      drift(s.bg, t, { blur: 6, light: 0.45 });
      sparks(s.fx, t, 0.8);
      s.letter.style.display = '';
      const inn = E.back(seg(t, 0.2, 1.1));
      s.letter.style.transform = `translate(${W / 2 - 260}px, ${lerp(800, H / 2 - 165, inn)}px) rotate(${lerp(-12, -2, inn) + Math.sin(t) * 1}deg)`;
      const open = E.inOut(seg(t, 2.6, 3.4));
      s.seal.style.transform = `scale(${1 + open * 0.6}) rotate(${open * 40}deg)`;
      s.seal.style.opacity = 1 - open;
      s.txt.style.opacity = seg(t, 3.0, 3.6);
    },
  });

  scenes.push({
    id: 'win', min: 9,
    say: 'Win seven favor with the Doge... or be the last noble still wearing a mask.',
    build(root) {
      const s = sceneRoot(root, 8, { blur: 3 });
      s.title = caption(root, '<div class="mid">⭐ 7 Favor wins</div><div class="sub">…or be the last one still masked</div>', 'title mq');
      s.favor = word(root, 'favor', Array.from({ length: 7 }, () => '<i>⭐</i>').join(''));
      s.pips = [...s.favor.children];
      return s;
    },
    frame(t, dur, s) {
      drift(s.bg, t, { blur: 3, light: lerp(0.5, 0.85, seg(t, 3.4, 5)), zs: 0.02 });
      sparks(s.fx, t, 1.2);
      s.title.show(t, 0.4, dur, 'rise');
      s.title.e.style.top = '34%';
      s.favor.style.display = '';
      s.favor.style.opacity = seg(t, 0.6, 1.1);
      s.pips.forEach((p, i) => p.classList.toggle('on', t > 1.2 + i * 0.32));
    },
  });

  scenes.push({
    id: 'end', min: 8, tail: 2.6,
    say: 'The Masquerade Court. Play the computer, friends, or rivals online... now, at Ahrens Labs.',
    build(root) {
      const s = sceneRoot(root, 9, { dim: 0.7, blur: 2.5 });
      s.title = caption(root, '<div class="big">The Masquerade<br>Court</div><div class="sub">A game of masks and bluffs</div><div class="pill">Play now at ahrenslabs.com</div>', 'title mq');
      return s;
    },
    frame(t, dur, s) {
      drift(s.bg, t, { blur: 2.5, light: 0.62, z0: 1.12, zs: 0.01 });
      sparks(s.fx, t, 1.1);
      s.title.show(t, 0.3, dur + 2);
    },
  });

  runAd(scenes);
})();
