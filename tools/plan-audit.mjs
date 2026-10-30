/**
 * Audits src/floorplan.js against the source drawing: the DWG's geometry
 * export (PLAN.dwg, from P.18 on) or, failing that, the vector PDF.
 *
 *   node tools/plan-audit.mjs            # reconcile doors, list windows
 *   node tools/plan-audit.mjs 780 1690 1140 2040   # dump segments in a box
 *
 * The PDF is the authoritative source: the PDF named by PLAN.pdf is a
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
const SHEET_W = 3509; // px width of the rendered sheet

// From P.18 the source is the architect's DWG (its geometry export, PLAN.dwg);
// the older PDF sheets are read the way they always were.
const { segs, curves, dwgArcs, texts } = PLAN.dwg ? readDwg() : await readPdf();

function readDwg() {
  const g = JSON.parse(fs.readFileSync(path.join(ROOT, PLAN.dwg), 'utf8'));
  const { scale: k, offset: [tx, ty] } = PLAN.dwgToSheet;
  const P = (x, y) => [k * x + tx, -k * y + ty];
  const rad = Math.PI / 180;
  return {
    segs: g.segs.map(([x0, y0, x1, y1]) => [...P(x0, y0), ...P(x1, y1)]),
    curves: [],
    // A DWG arc is exact: centre, radius and both ends straight from the file.
    dwgArcs: g.arcs.map(([cx, cy, r, a0, a1]) => {
      const end = (a) => P(cx + r * Math.cos(a * rad), cy + r * Math.sin(a * rad));
      return { c: P(cx, cy), r: r * k, e: [end(a0), end(a1)], sweep: (((a1 - a0) % 360) + 360) % 360 };
    }),
    texts: g.texts.map(([x, y, , , s]) => {
      const [px, py] = P(x, y);
      return { s, x: px, y: py };
    }),
  };
}

async function readPdf() {
const PDF = path.join(ROOT, PLAN.pdf);

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const { OPS } = pdfjs;

const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(PDF)) }).promise;
const page = await doc.getPage(1);
// Through the viewport transform, not a bare Y flip: P.16 was printed through
// a Windows driver onto a portrait page with /Rotate 90, so its content
// stream is sideways and only the viewport puts it the right way up.
const vp = page.getViewport({ scale: SHEET_W / page.getViewport({ scale: 1 }).width });
const VT = vp.transform;
const pagePx = (x, y) => [VT[0]*x + VT[2]*y + VT[4], VT[1]*x + VT[3]*y + VT[5]];
// A revision can be re-plotted at a slightly different scale and position on
// the page. The model keeps its pixel frame, so page px are mapped back into it.
const { scale: SK, offset: [TX, TY] } = PLAN.pdfToSheet;
const toSheet = (x, y) => [(x - TX) / SK, (y - TY) / SK];

const mul = (a, b) => [
  a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1],
  a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
  a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5],
];
const px = (m, x, y) => {
  return toSheet(...pagePx(m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5]));
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
          const c2 = px(ctm, sub[c++], sub[c++]);
          const p = px(ctm, sub[c++], sub[c++]);
          if (cur) curves.push({ p0: cur, c1, c2, p1: p });
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
  .map((t) => {
    const [x, y] = toSheet(...pagePx(t.transform[4], t.transform[5]));
    return { s: t.str.trim(), x, y };
  });

return { segs, curves, dwgArcs: null, texts };
}

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
// A swing is a circular arc: centre = hinge, radius = leaf width. AutoCAD
// plots each one as a single 90° cubic, but a sheet printed through a
// PostScript driver (P.16) splits it into several shorter cubics. So every
// cubic is fitted with the circle through its ends and its midpoint, and
// pieces sharing a centre and radius are merged back into one arc.
const pieces = [];
for (const c of curves) {
  const [x0, y0] = c.p0, [x3, y3] = c.p1;
  const bx = (x0 + 3*c.c1[0] + 3*c.c2[0] + x3) / 8, by = (y0 + 3*c.c1[1] + 3*c.c2[1] + y3) / 8;
  const d = 2 * (x0*(by-y3) + bx*(y3-y0) + x3*(y0-by));
  if (Math.abs(d) < 1e-6) continue;                     // straight
  const s0 = x0*x0 + y0*y0, s1 = bx*bx + by*by, s3 = x3*x3 + y3*y3;
  const cx = (s0*(by-y3) + s1*(y3-y0) + s3*(y0-by)) / d;
  const cy = (s0*(x3-bx) + s1*(x0-x3) + s3*(bx-x0)) / d;
  const r = Math.hypot(x0-cx, y0-cy);
  // 0.65 m .. 1.5 m leaves. The garden trees are drawn as r≈32 px arcs, so
  // the floor is set above that; the narrowest door, K1:80, is ~43.
  if (r < 38 || r > 90) continue;
  pieces.push({ c: [cx, cy], r, ends: [c.p0, c.p1] });
}
const arcs = dwgArcs ? dwgArcs.filter((a) => a.r >= 38 && a.r <= 90) : [];
for (const p of dwgArcs ? [] : pieces) {
  const u = arcs.find((a) => Math.hypot(a.c[0]-p.c[0], a.c[1]-p.c[1]) < 3 && Math.abs(a.r-p.r) < 3);
  if (u) u.pts.push(...p.ends); else arcs.push({ c: p.c, r: p.r, pts: [...p.ends] });
}
for (const a of dwgArcs ? [] : arcs) {
  // The arc's two ends are the pair of points furthest apart in angle.
  const ang = a.pts.map(([x, y]) => Math.atan2(y - a.c[1], x - a.c[0]));
  let best = [0, 0, -1];
  for (let i = 0; i < ang.length; i++) for (let j = i + 1; j < ang.length; j++) {
    let d = Math.abs(ang[i] - ang[j]); d = Math.min(d, 2*Math.PI - d);
    if (d > best[2]) best = [i, j, d];
  }
  a.sweep = best[2] * 180 / Math.PI;
  a.e = [a.pts[best[0]], a.pts[best[1]]];
}
// Doors are inside a floor's crop; out in the parking bays the arcs are the
// cars' wing mirrors.
const inCrop = ([x, y]) => FLOORS.some(({ crop: c }) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
for (let i = arcs.length - 1; i >= 0; i--) {
  if (arcs[i].sweep < 55 || arcs[i].sweep > 100 || !inCrop(arcs[i].c)) arcs.splice(i, 1);
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
console.log(PLAN.dwg
  ? '  (the two arcs at ~497,1661 are the curved sofa in OYUN ODASI, not doors)'
  : '  (the six arcs at ~1200,1718 and ~495,1662 are the curved sofas in OTURMA and OYUN ODASI, not doors)');

// ── window schedule from dimension text ─────────────────────────────────
console.log('\nwindow schedule (width/height cm @ sheet px, centre of opening):');
const nums = texts.filter((t) => /^\d{2,3}$/.test(t.s));
if (!texts.length) console.log('  (none: this sheet has no text layer — P.16 was printed with its lettering as outlines)');
const seen = new Set();
nums.forEach((t, i) => {
  if (seen.has(i)) return;
  const j = nums.findIndex((u, k) => k !== i && !seen.has(k) && Math.hypot(u.x-t.x, u.y-t.y) < 14);
  if (j < 0) return;
  seen.add(i); seen.add(j);
  const pair = [t.s, nums[j].s].map(Number);
  // Tags read width over height, and every height on the sheet is 230 or 110.
  const tall = [t, nums[j]].sort((p, q) => p.y - q.y);
  const width = Number(tall[1].s) === 230 || Number(tall[1].s) === 110 ? Number(tall[0].s) : Math.max(...pair);
  console.log(`  ${String(width).padStart(3)} cm  = ${(width*0.01/PLAN.metersPerPixel).toFixed(0)} px  @ ${t.x.toFixed(0)},${t.y.toFixed(0)}`);
});
