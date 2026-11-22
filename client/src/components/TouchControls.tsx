import { useEffect, useRef, useState } from "react";
import { sfx } from "../game/audio";

// Touch controls feed the SAME keyboard pipeline: they dispatch real
// KeyboardEvents on window, so Player/Vehicle/handlers don't fork.
// Shown only on coarse-pointer (touch) devices via CSS + this check.
function fire(key: string, down: boolean) {
  window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { key, bubbles: true }));
}
function HoldButton({ label, k, className, onTap }: { label: string; k?: string; className?: string; onTap?: () => void }) {
  return (
    <button type="button" className={`touch-btn ${className ?? ""}`} aria-label={label}
      onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); if (k) fire(k, true); onTap?.(); }}
      onPointerUp={(e) => { e.stopPropagation(); if (k) fire(k, false); }}
      onPointerLeave={() => { if (k) fire(k, false); }}
      onPointerCancel={() => { if (k) fire(k, false); }}
      onContextMenu={(e) => e.preventDefault()}>
      {label}
    </button>
  );
}
export default function TouchControls({ driving, onPause }: { driving: boolean; onPause: () => void }) {
  const [touch, setTouch] = useState(false);
  const joyRef = useRef<HTMLDivElement>(null);
  const activeKeys = useRef(new Set<string>());
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setTouch(mq.matches || "ontouchstart" in window);
    update(); mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  if (!touch) return null;
  const joyMove = (e: React.PointerEvent) => {
    const el = joyRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const want = new Set<string>();
    if (dy < -0.35) want.add("w"); if (dy > 0.35) want.add("s");
    if (dx < -0.35) want.add("a"); if (dx > 0.35) want.add("d");
    if (Math.hypot(dx, dy) > 0.92) want.add("Shift");
    for (const k of activeKeys.current) if (!want.has(k)) fire(k, false);
    for (const k of want) if (!activeKeys.current.has(k)) fire(k, true);
    activeKeys.current = want;
  };
  const joyEnd = () => { for (const k of activeKeys.current) fire(k, false); activeKeys.current = new Set(); };
  return (
    <div className="touch-layer">
      <button type="button" className="touch-pause" aria-label="Pause" onClick={(e) => { e.stopPropagation(); onPause(); }}>II</button>
      {!driving ? (
        <>
          <div ref={joyRef} className="touch-joy" role="application" aria-label="Movement joystick"
            onPointerDown={(e) => { e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId); joyMove(e); }}
            onPointerMove={(e) => { if (e.buttons) joyMove(e); }}
            onPointerUp={joyEnd} onPointerCancel={joyEnd}>
            <div className="touch-joy-knob" />
          </div>
          <div className="touch-actions">
            <HoldButton label="E" k="e" className="big" />
            <HoldButton label="JUMP" k=" " />
          </div>
        </>
      ) : (
        <>
          <div className="touch-steer">
            <HoldButton label="◀" k="a" className="big" />
            <HoldButton label="▶" k="d" className="big" />
          </div>
          <div className="touch-actions">
            <HoldButton label="EXIT" k="e" />
            <HoldButton label="HORN" onTap={() => sfx.horn()} />
            <HoldButton label="DRIFT" k=" " />
            <HoldButton label="BRAKE" k="s" className="pedal" />
            <HoldButton label="GAS" k="w" className="pedal gas" />
          </div>
        </>
      )}
    </div>
  );
}
