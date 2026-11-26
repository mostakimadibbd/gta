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
import { setTier, sampleIfHighRaised, type QualityTier } from "./quality";

export const perf = {
  fps: 0,          // last 1 s average (HUD readout + governor input)
  dpr: 0,          // current dynamic pixel ratio (0 = not yet applied)
  autoDrop: true,  // session flag; manual tier picks turn this off
};

// ---- Phase 14 stability caps (user play-test 2026-11-23: HIGH on a
// Retina Mac crashed to black at 2.7 GB tab RAM). DPR 2 on a Retina
// display is a ~5K-class drawing buffer; the composer, SSR G-buffer,
// SSAO and the planar-water mirror all scale off it, so the whole
// stack multiplied. The ladder now tops out at 1.5: High = 1.5,
// Medium = 1.35, Low = 1.25 (Phase 45: Low's cap is 1.0 — see
// tierDprCap below). The governor still walks DPR down FIRST
// (autoDrop only gates the TIER lever below — manualTier never
// disables DPR adaptation), so a manual High stays smooth by
// shedding pixels before anything else. ----
// Phase 15: the ladder gains a 1.0 floor — under sustained load the
// governor may now shed resolution to native 1.0 before any tier drop
// is considered (caps per tier unchanged).
export const DPR_LADDER = [1.0, 1.1, 1.25, 1.35, 1.5];
// Phase 45: the Low cap drops from 1.25 to 1.0 — as a preset for
// weak phones, Low now renders at native resolution at most (a
// 1.25 cap costs ~56% more fragments than 1.0 for no gameplay
// gain). The governor already treats the tier cap as a hard
// ceiling (PerfGovernor clamps its ladder index to it), so the
// preset and the governor cannot fight: the governor only ever
// walks DOWN from the cap.
export const tierDprCap = (t: QualityTier) => (t === "high" ? 1.5 : t === "medium" ? 1.35 : 1.0);

/** Manual tier choice (pause Graphics / phone Settings): respect it —
 * the governor stops auto-dropping the TIER for the rest of the
 * session. DPR adaptation above stays live either way. */
export function manualTier(t: QualityTier) {
  perf.autoDrop = false;
  setTier(t);
  // Phase 15: a manual raise to High is sample-checked once (2 s);
  // if the machine sustains <30 FPS it steps back down with a toast.
  if (t === "high") sampleIfHighRaised();
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

/** Phase 11: the active reflection pipeline, as shown in Pause →
 * Graphics and Phone → Settings. This is a readout of tier + the
 * player's reflFx override, not a separate quality axis:
 *   off        — Low tier, or the override is off (only the static
 *                PMREM probe tints materials; no dynamic reflections)
 *   standard   — Medium: PMREM sky probe + fresnel shader water
 *   raytraced  — High + override on: screen-space reflections on
 *                glossy surfaces + planar-reflection bay water.
 * "Ray-traced-style" is the honest label: a browser has no hardware
 * ray tracing; SSR + planar mirrors are what the look is built from. */
export type ReflectionMode = "off" | "standard" | "raytraced";
export function reflectionMode(): ReflectionMode {
  if (!G.settings.reflFx) return "off";
  const t = G.settings.quality;
  return t === "high" ? "raytraced" : t === "medium" ? "standard" : "off";
}
export const REFLECTION_LABEL: Record<ReflectionMode, string> = {
  off: "Off",
  standard: "Standard",
  raytraced: "Ray-traced-style",
};
/** Player override for the High-tier reflection stack. Persisted like
 * every other setting; App polls G.settings.reflFx into React state
 * (same pattern as postFx) so the composer + water swap live. */
export function setReflFx(on: boolean) {
  G.settings.reflFx = on;
  persistSettings();
}

/** "Show FPS" lives in the persisted settings object. */
export function setShowFps(on: boolean) {
  (G.settings as { showFps?: boolean }).showFps = on;
  persistSettings();
}
export const showFps = () => !!(G.settings as { showFps?: boolean }).showFps;

/** Phase 12: FIXED-TIMESTEP SIMULATION. The three movement/physics
 * integrators — the player step (Player.tsx), the driven-car step
 * (Vehicle.tsx) and the world step for traffic/peds/cops
 * (GameSystems.tsx) — run at a fixed 60 Hz from a per-component
 * accumulator instead of on the raw variable frame dt:
 *   - gameplay speed/feel is identical at 30/60/120 Hz displays,
 *   - a frame spike can no longer tunnel a collision (each substep
 *     integrates at most 1/60 s of motion),
 *   - the accumulator is pre-clamped to MAX_SUBSTEPS steps and any
 *     leftover debt is dropped, so a hitch costs a slow-motion beat,
 *     never a spiral of death.
 * Rendering interpolation is deliberately NOT layered on top: it
 * would require duplicating every entity's transform state per
 * frame. At a 60 Hz sim on a 120 Hz display the worst-case visual
 * step is one sim tick (~16 ms) — the same cadence the game shipped
 * with on 60 Hz screens. Auxiliary systems (weapons presentation,
 * jobs, phone) keep their clamped variable dt: they integrate no
 * positions that can tunnel. */
export const SIM_STEP = 1 / 60;
export const SIM_MAX_SUBSTEPS = 3;

/** Phase 16: PLAYER PERFORMANCE LEVERS (G.settings, persisted per
 * slot, read live — no reload). "normal" is exactly the pre-Phase-16
 * behaviour everywhere:
 *  · trafficDensity — the share of the AMBIENT traffic pool that
 *    activates (Low 50%, Normal 100%, High 100% + the rush-hour
 *    reserve never parks). Service units, the bus and taxis are
 *    exempt (jobs/dispatch depend on them), as are dispatched units,
 *    wrecks, and any car within 25u of the player (nothing pops out
 *    of existence in front of you).
 *  · pedDensity — a multiplier on the time-of-day crowd fraction
 *    (Low ×0.5, Normal ×1, High ×1.35, capped at 1). Downed peds and
 *    the reporting witness are never density-culled.
 *  · viewDistance — scales the streaming activation radii (traffic
 *    dormancy 165/140u, ped hold 170u) and the fog distances:
 *    Near ×0.65 streaming / ×0.78 fog, Normal ×1, Far ×1.45 / ×1.3. */
// Phase 45: the Low quality preset ALSO caps these levers — on
// Low, ambient traffic activates at most 50% and the crowd factor
// at most ×0.5 whatever the density levers say (the preset is a
// ceiling, exactly like the DPR cap; a player who wants more
// traffic on a weak phone raises the tier, not the lever). On
// Medium/High the formulas are the pre-Phase-45 ones verbatim.
export const trafficDensityShare = () => {
  const lever = G.settings.trafficDensity === "low" ? 0.5 : 1;
  return G.settings.quality === "low" ? Math.min(lever, 0.5) : lever;
};
export const pedDensityFactor = () => {
  const lever = G.settings.pedDensity === "low" ? 0.5 : G.settings.pedDensity === "high" ? 1.35 : 1;
  return G.settings.quality === "low" ? Math.min(lever, 0.5) : lever;
};
/** Phase 46 audit: the rush-hour RESERVE's park/unpark decision
 * (GameSystems) is a second consumer of the traffic lever that
 * Phase 45's ceiling didn't reach — it read G.settings directly,
 * so on Low with the lever on High the reserve cars inside the
 * active share never parked off-peak, against the preset's
 * "ceiling whatever the levers say" rule. The active-count ceiling
 * itself was never bypassed (the density gate dormants beyond-
 * share cars earlier in the same step), but the reserve behaviour
 * now honours the same ceiling through here: on Low the reserve
 * parks off-peak like Normal. Medium/High are unchanged. */
export const trafficReserveAlwaysOut = () =>
  G.settings.trafficDensity === "high" && G.settings.quality !== "low";
export const viewStreamScale = () =>
  G.settings.viewDistance === "near" ? 0.65 : G.settings.viewDistance === "far" ? 1.45 : 1;
export const viewFogScale = () =>
  G.settings.viewDistance === "near" ? 0.78 : G.settings.viewDistance === "far" ? 1.3 : 1;
