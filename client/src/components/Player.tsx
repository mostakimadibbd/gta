import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { isBlocked } from "../world";
import { isInteractiveTarget, normalizeGameKey } from "../keyboard";

type AnimationState = "Idle" | "Walk" | "Run" | "Driving";

interface PlayerProps {
  positionRef: MutableRefObject<THREE.Vector3>;
  rotationRef: MutableRefObject<THREE.Vector3>;
  driving: boolean;
  paused: boolean;
}

export default function Player({ positionRef, rotationRef, driving, paused }: PlayerProps) {
  const root = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const keys = useRef(new Set<string>());
  const jumpRequested = useRef(false);
  const jumpVelocity = useRef(0);
  const grounded = useRef(true);
  const animation = useRef<AnimationState>("Idle");
  const [animationLabel, setAnimationLabel] = useState<AnimationState>("Idle");
  const { camera } = useThree();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (paused || isInteractiveTarget(event.target)) return;
      const key = normalizeGameKey(event.key);
      if (["w", "a", "s", "d", "shift", " "].includes(key)) {
        event.preventDefault();
        keys.current.add(key);
        if (key === " " && !event.repeat) jumpRequested.current = true;
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
  }, [paused]);

  useEffect(() => {
    if (!paused) return;
    keys.current.clear();
    jumpRequested.current = false;
  }, [paused]);

  useEffect(() => {
    const next = driving ? "Driving" : animation.current === "Driving" ? "Idle" : animation.current;
    animation.current = next;
    setAnimationLabel(next);
  }, [driving]);

  useFrame((_, delta) => {
    if (!root.current || paused) return;
    const dt = Math.min(delta, 0.05);
    const pressed = keys.current;
    let moving = false;
    let running = false;

    if (!driving) {
      const forwardInput = Number(pressed.has("w")) - Number(pressed.has("s"));
      const sideInput = Number(pressed.has("d")) - Number(pressed.has("a"));
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      const right = new THREE.Vector3(-direction.z, 0, direction.x);
      const movement = direction.multiplyScalar(forwardInput).addScaledVector(right, sideInput);

      if (movement.lengthSq() > 0) {
        moving = true;
        movement.normalize();
        running = pressed.has("shift");
        const speed = running ? 8 : 4.2;
        const nextX = positionRef.current.x + movement.x * speed * dt;
        const nextZ = positionRef.current.z + movement.z * speed * dt;
        if (!isBlocked(nextX, positionRef.current.z, 0.45)) positionRef.current.x = nextX;
        if (!isBlocked(positionRef.current.x, nextZ, 0.45)) positionRef.current.z = nextZ;
        root.current.rotation.y = Math.atan2(movement.x, movement.z);
      }

      if (jumpRequested.current) {
        if (grounded.current) {
          jumpVelocity.current = 7.5;
          grounded.current = false;
        }
        jumpRequested.current = false;
      }
      if (!grounded.current) {
        jumpVelocity.current -= 20 * dt;
        positionRef.current.y = Math.max(0, positionRef.current.y + jumpVelocity.current * dt);
        if (positionRef.current.y === 0) {
          grounded.current = true;
          jumpVelocity.current = 0;
        }
      }
    }

    root.current.position.copy(positionRef.current);
    rotationRef.current.set(root.current.rotation.x, root.current.rotation.y, root.current.rotation.z);
    const nextAnimation: AnimationState = driving ? "Driving" : moving ? (running ? "Run" : "Walk") : "Idle";
    if (animation.current !== nextAnimation) {
      animation.current = nextAnimation;
      setAnimationLabel(nextAnimation);
    }
    const swing = moving ? Math.sin(performance.now() * (running ? 0.014 : 0.009)) * 0.55 : 0;
    if (leftArm.current) leftArm.current.rotation.x = swing;
    if (rightArm.current) rightArm.current.rotation.x = -swing;
    if (leftLeg.current) leftLeg.current.rotation.x = -swing;
    if (rightLeg.current) rightLeg.current.rotation.x = swing;
  });

  return (
    <group ref={root} visible={!driving}>
      <group position={[0, 0.86, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.34, 0.72, 4, 6]} />
          <meshStandardMaterial color="#3977a8" flatShading />
        </mesh>
        <mesh position={[0, 0.64, 0]} castShadow>
          <icosahedronGeometry args={[0.27, 1]} />
          <meshStandardMaterial color="#d5a77b" flatShading />
        </mesh>
        <mesh position={[0, 0.76, 0.16]}>
          <boxGeometry args={[0.54, 0.12, 0.42]} />
          <meshStandardMaterial color="#252e38" flatShading />
        </mesh>
        <group ref={leftArm} position={[-0.4, 0.24, 0]}>
          <mesh position={[0, -0.25, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.42, 3, 5]} />
            <meshStandardMaterial color="#3977a8" />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.4, 0.24, 0]}>
          <mesh position={[0, -0.25, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.42, 3, 5]} />
            <meshStandardMaterial color="#3977a8" />
          </mesh>
        </group>
        <group ref={leftLeg} position={[-0.17, -0.43, 0]}>
          <mesh position={[0, -0.24, 0]} castShadow>
            <capsuleGeometry args={[0.12, 0.38, 3, 5]} />
            <meshStandardMaterial color="#343c48" />
          </mesh>
        </group>
        <group ref={rightLeg} position={[0.17, -0.43, 0]}>
          <mesh position={[0, -0.24, 0]} castShadow>
            <capsuleGeometry args={[0.12, 0.38, 3, 5]} />
            <meshStandardMaterial color="#343c48" />
          </mesh>
        </group>
      </group>
      <group userData={{ animation: animationLabel }} />
    </group>
  );
}
