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

/** Push a point out of every building collider it intersects, along
 * the smallest penetration axis per box (up to 3 relaxation passes
 * for corner cases). Returns the resolved point + total push. */
export function depenetratePoint(x: number, z: number, radius: number): { x: number; z: number; moved: number } {
  let moved = 0;
  for (let pass = 0; pass < 3; pass++) {
    let pushed = false;
    for (const b of guardBoxes(x, z, radius)) {
      const r = fallbackPhysics.resolveOverlap(x, z, radius, b.x, b.z, b.hw, b.hd);
      if (r.depth > 0) { x = r.x; z = r.z; moved += r.depth; pushed = true; }
    }
    if (!pushed) break;
  }
  return { x, z, moved };
}

interface GuardCar {
  kind: string;
  state: { x: number; z: number };
  x: number; z: number;
  storedAway?: boolean;
}

/** Depenetrate a world car (PlayerCar shape). Boats stay in the
 * water — a hull near a dock box must never be pushed onto land. */
export function depenetrateCar(car: GuardCar): boolean {
  if (car.storedAway) return false;
  if (car.kind === "boat" || car.kind === "skiff" || car.kind === "plane") return false;
  const r = depenetratePoint(car.state.x, car.state.z, HALF_W[car.kind] ?? 1.0);
  if (r.moved <= 0) return false;
  car.state.x = r.x; car.state.z = r.z; car.x = r.x; car.z = r.z;
  return true;
}

interface GuardNpc {
  kind?: string;
  x: number; z: number;
  parked?: boolean; parkX?: number; parkZ?: number;
}

/** Depenetrate a traffic unit (NpcCar shape — position lives on the
 * car itself). A parked rush-reserve car's return spot follows it. */
export function depenetrateNpc(car: GuardNpc): boolean {
  if (car.kind === "boat" || car.kind === "skiff" || car.kind === "plane") return false;
  const r = depenetratePoint(car.x, car.z, HALF_W[car.kind ?? "sedan"] ?? 1.0);
  if (r.moved <= 0) return false;
  car.x = r.x; car.z = r.z;
  if (car.parked) { car.parkX = r.x; car.parkZ = r.z; }
  return true;
}
