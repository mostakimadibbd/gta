# Harborfall — Development Blueprint & Roadmap

*Port Sable is an original city and Harborfall an original game. This document
adapts the user's "complete open-world game blueprint" into Harborfall's
official roadmap. Every item is marked honestly against the shipped game:*

✅ **Done** · 🟡 **Partial** · ⬜ **Planned** (with target phase)

> **Official blueprint: user-supplied PDF, Nov 2026, 15 sections** — the PDF
> is the reference of record; this file reconciles it against the shipped
> game. Phase 4 (this release) shipped the PDF's cheap in-round items:
> crouch/stealth, phone Camera = photo mode, and shake/FOV settings.

---

## 1. World & Map
- ✅ Island harbour city (~250×250u), 6 named districts: The Docks, Market Row, Lantern Park, Gull Heights, Ferry Quarter, East Yards
- ✅ 61 buildings + 9 glass towers (34–54u), road grid, sidewalks, crosswalks, manholes, cycling traffic lights
- ✅ Landmark scenes: ferris wheel, beach + lifeguard hut, suburb houses + mansion, industrial port (cranes/containers/ships), airport scenery, highway gantry, nightclub exterior, countryside corner, "PORT SABLE" hillside sign
- ✅ Bay Bridge is now a DRIVABLE raised causeway (deck profile + ramps, ground-height sampling for player/cars) leading to **Coral Shores** — a second city across the bay: ~4×3 block grid, ~23 buildings + 4 glass towers with the facade treatment, palm boulevards, beach, fuel station #4, pawn shop, 4 parked cars, its own traffic loop (6 cars) + 6 peds, district name on HUD/minimap/big map. Police pursue across the bridge (Phase 4)
- ✅ Scenic hillside overlook with parked silver supercar (Phase 2)
- ✅ Safehouses — buy the Sable Heights Villa ($7,500): respawn moves there and its drive is a garage save point (Phase 3)
- 🟡 Building interiors (PDF priority list) — safehouse ✅ (villa), garage ✅ (Lina's), club ✅ (Club Solace), shop 🟡 (register robbery points at 4 storefronts, no walk-in interior), police station ⬜, clinic ⬜, restaurant ⬜ (Phase 5)
- ✅ Facade & street detail pass: window depth/blinds/lit variance, cornices, doors + canopies, wall AC, balconies, stepped annexes; grass tufts, park paths, wet sand, road arrows + stop bars, oil stains, rain puddles, hydrants/mail/bus stops/dumpsters/bicycles (Phase 3)
- ✅ Distance depth: far skyline silhouette ring + second bridge silhouette on the horizon (Phase 3)
- ⬜ Further map expansion beyond Coral Shores (Phase 6)

## 2. Characters
- ✅ Playable protagonist Rayan Kade with full story cast (Tamim, Lina, Elias, Det. Voss, Victor Solano)
- ✅ Articulated humanoids, realistic-styled rebuild: real proportions, tapered limbs, textured skin/cloth/hair, drawn faces, 3 builds, 6+ skin tones, male/female rigs, 10 outfit archetypes
- ✅ Walk/run/idle animation with counter-phase arm swing, breathing, weight shift, run lean
- ✅ Pedestrian life: density varies by district + time of day; seated bench figures and talking pairs (Phase 2)
- ✅ Character select — 6 play-as presets (Rayan Kade + Maya, Darius, Lena, Kenji, Rosa) with rigs/builds/skin tones + 3 outfit colour variants each, live 3D stage with orbiting camera, persisted choice; story text still follows Rayan Kade (Phase 4)
- 🟡 NPC routines — peds walk loops + flee/react; daily schedules planned (Phase 4)
- ⬜ NPC memory / relationships (Phase 5)
- ⬜ Character customisation (clothes/hair shops) (Phase 5)

## 3. Vehicles
- ✅ 11 drivable cars in 9 classes (sedan, hatch, coupe, pickup, van, supercar, muscle, SUV, classic) + rideable motorcycle + gold mansion supercar
- ✅ Steal any parked car; traffic cars react/flee
- ✅ Vehicle damage 0–100: engine smoke >60, power loss, wrecked at 100 (Phase 2)
- ✅ Fuel per car, HUD gauge, 3 fuel stations that refill for cash (Phase 2)
- ✅ Glossy paint with environment reflections, tread tyres, glowing lights; burnout/drift tyre smoke (Phase 2)
- ✅ Motorcycles — the beach Sable Stinger is rideable: seated rider, lean-in cornering, wheelie-lite launch, faster + tighter than cars, small tank (Phase 3)
- ✅ Garage car selection — stored-cars list (max 6, persisted) fed by parking in any garage zone (villa drive + Lina's bay); G opens the select UI with per-car speed/handling/damage/fuel cards; taking a car out swaps with the current one; original model names per kind (Meridian Sedan, Gullwing GT, …) (Phase 4)
- ✅ Vehicle-vs-vehicle physics collisions — player car vs traffic vs police: impulse bounce, speed exchange, damage to both, crash sfx + scaled camera shake; traffic brakes/honks (C++ `resolve_vehicle_collision` + TS mirror) (Phase 4)
- ✅ Vehicle interiors + animation — dashboard, rotating steering wheel (player car), seats/bench visible through clearer glass; front wheels steer on all cars; body pitch/roll from the C++ weight-transfer outputs (Phase 4 / Visual V4)
- ⬜ Boats you can drive (Phase 5) · ⬜ Vehicle customisation (Phase 5)

## 4. Police & Wanted
- ✅ Wanted 1–5★, patrol cars spawn and pursue, BUSTED after 3s pinned at low speed
- ✅ Line-of-sight: cops only know your position while they (or the heli) see you (Phase 2)
- ✅ Last-known-position search: break sight → cops sweep the last seen area while heat cools (Phase 2)
- ✅ Witnesses: crimes near a pedestrian are "called in" after ~1.5s (watch for the **!**) (Phase 2)
- ✅ Roadblocks at 4+★: two patrol cars across your road ahead (Phase 2)
- ✅ Police helicopter at 4+★ with searchlight; red/blue light glow + real light cast from the nearest unit (Phase 2)
- ⬜ 6th star / military response (Phase 5 — design choice: Harborfall caps at 5 by design for now)
- ⬜ Spike strips, police boats (Phase 5)
- ⬜ Emergency-services dispatch simulation (PDF) (Phase 5)

## 5. Combat
- ✅ Combat lite (Phase 3): punch (click/J) with witness-based assault crime, peds tip over then flee; pistol pickups (villa + docks), hitscan fire with tracer/muzzle flash/sparks, ammo HUD — arcade, no gore
- 🟡 Weapon selector lite — Q/Tab cycles fists ↔ pistol with a HUD chip; full weapon wheel + cover system still planned (Phase 5)
- ✅ Non-lethal conflict today: wanted system, busted/wasted outcomes, fines & hospital bills

## 6. Missions & Story
- ✅ 6-chapter story campaign (intro panels, dialogue, objectives, timers, ending) — see STORY.md
- ✅ Repeatable jobs (deliveries, pickups, collections) with payouts
- ✅ Harbour tokens (6 collectibles, $25 each)
- ✅ Mission messages arrive on the phone; payments confirmed by SableBank (Phase 2)
- ✅ Mission debrief screen — completion/failure panel with reward lines, time and balance (Phase 4 / Visual V6)
- ⬜ Side activities: races, taxi fares, tow jobs (Phase 4)
- ⬜ Branching choices in story (Phase 5)

## 7. Economy
- ✅ Cash, mission payouts, collectible income
- ✅ Spending: fines, hospital bills, fuel (Phase 2)
- ✅ Lifetime earnings + fines tracked in SableBank (phone), persisted (Phase 2)
- ✅ Property ownership — Sable Heights Villa buyable for $7,500 at its gate; SableBank records the purchase; garage drive persists one car across sessions (Phase 3). Businesses/car purchases still planned (Phase 5)
- ✅ Theft economy — pickpocketing (behind-target, witness pipeline), shop register robberies (hold-E, instant 2★ alarm, per-shop cooldown + robbed state), car break-ins (smashed window, loot, alarm chance), a persisted stash inventory fenced at Coral Pawn or Lina's; BUSTED confiscates the stash (Phase 4)

## 8. Smartphone
- ✅ Phone overlay (U key / 📱 button): Contacts, Messages, SableBank, Music, Maps, Themes (Phase 2)
- ✅ Contacts call story characters for a line + a gameplay hint (Phase 2)
- ✅ Messages accumulate from missions, story beats and the bank; persisted (Phase 2)
- ✅ Music app plays/stops the "Port Sable Sunset" theme in-game (Phase 2)
- ✅ Camera app = photo mode — hides all HUD, free-look first-person framing, Enter/Capture downloads `harborfall-photo.png` (Phase 4 / PDF delta B)
- ✅ Garage app (view stored cars) + Stash app (loot list + fence value) (Phase 4)
- ⬜ Taxi app, internet browser parody, social feed (PDF) (Phase 5)

## 9. Traffic AI
- ✅ 12 traffic cars on the road grid, lane discipline, intersection turns
- ✅ Traffic stops for the player, flees from crimes, honks (horn = B)
- ✅ Coral Shores runs its own 6-car traffic loop on its grid (Phase 4)
- 🟡 Traffic ignores traffic lights (they cycle visually) — obeying lights planned (Phase 5, per PDF)
- ⬜ Rush-hour density waves (Phase 5)

## 10. Immersion
- ✅ Full day cycle (5 min), golden-hour opening, themes re-grade the whole city
- ✅ Dynamic weather: Clear / Cloudy / Rain / Storm / Fog, weighted state machine (Phase 2)
- ✅ Rain: particle field, wet-road gloss (near-mirror on wet nights), denser fog (Phase 2)
- ✅ Storms: lightning bolt + sky flash + delayed thunder (Phase 2)
- ✅ Birds over the harbour, ambient helicopter, bobbing boats, club queue, streetlight halos (Phase 2)
- ✅ Loading theme song: 102 BPM funk/coastal groove with sections + menu ambience (waves, gulls) (Phase 2)
- ✅ Swimming — wade into deep water at the beach/harbour and paddle; shore exit (Phase 3)
- ✅ Environment motion — animated water surface (drifting normal map), palm crowns sway near the player (Phase 4 / Visual V5)
- ⬜ Seasons (not planned — one eternal golden coast)

## 11. Multiplayer
- 🟡 WebSocket relay server (Python/FastAPI): rooms, state sync, remote avatars, anti-teleport validation — works when a server URL is configured; Vercel can't host the socket server (use Render/Railway/Fly/Docker)
- ⬜ Co-op missions, shared wanted (Phase 6)

## 12. HUD & Interface
- ✅ Minimap + big map (M) with cars, cops, objective, fuel stations
- ✅ Wanted stars, cash, health, bust meter, speedometer, objective banner
- ✅ Weather chip, fuel + damage bars while driving (Phase 2)
- ✅ Poster loading screen with rotating tips, story/how-to panel (Phase 2)
- ✅ 5 personal themes (T / 1–5), full keyboard shortcuts (H), pause/help dialogs
- ✅ Mobile touch controls (joystick, pedals, action buttons)
- ✅ First-person camera (V) — head-height on foot, over-the-hood in cars, drag to look (Phase 3)
- ✅ UI realism overhaul — one dark-glass design language across HUD, panels, dialogs and phone (hairline borders, thin type, tabular numerals, amber hairline accents only; realistic handset with notch + live clock) (Phase 4)
- ✅ Crouch/stealth (X/Ctrl) — crouched rig, ×0.45 speed, witness radius −40%, pickpocket +15%, police sight range reduced, HUD stealth-eye indicator (Phase 4 / PDF delta A)
- ✅ Gyro steering on touch devices — tilt to steer with deadzone/smoothing/neutral calibration, iOS permission flow, buttons override; subtle first-person yaw trim on foot (Phase 4)
- ✅ Settings — camera-shake toggle, FOV slider 50–75°, Post FX + shadow toggles (phone Settings + pause menu), all persisted (Phase 4 / PDF delta C)
- 🟡 Input remapping — fixed bindings + touch/gyro alternatives today; full remapping planned (Phase 5)
- ⬜ Vault / climb movement (PDF) (Phase 5)
- ⬜ Subtitles (PDF accessibility) (Phase 5)
- ⬜ Controller/gamepad support (Phase 5)

## 13. Technical — Engine Note (honest)
Harborfall's engine is **Three.js / React Three Fiber + a C++17 physics core
compiled to WebAssembly (TypeScript fallback) + a Python FastAPI multiplayer
server**, packaged for desktop with Electron. One codebase ships everywhere:
web (Vercel), mobile browsers, Windows .exe and macOS .dmg. Rendering:
ACES filmic tone mapping, PCF-soft sun shadows that follow the player,
PMREM environment reflections, canvas-generated textures (zero asset files).
Unreal Engine 5 photorealism is **out of scope by design**: it cannot ship as
an instant-play browser game on free hosting, which is Harborfall's whole
distribution model. We chase "realistic-styled" — real proportions, textured
materials, filmic light — inside the web stack instead.
- ✅ Post-processing film grade: bloom, warm hue/contrast grade, film grain, vignette, SMAA — desktop only; auto-disabled on coarse-pointer/mobile devices (Phase 3)
- ✅ Procedural PBR maps — canvas height→normal maps (asphalt, concrete, brick, facade, sand, grass) + roughness variation on roads/sidewalks; deepened facade grime/AO (Phase 4 / Visual V2–V3)
- 🟡 Physics v2 — C++ source extended (vehicle step v2 grip/weight-transfer, vehicle collision, swept AABB, ped separation) with an exact TypeScript mirror; g++ smoke test passes. The shipped `.wasm` binary refresh still needs an Emscripten environment (emcc unavailable where this was built) — the loader falls back per-function, so behaviour is identical either way (Phase 4)
- ✅ LOD/perf — peds beyond 120u animate on a 3-frame tick; props/decals/tufts are single instanced draws (frustum-culled), so no district chunk toggles are needed (Phase 4 / Visual V7)

## 14. Phase Plan
- ✅ **Phase 1** — the city, driving, police, story, themes, desktop/web builds (shipped)
- ✅ **Phase 2** — weather, police LOS/search + roadblocks + witnesses, damage & fuel, smartphone, NPC life, overlook + bay bridge, visual realism overhaul, character realism rebuild, poster loading screen, theme-song upgrade (this release)
- ✅ **Phase 3** — visual round 2 (rounded sculpted cars, post-processing grade, facade/ground/prop detail, skyline ring) + rideable motorcycle, two enterable interiors (garage + club), swimming, first-person camera, combat lite (punch + pistol), buyable villa with garage save (this release)
- ✅ **Phase 4** — UI realism overhaul (dark glass), garage car selection, character select (6 presets), C++ physics v2 + vehicle collisions, drivable Bay Bridge + Coral Shores (second city), theft system (pickpocket/robberies/break-ins/pawn), gyro steering, PDF deltas (crouch, photo mode, shake/FOV settings), Visual Upgrade V1–V7 (audit doc, normal maps, weathering, vehicle interiors, water/palm motion, debrief screen + weapon selector, far-ped tick skip) (this release)
- ⬜ **Phase 4.5** — traffic obeys lights, rush hour, gamepad, side activities (races, taxi, tow)
- ⬜ **Phase 5** — more interiors, customisation, NPC memory, businesses, 6-star design review
- ⬜ **Phase 6** — multiplayer co-op, map expansion

**Status tally (recounted Phase 4):** ✅ Done 71 · 🟡 Partial 7 · ⬜ Planned 16
*QA note (PDF §QA): each release is accepted against build-pass + in-game smoke checks of the new systems; a formal written QA checklist pass is tracked as a Phase 5 item.*
