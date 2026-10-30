/**
 * Renders the plan into the model's sheet-pixel frame as the floor texture.
 *
 *   node tools/render-sheet.mjs            # writes PLAN.image
 *
 * From P.18 the source is the DWG's geometry export (PLAN.dwg, written by
 * tools/dwg-export.py), drawn through PLAN.dwgToSheet: the plans are redrawn
 * line by line, so the texture lands on the walls traced in floorplan.js by
 * construction. Without PLAN.dwg it falls back to rendering PLAN.pdf through
 * the inverse of PLAN.pdfToSheet, as P.13–P.16 were. 3509 x 2482 px either way.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PLAN, AREA_FIXES } from '../src/floorplan.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { createCanvas } = createRequire(import.meta.url)('@napi-rs/canvas');
const [W, H] = [3509, 2482];

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#fff';
ctx.fillRect(0, 0, W, H);

if (PLAN.dwg) drawDwg(); else await drawPdf();

const out = path.join(ROOT, PLAN.image);
fs.writeFileSync(out, canvas.toBuffer('image/jpeg', 90));
console.log(`wrote ${path.relative(ROOT, out)} (${W}x${H})`);

function drawDwg() {
  const g = JSON.parse(fs.readFileSync(path.join(ROOT, PLAN.dwg), 'utf8'));
  const { scale: k, offset: [tx, ty] } = PLAN.dwgToSheet;
  const P = (x, y) => [k * x + tx, -k * y + ty];

  // The structural grid, the overall dimensions and the section marker are
  // drawing furniture, not the building; under a 3D model they are noise.
  const SKIP = new Set(['00_Axis', '00 aks yazi', '04 DIS OLCU', 'Defpoints', '0000 3D ZEMIN']);
  const WALLS = new Set(['00_DUVAR', '000 DUVAR UPDATED', 'COLUMN4']);
  const style = (layer) => {
    if (WALLS.has(layer)) return ['#111', 1.8];
    if (layer.startsWith('04')) return ['#222', 1.0];      // windows, door swings, tags
    return ['#333', 0.8];                                 // furniture, stairs, the rest
  };

  ctx.lineCap = 'round';
  for (const [pts, layer] of g.hatches) {
    if (SKIP.has(layer)) continue;
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(...P(x, y)) : ctx.moveTo(...P(x, y))));
    ctx.closePath();
    ctx.fill();
  }
  for (const [x0, y0, x1, y1, layer] of g.segs) {
    if (SKIP.has(layer)) continue;
    [ctx.strokeStyle, ctx.lineWidth] = style(layer);
    ctx.beginPath();
    ctx.moveTo(...P(x0, y0));
    ctx.lineTo(...P(x1, y1));
    ctx.stroke();
  }
  // DXF arcs run counter-clockwise in a y-up frame; flipping Y turns that
  // into clockwise from -end to -start, which is canvas's default direction.
  const rad = Math.PI / 180;
  for (const [cx, cy, r, a0, a1, layer] of g.arcs) {
    if (SKIP.has(layer)) continue;
    [ctx.strokeStyle, ctx.lineWidth] = style(layer);
    ctx.beginPath();
    ctx.arc(...P(cx, cy), r * k, -a1 * rad, -a0 * rad);
    ctx.stroke();
  }
  for (const [cx, cy, r, layer] of g.circles) {
    if (SKIP.has(layer)) continue;
    [ctx.strokeStyle, ctx.lineWidth] = style(layer);
    ctx.beginPath();
    ctx.arc(...P(cx, cy), r * k, 0, 2 * Math.PI);
    ctx.stroke();
  }
  ctx.fillStyle = '#222';
  for (const [x, y, h, rot, raw, layer] of g.texts) {
    if (SKIP.has(layer)) continue;
    // Areas the drawing prints wrong (AREA_FIXES in floorplan.js).
    const fix = AREA_FIXES.find((f) => f.was === raw && Math.hypot(f.at[0] - x, f.at[1] - y) < 5);
    const text = fix ? fix.now : raw;
    ctx.save();
    ctx.translate(...P(x, y));
    ctx.rotate(-rot * rad);
    ctx.font = `${Math.max(4, h * k).toFixed(1)}px Arial, Helvetica, sans-serif`;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
}

async function drawPdf() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path.join(ROOT, PLAN.pdf))) }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: W / page.getViewport({ scale: 1 }).width });
  const { scale: k, offset: [tx, ty] } = PLAN.pdfToSheet;
  await page.render({ canvasContext: ctx, canvas, viewport, transform: [1 / k, 0, 0, 1 / k, -tx / k, -ty / k] }).promise;
}
