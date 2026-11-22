import type { MissionDef } from "./missions";
import { G } from "./store";

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
};
try {
  M.storyIndex = Math.min(6, Number(localStorage.getItem("harborfall-story") ?? 0) || 0);
  M.storyDone = localStorage.getItem("harborfall-story-done") === "1";
  const cash = Number(localStorage.getItem("harborfall-cash") ?? NaN);
  if (Number.isFinite(cash)) G.cash = cash;
} catch { /* storage unavailable */ }
export function persist() {
  try {
    localStorage.setItem("harborfall-story", String(M.storyIndex));
    localStorage.setItem("harborfall-story-done", M.storyDone ? "1" : "0");
    localStorage.setItem("harborfall-cash", String(G.cash));
  } catch { /* ignore */ }
}
export function currentTarget(): [number, number] | null {
  if (!M.active || M.phase !== "play") return null;
  return M.active.targets[M.step] ?? null;
}
export function startPlay(def: MissionDef) {
  M.active = def; M.step = 0; M.timer = def.timeLimit; M.phase = "play"; M.collected = new Set();
  if (def.forceWanted) { G.wanted = Math.max(G.wanted, def.forceWanted); G.wantedCooldown = 0; }
  const t = currentTarget();
  G.objective = t ? { x: t[0], z: t[1], label: def.objectiveText, kind: def.kind } : { x: 0, z: 0, label: def.objectiveText, kind: def.kind };
}
export function endMission() {
  M.active = null; M.phase = "idle"; M.step = 0; G.objective = null;
}
