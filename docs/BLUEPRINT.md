# Harborfall — Development Blueprint & Roadmap

*Port Sable is an original city and Harborfall an original game. This document
adapts the user's "complete open-world game blueprint" into Harborfall's
official roadmap. Every item is marked honestly against the shipped game:*

✅ **Done** · 🟡 **Partial** · ⬜ **Planned** (with target phase)

---

## 1. World & Map
- ✅ Island harbour city (~250×250u), 6 named districts: The Docks, Market Row, Lantern Park, Gull Heights, Ferry Quarter, East Yards
- ✅ 61 buildings + 9 glass towers (34–54u), road grid, sidewalks, crosswalks, manholes, cycling traffic lights
- ✅ Landmark scenes: ferris wheel, beach + lifeguard hut, suburb houses + mansion, industrial port (cranes/containers/ships), airport scenery, highway gantry, nightclub exterior, countryside corner, "PORT SABLE" hillside sign
- ✅ Bay Bridge over the harbour + hazy far-shore skyline (Phase 2, scenery)
- ✅ Scenic hillside overlook with parked silver supercar (Phase 2)
- 🟡 Safehouses — the pier spawn + hospital respawn exist; ownable safehouses planned (Phase 4)
- ⬜ Building interiors (Phase 5 — big cost, only a few hero interiors)
- ⬜ Second island / expanded map (Phase 6)

## 2. Characters
- ✅ Playable protagonist Rayan Kade with full story cast (Tamim, Lina, Elias, Det. Voss, Victor Solano)
- ✅ Articulated humanoids, realistic-styled rebuild: real proportions, tapered limbs, textured skin/cloth/hair, drawn faces, 3 builds, 6+ skin tones, male/female rigs, 10 outfit archetypes
- ✅ Walk/run/idle animation with counter-phase arm swing, breathing, weight shift, run lean
- ✅ Pedestrian life: density varies by district + time of day; seated bench figures and talking pairs (Phase 2)
- 🟡 NPC routines — peds walk loops + flee/react; daily schedules planned (Phase 4)
- ⬜ NPC memory / relationships (Phase 5)
- ⬜ Character customisation (clothes/hair shops) (Phase 5)

## 3. Vehicles
- ✅ 11 drivable cars in 9 classes (sedan, hatch, coupe, pickup, van, supercar, muscle, SUV, classic) + gold mansion supercar
- ✅ Steal any parked car; traffic cars react/flee
- ✅ Vehicle damage 0–100: engine smoke >60, power loss, wrecked at 100 (Phase 2)
- ✅ Fuel per car, HUD gauge, 3 fuel stations that refill for cash (Phase 2)
- ✅ Glossy paint with environment reflections, tread tyres, glowing lights; burnout/drift tyre smoke (Phase 2)
- 🟡 Motorcycles — parked props only; rideable bikes planned (Phase 4)
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

## 5. Combat
- ⬜ Melee + firearms (Phase 4 — the current game is deliberately non-graphic: knock-aside collisions, no gore)
- ⬜ Cover system, weapon wheel (Phase 4, with combat)
- ✅ Non-lethal conflict today: wanted system, busted/wasted outcomes, fines & hospital bills

## 6. Missions & Story
- ✅ 6-chapter story campaign (intro panels, dialogue, objectives, timers, ending) — see STORY.md
- ✅ Repeatable jobs (deliveries, pickups, collections) with payouts
- ✅ Harbour tokens (6 collectibles, $25 each)
- ✅ Mission messages arrive on the phone; payments confirmed by SableBank (Phase 2)
- ⬜ Side activities: races, taxi fares, tow jobs (Phase 4)
- ⬜ Branching choices in story (Phase 5)

## 7. Economy
- ✅ Cash, mission payouts, collectible income
- ✅ Spending: fines, hospital bills, fuel (Phase 2)
- ✅ Lifetime earnings + fines tracked in SableBank (phone), persisted (Phase 2)
- ⬜ Property/business ownership, car purchases (Phase 4–5)

## 8. Smartphone
- ✅ Phone overlay (U key / 📱 button): Contacts, Messages, SableBank, Music, Maps, Themes (Phase 2)
- ✅ Contacts call story characters for a line + a gameplay hint (Phase 2)
- ✅ Messages accumulate from missions, story beats and the bank; persisted (Phase 2)
- ✅ Music app plays/stops the "Port Sable Sunset" theme in-game (Phase 2)
- ⬜ In-phone camera, taxi app, internet browser parody (Phase 5)

## 9. Traffic AI
- ✅ 12 traffic cars on the road grid, lane discipline, intersection turns
- ✅ Traffic stops for the player, flees from crimes, honks (horn = B)
- 🟡 Traffic ignores traffic lights (they cycle visually) — obeying lights planned (Phase 3)
- ⬜ Rush-hour density waves (Phase 3)

## 10. Immersion
- ✅ Full day cycle (5 min), golden-hour opening, themes re-grade the whole city
- ✅ Dynamic weather: Clear / Cloudy / Rain / Storm / Fog, weighted state machine (Phase 2)
- ✅ Rain: particle field, wet-road gloss (near-mirror on wet nights), denser fog (Phase 2)
- ✅ Storms: lightning bolt + sky flash + delayed thunder (Phase 2)
- ✅ Birds over the harbour, ambient helicopter, bobbing boats, club queue, streetlight halos (Phase 2)
- ✅ Loading theme song: 102 BPM funk/coastal groove with sections + menu ambience (waves, gulls) (Phase 2)
- ⬜ Swimming (Phase 4) · ⬜ Seasons (not planned — one eternal golden coast)

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
- ⬜ Controller/gamepad support (Phase 3)

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

## 14. Phase Plan
- ✅ **Phase 1** — the city, driving, police, story, themes, desktop/web builds (shipped)
- ✅ **Phase 2** — weather, police LOS/search + roadblocks + witnesses, damage & fuel, smartphone, NPC life, overlook + bay bridge, visual realism overhaul, character realism rebuild, poster loading screen, theme-song upgrade (this release)
- ⬜ **Phase 3** — traffic obeys lights, rush hour, gamepad, performance pass
- ⬜ **Phase 4** — combat (non-graphic melee first), rideable motorcycle, swimming, side activities, safehouses
- ⬜ **Phase 5** — interiors (hero set), customisation, NPC memory, 6-star design review
- ⬜ **Phase 6** — multiplayer co-op, map expansion

**Status tally:** ✅ Done 48 · 🟡 Partial 5 · ⬜ Planned 21
