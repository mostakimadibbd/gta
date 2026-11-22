// Harborfall story campaign + repeatable missions — all original.
// Story bible: docs/STORY.md
export interface DialogueLine { who: string; text: string; }
export interface MissionDef {
  id: string; story?: boolean; title: string; giver: string;
  intro: DialogueLine[]; outro: DialogueLine[];
  objectiveText: string; kind: "goto" | "delivery" | "collect" | "escape" | "checkpoints" | "tokens";
  targets: [number, number][]; timeLimit: number; payout: number;
  forceWanted?: number; noWanted?: boolean;
}
const L = (who: string, text: string): DialogueLine => ({ who, text });

export const STORY_MISSIONS: MissionDef[] = [
  { id: "s1", story: true, title: "Homecoming", giver: "Lina Park",
    intro: [L("Lina Park", "Rayan? Five years and you just roll off the ferry like nothing happened."), L("Rayan Kade", "I heard Tamim gets out early — if Solano's ledger debt is settled. I'm here to settle it."), L("Lina Park", "Then you'll need wheels that run. Take the Sprinter, drive it to my garage on Market Row. Gently, yeah?")],
    outro: [L("Lina Park", "She still purrs. The garage is yours whenever you need it, Rayan."), L("Rayan Kade", "Thanks, Lina. One favour at a time — that's how I climb out of this.")],
    objectiveText: "Drive to Lina's garage (amber marker)", kind: "goto", targets: [[-40, -28]], timeLimit: 180, payout: 150 },
  { id: "s2", story: true, title: "First Favour", giver: "Old Elias",
    intro: [L("Old Elias", "Kade boy. Your brother mended my nets every winter he was inside. I owe him."), L("Old Elias", "Take this crate of harbour charts to the Ferry Quarter depot — fast, before the tide office closes. Watch the harbour patrol if you rush.")],
    outro: [L("Old Elias", "Delivered. Tamim's a good lad. Whatever Solano says he owes — it ain't the whole story.")],
    objectiveText: "Pick up at the pier, then deliver to the Ferry Quarter depot", kind: "delivery", targets: [[0, 104], [-100, 60]], timeLimit: 150, payout: 300 },
  { id: "s3", story: true, title: "Ledger Run", giver: "Lina Park (for Tamim)",
    intro: [L("Lina Park", "Tamim hid three torn pages of Solano's debt ledger before they took him. Insurance."), L("Rayan Kade", "If I have the pages, Solano can't invent the debt. Where?"), L("Lina Park", "Lantern Park, Gull Heights, the East Yards. I've marked what I remember. Go.")],
    outro: [L("Rayan Kade", "Three pages. Names, dates, bribes — this isn't a debt, it's a leash on half the docks."), L("Lina Park", "Then Solano will come for them. Careful, Rayan.")],
    objectiveText: "Collect the 3 hidden ledger pages", kind: "collect", targets: [[80, -72], [-40, -100], [100, 28]], timeLimit: 300, payout: 500 },
  { id: "s4", story: true, title: "Heat on the Docks", giver: "Rayan Kade",
    intro: [L("Rayan Kade", "Solano's men tipped off the patrol — they want the pages back before I can use them."), L("Lina Park", "Get the pages to the safehouse in the Ferry Quarter. And Rayan — lose the heat first, or you'll lead them straight there.")],
    outro: [L("Lina Park", "Pages are safe. You look terrible. Eat something, then we talk about the detective who's been asking questions.")],
    objectiveText: "Reach the safehouse — but lose your wanted level first", kind: "escape", targets: [[-92, -92]], timeLimit: 300, payout: 650, forceWanted: 3 },
  { id: "s5", story: true, title: "Voss's Bargain", giver: "Detective Mara Voss",
    intro: [L("Det. Mara Voss", "Rayan Kade. I could arrest you three ways — instead, an offer."), L("Det. Mara Voss", "Drive my evidence route: the crane office, the trucking yard, the union hall. Photograph nothing, touch nothing, draw NO heat. Clean run, and I'll take the ledger seriously.")],
    outro: [L("Det. Mara Voss", "Clean. And the pages check out. One last shipment, Rayan — Solano is moving everything out tonight. Stop it, and Tamim walks.")],
    objectiveText: "Drive the evidence route (3 checkpoints) with NO wanted stars", kind: "checkpoints", targets: [[60, 100], [100, -60], [-60, -20]], timeLimit: 300, payout: 800, noWanted: true },
  { id: "s6", story: true, title: "Solano's Last Shipment", giver: "Detective Mara Voss",
    intro: [L("Det. Mara Voss", "Solano's convoy leaves the docks at dusk. Reach the harbour gate before it sails and my team does the rest."), L("Rayan Kade", "Five years, Tamim. This one's for you. Let's finish it.")],
    outro: [L("Det. Mara Voss", "Shipment seized, ledger published. Victor Solano is finished, Rayan."), L("Rayan Kade", "Tamim's free. Tell him his little brother finally paid a debt the right way.")],
    objectiveText: "Race the convoy route to the harbour gate before time runs out", kind: "checkpoints", targets: [[-60, 60], [40, 20], [80, 100], [0, 116]], timeLimit: 210, payout: 2500 },
];

export const REPEATABLE: MissionDef[] = [
  { id: "r1", title: "Harbour Delivery", giver: "Dispatch", intro: [L("Dispatch", "Urgent parcel run across Port Sable. Clock's ticking.")], outro: [L("Dispatch", "Delivered. Payment sent.")],
    objectiveText: "Deliver the parcel before the timer ends", kind: "delivery", targets: [[20, 104], [60, -100]], timeLimit: 140, payout: 350 },
  { id: "r2", title: "Checkpoint Sprint", giver: "Dispatch", intro: [L("Dispatch", "Hit every checkpoint in order. Fast and clean pays best.")], outro: [L("Dispatch", "Clean run. Payment sent.")],
    objectiveText: "Hit all checkpoints in order", kind: "checkpoints", targets: [[-100, -20], [20, -60], [100, 20], [0, 80]], timeLimit: 180, payout: 450 },
  { id: "r3", title: "Harbour Tokens", giver: "Dispatch", intro: [L("Dispatch", "Six harbour tokens are scattered around the city. Grab them all.")], outro: [L("Dispatch", "All tokens in. Payment sent.")],
    objectiveText: "Collect all 6 harbour tokens (gold markers in free roam)", kind: "tokens", targets: [], timeLimit: 300, payout: 400 },
];

export const INTRO_PANELS = [
  { title: "Port Sable, five years later", text: "Rayan Kade left this harbour city on a night ferry with nothing but a duffel bag and a debt that wasn't his. Now he's back." },
  { title: "A brother's debt", text: "His older brother Tamim took the fall for a smuggling run gone wrong — a run for Victor Solano, who runs the docks, the cranes and half the trucking in Port Sable." },
  { title: "The ledger", text: "Solano's debt ledger decides who works, who eats and who disappears. Tamim hid three pages of it. If Rayan can recover them — and pay what Solano claims — Tamim walks free." },
  { title: "Your move, Rayan", text: "Old friends still remember him here: Lina at the garage, Elias at the pier, and a detective named Voss watching Solano from the other side of the law. Drive. Earn. Don't get caught." },
];
export const ENDING_PANEL = {
  title: "Free Men",
  text: "The ledger is public, Solano's empire is in handcuffs, and Tamim Kade walks out of Port Sable prison into the dusk light. Rayan keeps the car, the garage tab is settled, and the harbour is just a harbour again. Free-roam continues — Port Sable is yours now.",
};
