// Harborfall — Phase 34: THE SABLE SLIDE SERIES (drift championship).
//
// The frame logic for game/slide.ts, in the ServiceJobs shape: a
// polite prompt claim, a status-edge stand-down, and one useFrame
// loop. The flow mirrors the Sable Cup exactly — the Phone → Jobs
// card arms a round (J.slideArm); driving onto that course's start
// ring in a car converts the arm into a run (J.slide).
//
// A run: a 3 s countdown, then the course's gates in order (9u, the
// race-checkpoint radius, measured from the CAR like the race frame
// code) against the round's clock. Drift points count only when
// game/drift.ts BANKS a chain — this loop polls DRIFT.bankSeq and
// adds DRIFT.lastBank, so the score is the drift system's own paid
// points, never a parallel estimate. A collision mid-chain loses
// the open chain inside drift.ts before it can ever bank — the
// standing rule does the policing.
//
// Ends, all honest:
//   · last gate → the run is recorded (pass = route + target).
//   · clock dies → the run is recorded as an attempt (best counts).
//   · out of the car 5 s → abandoned, nothing recorded (the races'
//     rule, verbatim).
//   · busted / wasted → stood down off the G.status edge, nothing
//     recorded (the service jobs' pattern).
//   · NG+ → stood down in game/ngplus.ts beside the race stand-down.
//
// Cars only: the drift feed (Vehicle.tsx) is written by the road-car
// step — boats, the plane, bicycles and the motorcycle never feed
// it, so a run in one could never score. The prompt says so.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { G, bark, toast } from "../game/store";
import { J, type SlideRoundDef } from "../game/jobs";
import { M } from "../game/missionState";
import { DRIFT, resetDrift } from "../game/drift";
import { SLIDE_ROUNDS, slideDef, slideUnlocked, recordSlideResult } from "../game/slide";
import { pushPhoneMsg } from "../game/phone";
import { groundYAt } from "../world";
import { sfx } from "../game/audio";

const MARSHAL = "Race Marshal";
const NO_DRIFT_KINDS = new Set(["boat", "skiff", "plane", "bicycle", "motorcycle"]);
const GATE_R = 9; // the race-checkpoint radius

export default function SlideSeries() {
  const mine = useRef("");
  const countStage = useRef(-1);
  const outAt = useRef(-1);
  const prevStatus = useRef("");
  const startRingMats = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const gateRefs = useRef<Array<THREE.Group | null>>([]);
  const gateMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffb340", emissive: "#ffb340", emissiveIntensity: 0.9 }), []);
  const gateMatDim = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2e8a8a", emissive: "#2e8a8a", emissiveIntensity: 0.35 }), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    let claimed = false;
    const claim = (text: string, act: (() => void) | null, warn = false) => {
      if (!G.promptText || G.promptText === mine.current) {
        G.promptText = text; G.promptWarn = warn; G.interact = act;
        mine.current = text; claimed = true;
      }
    };

    // ---------- stand-down: busted / wasted mid-run ----------
    if (G.status && !prevStatus.current && J.slide) {
      bark(MARSHAL, G.status === "busted" ? "— run's void, Kade. The book doesn't record a score set in custody." : "— run's void. The book only records scores you drive away from.");
      J.slide = null;
    }
    prevStatus.current = G.status;

    const car = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId] : null;
    const run = J.slide;

    // ================= THE RUN =================
    if (run) {
      const def = run.def;
      if (run.phase === "countdown") {
        const left = Math.ceil(run.goAt - t);
        if (left !== countStage.current && left > 0) { countStage.current = left; bark(MARSHAL, `${left}…`); sfx.click(); }
        if (t >= run.goAt) {
          run.phase = "run"; run.startedAt = t;
          run.bankSeq = DRIFT.bankSeq; // banks before GO never count
          // Phase 35 audit: nor does a chain OPENED before GO — a
          // slide built during the countdown (or in free roam before
          // the run) would otherwise bank inside the run's first
          // second and count in full. The marshal wipes the slate at
          // the count: only chains started after GO can ever bank
          // into the run. (resetDrift leaves bankSeq/lastBank alone,
          // so the snapshot above still excludes pre-GO banks.)
          resetDrift();
          bark(MARSHAL, `GO! ${def.gates.length} gates, ${def.target.toLocaleString()} points, ${def.timeLimit} seconds. Slide it home.`);
          sfx.playStart();
        }
      } else {
        // count banks since the last frame (drift.ts is the scorer)
        if (DRIFT.bankSeq !== run.bankSeq) { run.score += DRIFT.lastBank; run.bankSeq = DRIFT.bankSeq; }
        run.left = def.timeLimit - (t - run.startedAt);
        // gates, measured from the car (the race frame's rule)
        if (car && run.gate < def.gates.length) {
          const [gx, gz] = def.gates[run.gate];
          if ((car.state.x - gx) ** 2 + (car.state.z - gz) ** 2 < GATE_R ** 2) {
            run.gate += 1; sfx.pickup();
            if (run.gate >= def.gates.length) {
              const res = recordSlideResult(def.id, run.score, true);
              pushPhoneMsg(MARSHAL, res.champion
                ? `${def.name}: ${run.score.toLocaleString()} pts — and that's the crown. Three courses in the book. The Wire's already writing it up.`
                : res.passed
                  ? `${def.name}: PASSED — ${run.score.toLocaleString()} pts banked, route complete. ${def.name} is in the book.`
                  : `${def.name}: route complete at ${run.score.toLocaleString()} pts — short of the ${def.target.toLocaleString()} target. Best stands at the course record; the round stays open.`);
              J.slide = null;
            } else {
              toast(`Gate ${run.gate}/${def.gates.length} — ${run.score.toLocaleString()}/${def.target.toLocaleString()} pts`);
            }
          }
        }
        if (J.slide) {
          // abandon: out of the car for more than 5 s (the races' rule)
          if (!G.driving) {
            if (outAt.current < 0) outAt.current = t;
            if (t - outAt.current > 5) {
              toast("Slide run abandoned — you left your car. Nothing recorded.");
              pushPhoneMsg(MARSHAL, `${def.name}: abandoned. The book records finishes and clock-outs, not walk-aways.`);
              J.slide = null;
            }
          } else outAt.current = -1;
          // the clock
          if (J.slide && run.left <= 0) {
            recordSlideResult(def.id, run.score, false);
            pushPhoneMsg(MARSHAL, `${def.name}: time. ${run.score.toLocaleString()} pts banked with ${run.gate}/${def.gates.length} gates lit — the attempt stands in the book${run.score >= def.target ? ", and the points were there; the route wasn't" : ""}.`);
            J.slide = null;
          }
        }
      }
    }

    // ================= GATE RINGS (visible only during a run) ====
    const runNow = J.slide && J.slide.phase === "run" ? J.slide : null;
    for (let i = 0; i < 5; i++) {
      const g = gateRefs.current[i];
      if (!g) continue;
      const gate = runNow ? runNow.def.gates[i] : undefined;
      if (!gate || !runNow) { g.visible = false; continue; }
      g.position.set(gate[0], groundYAt(gate[0], gate[1]) + 0.15, gate[1]);
      const mesh = g.children[0] as THREE.Mesh;
      mesh.material = i === runNow.gate ? gateMat : gateMatDim;
      g.visible = i >= runNow.gate; // passed gates go dark
    }

    // ================= START RINGS + THE ARMED PROMPT ============
    SLIDE_ROUNDS.forEach((def, i) => {
      const mat = startRingMats.current[i];
      if (mat) mat.emissiveIntensity = J.slideArm === def.id || J.slide?.def.id === def.id ? 1.4 : 0.7;
    });
    if (!J.slide && J.slideArm && !claimed) {
      const def = slideDef(J.slideArm);
      if (def) {
        const idx = SLIDE_ROUNDS.indexOf(def);
        if (!slideUnlocked(idx)) {
          // a reset re-locked the armed round — clear the stale arm
          J.slideArm = "";
          toast(`Slide Series: ${def.name} is locked again — the round before it has to be passed first (Phone → Jobs).`);
        } else if ((G.playerPos.x - def.start[0]) ** 2 + (G.playerPos.z - def.start[1]) ** 2 < 5 ** 2) {
          if (J.race || M.active) { /* a race/mission owns the moment; the arm waits */ }
          else if (car && !NO_DRIFT_KINDS.has(car.kind)) {
            claim(`Press E — start Slide Series: ${def.name} (${def.gates.length} gates · bank ${def.target.toLocaleString()} drift pts in ${def.timeLimit}s)`,
              () => startRun(def, t));
          } else {
            claim(`Slide Series: ${def.name} starts here — you need a car on the ring (a drift needs four wheels and a handbrake).`, null, true);
          }
        }
      }
    }
    if (!claimed && mine.current && G.promptText === mine.current) { G.promptText = ""; G.interact = null; mine.current = ""; }
    else if (claimed) mine.current = G.promptText;
  });

  function startRun(def: SlideRoundDef, t: number) {
    // The arm converts here — and, exactly as a race start discards
    // a non-matching Cup arm, any motorsport start clears the other
    // series' pending entry. A start that can't happen (busy) never
    // reaches this function: the prompt doesn't offer it.
    J.slideArm = "";
    J.cupArm = "";
    J.slide = {
      def, phase: "countdown", goAt: t + 3, startedAt: 0,
      gate: 0, score: 0, bankSeq: DRIFT.bankSeq, left: def.timeLimit,
    };
    countStage.current = -1;
    outAt.current = -1;
    bark(MARSHAL, `${def.name} — gates lit in order, bank ${def.target.toLocaleString()} before the clock dies. On my count…`);
    sfx.click();
  }

  return (
    <group>
      {/* course start rings — always in the world, like the race rings */}
      {SLIDE_ROUNDS.map((def, i) => (
        <group key={def.id} position={[def.start[0], groundYAt(def.start[0], def.start[1]) + 0.15, def.start[1]]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2.6, 0.14, 8, 28]} />
            <meshStandardMaterial ref={(m) => { startRingMats.current[i] = m; }} color="#ffb340" emissive="#ffb340" emissiveIntensity={0.7} />
          </mesh>
        </group>
      ))}
      {/* the active course's gate rings (positioned per frame) */}
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} ref={(n) => { gateRefs.current[i] = n; }} visible={false}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[3.2, 0.16, 8, 28]} />
            <meshStandardMaterial color="#ffb340" emissive="#ffb340" emissiveIntensity={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
