"""
Flattens the architect's DWG into the JSON the rest of the tooling reads.

    python3 tools/dwg-export.py "assets/30102026_FINAL DRAFT.dwg"

writes `assets/30102026_FINAL DRAFT.geometry.json` beside it. Run it once per
revision; nothing at runtime needs it, and nothing else here needs Python.

Needs LibreDWG's `dwg2dxf` (macOS: `brew install libredwg`) and `ezdxf`
(`pip install ezdxf`, a venv is fine). AutoCAD 2018 files (AC1032) convert
with warnings about DIMASSOC / MLEADERSTYLE objects; those are annotation
bookkeeping and nothing here reads them.

Output, all in DWG units (centimetres, +Y up — the drawing's own frame):

    segs     [x0, y0, x1, y1, layer]           lines and polyline pieces
    arcs     [cx, cy, r, startDeg, endDeg, layer]   counter-clockwise
    circles  [cx, cy, r, layer]
    texts    [x, y, height, rotationDeg, text, layer]
    hatches  [[[x, y], ...], layer]           boundary loops (columns)

INSERTs are exploded through their block transforms, so a wall or a door
drawn as a block lands where it is drawn, and its attributes (the room-name
tags) come out as text. Only the two plans are kept — everything west of
X 122500; the elevations and the section sit east of that.
"""
import json
import math
import os
import subprocess
import sys
import tempfile

import ezdxf

PLANS_MAX_X = 122500


def main(src):
    with tempfile.TemporaryDirectory() as tmp:
        dxf = os.path.join(tmp, 'sheet.dxf')
        subprocess.run(['dwg2dxf', '-y', '-o', dxf, src], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        doc = ezdxf.readfile(dxf)

    out = {'source': os.path.basename(src), 'units': 'cm',
           'segs': [], 'arcs': [], 'circles': [], 'texts': [], 'hatches': []}

    def keep(x):
        return x < PLANS_MAX_X

    def text(e, layer):
        t = e.dxftype()
        if t == 'MTEXT':
            p, h, s = e.dxf.insert, e.dxf.get('char_height', 10), e.plain_text()
        else:
            # TEXT / ATTRIB: aligned text is placed by its align point.
            aligned = e.dxf.get('halign', 0) or e.dxf.get('valign', 0)
            p = e.dxf.align_point if aligned and e.dxf.hasattr('align_point') else e.dxf.insert
            h, s = e.dxf.get('height', 10), e.dxf.text
        s = s.replace('%%P', '±').replace('%%p', '±').strip()
        if s and keep(p[0]):
            out['texts'].append([p[0], p[1], h, e.dxf.get('rotation', 0), s, layer])

    def walk(entities, inherit=None):
        for e in entities:
            t = e.dxftype()
            layer = e.dxf.get('layer', '0')
            if layer == '0' and inherit:
                layer = inherit                     # block contents take the INSERT's layer
            try:
                if t == 'INSERT':
                    for a in e.attribs:
                        text(a, a.dxf.get('layer', layer))
                    walk(e.virtual_entities(), layer if layer != '0' else inherit)
                elif t == 'LINE':
                    s, f = e.dxf.start, e.dxf.end
                    if keep(s.x):
                        out['segs'].append([s.x, s.y, f.x, f.y, layer])
                elif t in ('LWPOLYLINE', 'POLYLINE'):
                    walk(e.virtual_entities(), layer)
                elif t == 'ARC':
                    c = e.dxf.center
                    if keep(c.x):
                        out['arcs'].append([c.x, c.y, e.dxf.radius, e.dxf.start_angle, e.dxf.end_angle, layer])
                elif t == 'CIRCLE':
                    c = e.dxf.center
                    if keep(c.x):
                        out['circles'].append([c.x, c.y, e.dxf.radius, layer])
                elif t in ('TEXT', 'MTEXT', 'ATTRIB'):
                    text(e, layer)
                elif t == 'HATCH':
                    for p in e.paths:
                        pts = [[v[0], v[1]] for v in getattr(p, 'vertices', [])]
                        if not pts:
                            pts = [[edge.start[0], edge.start[1]] for edge in getattr(p, 'edges', []) if hasattr(edge, 'start')]
                        if pts and keep(pts[0][0]):
                            out['hatches'].append([pts, layer])
            except Exception as err:                # a malformed entity costs that entity only
                print(f'  skipped {t}: {err}', file=sys.stderr)

    walk(doc.modelspace())

    dst = os.path.splitext(src)[0] + '.geometry.json'
    with open(dst, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print(f'wrote {dst}: {len(out["segs"])} segments, {len(out["arcs"])} arcs, '
          f'{len(out["texts"])} texts, {len(out["hatches"])} hatches')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
