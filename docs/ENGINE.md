# Harborfall — engine & language choices

Harborfall ships **one codebase to browser + Windows + macOS**, so every
choice below is driven by that constraint.

| Layer | Language / tech | Role |
|---|---|---|
| Rendering engine | TypeScript + React + Three.js (`@react-three/fiber`, drei) | Scene graph, city/traffic/pedestrian/police rendering, camera, HUD, themes, touch + keyboard input. Three.js is the practical WebGL engine that runs identically in a browser tab and inside Electron. |
| Physics engine | C++17 → WebAssembly (`src/cpp/physics.cpp`, `scripts/build-physics.sh`) | `step_vehicle` (arcade car integration), `collide_aabb` / `resolve_aabb` (building collision), `step_pedestrian` (NPC seek/flee), `distance_squared`. Compiled with Emscripten (`-O3`). |
| Physics fallback | TypeScript (`client/src/physics/GamePhysics.ts`) | An exact mirror of the C++ functions. The game is fully playable with no WASM file present (e.g. a plain Vercel deploy); when `client/public/physics/physics.js` exists it is loaded and used instead (`Physics: WASM` in the panel). |
| Server engine | Python + FastAPI (`server/main.py`) | WebSocket multiplayer rooms (max 32/room), state relay with speed/anti-teleport sanity validation, wanted/mission event relay with value clamping, `/` and `/health` (rooms/players). Python was chosen for readable, fast-to-iterate netcode; the hot path is tiny JSON relay, so it is never the bottleneck. |
| PC shell | JavaScript (Electron `desktop/main.cjs`) + electron-builder | Loads `client/dist` from disk, single-instance lock, F11 fullscreen, hardened webPreferences (context isolation, sandbox, no Node in page). electron-builder targets: Windows NSIS `.exe`, macOS universal `.dmg` (`com.portsable.game`). |
| Audio | WebAudio API (TypeScript, `client/src/game/audio.ts`) | Engine hum tied to speed, police siren, pickup/cash/mission jingles — synthesised oscillators, zero audio assets, starts after first user gesture. |

## Why not Unity or Unreal?

- **Shipping target:** Unity/Unreal web exports are large (tens of MB of
  runtime), load slowly, and behave differently from their desktop builds —
  you end up maintaining two games. Harborfall's Three.js build *is* the
  desktop build (Electron loads the same `dist/`), so web and PC can never
  drift apart.
- **Size & startup:** the whole Harborfall JS payload is ~350 KB gzipped
  (plus the Three.js chunk) and starts instantly — important for a shared
  Vercel link and for phones.
- **Licensing/simplicity:** no engine royalties, seat licences, or
  proprietary editors; every tool in the chain is open source and the
  whole game builds with `npm ci && npm run build`.
- **Trade-off (honest):** we give up Unity/Unreal's asset pipelines,
  skeletal-animation tooling and photoreal rendering. For a low-poly
  stylised city at 60 fps in a browser, that trade is worth it.
