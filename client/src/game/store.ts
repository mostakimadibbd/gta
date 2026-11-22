// Central mutable game store (refs, not React state) — read/written every
// frame by the 3D systems; the HUD polls it at 8 Hz and copies to React state.
import * as THREE from "three";
import { sfx } from "./audio";
import { CAR_SPAWNS, PIER_SPAWN } from "../world";
import type { VehicleState } from "../physics/GamePhysics";

export interface NpcCar extends VehicleState { axis: "x" | "z"; dir: 1 | -1; lane: number; color: string; stopped: number; fleeing: number; }
export interface Ped { x: number; z: number; heading: number; speed: number; axis: "x" | "z"; dir: 1 | -1; side: number; color: string; fleeUntil: number; swing: number; }
export interface Cop extends VehicleState { active: boolean; lightPhase: number; }

export const G = {
  playerPos: new THREE.Vector3(PIER_SPAWN.x, 0, PIER_SPAWN.z),
  playerHeading: Math.PI,
  followPos: new THREE.Vector3(PIER_SPAWN.x, 0, PIER_SPAWN.z),
  driving: false,
  activeCarId: -1,
  cars: CAR_SPAWNS.map((s) => ({ ...s, state: { x: s.x, z: s.z, heading: s.heading, speed: 0 } as VehicleState, stolen: false })),
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
};

export function addCrime(kind: "steal" | "hit" | "ped" | "reckless") {
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

export function resetAfterArrest(fine: number) {
  G.cash = Math.max(0, G.cash - fine);
  G.wanted = 0; G.bustTimer = 0; G.health = Math.max(60, G.health);
  G.driving = false; G.activeCarId = -1;
  G.playerPos.set(-100, 0, 100);
  for (const c of G.cops) c.active = false;
}
export function resetAfterWasted() {
  G.cash = Math.max(0, G.cash - 100);
  G.wanted = 0; G.health = 100; G.driving = false; G.activeCarId = -1;
  G.playerPos.set(-100, 0, 100);
  for (const c of G.cops) c.active = false;
}
