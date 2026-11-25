// Harborfall — Phase 21: STAFF IN THE WORLD.
//
// The Phase 15 roster were names and numbers in the Bank app. Now
// every hired staffer also EXISTS: during their working hours they
// stand at their business's frontage in a distinct work colour, pace
// a short beat, carry a floating name + trait label when the player
// is near, and offer one greeting bark per day when approached.
// This grows the blueprint's employees line — it does NOT close it:
// there is still no rota simulation and no management play; shifts
// are fixed per person (below) and the Bank app remains the office.
//
// Shifts are per person and match their documented traits:
//   · Sana Iqbal works the NIGHT (20:00–06:00) — the same hours her
//     bonus doubles (game/economy.ts staffBonusNow), so the player
//     can watch the trait's owner work the trait's hours.
//   · Dev Okafor is the part-timer: a short day shift, 10:00–18:00.
//   · Tom Beck 07:00–19:00, Marta Reyes 08:00–20:00 (day shifts).
// A staffer despawns cleanly when their shift ends, when they are
// let go, or when their business leaves the portfolio (staffBy only
// ever names owned businesses — the world reads the same record).
import { G } from "./store";
import { ECO, BUSINESSES, type BusinessDef } from "./economy";

export interface StaffWorldDef {
  // (the roster name is the STAFF_WORLD record key, not a field)
  skin: string; hair: string; hairStyle: "flat" | "bun" | "crop" | "ponytail";
  build: "slim" | "average" | "broad"; female?: boolean;
  /** the distinct work colour worn on shift (top) */
  workTop: string; bottom: string;
  /** shift window in game hours; wraps past midnight when to < from */
  from: number; to: number;
  /** short label line under the name (the trait, compressed) */
  label: string;
  greet: string;
}

export const STAFF_WORLD: Record<string, StaffWorldDef> = {
  "Tom Beck": {
    skin: "#8a5a3b", hair: "#4a3826", hairStyle: "flat", build: "average",
    workTop: "#1f7a72", bottom: "#3a3f45", from: 7, to: 19,
    label: "Day shift · dependable",
    greet: "Boss. Counter's warm, till's honest — we're having a good day here.",
  },
  "Marta Reyes": {
    skin: "#a06844", hair: "#241a12", hairStyle: "bun", build: "average", female: true,
    workTop: "#c9922e", bottom: "#2c3e50", from: 8, to: 20,
    label: "Day shift · ex-hotel manager",
    greet: "Everything priced, labelled and accounted for. That's not luck, that's management.",
  },
  "Dev Okafor": {
    skin: "#5d4028", hair: "#14161c", hairStyle: "crop", build: "slim",
    workTop: "#3f7fae", bottom: "#31435c", from: 10, to: 18,
    label: "Part-time · 10:00–18:00",
    greet: "Hey! Part-time hours, full-time hustle. This place basically runs itself. (It doesn't.)",
  },
  "Sana Iqbal": {
    skin: "#7a4a2e", hair: "#1c1a18", hairStyle: "ponytail", build: "slim", female: true,
    workTop: "#b4622d", bottom: "#23272c", from: 20, to: 6,
    label: "Night shift · bonus ×2 after dark",
    greet: "Night shift's mine. The harbour pays better after dark — and so do we.",
  },
};

export const staffWorldDef = (name: string): StaffWorldDef | undefined => STAFF_WORLD[name];

/** Is this staffer on shift at the given game hour? (Night shifts
 * wrap past midnight: from=20, to=6 means 20,21,…,5.) */
export function staffOnShiftAt(name: string, hour: number): boolean {
  const d = STAFF_WORLD[name];
  if (!d) return false;
  return d.from <= d.to ? hour >= d.from && hour < d.to : hour >= d.from || hour < d.to;
}
export const gameHourNow = () => Math.floor((G.dayTime * 24 + 6) % 24); // same formula as Interactions.gameHour
export const staffOnShiftNow = (name: string) => staffOnShiftAt(name, gameHourNow());

export interface StaffPost { name: string; biz: BusinessDef; def: StaffWorldDef; }
/** Everyone who should be visible in the world right now: employed
 * (staffBy), at an owned business, and on shift at this hour. */
export function staffPostsNow(): StaffPost[] {
  const hour = gameHourNow();
  const out: StaffPost[] = [];
  for (const biz of BUSINESSES) {
    if (!ECO.owned.includes(biz.id)) continue;
    for (const name of ECO.staffBy[biz.id] ?? []) {
      const def = STAFF_WORLD[name];
      if (def && staffOnShiftAt(name, hour)) out.push({ name, biz, def });
    }
  }
  return out;
}
/** A stable signature of the on-shift set — StaffWorld rebuilds its
 * rigs only when this changes (hire/fire/shift edge/business sale). */
export const staffPostsSignature = () => staffPostsNow().map((p) => `${p.name}@${p.biz.id}`).join("|");
