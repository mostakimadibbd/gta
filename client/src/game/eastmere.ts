// ---------------------------------------------------------------------------
// Phase 25 — Eastmere loader stub (the ONLY Eastmere code in the
// eager bundle, besides the bounds + gate constant in world.ts's
// STREAMED_DISTRICTS registry).
//
// Honest architecture: a browser game cannot execute world geometry
// on a server. The real equivalent of "another city on the server
// side" is a district shipped as a SEPARATE bundle chunk that the
// server only sends when the player travels there — the initial
// download does not grow by the district's weight. Everything
// Eastmere (buildings, roads, props, peds) lives in
// components/Eastmere.tsx behind this dynamic import; crossing the
// causeway approach triggers the load, and once loaded the district
// stays for the session (its colliders register into world.ts and
// are never unregistered — documented in BLUEPRINT Phase 25).
// ---------------------------------------------------------------------------
import type { ComponentType } from "react";
import { STREAMED_DISTRICTS } from "../world";

export const eastmereState: {
  loaded: boolean;
  loading: boolean;
  World: ComponentType<{ night: number }> | null;
} = { loaded: false, loading: false, World: null };

const DEF = STREAMED_DISTRICTS.find((s) => s.id === "eastmere");

/** Should the chunk be fetched now? Near the causeway gate, or
 * (defensively) already inside the district bounds. */
export function eastmereNeeded(x: number, z: number): boolean {
  if (!DEF || eastmereState.loaded || eastmereState.loading) return false;
  if (Math.hypot(x - DEF.gate.x, z - DEF.gate.z) < 70) return true;
  return x > DEF.x0 - 40 && x < DEF.x1 + 40 && z > DEF.z0 - 40 && z < DEF.z1 + 40;
}

export async function loadEastmere(): Promise<boolean> {
  if (eastmereState.loaded) return true;
  if (eastmereState.loading) return false;
  eastmereState.loading = true;
  try {
    await import("../components/Eastmere");
    eastmereState.loaded = true;
    return true;
  } catch {
    eastmereState.loading = false;
    return false;
  }
}
