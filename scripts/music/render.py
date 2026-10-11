"""Render note lists to seamless looping audio with a General MIDI SoundFont.

Needs numpy, tinysoundfont and ffmpeg, plus GeneralUser GS (free SoundFont) at $SOUNDFONT:
  SOUNDFONT=GeneralUser-GS.sf2 python oakhaven.py ../../audio/oakhaven-theme.mp3
The loop length printed by each piece must match data-loop on the page's game-music.js tag.
"""
import os
import random
import subprocess

import numpy as np
import tinysoundfont as tsf

SR = 44100
SF = os.environ.get('SOUNDFONT', 'GeneralUser-GS.sf2')
NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def n(name):
    """'Eb4' -> 63, 'F#3' -> 54."""
    pc = NAMES[name[0]]
    i = 1
    while i < len(name) and name[i] in '#b':
        pc += 1 if name[i] == '#' else -1
        i += 1
    return 12 * (int(name[i:]) + 1) + pc


class Score:
    def __init__(self, bpm):
        self.bpm = bpm
        self.notes = []  # (beat, dur, chan, key, vel)
        self.ccs = []  # (beat, chan, cc, val)

    def note(self, beat, dur, chan, key, vel):
        if isinstance(key, str):
            key = n(key)
        self.notes.append((beat, dur, chan, key, max(1, min(127, int(vel)))))

    def cc(self, beat, chan, num, val):
        self.ccs.append((beat, chan, num, int(val)))

    def ramp(self, b0, b1, chan, num, v0, v1, steps=24):
        for i in range(steps + 1):
            t = i / steps
            self.cc(b0 + (b1 - b0) * t, chan, num, v0 + (v1 - v0) * t)


def reverb(x, rt60, wet, seed=1, predelay=0.012, tone=6):
    """Convolve with decaying stereo noise (a cheap hall)."""
    rng = np.random.default_rng(seed)
    length = int(SR * rt60 * 1.1)
    t = np.arange(length) / SR
    env = np.exp(-6.91 * t / rt60)
    ir = rng.standard_normal((length, 2)) * env[:, None]
    k = np.ones(tone) / tone
    for c in range(2):
        ir[:, c] = np.convolve(ir[:, c], k, mode='same')
    ir = np.vstack([np.zeros((int(SR * predelay), 2)), ir])
    ir /= np.sqrt((ir ** 2).sum(axis=0))
    size = 1
    while size < len(x) + len(ir):
        size *= 2
    out = np.empty_like(x)
    for c in range(2):
        out[:, c] = np.fft.irfft(np.fft.rfft(x[:, c], size) * np.fft.rfft(ir[:, c], size), size)[: len(x)]
    return x * (1 - wet) + out * wet * 1.6


def soften(loop, cut_db, f0=1800, f1=9000):
    """Roll off the treble above f0 by up to cut_db at f1 (applied around the loop, so the seam stays clean)."""
    spec = np.fft.rfft(loop, axis=0)
    f = np.fft.rfftfreq(len(loop), 1 / SR)
    t = np.clip(np.log(np.maximum(f, 1) / f0) / np.log(f1 / f0), 0, 1)
    t = t * t * (3 - 2 * t)
    spec *= (10 ** (-cut_db * t / 20))[:, None]
    return np.fft.irfft(spec, len(loop), axis=0)


def level(loop, amount, window=4.0, block=1024):
    """Slowly ride the gain toward the average loudness so no section jumps out (amount 0..1), wrapping round the loop."""
    nb = -(-len(loop) // block)
    e = np.array([(loop[i * block:(i + 1) * block] ** 2).mean() for i in range(nb)])
    h = max(1, int(window * SR / block / 2))
    k = np.hanning(2 * h + 1)
    k /= k.sum()
    env = np.sqrt(np.convolve(np.concatenate([e[-h:], e, e[:h]]), k, mode='valid'))
    g = np.clip((np.sqrt(e.mean()) / np.maximum(env, 1e-9)) ** amount, 0.5, 2.0)
    centers = np.arange(nb) * block + block / 2
    L = len(loop)
    xs = np.concatenate([[centers[-1] - L], centers, [centers[0] + L]])
    gs = np.concatenate([[g[-1]], g, [g[0]]])
    return loop * np.interp(np.arange(L), xs, gs)[:, None]


def render(score, programs, loop_beats, path, rt60=1.4, wet=0.2, humanize=0.006, tail=8.0, pans=None, vols=None, seed=7,
           warmth=0.0, even=0.0):
    rng = random.Random(seed)
    spb = 60.0 / score.bpm
    synth = tsf.Synth(samplerate=SR, gain=-6)
    sfid = synth.sfload(SF, max_voices=256)
    for ch, prog in programs.items():
        synth.program_select(ch, sfid, 0, prog)
        synth.control_change(ch, 7, (vols or {}).get(ch, 100))
        synth.control_change(ch, 10, (pans or {}).get(ch, 64))
        synth.control_change(ch, 11, 127)
    ev = []
    for beat, dur, ch, key, vel in score.notes:
        jitter = rng.uniform(-humanize, humanize) if humanize else 0
        on = max(0, int((beat * spb + jitter) * SR))
        off = int(((beat + dur) * spb + jitter) * SR)
        v = max(1, min(127, vel + rng.randint(-3, 3)))
        ev.append((on, 2, ch, key, v))
        ev.append((max(off, on + 1), 0, ch, key, 0))
    for beat, ch, num, val in score.ccs:
        ev.append((int(beat * spb * SR), 1, ch, num, val))
    ev.sort()
    loop_len = int(round(loop_beats * spb * SR))
    total = loop_len + int(tail * SR)
    chunks = []
    cur = 0
    for t, kind, ch, a, b in ev:
        if t > cur:
            m = synth.generate(t - cur)
            chunks.append(np.frombuffer(m, dtype=np.float32).reshape(-1, 2).copy())
            cur = t
        if kind == 2:
            synth.noteon(ch, a, b)
        elif kind == 0:
            synth.noteoff(ch, a)
        else:
            synth.control_change(ch, a, b)
    if total > cur:
        chunks.append(np.frombuffer(synth.generate(total - cur), dtype=np.float32).reshape(-1, 2).copy())
    x = np.vstack(chunks)[:total].astype(np.float64)
    x = reverb(x, rt60, wet)
    # Wrap the tail onto the start so the loop is seamless.
    loop = x[:loop_len].copy()
    rest = x[loop_len:]
    loop[: len(rest)] += rest
    if warmth:
        loop = soften(loop, warmth)
    if even:
        loop = level(loop, even)
    # Loud enough for phone speakers (the page plays it back below full volume); peaks are
    # rounded off softly above the knee instead of being scaled down with the whole track.
    rms = np.sqrt((loop ** 2).mean())
    loop *= 10 ** (-13 / 20) / rms
    knee, ceil = 0.6, 0.95
    over = np.abs(loop) > knee
    loop[over] = np.sign(loop[over]) * (knee + (ceil - knee) * np.tanh((np.abs(loop[over]) - knee) / (ceil - knee)))
    # Pad half a second either side with the loop's own audio, so the player can loop
    # gaplessly even if the decoder adds or trims a few milliseconds at the start.
    pad = SR // 2
    out = np.vstack([loop[-pad:], loop, loop[:pad]])
    pcm = (np.clip(out, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-',
                    '-c:a', 'libmp3lame', '-b:a', '112k', path], input=pcm, check=True)
    return loop_len / SR, pad / SR
