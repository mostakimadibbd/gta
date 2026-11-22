import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildings, trees, props, lamps, ROAD_COORDS, ROAD_WIDTH, WATER_Z } from "../world";
import type { GameTheme } from "../themes";

// Shared canvas textures: window grid (emissive at dusk/night) + fake shop signs.
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
function makeSignTexture(text: string, bg: string, fg: string): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = bg; g.fillRect(0, 0, 256, 64);
  g.fillStyle = fg; g.font = "bold 26px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, 128, 34);
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

function Tree({ x, z, scale }: { x: number; z: number; scale: number }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.9, 0]} castShadow><cylinderGeometry args={[0.16, 0.24, 1.8, 5]} /><meshStandardMaterial color="#76553b" flatShading /></mesh>
      <mesh position={[0, 2.1, 0]} castShadow><coneGeometry args={[1.05, 2.1, 6]} /><meshStandardMaterial color="#2e7d5b" flatShading /></mesh>
      <mesh position={[0, 2.9, 0]} castShadow><coneGeometry args={[0.72, 1.75, 6]} /><meshStandardMaterial color="#43a06a" flatShading /></mesh>
    </group>
  );
}

export default function World({ theme, night }: { theme: GameTheme; night: number }) {
  const water = useRef<THREE.MeshStandardMaterial>(null);
  const winTex = useMemo(makeWindowTexture, []);
  const signTex = useMemo(() => SIGNS.map((s) => makeSignTexture(s.text, s.bg, s.fg)), []);
  useFrame(({ clock }) => {
    if (water.current) {
      const t = clock.elapsedTime;
      water.current.emissiveIntensity = 0.15 + Math.sin(t * 1.4) * 0.08;
      water.current.color.set(theme.water).offsetHSL(0, 0, Math.sin(t * 0.7) * 0.02);
    }
  });
  const winMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#ffffff", emissive: new THREE.Color(theme.windowGlow), emissiveMap: winTex, map: winTex,
    emissiveIntensity: 0.25 + night * 1.3, roughness: 0.85,
  }), [winTex, theme.windowGlow, night]);
  return (
    <group>
      {/* ground / grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.09, 0]} receiveShadow>
        <planeGeometry args={[280, 260]} /><meshStandardMaterial color="#5f7f52" />
      </mesh>
      {/* beach sand */}
      <mesh position={[0, 0.0, 121]} receiveShadow><boxGeometry args={[280, 0.1, 14]} /><meshStandardMaterial color="#e3c98f" /></mesh>
      {/* harbour water (animated emissive shimmer) */}
      <mesh position={[0, -0.05, WATER_Z + 32]} receiveShadow>
        <boxGeometry args={[280, 0.08, 60]} />
        <meshStandardMaterial ref={water} color={theme.water} emissive={theme.water} emissiveIntensity={0.2} roughness={0.35} metalness={0.1} />
      </mesh>
      {/* pier */}
      <mesh position={[0, 0.06, 122]} receiveShadow><boxGeometry args={[10, 0.16, 16]} /><meshStandardMaterial color="#8a6b48" /></mesh>
      {/* roads */}
      {ROAD_COORDS.map((c) => (
        <group key={c}>
          <mesh position={[c, 0.01, 0]} receiveShadow><boxGeometry args={[ROAD_WIDTH, 0.12, 248]} /><meshStandardMaterial color="#2e3438" /></mesh>
          <mesh position={[0, 0.01, c]} receiveShadow><boxGeometry args={[248, 0.12, ROAD_WIDTH]} /><meshStandardMaterial color="#2e3438" /></mesh>
          {/* lane dashes */}
          {Array.from({ length: 30 }, (_, i) => -116 + i * 8).map((t) => (
            <group key={t}>
              <mesh position={[c, 0.08, t]}><boxGeometry args={[0.18, 0.02, 3]} /><meshStandardMaterial color="#f5d76e" /></mesh>
              <mesh position={[t, 0.08, c]}><boxGeometry args={[3, 0.02, 0.18]} /><meshStandardMaterial color="#f5d76e" /></mesh>
            </group>
          ))}
          {/* sidewalks */}
          {[-7.5, 7.5].map((o) => (
            <group key={o}>
              <mesh position={[c + o, 0.03, 0]} receiveShadow><boxGeometry args={[2.4, 0.14, 248]} /><meshStandardMaterial color="#9aa39b" /></mesh>
              <mesh position={[0, 0.03, c + o]} receiveShadow><boxGeometry args={[248, 0.14, 2.4]} /><meshStandardMaterial color="#9aa39b" /></mesh>
            </group>
          ))}
        </group>
      ))}
      {/* crosswalks at intersections */}
      {ROAD_COORDS.map((x) => ROAD_COORDS.map((z) => (
        <mesh key={`${x}-${z}`} position={[x, 0.075, z]}><boxGeometry args={[10, 0.02, 10]} /><meshStandardMaterial color="#454e52" /></mesh>
      )))}
      {/* park lawn */}
      <mesh position={[80, 0.04, -80]} receiveShadow><boxGeometry args={[32, 0.1, 32]} /><meshStandardMaterial color="#4c8a4f" /></mesh>
      {/* buildings with window-grid material on the sides */}
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]}>
          <mesh position={[0, b.height / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[b.width, b.height, b.depth]} />
            <meshStandardMaterial color={b.color} flatShading />
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
      {trees.map((t, i) => <Tree key={i} {...t} />)}
      {/* street lamps (glow scales with night via theme + night factor) */}
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
      {/* traffic lights at two central intersections (blinking via emissive swap is in GameSystems timer; static coloured heads here) */}
      {[0, -20].map((c) => (
        <group key={c} position={[c + 7, 0, c === 0 ? 7 : -27]}>
          <mesh position={[0, 2.2, 0]}><cylinderGeometry args={[0.07, 0.07, 4.4, 5]} /><meshStandardMaterial color="#22282c" /></mesh>
          <mesh position={[0, 4.6, 0]}><boxGeometry args={[0.5, 1.3, 0.5]} /><meshStandardMaterial color="#16191c" /></mesh>
          <mesh position={[0, 4.95, 0.28]}><sphereGeometry args={[0.13, 8, 8]} /><meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.6} /></mesh>
          <mesh position={[0, 4.6, 0.28]}><sphereGeometry args={[0.13, 8, 8]} /><meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.7} /></mesh>
          <mesh position={[0, 4.25, 0.28]}><sphereGeometry args={[0.13, 8, 8]} /><meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.6} /></mesh>
        </group>
      ))}
    </group>
  );
}
