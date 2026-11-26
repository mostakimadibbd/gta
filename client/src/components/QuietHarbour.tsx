// Harborfall — Phase 37: THE QUIET HARBOUR (world presence).
//
// The 3D half of the post-story arc II (game/missions.ts, side key
// "quiet"). Three kinds of presence, all derived from mission state
// — no new save keys anywhere:
//
//   FIGURES — Old Elias stands at the pier while quiet1 is live;
//   Lina Park waits at her garage during quiet2's pickup step and
//   again at Northreach Point for its closing beat; Elias and Tamim
//   wait beside the Coral Shores bench while quiet3 is live. Named
//   rigs on the StaffWorld/Eastmere pattern (buildHumanoid + a
//   floating name label inside 42u), standing idle — the arc is
//   carried by its subtitle dialogue, not by new NPC simulation.
//   Lina's ride itself uses the taxi passenger convention honestly:
//   there is no in-car passenger mesh for anyone in this game, so
//   en route she is subtitle barks (GameSystems), exactly like a
//   Chatty taxi passenger.
//
//   THE PLAQUE — once quiet3 completes (M.side.quiet >= 3, the
//   persisted per-slot side record), a small brass plaque stands at
//   the Coral bench: "For the ones who stayed." It renders from the
//   side record alone, so it survives reloads with the save, and
//   NG+ — which resets the arc — takes it away again. The bench
//   itself is permanent world furniture (world.ts props).
//
// Figure spots are placement-audited (tools/audit-entry.ts §9) —
// keep the literals there in sync with the ones below.
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { G } from "../game/store";
import { M } from "../game/missionState";
import { groundYAt } from "../world";
import { buildHumanoid, animateHumanoid, type HumanoidRig } from "../humanoid";

function nameTexture(name: string): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 256; c.height = 56;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(10,16,20,0.72)"; g.fillRect(0, 0, 256, 56);
  g.fillStyle = "#ffe9c9"; g.font = "bold 26px sans-serif"; g.textAlign = "center";
  g.fillText(name, 128, 37);
  return new THREE.CanvasTexture(c);
}

function plaqueTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 512; c.height = 288;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 288);
  grad.addColorStop(0, "#c9a44e"); grad.addColorStop(0.5, "#b28c3a"); grad.addColorStop(1, "#96762c");
  g.fillStyle = grad; g.fillRect(0, 0, 512, 288);
  g.strokeStyle = "rgba(58,44,16,0.85)"; g.lineWidth = 6; g.strokeRect(18, 18, 476, 252);
  g.fillStyle = "#3a2c10"; g.textAlign = "center";
  g.font = "italic bold 44px Georgia, serif";
  g.fillText("For the ones", 256, 118);
  g.fillText("who stayed.", 256, 172);
  g.fillRect(156, 204, 200, 4);
  g.font = "bold 25px Georgia, serif";
  g.fillText("PORT SABLE", 256, 248);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

interface FigureDef {
  key: string; name: string; x: number; z: number; heading: number;
  rig: HumanoidRig; when: () => boolean;
}

export default function QuietHarbour() {
  const figures = useMemo<FigureDef[]>(() => [
    {
      key: "elias-pier", name: "Old Elias", x: 1.2, z: 107.5, heading: 0, // facing the water, just west of the harbour-office frontage
      rig: buildHumanoid({ top: "#33565e", bottom: "#3a3f45", skin: "#b98a64", hair: "#cfd0cc", topStyle: "jacket", hairStyle: "flat", build: "average" }),
      when: () => M.active?.id === "quiet1",
    },
    {
      key: "lina-garage", name: "Lina Park", x: -38.5, z: -22.5, heading: Math.PI, // facing her driveway, clear of the garage building's corner
      rig: buildHumanoid({ top: "#2e7d74", bottom: "#2b2f36", skin: "#a06a42", hair: "#1d1410", topStyle: "tee", gender: "f", hairStyle: "bun", build: "average" }),
      when: () => M.active?.id === "quiet2" && M.step === 0,
    },
    {
      key: "lina-point", name: "Lina Park", x: -17.6, z: -362.2, heading: 0, // facing the bay, back toward the city
      rig: buildHumanoid({ top: "#2e7d74", bottom: "#2b2f36", skin: "#a06a42", hair: "#1d1410", topStyle: "tee", gender: "f", hairStyle: "bun", build: "average" }),
      when: () => M.active?.id === "quiet2" && M.step === 2,
    },
    {
      key: "elias-bench", name: "Old Elias", x: 70.1, z: 200.6, heading: Math.PI, // facing the bay
      rig: buildHumanoid({ top: "#33565e", bottom: "#3a3f45", skin: "#b98a64", hair: "#cfd0cc", topStyle: "jacket", hairStyle: "flat", build: "average" }),
      when: () => M.active?.id === "quiet3",
    },
    {
      key: "tamim-bench", name: "Tamim Kade", x: 73.9, z: 200.6, heading: Math.PI - 0.3,
      rig: buildHumanoid({ top: "#4a6d7c", bottom: "#33383e", skin: "#c68863", hair: "#241a12", topStyle: "tee", hairStyle: "crop", build: "slim" }),
      when: () => M.active?.id === "quiet3",
    },
  ], []);
  const labels = useMemo(() => figures.map((f) => nameTexture(f.name)), [figures]);
  const plaqueTex = useMemo(() => plaqueTexture(), []);
  const groupRefs = useRef<Array<THREE.Group | null>>([]);
  const labelRefs = useRef<Array<THREE.Sprite | null>>([]);
  const [plaqueOn, setPlaqueOn] = useState(() => M.side.quiet >= 3);
  const plaqueRef = useRef(plaqueOn);

  useFrame(({ clock }) => {
    const tt = clock.elapsedTime;
    // the plaque follows the persisted arc record (StaffWorld
    // signature pattern: a cheap compare per frame, setState on edge)
    const on = M.side.quiet >= 3;
    if (on !== plaqueRef.current) { plaqueRef.current = on; setPlaqueOn(on); }
    figures.forEach((f, i) => {
      const g = groupRefs.current[i];
      if (!g) return;
      const vis = f.when();
      g.visible = vis;
      if (!vis) return;
      g.position.set(f.x, groundYAt(f.x, f.z), f.z);
      g.rotation.y = f.heading;
      animateHumanoid(f.rig, i * 1.31, 0.06, tt); // standing idle — breath and sway only
      const label = labelRefs.current[i];
      if (label) {
        const d2 = (f.x - G.followPos.x) ** 2 + (f.z - G.followPos.z) ** 2;
        label.visible = d2 < 42 ** 2;
      }
    });
  });

  return (
    <>
      {figures.map((f, i) => (
        <group key={f.key} ref={(n) => { groupRefs.current[i] = n; }} visible={false}>
          <primitive object={f.rig.group} />
          <sprite ref={(n) => { labelRefs.current[i] = n; }} position={[0, 2.3, 0]} scale={[2.4, 0.53, 1]} visible={false}>
            <spriteMaterial map={labels[i]} transparent depthWrite={false} />
          </sprite>
        </group>
      ))}
      {plaqueOn && (
        <group position={[72, 0, 199.9]}>
          {/* the brass plaque on its post, at the bench's north side,
              facing the bay it names */}
          <mesh position={[0, 0.26, 0]}>
            <boxGeometry args={[0.09, 0.52, 0.09]} />
            <meshStandardMaterial color="#2c2c30" roughness={0.6} metalness={0.4} />
          </mesh>
          <group position={[0, 0.66, 0]} rotation={[-0.16, Math.PI, 0]}>
            <mesh>
              <boxGeometry args={[0.66, 0.4, 0.03]} />
              <meshStandardMaterial color="#8a6c2a" roughness={0.38} metalness={0.8} />
            </mesh>
            <mesh position={[0, 0, 0.021]}>
              <planeGeometry args={[0.6, 0.34]} />
              <meshStandardMaterial map={plaqueTex} roughness={0.35} metalness={0.55} />
            </mesh>
          </group>
        </group>
      )}
    </>
  );
}
