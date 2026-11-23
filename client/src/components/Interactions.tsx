// Harborfall — Phase 4 proximity interactions: pickpocketing, shop robbery
// (hold-E), pawn sales, garage zones and Lina's repair service. Runs AFTER
// Interiors in the frame, so door/mansion prompts keep priority: this layer
// only writes the HUD prompt when Interiors left it empty.
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { G, addCrime, toast, stashTotal, bark } from "../game/store";
import { GARAGE_ZONES, REGISTERS, PAWN_SHOP, INTERIORS } from "../world";
import { sfx } from "../game/audio";
import { giveCash, giveItem, rollLootItem, sellStash } from "../game/theft";

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export default function Interactions() {
  const myPrompt = useRef("");
  const eDownAt = useRef(-1);
  const robTarget = useRef("");

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "e" && !e.repeat) eDownAt.current = performance.now() / 1000;
      // R — repair at a garage while sitting in the car
      if (e.key.toLowerCase() === "r" && !e.repeat && G.driving && G.garageZone) {
        const car = G.cars[G.activeCarId];
        if (car && (car.damage > 1 || car.brokenWindow)) {
          const cost = Math.ceil(car.damage * 1.2) + (car.brokenWindow ? 25 : 0);
          if (G.cash >= cost) {
            G.cash -= cost; car.damage = 0; car.brokenWindow = false;
            toast(`Repaired at ${G.garageZone.label} — $${cost}`);
            sfx.fuel();
          } else toast(`Repair costs $${cost} — not enough cash.`);
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "e") { eDownAt.current = -1; if (G.hold?.label.startsWith("Robbing")) G.hold = null; }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  useFrame(() => {
    const t = G.timeS;
    const px = G.playerPos.x, pz = G.playerPos.z;

    // ---- garage zone tracking (drives the G key + repair, read by App) ----
    let zone: (typeof GARAGE_ZONES)[number] | null = null;
    for (const z of GARAGE_ZONES) {
      const zx = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId].state.x : px;
      const zz = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId].state.z : pz;
      if ((zx - z.x) ** 2 + (zz - z.z) ** 2 < z.r * z.r) { zone = z; break; }
    }
    if (zone && zone.id === "villa" && !G.ownsMansion) zone = null;
    G.garageZone = zone ? { id: zone.id, label: zone.label } : null;

    // ---- stealth eye (crouch indicator) ----
    if (G.crouched && !G.driving) {
      let seen = false;
      for (const p of G.peds) {
        if (!p.active || t < p.downUntil) continue;
        if ((p.x - px) ** 2 + (p.z - pz) ** 2 < 13 ** 2) { seen = true; break; }
      }
      G.stealthEye = seen ? "open" : "closed";
    } else G.stealthEye = "";

    // ---- prompt candidates (only when Interiors has none) ----
    let prompt = ""; let warn = false; let act: (() => void) | null = null;
    const interiorsBusy = G.promptText !== "" && G.promptText !== myPrompt.current;
    if (!G.status && !G.dialogueActive && !interiorsBusy) {
      if (G.driving) {
        // repair offer while parked in a garage zone
        const car = G.cars[G.activeCarId];
        if (zone && car && (car.damage > 1 || car.brokenWindow)) {
          const cost = Math.ceil(car.damage * 1.2) + (car.brokenWindow ? 25 : 0);
          prompt = `R — Repair at ${zone.label} ($${cost})`;
        }
        if (G.hold?.label.startsWith("Robbing")) G.hold = null;
      } else if (!G.interior) {
        const nearCar = G.cars.some((c) => (c.state.x - px) ** 2 + (c.state.z - pz) ** 2 <= 3.6 ** 2);
        // --- pickpocket: behind a pedestrian, nobody more important near ---
        let pickIdx = -1;
        if (!nearCar) {
          let bestD = 2.3 ** 2;
          G.peds.forEach((p, i) => {
            if (!p.active || t < p.downUntil || Math.abs(p.speed) > 2.6) return;
            const d = (p.x - px) ** 2 + (p.z - pz) ** 2;
            if (d >= bestD) return;
            const angToPlayer = Math.atan2(px - p.x, pz - p.z);
            if (Math.abs(wrapAngle(angToPlayer - p.heading)) < 2.1) return; // must be BEHIND them
            bestD = d; pickIdx = i;
          });
        }
        // --- shop registers (hold E) ---
        let reg: (typeof REGISTERS)[number] | null = null;
        for (const r of REGISTERS) if ((r.x - px) ** 2 + (r.z - pz) ** 2 < 2.1 ** 2) { reg = r; break; }
        const atPawn = (PAWN_SHOP.x - px) ** 2 + (PAWN_SHOP.z - pz) ** 2 < 2.4 ** 2;

        if (pickIdx >= 0) {
          const victim = G.peds[pickIdx];
          prompt = "E — Pickpocket";
          act = () => {
            // bystanders (excluding the victim) decide if it was seen
            let witnessed = false;
            const wr = G.crouched ? 13 * 0.6 : 13;
            G.peds.forEach((p, i) => { if (i !== pickIdx && p.active && t >= p.downUntil && (p.x - px) ** 2 + (p.z - pz) ** 2 < wr * wr) witnessed = true; });
            for (const c of G.cops) if (c.active && (c.x - px) ** 2 + (c.z - pz) ** 2 < (wr + 6) ** 2) witnessed = true;
            const success = Math.random() < 0.75 + (G.crouched ? 0.15 : 0);
            if (success && !witnessed) {
              if (Math.random() < 0.55) giveCash(8 + Math.floor(Math.random() * 53), "Pickpocketed:");
              else giveItem(rollLootItem());
            } else {
              sfx.shout();
              toast("Hey! Thief! Someone call the harbour patrol!");
              bark("Bystander", "Hey! Thief! Someone call the harbour patrol!");
              victim.fleeUntil = t + 3.5;
              addCrime("theft");
            }
          };
        } else if (reg) {
          const robbed = (G.robbedUntil[reg.id] ?? 0) > t;
          if (robbed) { prompt = `${reg.name} — the till is empty (robbed today)`; warn = true; }
          else {
            prompt = `Hold E — Rob ${reg.name}`;
            // hold-to-rob progress (3s)
            if (eDownAt.current > 0) {
              const progress = (performance.now() / 1000 - eDownAt.current) / 3;
              G.hold = { label: `Robbing ${reg.name}…`, progress: Math.min(1, progress) };
              robTarget.current = reg.id;
              if (progress >= 1) {
                eDownAt.current = -1; G.hold = null;
                const till = 120 + Math.floor(Math.random() * 281);
                giveCash(till, `Till emptied at ${reg.name}:`);
                if (Math.random() < 0.35) giveItem(rollLootItem());
                G.robbedUntil[reg.id] = t + 240; // one in-game day
                sfx.register(); sfx.crime();
                addCrime("robbery"); // alarm — instant 2★
                toast(`${reg.name} alarm tripped — run!`);
              }
            } else if (robTarget.current === reg.id) { G.hold = null; robTarget.current = ""; }
          }
        } else if (atPawn) {
          const total = stashTotal();
          if (total > 0) { prompt = `E — Sell stash at Coral Pawn ($${total})`; act = () => sellStash("Coral Pawn"); }
          else { prompt = "Coral Pawn — fences stolen goods. Your stash is empty."; warn = true; }
        } else if (zone) {
          prompt = `G — Garage · ${zone.label}`;
        }
      } else if (G.interior === "garage") {
        // Lina fences stash at her workbench (interior local (5.9,-4.6))
        const wx = INTERIORS.garage.cx + 5.9, wz = INTERIORS.garage.cz - 4.6;
        if ((wx - px) ** 2 + (wz - pz) ** 2 < 2.6 ** 2) {
          const total = stashTotal();
          if (total > 0) { prompt = `E — Sell stash to Lina ($${total})`; act = () => sellStash("Lina's Garage"); }
          else { prompt = "Lina's workbench — she'll fence your stash here."; warn = true; }
        }
      }
    }

    if (prompt) {
      G.promptText = prompt; G.promptWarn = warn; G.interact = act;
      myPrompt.current = prompt;
    } else if (myPrompt.current && G.promptText === myPrompt.current) {
      G.promptText = ""; G.promptWarn = false; G.interact = null;
      myPrompt.current = "";
    } else myPrompt.current = "";
  });

  return null;
}
