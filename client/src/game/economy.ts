// Harborfall — Phase 7 economy deepening (work item 4): buyable
// businesses with a daily income tick, a second property (Coral Shores
// apartment) and sleeping. THE daily tick is the game-day rollover:
// advanceDay() runs when the day cycle wraps past 06:00 AND when the
// player sleeps (sleep jumps to morning, which is the same tick — one
// consistent rule, guarded by daySerial so it can never double-pay).
import { G, toast, bark, nowS, persistZoneRep } from "./store";
import { rollDayEvents } from "./dayevents"; // Phase 47: the day-event roll rides the same guarded tick
import { crownBuyoutLive } from "./missionState"; // Phase 48: the Meridian buy-out dividend (single-source, below)
import { crownDayTick } from "./crown"; // Phase 48: the exposé series prints on the same guarded tick
import { pushPhoneMsg } from "./phone";
import { pushNews } from "./feed";
import { sfx } from "./audio";

export interface BusinessDef { id: string; name: string; price: number; income: number; x: number; z: number; blurb: string; district: string; }
export const BUSINESSES: BusinessDef[] = [
  { id: "wraps", name: "Harbour Wraps stall", price: 3500, income: 120, x: 31.5, z: 9.5, district: "Market Row", blurb: "The Market Row food stall — harbour lunches, every day." },
  { id: "wash", name: "Northgate Car Wash", price: 6000, income: 220, x: -44, z: -214, district: "Northgate", blurb: "Rich cars get dirty too. Yours stays free of charge in spirit." },
  { id: "club", name: "Club Solace — 50% share", price: 12000, income: 450, x: 54, z: 112, district: "The Docks", blurb: "Half the bar, half the door, all of the bass." },
  // Phase 19: the fourth business — the marina office on the pier
  // road. Owning it also unlocks the rental dock (game/rentals.ts):
  // a $75 day-pass skiff from the dock point by the Bay Circuit ring.
  // Phase 21 balance: income 380 → 430 — at $15,000 it had the worst
  // base payback in the portfolio (39 days vs 27–29 for the others);
  // 430 brings it to ~35 days, still the slowest earner, priced for
  // the rental-dock unlock it carries.
  { id: "marina", name: "Sable Marina Rentals", price: 15000, income: 430, x: 17, z: 108, district: "The Docks", blurb: "Every boat in the bay, rented by the day — and the Bay Circuit starts at your dock." }, // Phase 25: buy point moved off a tree trunk at (13.5,110)
];
export const APARTMENT = { name: "Coral Shores Apartment", price: 5000, x: 36, z: 211.7 }; // Phase 25: promenade gap (was inside the shop row)
/** Phase 14: the second purchasable property — a Northgate loft with
 * a harbour-view interior. Owning it changes nothing about business
 * income; it adds a sleep/respawn home in the north of the city. */
export const LOFT = { name: "Northgate Loft", price: 9000, x: -68, z: -195.2 };

// ---- Phase 15: business staffing grows up — a named ROSTER. Each
// business can employ up to MAX_STAFF_PER_BIZ people from the pool;
// every person has their own takings bonus and wage (one-line trait
// shown in the Bank app BEFORE hiring, per the Phase 9 rule that the
// net is visible before you commit). Wages + bonuses land in the
// same guarded daily tick as the base income. ----
export interface StaffDef { name: string; trait: string; bonus: number; wage: number; }
export const STAFF_ROSTER: StaffDef[] = [
  { name: "Tom Beck", trait: "The original hand — dependable, no surprises", bonus: 0.5, wage: 35 },
  { name: "Marta Reyes", trait: "Ex-hotel manager — squeezes more from every shift", bonus: 0.55, wage: 38 },
  { name: "Dev Okafor", trait: "Part-timer — smaller bonus, cheapest wage on the roster", bonus: 0.4, wage: 25 },
  { name: "Sana Iqbal", trait: "Night owl — the best takings in town, and her bonus doubles after dark (20:00–06:00)", bonus: 0.75, wage: 55 },
];
export const MAX_STAFF_PER_BIZ = 2;
export const staffDef = (name: string) => STAFF_ROSTER.find((s) => s.name === name);

export const ECO = {
  owned: [] as string[],
  ownsApartment: false,
  ownsLoft: false, // Phase 14
  daySerial: 0,
  lastPaidSerial: -1,
  // Phase 9 shape (one anonymous hand per business) — kept only as
  // the migration source for staffBy below.
  staff: [] as string[],
  // Phase 15: business id → up to 2 roster names employed there.
  staffBy: {} as Record<string, string[]>,
  // Phase 19: business upgrade levels (1..3) — absent = level 1, so
  // old saves default to L1 at exactly their old income.
  levels: {} as Record<string, number>,
  // Phase 41: today's business event per business id (see the
  // BUSINESS EVENTS block below). Keyed by day serial inside the
  // record; a record whose serial isn't the day being read is inert.
  bizEvents: {} as Record<string, BizEvent>,
};
// ---- Phase 19: SABLEBANK LOANS. One loan at a time: a principal
// from LOAN_TIERS, 8% interest per game day on the outstanding
// balance (the total owed can never exceed 2× the principal), and
// the morning tick auto-repays 10% of what's owed from cash on hand
// (never below $0 — a shortfall simply stays owed). Declared before
// the load below, which restores it from the eco key. ----
export const LOAN_TIERS = [500, 1500, 4000];
export const LOAN = { principal: 0, owed: 0 };
try {
  const raw = localStorage.getItem("harborfall-eco");
  if (raw) {
    const e = JSON.parse(raw) as Partial<typeof ECO>;
    ECO.owned = Array.isArray(e.owned) ? e.owned : [];
    ECO.ownsApartment = !!e.ownsApartment;
    ECO.ownsLoft = !!e.ownsLoft;
    ECO.daySerial = e.daySerial ?? 0;
    ECO.lastPaidSerial = e.lastPaidSerial ?? -1;
    ECO.staff = Array.isArray(e.staff) ? e.staff : [];
    if (e.staffBy && typeof e.staffBy === "object") {
      for (const [biz, names] of Object.entries(e.staffBy)) {
        if (Array.isArray(names)) ECO.staffBy[biz] = names.filter((n) => typeof n === "string" && staffDef(n)).slice(0, MAX_STAFF_PER_BIZ);
      }
    }
    // migration: a Phase 9–14 anonymous hand becomes Tom Beck (his
    // numbers ARE the old +50%/−$35), so no existing save's daily
    // income changes by a cent on upgrade.
    for (const biz of ECO.staff) if (!ECO.staffBy[biz]) ECO.staffBy[biz] = ["Tom Beck"];
    // Phase 19: upgrade levels — validated into 1..3, anything else
    // is dropped back to the L1 default.
    if (e.levels && typeof e.levels === "object") {
      for (const [biz, lvl] of Object.entries(e.levels)) {
        const n = Math.floor(Number(lvl));
        if (n >= 2 && n <= 3) ECO.levels[biz] = n;
      }
    }
    // Phase 41: today's business events — validated the same way
    // (known kind, numeric serial; anything else is dropped, and a
    // stale-serial record is inert at read time anyway).
    if (e.bizEvents && typeof e.bizEvents === "object") {
      const kinds = ["rush", "quiet", "snag", "inspection", "star"];
      for (const [biz, ev] of Object.entries(e.bizEvents)) {
        const v = ev as Partial<BizEvent>;
        if (v && typeof v.serial === "number" && typeof v.kind === "string" && kinds.includes(v.kind)) {
          ECO.bizEvents[biz] = { serial: Math.floor(v.serial), kind: v.kind as BizEventKind, staff: typeof v.staff === "string" ? v.staff : undefined, fine: typeof v.fine === "number" ? v.fine : undefined, paid: typeof v.paid === "number" ? v.paid : undefined, passed: typeof v.passed === "boolean" ? v.passed : undefined, fixed: !!v.fixed };
        }
      }
    }
    // Phase 19: the SableBank loan record (own fields, same key,
    // same guard — a bad eco key never blocks boot, Phase 15 rule).
    const l = (e as { loan?: { principal?: number; owed?: number } }).loan;
    if (l && typeof l.principal === "number" && typeof l.owed === "number" && l.owed > 0) {
      LOAN.principal = Math.max(0, Math.floor(l.principal));
      LOAN.owed = Math.max(0, Math.floor(l.owed));
    }
  }
} catch { /* fresh economy */ }
export function persistEco() {
  try {
    localStorage.setItem("harborfall-eco", JSON.stringify({ ...ECO, loan: LOAN }));
    localStorage.setItem("harborfall-apartment", ECO.ownsApartment ? "1" : "0");
    localStorage.setItem("harborfall-loft", ECO.ownsLoft ? "1" : "0");
  } catch { /* ignore */ }
}
export const STAFF_WAGE = 35; // legacy Phase 9 numbers — Tom Beck's line in the roster keeps them
export const STAFF_BONUS = 0.5;

// ---- Phase 19: BUSINESS UPGRADES. Each owned business runs levels
// 1→3; each level adds +35% TAKINGS (the gross the staff bonuses are
// percentages of). L2 costs 60% of the buy price, L3 120%.
// ---- Phase 21 BALANCE PASS (numbers only, see docs/BLUEPRINT.md):
// the Phase 19 costs made the marginal payback on an upgrade the
// worst sink in the game — L2 needed 46–68 days of its own +35% to
// repay, L3 91–135 days, and L3 cost MORE than the business itself.
// Costs are now L2 = 40% / L3 = 75% of the buy price: unstaffed
// marginal payback ≈ 27–45 days (L2) / 48–84 days (L3), roughly half
// that with a full crew (staff bonuses are percentages of the same
// gross, so they scale with the level too). Upgrades remain the
// slowest money in Port Sable — they are the endgame sink — but no
// longer a trap. The +35%/level takings are unchanged, so no
// existing owner's daily pay moves a cent; only future upgrade
// prices drop. ----
export const bizLevel = (id: string): number => Math.max(1, Math.min(3, Math.floor(ECO.levels[id] ?? 1) || 1));
export const levelMult = (lvl: number): number => 1 + 0.35 * (lvl - 1);
export const upgradeCost = (b: BusinessDef): number => {
  const lvl = bizLevel(b.id);
  return lvl >= 3 ? 0 : Math.round(b.price * (lvl === 1 ? 0.4 : 0.75));
};
export function upgradeBusiness(id: string): boolean {
  const b = BUSINESSES.find((x) => x.id === id);
  if (!b || !ECO.owned.includes(id)) return false;
  const lvl = bizLevel(id);
  if (lvl >= 3) { toast(`${b.name} is already at max level.`); return false; }
  const cost = upgradeCost(b);
  if (G.cash < cost) { toast(`Level ${lvl + 1} for ${b.name} costs $${cost.toLocaleString()} — not enough cash.`); sfx.dryFire(); return false; }
  G.cash -= cost;
  ECO.levels[id] = lvl + 1;
  persistEco();
  pushPhoneMsg("SableBank", `🏢 -$${cost.toLocaleString()} — ${b.name} upgraded to Level ${lvl + 1}. Takings now +${Math.round((levelMult(lvl + 1) - 1) * 100)}% — $${businessDailyNet(b)}/day on the current crew.`);
  toast(`🏢 ${b.name} → Level ${lvl + 1} — now pays $${businessDailyNet(b)}/day`);
  sfx.cash();
  return true;
}

// ---- Phase 19: STAFF TRAITS, LIVE. Sana Iqbal's trait is the
// night: her bonus counts DOUBLE during 20:00–06:00. The daily tick
// can't fire "at night" (it settles a whole day at 06:00), so her
// contribution is a documented DAY/NIGHT SPLIT of the day she
// worked: 14 day hours at her base bonus + 10 night hours at double
// — staffDailyBonus below. The Bank UI separately shows her
// CURRENT rate (staffBonusNow) so the player watches it flip at
// 20:00. Tom, Marta and Dev stay flat, as their traits document. ----
const gameHourNow = () => Math.floor((G.dayTime * 24 + 6) % 24); // same formula as Interactions.gameHour
export const isNightNow = () => { const h = gameHourNow(); return h >= 20 || h < 6; };
/** What a staffer's bonus is worth RIGHT NOW (UI display). */
export function staffBonusNow(s: StaffDef): number {
  if (s.name === "Sana Iqbal" && isNightNow()) return s.bonus * 2;
  return s.bonus;
}
/** What a staffer actually contributes over one settled day. */
export function staffDailyBonus(s: StaffDef, gross: number): number {
  if (s.name === "Sana Iqbal") {
    const dayShare = Math.round(gross * s.bonus * (14 / 24));
    const nightShare = Math.round(gross * s.bonus * 2 * (10 / 24));
    return dayShare + nightShare;
  }
  return Math.round(gross * s.bonus);
}
/** Per-business daily net with its current roster and upgrade level
 * (Bank app display + the daily tick use this one function, so
 * what's shown is what's paid — the Phase 16 contract). */
export function businessDailyNet(b: BusinessDef, forSerial: number = ECO.daySerial): number {
  const gross = Math.round(b.income * levelMult(bizLevel(b.id)));
  const crew = ECO.staffBy[b.id] ?? [];
  // Phase 41: today's business event for THIS serial (a record from
  // any other day is inert — the serial check is what keeps the
  // Bank's today-figure and tomorrow's payout the same number).
  const ev = bizEventFor(b.id, forSerial);
  let net = gross;
  for (const name of crew) {
    const s = staffDef(name);
    if (!s) continue;
    // Staff star: the named hand's takings bonus counts double for
    // the day (the wage is unchanged — a star day isn't a pay rise).
    const bonus = staffDailyBonus(s, gross) * (ev?.kind === "star" && ev.staff === name ? 2 : 1);
    net += bonus - s.wage;
  }
  // Phase 23: CLUB WEEKEND DOOR BONUS — owning the Club Solace
  // share pays +25% of the house gross on Friday and Saturday
  // nights (the club's real doors, game/club.ts: 20:00–04:00, fall
  // inside those days). It lives HERE, inside the one net function,
  // so the Bank figure and the morning tick can never disagree
  // (the Phase 16 contract). The term keys to a DAY SERIAL: the
  // tick settles the day that just ended (advanceDay passes that
  // serial explicitly), while the Bank displays the CURRENT serial
  // — the day in progress, whose night tonight settles at tomorrow's
  // tick under the same serial. Crew percentages stay on the base
  // gross; the door bonus is on the house take only.
  if (b.id === "club" && isClubWeekendNight(forSerial)) net += Math.round(gross * CLUB_WEEKEND_UPLIFT);
  // Phase 41: the day-shape events scale the whole net (crew and
  // club door included) — rush +50%, quiet −30%, an unfixed supply
  // snag halves it. Inspection never touches income (its fine is a
  // cash event at roll time) and the star is applied in the loop.
  if (ev) {
    if (ev.kind === "rush") net = Math.round(net * 1.5);
    else if (ev.kind === "quiet") net = Math.round(net * 0.7);
    else if (ev.kind === "snag" && !ev.fixed) net = Math.round(net * 0.5);
  }
  // Phase 48: the MERIDIAN BUY-OUT dividend. Winning crown3's
  // auction put the harbour stake in the player's name, and every
  // business they run pays a 10% harbour dividend on its takings —
  // permanently. Applied HERE, last, inside the one net function
  // the Bank display and the morning tick both read (the Phase 16
  // shown = paid contract), and gated on choice + completion +
  // the wired escrow (missionState's crownBuyoutLive).
  if (crownBuyoutLive()) net = Math.round(net * 1.1);
  return net;
}
export const dailyIncomeTotal = (forSerial: number = ECO.daySerial) => BUSINESSES.filter((b) => ECO.owned.includes(b.id)).reduce((a, b) => a + businessDailyNet(b, forSerial), 0);

// ---- Phase 41: BUSINESS EVENTS. Every morning, inside the same
// serial-guarded tick that pays the businesses, each OWNED business
// rolls ~35% for a one-day event. The event is keyed to the day it
// applies to (the serial that has just STARTED — the day the Bank
// app displays), and every money effect flows through
// businessDailyNet, so the figure the Bank shows today is exactly
// what tomorrow's tick pays (the Phase 16 shown = paid contract,
// extended). The one exception is the inspection fine, which is a
// cash event at roll time — it never passes through the net, and
// the morning message says so.
//   · RUSH — takings +50% today; a Wire headline, sometimes.
//   · QUIET — takings −30% today.
//   · SUPPLY SNAG — takings halved today, UNLESS the player runs
//     the supply errand (game/jobs.ts + Phase7): depot → business
//     door, $0 pay (it's your own stock), restores the full day and
//     warms the district +2. Unfixed, it simply expires at day end.
//   · INSPECTION — 15% flat fail chance; a fail fines $120–$300,
//     collected from cash on hand, floored at $0 (the record keeps
//     both the assessed fine and what was actually collected).
//   · STAFF STAR — one named hand's takings bonus counts double
//     today (needs a crew; an unstaffed business can't roll it).
// NG+: businesses are kept and ECO.daySerial is never rewound, so
// the records carry across the reset cleanly — today's event is
// still today's, and the next tick rolls the new run's events. ----
export type BizEventKind = "rush" | "quiet" | "snag" | "inspection" | "star";
export interface BizEvent { serial: number; kind: BizEventKind; staff?: string; fine?: number; paid?: number; passed?: boolean; fixed?: boolean; }
export const BIZ_EVENT_CHANCE = 0.35;
export const INSPECTION_FAIL_CHANCE = 0.15;
export const INSPECTION_FINE_MIN = 120;
export const INSPECTION_FINE_MAX = 300;
export const INSPECTOR = "Inspector Hale — Port Sable City";

/** The event in force for a business on a given day serial. */
export function bizEventFor(bizId: string, serial: number): BizEvent | undefined {
  const ev = ECO.bizEvents[bizId];
  return ev && ev.serial === serial ? ev : undefined;
}
/** The event in force for a business TODAY (the Bank badge reads this). */
export const bizEventToday = (b: BusinessDef) => bizEventFor(b.id, ECO.daySerial);
/** Who speaks for a business in the morning messages: its first
 * roster hand, or the business itself while it's unstaffed. */
export const bizSpeaker = (b: BusinessDef) => (ECO.staffBy[b.id] ?? [])[0] ?? b.name;

/** Roll one day of events for every owned business. Called ONLY
 * from advanceDay, inside the serial guard, with the serial of the
 * day that has just started — so it runs exactly once per day,
 * sleep tick included (the Phase 31 lesson: one place does day
 * work). The per-business serial check is a second lock: a record
 * already stamped with this serial is never re-rolled. */
export function rollBizEvents(serial: number) {
  let rushBiz: BusinessDef | null = null;
  for (const b of BUSINESSES) {
    if (!ECO.owned.includes(b.id)) continue;
    if (ECO.bizEvents[b.id]?.serial === serial) continue; // exactly-once, belt and braces
    delete ECO.bizEvents[b.id]; // yesterday's record is spent either way
    if (Math.random() >= BIZ_EVENT_CHANCE) continue;
    const crew = ECO.staffBy[b.id] ?? [];
    const kinds: BizEventKind[] = ["rush", "quiet", "snag", "inspection"];
    if (crew.length) kinds.push("star");
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const ev: BizEvent = { serial, kind };
    if (kind === "star") ev.staff = crew[Math.floor(Math.random() * crew.length)];
    if (kind === "inspection") {
      ev.passed = Math.random() >= INSPECTION_FAIL_CHANCE;
      if (!ev.passed) {
        ev.fine = INSPECTION_FINE_MIN + Math.floor(Math.random() * (INSPECTION_FINE_MAX - INSPECTION_FINE_MIN + 1));
        ev.paid = Math.min(G.cash, ev.fine); // floored at $0 — the city takes what's there
        G.cash -= ev.paid;
      }
    }
    ECO.bizEvents[b.id] = ev;
    if (kind === "rush") {
      if (!rushBiz) rushBiz = b;
      pushPhoneMsg(bizSpeaker(b), `🔥 Rush day at the ${b.name}! Word got round — takings run +50% today. It's already in the SableBank figure; the money lands tomorrow morning with the rest.`);
    } else if (kind === "quiet") {
      pushPhoneMsg(bizSpeaker(b), `🌙 Quiet day at the ${b.name} — takings run −30% today. Some days the harbour just stays home. (Already in the SableBank figure.)`);
    } else if (kind === "snag") {
      pushPhoneMsg(bizSpeaker(b), `📦 Supply snag at the ${b.name}: the delivery never showed, so takings are HALVED today. Run the supply run — from the business's door, or the SableBank app — fetch stock from a depot and bring it back, and the full day is restored, today included. No pay on the run: it's your own stock. Leave it, and the snag just expires at day's end.`);
    } else if (kind === "inspection") {
      pushPhoneMsg(INSPECTOR, ev.passed
        ? `🧾 Inspection at the ${b.name}: PASSED. Records clean, exits clear, grease trap… acceptable. No fine.`
        : `🧾 Inspection at the ${b.name}: FAILED. Fine $${ev.fine} — $${ev.paid} collected from your account this morning. The report mentions the words 'harbour grime' four times.`);
    } else if (kind === "star" && ev.staff) {
      pushPhoneMsg(ev.staff, `⭐ It's my day, apparently — everything I touch at the ${b.name} turns over twice. My takings bonus counts DOUBLE today. (Already in the SableBank figure.)`);
    }
  }
  // A rush day at a player's business is Wire news — sometimes.
  if (rushBiz && Math.random() < 0.5) {
    pushNews(`Harbour Wire: queues at the ${rushBiz.name}`, `Word of mouth did what advertising couldn't — the ${rushBiz.name} in ${rushBiz.district} was turning people away by mid-morning. Local trade groups call it 'the Kade effect'; the owner calls it Tuesday.`);
  }
  persistEco();
}

/** The supply errand landed: restore the business's full day and
 * warm its district a touch. Returns false if there is no live,
 * unfixed snag for the business today (the run was a ghost). */
export function markSnagFixed(b: BusinessDef): boolean {
  const ev = bizEventToday(b);
  if (!ev || ev.kind !== "snag" || ev.fixed) return false;
  ev.fixed = true;
  persistEco();
  G.zoneRep[b.district] = Math.min(100, (G.zoneRep[b.district] ?? 0) + 2);
  persistZoneRep();
  return true;
}

// ---- Phase 23: the game WEEK. Day serials count from a fresh
// save's first morning; serial 0 is a Monday. The club term above
// is the week's first consumer — Fri/Sat nights are when Port
// Sable goes out. ----
export const weekdayOf = (serial: number) => ((serial % 7) + 7) % 7; // 0 Mon · 1 Tue · 2 Wed · 3 Thu · 4 Fri · 5 Sat · 6 Sun
export const isClubWeekendNight = (serial: number) => { const w = weekdayOf(serial); return w === 4 || w === 5; };
export const CLUB_WEEKEND_UPLIFT = 0.25;

/** Borrow a tier. Blocked while a loan is outstanding, and the
 * bank won't serve a player the patrol is actively hunting (3★+). */
export function borrowLoan(tier: number): boolean {
  if (!LOAN_TIERS.includes(tier)) return false;
  if (LOAN.owed > 0) { toast("SableBank: one loan at a time — clear the current one first."); sfx.dryFire(); return false; }
  if (G.wanted >= 3) {
    toast("SableBank won't lend while you're wanted 3★+ — lose the heat first.");
    bark("SableBank clerk", "Come back when the helicopters aren't looking for you, friend.");
    sfx.dryFire(); return false;
  }
  G.cash += tier;
  LOAN.principal = tier; LOAN.owed = tier;
  persistEco();
  pushPhoneMsg("SableBank", `🏦 Loan approved: +$${tier.toLocaleString()} in your account. 8% daily interest on what's owed (never more than $${(tier * 2).toLocaleString()} total); 10% auto-repays each morning from your cash.`);
  toast(`🏦 SableBank loan +$${tier.toLocaleString()} — $${tier.toLocaleString()} owed`);
  sfx.cash();
  return true;
}
/** Manual repayment (partial or full), cash-limited. */
export function repayLoan(amount: number): number {
  if (LOAN.owed <= 0) return 0;
  const pay = Math.min(amount, LOAN.owed, G.cash);
  if (pay <= 0) { toast("Nothing to repay with — your cash is empty."); sfx.dryFire(); return 0; }
  G.cash -= pay; LOAN.owed -= pay;
  if (LOAN.owed <= 0) {
    LOAN.owed = 0; LOAN.principal = 0;
    pushPhoneMsg("SableBank", "✅ Loan repaid in full — your account's clean. SableBank thanks you for your business.");
    toast("✅ SableBank loan repaid in full");
  } else toast(`🏦 Repaid $${pay.toLocaleString()} — $${LOAN.owed.toLocaleString()} still owed`);
  persistEco();
  sfx.cash();
  return pay;
}

// ---- Phase 30: RENTAL PROPERTIES. A second property ladder beside
// the homes above (apartment/loft are places YOU live; these are
// places OTHER people live, and they pay you for it). Three units,
// let through Sable Lets — Ana Ruiz manages them: she collects the
// rent on the same guarded morning tick as the businesses, rolls
// each unit's tenant luck for the day, and reports by phone
// message. There is deliberately NO management mini-game: no
// tenant picking, no rent setting, no eviction button — messages
// and money only, and the Bank shows exactly what the tick pays
// (rentDailyNet is the single source for both, the Phase 16 rule).
//
// Tenant events (one roll per owned unit per settled day, skipped
// entirely while a repair bill is due — the bill IS that unit's
// story until it's settled):
//   · ~10% REPAIR — a bill of $60–$180. Paid from cash on hand when
//     cash covers it; if it doesn't, the bill waits as DUE (shown
//     in the Bank, payable at the property's door) and that unit's
//     rent PAUSES until it's paid. Cash never goes below $0.
//   · ~12% LATE RENT — half the rent lands, with Ana's apology.
//   · ~10% GOOD TENANT — full rent, and the district warms to you
//     a touch (+2 zone reputation, the Phase 8 scale).
//   · otherwise the rent lands in full, quietly.
// Selling back (door hold-E, or the Bank's two-step confirm) pays
// 80% of the purchase price; a due bill is settled out of the
// proceeds first. Rent stops the day the unit sells. NG+ keeps
// rental properties exactly like businesses and homes (ngplus.ts
// never touches this state) — and a due bill survives with them,
// honestly: the debt is part of the property. ----
export interface RentalPropDef { id: string; name: string; price: number; rent: number; district: string; x: number; z: number; blurb: string; requiresBusiness?: boolean; }
export const RENTAL_PROPERTIES: RentalPropDef[] = [
  { id: "coral-flat", name: "Coral Shores Rental Flat", price: 18000, rent: 140, district: "Coral Shores", x: 65, z: 242.6, blurb: "A one-bed flat in the mid-rise row between the promenade and the z=264 road — Ana keeps it let to ferry crews." },
  { id: "north-townhouse", name: "Northgate Townhouse", price: 32000, rent: 260, district: "Northgate", x: -59, z: -236.7, blurb: "A narrow townhouse on the mansion-row approach — quiet street, harbour light, tenants who stay for years." },
  { id: "docks-warehouse", name: "Docks Warehouse Unit", price: 45000, rent: 390, district: "The Docks", x: 60, z: 103.2, requiresBusiness: true, blurb: "Unit 7 on the Docks strip — dry storage let to a chandlery. Sable Lets only leases it to business owners: commercial tenants want a landlord with a trading name." },
];
export const rentalDef = (id: string) => RENTAL_PROPERTIES.find((p) => p.id === id);
/** What selling a unit pays before any due bill is settled out of it. */
export const rentalSellPrice = (p: RentalPropDef) => Math.round(p.price * 0.8);

export const RENTALS = {
  owned: [] as string[],
  /** property id → outstanding repair bill ($) — rent pauses while > 0 */
  due: {} as Record<string, number>,
};
try {
  const raw = localStorage.getItem("harborfall-rentals");
  if (raw) {
    const r = JSON.parse(raw) as Partial<typeof RENTALS>;
    if (Array.isArray(r.owned)) RENTALS.owned = r.owned.filter((id) => typeof id === "string" && rentalDef(id));
    if (r.due && typeof r.due === "object") {
      for (const [id, amt] of Object.entries(r.due)) {
        const n = Math.floor(Number(amt));
        if (rentalDef(id) && n > 0) RENTALS.due[id] = n;
      }
    }
  }
} catch { /* one bad key never blocks the rest — fresh portfolio */ }
export function persistRent() {
  try { localStorage.setItem("harborfall-rentals", JSON.stringify(RENTALS)); } catch { /* ignore */ }
}

/** One unit's rent as the tick will actually pay it today: full
 * rent, or 0 while a repair bill is due (paused). The Bank's
 * per-unit line and rentDailyNet both read this — shown = paid. */
export const rentFor = (p: RentalPropDef): number => (RENTALS.owned.includes(p.id) && !(RENTALS.due[p.id] > 0) ? p.rent : 0);
/** THE daily rent figure — the tick pays exactly this (before the
 * day's tenant-event rolls adjust individual units) and the Bank
 * displays exactly this. Single source, the Phase 16 contract. */
export const rentDailyNet = (): number => RENTAL_PROPERTIES.reduce((a, p) => a + rentFor(p), 0);

export function buyRentalProperty(id: string): boolean {
  const p = rentalDef(id);
  if (!p || RENTALS.owned.includes(id)) return false;
  // Phase 31 audit — the warehouse gate, stated once, plainly: it
  // reads CURRENT business ownership at PURCHASE time only (a
  // lease-signing condition — Sable Lets wants a landlord with a
  // trading name when the lease is signed). It is NOT a continuing
  // covenant: rentFor/settleRentDaily never re-check it, so the
  // unit keeps paying for as long as it's owned. (Businesses can't
  // be sold in Port Sable, so ownership can't shrink after the fact
  // anyway — but the rule stands even if that ever changes.)
  if (p.requiresBusiness && ECO.owned.length === 0) {
    toast(`Sable Lets won't lease the ${p.name} to a first-time landlord — own any business first.`);
    sfx.dryFire(); return false;
  }
  if (G.cash < p.price) { toast(`${p.name} costs $${p.price.toLocaleString()} — not enough cash.`); sfx.dryFire(); return false; }
  G.cash -= p.price;
  RENTALS.owned.push(id);
  persistRent();
  pushPhoneMsg("SableBank", `🏠 -$${p.price.toLocaleString()} — ${p.name} purchased. Sable Lets manages it from here; rent lands every game-morning.`);
  pushPhoneMsg("Sable Lets — Ana Ruiz", `Ana Ruiz at Sable Lets — welcome aboard, landlord. I've placed a tenant in the ${p.name}; $${p.rent} lands each morning with your business income. If a repair bill ever lands bigger than the cash you're carrying, it waits as DUE in your bank app and that unit's rent pauses until it's paid at the door. I only ever write when something happens — quiet days are good days.`);
  toast(`🏠 You own the ${p.name} — $${p.rent}/day rent via Sable Lets`);
  sfx.cash();
  return true;
}

/** Sell a unit back at 80% of purchase (any due repair bill is
 * settled out of the proceeds first — the buyer inherits a clean
 * unit, you inherit the difference). Rent stops the same day:
 * the unit leaves RENTALS.owned before the next tick can see it. */
export function sellRentalProperty(id: string): boolean {
  const p = rentalDef(id);
  if (!p || !RENTALS.owned.includes(id)) return false;
  const due = RENTALS.due[id] ?? 0;
  const proceeds = Math.max(0, rentalSellPrice(p) - due);
  RENTALS.owned = RENTALS.owned.filter((x) => x !== id);
  delete RENTALS.due[id];
  persistRent();
  G.cash += proceeds; G.lifetimeEarned += proceeds;
  pushPhoneMsg("Sable Lets — Ana Ruiz", due > 0
    ? `${p.name} sold. $${rentalSellPrice(p).toLocaleString()} at the 80% rate, less the $${due.toLocaleString()} repair bill that was outstanding — $${proceeds.toLocaleString()} landed in your account. The tenant keeps the keys until their month runs out; that's the new owner's affair now.`
    : `${p.name} sold at the 80% rate — $${proceeds.toLocaleString()} in your account. The tenant keeps the keys until their month runs out; that's the new owner's affair now.`);
  toast(`🏠 Sold the ${p.name} — +$${proceeds.toLocaleString()}`);
  sfx.cash();
  return true;
}

/** Pay a due repair bill at the property's door. Full amount only —
 * a part-paid roof still leaks, and Ana's contractors don't start
 * until they're whole. */
export function payDueBill(id: string): boolean {
  const p = rentalDef(id);
  const due = RENTALS.due[id] ?? 0;
  if (!p || due <= 0) return false;
  if (G.cash < due) { toast(`The ${p.name} repair bill is $${due.toLocaleString()} — you have $${Math.floor(G.cash).toLocaleString()}.`); sfx.dryFire(); return false; }
  G.cash -= due;
  delete RENTALS.due[id];
  persistRent();
  pushPhoneMsg("Sable Lets — Ana Ruiz", `Received — $${due.toLocaleString()} settles the ${p.name} repair bill. The contractors are booked and the rent resumes tomorrow morning. Thank you for not making me chase it.`);
  toast(`🧾 ${p.name} repair bill paid — rent resumes tomorrow`);
  sfx.cash();
  return true;
}

const ANA = "Sable Lets — Ana Ruiz";
/** The rent half of the morning tick — called by advanceDay inside
 * the same day-serial guard as the business income, so rent can
 * never double-pay either. Rolls each let unit's tenant event,
 * lands the money, and writes Ana's messages. */
export function settleRentDaily() {
  let paid = 0;
  let changed = false;
  for (const p of RENTAL_PROPERTIES) {
    if (!RENTALS.owned.includes(p.id)) continue;
    if ((RENTALS.due[p.id] ?? 0) > 0) continue; // paused — the bill is the story
    const roll = Math.random();
    if (roll < 0.10) {
      // REPAIR — $60–$180. Cash covers it → auto-paid, rent lands in
      // full (the bill is a cost of the day, not a rent deduction).
      // Cash short → the bill goes DUE and this unit pays nothing
      // until it's settled at the door.
      const bill = 60 + Math.floor(Math.random() * 121);
      if (G.cash >= bill) {
        G.cash -= bill;
        pushPhoneMsg(ANA, `Repair at the ${p.name} — $${bill.toLocaleString()}, paid from your account this morning (Ana at Sable Lets — I keep a plumber who answers before the second ring). Rent's unaffected.`);
        paid += p.rent;
      } else {
        RENTALS.due[p.id] = bill; changed = true;
        pushPhoneMsg(ANA, `Repair at the ${p.name} — the bill is $${bill.toLocaleString()} and your cash on hand doesn't cover it, so I've marked it DUE: it's in your SableBank app, and this unit's rent pauses until it's paid at the door. No interest, no drama — just don't leave it forever. — Ana`);
      }
    } else if (roll < 0.22) {
      // LATE RENT — half lands.
      const half = Math.floor(p.rent / 2);
      paid += half;
      pushPhoneMsg(ANA, `The ${p.name} tenant paid late and short — $${half.toLocaleString()} of the $${p.rent.toLocaleString()} landed. The rest is promised Friday; I believe them about as far as I can throw their sofa. — Ana`);
    } else if (roll < 0.32) {
      // GOOD TENANT — full rent + a touch of district reputation.
      paid += p.rent;
      G.zoneRep[p.district] = Math.min(100, (G.zoneRep[p.district] ?? 0) + 2);
      persistZoneRep();
      pushPhoneMsg(ANA, `A note from the ${p.name}: rent on time, hallway swept, a plant left by your door. The street's warming to you, landlord. — Ana`);
    } else {
      paid += p.rent; // a quiet day — the aggregate message covers it
    }
  }
  if (changed) persistRent();
  if (paid > 0) {
    G.cash += paid; G.lifetimeEarned += paid;
    pushPhoneMsg("SableBank", `🏠 Daily rent +$${paid.toLocaleString()} — Sable Lets collected across your properties. Balance: $${G.cash.toLocaleString()}.`);
  }
}

/** The one daily tick: pay business income once per game day. */
export function advanceDay() {
  // Phase 23: the day being SETTLED is the serial that just ended —
  // its night (the club's Fri/Sat door takings) belongs to it, so
  // capture it before the increment and settle under its number.
  const settledSerial = ECO.daySerial;
  ECO.daySerial += 1;
  if (ECO.lastPaidSerial < ECO.daySerial) {
    ECO.lastPaidSerial = ECO.daySerial;
    const total = dailyIncomeTotal(settledSerial);
    if (total > 0) {
      G.cash += total; G.lifetimeEarned += total;
      pushPhoneMsg("SableBank", `🌅 Daily business income +$${total} — your Port Sable businesses paid out. Balance: $${G.cash.toLocaleString()}.`);
      toast(`New day — businesses paid +$${total}`);
    } else {
      toast("A new day breaks over Port Sable");
    }
    // Phase 30: rent settles in the same guarded tick, on the same
    // principle — income (business + rent) lands before the loan
    // below takes its cut. Tenant events roll here, once per day.
    settleRentDaily();
    // Phase 41: today's business events roll for the day that has
    // just STARTED (the new current serial — the day the Bank app
    // displays, whose figure settles at tomorrow's tick under this
    // same serial). Inside the guard, so exactly once per day.
    rollBizEvents(ECO.daySerial);
    // Phase 47: today's DAY EVENT rolls in the same guard, on the
    // same exactly-once terms (game/dayevents.ts) — a regatta day
    // or a market day for the day that has just started.
    rollDayEvents(ECO.daySerial);
    // Phase 48: the exposé series prints its next edition in the
    // same guard (a no-op unless crown3's EXPOSE branch armed it).
    crownDayTick(ECO.daySerial);
    // Phase 19: the loan settles in the same tick, AFTER the
    // morning income lands (so a good day can cover the payment):
    // interest first (capped at 2× principal), then a 10% auto-repay
    // from cash on hand — never below $0, a shortfall stays owed.
    if (LOAN.owed > 0) {
      const cap = LOAN.principal * 2;
      if (LOAN.owed < cap) LOAN.owed = Math.min(cap, LOAN.owed + Math.round(LOAN.owed * 0.08));
      // Phase 20 audit fix: 10% of a $1–4 balance rounds to $0 (and
      // 8% interest rounds to $0 too), so a nearly-clear loan could
      // NEVER settle by auto-repay — it sat at a few dollars forever
      // and the one-loan gate blocked every future loan. A balance
      // whose 10% rounds to nothing is settled outright from cash
      // on hand instead (still never below $0; cash $0 stays owed).
      let due = Math.round(LOAN.owed * 0.1);
      if (due <= 0) due = LOAN.owed;
      const pay = Math.min(G.cash, due);
      if (pay > 0) { G.cash -= pay; LOAN.owed -= pay; }
      if (LOAN.owed <= 0) {
        LOAN.owed = 0; LOAN.principal = 0;
        pushPhoneMsg("SableBank", "✅ Loan repaid in full by this morning's auto-repayment — your account's clean.");
        toast("✅ SableBank loan cleared by auto-repayment");
      }
    }
  }
  persistEco();
}

/** Phase 31 audit — the sleep/wrap double-tick guard. sleepToMorning
 * settles the morning itself (advanceDay) and THEN lands dayTime at
 * 0.055. From any evening dayTime (> 0.555 — the normal sleep
 * window) that backward jump is indistinguishable from the natural
 * 06:00 wrap to Phase7's frame detector, which fired advanceDay a
 * SECOND time: two day serials, businesses + rent paid twice, loan
 * interest + auto-repay twice, for one sleep. The serial guard
 * inside advanceDay cannot catch it — the second call mints a
 * fresh serial, which is by definition unpaid. So sleep stamps the
 * serial it settled here; Phase7's wrap branch skips its tick when
 * the stamp matches, and consumes the stamp at that same check (a
 * stamp is valid for exactly one wrap check — the first frame
 * after the sleep is the only frame whose prevDay still holds the
 * pre-sleep dayTime). */
export const SLEEP_TICK = { serial: -1 };

/** Sleep at an owned property: fade, morning, full heal, daily tick. */
export function sleepToMorning(where: string) {
  if (G.wanted > 0) { toast("You can't sleep with the harbour patrol looking for you."); return; }
  G.fadeAt = nowS();
  advanceDay(); // sleeping IS the morning tick (same guarded serial)
  SLEEP_TICK.serial = ECO.daySerial; // Phase 31: stamp the settled serial (see above)
  G.dayTime = 0.055; // ≈ 07:20
  G.health = 100; G.stamina = 100;
  sfx.door();
  toast(`You slept at ${where} — morning, full health, businesses settled.`);
  pushPhoneMsg("SableBank", `☀️ You woke at ${where}. A new day in Port Sable.`);
}

/** Respawn home preference — latest purchase wins (Phase 14 adds the loft). */
export type HomeKind = "villa" | "apartment" | "loft";
export function homePref(): HomeKind {
  try {
    const h = localStorage.getItem("harborfall-home");
    return h === "apartment" || h === "loft" ? h : "villa";
  } catch { return "villa"; }
}
export function setHomePref(h: HomeKind) {
  try { localStorage.setItem("harborfall-home", h); } catch { /* ignore */ }
}
