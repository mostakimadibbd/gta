// Harborfall — Phase 24: THE FISHING DERBY, a world event at the
// Pier run on Phase17's scheduler (which owns the shared
// G.eventNow courtesy: the derby never starts over a mission, a
// race, a dispatch call or another event, and it holds the slot
// while live so nothing else opens over it).
//
// The contest is a WINDOW, NOT A LEASH — stated plainly because it
// decides the shape: you enter at the pier ring (free), and for
// the next 3 minutes EVERY catch you land scores its sale value,
// from the pier, the island dock, or a boat offshore. Leaving the
// pier area does not cancel anything; there is nothing to cancel —
// when the whistle blows the window simply closes and the scores
// are read. Bust/wasted mid-derby likewise just costs you fishing
// time. The one hard close is New Game+: the stand-down shuts an
// open derby WITHOUT settling it (no prize, no best-score record)
// — a new run starts with no harbour contests running, like every
// other live system.
//
// THE HOUSE SCORE: there is no fishing SKILL stat in Port Sable
// (the skills are driving/shooting/stamina/strength), so the
// target scales mildly with the game's fishing-experience record —
// your lifetime catch count in jobStats: the more fish you've
// landed, the better the pier regulars expect you to do, up to a
// cap. Beat it and the derby pays $300 plus a Harbour Wire
// headline; your best score persists either way (jobStats).
import { G, toast } from "./store";
import { jobStats, persistJobStats } from "./jobs";
import { pushNews } from "./feed";
import { sfx } from "./audio";

export const DERBY_DURATION_S = 180; // 3 minutes on the clock
export const DERBY_PRIZE = 300;
/** The entry ring: the pier fishing spot itself. */
export const DERBY_PIER = { x: 2, z: 112.5 };
/** House target: $180 base + $4 per lifetime catch, capped +$140. */
export const derbyHouseScore = () => 180 + Math.min(140, jobStats.fishCaught * 4);

export const DERBY = {
  open: false,     // a derby window is live (Phase17 holds the event slot)
  entered: false,  // the player has entered at the pier ring
  score: 0,        // $ of catch value landed inside this window
  house: 0,        // the target for THIS derby (fixed at open)
};

/** Phase17's scheduler opens the window. */
export function openDerby() {
  DERBY.open = true; DERBY.entered = false; DERBY.score = 0;
  DERBY.house = derbyHouseScore();
}

/** Entry at the pier ring — free, once per derby. */
export function enterDerby() {
  if (!DERBY.open || DERBY.entered) return;
  DERBY.entered = true; DERBY.score = 0;
  toast(`🎣 You're in the Derby! Every catch for the next 3 minutes scores its value — beat the house $${DERBY.house}. Fish anywhere: pier, dock or boat.`);
  sfx.click();
}

/** The whistle (Phase17, at expiry): settle an entered derby.
 * A derby nobody entered closes silently. No-op if the window was
 * already stood down (NG+) — the settlement can never pay twice. */
export function settleDerby() {
  if (!DERBY.open) return;
  DERBY.open = false;
  if (!DERBY.entered) return;
  const s = DERBY.score;
  DERBY.entered = false; DERBY.score = 0;
  if (s > jobStats.derbyBest) jobStats.derbyBest = s;
  if (s > DERBY.house) {
    jobStats.derbyWins += 1;
    G.cash += DERBY_PRIZE; G.lifetimeEarned += DERBY_PRIZE;
    persistJobStats();
    pushNews("Harbour Wire: DERBY DAY AT THE PIER", `The harbourmaster's whistle settled it: a $${s} creel against the house's $${DERBY.house} — the richest three minutes the pier has seen all season, and the $${DERBY_PRIZE} purse changes hands to general disbelief.`);
    toast(`🏆 DERBY WON — your $${s} beats the house $${DERBY.house}! +$${DERBY_PRIZE}, and the Wire has your name.`);
    sfx.cash();
  } else {
    persistJobStats();
    toast(`🎣 Derby over — your $${s} against the house $${DERBY.house}. The pier regulars keep the purse this time.`);
    sfx.fail();
  }
}

/** NG+ stand-down (game/ngplus.ts): close WITHOUT settling — no
 * prize, no best-score record. Phase17 notices DERBY.open is false
 * and frees the event slot on its next frame. */
export function standDownDerby() {
  DERBY.open = false; DERBY.entered = false; DERBY.score = 0; DERBY.house = 0;
}
