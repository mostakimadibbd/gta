// Harborfall — Phase 8: standard-mapping gamepad support.
// A single rAF poller (started on the first `gamepadconnected`) folds the
// pad into the SAME input channels the keyboard/touch already use:
//   · padKeys — a Set of virtual keys ("w"/"a"/"s"/"d"/"shift"/" ") that
//     Player.tsx and Vehicle.tsx merge with their keyboard sets each frame
//   · padSteer / padThrottle — analog axes for Vehicle (last-input-wins:
//     a touched keyboard key overrides the stick for that frame, exactly
//     like gyro steering already yields to keys)
//   · padCam — accumulated right-stick orbit deltas, consumed by App's
//     CameraRig (mouse drag still works; whichever moved last wins)
//   · buttons are edge-detected and re-dispatched as the real keyboard
//     events the game already listens for (A→E interact, B→F exit / Esc
//     back, Y→U phone, LB→Q weapon cycle, RB→B horn) — so gamepad can
//     never drift out of sync with keyboard behaviour.
import { G, toast } from "./store";

export const padKeys = new Set<string>();
export const padAxes = { steer: 0, throttle: 0 };
export const padCam = { yaw: 0, pitch: 0 };
/** Analog on-foot move vector (post-deadzone, expo-curved): x = strafe
 * right, y = down/back, mag 0..1. Player blends walk→run by mag and
 * latches sprint above 0.92. */
export const padMove = { x: 0, y: 0, mag: 0 };
export let padConnected = false;

const DEAD = 0.18;
const dz = (v: number) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));
let started = false;
const prevButtons = new Map<number, boolean>();

function keyEvent(type: "keydown" | "keyup", key: string) {
  window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
}
function press(key: string) {
  keyEvent("keydown", key);
  window.setTimeout(() => keyEvent("keyup", key), 60);
}

function poll() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let pad: Gamepad | null = null;
  for (const p of pads) if (p && p.connected) { pad = p; break; }
  if (pad) {
    const b = (i: number) => !!pad!.buttons[i]?.pressed;
    const bv = (i: number) => pad!.buttons[i]?.value ?? 0;
    // ---- left stick → movement keys + analog steer/throttle ----
    const lx = dz(pad.axes[0] ?? 0), ly = dz(pad.axes[1] ?? 0);
    { // analog move vector with a gentle expo curve (mag^1.35)
      const rawMag = Math.min(1, Math.hypot(lx, ly));
      const curved = Math.pow(rawMag, 1.35);
      padMove.mag = curved;
      padMove.x = rawMag > 0 ? (lx / rawMag) * curved : 0;
      padMove.y = rawMag > 0 ? (ly / rawMag) * curved : 0;
    }
    padKeys.clear();
    if (ly < -0.25 || b(12)) padKeys.add("w");
    if (ly > 0.25 || b(13)) padKeys.add("s");
    if (lx < -0.25 || b(14)) padKeys.add("a");
    if (lx > 0.25 || b(15)) padKeys.add("d");
    if (b(10)) padKeys.add("shift"); // L3 sprint
    if (b(2)) padKeys.add(" "); // X held — handbrake in a car (jump is its edge, below)
    padAxes.steer = -lx;
    // triggers: RT (7) accelerates, LT (6) brakes/reverses
    padAxes.throttle = bv(7) - bv(6);
    if (padAxes.throttle > 0.15) padKeys.add("w");
    if (padAxes.throttle < -0.15) padKeys.add("s");
    // ---- right stick → camera orbit deltas ----
    const rx = dz(pad.axes[2] ?? 0), ry = dz(pad.axes[3] ?? 0);
    if (rx) padCam.yaw -= rx * 0.055;
    if (ry) padCam.pitch += ry * 0.03;
    // ---- edge-detected buttons → the game's own key events ----
    const edges: Record<number, () => void> = {
      0: () => press("e"),                    // A — interact / enter / advance dialogue
      1: () => press(G.driving ? "f" : "Escape"), // B — exit car / back
      2: () => { if (!G.driving) press(" "); },   // X — jump / vault / dive on foot
      3: () => press("u"),                    // Y — phone
      4: () => press("q"),                    // LB — weapon cycle
      5: () => press("b"),                    // RB — horn (driving)
      9: () => press("Escape"),               // Start — pause
    };
    for (const [idxS, fn] of Object.entries(edges)) {
      const idx = Number(idxS);
      const now = b(idx);
      if (now && !prevButtons.get(idx) && !(idx === 0 && G.driving)) fn();
      prevButtons.set(idx, now);
    }
  } else {
    padKeys.clear();
    padAxes.steer = 0; padAxes.throttle = 0;
    padMove.x = 0; padMove.y = 0; padMove.mag = 0;
  }
  requestAnimationFrame(poll);
}

export function initGamepad() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("gamepadconnected", (e) => {
    padConnected = true;
    toast(`🎮 Gamepad connected (${e.gamepad.id.slice(0, 28)}) — layout in Help (H). Left stick moves, right stick orbits the camera.`);
  });
  window.addEventListener("gamepaddisconnected", () => { padConnected = false; toast("🎮 Gamepad disconnected — keyboard/touch still live."); });
  requestAnimationFrame(poll);
}
initGamepad();
