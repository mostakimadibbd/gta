// Harborfall smartphone (Blueprint §8) — DOM overlay styled as a phone.
// Apps: Contacts (call → in-game dialogue + hint), Messages (live feed of
// mission/story/bank messages), Map, Bank (SableBank stats), Music
// (Port Sable Sunset player), Settings (personal themes).
import { useEffect, useState } from "react";
import { CONTACTS, phoneMsgs, onPhoneMsgs } from "../game/phone";
import { G } from "../game/store";
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
}
type AppId = "home" | "contacts" | "messages" | "bank" | "music" | "settings";
const APPS: { id: AppId; icon: string; label: string }[] = [
  { id: "contacts", icon: "👤", label: "Contacts" },
  { id: "messages", icon: "💬", label: "Messages" },
  { id: "bank", icon: "🏦", label: "SableBank" },
  { id: "music", icon: "🎵", label: "Music" },
  { id: "map" as AppId, icon: "🗺️", label: "Maps" },
  { id: "settings", icon: "🎨", label: "Themes" },
];

export default function Phone({ open, onClose, theme, applyTheme, onOpenMap, onContact }: Props) {
  const [app, setApp] = useState<AppId>("home");
  const [, setMsgTick] = useState(0);
  const [playing, setPlaying] = useState(isMenuThemePlaying());
  useEffect(() => onPhoneMsgs(() => setMsgTick((v) => v + 1)), []);
  useEffect(() => { if (open) { setApp("home"); setPlaying(isMenuThemePlaying()); } }, [open ]);
  if (!open) return null;
  const go = (id: AppId) => { sfx.click(); if (id === ("map" as AppId)) { onOpenMap(); return; } setApp(id); };
  return (
    <div className="phone-wrap" role="dialog" aria-label="Smartphone">
      <div className="phone">
        <div className="phone-notch" />
        <div className="phone-status"><span>SableTel</span><span>{M.storyDone ? "★ Story done" : `Chapter ${Math.min(6, M.storyIndex + 1)}`}</span><span>📶 🔋</span></div>
        {app !== "home" && <button type="button" className="phone-back" onClick={() => setApp("home")}>‹ Apps</button>}
        {app === "home" && (
          <div className="phone-home">
            <div className="phone-clock">Port Sable</div>
            <div className="phone-apps">
              {APPS.map((a) => (
                <button key={a.label} type="button" className="phone-app" onClick={() => go(a.id)}>
                  <span className="phone-app-icon">{a.icon}</span>{a.label}
                  {a.id === "messages" && phoneMsgs.length > 0 && <span className="phone-badge">{Math.min(9, phoneMsgs.length)}</span>}
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
                <span><b>{c.name}</b><small>{c.role}</small></span><span className="phone-call">📞</span>
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
            <h3>🏦 SableBank</h3>
            <div className="bank-card">
              <span>Balance</span><strong>${G.cash.toLocaleString()}</strong>
              <small>Rayan Kade · Harbour Current Account</small>
            </div>
            <div className="bank-row"><span>Lifetime earnings</span><b>${G.lifetimeEarned.toLocaleString()}</b></div>
            <div className="bank-row"><span>Fines & hospital bills paid</span><b>−${G.finesPaid.toLocaleString()}</b></div>
            <div className="bank-row"><span>Harbour tokens banked</span><b>{G.tokens} / 6</b></div>
            <p className="phone-tip">Solano's ledger can't touch this account. Probably.</p>
          </div>
        )}
        {app === "music" && (
          <div className="phone-page">
            <h3>🎵 SableSounds</h3>
            <div className="music-card">
              <div className="music-disc">{playing ? "💿" : "🎷"}</div>
              <b>Port Sable Sunset</b>
              <small>The Harborfall opening theme — original recording</small>
              <button type="button" className="primary phone-play" onClick={() => {
                if (playing) { stopMenuTheme(); setPlaying(false); } else { startMenuTheme(); setPlaying(true); }
              }}>{playing ? "⏸ Stop theme" : "▶ Play theme"}</button>
            </div>
            <p className="phone-tip">The theme also plays on the title screen. N mutes everything.</p>
          </div>
        )}
        {app === "settings" && (
          <div className="phone-page">
            <h3>🎨 Personal theme</h3>
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
