// Harborfall — Phase 8 graphics-smoothness governor (state only; the
// sampler component lives in App.tsx where the R3F gl handle is).
//
// Two independent levers, both biased toward a stable frame rate:
//  1. DYNAMIC RESOLUTION — the renderer pixel ratio walks a ladder
//     (1.1 → 2) toward the tier cap, stepping DOWN fast when the 1 s
//     average FPS drops under 47 and back UP only after 5 s above 57
//     (hysteresis + ≥2.5 s between steps, so it cannot oscillate).
//  2. ADAPTIVE TIER — if gameplay sustains < 40 FPS for 8 s, the
//     quality tier drops ONE notch (never below Low, never auto-up).
//     Picking a tier manually (pause menu / phone) sets autoDrop=false
//     for the session: the player's choice outranks the governor.
import { G, toast, persistSettings } from "./store";
import { setTier, type QualityTier } from "./quality";

export const perf = {
  fps: 0,          // last 1 s average (HUD readout + governor input)
  dpr: 0,          // current dynamic pixel ratio (0 = not yet applied)
  autoDrop: true,  // session flag; manual tier picks turn this off
};

export const DPR_LADDER = [1.1, 1.25, 1.5, 1.75, 2];
export const tierDprCap = (t: QualityTier) => (t === "high" ? 2 : t === "medium" ? 1.5 : 1.25);

/** Manual tier choice (pause Graphics / phone Settings): respect it —
 * the governor stops auto-dropping for the rest of the session. */
export function manualTier(t: QualityTier) {
  perf.autoDrop = false;
  setTier(t);
}

/** One adaptive step down, with the subtitle-style toast. */
export function autoDropTier(): boolean {
  const cur = G.settings.quality;
  if (cur === "low" || !perf.autoDrop) return false;
  const next: QualityTier = cur === "high" ? "medium" : "low";
  setTier(next);
  toast(`Graphics adjusted for smoothness — now ${next.toUpperCase()}. Change anytime in Settings.`);
  return true;
}

/** "Show FPS" lives in the persisted settings object. */
export function setShowFps(on: boolean) {
  (G.settings as { showFps?: boolean }).showFps = on;
  persistSettings();
}
export const showFps = () => !!(G.settings as { showFps?: boolean }).showFps;
