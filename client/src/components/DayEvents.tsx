// Harborfall — Phase 47: DAY EVENTS (the frame logic for
// game/dayevents.ts). Two day-scoped fixtures, in the Phase 17 /
// SlideSeries shape: polite prompt claims, a status-edge
// stand-down, one useFrame loop, owned meshes the density levers
// cannot cull.
//
// REGATTA DAY: the buoy course renders in the bay (it bobs on the
// water; the next buoy pulses). A boat crossing the start gate
// arms a run — but only while the shared event courtesy is free
// (no mission, no J.race, no Slide run, no status screen, no other
// G.eventNow holder: the Phase 17 scheduler's own start list) —
// and the run holds G.eventNow (kind "regatta") while live, the
// derby's arrangement. Checkpoints are the Bay Circuit's: 11u from
// the ACTIVE BOAT's state, in order, home through the gate. Ends:
// finish (game/dayevents.ts settles: best time, once-a-day purse),
// out of a boat for 5 s (the races' abandon rule — nothing
// recorded), busted/wasted (stood down off the status edge, the
// service-jobs pattern), NG+ (stood down in ngplus.ts, unsettled),
// or the day turning under the run (the buoys are gone; the run
// goes with them).
//
// MARKET DAY: three canopy stalls on the Coral promenade in the
// Phase 14 stall idiom (posts, counter, striped canopy) plus a
// small crowd of buildHumanoid figures on the Phase 2 vignette
// pattern (idle animation, one talker per pair gesturing). The
// offers all flow through the existing paths — the food stall
// mirrors the Harbour Wraps vendor's prices and effects exactly,
// the parts stall's deal is a voucher the bench's own buy path
// honours (game/dayevents.ts + components/ModMenu.tsx), and the
// curios stall fences through game/theft.ts sellStash with the
// +20% bonus flag, re-checked at the moment of sale. The stalls
// are presentation props (Phase 17's crates/challenger precedent):
// not in the static blocker set — they exist one day at a time —
// and audit section 13 keeps their footprints honest.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { G, toast, bark, stashTotal } from "../game/store";
import { M } from "../game/missionState";
import { J, fmtTime } from "../game/jobs";
import {
  REG, REGATTA_GATE, REGATTA_GATE_BUOYS, REGATTA_BUOYS, REGATTA_TARGET_S, REGATTA_CP_R,
  MARKET_STALLS, MARKET_CROWD, PARTS_DEALS, MARKET_FENCE_BONUS,
  dayEventToday, isBoatKind, startRegattaRun, finishRegattaRun, standDownRegatta, marketDealActive,
} from "../game/dayevents";
import { sellStash } from "../game/theft";
import { postRaceResult } from "../game/leaderboard";
import { pushPhoneMsg } from "../game/phone";
import { sfx } from "../game/audio";
import { groundYAt } from "../world";
import { buildHumanoid, animateHumanoid } from "../humanoid";

const HARBOURMASTER = "Harbourmaster";

export default function DayEvents() {
  const mine = useRef("");
  const prevStatus = useRef("");
  const outAt = useRef(-1);
  const buoyRefs = useRef<Array<THREE.Group | null>>([]);
  const gateBuoyRefs = useRef<Array<THREE.Group | null>>([]);
  const gateRingRef = useRef<THREE.Group>(null);
  const stallRefs = useRef<Array<THREE.Group | null>>([]);
  const crowdRefs = useRef<Array<THREE.Group | null>>([]);
  const crowd = useMemo(() => [
    { rig: buildHumanoid({ top: "#2e6b8a", bottom: "#2b3440", skin: "#e0ac69", hair: "#20242a", topStyle: "tee", gender: "m", hairStyle: "flat" }), phase: 0 },
    { rig: buildHumanoid({ top: "#e8e4da", bottom: "#5c4a32", skin: "#8d5524", hair: "#14100e", topStyle: "tank", gender: "f", hairStyle: "ponytail" }), phase: 2.1 },
    { rig: buildHumanoid({ top: "#7a4a2b", bottom: "#e8e4da", skin: "#f1c27d", hair: "#b5522a", topStyle: "crop", bottomStyle: "shorts", gender: "f", hairStyle: "bun" }), phase: 4.2 },
    { rig: buildHumanoid({ top: "#274268", bottom: "#232c38", skin: "#c68863", hair: "#14100e", topStyle: "hoodie", gender: "m", hairStyle: "cap", cap: "#b3312c" }), phase: 1.3 },
  ], []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    let claimed = false;
    const claim = (text: string, act: (() => void) | null, warn = false) => {
      if (!G.promptText || G.promptText === mine.current) {
        G.promptText = text; G.promptWarn = warn; G.interact = act;
        mine.current = text; claimed = true;
      }
    };
    const releaseSlot = () => { if (G.eventNow?.kind === "regatta") G.eventNow = null; };

    const day = dayEventToday();
    const regattaDay = day?.kind === "regatta";
    const marketDay = day?.kind === "market";

    // ---------- stand-down: busted / wasted mid-run ----------
    if (G.status && !prevStatus.current && REG.active) {
      standDownRegatta();
      releaseSlot();
      bark(HARBOURMASTER, G.status === "busted" ? "— run's void. The book doesn't record a time set in custody." : "— run's void. The book only records times you sail away from.");
    }
    prevStatus.current = G.status;
    // the day turned under a live run — the buoys are gone
    if (REG.active && !regattaDay) { standDownRegatta(); releaseSlot(); }

    const car = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId] : null;
    const boat = car && isBoatKind(car.kind) ? car : null;

    // ================= REGATTA =================
    // buoys: visible on regatta day, bobbing; the next target pulses
    const showBuoys = regattaDay;
    REGATTA_BUOYS.forEach(([bx, bz], i) => {
      const g = buoyRefs.current[i];
      if (!g) return;
      g.visible = showBuoys;
      if (showBuoys) {
        g.position.set(bx, Math.sin(t * 1.3 + i * 1.7) * 0.14, bz);
        const target = REG.active && REG.cp === i;
        const s = target ? 1 + Math.sin(t * 4) * 0.13 : 1;
        g.scale.setScalar(s);
      }
    });
    REGATTA_GATE_BUOYS.forEach(([bx, bz], i) => {
      const g = gateBuoyRefs.current[i];
      if (!g) return;
      g.visible = showBuoys;
      if (showBuoys) g.position.set(bx, Math.sin(t * 1.3 + 4 + i * 2.3) * 0.14, bz);
    });
    if (gateRingRef.current) {
      gateRingRef.current.visible = showBuoys;
      if (showBuoys) gateRingRef.current.position.set(REGATTA_GATE.x, 0.06, REGATTA_GATE.z);
    }

    if (regattaDay && boat && !G.status) {
      const bx = boat.state.x, bz = boat.state.z;
      if (!REG.active) {
        // arm: crossing the gate with the shared courtesy free
        // Phase 48 audit: the Phase 17 scheduler's own start list
        // also stands off for a live dialogue and a live dispatch
        // incident — the arm gate now matches it in full (a run can
        // no longer arm in the same moment a call-out lands).
        const free = !M.active && !J.race && !J.slide && !G.eventNow && !G.dialogueActive && !G.incident;
        if (free && Math.hypot(bx - REGATTA_GATE.x, bz - REGATTA_GATE.z) < REGATTA_CP_R) {
          startRegattaRun(t);
          G.eventNow = { kind: "regatta", x: REGATTA_GATE.x, z: REGATTA_GATE.z };
          bark(HARBOURMASTER, `— you're on the clock! Six amber buoys in order, then home through the gate. ${fmtTime(REGATTA_TARGET_S)} takes the purse.`);
          sfx.playStart();
        }
      } else {
        outAt.current = -1;
        const target = REG.cp < REGATTA_BUOYS.length ? REGATTA_BUOYS[REG.cp] : ([REGATTA_GATE.x, REGATTA_GATE.z] as const);
        const elapsed = t - REG.startedAt;
        if (Math.hypot(bx - target[0], bz - target[1]) < REGATTA_CP_R) {
          REG.cp += 1;
          sfx.pickup();
          if (REG.cp > REGATTA_BUOYS.length) {
            if (finishRegattaRun(t)) postRaceResult(); // Phase 8 leaderboard sync (no-op offline)
            releaseSlot();
          } else {
            toast(`⛵ Buoy ${REG.cp}/${REGATTA_BUOYS.length} — ${fmtTime(elapsed)}${REG.cp === REGATTA_BUOYS.length ? " · home to the gate!" : ""}`);
          }
        }
        if (REG.active) {
          claim(`⛵ Regatta — ${REG.cp < REGATTA_BUOYS.length ? `buoy ${REG.cp + 1}/${REGATTA_BUOYS.length}` : "home to the gate"} · ${fmtTime(elapsed)} (target ${fmtTime(REGATTA_TARGET_S)})`, null, true);
        }
      }
    }
    // abandon: out of a boat for more than 5 s (the races' rule)
    if (REG.active && !boat) {
      if (outAt.current < 0) outAt.current = t;
      if (t - outAt.current > 5) {
        standDownRegatta();
        releaseSlot();
        outAt.current = -1;
        toast("Regatta run abandoned — you left your boat. Nothing recorded.");
        pushPhoneMsg(HARBOURMASTER, "Regatta: abandoned. The book records finishes, not walk-aways — the buoys are out till dusk if you want another run.");
      }
    } else if (boat) outAt.current = -1;

    // ================= MARKET =================
    MARKET_STALLS.forEach((_, i) => {
      const g = stallRefs.current[i];
      if (g) g.visible = marketDay;
    });
    crowd.forEach((c, i) => {
      const g = crowdRefs.current[i];
      if (!g) return;
      g.visible = marketDay;
      if (marketDay) {
        animateHumanoid(c.rig, 0, 0, t + c.phase);
        if (MARKET_CROWD[i].talker) c.rig.rArm.rotation.x = -0.65 + Math.sin(t * 1.4 + c.phase) * 0.28; // gesturing (the vignette idiom)
      }
    });

    if (marketDay && !G.driving && !G.status && !claimed) {
      const px = G.playerPos.x, pz = G.playerPos.z;
      for (const s of MARKET_STALLS) {
        if (Math.hypot(px - s.x, pz - s.z) > 2.6) continue;
        if (s.id === "food") {
          // the Harbour Wraps vendor's own prices + effects (Interactions)
          if (G.health >= 99.5 && G.stamina < 99 && G.cash >= 5) {
            claim("E — Market kitchen: harbour cooler drink ($5) — refills stamina", () => {
              G.cash -= 5; G.stamina = 100;
              G.eatingUntil = t + 1.4;
              sfx.eat();
              toast("Ice-cold harbour cooler — stamina refilled.");
            });
          } else if (G.health >= 99.5) {
            claim("Market kitchen — you're full. The wraps keep till dusk.", null, true);
          } else {
            claim("E — Market kitchen: harbour wrap ($10) — heals 40", () => {
              if (G.cash < 10) { toast("A wrap costs $10 — you're short."); return; }
              G.cash -= 10;
              G.health = Math.min(100, G.health + 40);
              G.eatingUntil = t + 1.4;
              sfx.eat();
              toast("Harbour wrap eaten — +40 health");
            });
          }
        } else if (s.id === "parts") {
          const deal = marketDealActive();
          if (deal) {
            claim(`Parts stall — today's deal: ${PARTS_DEALS[deal].toUpperCase()}, 25% off at Lina's bench (one purchase, today only — the bench shows the cut price)`, null, true);
          } else {
            claim("Parts stall — today's bench deal is spent. The trader shrugs: 'Tomorrow's another market, maybe.'", null, true);
          }
        } else {
          const total = stashTotal();
          if (total > 0) {
            const payout = Math.round(total * (1 + MARKET_FENCE_BONUS));
            claim(`E — Curios stall buys your stash ($${payout} — market day +20% over the pawn price)`, () => {
              // the bonus is priced at the MOMENT OF SALE: if the
              // day has turned since this prompt was claimed, the
              // stall is gone and the ordinary fence price applies
              if (dayEventToday()?.kind === "market") sellStash("the Coral market curios stall", MARKET_FENCE_BONUS);
              else sellStash("the Coral market curios stall");
            });
          } else {
            claim("Curios stall — the dealer buys salvage and stash at +20% today. Your pockets are empty.", null, true);
          }
        }
        break;
      }
    }

    if (!claimed && mine.current && G.promptText === mine.current) { G.promptText = ""; G.interact = null; mine.current = ""; }
    else if (claimed) mine.current = G.promptText;
  });

  const buoy = (color: string, i: number, gate: boolean) => (
    <group key={i} ref={(n) => { if (gate) gateBuoyRefs.current[i] = n; else buoyRefs.current[i] = n; }} visible={false}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.62, 1.1, 10]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <coneGeometry args={[0.3, 0.5, 8]} />
        <meshStandardMaterial color={color} roughness={0.6} emissive={color} emissiveIntensity={0.35} />
      </mesh>
    </group>
  );

  return (
    <group>
      {/* the regatta course: amber buoys + the teal start gate */}
      {REGATTA_BUOYS.map((_, i) => buoy("#e8a33d", i, false))}
      {REGATTA_GATE_BUOYS.map((_, i) => buoy("#2e8a8a", i, true))}
      <group ref={gateRingRef} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[9.5, 11, 36]} />
          <meshBasicMaterial color="#2e8a8a" transparent opacity={0.4} />
        </mesh>
      </group>

      {/* the market stalls — Phase 14 stall idiom: four posts, a
          counter, a striped canopy in the stall's own colour */}
      {MARKET_STALLS.map((s, i) => (
        <group key={s.id} ref={(n) => { stallRefs.current[i] = n; }} visible={false}
          position={[s.x, groundYAt(s.x, s.z), s.z]}>
          {([[-1.3, -0.8], [1.3, -0.8], [-1.3, 0.8], [1.3, 0.8]] as const).map(([x, z], j) => (
            <mesh key={j} position={[x, 1.05, z]} castShadow><boxGeometry args={[0.09, 2.1, 0.09]} /><meshStandardMaterial color="#6d4c33" roughness={0.9} /></mesh>
          ))}
          <mesh position={[0, 0.95, 0]} castShadow><boxGeometry args={[2.9, 0.1, 1.9]} /><meshStandardMaterial color="#7a5a3d" roughness={0.85} /></mesh>
          <mesh position={[0, 2.22, 0]} rotation={[0, 0, 0.06]} castShadow><boxGeometry args={[3.3, 0.07, 2.3]} /><meshStandardMaterial color={s.canopy} roughness={0.8} /></mesh>
          <mesh position={[0, 2.26, 0]} rotation={[0, 0, 0.06]}><boxGeometry args={[3.3, 0.03, 0.5]} /><meshStandardMaterial color="#e8e0d0" roughness={0.8} /></mesh>
          <mesh position={[-0.8, 1.18, 0.2]} castShadow><boxGeometry args={[0.62, 0.36, 0.62]} /><meshStandardMaterial color="#a3764f" roughness={0.9} /></mesh>
          <mesh position={[0.5, 1.16, -0.25]} castShadow><boxGeometry args={[0.55, 0.32, 0.55]} /><meshStandardMaterial color="#59754e" roughness={0.9} /></mesh>
        </group>
      ))}
      {/* the crowd — vignette-pattern figures at their spots */}
      {MARKET_CROWD.map((c, i) => (
        <group key={i} ref={(n) => { crowdRefs.current[i] = n; }} visible={false}
          position={[c.x, groundYAt(c.x, c.z), c.z]} rotation={[0, c.face, 0]}>
          <primitive object={crowd[i].rig.group} />
        </group>
      ))}
    </group>
  );
}
