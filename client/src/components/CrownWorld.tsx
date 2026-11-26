// Harborfall — Phase 48: THE HARBOUR CROWN (world presence).
//
// The 3D half of crown3, "The Auction": while the auction is the
// chain's live part (M.side.crown === 2 — available or in play),
// the seized Solano mansion on the Northgate row has its sale
// party on the frontage: an auctioneer at a small podium on the
// mansion's east steps, Meridian's bidder with his briefcase
// stance, and a harbour bidder opposite. Named rigs on the
// QuietHarbour pattern (buildHumanoid + a floating name label
// inside 42u), standing idle — the set-piece is carried by the
// mission's subtitle dialogue and the choice the player already
// made on the phone, not by new NPC simulation.
//
// Visibility derives from the persisted side record alone (the
// QuietHarbour plaque pattern: a cheap compare per frame, setState
// on edge), so the party appears with the part, survives reloads,
// and leaves when the part completes — and when NG+ resets the
// arc, it can return in the new run.
//
// Figure spots are placement-audited (tools/audit-entry.ts §14) —
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

interface FigureDef {
  key: string; name: string; x: number; z: number; heading: number;
  rig: HumanoidRig;
}

export default function CrownWorld() {
  const figures = useMemo<FigureDef[]>(() => [
    {
      key: "auctioneer", name: "Auctioneer — Sable & Vine", x: -97.8, z: -236, heading: Math.PI / 2, // on the mansion's east steps, facing the bidders
      rig: buildHumanoid({ top: "#2b2f36", bottom: "#23262b", skin: "#e0ac69", hair: "#8a8d90", topStyle: "jacket", hairStyle: "flat", build: "average" }),
    },
    {
      key: "meridian-bidder", name: "Meridian Bidder", x: -96.2, z: -233.5, heading: -Math.PI / 2, // facing the mansion, briefcase stance
      rig: buildHumanoid({ top: "#37424e", bottom: "#2b2f36", skin: "#f1c27d", hair: "#241a12", topStyle: "jacket", hairStyle: "crop", build: "broad" }),
    },
    {
      key: "harbour-bidder", name: "Harbour Bidder", x: -96.2, z: -238.5, heading: -Math.PI / 2, // a local face in the crowd, facing the mansion
      rig: buildHumanoid({ top: "#2e7d74", bottom: "#33383e", skin: "#8d5524", hair: "#1d1410", topStyle: "tee", gender: "f", hairStyle: "bun", build: "average" }),
    },
  ], []);
  const labels = useMemo(() => figures.map((f) => nameTexture(f.name)), [figures]);
  const groupRefs = useRef<Array<THREE.Group | null>>([]);
  const labelRefs = useRef<Array<THREE.Sprite | null>>([]);
  const [partyOn, setPartyOn] = useState(() => M.side.crown === 2);
  const partyRef = useRef(partyOn);

  useFrame(({ clock }) => {
    const tt = clock.elapsedTime;
    // the sale party follows the persisted arc record (StaffWorld
    // signature pattern: a cheap compare per frame, setState on edge)
    const on = M.side.crown === 2;
    if (on !== partyRef.current) { partyRef.current = on; setPartyOn(on); }
    if (!on) return;
    figures.forEach((f, i) => {
      const g = groupRefs.current[i];
      if (!g) return;
      g.position.set(f.x, groundYAt(f.x, f.z), f.z);
      g.rotation.y = f.heading;
      animateHumanoid(f.rig, i * 1.71, 0.06, tt); // standing idle — breath and sway only
      const label = labelRefs.current[i];
      if (label) {
        const d2 = (f.x - G.followPos.x) ** 2 + (f.z - G.followPos.z) ** 2;
        label.visible = d2 < 42 ** 2;
      }
    });
  });

  if (!partyOn) return null;
  return (
    <group>
      {figures.map((f, i) => (
        <group key={f.key} ref={(n) => { groupRefs.current[i] = n; }}>
          <primitive object={f.rig.group} />
          <sprite ref={(n) => { labelRefs.current[i] = n; }} position={[0, 2.3, 0]} scale={[2.4, 0.53, 1]} visible={false}>
            <spriteMaterial map={labels[i]} transparent depthWrite={false} />
          </sprite>
        </group>
      ))}
      {/* the auctioneer's podium on the mansion steps */}
      <group position={[-97.3, 0, -236]}>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[0.55, 1.1, 0.45]} />
          <meshStandardMaterial color="#4a3826" roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}
