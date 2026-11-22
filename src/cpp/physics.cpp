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
