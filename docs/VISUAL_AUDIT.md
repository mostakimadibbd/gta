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

## Phase 6 addendum — new radii, decks and streaming (2026-11-23)

- New collision radii (player-vs-world circle model): **bus 2.2**,
  **boat 1.9**, **bicycle 0.85** (motorcycle stays 1.0, cars 1.55).
  Traffic-vs-player uses the same values per kind.
- **Northgate bounds**: landmass x −118…38, z −296…−186; causeway
  x −20 ± 9 (road ±6), z −196…−110; world drive clamp now
  x ±130, z −302…330. Sable Island: centre (−64, 168), r 17.
- **Parking garage contract**: footprint x −80…−56, z −276…−252.
  Ground court z > −264 (y 0); deck z ≤ −264 at **y 3.1**; ramp lane
  x −80…−75 climbing z −256 (y 0) → −268 (y 3.1), smoothstep profile —
  `groundYAt` is the single source; the visual ramp mesh matches it
  (box [4.6, 0.3, 13.4] at (−77.5, 1.42, −262), rot.x 0.234). The
  under-deck is sealed by thin perimeter-wall blockers, NOT a full
  AABB, because `isBlocked` is height-blind and a full box would
  wrongly block deck-level driving.
- **Spike strips**: laid across the roadblock line (offsets ±1.35
  around the block centre, trigger band |along| < 1.6, |side| < 4.6);
  effect is the `flatTyre` state (speed cap ±8.5, heading pull +
  wobble) until repaired (R at a garage, +$40) or via the mod menu.
- **Streaming radii**: traffic AI + meshes dorm beyond **165u**,
  reactivate under **140u** (hysteresis); pedestrian movement holds
  beyond **170u**; far-ped animation tick skip unchanged (120u).
- **Traffic lights for AI**: `game/lights.ts` mirrors World's lamp
  cycle exactly (same 8 spots, 12 s cycle, parity offset) — one
  source of truth per intersection, amber counts as stop.
- **Faces (B4 honesty)**: face canvases are now 512² with painted
  eye-socket/cheek/jaw shading, plus crop/bald hair and jacket
  torsos. These remain *stylised-realistic* procedural rigs — not
  scans, not photoreal people; the standing honesty line holds.
- **Physics v3**: `suspension_response` + `resolve_vehicle_collision_v2`
  exist in C++ and as exact TS mirrors; g++ smoke test passes. The
  shipped WASM binary was NOT rebuilt this round (no emcc); the
  loader's per-function fallback makes behaviour identical.

## Phase 7 addendum — new radii, corridors and contracts (2026-11-23)

- **Interiors round 2**: three more pocket rooms join garage/club in
  the z ≈ −175 pocket — police {cx 104, w 20, d 14}, clinic {cx 140,
  w 16, d 12}, restaurant {cx 172, w 18, d 13}. Same contract as
  Phase 3: Player clamps to the room while `G.interior` is set, door
  teleports land ~130 ms behind the fade. Exterior blockers added for
  the four new frontages (police/clinic on the Docks strip z 106.5,
  restaurant/apartment in Coral z 218, car-wash back wall z −218.5) —
  all in `STATIC_BLOCKERS`, all outside road corridors.
- **Toll booth**: sits ON the bridge deck at (60, z 150), inside the
  existing bridge corridor contract (x 60 ± 5.5, deck y 5.5). The
  booth island and arms are VISUAL ONLY — no blocker was added, so
  deck driving (and the Phase 4 bridge AABB contract) is unchanged;
  the charge/smash logic is a proximity + speed check in Phase7.tsx.
- **Speed cameras**: roadside poles at (100, −13.5), (−53.5, 40),
  (26.5, −60) — all ≥1.5u off the drivable lane edge, non-blocking
  visuals; the fine check is a 9u radius + speed > 28 u/s test.
- **Destructibles**: crates/barrels/fences are NON-blocking props
  (they were never in `STATIC_BLOCKERS`); the static crate render in
  World.tsx is now filtered out and Phase7.tsx owns every crate mesh
  so a smashed crate actually disappears. Break check: player car
  within 2.3u at |speed| > 6. Respawn = next game-day tick.
- **Emergency vans**: reuse the traffic `van` body (radius 1.55
  contract unchanged). The two service traffic units are ordinary
  NpcCar entries with `svc` dressing; the rushing ambulance is a
  Phase7-owned visual on the z = 100 lane (y from `groundYAt`), it
  does not collide.
- **Race opponents**: visual-only CarBody groups steered by Phase7;
  they do not collide with the player or traffic (ghost rivals — a
  deliberate lightweight choice, stated here so nobody audits it as a
  physics bug).
- **Bundle**: index 2,011.22 kB / gzip 1,322.48 kB (Phase 6:
  1,944.76 / 1,303.49) — +66 kB raw / +19 kB gzip for the whole round;
  no new dependencies, no new textures (signs/posters are canvas).

## Phase 8 addendum — realism pass 4, exotics, tow/gym contracts, smoothness (2026-11-23)

- **Character realism pass 4 ("human, not robot")**: the walk cycle is
  now stride-matched (phase advances at ≈ speed × 2.9 rad/s in both the
  player rig and the ped loop, stride ≈ 1.08u per π) with heel-toe foot
  roll on new ankle pivots, counter-phase arm swing with a carried
  elbow bend, torso counter-rotation, shoulder sway and head counter-
  turn. Limbs never lock straight (rest bends: knee 0.06, elbow 0.24).
  Hands are palm + finger slab + thumb instead of boxes. Faces render
  at 1024² on Medium/High (512² Low) with brow ridge, nose shadow,
  two-tone iris + catchlight, upper-lid line, two-tone lips and a
  stubble pass; hair for crop/ponytail/bun/default styles adds layered
  alpha-textured cards over the scalp cap. Skin carries a warm
  subsurface-look tint + pore speckle; torso fabric paints fold streaks
  into colour AND bump. Breathing (~0.25 Hz chest scale) now runs on
  the player and all near peds, and near rigs blink (lid slivers,
  2.5–5 s period). **Honest line, unchanged: these are still procedural
  rigs — realistic-styled, not scanned humans.** Every stiffness cue
  named in the brief is addressed in code; none is claimed photoreal.
- **Exotic cars (all original designs; no real brand names, logos or
  copied shapes)**: `wedge` Vantara S, `hyper` Kestrel One, `gt`
  Marlowe GT — collision radius contract **r = 1.6** for all three
  (same as supercar); `tow` Sable Wrecker r = 1.6. **Scissor-door
  rule**: the Vantara's doors rotate up only while the car is parked
  with the player on foot within 3.4u, or during the player's
  enter/exit animation — never in traffic, never while driving (the
  traffic wedge keeps its doors shut). The Kestrel's rear wing rises
  with speed (0 at rest → +0.17u and −0.16 rad at 22 u/s). Top-end
  speeds sit above the physics core's 24 u/s clamp via the same
  post-step push the motorcycle uses: wedge ≈ 27.5, hyper ≈ 30 u/s.
- **Tow tether contract**: the towed car is NOT a physics body — it
  hangs 2.3u behind the wrecker's hook point plus a swing offset
  (spring toward the wrecker heading at 3.1/s, damped), writes its
  state directly each frame, and is skipped by traffic/player
  collision while hooked (documented lightweight, like race rivals).
  Hook capture: hook point within 3.6u of the target + wrecker speed
  < 0.8 held for 0.7s. Delivery: wrecker inside Lina's garage zone
  (centre (−25, 100.6), r 7.5) while hooked → flat $150.
- **Gym placement choice**: Sable Fitness is an OUTDOOR corner at
  Lantern Park — bench press at (70, −64.5), treadmill at (75.5, −64.5),
  both non-blocking props on a rubber mat — chosen over a pocket
  interior (no interior streaming cost, sits in the world). Sessions
  are prompt-driven; the props never enter `STATIC_BLOCKERS`.
- **Fishing spots**: pier stand (2, 112.5) casting to (2, 122);
  Sable Island dock stand (−64, 154.5) casting to (−64, 146). Splash
  ring + bobber are Phase8-owned visuals at the cast point; the leaning
  rod + bucket props are non-blocking.
- **Clothing override rule**: a Thread & Tide purchase (counter at
  (18, 30.5), Market Row) overrides the current preset's top style and
  top/bottom colours until the player changes character OR variant in
  Character Select, which clears it. The override is persisted
  (`harborfall-clothing`) and applied at rig build.
- **NPC memory**: recognition runs inside the existing ped loop
  (13u radius, per-ped cooldown 50–90 s) — no new per-frame system, no
  new draw calls. Zone reputation is a persisted Record keyed by the
  existing district names; decay ×0.55 runs on the day-rollover
  watcher Phase 8 already owns.
- **Smoothness (targets, NOT measured here)**: dynamic resolution
  walks a ladder 2 → 1.75 → 1.5 → 1.25 → 1.1 toward the tier cap
  (High 2 / Medium 1.5 / Low 1.25) on rolling 1 s FPS windows (< 47
  down, > 57 for 5 s up, ≥ 2.5 s between steps, applied via
  `gl.setPixelRatio`, no canvas remount); sustained < 40 FPS for 8 s
  in gameplay drops ONE quality tier with a toast, never below Low,
  and any manual tier pick (pause Graphics / phone Settings) disables
  auto-drop for the session. On Medium, DPR ≤ 1.25 also steps the sun
  shadow map to 1024. Texture anisotropy is 8 on High / 4 otherwise
  (applied at texture creation). HUD React snapshot is throttled to
  5 Hz (200 ms). Hot-loop audit: Player's frame loop lost 3 per-frame
  allocations (2 Vector3 + the merged-key view literal, hoisted to
  scratch/memo); Vehicle's `{...car.state}` spread (1/frame while
  driving) is REQUIRED by the physics step's immutable-state contract
  and was left; Phase7's hail/destination filters run on event
  cadence, not per frame. Frustum culling verified: city-wide
  instanced sets are intentionally `frustumCulled = false` (one draw
  spanning all districts — culling would pop the whole set); regular
  meshes keep default culling with geometry-derived bounds. **Targets:
  60 fps on desktop High, 50–60 on mid phones at Medium after
  adaptation. These are targets — this environment cannot run the
  game, so no frame rate was measured; the user play-tests live.**
- **Bundle**: index 2,062.32 kB / gzip 1,338.22 kB (Phase 7:
  2,011.28 / 1,322.49) — +51 kB raw / +16 kB gzip for the entire
  Phase 8 round (8 sweep items + realism pass + 3 exotics + joystick
  + smoothness + language wiring); no new dependencies.
