import { useEffect, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PhysicsEngine } from "../physics/GamePhysics";
import { isInteractiveTarget, normalizeGameKey } from "../keyboard";
import { isBlocked } from "../world";
import { G, addCrime } from "../game/store";
import { sfx } from "../game/audio";

interface Props {
  playerPositionRef: MutableRefObject<THREE.Vector3>;
  vehiclePositionRef: MutableRefObject<THREE.Vector3>;
  vehicleStateRef: MutableRefObject<{ x: number; z: number; heading: number; speed: number }>;
  driving: boolean; paused: boolean;
  onDrivingChange: (d: boolean) => void;
  onExit: (p: THREE.Vector3) => void;
  onNearVehicleChange: (n: boolean) => void;
  physicsRef: MutableRefObject<PhysicsEngine>;
  themeAccent: string;
}
const DIMS: Record<string, [number, number, number, number]> = {
  // width, bodyH, length, cabinLen
  sedan: [2, 0.62, 3.6, 1.8], hatch: [1.9, 0.7, 3.1, 1.9], coupe: [2, 0.5, 3.8, 1.4], pickup: [2.1, 0.75, 4.1, 1.2], van: [2.1, 1.05, 4.2, 2.6],
};

export default function Vehicle(p: Props) {
  const groups = useRef<Array<THREE.Group | null>>([]);
  const keys = useRef(new Set<string>());
  const refs = useRef(p); refs.current = p;
  const nearRef = useRef(false);
  const wasBlocked = useRef(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (refs.current.paused || G.dialogueActive || isInteractiveTarget(e.target)) return;
      const key = normalizeGameKey(e.key);
      if (["w", "a", "s", "d", " "].includes(key) && G.driving) { e.preventDefault(); keys.current.add(key); }
      if (key === "b" && G.driving && !e.repeat) { sfx.horn(); e.preventDefault(); }
      if ((key === "e" || key === "f") && !e.repeat) {
        if (G.driving) {
          const car = G.cars[G.activeCarId];
          const exit = new THREE.Vector3(car.state.x + Math.cos(car.state.heading) * 2.4, 0, car.state.z - Math.sin(car.state.heading) * 2.4);
          G.driving = false; refs.current.onDrivingChange(false); refs.current.onExit(exit);
          G.playerPos.copy(exit); keys.current.clear(); sfx.door(); e.preventDefault(); return;
        }
        const pl = refs.current.playerPositionRef.current;
        let best = -1; let bestD = 3.6 ** 2;
        G.cars.forEach((c, i) => { const d = (c.state.x - pl.x) ** 2 + (c.state.z - pl.z) ** 2; if (d < bestD) { bestD = d; best = i; } });
        if (best >= 0) {
          G.activeCarId = best; G.driving = true; refs.current.onDrivingChange(true); sfx.door();
          if (!G.cars[best].owned && !G.cars[best].stolen) { G.cars[best].stolen = true; addCrime("steal"); sfx.crime(); }
          e.preventDefault();
        }
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(normalizeGameKey(e.key));
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, []);

  useFrame((_, delta) => {
    const { paused, physicsRef, vehicleStateRef, vehiclePositionRef } = refs.current;
    if (G.driving && !paused && !G.dialogueActive && G.activeCarId >= 0) {
      const car = G.cars[G.activeCarId];
      const k = keys.current;
      const throttle = Number(k.has("w")) - Number(k.has("s"));
      const steering = Number(k.has("a")) - Number(k.has("d"));
      const next = physicsRef.current.stepVehicle(car.state, throttle, steering, k.has(" "), delta);
      next.x = THREE.MathUtils.clamp(next.x, -122, 122);
      next.z = THREE.MathUtils.clamp(next.z, -122, 126);
      if (isBlocked(next.x, next.z, 1.3)) {
        if (!wasBlocked.current && Math.abs(car.state.speed) > 6) { G.eventQueue.push("shake", "hitwall"); G.health = Math.max(0, G.health - 4); }
        wasBlocked.current = true;
        next.x = car.state.x; next.z = car.state.z; next.speed = -car.state.speed * 0.25;
      } else wasBlocked.current = false;
      car.state = next;
      vehicleStateRef.current = next;
      vehiclePositionRef.current.set(next.x, 0, next.z);
      G.followPos.set(next.x, 0, next.z);
      G.speedKph = Math.round(Math.abs(next.speed) * 3.6);
    } else if (!G.driving) G.speedKph = 0;
    // near-car prompt
    if (!G.driving) {
      const pl = refs.current.playerPositionRef.current;
      const near = G.cars.some((c) => (c.state.x - pl.x) ** 2 + (c.state.z - pl.z) ** 2 <= 3.6 ** 2);
      if (near !== nearRef.current) { nearRef.current = near; refs.current.onNearVehicleChange(near); }
    } else if (nearRef.current) { nearRef.current = false; refs.current.onNearVehicleChange(false); }
    G.cars.forEach((c, i) => {
      const g = groups.current[i]; if (!g) return;
      g.position.set(c.state.x, 0, c.state.z); g.rotation.y = c.state.heading;
    });
  });

  return (
    <>
      {G.cars.map((c, i) => {
        const [w, h, len, cab] = DIMS[c.kind];
        const isActive = G.activeCarId === i;
        return (
          <group key={c.id} ref={(n) => { groups.current[i] = n; }} position={[c.state.x, 0, c.state.z]} rotation={[0, c.state.heading, 0]}>
            <mesh position={[0, 0.35 + h / 2, 0]} castShadow><boxGeometry args={[w, h, len]} /><meshStandardMaterial color={c.color} flatShading metalness={0.25} roughness={0.4} /></mesh>
            <mesh position={[0, 0.35 + h + 0.26, c.kind === "pickup" ? len / 2 - cab / 2 - 0.15 : -0.1]} castShadow>
              <boxGeometry args={[w * 0.76, 0.52, cab]} /><meshStandardMaterial color="#bfe3ea" metalness={0.3} roughness={0.2} />
            </mesh>
            {c.kind === "pickup" && <mesh position={[0, 0.85, -len / 2 + 0.8]}><boxGeometry args={[w * 0.9, 0.3, 1.4]} /><meshStandardMaterial color="#5a4632" flatShading /></mesh>}
            <mesh position={[0, 0.32, len / 2 + 0.02]}><boxGeometry args={[w * 0.85, 0.18, 0.1]} /><meshStandardMaterial color="#ffe9a8" emissive="#ffca7a" emissiveIntensity={0.9} /></mesh>
            <mesh position={[0, 0.32, -len / 2 - 0.02]}><boxGeometry args={[w * 0.85, 0.18, 0.1]} /><meshStandardMaterial color="#ff4444" emissive="#cc0000" emissiveIntensity={0.6} /></mesh>
            {isActive && <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.2, 2.45, 24]} /><meshBasicMaterial color={p.themeAccent} transparent opacity={0.85} /></mesh>}
            {[-1, 1].map((s) => [-1, 1].map((a) => (
              <mesh key={`${s}${a}`} position={[s * (w / 2 + 0.06), 0.36, a * (len / 2 - 0.65)]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.36, 0.36, 0.22, 10]} /><meshStandardMaterial color="#1d2124" flatShading />
              </mesh>
            )))}
          </group>
        );
      })}
    </>
  );
}
