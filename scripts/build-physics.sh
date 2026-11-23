#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
case "${1:-}" in
  "")
    OUTPUT_DIR="/tmp/gta-web-game-temp/wasm"
    ;;
  --deploy)
    OUTPUT_DIR="$ROOT_DIR/client/public/physics"
    ;;
  *)
    printf '%s\n' "Usage: $0 [--deploy]" >&2
    exit 2
    ;;
esac

if ! command -v emcc >/dev/null 2>&1; then
  printf '%s\n' "emcc was not found. Install and activate the Emscripten SDK, then rerun this script." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
emcc "$ROOT_DIR/src/cpp/physics.cpp" \
  -O3 -std=c++17 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s ENVIRONMENT=web \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s 'EXPORTED_FUNCTIONS=["_malloc","_free","_step_vehicle","_distance_squared","_collide_aabb","_resolve_aabb","_step_pedestrian","_step_vehicle_v2","_resolve_vehicle_collision","_swept_aabb","_separation_force"]' \
  -s 'EXPORTED_RUNTIME_METHODS=["cwrap","HEAPF64"]' \
  -o "$OUTPUT_DIR/physics.js"

printf 'Wasm physics built in %s\n' "$OUTPUT_DIR"
