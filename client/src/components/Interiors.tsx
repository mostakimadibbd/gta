// Harborfall — enterable interiors (Phase 3, Blueprint §1/§5): Lina's
// Garage + Club Solace. The rooms live in an offset pocket at z ≈ -175;
// walking through a door fades you across (teleport) and Player clamps
// movement to the room while G.interior is set. This component also runs
// ALL proximity interactions (doors + the mansion gate) and publishes
// the HUD prompt through G.promptText / G.interact.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { G, toast, nowS, bark } from "../game/store";
import { pushPhoneMsg } from "../game/phone";
import { sfx } from "../game/audio";
import { GARAGE_EXT_DOOR, CLUB_EXT_DOOR, POLICE_EXT_DOOR, CLINIC_EXT_DOOR, RESTAURANT_EXT_DOOR, INTERIORS, MANSION_GATE, MANSION_PRICE, type InteriorKind } from "../world";
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

const WALL_P = new THREE.MeshStandardMaterial({ color: "#3d4a5c", roughness: 0.9 });
const WALL_CL = new THREE.MeshStandardMaterial({ color: "#cfd6d4", roughness: 0.85 });
const WALL_R = new THREE.MeshStandardMaterial({ color: "#4a3527", roughness: 0.9 });
const FLOOR_P = new THREE.MeshStandardMaterial({ color: "#2e3540", roughness: 0.55, metalness: 0.1 });
const FLOOR_CL = new THREE.MeshStandardMaterial({ color: "#9fb3ae", roughness: 0.4 });
const FLOOR_R = new THREE.MeshStandardMaterial({ color: "#2b2019", roughness: 0.7 });

/** Wanted-poster wall art (canvas): three harbour faces, drawn not copied. */
function posterTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#e8e2d4"; g.fillRect(0, 0, 512, 256);
  g.fillStyle = "#7a1f1f"; g.fillRect(0, 0, 512, 44);
  g.fillStyle = "#fff"; g.font = "bold 26px sans-serif"; g.textAlign = "center";
  g.fillText("HARBOUR PATROL — WANTED", 256, 31);
  for (let i = 0; i < 3; i++) {
    const x = 40 + i * 160;
    g.fillStyle = "#d8d2c2"; g.fillRect(x, 60, 130, 130);
    g.fillStyle = "#8a6f52"; g.beginPath(); g.arc(x + 65, 105, 26, 0, Math.PI * 2); g.fill();
    g.fillRect(x + 30, 128, 70, 55);
    g.fillStyle = "#222"; g.font = "bold 15px sans-serif";
    g.fillText(["SOLANO, V.", "“THE LEDGER”", "UNKNOWN"][i], x + 65, 215);
    g.font = "12px sans-serif"; g.fillText(["REWARD $5,000", "REWARD $2,500", "DO NOT APPROACH"][i], x + 65, 236);
  }
  return new THREE.CanvasTexture(c);
}

export default function Interiors() {
  const garageSign = useMemo(() => signTexture("LINA'S GARAGE", "#0f4442", "#ffca7a"), []);
  const policeSign = useMemo(() => signTexture("HARBOUR PATROL", "#1c2f4a", "#cfe0f2"), []);
  const clinicSign = useMemo(() => signTexture("SABLE CLINIC", "#eef2f0", "#c22e2e"), []);
  const restSign = useMemo(() => signTexture("MARINA TABLE", "#241a12", "#ffca7a"), []);
  const posters = useMemo(() => posterTexture(), []);
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

  // Phase 6 screen flow: door teleports are DELAYED ~130 ms behind a
  // fade-to-black (App watches G.fadeAt) so entering a room reads as a
  // transition, not a pop.
  const pendingGo = useRef<{ x: number; z: number; interior: "" | InteriorKind; at: number } | null>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (pendingGo.current && t >= pendingGo.current.at) {
      const pg = pendingGo.current;
      pendingGo.current = null;
      G.playerPos.set(pg.x, 0, pg.z);
      G.followPos.set(pg.x, 0, pg.z);
      G.interior = pg.interior;
    }
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
      const go = (x: number, z: number, interior: "" | InteriorKind) => () => {
        G.fadeAt = nowS(); // App fades to black…
        sfx.door();
        pendingGo.current = { x, z, interior, at: t + 0.13 }; // …teleport lands mid-fade
      };
      if (G.interior === "garage") {
        const [x, z] = INTERIORS.garage.exitDoor;
        if (near(x, z, 2.2)) { prompt = "Press E — leave the garage"; act = go(GARAGE_EXT_DOOR.x, GARAGE_EXT_DOOR.z - 1.2, ""); }
      } else if (G.interior === "club") {
        const [x, z] = INTERIORS.club.exitDoor;
        if (near(x, z, 2.2)) { prompt = "Press E — leave Club Solace"; act = go(CLUB_EXT_DOOR.x, CLUB_EXT_DOOR.z - 1.2, ""); }
      } else if (G.interior === "police") {
        // ---- Phase 7: Harbour Patrol HQ lobby — exit + the desk
        // surrender point (same outcome as hold-B on the street) ----
        const [x, z] = INTERIORS.police.exitDoor;
        const P = INTERIORS.police;
        if (near(x, z, 2.2)) { prompt = "Press E — leave Harbour Patrol HQ"; act = go(POLICE_EXT_DOOR.x, POLICE_EXT_DOOR.z - 1.2, ""); }
        else if (near(P.cx, P.cz - 2.6, 2.4)) {
          if (G.wanted === 1) {
            prompt = "Press E — surrender at the desk (pay the $100 fine, walk out clean)";
            act = () => {
              const fine = Math.min(100, G.cash);
              G.finesPaid += fine; G.cash -= fine;
              G.wanted = 0; G.wantedCooldown = 0; G.bustTimer = 0;
              for (const c of G.cops) c.active = false;
              toast("You surrendered at the desk — fined $100. The sergeant stamps the form without looking up.");
              bark("Desk Sergeant", "Fine paid. Don't make a habit of it, Kade.");
              sfx.click();
            };
          } else if (G.wanted > 1) { prompt = "The desk sergeant shakes his head — you're too hot to surrender. Lose the patrol first."; warn = true; }
          else prompt = "Harbour Patrol front desk — wanted posters on the wall, cells behind. You're clean today.";
        }
      } else if (G.interior === "clinic") {
        const [x, z] = INTERIORS.clinic.exitDoor;
        const C = INTERIORS.clinic;
        if (near(x, z, 2.2)) { prompt = "Press E — leave Sable Clinic"; act = go(CLINIC_EXT_DOOR.x, CLINIC_EXT_DOOR.z - 1.2, ""); }
        else if (near(C.cx, C.cz - 2.2, 2.2)) {
          if (G.health >= 99.5) prompt = "Sable Clinic — you're fully patched up already.";
          else if (G.cash >= 50) {
            prompt = "Press E — clinic treatment ($50, full heal)";
            act = () => { G.cash -= 50; G.health = 100; sfx.cash(); toast("The clinic patches you up — full health for $50."); };
          } else { prompt = "Clinic treatment is $50 — you're short."; warn = true; }
        }
      } else if (G.interior === "restaurant") {
        const [x, z] = INTERIORS.restaurant.exitDoor;
        const R = INTERIORS.restaurant;
        if (near(x, z, 2.2)) { prompt = "Press E — leave Marina Table"; act = go(RESTAURANT_EXT_DOOR.x, RESTAURANT_EXT_DOOR.z - 1.2, ""); }
        else if (near(R.cx - 3.4, R.cz + 0.4, 2.1) || near(R.cx + 3.4, R.cz + 0.4, 2.1)) {
          // sit at a table — E stands back up (or any movement key)
          if (G.sitting) { prompt = "Press E — stand up"; act = () => { G.sitting = false; G.sitSpot = null; }; }
          else {
            prompt = "Press E — sit at the table";
            act = () => { G.sitting = true; G.sitSpot = { x: px, z: pz, heading: G.playerHeading }; sfx.click(); };
          }
        } else if (near(R.cx, R.cz - 3.4, 2.4)) {
          if (G.cash >= 25) {
            prompt = "Press E — the Marina Table set menu ($25 — full heal + stamina boost)";
            act = () => {
              G.cash -= 25; G.health = 100; G.stamina = 100; G.staminaBoostUntil = G.timeS + 180;
              G.eatingUntil = G.timeS + 2.2; sfx.eat();
              toast("Grilled harbour fish, citrus rice, strong coffee — full health, and stamina drains half as fast for a while.");
            };
          } else { prompt = "The set menu is $25 — you're short."; warn = true; }
        }
      } else if (near(GARAGE_EXT_DOOR.x, GARAGE_EXT_DOOR.z, 2.8)) {
        prompt = "Press E — enter Lina's Garage";
        act = go(INTERIORS.garage.spawnIn[0], INTERIORS.garage.spawnIn[1], "garage");
      } else if (near(CLUB_EXT_DOOR.x, CLUB_EXT_DOOR.z, 2.8)) {
        prompt = "Press E — enter Club Solace";
        act = go(INTERIORS.club.spawnIn[0], INTERIORS.club.spawnIn[1], "club");
      } else if (near(POLICE_EXT_DOOR.x, POLICE_EXT_DOOR.z, 2.8)) {
        prompt = "Press E — enter Harbour Patrol HQ";
        act = go(INTERIORS.police.spawnIn[0], INTERIORS.police.spawnIn[1], "police");
      } else if (near(CLINIC_EXT_DOOR.x, CLINIC_EXT_DOOR.z, 2.8)) {
        prompt = "Press E — enter Sable Clinic";
        act = go(INTERIORS.clinic.spawnIn[0], INTERIORS.clinic.spawnIn[1], "clinic");
      } else if (near(RESTAURANT_EXT_DOOR.x, RESTAURANT_EXT_DOOR.z, 2.8)) {
        prompt = "Press E — enter Marina Table restaurant";
        act = go(INTERIORS.restaurant.spawnIn[0], INTERIORS.restaurant.spawnIn[1], "restaurant");
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
  const P0 = INTERIORS.police, CL0 = INTERIORS.clinic, R0 = INTERIORS.restaurant;
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

      {/* ================= Phase 7: HARBOUR PATROL HQ — lobby ============ */}
      <RoomShell cx={P0.cx} cz={P0.cz} w={P0.w} d={P0.d} h={3.8} wall={WALL_P} floor={FLOOR_P} ceiling />
      <group position={[P0.cx, 0, P0.cz]}>
        <pointLight position={[0, 3.2, 0]} intensity={24} distance={18} decay={1.7} color="#dfe9f5" />
        <mesh position={[0, 2.7, -P0.d / 2 + 0.2]}>
          <planeGeometry args={[6.4, 1.2]} />
          <meshStandardMaterial map={policeSign} emissive="#ffffff" emissiveMap={policeSign} emissiveIntensity={0.9} />
        </mesh>
        {/* front desk counter (surrender point) */}
        <mesh position={[0, 0.55, -2.6]} castShadow><boxGeometry args={[6.4, 1.1, 0.9]} /><meshStandardMaterial color="#2c3644" roughness={0.4} /></mesh>
        <mesh position={[0, 1.14, -2.6]}><boxGeometry args={[6.6, 0.07, 1.05]} /><primitive object={WOOD} attach="material" /></mesh>
        <mesh position={[0, 0.35, -2.6]}><boxGeometry args={[5.6, 0.1, 0.06]} /><meshStandardMaterial color="#c8a24a" metalness={0.7} roughness={0.3} /></mesh>
        {/* wanted-poster wall (east) */}
        <mesh position={[P0.w / 2 - 0.2, 1.9, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[7, 3.5]} />
          <meshStandardMaterial map={posters} roughness={0.9} />
        </mesh>
        {/* cell bars (west end) */}
        {[-3.4, -2.6, -1.8, -1.0, -0.2, 0.6].map((dz) => (
          <mesh key={dz} position={[-P0.w / 2 + 1.6, 1.5, dz]}><cylinderGeometry args={[0.045, 0.045, 3, 6]} /><primitive object={METAL} attach="material" /></mesh>
        ))}
        <mesh position={[-P0.w / 2 + 1.6, 2.9, -1.4]}><boxGeometry args={[0.08, 0.12, 4.6]} /><primitive object={METAL} attach="material" /></mesh>
        <mesh position={[-P0.w / 2 + 0.9, 0.45, -1.4]} castShadow><boxGeometry args={[1.2, 0.25, 3.4]} /><meshStandardMaterial color="#39424e" roughness={0.8} /></mesh>
        {/* waiting bench + flag stripe */}
        <mesh position={[3.4, 0.5, 3.4]} castShadow><boxGeometry args={[3.4, 0.12, 0.6]} /><primitive object={WOOD} attach="material" /></mesh>
        <mesh position={[0, 3.1, -P0.d / 2 + 0.16]}><boxGeometry args={[P0.w - 1, 0.22, 0.02]} /><meshStandardMaterial color="#c22e2e" roughness={0.6} /></mesh>
        <mesh position={[0, 1.4, P0.d / 2 - 0.12]}><boxGeometry args={[1.7, 2.8, 0.08]} /><meshStandardMaterial color="#141a22" emissive="#7fb2e8" emissiveIntensity={0.3} /></mesh>
      </group>

      {/* ================= Phase 7: SABLE CLINIC ========================= */}
      <RoomShell cx={CL0.cx} cz={CL0.cz} w={CL0.w} d={CL0.d} h={3.4} wall={WALL_CL} floor={FLOOR_CL} ceiling />
      <group position={[CL0.cx, 0, CL0.cz]}>
        <pointLight position={[0, 2.9, 0]} intensity={22} distance={15} decay={1.7} color="#f2f7f4" />
        <mesh position={[0, 2.5, -CL0.d / 2 + 0.2]}>
          <planeGeometry args={[5.4, 1]} />
          <meshStandardMaterial map={clinicSign} emissive="#ffffff" emissiveMap={clinicSign} emissiveIntensity={0.7} />
        </mesh>
        {/* reception desk (heal point) */}
        <mesh position={[0, 0.55, -2.2]} castShadow><boxGeometry args={[4.6, 1.1, 0.9]} /><meshStandardMaterial color="#e8ecea" roughness={0.35} /></mesh>
        <mesh position={[0, 1.5, -3.4]}><boxGeometry args={[0.5, 0.14, 0.14]} /><meshStandardMaterial color="#c22e2e" roughness={0.5} /></mesh>
        <mesh position={[0, 1.5, -3.4]}><boxGeometry args={[0.14, 0.5, 0.14]} /><meshStandardMaterial color="#c22e2e" roughness={0.5} /></mesh>
        {/* waiting chairs */}
        {[-3.4, -2.2, 2.2, 3.4].map((x) => (
          <group key={x} position={[x, 0, 2.6]}>
            <mesh position={[0, 0.48, 0]} castShadow><boxGeometry args={[0.55, 0.08, 0.5]} /><meshStandardMaterial color="#3f7fae" roughness={0.6} /></mesh>
            <mesh position={[0, 0.85, -0.24]}><boxGeometry args={[0.55, 0.8, 0.08]} /><meshStandardMaterial color="#3f7fae" roughness={0.6} /></mesh>
            <mesh position={[0, 0.24, 0]}><boxGeometry args={[0.08, 0.48, 0.08]} /><primitive object={METAL} attach="material" /></mesh>
          </group>
        ))}
        {/* exam bed + cabinet */}
        <group position={[-5.4, 0, -2.6]} rotation={[0, 0.5, 0]}>
          <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[2.2, 0.25, 0.9]} /><meshStandardMaterial color="#eef2f0" roughness={0.5} /></mesh>
          <mesh position={[0, 0.95, -0.2]}><boxGeometry args={[0.7, 0.12, 0.6]} /><meshStandardMaterial color="#ffffff" roughness={0.6} /></mesh>
        </group>
        <mesh position={[5.6, 1.1, -3.6]} castShadow><boxGeometry args={[1.6, 2.2, 0.6]} /><meshStandardMaterial color="#b9c4c0" metalness={0.3} roughness={0.5} /></mesh>
        <mesh position={[0, 1.4, CL0.d / 2 - 0.12]}><boxGeometry args={[1.7, 2.8, 0.08]} /><meshStandardMaterial color="#dfe5e2" emissive="#7fd8a8" emissiveIntensity={0.25} /></mesh>
      </group>

      {/* ================= Phase 7: MARINA TABLE — restaurant ============ */}
      <RoomShell cx={R0.cx} cz={R0.cz} w={R0.w} d={R0.d} h={3.6} wall={WALL_R} floor={FLOOR_R} ceiling />
      <group position={[R0.cx, 0, R0.cz]}>
        <pointLight position={[0, 2.9, 0]} intensity={20} distance={16} decay={1.7} color="#ffca7a" />
        <pointLight position={[-5, 2.4, 2]} intensity={7} distance={8} decay={1.8} color="#ffb37f" />
        <pointLight position={[5, 2.4, 2]} intensity={7} distance={8} decay={1.8} color="#ffb37f" />
        <mesh position={[0, 2.6, -R0.d / 2 + 0.2]}>
          <planeGeometry args={[6, 1.1]} />
          <meshStandardMaterial map={restSign} emissive="#ffffff" emissiveMap={restSign} emissiveIntensity={1} />
        </mesh>
        {/* counter (meal point) */}
        <mesh position={[0, 0.55, -3.4]} castShadow><boxGeometry args={[5.6, 1.1, 0.9]} /><meshStandardMaterial color="#3a2a1c" roughness={0.35} /></mesh>
        <mesh position={[0, 1.14, -3.4]}><boxGeometry args={[5.8, 0.07, 1.05]} /><meshStandardMaterial color="#6d4c33" roughness={0.3} /></mesh>
        {[-1.8, 0, 1.8].map((x, i) => (
          <mesh key={i} position={[x, 1.36, -3.3]}><cylinderGeometry args={[0.16, 0.16, 0.05, 12]} /><meshStandardMaterial color="#e8e4da" roughness={0.4} /></mesh>
        ))}
        {/* two dining tables with chairs (sit points) */}
        {[-3.4, 3.4].map((tx) => (
          <group key={tx} position={[tx, 0, 0.4]}>
            <mesh position={[0, 0.74, 0]} castShadow><cylinderGeometry args={[0.85, 0.85, 0.07, 16]} /><meshStandardMaterial color="#e8e0d0" roughness={0.4} /></mesh>
            <mesh position={[0, 0.37, 0]}><cylinderGeometry args={[0.07, 0.07, 0.74, 8]} /><primitive object={METAL} attach="material" /></mesh>
            {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a, i) => (
              <group key={i} position={[Math.sin(a) * 1.25, 0, Math.cos(a) * 1.25]} rotation={[0, a + Math.PI, 0]}>
                <mesh position={[0, 0.46, 0]} castShadow><boxGeometry args={[0.5, 0.07, 0.46]} /><primitive object={WOOD} attach="material" /></mesh>
                <mesh position={[0, 0.8, -0.22]}><boxGeometry args={[0.5, 0.7, 0.07]} /><primitive object={WOOD} attach="material" /></mesh>
              </group>
            ))}
            <mesh position={[0.3, 0.82, 0.2]}><cylinderGeometry args={[0.13, 0.13, 0.04, 10]} /><meshStandardMaterial color="#ffffff" roughness={0.35} /></mesh>
            <mesh position={[-0.25, 0.84, -0.15]}><cylinderGeometry args={[0.05, 0.06, 0.14, 8]} /><meshStandardMaterial color="#7a4a2b" roughness={0.3} /></mesh>
          </group>
        ))}
        {/* window glow strip + exit */}
        <mesh position={[0, 2, R0.d / 2 - 0.16]}><boxGeometry args={[10, 1.4, 0.03]} /><meshStandardMaterial color="#ffd9a0" emissive="#ffca7a" emissiveIntensity={0.35} transparent opacity={0.85} /></mesh>
        <mesh position={[0, 1.4, R0.d / 2 - 0.12]}><boxGeometry args={[1.7, 2.8, 0.08]} /><meshStandardMaterial color="#1d140d" emissive="#ffca7a" emissiveIntensity={0.3} /></mesh>
      </group>
    </group>
  );
}
