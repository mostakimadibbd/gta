// Harborfall — Phase 8 shared state: fishing, the Lantern Park outdoor
// gym, and the Thread & Tide clothing override layer. The systems logic
// lives in components/Phase8.tsx; this module owns the data + persistence
// so the phone (Stats) and Player (rig) can read it without cycles.
import type { HumanoidOptions } from "../humanoid";

// ================================================================ FISHING
export interface FishSpot { name: string; x: number; z: number; castX: number; castZ: number; island?: boolean; }
/** Stand points (on land) + the water point the line lands in. */
export const FISHING_SPOTS: FishSpot[] = [
  { name: "the Pier", x: 2, z: 112.5, castX: 2, castZ: 122 },
  { name: "Sable Island dock", x: -64, z: 154.5, castX: -64, castZ: 146, island: true },
];
export interface FishDef { name: string; minCm: number; maxCm: number; base: number; when: "any" | "day" | "night"; rare?: boolean; }
export const FISH_TABLE: FishDef[] = [
  { name: "Harbour Sprat", minCm: 9, maxCm: 22, base: 6, when: "any" },
  { name: "Sable Mackerel", minCm: 24, maxCm: 48, base: 16, when: "any" },
  { name: "Coral Trout", minCm: 30, maxCm: 65, base: 34, when: "day" },
  { name: "Night Eel", minCm: 45, maxCm: 95, base: 30, when: "night" },
  { name: "Golden Koi of Port Sable", minCm: 40, maxCm: 70, base: 160, when: "any", rare: true },
];
export interface CaughtFish { name: string; cm: number; value: number; }

export const F = {
  phase: "idle" as "idle" | "charge" | "wait" | "bite" | "reel",
  spot: null as FishSpot | null,
  power: 0, powerDir: 1,
  biteAt: 0, biteEnd: 0,
  marker: 0.3, progress: 0,
  castX: 0, castZ: 0, splashAt: -9,
  creel: [] as CaughtFish[], // unsold catch — sell at Harbour Wraps
};
export const creelValue = () => F.creel.reduce((a, c) => a + c.value, 0);

/** Roll a catch for a spot: night/day gates + the rare koi at ~3%. */
export function rollCatch(spot: FishSpot, hour: number): CaughtFish {
  const night = hour >= 19 || hour < 6;
  if (Math.random() < 0.03) return makeFish(FISH_TABLE[4]);
  const pool = FISH_TABLE.filter((f) => !f.rare && (f.when === "any" || (f.when === "night") === night));
  // island water runs richer: weight the table toward the pricey end
  const idx = Math.min(pool.length - 1, Math.floor(Math.pow(Math.random(), spot.island ? 0.6 : 1) * pool.length));
  return makeFish(pool[idx]);
}
function makeFish(def: FishDef): CaughtFish {
  const cm = Math.round(def.minCm + Math.random() * (def.maxCm - def.minCm));
  const sizeMul = 0.7 + (cm - def.minCm) / Math.max(1, def.maxCm - def.minCm) * 0.9;
  return { name: def.name, cm, value: Math.max(2, Math.round(def.base * sizeMul)) };
}

// ================================================================ GYM
// CHOICE (documented in VISUAL_AUDIT): an OUTDOOR gym corner on Lantern
// Park's south lawn — two stations as park furniture. A pocket interior
// would have cost a room slot + door flow for the same two interactions;
// the park corner also reads instantly from the street.
export interface GymStation { id: "bench" | "tread"; name: string; x: number; z: number; skill: "strength" | "stamina"; gain: number; otherGain: number; }
export const GYM_STATIONS: GymStation[] = [
  { id: "bench", name: "Bench press", x: 70, z: -64.5, skill: "strength", gain: 6, otherGain: 2 },
  { id: "tread", name: "Park treadmill", x: 75.5, z: -64.5, skill: "stamina", gain: 6, otherGain: 1 },
];
export const GYM = {
  active: null as GymStation | null,
  marker: 0, dir: 1, hits: 0, need: 8, zoneAt: 0.65, // green zone centre, re-rolled per rep
  lastDay: { bench: -1, tread: -1 } as Record<string, number>, // ECO.daySerial of last session
};
try {
  const raw = localStorage.getItem("harborfall-gym");
  if (raw) GYM.lastDay = { ...GYM.lastDay, ...(JSON.parse(raw) as Record<string, number>) };
} catch { /* fresh */ }
export function persistGym() { try { localStorage.setItem("harborfall-gym", JSON.stringify(GYM.lastDay)); } catch { /* ignore */ } }

// ================================================================ CLOTHING
// Thread & Tide (Market Row). Purchases form an OVERRIDE LAYER over the
// character preset: while an override is worn it wins for top style +
// top/bottom colours. RULE (documented in README + BLUEPRINT): picking a
// character or variant in Character Select CLEARS the override — the
// select screen is the "change out of it" moment.
export interface ClothingItem {
  id: string; label: string; price: number;
  topStyle: NonNullable<HumanoidOptions["topStyle"]>; top: string;
  bottom?: string; bottomStyle?: NonNullable<HumanoidOptions["bottomStyle"]>;
}
export const CLOTHING_ITEMS: ClothingItem[] = [
  { id: "tee-teal", label: "Harbour Tee — teal", price: 40, topStyle: "tee", top: "#1f7a72" },
  { id: "tank-sand", label: "Dune Tank — sand", price: 55, topStyle: "tank", top: "#d8c9a3" },
  { id: "hoodie-rust", label: "Rust Hoodie", price: 95, topStyle: "hoodie", top: "#a34a28" },
  { id: "jacket-navy", label: "Northgate Jacket — navy", price: 160, topStyle: "jacket", top: "#274268" },
  { id: "tee-coral", label: "Sunset Tee — coral + board shorts", price: 120, topStyle: "tee", top: "#c65a3a", bottom: "#31556e", bottomStyle: "shorts" },
  { id: "jacket-black", label: "Midnight Jacket + charcoal jeans", price: 200, topStyle: "jacket", top: "#22252b", bottom: "#2c3038" },
];
export const CLOTHING_SHOP = { x: 18, z: 30.5, name: "Thread & Tide" };
export const CLOTH = {
  current: null as ClothingItem | null,
};
try {
  const raw = localStorage.getItem("harborfall-clothing");
  if (raw) {
    const id = (JSON.parse(raw) as { current?: string }).current;
    CLOTH.current = CLOTHING_ITEMS.find((i) => i.id === id) ?? null;
  }
} catch { /* no override */ }
export function persistClothing() {
  try { localStorage.setItem("harborfall-clothing", JSON.stringify({ current: CLOTH.current?.id ?? null })); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("harborfall-clothing-changed"));
}
export function clearClothingOverride() {
  if (!CLOTH.current) return;
  CLOTH.current = null;
  persistClothing();
}

/** HUD mini-game readout (fishing / gym) — App polls this into its HUD
 * state and renders the marker bar under the prompt stack. */
export interface MiniUi { label: string; marker: number; zone: [number, number] | null; fill: number | null; }
export function currentMiniUi(): MiniUi | null {
  if (F.phase === "charge") return { label: "CAST POWER — tap E to release", marker: F.power, zone: [0.55, 0.8], fill: null };
  if (F.phase === "reel") return { label: "REEL — hold E to wind, ease off before the red", marker: F.marker, zone: [0.35, 0.75], fill: F.progress };
  if (GYM.active) return { label: `${GYM.active.name.toUpperCase()} — tap E in the green (${GYM.hits}/${GYM.need})`, marker: GYM.marker, zone: [GYM.zoneAt - 0.11, GYM.zoneAt + 0.11], fill: GYM.hits / GYM.need };
  return null;
}
export const phase8Active = () => F.phase !== "idle" || !!GYM.active;
