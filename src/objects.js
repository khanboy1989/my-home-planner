import * as THREE from 'three';
import { PLAN, toWorld } from './floorplan.js';

/**
 * Furniture, fixtures and fittings, traced off the drawings.
 *
 * Every item is positioned by a `rect` of [x0, y0, x1, y1] in that floor's
 * sheet pixels — the same space as the walls — so objects land exactly on
 * the symbols printed in the plan texture beneath them. `kind` picks a maker
 * from the library below; each maker gets the rect already converted to
 * metres and builds from primitives.
 *
 * Orientation props (`head`, `back`, `face`) name the side an object's back
 * is against: 'N' is -Z (up the page), 'S' is +Z, 'W' is -X, 'E' is +X.
 */

const M = {
  wood:    new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.65 }),
  fabric:  new THREE.MeshStandardMaterial({ color: 0x8e99a8, roughness: 0.95 }),
  linen:   new THREE.MeshStandardMaterial({ color: 0xe6e3dc, roughness: 0.92 }),
  counter: new THREE.MeshStandardMaterial({ color: 0xd6d1c7, roughness: 0.5 }),
  cabinet: new THREE.MeshStandardMaterial({ color: 0xc6b9a4, roughness: 0.75 }),
  metal:   new THREE.MeshStandardMaterial({ color: 0x8f98a3, roughness: 0.35, metalness: 0.7 }),
  ceramic: new THREE.MeshStandardMaterial({ color: 0xf5f7f9, roughness: 0.18 }),
  dark:    new THREE.MeshStandardMaterial({ color: 0x272c33, roughness: 0.55 }),
  glass:   new THREE.MeshPhysicalMaterial({
    color: 0xa8cfe4, roughness: 0.06, transmission: 0.9, thickness: 0.02,
    transparent: true, opacity: 0.35, side: THREE.DoubleSide,
  }),
};

const CAR_PAINT = [0x2f3d55, 0x6b2b2b];

/** Axis-aligned box helper: size + centre, both in metres. */
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(r, h, mat, x = 0, y = 0, z = 0, seg = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ── makers ──────────────────────────────────────────────────────────────
// Each receives (g, { w, d }, item) with `g` already centred on the rect.

const KINDS = {
  /** Generic slab — counters, wardrobes, tables, cabinets. */
  box(g, { w, d }, it) {
    g.add(box(w, it.h ?? 0.9, d, M[it.mat] ?? M.wood, 0, it.y ?? 0, 0));
  },

  bed(g, { w, d }, it) {
    const head = it.head ?? 'N';
    const vertical = head === 'N' || head === 'S'; // head-to-foot runs along Z
    const sign = head === 'N' || head === 'W' ? -1 : 1;
    const along = vertical ? d : w;  // head to foot
    const across = vertical ? w : d; // shoulder to shoulder

    // u runs head-to-foot, v across the bed — mapped onto X/Z by orientation.
    const put = (sAcross, h, sAlong, mat, u, v, y) => {
      g.add(box(
        vertical ? sAcross : sAlong, h, vertical ? sAlong : sAcross, mat,
        vertical ? v : u, y, vertical ? u : v,
      ));
    };

    put(across, 0.3, along, M.wood, 0, 0, 0);                          // base
    put(across * 0.96, 0.22, along * 0.94, M.linen, 0, 0, 0.3);        // mattress
    put(across, 0.75, 0.1, M.wood, sign * (along / 2 - 0.05), 0, 0);   // headboard
    const u = sign * (along / 2 - 0.4);
    put(across * 0.4, 0.12, 0.4, M.linen, u, -across * 0.22, 0.52);    // pillows
    put(across * 0.4, 0.12, 0.4, M.linen, u, across * 0.22, 0.52);
  },

  sofa(g, { w, d }, it) {
    const back = it.back ?? 'N';
    const vertical = back === 'N' || back === 'S';
    const sign = back === 'N' || back === 'W' ? -1 : 1;
    const bw = vertical ? w : 0.18;
    const bd = vertical ? 0.18 : d;
    const seatH = it.h ?? 0.42;

    g.add(box(w * 0.98, seatH, d * 0.98, M.fabric));
    const backRest = box(bw, 0.5, bd, M.fabric, 0, seatH - 0.08);
    if (vertical) backRest.position.z = sign * (d / 2 - 0.09);
    else backRest.position.x = sign * (w / 2 - 0.09);
    g.add(backRest);

    // Arms on the two sides perpendicular to the backrest.
    const armW = vertical ? 0.16 : w * 0.96;
    const armD = vertical ? d * 0.96 : 0.16;
    for (const s of [-1, 1]) {
      const arm = box(armW, 0.24, armD, M.fabric, 0, seatH - 0.02);
      if (vertical) arm.position.x = s * (w / 2 - 0.08);
      else arm.position.z = s * (d / 2 - 0.08);
      g.add(arm);
    }
  },

  chair(g, { w, d }) {
    g.add(box(w * 0.9, 0.45, d * 0.9, M.wood));
    g.add(box(w * 0.9, 0.42, 0.06, M.wood, 0, 0.45, -d / 2 + 0.03));
  },

  stool(g, { w }) {
    g.add(cyl(w / 2, 0.06, M.wood, 0, 0.66));
    g.add(cyl(0.04, 0.66, M.metal));
  },

  /** Two-box body with a cabin and four wheels — reads as a car from above. */
  car(g, { w, d }, it) {
    const paint = new THREE.MeshStandardMaterial({
      color: CAR_PAINT[(it.variant ?? 0) % CAR_PAINT.length],
      roughness: 0.3, metalness: 0.45,
    });
    g.add(box(w * 0.92, 0.55, d * 0.98, paint, 0, 0.22));
    g.add(box(w * 0.8, 0.42, d * 0.46, paint, 0, 0.72));
    g.add(box(w * 0.78, 0.3, d * 0.44, M.dark, 0, 0.78));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const wheel = cyl(0.33, 0.2, M.dark, sx * w * 0.44, 0.23, sz * d * 0.32);
        wheel.rotation.z = Math.PI / 2;
        g.add(wheel);
      }
    }
  },

  toilet(g, { w, d }) {
    g.add(box(w * 0.55, 0.4, d * 0.65, M.ceramic, 0, 0, d * 0.12));
    g.add(box(w * 0.8, 0.85, d * 0.22, M.ceramic, 0, 0, -d * 0.39));
  },

  basin(g, { w, d }) {
    g.add(box(w, 0.12, d, M.ceramic, 0, 0.8));
    g.add(box(w * 0.6, 0.72, d * 0.5, M.cabinet, 0, 0.08));
    g.add(cyl(0.02, 0.22, M.metal, 0, 0.92, -d * 0.32));
  },

  shower(g, { w, d }) {
    g.add(box(w, 0.08, d, M.ceramic));
    g.add(box(w, 2.0, 0.02, M.glass, 0, 0.08, d / 2));
    g.add(cyl(0.05, 0.03, M.metal, 0, 2.15, -d * 0.3));
  },

  /** Ocak — a glass hob set flush into the worktop, with four burners. */
  hob(g, { w, d }, it) {
    const top = it.y ?? 0.9;
    g.add(box(w, 0.04, d, M.dark, 0, top - 0.03));
    const rx = w * 0.22, rz = d * 0.22;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.add(cyl(Math.min(w, d) * 0.15, 0.012, M.metal, sx * rx, top + 0.01, sz * rz));
    }
  },

  /** Fırın — built-in oven; `face` is the side the door opens onto. */
  oven(g, { w, d }, it) {
    const h = it.h ?? 0.6;
    const y = it.y ?? 0.1;
    g.add(box(w, h, d, M.metal, 0, y));

    const face = it.face ?? 'S';
    const alongZ = face === 'N' || face === 'S';
    const sign = face === 'N' || face === 'W' ? -1 : 1;
    const off = (alongZ ? d : w) / 2 + 0.015;

    const pw = alongZ ? w * 0.92 : 0.03;
    const pd = alongZ ? 0.03 : d * 0.92;
    const door = box(pw, h * 0.8, pd, M.dark, 0, y + h * 0.08);
    const bar = box(alongZ ? w * 0.7 : 0.04, 0.04, alongZ ? 0.04 : d * 0.7,
      M.metal, 0, y + h * 0.82);
    for (const m of [door, bar]) {
      if (alongZ) m.position.z = sign * off; else m.position.x = sign * off;
      g.add(m);
    }
  },

  appliance(g, { w, d }, it) {
    const h = it.h ?? 0.85;
    g.add(box(w, h, d, M.ceramic));
    const door = cyl(Math.min(w, d) * 0.28, 0.03, M.dark, 0, h * 0.5, d / 2);
    door.rotateX(Math.PI / 2);
    g.add(door);
  },

  tv(g, { w, d }, it) {
    g.add(box(Math.max(w, 0.05), it.h ?? 0.62, Math.max(d, 0.05), M.dark, 0, it.y ?? 1.05));
  },

  /**
   * A straight flight. `dir` is the direction of ascent; steps divide the
   * rect's long axis, rising `riser` each. `base` is the level the flight
   * starts from — steps are still solid down to the floor, so the upper
   * flight of a switchback reads as a closed stair with usable space beneath.
   */
  stairs(g, { w, d }, it) {
    const n = it.steps ?? 9;
    const riser = it.riser ?? 0.17;
    // `from` is the level the flight starts at, relative to its floor's slab —
    // negative for a flight descending from the storey it is modelled on.
    // `bottom` is how far the solid mass reaches down (defaults to `from`).
    const from = it.from ?? 0;
    const bottom = it.bottom ?? from;
    const vertical = it.dir === 'N' || it.dir === 'S';
    const span = vertical ? d : w;
    const run = span / n;
    const sign = it.dir === 'N' || it.dir === 'W' ? -1 : 1;

    // `solid: false` gives an open soffit — treads and risers only — so a
    // flight passing over a room does not fill it in.
    const solid = it.solid !== false;

    for (let i = 0; i < n; i++) {
      const top = from + riser * (i + 1);
      const centre = sign * (-span / 2 + run * (i + 0.5));
      if (solid) {
        const h = top - bottom;
        if (h <= 0) continue;
        g.add(vertical
          ? box(w, h, run, M.counter, 0, bottom, centre)
          : box(run, h, d, M.counter, centre, bottom, 0));
        continue;
      }
      const tread = 0.06;
      g.add(vertical
        ? box(w, tread, run, M.counter, 0, top - tread, centre)
        : box(run, tread, d, M.counter, centre, top - tread, 0));
      // Riser board closing the back of each tread.
      const rb = sign * (centre - sign * run / 2);
      g.add(vertical
        ? box(w, riser, 0.04, M.counter, 0, top - riser - tread, rb)
        : box(0.04, riser, d, M.counter, rb, top - riser - tread, 0));
    }
  },
};

/** Posts-and-rails run along a polyline — balcony edges and the void. */
function buildRailing(item, offsetPx) {
  const group = new THREE.Group();
  group.name = item.name ?? 'railing';
  const h = item.h ?? 1.1;
  const pts = item.path.map((p) => toWorld(p, offsetPx));

  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-3) continue;

    const seg = new THREE.Group();
    seg.position.set(ax, item.y ?? 0, az);
    seg.rotation.y = Math.atan2(-(bz - az), bx - ax);

    seg.add(box(len, 0.06, 0.06, M.metal, len / 2, h - 0.06));
    seg.add(box(len, 0.03, 0.04, M.metal, len / 2, h * 0.5));
    const posts = Math.max(2, Math.round(len / 1.1));
    for (let p = 0; p <= posts; p++) {
      seg.add(box(0.05, h - 0.06, 0.05, M.metal, (len * p) / posts));
    }
    group.add(seg);
  }
  return group;
}

/** Build one floor's objects, in the same frame buildWalls() uses. */
export function buildObjects(floor, place) {
  const group = new THREE.Group();
  group.name = `objects:${floor.id}`;
  const mpp = PLAN.metersPerPixel;

  for (const item of floor.objects ?? []) {
    if (item.kind === 'railing') {
      const rail = buildRailing(item, place.offsetPx);
      rail.userData.item = item;
      group.add(rail);
      continue;
    }

    const maker = KINDS[item.kind];
    if (!maker) {
      console.warn(`objects: unknown kind "${item.kind}"`);
      continue;
    }

    const [x0, y0, x1, y1] = item.rect;
    const [ax, az] = toWorld([Math.min(x0, x1), Math.min(y0, y1)], place.offsetPx);
    const [bx, bz] = toWorld([Math.max(x0, x1), Math.max(y0, y1)], place.offsetPx);

    const g = new THREE.Group();
    g.position.set((ax + bx) / 2, item.z ?? 0, (az + bz) / 2);
    g.userData.item = item;
    g.userData.floor = floor;
    maker(g, { w: Math.abs(bx - ax), d: Math.abs(bz - az), mpp }, item);
    group.add(g);
  }

  group.position.y = place.elevation;
  return group;
}
