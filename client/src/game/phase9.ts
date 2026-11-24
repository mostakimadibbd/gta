// Phase 9 — "500 Sweep Round 3" shared state: barber look overrides,
// weapon mods, throwables, the photo gallery, named townsfolk (schedules
// + dialogue trees), roadworks sites, and day-scoped world persistence
// (traffic wrecks + destructibles). Persistence keys are all
// harborfall-*; day-scoped state is guarded by the ECO day serial so a
// new game-day starts clean.
import { ECO } from "./economy";
import { G, syncWeaponMirrors } from "./store";

// ------------------------------------------------------------------
// LOOK — barber haircut / hair colour + tattoo sleeve. A LOOK override
// sits on top of the chosen character preset (same pattern as the
// Phase 8 clothing override) and is cleared when the character changes.
// ------------------------------------------------------------------
export interface LookState { hairStyle: string | null; hairColor: string | null; tattoo: boolean; beardStyle: string | null; }
export const LOOK: LookState = { hairStyle: null, hairColor: null, tattoo: false, beardStyle: null };
const LOOK_KEY = "harborfall-look";
function persistLook() { try { localStorage.setItem(LOOK_KEY, JSON.stringify(LOOK)); } catch { /* ignore */ } }
try {
  const raw = localStorage.getItem(LOOK_KEY);
  if (raw) Object.assign(LOOK, JSON.parse(raw) as Partial<LookState>);
} catch { /* ignore */ }
export function emitLookChanged() { try { window.dispatchEvent(new Event("harborfall-look")); } catch { /* ignore */ } }
export function setLook(patch: Partial<LookState>) { Object.assign(LOOK, patch); persistLook(); emitLookChanged(); }
export function clearLookOverride() { LOOK.hairStyle = null; LOOK.hairColor = null; LOOK.tattoo = false; LOOK.beardStyle = null; persistLook(); emitLookChanged(); }
export const HAIR_STYLES: Array<{ id: string; label: string }> = [
  { id: "crop", label: "Clean crop" },
  { id: "flat", label: "Flat top" },
  { id: "bun", label: "Top bun" },
  { id: "ponytail", label: "Ponytail" },
  { id: "bald", label: "Shaved bald" },
  // ---- Phase 16: four more cuts at Sable Cuts ----
  { id: "fade", label: "Tight fade" },
  { id: "quiff", label: "Quiff" },
  { id: "mohawk", label: "Mohawk" },
  { id: "long", label: "Shoulder length" },
];
// ---- Phase 16: beards at Sable Cuts — "" is clean-shaven. Stubble
// is the painted face variant; goatee/full add layered beard cards
// on the rig (humanoid.ts). Beard-only work is cheaper than a cut. ----
export const BEARD_STYLES: Array<{ id: string; label: string }> = [
  { id: "", label: "Clean-shaven" },
  { id: "stubble", label: "Stubble" },
  { id: "goatee", label: "Goatee" },
  { id: "full", label: "Full beard" },
];
export const BEARD_PRICE = 15;
export const HAIR_COLORS: Array<{ hex: string; label: string }> = [
  { hex: "#20242c", label: "Harbour black" },
  { hex: "#4a3220", label: "Dark brown" },
  { hex: "#7a5230", label: "Chestnut" },
  { hex: "#b8b0a4", label: "Silver" },
  { hex: "#2e5f8a", label: "Sable teal" },
  { hex: "#a33b32", label: "Ember red" },
];
export const BARBER_POS = { x: 26.5, z: 33.5 }; // Market Row, next to Thread & Tide
export const TATTOO_POS = { x: 30.5, z: 33.5 };
export const BARBER_PRICE = 25;
export const TATTOO_PRICE = 60;

// ------------------------------------------------------------------
// Weapon mods — bought once at Sable Arms, applied in Combat's spec
// builder. Real stat effects, documented at the counter.
// ------------------------------------------------------------------
export const WMOD = { suppPistol: false, suppSmg: false, magSmg: false, sightsPistol: false, chokeShotgun: false };
const WMOD_KEY = "harborfall-wpmods";
export function persistWmod() { try { localStorage.setItem(WMOD_KEY, JSON.stringify(WMOD)); } catch { /* ignore */ } }
try {
  const raw = localStorage.getItem(WMOD_KEY);
  if (raw) Object.assign(WMOD, JSON.parse(raw) as Partial<typeof WMOD>);
} catch { /* ignore */ }

// ------------------------------------------------------------------
// Throwables — glass bottles. Combat throws; Phase9 flies + lands them.
// ------------------------------------------------------------------
export const THROW = { bottles: 0 };
const THROW_KEY = "harborfall-throw";
export function persistThrow() { try { localStorage.setItem(THROW_KEY, JSON.stringify({ bottles: THROW.bottles })); } catch { /* ignore */ } }
try {
  const raw = localStorage.getItem(THROW_KEY);
  if (raw) THROW.bottles = Math.max(0, Math.min(24, (JSON.parse(raw) as { bottles?: number }).bottles ?? 0));
} catch { /* ignore */ }
export function addBottles(n: number) { THROW.bottles = Math.max(0, Math.min(24, THROW.bottles + n)); persistThrow(); }
/** The bottle count lives in the weapon inventory (G.weaponAmmo.bottle);
 * THROW is its persistence mirror. Call after every change. */
export function syncBottles() {
  THROW.bottles = G.weaponAmmo.bottle;
  G.weaponOwned.bottle = G.weaponAmmo.bottle > 0;
  persistThrow();
  syncWeaponMirrors();
}
// restore the persisted bottle count into the weapon inventory at boot
G.weaponAmmo.bottle = THROW.bottles;
G.weaponOwned.bottle = THROW.bottles > 0;
/** Live projectile (one at a time — arcade rule). */
export const BOTTLE = { active: false, x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0, spin: 0 };

// ------------------------------------------------------------------
// Photo gallery — Photo Mode shots are kept (downscaled JPEG) so the
// phone Gallery app can show them later, not just download once.
// ------------------------------------------------------------------
export interface GalleryPhoto { id: number; src: string; at: string; }
const GALLERY_KEY = "harborfall-gallery";
export function galleryList(): GalleryPhoto[] {
  try { return JSON.parse(localStorage.getItem(GALLERY_KEY) ?? "[]") as GalleryPhoto[]; } catch { return []; }
}
export function galleryAdd(src: string) {
  try {
    const list = galleryList();
    list.unshift({ id: Date.now(), src, at: new Date().toLocaleString() });
    localStorage.setItem(GALLERY_KEY, JSON.stringify(list.slice(0, 10)));
  } catch { /* quota — the download in App still happened */ }
}
export function galleryDelete(id: number) {
  try { localStorage.setItem(GALLERY_KEY, JSON.stringify(galleryList().filter((p) => p.id !== id))); } catch { /* ignore */ }
}

// ------------------------------------------------------------------
// Day-scoped world persistence: traffic wrecks + broken destructibles
// survive a reload within the same game-day, cleared on the day tick.
// ------------------------------------------------------------------
export const WRECK_KEY = "harborfall-wrecks";
export const DESTRUCT_KEY = "harborfall-destruct";
export function loadDaySet(key: string): number[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { serial: number; list: number[] };
    return parsed.serial === ECO.daySerial && Array.isArray(parsed.list) ? parsed.list : [];
  } catch { return []; }
}
export function saveDaySet(key: string, list: number[]) {
  try { localStorage.setItem(key, JSON.stringify({ serial: ECO.daySerial, list })); } catch { /* ignore */ }
}

// ------------------------------------------------------------------
// Named townsfolk — four Port Sable residents with daily schedules
// (stops keyed by game hour) and small branching dialogue trees.
// Effects are codes applied by Phase9Ui: "tip" (the reply IS the
// reward), "rep" (they vouch for you: district rep −12), "wrap"
// (Priya's $8 market wrap, heals), "gift" (give Kip $20 → goodwill).
// ------------------------------------------------------------------
export interface TownStop { from: number; x: number; z: number; sit?: boolean; place: string; }
export interface Townsfolk {
  id: string; name: string; role: string;
  skin: string; hair: string; hairStyle: string; top: string; bottom: string; build: "slim" | "average" | "broad"; female?: boolean; cap?: string;
  stops: TownStop[];
  greet: string; greetKnown: string;
  aLabel: string; aReply: string; aEffect: "tip" | "rep";
  bLabel: string; bReply: string; bReplyPoor?: string; bEffect: "tip" | "rep" | "wrap" | "gift";
}
export const TOWNSFOLK: Townsfolk[] = [
  {
    id: "tomas", name: "Tomas Reed", role: "Fisherman",
    skin: "#8a5a3b", hair: "#b8b0a4", hairStyle: "cap", cap: "#274b63", top: "#31556b", bottom: "#3a3f45", build: "average",
    stops: [
      { from: 6, x: 4, z: 104, place: "the pier" },
      { from: 11, x: 26, z: 14, place: "Harbour Wraps" },
      { from: 15, x: 6, z: 112, sit: true, place: "the pier bench" },
      { from: 19, x: -94, z: -52, place: "home in the Ferry Quarter" },
      { from: 0, x: -94, z: -52, place: "home in the Ferry Quarter" },
    ],
    greet: "Mornin'. The harbour gives back what you put in — mostly fish, sometimes trouble.",
    greetKnown: "There's the face the docks whisper about. Keep it down, eh?",
    aLabel: "Ask about the fishing", aEffect: "tip",
    aReply: "Take the little skiff off the island dock at dawn. Coralfin run when the wind's up — the Wraps man pays fair.",
    bLabel: "Help mend his nets", bEffect: "rep",
    bReply: "Well now. Hands like that, you're harbour folk. I'll put in a word — the docks will go easier on you.",
  },
  {
    id: "priya", name: "Priya Nair", role: "Market trader",
    skin: "#7a4a2e", hair: "#1c1a18", hairStyle: "bun", top: "#b4622d", bottom: "#4a4f57", build: "average", female: true,
    stops: [
      { from: 7, x: 14, z: 26, place: "her Market Row stall" },
      { from: 13, x: 34, z: 34, place: "the east stalls" },
      { from: 18, x: 24, z: 16, place: "the Sable Mart front" },
      { from: 22, x: 30, z: 8, place: "home above the market" },
      { from: 0, x: 30, z: 8, place: "home above the market" },
    ],
    greet: "Fresh threadfin, harbour honey, knives that stay sharp. What are you after?",
    greetKnown: "You again. Half the row crosses the street when you pass — the other half wants your autograph.",
    aLabel: "Ask what's selling", aEffect: "tip",
    aReply: "Coral cloth, always. And if the patrol's boats are out, fish prices jump — sell to the Wraps man before noon.",
    bLabel: "Buy a market wrap ($8)", bEffect: "wrap",
    bReply: "There you go — threadfin, lime, my mother's spice. Eat it slow, it bites back.",
    bReplyPoor: "Come back with eight dollars, love. The wrap will wait. Probably.",
  },
  {
    id: "bea", name: "Bea Kowalski", role: "Harbourmaster",
    skin: "#caa07a", hair: "#6b4a2a", hairStyle: "ponytail", top: "#e8e4da", bottom: "#2c3e50", build: "broad", female: true,
    stops: [
      { from: 6, x: -52, z: 96, place: "the docks office" },
      { from: 12, x: 0, z: 120, place: "the marina walk" },
      { from: 17, x: 46, z: 104, place: "Club Solace's door" },
      { from: 23, x: -40, z: 88, place: "the harbour cottages" },
      { from: 0, x: -40, z: 88, place: "the harbour cottages" },
    ],
    greet: "Harbourmaster Bea. Berths, manifests — and no funny business on my water.",
    greetKnown: "I know that silhouette from the patrol reports. Berth fees are double for celebrities.",
    aLabel: "Ask about the water", aEffect: "tip",
    aReply: "Patrol boat's out whenever the stars are up, and it watches till you cool off. Mind how you wake the marina.",
    bLabel: "Ask her to vouch for you", bEffect: "rep",
    bReply: "One word, once — the docks forget a little. Don't spend it all in one place.",
  },
  {
    id: "kip", name: "Kip Andersen", role: "Skater",
    skin: "#5d4028", hair: "#14161c", hairStyle: "crop", top: "#c8b13a", bottom: "#31435c", build: "slim",
    stops: [
      { from: 8, x: 84, z: -72, place: "Lantern Park" },
      { from: 14, x: 66, z: -58, place: "the gym corner" },
      { from: 18, x: 78, z: -80, sit: true, place: "the park bench" },
      { from: 21, x: -104, z: -96, place: "home in the suburbs" },
      { from: 0, x: -104, z: -96, place: "home in the suburbs" },
    ],
    greet: "Yo. You look like someone who knows where the fast cars sleep.",
    greetKnown: "The famous one! Kip Andersen met you before you were a rumour, remember that.",
    aLabel: "Ask about races", aEffect: "tip",
    aReply: "Three flags, three purses — the phone's Jobs app runs them. The docks run at night is the mean one. Bring brakes.",
    bLabel: "Slip Kip $20", bEffect: "gift",
    bReply: "No WAY. Snacks are on me forever, legend. The park looks out for its own, yeah?",
    bReplyPoor: "Ha — the thought counts. Mostly. Come back richer.",
  },
];
/** The stop a townsfolk is heading to / sitting at, for a game hour. */
export function townStopAt(t: Townsfolk, hour: number): TownStop {
  let best: TownStop | null = null;
  for (const s of t.stops) if (hour >= s.from && (!best || s.from >= best.from)) best = s;
  if (!best) best = t.stops.reduce((a, b) => (a.from < b.from ? a : b)); // earliest stop = post-midnight tail
  return best;
}

// Talk session state (Phase9 claims the NPC + opens; Phase9Ui renders).
export const TALK = { open: false, npcId: "", node: "greet" as "greet" | "choice" | "done", reply: "" };
export function closeTalk() { TALK.open = false; TALK.npcId = ""; TALK.node = "greet"; TALK.reply = ""; }

// ------------------------------------------------------------------
// Roadworks — one active site per game-day, rotating over three road
// segments. Cones/barriers/workers + a traffic slow-zone.
// ------------------------------------------------------------------
export const ROADWORKS: Array<{ x: number; z: number; road: string; axis: "z" }> = [
  { x: 20, z: 44, road: "Harbour Avenue", axis: "z" },
  { x: -64, z: -20, road: "Dock Road", axis: "z" },
  { x: 64, z: -240, road: "the Northgate causeway", axis: "z" },
];
export function roadworksSite() { return ROADWORKS[((ECO.daySerial % ROADWORKS.length) + ROADWORKS.length) % ROADWORKS.length]; }
