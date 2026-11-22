import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { isBlocked, INTERIORS } from "../world";
import { G } from "../game/store";
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
  const wasSwimming = useRef(false);
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
    const tNow = performance.now() / 1000;
    const pressed = keys.current;
    let moving = false;
    let running = false;

    const activeVehicle = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId] : null;
    const onMoto = !!activeVehicle && activeVehicle.kind === "motorcycle";
    // the rider stays visible (seated) on the bike; hidden inside cars
    root.current.visible = !driving || onMoto;

    if (!driving) {
      const swimmingNow = !G.interior && positionRef.current.z > 128.5;
      G.swimming = swimmingNow;
      if (swimmingNow && !wasSwimming.current) sfx.splash();
      wasSwimming.current = swimmingNow;

      const forwardInput = Number(pressed.has("w")) - Number(pressed.has("s"));
      const sideInput = Number(pressed.has("d")) - Number(pressed.has("a"));
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      const right = new THREE.Vector3(-direction.z, 0, direction.x);
      const movement = direction.multiplyScalar(forwardInput).addScaledVector(right, sideInput);

      // collision: interiors clamp to the room; open water is free (to a
      // sane offshore limit); everywhere else uses the city blocker map
      const canStand = (x: number, z: number) => {
        if (G.interior) {
          const r = INTERIORS[G.interior];
          return Math.abs(x - r.cx) < r.w / 2 - 0.55 && Math.abs(z - r.cz) < r.d / 2 - 0.55;
        }
        if (z > 127.5) return z < 168 && Math.abs(x) < 142;
        return !isBlocked(x, z, 0.45);
      };

      if (movement.lengthSq() > 0) {
        moving = true;
        movement.normalize();
        running = pressed.has("shift") && !swimmingNow;
        const speed = swimmingNow ? 2.4 : running ? 8 : 4.2;
        const nextX = positionRef.current.x + movement.x * speed * dt;
        const nextZ = positionRef.current.z + movement.z * speed * dt;
        if (canStand(nextX, positionRef.current.z)) positionRef.current.x = nextX;
        if (canStand(positionRef.current.x, nextZ)) positionRef.current.z = nextZ;
        root.current.rotation.y = Math.atan2(movement.x, movement.z);
      }

      if (jumpRequested.current) {
        if (grounded.current && !swimmingNow) {
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
    } else {
      G.swimming = false;
      wasSwimming.current = false;
    }

    // ---- root transform ----
    if (onMoto && activeVehicle) {
      root.current.position.set(activeVehicle.state.x, 0, activeVehicle.state.z);
      root.current.rotation.set(0, activeVehicle.state.heading, 0);
    } else {
      root.current.position.copy(positionRef.current);
      if (G.swimming) {
        // prone at the surface, gentle bob
        root.current.position.y = -0.52 + Math.sin(tNow * 2.1) * 0.06;
        root.current.rotation.x = -1.02;
      } else root.current.rotation.x = 0;
    }
    G.playerHeading = root.current.rotation.y;
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
    animateHumanoid(rig, phase.current, intensity.current, tNow);

    // ---- pose overrides (applied after the base animation) ----
    rig.group.position.y = onMoto ? -0.15 : 0;
    if (onMoto) {
      // seated rider: thighs forward, shins down to the pegs, arms to the bars
      rig.lThigh.rotation.x = rig.rThigh.rotation.x = -1.5;
      rig.lShin.rotation.x = rig.rShin.rotation.x = 1.35;
      rig.lArm.rotation.x = rig.rArm.rotation.x = -0.85;
      rig.lFore.rotation.x = rig.rFore.rotation.x = -0.25;
      rig.torso.rotation.x = 0.16;
    } else if (G.swimming) {
      // paddle strokes + flutter kick, head up out of the water
      const s1 = Math.sin(tNow * 3.4), s2 = Math.sin(tNow * 3.4 + Math.PI);
      rig.lArm.rotation.x = s1 * 1.5 - 0.3;
      rig.rArm.rotation.x = s2 * 1.5 - 0.3;
      rig.lThigh.rotation.x = Math.sin(tNow * 6.4) * 0.3;
      rig.rThigh.rotation.x = Math.sin(tNow * 6.4 + Math.PI) * 0.3;
      rig.head.rotation.x = 0.55;
    } else if (!driving) {
      // punch swing (Combat sets G.punchT on click / J)
      const pt = tNow - G.punchT;
      if (pt >= 0 && pt < 0.3) {
        const s = Math.sin((pt / 0.3) * Math.PI);
        rig.rArm.rotation.x = -2.2 * s;
        rig.rFore.rotation.x = -0.3 * s;
      }
    }
  });

  return (
    <group ref={root}>
      <primitive object={rig.group} />
      <group userData={{ animation: animationLabel }} />
    </group>
  );
}
