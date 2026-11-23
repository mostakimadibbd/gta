// Harborfall — embedded CC0 textures (Phase 5, Step 4b).
// Real photographed PBR maps from Poly Haven (CC0 — see ASSETS_LICENSES.md),
// downscaled + WebP-encoded and embedded as data URIs so the snapshot push
// (UTF-8 text only) can ship them. Hard budget: total <= 1.2 MB, single
// map <= 350 KB (see CC0_TOTAL_BYTES). Medium tier runtime-downscales to
// 512px canvases; High uses them as-is (768-1024px). Low never loads these.
// Phase 12: the data URIs themselves live in ./cc0Data, loaded via a
// dynamic import on first request — they no longer ship in the initial
// bundle. The decode contract is unchanged: textures are shared objects
// that fill in when their image lands.
import * as THREE from "three";

// ---- Phase 12: async CC0 data chunk (see ./cc0Data) ----
let uriMap: Record<string, string> | null = null;
let uriLoad: Promise<Record<string, string>> | null = null;
function loadUris(): Promise<Record<string, string>> {
  if (!uriLoad) uriLoad = import("./cc0Data").then((m) => (uriMap = m.CC0_URIS));
  return uriLoad;
}


export const CC0_TOTAL_BYTES = 955200;


/** Poly Haven asset ids per surface, for credit/debugging. */
export const CC0_ASSETS = {
  asphalt: "asphalt_04",
  concrete: "concrete_pavement",
  brick: "brick_wall_04",
  plaster: "plastered_wall_02",
} as const;
export type Cc0Surface = keyof typeof CC0_ASSETS;
export type Cc0MapKind = "diff" | "nor" | "rough";

const texCache = new Map<string, THREE.Texture>();

// ---- Phase 6 first-load order: on Low/Medium the CC0 decode is DEFERRED
// until after spawn-in (App calls setCc0Deferred(false) when the game
// starts), so first paint reaches playable fastest. Textures are shared
// objects — when the deferred load lands they update in place. High
// never defers (it preloads during the loading screen).
let cc0Deferred = false;
const pendingLoads: Array<() => void> = [];
export function setCc0Deferred(v: boolean) {
  cc0Deferred = v;
  if (!v) { const q = pendingLoads.splice(0); for (const fn of q) fn(); }
}

/**
 * Load an embedded CC0 map as a THREE.Texture. `px` is the decode size:
 * 0 = native (High), 512 = downscaled via canvas (Medium). Colour maps get
 * SRGB; normal/roughness stay linear. Cached per (name, px).
 */
export function cc0Texture(surface: Cc0Surface, kind: Cc0MapKind, px: number, variant = ""): THREE.Texture {
  const name = surface + (kind === "diff" ? "Diff" : kind === "nor" ? "Nor" : "Rough");
  const cacheKey = name + "@" + px + variant;
  const hit = texCache.get(cacheKey);
  if (hit) return hit;
  const tex = new THREE.Texture();
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (kind === "diff") tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const img = new Image();
  img.onload = () => {
    if (px > 0 && (img.width > px || img.height > px)) {
      const c = document.createElement("canvas");
      c.width = px; c.height = px;
      const ctx = c.getContext("2d");
      if (ctx) { ctx.drawImage(img, 0, 0, px, px); tex.image = c; }
      else tex.image = img;
    } else tex.image = img;
    tex.needsUpdate = true;
  };
  const start = () => {
    if (uriMap) img.src = uriMap[name];
    else void loadUris().then((uris) => { img.src = uris[name]; });
  };
  if (cc0Deferred) pendingLoads.push(start); else start();
  texCache.set(cacheKey, tex);
  return tex;
}
