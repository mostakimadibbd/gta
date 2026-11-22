export interface VehicleState { x: number; z: number; heading: number; speed: number; }
export interface PedState { x: number; z: number; heading: number; speed: number; }

export interface PhysicsEngine {
  stepVehicle(state: VehicleState, throttle: number, steering: number, handbrake: boolean, deltaTime: number): VehicleState;
  distanceSquared(ax: number, az: number, bx: number, bz: number): number;
  collideAabb(x: number, z: number, radius: number, boxX: number, boxZ: number, halfW: number, halfD: number): boolean;
  resolveAabb(x: number, z: number, radius: number, boxX: number, boxZ: number, halfW: number, halfD: number): { x: number; z: number };
  stepPedestrian(state: PedState, targetX: number, targetZ: number, threatX: number, threatZ: number, flee: boolean, walkSpeed: number, deltaTime: number): PedState;
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
    if (!out4 || !out2) throw new Error("Could not allocate WASM physics buffers.");
    const read4 = (): VehicleState => {
      const i = out4 / Float64Array.BYTES_PER_ELEMENT; const h = module.HEAPF64;
      return { x: h[i], z: h[i + 1], heading: h[i + 2], speed: h[i + 3] };
    };
    return {
      source: "wasm",
      distanceSquared(ax, az, bx, bz) { return distance(ax, az, bx, bz) as number; },
      stepVehicle(state, throttle, steering, handbrake, deltaTime) {
        step(state.x, state.z, state.heading, state.speed, throttle, steering, handbrake ? 1 : 0, deltaTime, out4);
        return read4();
      },
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
