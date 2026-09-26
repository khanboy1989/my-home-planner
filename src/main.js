import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLAN, ORIGIN, FLOORS, placement, toWorld } from './floorplan.js';
import { buildWalls } from './buildWalls.js';
import { LightPool, emitter } from './lights.js';
import { buildObjects, poolBasinPx } from './objects.js';
import { createWalkMode } from './walk.js';

const app = document.getElementById('app');
const statusEl = document.getElementById('status');
const timeEl = document.getElementById('time-of-day') ?? { textContent: '' };
const layoutEl = document.getElementById('layout-mode');

const MPP = PLAN.metersPerPixel;
const PLANE_W = ORIGIN.w * MPP;
const PLANE_H = ORIGIN.h * MPP;

// Both models are always on screen: the floors side by side at the origin,
// and a second copy with the first floor stacked on the ground floor, to the
// east of it. STACK_DX clears the right-hand edge of the side-by-side row.
const STACK_GAP_M = 8;
const STACK_DX = (2 * ORIGIN.w + 149) * MPP + STACK_GAP_M;

// ── the first-floor band ────────────────────────────────────────────────
// Stacked, the first floor's slab edge is pulled out past the facade into a
// band, and the downlights are recessed into its soffit. Not on the sheet —
// the owner's instruction. The outline runs on the exterior wall centrelines,
// so the offset has to clear half a wall before the band starts to show.
const BAND_PROUD = 0.12;
const BAND_OFFSET = PLAN.thickness.exterior / 2 + BAND_PROUD;
const LIGHT_SPACING = 3.4;  // metres between fixtures along the band
const LIGHT_INSET = 0.05;   // back from the band's outer edge, so the spot sits under it

// Each entry: [set, sideways offset, placement mode, floors to build].
const LAYOUTS = [
  ['apart', 0, 'apart', FLOORS],
  ['stacked', STACK_DX, 'stacked', FLOORS],
];

// ── renderer ────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
/**
 * Resolution is adaptive (see the animation loop). MAX_DPR is the cap on a
 * retina screen; the loop walks down towards MIN_DPR when frames run long,
 * which is what keeps night — 21 spot lights on top of the sun — smooth on an
 * integrated GPU. Day usually sits at the cap.
 */
const MAX_DPR = Math.min(window.devicePixelRatio, 2);
const MIN_DPR = Math.min(window.devicePixelRatio, 1);
let dpr = MAX_DPR;
renderer.setPixelRatio(dpr);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
/**
 * Nothing in the scene moves — the sun is fixed and the geometry is static —
 * so the 4096x4096 shadow map does not need re-rendering every frame. It is
 * rendered on demand instead: `invalidateShadows()` after the build and after
 * anything that changes what casts (floor visibility, roofs, x-ray, walk mode).
 * That takes a full depth pass over both models out of the frame budget.
 */
renderer.shadowMap.autoUpdate = false;
function invalidateShadows() { renderer.shadowMap.needsUpdate = true; }
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

// ── scene ───────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11151b);
scene.fog = new THREE.Fog(0x11151b, 70, 190);

const camera = new THREE.PerspectiveCamera(
  45, window.innerWidth / window.innerHeight, 0.1, 800,
);
const HOME = { pos: [12, 26, 34], target: [9, 0, 0] };
camera.position.set(...HOME.pos);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(...HOME.target);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.minDistance = 3;
controls.maxDistance = 160;

// ── lighting ────────────────────────────────────────────────────────────
const hemi = new THREE.HemisphereLight(0xbcd6ff, 0x6b6257, 1.1);
scene.add(hemi);

/**
 * The sun sits over the real south-east, a late-morning sun. The sheet's "up"
 * is not compass north: on the ground the pool side (the model's -Z, up the
 * page) faces **east** and the entrance and parking side (+Z) faces **west**,
 * which makes the model's +X real south. So -Z + X is sunrise-ish, and the
 * light lands on the pool, the terrace and the İÇBAHÇE, throwing the house's
 * shadow back over the parking where it belongs rather than across the water.
 */
const sun = new THREE.DirectionalLight(0xfff3e0, 2.4);   // setTime() drives both
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0005;
const d = STACK_DX + PLANE_W; // the shadow frustum has to reach every model
Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 1, far: 200 });
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun);
const ambient = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(ambient);

// Ground the whole composition sits on. Each pool basin is sunk below it, so
// the apron gets a hole over each or it would hide the water and pool floor.
function apronGeometry() {
  const dxs = LAYOUTS.map(([, dx]) => dx);
  const [lo, hi] = [Math.min(...dxs), Math.max(...dxs)];
  const w = PLANE_W * 8 + (hi - lo);
  const h = PLANE_H * 6;
  const cx = (lo + hi) / 2;
  const shape = new THREE.Shape([
    new THREE.Vector2(cx - w / 2, -h / 2), new THREE.Vector2(cx + w / 2, -h / 2),
    new THREE.Vector2(cx + w / 2, h / 2), new THREE.Vector2(cx - w / 2, h / 2),
  ]);
  for (const [, dx, , floors] of LAYOUTS) {
    const pool = floors.find((f) => f.storey === 0)?.objects.find((o) => o.kind === 'pool');
    if (!pool) continue;
    const ground = floors.find((f) => f.storey === 0);
    const [x0, y0, x1, y1] = poolBasinPx(pool.rect);
    // Shape +Y is world -Z once the apron is laid flat, hence the flip.
    const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
      .map((c) => toWorld(c, ground.alignPx))
      .map(([x, z]) => new THREE.Vector2(x + dx, -z));
    shape.holes.push(new THREE.Path(corners));
  }
  return new THREE.ShapeGeometry(shape);
}

const apron = new THREE.Mesh(
  apronGeometry(),
  new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 1 }),
);
apron.rotation.x = -Math.PI / 2;
apron.position.y = -0.02;
apron.receiveShadow = true;
scene.add(apron);

/**
 * The sheet holds both plans plus a title block, so each floor blits just
 * its own rectangle into a canvas and uses that as its slab texture. Wall
 * coordinates are in the same sheet pixels, which is what keeps the
 * extrusions registered to the drawing.
 */
// A floor may name its own `image` if it was traced from a different sheet;
// everything else uses PLAN.image, which is the current revision.
const sheets = new Map();
try {
  const images = new Set([PLAN.image, ...LAYOUTS.flatMap(([, , , floors]) => floors.map((f) => f.image ?? PLAN.image))]);
  await Promise.all([...images].map(async (src) => {
    sheets.set(src, await new THREE.ImageLoader().setCrossOrigin('anonymous').loadAsync(encodeURI(src)));
  }));
} catch (err) {
  document.getElementById('loading').textContent =
    'Could not load the floor plan image — serve this folder over HTTP.';
  throw err;
}

/**
 * Laminated oak parquet as a repeating pattern, drawn in sheet pixels: planks
 * 0.19 m wide and 1.3 m long (11 × 77 px at 0.0168 m/px), laid in staggered
 * rows with a slightly different tone per plank and a dark joint line.
 */
function parquetPattern(ctx) {
  const rowH = 11;
  const plankL = 77;
  const rows = 14;
  const tile = document.createElement('canvas');
  tile.width = plankL * 2;
  tile.height = rowH * rows;
  const t = tile.getContext('2d');
  const tones = ['#dcbb8f', '#d3b083', '#e2c398', '#cfa97b', '#d9b688'];
  for (let r = 0; r < rows; r++) {
    for (let i = -1; i < 3; i++) {
      const px = i * plankL + ((r * 37) % plankL);   // staggered end joints
      // Tone repeats every two planks, matching the tile width, so it wraps cleanly.
      t.fillStyle = tones[(r * 3 + (((i % 2) + 2) % 2) * 7) % tones.length];
      t.fillRect(px, r * rowH, plankL, rowH);
      t.fillStyle = 'rgba(70,40,15,0.45)';
      t.fillRect(px, r * rowH, 1, rowH);             // end joint
    }
    t.fillStyle = 'rgba(70,40,15,0.35)';
    t.fillRect(0, r * rowH, tile.width, 1);          // long joint
  }
  return ctx.createPattern(tile, 'repeat');
}

/**
 * Bakes the floor's plan crop into a canvas. Rooms listed in `floor.parquet`
 * get laminate oak *multiplied* over the drawing, so the printed lines and
 * labels stay legible and everything else keeps the paper white.
 */
function cropTexture(floor) {
  const { x, y, w, h } = floor.crop;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(sheets.get(floor.image ?? PLAN.image), x, y, w, h, 0, 0, w, h);

  if (floor.parquet?.length) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = parquetPattern(ctx);
    for (const [x0, y0, x1, y1] of floor.parquet) {
      ctx.fillRect(x0 - x, y0 - y, x1 - x0, y1 - y0);
    }
    ctx.restore();

    // Printed symbols the owner has removed: overpaint with plain parquet.
    ctx.fillStyle = parquetPattern(ctx);
    for (const [x0, y0, x1, y1] of floor.erase ?? []) {
      ctx.fillRect(x0 - x, y0 - y, x1 - x0, y1 - y0);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/**
 * The slab's outline: the floor's crop rectangle, or its `outline` footprint,
 * with its `voids` punched out (the GALERI BOSLUGU stairwell, so you can see
 * down through it when stacked). Shape space matches the un-rotated plane:
 * +X right, +Y up (= -Z / north).
 */
/** Sheet px → this floor's slab-shape coordinates (metres, +Y = north). */
function floorLocal(floor) {
  return ([px, py]) => [
    (px - (floor.crop.x + floor.crop.w / 2)) * MPP,
    ((floor.crop.y + floor.crop.h / 2) - py) * MPP,
  ];
}

/**
 * Outward offset of a rectilinear polygon, in sheet px. Every edge in the floor
 * outlines is axis-aligned, so each offset edge meets its neighbour at a single
 * point: take x from the vertical edge and y from the horizontal one. The
 * shoelace sign gives the winding, and so which side is "out".
 */
function offsetOutline(poly, d) {
  if (!d) return poly;
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % n];
    area += x0 * y1 - x1 * y0;
  }
  const s = Math.sign(area) || 1;
  const edges = poly.map((p, i) => {
    const q = poly[(i + 1) % n];
    const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
    const len = Math.hypot(dx, dy) || 1;
    return { x: p[0] + (dy / len) * s * d, y: p[1] + (-dx / len) * s * d, vertical: dx === 0 };
  });
  // Vertex i is where the offset of edge i-1 meets the offset of edge i.
  return poly.map((_, i) => {
    const a = edges[(i - 1 + n) % n];
    const b = edges[i];
    return a.vertical ? [a.x, b.y] : [b.x, a.y];
  });
}

function slabShape(floor, offsetPx = 0) {
  const w = floor.crop.w * MPP;
  const h = floor.crop.h * MPP;
  const local = floorLocal(floor);

  const shape = floor.outline
    ? new THREE.Shape(offsetOutline(floor.outline, offsetPx).map((p) => new THREE.Vector2(...local(p))))
    : new THREE.Shape()
      .moveTo(-w / 2, -h / 2).lineTo(w / 2, -h / 2)
      .lineTo(w / 2, h / 2).lineTo(-w / 2, h / 2).closePath();

  for (const v of floor.voids ?? []) {
    // A void is a `rect`, or a `path` polygon where two openings meet.
    if (v.path) {
      shape.holes.push(new THREE.Path(v.path.map((p) => new THREE.Vector2(...local(p)))));
      continue;
    }
    const [x0, y0] = local([v.rect[0], v.rect[1]]);
    const [x1, y1] = local([v.rect[2], v.rect[3]]);
    const [lo, hi] = [Math.min(x0, x1), Math.max(x0, x1)];
    const [bo, tp] = [Math.min(y0, y1), Math.max(y0, y1)];
    shape.holes.push(
      new THREE.Path().moveTo(lo, bo).lineTo(lo, tp).lineTo(hi, tp).lineTo(hi, bo).closePath(),
    );
  }
  return shape;
}

/**
 * The textured floor plane. ShapeGeometry emits raw shape coordinates as UVs,
 * so they get renormalised to keep the plan texture registered across holes.
 */
function slabGeometry(floor) {
  const w = floor.crop.w * MPP;
  const h = floor.crop.h * MPP;
  if (!floor.voids?.length && !floor.outline) return new THREE.PlaneGeometry(w, h);

  const geo = new THREE.ShapeGeometry(slabShape(floor));
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * The structural floor under an upper storey: floor-to-floor minus the wall
 * height (0.4 m), so the walls below meet it with no gap. Its top is flush
 * with the textured plane; the same outline and voids apply.
 */
const SLAB_BODY_MAT = new THREE.MeshStandardMaterial({ color: 0xd9d5cc, roughness: 0.95 });
function slabBody(floor, proud = 0) {
  const thickness = PLAN.floorToFloor - PLAN.storeyHeight;
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(slabShape(floor, proud / MPP), { depth: thickness, bevelEnabled: false }),
    SLAB_BODY_MAT,
  );
  body.rotation.x = -Math.PI / 2;      // shape +Y is north; extrusion runs up
  body.position.y = -thickness;
  body.castShadow = true;
  body.receiveShadow = true;
  return body;
}

/**
 * Facade downlights, recessed into the band's soffit: they wash the walls below
 * and spill out over the terrace and lawn, which is the point of the band.
 *
 * LIGHT_SPACING (3.4 m) was chosen against the render, not from a formula,
 * because the fixture sits only 0.12 m off the wall and so does two different
 * jobs at once. On the wall the cone is cut off almost at its apex and reads as
 * a distinct scallop about 1.2 m wide, giving the facade an even rhythm roughly
 * one bay per window. On the ground 3 m below, the same 35° half-angle has
 * opened out to a pool ~4.2 m across, so the pools overlap and the terrace gets
 * a continuous wash with no dark patches between fixtures. Tightening the gap
 * to overlap the wall scallops too would take ~34 lights per model and lose the
 * rhythm; widening it past ~4 m breaks the wash on the paving.
 *
 * No fixture owns a light. Each registers an emitter and `LightPool` hands the
 * nearest ones a real spot — there are 21 of these per model and a few hundred
 * fittings in the house altogether, which no fragment shader would survive.
 * Shadows are off for all of them: a shadow-casting spot wants its own shadow
 * map, and that would cost more than the rest of the scene put together. The
 * sun is still the only shadow caster.
 */
const LIGHT_TINT = 0xffd7a0;
const FIXTURE_MAT = new THREE.MeshStandardMaterial({
  color: 0x2b2b2b,
  emissive: LIGHT_TINT,
  emissiveIntensity: 1.6,
  roughness: 0.5,
});
function facadeLights(floor, proud) {
  const group = new THREE.Group();
  group.name = 'facade-lights';
  group.visible = false;               // day is the default view; `L` lights them
  const toLocal = floorLocal(floor);
  const soffit = -(PLAN.floorToFloor - PLAN.storeyHeight); // the band's underside
  // Walk the band's outer edge, held back a little so each fixture sits under it.
  const ring = offsetOutline(floor.outline, (proud - LIGHT_INSET) / MPP);
  for (let i = 0; i < ring.length; i++) {
    const a = toLocal(ring[i]);
    const b = toLocal(ring[(i + 1) % ring.length]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const count = Math.max(1, Math.round(len / LIGHT_SPACING));
    for (let k = 0; k < count; k++) {
      const t = (k + 0.5) / count;                     // centred in its share of the run
      const x = a[0] + (b[0] - a[0]) * t;
      const z = -(a[1] + (b[1] - a[1]) * t);           // shape +Y is north = -Z
      group.add(lightFixture(x, soffit, z));
    }
  }
  return group;
}

/**
 * One recessed downlight: the visible trim, plus an emitter for the pool in
 * `lights.js` to aim a real spot through when you are near enough to see it.
 */
function lightFixture(x, y, z) {
  const fixture = new THREE.Group();
  fixture.position.set(x, y, z);

  const trim = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 12), FIXTURE_MAT);
  trim.position.y = -0.01;
  fixture.add(trim);

  emitter(fixture, {
    at: [0, -0.02, 0],
    aim: [0, -1, 0],                      // straight down the facade
    color: LIGHT_TINT, intensity: 9, distance: 9, angle: 0.61, penumbra: 0.55, decay: 1.6,
  });
  return fixture;
}

// ── floors ──────────────────────────────────────────────────────────────
const slabTextures = new Map(); // one canvas per floor, shared by both models
function slabTexture(floor) {
  if (!slabTextures.has(floor.id)) slabTextures.set(floor.id, cropTexture(floor));
  return slabTextures.get(floor.id);
}

/**
 * Each floor is built at its true alignment inside a container, then the
 * container is moved to where `placement()` puts it for that layout, plus the
 * layout's sideways offset `dx`.
 */
function buildModel(set, mode, dx, floors) {
  return floors.map((floor) => {
    const container = new THREE.Group();
    container.name = `${set}:${floor.id}`;
    container.userData.set = set;

    const slab = new THREE.Mesh(
      slabGeometry(floor),
      new THREE.MeshStandardMaterial({
        map: slabTexture(floor),
        roughness: 1,
        side: THREE.DoubleSide,
      }),
    );
    slab.rotation.x = -Math.PI / 2;
    slab.receiveShadow = true;
    // Stacked, an upper slab is a ceiling: lift it clear of the walls below.
    slab.position.y = mode === 'stacked' && floor.storey > 0 ? 0.01 : 0;
    container.add(slab);
    // Stacked, the slab edge becomes the lit band between the two storeys; the
    // floors apart have no ground floor under them for it to belong to.
    const banded = mode === 'stacked' && floor.storey > 0 && floor.outline;
    if (floor.storey > 0 && floor.outline) container.add(slabBody(floor, banded ? BAND_OFFSET : 0));
    const lights = banded ? facadeLights(floor, BAND_OFFSET) : null;
    if (lights) container.add(lights);

    const own = { offsetPx: floor.alignPx, elevation: 0, mode };
    const walls = buildWalls(floor, own);
    const objects = buildObjects(floor, own);
    container.add(walls, objects);

    const at = placement(floor, mode);
    container.position.set(
      dx + (at.offsetPx[0] - floor.alignPx[0]) * MPP,
      at.elevation,
      (at.offsetPx[1] - floor.alignPx[1]) * MPP,
    );

    scene.add(container);
    return { floor, set, mode, container, walls, objects, slab, lights };
  });
}

const floorGroups = LAYOUTS.flatMap(([set, dx, mode, floors]) => buildModel(set, mode, dx, floors));
layoutEl.textContent = 'side by side · stacked (east)';

// ── name plates ─────────────────────────────────────────────────────────
// The models look alike, so each gets a colour-coded plate on the ground in
// front of it (south of the plot). Sprites always face the camera and ignore
// depth, so they stay readable from any angle. `N` hides them.
const SET_NAMES = { apart: 'side by side', stacked: 'stacked' };
const LABELS = [
  { set: 'apart', floorId: 'ground', accent: '#4da3ff', title: 'SIDE BY SIDE', sub: 'ZEMIN · ground floor' },
  { set: 'apart', floorId: 'first', accent: '#4da3ff', title: 'SIDE BY SIDE', sub: 'BIRINCI KAT · first floor' },
  { set: 'stacked', floorId: 'ground', accent: '#5fd08a', title: 'STACKED', sub: 'first floor on the ground floor' },
];

/** A two-line plate: bold title over a smaller subtitle, with a colour tab. */
function makeLabel(title, sub, accent) {
  const w = 640;
  const h = 200;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(14,18,24,0.9)';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 26);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(0, 0, 26, h, [26, 0, 0, 26]);
  ctx.fill();
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f2f4f7';
  ctx.font = 'bold 66px system-ui, sans-serif';
  ctx.fillText(title, 58, 70, w - 90);
  ctx.fillStyle = '#b9c2cf';
  ctx.font = '40px system-ui, sans-serif';
  ctx.fillText(sub, 58, 142, w - 90);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const worldH = 4.4;                     // plate height in metres (~14 m wide)
  sprite.scale.set(worldH * (w / h), worldH, 1);
  sprite.renderOrder = 999;
  return sprite;
}

const labelGroup = new THREE.Group();
labelGroup.name = 'labels';
const LABEL_Z = (2294 - (ORIGIN.y + ORIGIN.h / 2)) * MPP + 3.5;  // just south of the plot wall
for (const { set, floorId, accent, title, sub } of LABELS) {
  const at = floorGroups.find((g) => g.set === set && g.floor.id === floorId);
  if (!at) continue;
  const plate = makeLabel(title, sub, accent);
  plate.position.set(at.container.position.x, 2.4, LABEL_Z);
  plate.userData.set = set;          // so it hides with its model on `5`
  labelGroup.add(plate);
}
scene.add(labelGroup);

// ── walk mode ───────────────────────────────────────────────────────────
// First person inside the house. It reuses this scene's geometry as its
// collision world, so it needs the built floor groups — hence it is created
// here rather than in main's preamble.
const walk = createWalkMode({
  renderer, camera, scene, orbit: controls, floorGroups, labelGroup, statusEl,
  ambient, hemi,
  set: 'stacked',   // the real house: both storeys in their true positions
});

// ── view helpers ────────────────────────────────────────────────────────
const grid = new THREE.GridHelper(120, 120, 0x3c4654, 0x232a33);
grid.position.y = -0.01;
grid.visible = false;
scene.add(grid);

let roofsHidden = false;
function setRoofsHidden(hidden) {
  roofsHidden = hidden;
  for (const { objects } of floorGroups) {
    objects.traverse((o) => { if (o.userData.roof) o.visible = !hidden; });
  }
  invalidateShadows();
}

/**
 * Times of day, cycled by `K`; `L` still jumps to night and back.
 *
 * `dir` is where the sun stands, in **model** axes, and the model is not
 * aligned to compass north: +X is real south, -Z real east (the pool side),
 * +Z real west (the entrance and parking). So the sun rises out of -Z, crosses
 * over +X and sets into +Z, which is why every daytime `dir` here has a
 * positive X — in the northern hemisphere the sun never crosses the north.
 *
 * Night drops the sun to moonlight, takes the ambient and the sky down with it
 * and switches on the band's downlights and the wall sconces. They are off by
 * day, which also keeps two dozen spot lights out of the render when nothing
 * can be seen of them anyway.
 */
const TIMES = [
  { name: 'Morning',   dir: [26, 26, -34], sun: 2.1, tint: 0xffe9cc, ambient: 0.22, hemi: 1.0, sky: 0x17202b, fogNear: 70, fogFar: 190, night: false },
  { name: 'Midday',    dir: [14, 52,  -6], sun: 2.7, tint: 0xfff6ea, ambient: 0.30, hemi: 1.3, sky: 0x11151b, fogNear: 85, fogFar: 210, night: false },
  { name: 'Afternoon', dir: [26, 28,  30], sun: 2.3, tint: 0xfff0dc, ambient: 0.25, hemi: 1.1, sky: 0x131a22, fogNear: 70, fogFar: 190, night: false },
  { name: 'Sunset',    dir: [ 8, 10,  40], sun: 1.5, tint: 0xffa457, ambient: 0.18, hemi: 0.8, sky: 0x2b1d17, fogNear: 55, fogFar: 165, night: false },
  { name: 'Night',     dir: [26, 34, -20], sun: 0.12, tint: 0xbcd0ff, ambient: 0.05, hemi: 0.25, sky: 0x070910, fogNear: 55, fogFar: 150, night: true },
];
const NIGHT_TIME = TIMES.findIndex((t) => t.night);

let timeIndex = 0;
let lastDaylight = 0;                       // where `L` comes back to
let night = false;
function setTime(index) {
  timeIndex = (index + TIMES.length) % TIMES.length;
  const p = TIMES[timeIndex];
  night = p.night;
  if (!night) lastDaylight = timeIndex;

  sun.position.set(...p.dir);
  sun.intensity = p.sun;
  sun.color.setHex(p.tint);
  ambient.intensity = p.ambient;
  hemi.intensity = p.hemi;
  scene.background.setHex(p.sky);
  scene.fog.color.setHex(p.sky);
  scene.fog.near = p.fogNear;
  scene.fog.far = p.fogFar;

  for (const { lights } of floorGroups) if (lights) lights.visible = night;
  for (const { objects } of floorGroups) {    // lenses, flames, under-cabinet strips
    objects.traverse((o) => { if (o.userData.nightLight) o.visible = night; });
  }
  pool.setOn(night);
  timeEl.textContent = p.name;
  invalidateShadows();                        // the sun moved
}
/** `L`: straight to night, or back to whichever daylight hour you left. */
function setNight(on) { setTime(on ? NIGHT_TIME : lastDaylight); }

let xray = false;
function setXray(on) {
  xray = on;
  for (const { walls } of floorGroups) {
    walls.traverse((o) => {
      if (o.isMesh && o.material?.transmission === undefined) {
        o.material.transparent = on;
        o.material.opacity = on ? 0.35 : 1;
        o.material.depthWrite = !on;
        o.material.needsUpdate = true;
      }
    });
  }
  invalidateShadows();
}

/**
 * What is on screen: which storeys (`1`/`2`/`0`) and which of the two models
 * (`5`). They compose — hiding the side-by-side model still respects a
 * ground-floor-only view — so both are kept as state and applied together
 * rather than each writing `container.visible` on its own.
 */
let shownFloors = 'all';
let shownSet = null;            // null = both models
function applyVisibility() {
  for (const { floor, container, set } of floorGroups) {
    const floorOK = shownFloors === 'all' || shownFloors.includes(floor.base ?? floor.id);
    container.visible = floorOK && (!shownSet || set === shownSet);
  }
  for (const plate of labelGroup.children) {
    plate.visible = !shownSet || plate.userData.set === shownSet;
  }
  layoutEl.textContent = shownSet ? SET_NAMES[shownSet] : 'side by side · stacked';
  invalidateShadows();
}

function showFloors(ids) {
  shownFloors = ids;
  applyVisibility();
}

/** `5` cycles both models → stacked only → side by side only. */
const SET_CYCLE = [null, 'stacked', 'apart'];
function cycleSet() {
  shownSet = SET_CYCLE[(SET_CYCLE.indexOf(shownSet) + 1) % SET_CYCLE.length];
  applyVisibility();
  frameAll(shownSet ?? undefined);
}

/** Bounding box of the visible floors, optionally only one model's ('apart' or 'stacked'). */
function visibleBounds(set) {
  const box = new THREE.Box3();
  for (const g of floorGroups) {
    if (g.container.visible && (!set || g.set === set)) box.expandByObject(g.container);
  }
  return box;
}

function frameAll(set) {
  const box = visibleBounds(set);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const dist = Math.max(size.x, size.z) * 0.95 + size.y * 1.5;
  controls.target.copy(center).setY(0);
  camera.position.set(center.x + dist * 0.35, dist * 0.62, center.z + dist * 0.8);
}

function topView() {
  const box = visibleBounds();
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  controls.target.copy(center).setY(0);
  camera.position.set(center.x, Math.max(size.x, size.z) * 1.15, center.z + 0.001);
}

window.addEventListener('keydown', (e) => {
  // Inside the house, WASD is movement and the view keys would fight it. The
  // lighting keys are the exception: night, the time of day and the roofs are
  // exactly what you want to change while you are standing in a room.
  const WALK_KEYS = ['f', 'l', 'k', 'j', 'o', 'x'];
  if (walk.active && !WALK_KEYS.includes(e.key.toLowerCase())) return;
  switch (e.key.toLowerCase()) {
    case 'f': walk.toggle(); invalidateShadows(); break;   // walk hides the other models
    case 'g': grid.visible = !grid.visible; break;
    case 'x': setXray(!xray); break;
    case 'o': setRoofsHidden(!roofsHidden); break;
    case 'l': setNight(!night); break;
    case 'k': setTime(timeIndex + 1); break;   // on through the day
    case 'j': setTime(timeIndex - 1); break;   // and back again
    case 'n': labelGroup.visible = !labelGroup.visible; break;
    case 't': topView(); break;
    case 'r': frameAll(); break;
    case '3': frameAll('apart'); break;
    case '4': frameAll('stacked'); break;
    case '1': showFloors(['ground']); frameAll(); break;
    case '2': showFloors(['first']); frameAll(); break;
    case '0': showFloors('all'); frameAll(); break;
    case '5': cycleSet(); break;
  }
});

// ── wall pick / readout ─────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
renderer.domElement.addEventListener('pointermove', (e) => {
  if (walk.active) return;
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const visible = floorGroups.filter((f) => f.container.visible);
  const targets = visible.flatMap((f) => [f.walls, f.objects]);
  const hit = raycaster.intersectObjects(targets, true)[0];

  // Walk up to whichever ancestor carries the label.
  let node = hit?.object ?? null;
  let label = '';
  while (node && !label) {
    const d = node.userData;
    if (d?.wall) label = `${d.floor.name} · ${d.wall.name}`;
    else if (d?.item) label = `${d.floor?.name ?? ''} · ${d.item.name ?? d.item.kind}`.trim();
    node = node.parent;
  }
  // Say which model the pointer is over, since the three look alike.
  let owner = hit?.object ?? null;
  while (owner && !owner.userData.set) owner = owner.parent;
  const model = SET_NAMES[owner?.userData.set];
  statusEl.textContent = label && model ? `${label}  ·  ${model}` : label;
});

// ── go ──────────────────────────────────────────────────────────────────
/**
 * Every fitting in the house — the facade band, the sconces, each room's four
 * coffer spots, the under-cabinet strips, the wardrobe lights, the chandelier
 * — registers an emitter rather than a light of its own. The pool hands its
 * fixed set of spots to whichever are nearest the camera, which is how walking
 * through a lit house stays affordable. See `src/lights.js`.
 */
const pool = new LightPool(scene);

document.getElementById('loading').remove();
const lampCount = pool.collect(scene);       // after layout: nothing moves again
setTime(0);            // morning, sun over the pool side
frameAll();
invalidateShadows();

// walk.html — the desktop app's entry page — asks to start inside the house
// rather than above the drawing. index.html leaves this unset and opens on the
// orbit view as before; `F` swaps between the two either way.
if (window.VILLA_BOOT === 'walk') { walk.enter(); invalidateShadows(); }

// A handle on the scene for the console and for the smoke test that drives the
// desktop build. Read-only in spirit — nothing in the app reads it back.
window.villa = { scene, camera, controls, walk, floorGroups, pool, lampCount };

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  invalidateShadows();
});

/**
 * Adaptive resolution. The fragment cost of night is real — every lit pixel is
 * shaded against 21 spot lights as well as the sun — so rather than thin the
 * fixtures out and lose the rhythm along the band, the renderer drops its pixel
 * ratio when frames run long and climbs back when they do not. The step is
 * small and hysteretic (drop over 22 ms, climb under 13 ms, and only after a
 * run of agreeing frames) so it settles instead of oscillating, and it is
 * clamped so the picture never gets softer than 1x.
 */
const DPR_STEP = 0.1;
let frameAvg = 16;
let dprHold = 0;
function adaptResolution(ms) {
  frameAvg += (Math.min(ms, 100) - frameAvg) * 0.1;   // ignore tab-switch spikes
  const want = frameAvg > 22 ? -DPR_STEP : frameAvg < 13 ? DPR_STEP : 0;
  if (!want) { dprHold = 0; return; }
  if (++dprHold < 30) return;                          // ~half a second of agreement
  dprHold = 0;
  const next = Math.min(MAX_DPR, Math.max(MIN_DPR, dpr + want));
  if (next === dpr) return;
  dpr = next;
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
}

let last = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const ms = now - last;
  const dt = ms / 1000;
  last = now;
  if (walk.active) walk.update(dt);
  else controls.update();
  pool.update(camera, now);
  renderer.render(scene, camera);
  adaptResolution(ms);
});
