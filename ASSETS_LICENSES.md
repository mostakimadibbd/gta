# Harborfall — Asset Licenses & Credits

Harborfall is built almost entirely from **original, procedural,
in-repo assets** (canvas-generated textures, code-built geometry,
original music and writing). Phase 5 added a small set of **real
CC0 photographs** for ground/facade PBR maps. This file is the
complete register. No other third-party assets are used as game
content.

## Embedded CC0 textures (Phase 5)

Source for all four sets: **Poly Haven** (https://polyhaven.com) —
all Poly Haven assets are published under **CC0 1.0 Universal (public
domain)**. Downloaded 2026-11-23 from the Poly Haven CDN
(`dl.polyhaven.org`) at 1K JPG, converted to WebP, downscaled
(768–1024px), and embedded as base64 data URIs in
`client/src/cc0Textures.ts`. Total embedded payload: **955,200 bytes**
(budget: ≤ 1.2 MB; largest single map 208 KB ≤ 350 KB cap).

| Asset (Poly Haven ID) | Maps embedded | Embedded size (WebP) | License | Source |
|---|---|---|---|---|
| Asphalt 04 (`asphalt_04`) | diffuse, normal (OpenGL), roughness | ≈ 353 KB total (208 / 144 / 1 KB) | CC0 | https://polyhaven.com/a/asphalt_04 |
| Concrete Pavement (`concrete_pavement`) | diffuse, normal, roughness | ≈ 264 KB total (156 / 108 / <1 KB) | CC0 | https://polyhaven.com/a/concrete_pavement |
| Brick Wall 04 (`brick_wall_04`) | diffuse, normal, roughness | ≈ 248 KB total (86 / 150 / 12 KB) | CC0 | https://polyhaven.com/a/brick_wall_04 |
| Plastered Wall 02 (`plastered_wall_02`) | diffuse, normal, roughness | ≈ 61 KB total (2 / 59 / <1 KB) | CC0 | https://polyhaven.com/a/plastered_wall_02 |

Usage: roads (asphalt), sidewalks (concrete pavement), low-rise
Port Sable facades (brick), Coral Shores facades (plaster) — Medium
and High quality tiers only. Low tier and all other surfaces use the
procedural canvas set.

CC0 requires no attribution; this register is kept anyway so the
provenance of every byte is auditable.

## Verified but NOT embedded

- **ambientCG** (https://ambientcg.com, CC0): direct-download route
  verified working 2026-11-23 (`Asphalt012_1K-JPG.zip`, 8.5 MB).
  Not embedded — the Poly Haven set covered all four target surfaces
  inside the size budget. ambientCG remains the recommended source
  for additional maps (see SETUP_MANUAL.md).

## Procedural / original assets (no third-party license)

Everything else in the game is original and generated in-repo:
all canvas textures in `client/src/textures.ts` (asphalt, concrete,
facades, brick, plaster, corrugated steel, sky environment, faces,
fabrics…), all vehicle/building/character geometry (code-built), the
city of Port Sable and Coral Shores, all characters and writing, and
the soundtrack ("Port Sable Sunset", composed in code with WebAudio).
The loading-screen poster panels are crops of the project owner's
own supplied mood-board collage, used as a menu backdrop only.

## Explicitly NOT used

No Rockstar/GTA assets, names, maps, logos or audio. No AI-generated
assets are used as game models or textures. No CC-BY assets are
embedded at this time — if any are added manually (see
SETUP_MANUAL.md), they must be credited in this file **before**
shipping, with author, source URL and license text link.
