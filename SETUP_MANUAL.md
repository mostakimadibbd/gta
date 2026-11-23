# Harborfall — Manual Asset Setup Guide

The game ships complete with procedural models + embedded CC0
textures. This manual is for going further **by hand**: real glTF car
and character models, extra PBR maps, and HDRI skies. Everything here
is optional. Follow the size and license rules or the build will
suffer — Harborfall's whole distribution model is "instant play in a
browser on free hosting".

## Ground rules

- **Licenses:** CC0 preferred. MIT/Apache/BSD fine for code.
  **CC-BY is allowed only if you add the credit to
  `ASSETS_LICENSES.md` first** (author, source URL, license). Never
  use NC (non-commercial) or ND (no-derivatives) assets, and never
  anything ripped from another game.
- **Size:** no single file > 5 MB without flagging it; textures
  ≤ 1024px for this project; total added payload should stay
  under ~2 MB. Binary files **cannot** go through the Muse snapshot
  push (UTF-8 text only) — add binaries via the GitHub web UI or a
  local git push, or host them and load by URL.
- **Fit the physics:** gameplay collision is 2D AABBs/circles with
  fixed sizes (see `docs/VISUAL_AUDIT.md`, "Dimension ↔ physics
  contract"). A model that is bigger than its box WILL clip through
  walls. Scale models to the contract, not the other way round.

## 1. Cars — glTF shopping list (10 kinds)

Current procedural kinds and the box each replacement must fit
(visual width × length; collision circle r = 1.55, motorcycle 1.0).
Target budgets: **8–25k triangles** per car (LOD0), one 1024px
texture set max, wheels as separate nodes if you want steering/roll
animation (front-left/right nodes named `wheel_fl`, `wheel_fr`).

| Kind | Fit (w × len) | Sketchfab search terms (filter: Downloadable, CC0/CC-BY) |
|---|---|---|
| sedan | 2.0 × 3.7 | "low poly sedan car cc0", "family sedan gltf" |
| hatch | 1.9 × 3.15 | "hatchback car low poly" |
| coupe | 2.0 × 3.9 | "sports coupe car gltf" |
| pickup | 2.1 × 4.1 | "pickup truck low poly cc0" |
| van | 2.1 × 4.2 | "delivery van low poly" |
| supercar | 2.2 × 4.3 | "supercar low poly gltf" |
| muscle | 2.05 × 4.4 | "muscle car low poly" |
| suv | 2.1 × 4.2 | "suv car low poly cc0" |
| classic | 1.95 × 4.5 | "classic car 1950s low poly" |
| motorcycle | ~0.6 × 1.9 | "motorcycle low poly cc0" |

Also try: Kenney.nl (CC0 game assets), Quaternius (CC0), Poly Pizza
(CC0/CC-BY filter). Integration point: `client/src/components/
CarBody.tsx` — replace a kind's JSX with a `<primitive>` of the
loaded glTF, keeping `CarFx`, wheels-steer refs and the dirt shell
behaviour in mind. Keep the procedural body as the Low-tier fallback.

## 2. Characters — rigs and animation

Current rigs are articulated primitives (~1.85u tall). To upgrade:

- **Mixamo** (free with Adobe account): download a character +
  animations as FBX, convert to glTF with Blender (File → Export →
  glTF 2.0). Required clips, named exactly: `idle`, `walk`, `run`,
  `jump`, `enter-car`. Rig: standard Mixamo humanoid skeleton
  (mixamorig), root at feet, facing +Z, height ≈ 1.85 units after
  scaling.
- **Ready Player Me**: avatar GLB (half-body/full-body), same clip
  requirements via Mixamo retargeting in Blender.
- Keep polycounts ≤ 15k per character; peds share rigs, so one male
  + one female base with texture/colour variants beats 14 unique
  models. Integration point: `client/src/humanoid.ts`
  (`buildHumanoid` / `animateHumanoid`) — the remote-player protocol
  does not change (position/heading only).

## 3. HDRI skies (optional upgrade to the procedural env)

Phase 5 generates its environment from a procedural equirect canvas.
For a photographic sky: Poly Haven → Skies (CC0), good matches for
Port Sable's dusk: `kloppenheim_06_puresky`, `sunset_jhbcentral`,
`industrial_sunset_puresky`, `moonlit_golf`. Download the **1K HDR**,
convert to an equirect **JPG ≤ 400 KB** (e.g. `ffmpeg -i sky.hdr
-q:v 4 sky.jpg` after tone mapping in Blender/HDR tools, or use an
online HDR→JPG converter), embed or host it, and point
`App.tsx EnvSetup` at it on Medium/High. Keep the procedural canvas
as the Low/fallback path.

## 4. More PBR texture sets

ambientCG (CC0, direct zip downloads, no account): good next sets —
`Asphalt 012` (worn road variant), `Concrete 034` (stained walls),
`Bricks 042`, `Painted Plaster 011`, `Metal Plate` (industrial).
Poly Haven textures work the same way (see ASSETS_LICENSES.md for
the exact pipeline used: 1K JPG → WebP q74–76 → base64 module →
1.2 MB total budget). Apply new sets in `World.tsx` material memos,
gated by `game/quality.ts` exactly like the current four.

## 5. What NOT to do

- Don't raise texture resolution past 1024 "because it looks soft" —
  repetition and normal maps carry realism at this scale, not pixels.
- Don't add per-frame React state for visuals; refs + useFrame only.
- Don't change the physics AABBs to fit a prettier model. Ever.
