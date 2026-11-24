// Harborfall — Phase 17: RIDE THE CITY BUS.
//
// The road-level sibling of components/Tram.tsx, mirroring its
// contract exactly: GameSystems drives the bus (a busRoute traffic
// unit on the ±60 grid); this component owns the stops' presentation,
// the boarding/alighting prompts and — while riding — the player's
// seat placement (G.playerPos / G.followPos / G.playerHeading each
// frame, G.busRide = boarded stop index). Player.tsx renders the
// seated pose at G.busSeatY; GameSystems gives a seated passenger
// the tram's wanted treatment (no heat bleed, no bust).
//
// Mounted BEFORE Tram in App, so prompts are claimed politely
// (Phase9's pattern: only write when the line is free or already
// ours) — near a tram station the tram's own prompt still wins.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { G, toast } from "../game/store";
import { BUS, BUS_STOPS_RIDE, BUS_FARE } from "../game/bus";
import { sfx } from "../game/audio";
import { groundYAt } from "../world";

/** travel order around the loop: Docks → Ferry Quarter → South
 * Market → East Yards → Docks (the BUS_STOPS_RIDE array order is
 * presentational, not the driving order) */
const NEXT_STOP = [1, 3, 0, 2];

export default function BusRide() {
  const mine = useRef("");
  const lastDwell = useRef(0); // most recent stop the bus dwelled at

  useFrame(() => {
    const bus = G.traffic.find((c) => c.busRoute);
    if (!bus) return;
    BUS.x = bus.x; BUS.z = bus.z; BUS.heading = bus.heading;
    // which stop is the bus dwelling at right now (stopT runs only
    // while it sits at a stop:true waypoint)
    let atStop = -1;
    if ((bus.stopT ?? 0) > 0) {
      let best = 36;
      BUS_STOPS_RIDE.forEach((s, i) => {
        const d2 = (bus.x - s.routeX) ** 2 + (bus.z - s.routeZ) ** 2;
        if (d2 < best) { best = d2; atStop = i; }
      });
    }
    BUS.atStop = atStop;
    if (atStop >= 0) lastDwell.current = atStop;

    const claim = (text: string, act: (() => void) | null, warn = false) => {
      if (!G.promptText || G.promptText === mine.current) {
        G.promptText = text; G.promptWarn = warn; G.interact = act;
        mine.current = text;
      }
    };
    const release = () => {
      if (mine.current && G.promptText === mine.current) { G.promptText = ""; G.interact = null; }
      mine.current = "";
    };

    // ---------------- riding ----------------
    if (G.busRide >= 0) {
      // the seat: just behind the driver, kerb side
      const fx = Math.sin(bus.heading), fz = Math.cos(bus.heading);
      const sx = bus.x - fx * 0.4 + fz * 0.55, sz = bus.z - fz * 0.4 - fx * 0.55;
      G.playerPos.set(sx, 0, sz);
      G.followPos.set(sx, G.busSeatY, sz);
      G.playerHeading = bus.heading;
      if (atStop >= 0) {
        const si = atStop;
        const name = BUS_STOPS_RIDE[si].name;
        claim(`Press E — step off the Cityliner at ${name}`, () => {
          const s = BUS_STOPS_RIDE[si];
          G.busRide = -1;
          G.playerPos.set(s.streetX, 0, s.streetZ);
          G.followPos.set(s.streetX, 0, s.streetZ);
          release();
          sfx.door();
          toast(`You step off at ${name}. The Cityliner pulls away behind you.`);
        });
      } else {
        // next stop in travel order after the last one we dwelled at
        const next = BUS_STOPS_RIDE[NEXT_STOP[lastDwell.current]];
        claim(`🚌 Riding the Cityliner — next stop ${next.name} · E to step off when we stop`, null);
      }
      return;
    }

    // ---------------- boarding ----------------
    if (!G.driving && !G.interior && !G.status && !G.dialogueActive && !G.swimming) {
      const px = G.playerPos.x, pz = G.playerPos.z;
      for (let i = 0; i < BUS_STOPS_RIDE.length; i++) {
        const s = BUS_STOPS_RIDE[i];
        const d2 = (px - s.streetX) ** 2 + (pz - s.streetZ) ** 2;
        if (d2 > 4.5 ** 2) continue;
        if (atStop === i) {
          const next = BUS_STOPS_RIDE[NEXT_STOP[i]].name;
          claim(`Press E — board the Cityliner at ${s.name} (toward ${next}) · $${BUS_FARE} fare`, () => {
            if (G.cash < BUS_FARE) { toast(`The driver shakes his head — the fare is $${BUS_FARE} and you're short.`); sfx.dryFire(); return; }
            G.cash -= BUS_FARE; sfx.cash();
            G.busRide = i; lastDwell.current = i;
            release();
            sfx.door();
            toast(`All aboard the Cityliner — ${s.blurb}. $${BUS_FARE} fare. E to step off at a stop.`);
          });
          return;
        }
        claim(`Cityliner · ${s.name} — ${s.blurb} · the bus loops Docks → Ferry Quarter → South Market → East Yards`, null);
        return;
      }
    }
    release();
  });

  return (
    <group>
      {BUS_STOPS_RIDE.map((s) => (
        <group key={s.name} position={[s.streetX, groundYAt(s.streetX, s.streetZ), s.streetZ]}>
          {/* stop pole + amber board (the tram's stations are steel
              and teal; the bus stops are kerbside timber and amber) */}
          <mesh position={[0, 1.15, 0]}><cylinderGeometry args={[0.045, 0.045, 2.3, 6]} /><meshStandardMaterial color="#4a4238" roughness={0.9} /></mesh>
          <mesh position={[0, 2.15, 0]}><boxGeometry args={[0.92, 0.5, 0.06]} /><meshStandardMaterial color="#f2b134" roughness={0.6} emissive="#f2b134" emissiveIntensity={0.25} /></mesh>
          <mesh position={[0, 2.15, 0]}><boxGeometry args={[0.7, 0.3, 0.075]} /><meshBasicMaterial color="#17323e" /></mesh>
          <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.3, 0.34, 0.05, 10]} /><meshStandardMaterial color="#2c343c" roughness={1} /></mesh>
        </group>
      ))}
    </group>
  );
}
