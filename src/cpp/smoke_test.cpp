// Harborfall physics smoke test — exercises the C++ core directly.
#include <cmath>
#include <cstdio>

extern "C" {
void step_vehicle(double x, double z, double heading, double speed,
                  double throttle, double steering, double handbrake,
                  double delta_time, double* output);
void step_vehicle_v2(double x, double z, double heading, double speed,
                     double throttle, double steering, double handbrake,
                     double delta_time, double* output);
void resolve_vehicle_collision(double ax, double az, double avx, double avz,
                               double ar, double bx, double bz, double bvx,
                               double bvz, double br, double* output);
void resolve_vehicle_collision_v2(double ax, double az, double avx, double avz,
                                  double ar, double bx, double bz, double bvx,
                                  double bvz, double br, double* output);
void suspension_response(double accel, double steer, double speed,
                         double prev_pitch, double prev_roll,
                         double prev_pitch_vel, double prev_roll_vel,
                         double dt, double* out);
double swept_aabb(double x0, double z0, double x1, double z1, double radius,
                  double box_x, double box_z, double half_w, double half_d);
void separation_force(double x, double z,
                      double ax, double az, double bx, double bz,
                      double cx, double cz, double radius, double* output);
}

namespace {
int failures = 0;
void check(const char* name, bool ok) {
  std::printf("%s: %s\n", name, ok ? "PASS" : "FAIL");
  if (!ok) ++failures;
}
bool is_finite(double v) { return std::isfinite(v); }
}  // namespace

int main() {
  // step_vehicle (v1 regression: basic forward step)
  {
    double out[4] = {0, 0, 0, 0};
    step_vehicle(0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0 / 60.0, out);
    check("step_vehicle forward step",
          is_finite(out[0]) && is_finite(out[1]) && is_finite(out[2]) && is_finite(out[3]) &&
              out[3] > 0.0 && out[1] > 0.0);
  }

  // step_vehicle_v2 (grip in range, handbrake reduces grip)
  {
    double normal[7] = {0, 0, 0, 0, 0, 0, 0};
    double drift[7] = {0, 0, 0, 0, 0, 0, 0};
    step_vehicle_v2(0.0, 0.0, 0.0, 10.0, 0.0, 0.5, 0.0, 1.0 / 60.0, normal);
    step_vehicle_v2(0.0, 0.0, 0.0, 10.0, 0.0, 0.5, 1.0, 1.0 / 60.0, drift);
    check("step_vehicle_v2 grip in range",
          normal[6] >= 0.0 && normal[6] <= 1.05 && drift[6] >= 0.0 && drift[6] <= 1.05);
    check("step_vehicle_v2 handbrake reduces grip", drift[6] < normal[6]);
  }

  // resolve_vehicle_collision (head-on: damage > 0, velocities exchange sign)
  {
    double out[9] = {0, 0, 0, 0, 0, 0, 0, 0, 0};
    resolve_vehicle_collision(0.0, 0.0, 5.0, 0.0, 1.0,
                              1.5, 0.0, -5.0, 0.0, 1.0, out);
    check("resolve_vehicle_collision head-on damage", out[8] > 0.0);
    check("resolve_vehicle_collision head-on velocity exchange",
          out[2] < 0.0 && out[6] > 0.0);
  }

  // resolve_vehicle_collision_v2 (oblique hit: tangential velocity reduced vs v1)
  {
    double v1[9] = {0, 0, 0, 0, 0, 0, 0, 0, 0};
    double v2[9] = {0, 0, 0, 0, 0, 0, 0, 0, 0};
    // Normal is +x, so the tangent is +z; b carries tangential velocity 3.
    resolve_vehicle_collision(0.0, 0.0, 4.0, 0.0, 1.0,
                              1.2, 0.0, -4.0, 3.0, 1.0, v1);
    resolve_vehicle_collision_v2(0.0, 0.0, 4.0, 0.0, 1.0,
                                 1.2, 0.0, -4.0, 3.0, 1.0, v2);
    const double rvt_v1 = v1[7] - v1[3];
    const double rvt_v2 = v2[7] - v2[3];
    check("resolve_vehicle_collision_v2 tangential friction",
          std::fabs(rvt_v2) < std::fabs(rvt_v1));
  }

  // suspension_response (step response settles on the target, no NaN)
  {
    const double accel = 10.0;
    const double target = std::max(-0.055, std::min(-accel * 0.0028, 0.06));
    double state[4] = {0, 0, 0, 0};
    bool nan_free = true;
    for (int i = 0; i < 120; ++i) {
      double next[4] = {0, 0, 0, 0};
      suspension_response(accel, 0.0, 0.0, state[0], state[1], state[2], state[3],
                          1.0 / 60.0, next);
      for (int k = 0; k < 4; ++k) {
        state[k] = next[k];
        if (!is_finite(next[k])) nan_free = false;
      }
    }
    check("suspension_response settles on target",
          nan_free && std::fabs(state[0] - target) < 0.01);
    check("suspension_response no NaN", nan_free);
  }

  // swept_aabb (tunnelling catch: the endpoint misses, the sweep hits)
  {
    const double t = swept_aabb(-10.0, 0.0, 10.0, 0.0, 0.5, 0.0, 0.0, 1.0, 1.0);
    check("swept_aabb tunnelling catch", t >= 0.0 && t <= 1.0);
  }

  // separation_force (nonzero repulsion from a close neighbour)
  {
    double out[2] = {0, 0};
    separation_force(0.0, 0.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 2.0, out);
    check("separation_force nonzero repulsion",
          std::sqrt(out[0] * out[0] + out[1] * out[1]) > 0.0);
  }

  if (failures == 0) {
    std::printf("ALL PASS\n");
    return 0;
  }
  std::printf("%d CHECK(S) FAILED\n", failures);
  return 1;
}
