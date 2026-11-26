// Port Sable — original city layout for "Harborfall".
// Teal-and-amber coastal dusk identity: deep teal water/roofs, warm amber
// sandstone and lamplight. Road grid: streets every 40 units, 12 wide.
// Blocks sit between streets; each block holds up to 3 buildings (~70 total).
// The south edge (z > WORLD_BOUND) is Sable Beach + the harbour water.
// One block (north-east) is Lantern Park instead of buildings.

export const WORLD_BOUND = 118;
export const WATER_Z = 128; // water plane starts here (south)
export const ROAD_COORDS = [-100, -60, -20, 20, 60, 100];
export const ROAD_WIDTH = 12;
export const BLOCK_CENTERS = [-80, -40, 0, 40, 80];
export const PARK_BLOCK = { x: 80, z: -80 }; // Lantern Park
export const PIER_SPAWN = { x: 0, z: 112 };
export const HOSPITAL = { x: -100, z: 100 }; // respawn point (corner)
export const GARAGE = { x: -40, z: -34 }; // Lina's garage marker area (roadside)

export interface Building { x: number; z: number; width: number; depth: number; height: number; color: string; roof: string; district: string; glass?: boolean; }
export interface House { x: number; z: number; rot: number; color: string; roof: string; }
export const houses: House[] = [];
export interface TreeSpot { x: number; z: number; scale: number; }
export interface PropSpot { x: number; z: number; kind: "bench" | "hydrant" | "crate"; rot: number; }

// ================================================================
// Phase 6 — NORTHGATE + SABLE ISLAND. Northgate is a third district
// NORTH of Port Sable (north = −z), reached by a land causeway at
// x = −20 that runs under the PORT SABLE hillside sign. Landmass
// x ∈ [−118, 38], z ∈ [−296, −186]; grid roads along Z at
// x ∈ {−84, −52, −20}, along X at z ∈ {−216, −248, −280}.
// Sable Island sits in the bay (swim / boat): lighthouse + 2 houses.
// ================================================================
export const NORTH = { x0: -118, x1: 38, z0: -296, z1: -186 };
export const NORTH_ROAD_X = [-84, -52, -20];
export const NORTH_ROAD_Z = [-216, -248, -280];
export const CAUSEWAY = { x: -20, halfW: 9, z0: -196, z1: -110 };
export const ISLAND = { x: -64, z: 168, r: 17 };
export const inNorth = (x: number, z: number) => x >= NORTH.x0 && x <= NORTH.x1 && z >= NORTH.z0 && z <= NORTH.z1;
export const onCauseway = (x: number, z: number) => Math.abs(x - CAUSEWAY.x) <= CAUSEWAY.halfW && z >= CAUSEWAY.z0 && z <= CAUSEWAY.z1;
export const onIsland = (x: number, z: number) => (x - ISLAND.x) ** 2 + (z - ISLAND.z) ** 2 < ISLAND.r * ISLAND.r;
/** Northgate parking garage: open court (south half, y 0) + upper deck
 * (north half, y 3.1) reached by a ramp lane on the west edge. */
export const PARK_GARAGE = { x0: -80, x1: -56, z0: -276, z1: -252, deckH: 3.1, deckZ: -264, rampX0: -80, rampX1: -75, rampZTop: -268, rampZBot: -256 };
export const DEALERSHIP = { x: -36, z: -243, name: "Sable Motors Northgate" };
export const GUN_STORE = { x: 22.5, z: -226, name: "Sable Arms" }; // Phase 25: follows the store move
export const VENDOR = { x: 28.5, z: 12, name: "Harbour Wraps" }; // Market Row food stall (24h)
export const HOSPITAL_DOOR = { x: -97, z: 103 };
export const BUS_STOPS: { x: number; z: number }[] = [
  { x: 27.7, z: -30 }, { x: -67.7, z: 14 }, { x: 34, z: 63.5 }, // Phase 25: the Docks stop stood inside the (31,71) building; 63.5 is the z=60 kerb in front of its face
];
/** Cars the Northgate dealership sells (delivered to your garage). */
export const DEALER_CARS: { kind: "coupe" | "supercar" | "suv" | "wedge" | "hyper" | "gt" | "kestrel" | "bronto" | "tempest" | "mule"; color: string; price: number }[] = [
  { kind: "coupe", color: "#3f7fae", price: 4200 },
  { kind: "supercar", color: "#c22e2e", price: 9800 },
  { kind: "suv", color: "#2e4a5a", price: 3600 },
  // ---- Phase 8 exotics: original Harborfall designs (see CarBody) ----
  { kind: "gt", color: "#31556e", price: 12500 },
  { kind: "wedge", color: "#d99a3d", price: 25000 },
  { kind: "hyper", color: "#e8ecef", price: 40000 },
  // ---- Phase 18: two more originals. The Kestrel RS is dealer-only
  // (a track coupe — handling over headline speed); the Bronto Hauler
  // also stands at the farm (CAR_SPAWNS 32) for countryside work. ----
  { kind: "kestrel", color: "#c47b1e", price: 18000 },
  { kind: "bronto", color: "#5c6650", price: 9500 },
  // ---- Phase 28: the Tempest sits above the Kestrel RS (faster,
  // pricier, still below the wedge/hyper flagships); the Mule is
  // the cheapest work truck on the list — and stands at the farm
  // (CAR_SPAWNS 34) like the Bronto. ----
  { kind: "tempest", color: "#274b5e", price: 26000 },
  { kind: "mule", color: "#7a6a4f", price: 3200 },
];
/** Northgate mansion row (west edge, gated) — visuals in World.tsx. */
export const NORTH_MANSIONS: { x: number; z: number; color: string; roof: string }[] = [
  { x: -104, z: -200, color: "#ece7db", roof: "#2e3438" },
  // Phase 25: three of the row stood with a face inside the traffic
  // envelope of the z=−216 / −248 / −280 cross streets — those three
  // shift along the row (z −218→−225, −254→−258, −288→−290).
  { x: -104, z: -225, color: "#e2dccb", roof: "#7a3b2e" },
  { x: -104, z: -236, color: "#dfe8ee", roof: "#274b5e" },
  { x: -104, z: -258, color: "#efe3c2", roof: "#5d4a38" },
  { x: -104, z: -270, color: "#e8dfc8", roof: "#14524f" }, // Phase 25: was a 0.15u lane graze on z=−280
  { x: -104, z: -290, color: "#ece7db", roof: "#3c4147" },
];

// ================================================================
// Phase 25 — STREAMED DISTRICTS. A district that ships as a separate
// lazy bundle chunk registers its colliders + roads here when the
// player first travels to it (game/eastmere.ts dynamic-imports the
// chunk; the web server only sends that chunk on demand — the main
// download never carries the district's geometry). Until a district
// is loaded its land is open water and impassable; once loaded it
// stays loaded for the session. The eager bundle holds ONLY each
// district's bounds + causeway gate (needed by the map frame and by
// the boot guard in game/store.ts: a car saved inside an unloaded
// district is relocated to its gate, on the main map, at restore).
// ================================================================
/** An axis-aligned building collider (centre + half extents). */
export type Blocker = { x: number; z: number; hw: number; hd: number };
export interface StreamedDistrict {
  id: string; name: string;
  x0: number; x1: number; z0: number; z1: number;
  gate: { x: number; z: number; heading: number };
  loaded: boolean;
  blockers: Blocker[];
  roadX: number[]; roadZ: number[];
}
export const STREAMED_DISTRICTS: StreamedDistrict[] = [
  // Eastmere: east of Northgate across the z=−248 causeway.
  { id: "eastmere", name: "Eastmere", x0: 44, x1: 122, z0: -300, z1: -192, gate: { x: 34, z: -248, heading: Math.PI / 2 }, loaded: false, blockers: [], roadX: [], roadZ: [] },
  // Westbrook (Phase 26): west of the Ferry Quarter across the
  // harbour, where the z=20 road meets the west shore (mainland land
  // ends at x=−126). The gate sits on that shore road; the district
  // itself is open water until its chunk loads.
  { id: "westbrook", name: "Westbrook", x0: -196, x1: -130, z0: -28, z1: 70, gate: { x: -118, z: 20, heading: -Math.PI / 2 }, loaded: false, blockers: [], roadX: [], roadZ: [] },
  // Northreach (Phase 31): north of Northgate, continuing the
  // x=−20 road column across a short bridge from Northgate's north
  // shore (z=−296) to a clifftop headland. The gate sits on
  // Northgate land at the bridge mouth (the Eastmere/Westbrook
  // pattern — a restore point must stand on loaded land); the
  // district itself is open water until its chunk loads.
  { id: "northreach", name: "Northreach", x0: -72, x1: 32, z0: -368, z1: -304, gate: { x: -20, z: -294, heading: Math.PI }, loaded: false, blockers: [], roadX: [], roadZ: [] },
];
export function registerStreamedDistrict(id: string, data: { blockers: StreamedDistrict["blockers"]; roadX: number[]; roadZ: number[] }): void {
  const d = STREAMED_DISTRICTS.find((s) => s.id === id);
  if (!d || d.loaded) return;
  d.blockers = data.blockers; d.roadX = data.roadX; d.roadZ = data.roadZ; d.loaded = true;
}
export const inStreamed = (x: number, z: number): StreamedDistrict | null => {
  for (const d of STREAMED_DISTRICTS) if (d.loaded && x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d;
  return null;
};
/** Boot guard: the gate of an UNLOADED streamed district containing
 * (x, z), else null — a restore point inside a district whose chunk
 * has not loaded yet relocates to the gate (game/store.ts). */
export function streamedGateFor(x: number, z: number): { x: number; z: number; heading: number } | null {
  for (const d of STREAMED_DISTRICTS) if (!d.loaded && x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.gate;
  return null;
}

// District names (original): Docks (south), Market Row (centre),
// Lantern Park (NE), Gull Heights (north), Ferry Quarter (west), East Yards (east)
export function districtAt(x: number, z: number): string {
  const sd = inStreamed(x, z);
  if (sd) return sd.name;
  if (onIsland(x, z)) return "Sable Island";
  if (inNorth(x, z)) return "Northgate";
  if (z < -118 && onCauseway(x, z)) return "Northgate Causeway";
  if (z >= 190) return "Coral Shores";
  if (z > 118 && Math.abs(x - 60) < 18) return "Bay Bridge";
  if (z > 90) return "The Docks";
  if (x < -60) return "Ferry Quarter";
  if (x > 60 && z < -60) return "Lantern Park";
  if (z < -60) return "Gull Heights";
  if (x > 60) return "East Yards";
  return "Market Row";
}

/** Phase 25: blocks whose (0,10) spot carries a Downtown glass tower
 * (see the skyline section below) — declared before the generator so
 * the filler building on that spot can be suppressed. */
const TOWER_BLOCK_KEYS = new Set(["0,0", "-40,0", "40,0", "0,-40", "0,40", "-40,-40", "40,40", "-40,40", "40,-40"]);
const palette = ["#a06a42", "#b57e4e", "#77644c", "#8f5f3d", "#7d6248", "#a87c52", "#5f5142", "#4a6d7c", "#33617f", "#b25a38", "#cf9a4e", "#59754e", "#84505c", "#c2ab7d"];
const roofs = ["#14524f", "#0f4442", "#17605c", "#123f3e"];
export const buildings: Building[] = [];
export const trees: TreeSpot[] = [];
export const props: PropSpot[] = [];
export const lamps: [number, number, number][] = [];

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// Phase 25: generator road-clearance clamp. The seeded spots sit as
// close as 7u from a road centreline while rolled widths run to 14u,
// so unclamped faces spilled across the traffic lanes (a lane offset
// of 2.8u + a car half-width of 1.15u ≈ a 3.95u traffic envelope) —
// traffic drove through building corners, and several parked-car
// spots sat inside the boxes. Every generated / hand-placed box now
// keeps its faces ≥ 4.05u from every centreline of its own grid.
// Positions, heights, colours and the rnd() stream are untouched —
// only an oversize width/depth shrinks (audit: tools/audit-placements).
const ROAD_CLEAR = 4.05;
function clampDim(centre: number, size: number, lines: number[]): number {
  let s = size;
  for (const c of lines) {
    const maxHalf = Math.abs(centre - c) - ROAD_CLEAR;
    if (maxHalf < s / 2) s = Math.max(3, 2 * maxHalf);
  }
  return s;
}

for (const bx of BLOCK_CENTERS) {
  for (const bz of BLOCK_CENTERS) {
    const isPark = bx === PARK_BLOCK.x && bz === PARK_BLOCK.z;
    if (isPark) {
      for (let i = 0; i < 10; i++) trees.push({ x: bx - 14 + rnd() * 28, z: bz - 14 + rnd() * 28, scale: 0.9 + rnd() * 0.5 });
      continue;
    }
    const spots: [number, number][] = [[-9, -9], [9, -9], [0, 10]];
    for (const [ox, oz] of spots) {
      if (bx === -80 && bz === 80 && ox === 0 && oz === 10) continue; // mansion plot (SW block)
      // Phase 25: spots that carry a DESIGNED structure instead of a
      // filler block — the Downtown glass towers stand on the (0,10)
      // spots of their blocks, and the Ferry Quarter suburb houses
      // stand on the (9,−9) spots of the west-edge blocks. The
      // generated building there interpenetrated the designed one
      // (audit OVERLAP findings), so it is suppressed — but its rnd
      // rolls are still consumed in the same order, so every other
      // building in the city keeps its exact size and colour.
      const suppressed =
        (ox === 0 && oz === 10 && TOWER_BLOCK_KEYS.has(`${bx},${bz}`)) ||
        (bx === -80 && ox === 9 && oz === -9);
      if (rnd() < 0.12) {
        if (suppressed) rnd(); else trees.push({ x: bx + ox, z: bz + oz, scale: 0.8 + rnd() * 0.4 });
        continue;
      }
      const w = clampDim(bx + ox, 9 + rnd() * 5, ROAD_COORDS), d = clampDim(bz + oz, 9 + rnd() * 5, ROAD_COORDS);
      const height = 8 + rnd() * 26;
      const color = palette[Math.floor(rnd() * palette.length)];
      const roof = roofs[Math.floor(rnd() * roofs.length)];
      if (!suppressed) buildings.push({
        x: bx + ox, z: bz + oz, width: w, depth: d,
        height, color, roof,
        district: districtAt(bx, bz),
      });
    }
    // sidewalk props on block corners
    props.push({ x: bx - 15, z: bz - 15, kind: "bench", rot: rnd() * 3 });
    props.push({ x: bx + 15, z: bz + 15, kind: "hydrant", rot: 0 });
    if (bz > 60) props.push({ x: bx + 12, z: bz - 15, kind: "crate", rot: rnd() });
  }
}
// ================================================================
// Phase 4 — Coral Shores: a second small city across the bay, joined
// to Port Sable by the (now drivable) Bay Bridge causeway at x = 60.
// Own grid: roads along X at z ∈ {224, 264, 304}, along Z at
// x ∈ {40, 72, 104}; landmass x ∈ [28, 112], z ∈ [196, 324].
// ================================================================
export const BRIDGE = { x: 60, halfW: 5, z0: 116, z1: 208, deckH: 5.5, ramp: 26, rampN: 14 };
export const CORAL = { x0: 28, x1: 112, z0: 196, z1: 324 };
export const CORAL_ROAD_X = [40, 72, 104];
export const CORAL_ROAD_Z = [224, 264, 304];

/** Ground height — 0 except the bridge causeway profile and the
 * Northgate parking-garage deck/ramp (Phase 6). */
export function groundYAt(x: number, z: number): number {
  const pg = PARK_GARAGE;
  if (x >= pg.x0 && x <= pg.x1 && z >= pg.z0 && z <= pg.z1) {
    if (x >= pg.rampX0 && x <= pg.rampX1 && z >= pg.rampZTop && z <= pg.rampZBot) {
      const s = Math.max(0, Math.min(1, (pg.rampZBot - z) / (pg.rampZBot - pg.rampZTop)));
      return pg.deckH * s * s * (3 - 2 * s); // smoothstep ramp, same idiom as the bridge
    }
    if (z <= pg.deckZ) return pg.deckH;
    return 0;
  }
  if (Math.abs(x - BRIDGE.x) > BRIDGE.halfW + 1.6) return 0;
  const south = (z - (BRIDGE.z0 - BRIDGE.ramp)) / BRIDGE.ramp; // 0→1 up the south ramp
  const north = ((BRIDGE.z1 + BRIDGE.rampN) - z) / BRIDGE.rampN; // 1→0 down the shorter north ramp (lands before Coral's z=224 road)
  const s = Math.max(0, Math.min(1, Math.min(south, north)));
  return BRIDGE.deckH * s * s * (3 - 2 * s); // smoothstep ramps
}
export const onBridge = (x: number, z: number) => groundYAt(x, z) > 0.05;
export const inCoral = (x: number, z: number) => x >= CORAL.x0 && x <= CORAL.x1 && z >= CORAL.z0 && z <= CORAL.z1;
/** Phase 10: driving surface under a point — the C++ vehicle step's
 * grip multiplier starts here (weather folds in at the call site).
 *   asphalt 1.0 · dirt (Sable Downs loop) 0.72 · grass infield 0.8 ·
 *   sand (Lantern Beach band + Sable Island) 0.55 */
export type SurfaceKind = "asphalt" | "dirt" | "grass" | "sand";
/** Phase 15: the Sable Downs farm road network — three dirt roads off
 * the Phase 9 ring (west to the farmstead, north to the farmhouse,
 * south to the z=−40 road), so the countryside corner is a small
 * connected network, not a lone loop. Rectangles (centre + size);
 * surfaceKindAt returns dirt on them (grip 0.72 via step_vehicle_v3),
 * World.tsx draws them, App draws them on the maps. */
export const FARM_ROADS: { x: number; z: number; w: number; d: number }[] = [
  { x: -106.5, z: -78, w: 21, d: 6 },  // west: ring → farmstead + crop field
  { x: -78, z: -106.5, w: 6, d: 21 },  // north: ring → farmhouse
  // south spur: ring → the block edge at z≈−39.5, where open corner
  // ground (drivable, asphalt grip) carries you around the corner
  // houses to the z=−20 road. Phase 16 audit fix: Phase 15's comment
  // cited a "z=−40 city road" that does not exist (ROAD_COORDS has
  // no −40), and a Ferry Quarter house clipped the spur's east edge —
  // the spur now sits at x=−79.5, clear of it. It cannot run further
  // north as dirt: a house stands at (−80, −30) on that line.
  { x: -79.5, z: -49, w: 6, d: 19 },   // south spur: ring → block edge
];
// Phase 25: the farmstead stood in the NW corner's traffic envelope —
// the barn's SE corner and the farmhouse's faces clipped cars turning
// the x=−100 / z=−100 corner. Barn → (−110,−108), farmhouse →
// (−92,−108.5) (faces ≥ 4.8u from both centrelines), and the crop
// field narrows so its tufts stay out of the x=−100 west lane.
export const FARM = { barn: { x: -110, z: -108 }, house: { x: -92, z: -108.5 }, field: { x: -110, z: -91.5, w: 11, d: 9 } };
export function surfaceKindAt(x: number, z: number): SurfaceKind {
  for (const r of FARM_ROADS) if (Math.abs(x - r.x) <= r.w / 2 && Math.abs(z - r.z) <= r.d / 2) return "dirt";
  const dd = Math.hypot(x + 78, z + 78); // Sable Downs ring, centre (−78, −78)
  if (dd >= 13 && dd <= 20.5) return "dirt";
  if (dd < 13) return "grass";
  if (onIsland(x, z)) return "sand";
  if (z >= 113 && z <= WATER_Z + 2 && Math.abs(x) <= WORLD_BOUND && !onBridge(x, z)) return "sand";
  return "asphalt";
}
export function surfaceGripBase(x: number, z: number): number {
  switch (surfaceKindAt(x, z)) {
    case "dirt": return 0.72;
    case "grass": return 0.8;
    case "sand": return 0.55;
    default: return 1.0;
  }
}

/** Open water (swimmable; blocks cars). Land = Port Sable shore, Coral landmass, or the bridge deck. */
export function isWaterAt(x: number, z: number): boolean {
  if (onBridge(x, z)) return false;
  if (z <= WATER_Z && Math.abs(x) <= WORLD_BOUND + 8 && z >= -WORLD_BOUND - 8) return false; // Port Sable land
  if (inCoral(x, z)) return false;
  if (inNorth(x, z) || onCauseway(x, z) || onIsland(x, z)) return false; // Phase 6 land
  if (inStreamed(x, z)) return false; // Phase 25: a loaded streamed district is land
  return true;
}

// Coral Shores buildings — same generator idiom as Port Sable blocks.
for (const bx of [56, 88]) {
  for (const bz of [244, 284]) {
    const spots: [number, number][] = [[-9, -9], [9, -9], [-9, 9], [9, 9]];
    for (const [ox, oz] of spots) {
      // Phase 25: three spots carry a Coral glass tower (below) — the
      // filler building stood at the tower's exact centre. Suppressed
      // with its rnd rolls still consumed (same stream discipline as
      // the main grid).
      const suppressed =
        (bx === 56 && bz === 244 && ox === -9 && oz === -9) ||
        (bx === 88 && bz === 244 && ox === 9 && oz === 9) ||
        (bx === 56 && bz === 284 && ox === 9 && oz === -9);
      if (rnd() < 0.1) {
        if (suppressed) rnd(); else trees.push({ x: bx + ox, z: bz + oz, scale: 0.8 + rnd() * 0.4 });
        continue;
      }
      const w = clampDim(bx + ox, 9 + rnd() * 5, CORAL_ROAD_X), d = clampDim(bz + oz, 9 + rnd() * 5, CORAL_ROAD_Z);
      const height = 8 + rnd() * 22;
      const color = palette[Math.floor(rnd() * palette.length)];
      const roof = roofs[Math.floor(rnd() * roofs.length)];
      if (!suppressed) buildings.push({
        x: bx + ox, z: bz + oz, width: w, depth: d,
        height, color, roof,
        district: "Coral Shores",
      });
    }
    props.push({ x: bx - 11, z: bz - 11, kind: "bench", rot: rnd() * 3 });
    props.push({ x: bx + 11, z: bz + 11, kind: "hydrant", rot: 0 });
  }
}
// waterfront row facing the bridge landing + 4 glass towers.
// Phase 25: this row was a sandwich of interpenetration — the houses
// (z=214, depth 7) overlapped the Phase 7 shop row (z=218) by ~3u,
// the end houses sat ON the x=40 / x=104 centrelines, and the shop
// registers/doors at z=213.2 stood inside the houses. The row now
// sits north at z=206 on the promenade (shops at z=216.5, doors in
// the gap), the end houses move inboard (x=52 / x=96), and the east
// house's width is fixed at 7 so its face clears the x=104 line
// (its rnd roll is still consumed — the stream is unchanged).
for (const [wx, wFix] of [[48, 0], [84, 0], [96, 7]] as [number, number][]) { // (west house at x=48: at 52 its east face reached under the Bay Bridge deck)
  const rolled = 10 + rnd() * 3;
  buildings.push({ x: wx, z: 206, width: wFix > 0 ? wFix : clampDim(wx, rolled, CORAL_ROAD_X), depth: 7, height: 9 + rnd() * 10, color: palette[Math.floor(rnd() * palette.length)], roof: roofs[Math.floor(rnd() * roofs.length)], district: "Coral Shores" });
}
[[47, 235], [97, 253], [65, 275], [88, 293]].forEach(([tx, tz], i) => {
  buildings.push({ x: tx, z: tz, width: clampDim(tx, 11, CORAL_ROAD_X), depth: clampDim(tz, 11, CORAL_ROAD_Z), height: 36 + ((i * 5) % 13), color: "#3d7296", roof: "#274b5e", district: "Coral Shores", glass: true });
});
// Phase 37: THE BENCH — a plain promenade bench on the Coral
// waterfront at (72, 200.3), in the gap between the waterfront
// houses, facing north across the bay toward the city and the Bay
// Bridge (deck at x=60). It is the Quiet Harbour finale's meeting
// point; once that arc completes, a brass plaque appears on it
// (components/QuietHarbour.tsx renders the plaque from
// M.side.quiet — the bench itself is permanent world furniture).
props.push({ x: 72, z: 200.3, kind: "bench", rot: Math.PI });
// Coral street lamps along its roads
for (const c of CORAL_ROAD_X) for (let t = 206; t <= 318; t += 24) lamps.push([c + 7, 0, t], [c - 7, 0, t]);
for (const c of CORAL_ROAD_Z) for (let t = 34; t <= 108; t += 24) lamps.push([t, 0, c + 7], [t, 0, c - 7]);

// ================================================================
// Phase 6 — Northgate generation: luxury blocks between the grid
// roads. Blocks B (dealership) and C (parking garage) are custom
// structures (world data below + World.tsx), so generation skips
// them; block E is the hotel. Island houses join `houses`.
// ================================================================
for (const [bx, bz] of [[-68, -232], [-36, -264], [9, -264]] as [number, number][]) {
  const spots: [number, number][] = [[-9, -9], [9, -9], [-9, 9], [9, 9]];
  for (const [ox, oz] of spots) {
    if (rnd() < 0.08) { trees.push({ x: bx + ox, z: bz + oz, scale: 0.8 + rnd() * 0.4 }); continue; }
    const w = clampDim(bx + ox, 9 + rnd() * 5, NORTH_ROAD_X), d = clampDim(bz + oz, 9 + rnd() * 5, NORTH_ROAD_Z);
    buildings.push({
      x: bx + ox, z: bz + oz, width: w, depth: d,
      height: 10 + rnd() * 20,
      color: palette[Math.floor(rnd() * palette.length)],
      roof: roofs[Math.floor(rnd() * roofs.length)],
      district: "Northgate",
    });
  }
  props.push({ x: bx - 11, z: bz - 11, kind: "bench", rot: rnd() * 3 });
  props.push({ x: bx + 11, z: bz + 11, kind: "hydrant", rot: 0 });
}
// Hotel Northgate (block E) + the Sable Motors showroom block
buildings.push({ x: 9, z: -236, width: 20, depth: 11, height: 17, color: "#c2ab7d", roof: "#12303f", district: "Northgate" });
// Phase 25: the annex stood at z=−221 with its south face 1u from the
// z=−216 centreline — inside the traffic lanes. It moves north to
// z=−225.5 (face −221.5, clear of the envelope; its north face sits
// 1u south of the hotel's south face, no overlap).
buildings.push({ x: 9, z: -225.5, width: 14, depth: 8, height: 11, color: "#a87c52", roof: "#14524f", district: "Northgate" });
buildings.push({ x: -36, z: -226, width: 17, depth: 9, height: 6.5, color: "#4a6d7c", roof: "#274b5e", district: "Northgate" });
// Sable Island cottages (rendered by the shared houses builder)
houses.push({ x: -70, z: 162, rot: 0.4, color: "#e6ddcb", roof: "#8a4a3a" });
houses.push({ x: -58, z: 176, rot: -0.7, color: "#cfdde8", roof: "#4a5a6a" });
// Northgate lamps + palms (boulevard rows along the x = −20 spine)
for (const c of NORTH_ROAD_X) for (let t = -288; t <= -194; t += 24) lamps.push([c + 7, 0, t], [c - 7, 0, t]);
for (const c of NORTH_ROAD_Z) for (let t = -110; t <= 30; t += 24) lamps.push([t, 0, c + 7], [t, 0, c - 7]);


// ---- Downtown skyline: tall glass towers on free spots of central blocks
// (generated building spots are (-9,-9), (9,-9), (0,10); towers use (9,10)).
const towerBlocks: [number, number][] = [[0, 0], [-40, 0], [40, 0], [0, -40], [0, 40], [-40, -40], [40, 40], [-40, 40], [40, -40]];
towerBlocks.forEach(([bx, bz], i) => {
  buildings.push({
    x: bx + 9, z: bz + 10, width: clampDim(bx + 9, 11, ROAD_COORDS), depth: clampDim(bz + 10, 11, ROAD_COORDS),
    height: 34 + ((i * 7) % 21), // 34–54u
    color: "#3d7296", roof: "#274b5e", district: "Downtown", glass: true,
  });
});
// ---- Suburbs (west edge, Ferry Quarter): low houses with lawns/driveways.
// Phase 25: both rows stood with a face inside the traffic envelope
// of the x=−100 / x=−60 roads (faces 2.9u / 3.9u from the centrelines)
// — the rows move inboard to x=−91.5 / x=−68.5 (faces ≥ 5.4u clear).
for (const bz of [-40, 0, 40]) {
  houses.push({ x: -80 + 11.5, z: bz + 6, rot: -Math.PI / 2, color: "#e6ddcb", roof: "#8a4a3a" });
  houses.push({ x: -80 - 32, z: bz + 12, rot: Math.PI / 2, color: "#cfdde8", roof: "#4a5a6a" }); // Phase 25: west row to x=−112 — at −91.5 it interpenetrated the generated Ferry Quarter blocks; −112 fronts the x=−100 road's west side, clear of both
  houses.push({ x: -80 + 11.5, z: bz - 13, rot: -Math.PI / 2, color: "#efe3c2", roof: "#6a7a4a" });
}
// ---- Palm trees: beach row + harbour boulevard (visual only, thin trunks
// are excluded from isBlocked so they never trap the player)
export const palms: { x: number; z: number; scale: number; lean: number }[] = [];
// Phase 6: Northgate boulevard palms + Sable Island palms
for (let t = -286; t <= -196; t += 19) { palms.push({ x: -27.6, z: t, scale: 0.95 + rnd() * 0.3, lean: (rnd() - 0.5) * 0.2 }); palms.push({ x: -12.4, z: t + 9, scale: 0.9 + rnd() * 0.3, lean: (rnd() - 0.5) * 0.2 }); }
palms.push({ x: -58, z: 158, scale: 1.05, lean: 0.14 }, { x: -71, z: 180, scale: 0.95, lean: -0.12 });
// Coral palms: boulevard rows + beach row
for (let x = 34; x <= 110; x += 19) { palms.push({ x, z: 217.5, scale: 0.95 + rnd() * 0.3, lean: (rnd() - 0.5) * 0.2 }); palms.push({ x: x + 8, z: 230.5, scale: 0.9 + rnd() * 0.3, lean: (rnd() - 0.5) * 0.2 }); }
for (let x = 33; x <= 108; x += 16) palms.push({ x, z: 201, scale: 1 + rnd() * 0.35, lean: (rnd() - 0.5) * 0.22 });
for (let x = -105; x <= 105; x += 21) palms.push({ x, z: 117.5, scale: 0.95 + rnd() * 0.35, lean: (rnd() - 0.5) * 0.24 });
for (let z = -58; z <= 58; z += 29) { palms.push({ x: 27.6, z, scale: 0.9 + rnd() * 0.3, lean: (rnd() - 0.5) * 0.2 }); palms.push({ x: -27.6, z: z + 14, scale: 0.9 + rnd() * 0.3, lean: (rnd() - 0.5) * 0.2 }); }
palms.push({ x: 14, z: 116, scale: 1.15, lean: 0.12 }, { x: -14, z: 116, scale: 1.1, lean: -0.1 });
for (let x = -100; x <= 100; x += 25) { palms.push({ x: x + 6, z: 92.4, scale: 1.3 + rnd() * 0.3, lean: (rnd() - 0.5) * 0.16 }); palms.push({ x: x - 6, z: 107.6, scale: 1.3 + rnd() * 0.3, lean: (rnd() - 0.5) * 0.16 }); }

// street trees + lamps along roads
for (const c of ROAD_COORDS) {
  for (let t = -110; t <= 110; t += 22) {
    // Phase 25: the old guard let t=±22 through — those trees stood
    // 2u from a cross-road centreline, IN the cross street. A street
    // tree now also keeps 6u from every cross centreline.
    if (Math.abs(t % 40) > 4 && !ROAD_COORDS.some((rc) => Math.abs(t - rc) < 6)) { trees.push({ x: c - 8, z: t, scale: 0.75 + rnd() * 0.3 }); }
    lamps.push([c + 7, 0, t + 11], [c - 7, 0, t + 11]);
  }
}
// beach palms
for (let x = -105; x <= 105; x += 15) trees.push({ x, z: 120 + rnd() * 4, scale: 1 + rnd() * 0.4 });

export function isOnRoad(x: number, z: number): boolean {
  if (onBridge(x, z)) return true;
  const sd = inStreamed(x, z);
  if (sd) return sd.roadX.some((c) => Math.abs(x - c) < ROAD_WIDTH / 2) || sd.roadZ.some((c) => Math.abs(z - c) < ROAD_WIDTH / 2);
  if (inCoral(x, z)) return CORAL_ROAD_X.some((c) => Math.abs(x - c) < ROAD_WIDTH / 2) || CORAL_ROAD_Z.some((c) => Math.abs(z - c) < ROAD_WIDTH / 2);
  if (inNorth(x, z) || onCauseway(x, z)) return NORTH_ROAD_X.some((c) => Math.abs(x - c) < ROAD_WIDTH / 2) || NORTH_ROAD_Z.some((c) => Math.abs(z - c) < ROAD_WIDTH / 2) || onCauseway(x, z);
  return ROAD_COORDS.some((c) => Math.abs(x - c) < ROAD_WIDTH / 2 || Math.abs(z - c) < ROAD_WIDTH / 2);
}

export const MANSION = { x: -80, z: 90 }; // luxury house, SW block (plot cleared above)

// ---- Phase 2: fuel stations (drive in slow, tank refills for cash) ----
export interface FuelStation { x: number; z: number; name: string; }
export const FUEL_STATIONS: FuelStation[] = [
  { x: 27.5, z: 100, name: "Docks Fuel" },
  { x: -53.5, z: -27, name: "Ferry Quarter Fuel" },
  { x: 66, z: 47, name: "East Yards Fuel" },
  { x: 101, z: 227, name: "Coral Shores Fuel" }, // Phase 25: pumps clipped the (97,235) tower's corner
];

// ---- Phase 4: theft + garage data points --------------------------------
export const PAWN_SHOP = { x: 88, z: 211.7, name: "Coral Pawn" }; // fence counter, Coral Shores (Phase 25: promenade gap, was 213.2)
export interface RegisterPoint { id: string; name: string; x: number; z: number; }
export const REGISTERS: RegisterPoint[] = [
  { id: "mart", name: "Sable Mart", x: 15.5, z: 33 }, // Phase 25: counter stood inside the (9,31) building's east wall
  { id: "goods", name: "Harbour Goods", x: -24.5, z: 13.5 }, // Phase 25: counter was UNREACHABLE inside the (−31,10) building; now at its east face on the x=−20 kerb
  { id: "grocer", name: "Lantern Groceries", x: 41, z: -13.5 }, // Phase 25: counter was inside the (49,−9) building; now in the plaza west of it
  { id: "coral", name: "Coral Shores Goods", x: 48, z: 211.7 }, // Phase 25: counter in the promenade gap between the house row (z=206) and the shop row (z=216.5)
];
export interface GarageZone { id: "villa" | "lina"; label: string; x: number; z: number; r: number; exitX: number; exitZ: number; exitHeading: number; }
export const GARAGE_ZONES: GarageZone[] = [
  { id: "villa", label: "Villa Garage", x: MANSION.x + 4.4, z: MANSION.z + 5.2, r: 6.5, exitX: -75.6, exitZ: 96, exitHeading: 0 },
  { id: "lina", label: "Lina's Garage", x: -25, z: 102.5, r: 7.5, exitX: -25, exitZ: 95.5, exitHeading: 0 }, // Phase 25: zone centre follows the strip move (face now at z=105)
];
/** Canonical model names + display stats per car kind (garage UI). */
export const CAR_MODELS: Record<CarSpawn["kind"], { name: string; topSpeed: number; handling: number }> = {
  sedan: { name: "Meridian Sedan", topSpeed: 152, handling: 62 },
  hatch: { name: "Pico Hatch", topSpeed: 134, handling: 58 },
  pickup: { name: "Harbor Hauler", topSpeed: 140, handling: 48 },
  van: { name: "Ferry Van", topSpeed: 128, handling: 42 },
  coupe: { name: "Coral Coupe", topSpeed: 182, handling: 74 },
  supercar: { name: "Gullwing GT", topSpeed: 238, handling: 88 },
  muscle: { name: "Yardbird V8", topSpeed: 198, handling: 55 },
  suv: { name: "Ferry Rover", topSpeed: 160, handling: 52 },
  classic: { name: "Dune Classic '74", topSpeed: 150, handling: 50 },
  motorcycle: { name: "Sable Stinger", topSpeed: 208, handling: 82 },
  // ---- Phase 6 fleet additions ----
  bus: { name: "Sable Cityliner", topSpeed: 96, handling: 35 },
  taxi: { name: "Sable Cab", topSpeed: 150, handling: 60 },
  bicycle: { name: "Shoreline Cruiser", topSpeed: 28, handling: 70 },
  boat: { name: "Sable Skiff 240", topSpeed: 88, handling: 55 },
  // ---- Phase 8 exotics + wrecker (original designs; collision radius
  // 1.6 for wedge/hyper/gt per VISUAL_AUDIT Phase 8 addendum) ----
  wedge: { name: "Vantara S", topSpeed: 262, handling: 90 },
  hyper: { name: "Kestrel One", topSpeed: 288, handling: 92 },
  gt: { name: "Marlowe GT", topSpeed: 224, handling: 76 },
  tow: { name: "Sable Wrecker", topSpeed: 132, handling: 46 },
  // ---- Phase 9: second boat class + the flyable prop plane ----
  skiff: { name: "Harbour Fisher 180", topSpeed: 58, handling: 48 },
  plane: { name: "Sable Sparrow", topSpeed: 210, handling: 40 },
  // ---- Phase 18 originals: the Kestrel RS trades headline speed for
  // the sharpest steering in the range; the Bronto is all torque —
  // slow on tarmac, and the only car whose grip IMPROVES on dirt
  // (Vehicle applies the bonus on the surface path). ----
  kestrel: { name: "Sable Kestrel RS", topSpeed: 216, handling: 86 },
  bronto: { name: "Bronto Hauler", topSpeed: 126, handling: 50 },
  // ---- Phase 28 originals: the Tempest is Vantara's flagship GT —
  // a step above the Kestrel RS in speed and price (it joins the
  // wedge/hyper post-step push club in Vehicle.tsx), rear-drive and
  // drift-happy. The Mule is the farm's cheap workhorse: the best
  // dirt grip of any pickup, geared slow for the road. ----
  tempest: { name: "Vantara Tempest", topSpeed: 232, handling: 84 },
  // Phase 48: the VANTARA SOVEREIGN — the Harbour Crown finale's
  // legendary reward. One of one: never sold (no DEALER_CARS
  // entry), never a world spawn, never traffic — it exists only
  // as an owned car delivered through the garage (game/crown.ts).
  // Top-tier in the existing stat system, honestly under the
  // hyper's 288/92: the Tempest's grand-touring elder, not a
  // hypercar.
  sovereign: { name: "Vantara Sovereign", topSpeed: 268, handling: 91 },
  mule: { name: "Sable Mule", topSpeed: 118, handling: 46 },
  // ---- Phase 32: the service fleet — never sold, never traffic,
  // never stored. The ambulance and the fire truck exist only as
  // job vehicles (game/jobs.ts spawns them on the rental discipline
  // for a paramedic / firefighter shift). Display stats describe
  // the capped road pace Vehicle.tsx enforces, not the shared
  // physics ceiling. ----
  ambulance: { name: "Sable Medic Van", topSpeed: 150, handling: 52 },
  firetruck: { name: "Sable Fire Tender", topSpeed: 118, handling: 40 },
};
// ---- Phase 2: hillside scenic overlook (final mood-board image) ----
export const OVERLOOK = { x: -102, z: -114 };

// ---- Phase 3: solid scenery buildings that are not in the generated
// `buildings` array (garage exterior + Club Solace) ----
export const STATIC_BLOCKERS: { x: number; z: number; hw: number; hd: number }[] = [
  { x: -25, z: 109.1, hw: 6.1, hd: 4.1 }, // Lina's Garage exterior (Docks frontage) — Phase 25: strip moved +2.6 south, fronts clear of the z=100 lanes
  { x: 44, z: 117, hw: 7.6, hd: 4.6 },   // Club Solace exterior
  { x: 48, z: 216.5, hw: 5, hd: 3.4 },   // Coral Shores Goods (register shop) — Phase 25: row moved north, south face clear of the z=224 lanes
  { x: 88, z: 216.5, hw: 5, hd: 3.4 },   // Coral Pawn shop (Phase 25: same row move)
  // ---- Phase 7 frontages (World.tsx Phase7Frontages) ----
  { x: -64, z: 109.1, hw: 6.1, hd: 4.1 },  // Harbour Patrol HQ (police interior door) (Phase 25: strip move)
  { x: -80, z: 109.1, hw: 5.5, hd: 4.1 },  // Phase 32: Sable Fire Station (Docks strip, between the hospital lot and HQ — same slab geometry as its neighbours; door point on the z=103.2 line)
  { x: 88, z: 109.1, hw: 6.1, hd: 4.1 },   // Sable Clinic (clinic interior door) (Phase 25: strip move)
  { x: 8, z: 109.1, hw: 5, hd: 4.1 },      // Phase 13: Café Coral (Docks strip, cafe interior door) (Phase 25: strip move)
  { x: 60, z: 109.1, hw: 5, hd: 4.1 },     // Phase 30: the Docks warehouse unit (buyable rental — Unit 7, Sable Lets) — same strip geometry as its neighbours; door point on the z=103.2 line
  { x: 64, z: 216.5, hw: 5, hd: 3.4 },     // Marina Table restaurant (Coral) (Phase 25: same row move)
  { x: 36, z: 216.5, hw: 4, hd: 3.4 },     // Coral Shores Apartment block (Phase 25: same row move)
  { x: -43.25, z: -220.72, hw: 4.25, hd: 0.7 }, // Northgate Car Wash hall front — Phase 25: the hall straddled the z=−216 lane and could not deepen north (the showroom is there); it is now a slim front in the gap between the lane sweep and the showroom face (the drive-through arch stays on the kerb)
  // ---- Phase 9: Port Sable Airport scenery is solid now (the apron is
  // a playable area — terminal, tower and the parked airliner block) ----
  { x: 114.5, z: 46, hw: 7.5, hd: 4.5 },  // airport terminal
  { x: 113, z: 28, hw: 1.5, hd: 1.5 },    // control tower
  { x: 124, z: -42, hw: 2.2, hd: 8 },     // parked airliner on the apron
  // ---- Phase 6 ----
  { x: 27, z: -226, hw: 3.5, hd: 5.5 },  // Sable Arms gun store (Northgate) — Phase 25: moved north, its south portion stood in the z=−216 lane
  { x: -52, z: 158, hw: 1.7, hd: 1.7 },  // Sable Island lighthouse
  // ---- Phase 14 frontages (World.tsx Phase14Frontages) ----
  { x: 70, z: -70, hw: 5.5, hd: 3 },     // Sable Fitness pavilion, Lantern Park — Phase 25: moved east, its west face crossed the x=60 road's centreline
  { x: -68, z: -200, hw: 6, hd: 4 },     // Northgate Loft building
  // ---- Phase 15: Sable Downs farmstead (World.tsx farm group) ----
  { x: -110, z: -108, hw: 4.2, hd: 3.2 }, // the barn (Phase 25: moved with FARM.barn)
  { x: -92, z: -108.5, hw: 3.6, hd: 3 },  // the farmhouse (Phase 25: moved with FARM.house)
  // parking-garage perimeter walls: they seal the under-deck bays at
  // ground level AND act as the deck-2 guard walls (see VISUAL_AUDIT)
  { x: -65.5, z: -263.6, hw: 9.5, hd: 0.45 },  // deck south wall
  { x: -55.6, z: -270, hw: 0.45, hd: 6.4 },    // deck east wall
  { x: -68, z: -276.4, hw: 12, hd: 0.45 },     // deck north wall
  { x: -80.4, z: -272, hw: 0.45, hd: 4.4 },    // deck west wall (above the ramp)
  // Northgate mansion row footprints
  ...NORTH_MANSIONS.map((m) => ({ x: m.x, z: m.z, hw: 5.2, hd: 4.2 })),
];

// ================================================================
// Phase 25 — SCATTER CLEANUP PASS. The scatter generators above work
// on fixed grids (lamps at road ±7, corner props at block ±15, palm
// rows, park/beach trees) that predate several building placements,
// so individual items landed INSIDE building footprints (a lamp post
// in a wall, a bench inside a shop, a tree through a roof — the
// audit's SCATTER findings). Every scatter item is now pushed out of
// every collider AABB along its smallest penetration axis, to the
// face + its own radius. Deterministic (no rnd), runs once at module
// init, before VAULT_SPOTS / DESTRUCTIBLES derive from `props`.
// The mansion enters as its two visual boxes (same rule as the
// audit): blockersNear's single mansion box also covers the
// driveway, where scatter legitimately stands.
// ================================================================
const SCATTER_BOXES: { x: number; z: number; hw: number; hd: number }[] = [
  ...buildings.map((b) => ({ x: b.x, z: b.z, hw: b.width / 2, hd: b.depth / 2 })),
  ...STATIC_BLOCKERS,
  ...houses.map((h) => ({ x: h.x, z: h.z, hw: 3.1, hd: 2.9 })),
  { x: MANSION.x, z: MANSION.z, hw: 5.5, hd: 3.5 },
  { x: MANSION.x - 8.2, z: MANSION.z, hw: 2.5, hd: 3 },
];
function nudgeScatterOut(p: { x: number; z: number }, r: number): void {
  const EPS = 0.02; // face + radius + a hair, so the audit's strict < test sees daylight
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const b of SCATTER_BOXES) {
      const dx = p.x - b.x, dz = p.z - b.z;
      const px = b.hw + r - Math.abs(dx), pz = b.hd + r - Math.abs(dz);
      if (px > 0 && pz > 0) {
        if (px < pz) p.x = b.x + (dx >= 0 ? 1 : -1) * (b.hw + r + EPS);
        else p.z = b.z + (dz >= 0 ? 1 : -1) * (b.hd + r + EPS);
        moved = true;
      }
    }
    if (!moved) break;
  }
}
/** Distance to the nearest traffic-lane centreline segment (the
 * audit's spans). A prop/destructible the nudge pushed INTO the
 * 3.95u traffic envelope has nowhere legal to stand — between a
 * clamp-minimum building face and the lane there is no sidewalk —
 * so it is dropped instead of left in the traffic sweep. */
function laneClearance(x: number, z: number): number {
  let best = Infinity;
  const seg = (x0: number, z0: number, x1: number, z1: number) => {
    const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / L2));
    best = Math.min(best, Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t)));
  };
  for (const c of ROAD_COORDS) { seg(c, -100, c, 100); seg(-100, c, 100, c); }
  for (const c of CORAL_ROAD_X) seg(c, 224, c, 304);
  for (const c of CORAL_ROAD_Z) seg(40, c, 104, c);
  for (const c of NORTH_ROAD_X) seg(c, -280, c, -216);
  for (const c of NORTH_ROAD_Z) seg(-110, c, 30, c);
  return best;
}
for (let i = props.length - 1; i >= 0; i--) {
  nudgeScatterOut(props[i], 0.35);
  if (laneClearance(props[i].x, props[i].z) < 3.95) props.splice(i, 1);
}
for (let i = trees.length - 1; i >= 0; i--) {
  nudgeScatterOut(trees[i], 0.5);
  if (laneClearance(trees[i].x, trees[i].z) < 3.95) trees.splice(i, 1); // a trunk in the traffic sweep has nowhere legal to stand
}
for (const p of palms) nudgeScatterOut(p, 0.35);
for (const l of lamps) {
  const tmp = { x: l[0], z: l[2] };
  nudgeScatterOut(tmp, 0.25);
  l[0] = tmp.x; l[2] = tmp.z;
}

/** Low obstacles the player can VAULT over with Space (Phase 6, A7):
 * park/sidewalk benches + the mansion hedges. hw/hd are trigger AABBs. */
export const VAULT_SPOTS: { x: number; z: number; hw: number; hd: number }[] = [
  ...props.filter((p) => p.kind === "bench").map((p) => ({ x: p.x, z: p.z, hw: 1.05, hd: 1.05 })),
  { x: MANSION.x, z: MANSION.z + 5.6, hw: 6.5, hd: 0.6 },
  { x: MANSION.x - 6.8, z: MANSION.z, hw: 0.6, hd: 5.5 },
  { x: MANSION.x + 6.8, z: MANSION.z, hw: 0.6, hd: 5.5 },
];
export const GARAGE_EXT_DOOR = { x: -25, z: 103.2 }; // prompt point, street side (Phase 25: strip move — 1.8 in front of the new face)
export const CLUB_EXT_DOOR = { x: 44, z: 110.2 };    // prompt point, beach side
// ---- Phase 7 exterior doors (frontages rendered in World.tsx) ----
export const POLICE_EXT_DOOR = { x: -64, z: 103.2 };     // Harbour Patrol HQ, Docks strip (Phase 25: strip move)
export const FIRE_EXT_DOOR = { x: -80, z: 103.2 };       // Phase 32: Sable Fire Station, Docks strip (firefighter shift point)
export const CLINIC_EXT_DOOR = { x: 88, z: 103.2 };      // Sable Clinic, Docks strip east (Phase 25: strip move)
export const RESTAURANT_EXT_DOOR = { x: 64, z: 211.7 };  // Marina Table, Coral waterfront (Phase 25: promenade gap)
export const APARTMENT_DOOR = { x: 36, z: 211.7 };       // Coral Shores Apartment (buyable) (Phase 25: promenade gap)
export const CAR_WASH = { x: -44, z: -210 };             // Northgate Car Wash (buyable business)
export const CLUB_SHARE_POINT = { x: 54, z: 112 };       // Club Solace share buy point
// ---- Phase 9: airport hangar door (terminal front, apron side) ----
export const AIRPORT_DOOR = { x: 114.5, z: 40.6 };
// ---- Phase 13 exterior doors: the showroom's glass front faces the
// Northgate forecourt (building face z=-230.5, prompt on the apron);
// Café Coral joins the Docks strip at z=106.5 like HQ / the clinic ----
export const SHOWROOM_EXT_DOOR = { x: -36, z: -233 };
export const CAFE_EXT_DOOR = { x: 8, z: 103.2 }; // (Phase 25: strip move)
// ---- Phase 14 exterior doors: Sable Fitness pavilion on Lantern
// Park's south-west corner (the old outdoor gym corner grew walls),
// and the Northgate Loft on the mansion-row approach ----
export const GYM_EXT_DOOR = { x: 71.5, z: -66.3 }; // Phase 25: follows the pavilion move, stepped east so a park tree keeps the doorstep clear
export const CLOTHING_EXT_DOOR = { x: 18, z: 30.5 }; // Thread & Tide, Market Row (Phase 15: walk-in)
/** Phase 16: the Sable Downs farmhouse front door — south face of the
 * farmhouse blocker (FARM.house at (−92, −108.5), hd 3 → face z=−105.5;
 * Phase 25 moved the farmhouse with the corner-envelope fix). */
export const FARMHOUSE_EXT_DOOR = { x: -92, z: -104.7 };
export const LOFT_EXT_DOOR = { x: -68, z: -195.2 };
// ---- Phase 39 exterior doors, both in STREAMED districts (the
// door points are plain coordinates; Interiors.tsx gates them on
// the district's chunk being loaded). The diner doorstep stands
// on the kerb south of the Eastmere diner block (building at
// (60, −258), hd 2.5 → south face z=−255.5; the road runs at
// z=−248). The silo doorstep stands on the apron south of the
// Westbrook grain silo (blocker (−188, 58), hd 4 → south edge
// z=62; the land runs to z=66). ----
export const DINER_EXT_DOOR = { x: 60, z: -254.4 };
export const SILO_EXT_DOOR = { x: -188, z: 62.6 };

// ---- Phase 7 world sweep: toll booth on the Coral causeway (bridge
// deck at x = 60; the booth sits in the corridor, the barrier arm is a
// Phase7 visual — driving through slowly auto-charges $5) ----
export const TOLL = { x: 60, z: 150 };
// ---- Speed cameras: roadside poles; the fine logic lives in Phase7.
export const SPEED_CAMERAS: { x: number; z: number; road: string }[] = [
  { x: 100, z: -13.5, road: "Lantern straight (z −20)" },
  { x: -53.5, z: 40, road: "Ferry Quarter climb (x −60)" },
  { x: 26.5, z: -60, road: "Gull Heights run (x 20)" },
];
export const SPEED_LIMIT_U = 28; // ≈ 100 km/h in world units/s
/** Destructible props (Phase 7): smashed by the player's car at speed,
 * debris flies, they respawn on the next game day. NOT blockers.
 * Phase 14 ROUND 2: wooden fences (suburbs, Sable Downs, mansion row),
 * Market Row stall frames + canopies, and road signs join the set —
 * and the whole set now also breaks to the bat and thrown bottles
 * (game/destruct.ts is the shared breakage state). */
export interface Destructible { x: number; z: number; kind: "crate" | "barrel" | "fence" | "stall" | "sign"; rot: number; }
export const DESTRUCTIBLES: Destructible[] = [
  ...props.filter((p) => p.kind === "crate").map((p) => ({ x: p.x, z: p.z, kind: "crate" as const, rot: p.rot })),
  { x: 30, z: 112, kind: "barrel", rot: 0 }, { x: 36.5, z: 112.5, kind: "barrel", rot: 0 },
  { x: -40, z: 112, kind: "barrel", rot: 0 }, { x: 56, z: 95, kind: "barrel", rot: 0 }, // Phase 25: this barrel stood ON the z=100 centreline
  { x: -56, z: 156, kind: "barrel", rot: 0 }, { x: 27.5, z: 95, kind: "barrel", rot: 0 },
  { x: 66, z: 42, kind: "barrel", rot: 0 }, { x: 95, z: 30, kind: "crate", rot: 0.4 }, // Phase 25: this crate pair stood on the x=100 centreline
  { x: 95, z: 33, kind: "crate", rot: 0.9 }, { x: -64, z: 48, kind: "crate", rot: 0.2 },
  // construction-style fence line along Lantern Park's south edge
  ...[68, 72, 76, 80, 84, 88, 92].map((x) => ({ x, z: -64.5, kind: "fence" as const, rot: 0 })), // Phase 25: at z=−63 the line sat in the z=−60 lane sweep
  // ---- Phase 14: suburb garden fences (Ferry Quarter house rows) ----
  ...[-107.5, -105.2].map((x) => ({ x, z: -30, kind: "fence" as const, rot: 0 })), // Phase 25: re-sited to the west row's new front gardens (x=−112)
  ...[-74, -70.1, -66.2].map((x) => ({ x, z: 2, kind: "fence" as const, rot: 0 })),
  // ---- Phase 14: Sable Downs ring fences (tangent to the dirt loop) ----
  { x: -55.5, z: -69.8, kind: "fence", rot: -1.92 },
  { x: -66.4, z: -66.1, kind: "fence", rot: -2.37 }, // Phase 25: was on the z=−60 asphalt; now on the dirt ring itself
  { x: -70.4, z: -55.2, kind: "fence", rot: -2.82 },
  // ---- Phase 14: Northgate mansion-row front fences ----
  { x: -97.5, z: -209, kind: "fence", rot: Math.PI / 2 },
  { x: -97.5, z: -227, kind: "fence", rot: Math.PI / 2 },
  // ---- Phase 14: Market Row + Coral market stalls (frame + canopy) ----
  { x: 15, z: 26, kind: "stall", rot: 0.3 }, { x: 15, z: 32.5, kind: "stall", rot: -0.2 }, // Phase 25: both stalls stood inside the (9,31) building / the x=20 lane; now a row along its east face
  { x: 37.5, z: 34, kind: "stall", rot: 0.9 }, { x: 39.5, z: 30.5, kind: "stall", rot: 0.5 }, // Phase 25: both stalls stood inside the (31,31) building
  { x: 56, z: 216, kind: "stall", rot: 0.1 },
  // ---- Phase 14: road signs at the busy corners ----
  { x: 26.5, z: -13.5, kind: "sign", rot: 0 }, { x: -53.5, z: 26.5, kind: "sign", rot: 0 },
  { x: 66.5, z: -26.5, kind: "sign", rot: 0 }, { x: -26.5, z: 66.5, kind: "sign", rot: 0 },
  { x: 86.5, z: 229.5, kind: "sign", rot: 0 }, { x: -27.5, z: -220.5, kind: "sign", rot: 0 }, // Phase 25: both signs stood in traffic lanes
];
// Phase 25: destructibles get the same scatter cleanup (a fence or
// stall half inside a wall is the same nonsense, smashable or not),
// including the traffic-envelope drop.
for (let i = DESTRUCTIBLES.length - 1; i >= 0; i--) {
  nudgeScatterOut(DESTRUCTIBLES[i], 0.4);
  if (laneClearance(DESTRUCTIBLES[i].x, DESTRUCTIBLES[i].z) < 3.95) DESTRUCTIBLES.splice(i, 1);
}

/** Manhattan GPS route on the road grid (big-map polyline, Phase 7):
 * start → nearest cross street → target street → target. Cross-bay and
 * cross-causeway trips route via the bridge / causeway spines. */
export function routePoints(x0: number, z0: number, x1: number, z1: number): [number, number][] {
  const pts: [number, number][] = [[x0, z0]];
  const push = (x: number, z: number) => {
    const last = pts[pts.length - 1];
    if (!last || Math.abs(last[0] - x) > 0.5 || Math.abs(last[1] - z) > 0.5) pts.push([x, z]);
  };
  const inMain = (x: number, z: number) => Math.abs(x) <= 126 && z >= -126 && z <= 130;
  const nearRoad = (v: number) => ROAD_COORDS.reduce((a, c) => (Math.abs(c - v) < Math.abs(a - v) ? c : a), ROAD_COORDS[0]);
  if (inMain(x0, z0) && inMain(x1, z1)) {
    const zr = nearRoad(z0), xr = nearRoad(x1);
    push(x0, zr); push(xr, zr); push(xr, z1);
  } else if (inCoral(x1, z1) && !inCoral(x0, z0)) {
    push(60, 112); push(60, 214); push(x1, 224);
  } else if (inCoral(x0, z0) && !inCoral(x1, z1)) {
    push(60, 214); push(60, 112); push(x1, nearRoad(z1));
  } else if ((inNorth(x1, z1) || z1 < -130) && !inNorth(x0, z0)) {
    push(-20, -110); push(-20, -196); push(x1, z1);
  } else if (inNorth(x0, z0) && !inNorth(x1, z1)) {
    push(-20, -196); push(-20, -110); push(x1, nearRoad(z1));
  }
  push(x1, z1);
  return pts;
}
export const MANSION_GATE = { x: MANSION.x, z: MANSION.z + 8.2 };
export const MANSION_PRICE = 7500;
/** Mansion driveway pad — park here (owned) and the car is garage-saved.
 * Phase 25: the pad (and the showpiece on it) sat 0.2u into the house's
 * SE corner; pad + zone shift 0.8 south so a parked car clears the wall. */
export const MANSION_DRIVE = { x: MANSION.x + 4.4, z: MANSION.z + 5.2, hw: 3.6, hd: 2.6 };

// ---- Phase 3: enterable interiors live in an offset pocket (z ≈ -175),
// far outside the city grid. Player movement clamps to the room while
// G.interior is set, so city collision never applies there.
export type InteriorKind = "garage" | "club" | "police" | "clinic" | "restaurant" | "hangar" | "showroom" | "cafe" | "gym" | "loft" | "clothing" | "farmhouse" | "diner" | "silo";
export interface InteriorDef { cx: number; cz: number; w: number; d: number; spawnIn: [number, number]; exitDoor: [number, number]; }
export const INTERIORS: Record<InteriorKind, InteriorDef> = {
  garage: { cx: 0, cz: -175, w: 18, d: 13, spawnIn: [0, -171.2], exitDoor: [0, -169.4] },
  club: { cx: 52, cz: -175, w: 22, d: 15, spawnIn: [52, -170.8], exitDoor: [52, -168.6] },
  // ---- Phase 7 interiors round: police HQ, clinic, restaurant ----
  police: { cx: 104, cz: -175, w: 20, d: 14, spawnIn: [104, -171.4], exitDoor: [104, -169.2] },
  clinic: { cx: 140, cz: -175, w: 16, d: 12, spawnIn: [140, -172], exitDoor: [140, -170] },
  restaurant: { cx: 172, cz: -175, w: 18, d: 13, spawnIn: [172, -171.6], exitDoor: [172, -169.6] },
  // ---- Phase 9: airport hangar (sixth pocket interior) ----
  hangar: { cx: 208, cz: -175, w: 20, d: 14, spawnIn: [208, -171.4], exitDoor: [208, -169.2] },
  // ---- Phase 13: Sable Motors showroom + Café Coral (pockets 7 + 8) ----
  showroom: { cx: 244, cz: -175, w: 22, d: 15, spawnIn: [244, -171.2], exitDoor: [244, -168.4] },
  cafe: { cx: 282, cz: -175, w: 16, d: 12, spawnIn: [282, -171.2], exitDoor: [282, -169.9] },
  // ---- Phase 14: Sable Fitness + the Northgate Loft (pockets 9 + 10) ----
  gym: { cx: 318, cz: -175, w: 18, d: 13, spawnIn: [318, -171.2], exitDoor: [318, -169.4] },
  loft: { cx: 354, cz: -175, w: 16, d: 12, spawnIn: [354, -171.6], exitDoor: [354, -170] },
  // ---- Phase 15: Thread & Tide walk-in shop (pocket 11) — the
  // Market Row street rack is signage now; the counter moved inside
  // (counter point in game/phase8.ts CLOTHING_COUNTER) ----
  clothing: { cx: 390, cz: -175, w: 16, d: 12, spawnIn: [390, -171.6], exitDoor: [390, -170] },
  // ---- Phase 16: the Sable Downs farmhouse (pocket 12) — kitchen /
  // living room + the farmhand's bunk (free sleep, no purchase) ----
  farmhouse: { cx: 426, cz: -175, w: 16, d: 12, spawnIn: [426, -171.6], exitDoor: [426, -170] },
  // ---- Phase 39: the Eastmere Diner (pocket 13) + the Westbrook
  // silo office (pocket 14). Both pockets live HERE, in the base
  // bundle, like every interior — the registry is one table and
  // the rooms are a few boxes each; what stays lazy is the
  // districts' world geometry. Their street doors are gated on
  // the district chunk being loaded (Interiors.tsx), which is
  // also the only state in which the player can stand at them:
  // an unloaded district is open water. ----
  diner: { cx: 462, cz: -175, w: 16, d: 12, spawnIn: [462, -171.2], exitDoor: [462, -169.9] },
  silo: { cx: 498, cz: -175, w: 14, d: 12, spawnIn: [498, -171.6], exitDoor: [498, -170] },
};

export function isBlocked(x: number, z: number, radius: number): boolean {
  if (Math.abs(x - MANSION.x) < 6.6 + radius && Math.abs(z - MANSION.z) < 4.6 + radius) return true;
  for (const b of STATIC_BLOCKERS) {
    if (Math.abs(x - b.x) < b.hw + radius && Math.abs(z - b.z) < b.hd + radius) return true;
  }
  if (onBridge(x, z)) {
    // on the causeway: only the deck corridor is passable
    if (Math.abs(x - BRIDGE.x) > BRIDGE.halfW + 1.6) return true;
  } else {
    const inMain = Math.abs(x) <= WORLD_BOUND + 8 && z >= -WORLD_BOUND - 8 && z <= WATER_Z + 6;
    if (!inMain && !inCoral(x, z) && !inNorth(x, z) && !onCauseway(x, z) && !onIsland(x, z) && !inStreamed(x, z)) return true;
  }
  const sd = inStreamed(x, z);
  if (sd) for (const b of sd.blockers) {
    if (Math.abs(x - b.x) < b.hw + radius && Math.abs(z - b.z) < b.hd + radius) return true;
  }
  for (const b of buildings) {
    if (Math.abs(x - b.x) < b.width / 2 + radius && Math.abs(z - b.z) < b.depth / 2 + radius) return true;
  }
  for (const t of trees) {
    const dx = x - t.x, dz = z - t.z;
    if (dx * dx + dz * dz < (radius + 0.7) ** 2) return true;
  }
  for (const h of houses) {
    if (Math.abs(x - h.x) < 3.1 + radius && Math.abs(z - h.z) < 2.9 + radius) return true;
  }
  return false;
}

/** AABB blockers near a point — feeds the swept-collision query (physics). */
export function blockersNear(x: number, z: number, r: number): { x: number; z: number; hw: number; hd: number }[] {
  const out: { x: number; z: number; hw: number; hd: number }[] = [];
  const near = (bx: number, bz: number) => Math.abs(bx - x) < r && Math.abs(bz - z) < r;
  if (near(MANSION.x, MANSION.z)) out.push({ x: MANSION.x, z: MANSION.z, hw: 6.6, hd: 4.6 });
  for (const b of STATIC_BLOCKERS) if (near(b.x, b.z)) out.push(b);
  const sd = inStreamed(x, z);
  if (sd) for (const b of sd.blockers) if (near(b.x, b.z)) out.push(b);
  for (const b of buildings) if (near(b.x, b.z)) out.push({ x: b.x, z: b.z, hw: b.width / 2, hd: b.depth / 2 });
  for (const h of houses) if (near(h.x, h.z)) out.push({ x: h.x, z: h.z, hw: 3.1, hd: 2.9 });
  return out;
}

/** Nearest road-grid intersection to a point (used by traffic/police turns). */
export function nearestIntersection(x: number, z: number): [number, number] {
  const nx = ROAD_COORDS.reduce((a, c) => (Math.abs(c - x) < Math.abs(a - x) ? c : a), ROAD_COORDS[0]);
  const nz = ROAD_COORDS.reduce((a, c) => (Math.abs(c - z) < Math.abs(a - z) ? c : a), ROAD_COORDS[0]);
  return [nx, nz];
}

// ---- Drivable parked cars (original model names, Harborfall range) ----
export interface CarSpawn { id: number; x: number; z: number; heading: number; color: string; model: string; kind: "sedan" | "hatch" | "pickup" | "van" | "coupe" | "supercar" | "muscle" | "suv" | "classic" | "motorcycle" | "bus" | "taxi" | "bicycle" | "boat" | "wedge" | "hyper" | "gt" | "tow" | "skiff" | "plane" | "kestrel" | "bronto" | "tempest" | "mule" | "ambulance" | "firetruck" | "sovereign"; owned: boolean; }
export const CAR_SPAWNS: CarSpawn[] = [
  { id: 0, x: 24, z: 102.5, heading: Math.PI / 2, color: "#1f7a72", model: "Sable Sprinter", kind: "sedan", owned: true },   // Rayan's own car at the pier (Phase 25: was half inside Café Coral's wall — the Phase 13 café blocker grew over this Phase 1 spot; now parallel-parked on the Docks kerb east of the café)
  { id: 1, x: -17, z: -40, heading: Math.PI / 2, color: "#d99a3d", model: "Harbor Hauler", kind: "pickup", owned: false },
  { id: 2, x: 23, z: 20, heading: -Math.PI / 2, color: "#c22e2e", model: "Gullwing GT", kind: "supercar", owned: false },
  { id: 3, x: -57, z: 60, heading: 0, color: "#4a6b8a", model: "Ferry Rover", kind: "suv", owned: false },
  { id: 4, x: 63, z: -20, heading: Math.PI, color: "#8a3324", model: "Yardbird", kind: "muscle", owned: false },
  { id: 5, x: -97, z: -60, heading: Math.PI / 2, color: "#5c6650", model: "Sable Sprinter", kind: "sedan", owned: false },
  { id: 6, x: 37, z: 80, heading: -Math.PI / 2, color: "#3f7fae", model: "Dune Classic '74", kind: "classic", owned: false },
  { id: 7, x: -23, z: -100, heading: 0, color: "#2e4a5a", model: "Harbor Hauler", kind: "pickup", owned: false },
  { id: 8, x: 97, z: 40, heading: Math.PI, color: "#946b2d", model: "Ferry Van", kind: "van", owned: false },
  { id: 9, x: -63, z: -20, heading: Math.PI / 2, color: "#6b3a4a", model: "Yardbird", kind: "hatch", owned: false },
  { id: 10, x: -99, z: -112, heading: -2.35, color: "#c8ccd2", model: "Gullwing GT-S", kind: "supercar", owned: false }, // silver supercar at the overlook
  { id: 11, x: 8, z: 117, heading: -0.4, color: "#c22e2e", model: "Sable Stinger", kind: "motorcycle", owned: false }, // rideable bike at the beach (Phase 3)
  // Coral Shores parked cars (Phase 4)
  { id: 12, x: 56.5, z: 223, heading: Math.PI / 2, color: "#3f7fae", model: "Meridian Sedan", kind: "sedan", owned: false }, // Phase 25: was inside the Coral Shores Goods shopfront; now on the shore-road kerb
  { id: 13, x: 78, z: 261, heading: -Math.PI / 2, color: "#8a3324", model: "Pico Hatch", kind: "hatch", owned: false },
  { id: 14, x: 97, z: 310, heading: Math.PI / 2, color: "#2e4a5a", model: "Coral Coupe", kind: "coupe", owned: false }, // Phase 25: was inside the generated block at (97,293); now parallel-parked on the z=304 street's south kerb
  { id: 15, x: 58, z: 301, heading: 0, color: "#946b2d", model: "Yardbird V8", kind: "muscle", owned: false },
  // ---- Phase 6: Northgate parked cars + the new vehicle classes ----
  { id: 16, x: -20, z: -234, heading: Math.PI / 2, color: "#e8e8e8", model: "Meridian Sedan", kind: "sedan", owned: false }, // Phase 25: was inside the Sable Motors showroom; now on its north apron
  { id: 17, x: -44, z: -244, heading: Math.PI / 2, color: "#d99a3d", model: "Coral Coupe", kind: "coupe", owned: false }, // Phase 25: was inside the generated block at (−59,−241); now on the z=−248 street's north verge
  { id: 18, x: 24, z: -242, heading: Math.PI, color: "#4a6b8a", model: "Ferry Rover", kind: "suv", owned: false },
  { id: 19, x: -90, z: -230, heading: 0, color: "#5c6650", model: "Pico Hatch", kind: "hatch", owned: false },
  { id: 20, x: 96, z: 96, heading: -Math.PI / 2, color: "#2e7fb8", model: "Sable Cityliner", kind: "bus", owned: false }, // city bus at the docks depot
  { id: 21, x: 24, z: -33, heading: Math.PI / 2, color: "#f2b134", model: "Sable Cab", kind: "taxi", owned: false },     // taxi rank, Market Row (Phase 25: was inside the Downtown tower at (9,−30); now east of it on the same kerb)
  { id: 22, x: 16, z: 116, heading: 0.4, color: "#c22e2e", model: "Shoreline Cruiser", kind: "bicycle", owned: false }, // beach bike
  { id: 23, x: 82, z: -66, heading: -0.6, color: "#274268", model: "Shoreline Cruiser", kind: "bicycle", owned: false }, // Lantern Park bike (Phase 25: the gym pavilion's move east covered this spot; now on the lawn south-east of it)
  { id: 24, x: 4, z: 134.5, heading: Math.PI, color: "#e8ecef", model: "Sable Skiff 240", kind: "boat", owned: false }, // speedboat off the pier
  // ---- Phase 8: Sable Motors display pair + Lina's wrecker ----
  { id: 25, x: -28, z: -238, heading: Math.PI / 2, color: "#d99a3d", model: "Vantara S", kind: "wedge", owned: false },   // dealership display wedge
  { id: 26, x: -44, z: -238, heading: Math.PI / 2, color: "#31556e", model: "Marlowe GT", kind: "gt", owned: false },    // dealership display GT
  { id: 27, x: -17, z: 105, heading: 0, color: "#d99a3d", model: "Sable Wrecker", kind: "tow", owned: false },           // tow truck at Lina's yard
  // ---- Phase 9: flyable prop plane on the airport apron + fishing
  // skiffs at the island dock and the Coral marina ----
  { id: 28, x: 124, z: 70, heading: Math.PI, color: "#e8e4da", model: "Sable Sparrow", kind: "plane", owned: false },   // faces north up the runway
  { id: 29, x: -46, z: 158, heading: 0, color: "#7a8a5a", model: "Harbour Fisher 180", kind: "skiff", owned: false },    // island dock skiff (Phase 25: was beached inside the island's land radius; now afloat just off the dock)
  { id: 30, x: 92, z: 190, heading: Math.PI, color: "#b4622d", model: "Harbour Fisher 180", kind: "skiff", owned: false }, // Coral marina skiff (Phase 25: was on the landmass edge line; now afloat off the marina)
  // ---- Phase 15: the farm pickup on the Sable Downs west dirt road ----
  { id: 31, x: -104, z: -78, heading: Math.PI / 2, color: "#5c6650", model: "Harbor Hauler", kind: "pickup", owned: false }, // farm pickup
  // Phase 18: the farm's Bronto Hauler, parked by the barn — the
  // countryside's own truck (also on the dealer list). NOT the Farm
  // Work vehicle: that job is bound to the id-31 pickup's bed.
  { id: 32, x: -93, z: -90, heading: -0.5, color: "#5c6650", model: "Bronto Hauler", kind: "bronto", owned: false }, // Phase 25: was parked across both lanes of the x=−100 road; now on the grass verge by the Downs ring
  // ---- Phase 28: one Tempest on the Sable Motors display row (the
  // wedge and the Marlowe GT already stand there) — player/rare
  // parked only, it never joins traffic. Plus the farm's Mule,
  // parked on the grass south of the farmhouse. ----
  { id: 33, x: -52, z: -238, heading: Math.PI / 2, color: "#274b5e", model: "Vantara Tempest", kind: "tempest", owned: false }, // dealership display Tempest
  { id: 34, x: -98, z: -96, heading: 0.7, color: "#7a6a4f", model: "Sable Mule", kind: "mule", owned: false }, // the farm Mule, south of the farmhouse
];
