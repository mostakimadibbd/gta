import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { isBlocked, INTERIORS, groundYAt, isWaterAt, blockersNear, BRIDGE } from "../world";
import { G } from "../game/store";
import { sfx } from "../game/audio";
import { isInteractiveTarget, normalizeGameKey } from "../keyboard";
import { buildHumanoid, animateHumanoid } from "../humanoid";
import { fallbackPhysics } from "../physics/GamePhysics";
import type { CharacterPreset } from "../game/characters";

type AnimationState = "Idle" | "Walk" | "Run" | "Driving";

interface PlayerProps {
  positionRef: MutableRefObject<THREE.Vector3>;
  rotationRef: MutableRefObject<THREE.Vector3>;
  driving: boolean;
  paused: boolean;
  preset: CharacterPreset;
  variant: number;
  showcase: boolean; // character-select turntable (runs while "paused")
}

export default function Player({ positionRef, rotationRef, driving, paused, preset, variant, showcase }: PlayerProps) {
  const root = useRef<THREE.Group>(null);
  const keys = useRef(new Set<string>());
  const jumpRequested = useRef(false);
  const jumpVelocity = useRef(0);
  const grounded = useRef(true);
  const animation = useRef<AnimationState>("Idle");
  const wasSwimming = useRef(false);
  const [animationLabel, setAnimationLabel] = useState<AnimationState>("Idle");
  const { camera } = useThree();

  // Character preset drives the rig (Phase 4); outfit variants recolour the
  // top via setTop without a rebuild.
  const rig = useMemo(() => buildHumanoid({ ...preset.options, top: preset.variants[0] }), [preset]);
  useEffect(() => { rig.setTop(preset.variants[variant] ?? preset.variants[0]); }, [rig, preset, variant]);

  const phase = useRef(0);
  const intensity = useRef(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (paused || isInteractiveTarget(event.target)) return;
      const key = normalizeGameKey(event.key);
      // crouch / stealth toggle (Blueprint movement): Ctrl or X
      if ((key === "x" || key === "control") && !event.repeat && !G.driving) {
        G.crouched = !G.crouched;
        event.preventDefault();
        return;
      }
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
    if (!root.current || (paused && !showcase)) return;
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
      const swimmingNow = !G.interior && isWaterAt(positionRef.current.x, positionRef.current.z);
      G.swimming = swimmingNow;
      if (swimmingNow && !wasSwimming.current) sfx.splash();
      wasSwimming.current = swimmingNow;

      const forwardInput = showcase ? 0 : Number(pressed.has("w")) - Number(pressed.has("s"));
      const sideInput = showcase ? 0 : Number(pressed.has("d")) - Number(pressed.has("a"));
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      const right = new THREE.Vector3(-direction.z, 0, direction.x);
      const movement = direction.multiplyScalar(forwardInput).addScaledVector(right, sideInput);

      // collision: interiors clamp to the room; open water is free (to a
      // sane offshore limit); the bridge deck is a corridor; everywhere
      // else uses the city blocker map
      const canStand = (x: number, z: number) => {
        if (G.interior) {
          const r = INTERIORS[G.interior];
          return Math.abs(x - r.cx) < r.w / 2 - 0.55 && Math.abs(z - r.cz) < r.d / 2 - 0.55;
        }
        if (isWaterAt(x, z)) return Math.abs(x) < 175 && z > -140 && z < 365;
        if (groundYAt(x, z) > 0.05 || groundYAt(positionRef.current.x, positionRef.current.z) > 0.05) {
          return Math.abs(x - BRIDGE.x) <= BRIDGE.halfW + 0.4 && z > 86 && z < 238;
        }
        return !isBlocked(x, z, 0.45);
      };

      if (movement.lengthSq() > 0) {
        moving = true;
        movement.normalize();
        running = pressed.has("shift") && !swimmingNow && !G.crouched;
        const speed = (swimmingNow ? 2.4 : running ? 8 : 4.2) * (G.crouched && !swimmingNow ? 0.45 : 1);
        const fromX = positionRef.current.x, fromZ = positionRef.current.z;
        const nextX = fromX + movement.x * speed * dt;
        const nextZ = fromZ + movement.z * speed * dt;
        if (canStand(nextX, positionRef.current.z)) positionRef.current.x = nextX;
        if (canStand(positionRef.current.x, nextZ)) positionRef.current.z = nextZ;
        // swept AABB (C++ physics): if the diagonal was blocked, stop at
        // first contact instead of sticking/sliding past thin blockers
        if (!swimmingNow && !G.interior
          && Math.abs(positionRef.current.x - nextX) > 0.001 && Math.abs(positionRef.current.z - nextZ) > 0.001
          && !canStand(nextX, nextZ)) {
          let bestT = -1;
          for (const b of blockersNear(nextX, nextZ, 16)) {
            const t = fallbackPhysics.sweptAabb(fromX, fromZ, nextX, nextZ, 0.45, b.x, b.z, b.hw, b.hd);
            if (t >= 0 && (bestT < 0 || t < bestT)) bestT = t;
          }
          if (bestT > 0) {
            const cx = fromX + (nextX - fromX) * bestT * 0.92;
            const cz = fromZ + (nextZ - fromZ) * bestT * 0.92;
            if (canStand(cx, cz)) { positionRef.current.x = cx; positionRef.current.z = cz; }
          }
        }
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
      root.current.position.set(activeVehicle.state.x, groundYAt(activeVehicle.state.x, activeVehicle.state.z), activeVehicle.state.z);
      root.current.rotation.set(0, activeVehicle.state.heading, 0);
    } else {
      root.current.position.copy(positionRef.current);
      root.current.position.y = groundYAt(positionRef.current.x, positionRef.current.z) + positionRef.current.y;
      if (G.swimming) {
        // prone at the surface, gentle bob
        root.current.position.y = -0.52 + Math.sin(tNow * 2.1) * 0.06;
        root.current.rotation.x = -1.02;
      } else root.current.rotation.x = 0;
      if (!driving) G.followPos.set(positionRef.current.x, groundYAt(positionRef.current.x, positionRef.current.z), positionRef.current.z);
      if (showcase) root.current.rotation.y += dt * 0.35; // select-screen turntable
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
    const crouchPose = G.crouched && !driving && !G.swimming && !onMoto;
    rig.group.position.y = onMoto ? -0.15 : crouchPose ? -0.48 : 0;
    if (crouchPose) {
      // crouch: knees bent, torso pitched — reads ~1.25u tall
      rig.lThigh.rotation.x = rig.rThigh.rotation.x = -1.05;
      rig.lShin.rotation.x = rig.rShin.rotation.x = 1.25;
      rig.torso.rotation.x = 0.34;
      rig.head.rotation.x = -0.18;
    }
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
