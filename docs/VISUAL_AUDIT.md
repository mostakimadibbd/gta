# Harborfall — Visual Audit (Visual Upgrade work order, V1)

*An honest audit of how the game looks, why it read as "cartoon", what has
been done about it, and what is genuinely out of reach in this stack.
Companion to the work order "Open-World Game: Complete Visual Realism &
UI Upgrade" (user-issued, 11 sections).*

## Engine / pipeline summary

- **Renderer:** Three.js via React Three Fiber, WebGL2. ACES filmic tone
  mapping, PCF-soft shadow map (2048) from a sun light that follows the
  player, PMREM environment map for reflections.
- **Post (desktop only):** EffectComposer — Bloom (0.55), warm
  hue/contrast grade, film grain, vignette, SMAA. Disabled entirely on
  coarse-pointer (touch) devices for frame rate.
- **Assets:** zero binary asset files. Every texture is drawn on a canvas
  at runtime (`client/src/textures.ts`); every building, car and person is
  assembled from primitives (boxes, rounded boxes, cylinders) in code.
  Physics is a C++17 core compiled to WASM with an exact TypeScript
  mirror; gameplay/AI is TypeScript.
- **Performance shape:** buildings/roads/props are heavily instanced
  (single draw calls per material family); the whole of Port Sable +
  Coral Shores renders in a few hundred draw calls.

## Why the game read as "cartoon" (root causes)

1. **Flat surfaces.** Until this round, materials had colour maps only —
   no normal maps, no roughness variation. A wall lit by the sun returned
   one flat tone, which the eye reads as painted/plastic.
2. **Primitive geometry origins.** Cars and buildings began as plain
   boxes with hard 90° edges; real objects have bevels, panel gaps and
   layered detail. (Partly fixed in Phase 3: RoundedBox car bodies,
   facade layering.)
3. **Texture resolution + repetition.** Canvas textures are 256–512px;
   at close range they soften, and tiled repetition is visible on long
   roads.
4. **Saturated, even lighting.** Early builds used bright ambient fill
   and saturated palette colours with no film grade — the classic
   "mobile game" read. (Fixed across Phases 2–3: golden-hour key light,
   deeper palette, ACES + grade.)
5. **No weathering.** Clean surfaces everywhere: no grime, dust, tyre
   marks or water staining, so nothing looked lived-in.
6. **UI language.** Chunky bordered panels, bright accent fills, heavy
   font weights — the HUD framed the 3D world in a toy-like chrome.

## What Phases 2–3 already fixed (techniques)

- Golden-hour opening light, ACES tone mapping, 2048px sun shadows that
  *follow the player* (the original "no shadows" bug was a static shadow
  camera at the world origin).
- Rebuilt vegetation (curved palm trunks, feathered fronds), deeper
  coastal palette (teal/amber), glossy car paint with env reflections,
  wet-look night roads, streetlight halos, police light-bar glow with
  real point lights.
- Phase 3: cars rebuilt on `RoundedBox` (sloped hoods, curved cabins,
  wheel-arch insets); facade detail system (pane-gradient windows with
  lit/blind variance, cornices, canopies, wall AC units, balconies);
  ground detail (grass tufts, road arrows, oil stains, puddles); Bloom +
  vignette + grain + SMAA grade; far skyline silhouette ring.

## What this round adds (Phase 4 / Visual V2–V7)

- **V2 — Procedural normal + roughness maps.** A canvas height→normal
  generator (Sobel) now produces normal maps for asphalt, concrete,
  brick, glass and plain facades, sand and grass, plus roughness
  variation maps for asphalt/concrete. Surfaces catch light
  directionally instead of reading flat — the single biggest texture
  upgrade available in this stack.
- **V3 — Weathering.** Facade canvases gained heavier grime: 44 vertical
  streak runs, water stains under sills, dark under-seam bands, deeper
  baked AO at bases and around windows. Cars get a damage-linked dirt
  shell (dust/scratch alpha texture whose opacity tracks damage 12→100).
  Intersection corners gained instanced tyre-mark decals.
- **V4 — Vehicle interiors + animation.** Dashboard, headliner, seats
  and rear bench inside every car, visible through clearer glass (and a
  procedural shattered-glass texture after a break-in). The steering
  wheel rotates with steering input on the player's car; front wheels
  steer visually on all cars; body pitch/roll come from the C++
  weight-transfer outputs.
- **V5 — Environment motion.** The bay water is one large sheet with a
  drifting procedural normal map + emissive shimmer; palm crowns sway
  gently within 65u of the player.
- **V6 — UI completions.** Mission debrief panel (complete/failed with
  reward lines), Q/Tab weapon selector chip, slim right-side toasts,
  and one coherent Settings list (shake, FOV, Post FX, shadows) in both
  the pause menu and the phone.
- **V7 — LOD/perf.** Peds beyond 120u animate every 3rd frame. Props,
  tufts and decals are single instanced draws and frustum-culled, so
  district chunk toggles were measured unnecessary. Coral Shores reuses
  the same instanced builders (~23 buildings, 6 traffic, 6 peds added).

## UI audit (work order §6)

The HUD and menus were rebuilt on one material — dark glass
(`rgba(10,14,16,.82)`, backdrop blur, 1px `rgba(255,255,255,.08)`
hairline, 10px radius), thin type (500/600 weights, letterspaced
micro-labels, tabular numerals), amber used only as a hairline accent.
Removed: chunky yellow buttons, bright green cash text, thick accent
borders, toy-like side panel. The phone is now a near-black handset with
a notch, live game-clock status bar and glass icon tiles.

## What remains genuinely out of reach in a browser build

Stated plainly, per the honesty rule that has governed this project:

- **Photoreal scanned assets** (photogrammetry buildings, scanned PBR
  material libraries, motion-captured humans) — these are multi-GB
  binary asset pipelines; Harborfall ships instantly from a web page
  with zero asset files, by design.
- **True global illumination / ray tracing** — WebGL2 in this stack has
  no production GI path; we fake depth with baked AO, env reflections
  and the film grade.
- **Unreal Engine 5-class rendering** — declined by design (see
  BLUEPRINT §13): it cannot ship as an instant-play browser game on
  free hosting, which is Harborfall's distribution model.

The honest target remains **realistic-styled**: real proportions,
textured PBR-ish materials, filmic light, lived-in weathering — not
photoreal.

## Asset register (work order §8 compliance)

All textures and models in Harborfall are **procedural and original**:
canvas-generated textures, code-built geometry, an original city
(Port Sable / Coral Shores), original characters, original vehicle
designs and names, and an original composed soundtrack ("Port Sable
Sunset"). The loading-screen poster panels are crops of the user's own
supplied mood-board collage, used as a menu backdrop only — they are
not game models or textures. **No third-party or AI-generated assets
are used as game models.** No Rockstar/GTA assets, names, maps or
logos appear anywhere in the game.
