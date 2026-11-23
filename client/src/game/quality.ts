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
import { G, persistSettings } from "./store";
import { setTextureAnisotropy } from "../textures";

export type QualityTier = "low" | "medium" | "high";
export const TIERS: QualityTier[] = ["low", "medium", "high"];

export const tier = (): QualityTier => G.settings.quality;

/** First-run / pre-Phase-5-save detection. Never called once quality is saved. */
export function detectTier(): QualityTier {
  try {
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const small = Math.min(window.innerWidth, window.innerHeight) < 520;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const cores = navigator.hardwareConcurrency ?? 8;
    if ((coarse && small) || mem <= 2) return "low";
    if (coarse || small || mem <= 4 || cores <= 4) return "medium";
    return "high";
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
export function runFpsSampleOnce() {
  if (sampled) return;
  sampled = true;
  let frames = 0;
  const t0 = performance.now();
  const loop = () => {
    frames++;
    const el = performance.now() - t0;
    if (el < 2500) { requestAnimationFrame(loop); return; }
    const fps = frames / (el / 1000);
    const cur = tier();
    if (fps < 27 && cur !== "low") setTier(cur === "high" ? "medium" : "low");
    else if (fps < 42 && cur === "high") setTier("medium");
  };
  requestAnimationFrame(loop);
}

// ---- gates (single source of truth) --------------------------------------
export const gates = {
  composer: (t: QualityTier) => t !== "low",
  ssao: (t: QualityTier) => t === "high",
  shadowMapSize: (t: QualityTier) => (t === "low" ? 1024 : 2048),
  shadowRadius: (t: QualityTier) => (t === "high" ? 4 : 1),
  normalMaps: (t: QualityTier) => t !== "low",
  cc0: (t: QualityTier) => t !== "low",
  /** CC0 decode size: 0 = native (High), 512 = Medium downscale. */
  cc0Px: (t: QualityTier) => (t === "high" ? 0 : 512),
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
