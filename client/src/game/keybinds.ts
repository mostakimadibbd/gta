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
 * action's label) when another action already owns the code. */
export function setBind(action: BindAction, code: string): { ok: boolean; conflict?: string } {
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
