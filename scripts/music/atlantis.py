"""Atlantis Expedition: a slow, lilting 6/8 sea-shanty-meets-lullaby in D minor. Harp arpeggios rock like
the swell, a vibraphone carries the tune, a flute takes the second verse, and the middle section lifts into
F major with a soft choir, as if the lost city comes into view. Celesta bubbles rise at phrase ends."""
import sys

from render import Score, n, render

S = Score(bpm=150)  # one beat = one eighth note
HARP, VIB, STR, BASS, CHOIR, CEL, FLUTE = 0, 1, 2, 3, 4, 5, 6
BAR = 6

# bass, harp arpeggio (low to high), string bed
H = {
    'Dm9': ('D2', ['D3', 'A3', 'C4', 'E4', 'F4', 'A4'], ['F3', 'A3', 'C4', 'E4']),
    'Bbmaj7': ('Bb1', ['Bb2', 'F3', 'A3', 'D4', 'F4', 'A4'], ['F3', 'A3', 'D4']),
    'Gm9': ('G2', ['G2', 'D3', 'F3', 'A3', 'Bb3', 'D4'], ['F3', 'Bb3', 'D4']),
    'A7sus': ('A2', ['A2', 'E3', 'G3', 'D4', 'E4', 'G4'], ['E3', 'G3', 'D4']),
    'A7': ('A2', ['A2', 'E3', 'G3', 'C#4', 'E4', 'G4'], ['E3', 'G3', 'C#4']),
    'Dm': ('D2', ['D3', 'A3', 'D4', 'F4', 'A4', 'D5'], ['F3', 'A3', 'D4']),
    'F': ('F2', ['F2', 'C3', 'F3', 'A3', 'C4', 'F4'], ['F3', 'A3', 'C4']),
    'C/E': ('E2', ['E2', 'C3', 'G3', 'C4', 'E4', 'G4'], ['E3', 'G3', 'C4']),
    'Bb': ('Bb1', ['Bb2', 'F3', 'Bb3', 'D4', 'F4', 'Bb4'], ['F3', 'Bb3', 'D4']),
    'Gm': ('G2', ['G2', 'D3', 'G3', 'Bb3', 'D4', 'G4'], ['G3', 'Bb3', 'D4']),
    'C': ('C2', ['C3', 'G3', 'C4', 'E4', 'G4', 'C5'], ['E3', 'G3', 'C4']),
}

A_CH = ['Dm9', 'Bbmaj7', 'Gm9', ['A7sus', 'A7'], 'Dm9', 'Bbmaj7', 'Gm9', 'A7']
A2_CH = ['Dm9', 'Bbmaj7', 'Gm9', ['A7sus', 'A7'], 'Dm9', 'Bbmaj7', ['Gm9', 'A7'], 'Dm']
B_CH = ['F', 'C/E', 'Dm', 'Bb', 'Gm', 'C', 'A7sus', 'A7']

A_MEL = [
    [(0, 3, 'A4'), (3, 2, 'D5'), (5, 1, 'E5')],
    [(0, 3, 'F5'), (3, 1, 'E5'), (4, 1, 'D5'), (5, 1, 'C5')],
    [(0, 4, 'D5'), (4, 1, 'Bb4'), (5, 1, 'A4')],
    [(0, 3, 'G4'), (3, 3, 'E4')],
    [(0, 3, 'A4'), (3, 2, 'D5'), (5, 1, 'E5')],
    [(0, 2, 'F5'), (2, 1, 'G5'), (3, 2, 'A5'), (5, 1, 'G5')],
    [(0, 3, 'F5'), (3, 1, 'E5'), (4, 1, 'D5'), (5, 1, 'Bb4')],
    [(0, 6, 'C#5')],
]
A2_MEL = A_MEL[:3] + [
    [(0, 2, 'G4'), (2, 1, 'A4'), (3, 3, 'E4')],
    A_MEL[4],
    A_MEL[5],
    [(0, 3, 'F5'), (3, 2, 'E5'), (5, 1, 'C#5')],
    [(0, 6, 'D5')],
]
B_MEL = [
    [(0, 3, 'C5'), (3, 3, 'A4')],
    [(0, 3, 'G4'), (3, 2, 'C5'), (5, 1, 'D5')],
    [(0, 3, 'E5'), (3, 3, 'F5')],
    [(0, 4, 'D5'), (4, 2, 'F5')],
    [(0, 3, 'G5'), (3, 1, 'F5'), (4, 1, 'E5'), (5, 1, 'D5')],
    [(0, 3, 'E5'), (3, 3, 'C5')],
    [(0, 3, 'D5'), (3, 3, 'E5')],
    [(0, 4, 'C#5'), (4, 2, 'E5')],
]


def harmony(bar, ch, harp=40, strings=26, bass=46, choir=0):
    t0 = bar * BAR
    parts = ch if isinstance(ch, list) else [ch]
    span = BAR / len(parts)
    for j, name in enumerate(parts):
        b, arp, bed = H[name]
        t = t0 + j * span
        S.note(t, span - 0.1, BASS, b, bass)
        # The harp rocks up and back down, like the swell.
        order = [0, 1, 2, 3, 4, 5] if span == BAR else [0, 2, 4]
        if span == BAR:
            seq = [arp[0], arp[1], arp[2], arp[3], arp[4], arp[5]]
            for i, k in enumerate(seq):
                S.note(t + i, 2.6, HARP, k, harp - (4 if i % 3 else 0))
            S.note(t + 3.5, 0.6, HARP, arp[4], harp - 14)
        else:
            for i in order:
                S.note(t + order.index(i), 1.8, HARP, arp[i], harp - 4)
        for k in bed:
            S.note(t, span - 0.05, STR, k, strings)
            if choir:
                S.note(t, span - 0.05, CHOIR, n(k) + 12, choir)


def melody(bar, cells, chan, vel, octave=0):
    for beat, dur, k in cells:
        S.note(bar * BAR + beat, dur - 0.05, chan, n(k) + 12 * octave, vel + (4 if beat == 0 else 0))


def bubbles(bar, top='D6', vel=30):
    """Three little rising celesta notes, like bubbles drifting up at the end of a phrase."""
    t = bar * BAR + 4
    for i, k in enumerate([n(top) - 7, n(top) - 3, n(top)]):
        S.note(t + i * 0.5, 0.5, CEL, k, vel - i * 2)


bar = 0
# Verse 1: vibraphone over the harp.
for i in range(8):
    harmony(bar, A_CH[i])
    melody(bar, A_MEL[i], VIB, 50)
    if i in (3, 7):
        bubbles(bar, 'E6' if i == 3 else 'C#6')
    bar += 1
# Verse 2: the flute takes the tune, the vibraphone answers an octave down.
for i in range(8):
    harmony(bar, A2_CH[i], harp=38, strings=30)
    melody(bar, A2_MEL[i], FLUTE, 54)
    if i % 2 == 1:
        melody(bar, A2_MEL[i][-1:], VIB, 30, octave=-1)
    if i == 3:
        bubbles(bar, 'E6')
    bar += 1
# The city comes into view: F major, with the choir.
for i in range(8):
    harmony(bar, B_CH[i], harp=42, strings=34, bass=50, choir=26 if i < 7 else 22)
    melody(bar, B_MEL[i], VIB, 52)
    melody(bar, B_MEL[i], CEL, 24, octave=1)
    if i == 7:
        # A harp sweep back down into the first verse.
        for j, k in enumerate(['E5', 'C#5', 'A4', 'G4', 'E4', 'C#4']):
            S.note(bar * BAR + 3 + j * 0.5, 1.2, HARP, k, 34)
    bar += 1

loop_beats = bar * BAR
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/atlantis.mp3'
L, pad_s = render(S, {HARP: 46, VIB: 11, STR: 49, BASS: 43, CHOIR: 52, CEL: 8, FLUTE: 73}, loop_beats, out, rt60=2.4, wet=0.34,
                  pans={HARP: 46, VIB: 70, STR: 64, BASS: 60, CHOIR: 80, CEL: 90, FLUTE: 52},
                  vols={HARP: 104, VIB: 92, STR: 70, BASS: 82, CHOIR: 64, CEL: 70, FLUTE: 84},
                  warmth=4, even=0.4)
print(f'atlantis: {bar} bars, loop {L:.3f}s, pad {pad_s}s')
