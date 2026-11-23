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
  side: { lina: 0, voss: 0 } as Record<"lina" | "voss", number>,
  choice: "" as "" | "voss" | "elias",
};
try {
  M.storyIndex = Math.min(6, Number(localStorage.getItem("harborfall-story") ?? 0) || 0);
  M.storyDone = localStorage.getItem("harborfall-story-done") === "1";
  const sideRaw = localStorage.getItem("harborfall-side");
  if (sideRaw) { const s = JSON.parse(sideRaw) as Partial<typeof M.side>; M.side.lina = Math.min(3, s.lina ?? 0); M.side.voss = Math.min(3, s.voss ?? 0); }
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
    if (M.choice) localStorage.setItem("harborfall-choice", M.choice);
  } catch { /* ignore */ }
}
/** Ch.6 pays out differently when Rayan warned Elias (Ch.5 choice). */
export function effectivePayout(def: MissionDef): number {
  return def.payoutAlt && M.choice === "elias" ? def.payoutAlt : def.payout;
}
export function currentTarget(): [number, number] | null {
  if (!M.active || M.phase !== "play") return null;
  return M.active.targets[M.step] ?? null;
}
export function startPlay(def: MissionDef) {
  M.active = def; M.step = 0; M.timer = def.timeLimit; M.phase = "play"; M.collected = new Set();
  pushPhoneMsg(def.giver, `${def.title}: ${def.objectiveText} (pays $${effectivePayout(def)})`);
  if (def.forceWanted) { G.wanted = Math.max(G.wanted, def.forceWanted); G.wantedCooldown = 0; }
  const t = currentTarget();
  G.objective = t ? { x: t[0], z: t[1], label: def.objectiveText, kind: def.kind } : { x: 0, z: 0, label: def.objectiveText, kind: def.kind };
}
export function endMission() {
  M.active = null; M.phase = "idle"; M.step = 0; G.objective = null;
}
