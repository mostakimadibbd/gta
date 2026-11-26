/**
 * Phase 40 — the DRIVEN bike's presentation pose, shared between
 * Vehicle (writer: the step's wheelie/hop state machines + the mesh
 * sync's lean) and Player (reader: the rider rig leans and pitches
 * with the machine). One mutable object, no React state — it is
 * written and read inside frame loops at 60 Hz.
 *
 * Everything here is PRESENTATION ONLY. The wheelie adds no speed
 * anywhere (its only effect on state is the loop-out, which COSTS
 * speed), the bunny hop never touches car.state (the bicycle's
 * blocker and water checks still stop it mid-hop — the hop clears
 * nothing), and the lean is a mesh/rig roll. Courier drop
 * detection reads car.state positions only, so it is untouched by
 * construction.
 */
export const BIKE_POSE = {
  /** Signed roll (rad) of the driven bike, ∝ steer × speed. */
  lean: 0,
  /** Wheelie amount 0..1 (display value; exceeds 1 only in the loop-out overshoot). */
  wheelie: 0,
  /** Bunny-hop presentation height (u) of the driven bicycle. */
  hopY: 0,
};
