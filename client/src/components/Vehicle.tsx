import { useEffect, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PhysicsEngine, VehicleState } from "../physics/GamePhysics";
import { isInteractiveTarget, normalizeGameKey } from "../keyboard";
import { isBlocked } from "../world";

interface VehicleProps {
  playerPositionRef: MutableRefObject<THREE.Vector3>;
  vehiclePositionRef: MutableRefObject<THREE.Vector3>;
  vehicleStateRef: MutableRefObject<VehicleState>;
  driving: boolean;
  paused: boolean;
  onDrivingChange: (driving: boolean) => void;
  onExit: (position: THREE.Vector3) => void;
  onNearVehicleChange: (near: boolean) => void;
  physicsRef: MutableRefObject<PhysicsEngine>;
}

const initialState: VehicleState = { x: 2, z: 4, heading: 0, speed: 0 };

export default function Vehicle({
  playerPositionRef,
  vehiclePositionRef,
  vehicleStateRef,
  driving,
  paused,
  onDrivingChange,
  onExit,
  onNearVehicleChange,
  physicsRef,
}: VehicleProps) {
  const body = useRef<THREE.Group>(null);
  const frontWheels = useRef<THREE.Group[]>([]);
  const keys = useRef(new Set<string>());
  const drivingRef = useRef(driving);
  const pausedRef = useRef(paused);
  const nearVehicleRef = useRef(false);
  const callbacks = useRef({ onDrivingChange, onExit, onNearVehicleChange });

  useEffect(() => {
    drivingRef.current = driving;
    pausedRef.current = paused;
    callbacks.current = { onDrivingChange, onExit, onNearVehicleChange };
    if (paused) keys.current.clear();
  }, [driving, onDrivingChange, onExit, onNearVehicleChange, paused]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (pausedRef.current || isInteractiveTarget(event.target)) return;
      const key = normalizeGameKey(event.key);
      if (["w", "a", "s", "d", " "].includes(key) && drivingRef.current) {
        event.preventDefault();
        keys.current.add(key);
      }
      if (key !== "e" || event.repeat) return;
      if (drivingRef.current) {
        const state = vehicleStateRef.current;
        const exit = new THREE.Vector3(
          state.x + Math.cos(state.heading) * 2.2,
          0,
          state.z - Math.sin(state.heading) * 2.2,
        );
        callbacks.current.onDrivingChange(false);
        callbacks.current.onExit(exit);
        keys.current.clear();
        event.preventDefault();
        return;
      }
      const player = playerPositionRef.current;
      const state = vehicleStateRef.current;
      if (physicsRef.current.distanceSquared(player.x, player.z, state.x, state.z) <= 3.3 ** 2) {
        callbacks.current.onDrivingChange(true);
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(normalizeGameKey(event.key));
    const onBlur = () => keys.current.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [physicsRef, playerPositionRef, vehicleStateRef]);

  useFrame((_, delta) => {
    if (driving && !paused) {
      const pressed = keys.current;
      const throttle = Number(pressed.has("w")) - Number(pressed.has("s"));
      const steering = Number(pressed.has("a")) - Number(pressed.has("d"));
      const next = physicsRef.current.stepVehicle(
        vehicleStateRef.current,
        throttle,
        steering,
        pressed.has(" "),
        delta,
      );
      next.x = THREE.MathUtils.clamp(next.x, -65, 65);
      next.z = THREE.MathUtils.clamp(next.z, -65, 65);
      if (isBlocked(next.x, next.z, 1.25)) {
        next.x = vehicleStateRef.current.x;
        next.z = vehicleStateRef.current.z;
        next.speed = 0;
      }
      vehicleStateRef.current = next;
      vehiclePositionRef.current.set(next.x, 0, next.z);
    }
    const nearVehicle = !driving &&
      physicsRef.current.distanceSquared(
        playerPositionRef.current.x,
        playerPositionRef.current.z,
        vehicleStateRef.current.x,
        vehicleStateRef.current.z,
      ) <= 3.3 ** 2;
    if (nearVehicle !== nearVehicleRef.current) {
      nearVehicleRef.current = nearVehicle;
      callbacks.current.onNearVehicleChange(nearVehicle);
    }
    if (body.current) {
      body.current.position.copy(vehiclePositionRef.current);
      body.current.rotation.y = vehicleStateRef.current.heading;
    }
    const steerAngle = driving && !paused
      ? (Number(keys.current.has("a")) - Number(keys.current.has("d"))) * 0.35
      : 0;
    for (const wheel of frontWheels.current) {
      if (wheel) wheel.rotation.y = steerAngle;
    }
  });

  const addFrontWheel = (index: number) => (node: THREE.Group | null) => {
    if (node) frontWheels.current[index] = node;
  };

  return (
    <group ref={body} position={[initialState.x, 0, initialState.z]}>
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[2, 0.62, 3.5]} />
        <meshStandardMaterial color="#d94b40" flatShading />
      </mesh>
      <mesh position={[0, 1.12, -0.12]} castShadow>
        <boxGeometry args={[1.48, 0.55, 1.72]} />
        <meshStandardMaterial color="#9ed3df" metalness={0.18} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.3, 1.08]}>
        <boxGeometry args={[1.82, 0.16, 0.35]} />
        <meshStandardMaterial color="#f0d26c" emissive="#c79b26" emissiveIntensity={0.25} />
      </mesh>
      {[-1, 1].map((side) =>
        [-1, 1].map((axle) => (
          <group
            key={`${side}-${axle}`}
            ref={axle > 0 ? addFrontWheel(side > 0 ? 1 : 0) : undefined}
            position={[side * 1.02, 0.36, axle * 1.12]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <mesh castShadow>
              <cylinderGeometry args={[0.34, 0.34, 0.2, 8]} />
              <meshStandardMaterial color="#25282b" flatShading />
            </mesh>
          </group>
        )),
      )}
      {!driving && (
        <mesh position={[0, 2.05, 0]}>
          <planeGeometry args={[2.2, 0.45]} />
          <meshBasicMaterial color="#fff4cc" transparent opacity={0.82} />
        </mesh>
      )}
    </group>
  );
}
