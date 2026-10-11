"""The Board Game Shelf (lobby): a cosy, lightly swung café tune in F major.
Marimba tune over nylon guitar and a walking upright bass; a clarinet takes the middle section over soft strings,
and a woodblock ticks along like dice on a table."""
import sys

from render import Score, n, render

S = Score(bpm=104)
MARIMBA, GUITAR, BASS, CLARINET, STRINGS, BLOCK = range(6)
BAR = 4

# name: (bass root, guitar voicing)
C = {
    'Fmaj7': ('F2', ['F3', 'A3', 'C4', 'E4']),
    'F6': ('F2', ['F3', 'A3', 'C4', 'D4']),
    'Dm7': ('D2', ['D3', 'F3', 'A3', 'C4']),
    'Gm7': ('G2', ['G3', 'Bb3', 'D4', 'F4']),
    'C7': ('C2', ['E3', 'G3', 'Bb3', 'C4']),
    'Bbmaj7': ('Bb1', ['F3', 'A3', 'Bb3', 'D4']),
    'Bbm6': ('Bb1', ['F3', 'G3', 'Bb3', 'Db4']),
    'Am7': ('A1', ['E3', 'G3', 'A3', 'C4']),
    'D7': ('D2', ['F#3', 'A3', 'C4', 'D4']),
}
A = [['Fmaj7'], ['Dm7'], ['Gm7'], ['C7'], ['Fmaj7'], ['Bbmaj7'], ['Gm7', 'C7'], ['F6']]
B = [['Bbmaj7'], ['Bbm6'], ['Am7'], ['D7'], ['Gm7'], ['C7'], ['Am7', 'D7'], ['Gm7', 'C7']]
FORM = A + B + A


def swing(beat):
    """Lay the off-beat eighths back a little."""
    whole = int(beat)
    return whole + 0.6 if abs(beat - whole - 0.5) < 1e-6 else beat


def minor(name):
    return 'm' in name and 'maj' not in name


def chord_span(t0, dur, name, nxt, vel=1.0):
    root, voicing = C[name]
    r = n(root)
    # Walking bass: root, third, fifth, then a step into the next chord (two notes if it's a half bar).
    walk = [r, r + (3 if minor(name) else 4), r + 7, n(C[nxt][0]) - 1] if dur == 4 else [r, r + 7]
    if walk[-1] < r - 6:
        walk[-1] += 12
    for i, k in enumerate(walk):
        S.note(t0 + i, 0.92, BASS, k, 54 + (6 if i == 0 else 0))
    # Guitar: a light Charleston comp.
    for beat, length, v in ((0, 0.9, 38), (1.5, 0.45, 32), (3, 0.5, 28))[: 3 if dur == 4 else 2]:
        for j, k in enumerate(voicing):
            S.note(t0 + swing(beat) + j * 0.012, length, GUITAR, k, v * vel)


def melody(bar, cells, chan, vel):
    for beat, note, dur in cells:
        S.note(bar * BAR + swing(beat), dur * 0.95, chan, note, vel + (4 if beat == 0 else 0))


TUNE_A = [
    [(0.5, 'A4', 0.5), (1, 'C5', 0.5), (1.5, 'E5', 1), (3, 'D5', 0.5), (3.5, 'C5', 0.5)],
    [(0, 'A4', 1.5), (2, 'F4', 0.5), (2.5, 'A4', 0.5), (3, 'C5', 1)],
    [(0, 'Bb4', 0.5), (0.5, 'D5', 0.5), (1, 'F5', 1), (2.5, 'E5', 0.5), (3, 'D5', 1)],
    [(0, 'C5', 1), (1, 'Bb4', 0.5), (1.5, 'G4', 0.5), (2, 'E4', 1.5)],
    [(0.5, 'A4', 0.5), (1, 'C5', 0.5), (1.5, 'F5', 1), (3, 'E5', 0.5), (3.5, 'F5', 0.5)],
    [(0, 'G5', 1), (1, 'F5', 0.5), (1.5, 'D5', 0.5), (2, 'Bb4', 1.5)],
    [(0, 'A4', 0.5), (0.5, 'Bb4', 0.5), (1, 'D5', 1), (2, 'C5', 0.5), (2.5, 'Bb4', 0.5), (3, 'G4', 1)],
    [(0, 'F4', 2)],
]
# The last A ends with a little pickup back to the top.
TUNE_A_END = [(0, 'F4', 1), (1, 'A4', 0.5), (1.5, 'C5', 0.5), (2, 'D5', 1), (3, 'E5', 0.5), (3.5, 'G4', 0.5)]
TUNE_B = [
    [(0, 'D5', 1.5), (1.5, 'C5', 0.5), (2, 'A4', 2)],
    [(0, 'Db5', 1.5), (1.5, 'C5', 0.5), (2, 'G4', 2)],
    [(0, 'C5', 1), (1, 'E5', 1), (2, 'G5', 1.5), (3.5, 'F#5', 0.5)],
    [(0, 'F#5', 2), (2, 'E5', 0.5), (2.5, 'D5', 0.5), (3, 'C5', 1)],
    [(0, 'Bb4', 1.5), (1.5, 'A4', 0.5), (2, 'Bb4', 1), (3, 'D5', 1)],
    [(0, 'E5', 2), (2, 'G5', 1), (3, 'E5', 1)],
    [(0, 'C5', 1), (1, 'A4', 1), (2, 'F#4', 1), (3, 'A4', 1)],
    [(0, 'G4', 1.5), (1.5, 'Bb4', 0.5), (2, 'C5', 1), (3, 'E5', 1)],
]
# Marimba answers the clarinet in the B section.
FILLS_B = {1: [(3, 'F5', 0.5), (3.5, 'Db5', 0.5)], 3: [(3.5, 'A5', 0.5)], 5: [(3, 'Bb5', 0.5), (3.5, 'G5', 0.5)]}

flat = [(bar, name, len(chords)) for bar, chords in enumerate(FORM) for name in chords]
for i, (bar, name, k) in enumerate(flat):
    pos = [c for c in flat if c[0] == bar].index((bar, name, k))
    t0 = bar * BAR + pos * (BAR // k)
    nxt = flat[(i + 1) % len(flat)][1]
    chord_span(t0, BAR // k, name, nxt, vel=0.85 if 8 <= bar < 16 else 1.0)

for bar in range(len(FORM)):
    sec, j = divmod(bar, 8)
    if sec == 1:
        melody(bar, TUNE_B[j], CLARINET, 50)
        if j in FILLS_B:
            melody(bar, FILLS_B[j], MARIMBA, 40)
        # Soft strings underneath.
        for k in C[FORM[bar][0]][1][1:]:
            S.note(bar * BAR, BAR - 0.05, STRINGS, n(k) + 12, 24)
    else:
        cells = TUNE_A_END if (sec == 2 and j == 7) else TUNE_A[j]
        melody(bar, cells, MARIMBA, 56 if sec == 0 else 60)
        if sec == 2 and j < 7:
            # Clarinet holds a quiet guide tone under the returning tune.
            S.note(bar * BAR, BAR * 0.95, CLARINET, n(C[FORM[bar][0]][1][1]) + 12, 30)
    for beat in (1, 3):
        S.note(bar * BAR + beat, 0.1, BLOCK, 'E5', 22 if beat == 1 else 28)

loop_beats = len(FORM) * BAR
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/lobby-theme.mp3'
programs = {MARIMBA: 12, GUITAR: 24, BASS: 32, CLARINET: 71, STRINGS: 49, BLOCK: 115}
pans = {MARIMBA: 52, GUITAR: 84, BASS: 64, CLARINET: 44, STRINGS: 70, BLOCK: 96}
vols = {MARIMBA: 100, GUITAR: 92, BASS: 100, CLARINET: 86, STRINGS: 70, BLOCK: 60}
L, pad_s = render(S, programs, loop_beats, out, rt60=1.6, wet=0.22, humanize=0.007, pans=pans, vols=vols, tail=6,
                  warmth=4, even=0.5)
print(f'lobby: {len(FORM)} bars, loop {L:.3f}s, pad {pad_s}s')
