// Harborfall — Phase 14 VERLET RAGDOLL: state, seeding and the
// points→rig mapping for the C++ core's ragdoll_step (exact TS mirror
// in physics/GamePhysics.ts). The solver owns 13 points; this module
// seeds them from the humanoid rig's standing pose, steps them inside
// the fixed sim step, and poses the rig's bones from the solved
// points while a ped (or the WASTED player) is down.
//
// POINT LAYOUT (must match physics.cpp): 0 pelvis · 1 chest · 2 head
// · 3/4/5 left shoulder/elbow/hand · 6/7/8 right shoulder/elbow/hand
// · 9/10 left knee/foot · 11/12 right knee/foot.
//
// RIG MAPPING (documented approximation): points are expressed in the
// body's heading frame (origin at the pelvis point). The torso's
// pitch/roll come from the pelvis→chest axis; the head and limbs use
// their segment directions with the PARENT bone's angles subtracted
// (arm angles are computed in body space, then the torso's pitch/roll
// is subtracted — Euler composition is not strictly additive, so this
// cancels the dominant error, the torso pitch when lying flat, rather
// than solving full IK). Feet are kept near ground-parallel by
// counter-rotating the ankle against thigh+shin. Elbow/knee bends are
// clamped to the anatomical direction. The pelvis MESH is placed on
// the pelvis point by offsetting rig.group.y (the mesh sits +0.95
// over the group origin in the standing rig).
import { fallbackPhysics, type PhysicsEngine } from "../physics/GamePhysics";
import type { HumanoidRig } from "../humanoid";

export interface RagdollState {
  pos: number[];   // 39 — world-space points
  prev: number[];  // 39 — previous points (pos − prev = velocity/step)
  heading: number; // body facing the skeleton was seeded with
  groundY: number; // terrain height under the pelvis (refreshed per step)
  blend: number;   // 0 = full ragdoll; 1 = fully back on the rig (get-up)
  lastTt: number;  // last render timestamp the blend advanced at
}

/** Standing pose in body-local space — the humanoid.ts pivot layout:
 * pelvis mesh y .95, torso pivot 1.03 (chest point rides +.42 over
 * it), head group 1.56 (+.18 to the skull centre), shoulders at
 * torso-local (±.262, +.47), elbows −.37, hands −.74, hips
 * (±.096, .92), knees −.46, feet −.90. */
const LOCAL: number[] = [
  0, 0.95, 0, // pelvis
  0, 1.45, 0, // chest
  0, 1.74, 0, // head
  -0.262, 1.50, 0, -0.262, 1.13, 0, -0.262, 0.76, 0, // left arm
  0.262, 1.50, 0, 0.262, 1.13, 0, 0.262, 0.76, 0, // right arm
  -0.096, 0.46, 0, -0.096, 0.02, 0.02, // left leg
  0.096, 0.46, 0, 0.096, 0.02, 0.02, // right leg
];

/** Seed a ragdoll at (x, z) facing `heading` on terrain `groundY`,
 * launched with velocity (vx, vy, vz) — the impact's momentum. The
 * caller passes the CURRENT sim step so prev = pos − v·dt encodes
 * exactly that velocity in the verlet integrator. */
export function seedRagdoll(x: number, z: number, heading: number, groundY: number,
  vx: number, vy: number, vz: number, dt: number): RagdollState {
  const pos = new Array<number>(39);
  const prev = new Array<number>(39);
  const c = Math.cos(heading), s = Math.sin(heading);
  for (let i = 0; i < 13; i++) {
    const lx = LOCAL[i * 3], ly = LOCAL[i * 3 + 1], lz = LOCAL[i * 3 + 2];
    const wx = x + lx * c + lz * s;
    const wz = z - lx * s + lz * c;
    pos[i * 3] = wx; pos[i * 3 + 1] = groundY + ly; pos[i * 3 + 2] = wz;
    prev[i * 3] = wx - vx * dt; prev[i * 3 + 1] = groundY + ly - vy * dt; prev[i * 3 + 2] = wz - vz * dt;
  }
  return { pos, prev, heading, groundY, blend: 0, lastTt: -1 };
}

/** One fixed-step solve (the caller's accumulator owns the rate). */
export function stepRagdoll(st: RagdollState, groundY: number, dt: number, engine: PhysicsEngine = fallbackPhysics) {
  st.groundY = groundY;
  engine.ragdollStep(st.pos, st.prev, groundY, dt);
}

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Segment direction → the rig's X/Z swing angles for a bone whose
 * rest direction is −Y (arms + legs): rotation.x swings the tip
 * forward/back, rotation.z sideways (see humanoid.ts conventions). */
function segAngles(dx: number, dy: number, dz: number): [number, number] {
  const len = Math.hypot(dx, dy, dz) || 1;
  return [Math.atan2(-dz, -dy), Math.asin(clampN(dx / len, -1, 1))];
}

/**
 * Pose `rig` from the solved points. `weight` 1 = full ragdoll;
 * during get-up the caller first runs animateHumanoid (standing pose)
 * and then calls this with weight 1→0 so the bones lerp back to the
 * rig. `groundY` is the terrain height under the pelvis (the outer
 * group is expected to sit at that height, rotation.y = st.heading,
 * rotation.x/z = 0 — the caller owns the outer transform).
 */
export function poseRigFromRagdoll(rig: HumanoidRig, st: RagdollState, weight: number, groundY: number) {
  const p = st.pos;
  const px = p[0], py = p[1], pz = p[2];
  const c = Math.cos(st.heading), s = Math.sin(st.heading);
  // world → heading-local (origin at the pelvis point)
  const L = (i: number): [number, number, number] => {
    const dx = p[i * 3] - px, dy = p[i * 3 + 1] - py, dz = p[i * 3 + 2] - pz;
    return [dx * c - dz * s, dy, dx * s + dz * c];
  };
  const chest = L(1), head = L(2);
  // ---- torso from the pelvis→chest axis ----
  const torsoX = Math.atan2(chest[2], chest[1]);
  const torsoZ = Math.atan2(-chest[0], chest[1]);
  // ---- head relative to the torso ----
  const hb = [head[0] - chest[0], head[1] - chest[1], head[2] - chest[2]];
  const headX = clampN(Math.atan2(hb[2], hb[1]) - torsoX, -0.95, 0.95);
  const headZ = clampN(Math.atan2(-hb[0], hb[1]) - torsoZ, -0.9, 0.9);
  // ---- arms: segment angles in body space minus the torso's ----
  const armPose = (sh: number, el: number, ha: number) => {
    const sP = L(sh), eP = L(el), hP = L(ha);
    const [ax, az] = segAngles(eP[0] - sP[0], eP[1] - sP[1], eP[2] - sP[2]);
    const [fx, fz] = segAngles(hP[0] - eP[0], hP[1] - eP[1], hP[2] - eP[2]);
    return {
      armX: ax - torsoX, armZ: az - torsoZ,
      foreX: clampN(fx - ax, -2.4, 0.3), foreZ: clampN(fz - az, -1.2, 1.2),
    };
  };
  const la = armPose(3, 4, 5), ra = armPose(6, 7, 8);
  // ---- legs: thigh pivots ride the pelvis point at (±.096, −.03) ----
  const legPose = (side: number, knee: number, foot: number) => {
    const kP = L(knee), fP = L(foot);
    const hx = side * 0.096, hy = -0.03;
    const [tx, tz] = segAngles(kP[0] - hx, kP[1] - hy, kP[2]);
    const [sx, sz] = segAngles(fP[0] - kP[0], fP[1] - kP[1], fP[2] - kP[2]);
    return {
      thighX: tx, thighZ: tz,
      shinX: clampN(sx - tx, -0.2, 2.4), shinZ: clampN(sz - tz, -0.8, 0.8),
    };
  };
  const ll = legPose(-1, 9, 10), rl = legPose(1, 11, 12);

  const w = clampN(weight, 0, 1);
  const mix = (cur: number, target: number) => lerp(cur, target, w);
  rig.torso.rotation.x = mix(rig.torso.rotation.x, torsoX);
  rig.torso.rotation.z = mix(rig.torso.rotation.z, torsoZ);
  rig.torso.rotation.y = mix(rig.torso.rotation.y, 0);
  rig.head.rotation.x = mix(rig.head.rotation.x, headX);
  rig.head.rotation.z = mix(rig.head.rotation.z, headZ);
  rig.lArm.rotation.x = mix(rig.lArm.rotation.x, la.armX);
  rig.lArm.rotation.z = mix(rig.lArm.rotation.z, la.armZ);
  rig.lFore.rotation.x = mix(rig.lFore.rotation.x, la.foreX);
  rig.lFore.rotation.z = mix(rig.lFore.rotation.z, la.foreZ);
  rig.rArm.rotation.x = mix(rig.rArm.rotation.x, ra.armX);
  rig.rArm.rotation.z = mix(rig.rArm.rotation.z, ra.armZ);
  rig.rFore.rotation.x = mix(rig.rFore.rotation.x, ra.foreX);
  rig.rFore.rotation.z = mix(rig.rFore.rotation.z, ra.foreZ);
  rig.lThigh.rotation.x = mix(rig.lThigh.rotation.x, ll.thighX);
  rig.lThigh.rotation.z = mix(rig.lThigh.rotation.z, ll.thighZ);
  rig.lShin.rotation.x = mix(rig.lShin.rotation.x, ll.shinX);
  rig.lShin.rotation.z = mix(rig.lShin.rotation.z, ll.shinZ);
  rig.rThigh.rotation.x = mix(rig.rThigh.rotation.x, rl.thighX);
  rig.rThigh.rotation.z = mix(rig.rThigh.rotation.z, rl.thighZ);
  rig.rShin.rotation.x = mix(rig.rShin.rotation.x, rl.shinX);
  rig.rShin.rotation.z = mix(rig.rShin.rotation.z, rl.shinZ);
  // ankles counter-rotate so the soles stay near ground-parallel
  rig.lFoot.rotation.x = mix(rig.lFoot.rotation.x, -(ll.thighX + ll.shinX) * 0.85);
  rig.rFoot.rotation.x = mix(rig.rFoot.rotation.x, -(rl.thighX + rl.shinX) * 0.85);
  // the pelvis mesh rides the pelvis point (+0.95 over the group origin)
  rig.group.position.y = mix(rig.group.position.y, (py - groundY) - 0.95);
  rig.group.position.x = mix(rig.group.position.x, 0);
  rig.group.position.z = mix(rig.group.position.z, 0);
}
