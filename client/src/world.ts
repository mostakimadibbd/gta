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

// District names (original): Docks (south), Market Row (centre),
// Lantern Park (NE), Gull Heights (north), Ferry Quarter (west), East Yards (east)
export function districtAt(x: number, z: number): string {
  if (z >= 190) return "Coral Shores";
  if (z > 118 && Math.abs(x - 60) < 18) return "Bay Bridge";
  if (z > 90) return "The Docks";
  if (x < -60) return "Ferry Quarter";
  if (x > 60 && z < -60) return "Lantern Park";
  if (z < -60) return "Gull Heights";
  if (x > 60) return "East Yards";
  return "Market Row";
}

const palette = ["#a06a42", "#b57e4e", "#77644c", "#8f5f3d", "#7d6248", "#a87c52", "#5f5142", "#4a6d7c", "#33617f", "#b25a38", "#cf9a4e", "#59754e", "#84505c", "#c2ab7d"];
const roofs = ["#14524f", "#0f4442", "#17605c", "#123f3e"];
export const buildings: Building[] = [];
export const trees: TreeSpot[] = [];
export const props: PropSpot[] = [];
export const lamps: [number, number, number][] = [];

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

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
      if (rnd() < 0.12) { trees.push({ x: bx + ox, z: bz + oz, scale: 0.8 + rnd() * 0.4 }); continue; }
      const w = 9 + rnd() * 5, d = 9 + rnd() * 5;
      buildings.push({
        x: bx + ox, z: bz + oz, width: w, depth: d,
        height: 8 + rnd() * 26,
        color: palette[Math.floor(rnd() * palette.length)],
        roof: roofs[Math.floor(rnd() * roofs.length)],
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

/** Ground height — 0 everywhere except the bridge causeway profile. */
export function groundYAt(x: number, z: number): number {
  if (Math.abs(x - BRIDGE.x) > BRIDGE.halfW + 1.6) return 0;
  const south = (z - (BRIDGE.z0 - BRIDGE.ramp)) / BRIDGE.ramp; // 0→1 up the south ramp
  const north = ((BRIDGE.z1 + BRIDGE.rampN) - z) / BRIDGE.rampN; // 1→0 down the shorter north ramp (lands before Coral's z=224 road)
  const s = Math.max(0, Math.min(1, Math.min(south, north)));
  return BRIDGE.deckH * s * s * (3 - 2 * s); // smoothstep ramps
}
export const onBridge = (x: number, z: number) => groundYAt(x, z) > 0.05;
export const inCoral = (x: number, z: number) => x >= CORAL.x0 && x <= CORAL.x1 && z >= CORAL.z0 && z <= CORAL.z1;
/** Open water (swimmable; blocks cars). Land = Port Sable shore, Coral landmass, or the bridge deck. */
export function isWaterAt(x: number, z: number): boolean {
  if (onBridge(x, z)) return false;
  if (z <= WATER_Z && Math.abs(x) <= WORLD_BOUND + 8 && z >= -WORLD_BOUND - 8) return false; // Port Sable land
  if (inCoral(x, z)) return false;
  return true;
}

// Coral Shores buildings — same generator idiom as Port Sable blocks.
for (const bx of [56, 88]) {
  for (const bz of [244, 284]) {
    const spots: [number, number][] = [[-9, -9], [9, -9], [-9, 9], [9, 9]];
    for (const [ox, oz] of spots) {
      if (rnd() < 0.1) { trees.push({ x: bx + ox, z: bz + oz, scale: 0.8 + rnd() * 0.4 }); continue; }
      const w = 9 + rnd() * 5, d = 9 + rnd() * 5;
      buildings.push({
        x: bx + ox, z: bz + oz, width: w, depth: d,
        height: 8 + rnd() * 22,
        color: palette[Math.floor(rnd() * palette.length)],
        roof: roofs[Math.floor(rnd() * roofs.length)],
        district: "Coral Shores",
      });
    }
    props.push({ x: bx - 15, z: bz - 15, kind: "bench", rot: rnd() * 3 });
    props.push({ x: bx + 15, z: bz + 15, kind: "hydrant", rot: 0 });
  }
}
// waterfront row facing the bridge landing + 4 glass towers
for (const wx of [44, 84, 100]) {
  buildings.push({ x: wx, z: 214, width: 10 + rnd() * 3, depth: 7, height: 9 + rnd() * 10, color: palette[Math.floor(rnd() * palette.length)], roof: roofs[Math.floor(rnd() * roofs.length)], district: "Coral Shores" });
}
[[47, 235], [97, 253], [65, 275], [88, 293]].forEach(([tx, tz], i) => {
  buildings.push({ x: tx, z: tz, width: 11, depth: 11, height: 36 + ((i * 5) % 13), color: "#3d7296", roof: "#274b5e", district: "Coral Shores", glass: true });
});
// Coral street lamps along its roads
for (const c of CORAL_ROAD_X) for (let t = 206; t <= 318; t += 24) lamps.push([c + 7, 0, t], [c - 7, 0, t]);
for (const c of CORAL_ROAD_Z) for (let t = 34; t <= 108; t += 24) lamps.push([t, 0, c + 7], [t, 0, c - 7]);

// ---- Downtown skyline: tall glass towers on free spots of central blocks
// (generated building spots are (-9,-9), (9,-9), (0,10); towers use (9,10)).
const towerBlocks: [number, number][] = [[0, 0], [-40, 0], [40, 0], [0, -40], [0, 40], [-40, -40], [40, 40], [-40, 40], [40, -40]];
towerBlocks.forEach(([bx, bz], i) => {
  buildings.push({
    x: bx + 9, z: bz + 10, width: 11, depth: 11,
    height: 34 + ((i * 7) % 21), // 34–54u
    color: "#3d7296", roof: "#274b5e", district: "Downtown", glass: true,
  });
});
// ---- Suburbs (west edge, Ferry Quarter): low houses with lawns/driveways
for (const bz of [-40, 0, 40]) {
  houses.push({ x: -80 + 14, z: bz + 6, rot: -Math.PI / 2, color: "#e6ddcb", roof: "#8a4a3a" });
  houses.push({ x: -80 - 14, z: bz + 12, rot: Math.PI / 2, color: "#cfdde8", roof: "#4a5a6a" });
  houses.push({ x: -80 + 13, z: bz - 13, rot: -Math.PI / 2, color: "#efe3c2", roof: "#6a7a4a" });
}
// ---- Palm trees: beach row + harbour boulevard (visual only, thin trunks
// are excluded from isBlocked so they never trap the player)
export const palms: { x: number; z: number; scale: number; lean: number }[] = [];
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
    if (Math.abs(t % 40) > 4) { trees.push({ x: c - 8, z: t, scale: 0.75 + rnd() * 0.3 }); }
    lamps.push([c + 7, 0, t + 11], [c - 7, 0, t + 11]);
  }
}
// beach palms
for (let x = -105; x <= 105; x += 15) trees.push({ x, z: 120 + rnd() * 4, scale: 1 + rnd() * 0.4 });

export function isOnRoad(x: number, z: number): boolean {
  if (onBridge(x, z)) return true;
  if (inCoral(x, z)) return CORAL_ROAD_X.some((c) => Math.abs(x - c) < ROAD_WIDTH / 2) || CORAL_ROAD_Z.some((c) => Math.abs(z - c) < ROAD_WIDTH / 2);
  return ROAD_COORDS.some((c) => Math.abs(x - c) < ROAD_WIDTH / 2 || Math.abs(z - c) < ROAD_WIDTH / 2);
}

export const MANSION = { x: -80, z: 90 }; // luxury house, SW block (plot cleared above)

// ---- Phase 2: fuel stations (drive in slow, tank refills for cash) ----
export interface FuelStation { x: number; z: number; name: string; }
export const FUEL_STATIONS: FuelStation[] = [
  { x: 27.5, z: 100, name: "Docks Fuel" },
  { x: -53.5, z: -27, name: "Ferry Quarter Fuel" },
  { x: 66, z: 47, name: "East Yards Fuel" },
  { x: 99, z: 229, name: "Coral Shores Fuel" },
];

// ---- Phase 4: theft + garage data points --------------------------------
export const PAWN_SHOP = { x: 88, z: 213.2, name: "Coral Pawn" }; // fence counter, Coral Shores
export interface RegisterPoint { id: string; name: string; x: number; z: number; }
export const REGISTERS: RegisterPoint[] = [
  { id: "mart", name: "Sable Mart", x: 13.5, z: 33 },
  { id: "goods", name: "Harbour Goods", x: -33, z: 13.5 },
  { id: "grocer", name: "Lantern Groceries", x: 53, z: -13.5 },
  { id: "coral", name: "Coral Shores Goods", x: 48, z: 213.2 },
];
export interface GarageZone { id: "villa" | "lina"; label: string; x: number; z: number; r: number; exitX: number; exitZ: number; exitHeading: number; }
export const GARAGE_ZONES: GarageZone[] = [
  { id: "villa", label: "Villa Garage", x: MANSION.x + 4.4, z: MANSION.z + 4.4, r: 6.5, exitX: -75.6, exitZ: 96, exitHeading: 0 },
  { id: "lina", label: "Lina's Garage", x: -25, z: 100.6, r: 7.5, exitX: -25, exitZ: 95.5, exitHeading: 0 },
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
};
// ---- Phase 2: hillside scenic overlook (final mood-board image) ----
export const OVERLOOK = { x: -102, z: -114 };

// ---- Phase 3: solid scenery buildings that are not in the generated
// `buildings` array (garage exterior + Club Solace) ----
export const STATIC_BLOCKERS: { x: number; z: number; hw: number; hd: number }[] = [
  { x: -25, z: 106.5, hw: 6.1, hd: 4.1 }, // Lina's Garage exterior (Docks frontage)
  { x: 44, z: 117, hw: 7.6, hd: 4.6 },   // Club Solace exterior
  { x: 48, z: 218, hw: 5, hd: 3.4 },     // Coral Shores Goods (register shop)
  { x: 88, z: 218, hw: 5, hd: 3.4 },     // Coral Pawn shop
];
export const GARAGE_EXT_DOOR = { x: -25, z: 100.6 }; // prompt point, street side
export const CLUB_EXT_DOOR = { x: 44, z: 110.2 };    // prompt point, beach side
export const MANSION_GATE = { x: MANSION.x, z: MANSION.z + 8.2 };
export const MANSION_PRICE = 7500;
/** Mansion driveway pad — park here (owned) and the car is garage-saved. */
export const MANSION_DRIVE = { x: MANSION.x + 4.4, z: MANSION.z + 4.4, hw: 3.6, hd: 2.6 };

// ---- Phase 3: enterable interiors live in an offset pocket (z ≈ -175),
// far outside the city grid. Player movement clamps to the room while
// G.interior is set, so city collision never applies there.
export interface InteriorDef { cx: number; cz: number; w: number; d: number; spawnIn: [number, number]; exitDoor: [number, number]; }
export const INTERIORS: Record<"garage" | "club", InteriorDef> = {
  garage: { cx: 0, cz: -175, w: 18, d: 13, spawnIn: [0, -171.2], exitDoor: [0, -169.4] },
  club: { cx: 52, cz: -175, w: 22, d: 15, spawnIn: [52, -170.8], exitDoor: [52, -168.6] },
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
    if (!inMain && !inCoral(x, z)) return true;
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
export interface CarSpawn { id: number; x: number; z: number; heading: number; color: string; model: string; kind: "sedan" | "hatch" | "pickup" | "van" | "coupe" | "supercar" | "muscle" | "suv" | "classic" | "motorcycle"; owned: boolean; }
export const CAR_SPAWNS: CarSpawn[] = [
  { id: 0, x: 3, z: 106, heading: Math.PI, color: "#1f7a72", model: "Sable Sprinter", kind: "sedan", owned: true },   // Rayan's own car at the pier
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
  { id: 12, x: 46, z: 221, heading: Math.PI / 2, color: "#3f7fae", model: "Meridian Sedan", kind: "sedan", owned: false },
  { id: 13, x: 78, z: 261, heading: -Math.PI / 2, color: "#8a3324", model: "Pico Hatch", kind: "hatch", owned: false },
  { id: 14, x: 101, z: 290, heading: Math.PI, color: "#2e4a5a", model: "Coral Coupe", kind: "coupe", owned: false },
  { id: 15, x: 58, z: 301, heading: 0, color: "#946b2d", model: "Yardbird V8", kind: "muscle", owned: false },
];
