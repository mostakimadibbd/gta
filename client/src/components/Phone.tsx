// Harborfall smartphone — DOM overlay styled as a realistic handset:
// near-black body, thin bezel, notch, status bar with the game clock.
// Apps: Contacts, Messages, SableBank, Music, Maps, Garage (view-only),
// Stash (stolen goods), Camera (photo mode), Settings (themes + game
// settings: shake, FOV, post FX, shadows, character).
import { useEffect, useState } from "react";
import { CONTACTS, phoneMsgs, onPhoneMsgs } from "../game/phone";
import { G, persistSettings, stashTotal } from "../game/store";
import { CAR_MODELS } from "../world";
import { M } from "../game/missionState";
import { THEMES, type GameTheme } from "../themes";
import { isMenuThemePlaying, startMenuTheme, stopMenuTheme, sfx } from "../game/audio";

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
type AppId = "home" | "contacts" | "messages" | "bank" | "music" | "settings" | "garage" | "stash" | "stats";
const APPS: { id: AppId | "map" | "camera"; icon: string; label: string }[] = [
  { id: "contacts", icon: "◉", label: "Contacts" },
  { id: "messages", icon: "✉", label: "Messages" },
  { id: "bank", icon: "$", label: "SableBank" },
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
            <div className="phone-date">Port Sable · {M.storyDone ? "Story complete" : `Chapter ${Math.min(6, M.storyIndex + 1)} of 6`}</div>
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
            <p className="phone-tip">Solano's ledger can't touch this account. Probably.</p>
          </div>
        )}
        {app === "stats" && (
          <div>
            <p className="phone-note">Skills grow by doing. Perks unlock at 50.</p>
            {([
              ["Driving", G.skills.driving, "50+: handbrake slides 10% less — tidier drifts"],
              ["Shooting", G.skills.shooting, "50+: weapon spread tightens 15%"],
              ["Stamina", G.skills.stamina, "50+: stamina pool effectively +25%"],
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
            <div className="phone-row"><span>Weapons owned</span><b>{Object.values(G.weaponOwned).filter(Boolean).length}/3</b></div>
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
            <div className="bank-row"><span>Field of view · {G.settings.fov}°</span>
              <input type="range" min={50} max={75} step={1} value={G.settings.fov} onChange={(e) => setSetting({ fov: Number(e.target.value) })} /></div>
            <h3 className="phone-subhead">Graphics quality</h3>
            <div className="bank-row"><span>Quality tier</span>
              <span className="phone-seg">
                {(["low", "medium", "high"] as const).map((t) => (
                  <button key={t} type="button" className={`phone-seg-btn ${G.settings.quality === t ? "active" : ""}`} onClick={() => setSetting({ quality: t })}>{t}</button>
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
