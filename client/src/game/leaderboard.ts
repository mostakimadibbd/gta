// Harborfall — Phase 8 optional service sync (Python server, server/).
// When VITE_MULTIPLAYER_SERVER_URL is set, race results and economy
// snapshots are posted to the FastAPI service and the Jobs app can read
// the leaderboards back. Offline (the default) every call silently
// no-ops — the single-player game never depends on the server.
import { jobStats } from "./jobs";
import { ECO, dailyIncomeTotal } from "./economy";
import { G } from "./store";

const BASE = ((import.meta.env.VITE_MULTIPLAYER_SERVER_URL as string | undefined) ?? "").replace(/\/$/, "");
export const servicesOnline = () => BASE.length > 0;

/** The name service posts carry. Phase 49 marathon fix: this used
 * to read a "harborfall-mp-name" key that NOTHING in the game ever
 * wrote, so every leaderboard/economy post went out as the default
 * no matter what the player set. The one name the player owns is
 * the Phase 38 Settings field (G.settings.mpName — the same string
 * the WS join sends), so read it from there. */
function playerName(): string {
  return G.settings.mpName || "Rayan";
}

async function post(path: string, body: Record<string, unknown>): Promise<void> {
  if (!BASE) return;
  try {
    await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch { /* offline — the game carries on */ }
}

/** Post the player's best race time + lifetime job earnings. */
export function postRaceResult() {
  const bests = Object.values(jobStats.bestTimes).filter((v) => v > 0);
  if (!bests.length) return;
  const earned = jobStats.taxiEarned + jobStats.deliveryEarned + jobStats.towEarned;
  void post("/v1/leaderboards", { player: playerName(), race_best: Math.min(...bests), job_earned: earned });
}

/** Post an economy snapshot (business ownership + income audit). */
export function postEconomy() {
  void post("/v1/economy/snapshot", {
    player: playerName(),
    owned: [...ECO.owned],
    apartment: ECO.ownsApartment,
    day: ECO.daySerial,
    daily_income: dailyIncomeTotal(),
  });
}

export interface BoardEntry { name: string; value: number; }
let boardCache: { race: BoardEntry[]; jobs: BoardEntry[] } | null = null;
/** Fetch the leaderboards (cached after the first success). */
export async function fetchBoard(): Promise<{ race: BoardEntry[]; jobs: BoardEntry[] } | null> {
  if (!BASE) return null;
  if (boardCache) return boardCache;
  try {
    const res = await fetch(`${BASE}/v1/leaderboards`);
    if (res.ok) boardCache = (await res.json()) as { race: BoardEntry[]; jobs: BoardEntry[] };
  } catch { /* offline */ }
  return boardCache;
}
