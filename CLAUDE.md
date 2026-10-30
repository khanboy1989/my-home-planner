# my-home-planner

## Read this first, every session

**The architect's DWG is the authoritative source for all geometry — check it
before touching `src/floorplan.js`, and re-check it whenever the owner reports
something is in the wrong place.** That is currently
`assets/30102026_FINAL DRAFT.dwg` (**P.18 re-issued 30/10/2026** with the
kitchen entrance moved — item 27; the sheet also lists a P.17 of 05/10 that
was never supplied). The model reads it through its geometry export,
`assets/30102026_FINAL DRAFT.geometry.json` (`PLAN.dwg`), and the floor
texture `PLAN.image` is redrawn from that export. `assets/30102026_FINAL
DRAFT.pdf` is a plain render of the same DWG, exactly as drawn
(`tools/plan-pdf.py`). The older PDFs (P.13–P.16), their page JPEGs, the
28/10 DWG and the WhatsApp SketchUp screenshots (where the flat roof came
from) were deleted on 30/10 at the owner's request; the tracked ones are
still in git history. So were the eight architect's renders (`assets/3D
Rendered/`, 2026-10-05, also WhatsApp JPEGs, never committed): what the
model took from them — materials and facade detail the drawing does not
show (item 24) — is already built in, and they were never a source for
wall positions.

**Start every session by confirming that is still true:**

```bash
ls -t assets/*.dwg assets/*.pdf | head -1   # newest drawing the owner has supplied
grep -n "dwg:" src/floorplan.js             # what the model actually reads
```

A DWG is the best thing the architect can send: true centimetres, every
label and window tag as real text, door swings as exact arcs. It is in AutoCAD
2018 format (`AC1032`), which nothing in Node reads, so it is exported once
per revision:

```bash
brew install libredwg                 # dwg2dxf
python3 -m venv .venv && .venv/bin/pip install ezdxf
.venv/bin/python tools/dwg-export.py "assets/<name>.dwg"   # → <name>.geometry.json
node tools/render-sheet.mjs           # → PLAN.image, the floor texture
.venv/bin/python tools/plan-pdf.py    # → assets/<name>.pdf, the DWG as drawn
.venv/bin/python tools/electric-plan.py   # → electrical/VILLA KHAN ELEKTRIK.pdf
npm run audit                         # reconcile doors + list windows
node tools/plan-audit.mjs 780 1690 1140 2040    # dump segments in a box
```

`PLAN.dwgToSheet` maps DWG centimetres into the model's sheet pixels
(`[k·X + tx, -k·Y + ty]`). It was fitted on the **structural grid**: axes 1–7
and A–D (layer `00_Axis`) are the exterior wall centrelines, and both floors
sit on one grid 2845 cm apart in the drawing, 1763 px apart in the model —
which is the first floor's `alignPx`. Residual under 1 px.

`npm run audit` cross-checks every door arc in the DWG against the openings
in `floorplan.js`. It should report **16/18 arcs matched**; the two leftovers
are the curved sofa in OYUN ODASI, not doors. If it reports anything else, the
model has drifted from the drawing — fix the model, not the audit. It also
prints the window schedule from the `04 PEN TAG` text (width over height).

Useful layers: `00_DUVAR` / `000 DUVAR UPDATED` walls (faces, in pairs),
`COLUMN4` columns, `04 pencere plan` window glazing lines and door swings,
`04 PEN TAG` window sizes, `04 KA TAG` door tags (`K1:80/230`), `YAZI` room
names and areas, `02 MERDIVEN *` stair (`IZDUSUM` is anything drawn from above:
balcony overhangs, the entrance canopy, the upper flights), `00_tefriş` /
`D_DOL` / `TEFRIS` furniture. The elevations, section A-A and levels sit east
of X 122500 and are not exported; render them from the DXF if they are needed
(`dwg2dxf`, then ezdxf's drawing add-on).

### A newer revision

1. **A new DWG:** export it (above), render the plans and diff them against
   the old export in model px — the grid fit should still hold if the
   architect did not move the drawing; check the `00_Axis` lines first.
   If it moved, refit `PLAN.dwgToSheet` on the axes. Then
   `node tools/render-sheet.mjs`, `npm run audit`, and reconcile the
   **Departures from the sheet** section below.
2. **Only a PDF:** P.13–P.16 were PDFs, read through `PLAN.pdfToSheet`; the
   tools still fall back to that when `PLAN.dwg` is unset. Ask for the DWG.

---

3D viewer for **Villa Khan** — a Three.js scene that lays the architect's 2D floor
plans down as ground textures and extrudes the walls back up out of them.

Both storeys on the sheet are modelled: **ZEMIN** (ground) and **BIRINCI KAT**
(first). They render twice: as two separate models side by side, and — to the
east — stacked in their real relative positions.

## Stack and setup

Plain ES modules, no bundler, no build step. `three` is installed from npm and
reached through an import map in `index.html` pointing at `node_modules/`.

```bash
npm install     # three + pdfjs-dist; Node 18+ is the only prerequisite
npm start       # http://localhost:8080 — node tools/serve.mjs, no Python needed
npm run audit   # verify the model against the PDF
```

It must be served over HTTP: ES modules and the canvas read of the plan JPEG both
fail on a `file://` origin. `README.md` has the full new-machine walkthrough and a
troubleshooting table; `AGENTS.md` is the entry point for non-Claude agents.

## Layout

| Path | What it is |
| --- | --- |
| `assets/` | Source drawings. `30102026_FINAL DRAFT.dwg` is the source (P.18 as re-issued 30/10); `30102026_FINAL DRAFT.geometry.json` is its export (`tools/dwg-export.py`); `30102026_FINAL DRAFT_sheet.jpg` is the plans redrawn from it into the model frame (3509×2482, `tools/render-sheet.mjs`) and is the only image the app reads; `30102026_FINAL DRAFT.pdf` is the DWG rendered as drawn (`tools/plan-pdf.py`, two A1 pages). `Electric/` holds the reference electrical projects (`tools/electric-plan.py` takes its symbols from them). |
| `index.html` | Shell, HUD, import map. |
| `src/floorplan.js` | **The data.** Per-floor crop, alignment, every wall centreline + opening, and the furniture schedule. |
| `src/buildWalls.js` | Turns one floor's wall data into geometry, including door and window joinery. |
| `src/objects.js` | Furniture/fixture makers, keyed by `kind`. |
| `src/main.js` | Scene, camera, sun and times of day, slab textures, layout, interaction. |
| `src/lights.js` | The shared spot-light pool every fitting in the house draws from. |

## The coordinate system (important)

Wall coordinates are **pixels of the original sheet image**, not metres. The sheet
carries both plans side by side, so each floor records its own `crop` (the
rectangle used as its slab texture) and an `alignPx` offset into a shared frame
anchored on the ground floor:

```
sharedPx = floorPx + alignPx
world X  = (sharedPx.x - (ORIGIN.x + ORIGIN.w/2)) * metersPerPixel
world Z  = (sharedPx.y - (ORIGIN.y + ORIGIN.h/2)) * metersPerPixel
```

Because walls and texture share one pixel space, the extrusions stay registered to
the drawing for free. **Keep it that way** — to move a wall, move its pixel
coordinates; don't introduce a metre-space offset.

The first floor's `alignPx` is `(-1763, 0)`. It was `(-1763, -204)` under
P.14, derived from wall faces — the kitchen block / north block north walls
and the living room / master suite north and east walls agree to 1 px. P.16
re-drew the first floor 204 px further north on the page, level with the
ground floor, so its coordinates were shifted by −204 and the offset fell to
0: the floor did not move in the world. (It was `(-1762, +1)` under P.13.) That
alignment is what makes the `stacked` layout meaningful, so preserve it even
though the default view puts the floors apart.

`main.js` centres each floor's slab on its container, so **`crop.xy + alignPx`
must equal `ORIGIN.xy` for every floor** — move `ORIGIN` when the ground floor
moves (it is `{384, 890}` now, 1060 × 940 — P.16 grew it 85 px north so the first floor's crop takes in the bedroom balconies), and derive `alignPx` from it for any other.

`metersPerPixel = 0.016144` comes from the DWG's grid (axis 1 to axis 7 is
16.30 m, 1010 px). It used to be 0.0168, calibrated against a door's clear
opening on the PDF, which made the whole house 4% too big; correcting it scaled
everything in metres, and nothing in pixels had to move.

**Levels (P.18 section A-A):** garden ±0.00, ground floor +0.34 on a 0.34 m
slab, first floor +3.40, roof slab 6.12–6.46, parapet to +6.86. So
`PLAN.plinth = 0.34`, `floorToFloor = 3.06` (18 risers of 17 cm) and
`storeyHeight = 2.72` clear. A floor's `level` is its finished floor's height
above its container: the ground floor's container stays at grade, because the
garden is built in it too, and every outdoor item carries **`site: true`**
(walls and objects alike) to stay on the ground. Forget it on a new garden item
and it floats 0.34 m up.

## Layout modes

Both layouts are on screen at once: the side-by-side row at the world origin,
and a second copy with the first floor stacked on the ground floor `STACK_DX`
(≈46 m) to the east. `main.js` builds each floor twice (`buildModel`), sharing
the slab textures. `placement(floor, mode)` in `floorplan.js` is the single
source of truth for where a floor goes within a model:

- `'apart'` — storeys stepped along +X by `ORIGIN.w + GAP_PX`.
- `'stacked'` — storeys in plan alignment, one above the other.

**Both** modes put a storey at its true height, `storey * floorToFloor`; only the
sideways offset differs. That is deliberate — the first-floor stair descends from
its own slab, so a first floor sitting at y=0 would bury the flight.

Geometry is built at each floor's true alignment and wrapped in a container;
layouts only move containers. Don't bake layout offsets into the geometry. Each
model has its own pool, so the ground `apron` gets a hole per model, and the sun's
shadow frustum is sized to reach the eastern one.

A floor may set an `outline` (footprint polygon, that floor's sheet px) to clip its
slab. BIRINCI KAT does — otherwise its crop, mostly empty paper, hangs 3.4 m up
in the stacked model and hides the ground-floor terrace and its roof.

## Wall data conventions

Each entry in a floor's `walls` is a centreline `a → b` plus a list of `openings`.

- `type` is `'exterior'` or `'interior'` and selects thickness and material;
  `thickness` overrides it in metres for one-offs.
- Opening `from`/`to` are distances along the wall from `a`, **in pixels**;
  `sill`/`head` are metres above that floor's finished floor. Omit them for window
  defaults (0.9 / 2.3). Doors and cased openings pass `sill: 0`.
- Openings are not CSG. `buildWalls.js` splits a wall into full-height stretches
  plus spandrels and lintels around each hole, which keeps geometry cheap and
  closed.
- `kind` then decides the joinery: a `window` gets a black frame, sill, mullion
  and glazing; a `door` gets a light lining plus a leaf swung 78° open, so the
  swing reads from above the way it does on the plan; `sliding` gets a black
  glazed leaf parked alongside on the wall face with a track above; `garage` gets
  a head panel and no leaf; `opening` is a lined hole. `swing: -1` mirrors which
  way a leaf swings or parks.

## Objects

`GROUND_OBJECTS` / `FIRST_OBJECTS` in `floorplan.js` place furniture by `rect`
(the same sheet pixels as the walls), so items land on the symbols printed in the
texture below them. `kind` selects a maker in `objects.js`; add a maker there
rather than modelling one-offs inline. `railing` is the exception — it takes a
`path` polyline instead of a rect, and is used for the balcony edge and the
gallery void.

Orientation props (`head`, `back`) name the side the back is **against**: `'N'`
is -Z (up the page), `'S'` is +Z, `'W'` is -X, `'E'` is +X.

## Verifying a trace change

1. `npm run audit` — the primary check. Reconciles door openings against the
   PDF's swing arcs and prints the window schedule read from dimension text.
2. For a wall whose position is in doubt, dump the raw segments around it:
   `node tools/plan-audit.mjs <x0> <y0> <x1> <y1>`. Wall faces show up as pairs
   of parallel lines; the gap between collinear runs **is** an opening.
3. A visual overlay of centrelines on the floor crop catches gross errors. When
   building one with `sharp`, note that **`resize()` runs before `composite()`**,
   so render at the crop's native size or the lines will not line up.

How the PDF encodes things, so you don't have to rediscover it:

- PDF points → sheet pixels is one scale (`3509 / pageWidth`) plus a Y flip.
  No offset. The JPEG was rendered at 150 dpi from the same page.
- pdfjs 6 packs subpaths as a flat `[opcode, ...coords]` stream inside
  `constructPath` args — `0` moveTo, `1` lineTo, `2` cubic, `3` close.
- A door is a 90° bezier arc: **centre = hinge, radius = leaf width**. Of its
  two endpoints, the one lying along a wall centreline is the *closed* leaf and
  therefore the opening; the other is the open position.

  **The leaf rectangle in the drawing is the OPEN position**, standing
  perpendicular to its wall. So a leaf drawn as a vertical bar belongs to a
  *horizontal* wall, and vice versa. Reading the leaf as "closed" put both
  `K1:100/230` doors by MUTFAK and the garage into the vertical partition
  instead of the horizontal walls at y=1434 and y=1624. Always confirm against
  the wall faces (`node tools/plan-audit.mjs <box>`): a real opening shows as a
  **gap between collinear wall-face runs**, and the closed leaf spans it.
- Windows have no arc. Find them by their dimension text (e.g. `210` over
  `110`), which sits at the opening centre, offset 10–25 px off the wall.

## Departures from the sheet

Two things are modelled that this sheet revision does **not** draw. They were
added on the owner's instruction and are commented at their definitions:

1. **Bedroom → EBEVEYN D.ODASI glazed slider**, black joinery. P.18 moved the
   dressing room west and draws a `K1:80/230` into it (x 3012..3055); the
   slider fills that opening. It parks westward on the dressing-room face, so
   the north wardrobe run stands at y 1656, just clear of the leaf.
2. **Window joinery is black** throughout, as is the slider.

Also added on the owner's instruction (see comments in `floorplan.js`):

3. **Dressing rooms.** `D.ODASI` = *Dolap Odası*, not a bathroom. EBEVEYN
   D.ODASI is a U of `wardrobe` runs round three walls with a glass-top
   `island`; Y.ODASI 2 D.ODASI is the same U with **no island**. The thin
   partition between YATAK ODASI 2 and its dressing room is 0.1 m (PDF faces
   y 1445/1451); the long block on its bedroom side is a desk, not a wardrobe.
4. **KAPALI TERAS — the old glass room, now on the sheet.** The owner's
   glazed back half of the balcony is drawn in P.14 as KAPALI TERAS (11 m²),
   an enclosed room: solid west wall with a 185/110 window, a 600/230 glazed
   front (modelled as black fixed panes either side of a slider), entered from
   ANA KORIDOR through the 251/230, which is a black slider. It sits under the
   ÇAMSIR hip roof; the `glassroom` object is gone. BALKON TERASI (y 1873..2020)
   stays open in front of it, with its balustrade, for laundry.
5. **İÇBAHÇE TERASI (ground, east of the kitchen, 55 m² in P.18)** is a
   0.34 m platform out to the house's east face, under a flat oak
   roof (a `paving` slab, `y: 2.40`, leaning on the kitchen and living walls,
   cantilevering past the free edges, black posts) — in the stacked model
   only, like the tile roofs. Under it: dining table + six chairs, a timber
   planter, potted topiary, and a rubble-stone barbecue at the open north edge
   beside the kitchen, whose flue passes up through the roof (the kitchen's
   300/230 window fills its east wall). `O` hides the roof (any `paving` item
   with `roof: true`). **There is no pool any more** — P.18 dropped the HAVUZ,
   its paved deck, the loungers and parasols; the owner confirmed it. The
   `pool`, `lounger` and `parasol` makers are still in `objects.js`, and the
   apron and the `land` still cut a hole over any `pool` item, should one come
   back.
6. **(Retired with P.14.)** The garage and its white roller shutter are gone:
   P.14 turned the garage into ÇALIŞMA ODASI, OYUN ODASI and a W.C.
7. **The family's cars — a Mercedes-Benz C220 d** (graphite) **and a
   Mitsubishi L200 double-cab pickup, 2018** (white), built by the `sedan` and
   `pickup` makers at their real sizes — stand in the western two of the three
   2.5 × 5.0 m parking bays P.18 draws (GARAJ GIRIS, x 276..740), nose to the
   house. The bays run from the west plot wall; the old low west wall is gone.
8. **Flat roof** — the sheet draws none, but the architect's SketchUp massing
   (P.16) is flat-roofed, so on the owner's instruction to follow the real
   drawings the black S-tile hip roofs (from an earlier photo) were replaced.
   One `paving` slab in wall render (`mat: 'render'`, 2.72–3.06 m above the
   first floor, i.e. 6.12–6.46) covers the first-floor outline (`ROOF_OUTLINE`),
   including the three balconies, with a 0.40 m parapet, as section A-A draws. The renders leave BALKON TERASI open to the sky, so the
   roof stops just past KAPALI TERAS's glazing and the posts are gone. **Only in the
   stacked model** (`only: 'stacked'`) — the side-by-side floors stay open so
   you can look into them from above. `O` hides every `roof: true` item. The
   `hiproof` maker is still in `objects.js` if the tile roofs come back.
9. **The plot.** A `land` item (lawn) fills the site boundary — the centre of
   P.18's double line (a 0.24 m wall), corners `PLOT` = (249,209) (1652,582)
   (1600,2360) (219,2281). It measures ~701 m² (outer line 713 m²) against the
   owner's 726 m².
10. **Plot wall and front gates.** A 2 m × 0.2 m boundary wall runs on the plot
    line (same four corners as the `land` item). The street is the south edge.
    It has the two openings P.18 draws either side of a pier (black-lined
    `gate` openings, each with a gate object — `gate` kind, `streetGate()` in
    `floorplan.js`): a 9.2 m opening across the three parking bays (x 226..794)
    with a bi-parting sliding gate, drawn closed; and a 2.5 m opening onto the
    path up to GIRIS (x 809..964) with a pedestrian gate swung open 70° inward.
    A 1 m wall separates the bays from the path. P.18 draws no patio: the
    paving is the path and bays at grade, and 0.34 m platforms for İÇBAHÇE
    TERASI, GIRIS TERASI with the front-door landing (not outlined on the
    sheet; sized to its printed 18 m²), and the strip in front of the west wing
    down to the long low step north of the bays. Single steps sit outside the
    dining slider and KILER's door. Everything else is lawn.
11. **Laminate parquet floors** in the living areas (`parquet` rects on each
    floor). `cropTexture()` in `main.js` multiplies a plank pattern over the
    plan, so printed lines and labels survive. Kitchens included; only the
    W.Cs, showers, laundry and the stair stay plain. Interiors are never grass: the `land` sits *under* the
    slabs.
12. **Exotic fruit planting** just inside the plot wall: date and papaya palms,
    banana clumps, and mango / fig / pomegranate / orange / lemon / avocado
    trees (`PLANTING` in `floorplan.js`; `palm`, `banana` and `fruittree`
    makers). Round the lawn just inside the wall, clear of the gates, the
    parking and the terraces. With P.18 the terrace stops at the house's east
    face, so the east garden is ~3.4 m wide and takes fruit trees again (it
    took date palms only while the terrace ran to x 1510). An entry's
    `opts.inset` overrides the default 65 px set-in from the wall.
13. **Floor slab body.** Storeys are 2.72 m of wall on a 3.06 m floor-to-floor, so
    an upper floor gets a 0.34 m structural slab under it (`slabBody()` in
    `main.js`, same outline and voids) and the walls below meet it with no gap.
    The ground floor gets the same body from the garden up to its +0.34 floor.
14. **OTURMA ODASI restyle** after the owner's reference photo: cream and gold.
    Media wall on the east wall (`tvwall`: backlit niches, one floating unit,
    TV above, `fireplace: false`; the TV is sized from a `tv` diagonal in
    inches, **85" by the owner's instruction**, 16:9 plus a bezel and clamped
    to the centre section between the niches) and a **ceiling-hung fireplace** (`hangingfire`,
    black flue and steel bowl with the fire) hung in the **north-east corner** of
    the salon, its mouth turned into the room (`faceDeg`), cream sofas with gold rails
    (`fabric: 'cream'`, `trim: true`), patterned `rug`, marble `coffee` table,
    `curtain`s on the north window, `lamp` and `sidetable`s. The sectional was
    replaced by four low, deep `lounge` pieces — a 3-seat sofa (west wall), a
    2-seat sofa (south) and two single armchairs (north, at the window) — none
    joined at a corner (**no L-shaped sofa**), so the floor stays open. The owner then had
    the three-seat sofa, both armchairs, the console table and the ficus
    removed; the plan's printed symbols for them are painted out via the
    floor's `erase` rects (`cropTexture()` overpaints them with plain parquet). The fireplace
    is a requirement — keep one (now the hanging one) if the room is restyled again.
15. **(Retired.) The ground-floor copy is gone.** `src/groundCopy.js` was a
    full, independent duplicate of the ground floor drawn as a third model 30 m
    west of the origin (key `5`), kept as a scratch copy to try changes on. It
    was never re-traced past **P.13**, so under P.14 it modelled a house that no
    longer exists — most of what it tried out was the garage split in three,
    and P.14 has no garage at all. It was removed rather than re-traced:
    experiment on a git branch instead. The work worth keeping was already
    carried into the real model — the kitchen **appliance wardrobe**
    (`appliancenook`, item 18) and the **dining slider** (item 16). Its toddler
    makers (`playmat`, `rockinghorse`, `teepee`, `ballpit`, `blocks`, `teddy`,
    `toyshelf`, `TOY_COLOURS`) are still in `objects.js`, unused, and are the
    obvious furniture for P.14's own OYUN ODASI. The history is on the branch
    `feature/ground-floor-copy`.
    Each model still has a colour-coded name plate in front of it (blue side by
    side, green stacked; `LABELS` in `main.js`, `N` toggles) and the hover
    readout ends with the model's name.

16. **Dining → back garden slider.** The sheet draws a 250/230 window in the
    kitchen block's north wall behind the dining table; on the owner's
    instruction it is a glazed slider to the floor instead, out onto a step
    down to the back lawn. It keeps the drawn opening (x 754..909, 2.60 m — already centred
    on the table) and only drops its sill to 0. Black joinery, parking east so
    the leaf lands on solid wall rather than across the other window.
17. **The dining chairs face the table.** Each carries a `rot` (degrees
    clockwise on the page; the `chair` maker backs a chair north at 0), so the
    west run is 270, the east run 90 and the ends 0 and 180. Without it all
    eight faced north and the two runs sat back to back. The maker builds a
    real chair — legs, seat, open backrest — rather than the solid block it
    used to be, which at eye level read as a crate.

18. **Kitchen storage to the ceiling** (both kitchens). `wallcabinet` runs hang
    over the worktops from 1.5 m to 2.95 m (the ceiling is the first-floor
    slab's underside, 3.0 m), 0.35 m deep, clear of the MUTFAK west window;
    over the fridges they start at 2.15 m and over the KILER hob at 2.0 m.
    MUTFAK also has a **secret appliance wardrobe** (`appliancenook`,
    `microwave: false`) at the west end of its south run: coffee machine,
    kettle and toaster behind sliding pocket doors, drawn open.

19. **The lit band between the storeys — stacked model only.** Not on the
    sheet; the owner's instruction. The first floor's structural slab (3.0–3.4 m,
    the 0.4 m `slabBody`) is pushed out past the facade into a projecting band,
    and **facade downlights are recessed into its soffit**, washing the ground
    floor and the garden. It is deliberately the *storey line* — between the
    ground-floor wall head and the first-floor slab — not an eaves band.
    - `BAND_OFFSET` in `main.js` is `exterior/2 + BAND_PROUD`: the first floor's
      `outline` runs on the exterior wall **centrelines**, so the offset has to
      clear half a wall (0.125 m) before any of it shows. `BAND_PROUD` (0.12 m)
      is what actually stands clear of the facade. Change `BAND_PROUD`, not the
      sum.
    - `offsetOutline()` offsets the outline outward. It is exact **only because
      every floor outline is rectilinear** — it intersects neighbouring offset
      edges by taking x from the vertical one and y from the horizontal one. Add
      a diagonal edge to an outline and it must be generalised.
    - Apart, the floors have no ground floor under them for a band to belong to,
      so `banded` is false and `slabBody` is built flush, as before.
    - **`L` toggles night** (`setNight()`): sun 2.4 → 0.12, ambient 0.25 → 0.05,
      sky and fog darkened, fixtures on. The lights are hidden by day — they are
      invisible against full sun, and hiding them keeps the whole pool out of
      the render. They **cast no shadows**; a shadow map each would cost more
      than the rest of the scene. The sun stays the only shadow caster. The
      band's 21 fixtures no longer own their spots — see *Lighting*, below.
    - `LIGHT_SPACING` (3.4 m) was set against the render. The fixture sits 0.12 m
      off the wall, so the cone is cut near its apex and makes a ~1.2 m scallop
      on the wall (distinct, about one per window bay) while opening to a ~4.2 m
      pool on the ground 3 m below, where the pools overlap into a continuous
      wash. Do not "fix" the gaps between the wall scallops — they are the
      intended rhythm, and closing them needs ~34 lights per model.

20. **Time of day.** `K` steps the sun on through Morning → Midday →
    Afternoon → Sunset → Night and `J` steps back; `L` still jumps straight to
    night and back to whichever daylight hour you left. Each entry carries a
    `clock` (08:00 / 13:00 / 16:00 / 19:15 / 22:30); the HUD reads
    "Morning · 08:00" and every change also throws the hour up in the middle
    of the screen for 1.6 s (`#time-toast`, `announceTime()`), because in walk
    mode you are looking at the room and not at the panel. The boot call is
    `setTime(0, false)` so the toast does not fire on load. `TIMES` in `main.js`
    holds the sun direction, intensity, tint, ambient, hemisphere and sky/fog
    for each. **The sheet's "up" is not compass north** — the owner's
    orientation is that the back garden (the model's -Z) faces **east** and the
    entrance and parking side (+Z) faces **west**, which makes +X real south.
    So every daylight sun in `TIMES` has a positive X: in the northern
    hemisphere the sun never crosses the north. The sun rises out of -Z over
    the back garden, crosses +X and sets into +Z over the parking.

21. **The interior lighting, and why no fitting owns a light.** On the owner's
    instruction the house is lit for walk mode, not just from outside:
    - **A dropped perimeter ceiling in every room** (`coffer` in
      `objects.js`): a band **0.20 m wide** round the inside of the room,
      **0.15 m below** the slab soffit, with a downlight recessed into it at
      **each corner**. Room rects live with the other objects in
      `floorplan.js` and are written at **wall centrelines**, like the walls;
      `ROOM_INSET` (0.1 m) takes them back to the plaster, which is 2–3 cm out
      against an exterior wall and invisible at 2.85 m. Stacked model only,
      like the roofs — apart, these floors have no ceiling to hang from.
      GIRIS HOLU's is at 6.40 m because it is open to GALERI BOSLUGU.
    - **Under-cabinet strips** in both kitchens and KILER, built into the
      `wallcabinet` maker so moving a run takes its light along; `lit: false`
      opts out.
    - **The dressing rooms** get one `ceilinglight` in the middle instead of a
      coffer — they are small and walled with wardrobe — and their `wardrobe`
      runs carry `lit: true`, which lights the open bay inside.
    - **A `chandelier`** over the dining table in MUTFAK: two tiers of candle
      lamps on gold arms with crystal drops.
    - **Sconces** (`walllight`): a pair flanking the front door on the south
      face of the entrance wall, and two on BALKON TERASI — the balcony's only
      solid wall is the gallery's west exterior where it passes the terrace.

    **None of these owns a `SpotLight`.** There are ~165 emitters in the
    scene and a WebGL fragment shader pays for every light on every lit pixel,
    so `src/lights.js` keeps a fixed pool of **18** spots and hands them to
    whichever emitters are nearest the camera, re-aiming them as you move.
    Interior fittings are dropped beyond 13 m and otherwise count as half as
    far as they are, so the room you are standing in beats the facade band
    outside its window. **The pool size must not change while the lights are
    on:** three.js compiles a shader per light count, so growing and shrinking
    the set as you walk would recompile every material several times a second.
    Spare slots park below the world at zero intensity. The whole pool is
    hidden by day, which is the one moment the count may change.

    To add a fitting, call `emitter(parent, {...})` from its maker and put the
    glowing parts in a `nightGroup()` — `setTime()` shows and hides those.

22. **Two things that made night laggy, both fixed in `main.js`.**
    - The 4096² sun shadow map was re-rendering **every frame**. Nothing in
      the scene moves, so `renderer.shadowMap.autoUpdate` is now `false` and
      `invalidateShadows()` is called after the build and after anything that
      changes what casts — floor visibility, roofs, x-ray, walk mode, resize,
      and every `setTime()`, because the sun moves. **If you add a toggle that
      hides or shows geometry, call it**, or the shadows will be of the old
      scene.
    - Resolution is adaptive: `adaptResolution()` steps the pixel ratio down
      towards 1× when the running frame average passes 22 ms and back up under
      13 ms, held for ~½ s each way so it settles instead of oscillating. That
      is what pays for the light count at night; day usually sits at the 2×
      cap. Night is **fill-bound** (measured 30/10 on the Mac: 67 ms a frame
      at 2×, 13 at 1×), so far over budget (> 40 ms) it steps three times as
      far after a third of the wait — the plain 0.1 step took ~20 s of lag to
      get from 2× to 1×.
    - Switching day ↔ night still stalls one frame (~0.1–0.4 s): the pool's
      18 spots appearing changes the light count, and every material
      recompiles. Pre-compiling both variants at load does **not** help —
      three.js keeps one program per material, so compiling day discards the
      night one — and keeping the spots in by day at zero intensity costs
      ~3× by day at 2×. Accepted.

Settled questions — do not re-litigate these without new instruction:

- **P.14 has no garage** and no EV charger / unloading tezgah; the cars park
  outside. The P.13 garage questions are closed with it.
- **There is no pool** (P.18; the owner confirmed it).
- **The main entrance is into GIRIS HOLU**, through P.16's single
  `K1:100/230` (x 869..931) in the wall at y 1747 off GIRIS TERASI, hinged on
  the east jamb and opening inward. (P.14 drew a `K1:180/230` double door.)
  East of it the same wall carries the stair's 210/110 **window**, not a door.
- **GIRIS HOLU is double height**: the first floor's GALERI BOSLUGU is the
  void above it, and the stair is open to it along x 943 (a drawn edge, not a
  wall).
- **The kitchen block's doors (30/10):** MUTFAK ↔ ANA KORIDOR is a
  `K1:180/230` double door at y 1372.5 (it was at y 1303 until 30/10), leaves
  open north into the dining end; MUTFAK ↔ Y.MUTFAK KILER a **diagonal**
  `K1:90/230` across KILER's north-east corner (hinge 792,1311, opening into
  KILER); KILER has its own `K1:90/230` service door out to the west
  (y 1309..1365).
- **ORTAK W.C opens onto ANA KORIDOR**, through the `K1:80/230` in its **east**
  wall (gap at y 1557..1612). There is **no** door between the W.C and ÇAMSIR
  ODASI — that shared wall is solid.
- **GIRIS HOLU has no coat room.** P.16 removed the old hall vestiyer
  (x 770..807); the west wing's east wall (x 799) now closes the hall, with
  the doors to ÇALIŞMA, OYUN and the W.C in it. The **VESTIYER** is under the
  top of flight 2, facing the hall, 1.95 m high: P.18 walls that space off
  (north wall y 1518, divider x 989), the VESTIYER in the west half and a
  store under the flight in the east half.
- **The west wing (P.16):** ÇALIŞMA ODASI across the north half (KÜTÜPHANE,
  corner desk, podcast corner by the 235/110 west window), OYUN ODASI in the
  south (corner sofa, TV, 300/110 window), a W.C in the south-east corner
  (100/110 window). The P.14 W.C in the north-west corner and the corridor
  along the north are gone.
- **The balconies (P.16):** a 4.20 m² BALKON outside each of YATAK ODASI 1
  and 2, and a 5.70 m² one outside EBEVEYN Y. ODASI. Each is walled on both
  sides to the full storey, as in the SketchUp massing, with a frameless glass
  balustrade (`railing` with `glass: true`). The windows onto them (180/230,
  250/230, and the master's, widened to 300/230) are modelled as black
  sliders to the floor, since nothing else leads out. The EBEVEYN balcony
  sits over İÇBAHÇE TERASI's oak roof (top 2.93 m, balcony soffit 3.0 m);
  both are kept.

If the plan is revised, reconcile these first — they are the parts a fresh trace
would not reproduce.

24. **The architect's renders (2026-10-05, since deleted).** On the
    owner's instruction the model follows them where the sheet is silent:
    - **`n/230` glazing is full height.** The labels are width/height in cm,
      so a 250/230 is 2.30 m tall. Every one carries `sill: 0.05` (a fixed
      pane; `sill: 0` would make it a door).
    - **Departures from the sheet:** OYUN ODASI's 300/110 is glazed to the
      floor, and ÇALIŞMA's single 235/110 is replaced by three tall windows
      between render fins under a canopy.
    - **Limestone** (`stone: ±1` on a wall clads that face only — `buildWalls.js`)
      on the entrance/stair block, the GALERI west wall, and KAPALI TERAS's
      back and west walls. The ground stair window runs to the slab, so it and
      the first-floor one read as one glazed column.
    - **Entrance:** a walnut leaf with a bar pull (`leaf: 'walnut'`), a
      full-height glass sidelight to its west (the west sconce moved past
      it), and a deep render canopy at the storey line. A small canopy hangs
      over KILER's service door.
    - **The master suite box** is clad in light grey panels with horizontal
      joints (`cladding`) on its south, east and return faces, standing proud
      of the ground floor, with a taller parapet. Stacked model only.
    - **High strip windows**, not louvres, on the north block's east and west
      faces and the master box's east face: what the renders showed as
      grilles, P.18's side elevations draw as sliding sashes, 1.81–2.46 m
      above the first floor, over YATAK ODASI 1 and 2, Y.ODASI 2 D.ODASI,
      EBEVEYN Y. ODASI and DUS W.C. The plan omits them, so the window check
      cannot see them; they were read off the elevations' A–D grid. Furniture
      on those walls stays under the sill (the D.ODASI run at 1.75 m, the
      master's low unit), and the master box's cladding breaks round the
      band. The `louvre` maker is kept. Also: glass balustrades on BALKON TERASI and
      a glass Juliet at the back's middle-bay 200/230, horizontal-slat gates
      (`slats: 'horizontal'`), and two armchairs on the front terrace.
    - **Kept against the renders**, because the owner asked for them: black
      joinery (the renders draw bronze), the İÇBAHÇE oak roof, the fruit
      planting and the family's cars.

25. **P.18 (28/10/2026), the DWG.** What changed from P.16, all from the
    drawing: no pool; three parking bays to the west wall (GARAJ GIRIS);
    a new plot outline; levels (+0.34 ground on a plinth, 3.06 m storeys);
    OTURMA ODASI's north window 300/230; İÇBAHÇE TERASI 55 m² to the house's
    east face; the entrance canopy drawn 2.5 × 4.5 m over the path; the
    VESTIYER walled off under flight 2 with a store beside it; YATAK ODASI 1's
    window 250/230; both bedroom beds head to head on the dividing wall
    (YATAK 1's TV on its west wall, YATAK 2's on its east); the YATAK 2
    dressing-room wall 0.5 m further north (6 m²); a shower in ORTAK W.C; a
    100/110 window and a sink in ÇAMSIR ODASI; the master suite's back rooms
    swapped (EBEVEYN D.ODASI 7 m² west, DUS W.C 5 m² east, both entered from
    the bedroom), its bed head to the west wall with a wardrobe wall and TV
    opposite; the first-floor stair window 185/110. The owner's **OTURMA
    ODASI** layout (item 14) and the DWG's `şömine` in the same north-east
    corner agree. The owner's glass-top island in EBEVEYN D.ODASI is kept,
    shrunk to 0.8 × 0.5 m to fit the smaller room.

26. **The electrical project in the walkthrough** (`tools/electric-plan.py` →
    `electrical/VILLA KHAN ELEKTRIK.{pdf,dxf}`, run with `.venv/bin/python`).
    Its base is the reference DWG (`PLAN_DWG`, now `30102026_FINAL DRAFT.dwg`),
    its symbols the KTEMO blocks of `assets/Electric/ŞÖHRET KAPLAN
    ELEKTRİK.dwg`; `assets/Electric/` holds the reference projects and load
    schedules — keep it. **Re-run it on every new DWG** and look at the PDF:
    labels are placed by hand and collide when the plan moves under them.
    **One A0 sheet per floor** — never per room: **E-01** the whole ground
    floor at 1/25 with every room's electrics, legend, notes, load table and
    the ceiling section; **E-02** the first floor at 1/25 (`sheet_first()`):
    the riser shaft over the ADT with its KA/ZA risers, the ceiling router
    fed up it, the 17 shutters and the legend. First-floor rooms' lighting
    and sockets are still to come. The PDF has both pages. The structural grid
    (`00_Axis`, `00 aks yazi`) and the kesits are stripped from the base. The model follows it; **keep the two in step**
    (same band widths, levels, pitches, pockets — the JS rects are the DWG's
    centimetres converted with `PLAN.dwgToSheet`).
    - **OTURMA ODASI**: `havuz` ceiling (60 cm band at 2.45 m, 17 spots,
      hidden cove LED, Cisco AP, curtain pockets) replaces its `coffer`. The
      TV stays; a motorised 120" screen drops in front of it from a cassette
      pocket in the band, for a ceiling-hung Android TV projector (`cinema`;
      `P` lowers it).
    - **MUTFAK**: three ways to light it — an 80 cm spot band, no cove (80,
      not 60, so the spots land in front of the 35 cm wall cabinets, which now
      stop at its 2.45 m underside), the chandelier and the under-cabinet LED.
      Its `coffer` is gone.
    - **Switched circuits** (`src/circuits.js`, `CIRCUITS` in `floorplan.js`):
      L1/L2 living spots/LED, L3 chandelier, L4 under-cabinet LED, L5/L6
      kitchen/dining spots. Fittings take `circuit` and fade with it; the pool
      skips a switched-off emitter. In walk mode look at a `lightswitch`
      rocker within 2.2 m and press **`E`**. Night puts every circuit on, day
      off. Double switches: living by its hall door (L1+L2); kitchen, two
      **in the kitchen left of the diagonal KILER door** (L3+L4, L5+L6), on
      the stub's 45° face (`back: 'SW'` — `RUN_TURN` takes the four
      diagonals), owner's instruction, so they are to hand going between the
      two rooms.
      **Every light is two-way (vaviyen)**, owner's request, so the house can
      be put out on the way to the back garden: the same switches again on
      the north walls — living by its 300/230 (west of the curtain), kitchen
      on the wall between the 180/230 and the dining slider (1.2 m, over the
      island's end), **one double either side of the concrete column** in
      that wall (x 688..719): a column takes no switch box (owner), so
      L3+L4 against its west face, L5+L6 against its east, clear of both
      curtains. Check `COLUMN4` before putting anything in a wall. In the drawing they are `VK_dvav` (komütatör
      vaviyen), the room's `two_way` list, travellers 3x1,5mm² switch to
      switch. In the model any `lightswitch` with a gang toggles that circuit,
      so a second station is just another `lightswitch` item.
    - **Rolling shutters** on every window and outward slider, both floors
      (`shutterOpenings()` in `floorplan.js` picks them and finds the outside
      face from the floor `outline`; `shutter: false` opts an opening out).
      `buildWalls.js` gives each a box over the head outside, guide rails, a
      slatted curtain and a two-button switch inside by the jamb, **▲ open
      over ▼ close** (each button carries `userData.dir`): look at one and
      press `E`; `U` does all. The switch goes 15 cm past the nearer jamb
      with wall beside it, or past the one the opening names
      (`shutterSwitch: 'to' | 'from'`, `shutterSwitchOff` metres) — the
      drawing reads the same fields. They start up. The drawing reads the same list through
      node (`shutter_openings()`), so the two cannot drift: a motor at the
      switch end of each roller, the switch inside, circuit P3.
    - **MUTFAK curtain pockets** over the north 180/230, the dining slider and
      the east 300/230, with curtains, as in OTURMA ODASI.
    - **Cisco routers are on the ceiling** (owner): one in ANA KORIDOR, the
      data point for every CAT6 run, and one in the middle of the first
      floor's ANA KORIDOR. Owner: network gear gets **mains power as well as
      data** — each router a ceiling socket beside it (P2), the AP a power
      point (P1).
    - **The ADT** (ana dağıtım tablosu, the main board) is in the cupboard
      niche off ANA KORIDOR's west side (x 769..809, y 1376..1407; 0.50 m
      wide, 0.65 deep, 2.72 high), where the owner marked it. **Single
      phase**, in a two-row board like the owner's photo (Hager Gamma type,
      ~40 × 50 × 12 cm: main switch, surge arrester, RCD/RCBOs, MCBs),
      **bottom edge at 1.20 m** (owner: at least 120 cm), top 1.70. `panel`
      maker: the breakers sit in a tray behind a rim, and the cover opens
      and closes with **`E`** (`userData.opener`, stepped in `main.js` like a
      shutter; anything with an `opener` controller works the same way). It
      opens to 90°, which is all the niche's side wall leaves it.
    - **The riser shaft** (tesisat şaftı), owner's instruction: straight up
      from the ADT niche, 40 × 50 cm inside, through the first-floor slab
      (a `voids` entry) into Y.ODASI 2 D.ODASI's south-west corner against
      the column, walled with two 0.1 m partitions (`Şaft — …` walls); the
      dressing room's south wardrobe starts east of it. Mains (KA,
      kuvvetli akım) and low-voltage (ZA, zayıf akım: CAT6, TV, alarm) rise
      through it; the first-floor router is fed up it. Not on the
      architect's drawing.
    - **UK sockets** (owner: the house follows British standards): every
      socket is BS 1363 type G, 13 A switched (`ukSocket()` in `objects.js`,
      `double: true` for a twin), BS 7671 wiring.
    - **A switch is never placed behind a door** (owner's rule). On the
      hinge side of a door that opens towards the switch, the open leaf
      covers it. The OTURMA garden pair and its 300/230's shutter switch
      are east of that window for this reason (the hall door folds flat
      along the wall west of it), and the stair window's shutter switch is
      east of it, out from behind the front door. Check every new switch
      against the door swings.
    - **Y.MUTFAK KILER** has one ceiling lamp in the middle (`ceilinglight`
      with `circuit: 'L7'`; `ceilinglight` now takes a circuit), its switch
      inside on the latch side of the diagonal door (`back: 'NE'`). The
      coffer is gone.
    - **Curtains in front of a slider:** the `curtain` maker's sheer is
      `noCollide` (you push through it); the side drapes stay solid. Before,
      MUTFAK's dining-slider curtain shut the only door to the back garden.
    - **The appliance wardrobe** (`appliancenook`) is 1.50 m (x 520..613):
      full-automatic coffee machine, Turkish coffee machine, toaster, and two
      twin UK sockets on the back panel, 42 cm over the worktop, on their own
      20 A radial, P4.

27. **The 30/10 re-issue of P.18** moved the kitchen entrance (see the
    settled questions): the double door 1.1 m south, the KILER/corridor wall
    gone, a diagonal KILER door, and the ADT niche off the corridor. Nothing
    else in the drawing changed (axes identical, so `dwgToSheet` holds).
    **The printed room areas are not all right.** Measured to the wall faces
    (fill of the DWG's wall layers from each label, closing doorways on the
    swing radii): OTURMA, ÇALIŞMA, OYUN, KAPALI TERAS, ORTAK W.C and ÇAMSIR
    agree within 3%, but **MUTFAK is 33.9 m², printed 24.50** (29.4 kitchen +
    4.5 for the dining end the moved door adds; it was already 31.0 on 28/10)
    and **KILER is 11.65, printed 9.00**. **The DWG is the reference and is
    printed as drawn** (owner, 30/10): `tools/plan-pdf.py` and the electrical
    PDF show the architect's areas unchanged. `AREA_FIXES` in `floorplan.js`
    holds the measured values; only the 3D floor texture (`render-sheet.mjs`)
    applies them. `fix_areas()` in `electric-plan.py` is there but not called.

23. **`5` shows one model at a time.** Both models are built and both sit in
    the scene; `5` cycles both → stacked only → side by side only, which is
    how you get the real house on its own. It composes with `1`/`2`/`0`:
    `showFloors()` and the model filter are two pieces of state applied
    together in `applyVisibility()`, not two things each writing
    `container.visible`. The name plates hide with their model, and
    `LightPool` skips a hidden model's emitters so they cannot take slots from
    the one you are looking at.

## The stair

Modelled on the **first** floor, not the ground floor — BIRINCI KAT is the plan
that draws the whole flight, and the ZEMIN plan only draws treads 1–12 (which
stay part of the texture). It hangs off the first-floor slab and descends:
levels in its `stairs` items are relative to that slab, so `from: -3.06` is
the ground floor. 18 risers of 17 cm (`MÜ: 18 (17x30)`): flight 1 rises south
(8 treads, risers 1–9) in the **east** column, x 2798..2872, to a half-landing
at -1.53 m, then flight 2 rises north (8 treads, risers 10–18) in the west
column, x 2711..2786, and its ninth riser lands at 0 — the first floor slab,
+3.40 above the garden. (The columns have swapped with
every revision: east in P.13, west in P.14, east again in P.16.) P.16 dropped
DEPO; the ground floor's VESTIYER is under the top of flight 2 instead. The
spine between the flights is now a 0.1 m wall (PDF faces x 1024..1030).

Because the stair descends from its own storey, **both layout modes keep each
floor at its true level** (`placement()` returns `storey * floorToFloor` either
way); `apart` only adds the sideways offset. Putting the first floor back at
y=0 would bury the flight underground.

**The stair runs in a stair hall, not over a W.C.** The bay holding flight 2
was once traced as a small W.C with a basin and a toilet, its walls held to
`height: 2.3` so the flight could pass "over" it. It cannot: flight 2's soffit
starts at 1.64 m, so its lower treads ran through the room, above the toilet.
The PDF settled it — treads drawn in both columns — and P.14 confirms it:
`node tools/plan-audit.mjs 940 1500 1120 1760` shows both flights (x 946..1021
and 1033..1108, ground px). The ground floor's W.C is the one in the west wing.

Flight 2 stays `solid: false` (treads and risers only, open soffit), because
the VESTIYER is under it.

**The riser-board sign bug, in case it comes back.** In the open-soffit branch
of the `stairs` maker the riser board's position was `sign * (centre - sign *
run / 2)`. `centre` is already expressed in the flight's own direction, so
applying `sign` a second time mirrored every board to the **far end of the
flight**. Flight 1 is solid and never took that branch, so only flight 2 showed
it — and there the top tread's board ended up standing at y 3.00–3.17, right
across the bottom of the climb at chest height. You could climb flight 1 and
the landing and then go no further without jumping. It is now
`centre - sign * run / 2`. If the stair ever needs a jump again, walk it under
script (below) rather than guessing.

**The korkuluk.** The stair's **west** edge — x 2706 in first-floor px, with
no wall along it — is the open one. Since P.16 it carries the half-landing and
flight 2, so the iron balustrade runs round the landing's west edge at -1.70
and rakes up flight 2 to its arrival at -0.17. Flight 1 (east column) has the
spine on one side and the living room's west wall on the other, so it takes a
**wall-mounted handrail** (`wall: true`: handrail on brackets, no balusters,
no mid-rail) on the living room side, and flight 2 a second one on the spine,
which stops at the slab. The east column's head, the drop to the foot of
flight 1, has its own length of balustrade at y 1513. Railing path points may carry their own height as
a third element (`[px, py, y]`), which is what makes a rail rake; the balusters
stay plumb and a path with no heights behaves exactly as it always did.

**Walking the house under script.** `walk.update()` does nothing without the
pointer lock, which is why a scripted climb looks like the player is frozen.
`walk.hold(key, down)` and `walk.step(dt)` are the handles for this: hold `w`,
call `step` in a loop and read `walk.debug().pos`. Teleporting with `goTo` and
reading `probe()` is not a substitute — a climb can fail only while moving.

**The stairwell void must cover the half-landing, not just the flights.** The
first floor's `voids` entry runs to y 1738 (1942 before P.16's −204 shift). Stop it at the flights and that
slab becomes a ceiling 1.20 m above the landing: you can climb flight 1 and
then not stand up, and the stair hall — and its window — is cut in half. Do
not run it out to the wall centreline either (see `wallTop` below).

## Walk mode and the desktop app

`src/walk.js` turns the scene into somewhere you stand: WASD, mouse look,
shift to run, space to jump, C to crouch, Esc to release the mouse, `F` to
toggle back to the orbit view. It **reuses the scene as its collision world** —
nothing is re-modelled, so a door is walkable because it is a real gap in the
geometry and the stair is climbable because it is the stair traced from the
sheet. Only one model is walkable at a time (the others are hidden while you
are inside); `'stacked'` is the default because it is the real house.

Collision is raycast-based, not a physics engine:

- three horizontal rays (0.55 / 1.15 / 1.62 m above the feet) along the
  intended move; if blocked, the move is retried on each axis alone, which
  gives wall sliding. The lowest ray sits *above* `STEP_UP` on purpose:
  below that height geometry is something you step onto.
- one ray dropped from `STEP_UP` (0.45 m) above the feet finds the floor —
  slab, tread, terrace, lawn — so stairs need no special case.
- a step up is refused unless there is head room to stand there, or you climb
  the first sofa you meet and wedge your head in the ceiling. **Stairs are
  exempt**, because flight 2 climbs under the first-floor slab.

You move only while a key is held, and every route out of the keyboard (blur,
tab away, leaving pointer lock) clears the held keys — a lost `keyup` would
otherwise read as walking off on your own.

`walk.goTo([px, py], storey, heading, feetY)`, `walk.probe()`,
`walk.stairBounds()`, `walk.hold(key, down)` and `walk.step(dt)` are the
debugging handles, reachable from the console via `window.villa`. `heading` is
in **radians**, and the facing it gives is `(-sin θ, 0, -cos θ)` — so `Math.PI`
faces +Z. `probe()` names what is blocking you rather than leaving you to
guess from coordinates.

### The desktop app (macOS / Windows)

`desktop/main.cjs` is an Electron shell; `npm run app` runs it, `npm run dist:mac`
/ `dist:win` package it. The web app is unchanged and unbundled — the one thing
the desktop needs is an *origin*, because Chromium refuses ES modules and canvas
reads over `file://`. So it registers a privileged `villa://` scheme and serves
the project directory through it: identical to the dev server, with nothing
listening on a port. Files are read through `fs`, not a `file://` fetch, so a
packaged asar works.

There are two entry pages sharing `src/viewer.css`: `index.html` (orbit the
models, as before) and `walk.html`, which sets `window.VILLA_BOOT = 'walk'` so
main.js drops you inside the house. The desktop app opens `walk.html`.
`npm run bundle` emits a self-contained file for each.

## Known simplifications

- The ground floor has no roof of its own (stacked, the first floor's covers it); the first floor's flat roof follows the SketchUp massing — the sheet draws none.
- Window positions on the kitchen block's east elevation (ground) are approximate;
  the clearly dimensioned openings elsewhere are accurate.
- Storey height is a uniform 2.72 m of room on a 3.06 m floor-to-floor, from
  P.18's section A-A. The ground floor is level throughout at +0.34.
- **`wallTop`.** A storey with another above it sets `wallTop: PLAN.floorToFloor`
  so its walls run to the *underside* of that slab, not to the 3.0 m clear
  height (`buildWalls.js` reads `wall.height ?? floor.wallTop ?? storeyHeight`).
  The 0.4 m of structural slab would otherwise leave a band of open air above
  every wall — invisible from outside, because the slab fills it, but wherever
  a `void` removes the slab you can see straight out over the whole floor. The
  stairwell is exactly such a place, which is how it was found.
- The WhatsApp JPEG in `assets/` is a CAD screenshot of the **ground** floor, not
  the first; it adds nothing the main sheet does not already show.

## Controls

`F` walk inside (see below) · `drag` orbit · `scroll` zoom ·
`3`/`4` fit side-by-side / stacked model ·
`1`/`2`/`0` floor visibility · `5` both models / stacked only / side by side only ·
`T` top view · `R` refit · `X` x-ray walls · `O` hide roofs ·
`P` living-room projector screen · `E` (walk) flip the switch you look at ·
`U` every rolling shutter down / up ·
`K`/`J` time of day, forward and back · `L` night / all the lights ·
`N` hide the model name plates · `G` grid. Hovering a
wall shows its floor and name in the bottom-left readout.

`F`, `K`, `J`, `L`, `O`, `X`, `P`, `E` and `U` are the only keys that still work **inside**
walk mode — the rest would fight WASD, but changing the hour or the lights is
exactly what you want while standing in a room. (`walk.html` had long listed
`O` and `X`; before this they were swallowed by the guard.)
