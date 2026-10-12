// A small 2.5D renderer for the ad videos: a perspective camera that can dolly, crane and orbit through a
// world where the game's art stands as upright cut-outs (like a paper theatre), with real 3D ground,
// fences and particles, painter's-order depth sorting, atmospheric haze and depth of field.
(function () {
  const { W, H, clamp, lerp, rng, el, img } = AD;
  const NEAR = 20;
  const TAU = Math.PI * 2;

  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, k) => {
    const x = hex(a);
    const y = hex(b);
    return '#' + x.map((v, i) => Math.round(lerp(v, y[i], clamp(k))).toString(16).padStart(2, '0')).join('');
  };
  const rgba = (c, a) => {
    const [r, g, b] = hex(c);
    return `rgba(${r},${g},${b},${a})`;
  };

  // Sky palettes by time of day (0 dawn, 1 day, 2 dusk, 3 night): [top, middle, horizon, haze].
  const SKY = [
    ['#6f86c9', '#f4b38c', '#ffe1ab', '#f3cfa8'],
    ['#3f97dd', '#9fd3f2', '#e9f3dc', '#cfe3ea'],
    ['#33366f', '#c96f6a', '#f6b07a', '#c98e86'],
    ['#060b22', '#121c46', '#2a3a6c', '#1d2a52'],
  ];
  // Ambient light multiplied over the finished frame.
  const TINT = ['#ffd9c0', '#ffffff', '#ffb79a', '#5868a8'];
  const pal = (tbl, tod) => {
    const i = Math.min(tbl.length - 2, Math.floor(clamp(tod, 0, tbl.length - 1)));
    const k = clamp(tod - i);
    return Array.isArray(tbl[0]) ? tbl[0].map((_, j) => mix(tbl[i][j], tbl[i + 1][j], k)) : mix(tbl[i], tbl[i + 1], k);
  };

  // Silhouettes of an image in one colour, for haze and night tinting.
  const SIL = new Map();
  function silhouette(im, color) {
    const key = (im.src || im.id || '') + color;
    let c = SIL.get(key);
    if (c && c.ready) return c;
    if (!im.width && !im.naturalWidth) return null;
    c = document.createElement('canvas');
    c.width = im.naturalWidth || im.width;
    c.height = im.naturalHeight || im.height;
    const g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    c.ready = true;
    SIL.set(key, c);
    return c;
  }

  // Procedural props drawn once into canvases, then used like any other cut-out.
  const PROPS = new Map();
  let propId = 0;
  function prop(key, w, h, draw) {
    if (PROPS.has(key)) return PROPS.get(key);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.id = 'prop' + propId++;
    draw(c.getContext('2d'), w, h);
    PROPS.set(key, c);
    return c;
  }

  function world(parent, o = {}) {
    const cv = el('canvas', 'fx', parent, { zIndex: o.z || 10 });
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    g.imageSmoothingQuality = 'high';
    const cam = { x: 0, y: 160, z: -900, yaw: 0, pitch: 0.06, f: 900 };
    const env = {
      tod: 1, haze: null, fogNear: 1400, fogFar: 5200, fogMax: 0.6, focus: null, dof: 0,
      ground: ['#86b860', '#5f9a3c'], tint: null, mountains: true, seed: o.seed || 1, sunAz: 0.35, moonAz: -0.3,
      clouds: 1, stars: 1, wind: 1,
    };
    let q = [];
    let cyw, syw, cp, sp;
    let time = 0;

    function prep() {
      cyw = Math.cos(cam.yaw);
      syw = Math.sin(cam.yaw);
      cp = Math.cos(cam.pitch);
      sp = Math.sin(cam.pitch);
    }
    function view(x, y, z) {
      const dx = x - cam.x;
      const dy = y - cam.y;
      const dz = z - cam.z;
      const X = dx * cyw - dz * syw;
      const Z1 = dx * syw + dz * cyw;
      return [X, dy * cp + Z1 * sp, -dy * sp + Z1 * cp];
    }
    const toScreen = (v) => ({ x: W / 2 + (v[0] * cam.f) / v[2], y: H / 2 - (v[1] * cam.f) / v[2], s: cam.f / v[2], d: v[2] });
    function project(x, y, z) {
      const v = view(x, y, z);
      return v[2] < NEAR ? null : toScreen(v);
    }
    const horizon = () => H / 2 - cam.f * Math.tan(cam.pitch);

    function clipPoly(pts) {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const ain = a[2] >= NEAR;
        const bin = b[2] >= NEAR;
        if (ain) out.push(a);
        if (ain !== bin) {
          const t = (NEAR - a[2]) / (b[2] - a[2]);
          out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
        }
      }
      return out;
    }
    // Fill a polygon of world points [x, y, z] (clipped at the near plane).
    function poly(pts, fill, stroke, lw = 2) {
      const c = clipPoly(pts.map((p) => view(p[0], p[1], p[2])));
      if (c.length < 3) return;
      g.beginPath();
      c.forEach((v, i) => {
        const s = toScreen(v);
        if (i) g.lineTo(s.x, s.y);
        else g.moveTo(s.x, s.y);
      });
      g.closePath();
      if (fill) {
        g.fillStyle = fill;
        g.fill();
      }
      if (stroke) {
        g.strokeStyle = stroke;
        g.lineWidth = lw;
        g.stroke();
      }
    }
    const fogAt = (d) => clamp((d - env.fogNear) / (env.fogFar - env.fogNear)) * env.fogMax;
    const blurAt = (d) => (env.focus == null ? 0 : Math.min(6, (Math.abs(d - env.focus) / env.focus) * env.dof));

    // ---------------------------------------------------------------- sky
    const sr = rng(env.seed * 7 + 3);
    const stars = Array.from({ length: 160 }, () => [sr() * TAU, sr() * 0.9, 0.5 + sr() * 1.3, sr()]);
    const clouds = Array.from({ length: 9 }, () => [sr() * TAU, 0.06 + sr() * 0.22, 0.6 + sr() * 0.8, sr()]);
    function azToX(az) {
      let d = az - cam.yaw;
      d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
      if (Math.abs(d) > 1.4) return null;
      return W / 2 + cam.f * Math.tan(d);
    }
    const elToY = (el) => H / 2 - cam.f * Math.tan(el + cam.pitch);
    function ridge(seed, amp, base, col, shift) {
      const hy = horizon();
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += 16) {
        const az = cam.yaw + Math.atan((x - W / 2) / cam.f) + shift;
        const k = az * 3.2;
        const h = Math.abs(Math.sin(k + seed) * 0.6 + Math.sin(k * 2.3 + seed * 1.7) * 0.3 + Math.sin(k * 5.1 + seed * 3.1) * 0.12);
        g.lineTo(x, hy - base - h * amp);
      }
      g.lineTo(W, H);
      g.closePath();
      g.fillStyle = col;
      g.fill();
    }
    function sky() {
      const tod = env.tod;
      const [top, mid, hor, haze] = pal(SKY, tod);
      env.haze = env.hazeColor || haze;
      const hy = horizon();
      const gr = g.createLinearGradient(0, hy - 520, 0, hy + 10);
      gr.addColorStop(0, top);
      gr.addColorStop(0.6, mid);
      gr.addColorStop(1, hor);
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      const night = clamp(tod - 2);
      if (night > 0 && env.stars) {
        stars.forEach(([az, el, r, tw]) => {
          const x = azToX(az);
          if (x == null) return;
          const y = elToY(0.08 + el * 0.7);
          g.fillStyle = `rgba(255,252,235,${night * (0.55 + 0.45 * Math.sin(time * 2 + tw * 20))})`;
          g.fillRect(x, y, r, r);
        });
      }
      // Sun and moon.
      const sunEl = tod <= 1 ? lerp(0.02, 0.5, clamp(tod)) : lerp(0.5, -0.05, clamp(tod - 1));
      const sx = azToX(env.sunAz);
      if (sx != null && night < 1) {
        const sy = elToY(sunEl);
        const rg = g.createRadialGradient(sx, sy, 0, sx, sy, 150);
        rg.addColorStop(0, `rgba(255,252,225,${1 - night})`);
        rg.addColorStop(0.18, `rgba(255,240,180,${0.9 * (1 - night)})`);
        rg.addColorStop(1, 'rgba(255,220,140,0)');
        g.fillStyle = rg;
        g.fillRect(sx - 150, sy - 150, 300, 300);
      }
      const mx = azToX(env.moonAz);
      if (mx != null && night > 0) {
        const my = elToY(lerp(0.05, 0.3, night));
        const rg = g.createRadialGradient(mx, my, 0, mx, my, 120);
        rg.addColorStop(0, `rgba(255,252,235,${night})`);
        rg.addColorStop(0.28, `rgba(250,246,220,${night})`);
        rg.addColorStop(0.32, `rgba(255,250,220,${0.25 * night})`);
        rg.addColorStop(1, 'rgba(255,250,220,0)');
        g.fillStyle = rg;
        g.fillRect(mx - 120, my - 120, 240, 240);
      }
      if (env.clouds) {
        const cc = night > 0.5 ? mix('#ffffff', '#3a4570', night) : mix('#ffffff', '#ffd9c2', Math.abs(tod - 1) > 0.5 ? 0.6 : 0);
        clouds.forEach(([az, el, sz, ph]) => {
          const x = azToX(az + time * 0.004 * env.wind);
          if (x == null) return;
          const y = elToY(el);
          const s = sz * 70;
          g.fillStyle = rgba(cc, 0.85 * env.clouds);
          [[0, 0, 1], [0.9, -0.35, 0.8], [1.7, 0.05, 0.75], [-0.8, 0.1, 0.7], [0.5, 0.25, 0.9]].forEach(([dx, dy, r]) => {
            g.beginPath();
            g.ellipse(x + dx * s, y + dy * s, r * s, r * s * 0.62, 0, 0, TAU);
            g.fill();
          });
        });
      }
      if (env.mountains) {
        const m = typeof env.mountains === 'object' ? env.mountains : { far: '#9db7cb', near: '#86a98c' };
        ridge(1.3 + env.seed, 150, 4, mix(m.far, env.haze, 0.35), 0);
        ridge(4.1 + env.seed, 80, 0, mix(m.near, env.haze, 0.25), 0.4 + cam.x * 0.00004);
      }
    }

    function ground() {
      const hy = horizon();
      const [far, near] = env.ground;
      const gr = g.createLinearGradient(0, hy, 0, H);
      gr.addColorStop(0, mix(far, env.haze, 0.55));
      gr.addColorStop(0.12, mix(far, env.haze, 0.2));
      gr.addColorStop(1, near);
      g.fillStyle = gr;
      g.fillRect(0, hy, W, H - hy + 2);
    }

    // ---------------------------------------------------------------- queue
    const add = (d, fn) => q.push([d, fn]);

    // An upright cut-out standing at (x, y, z), h world units tall.
    function bill(src, o) {
      const im = typeof src === 'string' ? img(src) : src;
      const p = project(o.x, o.y || 0, o.z);
      if (!p || (o.minD && p.d < o.minD)) return null;
      const iw = im.naturalWidth || im.width;
      const ih = im.naturalHeight || im.height;
      if (!iw) return p;
      const h = o.h * p.s;
      const w = h * (iw / ih);
      if (p.x + w < -200 || p.x - w > W + 200 || h < 0.5) return p;
      add(p.d - (o.bias || 0), () => {
        const a = o.op == null ? 1 : o.op;
        if (a <= 0.003) return;
        if (o.shadow !== false && !o.y) shadowAt(o.x, o.z, (o.h * (iw / ih)) * (o.shadowW || 0.36), a * (o.shadowA || 0.5));
        g.save();
        g.translate(p.x, p.y - (o.lift || 0) * p.s);
        if (o.rot) g.rotate((o.rot * Math.PI) / 180);
        const flip = (o.dir || 1) === (o.face || 1) ? 1 : -1;
        g.scale((o.sx || 1) * flip, o.sy || 1);
        if (o.clipY != null) {
          const cy = project(o.x, o.clipY, o.z);
          if (cy) {
            g.beginPath();
            g.rect(-w, -h * 2, w * 2, h * 2 + (cy.y - p.y) / (o.sy || 1) + (o.lift || 0) * p.s);
            g.clip();
          }
        }
        const b = (o.blur || 0) + blurAt(p.d);
        if (b > 0.4) g.filter = `blur(${b.toFixed(1)}px)`;
        if (o.filter) g.filter = (g.filter === 'none' ? '' : g.filter + ' ') + o.filter;
        g.globalAlpha = a;
        g.drawImage(im, -w / 2, -h, w, h);
        const fog = o.fog != null ? o.fog : fogAt(p.d);
        if (fog > 0.01 && env.haze) {
          const s = silhouette(im, env.haze);
          if (s) {
            g.globalAlpha = a * fog;
            g.drawImage(s, -w / 2, -h, w, h);
          }
        }
        if (o.flash) {
          const s = silhouette(im, o.flashColor || '#ffffff');
          if (s) {
            g.globalAlpha = a * o.flash;
            g.drawImage(s, -w / 2, -h, w, h);
          }
        }
        g.restore();
      });
      return p;
    }

    function shadowAt(x, z, r, a = 0.5) {
      const c = project(x, 0, z);
      const f = project(x, 0, z + r * 0.5);
      if (!c || !f) return;
      const rx = r * c.s;
      const ry = Math.max(2, Math.abs(c.y - f.y));
      g.save();
      g.translate(c.x, c.y);
      g.scale(1, ry / rx);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      rg.addColorStop(0, `rgba(25,30,15,${a})`);
      rg.addColorStop(1, 'rgba(25,30,15,0)');
      g.fillStyle = rg;
      g.beginPath();
      g.arc(0, 0, rx, 0, TAU);
      g.fill();
      g.restore();
    }

    // A ground decal drawn straight away (call these after begin(), before end(), far ones first).
    function decal(pts2, fill, stroke, lw) {
      poly(pts2.map(([x, z]) => [x, 0, z]), fill, stroke, lw);
    }
    function disc(x, z, rx, rz, fill, stroke, lw, y = 0) {
      const pts = [];
      for (let i = 0; i < 40; i++) pts.push([x + Math.cos((i / 40) * TAU) * rx, y, z + Math.sin((i / 40) * TAU) * rz]);
      poly(pts, fill, stroke, lw);
    }

    // A log fence from (x1, z1) to (x2, z2), like the game's fence pieces: round posts, two rails.
    function fence(x1, z1, x2, z2, o = {}) {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const n = Math.max(1, Math.round(len / (o.gap || 70)));
      const hgt = o.h || 64;
      const k = o.grow == null ? 1 : o.grow;
      const shown = Math.floor(k * (n + 1) + 1e-6);
      for (let i = 0; i <= n; i++) {
        if (i >= shown) break;
        const ax = lerp(x1, x2, i / n);
        const az = lerp(z1, z2, i / n);
        const pg = clamp(k * (n + 1) - i);
        const ph = hgt * (o.grow == null ? 1 : Math.min(1, pg * 1.6));
        const pa = project(ax, 0, az);
        if (!pa) continue;
        add(pa.d, () => {
          const b = blurAt(pa.d);
          if (b > 0.4) g.filter = `blur(${b.toFixed(1)}px)`;
          post(ax, az, ph + 10, o);
        });
        if (i < n && i + 1 < shown) {
          const bx = lerp(x1, x2, (i + 1) / n);
          const bz = lerp(z1, z2, (i + 1) / n);
          const pb = project(bx, 0, bz);
          if (!pb) continue;
          add((pa.d + pb.d) / 2 + 1, () => {
            const b = blurAt((pa.d + pb.d) / 2);
            if (b > 0.4) g.filter = `blur(${b.toFixed(1)}px)`;
            [0.34, 0.74].forEach((f) => rail(ax, az, bx, bz, hgt * f, o));
          });
        }
      }
    }
    function post(x, z, h, o) {
      const b = project(x, 0, z);
      const t = project(x, h, z);
      if (!b || !t) return;
      const w = Math.max(2, (o.post || 13) * b.s);
      const fog = fogAt(b.d);
      const gr = g.createLinearGradient(b.x - w / 2, 0, b.x + w / 2, 0);
      gr.addColorStop(0, mix('#5a3412', env.haze || '#888888', fog));
      gr.addColorStop(0.45, mix('#a8703c', env.haze || '#888888', fog));
      gr.addColorStop(1, mix('#6b4018', env.haze || '#888888', fog));
      g.fillStyle = gr;
      g.beginPath();
      g.roundRect(b.x - w / 2, t.y, w, b.y - t.y, [w / 2, w / 2, 1, 1]);
      g.fill();
      g.fillStyle = mix('#d9a066', env.haze || '#888888', fog);
      g.beginPath();
      g.ellipse(t.x, t.y + w * 0.15, w / 2, w * 0.22, 0, 0, TAU);
      g.fill();
    }
    function rail(ax, az, bx, bz, y, o) {
      const r = (o.rail || 6) / 2;
      const fog = fogAt(project(ax, 0, az).d);
      poly([[ax, y - r, az], [bx, y - r, bz], [bx, y + r, bz], [ax, y + r, az]], mix('#93602f', env.haze || '#888888', fog), mix('#4a2a0c', env.haze || '#888888', fog), 1.2);
    }

    // A custom drawing at a world point, depth-sorted with everything else.
    function at(x, y, z, fn, bias = 0) {
      const p = project(x, y, z);
      if (p) add(p.d - bias, () => fn(g, p));
      return p;
    }
    // A soft round blob (smoke, dust, splash, embers) at a world point.
    function blob(x, y, z, r, color, a, bias = 0) {
      if (a <= 0.003) return;
      at(x, y, z, (g2, p) => {
        const R = r * p.s;
        if (R < 0.3) return;
        const rg = g2.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
        rg.addColorStop(0, rgba(color, a));
        rg.addColorStop(0.55, rgba(color, a * 0.6));
        rg.addColorStop(1, rgba(color, 0));
        g2.fillStyle = rg;
        g2.fillRect(p.x - R, p.y - R, R * 2, R * 2);
      }, bias);
    }

    const lights = [];
    // Additive glows (fire, windows, magic) drawn over the frame at the end.
    function light(x, y, z, r, color, a) {
      lights.push([x, y, z, r, color, a]);
    }

    function begin(t) {
      time = t || 0;
      prep();
      q = [];
      lights.length = 0;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.filter = 'none';
      sky();
      ground();
    }
    function end() {
      q.sort((a, b) => b[0] - a[0]);
      q.forEach(([, fn]) => {
        g.save();
        fn();
        g.restore();
      });
      q = [];
      const tint = env.tint || pal(TINT, env.tod);
      if (tint !== '#ffffff') {
        g.globalCompositeOperation = 'multiply';
        g.fillStyle = tint;
        g.fillRect(0, 0, W, H);
      }
      g.globalCompositeOperation = 'lighter';
      lights.forEach(([x, y, z, r, color, a]) => {
        const p = project(x, y, z);
        if (!p) return;
        const R = r * p.s;
        const rg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
        rg.addColorStop(0, rgba(color, a));
        rg.addColorStop(1, rgba(color, 0));
        g.fillStyle = rg;
        g.fillRect(p.x - R, p.y - R, R * 2, R * 2);
      });
      g.globalCompositeOperation = 'source-over';
    }

    return { cv, g, cam, env, project, horizon, begin, end, bill, decal, disc, poly, fence, at, blob, light, shadowAt, add, fogAt };
  }

  // ---------------------------------------------------------------- procedural scenery
  function pine(seed, snow = 0) {
    return prop(`pine${seed}:${snow}`, 160, 300, (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = '#5b3a1e';
      g.fillRect(w / 2 - 9, h - 46, 18, 46);
      const tiers = 4;
      for (let i = 0; i < tiers; i++) {
        const y0 = h - 40 - i * 58;
        const hw = 74 - i * 14 + r() * 6;
        const gr = g.createLinearGradient(w / 2 - hw, 0, w / 2 + hw, 0);
        gr.addColorStop(0, '#1f5a2c');
        gr.addColorStop(0.55, '#2f7a3a');
        gr.addColorStop(1, '#1a4a26');
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(w / 2 - hw, y0);
        g.quadraticCurveTo(w / 2, y0 + 12, w / 2 + hw, y0);
        g.lineTo(w / 2, y0 - 98);
        g.closePath();
        g.fill();
        if (snow) {
          g.fillStyle = 'rgba(245,250,255,0.92)';
          g.beginPath();
          g.moveTo(w / 2 - hw * 0.55, y0 - 40);
          g.quadraticCurveTo(w / 2, y0 - 30, w / 2 + hw * 0.55, y0 - 40);
          g.lineTo(w / 2, y0 - 98);
          g.closePath();
          g.fill();
        }
      }
    });
  }
  // A round-crowned tree; season 0 spring (blossom), 1 summer, 2 autumn, 3 winter (bare, snowy).
  function oak(seed, season = 1) {
    return prop(`oak${seed}:${season}`, 240, 300, (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = '#6a4424';
      g.beginPath();
      g.moveTo(w / 2 - 14, h);
      g.lineTo(w / 2 - 8, h - 120);
      g.lineTo(w / 2 + 8, h - 120);
      g.lineTo(w / 2 + 14, h);
      g.fill();
      if (season === 3) {
        g.strokeStyle = '#6a4424';
        g.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (r() - 0.5) * 2.2;
          const L = 60 + r() * 50;
          g.lineWidth = 7 - i * 0.5;
          g.beginPath();
          g.moveTo(w / 2, h - 110);
          g.quadraticCurveTo(w / 2 + Math.cos(a) * L * 0.4, h - 110 + Math.sin(a) * L * 0.7, w / 2 + Math.cos(a) * L, h - 110 + Math.sin(a) * L);
          g.stroke();
          g.fillStyle = 'rgba(245,250,255,0.9)';
          g.beginPath();
          g.ellipse(w / 2 + Math.cos(a) * L, h - 113 + Math.sin(a) * L, 9, 4, a, 0, TAU);
          g.fill();
        }
        return;
      }
      const cols = [['#4f9a3c', '#77c255', '#ffb3cf'], ['#2f7a34', '#55a843', null], ['#c4671f', '#e8a334', '#d8452b'], null][season];
      for (let i = 0; i < 9; i++) {
        const x = w / 2 + (r() - 0.5) * 120;
        const y = h - 170 + (r() - 0.5) * 90;
        const rr = 44 + r() * 26;
        const gr = g.createRadialGradient(x - rr * 0.3, y - rr * 0.4, rr * 0.1, x, y, rr);
        gr.addColorStop(0, cols[1]);
        gr.addColorStop(1, cols[0]);
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y, rr, 0, TAU);
        g.fill();
      }
      if (cols[2]) {
        for (let i = 0; i < 40; i++) {
          g.fillStyle = cols[2];
          g.beginPath();
          g.arc(w / 2 + (r() - 0.5) * 170, h - 170 + (r() - 0.5) * 130, 4 + r() * 3, 0, TAU);
          g.fill();
        }
      }
    });
  }
  function palm(seed) {
    return prop(`palm${seed}`, 300, 420, (g, w, h) => {
      const r = rng(seed);
      const lean = (r() - 0.5) * 60;
      g.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        const t0 = i / 14;
        const t1 = (i + 1) / 14;
        const x0 = w / 2 + lean * t0 * t0;
        const x1 = w / 2 + lean * t1 * t1;
        g.strokeStyle = i % 2 ? '#7a5230' : '#946640';
        g.lineWidth = 20 - i * 0.6;
        g.beginPath();
        g.moveTo(x0, h - t0 * 300);
        g.lineTo(x1, h - t1 * 300);
        g.stroke();
      }
      const tx = w / 2 + lean;
      const ty = h - 300;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + r() * 0.3;
        const L = 110 + r() * 30;
        const ex = tx + Math.cos(a) * L;
        const ey = ty + Math.sin(a) * L * 0.45 + 40;
        g.fillStyle = i % 2 ? '#2f8a3a' : '#3fa548';
        g.beginPath();
        g.moveTo(tx, ty);
        g.quadraticCurveTo(tx + Math.cos(a) * L * 0.5, ty - 40 + Math.sin(a) * 10, ex, ey);
        g.quadraticCurveTo(tx + Math.cos(a) * L * 0.5, ty - 12 + Math.sin(a) * 20, tx, ty + 8);
        g.fill();
      }
      g.fillStyle = '#6b4a22';
      [[-10, 6], [8, 8], [0, 16]].forEach(([dx, dy]) => {
        g.beginPath();
        g.arc(tx + dx, ty + dy, 9, 0, TAU);
        g.fill();
      });
    });
  }
  function fern(seed, col = '#3f9a3e') {
    return prop(`fern${seed}${col}`, 200, 130, (g, w, h) => {
      const r = rng(seed);
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI + (r() - 0.5) * 0.2;
        const L = 70 + r() * 30;
        g.strokeStyle = mix(col, '#1f5a24', r() * 0.6);
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(w / 2, h);
        const ex = w / 2 + Math.cos(a) * L;
        const ey = h + Math.sin(a) * L * 1.1;
        g.quadraticCurveTo(w / 2 + Math.cos(a) * L * 0.4, h - L * 0.9, ex, ey);
        g.stroke();
        for (let j = 1; j < 9; j++) {
          const t = j / 9;
          const px = lerp(w / 2, ex, t);
          const py = lerp(h, ey, t) - Math.sin(t * Math.PI) * L * 0.35;
          g.fillStyle = g.strokeStyle;
          g.beginPath();
          g.ellipse(px, py, 9 * (1 - t * 0.6), 3, a + 1.2, 0, TAU);
          g.fill();
        }
      }
    });
  }
  function bush(seed, col = '#3f8a3a') {
    return prop(`bush${seed}${col}`, 200, 120, (g, w, h) => {
      const r = rng(seed);
      for (let i = 0; i < 8; i++) {
        const x = 40 + r() * 120;
        const y = h - 30 - r() * 40;
        const rr = 26 + r() * 18;
        const gr = g.createRadialGradient(x - 8, y - 10, 4, x, y, rr);
        gr.addColorStop(0, mix(col, '#ffffff', 0.25));
        gr.addColorStop(1, mix(col, '#000000', 0.25));
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y, rr, 0, TAU);
        g.fill();
      }
    });
  }
  function rock(seed, col = '#8f8f88') {
    return prop(`rock${seed}${col}`, 160, 110, (g, w, h) => {
      const r = rng(seed);
      g.beginPath();
      g.moveTo(10, h);
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        g.lineTo(w / 2 + Math.cos(a) * (60 + r() * 14), h + Math.sin(a) * (70 + r() * 25));
      }
      g.lineTo(w - 10, h);
      g.closePath();
      const gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, mix(col, '#ffffff', 0.3));
      gr.addColorStop(1, mix(col, '#000000', 0.35));
      g.fillStyle = gr;
      g.fill();
    });
  }
  // A painted wooden sign on two posts.
  function sign(text) {
    return prop(`sign:${text}`, 360, 170, (g, w, h) => {
      g.font = '44px "Lilita One"';
      const tw = Math.min(w - 20, g.measureText(text).width + 50);
      const x0 = (w - tw) / 2;
      g.fillStyle = '#6b4018';
      g.fillRect(x0 + tw * 0.2, 60, 12, h - 60);
      g.fillRect(x0 + tw * 0.8 - 12, 60, 12, h - 60);
      g.fillStyle = '#a8703c';
      g.strokeStyle = '#5a3412';
      g.lineWidth = 5;
      g.beginPath();
      g.roundRect(x0, 8, tw, 70, 10);
      g.fill();
      g.stroke();
      g.fillStyle = '#fff6dc';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, w / 2, 45);
    });
  }

  // Scatter of grass tufts and flowers drawn as ground detail (call between begin and end).
  function meadow(R, area, n, seed, cols = { blade: '#4f8f33', flowers: ['#ffe066', '#ff8fb1', '#ffffff', '#b59cff'] }, skip = null) {
    const r = rng(seed);
    const pts = Array.from({ length: n }, () => [lerp(area[0], area[1], r()), lerp(area[2], area[3], r()), r(), Math.floor(r() * 4)]).filter(([x, z]) => !skip || !skip(x, z));
    return () => {
      pts.forEach(([x, z, k, fi]) => {
        const p = R.project(x, 0, z);
        if (!p || p.x < -20 || p.x > W + 20 || p.y > H + 20) return;
        const s = p.s;
        if (s < 0.08 || s > 2.6) return;
        const g = R.g;
        g.strokeStyle = cols.blade;
        g.lineWidth = Math.max(1, 3 * s);
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - 5 * s, p.y - 13 * s);
        g.moveTo(p.x, p.y);
        g.lineTo(p.x, p.y - 16 * s);
        g.moveTo(p.x, p.y);
        g.lineTo(p.x + 6 * s, p.y - 12 * s);
        g.stroke();
        if (k < 0.3 && cols.flowers) {
          g.fillStyle = cols.flowers[fi % cols.flowers.length];
          g.beginPath();
          g.arc(p.x + 8 * s, p.y - 8 * s, 4 * s, 0, TAU);
          g.fill();
        }
      });
    };
  }

  // Falling snow, rain or petals in a volume around the camera, so it has real depth.
  function weather(R, kind, t, n = 260, seed = 5, amt = 1) {
    if (amt <= 0) return;
    const r = rng(seed);
    const { cam } = R;
    for (let i = 0; i < n; i++) {
      const u = r();
      const v = r();
      const w = r();
      const ph = r();
      const depth = 260 + w * 1500;
      const span = depth * 1.6;
      const fall = kind === 'rain' ? 1400 : kind === 'snow' ? 70 : 55;
      const yTop = cam.y + depth * 0.7;
      const yBot = cam.y - depth * 0.9;
      const y = yTop - (((v * (yTop - yBot) + t * fall) % (yTop - yBot)) + (yTop - yBot)) % (yTop - yBot);
      const sway = kind === 'rain' ? t * 220 : Math.sin(t * 1.1 + ph * 9) * 30 + t * 25;
      const lx = ((u * span + sway) % span + span) % span - span / 2;
      const x = cam.x + lx * Math.cos(cam.yaw) + depth * Math.sin(cam.yaw);
      const z = cam.z + depth * Math.cos(cam.yaw) - lx * Math.sin(cam.yaw);
      const p = R.project(x, y, z);
      if (!p || i / n > amt) continue;
      const g = R.g;
      if (kind === 'rain') {
        g.strokeStyle = `rgba(200,215,255,${0.25 + 0.35 * (1 - w)})`;
        const k = Math.min(p.s, 1.2);
        g.lineWidth = Math.max(1, 1.4 * k);
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - 8 * k, p.y + 34 * k);
        g.stroke();
      } else if (kind === 'snow') {
        g.fillStyle = `rgba(255,255,255,${0.55 + 0.45 * (1 - w)})`;
        g.beginPath();
        g.arc(p.x, p.y, Math.max(0.8, Math.min(5, 4 * p.s)), 0, TAU);
        g.fill();
      } else {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(t * 2 + ph * 10);
        g.fillStyle = kind === 'leaves' ? ['#d8682a', '#e9a33a', '#c0452a'][i % 3] : ['#ffc2d8', '#ffe0ec', '#ff9fc4'][i % 3];
        g.beginPath();
        const k = Math.min(p.s, 1.6);
        g.ellipse(0, 0, Math.max(1, 6 * k), Math.max(0.6, 3 * k), 0, 0, TAU);
        g.fill();
        g.restore();
      }
    }
  }

  window.AD3 = { world, pine, oak, palm, fern, bush, rock, sign, meadow, weather, prop, mix, rgba };
})();
