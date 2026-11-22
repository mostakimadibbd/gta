// Harborfall — enterable interiors (Phase 3, Blueprint §1/§5): Lina's
// Garage + Club Solace. The rooms live in an offset pocket at z ≈ -175;
// walking through a door fades you across (teleport) and Player clamps
// movement to the room while G.interior is set. This component also runs
// ALL proximity interactions (doors + the mansion gate) and publishes
// the HUD prompt through G.promptText / G.interact.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { G, toast } from "../game/store";
import { pushPhoneMsg } from "../game/phone";
import { sfx } from "../game/audio";
import { GARAGE_EXT_DOOR, CLUB_EXT_DOOR, INTERIORS, MANSION_GATE, MANSION_PRICE } from "../world";
import CarBody from "./CarBody";
import { buildHumanoid, animateHumanoid, type HumanoidRig } from "../humanoid";
import { neonSignTexture } from "../textures";

function signTexture(text: string, bg: string, fg: string, w = 512): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = w; c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = bg; g.fillRect(0, 0, w, 96);
  g.fillStyle = fg; g.font = "bold 44px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, w / 2, 52);
  return new THREE.CanvasTexture(c);
}

const WALL_G = new THREE.MeshStandardMaterial({ color: "#4d4438", roughness: 0.9 });
const WALL_C = new THREE.MeshStandardMaterial({ color: "#14161d", roughness: 0.85 });
const FLOOR_G = new THREE.MeshStandardMaterial({ color: "#3c3f45", roughness: 0.6, metalness: 0.15 });
const FLOOR_C = new THREE.MeshStandardMaterial({ color: "#101216", roughness: 0.35, metalness: 0.3 });
const WOOD = new THREE.MeshStandardMaterial({ color: "#6d4c33", roughness: 0.85 });
const METAL = new THREE.MeshStandardMaterial({ color: "#8a929a", metalness: 0.65, roughness: 0.4 });

function RoomShell({ cx, cz, w, d, h, wall, floor, ceiling }: {
  cx: number; cz: number; w: number; d: number; h: number;
  wall: THREE.Material; floor: THREE.Material; ceiling?: boolean;
}) {
  const hw = w / 2, hd = d / 2;
  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, 0.02, 0]} receiveShadow><boxGeometry args={[w, 0.06, d]} /><primitive object={floor} attach="material" /></mesh>
      <mesh position={[0, h / 2, -hd]}><boxGeometry args={[w, h, 0.3]} /><primitive object={wall} attach="material" /></mesh>
      <mesh position={[0, h / 2, hd]}><boxGeometry args={[w, h, 0.3]} /><primitive object={wall} attach="material" /></mesh>
      <mesh position={[-hw, h / 2, 0]}><boxGeometry args={[0.3, h, d]} /><primitive object={wall} attach="material" /></mesh>
      <mesh position={[hw, h / 2, 0]}><boxGeometry args={[0.3, h, d]} /><primitive object={wall} attach="material" /></mesh>
      {ceiling && <mesh position={[0, h, 0]}><boxGeometry args={[w, 0.25, d]} /><primitive object={wall} attach="material" /></mesh>}
    </group>
  );
}

export default function Interiors() {
  const garageSign = useMemo(() => signTexture("LINA'S GARAGE", "#0f4442", "#ffca7a"), []);
  const clubNeon = useMemo(() => neonSignTexture("SOLACE", "#2ee6c8"), []);
  const beamMatA = useMemo(() => new THREE.MeshBasicMaterial({ color: "#2ee6c8", transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const beamMatB = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffb340", transparent: true, opacity: 0.11, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const beams = useRef<THREE.Group>(null);
  const dancers = useMemo<HumanoidRig[]>(() => [
    buildHumanoid({ top: "#b3312c", bottom: "#232c38", skin: "#f1c27d", hair: "#14100e", topStyle: "crop", bottomStyle: "shorts", gender: "f", hairStyle: "ponytail" }),
    buildHumanoid({ top: "#274268", bottom: "#1d2126", skin: "#8d5524", hair: "#20242a", topStyle: "tee", gender: "m", hairStyle: "flat" }),
    buildHumanoid({ top: "#e8e4da", bottom: "#40342a", skin: "#c68863", hair: "#4a2f1a", topStyle: "tank", gender: "f", hairStyle: "bun", necklace: true }),
    buildHumanoid({ top: "#1f7a72", bottom: "#2b3440", skin: "#6b4423", hair: "#14100e", topStyle: "hoodie", gender: "m", hairStyle: "cap", cap: "#101216" }),
  ], []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (beams.current) beams.current.rotation.y = t * 0.35;
    dancers.forEach((rig, i) => {
      animateHumanoid(rig, t * 2.2 + i * 1.7, 0.22, t + i);
      // arms up, swaying to the groove
      rig.lArm.rotation.x = -2.6 + Math.sin(t * 2.2 + i * 1.7) * 0.35;
      rig.rArm.rotation.x = -2.6 + Math.cos(t * 2.2 + i * 1.7) * 0.35;
      rig.group.position.y = Math.abs(Math.sin(t * 2.2 + i * 1.7)) * 0.05;
    });

    // ---------- proximity interactions ----------
    let prompt = ""; let warn = false; let act: (() => void) | null = null;
    if (!G.driving && !G.status && !G.dialogueActive) {
      const px = G.playerPos.x, pz = G.playerPos.z;
      const near = (x: number, z: number, r: number) => (px - x) ** 2 + (pz - z) ** 2 < r * r;
      const go = (x: number, z: number, interior: "" | "garage" | "club") => () => {
        G.playerPos.set(x, 0, z);
        G.followPos.set(x, 0, z);
        G.interior = interior;
        sfx.door();
      };
      if (G.interior === "garage") {
        const [x, z] = INTERIORS.garage.exitDoor;
        if (near(x, z, 2.2)) { prompt = "Press E — leave the garage"; act = go(GARAGE_EXT_DOOR.x, GARAGE_EXT_DOOR.z - 1.2, ""); }
      } else if (G.interior === "club") {
        const [x, z] = INTERIORS.club.exitDoor;
        if (near(x, z, 2.2)) { prompt = "Press E — leave Club Solace"; act = go(CLUB_EXT_DOOR.x, CLUB_EXT_DOOR.z - 1.2, ""); }
      } else if (near(GARAGE_EXT_DOOR.x, GARAGE_EXT_DOOR.z, 2.8)) {
        prompt = "Press E — enter Lina's Garage";
        act = go(INTERIORS.garage.spawnIn[0], INTERIORS.garage.spawnIn[1], "garage");
      } else if (near(CLUB_EXT_DOOR.x, CLUB_EXT_DOOR.z, 2.8)) {
        prompt = "Press E — enter Club Solace";
        act = go(INTERIORS.club.spawnIn[0], INTERIORS.club.spawnIn[1], "club");
      } else if (near(MANSION_GATE.x, MANSION_GATE.z, 3.2)) {
        if (G.ownsMansion) prompt = "🏠 Sable Heights Villa — your home. Park in the drive to garage-save a car.";
        else if (G.cash >= MANSION_PRICE) {
          prompt = `Press E — buy Sable Heights Villa ($${MANSION_PRICE.toLocaleString()})`;
          act = () => {
            G.cash -= MANSION_PRICE;
            G.ownsMansion = true;
            try { localStorage.setItem("harborfall-mansion", "1"); } catch { /* ignore */ }
            pushPhoneMsg("SableBank", `🏠 -$${MANSION_PRICE.toLocaleString()} — Sable Heights Villa purchased. Welcome home, Rayan.`);
            toast("🏠 You bought Sable Heights Villa! Respawns + garage parking are yours now.");
            sfx.cash();
          };
        } else { prompt = `Sable Heights Villa — $${MANSION_PRICE.toLocaleString()} (you have $${G.cash.toLocaleString()})`; warn = true; }
      }
    }
    G.promptText = prompt; G.promptWarn = warn; G.interact = act;
  });

  const G0 = INTERIORS.garage, C0 = INTERIORS.club;
  return (
    <group>
      {/* ================= LINA'S GARAGE — interior ================= */}
      <RoomShell cx={G0.cx} cz={G0.cz} w={G0.w} d={G0.d} h={3.6} wall={WALL_G} floor={FLOOR_G} ceiling />
      <group position={[G0.cx, 0, G0.cz]}>
        <pointLight position={[0, 3.1, 0]} intensity={26} distance={17} decay={1.7} color="#ffd9a0" />
        {/* roller door on the south wall (the way in/out) */}
        <mesh position={[0, 1.5, G0.d / 2 - 0.12]}><boxGeometry args={[4.6, 3, 0.1]} /><meshStandardMaterial color="#7d8894" metalness={0.55} roughness={0.45} /></mesh>
        {[-1.8, -0.9, 0, 0.9, 1.8].map((y) => (
          <mesh key={y} position={[0, 1.5 + y * 0.62, G0.d / 2 - 0.06]}><boxGeometry args={[4.6, 0.05, 0.04]} /><meshStandardMaterial color="#59616a" metalness={0.5} roughness={0.5} /></mesh>
        ))}
        {/* car lift with a sedan up on it */}
        <group position={[-4.6, 0, -1.5]} rotation={[0, 0.12, 0]}>
          {[-1.7, 1.7].map((x) => <mesh key={x} position={[x, 0.95, 0]} castShadow><boxGeometry args={[0.28, 1.9, 0.5]} /><primitive object={METAL} attach="material" /></mesh>)}
          <mesh position={[0, 0.55, 0]}><boxGeometry args={[4.1, 0.12, 1.9]} /><primitive object={METAL} attach="material" /></mesh>
          <group position={[0, 0.62, 0]}><CarBody kind="sedan" color="#3f7fae" /></group>
        </group>
        {/* workbench + tool wall */}
        <group position={[5.9, 0, -4.6]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh position={[0, 0.85, 0]} castShadow><boxGeometry args={[4.6, 0.12, 1]} /><primitive object={WOOD} attach="material" /></mesh>
          {[-2, 2].map((x) => <mesh key={x} position={[x, 0.42, 0]}><boxGeometry args={[0.14, 0.85, 0.85]} /><primitive object={WOOD} attach="material" /></mesh>)}
          <mesh position={[0, 2, -0.5]}><boxGeometry args={[4.6, 1.7, 0.08]} /><meshStandardMaterial color="#5d4a38" roughness={0.95} /></mesh>
          {[-1.7, -0.9, -0.1, 0.8, 1.6].map((x, i) => (
            <mesh key={i} position={[x, 1.7 + (i % 2) * 0.5, -0.44]}><boxGeometry args={[0.1, 0.5, 0.06]} /><meshStandardMaterial color={["#c22e2e", "#8a929a", "#d99a3d", "#3f7fae", "#39b56a"][i]} metalness={0.5} roughness={0.4} /></mesh>
          ))}
          {[-1.2, 0.3, 1.4].map((x, i) => (
            <mesh key={i} position={[x, 0.98, 0.15]} castShadow><boxGeometry args={[0.5, 0.24, 0.4]} /><meshStandardMaterial color={["#7a1f1f", "#274268", "#4c3b28"][i]} roughness={0.6} /></mesh>
          ))}
        </group>
        {/* shelves with crates + tyres */}
        <group position={[-7.9, 0, 2.5]} rotation={[0, Math.PI / 2, 0]}>
          {[0.6, 1.5, 2.4].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[4.4, 0.08, 0.8]} /><primitive object={METAL} attach="material" /></mesh>)}
          {[-1.6, -0.4, 0.9].map((x, i) => <mesh key={i} position={[x, 0.95, 0]} castShadow><boxGeometry args={[0.8, 0.6, 0.6]} /><meshStandardMaterial color={["#a3764f", "#6a7076", "#7a4a2b"][i]} roughness={0.9} /></mesh>)}
          {[-1.2, 0.6, 1.7].map((x, i) => <mesh key={i} position={[x, 1.85, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.3, 0.3, 0.2, 12]} /><meshStandardMaterial color="#17181a" roughness={0.95} /></mesh>)}
        </group>
        {/* neon sign + warm wall lamp */}
        <mesh position={[0, 2.6, -G0.d / 2 + 0.2]}>
          <planeGeometry args={[6.4, 1.2]} />
          <meshStandardMaterial map={garageSign} emissive="#ffffff" emissiveMap={garageSign} emissiveIntensity={1.1} />
        </mesh>
        <mesh position={[3.4, 1, 3.4]} castShadow><boxGeometry args={[0.9, 0.65, 0.9]} /><meshStandardMaterial color="#b3402e" metalness={0.4} roughness={0.5} /></mesh>
      </group>

      {/* ================= CLUB SOLACE — interior ================= */}
      <RoomShell cx={C0.cx} cz={C0.cz} w={C0.w} d={C0.d} h={4.4} wall={WALL_C} floor={FLOOR_C} ceiling />
      <group position={[C0.cx, 0, C0.cz]}>
        <pointLight position={[0, 3.6, 0]} intensity={15} distance={19} decay={1.8} color="#7fd8e8" />
        {/* stage (north end) + backdrop neon */}
        <mesh position={[0, 0.35, -5.6]} receiveShadow><boxGeometry args={[10, 0.7, 3.2]} /><meshStandardMaterial color="#1d2129" roughness={0.5} /></mesh>
        <mesh position={[0, 2.6, -C0.d / 2 + 0.2]}>
          <planeGeometry args={[1.05, 4.2]} />
          <meshStandardMaterial map={clubNeon} emissive="#ffffff" emissiveMap={clubNeon} emissiveIntensity={1.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.75, -5.4]}><boxGeometry args={[1.4, 0.1, 1]} /><meshStandardMaterial color="#22262e" roughness={0.4} /></mesh>
        {/* sweeping light beams from the stage corners */}
        <group ref={beams} position={[0, 0.7, -5.6]}>
          {[-4.2, 4.2].map((x, i) => (
            <mesh key={i} position={[x, 2, 4.6]} rotation={[0.72, 0, i === 0 ? -0.3 : 0.3]}>
              <coneGeometry args={[1.7, 7.6, 14, 1, true]} />
              <primitive object={i === 0 ? beamMatA : beamMatB} attach="material" />
            </mesh>
          ))}
        </group>
        {/* bar counter (west) + stools + bottles */}
        <group position={[-8.6, 0, 0.5]} rotation={[0, Math.PI / 2, 0]}>
          <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[6.4, 1.1, 0.9]} /><meshStandardMaterial color="#232830" roughness={0.35} metalness={0.3} /></mesh>
          <mesh position={[0, 1.14, 0]}><boxGeometry args={[6.6, 0.07, 1.05]} /><meshStandardMaterial color="#3d2c1c" roughness={0.3} /></mesh>
          <mesh position={[0, 1.9, -0.42]}><boxGeometry args={[6.2, 1.5, 0.06]} /><meshStandardMaterial color="#ffe9a8" emissive="#ffca7a" emissiveIntensity={0.5} /></mesh>
          {[-2.4, -1.2, 0, 1.2, 2.4].map((x) => (
            <group key={x} position={[x, 0, 0.95]}>
              <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.05, 0.05, 0.8, 6]} /><primitive object={METAL} attach="material" /></mesh>
              <mesh position={[0, 0.84, 0]} castShadow><cylinderGeometry args={[0.26, 0.26, 0.09, 12]} /><meshStandardMaterial color="#7a2440" roughness={0.6} /></mesh>
            </group>
          ))}
          {[-2.2, -0.7, 0.9, 2.1].map((x, i) => (
            <mesh key={i} position={[x, 1.32, 0.1]}><cylinderGeometry args={[0.05, 0.06, 0.3, 6]} /><meshStandardMaterial color={["#39b56a", "#d99a3d", "#3f7fae", "#c22e2e"][i]} roughness={0.2} metalness={0.2} /></mesh>
          ))}
        </group>
        {/* dance floor inlay + dancers */}
        <mesh position={[0.5, 0.05, -0.5]} receiveShadow><boxGeometry args={[8.5, 0.03, 6]} /><meshStandardMaterial color="#1b2a33" roughness={0.15} metalness={0.5} /></mesh>
        {dancers.map((rig, i) => (
          <group key={i} position={[-1 + (i % 2) * 2.4, 0, -2 + Math.floor(i / 2) * 2.6]} rotation={[0, i * 1.9, 0]}>
            <primitive object={rig.group} />
          </group>
        ))}
        {/* exit door glow on the south wall */}
        <mesh position={[0, 1.4, C0.d / 2 - 0.12]}><boxGeometry args={[1.7, 2.8, 0.08]} /><meshStandardMaterial color="#0b0d10" emissive="#2ee6c8" emissiveIntensity={0.35} /></mesh>
      </group>
      {/* garage exit door visual (south wall, inside) */}
      <mesh position={[G0.cx, 1.4, G0.cz + G0.d / 2 - 0.12]}><boxGeometry args={[1.7, 2.8, 0.08]} /><meshStandardMaterial color="#20242a" emissive="#ffca7a" emissiveIntensity={0.3} /></mesh>
    </group>
  );
}
