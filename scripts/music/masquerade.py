"""The Masquerade Court: a candlelit Venetian waltz in D minor. A harpsichord keeps the oom-pah-pah over a plucked
bass, a violin carries the first verse with a soft string bed, a flute answers in the second, the middle turns to
F major with a harp rippling underneath, and the last verse brings everyone back. Celesta sparkles close each phrase.
Kept even and unhurried so it sits behind a game of bluffs."""
import sys

from render import Score, n, render

S = Score(bpm=150)  # one beat = one quarter note, three to a bar
HPSI, STR, VLN, FLT, HARP, BASS, CEL = 0, 1, 2, 3, 4, 5, 6
BAR = 3

# bass note, the "pah-pah" chord, a soft string bed
H = {
    'Dm': ('D2', ['F3', 'A3', 'D4'], ['D3', 'F3', 'A3']),
    'Gm': ('G2', ['G3', 'Bb3', 'D4'], ['D3', 'G3', 'Bb3']),
    'A7': ('A1', ['G3', 'C#4', 'E4'], ['C#3', 'E3', 'G3']),
    'Bb': ('Bb1', ['F3', 'Bb3', 'D4'], ['D3', 'F3', 'Bb3']),
    'F': ('F2', ['F3', 'A3', 'C4'], ['C3', 'F3', 'A3']),
    'C7': ('C2', ['E3', 'Bb3', 'C4'], ['C3', 'E3', 'Bb3']),
}
A_CH = ['Dm', 'Gm', 'A7', 'Dm', 'Bb', 'Gm', 'A7', 'Dm']
B_CH = ['F', 'C7', 'Dm', 'Bb', 'F', 'C7', 'Gm', 'A7']

A_MEL = [
    [(0, 1, 'A4'), (1, 1, 'D5'), (2, 1, 'F5')],
    [(0, 1.5, 'G5'), (1.5, 0.5, 'F5'), (2, 1, 'D5')],
    [(0, 1, 'E5'), (1, 1, 'C#5'), (2, 1, 'A4')],
    [(0, 2, 'D5'), (2, 1, 'A4')],
    [(0, 1, 'F5'), (1, 1, 'D5'), (2, 1, 'Bb4')],
    [(0, 1, 'G5'), (1, 1, 'Bb5'), (2, 1, 'A5')],
    [(0, 1.5, 'G5'), (1.5, 0.5, 'F5'), (2, 1, 'E5')],
    [(0, 3, 'D5')],
]
B_MEL = [
    [(0, 1, 'C5'), (1, 1, 'F5'), (2, 1, 'A5')],
    [(0, 1.5, 'G5'), (1.5, 0.5, 'F5'), (2, 1, 'E5')],
    [(0, 1, 'F5'), (1, 1, 'D5'), (2, 1, 'A4')],
    [(0, 2, 'Bb4'), (2, 1, 'D5')],
    [(0, 1, 'A5'), (1, 1, 'G5'), (2, 1, 'F5')],
    [(0, 1, 'E5'), (1, 1, 'G5'), (2, 1, 'Bb5')],
    [(0, 1.5, 'A5'), (1.5, 0.5, 'G5'), (2, 1, 'F5')],
    [(0, 2, 'E5'), (2, 1, 'C#5')],
]


def waltz(bar, ch, hpsi=44, pad=22, bass=58, harp=0):
    """Bass on one, harpsichord chords on two and three, a held string bed, and (optionally) a harp ripple."""
    b, chord, bed = H[ch]
    t = bar * BAR
    S.note(t, 1.6, BASS, b, bass)
    for beat in (1, 2):
        for k in chord:
            S.note(t + beat, 0.42, HPSI, k, hpsi + (4 if beat == 1 else 0))
    for k in bed:
        S.note(t, BAR - 0.05, STR, k, pad)
    if harp:
        notes = [n(bed[0]), n(bed[1]), n(bed[2]), n(bed[0]) + 12, n(bed[1]) + 12, n(bed[2]) + 12]
        for i, k in enumerate(notes):
            S.note(t + i * 0.5, 1.2, HARP, k, harp - i)


def melody(bar, cells, chan, vel, octave=0):
    for beat, dur, k in cells:
        S.note(bar * BAR + beat, dur - 0.05, chan, n(k) + 12 * octave, vel + (5 if beat == 0 else 0))


def sparkle(bar, keys, vel=26):
    for i, k in enumerate(keys):
        S.note(bar * BAR + 2 + i * 0.33, 0.6, CEL, k, vel)


bar = 0
# Verse 1: the violin, softly, over harpsichord and strings.
for i in range(8):
    waltz(bar, A_CH[i])
    melody(bar, A_MEL[i], VLN, 60)
    if i == 7:
        sparkle(bar, ['A5', 'D6', 'F6'])
    bar += 1
# Verse 2: the flute answers, the violin drops to harmony a sixth below on the long notes.
for i in range(8):
    waltz(bar, A_CH[i], hpsi=46, pad=24)
    melody(bar, A_MEL[i], FLT, 56)
    melody(bar, A_MEL[i][-1:], VLN, 38, octave=-1)
    if i == 7:
        sparkle(bar, ['F5', 'A5', 'D6'])
    bar += 1
# Middle: F major, the harp rippling under the violin.
for i in range(8):
    waltz(bar, B_CH[i], hpsi=38, pad=26, harp=30)
    melody(bar, B_MEL[i], VLN, 58)
    if i in (3, 7):
        sparkle(bar, ['C6', 'F6', 'A6'] if i == 3 else ['E5', 'A5', 'C#6'], 22)
    bar += 1
# Middle again, the flute leading, the harp lighter.
for i in range(8):
    waltz(bar, B_CH[i], hpsi=40, pad=26, harp=24)
    melody(bar, B_MEL[i], FLT, 54)
    melody(bar, B_MEL[i], VLN, 34, octave=-1)
    bar += 1
# Last verse: everyone.
for i in range(8):
    waltz(bar, A_CH[i], hpsi=46, pad=28, harp=20)
    melody(bar, A_MEL[i], VLN, 58)
    melody(bar, A_MEL[i], FLT, 46, octave=1 if i in (0, 4) else 0)
    if i == 7:
        sparkle(bar, ['D6', 'A5', 'F5', 'D5'], 24)
    bar += 1

loop_beats = bar * BAR
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/masquerade.mp3'
L, pad_s = render(S, {HPSI: 6, STR: 48, VLN: 40, FLT: 73, HARP: 46, BASS: 45, CEL: 8}, loop_beats, out, rt60=1.8, wet=0.28,
                  pans={HPSI: 50, STR: 64, VLN: 72, FLT: 56, HARP: 84, BASS: 60, CEL: 90},
                  vols={HPSI: 80, STR: 70, VLN: 100, FLT: 92, HARP: 80, BASS: 100, CEL: 70},
                  warmth=4, even=0.4)
print(f'masquerade: {bar} bars, loop {L:.3f}s, pad {pad_s}s')
