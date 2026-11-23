# Harborfall — Port Sable

An **original** open-world harbour-city driving adventure that runs in the
browser and as a desktop app. You play Rayan Kade, a former getaway driver
who returns to the coastal city of Port Sable to free his brother from a
corrupt harbour boss's debt ledger.

> **Originality note (intentional):** Harborfall is *inspired by the
> open-world driving genre* — free roam, car stealing, wanted stars, police
> chases, missions, a minimap. Everything else is its own: the city
> (Port Sable), the teal-and-amber coastal-dusk art identity, districts,
> characters, story, car models and branding are all original creations.
> It is not affiliated with Rockstar Games and contains no GTA assets,
> names, map, story or audio.

## Play it

- **Web (Vercel):** open the deployed link — no install, works on phone too.
- **Desktop:** Windows `.exe` / macOS `.dmg` installers (see `desktop/`).

## What's in the game

- **Big living city** — 5×5-block procedural Port Sable: 60+ buildings with
  lit window grids, full road grid with lane markings, sidewalks,
  crosswalks, traffic lights, street lamps, trees, benches, hydrants,
  Lantern Park, Sable Beach and animated harbour water. Six districts:
  The Docks, Market Row, Ferry Quarter, Gull Heights, East Yards, Lantern Park.
- **10 drivable cars** (Sable Sprinter, Harbor Hauler pickup, Gullwing GT,
  Ferry Van, Yardbird…) in different colours/body types — walk up, press E.
- **Traffic AI** — 12 NPC cars driving the road grid, turning at
  intersections, stopping for you, fleeing after a crash.
- **Pedestrians** — 14 walkers on the sidewalks who flee fast cars and heat.
- **Wanted & police** — stealing, collisions and hitting pedestrians raise
  1–5 wanted stars; harbour patrol cars (flashing red/blue light bars)
  chase and ram you. Break line of sight to cool down, or get **BUSTED**
  (fine + respawn) / **WASTED** (hospital respawn).
- **Story campaign** — 6 chapters with dialogue (see `docs/STORY.md`),
  plus 3 repeatable job types (delivery, checkpoint sprint, token run).
- **HUD** — circular minimap (roads, cars, police, mission marker), wanted
  stars, cash, health bar, speedometer, objective banner with distance +
  timer, glowing objective pillar in the world.
- **Day cycle** — sun moves, dusk turns to night, windows and lamps glow.
- **Personal themes** — 5 full-game themes (below), saved automatically.
- **Audio / SFX + opening theme** — all WebAudio-synthesised, no audio files. The start screen plays **"Port Sable Sunset"**, an original opening theme composed for Harborfall (sunset synth-jazz: warm pads, sub bass, soft drums, sax-style lead — written for this game, not copied from any other game's music); it fades out when you press Play. In-game SFX: engine hum tied to speed, police siren wail while wanted, crash impact + thud, car horn (**B** on keyboard, HORN button on touch), door, jump/land, tyre skid, wanted-star sting, dialogue blips, UI clicks, pickup/cash chimes, mission-complete jingle, BUSTED sting and fail tone. **N** mutes everything, theme included.
- **Multiplayer (optional)** — WebSocket rooms via the Python server;
  remote players render in your city. Single-player needs no server.
- **Phase 6 — "Proper Game"** — a third district, **Northgate** (causeway
  north: mansion row, hotel, Sable Motors dealership, Sable Arms, a
  two-deck parking garage you can drive up), **Sable Island** (lighthouse,
  cottages, dock) in the bay, and a real game-flow: splash → poster →
  **staged loading screen** (honest progress from real construction
  stages) → cinematic spawn-in sweep with district title cards.
  Traffic now **obeys the traffic lights**, queues, and swells at rush
  hour; new rides: **city bus** (with a working route), **taxi**,
  **bicycle** (pedal it — costs stamina) and a **speedboat** with wake.
  Police round 2: **spike strips** at 4★ roadblocks, **surrender**
  (hold B at 1★), heli searchlight at night, disguise-lite heat decay.
  Combat round 2: **SMG + shotgun** with per-weapon ammo (Q cycles four
  slots), recoil, muzzle light, cover. Player systems: **stamina**,
  **skills** (Driving/Shooting/Stamina, phone Stats app), **vaulting**,
  limp + slow regen, food stall and hospital heals. **Lina's mods**
  (M in a garage): resprays, engine tunes, brakes. Ambient world
  events, shop hours, and a third character-realism pass (512² painted
  faces, crop/bald hair, jackets). C++ physics v3 source (suspension
  spring/damper + collision friction) with TS mirror + g++ smoke test.
- **Phase 7 — "The 500 Sweep, Round 1"** — **jobs**: drive the yellow
  Sable Cab and fares hail you (fare + tip by speed and cleanliness,
  star ratings), plus Lina's 3-leg **delivery chain** — both run from
  the phone **Jobs app**, earnings in Stats. **Street races**: Docks
  Sprint, Bay Run and Northgate Loop — 3 AI rivals, checkpoints, live
  position, $600/$250/$100 prizes, optional $100 bet, best times.
  **Three new interiors**: Harbour Patrol HQ (surrender at the front
  desk), Sable Clinic (heal inside), Marina Table restaurant (sit +
  a $25 set menu). **Businesses**: buy the Harbour Wraps stall, the
  Northgate Car Wash or a Club Solace share — daily income lands in
  SableBank every game-morning; the **Coral Shores Apartment** is a
  second home (respawn choice, sleep, garage-save #2), and **sleeping**
  at any owned home skips to morning with a full heal. **The Harbour
  Heist**: a two-night chain from Old Elias — prep the getaway van and
  supply crates unseen, then drill the strongroom and run. Missions
  gained **checkpoints** (fail → **R** retries from the last one) and
  **replay** (phone Story app, 40% payout). New phone apps: **News**
  (Harbour Wire headlines written from your actions), **Social**
  (SableSocial) and a **GPS route** on the big map. World sweep: a
  **toll booth** on the causeway ($5 slow, or smash it), **speed
  cameras** ($75 SableCam fines), **destructible** crates/barrels/
  fences, sitting on benches, wind gusts that move palms and boats,
  fish at the pier — and **emergency vehicles**: parked + traffic
  ambulance and fire truck, plus a rushing-ambulance world event.
- **Phase 8 — "The 500 Sweep, Round 2"** — **fishing** at the pier and
  the Sable Island dock (charge, cast, bite, reel — five fish by place
  and time of day, sell the creel at Harbour Wraps); the **Sable
  Fitness** outdoor gym at Lantern Park (bench press + treadmill
  rhythm sessions, a new **Strength** skill); **NPC memory** — Port
  Sable recognises repeat offenders, pickpocket victims avoid you for
  a day, witnesses point you out to cops, and each district keeps a
  reputation that decays overnight; **SableBank Invest** — three
  fictional local stocks that drift hourly and react to your heists,
  race wins and business buys; a **baseball bat** (fifth weapon slot);
  the **Thread & Tide** clothing shop; **tow jobs** with a working
  wrecker and swinging tether; full **gamepad support**; a fourth
  **character realism pass** (stride-matched heel-toe gait, 1024²
  faces, hair cards, blinking, breathing); three original **exotic
  cars** — the Vantara S wedge (scissor doors), the Kestrel One
  hypercar (active rear wing) and the Marlowe GT; a rebuilt
  **floating analog touch joystick**; **graphics smoothness**
  (dynamic resolution + adaptive quality that respects your manual
  choice); and a **language rebalance** — the C++ Harborfall Core now
  decides traffic, pedestrian steering, police line-of-sight, boat
  buoyancy and race pacing, the Python server adds leaderboards and
  economy snapshots, and C# desktop tooling lives in `tools/`.

## Personal themes

Open the pause menu (Esc/P), the side panel, or press **T** / **1–5**:

| # | Theme | Look |
|---|------|------|
| 1 | Harbor Dusk | Teal + amber coastal dusk (default) |
| 2 | Midnight Patrol | Deep navy night, bright lamps, police glow |
| 3 | Desert Gold | Warm sand/gold clear day |
| 4 | Emerald Bay | Lush green-teal day |
| 5 | Noir Mono | Desaturated mono + one red accent |

A theme changes sky/fog, sun + ambient light, water, window/lamp glow,
HUD + minimap colours, your accent ring and Rayan's shirt. The choice is
saved in `localStorage` and applies identically on web and desktop.
(Deliberately no pink/purple theme.)

## Controls

### Keyboard
| Keys | Action |
|---|---|
| WASD / Arrow keys | Move · drive + steer |
| Shift | Sprint (on foot) |
| Space | Jump (foot) · handbrake/drift (car) |
| E / F | Enter/exit car · advance dialogue |
| Enter | Confirm dialogue |
| Esc / P | Pause |
| H / ? | Shortcuts help |
| T | Cycle theme · **1–5** switch theme directly |
| M | Big city map |
| L | Hold / resume day cycle |
| C | Camera near/far |
| N | Mute / unmute |
| R | Respawn when busted/wasted · retry from checkpoint after a mission fail · restart current mission |
| E at a bench / restaurant chair | Sit down (E or move to stand) |
| Space at a deep-water edge | Dive into the water |
| E at your home | Sleep — morning, full heal, businesses pay out |
| Hold E at a business | Buy it (Wraps stall · Car Wash · Club Solace share · Coral apartment) |
| Q / Tab | Cycle weapon — fists · pistol · SMG · shotgun · bat |
| E at the pier / island dock | Fish — hold E to charge, release to cast, tap E on the bite, hold E to reel (keep the marker in the green) |
| E at Lantern Park gym stations | Workout session ($10, once a day each) — tap E in the moving zone ×8 |
| E at Thread & Tide (Market Row) | Tap: browse outfits · hold: buy (worn until you change character/variant) |
| Phone → Jobs → Tow shift | Tow stranded cars with the wrecker at Lina's — reverse the hook in, hold still to hitch, deliver to the yard ($150) |
| Phone → SableBank → Invest | Buy/sell three local stocks in $100 lots |
| Click / J (hold for SMG) | Punch / fire weapon |
| Hold B (on foot, 1★, unarmed) | Surrender — $100 fine, no cell |
| Space near a bench / hedge | Vault over it |
| M (in a car, at a garage) | Lina's mod menu (elsewhere: big map) |
| E at shop counters | Tap: browse · hold: buy (dealership, Sable Arms, pawn) |
| Mouse drag / wheel | Orbit / zoom camera |

### Gamepad
Any standard-mapping controller works alongside keyboard/touch
(last input wins): **left stick** move/steer (analog — push past the
edge to sprint), **right stick** camera, **RT/LT** accelerate/brake,
**A** interact, **B** exit car / back, **X** jump / handbrake,
**Y** phone, **LB** weapon cycle, **RB** horn, **Start** pause.
A toast confirms when a gamepad connects.

### Play on your phone
Open the Vercel link in your phone browser — touch controls appear
automatically on touch devices: a **floating analog joystick** that
appears exactly where your left thumb lands (push gently to walk,
far to run, past the edge to sprint; while driving it steers
analog-style and the **gyro only steers while the stick is centred**) +
JUMP and E buttons on foot; GAS/BRAKE pedals, DRIFT, HORN and EXIT
while driving; a pause button top-right; drag the right side of the
screen to orbit the camera. The side panel collapses behind the ☰ button.

### Graphics quality (Phase 5, smoothness Phase 8)
Three tiers — **Low / Medium / High** — auto-detected on first run
(touch + small screen + low memory start lower) and self-tuning: a
2.5-second FPS sample after you start playing steps the tier down once
if the device struggles. Phase 8 adds **dynamic resolution** (the
render resolution walks a ladder toward your tier's cap to hold frame
rate) and a **continuous adaptive tier** (sustained low FPS drops one
tier with a toast) — picking a tier yourself turns the auto-drop off
for the session. A **Show FPS** readout lives in the same two places.
Override any time in **Pause → Graphics** or **Phone → Settings**.
Low = no post-processing, 1024px shadows, procedural textures only.
Medium = film grade, real CC0 photo textures at 512px, shader water.
High = + SSAO, stronger bloom, CC0 at full size, softer shadows.
Dialogue is fully subtitled (cinematic letterbox + typewriter);
subtitle size/background, ambient barks and the letterbox bars are
adjustable in the same two places.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Web (Vercel) / Desktop (Electron) — same build: client/dist  │
│  TypeScript + React + Three.js (@react-three/fiber)          │
│  rendering engine · game systems · HUD · themes · touch      │
├──────────────────────────────────────────────────────────────┤
│ Game-logic core: C++17 "Harborfall Core" (src/cpp/physics.cpp)│
│  → WebAssembly: vehicle/pedestrian steps · collision ·       │
│  traffic decisions · police LOS sampling · boat buoyancy ·   │
│  race pacing …with exact TypeScript mirrors (no WASM needed) │
├──────────────────────────────────────────────────────────────┤
│ Server engine: Python + FastAPI (server/main.py)             │
│  WebSocket rooms (32/room) · state relay + speed/teleport    │
│  sanity checks · wanted/mission event relay · /health        │
│  /v1/leaderboards · /v1/economy/snapshot (JSON persistence)  │
├──────────────────────────────────────────────────────────────┤
│ PC shell: Electron (desktop/main.cjs) + electron-builder     │
│  Windows NSIS .exe · macOS universal .dmg                    │
└──────────────────────────────────────────────────────────────┘
```
See `docs/ENGINE.md` for why each language is used, and `docs/STORY.md`
for the full story bible.

## Languages — what runs where, honestly

| Language | Runs | Owns |
|---|---|---|
| **C++17** | In the browser, as WebAssembly (with an exact TypeScript mirror when WASM is absent) | The **Harborfall Core**: vehicle + pedestrian stepping, collision, traffic stop/go decisions, police line-of-sight sampling, boat buoyancy, race-opponent pacing — the game's decision logic, verified by a g++ smoke test |
| **Python** | Server host (Render/Railway/Fly/your machine) | The FastAPI service: multiplayer WebSocket rooms with anti-teleport checks, leaderboards and economy snapshots with JSON persistence |
| **C# / .NET 8** | Developer's desktop only | `tools/Harborfall.WorldTools` — validates the world-data snapshot and inspects exported saves. The same role C# tooling plays in Unity/Unreal pipelines |
| **TypeScript** | In the browser, natively | The presentation shell + glue: rendering (Three.js), HUD, phone, input, and the mirrors of the C++ core |

**Why TypeScript exists at all:** browsers execute JavaScript and
WebAssembly — nothing else. There is no way to ship a browser game
whose presentation layer is C# or Python; that is a platform
constraint, not a preference. What *can* move — decision logic — has
moved into the C++ core; services live in Python; tooling lives in C#.

## Run locally

```sh
# Web client
cd client && npm ci && npm run dev        # http://localhost:5173
npm run build                             # production build -> client/dist

# Multiplayer server (optional)
python3 -m venv /tmp/hf-venv && /tmp/hf-venv/bin/pip install -r server/requirements.txt
cd server && /tmp/hf-venv/bin/python -m uvicorn main:app --port 8765
# then run the client with: VITE_MULTIPLAYER_SERVER_URL=ws://localhost:8765/ws npm run dev

# WASM physics (optional — TS fallback is built in)
./scripts/build-physics.sh --deploy       # needs Emscripten; writes client/public/physics/

# Desktop
cd client && npm run build && cd ../desktop && npm install && npm start   # F11 fullscreen
npm run dist:win   # or dist:mac — build on the target OS, or use GitHub Actions
```

## Deploy to Vercel (web version)

1. Go to vercel.com → **Add New → Project** → import this repo (`mostakimadibbd/gta`).
2. Set **Root Directory = `client`** (Framework Preset: Vite — `client/vercel.json` already sets build `npm run build`, output `dist`, SPA fallback).
3. Click **Deploy** — done. Share the link; the game is fully playable with **no env vars** (single-player/offline).
4. Optional multiplayer: host `server/` on any ASGI host with WebSockets, then add env var `VITE_MULTIPLAYER_SERVER_URL=wss://<your-server>/ws` and redeploy.

**Server deploy (fixed — the server ships with a deploy pack for every host):**
- **Render:** this repo's root `render.yaml` defines the `harborfall-server` web service automatically (rootDir `server`, health check `/health`).
- **Railway / Heroku-style:** `server/Procfile` runs `uvicorn main:app` on `$PORT`; `server/runtime.txt` pins Python 3.12.
- **Docker / Fly.io / any VPS:** `server/Dockerfile` (python:3.12-slim) — `docker build -t harborfall-server server/ && docker run -p 8765:8765 harborfall-server`.
- **Vercel (HTTP/health only):** create a *separate* Vercel project with **Root Directory = `server`** — `server/vercel.json` routes everything to the FastAPI app. Note: Vercel serverless does not keep WebSockets open, so multiplayer needs Render/Railway/Fly/Docker above; the game itself is fully playable single-player without the server.
- Dependencies are intentionally slim (`fastapi` + plain `uvicorn`) so installs never fail on native builds.

A repo-root `vercel.json` is also included, so importing with the root as
the project root works too (it builds `client/` explicitly).

## Desktop releases (Windows + macOS)

`.github/workflows/desktop-release.yml` builds both installers on
`windows-latest` + `macos-latest` and attaches them to a GitHub Release —
push a tag like `v1.0.0` or run it manually from the Actions tab.
Installers can't be cross-built or code-signed inside a Linux dev VM (no
Windows/macOS toolchains or signing certificates), so local `dist:*`
scripts are provided for building on your own machine and CI does the rest.
Unsigned installers may trigger SmartScreen/Gatekeeper first-run prompts.

## Honest limits

- **Realistic-styled, not photoreal.** Phase 5 raised the ceiling —
  real CC0 photographed PBR maps on roads/sidewalks/brick/plaster
  (credits: `ASSETS_LICENSES.md`), clearcoat car paint, a custom
  water shader, PMREM sky reflections, SSAO on High — but buildings,
  cars and people are still code-built geometry, not scanned or
  modelled assets. Photoreal is not achievable in an instant-play
  browser build; glTF upgrades are a manual path (`SETUP_MANUAL.md`).
- The embedded CC0 maps cost ~950 KB (gzip) of download so the game
  can ship with zero hosted files; the Low tier never decodes them.
- Motion blur is not implemented (no cheap robust effect exists in
  the post library); a speed FOV kick carries the sensation instead.
- Multiplayer is positional relay (no server-side game simulation);
  room state is in-memory on one server instance.
- Story is text dialogue with full subtitles (no voice acting);
  progress/cash/theme/quality persist in `localStorage` on the
  device you play on.
- Phase 6 honesty: the physics **WASM binary was not rebuilt** this
  round (no Emscripten toolchain here) — the v3 C++ source and its
  exact TypeScript mirror ship, the g++ smoke test passes, and the
  loader falls back per-function, so gameplay is identical. Faces are
  higher-resolution *painted* canvases on stylised-realistic rigs —
  still not scanned people. The loading bar counts real construction
  stages, never a timer.
