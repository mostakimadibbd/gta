# Harborfall — Desktop (Windows + macOS)
Same game as the web build, packaged with Electron.
## Run locally (dev)
```sh
cd ../client && npm ci && npm run build   # build the web client first
cd ../desktop && npm install              # installs electron (dev only)
npm start                                 # opens the game window, F11 = fullscreen
```
## Build installers
Installers must be built on the target OS (or via GitHub Actions — see
`.github/workflows/desktop-release.yml` in the repo root, which builds both
on `windows-latest` and `macos-latest` and attaches them to a GitHub Release):
```sh
npm run dist:win   # Windows NSIS installer (.exe)  -> release/
npm run dist:mac   # macOS DMG (.dmg, universal)    -> release/
```
No code-signing certificates are configured; unsigned installers may show
OS "unknown developer" prompts (Windows SmartScreen / macOS Gatekeeper —
right-click → Open on macOS the first time).
