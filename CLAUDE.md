# my-home-planner

## Read this first, every session

**`assets/VILLA KHAN 24092026.pdf` (P.14, `PLAN.pdf`) is the authoritative
source for all geometry — check it before touching `src/floorplan.js`, and
re-check it whenever the owner reports something is in the wrong place.**
The P.13 sheet (`VILLA KHAN 20092026.pdf`) is kept only because
`groundCopy.js` is still a P.13 experiment.

It is a true vector drawing, so walls, door swings and dimensions can be read
*exactly*. The JPEG is only a raster of the same sheet, used at runtime as the
floor texture. Never eyeball geometry off the JPEG when the PDF can answer the
question — pixel-tracing the raster produced several wrong doors that the
vector data then corrected.

```bash
npm run audit                                   # reconcile doors + list windows
node tools/plan-audit.mjs 780 1690 1140 2040    # dump wall segments in a box
```

`npm run audit` cross-checks every door arc in the PDF against the openings in
`floorplan.js`. It should report **17/21 arcs matched**; the four leftovers are
the two curved sofas (OTURMA ODASI and OYUN ODASI), not doors. (Garden trees
are drawn as r≈32 px arcs and are filtered out by radius.) If it reports
anything else, the model has drifted from the drawing — fix the model, not the
audit.

The PDF is also revised often (the sheet lists fourteen P.n dates). If the
owner supplies a newer one:

1. Render both sheets and diff them — a revision can be **re-plotted** at a
   different scale and position on the page, not just edited (P.14 came out
   1.6% larger and shifted). Fit `new = k·old + t` on room labels that did not
   move (`getTextContent()` positions); a clean replot fits to < 0.5 px.
2. Put the fit in `PLAN.pdfToSheet` and the file in `PLAN.pdf`, then
   `node tools/render-sheet.mjs` re-renders `PLAN.image` **into the model's
   existing pixel frame**, so unchanged walls stay registered and
   `metersPerPixel` still holds. The audit reads through the same transform.
3. Re-run the audit, overlay the walls on the new texture, and reconcile the
   **Departures from the sheet** section below.

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
| `assets/` | Source drawings. `VILLA KHAN 24092026_page-0001.jpg` is the P.14 sheet rendered into the model frame (3509×2482, `tools/render-sheet.mjs`) and is what the app reads; `…20092026_page-0001.jpg` is P.13, read only by the ground-floor copy. The WhatsApp JPEG is an old CAD screenshot kept for reference. |
| `index.html` | Shell, HUD, import map. |
| `src/floorplan.js` | **The data.** Per-floor crop, alignment, every wall centreline + opening, and the furniture schedule. |
| `src/buildWalls.js` | Turns one floor's wall data into geometry, including door and window joinery. |
| `src/objects.js` | Furniture/fixture makers, keyed by `kind`. |
| `src/main.js` | Scene, camera, lights, slab textures, layout, interaction. |

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

The first floor's `alignPx` of `(-1763, -204)` was derived from P.14's wall
faces — the kitchen block / north block north walls and the living room /
master suite north and east walls agree to 1 px. (It was `(-1762, +1)` under
P.13; P.14 moved the ground-floor house 3.4 m north on the plot.) That
alignment is what makes the `stacked` layout meaningful, so preserve it even
though the default view puts the floors apart.

`main.js` centres each floor's slab on its container, so **`crop.xy + alignPx`
must equal `ORIGIN.xy` for every floor** — move `ORIGIN` when the ground floor
moves (it is `{384, 975}` now), and derive `alignPx` from it for any other.

`metersPerPixel = 0.0168` was calibrated against the `K1:100/230` doors (1.00 m
clear opening) and cross-checked against `GARAJ 42.00 m²`. The drawing's printed
room areas reconcile to within roughly ±10%; the trace follows the drawn geometry
rather than the printed numbers where they disagree.

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

1. **Bedroom → EBEVEYN D.ODASI glazed slider**, black joinery. P.14 now draws
   the opening (x 3069..3118); the slider fills it. Parks westward so the leaf
   clears both the DUS W.C door and the wardrobe run, whose west leg starts at
   y 1868 for the same reason.
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
5. **İÇBAHÇE TERASI (ground, east of the kitchen, 60 m²)** is under a flat oak
   roof (a `paving` slab, `y: 2.65`, leaning on the kitchen and living walls,
   cantilevering past the free edges, black posts) — in the stacked model
   only, like the tile roofs. Under it: dining table + six chairs, a timber
   planter, potted topiary, and a rubble-stone barbecue at the open north edge
   beside the kitchen, whose flue passes up through the roof (the kitchen's
   300/230 window fills its east wall). `O` hides the roof (any `paving` item
   with `roof: true`). The pool (HAVUZ) is from the sheet — P.14 moved it 1 m
   west and 3.7 m north — and carries its own deck and shell. P.14 dropped the
   ŞEZLONG loungers; the four are kept on the wide paved deck west of the
   pool, with a parasol between each pair. The pool water and floor use unlit
   `MeshBasicMaterial` so the house's shadow can't blacken them. The basin is
   sunk below the ground `apron` in `main.js`, which therefore has a hole cut
   over the pool (`poolBasinPx()` in `objects.js`) — move the pool and the hole
   follows.
6. **(Retired with P.14.)** The garage and its white roller shutter are gone:
   P.14 turned the garage into ÇALIŞMA ODASI, OYUN ODASI and a W.C.
7. **The family's cars — a Mercedes-Benz C220 d** (graphite) **and a
   Mitsubishi L200 double-cab pickup, 2018** (white), built by the `sedan` and
   `pickup` makers at their real sizes — stand in the two open parking bays
   P.14 draws in front of the west wing, nose to the house.
8. **Black tile roofs** — the sheet draws none (the old "roof is not modelled"
   note no longer holds for BIRINCI KAT). Four `hiproof` items sit on the first
   floor's blocks (`roof: true`, eaves at 3.0 m), in charcoal S-tile after the
   owner's photo, **only in the stacked model** (`only: 'stacked'`) — the
   side-by-side floors stay open so you can look into them from above. Stacked,
   they cover the ground floor too. `O` hides every `roof: true` item.
9. **The plot.** A `land` item (lawn) fills the site boundary — the inner line
   of the double line round the site on the sheet, corners (254,161) (1643,530)
   (1590,2294) (224,2209). The owner's figure is 726 m²; at `metersPerPixel`
   the polygon measures ~744 m² (the outer line ~773 m²), so it is within the
   scale calibration. It is cut away over the pool basin.
10. **Plot wall and front gates.** A 2 m × 0.2 m boundary wall runs on the plot
    line (same four corners as the `land` item). The street is the south edge.
    It has the two openings P.14 draws (black-lined `gate` openings, each with
    a black bar gate object — `gate` kind, `streetGate()` in `floorplan.js`): a
    6.2 m opening onto the parking bays (x 420..792, a concrete pad between two
    1 m low walls) with a bi-parting sliding gate, drawn closed; and a 2.1 m
    opening onto the paved path up to GIRIS (x 807..931) with a pedestrian gate
    swung open 70° inward. P.14's hatched areas are one `paving` patio round the
    house and pool, with `holes` for both; the rest of the plot is lawn.
11. **Laminate parquet floors** in the living areas (`parquet` rects on each
    floor). `cropTexture()` in `main.js` multiplies a plank pattern over the
    plan, so printed lines and labels survive. Kitchens included; only the
    W.Cs, showers, laundry, DEPO and the stair stay plain. Interiors are never grass: the `land` sits *under* the
    slabs.
12. **Exotic fruit planting** just inside the plot wall: date and papaya palms,
    banana clumps, and mango / fig / pomegranate / orange / lemon / avocado
    trees (`PLANTING` in `floorplan.js`; `palm`, `banana` and `fruittree`
    makers). Only in the lawns P.14 draws — the north strip, the east and front
    gardens, the strip beside the parking — clear of the gates, path and patio.
13. **Floor slab body.** Storeys are 3.0 m of wall on a 3.40 m floor-to-floor, so
    an upper floor gets a 0.4 m structural slab under it (`slabBody()` in
    `main.js`, same outline and voids) and the walls below meet it with no gap.
14. **OTURMA ODASI restyle** after the owner's reference photo: cream and gold.
    Media wall on the east wall (`tvwall`: backlit niches, one floating unit,
    TV above, `fireplace: false`) and a **ceiling-hung fireplace** (`hangingfire`,
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
15. **Ground-floor copy** (branch `feature/ground-floor-copy`). `src/groundCopy.js`
    is a **P.13** experiment: it keeps the P.13 sheet (`image`), its own crop,
    and an `alignPx` that carries it into the shared frame, and was not
    re-traced to P.14. It is a full, independent source copy of the ground floor — walls, plot, planting,
    gates, objects, parquet — drawn as a third model 30 m west of the origin (key
    `5` fits it). It exists to try changes without touching the original; edit it
    freely. Changes made only there so far: the kitchen's **appliance wardrobe**
    (`appliancenook`), the east 1.6 m of the south run, hiding a coffee machine,
    kettle, toaster and microwave behind pocket doors; both kitchens' **west
    doors** onto a cement service path down to the parked cars; and the
    **garage split in three**. GARAJ (41.4 m² at this scale) is cut by a
    partition at x=575 into a 24 m² single-bay closed garage to the east and a
    2.74 m strip to the west, itself halved at y=1810 into a games / library
    room (north: bookshelves, PC desk under the window, TV for the
    PlayStation, sofa) and the son's play room (south), ~9 m² each — not the
    12 + 12 asked for, which does not fit alongside 24. The play room is laid
    out for a toddler — a foam `playmat` floor, `rockinghorse`, `teepee`,
    `ballpit`, `blocks`, `teddy` and toddler-height `toyshelf` cubbies, all new
    makers in `objects.js` on a `TOY_COLOURS` palette — with no hard edge above
    knee height and the west window left clear. Both rooms open off
    the garage; the Y.MUTFAK party wall stays solid. The roller shutter was
    narrowed to the bay, the worktop to the bay's width, the Mercedes centred
    in it and the L200 moved out to the side parking strip. The plan texture
    still prints `GARAJ 42.00 m²` across all three.
    Each model has a colour-coded name plate in front of it (blue side by side,
    green stacked, orange copy; `LABELS` in `main.js`, `N` toggles) and the hover
    readout ends with the model's name.

16. **Dining → back garden slider.** The sheet draws a 250/230 window in the
    kitchen block's north wall behind the dining table; on the owner's
    instruction it is a glazed slider to the floor instead, out to the pool
    terrace. It keeps the drawn opening (x 754..909, 2.60 m — already centred
    on the table) and only drops its sill to 0. Black joinery, parking east so
    the leaf lands on solid wall rather than across the other window. Applied
    to `groundCopy.js` too, so the copy stays a copy.
17. **The dining chairs face the table.** Each carries a `rot` (degrees
    clockwise on the page; the `chair` maker backs a chair north at 0), so the
    west run is 270, the east run 90 and the ends 0 and 180. Without it all
    eight faced north and the two runs sat back to back. The maker builds a
    real chair — legs, seat, open backrest — rather than the solid block it
    used to be, which at eye level read as a crate.

Settled questions — do not re-litigate these without new instruction:

- **P.14 has no garage** and no EV charger / unloading tezgah; the cars park
  outside. (The P.13 garage questions still apply to `groundCopy.js` only.)
- **The main entrance is into GIRIS HOLU**, through the `K1:180/230` double
  door in the wall at y 1747 off GIRIS TERASI, both leaves opening inward.
  East of it the same wall carries the stair's 210/110 **window**, not a door.
- **GIRIS HOLU is double height**: the first floor's GALERI BOSLUGU is the
  void above it, and the stair is open to it along x 943 (a drawn edge, not a
  wall).
- **The kitchen block's doors:** MUTFAK ↔ ANA KORIDOR is a `K1:180/230` double
  door at y 1303; MUTFAK ↔ Y.MUTFAK KILER a `K1:90/230` in the thin partition
  at y 1253 (x 738..788); KILER has its own `K1:90/230` service door out to
  the west (y 1309..1365).
- **ORTAK W.C opens onto ANA KORIDOR**, through the `K1:80/230` in its **east**
  wall (gap at y 1557..1612). There is **no** door between the W.C and ÇAMSIR
  ODASI — that shared wall is solid.
- **GIRIS HOLU has no coat room.** The block at x 770..807, y 1516..1724 on its
  west side is a freestanding **vestiyer/dolap** facing the hall — no door.

If the plan is revised, reconcile these first — they are the parts a fresh trace
would not reproduce.

## The stair

Modelled on the **first** floor, not the ground floor — BIRINCI KAT is the plan
that draws the whole flight, and the ZEMIN plan only draws treads 1–12 (which
stay part of the texture). It hangs off the first-floor slab and descends:
levels in its `stairs` items are relative to that slab, so `from: -3.40` is
ground level. Flight 1 rises south (treads 1–9) in the **west** column,
x 2709..2784, a half-landing at -1.70 m, then flight 2 rises north (treads
10–18) in the east column, x 2796..2870, and a final riser lands at 0 — the
first floor slab, exactly 3.40 m above grade. (P.14 swapped the columns; in
P.13 flight 1 was the east one.) DEPO, the ground floor's store, is under the
top of flight 2, so its walls stop at 3.2 m (north) and 2.1 m (south).

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
and 1033..1108, ground px) with DEPO under the top of the east one. The
ground floor's W.C is now the one in the west wing.

Flight 2 stays `solid: false` (treads and risers only, open soffit), because
DEPO is under it.

**The stairwell void must cover the half-landing, not just the flights.** The
first floor's `voids` entry runs to y 1942. Stop it at the flights and that
slab becomes a ceiling 1.30 m above the landing: you can climb flight 1 and
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

`walk.goTo([px, py], storey, heading, feetY)`, `walk.probe()` and
`walk.stairBounds()` are the debugging handles, reachable from the console via
`window.villa`. `probe()` names what is blocking you rather than leaving you to
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

- The ground floor has no roof of its own (stacked, the first floor's covers it); the first floor's four hip roofs are approximate — the sheet draws none.
- Window positions on the kitchen block's east elevation (ground) are approximate;
  the clearly dimensioned openings elsewhere are accurate.
- Storey height is a uniform 3.0 m of wall with a 3.40 m floor-to-floor (from the
  stair note `MÜ: 20 (17x30)`). No floor-level changes — the ground plan has a
  `+0.34` step at `ANA KORIDOR`.
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
`3`/`4`/`5` fit side-by-side / stacked / ground-copy model ·
`1`/`2`/`0` floor visibility · `T` top view · `R` refit · `X` x-ray walls · `O` hide roofs · `N` hide the model name plates · `G` grid. Hovering a
wall shows its floor and name in the bottom-left readout.
