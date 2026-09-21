import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLAN, ORIGIN, FLOORS, placement, toWorld } from './floorplan.js';
import { GROUND_COPY } from './groundCopy.js';
import { buildWalls } from './buildWalls.js';
import { buildObjects, poolBasinPx } from './objects.js';

const app = document.getElementById('app');
const statusEl = document.getElementById('status');
const layoutEl = document.getElementById('layout-mode');

const MPP = PLAN.metersPerPixel;
const PLANE_W = ORIGIN.w * MPP;
const PLANE_H = ORIGIN.h * MPP;

// Both models are always on screen: the floors side by side at the origin,
// and a second copy with the first floor stacked on the ground floor, to the
// east of it. STACK_DX clears the right-hand edge of the side-by-side row.
const STACK_GAP_M = 8;
const STACK_DX = (2 * ORIGIN.w + 149) * MPP + STACK_GAP_M;
// A duplicate of the ground floor (groundCopy.js) for experiments, west of the
// origin. The plot is ~24 m wide (x -11.6..12.2), so 30 m leaves ~6 m between.
const COPY_DX = -30;

// Each entry: [set, sideways offset, placement mode, floors to build].
const LAYOUTS = [
  ['apart', 0, 'apart', FLOORS],
  ['stacked', STACK_DX, 'stacked', FLOORS],
  ['copy', COPY_DX, 'apart', [GROUND_COPY]],
];

// ── renderer ────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
scene.add(new THREE.HemisphereLight(0xbcd6ff, 0x6b6257, 1.1));

const sun = new THREE.DirectionalLight(0xfff3e0, 2.4);
sun.position.set(-20, 34, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0005;
const d = Math.max(STACK_DX, -COPY_DX) + PLANE_W; // the shadow frustum has to reach every model
Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 1, far: 200 });
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun);
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

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
    const [x0, y0, x1, y1] = poolBasinPx(pool.rect);
    // Shape +Y is world -Z once the apron is laid flat, hence the flip.
    const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
      .map((c) => toWorld(c, [0, 0]))
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
let sheet;
try {
  sheet = await new THREE.ImageLoader()
    .setCrossOrigin('anonymous')
    .loadAsync(encodeURI(PLAN.image));
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
  ctx.drawImage(sheet, x, y, w, h, 0, 0, w, h);

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
function slabShape(floor) {
  const w = floor.crop.w * MPP;
  const h = floor.crop.h * MPP;
  const local = ([px, py]) => [
    (px - (floor.crop.x + floor.crop.w / 2)) * MPP,
    ((floor.crop.y + floor.crop.h / 2) - py) * MPP,
  ];

  const shape = floor.outline
    ? new THREE.Shape(floor.outline.map((p) => new THREE.Vector2(...local(p))))
    : new THREE.Shape()
      .moveTo(-w / 2, -h / 2).lineTo(w / 2, -h / 2)
      .lineTo(w / 2, h / 2).lineTo(-w / 2, h / 2).closePath();

  for (const v of floor.voids ?? []) {
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
function slabBody(floor) {
  const thickness = PLAN.floorToFloor - PLAN.storeyHeight;
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(slabShape(floor), { depth: thickness, bevelEnabled: false }),
    SLAB_BODY_MAT,
  );
  body.rotation.x = -Math.PI / 2;      // shape +Y is north; extrusion runs up
  body.position.y = -thickness;
  body.castShadow = true;
  body.receiveShadow = true;
  return body;
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
    if (floor.storey > 0 && floor.outline) container.add(slabBody(floor));

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
    return { floor, set, mode, container, walls, objects, slab };
  });
}

const floorGroups = LAYOUTS.flatMap(([set, dx, mode, floors]) => buildModel(set, mode, dx, floors));
layoutEl.textContent = 'side by side · stacked (east) · ground copy (west)';

// ── name plates ─────────────────────────────────────────────────────────
// Three models look alike, so each gets a colour-coded plate on the ground in
// front of it (south of the plot). Sprites always face the camera and ignore
// depth, so they stay readable from any angle. `N` hides them.
const SET_NAMES = { apart: 'side by side', stacked: 'stacked', copy: 'ground-floor copy' };
const LABELS = [
  { set: 'apart', floorId: 'ground', accent: '#4da3ff', title: 'SIDE BY SIDE', sub: 'ZEMIN · ground floor' },
  { set: 'apart', floorId: 'first', accent: '#4da3ff', title: 'SIDE BY SIDE', sub: 'BIRINCI KAT · first floor' },
  { set: 'stacked', floorId: 'ground', accent: '#5fd08a', title: 'STACKED', sub: 'first floor on the ground floor' },
  { set: 'copy', floorId: 'ground-copy', accent: '#ffa94d', title: 'COPY · EXPERIMENTS', sub: 'ZEMIN · src/groundCopy.js' },
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
  labelGroup.add(plate);
}
scene.add(labelGroup);

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
}

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
}

function showFloors(ids) {
  for (const { floor, container } of floorGroups) {
    container.visible = ids === 'all' || ids.includes(floor.base ?? floor.id);
  }
}

/** Bounding box of the visible floors, optionally only one model's ('apart', 'stacked' or 'copy'). */
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
  switch (e.key.toLowerCase()) {
    case 'g': grid.visible = !grid.visible; break;
    case 'x': setXray(!xray); break;
    case 'o': setRoofsHidden(!roofsHidden); break;
    case 'n': labelGroup.visible = !labelGroup.visible; break;
    case 't': topView(); break;
    case 'r': frameAll(); break;
    case '3': frameAll('apart'); break;
    case '4': frameAll('stacked'); break;
    case '5': frameAll('copy'); break;
    case '1': showFloors(['ground']); frameAll(); break;
    case '2': showFloors(['first']); frameAll(); break;
    case '0': showFloors('all'); frameAll(); break;
  }
});

// ── wall pick / readout ─────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
renderer.domElement.addEventListener('pointermove', (e) => {
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
document.getElementById('loading').remove();
frameAll();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
