"""Oakhaven: a gentle piano cakewalk (2/4, E-flat major), in the manner of an early-1900s parlour cakewalk,
played softly and unhurried so it sits behind the game: light touch, rounded phrasing, a quiet string bed."""
import sys

from render import Score, n, render

S = Score(bpm=84)
PIANO, PAD = 0, 1
BAR = 2  # beats per bar (2/4)
SX = 0.25  # one sixteenth, in beats

# Left hand: (bass, alternate bass, chord voicing) for each harmony.
H = {
    'Eb': ('Eb2', 'Bb2', ['G3', 'Bb3', 'Eb4']),
    'Eb/Bb': ('Bb2', 'Eb3', ['G3', 'Bb3', 'Eb4']),
    'Bb7': ('Bb2', 'F2', ['F3', 'Ab3', 'D4']),
    'Ab': ('Ab2', 'Eb2', ['Ab3', 'C4', 'Eb4']),
    'Abm': ('Ab2', 'Eb2', ['Ab3', 'B3', 'Eb4']),
    'F7': ('F2', 'C3', ['A3', 'C4', 'Eb4']),
    'Fm': ('F2', 'C3', ['Ab3', 'C4', 'F4']),
    'Db': ('Db3', 'Ab2', ['F3', 'Ab3', 'Db4']),
    'Bbm7': ('Bb2', 'F2', ['F3', 'Ab3', 'Db4']),
    'Eb7': ('Eb2', 'Bb2', ['G3', 'Bb3', 'Db4']),
}


def lh(bar, chords, vel=40, only_first=False, bed=22):
    """Oom-pah: bass on each beat, a light chord on each off-beat, with a soft string bed holding the harmony."""
    t0 = bar * BAR
    halves = chords if len(chords) == 2 else [chords[0], chords[0]]
    for h, name in enumerate(halves):
        bass, alt, chord = H[name]
        b = bass if h == 0 or len(chords) == 2 else alt
        t = t0 + h
        S.note(t, 0.46, PIANO, b, vel + 2)
        for k in chord:
            S.note(t + 0.5, 0.36, PIANO, k, vel - 12)
        if bed:
            for k in chord:
                S.note(t, 0.98, PAD, k, bed)
        if only_first:
            return


def rh(bar, cells, vel=52, legato=False):
    """cells: (sixteenth position, note, length in sixteenths[, 'g' for a grace note])."""
    t0 = bar * BAR
    for c in cells:
        pos, note, ln = c[0], c[1], c[2]
        t = t0 + pos * SX
        gate = ln * SX * (0.97 if legato else (0.75 if ln <= 2 else 0.9))
        accent = 3 if pos in (0, 4) else (1 if pos % 2 == 0 else 0)
        top = max(0, n(note) - 72)  # keep the high notes from poking out
        if len(c) > 3 and 'g' in c[3]:
            S.note(t - 0.08, 0.08, PIANO, n(note) - 1, vel - 18 - top)
        S.note(t, gate, PIANO, note, vel + accent - top)


def pad(bar, notes, bars=1, vel=26):
    for k in notes:
        S.note(bar * BAR, bars * BAR - 0.05, PAD, k, vel)


A = [
    [(0, 'Bb4', 1), (1, 'Eb5', 2, 'g'), (3, 'Bb4', 1), (4, 'G4', 2), (6, 'Eb4', 2)],
    [(0, 'F4', 1), (1, 'G4', 2), (3, 'Ab4', 1), (4, 'Bb4', 2), (6, 'C5', 1), (7, 'D5', 1)],
    [(0, 'Eb5', 1), (1, 'F5', 2), (3, 'D5', 1), (4, 'Bb4', 2), (6, 'Ab4', 2)],
    [(0, 'G4', 1), (1, 'Bb4', 2), (3, 'G4', 1), (4, 'Eb4', 2), (6, 'F4', 1), (7, 'G4', 1)],
    [(0, 'Ab4', 1), (1, 'C5', 2), (3, 'Ab4', 1), (4, 'Eb5', 2, 'g'), (6, 'F5', 2)],
    [(0, 'G5', 2), (2, 'F5', 1), (3, 'Eb5', 1), (4, 'C5', 1), (5, 'Bb4', 1), (6, 'G4', 2)],
    [(0, 'A4', 1), (1, 'C5', 2), (3, 'Eb5', 1), (4, 'D5', 1), (5, 'C5', 1), (6, 'Ab4', 1), (7, 'F4', 1)],
    [(0, 'G4', 2), (2, 'Eb4', 2)],
]
A_CH = [['Eb'], ['Eb'], ['Bb7'], ['Eb'], ['Ab'], ['Eb/Bb'], ['F7', 'Bb7'], ['Eb']]

A2_END = [
    [(0, 'Ab4', 1), (1, 'C5', 2), (3, 'Ab4', 1), (4, 'F5', 2), (6, 'Eb5', 2)],
    [(0, 'Eb5', 1), (1, 'Cb5', 2), (3, 'Ab4', 1), (4, 'Eb4', 2), (6, 'F4', 1), (7, 'G4', 1)],
    [(0, 'Ab4', 1), (1, 'Bb4', 2), (3, 'D5', 1), (4, 'F5', 2), (6, 'D5', 2)],
    [(0, 'Eb5', 2), (2, 'Bb4', 1), (3, 'G4', 1), (4, 'Eb4', 2)],
]
A2_CH = [['Ab'], ['Abm'], ['Bb7'], ['Eb']]

B = [
    [(0, 'C5', 3), (3, 'Bb4', 1), (4, 'Ab4', 2), (6, 'C5', 2)],
    [(0, 'F5', 4), (4, 'Eb5', 2), (6, 'C5', 2)],
    [(0, 'Db5', 3), (3, 'C5', 1), (4, 'Bb4', 2), (6, 'Ab4', 2)],
    [(0, 'Bb4', 2), (2, 'Db5', 2), (4, 'G4', 2), (6, 'Bb4', 2)],
    [(0, 'C5', 3), (3, 'Db5', 1), (4, 'Eb5', 2), (6, 'Ab5', 2)],
    [(0, 'Eb5', 2), (2, 'C5', 2), (4, 'A4', 2), (6, 'C5', 2)],
    [(0, 'D5', 3), (3, 'Eb5', 1), (4, 'F5', 2), (6, 'D5', 2)],
    [(0, 'Ab4', 2), (2, 'Bb4', 1), (3, 'C5', 1), (4, 'D5', 2)],
]
B_CH = [['Ab'], ['Fm'], ['Db'], ['Bbm7', 'Eb7'], ['Ab'], ['F7'], ['Bb7'], ['Bb7']]
B_PAD = [['Ab3', 'C4', 'Eb4'], ['Ab3', 'C4', 'F4'], ['Ab3', 'Db4', 'F4'], ['Ab3', 'Db4', 'G4'],
         ['Ab3', 'C4', 'Eb4'], ['A3', 'C4', 'Eb4'], ['Ab3', 'D4', 'F4'], ['Ab3', 'D4', 'F4']]

bar = 0
# Intro: the vamp alone, then a little run up into the tune.
lh(bar, ['Eb'], 36); bar += 1
lh(bar, ['Eb'], 37); bar += 1
lh(bar, ['Bb7'], 38); bar += 1
lh(bar, ['Eb'], 38)
rh(bar, [(4, 'F4', 1), (5, 'G4', 1), (6, 'Ab4', 1), (7, 'A4', 1)], 42); bar += 1


def section_a(alt_end=False, vel=52, final=False, pickup=None):
    global bar
    cells = A[:4] + (A2_END if alt_end else A[4:])
    chords = A_CH[:4] + (A2_CH if alt_end else A_CH[4:])
    for i in range(8):
        last = i == 7
        lh(bar, chords[i], 40, only_first=final and last)
        rh(bar, cells[i] + (pickup if last and pickup else []), vel)
        bar += 1


section_a()
section_a(alt_end=True, pickup=[(6, 'Ab4', 1), (7, 'Bb4', 1)])
for i in range(8):
    lh(bar, B_CH[i], 36, bed=0)
    rh(bar, B[i], 46, legato=True)
    pad(bar, B_PAD[i])
    bar += 1
section_a(vel=50)
section_a(alt_end=True, vel=48, final=True)

loop_beats = bar * BAR
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/oakhaven.mp3'
L, pad_s = render(S, {PIANO: 0, PAD: 49}, loop_beats, out, rt60=1.7, wet=0.28,
                  pans={PIANO: 64, PAD: 70}, vols={PIANO: 110, PAD: 64}, warmth=5, even=0.5)
print(f'oakhaven: {bar} bars, loop {L:.3f}s, pad {pad_s}s')
