// Harborfall — Phase 14: KEYBOARD REMAPPING.
//
// Six core actions can be rebound in Pause → Settings: interact,
// sprint, jump, weapon cycle, phone, map. Bindings are stored as
// PHYSICAL key codes (KeyboardEvent.code — layout-independent, so
// "the key where E sits" survives AZERTY/Dvorak) under
// "harborfall-keybinds" — which rides the Phase 14 save-slot prefix
// layer, so bindings are PER SLOT (documented choice: each profile
// is a different player on shared machines as often as not).
//
// The defaults reproduce the pre-Phase-14 behaviour EXACTLY (E,
// Shift, Space, Q, U, M). Unbound extra keys keep working where they
// always did: F also enters vehicles, arrows/WASD always drive, and
// the fixed bindings (T themes, Y weather, J attack, B surrender…)
// are not remappable. Gamepad + touch are untouched by design.
//
// Conflict rule: two actions may not share a code — the Settings UI
// refuses the capture and says why, rather than silently stealing
// the other action's key.

export type BindAction = "interact" | "sprint" | "jump" | "weapon" | "phone" | "map";
export const BIND_ACTIONS: Array<{ id: BindAction; label: string }> = [
  { id: "interact", label: "Interact / enter" },
  { id: "sprint", label: "Sprint (hold)" },
  { id: "jump", label: "Jump / climb" },
  { id: "weapon", label: "Weapon cycle" },
  { id: "phone", label: "Phone" },
  { id: "map", label: "Map" },
];
export const DEFAULT_BINDS: Record<BindAction, string> = {
  interact: "KeyE", sprint: "ShiftLeft", jump: "Space",
  weapon: "KeyQ", phone: "KeyU", map: "KeyM",
};

/** Phase 15 playability: codes that may NEVER be bound — WASD/arrows
 * are the fixed movement keys (Player/Vehicle read them raw, before
 * bind translation: binding Jump to W made W return the jump token
 * and killed forward movement), Tab is the fixed weapon-cycle
 * alternate, Escape closes dialogs. Binding one of these used to be
 * accepted and silently broke movement. (Declared before the load
 * block below, which sanitizes saved binds against it.) */
export const RESERVED_CODES: Record<string, string> = {
  KeyW: "movement (W)", KeyA: "movement (A)", KeyS: "movement (S)", KeyD: "movement (D)",
  ArrowUp: "movement (↑)", ArrowDown: "movement (↓)", ArrowLeft: "movement (←)", ArrowRight: "movement (→)",
  Tab: "weapon cycle (Tab)", Escape: "pause / close (Esc)",
};

export const binds: Record<BindAction, string> = { ...DEFAULT_BINDS };
try {
  const raw = localStorage.getItem("harborfall-keybinds");
  if (raw) {
    const saved = JSON.parse(raw) as Partial<Record<BindAction, string>>;
    for (const a of BIND_ACTIONS) {
      const v = saved[a.id];
      if (typeof v === "string" && v.length > 0) binds[a.id] = v;
    }
    // a corrupt/duplicate saved set falls back to defaults wholesale
    const codes = BIND_ACTIONS.map((a) => binds[a.id]);
    if (new Set(codes).size !== codes.length) Object.assign(binds, DEFAULT_BINDS);
    // Phase 15: a Phase-14 save may already hold a RESERVED code
    // (the old capture accepted WASD) — reset just those actions to
    // their defaults so movement works on first boot of this build.
    for (const a of BIND_ACTIONS) {
      if (RESERVED_CODES[binds[a.id]]) binds[a.id] = DEFAULT_BINDS[a.id];
    }
  }
} catch { /* defaults */ }

export function persistBinds() {
  try { localStorage.setItem("harborfall-keybinds", JSON.stringify(binds)); } catch { /* ignore */ }
}

/** True when this keyboard event is the given action's key. */
export const isBind = (e: KeyboardEvent, action: BindAction) => e.code === binds[action];

/** The action a code is bound to (for conflict detection), if any. */
export function actionForCode(code: string): BindAction | null {
  for (const a of BIND_ACTIONS) if (binds[a.id] === code) return a.id;
  return null;
}

/** Try to bind `action` to `code`. Refuses (returns the conflicting
 * action's label) when another action already owns the code, and
 * refuses reserved movement/system keys outright. */
export function setBind(action: BindAction, code: string): { ok: boolean; conflict?: string } {
  const reserved = RESERVED_CODES[code];
  if (reserved) return { ok: false, conflict: reserved };
  const owner = actionForCode(code);
  if (owner && owner !== action) {
    return { ok: false, conflict: BIND_ACTIONS.find((a) => a.id === owner)?.label ?? owner };
  }
  binds[action] = code;
  persistBinds();
  return { ok: true };
}

export function resetBinds() {
  Object.assign(binds, DEFAULT_BINDS);
  persistBinds();
}

/** Friendly key name for the Settings rows ("ShiftLeft" → "Left Shift"). */
export function codeLabel(code: string): string {
  if (code === "ShiftLeft") return "Left Shift";
  if (code === "ShiftRight") return "Right Shift";
  if (code === "Space") return "Space";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code;
}
