import * as THREE from 'three';
import { PLAN, toWorld, shutterOpenings } from './floorplan.js';

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

/**
 * Limestone ashlar, after the architect's renders (assets/3D Rendered): the
 * entrance / stair block and the walls round KAPALI TERAS are clad in a warm
 * light stone laid in 30 cm courses. The canvas is one 1.2 m square of
 * coursing; `stoneUVs()` maps each face in metres so the courses run on
 * across every piece of a wall instead of stretching per box.
 */
const STONE_TILE = 1.2;
function stoneTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b9ad98';                       // the joints
  ctx.fillRect(0, 0, 512, 512);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const course = 512 / 4;                          // 0.30 m
  for (let r = 0; r < 4; r++) {
    let x = -rnd() * 160;
    while (x < 512) {
      const len = 170 + rnd() * 210;               // 0.40..0.90 m
      const t = 0.9 + rnd() * 0.16;
      ctx.fillStyle = `rgb(${Math.round(222 * t)},${Math.round(210 * t)},${Math.round(186 * t)})`;
      // Draw wrapped so the tile repeats seamlessly.
      for (const dx of [0, 512]) ctx.fillRect(x + 2 - dx, r * course + 2, len - 4, course - 4);
      x += len;
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
const STONE = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, map: stoneTexture() });

/**
 * BoxGeometry gives every face UVs of 0..1. Rescale them to metres of
 * STONE_TILE, offset by where the piece sits in the wall, so joints line up
 * from one piece to the next and across the openings.
 */
function stoneUVs(geo, w, h, d, x0, y0) {
  const uv = geo.attributes.uv;
  // Face order: +x, -x, +y, -y, +z, -z; four vertices each.
  const span = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = span[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * su + x0) / STONE_TILE, (uv.getY(i) * sv + y0) / STONE_TILE);
    }
  }
  uv.needsUpdate = true;
}

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
const SHUTTER = new THREE.MeshStandardMaterial({ color: 0xf8f8f6, roughness: 0.5 });
const SHUTTER_GUIDE = new THREE.MeshStandardMaterial({ color: 0xb9bdc2, roughness: 0.4, metalness: 0.5 });
const LEAF = new THREE.MeshStandardMaterial({ color: 0x9a7a56, roughness: 0.6 });
// The front door in the renders: a dark walnut leaf with a long bar pull.
const WALNUT = new THREE.MeshStandardMaterial({ color: 0x6b4529, roughness: 0.55 });
const HANDLE = new THREE.MeshStandardMaterial({
  color: 0x9aa3ad, roughness: 0.3, metalness: 0.8,
});

// Motorised rolling shutters (`buildShutter`): anthracite, like the joinery.
const ROLLER = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.55, metalness: 0.2 });
const ROLLER_SLATS = new THREE.MeshStandardMaterial({
  color: 0xffffff, roughness: 0.6, metalness: 0.15, map: slatTexture(), side: THREE.DoubleSide,
});
const PLATE = new THREE.MeshStandardMaterial({ color: 0xf5f7f9, roughness: 0.2 });

/** One 4.5 cm slat per repeat: a light face, a dark joint. */
function slatTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 32;
  const x = c.getContext('2d');
  const grad = x.createLinearGradient(0, 0, 0, 32);
  grad.addColorStop(0, '#5a5f66');
  grad.addColorStop(0.75, '#3a3e44');
  grad.addColorStop(0.9, '#1c1e21');
  grad.addColorStop(1, '#2a2d31');
  x.fillStyle = grad;
  x.fillRect(0, 0, 4, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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
 * does on the plan. Garage openings get a white roller shutter.
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
  const frameMat = isWindow || cut.kind === 'sliding' || cut.kind === 'gate' ? BLACK_FRAME : FRAME;

  // Frame: two jambs plus a head, lining the reveal.
  g.add(slab(jamb, h, d, frameMat, cut.from + jamb / 2, cut.sill + h / 2, 0));
  g.add(slab(jamb, h, d, frameMat, cut.to - jamb / 2, cut.sill + h / 2, 0));
  g.add(slab(w, jamb, d, frameMat, cx, cut.head - jamb / 2, 0));

  // A cased opening is a lined hole — no leaf. A `gate` is the same, black;
  // its leaves are separate `gate` objects (see objects.js).
  if (cut.kind === 'opening' || cut.kind === 'gate') return g;

  if (cut.kind === 'garage') {
    // White roller shutter: a roll housing under the head, slats hanging
    // from it, a bottom bar and side guides. `raise` (0 closed .. 1 fully
    // rolled up) leaves the opening partly clear.
    const inner = w - jamb * 2;
    const housingH = 0.28;
    const housingBottom = cut.head - housingH;
    const panelH = (housingBottom - cut.sill) * (1 - (cut.raise ?? 0));
    g.add(slab(inner, housingH, depth * 0.6, SHUTTER, cx, cut.head - housingH / 2, 0));
    for (const side of [-1, 1]) {
      g.add(slab(0.05, h - housingH, 0.06, SHUTTER_GUIDE, cx + side * (inner / 2 - 0.025), cut.sill + (h - housingH) / 2, 0));
    }
    if (panelH > 0.1) {
      const pitch = 0.08;
      const slats = Math.floor((panelH - 0.05) / pitch);
      for (let i = 0; i < slats; i++) {
        g.add(slab(inner - 0.1, pitch - 0.008, 0.03, SHUTTER, cx, housingBottom - (i + 0.5) * pitch, 0));
      }
      g.add(slab(inner - 0.1, 0.05, 0.05, SHUTTER_GUIDE, cx, housingBottom - panelH + 0.025, 0));
    }
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
    // Glazed slider: a black framed leaf on a track on the wall face, which
    // opens and closes — look at it in walk mode and press E
    // (`userData.opener`, stepped in main.js; it starts closed). It travels
    // towards `swing` (+1 = +X along the wall). A plain slider parks
    // alongside the opening, over solid wall; `panels: 2` (a 1.8 m opening,
    // say, with no wall to park on) is a fixed pane on the travel side with
    // the leaf sliding past it, both inside the frame's depth, which clears
    // half the width and keeps the wall face free for a neighbour's leaf.
    const twoPanel0 = cut.src?.panels === 2;
    const face = twoPanel0 ? 0.035 : depth / 2 + 0.035;
    const dir = cut.swing === -1 ? -1 : 1;
    const twoPanel = cut.src?.panels === 2;
    const lw = (twoPanel ? w / 2 : w) - 0.04;
    const lh = h - 0.04;
    const closedX = twoPanel ? cx - dir * w / 4 : cx;
    const openX = closedX + dir * (twoPanel ? w / 2 : w);
    if (!twoPanel) {
      g.add(slab(Math.abs(openX - closedX) + lw + 0.05, 0.05, 0.05, frameMat,
        (closedX + openX) / 2, cut.head + 0.04, face));
    }

    const panel = (x, z) => {
      const p = new THREE.Group();
      p.position.set(x, 0, z);
      p.add(slab(lw, 0.05, 0.05, frameMat, 0, lh - 0.025, 0));
      p.add(slab(lw, 0.05, 0.05, frameMat, 0, 0.025, 0));
      p.add(slab(0.05, lh, 0.05, frameMat, -lw / 2 + 0.025, lh / 2, 0));
      p.add(slab(0.05, lh, 0.05, frameMat, lw / 2 - 0.025, lh / 2, 0));
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(lw - 0.08, lh - 0.08), GLASS);
      pane.position.set(0, lh / 2, 0);
      p.add(pane);
      g.add(p);
      return p;
    };
    if (twoPanel) panel(cx + dir * w / 4, -0.035);     // the fixed pane, in the reveal
    const leaf = panel(closedX, face);
    leaf.userData.dynamic = true;                       // walk.js re-boxes it as it moves

    const RATE = 0.8;                                   // metres a second
    const state = { open: false };
    const ctl = {
      label: 'Sliding door',
      get on() { return state.open; },
      get status() { return state.open ? 'open' : 'closed'; },
      toggle(open = !state.open) { state.open = open; },
      /** Advance by `dt` seconds; true while it is moving. */
      step(dt) {
        const want = state.open ? openX : closedX;
        const at = leaf.position.x;
        if (at === want) return false;
        leaf.position.x = want > at ? Math.min(want, at + dt * RATE) : Math.max(want, at - dt * RATE);
        return true;
      },
    };
    g.userData.opener = ctl;
    leaf.traverse((m) => { if (m.isMesh) { m.userData.switch = 'opener'; m.userData.opener = ctl; } });
    return g;
  }

  // Door leaf, swung 78° open. `hinge` picks which jamb it turns on and
  // `swing` which side it opens to (+1 = wall-local +Z); both are taken from
  // the swing arcs in the PDF, so every leaf opens into the room the
  // architect drew it opening into.
  const leafW = w - jamb * 2;
  const atTo = cut.hinge === 'to';
  const dir = atTo ? -1 : 1;
  const leaf = new THREE.Group();
  leaf.position.set(atTo ? cut.to - jamb : cut.from + jamb, 0, 0);
  leaf.rotation.y = -Math.PI * (78 / 180) * (cut.swing ?? 1) * dir;
  const walnut = cut.leaf === 'walnut';
  leaf.add(slab(leafW, h - jamb, walnut ? 0.06 : 0.045, walnut ? WALNUT : LEAF, (dir * leafW) / 2, (h - jamb) / 2, 0));
  if (walnut) {
    // A 1.2 m bar pull on both faces.
    for (const s of [-1, 1]) leaf.add(slab(0.03, 1.2, 0.03, BLACK_FRAME, dir * (leafW - 0.12), 1.05, s * 0.07));
  } else {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), HANDLE);
    knob.position.set(dir * (leafW - 0.09), 1.05, 0.05);
    leaf.add(knob);
  }
  g.add(leaf);
  return g;
}

/**
 * A motorised rolling shutter on the outside of an opening (`side` is the
 * outside, in wall-local Z), on the owner's instruction: every window and
 * outward slider has one. A box over the head on the outside face, guide
 * rails in the reveal, a slatted curtain that rolls down, and an up/down
 * switch on the inside face beside the jamb (`E` in walk mode; `U` rolls
 * every shutter). They start open, so the house looks as it always did.
 *
 * The curtain is a box whose UVs carry one slat per 4.5 cm, scaled in y as it
 * rolls; the controller is `userData.shutter`, and the rocker carries it too.
 */
function buildShutter(cut, depth, side, wallLength, wallHeight) {
  const g = new THREE.Group();
  const w = cut.to - cut.from;
  const cx = cut.from + w / 2;
  const face = side * (depth / 2);
  const boxH = 0.22, boxD = 0.2;
  const top = Math.min(cut.head, wallHeight - boxH);         // where the curtain leaves the box
  const drop = top - cut.sill;
  if (drop < 0.2) return g;

  g.add(slab(w + 0.08, boxH, boxD, ROLLER, cx, top + boxH / 2, face + side * boxD / 2));
  for (const s of [-1, 1]) {
    g.add(slab(0.035, drop, 0.05, ROLLER, cx + s * (w / 2 - 0.0175), cut.sill + drop / 2, face + side * 0.025));
  }

  const curtain = new THREE.Group();
  curtain.position.set(cx, top, face + side * 0.03);
  const geo = new THREE.BoxGeometry(w - 0.05, drop, 0.012);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (drop / 0.045));
  const panel = new THREE.Mesh(geo, ROLLER_SLATS);
  panel.position.y = -drop / 2;
  panel.castShadow = panel.receiveShadow = true;
  panel.userData.noCollide = true;
  curtain.add(panel);
  curtain.visible = false;
  curtain.scale.y = 0.001;
  g.add(curtain);
  const bar = slab(w - 0.04, 0.04, 0.03, ROLLER, cx, top - 0.02, face + side * 0.03);
  bar.userData.noCollide = true;
  g.add(bar);

  // The switch, inside, 15 cm past the nearer jamb that has wall beside it —
  // or past the jamb the opening names (`shutterSwitch: 'to' | 'from'`,
  // `shutterSwitchOff` metres), which is how one is kept out from behind a
  // door: a switch never goes behind a door (owner's rule).
  const { shutterSwitch: side0, shutterSwitchOff: off = 0.15 } = cut.src ?? {};
  const atTo = side0 ? side0 === 'to' : !(cut.from > 0.3);
  const sx = atTo ? Math.min(cut.to + off, wallLength - 0.1) : cut.from - off;
  const inner = -side * (depth / 2);
  // Two buttons, as a motorised shutter's switch has: ▲ up over ▼ down. Look
  // at one in walk mode and press E.
  g.add(slab(0.08, 0.12, 0.01, PLATE, sx, 1.1, inner - side * 0.005));
  const button = (dir, dy) => {
    const b = slab(0.05, 0.045, 0.012, ROLLER, sx, 1.1 + dy, inner - side * 0.012);
    b.userData.dir = dir;
    g.add(b);
    return b;
  };
  const buttons = [button('up', 0.027), button('down', -0.027)];

  const RATE = 1 / 2.4;                                       // a full run in 2.4 s
  const state = { closed: false, t: 0 };
  const ctl = {
    get on() { return state.closed; },
    label: 'Rolling shutter',
    toggle(closed = !state.closed) { state.closed = closed; },
    /** Advance by `dt` seconds; true while it is moving. */
    step(dt) {
      const want = state.closed ? 1 : 0;
      if (state.t === want) return false;
      state.t = want > state.t ? Math.min(1, state.t + dt * RATE) : Math.max(0, state.t - dt * RATE);
      curtain.scale.y = Math.max(0.001, state.t);
      curtain.visible = state.t > 0.002;
      bar.position.y = top - 0.02 - drop * state.t;
      return true;
    },
  };
  g.userData.shutter = ctl;
  for (const b of buttons) {
    b.userData.switch = 'shutter';
    b.userData.shutter = ctl;
  }
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
      raise: o.raise,
      swing: o.swing,
      hinge: o.hinge,
      leaf: o.leaf,
      src: o,
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
  const shutterSide = new Map(shutterOpenings(floor).map((s) => [s.opening, s.side]));

  for (const wall of floor.walls) {
    // Rooms tucked under the stair carry a reduced ceiling (`wall.height`).
    // Otherwise a wall is as tall as its floor says: a storey with another
    // above it runs to the UNDERSIDE of that slab (`wallTop`), not to the
    // clear room height, or the 0.4 m of structural slab leaves a band of
    // open air above every wall. The slab hides it — except over a void,
    // where the stair climbs through and you can see out over the whole floor.
    const H = wall.height ?? floor.wallTop ?? PLAN.storeyHeight;
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
    // `stone: 1 | -1` clads one face in limestone: +1 is the right of a → b
    // as seen on the page (wall-local +Z), -1 the left. The other face, the
    // ends and the reveals keep the wall's own finish.
    const faces = wall.stone
      ? [material, material, material, material,
        wall.stone > 0 ? STONE : material, wall.stone > 0 ? material : STONE]
      : material;

    const wallGroup = new THREE.Group();
    // A storey's walls stand on its finished floor (`floor.level` above the
    // container); garden walls (`site`) stand on the ground.
    wallGroup.position.set(ax, wall.site ? 0 : floor.level ?? 0, az);
    wallGroup.rotation.y = angle;
    wallGroup.userData.wall = wall;
    wallGroup.userData.floor = floor;

    const { pieces, cuts } = solidPieces(length, wall.openings ?? [], H, mpp);

    for (const p of pieces) {
      const w = p.to - p.from;
      const h = p.top - p.bottom;
      if (w < 1e-4 || h < 1e-4) continue;
      const geo = new THREE.BoxGeometry(w, h, depth);
      if (wall.stone) stoneUVs(geo, w, h, depth, p.from, p.bottom);
      const mesh = new THREE.Mesh(geo, faces);
      mesh.position.set(p.from + w / 2, p.bottom + h / 2, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      wallGroup.add(mesh);
    }

    for (const cut of cuts) {
      wallGroup.add(buildOpening(cut, depth));
      const side = shutterSide.get(cut.src);
      if (side) wallGroup.add(buildShutter(cut, depth, side, length, H));
    }

    group.add(wallGroup);
  }

  group.position.y = place.elevation;
  return group;
}

export { MATERIALS };
