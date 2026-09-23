# AGENTS.md

Instructions for coding agents (Codex, Claude Code, Cursor, or any other)
working on this repository.

`CLAUDE.md` is the full engineering guide and is **not** Claude-specific —
read it before changing any geometry, whichever agent you are. This file is
the short version plus the non-negotiables.

---

## What this project is

A Three.js viewer for a real house — **Villa Khan**. It lays the architect's 2D
floor plans down as ground textures and extrudes the walls, joinery and
furniture back out of them. Two storeys: `ZEMIN` (ground) and `BIRINCI KAT`
(first), drawn **twice** on screen: as separate models side by side, and — to
the east — stacked as the real building (plus a third model, the ground-floor
copy, west of the origin). The site is modelled too: a plot (`land`), a
boundary wall, a pool, a paved terrace and side parking.

It is also **walkable in first person** (`F`, or `walk.html`) and ships as a
**macOS / Windows desktop app** built on Electron. See *Walk mode and the
desktop app* in `CLAUDE.md`.

Plain ES modules, no bundler, no build step. `three` is reached through an
import map in `index.html` pointing at `node_modules/`.

## Setup

```bash
npm install     # three + pdfjs-dist; Node 18+
npm start       # http://localhost:8080  (node tools/serve.mjs)
npm run audit   # verify the model against the architect's PDF
npm run app     # the Electron desktop app (opens inside the house)
npm run bundle  # dist/*.html, one self-contained file per entry page
npm run dist:mac / dist:win   # packaged installers
```

The app **must** be served over HTTP — ES modules and the canvas read of the
plan JPEG both fail on a `file://` origin.

There is no test suite. `npm run audit` is the verification step; it must report
**`doors: 12/14 arcs matched`**. The two leftovers are the curved sofa in
OTURMA ODASI, not doors. The audit only checks the plan geometry, so also run
`node --check src/*.js` after editing the modules.

The owner has asked agents **not to open a browser — or the desktop app — on
their own**. Ask first, and otherwise say plainly that a visual change is
unverified on screen. This covers scripted Electron windows too: they steal
pointer lock and the keyboard from whatever the owner is doing, and one that
ends with `app.quit()` looks exactly like the app crashing.

Walk mode is the one part with behaviour a static read cannot verify. When you
do have permission to run it, drive it through `window.villa.walk`:
`goTo([px, py], storey, heading, feetY)` stands the player anywhere,
`probe()` names whatever is blocking a move, and `stairBounds()` dumps the
stair's real world heights. Compare a sampled heading against a sampled
velocity rather than assuming the camera still points where you left it —
under pointer lock the owner's real mouse steers it.

## The rules that matter

1. **`assets/VILLA KHAN 20092026.pdf` is the authoritative source for all
   geometry.** It is a true vector drawing. Read it with
   `node tools/plan-audit.mjs <x0> <y0> <x1> <y1>`, which dumps wall segments
   and text in a region of the sheet.

   Do **not** eyeball geometry off the JPEG. Pixel-tracing the raster put
   several doors in the wrong walls before the vector data corrected them.

2. **Coordinates are sheet pixels, not metres.** Walls, openings and furniture
   all live in the pixel space of the source drawing, which is what keeps them
   registered to the floor texture. To move something, change its pixel
   coordinates — never add a metre-space offset. See *The coordinate system* in
   `CLAUDE.md`.

3. **All geometry data lives in `src/floorplan.js`.** Add new object types as
   makers in `src/objects.js` keyed by `kind`; don't model one-offs inline.
   Two item flags matter for the dual view: `roof: true` puts an item on the `O`
   (hide roofs) toggle, and `only: 'stacked'` leaves it out of the side-by-side
   model, which is meant to be seen into from above. The tile roofs and the
   terrace roof are both stacked-only.

4. **Run `npm run audit` after any geometry change**, and re-render a visual
   overlay if a wall's position is in doubt.

5. **Don't re-derive the settled decisions.** `CLAUDE.md` has a
   *Departures from the sheet* section listing things the owner has corrected
   in person that the drawing does not show, and things that look wrong but are
   right. Re-deriving them from the PDF will reintroduce bugs the owner has
   already reported once.

## Things that bite

- **`src/groundCopy.js` is a deliberate duplicate** of the ground floor, drawn as
  a third model west of the origin, for experiments. Edit the copy, not the
  original, unless the owner says otherwise; the two are not linked. Plain bug
  fixes to shared data (a maker, a chair's orientation) are worth applying to
  both so the copy stays a copy.
- **Both models are built from the same data.** `main.js` calls `buildModel()`
  twice, so anything you add to a floor appears in both. Use `only:` to restrict.
- **The pool is sunk below the ground.** The ground `apron` in `main.js` and the
  `land` item each get a hole over it via `poolBasinPx()`; move the pool and the
  holes follow. Pool water and floor are unlit `MeshBasicMaterial` on purpose.
- **The first floor's slab is clipped** to its `outline`; without that its empty
  crop hides the ground floor when stacked.
- **`buildObjects` positions by `rect`, elevation by `z`** (an item's height
  offset is `y` inside its own maker but `z` on the item for the group).
- **Walls stop below the floor above unless you say otherwise.** A storey with
  another above it needs `wallTop: PLAN.floorToFloor`, or its 3.0 m walls leave
  a 0.4 m band of open air under the 3.40 m slab. The slab hides it — until a
  `void` removes the slab and you can see straight out over the floor.
- **A `void` must not reach a wall centreline.** Stop it at the wall's inner
  face, or that same 0.4 m band becomes an open slot to the sky.
- **The stairwell void has to cover the half-landing**, not just the flights,
  or the slab is a ceiling 1.30 m above the landing and the stair is unusable.
- **Walk mode collides with the real geometry.** Anything you model is
  something the owner can bump into, stand on or get stuck inside, so a
  decorative box across a doorway is now a wall. There is a head-room test that
  stops the player climbing furniture; stairs are exempt from it.

## Reading the PDF correctly

The one trap that has caused the most rework:

> **A door leaf in an architectural plan is drawn in its OPEN position**,
> perpendicular to its wall. A leaf drawn as a vertical bar therefore belongs to
> a *horizontal* wall, and vice versa.

A door is a 90° bezier arc: its centre is the hinge and its radius is the leaf
width. Of the arc's two endpoints, the one lying **along** a wall is the closed
leaf — that span is the opening. Confirm against the wall faces: a real opening
shows up as a **gap between collinear runs of wall-face lines**.

Windows have no arc. Find them by their dimension text (e.g. `210` over `110`),
which sits at the opening's centre, offset 10–25 px off the wall.

Full details, including the pdfjs path encoding, are in `CLAUDE.md` under
*Verifying a trace change*.

## Working with the owner

The owner knows the building and the agents do not. When they say something is
in the wrong place, they are usually right — check the PDF rather than
defending the current model. When they describe something the drawing does not
show (this sheet revision is one of many), model it on their word and record it
under *Departures from the sheet* in `CLAUDE.md` with a comment at the
definition site.

Turkish room names are used throughout and should be kept as-is: `MUTFAK`
(kitchen), `Y.MUTFAK KILER` (auxiliary kitchen / pantry), `ANA KORIDOR` (main
corridor), `GIRIS HOLU` (entrance hall), `OTURMA ODASI` (living room), `GARAJ`,
`YATAK ODASI` (bedroom), `EBEVEYN` (master), `D.ODASI` (dressing room),
`ÇAMSIR ODASI` (laundry), `GALERI BOSLUGU` (stairwell void), `BALKON TERASI`,
`TEZGAH` (worktop), `VESTIYER` (coat cupboard), `OCAK` (hob), `FIRIN` (oven),
`HAVUZ` (pool), `ŞEZLONG` (sun lounger), `TAŞMA KANALI` (pool overflow channel).

`D.ODASI` is *Dolap Odası*, a dressing room — never a bathroom.
