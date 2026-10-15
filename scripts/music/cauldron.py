"""Cauldron Lane: a sly, bubbling apothecary waltz in E minor. Pizzicato strings play the oom-pah-pah, a
bassoon sneaks through the first verse, a clarinet takes the second, and the middle section brightens into
G major with a glockenspiel, like the shop doors opening on market day. Celesta bubbles pop at phrase ends."""
import sys

from render import Score, n, render

S = Score(bpm=168)  # one beat = one quarter note, three to a bar
PIZZ, BASSOON, CLAR, BASS, GLOCK, CEL, STR = 0, 1, 2, 3, 4, 5, 6
BAR = 3

# bass note, the two "pah" chords, a soft string bed
H = {
    'Em': ('E2', ['G3', 'B3', 'E4'], ['E3', 'G3', 'B3']),
    'Am': ('A2', ['A3', 'C4', 'E4'], ['E3', 'A3', 'C4']),
    'B7': ('B1', ['A3', 'D#4', 'F#4'], ['D#3', 'F#3', 'A3']),
    'C': ('C2', ['G3', 'C4', 'E4'], ['E3', 'G3', 'C4']),
    'G': ('G2', ['G3', 'B3', 'D4'], ['D3', 'G3', 'B3']),
    'D': ('D2', ['F#3', 'A3', 'D4'], ['D3', 'F#3', 'A3']),
    'D7': ('D2', ['F#3', 'C4', 'D4'], ['D3', 'F#3', 'C4']),
}

A_CH = ['Em', 'Am', 'B7', 'Em', 'C', 'Am', 'B7', 'Em']
B_CH = ['G', 'D', 'Em', 'C', 'G', 'D7', 'C', 'B7']

A_MEL = [
    [(0, 1, 'B4'), (1, 1, 'E5'), (2, 1, 'G5')],
    [(0, 1.5, 'E5'), (1.5, 0.5, 'D5'), (2, 1, 'C5')],
    [(0, 1, 'B4'), (1, 1, 'D#5'), (2, 1, 'F#5')],
    [(0, 2, 'E5'), (2, 0.5, 'F#5'), (2.5, 0.5, 'G5')],
    [(0, 1, 'G5'), (1, 1, 'E5'), (2, 1, 'C5')],
    [(0, 1, 'A4'), (1, 1, 'C5'), (2, 1, 'E5')],
    [(0, 1.5, 'D#5'), (1.5, 0.5, 'E5'), (2, 1, 'F#5')],
    [(0, 2, 'E5'), (2, 1, 'B4')],
]
A2_MEL = A_MEL[:7] + [[(0, 3, 'E5')]]
B_MEL = [
    [(0, 1, 'D5'), (1, 1, 'G5'), (2, 1, 'B5')],
    [(0, 2, 'A5'), (2, 1, 'F#5')],
    [(0, 1, 'G5'), (1, 1, 'E5'), (2, 1, 'B4')],
    [(0, 2, 'C5'), (2, 1, 'E5')],
    [(0, 1, 'D5'), (1, 0.5, 'E5'), (1.5, 0.5, 'F#5'), (2, 1, 'G5')],
    [(0, 1, 'A5'), (1, 1, 'F#5'), (2, 1, 'C5')],
    [(0, 1, 'E5'), (1, 1, 'G5'), (2, 1, 'E5')],
    [(0, 3, 'D#5')],
]


def waltz(bar, ch, pizz=52, bass=58, strings=22):
    t = bar * BAR
    b, pah, bed = H[ch]
    S.note(t, 0.9, BASS, b, bass)
    for beat in (1, 2):
        for k in pah:
            S.note(t + beat, 0.4, PIZZ, k, pizz - (6 if beat == 2 else 0))
    for k in bed:
        S.note(t, BAR - 0.05, STR, k, strings)


def melody(bar, cells, chan, vel, octave=0):
    for beat, dur, k in cells:
        S.note(bar * BAR + beat, dur - 0.05, chan, n(k) + 12 * octave, vel + (5 if beat == 0 else 0))


def bubbles(bar, top='E6', vel=34):
    """Little celesta notes popping upward, like bubbles breaking on a cauldron."""
    t = bar * BAR + 1.5
    for i, k in enumerate([n(top) - 12, n(top) - 5, n(top)]):
        S.note(t + i * 0.5, 0.45, CEL, k, vel - i * 3)


bar = 0
# Verse 1: the bassoon sneaks in, an octave down.
for i in range(8):
    waltz(bar, A_CH[i])
    melody(bar, A_MEL[i], BASSOON, 62, octave=-1)
    if i in (3, 7):
        bubbles(bar, 'E6' if i == 3 else 'B5')
    bar += 1
# Verse 2: the clarinet takes the tune, the bassoon answers each phrase end.
for i in range(8):
    waltz(bar, A_CH[i], pizz=54, strings=28)
    melody(bar, A2_MEL[i], CLAR, 58)
    if i % 2 == 1:
        melody(bar, A2_MEL[i][-1:], BASSOON, 40, octave=-1)
    if i == 3:
        bubbles(bar, 'G6')
    bar += 1
# Market day: G major, with the glockenspiel.
for i in range(8):
    waltz(bar, B_CH[i], pizz=56, bass=60, strings=30)
    melody(bar, B_MEL[i], CLAR, 56)
    melody(bar, B_MEL[i], GLOCK, 30, octave=1)
    bar += 1
# Last verse: bassoon and clarinet together, with the celesta stirring underneath.
for i in range(8):
    waltz(bar, A_CH[i], pizz=50, strings=26)
    melody(bar, A_MEL[i], CLAR, 50)
    melody(bar, A_MEL[i], BASSOON, 46, octave=-1)
    if i % 2 == 0:
        melody(bar, A_MEL[i][:1], CEL, 22, octave=1)
    if i == 7:
        # A chromatic creep back down into the first verse.
        for j, k in enumerate(['A5', 'F#5', 'D#5', 'C5', 'B4', 'A4']):
            S.note(bar * BAR + 1 + j / 3, 0.3, PIZZ, k, 48)
    bar += 1

loop_beats = bar * BAR
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/cauldron.mp3'
L, pad_s = render(S, {PIZZ: 45, BASSOON: 70, CLAR: 71, BASS: 32, GLOCK: 9, CEL: 8, STR: 49}, loop_beats, out, rt60=1.8, wet=0.28,
                  pans={PIZZ: 52, BASSOON: 56, CLAR: 70, BASS: 62, GLOCK: 84, CEL: 92, STR: 64},
                  vols={PIZZ: 92, BASSOON: 100, CLAR: 92, BASS: 96, GLOCK: 70, CEL: 72, STR: 62},
                  warmth=4, even=0.4)
print(f'cauldron: {bar} bars, loop {L:.3f}s, pad {pad_s}s')
