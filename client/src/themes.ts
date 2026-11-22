// Personal themes for Harborfall — one definition drives the 3D scene
// (sky/fog/lights/window glow), the HUD (CSS variables) and the minimap.
// No pink/purple themes: the player dislikes that palette.
export interface GameTheme {
  id: string; name: string; blurb: string;
  sky: string; fog: string; fogNear: number; fogFar: number;
  sunColor: string; sunIntensity: number; ambient: number; hemiSky: string; hemiGround: string;
  water: string; windowGlow: string; lampGlow: string;
  carAccent: string; shirt: string;
  css: Record<string, string>; // CSS variables applied to :root
  minimap: { bg: string; road: string; player: string; police: string; marker: string; car: string };
}
export const THEMES: GameTheme[] = [
  { id: "dusk", name: "Harbor Dusk", blurb: "Teal-and-amber coastal dusk (default)",
    sky: "#79a8a0", fog: "#79a8a0", fogNear: 90, fogFar: 220, sunColor: "#ffb066", sunIntensity: 2.0, ambient: 0.7, hemiSky: "#cfe8e2", hemiGround: "#5c5344",
    water: "#14605e", windowGlow: "#ffca7a", lampGlow: "#ffc857", carAccent: "#d99a3d", shirt: "#1f7a72",
    css: { "--accent": "#f0b35e", "--accent2": "#2ec4b6", "--panel": "#12262add", "--hud-text": "#f7f2e6" },
    minimap: { bg: "#0e2a28", road: "#3d5a56", player: "#ffd166", police: "#ff5252", marker: "#ffb703", car: "#9ad1cb" } },
  { id: "midnight", name: "Midnight Patrol", blurb: "Deep navy night, bright streetlights",
    sky: "#0a1626", fog: "#0a1626", fogNear: 60, fogFar: 170, sunColor: "#7aa2ff", sunIntensity: 0.5, ambient: 0.32, hemiSky: "#33507e", hemiGround: "#0c1420",
    water: "#0a2e4a", windowGlow: "#ffe9a8", lampGlow: "#cfe6ff", carAccent: "#7aa2ff", shirt: "#24406e",
    css: { "--accent": "#8fb6ff", "--accent2": "#5ee1e6", "--panel": "#0a1626e6", "--hud-text": "#e8f1ff" },
    minimap: { bg: "#060f1c", road: "#274268", player: "#ffe27a", police: "#ff4040", marker: "#ffb703", car: "#7fa8d9" } },
  { id: "desert", name: "Desert Gold", blurb: "Warm sand and gold under a clear day sky",
    sky: "#bfe3ee", fog: "#e8d9b0", fogNear: 110, fogFar: 260, sunColor: "#fff1c4", sunIntensity: 2.6, ambient: 0.95, hemiSky: "#fff3d6", hemiGround: "#a98d5f",
    water: "#2a9d8f", windowGlow: "#fff3c4", lampGlow: "#ffe9a8", carAccent: "#e0a526", shirt: "#c47b2a",
    css: { "--accent": "#e0a526", "--accent2": "#b5651d", "--panel": "#2a2114dd", "--hud-text": "#fff8ea" },
    minimap: { bg: "#e6d3a3", road: "#b49b62", player: "#8a4b08", police: "#d62828", marker: "#b5651d", car: "#7a6248" } },
  { id: "emerald", name: "Emerald Bay", blurb: "Lush green-teal daytime by the bay",
    sky: "#a8dcc8", fog: "#a8dcc8", fogNear: 100, fogFar: 240, sunColor: "#ffffff", sunIntensity: 2.4, ambient: 0.9, hemiSky: "#e2f5e9", hemiGround: "#4c7a54",
    water: "#15917b", windowGlow: "#fef9c3", lampGlow: "#fef08a", carAccent: "#22c55e", shirt: "#15803d",
    css: { "--accent": "#4ade80", "--accent2": "#14b8a6", "--panel": "#0f2a1edd", "--hud-text": "#eefbf2" },
    minimap: { bg: "#123524", road: "#2f5d43", player: "#fde047", police: "#ef4444", marker: "#f59e0b", car: "#a7f3d0" } },
  { id: "noir", name: "Noir Mono", blurb: "Desaturated mono streets, one red accent",
    sky: "#8a8a8a", fog: "#8a8a8a", fogNear: 55, fogFar: 160, sunColor: "#e8e8e8", sunIntensity: 1.4, ambient: 0.55, hemiSky: "#d4d4d4", hemiGround: "#3a3a3a",
    water: "#4a4a4a", windowGlow: "#f5f5f5", lampGlow: "#ffffff", carAccent: "#dc2626", shirt: "#262626",
    css: { "--accent": "#dc2626", "--accent2": "#a3a3a3", "--panel": "#111111e6", "--hud-text": "#f5f5f5" },
    minimap: { bg: "#171717", road: "#525252", player: "#ffffff", police: "#dc2626", marker: "#dc2626", car: "#a3a3a3" } },
];
export const THEME_KEY = "harborfall-theme";
export function loadTheme(): GameTheme {
  try { const id = localStorage.getItem(THEME_KEY); return THEMES.find((t) => t.id === id) ?? THEMES[0]; }
  catch { return THEMES[0]; }
}
export function saveTheme(id: string) { try { localStorage.setItem(THEME_KEY, id); } catch { /* private mode */ } }
