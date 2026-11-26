// Harborfall — Phase 48: THE HARBOUR CROWN's world consequences.
//
// Two pieces of the endgame chain live outside the mission engine:
//
//   · THE EXPOSÉ SERIES — crown3's EXPOSE branch prints across
//     THREE editions: edition 1 fires in the completion branch
//     (GameSystems, beside every other arc's fallout), and this
//     module carries editions 2 and 3 on the next two morning
//     ticks. The series state persists under its own key
//     (harborfall-crownseries), stamped with the day serial it
//     last fired on, and crownDayTick is called from advanceDay
//     beside rollBizEvents/rollDayEvents — inside the same serial
//     guard, so a day can never print twice and a slept-through
//     morning still prints exactly one edition (the Phase 31/41
//     exactly-once lesson). NG+ does not rewind ECO.daySerial, so
//     an armed series simply finishes printing in the new run's
//     first mornings — the papers were already at the printers.
//
//   · THE SOVEREIGN — crown4's reward car, delivered through the
//     existing garage machinery: it joins G.storedCars (the
//     dealer-purchase path, persisted by persistStoredCars, taken
//     out at either garage with G). If the garage list is full it
//     is instead filed as the garage-saved car at the villa drive
//     (persistSavedCar — the boot restore rebuilds it as an owned
//     car). Delivery is recorded in M.crownCarDelivered and the
//     existence checks below run first, so neither a replay, a
//     reload nor a second NG+ completion can mint a duplicate;
//     NG+ keeps cars (ngplus.ts never touches the garage keys),
//     so the Sovereign survives the reset like every owned car —
//     and if a new run earns it again while the first still
//     exists, the checks find it and no second car is minted.
import { G, persistStoredCars, loadSavedCar, persistSavedCar } from "./store";
import { M, persist } from "./missionState";
import { CAR_MODELS, GARAGE_ZONES } from "../world";
import { pushPhoneMsg } from "./phone";
import { pushNews } from "./feed";

export const SOVEREIGN_KIND = "sovereign";
export const SOVEREIGN_COLOR = "#14524f"; // deep harbour teal; the gold is in the bodywork (CarBody)

/** The three editions of the exposé (Wire headlines). Edition 1
 * fires at completion; armExposeSeries() schedules 2 and 3. */
export const EXPOSE_EDITIONS: { title: string; body: string }[] = [
  {
    title: "Harbour Wire: MERIDIAN UNMASKED — THE MANIFEST, IN FULL",
    body: "The Wire prints the cold-storage manifest Meridian Holdings called 'frozen fish': a year of harbour cargo that was never fish, moved under a dead man's name. The mansion-row auction dissolved in shouting. By midnight Meridian's offices stood empty, its phones ringing into the dark.",
  },
  {
    title: "Harbour Wire: MERIDIAN, DAY TWO — THE BAGMAN'S ROUTE",
    body: "Edition two maps the money's road: Breakwater Point at dawn, a chandlery handoff, a meeting under the Eastmere Light — every step photographed, every face named. Two Meridian directors resigned 'for family reasons' before breakfast. The harbour has heard that phrase before; it is learning to laugh at it.",
  },
  {
    title: "Harbour Wire: MERIDIAN, DAY THREE — THE HARBOUR ANSWERS",
    body: "The final edition: warrants served at three addresses, the observatory archive sealing the original deeds beyond any injunction, and the mooring rights returned to the harbour trust. Port Sable's verdict, in letters a foot high on the Wire's own wall: THE HARBOUR IS NOT FOR SALE.",
  },
];

const SERIES = { left: 0, lastSerial: -1 };
try {
  const raw = localStorage.getItem("harborfall-crownseries");
  if (raw) {
    const s = JSON.parse(raw) as Partial<typeof SERIES>;
    if (typeof s.left === "number") SERIES.left = Math.max(0, Math.min(2, Math.floor(s.left)));
    if (typeof s.lastSerial === "number") SERIES.lastSerial = Math.floor(s.lastSerial);
  }
} catch { /* per-key guard (Phase 15): a bad key never blocks boot */ }
function persistSeries() {
  try { localStorage.setItem("harborfall-crownseries", JSON.stringify(SERIES)); } catch { /* ignore */ }
}

/** Arm editions 2 and 3 (called once, from crown3's completion
 * branch, on the EXPOSE path — edition 1 fires there directly). */
export function armExposeSeries() {
  SERIES.left = 2;
  persistSeries();
}

/** The morning hook — called from advanceDay inside the serial
 * guard with the serial of the day that has just started. Fires
 * at most one edition per serial, in order, until the series is
 * spent. */
export function crownDayTick(serial: number) {
  if (SERIES.left <= 0 || serial <= SERIES.lastSerial) return;
  SERIES.lastSerial = serial;
  const idx = EXPOSE_EDITIONS.length - SERIES.left; // left 2 → edition 2 (idx 1), left 1 → edition 3 (idx 2)
  SERIES.left -= 1;
  persistSeries();
  const ed = EXPOSE_EDITIONS[idx];
  if (ed) {
    pushNews(ed.title, ed.body);
    pushPhoneMsg("Ines Marlo", idx === 1
      ? "Edition two is on the stands, Rayan — the bagman's route, in print. One more tomorrow: the harbour answers."
      : "Final edition, Rayan. 'THE HARBOUR IS NOT FOR SALE', a foot high on our own wall. It's done — and it was worth every mile.");
  }
}

/** Does a Vantara Sovereign already exist anywhere the player
 * keeps cars? (garage list, garage-saved snapshot, or the world
 * fleet as an owned car). */
export function sovereignExists(): boolean {
  if (G.storedCars.some((s) => s.kind === SOVEREIGN_KIND)) return true;
  const saved = loadSavedCar();
  if (saved && saved.kind === SOVEREIGN_KIND) return true;
  return G.cars.some((c) => c.kind === SOVEREIGN_KIND && c.owned);
}

/** Phase 49 marathon fix — boot reconciliation for the garage-full
 * delivery path. That path files the Sovereign as the garage-car
 * SNAPSHOT, and the snapshot is a living slot: the villa/apartment
 * drive auto-save (GameSystems) overwrites it with whatever car
 * the player parks there. If that happened in the delivery session,
 * before any reload restored the Sovereign into the world, the
 * snapshot stopped naming the car while crownCarDelivered stayed
 * set — the finale's reward existed nowhere and could never be
 * re-earned. So: the chain is complete and delivery was recorded,
 * yet no Sovereign exists anywhere the player keeps cars — the
 * filing was overwritten, and we file it again. Called once from
 * App's mount, after every module's load has restored the world
 * (a surviving snapshot restores as an owned car in G.cars, so
 * sovereignExists() sees it and this stays silent). */
export function reconcileSovereign() {
  if (!M.crownDone || !M.crownCarDelivered) return;
  if (sovereignExists()) return;
  M.crownCarDelivered = false; // let deliverSovereign run its path again
  deliverSovereign();
}

/** Deliver the finale's reward car through the garage machinery.
 * Returns true when a car was actually delivered (false when one
 * already exists — the delivery is recorded either way). */
export function deliverSovereign(): boolean {
  if (M.crownCarDelivered || sovereignExists()) {
    if (!M.crownCarDelivered) { M.crownCarDelivered = true; persist(); }
    return false;
  }
  M.crownCarDelivered = true;
  persist();
  const name = CAR_MODELS[SOVEREIGN_KIND as keyof typeof CAR_MODELS].name;
  if (G.storedCars.length < 6) {
    G.storedCars.push({ kind: SOVEREIGN_KIND, color: SOVEREIGN_COLOR, name, damage: 0, fuel: 90, brokenWindow: false });
    persistStoredCars();
    pushPhoneMsg("Sable Motors", `👑 ${name} delivered to your garage — one of one, teal and gold, the Meridian stake's own showpiece. Press G at a garage to take it out. It is, the auction house notes, 'the harbour's crown, with wheels.'`);
  } else {
    // garage list full: the car waits on the villa drive as the
    // garage-saved car (the boot restore rebuilds it as owned)
    const villa = GARAGE_ZONES[0];
    persistSavedCar({ kind: SOVEREIGN_KIND, color: SOVEREIGN_COLOR, x: villa.x, z: villa.z, heading: 0 });
    pushPhoneMsg("Sable Motors", `👑 ${name} delivered — your garage list is full (6), so the one-of-one Sovereign waits on the villa drive, filed as your garage car. Press G at a garage to take it out.`);
  }
  return true;
}
