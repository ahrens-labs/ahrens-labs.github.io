"""Oakhaven at night (dusk and the creature's attack): a hushed C-minor nocturne in 3/4.
Harp arpeggios over soft strings and a low bass, a distant flute tune, celesta sparkles and an owl-like ocarina."""
import sys

from render import Score, n, render

S = Score(bpm=66)
HARP, PAD, BASS, FLUTE, CELESTA, OWL = range(6)
BAR = 3

# (bass, pad voicing, arpeggio)
C = {
    'Cm': ('C2', ['G3', 'C4', 'Eb4'], ['C3', 'G3', 'C4', 'Eb4', 'C4', 'G3']),
    'Ab': ('Ab1', ['Ab3', 'C4', 'Eb4'], ['Ab2', 'Eb3', 'Ab3', 'C4', 'Ab3', 'Eb3']),
    'Fm': ('F1', ['F3', 'Ab3', 'C4'], ['F2', 'C3', 'F3', 'Ab3', 'F3', 'C3']),
    'Fm6': ('F1', ['F3', 'Ab3', 'D4'], ['F2', 'C3', 'D3', 'Ab3', 'D3', 'C3']),
    'Gsus': ('G1', ['G3', 'C4', 'D4'], ['G2', 'D3', 'G3', 'C4', 'G3', 'D3']),
    'G': ('G1', ['G3', 'B3', 'D4'], ['G2', 'D3', 'G3', 'B3', 'G3', 'D3']),
    'Eb/Bb': ('Bb1', ['G3', 'Bb3', 'Eb4'], ['Bb2', 'Eb3', 'G3', 'Bb3', 'G3', 'Eb3']),
    'Cm/Eb': ('Eb2', ['G3', 'C4', 'Eb4'], ['Eb2', 'C3', 'G3', 'C4', 'G3', 'C3']),
    'Dm7b5': ('D2', ['F3', 'Ab3', 'C4'], ['D3', 'Ab3', 'C4', 'F4', 'C4', 'Ab3']),
}
PROG = ['Cm', 'Ab', 'Fm', 'Gsus', 'Cm', 'Eb/Bb', 'Ab', 'G',
        'Ab', 'Fm', 'Cm/Eb', 'Dm7b5', 'Cm', 'Ab', 'Fm6', 'G']


def harmony(bar, name, harp=36, pad=30, bass=38):
    b, voicing, arp = C[name]
    t0 = bar * BAR
    S.note(t0, BAR - 0.05, BASS, b, bass)
    for k in voicing:
        S.note(t0, BAR - 0.02, PAD, k, pad)
    for i, k in enumerate(arp):
        S.note(t0 + i * 0.5, 1.6, HARP, n(k) + 12, harp + (5 if i == 0 else 0))


def melody(bar, cells, chan, vel):
    for beat, note, dur in cells:
        S.note(bar * BAR + beat, dur * 0.97, chan, note, vel)


TUNE = {
    4: [(0, 'G5', 1.5), (1.5, 'F5', 0.5), (2, 'Eb5', 1)],
    5: [(0, 'D5', 2), (2, 'Eb5', 1)],
    6: [(0, 'C5', 1.5), (1.5, 'Bb4', 0.5), (2, 'Ab4', 1)],
    7: [(0, 'B4', 3)],
    12: [(0, 'Eb5', 1.5), (1.5, 'D5', 0.5), (2, 'C5', 1)],
    13: [(0, 'Eb5', 1), (1, 'G5', 2)],
    14: [(0, 'F5', 1.5), (1.5, 'Eb5', 0.5), (2, 'D5', 1)],
    15: [(0, 'D5', 2), (2, 'B4', 1)],
}

for bar, ch in enumerate(PROG):
    harmony(bar, ch, harp=34 if bar < 4 else 38)
    if bar in TUNE:
        melody(bar, TUNE[bar], FLUTE, 52)
# Celesta glints, like stars coming out.
for bar, notes in ((1, [(1.5, 'Eb6'), (2.5, 'G6')]), (9, [(0.5, 'C6'), (2, 'Eb6')]), (11, [(1, 'F6'), (2.5, 'Ab6')])):
    for beat, k in notes:
        S.note(bar * BAR + beat, 1.5, CELESTA, k, 30)
# An owl, somewhere out past the wall.
for bar in (2, 10):
    S.note(bar * BAR + 1, 0.45, OWL, 'E5', 34)
    S.note(bar * BAR + 1.6, 0.9, OWL, 'C5', 30)

loop_beats = len(PROG) * BAR
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/oakhaven-night.mp3'
programs = {HARP: 46, PAD: 49, BASS: 43, FLUTE: 73, CELESTA: 8, OWL: 79}
pans = {HARP: 44, PAD: 72, BASS: 64, FLUTE: 84, CELESTA: 30, OWL: 100}
vols = {HARP: 96, PAD: 80, BASS: 84, FLUTE: 80, CELESTA: 70, OWL: 60}
L, pad_s = render(S, programs, loop_beats, out, rt60=2.6, wet=0.34, humanize=0.006, pans=pans, vols=vols, tail=9,
                  warmth=4, even=0.6, loud=-10.5)
print(f'oakhaven night: {len(PROG)} bars, loop {L:.3f}s, pad {pad_s}s')
