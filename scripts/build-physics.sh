#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUTPUT_DIR="$ROOT_DIR/client/public/physics"

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
  -s 'EXPORTED_FUNCTIONS=["_malloc","_free","_step_vehicle","_distance_squared"]' \
  -s 'EXPORTED_RUNTIME_METHODS=["cwrap","HEAPF64"]' \
  -o "$OUTPUT_DIR/physics.js"

printf 'Wasm physics built in %s\n' "$OUTPUT_DIR"
