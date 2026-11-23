// Harborfall — Phase 14: SAVE SLOTS (3 profiles).
//
// Every persistence key in the game starts with "harborfall-". This
// module — imported FIRST in main.tsx, before any game module reads
// storage — installs a transparent prefix layer over localStorage:
// while slot N is active, "harborfall-cash" is really stored as
// "harborfall-sN-cash". No other module changes; each slot simply
// sees its own save. Switching slots writes the choice and reloads
// the page (a full reboot is the only honest way to re-run every
// module's load-from-storage init against the other slot).
//
// MIGRATION (first boot of this build): saves written by Phases 1–13
// live under the UNPREFIXED keys. If no slot metadata exists yet and
// legacy keys are present, each one is COPIED to its Slot 1 name,
// the copy is re-read and string-compared (verify), and only then is
// the metadata stamped. The originals are KEPT, untouched, forever —
// they are the backup: if anything about the copy were wrong, the
// pre-Phase-14 save still exists verbatim under its old key. Nothing
// is ever deleted by the migration.
//
// The metadata key itself ("harborfall-slots-meta") is exempt from
// prefixing and is always read/written through the captured raw
// Storage methods, so the layer can never prefix its own bookkeeping.

const META_KEY = "harborfall-slots-meta";
const PREFIX = "harborfall-";
export const SLOT_COUNT = 3;

interface SlotMeta { active: number; migrated: boolean; }
const fallbackMeta: SlotMeta = { active: 1, migrated: false };

const rawGet = Storage.prototype.getItem;
const rawSet = Storage.prototype.setItem;
const rawRemove = Storage.prototype.removeItem;

function readMeta(): SlotMeta {
  try {
    const raw = rawGet.call(localStorage, META_KEY);
    if (raw) {
      const m = JSON.parse(raw) as Partial<SlotMeta>;
      const active = typeof m.active === "number" && m.active >= 1 && m.active <= SLOT_COUNT ? Math.floor(m.active) : 1;
      return { active, migrated: !!m.migrated };
    }
  } catch { /* fall through */ }
  return { ...fallbackMeta };
}

function writeMeta(m: SlotMeta) {
  try { rawSet.call(localStorage, META_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

/** First-boot legacy migration: copy → verify → stamp; originals kept. */
function migrateLegacy(meta: SlotMeta): SlotMeta {
  if (meta.migrated) return meta;
  let legacy: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX) && k !== META_KEY && !/^harborfall-s[123]-/.test(k)) legacy.push(k);
    }
  } catch { legacy = []; }
  if (legacy.length === 0) return { ...meta, migrated: true };
  let allVerified = true;
  for (const k of legacy) {
    try {
      const v = rawGet.call(localStorage, k);
      if (v === null) continue;
      const target = `harborfall-s1-${k.slice(PREFIX.length)}`;
      rawSet.call(localStorage, target, v);
      if (rawGet.call(localStorage, target) !== v) allVerified = false;
    } catch { allVerified = false; }
  }
  // Only stamp "migrated" when every copy verified; if anything
  // failed we leave the flag off so the next boot retries the copy
  // (copies are idempotent — they overwrite with the same values).
  const done: SlotMeta = { active: 1, migrated: allVerified };
  writeMeta(done);
  return done;
}

let meta = readMeta();
meta = migrateLegacy(meta);
if (!readMeta().migrated && meta.migrated) writeMeta(meta);

/** The active slot (1–3) for this session. */
export const activeSlot = meta.active;

const slotKey = (key: string) =>
  key.startsWith(PREFIX) && key !== META_KEY && !/^harborfall-s[123]-/.test(key)
    ? `harborfall-s${meta.active}-${key.slice(PREFIX.length)}`
    : key;

// Install the layer (guarded: a second import must not double-wrap).
const ls = localStorage as Storage & { __harborfallSlotted?: boolean };
if (!ls.__harborfallSlotted) {
  ls.__harborfallSlotted = true;
  Storage.prototype.getItem = function (key: string) { return rawGet.call(this, slotKey(key)); };
  Storage.prototype.setItem = function (key: string, value: string) { rawSet.call(this, slotKey(key), value); };
  Storage.prototype.removeItem = function (key: string) { rawRemove.call(this, slotKey(key)); };
}

/** Switch profile: stamp the choice and reboot into it. */
export function switchSlot(n: number) {
  if (n < 1 || n > SLOT_COUNT || n === meta.active) return;
  writeMeta({ active: n, migrated: true });
  location.reload();
}

/** Raw (unprefixed-layer) peek at a slot for the start-screen cards:
 * does it hold a save, and if so, how far along is it? */
export function slotSummary(n: number): { empty: boolean; cash: number; storyIndex: number } {
  const read = (rest: string) => { try { return rawGet.call(localStorage, `harborfall-s${n}-${rest}`); } catch { return null; } };
  const cashRaw = read("cash");
  const storyRaw = read("story");
  if (cashRaw === null && storyRaw === null) return { empty: true, cash: 0, storyIndex: 0 };
  // both keys are stored as plain number strings (missionState.ts)
  return { empty: false, cash: Number(cashRaw ?? 0) || 0, storyIndex: Number(storyRaw ?? 0) || 0 };
}
