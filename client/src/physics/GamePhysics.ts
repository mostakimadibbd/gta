export interface VehicleState {
  x: number;
  z: number;
  heading: number;
  speed: number;
}

export interface PhysicsEngine {
  stepVehicle(state: VehicleState, throttle: number, steering: number, handbrake: boolean, deltaTime: number): VehicleState;
  distanceSquared(ax: number, az: number, bx: number, bz: number): number;
  source: "wasm" | "typescript";
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, high));

export const fallbackPhysics: PhysicsEngine = {
  source: "typescript",
  distanceSquared(ax, az, bx, bz) {
    return (ax - bx) ** 2 + (az - bz) ** 2;
  },
  stepVehicle(state, throttle, steering, handbrake, deltaTime) {
    const dt = clamp(deltaTime, 0, 0.1);
    const gas = clamp(throttle, -1, 1);
    const steer = clamp(steering, -1, 1);
    let speed = state.speed + gas * (gas >= 0 ? 18 : 8) * dt;
    speed *= Math.max(0, 1 - (handbrake ? 5.5 : 0.65) * dt);
    speed = clamp(speed, -8, 24);
    const speedFactor = clamp(Math.abs(speed) / 4, 0.18, 1);
    const driftFactor = handbrake ? 0.62 : 1;
    let heading = state.heading + steer * 2.2 * speedFactor * driftFactor * dt * (speed < 0 ? -1 : 1);
    heading = Math.atan2(Math.sin(heading), Math.cos(heading));
    return {
      x: state.x + Math.sin(heading) * speed * dt,
      z: state.z + Math.cos(heading) * speed * dt,
      heading,
      speed,
    };
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
    const outputPointer = module._malloc(4 * Float64Array.BYTES_PER_ELEMENT);
    if (!outputPointer) throw new Error("Could not allocate WebAssembly physics output buffer.");

    return {
      source: "wasm",
      distanceSquared(ax, az, bx, bz) {
        return distance(ax, az, bx, bz) as number;
      },
      stepVehicle(state, throttle, steering, handbrake, deltaTime) {
        step(
          state.x,
          state.z,
          state.heading,
          state.speed,
          throttle,
          steering,
          handbrake ? 1 : 0,
          deltaTime,
          outputPointer,
        );
        const outputIndex = outputPointer / Float64Array.BYTES_PER_ELEMENT;
        const heap = module.HEAPF64;
        return {
          x: heap[outputIndex],
          z: heap[outputIndex + 1],
          heading: heap[outputIndex + 2],
          speed: heap[outputIndex + 3],
        };
      },
    };
  } catch (error) {
    console.warn("WebAssembly physics unavailable; using the TypeScript fallback.", error);
    return fallbackPhysics;
  }
}
