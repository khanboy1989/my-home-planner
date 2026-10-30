/**
 * Lighting circuits from the electrical project (`tools/electric-plan.py`):
 * L1 the living room's spots, L2 its hidden cove LED, L3 the dining
 * chandelier, L4 the kitchen's under-cabinet strips. Fittings on a circuit
 * fade with it; the wall switches in walk mode (`E`) flip it.
 *
 * A circuit's glowing parts use materials from `circuitMat()`, clones of the
 * shared ones, so a fade only touches that circuit's fittings. Its emitters
 * carry `circuit`, and `LightPool` scales their intensity by `level()` and
 * drops them at zero, so a switched-off room gives its slots to the next.
 *
 * Unlike the rest of the house's lights these are not hidden by day: they are
 * switched. `setTime()` puts every circuit on at night and off by day, and
 * the switches override that until the hour changes.
 */
const FADE_S = 0.35;

const circuits = new Map();     // id -> { label, on, level, mats: [{ mat, base }], groups: [] }

function get(id) {
  if (!circuits.has(id)) circuits.set(id, { label: id, on: false, level: 0, mats: [], groups: [] });
  return circuits.get(id);
}

/** Give a circuit its plain-language name, for the switch hint. */
export function defineCircuit(id, label) { get(id).label = label; }

/** A clone of `base` that fades with circuit `id`. */
export function circuitMat(id, base) {
  const c = get(id);
  const hit = c.mats.find((m) => m.src === base);
  if (hit) return hit.mat;
  const mat = base.clone();
  mat.transparent = true;
  c.mats.push({ src: base, mat, base: base.opacity ?? 1 });
  apply(c);
  return mat;
}

/** A group shown while circuit `id` is above zero. */
export function circuitGroup(id, group) {
  get(id).groups.push(group);
  group.visible = get(id).level > 0;
  return group;
}

export function level(id) { return circuits.get(id)?.level ?? 1; }
export function isOn(id) { return get(id).on; }
export function label(id) { return get(id).label; }
export function circuitIds() { return [...circuits.keys()]; }

function apply(c) {
  for (const { mat, base } of c.mats) mat.opacity = base * c.level;
  for (const g of c.groups) g.visible = c.level > 0;
}

/** Switch one circuit; `instant` skips the fade (the clock changing). */
export function setCircuit(id, on, instant = false) {
  const c = get(id);
  c.on = on;
  if (instant) { c.level = on ? 1 : 0; apply(c); }
}

export function toggleCircuit(id) { setCircuit(id, !get(id).on); return get(id).on; }

/** Every circuit at once, without a fade: what the clock does. */
export function setAllCircuits(on) { for (const id of circuits.keys()) setCircuit(id, on, true); }

/** Advance the fades; true while any circuit is still moving. */
export function stepCircuits(dt) {
  let moving = false;
  for (const c of circuits.values()) {
    const want = c.on ? 1 : 0;
    if (c.level === want) continue;
    c.level = want > c.level ? Math.min(1, c.level + dt / FADE_S) : Math.max(0, c.level - dt / FADE_S);
    apply(c);
    moving = true;
  }
  return moving;
}
