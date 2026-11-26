// Harborfall — Phase 47: DAY EVENTS. Two additions to the ambient
// world that live at DAY scope, beside Phase 41's business events:
//
//   · HARBOUR REGATTA DAY — a buoy course is laid in the bay (the
//     Phase 42 pod's waters, south and west of Sable Island). Any
//     boat crossing the start gate arms a timed run through the
//     buoys and back through the gate. HONEST SCOPE: it is a time
//     trial against the clock and a target time — there are NO AI
//     racers and no ghost boat; the Bay Circuit already fields the
//     ghost, and inventing regatta "opponents" would be fake.
//   · CORAL STREET MARKET DAY — three canopy stalls pitch on the
//     Coral Shores promenade (food, parts, curios) with a small
//     crowd, for that day only.
//
// CADENCE + EXCLUSIVITY — these plug into the systems that already
// exist, not a parallel scheduler:
//   · The DAY ROLL runs inside advanceDay's serial guard (called
//     from game/economy.ts beside rollBizEvents), keyed to the day
//     serial that has just started, with the same per-record serial
//     check as a second lock — exactly once per day, sleep tick
//     included (the Phase 31/41 lesson). One roll, one slot: a day
//     is a regatta day OR a market day OR neither (~30% / ~30% /
//     ~40%) — the two never share a day, which is the existing
//     one-event-at-a-time rule written at day scope.
//   · The short ambient events (B2, Phase 17's challenge / cargo /
//     derby, the ambulance rush) keep their own session cadence
//     untouched — a day event is a fixture, not a slot holder, so
//     it does NOT sit on G.eventNow all day (that would silence
//     the harbour's short events for a whole day). The one place
//     the courtesy is claimed is the REGATTA RUN itself: while a
//     run is live it holds G.eventNow (kind "regatta") exactly as
//     the derby does, and it only ARMS when the shared conditions
//     are free — no mission, no J.race, no Slide run, no status
//     screen, no other event — the Phase 17 scheduler's own list.
//   · The day record persists per slot under its own key
//     (harborfall-dayevents, the postcards/Slide precedent) and is
//     keyed by serial, so yesterday's record is simply inert today:
//     stalls and buoys vanish at the day turn with no cleanup pass,
//     an unspent parts voucher expires with its day, and a prize
//     flag can't pay twice. NG+: ECO.daySerial is never rewound,
//     so the record carries across the reset like the business
//     events do (documented in game/ngplus.ts); a live regatta RUN
//     is session state and is stood down by the reset, unsettled,
//     like the derby (standDownRegatta below).
//
// WHY THE REGATTA DOESN'T SEIZE J.race: the shared race state
// carries rivals, stakes, Cup hooks and — in boat mode — a ghost
// rival the finish block requires (opps[0]). A no-opponent time
// trial forced through it would either fake a rival or bend the
// finish maths. The Sable Slide Series set the precedent instead:
// a sibling timer in its own module (game/slide.ts) — checkpoint
// sequence at the race radius (11u on water, the Bay Circuit's),
// an elapsed clock, a best in jobStats. The regatta follows that
// shape exactly, and its best lands in jobStats.bestTimes under
// "regatta", so the Records board and the Phase 8 leaderboard sync
// (postRaceResult posts the best of bestTimes — a genuine race
// time, lower wins, inside the service's clamp) treat it as what
// it is.
import { G, toast } from "./store";
import { ECO } from "./economy";
import { jobStats, persistJobStats, fmtTime } from "./jobs";
import { pushPhoneMsg } from "./phone";
import { pushNews } from "./feed";
import { sfx } from "./audio";

// ------------------------------------------------------------------
// The regatta course — buoys on the Phase 42 route waters (the pod
// swims this bay; audit section 13 walks every point against
// world.isWaterAt, the island, the bridge box, the boat chart
// clamp and the moored hulls, the section 11 rig).
// ------------------------------------------------------------------
/** The start/finish gate: two buoys flank this centre; crossing
 * the centre's 11u circle in a boat starts (and ends) a run. */
export const REGATTA_GATE = { x: 0, z: 150 };
export const REGATTA_GATE_BUOYS: ReadonlyArray<readonly [number, number]> = [[-7, 150], [7, 150]];
/** The course buoys, in running order — a loop around Sable Island
 * on the pod's water: north-east offshore → north-west → west →
 * south-west → south → the south-east bay → home to the gate. */
export const REGATTA_BUOYS: ReadonlyArray<readonly [number, number]> = [
  [-38, 132], [-100, 140], [-128, 178], [-88, 208], [-30, 210], [18, 188],
];
export const REGATTA_TARGET_S = 60; // beat the minute for the purse
export const REGATTA_PRIZE = 250;
export const REGATTA_CP_R = 11; // the boat-race checkpoint radius (Bay Circuit's)
const REGATTA_KINDS = ["boat", "skiff"] as const;
export const isBoatKind = (kind: string): boolean => (REGATTA_KINDS as readonly string[]).includes(kind);

// ------------------------------------------------------------------
// The market — three stalls on the Coral promenade (z=211.7, the
// pedestrian gap between the house row and the shop row; audit
// section 13 checks footprints against colliders, the driven lane
// segments and the promenade doors, and keeps them off the bridge
// ramp landing, which crosses the promenade at x 53–67). The stalls are event fixtures in the
// Phase 17 sense — owned meshes, never drawn from the ambient
// pools, and (like Phase 17's crates and challenger) presentation
// props: they are not in the static blocker set because they
// exist one day at a time; the audit guarantees they never sit
// inside a building or across a lane.
// ------------------------------------------------------------------
export interface MarketStall { id: "food" | "parts" | "curios"; name: string; keeper: string; x: number; z: number; canopy: string; }
export const MARKET_STALLS: MarketStall[] = [
  { id: "food", name: "Harbour Kitchen stall", keeper: "Market cook", x: 41.5, z: 211.7, canopy: "#e8a33d" },
  { id: "parts", name: "Dockside Parts stall", keeper: "Parts trader", x: 80, z: 211.7, canopy: "#2e8a8a" },
  { id: "curios", name: "Curios & Salvage stall", keeper: "Curios dealer", x: 100, z: 211.7, canopy: "#b3542e" },
];
/** Crowd figure spots (the vignette pattern — buildHumanoid rigs
 * owned by components/DayEvents.tsx): two talking pairs browsing
 * the stalls, on the promenade's water side. */
export const MARKET_CROWD: ReadonlyArray<{ x: number; z: number; face: number; talker: boolean }> = [
  { x: 38.6, z: 209.7, face: 2.2, talker: true },
  { x: 40.1, z: 208.7, face: -0.9, talker: false },
  { x: 82.5, z: 210.2, face: -2.4, talker: false },
  { x: 84, z: 210.4, face: 0.75, talker: true },
];
/** The parts stall's trade: ONE random upgrade line is 25% off at
 * Lina's bench for the day — a voucher, not a shop. The purchase
 * itself flows through the bench's existing buy path
 * (components/ModMenu.tsx) with this discount applied, once. */
export type PartsDealKind = "tune" | "brakes" | "tyres" | "respray";
export const PARTS_DEALS: Record<PartsDealKind, string> = {
  tune: "Engine tune", brakes: "Brakes", tyres: "Drift tyres", respray: "Respray",
};
export const MARKET_PARTS_DISCOUNT = 0.25;
/** The curios stall buys the player's fenceable stash at +20% —
 * through game/theft.ts sellStash with the bonus flag, priced off
 * the same stashTotal() the pawn counter uses. */
export const MARKET_FENCE_BONUS = 0.2;
/** The one price function for the parts deal: the stall advertises
 * the percentage, the bench shows and charges marketPrice(cost) —
 * the same function both sides, so the dollar figure can never
 * disagree with itself. */
export const marketPrice = (cost: number): number => Math.round(cost * (1 - MARKET_PARTS_DISCOUNT));

// ------------------------------------------------------------------
// Persisted day state (per slot, own key).
// ------------------------------------------------------------------
export type DayEventKind = "regatta" | "market";
export interface DayEventState {
  serial: number;              // the day this record belongs to
  kind: DayEventKind | null;   // null = a quiet day
  partsDeal: PartsDealKind;    // market days: the day's bench deal
  partsDealUsed: boolean;      // the voucher has been spent
  regattaPrizePaid: boolean;   // today's regatta purse has been won
}
const freshDay = (serial: number): DayEventState => ({
  serial, kind: null, partsDeal: "tune", partsDealUsed: false, regattaPrizePaid: false,
});
export let DAY: DayEventState = freshDay(-1);
function loadDay() {
  try {
    const raw = localStorage.getItem("harborfall-dayevents");
    if (raw) {
      const s = JSON.parse(raw) as Partial<DayEventState>;
      if (s && typeof s.serial === "number" && (s.kind === "regatta" || s.kind === "market" || s.kind === null || s.kind === undefined)) {
        DAY = {
          serial: Math.floor(s.serial),
          kind: s.kind === "regatta" || s.kind === "market" ? s.kind : null,
          partsDeal: (Object.keys(PARTS_DEALS) as PartsDealKind[]).includes(s.partsDeal as PartsDealKind) ? (s.partsDeal as PartsDealKind) : "tune",
          partsDealUsed: !!s.partsDealUsed,
          regattaPrizePaid: !!s.regattaPrizePaid,
        };
        return;
      }
    }
  } catch { /* per-key guard (Phase 15): a bad key never blocks boot */ }
  DAY = freshDay(-1);
}
export function persistDay() {
  try { localStorage.setItem("harborfall-dayevents", JSON.stringify(DAY)); } catch { /* quota */ }
}
loadDay();

/** Today's event record, or null when the day has none (a record
 * from any other serial is inert — the Phase 41 read rule). */
export function dayEventToday(): DayEventState | null {
  return DAY.serial === ECO.daySerial && DAY.kind ? DAY : null;
}
export const isRegattaDay = (): boolean => dayEventToday()?.kind === "regatta";
export const isMarketDay = (): boolean => dayEventToday()?.kind === "market";

/** The morning roll — called ONLY from advanceDay, inside the
 * serial guard, with the serial of the day that has just started
 * (rollBizEvents' contract, same file). Exactly-once is doubled:
 * the guard outside, and the serial check here — a record already
 * stamped with this serial is never re-rolled. A fresh save's
 * first day (serial 0) predates the first tick, so it is quiet —
 * the same rule the business events live by. */
export function rollDayEvents(serial: number) {
  if (DAY.serial === serial) return; // exactly-once, belt and braces
  const next = freshDay(serial);
  const roll = Math.random();
  if (roll < 0.3) next.kind = "regatta";
  else if (roll < 0.6) {
    next.kind = "market";
    const kinds = Object.keys(PARTS_DEALS) as PartsDealKind[];
    next.partsDeal = kinds[Math.floor(Math.random() * kinds.length)];
  }
  DAY = next;
  persistDay();
  if (next.kind === "regatta") {
    pushNews("Harbour Wire: REGATTA DAY ON THE BAY", `The harbourmaster's launch was out before dawn laying the amber buoys — a loop around Sable Island, out of the gate off the pier and home again. Any boat through the start gate is on the clock; beat ${fmtTime(REGATTA_TARGET_S)} and the day's $${REGATTA_PRIZE} purse is yours, once. No other boats are racing you — the harbour only races itself, and the harbour is quick.`);
    pushPhoneMsg("Harbourmaster", `⛵ REGATTA DAY. The buoy course is laid in the bay — sail any boat through the start gate off the pier (the two teal buoys) and you're on the clock: six amber buoys in order, then back through the gate. Beat ${fmtTime(REGATTA_TARGET_S)} for $${REGATTA_PRIZE} — the purse pays once today. Your best time goes in the harbour book (Stats → Records) either way.`);
  } else if (next.kind === "market") {
    pushNews("Harbour Wire: STREET MARKET ON THE CORAL PROMENADE", `The Coral Shores traders have pitched their canopies along the promenade for the day: a kitchen stall, a parts trader doing one line at 25% off Lina's bench prices, and a curios dealer paying over the odds for salvage. Dusk takes it all away — the promenade is a promenade again by morning.`);
    pushPhoneMsg("Coral Shores Traders", `🧺 MARKET DAY on the Coral promenade, today only. Food at the kitchen stall; the parts stall's deal is ${PARTS_DEALS[next.partsDeal].toUpperCase()} — 25% off at Lina's bench, one purchase, ask the stall; and the curios dealer buys stash at +20% over the pawn price. All gone at day's end.`);
  }
}

// ------------------------------------------------------------------
// The regatta run — session state (the derby.ts idiom: the module
// owns the run, the component owns the meshes + the event slot).
// ------------------------------------------------------------------
export const REG = {
  active: false,
  cp: 0,          // next buoy index; === REGATTA_BUOYS.length means "home to the gate"
  startedAt: 0,   // clock time (G.timeS base — the component's frame clock) at the gun
};

/** Arm a run (the component has already checked the courtesy
 * conditions and the boat). The clock starts at the crossing —
 * there is no countdown; sailing through the gate IS the start,
 * which is how a harbour time trial honestly works. */
export function startRegattaRun(t: number) {
  REG.active = true; REG.cp = 0; REG.startedAt = t;
}

/** Settle a finished run: best time into the harbour book, the
 * purse once per regatta day for beating the target. Mirrors the
 * Bay Circuit finish's accounting (racesRun, bestTimes) without
 * its ghost. Returns true when a run was settled — the component
 * then fires the Phase 8 leaderboard sync (postRaceResult reads
 * import.meta.env, so it can never live in this headless-audited
 * module; the race finishes call it from Phase7 for the same
 * reason this one is called from components/DayEvents.tsx). */
export function finishRegattaRun(t: number): boolean {
  if (!REG.active) return false;
  REG.active = false;
  const time = Math.round((t - REG.startedAt) * 10) / 10;
  const bt = jobStats.bestTimes["regatta"];
  const isBest = !bt || time < bt;
  if (isBest) jobStats.bestTimes["regatta"] = time;
  jobStats.racesRun += 1;
  let prize = 0;
  if (time <= REGATTA_TARGET_S && DAY.serial === ECO.daySerial && !DAY.regattaPrizePaid) {
    prize = REGATTA_PRIZE;
    DAY.regattaPrizePaid = true;
    persistDay();
    G.cash += prize; G.lifetimeEarned += prize;
  }
  persistJobStats();
  if (prize > 0) {
    toast(`⛵ REGATTA — ${fmtTime(time)}! Under the ${fmtTime(REGATTA_TARGET_S)} target — the $${prize} purse is yours${isBest ? " · new best" : ""}`);
    pushPhoneMsg("Harbourmaster", `⛵ ${fmtTime(time)} through the gate — under the target, and the day's $${prize} purse changes hands. ${isBest ? "That's the fastest the course has been run on this book." : `The book's best stands at ${fmtTime(jobStats.bestTimes["regatta"])}.`} The buoys stay out till dusk if you want another run — the purse doesn't pay twice.`);
    sfx.cash();
  } else {
    toast(`⛵ REGATTA — ${fmtTime(time)}${isBest ? " · new best" : ""} (target ${fmtTime(REGATTA_TARGET_S)}${DAY.regattaPrizePaid ? " — purse already won today" : ""})`);
    pushPhoneMsg("Harbourmaster", `⛵ ${fmtTime(time)} through the gate — in the book${isBest ? " as your best" : ""}. ${time > REGATTA_TARGET_S ? `The purse wants ${fmtTime(REGATTA_TARGET_S)} or better; the course is out till dusk.` : "The purse was already won today — the buoys stay out for the running, not the money."}`);
    sfx.complete();
  }
  return true;
}

/** NG+ stand-down (game/ngplus.ts): close WITHOUT settling — no
 * time recorded, no purse. The component notices REG.active is
 * false and frees the event slot on its next frame (the derby's
 * arrangement, verbatim). */
export function standDownRegatta() {
  REG.active = false; REG.cp = 0; REG.startedAt = 0;
}

// ------------------------------------------------------------------
// The parts voucher — read by components/ModMenu.tsx (the bench)
// and the market stall's prompt. The deal is live only on a market
// day, for the day's one line, until spent.
// ------------------------------------------------------------------
/** The live deal line, or null (not a market day / already spent). */
export function marketDealActive(): PartsDealKind | null {
  const d = dayEventToday();
  return d && d.kind === "market" && !d.partsDealUsed ? d.partsDeal : null;
}
/** Spend the voucher (the bench calls this inside its buy path,
 * after the purchase lands — purchases there are synchronous, so
 * a voucher can never be stranded mid-transaction). */
export function consumeMarketDeal() {
  if (DAY.serial !== ECO.daySerial || DAY.kind !== "market" || DAY.partsDealUsed) return;
  DAY.partsDealUsed = true;
  persistDay();
}
