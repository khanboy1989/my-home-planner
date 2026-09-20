# my-home-planner

## Read this first, every session

**`assets/VILLA KHAN 20092026.pdf` is the authoritative source for all
geometry — check it before touching `src/floorplan.js`, and re-check it
whenever the owner reports something is in the wrong place.**

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
`floorplan.js`. It should report **12/14 arcs matched**; the two leftovers are
the curved sofa in OTURMA ODASI, not doors. If it reports anything else, the
model has drifted from the drawing — fix the model, not the audit.

The PDF is also revised often (the sheet lists a dozen P.n dates). If the owner
supplies a newer one, re-run the audit before assuming anything still holds,
and reconcile the **Departures from the sheet** section below.

---

3D viewer for **Villa Khan** — a Three.js scene that lays the architect's 2D floor
plans down as ground textures and extrudes the walls back up out of them.

Both storeys on the sheet are modelled: **ZEMIN** (ground) and **BIRINCI KAT**
(first). By default they render as two separate models side by side; `L` switches
to stacking them in their real relative positions.

## Stack

Plain ES modules, no bundler. `three` is installed from npm and reached through an
import map in `index.html` pointing at `node_modules/`. Anything that serves the
folder over HTTP works — `npm start` runs `python3 -m http.server 8080`.

## Layout

| Path | What it is |
| --- | --- |
| `assets/` | Source drawings. `VILLA KHAN 20092026_page-0001.jpg` is the full sheet (3509×2482) and the only one the app reads. The WhatsApp JPEG is a CAD screenshot kept for reference. |
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

The first floor's `alignPx` of `(-1762, +1)` was derived by matching structural
walls the two plans share — the north block's west and east walls and the
living/master block's north wall all land within ~5 px (<0.1 m) of each other.
That alignment is what makes the `stacked` layout meaningful, so preserve it even
though the default view puts the floors apart.

`metersPerPixel = 0.0168` was calibrated against the `K1:100/230` doors (1.00 m
clear opening) and cross-checked against `GARAJ 42.00 m²`. The drawing's printed
room areas reconcile to within roughly ±10%; the trace follows the drawn geometry
rather than the printed numbers where they disagree.

## Layout modes

`placement(floor, mode)` in `floorplan.js` is the single source of truth:

- `'apart'` (default) — every storey sits on the ground, stepped along +X by
  `ORIGIN.w + GAP_PX`.
- `'stacked'` — storeys in their true positions, `storey * storeyHeight` up.

Geometry is built **once** at each floor's true alignment and wrapped in a
container; switching modes only moves containers. Don't bake layout offsets into
the geometry, or the toggle stops being free.

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

1. **Bedroom → EBEVEYN D.ODASI glazed slider**, black joinery. Parks westward so
   the leaf clears both the DUS W.C door and the wardrobe run; the wardrobe was
   shortened to the east end for the same reason.
2. **Window joinery is black** throughout, as is the slider.

Settled questions — do not re-litigate these without new instruction:

- **There is no door through the Y.MUTFAK / garage party wall** (y=1586). That
  wall is straight and solid. It carries the EV charger and one continuous
  tezgah, the full width of the garage, for unloading shopping.
- **The garage's only internal door is the `K1:100/230` into ANA KORIDOR**, in
  the horizontal wall at y=1624 (x 727..783) at the garage's stepped north-east
  corner — reached up the right-hand side of the right-hand car, directly
  opposite. From ANA KORIDOR you then reach Y.MUTFAK KILER via its `K1:80/230`.
- **The main entrance is into GIRIS HOLU**, through the `K1:100/230` in the wall
  at y≈1878 off GIRIS TERASI. The W.C block's south wall carries a 210/110
  **window**, not a door.

If the plan is revised, reconcile these first — they are the parts a fresh trace
would not reproduce.

## The stair

Modelled once, in full, on the **ground** floor — a switchback, `MÜ: 20 (17x30)`:
flight 1 rises south (treads 1–9) at x 1033..1108, a half-landing at 1.70 m,
then flight 2 rises north (treads 10–18) at x 946..1021, and a final riser
lands at 3.40 m, exactly the floor-to-floor. The first floor carries a matching
`Stair well` void so the flight arrives through the slab when stacked.

Flight 2 passes over the W.C, so two things keep them out of each other: the
flight is `solid: false` (treads and risers only, open soffit) and the W.C walls
carry `height: 2.3`. Don't make either of them solid/full-height again.

## Known simplifications

- The roof is not modelled.
- Window positions on the kitchen block's east elevation (ground) are approximate;
  the clearly dimensioned openings elsewhere are accurate.
- Storey height is a uniform 3.0 m of wall with a 3.40 m floor-to-floor (from the
  stair note `MÜ: 20 (17x30)`). No floor-level changes — the ground plan has a
  `+0.34` step at `ANA KORIDOR`.
- The WhatsApp JPEG in `assets/` is a CAD screenshot of the **ground** floor, not
  the first; it adds nothing the main sheet does not already show.

## Controls

`drag` orbit · `scroll` zoom · `L` side-by-side/stacked · `1`/`2`/`0` floor
visibility · `T` top view · `R` refit · `X` x-ray walls · `G` grid. Hovering a
wall shows its floor and name in the bottom-left readout.
