// Harborfall — Phase 18: THE SABLE CUP (race championship).
//
// The 3 street races + the Bay Circuit boat race form a 4-round
// series. The flow is ARM-THEN-RACE: the Cup card in Phone → Jobs
// arms a round (J.cupArm); the player then starts that race at its
// ring the normal way, and the start prompt converts the arm into
// RaceState.cup. Finishing records the position against the existing
// ghost field; points 10/6/3/1 by position. All four rounds done →
// the series closes: ≥ 20 of 40 points crowns the champion ($2,500,
// a Harbour Wire headline, and the Vantara S voucher). A series that
// closes short of 20 can be reset from the card and run again.
// Rounds may be re-run while the series is open — the BEST position
// counts, so a bad round is never a dead save.
//
// Why Street Challenge event races do NOT count: they are seeded by
// Phase17's event scheduler directly into J.race (one checkpoint, one
// rival, winner-takes-the-pot stakes) and never pass through the
// start prompts where an arm converts — a different format with a
// different purse, not a series round. The `cup` flag can therefore
// only ever be set by startRace/startSpecialRace below.
import { G, toast } from "./store";
import { pushNews } from "./feed";
import { sfx } from "./audio";

export interface CupRound { id: string; name: string; where: string; best: number; /* 0 = not run */ }
export interface CupState {
  rounds: CupRound[];
  closed: boolean;
  champion: boolean;
  /** Vantara S discount voucher: earned with the crown, one use,
   * consumed by the dealer price helper below. */
  voucher: boolean;
  voucherUsed: boolean;
}

const ROUND_DEFS: Array<[string, string, string]> = [
  // Phase 19 audit: these ids MUST be the RaceDef ids the finish
  // blocks actually report (game/jobs.ts RACES + BAY_CIRCUIT). The
  // Phase 18 originals ("harbour-loop", "downtown-dash",
  // "airport-run", "bay-circuit") matched NO race in the game, so
  // an arm never converted at a start and recordCupResult never
  // found its round — the Cup could not be played at all. There is
  // also no "Airport Run" street race; the real third round is the
  // Northgate Loop.
  ["docks", "Docks Sprint", "Docks ring, by the cranes"],
  ["bay", "Bay Run", "Bridge + Coral Shores ring"],
  ["north", "Northgate Loop", "Northgate ring"],
  ["baycircuit", "Bay Circuit", "Marina — bring a boat"],
];
export const CUP_POINTS = [10, 6, 3, 1];
export const CUP_CHAMPION_POINTS = 20;

function freshCup(): CupState {
  return {
    rounds: ROUND_DEFS.map(([id, name, where]) => ({ id, name, where, best: 0 })),
    closed: false, champion: false, voucher: false, voucherUsed: false,
  };
}

export let cup: CupState = freshCup();

export function loadCup() {
  try {
    const raw = localStorage.getItem("harborfall-cup");
    if (raw) {
      const saved = JSON.parse(raw) as CupState;
      if (saved && Array.isArray(saved.rounds) && saved.rounds.length === ROUND_DEFS.length) {
        // Phase 19 migration: a Phase 18 save's rounds carry the old
        // unmatched ids (and could never have recorded a result —
        // recordCupResult found no round to write to), so rebuilding
        // the rounds fresh loses nothing real. The voucher flags ride
        // along untouched for symmetry with resetCup.
        if (saved.rounds.every((r, i) => r && r.id === ROUND_DEFS[i][0])) { cup = saved; return; }
        cup = freshCup();
        cup.voucher = !!saved.voucher; cup.voucherUsed = !!saved.voucherUsed;
        cup.champion = !!saved.champion; cup.closed = !!saved.closed;
        return;
      }
    }
  } catch { /* per-key guard (Phase 15): a bad key never blocks boot */ }
  cup = freshCup();
}
export function persistCup() { try { localStorage.setItem("harborfall-cup", JSON.stringify(cup)); } catch { /* quota */ } }

export function cupPointsTotal(): number {
  return cup.rounds.reduce((sum, r) => sum + (r.best > 0 ? CUP_POINTS[r.best - 1] : 0), 0);
}
export function cupRoundsDone(): number { return cup.rounds.filter((r) => r.best > 0).length; }

/** Record a Cup finish. Called by the race finish blocks when the
 * race carried the cup flag. Best position counts; re-runs of an
 * already-counted round can only improve it. */
export function recordCupResult(raceId: string, place: number) {
  const round = cup.rounds.find((r) => r.id === raceId);
  if (!round || cup.closed) return;
  const improved = round.best === 0 || place < round.best;
  if (improved) round.best = place;
  const pts = CUP_POINTS[place - 1] ?? 0;
  if (cupRoundsDone() === cup.rounds.length) {
    cup.closed = true;
    const total = cupPointsTotal();
    if (total >= CUP_CHAMPION_POINTS) {
      cup.champion = true;
      cup.voucher = true;
      G.cash += 2500; G.lifetimeEarned += 2500;
      pushNews("SABLE CUP: A CHAMPION CROWNED", `Four rounds, ${total} points — Port Sable's street crown has a new name, and the paddock is already arguing about next season. The champion's purse: $2,500, and a gold voucher at Sable Motors.`);
      toast(`🏆 SABLE CUP CHAMPION — ${total} pts! +$2,500 and a gold Vantara S voucher (20% off, one use)`);
      sfx.complete();
    } else {
      pushNews("SABLE CUP: SERIES CLOSES", `The inaugural Sable Cup closes at ${total} points for the home favourite — short of the ${CUP_CHAMPION_POINTS} the crown demands. The card offers a fresh series whenever they're ready.`);
      toast(`Sable Cup closed at ${total}/${CUP_CHAMPION_POINTS} pts — short of the crown. Reset the series from the Cup card to run it again.`);
      sfx.fail();
    }
  } else if (improved) {
    toast(`🏁 Sable Cup: ${round.name} — P${place} (+${pts} pts) · ${cupRoundsDone()}/4 rounds · ${cupPointsTotal()} pts`);
    sfx.cash();
  }
  persistCup();
}

/** Start a fresh series (only offered once a series has closed
 * without the crown, or after the crown — a champion may defend). */
export function resetCup() {
  const keepVoucher = cup.voucher && !cup.voucherUsed;
  cup = freshCup();
  cup.voucher = keepVoucher; // an unspent voucher survives a reset
  persistCup();
}

/** The dealer price of the Vantara S with the voucher applied.
 * Both dealer buy paths (forecourt + showroom) route through here so
 * the 20% can never be double-applied or skipped. */
export function dealerPrice(kind: string, base: number): number {
  if (kind === "wedge" && cup.voucher && !cup.voucherUsed) return Math.round(base * 0.8);
  return base;
}
/** Consume the voucher after a successful Vantara S purchase. */
export function consumeVoucher(kind: string) {
  if (kind === "wedge" && cup.voucher && !cup.voucherUsed) {
    cup.voucherUsed = true;
    persistCup();
    toast("🎟️ Gold voucher redeemed — 20% off the Vantara S. One use, spent well.");
  }
}

// Boot load (module level, like jobStats in jobs.ts): main.tsx
// imports game/saveslots first, so the per-slot storage patch is in
// place before any game module evaluates and this key lands in the
// active slot.
loadCup();
