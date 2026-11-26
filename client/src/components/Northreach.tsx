// ---------------------------------------------------------------------------
// Harborfall — NORTHREACH (Phase 31): the third streamed district.
//
// This whole module is a LAZY bundle chunk (see game/northreach.ts):
// the server only sends it when the player travels toward the
// bridge on Northgate's north shore, on the shared loader factory
// (game/streamed.ts) — the pattern now carries three districts.
// Everything Northreach — land, bridge, roads, buildings, colliders,
// the chapel, the observatory dome, parked cars, ambient walkers —
// lives in this file and its data table (game/northreachData.ts,
// shared with the placement audit). On import it registers its
// colliders + road lines into world.ts's streamed-district registry;
// once loaded it stays for the session.
//
// Layout: a quiet clifftop headland north of Northgate, reached by
// continuing the x=−20 road column across a short bridge from
// Northgate's north shore (z=−296). Main street x=−20, cross street
// z=−336. Landmarks: a small stone chapel (NW block) and an
// observatory with a weathered-teal dome (NE block). Viewpoint:
// Northreach Point, at the cliff edge at the main street's end.
// HONEST SCOPE: traffic-free by design, exactly like Eastmere and
// Westbrook — parked cars and ambient walkers only.
// ---------------------------------------------------------------------------
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { registerStreamedDistrict } from "../world";
import { G } from "../game/store";
import {
  NORTHREACH_BLOCKERS, NORTHREACH_BUILDINGS, NORTHREACH_PARKED,
  NORTHREACH_WALKERS, NORTHREACH_ROADS, NORTHREACH_VIEWPOINT,
} from "../game/northreachData";
import CarBody from "./CarBody";
import { buildHumanoid, animateHumanoid, type HumanoidRig } from "../humanoid";
import { glowTexture } from "../textures";

// register into the world (colliders + road lines + loaded flag)
registerStreamedDistrict("northreach", { blockers: NORTHREACH_BLOCKERS, roadX: NORTHREACH_ROADS.roadX, roadZ: NORTHREACH_ROADS.roadZ });

// ---- procedural textures (canvas, like the rest of the game) -------
function facadeTexture(): THREE.Texture {
  const cv = document.createElement("canvas"); cv.width = 96; cv.height = 192;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#e3ded0"; g.fillRect(0, 0, 96, 192);
  let seed = 31;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) {
    g.fillStyle = rnd() > 0.7 ? "#ffb340" : "#3a4a44";
    g.fillRect(8 + col * 22, 10 + row * 22, 14, 15);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function signTexture(text: string, fg: string, bg: string): THREE.Texture {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 96;
  const g = cv.getContext("2d")!;
  g.fillStyle = bg; g.fillRect(0, 0, 512, 96);
  g.fillStyle = fg; g.font = "bold 52px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, 256, 52);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface WalkerState { rig: HumanoidRig; x: number; z: number; heading: number; phase: number; bi: number; dir: 1 | -1 }

export default function NorthreachWorld({ night }: { night: number }) {
  const facade = useMemo(facadeTexture, []);
  const welcomeSign = useMemo(() => signTexture("NORTHREACH", "#ffcf7d", "#1d2f26"), []);
  const viewpointSign = useMemo(() => signTexture("NORTHREACH POINT", "#e8ecef", "#3d2f1d"), []);
  const teaSign = useMemo(() => signTexture("CLIFF TEA HOUSE", "#ffcf7d", "#3d2f1d"), []);
  const glow = useMemo(glowTexture, []);

  const walkers = useMemo<WalkerState[]>(() => NORTHREACH_WALKERS.map((w) => ({
    rig: buildHumanoid({ top: w.top, bottom: w.bottom, skin: w.skin, hair: w.hair, topStyle: "tee", gender: w.gender, hairStyle: w.gender === "f" ? "ponytail" : "crop" }),
    x: w.beats[0][0], z: w.beats[0][1], heading: 0, phase: Math.random() * 6, bi: 0, dir: 1 as const,
  })), []);
  const stateRef = useRef(walkers);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const px = G.followPos.x, pz = G.followPos.z;
    if (Math.abs(px + 20) > 170 || Math.abs(pz + 336) > 170) return; // far away: rest
    const t = performance.now() / 1000;
    for (let i = 0; i < stateRef.current.length; i++) {
      const s = stateRef.current[i];
      const w = NORTHREACH_WALKERS[i];
      const target = w.beats[s.bi + s.dir] ?? w.beats[s.bi];
      const dx = target[0] - s.x, dz = target[1] - s.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.4) {
        let nbi = s.bi + s.dir;
        if (nbi < 0 || nbi >= w.beats.length) { s.dir = (s.dir * -1) as 1 | -1; nbi = s.bi + s.dir; }
        s.bi = Math.max(0, Math.min(w.beats.length - 1, nbi));
      } else {
        const sp = 1.35 * dt;
        s.x += (dx / dist) * Math.min(sp, dist);
        s.z += (dz / dist) * Math.min(sp, dist);
        const want = Math.atan2(dx, dz);
        let dh = want - s.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        s.heading += dh * Math.min(1, dt * 8);
        s.phase += dt * 5.4;
      }
      s.rig.group.position.set(s.x, 0, s.z);
      s.rig.group.rotation.y = s.heading;
      animateHumanoid(s.rig, s.phase, dist >= 0.4 ? 0.65 : 0, t);
    }
  });

  // cliff fence posts along the north edge (gap at the viewpoint)
  const fencePosts = useMemo(() => {
    const xs: number[] = [];
    for (let x = -70; x <= -26; x += 7.4) xs.push(x);
    for (let x = -14; x <= 30; x += 7.4) xs.push(x);
    return xs;
  }, []);

  return (
    <group>
      {/* land + bridge deck (tops at y=0, matching groundYAt) */}
      <mesh position={[-20, -0.5, -336]} receiveShadow><boxGeometry args={[104, 1, 64]} /><meshStandardMaterial color="#5e735f" roughness={1} /></mesh>
      <mesh position={[-20, -0.5, -300]} receiveShadow><boxGeometry args={[8, 1, 10]} /><meshStandardMaterial color="#687d72" roughness={1} /></mesh>
      {/* bridge rails */}
      <mesh position={[-23.7, 0.45, -300]}><boxGeometry args={[0.25, 0.5, 10]} /><meshStandardMaterial color="#9aa3a8" roughness={0.7} /></mesh>
      <mesh position={[-16.3, 0.45, -300]}><boxGeometry args={[0.25, 0.5, 10]} /><meshStandardMaterial color="#9aa3a8" roughness={0.7} /></mesh>
      {/* roads + kerbs */}
      <mesh position={[-20, 0.01, -336]} receiveShadow><boxGeometry args={[9, 0.02, 64]} /><meshStandardMaterial color="#2e3138" roughness={0.95} /></mesh>
      <mesh position={[-20, 0.01, -300]} receiveShadow><boxGeometry args={[8, 0.02, 10]} /><meshStandardMaterial color="#2e3138" roughness={0.95} /></mesh>
      <mesh position={[-20, 0.01, -336]} receiveShadow><boxGeometry args={[104, 0.02, 9]} /><meshStandardMaterial color="#2e3138" roughness={0.95} /></mesh>
      <mesh position={[-25.2, 0.015, -336]}><boxGeometry args={[1.2, 0.03, 64]} /><meshStandardMaterial color="#9aa3a8" roughness={1} /></mesh>
      <mesh position={[-14.8, 0.015, -336]}><boxGeometry args={[1.2, 0.03, 64]} /><meshStandardMaterial color="#9aa3a8" roughness={1} /></mesh>
      <mesh position={[-20, 0.015, -341.2]}><boxGeometry args={[104, 0.03, 1.2]} /><meshStandardMaterial color="#9aa3a8" roughness={1} /></mesh>
      <mesh position={[-20, 0.015, -330.8]}><boxGeometry args={[104, 0.03, 1.2]} /><meshStandardMaterial color="#9aa3a8" roughness={1} /></mesh>
      {/* welcome sign at the bridge's north end, facing arrivals from the south */}
      <group position={[-13.2, 0, -302.5]}>
        <mesh position={[0, 1.5, 0]}><boxGeometry args={[0.18, 3, 0.18]} /><meshStandardMaterial color="#3d2f1d" roughness={0.9} /></mesh>
        <mesh position={[0, 2.9, 0]}><planeGeometry args={[4.6, 0.9]} /><meshStandardMaterial map={welcomeSign} emissive="#ffffff" emissiveMap={welcomeSign} emissiveIntensity={0.15 + night * 0.6} /></mesh>
      </group>
      {/* buildings */}
      {NORTHREACH_BUILDINGS.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]} castShadow receiveShadow>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial map={facade} color={b.color} roughness={0.85} />
        </mesh>
      ))}
      {/* the tea house sign, on its south face */}
      <mesh position={[-48, 3.6, -313.9]}><planeGeometry args={[3.8, 0.7]} /><meshStandardMaterial map={teaSign} emissive="#ffffff" emissiveMap={teaSign} emissiveIntensity={0.1 + night * 0.5} /></mesh>
      {/* the chapel — pale stone, steep teal pyramid roof, slim spire */}
      <group position={[-58, 0, -354]}>
        <mesh position={[0, 3, 0]} castShadow receiveShadow><boxGeometry args={[10, 6, 8]} /><meshStandardMaterial color="#cfc8b4" roughness={0.9} /></mesh>
        <mesh position={[0, 7.7, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 0.8]} castShadow><coneGeometry args={[7.4, 3.4, 4]} /><meshStandardMaterial color="#14524f" roughness={0.8} /></mesh>
        <mesh position={[0, 10.2, 0]} castShadow><boxGeometry args={[0.32, 2.4, 0.32]} /><meshStandardMaterial color="#3c4147" roughness={0.7} /></mesh>
        <mesh position={[0, 11.6, 0]}><sphereGeometry args={[0.28, 8, 6]} /><meshStandardMaterial color="#ffdf94" emissive="#ffdf94" emissiveIntensity={0.4 + night * 1.6} /></mesh>
        {/* tall amber window on the south face + the door */}
        <mesh position={[0, 3.2, 4.03]}><planeGeometry args={[1.1, 3.2]} /><meshStandardMaterial color="#ffb340" emissive="#ffb340" emissiveIntensity={0.15 + night * 1.1} /></mesh>
        <mesh position={[2.6, 1.1, 4.03]}><planeGeometry args={[1.2, 2.2]} /><meshStandardMaterial color="#3d2f1d" roughness={0.9} /></mesh>
        <sprite position={[0, 11.6, 0]} scale={[4.5, 4.5, 1]}>
          <spriteMaterial map={glow} color="#ffdf94" transparent opacity={night * 0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
      {/* the observatory — stone drum, weathered-teal dome, shutter slit */}
      <group position={[8, 0, -354]}>
        <mesh position={[0, 2.75, 0]} castShadow receiveShadow><cylinderGeometry args={[3.4, 3.6, 5.5, 14]} /><meshStandardMaterial color="#b9b2a0" roughness={0.9} /></mesh>
        <mesh position={[0, 5.5, 0]} castShadow><sphereGeometry args={[3.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#2e6f79" roughness={0.55} metalness={0.25} /></mesh>
        <mesh position={[0, 7.6, 1.9]} rotation={[0.5, 0, 0]}><boxGeometry args={[0.55, 2.6, 0.18]} /><meshStandardMaterial color="#22303a" roughness={0.6} /></mesh>
        <mesh position={[0, 1.1, 3.64]}><planeGeometry args={[1.1, 2.2]} /><meshStandardMaterial color="#3d2f1d" roughness={0.9} /></mesh>
        <mesh position={[-2.2, 3.4, 3.1]} rotation={[0, -0.6, 0]}><planeGeometry args={[0.8, 1.1]} /><meshStandardMaterial color="#ffb340" emissive="#ffb340" emissiveIntensity={0.12 + night * 1.0} /></mesh>
      </group>
      {/* cliff fence along the north edge (gap at the viewpoint pad) */}
      {fencePosts.map((x, i) => (
        <mesh key={i} position={[x, 0.5, -367.3]}><boxGeometry args={[0.14, 1, 0.14]} /><meshStandardMaterial color="#3d2f1d" roughness={0.9} /></mesh>
      ))}
      <mesh position={[-47.75, 0.95, -367.3]}><boxGeometry args={[46.5, 0.12, 0.12]} /><meshStandardMaterial color="#3d2f1d" roughness={0.9} /></mesh>
      <mesh position={[7.75, 0.95, -367.3]}><boxGeometry args={[46.5, 0.12, 0.12]} /><meshStandardMaterial color="#3d2f1d" roughness={0.9} /></mesh>
      {/* Northreach Point — paved pad + rails + sign at the cliff edge */}
      <group position={[NORTHREACH_VIEWPOINT.x, 0, NORTHREACH_VIEWPOINT.z]}>
        <mesh position={[0, 0.03, 0]} receiveShadow><boxGeometry args={[8, 0.06, 6]} /><meshStandardMaterial color="#8b8f8c" roughness={1} /></mesh>
        <group position={[-2.2, 0, 1.8]} rotation={[0, 0.35, 0]}>
          <mesh position={[0, 1, 0]}><boxGeometry args={[0.14, 2, 0.14]} /><meshStandardMaterial color="#3d2f1d" roughness={0.9} /></mesh>
          <mesh position={[0, 1.9, 0]}><planeGeometry args={[3.4, 0.62]} /><meshStandardMaterial map={viewpointSign} emissive="#ffffff" emissiveMap={viewpointSign} emissiveIntensity={0.1 + night * 0.4} /></mesh>
        </group>
      </group>
      {/* street lamps */}
      {[[-25.2, -310], [-14.8, -344], [-25.2, -362], [24, -330.8]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 2.4, 0]}><cylinderGeometry args={[0.07, 0.09, 4.8, 6]} /><meshStandardMaterial color="#2b2f33" roughness={0.7} /></mesh>
          <mesh position={[0, 4.85, 0]}><sphereGeometry args={[0.22, 8, 6]} /><meshStandardMaterial color="#ffdf94" emissive="#ffdf94" emissiveIntensity={night * 2.2} /></mesh>
          <sprite position={[0, 4.85, 0]} scale={[3.4, 3.4, 1]}>
            <spriteMaterial map={glow} color="#ffdf94" transparent opacity={night * 0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      ))}
      {/* wind-bent pines at the cliff edges (visual only) */}
      {[[-70, -330, 1.1], [29, -352, 0.9], [-58, -306, 1.0]].map(([x, z, s], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0.06, 0, 0.1]}>
          <mesh position={[0, 1.1 * s, 0]} castShadow><cylinderGeometry args={[0.14 * s, 0.2 * s, 2.2 * s, 6]} /><meshStandardMaterial color="#4a3826" roughness={1} /></mesh>
          <mesh position={[0, 3.1 * s, 0]} castShadow><coneGeometry args={[1.5 * s, 3.4 * s, 8]} /><meshStandardMaterial color="#3d5a44" roughness={1} /></mesh>
        </group>
      ))}
      {/* parked cars (decorative — the district is traffic-free) */}
      {NORTHREACH_PARKED.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation={[0, p.heading, 0]}>
          <CarBody kind={p.kind} color={p.color} />
        </group>
      ))}
      {/* ambient walkers */}
      {walkers.map((s, i) => <primitive key={i} object={s.rig.group} />)}
    </group>
  );
}
