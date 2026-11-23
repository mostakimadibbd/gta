// Harborfall — Phase 13: THE SABLE LINE. A two-car light-rail tram on
// an ELEVATED guideway that runs above the road centres, so it never
// fights the traffic AI: the beam deck sits at y≈6.55 (the tallest bus
// roof is ~3.4), carried on slim median pillars that are deliberately
// NOT in the collision set (the palm-tree precedent in world.ts — thin
// median furniture never traps the player or the traffic).
//
// The loop reuses district geography: up the Docks road (x=20), across
// Market Row (z=-20), up the causeway (x=-20), around the Northgate
// ring (z=-248 / x=-84 / z=-216), back down the causeway, across to
// the bay bridge (x=60), and a lollipop into Coral Shores (in on
// x=72, out on x=40, stop on z=264). The causeway and bridge trunks
// are shared both ways — there is one tram, so no passing is needed.
//
// Path = polyline with quadratic-Bezier corner fillets (radius ~8u),
// pre-sampled at ~1u into flat arrays with cumulative lengths. All
// lookups write into caller/scratch objects — zero per-frame
// allocation (Phase 12 discipline).
import * as THREE from "three";
import { groundYAt } from "../world";

export const TRAM_DECK_Y = 6.55;   // rail head height on street sections (beam top)
export const TRAM_SEAT_Y = 6.62;   // base player root height while riding

// ---- route (travel order, closed loop) ----
const WAYPOINTS: Array<[number, number]> = [
  [20, 100],   // 0  Docks station
  [20, 0],     // 1  Market Row station
  [20, -20],
  [-20, -20],
  [-20, -248],
  [-84, -248],
  [-84, -216],
  [-52, -216], // 7  Northgate station
  [-20, -216],
  [-20, -20],  // pass (shared trunk)
  [60, -20],
  [60, 224],
  [72, 224],
  [72, 264],
  [56, 264],   // 14 Coral Shores station
  [40, 264],
  [40, 224],
  [60, 224],   // pass
  [60, -20],   // pass
  [20, -20],   // pass
];
export interface TramStation { name: string; wp: number; blurb: string }
export const TRAM_STATIONS: TramStation[] = [
  { name: "Docks", wp: 0, blurb: "Harbour Patrol HQ · Sable Clinic · the pier" },
  { name: "Market Row", wp: 1, blurb: "Shops · SableBank · Club Solace" },
  { name: "Northgate", wp: 7, blurb: "Sable Motors · the mansions · parking deck" },
  { name: "Coral Shores", wp: 14, blurb: "The beach · Marina Table · the apartments" },
];

// ---- sampled path ----
const _xs: number[] = []; const _zs: number[] = [];
const _corner: boolean[] = []; // sample sits on a corner fillet (slow zone)
function buildPath() {
  const n = WAYPOINTS.length;
  const push = (x: number, z: number, corner: boolean) => { _xs.push(x); _zs.push(z); _corner.push(corner); };
  // precompute every corner's fillet entry/exit so the loop wraps cleanly
  const entry: Array<[number, number]> = [], exit: Array<[number, number]> = [], rad: number[] = [];
  for (let i = 0; i < n; i++) {
    const [px, pz] = WAYPOINTS[i];
    const [ax, az] = WAYPOINTS[(i + n - 1) % n];
    const [bx, bz] = WAYPOINTS[(i + 1) % n];
    const dIn = Math.hypot(px - ax, pz - az), dOut = Math.hypot(bx - px, bz - pz);
    const r = Math.min(8, dIn * 0.42, dOut * 0.42);
    rad.push(r);
    entry.push([px - ((px - ax) / dIn) * r, pz - ((pz - az) / dIn) * r]);
    exit.push([px + ((bx - px) / dOut) * r, pz + ((bz - pz) / dOut) * r]);
  }
  for (let i = 0; i < n; i++) {
    const [px, pz] = WAYPOINTS[i];
    const [lx, lz] = exit[(i + n - 1) % n]; // previous corner's exit
    const [inX, inZ] = entry[i];
    const segLen = Math.hypot(inX - lx, inZ - lz);
    const steps = Math.max(1, Math.round(segLen));
    for (let sIdx = 1; sIdx <= steps; sIdx++) { const f = sIdx / steps; push(lx + (inX - lx) * f, lz + (inZ - lz) * f, false); }
    const [outX, outZ] = exit[i];
    const cSteps = Math.max(2, Math.round(rad[i] * 1.5));
    for (let sIdx = 1; sIdx <= cSteps; sIdx++) {
      const t = sIdx / cSteps, u = 1 - t;
      push(u * u * inX + 2 * u * t * px + t * t * outX, u * u * inZ + 2 * u * t * pz + t * t * outZ, true);
    }
  }
}
buildPath();
const COUNT = _xs.length;
const _cum = new Float32Array(COUNT + 1);
const _tx = new Float32Array(COUNT); const _tz = new Float32Array(COUNT);
for (let i = 0; i < COUNT; i++) {
  const j = (i + 1) % COUNT;
  _cum[i + 1] = _cum[i] + Math.hypot(_xs[j] - _xs[i], _zs[j] - _zs[i]);
  const dx = _xs[j] - _xs[i], dz = _zs[j] - _zs[i], l = Math.hypot(dx, dz) || 1;
  _tx[i] = dx / l; _tz[i] = dz / l;
}
export const TRAM_LOOP_LENGTH = _cum[COUNT];

// ---- guideway height profile: the deck rides at TRAM_DECK_Y over
// the streets, but over the BAY BRIDGE the road deck itself is 5.5u
// up — the guideway climbs with the bridge ramps (ground + 4.05u of
// clearance: the tallest bus roof passes underneath) and settles
// back down the far ramp. Smoothed so the beam reads as a grade,
// not steps. ----
const _y = new Float32Array(COUNT);
for (let i = 0; i < COUNT; i++) _y[i] = Math.max(TRAM_DECK_Y, groundYAt(_xs[i], _zs[i]) + 4.05);
for (let pass = 0; pass < 3; pass++) {
  const prev = Float32Array.from(_y);
  for (let i = 0; i < COUNT; i++) _y[i] = (prev[(i + COUNT - 1) % COUNT] + prev[i] * 2 + prev[(i + 1) % COUNT]) / 4;
}

/** Nearest sample s for each station waypoint. */
export const TRAM_STOPS = TRAM_STATIONS.map((st) => {
  const [wx, wz] = WAYPOINTS[st.wp];
  let best = 0, bd = Infinity;
  for (let i = 0; i < COUNT; i++) { const d = (_xs[i] - wx) ** 2 + (_zs[i] - wz) ** 2; if (d < bd) { bd = d; best = i; } }
  return { ...st, s: _cum[best], x: _xs[best], z: _zs[best], tx: _tx[best], tz: _tz[best] };
});

export interface TramPoint { x: number; z: number; tx: number; tz: number; corner: boolean; y: number }
const _pt: TramPoint = { x: 0, z: 0, tx: 0, tz: 1, corner: false, y: TRAM_DECK_Y };
/** Position + tangent at arc distance s (wraps). Writes into a shared
 * scratch object — copy the numbers out if you need them later. */
export function tramPointAt(s: number): TramPoint {
  const L = TRAM_LOOP_LENGTH;
  const w = ((s % L) + L) % L;
  let lo = 0, hi = COUNT;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (_cum[mid + 1] < w) lo = mid + 1; else hi = mid; }
  const i = lo, j = (i + 1) % COUNT;
  const seg = _cum[i + 1] - _cum[i] || 1;
  const f = THREE.MathUtils.clamp((w - _cum[i]) / seg, 0, 1);
  _pt.x = _xs[i] + (_xs[j] - _xs[i]) * f;
  _pt.z = _zs[i] + (_zs[j] - _zs[i]) * f;
  _pt.tx = _tx[i]; _pt.tz = _tz[i]; _pt.corner = _corner[i];
  _pt.y = _y[i] + (_y[j] - _y[i]) * f;
  return _pt;
}
/** Signed distance from s to the next stop ahead (0 if AT a stop). */
export function distToNextStop(s: number): { dist: number; idx: number } {
  let best = Infinity, idx = -1;
  for (let i = 0; i < TRAM_STOPS.length; i++) {
    let d = TRAM_STOPS[i].s - s;
    if (d < -2) d += TRAM_LOOP_LENGTH;
    if (d < best) { best = d; idx = i; }
  }
  return { dist: best, idx };
}

// ---- guideway instancing data (beam/rail boxes every ~4u, pillars) ----
export interface GuideSeg { x: number; z: number; ang: number; y: number }
export const TRAM_BEAM_SEGS: GuideSeg[] = [];
export const TRAM_PILLARS: GuideSeg[] = [];
{
  for (let s = 0; s < TRAM_LOOP_LENGTH; s += 4) { const p = tramPointAt(s); TRAM_BEAM_SEGS.push({ x: p.x, z: p.z, ang: Math.atan2(p.tx, p.tz), y: p.y }); }
  for (let s = 2; s < TRAM_LOOP_LENGTH; s += 16) { const p = tramPointAt(s); TRAM_PILLARS.push({ x: p.x, z: p.z, ang: Math.atan2(p.tx, p.tz), y: p.y }); }
}
/** Flat polyline for the phone map (every ~8u). */
export const TRAM_MAP_LINE: Array<[number, number]> = [];
for (let s = 0; s < TRAM_LOOP_LENGTH; s += 8) { const p = tramPointAt(s); TRAM_MAP_LINE.push([p.x, p.z]); }

// ---- live state (written by Tram.tsx, read by App map + prompts) ----
export const TRAM = {
  s: 40, speed: 0, x: 20, z: 60, tx: 0, tz: -1,
  stopped: false, stationIdx: -1, // station index while dwelling
  doorOpen: 0, // 0..1 door slide amount
};
export const TRAM_CRUISE = 11.5;
