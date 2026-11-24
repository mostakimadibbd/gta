// Harborfall — Phase 17: THE CITY BUS, RIDEABLE.
//
// The Sable Cityliner has run its rectangle route as ambient traffic
// since Phase 6 (GameSystems owns the driving: BUS_ROUTE waypoints,
// dwell at stop:true points). Phase 17 makes it a service the player
// can USE, mirroring the Sable Line tram's contract rather than
// inventing a second ride system:
//   · board at a stop while the bus dwells there (fare $2),
//   · ride seated — the bus drives, you watch the city,
//   · alight at any later stop with E (stations only, like the tram),
//   · wanted treatment identical to the tram: riding never bleeds
//     heat and the patrol never busts a seated passenger — they wait
//     at the stop like everyone else (GameSystems gates on
//     G.busRide exactly as it gates on G.tramRide).
// This module is data + the live ride state only; components/BusRide
// owns the prompts and the seat placement, GameSystems owns the bus.
export interface BusStop {
  name: string;
  /** where the BUS pauses on its route (a BUS_ROUTE stop waypoint) */
  routeX: number; routeZ: number;
  /** where the PLAYER stands to board / lands when alighting */
  streetX: number; streetZ: number;
  blurb: string;
}
export const BUS_STOPS_RIDE: BusStop[] = [
  { name: "Docks", routeX: 34, routeZ: 60, streetX: 34, streetZ: 67.7, blurb: "Harbour Patrol HQ · the pier · Sable Clinic" },
  { name: "Ferry Quarter", routeX: -60, routeZ: 14, streetX: -67.7, streetZ: 14, blurb: "The safehouse · ferry homes · west shops" },
  { name: "East Yards", routeX: 60, routeZ: -20, streetX: 67.7, streetZ: -20, blurb: "Trucking yards · the counting house" },
  { name: "South Market", routeX: 20, routeZ: -60, streetX: 20, streetZ: -67.7, blurb: "Lantern Park · the south market stalls" },
];
export const BUS_FARE = 2;
/** Live state written by BusRide.tsx, read by App's map drawing. */
export const BUS = {
  /** index into BUS_STOPS_RIDE the bus is dwelling at, or -1 */
  atStop: -1,
  x: 60, z: 0, heading: 0,
};
