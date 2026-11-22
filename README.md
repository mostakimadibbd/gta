# Low-poly multiplayer driving MVP

The project source lives in this selected workspace. Frontend production files are built to `client/dist`; Python virtual environments, npm dependencies/caches, test programs, and temporary Wasm output can stay under `/tmp/gta-web-game-temp`. The Python WebSocket service is hosted separately from the Vercel static frontend.

## Prerequisites

- Node.js 20+ and npm
- Python 3.9+
- Optional: Emscripten (`emcc`) to compile the physics module to WebAssembly

Set paths once in each terminal (the selected workspace path below is this checkout):

```sh
PROJECT_ROOT="/Users/mostakim/Downloads/vscode/gta"
TMP_ROOT="/tmp/gta-web-game-temp"
mkdir -p "$TMP_ROOT"
```

## Run the multiplayer test environment

Terminal 1, create a temporary Python environment and start the server:

```sh
PROJECT_ROOT="/Users/mostakim/Downloads/vscode/gta"
TMP_ROOT="/tmp/gta-web-game-temp"
mkdir -p "$TMP_ROOT"
TMPDIR="$TMP_ROOT" python3 -m venv "$TMP_ROOT/venv"
"$TMP_ROOT/venv/bin/python" -m pip install --cache-dir "$TMP_ROOT/pip-cache" -r "$PROJECT_ROOT/server/requirements.txt"
cd "$PROJECT_ROOT"
"$TMP_ROOT/venv/bin/python" server/main.py
```

Terminal 2, install frontend dependencies and npm cache outside the workspace. The temporary symlink is removed automatically after the build command:

```sh
PROJECT_ROOT="/Users/mostakim/Downloads/vscode/gta"
TMP_ROOT="/tmp/gta-web-game-temp"
if ! command -v npm >/dev/null 2>&1; then
  NODE_ARCH=$(uname -m)
  case "$NODE_ARCH" in
    arm64|aarch64) NODE_ARCH=arm64 ;;
    x86_64) NODE_ARCH=x64 ;;
    *) echo "Unsupported Node architecture: $NODE_ARCH" >&2; exit 1 ;;
  esac
  mkdir -p "$TMP_ROOT/node"
  curl -fL "https://nodejs.org/dist/v22.17.1/node-v22.17.1-darwin-$NODE_ARCH.tar.gz" -o "$TMP_ROOT/node.tar.gz"
  tar -xzf "$TMP_ROOT/node.tar.gz" -C "$TMP_ROOT/node" --strip-components=1
fi
export PATH="$TMP_ROOT/node/bin:$PATH"
mkdir -p "$TMP_ROOT/client-deps"
cp "$PROJECT_ROOT/client/package.json" "$TMP_ROOT/client-deps/package.json"
cp "$PROJECT_ROOT/client/package-lock.json" "$TMP_ROOT/client-deps/package-lock.json"
cd "$TMP_ROOT/client-deps"
npm --cache "$TMP_ROOT/npm-cache" ci
ln -s "$TMP_ROOT/client-deps/node_modules" "$PROJECT_ROOT/client/node_modules"
trap 'rm -f "$PROJECT_ROOT/client/node_modules"' EXIT
cd "$PROJECT_ROOT/client"
VITE_MULTIPLAYER_SERVER_URL=ws://localhost:8765 VITE_MULTIPLAYER_ROOM=downtown npm --cache "$TMP_ROOT/npm-cache" run dev -- --host 0.0.0.0
```

Open the Vite URL (normally `http://localhost:5173`) in two browser tabs. Without `VITE_MULTIPLAYER_SERVER_URL`, the game remains playable offline.

## Verify and build for Vercel

Run the same dependency setup from Terminal 2, then use:

```sh
PROJECT_ROOT="/Users/mostakim/Downloads/vscode/gta"
TMP_ROOT="/tmp/gta-web-game-temp"
export PATH="$TMP_ROOT/node/bin:$PATH"
mkdir -p "$TMP_ROOT/client-deps"
cp "$PROJECT_ROOT/client/package.json" "$TMP_ROOT/client-deps/package.json"
cp "$PROJECT_ROOT/client/package-lock.json" "$TMP_ROOT/client-deps/package-lock.json"
cd "$TMP_ROOT/client-deps"
npm --cache "$TMP_ROOT/npm-cache" ci
ln -s "$TMP_ROOT/client-deps/node_modules" "$PROJECT_ROOT/client/node_modules"
trap 'rm -f "$PROJECT_ROOT/client/node_modules"' EXIT
cd "$PROJECT_ROOT/client"
npm --cache "$TMP_ROOT/npm-cache" run build
```

The expected deployment output is `client/dist`, configured in `client/vercel.json`. Set `VITE_MULTIPLAYER_SERVER_URL` in the Vercel project to the public `wss://` URL of a separately hosted Python server. `VITE_MULTIPLAYER_ROOM` is optional and defaults to `downtown`.

To compile and test WebAssembly without leaving generated files in the workspace, run:

```sh
PROJECT_ROOT="/Users/mostakim/Downloads/vscode/gta"
TMP_ROOT="/tmp/gta-web-game-temp"
cd "$PROJECT_ROOT"
./scripts/build-physics.sh
```

That command writes `physics.js` and `physics.wasm` under `/tmp/gta-web-game-temp/wasm`. For a production build that should include the Wasm engine, run `./scripts/build-physics.sh --deploy`; it writes the two runtime files to `client/public/physics/`. The frontend otherwise uses its TypeScript physics fallback.

## Controls

- `WASD`: walk / steer and accelerate or reverse
- `Shift`: sprint
- `Space`: jump
- `E`: enter the nearby car or exit it
- Drag the mouse: orbit the third-person camera
