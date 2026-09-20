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
(first).

Plain ES modules, no bundler, no build step. `three` is reached through an
import map in `index.html` pointing at `node_modules/`.

## Setup

```bash
npm install     # three + pdfjs-dist; Node 18+
npm start       # http://localhost:8080  (node tools/serve.mjs)
npm run audit   # verify the model against the architect's PDF
```

The app **must** be served over HTTP — ES modules and the canvas read of the
plan JPEG both fail on a `file://` origin.

There is no test suite. `npm run audit` is the verification step; it must report
**`doors: 12/14 arcs matched`**. The two leftovers are the curved sofa in
OTURMA ODASI, not doors.

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

4. **Run `npm run audit` after any geometry change**, and re-render a visual
   overlay if a wall's position is in doubt.

5. **Don't re-derive the settled decisions.** `CLAUDE.md` has a
   *Departures from the sheet* section listing things the owner has corrected
   in person that the drawing does not show, and things that look wrong but are
   right. Re-deriving them from the PDF will reintroduce bugs the owner has
   already reported once.

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
`TEZGAH` (worktop), `VESTIYER` (coat cupboard), `OCAK` (hob), `FIRIN` (oven).
