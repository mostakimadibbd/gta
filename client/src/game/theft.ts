// Harborfall — theft system helpers (Phase 4): loot tables, car break-ins,
// pickpocket resolution and pawn sales. All crimes flow through the shared
// witness/LOS pipeline in store.ts (addCrime) — no parallel wanted logic.
import { G, addCrime, toast, persistInventory, stashTotal, type StashItem } from "./store";
import { sfx } from "./audio";
import { pushPhoneMsg } from "./phone";

export const LOOT_ITEMS: { type: string; name: string; value: number }[] = [
  { type: "phone", name: "Cracked smartphone", value: 45 },
  { type: "phone", name: "Flagship phone", value: 120 },
  { type: "watch", name: "Steel watch", value: 85 },
  { type: "watch", name: "Gold-tone watch", value: 160 },
  { type: "wallet", name: "Leather wallet", value: 35 },
  { type: "jewellery", name: "Silver chain", value: 95 },
  { type: "jewellery", name: "Pearl earrings", value: 140 },
  { type: "electronics", name: "Wireless earbuds", value: 55 },
  { type: "electronics", name: "Tablet", value: 130 },
];
export function rollLootItem(): StashItem {
  const it = LOOT_ITEMS[Math.floor(Math.random() * LOOT_ITEMS.length)];
  return { ...it, value: Math.round(it.value * (0.8 + Math.random() * 0.5)) };
}
export function giveItem(item: StashItem) {
  G.inventory.push(item); persistInventory();
  toast(`Stashed: ${item.name} (fence $${item.value})`);
}
export function giveCash(amount: number, label: string) {
  G.cash += amount; G.lifetimeEarned += amount;
  toast(`${label} +$${amount}`);
  sfx.cash();
}

// ---- car alarms: carId → G.timeS when the alarm stops --------------------
export const carAlarms = new Map<number, number>();

/** Complete a car break-in on G.cars[index] (called after the hold). */
export function completeBreakIn(index: number) {
  const car = G.cars[index];
  if (!car || car.brokenWindow) return;
  car.brokenWindow = true;
  sfx.glass();
  G.eventQueue.push("shake");
  // loot roll (60%)
  if (Math.random() < 0.6) {
    if (Math.random() < 0.5) giveCash(10 + Math.floor(Math.random() * 55), "Grabbed cash from the car:");
    else giveItem(rollLootItem());
  } else toast("Smashed the window — nothing worth taking inside.");
  // alarm roll (30%): beeps/flashes + witness check through the pipeline
  if (Math.random() < 0.3) {
    carAlarms.set(index, G.timeS + 6);
    addCrime("theft");
  }
}

/** Is any ped/cop close enough to see a stealth crime? Crouch shrinks it. */
export function witnessedByBystander(x: number, z: number, radius: number): boolean {
  const r = G.crouched ? radius * 0.6 : radius;
  for (const p of G.peds) {
    if (!p.active || p.downUntil > G.timeS) continue;
    if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) return true;
  }
  for (const c of G.cops) {
    if (c.active && (c.x - x) ** 2 + (c.z - z) ** 2 < (r + 6) ** 2) return true;
  }
  return false;
}

/** Sell the whole stash at a fence point (pawn shop / Lina).
 * Phase 47: the optional bonus flag is the Coral market curios
 * stall's +20% — priced off the same stashTotal() the pawn counter
 * uses, applied at the moment of sale (the caller re-checks the
 * market is still live). The default keeps every existing fence
 * point's price and wording byte-identical. */
export function sellStash(where: string, bonusFrac = 0) {
  const base = stashTotal();
  if (base <= 0) { toast("Your stash is empty — nothing to sell."); return; }
  const total = Math.round(base * (1 + bonusFrac));
  const count = G.inventory.length;
  G.cash += total; G.lifetimeEarned += total;
  G.inventory = []; persistInventory();
  sfx.register();
  toast(`Sold ${count} item${count > 1 ? "s" : ""} at ${where} — +$${total}${bonusFrac > 0 ? ` (incl. +${Math.round(bonusFrac * 100)}% market bonus)` : ""}`);
  pushPhoneMsg("SableBank", `Pawn sale +$${total} — ${where}. New balance $${G.cash}.`);
}
