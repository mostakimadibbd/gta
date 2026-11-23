// Harborfall — Phase 7 economy deepening (work item 4): buyable
// businesses with a daily income tick, a second property (Coral Shores
// apartment) and sleeping. THE daily tick is the game-day rollover:
// advanceDay() runs when the day cycle wraps past 06:00 AND when the
// player sleeps (sleep jumps to morning, which is the same tick — one
// consistent rule, guarded by daySerial so it can never double-pay).
import { G, toast, nowS } from "./store";
import { pushPhoneMsg } from "./phone";
import { sfx } from "./audio";

export interface BusinessDef { id: string; name: string; price: number; income: number; x: number; z: number; blurb: string; }
export const BUSINESSES: BusinessDef[] = [
  { id: "wraps", name: "Harbour Wraps stall", price: 3500, income: 120, x: 31.5, z: 9.5, blurb: "The Market Row food stall — harbour lunches, every day." },
  { id: "wash", name: "Northgate Car Wash", price: 6000, income: 220, x: -44, z: -214, blurb: "Rich cars get dirty too. Yours stays free of charge in spirit." },
  { id: "club", name: "Club Solace — 50% share", price: 12000, income: 450, x: 54, z: 112, blurb: "Half the bar, half the door, all of the bass." },
];
export const APARTMENT = { name: "Coral Shores Apartment", price: 5000, x: 36, z: 213.2 };
/** Phase 14: the second purchasable property — a Northgate loft with
 * a harbour-view interior. Owning it changes nothing about business
 * income; it adds a sleep/respawn home in the north of the city. */
export const LOFT = { name: "Northgate Loft", price: 9000, x: -68, z: -195.2 };

export const ECO = {
  owned: [] as string[],
  ownsApartment: false,
  ownsLoft: false, // Phase 14
  daySerial: 0,
  lastPaidSerial: -1,
  // ---- Phase 9: business staffing (management-lite). A staffed
  // business earns +50% and pays a $35/day wage — both land in the
  // same guarded daily tick.
  staff: [] as string[],
};
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
  }
} catch { /* fresh economy */ }
export function persistEco() {
  try {
    localStorage.setItem("harborfall-eco", JSON.stringify(ECO));
    localStorage.setItem("harborfall-apartment", ECO.ownsApartment ? "1" : "0");
    localStorage.setItem("harborfall-loft", ECO.ownsLoft ? "1" : "0");
  } catch { /* ignore */ }
}
export const STAFF_WAGE = 35; // $/day per staffed business
export const STAFF_BONUS = 0.5; // +50% income while staffed
export const dailyIncomeTotal = () => BUSINESSES.filter((b) => ECO.owned.includes(b.id)).reduce((a, b) => {
  const staffed = ECO.staff.includes(b.id);
  return a + b.income + (staffed ? Math.round(b.income * STAFF_BONUS) : 0) - (staffed ? STAFF_WAGE : 0);
}, 0);

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
