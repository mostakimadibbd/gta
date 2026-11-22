# Desktop icons
Drop the real game icon here before running a dist build:
- `icon.png` — 1024×1024 PNG (electron-builder derives .ico/.icns from it)
- optional: `icon.ico` (Windows, 256×256), `icon.icns` (macOS)
The build config references `build/icon.png`. Without it, electron-builder
falls back to the default Electron icon — the game still builds and runs.
Suggested art: amber sun disc over a teal harbour skyline (Harborfall key art).
