import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PhysicsEngine } from "../physics/GamePhysics";
import { isInteractiveTarget, normalizeGameKey } from "../keyboard";
import { isBlocked, FUEL_STATIONS, groundYAt, isWaterAt, BRIDGE } from "../world";
import { G, addCrime, toast } from "../game/store";
import { glowTexture } from "../textures";
import { sfx } from "../game/audio";
import { gyroSteer } from "../game/gyro";
import { completeBreakIn, carAlarms } from "../game/theft";

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
function LiveCarBody({ index, steerRef, brakeRef }: { index: number; steerRef: MutableRefObject<number>; brakeRef: MutableRefObject<boolean> }) {
  const [, setTick] = useState(0);
  const last = useRef(`${G.cars[index].brokenWindow}|${G.cars[index].color}`);
  useFrame(() => {
    // re-render on window smash AND on respray (Phase 6 mods change colour)
    const sig = `${G.cars[index].brokenWindow}|${G.cars[index].color}`;
    if (sig !== last.current) { last.current = sig; setTick((t) => t + 1); }
  });
  const c = G.cars[index];
  return <CarBody kind={c.kind} color={c.color} carIndex={index} steerRef={steerRef} liveDamage={() => G.cars[index].damage} brokenWindow={c.brokenWindow} interior brakeRef={brakeRef} spotLights />;
}

export default function Vehicle(p: Props) {
  const groups = useRef<Array<THREE.Group | null>>([]);
  const smokeRefs = useRef<Array<THREE.Group | null>>([]);
  const keys = useRef(new Set<string>());
  const refs = useRef(p); refs.current = p;
  const nearRef = useRef(false);
  const wasBlocked = useRef(false);
  const refuelTimer = useRef(0);
  const warnedRef = useRef({ wrecked: false, empty: false });
  // ---- burnout / drift tyre-smoke pool (white sprite puffs, rear wheels) ----
  const puffRefs = useRef<Array<THREE.Sprite | null>>([]);
  const puffs = useRef<Array<{ life: number; x: number; y: number; z: number }>>(
    Array.from({ length: 22 }, () => ({ life: 0, x: 0, y: -10, z: 0 })));
  const puffIdx = useRef(0);
  const spawnAcc = useRef(0);
  // ---- Phase 6: speedboat wake foam pool (flat sprites on the water) ----
  const wakeRefs = useRef<Array<THREE.Sprite | null>>([]);
  const wakes = useRef<Array<{ life: number; x: number; z: number }>>(
    Array.from({ length: 16 }, () => ({ life: 0, x: 0, z: 0 })));
  const wakeIdx = useRef(0);
  const wakeAcc = useRef(0);
  const skidCd = useRef(0);
  const puffTex = glowTexture();
  // Phase 4: shared steering ref (front wheels + cabin wheel), break-in hold
  const steerRef = useRef(0);
  const brakeRef = useRef(false); // Phase 5: brake-light boost state
  const alarmRefs = useRef<Array<THREE.Sprite | null>>([]);
  const eHeld = useRef(false);
  const breakIn = useRef<{ car: number; since: number } | null>(null);
  const alarmBeep = useRef(0);

  useEffect(() => {
    const enterCar = (best: number) => {
      G.activeCarId = best; G.driving = true; refs.current.onDrivingChange(true); sfx.door();
      warnedRef.current = { wrecked: false, empty: false };
      if (G.cars[best].damage >= 100) toast("This car is wrecked — it won't move. Find another ride.");
      else if (G.cars[best].fuel <= 0.5) toast("This car is out of fuel. A fuel station can fill it — if you can push it there… (find another car)");
      if (!G.cars[best].owned && !G.cars[best].stolen) { G.cars[best].stolen = true; addCrime("steal"); sfx.crime(); }
    };
    const nearestCar = (): number => {
      const pl = refs.current.playerPositionRef.current;
      let best = -1; let bestD = 0;
      G.cars.forEach((c, i) => {
        // the speedboat is boarded from the pier edge / while swimming —
        // it gets a longer reach than a kerbside car door
        const reach = c.kind === "boat" ? 5.4 : 3.6;
        const d = (c.state.x - pl.x) ** 2 + (c.state.z - pl.z) ** 2;
        if (d < reach ** 2 && (best < 0 || d < bestD)) { bestD = d; best = i; }
      });
      return best;
    };
    const breakInEligible = (i: number) => {
      const c = G.cars[i];
      return !!c && !c.owned && !c.stolen && !c.brokenWindow && c.kind !== "motorcycle";
    };
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
        const best = nearestCar();
        if (best >= 0) {
          // Phase 4: HOLD E on a locked, unowned car = break-in; a quick
          // TAP still just gets in (existing steal flow). F always enters.
          if (key === "e" && breakInEligible(best)) {
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
      if (key === "e") {
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
    if (G.driving && !paused && !G.dialogueActive && G.activeCarId >= 0 && G.enterAnimT <= 0) {
      const car = G.cars[G.activeCarId];
      const k = keys.current;
      const isBike = car.kind === "bicycle";
      const isBoat = car.kind === "boat";
      // ---- Phase 2: damage + fuel shape the driving (arcade-forgiving) ----
      const wrecked = !isBike && !isBoat && car.damage >= 100;
      const empty = !isBike && !isBoat && car.fuel <= 0;
      if (wrecked && !warnedRef.current.wrecked) { warnedRef.current.wrecked = true; toast("WRECKED — this car is done. Get out (E) and find another ride."); }
      if (empty && !warnedRef.current.empty) { warnedRef.current.empty = true; toast("Out of fuel! Coast to a stop and find another car — fuel stations refill runners."); }
      const power = wrecked || empty ? 0 : car.damage > 60 ? 0.55 : car.damage > 35 ? 0.82 : 1;
      const throttle = (Number(k.has("w")) - Number(k.has("s"))) * power;
      brakeRef.current = k.has("s") || k.has(" ");
      // gyro tilt steering feeds the same path; touch/key steer overrides
      const keySteer = Number(k.has("a")) - Number(k.has("d"));
      const steering = keySteer !== 0 ? keySteer : gyroSteer();
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
      } else if (isBoat) {
        // ---- Phase 6 speedboat: water-only drive, buoyancy in the render
        // loop below. Beaching (bow touches land) stops the boat dead;
        // reverse backs it off the shore. ----
        if (throttle > 0) next.speed = Math.min(14.5, next.speed + 4.6 * dt);
        else if (throttle < 0) next.speed = Math.max(-4.5, next.speed - 3.6 * dt);
        next.speed -= next.speed * 0.45 * dt; // water drag
        if (Math.abs(next.speed) < 0.03 && throttle === 0) next.speed = 0;
        next.heading += steering * 0.55 * dt * THREE.MathUtils.clamp(Math.abs(next.speed) / 6, 0.2, 1) * (next.speed < 0 ? -1 : 1);
        next.x += Math.sin(next.heading) * next.speed * dt;
        next.z += Math.cos(next.heading) * next.speed * dt;
        if (!isWaterAt(next.x, next.z)) {
          if (next.speed > 0) { next.x = car.state.x; next.z = car.state.z; next.speed = 0; if (!wasBlocked.current) toast("Beached! Reverse (S) to back off the shore."); wasBlocked.current = true; }
          else { next.x = car.state.x; next.z = car.state.z; next.speed = Math.min(0, next.speed); }
        } else wasBlocked.current = false;
        // wake foam spawns behind a moving boat (pool below)
        if (Math.abs(next.speed) > 3) {
          wakeAcc.current += dt;
          while (wakeAcc.current > 0.07) {
            wakeAcc.current -= 0.07;
            const w = wakes.current[wakeIdx.current % wakes.current.length];
            wakeIdx.current += 1;
            w.life = 1;
            w.x = next.x - Math.sin(next.heading) * 2.4 + (Math.random() - 0.5) * 0.8;
            w.z = next.z - Math.cos(next.heading) * 2.4 + (Math.random() - 0.5) * 0.8;
          }
        }
      } else {
        const stepped = physicsRef.current.stepVehicleV2(car.state, throttle, steering, k.has(" "), delta);
        next = stepped.state;
        // Phase 6 (B5): suspension spring/damper (C++ v3) smooths the
        // weight transfer instead of the old direct lerp.
        const sr = physicsRef.current.suspensionResponse((next.speed - prevSpeed) / Math.max(dt, 0.001), steering, next.speed,
          { pitch: car.pitch, roll: car.roll, pitchVel: car.pitchVel ?? 0, rollVel: car.rollVel ?? 0 }, dt);
        car.pitch = sr.pitch; car.roll = sr.roll; car.pitchVel = sr.pitchVel; car.rollVel = sr.rollVel;
        // ---- Phase 3: motorcycle character — harder launch, higher top end,
        // tighter turning (heading bias applied post-step, arcade style) ----
        if (car.kind === "motorcycle") {
          if (throttle > 0 && !wrecked && !empty) next.speed = Math.min(29, next.speed + 7.5 * dt * throttle);
          const sf = THREE.MathUtils.clamp(Math.abs(next.speed) / 4, 0.18, 1);
          next.heading += steering * 2.0 * sf * dt * (next.speed < 0 ? -1 : 1);
        }
        // ---- Phase 6: bus is heavy — capped low, whatever the tune ----
        if (car.kind === "bus") next.speed = THREE.MathUtils.clamp(next.speed, -6, 13.5);
        // ---- Phase 6 (B1): Lina's mods — engine tune raises the top end,
        // brake upgrade bites harder; Driving skill ≥50 trims drift slide ----
        const tune = car.tuneLvl ?? 0;
        if (tune > 0 && throttle > 0 && next.speed > 8) next.speed = Math.min(next.speed + tune * 1.7 * dt, 24 + tune * 1.8);
        if ((car.brakeLvl ?? 0) > 0 && k.has("s") && next.speed > 0) next.speed = Math.max(0, next.speed - 9 * dt);
        if (k.has(" ") && G.skills.driving >= 50) next.heading = prevHeading + (next.heading - prevHeading) * 0.9;
        // ---- Phase 6 (A5): a spiked tyre pulls, wobbles and caps speed ----
        if (car.flatTyre) {
          next.speed = THREE.MathUtils.clamp(next.speed, -8.5, 8.5);
          next.heading += (Math.sin(G.timeS * 5.7) * 0.1 + 0.045) * dt * Math.min(1, Math.abs(next.speed) / 6);
        }
        next.x = THREE.MathUtils.clamp(next.x, -130, 130);
        next.z = THREE.MathUtils.clamp(next.z, -302, 330);
        // bridge causeway: stay on the deck corridor while elevated
        // (south bridge only — the Northgate parking deck is also elevated)
        if (next.z > 80 && (groundYAt(next.x, next.z) > 0.05 || groundYAt(car.state.x, car.state.z) > 0.05)) {
          next.x = THREE.MathUtils.clamp(next.x, BRIDGE.x - BRIDGE.halfW + 0.6, BRIDGE.x + BRIDGE.halfW - 0.6);
        }
        const hitsWater = isWaterAt(next.x, next.z) && groundYAt(next.x, next.z) <= 0.05;
        if (hitsWater || isBlocked(next.x, next.z, 1.3)) {
          if (!wasBlocked.current && Math.abs(car.state.speed) > 6) {
            G.eventQueue.push("shake", "hitwall"); G.health = Math.max(0, G.health - 4);
            car.damage = Math.min(100, car.damage + Math.min(18, Math.abs(car.state.speed) * 0.9));
            sfx.crash();
          }
          wasBlocked.current = true;
          next.x = car.state.x; next.z = car.state.z; next.speed = -car.state.speed * 0.25;
        } else wasBlocked.current = false;
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
      vehiclePositionRef.current.set(next.x, gy, next.z);
      G.followPos.set(next.x, gy, next.z);
      G.speedKph = Math.round(Math.abs(next.speed) * 3.6);
    } else if (!G.driving) G.speedKph = 0;
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
      const drifting = k.has(" ") && Math.abs(car.state.speed) > 6;
      const burnout = k.has("w") && Math.abs(car.state.speed) < 3 && car.damage < 100 && car.fuel > 0;
      if (drifting || burnout) {
        spawnAcc.current += dt;
        if (skidCd.current <= 0) { sfx.skid(); skidCd.current = 0.55; }
        while (spawnAcc.current > 0.045) {
          spawnAcc.current -= 0.045;
          const h = car.state.heading;
          const side = puffIdx.current % 2 === 0 ? -0.85 : 0.85;
          const puff = puffs.current[puffIdx.current % puffs.current.length];
          puffIdx.current += 1;
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
    wakes.current.forEach((w, i) => {
      const sp = wakeRefs.current[i]; if (!sp) return;
      if (w.life <= 0) { sp.visible = false; return; }
      w.life -= dt * 0.6;
      sp.visible = w.life > 0;
      sp.position.set(w.x, 0.06, w.z);
      const sc = 1 + (1 - w.life) * 3.4;
      sp.scale.set(sc, sc * 0.5, 1);
      (sp.material as THREE.SpriteMaterial).opacity = Math.max(0, w.life) * 0.3;
    });
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
      const near = G.cars.some((c) => (c.state.x - pl.x) ** 2 + (c.state.z - pl.z) ** 2 <= (c.kind === "boat" ? 5.4 : 3.6) ** 2);
      if (near !== nearRef.current) { nearRef.current = near; refs.current.onNearVehicleChange(near); }
    } else if (nearRef.current) { nearRef.current = false; refs.current.onNearVehicleChange(false); }
    G.cars.forEach((c, i) => {
      const g = groups.current[i]; if (!g) return;
      if (c.kind === "boat") {
        // buoyancy: gentle bob + pitch/roll swell on the waterline —
        // Phase 7: the swell scales with the wind gust value
        const swell = 0.7 + G.wind * 0.7;
        g.position.set(c.state.x, -0.08 + Math.sin(tt * 1.25 + i * 1.7) * 0.07 * swell, c.state.z);
        g.rotation.order = "YXZ";
        g.rotation.set(Math.sin(tt * 0.9 + i) * 0.02 * swell + (c.state.speed > 6 ? -0.03 : 0), c.state.heading, Math.sin(tt * 1.1 + i * 2.3) * 0.025 * swell);
        return;
      }
      g.position.set(c.state.x, groundYAt(c.state.x, c.state.z), c.state.z);
      if (c.kind === "motorcycle") {
        // bank into turns ∝ steering × speed; wheelie-lite pitch on launch
        const active = G.driving && G.activeCarId === i && !paused;
        const steer = active ? steerRef.current : 0;
        const sf = THREE.MathUtils.clamp(Math.abs(c.state.speed) / 22, 0, 1);
        const lean = -steer * sf * 0.48;
        const launching = active && keys.current.has("w") && c.state.speed > 0.5 && c.state.speed < 7;
        g.rotation.order = "YXZ";
        g.rotation.set(launching ? -0.1 : 0, c.state.heading, lean);
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
        return (
          <group key={c.id} ref={(n) => { groups.current[i] = n; }} position={[c.state.x, 0, c.state.z]} rotation={[0, c.state.heading, 0]}>
            <LiveCarBody index={i} steerRef={steerRef} brakeRef={brakeRef} />
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
