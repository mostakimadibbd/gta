// Harborfall — detailed car body shared by parked cars, traffic and police.
// Classes from the mood board: supercar, muscle, SUV, classic, sedan,
// hatch, coupe, pickup, van, motorcycle (+ police livery). Phase 3 visual
// pass: bodies are SCULPTED from RoundedBox forms — sloped hoods, curved
// canopies, wheel-arch insets, side skirts — so the silhouette stops being
// stacked rectangles. Glossy paint, rim/spoke wheels, lights, mirrors,
// plates, bumpers, exhaust. Facing +Z = front.
import { useEffect, useMemo, useRef, type ReactNode, type MutableRefObject } from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { glowTexture, tyreTexture, shatteredTexture, carDirtTexture } from "../textures";
import { G } from "../game/store";
import { gates, tier } from "../game/quality";

export type CarKind = "sedan" | "hatch" | "coupe" | "pickup" | "van" | "supercar" | "muscle" | "suv" | "classic" | "motorcycle" | "bus" | "taxi" | "bicycle" | "boat" | "wedge" | "hyper" | "gt" | "tow" | "skiff" | "plane";

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
const ARCH = new THREE.MeshStandardMaterial({ color: "#0a0b0d", roughness: 0.95 }); // dark wheel-arch inset
const DARKTRIM = new THREE.MeshStandardMaterial({ color: "#191c20", roughness: 0.7, metalness: 0.2 });
// Phase 4 (Visual V4): clearer glass for the player's car so the cabin
// interior reads through it; broken-window variant uses the shattered map.
const GLASS_CLEAR = new THREE.MeshStandardMaterial({ color: "#2a3d49", metalness: 0.4, roughness: 0.06, envMapIntensity: 1.4, transparent: true, opacity: 0.62 });
const GLASS_BROKEN = new THREE.MeshStandardMaterial({ map: shatteredTexture(), color: "#cfd8dc", metalness: 0.2, roughness: 0.45, envMapIntensity: 0.7 });
const CABIN = new THREE.MeshStandardMaterial({ color: "#17181c", roughness: 0.92 });
const SEATMAT = new THREE.MeshStandardMaterial({ color: "#232028", roughness: 0.95 });
const WHEELMAT = new THREE.MeshStandardMaterial({ color: "#101114", roughness: 0.6 });

/** RoundedBox with a shared material attached — the Phase 3 sculpting unit. */
function RB({ args, radius = 0.07, mat, pos, rot, shadow = true }: {
  args: [number, number, number]; radius?: number; mat: THREE.Material;
  pos: [number, number, number]; rot?: [number, number, number]; shadow?: boolean;
}) {
  return (
    <RoundedBox args={args} radius={radius} smoothness={4} position={pos} rotation={rot} castShadow={shadow} receiveShadow>
      <primitive object={mat} attach="material" />
    </RoundedBox>
  );
}

function Wheel({ x, z, r, w, classic, steerRef, carIndex }: { x: number; z: number; r: number; w: number; classic?: boolean; steerRef?: MutableRefObject<number>; carIndex?: number }) {
  const steerG = useRef<THREE.Group>(null);
  useFrame(() => { if (steerG.current && steerRef) steerG.current.rotation.y = (carIndex === undefined || (G.driving && G.activeCarId === carIndex)) ? steerRef.current * 0.42 : 0; });
  return (
    <group position={[x, r, z]}>
      <group ref={steerG}>
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
    </group>
  );
}

/** Dark arch discs behind the wheels + side skirts — kills the slab side. */
function ArchesSkirts({ w, len, r }: { w: number; len: number; r: number }) {
  const zs = [len / 2 - 0.72, -len / 2 + 0.72];
  return (
    <>
      {zs.map((z) => [-1, 1].map((s) => (
        <mesh key={`${z}${s}`} position={[s * (w / 2 + 0.006), r + 0.02, z]} rotation={[0, s * Math.PI / 2, 0]}>
          <circleGeometry args={[r + 0.085, 18]} /><primitive object={ARCH} attach="material" />
        </mesh>
      )))}
      {[-1, 1].map((s) => (
        <mesh key={`sk${s}`} position={[s * (w / 2 - 0.01), 0.21, 0]}>
          <boxGeometry args={[0.07, 0.15, len * 0.58]} /><primitive object={DARKTRIM} attach="material" />
        </mesh>
      ))}
    </>
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
      <RB args={[w + 0.06, 0.17, 0.18]} radius={0.06} mat={bMat} pos={[0, y - 0.08, len / 2 + 0.05]} />
      <RB args={[w + 0.06, 0.17, 0.18]} radius={0.06} mat={bMat} pos={[0, y - 0.08, -len / 2 - 0.05]} />
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
      <RB args={[0.16, 0.09, 0.12]} radius={0.03} mat={BUMPER} pos={[-w / 2 - 0.09, y, z]} shadow={false} />
      <RB args={[0.16, 0.09, 0.12]} radius={0.03} mat={BUMPER} pos={[w / 2 + 0.09, y, z]} shadow={false} />
    </>
  );
}

/** Cabin interior (Visual V4) — dash, a steering wheel that turns with the
 * steering input, front seats + rear bench, headliner. Player car only. */
function CabinInterior({ y, z, w, steerRef, carIndex }: { y: number; z: number; w: number; steerRef?: MutableRefObject<number>; carIndex?: number }) {
  const wheelG = useRef<THREE.Group>(null);
  useFrame(() => { if (wheelG.current && steerRef) wheelG.current.rotation.z = (carIndex === undefined || (G.driving && G.activeCarId === carIndex)) ? -steerRef.current * 1.9 : 0; });
  return (
    <group>
      <RB args={[w, 0.16, 0.34]} radius={0.05} mat={CABIN} pos={[0, y + 0.1, z + 0.66]} shadow={false} />
      <RB args={[w, 0.05, 1.5]} radius={0.02} mat={CABIN} pos={[0, y + 0.44, z - 0.1]} shadow={false} />
      <group position={[-w * 0.27, y + 0.06, z + 0.44]} rotation={[0.5, 0, 0]}>
        <group ref={wheelG}>
          <mesh><torusGeometry args={[0.17, 0.028, 8, 20]} /><primitive object={WHEELMAT} attach="material" /></mesh>
          <mesh><boxGeometry args={[0.3, 0.035, 0.02]} /><primitive object={WHEELMAT} attach="material" /></mesh>
          <mesh><boxGeometry args={[0.035, 0.3, 0.02]} /><primitive object={WHEELMAT} attach="material" /></mesh>
        </group>
      </group>
      {[-w * 0.27, w * 0.27].map((sx) => (
        <group key={sx}>
          <RB args={[0.5, 0.14, 0.5]} radius={0.05} mat={SEATMAT} pos={[sx, y - 0.2, z + 0.05]} shadow={false} />
          <RB args={[0.5, 0.55, 0.13]} radius={0.05} mat={SEATMAT} pos={[sx, y + 0.03, z - 0.24]} rot={[0.16, 0, 0]} shadow={false} />
        </group>
      ))}
      <RB args={[w * 0.92, 0.14, 0.45]} radius={0.05} mat={SEATMAT} pos={[0, y - 0.2, z - 0.58]} shadow={false} />
    </group>
  );
}

const CABIN_POS: Record<string, { y: number; z: number; w: number }> = {
  sedan: { y: 0.98, z: -0.05, w: 1.5 }, coupe: { y: 0.86, z: -0.3, w: 1.45 },
  hatch: { y: 1.02, z: -0.1, w: 1.45 }, muscle: { y: 1.02, z: -0.5, w: 1.5 },
  suv: { y: 1.38, z: -0.1, w: 1.7 }, classic: { y: 1.02, z: -0.15, w: 1.45 },
  pickup: { y: 1.18, z: 0.85, w: 1.6 }, van: { y: 1.0, z: 1.15, w: 1.65 },
  supercar: { y: 0.6, z: -0.25, w: 1.5 },
  taxi: { y: 0.98, z: -0.05, w: 1.5 }, bus: { y: 1.62, z: 1.4, w: 2.0 },
  gt: { y: 0.95, z: -0.35, w: 1.5 }, tow: { y: 1.18, z: 0.85, w: 1.6 },
};
/** Dirt/scratch shell (Visual V3): opacity follows live damage. */
const SHELL: Record<string, [number, number, number, number]> = {
  sedan: [2.05, 0.63, 3.75, 0.6], coupe: [2.05, 0.51, 3.95, 0.52], hatch: [1.95, 0.65, 3.2, 0.62],
  muscle: [2.1, 0.67, 4.45, 0.62], suv: [2.15, 0.93, 4.25, 0.78], classic: [2.0, 0.61, 4.55, 0.6],
  pickup: [2.15, 0.77, 4.15, 0.68], van: [2.15, 1.17, 4.25, 0.92], supercar: [2.25, 0.47, 4.35, 0.44],
  taxi: [2.05, 0.63, 3.75, 0.6], bus: [2.5, 1.9, 7.2, 1.5],
  // Phase 8 exotics + wrecker (radius contract 1.6 for wedge/hyper/gt)
  wedge: [2.3, 0.5, 4.5, 0.42], hyper: [2.25, 0.5, 4.4, 0.42], gt: [2.05, 0.55, 4.6, 0.55], tow: [2.15, 0.77, 4.15, 0.68],
};
function DirtShell({ kind, liveDamage }: { kind: string; liveDamage?: () => number }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: carDirtTexture(), transparent: true, opacity: 0, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), []);
  useFrame(() => { if (liveDamage) mat.opacity = Math.max(0, Math.min(1, (liveDamage() - 12) / 88)) * 0.88; });
  const s = SHELL[kind];
  if (!s) return null;
  return (
    <RoundedBox args={[s[0], s[1], s[2]]} radius={0.09} smoothness={2} position={[0, s[3], 0]}>
      <primitive object={mat} attach="material" />
    </RoundedBox>
  );
}

/** Phase 5 Step 5 paint: Medium/High get MeshPhysicalMaterial clearcoat
 * (1.0 / 0.08) over the base coat; Low keeps the Phase 4 standard paint. */
function paintMaterial(color: string, metalness = 0.25, roughness = 0.27): THREE.Material {
  if (gates.clearcoat(tier())) {
    return new THREE.MeshPhysicalMaterial({ color, metalness, roughness: roughness + 0.03, clearcoat: 1.0, clearcoatRoughness: 0.08, envMapIntensity: 1.25 });
  }
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, envMapIntensity: 1.2 });
}

/** Rideable motorcycle — Sable Stinger: thin wheels, tube frame, tank, seat. */
export function MotorcycleBody({ color }: { color: string }) {
  const paint = useMemo(() => paintMaterial(color, 0.45, 0.3), [color]);
  const wheel = (z: number) => (
    <group position={[0, 0.34, z]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.34, 0.34, 0.09, 16]} /><primitive object={TYRE} attach="material" /></mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.17, 0.17, 0.1, 12]} /><primitive object={RIM} attach="material" /></mesh>
      <mesh><boxGeometry args={[0.1, 0.56, 0.07]} /><primitive object={RIM} attach="material" /></mesh>
      <mesh><boxGeometry args={[0.1, 0.07, 0.56]} /><primitive object={RIM} attach="material" /></mesh>
    </group>
  );
  return (
    <group>
      {wheel(0.82)}{wheel(-0.82)}
      {/* front fork + handlebar */}
      <mesh position={[0, 0.72, 0.78]} rotation={[0.42, 0, 0]} castShadow><cylinderGeometry args={[0.035, 0.035, 0.85, 8]} /><primitive object={CHROME} attach="material" /></mesh>
      <mesh position={[0, 1.02, 0.66]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.03, 0.03, 0.62, 8]} /><primitive object={DARKTRIM} attach="material" /></mesh>
      <mesh position={[0, 0.86, 0.86]}><sphereGeometry args={[0.09, 10, 8]} /><primitive object={HEAD} attach="material" /></mesh>
      <sprite position={[0, 0.86, 0.97]} scale={[0.55, 0.55, 1]}><primitive object={HEADGLOW} attach="material" /></sprite>
      {/* frame + engine + tank + seat */}
      <mesh position={[0, 0.5, -0.05]} rotation={[1.1, 0, 0]}><cylinderGeometry args={[0.04, 0.04, 1.15, 8]} /><primitive object={DARKTRIM} attach="material" /></mesh>
      <RB args={[0.34, 0.3, 0.52]} radius={0.08} mat={DARKTRIM} pos={[0, 0.4, -0.02]} />
      <mesh position={[0, 0.68, 0.18]} scale={[0.62, 0.5, 1.25]} castShadow><sphereGeometry args={[0.3, 14, 10]} /><primitive object={paint} attach="material" /></mesh>
      <RB args={[0.3, 0.11, 0.62]} radius={0.05} mat={DARKTRIM} pos={[0, 0.74, -0.42]} />
      {/* rear fender + tail light + exhaust */}
      <mesh position={[0, 0.62, -0.86]} rotation={[0.5, 0, 0]}><boxGeometry args={[0.24, 0.05, 0.4]} /><primitive object={paint} attach="material" /></mesh>
      <mesh position={[0, 0.66, -1.02]}><boxGeometry args={[0.16, 0.07, 0.04]} /><primitive object={TAIL} attach="material" /></mesh>
      <mesh position={[0.14, 0.3, -0.35]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.045, 0.055, 0.85, 8]} /><primitive object={CHROME} attach="material" /></mesh>
    </group>
  );
}

/** Rideable bicycle (Phase 6) — torus wheels + tube frame; the rider
 * (Player rig) pedals it. Facing +Z. */
export function BicycleBody({ color }: { color: string }) {
  const paint = useMemo(() => paintMaterial(color, 0.5, 0.35), [color]);
  const tube = (pos: [number, number, number], rot: [number, number, number], len: number) => (
    <mesh position={pos} rotation={rot} castShadow><cylinderGeometry args={[0.028, 0.028, len, 6]} /><primitive object={paint} attach="material" /></mesh>
  );
  return (
    <group>
      {([0.55, -0.55] as const).map((z) => (
        <group key={z} position={[0, 0.34, z]}>
          <mesh castShadow><torusGeometry args={[0.34, 0.03, 6, 16]} /><primitive object={TYRE} attach="material" /></mesh>
          <mesh><boxGeometry args={[0.03, 0.6, 0.03]} /><primitive object={RIM} attach="material" /></mesh>
          <mesh><boxGeometry args={[0.03, 0.03, 0.6]} /><primitive object={RIM} attach="material" /></mesh>
        </group>
      ))}
      {tube([0, 0.62, 0.02], [0.95, 0, 0], 0.72)}
      {tube([0, 0.58, -0.28], [0.35, 0, 0], 0.62)}
      {tube([0, 0.6, 0.3], [-0.5, 0, 0], 0.55)}
      {tube([0, 0.42, -0.02], [1.25, 0, 0], 0.5)}
      <mesh position={[0, 0.86, -0.44]} castShadow><boxGeometry args={[0.26, 0.06, 0.3]} /><primitive object={DARKTRIM} attach="material" /></mesh>
      <mesh position={[0, 0.92, 0.52]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.025, 0.025, 0.44, 6]} /><primitive object={DARKTRIM} attach="material" /></mesh>
      <mesh position={[0, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.05, 0.05, 0.16, 8]} /><primitive object={CHROME} attach="material" /></mesh>
    </group>
  );
}

/** Drivable speedboat (Phase 6) — open skiff: hull, cockpit, windshield,
 * outboard. Buoyancy bob + wake live in Vehicle.tsx. Facing +Z. */
export function BoatBody({ color }: { color: string }) {
  const paint = useMemo(() => paintMaterial(color, 0.2, 0.3), [color]);
  const teak = useMemo(() => new THREE.MeshStandardMaterial({ color: "#6d4c33", roughness: 0.85 }), []);
  return (
    <group>
      <RB args={[2.0, 0.62, 4.4]} radius={0.16} mat={paint} pos={[0, 0.32, -0.2]} />
      <mesh position={[0, 0.42, 2.05]} scale={[1.05, 0.55, 1]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.32, 1.5, 4]} /><primitive object={paint} attach="material" />
      </mesh>
      <RB args={[1.7, 0.3, 2.6]} radius={0.08} mat={teak} pos={[0, 0.62, -0.5]} />
      <RB args={[1.5, 0.34, 0.5]} radius={0.08} mat={DARKTRIM} pos={[0, 0.72, 0.35]} />
      <RB args={[1.5, 0.3, 0.45]} radius={0.08} mat={DARKTRIM} pos={[0, 0.7, -1.15]} />
      <mesh position={[0, 0.95, 0.78]} rotation={[-0.32, 0, 0]}><boxGeometry args={[1.55, 0.5, 0.05]} /><primitive object={GLASS} attach="material" /></mesh>
      {/* outboard motor + stripe */}
      <RB args={[0.44, 0.62, 0.3]} radius={0.08} mat={DARKTRIM} pos={[0, 0.42, -2.5]} />
      <mesh position={[0, 0.52, 0]}><boxGeometry args={[2.02, 0.12, 4.0]} /><meshStandardMaterial color="#c22e2e" roughness={0.5} /></mesh>
      <sprite position={[0, 0.6, 2.6]} scale={[0.8, 0.8, 1]}><primitive object={HEADGLOW} attach="material" /></sprite>
    </group>
  );
}

/** Phase 5 Step 5 night FX: headlight beam cones (additive, cheap) +
 * brake-light boost bar. Traffic gets cones + its own brakeRef; the player
 * fleet gets cones + real SpotLights, gated to the ACTIVE car only. */
function CarFx({ kind, carIndex, brakeRef, beams, spotLights }: {
  kind: CarKind; carIndex?: number;
  brakeRef?: MutableRefObject<boolean>; beams?: boolean; spotLights?: boolean;
}) {
  const s = SHELL[kind];
  const brakeMat = useMemo(() => { const m = TAIL.clone(); m.emissiveIntensity = 3.4; return m; }, []);
  const beamMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffd9a0", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }), []);
  const brakeMesh = useRef<THREE.Mesh>(null);
  const spot = useRef<THREE.SpotLight>(null);
  const spotTarget = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => { if (spot.current) spot.current.target = spotTarget; }, [spotTarget]);
  useFrame(() => {
    const active = carIndex !== undefined && G.driving && G.activeCarId === carIndex;
    const lit = beams || active;
    beamMat.opacity = lit ? G.nightFactor * 0.13 : 0;
    if (spot.current) spot.current.intensity = spotLights && active ? G.nightFactor * 42 : 0;
    if (brakeMesh.current) brakeMesh.current.visible = !!brakeRef?.current && (beams === true || active);
  });
  if (!s) return null;
  const w = s[0] - 0.05, len = s[2], y = s[3] + 0.08;
  return (
    <group>
      {[-1, 1].map((sgn) => (
        <mesh key={sgn} position={[sgn * w * 0.32, y, len / 2 + 2.25]} rotation={[-Math.PI / 2 + 0.045, 0, 0]}>
          <coneGeometry args={[0.62, 4.7, 12, 1, true]} />
          <primitive object={beamMat} attach="material" />
        </mesh>
      ))}
      <mesh ref={brakeMesh} position={[0, y, -len / 2 - 0.045]} visible={false}>
        <boxGeometry args={[w * 0.66, 0.1, 0.03]} />
        <primitive object={brakeMat} attach="material" />
      </mesh>
      {spotLights && (
        <>
          <spotLight ref={spot} position={[0, y + 0.05, len / 2]} angle={0.48} penumbra={0.7} distance={30} decay={1.1} color="#ffd9a0" intensity={0} />
          <primitive object={spotTarget} position={[0, 0, len / 2 + 15]} />
        </>
      )}
    </group>
  );
}

/** Phase 8 exotic — VANTARA S (kind "wedge"): an ORIGINAL Harborfall
 * wedge supercar. Sharp raked nose, wide rear haunches, and scissor
 * doors on front-bottom pivots. DOOR RULE (documented): the doors lift
 * when the player is on foot within ~3.4u (showroom/approach theatre)
 * and during the enter-car slide for the player's own car; they stay
 * shut in traffic and while driving. No real marque's shape, name or
 * badge is used anywhere — the wedge is drawn from Harborfall's own
 * design language (Port Sable teal-era concept cars). */
/** Phase 9: the Harbour Fisher 180 — a working fishing skiff: smaller,
 * canopied, crates + rod holders aboard. Second boat class. */
export function SkiffBody({ color }: { color: string }) {
  const paint = useMemo(() => paintMaterial(color, 0.25, 0.45), [color]);
  const teak = useMemo(() => new THREE.MeshStandardMaterial({ color: "#6d4c33", roughness: 0.85 }), []);
  return (
    <group>
      <RB args={[1.7, 0.55, 3.6]} radius={0.14} mat={paint} pos={[0, 0.3, -0.15]} />
      <mesh position={[0, 0.38, 1.65]} scale={[1.05, 0.5, 1]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.1, 1.2, 4]} /><primitive object={paint} attach="material" />
      </mesh>
      <RB args={[1.45, 0.26, 2.1]} radius={0.07} mat={teak} pos={[0, 0.56, -0.4]} />
      {/* canopy on four posts */}
      {([[-0.62, 0.35], [0.62, 0.35], [-0.62, -1.05], [0.62, -1.05]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 1.05, z]}><boxGeometry args={[0.06, 0.85, 0.06]} /><primitive object={DARKTRIM} attach="material" /></mesh>
      ))}
      <RB args={[1.5, 0.07, 1.7]} radius={0.03} mat={paint} pos={[0, 1.5, -0.35]} />
      {/* fish crates + coiled gear aft */}
      <RB args={[0.55, 0.34, 0.55]} radius={0.04} mat={teak} pos={[-0.4, 0.72, -1.45]} />
      <RB args={[0.5, 0.28, 0.5]} radius={0.04} mat={DARKTRIM} pos={[0.42, 0.7, -1.4]} />
      <mesh position={[0.68, 0.95, -0.9]} rotation={[0.5, 0, 0.15]}><cylinderGeometry args={[0.02, 0.02, 1.1, 5]} /><primitive object={DARKTRIM} attach="material" /></mesh>
      <RB args={[0.38, 0.55, 0.26]} radius={0.07} mat={DARKTRIM} pos={[0, 0.38, -2.05]} />
      <sprite position={[0, 0.55, 2.2]} scale={[0.7, 0.7, 1]}><primitive object={HEADGLOW} attach="material" /></sprite>
    </group>
  );
}

/** Phase 9: the Sable Sparrow — a single-prop harbour plane (original
 * design). The propeller spins with the engine state of the player's
 * plane (carIndex) — parked display copies idle still. */
export function PlaneBody({ color, carIndex }: { color: string; carIndex?: number }) {
  const paint = useMemo(() => paintMaterial(color, 0.3, 0.3), [color]);
  const prop = useRef<THREE.Group>(null);
  const spin = useRef(0);
  useFrame((_, delta) => {
    const spd = carIndex !== undefined && G.cars[carIndex] ? Math.abs(G.cars[carIndex].state.speed) : 0;
    spin.current += delta * (2 + spd * 6);
    if (prop.current) prop.current.rotation.z = spin.current;
  });
  return (
    <group>
      {/* fuselage + tapered tail */}
      <RB args={[1.15, 1.05, 5.6]} radius={0.3} mat={paint} pos={[0, 1.15, 0]} />
      <RB args={[0.6, 0.55, 2.2]} radius={0.2} mat={paint} pos={[0, 1.35, -3.6]} />
      {/* glass canopy */}
      <mesh position={[0, 1.62, 0.55]} scale={[0.52, 0.42, 1.05]} castShadow><sphereGeometry args={[1, 14, 10]} /><primitive object={GLASS} attach="material" /></mesh>
      {/* main wing + tailplane + fin */}
      <RB args={[7.6, 0.12, 1.35]} radius={0.05} mat={paint} pos={[0, 0.92, 0.5]} />
      <RB args={[2.6, 0.1, 0.9]} radius={0.04} mat={paint} pos={[0, 1.5, -4.55]} />
      <RB args={[0.1, 1.15, 0.95]} radius={0.04} mat={paint} pos={[0, 1.95, -4.55]} />
      <mesh position={[0, 1.28, -4.55]}><boxGeometry args={[0.72, 0.16, 0.06]} /><meshStandardMaterial color="#c22e2e" roughness={0.5} /></mesh>
      {/* engine cowling + spinning prop (faces +Z) */}
      <RB args={[1.0, 0.95, 0.7]} radius={0.24} mat={DARKTRIM} pos={[0, 1.15, 2.95]} />
      <group ref={prop} position={[0, 1.15, 3.38]}>
        <mesh rotation={[0, 0, 0]}><boxGeometry args={[0.16, 2.5, 0.05]} /><primitive object={DARKTRIM} attach="material" /></mesh>
        <mesh><sphereGeometry args={[0.17, 10, 8]} /><primitive object={CHROME} attach="material" /></mesh>
      </group>
      {/* fixed gear: two mains + tail wheel, with struts */}
      {([-0.85, 0.85] as const).map((x, i) => (
        <group key={i}>
          <mesh position={[x, 0.55, 0.9]} rotation={[0, 0, x > 0 ? -0.25 : 0.25]}><cylinderGeometry args={[0.05, 0.05, 0.85, 6]} /><primitive object={CHROME} attach="material" /></mesh>
          <mesh position={[x * 1.12, 0.24, 0.9]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.24, 0.24, 0.14, 12]} /><primitive object={TYRE} attach="material" /></mesh>
        </group>
      ))}
      <mesh position={[0, 0.62, -4.3]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.13, 0.13, 0.1, 10]} /><primitive object={TYRE} attach="material" /></mesh>
      {/* nav lights: teal port-side harbour convention is fiction — use
          standard aviation red/green tips */}
      <sprite position={[-3.85, 0.95, 0.5]} scale={[0.5, 0.5, 1]}><primitive object={TAILGLOW} attach="material" /></sprite>
      <sprite position={[3.85, 0.95, 0.5]} scale={[0.5, 0.5, 1]}><spriteMaterial map={glowTexture()} color="#39d353" transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
    </group>
  );
}

export function WedgeBody({ color, carIndex, steerRef, liveDamage, brakeRef, beams, spotLights }: {
  color: string; carIndex?: number; steerRef?: MutableRefObject<number>;
  liveDamage?: () => number; brakeRef?: MutableRefObject<boolean>; beams?: boolean; spotLights?: boolean;
}) {
  const paint = useMemo(() => paintMaterial(color, 0.35, 0.22), [color]);
  const root = useRef<THREE.Group>(null);
  const doorL = useRef<THREE.Group>(null);
  const doorR = useRef<THREE.Group>(null);
  const open = useRef(0);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, delta) => {
    let want = 0;
    if (carIndex !== undefined && G.driving && G.activeCarId === carIndex) want = G.enterAnimT > 0 ? 1 : 0;
    else if (!G.driving && root.current) {
      root.current.getWorldPosition(tmp);
      want = (tmp.x - G.playerPos.x) ** 2 + (tmp.z - G.playerPos.z) ** 2 < 3.4 ** 2 ? 1 : 0;
    }
    open.current += (want - open.current) * Math.min(1, delta * 5);
    if (doorL.current) doorL.current.rotation.z = open.current * 1.12;
    if (doorR.current) doorR.current.rotation.z = -open.current * 1.12;
  });
  const doorPanel = (side: -1 | 1) => (
    <group ref={side < 0 ? doorL : doorR} position={[side * 1.1, 0.52, 0.55]}>
      <RB args={[0.07, 0.46, 1.3]} radius={0.03} mat={paint} pos={[0, 0.16, -0.5]} />
      <mesh position={[side * 0.045, 0.3, -0.42]}><boxGeometry args={[0.02, 0.2, 0.7]} /><primitive object={GLASS} attach="material" /></mesh>
    </group>
  );
  return (
    <group ref={root}>
      {/* raked wedge nose: two stacked, forward-pitched slabs */}
      <RB args={[2.14, 0.34, 4.5]} radius={0.1} mat={paint} pos={[0, 0.42, 0]} />
      <RB args={[1.98, 0.2, 1.7]} radius={0.07} mat={paint} pos={[0, 0.5, 1.5]} rot={[0.22, 0, 0]} />
      {/* wide rear haunches */}
      <RB args={[2.34, 0.4, 1.5]} radius={0.12} mat={paint} pos={[0, 0.5, -1.5]} />
      {/* glass canopy, teardrop-leaning */}
      <mesh position={[0, 0.72, -0.15]} scale={[1.35, 0.58, 1.85]} castShadow><sphereGeometry args={[0.55, 16, 12]} /><primitive object={GLASS} attach="material" /></mesh>
      <mesh position={[0, 0.3, 0]}><boxGeometry args={[2.3, 0.15, 3.6]} /><primitive object={BUMPER} attach="material" /></mesh>
      {/* fixed rear wing on twin pylons + full-width light bar */}
      <RB args={[2.2, 0.06, 0.4]} radius={0.03} mat={BUMPER} pos={[0, 0.92, -2.08]} />
      <mesh position={[-0.75, 0.74, -2.05]}><boxGeometry args={[0.08, 0.3, 0.08]} /><primitive object={BUMPER} attach="material" /></mesh>
      <mesh position={[0.75, 0.74, -2.05]}><boxGeometry args={[0.08, 0.3, 0.08]} /><primitive object={BUMPER} attach="material" /></mesh>
      {doorPanel(-1)}{doorPanel(1)}
      <LightsBumpers w={2.2} len={4.5} y={0.46} />
      <Wheel x={-1.12} z={1.5} r={0.37} w={0.3} steerRef={steerRef} carIndex={carIndex} />
      <Wheel x={1.12} z={1.5} r={0.37} w={0.3} steerRef={steerRef} carIndex={carIndex} />
      <Wheel x={-1.17} z={-1.5} r={0.42} w={0.42} />
      <Wheel x={1.17} z={-1.5} r={0.42} w={0.42} />
      <ArchesSkirts w={2.25} len={4.5} r={0.4} />
      <DirtShell kind="wedge" liveDamage={liveDamage} />
      {(beams || spotLights || brakeRef) ? <CarFx kind="wedge" carIndex={carIndex} brakeRef={brakeRef} beams={beams} spotLights={spotLights} /> : null}
    </group>
  );
}

/** Phase 8 exotic — KESTREL ONE (kind "hyper"): an ORIGINAL Harborfall
 * hypercar. Smooth teardrop canopy, flush surfaces, and an ACTIVE rear
 * wing that rises + tilts with road speed (player fleet; parked and
 * showpiece cars keep it stowed). */
export function HyperBody({ color, carIndex, steerRef, liveDamage, brakeRef, beams, spotLights }: {
  color: string; carIndex?: number; steerRef?: MutableRefObject<number>;
  liveDamage?: () => number; brakeRef?: MutableRefObject<boolean>; beams?: boolean; spotLights?: boolean;
}) {
  const paint = useMemo(() => paintMaterial(color, 0.4, 0.18), [color]);
  const wing = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!wing.current) return;
    const spd = carIndex !== undefined ? Math.abs(G.cars[carIndex]?.state.speed ?? 0) : 0;
    const f = THREE.MathUtils.clamp(spd / 22, 0, 1);
    wing.current.position.y = 0.82 + f * 0.17;
    wing.current.rotation.x = -0.06 - f * 0.16;
  });
  return (
    <group>
      <RB args={[2.2, 0.36, 4.4]} radius={0.16} mat={paint} pos={[0, 0.42, 0]} />
      <RB args={[2.0, 0.18, 1.5]} radius={0.09} mat={paint} pos={[0, 0.47, 1.55]} rot={[0.13, 0, 0]} />
      {/* teardrop canopy: one long scaled sphere, nose-tapered */}
      <mesh position={[0, 0.66, -0.3]} scale={[1.3, 0.6, 2.1]} castShadow><sphereGeometry args={[0.56, 18, 12]} /><primitive object={GLASS} attach="material" /></mesh>
      <mesh position={[0, 0.3, 0]}><boxGeometry args={[2.24, 0.15, 3.5]} /><primitive object={BUMPER} attach="material" /></mesh>
      {/* engine-cover spine fin */}
      <mesh position={[0, 0.78, -1.35]}><boxGeometry args={[0.07, 0.22, 1.15]} /><primitive object={paint} attach="material" /></mesh>
      {/* active rear wing */}
      <group ref={wing} position={[0, 0.82, -2.02]}>
        <RB args={[2.15, 0.05, 0.42]} radius={0.02} mat={BUMPER} pos={[0, 0, 0]} />
        <mesh position={[-0.7, -0.13, 0]}><boxGeometry args={[0.07, 0.26, 0.07]} /><primitive object={BUMPER} attach="material" /></mesh>
        <mesh position={[0.7, -0.13, 0]}><boxGeometry args={[0.07, 0.26, 0.07]} /><primitive object={BUMPER} attach="material" /></mesh>
      </group>
      <LightsBumpers w={2.2} len={4.4} y={0.47} />
      <Mirrors w={2.2} y={0.8} z={0.5} />
      <Wheel x={-1.1} z={1.48} r={0.38} w={0.3} steerRef={steerRef} carIndex={carIndex} />
      <Wheel x={1.1} z={1.48} r={0.38} w={0.3} steerRef={steerRef} carIndex={carIndex} />
      <Wheel x={-1.12} z={-1.48} r={0.43} w={0.44} />
      <Wheel x={1.12} z={-1.48} r={0.43} w={0.44} />
      <ArchesSkirts w={2.22} len={4.4} r={0.4} />
      <DirtShell kind="hyper" liveDamage={liveDamage} />
      {(beams || spotLights || brakeRef) ? <CarFx kind="hyper" carIndex={carIndex} brakeRef={brakeRef} beams={beams} spotLights={spotLights} /> : null}
    </group>
  );
}

export default function CarBody({ kind, color, police, steerRef, liveDamage, brokenWindow, interior, carIndex, brakeRef, beams, spotLights }: {
  kind: CarKind; color: string; police?: boolean;
  steerRef?: MutableRefObject<number>; liveDamage?: () => number;
  brokenWindow?: boolean; interior?: boolean; carIndex?: number;
  brakeRef?: MutableRefObject<boolean>; beams?: boolean; spotLights?: boolean;
}) {
  // deep glossy paint: clearcoat physical material on Medium/High (Step 5)
  const paint = useMemo(() => paintMaterial(color), [color]);
  if (kind === "motorcycle") return <MotorcycleBody color={color} />;
  if (kind === "bicycle") return <BicycleBody color={color} />;
  if (kind === "boat") return <BoatBody color={color} />;
  if (kind === "skiff") return <SkiffBody color={color} />;
  if (kind === "plane") return <PlaneBody color={color} carIndex={carIndex} />;
  if (kind === "wedge") return <WedgeBody color={color} carIndex={carIndex} steerRef={steerRef} liveDamage={liveDamage} brakeRef={brakeRef} beams={beams} spotLights={spotLights} />;
  if (kind === "hyper") return <HyperBody color={color} carIndex={carIndex} steerRef={steerRef} liveDamage={liveDamage} brakeRef={brakeRef} beams={beams} spotLights={spotLights} />;
  const classic = kind === "classic";
  const glassMat = brokenWindow ? GLASS_BROKEN : interior ? GLASS_CLEAR : GLASS;
  let body: ReactNode = null;
  let wheels: ReactNode = null;
  const wheelSet = (w: number, len: number, r: number, ww: number, rearR?: number, rearW?: number) => (
    <>
      <Wheel x={-w / 2 - 0.02} z={len / 2 - 0.72} r={r} w={ww} classic={classic} steerRef={steerRef} carIndex={carIndex} />
      <Wheel x={w / 2 + 0.02} z={len / 2 - 0.72} r={r} w={ww} classic={classic} steerRef={steerRef} carIndex={carIndex} />
      <Wheel x={-w / 2 - 0.02} z={-len / 2 + 0.72} r={rearR ?? r} w={rearW ?? ww} classic={classic} />
      <Wheel x={w / 2 + 0.02} z={-len / 2 + 0.72} r={rearR ?? r} w={rearW ?? ww} classic={classic} />
      <ArchesSkirts w={w} len={len} r={r} />
    </>
  );

  switch (kind) {
    case "supercar":
      body = (<>
        {/* Phase 5: deeper bevels (radius 0.17) — the sanctioned fallback for
            extruded side profiles; silhouette reads rounder at glancing light */}
        <RB args={[2.2, 0.42, 4.3]} radius={0.17} mat={paint} pos={[0, 0.44, 0]} />
        <RB args={[2.02, 0.2, 1.15]} radius={0.08} mat={paint} pos={[0, 0.4, 1.72]} rot={[0.16, 0, 0]} />
        {/* curved glass canopy (scaled sphere) instead of a glass box */}
        <mesh position={[0, 0.68, -0.28]} scale={[1.42, 0.62, 1.7]} castShadow><sphereGeometry args={[0.55, 16, 12]} /><primitive object={glassMat} attach="material" /></mesh>
        <mesh position={[0, 0.3, 0]}><boxGeometry args={[2.24, 0.16, 3.4]} /><primitive object={BUMPER} attach="material" /></mesh>
        <RB args={[2.15, 0.07, 0.44]} radius={0.03} mat={BUMPER} pos={[0, 0.98, -2.02]} />
        <mesh position={[-0.8, 0.8, -1.95]}><boxGeometry args={[0.09, 0.3, 0.09]} /><primitive object={BUMPER} attach="material" /></mesh>
        <mesh position={[0.8, 0.8, -1.95]}><boxGeometry args={[0.09, 0.3, 0.09]} /><primitive object={BUMPER} attach="material" /></mesh>
        <LightsBumpers w={2.2} len={4.3} y={0.48} />
        <Mirrors w={2.2} y={0.78} z={0.55} />
      </>); wheels = wheelSet(2.2, 4.3, 0.37, 0.3, 0.42, 0.4); break;
    case "muscle":
      body = (<>
        <RB args={[2.05, 0.62, 4.4]} radius={0.1} mat={paint} pos={[0, 0.62, 0]} />
        <RB args={[1.94, 0.18, 1.5]} radius={0.07} mat={paint} pos={[0, 0.9, 1.32]} rot={[0.07, 0, 0]} />{/* long sloped hood */}
        <mesh position={[0, 0.99, 0.75]} castShadow><boxGeometry args={[0.72, 0.13, 1.05]} /><primitive object={BUMPER} attach="material" /></mesh>
        <RB args={[1.68, 0.5, 1.5]} radius={0.13} mat={glassMat} pos={[0, 1.12, -0.6]} />
        <LightsBumpers w={2.05} len={4.4} y={0.66} />
        <Mirrors w={2.05} y={1.18} z={0.1} />
      </>); wheels = wheelSet(2.05, 4.4, 0.4, 0.3); break;
    case "suv":
      body = (<>
        <RB args={[2.1, 0.88, 4.2]} radius={0.11} mat={paint} pos={[0, 0.78, 0]} />
        <RB args={[1.98, 0.22, 1.3]} radius={0.08} mat={paint} pos={[0, 1.06, 1.5]} rot={[0.1, 0, 0]} />
        <RB args={[1.92, 0.6, 2.5]} radius={0.1} mat={glassMat} pos={[0, 1.5, -0.15]} />
        <mesh position={[-0.7, 1.85, -0.15]}><boxGeometry args={[0.07, 0.06, 2.3]} /><primitive object={CHROME} attach="material" /></mesh>
        <mesh position={[0.7, 1.85, -0.15]}><boxGeometry args={[0.07, 0.06, 2.3]} /><primitive object={CHROME} attach="material" /></mesh>
        <LightsBumpers w={2.1} len={4.2} y={0.82} />
        <Mirrors w={2.1} y={1.45} z={1.05} />
      </>); wheels = wheelSet(2.1, 4.2, 0.45, 0.3); break;
    case "classic":
      body = (<>
        <RB args={[1.95, 0.56, 4.5]} radius={0.12} mat={paint} pos={[0, 0.6, 0]} />
        <RB args={[2.0, 0.17, 2.7]} radius={0.07} mat={paint} pos={[0, 0.95, 0]} />
        <RB args={[1.66, 0.48, 1.8]} radius={0.14} mat={glassMat} pos={[0, 1.14, -0.2]} />
        <LightsBumpers w={1.95} len={4.5} y={0.64} classic />
        <Mirrors w={1.95} y={1.2} z={0.65} />
      </>); wheels = wheelSet(1.95, 4.5, 0.38, 0.26); break;
    case "pickup":
      body = (<>
        <RB args={[2.1, 0.72, 4.1]} radius={0.09} mat={paint} pos={[0, 0.68, 0]} />
        <RB args={[1.85, 0.55, 1.35]} radius={0.11} mat={glassMat} pos={[0, 1.28, 0.85]} />
        <mesh position={[0, 1.0, -1.15]}><boxGeometry args={[1.9, 0.34, 1.5]} /><meshStandardMaterial color="#4c3b28" roughness={0.9} /></mesh>
        <LightsBumpers w={2.1} len={4.1} y={0.7} />
        <Mirrors w={2.1} y={1.3} z={1.45} />
      </>); wheels = wheelSet(2.1, 4.1, 0.42, 0.3); break;
    case "van":
      body = (<>
        <RB args={[2.1, 1.12, 4.2]} radius={0.12} mat={paint} pos={[0, 0.92, 0]} />
        <RB args={[1.9, 0.24, 1.15]} radius={0.09} mat={paint} pos={[0, 1.32, 1.55]} rot={[0.13, 0, 0]} />
        <mesh position={[0, 1.12, 1.95]}><boxGeometry args={[1.85, 0.55, 0.3]} /><primitive object={glassMat} attach="material" /></mesh>
        <LightsBumpers w={2.1} len={4.2} y={0.66} />
        <Mirrors w={2.1} y={1.3} z={1.9} />
      </>); wheels = wheelSet(2.1, 4.2, 0.4, 0.28); break;
    case "hatch":
      body = (<>
        <RB args={[1.9, 0.6, 3.15]} radius={0.1} mat={paint} pos={[0, 0.62, 0]} />
        <RB args={[1.8, 0.18, 1.0]} radius={0.07} mat={paint} pos={[0, 0.88, 1.12]} rot={[0.1, 0, 0]} />
        <RB args={[1.66, 0.52, 1.85]} radius={0.13} mat={glassMat} pos={[0, 1.14, -0.15]} />
        <LightsBumpers w={1.9} len={3.15} y={0.64} />
        <Mirrors w={1.9} y={1.18} z={0.7} />
      </>); wheels = wheelSet(1.9, 3.15, 0.35, 0.24); break;
    case "coupe":
      body = (<>
        <RB args={[2.0, 0.46, 3.9]} radius={0.15} mat={paint} pos={[0, 0.52, 0]} />
        <RB args={[1.9, 0.16, 1.2]} radius={0.06} mat={paint} pos={[0, 0.72, 1.3]} rot={[0.09, 0, 0]} />
        <RB args={[1.62, 0.44, 1.55]} radius={0.18} mat={glassMat} pos={[0, 0.94, -0.35]} />
        <LightsBumpers w={2.0} len={3.9} y={0.56} />
        <Mirrors w={2.0} y={1.0} z={0.4} />
      </>); wheels = wheelSet(2.0, 3.9, 0.37, 0.26); break;
    case "taxi":
      body = (<>
        <RB args={[2.0, 0.58, 3.7]} radius={0.1} mat={paint} pos={[0, 0.6, 0]} />
        <RB args={[1.9, 0.17, 1.25]} radius={0.07} mat={paint} pos={[0, 0.85, 1.28]} rot={[0.08, 0, 0]} />
        <RB args={[1.7, 0.5, 1.8]} radius={0.14} mat={glassMat} pos={[0, 1.1, -0.12]} />
        {/* checker stripe + roof sign — Sable Cab livery */}
        <mesh position={[0, 0.52, 0]}><boxGeometry args={[2.02, 0.16, 3.72]} /><meshStandardMaterial color="#14161a" roughness={0.6} /></mesh>
        <RB args={[0.72, 0.2, 0.3]} radius={0.04} mat={HEAD} pos={[0, 1.48, -0.12]} />
        <LightsBumpers w={2.0} len={3.7} y={0.62} />
        <Mirrors w={2.0} y={1.14} z={0.72} />
      </>); wheels = wheelSet(2.0, 3.7, 0.36, 0.25); break;
    case "bus":
      body = (<>
        {/* Sable Cityliner: long single-decker, window band, route box */}
        <RB args={[2.45, 1.35, 7.0]} radius={0.12} mat={paint} pos={[0, 1.05, 0]} />
        <RB args={[2.5, 0.78, 6.7]} radius={0.08} mat={glassMat} pos={[0, 1.95, -0.1]} />
        <mesh position={[0, 1.85, 3.52]}><boxGeometry args={[2.0, 0.85, 0.06]} /><primitive object={glassMat} attach="material" /></mesh>
        <RB args={[1.5, 0.34, 0.08]} radius={0.03} mat={HEAD} pos={[0, 2.62, 3.5]} />
        <mesh position={[1.24, 1.15, 1.6]}><boxGeometry args={[0.04, 1.5, 1.1]} /><meshStandardMaterial color="#141f28" roughness={0.2} metalness={0.4} /></mesh>
        <mesh position={[0, 0.42, 0]}><boxGeometry args={[2.47, 0.3, 7.02]} /><meshStandardMaterial color="#f2f4f6" roughness={0.5} /></mesh>
        <LightsBumpers w={2.45} len={7.0} y={0.72} />
        <Mirrors w={2.45} y={2.1} z={3.2} />
      </>); wheels = wheelSet(2.45, 7.0, 0.5, 0.32); break;
    case "gt":
      // Phase 8: MARLOWE GT — original luxury grand tourer: LONG bonnet,
      // cabin set well back, fastback tail, chrome brightwork.
      body = (<>
        <RB args={[2.0, 0.52, 4.6]} radius={0.12} mat={paint} pos={[0, 0.56, 0]} />
        <RB args={[1.9, 0.16, 2.1]} radius={0.07} mat={paint} pos={[0, 0.78, 0.95]} rot={[0.05, 0, 0]} />{/* the long bonnet */}
        <mesh position={[0, 0.86, 1.35]}><boxGeometry args={[0.1, 0.05, 1.6]} /><primitive object={CHROME} attach="material" /></mesh>
        <RB args={[1.62, 0.46, 1.6]} radius={0.17} mat={glassMat} pos={[0, 0.98, -0.75]} />
        <RB args={[1.85, 0.14, 0.9]} radius={0.06} mat={paint} pos={[0, 0.72, -1.95]} rot={[-0.1, 0, 0]} />{/* fastback deck */}
        <mesh position={[0, 0.62, 0]}><boxGeometry args={[2.02, 0.07, 4.62]} /><primitive object={CHROME} attach="material" /></mesh>
        <LightsBumpers w={2.0} len={4.6} y={0.6} />
        <Mirrors w={2.0} y={1.05} z={0.05} />
      </>); wheels = wheelSet(2.0, 4.6, 0.38, 0.27); break;
    case "tow":
      // Phase 8: SABLE WRECKER — pickup cab + flat hook bed: crane jib,
      // winch drum and a dangling hook over the bed (the towed car itself
      // is positioned by the Phase 8 tether in Phase8.tsx / Vehicle.tsx).
      body = (<>
        <RB args={[2.1, 0.72, 4.1]} radius={0.09} mat={paint} pos={[0, 0.68, 0]} />
        <RB args={[1.85, 0.55, 1.35]} radius={0.11} mat={glassMat} pos={[0, 1.28, 0.85]} />
        {/* flat steel bed behind the cab */}
        <mesh position={[0, 0.78, -1.25]}><boxGeometry args={[1.95, 0.12, 1.6]} /><primitive object={DARKTRIM} attach="material" /></mesh>
        <mesh position={[-0.93, 0.95, -1.25]}><boxGeometry args={[0.08, 0.4, 1.6]} /><primitive object={BUMPER} attach="material" /></mesh>
        <mesh position={[0.93, 0.95, -1.25]}><boxGeometry args={[0.08, 0.4, 1.6]} /><primitive object={BUMPER} attach="material" /></mesh>
        {/* crane jib + winch + hook */}
        <mesh position={[0, 1.62, -0.62]} rotation={[0.5, 0, 0]} castShadow><boxGeometry args={[0.14, 0.14, 1.5]} /><primitive object={CHROME} attach="material" /></mesh>
        <mesh position={[0, 1.28, -0.5]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.13, 0.13, 0.5, 10]} /><primitive object={DARKTRIM} attach="material" /></mesh>
        <mesh position={[0, 1.28, -1.32]}><boxGeometry args={[0.03, 0.55, 0.03]} /><primitive object={DARKTRIM} attach="material" /></mesh>
        <mesh position={[0, 0.98, -1.32]}><boxGeometry args={[0.12, 0.16, 0.06]} /><primitive object={CHROME} attach="material" /></mesh>
        {/* amber beacon */}
        <RB args={[0.5, 0.12, 0.24]} radius={0.04} mat={HEAD} pos={[0, 1.62, 0.85]} />
        <LightsBumpers w={2.1} len={4.1} y={0.7} />
        <Mirrors w={2.1} y={1.3} z={1.45} />
      </>); wheels = wheelSet(2.1, 4.1, 0.42, 0.3); break;
    default: // sedan
      body = (<>
        <RB args={[2.0, 0.58, 3.7]} radius={0.1} mat={paint} pos={[0, 0.6, 0]} />
        <RB args={[1.9, 0.17, 1.25]} radius={0.07} mat={paint} pos={[0, 0.85, 1.28]} rot={[0.08, 0, 0]} />{/* sloped hood */}
        <RB args={[1.7, 0.5, 1.8]} radius={0.14} mat={glassMat} pos={[0, 1.1, -0.12]} />
        {police && <mesh position={[0, 0.6, 0.1]}><boxGeometry args={[2.03, 0.34, 1.75]} /><meshStandardMaterial color="#f2f4f6" roughness={0.4} /></mesh>}
        <LightsBumpers w={2.0} len={3.7} y={0.62} />
        <Mirrors w={2.0} y={1.14} z={0.72} />
      </>); wheels = wheelSet(2.0, 3.7, 0.36, 0.25); break;
  }
  const cabin = CABIN_POS[kind];
  return (<group>{body}{wheels}{interior && cabin ? <CabinInterior y={cabin.y} z={cabin.z} w={cabin.w} steerRef={steerRef} carIndex={carIndex} /> : null}<DirtShell kind={kind} liveDamage={liveDamage} />{(beams || spotLights || brakeRef) ? <CarFx kind={kind} carIndex={carIndex} brakeRef={brakeRef} beams={beams} spotLights={spotLights} /> : null}</group>);
}
