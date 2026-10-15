"""Hero League: a bright superhero march in B-flat. Driving staccato strings and timpani under a horn theme that
leaps up a fifth, trumpets join for the second verse, the middle turns to G minor with the glockenspiel catching
the top line, and everything comes back together for the last verse. Kept at an even level so it sits behind play."""
import sys

from render import Score, n, render

S = Score(bpm=128)
OST, PAD, HORN, TPT, TBN, TIMP, GLOCK, BASS = 0, 1, 2, 3, 4, 5, 6, 7
BAR = 4

# bass, a low string pedal pattern, the chord for the pad and brass
H = {
    'Bb': ('Bb1', ['Bb2', 'F3'], ['Bb3', 'D4', 'F4'], 'Bb2'),
    'Gm': ('G1', ['G2', 'D3'], ['G3', 'Bb3', 'D4'], 'G2'),
    'Eb': ('Eb2', ['Eb3', 'Bb3'], ['G3', 'Bb3', 'Eb4'], 'Eb3'),
    'F': ('F1', ['F2', 'C3'], ['A3', 'C4', 'F4'], 'F2'),
    'C': ('C2', ['C3', 'G3'], ['G3', 'C4', 'E4'], 'C3'),
}
A_CH = [['Bb'], ['Gm'], ['Eb'], ['F'], ['Bb'], ['Gm'], ['Eb', 'F'], ['Bb']]
B_CH = [['Gm'], ['Eb'], ['Bb'], ['F'], ['Gm'], ['Eb'], ['C'], ['F']]

A_MEL = [
    [(0, 1, 'Bb4'), (1, 0.5, 'C5'), (1.5, 0.5, 'D5'), (2, 2, 'F5')],
    [(0, 1.5, 'G5'), (1.5, 0.5, 'F5'), (2, 1, 'D5'), (3, 1, 'Bb4')],
    [(0, 1, 'C5'), (1, 1, 'Eb5'), (2, 1.5, 'G5'), (3.5, 0.5, 'F5')],
    [(0, 3, 'F5'), (3, 0.5, 'C5'), (3.5, 0.5, 'D5')],
    [(0, 1, 'Bb4'), (1, 0.5, 'C5'), (1.5, 0.5, 'D5'), (2, 2, 'Bb5')],
    [(0, 1.5, 'A5'), (1.5, 0.5, 'G5'), (2, 1, 'D5'), (3, 1, 'G5')],
    [(0, 1, 'G5'), (1, 1, 'Eb5'), (2, 1, 'F5'), (3, 1, 'A5')],
    [(0, 3, 'Bb5'), (3, 1, 'F5')],
]
B_MEL = [
    [(0, 2, 'D5'), (2, 1, 'G5'), (3, 1, 'Bb5')],
    [(0, 2, 'Bb5'), (2, 1, 'G5'), (3, 1, 'Eb5')],
    [(0, 1.5, 'F5'), (1.5, 0.5, 'D5'), (2, 2, 'Bb4')],
    [(0, 1, 'C5'), (1, 1, 'D5'), (2, 2, 'F5')],
    [(0, 2, 'D5'), (2, 1, 'G5'), (3, 1, 'A5')],
    [(0, 2, 'Bb5'), (2, 1, 'C6'), (3, 1, 'Bb5')],
    [(0, 2, 'G5'), (2, 1, 'E5'), (3, 1, 'G5')],
    [(0, 2, 'A5'), (2, 1, 'F5'), (3, 1, 'C5')],
]


def drive(bar, chords, ost=46, pad=20, bass=56, timp=50, brass=0):
    """Eighth-note string pedal, a held pad, bass on the downbeats and timpani on 1 and 3."""
    t0 = bar * BAR
    span = BAR / len(chords)
    for ci, ch in enumerate(chords):
        b, ped, triad, tim = H[ch]
        t = t0 + ci * span
        S.note(t, span - 0.1, BASS, b, bass)
        steps = int(span * 2)
        for k in range(steps):
            S.note(t + k * 0.5, 0.32, OST, ped[1] if k % 4 == 2 else ped[0], ost + (6 if k % 2 == 0 else 0))
        for key in triad:
            S.note(t, span - 0.05, PAD, key, pad)
        for k in range(0, int(span), 2):
            S.note(t + k, 0.5, TIMP, tim, timp + (6 if k == 0 else 0))
        if brass:
            for key in triad:
                S.note(t + span - 1, 0.45, TBN, n(key) - 12, brass)
                S.note(t + span - 0.5, 0.45, TBN, n(key) - 12, brass - 4)


def melody(bar, cells, chan, vel, octave=0):
    for beat, dur, k in cells:
        S.note(bar * BAR + beat, dur - 0.06, chan, n(k) + 12 * octave, vel + (5 if beat == 0 else 0))


def roll(bar, key='F2', vel=40):
    """A timpani roll into the next phrase."""
    for j in range(8):
        S.note(bar * BAR + 2 + j * 0.25, 0.22, TIMP, key, vel + j * 3)


bar = 0
# Verse 1: horns, an octave down, over the strings.
for i in range(8):
    drive(bar, A_CH[i])
    melody(bar, A_MEL[i], HORN, 66, octave=-1)
    if i == 7:
        roll(bar)
    bar += 1
# Verse 2: trumpet takes the theme, horns hold harmony, trombone kicks on the off-beats.
for i in range(8):
    drive(bar, A_CH[i], ost=50, pad=24, brass=40)
    melody(bar, A_MEL[i], TPT, 62)
    melody(bar, A_MEL[i][:1], HORN, 46, octave=-1)
    bar += 1
# Middle: G minor, strings sing, glockenspiel sparkles above.
for i in range(8):
    drive(bar, B_CH[i], ost=48, pad=30, timp=44)
    melody(bar, B_MEL[i], HORN, 58, octave=-1)
    melody(bar, B_MEL[i], GLOCK, 30, octave=1)
    if i == 7:
        roll(bar, 'C3', 42)
    bar += 1
# Last verse: everyone.
for i in range(8):
    drive(bar, A_CH[i], ost=52, pad=26, timp=54, brass=42)
    melody(bar, A_MEL[i], TPT, 60)
    melody(bar, A_MEL[i], HORN, 52, octave=-1)
    if i % 2 == 1:
        melody(bar, A_MEL[i][-1:], GLOCK, 24, octave=1)
    if i == 7:
        roll(bar, 'Bb2', 38)
    bar += 1

loop_beats = bar * BAR
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/heroes.mp3'
L, pad_s = render(S, {OST: 48, PAD: 49, HORN: 60, TPT: 56, TBN: 57, TIMP: 47, GLOCK: 9, BASS: 43}, loop_beats, out, rt60=1.6, wet=0.24,
                  pans={OST: 50, PAD: 64, HORN: 46, TPT: 78, TBN: 58, TIMP: 64, GLOCK: 88, BASS: 62},
                  vols={OST: 90, PAD: 66, HORN: 100, TPT: 88, TBN: 70, TIMP: 92, GLOCK: 66, BASS: 96},
                  warmth=4, even=0.4)
print(f'heroes: {bar} bars, loop {L:.3f}s, pad {pad_s}s')
