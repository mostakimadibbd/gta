// Central mutable game store (refs, not React state) — read/written every
// frame by the 3D systems; the HUD polls it at 8 Hz and copies to React state.
import * as THREE from "three";
import { sfx } from "./audio";
import { CAR_SPAWNS, CAR_MODELS, PIER_SPAWN, MANSION, districtAt } from "../world";
import type { CarSpawn } from "../world";
import type { VehicleState } from "../physics/GamePhysics";

export interface NpcCar extends VehicleState {
  axis: "x" | "z"; dir: 1 | -1; lane: number; color: string; stopped: number; fleeing: number;
  side: "main" | "coral" | "north"; steerVis: number; pitch: number; damage: number;
  roll?: number; pitchVel?: number; rollVel?: number; // Phase 10: C++ vehicle_body state (traffic cheap version)
  svc?: "ambulance" | "fire"; // Phase 7: emergency-service traffic variants
  // ---- Phase 6: per-car kind + traffic-light / rush-hour / bus state ----
  kind?: "sedan" | "hatch" | "coupe" | "pickup" | "van" | "supercar" | "muscle" | "suv" | "classic" | "motorcycle" | "bus" | "taxi" | "bicycle" | "boat" | "wedge" | "hyper" | "gt" | "tow" | "skiff" | "plane"; fixed?: number; reckless?: boolean; blockedT?: number; dormant?: boolean;
  rushOnly?: boolean; parked?: boolean; parkX?: number; parkZ?: number; parkHeading?: number;
  busRoute?: boolean; wp?: number; stopT?: number;
  // ---- Phase 12 AI staggering: cached results of the two expensive
  // traffic scans (signal stop-line distance + same-lane queue gap).
  // Far cars rescan on a 1-in-3 slice and reuse these between scans;
  // near cars rescan every step. ----
  scanStop?: number; scanQueue?: number; scanWant?: boolean;
}
export interface Ped {
  x: number; z: number; heading: number; speed: number; axis: "x" | "z"; dir: 1 | -1; side: number; color: string;
  fleeUntil: number; swing: number; zone: string; active: boolean; downUntil: number; area: "main" | "coral" | "north";
  // ---- Phase 6 NPC life: destinations, sit/phone/shelter modes ----
  destX?: number; destZ?: number; mode?: "walk" | "sit" | "phone" | "shelter";
  waitUntil?: number; hasDog?: boolean; flinchUntil?: number;
  // ---- Phase 8 NPC memory: this ped saw you offend / was robbed by you /
  // was helped by you. Witness memory lasts ~2 game-hours; a robbery is
  // remembered for the rest of the game-day (ECO day serial). ----
  memWitnessUntil?: number; memRobbedDay?: number; memHelpedUntil?: number;
  recogCd?: number; // next G.timeS this ped may bark a recognition line
  flailUntil?: number; // Phase 9 ragdoll-lite: car-hit flail window
  kvx?: number; kvz?: number; // Phase 10: car-hit knock velocity (impact direction), decays in the ped loop
  // ---- Phase 14: the real verlet ragdoll (game/ragdoll.ts) — live
  // while the ped is down (near-field only); consumed impact velocity
  // lives in its prev-points, so kvx/kvz are zeroed when it seeds ----
  rag?: import("./ragdoll").RagdollState | null;
}
export interface Cop extends VehicleState { active: boolean; lightPhase: number; pitch: number; roll: number; }
export type WeatherKind = "Clear" | "Cloudy" | "Rain" | "Storm" | "Fog";
export type CrimeKind = "steal" | "hit" | "ped" | "reckless" | "assault" | "shoot" | "theft" | "robbery";
export interface StashItem { type: string; name: string; value: number; }
export interface StoredCar { kind: string; color: string; name: string; damage: number; fuel: number; brokenWindow: boolean; tuneLvl?: number; brakeLvl?: number; flatTyre?: boolean; }
/** Player-fleet car: a CarSpawn plus live state. Phase 6 fields are
 * optional so older creation sites (garage take-out, saves) stay valid. */
export interface PlayerCar {
  id: number; x: number; z: number; heading: number; color: string; model: string;
  kind: CarSpawn["kind"]; owned: boolean;
  state: VehicleState; stolen: boolean; damage: number; fuel: number; brokenWindow: boolean;
  pitch: number; roll: number; steerVis: number; storedAway: boolean;
  flatTyre?: boolean; tuneLvl?: number; brakeLvl?: number; pitchVel?: number; rollVel?: number;
  // Phase 10: asymmetric crumple per side [front, back, left(+x), right(−x)] 0..1,
  // and the C++ vehicle_body heave channel (pitch/roll reuse the fields above)
  dent?: [number, number, number, number]; bodyHeave?: number; bodyHeaveVel?: number;
}
export type WeaponKind = "pistol" | "smg" | "shotgun" | "bat" | "bottle";
export interface MissionResult { ok: boolean; title: string; reward: number; items: number; timeLeft: number; reason: string; at: number; }
export interface PendingCrime { kind: CrimeKind; due: number; }
export const nowS = () => (typeof performance !== "undefined" ? performance.now() / 1000 : Date.now() / 1000);

export const G = {
  playerPos: new THREE.Vector3(PIER_SPAWN.x, 0, PIER_SPAWN.z),
  playerHeading: Math.PI,
  followPos: new THREE.Vector3(PIER_SPAWN.x, 0, PIER_SPAWN.z),
  driving: false,
  activeCarId: -1,
  cars: CAR_SPAWNS.map((s, i): PlayerCar => ({ ...s, state: { x: s.x, z: s.z, heading: s.heading, speed: 0 } as VehicleState, stolen: false, damage: 0, fuel: 58 + ((i * 29) % 38), brokenWindow: false, pitch: 0, roll: 0, steerVis: 0, storedAway: false, flatTyre: false, tuneLvl: 0, brakeLvl: 0, pitchVel: 0, rollVel: 0 })),
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
  interior: "" as "" | "garage" | "club" | "police" | "clinic" | "restaurant" | "hangar" | "showroom" | "cafe" | "gym" | "loft",
  // ---- Phase 7: wind, sitting, replay requests, camera flash, boosts ----
  wind: 0.5, // 0..1 slow gust value — palm sway, boat bob, HUD/phone label
  sitting: false, // player parked on a bench / chair (Player pose + lock)
  // ---- Phase 13: the Sable Line — station index while riding the
  // tram (-1 = not riding). While riding, Player renders the seated
  // pose at tramSeatY and GameSystems never busts / bleeds heat. ----
  tramRide: -1,
  tramSeatY: 6.62,
  sitSpot: null as null | { x: number; z: number; heading: number },
  requestReplayId: "", // phone Story app → App starts a chapter replay
  camFlashAt: -9, // nowS() of the last speed-camera flash (App overlay)
  staminaBoostUntil: 0, // restaurant meal: stamina drain halved until G.timeS
  armed: false,
  ammo: 0, // legacy mirror of the SELECTED weapon's ammo (HUD compat)
  // ---- Phase 6: stamina / skills / weapon inventory / misc state ----
  stamina: 100, // 0..100; sprint/swim/cycling drain it (A7)
  exhausted: false, // latched at 0 until stamina recovers past 20
  skills: { driving: 0, shooting: 0, stamina: 0, strength: 0 }, // 0..100, persisted (strength: Phase 8 gym)
  skillShootAcc: 0, // shots fired toward the next Shooting point
  weaponOwned: { pistol: false, smg: false, shotgun: false, bat: false, bottle: false } as Record<WeaponKind, boolean>,
  weaponAmmo: { pistol: 0, smg: 0, shotgun: 0, bat: 0, bottle: 0 } as Record<WeaponKind, number>,
  // ---- Phase 9: free-aim (hold RMB / gamepad LT on foot) + 6th star ----
  aiming: false, // over-shoulder aim mode: slower move, camera-ray fire
  starHeat: 0, // serious crimes committed WHILE at 5★; 3 of them call in the Harbour Guard (6★)
  // ---- Phase 8: per-district reputation (NPC memory). 0 = stranger;
  // crimes witnessed in a district raise it; it decays on the daily tick.
  // High rep: witnesses report faster and locals start recognising you. ----
  zoneRep: {} as Record<string, number>,
  eatingUntil: 0, // hand-to-mouth pose window (vendor food)
  playerSprinting: false, // set by Player each frame (stamina drain input)
  bikePedalling: false, // set by Vehicle each frame (stamina drain input)
  inCover: false, // crouched against a wall/car (police sight + bust relief)
  fadeAt: 0, // nowS() of the last interior-door fade request (App overlay)
  eventNow: null as null | { kind: string; x: number; z: number; tipped?: boolean }, // live random event (B2)
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
  weaponSel: "fist" as "fist" | WeaponKind,
  missionResult: null as null | MissionResult, // debrief panel data (Visual V6)
  robbedUntil: {} as Record<string, number>, // register id → G.timeS when it can be robbed again
  settings: {
    shake: true, fov: 58, postFx: true, shadows: true,
    // ---- Phase 11: player override for the High-tier dynamic reflection
    // stack (SSR + planar water). Off = Standard reflections at any tier.
    // ---- Phase 14: default is now OFF (opt-in via Settings) — see the
    // one-time migration at the settings load below.
    reflFx: false,
    // ---- Phase 13: season pin — "auto" follows the 7-day calendar
    // (game/season.ts); a season name pins it until set back to auto.
    season: "auto",
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
/** Human label for the Phase 7 wind value (HUD chip + phone home). */
export const windLabel = (w: number) => (w < 0.3 ? "Calm" : w < 0.55 ? "Breezy" : w < 0.8 ? "Windy" : "Gusting");
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
export function persistSkills() { try { localStorage.setItem("harborfall-skills", JSON.stringify(G.skills)); } catch { /* ignore */ } }
/** Keep the legacy `armed`/`ammo` HUD mirrors in step with the weapon inventory. */
export function syncWeaponMirrors() {
  G.armed = G.weaponOwned.pistol || G.weaponOwned.smg || G.weaponOwned.shotgun;
  G.ammo = G.weaponSel === "fist" || G.weaponSel === "bat" ? 0 : G.weaponAmmo[G.weaponSel];
}
/** Phase 8: persist the per-district reputation map. */
export function persistZoneRep() { try { localStorage.setItem("harborfall-rep", JSON.stringify(G.zoneRep)); } catch { /* ignore */ } }
export const stashTotal = () => G.inventory.reduce((a, i) => a + i.value, 0);
try {
  const skills = localStorage.getItem("harborfall-skills"); if (skills) G.skills = { ...G.skills, ...(JSON.parse(skills) as Partial<typeof G.skills>) };
  const stash = localStorage.getItem("harborfall-stash"); if (stash) G.inventory = JSON.parse(stash) as StashItem[];
  const stored = localStorage.getItem("harborfall-stored-cars"); if (stored) G.storedCars = (JSON.parse(stored) as StoredCar[]).slice(0, 6);
  const st = localStorage.getItem("harborfall-settings"); if (st) G.settings = { ...G.settings, ...(JSON.parse(st) as Partial<typeof G.settings>) };
  // ---- Phase 14 ONE-TIME MIGRATION (reflSafeV): the Phase 11–13 build
  // defaulted reflFx ON, and on some machines (Retina Mac / Brave) the
  // High + SSR stack crashed the tab to a black screen. Existing saves
  // would greet their owner with that same crashing configuration, so
  // exactly once we force reflFx off and stamp the settings; the
  // player can re-enable it in Settings (it is stable now — capped
  // DPR/SSR — but the choice is theirs, not the crash's). ----
  const sAny = G.settings as typeof G.settings & { reflSafeV?: number };
  if (sAny.reflSafeV !== 1) { sAny.reflSafeV = 1; sAny.reflFx = false; persistSettings(); }
  const rep = localStorage.getItem("harborfall-rep"); if (rep) G.zoneRep = JSON.parse(rep) as Record<string, number>;
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

// ---- Phase 13: LAST-USED VEHICLE persistence (harborfall-lastcar) ----
// The car you last drove is saved when you get in, refreshed while you
// drive, and finalised when you get out — kind, colour, position,
// heading, damage, fuel and mods. On the next session it is restored
// where you left it (phone Map draws an amber "YOUR CAR" ring there).
// THE RULES (documented in BLUEPRINT §15): the snapshot is CLEARED
// when the car is wrecked (damage 100), when you are busted (the
// patrol impounds it — resetAfterArrest), and when the car is put
// away into a garage (GaragePanel). A world-spawn car is restored in
// place by spawn id; a garage/dynamic car is re-created from the
// snapshot (or un-stored if a matching put-away instance exists).
export interface LastCarSave {
  spawnId: number; // CAR_SPAWNS id for world cars, -1 for dynamic cars
  kind: string; color: string; model: string; owned: boolean; stolen: boolean;
  x: number; z: number; heading: number; damage: number; fuel: number;
  brokenWindow: boolean; tuneLvl: number; brakeLvl: number; flatTyre: boolean;
}
export const LASTCAR = { save: null as LastCarSave | null, carIndex: -1 };
export function noteLastCar(car: PlayerCar) {
  if (car.storedAway || car.damage >= 100) { clearLastCar(); return; }
  const spawnId = car.id >= 0 && car.id < CAR_SPAWNS.length && CAR_SPAWNS[car.id].kind === car.kind ? car.id : -1;
  LASTCAR.save = {
    spawnId, kind: car.kind, color: car.color, model: car.model, owned: car.owned, stolen: car.stolen,
    x: car.state.x, z: car.state.z, heading: car.state.heading,
    damage: Math.round(car.damage), fuel: Math.round(car.fuel), brokenWindow: car.brokenWindow,
    tuneLvl: car.tuneLvl ?? 0, brakeLvl: car.brakeLvl ?? 0, flatTyre: car.flatTyre ?? false,
  };
  LASTCAR.carIndex = G.cars.indexOf(car);
  try { localStorage.setItem("harborfall-lastcar", JSON.stringify(LASTCAR.save)); } catch { /* ignore */ }
}
export function clearLastCar() {
  LASTCAR.save = null; LASTCAR.carIndex = -1;
  try { localStorage.removeItem("harborfall-lastcar"); } catch { /* ignore */ }
}
try {
  const raw = localStorage.getItem("harborfall-lastcar");
  if (raw) {
    const s = JSON.parse(raw) as LastCarSave;
    if (s && s.damage < 100) {
      LASTCAR.save = s;
      const apply = (c: PlayerCar) => {
        c.state = { x: s.x, z: s.z, heading: s.heading, speed: 0 };
        c.x = s.x; c.z = s.z; c.heading = s.heading;
        c.damage = s.damage; c.fuel = s.fuel; c.brokenWindow = s.brokenWindow;
        c.tuneLvl = s.tuneLvl; c.brakeLvl = s.brakeLvl; c.flatTyre = s.flatTyre;
        c.storedAway = false;
      };
      if (s.spawnId >= 0) {
        const idx = G.cars.findIndex((c) => c.id === s.spawnId);
        if (idx >= 0) { apply(G.cars[idx]); LASTCAR.carIndex = idx; }
      } else {
        // dynamic car: un-store a matching put-away instance if one
        // exists, else re-create it from the snapshot
        const idx = G.cars.findIndex((c) => c.storedAway && c.kind === s.kind && c.color === s.color);
        if (idx >= 0) { apply(G.cars[idx]); LASTCAR.carIndex = idx; }
        else {
          G.cars.push({
            id: 1000 + G.cars.length, x: s.x, z: s.z, heading: s.heading, color: s.color,
            model: s.model || CAR_MODELS[s.kind as PlayerCar["kind"]]?.name || "Car", kind: s.kind as PlayerCar["kind"], owned: s.owned,
            state: { x: s.x, z: s.z, heading: s.heading, speed: 0 }, stolen: s.stolen, damage: s.damage, fuel: s.fuel,
            brokenWindow: s.brokenWindow, pitch: 0, roll: 0, steerVis: 0, storedAway: false,
            flatTyre: s.flatTyre, tuneLvl: s.tuneLvl, brakeLvl: s.brakeLvl, pitchVel: 0, rollVel: 0,
          });
          LASTCAR.carIndex = G.cars.length - 1;
        }
      }
    }
  }
} catch { /* storage unavailable */ }

function applyCrime(kind: CrimeKind) {
  if (G.crimeCooldown > 0 && kind !== "ped" && kind !== "shoot") return;
  G.crimeCooldown = 4;
  const before = G.wanted;
  // Phase 9: the 6th star is earned, not given — serious crimes (gunfire,
  // robbery, running a ped down) committed WHILE already at 5★ build
  // Harbour Guard heat; three of them escalate to 6★. Ordinary play
  // still effectively caps at 5★.
  if (G.wanted >= 5 && (kind === "shoot" || kind === "robbery" || kind === "ped")) {
    G.starHeat += 1;
    if (G.starHeat >= 3 && G.wanted < 6) {
      G.wanted = 6; G.starHeat = 0;
      bark("Dispatch", "All units — the Harbour Guard is rolling. Repeat, Guard is rolling.");
      sfx.star();
    }
  }
  if (kind === "shoot") G.wanted = Math.min(6, Math.max(G.wanted + 1, 2)); // gunfire: 2★ minimum
  else if (kind === "robbery") G.wanted = Math.min(6, Math.max(G.wanted + 1, 2)); // shop alarm: 2★ minimum
  else G.wanted = Math.min(6, G.wanted + (kind === "ped" ? 2 : 1));
  if (G.wanted > before && G.wanted <= 5) sfx.star();
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
export function addCrime(kind: CrimeKind, soft = false) {
  // Phase 8 memory: EVERY ped within earshot (30u) remembers seeing this,
  // and the district's reputation ticks up — whether or not the crime is
  // one of the instantly-known kinds. Robbery victims are flagged by the
  // pickpocket code itself (Interactions) since it knows the victim index.
  const px0 = G.followPos.x, pz0 = G.followPos.z;
  const zone = districtAt(px0, pz0);
  let anyWitness = false;
  for (const p of G.peds) {
    if (!p.active) continue;
    if ((p.x - px0) ** 2 + (p.z - pz0) ** 2 < 30 ** 2) { p.memWitnessUntil = G.timeS + 300; anyWitness = true; }
  }
  if (anyWitness) {
    G.zoneRep[zone] = Math.min(100, (G.zoneRep[zone] ?? 0) + (kind === "assault" || kind === "robbery" ? 14 : 8));
    persistZoneRep();
  }
  // Phase 9: a SUPPRESSED shot (soft) is not instantly known — it goes
  // through the witness pipeline below like any other quiet crime.
  if (!soft && (kind === "ped" || kind === "shoot" || kind === "robbery")) { applyCrime(kind); return; } // victim/gunfire/alarm: known at once
  const px = G.followPos.x, pz = G.followPos.z;
  let wi = -1; let wd = 26 ** 2; let wiHelped = -1;
  G.peds.forEach((p, i) => {
    const d = (p.x - px) ** 2 + (p.z - pz) ** 2;
    if (d >= 26 ** 2) return;
    // Phase 8: a ped you HELPED recently hesitates — they are only used
    // as the reporting witness if nobody else saw it, and they take 2.5 s
    if ((p.memHelpedUntil ?? 0) > G.timeS) { if (wiHelped < 0) wiHelped = i; return; }
    if (d < wd) { wd = d; wi = i; }
  });
  if (wi >= 0 || wiHelped >= 0) {
    // Phase 8: in a district where you're KNOWN (rep ≥ 40), witnesses
    // don't hesitate — the report lands in 0.8 s instead of 1.5 s.
    const delay = wi < 0 ? 2.5 : (G.zoneRep[zone] ?? 0) >= 40 ? 0.8 : 1.5;
    const who = wi >= 0 ? wi : wiHelped;
    G.pendingCrimes.push({ kind, due: nowS() + delay });
    G.reportingPed = who; G.witnessUntil = nowS() + delay;
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
  // Phase 7: the chosen home wins — the Coral apartment (36, 208) when
  // it's the set home and owned, else the villa, else the hospital corner
  // Phase 14: the Northgate Loft (−68, −190) joins the home rotation
  let home = "villa"; let ownsApt = false; let ownsLoft = false;
  try {
    home = localStorage.getItem("harborfall-home") ?? "villa";
    ownsApt = localStorage.getItem("harborfall-apartment") === "1";
    ownsLoft = localStorage.getItem("harborfall-loft") === "1";
  } catch { /* ignore */ }
  if (home === "apartment" && ownsApt) G.playerPos.set(36, 0, 208);
  else if (home === "loft" && ownsLoft) G.playerPos.set(-68, 0, -190);
  else if (G.ownsMansion) G.playerPos.set(MANSION.x + 9, 0, MANSION.z + 9);
  else G.playerPos.set(-100, 0, 100);
  G.interior = "";
  G.tramRide = -1; // Phase 13: a respawn always steps off the tram
}
export function resetAfterArrest(fine: number) {
  clearLastCar(); // Phase 13: busted = the patrol impounds your last car
  G.finesPaid += Math.min(fine, G.cash);
  G.cash = Math.max(0, G.cash - fine);
  if (G.inventory.length) { G.inventory = []; persistInventory(); toast("Busted — your stash was confiscated"); }
  G.wanted = 0; G.starHeat = 0; G.bustTimer = 0; G.health = Math.max(60, G.health);
  G.driving = false; G.activeCarId = -1;
  respawnPoint();
  for (const c of G.cops) c.active = false;
}
export function resetAfterWasted() {
  G.finesPaid += Math.min(100, G.cash);
  G.cash = Math.max(0, G.cash - 100);
  G.wanted = 0; G.starHeat = 0; G.health = 100; G.driving = false; G.activeCarId = -1;
  respawnPoint();
  for (const c of G.cops) c.active = false;
}
