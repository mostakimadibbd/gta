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
//   · Phase 26: Westbrook, the second streamed district — its data
//     module (game/westbrookData.ts) is imported directly and its
//     parked cars / walker beats / colliders are audited internally,
//     plus its gate + bounds against the base world (section 6)
//   · Phase 31: Northreach, the third streamed district — same rig
//     against game/northreachData.ts, plus a siting check: its
//     bounds must clear Northgate's north shore (section 7)
//   · Phase 32: the service jobs — the ambulance/tender shift
//     spawns as car tests, the fire station door joins the door
//     set (its new strip blocker is pairwise/lane-checked like
//     every other), and the patient/fire spots must be standable
//   · Phase 34: the Sable Slide Series courses (game/slide.ts
//     imported directly) — starts as car tests, gate centres
//     body-checked against the collider set (section 8)
//   · Phase 37: the Quiet Harbour arc (game/missions.ts imported
//     directly) — quiet1's shoreline pickups standable + on land,
//     quiet2's Northreach targets + Lina's Point figure checked
//     against the district blockers, quiet3's bench target, and the
//     arc's figure spots (literals mirrored from the React module
//     components/QuietHarbour.tsx; keep in sync) (section 9)
//   · Phase 42: harbour wildlife — the dolphin pod's route
//     (game/wildlife.ts imported directly; the audit walks the
//     same Catmull-Rom curve the game swims: open water, island /
//     bridge / moored-boat clearances, chart bounds) and the
//     perched gulls' mooring posts (section 11)
//   · Phase 43: the Sable Postcards (game/postcards.ts imported
//     directly) — the set's shape (8 postcards, unique ids, fees in
//     the $75–$150 band) and every fixed anchor pinned to the real
//     world data it names: the bridge centre from BRIDGE, the club
//     frontage against STATIC_BLOCKERS, the observatory against
//     NORTHREACH_BLOCKERS, Breakwater Point against
//     WESTBROOK_VIEWPOINT, the storm anchor in open water, and the
//     hillside sign on land with a standable viewpoint south of it
//     (section 12)
//   · Phase 47: DAY EVENTS (game/dayevents.ts imported directly) —
//     the regatta course (gate + buoys) walked on the section 11
//     rig (open water, island / bridge / moored-hull clearances,
//     chart clamp, course legs that can't degenerate), and the
//     Coral market: stall footprints + crowd spots against the
//     colliders, the driven lane segments, the bridge ramp
//     landing and the promenade doors, plus the set's shape
//     (target / prize / discount / bonus pins, and marketPrice's
//     dollar-exact values) (section 13)
//   · Phase 48: THE HARBOUR CROWN — the endgame chain's defs come
//     from the real game/missions.ts: crown1's meet pinned to
//     WESTBROOK_VIEWPOINT + its photo points against Eastmere's
//     blockers (mirrored from components/Eastmere.tsx — no pure
//     data module), crown2's container point standable on the quay
//     (not the bridge deck), crown3's auction frontage + the
//     CrownWorld figure spots against the mansion row, crown4's
//     boat leg (the east-channel sailing line walked on the water
//     rig + the observatory jetty landing OFF the Northreach land
//     bounds, so it stays water when the district loads), and the
//     Vantara Sovereign kind census (CAR_MODELS + drift factor +
//     never dealer-sold) (section 14)
//   · Phase 39: two more interiors — the Eastmere Diner door
//     (against the diner blocker mirrored from Eastmere.tsx, which
//     has no pure data module, + the district bounds) and the
//     Westbrook silo office door (against WESTBROOK_BLOCKERS +
//     bounds), plus a containment test for EVERY pocket room:
//     each INTERIORS spawnIn/exitDoor inside the rect the Player
//     clamp enforces (section 10)
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
  NORTH_MANSIONS, FIRE_EXT_DOOR,
  DINER_EXT_DOOR, SILO_EXT_DOOR, INTERIORS, groundYAt,
  CAR_MODELS, DEALER_CARS,
} from "../client/src/world";
import { HAIL_POINTS, DEST_POINTS, PICKUP_POINTS, VALET_FRONTAGES, AMBULANCE_SPAWN, FIRETRUCK_SPAWN, MED_SPOTS, FIRE_SPOTS } from "../client/src/game/jobs";
import { BUS_STOPS_RIDE } from "../client/src/game/bus";
import { DERBY_PIER } from "../client/src/game/derby";
import { FISHING_SPOTS } from "../client/src/game/phase8";
import { BUSINESSES, APARTMENT, LOFT, RENTAL_PROPERTIES } from "../client/src/game/economy";
import { RENTAL_DOCK, RENTAL_SPAWN } from "../client/src/game/rentals";
import { TOWNSFOLK, BARBER_POS, TATTOO_POS } from "../client/src/game/phase9";
import { STREAMED_DISTRICTS } from "../client/src/world";
import { WESTBROOK_BLOCKERS, WESTBROOK_PARKED, WESTBROOK_WALKERS, WESTBROOK_VIEWPOINT } from "../client/src/game/westbrookData";
import { NORTHREACH_BLOCKERS, NORTHREACH_PARKED, NORTHREACH_WALKERS, NORTHREACH_VIEWPOINT } from "../client/src/game/northreachData";
import { NORTH } from "../client/src/world";
import { SLIDE_ROUNDS } from "../client/src/game/slide";
import { SIDE_MISSIONS } from "../client/src/game/missions";
import { POD_ROUTE, POD_PATH_LENGTH, podPathPoint, GULL_PERCHES } from "../client/src/game/wildlife";
import { POSTCARD_DEFS } from "../client/src/game/postcards";
import { DRIFT_FACTOR } from "../client/src/game/drift";
import {
  REGATTA_GATE, REGATTA_GATE_BUOYS, REGATTA_BUOYS, REGATTA_TARGET_S, REGATTA_PRIZE,
  MARKET_STALLS, MARKET_CROWD, PARTS_DEALS, MARKET_PARTS_DISCOUNT, MARKET_FENCE_BONUS, marketPrice,
} from "../client/src/game/dayevents";

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
  tempest: [1.06, 2.18], mule: [1.1, 2.1], // Phase 28
  ambulance: [1.05, 2.1], firetruck: [1.1, 2.2], // Phase 32
  sovereign: [1.08, 2.2], // Phase 48
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
// Phase 32: the service fleet's shift spawns — the ambulance on the
// hospital lot, the tender on the civic lot west of the fire
// station. Both lots also host the dispatch sim's rush-event
// parking (a visual mesh, not a collider), so what matters here is
// the collider test: the spawned unit must not sit in a wall.
carTest("ambulance shift spawn", AMBULANCE_SPAWN.x, AMBULANCE_SPAWN.z, AMBULANCE_SPAWN.heading, "ambulance");
carTest("fire tender shift spawn", FIRETRUCK_SPAWN.x, FIRETRUCK_SPAWN.z, FIRETRUCK_SPAWN.heading, "firetruck");

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
// Phase 30: rental property doors — the player must be able to
// STAND at each one (the warehouse door is also covered against
// its own new strip blocker by this same isBlocked test)
RENTAL_PROPERTIES.forEach((p) => pointTest(`rental door ${p.name}`, p.x, p.z));
// Phase 32: the service jobs' working points — a patient lies AT
// the spot and the medic stands beside them; a fire burns at its
// spot and the firefighter stands in hose range. The spots are the
// dispatch sim's own roadside points (reachable by construction);
// this test keeps a future spot edit from stranding one in a wall.
MED_SPOTS.forEach((p) => pointTest(`patient spot ${p.name}`, p.x, p.z));
FIRE_SPOTS.forEach((p) => pointTest(`fire spot ${p.name}`, p.x, p.z));
// Phase 33: the Kestrel Carbine's world pickup (Combat.tsx PICKUPS —
// a component-local table the audit cannot import, so the point is
// mirrored here like the BODY_DIMS copy: the mansion drive's east
// end, the same strip as the shipped pistol pickup)
pointTest("carbine pickup (mansion drive)", -75.5, 96.5);
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
  CLOTHING_EXT_DOOR, FARMHOUSE_EXT_DOOR, LOFT_EXT_DOOR, FIRE_EXT_DOOR,
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
// 6. Phase 26: Westbrook — the second streamed district. Its data
// module is imported directly (pure data — the same table the lazy
// chunk renders from, game/westbrookData.ts). District-internal
// placements are tested against the district's OWN colliders; the
// gate is tested against the base world; the bounds must sit in
// open water pre-load (a streamed district is land only once its
// chunk registers it) and must not touch any base-world collider.
// ================================================================
const WB = STREAMED_DISTRICTS.find((d) => d.id === "westbrook");
if (!WB) findings.push("WESTBROOK: no registry entry in STREAMED_DISTRICTS");
else {
  const WB_BOXES: Box[] = WESTBROOK_BLOCKERS.map((b, i) => ({ x: b.x, z: b.z, hw: b.hw, hd: b.hd, what: `westbrook blocker#${i}` }));
  if (!isWaterAt((WB.x0 + WB.x1) / 2, (WB.z0 + WB.z1) / 2)) findings.push(`WESTBROOK bounds centre (${(WB.x0 + WB.x1) / 2}, ${(WB.z0 + WB.z1) / 2}) is not open water pre-load`);
  if (WB.x1 > -126) findings.push(`WESTBROOK bounds x1=${WB.x1} reach past the mainland west shore (-126)`);
  pointTest("westbrook gate", WB.gate.x, WB.gate.z, 1.0);
  for (const b of WB_BOXES) for (const c of COLLIDERS) {
    const ox = Math.min(b.x + b.hw, c.x + c.hw) - Math.max(b.x - b.hw, c.x - c.hw);
    const oz = Math.min(b.z + b.hd, c.z + c.hd) - Math.max(b.z - b.hd, c.z - c.hd);
    if (ox > 0.02 && oz > 0.02) findings.push(`WESTBROOK ${b.what} at (${b.x}, ${b.z}) interpenetrates base-world ${c.what} at (${c.x}, ${c.z})`);
  }
  for (let i = 0; i < WB_BOXES.length; i++) for (let j = i + 1; j < WB_BOXES.length; j++) {
    const a = WB_BOXES[i], b = WB_BOXES[j];
    const ox = Math.min(a.x + a.hw, b.x + b.hw) - Math.max(a.x - a.hw, b.x - b.hw);
    const oz = Math.min(a.z + a.hd, b.z + b.hd) - Math.max(a.z - a.hd, b.z - b.hd);
    if (ox > 0.02 && oz > 0.02) findings.push(`WESTBROOK OVERLAP ${a.what} at (${a.x}, ${a.z}) interpenetrates ${b.what} at (${b.x}, ${b.z}) by ${ox.toFixed(2)}x${oz.toFixed(2)}`);
  }
  for (const p of WESTBROOK_PARKED) {
    const [hw, hl] = dimsOf(p.kind);
    for (const b of WB_BOXES) if (obbHitsBox(p.x, p.z, p.heading, hw, hl, b)) findings.push(`WESTBROOK parked ${p.kind} at (${p.x}, ${p.z}) intersects ${b.what} at (${b.x}, ${b.z})`);
    if (p.x < WB.x0 + 2 || p.x > WB.x1 - 2 || p.z < WB.z0 + 2 || p.z > WB.z1 - 2) findings.push(`WESTBROOK parked ${p.kind} at (${p.x}, ${p.z}) sits outside the district land bounds`);
  }
  for (let i = 0; i < WESTBROOK_PARKED.length; i++) for (let j = i + 1; j < WESTBROOK_PARKED.length; j++) {
    const a = WESTBROOK_PARKED[i], b = WESTBROOK_PARKED[j];
    if (Math.abs(a.x - b.x) > 7 || Math.abs(a.z - b.z) > 7) continue;
    const [hw, hl] = dimsOf(a.kind);
    if (obbHitsBox(a.x, a.z, a.heading, hw, hl, { x: b.x, z: b.z, hw: dimsOf(b.kind)[0], hd: dimsOf(b.kind)[1], what: "" }))
      findings.push(`WESTBROOK PAIR parked at (${a.x}, ${a.z}) overlaps parked at (${b.x}, ${b.z})`);
  }
  // walker beats: endpoints AND the walked segments between them,
  // sampled every 1u, against the district colliders (r = 0.4 body)
  for (const w of WESTBROOK_WALKERS) {
    for (let s = 0; s + 1 < w.beats.length; s++) {
      const [ax, az] = w.beats[s], [bx, bz] = w.beats[s + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az)));
      for (let t = 0; t <= steps; t++) {
        const px = ax + (bx - ax) * (t / steps), pz = az + (bz - az) * (t / steps);
        for (const b of WB_BOXES) {
          if (Math.abs(px - b.x) < b.hw + 0.4 && Math.abs(pz - b.z) < b.hd + 0.4) {
            findings.push(`WESTBROOK walker beat (${ax}, ${az})->(${bx}, ${bz}) passes through ${b.what} at (${b.x}, ${b.z}) near (${px.toFixed(1)}, ${pz.toFixed(1)})`);
            break;
          }
        }
      }
    }
  }
  for (const b of WB_BOXES) {
    if (Math.abs(WESTBROOK_VIEWPOINT.x - b.x) < b.hw + 0.4 && Math.abs(WESTBROOK_VIEWPOINT.z - b.z) < b.hd + 0.4)
      findings.push(`WESTBROOK viewpoint at (${WESTBROOK_VIEWPOINT.x}, ${WESTBROOK_VIEWPOINT.z}) is inside ${b.what} at (${b.x}, ${b.z})`);
  }
  console.log(`westbrook colliders checked: ${WB_BOXES.length}`);
}

// ================================================================
// 7. Phase 31: Northreach — the third streamed district. Same rig
// as section 6 against game/northreachData.ts (the same table the
// lazy chunk renders from). Siting checks: the bounds sit in open
// water pre-load, and the district's south edge must clear
// Northgate's north shore — the bridge spans the gap, the two
// landmasses never touch.
// ================================================================
const NR = STREAMED_DISTRICTS.find((d) => d.id === "northreach");
if (!NR) findings.push("NORTHREACH: no registry entry in STREAMED_DISTRICTS");
else {
  const NR_BOXES: Box[] = NORTHREACH_BLOCKERS.map((b, i) => ({ x: b.x, z: b.z, hw: b.hw, hd: b.hd, what: `northreach blocker#${i}` }));
  if (!isWaterAt((NR.x0 + NR.x1) / 2, (NR.z0 + NR.z1) / 2)) findings.push(`NORTHREACH bounds centre (${(NR.x0 + NR.x1) / 2}, ${(NR.z0 + NR.z1) / 2}) is not open water pre-load`);
  if (NR.z1 >= NORTH.z0) findings.push(`NORTHREACH bounds z1=${NR.z1} reach into Northgate's land (north shore z=${NORTH.z0}) — the bridge gap is gone`);
  if (NR.gate.x !== -20) findings.push(`NORTHREACH gate x=${NR.gate.x} is not on the x=-20 road column it bridges from`);
  pointTest("northreach gate", NR.gate.x, NR.gate.z, 1.0);
  for (const b of NR_BOXES) for (const c of COLLIDERS) {
    const ox = Math.min(b.x + b.hw, c.x + c.hw) - Math.max(b.x - b.hw, c.x - c.hw);
    const oz = Math.min(b.z + b.hd, c.z + c.hd) - Math.max(b.z - b.hd, c.z - c.hd);
    if (ox > 0.02 && oz > 0.02) findings.push(`NORTHREACH ${b.what} at (${b.x}, ${b.z}) interpenetrates base-world ${c.what} at (${c.x}, ${c.z})`);
  }
  for (let i = 0; i < NR_BOXES.length; i++) for (let j = i + 1; j < NR_BOXES.length; j++) {
    const a = NR_BOXES[i], b = NR_BOXES[j];
    const ox = Math.min(a.x + a.hw, b.x + b.hw) - Math.max(a.x - a.hw, b.x - b.hw);
    const oz = Math.min(a.z + a.hd, b.z + b.hd) - Math.max(a.z - a.hd, b.z - b.hd);
    if (ox > 0.02 && oz > 0.02) findings.push(`NORTHREACH OVERLAP ${a.what} at (${a.x}, ${a.z}) interpenetrates ${b.what} at (${b.x}, ${b.z}) by ${ox.toFixed(2)}x${oz.toFixed(2)}`);
  }
  for (const p of NORTHREACH_PARKED) {
    const [hw, hl] = dimsOf(p.kind);
    for (const b of NR_BOXES) if (obbHitsBox(p.x, p.z, p.heading, hw, hl, b)) findings.push(`NORTHREACH parked ${p.kind} at (${p.x}, ${p.z}) intersects ${b.what} at (${b.x}, ${b.z})`);
    if (p.x < NR.x0 + 2 || p.x > NR.x1 - 2 || p.z < NR.z0 + 2 || p.z > NR.z1 - 2) findings.push(`NORTHREACH parked ${p.kind} at (${p.x}, ${p.z}) sits outside the district land bounds`);
  }
  for (let i = 0; i < NORTHREACH_PARKED.length; i++) for (let j = i + 1; j < NORTHREACH_PARKED.length; j++) {
    const a = NORTHREACH_PARKED[i], b = NORTHREACH_PARKED[j];
    if (Math.abs(a.x - b.x) > 7 || Math.abs(a.z - b.z) > 7) continue;
    const [hw, hl] = dimsOf(a.kind);
    if (obbHitsBox(a.x, a.z, a.heading, hw, hl, { x: b.x, z: b.z, hw: dimsOf(b.kind)[0], hd: dimsOf(b.kind)[1], what: "" }))
      findings.push(`NORTHREACH PAIR parked at (${a.x}, ${a.z}) overlaps parked at (${b.x}, ${b.z})`);
  }
  // walker beats: endpoints AND the walked segments between them,
  // sampled every 1u, against the district colliders (r = 0.4 body)
  for (const w of NORTHREACH_WALKERS) {
    for (let s = 0; s + 1 < w.beats.length; s++) {
      const [ax, az] = w.beats[s], [bx, bz] = w.beats[s + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az)));
      for (let t = 0; t <= steps; t++) {
        const px = ax + (bx - ax) * (t / steps), pz = az + (bz - az) * (t / steps);
        for (const b of NR_BOXES) {
          if (Math.abs(px - b.x) < b.hw + 0.4 && Math.abs(pz - b.z) < b.hd + 0.4) {
            findings.push(`NORTHREACH walker beat (${ax}, ${az})->(${bx}, ${bz}) passes through ${b.what} at (${b.x}, ${b.z}) near (${px.toFixed(1)}, ${pz.toFixed(1)})`);
            break;
          }
        }
      }
    }
  }
  for (const b of NR_BOXES) {
    if (Math.abs(NORTHREACH_VIEWPOINT.x - b.x) < b.hw + 0.4 && Math.abs(NORTHREACH_VIEWPOINT.z - b.z) < b.hd + 0.4)
      findings.push(`NORTHREACH viewpoint at (${NORTHREACH_VIEWPOINT.x}, ${NORTHREACH_VIEWPOINT.z}) is inside ${b.what} at (${b.x}, ${b.z})`);
  }
  console.log(`northreach colliders checked: ${NR_BOXES.length}`);
}

// ================================================================
// 8. Phase 34: the Sable Slide Series courses (game/slide.ts — the
// real defs, imported). A course start must hold a car; every gate
// centre must fit a car body (circle r = widest drift-car half-width
// 1.15 vs the collider set, the lane-sweep test in miniature) and
// stand clear of the point blockers. The routes themselves ride
// roads the lane sweep (section 2) already covers end to end —
// Docks Yard and Northgate Interchange reuse the street-race
// checkpoint geography, Bay Infield the Bay Run's.
// ================================================================
for (const def of SLIDE_ROUNDS) {
  carTest(`slide start ${def.name}`, def.start[0], def.start[1], 0, "coupe");
  def.gates.forEach(([gx, gz], gi) => {
    circleTest(`slide gate ${def.name} #${gi + 1}`, gx, gz, 1.15);
    pointTest(`slide gate ${def.name} #${gi + 1}`, gx, gz);
  });
  console.log(`slide course checked: ${def.name} (${def.gates.length} gates)`);
}

// ================================================================
// 9. Phase 37: THE QUIET HARBOUR — the post-story arc's placements.
// The mission defs come from the real game/missions.ts, so a target
// can never drift from the audit. quiet1's pickups are shoreline
// collect steps (3.4u reach radius, on foot): each must be standable
// and on LAND (the beach band, not the water it fronts). quiet2's
// last two steps and Lina's Northreach Point figure live inside the
// streamed district, whose blockers are NOT in the base collider
// set — they are tested against NORTHREACH_BLOCKERS directly (the
// section 7 rig), and must sit inside the district bounds. quiet3's
// bench is a world.ts prop, so sections 4/5 already cover the bench
// itself; here its mission target and the two figures beside it are
// point-tested explicitly. Figure spots are literals mirrored from
// components/QuietHarbour.tsx (a React module — keep in sync).
// ================================================================
{
  const quiet = Object.fromEntries(SIDE_MISSIONS.filter((m) => m.side === "quiet").map((m) => [m.id, m]));
  for (const id of ["quiet1", "quiet2", "quiet3"]) if (!quiet[id]) findings.push(`QUIET: mission def ${id} missing from SIDE_MISSIONS`);
  if (quiet.quiet1) quiet.quiet1.targets.forEach(([x, z], i) => {
    pointTest(`quiet1 marker #${i + 1}`, x, z, 0.4);
    if (isWaterAt(x, z)) findings.push(`QUIET quiet1 marker #${i + 1} at (${x}, ${z}) is in the water — a shoreline pickup must stand on the beach`);
  });
  if (quiet.quiet2) {
    const NR_BOXES2: Box[] = NORTHREACH_BLOCKERS.map((b, i) => ({ x: b.x, z: b.z, hw: b.hw, hd: b.hd, what: `northreach blocker#${i}` }));
    const NRB = STREAMED_DISTRICTS.find((d) => d.id === "northreach");
    pointTest("quiet2 garage pickup", quiet.quiet2.targets[0][0], quiet.quiet2.targets[0][1], 1.0);
    quiet.quiet2.targets.slice(1).forEach(([x, z], i) => {
      for (const b of NR_BOXES2) if (Math.abs(x - b.x) < b.hw + 1.0 && Math.abs(z - b.z) < b.hd + 1.0) findings.push(`QUIET quiet2 target #${i + 2} at (${x}, ${z}) is inside ${b.what} at (${b.x}, ${b.z})`);
      if (NRB && (x < NRB.x0 || x > NRB.x1 || z < NRB.z0 || z > NRB.z1)) findings.push(`QUIET quiet2 target #${i + 2} at (${x}, ${z}) sits outside the Northreach bounds`);
    });
    // Lina's figure at Northreach Point during the closing beat
    for (const b of NR_BOXES2) if (Math.abs(-17.6 - b.x) < b.hw + 0.4 && Math.abs(-362.2 - b.z) < b.hd + 0.4) findings.push(`QUIET Lina Point figure at (-17.6, -362.2) is inside ${b.what} at (${b.x}, ${b.z})`);
  }
  if (quiet.quiet3) {
    pointTest("quiet3 bench target", quiet.quiet3.targets[0][0], quiet.quiet3.targets[0][1], 0.4);
    circleTest("quiet3 bench (plaque post)", 72, 199.9, 0.35);
  }
  // figure spots (components/QuietHarbour.tsx literals)
  pointTest("quiet figure Elias (pier)", 1.2, 107.5, 0.4);
  pointTest("quiet figure Lina (garage)", -38.5, -22.5, 0.4);
  pointTest("quiet figure Elias (bench)", 70.1, 200.6, 0.4);
  pointTest("quiet figure Tamim (bench)", 73.9, 200.6, 0.4);
  console.log("quiet harbour spots checked: quiet1 x3, quiet2 x3 + figure, quiet3 + plaque, figures x4");
}

// ================================================================
// 10. Phase 39: TWO MORE INTERIORS — the new street doors + every
// pocket's spawn/exit containment. The doors stand in streamed
// districts, whose colliders are not in the base set: the silo
// door is tested against WESTBROOK_BLOCKERS (section 6's rig) and
// the Westbrook bounds; the diner door against Eastmere's diner
// blocker — Eastmere has no pure data module (its blockers live
// in the React chunk), so the blocker is mirrored here exactly as
// sections 5/9 mirror React-module literals (keep in sync with
// components/Eastmere.tsx) — and the Eastmere bounds. Containment:
// every INTERIORS spawnIn + exitDoor must sit inside the room
// rect the Player clamp enforces (half extents minus the 0.55
// body margin), so a door fade can never land the player outside
// the room's own walls. (Pockets fail isBlocked by design — this
// is a containment test, not a collision test.)
// ================================================================
{
  const EM = STREAMED_DISTRICTS.find((d) => d.id === "eastmere");
  const WB2 = STREAMED_DISTRICTS.find((d) => d.id === "westbrook");
  const DINER_BLOCKER = { x: 60, z: -258, hw: 3.5, hd: 2.5 }; // components/Eastmere.tsx BLOCKERS (mirrored)
  if (Math.abs(DINER_EXT_DOOR.x - DINER_BLOCKER.x) < DINER_BLOCKER.hw + 0.4 && Math.abs(DINER_EXT_DOOR.z - DINER_BLOCKER.z) < DINER_BLOCKER.hd + 0.4)
    findings.push(`PHASE39 diner door at (${DINER_EXT_DOOR.x}, ${DINER_EXT_DOOR.z}) is inside the diner blocker at (60, -258)`);
  if (!EM) findings.push("PHASE39: no eastmere registry entry in STREAMED_DISTRICTS");
  else if (DINER_EXT_DOOR.x < EM.x0 || DINER_EXT_DOOR.x > EM.x1 || DINER_EXT_DOOR.z < EM.z0 || DINER_EXT_DOOR.z > EM.z1)
    findings.push(`PHASE39 diner door at (${DINER_EXT_DOOR.x}, ${DINER_EXT_DOOR.z}) sits outside the Eastmere bounds`);
  for (const b of WESTBROOK_BLOCKERS) {
    if (Math.abs(SILO_EXT_DOOR.x - b.x) < b.hw + 0.4 && Math.abs(SILO_EXT_DOOR.z - b.z) < b.hd + 0.4)
      findings.push(`PHASE39 silo door at (${SILO_EXT_DOOR.x}, ${SILO_EXT_DOOR.z}) is inside westbrook blocker at (${b.x}, ${b.z})`);
  }
  if (!WB2) findings.push("PHASE39: no westbrook registry entry in STREAMED_DISTRICTS");
  else if (SILO_EXT_DOOR.x < WB2.x0 || SILO_EXT_DOOR.x > WB2.x1 || SILO_EXT_DOOR.z < WB2.z0 || SILO_EXT_DOOR.z > WB2.z1)
    findings.push(`PHASE39 silo door at (${SILO_EXT_DOOR.x}, ${SILO_EXT_DOOR.z}) sits outside the Westbrook bounds`);
  let rooms = 0;
  for (const [kind, def] of Object.entries(INTERIORS)) {
    rooms++;
    for (const [label, p] of [["spawnIn", def.spawnIn], ["exitDoor", def.exitDoor]] as const) {
      if (Math.abs(p[0] - def.cx) > def.w / 2 - 0.55 || Math.abs(p[1] - def.cz) > def.d / 2 - 0.55)
        findings.push(`PHASE39 interior ${kind} ${label} at (${p[0]}, ${p[1]}) escapes its room rect (clamp half extents ${(def.w / 2 - 0.55).toFixed(2)} x ${(def.d / 2 - 0.55).toFixed(2)})`);
    }
  }
  console.log(`phase 39 doors checked: diner + silo; interior containment checked: ${rooms} rooms`);
}

// ================================================================
// 11. Phase 42: HARBOUR WILDLIFE — the dolphin pod's route and
// the perched gulls' mooring posts. game/wildlife.ts is imported
// directly, so the audit walks the SAME Catmull-Rom curve the
// component swims (podPathPoint over the arc-length table): every
// sample must be open water under the game's own isWaterAt, stay
// at least 19u from Sable Island's centre (island r 17 — a 2u
// shoreline margin), stay west of the bay bridge deck (BRIDGE
// x 60 ± halfW 5, expanded 8u), inside the boat chart clamp
// (Vehicle.tsx: x −240..170, z −412..368), and clear of the
// moored harbour-life boats + the rental skiff spawn (literals
// mirrored from components/World.tsx HARBOUR LIFE + game/
// rentals.ts RENTAL_SPAWN; keep in sync — the live-traffic dive
// rule in Wildlife.tsx covers moving boats, these are the static
// hulls the route itself must never cross). The gull posts must
// stand on land, outside every collider, and at least 3u from
// the fishing stand points + the rental dock point.
// ================================================================
{
  const ISLAND_C = { x: -64, z: 168 };
  const MOORED: Array<{ name: string; x: number; z: number; clear: number }> = [
    { name: "yacht", x: 62, z: 152, clear: 12 },
    { name: "tug", x: 18, z: 141, clear: 6.5 },
    { name: "rental skiff spawn", x: -4, z: 138, clear: 8 },
  ];
  // The cargo ship is a 44-long hull — a centre distance is a bad
  // proxy (its bow reaches z ≈ 146, 22 from the centre), so the
  // route is measured against the hull BOX in ship-local coords:
  // centre (-72,168), rotation 0.12, half-extents 22 (axis) x
  // 5.25 (beam); the value is the true outside distance to the
  // box, and the route must keep 3u off the surface.
  const SHIP_AXIS = { x: Math.sin(0.12), z: Math.cos(0.12) };
  const SHIP_PERP = { x: Math.cos(0.12), z: -Math.sin(0.12) };
  const shipBoxDist = (px: number, pz: number) => {
    const dx = px - -72, dz = pz - 168;
    const u = Math.abs(dx * SHIP_AXIS.x + dz * SHIP_AXIS.z) - 22;
    const v = Math.abs(dx * SHIP_PERP.x + dz * SHIP_PERP.z) - 5.25;
    return Math.hypot(Math.max(u, 0), Math.max(v, 0));
  };
  let samples = 0;
  for (let d = 0; d < POD_PATH_LENGTH; d += 1.5) {
    const p = podPathPoint(d);
    samples++;
    if (!isWaterAt(p.x, p.z)) findings.push(`PHASE42 pod route leaves open water at (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
    const di = Math.hypot(p.x - ISLAND_C.x, p.z - ISLAND_C.z);
    if (di < 19) findings.push(`PHASE42 pod route closes to ${di.toFixed(1)}u of Sable Island centre at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) (min 19)`);
    if (p.x > BRIDGE.x - BRIDGE.halfW - 8 && p.z > BRIDGE.z0 - 8 && p.z < BRIDGE.z1 + 8)
      findings.push(`PHASE42 pod route enters the bridge clearance box at (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
    if (p.x < -240 || p.x > 170 || p.z < -412 || p.z > 368)
      findings.push(`PHASE42 pod route exits the boat chart at (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
    for (const m of MOORED) {
      const dm = Math.hypot(p.x - m.x, p.z - m.z);
      if (dm < m.clear) findings.push(`PHASE42 pod route closes to ${dm.toFixed(1)}u of the moored ${m.name} at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) (min ${m.clear})`);
    }
    const dShip = shipBoxDist(p.x, p.z);
    if (dShip < 3) findings.push(`PHASE42 pod route closes to ${dShip.toFixed(1)}u of the cargo ship's hull at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) (min 3 off the surface)`);
  }
  for (const wp of POD_ROUTE) {
    if (!isWaterAt(wp[0], wp[1])) findings.push(`PHASE42 pod waypoint (${wp[0]}, ${wp[1]}) is not open water`);
  }
  for (const g of GULL_PERCHES) {
    if (isWaterAt(g.x, g.z)) findings.push(`PHASE42 gull post at (${g.x}, ${g.z}) stands in water`);
    if (isBlocked(g.x, g.z)) findings.push(`PHASE42 gull post at (${g.x}, ${g.z}) is inside a collider`);
    for (const s of FISHING_SPOTS) {
      if (Math.hypot(g.x - s.x, g.z - s.z) < 3) findings.push(`PHASE42 gull post at (${g.x}, ${g.z}) crowds fishing stand point ${s.name}`);
    }
    if (Math.hypot(g.x - RENTAL_DOCK.x, g.z - RENTAL_DOCK.z) < 3) findings.push(`PHASE42 gull post at (${g.x}, ${g.z}) crowds the rental dock point`);
  }
  console.log(`phase 42 wildlife checked: pod route ${samples} samples over ${POD_PATH_LENGTH.toFixed(0)}u, ${GULL_PERCHES.length} gull posts`);
}

// ================================================================
// 12. Phase 43: THE SABLE POSTCARDS — the challenge set's shape
// and its fixed anchors, each pinned to the real data it names so
// an anchor can never silently drift off its subject. (The pod and
// air-support postcards are honestly anchorless: one moves, the
// other is wherever the player stands.)
// ================================================================
{
  if (POSTCARD_DEFS.length !== 8) findings.push(`PHASE43 postcard set has ${POSTCARD_DEFS.length} entries (want 8)`);
  const ids = new Set(POSTCARD_DEFS.map((d) => d.id));
  if (ids.size !== POSTCARD_DEFS.length) findings.push("PHASE43 postcard ids are not unique");
  for (const d of POSTCARD_DEFS) {
    if (d.fee < 75 || d.fee > 150) findings.push(`PHASE43 postcard ${d.id} fee $${d.fee} outside the $75–$150 band`);
  }
  const anchorOf = (id: string) => POSTCARD_DEFS.find((d) => d.id === id)?.anchor;
  const gs = anchorOf("golden-span");
  if (!gs || gs.x !== BRIDGE.x || gs.z !== (BRIDGE.z0 + BRIDGE.z1) / 2)
    findings.push("PHASE43 golden-span anchor is not the BRIDGE centre");
  const club = anchorOf("club-neon");
  if (!club || !STATIC_BLOCKERS.some((b) => Math.abs(b.x - club.x) < 0.01 && Math.abs(b.z - club.z) < 0.01))
    findings.push("PHASE43 club-neon anchor matches no STATIC_BLOCKERS entry (Club Solace exterior)");
  const dome = anchorOf("the-dome");
  if (!dome || !NORTHREACH_BLOCKERS.some((b) => Math.abs(b.x - dome.x) < 0.01 && Math.abs(b.z - dome.z) < 0.01))
    findings.push("PHASE43 the-dome anchor matches no NORTHREACH_BLOCKERS entry (the observatory)");
  const bw = anchorOf("breakwater-gold");
  if (!bw || bw.x !== WESTBROOK_VIEWPOINT.x || bw.z !== WESTBROOK_VIEWPOINT.z)
    findings.push("PHASE43 breakwater-gold anchor is not WESTBROOK_VIEWPOINT");
  const storm = anchorOf("storm-harbour");
  if (!storm || !isWaterAt(storm.x, storm.z))
    findings.push("PHASE43 storm-harbour anchor is not in the bay's open water");
  const sign = anchorOf("sign-at-night");
  if (!sign || isWaterAt(sign.x, sign.z))
    findings.push("PHASE43 sign-at-night anchor is not on land (the hillside sign)");
  if (sign && (isWaterAt(sign.x, sign.z + 30) || isBlocked(sign.x, sign.z + 30, 0.5)))
    findings.push("PHASE43 no standable viewpoint 30u south of the hillside sign");
  if (anchorOf("the-pod") !== null) findings.push("PHASE43 the-pod must be anchorless (the pod moves)");
  if (anchorOf("air-support") !== null) findings.push("PHASE43 air-support must be anchorless (it orbits the player)");
  console.log(`phase 43 postcards checked: ${POSTCARD_DEFS.length} postcards, anchors pinned to bridge / club / dome / breakwater / bay / sign`);
}

// ================================================================
// 13. Phase 47: DAY EVENTS — the regatta course and the Coral
// street market (game/dayevents.ts imported directly, so the
// audit tests the data the game lays out). The course points get
// the section 11 water rig: open water under isWaterAt, ≥19u off
// Sable Island's centre, west of the bridge clearance box, inside
// the boat chart clamp, clear of the moored hulls (the cargo ship
// measured against its hull BOX, re-derived here — section 11's
// copy is block-scoped) and the rental skiff spawn. Consecutive
// legs (gate → buoys in order → gate) must each exceed 20u, so
// the course can never degenerate into a single point. The market
// stalls stand on the Coral promenade: footprint corners outside
// every collider, off the road grid, on land, and ≥4u from the
// promenade doors (the apartment, the Coral Shores Goods
// register, the Marina Table, Coral Pawn — all at z=211.7); the
// crowd spots standable and clear of the stall footprints. The
// set's numbers are pinned: 6 buoys, a 30–120 s target, a
// $100–$500 purse, the 25% / +20% trade terms, four parts-deal
// lines, and marketPrice's exact dollars on the bench's own price
// points (the shown price IS the charged price — one function).
// ================================================================
{
  const ISLAND_C = { x: -64, z: 168 };
  const MOORED: Array<{ name: string; x: number; z: number; clear: number }> = [
    { name: "yacht", x: 62, z: 152, clear: 12 },
    { name: "tug", x: 18, z: 141, clear: 6.5 },
    { name: "rental skiff spawn", x: -4, z: 138, clear: 8 },
  ];
  const SHIP_AXIS = { x: Math.sin(0.12), z: Math.cos(0.12) };
  const SHIP_PERP = { x: Math.cos(0.12), z: -Math.sin(0.12) };
  const shipBoxDist = (px: number, pz: number) => {
    const dx = px - -72, dz = pz - 168;
    const u = Math.abs(dx * SHIP_AXIS.x + dz * SHIP_AXIS.z) - 22;
    const v = Math.abs(dx * SHIP_PERP.x + dz * SHIP_PERP.z) - 5.25;
    return Math.hypot(Math.max(u, 0), Math.max(v, 0));
  };
  const waterPoint = (label: string, x: number, z: number) => {
    if (!isWaterAt(x, z)) findings.push(`PHASE47 ${label} at (${x}, ${z}) is not open water`);
    const di = Math.hypot(x - ISLAND_C.x, z - ISLAND_C.z);
    if (di < 19) findings.push(`PHASE47 ${label} at (${x}, ${z}) closes to ${di.toFixed(1)}u of Sable Island centre (min 19)`);
    if (x > BRIDGE.x - BRIDGE.halfW - 8 && z > BRIDGE.z0 - 8 && z < BRIDGE.z1 + 8)
      findings.push(`PHASE47 ${label} at (${x}, ${z}) enters the bridge clearance box`);
    if (x < -240 || x > 170 || z < -412 || z > 368)
      findings.push(`PHASE47 ${label} at (${x}, ${z}) exits the boat chart clamp`);
    for (const m of MOORED) {
      const dm = Math.hypot(x - m.x, z - m.z);
      if (dm < m.clear) findings.push(`PHASE47 ${label} at (${x}, ${z}) closes to ${dm.toFixed(1)}u of the moored ${m.name} (min ${m.clear})`);
    }
    const dShip = shipBoxDist(x, z);
    if (dShip < 3) findings.push(`PHASE47 ${label} at (${x}, ${z}) closes to ${dShip.toFixed(1)}u of the cargo ship's hull (min 3)`);
  };
  waterPoint("regatta gate", REGATTA_GATE.x, REGATTA_GATE.z);
  REGATTA_GATE_BUOYS.forEach(([x, z], i) => waterPoint(`regatta gate buoy ${i + 1}`, x, z));
  REGATTA_BUOYS.forEach(([x, z], i) => waterPoint(`regatta buoy ${i + 1}`, x, z));
  const course: Array<readonly [number, number]> = [[REGATTA_GATE.x, REGATTA_GATE.z], ...REGATTA_BUOYS, [REGATTA_GATE.x, REGATTA_GATE.z]];
  for (let i = 1; i < course.length; i++) {
    const leg = Math.hypot(course[i][0] - course[i - 1][0], course[i][1] - course[i - 1][1]);
    if (leg < 20) findings.push(`PHASE47 regatta leg ${i} is only ${leg.toFixed(1)}u — the course degenerates`);
  }
  if (REGATTA_BUOYS.length !== 6) findings.push(`PHASE47 regatta has ${REGATTA_BUOYS.length} buoys (want 6)`);
  if (REGATTA_TARGET_S < 30 || REGATTA_TARGET_S > 120) findings.push(`PHASE47 regatta target ${REGATTA_TARGET_S}s outside the 30–120 s band`);
  if (REGATTA_PRIZE < 100 || REGATTA_PRIZE > 500) findings.push(`PHASE47 regatta prize $${REGATTA_PRIZE} outside the $100–$500 band`);

  const DOORS: Array<{ name: string; x: number; z: number }> = [
    { name: "Coral Shores Apartment door", x: APARTMENT_DOOR.x, z: APARTMENT_DOOR.z },
    { name: "Coral Shores Goods register", ...(REGISTERS.find((r) => r.id === "coral") ?? { x: NaN, z: NaN }) },
    { name: "Marina Table door", x: RESTAURANT_EXT_DOOR.x, z: RESTAURANT_EXT_DOOR.z },
    { name: "Coral Pawn", x: PAWN_SHOP.x, z: PAWN_SHOP.z },
  ];
  // The road test is the LANE test, not coarse isOnRoad: Coral's
  // driven lanes are the segments world.laneClearance judges by
  // (verticals x∈{40,72,104} over z 224..304, horizontals z∈{224,
  // 264,304} over x 40..104) — the promenade strip north of z=224
  // is pedestrian ground the shop row interrupts, whatever the
  // grid band says. The world's own scatter rule is ≥3.95 from a
  // lane centreline; stall centres AND counter corners must beat
  // it. The bridge test is separate and physical: groundYAt > 0.05
  // is the deck/ramp surface (onBridge's own definition) — the
  // north ramp lands across the promenade at x 53–67, and a stall
  // there would stand in the causeway's mouth.
  const laneSegDist = (x: number, z: number) => {
    let best = Infinity;
    const seg = (x0: number, z0: number, x1: number, z1: number) => {
      const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz || 1;
      const tt = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / L2));
      best = Math.min(best, Math.hypot(x - (x0 + dx * tt), z - (z0 + dz * tt)));
    };
    for (const c of CORAL_ROAD_X) seg(c, 224, c, 304);
    for (const c of CORAL_ROAD_Z) seg(40, c, 104, c);
    return best;
  };
  for (const s of MARKET_STALLS) {
    pointTest(`PHASE47 market stall ${s.id} centre`, s.x, s.z);
    for (const [ox, oz] of [[-1.45, -0.95], [1.45, -0.95], [-1.45, 0.95], [1.45, 0.95]] as const)
      pointTest(`PHASE47 market stall ${s.id} corner`, s.x + ox, s.z + oz);
    // canopy corners (±1.65 × ±1.15): the raw box test — a canopy
    // may overhang toward a wall face but never intersect it
    for (const [ox, oz] of [[-1.65, -1.15], [1.65, -1.15], [-1.65, 1.15], [1.65, 1.15]] as const) {
      const cx = s.x + ox, cz = s.z + oz;
      for (const b of COLLIDERS)
        if (Math.abs(cx - b.x) < b.hw && Math.abs(cz - b.z) < b.hd)
          findings.push(`PHASE47 market stall ${s.id} canopy corner at (${cx.toFixed(1)}, ${cz.toFixed(1)}) intersects ${b.what} at (${b.x}, ${b.z})`);
      if (groundYAt(cx, cz) > 0.05) findings.push(`PHASE47 market stall ${s.id} canopy corner at (${cx.toFixed(1)}, ${cz.toFixed(1)}) stands on the bridge deck/ramp`);
    }
    if (laneSegDist(s.x, s.z) < 3.95) findings.push(`PHASE47 market stall ${s.id} at (${s.x}, ${s.z}) stands within ${laneSegDist(s.x, s.z).toFixed(1)}u of a driven Coral lane (min 3.95)`);
    if (groundYAt(s.x, s.z) > 0.05) findings.push(`PHASE47 market stall ${s.id} at (${s.x}, ${s.z}) stands on the bridge deck/ramp`);
    if (isWaterAt(s.x, s.z)) findings.push(`PHASE47 market stall ${s.id} at (${s.x}, ${s.z}) stands in water`);
    for (const d of DOORS) {
      const dd = Math.hypot(s.x - d.x, s.z - d.z);
      if (dd < 4) findings.push(`PHASE47 market stall ${s.id} at (${s.x}, ${s.z}) crowds the ${d.name} (${dd.toFixed(1)}u, min 4)`);
    }
    for (const o of MARKET_STALLS) {
      if (o !== s && Math.hypot(s.x - o.x, s.z - o.z) < 10) findings.push(`PHASE47 market stalls ${s.id} and ${o.id} stand closer than 10u`);
    }
  }
  MARKET_CROWD.forEach((c, i) => {
    pointTest(`PHASE47 market crowd spot ${i + 1}`, c.x, c.z);
    if (isWaterAt(c.x, c.z)) findings.push(`PHASE47 market crowd spot ${i + 1} at (${c.x}, ${c.z}) stands in water`);
    for (const s of MARKET_STALLS) {
      if (Math.abs(c.x - s.x) < 1.65 + 0.4 && Math.abs(c.z - s.z) < 1.15 + 0.4)
        findings.push(`PHASE47 market crowd spot ${i + 1} at (${c.x}, ${c.z}) stands inside the ${s.id} stall's footprint`);
    }
  });
  if (Object.keys(PARTS_DEALS).length !== 4) findings.push(`PHASE47 parts deals has ${Object.keys(PARTS_DEALS).length} lines (want 4)`);
  if (MARKET_PARTS_DISCOUNT !== 0.25) findings.push(`PHASE47 parts discount is ${MARKET_PARTS_DISCOUNT} (want 0.25)`);
  if (MARKET_FENCE_BONUS !== 0.2) findings.push(`PHASE47 fence bonus is ${MARKET_FENCE_BONUS} (want 0.2)`);
  if (marketPrice(400) !== 300 || marketPrice(300) !== 225 || marketPrice(600) !== 450)
    findings.push("PHASE47 marketPrice no longer maps the bench's price points to exact dollars (400→300, 300→225, 600→450)");
  console.log(`phase 47 day events checked: regatta gate + ${REGATTA_BUOYS.length} buoys on the water rig, ${MARKET_STALLS.length} market stalls + ${MARKET_CROWD.length} crowd spots, deal terms pinned`);
}

// ================================================================
// 14. Phase 48: THE HARBOUR CROWN — the endgame chain's placements
// and the Sovereign census. The defs come from the real
// game/missions.ts. crown1 spans two streamed districts: its meet
// is pinned to WESTBROOK_VIEWPOINT and tested against
// WESTBROOK_BLOCKERS + the Westbrook bounds (section 6's rig); its
// photo points sit inside Eastmere, whose blockers live in the
// React chunk — mirrored here in full (keep in sync with
// components/Eastmere.tsx BLOCKERS, the section 10 precedent).
// crown3's figures are literals mirrored from
// components/CrownWorld.tsx (keep in sync). crown4's middle step
// is a BOAT checkpoint: the sailing line from the marina to the
// observatory jetty is walked on the water rig, and the landing
// itself must sit EAST of the Northreach land bounds — inside the
// bounds it would become cliff when the district loads.
// ================================================================
{
  const crown = Object.fromEntries(SIDE_MISSIONS.filter((m) => m.side === "crown").map((m) => [m.id, m]));
  for (const id of ["crown1", "crown2", "crown3", "crown4"]) if (!crown[id]) findings.push(`CROWN: mission def ${id} missing from SIDE_MISSIONS`);
  if (Object.keys(crown).length !== 4) findings.push(`CROWN: ${Object.keys(crown).length} crown defs (want exactly 4)`);
  // def-shape pins: the auction choice pair + the finale's pressure
  if (crown.crown1 && (crown.crown1.meetSteps !== 1 || crown.crown1.photoSteps !== 2 || crown.crown1.runTimer !== 180))
    findings.push("CROWN crown1 lost its meet/photo/runTimer shape (1 meet, 2 photos, 180 s run)");
  if (crown.crown2 && crown.crown2.kind !== "escape") findings.push("CROWN crown2 is no longer an escape (the channel + safehouse shape)");
  if (crown.crown3 && (crown.crown3.choiceKey !== "crown" || crown.crown3.altFlag !== "crown-expose" || crown.crown3.payoutAlt !== 15000 || crown.crown3.payout !== 2000))
    findings.push("CROWN crown3 lost its auction shape (choiceKey crown, altFlag crown-expose, payout 2000 / payoutAlt 15000)");
  if (crown.crown4 && crown.crown4.forceWanted !== 4) findings.push("CROWN crown4 lost its 4★ finale pressure (forceWanted 4)");
  const WB = STREAMED_DISTRICTS.find((d) => d.id === "westbrook");
  const EM2 = STREAMED_DISTRICTS.find((d) => d.id === "eastmere");
  const NRB2 = STREAMED_DISTRICTS.find((d) => d.id === "northreach");
  const inBounds = (d: typeof WB, x: number, z: number) => !!d && x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1;
  const boxClear = (label: string, x: number, z: number, boxes: { x: number; z: number; hw: number; hd: number }[], r: number, tag: string) => {
    for (const b of boxes) if (Math.abs(x - b.x) < b.hw + r && Math.abs(z - b.z) < b.hd + r)
      findings.push(`${tag} ${label} at (${x}, ${z}) is inside a blocker at (${b.x}, ${b.z}) hw ${b.hw} hd ${b.hd}`);
  };
  // Eastmere's full blocker list (components/Eastmere.tsx, mirrored)
  const EASTMERE_BOXES = [
    { x: 60, z: -272, hw: 6, hd: 5 }, { x: 102, z: -272, hw: 6.5, hd: 5.5 },
    { x: 63, z: -232, hw: 5.5, hd: 4.5 }, { x: 100, z: -232, hw: 6, hd: 5 },
    { x: 62, z: -204, hw: 5, hd: 4 }, { x: 104, z: -204, hw: 5.5, hd: 4.5 },
    { x: 60, z: -258, hw: 3.5, hd: 2.5 }, { x: 72, z: -288, hw: 4.5, hd: 4.5 },
    { x: 96, z: -288, hw: 5, hd: 4.5 }, { x: 114, z: -290, hw: 1.6, hd: 1.6 },
  ];
  if (crown.crown1) {
    const [mx, mz] = crown.crown1.targets[0];
    if (mx !== WESTBROOK_VIEWPOINT.x || mz !== WESTBROOK_VIEWPOINT.z) findings.push("CROWN crown1's meet drifted from WESTBROOK_VIEWPOINT (Breakwater Point)");
    if (!inBounds(WB, mx, mz)) findings.push(`CROWN crown1 meet at (${mx}, ${mz}) sits outside the Westbrook bounds`);
    boxClear("crown1 meet", mx, mz, WESTBROOK_BLOCKERS, 1.0, "CROWN");
    crown.crown1.targets.slice(1, 3).forEach(([x, z], i) => {
      if (!inBounds(EM2, x, z)) findings.push(`CROWN crown1 photo #${i + 1} at (${x}, ${z}) sits outside the Eastmere bounds`);
      boxClear(`crown1 photo #${i + 1}`, x, z, EASTMERE_BOXES, 0.4, "CROWN");
    });
    pointTest("crown1 newsroom delivery", crown.crown1.targets[3][0], crown.crown1.targets[3][1], 0.4);
  }
  if (crown.crown2) {
    const [cx, cz] = crown.crown2.targets[0];
    pointTest("crown2 container channel point", cx, cz, 0.4);
    if (isWaterAt(cx, cz)) findings.push(`CROWN crown2 container point at (${cx}, ${cz}) is in the water`);
    if (groundYAt(cx, cz) > 0.05) findings.push(`CROWN crown2 container point at (${cx}, ${cz}) stands on the bridge deck/ramp (groundY ${groundYAt(cx, cz)}) — the channel point must be on the quay`);
    pointTest("crown2 safehouse door", crown.crown2.targets[1][0], crown.crown2.targets[1][1], 0.4);
  }
  if (crown.crown3) {
    const MANSION_BOXES = NORTH_MANSIONS.map((m) => ({ x: m.x, z: m.z, hw: 5.2, hd: 4.2 }));
    const [ax, az] = crown.crown3.targets[0];
    pointTest("crown3 auction frontage", ax, az, 0.4);
    boxClear("crown3 auction frontage", ax, az, MANSION_BOXES, 0.4, "CROWN");
    // CrownWorld.tsx figure spots (mirrored literals — keep in sync)
    for (const [label, fx, fz] of [["auctioneer", -97.8, -236], ["Meridian bidder", -96.2, -233.5], ["harbour bidder", -96.2, -238.5]] as const) {
      pointTest(`crown3 figure ${label}`, fx, fz, 0.4);
      boxClear(`crown3 figure ${label}`, fx, fz, MANSION_BOXES, 0.4, "CROWN");
    }
  }
  if (crown.crown4) {
    pointTest("crown4 marina pickup", crown.crown4.targets[0][0], crown.crown4.targets[0][1], 0.4);
    const [lx, lz] = crown.crown4.targets[1];
    if (!isWaterAt(lx, lz)) findings.push(`CROWN crown4 observatory landing at (${lx}, ${lz}) is not open water — the boat checkpoint must bank from the sea`);
    if (NRB2 && lx <= NRB2.x1) findings.push(`CROWN crown4 landing at x=${lx} sits inside the Northreach land bounds (x1=${NRB2.x1}) — it would become cliff when the district loads`);
    // the sailing line: marina mouth → the east channel → the jetty
    for (const [sx, sz] of [[100, 150], [135, 120], [140, 40], [140, -60], [140, -140], [138, -220], [136, -290], [120, -330], [80, -338], [lx, lz]] as [number, number][])
      if (!isWaterAt(sx, sz)) findings.push(`CROWN crown4 sailing line breaks at (${sx}, ${sz}) — not water (the east channel must run unbroken from the bay to the jetty)`);
    pointTest("crown4 HQ delivery (Voss)", crown.crown4.targets[2][0], crown.crown4.targets[2][1], 0.4);
  }
  // the Sovereign census: a real model entry, a drift factor, and
  // NEVER a dealer line (it is earned, not bought)
  const sov = (CAR_MODELS as Record<string, { name: string; topSpeed: number; handling: number }>)["sovereign"];
  if (!sov || sov.name !== "Vantara Sovereign") findings.push("CROWN CAR_MODELS has no Vantara Sovereign entry");
  if (sov && (sov.topSpeed <= 232 || sov.topSpeed >= 288)) findings.push(`CROWN Sovereign topSpeed ${sov?.topSpeed} left its honest band (above the Tempest's 232, below the hyper's 288)`);
  if (DRIFT_FACTOR["sovereign"] !== 1.3) findings.push("CROWN DRIFT_FACTOR lost the Sovereign's 1.3 (Tempest family)");
  if (DEALER_CARS.some((c) => (c.kind as string) === "sovereign")) findings.push("CROWN the Sovereign appeared in DEALER_CARS — it is a reward, never sold");
  console.log("phase 48 harbour crown checked: 4 defs (shape pins), crown1 meet+2 photos across 2 districts, crown2 quay point, crown3 frontage + 3 figures, crown4 sailing line + jetty, Sovereign census");
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
