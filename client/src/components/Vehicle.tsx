import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PhysicsEngine } from "../physics/GamePhysics";
import { isInteractiveTarget, normalizeGameKey } from "../keyboard";
import { isBind } from "../game/keybinds";
import { isBlocked, FUEL_STATIONS, groundYAt, isWaterAt, BRIDGE, buildings, surfaceGripBase, surfaceKindAt, STREAMED_DISTRICTS } from "../world";
import { G, addCrime, toast, noteLastCar } from "../game/store";
import { glowTexture } from "../textures";
import { sfx } from "../game/audio";
import { gyroSteer } from "../game/gyro";
import { SIM_STEP, SIM_MAX_SUBSTEPS } from "../game/perf";
import { completeBreakIn, carAlarms } from "../game/theft";
import { J, isServiceCar, serviceClaimsE } from "../game/jobs";
import { tickDrift, resetDrift } from "../game/drift";
import { BIKE_POSE } from "../game/bikepose";
import { honkHorn } from "../game/horn";
import { boatFishClaimsE } from "../game/phase8";
import { tier } from "../game/quality";
import { padKeys, padAxes } from "../game/gamepad";
import { touchSteer } from "../game/touch";

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
import CarBody from "./CarBody";

/** CarBody wrapper that re-renders when the car's window gets smashed
 * (break-ins mutate G.cars outside React). Damage/steer stay ref-driven. */
function LiveCarBody({ index, steerRef, brakeRef, suspRef }: { index: number; steerRef: MutableRefObject<number>; brakeRef: MutableRefObject<boolean>; suspRef: MutableRefObject<Float32Array> }) {
  const [, setTick] = useState(0);
  const last = useRef(`${G.cars[index].brokenWindow}|${G.cars[index].color}`);
  useFrame(() => {
    // re-render on window smash AND on respray (Phase 6 mods change colour)
    const sig = `${G.cars[index].brokenWindow}|${G.cars[index].color}`;
    if (sig !== last.current) { last.current = sig; setTick((t) => t + 1); }
  });
  const c = G.cars[index];
  return <CarBody kind={c.kind} color={c.color} carIndex={index} steerRef={steerRef} liveDamage={() => G.cars[index].damage} liveDent={() => G.cars[index].dent} suspRef={suspRef} brokenWindow={c.brokenWindow} interior brakeRef={brakeRef} spotLights />;
}

/** Phase 10: [halfWidth, halfLength] per kind for the vehicle_body
 * wheel-height sampling (matches CarBody's wheel placement). */
// Phase 12: reused per-wheel ground-height tuple for the C++
// vehicle_body step (consumed synchronously inside the step)
const wheelHScratch: [number, number, number, number] = [0, 0, 0, 0];
const BODY_DIMS: Record<string, [number, number]> = {
  sedan: [1.0, 1.85], taxi: [1.0, 1.85], coupe: [1.0, 1.95], hatch: [0.95, 1.6],
  muscle: [1.05, 2.2], suv: [1.05, 2.1], classic: [1.0, 2.25], pickup: [1.05, 2.05],
  van: [1.05, 2.1], supercar: [1.1, 2.15], bus: [1.25, 3.5], wedge: [1.15, 2.25],
  hyper: [1.1, 2.2], gt: [1.0, 2.3], tow: [1.05, 2.05],
  // Phase 18
  kestrel: [1.04, 1.98], bronto: [1.1, 2.2],
  // Phase 28
  tempest: [1.06, 2.18], mule: [1.1, 2.1],
  sovereign: [1.08, 2.2], // Phase 48: the Crown car (Tempest family, a touch longer)
  // Phase 32: service fleet
  ambulance: [1.05, 2.1], firetruck: [1.1, 2.2],
  // Phase 40: the bike census — the motorcycle was MISSING here and
  // silently read the sedan fallback [1.0, 1.85] in the vehicleBody
  // wheel sampling below (its wz landed at 1.13 instead of its real
  // wheelbase). Its mesh ignores the step's pitch/roll, but
  // car.bodyHeave IS consumed by the group position, so the wrong
  // footprint had a small real effect. [0.12, 1.54] puts the sample
  // corners on the Stinger's actual contact patches (CarBody wheels
  // at z ±0.82 → wz = 1.54 − 0.72 = 0.82). The bicycle entry
  // completes the table (wheels z ±0.55 → wz = 1.27 − 0.72); its own
  // kinematic branch does not consume BODY_DIMS today — the entry
  // exists so no future reader inherits a silent fallback.
  motorcycle: [0.12, 1.54], bicycle: [0.1, 1.27],
};

export default function Vehicle(p: Props) {
  const groups = useRef<Array<THREE.Group | null>>([]);
  const smokeRefs = useRef<Array<THREE.Group | null>>([]);
  const keys = useRef(new Set<string>());
  const refs = useRef(p); refs.current = p;
  const nearRef = useRef(false);
  const wasBlocked = useRef(false);
  const wasDriving = useRef(false); // Phase 18: drift-chain exit reset
  // Phase 21: visual fall state for the driven car (landing feel) —
  // y = height the mesh still hangs above the (snapped) ground,
  // vy = fall speed, t = airborne time, prevY = last step's ground
  const fall = useRef({ y: 0, vy: 0, t: 0, prevY: 0, carId: -1 });
  const driveAcc = useRef(0); // Phase 12: fixed-step accumulator for the driving step
  const refuelTimer = useRef(0);
  const warnedRef = useRef({ wrecked: false, empty: false });
  // ---- burnout / drift tyre-smoke pool (white sprite puffs, rear wheels) ----
  const puffRefs = useRef<Array<THREE.Sprite | null>>([]);
  const puffs = useRef<Array<{ life: number; x: number; y: number; z: number }>>(
    Array.from({ length: 22 }, () => ({ life: 0, x: 0, y: -10, z: 0 })));
  const puffIdx = useRef(0);
  const spawnAcc = useRef(0);
  // ---- Phase 6: speedboat wake foam pool (flat sprites on the water) ----
  // Phase 28: each puff carries an `amp` — the speed fraction of the
  // boat that laid it — so a fast boat's wake reads denser and wider
  // than a puttering skiff's.
  const wakeRefs = useRef<Array<THREE.Sprite | null>>([]);
  const wakes = useRef<Array<{ life: number; x: number; z: number; amp: number }>>(
    Array.from({ length: 16 }, () => ({ life: 0, x: 0, z: 0, amp: 0 })));
  const wakeIdx = useRef(0);
  const wakeAcc = useRef(0);
  const skidCd = useRef(0);
  const puffTex = glowTexture();
  // Phase 4: shared steering ref (front wheels + cabin wheel), break-in hold
  const steerRef = useRef(0);
  // Phase 44: DRIVE ASSIST — the smoothed steering value (the merge
  // in stepDrive chases the raw merged input with it while the
  // assist setting is on; reset on every drive start so a new car
  // never inherits the last car's wheel angle).
  const assistSteerRef = useRef(0);
  const brakeRef = useRef(false); // Phase 5: brake-light boost state
  // Phase 40: driven-bike pose state machines — the wheelie (amount,
  // display amount, over-balance clock, loop-out recovery) and the
  // bicycle bunny hop. Results reach the mesh sync + Player's rider
  // rig through game/bikepose.ts (BIKE_POSE).
  const wheelieSt = useRef({ amt: 0, disp: 0, overT: 0, downT: 0 });
  const hopSt = useRef({ t: -1, prevSpace: false });
  // ---- Phase 28: boat + plane presentation state ----
  // boatBow: the driven (and parked) hulls' planing bow-lift, eased
  // in the mesh sync; chartToasted: the off-chart clamp tells the
  // player once per session, not every step.
  const boatBow = useRef(new Map<number, number>());
  const chartToasted = useRef(false);
  // planeSquash: landing-gear compression 0..1 per plane, set on
  // touchdown in the flight branch, decayed in the mesh sync.
  const planeSquash = useRef(new Map<number, number>());
  // ---- Phase 9: per-plane flight state (altitude above ground + vy) ----
  const planeAlt = useRef(new Map<number, { alt: number; vy: number }>());
  const planeState = (id: number) => {
    let s = planeAlt.current.get(id);
    if (!s) { s = { alt: 0, vy: 0 }; planeAlt.current.set(id, s); }
    return s;
  };
  const alarmRefs = useRef<Array<THREE.Sprite | null>>([]);
  // ---- Phase 10: per-wheel suspension compressions per fleet car
  // (written by the C++ vehicle_body step, read by CarBody's wheels) ----
  const suspRefs = useRef<Array<{ current: Float32Array }>>(G.cars.map(() => ({ current: new Float32Array([0.45, 0.45, 0.45, 0.45]) })));
  const slipNow = useRef({ slip: 0, kind: "asphalt" as string });
  const eHeld = useRef(false);
  const lastCarTick = useRef(0); // Phase 13: last-car snapshot refresh timer
  const breakIn = useRef<{ car: number; since: number } | null>(null);
  const alarmBeep = useRef(0);

  useEffect(() => {
    const enterCar = (best: number) => {
      G.activeCarId = best; G.driving = true; refs.current.onDrivingChange(true); sfx.door();
      warnedRef.current = { wrecked: false, empty: false };
      if (G.cars[best].damage >= 100) toast("This car is wrecked — it won't move. Find another ride.");
      else if (G.cars[best].fuel <= 0.5) toast("This car is out of fuel. A fuel station can fill it — if you can push it there… (find another car)");
      // Phase 32: the service fleet is handed over with the keys in
      // it — taking the ambulance or the fire tender on a shift is
      // the service's own act, never a steal (and never a break-in:
      // see breakInEligible). The jobs are wanted-neutral by design.
      if (!G.cars[best].owned && !G.cars[best].stolen && !isServiceCar(best)) { G.cars[best].stolen = true; addCrime("steal"); sfx.crime(); }
      noteLastCar(G.cars[best]); // Phase 13: this is now your last-used car
    };
    const nearestCar = (): number => {
      const pl = refs.current.playerPositionRef.current;
      let best = -1; let bestD = 0;
      G.cars.forEach((c, i) => {
        // the boats are boarded from the pier edge / while swimming —
        // they get a longer reach than a kerbside car door; the plane
        // gets a wing's-width reach on the apron
        const reach = c.kind === "boat" || c.kind === "skiff" ? 5.4 : c.kind === "plane" ? 4.6 : 3.6;
        const d = (c.state.x - pl.x) ** 2 + (c.state.z - pl.z) ** 2;
        if (d < reach ** 2 && (best < 0 || d < bestD)) { bestD = d; best = i; }
      });
      return best;
    };
    const breakInEligible = (i: number) => {
      const c = G.cars[i];
      return !!c && !c.owned && !c.stolen && !c.brokenWindow && c.kind !== "motorcycle" && !isServiceCar(i);
    };
    const down = (e: KeyboardEvent) => {
      if (refs.current.paused || G.dialogueActive || isInteractiveTarget(e.target)) return;
      const key = normalizeGameKey(e.key);
      // Phase 14: handbrake follows the JUMP binding and plane climb
      // the SPRINT binding (same translation as Player.tsx); the
      // physical Space/Shift only drive while they are the binding
      if (["w", "a", "s", "d"].includes(key) && G.driving) { e.preventDefault(); keys.current.add(key); }
      if (isBind(e, "jump") && G.driving) { e.preventDefault(); keys.current.add(" "); }
      if (isBind(e, "sprint") && G.driving) keys.current.add("shift");
      // Phase 9: Shift/Ctrl are the plane's climb/descend controls
      if ((key === "shift" || key === "control") && G.driving) keys.current.add(key);
      if (key === "b" && G.driving && !e.repeat) { honkHorn(); e.preventDefault(); } // Phase 22: the street hears it now (game/horn.ts)
      if ((isBind(e, "interact") || key === "f") && !e.repeat) {
        // Phase 13: while riding the tram, E belongs to the tram
        // (App fires G.interact) — never enter a car off the guideway
        if (G.tramRide >= 0) { e.preventDefault(); return; }
        // Phase 24: while boat fishing owns the interact key (a cast
        // in progress, or a still boat with the cast prompt up), E
        // belongs to the rod — never step ashore mid-cast. F is not
        // yielded: it still steps out, which ends the session.
        if (key !== "f" && isBind(e, "interact") && boatFishClaimsE()) { e.preventDefault(); return; }
        // Phase 32: same ownership rule for the service jobs — while
        // a treat / hose / refill channel context is live (on foot,
        // in range, shift running), E belongs to the channel in
        // ServiceJobs, not to the ambulance door beside you. F still
        // enters, as with the rod.
        if (key !== "f" && isBind(e, "interact") && serviceClaimsE()) { e.preventDefault(); return; }
        if (G.driving) {
          const car = G.cars[G.activeCarId];
          // Phase 9: no bailing out of a flying plane — land first
          if (car.kind === "plane" && (planeAlt.current.get(car.id)?.alt ?? 0) > 2) { toast("You can't bail out mid-flight — land the Sparrow first."); e.preventDefault(); return; }
          noteLastCar(car); // Phase 13: finalise the last-car snapshot where you left it
          const exit = new THREE.Vector3(car.state.x + Math.cos(car.state.heading) * 2.4, 0, car.state.z - Math.sin(car.state.heading) * 2.4);
          G.driving = false; refs.current.onDrivingChange(false); refs.current.onExit(exit);
          G.playerPos.copy(exit); keys.current.clear(); sfx.door(); e.preventDefault(); return;
        }
        const best = nearestCar();
        if (best >= 0) {
          // Phase 4: HOLD the interact key on a locked, unowned car =
          // break-in; a quick TAP still just gets in (existing steal
          // flow). F always enters (and always just enters).
          if (isBind(e, "interact") && key !== "f" && breakInEligible(best)) {
            eHeld.current = true;
            breakIn.current = { car: best, since: performance.now() };
            e.preventDefault(); return;
          }
          enterCar(best);
          e.preventDefault();
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      const key = normalizeGameKey(e.key);
      keys.current.delete(key);
      // Phase 14: release the canonical tokens for bound keys too
      if (isBind(e, "jump")) keys.current.delete(" ");
      if (isBind(e, "sprint")) keys.current.delete("shift");
      if (isBind(e, "interact")) {
        eHeld.current = false;
        if (breakIn.current) {
          const heldMs = performance.now() - breakIn.current.since;
          const carIdx = breakIn.current.car;
          breakIn.current = null; G.hold = null;
          if (heldMs < 250) enterCar(carIdx); // it was a tap after all
        }
      }
    };
    const blur = () => { keys.current.clear(); eHeld.current = false; breakIn.current = null; G.hold = null; };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, []);

  useFrame(({ clock }, delta) => {
    const { paused, physicsRef, vehicleStateRef, vehiclePositionRef } = refs.current;
    const dt = Math.min(delta, 0.05);
    // Phase 13: refresh the last-car snapshot every ~2.5 s at the
    // wheel (position/damage/fuel drift as you drive; noteLastCar
    // clears it instead if the car has just been wrecked)
    lastCarTick.current += dt;
    // Phase 18: stepping out abandons any open drift chain
    if (wasDriving.current && !G.driving) resetDrift();
    // Phase 44: a fresh drive starts with a centred assisted wheel
    if (!wasDriving.current && G.driving) assistSteerRef.current = 0;
    wasDriving.current = G.driving;
    if (G.driving && G.activeCarId >= 0 && lastCarTick.current > 2.5) {
      lastCarTick.current = 0;
      noteLastCar(G.cars[G.activeCarId]);
    }
    // Phase 12: the driving step runs at a FIXED 60 Hz — stepDrive is
    // defined here (closing over this frame's refs) and run 0–3× by
    // the accumulator driver right after its definition. The systems
    // after the driver (break-in, pools, alarms, mesh sync) keep the
    // clamped frame dt, as before.
    function stepDrive(dt: number) {
      const car = G.cars[G.activeCarId];
      // Phase 8: keyboard ∪ gamepad (padKeys) — one merged view; the
      // analog stick / triggers ride padAxes alongside (see steering)
      const k = { has: (key: string) => keys.current.has(key) || padKeys.has(key) };
      const isBike = car.kind === "bicycle";
      const isBoat = car.kind === "boat" || car.kind === "skiff";
      const isPlane = car.kind === "plane";
      // ---- Phase 2: damage + fuel shape the driving (arcade-forgiving) ----
      const wrecked = !isBike && !isBoat && car.damage >= 100;
      const empty = !isBike && !isBoat && car.fuel <= 0;
      if (wrecked && !warnedRef.current.wrecked) { warnedRef.current.wrecked = true; toast("WRECKED — this car is done. Get out (E) and find another ride."); }
      if (empty && !warnedRef.current.empty) { warnedRef.current.empty = true; toast("Out of fuel! Coast to a stop and find another car — fuel stations refill runners."); }
      let power = wrecked || empty ? 0 : car.damage > 60 ? 0.55 : car.damage > 35 ? 0.82 : 1;
      // Phase 8: towing a hooked car halves the wrecker's pull
      if (car.kind === "tow" && J.towHooked) power *= 0.55;
      let throttle = (Number(k.has("w")) - Number(k.has("s"))) * power;
      // Phase 8 gamepad: analog triggers feed throttle when keys are idle
      if (throttle === 0 && Math.abs(padAxes.throttle) > 0.05) throttle = padAxes.throttle * power;
      brakeRef.current = k.has("s") || k.has(" ");
      // steering priority (last-input-wins): keys → gamepad stick →
      // touch stick → gyro. Gyro only steers while BOTH sticks sit
      // inside their deadzones — a deflected stick always wins.
      const keySteer = Number(k.has("a")) - Number(k.has("d"));
      const rawSteering = keySteer !== 0 ? keySteer
        : Math.abs(padAxes.steer) > 0.02 ? padAxes.steer
        : Math.abs(touchSteer) > 0.02 ? touchSteer
        : gyroSteer();
      // ---- Phase 44: DRIVE ASSIST (Settings → Assists). The
      // smoothing sits HERE — after the input merge above, before
      // every consumer below — so keyboard, gamepad, touch stick
      // and gyro are all assisted identically. It is a presentation
      // of the INPUT only: the smoothed value chases the raw one
      // with a time constant that grows with speed (Light: ~0.05 s
      // parked → ~0.18 s at pace; Full: ~0.08 s → ~0.30 s), which
      // takes the twitch out of high-speed steering without moving
      // any physics number, top speed or grip figure. Road vehicles
      // only: the boat helm already has its own speed-sensitive
      // steering (Phase 28) and the plane is a flight model, so
      // both keep the raw input. The DRIFT FEED below deliberately
      // reads rawSteering, so drift scoring (its lock threshold and
      // angle estimate) is bit-for-bit the pre-assist model, and
      // the handbrake/wheelie inputs are read from the key set, not
      // from steering at all — the assist cannot suppress either.
      // With the setting off the ref simply tracks the raw value,
      // so toggling mid-drive never jumps the wheel. ----
      let steering = rawSteering;
      const assistMode = G.settings.driveAssist;
      if (assistMode !== "off" && !isBoat && !isPlane) {
        const spdFrac = THREE.MathUtils.clamp(Math.abs(car.state.speed) / (isBike ? 7.6 : 20), 0, 1);
        const tau = assistMode === "full" ? 0.08 + 0.22 * spdFrac : 0.05 + 0.13 * spdFrac;
        assistSteerRef.current += (rawSteering - assistSteerRef.current) * (1 - Math.exp(-dt / tau));
        steering = assistSteerRef.current;
      } else assistSteerRef.current = rawSteering;
      steerRef.current = steering;
      const prevSpeed = car.state.speed;
      const prevHeading = car.state.heading;
      let next = { ...car.state };
      if (isBike) {
        // ---- Phase 6 bicycle: pedal power, stamina-capped (A3/A7) ----
        G.bikePedalling = throttle > 0 && G.stamina > 1;
        const top = G.stamina > 1 ? 7.6 : 3.1; // exhausted legs barely turn the pedals
        if (throttle > 0) next.speed = Math.min(top, next.speed + 5.5 * dt);
        else if (throttle < 0) next.speed = Math.max(-2, next.speed - 6 * dt);
        next.speed -= next.speed * 1.1 * dt; // rolling drag
        if (Math.abs(next.speed) < 0.04 && throttle === 0) next.speed = 0;
        next.heading += steering * 1.7 * dt * THREE.MathUtils.clamp(Math.abs(next.speed) / 3, 0, 1) * (next.speed < 0 ? -1 : 1);
        next.x += Math.sin(next.heading) * next.speed * dt;
        next.z += Math.cos(next.heading) * next.speed * dt;
        if (isBlocked(next.x, next.z, 0.85) || isWaterAt(next.x, next.z)) { next.x = car.state.x; next.z = car.state.z; next.speed = 0; }
        // ---- Phase 40: BUNNY HOP — a TAP of the jump binding
        // (Space; the DRIFT touch button on mobile; gamepad X)
        // while rolling pops the bike ~0.5u for ~0.46 s. The input
        // is clean: this branch has never read " " before, so no
        // bicycle function is overloaded. PRESENTATION ONLY — the
        // hop lives in BIKE_POSE.hopY, which the mesh sync and the
        // rider rig read; car.state is never touched, so the
        // blocker/water check above still stops the bike mid-hop.
        // It clears nothing: a hop, not a jump over obstacles. ----
        const spaceNow = k.has(" ");
        if (spaceNow && !hopSt.current.prevSpace && hopSt.current.t < 0 && Math.abs(next.speed) > 1.5) hopSt.current.t = 0;
        hopSt.current.prevSpace = spaceNow;
        if (hopSt.current.t >= 0) {
          hopSt.current.t += dt;
          const hp = hopSt.current.t / 0.46;
          if (hp >= 1) { hopSt.current.t = -1; BIKE_POSE.hopY = 0; }
          else BIKE_POSE.hopY = Math.sin(hp * Math.PI) * 0.5;
        } else BIKE_POSE.hopY = 0;
      } else if (isBoat) {
        // ---- Phase 6 speedboat: water-only drive, buoyancy in the render
        // loop below. Beaching (bow touches land) stops the boat dead;
        // reverse backs it off the shore. Phase 9: the fishing skiff
        // shares the branch with a working boat's pace. ----
        const boatTop = car.kind === "skiff" ? 9.5 : 14.5;
        if (throttle > 0) next.speed = Math.min(boatTop, next.speed + 4.6 * dt);
        else if (throttle < 0) next.speed = Math.max(car.kind === "skiff" ? -3.2 : -4.5, next.speed - 3.6 * dt);
        next.speed -= next.speed * 0.45 * dt; // water drag
        if (Math.abs(next.speed) < 0.03 && throttle === 0) next.speed = 0;
        // Phase 28: SPEED-SENSITIVE STEERING — a real helm gets heavy
        // at speed: the turn rate keeps its low-speed authority for
        // docking (and for holding a fishing spot) but eases off by
        // up to 45% at full throttle, so a fast run stops twitching.
        const spdFrac = THREE.MathUtils.clamp(Math.abs(next.speed) / boatTop, 0, 1);
        next.heading += steering * 0.55 * dt * THREE.MathUtils.clamp(Math.abs(next.speed) / 6, 0.2, 1) * (1 - 0.45 * spdFrac) * (next.speed < 0 ? -1 : 1);
        next.x += Math.sin(next.heading) * next.speed * dt;
        next.z += Math.cos(next.heading) * next.speed * dt;
        // Phase 28: STORM DRIFT — in a storm (and, weaker, in heavy
        // rain) the wind pushes the hull onshore toward the harbour
        // (+x/+z, the prevailing south-westerly). Positional only:
        // state.speed is untouched, so the fishing anchor test
        // (|speed| < 0.5 in game/phase8.ts) stays exactly as honest
        // as before — a drifting boat keeps its session, and the
        // water check below still refuses to let drift beach it.
        const stormF = G.weather === "Storm" ? 1 : G.rainAmt >= 0.55 ? 0.45 : 0;
        if (stormF > 0) {
          const push = stormF * (0.5 + G.wind * 0.9) * 1.15 * dt;
          next.x += 0.53 * push; next.z += 0.85 * push;
        }
        if (!isWaterAt(next.x, next.z)) {
          if (next.speed > 0) { next.x = car.state.x; next.z = car.state.z; next.speed = 0; if (!wasBlocked.current) toast("Beached! Reverse (S) to back off the shore."); wasBlocked.current = true; }
          else { next.x = car.state.x; next.z = car.state.z; next.speed = Math.min(0, next.speed); }
        } else wasBlocked.current = false;
        // Phase 28 audit: THE CHART EDGE. Boats were the one vehicle
        // class with NO position clamp — the client let a hull sail
        // unboundedly into open water, producing positions the
        // multiplayer server must reject as off-chart (its bounds
        // are land + a 48u sea margin). The hull now stops at the
        // chart, like the car and plane clamps stop at theirs, and
        // says so once per session.
        // Phase 31: the chart grew north with Northreach — the
        // server's Z_MIN moved to −416 (land −368 + 48 of sea), so
        // the hull's clamp (server bounds inset by 4, the Phase 28
        // rule) moves to −412: boats can round Northreach and sail
        // the strait north of it, still inside the server's bounds.
        const cx = THREE.MathUtils.clamp(next.x, -240, 170);
        const cz = THREE.MathUtils.clamp(next.z, -412, 368);
        if (cx !== next.x || cz !== next.z) {
          next.x = cx; next.z = cz;
          if (!chartToasted.current) { chartToasted.current = true; toast("Open sea — the harbour chart ends here. What lies beyond isn't on any Port Sable map."); }
        }
        // wake foam spawns behind a moving boat (pool below) —
        // Phase 28: cadence and strength now follow the speed, so
        // the wake builds with the throttle instead of popping in
        // at a fixed rate the moment the hull moves
        if (Math.abs(next.speed) > 3) {
          wakeAcc.current += dt;
          const cadence = 0.13 - 0.085 * spdFrac; // 0.13 s puttering → 0.045 s at full speed
          while (wakeAcc.current > cadence) {
            wakeAcc.current -= cadence;
            const w = wakes.current[wakeIdx.current % wakes.current.length];
            wakeIdx.current += 1;
            w.life = 1;
            w.amp = 0.35 + 0.65 * spdFrac;
            w.x = next.x - Math.sin(next.heading) * 2.4 + (Math.random() - 0.5) * 0.8;
            w.z = next.z - Math.cos(next.heading) * 2.4 + (Math.random() - 0.5) * 0.8;
          }
        }
      } else if (isPlane) {
        // ---- Phase 9: the Sable Sparrow — an honest ARCADE flight model
        // (documented in VISUAL_AUDIT): ground roll, lift past 16.5 u/s,
        // Shift climbs / Ctrl descends, stall sink below 13 u/s, banked
        // turns, hard-touchdown and building-strike crash rules, water
        // ditching wrecks the airframe. No physics-core step: flight is
        // presentation-tier, like the bicycle/boat branches. ----
        const fs = planeState(car.id);
        const dmgF = car.damage >= 100 ? 0 : car.damage > 60 ? 0.5 : 1;
        if (throttle > 0) next.speed = Math.min(36, next.speed + 8.5 * dt * dmgF);
        else if (throttle < 0) next.speed = Math.max(0, next.speed - (fs.alt > 0.05 ? 4 : 11) * dt);
        next.speed -= next.speed * (fs.alt > 0.05 ? 0.1 : 0.32) * dt; // air drag vs rolling drag
        if (Math.abs(next.speed) < 0.03 && throttle === 0) next.speed = 0;
        const sfly = THREE.MathUtils.clamp(Math.abs(next.speed) / 8, 0, 1);
        next.heading += steering * (fs.alt > 0.05 ? 0.5 : 0.38) * sfly * dt;
        next.x += Math.sin(next.heading) * next.speed * dt;
        next.z += Math.cos(next.heading) * next.speed * dt;
        // Phase 31 audit: the plane box grows over a LOADED streamed
        // district it is entering, same rule as the road-car clamp
        // below — the fixed Phase 9 box (|x| ≤ 135, z ≥ −305) fit
        // Eastmere but never Westbrook (x −196..−130) or Northreach
        // (z −368..−304): the Sparrow could not overfly either.
        let pxMin = -135, pxMax = 135, pzMin = -305, pzMax = 335;
        for (const d of STREAMED_DISTRICTS) {
          if (!d.loaded) continue;
          if (next.x >= d.x0 - 6 && next.x <= d.x1 + 6 && next.z >= d.z0 - 6 && next.z <= d.z1 + 6) {
            pxMin = Math.min(pxMin, d.x0 - 2); pxMax = Math.max(pxMax, d.x1 + 2);
            pzMin = Math.min(pzMin, d.z0 - 2); pzMax = Math.max(pzMax, d.z1 + 2);
          }
        }
        next.x = THREE.MathUtils.clamp(next.x, pxMin, pxMax);
        next.z = THREE.MathUtils.clamp(next.z, pzMin, pzMax);
        // vertical model
        let vy = 0;
        if (next.speed >= 16.5) vy += (next.speed - 16.5) * 0.22; // ground-effect lift
        if (k.has("shift")) vy += 5.2;
        if (k.has("control")) vy -= 6.5;
        if (fs.alt > 0.05 && next.speed < 13) vy -= 4.5; // stall: the nose drops
        const prevAlt = fs.alt;
        fs.alt = Math.max(0, Math.min(60, fs.alt + vy * dt));
        fs.vy = vy;
        // Phase 28: any touchdown compresses the gear (visual — the
        // mesh sync decays it); a firmer arrival compresses deeper.
        // The hard-landing DAMAGE rule below is untouched.
        if (prevAlt > 0.05 && fs.alt <= 0.02) {
          planeSquash.current.set(car.id, THREE.MathUtils.clamp(Math.abs(vy) / 9, 0.25, 1));
        }
        if (prevAlt > 0.5 && fs.alt <= 0 && vy < -7.5) {
          // slammed the runway: bent gear, real damage, speed scrubbed
          car.damage = Math.min(100, car.damage + 42);
          G.health = Math.max(0, G.health - 6);
          G.eventQueue.push("shake", "hitwall"); sfx.crash();
          toast("Hard landing! The Sparrow's gear took it badly.");
          next.speed *= 0.35;
        }
        if (fs.alt <= 0.02) {
          // on the ground (or the water): taxi rules
          if (isWaterAt(next.x, next.z) && groundYAt(next.x, next.z) <= 0.05) {
            if (Math.abs(car.state.speed) > 3) { car.damage = 100; G.eventQueue.push("shake", "hitwall"); sfx.crash(); sfx.splash(); toast("DITCHED — the Sparrow is wrecked in the bay. Swim for it (E)."); }
            next.x = car.state.x; next.z = car.state.z; next.speed = 0;
          } else if (isBlocked(next.x, next.z, 1.3)) {
            if (Math.abs(car.state.speed) > 7) { car.damage = Math.min(100, car.damage + 22); G.eventQueue.push("shake", "hitwall"); sfx.crash(); }
            next.x = car.state.x; next.z = car.state.z; next.speed = 0;
          }
        } else {
          // airborne: building strike — revert, scrub speed, real damage
          for (const b of buildings) {
            if (Math.abs(next.x - b.x) < b.width / 2 + 1 && Math.abs(next.z - b.z) < b.depth / 2 + 1 && fs.alt < b.height - 1) {
              next.x = car.state.x; next.z = car.state.z; next.speed *= 0.25;
              car.damage = Math.min(100, car.damage + 30);
              G.eventQueue.push("shake", "hitwall"); sfx.crash();
              toast("You clipped a tower! The Sparrow is barely holding together.");
              break;
            }
          }
        }
        // render pose: nose follows the climb, wings bank into turns
        // Phase 28: the STALL gets a face — below flying speed the
        // nose visibly drops (a pose on top of the existing stall
        // sink, which already costs altitude) and the HUD stall
        // chip lights (G.stallWarn, with hysteresis so it doesn't
        // flicker at the boundary). Flight numbers are unchanged:
        // lift at 16.5, sink below 13, exactly as Phase 9 shipped.
        const stalled = fs.alt > 0.5 && next.speed < 13;
        if (stalled) G.stallWarn = true;
        else if (fs.alt <= 0.5 || next.speed > 15.5) G.stallWarn = false;
        const stallDroop = stalled ? 0.2 : 0;
        const targetPitch = fs.alt > 0.05 ? THREE.MathUtils.clamp(-vy * 0.02 + stallDroop, -0.32, 0.42) : 0;
        const targetRoll = fs.alt > 0.05 ? -steering * 0.55 : 0;
        car.pitch += (targetPitch - car.pitch) * Math.min(1, dt * 4);
        car.roll += (targetRoll - car.roll) * Math.min(1, dt * 4);
      } else {
        // ---- Phase 10: surface grip folds weather into the C++ v3
        // step (dry asphalt 1.0 → wet 0.78 → rain-heavy 0.68; dirt and
        // sand start lower and dirt goes muddy) ----
        // Phase 36: the weather term reads ROAD WETNESS (G.roadWet),
        // not the live rain intensity. The formula is untouched —
        // while it rains roadWet tracks rainAmt within seconds, so
        // wet grip arrives exactly as before; afterwards the street
        // stays slippery while it visibly dries (~2.5 min), instead
        // of gripping up the instant the rain stops.
        const surfKind = surfaceKindAt(car.state.x, car.state.z);
        const weatherF = surfKind === "asphalt" ? 1 - 0.32 * G.roadWet : surfKind === "dirt" ? 1 - 0.18 * G.roadWet : 1;
        let grip = surfaceGripBase(car.state.x, car.state.z) * weatherF;
        // ---- Phase 18 grip trades, both on this surface path into
        // step_vehicle_v3: drift tyres give up ~12% of wet-asphalt
        // grip for their slide rate (game/drift.ts), and the Bronto
        // Hauler's all-terrain tread is the one car whose grip
        // IMPROVES on dirt (0.72 base → ~0.9 before weather) ----
        if (car.driftTyres && surfKind === "asphalt" && G.roadWet > 0.05) grip *= 0.88;
        if (car.kind === "bronto" && surfKind === "dirt") grip = Math.min(1, grip * 1.25);
        // ---- Phase 28: the Sable Mule's knobbly farm tread beats
        // even the Bronto on dirt (0.72 base → ~0.99 before weather)
        // — the best dirt grip of any pickup in the range, bought
        // with the road cap below. ----
        if (car.kind === "mule" && surfKind === "dirt") grip = Math.min(1, grip * 1.38);
        const dmgBefore = car.damage; // Phase 18: drift collision signal
        // ---- Phase 40: the WHEELIE gesture (motorcycle only) —
        // the handbrake key (the jump binding: Space on keyboard,
        // the DRIFT touch button on mobile, gamepad X) HELD
        // together with the throttle at low-mid speed (2.5–15 u/s).
        // While the gesture is live the key is the wheelie input,
        // NOT the handbrake: the step below is fed handbrake=false
        // and the drift feed is told this press is not a drift. No
        // speed is added anywhere by the wheelie — it is pitch
        // only, plus the balance window in the motorcycle block
        // below (hold past it and the bike loops out, which only
        // ever COSTS speed). ----
        const wheelieGesture = car.kind === "motorcycle" && k.has(" ") && throttle > 0 && !wrecked && !empty
          && car.state.speed >= 2.5 && car.state.speed <= 15 && wheelieSt.current.downT <= 0;
        // Phase 41 audit: brakeRef (set earlier in this step from the
        // RAW key set) would keep the brake light burning for the
        // whole wheelie — while the gesture is live the press is the
        // wheelie, not the brake. (During a live gesture brakeRef can
        // only be true via the space key: throttle > 0 excludes S.)
        if (wheelieGesture) brakeRef.current = false;
        const stepped = physicsRef.current.stepVehicleV3(car.state, throttle, steering, k.has(" ") && !wheelieGesture, grip, dt);
        next = stepped.state;
        slipNow.current.slip = stepped.slip; slipNow.current.kind = surfKind; // Phase 12: mutate (was a fresh object per step)
        // ---- Phase 10: per-wheel suspension + body dynamics (C++
        // vehicle_body): ground heights sampled under each wheel
        // (bridge ramps, the parking deck, kerbs of altitude) drive
        // wheel travel + body pitch/roll/heave springs ----
        const dims = BODY_DIMS[car.kind] ?? [1.0, 1.85];
        const sh = Math.sin(car.state.heading), ch = Math.cos(car.state.heading);
        const baseY = groundYAt(car.state.x, car.state.z);
        const wz = dims[1] - 0.72;
        // Phase 12: corner heights computed directly into a reused
        // tuple (was a .map over a literal array, per step)
        const wheelH = wheelHScratch;
        for (let w = 0; w < 4; w++) {
          const ox = w % 2 === 0 ? -dims[0] : dims[0];
          const oz = w < 2 ? wz : -wz;
          wheelH[w] = groundYAt(car.state.x + ch * ox + sh * oz, car.state.z - sh * ox + ch * oz) - baseY;
        }
        const vb = physicsRef.current.vehicleBody(wheelH, (next.speed - prevSpeed) / Math.max(dt, 0.001), steering, next.speed,
          { pitch: car.pitch, roll: car.roll, heave: car.bodyHeave ?? 0, pitchVel: car.pitchVel ?? 0, rollVel: car.rollVel ?? 0, heaveVel: car.bodyHeaveVel ?? 0 }, dt);
        car.pitch = vb.pitch; car.roll = vb.roll; car.pitchVel = vb.pitchVel; car.rollVel = vb.rollVel;
        car.bodyHeave = vb.heave; car.bodyHeaveVel = vb.heaveVel;
        const susp = suspRefs.current[G.activeCarId];
        if (susp) susp.current.set(vb.comp);
        // ---- Phase 3: motorcycle character — harder launch, higher top end,
        // tighter turning (heading bias applied post-step, arcade style) ----
        if (car.kind === "motorcycle") {
          if (throttle > 0 && !wrecked && !empty) next.speed = Math.min(29, next.speed + 7.5 * dt * throttle);
          const sf = THREE.MathUtils.clamp(Math.abs(next.speed) / 4, 0.18, 1);
          next.heading += steering * 2.0 * sf * dt * (next.speed < 0 ? -1 : 1);
          // ---- Phase 40: WHEELIE state machine. amt eases 0→1
          // while the gesture holds (the mesh sync turns it into
          // pitch, up to ~0.62 rad). Past the balance point
          // (amt 0.72 ≈ 0.45 rad) a 1.5 s clock runs: let go of
          // Space or the throttle in time and the front wheel
          // settles; hold past it and the bike LOOPS OUT — the
          // documented arcade rule: a gentle fall, speed scrubbed
          // to a crawl, ~1.15 s of recovery with the speed capped
          // (the throttle can't relaunch mid-fall), and the rider
          // UNHARMED — no health is read or written anywhere in
          // this block. The wheelie itself never adds speed. ----
          const ws = wheelieSt.current;
          if (ws.downT > 0) {
            ws.downT -= dt;
            const p = 1 - Math.max(0, ws.downT) / 1.15;
            ws.disp = p < 0.25 ? 1 + (p / 0.25) * 0.45 : 1.45 * Math.max(0, 1 - (p - 0.25) / 0.75);
            ws.amt = 0; ws.overT = 0;
            next.speed = Math.min(next.speed, 3);
          } else if (wheelieGesture) {
            ws.amt = Math.min(1, ws.amt + dt * 1.4);
            ws.disp = ws.amt;
            if (ws.amt > 0.72) {
              ws.overT += dt;
              if (ws.overT > 1.5) {
                ws.downT = 1.15; ws.overT = 0;
                next.speed = Math.min(next.speed, 2);
                sfx.thud();
                if (G.settings.shake && tier() !== "low") G.shakeAmp = Math.max(G.shakeAmp, 0.12);
              }
            } else ws.overT = Math.max(0, ws.overT - dt * 2);
          } else {
            ws.amt = Math.max(0, ws.amt - dt * 2.2);
            ws.disp = ws.amt;
            ws.overT = Math.max(0, ws.overT - dt * 2);
          }
        }
        // ---- Phase 6: bus is heavy — capped low, whatever the tune ----
        if (car.kind === "bus") next.speed = THREE.MathUtils.clamp(next.speed, -6, 13.5);
        // ---- Phase 32: the service fleet's road pace — the medic
        // van runs brisk (it is an emergency vehicle), the fire
        // tender is heavy like the bus, whatever the tune ----
        if (car.kind === "ambulance") next.speed = THREE.MathUtils.clamp(next.speed, -7, 17);
        if (car.kind === "firetruck") next.speed = THREE.MathUtils.clamp(next.speed, -6, 13);
        // ---- Phase 8 exotics: the Vantara S and Kestrel One live ABOVE
        // the shared 24 u/s physics clamp — extra top-end push, same
        // idiom as the motorcycle branch ----
        if ((car.kind === "wedge" || car.kind === "hyper") && throttle > 0 && !wrecked && !empty) {
          const cap = car.kind === "hyper" ? 30 : 27.5;
          next.speed = Math.min(cap, next.speed + (car.kind === "hyper" ? 8.5 : 7.5) * dt * throttle);
        }
        // ---- Phase 28: the Vantara Tempest joins the push club —
        // a flagship GT's top end above the shared clamp, a step
        // above the Kestrel RS (which lives at the clamp on
        // handling), still below the wedge/hyper flagships ----
        if (car.kind === "tempest" && throttle > 0 && !wrecked && !empty) {
          next.speed = Math.min(26.5, next.speed + 7.2 * dt * throttle);
        }
        // ---- Phase 48: the Vantara Sovereign tops the push club's
        // GT tier — above its Tempest sibling, still below the
        // wedge/hyper flagships (30 / 27.5 caps) ----
        if (car.kind === "sovereign" && throttle > 0 && !wrecked && !empty) {
          next.speed = Math.min(28.5, next.speed + 8.0 * dt * throttle);
        }
        // ---- Phase 8: a hooked tow load caps the wrecker hard ----
        if (car.kind === "tow" && J.towHooked) next.speed = THREE.MathUtils.clamp(next.speed, -7, 11.5);
        // ---- Phase 18: the Bronto Hauler is geared for torque, not
        // speed — capped like the bus, whatever the tune (its tune
        // push below is clamped by this cap on the NEXT step) ----
        if (car.kind === "bronto") next.speed = THREE.MathUtils.clamp(next.speed, -7, 14);
        // ---- Phase 28: the Mule is geared even lower than the
        // Bronto — a farm truck's pace on tarmac, whatever the tune
        // (the tune push below is clamped by this cap next step) ----
        if (car.kind === "mule") next.speed = THREE.MathUtils.clamp(next.speed, -6, 11.5);
        // ---- Phase 6 (B1): Lina's mods — engine tune raises the top end,
        // brake upgrade bites harder; Driving skill ≥50 trims drift slide ----
        const tune = car.tuneLvl ?? 0;
        if (tune > 0 && throttle > 0 && next.speed > 8) next.speed = Math.min(next.speed + tune * 1.7 * dt, 24 + tune * 1.8);
        // Phase 18: brake tiers bite progressively — L1 keeps the
        // original 9/s, L2 12/s, L3 15/s
        if ((car.brakeLvl ?? 0) > 0 && k.has("s") && next.speed > 0) next.speed = Math.max(0, next.speed - (6 + 3 * (car.brakeLvl ?? 0)) * dt);
        // Phase 41 audit: the wheelie gesture is not a handbrake
        // drift — the slide trim must not eat heading mid-wheelie.
        if (k.has(" ") && !wheelieGesture && G.skills.driving >= 50) next.heading = prevHeading + (next.heading - prevHeading) * 0.9;
        // ---- Phase 6 (A5): a spiked tyre pulls, wobbles and caps speed ----
        if (car.flatTyre) {
          next.speed = THREE.MathUtils.clamp(next.speed, -8.5, 8.5);
          next.heading += (Math.sin(G.timeS * 5.7) * 0.1 + 0.045) * dt * Math.min(1, Math.abs(next.speed) / 6);
        }
        // Phase 31 audit: THE DISTRICT WALL. This clamp was a fixed
        // box fitted to the Phase 24 map (|x| ≤ 130, z −302..330)
        // with no streamed-district exception — it silently walled
        // the player's car out of Westbrook (x −196..−130) from the
        // day that district shipped. Eastmere (x ≤ 122, z ≥ −300)
        // happened to fit inside the box; Westbrook never did, and
        // Northreach (z −368..−304) would have been walled off
        // entirely. The clamp's only job is keeping the car on the
        // chart (inside the server's bounds); the chart includes
        // every LOADED streamed district, so the box grows to cover
        // a loaded district the car is in or entering — the same
        // rule isWaterAt already applies to land. The water and
        // blocker checks below remain the real walls.
        let cxMin = -130, cxMax = 130, czMin = -302, czMax = 330;
        for (const d of STREAMED_DISTRICTS) {
          if (!d.loaded) continue;
          if (next.x >= d.x0 - 6 && next.x <= d.x1 + 6 && next.z >= d.z0 - 6 && next.z <= d.z1 + 6) {
            cxMin = Math.min(cxMin, d.x0 - 2); cxMax = Math.max(cxMax, d.x1 + 2);
            czMin = Math.min(czMin, d.z0 - 2); czMax = Math.max(czMax, d.z1 + 2);
          }
        }
        next.x = THREE.MathUtils.clamp(next.x, cxMin, cxMax);
        next.z = THREE.MathUtils.clamp(next.z, czMin, czMax);
        // bridge causeway: stay on the deck corridor while elevated
        // (south bridge only — the Northgate parking deck is also elevated)
        if (next.z > 80 && (groundYAt(next.x, next.z) > 0.05 || groundYAt(car.state.x, car.state.z) > 0.05)) {
          next.x = THREE.MathUtils.clamp(next.x, BRIDGE.x - BRIDGE.halfW + 0.6, BRIDGE.x + BRIDGE.halfW - 0.6);
        }
        const hitsWater = isWaterAt(next.x, next.z) && groundYAt(next.x, next.z) <= 0.05;
        let wallCrashStep = false; // Phase 21: the wall branch owns this step's crash sound
        if (hitsWater || isBlocked(next.x, next.z, 1.3)) {
          if (!wasBlocked.current && Math.abs(car.state.speed) > 6) {
            G.eventQueue.push("shake", "hitwall"); G.health = Math.max(0, G.health - 4);
            car.damage = Math.min(100, car.damage + Math.min(18, Math.abs(car.state.speed) * 0.9));
            // Phase 10: the struck END crumples (front going forward,
            // back while reversing) — CarBody's dent panels read this
            car.dent ??= [0, 0, 0, 0];
            const di = car.state.speed >= 0 ? 0 : 1;
            car.dent[di] = Math.min(1, car.dent[di] + Math.min(0.45, Math.abs(car.state.speed) * 0.028));
            sfx.crash();
            wallCrashStep = true;
          }
          wasBlocked.current = true;
          next.x = car.state.x; next.z = car.state.z; next.speed = -car.state.speed * 0.25;
        } else wasBlocked.current = false;
        // ---- Phase 18: DRIFT SCORING feed (game/drift.ts). The
        // arcade model has no velocity vector, so the slip angle is
        // an ESTIMATE from steering lock + speed while the handbrake
        // is held — documented as a scoring model in drift.ts, not a
        // physics claim. Collision = this step's damage delta. ----
        tickDrift(dt, {
          // Phase 44: the feed reads the RAW merged steering, not
          // the drive-assist-smoothed value — the scoring model (its
          // lock threshold and angle estimate) is exactly the
          // pre-assist one whatever the assist setting says.
          drifting: k.has(" ") && !wheelieGesture && Math.abs(next.speed) > 6 && Math.abs(rawSteering) > 0.25 && !wrecked && !empty,
          angle: Math.abs(rawSteering) * THREE.MathUtils.clamp(Math.abs(next.speed) / 18, 0.3, 1) * 0.55,
          speed: next.speed,
          kind: car.kind,
          driftTyres: car.driftTyres ?? false,
          collision: car.damage > dmgBefore,
        });
        // ---- Phase 21: IMPACT FEEDBACK — the same damage delta the
        // drift feed reads also drives feel: a camera impulse scaled
        // by the hit (capped at 0.5, gated by the shake setting, and
        // skipped at Low quality) plus a dull thud for the step's own
        // knocks (the wall branch above already played its crash). ----
        const impactDmg = car.damage - dmgBefore;
        if (impactDmg >= 2) {
          if (G.settings.shake && tier() !== "low") G.shakeAmp = Math.min(0.5, Math.max(G.shakeAmp, 0.1 + impactDmg * 0.022));
          if (impactDmg >= 3 && !wallCrashStep) sfx.thud();
        }
      }
      if (!isBike) G.bikePedalling = false;
      car.state = next;
      // fuel drain while actually moving (the bike's tank is small: % drains faster)
      if (!isBike && !isBoat && Math.abs(next.speed) > 0.5 && car.fuel > 0) car.fuel = Math.max(0, car.fuel - dt * (0.1 + Math.abs(next.speed) * 0.018) * (car.kind === "motorcycle" ? 1.7 : 1));
      // ---- refuel: parked at a pump, tank fills for cash ----
      let atPump = false;
      if (!isBike && !isBoat && Math.abs(next.speed) < 1.2 && car.fuel < 99.5) {
        for (const st of FUEL_STATIONS) {
          if ((st.x - next.x) ** 2 + (st.z - next.z) ** 2 < 8 ** 2) { atPump = true; break; }
        }
      }
      if (atPump) {
        refuelTimer.current += dt;
        if (refuelTimer.current > 0.8) {
          const missing = 100 - car.fuel;
          const cost = Math.ceil(missing * 0.6);
          const pay = Math.min(G.cash, cost);
          car.fuel = pay >= cost ? 100 : car.fuel + pay / 0.6;
          G.cash -= pay; sfx.fuel(); toast(pay > 0 ? `Refuelled — $${pay} at the pump` : "No cash for fuel!");
          refuelTimer.current = 0;
        }
      } else refuelTimer.current = 0;
      vehicleStateRef.current = next;
      const gy = groundYAt(next.x, next.z);
      // ---- Phase 21: LANDING — track ledge drops for the driven
      // car (presentation only: the sim still ground-snaps and
      // step_vehicle_v3 is untouched). A single-step ground drop
      // bigger than any ramp or kerb in the city (> 0.6u — a deck
      // edge, a quayside lip) at speed starts a visual fall: the
      // mesh hangs at the old height (fall.y in the mesh sync) and
      // the frame loop drops it with gravity; the touchdown effects
      // live there. Boats, bikes and the plane are excluded (the
      // plane has its own hard-landing rule). ----
      if (!isBike && !isBoat && !isPlane) {
        const f = fall.current;
        if (f.carId !== car.id) { f.carId = car.id; f.y = 0; f.vy = 0; f.t = 0; f.prevY = gy; }
        const drop = f.prevY - gy;
        if (f.y <= 0 && drop > 0.6 && Math.abs(next.speed) > 4) { f.y = drop; f.vy = 0; f.t = 0; }
        f.prevY = gy;
      }
      // Phase 9: the camera + follow point ride the plane's altitude
      const altY = isPlane ? planeState(car.id).alt : 0;
      vehiclePositionRef.current.set(next.x, gy + altY, next.z);
      G.followPos.set(next.x, gy + altY, next.z);
      G.speedKph = Math.round(Math.abs(next.speed) * 3.6);
    }
    // Phase 12 fixed-step driver (60 Hz, max 3 substeps, debt dropped)
    if (G.driving && !paused && !G.dialogueActive && G.activeCarId >= 0 && G.enterAnimT <= 0) {
      driveAcc.current = Math.min(driveAcc.current + delta, SIM_STEP * SIM_MAX_SUBSTEPS);
      let nSteps = 0;
      while (driveAcc.current >= SIM_STEP && nSteps < SIM_MAX_SUBSTEPS) {
        driveAcc.current -= SIM_STEP; nSteps += 1;
        stepDrive(SIM_STEP);
      }
      if (nSteps === SIM_MAX_SUBSTEPS) driveAcc.current = 0;
    } else { driveAcc.current = 0; if (!G.driving) { G.speedKph = 0; G.stallWarn = false; } }
    // ---- Phase 4: break-in hold progress (E held near a locked car) ----
    if (breakIn.current && !paused) {
      if (!eHeld.current) { breakIn.current = null; G.hold = null; }
      else {
        const progress = (performance.now() - breakIn.current.since) / 1500;
        G.hold = { label: "Breaking in…", progress: Math.min(1, progress) };
        if (progress >= 1) { completeBreakIn(breakIn.current.car); breakIn.current = null; G.hold = null; }
      }
    }
    // ---- car alarms: beep + light-flash sprite while active ----
    alarmBeep.current = Math.max(0, alarmBeep.current - dt);
    G.cars.forEach((c, i) => {
      const sp = alarmRefs.current[i]; if (!sp) return;
      const until = carAlarms.get(i) ?? 0;
      const active = until > G.timeS;
      sp.visible = active;
      if (active) {
        const pulse = 0.6 + Math.abs(Math.sin(G.timeS * 9)) * 0.9;
        sp.scale.set(pulse * 2.2, pulse * 2.2, 1);
        if (alarmBeep.current <= 0 && (c.state.x - G.followPos.x) ** 2 + (c.state.z - G.followPos.z) ** 2 < 45 ** 2) { sfx.alarm(); alarmBeep.current = 0.9; }
      }
    });
    // ---- burnout / drift tyre smoke ----
    skidCd.current = Math.max(0, skidCd.current - dt);
    if (G.driving && !paused && G.activeCarId >= 0) {
      const car = G.cars[G.activeCarId];
      const k = keys.current;
      // Phase 41 audit: mirror the drift feed's wheelie exclusion —
      // a held wheelie is not a drift, so it must not smoke or squeal
      // like one (the wheelie state lives in stepDrive's ref).
      const wheelieUp = car.kind === "motorcycle" && (wheelieSt.current.amt > 0.02 || wheelieSt.current.downT > 0);
      const drifting = k.has(" ") && !wheelieUp && Math.abs(car.state.speed) > 6;
      const burnout = k.has("w") && Math.abs(car.state.speed) < 3 && car.damage < 100 && car.fuel > 0;
      // Phase 10: C++ wheelspin (throttle overcame the surface grip)
      // smokes too — and off asphalt it throws DUST, not tyre smoke
      const spinning = slipNow.current.slip > 0.3 && Math.abs(car.state.speed) < 9 && car.damage < 100;
      if (drifting || burnout || spinning) {
        spawnAcc.current += dt;
        if (skidCd.current <= 0) { sfx.skid(); skidCd.current = 0.55; }
        const puffColor = slipNow.current.kind === "dirt" || slipNow.current.kind === "grass" ? "#b08b5a"
          : slipNow.current.kind === "sand" ? "#d9c08a" : "#e8e6e0";
        while (spawnAcc.current > 0.045) {
          spawnAcc.current -= 0.045;
          const h = car.state.heading;
          const side = puffIdx.current % 2 === 0 ? -0.85 : 0.85;
          const puff = puffs.current[puffIdx.current % puffs.current.length];
          const sp = puffRefs.current[puffIdx.current % puffs.current.length];
          puffIdx.current += 1;
          if (sp) (sp.material as THREE.SpriteMaterial).color.set(puffColor);
          puff.life = 1;
          puff.x = car.state.x + Math.cos(h) * side - Math.sin(h) * 1.35;
          puff.z = car.state.z - Math.sin(h) * side - Math.cos(h) * 1.35;
          puff.y = 0.35;
        }
      }
    }
    puffs.current.forEach((puff, i) => {
      const sp = puffRefs.current[i]; if (!sp) return;
      if (puff.life <= 0) { sp.visible = false; return; }
      puff.life -= dt * 1.15;
      puff.y += dt * 1.1;
      sp.visible = puff.life > 0;
      sp.position.set(puff.x, puff.y, puff.z);
      const sc = 1.1 + (1 - puff.life) * 2.6;
      sp.scale.set(sc, sc, 1);
      (sp.material as THREE.SpriteMaterial).opacity = Math.max(0, puff.life) * 0.34;
    });
    // ---- Phase 6: wake foam fades + spreads behind the speedboat ----
    // Phase 28: a puff's spread and opacity scale with the `amp` it
    // was laid at (the laying boat's speed fraction).
    wakes.current.forEach((w, i) => {
      const sp = wakeRefs.current[i]; if (!sp) return;
      if (w.life <= 0) { sp.visible = false; return; }
      w.life -= dt * 0.6;
      sp.visible = w.life > 0;
      sp.position.set(w.x, 0.06, w.z);
      const sc = (1 + (1 - w.life) * 3.4) * (0.75 + 0.55 * w.amp);
      sp.scale.set(sc, sc * 0.5, 1);
      (sp.material as THREE.SpriteMaterial).opacity = Math.max(0, w.life) * 0.3 * (0.45 + 0.75 * w.amp);
    });
    // ---- Phase 21: the visual fall (see stepDrive) — integrate the
    // hang with gravity; on touchdown after > 0.35 s airborne, kick
    // the C++ body springs (suspension dip ~0.4 s), throw a dust
    // burst from the tyre-smoke pool and land a soft thud + a small
    // shake. Numbers are deliberately conservative. ----
    {
      const f = fall.current;
      if (!G.driving || G.activeCarId < 0) { f.y = 0; f.carId = -1; }
      else if (f.y > 0) {
        f.vy += 26 * dt; f.y -= f.vy * dt; f.t += dt;
        if (f.y <= 0) {
          f.y = 0;
          if (f.t > 0.35) {
            const car = G.cars[G.activeCarId];
            if (car) {
              car.bodyHeaveVel = (car.bodyHeaveVel ?? 0) - 2.4;
              car.pitchVel = (car.pitchVel ?? 0) + 0.7;
              const kind = surfaceKindAt(car.state.x, car.state.z);
              const dustColor = kind === "sand" ? "#d9c08a" : "#b08b5a";
              for (let n = 0; n < 6; n++) {
                const puff = puffs.current[puffIdx.current % puffs.current.length];
                const sp = puffRefs.current[puffIdx.current % puffs.current.length];
                puffIdx.current += 1;
                if (sp) (sp.material as THREE.SpriteMaterial).color.set(dustColor);
                puff.life = 1;
                puff.x = car.state.x + (Math.random() - 0.5) * 2.4;
                puff.z = car.state.z + (Math.random() - 0.5) * 2.4;
                puff.y = 0.35;
              }
              sfx.thud();
              if (G.settings.shake && tier() !== "low") G.shakeAmp = Math.min(0.5, Math.max(G.shakeAmp, 0.16));
            }
          }
        }
      }
    }
    // ---- engine smoke for damaged cars (damage > 60) ----
    const tt = clock.elapsedTime;
    G.cars.forEach((c, i) => {
      const sm = smokeRefs.current[i]; if (!sm) return;
      const show = c.damage > 60;
      sm.visible = show;
      if (show) {
        const s = 0.8 + Math.sin(tt * 3.1 + i * 1.7) * 0.22 + (c.damage - 60) / 90;
        sm.scale.setScalar(s);
        sm.position.y = 1.05 + Math.sin(tt * 2.3 + i) * 0.12;
        sm.children.forEach((ch, ci) => { const m = (ch as THREE.Mesh).material as THREE.MeshBasicMaterial; m.opacity = 0.16 + (c.damage - 60) / 160 + ci * 0.03; });
      }
    });
    // near-car prompt
    if (!G.driving) {
      const pl = refs.current.playerPositionRef.current;
      const near = G.cars.some((c) => (c.state.x - pl.x) ** 2 + (c.state.z - pl.z) ** 2 <= (c.kind === "boat" || c.kind === "skiff" ? 5.4 : c.kind === "plane" ? 4.6 : 3.6) ** 2);
      if (near !== nearRef.current) { nearRef.current = near; refs.current.onNearVehicleChange(near); }
    } else if (nearRef.current) { nearRef.current = false; refs.current.onNearVehicleChange(false); }
    // Phase 40: BIKE_POSE belongs to the DRIVEN bike alone — when
    // the driven vehicle isn't that bike (or nothing is driven),
    // the pose is zeroed and the state machines reset here, so the
    // rider rig can never inherit a stale lean, wheelie or hop
    // from the last bike ridden.
    const drivenKind = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId].kind : "";
    if (drivenKind !== "motorcycle") { const ws = wheelieSt.current; ws.amt = 0; ws.disp = 0; ws.overT = 0; ws.downT = 0; BIKE_POSE.wheelie = 0; }
    if (drivenKind !== "bicycle") { hopSt.current.t = -1; hopSt.current.prevSpace = keys.current.has(" ") || padKeys.has(" "); BIKE_POSE.hopY = 0; }
    if (drivenKind !== "motorcycle" && drivenKind !== "bicycle") BIKE_POSE.lean = 0;
    G.cars.forEach((c, i) => {
      const g = groups.current[i]; if (!g) return;
      if (c.kind === "boat" || c.kind === "skiff") {
        // buoyancy from the Harborfall Core (boat_buoyancy): bob +
        // pitch/roll from the wave phase, calming as the boat planes;
        // the swell still scales with the wind gust value (Phase 7);
        // the little skiff rides lower and bobs gentler.
        // Phase 36: WEATHER CHOP — rain raises the sea state and a
        // storm raises it further: the same swell multiplier grows
        // by up to ~×2.2 in a full storm, so the bob amplitude and
        // the pitch/roll the hull rides visibly worsen with the
        // weather (the Phase 28 storm DRIFT on the hull's position
        // is separate and untouched).
        const chop = 1 + G.rainAmt * 0.85 + (G.weather === "Storm" ? 0.35 : 0);
        const swell = (0.7 + G.wind * 0.7) * (c.kind === "skiff" ? 0.7 : 1) * chop;
        const b = physicsRef.current.boatBuoyancy(tt * 1.25 + i * 1.7, c.state.speed, 0.07 * swell);
        // Phase 28: BOW RISE — under way, the bow lifts as the hull
        // climbs toward planing and settles back as way comes off.
        // Presentation only (an eased pitch offset on the mesh): it
        // rises slower than it settles, like a real hull porpoising
        // onto the step. The buoyancy pitch above already calms
        // with speed; this adds the throttle's own signature.
        const top = c.kind === "skiff" ? 9.5 : 14.5;
        const bowTarget = c.state.speed > 0.4 ? THREE.MathUtils.clamp(c.state.speed / top, 0, 1) * 0.055 : 0;
        const bowPrev = boatBow.current.get(c.id) ?? 0;
        const bowRate = bowTarget > bowPrev ? 0.9 : 0.55; // rise vs settle (per second)
        const bow = bowPrev + (bowTarget - bowPrev) * Math.min(1, dt * bowRate * 2.2);
        boatBow.current.set(c.id, bow);
        g.position.set(c.state.x, -0.08 + b.bob, c.state.z);
        g.rotation.order = "YXZ";
        g.rotation.set(b.pitch * swell - bow, c.state.heading, b.roll * swell);
        return;
      }
      if (c.kind === "plane") {
        // Phase 9: altitude + flight pose (pitch/roll damped in the
        // flight branch); parked, it sits on its gear on the apron
        const alt = planeAlt.current.get(c.id)?.alt ?? 0;
        // Phase 28: landing-gear compression — the airframe settles
        // onto its struts for a beat after touchdown (set in the
        // flight branch, decayed here at ~2.2/s).
        const sq = planeSquash.current.get(c.id) ?? 0;
        if (sq > 0.003) planeSquash.current.set(c.id, sq * Math.max(0, 1 - dt * 2.2));
        else if (sq !== 0) planeSquash.current.set(c.id, 0);
        g.position.set(c.state.x, groundYAt(c.state.x, c.state.z) + alt - sq * 0.13, c.state.z);
        g.rotation.order = "YXZ";
        // Phase 36: STORM TURBULENCE — airborne in a storm (and, at
        // half strength, in heavy rain), the airframe is worried by
        // two slow sine disturbances on the PRESENTATION pose only.
        // car.pitch / car.roll (the flight state the physics and the
        // Sparrow Run's ring gates read) are never touched, so the
        // Run's 120 s par is exactly as reachable as in calm air —
        // the storm makes the Sparrow LOOK and feel unsettled, it
        // does not move its path. Amplitudes are small (±~0.05 rad
        // roll, ±~0.03 rad pitch in a full storm).
        const turb = alt > 2 ? (G.weather === "Storm" ? 1 : G.rainAmt >= 0.55 ? 0.5 : 0) : 0;
        const turbRoll = turb * (Math.sin(tt * 1.7 + c.id * 2.1) * 0.032 + Math.sin(tt * 2.9 + c.id) * 0.018);
        const turbPitch = turb * Math.sin(tt * 1.15 + c.id * 1.3) * 0.026;
        g.rotation.set(c.pitch + turbPitch, c.state.heading, c.roll + turbRoll);
        return;
      }
      g.position.set(c.state.x, groundYAt(c.state.x, c.state.z) + (c.bodyHeave ?? 0) + (G.driving && G.activeCarId === i ? fall.current.y : 0), c.state.z); // Phase 21: + the visual fall hang for the driven car
      if (c.kind === "motorcycle") {
        // bank into turns ∝ steering × speed; wheelie-lite pitch on launch
        const active = G.driving && G.activeCarId === i && !paused;
        const steer = active ? steerRef.current : 0;
        const sf = THREE.MathUtils.clamp(Math.abs(c.state.speed) / 22, 0, 1);
        const lean = -steer * sf * 0.48;
        const launching = active && keys.current.has("w") && c.state.speed > 0.5 && c.state.speed < 7;
        // Phase 40: the held WHEELIE (stepDrive's state machine,
        // disp includes the loop-out overshoot) supersedes the
        // launch pitch while it's up; the launch flavour stays for
        // plain W launches. The rider rig reads the same lean +
        // wheelie via BIKE_POSE, so rider and machine move as one.
        const wAmt = active ? wheelieSt.current.disp : 0;
        g.rotation.order = "YXZ";
        g.rotation.set(-(wAmt * 0.62) - (launching && wAmt <= 0 ? 0.1 : 0), c.state.heading, lean);
        if (active) { BIKE_POSE.lean = lean; BIKE_POSE.wheelie = wAmt; }
      } else if (c.kind === "bicycle") {
        // Phase 40: the bicycle gets the lean it never had — it
        // used to fall into the generic branch below, whose
        // c.pitch/c.roll are never written by the bicycle's own
        // step, so it cornered bolt-upright. Gentler than the
        // motorcycle's (0.34 vs 0.48, normalised by its 7.6 u/s
        // pedal top speed), plus the bunny hop's presentation
        // lift on the group height.
        const active = G.driving && G.activeCarId === i && !paused;
        const steer = active ? steerRef.current : 0;
        const sf = THREE.MathUtils.clamp(Math.abs(c.state.speed) / 7.6, 0, 1);
        const lean = -steer * sf * 0.34;
        g.position.y += active ? BIKE_POSE.hopY : 0;
        g.rotation.order = "YXZ";
        g.rotation.set(0, c.state.heading, lean);
        if (active) BIKE_POSE.lean = lean;
      } else {
        // suspension: weight-transfer pitch/roll from the C++ v2 step
        g.rotation.order = "YXZ";
        g.rotation.set(c.pitch, c.state.heading, c.roll);
        // spiked tyre: visible wobble while rolling (A5)
        if (c.flatTyre && Math.abs(c.state.speed) > 1) {
          g.rotation.z += Math.sin(tt * 22 + i) * 0.02;
          g.rotation.x += Math.sin(tt * 17 + i * 2) * 0.012;
        }
      }
    });
  });

  return (
    <>
      {G.cars.map((c, i) => {
        const isActive = G.activeCarId === i;
        if (!suspRefs.current[i]) suspRefs.current[i] = { current: new Float32Array([0.45, 0.45, 0.45, 0.45]) };
        return (
          <group key={c.id} ref={(n) => { groups.current[i] = n; }} position={[c.state.x, 0, c.state.z]} rotation={[0, c.state.heading, 0]}>
            <LiveCarBody index={i} steerRef={steerRef} brakeRef={brakeRef} suspRef={suspRefs.current[i]} />
            {/* car-alarm flash (break-in alarms, Phase 4) */}
            <sprite ref={(n) => { alarmRefs.current[i] = n; }} position={[0, 1.5, 0]} visible={false}>
              <spriteMaterial map={puffTex} color="#ffd34d" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
            </sprite>
            {/* engine smoke (visible when damage > 60, animated in useFrame) */}
            <group ref={(n) => { smokeRefs.current[i] = n; }} position={[0, 1.05, 1.25]} visible={false}>
              {[0, 1, 2].map((j) => (
                <mesh key={j} position={[j * 0.16 - 0.16, j * 0.34, j * 0.1]}>
                  <sphereGeometry args={[0.3 + j * 0.13, 8, 6]} />
                  <meshBasicMaterial color="#3a3f45" transparent opacity={0.2} depthWrite={false} />
                </mesh>
              ))}
            </group>
            {isActive && <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.2, 2.45, 24]} /><meshBasicMaterial color={p.themeAccent} transparent opacity={0.85} /></mesh>}
          </group>
        );
      })}
      {/* burnout / drift tyre-smoke puffs (world-space sprite pool) */}
      {puffs.current.map((_, i) => (
        <sprite key={i} ref={(n) => { puffRefs.current[i] = n; }} visible={false}>
          <spriteMaterial map={puffTex} color="#e8e6e0" transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
      {/* speedboat wake foam (world-space sprite pool, Phase 6) */}
      {wakes.current.map((_, i) => (
        <sprite key={`w${i}`} ref={(n) => { wakeRefs.current[i] = n; }} visible={false}>
          <spriteMaterial map={puffTex} color="#eaf6f8" transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
    </>
  );
}
