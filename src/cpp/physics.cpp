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

double clamp(double value, double low, double high) {
  return std::max(low, std::min(value, high));
}
}  // namespace

extern "C" {

double distance_squared(double ax, double az, double bx, double bz) {
  const double dx = ax - bx;
  const double dz = az - bz;
  return dx * dx + dz * dz;
}

void step_vehicle(double x, double z, double heading, double speed,
                  double throttle, double steering, double handbrake,
                  double delta_time, double* output) {
  const double dt = clamp(delta_time, 0.0, kMaxStep);
  const double gas = clamp(throttle, -1.0, 1.0);
  const double steer = clamp(steering, -1.0, 1.0);

  speed += gas * (gas >= 0.0 ? kForwardAcceleration : kReverseAcceleration) * dt;
  speed *= std::max(0.0, 1.0 -
                                (handbrake > 0.5 ? kDriftFriction
                                                : kRollingFriction) *
                                    dt);
  speed = clamp(speed, -kMaxReverseSpeed, kMaxForwardSpeed);

  const double speed_factor = clamp(std::abs(speed) / 4.0, 0.18, 1.0);
  const double drift_factor = handbrake > 0.5 ? 0.62 : 1.0;
  heading += steer * 2.2 * speed_factor * drift_factor * dt *
             (speed < 0.0 ? -1.0 : 1.0);
  heading = std::remainder(heading, 2.0 * kPi);

  x += std::sin(heading) * speed * dt;
  z += std::cos(heading) * speed * dt;

  output[0] = x;
  output[1] = z;
  output[2] = heading;
  output[3] = speed;
}

}  // extern "C"
