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
- 🟡 Building interiors (PDF priority list) — safehouse ✅ (villa), garage ✅ (Lina's), club ✅ (Club Solace), police station ✅ (Harbour Patrol HQ lobby + desk surrender, Phase 7), clinic ✅ (Sable Clinic, heal inside, Phase 7), restaurant ✅ (Marina Table — sit + $25 set menu, Phase 7), airport hangar ✅ (Sable Field, Phase 9), shop 🟡 (register robbery points at 4 storefronts, no walk-in interior)
- ✅ Facade & street detail pass: window depth/blinds/lit variance, cornices, doors + canopies, wall AC, balconies, stepped annexes; grass tufts, park paths, wet sand, road arrows + stop bars, oil stains, rain puddles, hydrants/mail/bus stops/dumpsters/bicycles (Phase 3)
- ✅ Distance depth: far skyline silhouette ring + second bridge silhouette on the horizon (Phase 3)
- ✅ Further map expansion beyond Coral Shores — Northgate district + causeway + Sable Island (Phase 6); Sable Field working airfield + Sable Downs dirt loop (Phase 9)

## 2. Characters
- ✅ Playable protagonist Rayan Kade with full story cast (Tamim, Lina, Elias, Det. Voss, Victor Solano)
- ✅ Articulated humanoids, realistic-styled rebuild: real proportions, tapered limbs, textured skin/cloth/hair, drawn faces, 3 builds, 6+ skin tones, male/female rigs, 10 outfit archetypes
- ✅ Walk/run/idle animation with counter-phase arm swing, breathing, weight shift, run lean
- ✅ Pedestrian life: density varies by district + time of day; seated bench figures and talking pairs (Phase 2)
- ✅ Character select — 6 play-as presets (Rayan Kade + Maya, Darius, Lena, Kenji, Rosa) with rigs/builds/skin tones + 3 outfit colour variants each, live 3D stage with orbiting camera, persisted choice; story text still follows Rayan Kade (Phase 4)
- ✅ NPC routines — peds walk loops + flee/react + destinations; named townsfolk keep full daily schedules (Phase 9, see §15.5)
- ✅ NPC memory / relationships — per-zone reputation + per-ped witness/victim/helped memory (Phase 8, see §15.5)
- ✅ Character customisation — Thread & Tide clothing (Phase 8) + Sable Cuts hair / Port Ink tattoos (Phase 9)

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
- ✅ Boats you can drive — speedboat (Phase 6) + fishing skiff, second class (Phase 9) · ✅ Vehicle customisation — Lina's mods: respray/engine/brakes/tyres (Phase 6)

## 4. Police & Wanted
- ✅ Wanted 1–5★, patrol cars spawn and pursue, BUSTED after 3s pinned at low speed
- ✅ Line-of-sight: cops only know your position while they (or the heli) see you (Phase 2)
- ✅ Last-known-position search: break sight → cops sweep the last seen area while heat cools (Phase 2)
- ✅ Witnesses: crimes near a pedestrian are "called in" after ~1.5s (watch for the **!**) (Phase 2)
- ✅ Roadblocks at 4+★: two patrol cars across your road ahead (Phase 2)
- ✅ Police helicopter at 4+★ with searchlight; red/blue light glow + real light cast from the nearest unit (Phase 2)
- ✅ 6th star / heavy response — heat rule at 5★ raises the 6th star; the response is the Harbour Guard SUV + K9 (Phase 9, see §15.6)
- ✅ Spike strips (Phase 6), police boats (Phase 9)
- 🟡 Emergency-services dispatch simulation (PDF) — parked + traffic ambulance/fire units and a rushing-ambulance world event exist (Phase 7); a full dispatch simulation (calls generated, units routed) is not built

## 5. Combat
- ✅ Combat lite (Phase 3): punch (click/J) with witness-based assault crime, peds tip over then flee; pistol pickups (villa + docks), hitscan fire with tracer/muzzle flash/sparks, ammo HUD — arcade, no gore
- ✅ Weapon selector — Q/Tab cycles 6 slots (fists · pistol · SMG · shotgun · bat · bottles) with a HUD chip; cover system formalised (Phase 6), free-aim mode added (Phase 9)
- ✅ Non-lethal conflict today: wanted system, busted/wasted outcomes, fines & hospital bills

## 6. Missions & Story
- ✅ 6-chapter story campaign (intro panels, dialogue, objectives, timers, ending) — see STORY.md
- ✅ Repeatable jobs (deliveries, pickups, collections) with payouts
- ✅ Harbour tokens (6 collectibles, $25 each)
- ✅ Mission messages arrive on the phone; payments confirmed by SableBank (Phase 2)
- ✅ Mission debrief screen — completion/failure panel with reward lines, time and balance (Phase 4 / Visual V6)
- ✅ Side activities (Phase 7): street races (3 events, AI rivals, bets), taxi fares, Lina's delivery chain — tow jobs ✅ (Phase 8: Sable Wrecker + tether towing)
- ✅ Branching choices in story — one real choice in Ch.5 (side with Voss / warn Elias) changing Ch.6's opening, ending and payout split; persisted (Phase 5)
- ✅ Side storylines — "Lina's Line" + "Voss's File", 3 parts each, phone-offered, persisted progress (Phase 5)

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
- ✅ Taxi app (Jobs app, Phase 7), social feed (SableSocial, Phase 7), in-phone browser (SableWeb — live-data local web, Phase 9)

## 9. Traffic AI
- ✅ 12 traffic cars on the road grid, lane discipline, intersection turns
- ✅ Traffic stops for the player, flees from crimes, honks (horn = B)
- ✅ Coral Shores runs its own 6-car traffic loop on its grid (Phase 4)
- ✅ Traffic obeys traffic lights — signal states gate the traffic step at 8 intersections (Phase 6)
- ✅ Rush-hour density waves (Phase 6)

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
- ✅ Vault / climb movement (PDF) — Space near a bench/hedge vaults it (Phase 6)
- ✅ Subtitles (PDF accessibility) — cinematic letterbox renderer, typewriter reveal, size/background settings, ambient barks (witness shouts, dispatch radio, busted) as subtitles (Phase 5)
- ✅ Quality tiers — Low/Medium/High with first-run auto-detect + one-time FPS step-down; gates composer/SSAO/shadows/normals/CC0/water/paint (Phase 5)
- ✅ Real CC0 PBR textures — Poly Haven asphalt/concrete/brick/plaster embedded (955 KB, ASSETS_LICENSES.md); procedural route kept for Low + new plaster/tile/corrugated set (Phase 5)
- ✅ UI redesign + solidity — one design system, single right-side HUD stack, safe-area insets, compact mode <560px, zero selectable UI (Phase 5)
- ✅ Camera boom guard — third-person camera clamps against building AABBs instead of clipping inside them (Phase 5)
- ✅ Controller/gamepad support — standard mapping, analog sticks, triggers, LT free-aim (Phases 8–9)

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
- ✅ **Phase 4.5** — traffic obeys lights ✅ and rush hour ✅ landed in Phase 6; races + taxi jobs ✅ landed in Phase 7; gamepad + tow jobs ✅ landed in Phase 8 — closed
- ✅ **Phase 5 (shipped as the realistic-visuals + story/UI round)** — quality tiers, equirect env + water shader + SSAO, CC0 PBR route, clearcoat cars + headlight beams, character material/animation pass, deepened story + 2 side arcs + Ch.5 choice, cinematic subtitles, UI redesign. Still open from the original Phase 5 list: more interiors, customisation, NPC memory, businesses, 6-star design review
- ✅ **Phase 6 — "Proper Game" (this release)** — Northgate district + causeway + Sable Island; traffic obeys lights + queues + rush hour + reckless driver; bus (route + stops) / taxi / bicycle / speedboat; NPC destinations, phone-peds, dog walker, vendor, rain shelter, night club drift; police spike strips, surrender, heli searchlight, disguise-lite; SMG + shotgun, 4-slot Q, recoil, muzzle light, cover; stamina, skills + phone Stats, vault, limp, food/hospital heals; vehicle mods (B1); random world events (B2); shop hours (B3); character realism pass 3 (B4); C++ physics v3 source + TS mirror + smoke test (B5, WASM binary not rebuilt — no emcc); full game-flow pipeline (splash → staged loading → spawn sweep → streaming → area cards → respawn screens). Detailed 500-list mapping in §15.
- ✅ **Phase 7 — "The 500 Sweep, Round 1" (this release)** — jobs system (taxi fares with hailing peds, tips + star ratings; Lina's delivery chain) in a phone Jobs app; 3 street races with AI rivals, checkpoint framework, positions, prizes + optional $100 bet; interiors round (Harbour Patrol HQ + desk surrender, Sable Clinic, Marina Table restaurant); buyable businesses (Wraps stall / Car Wash / Club Solace share) with a single daily income tick (06:00 rollover — sleeping triggers the same tick) + Coral Shores Apartment (second home, garage-save #2, sleep); THE HARBOUR HEIST two-stage chain (prep stealth bonus → strongroom drill → escape); mission checkpoints + retry-from-checkpoint (R), chapter replay at 40% (Story app), mission stats; phone News (Harbour Wire, generated from player actions) + SableSocial apps; GPS route polyline on the big map; world sweep — causeway toll booth, 3 speed cameras, destructible crates/barrels/fences (respawn next day), bench/chair sitting, vendor cooler drink, wind gusts (palms/boats/HUD), fish; emergency vehicles (parked + traffic ambulance/fire + rushing-ambulance event); player idle variations + swim dive entry. Detailed per-topic account in §15.
- ✅ **Phase 8 — "The 500 Sweep, Round 2" + realism/cars/joystick/smoothness/language escalations (this release)** — fishing (pier + island dock, charge/cast/bite/reel loop, 5 fish by place/time, sell at Harbour Wraps, best catch persisted); Sable Fitness outdoor gym at Lantern Park (bench + treadmill rhythm sessions, Strength skill added as the 4th skill); NPC memory & recognition (per-zone reputation + per-ped witness/robbed/helped memory, recognition barks, victims avoid you for a day, witnesses point you out to cops); SableBank Invest (3 fictional local stocks, hourly random walk + documented event nudges, $100 lots, portfolio P/L); baseball bat (5th Q slot, Lantern Park pickup + Sable Arms, knockback swing); Thread & Tide clothing shop (counter + rack on Market Row, outfit override layer with a documented select-screen rule); tow jobs (Sable Wrecker at Lina's, reverse-to-hook, tether-with-swing towing, $150/delivery); gamepad support (standard mapping, analog sticks, toast + Help table); CHARACTER REALISM PASS 4 (heel-toe stride-matched walk cycle, finger-block hands, 1024² faces on Med/High, alpha hair cards, subsurface-look skin, breathing + blink); EXOTIC CARS (original Vantara S wedge with scissor doors, Kestrel One hypercar with active wing, Marlowe GT — dealership + traffic, no real brands); MOBILE JOYSTICK rebuilt (floating origin, true analog with deadzone + expo curve, gyro yields to a deflected stick); GRAPHICS SMOOTHNESS (dynamic resolution ladder, continuous adaptive tier with manual-override respect, HUD snapshot at 5 Hz, hot-loop allocation audit, Show FPS option); LANGUAGE REBALANCE (Harborfall Core C++ gains traffic decisions / ped steering v2 / LOS sampling / boat buoyancy / race pacing with smoke tests + TS mirrors; Python server gains /v1/leaderboards + /v1/economy/snapshot with optional client sync; C# Harborfall.WorldTools desktop tooling ships as source — no dotnet SDK in the build environment, not compile-verified). Detailed per-topic account in §15.
- ✅ **Phase 9 — "The 500 Sweep, Round 3" (this release)** — flyable Sable Sparrow (arcade flight model: ground roll, lift-off, stall, ceiling, building strikes, hard-touchdown damage, Sable Field hangar interior as the 6th pocket room); second boat class (Harbour Fisher skiff ×2 spawns); traffic wrecks that persist for the game day + smoulder + traffic diversion; day-rotating roadworks sites with slow zones and hi-vis crews; 4 named townsfolk with real daily schedules and branching dialogue trees (reputation-aware, real effects); police escalation round — 6th wanted star via a heat rule at 5★, Harbour Guard SUV, patrol boat (water bust pressure), K9 unit (on-foot bust pressure); thrown bottles (6th Q slot, break shopfront glass); weapon mods at Sable Arms (2 suppressors, extended mag, reflex sight, shotgun choke); free-aim mode (hold RMB / gamepad LT — over-shoulder camera, camera-ray fire); barber + tattoo shop (Sable Cuts / Port Ink — hair style/colour + ink on the existing rig, reset at Character Select); post-story pack "After the Fall" (3 missions, publish-vs-burn choice with world consequences); SableWeb in-phone browser (5 pages rendered from live game data); photo Gallery app (captures persist, deletable); business staffing-lite (+50% takings, $35/day wage, Bank app); shop hours enforced at every counter; procedural ragdoll-lite (WASTED collapse + hit flail) and hands-up arrest pose; day-scoped persistence for wrecks, broken props and smashed glass; Sable Downs dirt loop at the countryside corner. Detailed per-topic account in §15.
- ⬜ **Phase 10 candidates** — multiplayer co-op missions

**Status tally (recounted Phase 9):** the §15 ledger below is the per-topic account of the user's 500-feature list — **93 topic lines: ✅ 82 · 🟡 9 · ⬜ 2**, and every ⬜ carries its specific reason (engine/art-blocked — never silently skipped). Blueprint sections §§1–13 above remain the design roadmap.
*QA note (PDF §QA): each release is accepted against build-pass + in-game smoke checks of the new systems; a formal written QA checklist pass is tracked as a Phase 5 item.*

## 15. The 500-feature list — mapped (Phase 9, "The 500 Sweep, Round 3")

The user's expansion brief listed ~500 desired features in 12
categories. This is the honest ledger, rewritten topic-by-topic in
Phase 7: ✅ implemented and playable · 🟡 lightweight equivalent (the
equivalent is named) · ⬜ not in — with the specific reason (engine
limit of the browser build, or not yet built). Nothing is marked done
that isn't playable, and nothing is silently skipped.

**Tally: 93 topic lines — ✅ 82 · 🟡 9 · ⬜ 2.**

**Languages note (Phase 8):** the authorship of game logic was rebalanced toward the compiled/service languages as far as the platform allows — the **Harborfall Core (C++)** now owns traffic decisions, pedestrian steering+separation, wanted LOS sampling, boat buoyancy and race pacing (with g++ smoke tests and exact TypeScript mirrors; the WASM binary itself is rebuilt only where emcc exists); the **Python** FastAPI service adds leaderboards + economy snapshots; **C#** covers desktop world/save tooling (`tools/`). TypeScript remains the browser presentation shell + glue — browsers execute JS/WASM natively, which is a platform constraint, not a preference (see README "Languages").

### 1. Open World & Map
- ✅ Three connected landmasses: Port Sable (6 districts), Coral Shores, Northgate, plus Sable Island
- ✅ Bay Bridge + causeway crossings, fully drivable, police pursue across
- ✅ Drivable 2-deck parking garage (Northgate)
- ✅ Interiors I: Lina's Garage + Club Solace pocket rooms (Phase 3)
- ✅ Interiors II (Phase 7): Harbour Patrol HQ lobby (front desk = surrender point, wanted-poster wall, cells), Sable Clinic (waiting room, heal $50 inside), Marina Table restaurant (sit at tables, $25 set menu → full heal + stamina boost)
- ✅ Minimap + big map over all districts, district title cards, GPS route (see §11)
- ✅ Landmarks: ferris wheel, lighthouse, port cranes/ships, airport scenery, PORT SABLE hillside sign
- 🟡 Enterable buildings generally — equivalent: 6 hand-built pocket-room interiors (Phase 9 adds the Sable Field hangar) + open parking decks; full per-building interiors are a scope limit (each room is hand-built), not an engine limit
- 🟡 Countryside / playable airport — equivalent: Sable Field is a WORKING airfield now (hangar interior, flyable Sparrow on the strip, tower + terminal blockers) and the countryside corner has the Sable Downs dirt loop (soil circuit, marker posts, sign); a full rural road network with farms is not built — the streaming/draw budget is spent on the three districts
- 🟡 Destructible buildings — equivalent: Market Row shopfront glazing (9 panes) smashes from car rams and thrown bottles (shards + crime), and the Lantern Park scaffold topples when rammed; both persist for the game day and are repaired overnight. The buildings themselves stay static merged geometry — no structural destruction solver exists in the browser physics mirror

### 2. Player & Character
- ✅ 6 character presets × 3 outfit variants (character select)
- ✅ Crouch/stealth + cover, vaulting, limp, stamina + 4 skills with perks (Strength added Phase 8 via the gym)
- ✅ Swimming — plus dive entry (Phase 7: Space at a deep-water edge arcs you in head-first)
- ✅ Sitting (Phase 7: benches city-wide + restaurant chairs; E or any movement key stands)
- ✅ Idle life (Phase 7: after 6 s idle — weight shift, look-around, periodic phone check)
- ✅ Eating/drinking poses (vendor wrap, cooler drink, restaurant meal — hand-to-mouth)
- ✅ First-person camera + photo mode
- 🟡 Faces/hair — equivalent: Phase 8 realism pass 4 — 1024² painted faces on Medium/High (brow ridge, two-tone iris + catchlight, lid lines, stubble density), layered alpha hair cards over the scalp cap, subsurface-look skin, heel-toe stride-matched gait, breathing + blink; still procedural rigs, realistic-STYLED, not scanned/photoreal (browser rig limit, stated since Phase 2)
- ✅ Clothing shop (Phase 8) + haircuts & tattoos (Phase 9): Thread & Tide on Market Row — 6 outfit pieces ($40–$200) applied as an override layer on the current preset (top style + top/bottom colours). Sable Cuts next door (barber): 5 hair styles (crop / flat top / bun / ponytail / bald) × 6 hair colours, $25, applied to the rig's hair system; Port Ink: 3 tattoo designs, $60, worn as an ink band on the forearm. Clothing, look (`harborfall-look`) — Character Select character/variant changes clear BOTH overrides (the documented change-out rule)
- 🟡 Ragdoll — equivalent: procedural ragdoll-LITE — the WASTED collapse is a physics-timed fall (0.45 s ease, body tips to the ground plane, arms flung wide) and car-hit peds flail (fast limb cycle + torso roll + bounce) for 1.2 s before the down state; there is no jointed ragdoll solver in the TS/C++ physics mirror, so limbs stay rig-animated rather than simulated

### 3. Vehicles & Transportation
- ✅ 14 car classes + motorcycle + bicycle + bus + taxi + speedboat, damage/fuel, garages, mods, break-ins
- ✅ Exotic cars (Phase 8, all ORIGINAL designs — no real brands): Vantara S wedge supercar (scissor doors, Sable Motors $25,000, 1 rare traffic), Kestrel One hypercar (active rear wing, $40,000, mansion showpiece), Marlowe GT luxury tourer (dealership + traffic); plus the Sable Wrecker tow truck (see §10)
- ✅ The taxi is a working job vehicle (Phase 7 fare system)
- ✅ Emergency vehicles (Phase 7): ambulance + fire truck — parked units at the clinic/fire point, one traffic variant each on slow loops, lights-off in normal service
- ✅ Two garage-save homes: villa drive + Coral apartment parking (Phase 7)
- ✅ Boats (Phase 9): TWO classes — the Marina Racer speedboat (fast, planing) and the Harbour Fisher 180 skiff (slower workboat with canopy + crates; spawns at Sable Island and the Coral dock), both with wake + beaching; plus a police patrol boat under §6. No yacht ownership (no use case in the economy yet)
- ✅ Player-flyable plane (Phase 9): the Sable Sparrow at Sable Field — a full arcade flight model in the vehicle system: ground roll on the strip, lift-off past ~60 km/h, Shift climbs / Ctrl descends, stall sink below ~47 km/h, 60 u ceiling, building-strike checks while airborne, hard touchdowns and water ditches cost real damage, no bailing out mid-air. Helicopters stay AI-only (ambient + police) — no player heli model this round
- ⬜ Trains — not built: no rail network exists in the city plan; surface transit is covered by the bus loop, taxi work and the causeway

### 4. Traffic & Road
- ✅ Signal obedience + queueing, rush-hour density, reckless driver, honking, bus route with stops
- ✅ Toll booth (Phase 7): Coral causeway — $5 auto-charge through slowly, barrier raises; smashing through at speed = reckless-driving crime, no charge, barrier down 20 s
- ✅ Speed cameras (Phase 7): 3 fixed sites, flash + $75 fine by SableCam phone message over ≈100 km/h, per-camera + clean-minute cooldowns
- ✅ Destructible roadside props (Phase 7, see §12) feed believable traffic chaos
- ✅ Lasting traffic-accident wrecks (Phase 9): a traffic car at 100% damage becomes a WRECK — engine off, hazard smoulder, and it STAYS: wreck positions persist for the whole game day (`harborfall-wrecks`, day-serial scoped), other traffic diverts around it (a car stuck behind one for 8 s reroutes), and the daily tick clears the roads
- ✅ Roadworks events (Phase 9): one site per game day, rotating across Harbour Ave, Dock Road and the Northgate causeway approach — cones, barriers, a digger and spoil heap, two hi-vis workers, and a real traffic slow zone (cars crawl at ~12 km/h through it); the day's site is announced on Harbour Wire

### 5. NPC & Pedestrian AI
- ✅ Destinations (shops/benches/bus stops), sitting, phone-peds with night glow, dog walker, vendor, rain shelter behaviour, club drift
- ✅ Witness/report pipeline (crimes are seen, reported, then wanted rises)
- ✅ SableSocial (Phase 7): ambient NPC posts react to time, weather and district — and to the player's public crimes
- ✅ Conversations (Phase 9): the four named townsfolk (below) hold real branching dialogue TREES — a greeting (which changes if the district knows you), two choices, written responses, and effects with teeth: a meal bought, a gift that makes nearby peds remember kindness, a reputation cost for being rude. Ambient peds keep their contextual barks on top
- ✅ NPC memory & recognition (Phase 8): per-zone reputation (persisted, decays ×0.55 daily) + per-ped memory — crime witnesses remember for 5 game-minutes and recognise you (subtitle barks, zone-named), pickpocket victims avoid you for the rest of the game-day, helped peds greet you; a remembering witness near a cop points you out (extends the reporting marker + last-known). Witnesses who were helped stay quiet unless alone, and hot-zone witnesses report faster
- ✅ Named-NPC daily schedules (Phase 9): four persistent individuals with names, homes and timetables — Tomas Reed (fisherman: pier at dawn, market midday, club in the evening), Priya Nair (market trader: stall by day, Coral viewpoint at dusk), Bea Kowalski (harbourmaster: HQ steps in the morning, docks at noon, restaurant in the evening), Kip Andersen (skater kid: school corner, park afternoons, pier at night). They walk real waypoint routes between stops (sitting where the stop is a bench), show name labels up close, and are talkable (see Conversations)

### 6. Police & Wanted
- ✅ Line-of-sight + last-known-position search, witness delay, roadblocks, spike strips, helicopter (searchlight ≥3★ at night)
- ✅ Surrender, two ways: hold-B on the street at 1★, and the Harbour Patrol HQ front desk (Phase 7) — same $100 fine, no cell
- ✅ Disguise-lite heat decay (swap car/district while unseen), BUSTED/WASTED flows
- ✅ Star cap (Phase 9): SIX stars — at 5★, serious witnessed crime (shooting, robbery, running a ped down) builds star HEAT; the third offence raises the 6th star and Dispatch escalates. The sixth star unlocks the Harbour Guard response (below) and slower heat decay; stars still drop one at a time when you break line of sight
- ✅ Police boats / K9 units (Phase 9): the Harbour Patrol BOAT engages at 2★+ whenever you're on the water — it holds station astern and keeps your wanted cooldown pinned (you cannot shake heat on the water while it's on you). The K9 unit works at 3★+ on foot: a handler-and-dog pair that runs you down faster than you walk, and a dog on you fills the bust meter 1.5×. The 6th star adds the Harbour Guard SUV — faster and tougher than the patrol cars
- 🟡 Arrest animations — equivalent: a real hands-up ARREST POSE — as the bust meter fills (or you hold B to surrender) the player rig raises both arms in proportion to the meter, and the BUSTED flow takes it from there; there is no handcuff/escort animation rig (the character rig has no IK for cuffing), so the arrest itself stays a state + overlay

### 7. Combat & Weapons
- ✅ Fists, pistol, SMG (auto), shotgun (5-pellet) — per-weapon ammo, Q selector, recoil, muzzle light, crouch cover
- ✅ Hit reactions (flinch/fall) and full crime/witness integration
- ✅ Melee weapon (Phase 8): baseball bat — 5th Q-cycle slot, Lantern Park pickup + $150 at Sable Arms/Coral Pawn, no ammo; wider/slower swing with knockback + longer ped-down (longer still at Strength 50+), wooden thock sfx, same assault crime class as fists
- ✅ Thrown weapons (Phase 9): BOTTLES — a 6th Q slot. Crates of empties by Club Solace and the pier restock you (+6, up to 24 carried, persisted as weapon ammo); click/J lobs one on a real gravity arc — a ped hit is an assault (down 3 s), a car hit dents it, bare ground just scares people, and a bottle through a Market Row shopfront smashes the glass (see §1)
- ✅ Weapon mods/attachments (Phase 9): Sable Arms fitting bench — pistol suppressor + SMG suppressor (shots go through the SOFT crime path: no instant report, witnesses only), SMG extended magazine (faster cycle, tighter spread), pistol reflex sight (longer range, tighter cone), shotgun choke (tighter, longer). One-time cash fittings, persisted (`harborfall-wpmods`), shown as fitted at the counter
- ✅ Free-aim aiming mode (Phase 9): hold right-mouse (or gamepad LT) on foot — over-shoulder camera, narrowed FOV, crosshair; the player turns to the camera, movement slows to a strafe, and Combat fires along the actual camera ray instead of the facing snap. Releasing returns to the normal follow camera

### 8. Missions & Story
- ✅ 6 story chapters, Ch.5 choice with payout consequences, 2 side arcs (Lina's Line, Voss's File), repeatables, debriefs, full subtitles
- ✅ THE HARBOUR HEIST (Phase 7): two-stage chain from Old Elias after Ch.4 — Prep (getaway van check + 2 supply crates; finishing unseen banks the stealth bonus) → The Strongroom (hold-position 6 s drill, alarm trips 3★, escape + lose heat); payout $500 + $1,600 scaled by prep quality (+$150 unseen prep, +$400 clean-prep bonus)
- ✅ Mission checkpoints (Phase 7): step checkpoints recorded live; failing offers retry-from-checkpoint on R with a refreshed clock, alongside full restart from the giver
- ✅ Chapter replay (Phase 7): phone Story app replays completed chapters at 40% payout without touching progress
- ✅ Mission stats (Phase 7): attempts + best clear times per mission in the Stats and Story apps
- 🟡 Branching beyond the Ch.5 choice — equivalent: a SECOND full choice now exists — the post-story pack's publish-vs-burn decision (below) rewrites your reputation city-wide or puts the ledger on the front page, and the heist's prep quality still scales its payout; a fully branching mission TREE (missions that unlock/exclude each other across the story) is not built — the story stays a authored line with choice points, by design
- ✅ Post-story mission pack (Phase 9): "AFTER THE FALL" — three missions that unlock when the story ends, offered by phone from their givers: Lina's cross-town parts run ($400), Voss's ledger job with the publish-vs-burn CHOICE ($900 to publish / $500 to burn, with real consequences either way), and Elias's night boat run through three bay checkpoints ($700). Tracked in the Story app like the side arcs; finishing all three earns Tamim's message from inside

### 9. Economy & Businesses
- ✅ Cash + SableBank, dealership purchases, gun shops, pawn fencing, vehicle mods, food/heals
- ✅ Buyable businesses (Phase 7): Harbour Wraps stall $3,500 (+$120/day), Northgate Car Wash $6,000 (+$220/day), Club Solace 50% share $12,000 (+$450/day) — hold-E buy points in the world, ownership + income shown in SableBank
- ✅ Daily income tick (Phase 7): ONE consistent rule — the game-day rollover at 06:00 pays all business income to SableBank with a phone message; sleeping runs the same tick (guarded by day serial, never double-pays)
- ✅ Second property (Phase 7): Coral Shores Apartment $5,000 — respawn-point choice, sleep point, garage-save point #2
- ✅ Sleeping (Phase 7): E at the villa terrace or your apartment → fade to morning, full heal, businesses settle
- ✅ Shop hours (Phase 9): enforced at EVERY counter — Sable Arms (guns + mods), Sable Motors and the Coral dealer (browsing included), Coral Pawn, Thread & Tide, Sable Cuts and Port Ink all refuse with a "closed — opens 07:00" prompt outside 07:00–23:00; Lina's garage and the 24-hour Harbour Wraps vendor keep harbour hours, as posted
- ✅ Stock market, lightweight (Phase 8): SableBank Invest — 3 fictional local stocks (Sable Shipping, Coral Resorts, Northgate Motors), hourly random-walk prices, buy/sell in $100 lots, portfolio value + P/L in the Bank app; prices are nudged by the player's own actions (harbour heist → shipping −8%, race wins → motors +6%, business buys → coral +3%), each nudge announced by a SableBank message. Persisted
- 🟡 Business employees — equivalent: staffing-LITE — each owned business can hire one hand from the Bank app: takings rise 50%, a $35/day wage comes off the same daily tick, and the net is shown before you commit; there is no staff roster, shift rota or management mini-game — a full management sim is a scope call, not an engine limit

### 10. Activities
- ✅ Taxi jobs (Phase 7): fares hail the cab (waving ped + marker), ride along, fare by distance + tip for speed/cleanliness, 1–5★ passenger rating, earnings tracked
- ✅ Delivery jobs (Phase 7): Lina's 3-leg chain formalised in the Jobs app — per-leg pay + $150 chain bonus
- ✅ Street races (Phase 7): Docks Sprint, Bay Run (over the bridge), Northgate Loop — 3 AI rivals on the route, checkpoint sequence, live position, $600/$250/$100 prizes, optional $100 bet (win = $200 back), best times persisted
- ✅ Collectible tokens, photo mode, swimming, island trips
- ✅ Random world events — now 5 (Phase 7 adds the rushing ambulance to the clinic: lights flashing, Dispatch bark, live map marker)
- ✅ Fishing (Phase 8): pier + Sable Island dock spots — hold/release cast with a sweet zone, bite window, hold-to-reel marker mini (line snaps if you over-reel); 5 fish (Harbour Sprat, Sable Mackerel, day Coral Trout, night Night Eel, rare Golden Koi) with sizes by spot/time of day; sell the creel at Harbour Wraps; best catch + totals in Stats, persisted
- ✅ Gym (Phase 8): Sable Fitness OUTDOOR corner at Lantern Park (chosen over a pocket interior — cheaper, in the world) — bench press (Strength) + treadmill (Stamina) rhythm sessions: tap E in the moving zone ×8, $10, once per game-day per station, faster skill gains than ambient use; 50+ Strength makes fists/bat drop peds longer
- ✅ Tow jobs (Phase 8): Jobs app tow shift — Sable Wrecker at Lina's; a stranded car is marked, reverse the hook in and hold still to hitch, tow on a swinging tether (wrecker accel cut while hooked), deliver into Lina's garage zone for $150; stats tracked

### 11. Smartphone / Interface
- ✅ Core apps: Contacts, Messages, SableBank, Music, Maps, Garage, Stash, Stats, Camera, Settings
- ✅ Jobs app (Phase 7): live taxi/delivery status, start-delivery button, race bet toggle, race best times, job earnings
- ✅ Story app (Phase 7): chapter list with lock/complete state, replay buttons, side-arc + heist status
- ✅ News app (Phase 7): Harbour Wire — headlines generated from the player's actual actions (mission completions, chases, purchases, the heist, weather turns), rolling persisted feed
- ✅ Social app (Phase 7): SableSocial — ambient posts + reactions to public crimes (see §5)
- ✅ GPS route (Phase 7): the big map draws a dashed route polyline (Manhattan routing on the road grid; bridge/causeway spines cross-district) to the active mission or job target
- ✅ Game flow: staged loading, splash, spawn sweep, area cards, respawn mini-screens, door fades, no-select solid HUD, wind line in the weather chip tooltip + phone home
- ✅ Gamepad + touch input (Phase 8): standard-mapping gamepad (analog move/steer, right-stick camera, triggers, full button map in Help, connect toast, last-input-wins with keyboard/touch); rebuilt floating analog touch joystick (appears at the thumb, deadzone + expo curve, sprint latch, gyro yields while deflected)
- ✅ Smoothness (Phase 8): dynamic resolution ladder (DPR 1.1–2 by tier cap), continuous adaptive tier drop with manual-override respect, HUD snapshot at 5 Hz, "Show FPS" option in phone Settings + pause Graphics
- ✅ In-phone internet/browser (Phase 9): SABLEWEB — a real in-phone browser with five pages rendered from LIVE game state, not canned text: a home hub, Sable Motors (the actual dealer stock and prices), a weather page (current conditions, wind and the forecast), the Harbour Wire front page (your live news feed), and Classifieds (the real dealer + business listings with prices). It is deliberately a closed local web — Port Sable's intranet, not a fake copy of the open internet
- ✅ Camera gallery persistence (Phase 9): photo-mode captures now ALSO save a downscaled copy to the phone's GALLERY app (newest 10, persisted in localStorage, tap to view full-size, deletable) — the full-res PNG download still happens exactly as before

### 12. World Simulation
- ✅ Day cycle, 5-state weather, shop hours, rush hours, streaming activation + far-ped tick skip
- ✅ Wind gusts (Phase 7): one slow gust value drives palm-frond sway, boat bob/pitch/roll, and a wind label (Calm/Breezy/Windy/Gusting) in the HUD chip + phone
- ✅ Fish (Phase 7): visible fish circling and jumping at the pier, island shallows and Coral shore
- ✅ Destructible props (Phase 7): crates/barrels/fences at the docks, yards, fuel points and the Lantern Park construction line — hit at speed in a car and they break into flying debris; repaired on the next game day
- ✅ The daily tick (Phase 7): day rollover pays businesses and resets destructibles
- ⬜ Seasons / snow — art-blocked, and now confirmed by design: Port Sable is a subtropical harbour city (palms, open water, fishing skiffs); a winter set would need snow materials, bare-tree variants and ice behaviour that do not exist anywhere in the build, and a white palette swap would be a fake. The 5-state weather system (clear/cloud/rain/storm/fog) is the climate range
- 🟡 Persistent world state — equivalent: DAY-SCOPED persistence (Phase 9) — traffic wrecks, smashed shopfront glass and broken destructible props now persist for the whole game day (saved with the day serial, restored on reload, repaired/cleared on the daily tick); the player, economy, jobs, stats, story, look and gallery persist across sessions as before. What still resets per session is ambient traffic/ped placement — full cross-session world simulation is a scope call, not an engine limit
