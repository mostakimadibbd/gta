// Harborfall — Phase 8: SableBank investing. Three fictional Port Sable
// companies trade on a simple random walk, repriced once per game-hour.
// Buy/sell happens in $100 lots; holdings are fractional shares so a lot
// always costs exactly $100. Prices are ALSO nudged by the player's own
// harbour news (documented, deliberately small): completing the Harbour
// Heist knocks Sable Shipping (−8%, the strongroom held their bonds),
// winning a street race lifts Northgate Motors (+6%), buying a business
// lifts Coral Resorts (+3%). Nudges decay back into the walk next hour.
import { G, toast } from "./store";
import { pushPhoneMsg } from "./phone";

export interface StockDef { id: string; name: string; blurb: string; start: number; }
export const STOCKS: StockDef[] = [
  { id: "ship", name: "Sable Shipping Co.", blurb: "Container freight through the harbour — the heist hurt them.", start: 42 },
  { id: "coral", name: "Coral Resorts", blurb: "Hotels and beach clubs on the far shore.", start: 68 },
  { id: "motors", name: "Northgate Motors", blurb: "The dealership group — street-race glory sells cars.", start: 55 },
];

export const INV = {
  prices: { ship: 42, coral: 68, motors: 55 } as Record<string, number>,
  shares: { ship: 0, coral: 0, motors: 0 } as Record<string, number>,
  costBasis: { ship: 0, coral: 0, motors: 0 } as Record<string, number>, // $ spent, for P/L
  lastHour: -1,
};
try {
  const raw = localStorage.getItem("harborfall-invest");
  if (raw) {
    const v = JSON.parse(raw) as Partial<typeof INV>;
    if (v.prices) INV.prices = { ...INV.prices, ...v.prices };
    if (v.shares) INV.shares = { ...INV.shares, ...v.shares };
    if (v.costBasis) INV.costBasis = { ...INV.costBasis, ...v.costBasis };
    INV.lastHour = v.lastHour ?? -1;
  }
} catch { /* fresh portfolio */ }
export function persistInvest() {
  try { localStorage.setItem("harborfall-invest", JSON.stringify(INV)); } catch { /* ignore */ }
}

export const LOT = 100;
export const portfolioValue = () => STOCKS.reduce((a, s) => a + INV.shares[s.id] * INV.prices[s.id], 0);
export const portfolioPL = () => STOCKS.reduce((a, s) => a + (INV.shares[s.id] * INV.prices[s.id] - INV.costBasis[s.id]), 0);

/** One game-hour of market movement: ±4.5% random walk, floor of $4. */
export function tickInvest() {
  for (const s of STOCKS) {
    const drift = (Math.random() - 0.485) * 0.09; // slight upward bias — the harbour provides
    INV.prices[s.id] = Math.max(4, Math.round(INV.prices[s.id] * (1 + drift) * 100) / 100);
  }
  persistInvest();
}

/** Documented event nudge (see header): pct like −0.08 or +0.06. */
export function nudgeStock(id: string, pct: number, why: string) {
  if (!(id in INV.prices)) return;
  INV.prices[id] = Math.max(4, Math.round(INV.prices[id] * (1 + pct) * 100) / 100);
  persistInvest();
  const s = STOCKS.find((x) => x.id === id);
  if (s) pushPhoneMsg("SableBank", `📈 ${s.name} moved ${pct > 0 ? "+" : ""}${Math.round(pct * 100)}% — ${why} Now $${INV.prices[id].toFixed(2)}.`);
}

export function buyLot(id: string) {
  if (G.cash < LOT) { toast(`A lot is $${LOT} — you're short.`); return false; }
  G.cash -= LOT;
  INV.shares[id] += LOT / INV.prices[id];
  INV.costBasis[id] += LOT;
  persistInvest();
  return true;
}
export function sellLot(id: string) {
  const held = INV.shares[id] * INV.prices[id];
  if (held < 1) { toast("Nothing to sell in that stock."); return false; }
  const take = Math.min(LOT, held);
  const frac = take / held;
  INV.shares[id] -= INV.shares[id] * frac;
  INV.costBasis[id] -= INV.costBasis[id] * frac;
  if (INV.shares[id] < 0.001) { INV.shares[id] = 0; INV.costBasis[id] = 0; }
  G.cash += Math.round(take); G.lifetimeEarned += Math.round(take);
  persistInvest();
  return true;
}
