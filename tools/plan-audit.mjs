/**
 * Audits src/floorplan.js against the vector geometry in the source PDF.
 *
 *   node tools/plan-audit.mjs            # reconcile doors, list windows
 *   node tools/plan-audit.mjs 780 1690 1140 2040   # dump segments in a box
 *
 * The PDF is the authoritative source: assets/VILLA KHAN 20092026.pdf is a
 * true vector drawing, so wall lines, door arcs and dimension text can be
 * read exactly rather than eyeballed off the JPEG. PDF points map onto the
 * sheet-pixel space used by floorplan.js by a single scale (the JPEG was
 * rendered at 150 dpi, i.e. 3509 px / 1684 pt) plus a Y flip.
 *
 * Doors are drawn as a quarter-circle swing arc. The arc's centre is the
 * hinge and its radius is the leaf width; of its two endpoints, the one
 * lying along a wall centreline is the closed position, and that is the
 * opening. Windows are not arcs — they are found via their dimension text
 * (e.g. "210" over "110"), which sits at the opening's centre, offset
 * 10–25 px off the wall.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FLOORS, PLAN } from '../src/floorplan.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PDF = path.join(ROOT, 'assets', 'VILLA KHAN 20092026.pdf');
const SHEET_W = 3509; // px width of the rendered JPEG

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const { OPS } = pdfjs;

const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(PDF)) }).promise;
const page = await doc.getPage(1);
const vp = page.getViewport({ scale: 1 });
const S = SHEET_W / vp.width;

const mul = (a, b) => [
  a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1],
  a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
  a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5],
];
const px = (m, x, y) => {
  const wx = m[0]*x + m[2]*y + m[4];
  const wy = m[1]*x + m[3]*y + m[5];
  return [wx * S, (vp.height - wy) * S];
};

// pdfjs 6 packs subpaths as a flat [opcode, ...coords] stream.
const ARITY = { 0: 2, 1: 2, 2: 6, 3: 0 }; // move, line, cubic, close
const ops = await page.getOperatorList();
const segs = [], curves = [];
let ctm = [1, 0, 0, 1, 0, 0];
const stack = [];

for (let i = 0; i < ops.fnArray.length; i++) {
  const fn = ops.fnArray[i], a = ops.argsArray[i];
  if (fn === OPS.save) stack.push(ctm.slice());
  else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
  else if (fn === OPS.transform) ctm = mul(ctm, a);
  else if (fn === OPS.constructPath) {
    for (const sub of a[1]) {
      let c = 0, cur = null, first = null;
      while (c < sub.length) {
        const code = sub[c++];
        if (ARITY[code] === undefined) break;
        if (code === 0) cur = first = px(ctm, sub[c++], sub[c++]);
        else if (code === 1) {
          const p = px(ctm, sub[c++], sub[c++]);
          if (cur) segs.push([...cur, ...p]);
          cur = p;
        } else if (code === 2) {
          const c1 = px(ctm, sub[c++], sub[c++]);
          px(ctm, sub[c++], sub[c++]); // c2, unused
          const p = px(ctm, sub[c++], sub[c++]);
          if (cur) curves.push({ p0: cur, c1, p1: p });
          cur = p;
        } else if (code === 3) {
          if (cur && first) segs.push([...cur, ...first]);
          cur = first;
        }
      }
    }
  }
}

const texts = (await page.getTextContent()).items
  .filter((t) => t.str.trim())
  .map((t) => ({ s: t.str.trim(), x: t.transform[4]*S, y: (vp.height - t.transform[5])*S }));

// ── segment dump mode ───────────────────────────────────────────────────
const box = process.argv.slice(2).map(Number);
if (box.length === 4) {
  const [X0, Y0, X1, Y1] = box;
  const inside = (x, y) => x >= X0 && x <= X1 && y >= Y0 && y <= Y1;
  const rows = [];
  for (const [a, b, c, d] of segs) {
    if (Math.hypot(c-a, d-b) < 25) continue;
    if (!inside(a, b) && !inside(c, d)) continue;
    const h = Math.abs(d-b) < 1.5, v = Math.abs(c-a) < 1.5;
    if (!h && !v) continue;
    rows.push(h
      ? `H y=${b.toFixed(0)}  x ${Math.min(a,c).toFixed(0)}..${Math.max(a,c).toFixed(0)}`
      : `V x=${a.toFixed(0)}  y ${Math.min(b,d).toFixed(0)}..${Math.max(b,d).toFixed(0)}`);
  }
  [...new Set(rows)].sort().forEach((r) => console.log('  ' + r));
  texts.filter((t) => inside(t.x, t.y))
    .forEach((t) => console.log(`  "${t.s}" @ ${t.x.toFixed(0)},${t.y.toFixed(0)}`));
  process.exit(0);
}

// ── door arcs ───────────────────────────────────────────────────────────
const K = 4/3 * (Math.SQRT2 - 1); // cubic control-point ratio for a 90° arc
const arcs = [];
for (const c of curves) {
  const [x0, y0] = c.p0, [x3, y3] = c.p1;
  // Tangents meet at Q; for a quarter arc the centre is p0 + p1 - Q.
  const qx = x0 + (c.c1[0]-x0)/K, qy = y0 + (c.c1[1]-y0)/K;
  const cx = x0 + x3 - qx, cy = y0 + y3 - qy;
  const r0 = Math.hypot(x0-cx, y0-cy), r1 = Math.hypot(x3-cx, y3-cy);
  if (Math.abs(r0-r1) > 0.06*r0) continue;
  const r = (r0+r1)/2;
  if (r < 30 || r > 90) continue;               // 0.5 m .. 1.5 m leaves
  const ang = Math.abs(Math.atan2(y3-cy, x3-cx) - Math.atan2(y0-cy, x0-cx));
  const sweep = Math.min(ang, 2*Math.PI-ang) * 180/Math.PI;
  if (sweep < 55 || sweep > 100) continue;
  if (!arcs.some((u) => Math.hypot(u.c[0]-cx, u.c[1]-cy) < 4 && Math.abs(u.r-r) < 4))
    arcs.push({ c: [cx, cy], r, e: [c.p0, c.p1] });
}

let matched = 0;
const problems = [];
for (const a of arcs) {
  let best = null;
  for (const f of FLOORS) for (const w of f.walls) {
    const [ax, ay] = w.a, [bx, by] = w.b;
    const L = Math.hypot(bx-ax, by-ay), ux = (bx-ax)/L, uy = (by-ay)/L;
    for (const e of a.e) {
      const mx = (a.c[0]+e[0])/2, my = (a.c[1]+e[1])/2;
      const t = (mx-ax)*ux + (my-ay)*uy;
      if (Math.abs(-(mx-ax)*uy + (my-ay)*ux) > 12 || t < 0 || t > L) continue;
      const dir = (e[0]-a.c[0])*ux + (e[1]-a.c[1])*uy;
      if (Math.abs(dir) < a.r*0.85) continue;   // leaf must lie along the wall
      const t0 = (a.c[0]-ax)*ux + (a.c[1]-ay)*uy;
      const lo = Math.min(t0, t0+dir), hi = Math.max(t0, t0+dir);
      const hit = (w.openings ?? []).find((o) =>
        Math.abs(o.from-lo) < 12 && Math.abs(o.to-hi) < 12);
      if (!best || hit) best = { f, w, lo, hi, hit };
    }
  }
  if (best?.hit) { matched++; continue; }
  problems.push(best
    ? `${best.f.name} · ${best.w.name}: drawing says from ${best.lo.toFixed(0)} to ${best.hi.toFixed(0)}`
    : `unplaced arc: hinge ${a.c.map((v) => v.toFixed(0)).join(',')} r=${a.r.toFixed(0)}px`);
}

console.log(`doors: ${matched}/${arcs.length} arcs matched`);
problems.forEach((p) => console.log('  ! ' + p));
console.log('  (two arcs at ~1198,1927 are the curved sofa, not doors)');

// ── window schedule from dimension text ─────────────────────────────────
console.log('\nwindow schedule (width/height cm @ sheet px, centre of opening):');
const nums = texts.filter((t) => /^\d{2,3}$/.test(t.s));
const seen = new Set();
nums.forEach((t, i) => {
  if (seen.has(i)) return;
  const j = nums.findIndex((u, k) => k !== i && !seen.has(k) && Math.hypot(u.x-t.x, u.y-t.y) < 14);
  if (j < 0) return;
  seen.add(i); seen.add(j);
  const pair = [t.s, nums[j].s].map(Number);
  const width = Math.max(...pair) === 230 ? Math.min(...pair) : Math.max(...pair);
  console.log(`  ${String(width).padStart(3)} cm  = ${(width*0.01/PLAN.metersPerPixel).toFixed(0)} px  @ ${t.x.toFixed(0)},${t.y.toFixed(0)}`);
});
