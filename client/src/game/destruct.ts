// Harborfall — Phase 14: shared destructible-breakage state.
// Phase 7 owns the meshes + debris pool; Combat (bat) and Phase 9
// (thrown bottles) break props too, so the broken set lives here
// instead of inside one component. Persistence is the Phase 9
// day-scoped set (harborfall-destruct, keyed by the ECO day serial):
// broken props stay broken for the game day and are repaired on the
// daily tick (Phase7's day-wrap handler calls resetDestructibles).
import { DESTRUCTIBLES } from "../world";
import { loadDaySet, saveDaySet, DESTRUCT_KEY } from "./phase9";

export const brokenDestructibles = new Set<number>(loadDaySet(DESTRUCT_KEY));

type BreakListener = (index: number, dirX: number, dirZ: number, power: number) => void;
const breakListeners = new Set<BreakListener>();
/** Phase7 subscribes to hide the mesh + spray debris for ANY break,
 * whoever caused it (car ram, bat, bottle). Returns an unsubscribe. */
export function onDestructibleBreak(cb: BreakListener): () => void {
  breakListeners.add(cb);
  return () => { breakListeners.delete(cb); };
}

/** Break one prop (idempotent). Returns true if this call broke it. */
export function breakDestructible(index: number, dirX = 0, dirZ = 0, power = 0): boolean {
  if (index < 0 || index >= DESTRUCTIBLES.length || brokenDestructibles.has(index)) return false;
  brokenDestructibles.add(index);
  saveDaySet(DESTRUCT_KEY, [...brokenDestructibles]);
  breakListeners.forEach((cb) => cb(index, dirX, dirZ, power));
  return true;
}

/** Break the first intact prop within `radius` of (x, z). */
export function tryBreakDestructibleAt(x: number, z: number, radius: number, dirX = 0, dirZ = 0, power = 0): boolean {
  for (let i = 0; i < DESTRUCTIBLES.length; i++) {
    const d = DESTRUCTIBLES[i];
    if (brokenDestructibles.has(i)) continue;
    if ((d.x - x) ** 2 + (d.z - z) ** 2 < radius * radius) return breakDestructible(i, dirX, dirZ, power);
  }
  return false;
}

/** Overnight repairs: every prop whole again (Phase7 re-shows them). */
export function resetDestructibles() {
  brokenDestructibles.clear();
  saveDaySet(DESTRUCT_KEY, []);
}
