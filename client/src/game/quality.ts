// Harborfall — Phase 5 quality tiers (Step 2 of the realistic-visuals spec).
// ONE module owns the tier: detection, the one-time FPS step-down, and every
// gate the renderers consult. App / World / GameSystems / textures read from
// here (via G.settings.quality) so the tier can never drift between systems.
//
//   Low    — composer OFF, 1024 shadows, no normal maps, flat water sheet,
//            procedural canvas textures only (CC0 off), standard car paint.
//   Medium — composer (Bloom/SMAA/Vignette/Noise + Phase 10 radial
//            chromatic aberration), 2048 follow shadows,
//            normal maps on, CC0 textures at 512, water shader, clearcoat.
//   High   — Medium + SSAO, stronger bloom, CC0 at native (768–1024),
//            softer shadow radius, full water shader. Phase 11: + the
//            ray-traced-STYLE reflection stack (screen-space reflections
//            + planar-reflection water) when the player override allows.
import { G, persistSettings, toast } from "./store";
import { setTextureAnisotropy } from "../textures";

export type QualityTier = "low" | "medium" | "high";
export const TIERS: QualityTier[] = ["low", "medium", "high"];

export const tier = (): QualityTier => G.settings.quality;

/** First-run / pre-Phase-5-save detection. Never called once quality is saved. */
export function detectTier(): QualityTier {
  try {
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const small = Math.min(window.innerWidth, window.innerHeight) < 520;
    const nav = navigator as Navigator & { deviceMemory?: number };
    // Phase 15 playability: deviceMemory is ABSENT on Safari/Firefox —
    // the old `?? 8` default handed HIGH to every desktop that didn't
    // report it, including modest laptops (the "not properly playable"
    // report). High now requires POSITIVE strong signals: a reported
    // deviceMemory ≥ 8 AND ≥ 8 cores AND a fine pointer. Anything
    // unreported or weaker starts at Medium (the governor + the
    // one-time FPS sample still protect it from there, and the player
    // can raise it manually — the raise is sample-checked, below).
    const mem = nav.deviceMemory;
    const cores = navigator.hardwareConcurrency ?? 0;
    if ((coarse && small) || (mem !== undefined && mem <= 2)) return "low";
    if (!coarse && mem !== undefined && mem >= 8 && cores >= 8) return "high";
    return "medium";
  } catch { return "medium"; }
}

/** Run detection only when the saved settings predate the quality field. */
export function initQuality() {
  try {
    const raw = localStorage.getItem("harborfall-settings");
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    if (!parsed || !("quality" in parsed)) {
      G.settings.quality = detectTier();
      persistSettings();
    }
  } catch { /* storage unavailable — keep default */ }
  setTextureAnisotropy(G.settings.quality === "high" ? 8 : 4);
}

export function setTier(t: QualityTier) {
  G.settings.quality = t;
  setTextureAnisotropy(t === "high" ? 8 : 4); // Phase 8: anisotropy by tier
  persistSettings();
}

// ---- one-time FPS sample: 2.5 s after the game starts; can step DOWN once,
// never up, never twice in a session -------------------------------------
let sampled = false;
function sampleFps(ms: number, onDone: (fps: number) => void) {
  let frames = 0;
  const t0 = performance.now();
  const loop = () => {
    frames++;
    const el = performance.now() - t0;
    if (el < ms) { requestAnimationFrame(loop); return; }
    onDone(frames / (el / 1000));
  };
  requestAnimationFrame(loop);
}
export function runFpsSampleOnce() {
  if (sampled) return;
  sampled = true;
  sampleFps(2500, (fps) => {
    const cur = tier();
    if (fps < 27 && cur !== "low") setTier(cur === "high" ? "medium" : "low");
    else if (fps < 42 && cur === "high") setTier("medium");
  });
}

// ---- Phase 15: when the player MANUALLY raises the tier to High, run
// one lightweight 2 s sample (once per raise); if High sustains under
// 30 FPS it steps back to Medium with the standard smoothness toast.
// The PerfGovernor's DPR lever keeps working either way — this only
// catches machines where even the DPR floor can't save High. --------
let highSampleBusy = false;
export function sampleIfHighRaised() {
  if (highSampleBusy || tier() !== "high") return;
  highSampleBusy = true;
  sampleFps(2000, (fps) => {
    highSampleBusy = false;
    if (tier() === "high" && fps < 30) {
      setTier("medium");
      toast("Graphics adjusted for smoothness — now MEDIUM. Change anytime in Settings.");
    }
  });
}

// ---- gates (single source of truth) --------------------------------------
export const gates = {
  composer: (t: QualityTier) => t !== "low",
  ssao: (t: QualityTier) => t === "high",
  shadowMapSize: (t: QualityTier) => (t === "low" ? 1024 : 2048),
  shadowRadius: (t: QualityTier) => (t === "high" ? 4 : 1),
  normalMaps: (t: QualityTier) => t !== "low",
  cc0: (t: QualityTier) => t !== "low",
  /** CC0 decode size: 768 on High (Phase 14 RAM cap — native-size
   * photo textures were a real slice of the 2.7 GB tab; 768 still
   * reads photographic at street distance), 512 on Medium. */
  cc0Px: (t: QualityTier) => (t === "high" ? 768 : 512),
  waterShader: (t: QualityTier) => t !== "low",
  clearcoat: (t: QualityTier) => t !== "low",
  bloom: (t: QualityTier) => (t === "high" ? 0.75 : 0.55),
  // ---- Phase 11 reflections: the two expensive dynamic techniques are
  // High-only AND respect the player's reflFx override (game/perf.ts
  // owns the mode label). SSR follows the DPR ladder automatically
  // because the composer renders at canvas size; the planar water
  // renders its mirrored scene at 0.5× the drawing buffer.
  ssr: (t: QualityTier) => t === "high",
  planarWater: (t: QualityTier) => t === "high",
  /** Static-probe (PMREM) reflection strength scale per tier, applied
   * at material creation: glass towers + car paint/glass read this so
   * the probe reflections step with the tier like everything else. */
  envRefl: (t: QualityTier) => (t === "high" ? 1.15 : t === "medium" ? 1.0 : 0.8),
};
