import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { G, addCrime, resetAfterArrest, resetAfterWasted } from "../game/store";
import { M, currentTarget, endMission, persist } from "../game/missionState";
import { ROAD_COORDS, isBlocked } from "../world";
import { fallbackPhysics, type PhysicsEngine } from "../physics/GamePhysics";
import type { GameTheme } from "../themes";
import { sfx } from "../game/audio";

export interface SysCallbacks {
  dialogue: (lines: { who: string; text: string }[], after: () => void) => void;
  popup: (text: string) => void;
  banner: (text: string, ok: boolean) => void;
  storyFinished: () => void;
  event: (name: string) => void;
}
const TRAFFIC_COLORS = ["#e2574c", "#3d8bfd", "#f2b134", "#39b56a", "#e8e8e8", "#7a4fd0", "#ff7f50", "#2ec4b6", "#c0c6cc", "#8a5a2b", "#4a6b8a", "#d6336c"];
const PED_COLORS = ["#e2574c", "#f2b134", "#39b56a", "#3d8bfd", "#ff7f50", "#2ec4b6", "#e8e8e8", "#946b2d"];
const rndRoad = () => ROAD_COORDS[Math.floor(Math.random() * ROAD_COORDS.length)];
const headingFor = (axis: "x" | "z", dir: number) => (axis === "x" ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI);

function initWorld() {
  if (G.traffic.length === 0) {
    for (let i = 0; i < 12; i++) {
      const axis = i % 2 === 0 ? "x" : "z"; const dir = (i % 4 < 2 ? 1 : -1) as 1 | -1;
      const fixed = rndRoad(); const along = -100 + (i * 37) % 200;
      const lane = dir > 0 ? 2.8 : -2.8;
      G.traffic.push({
        x: axis === "x" ? along : fixed + lane, z: axis === "x" ? fixed + lane : along,
        heading: headingFor(axis, dir), speed: 8, axis, dir, lane, color: TRAFFIC_COLORS[i], stopped: 0, fleeing: 0,
      });
    }
  }
  if (G.peds.length === 0) {
    for (let i = 0; i < 14; i++) {
      const axis = i % 2 === 0 ? "x" : "z"; const dir = (i % 3 === 0 ? -1 : 1) as 1 | -1;
      const fixed = rndRoad(); const along = -105 + (i * 29) % 210; const side = i % 2 === 0 ? 7.6 : -7.6;
      G.peds.push({
        x: axis === "x" ? along : fixed + side, z: axis === "x" ? fixed + side : along,
        heading: headingFor(axis, dir), speed: 0, axis, dir, side, color: PED_COLORS[i % PED_COLORS.length], fleeUntil: 0, swing: Math.random() * 6,
      });
    }
  }
  if (G.cops.length === 0) for (let i = 0; i < 6; i++) G.cops.push({ x: 0, z: -140, heading: 0, speed: 0, active: false, lightPhase: i * 0.7 });
}

export default function GameSystems({ paused, physicsRef, theme, cb, tokenCountRef }: {
  paused: boolean; physicsRef: MutableRefObject<PhysicsEngine>; theme: GameTheme;
  cb: MutableRefObject<SysCallbacks>; tokenCountRef: MutableRefObject<number>;
}) {
  initWorld();
  const trafficRefs = useRef<Array<THREE.Group | null>>([]);
  const pedRefs = useRef<Array<THREE.Group | null>>([]);
  const pedArms = useRef<Array<[THREE.Group | null, THREE.Group | null]>>([]);
  const copRefs = useRef<Array<THREE.Group | null>>([]);
  const copLights = useRef<Array<[THREE.Mesh | null, THREE.Mesh | null]>>([]);
  const beam = useRef<THREE.Group>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const scene = useThree((s) => s.scene);
  const hitCooldown = useRef(0);
  const bg = useMemo(() => new THREE.Color(theme.sky), [theme.sky]);
  const fogC = useMemo(() => new THREE.Color(theme.fog), [theme.fog]);

  useEffect(() => {
    scene.background = bg;
    scene.fog = new THREE.Fog(fogC.getHex(), theme.fogNear, theme.fogFar);
  }, [scene, bg, fogC, theme]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;
    // ---- day cycle (5-minute full cycle; L pauses/resumes it from App) ----
    if (!paused && !G.dayPaused) G.dayTime = (G.dayTime + dt / 300) % 1;
    const sunAng = G.dayTime * Math.PI * 2 - Math.PI / 2;
    const elev = Math.sin(sunAng);
    const night = THREE.MathUtils.clamp(-elev * 1.4 + 0.35, 0, 1);
    G.nightFactor = night;
    if (sun.current) {
      sun.current.position.set(Math.cos(sunAng) * 60, Math.max(8, elev * 70), 30);
      sun.current.intensity = theme.sunIntensity * THREE.MathUtils.clamp(elev + 0.45, 0.12, 1);
      sun.current.color.set(theme.sunColor);
    }
    if (amb.current) amb.current.intensity = theme.ambient * (1 - night * 0.45);
    if (hemi.current) hemi.current.intensity = 1.05 * (1 - night * 0.5);
    if (scene.background instanceof THREE.Color) scene.background.copy(bg).multiplyScalar(1 - night * 0.55);
    if (paused || G.dialogueActive || G.status) {
      // still render positions below? No: freeze gameplay while paused/dialogue/status.
      syncMeshes(t); return;
    }
    hitCooldown.current = Math.max(0, hitCooldown.current - dt);
    G.crimeCooldown = Math.max(0, G.crimeCooldown - dt);

    const px = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId].state.x : G.playerPos.x;
    const pz = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId].state.z : G.playerPos.z;
    const pSpeed = G.driving ? Math.abs(G.cars[G.activeCarId]?.state.speed ?? 0) : 0;

    // ---- traffic AI ----
    for (const car of G.traffic) {
      if (car.stopped > 0) { car.stopped -= dt; car.speed = Math.max(0, car.speed - 20 * dt); }
      else {
        // stop if player car is close ahead
        const dx = px - car.x, dz = pz - car.z;
        const ahead = car.axis === "x" ? Math.sign(dx) === car.dir && Math.abs(dz - (car.axis === "x" ? 0 : 0)) < 6 && Math.abs(dx) < 9
                                      : Math.sign(dz) === car.dir && Math.abs(dx) < 6 && Math.abs(dz) < 9;
        const target = ahead && G.driving ? 0 : car.fleeing > 0 ? 13 : 8.5;
        car.speed += THREE.MathUtils.clamp(target - car.speed, -14 * dt, 6 * dt);
      }
      if (car.fleeing > 0) car.fleeing -= dt;
      if (car.axis === "x") car.x += car.dir * car.speed * dt; else car.z += car.dir * car.speed * dt;
      // turn at intersections
      const cross = car.axis === "x" ? car.z : car.x;
      const nearRoad = ROAD_COORDS.find((c) => Math.abs(c - cross + (car.lane)) < 99 && Math.abs((car.axis === "x" ? car.x : car.z) - c) < 1.2);
      if (nearRoad !== undefined && Math.random() < 0.012) {
        const along = car.axis === "x" ? car.x : car.z;
        car.axis = car.axis === "x" ? "z" : "x";
        car.dir = (Math.random() > 0.5 ? 1 : -1) as 1 | -1;
        const fixed = nearRoad - car.lane + (car.dir > 0 ? 2.8 : -2.8);
        car.lane = car.dir > 0 ? 2.8 : -2.8;
        if (car.axis === "x") { car.z = fixed; car.x = along; } else { car.x = fixed; car.z = along; }
        car.heading = headingFor(car.axis, car.dir);
      }
      if (Math.abs(car.x) > 112 || Math.abs(car.z) > 112) { car.dir = (car.dir * -1) as 1 | -1; car.lane = car.dir > 0 ? 2.8 : -2.8; car.heading = headingFor(car.axis, car.dir); car.x = THREE.MathUtils.clamp(car.x, -110, 110); car.z = THREE.MathUtils.clamp(car.z, -110, 110); }
      car.heading = headingFor(car.axis, car.dir);
      // collision with player car
      if (G.driving && hitCooldown.current <= 0) {
        const d2 = (car.x - px) ** 2 + (car.z - pz) ** 2;
        if (d2 < 3.1 ** 2 && pSpeed > 3) {
          hitCooldown.current = 1.2; car.stopped = 2.5; car.fleeing = 3;
          addCrime("hit"); cb.current.event("shake"); cb.current.event("crime"); sfx.crime();
        }
      }
    }
    // ---- pedestrians ----
    for (const ped of G.peds) {
      const threatD2 = (ped.x - px) ** 2 + (ped.z - pz) ** 2;
      const flee = (G.driving && pSpeed > 5 && threatD2 < 15 ** 2) || (G.wanted > 0 && threatD2 < 10 ** 2);
      const ahead = 14;
      const tx = ped.axis === "x" ? ped.x + ped.dir * ahead : ped.x;
      const tz = ped.axis === "z" ? ped.z + ped.dir * ahead : ped.z;
      const next = (physicsRef.current ?? fallbackPhysics).stepPedestrian(ped, tx, tz, px, pz, flee, 1.6, dt);
      if (!isBlocked(next.x, next.z, 0.4)) { ped.x = next.x; ped.z = next.z; }
      ped.heading = next.heading; ped.speed = next.speed; ped.swing += dt * (2 + ped.speed * 2.4);
      if (Math.abs(ped.x) > 114 || Math.abs(ped.z) > 118) { ped.dir = (ped.dir * -1) as 1 | -1; }
      // hit by player car
      if (G.driving && hitCooldown.current <= 0 && threatD2 < 2.2 ** 2 && pSpeed > 4) {
        hitCooldown.current = 1.5; ped.fleeUntil = t + 4; addCrime("ped"); cb.current.event("shake"); sfx.crime();
        ped.x += Math.sin(ped.heading) * 2; // knocked aside (arcade, non-graphic)
      }
    }
    // ---- police / wanted ----
    const want = G.wanted;
    G.cops.forEach((cop, i) => {
      const should = i < Math.min(6, want + (want > 0 ? 1 : 0));
      if (should && !cop.active) {
        cop.active = true;
        const ang = (i * 2.4) + t;
        cop.x = THREE.MathUtils.clamp(px + Math.sin(ang) * 46, -108, 108);
        cop.z = THREE.MathUtils.clamp(pz + Math.cos(ang) * 46, -108, 112);
        cop.speed = 0;
      }
      if (!cop.active) return;
      if (want === 0) { cop.active = false; return; }
      const dx = px - cop.x, dz = pz - cop.z;
      const dist = Math.hypot(dx, dz);
      const desired = Math.atan2(dx, dz);
      let turn = desired - cop.heading;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      cop.heading += THREE.MathUtils.clamp(turn, -2.4 * dt, 2.4 * dt);
      const targetSpeed = dist > 14 ? 25 : dist > 5 ? 13 : 4;
      cop.speed += THREE.MathUtils.clamp(targetSpeed - cop.speed, -18 * dt, 10 * dt);
      const nx = cop.x + Math.sin(cop.heading) * cop.speed * dt;
      const nz = cop.z + Math.cos(cop.heading) * cop.speed * dt;
      if (!isBlocked(nx, nz, 1.3)) { cop.x = nx; cop.z = nz; } else { cop.speed = 0; cop.heading += 1.8 * dt; }
      cop.lightPhase += dt * 7;
    });
    if (want > 0) {
      const nearestCop = Math.min(...G.cops.filter((c) => c.active).map((c) => Math.hypot(c.x - px, c.z - pz)), 999);
      if (nearestCop > 78) { G.wantedCooldown += dt; if (G.wantedCooldown > 11) { G.wanted -= 1; G.wantedCooldown = 0; cb.current.popup("Heat lost — wanted level down"); } }
      else G.wantedCooldown = 0;
      // busted: cop close + player slow
      if (nearestCop < 7.5 && pSpeed < 2.5 && !G.driving || (nearestCop < 7.5 && pSpeed < 2.5)) {
        G.bustTimer += dt;
        if (G.bustTimer > 3) { G.status = "busted"; G.statusTimer = 0; sfx.fail(); }
      } else G.bustTimer = Math.max(0, G.bustTimer - dt * 1.5);
    } else G.bustTimer = 0;
    if (G.health <= 0 && !G.status) { G.status = "wasted"; G.statusTimer = 0; sfx.fail(); }
    if (G.status) {
      G.statusTimer += dt;
      if (G.statusTimer > 0.4 && G.statusTimer < 0.5) { /* overlay handled by HUD */ }
    }
    // ---- missions ----
    if (M.active && M.phase === "play") {
      const def = M.active;
      M.timer -= dt;
      if (def.noWanted && G.wanted > 0) failMission("You drew heat — Voss needed a clean run.");
      else if (M.timer <= 0) failMission("Out of time.");
      else if (def.kind === "tokens") {
        if (tokenCountRef.current >= 6) completeMission();
      } else {
        const tgt = currentTarget();
        if (tgt) {
          G.objective = { x: tgt[0], z: tgt[1], label: def.objectiveText, kind: def.kind };
          const d2 = (tgt[0] - px) ** 2 + (tgt[1] - pz) ** 2;
          const radius = def.kind === "collect" ? 3.4 : 7;
          if (d2 < radius ** 2) {
            if (def.kind === "escape" && G.wanted > 0) { /* must lose heat first — HUD text explains */ }
            else if (M.step < def.targets.length - 1) { M.collected = new Set(M.collected).add(M.step); M.step += 1; sfx.pickup(); cb.current.popup(def.kind === "collect" ? "Ledger page recovered!" : "Checkpoint!"); }
            else completeMission();
          }
        }
      }
    }
    // objective beam follows current target
    if (beam.current) {
      const o = G.objective;
      beam.current.visible = !!o && M.phase === "play";
      if (o) { beam.current.position.set(o.x, 0, o.z); beam.current.rotation.y = t * 0.8; }
    }
    syncMeshes(t);
    function failMission(reason: string) {
      if (!M.active) return;
      sfx.fail(); cb.current.banner(`Mission failed — ${reason}`, false); endMission(); cb.current.event("missionEnd");
    }
    function completeMission() {
      const def = M.active; if (!def) return;
      G.cash += def.payout; sfx.complete(); cb.current.popup(`+$${def.payout}`);
      cb.current.banner(`Mission complete: ${def.title} +$${def.payout}`, true);
      const wasStory = def.story;
      endMission();
      cb.current.dialogue(def.outro, () => {
        if (wasStory) {
          M.storyIndex += 1;
          if (M.storyIndex >= 6) { M.storyDone = true; persist(); cb.current.storyFinished(); }
          persist(); cb.current.event("missionEnd");
        } else { M.repeatIndex += 1; persist(); cb.current.event("missionEnd"); }
      });
      cb.current.event("missionEnd");
    }
    function syncMeshes(tt: number) {
      G.traffic.forEach((c, i) => { const g = trafficRefs.current[i]; if (g) { g.position.set(c.x, 0, c.z); g.rotation.y = c.heading; } });
      G.peds.forEach((pd, i) => {
        const g = pedRefs.current[i]; if (!g) return;
        g.position.set(pd.x, Math.abs(Math.sin(pd.swing)) * 0.06, pd.z); g.rotation.y = pd.heading;
        const arms = pedArms.current[i];
        if (arms) { if (arms[0]) arms[0].rotation.x = Math.sin(pd.swing) * 0.6; if (arms[1]) arms[1].rotation.x = -Math.sin(pd.swing) * 0.6; }
      });
      G.cops.forEach((c, i) => {
        const g = copRefs.current[i]; if (!g) return;
        g.visible = c.active; g.position.set(c.x, 0, c.z); g.rotation.y = c.heading;
        const lights = copLights.current[i];
        if (lights) {
          const on = Math.sin(c.lightPhase) > 0;
          if (lights[0]) (lights[0].material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 3 : 0.15;
          if (lights[1]) (lights[1].material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 0.15 : 3;
        }
      });
      void tt;
    }
  });

  return (
    <group>
      <ambientLight ref={amb} intensity={theme.ambient} />
      <hemisphereLight ref={hemi} args={[theme.hemiSky, theme.hemiGround, 1.05]} />
      <directionalLight ref={sun} castShadow position={[40, 50, 30]} intensity={theme.sunIntensity}
        shadow-mapSize-width={1024} shadow-mapSize-height={1024}
        shadow-camera-left={-70} shadow-camera-right={70} shadow-camera-top={70} shadow-camera-bottom={-70} shadow-bias={-0.00015} />
      {/* traffic */}
      {G.traffic.map((c, i) => (
        <group key={i} ref={(n) => { trafficRefs.current[i] = n; }} position={[c.x, 0, c.z]}>
          <mesh position={[0, 0.6, 0]} castShadow><boxGeometry args={[1.95, 0.6, 3.5]} /><meshStandardMaterial color={c.color} flatShading metalness={0.2} roughness={0.45} /></mesh>
          <mesh position={[0, 1.12, -0.1]} castShadow><boxGeometry args={[1.45, 0.5, 1.7]} /><meshStandardMaterial color="#cfe8ee" roughness={0.25} /></mesh>
          {[-1, 1].map((s) => [-1, 1].map((a) => (
            <mesh key={`${s}${a}`} position={[s * 1.02, 0.35, a * 1.1]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.34, 0.34, 0.2, 8]} /><meshStandardMaterial color="#1d2124" /></mesh>
          )))}
        </group>
      ))}
      {/* pedestrians */}
      {G.peds.map((pd, i) => (
        <group key={i} ref={(n) => { pedRefs.current[i] = n; }} position={[pd.x, 0, pd.z]}>
          <mesh position={[0, 0.95, 0]} castShadow><capsuleGeometry args={[0.3, 0.62, 3, 6]} /><meshStandardMaterial color={pd.color} flatShading /></mesh>
          <mesh position={[0, 1.62, 0]} castShadow><icosahedronGeometry args={[0.24, 1]} /><meshStandardMaterial color="#d5a77b" flatShading /></mesh>
          <group ref={(n) => { (pedArms.current[i] ??= [null, null])[0] = n; }} position={[-0.38, 1.25, 0]}>
            <mesh position={[0, -0.22, 0]}><capsuleGeometry args={[0.09, 0.36, 3, 5]} /><meshStandardMaterial color={pd.color} /></mesh>
          </group>
          <group ref={(n) => { (pedArms.current[i] ??= [null, null])[1] = n; }} position={[0.38, 1.25, 0]}>
            <mesh position={[0, -0.22, 0]}><capsuleGeometry args={[0.09, 0.36, 3, 5]} /><meshStandardMaterial color={pd.color} /></mesh>
          </group>
          <mesh position={[-0.15, 0.3, 0]}><capsuleGeometry args={[0.11, 0.4, 3, 5]} /><meshStandardMaterial color="#2b3440" /></mesh>
          <mesh position={[0.15, 0.3, 0]}><capsuleGeometry args={[0.11, 0.4, 3, 5]} /><meshStandardMaterial color="#2b3440" /></mesh>
        </group>
      ))}
      {/* police */}
      {G.cops.map((_c, i) => (
        <group key={i} ref={(n) => { copRefs.current[i] = n; }} visible={false}>
          <mesh position={[0, 0.62, 0]} castShadow><boxGeometry args={[2, 0.62, 3.6]} /><meshStandardMaterial color="#101418" flatShading /></mesh>
          <mesh position={[0, 0.62, 0]}><boxGeometry args={[2.02, 0.3, 1.7]} /><meshStandardMaterial color="#f5f5f5" flatShading /></mesh>
          <mesh position={[0, 1.14, -0.1]} castShadow><boxGeometry args={[1.45, 0.5, 1.7]} /><meshStandardMaterial color="#9fc6d8" roughness={0.25} /></mesh>
          <mesh position={[-0.45, 1.48, 0]} ref={(n) => { (copLights.current[i] ??= [null, null])[0] = n; }}>
            <boxGeometry args={[0.55, 0.16, 0.4]} /><meshStandardMaterial color="#ff2222" emissive="#ff2222" emissiveIntensity={2} />
          </mesh>
          <mesh position={[0.45, 1.48, 0]} ref={(n) => { (copLights.current[i] ??= [null, null])[1] = n; }}>
            <boxGeometry args={[0.55, 0.16, 0.4]} /><meshStandardMaterial color="#2266ff" emissive="#2266ff" emissiveIntensity={2} />
          </mesh>
          {[-1, 1].map((s) => [-1, 1].map((a) => (
            <mesh key={`${s}${a}`} position={[s * 1.03, 0.35, a * 1.15]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.34, 0.34, 0.2, 8]} /><meshStandardMaterial color="#111" /></mesh>
          )))}
        </group>
      ))}
      {/* objective marker: glowing pillar + ring */}
      <group ref={beam} visible={false}>
        <mesh position={[0, 14, 0]}><cylinderGeometry args={[1.1, 1.1, 28, 12, 1, true]} /><meshBasicMaterial color="#ffb703" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} /></mesh>
        <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.4, 3, 24]} /><meshBasicMaterial color="#ffb703" transparent opacity={0.9} /></mesh>
        <mesh position={[0, 3.4, 0]}><icosahedronGeometry args={[0.55, 0]} /><meshStandardMaterial color="#ffb703" emissive="#ff9500" emissiveIntensity={2} /></mesh>
      </group>
      {/* ledger-page / collect markers for collect missions */}
      {M.active?.kind === "collect" && M.active.targets.map(([x, z], i) => (
        <mesh key={`${M.active?.id}-${i}`} position={[x, 1.4, z]} visible={!M.collected.has(i)}>
          <icosahedronGeometry args={[0.5, 0]} /><meshStandardMaterial color="#7bf1d3" emissive="#14b8a6" emissiveIntensity={1.6} />
        </mesh>
      ))}
    </group>
  );
}
export { resetAfterArrest, resetAfterWasted };
