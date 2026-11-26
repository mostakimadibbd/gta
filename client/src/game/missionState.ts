import type { MissionDef } from "./missions";
import { G } from "./store";
import { pushPhoneMsg } from "./phone";

export const M = {
  active: null as MissionDef | null,
  step: 0,
  timer: 0,
  phase: "idle" as "idle" | "intro" | "play" | "outro",
  storyIndex: 0,
  storyDone: false,
  repeatIndex: 0,
  collected: new Set<number>(),
  failedReason: "",
  // ---- Phase 5: side-arc progress + the Ch.5 choice (persisted) ----
  side: { lina: 0, voss: 0, heist: 0, after: 0, wire: 0, ledger: 0, quiet: 0, crown: 0 } as Record<"lina" | "voss" | "heist" | "after" | "wire" | "ledger" | "quiet" | "crown", number>,
  choice: "" as "" | "voss" | "elias",
  // ---- Phase 9: the post-story pack's own branching choice ----
  packChoice: "" as string,
  // ---- Phase 27: THE LEDGER LINE's finale choice — its OWN flag
  // pair (the Meridian Pair pattern, not the shared packChoice:
  // After the Fall already spends packChoice on a burn/publish call
  // with the same flag words, and the two decisions must never read
  // each other). ledgerChoice locks the moment the player decides
  // (the other branch can never be taken); ledgerDone records the
  // completion, so a failed attempt re-offers the SAME branch. ----
  ledgerChoice: "" as "" | "ledger-burn" | "ledger-publish",
  ledgerDone: false,
  // ---- Phase 48: THE HARBOUR CROWN's auction choice — its OWN flag
  // pair again (the Ledger pattern): crownChoice locks at decision
  // time, crownDone records the completion (consequences fire once,
  // a failed attempt re-offers the SAME branch). crownPaid records
  // that the buy-out branch's $40,000 escrow was actually wired at
  // decision time (resolveChoice) — the +10% empire dividend in
  // businessDailyNet requires choice + done + paid, and a checkpoint
  // retry can never charge twice. crownCarDelivered records the
  // finale's Sovereign delivery (game/crown.ts) so a replay or a
  // second NG+ run can never mint a duplicate. ----
  crownChoice: "" as "" | "crown-buyout" | "crown-expose",
  crownDone: false,
  crownPaid: false,
  crownCarDelivered: false,
  // ---- Phase 15: mutually-exclusive side pair lock (see load below)
  pairChoice: "" as "" | "informant" | "dockcrew",
  // ---- Phase 16 audit fix: pairChoice is set when a branch STARTS,
  // but Phase 15 never recorded completion — and a failed/abandoned
  // attempt (lastFailed is memory-only, gone after a reload) could
  // never be restarted, because the phone-call gate required
  // !pairChoice. pairDone separates "locked the other branch" from
  // "finished mine": an unfinished branch can be re-offered by its
  // own giver (see App's contact handler). ----
  pairDone: false,
  // ---- Phase 7: checkpoints, replay, per-mission stats, heist prep ----
  checkpointStep: 0, // furthest step reached this attempt (retry point)
  // Phase 18: the failed attempt's REAL collected set rides along —
  // startPlayAt used to rebuild it as {0..step-1}, which for the tail
  // mission (stops can bank out of order after a missed loop) credited
  // stops never confirmed. The snapshot is exact.
  lastFailed: null as null | { def: MissionDef; step: number; collected?: number[] }, // R = retry from checkpoint
  replayId: "", // mission id being replayed for 40% (never advances progress)
  heistClean: false, // heist prep finished unseen → strongroom bonus
  stats: {} as Record<string, { attempts: number; best: number }>, // best = fastest seconds
};
// Phase 15 playability: per-key guards, same reasoning as store.ts —
// one corrupt JSON (side/mstats were parsed mid-block) used to skip
// the cash + story loads below it, booting the player "broke at
// Chapter 1" despite a healthy save sitting in storage.
const loadKey = (fn: () => void) => { try { fn(); } catch { /* one bad key never blocks the rest */ } };
loadKey(() => { M.storyIndex = Math.min(6, Number(localStorage.getItem("harborfall-story") ?? 0) || 0); });
loadKey(() => { M.storyDone = localStorage.getItem("harborfall-story-done") === "1"; });
loadKey(() => {
  const sideRaw = localStorage.getItem("harborfall-side");
  if (sideRaw) { const s = JSON.parse(sideRaw) as Partial<typeof M.side>; M.side.lina = Math.min(3, s.lina ?? 0); M.side.voss = Math.min(3, s.voss ?? 0); M.side.heist = Math.min(2, s.heist ?? 0); M.side.after = Math.min(3, s.after ?? 0); M.side.wire = Math.min(3, s.wire ?? 0); M.side.ledger = Math.min(3, s.ledger ?? 0); M.side.quiet = Math.min(3, s.quiet ?? 0); M.side.crown = Math.min(4, s.crown ?? 0); }
});
loadKey(() => { M.packChoice = localStorage.getItem("harborfall-packchoice") ?? ""; });
loadKey(() => { M.heistClean = localStorage.getItem("harborfall-heistclean") === "1"; });
loadKey(() => { const mstats = localStorage.getItem("harborfall-mstats"); if (mstats) M.stats = JSON.parse(mstats) as typeof M.stats; });
loadKey(() => { const ch = localStorage.getItem("harborfall-choice"); if (ch === "voss" || ch === "elias") M.choice = ch; });
loadKey(() => { const cash = Number(localStorage.getItem("harborfall-cash") ?? NaN); if (Number.isFinite(cash)) G.cash = cash; });
loadKey(() => { G.lifetimeEarned = Number(localStorage.getItem("harborfall-earned") ?? 0) || 0; });
loadKey(() => { G.finesPaid = Number(localStorage.getItem("harborfall-fines") ?? 0) || 0; });
// ---- Phase 15: the mutually-exclusive side pair (post-Ch.3) — which
// branch the player took ("informant" | "dockcrew"), persisted so the
// other mission stays locked for this playthrough (per save slot) ----
loadKey(() => { const p = localStorage.getItem("harborfall-pairchoice"); if (p === "informant" || p === "dockcrew") M.pairChoice = p; });
loadKey(() => { M.pairDone = localStorage.getItem("harborfall-pairdone") === "1"; });
loadKey(() => { const p = localStorage.getItem("harborfall-ledgerchoice"); if (p === "ledger-burn" || p === "ledger-publish") M.ledgerChoice = p; });
loadKey(() => { M.ledgerDone = localStorage.getItem("harborfall-ledgerdone") === "1"; });
loadKey(() => { const p = localStorage.getItem("harborfall-crownchoice"); if (p === "crown-buyout" || p === "crown-expose") M.crownChoice = p; });
loadKey(() => { M.crownDone = localStorage.getItem("harborfall-crowndone") === "1"; });
loadKey(() => { M.crownPaid = localStorage.getItem("harborfall-crownpaid") === "1"; });
loadKey(() => { M.crownCarDelivered = localStorage.getItem("harborfall-crowncar") === "1"; });
// ---- Phase 20: NEW GAME+ level (per save slot). Lives here, with
// the rest of the mission state, so effectivePayout and the police
// systems can read the multipliers without an import cycle (the
// start action itself is game/ngplus.ts). Level 0 = a normal game.
// Effects, all capped: patrol cruise speed +6%/level (cap +18%),
// bust meter fill +10%/level (cap +30%), mission payouts +25%/level
// (uncapped — it is the reward side). ----
export const NGP = { level: 0 };
loadKey(() => { const n = Number(localStorage.getItem("harborfall-ngplus") ?? 0); if (Number.isFinite(n) && n > 0) NGP.level = Math.min(99, Math.floor(n)); });
export const ngCopMult = () => 1 + Math.min(0.18, 0.06 * NGP.level);
export const ngBustMult = () => 1 + Math.min(0.30, 0.10 * NGP.level);
export const ngPayoutMult = () => 1 + 0.25 * NGP.level;
export function persist() {
  try {
    localStorage.setItem("harborfall-story", String(M.storyIndex));
    localStorage.setItem("harborfall-story-done", M.storyDone ? "1" : "0");
    localStorage.setItem("harborfall-cash", String(G.cash));
    localStorage.setItem("harborfall-earned", String(G.lifetimeEarned));
    localStorage.setItem("harborfall-fines", String(G.finesPaid));
    localStorage.setItem("harborfall-side", JSON.stringify(M.side));
    localStorage.setItem("harborfall-heistclean", M.heistClean ? "1" : "0");
    localStorage.setItem("harborfall-mstats", JSON.stringify(M.stats));
    if (M.choice) localStorage.setItem("harborfall-choice", M.choice);
    if (M.packChoice) localStorage.setItem("harborfall-packchoice", M.packChoice);
    if (M.pairChoice) localStorage.setItem("harborfall-pairchoice", M.pairChoice);
    localStorage.setItem("harborfall-pairdone", M.pairDone ? "1" : "0");
    if (M.ledgerChoice) localStorage.setItem("harborfall-ledgerchoice", M.ledgerChoice);
    localStorage.setItem("harborfall-ledgerdone", M.ledgerDone ? "1" : "0");
    if (M.crownChoice) localStorage.setItem("harborfall-crownchoice", M.crownChoice);
    localStorage.setItem("harborfall-crowndone", M.crownDone ? "1" : "0");
    localStorage.setItem("harborfall-crownpaid", M.crownPaid ? "1" : "0");
    localStorage.setItem("harborfall-crowncar", M.crownCarDelivered ? "1" : "0");
    localStorage.setItem("harborfall-ngplus", String(NGP.level));
  } catch { /* ignore */ }
}
/** Phase 9: is this mission's ALT branch active? Ch.5 keys off M.choice;
 * post-story pack missions key off M.packChoice via def.altFlag. */
export function altActive(def: MissionDef): boolean {
  if (def.id === "s5" || def.id === "s6") return M.choice === "elias";
  // Phase 27: Ledger Line missions read their own choice flag.
  if (def.choiceKey === "ledger") return !!def.altFlag && M.ledgerChoice === def.altFlag;
  // Phase 48: the Harbour Crown's auction reads its own flag too.
  if (def.choiceKey === "crown") return !!def.altFlag && M.crownChoice === def.altFlag;
  return !!def.altFlag && M.packChoice === def.altFlag;
}
/** Phase 48: the Meridian buy-out is LIVE — the auction was decided
 * for the buy-out, the escrow was wired, and the mission completed.
 * game/economy.ts businessDailyNet reads this to apply the +10%
 * empire dividend inside the one net function (shown = paid). */
export const crownBuyoutLive = (): boolean => M.crownChoice === "crown-buyout" && M.crownDone && M.crownPaid;
/** Ch.6 pays out differently when Rayan warned Elias (Ch.5 choice).
 * Phase 7: replays pay 40%; the heist pays prep-quality bonuses. */
export function effectivePayout(def: MissionDef): number {
  let pay = def.payoutAlt && altActive(def) ? def.payoutAlt : def.payout;
  if (def.id === "heist1" && G.wanted === 0) pay += 150; // unseen prep bonus
  if (def.id === "heist2" && M.heistClean) pay += 400; // clean prep pays off
  if (M.replayId === def.id) pay = Math.round(pay * 0.4);
  // Phase 20: the NG+ reward side — +25% per level on the final
  // figure (replays included: a replay is still a mission payout).
  if (NGP.level > 0) pay = Math.round(pay * ngPayoutMult());
  return pay;
}
export function recordAttempt(id: string) {
  const s = (M.stats[id] ??= { attempts: 0, best: 0 });
  s.attempts += 1; persist();
}
export function recordBest(id: string, seconds: number) {
  const s = (M.stats[id] ??= { attempts: 0, best: 0 });
  if (seconds > 0 && (s.best === 0 || seconds < s.best)) { s.best = Math.round(seconds); persist(); }
}
/** Phase 27: the target list the ACTIVE branch of a mission uses —
 * targetsAlt when the mission's choice selected the alt branch
 * (the Ledger Line finale delivers to a different door per choice;
 * both lists have the same length by construction). */
export function activeTargets(def: MissionDef): [number, number][] {
  return def.targetsAlt && altActive(def) ? def.targetsAlt : def.targets;
}
export function currentTarget(): [number, number] | null {
  if (!M.active || M.phase !== "play") return null;
  return activeTargets(M.active)[M.step] ?? null;
}
export function startPlay(def: MissionDef) {
  M.active = def; M.step = 0; M.timer = def.timeLimit; M.phase = "play"; M.collected = new Set();
  M.checkpointStep = 0; M.lastFailed = null;
  pushPhoneMsg(def.giver, `${def.title}: ${def.objectiveText} (pays $${effectivePayout(def)})`);
  if (def.forceWanted) { G.wanted = Math.max(G.wanted, def.forceWanted); G.wantedCooldown = 0; }
  const t = currentTarget();
  G.objective = t ? { x: t[0], z: t[1], label: def.objectiveText, kind: def.kind } : { x: 0, z: 0, label: def.objectiveText, kind: def.kind };
}
/** Phase 7 checkpoint retry: re-enter play at a recorded step with a
 * refreshed timer, skipping the intro dialogue entirely. */
export function startPlayAt(def: MissionDef, step: number, collected?: number[]) {
  M.active = def; M.step = step; M.timer = def.timeLimit; M.phase = "play";
  // the App retry handler clears M.lastFailed before calling, so the
  // snapshot arrives as a parameter; the M.lastFailed read covers any
  // other caller
  const savedCollected = collected ?? (M.lastFailed && M.lastFailed.def === def ? M.lastFailed.collected : undefined);
  M.collected = savedCollected ? new Set(savedCollected) : new Set(Array.from({ length: step }, (_, i) => i));
  M.checkpointStep = step;
  pushPhoneMsg(def.giver, `${def.title} — retry from checkpoint ${step + 1}. Clock refreshed.`);
  if (def.forceWanted) { G.wanted = Math.max(G.wanted, def.forceWanted); G.wantedCooldown = 0; }
  const t = currentTarget();
  G.objective = t ? { x: t[0], z: t[1], label: def.objectiveText, kind: def.kind } : { x: 0, z: 0, label: def.objectiveText, kind: def.kind };
}
export function endMission() {
  M.active = null; M.phase = "idle"; M.step = 0; G.objective = null;
}
