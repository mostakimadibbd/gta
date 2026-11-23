// Harborfall smartphone — DOM overlay styled as a realistic handset:
// near-black body, thin bezel, notch, status bar with the game clock.
// Apps: Contacts, Messages, SableBank, Music, Maps, Garage (view-only),
// Stash (stolen goods), Camera (photo mode), Settings (themes + game
// settings: shake, FOV, post FX, shadows, character).
import { useEffect, useState } from "react";
import { CONTACTS, phoneMsgs, onPhoneMsgs } from "../game/phone";
import { G, persistSettings, stashTotal, windLabel } from "../game/store";
import { CAR_MODELS } from "../world";
import { M } from "../game/missionState";
import { STORY_MISSIONS, SIDE_MISSIONS } from "../game/missions";
import { J, jobStats, fmtTime, RACES } from "../game/jobs";
import { BUSINESSES, ECO, APARTMENT, dailyIncomeTotal } from "../game/economy";
import { newsFeed, socialFeed, onFeed } from "../game/feed";
import { THEMES, type GameTheme } from "../themes";
import { isMenuThemePlaying, startMenuTheme, stopMenuTheme, sfx } from "../game/audio";
import { STOCKS, INV, buyLot, sellLot, portfolioValue, portfolioPL, LOT } from "../game/invest";
import { manualTier, showFps, setShowFps } from "../game/perf";
import { fetchBoard, type BoardEntry } from "../game/leaderboard";

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
type AppId = "home" | "contacts" | "messages" | "bank" | "music" | "settings" | "garage" | "stash" | "stats" | "jobs" | "story" | "news" | "social";
const APPS: { id: AppId | "map" | "camera"; icon: string; label: string }[] = [
  { id: "contacts", icon: "◉", label: "Contacts" },
  { id: "messages", icon: "✉", label: "Messages" },
  { id: "bank", icon: "$", label: "SableBank" },
  { id: "jobs", icon: "⚑", label: "Jobs" },
  { id: "story", icon: "✦", label: "Story" },
  { id: "news", icon: "≡", label: "News" },
  { id: "social", icon: "◍", label: "Social" },
  { id: "music", icon: "♪", label: "Music" },
  { id: "map", icon: "⌖", label: "Maps" },
  { id: "garage", icon: "▣", label: "Garage" },
  { id: "stash", icon: "⚿", label: "Stash" },
  { id: "stats", icon: "▤", label: "Stats" },
  { id: "camera", icon: "◎", label: "Camera" },
  { id: "settings", icon: "⚙", label: "Settings" },
];

function gameClock(): string {
  const mins = Math.floor(((G.dayTime * 24 + 6) % 24) * 60);
  const hh = Math.floor(mins / 60), mm = mins % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function Phone({ open, onClose, theme, applyTheme, onOpenMap, onContact, onPhotoMode, onChangeCharacter }: Props) {
  const [app, setApp] = useState<AppId>("home");
  const [, setTick] = useState(0);
  const [playing, setPlaying] = useState(isMenuThemePlaying());
  useEffect(() => onPhoneMsgs(() => setTick((v) => v + 1)), []);
  useEffect(() => onFeed(() => setTick((v) => v + 1)), []);
  useEffect(() => {
    if (!open) return;
    setApp("home"); setPlaying(isMenuThemePlaying());
    const iv = setInterval(() => setTick((v) => v + 1), 1000); // live clock/bank
    return () => clearInterval(iv);
  }, [open ]);
  if (!open) return null;
  const go = (id: AppId | "map" | "camera") => {
    sfx.click();
    if (id === "map") { onOpenMap(); return; }
    if (id === "camera") { onPhotoMode(); return; }
    setApp(id);
  };
  const setSetting = (patch: Partial<typeof G.settings>) => { Object.assign(G.settings, patch); persistSettings(); setTick((v) => v + 1); };
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
        {app !== "home" && <button type="button" className="phone-back" onClick={() => setApp("home")}>‹ Apps</button>}
        {app === "home" && (
          <div className="phone-home">
            <div className="phone-clock">{gameClock()}</div>
            <div className="phone-date">Port Sable · {M.storyDone ? "Story complete" : `Chapter ${Math.min(6, M.storyIndex + 1)} of 6`} · {G.weather} · wind {windLabel(G.wind).toLowerCase()}</div>
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
            {BUSINESSES.map((b) => (
              <div key={b.id} className="bank-row"><span>{b.name}</span><b>{ECO.owned.includes(b.id) ? `+$${b.income}/day` : `$${b.price.toLocaleString()}`}</b></div>
            ))}
            <div className="bank-row"><span>{APARTMENT.name}</span><b>{ECO.ownsApartment ? "Owned 🔑" : `$${APARTMENT.price.toLocaleString()}`}</b></div>
            <div className="bank-row"><span><b>Daily income (paid each morning)</b></span><b>${dailyIncomeTotal().toLocaleString()}</b></div>
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
            <h3 className="phone-subhead">Tow work — Lina's Wrecker</h3>
            <div className="bank-row"><span>Tow status</span><b>{J.towPhase === "idle" ? "Off shift" : J.towPhase === "pickup" ? (J.towHooked ? "Hooked — deliver to Lina's" : "Stranded car marked — reverse the hook in") : "Delivering"}</b></div>
            <button type="button" className="phone-row" onClick={() => { J.wantTow = true; onClose(); }}>
              <span><b>Start tow shift</b><small>Take the Sable Wrecker at Lina's yard · $150 per delivery</small></span><span>›</span>
            </button>
            <div className="bank-row"><span>Tow deliveries</span><b>{jobStats.towDeliveries} · ${jobStats.towEarned.toLocaleString()}</b></div>
            <h3 className="phone-subhead">Earnings</h3>
            <div className="bank-row"><span>Taxi fares</span><b>{jobStats.taxiFares} · ${jobStats.taxiEarned.toLocaleString()} · best tip ${jobStats.taxiBestTip}</b></div>
            <div className="bank-row"><span>Deliveries</span><b>{jobStats.deliveries} legs · ${jobStats.deliveryEarned.toLocaleString()}</b></div>
            <div className="bank-row"><span>Races</span><b>{jobStats.racesRun} run · {jobStats.racesWon} won</b></div>
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
            {SIDE_MISSIONS.filter((mDef) => (M.stats[mDef.id]?.best ?? 0) > 0).map((mDef) => (
              <div key={mDef.id} className="bank-row"><span>{mDef.title}</span><b>best {fmtTime(M.stats[mDef.id].best)}</b></div>
            ))}
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
            <div className="phone-row"><span>Stamina now</span><b>{Math.round(G.stamina)}%</b></div>
            <div className="phone-row"><span>Lifetime earned</span><b>${G.lifetimeEarned.toLocaleString()}</b></div>
            <div className="phone-row"><span>Fines &amp; fees paid</span><b>${G.finesPaid.toLocaleString()}</b></div>
            <div className="phone-row"><span>Cars in garages</span><b>{G.storedCars.length}</b></div>
            <div className="phone-row"><span>Weapons owned</span><b>{Object.values(G.weaponOwned).filter(Boolean).length}/4</b></div>
            <h3 className="phone-subhead">Honest work</h3>
            <div className="phone-row"><span>Taxi</span><b>{jobStats.taxiFares} fares · ${jobStats.taxiEarned.toLocaleString()}</b></div>
            <div className="phone-row"><span>Deliveries</span><b>{jobStats.deliveries} legs · ${jobStats.deliveryEarned.toLocaleString()}</b></div>
            <div className="phone-row"><span>Races</span><b>{jobStats.racesRun} run · {jobStats.racesWon} won</b></div>
            <div className="phone-row"><span>Tow</span><b>{jobStats.towDeliveries} drops · ${jobStats.towEarned.toLocaleString()}</b></div>
            <div className="phone-row"><span>Fishing</span><b>{jobStats.fishCaught} caught · ${jobStats.fishEarned.toLocaleString()}{jobStats.bestFish ? ` · best ${jobStats.bestFish.name} ${jobStats.bestFish.cm}cm` : ""}</b></div>
            <div className="phone-row"><span>Portfolio</span><b>${portfolioValue().toFixed(0)} ({portfolioPL() >= 0 ? "+" : "−"}${Math.abs(portfolioPL()).toFixed(0)})</b></div>
            <div className="phone-row"><span>Business income</span><b>${dailyIncomeTotal().toLocaleString()}/day</b></div>
            <h3 className="phone-subhead">Mission record</h3>
            {[...STORY_MISSIONS, ...SIDE_MISSIONS].filter((mDef) => (M.stats[mDef.id]?.attempts ?? 0) > 0).map((mDef) => (
              <div key={mDef.id} className="phone-row"><span>{mDef.title}</span><b>{M.stats[mDef.id].attempts} tries{M.stats[mDef.id].best ? ` · best ${fmtTime(M.stats[mDef.id].best)}` : ""}</b></div>
            ))}
            {Object.keys(M.stats).length === 0 && <p className="phone-tip">No missions attempted yet.</p>}
          </div>
        )}

        {app === "music" && (
          <div className="phone-page">
            <h3>SableSounds</h3>
            <div className="music-card">
              <div className="music-disc">{playing ? "◉" : "♪"}</div>
              <b>Port Sable Sunset</b>
              <small>The Harborfall opening theme — original recording</small>
              <button type="button" className="phone-play" onClick={() => {
                if (playing) { stopMenuTheme(); setPlaying(false); } else { startMenuTheme(); setPlaying(true); }
              }}>{playing ? "Stop theme" : "Play theme"}</button>
            </div>
            <p className="phone-tip">The theme also plays on the title screen. N mutes everything.</p>
          </div>
        )}
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
            <button type="button" className="phone-row" onClick={onChangeCharacter}>
              <span><b>Change character</b><small>Pick who you play as in Port Sable</small></span><span>›</span>
            </button>
            <h3 className="phone-subhead">Personal theme</h3>
            {THEMES.map((t) => (
              <button key={t.id} type="button" className={`phone-row ${t.id === theme.id ? "active" : ""}`} onClick={() => applyTheme(t)}>
                <span className="swatch" style={{ background: `linear-gradient(135deg, ${t.sky} 50%, ${t.css["--accent"]} 50%)`, width: 26, height: 26, borderRadius: 7 }} />
                <span><b>{t.name}</b><small>{t.blurb}</small></span>{t.id === theme.id && <span>✓</span>}
              </button>
            ))}
          </div>
        )}
        <button type="button" className="phone-homebar" aria-label="Close phone" onClick={onClose} />
      </div>
    </div>
  );
}
