"""
Draws Villa Khan's electrical project over the architect's plan.

    python3 tools/electric-plan.py

Base: `assets/30102026_FINAL DRAFT.dwg` (P.18 re-issued 30/10, kitchen entrance moved) with the kesit marks (layer
`0000 3D ZEMIN`), the structural grid (`00_Axis`, `00 aks yazi`) and the
elevation / section sheet (east of X 122500) stripped, the architecture greyed so the electrics read on top.

Symbols: the KTEMO standard blocks, taken from the single-phase two-storey
house in `assets/Electric/ŞÖHRET KAPLAN ELEKTRİK.dwg` (2x80A main, ADT + TDT,
the layout `YÜKLEM CETVELİ.xlsx` tabulates). Each block is re-based on its own
centre as `VK_<name>`, because the source blocks carry their geometry far
from the base point.

Writes `electrical/VILLA KHAN ELEKTRIK.dxf` (open it in AutoCAD; everything
added is on `VK_*` layers) and `electrical/VILLA KHAN ELEKTRIK.pdf` (A0).

Needs `dwg2dxf` (brew install libredwg), ezdxf and matplotlib.
Coordinates are DWG centimetres, +Y up (the drawing's own frame); north on
the sheet is -Y in the 3D model.
"""
import json
import math
import os
import subprocess
import sys
import tempfile

import ezdxf
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from ezdxf import bbox, recover
from ezdxf.addons import Importer
from ezdxf.addons.drawing import Frontend, RenderContext
from ezdxf.addons.drawing.config import BackgroundPolicy, ColorPolicy, Configuration
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
from ezdxf.enums import TextEntityAlignment

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAN_DWG = os.path.join(ROOT, 'assets', '30102026_FINAL DRAFT.dwg')
SYMBOL_DWG = os.path.join(ROOT, 'assets', 'Electric', 'ŞÖHRET KAPLAN ELEKTRİK.dwg')
OUT = os.path.join(ROOT, 'electrical')

PLANS_MAX_X = 122500            # elevations + section A-A sit east of this
KESIT_LAYERS = {'0000 3D ZEMIN'}  # the A-A cut line and its arrows
AXIS_LAYERS = {'00_Axis', '00 aks yazi'}   # grid lines, bubbles and their 1-7 / A-D
HOUSE = (117580, -79318, 119236, -77973)    # ground-floor outer faces, DWG cm

SYMBOLS = {                     # VK name: KTEMO block in the symbol drawing
    'spot': 'gömme tip spot',
    'switch': 'tekli anahtar',
    'dimmer': 'dimmer switch',
    'data': 'data',
    'socket': 'anahtarsız priz',
    'tv': 'tv',
    'device': 'sabit cihaz bağlantı noktası',
    'chandelier': 'avize',
}

# Rooms with a havuz (pool) ceiling: a dropped band round the walls with
# recessed spots on its centreline, and a cove of hidden LED at the edge of
# the raised middle. `rect` is the room's inner wall faces from the DWG.
ROOMS = [{
    'name': 'OTURMA ODASI',
    'rect': (118741, -79290, 119211, -78680),
    'band': 60,                 # band width from the wall face
    'spot_pitch': 110,          # target spacing on the band centreline
    'band_level': 2.45,         # band underside above finished floor, m
    'pool_level': 2.72,         # middle: the slab soffit (P.18 section A-A)
    # The hanging fireplace's flue rises through the NE corner of the band.
    'skip': [((119181, -78710), 'ŞÖMİNE BACASI')],
    # Curtain cornice pockets in the band over the glazing: the north
    # 300/230 window and the south 250/230 slider, as drawn (x from..to).
    'curtains': [('N', 118831, 119131), ('S', 118836, 119086)],
    'curtain_depth': 15,        # pocket width off the wall face, runs to the slab
    'curtain_over': 30,         # past each side of the opening, for stacking
    'switch': (118753, -78800), # west wall, latch side of the K1:90/230
    'feed': (118690, -78800),   # out through the wall into GIRIS HOLU
    'circuit': 'L1', 'cove_circuit': 'L2',
    # One double switch by the door: spots and hidden LED (owner's request).
    'switches': [((118753, -78800), ['L1', 'L2'])],
    # Two-way (vaviyen, owner's request): again by the north 300/230 onto
    # the back garden, EAST of its curtain pocket — west of it the hall door
    # opens flat against the wall, and no switch goes behind a door.
    # (position, gangs, rotation, label) — stems south, into the room.
    'two_way': [((119175, -78690), ['L1', 'L2'], 180, (119190, -78726))],
    'feed_to': ((118690, -78800), '2x1,5+1,5mm²'),
    'ap': True,                 # Cisco access point in the middle, with its own power
    # Owner's instruction: the TV stays, and a motorised 120" screen drops in
    # front of it from a cassette pocket in the east band, for a ceiling-hung
    # projector running Android TV. The projector hangs from the west band so
    # its cables run in the band void rather than in the slab.
    'cinema': {
        'screen_x': 119161,             # 50 cm off the east face, clear of the media wall
        'span': (-79190, -78899),       # cassette pocket along the wall (290 cm)
        'pocket': (42, 58),             # off the wall face, cm
        'inches': 120,
        'throw': 345,                   # lens to screen: 1.3 throw ratio
        'media': (119196, -79045),      # behind the media wall's floating unit
    },
}, {
    # MUTFAK: three ways to light it, on the owner's instruction — a band of
    # spots like OTURMA ODASI's (no cove), the chandelier over the dining
    # table and LED under the wall cabinets. The band is 80 cm so the spots
    # land just in front of the 35 cm wall cabinets, over the worktop. Spots
    # west of x 118152 are L5 (kitchen), east of it L6 (dining). Two double
    # switches in the kitchen by the diagonal KILER door, on the kitchen face
    # of the stub left of it (owner: to hand passing between the two), facing
    # north-east: L3+L4, L5+L6. Every kitchen
    # light is two-way (vaviyen, owner's request): the same pair again by the
    # dining slider, so leaving for the back garden puts them all out.
    'name': 'MUTFAK',
    'rect': (117703, -78402, 118428, -77997),
    'band': 80,
    'spot_pitch': 120,
    'band_level': 2.45,
    'pool_level': 2.72,
    'cove': False,
    'fill': [(118231, -78594, 118431, -78402)],   # the dining end to the double door, dropped flat
    # Curtain pockets over the tall glazing: the north 180/230 and the dining
    # slider (250/230), and the east 300/230 onto İÇBAHÇE TERASI.
    'curtains': [('N', 117777, 117958), ('N', 118142, 118392), ('E', -78092, -78392)],
    'circuit': 'L5', 'split': (118152, 'L6'),
    'kitchen': {
        'chandelier': (118292, -78163), 'chandelier_circuit': 'L3',
        'cabinet_leds': [                         # under the front edge of each run
            ((117732, -77997), (117732, -78099)),
            ((117732, -78286), (117732, -78402)),
            ((117915, -78373), (117987, -78373)),
            ((118047, -78373), (118103, -78373)),
        ],
        'led_driver': (117930, -78335), 'led_circuit': 'L4',
    },
    # (position, gangs, label position, rotation): the two sit 10 cm apart on
    # a 45° face, so their labels are stacked clear of them.
    'switches': [((118221, -78502), ['L3', 'L4'], (118262, -78468), -45),
                 ((118227, -78509), ['L5', 'L6'], (118262, -78482), -45)],
    'feed_to': ((118173, -78605), '2x1,5+1,5mm²'),      # to the ADT
    # On the north wall between the 180/230 and the dining slider,
    # h:120 over the island's end; paired with 'switches' in order, as
    # (position, gangs, rotation, label).
    # The wall's middle is a concrete column (x 118035..118085), no box in
    # it (owner): one double either side, against it.
    'two_way': [((118018, -78010), ['L3', 'L4'], 180, (118018, -78046)),
                ((118095, -78010), ['L5', 'L6'], 180, (118095, -78046))],
}]

# The Cisco router in ANA KORIDOR, on the ceiling (owner: every router is):
# the data point every CAT6 run ends at, with its own ceiling socket on P2
# (owner: network gear needs mains as well), fed from the ADT.
NETWORK = {
    'router': (118297, -78638), 'socket': (118346, -78628), 'data': (118346, -78648),
    'feed': (118181, -78618), 'circuit': 'P2', 'label_x': 118274,
}

# The appliance wardrobe at the west end of MUTFAK's south run (1,50 m): a
# full-automatic coffee machine, a Turkish coffee machine and a toaster, on two
# twin UK sockets (BS 1363) on its back panel, h:136 (42 cm over the worktop),
# on their own 20 A radial, P4.
APPLIANCES = {
    'sockets': [(117842, -78400), (117884, -78400)],
    'feed': (118166, -78612), 'circuit': 'P4',
}
COFFEE_W, TURKISH_W, TOASTER_W = 1450, 735, 900

# Y.MUTFAK KILER: one ceiling lamp in the middle (owner), circuit L7, its
# single switch inside by the diagonal door on the latch side, h:110.
KILER_LIGHT = {'lamp': (117931, -78533), 'switch': (118127, -78427), 'rot': 135,
               'circuit': 'L7', 'feed': (118173, -78605)}

# The ADT (ana dağıtım tablosu) where the owner marked it, on ANA KORIDOR's
# west side: since 30/10 the cupboard niche there, on its back wall. Single
# phase, in a two-row board (Hager Gamma type, ~40 x 50 x 12 cm), bottom edge
# at 120 cm (owner: at least 120). Every circuit is drawn back to it.
ADT = {'rect': (118166, -78610, 118181, -78651)}

# The riser shaft (tesisat şaftı) straight above the ADT niche, owner's
# instruction: mains (KA, kuvvetli akım) and low-voltage (ZA, zayıf akım:
# CAT6, TV, alarm) rise through it to the first floor, where it stands in
# Y.ODASI 2 D.ODASI's south-west corner, 40 x 50 cm inside. Ground-floor
# coordinates; the first floor's are FIRST_DX further east on the same grid.
FIRST_DX = 2845
SHAFT = {'rect': (118192, -78606, 118232, -78656)}
# The first floor's Cisco router, on the ceiling in the middle of ANA
# KORIDOR (first-floor DWG cm), fed up the shaft.
FIRST_NET = {'router': (121164, -78754), 'socket': (121212, -78746), 'data': (121212, -78764)}
FIRST_HOUSE = (120420, -79330, 122100, -77820)   # first-floor plan incl. balconies, DWG cm

CHANDELIER_W, ROUTER_W, SHUTTER_W = 65, 60, 120

PROJECTOR_W, SCREEN_W, MEDIA_W = 350, 150, 400

SPOT_W, LED_W_PER_M, AP_W = 7, 10, 25

LAYERS = {                      # name: (ACI colour, lineweight 1/100 mm)
    'VK_ASMA_TAVAN': (6, 35),
    'VK_ASMA_TAVAN_TARAMA': (8, 13),
    'VK_SPOT': (1, 35),
    'VK_KORNIS': (30, 35),
    'VK_LED': (5, 50),
    'VK_ANAHTAR': (1, 35),
    'VK_AYDINLATMA_HATTI': (1, 25),
    'VK_DATA': (140, 35),
    'VK_PRIZ': (3, 35),
    'VK_PRIZ_HATTI': (3, 25),
    'VK_PROJEKSIYON': (4, 35),
    'VK_PANO': (1, 50),
    'VK_SAFT': (6, 35),
    'VK_PANJUR': (40, 35),
    'VK_PANJUR_HATTI': (40, 18),
    'VK_YAZI': (7, 18),
    'VK_DETAY': (7, 25),
}


def dwg_to_dxf(src, tmp, name):
    dxf = os.path.join(tmp, name)
    subprocess.run(['dwg2dxf', '-y', '-o', dxf, src], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return dxf


def strip_base(doc):
    """Drop the kesit marks, the structural grid and everything not a plan."""
    msp = doc.modelspace()
    for e in list(msp):
        b = bbox.extents([e], fast=True)
        if e.dxf.layer in KESIT_LAYERS | AXIS_LAYERS or (b.has_data and b.center.x >= PLANS_MAX_X):
            msp.delete_entity(e)


def area_fixes():
    """AREA_FIXES from floorplan.js: room areas the drawing prints wrong."""
    js = "import { AREA_FIXES } from './src/floorplan.js'; console.log(JSON.stringify(AREA_FIXES));"
    out = subprocess.run(['node', '--input-type=module', '-e', js], cwd=ROOT,
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def fix_areas(doc):
    """Overwrite those labels with the areas measured to the wall faces."""
    fixes = area_fixes()
    # The room labels are ATTRIBs on the architect's 'oda ismi' blocks.
    texts = [a for ins in doc.modelspace().query('INSERT') for a in ins.attribs]
    texts += list(doc.modelspace().query('TEXT'))
    for e in texts:
        p = e.dxf.insert
        for f in fixes:
            if e.dxf.text.strip() == f['was'] and math.hypot(p.x - f['at'][0], p.y - f['at'][1]) < 30:
                e.dxf.text = f['now']
                f['done'] = True
    for f in fixes:
        if not f.get('done'):
            print(f"area label not found: {f['room']} {f['was']}", file=sys.stderr)


def import_symbols(doc, src):
    """Copy each KTEMO block in as VK_<key>, re-based on its symbol's centre."""
    imp = Importer(src, doc)
    imp.import_blocks(list(SYMBOLS.values()))
    imp.finalize()
    for key, name in SYMBOLS.items():
        blk = doc.blocks.get(name)
        circles = [e for e in blk if e.dxftype() == 'CIRCLE']
        if circles:
            c = circles[0].dxf.center
            parts = [e for e in blk
                     if (bb := bbox.extents([e], fast=True)).has_data
                     and (bb.center - c).magnitude < 30]    # drops stray bits
        else:
            parts = list(blk)
            c = bbox.extents(parts).center
        new = doc.blocks.new('VK_' + key)
        for e in parts:
            copy = e.copy()
            copy.translate(-c.x, -c.y, 0)
            copy.dxf.layer = '0'
            new.add_entity(copy)

    ap = doc.blocks.new('VK_ap')        # not in the KTEMO legend
    ap.add_lwpolyline([(-16, -16), (16, -16), (16, 16), (-16, 16)], close=True)
    ap.add_circle((0, 0), 11)
    for r in (4, 7):
        ap.add_arc((0, -3), r, 45, 135)
    ap.add_circle((0, -3), 1.2)

    dbl = doc.blocks.new('VK_double')      # komütatör: two stems on one point
    dbl.add_circle((0, 0), 4, dxfattribs={'color': 256})
    h = dbl.add_hatch()
    h.paths.add_edge_path().add_arc((0, 0), 4, 0, 360)
    for a, b in (((0, 0), (-9, 20)), ((0, 0), (9, 20))):
        dbl.add_line(a, b)
    dbl.add_line((-9, 20), (-15, 17))
    dbl.add_line((9, 20), (15, 17))

    # Komütatör vaviyen: the double switch with the two-way hook — each stem
    # is also bent back the other way, as the KTEMO 'tekli vaviyen' is.
    dv = doc.blocks.new('VK_dvav')
    dv.add_circle((0, 0), 4, dxfattribs={'color': 256})
    h = dv.add_hatch()
    h.paths.add_edge_path().add_arc((0, 0), 4, 0, 360)
    for sx in (-1, 1):
        dv.add_line((0, 0), (sx * 9, 20))
        dv.add_line((sx * 9, 20), (sx * 15, 17))
        dv.add_line((sx * 9, 20), (sx * 3, 23))

    mo = doc.blocks.new('VK_motor')        # shutter motor, in its box
    mo.add_circle((0, 0), 9)
    mo.add_lwpolyline([(-5, -5), (-5, 5), (0, 0), (5, 5), (5, -5)])

    ud = doc.blocks.new('VK_updown')       # shutter up/down switch
    ud.add_circle((0, 0), 6)
    ud.add_lwpolyline([(-3, 2), (0, 5), (3, 2)])
    ud.add_lwpolyline([(-3, -2), (0, -5), (3, -2)])

    cl = doc.blocks.new('VK_ceiling')      # ceiling lamp: the usual circle and cross
    cl.add_circle((0, 0), 12)
    cl.add_line((-8.5, -8.5), (8.5, 8.5))
    cl.add_line((-8.5, 8.5), (8.5, -8.5))

    rt = doc.blocks.new('VK_router')       # not in the KTEMO legend
    rt.add_lwpolyline([(-20, -10), (20, -10), (20, 10), (-20, 10)], close=True)
    for x in (-12, -6, 0, 6, 12):
        rt.add_circle((x, -4), 1.5)
    rt.add_line((-20, 3), (20, 3))

    pj = doc.blocks.new('VK_projector')    # not in the KTEMO legend either
    pj.add_lwpolyline([(-18, -21), (18, -21), (18, 21), (-18, 21)], close=True)
    pj.add_circle((-24, 8), 6)             # lens, on the -X (throw) side
    pj.add_lwpolyline([(-8, -12), (8, -12), (8, -4), (-8, -4)], close=True)


def text(msp, s, p, h=10, layer='VK_YAZI', align='MIDDLE_LEFT', rot=0, color=None):
    t = msp.add_text(s, height=h, rotation=rot, dxfattribs={'layer': layer, 'style': 'VK'})
    if color is not None:
        t.dxf.color = color
    t.set_placement(p, align=TextEntityAlignment[align])
    return t


def side_points(a, b, pitch):
    n = max(1, round(((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** .5 / pitch))
    return [(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n) for i in range(n)]


def ring_spots(room):
    """Spots on the band centreline, clockwise from the NW corner, by circuit.

    With a `split`, spots at or east of its x go on its circuit. The ring is
    turned to start on a west-group spot so each group is one unbroken run
    and its wiring does not jump across the room.
    """
    x0, y0, x1, y1 = room['rect']
    s = room['band'] / 2
    sx0, sy0, sx1, sy1 = x0 + s, y0 + s, x1 - s, y1 - s
    nw, ne, se, sw = (sx0, sy1), (sx1, sy1), (sx1, sy0), (sx0, sy0)
    ring = []
    for a, b in ((nw, ne), (ne, se), (se, sw), (sw, nw)):
        ring += side_points(a, b, room['spot_pitch'])
    skipped = [p for p, _ in room.get('skip', [])]
    ring = [p for p in ring if all(abs(p[0] - q[0]) + abs(p[1] - q[1]) > 5 for q in skipped)]
    split = room.get('split')
    if not split:
        return {room['circuit']: ring}
    east = [p[0] >= split[0] for p in ring]
    k = next(i for i in range(len(ring)) if east[i - 1] and not east[i])
    ring = ring[k:] + ring[:k]
    return {room['circuit']: [p for p in ring if p[0] < split[0]],
            split[1]: [p for p in ring if p[0] >= split[0]]}


def havuz_tavan(msp, room):
    """Band, cove LED, spots and labels for one room. Returns what it placed."""
    x0, y0, x1, y1 = room['rect']
    w = room['band']
    # Band hatch (plus any flat-dropped `fill`) and the edge of the raised middle.
    hx0, hy0, hx1, hy1 = x0 + w, y0 + w, x1 - w, y1 - w
    hatch = msp.add_hatch(dxfattribs={'layer': 'VK_ASMA_TAVAN_TARAMA'})
    hatch.set_pattern_fill('ANSI31', scale=6)
    hatch.paths.add_polyline_path([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], is_closed=True)
    hatch.paths.add_polyline_path([(hx0, hy0), (hx1, hy0), (hx1, hy1), (hx0, hy1)], is_closed=True)
    for fx0, fy0, fx1, fy1 in room.get('fill', []):
        fh = msp.add_hatch(dxfattribs={'layer': 'VK_ASMA_TAVAN_TARAMA'})
        fh.set_pattern_fill('ANSI31', scale=6)
        fh.paths.add_polyline_path([(fx0, fy0), (fx1, fy0), (fx1, fy1), (fx0, fy1)], is_closed=True)
    msp.add_lwpolyline([(hx0, hy0), (hx1, hy0), (hx1, hy1), (hx0, hy1)], close=True,
                       dxfattribs={'layer': 'VK_ASMA_TAVAN'})

    # Curtain cornice pockets against the glazed walls.
    # On N/S walls a..b is x, on E/W it is y; each runs `over` past the
    # opening for the curtains to stack, held inside the room.
    d, over = room.get('curtain_depth', 15), room.get('curtain_over', 30)
    for side, a, b in room.get('curtains', []):
        if side in 'NS':
            a, b = max(x0, a - over), min(x1, b + over)
            y = y1 if side == 'N' else y0
            yi = y - d if side == 'N' else y + d
            pocket = [(a, y), (b, y), (b, yi), (a, yi)]
            mid, rot = ((a + b) / 2, (y + yi) / 2), 0
        else:
            a, b = max(y0, min(a, b) - over), min(y1, max(a, b) + over)
            x = x1 if side == 'E' else x0
            xi = x - d if side == 'E' else x + d
            pocket = [(x, a), (x, b), (xi, b), (xi, a)]
            mid, rot = ((x + xi) / 2, (a + b) / 2), 90
        msp.add_lwpolyline(pocket, close=True, dxfattribs={'layer': 'VK_KORNIS'})
        text(msp, f'PERDE KORNİŞ BOŞLUĞU {d} cm', mid, h=6, align='MIDDLE_CENTER', rot=rot, color=30)

    out = {'targets': {}, 'led_m': 0}
    # Hidden LED in the cove, just inside the band edge, and its driver.
    if room.get('cove', True):
        c = 10
        led = [(hx0 - c, hy0 - c), (hx1 + c, hy0 - c), (hx1 + c, hy1 + c), (hx0 - c, hy1 + c)]
        msp.add_lwpolyline(led, close=True, dxfattribs={'layer': 'VK_LED', 'linetype': 'VK_LED'})
        out['led_m'] = 2 * ((hx1 - hx0 + 2 * c) + (hy1 - hy0 + 2 * c)) / 100
        drv = (x0 + w / 2, (y0 + y1) / 2 + 120)          # in the west band
        led_driver(msp, drv)
        msp.add_line((drv[0] + 9, drv[1]), (hx0 - c, drv[1]), dxfattribs={'layer': 'VK_LED'})
        out['targets'][room['cove_circuit']] = (drv[0], drv[1] + 18)

    # Spots, one wired run per circuit.
    groups = ring_spots(room)
    hat = {'layer': 'VK_AYDINLATMA_HATTI'}
    for circuit, spots in groups.items():
        for p in spots:
            msp.add_blockref('VK_spot', p, dxfattribs={'layer': 'VK_SPOT'})
        msp.add_lwpolyline(spots, dxfattribs=hat)
        out['targets'][circuit] = spots
    for p, why in room.get('skip', []):
        r = 14
        msp.add_line((p[0] - r, p[1] - r), (p[0] + r, p[1] + r), dxfattribs={'layer': 'VK_SPOT'})
        msp.add_line((p[0] - r, p[1] + r), (p[0] + r, p[1] - r), dxfattribs={'layer': 'VK_SPOT'})
        text(msp, why, (p[0] - 20, p[1] - 30), h=7, align='MIDDLE_RIGHT')

    # Labels in the middle of the room.
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    title = 'HAVUZ ASMA TAVAN' if room.get('cove', True) else 'SPOT BANTLI ASMA TAVAN'
    text(msp, title, (cx, hy1 - 28), h=9, align='MIDDLE_CENTER', color=6)
    text(msp, f"bant {w} cm, h:+{room['band_level']:.2f}   havuz h:+{room['pool_level']:.2f}".replace('.', ','),
         (cx, hy1 - 44), h=7, align='MIDDLE_CENTER', color=6)
    lines = [f'{c}: {len(s)} x {SPOT_W}W LED SPOT' for c, s in groups.items()]
    if out['led_m']:
        lines.append(f"{room['cove_circuit']}: GİZLİ LED ŞERİT ~{out['led_m']:.0f} m")
    for i, s in enumerate(lines):
        text(msp, s, (cx, hy0 + 30 + 14 * (len(lines) - 1 - i)), h=7, align='MIDDLE_CENTER',
             color=5 if 'LED Ş' in s else 1)
    out['spots'] = {c: len(s) for c, s in groups.items()}

    if room.get('ap'):
        ap = (cx, cy)
        msp.add_blockref('VK_ap', ap, dxfattribs={'layer': 'VK_DATA'})
        text(msp, 'CISCO AP', (cx, cy - 26), h=7, align='MIDDLE_CENTER', color=140)
        sw_x, sw_y = room['switch']
        fx, _ = room['feed']
        run = [(cx - 16, cy), (sw_x + 22, cy), (sw_x + 22, sw_y - 60), (fx, sw_y - 60)]
        msp.add_lwpolyline(run, dxfattribs={'layer': 'VK_DATA', 'linetype': 'VK_DATA'})
        text(msp, 'CAT6 DATA', (fx - 6, sw_y - 60), h=7, align='MIDDLE_RIGHT', color=140)
        text(msp, "ANA KORİDOR ROUTER'A", (fx - 6, sw_y - 73), h=6, align='MIDDLE_RIGHT', color=140)
        # Its own power, as well as the network: a point beside it in the slab.
        pw = (cx + 34, cy)
        msp.add_blockref('VK_device', pw, dxfattribs={'layer': 'VK_PRIZ'})
        text(msp, 'AP enerji', (pw[0] + 10, pw[1] - 14), h=5, color=3)
        out['ap_power'] = pw
    if room.get('cinema'):
        out.update(cinema(msp, room, out))
    return out


def led_driver(msp, p):
    msp.add_lwpolyline([(p[0] - 9, p[1] - 18), (p[0] + 9, p[1] - 18),
                        (p[0] + 9, p[1] + 18), (p[0] - 9, p[1] + 18)],
                       close=True, dxfattribs={'layer': 'VK_LED'})
    text(msp, 'LS', p, h=7, align='MIDDLE_CENTER')


def switches(msp, room, targets):
    """Each double switch, a line from each gang to its circuit, and the feed."""
    hat = {'layer': 'VK_AYDINLATMA_HATTI'}
    pair = room.get('two_way')
    block = 'VK_dvav' if pair else 'VK_double'
    for pos, gangs, *rest in room['switches']:
        rot = rest[1] if len(rest) > 1 else 0
        msp.add_blockref(block, pos, dxfattribs={'layer': 'VK_ANAHTAR', 'rotation': rot})
        text(msp, '/'.join(gangs), rest[0] if rest else (pos[0] + 14, pos[1] + 10), h=8)
        for g in gangs:
            t = targets[g]
            if isinstance(t, list):                 # a run of spots: its nearest end
                t = min((t[0], t[-1]), key=lambda q: (q[0] - pos[0]) ** 2 + (q[1] - pos[1]) ** 2)
            msp.add_line(pos, t, dxfattribs=hat)
    (fx, fy), label = room['feed_to']
    for pos, *_ in room['switches']:
        msp.add_line(pos, (fx, fy), dxfattribs=hat)
    # The second station: the travellers (vaviyen) run switch to switch, so
    # only the corridor switches reach the lamps.
    for (pos, gangs, *_), (far, _, rot, lab) in zip(room['switches'], pair or []):
        msp.add_blockref(block, far, dxfattribs={'layer': 'VK_ANAHTAR', 'rotation': rot})
        text(msp, '/'.join(gangs), lab, h=8, align='MIDDLE_CENTER' if rot == 180 else 'MIDDLE_LEFT')
        msp.add_lwpolyline([pos, (far[0], pos[1]), far], dxfattribs=hat)
    if pair:
        x, y = pair[0][3]
        text(msp, 'VAVİYEN 3x1,5mm²', (x - 18 if pair[0][2] == 180 else x, y - 14), h=6)
    names = ', '.join(g for _, gangs, *_ in room['switches'] for g in gangs)
    text(msp, f"{names} ADT'ye", (fx - 6, fy + 8), h=8, align='MIDDLE_RIGHT')
    text(msp, label, (fx - 6, fy - 6), h=6, align='MIDDLE_RIGHT')


def shutter_openings(floor='ground'):
    """The model's rolling-shutter openings (`shutterOpenings` in floorplan.js).

    Read from the model rather than retyped, so the drawing cannot drift from
    the walkthrough: node prints them in sheet px and they are mapped back to
    DWG centimetres through `PLAN.dwgToSheet`.
    """
    js = ("import { FLOORS, PLAN, shutterOpenings } from './src/floorplan.js';"
          f"const f = FLOORS.find((f) => f.id === '{floor}');"
          "console.log(JSON.stringify({ map: PLAN.dwgToSheet, mpp: PLAN.metersPerPixel,"
          " list: shutterOpenings(f).map((s) => ({ name: s.wall.name, a: s.wall.a, u: s.along,"
          " from: s.opening.from, to: s.opening.to, side: s.side,"
          " at: s.opening.shutterSwitch ?? null, off: s.opening.shutterSwitchOff ?? 0.15,"
          " depth: s.wall.thickness ?? PLAN.thickness[s.wall.type] })) }));")
    data = json.loads(subprocess.run(['node', '--input-type=module', '-e', js], cwd=ROOT,
                                     capture_output=True, text=True, check=True).stdout)
    k, (tx, ty) = data['map']['scale'], data['map']['offset']
    mpp = data['mpp']
    dwg = lambda p: ((p[0] - tx) / k, -(p[1] - ty) / k)
    out = []
    for o in data['list']:
        (ax, ay), (ux, uy), side = o['a'], o['u'], o['side']
        nx, ny = -uy * side, ux * side                       # towards outside, px
        half = o['depth'] / 2 / mpp
        at = lambda t, off: dwg((ax + ux * t + nx * off, ay + uy * t + ny * off))
        cm = 0.01 / mpp
        # The switch 15 cm past the jamb (as the model has it); the tubular
        # motor sits in that end of the roller, so the link crosses the wall.
        # As buildWalls.js: 15 cm past the nearer jamb with wall beside it, or
        # past the jamb the opening names (kept out from behind a door).
        near_from = o['at'] == 'from' if o['at'] else o['from'] * mpp > 0.3
        off = o['off'] * 100 * cm
        sw = o['from'] - off if near_from else o['to'] + off
        end = o['from'] + 12 * cm if near_from else o['to'] - 12 * cm
        out.append({
            'name': o['name'],
            'line': (at(o['from'], half + 6 * cm), at(o['to'], half + 6 * cm)),
            'motor': at(end, half + 20 * cm),
            'switch': at(sw, -half - 12 * cm),
            'bend': at(sw, half + 20 * cm),
        })
    return out


def shutters(msp, items):
    """A motor and an up/down switch at each shutter, linked; P3 feeds them."""
    for it in items:
        msp.add_line(*it['line'], dxfattribs={'layer': 'VK_PANJUR', 'lineweight': 70})
        msp.add_blockref('VK_motor', it['motor'], dxfattribs={'layer': 'VK_PANJUR'})
        msp.add_blockref('VK_updown', it['switch'], dxfattribs={'layer': 'VK_PANJUR'})
        msp.add_lwpolyline([it['switch'], it['bend'], it['motor']], dxfattribs={'layer': 'VK_PANJUR_HATTI'})
    return len(items)


def kitchen_fittings(msp, room):
    """MUTFAK's chandelier and under-cabinet LED. Returns targets and metres."""
    k = room['kitchen']
    out = {}
    msp.add_blockref('VK_chandelier', k['chandelier'], dxfattribs={'layer': 'VK_SPOT'})
    text(msp, 'AVİZE', (k['chandelier'][0], k['chandelier'][1] - 34), h=7, align='MIDDLE_CENTER', color=1)
    out[k['chandelier_circuit']] = k['chandelier']
    led_m = 0
    for a, b in k['cabinet_leds']:
        msp.add_line(a, b, dxfattribs={'layer': 'VK_LED', 'linetype': 'VK_LED', 'lineweight': 50})
        led_m += ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** .5 / 100
    # The runs linked one to the next inside the cabinets, and the driver
    # (in a wall cabinet) onto the nearest of them.
    runs = k['cabinet_leds']
    for (_, b), (a, _) in zip(runs, runs[1:]):
        msp.add_lwpolyline([b, (b[0], a[1]), a], dxfattribs={'layer': 'VK_LED'})
    drv = k['led_driver']
    led_driver(msp, drv)
    near = min((p for run in runs for p in run), key=lambda q: abs(q[0] - drv[0]) + abs(q[1] - drv[1]))
    msp.add_lwpolyline([(drv[0], drv[1] - 18), (drv[0], near[1]), near], dxfattribs={'layer': 'VK_LED'})
    text(msp, f"{k['led_circuit']}: TEZGAH ALTI LED ~{led_m:.1f} m".replace('.', ','),
         (drv[0] + 14, drv[1]), h=7, color=5)
    out[k['led_circuit']] = (drv[0], drv[1] + 18)
    return out, led_m


def network(msp, net):
    """The Cisco router in ANA KORIDOR with its own socket and feed."""
    r = net['router']
    msp.add_blockref('VK_router', r, dxfattribs={'layer': 'VK_DATA'})
    lx = net['label_x']                      # right-aligned, clear of the room name
    text(msp, 'CISCO ROUTER', (r[0], r[1] - 20), h=7, align='MIDDLE_CENTER', color=140)
    text(msp, 'TAVANDA, tüm CAT6 hatları', (r[0], r[1] - 30), h=5, align='MIDDLE_CENTER', color=140)
    s, dp = net['socket'], net['data']
    msp.add_blockref('VK_socket', s, dxfattribs={'layer': 'VK_PRIZ'})
    msp.add_blockref('VK_data', dp, dxfattribs={'layer': 'VK_DATA'})
    fx, fy = net['feed']
    msp.add_lwpolyline([s, (s[0], fy), (fx, fy)], dxfattribs={'layer': 'VK_PRIZ_HATTI'})
    text(msp, f"{net['circuit']}  3x2,5mm²", (s[0] + 12, s[1] - 2), h=7, color=3)


def appliances(msp, a):
    """The appliance wardrobe's two twin sockets and their radial to the ADT."""
    pr = {'layer': 'VK_PRIZ'}
    for p in a['sockets']:
        msp.add_blockref('VK_socket', (p[0], p[1] + 14), dxfattribs=pr)
    (ax, ay), (bx, _) = a['sockets'][0], a['sockets'][-1]
    fx, fy = a['feed']
    msp.add_lwpolyline([(ax, ay + 28), (bx, ay + 28)], dxfattribs={'layer': 'VK_PRIZ_HATTI'})
    msp.add_lwpolyline([(bx, ay + 28), (bx, fy), (fx, fy)], dxfattribs={'layer': 'VK_PRIZ_HATTI'})
    # Notes inside the room, clear of the band's hatch; the circuit under the
    # ADT's own labels, clear of KILER's sink.
    text(msp, 'CİHAZ DOLABI: 2x İKİLİ PRİZ BS 1363, h:136', (ax - 60, ay + 96), h=6, color=3)
    text(msp, 'kahve mak., Türk kahvesi mak., tost mak.', (ax - 60, ay + 86), h=5, color=3)
    x0 = ADT['rect'][0]
    text(msp, f"{a['circuit']}  20A  3x2,5mm²", (x0 - 8, fy - 36), h=7, align='MIDDLE_RIGHT', color=3)


def kiler_light(msp, k):
    """KILER's ceiling lamp, its switch and the run back to the ADT."""
    hat = {'layer': 'VK_AYDINLATMA_HATTI'}
    msp.add_blockref('VK_ceiling', k['lamp'], dxfattribs={'layer': 'VK_SPOT', 'color': 1})
    text(msp, f"{k['circuit']}: TAVAN LAMBASI", (k['lamp'][0] + 75, k['lamp'][1] + 4), h=7, color=1)
    sw = k['switch']
    msp.add_blockref('VK_switch', sw, dxfattribs={'layer': 'VK_ANAHTAR', 'rotation': k['rot']})
    text(msp, k['circuit'], (sw[0] - 22, sw[1] - 10), h=8)
    msp.add_line(sw, k['lamp'], dxfattribs=hat)
    msp.add_lwpolyline([sw, (sw[0], k['feed'][1] + 30), (k['feed'][0], k['feed'][1] + 30), k['feed']],
                       dxfattribs=hat)


def adt(msp, a):
    """The main board: the usual pano symbol, a box half hatched."""
    x0, y0, x1, y1 = a['rect']
    msp.add_lwpolyline([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], close=True,
                       dxfattribs={'layer': 'VK_PANO'})
    h = msp.add_hatch(color=7, dxfattribs={'layer': 'VK_PANO'})
    h.paths.add_polyline_path([(x0, y0), (x1, y0), (x0, y1)], is_closed=True)
    text(msp, 'ADT', (x0 - 8, (y0 + y1) / 2 + 8), h=12, align='MIDDLE_RIGHT', color=1)
    text(msp, 'Ana Dağıtım Tablosu, monofaze, 2 sıra, h:120-170', (x0 - 8, (y0 + y1) / 2 - 8), h=5,
         align='MIDDLE_RIGHT', color=1)


def shaft(msp, sh):
    """The riser shaft: dashed over the ADT on the ground floor (it rises from
    the niche), drawn and crossed on the first floor with its two risers."""
    x0, y0, x1, y1 = sh['rect']
    box = lambda dx: [(x0 + dx, y0), (x1 + dx, y0), (x1 + dx, y1), (x0 + dx, y1)]
    msp.add_lwpolyline(box(0), close=True, dxfattribs={'layer': 'VK_SAFT', 'linetype': 'VK_DATA'})
    # Its label north of the double door's wall, in the dining end, on a leader.
    lx, ly = x1 + 10, y0 + 34
    msp.add_line(((x0 + x1) / 2, y0), (lx, ly - 6), dxfattribs={'layer': 'VK_SAFT'})
    text(msp, 'ŞAFT ↑ 1. KAT (ADT üstü)', (lx + 2, ly + 4), h=7, color=6)
    text(msp, 'KA + ZA, 40x50 iç', (lx + 2, ly - 6), h=5, color=6)
    up = box(FIRST_DX)
    msp.add_lwpolyline(up, close=True, dxfattribs={'layer': 'VK_SAFT', 'lineweight': 50})
    msp.add_line(up[0], up[2], dxfattribs={'layer': 'VK_SAFT'})
    msp.add_line(up[1], up[3], dxfattribs={'layer': 'VK_SAFT'})
    cx, cy = (x0 + x1) / 2 + FIRST_DX, (y0 + y1) / 2
    for dy, lab, col, lay in ((10, 'KA', 1, 'VK_PRIZ'), (-10, 'ZA', 140, 'VK_DATA')):
        msp.add_circle((cx, cy + dy), 5, dxfattribs={'layer': lay, 'color': col})
        text(msp, lab + ' ↑', (x0 + FIRST_DX - 8, cy + dy), h=6, align='MIDDLE_RIGHT', color=col)
    text(msp, 'TESİSAT ŞAFTI 40x50 (ADT üstü)', (x1 + FIRST_DX + 8, y0 + 8), h=7, color=6)
    text(msp, 'KA: kuvvetli akım, ADT\'den', (x1 + FIRST_DX + 8, y0 - 3), h=5, color=1)
    text(msp, 'ZA: zayıf akım (CAT6, TV, alarm)', (x1 + FIRST_DX + 8, y0 - 11), h=5, color=140)
    return (cx, cy + 10), (cx, cy - 10)


def first_network(msp, net, ka, za):
    """The first floor's ceiling router, fed up the shaft: CAT6 and its socket."""
    r, s, dp = net['router'], net['socket'], net['data']
    msp.add_blockref('VK_router', r, dxfattribs={'layer': 'VK_DATA'})
    msp.add_blockref('VK_socket', s, dxfattribs={'layer': 'VK_PRIZ'})
    msp.add_blockref('VK_data', dp, dxfattribs={'layer': 'VK_DATA'})
    text(msp, 'CISCO ROUTER', (r[0], r[1] + 26), h=7, align='MIDDLE_CENTER', color=140)
    text(msp, 'TAVANDA, 1. kat CAT6 hatları', (r[0], r[1] + 16), h=5, align='MIDDLE_CENTER', color=140)
    msp.add_lwpolyline([za, (za[0], dp[1]), dp], dxfattribs={'layer': 'VK_DATA', 'linetype': 'VK_DATA'})
    msp.add_lwpolyline([ka, (s[0], ka[1]), s], dxfattribs={'layer': 'VK_PRIZ_HATTI'})
    text(msp, "P2  3x2,5mm², ADT'den şafttan", (s[0] + 12, s[1] + 4), h=6, color=3)
    text(msp, "CAT6, ana router'dan şafttan", (dp[0] + 12, dp[1] - 6), h=6, color=140)


def cinema(msp, room, placed):
    """Projector, screen pocket, their sockets and the HDMI run."""
    c = room['cinema']
    x0, y0, x1, y1 = room['rect']
    w = room['band']
    sx = c['screen_x']
    ya, yb = c['span']
    ym = (ya + yb) / 2
    P = {'layer': 'VK_PROJEKSIYON'}
    # Cassette pocket in the east band, and the screen's line when down.
    pa, pb = x1 - c['pocket'][1], x1 - c['pocket'][0]
    msp.add_lwpolyline([(pa, ya), (pb, ya), (pb, yb), (pa, yb)], close=True, dxfattribs=P)
    iw = c['inches'] * 2.54 * 0.8716
    msp.add_line((sx, ym - iw / 2), (sx, ym + iw / 2), dxfattribs={**P, 'linetype': 'VK_DATA', 'lineweight': 50})
    text(msp, f'MOTORLU PROJEKSİYON PERDESİ {c["inches"]}"', (pa - 6, ym + 80), h=6,
         align='MIDDLE_CENTER', rot=90, color=4)
    text(msp, 'kaset asma tavan cebinde', (pa - 6, ym - 80), h=5, align='MIDDLE_CENTER', rot=90, color=4)

    # Projector, hung from the west band; the throw to the screen.
    lens = (sx - c['throw'], ym)
    body = (lens[0] - 18, ym)
    msp.add_blockref('VK_projector', body, dxfattribs=P)
    msp.add_line((lens[0] + 6, ym), (sx, ym), dxfattribs={**P, 'linetype': 'VK_LED', 'lineweight': 13})
    text(msp, f'atış mesafesi {c["throw"] / 100:.2f} m'.replace('.', ','), ((lens[0] + sx) / 2, ym + 8),
         h=6, align='MIDDLE_CENTER', color=4)
    text(msp, 'PROJEKTÖR (Android TV)', (body[0], ym + 34), h=6, align='MIDDLE_CENTER', color=4)
    text(msp, 'bant altına askılı', (body[0], ym + 26), h=5, align='MIDDLE_CENTER', color=4)

    # Sockets: one at the projector, the screen motor's point in the pocket,
    # and the media wall's behind the floating unit (TV, Android box, router).
    bx = x0 + w / 2 - 12                    # beside the spot ring, not on it
    pj_sock = (bx, ym - 40)
    motor = ((pa + pb) / 2, ya + 20)
    mx, my = c['media']
    media = [(mx, my - 40), (mx, my + 40)]
    pr = {'layer': 'VK_PRIZ'}
    msp.add_blockref('VK_socket', pj_sock, dxfattribs=pr)
    msp.add_blockref('VK_device', motor, dxfattribs=pr)
    for p in media:
        msp.add_blockref('VK_socket', p, dxfattribs=pr)
    msp.add_blockref('VK_tv', (mx, my), dxfattribs=pr)
    text(msp, 'perde motoru', (motor[0] - 16, motor[1]), h=5, align='MIDDLE_RIGHT', color=3)
    text(msp, 'TV ÜNİTESİ', (mx + 9, my - 70), h=6, align='MIDDLE_CENTER', rot=90, color=3)

    # P1 from the feed, round the band void.
    sw_x, sw_y = room['switch']
    fx, _ = room['feed']
    sy0 = y0 + w / 2 - 8
    run = [(fx, sw_y - 100), (bx, sw_y - 100), pj_sock, (bx, sy0), (motor[0], sy0), motor,
           (mx, motor[1]), media[0], media[1]]
    msp.add_lwpolyline(run, dxfattribs={'layer': 'VK_PRIZ_HATTI'})
    text(msp, "P1 ADT'ye", (fx - 6, sw_y - 94), h=8, align='MIDDLE_RIGHT', color=3)
    text(msp, '3x2,5mm²', (fx - 6, sw_y - 108), h=6, align='MIDDLE_RIGHT', color=3)
    if 'ap_power' in placed:                # the AP's own supply, in the slab
        ax, ay = placed['ap_power']
        msp.add_lwpolyline([(bx, ay + 12), (ax, ay + 12), (ax, ay)], dxfattribs={'layer': 'VK_PRIZ_HATTI'})

    # HDMI (fibre) + CAT6 from the TV unit to the projector, in the band.
    sy1 = y0 + w / 2 + 8
    hd = [(mx - 14, my), (mx - 14, sy1), (bx + 24, sy1), (bx + 24, ym - 21)]
    msp.add_lwpolyline(hd, dxfattribs={'layer': 'VK_DATA', 'linetype': 'VK_DATA'})
    text(msp, "HDMI 2.1 (fiber) + CAT6, 1'' boru, bant içinden", ((x0 + x1) / 2, sy1 + 9), h=6,
         align='MIDDLE_CENTER', color=140)
    return {'cinema_sockets': 1 + len(media) + ('ap_power' in placed), 'motor': 1}


def section_detail(msp, room, origin):
    """Half-section through the havuz ceiling, wall to room centre, 1/10."""
    ox, oy = origin
    half = (room['rect'][2] - room['rect'][0]) / 2
    w = room['band']
    band, pool = room['band_level'] * 100, room['pool_level'] * 100
    L = {'layer': 'VK_DETAY'}
    P = lambda x, y: (ox + x, oy + y)
    # Slab (0.34 m) and wall.
    slab = [P(-25, pool), P(half + 15, pool), P(half + 15, pool + 34), P(-25, pool + 34)]
    msp.add_lwpolyline(slab, close=True, dxfattribs=L)
    h = msp.add_hatch(dxfattribs=L)
    h.set_pattern_fill('ANSI31', scale=1.2)
    h.paths.add_polyline_path(slab, is_closed=True)
    msp.add_lwpolyline([P(-25, pool), P(-25, 205)], dxfattribs=L)
    msp.add_lwpolyline([P(0, pool), P(0, 205)], dxfattribs=L)
    # Band: board soffit, edge face, cove ledge and lip.
    lip = 12
    board = [P(0, band), P(w, band), P(w, band + 12), P(w + lip, band + 12), P(w + lip, band + 19)]
    msp.add_lwpolyline(board, dxfattribs={**L, 'lineweight': 50, 'color': 6})
    for x in (12, w - 8):                   # hangers
        msp.add_line(P(x, band), P(x, pool), dxfattribs={**L, 'linetype': 'VK_DATA', 'color': 8})
    # Recessed spot in the band and its beam.
    sx = w / 2
    msp.add_lwpolyline([P(sx - 6, band), P(sx - 5, band + 9), P(sx + 5, band + 9), P(sx + 6, band)],
                       dxfattribs={**L, 'color': 1, 'lineweight': 35})
    for d in (-1, 1):
        msp.add_line(P(sx, band), P(sx + d * 22, band - 40), dxfattribs={**L, 'color': 1, 'linetype': 'VK_DATA'})
    # LED strip on the ledge, washing the raised middle.
    msp.add_lwpolyline([P(w + 2, band + 12), P(w + 2, band + 15), P(w + 8, band + 15), P(w + 8, band + 12)],
                       dxfattribs={**L, 'color': 5, 'lineweight': 50})
    for x2 in (w + 45, w + 90):
        msp.add_line(P(w + 6, band + 15), P(x2, pool - 1), dxfattribs={**L, 'color': 5, 'linetype': 'VK_DATA'})
    # Access point under the slab at the centre.
    msp.add_lwpolyline([P(half - 14, pool - 5), P(half + 14, pool - 5), P(half + 14, pool), P(half - 14, pool)],
                       close=True, dxfattribs={**L, 'color': 140, 'lineweight': 35})
    msp.add_line(P(half, pool + 40), P(half, 205), dxfattribs={**L, 'linetype': 'VK_DATA', 'color': 8})
    # Annotation.
    lv = lambda v: f'+{v / 100:.2f}'.replace('.', ',')
    text(msp, lv(pool) + ' döşeme altı / havuz', P(w + 15, pool - 19), h=4)
    text(msp, lv(band) + ' bant altı', P(-22, band - 7), h=4)
    text(msp, 'kotlar bitmiş döşemeden', P(-22, band - 14), h=3)
    text(msp, f'{w} cm bant', P(w / 2, band - 52), h=4, align='MIDDLE_CENTER')
    msp.add_line(P(0, band - 45), P(w, band - 45), dxfattribs=L)
    text(msp, 'gömme spot', P(sx + 10, band - 22), h=3.5, color=1)
    text(msp, 'gizli LED ışık cebi', P(w + 15, band + 2), h=3.5, color=5)
    text(msp, 'CISCO AP (PoE)', P(half - 16, pool - 4), h=3.5, align='MIDDLE_RIGHT', color=140)
    text(msp, 'ODA EKSENİ', P(half - 3, 210), h=3.5, align='MIDDLE_RIGHT')
    text(msp, 'alçıpan asma tavan', P(4, band + 5), h=3, color=6)


def legend(msp, origin):
    ox, oy = origin
    rows = [
        ('spot', 'Gömme Tip Spot Lamba (İç) - LED 7W, dimlenebilir'),
        ('led', 'Gizli LED Şerit (havuz kenarı / tezgah altı) 24V, 10 W/m'),
        ('driver', 'LED Sürücü (asma tavan içinde, servis kapaklı)'),
        ('edge', 'Havuz Asma Tavan Kenarı'),
        ('kornis', 'Perde Korniş Boşluğu (asma tavanda, döşemeye kadar)'),
        ('band', 'Asma Tavan Bandı'),
        ('double', 'Komütatör (Çift) Anahtar'),
        ('dvav', 'Komütatör Vaviyen Anahtar (iki yerden kumanda)'),
        ('chandelier', 'Avize'),
        ('ceiling', 'Tavan Lambası'),
        ('switch', 'Tekli Anahtar'),
        ('ap', 'Tavan Tipi Kablosuz Erişim Noktası (Cisco) - data + enerji'),
        ('router', 'Cisco Router, tavanda (data noktası, ayrı prizli)'),
        ('motor', 'Motorlu Panjur (dış kutulu) - motor noktası'),
        ('updown', 'Panjur Aşağı / Yukarı Anahtarı'),
        ('dataout', 'Data Prizi (CAT6)'),
        ('projector', 'Video Projeksiyon Cihazı (tavana askılı, Android TV)'),
        ('screen', 'Motorlu Projeksiyon Perdesi ve Kaset Cebi'),
        ('socket', 'Priz, BS 1363 (UK, G tipi, 13A, anahtarlı)'),
        ('device', 'Sabit Cihaz Bağlantı Noktası (perde motoru)'),
        ('tv', 'TV Prizi'),
        ('priz', "Priz Hattı 3x2,5mm² Cu PVC, 5/8'' PVC boru"),
        ('hat', "Aydınlatma Hattı 2x1,5+1,5mm² Cu PVC, 5/8'' PVC boru"),
        ('data', "Data Hattı CAT6, 1*3/4'' PVC boru"),
        ('skip', 'Spot konmayan nokta'),
    ]
    text(msp, 'LEJANT', (ox, oy + 40), h=14)
    text(msp, 'KTEMO standart sembolleri', (ox + 120, oy + 40), h=8)
    for i, (key, label) in enumerate(rows):
        y = oy - i * 38
        p = (ox + 30, y)
        if key in ('spot', 'double', 'dvav', 'chandelier', 'ceiling', 'switch', 'ap', 'router', 'dataout',
                   'projector', 'socket',
                   'device', 'tv', 'motor', 'updown'):
            layer = {'ap': 'VK_DATA', 'router': 'VK_DATA', 'dataout': 'VK_DATA', 'spot': 'VK_SPOT',
                     'motor': 'VK_PANJUR', 'updown': 'VK_PANJUR',
                     'chandelier': 'VK_SPOT', 'ceiling': 'VK_SPOT', 'projector': 'VK_PROJEKSIYON',
                     'socket': 'VK_PRIZ',
                     'device': 'VK_PRIZ', 'tv': 'VK_PRIZ'}.get(key, 'VK_ANAHTAR')
            key = {'dataout': 'data'}.get(key, key)
            small = {'xscale': .7, 'yscale': .7} if key in ('projector', 'chandelier') else {}
            msp.add_blockref('VK_' + key, p, dxfattribs={'layer': layer, **small})
        elif key == 'led':
            msp.add_line((ox, y), (ox + 60, y), dxfattribs={'layer': 'VK_LED', 'linetype': 'VK_LED'})
        elif key == 'driver':
            msp.add_lwpolyline([(ox + 21, y - 9), (ox + 39, y - 9), (ox + 39, y + 9), (ox + 21, y + 9)],
                               close=True, dxfattribs={'layer': 'VK_LED'})
            text(msp, 'LS', p, h=7, align='MIDDLE_CENTER')
        elif key == 'edge':
            msp.add_line((ox, y), (ox + 60, y), dxfattribs={'layer': 'VK_ASMA_TAVAN'})
        elif key == 'band':
            sq = [(ox + 10, y - 12), (ox + 50, y - 12), (ox + 50, y + 12), (ox + 10, y + 12)]
            h = msp.add_hatch(dxfattribs={'layer': 'VK_ASMA_TAVAN_TARAMA'})
            h.set_pattern_fill('ANSI31', scale=6)
            h.paths.add_polyline_path(sq, is_closed=True)
            msp.add_lwpolyline(sq, close=True, dxfattribs={'layer': 'VK_ASMA_TAVAN_TARAMA'})
        elif key == 'kornis':
            msp.add_lwpolyline([(ox, y - 6), (ox + 60, y - 6), (ox + 60, y + 6), (ox, y + 6)],
                               close=True, dxfattribs={'layer': 'VK_KORNIS'})
        elif key == 'screen':
            msp.add_lwpolyline([(ox + 24, y - 12), (ox + 36, y - 12), (ox + 36, y + 12), (ox + 24, y + 12)],
                               close=True, dxfattribs={'layer': 'VK_PROJEKSIYON'})
            msp.add_line((ox + 18, y - 12), (ox + 18, y + 12),
                         dxfattribs={'layer': 'VK_PROJEKSIYON', 'linetype': 'VK_DATA', 'lineweight': 50})
        elif key == 'priz':
            msp.add_line((ox, y), (ox + 60, y), dxfattribs={'layer': 'VK_PRIZ_HATTI'})
        elif key == 'hat':
            msp.add_line((ox, y), (ox + 60, y), dxfattribs={'layer': 'VK_AYDINLATMA_HATTI'})
        elif key == 'data':
            msp.add_line((ox, y), (ox + 60, y), dxfattribs={'layer': 'VK_DATA', 'linetype': 'VK_DATA'})
        elif key == 'skip':
            msp.add_line((ox + 18, y - 12), (ox + 42, y + 12), dxfattribs={'layer': 'VK_SPOT'})
            msp.add_line((ox + 18, y + 12), (ox + 42, y - 12), dxfattribs={'layer': 'VK_SPOT'})
        text(msp, label, (ox + 80, y), h=9)


GREYS = [                       # architecture layer (substring): colour
    (('DUVAR', 'COLUMN'), '#3a3a3a'),
    (('tefri', 'TEFRI', 'D_DOL'), '#c4c4c4'),
    (('YAZI', 'TEXT', 'TAG', 'yazi', 'OLCU'), '#8a8a8a'),
]


def grey_architecture(entity, props):
    if props.layer.upper().startswith('VK_'):
        if props.color.lower().startswith('#ffffff'):   # ACI 7 on white paper
            props.color = '#000000'
        return
    for keys, colour in GREYS:
        if any(k in props.layer for k in keys):
            props.color = colour
            return
    props.color = '#9a9a9a'


def draw(doc, fig, rect_mm, region, sheet_mm):
    """Render model-space `region` (cm) into a figure rectangle (mm)."""
    W, H = sheet_mm
    x, y, w, h = rect_mm
    ax = fig.add_axes([x / W, y / H, w / W, h / H])
    ax.set_axis_off()
    x0, y0, x1, y1 = region
    ents = [e for e in doc.modelspace()
            if (b := bbox.extents([e], fast=True)).has_data
            and b.extmax.x > x0 and b.extmin.x < x1 and b.extmax.y > y0 and b.extmin.y < y1]
    cfg = Configuration(background_policy=BackgroundPolicy.WHITE,
                        color_policy=ColorPolicy.COLOR, lineweight_scaling=0.6)
    fe = Frontend(RenderContext(doc), MatplotlibBackend(ax), config=cfg)
    fe.push_property_override_function(grey_architecture)
    fe.draw_entities(ents)
    ax.set_xlim(x0, x1)
    ax.set_ylim(y0, y1)
    ax.set_aspect('auto')
    return ax


def fit(rect_mm, centre, scale):
    """Model region (cm) shown at 1:scale in a figure rectangle (mm)."""
    _, _, w, h = rect_mm
    cx, cy = centre
    hw, hh = w * scale / 20, h * scale / 20      # mm × scale / 10 → cm, halved
    return (cx - hw, cy - hh, cx + hw, cy + hh)


def new_sheet(W, H):
    fig = plt.figure(figsize=(W / 25.4, H / 25.4))
    plt.rcParams['font.family'] = 'DejaVu Sans'
    border = plt.Rectangle((10 / W, 10 / H), (W - 20) / W, (H - 20) / H, fill=False, lw=1.4,
                           transform=fig.transFigure)
    fig.add_artist(border)
    return fig, (lambda x, y: (x / W, y / H))


def load_table(fig, rect, size, rows, note=None, fontsize=8):
    """Draft load schedule rows in the single-phase YÜKLEM CETVELİ layout."""
    W, H = size
    x, y, w, h = rect
    ax = fig.add_axes([x / W, y / H, w / W, h / H])
    ax.set_axis_off()
    ax.set_title('YÜKLEME CETVELİ (taslak) - ADT, monofaze, şebekeden 2x80A', fontsize=11,
                 weight='bold', loc='left')
    head = ['Devre', 'Sigorta', 'Kesit mm²', 'Devre Adı', 'Adet', 'Birim kW', 'Devre kW', 'T.F.', 'Talep kW']
    body = []
    for c, fuse, cs, name, n, unit, kw, tf in rows:
        body.append([c, fuse, cs, name, str(n), unit if isinstance(unit, str) else f'{unit:.3f}',
                     f'{kw:.3f}', f'{tf:.1f}'.replace('.', ','), f'{kw * tf:.3f}'])
    tbl = ax.table(cellText=body, colLabels=head, loc='upper left', cellLoc='center',
                   colWidths=[.07, .08, .09, .3, .06, .09, .1, .06, .1])
    tbl.auto_set_font_size(False)
    tbl.set_fontsize(fontsize)
    tbl.scale(1, 1.45)
    if note:
        fig.text(x / W, (y - 6) / H, note, fontsize=8)


def title_block(fig, size, origin, pafta, scales, width=474):
    W, H = size
    x, y = origin
    mm = lambda a, b: (a / W, b / H)
    fig.add_artist(plt.Rectangle(mm(x, y), width / W, 140 / H, fill=False, lw=1.2, transform=fig.transFigure))
    fig.text(*mm(x + 12, y + 115), 'VILLA KHAN', fontsize=26, family='serif')
    fig.text(*mm(x + 12, y + 97), 'ELEKTRİK PROJESİ - MONOFAZE', fontsize=14, weight='bold')
    rows = [
        ('PAFTA', pafta),
        ('MİMARİ ALTLIK', '30102026_FINAL DRAFT.dwg (P.18, 30/10/2026)'),
        ('SEMBOLLER', 'KTEMO standart lejantı (E-01)'),
        ('ÖLÇEK', scales),
        ('REVİZYON', 'E.01  TASLAK  30/10/2026'),
    ]
    for i, (k, v) in enumerate(rows):
        fig.text(*mm(x + 12, y + 78 - i * 13), k, fontsize=8, color='#555555')
        fig.text(*mm(x + 80, y + 78 - i * 13), v, fontsize=9.5)
    fig.text(*mm(x + 12, y + 7), 'Ön tasarımdır. Oda vizesi için yetkili elektrik mühendisinin '
             'hesap ve imzası gerekir.', fontsize=7, style='italic', color='#555555')


def sheet(doc, living, kitchen, kitchen_led_m, n_shutters, detail_origin, legend_origin):
    """One A0: the whole ground floor at 1/25 with every room's electrics on it."""
    W, H = 1189, 841
    fig, mm = new_sheet(W, H)

    hx0, hy0, hx1, hy1 = HOUSE
    plan_rect = (15, 40, 810, 785)
    draw(doc, fig, plan_rect, fit(plan_rect, ((hx0 + hx1) / 2, (hy0 + hy1) / 2), 25), (W, H))
    fig.text(*mm(25, 27), 'ZEMİN KAT ELEKTRİK PROJESİ - AYDINLATMA, PRİZ, DATA', fontsize=18, weight='bold')
    fig.text(*mm(25, 18), 'ÖLÇEK 1/25    mimari altlık P.18 (30/10/2026), kesitler ve akslar çıkarılmıştır',
             fontsize=10)

    x = 838                                         # the right-hand column
    lx, ly = legend_origin
    draw(doc, fig, (x, 590, 340, 230), (lx - 10, ly - 931, lx - 10 + 340 * 4.333, ly - 931 + 230 * 4.333), (W, H))

    dx, dy = detail_origin
    draw(doc, fig, (x, 455, 290, 125), (dx - 40, dy + 185, dx - 40 + 290, dy + 185 + 125), (W, H))
    fig.text(*mm(x, 446), 'HAVUZ ASMA TAVAN KESİT DETAYI  1/10  (oturma odası, duvardan oda eksenine)',
             fontsize=9, weight='bold')

    lr, kr = ROOMS
    s1, s5, s6 = living['spots']['L1'], kitchen['spots']['L5'], kitchen['spots']['L6']
    notes = [
        'NOTLAR',
        '1. Tesisat MONOFAZE (tek faz, 230V). Anahtarlar h:110 cm, kapının kilit tarafında.',
        'OTURMA ODASI',
        f"2. Havuz asma tavan: {lr['band']} cm bant, bant altı +{lr['band_level']:.2f}, havuz +{lr['pool_level']:.2f}".replace('.', ',')
        + ' (döşeme altı).',
        f"3. L1: {s1} gömme spot bant ekseninde, ~{lr['spot_pitch'] / 100:.2f} m aralık; KD köşede şömine".replace('.', ','),
        '   bacası nedeniyle spot yok. L2: havuz kenarında gizli LED, sürücü (LS) bantta.',
        '4. Kapı yanında ÇİFT anahtar: L1 spotlar + L2 gizli LED; VAVİYEN, bahçeye bakan',
        '   kuzey 300/230\'un doğusunda da aynı anahtar. Anahtar asla kapı arkasına konmaz.',
        f"5. Pencere ve sürgü önünde perde korniş boşluğu {lr['curtain_depth']} cm, açıklıktan {lr['curtain_over']} cm taşar.",
        f"6. TV korunur; önüne {lr['cinema']['inches']}\" motorlu perde iner (kaset doğu bandında, duvardan",
        f"   50 cm). Projektör batı bandına askılı, atış {lr['cinema']['throw'] / 100:.2f} m. HDMI 2.1 fiber + CAT6".replace('.', ',', 1),
        '   TV ünitesinden projektöre bant içinden. Perde 12V tetik / RF ile.',
        '7. Cisco AP havuz ortasında: CAT6 + AYRI ENERJİ (P1). Boruları beton öncesi döşemeye.',
        'MUTFAK',
        f"8. Spot bantlı asma tavan: {kr['band']} cm bant (spotlar üst dolapların önünde), bant altı",
        f"   +{kr['band_level']:.2f}, gizli LED yok. L5: {s5} spot mutfak, L6: {s6} spot yemek tarafı.".replace('.', ',', 1),
        '9. L3: yemek masası üzerinde avize; buatı beton öncesi döşemeye. Kuzey 180/230,',
        '   sürme kapı ve doğu 300/230 önünde bantta 15 cm perde korniş boşluğu.',
        f"10. L4: üst dolapların altında LED şerit ~{kitchen_led_m:.1f} m, sürücü (LS) dolap içinde.".replace('.', ','),
        '11. Mutfakta köşedeki kiler kapısının solunda iki ÇİFT anahtar: L3 avize + L4 LED,',
        '    L5 + L6 spotlar (kilere geçerken elin altında). Tümü VAVİYEN: aynı ikisi kuzeyde',
        '    iki cam açıklık arasındaki kolonun iki yanında (kolona buat konmaz; h:120, ada',
        '    üstü): L3/L4 batıda, L5/L6 doğuda. Bahçeye çıkarken',
        '    bütün ışıklar oradan söner.',
        '11a. Kilerde tavan ortasında tavan lambası (L7), anahtarı içeride köşe kapının',
        '    kilit tarafında h:110.',
        '12a. Güney tezgahın batı ucunda 1,50 m cihaz dolabı (sürgülü kapaklı): tam otomatik',
        '    kahve mak., Türk kahvesi mak., tost mak.; arka panelde 2 ikili priz h:136, P4.',
        'ANA KORİDOR',
        '12. ADT koridorun batısındaki dolap nişinde, arka duvarda, alt kenarı h:120 (üst 170):',
        '    monofaze, 2 sıra sıva üstü tablo (Hager Gamma tipi ~40x50x12 cm): ana şalter,',
        '    parafudr, kaçak akım (RCD/RCBO), sigortalar. Nişin üstünden 1. kata 40x50 TESİSAT',
        '    ŞAFTI çıkar: kuvvetli akım (KA) ve zayıf akım (ZA) buradan geçer (E-02). Cisco router',
        '    TAVANDA; evin data noktası, tüm CAT6 burada. Ağ cihazları data ile birlikte',
        '    ENERJİ ile de beslenir: yanında tavan prizi (P2). 1. katta ikinci router',
        '    ANA KORİDOR ortasında tavanda.',
        'PRİZLER',
        '14. Tüm prizler İngiliz standardı: BS 1363 (G tipi, 13A, anahtarlı), tesisat BS 7671.',
        'PANJURLAR',
        f'13. Dışa bakan her pencere ve sürme kapıda motorlu panjur ({n_shutters} adet), dış kutulu;',
        '    motor kutuda, aşağı/yukarı anahtarı içeride pencere yanında h:110. Hepsi P3.',
    ]
    fig.text(*mm(x, 432), '\n'.join(notes), fontsize=8.3, va='top', linespacing=1.38)

    led_kw = round(living['led_m'] * LED_W_PER_M / 1000 * 1.2, 3)
    kled_kw = round(kitchen_led_m * LED_W_PER_M / 1000 * 1.2, 3)
    media_kw = (PROJECTOR_W + SCREEN_W + MEDIA_W + AP_W) / 1000
    spot = SPOT_W / 1000
    load_table(fig, (x, 168, 340, 70), (W, H), [
        ('L1', '10A', '1,5', 'Oturma od. spotlar', s1, spot, s1 * spot, .4),
        ('L2', '10A', '1,5', 'Oturma od. gizli LED', 1, led_kw, led_kw, .4),
        ('L3', '10A', '1,5', 'Mutfak avize', 1, CHANDELIER_W / 1000, CHANDELIER_W / 1000, .5),
        ('L4', '10A', '1,5', 'Mutfak tezgah altı LED', 1, kled_kw, kled_kw, .5),
        ('L5', '10A', '1,5', 'Mutfak spotlar (mutfak)', s5, spot, s5 * spot, .5),
        ('L6', '10A', '1,5', 'Mutfak spotlar (yemek)', s6, spot, s6 * spot, .5),
        ('L7', '10A', '1,5', 'Kiler tavan lambası', 1, .015, .015, .5),
        ('P1', '16A', '2,5', 'Oturma od. TV ün., projektör, perde, AP', living['cinema_sockets'] + 1,
         '-', media_kw, .5),
        ('P2', '16A', '2,5', 'Ana koridor router prizi', 1, ROUTER_W / 1000, ROUTER_W / 1000, 1.0),
        ('P3', '16A', '2,5', 'Panjur motorları', n_shutters, SHUTTER_W / 1000, n_shutters * SHUTTER_W / 1000, .3),
        ('P4', '20A', '2,5', 'Mutfak cihaz dolabı (BS 1363)', 4, '-',
         (COFFEE_W + TURKISH_W + TOASTER_W) / 1000, .5),
    ], fontsize=6.5)
    title_block(fig, (W, H), (x, 20), 'E-01  ZEMİN KAT ELEKTRİK PROJESİ', '1/25, 1/10  -  A0', width=340)
    return fig


def sheet_first(doc, n_shutters, legend_origin):
    """E-02: the first floor at 1/25 — the shaft over the ADT, the router it
    feeds and every rolling shutter. Rooms are drawn as they come."""
    W, H = 1189, 841
    fig, mm = new_sheet(W, H)
    hx0, hy0, hx1, hy1 = FIRST_HOUSE
    plan_rect = (15, 40, 810, 785)
    draw(doc, fig, plan_rect, fit(plan_rect, ((hx0 + hx1) / 2, (hy0 + hy1) / 2), 25), (W, H))
    fig.text(*mm(25, 27), '1. KAT ELEKTRİK PROJESİ - ŞAFT, DATA, PANJUR', fontsize=18, weight='bold')
    fig.text(*mm(25, 18), 'ÖLÇEK 1/25    mimari altlık P.18 (30/10/2026), kesitler ve akslar çıkarılmıştır',
             fontsize=10)
    x = 838
    lx, ly = legend_origin
    draw(doc, fig, (x, 590, 340, 230), (lx - 10, ly - 931, lx - 10 + 340 * 4.333, ly - 931 + 230 * 4.333), (W, H))
    notes = [
        'NOTLAR',
        '1. Tesisat MONOFAZE (tek faz, 230V). Lejant E-01 ile aynıdır.',
        'TESİSAT ŞAFTI',
        "2. Zemin kat ADT nişinin tam üstünde, Y.ODASI 2 D.ODASI'nın güneybatı köşesinde,",
        '   kolona dayalı 40x50 cm (iç) şaft; döşemede aynı ölçüde boşluk bırakılacak.',
        '   Kapaklı, katlar arası yangın durdurucu ile kapatılır.',
        "3. KA (kuvvetli akım): ADT'den 1. kat linyeleri ve P2 router prizi.",
        '   ZA (zayıf akım): CAT6 data, TV, alarm; kuvvetli akımdan ayrı boruda.',
        "4. Giyinme odasının güney dolap dizisi şaftın doğusundan başlar.",
        'ANA KORİDOR',
        '5. Cisco router koridor ortasında TAVANDA, yanında tavan prizi (P2) ve CAT6;',
        "   zemin kattaki ana router'a şaft üzerinden bağlı.",
        'PANJURLAR',
        f'6. Dışa bakan her pencere ve sürme kapıda motorlu panjur ({n_shutters} adet), dış kutulu;',
        '   motor kutuda, aşağı/yukarı anahtarı içeride pencere yanında h:110. Hepsi P3.',
        '7. Oda aydınlatma ve prizleri sonraki revizyonda işlenecektir.',
    ]
    fig.text(*mm(x, 560), '\n'.join(notes), fontsize=8.6, va='top', linespacing=1.4)
    title_block(fig, (W, H), (x, 20), 'E-02  1. KAT ELEKTRİK PROJESİ', '1/25  -  A0', width=340)
    return fig


def main():
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        doc = ezdxf.readfile(dwg_to_dxf(PLAN_DWG, tmp, 'plan.dxf'))
        src, _ = recover.readfile(dwg_to_dxf(SYMBOL_DWG, tmp, 'symbols.dxf'))

    strip_base(doc)
    doc.styles.add('VK', font='arial.ttf')
    doc.linetypes.add('VK_LED', pattern=[24, 16, -8], description='LED __ __ __')
    doc.linetypes.add('VK_DATA', pattern=[12, 6, -6], description='DATA _ _ _')
    for name, (colour, lw) in LAYERS.items():
        doc.layers.add(name, color=colour, lineweight=lw)
    import_symbols(doc, src)

    msp = doc.modelspace()
    living = havuz_tavan(msp, ROOMS[0])
    switches(msp, ROOMS[0], living['targets'])
    kitchen = havuz_tavan(msp, ROOMS[1])
    fittings, kitchen_led_m = kitchen_fittings(msp, ROOMS[1])
    switches(msp, ROOMS[1], {**kitchen['targets'], **fittings})
    network(msp, NETWORK)
    appliances(msp, APPLIANCES)
    kiler_light(msp, KILER_LIGHT)
    adt(msp, ADT)
    ka, za = shaft(msp, SHAFT)
    first_network(msp, FIRST_NET, ka, za)
    n_shutters = shutters(msp, shutter_openings('ground'))
    n_first = shutters(msp, shutter_openings('first'))
    # Sheet furniture lives west of the plans, clear of both floors.
    detail_origin, legend_origin = (105000, -80000), (108000, -79000)
    section_detail(msp, ROOMS[0], detail_origin)
    legend(msp, legend_origin)

    doc.saveas(os.path.join(OUT, 'VILLA KHAN ELEKTRIK.dxf'))
    fig = sheet(doc, living, kitchen, kitchen_led_m, n_shutters, detail_origin, legend_origin)
    fig2 = sheet_first(doc, n_first, legend_origin)
    with PdfPages(os.path.join(OUT, 'VILLA KHAN ELEKTRIK.pdf')) as pdf:
        pdf.savefig(fig)
        pdf.savefig(fig2)
    print(f"living {living['spots']} + {living['led_m']:.1f} m LED; kitchen {kitchen['spots']} "
          f"+ {kitchen_led_m:.1f} m under-cabinet LED -> {OUT}")


if __name__ == '__main__':
    sys.exit(main())
