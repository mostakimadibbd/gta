// Harborfall — Phase 7 jobs & street races (work item 1 + 2).
// Taxi fares and Lina's delivery chain run OUTSIDE the mission framework
// (they never touch M.active / story progress) but share the objective
// marker idiom: Phase7.tsx renders the pillar at jobTarget() and the big
// map draws the GPS route to it. Stats persist in localStorage.
import { depenetrateCar } from "./depenetrate"; // Phase 25: spawn guard
import { G, LASTCAR, clearLastCar } from "./store";
import { HOSPITAL_DOOR, FIRE_EXT_DOOR } from "../world"; // Phase 32: service doors
import { INCIDENT_SPOTS } from "./dispatch"; // Phase 32: the dispatch sim's roadside spots, player-side

export interface Poi { name: string; x: number; z: number; }

/** Curbs where fares hail the taxi (bus stops, pier, shops, hotels). */
export const HAIL_POINTS: Poi[] = [
  { name: "Market Row bus stop", x: 27.7, z: -30 },
  { name: "Ferry Quarter bus stop", x: -67.7, z: 14 },
  { name: "Docks bus stop", x: 34, z: 63.5 }, // Phase 25: was inside the (31,71) building
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
  { name: "Market Row", x: 15.5, z: 30 }, // Phase 25: was inside the (9,31) building's wall
];

export interface JobStats {
  taxiFares: number; taxiEarned: number; taxiBestTip: number;
  taxiTips: number; // Phase 23: lifetime tips across all fares (personalities)
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
  // ---- Phase 32: service jobs (paramedic + firefighter) ----
  patientsDelivered: number; medShifts: number;
  firesOut: number; fireShifts: number; serviceEarned: number;
  // ---- Phase 24: fishing derby records (game/derby.ts) ----
  derbyBest: number;   // best single-derby score ($ of catch value)
  derbyWins: number;   // derbies won against the house score
}
export const jobStats: JobStats = {
  taxiFares: 0, taxiEarned: 0, taxiBestTip: 0, taxiTips: 0, deliveries: 0, deliveryEarned: 0,
  racesRun: 0, racesWon: 0, bestTimes: {},
  towDeliveries: 0, towEarned: 0, fishCaught: 0, fishEarned: 0, bestFish: null,
  farmLoads: 0, farmEarned: 0,
  bestDrift: 0, driftBanked: 0, driftEarned: 0,
  valetJobs: 0, valetEarned: 0, courierDrops: 0, courierEarned: 0,
  patientsDelivered: 0, medShifts: 0, firesOut: 0, fireShifts: 0, serviceEarned: 0,
  derbyBest: 0, derbyWins: 0,
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

// ----------------------------------------------------------------
// Phase 34: THE SABLE SLIDE SERIES (drift championship, game/slide.ts)
// A round is a gated course: drive the gates in order before the
// clock dies AND bank at least `target` drift points on the way
// (game/drift.ts banks — the series counts banks off DRIFT.bankSeq,
// it never scores a slide itself). The run state mirrors RaceState.
// ----------------------------------------------------------------
export interface SlideRoundDef {
  id: string; name: string; where: string;
  start: [number, number]; gates: [number, number][];
  target: number;   // banked drift points needed to pass
  timeLimit: number; // seconds for the whole route
}
export interface SlideRunState {
  def: SlideRoundDef; phase: "countdown" | "run"; goAt: number; startedAt: number;
  gate: number;        // next gate index (=== gates.length once finished)
  score: number;       // drift points banked since GO
  bankSeq: number;     // DRIFT.bankSeq at the last count
  left: number;        // seconds left, refreshed per frame for the marker label
}

// ---------------------------------------------------------------- state
export const J = {
  // taxi
  taxiPhase: "idle" as "idle" | "pickup" | "dropoff",
  fare: null as Poi | null,       // where the passenger waits
  fareDest: null as Poi | null,   // where they want to go
  boardAt: 0, boardDamage: 0, fareDist: 0,
  taxiCooldownUntil: 0,
  // ---- Phase 23: fare PERSONALITIES (see settleFare below). Rolled
  // when the fare hails, shown in the marker label + hail toast, and
  // fully reset wherever the fare itself is cleared (completion,
  // abandonment, the NG+ stand-down in game/ngplus.ts). ----
  taxiType: "" as "" | TaxiType,
  taxiBarks: 0,                   // chatty lines fired this ride
  taxiBarkAt: 0,                  // clock time of the next chatty line
  taxiDmgBarked: false,           // the nervous passenger's first-knock complaint
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
  // ---- Phase 34: SABLE SLIDE SERIES arm + live run (game/slide.ts,
  // components/SlideSeries.tsx). The arm mirrors cupArm: set by the
  // Series card in Phone → Jobs, consumed by the start prompt at the
  // course ring. ----
  slideArm: "",                   // slide round id, or "" when unarmed
  slide: null as SlideRunState | null,
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
  // ---- Phase 32: SERVICE JOBS — PARAMEDIC + FIREFIGHTER. Flat
  // fields in the house style; the frame logic lives in
  // components/ServiceJobs.tsx. med: pickup → treat (hold-E channel
  // on foot) → return, three patients a shift. fire: respond →
  // hose (hold-E channel) → refill between fires, two fires a
  // shift; fireSize is the live fire's strength 1→0 and fireWater
  // the tender's tank 0–100. ----
  medPhase: "idle" as "idle" | "pickup" | "treat" | "return",
  medCarId: -1,                     // G.cars index of the job ambulance
  medPatient: 0,                    // index of the current patient in MED_SPOTS (deliveries counted in ServiceJobs + jobStats)
  medSpot: null as Poi | null,      // the live patient's spot
  medTimer: 0, medTotal: 0,         // the current leg's clock / its budget (s)
  medDmg0: 0,                       // ambulance damage when the leg began
  medCollect: false,                // job over — collect the ambulance on step-out
  firePhase: "idle" as "idle" | "respond" | "hose" | "refill",
  fireCarId: -1,                    // G.cars index of the fire tender
  fireN: 0,                         // index of the current fire in FIRE_SPOTS (fires out counted in ServiceJobs + jobStats)
  fireSpot: null as Poi | null,     // the live fire's frontage point
  fireSize: 0,                      // the live fire's strength, 1 → 0
  fireWater: 100,                   // the tender's tank, 0–100
  fireRefillAt: null as Poi | null, // the live refill point (hydrant / station)
  fireCollect: false,               // job over — collect the tender on step-out
  // ---- Phase 41: SUPPLY-SNAG ERRAND — when a business's morning
  // event is a supply snag (game/economy.ts), the player can run
  // stock from a depot back to the business door to restore the
  // day's full takings. The delivery chain's shape (pickup →
  // dropoff, arrival = close + stopped), one leg each way, $0 pay —
  // it's your own stock. Frame logic lives in Phase7. ----
  wantSnag: "",                     // business id requested (Bank app / door prompt)
  snagPhase: "idle" as "idle" | "pickup" | "dropoff",
  snagBiz: "",                      // business id the live run serves
  snagPoint: null as Poi | null,    // the live leg's target
  snagSerial: -1,                   // Phase 42 audit: ECO.daySerial the run started on — the run serves THAT day's snag only
};

/** Phase 41: the supply depots a snag run can draw from — the
 * delivery pickup points minus Lina's Garage (a customer, not a
 * supplier): the crane office, East Yards, Ferry Quarter, Market Row. */
export const SNAG_DEPOTS: Poi[] = PICKUP_POINTS.slice(1);

/** Phase 41: end the supply run (completed, expired, stood down —
 * the caller decides the message). */
export function endSnagRun() {
  J.snagPhase = "idle"; J.snagBiz = ""; J.snagPoint = null; J.wantSnag = ""; J.snagSerial = -1;
}

/** The world point the job/race marker pillar + GPS route should show. */
export function jobTarget(): { x: number; z: number; label: string } | null {
  if (J.race && J.race.phase === "run") {
    const cp = J.race.def.cps[J.race.cp];
    if (cp) return { x: cp[0], z: cp[1], label: `${J.race.def.name} — checkpoint ${J.race.cp + 1}/${J.race.def.cps.length}` };
  }
  if (J.slide && J.slide.phase === "run") {
    const s = J.slide;
    const gate = s.def.gates[Math.min(s.gate, s.def.gates.length - 1)];
    if (gate) return { x: gate[0], z: gate[1], label: `Slide Series: ${s.def.name} — gate ${Math.min(s.gate + 1, s.def.gates.length)}/${s.def.gates.length} · ${s.score}/${s.def.target} pts · ${Math.max(0, Math.ceil(s.left))}s` };
  }
  if (J.taxiPhase === "pickup" && J.fare) return { x: J.fare.x, z: J.fare.z, label: `Fare waiting — ${J.fare.name}${J.taxiType ? ` (${TAXI_TYPE_LABEL[J.taxiType]})` : ""}` };
  if (J.taxiPhase === "dropoff" && J.fareDest) return { x: J.fareDest.x, z: J.fareDest.z, label: `Fare → ${J.fareDest.name}` };
  if (J.delPhase !== "idle" && J.delPoint) {
    return { x: J.delPoint.x, z: J.delPoint.z, label: J.delPhase === "pickup" ? `Collect parcel — ${J.delPoint.name}` : `Deliver to — ${J.delPoint.name}` };
  }
  if (J.snagPhase !== "idle" && J.snagPoint) {
    return { x: J.snagPoint.x, z: J.snagPoint.z, label: J.snagPhase === "pickup" ? `Supply run — collect stock at ${J.snagPoint.name}` : `Supply run — deliver the stock to ${J.snagPoint.name}` };
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
  // ---- Phase 32: service jobs ----
  if (J.medPhase === "pickup" && J.medSpot) return { x: J.medSpot.x, z: J.medSpot.z, label: `Paramedic — reach the patient at ${J.medSpot.name} (${Math.max(0, Math.ceil(J.medTimer))}s)` };
  if (J.medPhase === "treat" && J.medSpot) return { x: J.medSpot.x, z: J.medSpot.z, label: "Paramedic — treat the patient (hold E beside them)" };
  if (J.medPhase === "return") return { x: HOSPITAL_DOOR.x, z: HOSPITAL_DOOR.z, label: "Paramedic — back to the hospital bay" };
  if (J.firePhase === "respond" && J.fireSpot) return { x: J.fireSpot.x, z: J.fireSpot.z, label: `Fire call — ${J.fireSpot.name}: get the tender in close` };
  if (J.firePhase === "hose" && J.fireSpot) return { x: J.fireSpot.x, z: J.fireSpot.z, label: "Fire call — hose it down (hold E by the flames)" };
  if (J.firePhase === "refill" && J.fireRefillAt) return { x: J.fireRefillAt.x, z: J.fireRefillAt.z, label: `Refill the tank — ${J.fireRefillAt.name}` };
  return null;
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
/** True while any job/race owns the player's attention (missions win). */
export const jobBusy = () => J.taxiPhase !== "idle" || J.delPhase !== "idle" || !!J.race || !!J.slide || J.towPhase !== "idle" || J.farmPhase !== "idle" || J.valetPhase !== "idle" || J.courierPhase !== "idle" || J.medPhase !== "idle" || J.firePhase !== "idle" || J.snagPhase !== "idle";

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
  // Phase 25: the bay stood inside Café Coral's wall (x 11.7..13 of
  // the bay car's span overlapped the café blocker) — it moves one
  // car-length west, clear of the café and of Rayan's sedan (id 0).
  { name: "Club Solace", x: 44, z: 106, bayX: 17, bayZ: 103.5, heading: Math.PI / 2 },
  // Hotel Northgate — Phase 25: the pickup stood BETWEEN the hotel
  // and its annex, inside the annex's footprint; it moves to the
  // hotel's east forecourt. The bay moves off the z=−216 traffic
  // lanes to the showroom apron's west end.
  { name: "Hotel Northgate", x: 24, z: -236, bayX: -16, bayZ: -224.5, heading: Math.PI / 2 },
  // Coral Shores resort strip — Phase 25: the pickup stood inside
  // the waterfront row's west house; it moves to the row's west end
  // by the x=40 road. The bay moves off the z=224 crossroads (it
  // straddled both traffic lanes) to the x=104 road's east verge.
  { name: "Coral Shores Resort", x: 34, z: 210, bayX: 109.5, bayZ: 232, heading: Math.PI / 2 }, // Phase 25: pickup on the promenade west end (was inside the apartment block's new span)
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
  depenetrateCar(G.cars[G.cars.length - 1]); // Phase 25 guard
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

// ================================================================
// Phase 23: TAXI PASSENGER PERSONALITIES.
// Every fare rolls a type when they hail (40% Calm — the pre-Phase
// -23 baseline fare, unchanged maths — and 20% each of the others):
//   · HURRIED — the clock is the job: land with more than 25% of
//     the par time still in hand and the speed bonus is +40% of the
//     fare instead of the usual +25% (it replaces it — one speed
//     bonus per fare, never both).
//   · NERVOUS — ANY damage to the cab on the ride zeroes the tip,
//     whatever else you earned; they complain the moment it happens.
//   · CHATTY — pays the standard maths and talks: 2–3 subtitle
//     barks across the ride, pure flavour, all original lines.
// ALL tip maths lives in settleFare — the ONE place a fare's tip is
// computed (Phase7's completion block calls it and nothing else
// touches tips). The personality state itself is J.taxiType & co.
// (above) and resets with the fare everywhere the fare resets.
// ================================================================
export type TaxiType = "calm" | "hurried" | "chatty" | "nervous";
export const TAXI_TYPE_LABEL: Record<TaxiType, string> = {
  calm: "Calm", hurried: "Hurried", chatty: "Chatty", nervous: "Nervous",
};
/** How the hail toast describes them before you ever see them. */
export const TAXI_TYPE_HINT: Record<TaxiType, string> = {
  calm: "looks easy-going",
  hurried: "keeps checking the time — in a hurry",
  chatty: "already talking to the bus stop sign",
  nervous: "is hugging their bag like it might float away",
};
export function rollTaxiType(): TaxiType {
  const r = Math.random();
  return r < 0.4 ? "calm" : r < 0.6 ? "hurried" : r < 0.8 ? "chatty" : "nervous";
}
export const TAXI_BOARD_LINES: Record<TaxiType, string> = {
  calm: "Thanks! Just get me there in one piece.",
  hurried: "Ferry leaves in twenty and I am NOT missing it. Fast pays — land me there with time to spare and the tip's +40%.",
  chatty: "Oh good, a cab! You'll never guess what happened at the market this morning — well, sit back, I'll tell it properly…",
  nervous: "Please — gently. Any knock, any at all, and I can't tip you. I bruise like a peach and so does my luggage.",
};
export const CHATTY_LINES = [
  "—so I told Marta, I said, the harbour keeps everyone's secrets except mine, apparently—",
  "My cousin drives the Cityliner. Swears the night route's haunted. It is not. Probably.",
  "You know the pier used to end two streets earlier? True story. Well. Mostly.",
];
export const NERVOUS_DAMAGE_LINE = "Was that— did we just HIT something?! That's the tip gone, driver. Gone.";
export const NERVOUS_DROPPED_LINE = "Never again. I'll walk. In the rain. Uphill. Both ways.";

/** THE tip calculation — the only place it happens. `par` is the
 * fare's expected duration (distance / 9, Phase 7's long-standing
 * yardstick); `dmg` is damage GAINED on the ride. Returns the tip
 * (unrounded — the caller rounds, as fares always have) and a
 * one-line note for the completion message. */
export function settleFare(type: TaxiType | "", fare: number, elapsed: number, par: number, dmg: number): { tip: number; note: string } {
  let tip = 0;
  let note = "";
  const fast = elapsed <= par * 1.25;        // the standard speed window
  const inHand = elapsed <= par * 0.75;      // >25% of the par still in hand
  if (type === "hurried" && inHand) { tip += fare * 0.4; note = "Hurried fare, landed with time in hand — +40%"; }
  else if (fast) { tip += fare * 0.25; if (type === "hurried") note = "Hurried fare — not quick enough for the +40%"; }
  if (dmg <= 2) tip += 8;
  if (dmg > 15) { tip = 0; note = "Too rough a ride — the tip's gone"; }
  if (type === "nervous" && dmg > 0) { tip = 0; note = "Nervous fare — a knock on the way killed the tip"; }
  // Phase 24 audit: a SLOW Hurried fare fell through to the generic
  // "clean harbour fare" note below — the completion message claimed
  // a calm ride for a passenger who'd spent it watching the clock.
  if (!note && type === "hurried") note = "Hurried fare — too slow for the speed bonus";
  if (!note) note = type === "chatty" ? "Talked the whole way — and tipped for the company" : "A clean harbour fare";
  return { tip, note };
}

// ================================================================
// Phase 32: SERVICE JOBS — PARAMEDIC + FIREFIGHTER.
// The dispatch sim (game/dispatch.ts) has sent NPC ambulances and
// fire tenders to INCIDENT_SPOTS since Phase 7; these two shifts
// put the PLAYER in the unit. Both run on the rental discipline
// exactly (the valet/courier pattern above): the vehicle is a
// dynamic, unowned G.cars entry spawned for the shift, never
// stored, never the session's last car, collected at shift end —
// immediately, or the moment the player steps out of it — and a
// wreck ends the shift and stays in the world. The frame logic
// (timers, channels, flames, siren, stand-downs) lives in
// components/ServiceJobs.tsx; this module owns the state, the
// spawn/collect/end paperwork and the E-claim the Vehicle key
// handler consults. Payouts are computed in ServiceJobs through
// effectivePayout's multiplier (ngPayoutMult), like every job.
// ================================================================
export const MED_PATIENTS_PER_SHIFT = 3;
export const FIRES_PER_SHIFT = 2;
export const MED_BASE_PAY = 110;        // per patient delivered
export const MED_TIME_BONUS = 60;       // scaled by the return leg's remaining fraction
export const MED_CLEAN_BONUS = 40;      // the ambulance took no damage on the patient's legs
export const MED_SHIFT_BONUS = 100;     // all three patients delivered
export const FIRE_BASE_PAY = 160;       // per fire out
export const FIRE_SPEED_BONUS = 70;     // scaled by how fast the fire died
export const FIRE_SHIFT_BONUS = 120;    // both fires out
export const FIRE_TANK = 100;           // the tender's tank capacity
export const FIRE_COST = 55;            // tank spent per fire — a refill is genuinely required before fire two
export const FIRE_BURNOUT_S = 240;      // a fire left this long burns out unpaid
/** The ambulance waits on the hospital lot, clear of the dispatch
 * sim's rush-event parking at (−93, 108). */
export const AMBULANCE_SPAWN = { x: -98.5, z: 106.5, heading: 0.9 };
/** The tender waits on the civic lot west of the fire station,
 * parallel to the same rush parking, clear of the hospital door. */
export const FIRETRUCK_SPAWN = { x: -88, z: 108, heading: 0.15 };

const distTo = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
/** This shift's patients, nearest-first from the hospital — the
 * escalation is distance: Ferry Quarter, the Docks strip, then
 * Market Row. The spots are the dispatch sim's own roadside
 * points, so a patient never waits somewhere a car can't reach. */
export const MED_SPOTS: Poi[] = INCIDENT_SPOTS
  .filter((s) => s.kinds.includes("medical"))
  .map((s) => ({ name: s.label, x: s.x, z: s.z }))
  .sort((a, b) => distTo(a, HOSPITAL_DOOR) - distTo(b, HOSPITAL_DOOR))
  .slice(0, MED_PATIENTS_PER_SHIFT);
/** This shift's fires, nearest-first from the fire station: the
 * Ferry Quarter, then the south-west grid. */
export const FIRE_SPOTS: Poi[] = INCIDENT_SPOTS
  .filter((s) => s.kinds.includes("fire"))
  .map((s) => ({ name: s.label, x: s.x, z: s.z }))
  .sort((a, b) => distTo(a, FIRE_EXT_DOOR) - distTo(b, FIRE_EXT_DOOR))
  .slice(0, FIRES_PER_SHIFT);

/** True when the G.cars index is the live job ambulance or fire
 * tender. Vehicle.tsx reads this so taking your own unit is never
 * rolled as a steal or a break-in — the service hands you the keys. */
export function isServiceCar(idx: number): boolean {
  return idx >= 0 && (idx === J.medCarId || idx === J.fireCarId);
}

/** E-key ownership for the service channels (the Phase 24 boat-fish
 * precedent): while the player stands in a live treat / hose /
 * refill context on foot, E belongs to the channel in ServiceJobs,
 * not to the service vehicle's door beside them. */
export function serviceClaimsE(): boolean {
  if (G.driving) return false;
  if (J.medPhase === "treat" && J.medSpot && Math.hypot(G.playerPos.x - J.medSpot.x, G.playerPos.z - J.medSpot.z) < 2.6) return true;
  if (J.firePhase === "hose" && J.fireSpot && Math.hypot(G.playerPos.x - J.fireSpot.x, G.playerPos.z - J.fireSpot.z) < 7) return true;
  if (J.firePhase === "refill" && J.fireRefillAt && Math.hypot(G.playerPos.x - J.fireRefillAt.x, G.playerPos.z - J.fireRefillAt.z) < 3.4) return true;
  return false;
}

function spawnServiceCar(kind: "ambulance" | "firetruck"): number {
  const s = kind === "ambulance" ? AMBULANCE_SPAWN : FIRETRUCK_SPAWN;
  G.cars.push({
    id: 3200 + G.cars.length, x: s.x, z: s.z, heading: s.heading,
    color: kind === "ambulance" ? "#eef1f2" : "#b3271e",
    model: kind === "ambulance" ? "Sable Medic Van" : "Sable Fire Tender",
    kind, owned: false,
    state: { x: s.x, z: s.z, heading: s.heading, speed: 0 },
    stolen: false, damage: 0, fuel: 100,
    brokenWindow: false, pitch: 0, roll: 0, steerVis: 0, storedAway: false,
    flatTyre: false, tuneLvl: 0, brakeLvl: 0, driftTyres: false, pitchVel: 0, rollVel: 0,
  });
  depenetrateCar(G.cars[G.cars.length - 1]); // Phase 25 guard, as the valet spawn
  return G.cars.length - 1;
}

function collectServiceCar(which: "med" | "fire") {
  const idx = which === "med" ? J.medCarId : J.fireCarId;
  if (idx < 0) return;
  const car = G.cars[idx];
  if (LASTCAR.carIndex === idx) clearLastCar();
  if (car && !car.storedAway) {
    car.storedAway = true;
    car.state = { x: 0, z: -500, heading: 0, speed: 0 };
  }
  if (which === "med") J.medCarId = -1; else J.fireCarId = -1;
}
export function collectMedCar() { collectServiceCar("med"); }
export function collectFireCar() { collectServiceCar("fire"); }

/** Dispatch the shift's current patient: the leg clock is generous
 * by design (60 s + 5 s per 25 units of road) — the pay, not the
 * survival, is what the clock pressures. */
export function medDispatchPatient() {
  const spot = MED_SPOTS[J.medPatient];
  if (!spot) return;
  J.medSpot = spot;
  J.medPhase = "pickup";
  const car = G.cars[J.medCarId];
  const from = car ? car.state : HOSPITAL_DOOR;
  J.medTotal = J.medTimer = 60 + distTo(spot, from) / 5;
  J.medDmg0 = car ? car.damage : 0;
}

export function startMedShift(): boolean {
  if (J.medPhase !== "idle") return false;
  J.medCarId = spawnServiceCar("ambulance");
  J.medPatient = 0;
  J.medCollect = false;
  medDispatchPatient();
  return true;
}

/** Dispatch the shift's current fire at full strength. */
export function fireDispatch() {
  const spot = FIRE_SPOTS[J.fireN];
  if (!spot) return;
  J.fireSpot = spot;
  J.fireSize = 1;
  J.firePhase = "respond";
}

export function startFireShift(): boolean {
  if (J.firePhase !== "idle") return false;
  J.fireCarId = spawnServiceCar("firetruck");
  J.fireN = 0;
  J.fireWater = FIRE_TANK;
  J.fireCollect = false;
  fireDispatch();
  return true;
}

/** End the paramedic paperwork (any reason) — the endValetJob
 * shape: a wreck stays in the world; a player still sitting in
 * the ambulance collects it on step-out (ServiceJobs watches
 * J.medCollect); otherwise it is collected now. */
export function endMedJob(wrecked: boolean) {
  J.medPhase = "idle"; J.medSpot = null; J.medTimer = 0; J.medTotal = 0;
  if (wrecked) { if (LASTCAR.carIndex === J.medCarId) clearLastCar(); J.medCarId = -1; J.medCollect = false; return; }
  if (J.medCarId >= 0 && G.driving && G.activeCarId === J.medCarId) J.medCollect = true;
  else collectMedCar();
}

/** End the firefighter paperwork (any reason) — same shape. */
export function endFireJob(wrecked: boolean) {
  J.firePhase = "idle"; J.fireSpot = null; J.fireSize = 0; J.fireRefillAt = null;
  if (wrecked) { if (LASTCAR.carIndex === J.fireCarId) clearLastCar(); J.fireCarId = -1; J.fireCollect = false; return; }
  if (J.fireCarId >= 0 && G.driving && G.activeCarId === J.fireCarId) J.fireCollect = true;
  else collectFireCar();
}

/** Both service shifts down — the NG+ stand-down entry point. */
export function endServiceJobs() { endMedJob(false); endFireJob(false); }
