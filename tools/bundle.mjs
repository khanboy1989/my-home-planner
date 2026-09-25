/**
 * Compiles the whole viewer into ONE self-contained .html file that opens
 * straight from the file system — nothing to install, no server, no network.
 *
 *   node tools/bundle.mjs            →  dist/villa-khan-3d.html
 *
 * How it works: ES modules can be addressed by `data:` URL, and an import map
 * can point bare specifiers at them. So every module — three, OrbitControls
 * and this project's own src/*.js — goes into the map as a base64 data: URL,
 * and the relative imports in src are rewritten to the bare names the map
 * defines. The plan JPEG is inlined the same way; a data: URL does not taint
 * the canvas, so cropTexture() still works with no HTTP origin at all.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p));
const dataUrl = (type, buf) => `data:${type};base64,${Buffer.from(buf).toString('base64')}`;

const SRC = ['floorplan.js', 'groundCopy.js', 'buildWalls.js', 'objects.js', 'walk.js', 'main.js'];

// three.module.js re-exports from './three.core.js'; a data: URL has no base
// to resolve that against, so the core goes in the map under its own name.
const threeModule = read('node_modules/three/build/three.module.js')
  .toString().replaceAll("'./three.core.js'", "'three/core'");

const imports = {
  three: dataUrl('text/javascript', threeModule),
  'three/core': dataUrl('text/javascript', read('node_modules/three/build/three.core.js')),
  'three/addons/controls/OrbitControls.js':
    dataUrl('text/javascript', read('node_modules/three/examples/jsm/controls/OrbitControls.js')),
  'three/addons/controls/PointerLockControls.js':
    dataUrl('text/javascript', read('node_modules/three/examples/jsm/controls/PointerLockControls.js')),
};

for (const name of SRC) {
  let code = read(`src/${name}`).toString();
  // './floorplan.js' → 'app:floorplan.js', the name the import map defines.
  code = code.replace(/from '\.\/([\w.]+)'/g, "from 'app:$1'");
  // Every plan sheet a module names ('assets/….jpg') is inlined as a data: URL.
  code = code.replace(/'(assets\/[^']+\.jpg)'/g, (_, img) => JSON.stringify(dataUrl('image/jpeg', read(img))));
  imports[`app:${name}`] = dataUrl('text/javascript', code);
}

/**
 * One page → one self-contained file. Both entry pages get the same treatment:
 * index.html (orbit the models) and walk.html (start inside the house).
 */
function bundle(page, out) {
  let html = read(page).toString();
  html = html.replace('<link rel="stylesheet" href="./src/viewer.css">',
    `<style>\n${read('src/viewer.css')}\n</style>`);
  html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/,
    `<script type="importmap">\n${JSON.stringify({ imports }, null, 0)}\n</script>`);
  html = html.replace('<script type="module" src="./src/main.js"></script>',
    "<script type=\"module\">import 'app:main.js';</script>");

  mkdirSync(join(root, 'dist'), { recursive: true });
  const file = join(root, out);
  writeFileSync(file, html);
  console.log(`${file}  ${(Buffer.byteLength(html) / 1e6).toFixed(2)} MB`);
}

bundle('index.html', 'dist/villa-khan-3d.html');
bundle('walk.html', 'dist/villa-khan-walk.html');
