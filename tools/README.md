# Harborfall tools

## Harborfall.WorldTools (C# / .NET 8)

Desktop-side tooling for Harborfall. **C# cannot run inside the browser
client** — browsers execute JavaScript and WebAssembly only — so, exactly
like C# tooling in Unity/Unreal pipelines, this project lives outside the
game and works on exported data:

- `validate` — reads `tools/world-export.json` (a hand-maintained snapshot
  of the POIs / districts / blockers / car spawns declared in
  `client/src/world.ts` and `client/src/game/phase8.ts`) and checks
  district bounds, POI sanity (inside a district, not inside a blocker,
  unique ids) and spawn/blocker intersections. Prints a report; exit 1 on
  problems.
- `saveinspect` — reads a Harborfall **localStorage export** and prints a
  human summary (economy day + businesses, garage size, skills,
  portfolio, job earnings). Produce the export in the browser devtools
  console with `copy(JSON.stringify(localStorage))` and save the result
  as a `.json` file; a `{ "localStorage": { ... } }` wrapper is also
  accepted. Cash and story progress are runtime state and are not part of
  the export.

### Requirements & build status

Requires the **.NET 8 SDK** (<https://dotnet.microsoft.com/download>):

```sh
cd tools/Harborfall.WorldTools
dotnet run -- validate ../../world-export.json
dotnet run -- saveinspect ~/my-save.json
```

**Build status (honest):** the build environment for Phase 8 had no
`dotnet` binary (`dotnet --version` → command not found), so the project
is shipped as source and has **not** been compile-verified here. It uses
only the BCL (`System.Text.Json`) and no NuGet packages.
