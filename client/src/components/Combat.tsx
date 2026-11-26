// Harborfall — combat (Phase 3 fists + pistol; Phase 6 round 2: SMG +
// shotgun, per-weapon ammo, 4-slot Q selector). On foot: left-click or J
// attacks; the SMG keeps firing while held. Arcade hitscan with muzzle
// flash (+ a pooled point light), tracer and sparks. No gore: peds
// flinch, tip over, get up, and run. Crime flows through the
// witness-aware addCrime() in the store.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { G, addCrime, toast, syncWeaponMirrors, type WeaponKind } from "../game/store";
import { MANSION, GUN_STORE, isBlocked } from "../world";
import { glowTexture } from "../textures";
import { sfx } from "../game/audio";
import { isInteractiveTarget } from "../keyboard";
import { WMOD, BOTTLE, syncBottles } from "../game/phase9";
import { tryBreakDestructibleAt } from "../game/destruct";

interface WeaponSpec {
  cd: number; range: number; perp: number; spreadRad: number;
  carDmg: number; pedDown: number; pellets: number; recoil: number;
  sfxFire: () => void;
}
const WEAPONS: Record<WeaponKind, WeaponSpec> = {
  pistol: { cd: 0.26, range: 32, perp: 0.85, spreadRad: 0, carDmg: 8, pedDown: 5, pellets: 1, recoil: 0.05, sfxFire: () => sfx.shot() },
  smg: { cd: 0.095, range: 30, perp: 1.7, spreadRad: 0.055, carDmg: 4, pedDown: 4, pellets: 1, recoil: 0.03, sfxFire: () => sfx.smg() },
  shotgun: { cd: 0.85, range: 17, perp: 1.1, spreadRad: 0.17, carDmg: 5, pedDown: 6, pellets: 5, recoil: 0.17, sfxFire: () => sfx.blast() },
  // Phase 33: the KESTREL CARBINE — an original Sable Arms mid-tier
  // automatic between the SMG and the shotgun in role: slower cycle
  // than the SMG (0.14 vs 0.095) but longer reach (38 vs 30), a
  // tighter cone and a heavier single hit. Ammo is PER-KIND in this
  // build (G.weaponAmmo is keyed by weapon, there is no class pool
  // and no rifle class), so the carbine carries its own pool, capped
  // at 240 like the others — stated plainly, not dressed as shared.
  carbine: { cd: 0.14, range: 38, perp: 1.1, spreadRad: 0.03, carDmg: 6, pedDown: 5, pellets: 1, recoil: 0.045, sfxFire: () => sfx.carbine() },
  // Phase 8 bat: fire() routes to swingBat() before this spec is used —
  // the entry exists so the Record stays complete (wider, slower, heavy)
  bat: { cd: 0.55, range: 2.6, perp: 1.5, spreadRad: 0, carDmg: 9, pedDown: 6, pellets: 1, recoil: 0.04, sfxFire: () => sfx.batSwing() },
  // Phase 9 bottles: fire() routes to throwBottle() — entry for completeness
  bottle: { cd: 0.45, range: 14, perp: 1, spreadRad: 0, carDmg: 3, pedDown: 3, pellets: 1, recoil: 0, sfxFire: () => sfx.batSwing() },
};
/** Phase 9: Sable Arms mods reshape the base specs (bought once,
 * persisted in game/phase9.ts WMOD). */
function specFor(sel: WeaponKind): WeaponSpec {
  const base = WEAPONS[sel];
  if (sel === "pistol" && WMOD.sightsPistol) return { ...base, perp: 0.6, range: 38 };
  if (sel === "smg" && WMOD.magSmg) return { ...base, cd: 0.08, spreadRad: 0.038 };
  if (sel === "shotgun" && WMOD.chokeShotgun) return { ...base, spreadRad: 0.1, range: 21 };
  if (sel === "carbine" && WMOD.gripCarbine) return { ...base, spreadRad: 0.018, range: 44, recoil: 0.03 };
  return base;
}
const suppressedFor = (sel: WeaponKind) => (sel === "pistol" && WMOD.suppPistol) || (sel === "smg" && WMOD.suppSmg) || (sel === "carbine" && WMOD.suppCarbine);
interface Pickup { x: number; z: number; kind: WeaponKind; ammo: number; label: string; }
const PICKUPS: Pickup[] = [
  { x: MANSION.x - 4.5, z: MANSION.z + 6.5, kind: "pistol", ammo: 24, label: "Pistol" }, // mansion drive
  { x: 57, z: 107.5, kind: "pistol", ammo: 24, label: "Pistol" },                        // the docks
  { x: GUN_STORE.x + 1, z: GUN_STORE.z + 3, kind: "smg", ammo: 60, label: "SMG" },       // Sable Arms, Northgate
  { x: -13, z: -33, kind: "shotgun", ammo: 12, label: "Shotgun" },                       // alley off Lantern St
  { x: 74, z: -68, kind: "bat", ammo: 0, label: "Baseball bat" },                        // Phase 8: Lantern Park, by the outdoor gym
  { x: 47, z: 108, kind: "bottle", ammo: 6, label: "Bottles" },                         // Phase 9: crate of empties by Club Solace
  { x: 10, z: 118, kind: "bottle", ammo: 6, label: "Bottles" },                         // Phase 9: pier-side crate
  { x: -75.5, z: 96.5, kind: "carbine", ammo: 40, label: "Kestrel Carbine" },           // Phase 33: the mansion drive's east end — the same proven-open strip as the pistol pickup (point-tested in the placement audit)
];
const RESPAWN_S = 60;

export default function Combat({ enabled }: { enabled: boolean }) {
  const enabledRef = useRef(enabled); enabledRef.current = enabled;
  const pickupRefs = useRef<Array<THREE.Group | null>>([]);
  const pickupReadyAt = useRef<number[]>(PICKUPS.map(() => 0));
  const flashRef = useRef<THREE.Sprite>(null);
  const sparkRef = useRef<THREE.Sprite>(null);
  const tracerRef = useRef<THREE.Line>(null);
  const muzzleLight = useRef<THREE.PointLight>(null);
  const glowTex = useMemo(() => glowTexture(), []);
  const tracerGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, -10, 0)]), []);
  const atkCd = useRef(0);
  const held = useRef({ mouse: false, j: false });
  const fireRef = useRef<() => void>(() => {});
  // Phase 9: free-aim reads the live camera; suppressed shots skip the
  // muzzle-flash FX (the flag tracks the most recent shot only)
  const camera = useThree((s) => s.camera);
  const camRef = useRef(camera); camRef.current = camera;
  const suppressedFx = useRef(false);
  // Phase 33: suppression heat (timestamps of recent shots, the
  // stacking/decay model lives in fire()) + the last weapon fired
  // (the FX block tints the carbine's flash/tracer teal).
  const recentShots = useRef<number[]>([]);
  const lastFired = useRef<WeaponKind>("pistol");

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

    // ---- Phase 8: the baseball bat — 5th Q slot. Wider, slower arc
    // than a fist, real knockback (the ped is SHOVED, with a fall), a
    // heavier dent on cars, no ammo ever. Crime class is assault, but
    // the swing is loud: witnesses react as if it were one class worse
    // (the store's memory hook already weights assault heavily). ----
    const swingBat = () => {
      const t = performance.now() / 1000;
      if (t < atkCd.current) return;
      atkCd.current = t + 0.55;
      G.punchT = t; // Player pose reads this — bat branch there
      sfx.batSwing();
      const { x: fx, z: fz } = facing();
      const px = G.playerPos.x, pz = G.playerPos.z;
      const strong = G.skills.strength >= 50;
      const pi = knockPed(px, pz, fx, fz, 2.6, 1.5);
      if (pi >= 0) {
        const ped = G.peds[pi];
        ped.downUntil = G.timeS + (strong ? 7 : 6); ped.fleeUntil = G.timeS + 12; ped.flinchUntil = G.timeS + 0.4;
        // knockback: shove the ped along the swing, if the landing is free
        const nx = ped.x + fx * 1.6, nz = ped.z + fz * 1.6;
        ped.x = nx; ped.z = nz;
        // Phase 14: the shove's momentum seeds the verlet ragdoll
        ped.kvx = fx * 5; ped.kvz = fz * 5;
        addCrime("assault");
        sfx.batHit();
        if (G.settings.shake) G.shakeAmp = Math.min(0.4, G.shakeAmp + 0.08);
        return;
      }
      // Phase 14: the bat takes destructible props apart too — the
      // same shared break path as a car ram (debris + day persistence)
      if (tryBreakDestructibleAt(px + fx * 1.8, pz + fz * 1.8, 1.5, fx, fz, 3)) {
        addCrime("hit");
        sfx.batHit();
        return;
      }
      let bd = 2.8 ** 2; let bc = -1;
      G.cars.forEach((c, i) => { const d = (c.state.x - px) ** 2 + (c.state.z - pz) ** 2; if (d < bd) { bd = d; bc = i; } });
      if (bc >= 0) {
        G.cars[bc].damage = Math.min(100, G.cars[bc].damage + 9);
        G.shotFx = { t, mx: px + fx * 0.7, mz: pz + fz * 0.7, hx: G.cars[bc].state.x, hz: G.cars[bc].state.z, hit: true };
        addCrime("hit");
        sfx.batHit();
      }
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
        // Phase 8: Strength ≥ 50 (gym) — fists put peds down longer
        ped.downUntil = G.timeS + (G.skills.strength >= 50 ? 5.5 : 4); ped.fleeUntil = G.timeS + 10; ped.flinchUntil = G.timeS + 0.35;
        ped.kvx = fx * 2.5; ped.kvz = fz * 2.5; // Phase 14: ragdoll seed momentum
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

    // ---- Phase 9: thrown bottles — the 6th Q slot. A lobbed arc
    // (gravity integrated in Phase9's renderer); the impact rules live
    // there too: ped hit = assault, car hit = criminal damage, bare
    // ground = a scare and a mess, no crime class for littering. ----
    const throwBottle = () => {
      const t = performance.now() / 1000;
      if (t < atkCd.current) return;
      atkCd.current = t + 0.45;
      if (G.weaponAmmo.bottle <= 0) { sfx.dryFire(); return; }
      G.weaponAmmo.bottle -= 1;
      syncBottles();
      G.punchT = t; // the throw uses the punch arm-swing pose channel
      const f = facing();
      BOTTLE.active = true;
      BOTTLE.x = G.playerPos.x + f.x * 0.5; BOTTLE.z = G.playerPos.z + f.z * 0.5; BOTTLE.y = 1.55;
      BOTTLE.vx = f.x * 13; BOTTLE.vz = f.z * 13; BOTTLE.vy = 4.6; BOTTLE.spin = 0;
      sfx.batSwing(); // whoosh — the closest foley in the kit
    };

    const fire = () => {
      const t = performance.now() / 1000;
      if (t < atkCd.current) return;
      const sel = G.weaponSel;
      if (sel === "bat" && G.weaponOwned.bat) { swingBat(); return; }
      if (sel === "bottle" && G.weaponOwned.bottle) { throwBottle(); return; }
      if (sel === "fist" || !G.weaponOwned[sel]) { punch(); return; }
      const spec = specFor(sel);
      atkCd.current = t + spec.cd;
      if (G.weaponAmmo[sel] <= 0) { sfx.dryFire(); return; }
      G.weaponAmmo[sel] -= 1;
      G.skillShootAcc += 1; // Shooting skill grows by trigger time (A7)
      syncWeaponMirrors();
      spec.sfxFire();
      const suppressed = suppressedFor(sel);
      suppressedFx.current = suppressed;
      // recoil: camera micro-shake through the shared shake channel
      if (G.settings.shake) G.shakeAmp = Math.min(0.5, G.shakeAmp + spec.recoil);
      let base = facing();
      // Phase 9 free-aim: while aiming, shots travel the camera ray
      // (projected to the ground plane) instead of the character facing
      if (G.aiming) {
        const d = new THREE.Vector3();
        camRef.current.getWorldDirection(d);
        const len = Math.hypot(d.x, d.z);
        if (len > 0.05) base = { x: d.x / len, z: d.z / len };
      }
      const px = G.playerPos.x, pz = G.playerPos.z;
      // ---- Phase 44: AIM ASSIST (Settings → Assists) — magnetism,
      // NOT lock-on. The combat model is hitscan along a direction:
      // fire() resolves each pellet against a perpendicular corridor
      // around the shot ray (knockPed), so the honest place to help
      // is the ray itself. While FREE-AIMING (G.aiming — the mode
      // with a crosshair), the shot direction is pulled part-way
      // toward the nearest standing ped inside a small cone around
      // it (Soft: ~5.7° cone, 45% pull; Strong: ~11°, 70% pull),
      // provided the segment to that ped is clear of the blocker
      // set — the same isBlocked AABBs the cover system and the
      // camera guard read, so the assist never bends a shot around
      // or through a wall, never snaps the remaining distance, and
      // never tracks: it adjusts THIS shot's direction once, at the
      // trigger pull, by a fraction of the offset. Hip fire (not
      // aiming) follows the character's facing and is never
      // assisted. Off (the default) skips the block entirely. ----
      if (G.aiming && G.settings.aimAssist !== "off") {
        const strong = G.settings.aimAssist === "strong";
        const cone = strong ? 0.19 : 0.10;
        const pull = strong ? 0.7 : 0.45;
        const baseAng = Math.atan2(base.x, base.z);
        let bestDist = Infinity, bestOff = 0, found = false;
        for (const ped of G.peds) {
          if (!ped.active || G.timeS < ped.downUntil) continue;
          const dx = ped.x - px, dz = ped.z - pz;
          const dist = Math.hypot(dx, dz);
          if (dist < 1 || dist > spec.range) continue;
          let da = Math.atan2(dx, dz) - baseAng;
          da = Math.atan2(Math.sin(da), Math.cos(da)); // wrap to [-π, π]
          if (Math.abs(da) > cone) continue;
          // line of sight: sample the segment against the blockers
          let blocked = false;
          const steps = Math.ceil(dist / 1.2);
          for (let s = 1; s < steps; s++) {
            const k2 = s / steps;
            if (isBlocked(px + dx * k2, pz + dz * k2, 0.3)) { blocked = true; break; }
          }
          if (blocked) continue;
          if (dist < bestDist) { bestDist = dist; bestOff = da; found = true; }
        }
        if (found) {
          const na = baseAng + bestOff * pull;
          base = { x: Math.sin(na), z: Math.cos(na) };
        }
      }
      const mx = px + base.x * 0.55, mz = pz + base.z * 0.55;
      // Shooting skill ≥50 tightens every cone by 15% (A7)
      const skillMul = G.skills.shooting >= 50 ? 0.85 : 1;
      let anyHit = false;
      let fxHit: { x: number; z: number } | null = null;
      for (let p = 0; p < spec.pellets; p++) {
        const ang = Math.atan2(base.x, base.z) + (spec.spreadRad > 0 ? (Math.random() - 0.5) * 2 * spec.spreadRad * skillMul : 0);
        const fx = Math.sin(ang), fz = Math.cos(ang);
        const perp = spec.perp * skillMul;
        const pi = knockPed(px, pz, fx, fz, spec.range, perp);
        const pedDist = pi >= 0 ? Math.hypot(G.peds[pi].x - px, G.peds[pi].z - pz) : Infinity;
        const carHit = hitCarAlong(px, pz, fx, fz, spec.range);
        const carDist = carHit ? Math.hypot(carHit.x - px, carHit.z - pz) : Infinity;
        if (pi >= 0 && pedDist <= carDist) {
          const ped = G.peds[pi];
          ped.downUntil = G.timeS + spec.pedDown; ped.fleeUntil = G.timeS + 11; ped.flinchUntil = G.timeS + 0.4;
          ped.kvx = fx * 3.5; ped.kvz = fz * 3.5; // Phase 14: ragdoll seed momentum
          fxHit = { x: ped.x, z: ped.z }; anyHit = true;
        } else if (carHit) {
          let bd = 3 ** 2;
          for (const c of G.cars) { const d = (c.state.x - carHit.x) ** 2 + (c.state.z - carHit.z) ** 2; if (d < bd) { bd = d; c.damage = Math.min(100, c.damage + spec.carDmg); } }
          for (const c of G.traffic) { const d = (c.x - carHit.x) ** 2 + (c.z - carHit.z) ** 2; if (d < 3 ** 2) c.damage = Math.min(100, c.damage + spec.carDmg); }
          fxHit = carHit; anyHit = true;
        }
      }
      // bystanders near the impact flinch even on a near miss (A6)
      if (fxHit) {
        for (const ped of G.peds) {
          if (ped.active && (ped.x - fxHit.x) ** 2 + (ped.z - fxHit.z) ** 2 < 3.2 ** 2) ped.flinchUntil = Math.max(ped.flinchUntil ?? 0, G.timeS + 0.3);
        }
      }
      // ---- Phase 33: SUPPRESSION-LITE. A shot that hits nobody can
      // still break the nerve of everyone near it. The model, in the
      // open: peds inside the NEAR-MISS band (within 4.5u of where
      // the shot ended) roll to flee at 50%; peds who only HEAR it
      // (within 11u of the muzzle) roll at 18%. SUSTAINED fire
      // stacks — each other shot inside the last 3 s adds +10% (cap
      // +30%) — and the shot list ageing out IS the decay. A
      // suppressed weapon halves both chances (quieter — the same
      // fiction the soft crime path uses). A ped who breaks flees
      // 5–8 s through the ordinary fleeUntil channel; downed peds
      // don't roll. Police pressure is deliberately NOT modelled
      // here: every shot already flows through the one witness path
      // (addCrime → applyCrime → Phase 29 heat), and this pass adds
      // no crime, no wanted and no evidence of its own.
      {
        recentShots.current = recentShots.current.filter((s) => t - s < 3);
        const heatBonus = Math.min(0.3, recentShots.current.length * 0.1);
        recentShots.current.push(t);
        const endX = fxHit ? fxHit.x : px + base.x * spec.range;
        const endZ = fxHit ? fxHit.z : pz + base.z * spec.range;
        const quiet = suppressed ? 0.5 : 1;
        for (const ped of G.peds) {
          if (!ped.active || G.timeS < ped.downUntil) continue;
          const nearMiss = (ped.x - endX) ** 2 + (ped.z - endZ) ** 2 < 4.5 ** 2;
          const heard = (ped.x - px) ** 2 + (ped.z - pz) ** 2 < 11 ** 2;
          if (!nearMiss && !heard) continue;
          if (Math.random() < ((nearMiss ? 0.5 : 0.18) + heatBonus) * quiet)
            ped.fleeUntil = Math.max(ped.fleeUntil ?? 0, G.timeS + 5 + Math.random() * 3);
        }
      }
      lastFired.current = sel;
      G.shotFx = { t, mx, mz, hx: fxHit ? fxHit.x : px + base.x * 30, hz: fxHit ? fxHit.z : pz + base.z * 30, hit: anyHit };
      // Phase 9: a suppressed shot is only as known as its witnesses
      addCrime("shoot", suppressed);
    };
    fireRef.current = fire;

    const onMouse = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement | null)?.tagName !== "CANVAS") return; // canvas only — HUD clicks are safe
      held.current.mouse = true;
      if (canAttack()) fire();
    };
    const onMouseUp = () => { held.current.mouse = false; };
    const onKey = (e: KeyboardEvent) => {
      if (isInteractiveTarget(e.target)) return;
      if (e.key.toLowerCase() === "j") {
        held.current.j = !e.repeat && e.type === "keydown" ? true : held.current.j;
        if (e.type === "keyup") held.current.j = false;
        if (e.type === "keydown" && !e.repeat && canAttack()) fire();
      }
    };
    window.addEventListener("mousedown", onMouse);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("mousedown", onMouse);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  useFrame(() => {
    const t = performance.now() / 1000;
    // SMG full-auto: keep firing while the trigger is held (A6).
    // Phase 33: the carbine is an automatic too — same held fire.
    if ((held.current.mouse || held.current.j) && (G.weaponSel === "smg" || G.weaponSel === "carbine") && enabledRef.current
      && !G.driving && !G.dialogueActive && !G.status && !G.interior) fireRef.current();
    // weapon pickups: spin + bob; walking over one arms Rayan
    PICKUPS.forEach((pk, i) => {
      const g = pickupRefs.current[i]; if (!g) return;
      const ready = G.timeS >= pickupReadyAt.current[i];
      g.visible = ready;
      if (!ready) return;
      g.rotation.y = t * 1.6;
      g.position.y = 0.75 + Math.sin(t * 2.4 + i * 2) * 0.12;
      if (!G.driving && !G.interior && (G.playerPos.x - pk.x) ** 2 + (G.playerPos.z - pk.z) ** 2 < 2.2 ** 2) {
        pickupReadyAt.current[i] = G.timeS + RESPAWN_S;
        const had = G.weaponOwned[pk.kind];
        G.weaponOwned[pk.kind] = true;
        G.weaponAmmo[pk.kind] = Math.min(pk.kind === "bottle" ? 24 : 240, G.weaponAmmo[pk.kind] + pk.ammo);
        if (pk.kind === "bottle") syncBottles();
        G.weaponSel = pk.kind;
        syncWeaponMirrors();
        sfx.pickup();
        toast(pk.kind === "bat"
          ? "Baseball bat acquired — Q to the bat slot, click or J to swing. No ammo, all shoulder."
          : pk.kind === "bottle"
            ? "Bottles ×6 — Q to the throw slot, click or J to lob one. Glass breaks loud."
            : had
              ? `${pk.label} ammo +${pk.ammo} — Q cycles weapons`
              : `${pk.label} acquired — click or J to fire, Q to cycle (+${pk.ammo} rounds)`);
      }
    });
    // shot FX: muzzle flash (60ms), tracer (80ms), impact sparks (120ms)
    const fx = G.shotFx;
    const age = t - fx.t;
    // Phase 33: the carbine's flash/light/tracer burn harbour TEAL
    // (the palette's second colour); every other weapon keeps the
    // warm amber. Tints are set from the last weapon actually fired.
    const tint = lastFired.current === "carbine"
      ? { flash: "#a8e6da", light: "#7fd8c8", tracer: "#b8f0e4" }
      : { flash: "#ffca7a", light: "#ffca7a", tracer: "#ffe9a8" };
    // Phase 44: REDUCED FLASH softens this whole shot-flash cluster
    // at its existing sites — the flash sprite burns dimmer and
    // smaller, the pooled light caps at a quarter of its peak, and
    // the impact sparks fade — same durations, no new effects.
    const softFlash = G.settings.reducedFlash;
    if (flashRef.current) {
      const on = age >= 0 && age < 0.06 && G.armed && !suppressedFx.current;
      flashRef.current.visible = on;
      if (on) {
        flashRef.current.position.set(fx.mx, 1.35, fx.mz);
        const fm = flashRef.current.material as THREE.SpriteMaterial;
        fm.color.set(tint.flash); fm.opacity = softFlash ? 0.35 : 0.95;
        const fs = softFlash ? 0.5 : 0.85; flashRef.current.scale.set(fs, fs, 1);
      }
    }
    // pooled muzzle-flash point light (player only — Combat is player-only)
    if (muzzleLight.current) {
      const on = age >= 0 && age < 0.05 && G.armed && !suppressedFx.current;
      muzzleLight.current.intensity = on ? (softFlash ? 7 : 26) : Math.max(0, muzzleLight.current.intensity - 300 * 0.016);
      if (on) { muzzleLight.current.position.set(fx.mx, 1.4, fx.mz); muzzleLight.current.color.set(tint.light); }
    }
    if (sparkRef.current) {
      const on = age >= 0 && age < 0.12 && fx.hit;
      sparkRef.current.visible = on;
      if (on) { sparkRef.current.position.set(fx.hx, 0.9, fx.hz); (sparkRef.current.material as THREE.SpriteMaterial).opacity = softFlash ? 0.4 : 0.9; }
    }
    if (tracerRef.current) {
      const on = age >= 0 && age < 0.08 && G.armed;
      tracerRef.current.visible = on;
      if (on) {
        (tracerRef.current.material as THREE.LineBasicMaterial).color.set(tint.tracer);
        const pos = tracerRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
        pos.setXYZ(0, fx.mx, 1.35, fx.mz);
        pos.setXYZ(1, fx.hx, 0.9, fx.hz);
        pos.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      {PICKUPS.map((pk, i) => (
        <group key={i} ref={(n) => { pickupRefs.current[i] = n; }} position={[pk.x, 0.75, pk.z]}>
          {pk.kind === "bat" ? (
            /* Phase 8: the bat pickup — a wooden bat, barrel-up */
            <group rotation={[0.4, 0, 0.15]}>
              <mesh position={[0, -0.18, 0]} castShadow><cylinderGeometry args={[0.028, 0.034, 0.3, 8]} /><meshStandardMaterial color="#8a5a30" roughness={0.7} /></mesh>
              <mesh position={[0, 0.16, 0]} castShadow><cylinderGeometry args={[0.05, 0.032, 0.42, 8]} /><meshStandardMaterial color="#b98a4e" roughness={0.6} /></mesh>
              <mesh position={[0, -0.34, 0]}><cylinderGeometry args={[0.045, 0.045, 0.03, 8]} /><meshStandardMaterial color="#5d3a1c" roughness={0.7} /></mesh>
            </group>
          ) : pk.kind === "bottle" ? (
            /* Phase 9: a crate of green-glass empties, ready to throw */
            <group>
              <mesh position={[0, -0.42, 0]} castShadow><boxGeometry args={[0.62, 0.22, 0.62]} /><meshStandardMaterial color="#6d4c33" roughness={0.85} /></mesh>
              {([[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]] as const).map(([x, z], j) => (
                <group key={j} position={[x, -0.12, z]}>
                  <mesh castShadow><cylinderGeometry args={[0.075, 0.085, 0.42, 8]} /><meshStandardMaterial color="#2e6b46" roughness={0.25} metalness={0.1} /></mesh>
                  <mesh position={[0, 0.28, 0]}><cylinderGeometry args={[0.03, 0.06, 0.16, 8]} /><meshStandardMaterial color="#2e6b46" roughness={0.25} metalness={0.1} /></mesh>
                </group>
              ))}
            </group>
          ) : pk.kind === "carbine" ? (
            /* Phase 33: the Kestrel Carbine — its own silhouette: a
               long receiver, a curved magazine, a skeleton stock and
               a teal sight dot (Sable Arms' house colour) */
            <group>
              <mesh position={[0, -0.05, 0.1]} rotation={[0.5, 0, 0]} castShadow><boxGeometry args={[0.07, 0.22, 0.09]} /><meshStandardMaterial color="#22262b" metalness={0.6} roughness={0.35} /></mesh>
              <mesh position={[0, 0.05, -0.02]} castShadow><boxGeometry args={[0.065, 0.09, 0.72]} /><meshStandardMaterial color="#2f3a3d" metalness={0.7} roughness={0.3} /></mesh>
              <mesh position={[0, 0.03, 0.38]}><boxGeometry args={[0.04, 0.045, 0.14]} /><meshStandardMaterial color="#14161a" metalness={0.6} roughness={0.4} /></mesh>
              <mesh position={[0, -0.13, 0.12]} rotation={[0.28, 0, 0]}><boxGeometry args={[0.05, 0.24, 0.09]} /><meshStandardMaterial color="#1d2126" metalness={0.55} roughness={0.4} /></mesh>
              <mesh position={[0, 0.02, -0.42]}><boxGeometry args={[0.055, 0.07, 0.22]} /><meshStandardMaterial color="#4a4238" roughness={0.75} /></mesh>
              <mesh position={[0, 0.14, 0.05]}><boxGeometry args={[0.02, 0.05, 0.1]} /><meshStandardMaterial color="#14161a" metalness={0.6} roughness={0.4} /></mesh>
              <mesh position={[0, 0.17, 0.05]}><sphereGeometry args={[0.016, 6, 6]} /><meshStandardMaterial color="#5ec8be" emissive="#2e8f86" emissiveIntensity={1.6} /></mesh>
            </group>
          ) : (<>
          {/* low-poly gun: grip + slide + barrel (longer for SMG/shotgun) */}
          <mesh position={[0, -0.05, 0.1]} rotation={[0.5, 0, 0]} castShadow><boxGeometry args={[0.07, 0.22, 0.09]} /><meshStandardMaterial color="#22262b" metalness={0.6} roughness={0.35} /></mesh>
          <mesh position={[0, 0.05, 0.02]} castShadow><boxGeometry args={[0.06, 0.08, pk.kind === "shotgun" ? 0.62 : pk.kind === "smg" ? 0.48 : 0.34]} /><meshStandardMaterial color="#3a4046" metalness={0.7} roughness={0.3} /></mesh>
          <mesh position={[0, 0.03, 0.22]}><boxGeometry args={[0.045, 0.05, 0.12]} /><meshStandardMaterial color="#14161a" metalness={0.6} roughness={0.4} /></mesh>
          {pk.kind === "smg" && <mesh position={[0, -0.12, 0.08]}><boxGeometry args={[0.05, 0.2, 0.08]} /><meshStandardMaterial color="#22262b" metalness={0.6} roughness={0.35} /></mesh>}
          {pk.kind === "shotgun" && <mesh position={[0, -0.04, 0.3]}><boxGeometry args={[0.07, 0.07, 0.24]} /><meshStandardMaterial color="#6d4c33" roughness={0.8} /></mesh>}
          </>)}
          <sprite scale={[1.5, 1.5, 1]}><spriteMaterial map={glowTex} color="#ffd166" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
        </group>
      ))}
      <sprite ref={flashRef} visible={false} scale={[0.85, 0.85, 1]}>
        <spriteMaterial map={glowTex} color="#ffca7a" transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <pointLight ref={muzzleLight} intensity={0} distance={9} decay={1.8} color="#ffca7a" />
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
