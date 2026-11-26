// ---------------------------------------------------------------------------
// Harborfall — WESTBROOK (Phase 26): the second streamed district.
//
// This whole module is a LAZY bundle chunk (see game/westbrook.ts):
// the server only sends it when the player approaches the causeway
// on the Ferry Quarter's west shore, proving the Phase 25 Eastmere
// pattern scales to N districts on the shared loader factory
// (game/streamed.ts). Everything Westbrook — land, roads, buildings,
// colliders, the grain silo, the dock cranes, parked cars, ambient
// walkers — lives in this file and its data table
// (game/westbrookData.ts, shared with the placement audit). On
// import it registers its colliders + road lines into world.ts's
// streamed-district registry; once loaded it stays for the session.
//
// Layout: a small harbour-industrial district across the water west
// of Port Sable. The z=20 road crosses the causeway and becomes the
// main street; x=−164 runs north–south; z=48 is the cross street.
// Landmark: the Westbrook grain silo (three procedural silos) on the
// SW shore, with two dock cranes on the harbour quay.
// HONEST SCOPE: traffic-free by design, exactly like Eastmere —
// parked cars and ambient walkers only (BLUEPRINT Phase 26).
// ---------------------------------------------------------------------------
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { registerStreamedDistrict } from "../world";
import { G } from "../game/store";
import {
  WESTBROOK_BLOCKERS, WESTBROOK_BUILDINGS, WESTBROOK_PARKED,
  WESTBROOK_WALKERS, WESTBROOK_ROADS, WESTBROOK_VIEWPOINT,
} from "../game/westbrookData";
import CarBody from "./CarBody";
import { buildHumanoid, animateHumanoid, type HumanoidRig } from "../humanoid";
import { glowTexture } from "../textures";

// register into the world (colliders + road lines + loaded flag)
registerStreamedDistrict("westbrook", { blockers: WESTBROOK_BLOCKERS, roadX: WESTBROOK_ROADS.roadX, roadZ: WESTBROOK_ROADS.roadZ });

// ---- procedural textures (canvas, like the rest of the game) -------
function facadeTexture(): THREE.Texture {
  const cv = document.createElement("canvas"); cv.width = 96; cv.height = 192;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#dde3da"; g.fillRect(0, 0, 96, 192);
  let seed = 26;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) {
    g.fillStyle = rnd() > 0.7 ? "#ffb340" : "#33443c";
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

export default function WestbrookWorld({ night }: { night: number }) {
  const facade = useMemo(facadeTexture, []);
  const welcomeSign = useMemo(() => signTexture("WESTBROOK", "#ffcf7d", "#1d2f26"), []);
  const siloOfficeSign = useMemo(() => signTexture("SILO OFFICE — ALWAYS OPEN", "#ffcf7d", "#232a31"), []);
  const viewpointSign = useMemo(() => signTexture("BREAKWATER POINT", "#e8ecef", "#3d2f1d"), []);
  const glow = useMemo(glowTexture, []);

  const walkers = useMemo<WalkerState[]>(() => WESTBROOK_WALKERS.map((w) => ({
    rig: buildHumanoid({ top: w.top, bottom: w.bottom, skin: w.skin, hair: w.hair, topStyle: "tee", gender: w.gender, hairStyle: w.gender === "f" ? "ponytail" : "crop" }),
    x: w.beats[0][0], z: w.beats[0][1], heading: 0, phase: Math.random() * 6, bi: 0, dir: 1 as const,
  })), []);
  const stateRef = useRef(walkers);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const px = G.followPos.x, pz = G.followPos.z;
    if (Math.abs(px + 163) > 170 || Math.abs(pz - 20) > 170) return; // far away: rest
    const t = performance.now() / 1000;
    for (let i = 0; i < stateRef.current.length; i++) {
      const s = stateRef.current[i];
      const w = WESTBROOK_WALKERS[i];
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

  return (
    <group>
      {/* land + causeway deck (tops at y=0, matching groundYAt) */}
      <mesh position={[-163, -0.5, 20]} receiveShadow><boxGeometry args={[62, 1, 92]} /><meshStandardMaterial color="#5d7268" roughness={1} /></mesh>
      <mesh position={[-126, -0.5, 20]} receiveShadow><boxGeometry args={[12, 1, 8]} /><meshStandardMaterial color="#687d72" roughness={1} /></mesh>
      {/* causeway rails */}
      <mesh position={[-126, 0.45, 16.3]}><boxGeometry args={[12, 0.5, 0.25]} /><meshStandardMaterial color="#9aa3a8" roughness={0.7} /></mesh>
      <mesh position={[-126, 0.45, 23.7]}><boxGeometry args={[12, 0.5, 0.25]} /><meshStandardMaterial color="#9aa3a8" roughness={0.7} /></mesh>
      {/* roads + kerbs */}
      <mesh position={[-163, 0.01, 20]} receiveShadow><boxGeometry args={[62, 0.02, 9]} /><meshStandardMaterial color="#2e3138" roughness={0.95} /></mesh>
      <mesh position={[-126, 0.01, 20]} receiveShadow><boxGeometry args={[12, 0.02, 9]} /><meshStandardMaterial color="#2e3138" roughness={0.95} /></mesh>
      <mesh position={[-164, 0.01, 20]} receiveShadow><boxGeometry args={[9, 0.02, 92]} /><meshStandardMaterial color="#2e3138" roughness={0.95} /></mesh>
      <mesh position={[-163, 0.01, 48]} receiveShadow><boxGeometry args={[62, 0.02, 9]} /><meshStandardMaterial color="#2e3138" roughness={0.95} /></mesh>
      <mesh position={[-163, 0.015, 14.8]}><boxGeometry args={[62, 0.03, 1.2]} /><meshStandardMaterial color="#9aa3a8" roughness={1} /></mesh>
      <mesh position={[-163, 0.015, 25.2]}><boxGeometry args={[62, 0.03, 1.2]} /><meshStandardMaterial color="#9aa3a8" roughness={1} /></mesh>
      {/* welcome sign at the causeway's west end, facing arrivals */}
      <group position={[-134, 0, 26.5]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 1.5, 0]}><boxGeometry args={[0.18, 3, 0.18]} /><meshStandardMaterial color="#3d2f1d" roughness={0.9} /></mesh>
        <mesh position={[0, 2.9, 0]}><planeGeometry args={[4.6, 0.9]} /><meshStandardMaterial map={welcomeSign} emissive="#ffffff" emissiveMap={welcomeSign} emissiveIntensity={0.15 + night * 0.6} /></mesh>
      </group>
      {/* buildings */}
      {WESTBROOK_BUILDINGS.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]} castShadow receiveShadow>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial map={facade} color={b.color} roughness={0.85} />
        </mesh>
      ))}
      {/* the grain silo — three procedural silos, the district landmark */}
      <group position={[-188, 0, 58]}>
        {([[-2.2, 0, 11], [2.2, 0, 13], [0, -3.4, 9]] as [number, number, number][]).map(([ox, oz, h], i) => (
          <group key={i} position={[ox, 0, oz]}>
            <mesh position={[0, h / 2, 0]} castShadow><cylinderGeometry args={[1.9, 1.9, h, 12]} /><meshStandardMaterial color="#c8c2b2" roughness={0.8} /></mesh>
            <mesh position={[0, h + 0.7, 0]} castShadow><coneGeometry args={[2.05, 1.4, 12]} /><meshStandardMaterial color="#7a4a28" roughness={0.8} /></mesh>
          </group>
        ))}
        <mesh position={[0, 2.2, 3.2]}><boxGeometry args={[6.4, 0.5, 1.2]} /><meshStandardMaterial color="#8a8378" roughness={0.9} /></mesh>
        {/* Phase 39: the office door at the silo's base — a teal
            plate between the two front bins, a step on the apron,
            and the sign. The door (SILO_EXT_DOOR, on the apron at
            z=62.6, clear of the silo blocker) fades you up to the
            lookout office; the fade IS the lift, as the sign and
            the prompt both say. Always open. */}
        <mesh position={[0, 1.05, 1.55]}><boxGeometry args={[1.5, 2.1, 1.0]} /><meshStandardMaterial color="#8a8378" roughness={0.9} /></mesh>
        <mesh position={[0, 1.05, 2.07]}><boxGeometry args={[1.15, 2.1, 0.08]} /><meshStandardMaterial color="#2e4a44" roughness={0.6} /></mesh>
        <mesh position={[0.42, 1.05, 2.12]}><sphereGeometry args={[0.045, 8, 6]} /><meshStandardMaterial color="#c8a24a" metalness={0.7} roughness={0.3} /></mesh>
        <mesh position={[0, 0.06, 3.1]}><boxGeometry args={[1.7, 0.12, 1.6]} /><meshStandardMaterial color="#9aa3a8" roughness={1} /></mesh>
        <mesh position={[0, 2.62, 2.07]}><planeGeometry args={[3.6, 0.68]} /><meshStandardMaterial map={siloOfficeSign} emissive="#ffffff" emissiveMap={siloOfficeSign} emissiveIntensity={0.12 + night * 0.5} /></mesh>
        <sprite position={[0, 14.5, 0]} scale={[6, 6, 1]}>
          <spriteMaterial map={glow} color="#ffdf94" transparent opacity={night * 0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
      {/* dock cranes on the harbour quay (east shore) */}
      {([8, 40] as const).map((cz, i) => (
        <group key={i} position={[-136, 0, cz]}>
          <mesh position={[-1, 3, -1]} castShadow><boxGeometry args={[0.5, 6, 0.5]} /><meshStandardMaterial color="#a8642c" roughness={0.7} /></mesh>
          <mesh position={[1, 3, -1]} castShadow><boxGeometry args={[0.5, 6, 0.5]} /><meshStandardMaterial color="#a8642c" roughness={0.7} /></mesh>
          <mesh position={[-1, 3, 1]} castShadow><boxGeometry args={[0.5, 6, 0.5]} /><meshStandardMaterial color="#a8642c" roughness={0.7} /></mesh>
          <mesh position={[1, 3, 1]} castShadow><boxGeometry args={[0.5, 6, 0.5]} /><meshStandardMaterial color="#a8642c" roughness={0.7} /></mesh>
          <mesh position={[0, 6.2, 0]} castShadow><boxGeometry args={[2.6, 0.5, 2.6]} /><meshStandardMaterial color="#8a5426" roughness={0.7} /></mesh>
          {/* jib reaches east over the water; the hook load hangs at
              world x=−128, just off the district shore */}
          <mesh position={[4, 6.9, 0]} castShadow><boxGeometry args={[10, 0.45, 0.6]} /><meshStandardMaterial color="#a8642c" roughness={0.7} /></mesh>
          <mesh position={[-2.6, 6.6, 0]} castShadow><boxGeometry args={[2.2, 1.1, 1.4]} /><meshStandardMaterial color="#5d4a33" roughness={0.8} /></mesh>
          <mesh position={[8, 4.4, 0]}><boxGeometry args={[0.06, 4.6, 0.06]} /><meshStandardMaterial color="#2b2f33" roughness={0.6} /></mesh>
          <mesh position={[8, 1.9, 0]} castShadow><boxGeometry args={[1.1, 0.5, 1.1]} /><meshStandardMaterial color="#6e5636" roughness={0.85} /></mesh>
        </group>
      ))}
      {/* Breakwater Point — paved pad + sign at the main street's west end */}
      <group position={[WESTBROOK_VIEWPOINT.x, 0, WESTBROOK_VIEWPOINT.z]}>
        <mesh position={[0, 0.03, 0]} receiveShadow><boxGeometry args={[8, 0.06, 6]} /><meshStandardMaterial color="#8b8f8c" roughness={1} /></mesh>
        <mesh position={[-3.6, 0.5, -2.6]}><boxGeometry args={[0.15, 1, 0.15]} /><meshStandardMaterial color="#3d2f1d" roughness={0.9} /></mesh>
        <mesh position={[-3.6, 0.5, 2.6]}><boxGeometry args={[0.15, 1, 0.15]} /><meshStandardMaterial color="#3d2f1d" roughness={0.9} /></mesh>
        <mesh position={[-3.6, 0.95, 0]}><boxGeometry args={[0.12, 0.12, 5.4]} /><meshStandardMaterial color="#3d2f1d" roughness={0.9} /></mesh>
        <group position={[2.6, 0, 2.2]} rotation={[0, -Math.PI * 0.78, 0]}>
          <mesh position={[0, 1, 0]}><boxGeometry args={[0.14, 2, 0.14]} /><meshStandardMaterial color="#3d2f1d" roughness={0.9} /></mesh>
          <mesh position={[0, 1.9, 0]}><planeGeometry args={[3.4, 0.62]} /><meshStandardMaterial map={viewpointSign} emissive="#ffffff" emissiveMap={viewpointSign} emissiveIntensity={0.1 + night * 0.4} /></mesh>
        </group>
      </group>
      {/* street lamps */}
      {[[-140, 14.8], [-186, 25.2], [-169.4, 53.2], [-158.6, -18]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 2.4, 0]}><cylinderGeometry args={[0.07, 0.09, 4.8, 6]} /><meshStandardMaterial color="#2b2f33" roughness={0.7} /></mesh>
          <mesh position={[0, 4.85, 0]}><sphereGeometry args={[0.22, 8, 6]} /><meshStandardMaterial color="#ffdf94" emissive="#ffdf94" emissiveIntensity={night * 2.2} /></mesh>
          <sprite position={[0, 4.85, 0]} scale={[3.4, 3.4, 1]}>
            <spriteMaterial map={glow} color="#ffdf94" transparent opacity={night * 0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      ))}
      {/* parked cars (decorative — the district is traffic-free) */}
      {WESTBROOK_PARKED.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation={[0, p.heading, 0]}>
          <CarBody kind={p.kind} color={p.color} />
        </group>
      ))}
      {/* ambient walkers */}
      {walkers.map((s, i) => <primitive key={i} object={s.rig.group} />)}
    </group>
  );
}
