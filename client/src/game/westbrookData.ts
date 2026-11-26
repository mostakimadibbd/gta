// ---------------------------------------------------------------------------
// Harborfall — WESTBROOK placement data (Phase 26).
//
// Pure data, no React / no THREE: this module is imported by the
// lazy chunk (components/Westbrook.tsx) AND headlessly by the
// placement audit (tools/audit-entry.ts), so the district's static
// placements are audited against its colliders with the same rigour
// as the base world — the audit can never drift from the game
// because it reads this very table. Nothing in the eager bundle
// imports it (the loader stub doesn't), so it ships inside the lazy
// chunk alongside the visuals.
//
// Layout: a small harbour-industrial district on the west shore's
// far side. The z=20 road crosses a short causeway from the Ferry
// Quarter shore (gate at (−118, 20)) and becomes the district's
// main street; one north–south street (x=−164) and one cross
// street (z=48) complete the grid. Land: x −194..−132, z −26..66.
// Landmark: the Westbrook grain silo at the SW shore, with two dock
// cranes on the harbour (east) quay. Viewpoint: Breakwater Point at
// the west end of the main street. Traffic-free, like Eastmere —
// parked cars and ambient walkers only (BLUEPRINT Phase 26).
// ---------------------------------------------------------------------------
import type { Blocker } from "../world";

/** Building + landmark colliders (centre + half extents). */
export const WESTBROOK_BLOCKERS: Blocker[] = [
  { x: -178, z: 2, hw: 6, hd: 5 },      // harbour warehouse W
  { x: -148, z: 2, hw: 6, hd: 5 },      // harbour warehouse E
  { x: -178, z: 34, hw: 5.5, hd: 4.5 }, // cannery
  { x: -148, z: 34, hw: 5, hd: 4 },     // harbour office
  { x: -178, z: 60, hw: 5, hd: 3.5 },   // net loft
  { x: -146, z: 60, hw: 5.5, hd: 4 },   // dockside flats
  { x: -146, z: -12, hw: 4.5, hd: 4 },  // chandlery
  { x: -180, z: -13, hw: 4, hd: 3.5 },  // store shed
  { x: -188, z: 58, hw: 4, hd: 4 },     // grain silo (landmark footprint)
  { x: -136, z: 8, hw: 1.3, hd: 1.3 },  // dock crane S (base)
  { x: -136, z: 40, hw: 1.3, hd: 1.3 }, // dock crane N (base)
];

/** Visual building shells (the silo + cranes are built specially in
 * the chunk; the diner-equivalent here is the harbour office block). */
export const WESTBROOK_BUILDINGS: { x: number; z: number; w: number; d: number; h: number; color: string }[] = [
  { x: -178, z: 2, w: 12, d: 10, h: 10, color: "#6b7c74" },
  { x: -148, z: 2, w: 12, d: 10, h: 12, color: "#5d7268" },
  { x: -178, z: 34, w: 11, d: 9, h: 9, color: "#75857a" },
  { x: -148, z: 34, w: 10, d: 8, h: 13, color: "#52665e" },
  { x: -178, z: 60, w: 10, d: 7, h: 8, color: "#66796f" },
  { x: -146, z: 60, w: 11, d: 8, h: 15, color: "#49635f" },
  { x: -146, z: -12, w: 9, d: 8, h: 7, color: "#71837a" },
  { x: -180, z: -13, w: 8, d: 7, h: 6, color: "#5f7268" },
];

/** Parked cars (decorative — the district is traffic-free). */
export const WESTBROOK_PARKED: { x: number; z: number; heading: number; kind: "sedan" | "hatch" | "coupe" | "pickup"; color: string }[] = [
  { x: -152, z: 25.2, heading: -Math.PI / 2, kind: "pickup", color: "#5c6650" },
  { x: -160, z: 40, heading: 0, kind: "sedan", color: "#3f7d8c" },
  { x: -172, z: 43.2, heading: Math.PI / 2, kind: "hatch", color: "#a8642c" },
];

/** Ambient walkers: beat loops on the sidewalks + quay (every beat
 * verified clear of the blockers above by the placement audit). */
export const WESTBROOK_WALKERS: { beats: [number, number][]; top: string; bottom: string; skin: string; hair: string; gender: "m" | "f" }[] = [
  { beats: [[-150, 25.4], [-186, 25.4]], top: "#546e7a", bottom: "#232c38", skin: "#6e4423", hair: "#0e0c0a", gender: "m" },
  { beats: [[-158.6, -12], [-158.6, 42]], top: "#c96a2c", bottom: "#2b3440", skin: "#8d5524", hair: "#14100e", gender: "m" },
  { beats: [[-186, 42.6], [-140, 42.6]], top: "#2e6f79", bottom: "#3a3f45", skin: "#c68863", hair: "#2a1a10", gender: "f" },
  { beats: [[-169.4, 30], [-169.4, -14]], top: "#a8642c", bottom: "#2f3a33", skin: "#e8b08a", hair: "#4a2c14", gender: "f" },
  { beats: [[-138.5, 25.4], [-138.5, 60]], top: "#31556e", bottom: "#3d3428", skin: "#c68863", hair: "#1c1410", gender: "m" },
];

/** Streets registered into world.ts on load (traffic-free: these
 * are for the map + road queries, no lane state is ever built). */
export const WESTBROOK_ROADS = { roadX: [-164], roadZ: [20, 48] };

/** Breakwater Point — the viewpoint pad at the main street's west end. */
export const WESTBROOK_VIEWPOINT = { x: -189, z: 12 };
