// Harborfall — Phase 42: HARBOUR WILDLIFE (data + shared state).
//
// This module is deliberately PURE (no three, no DOM): the path
// maths is consumed by components/Wildlife.tsx (rendering), by
// game/phase8.ts (the fishing bonus reads the pod's live position),
// and by tools/audit-entry.ts (section 11 verifies the route the
// game actually swims — every sample in open water, clear of the
// island, the bridge, and the moored harbour-life boats).
//
// HONEST SCOPE: the pod swims a scripted ambient route — a closed
// Catmull-Rom loop around Sable Island and along the mainland
// shore. It is not an ecosystem simulation: no feeding, no
// migration, no reaction to weather or time of day. The one real
// behaviour is local and stated: a moving boat within ~9u makes
// the nearest dolphins dive for a few seconds (components/
// Wildlife.tsx), and the pod's presence near a fishing cast is
// worth a small, documented bonus on the catch roll (game/
// phase8.ts rollCatch) — because the fishing table already had a
// rarity roll to modify. Nothing else reads the pod.

/** The pod's waypoints (closed loop, swum in order). Siting, all
 * verified by audit section 11 against world.isWaterAt + clearance
 * radii: west offshore → south of Sable Island → the channel west
 * of the bay bridge (BRIDGE deck spans x 55..65, z 116..208) →
 * east along the mainland shore → the north-shore run back west.
 * The moored scenery boats (World.tsx HARBOUR LIFE) sit at yacht
 * (62,152), cargo ship (-72,168), tug (18,141); the rental skiff
 * spawns at (-4,138) — the route keeps its distance from all four,
 * and the dive rule covers live traffic on top of that. */
export const POD_ROUTE: ReadonlyArray<readonly [number, number]> = [
  [-95, 147],   // NW of Sable Island
  [-135, 165],  // west offshore
  [-120, 200],  // SW offshore
  [-64, 200],   // south of the island
  [-10, 205],   // SE bay
  [25, 185],    // the channel, west of the bridge
  [30, 155],    // east shore run
  [-30, 146],   // north-shore run (island centre is (-64,168), r 17)
  [-72, 140],   // bow north around the moored cargo ship — its bow
                // face reaches z ≈ 146; this point keeps the curve
                // ~6u clear of the hull (audit section 11 measures
                // the real curve against the hull box)
];

/** Dolphins in the pod (components/Wildlife.tsx renders this many). */
export const POD_SIZE = 5;
/** Pod cruise speed along the path, units/second. */
export const POD_SPEED = 3.4;
/** A moving boat closer than this (units) makes a dolphin dive. */
export const POD_DIVE_RADIUS = 9;
/** Fishing: the pod within this range of a cast point is a good sign. */
export const POD_FISH_RADIUS = 40;

// ---- closed Catmull-Rom through POD_ROUTE, arc-length table ----
// Precomputed once at module load (512 samples — pure arithmetic,
// headless-safe for the audit). podPathPoint(u) walks the table, so
// the component, the fishing check and the audit all read the SAME
// curve the dolphins swim.
const SAMPLES = 512;
const _pts: Array<{ x: number; z: number; cum: number }> = [];
export const POD_PATH_LENGTH = (() => {
  const n = POD_ROUTE.length;
  const cr = (i: number) => POD_ROUTE[((i % n) + n) % n];
  let prev: { x: number; z: number } | null = null;
  let total = 0;
  for (let s = 0; s <= SAMPLES; s++) {
    const f = (s / SAMPLES) * n;
    const i = Math.floor(f) % n;
    const t = f - Math.floor(f);
    const p0 = cr(i - 1), p1 = cr(i), p2 = cr(i + 1), p3 = cr(i + 2);
    const t2 = t * t, t3 = t2 * t;
    const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
    const z = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
    if (prev) total += Math.hypot(x - prev.x, z - prev.z);
    _pts.push({ x, z, cum: total });
    prev = { x, z };
  }
  return total;
})();

/** Point at arc distance d along the loop (wraps). Heading is the
 * travel direction as an angle whose forward vector is
 * (sin h, cos h) — the vehicle convention used across the game. */
export function podPathPoint(d: number): { x: number; z: number; heading: number } {
  const L = POD_PATH_LENGTH;
  let dd = d % L; if (dd < 0) dd += L;
  // binary search the arc-length table
  let lo = 0, hi = _pts.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (_pts[mid].cum < dd) lo = mid + 1; else hi = mid; }
  const i = Math.max(1, lo);
  const a = _pts[i - 1], b = _pts[i];
  const span = Math.max(1e-6, b.cum - a.cum);
  const t = Math.min(1, Math.max(0, (dd - a.cum) / span));
  const x = a.x + (b.x - a.x) * t;
  const z = a.z + (b.z - a.z) * t;
  return { x, z, heading: Math.atan2(b.x - a.x, b.z - a.z) };
}

/** The pod's live state — written every frame by components/
 * Wildlife.tsx (the leader's position), read by game/phase8.ts.
 * Session-only presentation state: never persisted, never saved. */
export const POD = { x: -95, z: 147, heading: 0 };

/** Phase 43: EVERY member's live position + height, written every
 * frame by components/Wildlife.tsx alongside POD. The photo
 * challenges (game/postcards.ts) need to know whether a dolphin is
 * actually BREACHING (y above the surface) and where — the leader
 * point alone can't say that. y is the body centre's height: the
 * porpoise cycle runs y ≈ −1.07..+0.63, so y > ~0.08 means the
 * animal is visibly out of the water. Same session-only contract
 * as POD: never persisted, never saved. */
export const POD_MEMBERS: Array<{ x: number; z: number; y: number }> =
  Array.from({ length: POD_SIZE }, () => ({ x: -95, z: 147, y: -1 }));

/** Is the pod within r units of (x, z)? (fishing's good-sign check) */
export function dolphinsNear(x: number, z: number, r: number = POD_FISH_RADIUS): boolean {
  return (POD.x - x) ** 2 + (POD.z - z) ** 2 <= r * r;
}

// ---- Phase 42: PERCHED GULLS. The Phase 2 harbour flock (a single
// rigid circling group in GameSystems.tsx) has no per-bird steering
// to extend, so the second behaviour is additive instead: gulls
// perched on mooring posts that scatter when the player comes
// close and resettle when they leave. The posts are new small
// props rendered by components/Wildlife.tsx at these points —
// two on the pier deck's south edge, two at the Sable Island dock
// shore, two on the mainland sand at the waterline. Audit section
// 11 checks each stands on land, outside every collider, and clear
// of the fishing stand points. ----
export interface GullPerch { x: number; z: number }
export const GULL_PERCHES: GullPerch[] = [
  { x: -4.3, z: 126.5 },  // pier deck (the deck mesh runs z 114..130
  { x: 4.3, z: 126.5 },   // over the water; z 126.5 stands on its landward half)
  { x: -68, z: 154 },     // Sable Island dock shore
  { x: -60, z: 154 },     // Sable Island dock shore
  { x: 24, z: 127.3 },    // mainland waterline, east of the pier
  { x: -24, z: 127.3 },   // mainland waterline, west of the pier
];
/** How close (units, horizontal) before a perched gull scatters. */
export const GULL_SCARE_RADIUS = 5;
/** How far the player must be before a scattered gull resettles. */
export const GULL_SETTLE_RADIUS = 9;
