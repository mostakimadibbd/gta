// Harborfall physics core (C++17) — compiled to WebAssembly for the web build
// and mirrored exactly by the TypeScript fallback in
// client/src/physics/GamePhysics.ts so the game runs with or without WASM.
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

}  // extern "C"
