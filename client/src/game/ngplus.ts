// Harborfall — Phase 20: NEW GAME+.
//
// Offered in Phone → Story once the story is complete (M.storyDone),
// behind an explicit two-step confirm in the phone UI. Starting NG+
// runs the harbour's story back to the beginning on THIS save slot
// while the player's life stays intact:
//
//   RESETS  story index + storyDone, every side arc (Lina, Voss,
//           Heist, After the Fall, the Harbour Wire, the Ledger
//           Line, the Quiet Harbour — its bench plaque is rendered
//           from M.side.quiet, so it leaves with the arc — and the
//           Harbour Crown: its auction choice + done + paid flags
//           and the delivery record reset, so a fresh run may buy
//           OR expose, and may earn the Sovereign again — the car
//           itself is a KEPT car like any other, and crown.ts's
//           existence checks keep a second one from ever minting),
//           the Ch.5 choice, the pack choice, the Meridian
//           Pair lock + done flag, the Ledger Line choice + done
//           flag, the heist-clean flag, any live replay tag.
//   KEEPS   cash, cars (world/garage/fleet), properties (homes AND
//           the Phase 30 rental portfolio — a due repair bill rides
//           along with its unit, honestly: the debt is part of the
//           property), businesses
//           + staff + levels, any outstanding loan, skills, look /
//           barber state, the Sable Cup and drift records, mission
//           best-time stats (records, not progress gates), zone
//           reputation, gallery, settings and this save slot.
//
// Phase 49 PERSISTENCE CENSUS — every storage key in the game was
// listed and given an explicit NG+ decision (the lists above name
// most; the rest are decided HERE, not by omission):
//   KEEPS, by the day-serial design (ECO.daySerial never rewinds,
//   so day-scoped records stay honest across the reset): the eco
//   key incl. Phase 41 business events, harborfall-dayevents
//   (Phase 47), harborfall-crownseries (Phase 48 — an exposé
//   series already at the printers finishes printing in the new
//   run's first mornings; game/crown.ts), and the self-expiring
//   day sets (gym, destruct, wrecks, scaffold).
//   KEEPS, as career/profile records: harborfall-jobstats,
//   harborfall-postcards (Phase 43 — the set survives like the
//   Slide record), harborfall-cup, harborfall-slide,
//   harborfall-invest.
//   KEEPS, as the player's continuing life: harborfall-msgs /
//   -news / -social (the phone and the Wire keep their history —
//   this reset itself posts to both), harborfall-clothing,
//   harborfall-tunes, and the player's carried possessions —
//   harborfall-stash (fenceable inventory), harborfall-wpmods
//   (owned weapon mods) and harborfall-throw (throwables): NG+
//   restarts the story, it does not empty Rayan's pockets.
//   (Phase 50 audit: these three were kept by the code but unnamed
//   in the Phase 49 census; named now so the census is complete.)
//   KEEPS, as device/profile preferences (not story state):
//   harborfall-keybinds, harborfall-gyro, harborfall-theme,
//   harborfall-character, harborfall-mproom, harborfall-intro,
//   harborfall-tram-news.
//   RESETS beyond the story fields below: harborfall-heat, via
//   resetHeat() in the stand-down (Phase 29 — a fresh run starts
//   with a clean patrol file and a Fixer who has never met it).
//
// Before anything resets, every live system is stood down through
// its OWN stop path — the active mission (endMission), the arrest
// escort (cancelEscort), a dispatch call (standDownDispatch), a
// marina rental (endRental — the boat is collected, never kept),
// any race, tram/bus rides, world events, hold prompts and any
// in-progress job (Phase 21 audit: taxi/delivery/tow/farm phases
// and the tow tether — they used to leak across the reset; the
// Phase 22 odd jobs — courier chain + the valet's customer car —
// joined the list the phase they shipped) — so no
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
import { J, endValetJob, collectValetCar, endServiceJobs, collectMedCar, collectFireCar, endSnagRun } from "./jobs";
import { resetDrift } from "./drift";
import { standDownDerby } from "./derby";
import { standDownRegatta } from "./dayevents"; // Phase 47: a live regatta run stands down unsettled
import { resetHeat } from "./heat"; // Phase 29: the evidence file + Fixer cooldown reset with the run
import { F } from "./phase8";
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
  // Phase 34: a Slide Series RUN in progress is stood down the same
  // way — but the Series itself is a career record and STAYS, like
  // the Cup beside it (progress, round bests and the Slide Gold are
  // kept across NG+; only the live run and its arm are cleared).
  J.slide = null; J.slideArm = "";
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
  // Phase 23: the fare's personality is fare state too — a new run
  // must not inherit a Hurried ghost or a half-told Chatty story.
  J.taxiType = ""; J.taxiBarks = 0; J.taxiBarkAt = 0; J.taxiDmgBarked = false;
  J.delPhase = "idle"; J.delLeg = 0; J.delPoint = null;
  // Phase 41: a supply-snag errand in progress is stood down too.
  // The event RECORDS stay: they're keyed to ECO.daySerial, which
  // this reset never rewinds — the eco clock is one continuous
  // count across NG+, so today's event is still today's, and
  // tomorrow's tick rolls the new run's events as usual.
  // Phase 43 audit fix: this hand-rolled reset predated the Phase 42
  // serial stamp and never cleared J.snagSerial. It was inert (the
  // phase goes idle here and a fresh start re-stamps), but an exit
  // path that leaves the stamp behind is exactly the class Phase 42
  // hardened — route through endSnagRun like every other exit.
  endSnagRun();
  J.towPhase = "idle"; J.towCarId = -1; J.towHooked = false; J.towStillT = 0;
  J.farmPhase = "idle"; J.farmLoad = 0;
  // Phase 22: the odd jobs join the stand-down list. The courier
  // chain is pure state — reset it. The valet job holds a WORLD
  // object: if the player is sitting in the customer's car, step
  // them out first (the rental pattern above), then end the job,
  // which collects the car — a guest's car must not leak into the
  // new run either.
  J.courierPhase = "idle"; J.courierLeg = 0; J.courierPoint = null; J.courierLeft = 0;
  if (J.valetPhase !== "idle" || J.valetCarId >= 0) {
    if (G.driving && G.activeCarId === J.valetCarId) { G.driving = false; G.activeCarId = -1; }
    endValetJob(false);
    if (J.valetCollect) { collectValetCar(); J.valetCollect = false; }
  }
  // Phase 32: the service jobs join the stand-down list, same
  // pattern — a shift in progress (patient waiting, fire burning)
  // does not carry over the reset, and the service's vehicles are
  // collected, never leaked into the new run. Step out first if
  // the player is sitting in the unit when the phone confirms.
  if (J.medPhase !== "idle" || J.medCarId >= 0 || J.firePhase !== "idle" || J.fireCarId >= 0) {
    if (G.driving && (G.activeCarId === J.medCarId || G.activeCarId === J.fireCarId)) { G.driving = false; G.activeCarId = -1; }
    endServiceJobs();
    if (J.medCollect) { collectMedCar(); J.medCollect = false; }
    if (J.fireCollect) { collectFireCar(); J.fireCollect = false; }
  }
  resetDrift();
  // Phase 24: an open FISHING DERBY closes WITHOUT settling — no
  // prize, no best-score record (game/derby.ts). Phase17 sees
  // DERBY.open false and frees the event slot on its next frame;
  // G.eventNow is cleared below as for every other event.
  standDownDerby();
  // Phase 47: a live REGATTA RUN closes the same way — unsettled,
  // no time recorded (game/dayevents.ts). The DAY record itself is
  // serial-keyed and ECO.daySerial is never rewound, so a regatta
  // or market day carries across the reset exactly like the
  // business events do; only the live run is session state.
  standDownRegatta();
  // Phase 24, same reasoning: a cast in progress (shore or boat)
  // is a live mini-game state — the line comes in before the reset.
  F.phase = "idle"; F.spot = null; F.boatCar = -1;
  G.tramRide = -1; G.busRide = -1;
  G.eventNow = null;
  G.hold = null;
  G.wanted = 0; G.starHeat = 0; G.bustTimer = 0; G.wantedCooldown = 0;
  // Phase 29: the new run starts with a clean patrol file — evidence
  // zeroed, headline stage cleared, and the Fixer's once-a-day
  // cooldown forgotten (he has never met this run's Kade).
  resetHeat();

  // ---- the reset itself: exactly the fields a fresh slot starts
  // with (fresh-slot defaults audited against missionState.ts) ----
  M.storyIndex = 0;
  M.repeatIndex = 0; // Phase 21 audit: replay rotation is progress too
  M.storyDone = false;
  M.side = { lina: 0, voss: 0, heist: 0, after: 0, wire: 0, ledger: 0, quiet: 0, crown: 0 };
  // Phase 27: the Ledger Line's finale choice resets with the arc —
  // a fresh run may choose the other fate for the book.
  M.ledgerChoice = ""; M.ledgerDone = false;
  // Phase 48: the Harbour Crown's choice resets with the arc — a
  // fresh run may take the other branch at the auction (the +10%
  // dividend ends with crownDone; the Sovereign, once delivered,
  // is a kept car and crown.ts will not mint a duplicate).
  M.crownChoice = ""; M.crownDone = false; M.crownPaid = false; M.crownCarDelivered = false;
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
