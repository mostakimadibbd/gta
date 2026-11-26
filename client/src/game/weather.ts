// Harborfall weather — dynamic state machine (Blueprint §1/§10).
// States drift every ~90–150s (weighted rolls), Y cycles manually.
// Visuals live in components/Weather.tsx; this module owns the state.
//
// Phase 36: the machine is FORECASTABLE now. Until this phase the
// next state was rolled at the moment the old one expired — there
// was no "next" to show anyone. Now the next state is rolled when
// the current one is SET (and re-rolled whenever the current one
// changes, including a Y-key manual pick), held in FORECAST, and
// the expiry roll simply advances into it. The forecast is the
// machine's real committed future, not a guess rendered for show:
// what the Phone's harbourweather.ps page and the HUD glyph report
// is exactly what will arrive when G.weatherIn runs out (a manual
// Y press is the one thing that can rewrite it — and doing so
// re-rolls the forecast, so it is never stale afterwards).
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
  if (G.weather === kind) { G.weatherIn = holdSeconds; rollForecast(); return; }
  G.weather = kind;
  G.weatherIn = holdSeconds;
  toast(`Weather: ${WEATHER_META[kind].label}`);
  rollForecast(); // Phase 36: a new current state earns a new forecast
}
export function cycleWeather() {
  const i = WEATHER_ORDER.indexOf(G.weather);
  setWeather(WEATHER_ORDER[(i + 1) % WEATHER_ORDER.length], 240); // manual pick holds longer
}
const ORDER: WeatherKind[] = ["Clear", "Cloudy", "Rain", "Fog", "Storm"];
/** One weighted pick from the seasonal table (Phase 36: extracted
 * from rollWeather so the forecast rolls the same dice the machine
 * always rolled — same weights, same summer-afternoon storm bonus).
 * The pick MAY equal the current weather: the machine has always
 * been able to roll "no change" (it just extends the hold), and the
 * forecast reports that honestly as a hold, not a fake change. */
function pickKind(): WeatherKind {
  const m = seasonMeta();
  const w = [...m.weights] as number[]; // [Clear, Cloudy, Rain, Fog, Storm]
  const hour = Math.floor((G.dayTime * 24 + 6) % 24);
  if (hour >= 13 && hour < 18) w[4] *= m.stormAfternoon; // summer afternoons brew storms
  let total = 0; for (const x of w) total += x;
  let r = Math.random() * total;
  for (let i = 0; i < ORDER.length; i++) {
    r -= w[i];
    if (r <= 0) return ORDER[i];
  }
  return "Clear";
}
// ---- Phase 36: the forecast — the machine's committed next state.
export const FORECAST = { next: "Clear" as WeatherKind };
export function rollForecast() { FORECAST.next = pickKind(); }
export const forecastNext = (): WeatherKind => FORECAST.next;
/** Game-minutes until the current state expires. A Port Sable day
 * is 300 real seconds (GameSystems' dayTime advance), so one real
 * second carries 1440/300 = 4.8 game-minutes. */
export const forecastInGameMinutes = (): number => G.weatherIn * 4.8;
rollForecast(); // the boot forecast (G.weather starts Clear)

export function rollWeather() {
  // Phase 36: expiry advances INTO the forecast, then setWeather
  // (or the hold-extension below) rolls the next forecast.
  const kind = FORECAST.next;
  if (kind !== G.weather) setWeather(kind);
  else { G.weatherIn = 110 + Math.random() * 50; rollForecast(); }
}
