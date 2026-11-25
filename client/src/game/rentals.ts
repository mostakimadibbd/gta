// Harborfall — Phase 19: SABLE MARINA RENTALS (the dock side of the
// fourth business, game/economy.ts). Owning the marina unlocks this
// dock point by the Bay Circuit ring: a $75 day-pass rents a skiff,
// spawned on the water by the pier. The pass ends three ways —
// RETURN it at the dock (the crew collects the boat), WRECK it (the
// rental ends; the wreck stays in the world like any other), or let
// the DAY ROLL OVER (the pass expires: the boat is collected at the
// next morning tick unless you're still driving it, in which case
// it's collected the moment you step out). Rental state is
// session-only on purpose — a pass is a day thing, and the boat is
// a dynamic car entry, never an owned/fleet/stored car.
import { depenetrateCar } from "./depenetrate"; // Phase 25: spawn guard
import { G, toast, clearLastCar, LASTCAR } from "./store";
import { pushPhoneMsg } from "./phone";
import { sfx } from "./audio";

export const RENTAL_DOCK = { x: 2, z: 120 }; // on the pier deck itself, by the Bay Circuit ring
export const RENTAL_FEE = 75;
export const RENTAL_SPAWN = { x: -4, z: 138, heading: Math.PI };

export const RENT = {
  active: false,
  carIndex: -1,
  /** day-pass expired while the player was still out in the boat */
  expired: false,
};

export function rentalCar() {
  return RENT.active && RENT.carIndex >= 0 ? G.cars[RENT.carIndex] ?? null : null;
}

export function rentBoat(): boolean {
  if (RENT.active) { toast("A rental skiff is already out — return her to the dock first."); return false; }
  if (G.cash < RENTAL_FEE) { toast(`A day-pass is $${RENTAL_FEE} — you're short.`); sfx.dryFire(); return false; }
  G.cash -= RENTAL_FEE;
  G.cars.push({
    id: 1900 + G.cars.length, x: RENTAL_SPAWN.x, z: RENTAL_SPAWN.z, heading: RENTAL_SPAWN.heading, color: "#e8ecef",
    model: "Rental Skiff 180", kind: "skiff", owned: false,
    state: { x: RENTAL_SPAWN.x, z: RENTAL_SPAWN.z, heading: RENTAL_SPAWN.heading, speed: 0 },
    stolen: false, damage: 0, fuel: 90,
    brokenWindow: false, pitch: 0, roll: 0, steerVis: 0, storedAway: false,
    flatTyre: false, tuneLvl: 0, brakeLvl: 0, driftTyres: false, pitchVel: 0, rollVel: 0,
  });
  depenetrateCar(G.cars[G.cars.length - 1]); // Phase 25 guard (skiffs are exempt — hulls stay in the water)
  RENT.carIndex = G.cars.length - 1;
  RENT.active = true; RENT.expired = false;
  pushPhoneMsg("Sable Marina Rentals", `⛵ Day-pass -$${RENTAL_FEE} — your skiff's in the water by the pier, white hull. Bring her back to the dock by morning, or the pass expires and we collect her.`);
  toast("⛵ Rental skiff launched — she's in the water by the pier (white hull)");
  sfx.cash();
  return true;
}

/** End the rental. "return"/"expired" collect the boat (it leaves
 * the world); "wreck" just closes the paperwork — the wreck stays. */
export function endRental(reason: "return" | "wreck" | "expired") {
  if (!RENT.active) return;
  const idx = RENT.carIndex;
  const car = idx >= 0 ? G.cars[idx] : null;
  if (reason !== "wreck" && car && !car.storedAway) {
    car.storedAway = true;
    car.state = { x: 0, z: -500, heading: 0, speed: 0 };
  }
  // a rental must never ride home as the session's "last car"
  if (LASTCAR.carIndex === idx) clearLastCar();
  RENT.active = false; RENT.carIndex = -1; RENT.expired = false;
  if (reason === "return") { toast("⛵ Rental returned — the marina crew takes her from here."); sfx.door(); }
  else if (reason === "wreck") { toast("💥 The rental skiff is wrecked — the marina writes her off (that's what the deposit's for)."); pushPhoneMsg("Sable Marina Rentals", "We saw the smoke from the dock. The skiff's a write-off — no hard feelings, no refund either."); }
  else { toast("⛵ Day-pass expired — the marina collected the rental skiff."); pushPhoneMsg("Sable Marina Rentals", "Your day-pass ran out and the crew collected the skiff. Rent another any time from the dock."); }
}
