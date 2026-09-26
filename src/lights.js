import * as THREE from 'three';

/**
 * A fixed pool of spot lights, shared between every fitting in the house.
 *
 * The house has far more fittings than a scene can shade. Once every room has
 * four spots in its coffer, plus the band along the facade, the sconces, the
 * under-cabinet strips and the chandelier, there are a couple of hundred of
 * them; a WebGL fragment shader pays for every light on every lit pixel, so
 * lighting them all at once would be unplayable.
 *
 * So no fitting owns a light. A fitting registers an **emitter** — an empty
 * marker carrying the lamp's parameters in `userData.emitter` — and this pool
 * hands out `POOL_SIZE` real `SpotLight`s to whichever emitters are nearest
 * the camera, re-aiming them as you move. Walking through the house you are
 * only ever inside one or two rooms' light, and from outside you only see the
 * facade nearest you, so the nearest few are exactly the ones that matter.
 *
 * **The pool size never changes while the lights are on.** three.js compiles a
 * shader per light count, so growing and shrinking the set as you walk would
 * recompile every material in the scene a few times a second. Slots with no
 * emitter are parked below the world at zero intensity instead, which costs a
 * little arithmetic and no recompiles. The whole pool is hidden by day, which
 * is the one moment the count is allowed to change.
 */
export const POOL_SIZE = 18;

/** Beyond this an interior fitting cannot win a slot — you are not in its room. */
const INTERIOR_RANGE = 13;

/**
 * Interior fittings count as half as far away as they are. Standing in a room
 * its own four spots are 2–4 m off while the facade band outside the window is
 * 5–8 m, which is close enough to be a fair fight; the bias settles it for the
 * room you are actually standing in.
 */
const INTERIOR_BIAS = 0.5;

/** Re-picking every frame is wasted work — you cannot walk far in 120 ms. */
const REFRESH_MS = 120;

const _pos = new THREE.Vector3();
const _aim = new THREE.Vector3();

/**
 * Declare a lamp. `opts.at` and `opts.aim` are local to `parent`; everything
 * else is the `SpotLight` signature. `interior` marks a fitting inside the
 * house, which is what the range gate and the bias above key off.
 */
export function emitter(parent, opts) {
  const mark = new THREE.Object3D();
  mark.position.set(...opts.at);
  mark.userData.emitter = {
    aim: new THREE.Vector3(...opts.aim),
    color: opts.color ?? 0xffd7a0,
    intensity: opts.intensity ?? 6,
    distance: opts.distance ?? 8,
    angle: opts.angle ?? 0.6,
    penumbra: opts.penumbra ?? 0.5,
    decay: opts.decay ?? 1.5,
    interior: opts.interior ?? false,
  };
  parent.add(mark);
  return mark;
}

export class LightPool {
  constructor(scene, size = POOL_SIZE) {
    this.scene = scene;
    this.lamps = [];          // { mark, e, world: Vector3, dir: Vector3 }
    this.on = false;
    this.last = -Infinity;
    this.slots = [];
    for (let i = 0; i < size; i++) {
      const spot = new THREE.SpotLight(0xffffff, 0, 10, 0.6, 0.5, 1.5);
      spot.visible = false;
      spot.position.set(0, -1000, 0);
      spot.target.position.set(0, -1001, 0);
      scene.add(spot, spot.target);
      this.slots.push(spot);
    }
  }

  /**
   * Find every emitter under `root` and freeze its world position and aim.
   * Call this once the models are in their final places — nothing moves
   * afterwards, so the transforms never need recomputing.
   */
  collect(root) {
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      const e = o.userData.emitter;
      if (!e) return;
      const world = o.getWorldPosition(new THREE.Vector3());
      const dir = o.localToWorld(_aim.copy(e.aim)).sub(world).normalize();
      // The model this fitting belongs to, so a hidden model's lamps cannot
      // take slots from the one you are looking at. Positions never move, but
      // whole models are shown and hidden (`5`), which this is the cheap test
      // for: one property read per lamp instead of walking the tree.
      let owner = o;
      while (owner && owner.userData.set === undefined) owner = owner.parent;
      this.lamps.push({ e, world, dir, owner });
    });
    return this.lamps.length;
  }

  /** Day hides the whole pool — the one moment the light count may change. */
  setOn(on) {
    if (on === this.on) return;
    this.on = on;
    for (const s of this.slots) s.visible = on;
    this.last = -Infinity;                 // re-pick on the next update
  }

  /** Give the slots to the emitters nearest the camera. */
  update(camera, now) {
    if (!this.on || now - this.last < REFRESH_MS) return;
    this.last = now;
    camera.getWorldPosition(_pos);

    const near = [];
    for (const lamp of this.lamps) {
      if (lamp.owner && !lamp.owner.visible) continue;
      const d = lamp.world.distanceTo(_pos);
      if (lamp.e.interior) {
        if (d > INTERIOR_RANGE) continue;
        near.push({ lamp, score: d * INTERIOR_BIAS });
      } else {
        near.push({ lamp, score: d });
      }
    }
    near.sort((a, b) => a.score - b.score);

    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      const pick = near[i];
      if (!pick) {                          // park the spare below the world
        slot.intensity = 0;
        slot.position.set(0, -1000, 0);
        slot.target.position.set(0, -1001, 0);
        continue;
      }
      const { lamp } = pick;
      const { e } = lamp;
      slot.color.set(e.color);
      slot.intensity = e.intensity;
      slot.distance = e.distance;
      slot.angle = e.angle;
      slot.penumbra = e.penumbra;
      slot.decay = e.decay;
      slot.position.copy(lamp.world);
      slot.target.position.copy(lamp.world).addScaledVector(lamp.dir, 2);
      slot.target.updateMatrixWorld();
    }
  }
}
