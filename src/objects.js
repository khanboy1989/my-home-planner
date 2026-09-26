import * as THREE from 'three';
import { PLAN, toWorld } from './floorplan.js';
import { emitter } from './lights.js';

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

/** Cream rug with soft clouds and sweeping gold strokes, after the owner's reference. */
function rugTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 384;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e7dece';
  ctx.fillRect(0, 0, 512, 384);
  for (const [x, y, r, a] of [[120, 90, 140, 0.35], [380, 260, 170, 0.3], [300, 60, 120, 0.25]]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 384);
  }
  ctx.strokeStyle = 'rgba(190,150,96,0.6)';
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    ctx.lineWidth = 10 + (i % 3) * 6;
    ctx.beginPath();
    ctx.moveTo(40 + i * 30, 340 - i * 22);
    ctx.bezierCurveTo(140 + i * 40, 40 + i * 30, 300, 400 - i * 25, 470 - i * 10, 60 + i * 35);
    ctx.stroke();
  }
  ctx.strokeStyle = '#b8996a';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 500, 372);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
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
  frond:     new THREE.MeshStandardMaterial({ color: 0x3d6b2f, roughness: 0.85, side: THREE.DoubleSide }),
  frondLite: new THREE.MeshStandardMaterial({ color: 0x5f9a3c, roughness: 0.85, side: THREE.DoubleSide }),
  bananaLeaf: new THREE.MeshStandardMaterial({ color: 0x74b03f, roughness: 0.8, side: THREE.DoubleSide }),
  bananaStem: new THREE.MeshStandardMaterial({ color: 0xa3b56f, roughness: 0.9 }),
  trunkPalm: new THREE.MeshStandardMaterial({ color: 0x6e5a44, roughness: 1 }),
  cream:     new THREE.MeshStandardMaterial({ color: 0xe9e0cf, roughness: 0.9 }),
  creamGloss: new THREE.MeshStandardMaterial({ color: 0xf1ebdf, roughness: 0.12, metalness: 0.05 }),
  gold:      new THREE.MeshStandardMaterial({ color: 0xc9a66b, roughness: 0.3, metalness: 0.85 }),
  warm:      new THREE.MeshBasicMaterial({ color: 0xffdfae }),
  flame:     new THREE.MeshBasicMaterial({ color: 0xff8a2a }),
  glow:      new THREE.MeshBasicMaterial({ color: 0xff7a1f, transparent: true, opacity: 0.4 }),
  niche:     new THREE.MeshStandardMaterial({ color: 0xd8b98a, roughness: 0.8, emissive: 0x6b4a1f, emissiveIntensity: 0.6 }),
  sheer:     new THREE.MeshStandardMaterial({ color: 0xfaf6ee, roughness: 1, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  drape:     new THREE.MeshStandardMaterial({ color: 0xcbbd9f, roughness: 1 }),
  rug:       new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, map: rugTexture() }),
  hearth:    new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide }),
  ember:     new THREE.MeshBasicMaterial({ color: 0xff6a1a }),
  parasol:   new THREE.MeshStandardMaterial({ color: 0xf3eee3, roughness: 0.8, side: THREE.DoubleSide }),
  ceilBand:  new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.95 }),
});

/**
 * Rooms are written at their wall centrelines, like the walls. This is the
 * inset back to the plaster: half an interior wall is 0.075 m and half an
 * exterior 0.125 m, so one figure between them is a couple of centimetres out
 * at worst — nothing at ceiling height, and it keeps the room table readable.
 */
const ROOM_INSET = 0.1;


/** Pool rim, working inwards from the drawn outline: kerb, channel, coping (m). */
const POOL_RIM = { kerb: 0.2, chan: 0.32, cope: 0.25 };

/** The pool's water rectangle in sheet px, given its outline rect. */
export function poolBasinPx([x0, y0, x1, y1]) {
  const inset = (POOL_RIM.kerb + POOL_RIM.chan + POOL_RIM.cope) / PLAN.metersPerPixel;
  return [x0 + inset, y0 + inset, x1 - inset, y1 - inset];
}
/**
 * A sub-group that only exists after dark: the glowing lenses of a fitting and
 * the emitters that go with them. `setTime()` in main.js shows and hides every
 * group tagged this way, so a fitting's housing stays on the wall by day while
 * its light does not. Emitters inside a hidden group are still collected —
 * the pool checks the clock, not the group.
 */
function nightGroup(parent) {
  const g = new THREE.Group();
  g.userData.nightLight = true;
  g.visible = false;
  parent.add(g);
  return g;
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

/** Fruit-coloured materials, made on first use. */
const FRUIT_COLOURS = {
  orange: 0xe8912a, lemon: 0xe9d63a, mango: 0xd9772b, pomegranate: 0xb3262c,
  fig: 0x5a3a63, avocado: 0x3e5b2e, date: 0xb8631f, papaya: 0xe89b2a, banana: 0xd9c93a,
};
const fruitMats = {};
const fruitMat = (name) => (fruitMats[name] ??= new THREE.MeshStandardMaterial({
  color: FRUIT_COLOURS[name] ?? FRUIT_COLOURS.orange, roughness: 0.6,
}));

/**
 * Toddler-toy colours, made on first use. Kept saturated and soft so the play
 * room reads as a nursery against the house's cream-and-gold palette.
 */
const TOY_COLOURS = {
  red: 0xd8544a, blue: 0x3f87c9, yellow: 0xf0c04a, green: 0x5aa85c,
  pink: 0xe58fb2, purple: 0x8f74c4, orange: 0xe8913f, mint: 0x79c9bd,
  hide: 0xd9b48a, mane: 0x6b4a33,
};
const toyMats = {};
const toyMat = (name) => (toyMats[name] ??= new THREE.MeshStandardMaterial({
  color: TOY_COLOURS[name] ?? name, roughness: 0.85,
}));

function ball(r, mat, x, y, z, detail = 1) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/**
 * A leaf or palm frond that rises off its base then arches over: two flat
 * segments, the second hinged at the end of the first. Points along local +Z.
 */
function arch(len, width, mat, rise, droop) {
  const seg = (l) => {
    const geo = new THREE.BoxGeometry(width, 0.02, l);
    geo.translate(0, 0, l / 2);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    return m;
  };
  const a = new THREE.Group();
  a.rotation.x = -rise;
  a.add(seg(len / 2));
  const b = new THREE.Group();
  b.position.z = len / 2;
  b.rotation.x = droop;
  b.add(seg(len / 2));
  a.add(b);
  return a;
}

/** Tiny deterministic scatter in [0,1) so trees differ but stay stable. */
const scatter = (seed, i) => ((Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % 1 + 1) % 1;

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

    // Light inside the wardrobe, on the owner's instruction — the dressing
    // rooms' runs are open bays, so a strip under the top of the carcass
    // lights the rail and the shelves. `lit: false` opts out (the bedroom and
    // playroom runs are closed cupboards).
    if (it.lit) {
      const lamp = nightGroup(run);
      const top = drawerTop + 0.04 + openH - 0.03;
      lamp.add(box(len * 0.9, 0.012, 0.03, M.warm, 0, top, face - 0.05));
      const spots = Math.max(1, Math.round(len / 0.8));
      for (let i = 0; i < spots; i++) {
        emitter(lamp, {
          at: [-len / 2 + (len / spots) * (i + 0.5), top - 0.02, face - 0.06],
          aim: [0, -1, -0.15],
          intensity: 1.8, distance: 2.2, angle: 0.9, penumbra: 0.85, interior: true,
        });
      }
    }
  },

  /**
   * Upper kitchen cabinets hung on a wall, from `y` (1.5 m, 0.6 m clear of
   * the worktop) up to `top` (2.95 m, just under the 3.0 m ceiling that the
   * first-floor slab makes). One door front per ~0.5 m, each with a pull near
   * its lower edge. `back` names the wall it hangs on.
   */
  wallcabinet(g, { w, d }, it) {
    const { run, len, depth } = backedRun(g, { w, d }, it.back);
    const y = it.y ?? 1.5;
    const h = (it.top ?? 2.95) - y;
    const face = depth / 2 + 0.006;
    run.add(box(len, h, depth, M.cabinet, 0, y, 0));

    const doors = Math.max(1, Math.round(len / 0.5));
    const doorW = len / doors;
    for (let i = 0; i < doors; i++) {
      const x = -len / 2 + doorW * (i + 0.5);
      run.add(box(doorW - 0.012, h - 0.02, 0.012, M.linen, x, y + 0.01, face));
      const pull = x + (i % 2 ? -1 : 1) * (doorW / 2 - 0.06);
      run.add(box(0.02, 0.16, 0.02, M.metal, pull, y + 0.08, face + 0.012));
    }

    // Under-cabinet lighting, on the owner's instruction: a recessed strip
    // along the front edge of every kitchen and KILER run, washing the
    // worktop below. It is part of the cabinet rather than a separate item so
    // that moving a run takes its light with it. `lit: false` opts out.
    if (it.lit !== false) {
      const lamp = nightGroup(run);
      lamp.add(box(len - 0.1, 0.012, 0.03, M.warm, 0, y - 0.006, depth / 2 - 0.05));
      const spots = Math.max(1, Math.round(len / 0.9));
      for (let i = 0; i < spots; i++) {
        emitter(lamp, {
          at: [-len / 2 + (len / spots) * (i + 0.5), y - 0.02, depth / 2 - 0.05],
          aim: [0, -1, 0.35],                       // down and out over the worktop
          intensity: 2.6, distance: 2.6, angle: 0.85, penumbra: 0.8, interior: true,
        });
      }
    }
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

  /**
   * Palm. `species: 'date'` is a tall ringed trunk with a crown of arching
   * fronds and hanging fruit clusters; `'papaya'` is a slim trunk with a
   * rosette of leaves and fruit close under it. `seed` varies each tree.
   */
  palm(g, _size, it) {
    const seed = it.seed ?? 0;
    const papaya = it.species === 'papaya';
    const P = papaya
      ? { h: 3.0, r0: 0.11, r1: 0.07, n: 9, len: 1.3, width: 0.55, leaf: M.frondLite, fruit: 'papaya', fruitR: 0.13 }
      : { h: 5.6, r0: 0.24, r1: 0.17, n: 16, len: 2.7, width: 0.3, leaf: M.frond, fruit: 'date', fruitR: 0.09 };
    const h = P.h * (0.9 + scatter(seed, 1) * 0.2);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(P.r1, P.r0, h, 10), M.trunkPalm);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    g.add(trunk);
    if (!papaya) {
      for (let y = 0.4; y < h - 0.2; y += 0.35) {          // leaf-base rings
        const r = P.r0 + (P.r1 - P.r0) * (y / h) + 0.015;
        g.add(cyl(r, 0.05, M.bark, 0, y));
      }
    }

    const crown = new THREE.Group();
    crown.position.y = h;
    crown.rotation.y = scatter(seed, 2) * Math.PI * 2;
    for (let i = 0; i < P.n; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (i / P.n) * Math.PI * 2;
      const len = P.len * (0.85 + scatter(seed, 10 + i) * 0.3);
      pivot.add(arch(len, P.width, P.leaf, papaya ? 0.15 : 0.55, papaya ? 0.7 : 1.05));
      crown.add(pivot);
    }
    const fruits = papaya ? 5 : 4;
    for (let i = 0; i < fruits; i++) {
      const a = (i / fruits) * Math.PI * 2 + scatter(seed, 3);
      crown.add(ball(P.fruitR, fruitMat(P.fruit), Math.cos(a) * 0.28, -0.25 - scatter(seed, 20 + i) * 0.15, Math.sin(a) * 0.28));
    }
    g.add(crown);
    g.scale.setScalar(it.scale ?? 1);
  },

  /** Banana clump: three pseudo-stems with broad arching leaves and a bunch. */
  banana(g, _size, it) {
    const seed = it.seed ?? 0;
    const stems = [[0, 0, 3.0], [0.5, 0.3, 2.4], [-0.42, 0.38, 2.0]];
    stems.forEach(([x, z, h], s) => {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, h, 8), M.bananaStem);
      stem.position.set(x, h / 2, z);
      stem.castShadow = true;
      g.add(stem);

      const top = new THREE.Group();
      top.position.set(x, h, z);
      top.rotation.y = scatter(seed, s) * Math.PI * 2;
      for (let k = 0; k < 6; k++) {
        const pivot = new THREE.Group();
        pivot.rotation.y = (k / 6) * Math.PI * 2;
        const len = 1.9 * (0.85 + scatter(seed, 30 + s * 6 + k) * 0.3);
        pivot.add(arch(len, 0.62, M.bananaLeaf, 0.3, 0.85));
        top.add(pivot);
      }
      g.add(top);
    });

    // A hand of bananas and its purple bud on the tallest stem.
    const h = stems[0][2];
    const bud = new THREE.MeshStandardMaterial({ color: 0x5b2a55, roughness: 0.6 });
    g.add(ball(0.09, bud, 0.22, h - 0.55, 0.05));
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.16, 3, 6), fruitMat('banana'));
      f.position.set(0.22 + Math.cos(i) * 0.08, h - 0.78 - (i % 3) * 0.05, 0.05 + Math.sin(i) * 0.08);
      f.rotation.z = 0.5;
      g.add(f);
    }
    g.scale.setScalar(it.scale ?? 1);
  },

  /** Round-crowned fruit tree (mango, citrus, pomegranate, fig ...) dotted with fruit. */
  fruittree(g, _size, it) {
    const seed = it.seed ?? 0;
    const crown = (it.crown ?? 1.3) * (0.9 + scatter(seed, 1) * 0.2);
    const trunk = it.trunk ?? 1.5;
    g.add(cyl(0.1, trunk, M.bark));
    const cy = trunk + crown * 0.55;
    g.add(ball(crown, M.leaf, 0, cy, 0));
    g.add(ball(crown * 0.7, M.leafLite, crown * 0.55, cy - crown * 0.2, crown * 0.2));
    g.add(ball(crown * 0.65, M.leafLite, -crown * 0.5, cy - crown * 0.15, -crown * 0.3));
    for (let i = 0; i < 16; i++) {
      const a = scatter(seed, 40 + i) * Math.PI * 2;
      const e = 0.2 + scatter(seed, 60 + i) * 0.9;        // elevation on the crown
      const r = crown * 0.98;
      const x = Math.cos(a) * Math.cos(e) * r;
      const y = cy + Math.sin(e) * r * 0.85 - crown * 0.25;
      const z = Math.sin(a) * Math.cos(e) * r;
      g.add(ball(0.075, fruitMat(it.fruit ?? 'orange'), x, y, z, 0));
    }
    g.scale.setScalar(it.scale ?? 1);
  },

  /**
   * Black bar gate in a wall opening. Local X runs along the gate, Z across
   * the wall (+Z is the street side). `style: 'sliding'` is a bi-parting gate,
   * `open` (0..1) slides its two leaves apart; `'swing'` is one leaf hinged at
   * the west end and swung `openDeg` degrees inward (towards -Z).
   */
  gate(g, { w, d }, it) {
    const h = it.h ?? 1.9;
    const bar = 0.12;

    // One leaf of vertical bars between rails, its west edge at x = 0.
    const leaf = (width) => {
      const l = new THREE.Group();
      l.add(box(width, 0.07, 0.05, M.frame, width / 2, 0.14));
      l.add(box(width, 0.07, 0.05, M.frame, width / 2, h - 0.1));
      for (const x of [0.03, width - 0.03]) l.add(box(0.06, h - 0.1, 0.06, M.frame, x, 0.1));
      const n = Math.max(1, Math.floor(width / bar));
      for (let i = 1; i < n; i++) l.add(box(0.02, h - 0.3, 0.02, M.frame, (width * i) / n, 0.18));
      return l;
    };

    if (it.style === 'swing') {
      const l = leaf(w - 0.04);
      l.position.x = -w / 2 + 0.02;
      l.rotation.y = THREE.MathUtils.degToRad(it.openDeg ?? 0);
      g.add(l);
      return;
    }

    const half = (w - 0.06) / 2;
    const slide = (it.open ?? 0) * half;
    for (const s of [-1, 1]) {
      const l = leaf(half);
      // Left leaf slides west along the inside face, right leaf east.
      l.position.set(s < 0 ? -w / 2 + 0.03 - slide : 0.03 + slide, 0, s * 0.02 * (slide > 0 ? 3 : 0));
      g.add(l);
    }
    g.add(box(w, 0.05, 0.16, M.frame, 0, 0));                 // track
  },

  /**
   * Media wall in cream gloss, after the owner's reference: a full-height
   * panel with backlit display niches at each end, a linear fireplace flanked
   * by floating cabinets (or, with `fireplace: false`, one long unit), and
   * the TV above. `back` names the wall it
   * stands against; the rect's long side is the wall length.
   */
  tvwall(g, { w, d }, it) {
    const { run, len, depth } = backedRun(g, { w, d }, it.back);
    const H = it.h ?? 2.8;
    const backZ = -depth / 2;
    const nicheW = 0.65;
    const cw = len - nicheW * 2;                      // centre section width

    run.add(box(len, H, 0.06, M.creamGloss, 0, 0, backZ + 0.03));                // back panel
    run.add(box(len, 0.03, 0.06, M.warm, 0, H - 0.05, backZ + 0.09));            // cove light

    for (const s of [-1, 1]) {                                                    // display niches
      const x = s * (len / 2 - nicheW / 2);
      run.add(box(0.06, H, depth, M.cream, x - (nicheW / 2 - 0.03), 0, 0));
      run.add(box(0.06, H, depth, M.cream, x + (nicheW / 2 - 0.03), 0, 0));
      run.add(box(nicheW, 0.06, depth, M.cream, x, H - 0.06, 0));
      run.add(box(nicheW, 0.25, depth, M.cream, x, 0, 0));
      run.add(box(nicheW - 0.12, H - 0.5, 0.02, M.niche, x, 0.25, backZ + 0.08));
      [0.7, 1.25, 1.8, 2.35].forEach((y, i) => {
        run.add(box(nicheW - 0.12, 0.025, depth - 0.1, M.cream, x, y, 0.02));
        run.add(box(nicheW - 0.16, 0.012, 0.012, M.warm, x, y - 0.012, depth / 2 - 0.08));
        run.add(cyl(0.045, 0.2 + (i % 2) * 0.08, M.ceramic, x - 0.1, y + 0.025, 0.02));
        run.add(ball(0.06, M.gold, x + 0.12, y + 0.09, 0.02));
      });
    }

    if (it.fireplace === false) {                                                // one long floating unit
      run.add(box(cw - 0.02, 0.4, depth - 0.1, M.creamGloss, 0, 0.2, 0.02));
      run.add(box(cw - 0.2, 0.008, 0.01, M.gold, 0, 0.44, depth / 2 - 0.06));
    } else {
      const fw = Math.min(1.25, cw * 0.5);                                       // linear fireplace
      const cabW = (cw - fw) / 2;
      const fz = backZ + 0.06 + 0.13;
      run.add(box(fw, 0.55, 0.26, M.dark, 0, 0.2, fz));
      run.add(box(fw - 0.14, 0.34, 0.01, M.glow, 0, 0.3, fz + 0.135));
      run.add(box(fw - 0.24, 0.06, 0.012, M.flame, 0, 0.32, fz + 0.14));
      for (const y of [0.2, 0.74]) run.add(box(fw + 0.04, 0.015, 0.28, M.gold, 0, y, fz));
      for (const s of [-1, 1]) {
        const x = s * (fw / 2 + cabW / 2);
        run.add(box(cabW - 0.02, 0.4, depth - 0.1, M.creamGloss, x, 0.2, 0.02));
        run.add(box(cabW - 0.12, 0.008, 0.01, M.gold, x, 0.44, depth / 2 - 0.06));
      }
    }

    // Television. `tv` is the diagonal in inches (the owner asked for a bigger
    // one than the 63" this used to draw); the panel is 16:9 plus a thin bezel,
    // and is held to whatever the centre section between the niches will take.
    const diag = (it.tv ?? 85) * 0.0254;
    const tw = Math.min(diag * 0.871 + 0.03, cw - 0.2);       // 16:9 width + bezel
    const th = (tw - 0.03) * 0.5625 + 0.03;
    run.add(box(tw, th, 0.04, M.dark, 0, 1.25, backZ + 0.08));
    run.add(box(tw + 0.04, 0.01, 0.045, M.gold, 0, 1.25, backZ + 0.08));
  },

  /**
   * Wall-mounted sconce — an up/down washer in matt black, on the owner's
   * instruction: two on the balcony's solid return and a pair flanking the
   * front door, so those two places have real light rather than only the
   * band's downlights washing past them.
   *
   * `back` names the wall it hangs on (the side its back is against) and the
   * item's `z` is the mount height; 2.0 m suits a 2.30 m door head. The
   * housing is there day and night — it is a real fitting on the wall — but
   * the lens and the light live in a group tagged `nightLight`, which
   * `setNight()` in main.js switches with the facade band. One spot each,
   * thrown downward: the upward lens does the rest of the look for nothing,
   * and every real light here is paid for by every lit pixel in the scene.
   */
  walllight(g, { w, d }, it) {
    const { run, depth } = backedRun(g, { w, d }, it.back);
    const faceZ = -depth / 2;                       // the wall face
    const bw = 0.1, bh = 0.26, bd = 0.1;            // housing

    run.add(box(bw, bh, bd, M.dark, 0, 0, faceZ + bd / 2));
    run.add(box(bw + 0.03, 0.02, 0.02, M.dark, 0, 0, faceZ + 0.01));   // back plate

    const lit = new THREE.Group();
    lit.userData.nightLight = true;
    lit.visible = false;                            // day is the default view
    run.add(lit);

    for (const s of [-1, 1]) {                      // the two lenses, up and down
      lit.add(box(bw - 0.02, 0.012, bd - 0.02, M.warm, 0, s * (bh / 2 - 0.006), faceZ + bd / 2));
    }

    emitter(lit, {                                  // down the wall, splaying out
      at: [0, -bh / 2, faceZ + bd / 2],
      aim: [0, -2.4, -0.4],
      intensity: it.watts ?? 7, distance: 6.5, angle: 0.72, penumbra: 0.62,
    });
  },

  /**
   * The dropped perimeter ceiling and its corner spots, one per room, on the
   * owner's instruction: a band 20 cm wide round the inside of the room,
   * dropped 15 cm below the slab soffit, with a downlight recessed into it at
   * each corner. That is what gives walk mode real light in every room instead
   * of a flat wash from the sky.
   *
   * The `rect` is the room at its **wall centrelines**, which is how the walls
   * themselves are written; `ROOM_INSET` takes it back to the plaster. Half a
   * wall is 0.125 m on an exterior and 0.075 m on an interior, so a single
   * inset is 2–3 cm out at worst, which at 2.85 m above the floor nobody sees.
   *
   * `h` is the ceiling — 3.0 m, the underside of the slab above, and 6.4 m
   * over a double-height room like GIRIS HOLU. The corner spots sit in from
   * the corner by the band's own width so the cone clears the return.
   */
  coffer(g, { w, d }, it) {
    const ceiling = it.h ?? PLAN.storeyHeight;
    const band = it.band ?? 0.2;                  // how far in from the wall
    const drop = it.drop ?? 0.15;                 // how far below the ceiling
    const iw = w - ROOM_INSET * 2;
    const id = d - ROOM_INSET * 2;
    if (iw < band * 2.5 || id < band * 2.5) return;   // too small to coffer
    const y = ceiling - drop / 2;

    // The band as four returns, mitred by shortening the side pieces.
    g.add(box(iw, drop, band, M.ceilBand, 0, y, -id / 2 + band / 2));
    g.add(box(iw, drop, band, M.ceilBand, 0, y, id / 2 - band / 2));
    g.add(box(band, drop, id - band * 2, M.ceilBand, -iw / 2 + band / 2, y, 0));
    g.add(box(band, drop, id - band * 2, M.ceilBand, iw / 2 - band / 2, y, 0));

    const lamp = nightGroup(g);
    const soffit = ceiling - drop;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (iw / 2 - band / 2);
        const z = sz * (id / 2 - band / 2);
        lamp.add(cyl(0.05, 0.01, M.warm, x, soffit + 0.004, z, 12));
        emitter(lamp, {
          at: [x, soffit, z],
          aim: [-sx * 0.55, -1, -sz * 0.55],       // down and back into the room
          intensity: it.watts ?? 5.5, distance: 7, angle: 0.72, penumbra: 0.6,
          interior: true,
        });
      }
    }
  },

  /**
   * One flush ceiling light in the middle of the room — what the dressing
   * rooms get instead of a coffer, on the owner's instruction, because they
   * are small and walled with wardrobe.
   */
  ceilinglight(g, _size, it) {
    const ceiling = it.h ?? PLAN.storeyHeight;
    g.add(cyl(0.16, 0.05, M.ceilBand, 0, ceiling - 0.025, 0, 20));
    const lamp = nightGroup(g);
    lamp.add(cyl(0.14, 0.012, M.warm, 0, ceiling - 0.052, 0, 20));
    emitter(lamp, {
      at: [0, ceiling - 0.06, 0],
      aim: [0, -1, 0],
      intensity: it.watts ?? 9, distance: 7, angle: 1.12, penumbra: 0.9,
      interior: true,
    });
  },

  /**
   * The chandelier over the dining table, on the owner's instruction: a big
   * romantic one, so two tiers of candle lamps on gold arms under a ring of
   * crystal drops. It hangs from the ceiling on a slim stem; `h` is the
   * ceiling and `drop` how far the lowest tier hangs below it.
   */
  chandelier(g, { w, d }, it) {
    const ceiling = it.h ?? PLAN.storeyHeight;
    const r = it.r ?? Math.min(w, d) * 0.42;
    const hang = it.drop ?? 0.95;
    const hub = ceiling - hang;

    g.add(cyl(0.09, 0.04, M.gold, 0, ceiling - 0.02, 0, 16));          // ceiling rose
    g.add(cyl(0.012, hang - 0.1, M.gold, 0, hub + (hang - 0.1) / 2, 0, 8));  // stem
    g.add(ball(0.07, M.gold, 0, hub, 0));                               // hub

    const lamp = nightGroup(g);
    const tiers = [
      { n: 8, r, y: hub + 0.06, len: 0.26 },
      { n: 5, r: r * 0.58, y: hub + 0.34, len: 0.2 },
    ];
    for (const t of tiers) {
      g.add(new THREE.Mesh(
        new THREE.TorusGeometry(t.r, 0.012, 6, 40),
        M.gold,
      ).rotateX(Math.PI / 2).translateZ(-t.y));                          // gold ring
      for (let i = 0; i < t.n; i++) {
        const a = (i / t.n) * Math.PI * 2;
        const x = Math.cos(a) * t.r;
        const z = Math.sin(a) * t.r;
        g.add(cyl(0.01, t.len, M.gold, x, t.y + t.len / 2, z, 6));       // candle arm
        g.add(cyl(0.022, 0.1, M.linen, x, t.y + t.len + 0.05, z, 8));    // candle
        lamp.add(ball(0.03, M.warm, x, t.y + t.len + 0.12, z, 0));       // flame
      }
      for (let i = 0; i < t.n * 3; i++) {                                // crystal drops
        const a = ((i + 0.5) / (t.n * 3)) * Math.PI * 2;
        const len = 0.1 + (i % 3) * 0.05;
        g.add(cyl(0.011, len, M.glass, Math.cos(a) * t.r, t.y - len / 2, Math.sin(a) * t.r, 6));
      }
    }

    emitter(lamp, {
      at: [0, hub + 0.1, 0],
      aim: [0, -1, 0],
      intensity: it.watts ?? 11, distance: 8, angle: 1.2, penumbra: 0.95,
      interior: true,
    });
  },

  /** Flat rug; the cream-and-gold pattern comes from the texture. */
  rug(g, { w, d }) {
    g.add(box(w, 0.02, d, M.rug, 0, 0.005));
  },

  /** Cream gloss coffee table on a gold plinth, with books and a flower vase. */
  coffee(g, { w, d }) {
    g.add(box(w * 0.82, 0.1, d * 0.82, M.gold));
    g.add(box(w * 0.92, 0.24, d * 0.92, M.creamGloss, 0, 0.1));
    g.add(box(w, 0.07, d, M.creamGloss, 0, 0.34));
    g.add(box(0.26, 0.035, 0.19, M.cabinet, -w * 0.22, 0.41, d * 0.08));
    g.add(box(0.22, 0.03, 0.16, M.linen, -w * 0.22, 0.445, d * 0.08));
    g.add(cyl(0.045, 0.16, M.ceramic, w * 0.24, 0.41, -d * 0.12));
    g.add(ball(0.1, M.linen, w * 0.24, 0.62, -d * 0.12));
  },

  /** Indoor ficus in a white pot with a gold band. */
  plant(g) {
    g.add(cyl(0.2, 0.4, M.ceramic));
    g.add(cyl(0.21, 0.03, M.gold, 0, 0.34));
    g.add(cyl(0.03, 1.25, M.bark, 0, 0.4));
    g.add(ball(0.45, M.leaf, 0, 1.75, 0));
    g.add(ball(0.32, M.leafLite, 0.26, 1.5, 0.1));
    g.add(ball(0.3, M.leafLite, -0.22, 1.55, -0.12));
  },

  /** Gold floor lamp with a warm shade. */
  lamp(g) {
    g.add(cyl(0.14, 0.03, M.gold));
    g.add(cyl(0.015, 1.5, M.gold, 0, 0.03));
    g.add(ball(0.17, M.warm, 0, 1.62, 0));
  },

  /** Round side table: cream gloss top on three gold legs. */
  sidetable(g, { w }) {
    const r = w / 2;
    g.add(cyl(r, 0.025, M.creamGloss, 0, 0.5));
    g.add(cyl(r + 0.01, 0.012, M.gold, 0, 0.5));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      g.add(cyl(0.012, 0.5, M.gold, Math.cos(a) * r * 0.6, 0, Math.sin(a) * r * 0.6));
    }
    g.add(cyl(r * 0.5, 0.01, M.gold));
  },

  /** Window dressing: gold rod, beige drapes at each end, sheer in the middle. */
  curtain(g, { w, d }, it) {
    const h = it.h ?? 2.7;
    g.add(box(w, 0.03, 0.03, M.gold, 0, h));
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - w * 0.08);
      for (let i = 0; i < 3; i++) {
        g.add(box(w * 0.16 / 3, h - 0.05, d * 0.5, M.drape, x + (i - 1) * (w * 0.16 / 3), 0.02, (i % 2 ? 1 : -1) * d * 0.15));
      }
    }
    g.add(box(w * 0.68, h - 0.05, 0.01, M.sheer, 0, 0.02, 0));
  },

  /**
   * Ceiling-hung fireplace, after the owner's reference: a black flue from a
   * round ceiling plate that flares into an open steel bowl with logs and
   * flame inside. The bowl's mouth faces `face` ('W' by default) or `faceDeg`; hung so the
   * bowl bottom is 0.92 m off the floor and the plate meets the ceiling at 3.0 m.
   */
  hangingfire(g, _size, it) {
    const top = it.ceiling ?? 3.0;
    const gap = 1.6;                                    // width of the bowl's open mouth, rad
    // Lathe profile (radius, height): flue, trumpet flare, then the dish.
    const profile = [
      [0.09, 1.9], [0.09, 1.5], [0.11, 1.38], [0.2, 1.27], [0.36, 1.19],
      [0.52, 1.13], [0.58, 1.06], [0.52, 0.97], [0.32, 0.92], [0.0, 0.91],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    // Local mouth is centred on -X: lathe angle 3*pi/2 (x = sin(phi)).
    const bowl = new THREE.Mesh(
      new THREE.LatheGeometry(profile, 40, (3 * Math.PI) / 2 + gap / 2, Math.PI * 2 - gap), M.hearth);
    bowl.castShadow = true;
    g.add(bowl);

    g.add(cyl(0.09, top - 1.9, M.hearth, 0, 1.9));      // flue up to the ceiling
    g.add(cyl(0.14, 0.5, M.hearth, 0, top - 0.5));      // collar
    g.add(cyl(0.3, 0.03, M.hearth, 0, top - 0.03));     // ceiling plate

    // Fire on the bowl floor, towards the open side.
    for (let i = 0; i < 4; i++) {
      const log = cyl(0.035, 0.3, M.bark, -0.22, 0.93 + (i % 2) * 0.05, (i - 1.5) * 0.07);
      log.rotation.x = Math.PI / 2;
      log.rotation.z = (i - 1.5) * 0.25;
      g.add(log);
    }
    for (let i = 0; i < 5; i++) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.05 + (i % 2) * 0.02, 0.2 + (i % 3) * 0.06, 6), M.ember);
      flame.position.set(-0.2 - (i % 2) * 0.05, 1.05 + (i % 3) * 0.02, (i - 2) * 0.07);
      g.add(flame);
    }

    // Turn the mouth to face a side (`face`) or any angle (`faceDeg`: 0 = west,
    // positive turns towards the south, i.e. clockwise on the plan).
    g.rotation.y = it.faceDeg != null
      ? THREE.MathUtils.degToRad(it.faceDeg)
      : { W: 0, N: -Math.PI / 2, S: Math.PI / 2, E: Math.PI }[it.face ?? 'W'];
  },

  /**
   * Relaxed lounge sofa: low and deep, with a plush base, separate seat
   * cushions, back cushions leaning off the vertical, low rolled arms and a
   * couple of throw pillows. `seats` is the number of seat cushions (1 =
   * armchair); `back` names the wall it stands against.
   */
  lounge(g, { w, d }, it) {
    const { run, len, depth } = backedRun(g, { w, d }, it.back);
    const armW = 0.16;
    const inner = len - armW * 2;
    const seats = it.seats ?? Math.max(1, Math.round(inner / 0.85));
    const sw = inner / seats;

    run.add(box(len * 0.97, 0.04, depth * 0.95, M.gold));                      // gold base rail
    run.add(box(len, 0.16, depth, M.cream, 0, 0.04));                          // plush base
    for (const s of [-1, 1]) {                                                 // rolled arms
      run.add(box(armW, 0.3, depth, M.cream, s * (len / 2 - armW / 2), 0.04));
    }
    for (let i = 0; i < seats; i++) {                                          // seat cushions
      const x = -inner / 2 + sw * (i + 0.5);
      run.add(box(sw - 0.03, 0.14, depth * 0.68, M.cream, x, 0.2, depth * 0.14));
    }
    for (let i = 0; i < seats; i++) {                                          // leaning back cushions
      const x = -inner / 2 + sw * (i + 0.5);
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.32, -depth / 2 + 0.2);
      pivot.rotation.x = -0.32;
      pivot.add(box(sw - 0.04, 0.42, 0.2, M.cream));
      run.add(pivot);
    }
    const pillow = (x, mat) => {
      const p = new THREE.Group();
      p.position.set(x, 0.36, -depth / 2 + 0.36);
      p.rotation.set(-0.5, 0.25, 0.1);
      p.add(box(0.38, 0.38, 0.1, mat));
      run.add(p);
    };
    pillow(-inner / 2 + 0.3, M.drape);
    pillow(inner / 2 - 0.3, M.gold);
  },

  /**
   * Kitchen appliance wardrobe: base drawers, a worktop, and a niche behind
   * pocket doors (drawn slid back to the ends) that hides a full-automatic
   * coffee machine, kettle, toaster and microwave, with closed cabinets above.
   * `back` names the wall it stands against; the rect's long side is its width.
   * `microwave: false` leaves the microwave out, for a ~1.1 m unit.
   */
  appliancenook(g, { w, d }, it) {
    const { run, len, depth } = backedRun(g, { w, d }, it.back);
    const H = it.h ?? 2.3;
    const counter = 0.9;
    const nicheH = 0.7;
    const inner = len - 0.1;
    const front = depth / 2;

    // Base cabinet: three drawers under the worktop.
    run.add(box(len, counter, depth, M.cabinet));
    for (let i = 0; i < 3; i++) {
      run.add(box(len * 0.3, 0.015, 0.02, M.metal, (i - 1) * (len / 3), 0.68 - i * 0.02, front + 0.005));
    }
    run.add(box(len, 0.04, depth + 0.03, M.counter, 0, counter));

    // The niche: side cheeks, back panel, header, and a warm strip under it.
    const top = counter + 0.04 + nicheH;
    for (const s of [-1, 1]) run.add(box(0.05, nicheH, depth, M.cabinet, s * (len / 2 - 0.025), counter + 0.04));
    run.add(box(inner, nicheH, 0.02, M.cream, 0, counter + 0.04, -depth / 2 + 0.03));
    run.add(box(len, 0.05, depth, M.cabinet, 0, top));
    run.add(box(inner, 0.015, 0.02, M.warm, 0, top - 0.015, front - 0.08));

    // Closed cabinets above, with door lines.
    const upperH = H - top - 0.05;
    run.add(box(len, upperH, depth * 0.9, M.cabinet, 0, top + 0.05, -depth * 0.05));
    for (const s of [-1, 0, 1]) {
      run.add(box(0.012, upperH - 0.1, 0.01, M.dark, s * (len / 6), top + 0.1, front - depth * 0.1 + 0.005));
    }

    // Pocket doors slid back to the ends, on a metal track.
    run.add(box(inner, 0.02, 0.03, M.metal, 0, top - 0.02, front - 0.03));
    for (const s of [-1, 1]) {
      run.add(box(0.11, nicheH - 0.04, 0.025, M.creamGloss, s * (len / 2 - 0.105), counter + 0.06, front - 0.03));
    }

    // Appliances on the worktop, left to right: coffee machine, kettle, toaster, microwave.
    const y0 = counter + 0.04;
    const zc = -depth / 2 + 0.3;                         // depth position of the appliances
    const cx = -inner / 2 + 0.2;

    run.add(box(0.32, 0.44, 0.42, M.metal, cx, y0, zc));                              // coffee machine
    run.add(box(0.26, 0.2, 0.012, M.dark, cx, y0 + 0.2, zc + 0.216));
    run.add(box(0.14, 0.03, 0.012, M.warm, cx, y0 + 0.32, zc + 0.222));               // display
    run.add(box(0.12, 0.06, 0.16, M.dark, cx, y0 + 0.44, zc - 0.08));                 // bean hopper
    run.add(cyl(0.012, 0.07, M.dark, cx, y0 + 0.12, zc + 0.21));                      // spout
    run.add(box(0.28, 0.025, 0.2, M.dark, cx, y0, zc + 0.12));                        // drip tray

    const kx = cx + 0.32;
    run.add(cyl(0.09, 0.2, M.metal, kx, y0, zc + 0.02));                              // kettle
    run.add(cyl(0.055, 0.025, M.dark, kx, y0 + 0.2, zc + 0.02));
    run.add(box(0.025, 0.17, 0.03, M.dark, kx + 0.11, y0 + 0.02, zc + 0.02));

    const tx = kx + 0.28;
    run.add(box(0.3, 0.18, 0.17, M.metal, tx, y0, zc));                               // toaster
    for (const z of [-0.035, 0.035]) run.add(box(0.22, 0.012, 0.03, M.dark, tx, y0 + 0.18, zc + z));
    run.add(box(0.03, 0.02, 0.03, M.dark, tx + 0.17, y0 + 0.1, zc));

    if (it.microwave === false) return;
    const mx = inner / 2 - 0.29;
    run.add(box(0.46, 0.28, 0.34, M.metal, mx, y0, zc - 0.04));                       // microwave
    run.add(box(0.31, 0.2, 0.012, M.dark, mx - 0.06, y0 + 0.04, zc + 0.136));
    run.add(box(0.09, 0.2, 0.012, M.dark, mx + 0.17, y0 + 0.04, zc + 0.136));
    run.add(box(0.015, 0.16, 0.02, M.metal, mx + 0.11, y0 + 0.06, zc + 0.15));
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
    const fab = M[it.fabric] ?? M.fabric;

    g.add(box(w * 0.98, seatH, d * 0.98, fab));
    if (it.trim) g.add(box(w * 0.99, 0.05, d * 0.99, M.gold)); // gold base rail
    const backRest = box(bw, 0.5, bd, fab, 0, seatH - 0.08);
    if (vertical) backRest.position.z = sign * (d / 2 - 0.09);
    else backRest.position.x = sign * (w / 2 - 0.09);
    g.add(backRest);

    // Arms on the two sides perpendicular to the backrest.
    const armW = vertical ? 0.16 : w * 0.96;
    const armD = vertical ? d * 0.96 : 0.16;
    for (const s of [-1, 1]) {
      const arm = box(armW, 0.24, armD, fab, 0, seatH - 0.02);
      if (vertical) arm.position.x = s * (w / 2 - 0.08);
      else arm.position.z = s * (d / 2 - 0.08);
      g.add(arm);
    }
  },

  /**
   * Dining chair: four legs, a seat at 0.45 m and an open backrest above it,
   * rather than the solid block this used to be — at eye level in walk mode a
   * block reads as a crate. The back is at local -Z, so `rot` turns the chair
   * to face its table ('degrees clockwise on the page': 0 backs north, 90 east).
   */
  chair(g, { w, d }) {
    const sw = w * 0.9;
    const sd = d * 0.9;
    const seatH = 0.45;
    const leg = 0.045;
    const seat = 0.05;
    const backZ = -sd / 2 + leg / 2;

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        g.add(box(leg, seatH - seat, leg, M.wood,
          sx * (sw / 2 - leg / 2), 0, sz * (sd / 2 - leg / 2)));
      }
      // The back legs carry on up as the backrest uprights.
      g.add(box(leg, 0.50, leg, M.wood, sx * (sw / 2 - leg / 2), seatH, backZ));
    }
    g.add(box(sw, seat, sd, M.wood, 0, seatH - seat));
    g.add(box(sw - leg * 2, 0.26, 0.035, M.wood, 0, seatH + 0.20, backZ));
  },

  stool(g, { w }) {
    g.add(cyl(w / 2, 0.06, M.wood, 0, 0.66));
    g.add(cyl(0.04, 0.66, M.metal));
  },

  // ── toddler play room ──────────────────────────────────────────────────
  /**
   * Interlocking foam play tiles, laid to fill the rect. `tile` sets the
   * nominal tile size (0.6 m); the grid is rounded to whole tiles and the
   * colours alternate so the jigsaw pattern reads from above.
   */
  playmat(g, { w, d }, it) {
    const t = it.tile ?? 0.6;
    const cols = Math.max(1, Math.round(w / t));
    const rows = Math.max(1, Math.round(d / t));
    const tw = w / cols;
    const td = d / rows;
    const pal = it.palette ?? ['blue', 'yellow', 'green', 'pink', 'orange', 'mint'];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const c = pal[(i + j * 3) % pal.length];
        g.add(box(tw - 0.012, 0.035, td - 0.012, toyMat(c),
          -w / 2 + tw * (i + 0.5), 0, -d / 2 + td * (j + 0.5)));
      }
    }
  },

  /**
   * Rocking horse. Nose at local -X, so the rect's long side is its length and
   * `rot` turns it on the mat. Two arched rockers carry a plank, the body sits
   * on that, and the handle bar crosses the withers.
   */
  rockinghorse(g, { w }, it) {
    const L = Math.min(w, 1.05);
    const R = L * 0.95;                       // rocker radius
    const half = 0.55;                        // half the arc, radians
    const segLen = (2 * R * half) / 7 * 1.18;
    const hide = toyMat(it.paint ?? 'hide');
    for (const sz of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const a = -half + (half * 2) * (i + 0.5) / 7;
        const seg = box(segLen, 0.05, 0.06, M.wood, Math.sin(a) * R, R - Math.cos(a) * R, sz * 0.17);
        seg.rotation.z = -a;
        g.add(seg);
      }
    }
    const deck = 0.22;                        // plank height
    g.add(box(L * 0.8, 0.04, 0.4, M.wood, 0, deck));
    for (const sx of [-1, 1]) {               // legs
      g.add(box(0.07, 0.2, 0.07, hide, sx * L * 0.24, deck + 0.04, 0));
    }
    g.add(box(L * 0.62, 0.26, 0.3, hide, 0, deck + 0.24));         // body
    g.add(box(0.26, 0.05, 0.32, M.drape, L * 0.02, deck + 0.5));   // saddle
    const neck = new THREE.Group();                                 // neck + head
    neck.position.set(-L * 0.26, deck + 0.44, 0);
    neck.rotation.z = 0.5;
    neck.add(box(0.16, 0.34, 0.2, hide));
    g.add(neck);
    g.add(box(0.3, 0.16, 0.18, hide, -L * 0.46, deck + 0.66));      // head
    g.add(box(0.05, 0.1, 0.05, hide, -L * 0.38, deck + 0.8));       // ears
    g.add(box(0.05, 0.1, 0.05, hide, -L * 0.38, deck + 0.8, 0.09));
    g.add(box(0.1, 0.24, 0.1, toyMat('mane'), -L * 0.28, deck + 0.64));  // mane
    g.add(box(0.1, 0.22, 0.08, toyMat('mane'), L * 0.3, deck + 0.42));   // tail
    for (const sz of [-1, 1]) {
      g.add(ball(0.022, M.dark, -L * 0.52, deck + 0.75, sz * 0.085, 0));
    }
    const bar = cyl(0.018, 0.34, M.wood, -L * 0.26, deck + 0.74);   // handle bar
    bar.rotation.x = Math.PI / 2;
    g.add(bar);
  },

  /** Play teepee: four poles crossed at the top under a canvas cone. */
  teepee(g, { w, d }, it) {
    const h = it.h ?? 1.45;
    const r = Math.min(w, d) / 2;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const pole = cyl(0.022, h * 1.04, M.wood, 0, 0);
      pole.position.set(Math.cos(a) * r * 0.55, h * 0.5, Math.sin(a) * r * 0.55);
      pole.rotation.z = -Math.cos(a) * 0.42;
      pole.rotation.x = Math.sin(a) * 0.42;
      g.add(pole);
    }
    const canvas = new THREE.Mesh(
      new THREE.ConeGeometry(r, h, 4, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 1, side: THREE.DoubleSide }),
    );
    canvas.position.y = h / 2;
    canvas.rotation.y = Math.PI / 4;
    canvas.castShadow = true;
    g.add(canvas);
    // Doorway: a dark panel set just inside the front face, so the tent reads
    // as open on the side it faces (local -Z, turned by `rot`).
    g.add(box(r * 0.8, h * 0.5, 0.01, M.dark, 0, 0, -r * 0.62));
    g.add(box(r * 0.12, h * 0.52, 0.02, M.drape, -r * 0.42, 0, -r * 0.64));
    g.add(box(r * 0.12, h * 0.52, 0.02, M.drape, r * 0.42, 0, -r * 0.64));
    g.add(ball(0.05, toyMat('yellow'), 0, h + 0.05, 0));
  },

  /**
   * Low cube toy storage: a grid of open cubbies with coloured bins in some of
   * them, kept toddler-height. `back` names the wall it stands against.
   */
  toyshelf(g, { w, d }, it) {
    const { run, len, depth } = backedRun(g, { w, d }, it.back);
    const h = it.h ?? 0.78;
    const cols = Math.max(2, Math.round(len / 0.42));
    const rows = it.rows ?? 2;
    const cw = len / cols;
    const ch = h / rows;
    run.add(box(len, h, depth, M.cabinet));
    const bins = ['red', 'blue', 'yellow', 'green', 'orange', 'mint', 'purple', 'pink'];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = -len / 2 + cw * (i + 0.5);
        const y = ch * j + 0.04;
        // Hollow the cubby out with a dark recess, then drop a bin into some.
        run.add(box(cw - 0.06, ch - 0.08, 0.02, M.dark, x, y, -depth / 2 + 0.03));
        if ((i + j) % 3 !== 2) {
          run.add(box(cw - 0.09, ch - 0.14, depth * 0.8, toyMat(bins[(i * rows + j) % bins.length]), x, y, 0.01));
        }
      }
    }
    run.add(box(len + 0.03, 0.03, depth + 0.03, M.linen, 0, h));   // top
  },

  /** Soft-sided ball pit: a padded ring, a mat floor and a heap of balls. */
  ballpit(g, { w, d }, it) {
    const r = Math.min(w, d) / 2;
    const wall = it.h ?? 0.3;
    const side = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, wall, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 1, side: THREE.DoubleSide }),
    );
    side.position.y = wall / 2;
    side.castShadow = true;
    g.add(side);
    g.add(cyl(r, 0.05, toyMat('mint'), 0, 0, 0, 24));                // padded floor
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 8, 24), toyMat('blue'));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = wall;
    rim.castShadow = true;
    g.add(rim);
    const pal = ['red', 'blue', 'yellow', 'green', 'orange', 'pink'];
    for (let i = 0; i < 44; i++) {
      const a = scatter(7.1, i) * Math.PI * 2;
      const rad = Math.sqrt(scatter(3.3, i)) * (r - 0.09);
      g.add(ball(0.055, toyMat(pal[i % pal.length]),
        Math.cos(a) * rad, 0.05 + scatter(9.7, i) * 0.14, Math.sin(a) * rad, 1));
    }
  },

  /** A small heap of stacking blocks, scattered from a seed. */
  blocks(g, { w, d }) {
    const pal = ['red', 'blue', 'yellow', 'green', 'orange', 'purple'];
    for (let i = 0; i < 9; i++) {
      const s = 0.09 + scatter(5.5, i) * 0.03;
      const stack = i % 3;
      const b = box(s, s, s, toyMat(pal[i % pal.length]),
        (scatter(1.7, i) - 0.5) * (w - s), stack * s * 1.02, (scatter(4.2, i) - 0.5) * (d - s));
      b.rotation.y = scatter(8.8, i) * 0.8;
      g.add(b);
    }
  },

  /** Stuffed bear, sitting up. */
  teddy(g, _size, it) {
    const fur = toyMat(it.paint ?? 'hide');
    g.add(ball(0.16, fur, 0, 0.16, 0));                     // body
    g.add(ball(0.12, fur, 0, 0.42, -0.02));                 // head
    for (const s of [-1, 1]) {
      g.add(ball(0.045, fur, s * 0.09, 0.5, -0.02));        // ears
      g.add(ball(0.06, fur, s * 0.17, 0.2, 0.02));          // arms
      g.add(ball(0.07, fur, s * 0.09, 0.07, 0.14));         // legs
      g.add(ball(0.018, M.dark, s * 0.05, 0.44, -0.12, 0)); // eyes
    }
    g.add(ball(0.05, M.linen, 0, 0.38, -0.11));             // muzzle
    g.add(ball(0.02, M.dark, 0, 0.39, -0.15, 0));           // nose
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
      // Riser board closing the back of each tread — the face you step up
      // off, so the edge at `centre` behind the direction of travel. `centre`
      // is already in the flight's own direction; applying `sign` again here
      // mirrored every board to the far end of the flight, which on flight 2
      // left the top tread's board standing at chest height across the bottom
      // of the climb. That is what made the stair need a jump.
      const rb = centre - sign * run / 2;
      g.add(vertical
        ? box(w, riser, 0.04, M.counter, 0, top - riser - tread, rb)
        : box(0.04, riser, d, M.counter, rb, top - riser - tread, 0));
    }
  },
};

/** Posts-and-rails run along a polyline — balcony edges and the void. */
/**
 * A railing along a polyline. Iron throughout — `M.metal` — which is what the
 * owner means by *korkuluk*.
 *
 * A path point is `[px, py]` at the item's own `y`, or `[px, py, y]` to set
 * that corner's height: that is how a stair balustrade rakes. Each leg then
 * runs from one corner's height to the next's, so the handrail climbs with
 * the nosing line while the balusters stay plumb. A path with no heights
 * behaves exactly as before.
 *
 * `wall: true` gives a handrail on brackets instead — no balusters and no
 * mid-rail — for a flight enclosed by walls on both sides, where a full
 * balustrade would stand inside the plaster.
 */
function buildRailing(item, offsetPx) {
  const group = new THREE.Group();
  group.name = item.name ?? 'railing';
  const h = item.h ?? 1.1;
  const base = item.y ?? 0;
  const pts = item.path.map((p) => [...toWorld(p, offsetPx), p[2] ?? base]);

  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az, ay] = pts[i];
    const [bx, bz, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-3) continue;
    const rise = by - ay;
    const rake = Math.atan2(rise, len);
    const slope = Math.hypot(len, rise);          // the handrail's own length

    const seg = new THREE.Group();
    seg.position.set(ax, ay, az);
    seg.rotation.y = Math.atan2(-(bz - az), bx - ax);

    // The rails follow the rake; a level leg (rise 0) is the old flat case.
    // `mid` is the rail's centre above the nosing line — `box()` measures from
    // a bottom face, which a rotated rail does not have.
    const rail = (mid, th, d) => {
      const b = box(slope, th, d, M.metal);
      b.position.set(len / 2, rise / 2 + mid, 0);
      b.rotation.z = rake;
      return b;
    };
    seg.add(rail(h - 0.03, 0.06, 0.06));                       // handrail
    if (!item.wall) seg.add(rail(h * 0.5, 0.03, 0.04));        // mid rail

    const n = Math.max(2, Math.round(len / 1.1));
    for (let p = 0; p <= n; p++) {
      const t = p / n;
      const foot = rise * t;                                   // the nosing line
      if (item.wall) {
        // Bracket back to the wall, under the rail.
        seg.add(box(0.06, 0.04, 0.16, M.metal, len * t, foot + h - 0.12, -0.09));
        continue;
      }
      const b = box(0.05, h - 0.06, 0.05, M.metal, len * t, 0, 0);
      b.position.y = foot + (h - 0.06) / 2;                    // plumb baluster
      seg.add(b);
    }
    group.add(seg);
  }
  return group;
}

/** A flat slab over a polygon `path` of sheet pixels — terraces, decks, roofs. */
function buildPaving(item, offsetPx, floor) {
  const pts = item.path.map((p) => toWorld(p, offsetPx));
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));

  // `holes`: polygons (sheet px) left open — a patio round a house and a pool.
  for (const hole of item.holes ?? []) {
    const ring = hole.map((p) => toWorld(p, offsetPx));
    shape.holes.push(new THREE.Path(ring.map(([x, z]) => new THREE.Vector2(x, z))));
  }

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
