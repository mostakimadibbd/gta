// Harborfall — Phase 43: THE SABLE POSTCARDS (photo challenges).
//
// Eight postcards The Wire's picture desk will buy, one of each.
// You shoot them in Photo Mode; when a shutter press satisfies a
// postcard that isn't in the book yet, The Wire pays its fee, the
// shot in your phone Gallery is stamped with the postcard's name,
// and the print joins the Postcard Wall in the Northgate Loft.
//
// HOW DETECTION WORKS — stated plainly, here and in the phone app:
// there is NO image recognition. The game cannot see your picture.
// At the shutter press the capture pipeline (App.tsx PhotoCapture)
// hands this module what it actually knows: the camera's position
// and facing (the real three.js camera), the game clock, the
// weather state, your wanted level, and the dolphin pod's live
// positions (game/wildlife.ts POD_MEMBERS). Each postcard's `test`
// below is the whole truth about what is checked — where you
// stood, which way the camera pointed, and the conditions at that
// moment. Frame the subject because it's a better photo, not
// because a computer verified the pixels.
//
// This module is deliberately separate from the mission photo
// machinery (GameSystems' photoArm / G.lastPhotoAt): postcards
// never read or write mission state, and mission photos never read
// postcards. A shutter press can satisfy both at once, harmlessly.
//
// Persistence: "harborfall-postcards" — per-slot automatically via
// the Phase 14 slot-prefix layer, and NG+ never touches the key,
// so a completed set survives the reset like the Slide career
// record and the Sable Cup (game/slide.ts / game/cup.ts pattern).
import { G } from "./store";
import { POD, POD_MEMBERS } from "./wildlife";
import { BRIDGE } from "../world";
import { pushPhoneMsg } from "./phone";
import { pushNews } from "./feed";

/** What the capture pipeline knows at the shutter press: the
 * camera's horizontal position and facing (unit vector, y-up
 * world, forward = (sin h, cos h) convention projected flat). */
export interface ShotCam { x: number; z: number; fx: number; fz: number; }

/** The game clock as an hour float, 0–24 (the formula every other
 * system uses: economy.ts gameHourNow / rhythm.ts gameHourFloat). */
export const postcardHour = () => (G.dayTime * 24 + 6) % 24;
/** Golden windows, in clock terms the player can watch: the first
 * light after the 06:00 day start, and the evening fall. */
export const isGoldenHour = (h: number) => (h >= 6 && h <= 8.5) || (h >= 17 && h <= 19.5);
/** The game's own night (economy.ts isNightNow's rule). */
export const isNightHour = (h: number) => h >= 20 || h < 6;
/** Club Solace's door hours (game/club.ts: 20:00–04:00) — the neon
 * trades while the club does. */
export const isClubHour = (h: number) => h >= 20 || h < 4;

const BRIDGE_C = { x: BRIDGE.x, z: (BRIDGE.z0 + BRIDGE.z1) / 2 }; // (60, 162)
const SIGN_POS = { x: 0, z: -126 };       // the hillside sign plane (World.tsx)
const CLUB_POS = { x: 44, z: 117 };       // Club Solace exterior (world.ts STATIC_BLOCKERS)
const BAY_C = { x: 0, z: 155 };           // the harbour bay's middle
const DOME_POS = { x: 8, z: -354 };       // Northreach observatory (northreachData.ts blockers)
const BREAKWATER_POS = { x: -189, z: 12 }; // = westbrookData's WESTBROOK_VIEWPOINT, as a literal:
// postcards is base-bundle and westbrookData belongs to the lazy
// Westbrook chunk; audit section 12 pins this literal to the data
// module so the two can never drift apart.

const within = (cam: ShotCam, x: number, z: number, r: number) =>
  (cam.x - x) ** 2 + (cam.z - z) ** 2 <= r * r;
/** Camera facing a point: the flat dot of the camera forward with
 * the direction to the point. Standing on top of the subject
 * (within 10u) always counts — you can't frame what's under you. */
function facingToward(cam: ShotCam, x: number, z: number, minDot: number): boolean {
  const dx = x - cam.x, dz = z - cam.z;
  const d = Math.hypot(dx, dz);
  if (d < 10) return true;
  return (cam.fx * dx + cam.fz * dz) / d >= minDot;
}

export interface PostcardDef {
  id: string;
  name: string;
  fee: number;
  /** The framed print's colour on the Loft wall (teal/amber family). */
  color: string;
  /** Short instruction — phone list + the Photo Mode hint line. */
  hint: string;
  /** Plain-language statement of the actual check (phone list). */
  check: string;
  /** Where the subject lives, for the "nearest incomplete" hint.
   * null = no fixed place (the pod moves; air support is wherever
   * you are) — the hint falls back to these only when no anchored
   * postcard is left. */
  anchor: { x: number; z: number } | null;
  test: (cam: ShotCam) => boolean;
}

export const POSTCARD_DEFS: PostcardDef[] = [
  {
    id: "the-pod", name: "The Pod, Breaching", fee: 150, color: "#3f7fae",
    hint: "Catch a dolphin mid-breach — pod works the bay loop",
    check: "A dolphin above the surface, within 55u, inside the camera's central cone at the shutter press.",
    anchor: null,
    test: (cam) => POD_MEMBERS.some((m) => m.y > 0.08 && within(cam, m.x, m.z, 55) && facingToward(cam, m.x, m.z, 0.7)),
  },
  {
    id: "air-support", name: "Air Support", fee: 150, color: "#8a3324",
    hint: "Shoot with the police helicopter up — 4★ or more",
    check: "Your wanted level is 4★+ at the shutter press. At 4★ the heli is always on you (GameSystems keeps it airborne) — the check is the wanted level itself; there is no separate heli spotting.",
    anchor: null,
    test: () => G.wanted >= 4,
  },
  {
    id: "storm-harbour", name: "Storm over the Harbour", fee: 125, color: "#54686e",
    hint: "Shoot the bay while a storm is on (weather: Storm)",
    check: "The weather state is Storm and the camera is within 110u of the bay's middle. The sky is the subject — no facing check.",
    anchor: BAY_C,
    test: (cam) => G.weather === "Storm" && within(cam, BAY_C.x, BAY_C.z, 110),
  },
  {
    id: "golden-span", name: "Golden Span", fee: 120, color: "#e8a34c",
    hint: "The bay bridge in golden light — 06:00–08:30 or 17:00–19:30",
    check: "Golden hour on the game clock, camera within 80u of the bridge's centre, facing it.",
    anchor: BRIDGE_C,
    test: (cam) => isGoldenHour(postcardHour()) && within(cam, BRIDGE_C.x, BRIDGE_C.z, 80) && facingToward(cam, BRIDGE_C.x, BRIDGE_C.z, 0.35),
  },
  {
    id: "breakwater-gold", name: "Breakwater Gold", fee: 110, color: "#d99a3d",
    hint: "Breakwater Point (Westbrook) in golden light — 06:00–08:30 or 17:00–19:30",
    check: "Golden hour on the game clock and the camera within 40u of the Breakwater Point viewpoint pad. A place-and-time postcard — no facing check.",
    anchor: BREAKWATER_POS,
    test: (cam) => isGoldenHour(postcardHour()) && within(cam, BREAKWATER_POS.x, BREAKWATER_POS.z, 40),
  },
  {
    id: "club-neon", name: "Solace Neon", fee: 100, color: "#1f7a72",
    hint: "Club Solace's frontage while the club trades — 20:00–04:00",
    check: "Club hours on the game clock, camera within 45u of the club's frontage, facing it.",
    anchor: CLUB_POS,
    test: (cam) => isClubHour(postcardHour()) && within(cam, CLUB_POS.x, CLUB_POS.z, 45) && facingToward(cam, CLUB_POS.x, CLUB_POS.z, 0.45),
  },
  {
    id: "sign-at-night", name: "The Sign at Night", fee: 100, color: "#14524f",
    hint: "The PORT SABLE hillside sign after dark — 20:00–06:00",
    check: "Night on the game clock, camera within 110u of the sign, facing it.",
    anchor: SIGN_POS,
    test: (cam) => isNightHour(postcardHour()) && within(cam, SIGN_POS.x, SIGN_POS.z, 110) && facingToward(cam, SIGN_POS.x, SIGN_POS.z, 0.5),
  },
  {
    id: "the-dome", name: "The Dome", fee: 125, color: "#2e4a5a",
    hint: "Northreach's observatory dome — any hour",
    check: "Camera within 55u of the observatory, facing it. Any hour, any weather.",
    anchor: DOME_POS,
    test: (cam) => within(cam, DOME_POS.x, DOME_POS.z, 55) && facingToward(cam, DOME_POS.x, DOME_POS.z, 0.5),
  },
];

// ---- state + persistence ----------------------------------------
const KEY = "harborfall-postcards";
export const POSTCARDS_EVENT = "harborfall-postcards-changed";
export const POSTCARDS = { done: {} as Record<string, boolean> };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const parsed = JSON.parse(raw) as { done?: Record<string, unknown> };
    if (parsed && typeof parsed === "object" && parsed.done) {
      for (const d of POSTCARD_DEFS) if (parsed.done[d.id] === true) POSTCARDS.done[d.id] = true;
    }
  }
} catch { /* fresh book */ }
export function persistPostcards() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ done: POSTCARDS.done }));
    window.dispatchEvent(new CustomEvent(POSTCARDS_EVENT));
  } catch { /* quota / headless — the in-memory book still counts */ }
}
export const postcardsDoneCount = () => POSTCARD_DEFS.reduce((n, d) => n + (POSTCARDS.done[d.id] ? 1 : 0), 0);
export const postcardSetComplete = () => postcardsDoneCount() >= POSTCARD_DEFS.length;

/** The first postcard (in desk order) this shutter press satisfies
 * that isn't already in the book — one completion per press, so a
 * stormy golden hour over the bridge banks one and leaves the
 * other for the next shot. Null when nothing new is satisfied. */
export function evaluatePostcardShot(cam: ShotCam): PostcardDef | null {
  for (const d of POSTCARD_DEFS) {
    if (POSTCARDS.done[d.id]) continue;
    if (d.test(cam)) return d;
  }
  return null;
}

/** Bank a completed postcard: mark it, persist it, pay the fee and
 * let The Wire say so. The caller (App's PhotoCapture) stamps the
 * Gallery entry with def.name and flushes the cash persist. */
export function completePostcard(def: PostcardDef): { setComplete: boolean } {
  POSTCARDS.done[def.id] = true;
  persistPostcards();
  G.cash += def.fee; G.lifetimeEarned += def.fee;
  const left = POSTCARD_DEFS.length - postcardsDoneCount();
  if (left > 0) {
    pushPhoneMsg("The Wire — Picture Desk", `Bought your shot: “${def.name}.” $${def.fee} wired to you. ${left} postcard${left === 1 ? "" : "s"} still open — the list's in your Gallery app.`);
  } else {
    pushPhoneMsg("The Wire — Picture Desk", `Bought your shot: “${def.name}” — $${def.fee}, and that's the FULL SET. The framed prints are up on your Postcard Wall at the Northgate Loft. Port Sable, all eight of her.`);
    pushNews("THE SABLE POSTCARDS: A FULL SET", "The Wire's picture desk has bought the last of the eight Sable Postcards. Bridge at golden hour, the pod mid-breach, the sign after dark, a storm over the harbour — the whole town, shot by one pair of eyes. The framed set hangs at the Northgate Loft.");
  }
  return { setComplete: left === 0 };
}

/** The nearest incomplete postcard for the Photo Mode hint line:
 * anchored postcards by distance from the player (the pod's anchor
 * is its live position); anchorless ones (air support) surface
 * only when nothing anchored is left. Null when the set is done. */
export function nearestPostcardHint(): PostcardDef | null {
  let best: PostcardDef | null = null; let bestD = Infinity;
  let anchorless: PostcardDef | null = null;
  for (const d of POSTCARD_DEFS) {
    if (POSTCARDS.done[d.id]) continue;
    const a = d.anchor ?? (d.id === "the-pod" ? POD : null);
    if (!a) { anchorless ??= d; continue; }
    const dist = (G.playerPos.x - a.x) ** 2 + (G.playerPos.z - a.z) ** 2;
    if (dist < bestD) { bestD = dist; best = d; }
  }
  return best ?? anchorless;
}
