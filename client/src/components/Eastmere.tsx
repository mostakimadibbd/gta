// ---------------------------------------------------------------------------
// Harborfall — EASTMERE (Phase 25): the streamed district.
//
// This whole module is a LAZY bundle chunk (see game/eastmere.ts):
// the server only sends it when the player approaches the causeway
// east of Northgate, so the main game download does not carry it.
// Everything Eastmere — land, roads, buildings, colliders, parked
// cars, ambient peds, the lighthouse — lives in this file and
// nowhere else. On import it registers its colliders + road lines
// into world.ts's streamed-district registry; once loaded it stays
// for the session (no unregister — documented in BLUEPRINT).
//
// Layout: a compact harbour district across a short causeway from
// Northgate's east edge (the z=−248 road runs off the Northgate
// grid's east end). Streets: the causeway road (z=−248), one
// north–south street (x=84) and one cross street (z=−216).
// HONEST SCOPE: Eastmere is traffic-free by design — grid
// integration for a streamed area (lane state, density ranks,
// despawn rules) was the risky option; it has parked cars and
// ambient peds instead, and says so in the BLUEPRINT.
// ---------------------------------------------------------------------------
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { registerStreamedDistrict, type Blocker } from "../world";
import { eastmereState } from "../game/eastmere";
import { G } from "../game/store";
import CarBody from "./CarBody";
import { buildHumanoid, animateHumanoid, type HumanoidRig } from "../humanoid";
import { glowTexture } from "../textures";

// ---- district data -------------------------------------------------
const BLOCKERS: Blocker[] = [
  { x: 60, z: -272, hw: 6, hd: 5 },     // harbour flats W
  { x: 102, z: -272, hw: 6.5, hd: 5.5 },// harbour flats E (tall)
  { x: 63, z: -232, hw: 5.5, hd: 4.5 }, // chandlery
  { x: 100, z: -232, hw: 6, hd: 5 },    // sail loft
  { x: 62, z: -204, hw: 5, hd: 4 },     // net sheds W
  { x: 104, z: -204, hw: 5.5, hd: 4.5 },// net sheds E
  { x: 60, z: -258, hw: 3.5, hd: 2.5 }, // Eastmere Diner
  { x: 72, z: -288, hw: 4.5, hd: 4.5 }, // back-street block W
  { x: 96, z: -288, hw: 5, hd: 4.5 },   // back-street block E
  { x: 114, z: -290, hw: 1.6, hd: 1.6 },// Eastmere Light (lighthouse)
];
const BUILDINGS: { x: number; z: number; w: number; d: number; h: number; color: string }[] = [
  { x: 60, z: -272, w: 12, d: 10, h: 15, color: "#5b7a86" },
  { x: 102, z: -272, w: 13, d: 11, h: 19, color: "#4a6b74" },
  { x: 63, z: -232, w: 11, d: 9, h: 11, color: "#6d8a94" },
  { x: 100, z: -232, w: 12, d: 10, h: 16, color: "#54707c" },
  { x: 62, z: -204, w: 10, d: 8, h: 9, color: "#62808a" },
  { x: 104, z: -204, w: 11, d: 9, h: 12, color: "#4f7280" },
  { x: 72, z: -288, w: 9, d: 9, h: 10, color: "#5f7f8a" },
  { x: 96, z: -288, w: 10, d: 9, h: 14, color: "#486874" },
];
const PARKED: { x: number; z: number; heading: number; kind: "sedan" | "hatch" | "coupe" | "pickup"; color: string }[] = [
  { x: 56, z: -243, heading: Math.PI / 2, kind: "sedan", color: "#3f7d8c" },
  { x: 108, z: -252.5, heading: -Math.PI / 2, kind: "hatch", color: "#a8642c" },
  { x: 88, z: -220, heading: 0, kind: "coupe", color: "#31435c" },
  { x: 76, z: -200, heading: Math.PI / 2, kind: "pickup", color: "#5c6650" },
];
// ambient walkers: beat loops on the sidewalks + the lookout path
// (every beat verified clear of the blockers above)
const WALKERS: { beats: [number, number][]; top: string; bottom: string; skin: string; hair: string; gender: "m" | "f" }[] = [
  { beats: [[60, -242.5], [108, -242.5]], top: "#c96a2c", bottom: "#2b3440", skin: "#8d5524", hair: "#14100e", gender: "m" },
  { beats: [[50, -253.5], [100, -253.5]], top: "#2e6f79", bottom: "#3a3f45", skin: "#c68863", hair: "#2a1a10", gender: "f" },
  { beats: [[89.5, -262], [89.5, -230]], top: "#546e7a", bottom: "#232c38", skin: "#6e4423", hair: "#0e0c0a", gender: "m" },
  { beats: [[78.5, -240], [78.5, -270]], top: "#a8642c", bottom: "#2f3a33", skin: "#e8b08a", hair: "#4a2c14", gender: "f" },
  { beats: [[70, -211.5], [112, -210], [117, -197]], top: "#31556e", bottom: "#3d3428", skin: "#c68863", hair: "#1c1410", gender: "m" },
];

// register into the world (colliders + road lines + loaded flag)
registerStreamedDistrict("eastmere", { blockers: BLOCKERS, roadX: [84], roadZ: [-248, -216] });

// ---- procedural textures (canvas, like the rest of the game) -------
function facadeTexture(): THREE.Texture {
  const cv = document.createElement("canvas"); cv.width = 96; cv.height = 192;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#d8dee2"; g.fillRect(0, 0, 96, 192);
  let seed = 25;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) {
    g.fillStyle = rnd() > 0.72 ? "#ffb340" : "#2c3e46";
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

export default function EastmereWorld({ night }: { night: number }) {
  const facade = useMemo(facadeTexture, []);
  const dinerSign = useMemo(() => signTexture("EASTMERE DINER", "#ffcf7d", "#17323e"), []);
  const welcomeSign = useMemo(() => signTexture("EASTMERE", "#ffcf7d", "#17323e"), []);
  const lookoutSign = useMemo(() => signTexture("GULL ROCK LOOKOUT", "#e8ecef", "#3d2f1d"), []);
  const glow = useMemo(glowTexture, []);

  const walkers = useMemo<WalkerState[]>(() => WALKERS.map((w) => ({
    rig: buildHumanoid({ top: w.top, bottom: w.bottom, skin: w.skin, hair: w.hair, topStyle: "tee", gender: w.gender, hairStyle: w.gender === "f" ? "ponytail" : "crop" }),
    x: w.beats[0][0], z: w.beats[0][1], heading: 0, phase: Math.random() * 6, bi: 0, dir: 1 as const,
  })), []);
  const stateRef = useRef(walkers);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const px = G.followPos.x, pz = G.followPos.z;
    if (Math.abs(px - 83) > 170 || Math.abs(pz + 246) > 170) return; // far away: rest
    const t = performance.now() / 1000;
    for (let i = 0; i < stateRef.current.length; i++) {
      const s = stateRef.current[i];
      const w = WALKERS[i];
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
      <mesh position={[83, -0.5, -246]} receiveShadow><boxGeometry args={[78, 1, 108]} /><meshStandardMaterial color="#4d6a72" roughness={1} /></mesh>
      <mesh position={[43, -0.5, -248]} receiveShadow><boxGeometry args={[14, 1, 8]} /><meshStandardMaterial color="#5d737c" roughness={1} /></mesh>
      {/* causeway rails */}
      <mesh position={[43, 0.45, -244.3]}><boxGeometry args={[14, 0.5, 0.25]} /><meshStandardMaterial color="#9aa3a8" roughness={0.7} /></mesh>
      <mesh position={[43, 0.45, -251.7]}><boxGeometry args={[14, 0.5, 0.25]} /><meshStandardMaterial color="#9aa3a8" roughness={0.7} /></mesh>
      {/* roads + kerbs */}
      <mesh position={[83, 0.01, -248]} receiveShadow><boxGeometry args={[78, 0.02, 9]} /><meshStandardMaterial color="#2e3138" roughness={0.95} /></mesh>
      <mesh position={[43, 0.01, -248]} receiveShadow><boxGeometry args={[14, 0.02, 9]} /><meshStandardMaterial color="#2e3138" roughness={0.95} /></mesh>
      <mesh position={[84, 0.01, -246]} receiveShadow><boxGeometry args={[9, 0.02, 108]} /><meshStandardMaterial color="#2e3138" roughness={0.95} /></mesh>
      <mesh position={[83, 0.01, -216]} receiveShadow><boxGeometry args={[78, 0.02, 9]} /><meshStandardMaterial color="#2e3138" roughness={0.95} /></mesh>
      <mesh position={[83, 0.015, -253.2]}><boxGeometry args={[78, 0.03, 1.2]} /><meshStandardMaterial color="#9aa3a8" roughness={1} /></mesh>
      <mesh position={[83, 0.015, -242.8]}><boxGeometry args={[78, 0.03, 1.2]} /><meshStandardMaterial color="#9aa3a8" roughness={1} /></mesh>
      {/* welcome sign at the causeway's east end, facing arrivals */}
      <group position={[47, 0, -254.5]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, 1.5, 0]}><boxGeometry args={[0.18, 3, 0.18]} /><meshStandardMaterial color="#3d2f1d" roughness={0.9} /></mesh>
        <mesh position={[0, 2.9, 0]}><planeGeometry args={[4.6, 0.9]} /><meshStandardMaterial map={welcomeSign} emissive="#ffffff" emissiveMap={welcomeSign} emissiveIntensity={0.15 + night * 0.6} /></mesh>
      </group>
      {/* buildings */}
      {BUILDINGS.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]} castShadow receiveShadow>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial map={facade} color={b.color} roughness={0.85} />
        </mesh>
      ))}
      {/* the diner: low block + amber sign + awning */}
      <group position={[60, 0, -258]}>
        <mesh position={[0, 2.5, 0]} castShadow receiveShadow><boxGeometry args={[7, 5, 5]} /><meshStandardMaterial color="#7d8f96" roughness={0.85} /></mesh>
        <mesh position={[0, 3.6, 2.56]}><planeGeometry args={[6.4, 1.1]} /><meshStandardMaterial map={dinerSign} emissive="#ffffff" emissiveMap={dinerSign} emissiveIntensity={0.2 + night * 0.8} /></mesh>
        <mesh position={[0, 2.55, 3.1]}><boxGeometry args={[7.4, 0.15, 1.6]} /><meshStandardMaterial color="#c97b2d" roughness={0.8} /></mesh>
      </group>
      {/* Eastmere Light — the lighthouse on the back-street corner */}
      <group position={[114, 0, -290]}>
        <mesh position={[0, 4.5, 0]} castShadow><cylinderGeometry args={[1.3, 1.7, 9, 10]} /><meshStandardMaterial color="#e8ecef" roughness={0.7} /></mesh>
        <mesh position={[0, 3.1, 0]}><cylinderGeometry args={[1.48, 1.58, 1.6, 10]} /><meshStandardMaterial color="#2e6f79" roughness={0.7} /></mesh>
        <mesh position={[0, 6.9, 0]}><cylinderGeometry args={[1.36, 1.44, 1.6, 10]} /><meshStandardMaterial color="#2e6f79" roughness={0.7} /></mesh>
        <mesh position={[0, 9.6, 0]}><cylinderGeometry args={[0.9, 0.9, 1.1, 8]} /><meshStandardMaterial color="#17323e" roughness={0.6} /></mesh>
        <mesh position={[0, 9.6, 0]}><sphereGeometry args={[0.45, 10, 8]} /><meshStandardMaterial color="#ffdf94" emissive="#ffdf94" emissiveIntensity={0.4 + night * 2.4} /></mesh>
        <sprite position={[0, 9.6, 0]} scale={[7, 7, 1]}>
          <spriteMaterial map={glow} color="#ffdf94" transparent opacity={night * 0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
      {/* Gull Rock Lookout — paved pad + sign at the SE corner */}
      <group position={[117, 0, -197]}>
        <mesh position={[0, 0.03, 0]} receiveShadow><boxGeometry args={[8, 0.06, 6]} /><meshStandardMaterial color="#8b8f8c" roughness={1} /></mesh>
        <mesh position={[3.6, 0.5, -2.6]}><boxGeometry args={[0.15, 1, 0.15]} /><meshStandardMaterial color="#3d2f1d" roughness={0.9} /></mesh>
        <mesh position={[3.6, 0.5, 2.6]}><boxGeometry args={[0.15, 1, 0.15]} /><meshStandardMaterial color="#3d2f1d" roughness={0.9} /></mesh>
        <mesh position={[3.6, 0.95, 0]}><boxGeometry args={[0.12, 0.12, 5.4]} /><meshStandardMaterial color="#3d2f1d" roughness={0.9} /></mesh>
        <group position={[-2.6, 0, 2.2]} rotation={[0, Math.PI * 0.78, 0]}>
          <mesh position={[0, 1, 0]}><boxGeometry args={[0.14, 2, 0.14]} /><meshStandardMaterial color="#3d2f1d" roughness={0.9} /></mesh>
          <mesh position={[0, 1.9, 0]}><planeGeometry args={[3.4, 0.62]} /><meshStandardMaterial map={lookoutSign} emissive="#ffffff" emissiveMap={lookoutSign} emissiveIntensity={0.1 + night * 0.4} /></mesh>
        </group>
      </group>
      {/* street lamps */}
      {[[52, -253.5], [110, -242.5], [89.5, -211.5], [78.5, -283]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 2.4, 0]}><cylinderGeometry args={[0.07, 0.09, 4.8, 6]} /><meshStandardMaterial color="#2b2f33" roughness={0.7} /></mesh>
          <mesh position={[0, 4.85, 0]}><sphereGeometry args={[0.22, 8, 6]} /><meshStandardMaterial color="#ffdf94" emissive="#ffdf94" emissiveIntensity={night * 2.2} /></mesh>
          <sprite position={[0, 4.85, 0]} scale={[3.4, 3.4, 1]}>
            <spriteMaterial map={glow} color="#ffdf94" transparent opacity={night * 0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      ))}
      {/* parked cars (decorative — the district is traffic-free) */}
      {PARKED.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation={[0, p.heading, 0]}>
          <CarBody kind={p.kind} color={p.color} />
        </group>
      ))}
      {/* ambient walkers */}
      {walkers.map((s, i) => <primitive key={i} object={s.rig.group} />)}
    </group>
  );
}

// the stub picks the component up from here (module side effect on
// chunk load — the eager bundle never imports this file statically)
eastmereState.World = EastmereWorld;
