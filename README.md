# Villa Khan — 3D Floor Plan

A Three.js viewer that uses the architect's 2D drawings as ground textures and
extrudes the walls up out of them.

Both storeys are modelled — **ZEMIN** (ground) and **BIRINCI KAT** (first). They
render side by side as two separate models; press `L` to stack them into the real
building instead.

## Run

```bash
npm install     # once — pulls in three
npm start       # python3 -m http.server 8080
```

Then open <http://localhost:8080>.

It must be served over HTTP (ES modules + the canvas crop of the JPEG both need a
real origin); opening `index.html` from the filesystem will not work.

## Controls

| | |
| --- | --- |
| drag | orbit |
| scroll | zoom |
| `L` | side by side / stacked |
| `1` `2` `0` | ground only / first only / both |
| `T` | top view |
| `R` | refit view |
| `X` | x-ray walls |
| `G` | grid |

Hover a wall to see its floor and name in the bottom-left readout.

## Editing the plan

All geometry lives in `src/floorplan.js` as wall centrelines expressed in pixels
of the source drawing, so edits stay aligned with the texture automatically. See
`CLAUDE.md` for the coordinate system and conventions.
