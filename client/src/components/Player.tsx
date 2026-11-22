import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { isBlocked } from "../world";
import { sfx } from "../game/audio";
import { isInteractiveTarget, normalizeGameKey } from "../keyboard";
import { buildHumanoid, animateHumanoid } from "../humanoid";

type AnimationState = "Idle" | "Walk" | "Run" | "Driving";

interface PlayerProps {
  positionRef: MutableRefObject<THREE.Vector3>;
  rotationRef: MutableRefObject<THREE.Vector3>;
  driving: boolean;
  paused: boolean;
  shirt?: string;
}

export default function Player({ positionRef, rotationRef, driving, paused, shirt = "#1f7a72" }: PlayerProps) {
  const root = useRef<THREE.Group>(null);
  const keys = useRef(new Set<string>());
  const jumpRequested = useRef(false);
  const jumpVelocity = useRef(0);
  const grounded = useRef(true);
  const animation = useRef<AnimationState>("Idle");
  const [animationLabel, setAnimationLabel] = useState<AnimationState>("Idle");
  const { camera } = useThree();

  // Rayan: varsity jacket (chest follows the personal theme colour),
  // dark jeans, black shoes, dark hair.
  const rig = useMemo(() => buildHumanoid({
    top: "#1f7a72", sleeve: "#22303a", bottom: "#232c38", skin: "#c68863",
    hair: "#191008", shoes: "#101216", undershirt: "#e8e2d4",
    topStyle: "varsity", bottomStyle: "jeans", gender: "m", hairStyle: "cap",
  }), []);
  useEffect(() => { rig.setTop(shirt); }, [rig, shirt]);

  const phase = useRef(0);
  const intensity = useRef(0);

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
          sfx.jump();
        }
        jumpRequested.current = false;
      }
      if (!grounded.current) {
        jumpVelocity.current -= 20 * dt;
        positionRef.current.y = Math.max(0, positionRef.current.y + jumpVelocity.current * dt);
        if (positionRef.current.y === 0) {
          grounded.current = true;
          jumpVelocity.current = 0;
          sfx.land();
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
    // articulated walk/run cycle: thighs + knees + elbows, bob, idle life
    if (moving) phase.current += dt * (running ? 11.5 : 8.4);
    const target = driving ? 0 : moving ? (running ? 1 : 0.72) : 0;
    intensity.current += (target - intensity.current) * Math.min(1, dt * 10);
    animateHumanoid(rig, phase.current, intensity.current, performance.now() / 1000);
  });

  return (
    <group ref={root} visible={!driving}>
      <primitive object={rig.group} />
      <group userData={{ animation: animationLabel }} />
    </group>
  );
}
