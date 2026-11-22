export function isInteractiveTarget(target: EventTarget | null): boolean {
  return typeof HTMLElement !== "undefined" &&
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest("input, textarea, select, button, [role='button']") !== null);
}

export function normalizeGameKey(key: string): string {
  switch (key.toLowerCase()) {
    case "arrowup":
      return "w";
    case "arrowleft":
      return "a";
    case "arrowdown":
      return "s";
    case "arrowright":
      return "d";
    default:
      return key.toLowerCase();
  }
}
