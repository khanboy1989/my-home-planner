import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { PLAN, toWorld } from './floorplan.js';

/**
 * First-person walkthrough — the "counter-strike" mode.
 *
 * The viewer is an orbiting model inspector; this turns the same scene into
 * somewhere you stand. Nothing is re-modelled: the walls, slabs, stairs and
 * furniture that buildWalls/buildObjects already emit are reused directly as
 * the collision world, so a door that is a gap in the geometry is a gap you
 * can walk through, and the stair you can climb is the one that was traced
 * from the sheet.
 *
 * Only one model is walkable at a time (the others are hidden while you are
 * inside, so you don't see the villa's twins through its windows and don't
 * walk into their walls). 'stacked' is the real house — both storeys in their
 * true relative positions — so that is the default.
 *
 * Collision is raycast-based rather than a physics engine:
 *
 *  - horizontally, three rays (knee-clearing, waist, head) are cast along the
 *    intended move; if any hits within the body radius the move is retried on
 *    each axis alone, which gives wall sliding for free;
 *  - vertically, one ray is dropped from STEP_UP above the feet. Whatever it
 *    lands on is the floor — slab, tread, terrace, lawn or pool surround — so
 *    stairs and the +0.34 steps need no special case. STEP_UP (0.45 m) is
 *    above a 0.17 m riser and below anything meant to stop you.
 *
 * The lowest horizontal ray sits *above* STEP_UP on purpose: below that height
 * geometry is something you step onto, not something you bump into.
 */

const EYE = 1.68;          // eye height above the feet
const RADIUS = 0.30;       // body radius kept clear of walls
const STEP_UP = 0.45;      // tallest rise taken without jumping
const GRAVITY = 20;        // m/s²
const WALK = 3.1;          // m/s, an unhurried indoor pace
const RUN = 6.2;           // m/s with shift
const JUMP = 4.3;          // m/s take-off
const ACCEL = 18;          // ground responsiveness
const AIR_ACCEL = 2.5;
const STOP = 30;           // deceleration with no key held: let go and you stop
const RAY_HEIGHTS = [0.55, 1.15, 1.62];  // above the feet
const HEAD_ROOM = 1.75;    // clearance needed to stand somewhere you stepped up onto
const NEAR = 3.0;          // broadphase radius round the player, metres
const FOV = 72;            // wider than the orbit camera — you are inside now

// Seen from above, the house is lit by the sun alone and the rooms read fine
// as dark voids. Standing in one, they are caves: nothing bounces light off a
// wall in a scene with no global illumination. So walk mode lifts the fill
// light and hangs a soft, short-range lamp on the camera, which stands in for
// the bounce. Both are restored on the way out so the orbit view is untouched.
const INDOOR = { ambient: 0.62, hemi: 1.9, exposure: 1.3 };

// Where you appear: on the path just inside the pedestrian gate (past its open
// leaf), looking straight up it at the front door — so the walk starts with
// the plot and the house in front of you rather than pressed against a wall.
// Sheet pixels of the ground floor; heading in radians, 0 = north / -Z.
const SPAWN = { px: [869, 2100], storey: 0, heading: 0 };

export function createWalkMode({
  renderer, camera, scene, orbit, floorGroups, labelGroup, statusEl,
  ambient, hemi, set = 'stacked',
}) {
  const look = new PointerLockControls(camera, renderer.domElement);
  look.enabled = false;

  // Rides with the camera; off until you are inside.
  const lamp = new THREE.PointLight(0xffeedd, 0, 13, 2.1);
  lamp.position.set(0, 0.25, 0.2);
  camera.add(lamp);
  scene.add(camera);

  const overlay = document.createElement('div');
  overlay.id = 'walk-overlay';
  overlay.innerHTML = `
    <div class="walk-card">
      <h2>WALK THE HOUSE</h2>
      <p class="walk-go">Click to look around</p>
      <dl>
        <dt>W A S D</dt><dd>move</dd>
        <dt>mouse</dt><dd>look</dd>
        <dt>shift</dt><dd>run</dd>
        <dt>space</dt><dd>jump</dd>
        <dt>C</dt><dd>crouch</dd>
        <dt>Esc</dt><dd>release the mouse</dd>
        <dt>F</dt><dd>back to the orbit view</dd>
      </dl>
    </div>`;
  overlay.style.display = 'none';
  document.body.appendChild(overlay);

  const crosshair = document.createElement('div');
  crosshair.id = 'walk-cross';
  crosshair.style.display = 'none';
  document.body.appendChild(crosshair);

  // ── collision world ───────────────────────────────────────────────────
  // Every mesh of the walkable model, each with its world AABB, so the
  // per-frame broadphase is a box test and the rays only ever see the few
  // hundred triangles actually around the player.
  let colliders = [];
  const near = [];
  const queryBox = new THREE.Box3();

  function collectColliders() {
    colliders = [];
    const roots = [];
    for (const g of floorGroups) if (g.set === set) roots.push(g.container);
    for (const extra of scene.children) {
      // The apron/ground plane, so you can walk off the plot without falling.
      if (extra.isMesh && extra.geometry?.type === 'ShapeGeometry' && extra.rotation.x < 0) {
        roots.push(extra);
      }
    }
    for (const root of roots) {
      root.updateMatrixWorld(true);
      root.traverse((o) => {
        if (!o.isMesh || !o.visible) return;
        if (o.userData.noCollide) return;
        const box = new THREE.Box3().setFromObject(o);
        if (!box.isEmpty()) colliders.push({ mesh: o, box });
      });
    }
  }

  function refreshNear(x, z, y) {
    near.length = 0;
    queryBox.min.set(x - NEAR, y - 2.2, z - NEAR);
    queryBox.max.set(x + NEAR, y + 2.6, z + NEAR);
    for (const c of colliders) if (c.box.intersectsBox(queryBox)) near.push(c.mesh);
  }

  const ray = new THREE.Raycaster();
  ray.far = 6;

  /** True if moving `dist` along `dir` from the feet position would hit something. */
  function blocked(x, z, feetY, dir, dist) {
    for (const h of RAY_HEIGHTS) {
      ray.set(new THREE.Vector3(x, feetY + h, z), dir);
      ray.far = dist + RADIUS;
      if (ray.intersectObjects(near, false).length) return true;
    }
    return false;
  }

  /** The surface under the feet within reach: its height and what it is. */
  function groundUnder(x, z, feetY, reach) {
    const top = feetY + STEP_UP;
    ray.set(new THREE.Vector3(x, top, z), DOWN);
    ray.far = STEP_UP + reach;
    const hit = ray.intersectObjects(near, false)[0];
    return hit ? { y: top - hit.distance, object: hit.object } : null;
  }

  /** The `kind` of the floorplan item a mesh belongs to, if any. */
  function itemKind(object) {
    for (let n = object; n; n = n.parent) {
      if (n.userData?.item?.kind) return n.userData.item.kind;
    }
    return null;
  }
  const DOWN = new THREE.Vector3(0, -1, 0);
  const UP = new THREE.Vector3(0, 1, 0);

  // ── player state ──────────────────────────────────────────────────────
  const pos = new THREE.Vector3();   // the FEET, not the eye
  const vel = new THREE.Vector3();   // horizontal only
  let velY = 0;
  let grounded = false;
  let crouch = false;
  const keys = new Set();

  /**
   * Stand the player at a point given in the shared sheet pixels the walls use,
   * on the given storey. `spawn()` is this applied to SPAWN; it is also how you
   * get somewhere specific from the console without walking there.
   */
  function goTo([px, py], storey = 0, heading = 0, feetY = null) {
    const home = floorGroups.find((g) => g.set === set && (g.floor.storey ?? 0) === storey);
    const [wx, wz] = toWorld([px, py], home?.floor.alignPx ?? [0, 0]);
    const at = home?.container.position ?? new THREE.Vector3();
    // `feetY` is an absolute height, for standing somewhere the storey's own
    // floor is not the surface underfoot — a stair landing, say. Without it you
    // land on the storey slab and the ray never sees what is above you.
    pos.set(wx + at.x, feetY ?? at.y + 0.05, wz + at.z);
    vel.set(0, 0, 0);
    velY = 0;
    camera.position.set(pos.x, pos.y + EYE, pos.z);
    camera.rotation.set(0, heading, 0, 'YXZ');
  }

  const spawn = () => goTo(SPAWN.px, SPAWN.storey, SPAWN.heading);

  /**
   * What the three horizontal rays hit right now, looking along the camera.
   * When a walk is blocked somewhere it should not be, this names the culprit
   * instead of leaving you to guess from coordinates.
   */
  function probe() {
    refreshNear(pos.x, pos.z, pos.y);
    const d = camera.getWorldDirection(new THREE.Vector3());
    d.y = 0;
    d.normalize();
    return RAY_HEIGHTS.map((h) => {
      ray.set(new THREE.Vector3(pos.x, pos.y + h, pos.z), d);
      ray.far = 1.2;
      const hit = ray.intersectObjects(near, false)[0];
      if (!hit) return { h, hit: null };
      let name = hit.object.name || '(unnamed mesh)';
      for (let n = hit.object; n; n = n.parent) {
        const d2 = n.userData ?? {};
        if (d2.item) { name = `item:${d2.item.name ?? d2.item.kind}`; break; }
        if (d2.wall) { name = `wall:${d2.wall.name}`; break; }
        if (n.name) name = n.name;
      }
      return { h, dist: +hit.distance.toFixed(2), name };
    });
  }

  /** Where the stair geometry actually sits, for diagnosing the climb. */
  function stairBounds() {
    const out = [];
    for (const g of floorGroups) {
      if (g.set !== set) continue;
      g.objects.traverse((o) => {
        const it = o.userData?.item;
        if (!it || (it.kind !== 'stairs' && !/stair/i.test(it.name ?? ''))) return;
        const b = new THREE.Box3().setFromObject(o);
        out.push({
          name: it.name ?? it.kind,
          min: b.min.toArray().map((n) => +n.toFixed(2)),
          max: b.max.toArray().map((n) => +n.toFixed(2)),
        });
      });
    }
    return out;
  }

  // ── movement ──────────────────────────────────────────────────────────
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const wish = new THREE.Vector3();
  const dir = new THREE.Vector3();

  function step(dt) {
    refreshNear(pos.x, pos.z, pos.y);

    camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    // right = forward × up. Facing north (0,0,-1) that is east (1,0,0), so D
    // strafes right and A left. Getting the sign the wrong way round swaps them.
    right.set(-fwd.z, 0, fwd.x);

    wish.set(0, 0, 0);
    if (keys.has('w')) wish.add(fwd);
    if (keys.has('s')) wish.sub(fwd);
    if (keys.has('d')) wish.add(right);
    if (keys.has('a')) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize();

    // You move while a key is down and stop when you let go — no glide, no
    // drift. Only airborne is there any carry, because stopping dead in mid-air
    // is worse than a short arc.
    const idle = wish.lengthSq() === 0;
    const speed = (keys.has('shift') ? RUN : WALK) * (crouch ? 0.45 : 1);
    const rate = (grounded ? (idle ? STOP : ACCEL) : AIR_ACCEL) * dt;
    vel.x += (wish.x * speed - vel.x) * Math.min(1, rate);
    vel.z += (wish.z * speed - vel.z) * Math.min(1, rate);
    if (idle && vel.lengthSq() < 0.0025) vel.set(0, 0, 0);   // < 5 cm/s is standing still

    // Horizontal: try the whole move, then each axis alone so walls slide.
    const wasX = pos.x;
    const wasZ = pos.z;
    const wasY = pos.y;
    let dx = vel.x * dt;
    let dz = vel.z * dt;
    const len = Math.hypot(dx, dz);
    if (len > 1e-5) {
      dir.set(dx / len, 0, dz / len);
      if (blocked(pos.x, pos.z, pos.y, dir, len)) {
        const okX = Math.abs(dx) > 1e-5
          && !blocked(pos.x, pos.z, pos.y, dir.set(Math.sign(dx), 0, 0), Math.abs(dx));
        const okZ = Math.abs(dz) > 1e-5
          && !blocked(pos.x, pos.z, pos.y, dir.set(0, 0, Math.sign(dz)), Math.abs(dz));
        if (!okX) { dx = 0; vel.x = 0; }
        if (!okZ) { dz = 0; vel.z = 0; }
      }
      pos.x += dx;
      pos.z += dz;
    }

    // Vertical: gravity, then whatever the down-ray lands on.
    velY -= GRAVITY * dt;
    const nextY = pos.y + velY * dt;
    const under = groundUnder(pos.x, pos.z, pos.y, Math.max(0.2, pos.y - nextY + 0.2));
    if (under && nextY <= under.y + 1e-3) {
      pos.y = under.y;
      velY = 0;
      grounded = true;
    } else {
      pos.y = nextY;
      grounded = false;
    }

    // A step up is only allowed if you could actually stand there. Without
    // this you climb the first thing under 0.45 m — a sofa, a bed, a worktop —
    // and end up with your head inside the ceiling or a wall, with the rays
    // starting inside geometry and no way back out.
    // Stairs are exempt: flight 2 climbs under the first-floor slab, where
    // the clearance is genuinely less than head height, and refusing the step
    // there walls the upper storey off at the half-landing.
    if (grounded && pos.y > wasY + 0.06 && itemKind(under.object) !== 'stairs') {
      ray.set(new THREE.Vector3(pos.x, pos.y + 0.12, pos.z), UP);
      ray.far = HEAD_ROOM;
      if (ray.intersectObjects(near, false).length) {
        pos.set(wasX, wasY, wasZ);
        vel.set(0, 0, 0);
        velY = 0;
      }
    }

    if (pos.y < -8) spawn();   // fell out of the world

    const eye = (crouch ? 1.15 : EYE);
    camera.position.set(pos.x, pos.y + eye, pos.z);
  }

  // ── input ─────────────────────────────────────────────────────────────
  function onKey(e, down) {
    if (!active) return;
    const k = e.key.toLowerCase();
    if (k === 'shift') { down ? keys.add('shift') : keys.delete('shift'); return; }
    if ('wasd'.includes(k) && k.length === 1) {
      down ? keys.add(k) : keys.delete(k);
      e.preventDefault();
      return;
    }
    if (k === 'c' && down) crouch = !crouch;
    if (k === ' ' && down) {
      if (grounded) { velY = JUMP; grounded = false; }
      e.preventDefault();
    }
  }
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  // A keyup that never arrives — alt-tab, Esc out of pointer lock, the window
  // losing focus mid-stride — would otherwise read as a key held down forever
  // and you would walk off on your own. Every route out of the keyboard
  // clears the set.
  const release = () => { keys.clear(); vel.set(0, 0, 0); };
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement) release();
  });

  look.addEventListener('lock', () => {
    overlay.style.display = 'none';
    crosshair.style.display = 'block';
  });
  look.addEventListener('unlock', () => {
    release();
    crosshair.style.display = 'none';
    if (active) overlay.style.display = 'grid';
  });
  overlay.addEventListener('click', () => { if (active) look.lock(); });

  // ── enter / leave ─────────────────────────────────────────────────────
  let active = false;
  const saved = {
    pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: camera.fov,
    ambient: 0, hemi: 0, exposure: 1,
  };
  const hidden = [];

  function enter() {
    if (active) return;
    active = true;
    saved.pos.copy(camera.position);
    saved.target.copy(orbit.target);
    saved.fov = camera.fov;

    orbit.enabled = false;
    look.enabled = true;

    // Hide the other models and the name plates: inside one house you should
    // not see its copies through the windows.
    hidden.length = 0;
    for (const g of floorGroups) {
      if (g.set !== set && g.container.visible) { g.container.visible = false; hidden.push(g.container); }
    }
    if (labelGroup.visible) { labelGroup.visible = false; hidden.push(labelGroup); }

    // Every floor of the walkable model has to be there to be walked on.
    for (const g of floorGroups) if (g.set === set) g.container.visible = true;

    saved.ambient = ambient?.intensity ?? 0;
    saved.hemi = hemi?.intensity ?? 0;
    saved.exposure = renderer.toneMappingExposure;
    if (ambient) ambient.intensity = INDOOR.ambient;
    if (hemi) hemi.intensity = INDOOR.hemi;
    renderer.toneMappingExposure = INDOOR.exposure;
    lamp.intensity = 9;

    camera.fov = FOV;
    camera.updateProjectionMatrix();
    collectColliders();
    spawn();
    overlay.style.display = 'grid';
    document.body.classList.add('walking');
    if (statusEl) statusEl.textContent = '';
  }

  function leave() {
    if (!active) return;
    active = false;
    look.enabled = false;
    if (look.isLocked) look.unlock();
    keys.clear();
    crouch = false;
    overlay.style.display = 'none';
    crosshair.style.display = 'none';
    document.body.classList.remove('walking');

    for (const o of hidden) o.visible = true;
    hidden.length = 0;

    if (ambient) ambient.intensity = saved.ambient;
    if (hemi) hemi.intensity = saved.hemi;
    renderer.toneMappingExposure = saved.exposure;
    lamp.intensity = 0;

    camera.fov = saved.fov;
    camera.updateProjectionMatrix();
    camera.position.copy(saved.pos);
    orbit.target.copy(saved.target);
    orbit.enabled = true;
    orbit.update();
  }

  return {
    get active() { return active; },
    get model() { return set; },
    /** Walk a different model ('apart' | 'stacked' | 'copy'); re-enters if inside. */
    setModel(next) {
      if (next === set) return;
      const was = active;
      if (was) leave();
      set = next;
      if (was) enter();
    },
    /** Player state, for the console and the desktop smoke test. */
    debug: () => ({
      keys: [...keys], grounded, crouch,
      pos: pos.toArray().map((n) => +n.toFixed(2)),
      vel: vel.toArray().map((n) => +n.toFixed(3)),
      velY: +velY.toFixed(3), locked: look.isLocked, colliders: colliders.length,
    }),
    goTo,
    stairBounds,
    probe,
    toggle() { active ? leave() : enter(); },
    enter,
    leave,
    update(dt) { if (active && look.isLocked) step(Math.min(dt, 0.05)); },
  };
}

export const WALK_SPAWN = SPAWN;
export const PLAYER = { EYE, RADIUS, STEP_UP, metersPerPixel: PLAN.metersPerPixel };
