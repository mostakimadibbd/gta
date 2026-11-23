// Harborfall — Lina's mod menu (Phase 6, B1). Open with M while sitting
// in a car inside a garage zone. Respray, engine tune (3 levels), brake
// upgrade and a tyre swap for spike damage. Everything writes through to
// the live car AND its stored-garage record, so mods survive sessions.
import { useEffect, useState } from "react";
import { G, persistStoredCars, toast } from "../game/store";
import { CAR_MODELS } from "../world";
import { sfx } from "../game/audio";

export const RESPRAYS = ["#c22e2e", "#2e7fb8", "#2e8a5a", "#e8b23a", "#20242a", "#e8e8e8", "#7a4a8a", "#c96a2c"];
const TUNE_COST = [400, 750, 1200];
const BRAKE_COST = 300;
const RESPRAY_COST = 150;
const TYRE_COST = 40;

export default function ModMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const iv = setInterval(() => setTick((v) => v + 1), 400);
    return () => clearInterval(iv);
  }, [open ]);
  if (!open) return null;
  const car = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId] : null;
  if (!car) return null;
  const tune = car.tuneLvl ?? 0;
  const brakes = car.brakeLvl ?? 0;

  // mirror the change into the stored record for this car, if it has one
  const syncStored = () => {
    const s = G.storedCars.find((sc) => sc.kind === car.kind && sc.color === car.color);
    if (s) { s.tuneLvl = car.tuneLvl ?? 0; s.brakeLvl = car.brakeLvl ?? 0; s.flatTyre = car.flatTyre ?? false; persistStoredCars(); }
  };
  const buy = (cost: number, apply: () => void, label: string) => {
    if (G.cash < cost) { toast(`${label} costs $${cost} — not enough cash.`); sfx.dryFire(); return; }
    G.cash -= cost;
    apply();
    syncStored();
    sfx.register();
    toast(`${label} fitted — $${cost}`);
    setTick((v) => v + 1);
  };

  return (
    <div className="garage-overlay" role="dialog" aria-label="Lina's mods">
      <div className="garage-panel mod-panel">
        <div className="garage-head">
          <div>
            <div className="garage-title">Lina&apos;s Mods</div>
            <div className="garage-sub">{CAR_MODELS[car.kind].name} · cash ${G.cash.toLocaleString()}</div>
          </div>
          <button type="button" className="garage-close" onClick={onClose} aria-label="Close mods">✕</button>
        </div>

        <div className="mod-section">Respray — ${RESPRAY_COST}</div>
        <div className="mod-swatches">
          {RESPRAYS.map((c) => (
            <button key={c} type="button" className={`mod-swatch${car.color === c ? " on" : ""}`} style={{ background: c }}
              aria-label={`Respray ${c}`}
              onClick={() => buy(RESPRAY_COST, () => { car.color = c; }, "Respray")} />
          ))}
        </div>

        <div className="mod-section">Engine tune — +10% top speed per level</div>
        <div className="mod-row">
          <span>Level {tune}/3{tune >= 3 ? " · maxed" : ` · next $${TUNE_COST[tune]}`}</span>
          <button type="button" className="garage-btn" disabled={tune >= 3}
            onClick={() => buy(TUNE_COST[tune], () => { car.tuneLvl = tune + 1; }, `Engine tune ${tune + 1}`)}>
            {tune >= 3 ? "Maxed" : "Upgrade"}
          </button>
        </div>

        <div className="mod-section">Brakes — sharper stopping</div>
        <div className="mod-row">
          <span>{brakes >= 1 ? "Performance brakes fitted" : `Standard brakes · $${BRAKE_COST}`}</span>
          <button type="button" className="garage-btn" disabled={brakes >= 1}
            onClick={() => buy(BRAKE_COST, () => { car.brakeLvl = 1; }, "Brake upgrade")}>
            {brakes >= 1 ? "Fitted" : "Upgrade"}
          </button>
        </div>

        {car.flatTyre && (
          <>
            <div className="mod-section">Spike damage</div>
            <div className="mod-row">
              <span>One shredded tyre · ${TYRE_COST}</span>
              <button type="button" className="garage-btn"
                onClick={() => buy(TYRE_COST, () => { car.flatTyre = false; }, "Tyre replacement")}>
                Replace tyre
              </button>
            </div>
          </>
        )}
        <p className="garage-note">Mods stick to this car — they&apos;re saved with it in your garage. M or ✕ to close.</p>
      </div>
    </div>
  );
}
