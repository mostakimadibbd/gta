// ---------------------------------------------------------------------------
// Phase 25 — spawn/restore depenetration guard.
//
// The placement audit (tools/audit-placements.mjs) keeps every static
// spawn out of the building colliders, but saves are forever: a car
// parked against a wall in an older build — or restored from a
// snapshot written before a placement moved — must never come back
// INSIDE a wall. This guard runs at spawn/restore time (parked cars,
// last-car + fleet restores, garage take-outs, valet/rental spawns,
// traffic init) and on a 1 Hz cadence for settled cars. It is never
// on the per-frame path.
//
// The core test is the C++ building_overlap / resolve_overlap pair
// (src/cpp/physics.cpp) via its exact TS mirror in GamePhysics.ts —
// the guard uses the fallback mirror directly because it runs at
// module-load / spawn time, before the async WASM engine exists; the
// mirror is byte-identical math (parity-checked in Part D).
// ---------------------------------------------------------------------------
import { blockersNear, MANSION, type Blocker } from "../world";
import { fallbackPhysics } from "../physics/GamePhysics";

// Body half-widths by kind — the [0] entries of Vehicle.tsx's
// BODY_DIMS, kept in sync (the guard only needs the width: it tests
// the car as a circle of that radius, which is the conservative
// bound for a parked car at any heading).
const HALF_W: Record<string, number> = {
  sedan: 1.0, taxi: 1.0, coupe: 1.0, hatch: 0.95, muscle: 1.05, suv: 1.05,
  classic: 1.0, pickup: 1.05, van: 1.05, supercar: 1.1, bus: 1.25,
  wedge: 1.15, bicycle: 0.35, motorcycle: 0.4,
  // Phase 28 audit: the Phase 8/18 kinds were missing and fell back
  // to 1.0 — under-testing the widest bodies in the fleet (the
  // guard circle was up to 0.12u small on a Bronto). Values are the
  // BODY_DIMS half-widths, like the entries above.
  hyper: 1.1, gt: 1.0, tow: 1.05, kestrel: 1.04, bronto: 1.1,
  // Phase 32: service fleet (BODY_DIMS half-widths, same rule)
  ambulance: 1.05, firetruck: 1.1,
  // Phase 28 kinds
  tempest: 1.06, mule: 1.1, sovereign: 1.08,
};

// The coarse mansion blocker also seals the driveway pad on purpose
// (garage zone); the guard tests the villa against its two VISUAL
// footprints instead, exactly like the placement audit.
const MANSION_BOXES: Blocker[] = [
  { x: MANSION.x, z: MANSION.z, hw: 5.5, hd: 3.5 },
  { x: MANSION.x - 8.2, z: MANSION.z, hw: 2.5, hd: 3 },
];

function guardBoxes(x: number, z: number, radius: number): Blocker[] {
  const boxes = blockersNear(x, z, radius + 2);
  const i = boxes.findIndex((b) => b.x === MANSION.x && b.z === MANSION.z && b.hw === 6.6);
  if (i >= 0) boxes.splice(i, 1, ...MANSION_BOXES);
  return boxes;
}

/** Total building overlap of a circle at (x, z) — the quantity the
 * resolver below minimises. */
function totalOverlap(x: number, z: number, radius: number): number {
  let s = 0;
  for (const b of guardBoxes(x, z, radius)) s += fallbackPhysics.buildingOverlap(x, z, radius, b.x, b.z, b.hw, b.hd);
  return s;
}

/** Push a point out of every building collider it intersects, along
 * the smallest penetration axis per box (up to 3 relaxation passes
 * for corner cases). Returns the resolved point + overlap removed.
 *
 * Phase 26 hardening (termination): a car wedged in a gap narrower
 * than its own body can NEVER fully resolve — naive relaxation then
 * ping-pongs between the two colliders, and the 1 Hz sweep would
 * re-shove it every second forever. So the resolver keeps the BEST
 * position seen across its passes (least total overlap) and the
 * caller only accepts a move that STRICTLY reduces total overlap.
 * Each accepted sweep therefore strictly decreases a quantity
 * bounded below by 0 — oscillation is impossible, and a truly
 * wedged car is left exactly where it is rather than jittered. */
export function depenetratePoint(x: number, z: number, radius: number): { x: number; z: number; moved: number } {
  const start = totalOverlap(x, z, radius);
  if (start <= 0) return { x, z, moved: 0 };
  let cx = x, cz = z;
  let bx = x, bz = z, best = start;
  for (let pass = 0; pass < 3; pass++) {
    let pushed = false;
    for (const b of guardBoxes(cx, cz, radius)) {
      const r = fallbackPhysics.resolveOverlap(cx, cz, radius, b.x, b.z, b.hw, b.hd);
      if (r.depth > 0) { cx = r.x; cz = r.z; pushed = true; }
    }
    const t = totalOverlap(cx, cz, radius);
    if (t < best) { best = t; bx = cx; bz = cz; }
    if (!pushed || best <= 0) break;
  }
  if (best >= start) return { x, z, moved: 0 }; // no strict improvement — stay put
  return { x: bx, z: bz, moved: start - best };
}

/** A resolved destination must never be bought by shoving the car
 * into ANOTHER car (Phase 26): callers pass nearby cars as circular
 * obstacles; if the destination overlaps any of them the plain move
 * is refused and the Phase 27 fallback ladder runs instead
 * (resolveCarPoint below). */
export interface GuardObstacle { x: number; z: number; r: number }
function destinationBlocked(x: number, z: number, radius: number, obstacles?: GuardObstacle[]): boolean {
  if (!obstacles) return false;
  for (const o of obstacles) {
    const rr = radius + o.r;
    if ((x - o.x) ** 2 + (z - o.z) ** 2 < rr * rr) return true;
  }
  return false;
}

/** Body half-width used as the guard radius for a kind (for callers
 * building obstacle lists). */
export const guardRadius = (kind?: string): number => HALF_W[kind ?? "sedan"] ?? 1.0;

/** Phase 27 audit — the destinationBlocked FALLBACK. Phase 26
 * refused a wall-clearing move outright when the resolved spot
 * touched another car, with no fallback: a car whose only clear
 * spot was car-occupied stayed inside the wall forever (safe from
 * jitter, but embedded for good). The fallback ladder, in order:
 *  1. joint resolution — relax against buildings AND the obstacle
 *     circles together, so the car threads out of the wall into a
 *     spot clear of both;
 *  2. last resort — accept the building-only resolution when it
 *     FULLY clears the wall even if it touches a car: two parked
 *     cars touching is cosmetic and self-heals the moment either is
 *     driven (the vehicle collision step separates them), while a
 *     car inside a wall never heals at all.
 * If neither applies (still in a wall either way), the caller
 * leaves the car exactly where it is — the monotone rule. */
function resolveJoint(x: number, z: number, radius: number, obstacles: GuardObstacle[]): { x: number; z: number } {
  let cx = x, cz = z;
  for (let pass = 0; pass < 3; pass++) {
    for (const b of guardBoxes(cx, cz, radius)) {
      const r = fallbackPhysics.resolveOverlap(cx, cz, radius, b.x, b.z, b.hw, b.hd);
      if (r.depth > 0) { cx = r.x; cz = r.z; }
    }
    for (const o of obstacles) {
      const dx = cx - o.x, dz = cz - o.z;
      const rr = radius + o.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2);
        if (d < 1e-4) { cx += rr; } else { const push = (rr - d) / d; cx += dx * push; cz += dz * push; }
      }
    }
  }
  return { x: cx, z: cz };
}

/** Shared resolution driver for both car shapes: returns the point
 * to move to, or null to stay put. */
function resolveCarPoint(x: number, z: number, radius: number, obstacles?: GuardObstacle[]): { x: number; z: number } | null {
  const r = depenetratePoint(x, z, radius);
  if (r.moved <= 0) return null;
  if (!destinationBlocked(r.x, r.z, radius, obstacles)) return { x: r.x, z: r.z };
  if (obstacles && obstacles.length > 0) {
    const j = resolveJoint(x, z, radius, obstacles);
    if (totalOverlap(j.x, j.z, radius) <= 0 && !destinationBlocked(j.x, j.z, radius, obstacles)) return j;
    if (totalOverlap(r.x, r.z, radius) <= 0) return { x: r.x, z: r.z }; // last resort (see above)
  }
  return null;
}

interface GuardCar {
  kind: string;
  state: { x: number; z: number };
  x: number; z: number;
  storedAway?: boolean;
}

/** Depenetrate a world car (PlayerCar shape). Boats stay in the
 * water — a hull near a dock box must never be pushed onto land. */
export function depenetrateCar(car: GuardCar, obstacles?: GuardObstacle[]): boolean {
  if (car.storedAway) return false;
  if (car.kind === "boat" || car.kind === "skiff" || car.kind === "plane") return false;
  const radius = HALF_W[car.kind] ?? 1.0;
  const dest = resolveCarPoint(car.state.x, car.state.z, radius, obstacles);
  if (!dest) return false;
  car.state.x = dest.x; car.state.z = dest.z; car.x = dest.x; car.z = dest.z;
  return true;
}

interface GuardNpc {
  kind?: string;
  x: number; z: number;
  parked?: boolean; parkX?: number; parkZ?: number;
}

/** Depenetrate a traffic unit (NpcCar shape — position lives on the
 * car itself). A parked rush-reserve car's return spot follows it. */
export function depenetrateNpc(car: GuardNpc, obstacles?: GuardObstacle[]): boolean {
  if (car.kind === "boat" || car.kind === "skiff" || car.kind === "plane") return false;
  const radius = HALF_W[car.kind ?? "sedan"] ?? 1.0;
  const dest = resolveCarPoint(car.x, car.z, radius, obstacles);
  if (!dest) return false;
  car.x = dest.x; car.z = dest.z;
  if (car.parked) { car.parkX = dest.x; car.parkZ = dest.z; }
  return true;
}
