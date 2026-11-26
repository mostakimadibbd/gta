// ---------------------------------------------------------------------------
// Phase 26 — streamed-district loader factory (generalised from the
// Phase 25 Eastmere stub, whose behaviour is preserved exactly).
//
// Every streamed district is a SEPARATE lazy bundle chunk that the
// web server only sends when the player travels toward it — the
// initial download never carries a district's geometry. This factory
// holds the shared loader state machine; each district stub
// (game/eastmere.ts, game/westbrook.ts) is a three-line binding of a
// district id to its dynamic import.
//
// Load semantics:
//  · needed() — near the district's causeway gate, or (defensively)
//    already inside its bounds.
//  · load() — single-flight; on success the chunk's module scope has
//    registered its colliders into world.ts (registerStreamedDistrict
//    is idempotent — a district registers exactly once per session,
//    however many times load() is called) and the district stays
//    loaded for the session.
//  · FAILURE (chunk 404 / offline): load() resolves false, the state
//    stays unloaded, NOTHING is registered — no half-registered
//    collider set is possible, because registration is the chunk's
//    own module-scope act, all-or-nothing with the import. The
//    district's land stays water (isWaterAt only treats LOADED
//    districts as land), so the causeway simply ends at the shore:
//    the player can always turn around. App.tsx retries with a
//    backoff and tells the player once per approach (Phase 26 fix —
//    Phase 25 silently gave up after a single failed attempt).
// ---------------------------------------------------------------------------
import type { ComponentType } from "react";
import { STREAMED_DISTRICTS } from "../world";

export interface DistrictState {
  loaded: boolean;
  loading: boolean;
  World: ComponentType<{ night: number }> | null;
}

export interface DistrictLoader {
  id: string;
  state: DistrictState;
  needed: (x: number, z: number) => boolean;
  /** Phase 27 audit: pure geometry — is the player within the
   * approach zone? Unlike needed() this ignores load state, so
   * callers can tell "left the area" apart from "a load is in
   * flight" (the App's once-per-approach toast depends on it). */
  inRange: (x: number, z: number) => boolean;
  load: () => Promise<boolean>;
}

export function createDistrictLoader(
  id: string,
  chunk: () => Promise<{ default: ComponentType<{ night: number }> }>,
): DistrictLoader {
  const def = STREAMED_DISTRICTS.find((s) => s.id === id);
  const state: DistrictState = { loaded: false, loading: false, World: null };
  const inRange = (x: number, z: number): boolean => {
    if (!def) return false;
    if (Math.hypot(x - def.gate.x, z - def.gate.z) < 70) return true;
    return x > def.x0 - 40 && x < def.x1 + 40 && z > def.z0 - 40 && z < def.z1 + 40;
  };
  return {
    id,
    state,
    inRange,
    needed(x: number, z: number): boolean {
      if (state.loaded || state.loading) return false;
      return inRange(x, z);
    },
    async load(): Promise<boolean> {
      if (state.loaded) return true;
      if (state.loading) return false;
      state.loading = true;
      try {
        const mod = await chunk();
        state.World = mod.default;
        state.loaded = true;
        // Phase 28 audit: the success path MUST clear `loading` too.
        // It didn't — a concurrent ensureDistrictLoaded waiter polls
        // `state.loading`, so it spun its full ~10 s wait even though
        // the chunk had landed, and the flag lied to every later
        // reader (the App poll's single-flight skip included).
        state.loading = false;
        return true;
      } catch {
        state.loading = false;
        return false;
      }
    },
  };
}

/** Phase 27: drive a district load to completion for a caller that
 * NEEDS the district now (a mission start in that district). Unlike
 * load(), this never mistakes an in-flight load for a failure: it
 * waits for the in-flight attempt (usually the App poll's) to
 * settle, then makes one attempt of its own if that one failed.
 * Resolves true only when the district is actually loaded. */
export async function ensureDistrictLoaded(loader: DistrictLoader): Promise<boolean> {
  if (loader.state.loaded) return true;
  if (!loader.state.loading) return loader.load();
  for (let i = 0; i < 100 && loader.state.loading; i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (loader.state.loaded) return true;
  return loader.load();
}
