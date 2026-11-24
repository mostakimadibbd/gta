// Harborfall — Phase 15 EMERGENCY DISPATCH SIM (lite).
//
// Incidents generate on a timer in Port Sable (collision clusters,
// prop fires, medical calls at busy sidewalks). The nearest FREE
// Phase 7 service unit — ambulance or fire van, the same G.traffic
// entries that already loop the city — is dispatched: it leaves its
// patrol lane, routes over the ROAD_COORDS grid using the traffic
// system's own axis/dir/fixed lane model (two legs: to the turn
// intersection, then the final approach), works the scene for ~8 s
// (crew state = parked, lights noted by dispatch radio barks), then
// clears and re-enters circulation on the nearest road. The player
// sees the incident as a white-ringed red cross on both maps
// (G.incident, drawn in App) plus Harbour Wire phone notes and
// dispatch barks. No parallel vehicle system: GameSystems' traffic
// loop hands svc cars with a dispatch order to stepDispatchDrive()
// below and takes them back when it returns false.
import { G, bark, type NpcCar } from "./store";
import { ROAD_COORDS } from "../world";
import { pushPhoneMsg } from "./phone";

export type IncidentKind = "collision" | "fire" | "medical";
export interface IncidentSpot { x: number; z: number; kinds: IncidentKind[]; label: string; }
/** Roadside/sidewalk points on the main grid (all reachable by the
 * two-leg grid route: the final leg ends on the road beside them). */
export const INCIDENT_SPOTS: IncidentSpot[] = [
  { x: 20, z: 33, kinds: ["medical", "collision"], label: "Market Row" },
  { x: -60, z: -13, kinds: ["collision"], label: "the west grid" },
  { x: 100, z: 47, kinds: ["fire", "collision"], label: "the East Yards" },
  { x: 8, z: 93, kinds: ["medical"], label: "the Docks strip" },
  { x: -20, z: -53, kinds: ["collision", "fire"], label: "the south-west grid" },
  { x: 67, z: -20, kinds: ["collision"], label: "the east climb" },
  { x: -93, z: 20, kinds: ["fire", "medical"], label: "the Ferry Quarter" },
  { x: 40, z: 73, kinds: ["medical", "collision"], label: "the beach road" },
];
const KIND_TEXT: Record<IncidentKind, string> = {
  collision: "multi-car collision",
  fire: "prop fire",
  medical: "medical call",
};
const headingFor = (axis: "x" | "z", dir: number) => (axis === "x" ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI);
const nearestRoad = (v: number) => ROAD_COORDS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), ROAD_COORDS[0]);

let nextIncidentAt = 55; // seconds on the GameSystems sim clock
let incidentAge = 0;

/** Generation + assignment. Called once per sim step from
 * GameSystems with the sim clock and the player's position. */
export function tickDispatch(t: number, px: number, pz: number) {
  if (G.incident) {
    incidentAge += 1 / 60;
    // ---- Phase 16 audit WATCHDOG: the Phase 15 sim could stall for
    // the whole session. If the assigned unit is WRECKED (100% damage
    // — the player can ram it to death), GameSystems' traffic loop
    // `continue`s on the wreck check BEFORE the dispatch branch, so
    // stepDispatchDrive never runs again: the incident never clears,
    // G.incident stays set, and no new incident ever generates. Same
    // if the dispatch order was lost some other way. Stand the call
    // down here and reschedule, so dispatch always recovers. ----
    let unit: NpcCar | null = null;
    for (const c of G.traffic) if (c.dispatch) { unit = c; break; }
    if (!unit) { G.incident = null; incidentAge = 0; nextIncidentAt = t + 30; }
    else if (unit.damage >= 100) {
      unit.dispatch = null;
      G.incident = null; incidentAge = 0;
      nextIncidentAt = t + 45;
      bark("Dispatch", "Unit is out of action — call stood down. Next crew takes the next one.");
    }
    return;
  }
  if (t < nextIncidentAt) return;
  // incidents are a Port Sable (main grid) service for now
  if (Math.abs(px) > 118 || Math.abs(pz) > 118) { nextIncidentAt = t + 15; return; }
  const spot = INCIDENT_SPOTS[Math.floor(Math.random() * INCIDENT_SPOTS.length)];
  if ((spot.x - px) ** 2 + (spot.z - pz) ** 2 < 25 ** 2) { nextIncidentAt = t + 10; return; } // never on top of the player
  const kind = spot.kinds[Math.floor(Math.random() * spot.kinds.length)];
  const wantSvc = kind === "fire" ? "fire" : "ambulance";
  // nearest free unit of the right service (a busy unit of the other
  // service is NOT reassigned — the call waits for the next cycle)
  let best: NpcCar | null = null; let bestD = Infinity;
  for (const c of G.traffic) {
    if (c.svc !== wantSvc || c.dispatch || c.side !== "main" || c.damage >= 100) continue;
    const d = (c.x - spot.x) ** 2 + (c.z - spot.z) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  if (!best) { nextIncidentAt = t + 20; return; }
  best.dormant = false; // a dispatched unit wakes regardless of streaming distance
  best.parked = false;
  best.dispatch = {
    x: spot.x, z: spot.z, kind, leg: 0, sceneT: 0,
    turnAt: best.axis === "x" ? nearestRoad(spot.x) : nearestRoad(spot.z),
  };
  G.incident = { x: spot.x, z: spot.z, kind };
  incidentAge = 0;
  bark("Dispatch", `${KIND_TEXT[kind]} at ${spot.label} — ${wantSvc === "fire" ? "fire unit" : "ambulance"} rolling.`);
  if (Math.random() < 0.5) pushPhoneMsg("Harbour Wire", `🚨 Dispatch: a ${KIND_TEXT[kind]} near ${spot.label}. A ${wantSvc === "fire" ? "fire unit" : "ambulance"} is on its way — watch for the cross on your map.`);
}

/** Clear the live incident (scene done or timed out) and put the
 * unit back into ordinary circulation on its nearest road. */
function clearDispatch(car: NpcCar, done: boolean) {
  const kind = car.dispatch?.kind;
  car.dispatch = null;
  G.incident = null;
  incidentAge = 0;
  // re-enter circulation: snap onto the nearer of the crossing roads
  const rx = nearestRoad(car.x), rz = nearestRoad(car.z);
  if (Math.abs(car.x - rx) <= Math.abs(car.z - rz)) {
    car.axis = "z"; car.fixed = rx; car.dir = (car.z < 0 ? 1 : -1) as 1 | -1;
    car.lane = car.dir > 0 ? 2.8 : -2.8; car.x = rx + car.lane;
  } else {
    car.axis = "x"; car.fixed = rz; car.dir = (car.x < 0 ? 1 : -1) as 1 | -1;
    car.lane = car.dir > 0 ? 2.8 : -2.8; car.z = rz + car.lane;
  }
  car.heading = headingFor(car.axis, car.dir);
  car.speed = 6;
  if (done && kind) bark("Dispatch", `Unit clear — ${KIND_TEXT[kind]} resolved. Back in circulation.`);
}

/** Drive one dispatched unit for a sim step. Returns true while the
 * dispatch owns the car (GameSystems' normal traffic step skips it).
 * Movement reuses the traffic lane model: fixed road + lane offset,
 * heading from axis/dir, graded speed — with emergency privileges
 * (no signal stops; other traffic is still queued around). */
export function stepDispatchDrive(car: NpcCar, dt: number, t: number): boolean {
  const d = car.dispatch;
  if (!d) return false;
  // a call that can't be reached in ~2.5 min is stood down honestly
  if (incidentAge > 150 && d.sceneT <= 0) { clearDispatch(car, false); nextIncidentAt = t + 60; return false; }
  if (d.sceneT > 0) {
    // ---- on scene: parked, crew working, ~8 s ----
    car.speed = Math.max(0, car.speed - 16 * dt);
    d.sceneT -= dt;
    if (d.sceneT <= 0) { clearDispatch(car, true); nextIncidentAt = t + 55 + Math.random() * 50; }
    return true;
  }
  const along = car.axis === "x" ? car.x : car.z;
  const targetAlong = d.leg === 0 ? d.turnAt : (car.axis === "x" ? d.x : d.z);
  const distLeft = Math.abs(targetAlong - along);
  // steer toward the leg target every step (the patrol dir is
  // arbitrary at assignment time; the turn at leg 0→1 sets its own)
  if (distLeft > 0.5) car.dir = (targetAlong >= along ? 1 : -1) as 1 | -1;
  // graded emergency cruise: fast mid-route, careful on approach
  const cruise = d.leg === 1 ? (distLeft < 10 ? 5 : 11) : 13.5;
  // simple queue respect: a slower car dead ahead caps our speed
  let cap = cruise;
  for (const o of G.traffic) {
    if (o === car || o.dormant) continue;
    const ahead = car.axis === "x" ? (o.x - car.x) * car.dir : (o.z - car.z) * car.dir;
    const side = car.axis === "x" ? Math.abs(o.z - car.z) : Math.abs(o.x - car.x);
    if (ahead > 0.5 && ahead < 5.5 && side < 2.4 && o.speed < cap) cap = Math.max(0, o.speed);
  }
  car.speed += Math.max(-16 * dt, Math.min(4.5 * dt, cap - car.speed));
  if (car.axis === "x") car.x += car.dir * car.speed * dt; else car.z += car.dir * car.speed * dt;
  car.heading = headingFor(car.axis, car.dir);
  // keep the lane glued to its road while running a leg
  if (car.axis === "x") car.z = (car.fixed ?? 0) + car.lane; else car.x = (car.fixed ?? 0) + car.lane;
  if (distLeft < 1.6) {
    if (d.leg === 0) {
      // turn onto the crossing road, same math as the traffic turn
      const oldLane = car.lane;
      const newAxis = car.axis === "x" ? "z" : "x";
      const perpTarget = newAxis === "x" ? d.x : d.z;
      const curPerp = newAxis === "x" ? car.z : car.x;
      car.dir = (perpTarget >= curPerp ? 1 : -1) as 1 | -1;
      car.lane = car.dir > 0 ? 2.8 : -2.8;
      const fixedPos = d.turnAt - oldLane + car.lane;
      car.fixed = d.turnAt;
      if (newAxis === "x") { car.z = fixedPos; car.x = along; } else { car.x = fixedPos; car.z = along; }
      car.axis = newAxis;
      car.heading = headingFor(car.axis, car.dir);
      d.leg = 1;
    } else {
      // arrived: stop beside the incident point and work the scene
      d.sceneT = 8;
      bark("Dispatch", `${car.svc === "fire" ? "Fire unit" : "Ambulance"} on scene — crew working.`);
    }
  }
  return true;
}
