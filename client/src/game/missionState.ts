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
  side: { lina: 0, voss: 0, heist: 0, after: 0 } as Record<"lina" | "voss" | "heist" | "after", number>,
  choice: "" as "" | "voss" | "elias",
  // ---- Phase 9: the post-story pack's own branching choice ----
  packChoice: "" as string,
  // ---- Phase 7: checkpoints, replay, per-mission stats, heist prep ----
  checkpointStep: 0, // furthest step reached this attempt (retry point)
  lastFailed: null as null | { def: MissionDef; step: number }, // R = retry from checkpoint
  replayId: "", // mission id being replayed for 40% (never advances progress)
  heistClean: false, // heist prep finished unseen → strongroom bonus
  stats: {} as Record<string, { attempts: number; best: number }>, // best = fastest seconds
};
try {
  M.storyIndex = Math.min(6, Number(localStorage.getItem("harborfall-story") ?? 0) || 0);
  M.storyDone = localStorage.getItem("harborfall-story-done") === "1";
  const sideRaw = localStorage.getItem("harborfall-side");
  if (sideRaw) { const s = JSON.parse(sideRaw) as Partial<typeof M.side>; M.side.lina = Math.min(3, s.lina ?? 0); M.side.voss = Math.min(3, s.voss ?? 0); M.side.heist = Math.min(2, s.heist ?? 0); M.side.after = Math.min(3, s.after ?? 0); }
  M.packChoice = localStorage.getItem("harborfall-packchoice") ?? "";
  M.heistClean = localStorage.getItem("harborfall-heistclean") === "1";
  const mstats = localStorage.getItem("harborfall-mstats");
  if (mstats) M.stats = JSON.parse(mstats) as typeof M.stats;
  const ch = localStorage.getItem("harborfall-choice");
  if (ch === "voss" || ch === "elias") M.choice = ch;
  const cash = Number(localStorage.getItem("harborfall-cash") ?? NaN);
  if (Number.isFinite(cash)) G.cash = cash;
  G.lifetimeEarned = Number(localStorage.getItem("harborfall-earned") ?? 0) || 0;
  G.finesPaid = Number(localStorage.getItem("harborfall-fines") ?? 0) || 0;
} catch { /* storage unavailable */ }
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
  } catch { /* ignore */ }
}
/** Phase 9: is this mission's ALT branch active? Ch.5 keys off M.choice;
 * post-story pack missions key off M.packChoice via def.altFlag. */
export function altActive(def: MissionDef): boolean {
  if (def.id === "s5" || def.id === "s6") return M.choice === "elias";
  return !!def.altFlag && M.packChoice === def.altFlag;
}
/** Ch.6 pays out differently when Rayan warned Elias (Ch.5 choice).
 * Phase 7: replays pay 40%; the heist pays prep-quality bonuses. */
export function effectivePayout(def: MissionDef): number {
  let pay = def.payoutAlt && altActive(def) ? def.payoutAlt : def.payout;
  if (def.id === "heist1" && G.wanted === 0) pay += 150; // unseen prep bonus
  if (def.id === "heist2" && M.heistClean) pay += 400; // clean prep pays off
  if (M.replayId === def.id) pay = Math.round(pay * 0.4);
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
export function currentTarget(): [number, number] | null {
  if (!M.active || M.phase !== "play") return null;
  return M.active.targets[M.step] ?? null;
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
export function startPlayAt(def: MissionDef, step: number) {
  M.active = def; M.step = step; M.timer = def.timeLimit; M.phase = "play";
  M.collected = new Set(Array.from({ length: step }, (_, i) => i));
  M.checkpointStep = step;
  pushPhoneMsg(def.giver, `${def.title} — retry from checkpoint ${step + 1}. Clock refreshed.`);
  if (def.forceWanted) { G.wanted = Math.max(G.wanted, def.forceWanted); G.wantedCooldown = 0; }
  const t = currentTarget();
  G.objective = t ? { x: t[0], z: t[1], label: def.objectiveText, kind: def.kind } : { x: 0, z: 0, label: def.objectiveText, kind: def.kind };
}
export function endMission() {
  M.active = null; M.phase = "idle"; M.step = 0; G.objective = null;
}
