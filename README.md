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
| R | Respawn when busted/wasted · restart current mission |
| Mouse drag / wheel | Orbit / zoom camera |

### Play on your phone
Open the Vercel link in your phone browser — touch controls appear
automatically on touch devices: a virtual joystick (push far to sprint) +
JUMP and E buttons on foot; steering buttons + GAS/BRAKE pedals, DRIFT and
EXIT while driving; a pause button top-right; drag the right side of the
screen to orbit the camera. The side panel collapses behind the ☰ button.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Web (Vercel) / Desktop (Electron) — same build: client/dist  │
│  TypeScript + React + Three.js (@react-three/fiber)          │
│  rendering engine · game systems · HUD · themes · touch      │
├──────────────────────────────────────────────────────────────┤
│ Physics engine: C++17 (src/cpp/physics.cpp) → WebAssembly    │
│  vehicle step · AABB collision/resolve · pedestrian step     │
│  …with an exact TypeScript mirror fallback (no WASM needed)  │
├──────────────────────────────────────────────────────────────┤
│ Server engine: Python + FastAPI (server/main.py)             │
│  WebSocket rooms (32/room) · state relay + speed/teleport    │
│  sanity checks · wanted/mission event relay · /health        │
├──────────────────────────────────────────────────────────────┤
│ PC shell: Electron (desktop/main.cjs) + electron-builder     │
│  Windows NSIS .exe · macOS universal .dmg                    │
└──────────────────────────────────────────────────────────────┘
```
See `docs/ENGINE.md` for why each language is used, and `docs/STORY.md`
for the full story bible.

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

- Low-poly original art, not photoreal AAA graphics — it targets 60 fps in
  a browser, on phones included (pixel ratio capped, one shadow light).
- Multiplayer is positional relay (no server-side game simulation);
  room state is in-memory on one server instance.
- Story is text dialogue (no voice acting); progress/cash/theme persist
  in `localStorage` on the device you play on.
