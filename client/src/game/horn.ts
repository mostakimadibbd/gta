// Harborfall — Phase 22: THE HORN, WITH CONSEQUENCES (small ones).
//
// B (and the touch HORN button, and gamepad RB via the B key path)
// has played the horn sound since Phase 4. Now the city HEARS it —
// a cosmetic life detail, honestly scoped:
//   · pedestrians within ~8u startle: a brief step-aside hop on the
//     existing knock-velocity channel (kvx/kvz, the same slide a
//     light car tap produces) plus the arms-up flinch pose;
//   · a traffic car directly ahead within ~10u MAY pull toward the
//     kerb for ~2 s — through the Phase 17 swerve-offset path
//     (car.hornSwerve, a visual mesh offset; the AI's lane, route
//     and speed are never touched).
// Reactions are applied by GameSystems' world step, which enforces
// a 1.5 s reaction cooldown — mashing the horn plays the sound but
// cannot keep the whole street hopping. Cops don't react (they
// aren't in the traffic pool), service units and the bus don't
// react, and a honk never raises wanted or heat of any kind.
//
// This module is the event record only: honkHorn() plays the sound
// (exactly the old behaviour) and stamps where it happened.
import { G } from "./store";
import { sfx } from "./audio";

export const HORN = {
  /** change counter — GameSystems reacts when this increments */
  seq: 0,
  x: 0, z: 0, heading: 0,
};

/** Sound + event stamp. Called from the Vehicle key handler (B)
 * and the touch HORN button — the two places sfx.horn() was called
 * directly for the PLAYER's horn (traffic's own honks stay plain
 * sound; the city reacting to itself would be chaos). */
export function honkHorn() {
  sfx.horn();
  if (G.driving && G.activeCarId >= 0) {
    const c = G.cars[G.activeCarId];
    HORN.x = c.state.x; HORN.z = c.state.z; HORN.heading = c.state.heading;
  } else {
    HORN.x = G.playerPos.x; HORN.z = G.playerPos.z; HORN.heading = G.playerHeading;
  }
  HORN.seq += 1;
}
