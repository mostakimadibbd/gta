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
// Phase 10 realism + physics round
void step_vehicle_v3(double x, double z, double heading, double speed,
                     double throttle, double steering, double handbrake,
                     double surface_grip, double delta_time, double* output);
void vehicle_body(double h0, double h1, double h2, double h3,
                  double accel, double steer, double speed,
                  double prev_pitch, double prev_roll, double prev_heave,
                  double prev_pitch_vel, double prev_roll_vel,
                  double prev_heave_vel, double delta_time, double* output);
void debris_step(double x, double y, double z, double vx, double vy, double vz,
                 double ground_y, double restitution, double ground_keep,
                 double delta_time, double* output);
void swim_step(double phase, double target_speed, double prev_speed,
               double delta_time, double* output);
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

  // ---- Phase 10 realism + physics round --------------------------------
  // step_vehicle_v3: the same corner on wet asphalt turns LESS than dry
  {
    double dry[8] = {0}, wet[8] = {0};
    double ds[4] = {0, 0, 0, 12.0}, ws[4] = {0, 0, 0, 12.0};
    for (int i = 0; i < 60; ++i) {
      step_vehicle_v3(ds[0], ds[1], ds[2], ds[3], 0.0, 0.6, 0.0, 1.0, 1.0 / 60.0, dry);
      for (int k = 0; k < 4; ++k) ds[k] = dry[k];
      step_vehicle_v3(ws[0], ws[1], ws[2], ws[3], 0.0, 0.6, 0.0, 0.68, 1.0 / 60.0, wet);
      for (int k = 0; k < 4; ++k) ws[k] = wet[k];
    }
    check("step_vehicle_v3 wet corner turns less than dry", std::fabs(wet[2]) < std::fabs(dry[2]) * 0.9);
    check("step_vehicle_v3 grip scales with surface", dry[6] > wet[6] && wet[6] > 0.2);
  }

  // step_vehicle_v3: a full-throttle launch on sand spins the wheels;
  // a gentle dry cruise does not
  {
    double sand[8] = {0}, cruise[8] = {0};
    step_vehicle_v3(0.0, 0.0, 0.0, 0.5, 1.0, 0.0, 0.0, 0.55, 1.0 / 60.0, sand);
    step_vehicle_v3(0.0, 0.0, 0.0, 10.0, 0.3, 0.0, 0.0, 1.0, 1.0 / 60.0, cruise);
    check("step_vehicle_v3 sand launch wheelspin", sand[7] > 0.3);
    check("step_vehicle_v3 dry cruise no wheelspin", cruise[7] < 0.05);
  }

  // step_vehicle_v3: handbrake slide runs wider (less heading change)
  // on a wet surface than on dry
  {
    double hd[8] = {0}, hw[8] = {0};
    step_vehicle_v3(0.0, 0.0, 0.0, 14.0, 0.0, 0.8, 1.0, 1.0, 1.0 / 60.0, hd);
    step_vehicle_v3(0.0, 0.0, 0.0, 14.0, 0.0, 0.8, 1.0, 0.68, 1.0 / 60.0, hw);
    check("step_vehicle_v3 wet handbrake slide is wider", std::fabs(hw[2]) < std::fabs(hd[2]));
  }

  // vehicle_body: flat ground settles neutral; a front bump lifts the
  // nose (pitch < 0) and compresses the front wheels harder
  {
    double out[10] = {0};
    double st[6] = {0, 0, 0, 0, 0, 0};
    for (int i = 0; i < 90; ++i) {
      vehicle_body(0, 0, 0, 0, 0, 0, 0, st[0], st[1], st[2], st[3], st[4], st[5], 1.0 / 60.0, out);
      for (int k = 0; k < 6; ++k) st[k] = out[k];
    }
    check("vehicle_body flat settles neutral",
          std::fabs(out[0]) < 0.01 && std::fabs(out[1]) < 0.01 && std::fabs(out[2]) < 0.01 &&
              std::fabs(out[6] - 0.45) < 0.001 && std::fabs(out[9] - 0.45) < 0.001);
    double bump[10] = {0};
    vehicle_body(0.3, 0.3, 0.0, 0.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.0 / 60.0, bump);
    check("vehicle_body front bump compresses front wheels", bump[6] > 0.8 && bump[8] < 0.5);
    double bst[6] = {0, 0, 0, 0, 0, 0};
    for (int i = 0; i < 90; ++i) {
      vehicle_body(0.3, 0.3, 0.0, 0.0, 0, 0, 0, bst[0], bst[1], bst[2], bst[3], bst[4], bst[5], 1.0 / 60.0, bump);
      for (int k = 0; k < 6; ++k) bst[k] = bump[k];
    }
    check("vehicle_body front bump pitches nose up", bump[0] < -0.02);
    // hard braking dives the nose (pitch > 0) even on flat ground
    double dive[10] = {0};
    double dst[6] = {0, 0, 0, 0, 0, 0};
    for (int i = 0; i < 90; ++i) {
      vehicle_body(0, 0, 0, 0, -9.0, 0, 12.0, dst[0], dst[1], dst[2], dst[3], dst[4], dst[5], 1.0 / 60.0, dive);
      for (int k = 0; k < 6; ++k) dst[k] = dive[k];
    }
    check("vehicle_body braking dive", dive[0] > 0.02);
  }

  // debris_step: falls under gravity, bounces lower, then settles
  {
    double out[6] = {0};
    double s[6] = {0, 3.0, 0, 1.0, 0.0, 0.0};
    double peak_vy_after_bounce = 0.0;
    bool bounced = false;
    for (int i = 0; i < 240; ++i) {
      debris_step(s[0], s[1], s[2], s[3], s[4], s[5], 0.1, 0.35, 0.7, 1.0 / 60.0, out);
      for (int k = 0; k < 6; ++k) s[k] = out[k];
      if (s[1] <= 0.1 + 1e-9 && s[4] > 0.0) { bounced = true; peak_vy_after_bounce = std::max(peak_vy_after_bounce, s[4]); }
    }
    check("debris_step bounces off the ground", bounced && peak_vy_after_bounce > 0.5);
    check("debris_step settles at rest on the ground",
          std::fabs(s[1] - 0.1) < 1e-9 && s[4] == 0.0 && is_finite(s[0]) && is_finite(s[3]));
  }

  // swim_step: speed relaxes toward the target (drag), bob stays small
  {
    double out[3] = {0};
    double speed = 0.0;
    bool bob_ok = true;
    for (int i = 0; i < 120; ++i) {
      swim_step(i * 0.09, 2.4, speed, 1.0 / 60.0, out);
      speed = out[0];
      if (std::fabs(out[2]) > 0.056 || !is_finite(out[0]) || !is_finite(out[1])) bob_ok = false;
    }
    check("swim_step speed relaxes toward target", std::fabs(speed - 2.4) < 0.05);
    check("swim_step bob bounded + outputs finite", bob_ok);
    check("swim_step surge in range", out[1] >= 0.72 && out[1] <= 1.0);
  }

  if (failures == 0) {
    std::printf("ALL PASS\n");
    return 0;
  }
  std::printf("%d CHECK(S) FAILED\n", failures);
  return 1;
}
