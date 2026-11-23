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
void step_pedestrian(double x, double z, double heading, double speed,
                     double target_x, double target_z, double threat_x,
                     double threat_z, double flee, double walk_speed,
                     double delta_time, double* output);
// Phase 8 Harborfall Core decision functions
void traffic_decision(double speed, double cruise, double dist_stop,
                      double light_state, double queue_gap, double* output);
void step_pedestrian_v2(double x, double z, double heading, double speed,
                        double target_x, double target_z, double threat_x,
                        double threat_z, double flee, double walk_speed,
                        double n1x, double n1z, double n2x, double n2z,
                        double n3x, double n3z, double sep_radius,
                        double delta_time, double* output);
double los_sampled(double ox, double oz, double tx, double tz,
                   double b1x, double b1z, double b1w, double b1d,
                   double b2x, double b2z, double b2w, double b2d,
                   double b3x, double b3z, double b3w, double b3d,
                   double b4x, double b4z, double b4w, double b4d,
                   double samples);
void boat_buoyancy(double phase, double speed, double wave_amp, double* output);
double race_pace(double player_dist, double opp_dist, double base_top, double rubber);
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

  // ---- Phase 8 Harborfall Core decision functions ----------------------
  // traffic_decision: green + no queue → cruise; red at the line → stop
  {
    double out[2] = {0, 0};
    traffic_decision(8.0, 8.5, 1e9, 0.0, 1e9, out);
    check("traffic_decision green cruises", std::fabs(out[0] - 8.5) < 0.001 && out[1] == 0.0);
    traffic_decision(8.0, 8.5, 1.2, 2.0, 1e9, out);
    check("traffic_decision red at line stops", out[0] < 0.1 && out[1] == 1.0);
    traffic_decision(8.0, 8.5, 1e9, 0.0, 2.0, out);
    check("traffic_decision tight queue stops", out[0] < 0.1 && out[1] == 1.0);
  }

  // step_pedestrian_v2: matches v1 with far neighbours; a close neighbour
  // pushes the result sideways (separation folded in)
  {
    double v1[4] = {0, 0, 0, 0}, v2[4] = {0, 0, 0, 0}, v2n[4] = {0, 0, 0, 0};
    step_pedestrian(0.0, 0.0, 0.0, 0.0, 0.0, 10.0, 0.0, 0.0, 0.0, 1.6, 1.0 / 60.0, v1);
    step_pedestrian_v2(0.0, 0.0, 0.0, 0.0, 0.0, 10.0, 0.0, 0.0, 0.0, 1.6,
                       90.0, 90.0, 95.0, 95.0, -90.0, -90.0, 0.95, 1.0 / 60.0, v2);
    step_pedestrian_v2(0.0, 0.0, 0.0, 0.0, 0.0, 10.0, 0.0, 0.0, 0.0, 1.6,
                       0.4, 0.3, 90.0, 90.0, 95.0, 95.0, 0.95, 1.0 / 60.0, v2n);
    check("step_pedestrian_v2 matches v1 without neighbours",
          std::fabs(v1[0] - v2[0]) < 1e-9 && std::fabs(v1[1] - v2[1]) < 1e-9);
    check("step_pedestrian_v2 separation pushes off a close neighbour",
          std::fabs(v2n[0] - v2[0]) + std::fabs(v2n[1] - v2[1]) > 0.001);
  }

  // los_sampled: open segment = 1; a wall across the middle blocks most
  {
    const double open = los_sampled(0.0, 0.0, 10.0, 0.0,
                                    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12.0);
    const double walled = los_sampled(0.0, 0.0, 10.0, 0.0,
                                      5.0, 0.0, 1.5, 3.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12.0);
    check("los_sampled open segment clear", open == 1.0);
    check("los_sampled wall blocks most samples", walled < 0.85 && walled > 0.3);
  }

  // boat_buoyancy: bob is bounded by the wave amp and calms with speed
  {
    double slow[3] = {0, 0, 0}, fast[3] = {0, 0, 0};
    boat_buoyancy(1.1, 0.0, 0.14, slow);
    boat_buoyancy(1.1, 14.5, 0.14, fast);
    check("boat_buoyancy bob within amp", std::fabs(slow[0]) <= 0.14 && is_finite(slow[1]) && is_finite(slow[2]));
    check("boat_buoyancy calms at speed", std::fabs(fast[0]) < std::fabs(slow[0]));
  }

  // race_pace: behind → faster than base, ahead → slower, capped at rubber
  {
    check("race_pace behind speeds up", race_pace(100.0, 60.0, 20.0, 2.2) > 20.0);
    check("race_pace ahead eases off", race_pace(60.0, 100.0, 20.0, 2.2) < 20.0);
    check("race_pace capped at rubber band", std::fabs(race_pace(500.0, 0.0, 20.0, 2.2) - 22.2) < 1e-9);
  }

  if (failures == 0) {
    std::printf("ALL PASS\n");
    return 0;
  }
  std::printf("%d CHECK(S) FAILED\n", failures);
  return 1;
}
