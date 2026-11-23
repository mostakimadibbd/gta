import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { G, addCrime, processPendingCrimes, resetAfterArrest, resetAfterWasted, persistSavedCar, persistStoredCars, persistSkills, persistZoneRep, bark, toast } from "../game/store";
import { M, currentTarget, endMission, persist, effectivePayout, recordBest, altActive } from "../game/missionState";
import { gates, type QualityTier } from "../game/quality";
import { perf } from "../game/perf";
import { pushPhoneMsg } from "../game/phone";
import { pushNews } from "../game/feed";
import { ROAD_COORDS, CORAL_ROAD_X, CORAL_ROAD_Z, NORTH_ROAD_X, NORTH_ROAD_Z, BUS_STOPS, REGISTERS, PAWN_SHOP, DEALERSHIP, VENDOR, districtAt, isBlocked, inNorth, onIsland, MANSION_DRIVE, groundYAt, CAR_MODELS, buildings, props as WORLD_PROPS } from "../world";
import { lightAllows } from "../game/lights";
import { ECO } from "../game/economy";
import { nudgeStock } from "../game/invest";
import { glowTexture } from "../textures";
import { fallbackPhysics, type PhysicsEngine } from "../physics/GamePhysics";
import type { GameTheme } from "../themes";
import { sfx } from "../game/audio";
import CarBody, { type CarKind } from "./CarBody";
import { buildHumanoid, animateHumanoid, type HumanoidRig } from "../humanoid";

const TRAFFIC_KINDS: CarKind[] = ["sedan", "suv", "muscle", "sedan", "supercar", "classic", "pickup", "hatch", "coupe", "suv", "muscle", "sedan", "gt", "sedan", "hatch", "wedge"]; // Phase 8: Marlowe GT in rotation; ONE Vantara wedge (rare)
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
  // Phase 6 (B4): jacket torsos + crop/bald hair join the rotation
  { gender: "m" as const, topStyle: "jacket" as const, bottom: "#23272e", bottomStyle: "jeans" as const, skin: "#8d5524", hair: "#14100e", hairStyle: "crop" as const, sunglasses: false, cap: undefined, tattoo: false, necklace: false },
  { gender: "m" as const, topStyle: "jacket" as const, bottom: "#3a3f4a", bottomStyle: "jeans" as const, skin: "#c68863", hair: "#20242a", hairStyle: "bald" as const, sunglasses: true, cap: undefined, tattoo: false, necklace: false },
  { gender: "f" as const, topStyle: "jacket" as const, bottom: "#274268", bottomStyle: "jeans" as const, skin: "#f1c27d", hair: "#b5522a", hairStyle: "crop" as const, sunglasses: false, cap: undefined, tattoo: false, necklace: true },
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

// ---- Phase 6: pedestrian destinations per area (A4). Benches and bus
// stops are "sit" spots; shops/park/beach are stroll targets. ----------
interface Waypoint { x: number; z: number; sit?: boolean; }
const BENCH_WPS: Waypoint[] = WORLD_PROPS.filter((p) => p.kind === "bench").map((p) => ({ x: p.x, z: p.z, sit: true }));
const WAYPOINTS: Record<"main" | "coral" | "north", Waypoint[]> = {
  main: [
    ...BENCH_WPS.slice(0, 10),
    ...BUS_STOPS.map((s) => ({ x: s.x, z: s.z, sit: true })),
    ...REGISTERS.filter((r) => r.id !== "coral").map((r) => ({ x: r.x, z: r.z + 3 })),
    { x: 80, z: -80 }, { x: 0, z: 114 }, { x: 44, z: 108 }, { x: -25, z: 97 }, { x: 8, z: 117 },
  ],
  coral: [
    { x: PAWN_SHOP.x, z: PAWN_SHOP.z + 3 }, { x: 48, z: 216 }, { x: 70, z: 206 },
    { x: 56, z: 244 }, { x: 88, z: 284 }, { x: 100, z: 214 },
  ],
  north: [
    { x: DEALERSHIP.x, z: DEALERSHIP.z }, { x: 9, z: -228 }, { x: -68, z: -254 },
    { x: -95, z: -240 }, { x: -36, z: -258 }, { x: 20, z: -222 }, { x: -20, z: -200 },
  ],
};
/** Shelter spots peds huddle at when it rains (awnings / doorways). */
const SHELTERS: Waypoint[] = [
  { x: 28.5, z: 10 }, { x: -28.5, z: -6 }, { x: 10, z: 28.5 }, { x: -10, z: -28.5 },
  { x: 44, z: 110 }, { x: -25, z: 100 }, { x: VENDOR.x, z: VENDOR.z },
];
const pickDest = (area: "main" | "coral" | "north") => {
  const list = WAYPOINTS[area];
  return list[Math.floor(Math.random() * list.length)];
};
// Bus route (A3): rectangle loop on the ±60 grid roads; stops at the two
// route-side bus stops + a depot pause at the SE corner.
const BUS_ROUTE: { x: number; z: number; stop?: boolean }[] = [
  { x: 60, z: -60 }, { x: 60, z: 60 }, { x: 34, z: 60, stop: true }, { x: -60, z: 60 },
  { x: -60, z: 14, stop: true }, { x: -60, z: -60 }, { x: 20, z: -60 },
];

function initWorld() {
  if (G.traffic.length === 0) {
    for (let i = 0; i < 12; i++) {
      const axis = i % 2 === 0 ? "x" : "z"; const dir = (i % 4 < 2 ? 1 : -1) as 1 | -1;
      const fixed = rndRoad(); const along = -100 + (i * 37) % 200;
      const lane = dir > 0 ? 2.8 : -2.8;
      G.traffic.push({
        x: axis === "x" ? along : fixed + lane, z: axis === "x" ? fixed + lane : along,
        heading: headingFor(axis, dir), speed: 8, axis, dir, lane, color: TRAFFIC_COLORS[i], stopped: 0, fleeing: 0,
        side: "main", steerVis: 0, pitch: 0, damage: 0, kind: TRAFFIC_KINDS[i % TRAFFIC_KINDS.length], fixed,
        reckless: i === 5, blockedT: 0, dormant: false,
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
        side: "coral", steerVis: 0, pitch: 0, damage: 0, kind: TRAFFIC_KINDS[(i + 3) % TRAFFIC_KINDS.length], fixed, blockedT: 0, dormant: false,
      });
    }
    // ---- Phase 6: Northgate loop traffic (5) on the northern grid ----
    for (let i = 0; i < 5; i++) {
      const axis = i % 2 === 0 ? "x" : "z"; const dir = (i % 4 < 2 ? 1 : -1) as 1 | -1;
      const fixed = axis === "x" ? NORTH_ROAD_Z[i % 3] : NORTH_ROAD_X[i % 3];
      const along = (axis === "x" ? -100 : -286) + ((i * 41) % 120);
      const lane = dir > 0 ? 2.8 : -2.8;
      G.traffic.push({
        x: axis === "x" ? along : fixed + lane, z: axis === "x" ? fixed + lane : along,
        heading: headingFor(axis, dir), speed: 8, axis, dir, lane, color: TRAFFIC_COLORS[(i + 2) % TRAFFIC_COLORS.length], stopped: 0, fleeing: 0,
        side: "north", steerVis: 0, pitch: 0, damage: 0, kind: i === 1 ? "taxi" : TRAFFIC_KINDS[(i + 6) % TRAFFIC_KINDS.length], fixed, blockedT: 0, dormant: false,
      });
    }
    // ---- Phase 6: a second traffic taxi on the main grid ----
    G.traffic.push({
      x: -40, z: 22.8, heading: 0, speed: 8, axis: "z", dir: 1, lane: 2.8, color: "#f2b134", stopped: 0, fleeing: 0,
      side: "main", steerVis: 0, pitch: 0, damage: 0, kind: "taxi", fixed: -40, blockedT: 0, dormant: false,
    });
    // ---- Phase 6: the city bus on its rectangle route (A3) ----
    G.traffic.push({
      x: 60, z: 0, heading: 0, speed: 0, axis: "z", dir: 1, lane: 0, color: "#2e7fb8", stopped: 0, fleeing: 0,
      side: "main", steerVis: 0, pitch: 0, damage: 0, kind: "bus", fixed: 60, busRoute: true, wp: 1, stopT: 0, blockedT: 0, dormant: false,
    });
    // ---- Phase 7: emergency-service traffic — an ambulance looping the
    // hospital road and a fire truck on the east climb (lights off in
    // normal service; the rushing ambulance is a Phase7 world event) ----
    G.traffic.push({
      x: -20, z: 102.8, heading: Math.PI / 2, speed: 7, axis: "x", dir: 1, lane: 2.8, color: "#e8ecef", stopped: 0, fleeing: 0,
      side: "main", steerVis: 0, pitch: 0, damage: 0, kind: "van", fixed: 100, blockedT: 0, dormant: false, svc: "ambulance",
    });
    G.traffic.push({
      x: 102.8, z: -30, heading: 0, speed: 7, axis: "z", dir: 1, lane: 2.8, color: "#c22e2e", stopped: 0, fleeing: 0,
      side: "main", steerVis: 0, pitch: 0, damage: 0, kind: "van", fixed: 100, blockedT: 0, dormant: false, svc: "fire",
    });
    // ---- Phase 6: rush-hour reserve — parked at kerbs off-peak, they
    // pull out and join the flow at the morning/evening peaks (A2) ----
    const parkSpots: [number, number, "x" | "z", 1 | -1][] = [
      [-100, -54.6, "x", 1], [20, 65.4, "x", -1], [60, -114.6, "x", 1],
      [-45.4, -20, "z", 1], [105.4, 40, "z", -1], [-114.6, 80, "x", -1],
    ];
    parkSpots.forEach(([along, fixedPos, axis, dir], i) => {
      const x = axis === "x" ? along : fixedPos, z = axis === "x" ? fixedPos : along;
      const laneOff = dir > 0 ? 2.8 : -2.8;
      // the `fixed` turn-coordinate is the road under the parking lane
      const snapped = ROAD_COORDS.reduce((a, b) => (Math.abs(b - (fixedPos - laneOff)) < Math.abs(a - (fixedPos - laneOff)) ? b : a), ROAD_COORDS[0]);
      G.traffic.push({
        x, z, heading: headingFor(axis, dir), speed: 0, axis, dir, lane: laneOff,
        color: TRAFFIC_COLORS[(i + 7) % TRAFFIC_COLORS.length], stopped: 0, fleeing: 0,
        side: "main", steerVis: 0, pitch: 0, damage: 0, kind: TRAFFIC_KINDS[(i + 4) % TRAFFIC_KINDS.length],
        fixed: snapped,
        rushOnly: true, parked: true, parkX: x, parkZ: z, parkHeading: headingFor(axis, dir), blockedT: 0, dormant: false,
      });
    });
  }
  if (G.peds.length === 0) {
    for (let i = 0; i < 14; i++) {
      const axis = i % 2 === 0 ? "x" : "z"; const dir = (i % 3 === 0 ? -1 : 1) as 1 | -1;
      const fixed = rndRoad(); const along = -105 + (i * 29) % 210; const side = i % 2 === 0 ? 7.6 : -7.6;
      const px0 = axis === "x" ? along : fixed + side, pz0 = axis === "x" ? fixed + side : along;
      const d0 = pickDest("main");
      G.peds.push({
        x: px0, z: pz0,
        heading: headingFor(axis, dir), speed: 0, axis, dir, side, color: PED_COLORS[i % PED_COLORS.length], fleeUntil: 0, swing: Math.random() * 6,
        zone: districtAt(px0, pz0), active: true, downUntil: 0, area: "main",
        destX: d0.x, destZ: d0.z, mode: "walk", waitUntil: 0, hasDog: i === 3, flinchUntil: 0,
      });
    }
    for (let i = 0; i < 6; i++) {
      const axis = i % 2 === 0 ? "x" : "z"; const dir = (i % 3 === 0 ? -1 : 1) as 1 | -1;
      const fixed = axis === "x" ? CORAL_ROAD_Z[i % 3] : CORAL_ROAD_X[i % 3];
      const along = (axis === "x" ? 40 : 208) + ((i * 23) % 64); const side = i % 2 === 0 ? 7.6 : -7.6;
      const px0 = axis === "x" ? along : fixed + side, pz0 = axis === "x" ? fixed + side : along;
      const d0 = pickDest("coral");
      G.peds.push({
        x: px0, z: pz0,
        heading: headingFor(axis, dir), speed: 0, axis, dir, side, color: PED_COLORS[(i + 3) % PED_COLORS.length], fleeUntil: 0, swing: Math.random() * 6,
        zone: "Coral Shores", active: true, downUntil: 0, area: "coral",
        destX: d0.x, destZ: d0.z, mode: "walk", waitUntil: 0, flinchUntil: 0,
      });
    }
    // ---- Phase 6: Northgate pedestrians (5) ----
    const northSpawns: [number, number][] = [[-100, -232], [-70, -262], [-36, -250], [-8, -226], [16, -262]];
    for (let i = 0; i < 5; i++) {
      const [px0, pz0] = northSpawns[i];
      const d0 = pickDest("north");
      G.peds.push({
        x: px0, z: pz0,
        heading: i * 1.3, speed: 0, axis: "x", dir: 1, side: 7.6, color: PED_COLORS[(i + 5) % PED_COLORS.length], fleeUntil: 0, swing: Math.random() * 6,
        zone: "Northgate", active: true, downUntil: 0, area: "north",
        destX: d0.x, destZ: d0.z, mode: "walk", waitUntil: 0, flinchUntil: 0,
      });
    }
  }
  if (G.cops.length === 0) for (let i = 0; i < 6; i++) G.cops.push({ x: 0, z: -140, heading: 0, speed: 0, active: false, lightPhase: i * 0.7, pitch: 0, roll: 0 });
}

export default function GameSystems({ paused, physicsRef, theme, cb, tokenCountRef, quality, stage }: {
  paused: boolean; physicsRef: MutableRefObject<PhysicsEngine>; theme: GameTheme;
  cb: MutableRefObject<SysCallbacks>; tokenCountRef: MutableRefObject<number>;
  quality: QualityTier;
  /** Phase 6 staged loading: traffic/peds/cops only mount at stage ≥4. */
  stage: number;
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
  // ---- Phase 6 additions: spike strips, the dog, event rigs, player
  // vitals accumulators, disguise-lite memory, phone glow sprites ----
  const spikeRef = useRef<THREE.Group>(null);
  const spikeCd = useRef(0);
  const dogRig = useMemo(() => {
    const g = new THREE.Group();
    const bodyM = new THREE.MeshStandardMaterial({ color: "#8a6a45", roughness: 0.9 });
    const darkM = new THREE.MeshStandardMaterial({ color: "#5d4526", roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.3, 0.24), bodyM); body.position.y = 0.36;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.2), bodyM); head.position.set(0.33, 0.5, 0);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.12), darkM); snout.position.set(0.47, 0.46, 0);
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.1), darkM); ear.position.set(0.28, 0.62, 0);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), darkM); tail.position.set(-0.33, 0.46, 0); tail.rotation.z = 0.7;
    g.add(body, head, snout, ear, tail);
    for (const [lx, lz] of [[0.18, 0.09], [0.18, -0.09], [-0.18, 0.09], [-0.18, -0.09]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.05), darkM);
      leg.position.set(lx, 0.12, lz); g.add(leg);
    }
    return g;
  }, []);
  const dogRef = useRef<THREE.Group>(null);
  // the wrap vendor — a static figure behind the Market Row stall (A4)
  const vendorRig = useMemo(() => buildHumanoid({ top: "#c96a2c", bottom: "#2b3440", skin: "#8d5524", hair: "#14100e", topStyle: "tee", gender: "m", hairStyle: "cap", cap: "#f5f2ea" }), []);
  const phoneGlowRefs = useRef<Array<THREE.Sprite | null>>([]);
  const eventRigs = useMemo(() => [
    buildHumanoid({ top: "#8a5a2b", bottom: "#2b3440", skin: "#e0ac69", hair: "#20242a", topStyle: "tee", gender: "m", hairStyle: "flat" }),
    buildHumanoid({ top: "#2e6b8a", bottom: "#e8e4da", skin: "#f1c27d", hair: "#b5522a", topStyle: "crop", bottomStyle: "shorts", gender: "f", hairStyle: "bun" }),
    buildHumanoid({ top: "#274268", bottom: "#232c38", skin: "#c68863", hair: "#14100e", topStyle: "hoodie", gender: "m", hairStyle: "cap", cap: "#2b6cb0" }),
    buildHumanoid({ top: "#e8e4da", bottom: "#5c4a32", skin: "#8d5524", hair: "#14100e", topStyle: "tank", gender: "f", hairStyle: "ponytail" }),
    buildHumanoid({ top: "#c9a227", bottom: "#274268", skin: "#ffdbac", hair: "#4a2f1a", topStyle: "varsity", gender: "m", hairStyle: "flat" }),
  ], []);
  const drillT = useRef(0); // Phase 7: heist strongroom drill progress
  const eventRefs = useRef<Array<THREE.Group | null>>([]);
  const eventCarRef = useRef<THREE.Group>(null);
  const eventState = useRef<{ kind: string; x: number; z: number; heading: number; until: number; barked: boolean } | null>(null);
  const eventTimer = useRef(50);
  const vitals = useRef({ driveAcc: 0, sprintAcc: 0, stamDelay: 0, lastHealth: 100, lastShotAcc: 0, hurtAt: -99 });
  const disguise = useRef<{ carId: number; district: string }>({ carId: -2, district: "" });
  const heliDisc = useRef<THREE.Mesh>(null);
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

    // ---- traffic AI (Port Sable + Coral + Northgate loops) ----
    // Phase 6 (A2): traffic obeys the cycling signals, queues behind
    // stopped cars, rush-hour reserves join at the peaks, one reckless
    // driver runs reds and weaves, and the stream DORMS beyond 165u
    // (streaming) until the player comes back within 140u.
    honkCd.current = Math.max(0, honkCd.current - dt);
    crashCd.current = Math.max(0, crashCd.current - dt);
    const hourNow = (G.dayTime * 24 + 6) % 24;
    const rush = (hourNow >= 7 && hourNow < 9.5) || (hourNow >= 16.5 && hourNow < 19);
    for (const car of G.traffic) {
      const ti = G.traffic.indexOf(car);
      const distP = Math.hypot(car.x - px, car.z - pz);
      // streaming dormancy (hysteresis 165 / 140)
      if (!car.dormant && distP > 165) car.dormant = true;
      else if (car.dormant && distP < 140) car.dormant = false;
      if (car.dormant) { car.speed = 0; continue; }
      // Phase 9: a traffic car at full damage is a WRECK — it stays where
      // it died for the rest of the game-day instead of healing off-screen
      // (the wreck set is persisted day-scoped by Phase9; the tow job and
      // the diversion scan there keep traffic flowing around it)
      if (car.damage >= 100) { car.speed = 0; continue; }
      const prevSpeed = car.speed;
      // ---- the bus follows its waypoint route and dwells at stops ----
      if (car.busRoute) {
        if ((car.stopT ?? 0) > 0) {
          car.stopT = (car.stopT ?? 0) - dt; car.speed = Math.max(0, car.speed - 16 * dt);
        } else {
          const wp = BUS_ROUTE[car.wp ?? 1];
          const dx = wp.x - car.x, dz = wp.z - car.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 3.2) {
            if (wp.stop) car.stopT = 4.5;
            car.wp = ((car.wp ?? 1) + 1) % BUS_ROUTE.length;
          }
          const desired = Math.atan2(dx, dz);
          let turn = desired - car.heading;
          turn = Math.atan2(Math.sin(turn), Math.cos(turn));
          car.heading += THREE.MathUtils.clamp(turn, -1.1 * dt, 1.1 * dt);
          car.steerVis = THREE.MathUtils.clamp(turn * 1.6, -0.7, 0.7);
          const tgt = dist > 26 ? 10.5 : 7;
          car.speed += THREE.MathUtils.clamp(tgt - car.speed, -10 * dt, 3.5 * dt);
          car.x += Math.sin(car.heading) * car.speed * dt;
          car.z += Math.cos(car.heading) * car.speed * dt;
        }
        car.pitch += (THREE.MathUtils.clamp(-(car.speed - prevSpeed) / Math.max(dt, 0.001) * 0.0028, -0.05, 0.055) - car.pitch) * Math.min(1, dt * 6);
        if (trafficSteerRefs[ti]) trafficSteerRefs[ti].current = car.steerVis;
        if (trafficBrakeRefs.current[ti]) trafficBrakeRefs.current[ti].current = car.speed < 1.5 || (car.stopT ?? 0) > 0;
        continue;
      }
      // ---- rush-hour reserve: parked off-peak, driving at the peaks ----
      if (car.rushOnly) {
        if (!rush && !car.parked && distP > 60) {
          car.parked = true; car.x = car.parkX ?? car.x; car.z = car.parkZ ?? car.z;
          car.heading = car.parkHeading ?? car.heading; car.speed = 0;
        } else if (rush && car.parked) {
          car.parked = false;
          // pull out into the lane on its fixed road
          if (car.axis === "x") car.z = (car.fixed ?? 0) + car.lane; else car.x = (car.fixed ?? 0) + car.lane;
          car.heading = headingFor(car.axis, car.dir);
        }
        if (car.parked) { car.speed = 0; continue; }
      }
      if (car.fleeing > 0) car.fleeing -= dt;
      // --- decide whether to stop: lights, queue, player, damage ---
      // Phase 8: the DECISION now comes from the Harborfall Core
      // (traffic_decision) fed with the stop-line distance + queue gap
      // measured here; wantStop survives for the horn/blocked logic and
      // the hard-stop cases (damage stop, player in the lane)
      let wantStop = false;
      let stopDist = Number.POSITIVE_INFINITY; // distance to a red/amber line
      let queueGap = Number.POSITIVE_INFINITY; // gap to the same-lane car ahead
      if (car.stopped > 0) { car.stopped -= dt; wantStop = true; }
      // signal obedience on the signalled Port Sable grid (reckless runs reds)
      if (car.side === "main" && !car.reckless && car.fleeing <= 0) {
        const fx = car.axis === "z" ? Math.sin(car.heading) : 0, fz = car.axis === "x" ? Math.cos(car.heading) : 0;
        void fx; void fz;
        const fwd = car.axis === "x" ? car.x * car.dir : car.z * car.dir;
        for (const c of ROAD_COORDS) {
          const rel = c * car.dir - fwd; // distance to the stop line along travel
          if (rel > 0.5 && rel < 16) {
            const ix = car.axis === "x" ? c : (car.fixed ?? 0), iz = car.axis === "x" ? (car.fixed ?? 0) : c;
            if (!lightAllows(ix, iz, car.axis, t)) { wantStop = true; stopDist = Math.min(stopDist, rel); break; }
          }
        }
      }
      // queue behind any same-lane car stopped ahead
      for (const other of G.traffic) {
        if (other === car || other.dormant || other.side !== car.side) continue;
        const odx = other.x - car.x, odz = other.z - car.z;
        const alongQ = car.axis === "x" ? odx * car.dir : odz * car.dir;
        const sideQ = car.axis === "x" ? Math.abs(odz) : Math.abs(odx);
        if (alongQ > 1 && alongQ < 8.5 && sideQ < 2.6 && other.speed < car.speed + 0.5) { wantStop = true; queueGap = Math.min(queueGap, alongQ); }
      }
      // player ahead: brake; blocked >3 s in your lane → lean on the horn
      const dx = px - car.x, dz = pz - car.z;
      const aheadP = car.axis === "x" ? Math.sign(dx) === car.dir && Math.abs(dz) < 6 && Math.abs(dx) < 9
                                      : Math.sign(dz) === car.dir && Math.abs(dx) < 6 && Math.abs(dz) < 9;
      if (aheadP && G.driving) {
        wantStop = true;
        if (pSpeed < 1) {
          car.blockedT = (car.blockedT ?? 0) + dt;
          if (car.blockedT > 3 && honkCd.current <= 0) { sfx.horn(); honkCd.current = 1.6; }
        } else car.blockedT = 0;
        if (car.speed > 2 && honkCd.current <= 0 && Math.random() < 0.3) { sfx.horn(); honkCd.current = 2.5; }
      } else car.blockedT = 0;
      const cruise = car.kind === "taxi" ? 10 : car.fleeing > 0 ? 13 : 8.5;
      // Harborfall Core decision: graded approach to red lines and
      // queues (light state 2 = red/amber stop line measured; queue
      // gap measured). Hard stops stay hard: a stopped-flag car or the
      // player's car in the lane overrides the graded target with 0.
      const decision = (physicsRef.current ?? fallbackPhysics).trafficDecision(
        car.speed, cruise, stopDist, stopDist === Number.POSITIVE_INFINITY ? 0 : 2, queueGap);
      const hardStop = car.stopped > 0 || (aheadP && G.driving);
      const target = hardStop ? 0 : decision.target;
      const braking = hardStop || decision.braking;
      car.speed += THREE.MathUtils.clamp(target - car.speed, (braking ? -16 : -8) * dt, 5 * dt);
      if (car.speed < 0.02 && (braking || wantStop)) car.speed = 0;
      if (car.axis === "x") car.x += car.dir * car.speed * dt; else car.z += car.dir * car.speed * dt;
      // the reckless one weaves inside the lane (A2 colour)
      if (car.reckless && car.speed > 3) {
        const weave = Math.sin(t * 1.7 + ti) * 0.9;
        if (car.axis === "x") car.z = (car.fixed ?? 0) + car.lane + weave; else car.x = (car.fixed ?? 0) + car.lane + weave;
      }
      // turn at intersections (road lists are per-city)
      const crossRoads = car.side === "coral" ? (car.axis === "x" ? CORAL_ROAD_X : CORAL_ROAD_Z)
        : car.side === "north" ? (car.axis === "x" ? NORTH_ROAD_X : NORTH_ROAD_Z) : ROAD_COORDS;
      const alongNow = car.axis === "x" ? car.x : car.z;
      const nearRoad = crossRoads.find((c) => Math.abs(alongNow - c) < 1.2);
      if (nearRoad !== undefined && Math.random() < 0.012 && car.speed > 1) {
        const along = car.axis === "x" ? car.x : car.z;
        car.axis = car.axis === "x" ? "z" : "x";
        car.dir = (Math.random() > 0.5 ? 1 : -1) as 1 | -1;
        const fixed = nearRoad - car.lane + (car.dir > 0 ? 2.8 : -2.8);
        car.lane = car.dir > 0 ? 2.8 : -2.8;
        car.fixed = nearRoad;
        if (car.axis === "x") { car.z = fixed; car.x = along; } else { car.x = fixed; car.z = along; }
        car.heading = headingFor(car.axis, car.dir);
        car.steerVis = 0.75 * car.dir;
      }
      if (car.side === "coral") {
        if (car.x < 31 || car.x > 109 || car.z < 199 || car.z > 321) {
          car.dir = (car.dir * -1) as 1 | -1; car.lane = car.dir > 0 ? 2.8 : -2.8; car.heading = headingFor(car.axis, car.dir);
          car.x = THREE.MathUtils.clamp(car.x, 33, 107); car.z = THREE.MathUtils.clamp(car.z, 201, 319);
        }
      } else if (car.side === "north") {
        if (car.x < -114 || car.x > 34 || car.z < -292 || car.z > -190) {
          car.dir = (car.dir * -1) as 1 | -1; car.lane = car.dir > 0 ? 2.8 : -2.8; car.heading = headingFor(car.axis, car.dir);
          car.x = THREE.MathUtils.clamp(car.x, -112, 32); car.z = THREE.MathUtils.clamp(car.z, -290, -192);
        }
      } else if (Math.abs(car.x) > 112 || Math.abs(car.z) > 112) { car.dir = (car.dir * -1) as 1 | -1; car.lane = car.dir > 0 ? 2.8 : -2.8; car.heading = headingFor(car.axis, car.dir); car.x = THREE.MathUtils.clamp(car.x, -110, 110); car.z = THREE.MathUtils.clamp(car.z, -110, 110); }
      car.heading = headingFor(car.axis, car.dir);
      // presentation: pitch from acceleration, wheel steer decays after turns
      car.pitch += (THREE.MathUtils.clamp(-(car.speed - prevSpeed) / Math.max(dt, 0.001) * 0.0028, -0.05, 0.055) - car.pitch) * Math.min(1, dt * 6);
      car.steerVis += (0 - car.steerVis) * Math.min(1, dt * 5);
      if (trafficSteerRefs[ti]) trafficSteerRefs[ti].current = car.steerVis;
      if (trafficBrakeRefs.current[ti]) trafficBrakeRefs.current[ti].current = wantStop || car.speed < 1.5;
    }
    // ---- pedestrians: density breathes with the time of day (Blueprint §2) —
    // downtown/Market Row crowds thin out late at night; the beach peaks at
    // dusk. Phase 6 (A2/A4): rush hours pack the pavements; at night the
    // survivors drift toward the club strip; in rain everyone hurries.
    const elevNow = Math.sin(G.dayTime * Math.PI * 2 - Math.PI / 2);
    const raining = G.rainAmt > 0.25;
    G.peds.forEach((ped, i) => {
      let frac = elevNow > 0.05 ? 1 : 0.45; // deep night: under half the walkers
      if (ped.zone === "The Docks") frac = elevNow > -0.35 && elevNow < 0.55 ? 1 : 0.55; // dusk beach crowd
      if (rush) frac = Math.min(1, frac + 0.25); // morning/evening pavement peaks
      ped.active = ((i * 7) % G.peds.length) / G.peds.length < frac;
    });
    const phys = physicsRef.current ?? fallbackPhysics;
    for (const ped of G.peds) {
      if (!ped.active) { ped.speed = 0; continue; }
      // knocked down (punch/gunfire): lies still, then gets up and flees
      if (t < ped.downUntil) { ped.speed = 0; continue; }
      const threatD2 = (ped.x - px) ** 2 + (ped.z - pz) ** 2;
      // streaming: beyond 170u a ped holds position (mesh still poses cheaply)
      if (threatD2 > 170 ** 2) { ped.speed = 0; continue; }
      // Phase 8 memory: a ped you pickpocketed TODAY gives you a wide
      // berth — they back away whenever you close in, all game-day long
      const robbedShy = ped.memRobbedDay === ECO.daySerial && threatD2 < 8 ** 2;
      const flee = (G.driving && pSpeed > 5 && threatD2 < 15 ** 2) || (G.wanted > 0 && threatD2 < 10 ** 2) || t < ped.fleeUntil || robbedShy;
      // ---- Phase 8 recognition: peds who SAW you offend (or live where
      // your reputation is high) place your face when you get close.
      // With the patrol nearby and heat on you, they POINT YOU OUT —
      // the cop's last-known position updates, exactly as if the ped
      // had phoned it in (same reporting marker, same pipeline). ----
      if (threatD2 < 13 ** 2 && t > (ped.recogCd ?? 0) && t >= ped.downUntil && !G.driving) {
        const helped = (ped.memHelpedUntil ?? 0) > t;
        const knows = helped || (ped.memWitnessUntil ?? 0) > t || (G.zoneRep[ped.zone] ?? 0) >= 50;
        if (knows) {
          ped.recogCd = t + 50 + Math.random() * 40;
          if (helped) {
            bark("Local", "Hey — you're the kind one from the pier crowd. Port Sable remembers.");
          } else if (G.wanted > 0) {
            const copNear = G.cops.some((cp) => cp.active && (cp.x - ped.x) ** 2 + (cp.z - ped.z) ** 2 < 24 ** 2);
            if (copNear) {
              G.reportingPed = G.peds.indexOf(ped); G.witnessUntil = Math.max(G.witnessUntil, performance.now() / 1000 + 1.6);
              lastKnown.current = { x: px, z: pz };
              bark("Bystander", "Officer — THERE! That's him, right there!");
            } else bark("Bystander", `Hey — that's the guy from ${ped.zone}! I seen you!`);
          } else {
            bark("Bystander", ped.zone === "The Docks" ? "Hey — that's the guy from the docks!" : `Don't I know you? Yeah — you're trouble in ${ped.zone}.`);
          }
        }
      }
      // ---- Phase 6 destination brain (A4) ----
      if (ped.mode === undefined) { ped.mode = "walk"; ped.destX = ped.x; ped.destZ = ped.z; ped.waitUntil = 0; }
      if (flee) ped.mode = "walk";
      else if (raining && ped.mode !== "shelter") {
        // rain: break for the nearest awning and huddle there a while
        let best = SHELTERS[0]; let bd = Infinity;
        for (const s of SHELTERS) { const d = (s.x - ped.x) ** 2 + (s.z - ped.z) ** 2; if (d < bd) { bd = d; best = s; } }
        ped.mode = "shelter"; ped.destX = best.x; ped.destZ = best.z;
      } else if (!raining && ped.mode === "shelter" && t > (ped.waitUntil ?? 0)) {
        ped.mode = "walk"; const d = pickDest(ped.area); ped.destX = d.x; ped.destZ = d.z;
      }
      let tx: number, tz: number, arriveR = 1.6;
      if (ped.mode === "sit") {
        if (t > (ped.waitUntil ?? 0)) { ped.mode = "walk"; const d = pickDest(ped.area); ped.destX = d.x; ped.destZ = d.z; }
        tx = ped.destX ?? ped.x; tz = ped.destZ ?? ped.z; arriveR = 0.4;
      } else if (ped.mode === "phone") {
        if (t > (ped.waitUntil ?? 0)) { ped.mode = "walk"; const d = pickDest(ped.area); ped.destX = d.x; ped.destZ = d.z; }
        tx = ped.x; tz = ped.z; // standing still, head down at the screen
      } else {
        // walking to a destination (or fleeing): night drifts club-ward
        if (ped.mode === "walk" && ped.destX !== undefined) {
          const dd = Math.hypot((ped.destX) - ped.x, (ped.destZ ?? ped.z) - ped.z);
          if (dd < 1.4) {
            const wps = WAYPOINTS[ped.area];
            const atSit = wps.some((w) => w.sit && Math.abs(w.x - (ped.destX ?? 0)) < 0.1 && Math.abs(w.z - (ped.destZ ?? 0)) < 0.1);
            if (atSit && !raining) { ped.mode = "sit"; ped.waitUntil = t + 14 + Math.random() * 26; }
            else if (Math.random() < 0.3 && !raining) { ped.mode = "phone"; ped.waitUntil = t + 5 + Math.random() * 7; }
            else {
              let d = pickDest(ped.area);
              if (elevNow <= 0.05 && ped.area === "main" && Math.random() < 0.5) d = { x: -34 + Math.random() * 10, z: -14 + Math.random() * 8 }; // club strip
              ped.destX = d.x; ped.destZ = d.z;
            }
          }
        }
        tx = flee ? (ped.axis === "x" ? ped.x + ped.dir * 14 : ped.x) : (ped.destX ?? ped.x);
        tz = flee ? (ped.axis === "z" ? ped.z + ped.dir * 14 : ped.z) : (ped.destZ ?? ped.z);
      }
      const walkBase = ped.mode === "shelter" ? 2.6 : raining ? 2.2 : 1.6; // rain = hurry
      // separation neighbours first (Phase 8): the Harborfall Core's
      // step_pedestrian_v2 folds steering + separation into ONE step,
      // replacing the old step-then-separate two-call pattern
      const near: { x: number; z: number }[] = [];
      for (const other of G.peds) {
        if (other === ped || !other.active) continue;
        const d2 = (other.x - ped.x) ** 2 + (other.z - ped.z) ** 2;
        if (d2 < 1.2 ** 2) near.push(other);
        if (near.length >= 3) break;
      }
      const next = phys.stepPedestrianV2(ped, tx, tz, px, pz, flee, walkBase, near, 0.95, dt);
      const arrived = ped.mode !== "phone" && Math.hypot(tx - ped.x, tz - ped.z) < arriveR;
      if (!isBlocked(next.x, next.z, 0.4)) { ped.x = next.x; ped.z = next.z; }
      ped.heading = ped.mode === "phone" || ped.mode === "sit" ? ped.heading : next.heading;
      ped.speed = (ped.mode === "phone" || ped.mode === "sit" || arrived) ? 0 : next.speed;
      // Phase 8 stride matching: phase rate ∝ actual speed (stride
      // length ≈ 1.08u per π of phase) so feet plant instead of skating
      ped.swing += dt * ped.speed * 2.9;
      if (ped.area === "coral") {
        if (ped.x < 31 || ped.x > 109 || ped.z < 200 || ped.z > 320) ped.dir = (ped.dir * -1) as 1 | -1;
      } else if (ped.area === "north") {
        if (ped.x < -114 || ped.x > 34 || ped.z < -292 || ped.z > -190) { const d = pickDest("north"); ped.destX = d.x; ped.destZ = d.z; ped.mode = "walk"; }
      } else if (Math.abs(ped.x) > 114 || Math.abs(ped.z) > 118) { ped.dir = (ped.dir * -1) as 1 | -1; }
      // hit by player car
      if (G.driving && hitCooldown.current <= 0 && threatD2 < 2.2 ** 2 && pSpeed > 4) {
        hitCooldown.current = 1.5; ped.fleeUntil = t + 4; addCrime("ped"); cb.current.event("shake"); sfx.thud();
        const mine = G.cars[G.activeCarId]; if (mine) mine.damage = Math.min(100, mine.damage + 3);
        ped.x += Math.sin(ped.heading) * 2; // knocked aside (arcade, non-graphic)
        // Phase 9 ragdoll-lite: the ped goes down and FLAILS for a beat
        // (procedural limbs, no solver) before the usual get-up-and-run
        ped.downUntil = t + 2.2; ped.flailUntil = t + 1.2;
      }
    }
    // ---- police / wanted (Blueprint §4): line-of-sight + last-known search.
    // Cops only KNOW where you are while one of them (or the heli at 4+ stars)
    // can actually see you. Break sight and they converge on your LAST SEEN
    // position, then sweep the area while the wanted cooldown ticks down.
    const want = G.wanted;
    const losClear = (x1: number, z1: number, x2: number, z2: number) => {
      // Phase 8: first stage is the Harborfall Core's sampled LOS over
      // the first four buildings near the sight line (the dominant
      // blockers); a mostly-walled segment is blocked right here
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
      const nearB: { x: number; z: number; hw: number; hd: number }[] = [];
      for (const b of buildings) {
        const d2 = (b.x - mx) ** 2 + (b.z - mz) ** 2;
        if (d2 < 45 ** 2) { nearB.push({ x: b.x, z: b.z, hw: b.width / 2, hd: b.depth / 2 }); if (nearB.length >= 4) break; }
      }
      if (nearB.length && (physicsRef.current ?? fallbackPhysics).losSampled(x1, z1, x2, z2, nearB) <= 0.5) return false;
      // backstop: props / static blockers via the point sampler
      for (const f of [0.3, 0.55, 0.8]) {
        if (isBlocked(x1 + (x2 - x1) * f, z1 + (z2 - z1) * f, 0.3)) return false;
      }
      return true;
    };
    let seen = false;
    if (want > 0) {
      // crouch-behind-cover (A6): crouched against a wall/car shrinks the
      // sight radius further — G.inCover is computed in the vitals block
      const sightR = 58 * (1 - G.fogAmt * 0.45) * (1 - G.rainAmt * 0.15) * (G.crouched && !G.driving ? (G.inCover ? 0.62 : 0.85) : 1);
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
        } else if (inNorth(px, pz) || onIsland(px, pz)) { // Northgate pursuit (A1)
          cop.x = THREE.MathUtils.clamp(px + Math.sin(ang) * 42, -112, 32);
          cop.z = THREE.MathUtils.clamp(pz + Math.cos(ang) * 42, -290, -192);
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
        const res = physEng.resolveVehicleCollisionV2(me(), toBody(tc.x, tc.z, tc.heading, tc.speed, tc.kind === "bus" ? 2.2 : 1.55));
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
        const res = physEng.resolveVehicleCollisionV2(me(), toBody(cop.x, cop.z, cop.heading, cop.speed, 1.55));
        cop.x = res.b.x; cop.z = res.b.z;
        cop.speed = Math.max(0, Math.min(25, res.b.vx * Math.sin(cop.heading) + res.b.vz * Math.cos(cop.heading)));
        applyHit(res, () => undefined, false);
      }
      G.cars.forEach((other, oi) => {
        if (oi === G.activeCarId || other.state.speed !== 0) return;
        if ((other.state.x - mine.state.x) ** 2 + (other.state.z - mine.state.z) ** 2 > 4.2 ** 2) return;
        const keepX = other.state.x, keepZ = other.state.z;
        const res = physEng.resolveVehicleCollisionV2(me(), toBody(other.state.x, other.state.z, other.state.heading, 0, other.kind === "motorcycle" ? 1.0 : other.kind === "bus" ? 2.2 : other.kind === "bicycle" ? 0.85 : other.kind === "boat" ? 1.9 : 1.55));
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
      // disguise-lite (A5): while seen, remember the car + district; while
      // UNSEEN, heat bleeds faster if you've swapped either since
      if (seen) disguise.current = { carId: G.activeCarId, district: districtAt(px, pz) };
      const disguised = disguise.current.carId !== -2 && (G.activeCarId !== disguise.current.carId || districtAt(px, pz) !== disguise.current.district);
      if (!seen) { G.wantedCooldown += dt * (disguised ? 1.6 : 1); if (G.wantedCooldown > 11) { G.wanted -= 1; G.starHeat = 0; G.wantedCooldown = 0; lastKnown.current = null; cb.current.popup(disguised ? "New wheels, new district — heat lost faster" : "Heat lost — wanted level down"); bark("Dispatch", "Visual lost. Suspect heat level dropping — keep searching."); } }
      // busted: cop close + player slow (unchanged rule, cleaner condition;
      // crouched in cover slows the grab — A6)
      if (nearestCop < 7.5 && pSpeed < 2.5) {
        G.bustTimer += dt * (G.inCover ? 0.6 : 1);
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
        // ---- Phase 7: the Harbour Heist strongroom drill — hold the
        // drill point on foot for 6 s; the alarm trips as you start ----
        if (def.id === "heist2" && M.step === 0 && tgt && !G.driving) {
          const dDrill = Math.hypot(tgt[0] - px, tgt[1] - pz);
          if (dDrill < 7) {
            drillT.current += dt;
            if (drillT.current > 0.1 && G.wanted < 3) { G.wanted = 3; G.wantedCooldown = 0; sfx.alarm(); cb.current.popup("The alarm trips — the patrol is coming!"); }
            G.hold = { label: "Drilling the strongroom…", progress: Math.min(1, drillT.current / 6) };
            if (drillT.current >= 6) {
              drillT.current = 0; G.hold = null; M.step = 1; M.checkpointStep = 1; sfx.cash();
              // Phase 8 investing nudge: the strongroom held Sable
              // Shipping bonds — their stock dips on the news (documented
              // in game/invest.ts)
              nudgeStock("ship", -0.08, "the harbour strongroom job hit their bond vault.");
              cb.current.popup("Strongroom open — the dock fund is yours. RUN.");
              pushNews("Strongroom drilled at the East Yards", "Alarms sounded across the Yards as the Solano counting-house strongroom was drilled open. The patrol calls it 'professional work'.");
            }
          } else {
            drillT.current = Math.max(0, drillT.current - dt * 2);
            if (G.hold?.label.startsWith("Drilling")) G.hold = null;
          }
        }
        if (tgt && !(def.id === "heist2" && M.step === 0)) {
          G.objective = { x: tgt[0], z: tgt[1], label: def.objectiveText, kind: def.kind };
          const d2 = (tgt[0] - px) ** 2 + (tgt[1] - pz) ** 2;
          const radius = def.kind === "collect" ? 3.4 : 7;
          if (d2 < radius ** 2) {
            if (def.kind === "escape" && G.wanted > 0) { /* must lose heat first — HUD text explains */ }
            else if (M.step < def.targets.length - 1) { M.collected = new Set(M.collected).add(M.step); M.step += 1; M.checkpointStep = M.step; sfx.pickup(); cb.current.popup(def.kind === "collect" ? "Ledger page recovered!" : "Checkpoint!"); }
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
      // Phase 7: the Coral apartment's parking spot is garage-save point #2
      const ownsApt = (() => { try { return localStorage.getItem("harborfall-apartment") === "1"; } catch { return false; } })();
      const onDrive = !!car && Math.abs(car.state.speed) < 0.5 &&
        ((G.ownsMansion && Math.abs(car.state.x - MANSION_DRIVE.x) < MANSION_DRIVE.hw && Math.abs(car.state.z - MANSION_DRIVE.z) < MANSION_DRIVE.hd) ||
          (ownsApt && Math.abs(car.state.x - 36) < 4 && Math.abs(car.state.z - 208) < 5));
      if (onDrive && car) {
        gs.timer += dt;
        const key = `${G.activeCarId}|${car.state.x.toFixed(1)}|${car.state.z.toFixed(1)}`;
        if (gs.timer > 2 && gs.lastKey !== key) {
          gs.lastKey = key;
          persistSavedCar({ kind: car.kind, color: car.color, x: car.state.x, z: car.state.z, heading: car.state.heading });
          // Phase 4: parking at the villa also files the car in the stored
          // garage list (selectable from either garage, max 6)
          if (G.storedCars.length < 6 && !G.storedCars.some((s) => s.kind === car.kind && s.color === car.color)) {
            G.storedCars.push({ kind: car.kind, color: car.color, name: CAR_MODELS[car.kind].name, damage: Math.round(car.damage), fuel: Math.round(car.fuel), brokenWindow: car.brokenWindow, tuneLvl: car.tuneLvl ?? 0, brakeLvl: car.brakeLvl ?? 0, flatTyre: car.flatTyre ?? false });
            persistStoredCars();
          }
          cb.current.popup("Car saved in your garage — it'll be here next visit.");
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
    // ================= Phase 6: player vitals — stamina, skills, cover,
    // health regen (A7) + spike strips (A5) + random events (B2) ========
    {
      const v = vitals.current;
      // ---- Phase 7: slow wind gusts (two beating sines) + meal boost ----
      G.wind = THREE.MathUtils.clamp(0.45 + 0.35 * Math.sin(t * 0.045) + 0.2 * Math.sin(t * 0.13 + 1.7), 0.05, 1);
      const poolMul = (G.skills.stamina >= 50 ? 0.8 : 1) * (t < G.staminaBoostUntil ? 0.5 : 1);
      let drain = 0;
      if (G.playerSprinting) drain = 14;
      else if (G.swimming) drain = 9;
      else if (G.bikePedalling) drain = 8;
      if (drain > 0) {
        v.stamDelay = 0.7;
        G.stamina = Math.max(0, G.stamina - drain * poolMul * dt);
        v.sprintAcc += dt;
        if (v.sprintAcc > 20) { v.sprintAcc = 0; if (G.skills.stamina < 100) { G.skills.stamina += 1; persistSkills(); } }
        if (G.stamina <= 0) G.exhausted = true;
      } else {
        v.stamDelay = Math.max(0, v.stamDelay - dt);
        if (v.stamDelay <= 0) G.stamina = Math.min(100, G.stamina + 10 * dt);
        if (G.exhausted && G.stamina > 20) G.exhausted = false;
      }
      // skills by use: driving time + trigger time
      if (G.driving && pSpeed > 3) {
        v.driveAcc += dt;
        if (v.driveAcc > 25) { v.driveAcc = 0; if (G.skills.driving < 100) { G.skills.driving += 1; persistSkills(); } }
      }
      if (G.skillShootAcc >= 10) {
        G.skillShootAcc -= 10;
        if (G.skills.shooting < 100) { G.skills.shooting += 1; persistSkills(); }
      }
      // health: slow regen to 50 only, and only once you've been out of
      // harm's way for 5 s (a fresh hit restarts the wait)
      if (G.health < v.lastHealth) { v.lastHealth = G.health; v.hurtAt = t; }
      if (G.health < 50 && !G.status && t - v.hurtAt > 5) {
        G.health = Math.min(50, G.health + 1.5 * dt);
        v.lastHealth = G.health;
      }
      // cover: crouched with a solid blocker within 1.3u on any side
      G.inCover = false;
      if (G.crouched && !G.driving && !G.interior) {
        for (const [ox, oz] of [[1.15, 0], [-1.15, 0], [0, 1.15], [0, -1.15]]) {
          if (isBlocked(G.playerPos.x + ox, G.playerPos.z + oz, 0.3)) { G.inCover = true; break; }
        }
        if (!G.inCover) for (const c of G.cars) {
          if ((c.state.x - G.playerPos.x) ** 2 + (c.state.z - G.playerPos.z) ** 2 < 2.6 ** 2) { G.inCover = true; break; }
        }
      }
    }
    // ---- spike strips at 4★+ roadblocks (A5): run them over and the
    // tyre lets go — pull, wobble and a hard speed cap until repaired ----
    spikeCd.current = Math.max(0, spikeCd.current - dt);
    if (rb.active && G.driving && spikeCd.current <= 0) {
      const mine = G.cars[G.activeCarId];
      if (mine && !mine.flatTyre && pSpeed > 3) {
        const alongRb = (mine.state.x - rb.x) * rb.hx + (mine.state.z - rb.z) * rb.hz;
        const sideRb = (mine.state.x - rb.x) * rb.ox + (mine.state.z - rb.z) * rb.oz;
        if (Math.abs(alongRb) < 1.6 && Math.abs(sideRb) < 4.6) {
          mine.flatTyre = true;
          spikeCd.current = 3;
          sfx.pop();
          toast("Spike strip! Tyre shredded — limp to a garage (R to repair).");
          bark("Dispatch", "Spikes deployed — suspect vehicle is running on a rim.");
        }
      }
    }
    if (spikeRef.current) {
      spikeRef.current.visible = rb.active;
      if (rb.active) {
        spikeRef.current.position.set(rb.x, groundYAt(rb.x, rb.z) + 0.06, rb.z);
        spikeRef.current.rotation.y = Math.atan2(rb.ox, rb.oz);
      }
    }
    // ---- random world events (B2): one ambient scene at a time ----
    {
      const ev = eventState.current;
      if (ev && (t > ev.until || Math.hypot(ev.x - px, ev.z - pz) > 150)) {
        eventState.current = null;
        if (G.eventNow) G.eventNow = null;
        if (ev.kind === "chase") { const c5 = G.cops[5]; if (c5 && G.wanted === 0) c5.active = false; }
      }
      if (!eventState.current && !M.active) {
        eventTimer.current -= dt;
        if (eventTimer.current <= 0) {
          eventTimer.current = 45 + Math.random() * 35;
          const kind = (["crash", "chase", "performer", "breakdown"] as const)[Math.floor(Math.random() * 4)];
          const spots: Record<string, [number, number, number]> = {
            crash: [44, -38, 0.8], chase: [0, 0, 0], performer: [14, 112, 0], breakdown: [-64, 44, 2.2],
          };
          const [ex, ez, eh] = spots[kind];
          eventState.current = { kind, x: ex, z: ez, heading: eh, until: t + (kind === "chase" ? 26 : 100), barked: false };
          if (kind === "performer") G.eventNow = { kind: "performer", x: ex, z: ez, tipped: false };
          if (kind === "chase") {
            const c5 = G.cops[5];
            if (c5) { c5.active = true; c5.x = px + 30; c5.z = pz - 20; c5.speed = 10; }
          }
        }
      }
      const evNow = eventState.current;
      if (evNow && !evNow.barked && Math.hypot(evNow.x - px, evNow.z - pz) < 42) {
        evNow.barked = true;
        if (evNow.kind === "crash") bark("Bystander", "Two cars kissed at the lights — nobody's hurt, everyone's shouting.");
        else if (evNow.kind === "performer") bark("Performer", "Tips keep the music playing, friend!");
        else if (evNow.kind === "breakdown") bark("Stranded driver", "She just died on me… anyone know a mechanic?");
        else if (evNow.kind === "chase") bark("Dispatch", "Unit 5 in pursuit of a fleeing vehicle — not our suspect.");
      }
      // the chase event: cop 5 tails a phantom runner ahead of the player
      if (evNow?.kind === "chase" && G.wanted === 0) {
        const c5 = G.cops[5];
        if (c5?.active) {
          const tx2 = px + Math.sin(t * 0.11) * 55, tz2 = pz + Math.cos(t * 0.11) * 55;
          const dx2 = tx2 - c5.x, dz2 = tz2 - c5.z;
          const dd = Math.hypot(dx2, dz2);
          const des = Math.atan2(dx2, dz2);
          let trn = des - c5.heading; trn = Math.atan2(Math.sin(trn), Math.cos(trn));
          c5.heading += THREE.MathUtils.clamp(trn, -2.2 * dt, 2.2 * dt);
          c5.speed += THREE.MathUtils.clamp((dd > 12 ? 17 : 10) - c5.speed, -14 * dt, 8 * dt);
          const nx2 = c5.x + Math.sin(c5.heading) * c5.speed * dt, nz2 = c5.z + Math.cos(c5.heading) * c5.speed * dt;
          if (!isBlocked(nx2, nz2, 1.3)) { c5.x = nx2; c5.z = nz2; }
          c5.lightPhase += dt * 7;
          evNow.x = c5.x; evNow.z = c5.z;
        }
      }
    }
    syncMeshes(t);
    function failMission(reason: string) {
      if (!M.active) return;
      G.missionResult = { ok: false, title: M.active.title, reward: 0, items: 0, timeLeft: 0, reason, at: t };
      // Phase 7: remember the checkpoint for an R-key retry; a failed
      // replay simply ends the replay (progress untouched either way)
      M.lastFailed = { def: M.active, step: M.checkpointStep };
      M.replayId = "";
      sfx.fail(); cb.current.banner(`Mission failed — ${reason} Press R to retry from checkpoint ${M.checkpointStep + 1}, or restart from the giver.`, false); endMission(); cb.current.event("missionEnd");
    }
    function completeMission() {
      const def = M.active; if (!def) return;
      // Phase 5: Ch.6 pays the alternate split when Elias was warned;
      // side arcs advance their own progress and NEVER touch storyIndex.
      const pay = effectivePayout(def);
      const outro = def.outroAlt && altActive(def) ? def.outroAlt : def.outro;
      G.missionResult = { ok: true, title: def.title, reward: pay, items: 0, timeLeft: Math.max(0, Math.round(M.timer)), reason: "", at: t };
      G.cash += pay; G.lifetimeEarned += pay;
      pushPhoneMsg("SableBank", `💰 $${pay} received — ${def.title}. Balance: $${G.cash}.`);
      // Phase 7: best-time stats + a News headline for real completions
      recordBest(def.id, def.timeLimit - M.timer);
      const isReplay = M.replayId === def.id;
      M.replayId = ""; M.lastFailed = null;
      if (!isReplay) pushNews(`Harbour Wire: ${def.title} — done`, def.story
        ? `Word on the docks is another chapter closed in the Kade–Solano feud. $${pay} changed hands and nobody official will say a word.`
        : `Local work wrapped up quietly in Port Sable — $${pay} paid, no questions asked.`);
      persist();
      sfx.complete(); cb.current.popup(`+$${pay}`);
      cb.current.banner(`Mission complete: ${def.title} +$${pay}`, true);
      const wasStory = def.story;
      const side = def.side;
      endMission();
      cb.current.dialogue(outro, () => {
        if (isReplay) { cb.current.event("missionEnd"); return; } // replays never move progress
        if (wasStory) {
          M.storyIndex += 1;
          if (M.storyIndex >= 6) { M.storyDone = true; persist(); cb.current.storyFinished(); }
          persist(); cb.current.event("missionEnd");
        } else if (side) {
          const cap = side === "heist" ? 2 : 3;
          M.side[side] = Math.min(cap, M.side[side] + 1);
          if (side === "heist" && M.side.heist === 1) M.heistClean = G.wanted === 0; // prep seen or unseen
          persist();
          if (side === "heist" && M.side.heist >= 2) pushPhoneMsg("Old Elias", "It's done, lad. The dock fund's home and Tamim's name is off the last page. The harbour provides.");
          else if (side === "after" && def.id === "after2") {
            // Phase 9: the pack's choice lands in the world — publishing
            // makes the Harbour Wire headline; burning clears every
            // district's memory of your face (reputation reset)
            if (M.packChoice === "burn") { G.zoneRep = {}; persistZoneRep(); pushNews("Harbour Wire: smoke over the East Yards", "A small fire at the old counting house annex burned itself out by dawn. Nothing of value was lost, say officials. Nobody believes them, but the docks feel quieter already."); }
            else pushNews("Harbour Wire: THE LEDGER, IN FULL", "Every name Solano owned, printed on page one. By noon, three harbour officials had resigned and the parole board announced a review. Port Sable is reading itself in print today.");
          }
          else if (side === "after" && M.side.after >= 3) pushPhoneMsg("Tamim Kade", "Heard you ran the lights clean, brother. Five years inside and the harbour still turns for a Kade. Dinner's on me — Lina's cooking, my treat. 🐟");
          else if (M.side[side] >= 3) pushPhoneMsg(side === "lina" ? "Lina Park" : "Det. Mara Voss", side === "lina" ? "That's the whole line done, Rayan. The garage owes you — come by any time." : "File closed and filed. The parole board has everything. Thank you, Kade.");
          cb.current.event("missionEnd");
        } else { M.repeatIndex += 1; persist(); cb.current.event("missionEnd"); }
      });
      cb.current.event("missionEnd");
    }
    function syncMeshes(tt: number) {
      frameNo.current += 1;
      G.traffic.forEach((c, i) => { const g = trafficRefs.current[i]; if (g) { g.visible = !c.dormant; g.position.set(c.x, groundYAt(c.x, c.z), c.z); g.rotation.order = "YXZ"; g.rotation.set(c.pitch, c.heading, 0); } });
      const reportT = performance.now() / 1000;
      G.peds.forEach((pd, i) => {
        const g = pedRefs.current[i]; if (!g) return;
        g.visible = pd.active;
        const down = tt < pd.downUntil;
        const flailing = down && tt < (pd.flailUntil ?? 0);
        g.position.set(pd.x, down ? 0.32 : 0, pd.z);
        // Phase 9 ragdoll-lite: a car-hit ped tips AND rolls/flails for
        // the first second on the ground (procedural, no solver)
        g.rotation.set(down ? -Math.PI / 2 * 0.92 : 0, pd.heading, flailing ? Math.sin(tt * 24) * 0.4 : 0);
        const rig = pedRigs[i];
        // Visual V7: far peds (>120u) animate every 3rd frame
        const far = (pd.x - G.followPos.x) ** 2 + (pd.z - G.followPos.z) ** 2 > 120 ** 2;
        if (rig && flailing && (!far || (frameNo.current + i) % 3 === 0)) {
          animateHumanoid(rig, tt * 21, 1, tt); // limbs cycle hard = flail
          rig.group.position.y = 0.1 + Math.abs(Math.sin(tt * 12)) * 0.08;
        } else if (rig && down) rig.group.position.y = 0;
        if (rig && !down && (!far || (frameNo.current + i) % 3 === 0)) {
          animateHumanoid(rig, pd.swing * 1.7, Math.min(1, Math.abs(pd.speed) / 1.7), tt);
          // ---- Phase 6 life poses (A4/A6) ----
          if (pd.mode === "sit") {
            rig.lThigh.rotation.x = rig.rThigh.rotation.x = -1.45;
            rig.lShin.rotation.x = rig.rShin.rotation.x = 1.35;
            rig.group.position.y = -0.42;
          } else rig.group.position.y = 0;
          if (pd.mode === "phone") {
            rig.head.rotation.x = 0.52; // head down at the screen
            rig.rArm.rotation.x = -0.85; rig.rFore.rotation.x = -0.5;
            rig.lArm.rotation.x = -0.55; rig.lFore.rotation.x = -0.45;
          }
          if (pd.mode === "shelter") rig.torso.rotation.x = 0.14; // huddled
          if (tt < (pd.flinchUntil ?? 0)) {
            // gunfire hit reaction: arms thrown up, body recoils (A6)
            rig.lArm.rotation.x = -2.6; rig.rArm.rotation.x = -2.4;
            rig.torso.rotation.x = -0.28;
          }
        }
        // phone screen glow — visible at night while a ped is scrolling
        const glow = phoneGlowRefs.current[i];
        if (glow) {
          const nightF = 1 - THREE.MathUtils.clamp(Math.sin(G.dayTime * Math.PI * 2 - Math.PI / 2) * 1.6 + 0.35, 0, 1);
          glow.visible = pd.active && !down && pd.mode === "phone" && nightF > 0.25;
          if (glow.visible) glow.position.set(pd.x + Math.sin(pd.heading) * 0.34, 1.18, pd.z + Math.cos(pd.heading) * 0.34);
        }
        const marker = reportRefs.current[i];
        if (marker) marker.visible = pd.active && !down && G.reportingPed === i && reportT < G.witnessUntil;
      });
      // the dog trots beside its owner (A4)
      if (dogRef.current) {
        const owner = G.peds.find((p) => p.hasDog);
        if (owner && owner.active && tt >= owner.downUntil) {
          dogRef.current.visible = true;
          const ox = owner.x + Math.cos(owner.heading) * 0.85, oz = owner.z - Math.sin(owner.heading) * 0.85;
          dogRef.current.position.set(ox, groundYAt(ox, oz), oz);
          dogRef.current.rotation.y = owner.heading + Math.PI / 2 + Math.sin(tt * 2.2) * 0.12;
          dogRef.current.position.y += Math.abs(Math.sin(tt * 7)) * 0.03 * Math.min(1, owner.speed);
        } else dogRef.current.visible = false;
      }
      // ---- random-event presentation (B2): rigs + car placed per kind ----
      {
        const ev = eventState.current;
        const showRigs = !!ev && (ev.kind === "crash" || ev.kind === "performer" || ev.kind === "breakdown");
        eventRefs.current.forEach((g, ri) => {
          if (!g) return;
          const rig = eventRigs[ri];
          const use = showRigs && (ev!.kind === "performer" ? ri < 5 : ri < 3);
          g.visible = use;
          if (!use) return;
          const ang = (ri / 5) * Math.PI * 2 + 0.4;
          const rr = ev!.kind === "performer" ? 2.6 : 2 + ri * 0.8;
          const ex = ev!.kind === "performer" ? ev!.x + Math.sin(ang) * rr : ev!.x + 2.4 + ri * 1.1;
          const ez = ev!.kind === "performer" ? ev!.z + Math.cos(ang) * rr : ev!.z + 1.6 - ri * 0.7;
          g.position.set(ex, groundYAt(ex, ez), ez);
          g.rotation.y = Math.atan2(ev!.x - ex, ev!.z - ez);
          animateHumanoid(rig, tt * 1.2 + ri, 0, tt + ri * 1.7);
          if (ev!.kind === "performer" && ri === 4) {
            // the performer: arms up, swaying to their own music
            rig.lArm.rotation.x = -2.9 + Math.sin(tt * 2.4) * 0.25;
            rig.rArm.rotation.x = -2.7 + Math.cos(tt * 2.1) * 0.25;
            rig.torso.rotation.z = Math.sin(tt * 1.8) * 0.08;
          }
          if (ev!.kind === "breakdown" && ri === 0) {
            rig.torso.rotation.x = 0.5; // bent over the engine bay
            rig.rArm.rotation.x = -0.9;
          }
        });
        if (eventCarRef.current) {
          const showCar = !!ev && (ev.kind === "crash" || ev.kind === "breakdown");
          eventCarRef.current.visible = showCar;
          if (showCar && ev) {
            eventCarRef.current.position.set(ev.x, groundYAt(ev.x, ev.z), ev.z);
            eventCarRef.current.rotation.y = ev.heading + (ev.kind === "crash" ? 0.5 : 0);
          }
        }
      }
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
      // police helicopter: slow orbit above the player at high heat; at
      // night from 3★ its SEARCHLIGHT cone sweeps the ground (A5)
      if (heliRef.current) {
        const nightNow = Math.sin(G.dayTime * Math.PI * 2 - Math.PI / 2) < -0.15;
        const show = G.wanted >= 4 || (G.wanted >= 3 && nightNow);
        heliRef.current.visible = show;
        if (show) {
          const hx = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId].state.x : G.playerPos.x;
          const hz = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId].state.z : G.playerPos.z;
          heliRef.current.position.set(hx + Math.sin(tt * 0.35) * 11, 17 + Math.sin(tt * 0.8) * 1.3, hz + Math.cos(tt * 0.35) * 11);
          heliRef.current.rotation.y = tt * 0.35 + Math.PI / 2;
          if (heliRotor.current) heliRotor.current.rotation.y = tt * 30;
          if (heliDisc.current) {
            heliDisc.current.visible = nightNow;
            if (nightNow) {
              const sx = hx + Math.sin(tt * 0.9) * 6, sz = hz + Math.cos(tt * 0.7) * 6;
              heliDisc.current.position.set(sx, groundYAt(sx, sz) + 0.12, sz);
              const m = heliDisc.current.material as THREE.MeshBasicMaterial;
              m.opacity = 0.16 + Math.sin(tt * 5) * 0.03;
            }
          }
        } else if (heliDisc.current) heliDisc.current.visible = false;
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
      {/* Phase 8 smoothness: on Medium, when dynamic resolution has
          stepped to ≤1.25 the shadow map steps down to 1024 with it
          (the key change remounts the light so three reallocates) */}
      <directionalLight key={`${quality}:${quality === "medium" && perf.dpr > 0 && perf.dpr <= 1.25 ? "s" : "n"}`} ref={sun} castShadow position={[40, 50, 30]} intensity={theme.sunIntensity}
        shadow-mapSize-width={quality === "medium" && perf.dpr > 0 && perf.dpr <= 1.25 ? 1024 : gates.shadowMapSize(quality)} shadow-mapSize-height={quality === "medium" && perf.dpr > 0 && perf.dpr <= 1.25 ? 1024 : gates.shadowMapSize(quality)}
        shadow-radius={gates.shadowRadius(quality)}
        shadow-camera-left={-55} shadow-camera-right={55} shadow-camera-top={55} shadow-camera-bottom={-55} shadow-bias={-0.0002} shadow-normalBias={0.02} />
      {/* traffic — detailed bodies; Phase 6 mounts only at load stage ≥4
          (staged construction) and each car renders its OWN kind now */}
      {stage >= 4 && G.traffic.map((c, i) => (
        <group key={i} ref={(n) => { trafficRefs.current[i] = n; }} position={[c.x, 0, c.z]}>
          <CarBody kind={c.kind ?? TRAFFIC_KINDS[i % TRAFFIC_KINDS.length]} color={c.color} steerRef={trafficSteerRefs[i]} liveDamage={() => G.traffic[i].damage} brakeRef={trafficBrakeRefs.current[i]} beams />
          {/* Phase 7: emergency-service dressing on the van bodies —
              light bar (dark in normal service) + ambulance cross /
              fire ladder on the roof */}
          {c.svc === "ambulance" && (
            <group>
              <mesh position={[0, 2.02, -0.2]}><boxGeometry args={[1.1, 0.14, 0.4]} /><meshStandardMaterial color="#dfe5ea" emissive="#ff4444" emissiveIntensity={0.25} /></mesh>
              <mesh position={[0, 2.06, 0.9]}><boxGeometry args={[0.52, 0.05, 0.17]} /><meshStandardMaterial color="#c22e2e" roughness={0.5} /></mesh>
              <mesh position={[0, 2.06, 0.9]}><boxGeometry args={[0.17, 0.05, 0.52]} /><meshStandardMaterial color="#c22e2e" roughness={0.5} /></mesh>
            </group>
          )}
          {c.svc === "fire" && (
            <group>
              <mesh position={[0, 2.02, -0.2]}><boxGeometry args={[1.1, 0.14, 0.4]} /><meshStandardMaterial color="#5c1616" emissive="#ff3333" emissiveIntensity={0.25} /></mesh>
              <mesh position={[0, 2.12, 0.4]}><boxGeometry args={[0.5, 0.08, 4.4]} /><meshStandardMaterial color="#c8ccd2" metalness={0.7} roughness={0.35} /></mesh>
            </group>
          )}
        </group>
      ))}
      {/* pedestrians — articulated humanoids with outfit variety */}
      {stage >= 4 && G.peds.map((pd, i) => (
        <group key={i}>
          <group ref={(n) => { pedRefs.current[i] = n; }} position={[pd.x, 0, pd.z]}>
            {pedRigs[i] && <primitive object={pedRigs[i].group} />}
            {/* witness "!" marker while this ped is calling in a crime */}
            <group ref={(n) => { reportRefs.current[i] = n; }} position={[0, 2.2, 0]} visible={false}>
              <mesh><boxGeometry args={[0.09, 0.34, 0.09]} /><meshBasicMaterial color="#ffb703" /></mesh>
              <mesh position={[0, -0.28, 0]}><boxGeometry args={[0.09, 0.09, 0.09]} /><meshBasicMaterial color="#ffb703" /></mesh>
            </group>
          </group>
          {/* phone screen glow (night, phone-mode peds) — world-positioned */}
          <sprite ref={(n) => { phoneGlowRefs.current[i] = n; }} visible={false} scale={[0.55, 0.55, 1]}>
            <spriteMaterial map={glowTex} color="#bcd8ff" transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      ))}
      {/* the dog (A4) + street vendor figure at the Market Row stall */}
      {stage >= 4 && <primitive object={dogRig} ref={dogRef} />}
      {stage >= 4 && (
        <group position={[VENDOR.x + 1.1, 0, VENDOR.z + 0.6]} rotation={[0, -2.2, 0]}>
          <primitive object={vendorRig.group} />
        </group>
      )}
      {/* roadblock patrol cars (spawned at 4+ stars, positioned in useFrame) */}
      {stage >= 4 && [0, 1].map((i) => (
        <group key={`rb${i}`} ref={(n) => { rbRefs.current[i] = n; }} visible={false}>
          <CarBody kind="sedan" color="#12161c" police />
          <mesh position={[0, 1.44, -0.1]}><boxGeometry args={[1.05, 0.16, 0.4]} /><meshStandardMaterial color="#ff3333" emissive="#ff2222" emissiveIntensity={1.6} /></mesh>
        </group>
      ))}
      {/* spike strip laid between the roadblock cars (A5) */}
      <group ref={spikeRef} visible={false}>
        <mesh><boxGeometry args={[0.5, 0.07, 9.4]} /><meshStandardMaterial color="#1c1f24" roughness={0.6} metalness={0.3} /></mesh>
        {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((s) => (
          <mesh key={s} position={[0, 0.09, s]} rotation={[0, 0, 0.5]}><coneGeometry args={[0.06, 0.16, 4]} /><meshStandardMaterial color="#c8ccd2" metalness={0.8} roughness={0.3} /></mesh>
        ))}
      </group>
      {/* random-event cast + car (B2) */}
      {stage >= 4 && eventRigs.map((rig, ri) => (
        <group key={`ev${ri}`} ref={(n) => { eventRefs.current[ri] = n; }} visible={false}>
          <primitive object={rig.group} />
        </group>
      ))}
      {stage >= 4 && (
        <group ref={eventCarRef} visible={false}>
          <CarBody kind="hatch" color="#8a4c4c" />
          {/* raised hood for the breakdown scene (hidden tilt for crash) */}
          <mesh position={[0, 0.95, 1.55]} rotation={[-0.7, 0, 0]}><boxGeometry args={[1.5, 0.06, 0.9]} /><meshStandardMaterial color="#6d3a3a" roughness={0.6} /></mesh>
        </group>
      )}
      {/* NPC-life vignettes: benches + seated figures, talking pairs */}
      {stage >= 4 && vignettes.seated.map((v, i) => (
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
      {stage >= 4 && vignettes.talking.map((v, i) => (
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
      {stage >= 4 && G.cops.map((_c, i) => (
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
      {/* heli searchlight pool on the ground (night, ≥3★ — A5) */}
      <mesh ref={heliDisc} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4.6, 20]} />
        <meshBasicMaterial color="#ffedb5" transparent opacity={0.16} depthWrite={false} />
      </mesh>
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
