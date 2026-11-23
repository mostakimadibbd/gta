// Harborfall — Phase 4 proximity interactions: pickpocketing, shop robbery
// (hold-E), pawn sales, garage zones and Lina's repair service. Runs AFTER
// Interiors in the frame, so door/mansion prompts keep priority: this layer
// only writes the HUD prompt when Interiors left it empty.
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { G, addCrime, toast, stashTotal, bark, syncWeaponMirrors, persistStoredCars } from "../game/store";
import { GARAGE_ZONES, REGISTERS, PAWN_SHOP, INTERIORS, DEALERSHIP, DEALER_CARS, CAR_MODELS, GUN_STORE, VENDOR, HOSPITAL_DOOR } from "../world";
import { sfx } from "../game/audio";
import { giveCash, giveItem, rollLootItem, sellStash } from "../game/theft";
import { pushPhoneMsg } from "../game/phone";
import { ECO } from "../game/economy";
import { F, creelValue } from "../game/phase8";
import { WMOD, persistWmod } from "../game/phase9";
import { jobStats, persistJobStats } from "../game/jobs";

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** In-game clock hour (matches the phone): dayTime 0 = 06:00. */
export const gameHour = () => Math.floor((G.dayTime * 24 + 6) % 24);
/** Market Row shops + the pawn keep hours (B3): closed 23:00–07:00. */
export const shopsClosed = () => { const h = gameHour(); return h >= 23 || h < 7; };

interface GunItem { label: string; price: number; apply: () => void; owned?: () => boolean; }
const GUN_ITEMS: GunItem[] = [
  { label: "Baseball bat", price: 150, apply: () => { G.weaponOwned.bat = true; G.weaponSel = "bat"; } },
  { label: "SMG", price: 650, apply: () => { G.weaponOwned.smg = true; G.weaponAmmo.smg = Math.min(240, G.weaponAmmo.smg + 60); G.weaponSel = "smg"; } },
  { label: "Shotgun", price: 450, apply: () => { G.weaponOwned.shotgun = true; G.weaponAmmo.shotgun = Math.min(240, G.weaponAmmo.shotgun + 12); G.weaponSel = "shotgun"; } },
  { label: "Pistol ammo ×24", price: 60, apply: () => { G.weaponAmmo.pistol = Math.min(240, G.weaponAmmo.pistol + 24); } },
  { label: "SMG ammo ×60", price: 90, apply: () => { G.weaponAmmo.smg = Math.min(240, G.weaponAmmo.smg + 60); } },
  { label: "Shotgun shells ×12", price: 70, apply: () => { G.weaponAmmo.shotgun = Math.min(240, G.weaponAmmo.shotgun + 12); } },
  // ---- Phase 9 weapon mods: bought once, fitted forever (persisted).
  // Effects are real and applied in Combat's spec builder. ----
  { label: "Pistol suppressor — quiet shots, witnesses only", price: 300, owned: () => WMOD.suppPistol, apply: () => { WMOD.suppPistol = true; persistWmod(); } },
  { label: "SMG suppressor — quiet shots, witnesses only", price: 380, owned: () => WMOD.suppSmg, apply: () => { WMOD.suppSmg = true; persistWmod(); } },
  { label: "Pistol match sights — tighter, longer reach", price: 220, owned: () => WMOD.sightsPistol, apply: () => { WMOD.sightsPistol = true; persistWmod(); } },
  { label: "SMG extended mag + match barrel — faster, tighter", price: 350, owned: () => WMOD.magSmg, apply: () => { WMOD.magSmg = true; persistWmod(); } },
  { label: "Shotgun choke — tighter spread, longer reach", price: 260, owned: () => WMOD.chokeShotgun, apply: () => { WMOD.chokeShotgun = true; persistWmod(); } },
];

export default function Interactions() {
  const myPrompt = useRef("");
  const eDownAt = useRef(-1);
  const robTarget = useRef("");
  // ---- Phase 6 shop browsing: tap E cycles, hold E (0.9 s) buys ----
  const browseCtx = useRef<"" | "dealer" | "gun" | "pawn">("");
  const dealerIdx = useRef(0);
  const gunIdx = useRef(0);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "e" && !e.repeat) eDownAt.current = performance.now() / 1000;
      // R — repair at a garage while sitting in the car (Phase 6: a
      // spiked flat tyre is a $40 line item on the same job)
      if (e.key.toLowerCase() === "r" && !e.repeat && G.driving && G.garageZone) {
        const car = G.cars[G.activeCarId];
        if (car && (car.damage > 1 || car.brokenWindow || car.flatTyre)) {
          const cost = Math.ceil(car.damage * 1.2) + (car.brokenWindow ? 25 : 0) + (car.flatTyre ? 40 : 0);
          if (G.cash >= cost) {
            G.cash -= cost; car.damage = 0; car.brokenWindow = false; car.flatTyre = false;
            toast(`Repaired at ${G.garageZone.label} — $${cost}`);
            sfx.fuel();
          } else toast(`Repair costs $${cost} — not enough cash.`);
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "e") {
        // a short tap at a shop counter = browse to the next item
        if (browseCtx.current && eDownAt.current > 0 && performance.now() / 1000 - eDownAt.current < 0.35) {
          if (browseCtx.current === "dealer") dealerIdx.current = (dealerIdx.current + 1) % DEALER_CARS.length;
          else gunIdx.current = (gunIdx.current + 1) % GUN_ITEMS.length;
          sfx.click();
        }
        eDownAt.current = -1;
        if (G.hold?.label.startsWith("Robbing") || G.hold?.label.startsWith("Buying")) G.hold = null;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  useFrame(() => {
    const t = G.timeS;
    const px = G.playerPos.x, pz = G.playerPos.z;
    browseCtx.current = ""; // re-derived below when on foot near a counter

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
        if (zone && car && (car.damage > 1 || car.brokenWindow || car.flatTyre)) {
          const cost = Math.ceil(car.damage * 1.2) + (car.brokenWindow ? 25 : 0) + (car.flatTyre ? 40 : 0);
          prompt = `R — Repair at ${zone.label} ($${cost})${car.flatTyre ? " · incl. new tyre" : ""}`;
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
        const closed = shopsClosed();
        // ---- Phase 6 counters: dealership / gun store / pawn weapons ----
        const atDealer = (DEALERSHIP.x - px) ** 2 + (DEALERSHIP.z - pz) ** 2 < 3.2 ** 2;
        const atGun = (GUN_STORE.x - px) ** 2 + (GUN_STORE.z - pz) ** 2 < 2.6 ** 2;
        const atVendor = (VENDOR.x - px) ** 2 + (VENDOR.z - pz) ** 2 < 2.4 ** 2;
        const atHospital = (HOSPITAL_DOOR.x - px) ** 2 + (HOSPITAL_DOOR.z - pz) ** 2 < 3 ** 2;
        const ev = G.eventNow;
        const atPerformer = !!ev && ev.kind === "performer" && !ev.tipped && (ev.x - px) ** 2 + (ev.z - pz) ** 2 < 3 ** 2;
        browseCtx.current = atDealer && !closed ? "dealer" : atGun && !closed ? "gun" : atPawn && !closed && stashTotal() <= 0 ? "pawn" : "";
        // hold E at a counter = buy the browsed item (0.9 s)
        if (browseCtx.current && eDownAt.current > 0) {
          const isDealer = browseCtx.current === "dealer";
          const label = isDealer ? CAR_MODELS[DEALER_CARS[dealerIdx.current].kind].name : GUN_ITEMS[gunIdx.current].label;
          const price = isDealer ? DEALER_CARS[dealerIdx.current].price : GUN_ITEMS[gunIdx.current].price;
          const progress = (performance.now() / 1000 - eDownAt.current) / 0.9;
          G.hold = { label: `Buying ${label} — $${price}…`, progress: Math.min(1, progress) };
          if (progress >= 1) {
            eDownAt.current = -1; G.hold = null;
            if (G.cash < price) { toast(`${label} costs $${price} — not enough cash.`); sfx.dryFire(); }
            else if (isDealer) {
              if (G.storedCars.length >= 6) toast("Your garage is full (6) — store or sell a car first.");
              else {
                const dc = DEALER_CARS[dealerIdx.current];
                G.cash -= price;
                G.storedCars.push({ kind: dc.kind, color: dc.color, name: CAR_MODELS[dc.kind].name, damage: 0, fuel: 90, brokenWindow: false });
                persistStoredCars();
                pushPhoneMsg("Sable Motors", `🚗 ${CAR_MODELS[dc.kind].name} delivered to your garage. Press G at a garage to take it out.`);
                toast(`${CAR_MODELS[dc.kind].name} bought — delivered to your garage`);
                sfx.cash();
              }
            } else if (GUN_ITEMS[gunIdx.current].owned?.()) {
              toast(`${label} — already fitted. No charge.`);
              sfx.click();
            } else {
              G.cash -= price;
              GUN_ITEMS[gunIdx.current].apply();
              syncWeaponMirrors();
              toast(`${label} bought — $${price}`);
              sfx.register();
            }
          }
        } else if (G.hold?.label.startsWith("Buying")) G.hold = null;

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
            // Phase 8 memory: the victim KNOWS it was you (felt the hand
            // or saw your face) — they remember for the rest of the
            // game-day and give you a wide berth (GameSystems ped loop).
            victim.memRobbedDay = ECO.daySerial;
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
          if (closed) { prompt = `${reg.name} — closed (opens 07:00)`; warn = true; }
          else if (robbed) { prompt = `${reg.name} — the till is empty (robbed today)`; warn = true; }
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
          if (closed) { prompt = "Coral Pawn — closed (opens 07:00)"; warn = true; }
          else if (total > 0) { prompt = `E — Sell stash at Coral Pawn ($${total})`; act = () => sellStash("Coral Pawn"); }
          else {
            const gi = GUN_ITEMS[gunIdx.current];
            prompt = `E — Pawn counter: ${gi.label} $${gi.price} (tap E browse · hold E buy)`;
          }
        } else if (atDealer) {
          if (closed) { prompt = "Sable Motors — closed (opens 07:00)"; warn = true; }
          else {
            const dc = DEALER_CARS[dealerIdx.current];
            prompt = `E — ${CAR_MODELS[dc.kind].name} $${dc.price.toLocaleString()} at Sable Motors (tap E browse · hold E buy)`;
          }
        } else if (atGun) {
          if (closed) { prompt = "Sable Arms — closed (opens 07:00)"; warn = true; }
          else {
            const gi = GUN_ITEMS[gunIdx.current];
            prompt = `E — Sable Arms: ${gi.label} $${gi.price}${gi.owned?.() ? " — fitted ✓" : ""} (tap E browse · hold E buy)`;
          }
        } else if (atVendor) {
          // street food — the vendor keeps harbour hours: always open (B3)
          // Phase 8: the Wraps stall buys the day's catch off you first
          if (F.creel.length > 0) {
            const val = creelValue();
            prompt = `E — Sell your catch to Harbour Wraps ($${val} · ${F.creel.length} fish)`;
            act = () => {
              const n = F.creel.length;
              F.creel = [];
              G.cash += val; G.lifetimeEarned += val;
              jobStats.fishEarned += val; persistJobStats();
              sfx.register();
              toast(`🐟 Sold ${n} fish to Harbour Wraps — +$${val}. Tomorrow's special, sorted.`);
            };
          }
          // Phase 7: full belly but tired legs → the $5 cooler drink
          else if (G.health >= 99.5 && G.stamina < 99 && G.cash >= 5) {
            prompt = "E — Harbour cooler drink ($5) — refills stamina";
            act = () => {
              G.cash -= 5; G.stamina = 100;
              G.eatingUntil = t + 1.4;
              sfx.eat();
              toast("Ice-cold harbour cooler — stamina refilled.");
            };
          }
          else if (G.health >= 99.5) { prompt = "Harbour Wraps — you're full. The wraps keep till late."; warn = true; }
          else {
            prompt = "E — Harbour wrap ($10) — heals 40";
            act = () => {
              if (G.cash < 10) { toast("A wrap costs $10 — you're short."); return; }
              G.cash -= 10;
              G.health = Math.min(100, G.health + 40);
              G.eatingUntil = t + 1.4;
              sfx.eat();
              toast("Harbour wrap eaten — +40 health");
            };
          }
        } else if (atHospital) {
          if (G.health >= 99.5) { prompt = "Sable General — you're in good shape."; warn = true; }
          else {
            prompt = "E — Sable General: full treatment ($50)";
            act = () => {
              if (G.cash < 50) { toast("Treatment costs $50 — not enough cash."); return; }
              G.cash -= 50; G.finesPaid += 50;
              G.health = 100;
              sfx.cash();
              toast("Sable General patched you up — full health");
            };
          }
        } else if (atPerformer) {
          prompt = "E — Tip the performer ($5)";
          act = () => {
            if (G.cash < 5) { toast("No coins for the hat."); return; }
            G.cash -= 5;
            if (G.eventNow) G.eventNow.tipped = true;
            // Phase 8 memory: the little crowd remembers a kindness —
            // helped peds greet you (and never report a face they like
            // quite as fast: they are skipped as the reporting witness
            // while the memory lasts — see store addCrime witness pick)
            for (const p of G.peds) if (p.active && (p.x - px) ** 2 + (p.z - pz) ** 2 < 7 ** 2) p.memHelpedUntil = t + 300;
            bark("Performer", "Bless you! Port Sable's got soul, friend.");
            sfx.cash();
          };
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
