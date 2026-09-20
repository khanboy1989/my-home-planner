import * as THREE from 'three';
import { PLAN, toWorld } from './floorplan.js';

/**
 * Extrudes traced wall centrelines into 3D.
 *
 * A wall is a run of boxes along its centreline. Openings punch it into
 * pieces instead of using CSG: for each opening we emit the lintel above
 * it (and the spandrel below, for windows), and the solid stretches in
 * between stay full height. That keeps the geometry cheap, closed, and
 * shadow-safe.
 */

const MATERIALS = {
  exterior: new THREE.MeshStandardMaterial({
    color: 0xe8e2d9, roughness: 0.92, metalness: 0.0,
  }),
  interior: new THREE.MeshStandardMaterial({
    color: 0xf2efe9, roughness: 0.95, metalness: 0.0,
  }),
};

const GLASS = new THREE.MeshPhysicalMaterial({
  color: 0x9ec9e2,
  roughness: 0.08,
  metalness: 0,
  transmission: 0.85,
  thickness: 0.02,
  transparent: true,
  opacity: 0.45,
  side: THREE.DoubleSide,
});

const FRAME = new THREE.MeshStandardMaterial({ color: 0xf0ece4, roughness: 0.55 });
// Windows and the glazed slider are black joinery.
const BLACK_FRAME = new THREE.MeshStandardMaterial({
  color: 0x1b1e23, roughness: 0.42, metalness: 0.25,
});
const LEAF = new THREE.MeshStandardMaterial({ color: 0x9a7a56, roughness: 0.6 });
const HANDLE = new THREE.MeshStandardMaterial({
  color: 0x9aa3ad, roughness: 0.3, metalness: 0.8,
});

function slab(w, h, d, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Joinery for one opening, in wall-local space (+X along the wall, Z across
 * its thickness). Windows get a frame, a sill and glazing; doors get a lined
 * frame plus a leaf swung 78° open so the swing reads from above, the way it
 * does on the plan. Sectional garage doors get a head panel and no leaf.
 */
function buildOpening(cut, depth) {
  const g = new THREE.Group();
  const w = cut.to - cut.from;
  const h = cut.head - cut.sill;
  if (w < 1e-3 || h < 1e-3) return g;

  const cx = cut.from + w / 2;
  const jamb = 0.06;
  const d = depth + 0.02;
  const isWindow = cut.sill > 1e-3;
  const frameMat = isWindow || cut.kind === 'sliding' ? BLACK_FRAME : FRAME;

  // Frame: two jambs plus a head, lining the reveal.
  g.add(slab(jamb, h, d, frameMat, cut.from + jamb / 2, cut.sill + h / 2, 0));
  g.add(slab(jamb, h, d, frameMat, cut.to - jamb / 2, cut.sill + h / 2, 0));
  g.add(slab(w, jamb, d, frameMat, cx, cut.head - jamb / 2, 0));

  // A cased opening is a lined hole — no leaf.
  if (cut.kind === 'opening') return g;

  if (cut.kind === 'garage') {
    g.add(slab(w - jamb * 2, 0.12, depth * 0.5, FRAME, cx, cut.head - 0.2, 0));
    return g;
  }

  if (isWindow) {
    // Window: sill, a centre mullion on wide openings, and glazing.
    g.add(slab(w + 0.1, 0.05, depth + 0.12, frameMat, cx, cut.sill + 0.02, 0));
    g.add(slab(w, jamb, d, frameMat, cx, cut.sill + jamb / 2, 0));
    if (w > 1.6) g.add(slab(0.05, h, d * 0.6, frameMat, cx, cut.sill + h / 2, 0));
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w - jamb * 2, h - jamb * 2), GLASS);
    pane.position.set(cx, cut.sill + h / 2, 0);
    g.add(pane);
    return g;
  }

  if (cut.kind === 'sliding') {
    // Glazed slider: black framed leaf parked alongside the opening, on the
    // face of the wall, with its track running the full travel above.
    const face = depth / 2 + 0.035;
    const travel = cut.swing === -1 ? -w : w;
    g.add(slab(w * 2 + jamb, 0.05, 0.05, frameMat,
      cx + travel / 2, cut.head + 0.04, face));

    const leaf = new THREE.Group();
    leaf.position.set(cx + travel, 0, face);
    const lw = w - 0.04;
    const lh = h - 0.04;
    leaf.add(slab(lw, 0.05, 0.05, frameMat, 0, lh - 0.025, 0));
    leaf.add(slab(lw, 0.05, 0.05, frameMat, 0, 0.025, 0));
    leaf.add(slab(0.05, lh, 0.05, frameMat, -lw / 2 + 0.025, lh / 2, 0));
    leaf.add(slab(0.05, lh, 0.05, frameMat, lw / 2 - 0.025, lh / 2, 0));
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(lw - 0.08, lh - 0.08), GLASS);
    pane.position.set(0, lh / 2, 0);
    leaf.add(pane);
    g.add(leaf);
    return g;
  }

  // Door: hinge at the `from` jamb, swung back into the room.
  const leafW = w - jamb * 2;
  const swing = new THREE.Group();
  swing.position.set(cut.from + jamb, 0, 0);
  swing.rotation.y = -Math.PI * (78 / 180) * (cut.swing ?? 1);
  swing.add(slab(leafW, h - jamb, 0.045, LEAF, leafW / 2, (h - jamb) / 2, 0));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), HANDLE);
  knob.position.set(leafW - 0.09, 1.05, 0.05);
  swing.add(knob);
  g.add(swing);
  return g;
}

/** Split a wall of length L into solid pieces around its openings. */
function solidPieces(length, openings, wallHeight, mpp) {
  const pieces = [];
  const cuts = openings
    .map((o) => ({
      from: Math.max(0, o.from * mpp),
      to: Math.min(length, o.to * mpp),
      sill: o.sill ?? PLAN.sill,
      head: Math.min(o.head ?? PLAN.head, wallHeight),
      kind: o.kind,
      swing: o.swing,
    }))
    .filter((o) => o.to > o.from)
    .sort((a, b) => a.from - b.from);

  let cursor = 0;
  for (const cut of cuts) {
    if (cut.from > cursor + 1e-4) {
      pieces.push({ from: cursor, to: cut.from, bottom: 0, top: wallHeight });
    }
    if (cut.sill > 1e-4) {
      pieces.push({ from: cut.from, to: cut.to, bottom: 0, top: cut.sill });
    }
    if (wallHeight - cut.head > 1e-4) {
      pieces.push({ from: cut.from, to: cut.to, bottom: cut.head, top: wallHeight });
    }
    cursor = Math.max(cursor, cut.to);
  }
  if (length - cursor > 1e-4) {
    pieces.push({ from: cursor, to: length, bottom: 0, top: wallHeight });
  }
  return { pieces, cuts };
}

/**
 * Build one floor's walls. `place` is the {offsetPx, elevation} from
 * floorplan.placement() — it decides where this storey lands in the world.
 */
export function buildWalls(floor, place) {
  const group = new THREE.Group();
  group.name = `walls:${floor.id}`;
  const mpp = PLAN.metersPerPixel;

  for (const wall of floor.walls) {
    // Rooms tucked under the stair carry a reduced ceiling.
    const H = wall.height ?? PLAN.storeyHeight;
    const [ax, az] = toWorld(wall.a, place.offsetPx);
    const [bx, bz] = toWorld(wall.b, place.offsetPx);

    const dx = bx - ax;
    const dz = bz - az;
    const length = Math.hypot(dx, dz);
    if (length < 1e-4) continue;

    // Angle around +Y that takes local +X onto the wall direction.
    const angle = Math.atan2(-dz, dx);
    const depth = wall.thickness ?? PLAN.thickness[wall.type];
    const material = MATERIALS[wall.type];

    const wallGroup = new THREE.Group();
    wallGroup.position.set(ax, 0, az);
    wallGroup.rotation.y = angle;
    wallGroup.userData.wall = wall;
    wallGroup.userData.floor = floor;

    const { pieces, cuts } = solidPieces(length, wall.openings ?? [], H, mpp);

    for (const p of pieces) {
      const w = p.to - p.from;
      const h = p.top - p.bottom;
      if (w < 1e-4 || h < 1e-4) continue;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), material);
      mesh.position.set(p.from + w / 2, p.bottom + h / 2, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      wallGroup.add(mesh);
    }

    for (const cut of cuts) wallGroup.add(buildOpening(cut, depth));

    group.add(wallGroup);
  }

  group.position.y = place.elevation;
  return group;
}

export { MATERIALS };
