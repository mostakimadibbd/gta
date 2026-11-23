// Harborfall — Phase 9 systems ("500 Sweep Round 3"). Runs LAST in the
// prompt chain (after Interiors → Interactions → Phase7 → Phase8):
//   • the Harbour Guard — the earned 6th star's armoured SUV unit
//   • police boat (watches you on the water: heat cannot cool)
//   • K9 unit (3★+ on foot: the dog holds you for the bust)
//   • four NAMED townsfolk with daily schedules + dialogue trees
//   • roadworks: one rotating site per game-day + traffic slow-zone
//   • traffic WRECKS that persist for the game-day (+ diversion scan)
//   • breakable shopfront glass + a collapsible scaffold
//   • the thrown-bottle projectile (Combat throws, this flies it)
//   • Sable Cuts barber + Sable Ink tattoo points (Market Row)
// Everything here follows the Phase 7/8 patterns: G-state, prompt chain
// claimed only when free, harborfall-* persistence via game/phase9.ts.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { G, toast, bark, addCrime } from "../game/store";
import { groundYAt, isWaterAt, isBlocked, routePoints, nearestIntersection } from "../world";
import { buildHumanoid, animateHumanoid, type HumanoidRig } from "../humanoid";
import { fallbackPhysics } from "../physics/GamePhysics";
import { glowTexture } from "../textures";
import { sfx } from "../game/audio";
import { ECO } from "../game/economy";
import { pushNews } from "../game/feed";
import { gameHour, shopsClosed } from "./Interactions";
import CarBody from "./CarBody";
import {
  LOOK, HAIR_STYLES, HAIR_COLORS, BARBER_POS, TATTOO_POS, BARBER_PRICE, TATTOO_PRICE, setLook,
  BOTTLE, TOWNSFOLK, townStopAt, TALK, closeTalk, roadworksSite,
  loadDaySet, saveDaySet, WRECK_KEY,
} from "../game/phase9";

const SCAFFOLD_KEY = "harborfall-scaffold";
const HAIR_LOOKS: Array<{ s: number; c: number }> = [
  { s: 0, c: 0 }, { s: 1, c: 1 }, { s: 2, c: 2 }, { s: 3, c: 3 },
  { s: 0, c: 4 }, { s: 1, c: 5 }, { s: 4, c: 0 }, { s: 3, c: 0 },
];
/** Coral-row shopfront glass (World ShopFronts buildings at z=218,
 * glass face at z≈214.5): three buildings × three panes. */
const GLASS_PANES: Array<{ x: number; z: number }> = [48, 88, 64].flatMap((cx) =>
  [-2.9, 0, 2.9].map((dx) => ({ x: cx + dx, z: 214.5 })));
const SCAFFOLD_POS = { x: 80, z: -66.5 };

function labelTexture(name: string, role: string): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(10,16,20,0.72)"; g.fillRect(0, 0, 256, 64);
  g.fillStyle = "#ffe9c9"; g.font = "bold 25px sans-serif"; g.textAlign = "center";
  g.fillText(name, 128, 28);
  g.fillStyle = "#9fd8d2"; g.font = "17px sans-serif";
  g.fillText(role, 128, 52);
  return new THREE.CanvasTexture(c);
}
function signTexture(text: string, bg: string, fg: string): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = bg; g.fillRect(0, 0, 256, 64);
  g.fillStyle = fg; g.font = "bold 26px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, 128, 34);
  return new THREE.CanvasTexture(c);
}

interface Shard { active: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; }
interface NpcState { x: number; z: number; heading: number; swing: number; path: [number, number][]; pathI: number; stopKey: string; }

export default function Phase9() {
  const myPrompt = useRef("");
  const eDownAt = useRef(-1);
  const eHeld = useRef(false);
  const atBarber = useRef(false);
  const atTattoo = useRef(false);
  const lookIdx = useRef(0);

  // ---------- Harbour Guard (6★) ----------
  const guardRef = useRef<THREE.Group>(null);
  const guard = useRef({ active: false, x: 0, z: 0, heading: 0, speed: 0 });
  // ---------- police boat ----------
  const boatRef = useRef<THREE.Group>(null);
  const boatP = useRef({ active: false, x: 0, z: 130, heading: 0, speed: 0, barked: false });
  // ---------- K9 ----------
  const k9Ref = useRef<THREE.Group>(null);
  const k9 = useRef({ active: false, x: 0, z: 0, heading: 0, barked: false });
  const dogRig = useMemo(() => {
    const g = new THREE.Group();
    const bodyM = new THREE.MeshStandardMaterial({ color: "#3a3f45", roughness: 0.9 });
    const darkM = new THREE.MeshStandardMaterial({ color: "#22262b", roughness: 0.9 });
    const vestM = new THREE.MeshStandardMaterial({ color: "#1f7a72", roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.3, 0.24), bodyM); body.position.y = 0.36;
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.26), vestM); vest.position.y = 0.37;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.2), bodyM); head.position.set(0.33, 0.5, 0);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.12), darkM); snout.position.set(0.47, 0.46, 0);
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.1), darkM); ear.position.set(0.28, 0.62, 0);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), darkM); tail.position.set(-0.33, 0.46, 0); tail.rotation.z = 0.7;
    g.add(body, vest, head, snout, ear, tail);
    for (const [lx, lz] of [[0.18, 0.09], [0.18, -0.09], [-0.18, 0.09], [-0.18, -0.09]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.05), darkM);
      leg.position.set(lx, 0.12, lz); g.add(leg);
    }
    return g;
  }, []);
  // ---------- named townsfolk ----------
  const npcRigs = useMemo<HumanoidRig[]>(() => TOWNSFOLK.map((n) => buildHumanoid({
    top: n.top, bottom: n.bottom, skin: n.skin, hair: n.hair,
    hairStyle: n.hairStyle as "cap" | "flat" | "bun" | "ponytail" | "crop" | "bald",
    cap: n.cap, build: n.build, gender: n.female ? "f" : "m",
  })), []);
  const npcLabels = useMemo(() => TOWNSFOLK.map((n) => labelTexture(n.name, n.role)), []);
  const npcRefs = useRef<Array<THREE.Group | null>>([]);
  const npcLabelRefs = useRef<Array<THREE.Sprite | null>>([]);
  const npcs = useRef<NpcState[]>(TOWNSFOLK.map((n) => {
    const s = townStopAt(n, 13);
    return { x: s.x, z: s.z, heading: 0, swing: Math.random() * 6, path: [], pathI: 0, stopKey: "" };
  }));
  // ---------- roadworks ----------
  const rwRefs = useRef<THREE.Group>(null);
  const rwWorkers = useMemo<HumanoidRig[]>(() => [
    buildHumanoid({ top: "#d99a3d", bottom: "#3a3f45", skin: "#8a5a3b", hair: "#20242c", hairStyle: "cap", cap: "#e8e4da" }),
    buildHumanoid({ top: "#d99a3d", bottom: "#2b3440", skin: "#5d4028", hair: "#14161c", hairStyle: "flat" }),
  ], []);
  const rwWorkerRefs = useRef<Array<THREE.Group | null>>([]);
  const daySerialSeen = useRef(ECO.daySerial);
  // ---------- wrecks ----------
  const wrecksApplied = useRef(false);
  const wreckKnown = useRef<Set<number>>(new Set());
  const blockedTimers = useRef(new Map<number, number>());
  const smokeRefs = useRef<Array<THREE.Sprite | null>>([]);
  const glowTex = useMemo(() => glowTexture(), []);
  // ---------- glass + scaffold ----------
  const glassBroken = useRef<Set<number>>(new Set());
  const glassRefs = useRef<Array<THREE.Mesh | null>>([]);
  const scaffold = useRef<{ state: "up" | "falling" | "down"; t: number }>({ state: loadDaySet(SCAFFOLD_KEY).length ? "down" : "up", t: 0 });
  const scaffoldRef = useRef<THREE.Group>(null);
  // ---------- bottle + shards ----------
  const bottleRef = useRef<THREE.Group>(null);
  const shards = useRef<Shard[]>(Array.from({ length: 12 }, () => ({ active: false, x: 0, y: -20, z: 0, vx: 0, vy: 0, vz: 0, life: 0 })));
  const shardRefs = useRef<Array<THREE.Mesh | null>>([]);
  const shardCursor = useRef(0);
  const spawnShards = (x: number, y: number, z: number, color: string, n: number, spread = 2.2, dirX = 0, dirZ = 0, power = 0) => {
    for (let k = 0; k < n; k++) {
      const s = shards.current[shardCursor.current % shards.current.length];
      shardCursor.current += 1;
      s.active = true; s.life = 0.9 + Math.random() * 0.5;
      s.x = x; s.y = y; s.z = z;
      // Phase 10: shards inherit the impact's direction (thrown
      // bottle's flight, ramming car's motion) around the random cone
      s.vx = (Math.random() - 0.5) * spread + dirX * power * (0.5 + Math.random() * 0.6);
      s.vy = 1.5 + Math.random() * 2.4;
      s.vz = (Math.random() - 0.5) * spread + dirZ * power * (0.5 + Math.random() * 0.6);
      const m = shardRefs.current[(shardCursor.current - 1) % shards.current.length];
      if (m) (m.material as THREE.MeshStandardMaterial).color.set(color);
    }
  };
  const breakGlass = (i: number, byPlayer: boolean, dirX = 0, dirZ = 0, power = 0) => {
    if (glassBroken.current.has(i)) return;
    glassBroken.current.add(i);
    const pane = GLASS_PANES[i];
    const m = glassRefs.current[i];
    if (m) m.visible = false;
    spawnShards(pane.x, 1.2, pane.z, "#bfe3ec", 5, 1.8, dirX, dirZ, power);
    sfx.glass();
    if (byPlayer) addCrime("theft"); // witnessed property damage — no instant star
  };

  // barber/tattoo tap-vs-hold E (mirrors the Phase 8 shop pattern)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "e" && !e.repeat) { eDownAt.current = performance.now() / 1000; eHeld.current = true; }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "e") {
        if (eHeld.current && eDownAt.current > 0 && performance.now() / 1000 - eDownAt.current < 0.35) {
          if (atBarber.current) { lookIdx.current = (lookIdx.current + 1) % HAIR_LOOKS.length; sfx.click(); }
        }
        eDownAt.current = -1; eHeld.current = false;
        if (G.hold?.label.startsWith("Cutting") || G.hold?.label.startsWith("Inking")) G.hold = null;
      }
    };
    const blur = () => { eHeld.current = false; eDownAt.current = -1; };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = G.timeS;
    const tt = clock.elapsedTime;
    const px = G.followPos.x, pz = G.followPos.z;
    const onFoot = !G.driving && !G.interior && !G.status;
    const frozen = G.dialogueActive || !!G.status;
    let prompt = ""; let warn = false; let act: (() => void) | null = null;

    // ================= day rollover: news + wreck reset =================
    if (ECO.daySerial !== daySerialSeen.current) {
      const site = roadworksSite();
      if (ECO.daySerial > daySerialSeen.current) {
        pushNews(`Harbour Wire: roadworks on ${site.road}`, `Crews are digging up ${site.road} today — cones are out and traffic is squeezing past at a crawl. The harbour thanks you for your patience. It does not mean it.`);
      }
      daySerialSeen.current = ECO.daySerial;
      for (const c of G.traffic) if (c.damage >= 100) c.damage = 0; // wrecks towed overnight
      wreckKnown.current.clear();
      saveDaySet(WRECK_KEY, []);
      glassBroken.current.clear();
      glassRefs.current.forEach((m) => { if (m) m.visible = true; }); // reglazed overnight
      if (scaffold.current.state === "down") { scaffold.current = { state: "up", t: 0 }; saveDaySet(SCAFFOLD_KEY, []); }
    }

    // ================= traffic wrecks: restore + persist + divert =====
    if (!wrecksApplied.current && G.traffic.length) {
      wrecksApplied.current = true;
      for (const idx of loadDaySet(WRECK_KEY)) if (G.traffic[idx]) G.traffic[idx].damage = 100;
    }
    {
      let changed = false;
      G.traffic.forEach((c, i) => {
        const isW = c.damage >= 100;
        if (isW && !wreckKnown.current.has(i)) { wreckKnown.current.add(i); changed = true; }
        if (!isW && wreckKnown.current.has(i)) { wreckKnown.current.delete(i); changed = true; }
      });
      if (changed) saveDaySet(WRECK_KEY, [...wreckKnown.current]);
      // smoke: the four nearest wrecks smoulder
      const wrecks = [...wreckKnown.current]
        .map((i) => G.traffic[i])
        .filter((c) => c && (c.x - px) ** 2 + (c.z - pz) ** 2 < 130 ** 2)
        .sort((a, b) => ((a.x - px) ** 2 + (a.z - pz) ** 2) - ((b.x - px) ** 2 + (b.z - pz) ** 2))
        .slice(0, 4);
      smokeRefs.current.forEach((sp, i) => {
        if (!sp) return;
        const c = wrecks[i];
        sp.visible = !!c;
        if (c) {
          sp.position.set(c.x, groundYAt(c.x, c.z) + 1.5 + Math.sin(tt * 2.2 + i * 1.7) * 0.15, c.z);
          const s = 1.5 + Math.sin(tt * 3.1 + i) * 0.3;
          sp.scale.set(s, s * 1.3, 1);
          (sp.material as THREE.SpriteMaterial).opacity = 0.32;
        }
      });
      // diversion: a car stuck behind a wreck for >8 s gives up and
      // reroutes (teleports back along its lane — reads as diverting)
      if (!frozen) G.traffic.forEach((c, i) => {
        if (c.damage >= 100 || c.speed > 0.3 || c.dormant) { blockedTimers.current.delete(i); return; }
        let stuck = false;
        for (const wi of wreckKnown.current) {
          const w = G.traffic[wi]; if (!w) continue;
          const dx = w.x - c.x, dz = w.z - c.z;
          const ahead = dx * Math.sin(c.heading) + dz * Math.cos(c.heading);
          const side = Math.abs(dx * Math.cos(c.heading) - dz * Math.sin(c.heading));
          if (ahead > 2 && ahead < 10 && side < 2.4) { stuck = true; break; }
        }
        if (!stuck) { blockedTimers.current.delete(i); return; }
        const tm = (blockedTimers.current.get(i) ?? 0) + dt;
        blockedTimers.current.set(i, tm);
        if (tm > 8) {
          blockedTimers.current.delete(i);
          if (c.axis === "z") c.z -= c.dir * 55; else c.x -= c.dir * 55;
          c.speed = 4;
        }
      });
    }

    // ================= roadworks: slow-zone + site =================
    const site = roadworksSite();
    if (!frozen) {
      for (const c of G.traffic) {
        if (Math.abs(c.x - site.x) < 3.6 && Math.abs(c.z - site.z) < 13 && c.speed > 3.2) c.speed = 3.2;
      }
    }
    if (rwRefs.current) {
      rwRefs.current.position.set(site.x, groundYAt(site.x, site.z), site.z);
      rwRefs.current.visible = (site.x - px) ** 2 + (site.z - pz) ** 2 < 165 ** 2;
    }
    rwWorkerRefs.current.forEach((g, i) => {
      if (!g) return;
      const rig = rwWorkers[i];
      const wx = site.x - 2.6 + i * 1.4, wz = site.z - 3 + i * 5.5 + Math.sin(tt * 0.24 + i * 2.4) * 1.6;
      g.position.set(wx, groundYAt(wx, wz), wz);
      g.rotation.y = Math.atan2(Math.cos(tt * 0.24 + i * 2.4), 0.4);
      animateHumanoid(rig, tt * 2.6 + i * 2, 0.24, tt);
    });

    // ================= Harbour Guard (6★) =================
    {
      const gd = guard.current;
      const should = G.wanted >= 6 && !G.interior;
      if (should && !gd.active) {
        gd.active = true;
        const [ix, iz] = nearestIntersection(px, pz);
        gd.x = ix; gd.z = iz; gd.heading = Math.atan2(px - ix, pz - iz); gd.speed = 0;
        bark("Dispatch", "Harbour Guard armoured unit is on the suspect. All other units, support.");
      } else if (!should) gd.active = false;
      if (guardRef.current) {
        guardRef.current.visible = gd.active;
        if (gd.active && !frozen) {
          const dx = px - gd.x, dz = pz - gd.z;
          const dist = Math.hypot(dx, dz);
          const desired = Math.atan2(dx, dz);
          let turn = desired - gd.heading;
          turn = Math.atan2(Math.sin(turn), Math.cos(turn));
          gd.heading += THREE.MathUtils.clamp(turn, -1.5 * dt, 1.5 * dt);
          const target = dist > 15 ? 27 : dist > 6 ? 13 : 4;
          gd.speed += THREE.MathUtils.clamp(target - gd.speed, -14 * dt, 7 * dt);
          const nx = gd.x + Math.sin(gd.heading) * gd.speed * dt;
          const nz = gd.z + Math.cos(gd.heading) * gd.speed * dt;
          // the Guard is heavy but not magic: buildings and the bay stop it
          if (!isBlocked(nx, nz, 1.3) && !(isWaterAt(nx, nz) && groundYAt(nx, nz) <= 0.05)) { gd.x = nx; gd.z = nz; }
          else gd.speed = Math.max(0, gd.speed - 12 * dt);
          guardRef.current.position.set(gd.x, groundYAt(gd.x, gd.z), gd.z);
          guardRef.current.rotation.set(0, gd.heading, 0);
        } else if (gd.active) {
          guardRef.current.position.set(gd.x, groundYAt(gd.x, gd.z), gd.z);
          guardRef.current.rotation.set(0, gd.heading, 0);
        }
      }
    }

    // ================= police boat =================
    {
      const bp = boatP.current;
      const playerCar = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId] : null;
      const onWater = G.swimming || (playerCar?.kind === "boat" || playerCar?.kind === "skiff");
      const should = G.wanted >= 2 && onWater && !G.interior;
      if (should && !bp.active) {
        bp.active = true; bp.barked = false;
        bp.x = px + 30; bp.z = pz + 18;
        if (!isWaterAt(bp.x, bp.z)) { bp.x = px - 28; bp.z = pz - 14; }
        bp.heading = Math.atan2(px - bp.x, pz - bp.z);
      } else if (!should) bp.active = false;
      if (boatRef.current) {
        boatRef.current.visible = bp.active;
        if (bp.active && !frozen) {
          const dx = px - bp.x, dz = pz - bp.z;
          const dist = Math.hypot(dx, dz);
          // hold a watching standoff ~7u off the player's stern
          const tx = px - Math.sin(G.playerHeading) * 7, tz = pz - Math.cos(G.playerHeading) * 7;
          const gx = dist > 26 ? px : tx, gz = dist > 26 ? pz : tz;
          const desired = Math.atan2(gx - bp.x, gz - bp.z);
          let turn = desired - bp.heading;
          turn = Math.atan2(Math.sin(turn), Math.cos(turn));
          bp.heading += THREE.MathUtils.clamp(turn, -0.8 * dt, 0.8 * dt);
          const target = dist > 9 ? 12.5 : 2.5;
          bp.speed += THREE.MathUtils.clamp(target - bp.speed, -6 * dt, 3.5 * dt);
          const nx = bp.x + Math.sin(bp.heading) * bp.speed * dt;
          const nz = bp.z + Math.cos(bp.heading) * bp.speed * dt;
          if (isWaterAt(nx, nz)) { bp.x = nx; bp.z = nz; } else bp.speed = 0;
          if (dist < 26) {
            G.wantedCooldown = 0; // watched: the heat cannot cool off
            if (!bp.barked) { bp.barked = true; bark("Harbour Patrol — Marine Unit", "Marine unit has eyes on the suspect. Stay on them."); }
          }
          const b = fallbackPhysics.boatBuoyancy(tt * 1.25 + 40, bp.speed, 0.06);
          boatRef.current.position.set(bp.x, -0.08 + b.bob, bp.z);
          boatRef.current.rotation.order = "YXZ";
          boatRef.current.rotation.set(b.pitch, bp.heading, b.roll);
        }
      }
    }

    // ================= K9 unit =================
    {
      const kd = k9.current;
      const should = G.wanted >= 3 && onFoot && !G.swimming && !frozen;
      if (should && !kd.active) {
        kd.active = true; kd.barked = false;
        const cop = G.cops.find((c) => c.active);
        kd.x = cop ? cop.x + 3 : px + 22; kd.z = cop ? cop.z + 3 : pz + 22;
        kd.heading = Math.atan2(px - kd.x, pz - kd.z);
      } else if (!should && G.wanted < 3) kd.active = false;
      else if (!should && (G.driving || G.swimming)) kd.active = false;
      if (k9Ref.current) {
        k9Ref.current.visible = kd.active;
        if (kd.active) {
          const dx = px - kd.x, dz = pz - kd.z;
          const dist = Math.hypot(dx, dz);
          if (!frozen && dist > 1.5) {
            kd.heading = Math.atan2(dx, dz);
            const step = Math.min(dist - 1.2, 6.6 * dt);
            kd.x += Math.sin(kd.heading) * step;
            kd.z += Math.cos(kd.heading) * step;
          }
          if (!frozen && dist < 1.8) {
            // the dog has you: the bust meter fills half again as fast
            G.bustTimer = Math.min(3, G.bustTimer + dt * 1.5);
            if (!kd.barked) { kd.barked = true; bark("Harbour Patrol K9", "The dog has the scent — and now it has YOU. Run or surrender."); }
          }
          k9Ref.current.position.set(kd.x, groundYAt(kd.x, kd.z) + Math.abs(Math.sin(tt * 11)) * 0.04, kd.z);
          k9Ref.current.rotation.y = kd.heading - Math.PI / 2; // dog model faces +X
        }
      }
    }

    // ================= named townsfolk =================
    {
      const hour = gameHour();
      TOWNSFOLK.forEach((def, i) => {
        const st = npcs.current[i];
        const g = npcRefs.current[i];
        const stop = townStopAt(def, hour);
        const key = `${stop.from}:${stop.x},${stop.z}`;
        if (key !== st.stopKey) {
          st.stopKey = key;
          st.path = routePoints(st.x, st.z, stop.x, stop.z).slice(1);
          st.pathI = 0;
        }
        const talking = TALK.open && TALK.npcId === def.id;
        let speedNow = 0;
        if (!frozen && !talking) {
          while (st.pathI < st.path.length) {
            const [wx, wz] = st.path[st.pathI];
            if (Math.hypot(wx - st.x, wz - st.z) < 0.7) { st.pathI += 1; continue; }
            const next = fallbackPhysics.stepPedestrianV2(
              { x: st.x, z: st.z, heading: st.heading, speed: 1.35 },
              wx, wz, px, pz, false, 1.35, [], 0.95, dt);
            if (!isBlocked(next.x, next.z, 0.4) && !isWaterAt(next.x, next.z)) { st.x = next.x; st.z = next.z; }
            st.heading = next.heading;
            speedNow = 1.35;
            st.swing += dt * 1.35 * 2.9;
            break;
          }
        }
        if (talking) st.heading = Math.atan2(px - st.x, pz - st.z);
        const arrived = st.pathI >= st.path.length;
        if (g) {
          g.position.set(st.x, groundYAt(st.x, st.z), st.z);
          g.rotation.y = st.heading;
          const rig = npcRigs[i];
          const sit = arrived && !!stop.sit && !talking;
          animateHumanoid(rig, st.swing * 1.7, speedNow > 0 ? 0.72 : 0.06, tt + i * 1.3);
          if (sit) {
            rig.lThigh.rotation.x = rig.rThigh.rotation.x = -1.45;
            rig.lShin.rotation.x = rig.rShin.rotation.x = 1.35;
            rig.group.position.y = -0.42;
          } else rig.group.position.y = 0;
        }
        const label = npcLabelRefs.current[i];
        if (label) {
          const near = (st.x - px) ** 2 + (st.z - pz) ** 2 < 42 ** 2;
          label.visible = near;
          if (near) label.position.set(st.x, groundYAt(st.x, st.z) + 2.3, st.z);
        }
        if (onFoot && !TALK.open && !frozen && !prompt) {
          const d2 = (st.x - px) ** 2 + (st.z - pz) ** 2;
          if (d2 < 2.3 ** 2) {
            prompt = `E — Talk to ${def.name} (${def.role})`;
            act = () => {
              TALK.open = true; TALK.npcId = def.id; TALK.node = "greet"; TALK.reply = "";
              G.dialogueActive = true;
            };
          }
        }
      });
      // walk away mid-conversation and it ends, politely
      if (TALK.open) {
        const idx = TOWNSFOLK.findIndex((n) => n.id === TALK.npcId);
        const st = idx >= 0 ? npcs.current[idx] : null;
        if (!st || (st.x - px) ** 2 + (st.z - pz) ** 2 > 5.5 ** 2) { closeTalk(); G.dialogueActive = false; }
      }
    }

    // ================= thrown bottle =================
    {
      if (BOTTLE.active && !frozen) {
        BOTTLE.vy -= 18 * dt;
        BOTTLE.x += BOTTLE.vx * dt; BOTTLE.y += BOTTLE.vy * dt; BOTTLE.z += BOTTLE.vz * dt;
        BOTTLE.spin += dt * 9;
        const gy = groundYAt(BOTTLE.x, BOTTLE.z);
        let hitPed = -1; let hitCar = false;
        if (BOTTLE.y < 2.1) {
          G.peds.forEach((ped, i) => {
            if (hitPed >= 0 || !ped.active || t < ped.downUntil) return;
            if ((ped.x - BOTTLE.x) ** 2 + (ped.z - BOTTLE.z) ** 2 < 0.85 ** 2) hitPed = i;
          });
          if (hitPed < 0) {
            for (const c of G.cars) if ((c.state.x - BOTTLE.x) ** 2 + (c.state.z - BOTTLE.z) ** 2 < 1.8 ** 2) { c.damage = Math.min(100, c.damage + 3); hitCar = true; break; }
            if (!hitCar) for (const c of G.traffic) if ((c.x - BOTTLE.x) ** 2 + (c.z - BOTTLE.z) ** 2 < 1.8 ** 2) { c.damage = Math.min(100, c.damage + 3); hitCar = true; break; }
          }
        }
        let glassHit = -1;
        GLASS_PANES.forEach((pane, i) => {
          if (glassHit >= 0 || glassBroken.current.has(i)) return;
          if ((pane.x - BOTTLE.x) ** 2 + (pane.z - BOTTLE.z) ** 2 < 1.7 ** 2 && BOTTLE.y < 2.6) glassHit = i;
        });
        const groundHit = BOTTLE.y <= gy + 0.12;
        if (hitPed >= 0 || hitCar || glassHit >= 0 || groundHit) {
          BOTTLE.active = false;
          const bvx = BOTTLE.vx, bvz = BOTTLE.vz;
          const bl = Math.hypot(bvx, bvz) || 1;
          spawnShards(BOTTLE.x, Math.max(BOTTLE.y, gy + 0.25), BOTTLE.z, "#7fae7f", 6, 2.2, bvx / bl, bvz / bl, Math.min(3, bl * 0.45));
          sfx.glass();
          if (glassHit >= 0) breakGlass(glassHit, true, bvx / bl, bvz / bl, Math.min(3, bl * 0.45));
          if (hitPed >= 0) {
            const ped = G.peds[hitPed];
            ped.downUntil = t + 3; ped.fleeUntil = t + 6; ped.flinchUntil = t + 0.4;
            addCrime("assault");
            toast("Direct hit — that bottle found a person. The harbour saw it.");
          } else if (hitCar) addCrime("hit");
          for (const ped of G.peds) {
            if (ped.active && (ped.x - BOTTLE.x) ** 2 + (ped.z - BOTTLE.z) ** 2 < 5 ** 2) {
              ped.fleeUntil = Math.max(ped.fleeUntil, t + 3);
              ped.flinchUntil = Math.max(ped.flinchUntil ?? 0, t + 0.3);
            }
          }
        }
      }
      if (bottleRef.current) {
        bottleRef.current.visible = BOTTLE.active;
        if (BOTTLE.active) {
          bottleRef.current.position.set(BOTTLE.x, BOTTLE.y, BOTTLE.z);
          bottleRef.current.rotation.set(BOTTLE.spin, 0, BOTTLE.spin * 0.7);
        }
      }
      shards.current.forEach((s, i) => {
        const m = shardRefs.current[i]; if (!m) return;
        if (!s.active) { m.visible = false; return; }
        m.visible = true;
        // Phase 10: same C++ debris_step as the Phase 7 debris pool
        // (gravity −18, restitution 0.3, ground keep 0.6, rest settle)
        const gy = groundYAt(s.x, s.z) + 0.05;
        const ns = fallbackPhysics.debrisStep(s, gy, 0.3, 0.6, dt);
        s.x = ns.x; s.y = ns.y; s.z = ns.z; s.vx = ns.vx; s.vy = ns.vy; s.vz = ns.vz;
        s.life -= dt;
        if (s.life <= 0) s.active = false;
        m.position.set(s.x, s.y, s.z);
        m.rotation.set(s.life * 7, s.life * 5, 0);
      });
    }

    // ================= glass (car ram) + scaffold collapse =================
    {
      const car = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId] : null;
      const spd = car ? Math.abs(car.state.speed) : 0;
      if (car && spd > 5 && !frozen) {
        GLASS_PANES.forEach((pane, i) => {
          if (glassBroken.current.has(i)) return;
          if ((car.state.x - pane.x) ** 2 + (car.state.z - pane.z) ** 2 < 2.1 ** 2) {
            breakGlass(i, true, Math.sin(car.state.heading) * Math.sign(car.state.speed), Math.cos(car.state.heading) * Math.sign(car.state.speed), Math.min(5, spd * 0.5));
          }
        });
        if (scaffold.current.state === "up" && (car.state.x - SCAFFOLD_POS.x) ** 2 + (car.state.z - SCAFFOLD_POS.z) ** 2 < 2.6 ** 2) {
          scaffold.current = { state: "falling", t: 0 };
          sfx.crash();
          addCrime("hit");
          toast("The scaffold comes down in a clatter of poles and planks!");
        }
      }
      const sc = scaffold.current;
      if (sc.state === "falling") {
        sc.t += dt;
        if (sc.t >= 0.55) { sc.state = "down"; saveDaySet(SCAFFOLD_KEY, [1]); spawnShards(SCAFFOLD_POS.x, 1, SCAFFOLD_POS.z, "#8a929a", 8, 3); }
      }
      if (scaffoldRef.current) {
        const p = sc.state === "up" ? 0 : sc.state === "down" ? 1 : Math.min(1, sc.t / 0.55);
        const e = p * p;
        scaffoldRef.current.rotation.z = e * 0.62;
        scaffoldRef.current.position.y = groundYAt(SCAFFOLD_POS.x, SCAFFOLD_POS.z) - e * 0.8;
      }
    }

    // ================= Sable Cuts (barber) + Sable Ink (tattoo) =================
    atBarber.current = false; atTattoo.current = false;
    if (onFoot && !TALK.open && !frozen) {
      const closed = shopsClosed();
      const dB = (BARBER_POS.x - px) ** 2 + (BARBER_POS.z - pz) ** 2;
      const dT = (TATTOO_POS.x - px) ** 2 + (TATTOO_POS.z - pz) ** 2;
      if (dB < 2.6 ** 2 && !prompt) {
        atBarber.current = true;
        if (closed) { prompt = "Sable Cuts — closed (opens 07:00)"; warn = true; }
        else {
          const lk = HAIR_LOOKS[lookIdx.current];
          const style = HAIR_STYLES[lk.s], color = HAIR_COLORS[lk.c];
          prompt = `E — Sable Cuts: ${style.label} · ${color.label} — $${BARBER_PRICE} (tap E browse · hold E cut)`;
          if (eDownAt.current > 0 && eHeld.current) {
            const progress = (performance.now() / 1000 - eDownAt.current) / 0.9;
            G.hold = { label: `Cutting — ${style.label}…`, progress: Math.min(1, progress) };
            if (progress >= 1) {
              eDownAt.current = -1; G.hold = null;
              if (G.cash < BARBER_PRICE) { toast(`A cut is $${BARBER_PRICE} — you're short.`); sfx.dryFire(); }
              else {
                G.cash -= BARBER_PRICE;
                setLook({ hairStyle: style.id, hairColor: color.hex });
                toast(`💈 Fresh cut: ${style.label.toLowerCase()}, ${color.label.toLowerCase()}. The harbour approves.`);
                sfx.register();
              }
            }
          } else if (G.hold?.label.startsWith("Cutting")) G.hold = null;
        }
      } else if (dT < 2.6 ** 2 && !prompt) {
        atTattoo.current = true;
        if (closed) { prompt = "Sable Ink — closed (opens 07:00)"; warn = true; }
        else if (LOOK.tattoo) {
          prompt = "E — Sable Ink: the sleeve's holding well (hold E — laser it off, free)";
          if (eDownAt.current > 0 && eHeld.current) {
            const progress = (performance.now() / 1000 - eDownAt.current) / 0.9;
            G.hold = { label: "Inking — removal…", progress: Math.min(1, progress) };
            if (progress >= 1) { eDownAt.current = -1; G.hold = null; setLook({ tattoo: false }); toast("Sleeve removed. Clean canvas again."); sfx.register(); }
          } else if (G.hold?.label.startsWith("Inking")) G.hold = null;
        } else {
          prompt = `E — Sable Ink: harbour sleeve tattoo — $${TATTOO_PRICE} (hold E)`;
          if (eDownAt.current > 0 && eHeld.current) {
            const progress = (performance.now() / 1000 - eDownAt.current) / 0.9;
            G.hold = { label: "Inking — harbour sleeve…", progress: Math.min(1, progress) };
            if (progress >= 1) {
              eDownAt.current = -1; G.hold = null;
              if (G.cash < TATTOO_PRICE) { toast(`The sleeve is $${TATTOO_PRICE} — you're short.`); sfx.dryFire(); }
              else { G.cash -= TATTOO_PRICE; setLook({ tattoo: true }); toast("🖋️ Harbour sleeve done — anchors, gulls and one questionable mermaid."); sfx.register(); }
            }
          } else if (G.hold?.label.startsWith("Inking")) G.hold = null;
        }
      }
    }

    // ---- claim the prompt last, per the chain ----
    if (!G.promptText || G.promptText === myPrompt.current) {
      G.promptText = prompt; G.promptWarn = warn; G.interact = act;
      myPrompt.current = prompt;
    } else if (myPrompt.current) {
      myPrompt.current = G.promptText === myPrompt.current ? myPrompt.current : "";
    }
  });

  const cutsSign = useMemo(() => signTexture("SABLE CUTS", "#12303f", "#ffe9c9"), []);
  const inkSign = useMemo(() => signTexture("SABLE INK", "#1c1410", "#ff9d5c"), []);
  const site = roadworksSite();

  return (
    <group>
      {/* ================= Harbour Guard SUV (6★) ================= */}
      <group ref={guardRef} visible={false}>
        <CarBody kind="suv" color="#232a31" />
        <mesh position={[0, 1.32, 0]}><boxGeometry args={[1.1, 0.12, 0.4]} /><meshStandardMaterial color="#14161a" roughness={0.5} metalness={0.4} /></mesh>
        <sprite position={[-0.32, 1.45, 0]} scale={[0.65, 0.65, 1]}><spriteMaterial map={glowTex} color="#ff2a33" transparent opacity={0.75} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
        <sprite position={[0.32, 1.45, 0]} scale={[0.65, 0.65, 1]}><spriteMaterial map={glowTex} color="#3f7fae" transparent opacity={0.75} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      </group>

      {/* ================= police boat ================= */}
      <group ref={boatRef} visible={false}>
        <CarBody kind="boat" color="#274b63" />
        <mesh position={[0, 1.06, -0.4]}><boxGeometry args={[0.9, 0.1, 0.3]} /><meshStandardMaterial color="#14161a" roughness={0.5} metalness={0.4} /></mesh>
        <sprite position={[0, 1.25, -0.4]} scale={[0.8, 0.8, 1]}><spriteMaterial map={glowTex} color="#7fb2e8" transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      </group>

      {/* ================= K9 ================= */}
      <group ref={k9Ref} visible={false}>
        <primitive object={dogRig} />
      </group>

      {/* ================= named townsfolk ================= */}
      {TOWNSFOLK.map((def, i) => (
        <group key={def.id}>
          <group ref={(n) => { npcRefs.current[i] = n; }}>
            <primitive object={npcRigs[i].group} />
          </group>
          <sprite ref={(n) => { npcLabelRefs.current[i] = n; }} visible={false} scale={[2.7, 0.68, 1]}>
            <spriteMaterial map={npcLabels[i]} transparent depthWrite={false} />
          </sprite>
        </group>
      ))}

      {/* ================= roadworks site ================= */}
      <group ref={rwRefs} position={[site.x, groundYAt(site.x, site.z), site.z]}>
        {[ -6, -3, 0, 3, 6 ].map((dz) => (
          <mesh key={dz} position={[1.75, 0.28, dz]} castShadow>
            <coneGeometry args={[0.26, 0.56, 10]} /><meshStandardMaterial color="#d96c2e" roughness={0.7} />
          </mesh>
        ))}
        {[-7.6, 7.6].map((dz) => (
          <group key={dz} position={[1.75, 0, dz]}>
            <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[2.7, 0.42, 0.12]} /><meshStandardMaterial color="#e8e4da" roughness={0.6} /></mesh>
            <mesh position={[0, 0.55, 0.07]}><boxGeometry args={[2.7, 0.14, 0.02]} /><meshStandardMaterial color="#d96c2e" roughness={0.6} /></mesh>
            {[-1.1, 1.1].map((dx) => <mesh key={dx} position={[dx, 0.25, 0]}><boxGeometry args={[0.12, 0.5, 0.12]} /><meshStandardMaterial color="#3a3f45" roughness={0.7} /></mesh>)}
            <sprite position={[0, 1.15, 0]} scale={[0.7, 0.7, 1]}><spriteMaterial map={glowTex} color="#ffb340" transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
          </group>
        ))}
        {/* the digger: tracks, cab, boom + bucket, parked mid-dig */}
        <group position={[2.1, 0, 0.5]} rotation={[0, Math.PI, 0]}>
          <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[1.5, 0.5, 2.3]} /><meshStandardMaterial color="#2e2a24" roughness={0.8} /></mesh>
          <mesh position={[0, 0.85, -0.3]} castShadow><boxGeometry args={[1.6, 0.6, 1.9]} /><meshStandardMaterial color="#c9922e" roughness={0.55} metalness={0.3} /></mesh>
          <mesh position={[-0.35, 1.45, 0.3]} castShadow><boxGeometry args={[0.85, 0.6, 0.9]} /><meshStandardMaterial color="#c9922e" roughness={0.55} metalness={0.3} /></mesh>
          <mesh position={[-0.35, 1.5, 0.35]}><boxGeometry args={[0.7, 0.42, 0.7]} /><meshStandardMaterial color="#141f28" roughness={0.15} metalness={0.4} /></mesh>
          <mesh position={[0.1, 1.3, 1.35]} rotation={[0.7, 0, 0]} castShadow><boxGeometry args={[0.28, 0.28, 1.7]} /><meshStandardMaterial color="#c9922e" roughness={0.55} metalness={0.3} /></mesh>
          <mesh position={[0.35, 0.75, 2]} rotation={[1.2, 0, 0]} castShadow><boxGeometry args={[0.22, 0.22, 1.1]} /><meshStandardMaterial color="#8a6a24" roughness={0.6} metalness={0.3} /></mesh>
        </group>
        {/* spoil heap */}
        <mesh position={[-1.8, 0.35, -2]} castShadow><coneGeometry args={[1.5, 0.75, 9]} /><meshStandardMaterial color="#6e5136" roughness={1} flatShading /></mesh>
      </group>
      {rwWorkers.map((rig, i) => (
        <group key={i} ref={(n) => { rwWorkerRefs.current[i] = n; }}>
          <primitive object={rig.group} />
        </group>
      ))}

      {/* ================= wreck smoke pool ================= */}
      {[0, 1, 2, 3].map((i) => (
        <sprite key={i} ref={(n) => { smokeRefs.current[i] = n; }} visible={false}>
          <spriteMaterial map={glowTex} color="#2c2f33" transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}

      {/* ================= breakable shopfront glass (Coral row) ================= */}
      {GLASS_PANES.map((pane, i) => (
        <mesh key={i} ref={(n) => { glassRefs.current[i] = n; }} position={[pane.x, 1.15, pane.z - 0.08]}>
          <boxGeometry args={[2.8, 2.3, 0.05]} />
          <meshStandardMaterial color="#9fc6d4" roughness={0.08} metalness={0.35} transparent opacity={0.5} emissive="#3d6a7a" emissiveIntensity={0.25} />
        </mesh>
      ))}

      {/* ================= collapsible scaffold (Lantern Park works) ================= */}
      <group ref={scaffoldRef} position={[SCAFFOLD_POS.x, groundYAt(SCAFFOLD_POS.x, SCAFFOLD_POS.z), SCAFFOLD_POS.z]}>
        {([[-1.1, -0.8], [1.1, -0.8], [-1.1, 0.8], [1.1, 0.8]] as const).map(([x, z], i) => (
          <mesh key={i} position={[x, 2.1, z]} castShadow><cylinderGeometry args={[0.06, 0.06, 4.2, 8]} /><meshStandardMaterial color="#8a929a" metalness={0.6} roughness={0.45} /></mesh>
        ))}
        {[1.4, 2.8, 4.2].map((y) => (
          <mesh key={y} position={[0, y, 0]} castShadow><boxGeometry args={[2.6, 0.09, 1.9]} /><meshStandardMaterial color="#a3764f" roughness={0.9} /></mesh>
        ))}
        <mesh position={[0, 2.1, -0.85]} rotation={[0, 0, 0.5]}><boxGeometry args={[0.07, 4.4, 0.07]} /><meshStandardMaterial color="#8a929a" metalness={0.6} roughness={0.45} /></mesh>
        <mesh position={[0.7, 4.45, 0.3]} castShadow><cylinderGeometry args={[0.22, 0.18, 0.34, 10]} /><meshStandardMaterial color="#b3402e" roughness={0.6} /></mesh>
      </group>

      {/* ================= the thrown bottle ================= */}
      <group ref={bottleRef} visible={false}>
        <mesh castShadow><cylinderGeometry args={[0.075, 0.085, 0.42, 8]} /><meshStandardMaterial color="#2e6b46" roughness={0.25} metalness={0.1} /></mesh>
        <mesh position={[0, 0.28, 0]}><cylinderGeometry args={[0.03, 0.06, 0.16, 8]} /><meshStandardMaterial color="#2e6b46" roughness={0.25} metalness={0.1} /></mesh>
      </group>
      {/* shard pool (bottle glass, shopfront glass, scaffold bits) */}
      {shards.current.map((_, i) => (
        <mesh key={i} ref={(n) => { shardRefs.current[i] = n; }} visible={false}>
          <tetrahedronGeometry args={[0.1]} />
          <meshStandardMaterial color="#7fae7f" roughness={0.3} />
        </mesh>
      ))}

      {/* ================= Sable Cuts + Sable Ink (Market Row) ================= */}
      <group position={[BARBER_POS.x, groundYAt(BARBER_POS.x, BARBER_POS.z), BARBER_POS.z]}>
        {/* barber chair */}
        <mesh position={[0, 0.28, 0]} castShadow><cylinderGeometry args={[0.3, 0.34, 0.12, 12]} /><meshStandardMaterial color="#3a3f45" metalness={0.5} roughness={0.4} /></mesh>
        <mesh position={[0, 0.62, 0]} castShadow><boxGeometry args={[0.62, 0.14, 0.58]} /><meshStandardMaterial color="#7a2440" roughness={0.6} /></mesh>
        <mesh position={[0, 1.05, -0.3]} castShadow><boxGeometry args={[0.62, 0.85, 0.12]} /><meshStandardMaterial color="#7a2440" roughness={0.6} /></mesh>
        {/* striped pole */}
        <group position={[1.15, 0, 0.5]}>
          <mesh position={[0, 0.75, 0]}><cylinderGeometry args={[0.02, 0.02, 1.5, 6]} /><meshStandardMaterial color="#22262b" /></mesh>
          <mesh position={[0, 1.32, 0]}><cylinderGeometry args={[0.11, 0.11, 0.3, 10]} /><meshStandardMaterial color="#c22e2e" roughness={0.4} /></mesh>
          <mesh position={[0, 1.02, 0]}><cylinderGeometry args={[0.11, 0.11, 0.3, 10]} /><meshStandardMaterial color="#e8e4da" roughness={0.4} /></mesh>
          <mesh position={[0, 0.72, 0]}><cylinderGeometry args={[0.11, 0.11, 0.3, 10]} /><meshStandardMaterial color="#2e7fb8" roughness={0.4} /></mesh>
        </group>
        <mesh position={[0, 2.15, -0.75]}><planeGeometry args={[2.6, 0.65]} /><meshStandardMaterial map={cutsSign} side={THREE.DoubleSide} roughness={0.85} /></mesh>
      </group>
      <group position={[TATTOO_POS.x, groundYAt(TATTOO_POS.x, TATTOO_POS.z), TATTOO_POS.z]}>
        <mesh position={[0, 0.32, 0]} castShadow><cylinderGeometry args={[0.26, 0.26, 0.09, 12]} /><meshStandardMaterial color="#22262b" roughness={0.6} /></mesh>
        <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.05, 0.05, 0.32, 8]} /><meshStandardMaterial color="#3a3f45" metalness={0.5} roughness={0.4} /></mesh>
        <mesh position={[0.8, 0.5, 0.2]} castShadow><boxGeometry args={[0.7, 0.06, 0.45]} /><meshStandardMaterial color="#4c3b28" roughness={0.8} /></mesh>
        <mesh position={[0.8, 0.25, 0.2]}><boxGeometry args={[0.06, 0.5, 0.4]} /><meshStandardMaterial color="#4c3b28" roughness={0.8} /></mesh>
        <mesh position={[0, 2.15, -0.75]}><planeGeometry args={[2.6, 0.65]} /><meshStandardMaterial map={inkSign} side={THREE.DoubleSide} roughness={0.85} /></mesh>
      </group>
    </group>
  );
}
