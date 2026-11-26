// ---------------------------------------------------------------------------
// Phase 26 — Westbrook loader stub: the second streamed district,
// bound to the shared factory in game/streamed.ts exactly like
// Eastmere (game/eastmere.ts). The ONLY Westbrook code in the eager
// bundle besides the bounds + gate constant in world.ts's
// STREAMED_DISTRICTS registry and the pure placement data in
// game/westbrookData.ts (data only — no geometry, no meshes; it is
// also what the placement audit imports headlessly). Everything
// visual lives in components/Westbrook.tsx behind this import.
// ---------------------------------------------------------------------------
import { createDistrictLoader } from "./streamed";

export const westbrookLoader = createDistrictLoader("westbrook", () => import("../components/Westbrook"));

export const westbrookState = westbrookLoader.state;
export const westbrookNeeded = westbrookLoader.needed;
export const westbrookInRange = westbrookLoader.inRange;
export const loadWestbrook = westbrookLoader.load;
