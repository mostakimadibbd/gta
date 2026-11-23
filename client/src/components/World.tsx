import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildings, trees, props, lamps, palms, houses, ROAD_COORDS, ROAD_WIDTH, WATER_Z, MANSION, FUEL_STATIONS, OVERLOOK, BRIDGE, CORAL_ROAD_X, CORAL_ROAD_Z, REGISTERS, PAWN_SHOP, groundYAt } from "../world";
import { G } from "../game/store";
import type { GameTheme } from "../themes";
import {
  asphaltTexture, asphaltTextureH, concreteTexture, concreteTextureH,
  facadeTexture, brickTexture, containerTexture, streetSignTexture, neonSignTexture,
  grassTexture, sandTexture, palmFrondTexture, glowTexture, cloudTexture,
  arrowTexture, oilTexture,
  asphaltNormal, concreteNormal, facadeNormal, brickNormal, sandNormal, grassNormal,
  asphaltRoughness, concreteRoughness,
} from "../textures";
import CarBody from "./CarBody";
import { buildHumanoid, animateHumanoid, type HumanoidRig } from "../humanoid";

// ---------- local canvas textures ----------
function makeWindowTexture(): THREE.CanvasTexture {
  // Phase 3: windows with DEPTH — frame shading (lit top edge, dark sill),
  // a glass gradient per pane, and lived-in variance: some panes warm-lit,
  // some with half-drawn blinds, most dark reflective blue-grey.
  const c = document.createElement("canvas"); c.width = 96; c.height = 192;
  const g = c.getContext("2d")!;
  let s = 1234; const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  g.fillStyle = "#181d21"; g.fillRect(0, 0, 96, 192);
  for (let y = 5; y < 182; y += 15) for (let x = 5; x < 88; x += 15) {
    const r = rnd();
    // frame
    g.fillStyle = "#05070a"; g.fillRect(x - 1.5, y - 1.5, 11, 12);
    g.fillStyle = "rgba(235,240,244,0.5)"; g.fillRect(x - 1.5, y - 1.5, 11, 1.2);
    if (r < 0.16) { g.fillStyle = "#ffd98a"; g.fillRect(x, y, 8, 9); } // warm lit room
    else if (r < 0.24) { // half-drawn blinds over dim glass
      g.fillStyle = "#46545e"; g.fillRect(x, y, 8, 9);
      g.fillStyle = "#cfd6da"; for (let b = 0; b < 4; b++) g.fillRect(x, y + b * 1.6, 8, 0.9);
    } else { // dark glass with a top-to-bottom sheen gradient
      const gr = g.createLinearGradient(x, y, x, y + 9);
      gr.addColorStop(0, "#5d7482"); gr.addColorStop(0.45, "#33424c"); gr.addColorStop(1, "#232e36");
      g.fillStyle = gr; g.fillRect(x, y, 8, 9);
    }
    g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(x - 1.5, y + 10, 11, 1.4); // sill shadow
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function makeSignTexture(text: string, bg: string, fg: string, w = 256): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = w; c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = bg; g.fillRect(0, 0, w, 64);
  g.fillStyle = fg; g.font = `bold ${w > 300 ? 40 : 26}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, w / 2, 34);
  return new THREE.CanvasTexture(c);
}
function makeHillSignTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 2048; c.height = 320;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 2048, 320);
  g.font = "bold 215px sans-serif"; g.textAlign = "left"; g.textBaseline = "middle";
  g.shadowColor = "rgba(0,0,0,0.45)"; g.shadowBlur = 10; g.shadowOffsetY = 8;
  g.fillStyle = "#f7f5ee";
  const text = "PORT SABLE"; let x = 30;
  for (const ch of text) { g.fillText(ch, x, 168); x += g.measureText(ch).width + 34; }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
function makeSkyTexture(): THREE.CanvasTexture {
  // richer gradient: deep teal zenith → saturated azure → amber → coral
  // horizon. Midday reads as rich blue, never the washed white of before
  // (the pale mid-tones are gone; brightness is capped by the dome tint).
  const c = document.createElement("canvas"); c.width = 64; c.height = 512;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#1d5f7a"); grad.addColorStop(0.34, "#3d8fa8");
  grad.addColorStop(0.55, "#79b4c0"); grad.addColorStop(0.72, "#f2c184");
  grad.addColorStop(0.85, "#ff9a5c"); grad.addColorStop(1, "#e2703a");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 512);
  return new THREE.CanvasTexture(c);
}
const SIGNS: { text: string; bg: string; fg: string; pos: [number, number, number]; rot: number }[] = [
  { text: "LINA'S GARAGE", bg: "#0f4442", fg: "#ffca7a", pos: [-40, 6, -27], rot: 0 },
  { text: "LINA'S GARAGE", bg: "#0f4442", fg: "#ffca7a", pos: [-25, 5.6, 102.1], rot: Math.PI },
  { text: "SOLANO TRUCKING", bg: "#5a3a14", fg: "#ffd98a", pos: [60, 9, 93], rot: Math.PI },
  { text: "PORT SABLE", bg: "#14524f", fg: "#ffffff", pos: [0, 7, 118], rot: Math.PI },
  { text: "SABLE FISH CO.", bg: "#274268", fg: "#ffe9a8", pos: [-80, 5, 93], rot: Math.PI },
  { text: "MARKET ROW", bg: "#946b2d", fg: "#ffffff", pos: [20, 6, 13], rot: 0 },
  { text: "FERRY AHOY", bg: "#17605c", fg: "#fef9c3", pos: [-93, 5, 60], rot: Math.PI / 2 },
  // ---- Phase 2 billboards: original Port Sable brands ----
  { text: "SABLE COLA — TASTE THE HARBOUR", bg: "#7a1f1f", fg: "#ffe9c9", pos: [-45, 9, -55], rot: 0.5 },
  { text: "GULLWING GT — OWN THE COAST ROAD", bg: "#101c26", fg: "#9fd8e8", pos: [52, 9.5, -2], rot: -Math.PI / 2 },
  { text: "HOTEL SABLE ★ BAY VIEW SUITES", bg: "#12303f", fg: "#f2c14e", pos: [8, 9, 55], rot: Math.PI },
  { text: "PORT FERRY — CROSS THE BAY", bg: "#14532d", fg: "#eaf6ff", pos: [-52, 8.5, -112], rot: 0.25 },
  { text: "LINA'S GARAGE — WE FIX ANYTHING", bg: "#2a2118", fg: "#ffb703", pos: [104, 9.5, 78], rot: -0.7 },
];
const STREET_SIGNS = [
  { text: "HARBOUR AVE", pos: [26.8, 13.2] as const, rot: 0 },
  { text: "LANTERN ST", pos: [-26.8, -13.2] as const, rot: Math.PI },
  { text: "FERRY RD", pos: [-106.8, 53.2] as const, rot: Math.PI / 2 },
  { text: "MARKET ROW", pos: [13.2, 26.8] as const, rot: -Math.PI / 2 },
];
const LIGHT_SPOTS: [number, number][] = [[-20, -20], [-20, 20], [20, -20], [20, 20], [-60, 20], [60, -20], [-20, 60], [20, -60]];
const CONTAINER_COLORS = ["#b3402e", "#2e5f8a", "#3f7a4d", "#c9711f", "#6a7076", "#7a4a6b"];

function Tree({ x, z, scale }: { x: number; z: number; scale: number }) {
  // rebuilt pine: tapered trunk + THREE jittered foliage layers (dark rich
  // greens, smooth shading) + a rounded bush blob at the base on some trees
  const j = (n: number) => ((Math.sin(x * 12.9898 + z * 78.233 + n * 37.7) * 43758.5453) % 1) * 0.16;
  const bush = Math.abs(Math.sin(x * 3.1 + z * 1.7)) > 0.45;
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.85, 0]} castShadow><cylinderGeometry args={[0.13, 0.22, 1.7, 7]} /><meshStandardMaterial color="#5f4630" roughness={0.95} /></mesh>
      <mesh position={[j(1), 2.0, j(2)]} castShadow><coneGeometry args={[1.12, 2.2, 9]} /><meshStandardMaterial color="#1f5c3d" roughness={0.9} /></mesh>
      <mesh position={[j(3), 2.85, j(4)]} castShadow><coneGeometry args={[0.88, 1.9, 9]} /><meshStandardMaterial color="#276e47" roughness={0.9} /></mesh>
      <mesh position={[j(5), 3.6, j(6)]} castShadow><coneGeometry args={[0.6, 1.55, 9]} /><meshStandardMaterial color="#2f7d4f" roughness={0.9} /></mesh>
      {bush && <mesh position={[0.85, 0.42, 0.5]} castShadow><icosahedronGeometry args={[0.55, 1]} /><meshStandardMaterial color="#24513a" roughness={0.95} /></mesh>}
      {bush && <mesh position={[-0.7, 0.34, -0.55]} castShadow><icosahedronGeometry args={[0.44, 1]} /><meshStandardMaterial color="#2c5f42" roughness={0.95} /></mesh>}
    </group>
  );
}

// shared frond material (canvas palm-leaf alpha texture, double-sided)
let _frondMat: THREE.MeshStandardMaterial | null = null;
function frondMat(): THREE.MeshStandardMaterial {
  if (!_frondMat) _frondMat = new THREE.MeshStandardMaterial({ map: palmFrondTexture(), alphaTest: 0.32, side: THREE.DoubleSide, roughness: 0.85, color: "#d8e8c8" });
  return _frondMat;
}
function PalmTree({ x, z, scale, lean }: { x: number; z: number; scale: number; lean: number }) {
  // rebuilt palm: TALL curved trunk (4 stacked, offset segments) + crown of
  // 8 feathered fronds — boulevard rows reach ~8-10u like the references
  const topX = lean * 2.6;
  const crown = useRef<THREE.Group>(null);
  // Visual V5: fronds sway gently — only for palms near the player
  useFrame(({ clock }) => {
    if (!crown.current) return;
    const d2 = (x - G.followPos.x) ** 2 + (z - G.followPos.z) ** 2;
    if (d2 > 65 ** 2) return;
    const t = clock.elapsedTime;
    crown.current.rotation.z = Math.sin(t * 0.9 + x * 0.7 + z * 0.3) * 0.026;
    crown.current.rotation.x = Math.cos(t * 0.7 + z * 0.5) * 0.02;
  });
  return (
    <group position={[x, 0, z]} scale={scale}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[lean * i * i * 0.16, 0.85 + i * 1.42, 0]} rotation={[0, 0, -lean * 0.5]} castShadow>
          <cylinderGeometry args={[0.145 - i * 0.018, 0.175 - i * 0.018, 1.75, 7]} /><meshStandardMaterial color="#7d5f3d" roughness={0.95} />
        </mesh>
      ))}
      <group ref={crown} position={[topX, 6.15, 0]}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
          <group key={k} rotation={[0, (k * Math.PI) / 4 + (k % 2) * 0.2, 0]}>
            <mesh position={[1.25, 0.1, 0]} rotation={[0, 0, -0.38 - (k % 3) * 0.09]} castShadow>
              <planeGeometry args={[2.9, 1.05]} />
              <primitive object={frondMat()} attach="material" />
            </mesh>
          </group>
        ))}
        <mesh position={[0.12, -0.14, 0.06]}><sphereGeometry args={[0.15, 7, 6]} /><meshStandardMaterial color="#6b4a2f" roughness={0.9} /></mesh>
        <mesh position={[-0.14, -0.17, -0.05]}><sphereGeometry args={[0.13, 7, 6]} /><meshStandardMaterial color="#75552f" roughness={0.9} /></mesh>
      </group>
    </group>
  );
}

interface XForm { p: [number, number, number]; s: [number, number, number]; }
function buildInstanced(geo: THREE.BufferGeometry, mat: THREE.Material, items: XForm[]): THREE.InstancedMesh {
  const im = new THREE.InstancedMesh(geo, mat, items.length);
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const one = new THREE.Vector3();
  items.forEach((it, i) => {
    m.compose(new THREE.Vector3(...it.p), q, new THREE.Vector3(...it.s));
    im.setMatrixAt(i, m);
  });
  void one;
  im.instanceMatrix.needsUpdate = true;
  im.frustumCulled = false;
  im.receiveShadow = true;
  return im;
}

let seed = 31;
const srnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/** Phase 4: robbery register counters + the Coral pawn shop frontage. */
function ShopFronts({ night }: { night: number }) {
  const shutters = useRef<Array<THREE.Mesh | null>>([]);
  const pawnTex = useMemo(() => makeSignTexture("CORAL PAWN · WE BUY GOLD", "#3a2c10", "#ffd34d", 512), []);
  const shopTex = useMemo(() => makeSignTexture("CORAL SHORES GOODS", "#12303f", "#ffe9c9", 512), []);
  useFrame(() => {
    REGISTERS.forEach((r, i) => {
      const s = shutters.current[i];
      if (s) s.visible = (G.robbedUntil[r.id] ?? 0) > G.timeS;
    });
  });
  return (
    <group>
      {REGISTERS.map((r, i) => (
        <group key={r.id} position={[r.x, 0, r.z]}>
          {/* counter with a till on top */}
          <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[1.7, 1.1, 0.7]} /><meshStandardMaterial color="#4c3b28" roughness={0.8} /></mesh>
          <mesh position={[0.3, 1.22, 0]}><boxGeometry args={[0.5, 0.24, 0.4]} /><meshStandardMaterial color="#2c3138" metalness={0.5} roughness={0.4} /></mesh>
          <mesh position={[0.3, 1.37, 0]}><boxGeometry args={[0.34, 0.06, 0.3]} /><meshStandardMaterial color="#ffb703" emissive="#ffb703" emissiveIntensity={0.4 + night * 0.8} /></mesh>
          {/* robbed shutter (drops after a robbery, lifts next day) */}
          <mesh ref={(n) => { shutters.current[i] = n; }} position={[0, 1.5, -0.55]} visible={false}>
            <boxGeometry args={[2.4, 3, 0.08]} /><meshStandardMaterial color="#3c4249" metalness={0.55} roughness={0.5} />
          </mesh>
        </group>
      ))}
      {/* Coral Shores Goods building (register shop) */}
      <group position={[48, 0, 218]}>
        <mesh position={[0, 2.1, 0]} castShadow receiveShadow><boxGeometry args={[10, 4.2, 6.8]} /><meshStandardMaterial color="#77644c" roughness={0.9} /></mesh>
        <mesh position={[0, 4.35, 0]}><boxGeometry args={[10.4, 0.3, 7.2]} /><meshStandardMaterial color="#14524f" roughness={0.85} /></mesh>
        <mesh position={[0, 3.1, -3.46]}><planeGeometry args={[7.6, 1.1]} /><meshStandardMaterial map={shopTex} emissive="#ffffff" emissiveMap={shopTex} emissiveIntensity={0.2 + night * 0.7} /></mesh>
        <mesh position={[0, 1.15, -3.44]}><boxGeometry args={[8.6, 2.3, 0.06]} /><meshStandardMaterial color="#22303a" roughness={0.2} metalness={0.4} emissive="#ffca7a" emissiveIntensity={night * 0.25} /></mesh>
      </group>
      {/* Coral Pawn building + counter */}
      <group position={[88, 0, 218]}>
        <mesh position={[0, 2.3, 0]} castShadow receiveShadow><boxGeometry args={[10, 4.6, 6.8]} /><meshStandardMaterial color="#5d5142" roughness={0.9} /></mesh>
        <mesh position={[0, 4.75, 0]}><boxGeometry args={[10.4, 0.3, 7.2]} /><meshStandardMaterial color="#3a2c10" roughness={0.85} /></mesh>
        <mesh position={[0, 3.3, -3.46]}><planeGeometry args={[8.2, 1.1]} /><meshStandardMaterial map={pawnTex} emissive="#ffffff" emissiveMap={pawnTex} emissiveIntensity={0.25 + night * 0.9} /></mesh>
        <mesh position={[0, 1.15, -3.44]}><boxGeometry args={[8.6, 2.3, 0.06]} /><meshStandardMaterial color="#22303a" roughness={0.2} metalness={0.4} emissive="#ffca7a" emissiveIntensity={night * 0.25} /></mesh>
      </group>
      <group position={[PAWN_SHOP.x, 0, PAWN_SHOP.z]}>
        <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[1.9, 1.1, 0.7]} /><meshStandardMaterial color="#3a2c10" roughness={0.8} /></mesh>
        <mesh position={[-0.4, 1.2, 0]}><boxGeometry args={[0.4, 0.18, 0.34]} /><meshStandardMaterial color="#ffd34d" metalness={0.8} roughness={0.3} /></mesh>
      </group>
    </group>
  );
}

export default function World({ theme, night }: { theme: GameTheme; night: number }) {
  const water = useRef<THREE.MeshStandardMaterial>(null);
  const wheelSpin = useRef<THREE.Group>(null);
  const cabins = useRef<Array<THREE.Group | null>>([]);
  const boats = useRef<Array<THREE.Group | null>>([]);
  const ambHeli = useRef<THREE.Group>(null);
  const ambRotor = useRef<THREE.Mesh>(null);
  const domeMat = useRef<THREE.MeshBasicMaterial>(null);
  const winTex = useMemo(makeWindowTexture, []);
  const signTex = useMemo(() => SIGNS.map((s) => makeSignTexture(s.text, s.bg, s.fg)), []);
  const hillTex = useMemo(makeHillSignTexture, []);
  const skyTex = useMemo(makeSkyTexture, []);
  const gantryTex = useMemo(() => makeSignTexture("Downtown · Lantern Beach · PS Airport →", "#14532d", "#ffffff", 1024), []);
  const clubTex = useMemo(() => makeSignTexture("CLUB SOLACE", "#12081f", "#c9a7ff", 512), []);
  const neonTex = useMemo(() => [
    neonSignTexture("HOTEL SABLE", "#2ee6c8"), neonSignTexture("PALMS", "#ffb340"), neonSignTexture("CAFE", "#ff5347"),
    neonSignTexture("CLUB SOLACE", "#2ee6c8"),
  ], []);
  const streetTex = useMemo(() => STREET_SIGNS.map((s) => streetSignTexture(s.text)), []);
  const grassTex = useMemo(() => grassTexture(), []);
  const sandTex = useMemo(() => sandTexture(), []);
  const glowTexW = useMemo(() => glowTexture(), []);
  const sunDiscRef = useRef<THREE.Group>(null);
  const cloudGroup = useRef<THREE.Group>(null);
  const cloudMaterial = useMemo(() => new THREE.SpriteMaterial({ map: cloudTexture(), transparent: true, opacity: 0.55, depthWrite: false, fog: false }), []);
  const lampGlowMat = useRef<THREE.PointsMaterial>(null);
  const lampGlowGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(lamps.length * 3);
    lamps.forEach(([x, , z], i) => { arr[i * 3] = x; arr[i * 3 + 1] = 5.6; arr[i * 3 + 2] = z; });
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  const clouds = useMemo(() => Array.from({ length: 11 }, (_, i) => {
    const a = (i / 11) * Math.PI * 2 + srnd() * 0.5;
    const r = 70 + srnd() * 110;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r - 20, y: 58 + srnd() * 30, s: 46 + srnd() * 42, drift: 0.5 + srnd() * 0.7 };
  }), []);
  const fuelTex = useMemo(() => FUEL_STATIONS.map((s) => makeSignTexture(`⛽ FUEL · ${s.name.toUpperCase()}`, "#7a1f1f", "#ffe9c9", 512)), []);
  const overlookTex = useMemo(() => makeSignTexture("PORT SABLE OVERLOOK", "#12303f", "#f2c14e", 512), []);

  // ---- ground materials (wet-look at night: roughness drops as night rises)
  // Visual V2: procedural normal + roughness maps so surfaces catch light
  // directionally instead of reading flat.
  const mats = useMemo(() => {
    const rough = 0.96 - night * 0.5;
    const aV = asphaltTexture(); aV.repeat.set(1, 20);
    const aH = asphaltTextureH(); aH.repeat.set(1, 20);
    const cV = concreteTexture(); cV.repeat.set(1, 60);
    const cH = concreteTextureH(); cH.repeat.set(1, 60);
    const aNV = asphaltNormal(); aNV.repeat.set(1, 20);
    const aNH = asphaltNormal().clone(); aNH.center.set(0.5, 0.5); aNH.rotation = Math.PI / 2; aNH.repeat.set(1, 20); aNH.needsUpdate = true;
    const aRV = asphaltRoughness(); aRV.repeat.set(1, 20);
    const aRH = asphaltRoughness().clone(); aRH.center.set(0.5, 0.5); aRH.rotation = Math.PI / 2; aRH.repeat.set(1, 20); aRH.needsUpdate = true;
    const cNV = concreteNormal(); cNV.repeat.set(1, 60);
    const cNH = concreteNormal().clone(); cNH.center.set(0.5, 0.5); cNH.rotation = Math.PI / 2; cNH.repeat.set(1, 60); cNH.needsUpdate = true;
    const cRV = concreteRoughness(); cRV.repeat.set(1, 60);
    const nScale = new THREE.Vector2(0.55, 0.55);
    return {
      asphaltV: new THREE.MeshStandardMaterial({ map: aV, normalMap: aNV, normalScale: nScale, roughnessMap: aRV, roughness: rough, metalness: 0.04 + night * 0.1 }),
      asphaltH: new THREE.MeshStandardMaterial({ map: aH, normalMap: aNH, normalScale: nScale, roughnessMap: aRH, roughness: rough, metalness: 0.04 + night * 0.1 }),
      concreteV: new THREE.MeshStandardMaterial({ map: cV, normalMap: cNV, normalScale: nScale, roughnessMap: cRV, color: "#b0aa9e", roughness: 0.95 }),
      concreteH: new THREE.MeshStandardMaterial({ map: cH, normalMap: cNH, normalScale: nScale, color: "#b0aa9e", roughness: 0.95 }),
      curb: new THREE.MeshStandardMaterial({ map: cV, normalMap: cNV, normalScale: nScale, color: "#8f8a80", roughness: 0.95 }),
      edge: new THREE.MeshStandardMaterial({ color: "#e9e7de", roughness: 0.7, transparent: true, opacity: 0.78 }),
      yellow: new THREE.MeshStandardMaterial({ color: "#d9a41c", roughness: 0.7, transparent: true, opacity: 0.92 }),
    };
  }, [night]);

  // ---- instanced street furniture of the road surface itself
  const markings = useMemo(() => {
    const dashMat = new THREE.MeshStandardMaterial({ color: "#e8e6da", roughness: 0.7, transparent: true, opacity: 0.82 });
    const dashes: XForm[] = []; const stripes: XForm[] = []; const holes: XForm[] = []; const patches: XForm[] = []; const drains: XForm[] = [];
    for (const c of ROAD_COORDS) {
      for (const off of [-3, 3]) for (let t = -116; t <= 116; t += 8) {
        dashes.push({ p: [c + off, 0.078, t], s: [0.16, 0.018, 3] });
        dashes.push({ p: [t, 0.078, c + off], s: [3, 0.018, 0.16] });
      }
      for (let k = 0; k < 6; k++) {
        const t = -95 + k * 38;
        holes.push({ p: [c + (k % 2 ? 1.7 : -1.7), 0.072, t], s: [1, 1, 1] });
        holes.push({ p: [t, 0.072, c + (k % 2 ? -1.7 : 1.7)], s: [1, 1, 1] });
      }
    }
    for (const ix of ROAD_COORDS) for (const iz of ROAD_COORDS) {
      for (let sx = -4.5; sx <= 4.5; sx += 1.5) {
        stripes.push({ p: [ix + sx, 0.076, iz - 8.4], s: [0.72, 0.018, 3.2] });
        stripes.push({ p: [ix + sx, 0.076, iz + 8.4], s: [0.72, 0.018, 3.2] });
        stripes.push({ p: [ix - 8.4, 0.076, iz + sx], s: [3.2, 0.018, 0.72] });
        stripes.push({ p: [ix + 8.4, 0.076, iz + sx], s: [3.2, 0.018, 0.72] });
      }
      drains.push({ p: [ix + 6.35, 0.07, iz - 7.4], s: [1, 1, 1] });
      drains.push({ p: [ix - 6.35, 0.07, iz + 7.4], s: [1, 1, 1] });
      // stop bars just before each crosswalk entry (Phase 3)
      stripes.push({ p: [ix + 2.8, 0.076, iz - 9.9], s: [2.7, 0.018, 0.55] });
      stripes.push({ p: [ix - 2.8, 0.076, iz + 9.9], s: [2.7, 0.018, 0.55] });
      stripes.push({ p: [ix - 9.9, 0.076, iz + 2.8], s: [0.55, 0.018, 2.7] });
      stripes.push({ p: [ix + 9.9, 0.076, iz - 2.8], s: [0.55, 0.018, 2.7] });
    }
    for (let i = 0; i < 44; i++) {
      const c = ROAD_COORDS[Math.floor(srnd() * 6)]; const along = -110 + srnd() * 220; const off = (srnd() - 0.5) * 7;
      if (i % 2) patches.push({ p: [c + off, 0.074, along], s: [2 + srnd() * 2.5, 1, 1.6 + srnd() * 2] });
      else patches.push({ p: [along, 0.074, c + off], s: [1.6 + srnd() * 2, 1, 2 + srnd() * 2.5] });
    }
    return {
      dashes: buildInstanced(new THREE.BoxGeometry(1, 1, 1), dashMat, dashes),
      stripes: buildInstanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: "#f2f0e8", roughness: 0.75, transparent: true, opacity: 0.6 }), stripes),
      holes: buildInstanced(new THREE.CylinderGeometry(0.5, 0.5, 0.03, 14), new THREE.MeshStandardMaterial({ color: "#1d1e20", roughness: 0.55, metalness: 0.35 }), holes),
      patches: buildInstanced(new THREE.BoxGeometry(1, 0.016, 1), new THREE.MeshStandardMaterial({ color: "#232326", roughness: 1 }), patches),
      drains: buildInstanced(new THREE.BoxGeometry(0.4, 0.05, 1.1), new THREE.MeshStandardMaterial({ color: "#17181a", roughness: 0.6, metalness: 0.3 }), drains),
    };
  }, []);

  // ---- Phase 3 ground decals: direction arrows at every intersection
  // approach, oil stains on the asphalt, and rain puddles (opacity follows
  // G.rainAmt in useFrame). All instanced — 3 draw calls total.
  const puddleMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#33424e", roughness: 0.05, metalness: 0.4, envMapIntensity: 1.6,
    transparent: true, opacity: 0, depthWrite: false,
  }), []);
  const decals = useMemo(() => {
    const build = (geo: THREE.BufferGeometry, mat: THREE.Material, items: { x: number; z: number; s: number; sy?: number; ry: number }[]) => {
      const im = new THREE.InstancedMesh(geo, mat, items.length);
      const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler();
      items.forEach((it, i) => {
        e.set(-Math.PI / 2, it.ry, 0, "YXZ"); q.setFromEuler(e);
        m.compose(new THREE.Vector3(it.x, 0.082, it.z), q, new THREE.Vector3(it.s, it.sy ?? it.s, 1));
        im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; im.receiveShadow = true;
      return im;
    };
    const arrows: { x: number; z: number; s: number; sy?: number; ry: number }[] = [];
    for (const ix of ROAD_COORDS) for (const iz of ROAD_COORDS) {
      arrows.push({ x: ix + 2.8, z: iz - 11.5, s: 1.5, sy: 3, ry: Math.PI });   // travelling +z
      arrows.push({ x: ix - 2.8, z: iz + 11.5, s: 1.5, sy: 3, ry: 0 });          // travelling -z
      arrows.push({ x: ix - 11.5, z: iz + 2.8, s: 1.5, sy: 3, ry: -Math.PI / 2 }); // travelling +x
      arrows.push({ x: ix + 11.5, z: iz - 2.8, s: 1.5, sy: 3, ry: Math.PI / 2 });  // travelling -x
    }
    const oils: { x: number; z: number; s: number; ry: number }[] = [];
    const puddles: { x: number; z: number; s: number; sy?: number; ry: number }[] = [];
    for (let i = 0; i < 36; i++) {
      const c = ROAD_COORDS[Math.floor(srnd() * 6)]; const along = -108 + srnd() * 216; const off = (srnd() - 0.5) * 7.5;
      if (i % 2) oils.push({ x: c + off, z: along, s: 1.6 + srnd() * 2.4, ry: srnd() * 3 });
      else oils.push({ x: along, z: c + off, s: 1.6 + srnd() * 2.4, ry: srnd() * 3 });
    }
    for (let i = 0; i < 22; i++) {
      const c = ROAD_COORDS[Math.floor(srnd() * 6)]; const along = -105 + srnd() * 210; const off = (srnd() - 0.5) * 6.5;
      if (i % 2) puddles.push({ x: c + off, z: along, s: 1.8 + srnd() * 2.2, sy: 1.2 + srnd() * 1.6, ry: srnd() * 3 });
      else puddles.push({ x: along, z: c + off, s: 1.8 + srnd() * 2.2, sy: 1.2 + srnd() * 1.6, ry: srnd() * 3 });
    }
    // Visual V3: tyre-mark darkening swept through intersection corners
    const tyres: { x: number; z: number; s: number; sy?: number; ry: number }[] = [];
    for (const ix of ROAD_COORDS) for (const iz of ROAD_COORDS) {
      tyres.push({ x: ix + 4.4, z: iz - 4.6, s: 1.1, sy: 4.6, ry: 0.5 });
      tyres.push({ x: ix - 4.6, z: iz + 4.4, s: 1.1, sy: 4.6, ry: Math.PI + 0.5 });
      tyres.push({ x: ix - 4.4, z: iz - 4.6, s: 1.1, sy: 4.6, ry: -0.5 });
      tyres.push({ x: ix + 4.6, z: iz + 4.4, s: 1.1, sy: 4.6, ry: Math.PI - 0.5 });
    }
    return {
      arrows: build(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: arrowTexture(), transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), arrows),
      oils: build(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: oilTexture(), transparent: true, roughness: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), oils),
      puddles: build(new THREE.CircleGeometry(0.5, 14), puddleMat, puddles),
      tyres: build(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: oilTexture(), color: "#0c0c0e", transparent: true, opacity: 0.5, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), tyres),
    };
  }, [puddleMat]);

  // ---- Phase 3 street-prop scatter (instanced): grass tufts, trash bins,
  // mail boxes, planters, port cones — density sells the street level.
  const streetProps = useMemo(() => {
    const onRoad = (x: number, z: number, m: number) => ROAD_COORDS.some((c) => Math.abs(x - c) < 6 + m || Math.abs(z - c) < 6 + m);
    const inBuilding = (x: number, z: number) => buildings.some((b) => Math.abs(x - b.x) < b.width / 2 + 1.2 && Math.abs(z - b.z) < b.depth / 2 + 1.2);
    const tufts: XForm[] = [];
    let guard = 0;
    while (tufts.length < 300 && guard++ < 3000) {
      const x = -116 + srnd() * 232, z = -116 + srnd() * 228;
      if (onRoad(x, z, 1.6) || inBuilding(x, z) || z > 112) continue;
      if (Math.abs(x - MANSION.x) < 10 && Math.abs(z - MANSION.z) < 9) continue;
      tufts.push({ p: [x, 0.14, z], s: [0.8 + srnd() * 0.9, 0.8 + srnd() * 1.1, 0.8 + srnd() * 0.9] });
    }
    const bins: XForm[] = []; const mails: XForm[] = []; const planters: XForm[] = []; const planterBush: XForm[] = [];
    for (let i = 0; i < 18; i++) {
      const c = ROAD_COORDS[i % 6]; const along = -102 + ((i * 41) % 204); const side = i % 2 ? 7.7 : -7.7;
      if (i % 2) bins.push({ p: [c + side, 0.42, along], s: [1, 1, 1] }); else bins.push({ p: [along, 0.42, c + side], s: [1, 1, 1] });
    }
    for (let i = 0; i < 8; i++) {
      const c = ROAD_COORDS[(i + 2) % 6]; const along = -88 + ((i * 53) % 176); const side = i % 2 ? -7.7 : 7.7;
      if (i % 2) mails.push({ p: [along, 0.5, c + side], s: [1, 1, 1] }); else mails.push({ p: [c + side, 0.5, along], s: [1, 1, 1] });
    }
    for (let i = 0; i < 10; i++) {
      const bx = [-40, 0, 40][i % 3], bz = [-40, 0, 40][Math.floor(i / 3) % 3];
      const x = bx + (i % 2 ? 16.5 : -16.5), z = bz + 16.5;
      planters.push({ p: [x, 0.28, z], s: [1, 1, 1] });
      planterBush.push({ p: [x, 0.72, z], s: [1, 1, 1] });
    }
    const cones: XForm[] = [];
    for (let i = 0; i < 14; i++) cones.push({ p: [38 + srnd() * 40, 0.3, 102 + srnd() * 9], s: [1, 1, 1] });
    return {
      tufts: buildInstanced(new THREE.ConeGeometry(0.1, 0.36, 5), new THREE.MeshStandardMaterial({ color: "#2e5c2c", roughness: 1 }), tufts),
      bins: buildInstanced(new THREE.CylinderGeometry(0.34, 0.3, 0.84, 10), new THREE.MeshStandardMaterial({ color: "#2c4a3a", roughness: 0.7, metalness: 0.3 }), bins),
      mails: buildInstanced(new THREE.BoxGeometry(0.62, 1, 0.5), new THREE.MeshStandardMaterial({ color: "#274b8f", roughness: 0.5, metalness: 0.3 }), mails),
      planters: buildInstanced(new THREE.BoxGeometry(1.5, 0.55, 0.65), new THREE.MeshStandardMaterial({ color: "#5d4a38", roughness: 0.9 }), planters),
      planterBush: buildInstanced(new THREE.IcosahedronGeometry(0.48, 1), new THREE.MeshStandardMaterial({ color: "#2c5f42", roughness: 0.95 }), planterBush),
      cones: buildInstanced(new THREE.ConeGeometry(0.22, 0.62, 9), new THREE.MeshStandardMaterial({ color: "#e86a17", roughness: 0.6 }), cones),
    };
  }, []);

  // ---- traffic light lamp materials (cycled in useFrame)
  const lightMats = useMemo(() => LIGHT_SPOTS.map(() => {
    const mk = (emissive: string) => new THREE.MeshStandardMaterial({ color: "#191b1d", emissive, emissiveIntensity: 0.1, roughness: 0.4 });
    return { r: mk("#ff3b30"), a: mk("#ffb340"), g: mk("#2fe07a") };
  }), []);

  // ---- building materials: facade / brick / glass towers, cached
  const buildingMats = useMemo(() => {
    const cache = new Map<string, THREE.MeshStandardMaterial>();
    return buildings.map((b) => {
      const kind = b.glass ? "glass" : b.height < 15 ? "brick" : "facade";
      const key = `${kind}|${b.color}`;
      let m = cache.get(key);
      if (!m) {
        m = kind === "glass"
          ? new THREE.MeshStandardMaterial({ color: "#39657f", map: facadeTexture(), normalMap: facadeNormal(), normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.1, metalness: 0.6, envMapIntensity: 1.25 })
          : new THREE.MeshStandardMaterial({ color: b.color, map: kind === "brick" ? brickTexture() : facadeTexture(), normalMap: kind === "brick" ? brickNormal() : facadeNormal(), normalScale: new THREE.Vector2(0.65, 0.65), roughness: 0.92 });
        cache.set(key, m);
      }
      return m;
    });
  }, []);
  const winMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#ffffff", emissive: new THREE.Color(theme.windowGlow), emissiveMap: winTex, map: winTex,
    emissiveIntensity: 0.25 + night * 1.3, roughness: 0.85,
  }), [winTex, theme.windowGlow, night]);
  const containerMat = useMemo(() => CONTAINER_COLORS.map((col) =>
    new THREE.MeshStandardMaterial({ color: col, map: containerTexture(), roughness: 0.6, metalness: 0.35 })), []);

  // ---- nightclub queue: 3 static humanoids idling outside Club Solace
  const clubQueue = useMemo<HumanoidRig[]>(() => [
    buildHumanoid({ top: "#26262b", bottom: "#1d2126", skin: "#c68863", hair: "#14100e", topStyle: "hoodie", gender: "m", hairStyle: "flat" }),
    buildHumanoid({ top: "#7a2440", bottom: "#e8e4da", skin: "#f1c27d", hair: "#2d1d12", topStyle: "crop", bottomStyle: "shorts", gender: "f", hairStyle: "ponytail", necklace: true }),
    buildHumanoid({ top: "#e8e4da", bottom: "#274268", skin: "#8d5524", hair: "#14100e", topStyle: "tank", gender: "m", hairStyle: "cap", tattooSleeve: true, sunglasses: true }),
  ], []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (water.current) {
      water.current.emissiveIntensity = 0.15 + Math.sin(t * 1.4) * 0.08;
      water.current.color.set(theme.water).offsetHSL(0, 0, Math.sin(t * 0.7) * 0.02);
      // Visual V5: drifting ripple normals — the surface actually moves
      if (water.current.normalMap) {
        water.current.normalMap.offset.set(t * 0.008, t * 0.005);
      }
    }
    if (domeMat.current) {
      const base = theme.id === "midnight" ? "#3a4a68" : theme.id === "noir" ? "#9a9a9a" : "#ffffff";
      domeMat.current.color.set(base).multiplyScalar(1 - night * 0.45);
    }
    // traffic lights: 12s cycle, cross streets offset by half a cycle
    lightMats.forEach((lm, i) => {
      const local = (t + (i % 2) * 6) % 12;
      lm.g.emissiveIntensity = local < 5.5 ? 2.4 : 0.1;
      lm.a.emissiveIntensity = local >= 5.5 && local < 7 ? 2.4 : 0.1;
      lm.r.emissiveIntensity = local >= 7 ? 2.4 : 0.1;
    });
    // ferris wheel
    if (wheelSpin.current) wheelSpin.current.rotation.z = t * 0.18;
    cabins.current.forEach((cab, i) => {
      if (!cab) return;
      const a = t * 0.18 + (i * Math.PI) / 4;
      cab.position.set(26 + Math.cos(a) * 7.5, 9.6 + Math.sin(a) * 7.5, 123);
    });
    // boats bobbing
    boats.current.forEach((b, i) => {
      if (!b) return;
      b.position.y = Math.sin(t * 0.8 + i * 2.1) * 0.16;
      b.rotation.z = Math.sin(t * 0.6 + i * 1.7) * 0.02;
      b.rotation.x = Math.sin(t * 0.5 + i) * 0.012;
    });
    // ambient helicopter circling downtown/harbour
    if (ambHeli.current) {
      const a = t * 0.05;
      ambHeli.current.position.set(Math.cos(a) * 85, 36 + Math.sin(t * 0.5) * 2, Math.sin(a) * 85);
      ambHeli.current.rotation.y = -a;
      if (ambRotor.current) ambRotor.current.rotation.y = t * 28;
    }
    // club queue idle sway
    clubQueue.forEach((rig, i) => animateHumanoid(rig, 0, 0, t + i * 2.4));
    // rain gloss: wet asphalt gets darker + shinier as rain builds up;
    // at night in rain it goes near-mirror (target: wet neon streets)
    const wet = 1 - G.rainAmt * (0.5 + night * 0.38);
    let rough = (0.96 - night * 0.5) * wet;
    if (night > 0.45 && G.rainAmt > 0.25) rough = Math.max(0.15, rough);
    mats.asphaltV.roughness = rough;
    mats.asphaltH.roughness = rough;
    mats.asphaltV.metalness = 0.04 + night * 0.1 + G.rainAmt * 0.12;
    mats.asphaltH.metalness = mats.asphaltV.metalness;
    // rain puddles fade in with the weather (Phase 3)
    puddleMat.opacity = G.rainAmt * 0.88;
    // sun disc + warm glow riding the day cycle (low amber disc at dusk)
    if (sunDiscRef.current) {
      const ang = G.dayTime * Math.PI * 2 - Math.PI / 2;
      const el = Math.sin(ang);
      sunDiscRef.current.position.set(Math.cos(ang) * 172, Math.max(4, el * 148), 46);
      sunDiscRef.current.visible = el > -0.06;
      const warm = THREE.MathUtils.clamp(1 - Math.abs(el) * 2.2, 0.25, 1);
      sunDiscRef.current.children.forEach((ch) => {
        const m = (ch as THREE.Mesh).material as THREE.MeshBasicMaterial | THREE.SpriteMaterial;
        if ("color" in m) m.color.setHSL(0.09 + warm * 0.03, 0.85, 0.55 + (1 - warm) * 0.12);
      });
    }
    // clouds: slow drift + dusk tint (warm coral at golden hour, grey in rain)
    {
      const ang2 = G.dayTime * Math.PI * 2 - Math.PI / 2;
      const el2 = Math.sin(ang2);
      const duskiness = THREE.MathUtils.clamp(1 - Math.abs(el2) * 2.4, 0, 1);
      const base = new THREE.Color("#f4f6f8").lerp(new THREE.Color("#ffab7a"), duskiness * 0.75);
      base.lerp(new THREE.Color("#5d6a76"), G.fogAmt * 0.55 + G.rainAmt * 0.3);
      base.multiplyScalar(1 - night * 0.5);
      cloudMaterial.color.copy(base);
      cloudMaterial.opacity = 0.5 + G.fogAmt * 0.25;
      if (cloudGroup.current) cloudGroup.current.position.x = (t * 0.55) % 30;
    }
    // streetlight glow halos (one Points draw): stronger on wet nights
    if (lampGlowMat.current) lampGlowMat.current.opacity = night * (0.3 + G.rainAmt * 0.3);
  });

  return (
    <group>
      {/* gradient sky dome (tinted by theme + night) */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[195, 20, 14]} />
        <meshBasicMaterial ref={domeMat} map={skyTex} side={THREE.BackSide} fog={false} depthWrite={false} />
      </mesh>
      {/* sun disc + halo (positioned by the day cycle in useFrame) */}
      <group ref={sunDiscRef}>
        <mesh>
          <circleGeometry args={[9, 24]} />
          <meshBasicMaterial color="#ffd9a0" fog={false} depthWrite={false} transparent opacity={0.95} />
        </mesh>
        <sprite scale={[64, 64, 1]}>
          <spriteMaterial map={glowTexW} color="#ffb066" transparent opacity={0.55} fog={false} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
      {/* drifting clouds — soft billboards, tinted warm at dusk */}
      <group ref={cloudGroup}>
        {clouds.map((cl, i) => (
          <sprite key={i} position={[cl.x, cl.y, cl.z]} scale={[cl.s, cl.s * 0.42, 1]}>
            <primitive object={cloudMaterial} attach="material" />
          </sprite>
        ))}
      </group>
      {/* streetlight halos — single Points draw, opacity driven at night */}
      <points geometry={lampGlowGeo} frustumCulled={false}>
        <pointsMaterial ref={lampGlowMat} map={glowTexW} color={theme.lampGlow} size={6} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
      {/* ground / grass — deep noisy grass texture (no more flat green) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.09, 0]} receiveShadow>
        <planeGeometry args={[290, 300]} /><meshStandardMaterial map={grassTex} normalMap={grassNormal()} normalScale={new THREE.Vector2(0.5, 0.5)} roughness={1} />
      </mesh>
      {/* beach sand — warm textured sand */}
      <mesh position={[0, 0.0, 121]} receiveShadow><boxGeometry args={[290, 0.1, 14]} /><meshStandardMaterial map={sandTex} normalMap={sandNormal()} normalScale={new THREE.Vector2(0.5, 0.5)} roughness={1} /></mesh>
      {/* harbour + bay water — one sheet from Port Sable beach around Coral
          Shores (animated emissive shimmer + drifting ripple normals) */}
      <mesh position={[0, -0.05, WATER_Z + 118]} receiveShadow>
        <boxGeometry args={[560, 0.08, 236]} />
        <meshStandardMaterial ref={water} color={theme.water} emissive={theme.water} emissiveIntensity={0.2} roughness={0.35} metalness={0.1} normalMap={sandNormal()} normalScale={new THREE.Vector2(0.32, 0.32)} />
      </mesh>
      {/* ======== CORAL SHORES landmass (Phase 4): island slab + beach + grid ======== */}
      <mesh position={[70, -0.22, 260]} receiveShadow>
        <boxGeometry args={[92, 0.5, 140]} /><meshStandardMaterial map={grassTex} normalMap={grassNormal()} normalScale={new THREE.Vector2(0.5, 0.5)} color="#b9c4a4" roughness={1} />
      </mesh>
      <mesh position={[70, 0.02, 202.5]} receiveShadow>
        <boxGeometry args={[92, 0.12, 13]} /><meshStandardMaterial map={sandTex} normalMap={sandNormal()} normalScale={new THREE.Vector2(0.5, 0.5)} roughness={1} />
      </mesh>
      {CORAL_ROAD_X.map((c) => (
        <mesh key={`cx${c}`} position={[c, 0.06, 260]} receiveShadow><boxGeometry args={[ROAD_WIDTH, 0.12, 128]} /><primitive object={mats.asphaltV} attach="material" /></mesh>
      ))}
      {CORAL_ROAD_Z.map((c) => (
        <mesh key={`cz${c}`} position={[70, 0.06, c]} receiveShadow><boxGeometry args={[84, 0.12, ROAD_WIDTH]} /><primitive object={mats.asphaltH} attach="material" /></mesh>
      ))}
      {/* pier */}
      <mesh position={[0, 0.06, 122]} receiveShadow><boxGeometry args={[10, 0.16, 16]} /><meshStandardMaterial color="#8a6b48" /></mesh>

      {/* ======== STREETS ======== */}
      {ROAD_COORDS.map((c) => (
        <group key={c}>
          <mesh position={[c, 0.01, 0]} receiveShadow><boxGeometry args={[ROAD_WIDTH, 0.12, 248]} /><primitive object={mats.asphaltV} attach="material" /></mesh>
          <mesh position={[0, 0.01, c]} receiveShadow><boxGeometry args={[248, 0.12, ROAD_WIDTH]} /><primitive object={mats.asphaltH} attach="material" /></mesh>
          {/* worn white edge lines */}
          {[-5.55, 5.55].map((o) => (
            <group key={`e${o}`}>
              <mesh position={[c + o, 0.072, 0]}><boxGeometry args={[0.18, 0.018, 248]} /><primitive object={mats.edge} attach="material" /></mesh>
              <mesh position={[0, 0.072, c + o]}><boxGeometry args={[248, 0.018, 0.18]} /><primitive object={mats.edge} attach="material" /></mesh>
            </group>
          ))}
          {/* double-yellow centre lines */}
          {[-0.34, 0.34].map((o) => (
            <group key={`y${o}`}>
              <mesh position={[c + o, 0.073, 0]}><boxGeometry args={[0.15, 0.018, 248]} /><primitive object={mats.yellow} attach="material" /></mesh>
              <mesh position={[0, 0.073, c + o]}><boxGeometry args={[248, 0.018, 0.15]} /><primitive object={mats.yellow} attach="material" /></mesh>
            </group>
          ))}
          {/* raised sidewalks + curbs */}
          {[-7.5, 7.5].map((o) => (
            <group key={`s${o}`}>
              <mesh position={[c + o, 0.03, 0]} receiveShadow><boxGeometry args={[2.4, 0.14, 248]} /><primitive object={mats.concreteV} attach="material" /></mesh>
              <mesh position={[0, 0.03, c + o]} receiveShadow><boxGeometry args={[248, 0.14, 2.4]} /><primitive object={mats.concreteH} attach="material" /></mesh>
              <mesh position={[c + (o < 0 ? 6.18 : -6.18), 0.04, 0]} receiveShadow><boxGeometry args={[0.55, 0.2, 248]} /><primitive object={mats.curb} attach="material" /></mesh>
              <mesh position={[0, 0.04, c + (o < 0 ? 6.18 : -6.18)]} receiveShadow><boxGeometry args={[248, 0.2, 0.55]} /><primitive object={mats.curb} attach="material" /></mesh>
            </group>
          ))}
        </group>
      ))}
      <primitive object={markings.dashes} />
      <primitive object={markings.stripes} />
      <primitive object={markings.holes} />
      <primitive object={markings.patches} />
      <primitive object={markings.drains} />
      <primitive object={decals.arrows} />
      <primitive object={decals.oils} />
      <primitive object={decals.puddles} />
      <primitive object={decals.tyres} />

      {/* traffic lights at 8 intersections (cycling) */}
      {LIGHT_SPOTS.map(([ix, iz], i) => (
        <group key={i} position={[ix + 7.1, 0, iz + 7.1]}>
          <mesh position={[0, 2.3, 0]} castShadow><cylinderGeometry args={[0.07, 0.09, 4.6, 6]} /><meshStandardMaterial color="#22282c" /></mesh>
          <mesh position={[-1.6, 4.55, 0]}><boxGeometry args={[3.4, 0.12, 0.12]} /><meshStandardMaterial color="#22282c" /></mesh>
          <mesh position={[-3.1, 4.1, 0]}><boxGeometry args={[0.36, 1.1, 0.32]} /><meshStandardMaterial color="#14161a" /></mesh>
          <mesh position={[-3.1, 4.42, 0.19]}><sphereGeometry args={[0.115, 8, 8]} /><primitive object={lightMats[i].r} attach="material" /></mesh>
          <mesh position={[-3.1, 4.1, 0.19]}><sphereGeometry args={[0.115, 8, 8]} /><primitive object={lightMats[i].a} attach="material" /></mesh>
          <mesh position={[-3.1, 3.78, 0.19]}><sphereGeometry args={[0.115, 8, 8]} /><primitive object={lightMats[i].g} attach="material" /></mesh>
        </group>
      ))}
      {/* street-name blade signs */}
      {STREET_SIGNS.map((s, i) => (
        <group key={i} position={[s.pos[0], 0, s.pos[1]]} rotation={[0, s.rot, 0]}>
          <mesh position={[0, 1.5, 0]}><cylinderGeometry args={[0.05, 0.05, 3, 6]} /><meshStandardMaterial color="#2c3438" /></mesh>
          <mesh position={[0, 2.95, 0]}>
            <planeGeometry args={[3.4, 0.64]} />
            <meshStandardMaterial map={streetTex[i]} emissive="#ffffff" emissiveMap={streetTex[i]} emissiveIntensity={0.12 + night * 0.5} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* neon blade signs — Market Row corners */}
      {[
        { tex: 0, pos: [26.8, 26.8] as const }, { tex: 1, pos: [-26.8, -26.8] as const }, { tex: 2, pos: [26.8, -26.8] as const },
      ].map((n, i) => (
        <group key={i} position={[n.pos[0], 0, n.pos[1]]}>
          <mesh position={[0, 2.6, 0]}><cylinderGeometry args={[0.06, 0.06, 5.2, 6]} /><meshStandardMaterial color="#1c2126" /></mesh>
          <mesh position={[0, 5.4, 0]}>
            <planeGeometry args={[1.05, 4.6]} />
            <meshStandardMaterial map={neonTex[n.tex]} emissive="#ffffff" emissiveMap={neonTex[n.tex]} emissiveIntensity={0.35 + night * 1.8} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* park lawn */}
      <mesh position={[80, 0.04, -80]} receiveShadow><boxGeometry args={[32, 0.1, 32]} /><meshStandardMaterial map={grassTex} color="#a8c48e" roughness={1} /></mesh>

      {/* ======== BUILDINGS ======== */}
      {buildings.map((b, i) => {
        // which side faces the nearest street? (door + canopy + balconies go there)
        const rv = ROAD_COORDS.reduce((a, c) => (Math.abs(c - b.x) < Math.abs(a - b.x) ? c : a), ROAD_COORDS[0]);
        const rh = ROAD_COORDS.reduce((a, c) => (Math.abs(c - b.z) < Math.abs(a - b.z) ? c : a), ROAD_COORDS[0]);
        const faceX = Math.abs(rv - b.x) < Math.abs(rh - b.z);
        const fDir = faceX ? (Math.sign(rv - b.x) || 1) : (Math.sign(rh - b.z) || 1);
        const fRot = faceX ? (fDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (fDir > 0 ? 0 : Math.PI);
        const fOff = faceX ? b.width / 2 : b.depth / 2;
        return (
        <group key={i} position={[b.x, 0, b.z]}>
          <mesh position={[0, b.height / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[b.width, b.height, b.depth]} />
            <primitive object={buildingMats[i]} attach="material" />
          </mesh>
          <mesh position={[0, b.height / 2, 0]}>
            <boxGeometry args={[b.width + 0.06, b.height * 0.92, b.depth + 0.06]} />
            <primitive object={winMat} attach="material" />
          </mesh>
          {/* darker ground-floor shopfront band — breaks the flat cube */}
          <mesh position={[0, 1.32, 0]}>
            <boxGeometry args={[b.width + 0.12, 2.64, b.depth + 0.12]} />
            <meshStandardMaterial color="#2b3138" roughness={0.35} metalness={0.25} emissive="#ffca7a" emissiveIntensity={night * 0.22} />
          </mesh>
          {/* parapet trim band at the roofline */}
          <mesh position={[0, b.height + 0.14, 0]} castShadow>
            <boxGeometry args={[b.width + 0.34, 0.3, b.depth + 0.34]} /><meshStandardMaterial color={b.roof} roughness={0.85} />
          </mesh>
          <mesh position={[0, b.height + 0.42, 0]} castShadow>
            <boxGeometry args={[b.width * 0.7, 0.5, b.depth * 0.7]} /><meshStandardMaterial color={b.roof} flatShading />
          </mesh>
          {/* rooftop props on some roofs: AC units + water tanks */}
          {i % 4 === 0 && (
            <mesh position={[b.width * 0.22, b.height + 0.55, b.depth * 0.18]} castShadow>
              <boxGeometry args={[1.6, 0.85, 1.2]} /><meshStandardMaterial color="#9aa4ac" metalness={0.5} roughness={0.5} />
            </mesh>
          )}
          {i % 7 === 3 && (
            <group position={[-b.width * 0.24, b.height + 0.3, -b.depth * 0.2]}>
              <mesh position={[0, 0.75, 0]} castShadow><cylinderGeometry args={[0.85, 0.85, 1.5, 10]} /><meshStandardMaterial color="#7a5c40" roughness={0.8} /></mesh>
              <mesh position={[0, 1.65, 0]} castShadow><coneGeometry args={[0.95, 0.5, 10]} /><meshStandardMaterial color="#5d4a38" flatShading /></mesh>
            </group>
          )}
          {/* ---- Phase 3 facade detail ---- */}
          {/* cornice bands at 1/3 and 2/3 height on taller blocks */}
          {b.height > 16 && [0.38, 0.68].map((f) => (
            <mesh key={f} position={[0, b.height * f, 0]}>
              <boxGeometry args={[b.width + 0.24, 0.26, b.depth + 0.24]} /><meshStandardMaterial color={b.roof} roughness={0.85} />
            </mesh>
          ))}
          {/* recessed entry: dark door slab + canopy on the street face */}
          <group rotation={[0, fRot, 0]}>
            <mesh position={[0, 1.15, fOff + 0.05]}>
              <boxGeometry args={[1.5, 2.3, 0.12]} /><meshStandardMaterial color="#10151a" roughness={0.4} metalness={0.3} emissive="#ffca7a" emissiveIntensity={night * 0.35} />
            </mesh>
            <mesh position={[0, 2.52, fOff + 0.42]} rotation={[0.28, 0, 0]} castShadow>
              <boxGeometry args={[2.3, 0.09, 1]} /><meshStandardMaterial color={i % 3 === 0 ? "#b3312c" : "#274b5e"} roughness={0.8} />
            </mesh>
            {/* wall-mounted AC condenser on the side wall (local +x side) */}
            {i % 3 === 0 && (
              <mesh position={[(faceX ? b.depth : b.width) / 2 + 0.16, b.height * 0.55, fOff * 0.35]} castShadow>
                <boxGeometry args={[0.32, 0.65, 0.85]} /><meshStandardMaterial color="#aeb6bc" metalness={0.55} roughness={0.45} />
              </mesh>
            )}
            {/* balcony slabs with railings on some mid-rises */}
            {i % 4 === 1 && b.height > 13 && [0.42, 0.64].map((f) => (
              <group key={f} position={[b.width * 0.22, b.height * f, fOff + 0.4]}>
                <mesh castShadow><boxGeometry args={[2.1, 0.1, 0.85]} /><meshStandardMaterial color="#59616a" metalness={0.4} roughness={0.5} /></mesh>
                <mesh position={[0, 0.32, 0.4]}><boxGeometry args={[2.1, 0.5, 0.05]} /><meshStandardMaterial color="#39434b" metalness={0.5} roughness={0.4} /></mesh>
              </group>
            ))}
          </group>
          {/* stepped annex on some towers — footprint variety (L/step massing) */}
          {i % 9 === 4 && b.height > 20 && (
            <group position={[b.width * 0.34, 0, b.depth * 0.3]}>
              <mesh position={[0, b.height * 0.22, 0]} castShadow receiveShadow>
                <boxGeometry args={[b.width * 0.52, b.height * 0.44, b.depth * 0.52]} />
                <primitive object={buildingMats[i]} attach="material" />
              </mesh>
              <mesh position={[0, b.height * 0.45, 0]} castShadow>
                <boxGeometry args={[b.width * 0.58, 0.26, b.depth * 0.58]} /><meshStandardMaterial color={b.roof} roughness={0.85} />
              </mesh>
            </group>
          )}
        </group>
        );
      })}
      {/* suburb houses */}
      {houses.map((h, i) => (
        <group key={i} position={[h.x, 0, h.z]} rotation={[0, h.rot, 0]}>
          <mesh position={[0, 0.03, 0]} receiveShadow><boxGeometry args={[10, 0.07, 11]} /><meshStandardMaterial color="#69a357" /></mesh>
          <mesh position={[1.4, 0.06, 4.6]} receiveShadow><boxGeometry args={[2.6, 0.06, 4.6]} /><primitive object={mats.concreteV} attach="material" /></mesh>
          <mesh position={[0, 1.45, 0]} castShadow receiveShadow><boxGeometry args={[5.4, 2.9, 4.6]} /><meshStandardMaterial color={h.color} roughness={0.9} /></mesh>
          <mesh position={[0, 3.75, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[4.4, 1.8, 4]} /><meshStandardMaterial color={h.roof} flatShading /></mesh>
          <mesh position={[0, 1.05, 2.32]}><boxGeometry args={[0.95, 2, 0.06]} /><meshStandardMaterial color="#4a3826" /></mesh>
          <mesh position={[-1.7, 1.7, 2.32]}><boxGeometry args={[1.1, 0.9, 0.05]} /><meshStandardMaterial color="#ffe9a8" emissive="#ffca7a" emissiveIntensity={0.15 + night * 1.1} /></mesh>
          <mesh position={[1.8, 1.7, 2.32]}><boxGeometry args={[1.1, 0.9, 0.05]} /><meshStandardMaterial color="#ffe9a8" emissive="#ffca7a" emissiveIntensity={0.15 + night * 1.1} /></mesh>
          <mesh position={[3.4, 0.45, 6.2]}><boxGeometry args={[0.09, 0.9, 0.09]} /><meshStandardMaterial color="#5a4632" /></mesh>
          <mesh position={[3.4, 0.95, 6.2]}><boxGeometry args={[0.55, 0.32, 0.3]} /><meshStandardMaterial color="#b3312c" /></mesh>
        </group>
      ))}
      {trees.map((t, i) => <Tree key={i} {...t} />)}
      {palms.map((pl, i) => <PalmTree key={i} {...pl} />)}
      {/* street lamps */}
      {lamps.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh position={[0, 2.8, 0]}><cylinderGeometry args={[0.09, 0.14, 5.6, 5]} /><meshStandardMaterial color="#39434b" /></mesh>
          <mesh position={[0, 5.6, 0]}>
            <boxGeometry args={[0.45, 0.2, 0.35]} />
            <meshStandardMaterial color={theme.lampGlow} emissive={theme.lampGlow} emissiveIntensity={0.4 + night * 2.2} />
          </mesh>
        </group>
      ))}
      {/* props */}
      {props.map((p, i) => (
        <mesh key={i} position={[p.x, p.kind === "bench" ? 0.35 : 0.4, p.z]} rotation={[0, p.rot, 0]} castShadow>
          <boxGeometry args={p.kind === "bench" ? [1.8, 0.15, 0.5] : p.kind === "crate" ? [1, 0.8, 1] : [0.35, 0.8, 0.35]} />
          <meshStandardMaterial color={p.kind === "hydrant" ? "#dc2626" : p.kind === "crate" ? "#a3764f" : "#6b4a2f"} flatShading />
        </mesh>
      ))}
      {/* fake-brand signs / billboards */}
      {SIGNS.map((s, i) => (
        <mesh key={i} position={s.pos} rotation={[0, s.rot, 0]}>
          <planeGeometry args={[11, 2.75]} />
          <meshStandardMaterial map={signTex[i]} emissive="#ffffff" emissiveMap={signTex[i]} emissiveIntensity={0.25 + night * 0.9} />
        </mesh>
      ))}

      {/* ======== MARKET ROW storefronts with awnings ======== */}
      {[
        { pos: [28.5, 8] as const, rot: -Math.PI / 2, awn: "#b3312c" },
        { pos: [-28.5, -8] as const, rot: Math.PI / 2, awn: "#1f7a72" },
        { pos: [8, 28.5] as const, rot: Math.PI, awn: "#d99a3d" },
        { pos: [-8, -28.5] as const, rot: 0, awn: "#3f6d8e" },
      ].map((s, i) => (
        <group key={i} position={[s.pos[0], 0, s.pos[1]]} rotation={[0, s.rot, 0]}>
          <mesh position={[0, 1.35, 0]} castShadow><boxGeometry args={[5.2, 2.7, 3.4]} /><meshStandardMaterial color="#e8dfc8" roughness={0.9} /></mesh>
          <mesh position={[0, 1.15, 1.72]}><boxGeometry args={[4.4, 1.5, 0.06]} /><meshStandardMaterial color="#9fd8e8" roughness={0.15} metalness={0.3} emissive="#ffca7a" emissiveIntensity={night * 0.7} /></mesh>
          <mesh position={[0, 2.35, 2.15]} rotation={[0.5, 0, 0]}><boxGeometry args={[5.4, 0.07, 1.5]} /><meshStandardMaterial color={s.awn} roughness={0.85} /></mesh>
        </group>
      ))}

      {/* ======== FERRIS WHEEL at the pier ======== */}
      <group>
        <mesh position={[22.5, 4.2, 123]} rotation={[0, 0, 0.5]}><boxGeometry args={[0.35, 9.5, 0.35]} /><meshStandardMaterial color="#7a8894" metalness={0.5} roughness={0.5} /></mesh>
        <mesh position={[29.5, 4.2, 123]} rotation={[0, 0, -0.5]}><boxGeometry args={[0.35, 9.5, 0.35]} /><meshStandardMaterial color="#7a8894" metalness={0.5} roughness={0.5} /></mesh>
        <group ref={wheelSpin} position={[26, 9.6, 123]}>
          <mesh><torusGeometry args={[7.5, 0.16, 8, 36]} /><meshStandardMaterial color="#e8b23a" metalness={0.4} roughness={0.4} emissive="#e8b23a" emissiveIntensity={night * 0.7} /></mesh>
          {[0, 1, 2].map((k) => (
            <mesh key={k} rotation={[0, 0, (k * Math.PI) / 3]}><boxGeometry args={[14.6, 0.12, 0.12]} /><meshStandardMaterial color="#d9d3c3" /></mesh>
          ))}
          <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.5, 0.5, 0.7, 10]} /><meshStandardMaterial color="#b3312c" /></mesh>
        </group>
        {Array.from({ length: 8 }, (_, i) => (
          <group key={i} ref={(n) => { cabins.current[i] = n; }} position={[26 + 7.5, 9.6, 123]}>
            <mesh position={[0, 0.35, 0]}><boxGeometry args={[0.09, 0.7, 0.09]} /><meshStandardMaterial color="#8a929a" /></mesh>
            <mesh castShadow><boxGeometry args={[1.15, 1.15, 0.95]} /><meshStandardMaterial color={["#e2574c", "#3d8bfd", "#f2b134", "#39b56a"][i % 4]} roughness={0.5} /></mesh>
          </group>
        ))}
      </group>

      {/* ======== BEACH dressing: lifeguard hut + umbrellas ======== */}
      <group position={[-18, 0, 120]}>
        {[-0.8, 0.8].map((o) => <mesh key={o} position={[o, 0.7, 0]}><boxGeometry args={[0.14, 1.4, 0.14]} /><meshStandardMaterial color="#8a6b48" /></mesh>)}
        <mesh position={[0, 1.85, 0]} castShadow><boxGeometry args={[2.4, 1.3, 1.8]} /><meshStandardMaterial color="#f2ede2" /></mesh>
        <mesh position={[0, 2.85, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[2.1, 0.9, 4]} /><meshStandardMaterial color="#d43a2e" flatShading /></mesh>
        <mesh position={[0, 1.9, 0.92]}><boxGeometry args={[1.7, 0.8, 0.05]} /><meshStandardMaterial color="#274b5e" roughness={0.2} /></mesh>
      </group>
      {[-52, -34, 38, 56, 74].map((x, i) => (
        <group key={i} position={[x, 0, 119 + (i % 2) * 4]}>
          <mesh position={[0, 1.1, 0]} rotation={[0.16, 0, 0.1]}><cylinderGeometry args={[0.04, 0.04, 2.2, 6]} /><meshStandardMaterial color="#e8e2d2" /></mesh>
          <mesh position={[0.1, 2.25, 0.15]} castShadow><coneGeometry args={[1.7, 0.55, 9]} /><meshStandardMaterial color={["#e2574c", "#f2b134", "#2ec4b6", "#3d8bfd", "#ff7f50"][i]} flatShading /></mesh>
          <mesh position={[0.4, 0.18, 0.5]} rotation={[-Math.PI / 2, 0, 0.4]}><planeGeometry args={[1.9, 0.8]} /><meshStandardMaterial color={["#f2ede2", "#ffd9a0", "#bfe3ea", "#ffe3ec", "#e6f2d8"][i]} side={THREE.DoubleSide} /></mesh>
        </group>
      ))}

      {/* ======== HARBOUR LIFE: yacht, cargo ship, tugboat ======== */}
      <group ref={(n) => { boats.current[0] = n; }} position={[62, 0, 152]} rotation={[0, 0.5, 0]}>
        <mesh position={[0, 0.7, 0]} castShadow><boxGeometry args={[3.4, 1.3, 10.5]} /><meshStandardMaterial color="#f4f6f8" roughness={0.25} metalness={0.15} /></mesh>
        <mesh position={[0, 0.75, 6.2]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[2.35, 2.6, 4]} /><meshStandardMaterial color="#f4f6f8" roughness={0.25} /></mesh>
        <mesh position={[0, 1.75, -0.6]} castShadow><boxGeometry args={[2.4, 0.9, 4.6]} /><meshStandardMaterial color="#e8ecef" roughness={0.3} /></mesh>
        <mesh position={[0, 2.25, -0.6]}><boxGeometry args={[2.0, 0.35, 3.6]} /><meshStandardMaterial color="#274b5e" roughness={0.15} /></mesh>
        <mesh position={[0, 4.4, 1.8]}><cylinderGeometry args={[0.05, 0.07, 4.6, 6]} /><meshStandardMaterial color="#9aa4ac" /></mesh>
        <mesh position={[0, 1.15, -5.4]}><boxGeometry args={[3.5, 0.18, 0.5]} /><meshStandardMaterial color="#c22e2e" /></mesh>
      </group>
      <group ref={(n) => { boats.current[1] = n; }} position={[-72, 0, 168]} rotation={[0, 0.12, 0]}>
        <mesh position={[0, 1.4, 0]} castShadow><boxGeometry args={[10.5, 3.2, 44]} /><meshStandardMaterial color="#5e2320" roughness={0.6} metalness={0.3} /></mesh>
        <mesh position={[0, 3.4, 2]}><boxGeometry args={[9.6, 0.9, 38]} /><meshStandardMaterial color="#3c4147" /></mesh>
        {[-13, -6.5, 0, 6.5].map((z, i) => (
          <group key={z}>
            <mesh position={[0, 4.9, z]} castShadow><boxGeometry args={[8.6, 2.2, 5.6]} /><primitive object={containerMat[i % 6]} attach="material" /></mesh>
            {i % 2 === 0 && <mesh position={[0, 7.1, z]} castShadow><boxGeometry args={[8.6, 2.2, 5.6]} /><primitive object={containerMat[(i + 3) % 6]} attach="material" /></mesh>}
          </group>
        ))}
        <mesh position={[0, 6.4, -19]} castShadow><boxGeometry args={[7.5, 6.4, 3.6]} /><meshStandardMaterial color="#eef1f4" roughness={0.4} /></mesh>
        <mesh position={[0, 8.6, -19]}><boxGeometry args={[7.7, 1.1, 3.8]} /><meshStandardMaterial color="#274b5e" roughness={0.15} /></mesh>
      </group>
      <group ref={(n) => { boats.current[2] = n; }} position={[18, 0, 141]} rotation={[0, -0.7, 0]}>
        <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[2.8, 1.1, 6.4]} /><meshStandardMaterial color="#20303a" roughness={0.5} /></mesh>
        <mesh position={[0, 1.5, 0.4]} castShadow><boxGeometry args={[2.0, 1.0, 2.2]} /><meshStandardMaterial color="#f0ead8" /></mesh>
        <mesh position={[0, 2.3, -0.9]}><cylinderGeometry args={[0.32, 0.38, 1.1, 8]} /><meshStandardMaterial color="#c22e2e" /></mesh>
        <mesh position={[0, 1.05, 3.3]}><boxGeometry args={[2.9, 0.25, 0.4]} /><meshStandardMaterial color="#e8b23a" /></mesh>
      </group>

      {/* ======== AMBIENT HELICOPTER (circles the city; searchlight at night) ======== */}
      <group ref={ambHeli} position={[85, 36, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[1.1, 2.8, 4, 8]} /><meshStandardMaterial color="#3d4750" roughness={0.35} metalness={0.5} /></mesh>
        <mesh position={[0, 0.15, -3.4]}><boxGeometry args={[0.34, 0.34, 3.4]} /><meshStandardMaterial color="#3d4750" /></mesh>
        <mesh position={[0, 0.5, -5]}><boxGeometry args={[0.12, 1.5, 0.5]} /><meshStandardMaterial color="#2c343c" /></mesh>
        <mesh ref={ambRotor} position={[0, 1.35, 0]}><boxGeometry args={[9.5, 0.06, 0.4]} /><meshStandardMaterial color="#14161a" /></mesh>
        <mesh position={[0, -0.9, 0]}><boxGeometry args={[2.6, 0.12, 0.3]} /><meshStandardMaterial color="#2c343c" /></mesh>
        {night > 0.35 && (
          <mesh position={[0, -4.6, 0]}>
            <coneGeometry args={[4.2, 8.4, 16, 1, true]} />
            <meshBasicMaterial color="#ffeeb0" transparent opacity={0.13} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}
      </group>

      {/* ======== HILLS + PORT SABLE hillside sign (north edge) ======== */}
      <group>
        <mesh position={[-62, -2.5, -140]} scale={[1, 0.32, 0.5]}><sphereGeometry args={[40, 14, 10]} /><meshStandardMaterial color="#66713f" roughness={1} flatShading /></mesh>
        <mesh position={[12, -3, -148]} scale={[1, 0.34, 0.5]}><sphereGeometry args={[52, 14, 10]} /><meshStandardMaterial color="#5b683a" roughness={1} flatShading /></mesh>
        <mesh position={[74, -2.5, -138]} scale={[1, 0.3, 0.5]}><sphereGeometry args={[36, 14, 10]} /><meshStandardMaterial color="#6d7845" roughness={1} flatShading /></mesh>
        <mesh position={[0, 10.5, -126]} rotation={[-0.1, 0, 0]}>
          <planeGeometry args={[52, 8.1]} />
          <meshBasicMaterial map={hillTex} transparent side={THREE.DoubleSide} fog={false} />
        </mesh>
        {[-21, -7, 7, 21].map((x) => (
          <mesh key={x} position={[x, 3.4, -125.4]}><boxGeometry args={[0.5, 7, 0.5]} /><meshStandardMaterial color="#8a8d90" /></mesh>
        ))}
      </group>

      {/* ======== INDUSTRIAL HARBOUR: gantry cranes + container stacks ======== */}
      {[-58, 58].map((cx, ci) => (
        <group key={ci} position={[cx, 0, 109]}>
          {[-4.4, 4.4].map((lx) => [-2.6, 2.6].map((lz) => (
            <mesh key={`${lx}${lz}`} position={[lx, 8, lz]} castShadow><boxGeometry args={[0.7, 16, 0.7]} /><meshStandardMaterial color="#c9711f" roughness={0.55} metalness={0.4} /></mesh>
          )))}
          <mesh position={[0, 16.4, 0]} castShadow><boxGeometry args={[11.5, 1.1, 6.4]} /><meshStandardMaterial color="#d9822b" roughness={0.55} metalness={0.4} /></mesh>
          <mesh position={[0, 15.4, 6.5]} rotation={[0.5, 0, 0]}><boxGeometry args={[0.6, 0.6, 9]} /><meshStandardMaterial color="#d9822b" /></mesh>
          <mesh position={[1.8, 10.5, 2.6]}><cylinderGeometry args={[0.045, 0.045, 9, 5]} /><meshStandardMaterial color="#2c2c2c" /></mesh>
          <mesh position={[1.8, 5.6, 2.6]} castShadow><boxGeometry args={[5.8, 2.4, 2.3]} /><primitive object={containerMat[ci]} attach="material" /></mesh>
        </group>
      ))}
      {[46, 53, 66, 73, -46, -53, -66, -73].map((x, i) => (
        <group key={i} position={[x, 0, 113.5]}>
          <mesh position={[0, 1.3, 0]} castShadow><boxGeometry args={[6, 2.6, 2.5]} /><primitive object={containerMat[i % 6]} attach="material" /></mesh>
          {i % 3 !== 0 && <mesh position={[0, 3.9, 0]} castShadow><boxGeometry args={[6, 2.6, 2.5]} /><primitive object={containerMat[(i + 2) % 6]} attach="material" /></mesh>}
        </group>
      ))}

      {/* ======== COUNTRYSIDE corner (NW): water tower, barns, hay bales ======== */}
      <group position={[-97, 0, -63]}>
        {[-1.6, 1.6].map((lx) => [-1.6, 1.6].map((lz) => (
          <mesh key={`${lx}${lz}`} position={[lx, 3.4, lz]} rotation={[lx > 0 ? 0.1 : -0.1, 0, lz > 0 ? -0.1 : 0.1]}><boxGeometry args={[0.28, 7, 0.28]} /><meshStandardMaterial color="#7a6a55" /></mesh>
        )))}
        <mesh position={[0, 8.6, 0]} castShadow><cylinderGeometry args={[3.1, 3.1, 3.4, 12]} /><meshStandardMaterial color="#b8bfc4" metalness={0.5} roughness={0.45} /></mesh>
        <mesh position={[0, 10.9, 0]} castShadow><coneGeometry args={[3.5, 1.6, 12]} /><meshStandardMaterial color="#8a3324" flatShading /></mesh>
      </group>
      {[
        { pos: [-63, -92] as const, rot: 0.15 }, { pos: [-97, -70] as const, rot: 0.55 },
      ].map((b, i) => (
        <group key={i} position={[b.pos[0], 0, b.pos[1]]} rotation={[0, b.rot, 0]}>
          <mesh position={[0, 1.7, 0]} castShadow><boxGeometry args={[6.4, 3.4, 5]} /><meshStandardMaterial color="#9c3427" roughness={0.9} /></mesh>
          <mesh position={[0, 4.15, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[5.2, 1.9, 4]} /><meshStandardMaterial color="#5d4a38" flatShading /></mesh>
          <mesh position={[0, 1.6, 2.53]}><boxGeometry args={[2, 2.6, 0.06]} /><meshStandardMaterial color="#e8e2d2" /></mesh>
        </group>
      ))}
      {[[-66, -66], [-95, -78], [-60, -80], [-88, -58], [-70, -97], [-58, -95]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.8, z]} rotation={[Math.PI / 2, 0, i * 0.8]} castShadow>
          <cylinderGeometry args={[0.8, 0.8, 1.25, 10]} /><meshStandardMaterial color="#d9b45c" roughness={1} flatShading />
        </mesh>
      ))}

      {/* ======== AIRPORT (east edge, scenery only): runway, plane, tower, terminal ======== */}
      <group>
        <mesh position={[124, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[15, 212]} /><primitive object={mats.asphaltV} attach="material" />
        </mesh>
        {Array.from({ length: 13 }, (_, i) => -96 + i * 16).map((z) => (
          <mesh key={z} position={[124, 0.075, z]}><boxGeometry args={[0.35, 0.018, 6]} /><primitive object={mats.edge} attach="material" /></mesh>
        ))}
        {[-104, 104].map((z) => (
          <group key={z}>
            {[121.5, 124, 126.5].map((x) => (
              <mesh key={x} position={[x, 0.076, z]}><boxGeometry args={[1.6, 0.018, 5]} /><meshStandardMaterial color="#f2f0e8" roughness={0.7} /></mesh>
            ))}
          </group>
        ))}
        {/* parked airliner — original teal/white livery */}
        <group position={[124, 0, -42]} rotation={[0, Math.PI, 0]}>
          <mesh position={[0, 2.1, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[1.65, 1.65, 15, 14]} /><meshStandardMaterial color="#f2f5f7" roughness={0.3} metalness={0.2} /></mesh>
          <mesh position={[0, 2.25, 8.6]} rotation={[Math.PI / 2, 0, 0]}><sphereGeometry args={[1.6, 12, 10]} /><meshStandardMaterial color="#f2f5f7" roughness={0.3} /></mesh>
          <mesh position={[0, 2.7, 7.6]}><boxGeometry args={[2.6, 0.7, 2.2]} /><meshStandardMaterial color="#17323e" roughness={0.12} /></mesh>
          <mesh position={[0, 1.85, 0]}><boxGeometry args={[3.36, 0.55, 13.5]} /><meshStandardMaterial color="#1f7a72" roughness={0.4} /></mesh>
          <mesh position={[0, 2.05, -1]} castShadow><boxGeometry args={[13.5, 0.18, 2.3]} /><meshStandardMaterial color="#dfe5e9" metalness={0.4} roughness={0.4} /></mesh>
          <mesh position={[0, 3.6, -7.6]} castShadow><boxGeometry args={[0.18, 3.1, 1.9]} /><meshStandardMaterial color="#1f7a72" /></mesh>
          <mesh position={[0, 2.4, -7.6]}><boxGeometry args={[5.4, 0.16, 1.5]} /><meshStandardMaterial color="#dfe5e9" /></mesh>
          {[-3.4, 3.4].map((x) => (
            <mesh key={x} position={[x, 1.15, -0.6]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.55, 0.55, 1.7, 10]} /><meshStandardMaterial color="#9fb2bc" metalness={0.6} roughness={0.35} /></mesh>
          ))}
          {[0].map((x) => <mesh key={x} position={[0, 0.55, 3.4]}><boxGeometry args={[0.18, 1.1, 0.18]} /><meshStandardMaterial color="#5a646c" /></mesh>)}
        </group>
        {/* control tower */}
        <group position={[113, 0, 28]}>
          <mesh position={[0, 5, 0]} castShadow><cylinderGeometry args={[1.15, 1.5, 10, 10]} /><meshStandardMaterial color="#cfd6da" roughness={0.6} /></mesh>
          <mesh position={[0, 10.9, 0]} castShadow><cylinderGeometry args={[2.3, 2.3, 1.9, 10]} /><meshStandardMaterial color="#274b5e" roughness={0.12} metalness={0.3} emissive="#ffca7a" emissiveIntensity={night * 0.8} /></mesh>
          <mesh position={[0, 12.15, 0]}><cylinderGeometry args={[2.45, 2.45, 0.35, 10]} /><meshStandardMaterial color="#39434b" /></mesh>
        </group>
        {/* terminal */}
        <group position={[114.5, 0, 46]}>
          <mesh castShadow receiveShadow position={[0, 3, 0]}><boxGeometry args={[15, 6, 9]} /><meshStandardMaterial color="#dde3e7" roughness={0.7} /></mesh>
          <mesh position={[0, 3.4, -4.56]}><boxGeometry args={[13, 3.6, 0.08]} /><meshStandardMaterial color="#7fb6cc" roughness={0.12} metalness={0.4} emissive="#ffca7a" emissiveIntensity={night * 0.6} /></mesh>
          <mesh position={[0, 6.25, 0]}><boxGeometry args={[15.6, 0.5, 9.6]} /><meshStandardMaterial color="#39434b" /></mesh>
        </group>
      </group>

      {/* ======== HIGHWAY (east road x=100): guardrails + gantry sign ======== */}
      {[-80, -40, 0, 40, 80].map((z) => (
        <group key={z}>
          <mesh position={[93.3, 0.5, z]}><boxGeometry args={[0.14, 0.55, 27]} /><meshStandardMaterial color="#aeb6bc" metalness={0.7} roughness={0.35} /></mesh>
          <mesh position={[106.7, 0.5, z]}><boxGeometry args={[0.14, 0.55, 27]} /><meshStandardMaterial color="#aeb6bc" metalness={0.7} roughness={0.35} /></mesh>
        </group>
      ))}
      <group position={[100, 0, -8]}>
        <mesh position={[-6.8, 3.1, 0]}><cylinderGeometry args={[0.14, 0.14, 6.2, 8]} /><meshStandardMaterial color="#5a646c" metalness={0.6} roughness={0.4} /></mesh>
        <mesh position={[6.8, 3.1, 0]}><cylinderGeometry args={[0.14, 0.14, 6.2, 8]} /><meshStandardMaterial color="#5a646c" metalness={0.6} roughness={0.4} /></mesh>
        <mesh position={[0, 6.3, 0]}><boxGeometry args={[14.4, 0.3, 0.3]} /><meshStandardMaterial color="#5a646c" metalness={0.6} roughness={0.4} /></mesh>
        {[0.001, Math.PI].map((ry, i) => (
          <mesh key={i} position={[0, 5.2, i === 0 ? 0.22 : -0.22]} rotation={[0, ry, 0]}>
            <planeGeometry args={[11.5, 1.7]} />
            <meshStandardMaterial map={gantryTex} emissive="#ffffff" emissiveMap={gantryTex} emissiveIntensity={0.25 + night * 0.7} />
          </mesh>
        ))}
      </group>

      {/* ======== MANSION (suburbs, SW block) ======== */}
      <group position={[MANSION.x, 0, MANSION.z]}>
        <mesh position={[0, 0.04, 0]} receiveShadow><boxGeometry args={[17, 0.08, 15]} /><meshStandardMaterial color="#5f9e52" /></mesh>
        <mesh position={[0, 2.1, 0]} castShadow receiveShadow><boxGeometry args={[11, 4.2, 7]} /><meshStandardMaterial color="#ece7db" roughness={0.85} /></mesh>
        <mesh position={[0, 4.35, 0]}><boxGeometry args={[11.7, 0.32, 7.7]} /><meshStandardMaterial color="#2e3438" /></mesh>
        <mesh position={[0, 2, 3.56]}><boxGeometry args={[8.2, 3.1, 0.1]} /><meshStandardMaterial color="#31424c" roughness={0.1} metalness={0.35} emissive="#ffd98a" emissiveIntensity={0.1 + night * 1.2} /></mesh>
        <mesh position={[-8.2, 1.5, 0]} castShadow><boxGeometry args={[5, 3, 6]} /><meshStandardMaterial color="#e2dccb" roughness={0.85} /></mesh>
        <mesh position={[4.4, 0.07, 4.4]} receiveShadow><boxGeometry args={[7, 0.07, 3.6]} /><primitive object={mats.concreteV} attach="material" /></mesh>
        <mesh position={[0, 0.55, 5.6]}><boxGeometry args={[13, 1.05, 0.55]} /><meshStandardMaterial color="#2e6b34" flatShading /></mesh>
        <mesh position={[-6.8, 0.55, 0]}><boxGeometry args={[0.55, 1.05, 11]} /><meshStandardMaterial color="#2e6b34" flatShading /></mesh>
        <mesh position={[6.8, 0.55, 0]}><boxGeometry args={[0.55, 1.05, 11]} /><meshStandardMaterial color="#2e6b34" flatShading /></mesh>
        <group position={[4.2, 0, 4.4]} rotation={[0, Math.PI / 2, 0]}>
          <CarBody kind="supercar" color="#d4af37" />
        </group>
      </group>
      <PalmTree x={MANSION.x + 8.6} z={MANSION.z - 6} scale={1.05} lean={0.1} />
      <PalmTree x={MANSION.x - 9.4} z={MANSION.z - 6} scale={1.0} lean={-0.12} />

      {/* ======== CLUB SOLACE (beachfront nightclub, exterior) ======== */}
      <group position={[44, 0, 117]}>
        <mesh position={[0, 3.2, 0]} castShadow receiveShadow><boxGeometry args={[15, 6.4, 9]} /><meshStandardMaterial color="#171a20" roughness={0.7} /></mesh>
        <mesh position={[0, 6.55, 0]}><boxGeometry args={[15.4, 0.28, 9.4]} /><meshStandardMaterial color="#2ee6c8" emissive="#2ee6c8" emissiveIntensity={0.4 + night * 1.6} /></mesh>
        <mesh position={[0, 5.4, -4.56]}>
          <planeGeometry args={[10.5, 1.65]} />
          <meshStandardMaterial map={clubTex} emissive="#ffffff" emissiveMap={clubTex} emissiveIntensity={0.35 + night * 1.7} />
        </mesh>
        <mesh position={[-6.2, 3.4, -4.56]}>
          <planeGeometry args={[1.05, 4.8]} />
          <meshStandardMaterial map={neonTex[3]} emissive="#ffffff" emissiveMap={neonTex[3]} emissiveIntensity={0.3 + night * 1.6} />
        </mesh>
        <mesh position={[0, 1.15, -4.56]}><boxGeometry args={[2.2, 2.3, 0.1]} /><meshStandardMaterial color="#0b0d10" emissive="#7a4fd0" emissiveIntensity={night * 0.8} /></mesh>
        {[-3.4, 3.4].map((x) => (
          <mesh key={x} position={[x, 2.2, -4.7]}><boxGeometry args={[0.16, 4.4, 0.16]} /><meshStandardMaterial color="#c9a7ff" emissive="#9a6ae0" emissiveIntensity={0.25 + night * 1.5} /></mesh>
        ))}
      </group>
      {/* club queue — 3 people waiting outside, idle-animated */}
      {clubQueue.map((rig, i) => (
        <group key={i} position={[40.5 + i * 2.6, 0, 111.2]} rotation={[0, (i - 1) * 0.25, 0]}>
          <primitive object={rig.group} />
        </group>
      ))}

      {/* ======== FUEL STATIONS (Phase 2): canopy + pumps + sign ======== */}
      {FUEL_STATIONS.map((st, i) => (
        <group key={i} position={[st.x, 0, st.z]}>
          <mesh position={[0, 0.05, 0]} receiveShadow><boxGeometry args={[9, 0.1, 7]} /><meshStandardMaterial color="#4a4d52" roughness={0.9} /></mesh>
          {[-3.6, 3.6].map((x) => [-2.6, 2.6].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 1.8, z]} castShadow><cylinderGeometry args={[0.11, 0.11, 3.6, 6]} /><meshStandardMaterial color="#8a929a" metalness={0.6} roughness={0.4} /></mesh>
          )))}
          <mesh position={[0, 3.75, 0]} castShadow><boxGeometry args={[9.4, 0.35, 7.4]} /><meshStandardMaterial color="#7a1f1f" roughness={0.6} /></mesh>
          <mesh position={[0, 3.52, 0]}><boxGeometry args={[9.5, 0.12, 7.5]} /><meshStandardMaterial color="#ffb703" emissive="#ffb703" emissiveIntensity={0.3 + night * 1.4} /></mesh>
          {[-1.6, 1.6].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <mesh position={[0, 0.65, 0]} castShadow><boxGeometry args={[0.7, 1.3, 0.45]} /><meshStandardMaterial color="#c8ccd2" roughness={0.4} metalness={0.3} /></mesh>
              <mesh position={[0, 0.95, 0.24]}><boxGeometry args={[0.45, 0.4, 0.03]} /><meshStandardMaterial color="#9fd8e8" emissive="#9fd8e8" emissiveIntensity={0.4 + night} /></mesh>
              <mesh position={[0, 0.4, 0.24]}><boxGeometry args={[0.5, 0.18, 0.03]} /><meshStandardMaterial color="#7a1f1f" /></mesh>
            </group>
          ))}
          <mesh position={[0, 2.6, 5.6]}><cylinderGeometry args={[0.07, 0.07, 5.2, 6]} /><meshStandardMaterial color="#39434b" /></mesh>
          <mesh position={[0, 5.4, 5.6]}>
            <planeGeometry args={[7.5, 1.9]} />
            <meshStandardMaterial map={fuelTex[i]} emissive="#ffffff" emissiveMap={fuelTex[i]} emissiveIntensity={0.3 + night * 1.1} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* ======== SCENIC OVERLOOK (Phase 2 — the sunset mood-board shot) ======== */}
      <group position={[OVERLOOK.x, 0, OVERLOOK.z]}>
        <mesh position={[0, 0.05, 0]} receiveShadow><boxGeometry args={[17, 0.1, 10.5]} /><meshStandardMaterial color="#3c4148" roughness={0.85} /></mesh>
        <mesh position={[0, 0.06, 4.6]}><boxGeometry args={[17, 0.02, 0.5]} /><meshStandardMaterial color="#e9e7de" roughness={0.7} /></mesh>
        {/* guardrail along the drop edge */}
        {[-7.5, -2.5, 2.5, 7.5].map((x) => (
          <mesh key={x} position={[x, 0.55, -5]} castShadow><boxGeometry args={[0.14, 1.1, 0.14]} /><meshStandardMaterial color="#8a929a" metalness={0.6} roughness={0.4} /></mesh>
        ))}
        <mesh position={[0, 1.02, -5]}><boxGeometry args={[16.5, 0.16, 0.08]} /><meshStandardMaterial color="#aeb6bc" metalness={0.7} roughness={0.3} /></mesh>
        <mesh position={[0, 0.55, -5]}><boxGeometry args={[16.5, 0.12, 0.06]} /><meshStandardMaterial color="#aeb6bc" metalness={0.7} roughness={0.3} /></mesh>
        {/* bench facing the bay */}
        <group position={[-5.5, 0, -3.4]} rotation={[0, Math.PI, 0]}>
          <mesh position={[0, 0.46, 0.28]} receiveShadow><boxGeometry args={[1.9, 0.09, 0.5]} /><meshStandardMaterial color="#6d4c33" roughness={0.9} /></mesh>
          <mesh position={[0, 0.85, 0.52]}><boxGeometry args={[1.9, 0.5, 0.07]} /><meshStandardMaterial color="#6d4c33" roughness={0.9} /></mesh>
          {[-0.8, 0.8].map((x) => <mesh key={x} position={[x, 0.23, 0.28]}><boxGeometry args={[0.09, 0.46, 0.42]} /><meshStandardMaterial color="#2c2f33" /></mesh>)}
        </group>
        {/* coin binoculars */}
        <group position={[3.5, 0, -4.2]}>
          <mesh position={[0, 0.65, 0]} castShadow><cylinderGeometry args={[0.09, 0.13, 1.3, 8]} /><meshStandardMaterial color="#9aa4ac" metalness={0.7} roughness={0.3} /></mesh>
          <mesh position={[0, 1.45, 0]} castShadow><boxGeometry args={[0.55, 0.34, 0.4]} /><meshStandardMaterial color="#b8bfc4" metalness={0.7} roughness={0.25} /></mesh>
          {[-0.14, 0.14].map((x) => (
            <mesh key={x} position={[x, 1.45, -0.28]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.07, 0.09, 0.18, 8]} /><meshStandardMaterial color="#274b5e" roughness={0.15} /></mesh>
          ))}
        </group>
        <mesh position={[-8.6, 1.5, 3.8]}><cylinderGeometry args={[0.06, 0.06, 3, 6]} /><meshStandardMaterial color="#39434b" /></mesh>
        <mesh position={[-8.6, 3.2, 3.8]}>
          <planeGeometry args={[5.6, 1.4]} />
          <meshStandardMaterial map={overlookTex} emissive="#ffffff" emissiveMap={overlookTex} emissiveIntensity={0.25 + night * 0.8} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* ======== BAY BRIDGE — DRIVABLE causeway (Phase 4): segmented deck
           follows groundYAt() exactly; towers/cables stay as dressing ======== */}
      <group>
        {Array.from({ length: 38 }, (_, i) => {
          const z0 = 88 + i * 4;
          const y0 = groundYAt(BRIDGE.x, z0), y1 = groundYAt(BRIDGE.x, z0 + 4);
          const ym = (y0 + y1) / 2;
          const pitch = Math.atan2(y1 - y0, 4);
          return (
            <mesh key={i} position={[BRIDGE.x, ym - 0.28, z0 + 2]} rotation={[pitch, 0, 0]} receiveShadow>
              <boxGeometry args={[11, 0.55, 4.6]} /><meshStandardMaterial color="#434a51" roughness={0.65} metalness={0.25} />
            </mesh>
          );
        })}
        {/* rails */}
        {[-5.3, 5.3].map((o) => (
          <group key={o}>
            {Array.from({ length: 38 }, (_, i) => {
              const z0 = 88 + i * 4;
              const ym = (groundYAt(BRIDGE.x, z0) + groundYAt(BRIDGE.x, z0 + 4)) / 2;
              const pitch = Math.atan2(groundYAt(BRIDGE.x, z0 + 4) - groundYAt(BRIDGE.x, z0), 4);
              return <mesh key={i} position={[BRIDGE.x + o, ym + 0.55, z0 + 2]} rotation={[pitch, 0, 0]}><boxGeometry args={[0.16, 0.75, 4.6]} /><meshStandardMaterial color="#9aa4ac" metalness={0.65} roughness={0.35} /></mesh>;
            })}
          </group>
        ))}
        {/* towers + cables (dressing) */}
        {[-5.2, 5.2].map((o) => (
          <group key={`t${o}`}>
            {[140, 180].map((z) => (
              <mesh key={z} position={[BRIDGE.x + o, 15, z]} castShadow><boxGeometry args={[0.9, 19, 0.9]} /><meshStandardMaterial color="#7d8894" metalness={0.5} roughness={0.45} /></mesh>
            ))}
            <mesh position={[BRIDGE.x + o, 15.5, 134]} rotation={[2.09, 0, 0]}><boxGeometry args={[0.14, 0.14, 24.2]} /><meshStandardMaterial color="#22262b" /></mesh>
            <mesh position={[BRIDGE.x + o, 15.5, 160]} rotation={[0.81, 0, 0]}><boxGeometry args={[0.14, 0.14, 29]} /><meshStandardMaterial color="#22262b" /></mesh>
            <mesh position={[BRIDGE.x + o, 15.5, 160]} rotation={[2.33, 0, 0]}><boxGeometry args={[0.14, 0.14, 29]} /><meshStandardMaterial color="#22262b" /></mesh>
            <mesh position={[BRIDGE.x + o, 15.5, 189]} rotation={[0.86, 0, 0]}><boxGeometry args={[0.14, 0.14, 27.9]} /><meshStandardMaterial color="#22262b" /></mesh>
            {[146, 154, 166, 174].map((z) => (
              <mesh key={z} position={[BRIDGE.x + o, 15.5, z]}><boxGeometry args={[0.07, 18, 0.07]} /><meshStandardMaterial color="#2c3138" /></mesh>
            ))}
          </group>
        ))}
        {/* support piers standing in the bay */}
        {[128, 152, 176, 200].map((z) => (
          <mesh key={z} position={[BRIDGE.x, 1.8, z]}><boxGeometry args={[9, 5.4, 1.8]} /><meshStandardMaterial color="#5a646c" roughness={0.75} /></mesh>
        ))}
      </group>

      {/* ======== parked motorcycle (prop — the beach one is rideable now) ======== */}
      {[
        { pos: [-35, -29] as const, rot: 0.7, color: "#274268" },
      ].map((m, i) => (
        <group key={i} position={[m.pos[0], 0, m.pos[1]]} rotation={[0, m.rot, 0]}>
          {[0.85, -0.85].map((z) => (
            <mesh key={z} position={[0, 0.34, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.34, 0.34, 0.09, 12]} /><meshStandardMaterial color="#141518" roughness={0.9} /></mesh>
          ))}
          <mesh position={[0, 0.62, 0.1]} rotation={[0.35, 0, 0]}><boxGeometry args={[0.3, 0.28, 1.15]} /><meshStandardMaterial color={m.color} metalness={0.5} roughness={0.3} /></mesh>
          <mesh position={[0, 0.78, -0.35]}><boxGeometry args={[0.42, 0.14, 0.7]} /><meshStandardMaterial color="#191b1d" /></mesh>
          <mesh position={[0, 0.95, 0.78]} rotation={[0.5, 0, 0]}><boxGeometry args={[0.08, 0.5, 0.08]} /><meshStandardMaterial color="#5a646c" /></mesh>
          <mesh position={[0, 1.12, 0.95]}><boxGeometry args={[0.55, 0.07, 0.07]} /><meshStandardMaterial color="#22262b" /></mesh>
        </group>
      ))}

      {/* ======== Phase 3: Lina's Garage — exterior (enterable, see Interiors) ======== */}
      <group position={[-25, 0, 106.5]}>
        <mesh position={[0, 2.6, 0]} castShadow receiveShadow>
          <boxGeometry args={[12, 5.2, 8]} /><meshStandardMaterial color="#b57e4e" roughness={0.9} />
        </mesh>
        <mesh position={[0, 5.35, 0]} castShadow><boxGeometry args={[12.4, 0.3, 8.4]} /><meshStandardMaterial color="#4c3b28" roughness={0.9} /></mesh>
        {/* roller shutter (front, facing the Docks road) */}
        <mesh position={[-2.2, 1.6, -4.06]}><boxGeometry args={[5, 3.2, 0.12]} /><meshStandardMaterial color="#7d8894" metalness={0.55} roughness={0.45} /></mesh>
        {[-1.2, -0.5, 0.2, 0.9].map((y) => (
          <mesh key={y} position={[-2.2, 1.6 + y, -4.13]}><boxGeometry args={[5, 0.05, 0.03]} /><meshStandardMaterial color="#59616a" metalness={0.5} roughness={0.5} /></mesh>
        ))}
        {/* personnel door — the way in */}
        <mesh position={[3.4, 1.1, -4.06]}><boxGeometry args={[1.1, 2.2, 0.12]} /><meshStandardMaterial color="#22303a" roughness={0.5} metalness={0.3} /></mesh>
        <mesh position={[3.4, 2.42, -4.1]}><boxGeometry args={[1.5, 0.35, 0.06]} /><meshStandardMaterial color="#ffca7a" emissive="#ffca7a" emissiveIntensity={night * 1.6 + 0.15} /></mesh>
        {/* tyres + crates stacked beside the building */}
        {[[6.8, -3], [6.8, -1.9], [7.6, -2.5]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.31, z]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.31, 0.31, 0.22, 12]} /><meshStandardMaterial color="#17181a" roughness={0.95} /></mesh>
        ))}
        <mesh position={[-6.9, 0.45, -2.6]} castShadow><boxGeometry args={[0.95, 0.9, 0.95]} /><meshStandardMaterial color="#a3764f" roughness={0.9} /></mesh>
      </group>

      {/* ======== Phase 3 ground life: park paths + wet sand band ======== */}
      <group position={[80, 0, -80]}>
        <mesh position={[0, 0.045, 0]} receiveShadow><boxGeometry args={[34, 0.05, 2.6]} /><meshStandardMaterial color="#c9bb9e" roughness={1} /></mesh>
        <mesh position={[0, 0.045, 0]} receiveShadow><boxGeometry args={[2.6, 0.05, 34]} /><meshStandardMaterial color="#c9bb9e" roughness={1} /></mesh>
        <mesh position={[0, 0.05, 0]} receiveShadow><cylinderGeometry args={[3, 3, 0.05, 18]} /><meshStandardMaterial color="#c9bb9e" roughness={1} /></mesh>
      </group>
      <mesh position={[0, 0.045, 128.2]} receiveShadow>
        <boxGeometry args={[292, 0.05, 4.4]} /><meshStandardMaterial color="#b08e5e" roughness={0.35} />
      </mesh>

      {/* ======== Phase 3 street props (instanced) ======== */}
      <primitive object={streetProps.tufts} />
      <primitive object={streetProps.bins} />
      <primitive object={streetProps.mails} />
      <primitive object={streetProps.planters} />
      <primitive object={streetProps.planterBush} />
      <primitive object={streetProps.cones} />

      {/* bus stops x3: posts, roof, glass back, bench, sign */}
      {[
        { x: 27.7, z: -30, rot: Math.PI / 2 }, { x: -67.7, z: 14, rot: -Math.PI / 2 }, { x: 34, z: 67.7, rot: Math.PI },
      ].map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]} rotation={[0, s.rot, 0]}>
          {[-1.5, 1.5].map((x) => <mesh key={x} position={[x, 1.25, 0]} castShadow><boxGeometry args={[0.09, 2.5, 0.09]} /><meshStandardMaterial color="#39434b" metalness={0.6} roughness={0.4} /></mesh>)}
          <mesh position={[0, 2.55, 0.1]} castShadow><boxGeometry args={[3.6, 0.08, 1.3]} /><meshStandardMaterial color="#274b5e" roughness={0.6} /></mesh>
          <mesh position={[0, 1.3, -0.5]}><boxGeometry args={[3.4, 2, 0.04]} /><meshStandardMaterial color="#bcd6de" transparent opacity={0.32} roughness={0.1} metalness={0.4} /></mesh>
          <mesh position={[0, 0.5, 0.15]} castShadow><boxGeometry args={[2.8, 0.08, 0.45]} /><meshStandardMaterial color="#6d4c33" roughness={0.85} /></mesh>
          <mesh position={[1.95, 1.5, 0]}><cylinderGeometry args={[0.035, 0.035, 3, 6]} /><meshStandardMaterial color="#39434b" metalness={0.6} roughness={0.4} /></mesh>
          <mesh position={[1.95, 2.9, 0]}><boxGeometry args={[0.55, 0.55, 0.05]} /><meshStandardMaterial color="#2e7fb8" emissive="#2e7fb8" emissiveIntensity={night * 0.7} /></mesh>
        </group>
      ))}

      {/* dumpsters by the alleys */}
      {[[-52, -38], [12, 52], [68, -32], [-14, -68]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, i * 0.8, 0]}>
          <mesh position={[0, 0.65, 0]} castShadow><boxGeometry args={[2.2, 1.3, 1.25]} /><meshStandardMaterial color="#2e5c46" roughness={0.7} metalness={0.35} /></mesh>
          <mesh position={[0, 1.36, -0.1]} rotation={[-0.16, 0, 0]}><boxGeometry args={[2.2, 0.08, 1.15]} /><meshStandardMaterial color="#24493a" roughness={0.7} metalness={0.35} /></mesh>
        </group>
      ))}

      {/* parked bicycles x4: torus wheels + tube frame */}
      {[
        { x: 12.5, z: 116.5, rot: 0.4 }, { x: -30, z: 26.9, rot: -0.2 }, { x: 52.5, z: -27.1, rot: 0.9 }, { x: -66.2, z: 86, rot: -0.6 },
      ].map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} rotation={[0, b.rot, 0.1]}>
          {[-0.52, 0.52].map((dz) => (
            <mesh key={dz} position={[0, 0.33, dz]}><torusGeometry args={[0.33, 0.028, 6, 14]} /><meshStandardMaterial color="#22262b" roughness={0.6} metalness={0.4} /></mesh>
          ))}
          <mesh position={[0, 0.55, -0.05]} rotation={[1.1, 0, 0]}><cylinderGeometry args={[0.03, 0.03, 0.75, 6]} /><meshStandardMaterial color={["#c22e2e", "#274268", "#39b56a", "#d99a3d"][i]} metalness={0.5} roughness={0.35} /></mesh>
          <mesh position={[0, 0.78, -0.42]}><boxGeometry args={[0.24, 0.06, 0.3]} /><meshStandardMaterial color="#191b1d" /></mesh>
          <mesh position={[0, 0.85, 0.55]}><boxGeometry args={[0.4, 0.05, 0.05]} /><meshStandardMaterial color="#22262b" /></mesh>
        </group>
      ))}

      {/* fire hydrants */}
      {[[27.6, 48], [-27.6, -52], [67.6, 22], [-67.6, -64], [12, 107.4], [-48, 107.4]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.32, 0]} castShadow><cylinderGeometry args={[0.13, 0.16, 0.64, 8]} /><meshStandardMaterial color="#c22e2e" roughness={0.5} /></mesh>
          <mesh position={[0, 0.7, 0]}><sphereGeometry args={[0.13, 8, 6]} /><meshStandardMaterial color="#a82323" roughness={0.5} /></mesh>
          <mesh position={[0, 0.45, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.06, 0.06, 0.4, 6]} /><meshStandardMaterial color="#8f1d1d" roughness={0.5} /></mesh>
        </group>
      ))}

      {/* newspaper boxes near the market row */}
      {[[16.5, -33], [17.4, -33], [-23.5, 33.2], [56.5, -6.8]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.5, z]} castShadow>
          <boxGeometry args={[0.55, 1, 0.5]} /><meshStandardMaterial color={["#c22e2e", "#2e7fb8", "#d99a3d", "#39b56a"][i]} roughness={0.45} metalness={0.3} />
        </mesh>
      ))}

      {/* ======== Phase 4 shopfronts: register counters (robbery points) +
           Coral pawn shop. Shutters drop while a shop is "robbed" today. */}
      <ShopFronts night={night} />

      {/* ======== Phase 3 distance depth: far skyline silhouette ring +
           a second, hazier bridge on the horizon ======== */}
      <group>
        {Array.from({ length: 26 }, (_, i) => {
          const a = (i / 26) * Math.PI * 2 + 0.12;
          const r = 238 + ((i * 37) % 22);
          const h = 20 + ((i * 53) % 42);
          const sx = Math.sin(a) * r, sz = Math.cos(a) * r;
          if (sz > 140 && Math.abs(sx) < 150) return null; // Coral Shores occupies this sector now
          return (
            <mesh key={i} position={[sx, h / 2 - 2, sz]}>
              <boxGeometry args={[15 + (i % 4) * 5, h, 12]} />
              <meshBasicMaterial color="#546a76" fog={false} />
            </mesh>
          );
        })}
        <group position={[-150, 0, 225]} rotation={[0, 0.5, 0]}>
          <mesh position={[0, 7, 0]}><boxGeometry args={[170, 2.2, 8]} /><meshBasicMaterial color="#475c66" fog={false} /></mesh>
          {[-45, 45].map((x) => <mesh key={x} position={[x, 20, 0]}><boxGeometry args={[4, 28, 5]} /><meshBasicMaterial color="#475c66" fog={false} /></mesh>)}
        </group>
      </group>
    </group>
  );
}
