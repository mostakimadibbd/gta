// Harborfall — Phase 18: DRIFT SCORING.
//
// The arcade physics model drives the car ALONG its heading (there is
// no separate velocity vector), so a true slip angle doesn't exist to
// measure. What the game CAN measure honestly is the driver's drift
// STATE: handbrake held at speed with steering wound in — and the
// yaw rate that produces. The "slip angle" scored here is an estimate
// built from those two real signals (steering lock + yaw rate), the
// same way the Phase 10 body roll already fakes slide from them. It
// is a scoring model, not a physics claim, and it says so here.
//
// Rules (all tuned so a clean Docks loop in a muscle car banks a few
// hundred points, not thousands):
//   · a drift segment = handbrake held, speed > 6 u/s, steering in;
//   · score builds as angle × speed × time, scaled by the chain
//     multiplier and the car's rear-drive factor (below);
//   · segments chained within 2.5 s raise the multiplier (×2, ×3…×5);
//   · BANKING: stop drifting for a full clean second and the chain
//     pays out — cash = points / 12, a Driving-skill tick on a
//     200+ chain, best/total recorded in jobStats;
//   · a COLLISION while a chain is open (score unbanked) loses it
//     all — Vehicle feeds the car's damage delta in as the signal.
import { G, toast, persistSkills } from "./store";
import { jobStats, persistJobStats } from "./jobs";
import { sfx } from "./audio";

/** Rear-drive bias by kind: the cars that WANT to slide score full
 * rate; front-heavy and utility kinds score less for the same angle. */
export const DRIFT_FACTOR: Record<string, number> = {
  muscle: 1.25, coupe: 1.25, supercar: 1.25, gt: 1.25, kestrel: 1.3,
  wedge: 1.1, hyper: 1.1, pickup: 0.9, bronto: 0.9,
  sedan: 0.85, hatch: 0.85, suv: 0.85, classic: 0.85, van: 0.8, taxi: 0.85, tow: 0.6,
  // Phase 32: the service fleet — working vehicles, not drift cars
  ambulance: 0.8, firetruck: 0.6,
  // Phase 28: the Tempest is rear-drive and built to slide (top
  // factor, with the Kestrel RS); the Mule is a work truck — it
  // will slide on dirt, but it doesn't score like a sports car.
  tempest: 1.3, mule: 0.85,
  sovereign: 1.3, // Phase 48: the Sovereign shares the Tempest family's drift manners
  // Phase 40: the motorcycle was MISSING here too — it feeds this
  // scorer through the car step like any car, and silently took
  // the 0.85 fallback. A light, rear-drive bike slides willingly:
  // 1.1, stated rather than inherited. (The bicycle never reaches
  // this table — its own kinematic branch feeds no drift input.)
  motorcycle: 1.1,
};

export const DRIFT = {
  /** unbanked points in the open chain */
  score: 0,
  /** chain multiplier 1..5 */
  mult: 1,
  /** currently inside a drift segment */
  active: false,
  /** estimated slip angle of the current segment (radians, display) */
  angle: 0,
  /** seconds since the last segment ended (chain window 2.5 s) */
  chainT: 99,
  /** clean seconds accumulated toward banking (needs 1.0) */
  cleanT: 0,
  /** a segment has run since the last bank/loss (chain is open) */
  open: false,
  /** Phase 34: bank notifications for the Sable Slide Series — a
   * monotone sequence + the points of the most recent bank. The
   * series loop polls the sequence; bank() stays the only writer,
   * so a run can never count points the drift system didn't pay. */
  bankSeq: 0,
  lastBank: 0,
};

export interface DriftSample {
  /** handbrake held, speed and steering in the drift envelope */
  drifting: boolean;
  /** estimated slip angle (radians) for this step */
  angle: number;
  speed: number;
  kind: string;
  driftTyres: boolean;
  /** the car took collision damage this step */
  collision: boolean;
}

function bank() {
  const pts = Math.floor(DRIFT.score);
  const cash = Math.floor(pts / 12);
  if (pts > 0) { DRIFT.bankSeq += 1; DRIFT.lastBank = pts; } // Phase 34: the Slide Series counts banks off this sequence
  if (pts > 0) {
    if (cash > 0) { G.cash += cash; G.lifetimeEarned += cash; }
    jobStats.driftBanked += pts;
    jobStats.driftEarned += cash;
    if (pts > jobStats.bestDrift) jobStats.bestDrift = pts;
    persistJobStats();
    if (pts >= 200 && G.skills.driving < 100) { G.skills.driving += 1; persistSkills(); }
    toast(`🛞 Drift chain ×${DRIFT.mult} banked — ${pts.toLocaleString()} pts (+$${cash})${pts >= 200 ? " · Driving +1" : ""}`);
    sfx.cash();
  }
  DRIFT.score = 0; DRIFT.mult = 1; DRIFT.open = false; DRIFT.cleanT = 0; DRIFT.chainT = 99;
}

function loseChain() {
  const pts = Math.floor(DRIFT.score);
  if (pts >= 40) toast(`💥 Drift chain lost — ${pts.toLocaleString()} unbanked points gone in the impact.`);
  sfx.crash();
  DRIFT.score = 0; DRIFT.mult = 1; DRIFT.open = false; DRIFT.cleanT = 0; DRIFT.chainT = 99; DRIFT.active = false;
}

/** One frame of drift scoring. Called by Vehicle.tsx only while the
 * player is driving a road car; collisions arrive as damage deltas. */
export function tickDrift(dt: number, s: DriftSample) {
  if (s.collision && DRIFT.open) { loseChain(); return; }
  if (s.drifting) {
    if (!DRIFT.active) {
      // a new segment: inside the chain window it raises the multiplier
      if (DRIFT.open && DRIFT.chainT <= 2.5) DRIFT.mult = Math.min(5, DRIFT.mult + 1);
      else if (!DRIFT.open) { DRIFT.mult = 1; DRIFT.open = true; }
      DRIFT.active = true;
    }
    DRIFT.chainT = 0;
    DRIFT.cleanT = 0;
    DRIFT.angle = s.angle;
    const factor = DRIFT_FACTOR[s.kind] ?? 0.85;
    DRIFT.score += s.angle * Math.abs(s.speed) * dt * 10 * DRIFT.mult * factor * (s.driftTyres ? 1.35 : 1);
  } else {
    DRIFT.active = false;
    DRIFT.angle = 0;
    if (DRIFT.open) {
      DRIFT.chainT += dt;
      DRIFT.cleanT += dt;
      if (DRIFT.cleanT >= 1) bank();
      else if (DRIFT.chainT > 2.5) { DRIFT.score = 0; DRIFT.mult = 1; DRIFT.open = false; DRIFT.cleanT = 0; }
    }
  }
}

/** Leaving the car / wrecking out: an open chain simply evaporates
 * (no toast — the moment has passed). */
export function resetDrift() {
  DRIFT.score = 0; DRIFT.mult = 1; DRIFT.open = false; DRIFT.active = false; DRIFT.angle = 0; DRIFT.chainT = 99; DRIFT.cleanT = 0;
}
