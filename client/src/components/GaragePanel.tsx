// Harborfall — garage car-select panel (Phase 4). Dark-glass UI over the
// stored-cars list: pick a stored car and it rolls out of the garage exit;
// park a car in a garage zone and store it from here (max 6, persisted).
import { useEffect, useState } from "react";
import { G, persistStoredCars, type StoredCar } from "../game/store";
import { GARAGE_ZONES, CAR_MODELS } from "../world";
import { sfx } from "../game/audio";

function Bar({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="garage-bar">
      <span>{label}</span>
      <div className="garage-bar-track"><div className="garage-bar-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: tone ?? undefined }} /></div>
      <b>{Math.round(value)}</b>
    </div>
  );
}

function CarCard({ name, color, kind, damage, fuel, brokenWindow, action, actionLabel }: {
  name: string; color: string; kind: string; damage: number; fuel: number; brokenWindow?: boolean;
  action?: () => void; actionLabel?: string;
}) {
  const stats = CAR_MODELS[kind as keyof typeof CAR_MODELS] ?? CAR_MODELS.sedan;
  return (
    <div className="garage-card">
      <div className="garage-card-head">
        <span className="garage-chip" style={{ background: color }} />
        <div>
          <div className="garage-card-name">{name}</div>
          <div className="garage-card-kind">{kind}{brokenWindow ? " · broken window" : ""}</div>
        </div>
      </div>
      <Bar label="TOP SPEED" value={(stats.topSpeed / 238) * 100} />
      <div className="garage-bar-num">{stats.topSpeed} km/h</div>
      <Bar label="HANDLING" value={stats.handling} />
      <Bar label="CONDITION" value={100 - damage} tone={damage > 60 ? "#e2574c" : damage > 30 ? "#f2b134" : undefined} />
      <Bar label="FUEL" value={fuel} tone={fuel < 25 ? "#e2574c" : undefined} />
      {action && <button type="button" className="garage-card-btn" onClick={action}>{actionLabel}</button>}
    </div>
  );
}

export default function GaragePanel({ zoneId, onClose }: { zoneId: string; onClose: () => void }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((v) => v + 1), 300);
    return () => clearInterval(iv);
  }, []);
  const zone = GARAGE_ZONES.find((z) => z.id === zoneId) ?? GARAGE_ZONES[1];
  const current = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId] : null;

  const storeCurrent = () => {
    if (!current || G.storedCars.length >= 6) return;
    G.storedCars.push({ kind: current.kind, color: current.color, name: CAR_MODELS[current.kind].name, damage: Math.round(current.damage), fuel: Math.round(current.fuel), brokenWindow: current.brokenWindow, tuneLvl: current.tuneLvl ?? 0, brakeLvl: current.brakeLvl ?? 0, flatTyre: current.flatTyre ?? false });
    persistStoredCars();
    current.storedAway = true;
    current.state = { x: 0, z: -500, heading: 0, speed: 0 };
    G.driving = false; G.activeCarId = -1;
    sfx.door();
    setTick((v) => v + 1);
  };

  const takeOut = (idx: number) => {
    const stored: StoredCar | undefined = G.storedCars[idx];
    if (!stored) return;
    // swap: the car you're sitting in goes into storage in its place
    if (current && G.storedCars.length <= 6) {
      G.storedCars[idx] = { kind: current.kind, color: current.color, name: CAR_MODELS[current.kind].name, damage: Math.round(current.damage), fuel: Math.round(current.fuel), brokenWindow: current.brokenWindow, tuneLvl: current.tuneLvl ?? 0, brakeLvl: current.brakeLvl ?? 0, flatTyre: current.flatTyre ?? false };
      current.storedAway = true;
      current.state = { x: 0, z: -500, heading: 0, speed: 0 };
      G.driving = false; G.activeCarId = -1;
    } else {
      G.storedCars.splice(idx, 1);
    }
    persistStoredCars();
    // find a put-away world instance to reuse, else add a fresh car entry
    let car = G.cars.find((c) => c.storedAway && c.kind === stored.kind && c.color === stored.color);
    if (!car) {
      G.cars.push({
        id: 1000 + G.cars.length, x: zone.exitX, z: zone.exitZ, heading: zone.exitHeading, color: stored.color,
        model: stored.name, kind: stored.kind as typeof G.cars[number]["kind"], owned: true,
        state: { x: zone.exitX, z: zone.exitZ, heading: zone.exitHeading, speed: 0 },
        stolen: false, damage: stored.damage, fuel: stored.fuel,
        brokenWindow: stored.brokenWindow, pitch: 0, roll: 0, steerVis: 0, storedAway: false,
        flatTyre: stored.flatTyre ?? false, tuneLvl: stored.tuneLvl ?? 0, brakeLvl: stored.brakeLvl ?? 0, pitchVel: 0, rollVel: 0,
      });
      car = G.cars[G.cars.length - 1];
    } else {
      car.storedAway = false;
      car.state = { x: zone.exitX, z: zone.exitZ, heading: zone.exitHeading, speed: 0 };
      car.damage = stored.damage; car.fuel = stored.fuel; car.brokenWindow = stored.brokenWindow;
      car.flatTyre = stored.flatTyre ?? false; car.tuneLvl = stored.tuneLvl ?? 0; car.brakeLvl = stored.brakeLvl ?? 0;
    }
    sfx.door();
    onClose();
  };

  return (
    <div className="garage-overlay" role="dialog" aria-label="Garage">
      <div className="garage-panel glass">
        <div className="garage-head">
          <div>
            <div className="garage-title">{zone.label}</div>
            <div className="garage-sub">{G.storedCars.length}/6 cars stored · repairs: park inside and press R</div>
          </div>
          <button type="button" className="garage-close" onClick={onClose}>✕</button>
        </div>
        {current && (
          <div className="garage-current">
            <div className="garage-section">CURRENT CAR</div>
            <CarCard name={CAR_MODELS[current.kind].name} color={current.color} kind={current.kind}
              damage={current.damage} fuel={current.fuel} brokenWindow={current.brokenWindow}
              action={G.storedCars.length < 6 ? storeCurrent : undefined}
              actionLabel={G.storedCars.length < 6 ? "Store this car" : "Garage full (6)"} />
          </div>
        )}
        <div className="garage-section">STORED</div>
        {G.storedCars.length === 0 && <div className="garage-empty">No stored cars yet. Park any car in a garage zone and store it here — or park on the villa drive and it files itself away.</div>}
        <div className="garage-grid">
          {G.storedCars.map((s, i) => (
            <CarCard key={i} name={s.name} color={s.color} kind={s.kind} damage={s.damage} fuel={s.fuel}
              brokenWindow={s.brokenWindow} action={() => takeOut(i)} actionLabel="Take out" />
          ))}
        </div>
      </div>
    </div>
  );
}
