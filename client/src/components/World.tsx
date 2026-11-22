import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildings, trees, props, lamps, palms, houses, ROAD_COORDS, ROAD_WIDTH, WATER_Z, MANSION } from "../world";
import type { GameTheme } from "../themes";
import {
  asphaltTexture, asphaltTextureH, concreteTexture, concreteTextureH,
  facadeTexture, brickTexture, containerTexture, streetSignTexture, neonSignTexture,
} from "../textures";
import CarBody from "./CarBody";
import { buildHumanoid, animateHumanoid, type HumanoidRig } from "../humanoid";

// ---------- local canvas textures ----------
function makeWindowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 64; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#20262b"; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 120; y += 14) for (let x = 6; x < 58; x += 14) {
    g.fillStyle = Math.random() > 0.45 ? "#ffd98a" : "#3a4a52";
    g.fillRect(x, y, 8, 9);
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
  const c = document.createElement("canvas"); c.width = 64; c.height = 512;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#7fb6c4"); grad.addColorStop(0.52, "#cfd8ce");
  grad.addColorStop(0.72, "#ffd9a0"); grad.addColorStop(0.82, "#ffb066"); grad.addColorStop(1, "#e88a4e");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 512);
  return new THREE.CanvasTexture(c);
}
const SIGNS: { text: string; bg: string; fg: string; pos: [number, number, number]; rot: number }[] = [
  { text: "LINA'S GARAGE", bg: "#0f4442", fg: "#ffca7a", pos: [-40, 6, -27], rot: 0 },
  { text: "SOLANO TRUCKING", bg: "#5a3a14", fg: "#ffd98a", pos: [60, 9, 93], rot: Math.PI },
  { text: "PORT SABLE", bg: "#14524f", fg: "#ffffff", pos: [0, 7, 118], rot: Math.PI },
  { text: "SABLE FISH CO.", bg: "#274268", fg: "#ffe9a8", pos: [-80, 5, 93], rot: Math.PI },
  { text: "MARKET ROW", bg: "#946b2d", fg: "#ffffff", pos: [20, 6, 13], rot: 0 },
  { text: "FERRY AHOY", bg: "#17605c", fg: "#fef9c3", pos: [-93, 5, 60], rot: Math.PI / 2 },
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
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.9, 0]} castShadow><cylinderGeometry args={[0.16, 0.24, 1.8, 5]} /><meshStandardMaterial color="#76553b" flatShading /></mesh>
      <mesh position={[0, 2.1, 0]} castShadow><coneGeometry args={[1.05, 2.1, 6]} /><meshStandardMaterial color="#2e7d5b" flatShading /></mesh>
      <mesh position={[0, 2.9, 0]} castShadow><coneGeometry args={[0.72, 1.75, 6]} /><meshStandardMaterial color="#43a06a" flatShading /></mesh>
    </group>
  );
}

function PalmTree({ x, z, scale, lean }: { x: number; z: number; scale: number; lean: number }) {
  const topX = lean * 1.6;
  return (
    <group position={[x, 0, z]} scale={scale}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[lean * i * i * 0.22, 0.75 + i * 1.35, 0]} rotation={[0, 0, -lean * 0.55]} castShadow>
          <cylinderGeometry args={[0.13 - i * 0.025, 0.17 - i * 0.025, 1.6, 6]} /><meshStandardMaterial color="#8a6b48" flatShading />
        </mesh>
      ))}
      <group position={[topX, 4.35, 0]}>
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <group key={k} rotation={[0, (k * Math.PI) / 3, 0]}>
            <mesh position={[1.05, -0.12, 0]} rotation={[0, 0, -0.42]}>
              <planeGeometry args={[2.3, 0.55]} />
              <meshStandardMaterial color="#3f9e57" side={THREE.DoubleSide} flatShading />
            </mesh>
          </group>
        ))}
        <mesh position={[0, -0.08, 0]}><sphereGeometry args={[0.17, 7, 6]} /><meshStandardMaterial color="#6b4a2f" /></mesh>
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

  // ---- ground materials (wet-look at night: roughness drops as night rises)
  const mats = useMemo(() => {
    const rough = 0.96 - night * 0.5;
    const aV = asphaltTexture(); aV.repeat.set(1, 20);
    const aH = asphaltTextureH(); aH.repeat.set(1, 20);
    const cV = concreteTexture(); cV.repeat.set(1, 60);
    const cH = concreteTextureH(); cH.repeat.set(1, 60);
    return {
      asphaltV: new THREE.MeshStandardMaterial({ map: aV, roughness: rough, metalness: 0.04 + night * 0.1 }),
      asphaltH: new THREE.MeshStandardMaterial({ map: aH, roughness: rough, metalness: 0.04 + night * 0.1 }),
      concreteV: new THREE.MeshStandardMaterial({ map: cV, roughness: 0.95 }),
      concreteH: new THREE.MeshStandardMaterial({ map: cH, roughness: 0.95 }),
      curb: new THREE.MeshStandardMaterial({ map: cV, color: "#a09c92", roughness: 0.95 }),
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
          ? new THREE.MeshStandardMaterial({ color: "#7fb0cc", map: facadeTexture(), roughness: 0.16, metalness: 0.55 })
          : new THREE.MeshStandardMaterial({ color: b.color, map: kind === "brick" ? brickTexture() : facadeTexture(), roughness: 0.92 });
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
  });

  return (
    <group>
      {/* gradient sky dome (tinted by theme + night) */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[195, 20, 14]} />
        <meshBasicMaterial ref={domeMat} map={skyTex} side={THREE.BackSide} fog={false} depthWrite={false} />
      </mesh>
      {/* ground / grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.09, 0]} receiveShadow>
        <planeGeometry args={[290, 300]} /><meshStandardMaterial color="#5f7f52" />
      </mesh>
      {/* beach sand */}
      <mesh position={[0, 0.0, 121]} receiveShadow><boxGeometry args={[290, 0.1, 14]} /><meshStandardMaterial color="#e3c98f" /></mesh>
      {/* harbour water (animated emissive shimmer) */}
      <mesh position={[0, -0.05, WATER_Z + 32]} receiveShadow>
        <boxGeometry args={[290, 0.08, 60]} />
        <meshStandardMaterial ref={water} color={theme.water} emissive={theme.water} emissiveIntensity={0.2} roughness={0.35} metalness={0.1} />
      </mesh>
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
      <mesh position={[80, 0.04, -80]} receiveShadow><boxGeometry args={[32, 0.1, 32]} /><meshStandardMaterial color="#4c8a4f" /></mesh>

      {/* ======== BUILDINGS ======== */}
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]}>
          <mesh position={[0, b.height / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[b.width, b.height, b.depth]} />
            <primitive object={buildingMats[i]} attach="material" />
          </mesh>
          <mesh position={[0, b.height / 2, 0]}>
            <boxGeometry args={[b.width + 0.06, b.height * 0.92, b.depth + 0.06]} />
            <primitive object={winMat} attach="material" />
          </mesh>
          <mesh position={[0, b.height + 0.25, 0]} castShadow>
            <boxGeometry args={[b.width * 0.7, 0.5, b.depth * 0.7]} /><meshStandardMaterial color={b.roof} flatShading />
          </mesh>
        </group>
      ))}
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

      {/* ======== parked motorcycles (props, non-drivable) ======== */}
      {[
        { pos: [8, 117] as const, rot: -0.4, color: "#c22e2e" },
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
    </group>
  );
}
