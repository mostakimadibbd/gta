import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { G, addCrime, processPendingCrimes, resetAfterArrest, resetAfterWasted, persistSavedCar, persistStoredCars, bark } from "../game/store";
import { M, currentTarget, endMission, persist, effectivePayout } from "../game/missionState";
import { gates, type QualityTier } from "../game/quality";
import { pushPhoneMsg } from "../game/phone";
import { ROAD_COORDS, CORAL_ROAD_X, CORAL_ROAD_Z, districtAt, isBlocked, MANSION_DRIVE, groundYAt, CAR_MODELS } from "../world";
import { glowTexture } from "../textures";
import { fallbackPhysics, type PhysicsEngine } from "../physics/GamePhysics";
import type { GameTheme } from "../themes";
import { sfx } from "../game/audio";
import CarBody, { type CarKind } from "./CarBody";
import { buildHumanoid, animateHumanoid, type HumanoidRig } from "../humanoid";

const TRAFFIC_KINDS: CarKind[] = ["sedan", "suv", "muscle", "sedan", "supercar", "classic", "pickup", "hatch", "coupe", "suv", "muscle", "sedan"];
// Mood-board pedestrian variety: 10 outfit combos (male + female, tees,
// tanks, hoodies, varsity, crop, shorts, caps, shades, tattoo sleeve…)
const PED_OUTFITS = [
  { gender: "m" as const, topStyle: "tee" as const, bottom: "#2b3440", bottomStyle: "jeans" as const, skin: "#c68863", hair: "#14100e", hairStyle: "cap" as const, sunglasses: false, cap: undefined as string | undefined, tattoo: false, necklace: false },
  { gender: "f" as const, topStyle: "tank" as const, bottom: "#274268", bottomStyle: "jeans" as const, skin: "#f1c27d", hair: "#2d1d12", hairStyle: "bun" as const, sunglasses: false, cap: undefined, tattoo: false, necklace: true },
  { gender: "m" as const, topStyle: "hoodie" as const, bottom: "#3a3f4a", bottomStyle: "jeans" as const, skin: "#ffdbac", hair: "#4a2f1a", hairStyle: "flat" as const, sunglasses: false, cap: undefined, tattoo: false, necklace: false },
  { gender: "f" as const, topStyle: "crop" as const, bottom: "#e8e4da", bottomStyle: "shorts" as const, skin: "#e0ac69", hair: "#14100e", hairStyle: "ponytail" as const, sunglasses: true, cap: undefined, tattoo: false, necklace: false },
  { gender: "m" as const, topStyle: "varsity" as const, bottom: "#232c38", bottomStyle: "jeans" as const, skin: "#6b4423", hair: "#14100e", hairStyle: "cap" as const, sunglasses: false, cap: "#b3312c", tattoo: false, necklace: false },
  { gender: "f" as const, topStyle: "tee" as const, bottom: "#5c4a32", bottomStyle: "shorts" as const, skin: "#8d5524", hair: "#b5522a", hairStyle: "bun" as const, sunglasses: false, cap: undefined, tattoo: true, necklace: false },
  { gender: "m" as const, topStyle: "tank" as const, bottom: "#313d33", bottomStyle: "jeans" as const, skin: "#e0ac69", hair: "#20242a", hairStyle: "flat" as const, sunglasses: true, cap: undefined, tattoo: true, necklace: true },
  { gender: "f" as const, topStyle: "hoodie" as const, bottom: "#40342a", bottomStyle: "jeans" as const, skin: "#c68863", hair: "#4a2f1a", hairStyle: "ponytail" as const, sunglasses: false, cap: undefined, tattoo: false, necklace: false },
  { gender: "m" as const, topStyle: "tee" as const, bottom: "#274268", bottomStyle: "shorts" as const, skin: "#f1c27d", hair: "#777777", hairStyle: "cap" as const, sunglasses: false, cap: "#274268", tattoo: false, necklace: true },
  { gender: "f" as const, topStyle: "varsity" as const, bottom: "#2b3440", bottomStyle: "jeans" as const, skin: "#ffdbac", hair: "#2d1d12", hairStyle: "bun" as const, sunglasses: true, cap: undefined, tattoo: false, necklace: false },
];

export interface SysCallbacks {
  dialogue: (lines: { who: string; text: string }[], after: () => void) => void;
  popup: (text: string) => void;
  banner: (text: string, ok: boolean) => void;
  storyFinished: () => void;
  event: (name: string) => void;
}
const TRAFFIC_COLORS = ["#e2574c", "#3d8bfd", "#f2b134", "#39b56a", "#e8e8e8", "#7a4fd0", "#ff7f50", "#2ec4b6", "#c0c6cc", "#8a5a2b", "#4a6b8a", "#d6336c"];
const PED_COLORS = ["#e2574c", "#f2b134", "#39b56a", "#3d8bfd", "#ff7f50", "#2ec4b6", "#e8e8e8", "#946b2d"];
const rndRoad = () => ROAD_COORDS[Math.floor(Math.random() * ROAD_COORDS.length)];
const headingFor = (axis: "x" | "z", dir: number) => (axis === "x" ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI);

function initWorld() {
  if (G.traffic.length === 0) {
    for (let i = 0; i < 12; i++) {
      const axis = i % 2 === 0 ? "x" : "z"; const dir = (i % 4 < 2 ? 1 : -1) as 1 | -1;
      const fixed = rndRoad(); const along = -100 + (i * 37) % 200;
      const lane = dir > 0 ? 2.8 : -2.8;
      G.traffic.push({
        x: axis === "x" ? along : fixed + lane, z: axis === "x" ? fixed + lane : along,
        heading: headingFor(axis, dir), speed: 8, axis, dir, lane, color: TRAFFIC_COLORS[i], stopped: 0, fleeing: 0,
        side: "main", steerVis: 0, pitch: 0, damage: 0,
      });
    }
    // Coral Shores traffic — its own loop on the far grid (Phase 4)
    for (let i = 0; i < 6; i++) {
      const axis = i % 2 === 0 ? "x" : "z"; const dir = (i % 4 < 2 ? 1 : -1) as 1 | -1;
      const fixed = axis === "x" ? CORAL_ROAD_Z[i % 3] : CORAL_ROAD_X[i % 3];
      const along = (axis === "x" ? 38 : 206) + ((i * 31) % 70);
      const lane = dir > 0 ? 2.8 : -2.8;
      G.traffic.push({
        x: axis === "x" ? along : fixed + lane, z: axis === "x" ? fixed + lane : along,
        heading: headingFor(axis, dir), speed: 8, axis, dir, lane, color: TRAFFIC_COLORS[(i + 5) % TRAFFIC_COLORS.length], stopped: 0, fleeing: 0,
        side: "coral", steerVis: 0, pitch: 0, damage: 0,
      });
    }
  }
  if (G.peds.length === 0) {
    for (let i = 0; i < 14; i++) {
      const axis = i % 2 === 0 ? "x" : "z"; const dir = (i % 3 === 0 ? -1 : 1) as 1 | -1;
      const fixed = rndRoad(); const along = -105 + (i * 29) % 210; const side = i % 2 === 0 ? 7.6 : -7.6;
      const px0 = axis === "x" ? along : fixed + side, pz0 = axis === "x" ? fixed + side : along;
      G.peds.push({
        x: px0, z: pz0,
        heading: headingFor(axis, dir), speed: 0, axis, dir, side, color: PED_COLORS[i % PED_COLORS.length], fleeUntil: 0, swing: Math.random() * 6,
        zone: districtAt(px0, pz0), active: true, downUntil: 0, area: "main",
      });
    }
    for (let i = 0; i < 6; i++) {
      const axis = i % 2 === 0 ? "x" : "z"; const dir = (i % 3 === 0 ? -1 : 1) as 1 | -1;
      const fixed = axis === "x" ? CORAL_ROAD_Z[i % 3] : CORAL_ROAD_X[i % 3];
      const along = (axis === "x" ? 40 : 208) + ((i * 23) % 64); const side = i % 2 === 0 ? 7.6 : -7.6;
      const px0 = axis === "x" ? along : fixed + side, pz0 = axis === "x" ? fixed + side : along;
      G.peds.push({
        x: px0, z: pz0,
        heading: headingFor(axis, dir), speed: 0, axis, dir, side, color: PED_COLORS[(i + 3) % PED_COLORS.length], fleeUntil: 0, swing: Math.random() * 6,
        zone: "Coral Shores", active: true, downUntil: 0, area: "coral",
      });
    }
  }
  if (G.cops.length === 0) for (let i = 0; i < 6; i++) G.cops.push({ x: 0, z: -140, heading: 0, speed: 0, active: false, lightPhase: i * 0.7, pitch: 0, roll: 0 });
}

export default function GameSystems({ paused, physicsRef, theme, cb, tokenCountRef, quality }: {
  paused: boolean; physicsRef: MutableRefObject<PhysicsEngine>; theme: GameTheme;
  cb: MutableRefObject<SysCallbacks>; tokenCountRef: MutableRefObject<number>;
  quality: QualityTier;
}) {
  initWorld();
  const trafficRefs = useRef<Array<THREE.Group | null>>([]);
  const pedRefs = useRef<Array<THREE.Group | null>>([]);
  const pedRigs = useMemo<HumanoidRig[]>(() => G.peds.map((pd, i) => {
    const o = PED_OUTFITS[i % PED_OUTFITS.length];
    return buildHumanoid({
      top: pd.color, sleeve: "#e8e4da", bottom: o.bottom, skin: o.skin, hair: o.hair,
      shoes: i % 2 ? "#2a2019" : "#14161a", topStyle: o.topStyle, bottomStyle: o.bottomStyle,
      gender: o.gender, hairStyle: o.hairStyle, sunglasses: o.sunglasses, cap: o.cap,
      tattooSleeve: o.tattoo, necklace: o.necklace,
      build: (["average", "broad", "slim"] as const)[i % 3],
      beard: o.gender === "m" && i % 5 === 2,
    });
  }), []);
  const copRefs = useRef<Array<THREE.Group | null>>([]);
  const copLights = useRef<Array<[THREE.Mesh | null, THREE.Mesh | null]>>([]);
  const copGlowSprites = useRef<Array<[THREE.Sprite | null, THREE.Sprite | null]>>([]);
  const policeGlow = useRef<THREE.Group>(null);
  const glowTex = useMemo(() => glowTexture(), []);
  const reportRefs = useRef<Array<THREE.Group | null>>([]);
  // ---- Phase 2 police state: last-known position + search + roadblocks ----
  const lastKnown = useRef<{ x: number; z: number } | null>(null);
  const playerSeen = useRef(false);
  const searchAng = useRef(0);
  const roadblock = useRef<{ x: number; z: number; hx: number; hz: number; ox: number; oz: number; active: boolean; cooldown: number }>({ x: 0, z: 0, hx: 1, hz: 0, ox: 0, oz: 1, active: false, cooldown: 0 });
  const rbRefs = useRef<Array<THREE.Group | null>>([]);
  const rbHitCd = useRef(0);
  // ---- Phase 2 NPC-life vignettes: seated + talking humanoids ----
  const vignettes = useMemo(() => {
    const mk = (o: Parameters<typeof buildHumanoid>[0]) => buildHumanoid(o);
    return {
      seated: [
        { rig: mk({ top: "#7a4a2b", bottom: "#2b3440", skin: "#e0ac69", hair: "#20242a", topStyle: "tee", gender: "m", hairStyle: "flat" }), pos: [74, -76, 0.6] as const },
        { rig: mk({ top: "#2e6b8a", bottom: "#e8e4da", skin: "#f1c27d", hair: "#b5522a", topStyle: "crop", bottomStyle: "shorts", gender: "f", hairStyle: "bun" }), pos: [-24, 118.5, -0.4] as const },
      ],
      talking: [
        { rig: mk({ top: "#274268", bottom: "#232c38", skin: "#c68863", hair: "#14100e", topStyle: "hoodie", gender: "m", hairStyle: "cap", cap: "#b3312c" }), pos: [66, -66, 0] as const, face: 2.2, talker: true },
        { rig: mk({ top: "#e8e4da", bottom: "#5c4a32", skin: "#8d5524", hair: "#14100e", topStyle: "tank", gender: "f", hairStyle: "ponytail", tattooSleeve: true }), pos: [67.4, -64.8, 0] as const, face: -0.9, talker: false },
        { rig: mk({ top: "#39b56a", bottom: "#2b3440", skin: "#ffdbac", hair: "#4a2f1a", topStyle: "tee", gender: "f", hairStyle: "bun", sunglasses: true }), pos: [30, 118, 0] as const, face: 0.8, talker: false },
        { rig: mk({ top: "#e2574c", bottom: "#274268", skin: "#6b4423", hair: "#14100e", topStyle: "varsity", gender: "m", hairStyle: "flat", necklace: true }), pos: [31.4, 119.1, 0] as const, face: -2.3, talker: true },
      ],
    };
  }, []);
  const birdRef = useRef<THREE.Group>(null);
  const heliRef = useRef<THREE.Group>(null);
  const heliRotor = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Group>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const scene = useThree((s) => s.scene);
  const hitCooldown = useRef(0);
  const bg = useMemo(() => new THREE.Color(theme.sky), [theme.sky]);
  const fogC = useMemo(() => new THREE.Color(theme.fog), [theme.fog]);

  useEffect(() => {
    scene.background = bg;
    scene.fog = new THREE.Fog(fogC.getHex(), theme.fogNear, theme.fogFar);
  }, [scene, bg, fogC, theme]);

  const garageSave = useRef({ timer: 0, lastKey: "" });
  // Phase 4: per-car steering refs (front-wheel visuals) + traffic honks +
  // a frame counter for the far-ped animation tick skip (Visual V7)
  const trafficSteerRefs = useMemo(() => G.traffic.map(() => ({ current: 0 })), []);
  const trafficBrakeRefs = useRef<Array<{ current: boolean }>>(G.traffic.map(() => ({ current: false })));
  const copSteerRefs = useMemo(() => G.cops.map(() => ({ current: 0 })), []);
  const honkCd = useRef(0);
  const frameNo = useRef(0);
  const crashCd = useRef(0);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;
    G.timeS = t;
    // ---- day cycle (5-minute full cycle; L pauses/resumes it from App) ----
    if (!paused && !G.dayPaused) G.dayTime = (G.dayTime + dt / 300) % 1;
    const sunAng = G.dayTime * Math.PI * 2 - Math.PI / 2;
    const elev = Math.sin(sunAng);
    const night = THREE.MathUtils.clamp(-elev * 1.4 + 0.35, 0, 1);
    G.nightFactor = night;
    if (sun.current) {
      sun.current.castShadow = G.settings.shadows; // Settings toggle (PDF delta C)
      // shadow camera FOLLOWS the player (tight ±55u, 2048 map) — real shadows
      // everywhere on the map, not just near the origin
      sun.current.position.set(G.followPos.x + Math.cos(sunAng) * 70, Math.max(10, elev * 75), G.followPos.z + 30);
      sun.current.target.position.set(G.followPos.x, 0, G.followPos.z);
      sun.current.target.updateMatrixWorld();
      sun.current.intensity = theme.sunIntensity * THREE.MathUtils.clamp(elev + 0.45, 0.12, 1);
      sun.current.color.set(theme.sunColor);
    }
    if (amb.current) amb.current.intensity = theme.ambient * (1 - night * 0.45) + G.lightning * 1.7;
    if (hemi.current) hemi.current.intensity = 1.05 * (1 - night * 0.5);
    if (scene.background instanceof THREE.Color) scene.background.copy(bg).multiplyScalar((1 - night * 0.55) * (1 - G.rainAmt * 0.22) + G.lightning * 0.35);
    if (paused || G.dialogueActive || G.status) {
      // still render positions below? No: freeze gameplay while paused/dialogue/status.
      syncMeshes(t); return;
    }
    hitCooldown.current = Math.max(0, hitCooldown.current - dt);
    rbHitCd.current = Math.max(0, rbHitCd.current - dt);
    G.crimeCooldown = Math.max(0, G.crimeCooldown - dt);
    processPendingCrimes(); // witness reports land ~1.5s after the crime

    const px = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId].state.x : G.playerPos.x;
    const pz = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId].state.z : G.playerPos.z;
    const pSpeed = G.driving ? Math.abs(G.cars[G.activeCarId]?.state.speed ?? 0) : 0;

    // ---- traffic AI (Port Sable + Coral Shores loops) ----
    honkCd.current = Math.max(0, honkCd.current - dt);
    crashCd.current = Math.max(0, crashCd.current - dt);
    for (const car of G.traffic) {
      const prevSpeed = car.speed;
      const prevHeading = car.heading;
      if (car.stopped > 0) { car.stopped -= dt; car.speed = Math.max(0, car.speed - 20 * dt); }
      else {
        // stop if player car is close ahead (+ brake & honk, Phase 4)
        const dx = px - car.x, dz = pz - car.z;
        const ahead = car.axis === "x" ? Math.sign(dx) === car.dir && Math.abs(dz) < 6 && Math.abs(dx) < 9
                                      : Math.sign(dz) === car.dir && Math.abs(dx) < 6 && Math.abs(dz) < 9;
        const target = ahead && G.driving ? 0 : car.fleeing > 0 ? 13 : 8.5;
        car.speed += THREE.MathUtils.clamp(target - car.speed, -14 * dt, 6 * dt);
        if (ahead && G.driving && car.speed > 2 && honkCd.current <= 0 && Math.random() < 0.3) { sfx.horn(); honkCd.current = 2.5; }
      }
      if (car.fleeing > 0) car.fleeing -= dt;
      if (car.axis === "x") car.x += car.dir * car.speed * dt; else car.z += car.dir * car.speed * dt;
      // turn at intersections (road lists are per-city)
      const crossRoads = car.side === "coral" ? (car.axis === "x" ? CORAL_ROAD_X : CORAL_ROAD_Z) : ROAD_COORDS;
      const alongNow = car.axis === "x" ? car.x : car.z;
      const nearRoad = crossRoads.find((c) => Math.abs(alongNow - c) < 1.2);
      if (nearRoad !== undefined && Math.random() < 0.012) {
        const along = car.axis === "x" ? car.x : car.z;
        car.axis = car.axis === "x" ? "z" : "x";
        car.dir = (Math.random() > 0.5 ? 1 : -1) as 1 | -1;
        const fixed = nearRoad - car.lane + (car.dir > 0 ? 2.8 : -2.8);
        car.lane = car.dir > 0 ? 2.8 : -2.8;
        if (car.axis === "x") { car.z = fixed; car.x = along; } else { car.x = fixed; car.z = along; }
        car.heading = headingFor(car.axis, car.dir);
        car.steerVis = 0.75 * car.dir;
      }
      if (car.side === "coral") {
        if (car.x < 31 || car.x > 109 || car.z < 199 || car.z > 321) {
          car.dir = (car.dir * -1) as 1 | -1; car.lane = car.dir > 0 ? 2.8 : -2.8; car.heading = headingFor(car.axis, car.dir);
          car.x = THREE.MathUtils.clamp(car.x, 33, 107); car.z = THREE.MathUtils.clamp(car.z, 201, 319);
        }
      } else if (Math.abs(car.x) > 112 || Math.abs(car.z) > 112) { car.dir = (car.dir * -1) as 1 | -1; car.lane = car.dir > 0 ? 2.8 : -2.8; car.heading = headingFor(car.axis, car.dir); car.x = THREE.MathUtils.clamp(car.x, -110, 110); car.z = THREE.MathUtils.clamp(car.z, -110, 110); }
      car.heading = headingFor(car.axis, car.dir);
      // presentation: pitch from acceleration, wheel steer decays after turns
      car.pitch += (THREE.MathUtils.clamp(-(car.speed - prevSpeed) / Math.max(dt, 0.001) * 0.0028, -0.05, 0.055) - car.pitch) * Math.min(1, dt * 6);
      car.steerVis += (0 - car.steerVis) * Math.min(1, dt * 5);
      void prevHeading;
      const ti = G.traffic.indexOf(car);
      if (trafficSteerRefs[ti]) trafficSteerRefs[ti].current = car.steerVis;
      if (trafficBrakeRefs.current[ti]) trafficBrakeRefs.current[ti].current = car.stopped > 0 || car.speed < 1.5;
    }
    // ---- pedestrians: density breathes with the time of day (Blueprint §2) —
    // downtown/Market Row crowds thin out late at night; the beach peaks at dusk.
    const elevNow = Math.sin(G.dayTime * Math.PI * 2 - Math.PI / 2);
    G.peds.forEach((ped, i) => {
      let frac = elevNow > 0.05 ? 1 : 0.45; // deep night: under half the walkers
      if (ped.zone === "The Docks") frac = elevNow > -0.35 && elevNow < 0.55 ? 1 : 0.55; // dusk beach crowd
      ped.active = ((i * 7) % G.peds.length) / G.peds.length < frac;
    });
    const phys = physicsRef.current ?? fallbackPhysics;
    for (const ped of G.peds) {
      if (!ped.active) { ped.speed = 0; continue; }
      // knocked down (punch/gunfire): lies still, then gets up and flees
      if (t < ped.downUntil) { ped.speed = 0; continue; }
      const threatD2 = (ped.x - px) ** 2 + (ped.z - pz) ** 2;
      const flee = (G.driving && pSpeed > 5 && threatD2 < 15 ** 2) || (G.wanted > 0 && threatD2 < 10 ** 2) || t < ped.fleeUntil;
      const ahead = 14;
      const tx = ped.axis === "x" ? ped.x + ped.dir * ahead : ped.x;
      const tz = ped.axis === "z" ? ped.z + ped.dir * ahead : ped.z;
      const next = phys.stepPedestrian(ped, tx, tz, px, pz, flee, 1.6, dt);
      if (!isBlocked(next.x, next.z, 0.4)) { ped.x = next.x; ped.z = next.z; }
      // separation steering (C++ physics): peds keep personal space
      const near: { x: number; z: number }[] = [];
      for (const other of G.peds) {
        if (other === ped || !other.active) continue;
        const d2 = (other.x - ped.x) ** 2 + (other.z - ped.z) ** 2;
        if (d2 < 1.2 ** 2) near.push(other);
        if (near.length >= 3) break;
      }
      if (near.length) {
        const f = phys.separationForce(ped.x, ped.z, near, 0.95);
        const sx = ped.x + f.x * dt * 0.85, sz = ped.z + f.z * dt * 0.85;
        if (!isBlocked(sx, sz, 0.4)) { ped.x = sx; ped.z = sz; }
      }
      ped.heading = next.heading; ped.speed = next.speed; ped.swing += dt * (2 + ped.speed * 2.4);
      if (ped.area === "coral") {
        if (ped.x < 31 || ped.x > 109 || ped.z < 200 || ped.z > 320) ped.dir = (ped.dir * -1) as 1 | -1;
      } else if (Math.abs(ped.x) > 114 || Math.abs(ped.z) > 118) { ped.dir = (ped.dir * -1) as 1 | -1; }
      // hit by player car
      if (G.driving && hitCooldown.current <= 0 && threatD2 < 2.2 ** 2 && pSpeed > 4) {
        hitCooldown.current = 1.5; ped.fleeUntil = t + 4; addCrime("ped"); cb.current.event("shake"); sfx.thud();
        const mine = G.cars[G.activeCarId]; if (mine) mine.damage = Math.min(100, mine.damage + 3);
        ped.x += Math.sin(ped.heading) * 2; // knocked aside (arcade, non-graphic)
      }
    }
    // ---- police / wanted (Blueprint §4): line-of-sight + last-known search.
    // Cops only KNOW where you are while one of them (or the heli at 4+ stars)
    // can actually see you. Break sight and they converge on your LAST SEEN
    // position, then sweep the area while the wanted cooldown ticks down.
    const want = G.wanted;
    const losClear = (x1: number, z1: number, x2: number, z2: number) => {
      for (const f of [0.3, 0.55, 0.8]) {
        if (isBlocked(x1 + (x2 - x1) * f, z1 + (z2 - z1) * f, 0.3)) return false;
      }
      return true;
    };
    let seen = false;
    if (want > 0) {
      const sightR = 58 * (1 - G.fogAmt * 0.45) * (1 - G.rainAmt * 0.15) * (G.crouched && !G.driving ? 0.85 : 1);
      for (const cop of G.cops) {
        if (!cop.active) continue;
        const d = Math.hypot(cop.x - px, cop.z - pz);
        if (d < sightR && losClear(cop.x, cop.z, px, pz)) { seen = true; break; }
      }
      if (!seen && want >= 4) seen = true; // police heli keeps eyes on you at 4+ stars
      playerSeen.current = seen;
      if (seen) { lastKnown.current = { x: px, z: pz }; G.wantedCooldown = 0; }
    } else { playerSeen.current = false; lastKnown.current = null; }
    G.cops.forEach((cop, i) => {
      const should = i < Math.min(6, want + (want > 0 ? 1 : 0));
      if (should && !cop.active) {
        cop.active = true;
        const ang = (i * 2.4) + t;
        if (pz > 150) { // Coral Shores pursuit — spawn on the far shore grid
          cop.x = THREE.MathUtils.clamp(px + Math.sin(ang) * 40, 34, 106);
          cop.z = THREE.MathUtils.clamp(pz + Math.cos(ang) * 40, 204, 316);
        } else {
          cop.x = THREE.MathUtils.clamp(px + Math.sin(ang) * 46, -108, 108);
          cop.z = THREE.MathUtils.clamp(pz + Math.cos(ang) * 46, -108, 112);
        }
        cop.speed = 0;
      }
      if (!cop.active) return;
      if (want === 0) { cop.active = false; return; }
      // target: player if seen, else last-known; sweep around last-known on arrival
      let tx = px, tz = pz, cruise = 25;
      if (!seen && lastKnown.current) {
        const lk = lastKnown.current;
        const dLk = Math.hypot(lk.x - cop.x, lk.z - cop.z);
        if (dLk < 7) { searchAng.current += dt * 0.45; tx = lk.x + Math.sin(searchAng.current + i * 1.7) * 13; tz = lk.z + Math.cos(searchAng.current + i * 1.7) * 13; cruise = 8; }
        else { tx = lk.x; tz = lk.z; cruise = 19; }
      }
      const dx = tx - cop.x, dz = tz - cop.z;
      const dist = Math.hypot(dx, dz);
      const desired = Math.atan2(dx, dz);
      let turn = desired - cop.heading;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      const prevCopSpeed = cop.speed;
      cop.heading += THREE.MathUtils.clamp(turn, -2.4 * dt, 2.4 * dt);
      const targetSpeed = dist > 14 ? cruise : dist > 5 ? Math.min(cruise, 13) : 4;
      cop.speed += THREE.MathUtils.clamp(targetSpeed - cop.speed, -18 * dt, 10 * dt);
      const nx = cop.x + Math.sin(cop.heading) * cop.speed * dt;
      const nz = cop.z + Math.cos(cop.heading) * cop.speed * dt;
      if (!isBlocked(nx, nz, 1.3)) { cop.x = nx; cop.z = nz; } else { cop.speed = 0; cop.heading += 1.8 * dt; }
      cop.lightPhase += dt * 7;
      // presentation: pitch/roll + steering-wheel visual from motion
      cop.pitch += (THREE.MathUtils.clamp(-(cop.speed - prevCopSpeed) / Math.max(dt, 0.001) * 0.0028, -0.05, 0.055) - cop.pitch) * Math.min(1, dt * 6);
      cop.roll += (THREE.MathUtils.clamp(turn * cop.speed * 0.02, -0.09, 0.09) - cop.roll) * Math.min(1, dt * 6);
      if (copSteerRefs[i]) copSteerRefs[i].current = THREE.MathUtils.clamp(turn * 2.2, -1, 1);
    });
    // ---- Phase 4: physical vehicle-vs-vehicle collisions (C++ physics) —
    // the player car now bounces off traffic, police and parked cars with
    // speed exchange and damage on both sides.
    if (G.driving && G.activeCarId >= 0) {
      const mine = G.cars[G.activeCarId];
      const physEng = physicsRef.current ?? fallbackPhysics;
      const myR = mine.kind === "motorcycle" ? 1.0 : 1.55;
      const toBody = (x: number, z: number, heading: number, speed: number, r: number) => ({ x, z, vx: Math.sin(heading) * speed, vz: Math.cos(heading) * speed, radius: r });
      const applyHit = (res: { a: { x: number; z: number; vx: number; vz: number }; damage: number }, otherDamage: (d: number) => void, crimeKind: boolean) => {
        if (res.damage <= 0.4) { // positional overlap only — still separate
          mine.state.x = res.a.x; mine.state.z = res.a.z;
          return;
        }
        mine.state.x = res.a.x; mine.state.z = res.a.z;
        mine.state.speed = res.a.vx * Math.sin(mine.state.heading) + res.a.vz * Math.cos(mine.state.heading);
        mine.damage = Math.min(100, mine.damage + res.damage);
        otherDamage(res.damage * 0.8);
        if (crashCd.current <= 0) {
          crashCd.current = 0.4;
          sfx.crash();
          G.shakeAmp = Math.min(0.55, res.damage * 0.035);
          cb.current.event("shake");
          if (crimeKind && res.damage > 5) addCrime("hit");
        }
      };
      const me = () => toBody(mine.state.x, mine.state.z, mine.state.heading, mine.state.speed, myR);
      for (const tc of G.traffic) {
        if ((tc.x - mine.state.x) ** 2 + (tc.z - mine.state.z) ** 2 > 4.2 ** 2) continue;
        const res = physEng.resolveVehicleCollision(me(), toBody(tc.x, tc.z, tc.heading, tc.speed, 1.55));
        if (res.damage > 0 || (res.b.x !== tc.x || res.b.z !== tc.z)) {
          tc.x = res.b.x; tc.z = res.b.z;
          tc.speed = Math.max(0, Math.min(13, res.b.vx * Math.sin(tc.heading) + res.b.vz * Math.cos(tc.heading)));
          if (res.damage > 4) { tc.stopped = Math.max(tc.stopped, 1.6); tc.fleeing = 3; }
          applyHit(res, (d) => { tc.damage = Math.min(100, tc.damage + d); }, true);
        }
      }
      for (const cop of G.cops) {
        if (!cop.active) continue;
        if ((cop.x - mine.state.x) ** 2 + (cop.z - mine.state.z) ** 2 > 4.2 ** 2) continue;
        const res = physEng.resolveVehicleCollision(me(), toBody(cop.x, cop.z, cop.heading, cop.speed, 1.55));
        cop.x = res.b.x; cop.z = res.b.z;
        cop.speed = Math.max(0, Math.min(25, res.b.vx * Math.sin(cop.heading) + res.b.vz * Math.cos(cop.heading)));
        applyHit(res, () => undefined, false);
      }
      G.cars.forEach((other, oi) => {
        if (oi === G.activeCarId || other.state.speed !== 0) return;
        if ((other.state.x - mine.state.x) ** 2 + (other.state.z - mine.state.z) ** 2 > 4.2 ** 2) return;
        const keepX = other.state.x, keepZ = other.state.z;
        const res = physEng.resolveVehicleCollision(me(), toBody(other.state.x, other.state.z, other.state.heading, 0, other.kind === "motorcycle" ? 1.0 : 1.55));
        other.state.x = keepX; other.state.z = keepZ; // parked cars don't roll away
        if (res.damage > 0) {
          mine.state.x = res.a.x + (res.b.x - keepX); mine.state.z = res.a.z + (res.b.z - keepZ);
          mine.state.speed = res.a.vx * Math.sin(mine.state.heading) + res.a.vz * Math.cos(mine.state.heading);
          mine.damage = Math.min(100, mine.damage + res.damage);
          other.damage = Math.min(100, other.damage + res.damage * 0.8);
          if (crashCd.current <= 0) { crashCd.current = 0.4; sfx.crash(); G.shakeAmp = Math.min(0.55, res.damage * 0.035); cb.current.event("shake"); if (res.damage > 5) addCrime("hit"); }
        } else if (res.a.x !== mine.state.x || res.a.z !== mine.state.z) { mine.state.x = res.a.x; mine.state.z = res.a.z; }
      });
    }
    // ---- roadblocks at 4+ stars: two patrol cars parked across the road ahead
    const rb = roadblock.current;
    rb.cooldown = Math.max(0, rb.cooldown - dt);
    if (want >= 4 && !rb.active && rb.cooldown <= 0 && G.driving) {
      const h = G.cars[G.activeCarId]?.state.heading ?? G.playerHeading;
      const fx = Math.sin(h), fz = Math.cos(h);
      const ax = px + fx * 54, az = pz + fz * 54;
      const snap = (v: number) => ROAD_COORDS.reduce((a, c) => (Math.abs(c - v) < Math.abs(a - v) ? c : a), ROAD_COORDS[0]);
      // travel axis = dominant heading axis; block cars sit across it (perp offsets)
      if (Math.abs(fx) > Math.abs(fz)) { rb.x = THREE.MathUtils.clamp(ax, -112, 112); rb.z = snap(az); rb.hx = Math.sign(fx) || 1; rb.hz = 0; rb.ox = 0; rb.oz = 1; }
      else { rb.x = snap(ax); rb.z = THREE.MathUtils.clamp(az, -112, 118); rb.hx = 0; rb.hz = Math.sign(fz) || 1; rb.ox = 1; rb.oz = 0; }
      rb.active = true;
      cb.current.popup("⚠ Roadblock ahead!");
      bark("Dispatch", "All units — roadblock deployed ahead of the suspect vehicle.");
    }
    if (rb.active) {
      const passed = (px - rb.x) * rb.hx + (pz - rb.z) * rb.hz > 20;
      const far = Math.hypot(px - rb.x, pz - rb.z) > 100;
      if (want < 4 || passed || far) { rb.active = false; rb.cooldown = 22; }
      // ramming a roadblock car hurts (and stops you cold)
      if (G.driving && rbHitCd.current <= 0) {
        for (const s of [-2.7, 2.7]) {
          const bx = rb.x + rb.ox * s, bz = rb.z + rb.oz * s;
          if ((bx - px) ** 2 + (bz - pz) ** 2 < 3.2 ** 2 && pSpeed > 3) {
            rbHitCd.current = 1.2;
            const mine = G.cars[G.activeCarId];
            if (mine) { mine.damage = Math.min(100, mine.damage + 12); mine.state.speed *= -0.2; }
            cb.current.event("shake"); sfx.crash(); break;
          }
        }
      }
    }
    rbRefs.current.forEach((g, i) => {
      if (!g) return;
      g.visible = rb.active;
      if (rb.active) {
        const s = i === 0 ? -2.7 : 2.7;
        g.position.set(rb.x + rb.ox * s, 0, rb.z + rb.oz * s);
        g.rotation.y = Math.atan2(rb.ox, rb.oz) + (i === 0 ? 0.3 : -0.3);
      }
    });
    if (want > 0) {
      const nearestCop = Math.min(...G.cops.filter((c) => c.active).map((c) => Math.hypot(c.x - px, c.z - pz)), 999);
      if (!seen) { G.wantedCooldown += dt; if (G.wantedCooldown > 11) { G.wanted -= 1; G.wantedCooldown = 0; lastKnown.current = null; cb.current.popup("Heat lost — wanted level down"); bark("Dispatch", "Visual lost. Suspect heat level dropping — keep searching."); } }
      // busted: cop close + player slow (unchanged rule, cleaner condition)
      if (nearestCop < 7.5 && pSpeed < 2.5) {
        G.bustTimer += dt;
        if (G.bustTimer > 3) { G.status = "busted"; G.statusTimer = 0; sfx.busted(); bark("Harbour Patrol", "Suspect in custody. Repeat — suspect in custody."); }
      } else G.bustTimer = Math.max(0, G.bustTimer - dt * 1.5);
    } else G.bustTimer = 0;
    if (G.health <= 0 && !G.status) { G.status = "wasted"; G.statusTimer = 0; sfx.fail(); }
    if (G.status) {
      G.statusTimer += dt;
      if (G.statusTimer > 0.4 && G.statusTimer < 0.5) { /* overlay handled by HUD */ }
    }
    // ---- missions ----
    if (M.active && M.phase === "play") {
      const def = M.active;
      M.timer -= dt;
      if (def.noWanted && G.wanted > 0) failMission("You drew heat — Voss needed a clean run.");
      else if (M.timer <= 0) failMission("Out of time.");
      else if (def.kind === "tokens") {
        if (tokenCountRef.current >= 6) completeMission();
      } else {
        const tgt = currentTarget();
        if (tgt) {
          G.objective = { x: tgt[0], z: tgt[1], label: def.objectiveText, kind: def.kind };
          const d2 = (tgt[0] - px) ** 2 + (tgt[1] - pz) ** 2;
          const radius = def.kind === "collect" ? 3.4 : 7;
          if (d2 < radius ** 2) {
            if (def.kind === "escape" && G.wanted > 0) { /* must lose heat first — HUD text explains */ }
            else if (M.step < def.targets.length - 1) { M.collected = new Set(M.collected).add(M.step); M.step += 1; sfx.pickup(); cb.current.popup(def.kind === "collect" ? "Ledger page recovered!" : "Checkpoint!"); }
            else completeMission();
          }
        }
      }
    }
    // ---- property: park on the villa drive (owned) to garage-save the car —
    // it reappears there next session (localStorage, via the store loader)
    {
      const gs = garageSave.current;
      const car = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId] : null;
      const onDrive = !!car && G.ownsMansion && Math.abs(car.state.speed) < 0.5 &&
        Math.abs(car.state.x - MANSION_DRIVE.x) < MANSION_DRIVE.hw && Math.abs(car.state.z - MANSION_DRIVE.z) < MANSION_DRIVE.hd;
      if (onDrive && car) {
        gs.timer += dt;
        const key = `${G.activeCarId}|${car.state.x.toFixed(1)}|${car.state.z.toFixed(1)}`;
        if (gs.timer > 2 && gs.lastKey !== key) {
          gs.lastKey = key;
          persistSavedCar({ kind: car.kind, color: car.color, x: car.state.x, z: car.state.z, heading: car.state.heading });
          // Phase 4: parking at the villa also files the car in the stored
          // garage list (selectable from either garage, max 6)
          if (G.storedCars.length < 6 && !G.storedCars.some((s) => s.kind === car.kind && s.color === car.color)) {
            G.storedCars.push({ kind: car.kind, color: car.color, name: CAR_MODELS[car.kind].name, damage: Math.round(car.damage), fuel: Math.round(car.fuel), brokenWindow: car.brokenWindow });
            persistStoredCars();
          }
          cb.current.popup("Car saved in your villa garage — it'll be here next visit.");
          sfx.cash();
        }
      } else gs.timer = 0;
    }
    // objective beam follows current target
    if (beam.current) {
      const o = G.objective;
      beam.current.visible = !!o && M.phase === "play";
      if (o) { beam.current.position.set(o.x, 0, o.z); beam.current.rotation.y = t * 0.8; }
    }
    syncMeshes(t);
    function failMission(reason: string) {
      if (!M.active) return;
      G.missionResult = { ok: false, title: M.active.title, reward: 0, items: 0, timeLeft: 0, reason, at: t };
      sfx.fail(); cb.current.banner(`Mission failed — ${reason}`, false); endMission(); cb.current.event("missionEnd");
    }
    function completeMission() {
      const def = M.active; if (!def) return;
      // Phase 5: Ch.6 pays the alternate split when Elias was warned;
      // side arcs advance their own progress and NEVER touch storyIndex.
      const pay = effectivePayout(def);
      const outro = def.outroAlt && M.choice === "elias" ? def.outroAlt : def.outro;
      G.missionResult = { ok: true, title: def.title, reward: pay, items: 0, timeLeft: Math.max(0, Math.round(M.timer)), reason: "", at: t };
      G.cash += pay; G.lifetimeEarned += pay;
      pushPhoneMsg("SableBank", `💰 $${pay} received — ${def.title}. Balance: $${G.cash}.`);
      persist();
      sfx.complete(); cb.current.popup(`+$${pay}`);
      cb.current.banner(`Mission complete: ${def.title} +$${pay}`, true);
      const wasStory = def.story;
      const side = def.side;
      endMission();
      cb.current.dialogue(outro, () => {
        if (wasStory) {
          M.storyIndex += 1;
          if (M.storyIndex >= 6) { M.storyDone = true; persist(); cb.current.storyFinished(); }
          persist(); cb.current.event("missionEnd");
        } else if (side) {
          M.side[side] = Math.min(3, M.side[side] + 1);
          persist();
          if (M.side[side] >= 3) pushPhoneMsg(side === "lina" ? "Lina Park" : "Det. Mara Voss", side === "lina" ? "That's the whole line done, Rayan. The garage owes you — come by any time." : "File closed and filed. The parole board has everything. Thank you, Kade.");
          cb.current.event("missionEnd");
        } else { M.repeatIndex += 1; persist(); cb.current.event("missionEnd"); }
      });
      cb.current.event("missionEnd");
    }
    function syncMeshes(tt: number) {
      frameNo.current += 1;
      G.traffic.forEach((c, i) => { const g = trafficRefs.current[i]; if (g) { g.position.set(c.x, groundYAt(c.x, c.z), c.z); g.rotation.order = "YXZ"; g.rotation.set(c.pitch, c.heading, 0); } });
      const reportT = performance.now() / 1000;
      G.peds.forEach((pd, i) => {
        const g = pedRefs.current[i]; if (!g) return;
        g.visible = pd.active;
        const down = tt < pd.downUntil;
        g.position.set(pd.x, down ? 0.32 : 0, pd.z);
        g.rotation.set(down ? -Math.PI / 2 * 0.92 : 0, pd.heading, 0);
        const rig = pedRigs[i];
        // Visual V7: far peds (>120u) animate every 3rd frame
        const far = (pd.x - G.followPos.x) ** 2 + (pd.z - G.followPos.z) ** 2 > 120 ** 2;
        if (rig && !down && (!far || (frameNo.current + i) % 3 === 0)) animateHumanoid(rig, pd.swing * 1.7, Math.min(1, Math.abs(pd.speed) / 1.7), tt);
        const marker = reportRefs.current[i];
        if (marker) marker.visible = pd.active && !down && G.reportingPed === i && reportT < G.witnessUntil;
      });
      // NPC-life vignettes: seated figures (sit pose re-applied after idle anim)
      for (const v of vignettes.seated) {
        animateHumanoid(v.rig, 0, 0, tt);
        v.rig.lThigh.rotation.x = v.rig.rThigh.rotation.x = -1.45;
        v.rig.lShin.rotation.x = v.rig.rShin.rotation.x = 1.35;
        v.rig.group.position.y = -0.42;
      }
      for (const v of vignettes.talking) {
        animateHumanoid(v.rig, 0, 0, tt + v.pos[0]);
        if (v.talker) v.rig.rArm.rotation.x = -0.65 + Math.sin(tt * 1.4 + v.pos[0]) * 0.28; // gesturing
      }
      // birds over the harbour: one flock group circling, wings as bobbing cones
      if (birdRef.current) {
        birdRef.current.rotation.y = tt * 0.045;
        birdRef.current.children.forEach((b, i) => { b.position.y = 24 + Math.sin(tt * 1.6 + i * 1.3) * 1.6; b.rotation.z = Math.sin(tt * 6 + i) * 0.35; });
      }
      // police helicopter at high heat: slow orbit above the player
      if (heliRef.current) {
        const show = G.wanted >= 4;
        heliRef.current.visible = show;
        if (show) {
          const hx = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId].state.x : G.playerPos.x;
          const hz = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId].state.z : G.playerPos.z;
          heliRef.current.position.set(hx + Math.sin(tt * 0.35) * 11, 17 + Math.sin(tt * 0.8) * 1.3, hz + Math.cos(tt * 0.35) * 11);
          heliRef.current.rotation.y = tt * 0.35 + Math.PI / 2;
          if (heliRotor.current) heliRotor.current.rotation.y = tt * 30;
        }
      }
      let nearestCop: { d: number; i: number } | null = null;
      G.cops.forEach((c, i) => {
        const g = copRefs.current[i]; if (!g) return;
        g.visible = c.active; g.position.set(c.x, groundYAt(c.x, c.z), c.z); g.rotation.order = "YXZ"; g.rotation.set(c.pitch, c.heading, c.roll);
        const lights = copLights.current[i];
        const on = Math.sin(c.lightPhase) > 0;
        if (lights) {
          if (lights[0]) (lights[0].material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 3 : 0.15;
          if (lights[1]) (lights[1].material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 0.15 : 3;
        }
        const glows = copGlowSprites.current[i];
        if (glows) {
          if (glows[0]) (glows[0].material as THREE.SpriteMaterial).opacity = on ? 0.55 : 0.05;
          if (glows[1]) (glows[1].material as THREE.SpriteMaterial).opacity = on ? 0.05 : 0.55;
        }
        if (c.active) {
          const d = (c.x - G.followPos.x) ** 2 + (c.z - G.followPos.z) ** 2;
          if (!nearestCop || d < nearestCop.d) nearestCop = { d, i };
        }
      });
      // real coloured light cast — ONLY from the nearest police car (perf)
      if (policeGlow.current) {
        const nc = nearestCop as { d: number; i: number } | null;
        policeGlow.current.visible = !!nc;
        if (nc) {
          const cop = G.cops[nc.i];
          policeGlow.current.position.set(cop.x, 1.6, cop.z);
          const on = Math.sin(cop.lightPhase) > 0;
          const [lr, lb] = policeGlow.current.children as unknown as THREE.PointLight[];
          if (lr && lb) {
            lr.position.set(-Math.cos(cop.heading) * 0.5, 0, Math.sin(cop.heading) * 0.5);
            lb.position.set(Math.cos(cop.heading) * 0.5, 0, -Math.sin(cop.heading) * 0.5);
            lr.intensity = on ? 14 : 1.5;
            lb.intensity = on ? 1.5 : 14;
          }
        }
      }
      void tt;
    }
  });

  return (
    <group>
      <ambientLight ref={amb} intensity={theme.ambient} />
      <hemisphereLight ref={hemi} args={[theme.hemiSky, theme.hemiGround, 1.05]} />
      <directionalLight key={quality} ref={sun} castShadow position={[40, 50, 30]} intensity={theme.sunIntensity}
        shadow-mapSize-width={gates.shadowMapSize(quality)} shadow-mapSize-height={gates.shadowMapSize(quality)}
        shadow-radius={gates.shadowRadius(quality)}
        shadow-camera-left={-55} shadow-camera-right={55} shadow-camera-top={55} shadow-camera-bottom={-55} shadow-bias={-0.0002} shadow-normalBias={0.02} />
      {/* traffic — detailed bodies, classes cycle like the mood board */}
      {G.traffic.map((c, i) => (
        <group key={i} ref={(n) => { trafficRefs.current[i] = n; }} position={[c.x, 0, c.z]}>
          <CarBody kind={TRAFFIC_KINDS[i % TRAFFIC_KINDS.length]} color={c.color} steerRef={trafficSteerRefs[i]} liveDamage={() => G.traffic[i].damage} brakeRef={trafficBrakeRefs.current[i]} beams />
        </group>
      ))}
      {/* pedestrians — articulated humanoids with outfit variety */}
      {G.peds.map((pd, i) => (
        <group key={i} ref={(n) => { pedRefs.current[i] = n; }} position={[pd.x, 0, pd.z]}>
          {pedRigs[i] && <primitive object={pedRigs[i].group} />}
          {/* witness "!" marker while this ped is calling in a crime */}
          <group ref={(n) => { reportRefs.current[i] = n; }} position={[0, 2.2, 0]} visible={false}>
            <mesh><boxGeometry args={[0.09, 0.34, 0.09]} /><meshBasicMaterial color="#ffb703" /></mesh>
            <mesh position={[0, -0.28, 0]}><boxGeometry args={[0.09, 0.09, 0.09]} /><meshBasicMaterial color="#ffb703" /></mesh>
          </group>
        </group>
      ))}
      {/* roadblock patrol cars (spawned at 4+ stars, positioned in useFrame) */}
      {[0, 1].map((i) => (
        <group key={`rb${i}`} ref={(n) => { rbRefs.current[i] = n; }} visible={false}>
          <CarBody kind="sedan" color="#12161c" police />
          <mesh position={[0, 1.44, -0.1]}><boxGeometry args={[1.05, 0.16, 0.4]} /><meshStandardMaterial color="#ff3333" emissive="#ff2222" emissiveIntensity={1.6} /></mesh>
        </group>
      ))}
      {/* NPC-life vignettes: benches + seated figures, talking pairs */}
      {vignettes.seated.map((v, i) => (
        <group key={`seat${i}`}>
          <group position={[v.pos[0], 0, v.pos[1]]} rotation={[0, v.pos[2] + Math.PI, 0]}>
            <mesh position={[0, 0.46, 0.28]} receiveShadow><boxGeometry args={[1.9, 0.09, 0.5]} /><meshStandardMaterial color="#6d4c33" roughness={0.9} /></mesh>
            <mesh position={[0, 0.85, 0.52]}><boxGeometry args={[1.9, 0.5, 0.07]} /><meshStandardMaterial color="#6d4c33" roughness={0.9} /></mesh>
            {[-0.8, 0.8].map((x) => <mesh key={x} position={[x, 0.23, 0.28]}><boxGeometry args={[0.09, 0.46, 0.42]} /><meshStandardMaterial color="#2c2f33" /></mesh>)}
          </group>
          <group position={[v.pos[0], 0.02, v.pos[1]]} rotation={[0, v.pos[2], 0]}>
            <primitive object={v.rig.group} />
          </group>
        </group>
      ))}
      {vignettes.talking.map((v, i) => (
        <group key={`talk${i}`} position={[v.pos[0], 0, v.pos[1]]} rotation={[0, v.face, 0]}>
          <primitive object={v.rig.group} />
        </group>
      ))}
      {/* birds: a small flock circling the harbour */}
      <group ref={birdRef} position={[0, 0, 138]}>
        {Array.from({ length: 9 }, (_, i) => {
          const a = (i / 9) * Math.PI * 2; const r = 26 + (i % 3) * 7;
          return (
            <mesh key={i} position={[Math.cos(a) * r, 24 + (i % 4), Math.sin(a) * r]} rotation={[Math.PI / 2, -a, 0]}>
              <coneGeometry args={[0.32, 1.15, 4]} />
              <meshStandardMaterial color="#22303a" flatShading />
            </mesh>
          );
        })}
      </group>
      {/* police — sedan body with livery + flashing light bar */}
      {G.cops.map((_c, i) => (
        <group key={i} ref={(n) => { copRefs.current[i] = n; }} visible={false}>
          <CarBody kind="sedan" color="#12161c" police steerRef={copSteerRefs[i]} />
          <mesh position={[-0.45, 1.44, -0.1]} ref={(n) => { (copLights.current[i] ??= [null, null])[0] = n; }}>
            <boxGeometry args={[0.55, 0.16, 0.4]} /><meshStandardMaterial color="#ff2222" emissive="#ff2222" emissiveIntensity={2} />
          </mesh>
          <mesh position={[0.45, 1.44, -0.1]} ref={(n) => { (copLights.current[i] ??= [null, null])[1] = n; }}>
            <boxGeometry args={[0.55, 0.16, 0.4]} /><meshStandardMaterial color="#2266ff" emissive="#2266ff" emissiveIntensity={2} />
          </mesh>
          {/* coloured glow sprites on the light bar */}
          <sprite position={[-0.45, 1.5, -0.1]} scale={[2.6, 2.6, 1]} ref={(n) => { (copGlowSprites.current[i] ??= [null, null])[0] = n; }}>
            <spriteMaterial map={glowTex} color="#ff4444" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
          <sprite position={[0.45, 1.5, -0.1]} scale={[2.6, 2.6, 1]} ref={(n) => { (copGlowSprites.current[i] ??= [null, null])[1] = n; }}>
            <spriteMaterial map={glowTex} color="#4488ff" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      ))}
      {/* real red/blue point lights riding the NEAREST police car */}
      <group ref={policeGlow} visible={false}>
        <pointLight color="#ff3333" intensity={10} distance={13} decay={1.8} />
        <pointLight color="#3366ff" intensity={1.5} distance={13} decay={1.8} />
      </group>
      {/* police helicopter: appears at wanted >= 4, hovers near the player
          with a searchlight cone (visual only) */}
      <group ref={heliRef} visible={false}>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[0.9, 2.2, 4, 8]} /><meshStandardMaterial color="#14181d" roughness={0.4} metalness={0.4} /></mesh>
        <mesh position={[0, 0.1, -2.6]}><boxGeometry args={[0.28, 0.28, 2.6]} /><meshStandardMaterial color="#14181d" roughness={0.4} /></mesh>
        <mesh ref={heliRotor} position={[0, 1.05, 0]}><boxGeometry args={[7.6, 0.05, 0.32]} /><meshStandardMaterial color="#0c0e10" /></mesh>
        <mesh position={[0, 0.35, -3.8]} rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[1.3, 0.05, 0.2]} /><meshStandardMaterial color="#0c0e10" /></mesh>
        <mesh position={[0, -3.4, 0]}>
          <coneGeometry args={[3.4, 6.4, 16, 1, true]} />
          <meshBasicMaterial color="#ffeeb0" transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
      {/* objective marker: glowing pillar + ring */}
      <group ref={beam} visible={false}>
        <mesh position={[0, 14, 0]}><cylinderGeometry args={[1.1, 1.1, 28, 12, 1, true]} /><meshBasicMaterial color="#ffb703" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} /></mesh>
        <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.4, 3, 24]} /><meshBasicMaterial color="#ffb703" transparent opacity={0.9} /></mesh>
        <mesh position={[0, 3.4, 0]}><icosahedronGeometry args={[0.55, 0]} /><meshStandardMaterial color="#ffb703" emissive="#ff9500" emissiveIntensity={2} /></mesh>
      </group>
      {/* ledger-page / collect markers for collect missions */}
      {M.active?.kind === "collect" && M.active.targets.map(([x, z], i) => (
        <mesh key={`${M.active?.id}-${i}`} position={[x, 1.4, z]} visible={!M.collected.has(i)}>
          <icosahedronGeometry args={[0.5, 0]} /><meshStandardMaterial color="#7bf1d3" emissive="#14b8a6" emissiveIntensity={1.6} />
        </mesh>
      ))}
    </group>
  );
}
export { resetAfterArrest, resetAfterWasted };
