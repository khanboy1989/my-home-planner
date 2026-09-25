/**
 * Renders PLAN.pdf into the model's sheet-pixel frame as the floor texture.
 *
 *   node tools/render-sheet.mjs            # writes PLAN.image
 *
 * The page is drawn through the inverse of PLAN.pdfToSheet, so a revision that
 * was re-plotted at another scale or position still lands on the walls traced
 * in floorplan.js. 3509 x 2482 px, i.e. an A-size sheet at 150 dpi.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PLAN } from '../src/floorplan.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { createCanvas } = createRequire(import.meta.url)('@napi-rs/canvas');
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const [W, H] = [3509, 2482];

const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path.join(ROOT, PLAN.pdf))) }).promise;
const page = await doc.getPage(1);
const viewport = page.getViewport({ scale: W / page.getViewport({ scale: 1 }).width });
const { scale: k, offset: [tx, ty] } = PLAN.pdfToSheet;

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#fff';
ctx.fillRect(0, 0, W, H);
await page.render({ canvasContext: ctx, canvas, viewport, transform: [1 / k, 0, 0, 1 / k, -tx / k, -ty / k] }).promise;

const out = path.join(ROOT, PLAN.image);
fs.writeFileSync(out, canvas.toBuffer('image/jpeg', 90));
console.log(`wrote ${path.relative(ROOT, out)} (${W}x${H})`);
