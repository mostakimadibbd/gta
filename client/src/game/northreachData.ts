// ---------------------------------------------------------------------------
// Harborfall — NORTHREACH placement data (Phase 31).
//
// Pure data, no React / no THREE: imported by the lazy chunk
// (components/Northreach.tsx) AND headlessly by the placement audit
// (tools/audit-entry.ts), so the district's static placements are
// audited against its colliders exactly like Eastmere/Westbrook —
// the audit can never drift from the game because it reads this
// very table. Nothing in the eager bundle imports it (the loader
// stub doesn't), so it ships inside the lazy chunk.
//
// SITING (the honest fit): Northgate's x=−20 road column already
// runs the district's full height and carries the causeway south to
// Port Sable. Northreach continues that same axis north — a short
// bridge deck from Northgate's north shore (z=−296) to a quiet
// clifftop headland. Land: x −72..32, z −368..−304. The main street
// is x=−20 again; one cross street (z=−336) completes the grid.
// Landmarks: a small stone chapel (NW block) and an observatory
// dome (NE block). Viewpoint: Northreach Point, at the cliff edge
// at the main street's north end. Traffic-free, like the other
// streamed districts — parked cars and ambient walkers only.
// ---------------------------------------------------------------------------
import type { Blocker } from "../world";

/** Building + landmark colliders (centre + half extents). */
export const NORTHREACH_BLOCKERS: Blocker[] = [
  { x: -58, z: -354, hw: 5, hd: 4 },     // the chapel (landmark, NW block)
  { x: -36, z: -354, hw: 4, hd: 3.5 },   // cottage A (NW block)
  { x: 8, z: -354, hw: 4.5, hd: 4.5 },   // the observatory (landmark, NE block)
  { x: -4, z: -352, hw: 3.5, hd: 3 },    // cottage B (NE block)
  { x: -48, z: -318, hw: 5, hd: 4 },     // the tea house (SW block)
  { x: -62, z: -316, hw: 3.5, hd: 3 },   // cottage C (SW block)
  { x: 8, z: -318, hw: 4, hd: 3.5 },     // cottage D (SE block)
  { x: -4, z: -316, hw: 3, hd: 2.8 },    // the cliff store (SE block)
];

/** Visual building shells (chapel + observatory are built specially
 * in the chunk, like Westbrook's silo + cranes). */
export const NORTHREACH_BUILDINGS: { x: number; z: number; w: number; d: number; h: number; color: string }[] = [
  { x: -36, z: -354, w: 8, d: 7, h: 5, color: "#8a8f7d" },
  { x: -4, z: -352, w: 7, d: 6, h: 4.5, color: "#7d8a84" },
  { x: -48, z: -318, w: 10, d: 8, h: 5.5, color: "#7a6a4f" },
  { x: -62, z: -316, w: 7, d: 6, h: 4.5, color: "#97a091" },
  { x: 8, z: -318, w: 8, d: 7, h: 5, color: "#6f7f78" },
  { x: -4, z: -316, w: 6, d: 5.6, h: 4, color: "#5f7268" },
];

/** Parked cars (decorative — the district is traffic-free). */
export const NORTHREACH_PARKED: { x: number; z: number; heading: number; kind: "sedan" | "hatch" | "coupe" | "pickup"; color: string }[] = [
  { x: -13.4, z: -322, heading: Math.PI, kind: "hatch", color: "#3f7d8c" },
  { x: -26.6, z: -348, heading: 0, kind: "sedan", color: "#a8642c" },
  { x: 16, z: -329.4, heading: Math.PI / 2, kind: "pickup", color: "#5c6650" },
];

/** Ambient walkers: beat loops on the kerbs + the cliff path (every
 * beat verified clear of the blockers above by the placement audit). */
export const NORTHREACH_WALKERS: { beats: [number, number][]; top: string; bottom: string; skin: string; hair: string; gender: "m" | "f" }[] = [
  { beats: [[-14.8, -310], [-14.8, -362]], top: "#2e6f79", bottom: "#2b3440", skin: "#c68863", hair: "#2a1a10", gender: "f" },
  { beats: [[-66, -341.2], [26, -341.2]], top: "#546e7a", bottom: "#232c38", skin: "#6e4423", hair: "#0e0c0a", gender: "m" },
  { beats: [[-25.2, -308], [-25.2, -330]], top: "#c96a2c", bottom: "#3a3f45", skin: "#8d5524", hair: "#14100e", gender: "m" },
  { beats: [[-68, -312], [-68, -360]], top: "#a8642c", bottom: "#2f3a33", skin: "#e8b08a", hair: "#4a2c14", gender: "f" },
];

/** Streets registered into world.ts on load (traffic-free: these
 * are for the map + road queries, no lane state is ever built). */
export const NORTHREACH_ROADS = { roadX: [-20], roadZ: [-336] };

/** Northreach Point — the viewpoint pad at the cliff edge, at the
 * main street's north end. */
export const NORTHREACH_VIEWPOINT = { x: -20, z: -363.5 };
