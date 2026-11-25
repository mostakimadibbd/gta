// Harborfall — Phase 23: CLUB SOLACE, A WORKING NIGHTCLUB.
//
// The Phase 3 pocket room was a shell — a stage, a painted bar and
// four dancers, open at all hours to anyone. Phase 23 makes it a
// venue, on the same pocket-interior pattern as every other room:
//
//   · DOORS 20:00–04:00. Outside those hours the door is locked
//     (the Thread & Tide door rule, after dark instead of before).
//   · A BOUNCER works the door (rendered in World.tsx beside the
//     queue): at wanted 3★+ he turns you away with a bark — the
//     club doesn't harbour anyone the patrol is actively hunting.
//     Inside, wanted behaves exactly as it does in every other
//     interior (no special club rule): you can't be busted in the
//     pocket, and heat bleeds while you're unseen, as elsewhere.
//   · THE BAR sells one drink — the Harbour Sunset, $12: a small
//     stamina restore and a brief warm screen vignette. COSMETIC
//     ONLY, stated here and in the docs: there is no drunkenness
//     physics, no driving penalty, no stat change beyond stamina.
//   · THE FLOOR is a 6×4 tile grid cycling slowly between teal and
//     amber (the house palette — no pink/purple, ever), and the
//     room runs 7 dancers on the existing rig's sway.
//   · THE BASS is a small original WebAudio loop (game/audio.ts
//     startClubBass) that runs only while you're inside.
//
// The club-share business tie-in lives in game/economy.ts: owning
// the Club Solace share adds a Fri/Sat-night door bonus inside
// businessDailyNet (single-sourced, like every other term there).

/** Club hours: doors at 20:00, last entry long gone by 04:00. */
export const CLUB_OPEN_HOUR = 20;
export const CLUB_CLOSE_HOUR = 4;
export const isClubOpen = (hour: number) => hour >= CLUB_OPEN_HOUR || hour < CLUB_CLOSE_HOUR;

// Phase 24 audit — CLOSING TIME, DEFINED. The Phase 23 build gated
// ENTRY by the hours but never said what happens to someone already
// inside at 04:00. The rule now (mirroring how Thread & Tide treats
// its own hours from inside): the doors lock at 04:00 — nobody new
// gets in — and the BAR stops serving ("last orders were at four"),
// but nobody is thrown out: the floor, the bass and the exit door
// keep working until you choose to leave, and re-entry is gated as
// usual. The bartender calls it once when the hour turns (see
// Interiors.tsx). No ejection teleport, ever — a pocket interior
// has no safe "outside at 4am mid-dance" state worth forcing.

/** The one drink on the menu. */
export const CLUB_DRINK_NAME = "Harbour Sunset";
export const CLUB_DRINK_PRICE = 12;
export const CLUB_DRINK_STAMINA = 30;
/** Seconds of warm vignette after a drink (cosmetic only). */
export const CLUB_DRINK_WARM_S = 20;
