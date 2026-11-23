// Central mutable game store (refs, not React state) — read/written every
// frame by the 3D systems; the HUD polls it at 8 Hz and copies to React state.
import * as THREE from "three";
import { sfx } from "./audio";
import { CAR_SPAWNS, PIER_SPAWN, MANSION } from "../world";
import type { VehicleState } from "../physics/GamePhysics";

export interface NpcCar extends VehicleState { axis: "x" | "z"; dir: 1 | -1; lane: number; color: string; stopped: number; fleeing: number; side: "main" | "coral"; steerVis: number; pitch: number; damage: number; }
export interface Ped { x: number; z: number; heading: number; speed: number; axis: "x" | "z"; dir: 1 | -1; side: number; color: string; fleeUntil: number; swing: number; zone: string; active: boolean; downUntil: number; area: "main" | "coral"; }
export interface Cop extends VehicleState { active: boolean; lightPhase: number; pitch: number; roll: number; }
export type WeatherKind = "Clear" | "Cloudy" | "Rain" | "Storm" | "Fog";
export type CrimeKind = "steal" | "hit" | "ped" | "reckless" | "assault" | "shoot" | "theft" | "robbery";
export interface StashItem { type: string; name: string; value: number; }
export interface StoredCar { kind: string; color: string; name: string; damage: number; fuel: number; brokenWindow: boolean; }
export interface MissionResult { ok: boolean; title: string; reward: number; items: number; timeLeft: number; reason: string; at: number; }
export interface PendingCrime { kind: CrimeKind; due: number; }
export const nowS = () => (typeof performance !== "undefined" ? performance.now() / 1000 : Date.now() / 1000);

export const G = {
  playerPos: new THREE.Vector3(PIER_SPAWN.x, 0, PIER_SPAWN.z),
  playerHeading: Math.PI,
  followPos: new THREE.Vector3(PIER_SPAWN.x, 0, PIER_SPAWN.z),
  driving: false,
  activeCarId: -1,
  cars: CAR_SPAWNS.map((s, i) => ({ ...s, state: { x: s.x, z: s.z, heading: s.heading, speed: 0 } as VehicleState, stolen: false, damage: 0, fuel: 58 + ((i * 29) % 38), brokenWindow: false, pitch: 0, roll: 0, steerVis: 0, storedAway: false })),
  traffic: [] as NpcCar[],
  peds: [] as Ped[],
  cops: [] as Cop[],
  wanted: 0,
  wantedCooldown: 0, // seconds of being unseen before a star drops
  crimeCooldown: 0,
  bustTimer: 0,
  health: 100,
  cash: 250,
  tokens: 0,
  speedKph: 0,
  status: "" as "" | "busted" | "wasted",
  statusTimer: 0,
  dialogueActive: false,
  pausedBySystem: false,
  dayTime: 0.72, // 0..1, starts at golden dusk
  dayPaused: false,
  nightFactor: 0,
  objective: null as null | { x: number; z: number; label: string; kind: string },
  eventQueue: [] as string[], // "crime:steal" | "crime:hit" | "crime:ped" | "damage" ...
  // ---- Phase 2: weather ----
  weather: "Clear" as WeatherKind,
  weatherIn: 110, // seconds until the weather state machine rolls again
  rainAmt: 0, // 0..1 lerped visual intensity
  fogAmt: 0,
  lightning: 0, // 0..1 flash envelope (storms)
  // ---- Phase 2: witnesses / bank / toast ----
  pendingCrimes: [] as PendingCrime[],
  reportingPed: -1, // index into G.peds of the ped currently "calling it in"
  witnessUntil: 0, // nowS() timestamp when the report lands
  lifetimeEarned: 0,
  finesPaid: 0,
  toast: "",
  toastAt: 0,
  // ---- Phase 3: cameras / swimming / interiors / combat / property ----
  timeS: 0, // elapsed game clock (set by GameSystems every frame)
  firstPerson: false,
  swimming: false,
  interior: "" as "" | "garage" | "club",
  armed: false,
  ammo: 0,
  punchT: -9, // nowS() of the last punch (drives the arm-swing animation)
  shotFx: { t: -9, mx: 0, mz: 0, hx: 0, hz: 0, hit: false }, // muzzle→hit fx
  promptText: "",
  promptWarn: false,
  interact: null as null | (() => void),
  ownsMansion: false,
  savedCarId: -1, // G.cars index of the garage-saved car, if any
  // ---- Phase 4: theft / garages / crouch / photo mode / settings ----
  inventory: [] as StashItem[], // stolen goods carried (fence at a pawn shop)
  storedCars: [] as StoredCar[], // garage-kept cars (max 6, persisted)
  crouched: false,
  stealthEye: "" as "" | "open" | "closed", // HUD stealth indicator state
  hold: null as null | { label: string; progress: number }, // hold-E progress (robbery / break-in)
  garageZone: null as null | { id: string; label: string }, // garage zone the player is standing in
  requestCharSelect: false, // phone/pause → App opens the character select
  photoMode: false,
  weaponSel: "fist" as "fist" | "pistol",
  missionResult: null as null | MissionResult, // debrief panel data (Visual V6)
  robbedUntil: {} as Record<string, number>, // register id → G.timeS when it can be robbed again
  settings: {
    shake: true, fov: 58, postFx: true, shadows: true,
    // ---- Phase 5: quality tier + subtitles (game/quality.ts owns detection) ----
    quality: "medium" as "low" | "medium" | "high",
    subSize: "M" as "S" | "M" | "L", // subtitle text size
    subBg: true, // subtitle background plate on/off
    subBarks: true, // ambient barks (witness shouts, dispatch radio) as subtitles
    letterbox: true, // cinematic bars during dialogue
  },
  shakeAmp: 0, // current camera-shake amplitude (gated by settings.shake)
  bark: null as null | { who: string; text: string; at: number }, // ambient subtitle line (Phase 5)
  enterAnimT: 0, // seconds left of the enter-car slide (Player sets, Vehicle waits)
};
export function toast(msg: string) { G.toast = msg; G.toastAt = nowS(); }
/** Ambient subtitle bark — witness shouts, police radio, system voices. */
export function bark(who: string, text: string) { G.bark = { who, text, at: nowS() }; }

// ---- Phase 3 persistence: mansion ownership + garage-saved car ----
export interface SavedCar { kind: string; color: string; x: number; z: number; heading: number; }
export function loadSavedCar(): SavedCar | null {
  try { const raw = localStorage.getItem("harborfall-garage-car"); if (raw) return JSON.parse(raw) as SavedCar; } catch { /* ignore */ }
  return null;
}
export function persistSavedCar(c: SavedCar | null) {
  try { if (c) localStorage.setItem("harborfall-garage-car", JSON.stringify(c)); else localStorage.removeItem("harborfall-garage-car"); } catch { /* ignore */ }
}
// ---- Phase 4 persistence: stash, stored cars, settings ----
export function persistInventory() { try { localStorage.setItem("harborfall-stash", JSON.stringify(G.inventory)); } catch { /* ignore */ } }
export function persistStoredCars() { try { localStorage.setItem("harborfall-stored-cars", JSON.stringify(G.storedCars)); } catch { /* ignore */ } }
export function persistSettings() { try { localStorage.setItem("harborfall-settings", JSON.stringify(G.settings)); } catch { /* ignore */ } }
export const stashTotal = () => G.inventory.reduce((a, i) => a + i.value, 0);
try {
  const stash = localStorage.getItem("harborfall-stash"); if (stash) G.inventory = JSON.parse(stash) as StashItem[];
  const stored = localStorage.getItem("harborfall-stored-cars"); if (stored) G.storedCars = (JSON.parse(stored) as StoredCar[]).slice(0, 6);
  const st = localStorage.getItem("harborfall-settings"); if (st) G.settings = { ...G.settings, ...(JSON.parse(st) as Partial<typeof G.settings>) };
} catch { /* storage unavailable */ }

try {
  G.ownsMansion = localStorage.getItem("harborfall-mansion") === "1";
  const saved = loadSavedCar();
  if (saved) {
    G.cars.push({
      id: G.cars.length, x: saved.x, z: saved.z, heading: saved.heading, color: saved.color,
      model: "Garage-kept", kind: saved.kind as typeof G.cars[number]["kind"], owned: true,
      state: { x: saved.x, z: saved.z, heading: saved.heading, speed: 0 }, stolen: false, damage: 0, fuel: 85,
      brokenWindow: false, pitch: 0, roll: 0, steerVis: 0, storedAway: false,
    });
    G.savedCarId = G.cars.length - 1;
  }
} catch { /* storage unavailable */ }

function applyCrime(kind: CrimeKind) {
  if (G.crimeCooldown > 0 && kind !== "ped" && kind !== "shoot") return;
  G.crimeCooldown = 4;
  const before = G.wanted;
  if (kind === "shoot") G.wanted = Math.min(5, Math.max(G.wanted + 1, 2)); // gunfire: 2★ minimum
  else if (kind === "robbery") G.wanted = Math.min(5, Math.max(G.wanted + 1, 2)); // shop alarm: 2★ minimum
  else G.wanted = Math.min(5, G.wanted + (kind === "ped" ? 2 : 1));
  if (G.wanted > before) sfx.star();
  G.wantedCooldown = 0;
  if (kind === "ped") G.health = Math.max(0, G.health - 4);
  if (kind === "hit") G.health = Math.max(0, G.health - 3);
}

/**
 * Witness system (Blueprint §4): non-violent crimes are not instantly known
 * to the harbour patrol. If a pedestrian is within ~26u, they "call it in" —
 * the star only lands ~1.5s later (the ped shows a "!" while reporting, and
 * processPendingCrimes() applies it). Hitting a pedestrian is witnessed by
 * the victim, so it applies immediately. No witness = no report.
 */
export function addCrime(kind: CrimeKind) {
  if (kind === "ped" || kind === "shoot" || kind === "robbery") { applyCrime(kind); return; } // victim/gunfire/alarm: known at once
  const px = G.followPos.x, pz = G.followPos.z;
  let wi = -1; let wd = 26 ** 2;
  G.peds.forEach((p, i) => { const d = (p.x - px) ** 2 + (p.z - pz) ** 2; if (d < wd) { wd = d; wi = i; } });
  if (wi >= 0) {
    G.pendingCrimes.push({ kind, due: nowS() + 1.5 });
    G.reportingPed = wi; G.witnessUntil = nowS() + 1.5;
    return;
  }
  applyCrime(kind);
}
export function processPendingCrimes() {
  if (!G.pendingCrimes.length) return;
  const t = nowS();
  const due = G.pendingCrimes.filter((c) => c.due <= t);
  G.pendingCrimes = G.pendingCrimes.filter((c) => c.due > t);
  for (const c of due) applyCrime(c.kind);
  if (t > G.witnessUntil) G.reportingPed = -1;
}

function respawnPoint() {
  // villa owners wake up at home; everyone else gets the hospital corner
  if (G.ownsMansion) G.playerPos.set(MANSION.x + 9, 0, MANSION.z + 9);
  else G.playerPos.set(-100, 0, 100);
  G.interior = "";
}
export function resetAfterArrest(fine: number) {
  G.finesPaid += Math.min(fine, G.cash);
  G.cash = Math.max(0, G.cash - fine);
  if (G.inventory.length) { G.inventory = []; persistInventory(); toast("Busted — your stash was confiscated"); }
  G.wanted = 0; G.bustTimer = 0; G.health = Math.max(60, G.health);
  G.driving = false; G.activeCarId = -1;
  respawnPoint();
  for (const c of G.cops) c.active = false;
}
export function resetAfterWasted() {
  G.finesPaid += Math.min(100, G.cash);
  G.cash = Math.max(0, G.cash - 100);
  G.wanted = 0; G.health = 100; G.driving = false; G.activeCarId = -1;
  respawnPoint();
  for (const c of G.cops) c.active = false;
}
