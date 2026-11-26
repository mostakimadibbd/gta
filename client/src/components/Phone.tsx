// Harborfall smartphone — DOM overlay styled as a realistic handset:
// near-black body, thin bezel, notch, status bar with the game clock.
// Apps: Contacts, Messages, SableBank, Sable Tunes (Phase 35 music
// player, game/tunes.ts), Maps, Garage (view-only),
// Stash (stolen goods), Camera (photo mode), Settings (themes + game
// settings: shake, FOV, post FX, shadows, character).
import { useEffect, useState } from "react";
import { CONTACTS, phoneMsgs, onPhoneMsgs } from "../game/phone";
import { G, persistSettings, stashTotal, windLabel } from "../game/store";
import { hudDomPalette } from "../game/hudpalette"; // Phase 44: colourblind-safe HUD accents (Bank figures + event badges)
import { currentSeason, seasonMeta } from "../game/season";
import { CAR_MODELS, DEALER_CARS } from "../world";
import { M, NGP, crownBuyoutLive } from "../game/missionState";
import { startNewGamePlus } from "../game/ngplus";
import { STORY_MISSIONS, SIDE_MISSIONS } from "../game/missions";
import { J, jobStats, fmtTime, RACES, BAY_CIRCUIT, SPARROW_RUN, VALET_FRONTAGES } from "../game/jobs";
import { cup, CUP_POINTS, CUP_CHAMPION_POINTS, cupPointsTotal, cupRoundsDone, resetCup } from "../game/cup";
import { slide, SLIDE_ROUNDS, SLIDE_PRIZE, slideUnlocked, slidePassedCount, resetSlide } from "../game/slide"; // Phase 34: the Slide Series card + Records
import { BUSINESSES, ECO, APARTMENT, dailyIncomeTotal, persistEco, STAFF_ROSTER, MAX_STAFF_PER_BIZ, staffDef, businessDailyNet, bizLevel, upgradeCost, upgradeBusiness, staffBonusNow, isNightNow, isClubWeekendNight, LOAN, LOAN_TIERS, borrowLoan, repayLoan, RENTAL_PROPERTIES, RENTALS, rentFor, rentDailyNet, rentalSellPrice, sellRentalProperty, bizEventToday } from "../game/economy";
import { staffOnShiftNow } from "../game/staffworld";
import { newsFeed, socialFeed, onFeed } from "../game/feed";
import { THEMES, type GameTheme } from "../themes";
import { sfx } from "../game/audio";
import { TUNES, TUNES_STATE, tuneDef, playTune, pauseTunes, stepTune, tunesElapsed, tunesSuspended } from "../game/tunes"; // Phase 35: Sable Tunes
import { STOCKS, INV, buyLot, sellLot, portfolioValue, portfolioPL, LOT } from "../game/invest";
import { manualTier, showFps, setShowFps, reflectionMode, REFLECTION_LABEL } from "../game/perf";
import { fetchBoard, type BoardEntry } from "../game/leaderboard";
import { galleryList, galleryDelete, GALLERY_LIMIT, type GalleryPhoto } from "../game/phase9";
import { POSTCARD_DEFS, POSTCARDS, postcardsDoneCount, postcardSetComplete } from "../game/postcards"; // Phase 43: the Sable Postcards live in the Gallery app
import { HEAT, evidenceFloor, bribeCost } from "../game/heat"; // Phase 29: Stats shows the evidence file
import { REGATTA_TARGET_S } from "../game/dayevents"; // Phase 47: the Records board's regatta row
import { FORECAST, WEATHER_META } from "../game/weather"; // Phase 36: the weather page's forecast row reads the machine's committed next state

/** Phase 8: harbour leaderboards from the Python service — renders
 * nothing until the fetch settles; an offline game shows the hint. */
function LeaderboardRows() {
  const [board, setBoard] = useState<{ race: BoardEntry[]; jobs: BoardEntry[] } | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let on = true;
    void fetchBoard().then((b) => { if (on) { setBoard(b); setLoaded(true); } });
    return () => { on = false; };
  }, []);
  if (!loaded) return null;
  if (!board) return <p className="phone-tip">Leaderboards live on the multiplayer server — offline, your best times stay on this phone.</p>;
  return (
    <>
      <h3 className="phone-subhead">Harbour leaderboards (server)</h3>
      {board.race.slice(0, 3).map((e, i) => (
        <div key={`r${i}`} className="bank-row"><span>Fastest lap · {e.name}</span><b>{e.value.toFixed(1)}s</b></div>
      ))}
      {board.jobs.slice(0, 3).map((e, i) => (
        <div key={`j${i}`} className="bank-row"><span>Top earner · {e.name}</span><b>${Math.round(e.value).toLocaleString()}</b></div>
      ))}
    </>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  theme: GameTheme;
  applyTheme: (t: GameTheme) => void;
  onOpenMap: () => void;
  onContact: (name: string, line: string, hint: string) => void;
  onPhotoMode: () => void;
  onChangeCharacter: () => void;
}
type AppId = "home" | "contacts" | "messages" | "bank" | "music" | "settings" | "garage" | "stash" | "stats" | "jobs" | "story" | "news" | "social" | "web" | "gallery";
const APPS: { id: AppId | "map" | "camera"; icon: string; label: string }[] = [
  { id: "contacts", icon: "◉", label: "Contacts" },
  { id: "messages", icon: "✉", label: "Messages" },
  { id: "bank", icon: "$", label: "SableBank" },
  { id: "jobs", icon: "⚑", label: "Jobs" },
  { id: "story", icon: "✦", label: "Story" },
  { id: "news", icon: "≡", label: "News" },
  { id: "social", icon: "◍", label: "Social" },
  { id: "music", icon: "♪", label: "Sable Tunes" },
  { id: "map", icon: "⌖", label: "Maps" },
  { id: "garage", icon: "▣", label: "Garage" },
  { id: "stash", icon: "⚿", label: "Stash" },
  { id: "stats", icon: "▤", label: "Stats" },
  { id: "camera", icon: "◎", label: "Camera" },
  { id: "gallery", icon: "▦", label: "Gallery" },
  { id: "web", icon: "🌐", label: "SableWeb" },
  { id: "settings", icon: "⚙", label: "Settings" },
];

function gameClock(): string {
  const mins = Math.floor(((G.dayTime * 24 + 6) % 24) * 60);
  const hh = Math.floor(mins / 60), mm = mins % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function Phone({ open, onClose, theme, applyTheme, onOpenMap, onContact, onPhotoMode, onChangeCharacter }: Props) {
  const [app, setApp] = useState<AppId>("home");
  const [webPage, setWebPage] = useState("home"); // Phase 9 SableWeb tab
  const [ngConfirm, setNgConfirm] = useState(false); // Phase 20: NG+ two-step confirm
  const [rentSellArm, setRentSellArm] = useState(""); // Phase 30: rental sell-back two-step confirm (property id armed, "" = none)
  const [, setTick] = useState(0);
  const [viewPhoto, setViewPhoto] = useState<GalleryPhoto | null>(null); // Phase 35: Gallery full-screen viewer
  useEffect(() => onPhoneMsgs(() => setTick((v) => v + 1)), []);
  useEffect(() => onFeed(() => setTick((v) => v + 1)), []);
  useEffect(() => {
    if (!open) return;
    setApp("home"); setViewPhoto(null);
    const iv = setInterval(() => setTick((v) => v + 1), 1000); // live clock/bank
    return () => clearInterval(iv);
  }, [open ]);
  if (!open) return null;
  const go = (id: AppId | "map" | "camera") => {
    sfx.click();
    setViewPhoto(null);
    if (id === "map") { onOpenMap(); return; }
    if (id === "camera") { onPhotoMode(); return; }
    if (id === "web") setWebPage("home");
    setApp(id);
  };
  const setSetting = (patch: Partial<typeof G.settings>) => { Object.assign(G.settings, patch); persistSettings(); setTick((v) => v + 1); };
  // Phase 44: Bank money figures + business-event badges read the
  // DOM HUD palette — every field null with the colourblind-safe
  // HUD off, so the default Bank keeps its shipped look exactly.
  const domPal = hudDomPalette();
  const current = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId] : null;
  return (
    <div className="phone-wrap" role="dialog" aria-label="Smartphone">
      <div className="phone">
        <div className="phone-notch" />
        <div className="phone-status">
          <span className="phone-clock-sm">{gameClock()}</span>
          <span className="phone-carrier">SableTel</span>
          <span className="phone-glyphs">▂▄▆ ▰▰▰▱</span>
        </div>
        {app !== "home" && <button type="button" className="phone-back" onClick={() => { if (viewPhoto) setViewPhoto(null); else setApp("home"); }}>‹ {viewPhoto ? "Gallery" : "Apps"}</button>}
        {app === "home" && (
          <div className="phone-home">
            <div className="phone-clock">{gameClock()}</div>
            <div className="phone-date">Port Sable · {M.storyDone ? "Story complete" : `Chapter ${Math.min(6, M.storyIndex + 1)} of 6`} · {currentSeason()} · {G.weather} · wind {windLabel(G.wind).toLowerCase()}</div>
            <div className="phone-apps">
              {APPS.map((a) => (
                <button key={a.label} type="button" className="phone-app" onClick={() => go(a.id)}>
                  <span className="phone-app-icon">{a.icon}</span>{a.label}
                  {a.id === "messages" && phoneMsgs.length > 0 && <span className="phone-badge">{Math.min(9, phoneMsgs.length)}</span>}
                  {a.id === "stash" && G.inventory.length > 0 && <span className="phone-badge">{Math.min(9, G.inventory.length)}</span>}
                </button>
              ))}
            </div>
            <p className="phone-tip">Tip: press U to pocket the phone.</p>
          </div>
        )}
        {app === "contacts" && (
          <div className="phone-page">
            <h3>Contacts</h3>
            {CONTACTS.map((c) => (
              <button key={c.name} type="button" className="phone-row" onClick={() => onContact(c.name, c.line, c.hint)}>
                <span className="phone-avatar">{c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
                <span><b>{c.name}</b><small>{c.role}</small></span><span className="phone-call">Call</span>
              </button>
            ))}
          </div>
        )}
        {app === "messages" && (
          <div className="phone-page">
            <h3>Messages</h3>
            {phoneMsgs.map((m, i) => (
              <div key={i} className="phone-msg"><b>{m.from}</b><p>{m.text}</p></div>
            ))}
          </div>
        )}
        {app === "bank" && (
          <div className="phone-page">
            <h3>SableBank</h3>
            <div className="bank-card">
              <span>Balance</span><strong>${G.cash.toLocaleString()}</strong>
              <small>Harbour Current Account</small>
            </div>
            <div className="bank-row"><span>Lifetime earnings</span><b>${G.lifetimeEarned.toLocaleString()}</b></div>
            <div className="bank-row"><span>Fines & hospital bills paid</span><b>−${G.finesPaid.toLocaleString()}</b></div>
            <div className="bank-row"><span>Harbour tokens banked</span><b>{G.tokens} / 6</b></div>
            <h3 className="phone-subhead">Your businesses</h3>
            {BUSINESSES.map((b) => {
              const ownedBiz = ECO.owned.includes(b.id);
              const crew = ECO.staffBy[b.id] ?? [];
              const lvl = bizLevel(b.id);
              return (
                <div key={b.id}>
                  <div className="bank-row">
                    <span>{b.name}{ownedBiz ? ` · Lv${lvl}` : ""}<small style={{ display: "block" }}>{ownedBiz
                      ? crew.length ? `Crew: ${crew.join(" · ")}` : "No staff — hire from the roster below (up to 2)"
                      : "Not owned"}</small></span>
                    <b style={ownedBiz && domPal.gain ? { color: domPal.gain } : undefined}>{ownedBiz ? `+$${businessDailyNet(b)}/day` : `$${b.price.toLocaleString()}`}</b>
                  </div>
                  {ownedBiz && (() => {
                    // Phase 41: today's business-event badge — read
                    // from the same state businessDailyNet reads, so
                    // the badge and the figure above can never part.
                    const ev = bizEventToday(b);
                    if (!ev) return null;
                    if (ev.kind === "rush") return (
                      <div className="bank-row">
                        <span>↳ 🔥 Rush day<small style={{ display: "block" }}>Takings +50% today — the figure above already includes it; it lands tomorrow morning</small></span>
                        <b style={domPal.eventGood ? { color: domPal.eventGood } : undefined}>+50%</b>
                      </div>
                    );
                    if (ev.kind === "quiet") return (
                      <div className="bank-row">
                        <span>↳ 🌙 Quiet day<small style={{ display: "block" }}>Takings −30% today — the figure above already includes it</small></span>
                        <b style={domPal.eventBad ? { color: domPal.eventBad } : undefined}>−30%</b>
                      </div>
                    );
                    if (ev.kind === "snag" && !ev.fixed) return (
                      <div className="bank-row">
                        <span>↳ 📦 Supply snag<small style={{ display: "block" }}>Takings halved today until the supply run lands — fetch stock from a depot, bring it back here. No pay: it's your own stock. Unfixed, it expires at day's end</small></span>
                        <button type="button" className="phone-toggle" onClick={() => { J.wantSnag = b.id; onClose(); }}>Run the supply run</button>
                      </div>
                    );
                    if (ev.kind === "snag" && ev.fixed) return (
                      <div className="bank-row">
                        <span>↳ 📦 Supply snag — fixed<small style={{ display: "block" }}>Your run landed — full takings restored for today; the figure above is whole again</small></span>
                        <b style={domPal.eventGood ? { color: domPal.eventGood } : undefined}>Fixed</b>
                      </div>
                    );
                    if (ev.kind === "inspection") return (
                      <div className="bank-row">
                        <span>↳ 🧾 City inspection today<small style={{ display: "block" }}>{ev.passed ? "Passed — records clean, no fine" : `Failed — $${ev.fine} fine assessed, $${ev.paid} collected from your account this morning`}</small></span>
                        <b style={(ev.passed ? domPal.eventGood : domPal.eventBad) ? { color: ev.passed ? domPal.eventGood! : domPal.eventBad! } : undefined}>{ev.passed ? "Passed" : `−$${ev.paid}`}</b>
                      </div>
                    );
                    if (ev.kind === "star") return (
                      <div className="bank-row">
                        <span>↳ ⭐ {ev.staff} — star day<small style={{ display: "block" }}>Their takings bonus counts double today — the figure above already includes it</small></span>
                        <b style={domPal.eventGood ? { color: domPal.eventGood } : undefined}>×2 bonus</b>
                      </div>
                    );
                    return null;
                  })()}
                  {ownedBiz && b.id === "club" && (
                    <div className="bank-row">
                      <span>↳ Weekend door<small style={{ display: "block" }}>Fri/Sat nights add +25% on the house take — on those days the figure above already includes it (the club's doors run 20:00–04:00)</small></span>
                      <b>{isClubWeekendNight(ECO.daySerial) ? "Live tonight" : "Fri · Sat"}</b>
                    </div>
                  )}
                  {ownedBiz && lvl < 3 && (
                    <div className="bank-row">
                      <span>↳ Upgrade to Level {lvl + 1}<small style={{ display: "block" }}>+35% takings — the number above is what the morning tick pays</small></span>
                      <button type="button" className="phone-toggle" onClick={() => { if (upgradeBusiness(b.id)) setTick((v) => v + 1); }}>Upgrade ${upgradeCost(b).toLocaleString()}</button>
                    </div>
                  )}
                  {ownedBiz && lvl >= 3 && (
                    <div className="bank-row"><span>↳ Max level<small style={{ display: "block" }}>Takings +70% — the harbour's finest</small></span><b>Lv3</b></div>
                  )}
                  {ownedBiz && crew.map((name) => {
                    const s = staffDef(name)!;
                    const now = staffBonusNow(s);
                    const onShift = staffOnShiftNow(name); // Phase 21: they're physically at the frontage while on shift
                    return (
                      <div key={name} className="bank-row">
                        <span>↳ {name}<small style={{ display: "block" }}>{s.trait} · +{Math.round(now * 100)}% takings{now > s.bonus ? " (night rate ×2 — live now)" : s.name === "Sana Iqbal" ? " (×2 after dark)" : ""} · ${s.wage}/day wage{onShift ? " · 🟢 on shift now — at the frontage" : ""}</small></span>
                        <button type="button" className="phone-toggle" onClick={() => {
                          ECO.staffBy[b.id] = crew.filter((n) => n !== name);
                          persistEco(); setTick((v) => v + 1);
                        }}>Let go</button>
                      </div>
                    );
                  })}
                  {ownedBiz && crew.length < MAX_STAFF_PER_BIZ && STAFF_ROSTER.filter((s) => !crew.includes(s.name)).map((s) => {
                    const worksAt = BUSINESSES.find((ob) => (ECO.staffBy[ob.id] ?? []).includes(s.name));
                    const now = staffBonusNow(s);
                    return (
                      <div key={s.name} className="bank-row">
                        <span>Hire {s.name}<small style={{ display: "block" }}>{s.trait} · +{Math.round(now * 100)}% takings{now > s.bonus ? " (night rate ×2 — live now)" : ""} · ${s.wage}/day wage{worksAt ? ` · currently at ${worksAt.name}` : ""}</small></span>
                        <button type="button" className="phone-toggle" disabled={!!worksAt} onClick={() => {
                          ECO.staffBy[b.id] = [...crew, s.name];
                          persistEco(); setTick((v) => v + 1);
                        }}>Hire</button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <div className="bank-row"><span>{APARTMENT.name}</span><b>{ECO.ownsApartment ? "Owned 🔑" : `$${APARTMENT.price.toLocaleString()}`}</b></div>
            <div className="bank-row"><span><b>Daily income (paid each morning)</b></span><b style={domPal.gain ? { color: domPal.gain } : undefined}>${dailyIncomeTotal().toLocaleString()}</b></div>
            {crownBuyoutLive() && <div className="bank-row"><span>👑 Meridian buy-out dividend<small style={{ display: "block" }}>The harbour stake pays +10% on every business's takings — already included in the daily income figure above (the number shown is the number paid).</small></span><b>+10%</b></div>}
            <h3 className="phone-subhead">Rental properties — Sable Lets</h3>
            {RENTAL_PROPERTIES.map((p) => {
              const ownedProp = RENTALS.owned.includes(p.id);
              const due = RENTALS.due[p.id] ?? 0;
              const armed = rentSellArm === p.id;
              return (
                <div key={p.id}>
                  <div className="bank-row">
                    <span>{p.name}<small style={{ display: "block" }}>{ownedProp
                      ? due > 0 ? `⏸ Rent paused — a $${due.toLocaleString()} repair bill is DUE. Pay it at the property's door and rent resumes the next morning.`
                        : `Let by Ana Ruiz · ${p.district} — rent lands each morning with your business income`
                      : `${p.blurb}${p.requiresBusiness ? " (Requires owning any business.)" : ""}`}</small></span>
                    <b style={ownedProp && (due > 0 ? domPal.loss : domPal.gain) ? { color: due > 0 ? domPal.loss! : domPal.gain! } : undefined}>{ownedProp ? (due > 0 ? `−$${due.toLocaleString()} due` : `+$${rentFor(p).toLocaleString()}/day`) : `$${p.price.toLocaleString()}`}</b>
                  </div>
                  {ownedProp && !armed && (
                    <div className="bank-row">
                      <span>↳ Sell back<small style={{ display: "block" }}>80% of the $${p.price.toLocaleString()} purchase price{due > 0 ? `, less the $${due.toLocaleString()} due bill` : ""} — rent stops today</small></span>
                      <button type="button" className="phone-toggle" onClick={() => setRentSellArm(p.id)}>Sell ${Math.max(0, rentalSellPrice(p) - due).toLocaleString()}</button>
                    </div>
                  )}
                  {ownedProp && armed && (
                    <div className="bank-row">
                      <span>↳ Confirm sale<small style={{ display: "block" }}>This is final — the unit leaves your portfolio today</small></span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button type="button" className="phone-toggle" onClick={() => { setRentSellArm(""); if (sellRentalProperty(p.id)) setTick((v) => v + 1); }}>Confirm</button>
                        <button type="button" className="phone-toggle" onClick={() => setRentSellArm("")}>Keep it</button>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="bank-row"><span><b>Daily rent (paid each morning)</b></span><b>${rentDailyNet().toLocaleString()}</b></div>
            <p className="phone-tip">Rent is collected by Ana Ruiz (Sable Lets, in Contacts) on the same morning tick as your businesses. Tenants mostly pay quietly — late rent, a good tenant, or a repair bill arrive as her messages. No management chores: that's what she's for.</p>
            <h3 className="phone-subhead">SableBank Loans</h3>
            {LOAN.owed > 0 ? (
              <div>
                <div className="bank-row"><span>Outstanding loan<small style={{ display: "block" }}>Principal ${LOAN.principal.toLocaleString()} · 8%/day interest (capped at 2× principal) · 10% auto-repays each morning from your cash</small></span><b style={domPal.loss ? { color: domPal.loss } : undefined}>−${LOAN.owed.toLocaleString()}</b></div>
                <div className="bank-row"><span>Repay now</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button type="button" className="phone-toggle" disabled={G.cash <= 0} onClick={() => { if (repayLoan(100) > 0) setTick((v) => v + 1); }}>Repay $100</button>
                    <button type="button" className="phone-toggle" disabled={G.cash <= 0} onClick={() => { if (repayLoan(LOAN.owed) > 0) setTick((v) => v + 1); }}>Repay in full</button>
                  </span>
                </div>
              </div>
            ) : (
              <div>
                {LOAN_TIERS.map((tier) => (
                  <div key={tier} className="bank-row">
                    <span>Borrow ${tier.toLocaleString()}<small style={{ display: "block" }}>Instant cash · 8%/day on what's owed · 10% auto-repays each morning</small></span>
                    <button type="button" className="phone-toggle" disabled={G.wanted >= 3} onClick={() => { if (borrowLoan(tier)) setTick((v) => v + 1); }}>Borrow</button>
                  </div>
                ))}
                {G.wanted >= 3 && <p className="phone-tip">The bank won't lend while you're wanted 3★ or more — lose the heat first.</p>}
                {isNightNow() && <p className="phone-tip">It's night — Sana Iqbal's rate is doubled right now, wherever she works for you.</p>}
              </div>
            )}
            <p className="phone-tip">Income lands with a SableBank message every game-morning — or when you sleep at home. Solano's ledger can't touch this account. Probably.</p>
            <h3 className="phone-subhead">Invest — SableBank Markets</h3>
            <div className="bank-row"><span>Portfolio value</span><b>${portfolioValue().toFixed(0)} {portfolioPL() !== 0 && <small>({portfolioPL() >= 0 ? "+" : "−"}${Math.abs(portfolioPL()).toFixed(0)})</small>}</b></div>
            {STOCKS.map((s) => {
              const held = INV.shares[s.id] ?? 0;
              return (
                <div key={s.id} className="bank-row">
                  <span>{s.name}<small style={{ display: "block" }}>{held > 0 ? `${held.toFixed(1)} shares · $${(held * INV.prices[s.id]).toFixed(0)}` : s.blurb}</small></span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <b>${INV.prices[s.id].toFixed(2)}</b>
                    <button type="button" className="phone-toggle" onClick={() => { if (buyLot(s.id)) setTick((v) => v + 1); }}>Buy ${LOT}</button>
                    <button type="button" className="phone-toggle" disabled={held <= 0} onClick={() => { if (sellLot(s.id)) setTick((v) => v + 1); }}>Sell</button>
                  </span>
                </div>
              );
            })}
            <p className="phone-tip">Prices drift every game-hour — and react to the harbour: heists sink shipping, race wins lift motors, your business buys lift resorts.</p>
          </div>
        )}
        {app === "jobs" && (
          <div className="phone-page">
            <h3>Jobs — Sable Cabs &amp; Deliveries</h3>
            <div className="bank-row"><span>Taxi status</span><b>{J.taxiPhase === "idle" ? "Off duty" : J.taxiPhase === "pickup" ? "Fare hailing — follow the marker" : "Passenger aboard — drive to the marker"}</b></div>
            <p className="phone-tip">Taxi work: take the yellow Sable Cab at Market Row and drive. Fares hail you automatically — stop beside them, then drive clean and quick for tips.</p>
            <div className="bank-row"><span>Delivery chain</span><b>{J.delPhase === "idle" ? "Not running" : J.delPhase === "pickup" ? `Leg ${J.delLeg + 1}/3 — pick up at the marker` : `Leg ${J.delLeg + 1}/3 — drop off at the marker`}</b></div>
            <button type="button" className="phone-row" onClick={() => { J.wantDelivery = true; onClose(); }}>
              <span><b>Start delivery run</b><small>3 legs from Lina's network · ~$110 a leg + $150 chain bonus</small></span><span>›</span>
            </button>
            <h3 className="phone-subhead">Street races</h3>
            <div className="bank-row"><span>Race bets ($100 stake, win = $200 back)</span>
              <button type="button" className="phone-toggle" onClick={() => { J.bets = !J.bets; setTick((v) => v + 1); }}>{J.bets ? "On" : "Off"}</button></div>
            {RACES.map((r) => (
              <div key={r.id} className="bank-row"><span>{r.name}</span><b>{jobStats.bestTimes[r.id] ? `best ${fmtTime(jobStats.bestTimes[r.id])}` : "no time yet"}</b></div>
            ))}
            <h3 className="phone-subhead">On the water &amp; in the air</h3>
            <div className="bank-row"><span>🚤 {BAY_CIRCUIT.name} — marina → around Sable Island</span><b>{jobStats.bestTimes[BAY_CIRCUIT.id] ? `best ${fmtTime(jobStats.bestTimes[BAY_CIRCUIT.id])}` : "no time yet"}</b></div>
            <p className="phone-tip">Take a boat to the teal ring at the marina and press E. Beat the ghost boat home for ${BAY_CIRCUIT.purse}.</p>
            <div className="bank-row"><span>🛩 {SPARROW_RUN.name} — Sable Field time trial</span><b>{jobStats.bestTimes[SPARROW_RUN.id] ? `best ${fmtTime(jobStats.bestTimes[SPARROW_RUN.id])}` : "no time yet"}</b></div>
            <p className="phone-tip">Take the Sparrow to the teal ring at Sable Field. Thread the amber rings and land back at the field — beat {fmtTime(SPARROW_RUN.par ?? 120)} for ${SPARROW_RUN.purse}.</p>
            <h3 className="phone-subhead">🏆 The Sable Cup — championship</h3>
            <p className="phone-tip">Four rounds: the three street races plus the Bay Circuit. Arm a round here, then start it at its ring — the finish counts. Points 10/6/3/1; {CUP_CHAMPION_POINTS}+ of 40 takes the crown: $2,500, a Harbour Wire headline and a gold Vantara S voucher (20% off at Sable Motors, one use). Your best finish counts — re-run any round while the series is open. (Street Challenge pot races are a different format — they never count.)</p>
            {cup.rounds.map((r) => (
              <div key={r.id} className="bank-row">
                <span>{r.name}<small style={{ display: "block" }}>{r.where}</small></span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <b>{r.best > 0 ? `P${r.best} · ${CUP_POINTS[r.best - 1]} pts` : "not run"}</b>
                  {!cup.closed && <button type="button" className="phone-toggle" onClick={() => { J.cupArm = J.cupArm === r.id ? "" : r.id; setTick((v) => v + 1); }}>{J.cupArm === r.id ? "Armed ✓ — to the ring!" : "Enter round"}</button>}
                </span>
              </div>
            ))}
            <div className="bank-row"><span>Series points</span><b>{cupPointsTotal()}/40 · {cupRoundsDone()}/4 rounds{cup.champion ? " · 🏆 CHAMPION" : cup.closed ? " · closed" : ""}</b></div>
            {cup.voucher && !cup.voucherUsed && <div className="bank-row"><span>🎟️ Gold voucher</span><b>Vantara S −20% at Sable Motors (one use)</b></div>}
            {cup.closed && <button type="button" className="phone-row" onClick={() => { resetCup(); setTick((v) => v + 1); }}><span><b>{cup.champion ? "Defend the crown — new series" : "Run a fresh series"}</b><small>Standings reset; an unspent voucher carries over</small></span><span>›</span></button>}
            <h3 className="phone-subhead">🛞 The Sable Slide Series — drift championship</h3>
            <p className="phone-tip">Three gated courses, run in order. Arm a round here, drive to its amber ring in a car, and press E: thread the gates before the clock dies AND bank the round's drift target on the way — only BANKED chains count (a collision loses the open chain, as always), and the points pay their usual cash too. Pass all three for ${SLIDE_PRIZE.toLocaleString()}, the champion's title in Stats → Records, and the Slide Gold respray at Lina's bench. A clock-out still records your banked score as the course best; walking away from the car records nothing.</p>
            {SLIDE_ROUNDS.map((def, i) => {
              const r = slide.rounds[i];
              const unlocked = slideUnlocked(i);
              return (
                <div key={def.id} className="bank-row">
                  <span>{def.name}<small style={{ display: "block" }}>{def.where} · {def.gates.length} gates · target {def.target.toLocaleString()} pts · {def.timeLimit}s</small></span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <b>{!unlocked ? "🔒 locked" : r.passed ? `✓ passed · best ${r.best.toLocaleString()}` : r.best > 0 ? `best ${r.best.toLocaleString()} · open` : "not run"}</b>
                    {unlocked && <button type="button" className="phone-toggle" onClick={() => { J.slideArm = J.slideArm === def.id ? "" : def.id; setTick((v) => v + 1); }}>{J.slideArm === def.id ? "Armed ✓ — to the ring!" : "Enter round"}</button>}
                  </span>
                </div>
              );
            })}
            <div className="bank-row"><span>Series progress</span><b>{slidePassedCount()}/3 rounds{slide.champion ? " · 🏆 CHAMPION" : ""}{slide.goldUnlocked ? " · Slide Gold unlocked at Lina's" : ""}</b></div>
            {slide.champion && <button type="button" className="phone-row" onClick={() => { resetSlide(); setTick((v) => v + 1); }}><span><b>Defend the title — new series</b><small>Rounds reset; the Slide Gold stays unlocked — a career honour</small></span><span>›</span></button>}
            <h3 className="phone-subhead">Tow work — Lina's Wrecker</h3>
            <div className="bank-row"><span>Tow status</span><b>{J.towPhase === "idle" ? "Off shift" : J.towPhase === "pickup" ? (J.towHooked ? "Hooked — deliver to Lina's" : "Stranded car marked — reverse the hook in") : "Delivering"}</b></div>
            <button type="button" className="phone-row" onClick={() => { J.wantTow = true; onClose(); }}>
              <span><b>Start tow shift</b><small>Take the Sable Wrecker at Lina's yard · $150 per delivery</small></span><span>›</span>
            </button>
            <div className="bank-row"><span>Tow deliveries</span><b>{jobStats.towDeliveries} · ${jobStats.towEarned.toLocaleString()}</b></div>
            <h3 className="phone-subhead">Farm work — Sable Downs</h3>
            <div className="bank-row"><span>Farm status</span><b>{J.farmPhase === "idle" ? "Off shift" : J.farmPhase === "load" ? `Loading at the barn (${J.farmLoad}/3 done)` : `Hauling load ${J.farmLoad + 1}/3 to Harbour Wraps`}</b></div>
            <button type="button" className="phone-row" onClick={() => { J.wantFarm = true; onClose(); }}>
              <span><b>Start farm shift</b><small>Take the farm pickup at the Downs barn · $120 per load + $150 shift bonus</small></span><span>›</span>
            </button>
            <div className="bank-row"><span>Farm loads hauled</span><b>{jobStats.farmLoads} · ${jobStats.farmEarned.toLocaleString()}</b></div>
            <h3 className="phone-subhead">Odd jobs board — valet &amp; courier</h3>
            <div className="bank-row"><span>Valet status</span><b>{J.valetPhase === "idle" ? "Off the hook board" : J.valetPhase === "pickup" ? `Collect the car at ${VALET_FRONTAGES[J.valetFront]?.name ?? "the frontage"}` : `Parking — ${Math.max(0, Math.ceil(J.valetLeft))}s left, keep her unmarked`}</b></div>
            <button type="button" className="phone-row" onClick={() => { J.wantValet = true; onClose(); }}>
              <span><b>Take a valet job</b><small>A guest's car at Club Solace, Hotel Northgate or the Coral resort · $90 − $6/damage point (floor $20) + $30 unmarked</small></span><span>›</span>
            </button>
            <div className="bank-row"><span>Courier status</span><b>{J.courierPhase === "idle" ? "No chain running" : `Drop ${J.courierLeg + 1}/3 — ${J.courierPoint?.name ?? ""} · ${Math.max(0, Math.ceil(J.courierLeft))}s (clock runs on foot / bicycle only)`}</b></div>
            <button type="button" className="phone-row" onClick={() => { J.wantCourier = true; onClose(); }}>
              <span><b>{J.courierPhase === "run" ? "Restart courier chain" : "Start courier chain"}</b><small>3 drops on foot or bicycle · $45 a drop + $60 full-chain bonus{J.courierPhase === "run" ? " · restarting closes the current chain (landed drops stay paid)" : ""}</small></span><span>›</span>
            </button>
            <div className="bank-row"><span>Valet parks</span><b>{jobStats.valetJobs} · ${jobStats.valetEarned.toLocaleString()}</b></div>
            <div className="bank-row"><span>Courier drops</span><b>{jobStats.courierDrops} · ${jobStats.courierEarned.toLocaleString()}</b></div>
            <div className="bank-row"><span>Paramedic</span><b>{jobStats.patientsDelivered} patients · {jobStats.medShifts} shifts · ${jobStats.serviceEarned.toLocaleString()} (service total)</b></div>
            <div className="bank-row"><span>Firefighter</span><b>{jobStats.firesOut} fires out · {jobStats.fireShifts} shifts</b></div>
            <h3 className="phone-subhead">Earnings</h3>
            <div className="bank-row"><span>Taxi fares</span><b>{jobStats.taxiFares} · ${jobStats.taxiEarned.toLocaleString()} · best tip ${jobStats.taxiBestTip} · tips ${jobStats.taxiTips.toLocaleString()} total</b></div>
            <div className="bank-row"><span>Deliveries</span><b>{jobStats.deliveries} legs · ${jobStats.deliveryEarned.toLocaleString()}</b></div>
            <div className="bank-row"><span>Races</span><b>{jobStats.racesRun} run · {jobStats.racesWon} won</b></div>
            <div className="bank-row"><span>🛞 Drifting</span><b>best chain {jobStats.bestDrift.toLocaleString()} pts · {jobStats.driftBanked.toLocaleString()} banked · ${jobStats.driftEarned.toLocaleString()}</b></div>
            <div className="bank-row"><span>Valet</span><b>{jobStats.valetJobs} parks · ${jobStats.valetEarned.toLocaleString()}</b></div>
            <div className="bank-row"><span>Courier</span><b>{jobStats.courierDrops} drops · ${jobStats.courierEarned.toLocaleString()}</b></div>
            <div className="bank-row"><span>Paramedic</span><b>{jobStats.patientsDelivered} patients · {jobStats.medShifts} shifts</b></div>
            <div className="bank-row"><span>Firefighter</span><b>{jobStats.firesOut} fires out · {jobStats.fireShifts} shifts · service ${jobStats.serviceEarned.toLocaleString()}</b></div>
            <LeaderboardRows />
          </div>
        )}
        {app === "story" && (
          <div className="phone-page">
            <h3>Story — chapters &amp; replays</h3>
            <p className="phone-note">Replay a finished chapter for 40% of its payout. Your progress never moves.</p>
            {STORY_MISSIONS.map((mDef, i) => {
              const done = M.storyDone || i < M.storyIndex;
              const current = !M.storyDone && i === M.storyIndex;
              const st = M.stats[mDef.id];
              return (
                <div key={mDef.id} className="phone-row">
                  <span><b>{done ? "✓" : current ? "▶" : "🔒"} Ch.{i + 1} {mDef.title}</b><small>{done ? `Best clear ${st?.best ? fmtTime(st.best) : "—"} · ${st?.attempts ?? 0} attempt${(st?.attempts ?? 0) === 1 ? "" : "s"}` : current ? "Your current chapter — find the giver in the world" : "Locked — finish earlier chapters"}</small></span>
                  {done && <button type="button" className="phone-toggle" onClick={() => { G.requestReplayId = mDef.id; onClose(); }}>Replay 40%</button>}
                </div>
              );
            })}
            <h3 className="phone-subhead">Side stories</h3>
            <div className="bank-row"><span>Lina's Line</span><b>{M.side.lina}/3</b></div>
            <div className="bank-row"><span>Voss's File</span><b>{M.side.voss}/3</b></div>
            <div className="bank-row"><span>The Harbour Heist</span><b>{M.side.heist >= 2 ? "Done 🏆" : M.side.heist === 1 ? "Prepped — call Elias" : M.storyIndex >= 4 || M.storyDone ? "Call Old Elias" : "After Chapter 4"}</b></div>
            <div className="bank-row"><span>After the Fall (post-story pack)</span><b>{!M.storyDone ? "Finish the story first" : M.side.after >= 3 ? "Done 🏆" : "Call Lina, then Voss, then Elias"}</b></div>
            <div className="bank-row"><span>After the Fall progress</span><b>{M.side.after}/3</b></div>
            <div className="bank-row"><span>The Meridian Pair (one choice, post-Ch.3)</span><b>{M.pairChoice === "informant" ? "You stood with Voss's informant" : M.pairChoice === "dockcrew" ? "You warned Elias's crew" : M.storyIndex >= 3 ? "Call Voss OR Elias — the first call decides" : "After Chapter 3"}</b></div>
            <div className="bank-row"><span>The Harbour Wire (post-Ch.4)</span><b>{M.side.wire >= 3 ? "Printed 🏆 — the harbour knows" : M.storyIndex >= 4 || M.storyDone ? `Call Ines Marlo · ${M.side.wire}/3` : "After Chapter 4"}</b></div>
            <div className="bank-row"><span>The Ledger Line (post-Ch.3)</span><b>{M.side.ledger >= 3 ? "Settled 🏆 — the book's fate is sealed" : M.storyIndex >= 3 || M.storyDone ? `Call Petra Vane · ${M.side.ledger}/3` : "After Chapter 3"}</b></div>
            <div className="bank-row"><span>The Quiet Harbour (post-story)</span><b>{!M.storyDone ? "Finish the story first" : M.side.quiet >= 3 ? "Settled 🏆 — the bench keeps the words" : `Call ${M.side.quiet === 1 ? "Lina Park" : "Old Elias"} · ${M.side.quiet}/3`}</b></div>
            {M.side.quiet >= 3 && <div className="bank-row"><span>Coral Shores bench plaque</span><b>“For the ones who stayed.”</b></div>}
            <div className="bank-row"><span>The Harbour Crown (endgame)</span><b>{!M.storyDone ? "Finish the story first" : M.side.crown >= 4 ? "Done 👑 — the harbour is yours" : ECO.owned.length < 2 || RENTALS.owned.length < 1 ? `Needs an empire: ${ECO.owned.length}/2 businesses · ${RENTALS.owned.length}/1 rental — then call Ines Marlo` : `Call Ines Marlo · ${M.side.crown}/4`}</b></div>
            {M.crownDone && <div className="bank-row"><span>The Auction — your call</span><b>{M.crownChoice === "crown-buyout" ? "Bought the harbour stake — +10% dividend on all business income, forever" : "Exposed Meridian — the Wire series ran three editions; the harbour's rep is yours"}</b></div>}
            {SIDE_MISSIONS.filter((mDef) => (M.stats[mDef.id]?.best ?? 0) > 0).map((mDef) => (
              <div key={mDef.id} className="bank-row"><span>{mDef.title}</span><b>best {fmtTime(M.stats[mDef.id].best)}</b></div>
            ))}
            <h3 className="phone-subhead">New Game+ {NGP.level > 0 ? `· NG+ ${NGP.level}` : ""}</h3>
            {M.storyDone ? (
              !ngConfirm ? (
                <>
                  <p className="phone-note">Run the story again on this save: chapters, side arcs, the Wire and the Meridian Pair all reset, and your patrol evidence file is wiped clean — cash, cars, properties, businesses, skills, your look, Cup, Slide Series and drift records stay. The patrol drills harder each run (cruise +6%/level, capped +18%; busts +10%/level, capped +30%) and every mission pays +25% more per level.</p>
                  <button type="button" className="phone-row" onClick={() => setNgConfirm(true)}>
                    <span><b>Start New Game+ {NGP.level + 1}</b><small>Story progress resets — everything you own stays</small></span><span>›</span>
                  </button>
                </>
              ) : (
                <>
                  <p className="phone-note">⚠️ Last check: starting NG+ {NGP.level + 1} resets story and side progress on this save slot — the Ledger Line, the Quiet Harbour and the Harbour Crown included, plaque and all (replays and best times stay; the Sovereign, once earned, stays in your garage like every car you own). Any live mission, race, rental, escort or dispatch call is stood down first. This can't be undone.</p>
                  <button type="button" className="phone-row" onClick={() => { setNgConfirm(false); if (startNewGamePlus() > 0) onClose(); }}>
                    <span><b>Yes — start New Game+ {NGP.level + 1}</b><small>Back to the ferry, Rayan</small></span><span>›</span>
                  </button>
                  <button type="button" className="phone-row" onClick={() => setNgConfirm(false)}>
                    <span><b>Not yet</b><small>Keep free-roaming this run</small></span><span>›</span>
                  </button>
                </>
              )
            ) : (
              <p className="phone-note">{NGP.level > 0 ? `You're on New Game+ ${NGP.level}. ` : ""}Finish the six chapters and New Game+ unlocks here — the whole story again, with a sharper patrol and richer paydays.</p>
            )}
            <h3 className="phone-subhead">Credits</h3>
            <button type="button" className="phone-row" onClick={() => { G.requestCredits = true; onClose(); }}>
              <span><b>Watch the end credits</b><small>Port Sable, the cast, and a thank-you · ~45 s, Esc to skip</small></span><span>›</span>
            </button>
          </div>
        )}
        {app === "news" && (
          <div className="phone-page">
            <h3>Harbour Wire — News</h3>
            {newsFeed.map((n, i) => (
              <div key={i} className="phone-msg"><b>{n.title}</b><p>{n.body}</p></div>
            ))}
            <p className="phone-tip">Headlines follow what actually happens in Port Sable — including you.</p>
          </div>
        )}
        {app === "social" && (
          <div className="phone-page">
            <h3>SableSocial</h3>
            {socialFeed.map((n, i) => (
              <div key={i} className="phone-msg"><b>{n.title}</b><p>{n.body}</p></div>
            ))}
            <p className="phone-tip">The harbour talks. Cause a scene and you'll read about it here.</p>
          </div>
        )}
        {app === "web" && (
          <div className="phone-page">
            <h3>SableWeb — the harbour, online</h3>
            <div className="bank-row">
              <span><b>sableweb.ps</b></span>
              <span style={{ display: "flex", gap: 6 }}>
                {(["home", "motors", "weather", "wire", "classifieds"] as const).map((p) => (
                  <button key={p} type="button" className="phone-toggle" onClick={() => setWebPage(p)}>{p === "home" ? "⌂" : p[0].toUpperCase() + p.slice(1)}</button>
                ))}
              </span>
            </div>
            {webPage === "home" && (
              <>
                <div className="phone-msg"><b>Welcome to SableWeb</b><p>Port Sable's one-page internet. Motors, weather, the Wire, and the classifieds — everything a harbour town needs, nothing it doesn't.</p></div>
                <div className="bank-row"><span>Harbour status</span><b>{G.weather} · wind {windLabel(G.wind).toLowerCase()} · {gameClock()}</b></div>
                <div className="bank-row"><span>Top headline</span><b>{newsFeed[0]?.title ?? "Quiet on the docks"}</b></div>
                <p className="phone-tip">Every page here reads LIVE game data — prices, weather and headlines are the real ones.</p>
              </>
            )}
            {webPage === "motors" && (
              <>
                <h3 className="phone-subhead">sablemotors.ps — current stock</h3>
                {DEALER_CARS.map((dc) => (
                  <div key={dc.kind} className="bank-row"><span>{CAR_MODELS[dc.kind].name}<small style={{ display: "block" }}>Top speed {CAR_MODELS[dc.kind].topSpeed} · handling {CAR_MODELS[dc.kind].handling}</small></span><b>${dc.price.toLocaleString()}</b></div>
                ))}
                <p className="phone-tip">Buy at the Sable Motors showroom in Northgate (07:00–23:00) — cars are delivered to your garage.</p>
              </>
            )}
            {webPage === "weather" && (
              <>
                <h3 className="phone-subhead">harbourweather.ps</h3>
                <div className="bank-row"><span>Now over Port Sable</span><b>{G.weather}</b></div>
                <div className="bank-row"><span>Season</span><b>{currentSeason()}{G.settings.season !== "auto" ? " (pinned)" : ""}</b></div>
                <div className="bank-row"><span>Wind</span><b>{windLabel(G.wind)}</b></div>
                <div className="phone-msg"><b>The season in Port Sable</b><p>{seasonMeta().blurb}</p></div>
                <div className="bank-row"><span>Next change</span><b>~{Math.max(1, Math.round(G.weatherIn / 60))} min</b></div>
                <div className="bank-row"><span>Turning to</span><b>{WEATHER_META[FORECAST.next].icon} {FORECAST.next === G.weather ? `Holding as ${WEATHER_META[FORECAST.next].label}` : WEATHER_META[FORECAST.next].label}</b></div>
                <p className="phone-tip">The forecast is the harbour service's own reading of the sky — it is what will actually arrive when the timer runs out. Pressing Y to change the weather yourself re-rolls it.</p>
                <div className="phone-msg"><b>Harbourmaster's note</b><p>{G.weather === "Storm" ? "Storm over the bay — small craft stay in, and the fishing's off. The Sparrow stays hangared too, if you value it." : G.weather === "Rain" ? "Rain on the water. Roads are slick, the fish don't care, and Tomas is still on the pier." : G.weather === "Fog" ? "Fog in the harbour. Drive slow, boat slower — the patrol boat is out there somewhere." : "Fair harbour weather. The regatta lights are calling and the Downs dirt loop is dry."}</p></div>
              </>
            )}
            {webPage === "wire" && (
              <>
                <h3 className="phone-subhead">harbourwire.ps — latest</h3>
                {newsFeed.slice(0, 3).map((n, i) => (
                  <div key={i} className="phone-msg"><b>{n.title}</b><p>{n.body}</p></div>
                ))}
                {newsFeed.length === 0 && <p className="phone-tip">No headlines yet — the harbour is quiet. Suspiciously quiet.</p>}
              </>
            )}
            {webPage === "classifieds" && (
              <>
                <h3 className="phone-subhead">Classifieds</h3>
                <div className="phone-msg"><b>FOR SALE — Harbour Fisher 180 skiffs</b><p>Moored at the island dock and the Coral marina. Slow, honest, smells faintly of coralfin. Just take one — harbour rules.</p></div>
                <div className="phone-msg"><b>LESSONS — Sable Sparrow flying club</b><p>One prop plane, one runway, no questions. Throttle W, climb Shift, descend Ctrl. Land gently: the gear remembers.</p></div>
                <div className="phone-msg"><b>WANTED — night staff</b><p>Harbour Wraps is the only counter in town that never closes. Everyone else keeps 07:00–23:00. Plan your crimes accordingly.</p></div>
                <div className="phone-msg"><b>LOST — one reputation</b><p>Districts remember faces here. Help people, and witnesses hesitate. Cause scenes, and the whole row knows your name by Friday.</p></div>
              </>
            )}
          </div>
        )}
        {app === "gallery" && (
          <div className="phone-page">
            <h3>Gallery — Photo Mode shots</h3>
            {/* Phase 43: THE SABLE POSTCARDS — the set, its honest
                terms, and the completion certificate. */}
            <div className="phone-msg">
              <b>📮 The Sable Postcards — {postcardsDoneCount()}/{POSTCARD_DEFS.length} sold to The Wire</b>
              <p className="phone-tip">The Wire's picture desk buys ONE of each. Shoot in Photo Mode; a shot that fits an open postcard is bought on the spot and stamped below. Honest terms: the desk checks where you stood, which way the camera pointed, the hour, the weather and your wanted level — it cannot see the picture itself. There is no image recognition.</p>
              {POSTCARD_DEFS.map((d) => (
                <div key={d.id} style={{ marginTop: 6 }}>
                  <div className="phone-row"><span>{POSTCARDS.done[d.id] ? "✅" : "📮"} {d.name}</span><b>{POSTCARDS.done[d.id] ? "SOLD" : `$${d.fee}`}</b></div>
                  <p className="phone-tip">{d.hint}.<br />Checked: {d.check}</p>
                </div>
              ))}
              {postcardSetComplete() && (
                <div style={{ marginTop: 8 }}>
                  <b>🏆 CERTIFICATE — THE SABLE POSTCARDS, FULL SET</b>
                  <p>All eight prints sold to The Wire. The framed set hangs on the Postcard Wall at the Northgate Loft — bridge, pod, sign, club, heli, storm, dome and breakwater. Port Sable, complete.</p>
                </div>
              )}
            </div>
            {viewPhoto ? (
              <div className="phone-msg">
                <img src={viewPhoto.src} alt={`Port Sable photo, ${viewPhoto.at}`} style={{ width: "100%", borderRadius: 8, display: "block" }} />
                <p><b>{viewPhoto.where ?? "Port Sable"}</b>{viewPhoto.where ? "" : " — shot before Gallery learned districts"}<br />{viewPhoto.at}</p>
                {viewPhoto.challenge && <p>📮 <b>Sold to The Wire — “{viewPhoto.challenge}”</b> (a Sable Postcard; the framed print hangs at the Loft)</p>}
                <p style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button type="button" className="phone-toggle" onClick={() => setViewPhoto(null)}>‹ All photos</button>
                  <button type="button" className="phone-toggle" onClick={() => { galleryDelete(viewPhoto.id); setViewPhoto(null); setTick((v) => v + 1); }}>Delete</button>
                </p>
                <p className="phone-tip">This is the phone's 320 px copy — the full-resolution PNG downloaded when you took the shot.</p>
              </div>
            ) : (
              <>
                {galleryList().length === 0 && <p className="phone-tip">No photos yet. Open the Camera app, frame something beautiful, and shoot — shots land here (and download too). Keeps the last {GALLERY_LIMIT}; when it fills, the oldest shot is replaced.</p>}
                {galleryList().map((p) => (
                  <div key={p.id} className="phone-msg">
                    <button type="button" onClick={() => setViewPhoto(p)} style={{ padding: 0, border: "none", background: "none", cursor: "pointer", display: "block", width: "100%" }}>
                      <img src={p.src} alt={`Port Sable photo, ${p.at}`} style={{ width: "100%", borderRadius: 8, display: "block" }} />
                    </button>
                    <p style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>{p.challenge ? `📮 ${p.challenge} · ` : ""}{p.where ? `${p.where} · ` : ""}{p.at}</span>
                      <button type="button" className="phone-toggle" onClick={() => { galleryDelete(p.id); setTick((v) => v + 1); }}>Delete</button>
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
        {app === "stats" && (
          <div>
            <p className="phone-note">Skills grow by doing. Perks unlock at 50.</p>
            {([
              ["Driving", G.skills.driving, "50+: handbrake slides 10% less — tidier drifts"],
              ["Shooting", G.skills.shooting, "50+: weapon spread tightens 15%"],
              ["Stamina", G.skills.stamina, "50+: stamina pool effectively +25%"],
              ["Strength", G.skills.strength, "50+: fists and the bat put people down longer"],
            ] as const).map(([label, val, perk]) => (
              <div key={label} className="phone-stat">
                <div className="phone-stat-head"><span>{label}</span><b>{Math.floor(val)}/100</b></div>
                <div className="phone-stat-bar"><div style={{ width: `${Math.min(100, val)}%` }} /></div>
                <small>{val >= 50 ? `✓ ${perk}` : perk}</small>
              </div>
            ))}
            <div className="phone-row"><span>🛞 Drifting</span><b>best chain {jobStats.bestDrift.toLocaleString()} pts · ${jobStats.driftEarned.toLocaleString()} earned</b></div>
            <div className="phone-row"><span>🏆 Sable Cup</span><b>{cup.champion ? "Champion 🏆" : `${cupPointsTotal()} pts · ${cupRoundsDone()}/4 rounds`}</b></div>
            {M.side.crown >= 4 && <div className="phone-row"><span>👑 Harbour Crown</span><b>Harbour Crown — the harbour flies your flag</b></div>}
            <h3 className="phone-subhead">🏅 Records — the harbour book</h3>
            <div className="phone-row"><span>🛞 Best drift chain</span><b>{jobStats.bestDrift > 0 ? `${jobStats.bestDrift.toLocaleString()} pts` : "—"} · {jobStats.driftBanked.toLocaleString()} pts banked lifetime</b></div>
            <div className="phone-row"><span>🛞 Slide Series</span><b>{slide.champion ? "🏆 Slide Series Champion" : `${slidePassedCount()}/3 rounds passed`}</b></div>
            {SLIDE_ROUNDS.map((def, i) => (
              <div key={def.id} className="phone-row"><span>· {def.name}</span><b>{slide.rounds[i].best > 0 ? `${slide.rounds[i].best.toLocaleString()} pts${slide.rounds[i].passed ? " ✓" : ""}` : "—"}</b></div>
            ))}
            {RACES.map((r) => (
              <div key={r.id} className="phone-row"><span>🏁 {r.name}</span><b>{jobStats.bestTimes[r.id] ? fmtTime(jobStats.bestTimes[r.id]) : "—"}</b></div>
            ))}
            <div className="phone-row"><span>🚤 {BAY_CIRCUIT.name}</span><b>{jobStats.bestTimes[BAY_CIRCUIT.id] ? fmtTime(jobStats.bestTimes[BAY_CIRCUIT.id]) : "—"}</b></div>
            <div className="phone-row"><span>⛵ Harbour Regatta</span><b>{jobStats.bestTimes["regatta"] ? `${fmtTime(jobStats.bestTimes["regatta"])} (regatta-day time trial · target ${fmtTime(REGATTA_TARGET_S)})` : "—"}</b></div>
            <div className="phone-row"><span>🛩 {SPARROW_RUN.name}</span><b>{jobStats.bestTimes[SPARROW_RUN.id] ? `${fmtTime(jobStats.bestTimes[SPARROW_RUN.id])} (par ${fmtTime(SPARROW_RUN.par ?? 120)})` : "—"}</b></div>
            <div className="phone-row"><span>🎣 Fishing derby</span><b>{jobStats.derbyBest > 0 ? `best $${jobStats.derbyBest.toLocaleString()} · ${jobStats.derbyWins} won` : "—"}</b></div>
            <div className="phone-row"><span>🐟 Best catch</span><b>{jobStats.bestFish ? `${jobStats.bestFish.name} · ${jobStats.bestFish.cm}cm (${jobStats.fishCaught} caught)` : "—"}</b></div>
            <p className="phone-note">Race bests sync to the harbour leaderboard when the multiplayer service is configured (Jobs app) — the same board the Python service keeps. Drift scores stay in this book: the service's board ranks race TIMES, and a points total isn't a time.</p>
            <div className="phone-row"><span>Stamina now</span><b>{Math.round(G.stamina)}%</b></div>
            <div className="phone-row"><span>Lifetime earned</span><b>${G.lifetimeEarned.toLocaleString()}</b></div>
            <div className="phone-row"><span>Fines &amp; fees paid</span><b>${G.finesPaid.toLocaleString()}</b></div>
            <div className="phone-row"><span>👁 Patrol evidence</span><b>{HEAT.evidence}/100{HEAT.evidence >= 25 ? ` · wanted floor ${evidenceFloor()}★` : ""}{HEAT.evidence > 0 || G.wanted > 0 ? ` · Fixer quotes $${bribeCost().toLocaleString()}` : ""}</b></div>
            <p className="phone-note">Evidence is what the patrol can pin on you. Every crime they learn about adds to the file — running a ped down +20, gunfire or robbery +15, assault +10, car theft +8, theft +6, a witnessed crash +5, reckless driving +4. At 25 / 50 / 75 evidence the next reported crime starts you at a 1★ / 2★ / 3★ floor, and the patrol searches longer before each star falls (11 s + 0.08 s per point). Stay clean AND unseen for 30 s and the file thins at 1 pt per 4 s; a haircut at Sable Cuts or a change of clothes at a wardrobe or Thread &amp; Tide thins it 4× as fast for 2 minutes. Busted or wasted halves it; the $100 surrender doesn't — a fine isn't time served. Marek Doss, the Fixer in Contacts (after Ch.2), burns the whole file for the quote above — once a day, never while the patrol has eyes on you. One honest limit: a fresh look fools nobody's memory. Witnesses and patrol recognise the act, never the outfit — this game has no appearance-based recognition to reset, so changing your look only thins the file, exactly as written here.</p>
            <div className="phone-row"><span>Cars in garages</span><b>{G.storedCars.length}</b></div>
            <div className="phone-row"><span>Weapons owned</span><b>{Object.values(G.weaponOwned).filter(Boolean).length}/6</b></div>
            <h3 className="phone-subhead">Honest work</h3>
            <div className="phone-row"><span>Taxi</span><b>{jobStats.taxiFares} fares · ${jobStats.taxiEarned.toLocaleString()}</b></div>
            <div className="phone-row"><span>Deliveries</span><b>{jobStats.deliveries} legs · ${jobStats.deliveryEarned.toLocaleString()}</b></div>
            <div className="phone-row"><span>Races</span><b>{jobStats.racesRun} run · {jobStats.racesWon} won</b></div>
            <div className="phone-row"><span>Tow</span><b>{jobStats.towDeliveries} drops · ${jobStats.towEarned.toLocaleString()}</b></div>
            <div className="phone-row"><span>Farm work</span><b>{jobStats.farmLoads} loads · ${jobStats.farmEarned.toLocaleString()}</b></div>
            <div className="phone-row"><span>Valet</span><b>{jobStats.valetJobs} parks · ${jobStats.valetEarned.toLocaleString()}</b></div>
            <div className="phone-row"><span>Courier</span><b>{jobStats.courierDrops} drops · ${jobStats.courierEarned.toLocaleString()}</b></div>
            <div className="phone-row"><span>Paramedic</span><b>{jobStats.patientsDelivered} patients · {jobStats.medShifts} shifts</b></div>
            <div className="phone-row"><span>Firefighter</span><b>{jobStats.firesOut} fires out · {jobStats.fireShifts} shifts</b></div>
            <div className="phone-row"><span>Fishing</span><b>{jobStats.fishCaught} caught · ${jobStats.fishEarned.toLocaleString()}{jobStats.bestFish ? ` · best ${jobStats.bestFish.name} ${jobStats.bestFish.cm}cm` : ""}{jobStats.derbyBest > 0 ? ` · derby best $${jobStats.derbyBest} (${jobStats.derbyWins} won)` : ""}</b></div>
            <div className="phone-row"><span>Portfolio</span><b>${portfolioValue().toFixed(0)} ({portfolioPL() >= 0 ? "+" : "−"}${Math.abs(portfolioPL()).toFixed(0)})</b></div>
            <div className="phone-row"><span>Business income</span><b>${dailyIncomeTotal().toLocaleString()}/day</b></div>
            <h3 className="phone-subhead">Mission record</h3>
            {[...STORY_MISSIONS, ...SIDE_MISSIONS].filter((mDef) => (M.stats[mDef.id]?.attempts ?? 0) > 0).map((mDef) => (
              <div key={mDef.id} className="phone-row"><span>{mDef.title}</span><b>{M.stats[mDef.id].attempts} tries{M.stats[mDef.id].best ? ` · best ${fmtTime(M.stats[mDef.id].best)}` : ""}</b></div>
            ))}
            {Object.keys(M.stats).length === 0 && <p className="phone-tip">No missions attempted yet.</p>}
          </div>
        )}

        {app === "music" && (() => {
          // Phase 35: SABLE TUNES — the phone is the game's music
          // source. State lives in game/tunes.ts; this block renders
          // on the phone's 1 s tick, which is also the elapsed clock.
          const def = tuneDef(TUNES_STATE.track);
          const el = tunesElapsed();
          const loopPos = def.loopSeconds > 0 ? (el % def.loopSeconds) / def.loopSeconds : 0;
          const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
          return (
            <div className="phone-page">
              <h3>Sable Tunes</h3>
              <div className="music-card">
                <div className="music-disc">{TUNES_STATE.playing && !tunesSuspended() ? "◉" : "♪"}</div>
                <b>{def.name}</b>
                <small>{def.sub} · {def.bpm} BPM · loops every {def.loopSeconds.toFixed(1)}s</small>
                <div className="phone-stat-bar" style={{ margin: "8px 0" }}><div style={{ width: `${Math.round(loopPos * 100)}%` }} /></div>
                <small>{TUNES_STATE.playing ? `Elapsed ${mmss(el)} · loop ${mmss(el % def.loopSeconds)} of ${mmss(def.loopSeconds)}` : "Stopped — a loop has no total length, so the bar shows position inside the loop, not progress to an end."}</small>
                {tunesSuspended() && <p className="phone-tip">⏸ Held by the room you're in — its own system has the speakers (Club Solace's rig, the diner's jukebox). This track resumes when you step out.</p>}
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
                  <button type="button" className="phone-toggle" onClick={() => { stepTune(-1); setTick((v) => v + 1); }}>⏮ Prev</button>
                  <button type="button" className="phone-play" onClick={() => {
                    if (TUNES_STATE.playing) pauseTunes(); else playTune(TUNES_STATE.track);
                    setTick((v) => v + 1);
                  }}>{TUNES_STATE.playing ? "⏸ Pause" : "▶ Play"}</button>
                  <button type="button" className="phone-toggle" onClick={() => { stepTune(1); setTick((v) => v + 1); }}>Next ⏭</button>
                </div>
              </div>
              {TUNES.map((t) => (
                <div key={t.id} className="phone-row">
                  <span>{t.id === TUNES_STATE.track ? "♪ " : ""}{t.name}<br /><small>{t.bpm} BPM · loop {t.loopSeconds.toFixed(1)}s</small></span>
                  <button type="button" className="phone-toggle" onClick={() => { playTune(t.id); setTick((v) => v + 1); }}>
                    {t.id === TUNES_STATE.track && TUNES_STATE.playing ? "Playing" : "Play"}
                  </button>
                </div>
              ))}
              <p className="phone-tip">Every track is an original WebAudio composition, synthesised live — no audio files. Port Sable Sunset also plays on the title screen, as always. N mutes everything (there is no separate volume setting; mute is the game's one audio switch, and Tunes rides it like the theme and the club do).</p>
            </div>
          );
        })()}
        {app === "garage" && (
          <div className="phone-page">
            <h3>Garage</h3>
            {current && (
              <div className="phone-car">
                <span className="garage-chip" style={{ background: current.color }} />
                <span><b>{CAR_MODELS[current.kind].name}</b><small>Current car · condition {Math.round(100 - current.damage)}% · fuel {Math.round(current.fuel)}%</small></span>
              </div>
            )}
            {G.storedCars.map((s, i) => (
              <div key={i} className="phone-car">
                <span className="garage-chip" style={{ background: s.color }} />
                <span><b>{s.name}</b><small>Stored · condition {Math.round(100 - s.damage)}% · fuel {Math.round(s.fuel)}%{s.brokenWindow ? " · broken window" : ""}</small></span>
              </div>
            ))}
            {G.storedCars.length === 0 && !current && <p className="phone-tip">No cars yet.</p>}
            <p className="phone-tip">Visit the villa garage or Lina's Garage and press G to swap cars.</p>
          </div>
        )}
        {app === "stash" && (
          <div className="phone-page">
            <h3>Stash</h3>
            {G.inventory.map((it, i) => (
              <div key={i} className="bank-row"><span>{it.name}</span><b>${it.value}</b></div>
            ))}
            {G.inventory.length === 0 && <p className="phone-tip">Empty. Pickpocket pedestrians, break into cars, rob tills…</p>}
            <div className="bank-row"><span><b>Fence value</b></span><b>${stashTotal()}</b></div>
            <p className="phone-tip">Sell all at Coral Pawn (Coral Shores) or Lina's workbench. Getting busted confiscates the lot.</p>
          </div>
        )}
        {app === "settings" && (
          <div className="phone-page">
            <h3>Settings</h3>
            <div className="bank-row"><span>Camera shake</span>
              <button type="button" className="phone-toggle" onClick={() => setSetting({ shake: !G.settings.shake })}>{G.settings.shake ? "On" : "Off"}</button></div>
            <div className="bank-row"><span>Post FX</span>
              <button type="button" className="phone-toggle" onClick={() => setSetting({ postFx: !G.settings.postFx })}>{G.settings.postFx ? "On" : "Off"}</button></div>
            <div className="bank-row"><span>Shadows</span>
              <button type="button" className="phone-toggle" onClick={() => setSetting({ shadows: !G.settings.shadows })}>{G.settings.shadows ? "On" : "Off"}</button></div>
            <div className="bank-row"><span>Show FPS</span>
              <button type="button" className="phone-toggle" onClick={() => { setShowFps(!showFps()); setTick((v) => v + 1); }}>{showFps() ? "On" : "Off"}</button></div>
            <div className="bank-row"><span>Field of view · {G.settings.fov}°</span>
              <input type="range" min={50} max={75} step={1} value={G.settings.fov} onChange={(e) => setSetting({ fov: Number(e.target.value) })} /></div>
            <h3 className="phone-subhead">Graphics quality</h3>
            <div className="bank-row"><span>Quality tier</span>
              <span className="phone-seg">
                {(["low", "medium", "high"] as const).map((t) => (
                  <button key={t} type="button" className={`phone-seg-btn ${G.settings.quality === t ? "active" : ""}`} onClick={() => { manualTier(t); setTick((v) => v + 1); }}>{t}</button>
                ))}
              </span></div>
            <div className="bank-row"><span>Reflections</span><b>{REFLECTION_LABEL[reflectionMode()]}</b></div>
            <div className="bank-row"><span>Ray-traced reflections (High tier)</span>
              <button type="button" className="phone-toggle" onClick={() => setSetting({ reflFx: !G.settings.reflFx })}>{G.settings.reflFx ? "On" : "Off"}</button></div>
            <p className="phone-tip">On High, reflections are ray-traced-style: screen-space reflections on wet streets, glass and paint, plus a mirrored bay. A browser has no hardware ray tracing — this is the real-time stack web games use instead.</p>
            <p className="phone-tip">Low is the weak-phone preset: no post-processing, no shadows (the city looks flatter — that's the trade), resolution capped at native 1.0, ambient traffic and crowds capped at half whatever the density levers below say, and harbour wildlife updating at half rate. The resolution governor never goes above your tier's cap.</p>
            <h3 className="phone-subhead">World — density & view</h3>
            <div className="bank-row"><span>Traffic density</span>
              <span className="phone-seg">
                {(["low", "normal", "high"] as const).map((d) => (
                  <button key={d} type="button" className={`phone-seg-btn ${G.settings.trafficDensity === d ? "active" : ""}`} onClick={() => setSetting({ trafficDensity: d })}>{d}</button>
                ))}
              </span></div>
            <div className="bank-row"><span>Pedestrians</span>
              <span className="phone-seg">
                {(["low", "normal", "high"] as const).map((d) => (
                  <button key={d} type="button" className={`phone-seg-btn ${G.settings.pedDensity === d ? "active" : ""}`} onClick={() => setSetting({ pedDensity: d })}>{d}</button>
                ))}
              </span></div>
            <div className="bank-row"><span>View distance</span>
              <span className="phone-seg">
                {(["near", "normal", "far"] as const).map((d) => (
                  <button key={d} type="button" className={`phone-seg-btn ${G.settings.viewDistance === d ? "active" : ""}`} onClick={() => setSetting({ viewDistance: d })}>{d}</button>
                ))}
              </span></div>
            <p className="phone-tip">Live levers, no reload: Low traffic runs half the ambient cars (buses, taxis and emergency units always run; nothing vanishes near you). High keeps the rush-hour reserve out all day. View distance scales how far out traffic and walkers stream in, and how far the fog sits.</p>
            <h3 className="phone-subhead">Season</h3>
            <div className="bank-row"><span>Season now</span><b>{currentSeason()}</b></div>
            <div className="bank-row"><span>Season turns</span>
              <span className="phone-seg">
                {(["auto", "Spring", "Summer", "Autumn", "Winter"] as const).map((s) => (
                  <button key={s} type="button" className={`phone-seg-btn ${G.settings.season === s ? "active" : ""}`} onClick={() => setSetting({ season: s })}>{s === "auto" ? "Auto" : s}</button>
                ))}
              </span></div>
            <p className="phone-tip">Auto turns every 7 game-days: sun angle, day length, light, foliage and weather odds all shift. Winter is cool and dry — no snow in the subtropics.</p>
            <h3 className="phone-subhead">Subtitles</h3>
            <div className="bank-row"><span>Subtitle size</span>
              <span className="phone-seg">
                {(["S", "M", "L"] as const).map((s) => (
                  <button key={s} type="button" className={`phone-seg-btn ${G.settings.subSize === s ? "active" : ""}`} onClick={() => setSetting({ subSize: s })}>{s}</button>
                ))}
              </span></div>
            <div className="bank-row"><span>Subtitle background</span>
              <button type="button" className="phone-toggle" onClick={() => setSetting({ subBg: !G.settings.subBg })}>{G.settings.subBg ? "On" : "Off"}</button></div>
            <div className="bank-row"><span>Ambient barks</span>
              <button type="button" className="phone-toggle" onClick={() => setSetting({ subBarks: !G.settings.subBarks })}>{G.settings.subBarks ? "On" : "Off"}</button></div>
            <div className="bank-row"><span>Letterbox bars</span>
              <button type="button" className="phone-toggle" onClick={() => setSetting({ letterbox: !G.settings.letterbox })}>{G.settings.letterbox ? "On" : "Off"}</button></div>
            <h3 className="phone-subhead">Music</h3>
            <div className="bank-row"><span>Ambient score</span>
              <button type="button" className="phone-toggle" onClick={() => setSetting({ ambientScore: !G.settings.ambientScore })}>{G.settings.ambientScore ? "On" : "Off"}</button></div>
            <p className="phone-tip">A quiet procedural score under free-roam, synthesised live: a pad bed in the opening theme's chords, a pluck layer that fades in as night falls, and a low pulse that enters at 3★ and quickens at 5★. Your Sable Tunes tracks and the rooms (Club Solace's rig, the diner jukebox) always outrank it — it falls silent while they play and comes back when they finish. The N key mutes it with everything else. Off = the game sounds exactly as it did before.</p>
            <h3 className="phone-subhead">Assists & accessibility</h3>
            <div className="bank-row"><span>Drive assist</span>
              <span className="phone-seg">
                {(["off", "light", "full"] as const).map((a) => (
                  <button key={a} type="button" className={`phone-seg-btn ${G.settings.driveAssist === a ? "active" : ""}`} onClick={() => setSetting({ driveAssist: a })}>{a}</button>
                ))}
              </span></div>
            <div className="bank-row"><span>Aim assist</span>
              <span className="phone-seg">
                {(["off", "soft", "strong"] as const).map((a) => (
                  <button key={a} type="button" className={`phone-seg-btn ${G.settings.aimAssist === a ? "active" : ""}`} onClick={() => setSetting({ aimAssist: a })}>{a}</button>
                ))}
              </span></div>
            <div className="bank-row"><span>Colourblind-safe HUD</span>
              <button type="button" className="phone-toggle" onClick={() => setSetting({ colorblindHud: !G.settings.colorblindHud })}>{G.settings.colorblindHud ? "On" : "Off"}</button></div>
            <div className="bank-row"><span>Reduced flash</span>
              <button type="button" className="phone-toggle" onClick={() => setSetting({ reducedFlash: !G.settings.reducedFlash })}>{G.settings.reducedFlash ? "On" : "Off"}</button></div>
            <p className="phone-tip">Drive assist smooths steering at speed (cars and bikes — keyboard, stick, touch and gyro alike); Full also eases the camera back behind your car when you stop orbiting. It never changes top speed, grip or drift scoring. Aim assist is magnetism while free-aiming: your shot leans part-way toward the nearest person in a small cone — never a lock-on, and never through a wall. Hip fire is unassisted. The colourblind-safe HUD recolours only the HUD and map markers (police, targets, money, event badges) from a colourblind-safe palette — the city itself doesn't change. Reduced flash softens lightning and muzzle flashes. Every default is Off — the game plays exactly as before until you turn one on. Subtitle size lives under Subtitles, above.</p>
            <button type="button" className="phone-row" onClick={onChangeCharacter}>
              <span><b>Change character</b><small>Pick who you play as in Port Sable</small></span><span>›</span>
            </button>
            <h3 className="phone-subhead">Multiplayer</h3>
            <div className="bank-row"><span>Display name</span>
              <input type="text" className="phone-text-input" value={G.settings.mpName} maxLength={24} autoComplete="off"
                onChange={(e) => setSetting({ mpName: e.target.value })} aria-label="Multiplayer display name" /></div>
            <p className="phone-tip">Shown over your character to players in your multiplayer room, and on your room-chat lines. Applies next time you join a room. The server trims it to 24 plain characters — names are decoration, never identity.</p>
            <h3 className="phone-subhead">Personal theme</h3>
            {THEMES.map((t) => (
              <button key={t.id} type="button" className={`phone-row ${t.id === theme.id ? "active" : ""}`} onClick={() => applyTheme(t)}>
                <span className="swatch" style={{ background: `linear-gradient(135deg, ${t.sky} 50%, ${t.css["--accent"]} 50%)`, width: 26, height: 26, borderRadius: 7 }} />
                <span><b>{t.name}</b><small>{t.blurb}</small></span>{t.id === theme.id && <span>✓</span>}
              </button>
            ))}
            <h3 className="phone-subhead">About &amp; credits</h3>
            <div className="bank-row"><span><b>HARBORFALL</b></span><b>v3.0 — Complete Edition</b></div>
            <p className="phone-tip">An original open-world game set in Port Sable — an original city, story, cast and fleet. Any resemblance to other harbour cities, real or fictional, is the tide's doing. Created with Muse, for Mostakim.</p>
            <div className="bank-row"><span>Rayan Kade</span><b>the driver</b></div>
            <div className="bank-row"><span>Tamim Kade</span><b>the brother</b></div>
            <div className="bank-row"><span>Victor Solano</span><b>the ledger</b></div>
            <div className="bank-row"><span>Det. Mara Voss</span><b>harbour patrol</b></div>
            <div className="bank-row"><span>Lina Park</span><b>the mechanic</b></div>
            <div className="bank-row"><span>Old Elias</span><b>the fisherman</b></div>
            <div className="bank-row"><span>Ines Marlo</span><b>the Harbour Wire</b></div>
            <div className="bank-row"><span>Petra Vane</span><b>the Eastmere Diner</b></div>
            <div className="bank-row"><span>Marek Doss</span><b>the Fixer</b></div>
            <div className="bank-row"><span>Ana Ruiz</span><b>Sable Lets</b></div>
            <div className="bank-row"><span>Ren</span><b>harbour dispatch</b></div>
            <p className="phone-tip">Built on Three.js / React Three Fiber (web + desktop), a C++17 physics core mirrored exactly in TypeScript, and a Python FastAPI service for leaderboards and session multiplayer. The world tools are C#/.NET (source in tools/).</p>
            <p className="phone-tip">The honest print: everything you see and hear is procedural — modelled, textured and synthesised in code; no scanned people, places or cars, and the characters are realistic-styled procedural figures, not photographs. Reflections are ray-traced-style screen-space and planar work (a browser has no hardware ray tracing). Multiplayer is session-based rooms on a self-hosted server — no accounts. The dolphins follow a scripted route; the interiors are hand-built pocket rooms.</p>
            <p className="phone-tip">Port Sable thanks you for playing. 🚢</p>
          </div>
        )}
        <button type="button" className="phone-homebar" aria-label="Close phone" onClick={onClose} />
      </div>
    </div>
  );
}
