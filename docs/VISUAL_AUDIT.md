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

## Phase 9 addendum — flight, the sixth star, glass and the day-scoped city (2026-11-23)

- **Flight model (Sable Sparrow, honest scope)**: an ARCADE model in
  the vehicle step, not aerodynamics — ground roll uses the normal car
  step; lift-off when forward speed ≥ 16.5 u/s (~60 km/h); climb is a
  direct rate (Shift +5.2 u/s, Ctrl −6.5 u/s) on top of a lift curve;
  below 13 u/s airborne the plane sinks at up to −4.5 u/s (stall);
  ceiling 60 u; touchdown with sink < −7.5 u/s costs 42 damage;
  building strikes test the world `buildings` AABBs against altitude
  (+30 damage, speed scrubbed); ditching in water = 100 damage. No
  bail-out above 2 u altitude. The parked airliner blocker sits ON the
  strip (z −50..−34) — taxi via the apron (x ≈ 116–119) or lift off
  early; that is a deliberate obstacle, noted here so it isn't read
  as a bug. Prop spin, pitch/roll damping and nav lights are visual.
- **Skiff (second boat class)**: Harbour Fisher 180 — canopy, crates,
  slower (14.5 / 9.5 u/s fwd/rev) than the Marina Racer, same buoyancy
  mirror; spawns at Sable Island and the Coral dock.
- **Sixth star**: heat, not a new meter UI — serious witnessed crime
  at 5★ increments `G.starHeat`; the third raises 6★ (HUD now renders
  six star slots). 6★ response: the Harbour Guard SUV (27 u/s chase)
  joins the existing 6-car police pool; patrol boat pins the wanted
  cooldown while you're on water at 2★+; K9 pair adds bust pressure
  on foot at 3★+. All three are single extra actors in Phase9.tsx —
  no change to the core police step.
- **Glass + scaffold scope**: destructible BUILDING response is
  exactly 9 Market Row shopfront panes + 1 construction scaffold —
  buildings remain static merged geometry; panes/scaffold persist
  broken for the game day (`harborfall-destruct`, day-serial scoped)
  and are repaired on the daily tick, same contract as Phase 7 props
  and Phase 9 traffic wrecks (`harborfall-wrecks`).
- **Ragdoll / arrest honesty**: there is NO ragdoll solver. WASTED
  uses a 0.45 s procedural collapse (body tips to the ground plane,
  arms wide); car-hit peds flail via the existing animation driver at
  high frequency for 1.2 s. The arrest is a hands-up POSE scaled by
  the bust meter / surrender hold — no cuffing rig exists.
- **Free-aim**: hold RMB (canvas only) or gamepad LT — over-shoulder
  camera (3.1 back / 0.95 right / 1.62 up), FOV −14, player faces the
  camera, Combat fires along the camera ray projected to the ground
  plane. Mouse is the only pointer-lock-free writer; the gamepad
  latch only clears what it set.
- **Bundle**: index 2,125.96 kB / gzip 1,357.09 kB (Phase 8:
  2,062.32 / 1,338.22) — +63.6 kB raw / +18.9 kB gzip for the whole
  Phase 9 round (15 topic upgrades); CSS 51.24 kB; no new
  dependencies. Build: `tsc --noEmit && vite build` PASS. No C++ or
  Python files were touched this round, so no g++/py_compile re-run
  was required.

## Phase 10 — realism + physics pass (2026-11-23)

No new features this round — the brief was "make it FEEL more
realistic: more graphics, more physics." Everything below is
procedural, per the standing all-procedural decision.

### Post-processing, per tier (what each tier actually gets)

| Effect | Low | Medium | High |
|---|---|---|---|
| EffectComposer | off (direct render) | on | on |
| Bloom (threshold 0.6 — only emissives/lights bloom) | — | 0.55 | 0.75 |
| Hue/saturation + brightness/contrast grade | — | yes | yes |
| Film grain (Noise 0.035) + Vignette | — | yes | yes |
| Chromatic aberration (radial, 0.00045 — NEW) | — | yes | yes |
| SSAO | — | no | yes |
| SMAA | — | yes | yes |

The composer already renders at the canvas size, so it follows the
Phase 8 dynamic-resolution ladder step for step; when the adaptive
tier drops to Low the composer unmounts entirely (the `postFx` +
`gates.composer` gate), and returns if the tier rises again. Bloom's
threshold rose 0.55 → 0.6 so lit facades stop blooming and only true
emissives (streetlight halos, neon, police light bars, headlights)
glow.

### Sky, night, wet — what closed

- **Chromatic aberration** was the one standard pass the chain was
  missing; it is radial-modulated so only the frame edges fringe.
- **Fog colour now follows the day cycle.** Before Phase 10 the fog
  colour was baked from the theme at scene setup and only its
  near/far lerped — the haze now darkens with the same scalar as the
  sky background, so dusk haze and night haze match the dome.
- **Stars**: 650 points on the dome shell, fading in with night,
  killed by fog and rain, with a faint twinkle. Clear nights finally
  read as nights.
- **Cloud cover follows the weather**: sprite count (4 → 11) and
  opacity scale with fog/rain amounts; storm clouds drift ~2.6×
  faster. Cloudy/Storm skies are now visibly heavier than Clear.
- **Windows at night**: the window system gained a dedicated night
  emissive map — black except individually lit panes (~17% warm with
  per-pane brightness and occasional blind shadows, ~6% cool TV
  light). A facade reads as lived-in rooms, not a uniform glow grid.
  Day appearance is unchanged (same base texture).
- **Wet ground**: puddle decals 22 → 30 and their env reflection now
  strengthens at night (+1.0) and in rain (+0.5), so puddles catch
  the streetlights; the Phase 3 wet-road roughness behaviour is
  unchanged and still stacks with this.
- **Density**: power-line catenaries between the lamp poles along
  every lamp row in all three districts (one LineSegments draw, sag
  0.85u), bins 18 → 26, mailboxes 8 → 12 (same instanced meshes), and
  an 11-palm row along the beach promenade.
- **Blob contact shadows: deliberately NOT added.** The sun shadow
  camera follows the player (±55u at 2048²), so peds and cars near
  the player are already grounded by real shadows; blobs would only
  double-darken the same contact patch. Recorded here so the skip is
  a decision, not an omission.

### Physics — the C++ core grew four steps (TS mirrors ship)

- `step_vehicle_v3` — v2 plus a SURFACE GRIP input: asphalt 1.0 dry,
  ×(1 − 0.32·rain) when wet (0.68 in full rain), dirt 0.72 (the Sable
  Downs loop), sand 0.55 (beach + Sable Island), grass 0.8. Over-
  driving the grip produces a slip value: wheelspin smoke (coloured
  by surface — pale on asphalt, tan on dirt/sand) and dulled launch;
  handbrake slides widen as grip falls.
- `vehicle_body` — per-wheel suspension: each wheel's compression
  comes from the terrain height under that corner, and body pitch /
  roll / heave are spring-damper states fed by terrain attitude and
  weight transfer (brake dive, launch squat, cornering lean). The
  player car gets the full step with real wheel heights; traffic
  gets the same step with flat wheel heights (attitude + transfer
  only). Wheels visibly travel ±0.17u in their arches.
- `debris_step` — one gravity/bounce/settle integrator now shared by
  the Phase 7 debris pool and the Phase 9 glass shards. Debris and
  shards inherit the IMPACT direction: prop debris flies along the
  striking car's heading, bottle shards along the bottle's flight,
  rammed glass along the ramming car.
- `swim_step` — swimming has drag (speed relaxes to the stroke
  target instead of snapping to 2.4), a ±14% stroke surge, and a bob
  driven by the stroke cycle (the old fixed sine is gone).
- **Asymmetric crumple**: cars carry a 4-side dent vector
  [front, back, left, right]; wall hits dent the nose or tail by
  travel direction, car-to-car hits dent the side facing the other
  car. Dents render as dark crumpled panels that fade in with depth.
- **Pedestrian knockback is momentum now**: a struck ped slides
  along the car's velocity vector (friction-decayed, wall-checked)
  instead of hopping along their own heading.
- **Rain splash rings**: 42 pooled expanding rings spawn around the
  camera focus at a rate scaled by rain amount, and ripple off the
  swimmer in clear weather. Boat wake foam was verified: it already
  scales with speed (Phase 3) and is unchanged.
- Smoke: g++ suite **36 checks, all pass** (14 new). The WASM build
  was attempted again — emcc is still absent from this environment,
  so the TypeScript mirrors remain the shipping runtime, exactly as
  Phases 5–9.

### The ceiling that remains (honest)

Phase 10 closes the *systems* gaps (missing passes, static fog
colour, uniform windows, flat vehicle bodies, grip-less surfaces).
What remains is the *asset* ceiling, and it does not move without
breaking the all-procedural rule: textures are painted canvases and a
CC0 photo set, characters are stylised-realistic rigs with painted
faces (not scanned people), there is no PBR material library beyond
the CC0 set, shadows are one 2048² follow cascade, and physics runs
in the JS mirror of the C++ core until an Emscripten toolchain
exists in the build environment. Within a browser tab on free
hosting, this is the practical realism ceiling — the game should now
read noticeably more "filmed" (lens, haze, lit windows, body roll,
grip) even though no individual asset changed resolution.

- **Bundle**: index 2,137.92 kB / gzip 1,361.79 kB (Phase 9:
  2,125.96 / 1,357.09) — +11.96 kB raw / +4.70 kB gzip; the
  chromatic-aberration pass was already inside the postprocessing
  library. CSS unchanged at 51.24 kB; no new dependencies. Build:
  `tsc --noEmit && vite build` PASS; g++ smoke 36/36 PASS.

## Phase 11 — ray-traced-style reflections (2026-11-23)

The user asked for "ray tracing". What shipped is the honest
browser version of it, labelled **Ray-traced-style** everywhere it
appears in the UI — never "ray tracing".

**Why not real ray tracing, in plain words:** hardware ray tracing
needs RT cores and a native graphics API. A browser game runs in
WebGL on whatever GPU the phone has — no RT cores, no ray queries,
and the one experimental WebGPU path tracer in three.js does not
run on iOS Safari at all and is not real-time on any phone. What
AAA games actually build "the ray-traced look" from at real-time
rates — and what this phase ships — is reflections: surfaces that
mirror the world around them. Three layers, by tier:

| Reflections | Low | Medium | High |
|---|---|---|---|
| Static probe (PMREM sky / RoomEnvironment) | ✓ (×0.8) | ✓ (×1.0) | ✓ (×1.15) |
| Bay water | flat sheet | fresnel shader | **planar mirrored water** |
| Screen-space reflections (SSR) | — | — | **✓, glossy surfaces only** |
| Settings readout | Off | Standard | Ray-traced-style |

- **SSR (High)** — the `SSR` component from the installed
  `@react-three/postprocessing` 2.19.1 (its vendored
  screen-space-reflections `SSREffect`; no new dependency). Wired
  into the existing composer directly after Bloom so reflected
  hits carry the neon glow. Conservative settings, chosen for a
  city of wet streets rather than a product demo: G-buffer and
  reflection targets at **half resolution** (`resolutionScale`
  0.5), 20 ray steps + 5 refinement, ray distance 26u (a street
  width), **maxRoughness 0.32** — rays are only traced for glossy
  texels (puddles 0.05, glass ~0.1, wet asphalt ~0.15–0.45 in
  rain, clearcoat paint ~0.3), so matte walls, concrete and skin
  never shimmer; temporal resolve (blend 0.9) + bilateral blur
  clean the noise, light jitter (0.3) breaks banding, and missed
  rays fall back to the PMREM sky probe, degrading to the Phase 5
  look instead of black. Version quirk, recorded so nobody
  "fixes" it later: this library version's `.d.ts` advertises
  newer prop names (`MAX_STEPS`, `rayStep`) that its vendored
  runtime silently ignores — the working option names were
  verified in the shipped `node_modules` source and are what
  `SSR_OPTS` in App.tsx passes.
- **Planar water (High)** — `components/PlanarWater.tsx`: a
  mirrored camera renders the scene once per frame into a
  half-resolution HalfFloat target (oblique near-plane clipping,
  the three.js Reflector derivation) and the bay samples it with
  a projective texture matrix, UV-perturbed by the same scrolling
  normal layers as the Phase 5 shader — so the skyline, the Bay
  Bridge and the sunset genuinely mirror in the water, shimmering
  instead of mirror-still. Deliberate deviations from the stock
  Reflector: the render is hoisted into `useFrame` so it happens
  **once** per frame (the stock Reflector re-renders inside every
  scene pass — the composer's main pass and the SSR G-buffer pass
  would each have paid for a second mirrored render); it is
  skipped when the bay is off-frustum; and it reuses the previous
  frame's shadow maps. **What reflects: the full scene** — layer
  restriction would need a forked scene graph, and the full
  skyline is the point. Same plane (560×236 at y −0.02), same
  shore fades, same fog blend, same sun glint as the shader it
  replaces, so boats, buoyancy and swimming cannot tell the
  difference. The water surface opts OUT of SSR via a roughness
  sentinel (the SSR G-buffer reads `material.roughness`, absent
  on ShaderMaterial; set to 2, far above the 0.32 gate) — the bay
  already has a true planar reflection and doesn't need screen-
  space rays traced across it.
- **Probe tuning** — the PMREM probe was already the reflection
  source everywhere; what was missing was per-tier strength. New
  `gates.envRefl` (Low 0.8 / Medium 1.0 / High 1.15) now scales:
  glass-tower facade (1.25 base, rebuilt with the tier), car
  clearcoat + standard paint (at creation, reads the tier), the
  shared car glass/chrome singletons (re-applied by App on every
  tier change via `applyCarReflTier`), and the puddle term in the
  World frame loop. Puddles on High additionally receive true SSR
  on top of the probe (their 0.05 roughness is far under the
  gate) — probe for body, SSR for the mirrored neon detail; no
  code change was needed there beyond the tier scale, because
  puddles were already standard materials with real roughness.

**Perf contract.** SSR + planar are the two most expensive
effects in the game, so both are High-only and both die with the
tier: the adaptive governor's step-down unmounts SSR and swaps
the planar water back to the shader in the same frame the tier
changes, and Low unmounts the whole composer as before. SSR's
targets follow the canvas, so the DPR ladder shrinks them too;
the planar target is half the drawing buffer, so it follows the
ladder as well. The player's own override — **Settings →
Ray-traced reflections**, in both Pause → Graphics and Phone →
Settings, persisted — disables SSR + planar independently of the
tier, and the Reflections readout next to it (Off / Standard /
Ray-traced-style) always shows the pipeline actually in use. If
High stutters on a given phone, this toggle is the first lever.

**Bundle**: index 2,146.65 kB / gzip 1,365.01 kB (Phase 10:
2,137.92 / 1,361.79) — +8.73 kB raw / +3.22 kB gzip; the SSR
machinery was already inside the postprocessing library the
composer uses. CSS unchanged at 51.24 kB; no new dependencies.
Build: `tsc --noEmit && vite build` PASS. Not live-playtested
(this environment cannot run the game) — the smoke list is in
the Phase 11 handoff: wet night street, glass towers at dusk,
bay at golden hour, car paint close-up.

## Phase 12 — optimization pass (2026-11-23)

A pure optimization phase (user order: "enhance it, make smooth,
optimized") — no new features, no behaviour changes visible to the
player except smoother pacing. Everything below is in the code;
bundle numbers are from the actual production build output.

**1. Fixed-timestep simulation — LANDED.** The three movement/
physics integrators previously ran on the raw variable frame dt
(clamped to 0.05): the world step in `GameSystems.tsx` (traffic,
peds, cops, wanted), the player step in `Player.tsx`, and the
driven-car step in `Vehicle.tsx` (which also passed the RAW,
unclamped `delta` into the C++ `step_vehicle_v3` — an inconsistency
now fixed). All three now run at a fixed 60 Hz from a per-component
accumulator (`SIM_STEP` / `SIM_MAX_SUBSTEPS` in `game/perf.ts`):
the accumulator is pre-clamped to 3 steps and leftover debt is
dropped, so gameplay speed/feel is identical at 30/60/120 Hz and a
frame spike can neither tunnel a collision nor spiral. Mesh sync
still runs once per rendered frame after the substeps. Rendering
interpolation was deliberately NOT added: it would require
duplicating every entity's transform state per frame, and at a
60 Hz sim the worst-case visual step on a 120 Hz display is one
sim tick — the cadence the game always shipped at on 60 Hz
screens. Auxiliary systems (weapon presentation, jobs, Phase 9's
arcade movers) keep clamped variable dt: they integrate no
positions that can tunnel at their speeds.

**2. AI update staggering — LANDED.** In the GameSystems world
step: traffic's two expensive scans (signal stop-lines + same-lane
queue) now run every step for cars within 60u of the player and on
a 1-in-3 slice (sim tick + index) beyond that, reusing cached
results (`NpcCar.scanStop/scanQueue/scanWant` in `game/store.ts`);
speed/position integration still runs every step for every car, so
far traffic never stutters. Peds beyond 60u steer on alternating
steps with a doubled step length (same average speed; knock slide
and down state still run every step); near peds are untouched.
Cops are never staggered (only 6, gameplay-critical). Ped
animation in mesh sync gained a mid band: 60–120u animates every
2nd frame (the >120u every-3rd-frame rule from V7 is unchanged).

**3. Reflection cost control — LANDED (planar) / DOCUMENTED SKIP
(SSR distance).** `PlanarWater.tsx`: when the camera is >60u from
the bay centre the mirrored render runs at half rate (every 2nd
frame), reusing the last render target AND the last texture
matrix as a consistent pair — the mirror is at most one frame
stale and can never shear; near the water it stays full-rate.
SSR's shipped knobs were re-verified (half-res targets,
20 steps, glossy-only roughness gate). A DPR-tied SSR ray-distance
fade was NOT added: the vendored SSREffect's distance is a
constructor-time uniform — changing it live means remounting the
composer, which hitches; SSR cost already scales with DPR because
its targets follow the canvas size through the Phase 8 ladder.

**4. Code-splitting / load — LANDED.** The CC0 texture data
(~1.24 MB of base64) moved from `cc0Textures.ts` into
`cc0Data.ts`, loaded via dynamic `import()` on first CC0 request:
it no longer ships in the initial bundle, and Low tier — which
never requests a CC0 texture — never downloads it at all. The
decode contract is unchanged (shared texture objects fill in when
their image lands, exactly as the Phase 6 deferred loader already
behaved). Four heavy DOM overlays are now `React.lazy` chunks,
latch-mounted on first open so their state survives close/reopen
as the static mounts did: Phone, GaragePanel, ModMenu,
CharacterSelect. NOT split, deliberately: `posterData.ts` (it IS
the first-frame start-screen content), Interiors and the
Phase 7–9 systems (they own always-running world logic, not just
UI), PlanarWater (small, and a risky seam). The staged loading
screen still reflects real construction stages — the lazy chunks
load on first use, outside the staged sequence, and no stage
claims otherwise.

**5. Draw calls + allocations — LANDED.** Draw calls were
estimated STATICALLY (this environment cannot run the game, so
`renderer.info` is unavailable): renderables counted by category
from the world data arrays — buildings ~720, street lamps ~600,
palms ~1,330, trees ~375, houses ~81, cars ~970, ped rigs ~550,
props/roads/decals/misc ~770 → **≈5,400 calls/frame** on the main
pass (×2–3 passes on High with the planar mirror + SSR). Four
instancing wins, all replicating the original transforms/materials
exactly: street lamps → 2 instanced meshes (was ~2/lamp); palm
trunks → 4 (crowns stay per-palm, fronds sway); pine trees → 6
(the old component's deterministic jitter/bush functions
replicated exactly); benches + hydrants → 2. Estimated saving
**≈1,430 calls/frame → ~3,950**. Per-frame/step allocations
removed (file:line at time of writing):
- `GameSystems.tsx:732` — ped separation neighbour array per ped
  per step → shared scratch buffer.
- `GameSystems.tsx:785` — LOS building shortlist array + entry
  objects per call (up to 6 calls/step) → pre-allocated scratch.
- `GameSystems.tsx:965` — wanted-level nearest-cop
  `filter+map+spread` (3 arrays/step) → manual min loop.
- `GameSystems.tsx:584` — traffic intersection `.find` closure per
  car per step → plain loop.
- `GameSystems.tsx:1297` — dog-owner `G.peds.find` per frame →
  cached index at init.
- `GameSystems.tsx` traffic/ped loops — `indexOf` per entity per
  step → indexed loops.
- `Vehicle.tsx:335` — per-wheel ground heights `.map` over a
  literal array per step → reused tuple.
- `Vehicle.tsx:324` — slip-state object allocated per step →
  field mutation.
- `Phase7.tsx:138` — taxi hail-point `.filter` per frame while
  idling in a taxi → scratch fill.
- `Phase9.tsx:226` — wreck-smoke `spread/map/filter/slice` chain
  (4 arrays/frame even with zero wrecks) → scratch, computed only
  while wrecks exist.
Accepted and documented, not changed: the physics mirror's
per-call result objects (`GamePhysics.ts`) — they are the C++
mirror's API shape (WASM parity), bounded to ~30 small objects
per step; and the driven car's `{...car.state}` spread, which the
physics step's immutable-state contract requires (Phase 8).

**6. Shadow cost — LANDED, modified from the original sketch.**
A pure on-change `needsUpdate` is unsafe here: the shadow camera
follows the player continuously and moving casters (traffic,
peds) would freeze their shadows for up to a second. What shipped
(`GameSystems.tsx` sun block): `renderer.shadowMap.autoUpdate =
false` globally, the light transform SNAPPED (target to 8u cells,
sun angle to 1° buckets — snapping also removes the follow-cam
shadow swimming the continuous version had), and `needsUpdate`
set when the snapped transform changes, when the shadow toggle /
tier / map size changes, or every 2nd frame regardless — so a
moving caster's shadow is at most one extra frame old (~33 ms,
≈0.3u of traffic travel). On High this removes up to 2 of the 3
per-frame depth passes (composer + planar mirror already reused
shadow maps; the main pass was the remaining full-price one).
REVERT: delete the `autoUpdate` effect in GameSystems and restore
the continuous-follow sun block (one `position.set` +
`target.position.set` + `updateMatrixWorld` per frame).

**7. Bundle — measured from `npm run build` output:**

| Chunk | Phase 11 | Phase 12 | Notes |
|---|---|---|---|
| index | 2,146.65 kB / gzip 1,365.01 | **840.46 kB / gzip 395.71** | initial |
| three | 689.88 / 178.23 | 689.88 / 178.23 | initial |
| react-three | 525.82 / 185.24 | 526.96 / 185.77 | initial |
| CSS | 51.24 / 10.32 | 51.24 / 10.32 | initial |
| cc0Data | — (in index) | 1,274.15 / 959.18 | async: first CC0 request; never on Low |
| Phone | — (in index) | 28.21 / 7.50 | async: first phone open |
| GaragePanel | — (in index) | 4.36 / 1.61 | async: first garage entry |
| ModMenu | — (in index) | 2.95 / 1.26 | async: first mod-menu open |
| CharacterSelect | — (in index) | 1.87 / 0.73 | async: first open |

**Initial-load JS gzip: 1,728.48 → 759.71 kB (−56.0%).** Total JS
across all chunks is essentially unchanged (~1,730 kB gzip) —
code and data moved out of the critical path, not removed.
Build: `tsc --noEmit && vite build` PASS. Not live-playtested
(this environment cannot run the game) — the Phase 12 smoke list
is in the handoff: drive at a frame spike (tab switch), far
traffic flow on the causeway, ped crowds at mid distance, shadow
behaviour while driving (watch for swimming/lag), bay reflections
from the beach vs from downtown, first phone/garage/mod opens.

## Phase 13 — the Sable Line, seasons, two interiors, last-car persistence (2026-11-23)

The "remaining features" round: the last two ⬜ topics in the
§15 ledger (trains, seasons/snow) plus two 🟡 growths (enterable
buildings 6 → 8, persistent world). Built ON the Phase 12
structure — nothing below touches the fixed-timestep drivers, the
AI staggering, the snapped shadows or the lazy-chunk layout.

**1. The Sable Line tram — guideway choice: ELEVATED, over the
road centres.** Street-level track was rejected: the traffic AI
drives fixed lanes on the same roads, and a rail vehicle that
cannot steer would need its own collision regime against ~40
traffic cars. Elevated on the road CENTRES, the guideway is above
every conflict: beam top at y 6.55, beam underside ≈ 6.0 — the
tallest traffic (bus ≈ 3.4) passes with ~2.6u to spare. Pillars
(0.9u square, every ~16u on the median) are deliberately NOT in
the collision set — the palm-tree precedent (`world.ts` excludes
palms from `isBlocked` so thin median furniture never traps the
player); traffic lanes run either side of the median line and
never meet a pillar either. Route (closed loop, ~1.6 km): up the
Docks road (x=20), across Market Row (z=−20), up the causeway
(x=−20), around the Northgate ring (z=−248 / x=−84 / z=−216),
back down the causeway, across Market Row to the bay bridge
(x=60), and a Coral Shores lollipop (in on x=72, out on x=40,
stop on z=264). The causeway and bridge trunks are shared both
ways — there is one tram, so no passing logic exists or is
needed. **Bridge contract:** over the bay bridge the road deck
itself is 5.5u up, so the guideway carries a height profile —
deck = max(6.55, groundYAt + 4.05), smoothed — climbing the
bridge ramps with the deck and settling down the far side; bus
clearance underneath holds there too. Pillars are omitted on
the bridge span (the beam cantilevers the corridor rather than
piercing the deck) and scaled to their local deck height on the
ramps. Path math: polyline + quadratic-Bezier corner fillets
(radius ≤ 8u — Catmull-Rom was rejected, its ~10u corner cut
could clip buildings), pre-sampled at ~1u into flat arrays with
cumulative lengths; all lookups write into a shared scratch
object (zero per-frame allocation). Motion: cruise 11.5 u/s,
corner slowdown via the fillet flag, station approach on a
linear braking profile the 3.4 u/s² decel can track, 6 s dwell,
door chime (`sfx.chime`) on arrival and departure, sliding doors
on the platform side only. Stations: platform deck at beam
height on a uniform platform side (perp = (−tz, tx)), canopy,
stair/lift shaft to a street sign point with a canvas name board
+ timetable board (loop minutes computed from the real loop
length). Boarding is a fade-free prompt interaction at the street
point while the tram dwells (it is 6u up — you board via the
station, like the interior doors' teleport logic, minus the
fade); **alighting is stations-only** — there is no mid-route
drop, documented in Help. While riding, `Tram.tsx` owns the
prompt slot (it mounts after Phase9Systems precisely so
street-level interactions under the guideway cannot fire through
the car floor), the player renders seated at deck height in
`Player.tsx` (groundYAt bypassed), and GameSystems gates the two
wanted rules: heat never bleeds while riding, and the bust check
never fires (the patrol does not board). Rendering: 4 instanced
meshes total for beam + 2 rails + pillars (~460 instances), 2
tram car groups, 4 station groups — no per-frame allocation in
the loop.

**2. Seasons — a climate system, not a palette swap.** Season =
7 game-days off the persisted economy day serial (or a Settings
pin, persisted in `harborfall-settings`). The core move is the
SUN WARP in `game/season.ts`: elevation' = sin(sunAng) × amp +
bias, angle' = atan2(elevation', cos(sunAng)). Summer (amp 1.06,
bias +0.14) lifts the arc and widens the daylight window in
dayTime to ≈54% of the cycle; winter (0.60, −0.12) drops it to
≈44% with a low, dim arc. Because GameSystems' `elev` is now the
warped value, the night factor, ped density bands, phone glow
and heli rules all inherit the day length for free — and the
Phase 12 shadow bucket quantises the warped angle (snapping
untouched). Around it: sky/fog tint multipliers (applied where
GameSystems already multiplies the theme colours), a seasonal
offsetHSL on all three water paths (standard material, shader
uDeep, planar mirror), foliage re-tints copied per frame into
the instanced TreeSet's five foliage materials (trunk excluded;
**palms are not in that set and stay green**), and weather
weights per season in `rollWeather()` (summer Storm ×1.8 extra
on 13:00–18:00 rolls; winter Fog-weighted). All visual state
lerps over ~2 s (`tickSeasonVisuals`) so a season turn is a
drift, not a pop; turns announce via toast + Harbour Wire +
SableSocial. **Snow: none, by climate.** Port Sable is a
subtropical harbour city — palms, open water, fishing skiffs.
The season system is fully simulated; the absence of snow is a
property of the place, documented on the BLUEPRINT line itself.

**3. Interiors 7 + 8 (pocket system, unchanged mechanics).**
Showroom (pocket cx 244, 22×15): three rotating turntables
(wedge/hyper/gt — the DEALER_CARS exotics), a dealer counter
that replicates the forecourt sale exactly (tap E browses the
same stock, hold E 0.9 s buys into the garage, same hours via
`shopsClosed()`), and a glass front whose exterior was added to
the Northgate forecourt in World.tsx (the pocket has no real
outside, so from inside the glass carries the street's warm
glow — stated plainly, not faked as a view). Its hold label is
"Purchasing…" on purpose: Interactions' generic hold-clear only
recognises "Buying…", so the indoor counter can never be
cancelled by the outdoor system's per-frame cleanup. Café Coral
(pocket cx 282, 16×12; new Docks-strip frontage at (8, 106.5)
with a STATIC_BLOCKER): counter that sells by need (pastry $12 /
+35 health when hurt, coffee $8 / stamina + boost otherwise),
two sit-able tables (the restaurant's sit system), and two
static seated regular rigs with a head-bob life loop. Player
room-clamping needed no changes — it reads INTERIORS generically.

**4. Last-car persistence.** Snapshot (`harborfall-lastcar`) on
car entry, ~2.5 s refresh at the wheel, finalised on exit:
kind/colour/model/owned/stolen/position/heading/damage/fuel/
window/tune/brakes/flat tyre. Restored at store init: world cars
in place by spawn id; garage/dynamic cars un-stored if a matching
put-away instance exists, else re-created from the snapshot.
Cleared on: 100% damage (checked inside `noteLastCar` itself),
bust (`resetAfterArrest` — the patrol impounds it), garage store
(GaragePanel checks the tracked index on both store paths). The
big map draws an amber ring + "YOUR CAR" label; the minimap
keeps the plain fleet dots. Known accepted overlap: the mansion
garage-save (`harborfall-garage-car`) is a separate older system
— a car that is both garage-saved and last-driven can exist as
the garage copy plus the street copy, the same tolerance the
garage system already had.

**5. Phase 12 non-regression + bundle — measured:**

| Chunk | Phase 12 | Phase 13 | Notes |
|---|---|---|---|
| index | 840.46 kB / gzip 395.71 | **873.76 / 406.16** | initial |
| three | 689.88 / 178.23 | 689.88 / 178.23 | initial |
| react-three | 526.96 / 185.77 | 526.96 / 185.77 | initial |
| CSS | 51.24 / 10.32 | 51.24 / 10.32 | initial |
| cc0Data | 1,274.15 / 959.18 | 1,274.15 / 959.18 | async |
| Phone | 28.21 / 7.50 | 29.24 / 7.74 | async (season UI) |
| GaragePanel | 4.36 / 1.61 | 4.45 / 1.65 | async |

**Initial-load JS gzip: 759.71 → 770.16 kB (+1.4%).** The growth
is the tram + season world logic, which is static for the same
reason Interiors/Phase 7–9 are static (always-running world
systems, not open-on-demand UI — the App mount comment says so
at the Tram mount). No new lazy chunks were needed and none of
Phase 12's were merged back. Draw calls: +~10 (guideway
instancing, tram cars, station dressing, two pocket rooms —
rooms only render their contents when visited, as before).

Build: `tsc --noEmit && vite build` PASS. Not live-playtested
(this environment cannot run the game) — the Phase 13 smoke list
is in the handoff: ride the full loop end-to-end (board at Docks,
stay on through Northgate and Coral, step off back at Docks),
watch a bus pass under the guideway on the bridge, switch season
at dusk from the pause menu (foliage + light drift), enter the
showroom at night and buy from the indoor counter, sit in Café
Coral, and leave a car somewhere odd, reload, and find the amber
ring on the big map.

## Phase 14 — depth pass + the High-tier stability pass (2026-11-23)

Two deliveries in one build. The depth pass: a genuine verlet ragdoll
(13 points / 18 constraints, C++ `ragdoll_step` + exact TS mirror,
41/41 g++ smoke checks) posing downed peds near the player and the
WASTED collapse from the solved points, blended out on get-up;
destructibles round 2 (43 props + 15 glass panes behind one shared
breakage state — car, bat and bottle all break through it); Sable
Fitness (the gym indoors, same rules) and the Northgate Loft (second
home: bed, wardrobe, harbour windows) as pockets 9 + 10; the Bay
Circuit ghost-boat race and the Sparrow Run altitude-gated time
trial on the existing race scaffolding; three save slots via a
localStorage prefix layer (legacy saves copied → verified → kept as
backup in Slot 1); and per-slot key remapping with conflict
detection.

The stability pass answers a real play-test report: on a Retina Mac
in Brave, High crashed to a black screen, Medium afterwards showed
electric-blue outlines (the postprocessing normal/G-buffer presented
instead of the composited frame), and the tab held 2.7 GB. The stack
that caused it: DPR 2 on Retina (~5K drawing buffer) feeding the
composer's HalfFloat targets, bloom's mip chain, SSAO, SSR's
G-buffer at 0.5 scale and a planar-water target at half the drawing
buffer — all live at once, with SSR hot-swapped inside a long-lived
composer and no error boundary or context-loss handling anywhere.

| Lever | Before | After |
|---|---|---|
| DPR cap — High / Medium / Low | 2 / 1.5 / 1.25 | 1.5 / 1.35 / 1.25 |
| DPR ladder | 1.1–2 (5 steps) | 1.1–1.5 (4 steps) |
| SSR resolution scale | 0.5 | 0.35 |
| SSR steps / refine steps | 20 / 5 | 12 / 3 |
| SSAO + SSR together | both on High | never — SSAO yields when SSR is active |
| Planar-water target | 0.5× drawing buffer (unbounded) | hard cap 1024×512 |
| Planar refresh at governor floor | far-only half-rate | half-rate whenever DPR sits at the ladder bottom |
| CC0 texture cap — High | native (0) | 768 px (Medium stays 512) |
| reflFx default | ON | OFF (opt-in); existing saves migrated once (reflSafeV) |
| Composer failure mode | black screen / stale G-buffer frame | keyed remount on any tier/reflection change + error boundary → plain rendering for the session + toast |
| WebGL context lost | permanent black canvas | prevented default + reflections off + tier Medium (persisted) + plain-language toast |

Honest bounds: these caps bound the big multiplicative terms (frame
targets scale with DPR², the mirror pass is fixed-size, SSR's
buffers shrink ~2× in area and ~40% in march cost, one G-buffer
effect runs at a time). They do not promise a specific RAM number on
anyone's machine — texture residency, the browser's own GPU process
and other tabs all count too, and this environment cannot run the
game to measure it. What can be said: the worst-case configuration
that produced 2.7 GB no longer exists, and every remaining failure
mode degrades to a playable frame instead of a black one.

Initial-load JS: 789.8 kB gzip (index 414.8 + three 178.2 +
react-three 185.8 + css/html 11) vs Phase 13's 770.2 — the +2.5% is
the phase's own code (ragdoll, destruct, saveslots, keybinds, races,
two rooms); lazy chunks (cc0Data, Phone, panels) stay lazy.

## Phase 15 — playability pass + closable tasks (2026-11-24)

Visual/world additions, all in the existing teal/amber register:

| Addition | Where | Notes |
|---|---|---|
| Thread & Tide walk-in interior | pocket 11 (cx 390) | cream walls, pale boards, two racks wearing the actual CLOTHING_ITEMS colours, counter + mirror, changing-room curtain; the Market Row street rack remains as signage |
| Sable Downs farm network | NW corner, off the dirt ring | 3 dirt roads (drawn on both maps in dirt brown), red barn + cream farmhouse (blockers), tilled field with 54 instanced crop tufts, hay bales, farm pickup spawn |
| Dispatch beacon | on the two svc vans | flashing amber (ambulance) / red (fire) box while dispatched, strobed in syncMeshes; incident = white-ringed red cross on minimap + big map |
| DPR ladder floor | governor | ladder is now [1.0, 1.1, 1.25, 1.35, 1.5] — one more resolution step down under sustained load before any tier discussion |

No palette changes, no new post effects, no eager chunks:
initial-load JS 794.1 kB gzip (index 419.2 + three 178.2 +
react-three 185.8 + css/html 11) vs Phase 14's 789.8 — the phase's
own code (dispatch, farm, shop room, roster, pair) at +0.5%.

## Phase 16 — World Depth & Player Control

No palette changes and no new post effects. What changes visually is
*density under player control* and three new dressed spaces:

- **Performance levers (Pause → Settings / Phone → Settings):**
  Traffic density Low visibly thins the ambient flow (half the pool;
  buses, taxis, emergency units and anything near you never cull),
  High keeps the rush-hour reserve circulating all day. Pedestrian
  density scales the pavement crowds on top of the day/night rhythm.
  View distance Near pulls the fog in (×0.78) and shortens streaming
  (×0.65); Far pushes both out (×1.3 fog / ×1.45 streaming). All live,
  no reload; Normal is the shipped look, unchanged.
- **The arrest escort** reads as a scene, not a cut: a navy patrol
  officer rig steps out of the patrol car, subtitle barks carry the
  exchange, and you walk hands-up at his shoulder to the car while a
  slim "Under arrest" progress line runs. The BUSTED overlay that
  follows is the same one as always.
- **The Downs farmhouse interior** (pocket 12): cream walls, wood
  boards, a kitchen run with stove + kettle, table and chairs on a
  rust rug, and the farmhand's bunk with a harbour-teal blanket at
  the back — the room is dressed as a workplace home, not a show
  home, and it is not for sale.
- **Farm work dressing:** crop crates stack in the farm pickup's bed
  — 2 crates on the first load, 4 on the second, a full 6-crate
  stack on the third — and clear on delivery.
- **Barber:** fade (low tight cap), quiff (raised swept front),
  mohawk (centre strip), shoulder-length (deep back panel), and
  beards — stubble via the painted face variant, goatee/full as
  layered beard cards over the jaw. All procedural, all on the
  existing rig; the honest line stands: realistic-STYLED, not
  scanned photoreal.

Budget: initial-load JS 799.1 kB gzip (index 424.1 + three 178.2 +
react-three 185.8 + css/html 11.0) vs Phase 15's 794.1 — +0.6%, the
phase's own code (escort, fleet, farm work, levers). No new eager
chunks; the officer is a single additional rig; density culling
reuses the dormancy path, so Low settings strictly reduce draw work.

## Phase 17 — City Life & Story Depth

Presentation notes for the round (all procedural, in the standing
teal/amber palette; nothing pink/purple; UI stays non-selectable):

- **Bus stop furniture:** each rideable stop gets a kerbside timber
  pole with an amber board and a dark teal inset panel — deliberately
  humbler than the Sable Line's steel-and-teal stations, so the two
  networks read differently at a glance. On the big map the stops are
  amber squares and the bus itself a larger amber square with a teal
  core, distinct from the tram's teal ring and the white traffic dots.
- **The courier van:** an unmarked grey van with a single amber roof
  marker (Ines's description made visible) — it reads as "the van
  from the briefing" without a livery. The tail meter lives in the
  standard hold/meter slot, so it inherits the HUD's styling.
- **The challenger:** an amber hyper exotic parked at the kerb with
  its driver standing at the door in a red-brown jacket and shades,
  turning to face you as you approach. In the race itself the rival
  renders in the race system's supercar class in the same amber —
  noted honestly: the parked show car and the racing rival are the
  same car to the story, two meshes to the engine.
- **Spilled cargo:** five timber crates with dark strap bands (the
  world's existing crate language), scattered across the lane; nearby
  traffic visibly swings wide around the spill and settles back —
  the swerve is a presentation offset, the AI's lane state is never
  touched.
- **The Harbour Wire's paper trail:** headlines land in the Harbour
  Wire news feed after each part (LEDGER IN THE OPEN → THE TUESDAY
  ROUTE → PRINT RUN), so the arc is visible in the same feed the
  story's own chapters print to.

Budget: initial-load JS 806.5 kB gzip (index 431.5 + three 178.2 +
react-three 185.8 + css/html 11.0) vs Phase 16's 799.1 — +0.9%, the
phase's own code (Wire missions, BusRide, Phase17 events). No new
eager chunks; the events own a handful of fixed meshes; the courier
is one extra CarBody while a tail mission runs.

## Phase 18 — Vehicles & Racing Depth

Presentation notes for the round (all procedural, in the standing
teal/amber palette; nothing pink/purple; UI stays non-selectable):

- **Sable Kestrel RS:** the coupe shell track-trimmed — a lower,
  wider stance, a dark front splitter, a fixed rear wing on two
  uprights and visibly fatter rear tyres. It reads as the coupe's
  racing sibling at a glance, not a new silhouette system. Dealer
  colour: racing amber.
- **Bronto Hauler:** the pickup shell grown — taller body on
  oversize all-terrain wheels, a steel bull bar, a roof rack and a
  raised bed, in farm olive. Parked by the Downs barn it belongs to
  the landscape; the same kind occasionally rolls through the farm
  corner's road in traffic.
- **The drift meter:** rides the existing mini-bar (the fishing/gym
  meter slot) — the label carries the live chain (🛞 DRIFT ×N — pts,
  release clean to bank), the marker tracks the estimated slip
  angle, the fill tracks score toward a solid chain. No new HUD
  furniture, no new per-frame React state (the ~8 Hz poll carries
  it, as with fishing).
- **The Sable Cup card:** Phone → Jobs gains a championship card in
  the phone's existing bank-row language — per-round best/points,
  an "Armed ✓" state on the entered round, the series line, and a
  gold voucher row when the crown is won. The voucher shows at both
  dealer counters as "(gold voucher −20%)" in the prompt itself, so
  the price you see is the price you pay.
- **Honest note (drift):** the arcade model has no velocity vector,
  so there is no true slip angle to draw from — the meter's angle
  is an estimate from steering lock + speed while the handbrake is
  held. The scoring is real (chains, banking, collision loss); the
  angle is a model, and game/drift.ts says so.

Budget: initial-load JS 809.1 kB gzip (index 434.1 + three 178.2 +
react-three 185.8 + css/html 11.0) vs Phase 17's 806.5 — +0.3%, the
phase's own code (drift.ts, cup.ts, the two CarBody shells). No new
eager chunks; the new cars reuse the existing shell/interior
construction, so per-car cost is unchanged.

## Phase 19 — Economy & Empire

Presentation notes for the round (all procedural, in the standing
teal/amber palette; nothing pink/purple; UI stays non-selectable):

- **Sable Marina Rentals:** a canvas-texture sign in the SIGNS set
  ("SABLE MARINA — BOAT RENTALS", teal board, amber letters) on
  the pier road above the office counter, so the fourth business
  reads in the world before any prompt does. The rental skiff is
  the existing Harbour Fisher shell in marina white — a rental
  should look like a rental.
- **The rental dock** sits on the pier deck beside the Bay
  Circuit ring: the same water the championship races on is the
  water you rent on. Return prompts name the crew collecting the
  boat; a wreck or an expired pass closes with a marina message
  in the phone, in the same SableBank message language as the
  rest of the economy.
- **Bank app:** businesses gain a "· Lv" badge and an upgrade row
  in the existing bank-row language (cost + the standing promise
  that the shown number is the paid number); staff rows now show
  the CURRENT bonus rate, and Sana Iqbal's row flips to "(night
  rate ×2 — live now)" after 20:00. The Loans section sits
  between Daily income and Invest — tiers as borrow rows when
  clean, one outstanding-loan row with Repay $100 / Repay in full
  when not. No new panels, no new visual language.
- **Honest note (Sana's split):** her "double at night" settles
  as a day/night split of the worked day (14h base + 10h double)
  because the economy tick settles whole days at 06:00 — the
  split is documented in game/economy.ts where the money moves,
  and the live-rate display is the player's window into it.

Budget: initial-load JS 811.3 kB gzip (index 436.3 + three 178.2 +
react-three 185.8 + css/html 11.0) vs Phase 18's 809.1 — +0.3%,
the phase's own code (rentals.ts, the economy growth, the Bank
rows). No new eager chunks.

## Phase 20 — Finale addendum

- **Credits overlay:** a full-screen scrim (dark gradient, ~85%
  opacity) over the still-rendering city — the world stays alive
  behind the roll, which is the point of playing it over the live
  scene rather than a black card. The roll is a single CSS
  keyframe animation (45 s, linear, forwards) — no JS per frame,
  no canvas cost beyond the scene the player was already looking
  at. Type follows the HUD language: amber small-caps section
  heads (var(--accent)), warm off-white lines, a muted FIN.
  Input is locked through the standing dialogueActive gate, so
  no new input plumbing exists to break; Skip is a plain DOM
  button in the dialog language.
- **Start screen:** one new line — "v2.0 — Complete Edition" in
  11 px letterspaced muted teal under the tagline. It is the only
  visual change to the poster screen; the post chain, tiers and
  reflection stack are exactly as Phase 19 left them.
- **NG+ presentation:** deliberately zero new visual language —
  the badge is text on the existing chapter line, the confirm is
  the phone's own row/note language, and the reset is announced
  through the standard Harbour Wire + phone-message channels.
- **Perf sanity (final):** initial-load JS 812.7 kB gzip (index
  437.4 + three 178.2 + react-three 185.8 + css 10.6 + html 0.7)
  vs Phase 19's 811.3 — +0.2%, the phase's own code (ngplus.ts,
  the credits markup/CSS, the Phone rows). No new chunks, eager
  or lazy. Phase 17–20 hot-loop check: drift ticks inside the
  existing Vehicle step with scalar math; dispatch steps inside
  the existing traffic loop; the rental watch is scalar checks
  in Phase7's frame loop; loans/upgrades settle inside the
  guarded daily tick (once per game day, not per frame); NG+
  multipliers are scalar reads in the cop step, the bust fill
  and effectivePayout; the credits roll is CSS. No Phase 17–20
  system adds per-frame React state or a hot-loop allocation.

## Phase 21 — Life & Feel addendum

- **Staff in the world:** hired staff render with the Phase 9
  townsfolk pattern verbatim — buildHumanoid rigs, a canvas label
  sprite (name in warm off-white, business + trait in teal) shown
  within 42u, ground-snapped pacing at walking intensity. The only
  new visual language is the WORK COLOURS, one per person so a
  staffer reads at a glance: Tom Beck teal #1f7a72, Marta Reyes
  amber #c9922e, Dev Okafor harbour blue #3f7fae, Sana Iqbal rust
  #b4622d (palette-safe: teal/amber family, no pink/purple). Sana
  is a night presence — her rust top under streetlight at the
  frontage is the trait made visible. Posts rebuild only when the
  on-shift signature changes and step only within 110u of the
  player; off-shift there is no mesh at all (clean despawn).
- **Impact feel:** no new visuals — the existing camera-shake rig
  (G.shakeAmp, already decay-shaped in the App camera) now takes a
  damage-scaled impulse from the driven car's step, so a hard hit
  reads harder than a scrape instead of the old flat 0.3 event
  shake. Sound is the existing sfx.thud() (low-passed noise burst)
  — deliberately duller than sfx.crash(), which stays the wall
  branch's voice.
- **Speed FOV:** the chase camera already widened with speed; the
  change is restraint — +8° cap (was +14°), gentler slope, and an
  off switch. At the cap the widening is a sensation, not a fisheye.
- **Landing:** the fall is a mesh trick, honestly labelled: the sim
  ground-snaps (unchanged), and the visual hang + gravity drop is
  layered on the driven car's mesh only, so for ~0.4 s the car
  falls the way the eye expects off a deck edge. The touchdown dip
  is the C++ vehicle_body spring absorbing a velocity kick — the
  same heave/pitch the wheels already animate — and the dust burst
  reuses the tyre-smoke sprite pool with a surface-tinted colour
  (dirt brown / sand pale). No new particle system, no new textures.
- **Perf sanity:** initial-load JS 814.4 kB gzip (index 439.2 +
  three 178.2 + react-three 185.8 + css 10.6 + html 0.7) vs Phase
  20's 812.7 — +0.2%, the phase's own code (staffworld.ts,
  StaffWorld.tsx, the Vehicle feel blocks). No new chunks. The
  staff signature check is one short string build per frame; the
  feel systems are scalar math on values the step already computes.

## Phase 22 — City Rhythm & Odd Jobs addendum

- **City rhythm:** no new visuals — the change is population and
  timing. At rush the existing ambient pool simply runs fuller
  (share ×1.3 toward the High cap) and the pavements carry the
  full crowd fraction more of the day; at deep night both thin to
  ×0.7, so 03:00 reads emptier than 18:00 ever did. The one new
  HUD element is the **Rush hour chip**: amber glass pill
  (rgba(64,42,8,.78) ground, #ffcf87 text, amber border) under the
  weather chip — squarely in the harbour teal/amber palette, no
  new colours introduced.
- **Valet cars:** the three customer cars reuse existing CarBody
  shells (coupe / SUV / classic) in guest colours (slate, harbour
  blue, oxblood) with "Guest's …" model names — no new geometry.
  The objective is the standard amber job pillar at the bay; the
  frontage spawn points are the world's existing hail kerbs, so
  the car reads as a guest's car at a hotel door, not a prop.
- **Courier sprint:** marker-only (the standard job pillar + GPS
  route); the countdown lives in the marker label and the Jobs
  app, so the sprint reads through the game's existing job
  language. No new meshes.
- **Horn reactions:** the ped startle is the existing knock-slide
  integration plus the arms-up flinch pose (Phase 6 A6 language) —
  a hop aside, not a new animation. The traffic pull-over reuses
  the Phase 17 swerve mesh offset (same 1.9u lateral path, now
  shared and clamped), so a honked-at car eases kerb-ward exactly
  the way a cargo-dodging car already does; the AI underneath
  never moves.
- **Perf sanity:** initial-load JS 817.0 kB gzip (index 441.7 +
  three 178.2 + react-three 185.8 + css 10.6 + html 0.7) vs Phase
  21's 814.4 — +0.3%, the phase's own code (rhythm.ts, horn.ts,
  the jobs/Phase7/Phone additions). No new chunks; cc0Data stays
  lazy. Rhythm is two scalar reads per traffic step; the horn
  reaction runs only on a horn event (cooldown-gated); the Rush
  chip rides the existing 8 Hz HUD poll.

## Phase 23 — Night & Fares addendum

- **Club Solace, dressed for the night:** the room keeps its Phase 3
  shell (stage, beams, SOLACE neon) and gains the working-venue
  layer. The dance floor is now a **6×4 tile grid** over the old
  inlay: each tile's emissive lerps slowly between the house teal
  (#2ee6c8) and amber (#ffb340) with checkerboard phase offsets, so
  a soft wave crosses the floor instead of a uniform pulse. The
  palette discipline holds — teal/amber only, no pink/purple.
- **The floor is fuller:** dancers go from 4 to **7**, spread across
  the grid on the same rig and arms-up sway the room has always
  used. No new animation system; density does the work.
- **The bouncer:** a broad, bald, black-jacket rig stands at the
  exterior door beside the queue, forearms pinned across his chest
  after the idle pass — he reads as door staff from across the pier
  road, which is the entire job. The queue (Phase 6) still waits
  beside him.
- **The drink's warmth:** the Harbour Sunset's vignette is a DOM
  overlay (radial gradient, transparent centre → warm amber edges,
  pointer-events none) driven by the 8 Hz HUD poll — it sits under
  the door fade and never touches the post chain, so it costs no
  render pass. Cosmetic only, as documented everywhere it appears.
- **The bass:** an original WebAudio loop (sine bass figure + soft
  kick through its own gain) that exists only inside the room —
  started/stopped on the interior transition, so the street stays
  silent and the room has a pulse the moment the fade lands.
- **Taxi personalities are presentational too:** the type is carried
  by words, not new art — the marker label, the hail toast's
  description, the boarding bark and the completion breakdown. The
  Nervous passenger's mid-ride complaint is timed to the first
  knock, which is what makes the zero-tip rule *felt* rather than
  discovered at the kerb.
- **Perf sanity:** initial-load JS 819.4 kB gzip (index 444.1 +
  three 178.2 + react-three 185.8 + css 10.7 + html 0.7) vs Phase
  22's 817.0 — +0.3%, the phase's own code (club.ts, the bass
  scheduler, the Interiors/Phase7/economy additions). No new
  chunks; cc0Data stays lazy. The floor cycle is 24 material lerps
  on scratch colours inside Interiors' existing useFrame; the
  drink vignette rides the 8 Hz poll as a boolean.
