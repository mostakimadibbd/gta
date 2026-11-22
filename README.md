# Low-poly multiplayer driving MVP

Everything for this project lives in `/tmp/gta-web-game`. The Vite client builds to static files in `client/dist`; the Python WebSocket server is a separate process and must be hosted separately from Vercel.

## Prerequisites

- Node.js 20+ and npm
- Python 3.10+
- Optional: Emscripten (`emcc`) to compile the native physics module to WebAssembly

## Create and run the test environment

From a terminal, run:

```sh
mkdir -p /tmp/gta-web-game
cd /tmp/gta-web-game
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r server/requirements.txt
python server/main.py
```

In a second terminal, start the frontend:

```sh
cd /tmp/gta-web-game/client
npm install
VITE_MULTIPLAYER_SERVER_URL=ws://localhost:8765 VITE_MULTIPLAYER_ROOM=downtown npm run dev -- --host 0.0.0.0
```

Open the Vite URL (normally `http://localhost:5173`) in two browser tabs to test multiplayer. Without `VITE_MULTIPLAYER_SERVER_URL`, the game remains playable offline.

## Build and deploy

```sh
cd /tmp/gta-web-game/client
npm run build
```

The static site is emitted to `client/dist`, configured as Vercel's output directory by `client/vercel.json`. Set `VITE_MULTIPLAYER_SERVER_URL` in the Vercel project to the public `wss://` URL of a separately hosted Python server. You can optionally set `VITE_MULTIPLAYER_ROOM`; it defaults to `downtown`.

To compile the optional WebAssembly physics engine (requires Emscripten):

```sh
cd /tmp/gta-web-game
./scripts/build-physics.sh
```

This writes `physics.js` and `physics.wasm` to `client/public/physics/`. The frontend detects and uses those files when present; otherwise it runs the matching TypeScript physics fallback.

## Controls

- `WASD`: walk / steer and accelerate or reverse
- `Shift`: sprint
- `Space`: jump
- `E`: enter the nearby car or exit it
- Drag the mouse: orbit the third-person camera
