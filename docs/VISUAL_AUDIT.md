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

---

# Phase 5 addendum — Step 1 inventory (realistic-visuals spec)

*Where everything is built, how the five themes survive, the exact
dimension↔physics contract, and the measured/estimated performance
picture. Estimates are labelled; nothing here is dressed up as a
measurement it isn't.*

## File map — where each system is built

| System | File(s) | Notes |
|---|---|---|
| Renderer / Canvas / tone mapping | `client/src/App.tsx` | R3F Canvas, ACES 1.15 exposure, PCF-soft shadows, DPR 1–2 |
| Environment reflections | `App.tsx` `EnvSetup` + `textures.ts` `skyEnvTexture()` | Phase 5: PMREM from a procedural equirect sky (Med/High); RoomEnvironment (Low) |
| Lights | `components/GameSystems.tsx` | ambient + hemisphere + one directional sun, shadow camera follows the player, ±55u box |
| Sky dome / sun disc / clouds | `components/World.tsx` | gradient dome (Phase 5: horizon cloud band painted into the canvas), sun disc + glow sprite, 11 cloud sprites |
| Fog | `GameSystems.tsx` (scene.fog) + `components/Weather.tsx` (lerps near/far per weather) | linear fog, theme-driven |
| Water | `World.tsx` | Phase 5: custom ShaderMaterial (Med/High), Phase 4 sheet (Low) |
| Buildings / roads / ground | `World.tsx` + `world.ts` (data) + `textures.ts` / `cc0Textures.ts` (surfaces) | instanced props; per-material-family draws |
| Cars | `components/CarBody.tsx` (bodies), `Vehicle.tsx` (player fleet), `GameSystems.tsx` (traffic/police) | 10 kinds, RoundedBox sculpting |
| Characters | `humanoid.ts` (rig builder), `Player.tsx`, `GameSystems.tsx` (peds), `App.tsx` RemoteAvatar (multiplayer = simplified capsule rig, unchanged) | articulated primitive rigs, canvas faces |
| Police | `GameSystems.tsx` | LOS + last-known search, roadblocks, helicopter ≥4★ |
| Post-processing | `App.tsx` | EffectComposer gated by quality tier (Phase 5) |
| Quality tiers | `game/quality.ts` | ONE module: detection, FPS step-down, every gate |
| HUD / menus / subtitles | `App.tsx` + `styles.css` + `components/Phone.tsx` | Phase 5 redesign: one design system |

## Themes — how the 5 themes map and survive Phase 5

Each theme (`themes.ts`: Harbor Dusk, Midnight Patrol, Desert Gold,
Emerald Bay, Noir Mono) drives: sky/fog colour + fog near/far, sun
colour/intensity, ambient + hemisphere colours, water colour, window
glow, lamp glow, car accent, shirt colour, CSS variables, minimap
palette. Phase 5 changes **none** of that data. What changed is only
*how* two consumers read it:

- **Environment map:** the new equirect env is ONE neutral dusk-coast
  sky for all themes; each theme keeps its identity via
  `scene.environmentIntensity` per theme (dusk 0.55, midnight 0.25,
  desert 0.70, emerald 0.60, noir 0.30) and the visible dome is still
  tinted per theme exactly as before.
- **Water shader:** deep colour ← `theme.water`, sky tint ←
  `theme.sky`, glint colour ← `theme.sunColor`, fog ← the live scene
  fog (which Weather lerps). No theme can be broken by the shader; it
  has no hard-coded palette of its own beyond fallbacks.

## Dimension ↔ physics AABB contract (actual numbers from code)

Gameplay collision is 2D (x/z) AABBs and circles; visuals must fit
inside them. Any future glTF model (see SETUP_MANUAL.md) must fit the
same boxes or it will clip through walls it visually overlaps.

- **Buildings:** blocker = `width/2 × depth/2` AABB (`world.ts`
  `isBlocked` / `blockersNear`). Player-vs-wall test radius **1.3**
  while driving, **0.45** on foot.
- **Cars (visual w × len → collision circle radius):** sedan 2.0×3.7,
  hatch 1.9×3.15, coupe 2.0×3.9, pickup 2.1×4.1, van 2.1×4.2,
  supercar 2.2×4.3, muscle 2.05×4.4, SUV 2.1×4.2, classic 1.95×4.5 →
  parked-car collision circle **r = 1.55**; motorcycle (0.34 wheel r,
  ~1.9 long) → **r = 1.0**.
- **Characters:** ~1.85u tall rigs; ped separation and witness radii
  are point-based (crime witness radius 13u, cop +6u).
- **World bounds:** Port Sable ±118 (roads at −100…100, width 12),
  water from z = 128, Coral Shores x 28…112 / z 196…324, bridge deck
  at x = 60 (half-width ≈ 4.2, deck height 5.5), interiors pocketed at
  z ≈ −175.

## Bundle sizes (measured from production builds)

| | Phase 4 build | Phase 5 build |
|---|---|---|
| index JS | 578.69 kB (gzip 314.85) | 1,884.41 kB (gzip 1,286.47) |
| three chunk | 689.71 kB | 689.76 kB |
| CSS | — | 44.57 kB (gzip 9.07) |

The index growth is **entirely** the embedded CC0 texture module
(`client/src/cc0Textures.ts`): 955,200 bytes of WebP payload carried
as ~1.27 MB of base64 text — the price of shipping real photographed
PBR maps through a text-only snapshot pipeline with zero hosting.
Procedural-only (Low tier) players download the same bytes but never
decode them into textures. If a future host allows binary files,
moving these maps to hosted `.webp` files is the single biggest load
win available (≈ −950 kB gzip).

## Draw calls / triangles (ESTIMATES from scene composition)

*Estimates, not profiler captures:* ~350–450 draw calls in a typical
street view (instancing keeps props/decals/tufts to single draws;
buildings share ~30 cached materials; cars ≈ 25–40 draws each with
~16 player cars + 12 traffic + 6 police worst case, frustum-culled),
roughly 0.9–1.4 M triangles/frame worst case downtown. **FPS: not
measurable in this build environment — user-side check.** The Phase 5
quality system exists precisely for this: auto-detection plus a 2.5 s
FPS sample after game start steps the tier down once if the device
can't hold ~27–42 fps.

## Phase 5 rendering changes (summary)

- Quality tiers Low/Medium/High (`game/quality.ts`) gate: composer,
  SSAO (High, built-in postprocessing effect), shadow map size
  (1024/2048) + radius, normal maps, CC0 textures (off / 512 / native),
  water shader, clearcoat car paint, bloom strength.
- Water: two scrolling normal layers, fresnel deep↔sky, sun glint,
  rain-ripple uniform from `G.rainAmt`, analytic shore fades, manual
  fog blend.
- District material identity: Coral Shores = shell plaster + tiled
  sidewalks; The Docks = corrugated steel + stained concrete;
  Port Sable = brick/facade. Medium/High use real CC0 photographs for
  asphalt, concrete pavement, brick and plaster (ASSETS_LICENSES.md).
- Cars: clearcoat paint (Med/High), headlight beam cones at night,
  real SpotLights on the player's active car only, brake-light boost.
- Characters: skin sheen (roughness 0.55 + env response), cloth weave
  bump maps, enter-car slide animation, jump-arc pose.
- Camera: a boom guard walks the target→camera segment against the
  blocker AABBs so the third-person camera no longer sinks inside
  buildings/containers when the player backs against a wall.
- Motion blur: **not implemented** — the postprocessing library has no
  cheap, robust motion-blur effect; the existing speed FOV kick
  (+14° at speed) carries the sensation instead. Stated honestly
  rather than faked.
