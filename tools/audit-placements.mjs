// Harborfall — Phase 25 placement audit runner.
// Usage: node tools/audit-placements.mjs
// Bundles tools/audit-entry.ts (which imports the game's real data
// modules + collision query) with the client's esbuild and runs it
// headless. Exit code mirrors the audit: 1 = intersections found.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(here, "..", "client");
const require = createRequire(path.join(clientDir, "package.json"));
const esbuild = require("esbuild");

const out = path.join(os.tmpdir(), `harborfall-audit-${process.pid}.mjs`);
await esbuild.build({
  entryPoints: [path.join(here, "audit-entry.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: out,
  logLevel: "warning",
});
try {
  await import(out);
} finally {
  fs.rmSync(out, { force: true });
}
