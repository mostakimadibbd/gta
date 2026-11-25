// Harborfall — Phase 7 economy deepening (work item 4): buyable
// businesses with a daily income tick, a second property (Coral Shores
// apartment) and sleeping. THE daily tick is the game-day rollover:
// advanceDay() runs when the day cycle wraps past 06:00 AND when the
// player sleeps (sleep jumps to morning, which is the same tick — one
// consistent rule, guarded by daySerial so it can never double-pay).
import { G, toast, bark, nowS } from "./store";
import { pushPhoneMsg } from "./phone";
import { sfx } from "./audio";

export interface BusinessDef { id: string; name: string; price: number; income: number; x: number; z: number; blurb: string; }
export const BUSINESSES: BusinessDef[] = [
  { id: "wraps", name: "Harbour Wraps stall", price: 3500, income: 120, x: 31.5, z: 9.5, blurb: "The Market Row food stall — harbour lunches, every day." },
  { id: "wash", name: "Northgate Car Wash", price: 6000, income: 220, x: -44, z: -214, blurb: "Rich cars get dirty too. Yours stays free of charge in spirit." },
  { id: "club", name: "Club Solace — 50% share", price: 12000, income: 450, x: 54, z: 112, blurb: "Half the bar, half the door, all of the bass." },
  // Phase 19: the fourth business — the marina office on the pier
  // road. Owning it also unlocks the rental dock (game/rentals.ts):
  // a $75 day-pass skiff from the dock point by the Bay Circuit ring.
  // Phase 21 balance: income 380 → 430 — at $15,000 it had the worst
  // base payback in the portfolio (39 days vs 27–29 for the others);
  // 430 brings it to ~35 days, still the slowest earner, priced for
  // the rental-dock unlock it carries.
  { id: "marina", name: "Sable Marina Rentals", price: 15000, income: 430, x: 14, z: 110, blurb: "Every boat in the bay, rented by the day — and the Bay Circuit starts at your dock." },
];
export const APARTMENT = { name: "Coral Shores Apartment", price: 5000, x: 36, z: 213.2 };
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
export function businessDailyNet(b: BusinessDef): number {
  const gross = Math.round(b.income * levelMult(bizLevel(b.id)));
  const crew = ECO.staffBy[b.id] ?? [];
  let net = gross;
  for (const name of crew) { const s = staffDef(name); if (s) net += staffDailyBonus(s, gross) - s.wage; }
  return net;
}
export const dailyIncomeTotal = () => BUSINESSES.filter((b) => ECO.owned.includes(b.id)).reduce((a, b) => a + businessDailyNet(b), 0);

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

/** The one daily tick: pay business income once per game day. */
export function advanceDay() {
  ECO.daySerial += 1;
  if (ECO.lastPaidSerial < ECO.daySerial) {
    ECO.lastPaidSerial = ECO.daySerial;
    const total = dailyIncomeTotal();
    if (total > 0) {
      G.cash += total; G.lifetimeEarned += total;
      pushPhoneMsg("SableBank", `🌅 Daily business income +$${total} — your Port Sable businesses paid out. Balance: $${G.cash.toLocaleString()}.`);
      toast(`New day — businesses paid +$${total}`);
    } else {
      toast("A new day breaks over Port Sable");
    }
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

/** Sleep at an owned property: fade, morning, full heal, daily tick. */
export function sleepToMorning(where: string) {
  if (G.wanted > 0) { toast("You can't sleep with the harbour patrol looking for you."); return; }
  G.fadeAt = nowS();
  advanceDay(); // sleeping IS the morning tick (same guarded serial)
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
