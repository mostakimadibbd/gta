export interface VehicleState { x: number; z: number; heading: number; speed: number; }
export interface PedState { x: number; z: number; heading: number; speed: number; }

export interface VehicleStepV2 { state: VehicleState; pitch: number; roll: number; grip: number; }
export interface BodyCircle { x: number; z: number; vx: number; vz: number; radius: number; }

export interface PhysicsEngine {
  stepVehicle(state: VehicleState, throttle: number, steering: number, handbrake: boolean, deltaTime: number): VehicleState;
  stepVehicleV2(state: VehicleState, throttle: number, steering: number, handbrake: boolean, deltaTime: number): VehicleStepV2;
  resolveVehicleCollision(a: BodyCircle, b: BodyCircle): { a: BodyCircle; b: BodyCircle; damage: number };
  suspensionResponse(accel: number, steer: number, speed: number, prev: { pitch: number; roll: number; pitchVel: number; rollVel: number }, dt: number): { pitch: number; roll: number; pitchVel: number; rollVel: number };
  resolveVehicleCollisionV2(a: BodyCircle, b: BodyCircle): { a: BodyCircle; b: BodyCircle; damage: number };
  sweptAabb(x0: number, z0: number, x1: number, z1: number, radius: number, boxX: number, boxZ: number, halfW: number, halfD: number): number;
  separationForce(x: number, z: number, others: { x: number; z: number }[], radius: number): { x: number; z: number };
  distanceSquared(ax: number, az: number, bx: number, bz: number): number;
  collideAabb(x: number, z: number, radius: number, boxX: number, boxZ: number, halfW: number, halfD: number): boolean;
  resolveAabb(x: number, z: number, radius: number, boxX: number, boxZ: number, halfW: number, halfD: number): { x: number; z: number };
  stepPedestrian(state: PedState, targetX: number, targetZ: number, threatX: number, threatZ: number, flee: boolean, walkSpeed: number, deltaTime: number): PedState;
  // Phase 8 — Harborfall Core decision logic
  trafficDecision(speed: number, cruise: number, distStop: number, lightState: number, queueGap: number): { target: number; braking: boolean };
  stepPedestrianV2(state: PedState, targetX: number, targetZ: number, threatX: number, threatZ: number, flee: boolean, walkSpeed: number, others: { x: number; z: number }[], sepRadius: number, deltaTime: number): PedState;
  losSampled(ox: number, oz: number, tx: number, tz: number, blockers: { x: number; z: number; hw: number; hd: number }[]): number;
  boatBuoyancy(phase: number, speed: number, waveAmp: number): { bob: number; pitch: number; roll: number };
  racePace(playerDist: number, oppDist: number, baseTop: number, rubber: number): number;
  source: "wasm" | "typescript";
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// Exact mirror of src/cpp/physics.cpp — keep the two in sync.
export const fallbackPhysics: PhysicsEngine = {
  source: "typescript",
  distanceSquared(ax, az, bx, bz) { return (ax - bx) ** 2 + (az - bz) ** 2; },
  stepVehicle(state, throttle, steering, handbrake, deltaTime) {
    const dt = clamp(deltaTime, 0, 0.1);
    const gas = clamp(throttle, -1, 1);
    const steer = clamp(steering, -1, 1);
    let speed = state.speed + gas * (gas >= 0 ? 18 : 8) * dt;
    speed *= Math.max(0, 1 - (handbrake ? 5.5 : 0.65) * dt);
    if (gas === 0 && Math.abs(speed) < 0.12) speed = 0;
    speed = clamp(speed, -8, 24);
    const speedFactor = clamp(Math.abs(speed) / 4, 0.18, 1);
    const driftFactor = handbrake ? 0.62 : 1;
    const heading = wrap(state.heading + steer * 2.2 * speedFactor * driftFactor * dt * (speed < 0 ? -1 : 1));
    return { x: state.x + Math.sin(heading) * speed * dt, z: state.z + Math.cos(heading) * speed * dt, heading, speed };
  },
  collideAabb(x, z, radius, boxX, boxZ, halfW, halfD) {
    return Math.abs(x - boxX) < halfW + radius && Math.abs(z - boxZ) < halfD + radius;
  },
  resolveAabb(x, z, radius, boxX, boxZ, halfW, halfD) {
    const dx = x - boxX; const dz = z - boxZ;
    const penX = halfW + radius - Math.abs(dx);
    const penZ = halfD + radius - Math.abs(dz);
    if (penX > 0 && penZ > 0) {
      if (penX < penZ) x = boxX + (dx >= 0 ? halfW + radius : -(halfW + radius));
      else z = boxZ + (dz >= 0 ? halfD + radius : -(halfD + radius));
    }
    return { x, z };
  },
  // --- Phase 4: exact TS mirrors of the new C++ exports -------------------
  stepVehicleV2(state, throttle, steering, handbrake, deltaTime) {
    const dt = clamp(deltaTime, 0, 0.1);
    const gas = clamp(throttle, -1, 1);
    const steer = clamp(steering, -1, 1);
    const prevSpeed = state.speed;
    let speed = state.speed + gas * (gas >= 0 ? 18 : 8) * dt;
    speed *= Math.max(0, 1 - (handbrake ? 5.5 : 0.65) * dt);
    if (gas === 0 && Math.abs(speed) < 0.12) speed = 0;
    speed = clamp(speed, -8, 24);
    const accel = dt > 0.0001 ? (speed - prevSpeed) / dt : 0;
    let grip = clamp(1.12 - Math.abs(speed) / 34, 0.74, 1.05);
    if (handbrake) grip *= 0.58;
    const speedFactor = clamp(Math.abs(speed) / 4, 0.18, 1);
    const heading = wrap(state.heading + steer * 2.2 * speedFactor * grip * dt * (speed < 0 ? -1 : 1));
    const pitch = clamp(-accel * 0.0028, -0.055, 0.06);
    const roll = clamp(steer * Math.abs(speed) * 0.0042, -0.095, 0.095) * (handbrake ? 0.55 : 1) * (speed < 0 ? -1 : 1);
    return {
      state: { x: state.x + Math.sin(heading) * speed * dt, z: state.z + Math.cos(heading) * speed * dt, heading, speed },
      pitch, roll, grip,
    };
  },
  resolveVehicleCollision(a, b) {
    let ax = a.x, az = a.z, avx = a.vx, avz = a.vz;
    let bx = b.x, bz = b.z, bvx = b.vx, bvz = b.vz;
    let dx = bx - ax; let dz = bz - az;
    const minDist = a.radius + b.radius;
    let dist = Math.sqrt(dx * dx + dz * dz);
    let damage = 0;
    if (dist < minDist) {
      if (dist < 0.0001) { dx = 1; dz = 0; dist = 1; }
      const nx = dx / dist; const nz = dz / dist;
      const push = (minDist - dist) * 0.5;
      ax -= nx * push; az -= nz * push; bx += nx * push; bz += nz * push;
      const rvn = (bvx - avx) * nx + (bvz - avz) * nz;
      if (rvn < 0) {
        const impulse = -(1 + 0.35) * rvn * 0.5;
        avx -= impulse * nx; avz -= impulse * nz;
        bvx += impulse * nx; bvz += impulse * nz;
        damage = clamp(-rvn * 2.1, 0, 22);
      }
    }
    return { a: { ...a, x: ax, z: az, vx: avx, vz: avz }, b: { ...b, x: bx, z: bz, vx: bvx, vz: bvz }, damage };
  },
  // --- Phase 6 Tier B5: exact TS mirrors of the new C++ exports ------------
  suspensionResponse(accel, steer, speed, prev, dtRaw) {
    const dt = clamp(dtRaw, 0, 0.1);
    const targetPitch = clamp(-accel * 0.0028, -0.055, 0.06);
    const targetRoll = clamp(steer * Math.abs(speed) * 0.0042, -0.095, 0.095) * (speed < 0 ? -1 : 1);
    let pitch = prev.pitch;
    let roll = prev.roll;
    let pitchVel = prev.pitchVel;
    let rollVel = prev.rollVel;
    {
      const acc = 52.0 * (targetPitch - pitch) - 11.0 * pitchVel;
      pitchVel += acc * dt;
      pitch += pitchVel * dt;
    }
    {
      const acc = 52.0 * (targetRoll - roll) - 11.0 * rollVel;
      rollVel += acc * dt;
      roll += rollVel * dt;
    }
    return { pitch, roll, pitchVel, rollVel };
  },
  resolveVehicleCollisionV2(a, b) {
    let ax = a.x, az = a.z, avx = a.vx, avz = a.vz;
    let bx = b.x, bz = b.z, bvx = b.vx, bvz = b.vz;
    let dx = bx - ax; let dz = bz - az;
    const minDist = a.radius + b.radius;
    let dist = Math.sqrt(dx * dx + dz * dz);
    let damage = 0;
    if (dist < minDist) {
      if (dist < 0.0001) { dx = 1; dz = 0; dist = 1; }
      const nx = dx / dist; const nz = dz / dist;
      const push = (minDist - dist) * 0.5;
      ax -= nx * push; az -= nz * push; bx += nx * push; bz += nz * push;
      const rvn = (bvx - avx) * nx + (bvz - avz) * nz;
      let impulse = 0;
      if (rvn < 0) {
        impulse = -(1 + 0.35) * rvn * 0.5;
        avx -= impulse * nx; avz -= impulse * nz;
        bvx += impulse * nx; bvz += impulse * nz;
        damage = clamp(-rvn * 2.1, 0, 22);
      }
      if (rvn < 0) {
        const tx = -nz; const tz = nx;
        const rvx = bvx - avx; const rvz = bvz - avz;
        const rvt = rvx * tx + rvz * tz;
        const jt = clamp(-rvt * 0.5, -0.45 * impulse, 0.45 * impulse);
        avx -= jt * tx; avz -= jt * tz;
        bvx += jt * tx; bvz += jt * tz;
      }
    }
    return { a: { ...a, x: ax, z: az, vx: avx, vz: avz }, b: { ...b, x: bx, z: bz, vx: bvx, vz: bvz }, damage };
  },
  sweptAabb(x0, z0, x1, z1, radius, boxX, boxZ, halfW, halfD) {
    const minx = boxX - halfW - radius, maxx = boxX + halfW + radius;
    const minz = boxZ - halfD - radius, maxz = boxZ + halfD + radius;
    const dx = x1 - x0, dz = z1 - z0;
    let tmin = 0, tmax = 1;
    if (Math.abs(dx) < 1e-9) { if (x0 < minx || x0 > maxx) return -1; }
    else {
      let t1 = (minx - x0) / dx, t2 = (maxx - x0) / dx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
    if (Math.abs(dz) < 1e-9) { if (z0 < minz || z0 > maxz) return -1; }
    else {
      let t1 = (minz - z0) / dz, t2 = (maxz - z0) / dz;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
    return tmin;
  },
  separationForce(x, z, others, radius) {
    let fx = 0, fz = 0;
    for (let i = 0; i < 3; i++) {
      const o = others[i] ?? { x, z };
      const dx = x - o.x, dz = z - o.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 0.0001 || d2 > radius * radius) continue;
      const d = Math.sqrt(d2);
      const w = (radius - d) / radius;
      fx += (dx / d) * w * 1.6;
      fz += (dz / d) * w * 1.6;
    }
    return { x: clamp(fx, -2.4, 2.4), z: clamp(fz, -2.4, 2.4) };
  },
  stepPedestrian(state, targetX, targetZ, threatX, threatZ, flee, walkSpeed, deltaTime) {
    const dt = clamp(deltaTime, 0, 0.1);
    let goalX = targetX; let goalZ = targetZ;
    let desired = clamp(walkSpeed, 0, 3);
    if (flee) {
      const dx = state.x - threatX; const dz = state.z - threatZ;
      const dist = Math.hypot(dx, dz);
      if (dist < 14 && dist > 0.0001) { goalX = state.x + (dx / dist) * 10; goalZ = state.z + (dz / dist) * 10; desired = 5.2; }
    }
    const gx = goalX - state.x; const gz = goalZ - state.z;
    let heading = state.heading;
    if (Math.hypot(gx, gz) < 0.4) desired = 0;
    else {
      const turn = wrap(Math.atan2(gx, gz) - heading);
      heading = wrap(heading + clamp(turn, -3.2 * dt, 3.2 * dt));
    }
    const speed = state.speed + clamp(desired - state.speed, -6 * dt, 6 * dt);
    return { x: state.x + Math.sin(heading) * speed * dt, z: state.z + Math.cos(heading) * speed * dt, heading, speed };
  },
  // --- Phase 8: exact TS mirrors of the Harborfall Core decision exports --
  trafficDecision(speed, cruise, distStop, lightState, queueGap) {
    let target = cruise;
    let braking = false;
    if (lightState >= 1 && distStop < 16) {
      target = Math.min(target, clamp((distStop - 1.1) * 0.6, 0, cruise));
      if (distStop < 9) braking = true;
    }
    if (queueGap < 8.5) {
      target = Math.min(target, clamp((queueGap - 2.4) * 1.15, 0, cruise));
      if (queueGap < 5) braking = true;
    }
    if (target < speed - 0.5) braking = true;
    return { target, braking };
  },
  stepPedestrianV2(state, targetX, targetZ, threatX, threatZ, flee, walkSpeed, others, sepRadius, deltaTime) {
    const base = fallbackPhysics.stepPedestrian(state, targetX, targetZ, threatX, threatZ, flee, walkSpeed, deltaTime);
    const f = fallbackPhysics.separationForce(base.x, base.z, others, sepRadius);
    const dt = clamp(deltaTime, 0, 0.1);
    return { ...base, x: base.x + f.x * dt * 0.85, z: base.z + f.z * dt * 0.85 };
  },
  losSampled(ox, oz, tx, tz, blockers) {
    const n = 12;
    let clear = 0;
    for (let i = 1; i < n; i++) {
      const f = i / n;
      const px = ox + (tx - ox) * f, pz = oz + (tz - oz) * f;
      let blocked = false;
      for (let b = 0; b < 4; b++) {
        const bl = blockers[b];
        if (!bl || bl.hw <= 0) continue;
        if (Math.abs(px - bl.x) < bl.hw && Math.abs(pz - bl.z) < bl.hd) { blocked = true; break; }
      }
      if (!blocked) clear++;
    }
    return clear / (n - 1);
  },
  boatBuoyancy(phase, speed, waveAmp) {
    const plane = clamp(Math.abs(speed) / 14.5, 0, 1);
    const calm = 1 - plane * 0.62;
    return {
      bob: Math.sin(phase) * waveAmp * calm,
      pitch: Math.sin(phase * 0.8 + 1.3) * 0.021 * calm - plane * 0.012,
      roll: Math.sin(phase * 0.63 + 0.4) * 0.03 * calm,
    };
  },
  racePace(playerDist, oppDist, baseTop, rubber) {
    return baseTop + clamp((playerDist - oppDist) * 0.014, -rubber, rubber);
  },
};

interface WasmModule {
  HEAPF64: Float64Array;
  _malloc(size: number): number;
  cwrap(name: string, returnType: string | null, argumentTypes: string[]): (...args: number[]) => number | void;
}

export async function loadPhysicsEngine(): Promise<PhysicsEngine> {
  try {
    const wasmUrl = "/physics/physics.js";
    const loaded = (await import(/* @vite-ignore */ wasmUrl)) as {
      default: (options: { locateFile: (path: string) => string }) => Promise<WasmModule>;
    };
    const module = await loaded.default({ locateFile: (path) => `/physics/${path}` });
    const step = module.cwrap("step_vehicle", null, Array(9).fill("number"));
    const distance = module.cwrap("distance_squared", "number", Array(4).fill("number"));
    const collide = module.cwrap("collide_aabb", "number", Array(7).fill("number"));
    const resolve = module.cwrap("resolve_aabb", null, Array(8).fill("number"));
    const stepPed = module.cwrap("step_pedestrian", null, Array(12).fill("number"));
    const out4 = module._malloc(4 * Float64Array.BYTES_PER_ELEMENT);
    const out2 = module._malloc(2 * Float64Array.BYTES_PER_ELEMENT);
    const out7 = module._malloc(7 * Float64Array.BYTES_PER_ELEMENT);
    const out9 = module._malloc(9 * Float64Array.BYTES_PER_ELEMENT);
    if (!out4 || !out2 || !out7 || !out9) throw new Error("Could not allocate WASM physics buffers.");
    const read4 = (): VehicleState => {
      const i = out4 / Float64Array.BYTES_PER_ELEMENT; const h = module.HEAPF64;
      return { x: h[i], z: h[i + 1], heading: h[i + 2], speed: h[i + 3] };
    };
    // Phase 4 exports: if the deployed .wasm predates them, cwrap throws —
    // fall back to the exact TS mirrors for just those four functions.
    let v2: Pick<PhysicsEngine, "stepVehicleV2" | "resolveVehicleCollision" | "sweptAabb" | "separationForce"> | null = null;
    try {
      const stepV2 = module.cwrap("step_vehicle_v2", null, Array(10).fill("number"));
      const resolveVV = module.cwrap("resolve_vehicle_collision", null, Array(12).fill("number"));
      const swept = module.cwrap("swept_aabb", "number", Array(9).fill("number"));
      const separation = module.cwrap("separation_force", null, Array(11).fill("number"));
      const h = module.HEAPF64;
      v2 = {
        stepVehicleV2(state, throttle, steering, handbrake, deltaTime) {
          stepV2(state.x, state.z, state.heading, state.speed, throttle, steering, handbrake ? 1 : 0, deltaTime, out7);
          const i = out7 / Float64Array.BYTES_PER_ELEMENT;
          return { state: { x: h[i], z: h[i + 1], heading: h[i + 2], speed: h[i + 3] }, pitch: h[i + 4], roll: h[i + 5], grip: h[i + 6] };
        },
        resolveVehicleCollision(a, b) {
          resolveVV(a.x, a.z, a.vx, a.vz, a.radius, b.x, b.z, b.vx, b.vz, b.radius, out9);
          const i = out9 / Float64Array.BYTES_PER_ELEMENT;
          return {
            a: { ...a, x: h[i], z: h[i + 1], vx: h[i + 2], vz: h[i + 3] },
            b: { ...b, x: h[i + 4], z: h[i + 5], vx: h[i + 6], vz: h[i + 7] },
            damage: h[i + 8],
          };
        },
        sweptAabb(x0, z0, x1, z1, r, bx, bz, hw, hd) { return swept(x0, z0, x1, z1, r, bx, bz, hw, hd) as number; },
        separationForce(x, z, others, radius) {
          const o = [others[0] ?? { x, z }, others[1] ?? { x, z }, others[2] ?? { x, z }];
          separation(x, z, o[0].x, o[0].z, o[1].x, o[1].z, o[2].x, o[2].z, radius, out2);
          const i = out2 / Float64Array.BYTES_PER_ELEMENT;
          return { x: h[i], z: h[i + 1] };
        },
      };
    } catch { v2 = null; }
    // Phase 6 Tier B5 exports: their OWN try/catch — an older .wasm won't
    // have them, so fall back to the exact TS mirrors for just these two.
    let b5: Pick<PhysicsEngine, "suspensionResponse" | "resolveVehicleCollisionV2"> | null = null;
    try {
      const suspension = module.cwrap("suspension_response", null, Array(10).fill("number"));
      const resolveV2 = module.cwrap("resolve_vehicle_collision_v2", null, Array(12).fill("number"));
      const h = module.HEAPF64;
      b5 = {
        suspensionResponse(accel, steer, speed, prev, dt) {
          suspension(accel, steer, speed, prev.pitch, prev.roll, prev.pitchVel, prev.rollVel, dt, out4);
          const i = out4 / Float64Array.BYTES_PER_ELEMENT;
          return { pitch: h[i], roll: h[i + 1], pitchVel: h[i + 2], rollVel: h[i + 3] };
        },
        resolveVehicleCollisionV2(a, b) {
          resolveV2(a.x, a.z, a.vx, a.vz, a.radius, b.x, b.z, b.vx, b.vz, b.radius, out9);
          const i = out9 / Float64Array.BYTES_PER_ELEMENT;
          return {
            a: { ...a, x: h[i], z: h[i + 1], vx: h[i + 2], vz: h[i + 3] },
            b: { ...b, x: h[i + 4], z: h[i + 5], vx: h[i + 6], vz: h[i + 7] },
            damage: h[i + 8],
          };
        },
      };
    } catch { b5 = null; }
    // Phase 8 Harborfall Core exports: own try/catch (older .wasm lacks
    // them → exact TS mirrors take over, same pattern as Phase 4/6)
    let core: Pick<PhysicsEngine, "trafficDecision" | "stepPedestrianV2" | "losSampled" | "boatBuoyancy" | "racePace"> | null = null;
    try {
      const traffic = module.cwrap("traffic_decision", null, Array(7).fill("number"));
      const stepPed2 = module.cwrap("step_pedestrian_v2", null, Array(20).fill("number"));
      const los = module.cwrap("los_sampled", "number", Array(21).fill("number"));
      const buoy = module.cwrap("boat_buoyancy", null, Array(5).fill("number"));
      const pace = module.cwrap("race_pace", "number", Array(4).fill("number"));
      const h = module.HEAPF64;
      const out3 = module._malloc(3 * Float64Array.BYTES_PER_ELEMENT);
      if (!out3) throw new Error("Could not allocate WASM physics buffers.");
      core = {
        trafficDecision(speed, cruise, distStop, lightState, queueGap) {
          traffic(speed, cruise, distStop, lightState, queueGap, out2);
          const i = out2 / Float64Array.BYTES_PER_ELEMENT;
          return { target: h[i], braking: h[i + 1] > 0.5 };
        },
        stepPedestrianV2(state, tx, tz, thx, thz, flee, walkSpeed, others, sepRadius, deltaTime) {
          const o = [others[0] ?? { x: state.x, z: state.z }, others[1] ?? { x: state.x, z: state.z }, others[2] ?? { x: state.x, z: state.z }];
          stepPed2(state.x, state.z, state.heading, state.speed, tx, tz, thx, thz, flee ? 1 : 0, walkSpeed,
            o[0].x, o[0].z, o[1].x, o[1].z, o[2].x, o[2].z, sepRadius, deltaTime, out4);
          return read4();
        },
        losSampled(ox, oz, tx, tz, blockers) {
          const b = [0, 1, 2, 3].map((i) => blockers[i] ?? { x: 0, z: 0, hw: 0, hd: 0 });
          return los(ox, oz, tx, tz,
            b[0].x, b[0].z, b[0].hw, b[0].hd, b[1].x, b[1].z, b[1].hw, b[1].hd,
            b[2].x, b[2].z, b[2].hw, b[2].hd, b[3].x, b[3].z, b[3].hw, b[3].hd, 12) as number;
        },
        boatBuoyancy(phase, speed, waveAmp) {
          buoy(phase, speed, waveAmp, out3);
          const i = out3 / Float64Array.BYTES_PER_ELEMENT;
          return { bob: h[i], pitch: h[i + 1], roll: h[i + 2] };
        },
        racePace(playerDist, oppDist, baseTop, rubber) { return pace(playerDist, oppDist, baseTop, rubber) as number; },
      };
    } catch { core = null; }
    const fb = fallbackPhysics;
    return {
      source: "wasm",
      trafficDecision: core?.trafficDecision ?? fb.trafficDecision,
      stepPedestrianV2: core?.stepPedestrianV2 ?? fb.stepPedestrianV2,
      losSampled: core?.losSampled ?? fb.losSampled,
      boatBuoyancy: core?.boatBuoyancy ?? fb.boatBuoyancy,
      racePace: core?.racePace ?? fb.racePace,
      distanceSquared(ax, az, bx, bz) { return distance(ax, az, bx, bz) as number; },
      stepVehicle(state, throttle, steering, handbrake, deltaTime) {
        step(state.x, state.z, state.heading, state.speed, throttle, steering, handbrake ? 1 : 0, deltaTime, out4);
        return read4();
      },
      stepVehicleV2: v2?.stepVehicleV2 ?? fb.stepVehicleV2,
      resolveVehicleCollision: v2?.resolveVehicleCollision ?? fb.resolveVehicleCollision,
      suspensionResponse: b5?.suspensionResponse ?? fb.suspensionResponse,
      resolveVehicleCollisionV2: b5?.resolveVehicleCollisionV2 ?? fb.resolveVehicleCollisionV2,
      sweptAabb: v2?.sweptAabb ?? fb.sweptAabb,
      separationForce: v2?.separationForce ?? fb.separationForce,
      collideAabb(x, z, r, bx, bz, hw, hd) { return (collide(x, z, r, bx, bz, hw, hd) as number) > 0.5; },
      resolveAabb(x, z, r, bx, bz, hw, hd) {
        resolve(x, z, r, bx, bz, hw, hd, out2);
        const i = out2 / Float64Array.BYTES_PER_ELEMENT; const h = module.HEAPF64;
        return { x: h[i], z: h[i + 1] };
      },
      stepPedestrian(state, tx, tz, thx, thz, flee, walkSpeed, deltaTime) {
        stepPed(state.x, state.z, state.heading, state.speed, tx, tz, thx, thz, flee ? 1 : 0, walkSpeed, deltaTime, out4);
        return read4();
      },
    };
  } catch (error) {
    console.warn("WebAssembly physics unavailable; using the TypeScript fallback.", error);
    return fallbackPhysics;
  }
}
