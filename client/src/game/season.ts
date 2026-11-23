// Harborfall — Phase 13 SEASONS. Port Sable is a subtropical harbour
// city, so the year turns without ever snowing: what changes is the
// SUN (arc height + day length), the LIGHT (sky/fog/water tints), the
// FOLIAGE (the pine/street-tree set re-tints; palms stay green — they
// are palms) and the WEATHER ODDS (summer earns its afternoon storms,
// winter its fog). A season lasts 7 game-days, derived from the
// economy day serial (persisted), or the player can pin one in
// Settings (G.settings.season: "auto" | a season name).
//
// Visual state (tints) LERPS toward the season's targets in
// tickSeasonVisuals so a change of season is a dawn-to-dusk drift,
// never a palette pop. Everything here is allocation-free per frame:
// the THREE.Color objects are module-owned and mutated in place.
import * as THREE from "three";
import { G, toast } from "./store";
import { ECO } from "./economy";
import { pushNews, pushSocial } from "./feed";

export type SeasonKind = "Spring" | "Summer" | "Autumn" | "Winter";
export const SEASON_ORDER: SeasonKind[] = ["Spring", "Summer", "Autumn", "Winter"];
export const SEASON_DAYS = 7; // game-days per season

export interface SeasonMeta {
  // sun path: elevation = sin(sunAng) * sunAmp + sunBias. Summer's
  // positive bias widens the daylight window in dayTime (longer days)
  // and lifts the noon arc; winter's negative bias + low amp gives a
  // short, low, cool day. The hour labels never move — only the sun.
  sunAmp: number; sunBias: number;
  skyTint: string;      // multiplier over the theme sky/fog colours
  // foliage targets for the instanced tree set (3 cone tiers + 2 bush
  // tiers, in World.tsx TreeSet material order)
  foliage: [string, string, string, string, string];
  // weather roll weights [Clear, Cloudy, Rain, Fog, Storm]
  weights: [number, number, number, number, number];
  stormAfternoon: number; // summer: extra Storm weight multiplier 13:00–18:00
  waterHSL: [number, number, number]; // offsetHSL applied over theme water
  blurb: string;
}
export const SEASON_META: Record<SeasonKind, SeasonMeta> = {
  Spring: {
    sunAmp: 1.0, sunBias: 0.03, skyTint: "#ffffff",
    foliage: ["#2f7d4f", "#37915c", "#43a763", "#2f6b45", "#a8b87a"],
    weights: [30, 27, 24, 9, 10], stormAfternoon: 1,
    waterHSL: [0, 0.01, 0.005],
    blurb: "Fresh green on the rows, rain that comes and goes, the harbour waking up.",
  },
  Summer: {
    sunAmp: 1.06, sunBias: 0.14, skyTint: "#fff3dc",
    foliage: ["#1a5233", "#226b40", "#2a7a48", "#1f4c34", "#265c3c"],
    weights: [40, 22, 12, 6, 20], stormAfternoon: 1.8,
    waterHSL: [0, 0.03, 0.02],
    blurb: "Long hot days, a bright hard bay — and a storm most afternoons.",
  },
  Autumn: {
    sunAmp: 0.92, sunBias: -0.02, skyTint: "#ffe9c4",
    foliage: ["#8a5a24", "#9a6528", "#a8742f", "#7a4a20", "#8a5a26"],
    weights: [28, 30, 20, 14, 8], stormAfternoon: 1,
    waterHSL: [-0.01, 0, -0.01],
    blurb: "The rows turn amber, the light goes golden early, the docks smell of rain.",
  },
  Winter: {
    sunAmp: 0.6, sunBias: -0.12, skyTint: "#ccd6da",
    foliage: ["#4c5a4c", "#55634f", "#5f6d55", "#46523f", "#505c46"],
    weights: [22, 34, 14, 24, 6], stormAfternoon: 1,
    waterHSL: [0.01, -0.04, -0.03],
    blurb: "Short cool days, grey water, harbour fog — dry cold, never snow. This is the subtropics.",
  },
};

/** Season index from the persisted day serial (auto mode). */
export const seasonIndex = () => Math.floor(Math.max(0, ECO.daySerial) / SEASON_DAYS) % 4;
/** The season actually in force (Settings pin wins over the calendar). */
export function currentSeason(): SeasonKind {
  const pin = G.settings.season as SeasonKind | "auto";
  return pin !== "auto" && SEASON_ORDER.includes(pin) ? pin : SEASON_ORDER[seasonIndex()];
}
export const seasonMeta = () => SEASON_META[currentSeason()];

// ---- sun warp (pure; writes into the caller's out object) ----
export interface SunWarp { elev: number; ang: number }
export function seasonSun(sunAng: number, out: SunWarp): SunWarp {
  const m = seasonMeta();
  const elev = THREE.MathUtils.clamp(Math.sin(sunAng) * m.sunAmp + m.sunBias, -1, 1);
  out.elev = elev;
  out.ang = Math.atan2(elev, Math.cos(sunAng)); // same azimuth, season's arc
  return out;
}

// ---- lerped visual state (module-owned, mutated in place) ----
const _tint = new THREE.Color("#ffffff");
const _foliage = ["#1f5c3d", "#276e47", "#2f7d4f", "#24513a", "#2c5f42"].map((c) => new THREE.Color(c));
const _water: [number, number, number] = [0, 0, 0];
const _target = new THREE.Color("#ffffff");
let _initialised = false;
/** Advance the visual lerp (called once per frame from GameSystems). */
export function tickSeasonVisuals(dt: number) {
  const m = seasonMeta();
  if (!_initialised) { // first frame: snap, don't drift in from defaults
    _tint.set(m.skyTint);
    m.foliage.forEach((c, i) => _foliage[i].set(c));
    _water[0] = m.waterHSL[0]; _water[1] = m.waterHSL[1]; _water[2] = m.waterHSL[2];
    _initialised = true;
    return;
  }
  const k = Math.min(1, dt * 0.45); // ~2 s to cross-fade a season turn
  _tint.lerp(_target.set(m.skyTint), k);
  for (let i = 0; i < 5; i++) _foliage[i].lerp(_target.set(m.foliage[i]), k);
  for (let i = 0; i < 3; i++) _water[i] += (m.waterHSL[i] - _water[i]) * k;
}
export const seasonTint = () => _tint;
export const seasonFoliage = (i: number) => _foliage[i];
export const seasonWaterHSL = () => _water;

// ---- season-turn announcements (calendar flips + manual pins) ----
let _lastSeen: SeasonKind | null = null;
const SEASON_NEWS: Record<SeasonKind, [string, string]> = {
  Spring: ["Spring reaches Port Sable", "The rows are green again and the harbour shakes off the fog. Tomas Reed calls it 'first mackerel weather'. The Sable Line is running its spring timetable — same loop, better light."],
  Summer: ["Summer on the harbour", "Long days, bright water, and a storm most afternoons — the harbourmaster advises small craft to be home by the thunder. Beach season is officially open."],
  Autumn: ["Autumn turns the rows amber", "The street trees have gone the colour of the lamplight and the docks smell of rain. Ferry crews are calling it the best light of the year."],
  Winter: ["Winter, Port Sable style", "Short cool days and grey water — and not a flake of snow, as ever. The harbourmaster reminds visitors this is the subtropics: bring a jacket, not a sled."],
};
/** Called once per frame from GameSystems; fires only on a real change. */
export function seasonWatcher() {
  const now = currentSeason();
  if (_lastSeen === null) { _lastSeen = now; return; }
  if (now === _lastSeen) return;
  _lastSeen = now;
  const [title, body] = SEASON_NEWS[now];
  pushNews(title, body);
  pushSocial("@harbourwire", `${title} — ${SEASON_META[now].blurb}`);
  toast(`The season turns — it's ${now} in Port Sable`);
}
