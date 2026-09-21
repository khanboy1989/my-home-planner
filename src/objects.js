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

/** Oak boards, 12 cm wide, one texture repeat per metre; null without a DOM. */
function plankTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#c9975f' : '#d4a46c';
    ctx.fillRect(i * 32, 0, 32, 256);
    ctx.fillStyle = '#a57843';
    ctx.fillRect(i * 32, 0, 2, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Stone-coated S-profile roof tile, charcoal to black: four half-round
 * columns per metre, three courses per metre, granular speckle. One repeat
 * per metre of roof surface.
 */
function tileTexture() {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#26282b';
  ctx.fillRect(0, 0, size, size);

  const cols = 4;
  const rows = 3;
  const cw = size / cols;
  const rh = size / rows;
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < cols; i++) {
      const x = i * cw + (r % 2 ? cw / 2 : 0);
      const grad = ctx.createLinearGradient(x, 0, x + cw, 0);
      grad.addColorStop(0, '#15161a');
      grad.addColorStop(0.5, '#3c3f44');   // crown of the wave catches the light
      grad.addColorStop(1, '#15161a');
      ctx.fillStyle = grad;
      ctx.fillRect(x, r * rh, cw, rh);
      if (x + cw > size) ctx.fillRect(x - size, r * rh, cw, rh); // wrap the offset rows
    }
    ctx.fillStyle = 'rgba(0,0,0,0.65)';       // shadow under each course's lip
    ctx.fillRect(0, r * rh + rh - 7, size, 7);
  }
  for (let n = 0; n < 2600; n++) {            // stone granules
    ctx.fillStyle = `rgba(${n % 2 ? '255,255,255' : '0,0,0'},${0.05 + (n % 5) * 0.02})`;
    ctx.fillRect((n * 73) % size, (n * 131) % size, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

Object.assign(M, {
  tile:      new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.85, map: tileTexture(), side: THREE.DoubleSide,
  }),
  ridge:     new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.8 }),
  stone:     new THREE.MeshStandardMaterial({ color: 0x8f8677, roughness: 0.95 }),
  stoneLite: new THREE.MeshStandardMaterial({ color: 0xa79e8f, roughness: 0.95 }),
  stoneDark: new THREE.MeshStandardMaterial({ color: 0x6f6858, roughness: 0.97 }),
  paving:    new THREE.MeshStandardMaterial({ color: 0xbdb5a7, roughness: 0.9 }),
  coping:    new THREE.MeshStandardMaterial({ color: 0xe4dfd4, roughness: 0.7 }),
  poolTile:  new THREE.MeshStandardMaterial({ color: 0x7fc4d6, roughness: 0.4, emissive: 0x1f5f73 }),
  frame:     new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.45, metalness: 0.3 }),
  oak:       new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, map: plankTexture() }),
  bark:      new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.95 }),
  leaf:      new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 0.9, flatShading: true }),
  leafLite:  new THREE.MeshStandardMaterial({ color: 0x74994a, roughness: 0.9, flatShading: true }),
  terracotta: new THREE.MeshStandardMaterial({ color: 0xb5643c, roughness: 0.85 }),
  soil:      new THREE.MeshStandardMaterial({ color: 0x3b2f26, roughness: 1 }),
  // Unlit, so the house's shadow can't turn the pool black.
  water:     new THREE.MeshBasicMaterial({ color: 0x35b9ee, transparent: true, opacity: 0.6 }),
  poolBed:   new THREE.MeshBasicMaterial({ color: 0x2f9fc4 }),
  lawn:      new THREE.MeshStandardMaterial({ color: 0x6f8457, roughness: 1 }),
  parasol:   new THREE.MeshStandardMaterial({ color: 0xf3eee3, roughness: 0.8, side: THREE.DoubleSide }),
});


/** Pool rim, working inwards from the drawn outline: kerb, channel, coping (m). */
const POOL_RIM = { kerb: 0.2, chan: 0.32, cope: 0.25 };

/** The pool's water rectangle in sheet px, given its outline rect. */
export function poolBasinPx([x0, y0, x1, y1]) {
  const inset = (POOL_RIM.kerb + POOL_RIM.chan + POOL_RIM.cope) / PLAN.metersPerPixel;
  return [x0 + inset, y0 + inset, x1 - inset, y1 - inset];
}
const RUN_TURN = { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 };

/**
 * A group turned so its local -Z (the "back") faces `back`, plus the run's
 * length along the wall and its depth off it, from the rect's w × d.
 */
function backedRun(g, { w, d }, back = 'N') {
  const alongX = back === 'N' || back === 'S';
  const run = new THREE.Group();
  run.rotation.y = RUN_TURN[back];
  g.add(run);
  return { run, len: alongX ? w : d, depth: alongX ? d : w };
}

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

M.headlight = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff0b8, emissiveIntensity: 0.6 });
M.taillight = new THREE.MeshStandardMaterial({ color: 0xc02020, emissive: 0x801010, emissiveIntensity: 0.6 });

/**
 * Sets a vehicle up in the rect's centre at its real size, nose to `it.nose`
 * (default 'N'), then hands `build` a group with the nose at local -Z.
 * The paint comes from `it.paint`, falling back to `defaultPaint`.
 */
function vehicle(g, { w, d }, it, real, build, defaultPaint) {
  const L = Math.min(d, real.length);
  const W = Math.min(w, real.width);
  const paint = new THREE.MeshStandardMaterial({
    color: it.paint ?? defaultPaint, roughness: 0.3, metalness: 0.5,
  });
  const v = new THREE.Group();
  v.rotation.y = (it.nose ?? 'N') === 'S' ? Math.PI : 0;
  g.add(v);
  build(v, W, L, paint);
}

/** Wheels plus head and tail lamps, shared by every vehicle. */
function runningGear(v, W, L, { wheelR, frontAxle, rearAxle, lightY }) {
  const width = 0.22;
  for (const [z, x] of [
    [-L / 2 + frontAxle, -1], [-L / 2 + frontAxle, 1], [L / 2 - rearAxle, -1], [L / 2 - rearAxle, 1],
  ]) {
    const px = x * (W / 2 - width / 2 - 0.02);
    const tyre = cyl(wheelR, width, M.dark, px, wheelR - width / 2, z);
    tyre.rotation.z = Math.PI / 2;
    const hub = cyl(wheelR * 0.55, width + 0.02, M.metal, px, wheelR - width / 2 - 0.01, z);
    hub.rotation.z = Math.PI / 2;
    v.add(tyre, hub);
  }
  for (const s of [-1, 1]) {
    v.add(box(0.3, 0.08, 0.03, M.headlight, s * W * 0.34, lightY, -L / 2 - 0.01));
    v.add(box(0.3, 0.08, 0.03, M.taillight, s * W * 0.34, lightY + 0.04, L / 2 + 0.01));
  }
}

// ── makers ──────────────────────────────────────────────────────────────
// Each receives (g, { w, d }, item) with `g` already centred on the rect.

const KINDS = {
  /** Generic slab — counters, wardrobes, tables, cabinets. */
  box(g, { w, d }, it) {
    g.add(box(w, it.h ?? 0.9, d, M[it.mat] ?? M.wood, 0, it.y ?? 0, 0));
  },

  /**
   * One run of dressing-room wardrobe: drawers below, open hanging/shelving
   * above. `back` names the wall it stands against, as for sofas.
   */
  wardrobe(g, { w, d }, it) {
    const { run, len, depth } = backedRun(g, { w, d }, it.back);
    const h = it.h ?? 2.2;
    const face = depth / 2 + 0.006; // front face, local +Z (back is local -Z)
    const drawerTop = 0.9;

    run.add(box(len, 0.08, depth * 0.9, M.dark, 0, 0, depth * 0.05));       // plinth
    run.add(box(len, h - 0.08, depth, M.cabinet, 0, 0.08, 0));               // carcass

    const drawers = Math.max(1, Math.round(len / 0.5));
    const drawerW = len / drawers;
    for (let i = 0; i < drawers; i++) {
      const x = -len / 2 + drawerW * (i + 0.5);
      run.add(box(drawerW - 0.03, drawerTop - 0.12, 0.012, M.linen, x, 0.1, face));
      run.add(box(0.18, 0.02, 0.02, M.metal, x, drawerTop - 0.2, face + 0.012));
    }

    const openH = h - drawerTop - 0.12;
    run.add(box(len * 0.97, openH, 0.012, M.dark, 0, drawerTop + 0.04, face));  // open bay
    for (const t of [0.3, 0.62, 0.92]) {
      run.add(box(len * 0.97, 0.02, depth * 0.85, M.cabinet, 0, drawerTop + 0.04 + openH * t, face - depth * 0.42));
    }
    run.add(box(len * 0.95, 0.025, 0.025, M.metal, 0, drawerTop + openH * 0.62 - 0.08, face));
  },

  /** Dining table: slab top on four square legs. */
  table(g, { w, d }, it) {
    const h = it.h ?? 0.75;
    g.add(box(w, 0.05, d, M.wood, 0, h - 0.05));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        g.add(box(0.07, h - 0.05, 0.07, M.wood, sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08)));
      }
    }
  },

  /** Sun lounger; long axis along X, raised backrest at the west end. */
  lounger(g, { w, d }) {
    const seatY = 0.28;
    g.add(box(w, 0.04, d * 0.92, M.metal, 0, seatY - 0.04));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        g.add(box(0.04, seatY - 0.04, 0.04, M.metal, sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06)));
      }
    }
    g.add(box(w * 0.66, 0.08, d * 0.88, M.linen, w * 0.17, seatY));
    const restLen = w * 0.34;
    const tilt = 0.6; // rad
    const rest = box(restLen, 0.08, d * 0.88, M.linen);
    rest.position.set(-w / 2 + restLen / 2 * Math.cos(tilt) + 0.02, seatY + 0.04 + restLen / 2 * Math.sin(tilt), 0);
    rest.rotation.z = -tilt;
    g.add(rest);
  },

  /**
   * Masonry barbecue: a rubble-stone counter on the left, a raised grill bay
   * with hood and flue on the right. `back` names the wall/edge it stands
   * against; the working face is the opposite side.
   */
  barbecue(g, { w, d }, it) {
    const { run, len, depth } = backedRun(g, { w, d }, it.back);
    const counterH = 0.9;
    const bay = Math.min(len * 0.5, 1.0);
    const bayX = len / 2 - bay / 2;
    const tones = [M.stone, M.stoneLite, M.stoneDark];

    run.add(box(len, counterH, depth, M.stoneDark));
    run.add(box(len - bay, 0.05, depth + 0.06, M.counter, -bay / 2, counterH));

    // Rubble facing: staggered courses of mixed-width blocks on the front face.
    const widths = [0.42, 0.3, 0.36, 0.26];
    for (let row = 0; row < 5; row++) {
      let x = -len / 2 + (row % 2 ? 0.18 : 0);
      for (let i = row; x < len / 2 - 0.02; i++) {
        const bw = Math.min(widths[i % widths.length], len / 2 - x);
        if (bw > 0.05) {
          run.add(box(bw - 0.02, 0.16, 0.03, tones[(i * 7 + row * 3) % 3], x + bw / 2, 0.02 + row * 0.176, depth / 2 + 0.014));
        }
        x += bw;
      }
    }

    // Grill bay: stone kerb round a charcoal bed and grate.
    const kerb = 0.12;
    run.add(box(bay, 0.18, kerb, M.stone, bayX, counterH, depth / 2 - kerb / 2));
    for (const s of [-1, 1]) {
      run.add(box(kerb, 0.18, depth - kerb, M.stone, bayX + s * (bay / 2 - kerb / 2), counterH, -kerb / 2));
    }
    run.add(box(bay - kerb * 2, 0.05, depth - kerb * 2, M.dark, bayX, counterH));
    run.add(box(bay - kerb * 2 - 0.04, 0.02, depth - kerb * 2 - 0.04, M.metal, bayX, counterH + 0.14));

    // Back wall, hood and flue.
    run.add(box(bay, 1.7, 0.25, M.stone, bayX, counterH, -depth / 2 + 0.125));
    run.add(box(bay, 0.3, depth * 0.55, M.stoneDark, bayX, 1.55, -depth / 2 + depth * 0.275));
    run.add(box(0.45, (it.flueTop ?? 2.85) - 2.0, 0.4, M.stone, bayX, 2.0, -depth / 2 + 0.2));
  },

  /**
   * Swimming pool. The rect is the whole drawn outline (PDF 513..1188 ×
   * 669..1103); working inwards it is kerb, overflow channel ("Taşma
   * Kanalı"), coping, then the water. The floor is a shallow flat, a ramp
   * (RAMPA %17) and the -1.50 deep end, west to east.
   */
  pool(g, { w, d, mpp }) {
    const { kerb, chan, cope } = POOL_RIM;
    const inset = kerb + chan + cope;
    const wi = w - inset * 2;
    const di = d - inset * 2;

    const ring = (ow, od, iw, id, h, mat) => {
      g.add(box(ow, h, (od - id) / 2, mat, 0, 0, -(od + id) / 4));
      g.add(box(ow, h, (od - id) / 2, mat, 0, 0, (od + id) / 4));
      g.add(box((ow - iw) / 2, h, id, mat, -(ow + iw) / 4, 0, 0));
      g.add(box((ow - iw) / 2, h, id, mat, (ow + iw) / 4, 0, 0));
    };
    ring(w, d, w - kerb * 2, d - kerb * 2, 0.06, M.stone);
    ring(w - kerb * 2, d - kerb * 2, w - (kerb + chan) * 2, d - (kerb + chan) * 2, 0.03, M.dark);
    ring(w - (kerb + chan) * 2, d - (kerb + chan) * 2, wi, di, 0.07, M.coping);

    const wall = 0.06, deep = 1.5, shallow = 1.16;
    g.add(box(wi, deep, wall, M.poolTile, 0, -deep, -di / 2 + wall / 2));
    g.add(box(wi, deep, wall, M.poolTile, 0, -deep, di / 2 - wall / 2));
    g.add(box(wall, deep, di, M.poolTile, -wi / 2 + wall / 2, -deep, 0));
    g.add(box(wall, deep, di, M.poolTile, wi / 2 - wall / 2, -deep, 0));

    const shallowLen = 149 * mpp;
    const rampEnd = 335 * mpp;
    const rampRun = rampEnd - shallowLen;
    const slope = Math.atan2(-(deep - shallow), rampRun);
    const x0 = -wi / 2;

    g.add(box(shallowLen, 0.05, di, M.poolBed, x0 + shallowLen / 2, -shallow - 0.05));
    const ramp = box(Math.hypot(rampRun, deep - shallow), 0.05, di, M.poolBed);
    ramp.position.set(x0 + (shallowLen + rampEnd) / 2, -(shallow + deep) / 2 - 0.025, 0);
    ramp.rotation.z = slope;
    g.add(ramp);
    g.add(box(wi - rampEnd, 0.05, di, M.poolBed, x0 + rampEnd + (wi - rampEnd) / 2, -deep - 0.05));

    g.add(box(wi, 0.01, di, M.water, 0, -0.08)); // just under the coping lip
  },

  /**
   * Glazed room on a terrace: floor-to-ceiling glass in black frames under a
   * mono-pitch glass roof that leans on the house wall (the north edge of the
   * rect) and falls to the south. `sides` lists the glazed edges; W/E/N/S
   * take optional `from`/`to` (sheet px along the edge, from its north/west
   * end) and `door: true` fits a sliding-door leaf to the middle panel.
   */
  glassroom(g, { w, d, mpp }, it) {
    const wallH = it.h ?? 2.7;
    const roofHigh = it.roofHigh ?? 2.95;
    const roofLow = it.roofLow ?? 2.55;
    const overhang = 0.35;
    const post = 0.06;

    const glazedRun = ({ side, from, to, door }) => {
      const alongX = side === 'N' || side === 'S';
      const full = alongX ? w : d;
      const a = from != null ? from * mpp : 0;
      const b = to != null ? to * mpp : full;
      const len = b - a;
      const mid = -full / 2 + (a + b) / 2;
      const fixed = { N: -d / 2 + post / 2, S: d / 2 - post / 2, W: -w / 2 + post / 2, E: w / 2 - post / 2 }[side];
      const at = (along, y, sx, sy, sz, mat) => {
        const [x, z] = alongX ? [along, fixed] : [fixed, along];
        const [bx, bz] = alongX ? [sx, sz] : [sz, sx];
        g.add(box(bx, sy, bz, mat, x, y, z));
      };

      at(mid, 0.05, len, wallH - 0.1, 0.012, M.glass);
      at(mid, wallH - post, len, post, post * 1.2, M.frame);   // head rail
      at(mid, 0, len, 0.05, post * 1.2, M.frame);              // bottom rail
      const panels = Math.max(1, Math.round(len / 1.0));
      for (let i = 0; i <= panels; i++) {
        at(-full / 2 + a + (len * i) / panels, 0, post, wallH, post, M.frame);
      }
      if (door) {
        const doorW = len / panels;
        const c = mid;
        at(c, 2.1, doorW, post * 0.8, post, M.frame);          // leaf transom
        at(c - doorW / 2, 0, post * 1.6, wallH, post * 1.6, M.frame);
        at(c + doorW / 2, 0, post * 1.6, wallH, post * 1.6, M.frame);
        at(c + doorW * 0.3, 0.95, 0.025, 0.9, 0.035, M.metal);  // handle
      }
    };
    (it.sides ?? []).forEach(glazedRun);

    // Roof: glass panel between black rafters, high at the wall, low at the eave.
    const run = d + overhang;
    const drop = roofHigh - roofLow;
    const slope = Math.atan2(drop, run);
    const length = Math.hypot(run, drop);
    const roofW = w + 0.2;
    const roof = new THREE.Group();
    roof.position.set(0, (roofHigh + roofLow) / 2, -d / 2 + run / 2);
    roof.rotation.x = slope;
    g.add(roof);

    roof.add(box(roofW, 0.02, length, M.glass, 0, 0, 0));
    const rafters = Math.max(2, Math.round(w / 0.9));
    for (let i = 0; i <= rafters; i++) {
      roof.add(box(0.05, 0.1, length, M.frame, -roofW / 2 + (roofW * i) / rafters, -0.05, 0));
    }
    for (const t of [-0.5, -0.17, 0.17, 0.5]) {
      roof.add(box(roofW, 0.05, 0.05, M.frame, 0, 0.02, t * length));
    }
    roof.add(box(roofW, 0.12, 0.06, M.frame, 0, -0.06, length / 2)); // eave beam
    roof.add(box(roofW, 0.1, 0.06, M.frame, 0, -0.05, -length / 2)); // wall plate
  },

  /** Potted topiary: terracotta pot, thin stem, two clipped balls. */
  topiary(g, { w }) {
    g.add(cyl(w * 0.42, 0.45, M.terracotta));
    g.add(cyl(0.03, 0.75, M.bark, 0, 0.45));
    for (const [r, y] of [[0.3, 1.3], [0.2, 1.72]]) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), M.leaf);
      m.position.y = y;
      m.castShadow = true;
      g.add(m);
    }
  },

  /** Timber planter box with soil and a row of low shrubs. */
  planter(g, { w, d }, it) {
    const h = it.h ?? 0.55;
    g.add(box(w, h, d, M.oak));
    g.add(box(w - 0.1, 0.04, d - 0.1, M.soil, 0, h));
    const alongX = w >= d;
    const len = alongX ? w : d;
    const n = Math.max(1, Math.round(len / 0.7));
    for (let i = 0; i < n; i++) {
      const t = -len / 2 + (len * (i + 0.5)) / n;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(Math.min(w, d) * 0.5, 1), i % 2 ? M.leafLite : M.leaf);
      m.position.set(alongX ? t : 0, h + 0.22, alongX ? 0 : t);
      m.castShadow = true;
      g.add(m);
    }
  },

  /** Patio parasol: weighted base, pole, and a ribbed canopy. */
  parasol(g, _size, it) {
    const r = it.radius ?? 1.2;
    g.add(cyl(0.28, 0.06, M.stoneDark));
    g.add(cyl(0.025, 2.35, M.metal));
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(r, 0.4, 12, 1, true), M.parasol);
    canopy.position.y = 2.2;
    canopy.castShadow = true;
    g.add(canopy);
    g.add(cyl(0.03, 0.12, M.metal, 0, 2.38));
  },

  /**
   * Hipped roof in black stone-coated tile over a rectangle: eaves at `y`,
   * `pitch` degrees, overhanging by `overhang` m. The ridge runs along the
   * longer side; a square plan comes to a point.
   */
  hiproof(g, { w, d }, it) {
    const overhang = it.overhang ?? 0.3;
    const pitch = THREE.MathUtils.degToRad(it.pitch ?? 22);
    const W = w + overhang * 2;
    const D = d + overhang * 2;
    const alongX = W >= D;
    const half = Math.min(W, D) / 2;       // eave-to-ridge run
    const end = Math.max(W, D) / 2;        // half the long side
    const ridgeHalf = end - half;
    const rise = half * Math.tan(pitch);
    const y0 = it.y ?? 0;

    // (u along the long axis, v across it, height) -> local x/y/z
    const P = (u, v, h) => (alongX ? [u, y0 + h, v] : [v, y0 + h, u]);
    const faces = [
      [P(-end, half, 0), P(end, half, 0), P(ridgeHalf, 0, rise), P(-ridgeHalf, 0, rise)],
      [P(end, -half, 0), P(-end, -half, 0), P(-ridgeHalf, 0, rise), P(ridgeHalf, 0, rise)],
      [P(end, half, 0), P(end, -half, 0), P(ridgeHalf, 0, rise)],
      [P(-end, -half, 0), P(-end, half, 0), P(-ridgeHalf, 0, rise)],
    ];

    const pos = [];
    const uv = [];
    const A = new THREE.Vector3();
    const B = new THREE.Vector3();
    for (const face of faces) {
      // Planar UVs in metres: along the eave, and up the slope.
      const pts = face.map((p) => new THREE.Vector3(...p));
      const e1 = B.subVectors(pts[1], pts[0]).normalize().clone();
      const n = A.subVectors(pts[1], pts[0]).cross(B.subVectors(pts[pts.length - 1], pts[0])).normalize();
      const e2 = new THREE.Vector3().crossVectors(n, e1);
      if (e2.y < 0) e2.negate();
      const tri = face.length === 4 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2];
      for (const i of tri) {
        pos.push(pts[i].x, pts[i].y, pts[i].z);
        const rel = new THREE.Vector3().subVectors(pts[i], pts[0]);
        uv.push(rel.dot(e1), rel.dot(e2));
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, M.tile);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);

    if (ridgeHalf > 0.05) {
      const cap = box(alongX ? ridgeHalf * 2 + 0.2 : 0.16, 0.12, alongX ? 0.16 : ridgeHalf * 2 + 0.2, M.ridge, 0, y0 + rise - 0.02, 0);
      g.add(cap);
    }
  },

  /** Free-standing dressing island with a glass display top. */
  island(g, { w, d }, it) {
    const h = it.h ?? 0.86;
    const rim = 0.06;
    g.add(box(w, h - 0.04, d, M.cabinet));
    g.add(box(w - rim * 2, 0.03, d - rim * 2, M.dark, 0, h - 0.04));            // display well
    g.add(box(w - rim * 2, 0.012, d - rim * 2, M.glass, 0, h - 0.008));          // glass
    g.add(box(w, 0.03, rim, M.cabinet, 0, h - 0.04, -d / 2 + rim / 2));          // rim, four sides
    g.add(box(w, 0.03, rim, M.cabinet, 0, h - 0.04, d / 2 - rim / 2));
    g.add(box(rim, 0.03, d - rim * 2, M.cabinet, -w / 2 + rim / 2, h - 0.04));
    g.add(box(rim, 0.03, d - rim * 2, M.cabinet, w / 2 - rim / 2, h - 0.04));
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

  /** Mercedes-Benz C220 d saloon (W205): 4.69 × 1.81 m. */
  sedan(g, size, it) {
    vehicle(g, size, it, { length: 4.69, width: 1.81 }, (v, W, L, paint) => {
      v.add(box(W * 0.99, 0.18, L * 0.995, M.dark, 0, 0.2));                 // bumpers / skirts
      v.add(box(W * 0.97, 0.5, L, paint, 0, 0.32));                          // body
      v.add(box(W * 0.82, 0.56, L * 0.44, paint, 0, 0.82, L * 0.06));        // cabin
      v.add(box(W * 0.84, 0.3, L * 0.4, M.dark, 0, 0.92, L * 0.06));         // glazing
      v.add(box(W * 0.36, 0.14, 0.03, M.dark, 0, 0.5, -L / 2 - 0.005));      // grille
      const star = cyl(0.055, 0.012, M.metal, 0, 0.6, -L / 2 - 0.02);
      star.rotation.x = Math.PI / 2;
      v.add(star);
      runningGear(v, W, L, { wheelR: 0.33, frontAxle: 0.9, rearAxle: 0.98, lightY: 0.62 });
    }, 0x2d3138);
  },

  /** Mitsubishi L200 (2018) double-cab pickup: 5.30 × 1.82 m, 1.78 m tall. */
  pickup(g, size, it) {
    vehicle(g, size, it, { length: 5.3, width: 1.82 }, (v, W, L, paint) => {
      const bedZ = L * 0.3;                                                   // centre of the load bed
      const bedLen = L * 0.4;
      v.add(box(W * 0.97, 0.45, L, paint, 0, 0.42));                          // chassis / lower body
      v.add(box(W * 0.97, 0.12, L * 0.28, paint, 0, 0.87, -L * 0.36));        // bonnet
      v.add(box(W * 0.9, 0.9, L * 0.32, paint, 0, 0.87, -L * 0.06));          // double cab
      v.add(box(W * 0.92, 0.4, L * 0.3, M.dark, 0, 1.2, -L * 0.06));          // glazing
      v.add(box(W * 0.84, 0.03, bedLen * 0.94, M.dark, 0, 0.87, bedZ));       // bed liner
      for (const s of [-1, 1]) {
        v.add(box(0.06, 0.36, bedLen, paint, s * (W * 0.485 - 0.03), 0.87, bedZ));
      }
      v.add(box(W * 0.97, 0.36, 0.06, paint, 0, 0.87, L / 2 - 0.03));         // tailgate
      v.add(box(W * 0.5, 0.2, 0.04, M.dark, 0, 0.55, -L / 2 - 0.005));       // grille
      v.add(box(W * 0.55, 0.05, 0.05, M.metal, 0, 0.42, -L / 2 - 0.02));      // chrome bar
      runningGear(v, W, L, { wheelR: 0.38, frontAxle: 0.9, rearAxle: 1.25, lightY: 0.72 });
    }, 0xf0f0ee);
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

/** A flat slab over a polygon `path` of sheet pixels — terraces, decks, roofs. */
function buildPaving(item, offsetPx, floor) {
  const pts = item.path.map((p) => toWorld(p, offsetPx));
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));

  // Land is cut away over any pool basin, which is sunk below it.
  if (item.kind === 'land') {
    for (const pool of (floor.objects ?? []).filter((o) => o.kind === 'pool')) {
      const [x0, y0, x1, y1] = poolBasinPx(pool.rect);
      const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map((c) => toWorld(c, offsetPx));
      shape.holes.push(new THREE.Path(corners.map(([x, z]) => new THREE.Vector2(x, z))));
    }
  }
  const h = item.h ?? 0.04;
  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }),
    M[item.mat] ?? M.paving,
  );
  // Shape XY -> world XZ; the extrusion then runs down from y = h to 0.
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = (item.y ?? 0) + h;
  mesh.receiveShadow = true;
  mesh.userData.roof = item.roof === true; // main.js hides these on the O key
  return mesh;
}

/** Build one floor's objects, in the same frame buildWalls() uses. */
export function buildObjects(floor, place) {
  const group = new THREE.Group();
  group.name = `objects:${floor.id}`;
  const mpp = PLAN.metersPerPixel;

  for (const item of floor.objects ?? []) {
    // `only: 'stacked'` items (the tile roofs) are left out of the other model.
    if (item.only && item.only !== place.mode) continue;

    if (item.kind === 'railing') {
      const rail = buildRailing(item, place.offsetPx);
      rail.userData.item = item;
      group.add(rail);
      continue;
    }

    if (item.kind === 'paving' || item.kind === 'land') {
      const slab = buildPaving(item, place.offsetPx, floor);
      slab.userData.item = item;
      group.add(slab);
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
    g.rotation.y = -THREE.MathUtils.degToRad(item.rot ?? 0); // degrees clockwise on the page
    g.userData.item = item;
    g.userData.floor = floor;
    g.userData.roof = item.roof === true; // main.js hides these on the O key
    maker(g, { w: Math.abs(bx - ax), d: Math.abs(bz - az), mpp }, item);
    group.add(g);
  }

  group.position.y = place.elevation;
  return group;
}
