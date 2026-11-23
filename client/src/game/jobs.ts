// Harborfall — Phase 7 jobs & street races (work item 1 + 2).
// Taxi fares and Lina's delivery chain run OUTSIDE the mission framework
// (they never touch M.active / story progress) but share the objective
// marker idiom: Phase7.tsx renders the pillar at jobTarget() and the big
// map draws the GPS route to it. Stats persist in localStorage.
import { G } from "./store";

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
}
export const jobStats: JobStats = {
  taxiFares: 0, taxiEarned: 0, taxiBestTip: 0, deliveries: 0, deliveryEarned: 0,
  racesRun: 0, racesWon: 0, bestTimes: {},
  towDeliveries: 0, towEarned: 0, fishCaught: 0, fishEarned: 0, bestFish: null,
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
  // ---- Phase 8: tow shift (Lina's wrecker work) ----
  wantTow: false,                 // set by the phone Jobs app
  towPhase: "idle" as "idle" | "pickup" | "deliver",
  towCarId: -1,                   // G.cars index of the broken-down target
  towHooked: false,               // target is on the tether right now
  towSwing: 0,                    // tether swing angle (world heading of the towed car)
  towStillT: 0,                   // seconds spent stopped in hook range
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
  return null;
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
/** True while any job/race owns the player's attention (missions win). */
export const jobBusy = () => J.taxiPhase !== "idle" || J.delPhase !== "idle" || !!J.race || J.towPhase !== "idle";
export const drivingKind = () => (G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId].kind : null);
