// Harborfall — Phase 34: THE SABLE SLIDE SERIES (drift championship).
//
// The Sable Cup's sibling: a 3-round scored championship built on
// the Phase 18 drift model, structured exactly like the Cup (game/
// cup.ts) — per-slot progress persisted under its own key, rounds
// armed from the Phone → Jobs card (J.slideArm), the arm converting
// at the course's start ring, best result counting, a crown at the
// end. Where the Cup races a clock against rivals, the Series runs
// a gated course against a drift target:
//
//   · drive the course's gates IN ORDER before the clock dies, and
//   · BANK at least the round's target in drift points on the way.
//
// The Series never scores a slide itself. Drift points exist only
// when game/drift.ts banks a chain (a clean release after a slide —
// a collision loses the open chain whole, per the standing rule),
// and the run counts banks off DRIFT.bankSeq, so every point on the
// board is a point the drift system actually paid out in cash too.
// BANK ACCOUNTING (Phase 35 audit, decided + documented): banks
// before GO never count (the sequence is re-snapshotted at GO), and
// a chain OPENED before GO never counts either — the component
// calls drift's resetDrift() at GO, wiping any chain built during
// the countdown or in free roam, so the first bankable chain is one
// started inside the run. A chain started after GO while simply
// driving the course DOES count, banked wherever it happens: that
// is intended, not a leak — the run is free driving on a gated
// course and drift.ts is the only scorer there is.
// The slip angle underneath remains what Phase 18 documented: an
// ESTIMATE from steering lock + speed, a scoring model, not a
// physics claim.
//
// TARGETS, tuned off the drift module's own anchor ("a clean Docks
// loop in a muscle car banks a few hundred points"): Round 1 is one
// Docks loop's worth of gates (500), Round 2 runs the long Bay
// shore road (800), Round 3 works all four corners of the Northgate
// rectangle (1,000). Drift tyres (×1.35) and a rear-drive car make
// them comfortable; a front-heavy sedan on road compound will have
// to earn them — that is the championship working as intended.
//
// PRIZE: $3,000 flat (the Cup pays its $2,500 flat the same way), a
// Harbour Wire headline, the career title "Slide Series Champion"
// (Phone → Stats → Records), and SLIDE GOLD — a champion's respray
// swatch in Lina's existing palette (components/ModMenu.tsx). The
// gold is a CAREER honour: once unlocked it survives a series
// reset, like an unspent Cup voucher survives resetCup.
//
// NG+ RULE (documented, mirroring the Cup): the Series is a career
// record — progress, round bests and the gold all STAY across NG+
// (the Cup and the drift records stay too; see game/ngplus.ts). A
// run in progress is stood down by the reset, like a race.
//
// SERVER LEADERBOARD: deliberately NOT submitted. The Python
// service's board (server/main.py /v1/leaderboards) takes
// {race_best, job_earned} — race_best is a TIME in seconds, lower
// wins, clamped 5..3600. Race bests fit it and already flow through
// game/leaderboard.ts postRaceResult on every race finish. A drift
// score is a higher-wins POINT total, not a time: posting one as
// race_best would corrupt the race board (a 900-pt chain would read
// as a 15-minute "race"). The contract is not changed for this —
// Slide bests stay local, in Stats → Records.
import { G, toast } from "./store";
import { pushNews } from "./feed";
import { sfx } from "./audio";
import type { SlideRoundDef } from "./jobs";

export const SLIDE_ROUNDS: SlideRoundDef[] = [
  {
    id: "slide-docks", name: "Docks Yard", where: "Docks ring, east of the Sprint start",
    start: [20, 100],
    gates: [[60, 100], [100, 100], [100, 20], [100, -60]],
    target: 500, timeLimit: 120,
  },
  {
    id: "slide-bay", name: "Bay Infield", where: "Marina ring — bridge + Coral shore roads",
    start: [44, 100],
    gates: [[60, 160], [72, 224], [104, 224], [104, 304], [40, 304]],
    target: 800, timeLimit: 150,
  },
  {
    id: "slide-north", name: "Northgate Interchange", where: "Northgate ring, west of the Loop start",
    start: [-36, -216],
    gates: [[-84, -216], [-84, -280], [-20, -280], [-20, -216]],
    target: 1000, timeLimit: 120,
  },
];

export const SLIDE_PRIZE = 3000;
/** The champion's respray — Lina's palette gains this swatch once
 * the crown is earned (components/ModMenu.tsx). Amber-gold, the
 * palette's warm metal; not a new cosmetic system, just a colour
 * the respray bench only offers a champion. */
export const SLIDE_GOLD = "#d8a920";

export interface SlideRound { id: string; best: number; passed: boolean; }
export interface SlideState {
  rounds: SlideRound[];
  champion: boolean;
  /** Career honour: the crown was earned at least once on this
   * slot. Gates the Slide Gold respray; survives resetSlide. */
  goldUnlocked: boolean;
}

function freshSlide(): SlideState {
  return {
    rounds: SLIDE_ROUNDS.map((r) => ({ id: r.id, best: 0, passed: false })),
    champion: false, goldUnlocked: false,
  };
}

export let slide: SlideState = freshSlide();

export function loadSlide() {
  try {
    const raw = localStorage.getItem("harborfall-slide");
    if (raw) {
      const saved = JSON.parse(raw) as SlideState;
      if (saved && Array.isArray(saved.rounds) && saved.rounds.length === SLIDE_ROUNDS.length
        && saved.rounds.every((r, i) => r && r.id === SLIDE_ROUNDS[i].id)) {
        slide = {
          rounds: saved.rounds.map((r) => ({ id: r.id, best: Math.max(0, Math.floor(r.best) || 0), passed: !!r.passed })),
          champion: !!saved.champion, goldUnlocked: !!saved.goldUnlocked,
        };
        return;
      }
      // A mismatched save (a future course edit) rebuilds the rounds
      // fresh — the Phase 19 Cup migration rule — but a career
      // honour already earned is not taken back by a data change.
      slide = freshSlide();
      slide.goldUnlocked = !!(saved && saved.goldUnlocked);
      return;
    }
  } catch { /* per-key guard (Phase 15): a bad key never blocks boot */ }
  slide = freshSlide();
}
export function persistSlide() { try { localStorage.setItem("harborfall-slide", JSON.stringify(slide)); } catch { /* quota */ } }

export const slideDef = (id: string): SlideRoundDef | undefined => SLIDE_ROUNDS.find((r) => r.id === id);
/** Sequential unlock: round i opens once round i−1 is passed. */
export const slideUnlocked = (idx: number): boolean => idx <= 0 || !!slide.rounds[idx - 1]?.passed;
export const slidePassedCount = (): number => slide.rounds.filter((r) => r.passed).length;

/** Record a finished or timed-out run. Best counts on ANY completed
 * attempt (a route finished under target, or the clock dying with
 * points banked); a pass needs the route finished AND the target
 * banked. Abandoned runs (leaving the car, a bust) never reach
 * here — the component discards them, exactly like the races.
 * Returns what happened so the component can word the marshal's
 * phone message. */
export function recordSlideResult(roundId: string, score: number, finishedRoute: boolean): { passed: boolean; champion: boolean; best: boolean } {
  const idx = SLIDE_ROUNDS.findIndex((r) => r.id === roundId);
  const round = slide.rounds[idx];
  if (!round) return { passed: false, champion: false, best: false };
  const def = SLIDE_ROUNDS[idx];
  const best = score > round.best;
  if (best) round.best = score;
  const passed = finishedRoute && score >= def.target;
  let crowned = false;
  if (passed && !round.passed) {
    round.passed = true;
    if (slide.rounds.every((r) => r.passed) && !slide.champion) {
      slide.champion = true;
      slide.goldUnlocked = true;
      crowned = true;
      G.cash += SLIDE_PRIZE; G.lifetimeEarned += SLIDE_PRIZE;
      pushNews("SABLE SLIDE SERIES: A CHAMPION CROWNED", `Three courses, three targets, one unbroken nerve — Port Sable's drift crown has a new name. The champion's purse: $3,000, and word is Lina's bench now stocks a gold only they may wear.`);
      toast(`🏆 SLIDE SERIES CHAMPION! +$${SLIDE_PRIZE.toLocaleString()} — and Lina's bench unlocks the Slide Gold respray`);
      sfx.complete();
    }
  }
  if (!crowned) {
    if (passed) {
      toast(`🛞 ${def.name} — PASSED with ${score.toLocaleString()} pts! ${slidePassedCount()}/3 rounds in the book${best ? " · new best" : ""}`);
      sfx.complete();
    } else if (finishedRoute) {
      toast(`🛞 ${def.name}: route done at ${score.toLocaleString()} pts — the target is ${def.target.toLocaleString()}. The round stays open; run it again.`);
      sfx.fail();
    } else {
      toast(`🛞 ${def.name}: the clock died at ${score.toLocaleString()} pts${best && score > 0 ? " — a new best all the same" : ""}. Target ${def.target.toLocaleString()}, route unfinished.`);
      sfx.fail();
    }
  }
  persistSlide();
  return { passed, champion: crowned, best };
}

/** A fresh series (offered once the crown is taken — a champion may
 * defend). Round bests and pass flags clear; the gold stays, as a
 * career honour and like the Cup's unspent voucher. */
export function resetSlide() {
  const gold = slide.goldUnlocked;
  slide = freshSlide();
  slide.goldUnlocked = gold;
  persistSlide();
}

// Boot load (module level, like cup.ts): main.tsx imports
// game/saveslots first, so the per-slot storage patch is in place
// before any game module evaluates and this key lands in the slot.
loadSlide();
