// Harborfall — Phase 16: THE ARREST ESCORT.
//
// Phase 15's bust was an instant overlay: the meter filled and the
// screen cut to BUSTED. Now, when the meter fills while the player
// is ON FOOT, the nearest active patrol officer gets out and walks
// the arrest as a scene: officer approaches, the player rig holds
// the hands-up pose (Player.tsx drives it from ESCORT.active), and
// the pair walk together to the patrol car. Reaching the car — or
// the ~12 s cap, or the officer/car becoming unreachable — completes
// into the EXISTING busted flow untouched (same fines, impound and
// respawn in App/store). The hold-B SURRENDER path is separate and
// stays instant/fine-only; this module never touches it.
//
// Honest scope: the officer is a dedicated humanoid rig (navy patrol
// outfit) steered with the same heading/speed walk the peds use —
// there is no IK cuffing and the patrol car is not pinned; if it
// rolls away the cap still completes the arrest on time.
import { G, bark } from "./store";
import { sfx } from "./audio";
import { isBlocked } from "../world";

export const ESCORT = {
  active: false,
  phase: "approach" as "approach" | "walk",
  copIdx: -1,
  /** officer world position / heading (rendered by GameSystems) */
  x: 0, z: 0, heading: 0,
  moving: false,
  /** where Player.tsx should walk the player rig this step */
  playerTx: 0, playerTz: 0,
  t: 0,
  barkStage: 0,
};

const ESCORT_CAP_S = 12;

/** Try to start an escort from the bust that just filled. Returns
 * false when no active patrol car is within reach — the caller then
 * falls back to the instant busted flow, exactly as before. */
export function startEscort(px: number, pz: number): boolean {
  let best = -1, bestD = 34;
  G.cops.forEach((c, i) => {
    if (!c.active) return;
    const d = Math.hypot(c.x - px, c.z - pz);
    if (d < bestD) { bestD = d; best = i; }
  });
  if (best < 0) return false;
  const car = G.cops[best];
  ESCORT.active = true;
  ESCORT.phase = "approach";
  ESCORT.copIdx = best;
  ESCORT.t = 0;
  ESCORT.barkStage = 0;
  ESCORT.moving = false;
  // the officer steps out of the patrol car, on the player's side.
  // Phase 17 audit: that ring point can land inside a wall/crate —
  // walk it toward the player in small steps until it is clear, so
  // the officer never spawns embedded in a blocker (the approach
  // steering would still free them, but the first frames read as a
  // glitch). The player themself is by definition on clear ground.
  const away = Math.atan2(px - car.x, pz - car.z);
  ESCORT.x = car.x + Math.sin(away) * 2.2;
  ESCORT.z = car.z + Math.cos(away) * 2.2;
  for (let k = 0; k < 6 && isBlocked(ESCORT.x, ESCORT.z, 0.4); k++) {
    ESCORT.x += (px - ESCORT.x) * 0.3;
    ESCORT.z += (pz - ESCORT.z) * 0.3;
  }
  ESCORT.heading = away;
  ESCORT.playerTx = px; ESCORT.playerTz = pz;
  bark("Harbour Patrol", "That's far enough. Hands where I can see them — walk with me to the car.");
  return true;
}

function moveOfficer(tx: number, tz: number, speed: number, dt: number): number {
  const dx = tx - ESCORT.x, dz = tz - ESCORT.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.05) { ESCORT.moving = false; return dist; }
  const desired = Math.atan2(dx, dz);
  let turn = desired - ESCORT.heading;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  ESCORT.heading += Math.max(-3.2 * dt, Math.min(3.2 * dt, turn));
  const step = Math.min(dist, speed * dt);
  const nx = ESCORT.x + Math.sin(ESCORT.heading) * step;
  const nz = ESCORT.z + Math.cos(ESCORT.heading) * step;
  // axis-separated collision, the same cheap rule the peds walk with
  if (!isBlocked(nx, ESCORT.z, 0.4)) ESCORT.x = nx;
  if (!isBlocked(ESCORT.x, nz, 0.4)) ESCORT.z = nz;
  ESCORT.moving = step > 0.01;
  return dist;
}

/** Advance the escort one fixed sim step. GameSystems calls this
 * while ESCORT.active; completion lands in the standard busted flow. */
export function stepEscort(dt: number) {
  if (!ESCORT.active) return;
  // ---- Phase 17 audit: EXIT-PATH LEAK. Phase 16 guarded the START
  // (on foot, outdoors, not swimming) but never re-checked state
  // mid-scene. The E-interact chain stays live during the walk, so a
  // player could still slip into a car or through an interior door:
  // Player's escort branch requires !driving, so the rig stopped
  // following the officer, yet the scene kept stepping and the cap
  // eventually fired finishEscort() — a BUSTED landing on a player
  // who was by then driving away or standing in a pocket interior.
  // Any such state change now CANCELS the scene (no arrest): the
  // bust pin releases and the ordinary bust rules resume next step,
  // so a slow player near a cop can still be re-grabbed fairly.
  // G.status covers an arrest/wasting landing from any other path —
  // the escort must never fire a second BUSTED over it. ----
  if (G.driving || G.swimming || G.interior || G.status) { cancelEscort(); return; }
  ESCORT.t += dt;
  const car = G.cops[ESCORT.copIdx];
  const px = G.playerPos.x, pz = G.playerPos.z;
  G.hold = { label: "Under arrest — walking to the patrol car…", progress: Math.min(1, ESCORT.t / ESCORT_CAP_S) };
  // the scene ends on the cap, or if the patrol car is gone
  if (ESCORT.t >= ESCORT_CAP_S || !car || !car.active) { finishEscort(); return; }
  if (ESCORT.phase === "approach") {
    ESCORT.playerTx = px; ESCORT.playerTz = pz; // the player stands, hands up
    const d = moveOfficer(px, pz, 3.4, dt);
    if (d < 1.7) {
      ESCORT.phase = "walk";
      bark("Harbour Patrol", "Good. Now we walk. Nice and easy — no sudden moves.");
    }
  } else {
    if (ESCORT.barkStage === 0 && ESCORT.t > 6) {
      ESCORT.barkStage = 1;
      bark("Harbour Patrol", "Nearly there. Mind the kerb.");
    }
    moveOfficer(car.x, car.z, 2.7, dt);
    // the player walks beside the officer, a half-step off the
    // officer's left shoulder
    const perpX = Math.cos(ESCORT.heading), perpZ = -Math.sin(ESCORT.heading);
    ESCORT.playerTx = ESCORT.x + perpX * 0.95;
    ESCORT.playerTz = ESCORT.z + perpZ * 0.95;
    const dCar = Math.hypot(car.x - ESCORT.x, car.z - ESCORT.z);
    if (dCar < 2.6) finishEscort();
  }
}

/** Complete the arrest — the existing BUSTED flow, unchanged. */
export function finishEscort() {
  if (!ESCORT.active) return;
  ESCORT.active = false;
  ESCORT.moving = false;
  G.hold = null;
  G.status = "busted";
  G.statusTimer = 0;
  sfx.busted();
  bark("Harbour Patrol", "Suspect in custody. Repeat — suspect in custody.");
}

/** Abandon the scene without an arrest (the player was wasted
 * mid-escort — the WASTED flow owns what happens next). */
export function cancelEscort() {
  ESCORT.active = false;
  ESCORT.moving = false;
  if (G.hold?.label.startsWith("Under arrest")) G.hold = null;
}
