/**
 * Villa Khan — plan data, traced off the architectural sheet in assets/.
 *
 * Coordinates are PIXELS OF THE SHEET IMAGE (3509 x 2482), not metres. The
 * frame is P.13's (the 20/09/2026 sheet); later revisions are mapped into it
 * by PLAN.pdfToSheet, so nothing here had to be rescaled when P.14 arrived
 * re-plotted at a different size. The sheet carries both floors side by side,
 * so each floor also records `alignPx`, which shifts its own drawing into the
 * shared world frame anchored on the ground floor.
 *
 *   sharedPx = floorPx + floor.alignPx
 *   world X  = (sharedPx.x - (origin.x + origin.w / 2)) * metersPerPixel
 *   world Z  = (sharedPx.y - (origin.y + origin.h / 2)) * metersPerPixel
 *
 * The first floor's alignment (-1763, -204) was derived by matching wall faces
 * the two plans share in P.14 — the kitchen block / north block north wall,
 * the living room / master suite north and east walls — to within 1 px.
 *
 * metersPerPixel was calibrated against the K1:100/230 doors (1.00 m clear
 * opening) and cross-checked against the old GARAJ 42.00 m².
 */

export const PLAN = {
  image: 'assets/VILLA KHAN 24092026_page-0001.jpg',
  // The vector source. P.14 (24/09/2026) was re-plotted 1.6% larger and
  // shifted on the page, so `pdfToSheet` maps its page px (3509 across, as
  // rendered at 150 dpi) back into this model's pixel frame, which is P.13's:
  //   sheetPx = (pagePx - offset) / scale
  // Fitted on the first-floor room labels, residual < 0.3 px. PLAN.image is
  // rendered through the same transform by `node tools/render-sheet.mjs`.
  pdf: 'assets/VILLA KHAN 24092026.pdf',
  pdfToSheet: { scale: 1.016043, offset: [-23.125, -12.957] },
  metersPerPixel: 0.0168,
  storeyHeight: 3.0,
  // The ground-floor stair is annotated MÜ: 20 (17x30) — 20 risers at 17 cm —
  // so the real floor-to-floor is 3.40 m. (P.14's first-floor copy of the note
  // reads 18; the ground floor's still reads 20.) That drives the stacked
  // layout; storeyHeight is the clear wall height below the slab.
  floorToFloor: 3.4,
  thickness: { exterior: 0.25, interior: 0.15 },
  head: 2.3,
  sill: 0.9,
};

/** World origin: the ground-floor crop defines the shared frame. */
export const ORIGIN = { x: 384, y: 975, w: 1060, h: 855 };

/**
 * Wall entries:
 *   a, b       – centreline endpoints, in that floor's sheet pixels
 *   type       – 'exterior' | 'interior' (thickness + material)
 *   thickness  – optional metre override
 *   openings   – from / to are distances along the wall from `a`, IN PIXELS;
 *                sill / head are metres above that floor's finished floor.
 *                Omit them for window defaults (0.9 / 2.3); doors pass sill: 0.
 *                `swing: 1` opens to the right of a → b as seen on the page.
 *
 * ZEMIN was re-traced from P.14. The house sits 204 px (3.4 m) further north
 * on the plot than in P.13, the garage is gone — it is a study (ÇALIŞMA
 * ODASI), a play room (OYUN ODASI) and a W.C, and the cars park outside — and
 * GIRIS HOLU is now a double-height hall under the first floor's GALERI
 * BOSLUGU, entered through a K1:180/230 double door.
 */
const GROUND_WALLS = [
  // ────────────────────────────────── kitchen / dining block (north)
  {
    name: 'Kitchen block — north exterior',
    type: 'exterior',
    a: [474, 992], b: [938, 992],
    openings: [
      { from: 54, to: 166, kind: 'window' },  // 180/230
      // Dining → back garden: a glazed slider straight out to the pool
      // terrace, behind the dining table. The sheet draws a 250/230 window
      // here; the owner asked for a door, so it keeps the drawn opening
      // (x 754..909, 2.60 m — centred on the table) and only drops to the
      // floor. Black joinery, like the other slider. It parks eastward so the
      // leaf ends up over the solid wall rather than across the other window.
      { from: 280, to: 435, sill: 0, kind: 'sliding', swing: -1 },
    ],
  },
  {
    name: 'Kitchen block — west exterior',
    type: 'exterior',
    a: [474, 992], b: [474, 1416],
    openings: [
      { from: 72, to: 184, sill: 1.1, kind: 'window' },  // 180/110
      // K1:90/230 service door into Y.MUTFAK KILER; its leaf is drawn open
      // eastward into the pantry, hinged at the south jamb.
      { from: 318, to: 373, sill: 0, kind: 'door', swing: -1, hinge: 'to' },
    ],
  },
  {
    name: 'Kitchen / corridor — east exterior',
    type: 'exterior',
    a: [938, 992], b: [938, 1416],
    openings: [
      { from: 66, to: 252, kind: 'window' }, // 300/230, onto İÇBAHÇE TERASI
    ],
  },

  // ────────────────────────────────── south block: north face
  {
    name: 'West wing — north exterior (W.C)',
    type: 'exterior',
    a: [412, 1416], b: [474, 1416],
    openings: [],
  },
  {
    name: 'Hall / living — north exterior',
    type: 'exterior',
    a: [938, 1416], b: [1422, 1416],
    openings: [
      { from: 33, to: 157, kind: 'window' },  // 200/230, over the stair
      { from: 244, to: 399, kind: 'window' }, // 250/230, OTURMA ODASI
    ],
  },

  // ────────────────────────────────── living block (OTURMA ODASI, south-east)
  {
    name: 'Living room — east exterior',
    type: 'exterior',
    a: [1422, 1416], b: [1422, 1809],
    openings: [],
  },
  {
    name: 'Living room — south exterior',
    type: 'exterior',
    a: [1422, 1809], b: [1116, 1809],
    openings: [
      { from: 85, to: 240, kind: 'window' }, // 250/230
    ],
  },
  {
    name: 'Living room — west wall',
    type: 'exterior',
    a: [1116, 1416], b: [1116, 1809],
    openings: [
      { from: 12, to: 68, sill: 0, kind: 'door', swing: -1 }, // K1:90/230 from the hall
    ],
  },

  // ────────────────────────────────── entrance front + west wing (south)
  {
    // The main entrance: a K1:180/230 double door from GIRIS TERASI into
    // GIRIS HOLU, both leaves drawn open inward (north). East of it the same
    // wall closes the stair and carries its 210/110 window.
    name: 'GIRIS HOLU / stair — south exterior',
    type: 'exterior',
    a: [800, 1747], b: [1116, 1747],
    openings: [
      { from: 18, to: 70, sill: 0, kind: 'door', swing: -1 },               // front door, west leaf
      { from: 70, to: 121, sill: 0, kind: 'door', swing: -1, hinge: 'to' }, // front door, east leaf
      { from: 166, to: 290, sill: 1.1, kind: 'window' },                    // 210/110
    ],
  },
  {
    // South-west pier of the entrance, down to the west wing's front.
    name: 'GIRIS HOLU — west pier',
    type: 'exterior',
    a: [800, 1724], b: [800, 1809],
    openings: [],
  },
  {
    name: 'West wing — south exterior',
    type: 'exterior',
    a: [412, 1809], b: [800, 1809],
    openings: [
      { from: 51, to: 163, kind: 'window' },  // 180/230, ÇALIŞMA ODASI
      { from: 200, to: 311, kind: 'window' }, // 180/230, OYUN ODASI
    ],
  },
  {
    name: 'West wing — west exterior',
    type: 'exterior',
    a: [412, 1416], b: [412, 1809],
    openings: [
      { from: 103, to: 153, sill: 1.1, kind: 'window' }, // 80/110, W.C
    ],
  },

  // ────────────────────────────────── interior partitions
  {
    // Thin (PDF faces y 1250/1256), with the pantry door at its east end.
    name: 'MUTFAK / Y.MUTFAK KILER partition',
    type: 'interior',
    thickness: 0.1,
    a: [474, 1253], b: [800, 1253],
    openings: [
      { from: 264, to: 314, sill: 0, kind: 'door', swing: 1, hinge: 'to' }, // K1:90/230 into the pantry
    ],
  },
  {
    name: 'Y.MUTFAK KILER / ANA KORIDOR partition',
    type: 'interior',
    thickness: 0.25,
    a: [800, 1253], b: [800, 1416],
    openings: [],
  },
  {
    // K1:180/230 double door between the dining end of MUTFAK and ANA
    // KORIDOR, both leaves drawn open north into the dining room.
    name: 'Dining / ANA KORIDOR partition',
    type: 'interior',
    thickness: 0.1,
    a: [800, 1303], b: [938, 1303],
    openings: [
      { from: 18, to: 70, sill: 0, kind: 'door', swing: -1 },
      { from: 70, to: 121, sill: 0, kind: 'door', swing: -1, hinge: 'to' },
    ],
  },
  {
    // The pantry's south wall is the west wing's hall wall (faces 1408/1423).
    name: 'Y.MUTFAK KILER — south wall',
    type: 'interior',
    thickness: 0.25,
    a: [474, 1416], b: [800, 1416],
    openings: [],
  },
  {
    name: 'W.C — east wall',
    type: 'interior',
    thickness: 0.1,
    a: [497, 1416], b: [497, 1578],
    openings: [
      { from: 17, to: 60, sill: 0, kind: 'door', swing: 1 }, // K1:80/230, opens into the W.C
    ],
  },
  {
    name: 'W.C — south wall',
    type: 'interior',
    thickness: 0.1,
    a: [412, 1578], b: [497, 1578],
    openings: [],
  },
  {
    // The hall's south side: ÇALIŞMA and OYUN ODASI doors, both K1:90/230
    // opening south into their rooms, hinged on the jambs either side of the
    // partition between them.
    name: 'ÇALIŞMA / OYUN — hall wall',
    type: 'interior',
    thickness: 0.1,
    a: [497, 1504], b: [800, 1504],
    openings: [
      { from: 31, to: 84, sill: 0, kind: 'door', swing: 1, hinge: 'to' }, // ÇALIŞMA ODASI
      { from: 109, to: 161, sill: 0, kind: 'door', swing: 1 },            // OYUN ODASI
    ],
  },
  {
    name: 'ÇALIŞMA / OYUN partition',
    type: 'interior',
    thickness: 0.1,
    a: [593, 1504], b: [593, 1809],
    openings: [],
  },
  {
    // OYUN ODASI's east wall. The GIRIS HOLU side of it carries a cupboard
    // (x 770..807); the play room side a wardrobe run and the DOLAP.
    name: 'OYUN / GIRIS HOLU partition',
    type: 'interior',
    thickness: 0.1,
    a: [767, 1504], b: [767, 1739],
    openings: [],
  },

  // ────────────────────────────────── stair + DEPO
  // The stair is open to GIRIS HOLU along its west side (the sheet draws a
  // single edge line at x 943, not a wall); it is modelled on BIRINCI KAT,
  // descending. DEPO is the store under the top of flight 2, entered from the
  // hall by a K1:80/230 opening south.
  {
    // The spine between the two flights (PDF faces x 1021..1033).
    name: 'Stair — central wall',
    type: 'interior',
    thickness: 0.2,
    a: [1027, 1513], b: [1027, 1672],
    openings: [],
  },
  {
    // Sits under the arrival of flight 2, so it stops short of the slab.
    name: 'DEPO — north wall',
    type: 'interior',
    thickness: 0.1,
    height: 3.2,
    a: [1027, 1519], b: [1116, 1519],
    openings: [
      { from: 28, to: 71, sill: 0, kind: 'door', swing: 1, hinge: 'to' }, // K1:80/230
    ],
  },
  {
    // Under flight 2, whose treads pass ~2.2 m above this line.
    name: 'DEPO — south wall',
    type: 'interior',
    thickness: 0.1,
    height: 2.1,
    a: [1027, 1629], b: [1116, 1629],
    openings: [],
  },

  // ────────────────────────────────── front yard
  // Low walls either side of the open parking bays (PDF faces x 404/420 and
  // 792/807), running from the front paving to the street.
  {
    name: 'Parking — west wall',
    type: 'exterior', height: 1.0,
    a: [412, 1910], b: [412, 2218],
    openings: [],
  },
  {
    name: 'Parking — east wall',
    type: 'exterior', height: 1.0,
    a: [800, 1910], b: [800, 2240],
    openings: [],
  },

  // ────────────────────────────────── plot boundary wall
  // 2 m garden wall on the plot line (the `land` polygon in GROUND_OBJECTS),
  // 0.2 m thick. The street is the south edge (D→C): P.14 opens it for the
  // parking bays (x 420..792, 6.2 m) and for the path to GIRIS (x 807..931,
  // 2.1 m). Openings are pixels along each wall.
  {
    name: 'Plot wall — south (street)',
    type: 'exterior', thickness: 0.2, height: 2.0,
    a: [224, 2209], b: [1590, 2294],
    openings: [
      { from: 196, to: 569, sill: 0, head: 2.0, kind: 'gate' },     // parking bays
      { from: 584, to: 708, sill: 0, head: 2.0, kind: 'gate' },     // path to GIRIS
    ],
  },
  { name: 'Plot wall — east',  type: 'exterior', thickness: 0.2, height: 2.0, a: [1590, 2294], b: [1643, 530], openings: [] },
  { name: 'Plot wall — north', type: 'exterior', thickness: 0.2, height: 2.0, a: [1643, 530],  b: [254, 161],   openings: [] },
  { name: 'Plot wall — west',  type: 'exterior', thickness: 0.2, height: 2.0, a: [254, 161],   b: [224, 2209],  openings: [] },
];

const FIRST_WALLS = [
  // ────────────────────────────────── north block (YATAK ODASI 1 & 2)
  {
    name: 'North block — north exterior',
    type: 'exterior',
    a: [2237, 1194], b: [2704, 1194],
    openings: [
      { from: 65, to: 173, kind: 'window' },  // 180/230
      { from: 292, to: 440, kind: 'window' }, // 250/230
    ],
  },
  {
    name: 'North block — west exterior',
    type: 'exterior',
    a: [2237, 1194], b: [2237, 1618],
    openings: [
      { from: 295, to: 373, sill: 1.1, kind: 'window' }, // 130/110, ORTAK W.C
    ],
  },
  {
    name: 'North block — east exterior',
    type: 'exterior',
    a: [2704, 1194], b: [2704, 1627],
    openings: [],
  },
  {
    name: 'Y.ODASI 2 D.ODASI — south wall',
    type: 'exterior',
    a: [2539, 1618], b: [2704, 1618],
    openings: [],
  },
  {
    // One wall, not twin partitions: the PDF faces sit at x=2461 and 2476
    // (15 px ≈ 0.25 m). The verticals at 2453/2456 and 2482/2485 are the two TVs.
    name: 'YATAK ODASI 1 / 2 partition',
    type: 'interior',
    thickness: 0.25,
    a: [2468, 1194], b: [2468, 1563],
    openings: [],
  },
  {
    name: 'YATAK ODASI 1 — door wall',
    type: 'interior',
    a: [2389, 1559], b: [2468, 1559],
    openings: [{ from: 12, to: 65, sill: 0, kind: 'door', swing: -1, hinge: 'to' }], // K1:90/230
  },
  {
    name: 'YATAK ODASI 2 — door wall',
    type: 'interior',
    a: [2468, 1559], b: [2543, 1559],
    openings: [{ from: 18, to: 68, sill: 0, kind: 'door', swing: -1 }], // K1:90/230
  },
  {
    name: 'Y.ODASI 2 D.ODASI — west wall',
    type: 'interior',
    a: [2543, 1559], b: [2543, 1618],
    openings: [],
  },
  {
    // D.ODASI = Dolap Odası (dressing room). Thin partition between YATAK
    // ODASI 2 and its dressing room: PDF faces at y=1445 and 1451 (~0.1 m).
    name: 'YATAK ODASI 2 / Y.ODASI 2 D.ODASI partition',
    type: 'interior',
    thickness: 0.1,
    a: [2548, 1448], b: [2704, 1448],
    openings: [],
  },
  {
    name: 'ORTAK W.C — north wall',
    type: 'interior',
    a: [2237, 1456], b: [2379, 1456],
    openings: [],
  },
  {
    // The W.C opens onto ANA KORIDOR, not into ÇAMSIR ODASI. PDF faces run
    // x=2371/2386 with a clear gap at y 1557..1612 — that gap is the door.
    name: 'ORTAK W.C — east wall',
    type: 'interior',
    a: [2379, 1448], b: [2379, 1616],
    openings: [
      { from: 118, to: 161, sill: 0, kind: 'door', swing: 1, hinge: 'to' }, // K1:80/230 to corridor
    ],
  },

  // ────────────────────────────────── laundry + KAPALI TERAS + balcony (west)
  {
    // Solid: the ORTAK W.C's south wall. There is no door between the W.C
    // and ÇAMSIR ODASI — the W.C is entered from ANA KORIDOR.
    name: 'ÇAMSIR ODASI — north wall',
    type: 'exterior',
    a: [2175, 1620], b: [2389, 1620],
    openings: [],
  },
  {
    name: 'ÇAMSIR ODASI — west exterior',
    type: 'exterior',
    a: [2175, 1620], b: [2175, 1744],
    openings: [],
  },
  {
    // ÇAMSIR ODASI and ANA KORIDOR against KAPALI TERAS. P.14 enclosed the
    // terrace, so the 251/230 in this wall is its way in: a black glazed
    // slider, parked west over the solid wall.
    name: 'ÇAMSIR / ANA KORIDOR — south wall',
    type: 'exterior',
    a: [2175, 1744], b: [2562, 1744],
    openings: [
      { from: 221, to: 370, sill: 0, kind: 'sliding', swing: -1 }, // 251/230
    ],
  },
  {
    name: 'ÇAMSIR ODASI — east wall',
    type: 'interior',
    a: [2382, 1625], b: [2382, 1744],
    openings: [{ from: 66, to: 110, sill: 0, kind: 'door', swing: 1, hinge: 'to' }], // K1:80/230
  },
  {
    // KAPALI TERAS (11 m²) is drawn in P.14 as an enclosed room: a solid
    // west wall with a 185/110 window and a 600/230 glazed front onto BALKON
    // TERASI. That is the owner's earlier glass room, now on the sheet.
    name: 'KAPALI TERAS — west exterior',
    type: 'exterior',
    a: [2175, 1744], b: [2175, 1870],
    openings: [
      { from: 14, to: 116, sill: 1.1, kind: 'window' }, // 185/110
    ],
  },
  {
    // The 600/230 glazed front, in black: fixed panes either side of a
    // sliding door out to the balcony. The fixed panes stand on a 5 cm sill
    // so they read as glazing rather than doorways.
    name: 'KAPALI TERAS — glazed front',
    type: 'exterior',
    thickness: 0.12,
    a: [2175, 1870], b: [2562, 1870],
    openings: [
      { from: 8, to: 132, sill: 0.05, kind: 'window' },
      { from: 132, to: 256, sill: 0, kind: 'sliding' },
      { from: 256, to: 380, sill: 0.05, kind: 'window' },
    ],
  },

  // ────────────────────────────────── GALERI BOSLUGU + stair hall
  // The gallery is now the whole bay x 2570..2706, open over the ground
  // floor's GIRIS HOLU; the stair beside it has no wall on that side.
  {
    name: 'GALERI BOSLUGU — west exterior',
    type: 'exterior',
    a: [2562, 1744], b: [2562, 1951],
    openings: [],
  },
  {
    name: 'GALERI / stair hall — south exterior',
    type: 'exterior',
    a: [2562, 1951], b: [2878, 1951],
    openings: [
      { from: 18, to: 124, kind: 'window' },             // 180/230, GALERI
      { from: 166, to: 290, sill: 1.1, kind: 'window' }, // 210/110, stair
    ],
  },

  // ────────────────────────────────── master suite (east)
  {
    name: 'Master suite — north exterior',
    type: 'exterior',
    a: [2701, 1620], b: [3185, 1620],
    openings: [
      { from: 33, to: 157, kind: 'window' },  // 200/230
      { from: 250, to: 408, kind: 'window' }, // 255/230
    ],
  },
  {
    name: 'Master suite — east exterior',
    type: 'exterior',
    a: [3185, 1620], b: [3185, 2013],
    openings: [],
  },
  {
    name: 'Master suite — south exterior',
    type: 'exterior',
    a: [2878, 2013], b: [3185, 2013],
    openings: [],
  },
  {
    // Also the stair hall's east wall.
    name: 'EBEVEYN Y.ODASI — west wall',
    type: 'interior',
    thickness: 0.25,
    a: [2878, 1620], b: [2878, 2013],
    openings: [{ from: 12, to: 68, sill: 0, kind: 'door', swing: -1 }], // K1:90/230
  },
  {
    name: 'EBEVEYN Y.ODASI — south wall',
    type: 'interior',
    thickness: 0.1,
    a: [2878, 1842], b: [3185, 1842],
    openings: [
      { from: 77, to: 122, sill: 0, kind: 'door', swing: 1, hinge: 'to' }, // K1:80/230 into DUS W.C
      // Bedroom ↔ EBEVEYN D.ODASI. P.14 draws this opening (x 3069..3118);
      // the owner's black glazed slider fills it. It parks westward, over
      // the wall between it and the DUS W.C door.
      { from: 191, to: 240, sill: 0, kind: 'sliding', swing: -1 },
    ],
  },
  {
    name: 'DUS W.C / EBEVEYN D.ODASI partition',
    type: 'interior',
    thickness: 0.1,
    a: [3007, 1842], b: [3007, 2013],
    openings: [],
  },
];

/**
 * Furniture and fixtures, traced off the same drawings as the walls, in the
 * same sheet-pixel space. See objects.js for what each `kind` builds.
 */
/** The plot's four corners in sheet px, clockwise on the page: NW, NE, SE, SW. */
const PLOT = [[254, 161], [1643, 530], [1590, 2294], [224, 2209]];

/**
 * A point `t` px along plot edge `edge` (edge i runs PLOT[i] to PLOT[i+1]) and
 * `inset` px in from the wall. Going clockwise, the plot's inside is on the
 * right of each edge, which is (-uy, ux) in y-down sheet coordinates.
 */
function plotPoint(edge, t, inset) {
  const [a, b] = [PLOT[edge], PLOT[(edge + 1) % 4]];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const [ux, uy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  return [Math.round(a[0] + ux * t - uy * inset), Math.round(a[1] + uy * t + ux * inset)];
}

/**
 * Exotic fruit planting just inside the wall: [edge, t, kind, options].
 * P.14 draws its trees in three lawns — the north strip (above y 358), the
 * east garden and the front garden east of the path — plus the lawn strip
 * west of the parking bays, so that is where they go. The paved patio round
 * the house and pool, the street openings (edge 2, t 660..1172) and the path
 * are kept clear.
 */
const PLANTING = [
  // north edge: the lawn strip west of x 1006, and the east garden past x 1210
  [0, 180, 'fruittree', { fruit: 'mango' }],   [0, 380, 'palm', { species: 'date' }],
  [0, 580, 'banana'],                          [0, 740, 'fruittree', { fruit: 'fig' }],
  [0, 1080, 'palm', { species: 'date' }],      [0, 1300, 'banana'],
  // east edge: lawn its whole length now the terrace no longer reaches it
  [1, 120, 'palm', { species: 'date' }],       [1, 340, 'banana'],
  [1, 560, 'palm', { species: 'papaya' }],     [1, 780, 'fruittree', { fruit: 'pomegranate' }],
  [1, 1000, 'fruittree', { fruit: 'avocado' }], [1, 1250, 'fruittree', { fruit: 'orange' }],
  [1, 1450, 'palm', { species: 'date' }],      [1, 1620, 'banana'],
  // south (street) edge: the front garden east of the path
  [2, 130, 'fruittree', { fruit: 'lemon' }],   [2, 300, 'palm', { species: 'papaya' }],
  [2, 450, 'banana'],                          [2, 600, 'palm', { species: 'date' }],
  // west edge: the lawn strip beside the parking, and the north lawn
  [3, 90, 'palm', { species: 'papaya' }],      [3, 230, 'fruittree', { fruit: 'mango' }],
  [3, 1930, 'palm', { species: 'date' }],
].map(([edge, t, kind, opts], i) => {
  const [x, y] = plotPoint(edge, t, 65);
  return { kind, name: `${kind} ${i + 1}`, rect: [x - 6, y - 6, x + 6, y + 6], seed: i + 1, ...opts };
});

/**
 * A gate leaf group for the street wall's opening running `from`..`to` px from
 * its west end (the wall's `a` point). Placed on the wall line and turned to
 * match its slight slope.
 */
function streetGate(from, to, extra) {
  const [a, b] = [[224, 2209], [1590, 2294]];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const [ux, uy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const mid = (from + to) / 2;
  const [cx, cy] = [a[0] + ux * mid, a[1] + uy * mid];
  const half = (to - from) / 2;
  return {
    kind: 'gate', rect: [cx - half, cy - 6, cx + half, cy + 6],
    rot: (Math.atan2(uy, ux) * 180) / Math.PI, ...extra,
  };
}

/** Outer faces of the ground-floor house, clockwise from the kitchen's NW corner. */
const GROUND_FOOTPRINT = [
  [466, 984], [946, 984], [946, 1408], [1430, 1408], [1430, 1817], [1108, 1817],
  [1108, 1755], [807, 1755], [807, 1817], [404, 1817], [404, 1408], [466, 1408],
];

/** HAVUZ outline. P.14 moved the pool (59, 221) px — 1 m west, 3.7 m north. */
const POOL_RECT = [454, 448, 1129, 882];

const GROUND_OBJECTS = [
  ...PLANTING,

  // ────────────────────────────────── front gates (street wall)
  // Both black bar gates. The wide one is a bi-parting sliding gate across
  // the parking bays, drawn closed; the gate onto the path to GIRIS is a
  // single leaf swung open 70 degrees inward so it reads from above.
  streetGate(196, 569, { name: 'Vehicle gate', style: 'sliding', open: 0 }),
  streetGate(584, 708, { name: 'Pedestrian gate', style: 'swing', openDeg: 70 }),
  // ────────────────────────────────── the plot
  // Inner boundary line on the sheet (the double line round the site). At the
  // model's scale it encloses ~744 m² against the stated 726 m² — within the
  // calibration tolerance. A slab item spans y..y+h, so this runs -0.02..-0.01:
  // above the ground apron (-0.02) and safely under the floor slabs at 0.
  {
    kind: 'land', name: 'Plot (726 m²)', mat: 'lawn', y: -0.02, h: 0.01,
    path: PLOT,
  },

  // ────────────────────────────────── paving (the hatched areas of P.14)
  // One patio wraps the house and the pool: the pool deck, İÇBAHÇE TERASI,
  // the west side and GIRIS TERASI down the path to the street. Lawn is
  // everything else. The house and the pool are cut out of it.
  {
    kind: 'paving', name: 'Patio',
    path: [
      [251, 358], [1006, 358], [1210, 412], [1210, 984], [1492, 984], [1492, 1941],
      [931, 1941], [931, 2242], [807, 2242], [807, 1910], [228, 1910],
    ],
    holes: [GROUND_FOOTPRINT, [[454, 448], [1129, 448], [1129, 882], [454, 882]]],
  },
  { kind: 'paving', name: 'Parking bays', mat: 'coping', path: [[420, 1910], [792, 1910], [792, 2232], [420, 2232]] },

  // ────────────────────────────────── the cars (open parking)
  // P.14 has no garage; the two bays in front of the west wing take the
  // family's cars, nose to the house, as drawn.
  { kind: 'sedan',  name: 'Mercedes-Benz C220 d', rect: [457, 1915, 577, 2201] },
  { kind: 'pickup', name: 'Mitsubishi L200 Pickup (2018)', rect: [621, 1912, 731, 2227] },

  // ────────────────────────────────── MUTFAK
  { kind: 'box', name: 'Kitchen counter (west)',  rect: [482, 999, 519, 1213], h: 0.9, mat: 'counter' },
  { kind: 'box', name: 'Kitchen counter (south)', rect: [586, 1213, 730, 1250], h: 0.9, mat: 'counter' },
  // Secret appliance wardrobe (owner's request) at the west end of the south
  // run, by the corner: coffee machine, kettle and toaster on a worktop behind
  // sliding pocket doors (drawn slid open), cabinets above it to the ceiling.
  {
    kind: 'appliancenook', name: 'Appliance wardrobe (coffee machine, kettle, toaster)',
    rect: [520, 1213, 586, 1250], back: 'S', h: 2.95, microwave: false,
  },
  { kind: 'box', name: 'Buzdolabı — MUTFAK',      rect: [658, 1209, 695, 1247], h: 2.1, mat: 'cabinet' },
  { kind: 'box', name: 'Kitchen island',          rect: [649, 999, 717, 1123], h: 0.92, mat: 'counter' },
  { kind: 'hob',       name: 'Ocak — MUTFAK',     rect: [652, 1046, 683, 1079], y: 0.92 },
  { kind: 'appliance', name: 'Bulaşık Mak.',      rect: [485, 1078, 516, 1131] },
  // Upper cabinets to the ceiling over both worktop runs (owner's request; the
  // sheet draws base units only). 0.35 m deep (21 px); the west run stops
  // either side of the 180/110 window, and the section over the fridge starts
  // above it rather than at 1.5 m.
  { kind: 'wallcabinet', name: 'Upper cabinets — MUTFAK west (north of window)', rect: [482, 999, 503, 1062], back: 'W' },
  { kind: 'wallcabinet', name: 'Upper cabinets — MUTFAK west (south of window)', rect: [482, 1178, 503, 1250], back: 'W' },
  { kind: 'wallcabinet', name: 'Upper cabinets — MUTFAK south',                  rect: [586, 1229, 658, 1250], back: 'S' },
  { kind: 'wallcabinet', name: 'Upper cabinet — over the MUTFAK fridge',         rect: [658, 1229, 695, 1250], back: 'S', y: 2.15 },
  { kind: 'wallcabinet', name: 'Upper cabinets — MUTFAK south (east end)',       rect: [695, 1229, 730, 1250], back: 'S' },
  { kind: 'stool', name: 'Bar stool', rect: [711, 1012, 737, 1038] },
  { kind: 'stool', name: 'Bar stool', rect: [711, 1052, 737, 1078] },
  { kind: 'stool', name: 'Bar stool', rect: [711, 1087, 737, 1113] },

  // ────────────────────────────────── dining
  { kind: 'box', name: 'Dining table', rect: [816, 1027, 878, 1176], h: 0.75, mat: 'wood' },
  // Eight chairs round it, each turned so its back is to the table's outside:
  // `rot` is degrees clockwise on the page and the maker backs a chair north
  // at 0, so the west run is 270, the east run 90, and the ends 0 and 180.
  // Without it every chair faced north and the two runs sat back to back.
  ...[1050, 1088, 1125].flatMap((y) => [
    { kind: 'chair', name: 'Dining chair', rect: [787, y, 814, y + 27], rot: 270 },
    { kind: 'chair', name: 'Dining chair', rect: [880, y, 907, y + 27], rot: 90 },
  ]),
  { kind: 'chair', name: 'Dining chair', rect: [834, 1000, 861, 1026], rot: 0 },
  { kind: 'chair', name: 'Dining chair', rect: [834, 1178, 861, 1205], rot: 180 },

  // ────────────────────────────────── Y.MUTFAK KILER
  { kind: 'box', name: 'Pantry counter (north)', rect: [482, 1256, 730, 1293], h: 0.9, mat: 'counter' },
  { kind: 'box', name: 'Pantry counter (south)', rect: [482, 1371, 792, 1408], h: 0.9, mat: 'counter' },
  { kind: 'box', name: 'Buzdolabı — Y.MUTFAK',   rect: [658, 1259, 695, 1297], h: 2.1, mat: 'cabinet' },
  { kind: 'hob',  name: 'Ocak — Y.MUTFAK',       rect: [573, 1259, 606, 1291], y: 0.9 },
  { kind: 'oven', name: 'Fırın — Y.MUTFAK',      rect: [573, 1259, 606, 1293], face: 'S' },
  // Upper cabinets to the ceiling on both long walls (owner's request). Over
  // the hob they start at 2.0 m to leave it clear, over the fridge above it.
  { kind: 'wallcabinet', name: 'Upper cabinets — KILER north',          rect: [482, 1256, 573, 1277], back: 'N' },
  { kind: 'wallcabinet', name: 'Upper cabinet — over the KILER hob',    rect: [573, 1256, 606, 1277], back: 'N', y: 2.0 },
  { kind: 'wallcabinet', name: 'Upper cabinets — KILER north (middle)', rect: [606, 1256, 658, 1277], back: 'N' },
  { kind: 'wallcabinet', name: 'Upper cabinet — over the KILER fridge', rect: [658, 1256, 695, 1277], back: 'N', y: 2.15 },
  { kind: 'wallcabinet', name: 'Upper cabinets — KILER north (east)',   rect: [695, 1256, 730, 1277], back: 'N' },
  { kind: 'wallcabinet', name: 'Upper cabinets — KILER south',          rect: [482, 1387, 792, 1408], back: 'S' },

  // ────────────────────────────────── W.C (west wing)
  // Both fixtures stand against the west wall, so they are turned 270°.
  { kind: 'basin',  name: 'Lavabo — W.C', rect: [414, 1463, 451, 1488], rot: 270 },
  { kind: 'toilet', name: 'Klozet — W.C', rect: [422, 1529, 458, 1565], rot: 270 },

  // ────────────────────────────────── ÇALIŞMA ODASI
  { kind: 'box', name: 'KÜTÜPHANE — bookshelves', rect: [420, 1581, 457, 1691], h: 2.1, mat: 'cabinet' },
  { kind: 'box', name: 'ÇALIŞMA MASASI — desk',   rect: [420, 1691, 457, 1801], h: 0.75, mat: 'wood' },
  { kind: 'chair', name: 'Desk chair', rect: [455, 1728, 481, 1755], rot: 90 },
  { kind: 'lounge', name: 'Armchair (north)', rect: [542, 1655, 585, 1695], back: 'N', seats: 1 },
  { kind: 'lounge', name: 'Armchair (south)', rect: [542, 1745, 585, 1785], back: 'S', seats: 1 },
  { kind: 'sidetable', name: 'Side table', rect: [548, 1706, 574, 1732] },

  // ────────────────────────────────── OYUN ODASI
  // A corner sofa as drawn: a long run on the west wall, a short one on the south.
  { kind: 'sofa', name: 'Corner sofa (west run)',  rect: [603, 1582, 643, 1795], back: 'W' },
  { kind: 'sofa', name: 'Corner sofa (south run)', rect: [643, 1752, 690, 1795], back: 'S' },
  { kind: 'wardrobe', name: 'Wardrobe — OYUN ODASI', rect: [739, 1507, 764, 1739], back: 'E' },
  { kind: 'box', name: 'DOLAP', rect: [739, 1739, 792, 1801], h: 2.2, mat: 'cabinet' },

  // ────────────────────────────────── GIRIS HOLU
  // The cupboard block on the hall's west side (x 770..807): no door drawn,
  // so a vestiyer/dolap facing the hall, not a room.
  { kind: 'box', name: 'VESTIYER / DOLAP', rect: [770, 1516, 807, 1724], h: 2.2, mat: 'cabinet' },

  // ────────────────────────────────── stair
  // The stair belongs to BIRINCI KAT — its plan draws the whole flight — and
  // is modelled there descending to this floor. DEPO sits under flight 2.

  // ────────────────────────────────── OTURMA ODASI
  // Restyled from the owner's reference: cream and gold, a media wall, and a
  // marble coffee table on a patterned rug. P.14 moved the room 207 px north
  // but not its drawn furniture relative to it, so everything below moved with it.
  // At the owner's request the three-seat sofa, both armchairs, the console
  // table and the ficus were removed (their printed symbols are painted out by
  // `erase` on the floor).
  // Relaxed seating around a ceiling-hung fireplace (after the owner's
  // reference). Four relaxed pieces (a 3-seat sofa, a 2-seat sofa and two
  // single armchairs), none joined at a corner (no L-shaped sofa), leave the
  // middle of the floor open. The fireplace hangs in the salon's north-east
  // corner, beside the window and the start of the media wall, its mouth turned
  // into the room. The 3-seater sits on the west wall facing the TV, the
  // 2-seater on the south side, the armchairs side by side at the window.
  { kind: 'lounge', name: '3-seat sofa',     rect: [1124, 1580, 1188, 1717], back: 'W', seats: 3 },
  { kind: 'lounge', name: '2-seat sofa',     rect: [1225, 1731, 1326, 1795], back: 'S', seats: 2 },
  { kind: 'lounge', name: 'Armchair (west)', rect: [1196, 1448, 1256, 1512], back: 'N', seats: 1 },
  { kind: 'lounge', name: 'Armchair (east)', rect: [1262, 1448, 1322, 1512], back: 'N', seats: 1 },
  { kind: 'hangingfire', name: 'Hanging fireplace', rect: [1355, 1481, 1367, 1493], faceDeg: 53 },
  { kind: 'rug',      name: 'Rug',          rect: [1196, 1528, 1384, 1728] },
  { kind: 'coffee',   name: 'Coffee table', rect: [1240, 1629, 1300, 1665] },
  // Media wall against the east wall's built-in (inner face x ~1414): TV,
  // floating unit, niches. The fireplace is not here; it hangs in the corner.
  { kind: 'tvwall',   name: 'Media wall (TV)', rect: [1390, 1538, 1414, 1758], back: 'E', fireplace: false },
  { kind: 'curtain',  name: 'Curtains', rect: [1176, 1424, 1343, 1433] },
  { kind: 'lamp',     name: 'Floor lamp', rect: [1140, 1541, 1156, 1557] },
  { kind: 'sidetable', name: 'Side table', rect: [1140, 1736, 1168, 1764] },
  { kind: 'sidetable', name: 'Side table', rect: [1336, 1753, 1364, 1781] },

  // ────────────────────────────────── İÇBAHÇE TERASI (east of the kitchen)
  // The 60 m² terrace between the kitchen's east wall and the living room's
  // north wall, x 946..1492, y 984..1416.
  { kind: 'table', name: 'Dining table', rect: [1230, 1170, 1350, 1224] },
  ...[1238, 1278, 1318].flatMap((x) => [
    { kind: 'chair', name: 'Dining chair', rect: [x, 1141, x + 27, 1168] },
    { kind: 'chair', name: 'Dining chair', rect: [x, 1226, x + 27, 1253], rot: 180 },
  ]),
  // Rubble-stone barbecue at the terrace's open north edge, beside the
  // kitchen (whose east wall is taken by the 300/230 window). Working face to
  // the south; its flue runs up through the roof (soffit 2.65 m, top 2.93 m).
  { kind: 'barbecue', name: 'Stone barbecue', rect: [1000, 988, 1101, 1030], back: 'N', flueTop: 3.3 },

  // Timber roof over the whole terrace: a flat oak slab with a thick fascia
  // and plank soffit, leaning on the kitchen wall to the west and the living
  // room to the south, cantilevering ~0.3 m past the free edges. Slim black
  // posts at the free corners and mid-span. Stacked model only, so the
  // side-by-side ground floor can be seen into.
  {
    kind: 'paving', name: 'Terrace — wooden roof', mat: 'oak', y: 2.65, h: 0.28, roof: true, only: 'stacked',
    path: [[946, 966], [1510, 966], [1510, 1416], [946, 1416]],
  },
  ...[[952, 972], [1228, 972], [1504, 972], [1504, 1195], [1504, 1410]].map(([x, y]) => (
    { kind: 'box', name: 'Roof post', rect: [x - 3, y - 3, x + 3, y + 3], h: 2.65, mat: 'frame', only: 'stacked' }
  )),

  // Greenery under the roof: a timber planter along the open east edge,
  // potted topiary round the table.
  { kind: 'planter', name: 'Planter', rect: [1466, 1040, 1490, 1360] },
  ...[[1195, 1150], [1195, 1250], [1385, 1150], [1385, 1250]].map(([x, y]) => (
    { kind: 'topiary', name: 'Potted topiary', rect: [x - 11, y - 11, x + 11, y + 11] }
  )),

  // ────────────────────────────────── POOL (HAVUZ, AL. 51.70 m²)
  // North of the house. P.14 no longer draws the ŞEZLONG loungers; the four
  // are kept, on the broad paved deck west of the pool, facing it, with a
  // parasol between each pair.
  { kind: 'pool', name: 'Havuz', rect: POOL_RECT },
  ...[560, 610, 740, 790].map((cy) => (
    { kind: 'lounger', name: 'Şezlong', rect: [280, cy - 21, 400, cy + 21] }
  )),
  ...[585, 765].map((cy) => (
    { kind: 'parasol', name: 'Parasol', rect: [334, cy - 6, 346, cy + 6], radius: 1.3 }
  )),

  // ────────────────────────────────── entrance sconces
  // Owner's instruction: wall lights either side of the front door. They hang
  // on the south face of the entrance wall (centreline y 1747, so the face is
  // at y 1754), 6 px clear of each leaf of the K1:180/230 — the west one just
  // clears the pier at x 800. Mounted at 2.0 m, below the 2.30 m head.
  ...[812, 927].map((cx) => (
    { kind: 'walllight', name: 'GIRIS — wall light', rect: [cx - 4, 1754, cx + 4, 1762], back: 'N', z: 2.0 }
  )),

  // ────────────────────────────────── ceilings and interior light
  // The owner's lighting scheme: every room carries a dropped perimeter band
  // 20 cm wide and 15 cm deep with a downlight in each corner (`coffer`), so
  // walking through the house after dark you are lit by the house rather than
  // by the sky. Rects are the room at its **wall centrelines** — the same
  // space the walls are written in — and `coffer` insets to the plaster.
  //
  // Stacked only, like the roofs: apart, these floors have no ceiling for a
  // dropped ceiling to hang from and the band would float over open walls.
  ...[
    ['MUTFAK',           [474, 992, 938, 1253]],
    ['Y.MUTFAK KILER',   [474, 1253, 800, 1416]],
    ['ANA KORIDOR',      [800, 1303, 938, 1416]],
    ['Hall',             [497, 1416, 1116, 1504]],
    ['ORTAK W.C',        [412, 1416, 497, 1578]],
    ['ÇALIŞMA ODASI',    [412, 1578, 593, 1809]],
    ['OYUN ODASI',       [593, 1504, 767, 1809]],
    ['OTURMA ODASI',     [1116, 1416, 1422, 1809]],
  ].map(([name, rect]) => (
    { kind: 'coffer', name: `${name} — ceiling`, rect, only: 'stacked' }
  )),
  {
    // GIRIS HOLU is open to GALERI BOSLUGU above it, so its ceiling is the
    // first floor's: 3.40 m of storey plus 3.0 m of wall.
    kind: 'coffer', name: 'GIRIS HOLU — ceiling (double height)',
    rect: [767, 1504, 943, 1747], h: PLAN.floorToFloor + PLAN.storeyHeight, only: 'stacked',
  },
  {
    // One big chandelier over the dining table, on the owner's instruction:
    // two tiers of candle lamps on gold arms, crystal drops, hung from the
    // MUTFAK ceiling on the table's centre (the table is x 816..878, y
    // 1027..1176, so its centre is 847, 1102).
    kind: 'chandelier', name: 'Dining chandelier',
    rect: [802, 1057, 892, 1147], only: 'stacked',
  },
];

const FIRST_OBJECTS = [
  // ────────────────────────────────── YATAK ODASI 1
  { kind: 'bed', name: 'Bed — YATAK ODASI 1', rect: [2255, 1265, 2368, 1349], head: 'W' },
  { kind: 'box', name: 'Nightstand', rect: [2246, 1243, 2270, 1266], h: 0.5, mat: 'wood' },
  { kind: 'box', name: 'Nightstand', rect: [2246, 1349, 2270, 1372], h: 0.5, mat: 'wood' },
  { kind: 'box', name: 'Wardrobe — YATAK ODASI 1', rect: [2243, 1411, 2389, 1450], h: 2.2, mat: 'cabinet' },
  { kind: 'box', name: 'Desk — YATAK ODASI 1', rect: [2407, 1222, 2457, 1252], h: 0.75, mat: 'wood' },
  { kind: 'chair', name: 'Desk chair', rect: [2412, 1258, 2438, 1284] },
  { kind: 'tv',  name: 'TV — YATAK ODASI 1', rect: [2453, 1288, 2459, 1352], h: 0.55, y: 1.1 },

  // ────────────────────────────────── ORTAK W.C
  { kind: 'toilet', rect: [2259, 1466, 2286, 1499] },
  { kind: 'basin',  rect: [2250, 1570, 2275, 1599] },

  // ────────────────────────────────── YATAK ODASI 2 + dressing
  { kind: 'bed', name: 'Bed — YATAK ODASI 2', rect: [2568, 1249, 2693, 1341], head: 'E' },
  { kind: 'box', name: 'Nightstand', rect: [2668, 1225, 2693, 1249], h: 0.5, mat: 'wood' },
  { kind: 'box', name: 'Nightstand', rect: [2668, 1341, 2693, 1365], h: 0.5, mat: 'wood' },
  // The long block across the south of the room (PDF y 1408..1445) is a desk,
  // not a wardrobe; the chair symbol sits on its north side.
  { kind: 'box', name: 'Desk — YATAK ODASI 2', rect: [2550, 1408, 2694, 1445], h: 0.75, mat: 'wood' },
  { kind: 'chair', name: 'Desk chair', rect: [2642, 1384, 2669, 1408] },
  { kind: 'tv',  name: 'TV — YATAK ODASI 2', rect: [2478, 1265, 2484, 1329], h: 0.55, y: 1.1 },
  // Y.ODASI 2 D.ODASI (Dolap Odası): wardrobes only round the walls, open
  // floor in the middle, no island. The U opens west onto the vestibule.
  { kind: 'wardrobe', name: 'Wardrobe — Y.ODASI 2 D.ODASI (north)', rect: [2548, 1451, 2694, 1481], back: 'N', lit: true },
  { kind: 'wardrobe', name: 'Wardrobe — Y.ODASI 2 D.ODASI (east)',  rect: [2664, 1481, 2694, 1582], back: 'E', lit: true },
  { kind: 'wardrobe', name: 'Wardrobe — Y.ODASI 2 D.ODASI (south)', rect: [2548, 1582, 2694, 1612], back: 'S', lit: true },

  // ────────────────────────────────── ÇAMSIR ODASI
  { kind: 'box',       name: 'Laundry counter', rect: [2187, 1627, 2385, 1670], h: 0.9, mat: 'counter' },
  { kind: 'appliance', name: 'KM — dryer',      rect: [2189, 1633, 2223, 1666] },
  { kind: 'appliance', name: 'ÇM — washer',     rect: [2231, 1633, 2265, 1666] },
  { kind: 'box',       name: 'Bench',           rect: [2187, 1718, 2262, 1733], h: 0.5, mat: 'wood' },

  // ────────────────────────────────── EBEVEYN suite
  { kind: 'bed', name: 'Bed — EBEVEYN Y. ODASI', rect: [3049, 1676, 3169, 1783], head: 'E' },
  { kind: 'box', name: 'Wardrobe — master',      rect: [2886, 1690, 2923, 1767], h: 2.2, mat: 'cabinet' },
  { kind: 'box', name: 'Desk — EBEVEYN Y. ODASI', rect: [2923, 1789, 2949, 1818], h: 0.75, mat: 'wood' },
  { kind: 'tv',  name: 'TV — EBEVEYN Y. ODASI',  rect: [2927, 1700, 2933, 1770], h: 0.62, y: 1.1 },
  // EBEVEYN D.ODASI: P.14 now draws the U of wardrobes round three walls; the
  // glass-top island in the middle is the owner's. It opens north onto the
  // slider; the west run starts south of y 1868 so the slider's parked leaf
  // clears it.
  { kind: 'wardrobe', name: 'Wardrobe — EBEVEYN D.ODASI (west)',  rect: [3012, 1868, 3048, 1969], back: 'W', lit: true },
  { kind: 'wardrobe', name: 'Wardrobe — EBEVEYN D.ODASI (east)',  rect: [3140, 1847, 3177, 1969], back: 'E', lit: true },
  { kind: 'wardrobe', name: 'Wardrobe — EBEVEYN D.ODASI (south)', rect: [3012, 1969, 3177, 2006], back: 'S', lit: true },
  { kind: 'island',   name: 'Dressing island',                    rect: [3073, 1896, 3115, 1946] },
  { kind: 'basin',  rect: [2886, 1863, 2911, 1900] },
  { kind: 'toilet', rect: [2964, 1963, 2988, 2000] },
  { kind: 'shower', name: 'DUS', rect: [2886, 1919, 2948, 2006] },

  // ────────────────────────────────── stair, descending to ZEMIN
  // MÜ: 20 (17x30) switchback. Levels are relative to this floor's slab, so
  // the flights run from -3.40 m up to the final riser at 0. P.14 swapped the
  // columns: flight 1 now climbs south in the WEST column (beside the
  // gallery), and flight 2 comes back north in the east one.
  { kind: 'stairs', name: 'Stair flight 1 (treads 1–9)',   rect: [2709, 1721, 2784, 1876], dir: 'S', steps: 9, riser: 0.17, from: -3.40 },
  { kind: 'box',    name: 'Stair half-landing',            rect: [2709, 1876, 2870, 1944], h: 1.70, y: -3.40, mat: 'counter' },
  // Open soffit: DEPO is under this flight on the ground floor.
  { kind: 'stairs', name: 'Stair flight 2 (treads 10–18)', rect: [2796, 1721, 2870, 1876], dir: 'N', steps: 9, riser: 0.17, from: -1.70, solid: false },
  // Korkuluk — the iron stair balustrade, on the owner's instruction. Path
  // points carry their own height here, so the rail rakes with the flight
  // while the balusters stay plumb (see `buildRailing`).
  //
  // Flight 1's **west** edge is the open one: the stair has no wall along
  // x 2706 (ground px 943), it is open to GIRIS HOLU and the gallery above.
  // So the balustrade climbs that edge from the foot at -3.40 to the top of
  // flight 9 at -1.87, then runs on round the half-landing's west edge at
  // -1.70. Flight 2 has the central wall on one side and the living room's
  // west wall on the other, so it takes a wall-mounted handrail instead of a
  // balustrade that would stand inside the plaster.
  {
    kind: 'railing', name: 'Stair korkuluk (flight 1 + landing)', h: 1.0,
    path: [[2706, 1721, -3.40], [2706, 1876, -1.87], [2706, 1944, -1.70]],
  },
  {
    kind: 'railing', name: 'Stair handrail (flight 2)', h: 1.0, wall: true,
    path: [[2793, 1944, -1.70], [2793, 1876, -1.53], [2793, 1721, -0.17]],
  },

  // ────────────────────────────────── roofs
  // The sheet draws no roof, so these are modelled from the owner's photo: a
  // black stone-coated S-tile hip roof, one per block, eaves at wall height.
  // Stacked only (`only: 'stacked'`): the side-by-side first floor stays open
  // so it can be seen into from above. Stacked, they cover the ground floor too.
  { kind: 'hiproof', name: 'Roof — YATAK ODASI block',       rect: [2237, 1194, 2704, 1627], y: 3.0, roof: true, only: 'stacked' },
  { kind: 'hiproof', name: 'Roof — ÇAMSIR / KAPALI TERAS',   rect: [2175, 1620, 2562, 1870], y: 3.0, roof: true, only: 'stacked' },
  { kind: 'hiproof', name: 'Roof — gallery and stair hall',  rect: [2562, 1620, 2878, 1951], y: 3.0, roof: true, only: 'stacked' },
  { kind: 'hiproof', name: 'Roof — EBEVEYN suite',           rect: [2878, 1620, 3185, 2013], y: 3.0, roof: true, only: 'stacked' },

  // ────────────────────────────────── open edges
  // BALKON TERASI (14 m²) runs the width of KAPALI TERAS in front of its
  // glazed wall, out to y 2020. It stays open, with its balustrade, for laundry.
  {
    kind: 'railing',
    name: 'BALKON TERASI balustrade',
    path: [[2170, 1873], [2170, 2020], [2566, 2020], [2566, 1959]],
    h: 1.1,
  },
  {
    // Round the head of the void over GIRIS HOLU and the stair's west flight.
    kind: 'railing',
    name: 'GALERI BOSLUGU balustrade',
    path: [[2570, 1738], [2706, 1738], [2706, 1717], [2790, 1717]],
    h: 1.1,
  },

  // ────────────────────────────────── balcony sconces
  // Owner's instruction: real light on BALKON TERASI. The only solid wall the
  // balcony has is the gallery's west exterior (centreline x 2562, face at
  // x 2555) where it passes the terrace, y 1873..1951 — the rest of the
  // balcony is the glazed front and its balustrade. Two washers on that face.
  ...[1895, 1930].map((cy) => (
    { kind: 'walllight', name: 'BALKON TERASI — wall light', rect: [2547, cy - 4, 2555, cy + 4], back: 'E', z: 2.0 }
  )),

  // ────────────────────────────────── ceilings and interior light
  // As the ground floor: a dropped perimeter band with a downlight in each
  // corner, per room, stacked model only. The two D.ODASI are the exception —
  // see below.
  ...[
    ['YATAK ODASI 1',      [2237, 1194, 2468, 1456]],
    ['YATAK ODASI 2',      [2468, 1194, 2704, 1448]],
    ['ORTAK W.C',          [2237, 1456, 2379, 1616]],
    ['ÇAMSIR ODASI',       [2175, 1620, 2382, 1744]],
    ['ANA KORIDOR',        [2382, 1627, 2870, 1737]],
    ['KAPALI TERAS',       [2175, 1744, 2562, 1870]],
    ['EBEVEYN Y.ODASI',    [2878, 1620, 3185, 1842]],
    ['DUS W.C',            [2878, 1842, 3007, 2013]],
  ].map(([name, rect]) => (
    { kind: 'coffer', name: `${name} — ceiling`, rect, only: 'stacked' }
  )),

  // The dressing rooms get one light in the middle of the ceiling instead of
  // a coffer, on the owner's instruction — they are small and walled with
  // wardrobe on three sides, and their runs are lit inside (`lit: true`).
  { kind: 'ceilinglight', name: 'Y.ODASI 2 D.ODASI — ceiling light', rect: [2610, 1515, 2640, 1545], only: 'stacked' },
  { kind: 'ceilinglight', name: 'EBEVEYN D.ODASI — ceiling light',   rect: [3080, 1912, 3110, 1942], only: 'stacked' },
];

export const FLOORS = [
  {
    id: 'ground',
    name: 'ZEMIN',
    label: 'Ground floor',
    crop: { ...ORIGIN },
    // The slab is the house only; outside it the patio and lawn take over.
    outline: GROUND_FOOTPRINT,
    // The first floor sits on this one, so these walls run the full 3.40 m to
    // the underside of its slab rather than stopping at the 3.0 m clear
    // height. Walls with their own `height` (DEPO, the front yard) are
    // unaffected.
    wallTop: PLAN.floorToFloor,
    // Laminate parquet throughout, kitchens included. Only the W.C, DEPO and
    // the stair keep the plain finish. Rects are approximate room interiors;
    // the walls hide the edges.
    // Plan symbols painted over with plain parquet: the removed armchairs and
    // console table, the removed three-seat sofa and the replaced sectional.
    erase: [
      [1196, 1439, 1378, 1490],
      [1186, 1531, 1354, 1599],
      [1126, 1605, 1272, 1791], // the sectional
    ],
    parquet: [
      [1123, 1423, 1414, 1801], // OTURMA ODASI
      [482, 999, 931, 1250],    // MUTFAK + dining
      [807, 1250, 931, 1300],   // dining alcove by the double door
      [482, 1256, 792, 1408],   // Y.MUTFAK KILER
      [807, 1306, 931, 1423],   // ANA KORIDOR
      [497, 1423, 1108, 1501],  // hall
      [807, 1501, 943, 1740],   // GIRIS HOLU
      [420, 1581, 590, 1801],   // ÇALIŞMA ODASI
      [500, 1507, 590, 1581],   // ÇALIŞMA ODASI (beside the W.C)
      [596, 1507, 764, 1801],   // OYUN ODASI
    ],
    alignPx: [0, 0],
    storey: 0,
    walls: GROUND_WALLS,
    objects: GROUND_OBJECTS,
  },
  {
    id: 'first',
    name: 'BIRINCI KAT',
    label: 'First floor',
    crop: { x: 2147, y: 1179, w: 1060, h: 855 },
    parquet: [
      [2244, 1201, 2461, 1452], // YATAK ODASI 1 (north of the ORTAK W.C)
      [2387, 1452, 2461, 1552], // YATAK ODASI 1 (strip east of the W.C, to its door)
      [2476, 1201, 2697, 1559], // YATAK ODASI 2 + vestibule
      [2548, 1559, 2697, 1612], // Y.ODASI 2 D.ODASI (south part)
      [2389, 1562, 2540, 1627], // ANA KORIDOR (north strip, below the bedroom doors)
      [2389, 1627, 2870, 1737], // ANA KORIDOR, out to the head of the stair
      [2890, 1638, 3177, 1834], // EBEVEYN Y. ODASI
      [3012, 1847, 3177, 2006], // EBEVEYN D.ODASI
    ],
    // alignPx + crop.xy must equal ORIGIN.xy: main.js centres each floor's
    // slab on its container.
    alignPx: [-1763, -204],
    storey: 1,
    walls: FIRST_WALLS,
    objects: FIRST_OBJECTS,
    // The slab is clipped to the building's footprint (wall centrelines, the
    // balcony to its edge). Without it the whole crop (mostly empty paper)
    // hangs 3.4 m up in the stacked model and hides the ground-floor terrace.
    outline: [
      [2237, 1194], [2704, 1194], [2704, 1620], [3185, 1620], [3185, 2013],
      [2878, 2013], [2878, 1951], [2566, 1951], [2566, 2020], [2170, 2020],
      [2170, 1620], [2237, 1620],
    ],
    // Openings cut clean through the slab: GALERI BOSLUGU and the stairwell
    // are one void. The stair comes up through it, arriving at the north edge,
    // and it has to clear the HALF-LANDING as well as the two flights (the
    // landing runs to y 1944): stopping at the flights left this slab as a
    // ceiling 1.30 m above the landing. It stops at 1942, just inside the south
    // wall's inner face, NOT on its centreline: walls are 3.0 m on a 3.40 m
    // floor-to-floor, so the 0.4 m band between them is filled by the slab
    // body alone. Run the void out to the wall and that band becomes an open
    // slot to the sky.
    voids: [
      {
        name: 'GALERI BOSLUGU + stair well',
        path: [[2570, 1738], [2706, 1738], [2706, 1715], [2870, 1715], [2870, 1942], [2570, 1942]],
      },
    ],
  },
];

/** Gap between models in 'apart' mode, in sheet pixels (~2.5 m). */
const GAP_PX = 149;

/**
 * Where a floor actually gets placed.
 *
 *   'apart'   – each storey as its own model on the ground, laid out in a row
 *   'stacked' – storeys in their real positions, one on top of the other
 */
export function placement(floor, mode = 'apart') {
  const [ax, ay] = floor.alignPx;
  // Both modes keep each storey at its true level; only 'apart' also slides
  // them along +X. The first floor's stair descends from its slab, so it has
  // to stay 3.40 m up or the flight would run below ground.
  const elevation = floor.storey * PLAN.floorToFloor;
  if (mode === 'stacked') return { offsetPx: [ax, ay], elevation };
  return {
    offsetPx: [ax + floor.storey * (ORIGIN.w + GAP_PX), ay],
    elevation,
  };
}

/** Convert a point in a floor's sheet pixels to world metres (X, Z). */
export function toWorld([px, py], offsetPx = [0, 0]) {
  const [dx, dy] = offsetPx;
  const m = PLAN.metersPerPixel;
  return [
    (px + dx - (ORIGIN.x + ORIGIN.w / 2)) * m,
    (py + dy - (ORIGIN.y + ORIGIN.h / 2)) * m,
  ];
}
