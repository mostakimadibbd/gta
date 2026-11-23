// Harborfall — Phase 9 dialogue UI (DOM, outside the Canvas): the
// named-townsfolk conversation overlay. Phase9 (3D) opens a session in
// game/phase9.ts TALK when you press E near a townsfolk; this panel
// renders greeting → choice → response and applies the small real
// effects (a vouched reputation drop, Priya's wrap, Kip's $20 goodwill).
// While it is open G.dialogueActive freezes the world systems, exactly
// like the story dialogue; walking away closes it (Phase9 watches).
import { useEffect, useState } from "react";
import { G, toast, persistZoneRep } from "../game/store";
import { districtAt } from "../world";
import { sfx } from "../game/audio";
import { TOWNSFOLK, TALK, closeTalk, type Townsfolk } from "../game/phase9";

export default function Phase9Ui() {
  const [, setTick] = useState(0);
  const [reply, setReply] = useState("");

  // poll the TALK session (same 150 ms idiom as the HUD poll)
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 150);
    return () => window.clearInterval(id);
  }, []);
  // Esc closes the conversation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && TALK.open) { closeTalk(); G.dialogueActive = false; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!TALK.open) return null;
  const def: Townsfolk | undefined = TOWNSFOLK.find((n) => n.id === TALK.npcId);
  if (!def) return null;
  const zone = districtAt(G.playerPos.x, G.playerPos.z);
  const known = (G.zoneRep[zone] ?? 0) >= 40;

  const close = () => { closeTalk(); G.dialogueActive = false; sfx.click(); };
  const choose = (which: "a" | "b") => {
    const effect = which === "a" ? def.aEffect : def.bEffect;
    let text = which === "a" ? def.aReply : def.bReply;
    if (effect === "rep") {
      const before = G.zoneRep[zone] ?? 0;
      G.zoneRep[zone] = Math.max(0, before - 12);
      persistZoneRep();
      toast(before > 0 ? `${def.name} puts in a word — ${zone} cools toward you (rep ${Math.round(G.zoneRep[zone])}).` : `${def.name} smiles — ${zone} already thinks well of you.`);
    } else if (effect === "wrap") {
      if (G.cash >= 8) {
        G.cash -= 8; G.health = Math.min(100, G.health + 20); G.eatingUntil = G.timeS + 2.2;
        sfx.eat();
        toast("Priya's market wrap — threadfin, lime, spice. +20 health.");
      } else text = def.bReplyPoor ?? text;
    } else if (effect === "gift") {
      if (G.cash >= 20) {
        G.cash -= 20;
        // Kip spreads the word: nearby peds remember being helped
        for (const p of G.peds) {
          if (p.active && (p.x - G.playerPos.x) ** 2 + (p.z - G.playerPos.z) ** 2 < 30 ** 2) p.memHelpedUntil = G.timeS + 300;
        }
        toast("Kip pockets the $20 like it's a trophy. The park will remember this.");
        sfx.cash();
      } else text = def.bReplyPoor ?? text;
    }
    setReply(text);
    TALK.node = "done"; TALK.reply = text;
    sfx.dialogue();
  };

  return (
    <div className="talk-backdrop" role="dialog" aria-label={`Talking to ${def.name}`}>
      <div className="talk-panel">
        <div className="talk-head">
          <strong>{def.name}</strong>
          <span>{def.role} · {zone}</span>
        </div>
        {TALK.node === "greet" && (
          <>
            <p className="talk-line">{known ? def.greetKnown : def.greet}</p>
            <div className="talk-actions">
              <button type="button" onClick={() => { TALK.node = "choice"; sfx.click(); }}>…</button>
              <button type="button" onClick={close}>Leave</button>
            </div>
          </>
        )}
        {TALK.node === "choice" && (
          <>
            <p className="talk-line">{known ? def.greetKnown : def.greet}</p>
            <div className="talk-actions talk-choices">
              <button type="button" onClick={() => choose("a")}>{def.aLabel}</button>
              <button type="button" onClick={() => choose("b")}>{def.bLabel}</button>
              <button type="button" onClick={close}>Leave</button>
            </div>
          </>
        )}
        {TALK.node === "done" && (
          <>
            <p className="talk-line">{reply || TALK.reply}</p>
            <div className="talk-actions">
              <button type="button" onClick={close}>Leave</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
