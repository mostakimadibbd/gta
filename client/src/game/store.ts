// Central mutable game store (refs, not React state) — read/written every
// frame by the 3D systems; the HUD polls it at 8 Hz and copies to React state.
import * as THREE from "three";
import { sfx } from "./audio";
import { CAR_SPAWNS, PIER_SPAWN } from "../world";
import type { VehicleState } from "../physics/GamePhysics";

export interface NpcCar extends VehicleState { axis: "x" | "z"; dir: 1 | -1; lane: number; color: string; stopped: number; fleeing: number; }
export interface Ped { x: number; z: number; heading: number; speed: number; axis: "x" | "z"; dir: 1 | -1; side: number; color: string; fleeUntil: number; swing: number; zone: string; active: boolean; }
export interface Cop extends VehicleState { active: boolean; lightPhase: number; }
export type WeatherKind = "Clear" | "Cloudy" | "Rain" | "Storm" | "Fog";
export interface PendingCrime { kind: "steal" | "hit" | "ped" | "reckless"; due: number; }
export const nowS = () => (typeof performance !== "undefined" ? performance.now() / 1000 : Date.now() / 1000);

export const G = {
  playerPos: new THREE.Vector3(PIER_SPAWN.x, 0, PIER_SPAWN.z),
  playerHeading: Math.PI,
  followPos: new THREE.Vector3(PIER_SPAWN.x, 0, PIER_SPAWN.z),
  driving: false,
  activeCarId: -1,
  cars: CAR_SPAWNS.map((s, i) => ({ ...s, state: { x: s.x, z: s.z, heading: s.heading, speed: 0 } as VehicleState, stolen: false, damage: 0, fuel: 58 + ((i * 29) % 38) })),
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
};
export function toast(msg: string) { G.toast = msg; G.toastAt = nowS(); }

function applyCrime(kind: "steal" | "hit" | "ped" | "reckless") {
  if (G.crimeCooldown > 0 && kind !== "ped") return;
  G.crimeCooldown = 4;
  const inc = kind === "ped" ? 2 : 1;
  const before = G.wanted;
  G.wanted = Math.min(5, G.wanted + inc);
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
export function addCrime(kind: "steal" | "hit" | "ped" | "reckless") {
  if (kind === "ped") { applyCrime(kind); return; }
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

export function resetAfterArrest(fine: number) {
  G.finesPaid += Math.min(fine, G.cash);
  G.cash = Math.max(0, G.cash - fine);
  G.wanted = 0; G.bustTimer = 0; G.health = Math.max(60, G.health);
  G.driving = false; G.activeCarId = -1;
  G.playerPos.set(-100, 0, 100);
  for (const c of G.cops) c.active = false;
}
export function resetAfterWasted() {
  G.finesPaid += Math.min(100, G.cash);
  G.cash = Math.max(0, G.cash - 100);
  G.wanted = 0; G.health = 100; G.driving = false; G.activeCarId = -1;
  G.playerPos.set(-100, 0, 100);
  for (const c of G.cops) c.active = false;
}
