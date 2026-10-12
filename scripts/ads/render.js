// Render an ad video: node render.js dino|oakhaven [out.mp4]
// Needs playwright-core + Chromium (as in ~/.cache/hhtest), ffmpeg, the Kokoro TTS venv, and cut-out sprites
// from cutout.py in /tmp/ads/sprites.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require(process.env.HOME + '/.cache/hhtest/node_modules/playwright-core');

const SCENE = process.argv[2] || 'dino';
const REPO = path.resolve(__dirname, '../..');
const OUT = process.argv[3] || `/tmp/ads/${SCENE}-ad.mp4`;
const FPS = +(process.env.FPS || 30);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null; // preview stills at these seconds
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell';
const SPRITES = process.env.SPRITES || '/tmp/ads/sprites';
const VOICE_DIR = process.env.HOME + '/.cache/ads/voice';
const TTS_PY = process.env.HOME + '/.cache/tts/venv/bin/python';
const CFG = {
  dino: { voice: 'am_michael', speed: 1.0, music: { main: ['dino-theme.mp3', 0.5, 88.5] } },
  oakhaven: { voice: 'bm_george', speed: 0.95, music: { main: ['oakhaven-theme.mp3', 0.5, 59.166667], night: ['oakhaven-night.mp3', 0.5, 44.136364] } },
}[SCENE];

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const f = u.startsWith('/sprites/') ? path.join(SPRITES, u.slice(9)) : path.join(__dirname, u === '/' ? 'stage.html' : u);
    fs.readFile(f, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((r) => srv.listen(0, () => r(srv)));
}

async function open(b, port, sayDur) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
  if (sayDur) await p.addInitScript((d) => { window.SAY_DUR = d; }, sayDur);
  await p.goto(`http://127.0.0.1:${port}/stage.html?scene=${SCENE}`);
  await p.waitForFunction(() => window.TIMELINE);
  await p.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(['44px "Lilita One"', '600 30px Fredoka', '700 30px Fredoka'].map((f) => document.fonts.load(f)));
    for (let t = 0; t < window.DURATION; t += 0.5) window.frame(t);
    await AD.loaded();
    window.frame(0);
  });
  return p;
}

// What the voice is given: respellings for words the synthesizer gets wrong ("dee-no", "com-pies").
const spoken = (s) => s
  .replace(/\b([Dd])ino(s?)\b/g, (m, d, pl) => (d === 'D' ? 'Dyno' : 'dyno') + pl)
  .replace(/\bCompy(s?)\b/g, (m, pl) => 'Kompee' + pl);

function voice(lines) {
  fs.mkdirSync(VOICE_DIR, { recursive: true });
  const out = {};
  const jobs = [];
  lines.forEach(({ id, text: said }) => {
    const text = spoken(said);
    const h = crypto.createHash('sha1').update(`${CFG.voice}|${CFG.speed}|${text}`).digest('hex').slice(0, 16);
    const wav = path.join(VOICE_DIR, `${h}.wav`);
    out[id] = wav;
    if (!fs.existsSync(wav)) jobs.push({ chunks: [text], out: wav, voice: CFG.voice, speed: CFG.speed });
  });
  if (jobs.length) {
    const jf = path.join(VOICE_DIR, 'jobs.json');
    fs.writeFileSync(jf, JSON.stringify(jobs));
    execFileSync(TTS_PY, [process.env.HOME + '/.cache/tts/say2.py', jf], { stdio: 'inherit' });
  }
  const dur = {};
  for (const [id, wav] of Object.entries(out)) {
    const m = JSON.parse(fs.readFileSync(wav.replace(/\.wav$/, '.json'), 'utf8'));
    dur[id] = m[m.length - 1].end;
  }
  return { wavs: out, dur };
}

function mixVoice(tl, wavs, total, file) {
  const py = `
import json, sys, numpy as np, soundfile as sf
tl, wavs, total, out = json.loads(sys.argv[1]), json.loads(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
sr = 24000
buf = np.zeros(int(total * sr) + sr, dtype=np.float32)
for it in tl:
    if it['id'] not in wavs: continue
    a, r = sf.read(wavs[it['id']], dtype='float32')
    i = int(it['sayAt'] * sr)
    buf[i:i + len(a)] += a[: len(buf) - i]
sf.write(out, buf[: int(total * sr)], sr)
`;
  execFileSync(TTS_PY, ['-c', py, JSON.stringify(tl), JSON.stringify(wavs), String(total), file], { stdio: 'inherit' });
}

// Music: each track looped over its seamless loop points; Oakhaven crossfades to the night theme for
// the night scenes. The music ducks under the narration.
function musicGraph(tl, total) {
  const ins = [];
  const parts = [];
  const tracks = Object.entries(CFG.music);
  const windows = (name) => {
    const w = [];
    tl.forEach((it) => {
      if (it.music !== name) return;
      const last = w[w.length - 1];
      if (last && Math.abs(last[1] - it.start) < 0.01) last[1] = it.start + it.dur;
      else w.push([it.start, it.start + it.dur]);
    });
    return w;
  };
  const F = 1.6;
  tracks.forEach(([name, [file, a, b]], i) => {
    ins.push('-i', path.join(REPO, 'audio', file));
    const w = windows(name);
    const on = w.map(([s, e]) => `clip((t-${(s - F / 2).toFixed(2)})/${F},0,1)*clip((${(e + F / 2).toFixed(2)}-t)/${F},0,1)`).join('+') || '0';
    const n = Math.round((b - a) * 44100);
    parts.push(`[${i + 2}:a]aresample=44100,atrim=${a}:${b},asetpts=N/SR/TB,aloop=loop=-1:size=${n},atrim=0:${total.toFixed(2)},asetpts=N/SR/TB,volume='0.5*(${on})':eval=frame[m${i}]`);
  });
  const mix = tracks.length > 1 ? `${tracks.map((_, i) => `[m${i}]`).join('')}amix=inputs=${tracks.length}:normalize=0[mus]` : '[m0]anull[mus]';
  parts.push(mix);
  parts.push(`[mus]afade=t=in:d=1.2,afade=t=out:st=${(total - 3).toFixed(2)}:d=3[mf]`);
  parts.push('[1:a]aresample=44100,volume=1.25,asplit[v1][v2]');
  parts.push('[mf][v2]sidechaincompress=threshold=0.04:ratio=5:attack=30:release=500:makeup=1[duck]');
  parts.push('[duck][v1]amix=inputs=2:normalize=0,alimiter=limit=0.95[aout]');
  return { ins, graph: parts.join(';') };
}

(async () => {
  fs.mkdirSync('/tmp/ads', { recursive: true });
  const srv = await serve();
  const port = srv.address().port;
  const b = await chromium.launch({ executablePath: EXE, args: ['--font-render-hinting=none', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const probe = await open(b, port, null);
  const lines = await probe.evaluate(() => window.SAY_LINES);
  await probe.close();
  const { wavs, dur } = voice(lines);
  const p = await open(b, port, dur);
  const tl = await p.evaluate(() => window.TIMELINE);
  const total = await p.evaluate(() => window.DURATION);
  console.log(`${SCENE}: ${tl.length} scenes, ${total.toFixed(1)}s`);
  tl.forEach((it) => console.log(`  ${it.start.toFixed(1).padStart(6)}  ${it.id}`));

  if (ONLY) {
    for (const t of ONLY) {
      await p.evaluate((x) => window.frame(x), t);
      await p.screenshot({ path: `/tmp/ads/${SCENE}-${t}.png` });
      console.log('still', `/tmp/ads/${SCENE}-${t}.png`);
    }
    await b.close();
    srv.close();
    return;
  }

  const silent = `/tmp/ads/${SCENE}-video.mp4`;
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.ceil(total * FPS);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await p.evaluate((x) => window.frame(x), i / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % (FPS * 10) === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await b.close();
  srv.close();

  const vfile = `/tmp/ads/${SCENE}-voice.wav`;
  mixVoice(tl, wavs, total, vfile);
  const { ins, graph } = musicGraph(tl, total);
  // Two passes at a bitrate that keeps the file under Cloudflare's 25 MiB limit.
  const vk = Math.min(2400, Math.floor((23.5 * 8 * 1024) / total) - 140);
  const common = ['-i', silent, '-i', vfile, ...ins, '-filter_complex', graph, '-map', '0:v', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'slow', '-b:v', `${vk}k`, '-pix_fmt', 'yuv420p'];
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...common, '-pass', '1', '-passlogfile', `/tmp/ads/${SCENE}-2pass`, '-an', '-f', 'mp4', '/dev/null'], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...common, '-pass', '2', '-passlogfile', `/tmp/ads/${SCENE}-2pass`, '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
  console.log('wrote', OUT, (fs.statSync(OUT).size / 1048576).toFixed(1), 'MiB');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
