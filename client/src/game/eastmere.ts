// ---------------------------------------------------------------------------
// Phase 25 — Eastmere loader stub (the ONLY Eastmere code in the
// eager bundle, besides the bounds + gate constant in world.ts's
// STREAMED_DISTRICTS registry). Phase 26: the state machine moved to
// the shared factory in game/streamed.ts; this stub keeps its exact
// Phase 25 exports and behaviour (single-flight load, loaded stays
// loaded, failure resolves false and registers nothing).
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
import { createDistrictLoader } from "./streamed";

export const eastmereLoader = createDistrictLoader("eastmere", () => import("../components/Eastmere"));

export const eastmereState = eastmereLoader.state;
export const eastmereNeeded = eastmereLoader.needed;
export const eastmereInRange = eastmereLoader.inRange;
export const loadEastmere = eastmereLoader.load;
