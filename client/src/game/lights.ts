// Harborfall — Phase 6 traffic-signal logic (A2). The VISUAL lamp cycle
// lives in World.tsx (lightMats): a 12 s cycle, intersections offset by
// half a cycle on alternating parity. This module mirrors that cycle so
// traffic AI obeys the same lights the player sees:
//
//   local = (t + parityOffset) % 12
//   green  local < 5.5 · amber 5.5–7 · red ≥ 7
//
// Convention: traffic travelling along Z reads `local` directly; traffic
// travelling along X reads the cross phase (local + 6) — the two flows
// alternate, like a real two-phase signal. Keep LIGHT_SPOTS in sync with
// World.tsx (same 8 signalled intersections; unsignalled grid crossings
// derive parity from their coordinates).
export const LIGHT_SPOTS: [number, number][] = [
  [-20, -20], [-20, 20], [20, -20], [20, 20],
  [-60, 20], [60, -20], [-20, 60], [20, -60],
];

export function lightPhaseAt(ix: number, iz: number, t: number): number {
  const idx = LIGHT_SPOTS.findIndex(([x, z]) => x === ix && z === iz);
  const off = idx >= 0
    ? (idx % 2) * 6
    : ((((ix + 100) / 40) + ((iz + 100) / 40)) % 2) * 6;
  return (t + off) % 12;
}

/** True when traffic on `axis` may proceed through intersection (ix, iz).
 * Amber counts as STOP for AI (they brake for it like cautious drivers). */
export function lightAllows(ix: number, iz: number, axis: "x" | "z", t: number): boolean {
  let local = lightPhaseAt(ix, iz, t);
  if (axis === "x") local = (local + 6) % 12;
  return local < 5.5;
}
