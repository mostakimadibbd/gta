import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { isBlocked, INTERIORS, groundYAt, isWaterAt, blockersNear, BRIDGE, VAULT_SPOTS } from "../world";
import { G, toast, bark } from "../game/store";
import { sfx } from "../game/audio";
import { isInteractiveTarget, normalizeGameKey } from "../keyboard";
import { isBind } from "../game/keybinds";
import { buildHumanoid, animateHumanoid } from "../humanoid";
import { fallbackPhysics } from "../physics/GamePhysics";
import type { CharacterPreset } from "../game/characters";
import { CLOTH } from "../game/phase8";
import { LOOK } from "../game/phase9";
import { seedRagdoll, stepRagdoll, poseRigFromRagdoll, type RagdollState } from "../game/ragdoll";
import { padKeys, padMove } from "../game/gamepad";
import { SIM_STEP, SIM_MAX_SUBSTEPS } from "../game/perf";
import { touchMove } from "../game/touch";

type AnimationState = "Idle" | "Walk" | "Run" | "Driving";

// Phase 8 smoothness audit: movement scratch vectors — the frame loop
// used to allocate two Vector3 per frame; these are reused instead
const _dirV = new THREE.Vector3();
const _rightV = new THREE.Vector3();

interface PlayerProps {
  positionRef: MutableRefObject<THREE.Vector3>;
  rotationRef: MutableRefObject<THREE.Vector3>;
  driving: boolean;
  paused: boolean;
  preset: CharacterPreset;
  variant: number;
  clothingKey: number; // Phase 8: bumped when the Thread & Tide override changes
  showcase: boolean; // character-select turntable (runs while "paused")
}

export default function Player({ positionRef, rotationRef, driving, paused, preset, variant, clothingKey, showcase }: PlayerProps) {
  const root = useRef<THREE.Group>(null);
  const keys = useRef(new Set<string>());
  const jumpRequested = useRef(false);
  const jumpVelocity = useRef(0);
  const grounded = useRef(true);
  const animation = useRef<AnimationState>("Idle");
  const wasSwimming = useRef(false);
  // Phase 10: C++ swim_step state (speed through drag, stroke phase, bob)
  const swim = useRef({ speed: 0, phase: 0, surge: 1, bob: 0 });
  const [animationLabel, setAnimationLabel] = useState<AnimationState>("Idle");
  const { camera } = useThree();

  // Character preset drives the rig (Phase 4); outfit variants recolour the
  // top via setTop without a rebuild. Phase 8: a Thread & Tide purchase is
  // an OVERRIDE LAYER — while worn it supplies top style + top/bottom
  // colours and wins over the preset/variant (Character Select clears it).
  // merged keyboard ∪ gamepad key view, built once (no per-frame literal)
  const pressedView = useMemo(() => ({ has: (k: string) => keys.current.has(k) || padKeys.has(k) }), []);
  // Phase 9: barber/tattoo LOOK override — bumped by the phase9 event
  const [lookKey, setLookKey] = useState(0);
  useEffect(() => {
    const onLook = () => setLookKey((k) => k + 1);
    window.addEventListener("harborfall-look", onLook);
    return () => window.removeEventListener("harborfall-look", onLook);
  }, []);
  const rig = useMemo(() => {
    const c = CLOTH.current;
    const opts = c
      ? {
          ...preset.options, top: c.top, topStyle: c.topStyle,
          bottom: c.bottom ?? preset.options.bottom, bottomStyle: c.bottomStyle ?? preset.options.bottomStyle,
        }
      : { ...preset.options, top: preset.variants[0] };
    // Phase 9 LOOK layer wins over preset + clothing for hair/tattoo
    if (LOOK.hairStyle) opts.hairStyle = LOOK.hairStyle as typeof opts.hairStyle;
    if (LOOK.hairColor) opts.hair = LOOK.hairColor;
    if (LOOK.tattoo) opts.tattooSleeve = true;
    return buildHumanoid(opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, clothingKey, lookKey]);
  useEffect(() => {
    if (CLOTH.current) rig.setTop(CLOTH.current.top);
    else rig.setTop(preset.variants[variant] ?? preset.variants[0]);
  }, [rig, preset, variant, clothingKey]);

  const phase = useRef(0);
  const intensity = useRef(0);
  // ---- Phase 6: vault state + surrender (hold B) tracking ----
  const vault = useRef<{ t: number; dur: number; fx: number; fz: number; tx: number; tz: number } | null>(null);
  // ---- Phase 7: swim dive entry + idle-variation timer ----
  const dive = useRef<{ t: number; dur: number; fx: number; fz: number; tx: number; tz: number } | null>(null);
  const idleT = useRef(0);
  const bHeldAt = useRef(-1);
  const surrendered = useRef(false);
  // Phase 5 Step 6: enter-car slide (0.35 s) instead of a teleport-pose swap
  const enterT = useRef(0);
  const enterFrom = useRef(new THREE.Vector3());
  const wasDriving = useRef(false);

  useEffect(() => {
    // Phase 14: sprint/jump arrive through the player's BINDINGS and
    // are translated into the canonical "shift"/" " tokens the
    // movement step has always read; the physical Shift/Space only
    // work while they ARE the binding (defaults). WASD is fixed.
    const tokenFor = (event: KeyboardEvent): string => {
      if (isBind(event, "sprint")) return "shift";
      if (isBind(event, "jump")) return " ";
      const key = normalizeGameKey(event.key);
      return key === "shift" || key === " " ? "" : key;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (paused || isInteractiveTarget(event.target)) return;
      const key = tokenFor(event);
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
      // Phase 6 surrender: hold B on foot (in a car B stays the horn)
      if (key === "b" && !event.repeat && !G.driving) { bHeldAt.current = performance.now() / 1000; surrendered.current = false; }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keys.current.delete(tokenFor(event));
      if (normalizeGameKey(event.key) === "b") {
        bHeldAt.current = -1;
        if (G.hold?.label.startsWith("Surrendering")) G.hold = null;
      }
    };
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

  const wastedRag = useRef<RagdollState | null>(null); // Phase 14: WASTED verlet ragdoll
  const simAcc = useRef(0); // Phase 12: fixed-step accumulator

  // Phase 12: the player step runs at a FIXED 60 Hz (accumulator
  // driver; max 3 substeps, leftover debt dropped — see game/perf.ts)
  // so movement, swimming and the wasted collapse advance identically
  // at 30/60/120 Hz. stepPlayer is the old per-frame body, unchanged.
  useFrame((_, delta) => {
    // Phase 9: the frame keeps running through a WASTED status so the
    // collapse can play under the respawn screen
    if (!root.current || (paused && !showcase && !G.status)) { simAcc.current = 0; return; }
    simAcc.current = Math.min(simAcc.current + delta, SIM_STEP * SIM_MAX_SUBSTEPS);
    let nSteps = 0;
    while (simAcc.current >= SIM_STEP && nSteps < SIM_MAX_SUBSTEPS) {
      simAcc.current -= SIM_STEP; nSteps += 1;
      stepPlayer(SIM_STEP);
    }
    if (nSteps === SIM_MAX_SUBSTEPS) simAcc.current = 0;
  });

  function stepPlayer(dt: number) {
    if (!root.current) return;
    const tNow = performance.now() / 1000;
    if (G.status === "wasted" && !driving) {
      // ---- Phase 14: the WASTED collapse is the real VERLET RAGDOLL
      // (it replaces the Phase 9 procedural tip-over): seeded falling
      // backwards at the death spot, stepped here inside the fixed
      // sim step, and the rig is posed from the solved points until
      // the respawn flow clears the status. ----
      const px0 = positionRef.current.x, pz0 = positionRef.current.z;
      const gy0 = groundYAt(px0, pz0);
      if (!wastedRag.current) {
        const h = G.playerHeading;
        wastedRag.current = seedRagdoll(px0, pz0, h, gy0, -Math.sin(h) * 1.4, 0.6, -Math.cos(h) * 1.4, dt);
      }
      const rag = wastedRag.current;
      // Phase 15 survivability: if the solver ever throws or blows up
      // to NaN, drop the ragdoll and hold the rig at the death spot —
      // the respawn flow must never freeze on a solver fault.
      try {
        stepRagdoll(rag, groundYAt(rag.pos[0], rag.pos[2]), dt, fallbackPhysics);
        if (!Number.isFinite(rag.pos[0]) || !Number.isFinite(rag.pos[2])) throw new Error("ragdoll NaN");
        root.current.position.set(rag.pos[0], groundYAt(rag.pos[0], rag.pos[2]), rag.pos[2]);
        root.current.rotation.set(0, rag.heading, 0);
        poseRigFromRagdoll(rig, rag, 1, groundYAt(rag.pos[0], rag.pos[2]));
      } catch { wastedRag.current = null; root.current.position.set(px0, gy0, pz0); }
      return;
    }
    if (G.status !== "wasted") wastedRag.current = null;
    if (paused && !showcase) return; // BUSTED: freeze (hands-up is pre-status)
    // ---- Phase 13: riding the Sable Line — Tram.tsx owns the
    // position (it writes G.playerPos / G.followPos every frame);
    // here we only render the seated pose at deck height, bypassing
    // groundYAt entirely (the ground 6u below is traffic's problem) --
    if (G.tramRide >= 0) {
      G.swimming = false;
      root.current.visible = true;
      jumpRequested.current = false;
      intensity.current = 0;
      root.current.position.set(positionRef.current.x, G.tramSeatY, positionRef.current.z);
      root.current.rotation.set(0, G.playerHeading, 0);
      rotationRef.current.set(0, root.current.rotation.y, 0);
      animateHumanoid(rig, phase.current, 0, tNow);
      rig.group.position.y = -0.42; // the bench-seat drop, same as sitting
      rig.lThigh.rotation.x = rig.rThigh.rotation.x = -1.45;
      rig.lShin.rotation.x = rig.rShin.rotation.x = 1.35;
      rig.lArm.rotation.x = -0.3; rig.rArm.rotation.x = -0.3;
      if (animation.current !== "Idle") { animation.current = "Idle"; setAnimationLabel("Idle"); }
      return;
    }
    // Phase 8: one merged view of keyboard ∪ gamepad keys (analog
    // stick/touch vectors are consulted separately below)
    const pressed = pressedView;
    let moving = false;
    let running = false;
    let analogMagFrame = 0; // set by the movement branch; drives stride rate

    const activeVehicle = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId] : null;
    const onMoto = !!activeVehicle && activeVehicle.kind === "motorcycle";
    const onBike = !!activeVehicle && activeVehicle.kind === "bicycle";
    // enter-car slide: on the driving transition, capture where the player
    // stood and glide to the driver's seat over 0.35 s (Vehicle waits via
    // G.enterAnimT). The bike keeps its instant mount (rider stays visible).
    if (driving && !wasDriving.current && activeVehicle && !onMoto) {
      enterFrom.current.copy(positionRef.current);
      enterT.current = 0.35;
    }
    wasDriving.current = driving;
    if (enterT.current > 0) { enterT.current = Math.max(0, enterT.current - dt); G.enterAnimT = enterT.current; }
    else if (G.enterAnimT > 0) G.enterAnimT = 0;
    const entering = enterT.current > 0 && !!activeVehicle && !onMoto;
    // the rider stays visible (seated) on the bike; hidden inside cars
    root.current.visible = !driving || onMoto || onBike || entering;

    if (!driving) {
      const swimmingNow = !G.interior && isWaterAt(positionRef.current.x, positionRef.current.z);
      G.swimming = swimmingNow;
      if (swimmingNow && !wasSwimming.current) sfx.splash();
      wasSwimming.current = swimmingNow;

      // ---- Phase 7 sitting: parked on a bench / restaurant chair —
      // any movement key stands you back up (E toggles via the prompts) --
      if (G.sitting) {
        if (pressed.has("w") || pressed.has("a") || pressed.has("s") || pressed.has("d") || padMove.mag > 0.3 || touchMove.mag > 0.3) { G.sitting = false; G.sitSpot = null; }
        else {
          if (G.sitSpot) {
            positionRef.current.x = G.sitSpot.x; positionRef.current.z = G.sitSpot.z;
            root.current.rotation.y = G.sitSpot.heading;
          }
          jumpRequested.current = false;
        }
      }

      const forwardInput = showcase ? 0 : Number(pressed.has("w")) - Number(pressed.has("s"));
      const sideInput = showcase ? 0 : Number(pressed.has("d")) - Number(pressed.has("a"));
      // Phase 8 ANALOG movement (gamepad stick, then touch joystick —
      // only when the digital keys are idle): magnitude blends walk→run
      // and >0.92 latches sprint in the movement branch below
      const analog = !showcase && forwardInput === 0 && sideInput === 0
        ? (padMove.mag > 0.02 ? padMove : touchMove.mag > 0.02 ? touchMove : null)
        : null;
      analogMagFrame = analog?.mag ?? 0;
      const direction = _dirV; // scratch (Phase 8 allocation audit)
      camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      const right = _rightV.set(-direction.z, 0, direction.x);
      const movement = analog
        ? direction.multiplyScalar(-analog.y).addScaledVector(right, analog.x)
        : direction.multiplyScalar(forwardInput).addScaledVector(right, sideInput);

      // ---- Phase 10: swim physics from the C++ core (swim_step) —
      // speed relaxes toward the stroke target through water DRAG (no
      // instant 0→2.4), the stroke cycle surges it ±14%, and the bob
      // rides the same cycle. Runs every on-foot frame so a swimmer
      // who lets go of the keys coasts to a stop instead of freezing.
      if (swimmingNow) {
        const stroking = movement.lengthSq() > 0;
        swim.current.phase += dt * (stroking ? 5.4 : 2.2);
        const target = stroking ? 2.4 * (analog ? analog.mag : 1) : 0;
        const ss = fallbackPhysics.swimStep(swim.current.phase, target, swim.current.speed, dt);
        swim.current.speed = ss.speed; swim.current.surge = ss.surge; swim.current.bob = ss.bob;
      } else swim.current.speed = 0;

      // collision: interiors clamp to the room; open water is free (to a
      // sane offshore limit); the bridge deck is a corridor; everywhere
      // else uses the city blocker map
      const canStand = (x: number, z: number) => {
        if (G.interior) {
          const r = INTERIORS[G.interior];
          return Math.abs(x - r.cx) < r.w / 2 - 0.55 && Math.abs(z - r.cz) < r.d / 2 - 0.55;
        }
        if (isWaterAt(x, z)) return Math.abs(x) < 175 && z > -320 && z < 365;
        if (groundYAt(x, z) > 0.05 || groundYAt(positionRef.current.x, positionRef.current.z) > 0.05) {
          return Math.abs(x - BRIDGE.x) <= BRIDGE.halfW + 0.4 && z > 86 && z < 238;
        }
        return !isBlocked(x, z, 0.45);
      };

      // ---- Phase 6 surrender: hold B at 1★, unarmed, on foot → busted-
      // lite: an on-the-spot fine, no teleport, no cell (A5) ----
      if (bHeldAt.current > 0 && !surrendered.current) {
        if (G.wanted === 1 && G.weaponSel === "fist" && !G.status) {
          const progress = (tNow - bHeldAt.current) / 1.2;
          G.hold = { label: "Surrendering…", progress: Math.min(1, progress) };
          if (progress >= 1) {
            surrendered.current = true;
            bHeldAt.current = -1; G.hold = null;
            const fine = Math.min(100, G.cash);
            G.finesPaid += fine; G.cash -= fine;
            G.wanted = 0; G.wantedCooldown = 0; G.bustTimer = 0;
            for (const c of G.cops) c.active = false;
            toast("You surrendered — fined $100 on the spot. No chase, no cell.");
            bark("Harbour Patrol", "Suspect surrendered. Fine issued — move along.");
            sfx.click();
          }
        } else if (G.hold?.label.startsWith("Surrendering")) G.hold = null;
      }

      // ---- Phase 7 dive: an arc off the edge into deep water ----
      if (dive.current) {
        const v = dive.current;
        v.t += dt;
        const p = Math.min(1, v.t / v.dur);
        positionRef.current.x = v.fx + (v.tx - v.fx) * p;
        positionRef.current.z = v.fz + (v.tz - v.fz) * p;
        positionRef.current.y = Math.sin(p * Math.PI) * 0.9;
        if (p >= 1) { dive.current = null; positionRef.current.y = 0; grounded.current = true; sfx.splash(); }
        moving = true;
      // ---- Phase 6 vault: Space near a low blocker (bench / hedge /
      // planter ≤ ~1.1u) arcs you over it instead of jumping in place ----
      } else if (vault.current) {
        const v = vault.current;
        v.t += dt;
        const p = Math.min(1, v.t / v.dur);
        positionRef.current.x = v.fx + (v.tx - v.fx) * p;
        positionRef.current.z = v.fz + (v.tz - v.fz) * p;
        positionRef.current.y = Math.sin(p * Math.PI) * 0.85;
        if (p >= 1) { vault.current = null; positionRef.current.y = 0; grounded.current = true; sfx.land(); }
        moving = true;
      } else if (movement.lengthSq() > 0) {
        moving = true;
        if (!analog) movement.normalize();
        // stamina gates the sprint (A7): an empty tank means no sprint.
        // Phase 8: an analog stick pushed past 0.92 latches sprint too.
        running = (pressed.has("shift") || (analog !== null && analog.mag > 0.92)) && !swimmingNow && !G.crouched && G.stamina > 2 && !G.exhausted;
        const limp = G.health < 25 && !swimmingNow; // A7: hurt = slow + hunched (pose below)
        const speed = swimmingNow
          ? swim.current.speed * swim.current.surge // C++ swim_step output (drag + surge baked in)
          : (running ? 8 : 4.2) * (analog ? analog.mag : 1) * (G.crouched ? 0.45 : 1) * (limp ? 0.6 : 1) * (G.aiming ? 0.45 : 1);
        // vault trigger: moving into a low spot's edge with Space held
        if (jumpRequested.current && grounded.current && !swimmingNow && !G.interior) {
          for (const s of VAULT_SPOTS) {
            const dx = s.x - positionRef.current.x, dz = s.z - positionRef.current.z;
            const dist = Math.hypot(dx, dz);
            const reach = Math.max(s.hw, s.hd) + 0.85;
            if (dist > reach || dist < 0.2) continue;
            if ((dx * movement.x + dz * movement.z) / dist < 0.55) continue; // must be heading at it
            const cross = Math.max(s.hw, s.hd) * 2 + 1.1;
            const tx = positionRef.current.x + movement.x * cross;
            const tz = positionRef.current.z + movement.z * cross;
            if (!canStand(tx, tz)) continue;
            vault.current = { t: 0, dur: 0.38, fx: positionRef.current.x, fz: positionRef.current.z, tx, tz };
            jumpRequested.current = false;
            sfx.jump();
            break;
          }
        }
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
      // Phase 9 free-aim: standing still while aiming, the body faces
      // the camera (the shot travels the camera ray — see Combat).
      // NB: `direction` was consumed building `movement`, so re-read it.
      if (G.aiming && !showcase) {
        const aimDir = _rightV; // scratch reuse — `right` is dead by here
        camera.getWorldDirection(aimDir); aimDir.y = 0;
        if (aimDir.lengthSq() > 0.01) { aimDir.normalize(); root.current.rotation.y = Math.atan2(aimDir.x, aimDir.z); }
      }

      G.playerSprinting = running && moving && !swimmingNow;
      if (jumpRequested.current) {
        // ---- Phase 7: Space at a deep-water edge = dive entry — the
        // water must start within a step and still be water 3.6u out ----
        if (grounded.current && !swimmingNow && !G.interior && !G.sitting && !dive.current) {
          const h = root.current.rotation.y;
          const fx = Math.sin(h), fz = Math.cos(h);
          const nx = positionRef.current.x + fx * 1.5, nz = positionRef.current.z + fz * 1.5;
          const tx = positionRef.current.x + fx * 3.6, tz = positionRef.current.z + fz * 3.6;
          if (isWaterAt(nx, nz) && isWaterAt(tx, tz)) {
            dive.current = { t: 0, dur: 0.55, fx: positionRef.current.x, fz: positionRef.current.z, tx, tz };
            jumpRequested.current = false;
            sfx.jump();
          }
        }
        if (jumpRequested.current && grounded.current && !swimmingNow) {
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
    if (entering && activeVehicle) {
      // glide from the door-side standing spot into the driver's seat
      const p = 1 - enterT.current / 0.35;
      const ease = p * p * (3 - 2 * p);
      const cs = activeVehicle.state;
      const doorX = cs.x - Math.cos(cs.heading) * 1.15, doorZ = cs.z + Math.sin(cs.heading) * 1.15;
      root.current.position.set(
        THREE.MathUtils.lerp(enterFrom.current.x, cs.x, ease),
        groundYAt(cs.x, cs.z) + Math.sin(ease * Math.PI) * 0.12,
        THREE.MathUtils.lerp(enterFrom.current.z, cs.z, ease),
      );
      root.current.position.x = THREE.MathUtils.lerp(root.current.position.x, doorX, (1 - ease) * 0.35);
      root.current.position.z = THREE.MathUtils.lerp(root.current.position.z, doorZ, (1 - ease) * 0.35);
      root.current.rotation.set(0, THREE.MathUtils.lerp(root.current.rotation.y, cs.heading, ease), 0);
    } else if ((onMoto || onBike) && activeVehicle) {
      root.current.position.set(activeVehicle.state.x, groundYAt(activeVehicle.state.x, activeVehicle.state.z), activeVehicle.state.z);
      root.current.rotation.set(0, activeVehicle.state.heading, 0);
    } else {
      root.current.position.copy(positionRef.current);
      root.current.position.y = groundYAt(positionRef.current.x, positionRef.current.z) + positionRef.current.y;
      if (G.swimming) {
        // prone at the surface, bob from the C++ swim_step stroke cycle
        root.current.position.y = -0.52 + swim.current.bob;
        root.current.rotation.x = -1.02;
      } else if (dive.current) {
        // Phase 7: head-first pitch through the dive arc
        const p = Math.min(1, dive.current.t / dive.current.dur);
        root.current.rotation.x = -1.1 * Math.sin(p * Math.PI);
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
    // Phase 8 stride matching: phase rate ∝ ground speed (≈ speed × 2.9)
    // so the feet plant instead of skating at any pace
    if (moving) phase.current += dt * (running ? 23.2 : 12.2) * (analogMagFrame > 0 ? analogMagFrame : 1);
    const target = driving ? 0 : moving ? (running ? 1 : 0.72) : 0;
    intensity.current += (target - intensity.current) * Math.min(1, dt * 10);
    animateHumanoid(rig, phase.current, intensity.current, tNow);
    // Phase 7: idle clock — drives the weight-shift / phone-check layers
    if (!driving && !moving && grounded.current && !G.swimming && !G.dialogueActive && !G.sitting) idleT.current += dt;
    else idleT.current = 0;

    // ---- pose overrides (applied after the base animation) ----
    const crouchPose = G.crouched && !driving && !G.swimming && !onMoto;
    rig.group.position.y = onMoto || onBike ? -0.15 : crouchPose ? -0.48 : G.sitting && !driving ? -0.42 : 0;
    if (crouchPose) {
      // crouch: knees bent, torso pitched — reads ~1.25u tall
      rig.lThigh.rotation.x = rig.rThigh.rotation.x = -1.05;
      rig.lShin.rotation.x = rig.rShin.rotation.x = 1.25;
      rig.torso.rotation.x = 0.34;
      rig.head.rotation.x = -0.18;
    }
    if (entering) {
      // slide-in pose: legs swing into the cabin as the glide progresses
      const p = 1 - enterT.current / 0.35;
      rig.lThigh.rotation.x = rig.rThigh.rotation.x = -1.25 * p;
      rig.lShin.rotation.x = rig.rShin.rotation.x = 1.1 * p;
      rig.lArm.rotation.x = -0.5 * p;
      rig.rArm.rotation.x = -0.9 * p; // reaching for the wheel
      rig.torso.rotation.x = 0.12 * p;
    } else if (onMoto) {
      // seated rider: thighs forward, shins down to the pegs, arms to the bars
      rig.lThigh.rotation.x = rig.rThigh.rotation.x = -1.5;
      rig.lShin.rotation.x = rig.rShin.rotation.x = 1.35;
      rig.lArm.rotation.x = rig.rArm.rotation.x = -0.85;
      rig.lFore.rotation.x = rig.rFore.rotation.x = -0.25;
      rig.torso.rotation.x = 0.16;
    } else if (onBike) {
      // cyclist: legs PEDAL (alternating circles) while the bike rolls,
      // hands on the bars, torso leaned in (Phase 6, A3)
      const rolling = Math.abs(activeVehicle?.state.speed ?? 0) > 0.4;
      const ph = tNow * (rolling ? 9.5 : 0);
      rig.lThigh.rotation.x = -0.95 + Math.sin(ph) * (rolling ? 0.5 : 0);
      rig.rThigh.rotation.x = -0.95 + Math.sin(ph + Math.PI) * (rolling ? 0.5 : 0);
      rig.lShin.rotation.x = 0.85 + Math.max(0, -Math.sin(ph)) * 0.4;
      rig.rShin.rotation.x = 0.85 + Math.max(0, Math.sin(ph)) * 0.4;
      rig.lArm.rotation.x = rig.rArm.rotation.x = -0.72;
      rig.lFore.rotation.x = rig.rFore.rotation.x = -0.18;
      rig.torso.rotation.x = 0.3;
    } else if (G.swimming) {
      // paddle strokes + flutter kick, head up out of the water
      const s1 = Math.sin(tNow * 3.4), s2 = Math.sin(tNow * 3.4 + Math.PI);
      rig.lArm.rotation.x = s1 * 1.5 - 0.3;
      rig.rArm.rotation.x = s2 * 1.5 - 0.3;
      rig.lThigh.rotation.x = Math.sin(tNow * 6.4) * 0.3;
      rig.rThigh.rotation.x = Math.sin(tNow * 6.4 + Math.PI) * 0.3;
      rig.head.rotation.x = 0.55;
    } else if (!driving) {
      // Phase 5: proper jump arc — tucked knees + arms out on the way up,
      // legs extending and arms rising to brace on the way down
      if (!grounded.current && !G.swimming) {
        if (jumpVelocity.current > 0.5) {
          rig.lThigh.rotation.x = -0.55; rig.rThigh.rotation.x = -0.28;
          rig.lShin.rotation.x = 0.75; rig.rShin.rotation.x = 0.5;
          rig.lArm.rotation.x = -0.45; rig.rArm.rotation.x = -0.3;
          rig.lArm.rotation.z = 0.38; rig.rArm.rotation.z = -0.38;
        } else {
          rig.lThigh.rotation.x = -0.16; rig.rThigh.rotation.x = 0.08;
          rig.lShin.rotation.x = 0.14; rig.rShin.rotation.x = 0.05;
          rig.lArm.rotation.x = -0.85; rig.rArm.rotation.x = -0.85;
          rig.lArm.rotation.z = 0.55; rig.rArm.rotation.z = -0.55;
        }
      } else {
        rig.lArm.rotation.z = 0; rig.rArm.rotation.z = 0; // reset jump spread
        // punch swing (Combat sets G.punchT on click / J)
        const pt = tNow - G.punchT;
        if (G.weaponSel === "bat" && pt >= 0 && pt < 0.5) {
          // Phase 8 bat swing: two-handed overhead raise, then the chop —
          // a longer, heavier arc than the fist (0.5 s window)
          const s = Math.sin((pt / 0.5) * Math.PI);
          const raise = Math.sin(Math.min(1, pt / 0.22) * Math.PI * 0.5);
          rig.rArm.rotation.x = -2.75 * raise + 0.9 * Math.max(0, (pt - 0.22) / 0.28);
          rig.lArm.rotation.x = -2.45 * raise + 0.8 * Math.max(0, (pt - 0.22) / 0.28);
          rig.rFore.rotation.x = -0.35 * s; rig.lFore.rotation.x = -0.3 * s;
          rig.torso.rotation.y = -0.35 * s;
        } else if (pt >= 0 && pt < 0.3) {
          const s = Math.sin((pt / 0.3) * Math.PI);
          rig.rArm.rotation.x = -2.2 * s;
          rig.rFore.rotation.x = -0.3 * s;
        }
      }
      // ---- Phase 7 pose layers: sitting + idle variations ----
      if (G.sitting) {
        rig.lThigh.rotation.x = rig.rThigh.rotation.x = -1.45;
        rig.lShin.rotation.x = rig.rShin.rotation.x = 1.35;
        rig.lArm.rotation.x = -0.25; rig.rArm.rotation.x = -0.25;
      } else if (idleT.current > 6 && grounded.current) {
        // weight shift + slow look-around; every ~16 s he checks his phone
        rig.torso.rotation.z = Math.sin(tNow * 0.5) * 0.05;
        rig.head.rotation.y = Math.sin(tNow * 0.23) * 0.3;
        const cyc = idleT.current % 16;
        if (cyc > 10 && cyc < 12.5) {
          rig.head.rotation.x = 0.42; rig.head.rotation.y = 0;
          rig.rArm.rotation.x = -0.85; rig.rFore.rotation.x = -0.5;
          rig.lArm.rotation.x = -0.55; rig.lFore.rotation.x = -0.45;
        }
      }
      // ---- Phase 6 pose layers (after the base poses) ----
      if (vault.current) {
        // vault arc: legs tucked forward, arms swinging over the obstacle
        const p = Math.min(1, vault.current.t / vault.current.dur);
        const tuck = Math.sin(p * Math.PI);
        rig.lThigh.rotation.x = -1.15 * tuck; rig.rThigh.rotation.x = -0.85 * tuck;
        rig.lShin.rotation.x = 1.2 * tuck; rig.rShin.rotation.x = 1.0 * tuck;
        rig.lArm.rotation.x = -1.7 * tuck; rig.rArm.rotation.x = -1.4 * tuck;
        rig.torso.rotation.x = 0.22 * tuck;
      }
      if (tNow < G.eatingUntil) {
        // vendor food: right hand to mouth, small bites (A4)
        rig.rArm.rotation.x = -1.85 + Math.sin(tNow * 7) * 0.08;
        rig.rFore.rotation.x = -0.55;
        rig.head.rotation.x = 0.14;
      }
      if (G.health < 25 && grounded.current) {
        // limp (A7): hunched torso, head down — pairs with the speed cut
        rig.torso.rotation.x += 0.23;
        rig.head.rotation.x += 0.17;
        rig.lArm.rotation.z = 0.16; rig.rArm.rotation.z = -0.16;
      }
      // ---- Phase 9 pose layers: free-aim gun arm + arrest hands-up ----
      if (G.aiming && G.weaponSel !== "fist" && G.weaponSel !== "bottle") {
        // two-handed aim: gun arm level at the camera ray, support hand up
        rig.rArm.rotation.x = -1.45; rig.rFore.rotation.x = -0.08;
        rig.lArm.rotation.x = -1.18; rig.lFore.rotation.x = -0.38;
        rig.head.rotation.x = -0.06;
      }
      const bustAmt = grounded.current
        ? Math.max(
            G.bustTimer > 0.15 ? Math.min(1, G.bustTimer / 2.2) : 0,
            G.hold?.label.startsWith("Surrendering") ? G.hold.progress : 0)
        : 0;
      if (bustAmt > 0) {
        // arrest/surrender: both hands rise with the bust meter — the
        // visible half of an arrest (no cuffing rig exists; see audit)
        rig.lArm.rotation.x = -2.95 * bustAmt; rig.rArm.rotation.x = -2.95 * bustAmt;
        rig.lArm.rotation.z = 0.25 * bustAmt; rig.rArm.rotation.z = -0.25 * bustAmt;
        rig.lFore.rotation.x = -0.15 * bustAmt; rig.rFore.rotation.x = -0.15 * bustAmt;
        rig.head.rotation.x = -0.2 * bustAmt;
      }
    }
  }

  return (
    <group ref={root}>
      <primitive object={rig.group} />
      <group userData={{ animation: animationLabel }} />
    </group>
  );
}
