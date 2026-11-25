// Harborfall — Phase 25 placement audit (headless).
//
// Bundled + run by tools/audit-placements.mjs (node + the client's
// esbuild). Imports the REAL data modules and the REAL collision
// query (world.isBlocked / blockers data) so the audit can never
// drift from the game: every static placement in the game is tested
// against every building collider, and every traffic lane is sampled
// end to end. Exit code 1 when any intersection is found.
//
// What is covered:
//   · CAR_SPAWNS — full oriented-box (OBB) test per car, using the
//     BODY_DIMS table from components/Vehicle.tsx (audit copy below;
//     Vehicle.tsx is a React module and cannot be imported headless)
//   · garage take-out exits, valet frontages + bays, rental spawn
//   · traffic lanes on all three grids + causeway + bridge (sampled)
//   · ped spawns (initWorld formulas), townsfolk schedule stops,
//     staff frontage beats (StaffWorld.beatFor offsets, replicated)
//   · POIs: hail/dest/pickup points, bus stops, tram-adjacent points,
//     fishing spots + cast points, derby pier, rental dock, doors,
//     registers, fuel stations, businesses, barber/tattoo, respawns
//   · scatter: props, destructibles, lamps, trees, palms vs colliders
//   · Phase 17 event spots (literals copied from components/Phase17
//     .tsx — module-private consts in a React module; keep in sync)
import {
  buildings, STATIC_BLOCKERS, houses, MANSION, CAR_SPAWNS, props,
  DESTRUCTIBLES, lamps, trees, palms, isBlocked, isWaterAt, isOnRoad,
  ROAD_COORDS, CORAL_ROAD_X, CORAL_ROAD_Z, NORTH_ROAD_X, NORTH_ROAD_Z,
  CAUSEWAY, BRIDGE, BUS_STOPS, FUEL_STATIONS, REGISTERS, GARAGE_ZONES,
  PIER_SPAWN, HOSPITAL, HOSPITAL_DOOR, DEALERSHIP, GUN_STORE, VENDOR,
  GARAGE_EXT_DOOR, CLUB_EXT_DOOR, POLICE_EXT_DOOR, CLINIC_EXT_DOOR,
  RESTAURANT_EXT_DOOR, APARTMENT_DOOR, CAR_WASH, CLUB_SHARE_POINT,
  AIRPORT_DOOR, SHOWROOM_EXT_DOOR, CAFE_EXT_DOOR, GYM_EXT_DOOR,
  CLOTHING_EXT_DOOR, FARMHOUSE_EXT_DOOR, LOFT_EXT_DOOR, MANSION_GATE,
  MANSION_DRIVE, OVERLOOK, SPEED_CAMERAS, TOLL, PAWN_SHOP, FARM,
  NORTH_MANSIONS,
} from "../client/src/world";
import { HAIL_POINTS, DEST_POINTS, PICKUP_POINTS, VALET_FRONTAGES } from "../client/src/game/jobs";
import { BUS_STOPS_RIDE } from "../client/src/game/bus";
import { DERBY_PIER } from "../client/src/game/derby";
import { FISHING_SPOTS } from "../client/src/game/phase8";
import { BUSINESSES, APARTMENT, LOFT } from "../client/src/game/economy";
import { RENTAL_DOCK, RENTAL_SPAWN } from "../client/src/game/rentals";
import { TOWNSFOLK, BARBER_POS, TATTOO_POS } from "../client/src/game/phase9";

// ---- collider set (mirrors world.blockersNear: buildings + static
// blockers + houses + the mansion). ONE deliberate difference: the
// mansion enters as its two VISUAL boxes (World.tsx: main house
// 11×7 + west annex 5×6 at (−8.2, 0)) instead of blockersNear's
// single 6.6×4.6 box. That box is a conservative MOVEMENT blocker —
// it also covers the driveway pad + showpiece bay, where cars are
// SUPPOSED to park (GARAGE_ZONES villa / MANSION_DRIVE) — so it is
// not a placement truth. The runtime depenetration guard
// (game/depenetrate.ts) makes the same swap for the same reason. ----
interface Box { x: number; z: number; hw: number; hd: number; what: string }
const COLLIDERS: Box[] = [
  ...buildings.map((b, i) => ({ x: b.x, z: b.z, hw: b.width / 2, hd: b.depth / 2, what: `building#${i} (${b.district})` })),
  ...STATIC_BLOCKERS.map((b, i) => ({ x: b.x, z: b.z, hw: b.hw, hd: b.hd, what: `static#${i}` })),
  ...houses.map((h, i) => ({ x: h.x, z: h.z, hw: 3.1, hd: 2.9, what: `house#${i}` })),
  { x: MANSION.x, z: MANSION.z, hw: 5.5, hd: 3.5, what: "mansion house (visual)" },
  { x: MANSION.x - 8.2, z: MANSION.z, hw: 2.5, hd: 3, what: "mansion annex (visual)" },
];

// ---- car body dims [halfWidth, halfLength] — audit copy of
// components/Vehicle.tsx BODY_DIMS + its [1.0, 1.85] fallback -------
const BODY_DIMS: Record<string, [number, number]> = {
  sedan: [1.0, 1.85], taxi: [1.0, 1.85], coupe: [1.0, 1.95], hatch: [0.95, 1.6],
  muscle: [1.05, 2.2], suv: [1.05, 2.1], classic: [1.0, 2.25], pickup: [1.05, 2.05],
  van: [1.05, 2.1], supercar: [1.1, 2.15], bus: [1.25, 3.5], wedge: [1.15, 2.25],
  hyper: [1.1, 2.2], gt: [1.0, 2.3], tow: [1.05, 2.05],
  kestrel: [1.04, 1.98], bronto: [1.1, 2.2],
};
const dimsOf = (kind: string): [number, number] => BODY_DIMS[kind] ?? [1.0, 1.85];

/** Oriented box (centre, heading, half dims) vs AABB — SAT on the
 * four axes (world x/z + the car's two local axes). */
function obbHitsBox(cx: number, cz: number, heading: number, hw: number, hl: number, b: Box): boolean {
  const c = Math.cos(heading), s = Math.sin(heading);
  // car local axes in world space: forward (sin h, cos h), right (cos h, -sin h)
  const axes: [number, number][] = [[1, 0], [0, 1], [c, -s], [s, c]];
  const corners: [number, number][] = [];
  for (const [lx, lz] of [[-hw, -hl], [hw, -hl], [-hw, hl], [hw, hl]] as [number, number][]) {
    corners.push([cx + lx * c + lz * s, cz - lx * s + lz * c]);
  }
  const bc: [number, number][] = [[b.x - b.hw, b.z - b.hd], [b.x + b.hw, b.z - b.hd], [b.x - b.hw, b.z + b.hd], [b.x + b.hw, b.z + b.hd]];
  for (const [ax, az] of axes) {
    let mn1 = Infinity, mx1 = -Infinity, mn2 = Infinity, mx2 = -Infinity;
    for (const [px, pz] of corners) { const d = px * ax + pz * az; if (d < mn1) mn1 = d; if (d > mx1) mx1 = d; }
    for (const [px, pz] of bc) { const d = px * ax + pz * az; if (d < mn2) mn2 = d; if (d > mx2) mx2 = d; }
    if (mx1 < mn2 || mx2 < mn1) return false; // separated on this axis
  }
  return true;
}

const findings: string[] = [];
const notes: string[] = [];
const carTest = (label: string, x: number, z: number, heading: number, kind: string) => {
  const [hw, hl] = dimsOf(kind);
  for (const b of COLLIDERS) if (obbHitsBox(x, z, heading, hw, hl, b)) {
    findings.push(`CAR ${label} at (${x}, ${z}) heading ${heading.toFixed(2)} kind ${kind} intersects ${b.what} at (${b.x}, ${b.z}) hw ${b.hw} hd ${b.hd}`);
  }
};
const pointTest = (label: string, x: number, z: number, r = 0.4) => {
  if (isBlocked(x, z, r)) findings.push(`POINT ${label} at (${x}, ${z}) is inside a collider (isBlocked r=${r})`);
};
const circleTest = (label: string, x: number, z: number, r: number) => {
  for (const b of COLLIDERS) {
    if (Math.abs(x - b.x) < b.hw + r && Math.abs(z - b.z) < b.hd + r) {
      findings.push(`SCATTER ${label} at (${x}, ${z}) r=${r} intersects ${b.what} at (${b.x}, ${b.z})`);
    }
  }
};

// ================================================================
// 1. Parked / placed cars
// ================================================================
for (const s of CAR_SPAWNS) {
  if (s.kind === "boat" || s.kind === "skiff") {
    if (!isWaterAt(s.x, s.z)) findings.push(`BOAT spawn id ${s.id} at (${s.x}, ${s.z}) is NOT on water`);
    continue;
  }
  if (s.kind === "plane") { pointTest(`plane spawn id ${s.id}`, s.x, s.z, 1.3); continue; }
  carTest(`CAR_SPAWNS id ${s.id} (${s.model})`, s.x, s.z, s.heading, s.kind);
}
for (const zn of GARAGE_ZONES) carTest(`garage exit ${zn.id}`, zn.exitX, zn.exitZ, zn.exitHeading, "supercar");
for (const f of VALET_FRONTAGES) {
  carTest(`valet frontage ${f.name}`, f.x, f.z, f.heading, "suv");
  carTest(`valet bay ${f.name}`, f.bayX, f.bayZ, f.heading, "suv");
}
if (!isWaterAt(RENTAL_SPAWN.x, RENTAL_SPAWN.z)) findings.push(`RENTAL_SPAWN (${RENTAL_SPAWN.x}, ${RENTAL_SPAWN.z}) is NOT on water`);
carTest("mansion drive pad", MANSION_DRIVE.x, MANSION_DRIVE.z, Math.PI / 2, "supercar"); // cars park length-along-x on the pad, like the showpiece

// Phase 17 event spots — literals copied from components/Phase17.tsx
const CHALLENGE_SPOTS = [
  { x: 100, z: -56, heading: Math.PI }, { x: -96, z: 100, heading: Math.PI / 2 }, { x: 76, z: 264, heading: -Math.PI / 2 },
];
const CARGO_SPOTS: [number, number][] = [[20, 20], [-20, -40], [60, 64], [4, -100], [-100, 20]];
CHALLENGE_SPOTS.forEach((s, i) => carTest(`street-challenge spot ${i}`, s.x, s.z, s.heading, "hyper"));
CARGO_SPOTS.forEach(([x, z], i) => { if (!isOnRoad(x, z)) findings.push(`CARGO spot ${i} at (${x}, ${z}) is not on a road`); pointTest(`cargo spot ${i}`, x, z, 0.5); });

// ================================================================
// 2. Traffic lanes — sample every lane centreline over the REAL
// travel span (outer intersection to outer intersection, per
// GameSystems.initWorld); a car body (circle r = widest ambient
// half-width 1.15) must fit the whole way. One finding per collider
// per lane — the first clip point stands for the whole overlap.
// ================================================================
function laneSweep(label: string, fixed: number, along: "x" | "z", from: number, to: number) {
  for (const off of [-2.8, 2.8]) {
    const reported = new Set<string>();
    for (let t = from; t <= to; t += 1) {
      const x = along === "x" ? t : fixed + off;
      const z = along === "x" ? fixed + off : t;
      for (const b of COLLIDERS) {
        if (reported.has(b.what)) continue;
        if (Math.abs(x - b.x) < b.hw + 1.15 && Math.abs(z - b.z) < b.hd + 1.15) {
          // Allowlist: the parking garage's four thin perimeter walls.
          // Their meshes are the DECK rails at y≈3.75 (World.tsx) —
          // ground traffic passes under the deck, so there is no
          // visual contact; the 2D blockers exist to seal the
          // under-deck bays for the driven car, whose resolve nudge
          // there is shipped Phase 6 behaviour.
          const isGarageWall = (b.hw <= 0.5 || b.hd <= 0.5) && b.x > -84 && b.x < -52 && b.z > -280 && b.z < -248;
          if (isGarageWall) notes.push(`LANE ${label}: envelope reaches the parking-garage wall at (${b.x}, ${b.z}) — deck rail at y≈3.75, allowlisted`);
          else findings.push(`LANE ${label} lane ${off > 0 ? "+" : ""}${off} at (${x.toFixed(0)}, ${z.toFixed(0)}) clips ${b.what} at (${b.x}, ${b.z}) hw ${b.hw} hd ${b.hd}`);
          reported.add(b.what);
        }
      }
    }
  }
}
for (const c of ROAD_COORDS) { laneSweep(`main z=${c}`, c, "x", -100, 100); laneSweep(`main x=${c}`, c, "z", -100, 100); }
for (const c of CORAL_ROAD_Z) laneSweep(`coral z=${c}`, c, "x", 40, 104);
for (const c of CORAL_ROAD_X) laneSweep(`coral x=${c}`, c, "z", 224, 304);
for (const c of NORTH_ROAD_Z) laneSweep(`north z=${c}`, c, "x", -110, 30);
for (const c of NORTH_ROAD_X) laneSweep(`north x=${c}`, c, "z", -284, -212);
laneSweep("causeway", CAUSEWAY.x, "z", CAUSEWAY.z0, CAUSEWAY.z1);
laneSweep("bridge", BRIDGE.x, "z", BRIDGE.z0, BRIDGE.z1);

// ================================================================
// 3. Points: peds, POIs, doors, stops
// ================================================================
HAIL_POINTS.forEach((p) => pointTest(`hail ${p.name}`, p.x, p.z));
DEST_POINTS.forEach((p) => pointTest(`dest ${p.name}`, p.x, p.z));
PICKUP_POINTS.forEach((p) => pointTest(`pickup ${p.name}`, p.x, p.z));
BUS_STOPS.forEach((p, i) => pointTest(`bus stop ${i}`, p.x, p.z));
BUS_STOPS_RIDE.forEach((s) => { pointTest(`bus ride street ${s.name}`, s.streetX, s.streetZ); pointTest(`bus ride route ${s.name}`, s.routeX, s.routeZ, 1.3); });
FISHING_SPOTS.forEach((s) => {
  pointTest(`fishing stand ${s.name}`, s.x, s.z);
  if (!isWaterAt(s.castX, s.castZ)) findings.push(`FISHING cast point for ${s.name} at (${s.castX}, ${s.castZ}) is NOT on water`);
});
pointTest("derby pier", DERBY_PIER.x, DERBY_PIER.z);
pointTest("rental dock", RENTAL_DOCK.x, RENTAL_DOCK.z);
for (const b of BUSINESSES) pointTest(`business ${b.name}`, b.x, b.z);
pointTest("apartment buy point", APARTMENT.x, APARTMENT.z);
pointTest("loft buy point", LOFT.x, LOFT.z);
FUEL_STATIONS.forEach((f) => pointTest(`fuel ${f.name}`, f.x, f.z, 1.3));
REGISTERS.forEach((r) => pointTest(`register ${r.name}`, r.x, r.z));
pointTest("pawn shop", PAWN_SHOP.x, PAWN_SHOP.z);
pointTest("hospital door", HOSPITAL_DOOR.x, HOSPITAL_DOOR.z);
pointTest("dealership", DEALERSHIP.x, DEALERSHIP.z);
pointTest("gun store", GUN_STORE.x, GUN_STORE.z);
pointTest("vendor", VENDOR.x, VENDOR.z);
pointTest("barber", BARBER_POS.x, BARBER_POS.z);
pointTest("tattoo", TATTOO_POS.x, TATTOO_POS.z);
pointTest("club share point", CLUB_SHARE_POINT.x, CLUB_SHARE_POINT.z);
pointTest("car wash", CAR_WASH.x, CAR_WASH.z);
pointTest("pier spawn", PIER_SPAWN.x, PIER_SPAWN.z, 0.45);
pointTest("hospital respawn", HOSPITAL.x, HOSPITAL.z, 0.45);
pointTest("overlook", OVERLOOK.x, OVERLOOK.z);
pointTest("mansion gate", MANSION_GATE.x, MANSION_GATE.z);
pointTest("toll booth", TOLL.x, TOLL.z, 0.5);
SPEED_CAMERAS.forEach((c) => pointTest(`speed camera ${c.road}`, c.x, c.z, 0.3));
const DOORS: Record<string, { x: number; z: number }> = {
  GARAGE_EXT_DOOR, CLUB_EXT_DOOR, POLICE_EXT_DOOR, CLINIC_EXT_DOOR, RESTAURANT_EXT_DOOR,
  APARTMENT_DOOR, AIRPORT_DOOR, SHOWROOM_EXT_DOOR, CAFE_EXT_DOOR, GYM_EXT_DOOR,
  CLOTHING_EXT_DOOR, FARMHOUSE_EXT_DOOR, LOFT_EXT_DOOR,
};
for (const [name, d] of Object.entries(DOORS)) pointTest(`door ${name}`, d.x, d.z);
TOWNSFOLK.forEach((t) => t.stops.forEach((s) => pointTest(`townsfolk ${t.name} @ ${s.place}`, s.x, s.z)));
// staff beats: replicate StaffWorld.beatFor — the chosen pair must be
// unblocked for every business, and if the fallback (the buy point
// itself) is what gets chosen, that is a finding too.
const STAFF_OFFSETS: Array<[number, number]> = [[3.2, 3.2], [-3.2, 3.2], [3.2, -3.2], [-3.2, -3.2], [4.5, 0], [-4.5, 0], [0, 4.5], [0, -4.5]];
for (const b of BUSINESSES) {
  let ok = false;
  for (const [ox, oz] of STAFF_OFFSETS) {
    const ax = b.x + ox, az = b.z + oz, bx = b.x - ox, bz = b.z + oz;
    if (!isBlocked(ax, az, 0.4) && !isWaterAt(ax, az) && !isBlocked(bx, bz, 0.4) && !isWaterAt(bx, bz)) { ok = true; break; }
  }
  if (!ok) findings.push(`STAFF beat for ${b.name} at (${b.x}, ${b.z}): no unblocked offset pair — beatFor falls back to the buy point`);
}
// ped spawn formulas from GameSystems.initWorld (main + north spots)
const NORTH_PED_SPAWNS: [number, number][] = [[-97, -232], [-70, -262], [-36, -250], [-8, -226], [16, -262]];
NORTH_PED_SPAWNS.forEach(([x, z], i) => pointTest(`north ped spawn ${i}`, x, z));
// farm points
pointTest("farm barn front", FARM.barn.x, FARM.barn.z + 6, 0.45);
pointTest("farm house front", FARM.house.x, FARM.house.z + 6, 0.45);

// ================================================================
// 4. Scatter vs colliders: props, destructibles, lamps, trees, palms
// ================================================================
props.forEach((p, i) => circleTest(`prop ${p.kind} #${i}`, p.x, p.z, 0.35));
DESTRUCTIBLES.forEach((d, i) => circleTest(`destructible ${d.kind} #${i}`, d.x, d.z, 0.4));
lamps.forEach((l, i) => circleTest(`lamp #${i}`, l[0], l[2], 0.25));
trees.forEach((t, i) => circleTest(`tree #${i}`, t.x, t.z, 0.5));
palms.forEach((p, i) => circleTest(`palm #${i}`, p.x, p.z, 0.35));

// ================================================================
// 5. Pairwise parked cars, rush-reserve park spots, scatter vs the
// lane envelope, and the generator face invariant (Phase 25 clamp:
// every block-interior face keeps ≥ 4.0u from its grid's centrelines;
// frontage strips in STATIC_BLOCKERS are exempt — they line the
// street by design and are covered by the lane sweep instead).
// ================================================================
for (let i = 0; i < CAR_SPAWNS.length; i++) for (let j = i + 1; j < CAR_SPAWNS.length; j++) {
  const a = CAR_SPAWNS[i], b = CAR_SPAWNS[j];
  if (Math.abs(a.x - b.x) > 7 || Math.abs(a.z - b.z) > 7) continue;
  const [hw, hl] = dimsOf(a.kind);
  if (obbHitsBox(a.x, a.z, a.heading, hw, hl, { x: b.x, z: b.z, hw: dimsOf(b.kind)[0], hd: dimsOf(b.kind)[1], what: "" }))
    findings.push(`PAIR CAR_SPAWNS id ${a.id} at (${a.x}, ${a.z}) overlaps id ${b.id} at (${b.x}, ${b.z})`);
}
const PARK_SPOTS: [number, number, number][] = [[-100, -54.6, Math.PI / 2], [20, 65.4, -Math.PI / 2], [60, -114.6, Math.PI / 2], [-45.4, -20, 0], [105.4, 40, Math.PI], [-114.6, 80, 0]];
PARK_SPOTS.forEach(([x, z, h], i) => carTest(`rush-reserve park spot ${i}`, x, z, h, "sedan"));
function laneDist(x: number, z: number): number {
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
props.forEach((p, i) => { const d = laneDist(p.x, p.z); if (d < 3.95) findings.push(`ENVELOPE prop ${p.kind} #${i} at (${p.x}, ${p.z}) is ${d.toFixed(2)}u from a lane centreline (< 3.95)`); });
DESTRUCTIBLES.forEach((d, i) => { const dist = laneDist(d.x, d.z); if (dist < 3.95) findings.push(`ENVELOPE destructible ${d.kind} #${i} at (${d.x}, ${d.z}) is ${dist.toFixed(2)}u from a lane centreline (< 3.95)`); });
trees.forEach((t, i) => { const d = laneDist(t.x, t.z); if (d < 4.0) findings.push(`ENVELOPE tree #${i} at (${t.x.toFixed(1)}, ${t.z.toFixed(1)}) is ${d.toFixed(2)}u from a lane centreline (< 4.0: the visual trunk must clear the 3.95 traffic body sweep; the wider isBlocked trunk circle brushing a lane-centre car is the game's long-standing kerb-tree behaviour)`); });
function faceCheck(label: string, x: number, z: number, hw: number, hd: number, xs: number[], zs: number[]) {
  for (const c of xs) { const d = Math.abs(x - c) - hw; if (d < 4.0) findings.push(`FACE ${label} at (${x}, ${z}): x-face ${d.toFixed(2)}u from centreline ${c} (< 4.0)`); }
  for (const c of zs) { const d = Math.abs(z - c) - hd; if (d < 4.0) findings.push(`FACE ${label} at (${x}, ${z}): z-face ${d.toFixed(2)}u from centreline ${c} (< 4.0)`); }
}
for (const b of buildings) {
  if (b.district === "Coral Shores") faceCheck("building", b.x, b.z, b.width / 2, b.depth / 2, CORAL_ROAD_X, CORAL_ROAD_Z);
  else if (b.district === "Northgate") faceCheck("building", b.x, b.z, b.width / 2, b.depth / 2, NORTH_ROAD_X, NORTH_ROAD_Z);
  else faceCheck("building", b.x, b.z, b.width / 2, b.depth / 2, ROAD_COORDS, ROAD_COORDS);
}
houses.forEach((h, i) => { if (Math.hypot(h.x + 64, h.z - 168) < 20) return; faceCheck(`house#${i}`, h.x, h.z, 3.1, 2.9, ROAD_COORDS, ROAD_COORDS); }); // Sable Island cottages: no roads, exempt
NORTH_MANSIONS.forEach((m, i) => faceCheck(`north mansion#${i}`, m.x, m.z, 5.2, 4.2, NORTH_ROAD_X, NORTH_ROAD_Z));
// pairwise AABB interpenetration across the whole collider set —
// two solid boxes may touch at a face but never overlap in area.
// Exempt: the parking-garage perimeter walls (they JOIN at corners
// by design) and the mansion's own house+annex pair.
for (let i = 0; i < COLLIDERS.length; i++) for (let j = i + 1; j < COLLIDERS.length; j++) {
  const a = COLLIDERS[i], b = COLLIDERS[j];
  const ox = Math.min(a.x + a.hw, b.x + b.hw) - Math.max(a.x - a.hw, b.x - b.hw);
  const oz = Math.min(a.z + a.hd, b.z + b.hd) - Math.max(a.z - a.hd, b.z - b.hd);
  if (ox <= 0.02 || oz <= 0.02) continue;
  const inGarage = (p: Box) => p.x > -84 && p.x < -52 && p.z > -280 && p.z < -248;
  if (inGarage(a) && inGarage(b) && a.what.startsWith("static") && b.what.startsWith("static")) continue;
  if (a.what.includes("mansion") && b.what.includes("mansion")) continue;
  findings.push(`OVERLAP ${a.what} at (${a.x}, ${a.z}) hw ${a.hw} hd ${a.hd} interpenetrates ${b.what} at (${b.x}, ${b.z}) hw ${b.hw} hd ${b.hd} by ${ox.toFixed(2)}x${oz.toFixed(2)}`);
}

// ================================================================
console.log(`colliders checked: ${COLLIDERS.length}`);
if (notes.length) { console.log("— notes —"); notes.forEach((n) => console.log("  " + n)); }
if (findings.length) {
  console.log(`\n${findings.length} INTERSECTION(S) FOUND:`);
  findings.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
console.log("ALL PLACEMENTS CLEAR");
