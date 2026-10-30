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
 * the living room / master suite north and east walls — to within 1 px. P.16
 * re-drew the first floor 204 px further north on the page, level with the
 * ground floor, so its coordinates were shifted by -204 and its alignment is
 * now (-1763, 0): the floor itself did not move.
 *
 * P.18 (28/10/2026) arrived as the architect's DWG, in true centimetres, and
 * it is now the source: `dwg` is its geometry export (tools/dwg-export.py) and
 * `dwgToSheet` maps its centimetres into this pixel frame. That map was fitted
 * on the structural grid — axes 1–7 and A–D are the exterior wall centrelines,
 * and both floors share one grid — with a residual under 1 px. It also fixed
 * the scale: metersPerPixel had been calibrated against a door's clear opening
 * at 0.0168, which made the house 4% too big. The grid says 0.016144 (axis 1
 * to axis 7 is 16.30 m).
 */

/**
 * Room-area labels the drawing gets wrong, measured to the wall faces of the
 * 30/10 DWG (owner asked for the check: "the kitchen seems small"). MUTFAK's
 * 24.50 predates the dining end; it is 29.40 kitchen + 4.50 dining up to the
 * moved double door. `at` is the label's DWG insert point (cm), `was` its
 * text. tools/render-sheet.mjs and tools/electric-plan.py both apply these,
 * so the floor texture and the electrical PDF read the same.
 */
export const AREA_FIXES = [
  { room: 'MUTFAK',         at: [117979, -78249], was: '24.50 m²', now: '33.90 m²' },
  { room: 'Y.MUTFAK KILER', at: [117919, -78546], was: '9.00 m²',  now: '11.65 m²' },
];

export const PLAN = {
  image: 'assets/30102026_FINAL DRAFT_sheet.jpg',
  // The source: the 30/10/2026 DWG (P.18 re-issued with the kitchen entrance
  // moved), exported. sheetPx = [k·X + tx, -k·Y + ty]; the grid did not move.
  dwg: 'assets/30102026_FINAL DRAFT.geometry.json',
  dwgToSheet: { scale: 0.6194348931697857, offset: [-72427.42615769588, -47315.049526463874] },
  // The vector source. P.14 (24/09/2026) was re-plotted 1.6% larger and
  // shifted on the page, so `pdfToSheet` maps its page px (3509 across, as
  // rendered at 150 dpi) back into this model's pixel frame, which is P.13's:
  //   sheetPx = (pagePx - offset) / scale
  // Fitted on the first-floor room labels, residual < 0.3 px. P.16
  // (02/10/2026) sits on P.14's page frame to within a pixel; it has no text
  // layer, so the extra (+0.5, -1.0) page px were fitted on wall faces and
  // the plot boundary instead. PLAN.image is rendered through the same
  // transform. Kept for revision history; P.18 superseded it.
  pdf: null,          // the P.13–P.16 PDFs were removed on 30/10; supply one to use this fallback
  pdfToSheet: { scale: 1.016043, offset: [-22.625, -13.957] },
  metersPerPixel: 0.01614374667986135,
  // Levels from P.18's section A-A: the garden is ±0.00, the ground floor
  // +0.34 on a 0.34 m slab, the first floor +3.40, the roof +6.46 with its
  // parapet to +6.86. So a storey is 3.06 m floor to floor — 18 risers of
  // 17 cm, as the first-floor stair note (MÜ: 18 (17x30)) says — of which
  // 0.34 is slab and 2.72 m is clear room height.
  plinth: 0.34,
  storeyHeight: 2.72,
  floorToFloor: 3.06,
  thickness: { exterior: 0.25, interior: 0.15 },
  head: 2.3,
  sill: 0.9,
};

/** World origin: the ground-floor crop defines the shared frame. */
// P.16 grew it 85 px north so the first floor's crop takes in its new balconies.
export const ORIGIN = { x: 384, y: 890, w: 1060, h: 940 };

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
 *
 * Window labels are width/height in cm, so an `n/230` is 2.30 m TALL — glazed
 * from the floor to the 2.30 m head, not a window on a 0.9 m sill. The
 * architect's renders (assets/3D Rendered, 2026-10-05) show every one of them
 * that way, so they carry `sill: 0.05` (a fixed full-height pane: a sill of 0
 * would make the opening a door). The `n/110`s are real windows.
 *
 * The ground floor stands on a 0.34 m slab (`level` on its FLOORS entry), but
 * the garden round it is at ±0.00, so everything outside — the plot wall, the
 * parking, the lawn, the trees — carries `site: true`, which keeps it at grade.
 */

/**
 * The plot's four corners in sheet px, clockwise on the page: NW, NE, SE, SW.
 * The centre of P.18's double boundary line (inner and outer faces 0.24 m
 * apart). At the DWG's scale the outer line encloses 713 m² and this one
 * 701 m², against the owner's figure of 726 m².
 */
const PLOT = [[249, 209], [1652, 582], [1600, 2360], [219, 2281]];

const GROUND_WALLS = [
  // ────────────────────────────────── kitchen / dining block (north)
  {
    name: 'Kitchen block — north exterior',
    type: 'exterior',
    a: [474, 992], b: [938, 992],
    openings: [
      // 180/230: a two-panel slider out to the back garden on the owner's
      // instruction (the sheet draws a fixed full-height window), onto its
      // own step. The east half is fixed and the west leaf slides over it —
      // there is no wall west of it to park on, and east of it the dining
      // slider's leaf parks on the same face.
      { from: 54, to: 166, sill: 0, kind: 'sliding', panels: 2, swing: 1 },
      // Dining → back garden: a glazed slider out onto a step down to the
      // lawn, behind the dining table. The sheet draws a 250/230 window
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
      { from: 66, to: 252, sill: 0.05, kind: 'window' }, // 300/230, onto İÇBAHÇE TERASI
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
      { from: 33, to: 157, sill: 0.05, kind: 'window' },  // 200/230, the hall
      // 300/230, OTURMA ODASI (250 before P.18). Its shutter switch goes east
      // of it, past the curtain: west of it the open hall door would cover it.
      { from: 243, to: 429, sill: 0.05, kind: 'window', shutterSwitch: 'to', shutterSwitchOff: 0.27 },
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
      { from: 85, to: 240, sill: 0.05, kind: 'window' }, // 250/230, onto the front terrace
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
    // The main entrance: P.16 makes it a single K1:100/230 leaf from GIRIS
    // TERASI into GIRIS HOLU (PDF faces x 869..931), hinged on the east jamb
    // and drawn open inward (north). East of it the same wall closes the stair
    // and carries its 210/110 window.
    // The renders clad this whole block in limestone (outside face only),
    // give the door a walnut leaf and a full-height glass sidelight to its
    // west, and run the stair window on up through the first floor as one
    // tall glazed column — so its head here is the underside of the slab,
    // whose edge then reads as the column's transom.
    name: 'GIRIS HOLU / stair — south exterior',
    type: 'exterior',
    stone: 1,
    a: [800, 1747], b: [1116, 1747],
    openings: [
      { from: 28, to: 66, sill: 0.05, kind: 'window' },                     // sidelight (renders)
      { from: 69, to: 131, sill: 0, kind: 'door', swing: -1, hinge: 'to', leaf: 'walnut' }, // K1:100/230
      // 210/110; its shutter switch east of it, out from behind the front door.
      { from: 166, to: 290, sill: 1.1, head: PLAN.storeyHeight, kind: 'window', shutterSwitch: 'to' },
    ],
  },
  {
    name: 'West wing — south exterior',
    type: 'exterior',
    a: [412, 1809], b: [800, 1809],
    openings: [
      // The sheet says 300/110; the renders glaze it to the floor.
      { from: 54, to: 240, sill: 0.05, kind: 'window' }, // OYUN ODASI
      { from: 311, to: 373, sill: 1.1, kind: 'window' }, // 100/110, W.C
    ],
  },
  {
    name: 'West wing — west exterior',
    type: 'exterior',
    a: [412, 1416], b: [412, 1809],
    // The sheet draws one 235/110 here. The renders put three tall windows
    // in its place — one wide, two narrow — between fins under a canopy (the
    // fins and canopy are objects, 'ÇALIŞMA — …').
    openings: [
      { from: 16, to: 56, sill: 0.15, head: 2.45, kind: 'window' },
      { from: 72, to: 112, sill: 0.15, head: 2.45, kind: 'window' },
      { from: 128, to: 164, sill: 0.15, head: 2.45, kind: 'window' },
    ],
  },

  // ────────────────────────────────── interior partitions
  // The 30/10 revision moved the kitchen entrance: the K1:180/230 double
  // door went 1.1 m south (wall faces y 1369/1376), so the dining end runs
  // down to it and ANA KORIDOR is only the passage south of it; the wall
  // between KILER and the corridor is gone, and KILER is entered across its
  // north-east corner through a diagonal K1:90/230 (hinge 792,1311, leaf drawn
  // open into the pantry). East of that door a thin wall runs down to the
  // double door's wall; a cupboard niche (x 769..809, y 1376..1407) opens off
  // the corridor behind KILER's south-east corner — the ADT is in it.
  {
    // Thin (DWG faces y 1249/1255), turning down the diagonal at x 737.
    name: 'MUTFAK / Y.MUTFAK KILER partition',
    type: 'interior',
    thickness: 0.1,
    a: [474, 1252], b: [736.5, 1252],
    openings: [],
  },
  {
    // The diagonal across KILER's corner (faces (738,1249)-(759,1270) and
    // the stub (799,1309)-(809,1320)), with the K1:90/230: closed leaf from
    // (757,1276) to the hinge at (792,1311), opening south-west into KILER.
    name: 'MUTFAK / Y.MUTFAK KILER — diagonal',
    type: 'interior',
    thickness: 0.1,
    a: [736.5, 1252], b: [806, 1321.5],
    openings: [
      { from: 31.5, to: 81, sill: 0, kind: 'door', swing: 1, hinge: 'to' }, // K1:90/230
    ],
  },
  {
    name: 'Y.MUTFAK KILER — east wall (to the double door)',
    type: 'interior',
    thickness: 0.1,
    a: [806, 1321.5], b: [806, 1372.5],
    openings: [],
  },
  {
    // K1:180/230 double door between the dining end of MUTFAK and ANA
    // KORIDOR, both leaves drawn open north into the dining room (hinges at
    // x 816 and 926). West of it the wall closes KILER's corner and the
    // ADT niche.
    name: 'Dining / ANA KORIDOR partition',
    type: 'interior',
    thickness: 0.1,
    a: [766, 1372.5], b: [938, 1372.5],
    openings: [
      { from: 52, to: 104, sill: 0, kind: 'door', swing: -1 },
      { from: 104, to: 155, sill: 0, kind: 'door', swing: -1, hinge: 'to' },
    ],
  },
  {
    // The ADT niche's back (faces x 763/769), KILER on its other side.
    name: 'Y.MUTFAK KILER / ADT niche',
    type: 'interior',
    thickness: 0.1,
    a: [766, 1372.5], b: [766, 1416],
    openings: [],
  },
  {
    // The pantry's south wall is the west wing's hall wall (faces 1408/1423).
    name: 'Y.MUTFAK KILER — south wall',
    type: 'interior',
    thickness: 0.25,
    a: [474, 1416], b: [809, 1416],
    openings: [],
  },
  // P.16 re-planned the west wing: ÇALIŞMA ODASI (15.30 m²) runs the width of
  // its north half, OYUN ODASI (17.30 m²) takes the south, and a W.C (2.70 m²)
  // the south-east corner. All three open off GIRIS HOLU through the wing's
  // east wall; the old corridor along the north and the hall vestiyer are gone.
  {
    // PDF faces x 791/807. Doors, north to south: K1:90 into ÇALIŞMA hinged
    // on the partition stub, K1:90 into OYUN hinged on the same stub, K1:80
    // into the W.C. All open west into their rooms.
    name: 'West wing / GIRIS HOLU wall',
    type: 'interior',
    thickness: 0.25,
    a: [799, 1416], b: [799, 1809],
    openings: [
      { from: 107, to: 156, sill: 0, kind: 'door', swing: 1, hinge: 'to' }, // ÇALIŞMA ODASI
      { from: 181, to: 230, sill: 0, kind: 'door', swing: 1 },              // OYUN ODASI
      { from: 255, to: 298, sill: 0, kind: 'door', swing: 1 },              // W.C
    ],
  },
  {
    name: 'ÇALIŞMA / OYUN partition',     // PDF faces y 1581/1588
    type: 'interior',
    thickness: 0.1,
    a: [412, 1584], b: [799, 1584],
    openings: [],
  },
  {
    name: 'W.C — north wall',             // PDF faces y 1656/1662
    type: 'interior',
    thickness: 0.1,
    a: [705, 1659], b: [799, 1659],
    openings: [],
  },
  {
    name: 'W.C — west wall',              // PDF faces x 702/708
    type: 'interior',
    thickness: 0.1,
    a: [705, 1659], b: [705, 1809],
    openings: [],
  },

  // ────────────────────────────────── stair
  // The stair is open to GIRIS HOLU along its west side (the sheet draws a
  // single edge line at x 943, not a wall); it is modelled on BIRINCI KAT,
  // descending. P.16 dropped DEPO: the space under the top of flight 2 (the
  // west column) is a VESTIYER facing the hall.
  {
    // The spine between the two flights (DWG faces x 1026..1032).
    name: 'Stair — central wall',
    type: 'interior',
    thickness: 0.1,
    a: [1029, 1515], b: [1029, 1667],
    openings: [],
  },
  // P.18 boxes in the space under the top of flight 2: a thin wall across its
  // north end (y 1515..1521) and a divider at x 986..992. The west half is
  // the VESTIYER, open to the hall; the east half is a store under the
  // flight, open to the south. Both stop at 1.95 m, under flight 2's treads.
  {
    name: 'VESTIYER — north wall',
    type: 'interior', thickness: 0.1, height: 1.95,
    a: [948, 1518], b: [1029, 1518],
    openings: [],
  },
  {
    name: 'VESTIYER / under-stair store divider',
    type: 'interior', thickness: 0.1, height: 1.95,
    a: [989, 1518], b: [989, 1611],
    openings: [],
  },

  // ────────────────────────────────── front yard (outside, at ±0.00)
  // P.18 runs the parking from the west plot wall, so the low wall that used
  // to close it on the west is gone. What stays is the wall between the bays
  // and the path to GIRIS (DWG faces x 794/809), ending in a pier at the street.
  {
    name: 'Parking / path wall',
    type: 'exterior', height: 1.0, site: true,
    a: [801, 1908], b: [801, 2318],
    openings: [],
  },

  // ────────────────────────────────── plot boundary wall
  // 2 m garden wall on the plot line: the centre of P.18's double line, which
  // is 0.24 m thick. The street is the south edge (SW → SE), open for the
  // three parking bays (x 226..794, 9.2 m) and the path to GIRIS (x 809..964,
  // 2.5 m) either side of a pier. Openings are pixels along each wall.
  {
    name: 'Plot wall — south (street)',
    type: 'exterior', thickness: 0.24, height: 2.0, site: true,
    a: PLOT[3], b: PLOT[2],
    openings: [
      { from: 8, to: 576, sill: 0, head: 2.0, kind: 'gate' },       // parking bays
      { from: 591, to: 747, sill: 0, head: 2.0, kind: 'gate' },     // path to GIRIS
    ],
  },
  { name: 'Plot wall — east',  type: 'exterior', thickness: 0.24, height: 2.0, site: true, a: PLOT[2], b: PLOT[1], openings: [] },
  { name: 'Plot wall — north', type: 'exterior', thickness: 0.24, height: 2.0, site: true, a: PLOT[1], b: PLOT[0], openings: [] },
  { name: 'Plot wall — west',  type: 'exterior', thickness: 0.24, height: 2.0, site: true, a: PLOT[0], b: PLOT[3], openings: [] },
];

const FIRST_WALLS = [
  // ────────────────────────────────── north block (YATAK ODASI 1 & 2)
  {
    name: 'North block — north exterior',
    type: 'exterior',
    a: [2237, 990], b: [2704, 990],
    // P.16 puts a BALKON outside each bedroom, so these openings are the way
    // out: black glazed sliders to the floor. P.18 widens YATAK ODASI 1's from
    // 180/230 to a 250/230 like its neighbour (DWG x 2284..2439 and 2520..2674).
    openings: [
      { from: 47, to: 202, sill: 0, kind: 'sliding' },  // 250/230, YATAK ODASI 1
      { from: 283, to: 437, sill: 0, kind: 'sliding' }, // 250/230, YATAK ODASI 2
    ],
  },
  // The two north balconies (4.20 m² each, P.16): recesses walled on both
  // sides to the full storey, as in the architect's SketchUp massing, with a
  // glazed balustrade on the outer edge (PDF y 906..916).
  {
    name: 'BALKON (YATAK ODASI 1) — west wall',
    type: 'exterior',
    a: [2237, 909], b: [2237, 990],
    openings: [],
  },
  {
    name: 'BALKON — dividing wall',
    type: 'exterior',
    a: [2468, 909], b: [2468, 990],
    openings: [],
  },
  {
    name: 'BALKON (YATAK ODASI 2) — east wall',
    type: 'exterior',
    a: [2704, 909], b: [2704, 990],
    openings: [],
  },
  // High strip windows. P.18's plan leaves them out, but its side elevations
  // draw a band of sliding sashes along the first floor's side walls, 1.81 to
  // 2.46 m above the floor (65 cm tall), over the bedrooms, the dressing room
  // and the shower room. Positions come off the elevations' A–D grid.
  {
    name: 'North block — west exterior',
    type: 'exterior',
    a: [2237, 990], b: [2237, 1414],
    openings: [
      { from: 30, to: 237, sill: 1.81, head: 2.46, kind: 'window' }, // YATAK ODASI 1, strip
      { from: 283, to: 364, sill: 1.1, kind: 'window' }, // 130/110, ORTAK W.C
    ],
  },
  {
    name: 'North block — east exterior',
    type: 'exterior',
    a: [2704, 990], b: [2704, 1423],
    openings: [
      // The elevation runs this one to y 1224, across the dressing-room wall
      // P.18 moved to 1211; it stops short of that wall here.
      { from: 30, to: 214, sill: 1.81, head: 2.46, kind: 'window' },  // YATAK ODASI 2, strip
      { from: 278, to: 327, sill: 1.81, head: 2.46, kind: 'window' }, // Y.ODASI 2 D.ODASI
    ],
  },
  {
    name: 'Y.ODASI 2 D.ODASI — south wall',
    type: 'exterior',
    a: [2539, 1414], b: [2704, 1414],
    openings: [],
  },
  {
    // One wall, not twin partitions: the PDF faces sit at x=2461 and 2476
    // (15 px ≈ 0.25 m). The verticals at 2453/2456 and 2482/2485 are the two TVs.
    name: 'YATAK ODASI 1 / 2 partition',
    type: 'interior',
    thickness: 0.25,
    a: [2468, 990], b: [2468, 1359],
    openings: [],
  },
  {
    name: 'YATAK ODASI 1 — door wall',
    type: 'interior',
    a: [2389, 1355], b: [2468, 1355],
    openings: [{ from: 12, to: 65, sill: 0, kind: 'door', swing: -1, hinge: 'to' }], // K1:90/230
  },
  {
    name: 'YATAK ODASI 2 — door wall',
    type: 'interior',
    a: [2468, 1355], b: [2543, 1355],
    openings: [{ from: 18, to: 68, sill: 0, kind: 'door', swing: -1 }], // K1:90/230
  },
  {
    name: 'Y.ODASI 2 D.ODASI — west wall',
    type: 'interior',
    a: [2543, 1355], b: [2543, 1414],
    openings: [],
  },
  // The riser shaft (tesisat şaftı), owner's instruction: straight above the
  // ADT niche, so mains (kuvvetli akım) and low-voltage (zayıf akım: CAT6, TV,
  // alarm) rise from the ADT to this floor. 40 × 50 cm inside, in the dressing
  // room's south-west corner against the column (DWG x 2540..2571 below it);
  // the slab is open over it (`voids`). Not on the architect's drawing.
  {
    name: 'Şaft — north wall',
    type: 'interior',
    thickness: 0.1,
    a: [2546.5, 1373], b: [2577.5, 1373],
    openings: [],
  },
  {
    name: 'Şaft — east wall',
    type: 'interior',
    thickness: 0.1,
    a: [2574.5, 1373], b: [2574.5, 1407],
    openings: [],
  },
  {
    // D.ODASI = Dolap Odası (dressing room). Thin partition between YATAK
    // ODASI 2 and its dressing room; P.18 moves it 0.5 m north, to DWG faces
    // y 1208/1215, so the dressing room grows to 6 m².
    name: 'YATAK ODASI 2 / Y.ODASI 2 D.ODASI partition',
    type: 'interior',
    thickness: 0.1,
    a: [2553, 1211.5], b: [2704, 1211.5],
    openings: [],
  },
  {
    name: 'ORTAK W.C — north wall',
    type: 'interior',
    a: [2237, 1252], b: [2379, 1252],
    openings: [],
  },
  {
    // The W.C opens onto ANA KORIDOR, not into ÇAMSIR ODASI. PDF faces run
    // x=2371/2386 with a clear gap at y 1353..1408 — that gap is the door.
    name: 'ORTAK W.C — east wall',
    type: 'interior',
    a: [2379, 1244], b: [2379, 1412],
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
    a: [2175, 1416], b: [2389, 1416],
    openings: [],
  },
  {
    name: 'ÇAMSIR ODASI — west exterior',
    type: 'exterior',
    a: [2175, 1416], b: [2175, 1540],
    openings: [
      { from: 49, to: 105, sill: 1.1, kind: 'window' }, // 100/110, new in P.18
    ],
  },
  {
    // ÇAMSIR ODASI and ANA KORIDOR against KAPALI TERAS. P.14 enclosed the
    // terrace, so the 251/230 in this wall is its way in: a black glazed
    // slider, parked west over the solid wall.
    name: 'ÇAMSIR / ANA KORIDOR — south wall',
    type: 'exterior',
    stone: 1,                 // KAPALI TERAS's back wall is stone in the renders
    a: [2175, 1540], b: [2562, 1540],
    openings: [
      { from: 221, to: 370, sill: 0, kind: 'sliding', swing: -1 }, // 251/230
    ],
  },
  {
    name: 'ÇAMSIR ODASI — east wall',
    type: 'interior',
    a: [2382, 1421], b: [2382, 1540],
    openings: [{ from: 66, to: 110, sill: 0, kind: 'door', swing: 1, hinge: 'to' }], // K1:80/230
  },
  {
    // KAPALI TERAS (11 m²) is drawn in P.14 as an enclosed room: a solid
    // west wall with a 185/110 window and a 600/230 glazed front onto BALKON
    // TERASI. That is the owner's earlier glass room, now on the sheet.
    name: 'KAPALI TERAS — west exterior',
    type: 'exterior',
    stone: 1,
    a: [2175, 1540], b: [2175, 1666],
    openings: [
      { from: 6, to: 121, sill: 1.1, kind: 'window' }, // 185/110
    ],
  },
  {
    // The 600/230 glazed front, in black: fixed panes either side of a
    // sliding door out to the balcony. The fixed panes stand on a 5 cm sill
    // so they read as glazing rather than doorways.
    name: 'KAPALI TERAS — glazed front',
    type: 'exterior',
    thickness: 0.12,
    a: [2175, 1666], b: [2562, 1666],
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
    stone: 1,
    a: [2562, 1540], b: [2562, 1747],
    openings: [],
  },
  {
    name: 'GALERI / stair hall — south exterior',
    type: 'exterior',
    stone: 1,
    a: [2562, 1747], b: [2878, 1747],
    openings: [
      { from: 18, to: 124, sill: 0.05, kind: 'window' },  // 180/230, GALERI
      // The top of the stair's glazed column, carried on from the ground floor.
      // P.18 draws it 185/110 (the ground floor's is 210/110).
      { from: 165, to: 279, sill: 0.05, kind: 'window' }, // 185/110, stair
    ],
  },

  // ────────────────────────────────── master suite (east)
  {
    name: 'Master suite — north exterior',
    type: 'exterior',
    a: [2701, 1416], b: [3185, 1416],
    openings: [
      // 200/230, full height with a glass Juliet balustrade outside (renders).
      { from: 33, to: 157, sill: 0.05, kind: 'window' },
      // P.16 widens the bedroom's 255/230 to 300/230 (PDF x 2950..3136) and
      // puts a BALKON outside it, so it is a black glazed slider to the floor.
      { from: 249, to: 435, sill: 0, kind: 'sliding' },
    ],
  },
  // EBEVEYN BALKON (5.70 m², P.16): walled both sides like the bedroom ones.
  {
    name: 'EBEVEYN BALKON — west wall',
    type: 'exterior',
    a: [2878, 1315], b: [2878, 1416],
    openings: [],
  },
  {
    name: 'EBEVEYN BALKON — east wall',
    type: 'exterior',
    a: [3185, 1315], b: [3185, 1416],
    openings: [],
  },
  {
    name: 'Master suite — east exterior',
    type: 'exterior',
    a: [3185, 1416], b: [3185, 1809],
    openings: [
      { from: 28, to: 202, sill: 1.81, head: 2.46, kind: 'window' },  // EBEVEYN Y. ODASI, strip
      { from: 245, to: 384, sill: 1.81, head: 2.46, kind: 'window' }, // DUS W.C, strip
    ],
  },
  {
    name: 'Master suite — south exterior',
    type: 'exterior',
    a: [2878, 1809], b: [3185, 1809],
    openings: [],
  },
  {
    // Also the stair hall's east wall.
    name: 'EBEVEYN Y.ODASI — west wall',
    type: 'interior',
    thickness: 0.25,
    a: [2878, 1416], b: [2878, 1809],
    openings: [{ from: 12, to: 68, sill: 0, kind: 'door', swing: -1 }], // K1:90/230
  },
  // P.18 swaps the two rooms behind the bedroom: EBEVEYN D.ODASI (7 m²) is
  // now the west one and DUS W.C (5 m²) the east, and both are entered side
  // by side through K1:80/230s in the bedroom's south wall (DWG faces y
  // 1645/1651, divider x 3058/3065).
  {
    name: 'EBEVEYN Y.ODASI — south wall',
    type: 'interior',
    thickness: 0.1,
    a: [2878, 1648], b: [3185, 1648],
    openings: [
      // Bedroom ↔ EBEVEYN D.ODASI: the drawing's K1:80 (x 3012..3055) is the
      // owner's black glazed slider, as the old opening was. It parks west,
      // over the solid wall, on the dressing-room face.
      { from: 134, to: 177, sill: 0, kind: 'sliding', swing: -1, shutter: false }, // indoors: no shutter
      { from: 190, to: 233, sill: 0, kind: 'door', swing: 1 }, // K1:80/230 into DUS W.C, hinged west
    ],
  },
  {
    name: 'EBEVEYN D.ODASI / DUS W.C partition',
    type: 'interior',
    thickness: 0.1,
    a: [3061.5, 1648], b: [3061.5, 1809],
    openings: [],
  },
];

/**
 * Furniture and fixtures, traced off the same drawings as the walls, in the
 * same sheet-pixel space. See objects.js for what each `kind` builds.
 */
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
 * P.18 has no pool and no patio, so the garden is lawn all round: the deep
 * garden north of the house, the east garden beside İÇBAHÇE TERASI (about
 * 3.4 m from the terrace edge to the wall), the front garden east of the path
 * and the strip west of the house. The street openings (edge 2, t 636..1383)
 * and the parking bays, which now run to the west wall (edge 3, t < 420),
 * are kept clear.
 */
const PLANTING = [
  // north edge: the garden behind the house
  [0, 150, 'fruittree', { fruit: 'mango' }],   [0, 350, 'palm', { species: 'date' }],
  [0, 550, 'banana'],                          [0, 750, 'fruittree', { fruit: 'fig' }],
  [0, 950, 'palm', { species: 'date' }],       [0, 1150, 'banana'],
  [0, 1330, 'fruittree', { fruit: 'avocado' }],
  // east edge, north to south: beside the terrace and on into the front garden
  [1, 150, 'palm', { species: 'date' }],       [1, 330, 'fruittree', { fruit: 'pomegranate' }],
  [1, 520, 'banana'],                          [1, 720, 'fruittree', { fruit: 'orange' }],
  [1, 920, 'palm', { species: 'date' }],       [1, 1120, 'fruittree', { fruit: 'lemon' }],
  [1, 1320, 'palm', { species: 'papaya' }],    [1, 1520, 'banana'],
  [1, 1700, 'palm', { species: 'date' }],
  // south (street) edge: the front garden east of the path
  [2, 140, 'fruittree', { fruit: 'mango' }],   [2, 320, 'palm', { species: 'papaya' }],
  [2, 500, 'banana'],
  // west edge, beside the house and up into the north garden
  [3, 620, 'palm', { species: 'papaya' }],     [3, 900, 'fruittree', { fruit: 'fig' }],
  [3, 1300, 'palm', { species: 'date' }],      [3, 1550, 'banana'],
  [3, 1800, 'fruittree', { fruit: 'pomegranate' }],
].map(([edge, t, kind, opts], i) => {
  const { inset = 65, ...rest } = opts ?? {};       // 65 px in from the wall unless told otherwise
  const [x, y] = plotPoint(edge, t, inset);
  return { kind, name: `${kind} ${i + 1}`, rect: [x - 6, y - 6, x + 6, y + 6], seed: i + 1, site: true, ...rest };
});

/**
 * A gate leaf group for the street wall's opening running `from`..`to` px from
 * its west end (the wall's `a` point). Placed on the wall line and turned to
 * match its slight slope.
 */
function streetGate(from, to, extra) {
  const [a, b] = [PLOT[3], PLOT[2]];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const [ux, uy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const mid = (from + to) / 2;
  const [cx, cy] = [a[0] + ux * mid, a[1] + uy * mid];
  const half = (to - from) / 2;
  return {
    kind: 'gate', rect: [cx - half, cy - 6, cx + half, cy + 6],
    rot: (Math.atan2(uy, ux) * 180) / Math.PI, site: true, ...extra,
  };
}

/** Outer faces of the ground-floor house, clockwise from the kitchen's NW corner. */
const GROUND_FOOTPRINT = [
  [466, 984], [946, 984], [946, 1408], [1430, 1408], [1430, 1817], [1108, 1817],
  [1108, 1755], [807, 1755], [807, 1817], [404, 1817], [404, 1408], [466, 1408],
];

/**
 * The switched lighting circuits of the electrical project
 * (`tools/electric-plan.py`), named for the hint the walk-mode switches show.
 * Fittings take one as `circuit`; `src/circuits.js` fades them.
 */
// Switched groups (anahtar uçları), named by the lighting circuit (linye,
// one breaker in the ADT) they hang off and a letter: one circuit per area,
// not one per fitting type (owner) — L1 the living room and ANA KORIDOR,
// L2 the kitchen with KILER. Each id is one switch gang; the drawing prints the same names.
export const CIRCUITS = {
  L1a: 'OTURMA ODASI spots',
  L1b: 'OTURMA ODASI hidden LED',
  L2a: 'MUTFAK chandelier',
  L2b: 'MUTFAK under-cabinet LED',
  L2c: 'MUTFAK spots (kitchen)',
  L2d: 'MUTFAK spots (dining)',
  L2e: 'Y.MUTFAK KILER ceiling lamp',
  L2f: 'Y.MUTFAK KILER under-cabinet LED',
  L1c: 'ANA KORIDOR ceiling light',
};

/** Underside of MUTFAK's spot band; the wall cabinets stop under it. */
const KITCHEN_BAND = 2.45;

const GROUND_OBJECTS = [
  ...PLANTING,

  // ────────────────────────────────── front gates (street wall)
  // Both in horizontal slats, as the renders draw them. The wide one is a
  // bi-parting sliding gate across the three parking bays, drawn closed; the
  // gate onto the path to GIRIS is a single leaf swung open 70 degrees inward
  // so it reads from above.
  streetGate(8, 576, { name: 'Vehicle gate', style: 'sliding', open: 0, slats: 'horizontal' }),
  streetGate(591, 747, { name: 'Pedestrian gate', style: 'swing', openDeg: 70, slats: 'horizontal' }),
  // ────────────────────────────────── the plot
  // A slab item spans y..y+h, so this runs -0.02..-0.01: above the ground
  // apron (-0.02) and under everything else.
  {
    kind: 'land', name: 'Plot (726 m²)', mat: 'lawn', y: -0.02, h: 0.01, site: true,
    path: PLOT,
  },

  // ────────────────────────────────── hard landscaping (P.18)
  // P.18 drops the pool and its patio: the garden is lawn, and only what the
  // house stands on is paved. The house floor is +0.34, the garden ±0.00, so
  // the terraces are 0.34 m platforms (paving from grade, `h: 0.34`) and the
  // path and parking are at grade. GIRIS TERASI (18 m²) is not outlined on the
  // sheet; it is taken as the strip in front of OTURMA ODASI plus the landing
  // at the front door, which together make about that.
  {
    // İÇBAHÇE TERASI, 55 m², drawn edge to edge between the kitchen and living
    // blocks out to the house's east face (DWG x 948..1432, y 982..1407).
    kind: 'paving', name: 'İÇBAHÇE TERASI', h: 0.34, site: true,
    path: [[938, 982], [1432, 982], [1432, 1416], [938, 1416]],
  },
  {
    kind: 'paving', name: 'GIRIS TERASI + front door landing', h: 0.34, site: true,
    path: [[801, 1747], [1116, 1747], [1116, 1809], [1432, 1809], [1432, 1955], [964, 1955], [964, 1924], [801, 1924]],
  },
  {
    // In front of the west wing the house slab steps down at the long low
    // wall P.18 draws north of the bays (y 1908..1924, x 294..732).
    kind: 'paving', name: 'West wing — front step', h: 0.34, site: true,
    path: [[294, 1809], [801, 1809], [801, 1924], [294, 1924]],
  },
  {
    kind: 'paving', name: 'Step — dining slider', h: 0.17, site: true,
    path: [[750, 950], [915, 950], [915, 984], [750, 984]],
  },
  {
    kind: 'paving', name: 'Step — kitchen slider (180/230)', h: 0.17, site: true,
    path: [[523, 950], [645, 950], [645, 984], [523, 984]],
  },
  {
    kind: 'paving', name: 'Step — KILER door', h: 0.17, site: true,
    path: [[440, 1298], [466, 1298], [466, 1377], [440, 1377]],
  },
  // The path to GIRIS and the three bays (2.5 × 5.0 m each, x 276..740).
  { kind: 'paving', name: 'Path to GIRIS', site: true, path: [[809, 1924], [964, 1924], [964, 2318], [809, 2318]] },
  { kind: 'paving', name: 'Parking bays', mat: 'coping', site: true, path: [[226, 1924], [794, 1924], [794, 2312], [226, 2280]] },
  // Bay markings: the four lines between and either side of the bays.
  ...[276, 430.5, 585, 740].map((x) => (
    { kind: 'paving', name: 'Parking bay line', mat: 'frame', y: 0.04, h: 0.005, site: true,
      path: [[x - 1, 1952], [x + 1, 1952], [x + 1, 2262], [x - 1, 2262]] }
  )),

  // ────────────────────────────────── the cars (open parking)
  // P.18 draws three bays; the family's two cars take the western two, nose
  // to the house.
  { kind: 'sedan',  name: 'Mercedes-Benz C220 d', rect: [296, 1960, 410, 2254], site: true },
  { kind: 'pickup', name: 'Mitsubishi L200 Pickup (2018)', rect: [451, 1952, 564, 2262], site: true },

  // ────────────────────────────────── MUTFAK
  { kind: 'box', name: 'Kitchen counter (west)',  rect: [482, 999, 519, 1213], h: 0.9, mat: 'counter' },
  { kind: 'box', name: 'Kitchen counter (south)', rect: [613, 1213, 730, 1250], h: 0.9, mat: 'counter' },
  // Secret appliance wardrobe (owner's request) at the west end of the south
  // run, by the corner, behind sliding pocket doors (drawn slid open) with
  // cabinets above it to the ceiling. 1.50 m wide, on the owner's
  // instruction, for a full-automatic coffee machine, a Turkish coffee
  // machine and a toaster, with two twin UK sockets (BS 1363) over them.
  {
    kind: 'appliancenook', name: 'Appliance wardrobe (coffee machines, toaster)',
    rect: [520, 1213, 613, 1250], back: 'S', h: KITCHEN_BAND,
  },
  { kind: 'box', name: 'Buzdolabı — MUTFAK',      rect: [658, 1209, 695, 1247], h: 2.1, mat: 'cabinet' },
  { kind: 'box', name: 'Kitchen island',          rect: [649, 999, 717, 1123], h: 0.92, mat: 'counter' },
  { kind: 'hob',       name: 'Ocak — MUTFAK',     rect: [652, 1046, 683, 1079], y: 0.92 },
  { kind: 'appliance', name: 'Bulaşık Mak.',      rect: [485, 1078, 516, 1131] },
  // Upper cabinets to the ceiling over both worktop runs (owner's request; the
  // sheet draws base units only). 0.35 m deep (21 px); the west run stops
  // either side of the 180/110 window, and the section over the fridge starts
  // above it rather than at 1.5 m.
  // They stop at the spot band's underside (2.45 m, below) and their strips
  // are circuit L2b, the tezgah altı LED on the kitchen's first double switch.
  ...[
    ['Upper cabinets — MUTFAK west (north of window)', [482, 999, 503, 1062], 'W'],
    ['Upper cabinets — MUTFAK west (south of window)', [482, 1178, 503, 1250], 'W'],
    ['Upper cabinets — MUTFAK south',                  [613, 1229, 658, 1250], 'S'],
    ['Upper cabinet — over the MUTFAK fridge',         [658, 1229, 695, 1250], 'S', 2.15],
    ['Upper cabinets — MUTFAK south (east end)',       [695, 1229, 730, 1250], 'S'],
  ].map(([name, rect, back, y]) => (
    { kind: 'wallcabinet', name, rect, back, y, top: KITCHEN_BAND, circuit: 'L2b' }
  )),
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
  { kind: 'box', name: 'Pantry counter (south)', rect: [482, 1371, 763, 1408], h: 0.9, mat: 'counter' },
  { kind: 'box', name: 'Buzdolabı — Y.MUTFAK',   rect: [658, 1259, 695, 1297], h: 2.1, mat: 'cabinet' },
  { kind: 'hob',  name: 'Ocak — Y.MUTFAK',       rect: [573, 1259, 606, 1291], y: 0.9 },
  { kind: 'oven', name: 'Fırın — Y.MUTFAK',      rect: [573, 1259, 606, 1293], face: 'S' },
  // Upper cabinets to the ceiling on both long walls (owner's request). Over
  // the hob they start at 2.0 m to leave it clear, over the fridge above it.
  { kind: 'wallcabinet', name: 'Upper cabinets — KILER north',          rect: [482, 1256, 573, 1277], back: 'N', circuit: 'L2f' },
  { kind: 'wallcabinet', name: 'Upper cabinet — over the KILER hob',    rect: [573, 1256, 606, 1277], back: 'N', y: 2.0, circuit: 'L2f' },
  { kind: 'wallcabinet', name: 'Upper cabinets — KILER north (middle)', rect: [606, 1256, 658, 1277], back: 'N', circuit: 'L2f' },
  { kind: 'wallcabinet', name: 'Upper cabinet — over the KILER fridge', rect: [658, 1256, 695, 1277], back: 'N', y: 2.15, circuit: 'L2f' },
  { kind: 'wallcabinet', name: 'Upper cabinets — KILER north (east)',   rect: [695, 1256, 730, 1277], back: 'N', circuit: 'L2f' },
  { kind: 'wallcabinet', name: 'Upper cabinets — KILER south',          rect: [482, 1387, 763, 1408], back: 'S', circuit: 'L2f' },

  // ────────────────────────────────── ÇALIŞMA ODASI (P.16)
  // KÜTÜPHANE on the north wall, a corner desk with the monitors east of it,
  // and a podcast corner by the west window: two armchairs and a small table.
  { kind: 'box', name: 'KÜTÜPHANE — bookshelves', rect: [520, 1425, 612, 1448], h: 2.1, mat: 'cabinet' },
  { kind: 'box', name: 'ÇALIŞMA MASASI — desk',   rect: [621, 1425, 791, 1473], h: 0.75, mat: 'wood' },
  { kind: 'chair', name: 'Desk chair', rect: [688, 1478, 715, 1505], rot: 180 },
  { kind: 'lounge', name: 'Podcast armchair (north)', rect: [424, 1428, 466, 1470], back: 'W', seats: 1 },
  { kind: 'lounge', name: 'Podcast armchair (south)', rect: [424, 1530, 466, 1572], back: 'W', seats: 1 },
  { kind: 'sidetable', name: 'Podcast table', rect: [450, 1484, 488, 1520] },

  // ────────────────────────────────── OYUN ODASI (P.16)
  // A corner sofa round the north-west, a coffee table, two armchairs at the
  // south window, and the TV on a low unit against the W.C wall.
  { kind: 'sofa', name: 'Corner sofa (north run)', rect: [420, 1593, 590, 1640], back: 'N' },
  { kind: 'sofa', name: 'Corner sofa (west run)',  rect: [420, 1640, 468, 1766], back: 'W' },
  { kind: 'coffee', name: 'Coffee table', rect: [543, 1685, 601, 1728] },
  { kind: 'lounge', name: 'Armchair (west)', rect: [486, 1758, 528, 1800], back: 'S', seats: 1 },
  { kind: 'lounge', name: 'Armchair (east)', rect: [573, 1758, 615, 1800], back: 'S', seats: 1 },
  { kind: 'box', name: 'TV unit — OYUN ODASI', rect: [683, 1676, 699, 1777], h: 0.5, mat: 'cabinet' },
  { kind: 'tv',  name: 'TV — OYUN ODASI', rect: [690, 1690, 696, 1764], h: 0.8, y: 1.0 },

  // ────────────────────────────────── W.C (P.16, south-east of the wing)
  { kind: 'basin',  name: 'Lavabo — W.C', rect: [708, 1708, 733, 1745], rot: 270 },
  { kind: 'toilet', name: 'Klozet — W.C', rect: [744, 1765, 772, 1801], rot: 180 },

  // ────────────────────────────────── GIRIS HOLU
  // VESTIYER under the top of flight 2 (west stair column), facing the hall,
  // in the west half of the space P.18 walls off there. Flight 2's treads
  // pass ~2.1 m up at its south end, so it stops at 1.95 m.
  { kind: 'box', name: 'VESTIYER', rect: [951, 1521, 986, 1610], h: 1.95, mat: 'cabinet' },

  // ────────────────────────────────── stair
  // The stair belongs to BIRINCI KAT — its plan draws the whole flight — and
  // is modelled there descending to this floor.

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
  // Held to the havuz band's underside (2.45 m), which runs over it.
  { kind: 'tvwall',   name: 'Media wall (TV)', rect: [1390, 1538, 1414, 1758], back: 'E', fireplace: false, h: 2.45 },
  // Both hang in the band's cornice pockets, rod up at the slab.
  { kind: 'curtain',  name: 'Curtains', rect: [1170, 1424, 1378, 1433] },
  { kind: 'curtain',  name: 'Curtains (slider)', rect: [1172, 1791, 1350, 1800] },

  // The electrical project's ceiling (tools/electric-plan.py, E-01): a havuz
  // ceiling — 60 cm band at 2.45 m round the walls, spots on its centreline
  // ~1.10 m apart, hidden LED in the cove washing the slab soffit, a Cisco AP
  // in the middle. No spot in the NE corner, where the DWG's şömine flue
  // passes. Rect and pockets are the DWG's inner faces converted to sheet px
  // (`PLAN.dwgToSheet`). Stacked only, like every ceiling.
  {
    kind: 'havuz', name: 'OTURMA ODASI — havuz ceiling', rect: [1125, 1422, 1416, 1800],
    band: 0.6, level: 2.45, pitch: 1.1, skip: [[1397, 1441]], ap: true, only: 'stacked',
    circuit: 'L1a', coveCircuit: 'L1b',
    pockets: [
      { side: 'N', from: 1162, to: 1385, off: [0, 0.15] },     // curtains, 300/230 ± 30 cm
      { side: 'S', from: 1165, to: 1357, off: [0, 0.15] },     // curtains, 250/230 slider
      { side: 'E', from: 1558, to: 1738, off: [0.42, 0.58] },  // projector screen cassette
    ],
  },
  // Owner's instruction: the TV stays, and a motorised 120" screen drops in
  // front of it from the band, 0.5 m off the east wall face (x 1385), for a
  // ceiling-hung projector running Android TV, 3.45 m back over the sofa.
  // `P` lowers it and turns the projector on.
  { kind: 'cinema', name: 'Projector screen', rect: [1384, 1558, 1386, 1738], back: 'E', inches: 120, only: 'stacked' },
  { kind: 'lamp',     name: 'Floor lamp', rect: [1140, 1541, 1156, 1557] },
  { kind: 'sidetable', name: 'Side table', rect: [1140, 1736, 1168, 1764] },
  { kind: 'sidetable', name: 'Side table', rect: [1336, 1753, 1364, 1781] },

  // ────────────────────────────────── İÇBAHÇE TERASI (east of the kitchen)
  // The 55 m² terrace between the kitchen's east wall and the living room's
  // north wall, x 946..1432, y 982..1416, raised to the house's +0.34.
  { kind: 'table', name: 'Dining table', rect: [1230, 1170, 1350, 1224] },
  ...[1238, 1278, 1318].flatMap((x) => [
    { kind: 'chair', name: 'Dining chair', rect: [x, 1141, x + 27, 1168] },
    { kind: 'chair', name: 'Dining chair', rect: [x, 1226, x + 27, 1253], rot: 180 },
  ]),
  // Rubble-stone barbecue at the terrace's open north edge, beside the
  // kitchen (whose east wall is taken by the 300/230 window). Working face to
  // the south; its flue runs up through the roof (soffit 2.40 m, top 2.68 m).
  { kind: 'barbecue', name: 'Stone barbecue', rect: [1000, 988, 1101, 1030], back: 'N', flueTop: 3.3 },

  // Timber roof over the whole terrace: a flat oak slab with a thick fascia
  // and plank soffit, leaning on the kitchen wall to the west and the living
  // room to the south, cantilevering ~0.3 m past the free edges. Slim black
  // posts at the free corners and mid-span. Its top stays under the
  // EBEVEYN BALKON's soffit (2.72 m), which overhangs its south-east corner.
  // Stacked model only, so the side-by-side ground floor can be seen into.
  {
    kind: 'paving', name: 'Terrace — wooden roof', mat: 'oak', y: 2.40, h: 0.28, roof: true, only: 'stacked',
    path: [[946, 963], [1451, 963], [1451, 1416], [946, 1416]],
  },
  ...[[952, 988], [1190, 988], [1426, 988], [1426, 1195], [1426, 1400]].map(([x, y]) => (
    { kind: 'box', name: 'Roof post', rect: [x - 3, y - 3, x + 3, y + 3], h: 2.40, mat: 'frame', only: 'stacked' }
  )),

  // Greenery under the roof: a timber planter along the open east edge,
  // potted topiary round the table.
  { kind: 'planter', name: 'Planter', rect: [1398, 1040, 1420, 1360] },
  ...[[1195, 1150], [1195, 1250], [1375, 1150], [1375, 1250]].map(([x, y]) => (
    { kind: 'topiary', name: 'Potted topiary', rect: [x - 11, y - 11, x + 11, y + 11] }
  )),

  // ────────────────────────────────── entrance sconces
  // Owner's instruction: wall lights either side of the front door. They hang
  // on the south face of the entrance wall (centreline y 1747, so the face is
  // at y 1754), 10 px clear of the K1:100/230's jambs (x 869..931) — the west
  // one beyond the glass sidelight (x 828..866). Mounted at 2.0 m, below the
  // 2.30 m head.
  ...[818, 941].map((cx) => (
    { kind: 'walllight', name: 'GIRIS — wall light', rect: [cx - 4, 1754, cx + 4, 1762], back: 'N', z: 2.0 }
  )),

  // ────────────────────────────────── facade details from the renders
  // The architect's renders (assets/3D Rendered, 2026-10-05) add what the
  // sheet does not draw. Stacked model only where they hang off the storey
  // line, since apart there is no first floor for them to belong to.
  {
    // The canopy over the front door, at the storey line. P.18 draws its
    // outline (dashed, as seen from above): from the wall between the parking
    // and the path, across the door to x 948, and 4.5 m out over the path
    // to y 2032 — it rests on that wall on its west side.
    kind: 'paving', name: 'GIRIS — entrance canopy', mat: 'render', y: PLAN.storeyHeight, h: 0.34, only: 'stacked',
    path: [[794, 1753], [948, 1753], [948, 2032], [794, 2032]],
  },
  // ÇALIŞMA ODASI's west face: render fins between its three tall windows
  // and a canopy over the run.
  ...[[1420, 1430], [1472, 1488], [1528, 1544], [1580, 1590]].map(([y0, y1]) => (
    { kind: 'box', name: 'ÇALIŞMA — facade fin', rect: [386, y0, 404, y1], h: 2.55, mat: 'render' }
  )),
  {
    kind: 'paving', name: 'ÇALIŞMA — window canopy', mat: 'render', y: 2.55, h: 0.18,
    path: [[372, 1412], [404, 1412], [404, 1598], [372, 1598]],
  },
  {
    // A small canopy over KILER's service door.
    kind: 'paving', name: 'KILER — door canopy', mat: 'render', y: 2.45, h: 0.15,
    path: [[440, 1298], [466, 1298], [466, 1377], [440, 1377]],
  },
  // GIRIS TERASI in front of OTURMA ODASI: two armchairs and a round table,
  // as rendered, clear of the full-height glazing.
  { kind: 'lounge', name: 'Terrace armchair (west)', rect: [1190, 1858, 1232, 1900], back: 'W', seats: 1 },
  { kind: 'lounge', name: 'Terrace armchair (east)', rect: [1300, 1858, 1342, 1900], back: 'E', seats: 1 },
  { kind: 'sidetable', name: 'Terrace table', rect: [1248, 1866, 1284, 1900] },

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
    // KILER gets one ceiling lamp in the middle instead (owner, below), and
    // the passage left of ANA KORIDOR a flush light.
    ['Hall',             [799, 1416, 1116, 1504]],
    ['ÇALIŞMA ODASI',    [412, 1416, 799, 1584]],
    ['OYUN ODASI',       [412, 1584, 705, 1809]],
    ['W.C',              [705, 1659, 799, 1809]],
  ].map(([name, rect]) => (
    { kind: 'coffer', name: `${name} — ceiling`, rect, only: 'stacked' }
  )),
  {
    // GIRIS HOLU is open to GALERI BOSLUGU above it, so its ceiling is the
    // first floor's: 3.06 m of storey plus 2.72 m of room.
    kind: 'coffer', name: 'GIRIS HOLU — ceiling (double height)',
    rect: [799, 1504, 943, 1747], h: PLAN.floorToFloor + PLAN.storeyHeight, only: 'stacked',
  },
  {
    // One big chandelier over the dining table, on the owner's instruction:
    // two tiers of candle lamps on gold arms, crystal drops, hung from the
    // MUTFAK ceiling on the table's centre (the table is x 816..878, y
    // 1027..1176, so its centre is 847, 1102).
    kind: 'chandelier', name: 'Dining chandelier',
    rect: [802, 1057, 892, 1147], only: 'stacked', circuit: 'L2a',
  },
  {
    // MUTFAK's spots, on the owner's instruction, the same way as OTURMA
    // ODASI's but with no cove: so the kitchen lights three ways — spots,
    // the chandelier (L2a) and the under-cabinet LED (L2b). The band is 0.8 m,
    // not 0.6, so the spots land 5 cm in front of the 0.35 m wall cabinets
    // and light the worktop, not the cabinet tops. Spots over the kitchen are
    // L2c and over the dining end (east of x 760) L2d. The dining alcove by the
    // double door, outside the band's rectangle, is dropped flat to match.
    kind: 'havuz', name: 'MUTFAK — spot ceiling', rect: [482, 1000, 930, 1250],
    band: 0.8, level: KITCHEN_BAND, pitch: 1.2, cove: false,
    circuit: 'L2c', split: { x: 760, circuit: 'L2d' }, fill: [[809, 1250, 933, 1369]], only: 'stacked',
    // Curtain pockets over the tall glazing, as the drawing has them: the
    // north 180/230 and dining slider, the east 300/230 (±30 cm, in the room).
    pockets: [
      { side: 'N', from: 509, to: 659, off: [0, 0.15] },
      { side: 'N', from: 735, to: 930, off: [0, 0.15] },
      { side: 'E', from: 1039, to: 1250, off: [0, 0.15] },
    ],
  },
  // Their curtains, rods up in the pockets.
  { kind: 'curtain', name: 'MUTFAK curtains (north window)', rect: [509, 1001, 659, 1010], only: 'stacked' },
  { kind: 'curtain', name: 'MUTFAK curtains (dining slider)', rect: [735, 1001, 928, 1010], only: 'stacked' },
  { kind: 'curtain', name: 'MUTFAK curtains (east window)', rect: [820, 1140, 1031, 1149], rot: 90, only: 'stacked' },
  // The wall switches from the electrical project. OTURMA ODASI: a double by
  // its door from the hall (L1a spots, L1b hidden LED). MUTFAK: two doubles in
  // the kitchen by the diagonal KILER door, on the left as you come to it —
  // the kitchen face of the stub between its hinge jamb and the thin wall
  // (owner's instruction: to hand passing between the two rooms; it faces
  // north-east, `back: 'SW'`, and stands just beyond the tip of the double
  // door's open west leaf). Chandelier and under-cabinet LED on the first,
  // the two spot groups on the second. Look at one in walk mode and press E.
  { kind: 'lightswitch', name: 'OTURMA ODASI — switch (L1a, L1b)', rect: [1124, 1494, 1126, 1500], back: 'W', z: 1.1, gangs: ['L1a', 'L1b'], only: 'stacked' },
  // …and two-way (vaviyen, owner's request): the same pair on the north wall
  // by the 300/230 onto the back garden — EAST of its curtain. West of it the
  // hall door's leaf, hinged at the wall's north end and opening into the
  // room, lies flat along that wall when open, and a switch is never put
  // behind a door (owner's rule). Beside the window's shutter switch; the
  // hanging fireplace's bowl stays ~0.4 m clear.
  { kind: 'lightswitch', name: 'OTURMA ODASI — garden switch (L1a, L1b)', rect: [1391, 1424, 1397, 1426], back: 'N', z: 1.1, gangs: ['L1a', 'L1b'], only: 'stacked' },
  { kind: 'lightswitch', name: 'MUTFAK — KILER-door switch (L2a, L2b)', rect: [801.7, 1310.6, 803.7, 1312.6], back: 'SW', z: 1.1, gangs: ['L2a', 'L2b'], only: 'stacked' },
  { kind: 'lightswitch', name: 'MUTFAK — KILER-door switch (L2c, L2d)', rect: [805.7, 1315, 807.7, 1317], back: 'SW', z: 1.1, gangs: ['L2c', 'L2d'], only: 'stacked' },
  // Every kitchen light is two-way (vaviyen, owner's request): the same pair
  // again by the garden glazing, so leaving for the garden puts them all
  // out. The wall between the north 180/230 and the dining slider has a
  // concrete column in its middle (DWG x 688..719), which takes no switch box
  // (owner), so one double each side of it, against it and clear of both
  // curtains: L2a+L2b west, L2c+L2d east. Over the island's end, so 1.2 m.
  { kind: 'lightswitch', name: 'MUTFAK — garden-door switch (L2a, L2b)', rect: [674, 999, 680, 1001], back: 'N', z: 1.2, gangs: ['L2a', 'L2b'], only: 'stacked' },
  { kind: 'lightswitch', name: 'MUTFAK — garden-door switch (L2c, L2d)', rect: [722, 999, 728, 1001], back: 'N', z: 1.2, gangs: ['L2c', 'L2d'], only: 'stacked' },

  // The ADT (ana dağıtım tablosu, the main board every circuit is drawn back
  // to), where the owner marked it on the corridor's west side: since 30/10
  // that is the cupboard niche the drawing opens there (0.65 m deep, 0.5 m
  // wide), on its back wall. Single-phase supply in a two-row board like the
  // owner's photo (Hager Gamma type, ~40 × 50 cm): main switch, surge
  // arrester, RCD/RCBOs and MCBs. The riser shaft to the first floor rises
  // over the niche's front half. Bottom edge at 1.20 m (owner: at least
  // 120 cm), top at 1.70; the niche is 2.72 m high, 0.50 wide, 0.65 deep.
  { kind: 'panel', name: 'ANA KORIDOR — ADT (main board)', rect: [769, 1379, 778, 1404], back: 'W', z: 1.2, ht: 0.5 },
  // The Cisco router, on the owner's instruction on the ceiling: the data
  // point every CAT6 run ends at, with a ceiling socket of its own beside it
  // — the network gear is powered from the mains as well as linked by data.
  { kind: 'router', name: 'ANA KORIDOR — Cisco router (ceiling)', rect: [840, 1390, 860, 1402], only: 'stacked' },
  // Y.MUTFAK KILER: one ceiling lamp in the middle of the room (owner's
  // instruction; it replaced the coffer), on its own circuit L2e, and the LED
  // under its wall cabinets on L2f; one double switch for both inside by the
  // diagonal door, on the latch side — the KILER face of the short diagonal
  // wall north-west of the doorway (back 'NE').
  { kind: 'ceilinglight', name: 'Y.MUTFAK KILER — ceiling lamp', rect: [608, 1316, 638, 1346], circuit: 'L2e', only: 'stacked' },
  { kind: 'lightswitch', name: 'Y.MUTFAK KILER — switch (L2e, L2f)', rect: [743.3, 1264.2, 745.3, 1266.2], back: 'NE', z: 1.1, gangs: ['L2e', 'L2f'], only: 'stacked' },
  // The passage is too narrow for a coffer round the router, so one flush
  // ceiling light, on the living room's lighting circuit L1 as group L1c
  // (owner), switched two-way
  // (vaviyen): by the main door — on the hall's west wall, on your left as
  // you come in, between the W.C door (which opens into the wing) and the
  // corner — and by the ADT, on the right as you face it: the niche's north
  // side, at its mouth, past the tip of the board's open cover and under it.
  { kind: 'ceilinglight', name: 'ANA KORIDOR — ceiling light', rect: [890, 1395, 920, 1425], circuit: 'L1c', only: 'stacked' },
  { kind: 'lightswitch', name: 'GIRIS HOLU — main-door switch (L1c)', rect: [807, 1725, 809, 1731], back: 'W', z: 1.1, gangs: ['L1c'], only: 'stacked' },
  { kind: 'lightswitch', name: 'ANA KORIDOR — switch by the ADT (L1c)', rect: [803.5, 1376, 808.5, 1378], back: 'N', z: 1.1, gangs: ['L1c'], only: 'stacked' },
];

/**
 * BIRINCI KAT's footprint (wall centrelines, balcony slabs to their edges),
 * clockwise from the north-west. P.16 adds the bedroom balconies along the
 * north (out to y 906) and the EBEVEYN one over the master suite's north wall
 * (out to y 1312). It must stay rectilinear: `offsetOutline()` (below)
 * relies on it.
 */
const FIRST_OUTLINE = [
  [2237, 906], [2704, 906], [2704, 1416], [2878, 1416], [2878, 1312], [3185, 1312],
  [3185, 1809], [2878, 1809], [2878, 1747], [2566, 1747], [2566, 1816], [2170, 1816],
  [2170, 1416], [2237, 1416],
];

/**
 * The roof: FIRST_OUTLINE less BALKON TERASI, which the renders leave open.
 * It stops at y 1672, just past KAPALI TERAS's glazed front (1666).
 */
const ROOF_OUTLINE = [
  [2237, 906], [2704, 906], [2704, 1416], [2878, 1416], [2878, 1312], [3185, 1312],
  [3185, 1809], [2878, 1809], [2878, 1747], [2566, 1747], [2566, 1672], [2170, 1672],
  [2170, 1416], [2237, 1416],
];

/**
 * The master suite's box, for its taller parapet: out to its cladding on the
 * south and east, to the wall face on the west (x < 2871 north of y 1416 is
 * the open middle bay at the back, which has no roof to stand on).
 */
const MASTER_BOX = [[2871, 1305], [3200, 1305], [3200, 1824], [2871, 1824]];

const FIRST_OBJECTS = [
  // ────────────────────────────────── YATAK ODASI 1
  // P.18 turns both bedrooms round: the beds stand head to head on the wall
  // between them, so each faces its own TV wall.
  { kind: 'bed', name: 'Bed — YATAK ODASI 1', rect: [2340, 1035, 2461, 1122], head: 'E' },
  { kind: 'box', name: 'Nightstand', rect: [2439, 1010, 2461, 1034], h: 0.5, mat: 'wood' },
  { kind: 'box', name: 'Nightstand', rect: [2439, 1123, 2461, 1147], h: 0.5, mat: 'wood' },
  { kind: 'box', name: 'Wardrobe — YATAK ODASI 1', rect: [2247, 1206, 2389, 1243], h: 2.2, mat: 'cabinet' },
  // The run along the west wall (DWG x 2247..2284), facing the foot of the bed.
  { kind: 'box', name: 'TV unit — YATAK ODASI 1', rect: [2247, 1000, 2284, 1204], h: 0.5, mat: 'cabinet' },
  { kind: 'tv',  name: 'TV — YATAK ODASI 1', rect: [2248, 1046, 2254, 1110], h: 0.55, y: 1.1 },

  // ────────────────────────────────── ORTAK W.C
  { kind: 'toilet', rect: [2262, 1260, 2288, 1297] },
  { kind: 'basin',  rect: [2249, 1360, 2275, 1395] },
  // P.18 adds a shower in the W.C's north-east corner.
  { kind: 'shower', name: 'DUS — ORTAK W.C', rect: [2312, 1259, 2373, 1333] },

  // ────────────────────────────────── YATAK ODASI 2 + dressing
  { kind: 'bed', name: 'Bed — YATAK ODASI 2', rect: [2479, 1032, 2603, 1118], head: 'W' },
  { kind: 'box', name: 'Nightstand', rect: [2480, 1007, 2504, 1031], h: 0.5, mat: 'wood' },
  { kind: 'box', name: 'Nightstand', rect: [2480, 1119, 2504, 1143], h: 0.5, mat: 'wood' },
  // The desk runs across the room against the new dressing-room wall, with
  // the chair on its north side.
  { kind: 'box', name: 'Desk — YATAK ODASI 2', rect: [2553, 1171, 2696, 1207], h: 0.75, mat: 'wood' },
  { kind: 'chair', name: 'Desk chair', rect: [2645, 1145, 2672, 1170] },
  { kind: 'tv',  name: 'TV — YATAK ODASI 2', rect: [2690, 1038, 2696, 1109], h: 0.55, y: 1.1 },
  // Y.ODASI 2 D.ODASI (Dolap Odası): wardrobes only round the walls, open
  // floor in the middle, no island. The U opens west onto the vestibule.
  { kind: 'wardrobe', name: 'Wardrobe — Y.ODASI 2 D.ODASI (north)', rect: [2553, 1215, 2697, 1253], back: 'N', lit: true },
  // The east run stops under the high window in that wall.
  { kind: 'wardrobe', name: 'Wardrobe — Y.ODASI 2 D.ODASI (east)',  rect: [2660, 1253, 2697, 1371], back: 'E', lit: true, h: 1.75 },
  // The south run starts east of the riser shaft in the corner.
  { kind: 'wardrobe', name: 'Wardrobe — Y.ODASI 2 D.ODASI (south)', rect: [2578, 1371, 2697, 1408], back: 'S', lit: true },

  // ────────────────────────────────── ÇAMSIR ODASI
  { kind: 'box',       name: 'Laundry counter', rect: [2187, 1423, 2385, 1466], h: 0.9, mat: 'counter' },
  { kind: 'appliance', name: 'KM — dryer',      rect: [2189, 1429, 2223, 1462] },
  { kind: 'appliance', name: 'ÇM — washer',     rect: [2231, 1429, 2265, 1462] },
  { kind: 'box',       name: 'Bench',           rect: [2189, 1511, 2263, 1529], h: 0.5, mat: 'wood' },
  // The utility sink P.18 draws in the counter.
  { kind: 'basin', name: 'Lavabo — ÇAMSIR', rect: [2296, 1425, 2352, 1458] },

  // ────────────────────────────────── EBEVEYN suite (re-planned in P.18)
  // The bed now has its head to the west wall (the stair hall), with a bench
  // at its foot, and faces a long low unit down the east wall with the TV on
  // it — low, because the high strip window runs along that wall above it.
  { kind: 'bed', name: 'Bed — EBEVEYN Y. ODASI', rect: [2888, 1512, 3011, 1611], head: 'W' },
  { kind: 'box', name: 'Nightstand', rect: [2888, 1487, 2913, 1511], h: 0.5, mat: 'wood' },
  { kind: 'box', name: 'Nightstand', rect: [2888, 1612, 2913, 1636], h: 0.5, mat: 'wood' },
  { kind: 'box', name: 'Bench — foot of the bed', rect: [3012, 1514, 3040, 1609], h: 0.45, mat: 'wood' },
  { kind: 'box', name: 'Low unit — EBEVEYN Y. ODASI', rect: [3142, 1422, 3179, 1643], h: 0.6, mat: 'cabinet' },
  { kind: 'tv',  name: 'TV — EBEVEYN Y. ODASI',  rect: [3172, 1526, 3178, 1597], h: 0.62, y: 1.05 },
  // EBEVEYN D.ODASI, now west of the shower room: wardrobes down the west
  // wall, across the north-west and along the south, as drawn. The north run
  // stands just off the wall so the parked slider leaf clears it. The owner's
  // glass-top island is kept, smaller, in the middle of the floor.
  { kind: 'wardrobe', name: 'Wardrobe — EBEVEYN D.ODASI (west)',  rect: [2888, 1652, 2925, 1800], back: 'W', lit: true },
  { kind: 'wardrobe', name: 'Wardrobe — EBEVEYN D.ODASI (north)', rect: [2925, 1656, 3006, 1688], back: 'N', lit: true },
  { kind: 'wardrobe', name: 'Wardrobe — EBEVEYN D.ODASI (south)', rect: [2925, 1772, 3058, 1800], back: 'S', lit: true },
  { kind: 'island',   name: 'Dressing island',                    rect: [2966, 1716, 3016, 1746] },
  // DUS W.C, now the east room: shower in the north-east, toilet on the
  // east wall, basin on the south.
  { kind: 'shower', name: 'DUS', rect: [3117, 1651, 3179, 1726] },
  { kind: 'toilet', rect: [3150, 1756, 3179, 1782], rot: 90 },
  { kind: 'basin',  rect: [3079, 1772, 3116, 1800], rot: 180 },

  // ────────────────────────────────── stair, descending to ZEMIN
  // MÜ: 18 (17x30) switchback: 18 risers of 17 cm make the 3.06 m storey.
  // Levels are relative to this floor's slab, so the flights run from -3.06 m
  // (the ground floor) up to the final riser at 0. Each flight is 8 treads of
  // 30 cm (DWG y 1515..1664) and 9 risers, the ninth onto the landing or the
  // slab. Flight 1 climbs south in the EAST column (against the living room
  // wall); flight 2 comes back north in the west one, beside the gallery, over
  // the ground floor's VESTIYER.
  { kind: 'stairs', name: 'Stair flight 1 (risers 1–9)',   rect: [2798, 1515, 2872, 1664], dir: 'S', steps: 8, riser: 0.17, from: -3.06 },
  { kind: 'box',    name: 'Stair half-landing',            rect: [2711, 1664, 2872, 1738], h: 1.53, y: -3.06, mat: 'counter' },
  // Open soffit: the VESTIYER is under the top of this flight.
  { kind: 'stairs', name: 'Stair flight 2 (risers 10–18)', rect: [2711, 1515, 2786, 1664], dir: 'N', steps: 8, riser: 0.17, from: -1.53, solid: false },
  // Korkuluk — the iron stair balustrade, on the owner's instruction. Path
  // points carry their own height here, so the rail rakes with the flight
  // while the balusters stay plumb (see `buildRailing`).
  //
  // The **west** edge, x 2710 (ground px 947), is the open one: no wall, open
  // to GIRIS HOLU and the gallery above. It carries the half-landing and
  // flight 2, so the balustrade runs round the landing's west edge at -1.53
  // and climbs flight 2 to its arrival. Flight 1 has the central wall on one
  // side and the living room's west wall on the other, so it takes a
  // wall-mounted handrail on the living room side instead.
  {
    kind: 'railing', name: 'Stair korkuluk (landing + flight 2)', h: 1.0,
    path: [[2710, 1738, -1.53], [2710, 1664, -1.36], [2710, 1515, -0.17]],
  },
  {
    kind: 'railing', name: 'Stair handrail (flight 1)', h: 1.0, wall: true,
    path: [[2869, 1515, -3.06], [2869, 1664, -1.70], [2869, 1738, -1.53]],
  },
  {
    // Flight 2's other side is the spine wall, which stops at this slab.
    kind: 'railing', name: 'Stair handrail (flight 2, spine side)', h: 1.0, wall: true,
    path: [[2783, 1664, -1.36], [2783, 1515, -0.17]],
  },

  // ────────────────────────────────── roof
  // Flat, as in the architect's SketchUp massing and renders: a thick render
  // slab over the balconies (the deep "frames" round them at the back) with a
  // parapet round its edge. The renders leave BALKON TERASI open to the sky —
  // the roof stops just past KAPALI TERAS's glazing — so it no longer stands
  // on posts out there. The master suite's panelled box rises higher than
  // the rest. Stacked only, so the side-by-side floor stays open from above;
  // `O` hides it.
  // Section A-A: the roof slab is 6.12..6.46 m, the parapet runs to 6.86.
  {
    kind: 'paving', name: 'Roof slab', mat: 'render', y: PLAN.storeyHeight, h: 0.34, roof: true, only: 'stacked',
    path: ROOF_OUTLINE,
  },
  {
    kind: 'paving', name: 'Roof parapet', mat: 'render', y: PLAN.floorToFloor, h: 0.4, roof: true, only: 'stacked',
    path: ROOF_OUTLINE, holes: [offsetOutline(ROOF_OUTLINE, -12)],
  },
  {
    kind: 'paving', name: 'Roof parapet — master suite', mat: 'render', y: PLAN.floorToFloor, h: 0.55, roof: true, only: 'stacked',
    path: MASTER_BOX, holes: [offsetOutline(MASTER_BOX, -12)],
  },

  // ────────────────────────────────── facade details from the renders
  // The master suite's box is clad in light grey panels with horizontal
  // joints on its street (south) and east faces and the short return beside
  // the stair window, standing proud of the ground floor like a cantilever.
  // They run from the band at the storey line (-0.34) to its taller parapet.
  // Strips are the 0.13 m outside the wall faces (centreline ± 7.4 px).
  // On the east face the cladding breaks for the band of high windows
  // (1.76..2.51 m, as the east elevation draws it).
  ...[
    ['south',  [2863, 1816.4, 3200.2, 1824.2], 'N', -0.34, 3.95, 4],
    ['east',   [3192.4, 1304.6, 3200.2, 1816.4], 'W', -0.34, 2.10, 2],
    ['east, above the windows', [3192.4, 1304.6, 3200.2, 1816.4], 'W', 2.51, 1.10, 1],
    ['return', [2863, 1754.4, 2870.6, 1816.4], 'E', -0.34, 3.95, 4],
  ].map(([side, rect, back, y, h, panels]) => (
    { kind: 'cladding', name: `Master suite — panel cladding (${side})`, rect, back, y, h, panels, only: 'stacked' }
  )),
  // The renders' "louvres" high on the side walls are the strip windows the
  // P.18 elevations draw (see the walls); the `louvre` maker is kept.
  // The middle bay between the two boxes at the back: a full-height pane
  // with a frameless glass Juliet balustrade outside it.
  {
    kind: 'railing', name: 'Juliet balustrade — 200/230', glass: true, h: 1.1,
    path: [[2734, 1405], [2858, 1405]],
  },

  // ────────────────────────────────── the P.16 balconies
  {
    kind: 'railing', name: 'BALKON (YATAK ODASI 1) — glass balustrade', glass: true, h: 1.1,
    path: [[2244, 911], [2461, 911]],
  },
  {
    kind: 'railing', name: 'BALKON (YATAK ODASI 2) — glass balustrade', glass: true, h: 1.1,
    path: [[2476, 911], [2693, 911]],
  },
  {
    kind: 'railing', name: 'EBEVEYN BALKON — glass balustrade', glass: true, h: 1.1,
    path: [[2885, 1316], [3176, 1316]],
  },
  // Two armchairs facing each other across a small table, as drawn.
  { kind: 'lounge', name: 'Balcony armchair (west)', rect: [2891, 1354, 2932, 1394], back: 'W', seats: 1 },
  { kind: 'lounge', name: 'Balcony armchair (east)', rect: [3014, 1354, 3055, 1394], back: 'E', seats: 1 },
  { kind: 'sidetable', name: 'Balcony table', rect: [2952, 1357, 2995, 1394] },

  // ────────────────────────────────── open edges
  // BALKON TERASI (14 m²) runs the width of KAPALI TERAS in front of its
  // glazed wall, out to y 1816. It stays open, for laundry; the renders give
  // it a frameless glass balustrade round both open sides.
  {
    kind: 'railing',
    name: 'BALKON TERASI balustrade',
    path: [[2170, 1669], [2170, 1816], [2566, 1816], [2566, 1755]],
    h: 1.1, glass: true,
  },
  {
    // Round the head of the void over GIRIS HOLU. Flight 2 arrives in the
    // west column, so that head is open; the east column's is the drop to the
    // foot of flight 1 and gets its own length of rail.
    kind: 'railing',
    name: 'GALERI BOSLUGU balustrade',
    path: [[2572, 1513], [2710, 1513]],
    h: 1.1,
  },
  {
    kind: 'railing',
    name: 'Stairwell head balustrade (over flight 1)',
    path: [[2798, 1513], [2872, 1513]],
    h: 1.1,
  },

  // ────────────────────────────────── balcony sconces
  // Owner's instruction: real light on BALKON TERASI. The only solid wall the
  // balcony has is the gallery's west exterior (centreline x 2562, face at
  // x 2555) where it passes the terrace, y 1669..1747 — the rest of the
  // balcony is the glazed front and its balustrade. Two washers on that face.
  ...[1691, 1726].map((cy) => (
    { kind: 'walllight', name: 'BALKON TERASI — wall light', rect: [2547, cy - 4, 2555, cy + 4], back: 'E', z: 2.0 }
  )),

  // ────────────────────────────────── ceilings and interior light
  // As the ground floor: a dropped perimeter band with a downlight in each
  // corner, per room, stacked model only. The two D.ODASI are the exception —
  // see below.
  ...[
    ['YATAK ODASI 1',      [2237, 990, 2468, 1252]],
    ['YATAK ODASI 2',      [2468, 990, 2704, 1211]],
    ['ORTAK W.C',          [2237, 1252, 2379, 1412]],
    ['ÇAMSIR ODASI',       [2175, 1416, 2382, 1540]],
    ['ANA KORIDOR',        [2382, 1423, 2870, 1513]],
    ['KAPALI TERAS',       [2175, 1540, 2562, 1666]],
    ['EBEVEYN Y.ODASI',    [2878, 1416, 3185, 1648]],
    ['DUS W.C',            [3061, 1648, 3185, 1809]],
  ].map(([name, rect]) => (
    { kind: 'coffer', name: `${name} — ceiling`, rect, only: 'stacked' }
  )),

  // The dressing rooms get one light in the middle of the ceiling instead of
  // a coffer, on the owner's instruction — they are small and walled with
  // wardrobe on three sides, and their runs are lit inside (`lit: true`).
  { kind: 'ceilinglight', name: 'Y.ODASI 2 D.ODASI — ceiling light', rect: [2592, 1297, 2622, 1327], only: 'stacked' },
  { kind: 'ceilinglight', name: 'EBEVEYN D.ODASI — ceiling light',   rect: [2976, 1715, 3006, 1745], only: 'stacked' },

  // The first floor's Cisco router, on the owner's instruction: on the
  // ceiling in the middle of ANA KORIDOR, with its own ceiling socket, as on
  // the ground floor.
  { kind: 'router', name: 'ANA KORIDOR — Cisco router (ceiling)', rect: [2616, 1462, 2636, 1474], only: 'stacked' },
];

export const FLOORS = [
  {
    id: 'ground',
    name: 'ZEMIN',
    label: 'Ground floor',
    crop: { ...ORIGIN },
    // The slab is the house only; outside it the terraces and lawn take over.
    outline: GROUND_FOOTPRINT,
    // The finished floor's height above this floor's container. The ground
    // floor's container is at grade, because the garden is built in it too
    // (the items marked `site: true`); the house stands 0.34 m up on its slab,
    // which main.js builds under the outline.
    level: PLAN.plinth,
    // The first floor sits on this one, so these walls run the full 3.06 m to
    // the underside of its slab rather than stopping at the 2.72 m clear
    // height. Walls with their own `height` (the front yard) are unaffected.
    wallTop: PLAN.floorToFloor,
    // Laminate parquet throughout, kitchens included. Only the W.C and the
    // stair keep the plain finish. Rects are approximate room interiors;
    // the walls hide the edges.
    // Plan symbols painted over with plain parquet: the removed armchairs and
    // console table, the removed three-seat sofa and the replaced sectional.
    erase: [
      [1196, 1439, 1378, 1490],
      [1186, 1531, 1354, 1599],
      [1126, 1605, 1354, 1791], // the sectional, and the sofa and table drawn beside it
    ],
    parquet: [
      [1123, 1423, 1414, 1801], // OTURMA ODASI
      [482, 999, 931, 1250],    // MUTFAK + dining
      [809, 1250, 933, 1369],   // dining alcove by the double door
      [484, 1255, 803, 1369], [484, 1369, 763, 1407],   // Y.MUTFAK KILER
      [809, 1376, 933, 1423], [769, 1376, 806, 1407],   // ANA KORIDOR
      [807, 1423, 1108, 1501],  // hall
      [807, 1501, 943, 1740],   // GIRIS HOLU
      [420, 1423, 791, 1581],   // ÇALIŞMA ODASI
      [420, 1588, 702, 1801],   // OYUN ODASI
      [702, 1588, 791, 1656],   // OYUN ODASI (north of the W.C)
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
    crop: { x: 2147, y: 890, w: 1060, h: 940 },
    parquet: [
      [2244, 997, 2461, 1248], // YATAK ODASI 1 (north of the ORTAK W.C)
      [2387, 1248, 2461, 1348], // YATAK ODASI 1 (strip east of the W.C, to its door)
      [2476, 997, 2697, 1355], // YATAK ODASI 2 + vestibule
      [2548, 1355, 2697, 1408], // Y.ODASI 2 D.ODASI (south part)
      [2389, 1358, 2540, 1423], // ANA KORIDOR (north strip, below the bedroom doors)
      [2389, 1423, 2870, 1513], // ANA KORIDOR, out to the head of the stair
      [2888, 1422, 3179, 1645], // EBEVEYN Y. ODASI
      [2888, 1651, 3058, 1800], // EBEVEYN D.ODASI
    ],
    // alignPx + crop.xy must equal ORIGIN.xy: main.js centres each floor's
    // slab on its container.
    alignPx: [-1763, 0],
    storey: 1,
    walls: FIRST_WALLS,
    objects: FIRST_OBJECTS,
    // The slab is clipped to the building's footprint (wall centrelines, the
    // balcony to its edge). Without it the whole crop (mostly empty paper)
    // hangs 3.4 m up in the stacked model and hides the ground-floor terrace.
    outline: FIRST_OUTLINE,
    // Openings cut clean through the slab: GALERI BOSLUGU and the stairwell
    // are one void. The stair comes up through it, arriving at the north edge,
    // and it has to clear the HALF-LANDING as well as the two flights (the
    // landing runs to y 1738): stopping at the flights left this slab as a
    // ceiling 1.20 m above the landing. It stops at 1738, just inside the south
    // wall's inner face, NOT on its centreline: walls are 2.72 m on a 3.06 m
    // floor-to-floor, so the 0.34 m band between them is filled by the slab
    // body alone. Run the void out to the wall and that band becomes an open
    // slot to the sky.
    voids: [
      {
        name: 'GALERI BOSLUGU + stair well',
        path: [[2570, 1513], [2872, 1513], [2872, 1738], [2570, 1738]],
      },
      {
        // The riser shaft, over the ground floor's ADT niche.
        name: 'Şaft (tesisat boşluğu)',
        path: [[2547, 1376], [2571.5, 1376], [2571.5, 1407], [2547, 1407]],
      },
    ],
  },
];

/**
 * Outward offset of a rectilinear polygon, in sheet px. Every edge in the floor
 * outlines is axis-aligned, so each offset edge meets its neighbour at a single
 * point: take x from the vertical edge and y from the horizontal one. The
 * shoelace sign gives the winding, and so which side is "out".
 */
export function offsetOutline(poly, d) {
  if (!d) return poly;
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % n];
    area += x0 * y1 - x1 * y0;
  }
  const s = Math.sign(area) || 1;
  const edges = poly.map((p, i) => {
    const q = poly[(i + 1) % n];
    const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
    const len = Math.hypot(dx, dy) || 1;
    return { x: p[0] + (dy / len) * s * d, y: p[1] + (-dx / len) * s * d, vertical: dx === 0 };
  });
  // Vertex i is where the offset of edge i-1 meets the offset of edge i.
  return poly.map((_, i) => {
    const a = edges[(i - 1 + n) % n];
    const b = edges[i];
    return a.vertical ? [a.x, b.y] : [b.x, a.y];
  });
}

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
  // to stay 3.40 m up or the flight would run below ground. A floor's own
  // finished level is plinth + storey · floorToFloor above the garden; its
  // container sits `level` below that (the ground floor's is at grade).
  const elevation = PLAN.plinth + floor.storey * PLAN.floorToFloor - (floor.level ?? 0);
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

function insidePoly([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Every opening that gets a motorised rolling shutter, on the owner's
 * instruction: each window and sliding door that faces outside. Which face is
 * outside is not in the wall data, so it is found from the floor's `outline`:
 * step away from the opening on both sides, 0.4 m to 3 m, and the side that
 * leaves the footprint first is out. A balcony slider counts — the balcony
 * (≤ 1.5 m deep) runs out before the room behind does — and a window between
 * two rooms, inside on both sides, does not.
 *
 * Returns `{ wall, opening, side, at, along }`: `side` is +1 when outside is
 * the wall's local +Z (the right of a → b on the page), `at` the opening's
 * middle and `along` its unit direction, both in sheet px. Shared by
 * buildWalls.js and the electrical drawing (`tools/electric-plan.py`).
 */
export function shutterOpenings(floor) {
  const out = [];
  if (!floor.outline) return out;
  const steps = [0.4, 1, 2, 3].map((m) => m / PLAN.metersPerPixel);
  for (const wall of floor.walls) {
    if (wall.site || wall.noShutters) continue;
    const [ax, ay] = wall.a;
    const [bx, by] = wall.b;
    const len = Math.hypot(bx - ax, by - ay);
    if (!len) continue;
    const u = [(bx - ax) / len, (by - ay) / len];
    const n = [-u[1], u[0]];                        // the right of a → b
    for (const opening of wall.openings ?? []) {
      if ((opening.kind !== 'window' && opening.kind !== 'sliding') || opening.shutter === false) continue;
      const t = (opening.from + opening.to) / 2;
      const at = [ax + u[0] * t, ay + u[1] * t];
      let side = 0;
      for (const d of steps) {
        const plus = !insidePoly([at[0] + n[0] * d, at[1] + n[1] * d], floor.outline);
        const minus = !insidePoly([at[0] - n[0] * d, at[1] - n[1] * d], floor.outline);
        if (plus !== minus) { side = plus ? 1 : -1; break; }
        if (plus && minus) break;                   // a free-standing wall
      }
      if (side) out.push({ wall, opening, side, at, along: u });
    }
  }
  return out;
}
