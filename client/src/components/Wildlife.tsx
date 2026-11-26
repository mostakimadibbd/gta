// Harborfall — Phase 42: HARBOUR WILDLIFE. Two ambient systems,
// both presentation-only (no saves, no economy, no collision):
//
//  · THE POD — five procedural dolphins porpoising a scripted loop
//    around Sable Island and along the mainland shore (route +
//    path maths in game/wildlife.ts, audited in section 11). One
//    real behaviour: a moving boat within POD_DIVE_RADIUS makes
//    the nearest dolphins dive for ~3 s. Splashes are flat
//    expanding rings in the Phase 8 fishing-splash idiom (the
//    Phase 6 wake pool lives inside Vehicle.tsx and is not
//    shareable, so the pod carries its own small pool).
//  · PERCHED GULLS — the Phase 2 harbour flock is one rigid
//    circling group with no per-bird steering, so rather than
//    rewrite it, this adds a second, additive behaviour: gulls on
//    mooring posts (new props below) that scatter into a holding
//    circle when the player comes within GULL_SCARE_RADIUS and
//    resettle once the player is beyond GULL_SETTLE_RADIUS.
//
// Performance contract (Phase 42): the pod group hides beyond the
// traffic dormancy radius scaled by the player's view-distance
// lever (game/perf.ts viewStreamScale — Near hides it sooner, Far
// keeps it longer); the frame loop allocates nothing (all state in
// refs, positions written into the existing scene graph); gulls
// are six small groups with a per-gull state machine.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { G } from "../game/store";
import { groundYAt } from "../world";
import {
  POD, POD_MEMBERS, POD_SIZE, POD_SPEED, POD_DIVE_RADIUS, podPathPoint,
  GULL_PERCHES, GULL_SCARE_RADIUS, GULL_SETTLE_RADIUS,
} from "../game/wildlife";
import { viewStreamScale } from "../game/perf";

const DOLPHIN_BODY = "#6b8288"; // slate grey-teal — no cartoon faces, no eyes painted on
const DOLPHIN_FIN = "#54686e";
const SPLASH_N = 12;

/** One procedural dolphin, built from primitives in the house
 * style (scaled sphere body, cone beak + dorsal fin, box flukes).
 * Faces +Z; the parent group carries position/heading/pitch. */
function DolphinFigure() {
  return (
    <group>
      <mesh scale={[0.42, 0.4, 1.35]}>
        <sphereGeometry args={[0.62, 10, 8]} />
        <meshStandardMaterial color={DOLPHIN_BODY} roughness={0.55} flatShading />
      </mesh>
      {/* beak */}
      <mesh position={[0, -0.03, 0.95]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.13, 0.42, 6]} />
        <meshStandardMaterial color={DOLPHIN_BODY} roughness={0.55} flatShading />
      </mesh>
      {/* dorsal fin */}
      <mesh position={[0, 0.34, -0.08]} rotation={[-0.35, 0, 0]} scale={[0.16, 1, 0.6]}>
        <coneGeometry args={[0.3, 0.5, 4]} />
        <meshStandardMaterial color={DOLPHIN_FIN} roughness={0.6} flatShading />
      </mesh>
      {/* tail stock + fluke */}
      <mesh position={[0, 0.02, -0.95]} rotation={[Math.PI / 2, 0, 0]} scale={[0.5, 1, 0.5]}>
        <coneGeometry args={[0.3, 0.5, 6]} />
        <meshStandardMaterial color={DOLPHIN_FIN} roughness={0.6} flatShading />
      </mesh>
      <mesh position={[-0.26, 0.03, -1.22]} rotation={[0, 0.5, 0]} scale={[1, 0.18, 0.5]}>
        <boxGeometry args={[0.52, 0.3, 0.4]} />
        <meshStandardMaterial color={DOLPHIN_FIN} roughness={0.6} flatShading />
      </mesh>
      <mesh position={[0.26, 0.03, -1.22]} rotation={[0, -0.5, 0]} scale={[1, 0.18, 0.5]}>
        <boxGeometry args={[0.52, 0.3, 0.4]} />
        <meshStandardMaterial color={DOLPHIN_FIN} roughness={0.6} flatShading />
      </mesh>
      {/* pectoral fins */}
      <mesh position={[-0.3, -0.18, 0.3]} rotation={[0, 0, 0.7]} scale={[1, 0.16, 0.6]}>
        <boxGeometry args={[0.44, 0.3, 0.36]} />
        <meshStandardMaterial color={DOLPHIN_FIN} roughness={0.6} flatShading />
      </mesh>
      <mesh position={[0.3, -0.18, 0.3]} rotation={[0, 0, -0.7]} scale={[1, 0.16, 0.6]}>
        <boxGeometry args={[0.44, 0.3, 0.36]} />
        <meshStandardMaterial color={DOLPHIN_FIN} roughness={0.6} flatShading />
      </mesh>
    </group>
  );
}

interface GullState { mode: 0 | 1 | 2; ang: number; awayT: number; x: number; y: number; z: number; heading: number; flap: number }

export default function Wildlife() {
  const podRef = useRef<THREE.Group>(null);
  const dolphinRefs = useRef<Array<THREE.Group | null>>([]);
  const splashRefs = useRef<Array<THREE.Mesh | null>>([]);
  const splashes = useRef(Array.from({ length: SPLASH_N }, () => ({ life: 0, x: 0, z: 0 })));
  const splashIdx = useRef(0);
  const podDist = useRef(0);
  // Phase 45: Low-preset half-rate accumulator — on the Low tier the
  // ambient update below runs every other frame with the summed dt
  // (see the gate at the top of useFrame).
  const lowRateAcc = useRef(0);
  const prevY = useRef(new Array<number>(POD_SIZE).fill(-1));
  const diveUntil = useRef(new Array<number>(POD_SIZE).fill(-1));
  const wasDiving = useRef(new Array<boolean>(POD_SIZE).fill(false));

  const gullRefs = useRef<Array<THREE.Group | null>>([]);
  const wingLRefs = useRef<Array<THREE.Group | null>>([]);
  const wingRRefs = useRef<Array<THREE.Group | null>>([]);
  const perchBase = useMemo(() => GULL_PERCHES.map((p) => groundYAt(p.x, p.z)), []);
  const perchTop = useMemo(() => perchBase.map((y) => y + 1.22), [perchBase]);
  const gulls = useRef<GullState[]>(GULL_PERCHES.map((p, i) => ({
    mode: 0, ang: i * 1.1, awayT: 0, x: p.x, y: 0, z: p.z, heading: i * 2.3, flap: 0,
  })));

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    // Phase 45: on the Low preset this whole ambient block updates
    // at HALF RATE (~30 Hz). Everything below integrates from dt or
    // reads the clock, so running it with the summed dt of two
    // frames is behaviour-identical, just sampled less often —
    // dolphins porpoise on a 2.8 s cycle and gulls scatter on a
    // seconds scale, so 30 Hz sampling is invisible; POD_MEMBERS
    // (the photo-challenge read) is at most one skipped frame
    // stale. Medium/High run every frame, exactly as before.
    let dt = Math.min(delta, 0.05);
    if (G.settings.quality === "low") {
      lowRateAcc.current += delta;
      if (lowRateAcc.current < 1 / 30) return;
      dt = Math.min(lowRateAcc.current, 0.1);
      lowRateAcc.current = 0;
    }
    const px = G.playerPos.x, pz = G.playerPos.z;

    // ================= THE POD =================
    podDist.current += dt * POD_SPEED;
    const leader = podPathPoint(podDist.current);
    POD.x = leader.x; POD.z = leader.z; POD.heading = leader.heading;
    if (podRef.current) {
      const cull = 175 * viewStreamScale();
      const d2 = (px - leader.x) ** 2 + (pz - leader.z) ** 2;
      podRef.current.visible = !G.interior && d2 < cull * cull;
    }
    for (let i = 0; i < POD_SIZE; i++) {
      const g = dolphinRefs.current[i];
      if (!g) continue;
      const pt = podPathPoint(podDist.current - i * 2.8);
      const lat = Math.sin(t * 0.45 + i * 1.7) * 0.9;
      const x = pt.x + Math.cos(pt.heading) * lat;
      const z = pt.z - Math.sin(pt.heading) * lat;
      // dive rule: any MOVING boat (player's or traffic) within
      // POD_DIVE_RADIUS sends this dolphin under for ~3 s. Moored
      // scenery hulls aren't in G.cars and the route already keeps
      // its distance from them (audit section 11).
      let diving = t < diveUntil.current[i];
      if (!diving) {
        for (let ci = 0; ci < G.cars.length; ci++) {
          const c = G.cars[ci];
          if ((c.kind !== "boat" && c.kind !== "skiff") || Math.abs(c.state.speed) <= 0.5) continue;
          if ((c.state.x - x) ** 2 + (c.state.z - z) ** 2 < POD_DIVE_RADIUS * POD_DIVE_RADIUS) {
            diveUntil.current[i] = t + 3;
            diving = true;
            break;
          }
        }
      }
      const ph = t * (Math.PI * 2 / 2.8) + i * 1.05;
      let y = Math.sin(ph) * 0.85 - 0.22;
      let pitch = -Math.cos(ph) * 0.55;
      if (diving) {
        y += (-1.2 - y) * Math.min(1, dt * 3);
        pitch += (0.12 - pitch) * Math.min(1, dt * 3);
        if (!wasDiving.current[i]) { // the dive itself splashes
          const s = splashes.current[splashIdx.current % SPLASH_N]; splashIdx.current += 1;
          s.life = 1; s.x = x; s.z = z;
        }
      } else if ((prevY.current[i] < 0 && y >= 0) || (prevY.current[i] >= 0 && y < 0)) {
        // breached or re-entered — splash ring at the crossing
        const s = splashes.current[splashIdx.current % SPLASH_N]; splashIdx.current += 1;
        s.life = 1; s.x = x; s.z = z;
      }
      wasDiving.current[i] = diving;
      prevY.current[i] = y;
      // Phase 43: publish the live member state (position + breach
      // height) for the photo challenges — written even while the
      // pod group is culled, like POD itself.
      const pm = POD_MEMBERS[i]; pm.x = x; pm.z = z; pm.y = y;
      g.position.set(x, y, z);
      g.rotation.set(pitch, pt.heading, 0, "YXZ");
    }
    // splash rings (Phase 8 idiom: flat ring, scale up, fade out)
    splashes.current.forEach((s, i) => {
      const m = splashRefs.current[i];
      if (!m) return;
      if (s.life <= 0) { m.visible = false; return; }
      s.life -= dt / 1.1;
      m.visible = s.life > 0;
      if (m.visible) {
        m.position.set(s.x, 0.07, s.z);
        const sc = 0.6 + (1 - s.life) * 2.4;
        m.scale.set(sc, sc, sc);
        (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, s.life) * 0.5;
      }
    });

    // ================= PERCHED GULLS =================
    for (let i = 0; i < GULL_PERCHES.length; i++) {
      const grp = gullRefs.current[i];
      if (!grp) continue;
      const st = gulls.current[i];
      const perch = GULL_PERCHES[i];
      const topY = perchTop[i];
      const pd2 = (px - perch.x) ** 2 + (pz - perch.z) ** 2;
      if (st.mode === 0) {
        // perched: idle on the post; scatter when the player closes in
        st.x = perch.x; st.z = perch.z; st.y = topY;
        st.flap += (0 - st.flap) * Math.min(1, dt * 6);
        if (pd2 < GULL_SCARE_RADIUS * GULL_SCARE_RADIUS) { st.mode = 1; st.awayT = 0; }
      } else if (st.mode === 1) {
        // scattered: hold a slow circle over the perch
        st.ang += dt * 0.85 * (i % 2 === 0 ? 1 : -1);
        const tx = perch.x + Math.cos(st.ang) * 4.5;
        const tz = perch.z + Math.sin(st.ang) * 4.5;
        st.heading = Math.atan2(tx - st.x, tz - st.z);
        st.x = tx; st.z = tz;
        st.y += ((topY + 2.4 + Math.sin(t * 1.7 + i * 2.1) * 0.45) - st.y) * Math.min(1, dt * 2.5);
        st.flap += (1 - st.flap) * Math.min(1, dt * 5);
        if (pd2 > GULL_SETTLE_RADIUS * GULL_SETTLE_RADIUS) {
          st.awayT += dt;
          if (st.awayT > 2.5) st.mode = 2;
        } else st.awayT = 0;
      } else {
        // resettling: glide back to the post, then perch
        const dx = perch.x - st.x, dz = perch.z - st.z;
        st.heading = Math.atan2(dx, dz);
        const k = Math.min(1, dt * 1.4);
        st.x += dx * k; st.z += dz * k;
        st.y += (topY - st.y) * Math.min(1, dt * 1.8);
        st.flap += (0.35 - st.flap) * Math.min(1, dt * 4);
        if (dx * dx + dz * dz < 0.04 && Math.abs(st.y - topY) < 0.12) st.mode = 0;
        if (pd2 < GULL_SCARE_RADIUS * GULL_SCARE_RADIUS) { st.mode = 1; st.awayT = 0; } // scared again mid-glide
      }
      grp.position.set(st.x, st.y + (st.mode === 0 ? Math.sin(t * 1.3 + i * 1.9) * 0.012 : 0), st.z);
      grp.rotation.set(0, st.heading, 0);
      // wings: folded flat on the post, flapping in the air
      const flapA = st.mode === 0 ? 0 : Math.sin(t * 9 + i * 1.3) * 0.55 * st.flap + 0.1 * st.flap;
      const wl = wingLRefs.current[i], wr = wingRRefs.current[i];
      if (wl) wl.rotation.z = st.mode === 0 ? 0.5 : -flapA;
      if (wr) wr.rotation.z = st.mode === 0 ? -0.5 : flapA;
    }
  });

  return (
    <>
      {/* the pod */}
      <group ref={podRef}>
        {Array.from({ length: POD_SIZE }, (_, i) => (
          <group key={i} ref={(n) => { dolphinRefs.current[i] = n; }}>
            <DolphinFigure />
          </group>
        ))}
      </group>
      {/* dolphin splash rings */}
      {splashes.current.map((_, i) => (
        <mesh key={`ds${i}`} ref={(n) => { splashRefs.current[i] = n; }} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.72, 20]} />
          <meshBasicMaterial color="#eaf6f8" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      {/* mooring posts + perched gulls */}
      {GULL_PERCHES.map((p, i) => (
        <group key={`post${i}`}>
          <mesh position={[p.x, perchBase[i] + 0.57, p.z]}>
            <cylinderGeometry args={[0.09, 0.11, 1.15, 7]} />
            <meshStandardMaterial color="#6d4c33" roughness={0.9} />
          </mesh>
          <mesh position={[p.x, perchBase[i] + 1.16, p.z]}>
            <cylinderGeometry args={[0.13, 0.13, 0.05, 7]} />
            <meshStandardMaterial color="#54402c" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {GULL_PERCHES.map((p, i) => (
        <group key={`gull${i}`} ref={(n) => { gullRefs.current[i] = n; }} position={[p.x, perchTop[i], p.z]}>
          {/* body */}
          <mesh scale={[0.32, 0.3, 0.62]}>
            <sphereGeometry args={[0.3, 8, 6]} />
            <meshStandardMaterial color="#dfe3e6" roughness={0.8} flatShading />
          </mesh>
          {/* head + amber beak (no painted eyes — the flock idiom) */}
          <mesh position={[0, 0.1, 0.2]}>
            <sphereGeometry args={[0.11, 8, 6]} />
            <meshStandardMaterial color="#eef1f3" roughness={0.8} flatShading />
          </mesh>
          <mesh position={[0, 0.08, 0.34]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.035, 0.14, 5]} />
            <meshStandardMaterial color="#e8b23a" roughness={0.6} flatShading />
          </mesh>
          {/* tail */}
          <mesh position={[0, 0.02, -0.24]} scale={[0.7, 0.15, 0.5]}>
            <boxGeometry args={[0.3, 0.2, 0.3]} />
            <meshStandardMaterial color="#c9ced2" roughness={0.8} flatShading />
          </mesh>
          {/* wings on pivots — folded on the post, flapping in the air */}
          <group ref={(n) => { wingLRefs.current[i] = n; }} position={[-0.05, 0.05, 0]}>
            <mesh position={[-0.3, 0, -0.02]} scale={[1, 0.14, 0.55]}>
              <boxGeometry args={[0.6, 0.2, 0.4]} />
              <meshStandardMaterial color="#9aa4ac" roughness={0.8} flatShading />
            </mesh>
          </group>
          <group ref={(n) => { wingRRefs.current[i] = n; }} position={[0.05, 0.05, 0]}>
            <mesh position={[0.3, 0, -0.02]} scale={[1, 0.14, 0.55]}>
              <boxGeometry args={[0.6, 0.2, 0.4]} />
              <meshStandardMaterial color="#9aa4ac" roughness={0.8} flatShading />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}
