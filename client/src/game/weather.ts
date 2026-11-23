// Harborfall weather — dynamic state machine (Blueprint §1/§10).
// States drift every ~90–150s (weighted rolls), Y cycles manually.
// Visuals live in components/Weather.tsx; this module owns the state.
import { G, toast, type WeatherKind } from "./store";
import { seasonMeta } from "./season";

export interface WeatherMeta { label: string; icon: string; rain: number; fog: number; fogScale: number; }
export const WEATHER_META: Record<WeatherKind, WeatherMeta> = {
  Clear: { label: "Clear", icon: "☀️", rain: 0, fog: 0, fogScale: 1 },
  Cloudy: { label: "Cloudy", icon: "☁️", rain: 0, fog: 0.25, fogScale: 0.8 },
  Rain: { label: "Rain", icon: "🌧️", rain: 0.75, fog: 0.35, fogScale: 0.62 },
  Storm: { label: "Storm", icon: "⛈️", rain: 1, fog: 0.5, fogScale: 0.5 },
  Fog: { label: "Fog", icon: "🌫️", rain: 0, fog: 1, fogScale: 0.3 },
};
export const WEATHER_ORDER: WeatherKind[] = ["Clear", "Cloudy", "Rain", "Storm", "Fog"];
// Weighted transitions: clear skies are common, storms rare.
// Phase 13: the weights are SEASONAL now (game/season.ts) — summer
// earns more Clear plus an afternoon Storm bonus, winter leans Fog /
// Cloudy with cooler light. The table below is the annual average,
// kept as the shape reference; rollWeather() reads the live season.

export function setWeather(kind: WeatherKind, holdSeconds = 110 + Math.random() * 50) {
  if (G.weather === kind) { G.weatherIn = holdSeconds; return; }
  G.weather = kind;
  G.weatherIn = holdSeconds;
  toast(`Weather: ${WEATHER_META[kind].label}`);
}
export function cycleWeather() {
  const i = WEATHER_ORDER.indexOf(G.weather);
  setWeather(WEATHER_ORDER[(i + 1) % WEATHER_ORDER.length], 240); // manual pick holds longer
}
const ORDER: WeatherKind[] = ["Clear", "Cloudy", "Rain", "Fog", "Storm"];
export function rollWeather() {
  const m = seasonMeta();
  const w = [...m.weights] as number[]; // [Clear, Cloudy, Rain, Fog, Storm]
  const hour = Math.floor((G.dayTime * 24 + 6) % 24);
  if (hour >= 13 && hour < 18) w[4] *= m.stormAfternoon; // summer afternoons brew storms
  let total = 0; for (const x of w) total += x;
  let r = Math.random() * total;
  for (let i = 0; i < ORDER.length; i++) {
    r -= w[i];
    if (r <= 0) { const kind = ORDER[i]; if (kind !== G.weather) setWeather(kind); else G.weatherIn = 110 + Math.random() * 50; return; }
  }
  G.weatherIn = 110;
}
