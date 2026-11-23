import { useEffect, useRef, useState } from "react";
import { sfx } from "../game/audio";
import { toggleGyro, gyroEnabled, gyroPreferred } from "../game/gyro";
import { touchMove, setTouchSteer } from "../game/touch";

// Touch controls: buttons dispatch real KeyboardEvents on window (the
// pipeline Player/Vehicle already listen to). The JOYSTICK (Phase 8
// rework, Asphalt-grade) is different: a FLOATING analog stick that
// writes game/touch.ts state — Player blends walk→run by magnitude on
// foot; Vehicle consumes the analog x as steering (gyro yields while
// the stick is deflected). Shown only on coarse-pointer devices.
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

const STICK_R = 52;      // knob clamp radius, px
const DEAD = 0.08;       // analog deadzone
const SMOOTH = 0.35;     // 1-euro-style lerp per animation frame

export default function TouchControls({ driving, onPause }: { driving: boolean; onPause: () => void }) {
  const [touch, setTouch] = useState(false);
  const [gyroOn, setGyroOn] = useState(gyroEnabled());
  const [gyroWanted] = useState(gyroPreferred());
  const zoneRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const drivingRef = useRef(driving); drivingRef.current = driving;
  // stick state: pointerId + origin + target/smoothed unit vectors
  const stick = useRef({ id: -1, ox: 0, oy: 0, tx: 0, ty: 0, sx: 0, sy: 0, raf: 0 });

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setTouch(mq.matches || "ontouchstart" in window);
    update(); mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  // mode flip (foot ↔ car) always releases the stick cleanly
  useEffect(() => { releaseStick(); }, [driving]);
  useEffect(() => () => { cancelAnimationFrame(stick.current.raf); zeroOutputs(); }, []);

  function zeroOutputs() {
    touchMove.x = 0; touchMove.y = 0; touchMove.mag = 0;
    setTouchSteer(0);
  }
  /** Deadzone + expo curve (mag^1.35) on a unit vector. */
  function curve(x: number, y: number) {
    const mag = Math.min(1, Math.hypot(x, y));
    if (mag <= DEAD) return { x: 0, y: 0, mag: 0 };
    const curved = Math.pow((mag - DEAD) / (1 - DEAD), 1.35);
    return { x: (x / mag) * curved, y: (y / mag) * curved, mag: curved };
  }
  function applyFrame() {
    const s = stick.current;
    if (s.id < 0) return;
    // weighted, not twitchy: the knob chases the thumb at 0.35/frame
    s.sx += (s.tx - s.sx) * SMOOTH;
    s.sy += (s.ty - s.sy) * SMOOTH;
    const out = curve(s.sx, s.sy);
    if (drivingRef.current) { setTouchSteer(out.x); touchMove.mag = 0; }
    else { touchMove.x = out.x; touchMove.y = out.y; touchMove.mag = out.mag; setTouchSteer(0); }
    // render: transform only (translate3d), no layout work per move
    if (knobRef.current) {
      const stretch = out.mag > 0.97 ? 1.09 : 1; // 4px-ish stretch at full lock
      knobRef.current.style.transform = `translate3d(${s.sx * STICK_R}px, ${s.sy * STICK_R}px, 0) scale(${stretch})`;
    }
    s.raf = requestAnimationFrame(applyFrame);
  }
  function onDown(e: React.PointerEvent) {
    const s = stick.current;
    if (s.id >= 0) return; // one stick thumb at a time; buttons/camera keep theirs
    e.preventDefault();
    zoneRef.current?.setPointerCapture(e.pointerId);
    s.id = e.pointerId; s.ox = e.clientX; s.oy = e.clientY;
    s.tx = 0; s.ty = 0; s.sx = 0; s.sy = 0;
    const base = baseRef.current;
    if (base) {
      base.style.transition = "opacity 120ms ease, scale 120ms ease";
      base.style.transform = `translate3d(${e.clientX - 64}px, ${e.clientY - 64}px, 0)`;
      base.style.opacity = "1"; base.style.scale = "1";
    }
    if (knobRef.current) { knobRef.current.style.transition = "none"; knobRef.current.style.transform = "translate3d(0,0,0)"; }
    cancelAnimationFrame(s.raf);
    s.raf = requestAnimationFrame(applyFrame);
  }
  function onMove(e: React.PointerEvent) {
    const s = stick.current;
    if (e.pointerId !== s.id) return;
    const dx = (e.clientX - s.ox) / STICK_R;
    const dy = (e.clientY - s.oy) / STICK_R;
    const len = Math.hypot(dx, dy);
    const cl = len > 1 ? 1 / len : 1;
    s.tx = dx * cl; s.ty = dy * cl;
  }
  function releaseStick() {
    const s = stick.current;
    if (s.id < 0) return;
    s.id = -1;
    cancelAnimationFrame(s.raf);
    zeroOutputs();
    // knob springs home (90ms) while the base fades out
    if (knobRef.current) {
      knobRef.current.style.transition = "transform 90ms ease-out";
      knobRef.current.style.transform = "translate3d(0,0,0)";
    }
    if (baseRef.current) {
      baseRef.current.style.transition = "opacity 160ms ease, scale 160ms ease";
      baseRef.current.style.opacity = "0"; baseRef.current.style.scale = "0.92";
    }
  }
  // Gyro toggle: the tap itself is the user gesture iOS needs for the
  // DeviceOrientation permission prompt. Recalibrates every time it arms.
  const onGyroTap = async (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setGyroOn(await toggleGyro());
  };
  if (!touch) return null;
  return (
    <div className="touch-layer">
      <button type="button" className="touch-pause" aria-label="Pause" onClick={(e) => { e.stopPropagation(); onPause(); }}>II</button>
      <button type="button" className={`touch-gyro${gyroOn ? " on" : ""}`} aria-label="Gyro steering"
        onClick={onGyroTap}>
        {gyroOn ? "GYRO ON" : gyroWanted ? "GYRO · TAP" : "GYRO"}
      </button>
      {/* floating joystick: the LEFT control zone. The base appears
          exactly where the thumb lands; a faint fixed ghost marks the
          home spot when the stick is idle (the fixed fallback). */}
      <div ref={zoneRef} className="touch-zone" role="application" aria-label="Analog joystick"
        onPointerDown={onDown} onPointerMove={onMove}
        onPointerUp={releaseStick} onPointerCancel={releaseStick}
        onContextMenu={(e) => e.preventDefault()}>
        <div className="touch-joy ghost" aria-hidden="true"><div className="touch-joy-knob" /></div>
        <div ref={baseRef} className="touch-joy-base" aria-hidden="true">
          <div ref={knobRef} className="touch-joy-knob2" />
        </div>
      </div>
      {!driving ? (
        <div className="touch-actions">
          <HoldButton label="E" k="e" className="big" />
          <HoldButton label="CROUCH" onTap={() => { fire("x", true); setTimeout(() => fire("x", false), 60); }} />
          <HoldButton label="JUMP" k=" " />
        </div>
      ) : (
        <div className="touch-actions">
          <HoldButton label="EXIT" k="e" />
          <HoldButton label="HORN" onTap={() => sfx.horn()} />
          <HoldButton label="DRIFT" k=" " />
          <HoldButton label="BRAKE" k="s" className="pedal" />
          <HoldButton label="GAS" k="w" className="pedal gas" />
        </div>
      )}
    </div>
  );
}
