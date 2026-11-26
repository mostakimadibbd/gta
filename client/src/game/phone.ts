// Harborfall smartphone data (Blueprint §8) — messages + contacts.
// Messages accumulate as you play (mission briefs, payments, story beats)
// and persist in localStorage alongside the existing save keys.
export interface PhoneMsg { from: string; text: string; }
export interface Contact { name: string; role: string; line: string; hint: string; }

const MSG_KEY = "harborfall-msgs";
export const phoneMsgs: PhoneMsg[] = (() => {
  try {
    const raw = localStorage.getItem(MSG_KEY);
    if (raw) return JSON.parse(raw) as PhoneMsg[];
  } catch { /* fresh phone */ }
  return [
    { from: "Lina Park", text: "Rayan?? You're really back. Come by the garage on Market Row — your Sprinter still runs. 🔧" },
    { from: "Old Elias", text: "Heard the ferry brought you home, Kade boy. Pier's the same. People aren't." },
    { from: "SableTel", text: "Welcome to Port Sable! Your SableTel plan includes unlimited harbour-wide coverage." },
  ];
})();
const listeners = new Set<() => void>();
export function onPhoneMsgs(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function pushPhoneMsg(from: string, text: string) {
  phoneMsgs.unshift({ from, text });
  if (phoneMsgs.length > 30) phoneMsgs.length = 30;
  try { localStorage.setItem(MSG_KEY, JSON.stringify(phoneMsgs)); } catch { /* private mode */ }
  listeners.forEach((fn) => fn());
}

export const CONTACTS: Contact[] = [
  { name: "Lina Park", role: "Mechanic — Lina's Garage, Market Row",
    line: "Garage is open day and night, Rayan. Bring me anything with wheels — and if a car is smoking, STOP driving it before it dies on you.",
    hint: "Hint: damaged cars lose power past 60% damage. Fuel stations: Docks, Ferry Quarter, East Yards." },
  { name: "Old Elias", role: "Fisherman — the Pier",
    line: "Tide turns, weather turns faster. When the fog rolls in off the harbour, even the patrol drives slow. Good time to move unseen, that.",
    hint: "Hint: fog and rain shrink how far police can see you. Press Y to check the weather changing." },
  { name: "Det. Mara Voss", role: "Harbour Patrol — Detective",
    line: "For the record, Kade: my officers chase what they can SEE. Break their line of sight, stay hidden, and the stars fall. Get seen again and it's back on.",
    hint: "Hint: at 4+ stars expect roadblocks and the helicopter. Lose sight, reach the search zone edge, wait it out." },
  { name: "Marek Doss", role: "Fixer — patrol payrolls, lost files, quiet weather",
    line: "Kade. I don't know you yet, and that's exactly how I stay useful. Names reach me after Chapter 2 — by then you'll have a file worth burning, most likely.",
    hint: "Hint: the Fixer (after Ch.2) burns your whole evidence file — price = $150 + $6 per evidence point + $200 per star, $250 minimum — once a day, and never while the patrol has eyes on you." },
  { name: "Ines Marlo", role: "Editor — The Harbour Wire (regular at Café Coral)",
    line: "The Wire prints what it can prove, Rayan. After Chapter 4's dust settles, call me — I have an investigation that needs legs the patrol can't be seen using.",
    hint: "Hint: The Harbour Wire arc (after Ch.4) — photograph evidence, tail the courier, run the exposé. Photos: stand in the ring, Phone → Camera → Capture." },
  { name: "Petra Vane", role: "Owner — Eastmere Diner (kept Solano's books, once)",
    line: "I kept Solano's paper books before I kept a diner, Rayan. The old ledger never burned — and now it's moving through my side of the water. After Chapter 3, call me. Quietly.",
    hint: "Hint: The Ledger Line arc (after Ch.3) — tail a courier out of Westbrook, photograph the diner book in Eastmere, then choose: burn it with Petra or publish it with Ines. Calling Petra loads the district her next job lives in." },
  { name: "Dispatch — Ren", role: "Harbour services dispatcher — hospital & fire",
    line: "Ren on dispatch, Kade. The board's never empty: somebody's down on a kerb, somebody's kitchen is lit. Hospital door for the ambulance, station door for the tender — I talk, you drive, the city breathes easier.",
    hint: "Hint: service jobs (from the hospital door / fire station door on the Docks strip) — paramedic: reach the patient on the clock, treat them on foot (hold E), bring them back; firefighter: park close, hose on foot (hold E), and mind the tank — a fire drinks 55 of 100, so refill at a hydrant or the station between fires. Sirens never draw the patrol." },
  { name: "Ana Ruiz", role: "Property manager — Sable Lets",
    line: "Ana Ruiz, Sable Lets. I let flats, townhouses and one very draughty warehouse to people who pay on time — mostly. Buy a unit at its door and I handle everything after: tenants, rent, plumbers. You just read my messages and watch the mornings.",
    hint: "Hint: rental properties (Coral flat $18,000 · Northgate townhouse $32,000 · Docks warehouse $45,000 — the warehouse needs you to own a business first) pay rent every morning through Sable Lets. A repair bill bigger than your cash waits as DUE in SableBank and pauses that unit's rent until it's paid at the door. Sell back any time at 80%." },
  { name: "Tamim Kade", role: "Brother — Port Sable Correctional",
    line: "Little brother. Don't do anything stupid for me, you hear? …Okay. Do the smart kind of stupid. The ledger pages matter more than the money.",
    hint: "Hint: story chapters pay more as they go. The finale pays $2,500." },
  { name: "Victor Solano", role: "Solano Trucking — DO NOT ENGAGE",
    line: "Kade. Debts don't drown in my harbour. They float back up. Watch the water.",
    hint: "He's not a contact. He's a warning." },
];
