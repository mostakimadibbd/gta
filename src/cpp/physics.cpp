// HARBORFALL CORE (C++17) — the game's decision-logic core: vehicle and
// pedestrian stepping, collision, traffic decisions, police line-of-sight
// sampling, boat buoyancy and race pacing. Compiled to WebAssembly for
// the web build and mirrored exactly by the TypeScript fallback in
// client/src/physics/GamePhysics.ts so the game runs with or without
// WASM. (The browser executes JS/WASM only — this core is where the
// non-presentation logic lives; TypeScript is the shell/glue around it.)
#include <algorithm>
#include <cmath>

namespace {
constexpr double kPi = 3.14159265358979323846;
constexpr double kForwardAcceleration = 18.0;
constexpr double kReverseAcceleration = 8.0;
constexpr double kMaxForwardSpeed = 24.0;
constexpr double kMaxReverseSpeed = 8.0;
constexpr double kRollingFriction = 0.65;
constexpr double kDriftFriction = 5.5;
constexpr double kMaxStep = 0.1;
double clamp(double v, double lo, double hi) { return std::max(lo, std::min(v, hi)); }
double wrap_angle(double a) { return std::remainder(a, 2.0 * kPi); }
}  // namespace

extern "C" {

double distance_squared(double ax, double az, double bx, double bz) {
  const double dx = ax - bx; const double dz = az - bz;
  return dx * dx + dz * dz;
}

void step_vehicle(double x, double z, double heading, double speed,
                  double throttle, double steering, double handbrake,
                  double delta_time, double* output) {
  const double dt = clamp(delta_time, 0.0, kMaxStep);
  const double gas = clamp(throttle, -1.0, 1.0);
  const double steer = clamp(steering, -1.0, 1.0);
  speed += gas * (gas >= 0.0 ? kForwardAcceleration : kReverseAcceleration) * dt;
  const double friction = handbrake > 0.5 ? kDriftFriction : kRollingFriction;
  speed *= std::max(0.0, 1.0 - friction * dt);
  if (gas == 0.0 && std::abs(speed) < 0.12) speed = 0.0;
  speed = clamp(speed, -kMaxReverseSpeed, kMaxForwardSpeed);
  const double speed_factor = clamp(std::abs(speed) / 4.0, 0.18, 1.0);
  const double drift_factor = handbrake > 0.5 ? 0.62 : 1.0;
  heading += steer * 2.2 * speed_factor * drift_factor * dt * (speed < 0.0 ? -1.0 : 1.0);
  heading = wrap_angle(heading);
  x += std::sin(heading) * speed * dt;
  z += std::cos(heading) * speed * dt;
  output[0] = x; output[1] = z; output[2] = heading; output[3] = speed;
}

double collide_aabb(double x, double z, double radius, double box_x,
                    double box_z, double half_w, double half_d) {
  return (std::abs(x - box_x) < half_w + radius &&
          std::abs(z - box_z) < half_d + radius) ? 1.0 : 0.0;
}

void resolve_aabb(double x, double z, double radius, double box_x, double box_z,
                  double half_w, double half_d, double* output) {
  const double dx = x - box_x; const double dz = z - box_z;
  const double pen_x = half_w + radius - std::abs(dx);
  const double pen_z = half_d + radius - std::abs(dz);
  if (pen_x > 0.0 && pen_z > 0.0) {
    if (pen_x < pen_z) x = box_x + (dx >= 0.0 ? half_w + radius : -(half_w + radius));
    else z = box_z + (dz >= 0.0 ? half_d + radius : -(half_d + radius));
  }
  output[0] = x; output[1] = z;
}

// ---------------------------------------------------------------------------
// Phase 4 additions — kept API-stable: everything above is untouched.
// ---------------------------------------------------------------------------

// Vehicle step v2: same arcade core as step_vehicle, plus a lateral-grip
// curve (grip falls off at high speed and collapses under the handbrake)
// and weight-transfer outputs for body presentation:
//   out[4] = body pitch (accel squat is negative, brake dive positive)
//   out[5] = body roll in corners (sign follows steering direction)
//   out[6] = grip factor actually applied to the turn rate (0..~1.05)
void step_vehicle_v2(double x, double z, double heading, double speed,
                     double throttle, double steering, double handbrake,
                     double delta_time, double* output) {
  const double dt = clamp(delta_time, 0.0, kMaxStep);
  const double gas = clamp(throttle, -1.0, 1.0);
  const double steer = clamp(steering, -1.0, 1.0);
  const double prev_speed = speed;
  speed += gas * (gas >= 0.0 ? kForwardAcceleration : kReverseAcceleration) * dt;
  const double friction = handbrake > 0.5 ? kDriftFriction : kRollingFriction;
  speed *= std::max(0.0, 1.0 - friction * dt);
  if (gas == 0.0 && std::abs(speed) < 0.12) speed = 0.0;
  speed = clamp(speed, -kMaxReverseSpeed, kMaxForwardSpeed);
  const double accel = dt > 0.0001 ? (speed - prev_speed) / dt : 0.0;
  // lateral grip curve: full grip at low speed, ~28% falloff at top speed,
  // handbrake breaks the rear loose (drift)
  double grip = clamp(1.12 - std::abs(speed) / 34.0, 0.74, 1.05);
  if (handbrake > 0.5) grip *= 0.58;
  const double speed_factor = clamp(std::abs(speed) / 4.0, 0.18, 1.0);
  heading += steer * 2.2 * speed_factor * grip * dt * (speed < 0.0 ? -1.0 : 1.0);
  heading = wrap_angle(heading);
  x += std::sin(heading) * speed * dt;
  z += std::cos(heading) * speed * dt;
  // weight transfer (presentation): squat under power, dive under braking,
  // roll ∝ steering × speed (less while drifting — the car slides instead)
  const double pitch = clamp(-accel * 0.0028, -0.055, 0.06);
  const double roll = clamp(steer * std::abs(speed) * 0.0042, -0.095, 0.095) *
                      (handbrake > 0.5 ? 0.55 : 1.0) * (speed < 0.0 ? -1.0 : 1.0);
  output[0] = x; output[1] = z; output[2] = heading; output[3] = speed;
  output[4] = pitch; output[5] = roll; output[6] = grip;
}

// Vehicle-vs-vehicle circle collision: positional separation + a normal
// impulse with restitution (equal masses). Velocities are world-space.
//   in:  a(x,z,vx,vz,radius) b(x,z,vx,vz,radius)
//   out: a(x,z,vx,vz) b(x,z,vx,vz) damage (impact severity, ~0..22)
void resolve_vehicle_collision(double ax, double az, double avx, double avz,
                               double ar, double bx, double bz, double bvx,
                               double bvz, double br, double* output) {
  double dx = bx - ax; double dz = bz - az;
  const double min_dist = ar + br;
  double dist = std::sqrt(dx * dx + dz * dz);
  double damage = 0.0;
  if (dist < min_dist) {
    if (dist < 0.0001) { dx = 1.0; dz = 0.0; dist = 1.0; }
    const double nx = dx / dist; const double nz = dz / dist;
    const double push = (min_dist - dist) * 0.5;
    ax -= nx * push; az -= nz * push;
    bx += nx * push; bz += nz * push;
    // relative velocity along the normal; negative = approaching
    const double rvn = (bvx - avx) * nx + (bvz - avz) * nz;
    if (rvn < 0.0) {
      const double impulse = -(1.0 + 0.35) * rvn * 0.5; // restitution 0.35, m=1 each
      avx -= impulse * nx; avz -= impulse * nz;
      bvx += impulse * nx; bvz += impulse * nz;
      damage = clamp(-rvn * 2.1, 0.0, 22.0);
    }
  }
  output[0] = ax; output[1] = az; output[2] = avx; output[3] = avz;
  output[4] = bx; output[5] = bz; output[6] = bvx; output[7] = bvz;
  output[8] = damage;
}

// Swept circle-vs-AABB: earliest contact time t in [0,1] of a circle swept
// from (x0,z0) to (x1,z1) against an AABB expanded by the radius (slab
// method). Returns -1 when the segment never touches the box. Prevents
// sprint-speed tunnelling through thin blockers.
double swept_aabb(double x0, double z0, double x1, double z1, double radius,
                  double box_x, double box_z, double half_w, double half_d) {
  const double minx = box_x - half_w - radius, maxx = box_x + half_w + radius;
  const double minz = box_z - half_d - radius, maxz = box_z + half_d + radius;
  const double dx = x1 - x0, dz = z1 - z0;
  double tmin = 0.0, tmax = 1.0;
  if (std::abs(dx) < 1e-9) { if (x0 < minx || x0 > maxx) return -1.0; }
  else {
    double t1 = (minx - x0) / dx, t2 = (maxx - x0) / dx;
    if (t1 > t2) std::swap(t1, t2);
    tmin = std::max(tmin, t1); tmax = std::min(tmax, t2);
    if (tmin > tmax) return -1.0;
  }
  if (std::abs(dz) < 1e-9) { if (z0 < minz || z0 > maxz) return -1.0; }
  else {
    double t1 = (minz - z0) / dz, t2 = (maxz - z0) / dz;
    if (t1 > t2) std::swap(t1, t2);
    tmin = std::max(tmin, t1); tmax = std::min(tmax, t2);
    if (tmin > tmax) return -1.0;
  }
  return tmin;
}

// Pedestrian separation steering (boids-lite): repulsion force from up to
// three neighbours inside `radius`. Missing neighbours are passed as the
// query point itself (zero offset → no contribution).
//   out: force (x, z), magnitude ~0..2.4
void separation_force(double x, double z,
                      double ax, double az, double bx, double bz,
                      double cx, double cz, double radius, double* output) {
  double fx = 0.0, fz = 0.0;
  const double others[3][2] = {{ax, az}, {bx, bz}, {cx, cz}};
  for (const auto& o : others) {
    const double dx = x - o[0], dz = z - o[1];
    const double d2 = dx * dx + dz * dz;
    if (d2 < 0.0001 || d2 > radius * radius) continue;
    const double d = std::sqrt(d2);
    const double w = (radius - d) / radius; // stronger when closer
    fx += (dx / d) * w * 1.6;
    fz += (dz / d) * w * 1.6;
  }
  output[0] = clamp(fx, -2.4, 2.4);
  output[1] = clamp(fz, -2.4, 2.4);
}

// ---------------------------------------------------------------------------
// Phase 6 Tier B5 additions — kept API-stable: everything above is untouched.
// ---------------------------------------------------------------------------

// Suspension response: spring/damper body-motion model replacing the direct
// pitch/roll targets of step_vehicle_v2 for presentation smoothing.
//   in:  accel, steer, speed, previous pitch/roll and their velocities, dt
//   out: [pitch, roll, pitchVel, rollVel]
void suspension_response(double accel, double steer, double speed,
                         double prev_pitch, double prev_roll,
                         double prev_pitch_vel, double prev_roll_vel,
                         double delta_time, double* output) {
  const double dt = clamp(delta_time, 0.0, 0.1);
  const double target_pitch = clamp(-accel * 0.0028, -0.055, 0.06);
  const double target_roll = clamp(steer * std::fabs(speed) * 0.0042, -0.095, 0.095) *
                             (speed < 0.0 ? -1.0 : 1.0);
  double pitch = prev_pitch;
  double roll = prev_roll;
  double pitch_vel = prev_pitch_vel;
  double roll_vel = prev_roll_vel;
  {
    const double acc = 52.0 * (target_pitch - pitch) - 11.0 * pitch_vel;
    pitch_vel += acc * dt;
    pitch += pitch_vel * dt;
  }
  {
    const double acc = 52.0 * (target_roll - roll) - 11.0 * roll_vel;
    roll_vel += acc * dt;
    roll += roll_vel * dt;
  }
  output[0] = pitch; output[1] = roll; output[2] = pitch_vel; output[3] = roll_vel;
}

// Vehicle-vs-vehicle circle collision v2: everything resolve_vehicle_collision
// does, plus tangential friction applied after the normal impulse.
//   in:  a(x,z,vx,vz,radius) b(x,z,vx,vz,radius)
//   out: a(x,z,vx,vz) b(x,z,vx,vz) damage (impact severity, ~0..22)
void resolve_vehicle_collision_v2(double ax, double az, double avx, double avz,
                                  double ar, double bx, double bz, double bvx,
                                  double bvz, double br, double* output) {
  double dx = bx - ax; double dz = bz - az;
  const double min_dist = ar + br;
  double dist = std::sqrt(dx * dx + dz * dz);
  double damage = 0.0;
  if (dist < min_dist) {
    if (dist < 0.0001) { dx = 1.0; dz = 0.0; dist = 1.0; }
    const double nx = dx / dist; const double nz = dz / dist;
    const double push = (min_dist - dist) * 0.5;
    ax -= nx * push; az -= nz * push;
    bx += nx * push; bz += nz * push;
    // relative velocity along the normal; negative = approaching
    const double rvn = (bvx - avx) * nx + (bvz - avz) * nz;
    double impulse = 0.0;
    if (rvn < 0.0) {
      impulse = -(1.0 + 0.35) * rvn * 0.5; // restitution 0.35, m=1 each
      avx -= impulse * nx; avz -= impulse * nz;
      bvx += impulse * nx; bvz += impulse * nz;
      damage = clamp(-rvn * 2.1, 0.0, 22.0);
    }
    // tangential friction, using the relative velocity after the normal impulse
    if (rvn < 0.0) {
      const double tx = -nz; const double tz = nx;
      const double rvx = bvx - avx; const double rvz = bvz - avz;
      const double rvt = rvx * tx + rvz * tz;
      const double jt = clamp(-rvt * 0.5, -0.45 * impulse, 0.45 * impulse);
      avx -= jt * tx; avz -= jt * tz;
      bvx += jt * tx; bvz += jt * tz;
    }
  }
  output[0] = ax; output[1] = az; output[2] = avx; output[3] = avz;
  output[4] = bx; output[5] = bz; output[6] = bvx; output[7] = bvz;
  output[8] = damage;
}

void step_pedestrian(double x, double z, double heading, double speed,
                     double target_x, double target_z, double threat_x,
                     double threat_z, double flee, double walk_speed,
                     double delta_time, double* output) {
  const double dt = clamp(delta_time, 0.0, kMaxStep);
  double goal_x = target_x; double goal_z = target_z;
  double desired_speed = clamp(walk_speed, 0.0, 3.0);
  if (flee > 0.5) {
    const double dx = x - threat_x; const double dz = z - threat_z;
    const double dist = std::sqrt(dx * dx + dz * dz);
    if (dist < 14.0 && dist > 0.0001) {
      goal_x = x + (dx / dist) * 10.0; goal_z = z + (dz / dist) * 10.0;
      desired_speed = 5.2;
    }
  }
  const double gx = goal_x - x; const double gz = goal_z - z;
  const double goal_dist = std::sqrt(gx * gx + gz * gz);
  if (goal_dist < 0.4) desired_speed = 0.0;
  else {
    const double desired_heading = std::atan2(gx, gz);
    double turn = wrap_angle(desired_heading - heading);
    heading = wrap_angle(heading + clamp(turn, -3.2 * dt, 3.2 * dt));
  }
  speed += clamp(desired_speed - speed, -6.0 * dt, 6.0 * dt);
  x += std::sin(heading) * speed * dt;
  z += std::cos(heading) * speed * dt;
  output[0] = x; output[1] = z; output[2] = heading; output[3] = speed;
}

// ---------------------------------------------------------------------------
// Phase 8 — Harborfall Core decision logic (TS mirrors in GamePhysics.ts).
// These functions own DECISIONS the game used to inline in TypeScript:
// traffic stop/go, ped steering+separation, wanted LOS sampling, boat
// buoyancy and race-opponent pacing. Pure functions of their inputs.
// ---------------------------------------------------------------------------

// (a) Traffic intersection decision: given the car's speed, its cruise
// speed, the distance to a red/amber stop line (huge = none), the light
// state (0 green, 1 amber, 2 red) and the gap to the car ahead in the
// same lane (huge = none), produce the target speed + a braking flag.
//   out: [targetSpeed, braking(0/1)]
void traffic_decision(double speed, double cruise, double dist_stop,
                      double light_state, double queue_gap, double* output) {
  double target = cruise;
  double braking = 0.0;
  if (light_state >= 1.0 && dist_stop < 16.0) {
    // roll up to the line and stop ON it, not at it from 16u out
    target = std::min(target, clamp((dist_stop - 1.1) * 0.6, 0.0, cruise));
    if (dist_stop < 9.0) braking = 1.0;
  }
  if (queue_gap < 8.5) {
    // graded queueing: ease off as the gap closes, full stop under 2.4u
    target = std::min(target, clamp((queue_gap - 2.4) * 1.15, 0.0, cruise));
    if (queue_gap < 5.0) braking = 1.0;
  }
  if (target < speed - 0.5) braking = 1.0;
  output[0] = target; output[1] = braking;
}

// (b) Pedestrian step v2: step_pedestrian's destination steering PLUS
// separation from up to three neighbours folded into the same step
// (replaces the old two-call TS pattern; identical flee/arrive rules).
//   in:  state, target, threat, flee, walk_speed, 3 neighbours, sep radius, dt
//   out: [x, z, heading, speed]
void step_pedestrian_v2(double x, double z, double heading, double speed,
                        double target_x, double target_z, double threat_x,
                        double threat_z, double flee, double walk_speed,
                        double n1x, double n1z, double n2x, double n2z,
                        double n3x, double n3z, double sep_radius,
                        double delta_time, double* output) {
  double base[4] = {0, 0, 0, 0};
  step_pedestrian(x, z, heading, speed, target_x, target_z, threat_x,
                  threat_z, flee, walk_speed, delta_time, base);
  double sep[2] = {0, 0};
  separation_force(base[0], base[1], n1x, n1z, n2x, n2z, n3x, n3z,
                   sep_radius, sep);
  const double dt = clamp(delta_time, 0.0, kMaxStep);
  output[0] = base[0] + sep[0] * dt * 0.85;
  output[1] = base[1] + sep[1] * dt * 0.85;
  output[2] = base[2]; output[3] = base[3];
}

// (c) Wanted LOS sampling: walk N samples along the observer→target
// segment and return the fraction NOT inside any of up to 4 AABB
// blockers (1.0 = perfectly clear sight, 0 = fully walled off). The
// caller decides the threshold (Harborfall police: > 0.5 = seen).
double los_sampled(double ox, double oz, double tx, double tz,
                   double b1x, double b1z, double b1w, double b1d,
                   double b2x, double b2z, double b2w, double b2d,
                   double b3x, double b3z, double b3w, double b3d,
                   double b4x, double b4z, double b4w, double b4d,
                   double samples) {
  const int n = (int)clamp(samples, 4.0, 32.0);
  const double bx[4] = {b1x, b2x, b3x, b4x};
  const double bz[4] = {b1z, b2z, b3z, b4z};
  const double bw[4] = {b1w, b2w, b3w, b4w};
  const double bd[4] = {b1d, b2d, b3d, b4d};
  int clear = 0;
  for (int i = 1; i < n; ++i) {
    const double f = (double)i / (double)n;
    const double px = ox + (tx - ox) * f;
    const double pz = oz + (tz - oz) * f;
    bool blocked = false;
    for (int b = 0; b < 4; ++b) {
      if (bw[b] <= 0.0) continue;
      if (std::fabs(px - bx[b]) < bw[b] && std::fabs(pz - bz[b]) < bd[b]) { blocked = true; break; }
    }
    if (!blocked) ++clear;
  }
  return (double)clear / (double)(n - 1);
}

// (d) Boat buoyancy: from the wave phase (advanced by the caller),
// speed and wave amplitude, produce the hull's bob height, pitch, roll.
// Motion calms as speed rises (planing), exactly like the harbour chop.
//   out: [bobY, pitch, roll]
void boat_buoyancy(double phase, double speed, double wave_amp, double* output) {
  const double plane = clamp(std::fabs(speed) / 14.5, 0.0, 1.0);
  const double calm = 1.0 - plane * 0.62;
  output[0] = std::sin(phase) * wave_amp * calm;
  output[1] = std::sin(phase * 0.8 + 1.3) * 0.021 * calm - plane * 0.012;
  output[2] = std::sin(phase * 0.63 + 0.4) * 0.03 * calm;
}

// (e) Race opponent pacing (rubber-band): the opponent's target speed
// from the progress gap to the player. Behind → up to +rubber faster;
// ahead → up to −rubber slower, so a race stays a race without ever
// teleporting or hard-capping the opponent.
double race_pace(double player_dist, double opp_dist, double base_top, double rubber) {
  const double gap = player_dist - opp_dist; // +ve: player ahead
  return base_top + clamp(gap * 0.014, -rubber, rubber);
}

// ---------------------------------------------------------------------------
// Phase 10 — realism + physics round (TS mirrors in GamePhysics.ts).
// Surface grip, per-wheel suspension/body dynamics, ballistic debris
// and swimmer buoyancy/drag join the core. Everything above is untouched.
// ---------------------------------------------------------------------------

// (a) Vehicle step v3: step_vehicle_v2 PLUS a surface-grip multiplier
// (1.0 dry asphalt, 0.78 wet, 0.68 rain-heavy, 0.72 dirt, 0.55 sand —
// the caller folds weather into the same number) and a WHEELSPIN output.
//   grip curve × surface grip scales the turn rate AND the launch:
//   demanded drive force beyond the contact patch's capacity becomes
//   slip (out[7], 0..1) instead of motion — the caller turns slip into
//   tyre smoke + sound. Under the handbrake a low-grip surface breaks
//   the rear looser still, so wet slides run WIDER than dry ones.
//   out: [x, z, heading, speed, pitch, roll, grip, slip]
void step_vehicle_v3(double x, double z, double heading, double speed,
                     double throttle, double steering, double handbrake,
                     double surface_grip, double delta_time, double* output) {
  const double dt = clamp(delta_time, 0.0, kMaxStep);
  const double gas = clamp(throttle, -1.0, 1.0);
  const double steer = clamp(steering, -1.0, 1.0);
  const double sg = clamp(surface_grip, 0.3, 1.1);
  const double prev_speed = speed;
  // contact-patch capacity: the v2 speed-falloff curve × the surface
  double grip = clamp(1.12 - std::abs(speed) / 34.0, 0.74, 1.05) * sg;
  // wheelspin: forward drive force vs capacity (reverse is gentler)
  double slip = 0.0;
  if (gas > 0.05) {
    const double demand = gas * kForwardAcceleration;
    const double capacity = 15.5 * grip;
    slip = clamp((demand - capacity) / 9.0, 0.0, 1.0);
    if (std::abs(speed) > 9.0) slip *= 0.25; // rolling tyres bite again
  }
  // low-grip launches also just accelerate less (sand bogs down)
  const double accel_scale = (0.5 + 0.5 * sg) * (1.0 - 0.45 * slip);
  speed += gas * (gas >= 0.0 ? kForwardAcceleration : kReverseAcceleration) *
           (gas >= 0.0 ? accel_scale : 1.0) * dt;
  const double friction = handbrake > 0.5 ? kDriftFriction : kRollingFriction;
  speed *= std::max(0.0, 1.0 - friction * dt);
  if (gas == 0.0 && std::abs(speed) < 0.12) speed = 0.0;
  speed = clamp(speed, -kMaxReverseSpeed, kMaxForwardSpeed);
  const double accel = dt > 0.0001 ? (speed - prev_speed) / dt : 0.0;
  double turn_grip = grip;
  if (handbrake > 0.5) turn_grip *= 0.58 * (0.72 + 0.28 * sg); // wet slides wider
  const double speed_factor = clamp(std::abs(speed) / 4.0, 0.18, 1.0);
  heading += steer * 2.2 * speed_factor * turn_grip * dt * (speed < 0.0 ? -1.0 : 1.0);
  heading = wrap_angle(heading);
  x += std::sin(heading) * speed * dt;
  z += std::cos(heading) * speed * dt;
  const double pitch = clamp(-accel * 0.0028, -0.055, 0.06);
  const double roll = clamp(steer * std::abs(speed) * 0.0042, -0.095, 0.095) *
                      (handbrake > 0.5 ? 0.55 : 1.0) * (speed < 0.0 ? -1.0 : 1.0);
  output[0] = x; output[1] = z; output[2] = heading; output[3] = speed;
  output[4] = pitch; output[5] = roll; output[6] = grip; output[7] = slip;
}

// (b) Vehicle body: per-wheel suspension + spring/damper body motion.
// The caller samples the ground height under each wheel (relative to
// the body's ground reference, + = ground rises toward the wheel) in
// CarBody creation order [0]=(-x,front) [1]=(+x,front) [2]=(-x,rear)
// [3]=(+x,rear). Each wheel's compression target follows its corner of
// ground; body pitch/roll/heave spring toward the terrain attitude
// PLUS the weight-transfer targets (accel squat / brake dive / corner
// lean) with the same spring constants as suspension_response, so a
// landing or a ramp crest moves the whole body, not just the wheels.
//   in:  h0..h3, accel, steer, speed, prev[pitch, roll, heave,
//        pitchVel, rollVel, heaveVel], dt
//   out: [pitch, roll, heave, pitchVel, rollVel, heaveVel,
//         comp0, comp1, comp2, comp3]   (comp: 0.45 = nominal ride)
void vehicle_body(double h0, double h1, double h2, double h3,
                  double accel, double steer, double speed,
                  double prev_pitch, double prev_roll, double prev_heave,
                  double prev_pitch_vel, double prev_roll_vel,
                  double prev_heave_vel, double delta_time, double* output) {
  const double dt = clamp(delta_time, 0.0, kMaxStep);
  const double h[4] = {h0, h1, h2, h3};
  double comp[4];
  for (int i = 0; i < 4; ++i) comp[i] = clamp(0.45 + h[i] * 1.5, 0.02, 0.98);
  const double front = (h0 + h1) * 0.5, rear = (h2 + h3) * 0.5;
  const double left = (h1 + h3) * 0.5, right = (h0 + h2) * 0.5; // +x side = indices 1,3
  const double avg = (front + rear) * 0.5;
  // terrain attitude + weight transfer (signs match step_vehicle_v2:
  // positive pitch = nose-down dive, roll follows the steering sign)
  double target_pitch = clamp((rear - front) * 0.16, -0.14, 0.14) +
                        clamp(-accel * 0.0028, -0.055, 0.06);
  double target_roll = clamp((left - right) * 0.16, -0.14, 0.14) +
                       clamp(steer * std::fabs(speed) * 0.0042, -0.095, 0.095) *
                           (speed < 0.0 ? -1.0 : 1.0);
  const double target_heave = clamp(avg * 0.55, -0.13, 0.2);
  double pitch = prev_pitch, roll = prev_roll, heave = prev_heave;
  double pitch_vel = prev_pitch_vel, roll_vel = prev_roll_vel, heave_vel = prev_heave_vel;
  {
    const double acc = 52.0 * (target_pitch - pitch) - 11.0 * pitch_vel;
    pitch_vel += acc * dt; pitch += pitch_vel * dt;
  }
  {
    const double acc = 52.0 * (target_roll - roll) - 11.0 * roll_vel;
    roll_vel += acc * dt; roll += roll_vel * dt;
  }
  {
    const double acc = 38.0 * (target_heave - heave) - 9.0 * heave_vel;
    heave_vel += acc * dt; heave += heave_vel * dt;
  }
  output[0] = pitch; output[1] = roll; output[2] = heave;
  output[3] = pitch_vel; output[4] = roll_vel; output[5] = heave_vel;
  output[6] = comp[0]; output[7] = comp[1]; output[8] = comp[2]; output[9] = comp[3];
}

// (c) Debris step: one pooled shard under gravity with a ground bounce.
// Gravity −18 matches the game's established debris fall. On contact
// the vertical velocity reflects × restitution and the horizontal
// velocity keeps `ground_keep` of itself (friction); a resting shard
// (|vy| < 0.8 after a bounce) settles flat instead of micro-bouncing.
//   in:  x, y, z, vx, vy, vz, ground_y, restitution, ground_keep, dt
//   out: [x, y, z, vx, vy, vz]
void debris_step(double x, double y, double z, double vx, double vy, double vz,
                 double ground_y, double restitution, double ground_keep,
                 double delta_time, double* output) {
  const double dt = clamp(delta_time, 0.0, kMaxStep);
  vy -= 18.0 * dt;
  vx *= std::max(0.0, 1.0 - 0.12 * dt); // light air drag
  vz *= std::max(0.0, 1.0 - 0.12 * dt);
  x += vx * dt; y += vy * dt; z += vz * dt;
  if (y < ground_y) {
    y = ground_y;
    vy = -vy * clamp(restitution, 0.0, 0.9);
    if (std::fabs(vy) < 0.8) vy = 0.0;
    vx *= clamp(ground_keep, 0.0, 1.0);
    vz *= clamp(ground_keep, 0.0, 1.0);
  }
  output[0] = x; output[1] = y; output[2] = z;
  output[3] = vx; output[4] = vy; output[5] = vz;
}

// (d) Swim step: swimmer buoyancy + drag. Speed relaxes toward the
// stroke's target with a water-drag time constant (no instant starts
// or stops in water), the stroke cycle surges the effective speed
// ±14%, and the body bobs on the stroke — calmer at a glide.
//   in:  phase (stroke phase, rad), target_speed, prev_speed, dt
//   out: [speed, surge, bobY]
void swim_step(double phase, double target_speed, double prev_speed,
               double delta_time, double* output) {
  const double dt = clamp(delta_time, 0.0, kMaxStep);
  const double k = 1.0 - std::exp(-2.4 * dt); // drag relaxation
  const double speed = prev_speed + (clamp(target_speed, 0.0, 4.0) - prev_speed) * k;
  const double surge = 0.86 + 0.14 * std::sin(phase * 2.0);
  const double effort = clamp(std::fabs(speed) / 2.4, 0.0, 1.0);
  const double bob = std::sin(phase) * 0.055 * (0.35 + 0.65 * effort);
  output[0] = speed; output[1] = surge; output[2] = bob;
}

// (e) Ragdoll step (Phase 14): a VERLET point-mass skeleton — 13
// points (pelvis, chest, head, shoulders/elbows/hands ×2, knees/feet
// ×2) integrated under gravity (−18, the game's debris gravity),
// distance-constrained (18 bones/braces, 3 relaxation passes), and
// collided against a single ground height with per-point radii and
// ground friction. The caller seeds pos/prev from the rig's standing
// pose (prev offset backwards = impact velocity) and drives the
// humanoid rig's bones from the solved points. pos/prev are 39
// doubles each (13 × xyz), updated IN PLACE — the WASM binding copies
// them through two heap buffers, the TS mirror mutates plain arrays;
// the arithmetic below is the single source for both.
//   in/out: pos[39], prev[39]; in: ground_y, dt
void ragdoll_step(double* pos, double* prev, double ground_y, double delta_time) {
  const double dt = clamp(delta_time, 0.0, kMaxStep);
  if (dt <= 0.0) return;
  const double damp = 0.985; // velocity keep per step (tuned at 60 Hz)
  const double g = -18.0 * dt * dt;
  for (int i = 0; i < 13; ++i) {
    double* p = pos + i * 3;
    double* q = prev + i * 3;
    const double vx = (p[0] - q[0]) * damp;
    const double vy = (p[1] - q[1]) * damp;
    const double vz = (p[2] - q[2]) * damp;
    q[0] = p[0]; q[1] = p[1]; q[2] = p[2];
    p[0] += vx; p[1] += vy + g; p[2] += vz;
  }
  // bones: (a, b, rest length) — pelvis 0, chest 1, head 2,
  // lShoulder 3, lElbow 4, lHand 5, rShoulder 6, rElbow 7, rHand 8,
  // lKnee 9, lFoot 10, rKnee 11, rFoot 12
  static const int kA[18] = {0, 1, 3, 3, 4, 6, 7, 1, 1, 0, 0, 0, 0, 9, 11, 9, 2, 2};
  static const int kB[18] = {1, 2, 6, 4, 5, 7, 8, 3, 6, 3, 6, 9, 11, 10, 12, 11, 3, 6};
  static const double kRest[18] = {0.50, 0.29, 0.524, 0.37, 0.37, 0.37, 0.37, 0.267, 0.267,
                                   0.61, 0.61, 0.50, 0.50, 0.44, 0.44, 0.192, 0.355, 0.355};
  static const double kRadius[13] = {0.14, 0.14, 0.15, 0.09, 0.06, 0.05, 0.09,
                                     0.06, 0.05, 0.06, 0.05, 0.06, 0.05};
  for (int iter = 0; iter < 3; ++iter) {
    for (int c = 0; c < 18; ++c) {
      double* a = pos + kA[c] * 3;
      double* b = pos + kB[c] * 3;
      const double dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const double d = std::sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1e-9) continue;
      const double diff = (d - kRest[c]) / d * 0.5;
      a[0] += dx * diff; a[1] += dy * diff; a[2] += dz * diff;
      b[0] -= dx * diff; b[1] -= dy * diff; b[2] -= dz * diff;
    }
    // ground: clamp each point to its radius over the ground plane;
    // contact kills the vertical velocity and halves the horizontal
    // (friction) by pulling prev toward pos
    for (int i = 0; i < 13; ++i) {
      double* p = pos + i * 3;
      double* q = prev + i * 3;
      const double floor_y = ground_y + kRadius[i];
      if (p[1] < floor_y) {
        p[1] = floor_y;
        q[1] = p[1];
        q[0] = p[0] - (p[0] - q[0]) * 0.5;
        q[2] = p[2] - (p[2] - q[2]) * 0.5;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 25 additions — spawn/restore depenetration core. Kept
// API-stable: everything above is untouched.
// ---------------------------------------------------------------------------

// Penetration depth of a circle (car centre + body radius) into an
// AABB: 0 when clear, else the SMALLEST axis penetration — exactly
// the distance resolve_overlap will push. Mirrors collide_aabb's test.
double building_overlap(double x, double z, double radius, double box_x,
                        double box_z, double half_w, double half_d) {
  const double pen_x = half_w + radius - std::abs(x - box_x);
  const double pen_z = half_d + radius - std::abs(z - box_z);
  if (pen_x <= 0.0 || pen_z <= 0.0) return 0.0;
  return pen_x < pen_z ? pen_x : pen_z;
}

// Push a circle out of an AABB along the smallest penetration axis
// (resolve_aabb's rule) and report the push distance in out[2] — 0
// when there was nothing to resolve. game/depenetrate.ts iterates
// this over the blockersNear() boxes at spawn/restore time.
void resolve_overlap(double x, double z, double radius, double box_x, double box_z,
                     double half_w, double half_d, double* output) {
  const double depth = building_overlap(x, z, radius, box_x, box_z, half_w, half_d);
  if (depth > 0.0) {
    double resolved[2];
    resolve_aabb(x, z, radius, box_x, box_z, half_w, half_d, resolved);
    output[0] = resolved[0]; output[1] = resolved[1]; output[2] = depth;
  } else {
    output[0] = x; output[1] = z; output[2] = 0.0;
  }
}

}  // extern "C"
