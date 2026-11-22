// Harborfall — combat lite (Phase 3, Blueprint §5): fists + one pistol.
// On foot: left-click or J punches (arm swing in Player reads G.punchT);
// a glowing pistol pickup (mansion drive + docks) arms Rayan — click/J
// then fires an arcade hitscan with muzzle flash, tracer and sparks.
// No gore: peds tip over, get up, and run. Crime flows through the
// witness-aware addCrime() in the store.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { G, addCrime, toast } from "../game/store";
import { MANSION } from "../world";
import { glowTexture } from "../textures";
import { sfx } from "../game/audio";
import { isInteractiveTarget } from "../keyboard";

const PICKUPS: [number, number][] = [
  [MANSION.x - 4.5, MANSION.z + 6.5], // mansion drive
  [57, 107.5],                        // the docks, by the container stacks
];
const RESPAWN_S = 60;

export default function Combat({ enabled }: { enabled: boolean }) {
  const enabledRef = useRef(enabled); enabledRef.current = enabled;
  const pickupRefs = useRef<Array<THREE.Group | null>>([]);
  const pickupReadyAt = useRef<number[]>([0, 0]);
  const flashRef = useRef<THREE.Sprite>(null);
  const sparkRef = useRef<THREE.Sprite>(null);
  const tracerRef = useRef<THREE.Line>(null);
  const glowTex = useMemo(() => glowTexture(), []);
  const tracerGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, -10, 0)]), []);
  const atkCd = useRef(0);

  useEffect(() => {
    const canAttack = () => enabledRef.current && !G.driving && !G.dialogueActive && !G.status && !G.interior;
    const facing = () => ({ x: Math.sin(G.playerHeading), z: Math.cos(G.playerHeading) });

    const knockPed = (px: number, pz: number, fx: number, fz: number, range: number, perp: number) => {
      let best = -1; let bestD = range;
      G.peds.forEach((ped, i) => {
        if (!ped.active || G.timeS < ped.downUntil) return;
        const dx = ped.x - px, dz = ped.z - pz;
        const along = dx * fx + dz * fz;
        if (along < 0.2 || along > range) return;
        const side = Math.abs(dx * fz - dz * fx);
        if (side < perp && along < bestD) { bestD = along; best = i; }
      });
      return best;
    };
    const hitCarAlong = (px: number, pz: number, fx: number, fz: number, range: number): { x: number; z: number } | null => {
      let bestD = range; let hit: { x: number; z: number } | null = null;
      const test = (x: number, z: number, r: number) => {
        const dx = x - px, dz = z - pz;
        const along = dx * fx + dz * fz;
        if (along < 0.4 || along > bestD) return;
        if (Math.abs(dx * fz - dz * fx) < r) { bestD = along; hit = { x: px + fx * along, z: pz + fz * along }; }
      };
      for (const c of G.cars) test(c.state.x, c.state.z, 1.7);
      for (const c of G.traffic) test(c.x, c.z, 1.7);
      return hit;
    };

    const punch = () => {
      const t = performance.now() / 1000;
      if (t < atkCd.current) return;
      atkCd.current = t + 0.34;
      G.punchT = t;
      sfx.punch();
      const { x: fx, z: fz } = facing();
      const px = G.playerPos.x, pz = G.playerPos.z;
      const pi = knockPed(px, pz, fx, fz, 1.9, 0.85);
      if (pi >= 0) {
        const ped = G.peds[pi];
        ped.downUntil = G.timeS + 4; ped.fleeUntil = G.timeS + 10;
        addCrime("assault");
        sfx.thud();
        return;
      }
      // dent the nearest vehicle instead
      let bd = 2.1 ** 2; let bc = -1;
      G.cars.forEach((c, i) => { const d = (c.state.x - px) ** 2 + (c.state.z - pz) ** 2; if (d < bd) { bd = d; bc = i; } });
      if (bc >= 0) {
        G.cars[bc].damage = Math.min(100, G.cars[bc].damage + 4);
        G.shotFx = { t, mx: px + fx * 0.6, mz: pz + fz * 0.6, hx: G.cars[bc].state.x, hz: G.cars[bc].state.z, hit: true };
        addCrime("hit");
        sfx.thud();
      }
    };

    const fire = () => {
      const t = performance.now() / 1000;
      if (t < atkCd.current) return;
      if (!G.armed) { punch(); return; }
      atkCd.current = t + 0.26;
      if (G.ammo <= 0) { sfx.dryFire(); return; }
      G.ammo -= 1;
      sfx.shot();
      const { x: fx, z: fz } = facing();
      const px = G.playerPos.x, pz = G.playerPos.z;
      const mx = px + fx * 0.55, mz = pz + fz * 0.55;
      const pi = knockPed(px, pz, fx, fz, 32, 0.85);
      const pedDist = pi >= 0 ? Math.hypot(G.peds[pi].x - px, G.peds[pi].z - pz) : Infinity;
      const carHit = hitCarAlong(px, pz, fx, fz, 32);
      const carDist = carHit ? Math.hypot(carHit.x - px, carHit.z - pz) : Infinity;
      if (pi >= 0 && pedDist <= carDist) {
        const ped = G.peds[pi];
        ped.downUntil = G.timeS + 5; ped.fleeUntil = G.timeS + 11;
        G.shotFx = { t, mx, mz, hx: ped.x, hz: ped.z, hit: true };
        addCrime("shoot");
      } else if (carHit) {
        let bd = 3 ** 2;
        for (const c of G.cars) { const d = (c.state.x - carHit.x) ** 2 + (c.state.z - carHit.z) ** 2; if (d < bd) { bd = d; c.damage = Math.min(100, c.damage + 8); } }
        G.shotFx = { t, mx, mz, hx: carHit.x, hz: carHit.z, hit: true };
        addCrime("hit");
      } else {
        G.shotFx = { t, mx, mz, hx: px + fx * 30, hz: pz + fz * 30, hit: false };
      }
    };

    const onMouse = (e: MouseEvent) => {
      if (e.button !== 0 || !canAttack()) return;
      if ((e.target as HTMLElement | null)?.tagName !== "CANVAS") return; // canvas only — HUD clicks are safe
      fire();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || isInteractiveTarget(e.target) || !canAttack()) return;
      if (e.key.toLowerCase() === "j") fire();
    };
    window.addEventListener("mousedown", onMouse);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onMouse); window.removeEventListener("keydown", onKey); };
  }, []);

  useFrame(() => {
    const t = performance.now() / 1000;
    // pistol pickups: spin + bob; walking over one arms Rayan (+24 shells)
    PICKUPS.forEach(([x, z], i) => {
      const g = pickupRefs.current[i]; if (!g) return;
      const ready = G.timeS >= pickupReadyAt.current[i];
      g.visible = ready;
      if (!ready) return;
      g.rotation.y = t * 1.6;
      g.position.y = 0.75 + Math.sin(t * 2.4 + i * 2) * 0.12;
      if (!G.driving && !G.interior && (G.playerPos.x - x) ** 2 + (G.playerPos.z - z) ** 2 < 2.2 ** 2) {
        pickupReadyAt.current[i] = G.timeS + RESPAWN_S;
        G.armed = true;
        G.ammo = Math.min(72, G.ammo + 24);
        sfx.pickup();
        toast("🔫 Pistol acquired — click or J to fire (+24 shells)");
      }
    });
    // shot FX: muzzle flash (60ms), tracer (80ms), impact sparks (120ms)
    const fx = G.shotFx;
    const age = t - fx.t;
    if (flashRef.current) {
      const on = age >= 0 && age < 0.06 && G.armed;
      flashRef.current.visible = on;
      if (on) flashRef.current.position.set(fx.mx, 1.35, fx.mz);
    }
    if (sparkRef.current) {
      const on = age >= 0 && age < 0.12 && fx.hit;
      sparkRef.current.visible = on;
      if (on) sparkRef.current.position.set(fx.hx, 0.9, fx.hz);
    }
    if (tracerRef.current) {
      const on = age >= 0 && age < 0.08 && G.armed;
      tracerRef.current.visible = on;
      if (on) {
        const pos = tracerRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
        pos.setXYZ(0, fx.mx, 1.35, fx.mz);
        pos.setXYZ(1, fx.hx, 0.9, fx.hz);
        pos.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      {PICKUPS.map(([x, z], i) => (
        <group key={i} ref={(n) => { pickupRefs.current[i] = n; }} position={[x, 0.75, z]}>
          {/* low-poly pistol: grip + slide + barrel */}
          <mesh position={[0, -0.05, 0.1]} rotation={[0.5, 0, 0]} castShadow><boxGeometry args={[0.07, 0.22, 0.09]} /><meshStandardMaterial color="#22262b" metalness={0.6} roughness={0.35} /></mesh>
          <mesh position={[0, 0.05, 0.02]} castShadow><boxGeometry args={[0.06, 0.08, 0.34]} /><meshStandardMaterial color="#3a4046" metalness={0.7} roughness={0.3} /></mesh>
          <mesh position={[0, 0.03, 0.22]}><boxGeometry args={[0.045, 0.05, 0.12]} /><meshStandardMaterial color="#14161a" metalness={0.6} roughness={0.4} /></mesh>
          <sprite scale={[1.5, 1.5, 1]}><spriteMaterial map={glowTex} color="#ffd166" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
        </group>
      ))}
      <sprite ref={flashRef} visible={false} scale={[0.85, 0.85, 1]}>
        <spriteMaterial map={glowTex} color="#ffca7a" transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite ref={sparkRef} visible={false} scale={[0.7, 0.7, 1]}>
        <spriteMaterial map={glowTex} color="#ffb703" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {/* @ts-expect-error R3F line element */}
      <line ref={tracerRef} geometry={tracerGeo} visible={false}>
        <lineBasicMaterial color="#ffe9a8" transparent opacity={0.75} />
      </line>
    </group>
  );
}
