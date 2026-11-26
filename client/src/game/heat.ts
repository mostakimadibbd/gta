// Harborfall — Phase 29: EVIDENCE & HEAT (the patrol's file on you).
//
// Until now the patrol only ever reacted to the crime in front of it:
// stars rose, stars fell, and yesterday's rampage was forgotten. Now
// every crime the patrol LEARNS ABOUT leaves EVIDENCE — a per-slot
// file (0..100, persisted as harborfall-heat) that makes the law's
// memory longer than one chase:
//
//   · GAIN — evidence is added inside store.applyCrime, the single
//     choke point where a crime becomes known (instantly-known kinds
//     at once; quiet crimes when the witness report lands). Severity:
//     ped 20 · shoot 15 · robbery 15 · assault 10 · steal 8 ·
//     theft 6 · hit 5 · reckless 4. applyCrime's own 4 s crime
//     cooldown throttles repeat gains, as it throttles the stars.
//   · WANTED FLOOR — floor = min(3, floor(evidence / 25)): at 25/50/75
//     evidence, the next reported crime starts the response at
//     1★/2★/3★ no matter how small the new crime is — the report is
//     matched to your file. Applied in applyCrime right after the
//     crime's own star maths, capped by the standing 6★ cap.
//   · LONGER SEARCHES — the unseen seconds needed to drop a star grow
//     from the standing 11 s to 11 + evidence × 0.08 s (19 s at a
//     full file). Consumed by GameSystems' star-drop check.
//   · DECAY — while you stay CLEAN (no evidence-adding crime for
//     30 s) and UNSEEN (no cop line-of-sight; trivially true at
//     0 stars), the file thins at 1 pt per 4 s. A FRESH LOOK — a
//     change of clothes at a wardrobe or Thread & Tide, a cut or trim
//     at Sable Cuts — runs the decay at 4× for 120 s.
//   · BUSTED / WASTED halves the file (you did some time). The
//     $100 surrender does NOT halve it — you paid a fine, you didn't
//     serve anything; that distinction is deliberate.
//   · THE FIXER — Marek Doss (Contacts, post-Ch.2) burns the whole
//     file: cost = max($250, $150 + $6×evidence + $200×wanted),
//     clears all evidence and any wanted level, once per in-game
//     day (ECO day serial), and NEVER while a cop has eyes on you.
//
// DISGUISE HONESTY (Phase 29 check, Part B.3): nothing in this game
// models identity. Police LOS keys on distance + building occlusion,
// witness memory keys on the witnessed EVENT (Ped.memWitnessUntil),
// ped recognition keys on that event memory and district reputation —
// never on the player's outfit, haircut or character preset. The
// Phase 6 "disguise-lite" is a car/district swap while unseen. A
// fresh look therefore does exactly ONE thing here — it thins the
// evidence file faster. It does not reset anyone's recognition,
// because there is no appearance-based recognition to reset. The
// docs say this plainly (BLUEPRINT §15.6 + the phone Stats note).
import { G, bark, type CrimeKind } from "./store";
import { pushNews } from "./feed";

export const HEAT = {
  evidence: 0, // 0..100
  fixerDay: -1, // ECO.daySerial of the last paid bribe (-1 = never)
  headlineStage: 0, // highest Wire threshold fired this climb: 0 | 50 | 90
  // ---- session-only (G.timeS is a session clock; none of these
  // survive a reload, by design) ----
  lastCrimeAt: -9999, // G.timeS of the last evidence-adding crime
  freshLookUntil: 0, // G.timeS until which decay runs at 4×
  floorBarkAt: -9999, // G.timeS of the last floor-application bark
  decayCarry: 0, // fractional decay accumulator
};

const HEAT_KEY = "harborfall-heat";
try {
  const raw = localStorage.getItem(HEAT_KEY);
  if (raw) {
    const p = JSON.parse(raw) as Partial<typeof HEAT>;
    HEAT.evidence = Math.max(0, Math.min(100, Math.floor(p.evidence ?? 0) || 0));
    HEAT.fixerDay = typeof p.fixerDay === "number" ? p.fixerDay : -1;
    HEAT.headlineStage = p.headlineStage === 50 || p.headlineStage === 90 ? p.headlineStage : 0;
  }
} catch { /* one bad key never blocks the rest — fresh file */ }
export function persistHeat() {
  try {
    localStorage.setItem(HEAT_KEY, JSON.stringify({ evidence: HEAT.evidence, fixerDay: HEAT.fixerDay, headlineStage: HEAT.headlineStage }));
  } catch { /* ignore */ }
}

/** Evidence per crime kind, by severity (see the header). */
export const EVIDENCE_PER_CRIME: Record<CrimeKind, number> = {
  ped: 20, shoot: 15, robbery: 15, assault: 10, steal: 8, theft: 6, hit: 5, reckless: 4,
};

/** The wanted floor your file sets: 25 → 1★, 50 → 2★, 75+ → 3★. */
export const evidenceFloor = () => Math.min(3, Math.floor(HEAT.evidence / 25));

/** Unseen seconds before a star drops: 11 s + 0.08 s per point. */
export const searchSeconds = () => 11 + HEAT.evidence * 0.08;

/** Called from store.applyCrime — the crime became known just now. */
export function addEvidence(kind: CrimeKind) {
  HEAT.lastCrimeAt = G.timeS;
  const before = HEAT.evidence;
  HEAT.evidence = Math.min(100, HEAT.evidence + (EVIDENCE_PER_CRIME[kind] ?? 0));
  if (HEAT.evidence === before) return;
  // Wire flavour at the two high thresholds — once per climb; the
  // stage clears when the file thins below 25 (see tickHeat), so a
  // later climb can be news again.
  if (HEAT.evidence >= 90 && HEAT.headlineStage < 90) {
    HEAT.headlineStage = 90;
    pushNews("Harbour Wire: THE FILE WITH NO FACE", "The patrol's evidence board is nearly full and the harbour ghost is still walking the waterfront. \"We know everything except who,\" one detective admits. Time and quiet thin any file, the Wire notes — noise and headlines only thicken it.");
  } else if (HEAT.evidence >= 50 && HEAT.headlineStage < 50) {
    HEAT.headlineStage = 50;
    pushNews("Harbour Wire: HARBOUR GHOST STILL AT LARGE", "Fifty points of evidence, the patrol says — sightings, statements, camera stills — and still no name they can put in a cell. Port Sable's most-wanted nobody keeps his face turned away from the harbour light.");
  }
  persistHeat();
}

/** Called from store.applyCrime after the crime's own star maths:
 * the response can never start below your file's floor. */
export function applyEvidenceFloor() {
  const fl = evidenceFloor();
  if (fl <= G.wanted) return;
  G.wanted = Math.min(6, fl);
  if (G.timeS - HEAT.floorBarkAt > 60) {
    HEAT.floorBarkAt = G.timeS;
    bark("Dispatch", "All units — that report matches the harbour file. Repeat offender. Moving in.");
  }
}

/** 1 Hz decay tick (GameSystems). `seen` is the police LOS result. */
export function tickHeat(dt: number, seen: boolean) {
  if (HEAT.headlineStage > 0 && HEAT.evidence < 25) { HEAT.headlineStage = 0; persistHeat(); }
  if (HEAT.evidence <= 0) { HEAT.decayCarry = 0; return; }
  if (seen) return; // eyes on you: the file is being ADDED to, not thinned
  if (G.timeS - HEAT.lastCrimeAt < 30) return; // not clean yet
  const rate = G.timeS < HEAT.freshLookUntil ? 4 : 1; // fresh look: 4×
  HEAT.decayCarry += (dt * rate) / 4; // base rate: 1 pt per 4 s
  const whole = Math.floor(HEAT.decayCarry);
  if (whole > 0) {
    HEAT.decayCarry -= whole;
    HEAT.evidence = Math.max(0, HEAT.evidence - whole);
    persistHeat();
  }
}

/** A change of clothes or a barber visit: decay runs 4× for 120 s.
 * Callers append FRESH_LOOK_SUFFIX to their toast when it matters. */
export function noteFreshLook() { HEAT.freshLookUntil = G.timeS + 120; }
export const FRESH_LOOK_SUFFIX = " Fresh look — your patrol file thins faster for a while.";

/** Busted / Wasted: you did some time — half the file is served. */
export function halveEvidence() {
  if (HEAT.evidence <= 0) return;
  HEAT.evidence = Math.floor(HEAT.evidence / 2);
  persistHeat();
}

/** The Fixer's price: max($250, $150 + $6×evidence + $200×wanted). */
export const bribeCost = () => Math.max(250, 150 + HEAT.evidence * 6 + G.wanted * 200);

/** Settle a paid bribe (App's contact handler has already run the
 * refusal chain: chapter gate, cooldown, nothing-to-fix, LOS, funds).
 * Burns the file, stands the patrol down, buries in-flight witness
 * reports, and stamps the day. Returns the price paid. */
export function applyBribe(daySerial: number): number {
  const cost = bribeCost();
  G.cash -= cost;
  HEAT.evidence = 0;
  HEAT.fixerDay = daySerial;
  HEAT.decayCarry = 0;
  HEAT.lastCrimeAt = -9999;
  G.wanted = 0; G.starHeat = 0; G.wantedCooldown = 0; G.bustTimer = 0;
  G.pendingCrimes = []; G.reportingPed = -1; G.copSeen = false;
  for (const c of G.cops) c.active = false;
  persistHeat();
  return cost;
}

/** NG+: a fresh run starts with a clean file and a Fixer who has
 * never met you (ngplus.ts calls this with the story reset). */
export function resetHeat() {
  HEAT.evidence = 0; HEAT.fixerDay = -1; HEAT.headlineStage = 0;
  HEAT.lastCrimeAt = -9999; HEAT.freshLookUntil = 0; HEAT.floorBarkAt = -9999; HEAT.decayCarry = 0;
  persistHeat();
}
