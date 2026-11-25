// Harborfall — Phase 20: NEW GAME+.
//
// Offered in Phone → Story once the story is complete (M.storyDone),
// behind an explicit two-step confirm in the phone UI. Starting NG+
// runs the harbour's story back to the beginning on THIS save slot
// while the player's life stays intact:
//
//   RESETS  story index + storyDone, every side arc (Lina, Voss,
//           Heist, After the Fall, the Harbour Wire), the Ch.5
//           choice, the pack choice, the Meridian Pair lock + done
//           flag, the heist-clean flag, any live replay tag.
//   KEEPS   cash, cars (world/garage/fleet), properties, businesses
//           + staff + levels, any outstanding loan, skills, look /
//           barber state, the Sable Cup and drift records, mission
//           best-time stats (records, not progress gates), zone
//           reputation, gallery, settings and this save slot.
//
// Before anything resets, every live system is stood down through
// its OWN stop path — the active mission (endMission), the arrest
// escort (cancelEscort), a dispatch call (standDownDispatch), a
// marina rental (endRental — the boat is collected, never kept),
// any race, tram/bus rides, world events, hold prompts and any
// in-progress job (Phase 21 audit: taxi/delivery/tow/farm phases
// and the tow tether — they used to leak across the reset) — so no
// half-reset state can leak into the new run. Wanted is cleared:
// the new story starts, as the first one did, with a clean record.
//
// The level itself, its persistence and the effect multipliers live
// in game/missionState.ts (NGP) beside the state they modify.
import { G, toast } from "./store";
import { M, NGP, persist, endMission } from "./missionState";
import { cancelEscort, ESCORT } from "./escort";
import { standDownDispatch } from "./dispatch";
import { RENT, endRental } from "./rentals";
import { J } from "./jobs";
import { resetDrift } from "./drift";
import { pushPhoneMsg } from "./phone";
import { pushNews } from "./feed";
import { sfx } from "./audio";

/** Start New Game+ at the next level. Returns the new level, or 0
 * if the story isn't complete (the phone only offers it then, but
 * the guard keeps any other caller honest). */
export function startNewGamePlus(): number {
  if (!M.storyDone) return 0;

  // ---- stand everything down first, each via its own stop path ----
  if (ESCORT.active) cancelEscort();
  standDownDispatch();
  if (RENT.active) {
    // if the player is sitting in the rental when NG+ starts (the
    // phone opens over a paused game), step them out first — the
    // return path collects the boat, and nobody should be left
    // "driving" a collected hull at the collection point
    if (G.driving && G.activeCarId === RENT.carIndex) { G.driving = false; G.activeCarId = -1; }
    endRental("return");
  }
  if (M.active || M.phase !== "idle") endMission();
  J.race = null; J.cupArm = "";
  J.wantTow = false; J.wantDelivery = false; J.wantFarm = false;
  // Phase 21 audit fix: the Phase 20 stand-down covered missions,
  // races, rentals, escort and dispatch — but NOT in-progress JOBS.
  // A taxi fare (passenger aboard), a delivery chain, a farm shift
  // or a tow (with a car still hanging on the tether) all carried
  // straight over the reset, and the phone confirm promises live
  // work is stood down first. Jobs are world work, not story state,
  // but "stood down" should mean it: every job phase returns to
  // idle and the tow tether lets go (the target car simply stays
  // where it lies, as it does when the hook drops any other way).
  J.taxiPhase = "idle"; J.fare = null; J.fareDest = null;
  J.delPhase = "idle"; J.delLeg = 0; J.delPoint = null;
  J.towPhase = "idle"; J.towCarId = -1; J.towHooked = false; J.towStillT = 0;
  J.farmPhase = "idle"; J.farmLoad = 0;
  resetDrift();
  G.tramRide = -1; G.busRide = -1;
  G.eventNow = null;
  G.hold = null;
  G.wanted = 0; G.starHeat = 0; G.bustTimer = 0; G.wantedCooldown = 0;

  // ---- the reset itself: exactly the fields a fresh slot starts
  // with (fresh-slot defaults audited against missionState.ts) ----
  M.storyIndex = 0;
  M.repeatIndex = 0; // Phase 21 audit: replay rotation is progress too
  M.storyDone = false;
  M.side = { lina: 0, voss: 0, heist: 0, after: 0, wire: 0 };
  M.choice = "";
  M.packChoice = "";
  M.pairChoice = "";
  M.pairDone = false;
  M.heistClean = false;
  M.replayId = "";
  M.lastFailed = null;
  M.checkpointStep = 0;
  M.step = 0; M.timer = 0; M.collected = new Set();
  NGP.level += 1;
  persist();

  pushNews("Harbour Wire: THE HARBOUR TURNS ITS CLOCKS BACK", `Port Sable wakes to a strange déjà vu: the ledger is closed, the ferries run on the old timetable, and a familiar face is stepping off the morning boat — again. The patrol, word is, has been drilling. (New Game+ ${NGP.level}: patrols faster, arrests quicker, and every job in town pays a quarter more per level.)`);
  pushPhoneMsg("Lina Park", `Rayan? Five years and you just roll off the ferry like nothing happened. …Déjà vu's a harbour thing, love. We do it all again — NG+ ${NGP.level}. The patrol's sharper this time. So are the paydays.`);
  toast(`🔁 NEW GAME+ ${NGP.level} — the story starts over. Patrols +${Math.min(18, 6 * NGP.level)}% faster, busts +${Math.min(30, 10 * NGP.level)}% quicker, payouts +${25 * NGP.level}%. Everything you own is still yours.`);
  sfx.complete();
  return NGP.level;
}
