"""Piano sheet music for the game themes: each piece is reduced to two hands and written as MusicXML, MIDI and PDF.

Runs each piece's script with a stand-in for render.py that records every note, which function wrote it and the
chord it belongs to, then arranges: the tune in the right hand (its top line), a left hand built from the piece's
own accompaniment, and chord symbols above. Needs mido, verovio, cairosvg and pypdf:
  python sheet.py ../../sheet-music
"""
import inspect
import io
import os
import re
import sys
import types
from xml.sax.saxutils import escape

import cairosvg
import mido
import verovio
from pypdf import PdfReader, PdfWriter

HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
CHORD_FNS = {'chord_span', 'harmony', 'lh', 'lh_flow'}


def n(name):
    pc = NAMES[name[0]]
    i = 1
    while i < len(name) and name[i] in '#b':
        pc += 1 if name[i] == '#' else -1
        i += 1
    return 12 * (int(name[i:]) + 1) + pc


class Score:
    def __init__(self, bpm):
        self.bpm = bpm
        self.notes = []  # (beat, dur, chan, key, vel, caller)
        self.chords = {}  # beat -> chord name

    def note(self, beat, dur, chan, key, vel):
        f = inspect.currentframe().f_back
        caller = f.f_code.co_name
        if caller in CHORD_FNS and isinstance(f.f_locals.get('name'), str):
            self.chords.setdefault(round(beat * 4) / 4, f.f_locals['name'])
        self.notes.append((beat, dur, chan, n(key) if isinstance(key, str) else key, vel, caller))

    def cc(self, *a):
        pass

    def ramp(self, *a, **k):
        pass


def capture(script):
    """Run a piece's script, returning its Score and loop length in beats without rendering audio."""
    got = {}
    mod = types.ModuleType('render')
    mod.Score, mod.n = Score, n

    def render(score, programs, loop_beats, path, **kw):
        got.update(score=score, beats=loop_beats)
        return loop_beats * 60 / score.bpm, 0.5

    mod.render = render
    sys.modules['render'] = mod
    argv = sys.argv
    sys.argv = [script, os.devnull]
    try:
        src = open(os.path.join(HERE, script)).read()
        ns = {'__name__': '__main__'}
        out = io.StringIO()
        stdout, sys.stdout = sys.stdout, out
        try:
            exec(compile(src, script, 'exec'), ns)
        finally:
            sys.stdout = stdout
    finally:
        sys.argv = argv
    return got['score'], got['beats'], ns


# ---------------------------------------------------------------- arranging
def q(x, swing=False):
    if swing and abs(x - int(x) - 0.6) < 0.05:
        x = int(x) + 0.5
    return round(x * 4) / 4


def line(notes, swing=False, top=True):
    """One voice from overlapping notes: notes starting together form a chord (or just the top note), and each
    event lasts until the next starts (small gaps are closed so the tune reads legato)."""
    by = {}
    for beat, dur, key in notes:
        t = q(beat, swing)
        by.setdefault(t, []).append((key, dur))
    times = sorted(by)
    out = []
    for i, t in enumerate(times):
        keys = sorted({k for k, _ in by[t]})
        if top:
            keys = keys[-1:]
        dur = max(d for _, d in by[t])
        nxt = times[i + 1] if i + 1 < len(times) else None
        end = t + dur
        if nxt is not None and (end > nxt or nxt - end < 0.3):
            end = nxt
        end = max(t + 0.25, q(end))
        out.append((t, end - t, keys))
    return out


def fill_bars(rh, chords_at, beats_per_bar, total):
    """Right hand rests for a whole bar get the harmony held instead (from `chords_at`: beat -> keys)."""
    busy = {int(t // beats_per_bar) for t, _, _ in rh}
    extra = []
    for bar in range(int(total // beats_per_bar)):
        if bar in busy:
            continue
        t0 = bar * beats_per_bar
        here = sorted((t, k) for t, k in chords_at.items() if t0 <= t < t0 + beats_per_bar)
        for i, (t, keys) in enumerate(here):
            end = here[i + 1][0] if i + 1 < len(here) else t0 + beats_per_bar
            extra.append((t, end - t, keys))
    return sorted(rh + extra)


def broken(spans, low=43):
    """Left hand: bass then two chord tones above it, in eighths (bass, a, b, a)."""
    out = []
    for t, dur, bass, voicing in spans:
        while bass < low:
            bass += 12
        while bass >= low + 12:
            bass -= 12
        tones = []
        for k in sorted(voicing):
            if k % 12 == bass % 12:
                continue
            while k <= bass + 2:
                k += 12
            while k > bass + 16:
                k -= 12
            tones.append(k)
        tones = sorted(set(tones))[:2] or [bass + 7]
        a, b = tones[0], tones[-1]
        pat = [bass, a, b, a]
        for s in range(int(round(dur * 2))):
            out.append((t + s * 0.5, 0.5, [pat[s % 4]]))
    return out


def lobby(S, ns):
    MAR, BASS, CLAR = ns['MARIMBA'], ns['BASS'], ns['CLARINET']
    rh = line([(b, d, k) for b, d, c, k, v, f in S.notes if c in (MAR, CLAR) and f == 'melody'], swing=True)
    lh = line([(b, d, k + (12 if k < 40 else 0)) for b, d, c, k, v, f in S.notes if c == BASS])
    return rh, lh


def dino(S, ns):
    HORN, FLUTE, VLN, BASS, STR = ns['HORN'], ns['FLUTE'], ns['VLN'], ns['BASS'], ns['STR']
    rh = line([(b, d, k) for b, d, c, k, v, f in S.notes if c in (HORN, FLUTE, VLN) and (f == 'melody' or c == HORN)])
    starts = {}
    for b, d, c, k, v, f in S.notes:
        if c == BASS:
            t = q(b)
            if t not in starts or k < starts[t][1]:
                starts[t] = (d, k)
    voic = {}
    for b, d, c, k, v, f in S.notes:
        if c == STR:
            voic.setdefault(q(b), []).append(k)
    spans = [(t, q(d + 0.05), k, voic.get(t, [])) for t, (d, k) in sorted(starts.items())]
    pads = {t: sorted(x + 12 for x in voic[t])[-3:] for t in voic}
    return fill_bars(rh, pads, ns['BAR'], ns['loop_beats']), broken(spans)


def oakhaven(S, ns):
    P = ns['PIANO']
    rh = line([(b, d, k) for b, d, c, k, v, f in S.notes if c == P and f == 'rh' and d >= 0.1])
    lh = line([(b, d, k) for b, d, c, k, v, f in S.notes if c == P and f in ('lh', 'lh_flow')], top=False)
    return rh, lh


def night(S, ns):
    FLUTE, HARP, PAD = ns['FLUTE'], ns['HARP'], ns['PAD']
    rh = line([(b, d, k) for b, d, c, k, v, f in S.notes if c == FLUTE])
    lh = line([(b, d, k - 12) for b, d, c, k, v, f in S.notes if c == HARP])
    pads = {}
    for b, d, c, k, v, f in S.notes:
        if c == PAD:
            pads.setdefault(q(b), []).append(k + 12)
    return fill_bars(rh, pads, ns['BAR'], ns['loop_beats']), lh


PIECES = [
    # file, title, arranger, fifths, mode, beats per bar, tempo words, sharps spell, out name
    ('lobby.py', 'The Board Game Shelf', lobby, -1, 'major', 4, 'Easy swing — play the eighths long-short', 'board-game-lobby'),
    ('dino.py', 'Dino Dynasty', dino, 2, 'major', 4, 'Broadly, with wonder', 'dino-dynasty'),
    ('oakhaven.py', 'Oakhaven', oakhaven, -3, 'major', 2, 'Cakewalk — lightly, with pedal', 'oakhaven'),
    ('oakhaven_night.py', 'Oakhaven at Night', night, -3, 'minor', 3, 'Slowly and hushed, with pedal', 'oakhaven-at-night'),
]


# ---------------------------------------------------------------- MusicXML
STEPS_SHARP = [('C', 0), ('C', 1), ('D', 0), ('D', 1), ('E', 0), ('F', 0), ('F', 1), ('G', 0), ('G', 1), ('A', 0), ('A', 1), ('B', 0)]
STEPS_FLAT = [('C', 0), ('D', -1), ('D', 0), ('E', -1), ('E', 0), ('F', 0), ('G', -1), ('G', 0), ('A', -1), ('A', 0), ('B', -1), ('B', 0)]
KEY_ORDER_SHARP = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
KEY_ORDER_FLAT = ['B', 'E', 'A', 'D', 'G', 'C', 'F']


def spell(key, fifths):
    pc = key % 12
    if fifths >= 0:
        step, alt = STEPS_SHARP[pc]
        if pc == 10:
            step, alt = 'B', -1
    else:
        step, alt = STEPS_FLAT[pc]
        if pc == 6:
            step, alt = 'F', 1
    octave = key // 12 - 1
    return step, alt, octave


def key_alter(step, fifths):
    if fifths > 0 and step in KEY_ORDER_SHARP[:fifths]:
        return 1
    if fifths < 0 and step in KEY_ORDER_FLAT[:-fifths]:
        return -1
    return 0


VALUES = [(16, 'whole', 0), (12, 'half', 1), (8, 'half', 0), (6, 'quarter', 1), (4, 'quarter', 0), (3, 'eighth', 1), (2, 'eighth', 0), (1, '16th', 0)]


def pieces_of(d):
    out = []
    while d > 0:
        for v, name, dots in VALUES:
            if v <= d:
                out.append((v, name, dots))
                d -= v
                break
    return out


def parse_chord(name):
    main, _, bass = name.partition('/')
    root = main[0]
    i = 1
    alt = 0
    while i < len(main) and main[i] in '#b':
        alt += 1 if main[i] == '#' else -1
        i += 1
    rest = main[i:]
    kinds = {'': 'major', 'm': 'minor', '7': 'dominant', 'maj7': 'major-seventh', 'm7': 'minor-seventh', '6': 'major-sixth',
             'm6': 'minor-sixth', 'add9': 'major', 'sus': 'suspended-fourth', '7sus': 'suspended-fourth', 'm7b5': 'half-diminished'}
    texts = {'': '', 'm': 'm', '7': '7', 'maj7': 'maj7', 'm7': 'm7', '6': '6', 'm6': 'm6', 'add9': 'add9', 'sus': 'sus',
             '7sus': '7sus', 'm7b5': 'm7♭5'}
    kind, text = kinds.get(rest, 'major'), texts.get(rest, rest)
    xml = f'<harmony print-frame="no"><root><root-step>{root}</root-step>{f"<root-alter>{alt}</root-alter>" if alt else ""}</root>'
    xml += f'<kind text="{escape(text)}">{kind}</kind>'
    if bass:
        b_alt = (1 if '#' in bass else -1 if 'b' in bass[1:] else 0)
        xml += f'<bass><bass-step>{bass[0]}</bass-step>{f"<bass-alter>{b_alt}</bass-alter>" if b_alt else ""}</bass>'
    return xml + '</harmony>'


BEAMED = {'eighth': 1, '16th': 2}


def beam_groups(items, beats):
    """Indices of notes to beam together: by beat, or by half-bar in 4/4 and whole bar in 3/4 when all eighths."""
    def chunk(span):
        groups, cur, key = [], [], None
        for i, it in enumerate(items):
            g = int(it['pos'] // span + 1e-9)
            ok = (not it['rest'] and it['name'] in BEAMED and it['pos'] + it['v'] / 4 <= (g + 1) * span + 1e-9)
            if not ok or g != key:
                if len(cur) > 1:
                    groups.append(cur)
                cur = []
            key = g
            if ok:
                cur.append(i)
        if len(cur) > 1:
            groups.append(cur)
        return groups

    wide = {3: 3, 4: 2}.get(beats)
    if not wide:
        return chunk(1)
    out = []
    for grp in chunk(wide):
        if all(items[i]['name'] == 'eighth' for i in grp):
            out.append(grp)
        else:
            out += [g for g in chunk(1) if g[0] in grp]
    return out


def add_beams(items, beats):
    for grp in beam_groups(items, beats):
        for j, i in enumerate(grp):
            it = items[i]
            b = ['begin' if j == 0 else 'end' if j == len(grp) - 1 else 'continue']
            if BEAMED[it['name']] == 2:
                prev = j > 0 and BEAMED[items[grp[j - 1]]['name']] == 2
                nxt = j < len(grp) - 1 and BEAMED[items[grp[j + 1]]['name']] == 2
                b.append('continue' if prev and nxt else 'end' if prev else 'begin' if nxt
                         else 'backward hook' if j == len(grp) - 1 else 'forward hook')
            it['beam'] = ''.join(f'<beam number="{n + 1}">{x}</beam>' for n, x in enumerate(b))


def staff_xml(events, bar, beats, fifths, staff, voice, acc):
    """One staff's notes for one bar: events are (start, dur, keys) in beats; returns XML."""
    D = 4  # divisions per quarter
    t0, t1 = bar * beats, (bar + 1) * beats
    items = []

    def rests(a, b):
        pos = a
        for v, name, dots in pieces_of(int(round((b - a) * D))):
            items.append({'pos': pos - t0, 'v': v, 'name': name, 'rest': True,
                          'xml': f'<note><rest/><duration>{v}</duration><voice>{voice}</voice><type>{name}</type>{"<dot/>" * dots}<staff>{staff}</staff></note>'})
            pos += v / D

    t = t0
    for s, d, keys in events:
        e = s + d
        if e <= t0 or s >= t1:
            continue
        a, b = max(s, t0), min(e, t1)
        if a > t:
            rests(t, a)
        pos = a
        segs = pieces_of(int(round((b - a) * D)))
        for si, (v, name, dots) in enumerate(segs):
            tie_start = si < len(segs) - 1 or e > t1
            tie_stop = si > 0 or s < t0
            notes = []
            for ki, k in enumerate(keys):
                step, alt, octv = spell(k, fifths)
                acc_xml = ''
                if not tie_stop:
                    want = acc.get((step, octv), key_alter(step, fifths))
                    if want != alt:
                        acc_xml = '<accidental>' + {1: 'sharp', -1: 'flat', 0: 'natural'}[alt] + '</accidental>'
                        acc[(step, octv)] = alt
                ties = (('<tie type="stop"/>' if tie_stop else '') + ('<tie type="start"/>' if tie_start else ''))
                tied = (('<tied type="stop"/>' if tie_stop else '') + ('<tied type="start"/>' if tie_start else ''))
                notes.append(
                    f'<note>{"<chord/>" if ki else ""}<pitch><step>{step}</step>{f"<alter>{alt}</alter>" if alt else ""}<octave>{octv}</octave></pitch>'
                    f'<duration>{v}</duration>{ties}<voice>{voice}</voice><type>{name}</type>{"<dot/>" * dots}{acc_xml}'
                    f'<staff>{staff}</staff>{"{BEAM}" if ki == 0 else ""}{f"<notations>{tied}</notations>" if tied else ""}</note>')
            items.append({'pos': pos - t0, 'v': v, 'name': name, 'rest': False, 'xml': ''.join(notes)})
            pos += v / D
        t = b
    if t < t1:
        rests(t, t1)
    add_beams(items, beats)
    return ''.join(it['xml'].replace('{BEAM}', it.get('beam', '')) for it in items)


def musicxml(title, rh, lh, chords, fifths, mode, beats, bpm, words, total_beats):
    bars = int(round(total_beats / beats))
    end = bars * beats
    rh = [(s, min(d, end - s), k) for s, d, k in rh if s < end]
    lh = [(s, min(d, end - s), k) for s, d, k in lh if s < end]
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
           '<score-partwise version="4.0">',
           f'<work><work-title>{escape(title)}</work-title></work>',
           '<identification><creator type="composer">Ahrens Labs</creator><creator type="arranger">Piano arrangement</creator></identification>',
           '<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">']
    for bar in range(bars):
        out.append(f'<measure number="{bar + 1}">')
        if bar == 0:
            out.append(f'<attributes><divisions>4</divisions><key><fifths>{fifths}</fifths><mode>{mode}</mode></key>'
                       f'<time><beats>{beats}</beats><beat-type>4</beat-type></time><staves>2</staves>'
                       '<clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>')
            out.append(f'<direction placement="above"><direction-type><words font-weight="bold">{escape(words)} </words></direction-type>'
                       f'<direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>{bpm}</per-minute></metronome></direction-type>'
                       f'<staff>1</staff><sound tempo="{bpm}"/></direction>')
        if bar and bar % 4 == 0:
            out.append('<print new-system="no"/>')
        last = None
        t0 = bar * beats
        here = sorted((t, c) for t, c in chords.items() if t0 <= t < t0 + beats)
        acc = {}
        # Chord symbols sit before the notes at their beat: interleave with forward/backup.
        pos = t0
        for t, c in here:
            if c == last:
                continue
            if t > pos:
                out.append(f'<forward><duration>{int(round((t - pos) * 4))}</duration><voice>1</voice><staff>1</staff></forward>')
            out.append(parse_chord(c))
            pos = t
            last = c
        if pos > t0:
            out.append(f'<backup><duration>{int(round((pos - t0) * 4))}</duration></backup>')
        out.append(staff_xml(rh, bar, beats, fifths, 1, 1, acc))
        out.append(f'<backup><duration>{beats * 4}</duration></backup>')
        out.append(staff_xml(lh, bar, beats, fifths, 2, 5, {}))
        if bar == bars - 1:
            out.append('<barline location="right"><bar-style>light-heavy</bar-style></barline>')
        out.append('</measure>')
    out.append('</part></score-partwise>')
    return '\n'.join(out)


def midi(rh, lh, bpm, path):
    mf = mido.MidiFile(ticks_per_beat=480)
    tr = mido.MidiTrack()
    mf.tracks.append(tr)
    tr.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(bpm)))
    ev = []
    for evs, vel in ((rh, 72), (lh, 56)):
        for s, d, keys in evs:
            for k in keys:
                ev.append((int(s * 480), 1, k, vel))
                ev.append((int((s + d) * 480) - 10, 0, k, 0))
    ev.sort()
    now = 0
    for t, on, k, v in ev:
        tr.append(mido.Message('note_on' if on else 'note_off', note=k, velocity=v, time=t - now))
        now = t
    mf.save(path)


SMUFL_TEXT = {'\uea64': '♭', '\uea65': '♮', '\uea66': '♯', '\ueca5': '♩'}


def plain_symbols(svg):
    """Chord-symbol accidentals and the tempo note use the Leipzig music font, which cairosvg can't load; swap
    them for ordinary Unicode symbols in Noto Music."""
    def fix(m):
        text = ''.join(SMUFL_TEXT.get(c, c) for c in m.group(2))
        return m.group(1).replace('font-family="Leipzig"', 'font-family="Noto Music"') + text + '</tspan>'
    return re.sub(r'(<tspan[^>]*font-family="Leipzig"[^>]*>)([^<]*)</tspan>', fix, svg)


def pdf(xml, path):
    tk = verovio.toolkit()
    tk.setOptions({'pageWidth': 2100, 'pageHeight': 2970, 'scale': 45, 'adjustPageHeight': False, 'footer': 'none',
                   'pageMarginTop': 80, 'pageMarginBottom': 80, 'pageMarginLeft': 90, 'pageMarginRight': 90,
                   'spacingSystem': 14, 'breaks': 'auto'})
    tk.loadData(xml)
    w = PdfWriter()
    for i in range(1, tk.getPageCount() + 1):
        w.append(PdfReader(io.BytesIO(cairosvg.svg2pdf(bytestring=plain_symbols(tk.renderToSVG(i)).encode()))))
    with open(path, 'wb') as f:
        w.write(f)
    return tk.getPageCount()


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/sheet-music'
    os.makedirs(out, exist_ok=True)
    for script, title, arrange, fifths, mode, beats, words, slug in PIECES:
        S, total, ns = capture(script)
        rh, lh = arrange(S, ns)
        chords = {}
        last = None
        for t in sorted(S.chords):
            if S.chords[t] != last:
                chords[t] = S.chords[t]
                last = S.chords[t]
        xml = musicxml(title, rh, lh, chords, fifths, mode, beats, S.bpm, words, total)
        with open(os.path.join(out, slug + '.musicxml'), 'w') as f:
            f.write(xml)
        midi(rh, lh, S.bpm, os.path.join(out, slug + '.mid'))
        pages = pdf(xml, os.path.join(out, slug + '.pdf'))
        print(f'{title}: {int(total // beats)} bars, {pages} page(s)')


if __name__ == '__main__':
    main()
