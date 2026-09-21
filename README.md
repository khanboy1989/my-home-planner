# Villa Khan — 3D Floor Plan

A Three.js viewer that uses the architect's 2D drawings as ground textures and
extrudes the walls, joinery and furniture back out of them.

Both storeys are modelled — **ZEMIN** (ground) and **BIRINCI KAT** (first). They
are drawn twice: as two separate models side by side, and — a little way east — as
the real building with the first floor stacked on the ground floor.

---

## Running it on a new machine

### 1. Requirements

- **Node.js 18 or newer** — that's the only prerequisite. Check with `node -v`.
  Get it from [nodejs.org](https://nodejs.org) or a version manager (`nvm`,
  `fnm`, `volta`).
- A modern browser (Chrome, Edge, Firefox or Safari). The scene uses WebGL 2.

No Python, no bundler, no build step.

### 2. Clone and install

```bash
git clone git@github.com:khanboy1989/my-home-planner.git
cd my-home-planner
npm install
```

If you don't have SSH keys set up on that machine, use HTTPS instead:

```bash
git clone https://github.com/khanboy1989/my-home-planner.git
```

`npm install` pulls two packages: `three` (the renderer) and `pdfjs-dist`
(used only by the audit tool, not by the app).

### 3. Run

```bash
npm start
```

Then open **<http://localhost:8080>**.

To use a different port: `npm start -- 3000`, or set `PORT=3000`.

> **It must be served over HTTP.** Opening `index.html` directly from the
> filesystem will not work — the page uses ES modules and reads the plan JPEG
> into a canvas, and a `file://` origin blocks both. If you see a blank screen,
> check you went to `localhost`, not a `file:///…` path.

### 4. Check the model still matches the drawing

```bash
npm run audit
```

Expect **`doors: 12/14 arcs matched`**. The two unmatched arcs are the curved
sofa in OTURMA ODASI, which isn't a door. Anything else means the model has
drifted from the architect's PDF.

### Troubleshooting

| Symptom | Cause |
| --- | --- |
| Blank page, console shows `Failed to resolve module specifier "three"` | `npm install` hasn't been run, or you opened the file directly instead of via `localhost`. |
| `Could not load the floor plan image` | Same — serve over HTTP. |
| `EADDRINUSE` on start | Port 8080 is taken. `npm start -- 8081`. |
| `npm run audit` errors on `pdfjs-dist` | Dev dependency missing: `npm install`. |

---

## Controls

| | |
| --- | --- |
| drag | orbit |
| scroll | zoom |
| `3` `4` `5` | fit the side-by-side plans / the stacked model / the ground-floor copy |
| `1` `2` `0` | ground only / first only / both |
| `T` | top view |
| `R` | refit view |
| `X` | x-ray walls |
| `O` | hide the roofs |
| `N` | hide the model name plates |
| `G` | grid |

Hover a wall, a door or a piece of furniture to see its floor and name in the
bottom-left readout.

---

## How it fits together

| Path | What it is |
| --- | --- |
| `assets/` | The architect's drawings. The **PDF is the authoritative source** for all geometry; the JPEG is a raster of the same sheet used as the floor texture at runtime. |
| `index.html` | Page shell, HUD, and the import map that points `three` at `node_modules/`. |
| `src/floorplan.js` | **All the data** — wall centrelines, openings, and the furniture schedule for both floors. |
| `src/buildWalls.js` | Extrudes walls; builds door leaves, window frames and glazing. |
| `src/objects.js` | Furniture and fixture makers, keyed by `kind`. |
| `src/main.js` | Scene, camera, lighting, slab textures, layout, picking. |
| `tools/plan-audit.mjs` | Reconciles the model against the PDF's vector geometry. |
| `tools/serve.mjs` | The static server behind `npm start`. |

Geometry is stored in **pixels of the source drawing**, not metres, so walls and
furniture stay registered to the plan texture underneath them automatically.

## Editing the plan

Everything lives in `src/floorplan.js`. Before changing any geometry, read
**[`CLAUDE.md`](CLAUDE.md)** — it documents the coordinate system, how to read
the PDF, and the decisions that a fresh trace would get wrong. Coding agents
should start at **[`AGENTS.md`](AGENTS.md)**.
