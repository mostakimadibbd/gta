// Harborfall — detailed car body shared by parked cars, traffic and police.
// Classes from the mood board: supercar, muscle, SUV, classic, sedan,
// hatch, coupe, pickup, van (+ police livery). Glossy paint, rim/spoke
// wheels, lights, mirrors, plates, bumpers, exhaust. Facing +Z = front.
import { useMemo } from "react";
import * as THREE from "three";
import { glowTexture, tyreTexture } from "../textures";

export type CarKind = "sedan" | "hatch" | "coupe" | "pickup" | "van" | "supercar" | "muscle" | "suv" | "classic";

const GLASS = new THREE.MeshStandardMaterial({ color: "#141f28", metalness: 0.5, roughness: 0.08, envMapIntensity: 1.3 });
const CHROME = new THREE.MeshStandardMaterial({ color: "#d7dce2", metalness: 0.95, roughness: 0.16, envMapIntensity: 1.4 });
const BUMPER = new THREE.MeshStandardMaterial({ color: "#22262b", metalness: 0.4, roughness: 0.5 });
const TYRE = new THREE.MeshStandardMaterial({ color: "#8a8a8e", map: tyreTexture(), roughness: 0.94 });
const RIM = new THREE.MeshStandardMaterial({ color: "#c9ced6", metalness: 0.85, roughness: 0.3 });
const HEAD = new THREE.MeshStandardMaterial({ color: "#fff3cf", emissive: "#ffdf94", emissiveIntensity: 1.7 });
const TAIL = new THREE.MeshStandardMaterial({ color: "#d21f2e", emissive: "#c00018", emissiveIntensity: 1.5 });
const HEADGLOW = new THREE.SpriteMaterial({ map: glowTexture(), color: "#ffdf94", transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending });
const TAILGLOW = new THREE.SpriteMaterial({ map: glowTexture(), color: "#ff2a33", transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
const PLATE = new THREE.MeshStandardMaterial({ color: "#eef1f4", roughness: 0.6 });
const WHITEWALL = new THREE.MeshStandardMaterial({ color: "#e9e6dc", roughness: 0.7 });

function Wheel({ x, z, r, w, classic }: { x: number; z: number; r: number; w: number; classic?: boolean }) {
  return (
    <group position={[x, r, z]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[r, r, w, 14]} /><primitive object={TYRE} attach="material" />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[r * 0.58, r * 0.58, w + 0.02, 12]} /><primitive object={RIM} attach="material" />
      </mesh>
      {/* spokes (in the YZ plane of the rim face) */}
      <mesh><boxGeometry args={[w + 0.03, r * 1.05, r * 0.2]} /><primitive object={RIM} attach="material" /></mesh>
      <mesh><boxGeometry args={[w + 0.03, r * 0.2, r * 1.05]} /><primitive object={RIM} attach="material" /></mesh>
      {classic && (
        <mesh position={[Math.sign(x) * (w / 2 + 0.015), 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <ringGeometry args={[r * 0.62, r * 0.82, 16]} /><primitive object={WHITEWALL} attach="material" />
        </mesh>
      )}
    </group>
  );
}

function LightsBumpers({ w, len, y, classic }: { w: number; len: number; y: number; classic?: boolean }) {
  const bMat = classic ? CHROME : BUMPER;
  return (
    <>
      <mesh position={[-w * 0.32, y, len / 2 + 0.03]}><boxGeometry args={[0.36, 0.12, 0.06]} /><primitive object={HEAD} attach="material" /></mesh>
      <mesh position={[w * 0.32, y, len / 2 + 0.03]}><boxGeometry args={[0.36, 0.12, 0.06]} /><primitive object={HEAD} attach="material" /></mesh>
      <mesh position={[0, y, -len / 2 - 0.03]}><boxGeometry args={[w * 0.66, 0.09, 0.05]} /><primitive object={TAIL} attach="material" /></mesh>
      {/* lens glow sprites (headlight halos + tail-light bloom) */}
      <sprite position={[-w * 0.32, y, len / 2 + 0.12]} scale={[0.95, 0.95, 1]}><primitive object={HEADGLOW} attach="material" /></sprite>
      <sprite position={[w * 0.32, y, len / 2 + 0.12]} scale={[0.95, 0.95, 1]}><primitive object={HEADGLOW} attach="material" /></sprite>
      <sprite position={[0, y, -len / 2 - 0.12]} scale={[1.5, 0.8, 1]}><primitive object={TAILGLOW} attach="material" /></sprite>
      <mesh position={[0, y - 0.08, len / 2 + 0.05]}><boxGeometry args={[w + 0.08, 0.17, 0.16]} /><primitive object={bMat} attach="material" /></mesh>
      <mesh position={[0, y - 0.08, -len / 2 - 0.05]}><boxGeometry args={[w + 0.08, 0.17, 0.16]} /><primitive object={bMat} attach="material" /></mesh>
      <mesh position={[0, y - 0.02, -len / 2 - 0.14]}><boxGeometry args={[0.52, 0.15, 0.03]} /><primitive object={PLATE} attach="material" /></mesh>
      <mesh position={[w * 0.34, 0.22, -len / 2 - 0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.18, 8]} /><primitive object={CHROME} attach="material" />
      </mesh>
    </>
  );
}

function Mirrors({ w, y, z }: { w: number; y: number; z: number }) {
  return (
    <>
      <mesh position={[-w / 2 - 0.09, y, z]}><boxGeometry args={[0.16, 0.09, 0.12]} /><primitive object={BUMPER} attach="material" /></mesh>
      <mesh position={[w / 2 + 0.09, y, z]}><boxGeometry args={[0.16, 0.09, 0.12]} /><primitive object={BUMPER} attach="material" /></mesh>
    </>
  );
}

export default function CarBody({ kind, color, police }: { kind: CarKind; color: string; police?: boolean }) {
  // deep glossy paint: low roughness + strong environment reflections
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ color, metalness: 0.25, roughness: 0.27, envMapIntensity: 1.2 }), [color]);
  const classic = kind === "classic";
  let body: React.ReactNode = null;
  let wheels: React.ReactNode = null;
  const wheelSet = (w: number, len: number, r: number, ww: number, rearR?: number, rearW?: number) => (
    <>
      <Wheel x={-w / 2 - 0.02} z={len / 2 - 0.72} r={r} w={ww} classic={classic} />
      <Wheel x={w / 2 + 0.02} z={len / 2 - 0.72} r={r} w={ww} classic={classic} />
      <Wheel x={-w / 2 - 0.02} z={-len / 2 + 0.72} r={rearR ?? r} w={rearW ?? ww} classic={classic} />
      <Wheel x={w / 2 + 0.02} z={-len / 2 + 0.72} r={rearR ?? r} w={rearW ?? ww} classic={classic} />
    </>
  );

  switch (kind) {
    case "supercar":
      body = (<>
        <mesh position={[0, 0.44, 0]} castShadow><boxGeometry args={[2.2, 0.4, 4.3]} /><primitive object={paint} attach="material" /></mesh>
        <mesh position={[0, 0.36, 1.85]} rotation={[0.22, 0, 0]} castShadow><boxGeometry args={[2.05, 0.22, 0.9]} /><primitive object={paint} attach="material" /></mesh>
        <mesh position={[0, 0.72, -0.25]} castShadow><boxGeometry args={[1.5, 0.32, 1.7]} /><primitive object={GLASS} attach="material" /></mesh>
        <mesh position={[0, 0.3, 0]}><boxGeometry args={[2.24, 0.16, 3.4]} /><primitive object={BUMPER} attach="material" /></mesh>
        <mesh position={[0, 0.98, -2.02]}><boxGeometry args={[2.15, 0.06, 0.44]} /><primitive object={BUMPER} attach="material" /></mesh>
        <mesh position={[-0.8, 0.8, -1.95]}><boxGeometry args={[0.09, 0.3, 0.09]} /><primitive object={BUMPER} attach="material" /></mesh>
        <mesh position={[0.8, 0.8, -1.95]}><boxGeometry args={[0.09, 0.3, 0.09]} /><primitive object={BUMPER} attach="material" /></mesh>
        <LightsBumpers w={2.2} len={4.3} y={0.48} />
        <Mirrors w={2.2} y={0.78} z={0.55} />
      </>); wheels = wheelSet(2.2, 4.3, 0.37, 0.3, 0.42, 0.4); break;
    case "muscle":
      body = (<>
        <mesh position={[0, 0.62, 0]} castShadow><boxGeometry args={[2.05, 0.62, 4.4]} /><primitive object={paint} attach="material" /></mesh>
        <mesh position={[0, 0.99, 0.75]} castShadow><boxGeometry args={[0.72, 0.13, 1.05]} /><primitive object={BUMPER} attach="material" /></mesh>
        <mesh position={[0, 1.12, -0.6]} castShadow><boxGeometry args={[1.68, 0.5, 1.5]} /><primitive object={GLASS} attach="material" /></mesh>
        <LightsBumpers w={2.05} len={4.4} y={0.66} />
        <Mirrors w={2.05} y={1.18} z={0.1} />
      </>); wheels = wheelSet(2.05, 4.4, 0.4, 0.3); break;
    case "suv":
      body = (<>
        <mesh position={[0, 0.78, 0]} castShadow><boxGeometry args={[2.1, 0.88, 4.2]} /><primitive object={paint} attach="material" /></mesh>
        <mesh position={[0, 1.5, -0.15]} castShadow><boxGeometry args={[1.92, 0.6, 2.5]} /><primitive object={GLASS} attach="material" /></mesh>
        <mesh position={[-0.7, 1.85, -0.15]}><boxGeometry args={[0.07, 0.06, 2.3]} /><primitive object={CHROME} attach="material" /></mesh>
        <mesh position={[0.7, 1.85, -0.15]}><boxGeometry args={[0.07, 0.06, 2.3]} /><primitive object={CHROME} attach="material" /></mesh>
        <LightsBumpers w={2.1} len={4.2} y={0.82} />
        <Mirrors w={2.1} y={1.45} z={1.05} />
      </>); wheels = wheelSet(2.1, 4.2, 0.45, 0.3); break;
    case "classic":
      body = (<>
        <mesh position={[0, 0.6, 0]} castShadow><boxGeometry args={[1.95, 0.56, 4.5]} /><primitive object={paint} attach="material" /></mesh>
        <mesh position={[0, 0.95, 0]} castShadow><boxGeometry args={[2.0, 0.16, 2.6]} /><primitive object={paint} attach="material" /></mesh>
        <mesh position={[0, 1.14, -0.2]} castShadow><boxGeometry args={[1.66, 0.48, 1.8]} /><primitive object={GLASS} attach="material" /></mesh>
        <LightsBumpers w={1.95} len={4.5} y={0.64} classic />
        <Mirrors w={1.95} y={1.2} z={0.65} />
      </>); wheels = wheelSet(1.95, 4.5, 0.38, 0.26); break;
    case "pickup":
      body = (<>
        <mesh position={[0, 0.68, 0]} castShadow><boxGeometry args={[2.1, 0.72, 4.1]} /><primitive object={paint} attach="material" /></mesh>
        <mesh position={[0, 1.28, 0.85]} castShadow><boxGeometry args={[1.85, 0.55, 1.35]} /><primitive object={GLASS} attach="material" /></mesh>
        <mesh position={[0, 1.0, -1.15]}><boxGeometry args={[1.9, 0.34, 1.5]} /><meshStandardMaterial color="#4c3b28" roughness={0.9} /></mesh>
        <LightsBumpers w={2.1} len={4.1} y={0.7} />
        <Mirrors w={2.1} y={1.3} z={1.45} />
      </>); wheels = wheelSet(2.1, 4.1, 0.42, 0.3); break;
    case "van":
      body = (<>
        <mesh position={[0, 0.92, 0]} castShadow><boxGeometry args={[2.1, 1.12, 4.2]} /><primitive object={paint} attach="material" /></mesh>
        <mesh position={[0, 1.12, 1.95]}><boxGeometry args={[1.85, 0.55, 0.3]} /><primitive object={GLASS} attach="material" /></mesh>
        <LightsBumpers w={2.1} len={4.2} y={0.66} />
        <Mirrors w={2.1} y={1.3} z={1.9} />
      </>); wheels = wheelSet(2.1, 4.2, 0.4, 0.28); break;
    case "hatch":
      body = (<>
        <mesh position={[0, 0.62, 0]} castShadow><boxGeometry args={[1.9, 0.6, 3.15]} /><primitive object={paint} attach="material" /></mesh>
        <mesh position={[0, 1.14, -0.15]} castShadow><boxGeometry args={[1.66, 0.52, 1.85]} /><primitive object={GLASS} attach="material" /></mesh>
        <LightsBumpers w={1.9} len={3.15} y={0.64} />
        <Mirrors w={1.9} y={1.18} z={0.7} />
      </>); wheels = wheelSet(1.9, 3.15, 0.35, 0.24); break;
    case "coupe":
      body = (<>
        <mesh position={[0, 0.52, 0]} castShadow><boxGeometry args={[2.0, 0.46, 3.9]} /><primitive object={paint} attach="material" /></mesh>
        <mesh position={[0, 0.94, -0.35]} castShadow><boxGeometry args={[1.62, 0.44, 1.55]} /><primitive object={GLASS} attach="material" /></mesh>
        <LightsBumpers w={2.0} len={3.9} y={0.56} />
        <Mirrors w={2.0} y={1.0} z={0.4} />
      </>); wheels = wheelSet(2.0, 3.9, 0.37, 0.26); break;
    default: // sedan
      body = (<>
        <mesh position={[0, 0.6, 0]} castShadow><boxGeometry args={[2.0, 0.58, 3.7]} /><primitive object={paint} attach="material" /></mesh>
        <mesh position={[0, 1.1, -0.12]} castShadow><boxGeometry args={[1.7, 0.5, 1.8]} /><primitive object={GLASS} attach="material" /></mesh>
        {police && <mesh position={[0, 0.6, 0.1]}><boxGeometry args={[2.03, 0.34, 1.75]} /><meshStandardMaterial color="#f2f4f6" roughness={0.4} /></mesh>}
        <LightsBumpers w={2.0} len={3.7} y={0.62} />
        <Mirrors w={2.0} y={1.14} z={0.72} />
      </>); wheels = wheelSet(2.0, 3.7, 0.36, 0.25); break;
  }
  return (<group>{body}{wheels}</group>);
}
