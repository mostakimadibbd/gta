// Harborfall — Phase 22: CITY RHYTHM.
//
// Port Sable breathes with the clock. One function — rhythmFactor —
// is the single source every density path reads:
//
//   · RUSH HOUR (07:00–09:00 and 17:00–19:00): ×1.3 — the streets
//     and pavements fill toward (never past) the High-density caps,
//     and the Cityliner dwells a little shorter at stops, because
//     busier service waits for no one.
//   · DEEP NIGHT (00:00–05:00): ×0.7 — the city thins out.
//   · Everything else: ×1 — the pre-Phase-22 city, exactly.
//
// Composition rule (the Phase 16 contract, extended): the factor
// MULTIPLIES the player's own density levers (game/perf.ts) —
// traffic share = min(1, trafficDensityShare() × rhythm), ped
// crowd = min(1, base × pedDensityFactor() × rhythm). The caps are
// the High-density caps: rhythm can fill the city up to what the
// High lever already allows, never beyond it, and the standing
// exemptions are untouched — service units, dispatched units, the
// bus, taxis, cops, hired staff and named NPCs are never culled by
// density, at any hour (they carry no density rank, or are forced
// active downstream, exactly as before).
//
// Before Phase 22 the traffic sim had its own private rush window
// (07:00–09:30 / 16:30–19:00) for the reserve pool and a flat +0.25
// ped bump; both now derive from this one function so the HUD chip,
// the bus, the crowds and the traffic can never disagree about
// whether it is rush hour.
import { G } from "./store";

/** Game hour 0–23 (dayTime 0 = 06:00 — the formula every system uses). */
export const gameHourFloat = () => (G.dayTime * 24 + 6) % 24;

/** The city-rhythm multiplier for a game hour. */
export function rhythmFactor(hour: number): number {
  if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 19)) return 1.3;
  if (hour >= 0 && hour < 5) return 0.7;
  return 1;
}
export const rhythmNow = () => rhythmFactor(gameHourFloat());
export const isRushNow = () => rhythmNow() > 1;
