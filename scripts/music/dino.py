"""Dino Dynasty: a broad, wonder-filled orchestral theme (4/4, D major) for horns, strings, harp, choir and timpani."""
import sys

from render import Score, n, render

S = Score(bpm=66)
HORN, STR, HARP, BASS, TIMP, BRASS, FLUTE, CHOIR, VLN = range(9)
BAR = 4

# Chord tones per harmony: (bass, pad voicing, harp arpeggio pitch classes as notes)
C = {
    'D': ('D2', ['D3', 'F#3', 'A3', 'D4'], ['D3', 'A3', 'D4', 'F#4', 'A4', 'F#4', 'D4', 'A3']),
    'Dadd9': ('D2', ['D3', 'A3', 'E4', 'F#4'], ['D3', 'A3', 'E4', 'F#4', 'A4', 'F#4', 'E4', 'A3']),
    'G/D': ('D2', ['D3', 'G3', 'B3', 'D4'], ['D3', 'G3', 'B3', 'D4', 'G4', 'D4', 'B3', 'G3']),
    'Asus/D': ('D2', ['D3', 'A3', 'D4', 'E4'], ['D3', 'A3', 'D4', 'E4', 'A4', 'E4', 'D4', 'A3']),
    'A/C#': ('C#2', ['C#3', 'E3', 'A3', 'C#4'], ['C#3', 'A3', 'C#4', 'E4', 'A4', 'E4', 'C#4', 'A3']),
    'Bm': ('B1', ['B2', 'F#3', 'B3', 'D4'], ['B2', 'F#3', 'B3', 'D4', 'F#4', 'D4', 'B3', 'F#3']),
    'G': ('G1', ['G2', 'D3', 'G3', 'B3'], ['G2', 'D3', 'G3', 'B3', 'D4', 'B3', 'G3', 'D3']),
    'G/B': ('B1', ['B2', 'D3', 'G3', 'B3'], ['B2', 'G3', 'B3', 'D4', 'G4', 'D4', 'B3', 'G3']),
    'Em7': ('E2', ['E3', 'G3', 'B3', 'D4'], ['E3', 'B3', 'D4', 'G4']),
    'A7sus': ('A1', ['E3', 'A3', 'D4', 'G4'], ['A2', 'E3', 'D4', 'G4']),
    'A7': ('A1', ['E3', 'G3', 'A3', 'C#4'], ['A2', 'E3', 'G3', 'C#4']),
    'Bb': ('Bb1', ['Bb2', 'F3', 'Bb3', 'D4'], ['Bb2', 'F3', 'Bb3', 'D4', 'F4', 'D4', 'Bb3', 'F3']),
    'C': ('C2', ['C3', 'G3', 'C4', 'E4'], ['C3', 'G3', 'C4', 'E4', 'G4', 'E4', 'C4', 'G3']),
    'Gm/Bb': ('Bb1', ['Bb2', 'D3', 'G3', 'Bb3'], ['Bb2', 'G3', 'Bb3', 'D4', 'G4', 'D4', 'Bb3', 'G3']),
    'D/A': ('A1', ['A2', 'D3', 'F#3', 'A3'], ['A2', 'F#3', 'A3', 'D4']),
}


def harmony(bar, names, pad_vel=46, harp_vel=40, bass_vel=56, choir=0):
    """names: one chord for the bar, or a list of (beat, chord) changes."""
    if isinstance(names, str):
        names = [(0, names)]
    t0 = bar * BAR
    for i, (beat, name) in enumerate(names):
        end = names[i + 1][0] if i + 1 < len(names) else BAR
        bass, voicing, arp = C[name]
        dur = end - beat
        S.note(t0 + beat, dur - 0.05, BASS, bass, bass_vel)
        S.note(t0 + beat, dur - 0.05, BASS, n(bass) + 12, bass_vel - 14)
        for k in voicing:
            S.note(t0 + beat, dur - 0.02, STR, k, pad_vel)
            if choir:
                S.note(t0 + beat, dur - 0.02, CHOIR, n(k) + 12, choir)
        steps = int(dur * 2)
        for s in range(steps):
            k = arp[s % len(arp)]
            S.note(t0 + beat + s * 0.5, 1.2, HARP, n(k) + 12, harp_vel + (6 if s % 4 == 0 else 0))


def melody(bar, cells, chan, vel, octave=0):
    t0 = bar * BAR
    for beat, note, dur in cells:
        S.note(t0 + beat, dur * 0.97, chan, n(note) + 12 * octave, vel + (5 if beat == 0 else 0))


def swell(bar, bars, chan, lo, hi):
    S.ramp(bar * BAR, (bar + bars) * BAR - 0.5, chan, 11, lo, hi)


def timp_roll(bar, beats, note, v0, v1):
    t0 = bar * BAR + (BAR - beats)
    steps = int(beats * 6)
    for i in range(steps):
        S.note(t0 + i / 6, 0.2, TIMP, note, v0 + (v1 - v0) * i / steps)


THEME = [
    [(0, 'D4', 1), (1, 'A4', 3)],
    [(0, 'B4', 1.5), (1.5, 'A4', 0.5), (2, 'G4', 2)],
    [(0, 'F#4', 1), (1, 'A4', 1), (2, 'D5', 2)],
    [(0, 'C#5', 1.5), (1.5, 'B4', 0.5), (2, 'A4', 2)],
    [(0, 'B4', 1), (1, 'D5', 3)],
    [(0, 'E5', 1.5), (1.5, 'D5', 0.5), (2, 'B4', 1), (3, 'G4', 1)],
    [(0, 'A4', 2), (2, 'G4', 1), (3, 'E4', 1)],
    [(0, 'F#4', 4)],
]
THEME_CH = ['D', 'G/D', 'D', 'A/C#', 'Bm', 'G', [(0, 'Em7'), (2, 'A7sus'), (3, 'A7')], 'D']

SOAR = [
    [(0, 'D5', 1), (1, 'A5', 3)],
    [(0, 'B5', 1.5), (1.5, 'A5', 0.5), (2, 'G5', 1), (3, 'F#5', 1)],
    [(0, 'D5', 1), (1, 'F5', 3)],
    [(0, 'G5', 1.5), (1.5, 'F5', 0.5), (2, 'E5', 2)],
    [(0, 'D5', 1), (1, 'G5', 1), (2, 'B5', 2)],
    [(0, 'Bb5', 1.5), (1.5, 'A5', 0.5), (2, 'G5', 1), (3, 'D5', 1)],
    [(0, 'F#5', 2), (2, 'E5', 2)],
    [(0, 'D5', 4)],
]
SOAR_CH = ['D', 'G/B', 'Bb', 'C', 'G', 'Gm/Bb', [(0, 'D/A'), (2, 'A7')], 'D']

bar = 0
# Intro: a misty pad grows, the harp starts turning, the timpani rumbles into the theme.
for i, ch in enumerate(['Dadd9', 'Dadd9', 'G/D', 'Asus/D']):
    harmony(bar + i, ch, pad_vel=44, harp_vel=30 + i * 4, bass_vel=44, choir=34)
swell(bar, 2, STR, 30, 110)
swell(bar, 2, CHOIR, 20, 100)
S.note(bar * BAR + 8, 8, HORN, 'A3', 42)
S.note(bar * BAR + 8, 8, HORN, 'D4', 40)
melody(bar + 2, [(2, 'A5', 0.5), (2.5, 'F#5', 0.5), (3, 'E5', 1)], FLUTE, 48)
melody(bar + 3, [(0, 'D5', 2)], FLUTE, 44)
timp_roll(bar + 3, 2, 'D3', 14, 44)
bar += 4

# Theme on the horns.
S.cc(bar * BAR, STR, 11, 100)
S.cc(bar * BAR, CHOIR, 11, 0)
S.note(bar * BAR, 1, TIMP, 'D3', 40)
for i in range(8):
    harmony(bar + i, THEME_CH[i], pad_vel=48, harp_vel=40)
    melody(bar + i, THEME[i], HORN, 80)
melody(bar + 3, [(2.5, 'E5', 0.5), (3, 'F#5', 0.5), (3.5, 'A5', 0.5)], FLUTE, 46)
melody(bar + 7, [(2, 'A5', 0.5), (2.5, 'F#5', 0.5), (3, 'D5', 0.5), (3.5, 'C#5', 0.5)], FLUTE, 46)
bar += 8

# The theme again, soaring on the violins with the horns underneath, brass and choir joining.
S.note(bar * BAR, 1.5, TIMP, 'D3', 46)
S.note(bar * BAR + 16, 1.5, TIMP, 'G2', 42)
swell(bar, 8, CHOIR, 50, 95)
for i in range(8):
    harmony(bar + i, SOAR_CH[i], pad_vel=54, harp_vel=44, bass_vel=62, choir=36)
    melody(bar + i, SOAR[i], VLN, 84)
    melody(bar + i, SOAR[i], HORN, 66, octave=-1)
for i, ch in ((2, 'Bb'), (3, 'C'), (6, 'D/A'), (7, 'D')):
    for k in C[ch][1][1:]:
        S.note((bar + i) * BAR, BAR - 0.1, BRASS, k, 50)
timp_roll(bar + 6, 2, 'A2', 16, 40)
bar += 8

# Settle back into the mist for the loop.
harmony(bar, 'G/D', pad_vel=46, harp_vel=36, bass_vel=48, choir=34)
harmony(bar + 1, 'Dadd9', pad_vel=40, harp_vel=30, bass_vel=42, choir=30)
swell(bar, 2, STR, 100, 34)
swell(bar, 2, CHOIR, 95, 20)
melody(bar, [(0, 'A4', 2), (2, 'B4', 1), (3, 'A4', 1)], HORN, 52)
melody(bar + 1, [(0, 'F#4', 4)], HORN, 44)
bar += 2

loop_beats = bar * BAR
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/dino.mp3'
programs = {HORN: 60, STR: 49, HARP: 46, BASS: 43, TIMP: 47, BRASS: 61, FLUTE: 73, CHOIR: 52, VLN: 48}
pans = {HORN: 48, STR: 74, HARP: 36, BASS: 64, TIMP: 60, BRASS: 84, FLUTE: 88, CHOIR: 64, VLN: 78}
vols = {HORN: 108, STR: 92, HARP: 84, BASS: 92, TIMP: 92, BRASS: 70, FLUTE: 76, CHOIR: 72, VLN: 104}
L, pad_s = render(S, programs, loop_beats, out, rt60=2.6, wet=0.3, humanize=0.004, pans=pans, vols=vols, tail=10)
print(f'dino: {bar} bars, loop {L:.3f}s, pad {pad_s}s')
