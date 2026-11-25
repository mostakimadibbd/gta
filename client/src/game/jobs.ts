// Harborfall — Phase 7 jobs & street races (work item 1 + 2).
// Taxi fares and Lina's delivery chain run OUTSIDE the mission framework
// (they never touch M.active / story progress) but share the objective
// marker idiom: Phase7.tsx renders the pillar at jobTarget() and the big
// map draws the GPS route to it. Stats persist in localStorage.
import { G, LASTCAR, clearLastCar } from "./store";

export interface Poi { name: string; x: number; z: number; }

/** Curbs where fares hail the taxi (bus stops, pier, shops, hotels). */
export const HAIL_POINTS: Poi[] = [
  { name: "Market Row bus stop", x: 27.7, z: -30 },
  { name: "Ferry Quarter bus stop", x: -67.7, z: 14 },
  { name: "Docks bus stop", x: 34, z: 67.7 },
  { name: "the Pier", x: 2, z: 108 },
  { name: "Club Solace", x: 44, z: 108 },
  { name: "Coral Pawn", x: 88, z: 210 },
  { name: "Sable Motors, Northgate", x: -36, z: -236 },
  { name: "Hotel Northgate", x: 9, z: -230 },
];
/** Where fares and parcels want to go. */
export const DEST_POINTS: Poi[] = [
  { name: "Sable General Hospital", x: -94, z: 100 },
  { name: "Lina's Garage", x: -25, z: 97 },
  { name: "the Pier", x: 0, z: 110 },
  { name: "Lantern Park", x: 80, z: -76 },
  { name: "Sable Heights", x: -80, z: 100 },
  { name: "East Yards depot", x: 100, z: 24 },
  { name: "Ferry Quarter", x: -96, z: -56 },
  { name: "Gull Heights overlook road", x: -96, z: -104 },
  { name: "Coral Shores Goods", x: 48, z: 210 },
  { name: "Coral beach", x: 70, z: 204 },
  { name: "Northgate mansions", x: -98, z: -232 },
  { name: "Hotel Northgate", x: 9, z: -230 },
];
/** Delivery pickup crates (Lina's chain starts at her garage). */
export const PICKUP_POINTS: Poi[] = [
  { name: "Lina's Garage", x: -25, z: 97 },
  { name: "the crane office", x: 60, z: 100 },
  { name: "East Yards depot", x: 100, z: 24 },
  { name: "Ferry Quarter depot", x: -100, z: 60 },
  { name: "Market Row", x: 13.5, z: 30 },
];

export interface JobStats {
  taxiFares: number; taxiEarned: number; taxiBestTip: number;
  deliveries: number; deliveryEarned: number;
  racesRun: number; racesWon: number;
  bestTimes: Record<string, number>;
  // ---- Phase 8: tow work + fishing records ----
  towDeliveries: number; towEarned: number;
  fishCaught: number; fishEarned: number;
  bestFish: { name: string; cm: number } | null;
  // ---- Phase 16: farm work (crop-crate loads to Harbour Wraps) ----
  farmLoads: number; farmEarned: number;
  // ---- Phase 18: drift scoring (game/drift.ts) ----
  bestDrift: number;    // best single banked chain, points
  driftBanked: number;  // lifetime banked points
  driftEarned: number;  // lifetime cash paid out by banking
  // ---- Phase 22: odd jobs board (valet + courier sprint) ----
  valetJobs: number; valetEarned: number;
  courierDrops: number; courierEarned: number;
}
export const jobStats: JobStats = {
  taxiFares: 0, taxiEarned: 0, taxiBestTip: 0, deliveries: 0, deliveryEarned: 0,
  racesRun: 0, racesWon: 0, bestTimes: {},
  towDeliveries: 0, towEarned: 0, fishCaught: 0, fishEarned: 0, bestFish: null,
  farmLoads: 0, farmEarned: 0,
  bestDrift: 0, driftBanked: 0, driftEarned: 0,
  valetJobs: 0, valetEarned: 0, courierDrops: 0, courierEarned: 0,
};
try {
  const raw = localStorage.getItem("harborfall-jobstats");
  if (raw) Object.assign(jobStats, JSON.parse(raw) as Partial<JobStats>);
} catch { /* fresh stats */ }
export function persistJobStats() {
  try { localStorage.setItem("harborfall-jobstats", JSON.stringify(jobStats)); } catch { /* ignore */ }
}

// ---------------------------------------------------------------- races
export interface RaceDef {
  id: string; name: string; blurb: string; start: [number, number]; cps: [number, number][];
  /** Phase 14: non-street modes reuse this same race state machine —
   * "boat" runs one ghost rival (opps[0]) for a win purse, "air" is a
   * pure time trial against `par`. Absent = a street race. */
  mode?: "boat" | "air";
  purse?: number;   // boat: win purse · air: beat-par purse
  par?: number;     // air: seconds to beat for the purse
  cpAlt?: number[]; // air: target altitude per checkpoint (last = land, < 4)
  /** Phase 17: a Street Challenge world-event race — one rival, one
   * destination, the $200 stake already taken at accept time; the
   * finish block pays winner-takes-the-pot ($400) or nothing. */
  challenge?: boolean;
}
export const RACES: RaceDef[] = [
  { id: "docks", name: "Docks Sprint", blurb: "Harbour straights and one hard right at the Yards.",
    start: [0, 100], cps: [[60, 100], [100, 100], [100, 20], [100, -60], [20, -60]] },
  { id: "bay", name: "Bay Run", blurb: "Over the bridge, through Coral Shores, back along the beach road.",
    start: [60, 100], cps: [[60, 160], [72, 224], [104, 224], [104, 304], [40, 304], [40, 224]] },
  { id: "north", name: "Northgate Loop", blurb: "A clean rectangle around the rich end of town.",
    start: [-20, -216], cps: [[-84, -216], [-84, -280], [-20, -280], [-20, -216]] },
];
/** Phase 14: BAY CIRCUIT — from the marina, out into the bay, a full
 * loop around Sable Island (south, west, north) and home. One ghost
 * rival boat, paced by the same race_pace rubber-band as the street
 * fields; beat it home for the $500 purse. */
export const BAY_CIRCUIT: RaceDef = {
  id: "baycircuit", name: "Bay Circuit", mode: "boat", purse: 500,
  blurb: "Marina start, around Sable Island and back. Beat the ghost boat home.",
  start: [4, 128], cps: [[40, 150], [0, 185], [-64, 190], [-105, 160], [-64, 138], [-10, 128], [4, 128]],
};
/** Phase 14: SPARROW RUN — a pilot's time trial in the Sparrow: climb
 * out of Sable Field, thread the Bay Bridge ring, round the island
 * lighthouse, cross to Northgate and land back at the field. Beat
 * the 2:00 par for $600; any finish records a best time. */
export const SPARROW_RUN: RaceDef = {
  id: "sparrow", name: "Sparrow Run", mode: "air", purse: 600, par: 120,
  blurb: "Rings over the bridge, the lighthouse and Northgate — then land at the field.",
  start: [124, 64], cps: [[60, 150], [-52, 155], [-20, -240], [124, 64]],
  cpAlt: [28, 22, 30, 0],
};
export const RACE_PRIZES = [600, 250, 100]; // 1st / 2nd / 3rd
export interface RaceOpp { x: number; z: number; heading: number; cp: number; speed: number; skill: number; finishedAt: number; color: string; kind: "muscle" | "coupe" | "supercar"; }
export interface RaceState {
  def: RaceDef; phase: "countdown" | "run"; goAt: number; startedAt: number;
  cp: number; bet: number; opps: RaceOpp[]; playerDoneAt: number;
  /** Phase 18: this start was armed from the Sable Cup card (game/cup.ts)
   * — the finish position counts toward the championship. Street
   * Challenge event races can never carry it (their def is seeded by
   * Phase17 directly, never via the start prompts the arm hooks into,
   * and their single-checkpoint pot format isn't a series round). */
  cup?: boolean;
}

// ---------------------------------------------------------------- state
export const J = {
  // taxi
  taxiPhase: "idle" as "idle" | "pickup" | "dropoff",
  fare: null as Poi | null,       // where the passenger waits
  fareDest: null as Poi | null,   // where they want to go
  boardAt: 0, boardDamage: 0, fareDist: 0,
  taxiCooldownUntil: 0,
  // delivery chain (3 legs from Lina's)
  delPhase: "idle" as "idle" | "pickup" | "dropoff",
  delLeg: 0, delPoint: null as Poi | null,
  wantDelivery: false,            // set by the phone Jobs app
  // races
  race: null as RaceState | null,
  bets: true,                     // $100 side bet, toggled in the Jobs app
  // ---- Phase 18: Sable Cup arm — set by the Cup card in Phone → Jobs;
  // the next start of THAT race (street prompt or Bay Circuit ring)
  // counts toward the championship. Consumed by whichever race starts
  // first (a non-Cup start simply discards it). ----
  cupArm: "",                     // race id, or "" when unarmed
  // ---- Phase 8: tow shift (Lina's wrecker work) ----
  wantTow: false,                 // set by the phone Jobs app
  towPhase: "idle" as "idle" | "pickup" | "deliver",
  towCarId: -1,                   // G.cars index of the broken-down target
  towHooked: false,               // target is on the tether right now
  towSwing: 0,                    // tether swing angle (world heading of the towed car)
  towStillT: 0,                   // seconds spent stopped in hook range
  // ---- Phase 16: FARM WORK — haul crop crates from the Downs barn
  // to Harbour Wraps in the farm pickup (CAR_SPAWNS id 31). Its own
  // flag set, mirroring the delivery chain's shape. ----
  wantFarm: false,                // set by the phone Jobs app
  farmPhase: "idle" as "idle" | "load" | "deliver",
  farmLoad: 0,                    // loads completed this shift (of 3)
  // ---- Phase 22: ODD JOBS BOARD — VALET + COURIER SPRINT. Same
  // shape as the other jobs (want flag from the phone, phase fields
  // here, frame logic in Phase7.tsx). ----
  wantValet: false,               // set by the phone Jobs app
  valetPhase: "idle" as "idle" | "pickup" | "park",
  valetFront: -1,                 // index into VALET_FRONTAGES
  valetCarId: -1,                 // G.cars index of the customer's car
  valetDamage0: 0,                // its damage when the player took the keys
  valetEndsAt: 0,                 // clock-elapsed deadline for the park leg
  valetLeft: 0,                   // seconds left, refreshed by Phase7 for the marker label
  valetCollect: false,            // job over — collect the car once it's not driven
  wantCourier: false,             // set by the phone Jobs app
  courierPhase: "idle" as "idle" | "run",
  courierLeg: 0,                  // drops completed this chain (of 3)
  courierPoint: null as Poi | null,
  courierLeft: 0,                 // seconds left on this leg's countdown
};

/** The world point the job/race marker pillar + GPS route should show. */
export function jobTarget(): { x: number; z: number; label: string } | null {
  if (J.race && J.race.phase === "run") {
    const cp = J.race.def.cps[J.race.cp];
    if (cp) return { x: cp[0], z: cp[1], label: `${J.race.def.name} — checkpoint ${J.race.cp + 1}/${J.race.def.cps.length}` };
  }
  if (J.taxiPhase === "pickup" && J.fare) return { x: J.fare.x, z: J.fare.z, label: `Fare waiting — ${J.fare.name}` };
  if (J.taxiPhase === "dropoff" && J.fareDest) return { x: J.fareDest.x, z: J.fareDest.z, label: `Fare → ${J.fareDest.name}` };
  if (J.delPhase !== "idle" && J.delPoint) {
    return { x: J.delPoint.x, z: J.delPoint.z, label: J.delPhase === "pickup" ? `Collect parcel — ${J.delPoint.name}` : `Deliver to — ${J.delPoint.name}` };
  }
  if (J.towPhase === "pickup" && J.towCarId >= 0) {
    const c = G.cars[J.towCarId];
    if (c) return { x: c.state.x, z: c.state.z, label: `Tow job — broken-down ${c.model}` };
  }
  if (J.towPhase === "deliver") return { x: -25, z: 100.6, label: "Tow job — deliver to Lina's yard" };
  if (J.farmPhase === "load") return { x: FARM_LOAD_POINT.x, z: FARM_LOAD_POINT.z, label: `Farm work — load crates at the barn (${J.farmLoad}/3 done)` };
  if (J.farmPhase === "deliver") return { x: FARM_DROP_POINT.x, z: FARM_DROP_POINT.z, label: `Farm work — deliver load ${J.farmLoad + 1}/3 to Harbour Wraps` };
  if (J.valetPhase !== "idle" && J.valetFront >= 0) {
    const f = VALET_FRONTAGES[J.valetFront];
    if (J.valetPhase === "pickup") return { x: f.x, z: f.z, label: `Valet — collect the customer's car at ${f.name}` };
    return { x: f.bayX, z: f.bayZ, label: `Valet — park it in the ${f.name} bay, unmarked (${Math.max(0, Math.ceil(J.valetLeft))}s)` };
  }
  if (J.courierPhase === "run" && J.courierPoint) {
    return { x: J.courierPoint.x, z: J.courierPoint.z, label: `Courier — drop ${J.courierLeg + 1}/3 at ${J.courierPoint.name} (${Math.max(0, Math.ceil(J.courierLeft))}s)` };
  }
  return null;
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
/** True while any job/race owns the player's attention (missions win). */
export const jobBusy = () => J.taxiPhase !== "idle" || J.delPhase !== "idle" || !!J.race || J.towPhase !== "idle" || J.farmPhase !== "idle" || J.valetPhase !== "idle" || J.courierPhase !== "idle";

/** Phase 16 farm-work anchors: the loading spot in front of the barn
 * (barn blocker spans z −106.2…−99.8 at x −111.2…−102.8; (−100.5,−97.5)
 * is verified clear of it) and the Harbour Wraps stall (BUSINESSES
 * wraps at (31.5, 9.5); the drop sits on its forecourt). */
export const FARM_LOAD_POINT = { x: -100.5, z: -97.5 };
export const FARM_DROP_POINT = { x: 31.5, z: 13 };
export const FARM_PAY_PER_LOAD = 120;
export const FARM_SHIFT_BONUS = 150;
export const FARM_PICKUP_SPAWN_ID = 31;
export const drivingKind = () => (G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId].kind : null);

// ================================================================
// Phase 22: ODD JOBS BOARD — VALET.
// A customer's car waits at one of three hotel/club frontages; the
// player takes the keys and parks it in the stand's marked bay
// against the clock. Pay: $90 base, −$6 per point of damage the car
// takes while it's yours (floor $20), +$30 if it arrives unmarked.
// The car is a DYNAMIC, UNOWNED G.cars entry — the rental discipline
// (game/rentals.ts) exactly: it is never owned, never fleet, never
// stored, and never left as the session's last car; when the job
// ends it is collected (immediately, or the moment the player steps
// out of it). A wreck closes the job as a fail and stays in the
// world, as the rental wreck does — a corpse doesn't pop out of
// existence in front of the player.
// ================================================================
export interface ValetFrontage { name: string; x: number; z: number; bayX: number; bayZ: number; heading: number; }
export const VALET_FRONTAGES: ValetFrontage[] = [
  // Club Solace — door on the pier road (CLUB_EXT_DOOR 44,110.2);
  // the bay is down the harbour road, a short clean run west.
  { name: "Club Solace", x: 44, z: 106, bayX: 14, bayZ: 103.5, heading: Math.PI / 2 },
  // Hotel Northgate — the hail kerb on the hotel block; the bay
  // sits on the Northgate east–west road (z −216) west of it.
  { name: "Hotel Northgate", x: 9, z: -226, bayX: -16, bayZ: -219.5, heading: Math.PI / 2 },
  // Coral Shores resort strip — Goods frontage on the shore road;
  // the bay is at the Coral crossroads (x 72 / z 224).
  { name: "Coral Shores Resort", x: 48, z: 212, bayX: 75.5, bayZ: 224, heading: 0 },
];
export const VALET_BASE_PAY = 90;
export const VALET_DAMAGE_PER_POINT = 6;
export const VALET_PAY_FLOOR = 20;
export const VALET_CLEAN_BONUS = 30;
const VALET_CAR_KINDS = [
  { kind: "coupe", model: "Guest's Kestrel Coupe", color: "#7a8894" },
  { kind: "suv", model: "Guest's Harbour SUV", color: "#31435c" },
  { kind: "classic", model: "Guest's Classic Saloon", color: "#6e3b2e" },
] as const;

/** Spawn the customer's car at a frontage. Returns its G.cars index. */
export function spawnValetCar(frontIdx: number): number {
  const f = VALET_FRONTAGES[frontIdx];
  const spec = VALET_CAR_KINDS[frontIdx % VALET_CAR_KINDS.length];
  G.cars.push({
    id: 2200 + G.cars.length, x: f.x, z: f.z, heading: f.heading, color: spec.color,
    model: spec.model, kind: spec.kind, owned: false,
    state: { x: f.x, z: f.z, heading: f.heading, speed: 0 },
    stolen: false, damage: 0, fuel: 80,
    brokenWindow: false, pitch: 0, roll: 0, steerVis: 0, storedAway: false,
    flatTyre: false, tuneLvl: 0, brakeLvl: 0, driftTyres: false, pitchVel: 0, rollVel: 0,
  });
  return G.cars.length - 1;
}

/** Collect the customer's car: it leaves the world (the stand takes
 * it back), and any last-car pointer at it is cleared first — the
 * rental rule, verbatim. Safe to call when no valet car exists. */
export function collectValetCar() {
  const idx = J.valetCarId;
  if (idx < 0) return;
  const car = G.cars[idx];
  if (LASTCAR.carIndex === idx) clearLastCar();
  if (car && !car.storedAway) {
    car.storedAway = true;
    car.state = { x: 0, z: -500, heading: 0, speed: 0 };
  }
  J.valetCarId = -1;
}

/** End the valet job's paperwork (any reason). If the player is
 * still sitting in the car it is collected on step-out instead
 * (Phase7 watches J.valetCollect); otherwise collectValetCar runs
 * now. A wrecked car is left where it lies, like the rental wreck. */
export function endValetJob(wrecked: boolean) {
  J.valetPhase = "idle"; J.valetFront = -1; J.valetEndsAt = 0;
  if (wrecked) { if (LASTCAR.carIndex === J.valetCarId) clearLastCar(); J.valetCarId = -1; J.valetCollect = false; return; }
  if (J.valetCarId >= 0 && G.driving && G.activeCarId === J.valetCarId) J.valetCollect = true;
  else collectValetCar();
}

// ================================================================
// Phase 22: ODD JOBS BOARD — COURIER SPRINT.
// Three drop points in sequence, on foot or by bicycle (the job is
// feet-and-pedals work; sitting in a car PAUSES the countdown —
// the clock only runs while you're actually couriering). $45 per
// drop on arrival, +$60 for completing the full chain. A leg whose
// countdown runs out ends the chain (drops already paid stay paid).
// Starting a new chain simply replaces the state — the old chain
// has no world objects to clean up, so abandonment is total.
// ================================================================
export const COURIER_PAY_PER_DROP = 45;
export const COURIER_CHAIN_BONUS = 60;
export const COURIER_DROPS = 3;
/** Seconds for a leg: distance-scaled, sprint-and-pedal friendly. */
export const courierLegSeconds = (dist: number) => Math.round(dist / 5.5 + 22);
