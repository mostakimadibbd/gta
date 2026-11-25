// Harborfall — Phase 21: STAFF IN THE WORLD (render + behaviour).
//
// The 3D half of game/staffworld.ts: every hired staffer who is on
// shift appears at their business's frontage as a named ped, built
// with the same humanoid rig + floating-label pattern as Phase 9's
// named townsfolk (no new character system). They pace a short beat
// on the frontage, wear their work colour, show name + business +
// trait on the label when the player is near, and greet the player
// with a bark (subtitle) once per game day when approached on foot.
// Off shift, let go, or business gone → the post simply leaves the
// signature and the rig unmounts: a clean despawn, no corpse state.
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { G, bark } from "../game/store";
import { ECO } from "../game/economy";
import { staffPostsNow, staffPostsSignature, type StaffPost } from "../game/staffworld";
import { groundYAt, isWaterAt, isBlocked } from "../world";
import { buildHumanoid, animateHumanoid, type HumanoidRig } from "../humanoid";
import { fallbackPhysics } from "../physics/GamePhysics";

function staffLabelTexture(post: StaffPost): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(10,16,20,0.72)"; g.fillRect(0, 0, 256, 64);
  g.fillStyle = "#ffe9c9"; g.font = "bold 25px sans-serif"; g.textAlign = "center";
  g.fillText(post.name, 128, 28);
  g.fillStyle = "#9fd8d2"; g.font = "17px sans-serif";
  g.fillText(`${post.biz.name.replace(" — 50% share", "")} · ${post.def.label}`, 128, 52);
  return new THREE.CanvasTexture(c);
}

interface PostState { x: number; z: number; heading: number; swing: number; target: 0 | 1; idleT: number; ax: number; az: number; bx: number; bz: number; }

/** Frontage beat for a business: two pace points offset from the buy
 * point, chosen from the first unblocked offset pair so the staffer
 * stands on open ground (pavement/yard), never inside the building.
 * Falls back to the buy point itself if every offset is blocked. */
function beatFor(post: StaffPost): [number, number, number, number] {
  const { x, z } = post.biz;
  const offsets: Array<[number, number]> = [[3.2, 3.2], [-3.2, 3.2], [3.2, -3.2], [-3.2, -3.2], [4.5, 0], [-4.5, 0], [0, 4.5], [0, -4.5]];
  for (const [ox, oz] of offsets) {
    const ax = x + ox, az = z + oz, bx = x - ox, bz = z + oz;
    if (!isBlocked(ax, az, 0.4) && !isWaterAt(ax, az) && !isBlocked(bx, bz, 0.4) && !isWaterAt(bx, bz)) return [ax, az, bx, bz];
  }
  return [x, z, x, z];
}

export default function StaffWorld() {
  const [posts, setPosts] = useState<StaffPost[]>(() => staffPostsNow());
  const sigRef = useRef(staffPostsSignature());
  const rigs = useMemo<HumanoidRig[]>(() => posts.map((p) => buildHumanoid({
    top: p.def.workTop, bottom: p.def.bottom, skin: p.def.skin, hair: p.def.hair,
    hairStyle: p.def.hairStyle, build: p.def.build, gender: p.def.female ? "f" : "m",
  })), [posts]);
  const labels = useMemo(() => posts.map((p) => staffLabelTexture(p)), [posts]);
  const groupRefs = useRef<Array<THREE.Group | null>>([]);
  const labelRefs = useRef<Array<THREE.Sprite | null>>([]);
  const states = useRef<Map<string, PostState>>(new Map());
  const greeted = useRef<Map<string, number>>(new Map()); // staffer → daySerial last greeted

  useFrame(({ clock }, delta) => {
    // hire/fire/shift-edge/sale changes rebuild the post set (rare —
    // the signature is a short string compare per frame)
    const sig = staffPostsSignature();
    if (sig !== sigRef.current) { sigRef.current = sig; setPosts(staffPostsNow()); return; }
    const dt = Math.min(delta, 0.05);
    const tt = clock.elapsedTime;
    const px = G.followPos.x, pz = G.followPos.z;
    const onFoot = !G.driving && !G.interior && !G.status;
    const frozen = G.dialogueActive || !!G.status;
    posts.forEach((post, i) => {
      const key = `${post.name}@${post.biz.id}`;
      let st = states.current.get(key);
      if (!st) {
        const [ax, az, bx, bz] = beatFor(post);
        st = { x: ax, z: az, heading: 0, swing: Math.random() * 6, target: 1, idleT: 0, ax, az, bx, bz };
        states.current.set(key, st);
      }
      const g = groupRefs.current[i];
      const near2 = (st.x - px) ** 2 + (st.z - pz) ** 2;
      let speedNow = 0;
      if (!frozen && near2 < 110 ** 2) {
        if (st.idleT > 0) { st.idleT -= dt; }
        else {
          const tx = st.target === 0 ? st.ax : st.bx;
          const tz = st.target === 0 ? st.az : st.bz;
          if (Math.hypot(tx - st.x, tz - st.z) < 0.7) { st.target = st.target === 0 ? 1 : 0; st.idleT = 2 + Math.random() * 3; }
          else {
            const next = fallbackPhysics.stepPedestrianV2(
              { x: st.x, z: st.z, heading: st.heading, speed: 1.1 },
              tx, tz, px, pz, false, 1.1, [], 0.95, dt);
            if (!isBlocked(next.x, next.z, 0.4) && !isWaterAt(next.x, next.z)) { st.x = next.x; st.z = next.z; }
            st.heading = next.heading;
            speedNow = 1.1;
            st.swing += dt * 1.1 * 2.9;
          }
        }
      }
      if (g) {
        g.position.set(st.x, groundYAt(st.x, st.z), st.z);
        g.rotation.y = st.heading;
        animateHumanoid(rigs[i], st.swing * 1.7, speedNow > 0 ? 0.72 : 0.06, tt + i * 1.7);
      }
      const label = labelRefs.current[i];
      if (label) {
        label.visible = near2 < 42 ** 2;
        if (label.visible) label.position.set(st.x, groundYAt(st.x, st.z) + 2.3, st.z);
      }
      // the greeting: once per game day per staffer, on foot, close
      if (onFoot && !frozen && near2 < 4.5 ** 2 && greeted.current.get(post.name) !== ECO.daySerial) {
        greeted.current.set(post.name, ECO.daySerial);
        bark(post.name, post.def.greet);
      }
    });
  });

  return (
    <>
      {posts.map((post, i) => (
        <group key={`${post.name}@${post.biz.id}`}>
          <group ref={(n) => { groupRefs.current[i] = n; }}>
            <primitive object={rigs[i].group} />
          </group>
          <sprite ref={(n) => { labelRefs.current[i] = n; }} visible={false} scale={[2.7, 0.68, 1]}>
            <spriteMaterial map={labels[i]} transparent depthWrite={false} />
          </sprite>
        </group>
      ))}
    </>
  );
}
