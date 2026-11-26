// ---------------------------------------------------------------------------
// Phase 31 — Northreach loader stub: the third streamed district,
// bound to the shared factory in game/streamed.ts exactly like
// Eastmere (game/eastmere.ts) and Westbrook (game/westbrook.ts).
// The ONLY Northreach code in the eager bundle besides the bounds +
// gate constant in world.ts's STREAMED_DISTRICTS registry and the
// pure placement data in game/northreachData.ts (data only — no
// geometry, no meshes; it is also what the placement audit imports
// headlessly). Everything visual lives in components/Northreach.tsx
// behind this import.
// ---------------------------------------------------------------------------
import { createDistrictLoader } from "./streamed";

export const northreachLoader = createDistrictLoader("northreach", () => import("../components/Northreach"));

export const northreachState = northreachLoader.state;
export const northreachNeeded = northreachLoader.needed;
export const northreachInRange = northreachLoader.inRange;
export const loadNorthreach = northreachLoader.load;
