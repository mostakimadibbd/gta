// Harborfall — gyroscope tilt steering (Phase 4, touch devices).
// Steering only: throttle/brake stay on the touch buttons. The module keeps
// a smoothed steer value in [-1, 1]; Vehicle.tsx reads gyroSteer() each
// frame and touch steer buttons override while pressed.
//
// Permission flow: iOS requires DeviceOrientationEvent.requestPermission()
// inside a user-gesture handler — TouchControls calls enableGyro() from its
// toggle tap. Android/Chrome starts listening directly. The neutral angle
// is captured at enable time; toggling off/on recalibrates.
import { toast } from "./store";

let enabled = false;
let listening = false;
let neutral = 0;
let calibrated = false;
let rawTilt = 0; // degrees from neutral, on the active steer axis
let smooth = 0;

const DEADZONE = 4; // degrees
const FULL_TILT = 26; // degrees of tilt for full lock

function onOrientation(e: DeviceOrientationEvent) {
  if (!enabled) return;
  // Axis swap: portrait → gamma (left/right tilt); landscape → beta.
  const landscape = typeof screen !== "undefined" && screen.orientation
    ? Math.abs(screen.orientation.angle) === 90
    : window.innerWidth > window.innerHeight;
  const axis = landscape ? e.beta : e.gamma;
  if (axis === null || axis === undefined) return;
  if (!calibrated) { neutral = axis; calibrated = true; }
  rawTilt = axis - neutral;
}

function startListening() {
  if (listening) return;
  window.addEventListener("deviceorientation", onOrientation);
  listening = true;
}

export function gyroEnabled() { return enabled; }

/** Smoothed steering in [-1, 1] (call once per frame; applies smoothing). */
export function gyroSteer(): number {
  if (!enabled) { smooth = 0; return 0; }
  const mag = Math.abs(rawTilt);
  const target = mag < DEADZONE ? 0 : Math.sign(rawTilt) * Math.min(1, (mag - DEADZONE) / (FULL_TILT - DEADZONE));
  smooth += (target - smooth) * 0.18;
  return smooth;
}

/** Subtle first-person camera yaw trim in radians (±~10°), on-foot only. */
export function gyroYawTrim(): number {
  if (!enabled) return 0;
  const mag = Math.abs(rawTilt);
  if (mag < DEADZONE) return 0;
  return Math.sign(rawTilt) * Math.min(1, (mag - DEADZONE) / FULL_TILT) * 0.17;
}

/** Toggle from a user tap (required for the iOS permission prompt). */
export async function toggleGyro(): Promise<boolean> {
  if (enabled) {
    enabled = false; calibrated = false; smooth = 0;
    try { localStorage.setItem("harborfall-gyro", "0"); } catch { /* ignore */ }
    toast("Gyro steering off");
    return false;
  }
  try {
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DOE.requestPermission === "function") {
      const res = await DOE.requestPermission();
      if (res !== "granted") { toast("Gyro unavailable or denied"); return false; }
    }
    enabled = true; calibrated = false; rawTilt = 0;
    startListening();
    try { localStorage.setItem("harborfall-gyro", "1"); } catch { /* ignore */ }
    toast("Gyro steering on — tilt to steer");
    return true;
  } catch {
    toast("Gyro unavailable or denied");
    return false;
  }
}

/** Whether the player previously chose gyro (listener re-arms on next tap). */
export function gyroPreferred(): boolean {
  try { return localStorage.getItem("harborfall-gyro") === "1"; } catch { return false; }
}
