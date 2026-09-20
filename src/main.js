import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLAN, ORIGIN, FLOORS, placement } from './floorplan.js';
import { buildWalls } from './buildWalls.js';
import { buildObjects } from './objects.js';

const app = document.getElementById('app');
const statusEl = document.getElementById('status');
const layoutEl = document.getElementById('layout-mode');

const MPP = PLAN.metersPerPixel;
const PLANE_W = ORIGIN.w * MPP;
const PLANE_H = ORIGIN.h * MPP;

let layout = 'apart'; // 'apart' | 'stacked'

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
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
const d = PLANE_W * 1.4;
Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 1, far: 140 });
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun);
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

// Ground the whole composition sits on.
const apron = new THREE.Mesh(
  new THREE.PlaneGeometry(PLANE_W * 6, PLANE_H * 6),
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

function cropTexture({ x, y, w, h }) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(sheet, x, y, w, h, 0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/**
 * The slab is the floor's crop rectangle with its `voids` punched out — the
 * GALERI BOSLUGU stairwell, so you can see down through it when stacked.
 * ShapeGeometry emits raw shape coordinates as UVs, so they get renormalised
 * to keep the plan texture registered across the hole.
 */
function slabGeometry(floor) {
  const w = floor.crop.w * MPP;
  const h = floor.crop.h * MPP;
  if (!floor.voids?.length) return new THREE.PlaneGeometry(w, h);

  // Shape space matches the un-rotated plane: +X right, +Y up (= -Z / north).
  const local = ([px, py]) => [
    (px - (floor.crop.x + floor.crop.w / 2)) * MPP,
    ((floor.crop.y + floor.crop.h / 2) - py) * MPP,
  ];

  const shape = new THREE.Shape()
    .moveTo(-w / 2, -h / 2).lineTo(w / 2, -h / 2)
    .lineTo(w / 2, h / 2).lineTo(-w / 2, h / 2).closePath();

  for (const v of floor.voids) {
    const [x0, y0] = local([v.rect[0], v.rect[1]]);
    const [x1, y1] = local([v.rect[2], v.rect[3]]);
    const [lo, hi] = [Math.min(x0, x1), Math.max(x0, x1)];
    const [bo, tp] = [Math.min(y0, y1), Math.max(y0, y1)];
    shape.holes.push(
      new THREE.Path().moveTo(lo, bo).lineTo(lo, tp).lineTo(hi, tp).lineTo(hi, bo).closePath(),
    );
  }

  const geo = new THREE.ShapeGeometry(shape);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  }
  uv.needsUpdate = true;
  return geo;
}

// ── floors ──────────────────────────────────────────────────────────────
/**
 * Each floor is built once at its true alignment, wrapped in a container.
 * Switching layout only moves the containers — no geometry is rebuilt.
 */
const floorGroups = FLOORS.map((floor) => {
  const container = new THREE.Group();
  container.name = floor.id;

  const slab = new THREE.Mesh(
    slabGeometry(floor),
    new THREE.MeshStandardMaterial({
      map: cropTexture(floor.crop),
      roughness: 1,
      side: THREE.DoubleSide,
    }),
  );
  slab.rotation.x = -Math.PI / 2;
  slab.receiveShadow = true;
  container.add(slab);

  const place = { offsetPx: floor.alignPx, elevation: 0 };
  const walls = buildWalls(floor, place);
  const objects = buildObjects(floor, place);
  container.add(walls, objects);

  scene.add(container);
  return { floor, container, walls, objects, slab };
});

function applyLayout() {
  for (const { floor, container, slab } of floorGroups) {
    const place = placement(floor, layout);
    container.position.set(
      (place.offsetPx[0] - floor.alignPx[0]) * MPP,
      place.elevation,
      (place.offsetPx[1] - floor.alignPx[1]) * MPP,
    );
    // Stacked, an upper slab is a ceiling: lift it clear of the walls below.
    slab.position.y = layout === 'stacked' && floor.storey > 0 ? 0.01 : 0;
  }
  layoutEl.textContent = layout === 'apart' ? 'side by side' : 'stacked';
}
applyLayout();

// ── view helpers ────────────────────────────────────────────────────────
const grid = new THREE.GridHelper(120, 120, 0x3c4654, 0x232a33);
grid.position.y = -0.01;
grid.visible = false;
scene.add(grid);

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
    container.visible = ids === 'all' || ids.includes(floor.id);
  }
}

function frameAll() {
  const box = new THREE.Box3();
  for (const { container } of floorGroups) {
    if (container.visible) box.expandByObject(container);
  }
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const dist = Math.max(size.x, size.z) * 0.95 + size.y * 1.5;
  controls.target.copy(center).setY(0);
  camera.position.set(center.x + dist * 0.35, dist * 0.62, center.z + dist * 0.8);
}

function topView() {
  const box = new THREE.Box3();
  for (const { container } of floorGroups) {
    if (container.visible) box.expandByObject(container);
  }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  controls.target.copy(center).setY(0);
  camera.position.set(center.x, Math.max(size.x, size.z) * 1.15, center.z + 0.001);
}

window.addEventListener('keydown', (e) => {
  switch (e.key.toLowerCase()) {
    case 'g': grid.visible = !grid.visible; break;
    case 'x': setXray(!xray); break;
    case 't': topView(); break;
    case 'r': frameAll(); break;
    case 'l':
      layout = layout === 'apart' ? 'stacked' : 'apart';
      applyLayout();
      frameAll();
      break;
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
  statusEl.textContent = label;
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
