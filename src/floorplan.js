/**
 * Villa Khan — plan data, traced off the architectural sheet in assets/.
 *
 * Coordinates are PIXELS OF THE ORIGINAL SHEET IMAGE (3509 x 2482), not
 * metres. The sheet carries both floors side by side, so each floor also
 * records `offsetPx`, which shifts its own drawing into the shared world
 * frame anchored on the ground floor.
 *
 *   sharedPx = floorPx + floor.offsetPx
 *   world X  = (sharedPx.x - (origin.x + origin.w / 2)) * metersPerPixel
 *   world Z  = (sharedPx.y - (origin.y + origin.h / 2)) * metersPerPixel
 *
 * The first floor's offset (-1762, +1) was derived by matching structural
 * walls the two plans share — the north block's west wall, its east wall,
 * and the living/master block's north wall all land within ~5 px (<0.1 m).
 *
 * metersPerPixel was calibrated against the K1:100/230 doors (1.00 m clear
 * opening) and cross-checked against GARAJ 42.00 m².
 */

export const PLAN = {
  image: 'assets/VILLA KHAN 20092026_page-0001.jpg',
  metersPerPixel: 0.0168,
  storeyHeight: 3.0,
  // The stair is annotated MÜ: 20 (17x30) — 20 risers at 17 cm — so the real
  // floor-to-floor is 3.40 m. That drives the stacked layout; storeyHeight is
  // the clear wall height below the slab.
  floorToFloor: 3.4,
  thickness: { exterior: 0.25, interior: 0.15 },
  head: 2.3,
  sill: 0.9,
};

/** World origin: the ground-floor crop defines the shared frame. */
export const ORIGIN = { x: 385, y: 1180, w: 1060, h: 855 };

/**
 * Wall entries:
 *   a, b       – centreline endpoints, in that floor's sheet pixels
 *   type       – 'exterior' | 'interior' (thickness + material)
 *   thickness  – optional metre override
 *   openings   – from / to are distances along the wall from `a`, IN PIXELS;
 *                sill / head are metres above that floor's finished floor.
 *                Omit them for window defaults (0.9 / 2.3); doors pass sill: 0.
 */
const GROUND_WALLS = [
  // ────────────────────────────────── kitchen / dining block (north)
  {
    name: 'Kitchen block — west exterior',
    type: 'exterior',
    a: [474, 1195], b: [474, 1620],
    openings: [
      { from: 87, to: 195, sill: 1.1, kind: 'window' }, // 180/110
      { from: 297, to: 375, sill: 1.1, kind: 'window' }, // 130/110
    ],
  },
  {
    name: 'Kitchen block — north exterior',
    type: 'exterior',
    a: [474, 1195], b: [937, 1195],
    openings: [
      { from: 54, to: 166, kind: 'window' },  // 180/230
      { from: 280, to: 435, kind: 'window' }, // 250/230
    ],
  },
  {
    name: 'Kitchen / corridor — east exterior',
    type: 'exterior',
    a: [937, 1195], b: [937, 1624],
    openings: [
      { from: 76, to: 219, kind: 'window' },  // 250/230
      { from: 269, to: 380, kind: 'window' }, // 200/230
    ],
  },
  {
    name: 'Y.MUTFAK / garage party wall',
    type: 'exterior',
    // Straight and solid, as drawn (PDF faces at y=1578 and y=1594). This wall
    // carries the EV charger and one continuous tezgah for unloading shopping.
    a: [474, 1586], b: [709, 1586],
    openings: [],
  },
  {
    // The garage's north edge steps ~0.6 m south here. The K1:100/230 in this
    // wall is the garage → ANA KORIDOR door: up the right-hand side of the
    // car, directly opposite. Its leaf is drawn OPEN (running north); the
    // closed position is along this wall, x 727..783.
    name: 'Garage — north-east wall',
    type: 'exterior',
    a: [709, 1624], b: [799, 1624],
    openings: [
      { from: 18, to: 74, sill: 0, kind: 'door', swing: -1 }, // K1:100/230 to ANA KORIDOR
    ],
  },

  // ────────────────────────────────── garage (GARAJ, 42 m²)
  {
    // The garage footprint steps ~0.7 m south of the kitchen block here.
    name: 'Garage — north-west return',
    type: 'exterior',
    a: [412, 1620], b: [478, 1620],
    openings: [],
  },
  {
    name: 'Garage — west exterior',
    type: 'exterior',
    a: [412, 1620], b: [412, 1999],
    openings: [
      { from: 58, to: 130, kind: 'window' },  // 120/230
      { from: 281, to: 353, kind: 'window' }, // 120/230
    ],
  },
  {
    name: 'Garage — south exterior (GARAJ GIRISI)',
    type: 'exterior',
    a: [412, 1999], b: [798, 1999],
    openings: [
      { from: 18, to: 368, sill: 0, head: 2.4, kind: 'garage' }, // white roller shutter (raise: 0..1 rolls it up)
    ],
  },
  {
    name: 'Garage — east wall',
    type: 'exterior',
    a: [799, 1624], b: [799, 1999],
    openings: [],
  },

  // ────────────────────────────────── living block (south-east)
  {
    name: 'Living / terrace — north exterior',
    type: 'exterior',
    a: [937, 1624], b: [1430, 1624],
    openings: [
      { from: 46, to: 165, kind: 'window' },  // 200/230
      { from: 257, to: 405, kind: 'window' }, // 250/230
    ],
  },
  {
    name: 'Living room — east exterior',
    type: 'exterior',
    a: [1430, 1624], b: [1430, 2012],
    openings: [],
  },
  {
    name: 'Living room — south exterior',
    type: 'exterior',
    a: [1430, 2012], b: [1115, 2012],
    openings: [
      { from: 76, to: 148, kind: 'window' }, // 120/230
    ],
  },
  {
    name: 'Living room — west wall',
    type: 'exterior',
    a: [1115, 1624], b: [1115, 2012],
    openings: [
      { from: 16, to: 66, sill: 0, kind: 'door', swing: -1 }, // K1:90/230 from GIRIS HOLU
    ],
  },

  // ────────────────────────────────── entrance hall + W.C
  {
    // The main entrance. It opens into GIRIS HOLU off the GIRIS TERASI —
    // not through the W.C block, whose south wall carries a window instead.
    name: 'GIRIS HOLU — entrance wall',
    type: 'exterior',
    a: [807, 1878], b: [931, 1878],
    openings: [
      { from: 10, to: 65, sill: 0, kind: 'door', swing: -1 }, // K1:100/230 front door
    ],
  },
  {
    name: 'GIRIS HOLU — east return',
    type: 'exterior',
    a: [931, 1878], b: [931, 1962],
    openings: [],
  },
  {
    name: 'W.C block — south exterior',
    type: 'exterior',
    a: [931, 1954], b: [1123, 1954],
    openings: [
      { from: 43, to: 168, sill: 1.1, kind: 'window' }, // 210/110
    ],
  },

  // ────────────────────────────────── plot boundary wall
  // 2 m garden wall on the plot line (the `land` polygon in GROUND_OBJECTS),
  // 0.2 m thick. The street is the south edge (D→C): one 9 m vehicle opening
  // serves both the garage door (x 412..798) and the side parking strip west
  // of it (x 246..404), and a 1.2 m pedestrian opening lines up with the GIRIS
  // entrance (x ≈ 1024). Openings are pixels along each wall.
  {
    name: 'Plot wall — south (street)',
    type: 'exterior', thickness: 0.2, height: 2.0,
    a: [224, 2209], b: [1590, 2294],
    openings: [
      { from: 21, to: 560, sill: 0, head: 2.0, kind: 'opening' },   // parking strip + garage
      { from: 767, to: 838, sill: 0, head: 2.0, kind: 'opening' },  // GIRIS
    ],
  },
  { name: 'Plot wall — east',  type: 'exterior', thickness: 0.2, height: 2.0, a: [1590, 2294], b: [1643, 530], openings: [] },
  { name: 'Plot wall — north', type: 'exterior', thickness: 0.2, height: 2.0, a: [1643, 530],  b: [254, 161],   openings: [] },
  { name: 'Plot wall — west',  type: 'exterior', thickness: 0.2, height: 2.0, a: [254, 161],   b: [224, 2209],  openings: [] },

  // ────────────────────────────────── interior partitions
  {
    name: 'MUTFAK / Y.MUTFAK partition',
    type: 'interior',
    a: [482, 1434], b: [709, 1434],
    openings: [],
  },
  {
    // PDF faces at x=702 and x=717, running y 1389..1624 with one gap.
    name: 'Kitchen / ANA KORIDOR partition',
    type: 'interior',
    a: [709, 1389], b: [709, 1624],
    openings: [
      { from: 136, to: 180, sill: 0, kind: 'door', swing: 1, hinge: 'to' }, // K1:80/230 to Y.MUTFAK
    ],
  },
  {
    // Runs the full width at y=1434: the MUTFAK doorway at its west end, then
    // the 225/230 glazed panel onto ANA KORIDOR.
    name: 'Dining / ANA KORIDOR partition',
    type: 'interior',
    a: [709, 1434], b: [937, 1434],
    openings: [
      { from: 18, to: 74, sill: 0, kind: 'door', swing: -1 },                 // K1:100/230
      { from: 83, to: 210, sill: 0, head: 2.3, kind: 'opening' },  // 225/230
    ],
  },
  {
    // The W.C is tucked beneath the upper flight, so its ceiling is low.
    name: 'W.C. — west wall',
    type: 'interior',
    height: 2.3,
    a: [946, 1725], b: [946, 1947],
    openings: [],
  },
  {
    name: 'W.C. — north wall',
    type: 'interior',
    height: 2.3,
    a: [946, 1725], b: [1031, 1725],
    openings: [
      { from: 10, to: 53, sill: 0, kind: 'door', swing: 1 }, // K1:80/230
    ],
  },
  {
    name: 'Stair / W.C. wall',
    type: 'interior',
    a: [1031, 1718], b: [1031, 1879],
    openings: [],
  },
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

  // ────────────────────────────────── laundry + balcony (west)
  {
    // Solid: the ORTAK W.C's south wall. There is no door between the W.C
    // and ÇAMSIR ODASI — the W.C is entered from ANA KORIDOR.
    name: 'ÇAMSIR ODASI — north wall',
    type: 'exterior',
    a: [2174, 1620], b: [2389, 1620],
    openings: [],
  },
  {
    name: 'ÇAMSIR ODASI — west exterior',
    type: 'exterior',
    a: [2174, 1620], b: [2174, 1744],
    openings: [],
  },
  {
    name: 'Laundry / balcony — south exterior',
    type: 'exterior',
    a: [2174, 1744], b: [2560, 1744],
    openings: [
      { from: 230, to: 380, kind: 'window' }, // 251/230
    ],
  },
  {
    name: 'ÇAMSIR ODASI — east wall',
    type: 'interior',
    a: [2382, 1625], b: [2382, 1744],
    openings: [{ from: 66, to: 110, sill: 0, kind: 'door', swing: 1, hinge: 'to' }], // K1:80/230
  },

  // ────────────────────────────────── gallery void + stair hall
  {
    name: 'GALERI BOSLUGU — west exterior',
    type: 'exterior',
    a: [2560, 1744], b: [2560, 1872],
    openings: [],
  },
  {
    name: 'GALERI BOSLUGU — south exterior',
    type: 'exterior',
    a: [2560, 1872], b: [2698, 1872],
    openings: [
      { from: 26, to: 86, sill: 1.1, kind: 'window' }, // 100/110
    ],
  },
  {
    name: 'Stair hall — west wall',
    type: 'interior',
    a: [2698, 1720], b: [2698, 1950],
    openings: [],
  },
  {
    name: 'Stair hall — south exterior',
    type: 'exterior',
    a: [2698, 1950], b: [2870, 1950],
    openings: [
      { from: 38, to: 163, sill: 1.1, kind: 'window' }, // 210/110
    ],
  },

  // ────────────────────────────────── master suite (east)
  {
    name: 'Master suite — north exterior',
    type: 'exterior',
    a: [2692, 1621], b: [3187, 1621],
    openings: [
      { from: 53, to: 173, kind: 'window' },  // 200/230
      { from: 271, to: 423, kind: 'window' }, // 255/230
    ],
  },
  {
    name: 'Master suite — east exterior',
    type: 'exterior',
    a: [3187, 1621], b: [3187, 2019],
    openings: [],
  },
  {
    name: 'Master suite — south exterior',
    type: 'exterior',
    a: [2870, 2019], b: [3187, 2019],
    openings: [],
  },
  {
    name: 'EBEVEYN Y.ODASI — west wall',
    type: 'interior',
    a: [2875, 1631], b: [2875, 1840],
    openings: [{ from: 6, to: 56, sill: 0, kind: 'door', swing: -1 }], // K1:90/230
  },
  {
    name: 'DUS W.C — west wall',
    type: 'interior',
    a: [2882, 1840], b: [2882, 2019],
    openings: [],
  },
  {
    name: 'EBEVEYN Y.ODASI — south wall',
    type: 'interior',
    a: [2886, 1840], b: [3187, 1840],
    openings: [
      { from: 69, to: 124, sill: 0, kind: 'door', swing: 1, hinge: 'to' }, // K1:80/230 into DUS W.C
      // Bedroom ↔ EBEVEYN D.ODASI: glazed slider in black joinery. Not on
      // this sheet revision; added per the owner. It parks westward so the
      // leaf clears both the DUS W.C door and the wardrobe run.
      { from: 200, to: 260, sill: 0, kind: 'sliding', swing: -1 },
    ],
  },
  {
    name: 'DUS W.C / EBEVEYN D.ODASI partition',
    type: 'interior',
    a: [3005, 1840], b: [3005, 2019],
    openings: [],
  },
];

/**
 * Furniture and fixtures, traced off the same drawings as the walls, in the
 * same sheet-pixel space. See objects.js for what each `kind` builds.
 */
const GROUND_OBJECTS = [
  // ────────────────────────────────── the plot
  // Inner boundary line on the sheet (the double line round the site). At the
  // model's scale it encloses ~744 m² against the stated 726 m² — within the
  // calibration tolerance. Its top sits just under the ground-floor slab.
  {
    kind: 'land', name: 'Plot (726 m²)', mat: 'lawn', y: -0.005, h: 0.01,
    path: [[254, 161], [1643, 530], [1590, 2294], [224, 2209]],
  },

  // ────────────────────────────────── side parking (west of the garage)
  // The sheet draws two cars on the strip between the plot wall and the
  // garage (x 245..368). A paved pad runs the length of it to the street gate.
  { kind: 'paving', name: 'Side parking pad', path: [[246, 1350], [404, 1350], [404, 2198], [246, 2198]] },
  { kind: 'sedan', name: 'Parked car 1', rect: [255, 1366, 375, 1646], nose: 'S', paint: 0xb8bcc4 },
  { kind: 'sedan', name: 'Parked car 2', rect: [255, 1680, 375, 1960], nose: 'S', paint: 0x6b2b2b },

  // ────────────────────────────────── GARAJ
  { kind: 'sedan',  name: 'Mercedes-Benz C220 d', rect: [457, 1677, 577, 1963] },
  // The L200 is 5.30 m long, so its rect starts further north than the old car's;
  // it stays west of x=740 to keep the K1:100/230 door (x 727..783) reachable.
  { kind: 'pickup', name: 'Mitsubishi L200 Pickup (2018)', rect: [626, 1648, 736, 1963] },
  // One continuous worktop the full width of the party wall, for unloading
  // shopping, with the EV charger wall-mounted above its east end.
  { kind: 'box', name: 'Tezgah — unloading worktop', rect: [420, 1594, 702, 1631], h: 0.9, mat: 'counter' },
  { kind: 'box', name: 'ARAÇ ŞARJ İSTASYONU — EV charger', rect: [660, 1596, 698, 1612], h: 0.55, y: 1.1, mat: 'dark' },

  // ────────────────────────────────── MUTFAK
  { kind: 'box', name: 'Kitchen counter (west)',  rect: [481, 1205, 519, 1390], h: 0.9, mat: 'counter' },
  { kind: 'box', name: 'Kitchen counter (south)', rect: [482, 1389, 702, 1426], h: 0.9, mat: 'counter' },
  { kind: 'box', name: 'Tall units / fridge',     rect: [484, 1208, 524, 1250], h: 2.1, mat: 'cabinet' },
  { kind: 'box', name: 'Kitchen island',          rect: [649, 1206, 717, 1330], h: 0.92, mat: 'counter' },
  { kind: 'hob',       name: 'Ocak — MUTFAK',        rect: [652, 1253, 683, 1286], y: 0.92 },
  { kind: 'oven',      name: 'Fırın — MUTFAK',       rect: [485, 1249, 519, 1283], face: 'E' },
  { kind: 'appliance', name: 'Bulaşık Mak.',         rect: [485, 1285, 516, 1338] },
  { kind: 'stool', name: 'Bar stool', rect: [711, 1216, 737, 1242] },
  { kind: 'stool', name: 'Bar stool', rect: [711, 1256, 737, 1282] },
  { kind: 'stool', name: 'Bar stool', rect: [711, 1291, 737, 1317] },

  // ────────────────────────────────── dining
  { kind: 'box', name: 'Dining table', rect: [827, 1241, 889, 1390], h: 0.75, mat: 'wood' },
  { kind: 'chair', rect: [798, 1264, 825, 1291] },
  { kind: 'chair', rect: [798, 1302, 825, 1329] },
  { kind: 'chair', rect: [798, 1339, 825, 1366] },
  { kind: 'chair', rect: [891, 1264, 918, 1291] },
  { kind: 'chair', rect: [891, 1302, 918, 1329] },
  { kind: 'chair', rect: [891, 1339, 918, 1366] },
  { kind: 'chair', rect: [844, 1213, 871, 1240] },
  { kind: 'chair', rect: [844, 1391, 871, 1418] },

  // ────────────────────────────────── Y.MUTFAK KILER
  { kind: 'box', name: 'Pantry counter (west)', rect: [481, 1486, 517, 1573], h: 0.9, mat: 'counter' },
  { kind: 'box', name: 'Pantry counter',        rect: [514, 1441, 700, 1476], h: 0.9, mat: 'counter' },
  { kind: 'box', name: 'Buzdolabı — Y.MUTFAK', rect: [658, 1445, 695, 1483], h: 2.1, mat: 'cabinet' },
  { kind: 'hob',  name: 'Ocak — Y.MUTFAK',     rect: [573, 1445, 606, 1476], y: 0.9 },
  { kind: 'oven', name: 'Fırın — Y.MUTFAK',    rect: [573, 1445, 606, 1479], face: 'S' },

  // ────────────────────────────────── W.C + stair
  { kind: 'basin',  rect: [996, 1775, 1021, 1803] },
  { kind: 'toilet', rect: [986, 1825, 1011, 1850] },
  // The stair belongs to BIRINCI KAT — its plan is the one that draws the
  // whole flight, and it is modelled there descending to this floor. The
  // ZEMIN plan only draws treads 1–12, which stay part of the texture.

  // ────────────────────────────────── GIRIS HOLU
  // Not a room — a freestanding vestiyer/dolap in the recess the sheet draws
  // at x 894..931, y 1724..1869. No partition, no door.
  { kind: 'box', name: 'VESTIYER / DOLAP', rect: [894, 1724, 931, 1869], h: 2.2, mat: 'cabinet' },

  // ────────────────────────────────── OTURMA ODASI
  { kind: 'sofa', name: 'Three-seat sofa', rect: [1194, 1744, 1346, 1801], back: 'N' },
  { kind: 'sofa', name: 'Sectional (west arm)',  rect: [1130, 1818, 1185, 1946], back: 'W' },
  { kind: 'sofa', name: 'Sectional (south arm)', rect: [1150, 1938, 1265, 1995], back: 'S' },
  { kind: 'sofa', name: 'Armchair', rect: [1202, 1653, 1244, 1692], back: 'N', h: 0.4 },
  { kind: 'sofa', name: 'Armchair', rect: [1326, 1653, 1371, 1692], back: 'N', h: 0.4 },
  { kind: 'box',  name: 'Console table', rect: [1261, 1654, 1312, 1690], h: 0.42, mat: 'wood' },
  { kind: 'tv',   name: 'TV — OTURMA ODASI', rect: [1406, 1753, 1412, 1817], h: 0.62, y: 1.05 },

  // ────────────────────────────────── TERRACE (east of the kitchen/hall/living)
  // The L drawn dashed on the sheet: x 946..1191 beside the kitchen, widening
  // to x 1604 along the living room's north wall.
  { kind: 'paving', name: 'Terrace', path: [[946, 1188], [1191, 1188], [1191, 1402], [1604, 1402], [1604, 1615], [946, 1615]] },
  { kind: 'table', name: 'Dining table', rect: [1330, 1478, 1450, 1532] },
  ...[1338, 1378, 1418].flatMap((x) => [
    { kind: 'chair', name: 'Dining chair', rect: [x, 1449, x + 27, 1476] },
    { kind: 'chair', name: 'Dining chair', rect: [x, 1534, x + 27, 1561], rot: 180 },
  ]),
  // Rubble-stone barbecue beside the kitchen, backed onto the terrace's open
  // north edge (the kitchen's east windows fill the wall side, so it can't
  // stand against that). Working face to the south; its flue runs up through
  // the roof (soffit 2.65 m, top 2.93 m).
  { kind: 'barbecue', name: 'Stone barbecue', rect: [1000, 1190, 1101, 1232], back: 'N', flueTop: 3.3 },

  // Timber roof over the whole terrace: a flat oak slab with a thick fascia
  // and plank soffit, leaning on the house walls to the west and south and
  // cantilevering ~0.3 m past the free edges. Slim black posts at the corners.
  // Stacked model only, so the side-by-side ground floor can be seen into.
  {
    kind: 'paving', name: 'Terrace — wooden roof', mat: 'oak', y: 2.65, h: 0.28, roof: true, only: 'stacked',
    path: [[946, 1170], [1209, 1170], [1209, 1384], [1622, 1384], [1622, 1615], [946, 1615]],
  },
  ...[[952, 1176], [1203, 1176], [1203, 1378], [1400, 1378], [1616, 1378], [1616, 1608]].map(([x, y]) => (
    { kind: 'box', name: 'Roof post', rect: [x - 3, y - 3, x + 3, y + 3], h: 2.65, mat: 'frame', only: 'stacked' }
  )),

  // Greenery under the roof: timber planters along the open edges, potted
  // topiary by the table.
  { kind: 'planter', name: 'Planter', rect: [1165, 1240, 1189, 1370] },
  { kind: 'planter', name: 'Planter', rect: [1215, 1405, 1520, 1429] },
  { kind: 'planter', name: 'Planter', rect: [1580, 1425, 1604, 1595] },
  ...[[1225, 1470], [1225, 1560], [1570, 1450], [1570, 1600]].map(([x, y]) => (
    { kind: 'topiary', name: 'Potted topiary', rect: [x - 11, y - 11, x + 11, y + 11] }
  )),

  // ────────────────────────────────── POOL (HAVUZ, AL. 51.70 m²)
  // North of the house. Loungers sit at the centres of the sheet's four
  // ŞEZLONG labels, turned ~25° as drawn.
  { kind: 'pool', name: 'Havuz', rect: [513, 669, 1188, 1103] },
  ...[[1305, 758], [1305, 834], [1305, 942], [1305, 1018]].map(([cx, cy]) => (
    { kind: 'lounger', name: 'Şezlong', rect: [cx - 60, cy - 21, cx + 60, cy + 21], rot: 25 }
  )),
  // One parasol in the gap between each pair of loungers.
  ...[796, 980].map((cy) => (
    { kind: 'parasol', name: 'Parasol', rect: [1305 - 6, cy - 6, 1305 + 6, cy + 6], radius: 1.3 }
  )),
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
  { kind: 'wardrobe', name: 'Wardrobe — Y.ODASI 2 D.ODASI (north)', rect: [2548, 1451, 2694, 1481], back: 'N' },
  { kind: 'wardrobe', name: 'Wardrobe — Y.ODASI 2 D.ODASI (east)',  rect: [2664, 1481, 2694, 1582], back: 'E' },
  { kind: 'wardrobe', name: 'Wardrobe — Y.ODASI 2 D.ODASI (south)', rect: [2548, 1582, 2694, 1612], back: 'S' },

  // ────────────────────────────────── ÇAMSIR ODASI
  { kind: 'box',       name: 'Laundry counter', rect: [2187, 1627, 2385, 1670], h: 0.9, mat: 'counter' },
  { kind: 'appliance', name: 'KM — dryer',      rect: [2189, 1633, 2223, 1666] },
  { kind: 'appliance', name: 'ÇM — washer',     rect: [2231, 1633, 2265, 1666] },
  { kind: 'box',       name: 'Bench',           rect: [2187, 1718, 2262, 1733], h: 0.5, mat: 'wood' },

  // ────────────────────────────────── EBEVEYN suite
  { kind: 'bed', name: 'Bed — EBEVEYN Y. ODASI', rect: [3049, 1676, 3169, 1783], head: 'E' },
  { kind: 'box', name: 'Wardrobe — master',      rect: [2884, 1689, 2925, 1777], h: 2.2, mat: 'cabinet' },
  { kind: 'box', name: 'Desk — EBEVEYN Y. ODASI', rect: [2923, 1789, 2949, 1818], h: 0.75, mat: 'wood' },
  { kind: 'tv',  name: 'TV — EBEVEYN Y. ODASI',  rect: [2927, 1700, 2933, 1770], h: 0.62, y: 1.1 },
  // EBEVEYN D.ODASI: U of wardrobes round three walls with a glass-top island
  // in the middle. It opens north onto the slider; the west run starts south
  // of y 1868 so the slider's parked leaf clears it.
  { kind: 'wardrobe', name: 'Wardrobe — EBEVEYN D.ODASI (west)',  rect: [3010, 1868, 3040, 1976], back: 'W' },
  { kind: 'wardrobe', name: 'Wardrobe — EBEVEYN D.ODASI (east)',  rect: [3147, 1845, 3177, 1976], back: 'E' },
  { kind: 'wardrobe', name: 'Wardrobe — EBEVEYN D.ODASI (south)', rect: [3010, 1976, 3177, 2006], back: 'S' },
  { kind: 'island',   name: 'Dressing island',                    rect: [3073, 1896, 3115, 1946] },
  { kind: 'basin',  rect: [2886, 1863, 2916, 1896] },
  { kind: 'toilet', rect: [2964, 1963, 2988, 2000] },
  { kind: 'shower', name: 'DUS', rect: [2888, 1925, 2960, 2010] },

  // ────────────────────────────────── stair, descending to ZEMIN
  // MÜ: 20 (17x30) switchback. Levels are relative to this floor's slab, so
  // the flights run from -3.40 m up to the final riser at 0.
  { kind: 'stairs', name: 'Stair flight 1 (treads 1–9)',   rect: [2796, 1715, 2871, 1876], dir: 'S', steps: 9, riser: 0.17, from: -3.40 },
  { kind: 'box',    name: 'Stair half-landing',            rect: [2710, 1876, 2871, 1946], h: 1.70, y: -3.40, mat: 'counter' },
  // Open soffit: this flight passes over the ground-floor W.C.
  { kind: 'stairs', name: 'Stair flight 2 (treads 10–18)', rect: [2710, 1721, 2784, 1876], dir: 'N', steps: 9, riser: 0.17, from: -1.70, solid: false },
  { kind: 'railing', name: 'Stair balustrade', path: [[2790, 1721], [2790, 1876]], h: 1.0, y: -1.7 },

  // ────────────────────────────────── roofs
  // The sheet draws no roof, so these are modelled from the owner's photo: a
  // black stone-coated S-tile hip roof, one per block, eaves at wall height.
  // Stacked only (`only: 'stacked'`): the side-by-side first floor stays open
  // so it can be seen into from above. Stacked, they cover the ground floor too.
  { kind: 'hiproof', name: 'Roof — YATAK ODASI block',     rect: [2237, 1194, 2704, 1627], y: 3.0, roof: true, only: 'stacked' },
  { kind: 'hiproof', name: 'Roof — ÇAMSIR / ANA KORIDOR', rect: [2174, 1620, 2560, 1744], y: 3.0, roof: true, only: 'stacked' },
  { kind: 'hiproof', name: 'Roof — stair hall',            rect: [2560, 1620, 2870, 1950], y: 3.0, roof: true, only: 'stacked' },
  { kind: 'hiproof', name: 'Roof — EBEVEYN suite',         rect: [2870, 1621, 3187, 2019], y: 3.0, roof: true, only: 'stacked' },

  // ────────────────────────────────── open edges
  // BALKON TERASI is split front/back. The back half (y 1744..1872, against
  // the house) is a glazed room in black frames under a glass roof, with a
  // sliding door in its glass front. The front half (y 1872..2000) stays open
  // for laundry and keeps the balustrade. The room's east side is the GALERI
  // wall, so only its west and south edges are glass.
  {
    kind: 'railing',
    name: 'BALKON TERASI balustrade',
    path: [[2174, 1872], [2174, 2000], [2560, 2000], [2560, 1874]],
    h: 1.1,
  },
  {
    kind: 'glassroom',
    name: 'BALKON TERASI glass room',
    rect: [2174, 1744, 2560, 1872],
    sides: [
      { side: 'S', door: true },
      { side: 'W' },
    ],
  },
  {
    kind: 'railing',
    name: 'GALERI BOSLUGU balustrade',
    path: [[2569, 1744], [2690, 1744]],
    h: 1.1,
  },
];

export const FLOORS = [
  {
    id: 'ground',
    name: 'ZEMIN',
    label: 'Ground floor',
    crop: { ...ORIGIN },
    // Laminate parquet throughout, kitchens included. Only the W.C, the stair
    // and the garage keep the plain finish. Rects are approximate room
    // interiors; the walls hide the edges.
    parquet: [
      [1124, 1633, 1421, 2004], // OTURMA ODASI
      [482, 1203, 930, 1428],   // MUTFAK + dining
      [482, 1441, 702, 1580],   // Y.MUTFAK KILER
      [718, 1442, 930, 1616],   // ANA KORIDOR
      [812, 1730, 931, 1872],   // GIRIS HOLU
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
      [2389, 1627, 2560, 1737], // ANA KORIDOR
      [2560, 1627, 2870, 1872], // stair hall / gallery, inside the south wall
      [2702, 1872, 2870, 1946], // stair landing (the strip south of the gallery is outdoors)
      [2890, 1638, 3180, 1834], // EBEVEYN Y. ODASI
      [3010, 1845, 3177, 2006], // EBEVEYN D.ODASI
    ],
    alignPx: [-1762, 1],
    storey: 1,
    walls: FIRST_WALLS,
    objects: FIRST_OBJECTS,
    // The slab is clipped to the building's footprint. Without it the whole
    // crop (mostly empty paper) hangs 3.4 m up in the stacked model and hides
    // the ground-floor terrace and its roof.
    outline: [
      [2237, 1194], [2704, 1194], [2704, 1620], [3187, 1620], [3187, 2019],
      [2870, 2019], [2870, 1950], [2560, 1950], [2560, 2000], [2174, 2000],
      [2174, 1620], [2237, 1620],
    ],
    // Openings cut clean through the slab (stairwell void).
    voids: [
      { name: 'GALERI BOSLUGU', rect: [2569, 1744, 2690, 1864] },
      // The stair comes up through here, arriving at the north edge.
      { name: 'Stair well', rect: [2702, 1715, 2872, 1888] },
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
