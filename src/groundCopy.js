/**
 * A full, independent DUPLICATE of the ground floor (ZEMIN), for trying out
 * changes without touching the original in floorplan.js.
 *
 * It is a source copy of the ground floor's walls, plot, planting, gates and
 * objects — comments included — taken when the branch was made. Edit anything
 * below freely; nothing here affects the original. main.js draws it as a third
 * model, west of the origin (key 5 fits it). Delete this file and its entry in
 * main.js's LAYOUTS to drop the copy.
 *
 * Note the copy has its own street-wall gates, plot wall and pool, and the
 * ground apron gets a pool hole for it as well.
 */
import { ORIGIN } from './floorplan.js';

const COPY_WALLS = [
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
  // 2 m garden wall on the plot line (the `land` polygon in COPY_OBJECTS),
  // 0.2 m thick. The street is the south edge (D→C): one 9 m vehicle opening
  // serves both the garage door (x 412..798) and the side parking strip west
  // of it (x 246..404), and a 1.2 m pedestrian opening lines up with the GIRIS
  // entrance (x ≈ 1024). Openings are pixels along each wall.
  {
    name: 'Plot wall — south (street)',
    type: 'exterior', thickness: 0.2, height: 2.0,
    a: [224, 2209], b: [1590, 2294],
    openings: [
      { from: 21, to: 560, sill: 0, head: 2.0, kind: 'gate' },      // parking strip + garage
      { from: 767, to: 838, sill: 0, head: 2.0, kind: 'gate' },     // GIRIS
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
 * Gaps are deliberate: the street gates (edge 2, t 528..599 and 806..1345),
 * the side parking strip on the west edge (t < 900), the terrace on the east
 * edge (t ~ 870..1230) and the pool are all kept clear.
 */
const PLANTING = [
  // north edge, well clear of the pool
  [0, 200, 'fruittree', { fruit: 'mango' }],   [0, 420, 'palm', { species: 'date' }],
  [0, 640, 'banana'],                          [0, 860, 'fruittree', { fruit: 'fig' }],
  [0, 1080, 'palm', { species: 'date' }],      [0, 1300, 'banana'],
  // east edge, stops before the terrace and resumes south of it
  [1, 120, 'palm', { species: 'date' }],       [1, 340, 'banana'],
  [1, 560, 'palm', { species: 'papaya' }],     [1, 780, 'fruittree', { fruit: 'pomegranate' }],
  [1, 1250, 'fruittree', { fruit: 'orange' }], [1, 1450, 'palm', { species: 'date' }],
  [1, 1620, 'banana'],
  // south (street) edge, between the two gates and east of the entrance
  [2, 130, 'fruittree', { fruit: 'lemon' }],   [2, 300, 'palm', { species: 'papaya' }],
  [2, 450, 'banana'],                          [2, 700, 'palm', { species: 'date' }],
  // west edge, north of the parking strip
  [3, 950, 'banana'],                          [3, 1200, 'fruittree', { fruit: 'avocado' }],
  [3, 1450, 'palm', { species: 'date' }],      [3, 1700, 'fruittree', { fruit: 'mango' }],
  [3, 1900, 'palm', { species: 'papaya' }],
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

const COPY_OBJECTS = [
  ...PLANTING,

  // ────────────────────────────────── front gates (street wall)
  // Both black bar gates. The wide one is a bi-parting sliding gate over the
  // garage + side parking opening, drawn closed; the pedestrian gate at GIRIS
  // is a single leaf swung open 70 degrees inward so it reads from above.
  streetGate(21, 560, { name: 'Vehicle gate', style: 'sliding', open: 0 }),
  streetGate(767, 838, { name: 'Pedestrian gate', style: 'swing', openDeg: 70 }),
  // ────────────────────────────────── the plot
  // Inner boundary line on the sheet (the double line round the site). At the
  // model's scale it encloses ~744 m² against the stated 726 m² — within the
  // calibration tolerance. A slab item spans y..y+h, so this runs -0.02..-0.01:
  // above the ground apron (-0.02) and safely under the floor slabs at 0.
  {
    kind: 'land', name: 'Plot (726 m²)', mat: 'lawn', y: -0.02, h: 0.01,
    path: PLOT,
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
  { kind: 'box', name: 'Kitchen counter (south)', rect: [482, 1389, 606, 1426], h: 0.9, mat: 'counter' },
  // Appliance wardrobe (owner's request): the east 1.6 m of the south run is a
  // full-height unit hiding a full-automatic coffee machine, kettle, toaster and
  // microwave behind pocket doors. Against the south partition (y 1434).
  { kind: 'appliancenook', name: 'Appliance wardrobe (coffee, kettle, toaster, microwave)', rect: [606, 1389, 702, 1426], back: 'S' },
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
  // Restyled from the owner's reference: cream and gold, a media wall, and a
  // marble coffee table on a patterned rug.
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
  { kind: 'lounge', name: '3-seat sofa',     rect: [1124, 1787, 1188, 1924], back: 'W', seats: 3 },
  { kind: 'lounge', name: '2-seat sofa',     rect: [1225, 1938, 1326, 2002], back: 'S', seats: 2 },
  { kind: 'lounge', name: 'Armchair (west)', rect: [1196, 1655, 1256, 1719], back: 'N', seats: 1 },
  { kind: 'lounge', name: 'Armchair (east)', rect: [1262, 1655, 1322, 1719], back: 'N', seats: 1 },
  { kind: 'hangingfire', name: 'Hanging fireplace', rect: [1361, 1688, 1373, 1700], faceDeg: 53 },
  { kind: 'rug',      name: 'Rug',          rect: [1196, 1735, 1392, 1935] },
  { kind: 'coffee',   name: 'Coffee table', rect: [1240, 1836, 1300, 1872] },
  // Media wall on the east wall (inner face x ~ 1422): TV, floating unit, niches.
  // The fireplace is not here; it hangs in the north-east corner.
  { kind: 'tvwall',   name: 'Media wall (TV)', rect: [1398, 1745, 1422, 1965], back: 'E', fireplace: false },
  { kind: 'curtain',  name: 'Curtains', rect: [1176, 1631, 1360, 1640] },
  { kind: 'lamp',     name: 'Floor lamp', rect: [1140, 1748, 1156, 1764] },
  { kind: 'sidetable', name: 'Side table', rect: [1140, 1943, 1168, 1971] },
  { kind: 'sidetable', name: 'Side table', rect: [1336, 1960, 1364, 1988] },

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

export const GROUND_COPY = {
  id: 'ground-copy',
  base: 'ground', // floor-visibility keys (1/2/0) treat it as the ground floor
  name: 'ZEMIN (COPY)',
  label: 'Ground floor (copy)',
  crop: { ...ORIGIN },
    // Laminate parquet throughout, kitchens included. Only the W.C, the stair
    // and the garage keep the plain finish. Rects are approximate room
    // interiors; the walls hide the edges.
    // Plan symbols painted over with plain parquet: the removed armchairs and
    // console table, the removed three-seat sofa and the replaced sectional.
    erase: [
      [1196, 1646, 1378, 1697],
      [1186, 1738, 1354, 1806],
      [1126, 1812, 1272, 1998], // the sectional
    ],
    parquet: [
      [1124, 1633, 1421, 2004], // OTURMA ODASI
      [482, 1203, 930, 1428],   // MUTFAK + dining
      [482, 1441, 702, 1580],   // Y.MUTFAK KILER
      [718, 1442, 930, 1616],   // ANA KORIDOR
      [812, 1730, 931, 1872],   // GIRIS HOLU
    ],
  alignPx: [0, 0],
  storey: 0,
  walls: COPY_WALLS,
  objects: COPY_OBJECTS,
};
