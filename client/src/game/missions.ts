// Harborfall story campaign + repeatable missions — all original.
// Story bible: docs/STORY.md
export interface DialogueLine { who: string; text: string; }
export interface MissionChoice {
  /** Two-button decision shown after the intro dialogue (Phase 5, Ch.5). */
  options: { label: string; flag: string; reply: DialogueLine[] }[];
}
export interface MissionDef {
  id: string; story?: boolean; side?: "lina" | "voss" | "heist" | "after" | "wire" | "ledger" | "quiet" | "crown"; title: string; giver: string;
  intro: DialogueLine[]; outro: DialogueLine[];
  objectiveText: string; kind: "goto" | "delivery" | "collect" | "escape" | "checkpoints" | "tokens" | "photo" | "tail";
  /** Phase 17 ("photo" kind): the first `meetSteps` targets are plain
   * reach steps (the in-world meeting); every later target must be
   * PHOTOGRAPHED — stand in its radius, then take a photo-mode shot. */
  meetSteps?: number;
  /** Phase 27 ("photo" kind): how many of the post-meet steps are
   * PHOTO steps. Absent = all of them (the Wire's shape). Steps
   * beyond the photo steps are plain reach steps — the Ledger Line's
   * second part photographs the diner book, then RUNS. */
  photoSteps?: number;
  /** Phase 27: when the LAST photo step banks and reach steps
   * remain, the mission clock is replaced by this many seconds —
   * the rival crew's timer, on the same visible HUD countdown.
   * (Checkpoint retry refreshes the full clock, per the standing
   * retry contract in missionState.startPlayAt.) */
  runTimer?: number;
  /** Phase 37 ("collect" kind): the popup text shown when a pickup
   * banks. Absent = the engine's historical default ("Ledger page
   * recovered!"), which the Ledger Line's own collect use relies on;
   * the Quiet Harbour's shoreline markers name themselves instead. */
  collectLabel?: string;
  /** Phase 38 audit (\"delivery\" kind): hide the HUD countdown in the
   * objective banner. The mission clock still runs — the timeout
   * stays as a backstop — but a mission designed to have NO time
   * pressure shouldn't wear a ticking 60:00 on screen. quiet2's
   * timeLimit is a full hour against a ~4-minute drive purely
   * because the engine has no timerless mode (see its def comment);
   * it is the only def that sets this. */
  hideTimer?: boolean;
  /** Phase 27 ("tail" kind): the courier van WAITS at its spawn
   * until the player first closes within 55 m — the mission can be
   * accepted by phone from across the map (the Ledger Line starts
   * in Port Sable, its van waits in Westbrook) without the far-fail
   * timer burning while the player travels to the meet. */
  holdStart?: boolean;
  targets: [number, number][]; timeLimit: number; payout: number;
  forceWanted?: number; noWanted?: boolean;
  /** Phase 27: when the mission's choice (altActive) selects the
   * ALT branch, these targets replace `targets` (same length —
   * the step machinery counts steps, and both branches must have
   * the same number). The Ledger Line's finale delivers to two
   * different doors depending on the choice. */
  targetsAlt?: [number, number][];
  /** Phase 27: the choice for this mission is stored in its OWN
   * persisted flag (M.ledgerChoice) instead of the shared
   * M.packChoice — the After the Fall pack already spends
   * packChoice on its own burn/publish call, and the two decisions
   * must never read each other's answer. */
  choiceKey?: "ledger" | "crown";
  /** Phase 5: branching choice after the intro (Ch.5) + Ch.6 variants. */
  choice?: MissionChoice;
  introAlt?: DialogueLine[]; outroAlt?: DialogueLine[]; payoutAlt?: number;
  /** Phase 9: for post-story pack missions, the choice flag that selects
   * the ALT intro/outro/payout (Ch.5 hard-codes "elias" via M.choice;
   * pack missions store theirs in M.packChoice — see altActive()). */
  altFlag?: string;
  /** Phase 15: the mutually-exclusive side pair — starting one sets
   * M.pairChoice and locks the other for this playthrough. */
  pair?: "informant" | "dockcrew";
}
const L = (who: string, text: string): DialogueLine => ({ who, text });

export const STORY_MISSIONS: MissionDef[] = [
  { id: "s1", story: true, title: "Homecoming", giver: "Lina Park",
    intro: [
      L("Lina Park", "Rayan? Five years and you just roll off the ferry like nothing happened."),
      L("Rayan Kade", "You look the same, Lina. The garage smells the same too — oil and bad coffee."),
      L("Lina Park", "And you still lead with jokes when you're scared. I heard about Tamim. Parole board meets in spring — but only if Solano's ledger debt shows as settled."),
      L("Rayan Kade", "Then I'm here to settle it. Every cent he claims, I'll earn or expose. Start with wheels — mine are at the bottom of the bay, metaphorically."),
      L("Lina Park", "Take the Sprinter out front. Drive it back here to my garage on Market Row so I can check the alignment. Gently, yeah? She bites."),
    ],
    outro: [
      L("Lina Park", "She still purrs. Alignment's true, brakes are honest. The garage is yours whenever you need it, Rayan."),
      L("Rayan Kade", "Thanks, Lina. One favour at a time — that's how I climb out of this."),
      L("Lina Park", "Then climb fast. Solano's people already asked about you at the market. Word travels on water here."),
    ],
    objectiveText: "Drive to Lina's garage (amber marker)", kind: "goto", targets: [[-40, -28]], timeLimit: 180, payout: 150 },
  { id: "s2", story: true, title: "First Favour", giver: "Old Elias",
    intro: [
      L("Old Elias", "Kade boy. Sit a moment. Your brother mended my nets every winter he was inside — sent the twine through Lina, wouldn't take a cent."),
      L("Rayan Kade", "That's Tamim. Pays debts that aren't his. It's how Solano hooked him in the first place."),
      L("Old Elias", "Aye. So here's my owing, paid forward: a crate of harbour charts for the Ferry Quarter depot. Tide office closes soon — they fine late boats, and I'm too old to run."),
      L("Old Elias", "Take the pier road. And if the harbour patrol clocks you rushing… well. You've still got your father's hands on a wheel, I hope."),
      L("Rayan Kade", "Charts, depot, no drama. Consider it done, old man."),
    ],
    outro: [
      L("Old Elias", "Delivered, and the tide clerk smiled — rare as a calm bay, that."),
      L("Old Elias", "Tamim's a good lad. Whatever Solano says he owes — it ain't the whole story. Ledgers can lie, Rayan. Paper lies easier than people."),
      L("Rayan Kade", "Then I'll find paper that tells the truth."),
    ],
    objectiveText: "Pick up at the pier, then deliver to the Ferry Quarter depot", kind: "delivery", targets: [[0, 104], [-100, 60]], timeLimit: 150, payout: 300 },
  { id: "s3", story: true, title: "Ledger Run", giver: "Lina Park (for Tamim)",
    intro: [
      L("Lina Park", "Tamim called from inside. Collect call, thirty seconds, and he spent all of it on one sentence."),
      L("Rayan Kade", "Let me guess. 'Don't come.'"),
      L("Lina Park", "Worse. 'The pages are real.' Before they took him, he tore three pages out of Solano's debt ledger and hid them around the city. Insurance."),
      L("Rayan Kade", "If I hold those pages, Solano can't invent the debt — the parole board sees the real numbers."),
      L("Lina Park", "Lantern Park, Gull Heights, the East Yards. I've marked what I remember from his letters. Go — and Rayan, if he hid them well, it's because people died for less."),
    ],
    outro: [
      L("Rayan Kade", "Three pages. Names, dates, bribes — harbour masters, a judge's clerk, two patrol sergeants. This isn't a debt book, Lina. It's a leash on half the docks."),
      L("Lina Park", "Then Solano will come for them. And for you. Keep them moving — never sleep where the pages sleep."),
      L("Rayan Kade", "Noted. Tell Tamim the insurance paid out."),
    ],
    objectiveText: "Collect the 3 hidden ledger pages", kind: "collect", targets: [[80, -72], [-40, -100], [100, 28]], timeLimit: 300, payout: 500 },
  { id: "s4", story: true, title: "Heat on the Docks", giver: "Rayan Kade",
    intro: [
      L("Rayan Kade", "It's started. Two of Solano's men were watching the garage, and a patrol car just rolled past for the third time."),
      L("Lina Park", "He tipped them off — anonymous call, stolen evidence, your name spelled right. They want the pages back before anyone official reads them."),
      L("Rayan Kade", "There's a safehouse in the Ferry Quarter. Elias's niece keeps it. If I can reach it clean, the pages disappear into good hands."),
      L("Lina Park", "Then lose the heat FIRST, Rayan. Break their line of sight, go quiet, let them search the wrong streets. Lead them to that door and we're all finished."),
    ],
    outro: [
      L("Lina Park", "Pages are safe. You look terrible — sit. Eat. Then we talk."),
      L("Rayan Kade", "About what?"),
      L("Lina Park", "About the detective who's been asking questions at the market. Mara Voss. She isn't Solano's — she might be the first honest cop this harbour's produced. Or a better liar than the rest."),
    ],
    objectiveText: "Reach the safehouse — but lose your wanted level first", kind: "escape", targets: [[-92, -92]], timeLimit: 300, payout: 650, forceWanted: 3 },
  { id: "s5", story: true, title: "Voss's Bargain", giver: "Detective Mara Voss",
    intro: [
      L("Det. Mara Voss", "Rayan Kade. I could arrest you three ways before this coffee cools — the ferry manifest, the East Yards, that little drive you took at 3 a.m."),
      L("Rayan Kade", "But you won't. Detectives who want arrests don't buy the coffee first."),
      L("Det. Mara Voss", "Smart. Dangerous, but smart. Here's my offer: drive my evidence route — the crane office, the trucking yard, the union hall. Photograph nothing, touch nothing, draw NO heat. A clean run."),
      L("Det. Mara Voss", "Do that, and I'll take your brother's ledger pages seriously. Chain of custody, real investigators, the works. Solano's been untouchable for a decade because nobody hands me a clean thread to pull."),
      L("Rayan Kade", "And if the run isn't clean?"),
      L("Det. Mara Voss", "Then you're a smuggler who stole evidence, and I arrest you with a clear conscience. Deal?"),
    ],
    outro: [
      L("Det. Mara Voss", "Clean. Every checkpoint, no heat, no calls on the radio. I'm… impressed, and I don't say that to suspects."),
      L("Rayan Kade", "The pages check out too, I take it."),
      L("Det. Mara Voss", "They check out. One last thing, Rayan — Solano knows the walls are closing. He's moving everything out tonight, one shipment, whole empire in crates. Stop it, and Tamim walks."),
    ],
    objectiveText: "Drive the evidence route (3 checkpoints) with NO wanted stars", kind: "checkpoints", targets: [[60, 100], [100, -60], [-60, -20]], timeLimit: 300, payout: 800, noWanted: true,
    choice: {
      options: [
        { label: "Take Voss's deal — the pages go official", flag: "voss", reply: [
          L("Rayan Kade", "Deal. The pages go through your chain of custody — every copy witnessed, every name read into the record."),
          L("Det. Mara Voss", "Then tonight we do this by the book. My book. Don't improvise, Kade."),
        ] },
        { label: "Warn Elias first — the docks protect their own", flag: "elias", reply: [
          L("Rayan Kade", "One call first, Detective. Elias's people are named in those pages as couriers. If your raid lands cold, they'll be arrested as smugglers, not witnesses."),
          L("Det. Mara Voss", "You're spending my goodwill, Kade. …One call. Short. And tonight you owe me a clean run AND a quiet harbour."),
          L("Old Elias", "(phone) Aye, lad. We'll be home with our families tonight, every one. The docks remember who warned them."),
        ] },
      ],
    } },
  { id: "s6", story: true, title: "Solano's Last Shipment", giver: "Detective Mara Voss",
    intro: [
      L("Det. Mara Voss", "Solano's convoy leaves the docks at dusk. Reach the harbour gate before it sails and my team does the rest."),
      L("Rayan Kade", "Five years, Tamim. This one's for you. Let's finish it."),
    ],
    outro: [
      L("Det. Mara Voss", "Shipment seized, ledger published. Victor Solano is finished, Rayan."),
      L("Rayan Kade", "Tamim's free. Tell him his little brother finally paid a debt the right way."),
      L("Det. Mara Voss", "He'll hear it from me at the gate. Go home, Kade. Both of you."),
    ],
    objectiveText: "Race the convoy route to the harbour gate before time runs out", kind: "checkpoints", targets: [[-60, 60], [40, 20], [80, 100], [0, 116]], timeLimit: 210, payout: 2500,
    introAlt: [
      L("Old Elias", "The word's out, Rayan — every dock family is home tonight, lamps lit, doors shut. Nobody sees anything. That's your gift, and it's worth more than money."),
      L("Det. Mara Voss", "(radio) Kade — my team is stretched thin covering the empty docks, so the reward split changes. You get less cash, but the harbour owes you its thanks. Now move — the convoy still sails at dusk."),
      L("Rayan Kade", "Five years, Tamim. This one's for you — and for every name in that ledger. Let's finish it."),
    ],
    outroAlt: [
      L("Det. Mara Voss", "Shipment seized, ledger published. Victor Solano is finished — and not one dock worker in my cells. Your call did that, Kade."),
      L("Old Elias", "Tamim walks free at dawn, lad. The whole pier will be there. Quiet-like. Family."),
      L("Rayan Kade", "Tell him his little brother paid the debt the right way — and the harbour paid its share too."),
    ],
    payoutAlt: 1800 },
];

// ---- Phase 5 side storylines (Step 7a): offered by phone Contacts once
// unlocked; progress persists in missionState (M.side). They run through
// the same mission framework — markers, timers, debriefs — as the story.
export const SIDE_MISSIONS: MissionDef[] = [
  { id: "lina1", side: "lina", title: "Lina's Line I — Parts Run", giver: "Lina Park",
    intro: [
      L("Lina Park", "Rayan, favour with a wage attached. Solano Trucking's yard owes me a gearbox from a job last spring — it's sitting in a crate by the crane office, and their clerk suddenly 'can't find the paperwork'."),
      L("Rayan Kade", "So I liberate it."),
      L("Lina Park", "You RESCUE it. Bring it to the garage and I'll finally finish the Gullwing build. Careful — yard dogs notice strangers."),
    ],
    outro: [
      L("Lina Park", "That's the one — teeth clean, seals fresh. You're wasted on honest work, you know that?"),
      L("Rayan Kade", "Keep the wage coming and I'll keep rescuing your property, Lina."),
    ],
    objectiveText: "Collect the gearbox at the trucking yard, deliver it to Lina's garage", kind: "delivery", targets: [[60, 100], [-40, -28]], timeLimit: 240, payout: 275 },
  { id: "lina2", side: "lina", title: "Lina's Line II — Rival Colours", giver: "Lina Park",
    intro: [
      L("Lina Park", "The East Yards crew — 'Torque Kings' — have been undercutting me and bad-mouthing the garage. Last week they loosened a customer's wheel nuts. A CUSTOMER, Rayan."),
      L("Rayan Kade", "That's not rivalry, that's attempted harm. What do you want done?"),
      L("Lina Park", "Nothing violent. Two of their vans, parked at their yard. A bag of sugar in each fuel tank — old dock justice. They'll spend a week cleaning lines instead of loosening wheels."),
      L("Lina Park", "On foot, quiet, and don't get seen doing it. Sugar's in a paper bag. Very professional operation, this."),
    ],
    outro: [
      L("Lina Park", "Both vans? Beautiful. Their mechanic will be tasting sweetness for a month."),
      L("Rayan Kade", "Dock justice. You're a menace with a spanner, Lina Park."),
    ],
    objectiveText: "Sugar the two Torque Kings vans in the East Yards (on foot, stay unseen)", kind: "collect", targets: [[100, 20], [104, 32]], timeLimit: 240, payout: 400 },
  { id: "lina3", side: "lina", title: "Lina's Line III — Race Prep", giver: "Lina Park",
    intro: [
      L("Lina Park", "The Gullwing's finished. And I've got a buyer — a collector in Coral Shores who pays in cash and doesn't ask about provenance."),
      L("Rayan Kade", "You want me to drive it across the bridge."),
      L("Lina Park", "I want you to drive it across the bridge LIKE YOU STOLE IT — carefully. She's the fastest thing I've ever built. Bring her home safe and the cut is yours."),
    ],
    outro: [
      L("Lina Park", "(phone) Buyer just called — 'flawless, tell your driver he's an artist.' He paid in full, Rayan. Your cut's in your account."),
      L("Rayan Kade", "Tell her next owner the truth: she was built by the best mechanic on this harbour."),
    ],
    objectiveText: "Deliver the Gullwing parts crate across the bay to the Coral Shores buyer", kind: "delivery", targets: [[-40, -28], [72, 264]], timeLimit: 300, payout: 550 },
  { id: "voss1", side: "voss", title: "Voss's File I — The File Opens", giver: "Detective Mara Voss",
    intro: [
      L("Det. Mara Voss", "Off the record, Kade. There's a manifest book in the crane office at the docks — the real one, with Solano's handwriting. My warrant for it keeps getting 'delayed' by friends of his."),
      L("Rayan Kade", "And a civilian who happens to pick it up…"),
      L("Det. Mara Voss", "…is a thief I'd have to arrest, unless it reaches the dead drop at the union hall anonymously. Get it. Don't be seen carrying it out."),
    ],
    outro: [
      L("Det. Mara Voss", "The book is in evidence. Half the names match your brother's pages — two sources, same handwriting. Solano's lawyers just felt a chill and don't know why."),
      L("Rayan Kade", "Happy to chill them further, Detective."),
    ],
    objectiveText: "Take the manifest book from the crane office", kind: "collect", targets: [[60, 100]], timeLimit: 240, payout: 350 },
  { id: "voss2", side: "voss", title: "Voss's File II — Shadow the Courier", giver: "Detective Mara Voss",
    intro: [
      L("Det. Mara Voss", "Solano's courier runs a loop tonight — market, ferry road, the union hall. I need his stops confirmed, but my cars are known."),
      L("Rayan Kade", "You want me to shadow his route."),
      L("Det. Mara Voss", "His ROUTE, Kade — the stops, in order. Keep your distance, draw no attention, and above all no heat. If the patrol notices you, the courier burns the route and we're blind."),
    ],
    outro: [
      L("Det. Mara Voss", "Three stops, exact timings. You have a talent for being unremarkable, Kade. It's almost disappointing."),
      L("Rayan Kade", "Years of practice, Detective."),
    ],
    objectiveText: "Shadow the courier's route — hit each stop in order, draw NO heat", kind: "checkpoints", targets: [[20, 60], [-20, 20], [-60, -20]], timeLimit: 300, payout: 500, noWanted: true },
  { id: "voss3", side: "voss", title: "Voss's File III — Dead Drop", giver: "Detective Mara Voss",
    intro: [
      L("Det. Mara Voss", "Last piece. A sealed packet at the union hall — witness statements, signed. It needs to reach the Ferry Quarter safehouse before Solano's people work out where it is."),
      L("Rayan Kade", "Pickup, drive, drop. My whole skill set in one job."),
      L("Det. Mara Voss", "Then the file closes, Kade — and a copy lands on the parole board's desk with a very favourable cover note about the Kade family."),
    ],
    outro: [
      L("Det. Mara Voss", "Packet received. The file is closed, complete, and — between us — beautiful. The parole board gets its copy tomorrow."),
      L("Rayan Kade", "Then we're done, Detective. Unless the harbour needs us again."),
      L("Det. Mara Voss", "The harbour always needs us, Kade. That's the job."),
    ],
    objectiveText: "Pick up the witness packet at the union hall, drop it at the Ferry Quarter safehouse", kind: "delivery", targets: [[-60, -20], [-92, -92]], timeLimit: 280, payout: 650 },
  // ---- Phase 7: THE HARBOUR HEIST — a two-stage chain from Old Elias
  // (call him after Chapter 4). Prep quality is tracked in missionState:
  // finishing Prep unseen banks a bonus for the Strongroom payout.
  { id: "heist1", side: "heist", title: "The Harbour Heist I — Prep Night", giver: "Old Elias",
    intro: [
      L("Old Elias", "Sit down, lad. What I'm about to say doesn't leave this pier. Solano's counting house keeps a strongroom at the East Yards warehouse — cash, bonds, and the harbour's rainy-day sins."),
      L("Rayan Kade", "You've been planning this since before I came home, haven't you."),
      L("Old Elias", "Since the winter they took Tamim. Tonight we PREP. First: the Ferry Van at the East Yards — that's our getaway, inconspicuous as a gull. Drive it, learn it, leave it ready."),
      L("Old Elias", "Then two supply crates: one at the crane office, one by the broken-down wreck on Ferry Road. Drill, masks, thermite pencils. Quietly, Rayan. If nobody sees the prep, the job's half done."),
      L("Rayan Kade", "And if somebody does see?"),
      L("Old Elias", "Then we still go — we just earn less and run harder. Harbour rules."),
    ],
    outro: [
      L("Old Elias", "Van's ready, crates are ours. You move like harbour mist when you want to, boy."),
      L("Rayan Kade", "Tomorrow night, then. The strongroom."),
      L("Old Elias", "Tomorrow night. Sleep first — a tired thief is a caught thief. Call me when you're ready."),
    ],
    objectiveText: "Prep the heist: check the getaway van, then collect 2 supply crates (unseen prep pays a bonus)", kind: "delivery", targets: [[97, 40], [60, 100], [-64, 44]], timeLimit: 300, payout: 500 },
  { id: "heist2", side: "heist", title: "The Harbour Heist II — The Strongroom", giver: "Old Elias",
    intro: [
      L("Old Elias", "It's tonight. The warehouse strongroom, East Yards. The drill takes six seconds that will feel like six years — the alarm wakes the moment the bit bites."),
      L("Rayan Kade", "Drill, grab, run to the safehouse. Lose the heat before the door. I've danced this one before, old man."),
      L("Old Elias", "Not like this. Half that room is dock money Solano stole in ledger ink. Take it back, and half the harbour eats this winter. Tamim's name comes off the last page too."),
      L("Rayan Kade", "Then let's go take it back."),
    ],
    outro: [
      L("Old Elias", "Done. DONE. The counting house is empty, the dock fund is home, and Solano's rainy day just flooded."),
      L("Rayan Kade", "Split it quiet, Elias. Every family on the ledger first. My cut last."),
      L("Old Elias", "Your father would've said the same. The harbour provides, Kade. Tonight, so did you."),
    ],
    objectiveText: "Drill the strongroom (hold position 6s), then escape to the safehouse — lose your heat first", kind: "escape", targets: [[100, 28], [-92, -92]], timeLimit: 360, payout: 1600 },
  // ---- Phase 9: AFTER THE FALL — the post-story mission pack. Offered
  // by phone once the campaign is finished (M.storyDone): Lina, then
  // Voss (with the pack's own branching choice), then Elias.
  { id: "after1", side: "after", title: "After the Fall I — Tamim's First Shift", giver: "Lina Park",
    intro: [
      L("Lina Park", "He's out, Rayan. Parole granted, papers signed — Tamim walks out of the harbour patrol's custody office this morning a free man."),
      L("Rayan Kade", "Five years I pictured this. Tell me he's really—"),
      L("Lina Park", "He's really. But free men still need a first shift, and my parts run won't drive itself. Pick him up at the HQ steps and bring him to the garage. Let him ride home in style."),
      L("Rayan Kade", "First thing he's done in five years is ride shotgun with me. The harbour has a sense of humour after all."),
    ],
    outro: [
      L("Tamim Kade", "You drive better than you write letters, brother. Five years of my cooking in there — your turn to feed me."),
      L("Lina Park", "Boys. There's work, there's food, and for once — nobody's chasing either of you. Get used to it."),
      L("Rayan Kade", "One day at a time, Lina. One day at a time."),
    ],
    objectiveText: "Pick Tamim up at the Patrol HQ steps, then drive him to Lina's garage", kind: "delivery", targets: [[-64, 100], [-40, -28]], timeLimit: 240, payout: 400 },
  { id: "after2", side: "after", title: "After the Fall II — The Ledger's Ashes", giver: "Detective Mara Voss",
    intro: [
      L("Det. Mara Voss", "One loose end, Kade. Copies of Solano's ledger still sit in the counting house strongroom annex — the originals convicted him, but copies in the wrong hands start the whole machine again."),
      L("Rayan Kade", "And you can't be seen taking them. Officially they don't exist."),
      L("Det. Mara Voss", "Officially. So: you go to the counting house and decide what Port Sable deserves. The Harbour Wire would print them — every name, every bribe, harbour-wide. Or they burn, and this city gets to forget."),
      L("Rayan Kade", "Truth or peace. You've gotten philosophical since the trial, Detective."),
    ],
    choice: { options: [
      { label: "Publish them — the whole harbour reads the names", flag: "publish", reply: [
        L("Rayan Kade", "Sunlight, then. Every name in print. Let the harbour judge its own."),
        L("Det. Mara Voss", "The Wire will need the copies by morning. Go."),
      ] },
      { label: "Burn them — let Port Sable forget", flag: "burn", reply: [
        L("Rayan Kade", "Some pages only ever hurt the people trying to live past them. They burn."),
        L("Det. Mara Voss", "Then burn them properly, Kade. Ashes don't testify."),
      ] },
    ] },
    introAlt: [
      L("Det. Mara Voss", "One loose end, Kade. Copies of Solano's ledger still sit in the counting house strongroom annex — the originals convicted him, but copies in the wrong hands start the whole machine again."),
      L("Rayan Kade", "And you can't be seen taking them. Officially they don't exist."),
      L("Det. Mara Voss", "Officially. So: you go to the counting house and decide what Port Sable deserves. The Harbour Wire would print them — every name, every bribe, harbour-wide. Or they burn, and this city gets to forget."),
      L("Rayan Kade", "Truth or peace. You've gotten philosophical since the trial, Detective."),
    ],
    outro: [
      L("Harbour Wire (headline)", "THE LEDGER, IN FULL: every name Solano owned, printed on page one. By noon, three harbour officials had resigned."),
      L("Det. Mara Voss", "You chose the loud road, Kade. Half the docks are furious — and the other half are finally sleeping. The Wire sends its thanks, and its cheque."),
    ],
    outroAlt: [
      L("Rayan Kade", "It's done. The annex smells of smoke and old paper. Nobody will ever read those names again."),
      L("Det. Mara Voss", "And the districts will forget your face a little faster now, too — ash has a way of settling reputations. The harbour owes you quiet, Kade. Collect it slowly."),
    ],
    objectiveText: "Reach the counting house at the East Yards and settle the ledger copies", kind: "goto", targets: [[100, 28]], timeLimit: 240, payout: 900, payoutAlt: 500, altFlag: "burn" },
  { id: "after3", side: "after", title: "After the Fall III — Harbour Lights", giver: "Old Elias",
    intro: [
      L("Old Elias", "The regatta committee's short a safety boat, and I've gone and volunteered yours truly's favourite nephew-by-harbour-law."),
      L("Rayan Kade", "I'm not your nephew, Elias."),
      L("Old Elias", "Harbour law says otherwise. Run the lights: pier, the west channel, the island dock, and home. Show the young ones how a Kade crosses water."),
      L("Rayan Kade", "A race with no one chasing me. Novel. Where do I sign?"),
    ],
    outro: [
      L("Old Elias", "Clean water, clean lines. Tamim watched from the pier — laughed the whole way, boy. First time I've heard that in five years."),
      L("Rayan Kade", "Then it was worth more than the purse. Same time next year, old man."),
      L("Old Elias", "Same time every year. The harbour provides, Kade. Now — so do you."),
    ],
    objectiveText: "Run the regatta lights BY BOAT: pier → west channel → island dock → home", kind: "checkpoints", targets: [[4, 140], [-40, 152], [-64, 168], [12, 124]], timeLimit: 300, payout: 700 },
  // ---- Phase 17: THE HARBOUR WIRE — an investigation arc for the
  // harbour's newspaper, offered by its editor Ines Marlo (Phone
  // contacts, after Chapter 4) with the first meeting in person at
  // Café Coral. Three parts: photograph the evidence, tail the
  // courier, run the exposé to the newsroom under heat. Progress
  // persists in M.side.wire like every other arc. ----
  { id: "wire1", side: "wire", title: "The Harbour Wire I — Dead Drops and Coffee", giver: "Ines Marlo",
    intro: [
      L("Ines Marlo", "(phone) Rayan Kade? Ines Marlo — I edit the Harbour Wire. Before you hang up: I am not the patrol, and I don't print names I can't prove."),
      L("Rayan Kade", "Editors usually want something. Usually for free."),
      L("Ines Marlo", "I pay. And what I want is proof — Solano's people are rebuilding the ledger in the open since the trial, and my photographers keep getting their cameras 'dropped'. Meet me at Café Coral. Come as a customer, not a story."),
      L("Rayan Kade", "Coffee, then. And Ines — if this is a setup, I walk, and your paper prints weather forever."),
      L("Ines Marlo", "Deal. Table by the window. I'll be the one pretending not to watch the door."),
    ],
    outro: [
      L("Ines Marlo", "Crane office, counting house, the trucking yard — timestamps, faces, plates. This is evidence, Rayan, not gossip. My lawyers just smiled, and they never smile."),
      L("Rayan Kade", "Your lawyers smile at photographs of trucks?"),
      L("Ines Marlo", "At photographs that hold up. Next: there's a courier moving the new ledger pages by road, nights. I need his route proved — every stop, in order. Can you follow a man without him knowing?"),
      L("Rayan Kade", "I can be furniture with a steering wheel."),
    ],
    objectiveText: "Meet Ines at Café Coral, then photograph 3 evidence spots (stand in the ring → Phone → Camera → Capture)", kind: "photo", meetSteps: 1, targets: [[8, 100.6], [60, 100], [100, 28], [97, 40]], timeLimit: 420, payout: 450 },
  { id: "wire2", side: "wire", title: "The Harbour Wire II — The Courier's Loop", giver: "Ines Marlo",
    intro: [
      L("Ines Marlo", "The courier runs tonight — a grey van, no markings, out of the East Yards. He makes four stops. I need you behind him for every one, close enough to swear to it in print."),
      L("Rayan Kade", "And if he makes me?"),
      L("Ines Marlo", "Then he burns the route and the pages move by boat, and we're blind for a month. Stay in the band, Rayan — twelve to forty-five metres. Too close spooks him, too far loses him. Journalists call it shadowing. You'll call it patience."),
      L("Rayan Kade", "Patience. In a car. Behind a smuggler. Wonderful brief, editor."),
      L("Ines Marlo", "Print-worthy patience pays $600."),
    ],
    outro: [
      L("Ines Marlo", "Four stops, timed to the minute, and he never once looked in his mirror. That's a route a jury can read. The pages move on Tuesdays, Rayan — you've just told the whole harbour, once we print."),
      L("Rayan Kade", "Once you print. There's a third act coming, isn't there."),
      L("Ines Marlo", "There's a hard drive coming. My source inside the trucking yard will hand it over — but only to the man the courier never saw. That's you. And Solano's people will be looking for it the moment it moves."),
    ],
    objectiveText: "Tail the courier van — stay 12–45 m behind it through all 4 stops (too close spooks him, too far loses him)", kind: "tail", targets: [[100, 20], [20, 60], [-60, 20], [-60, -60]], timeLimit: 420, payout: 600 },
  { id: "wire3", side: "wire", title: "The Harbour Wire III — Print Run", giver: "Ines Marlo",
    intro: [
      L("Ines Marlo", "(at Café Coral) It's here — the yard's own drive: routes, payments, the new ledger's skeleton. Everything the photos and the tail were pointing at."),
      L("Rayan Kade", "And the two men by the door who stopped drinking when I walked in?"),
      L("Ines Marlo", "Solano's. The moment you leave with this, the patrol gets an 'anonymous tip' about a stolen drive — you'll be running at two stars and they'll call it justice. Get it to my newsroom on Market Row before the edition closes. If they take you, the drive is evidence and the story dies."),
      L("Rayan Kade", "So: drive fast, don't get caught, save the free press. Another quiet Tuesday in Port Sable."),
      L("Ines Marlo", "Print it, and the harbour reads the truth at breakfast. Fail, and we print weather. Go, Rayan."),
    ],
    outro: [
      L("Ines Marlo", "It's in. Typesetters are running — front page, above the fold, the whole machine laid out with the harbour's coffee. You just made the Wire the bravest paper in Port Sable, Rayan."),
      L("Rayan Kade", "And me the most photographed man in it. Print my good side, editor."),
      L("Ines Marlo", "We only print the truth. …Which, for once, IS your good side. The Wire owes you — and this harbour reads its debts at breakfast."),
    ],
    objectiveText: "Take the drive from Café Coral to the Harbour Wire newsroom on Market Row — the patrol will be tipped off (2★)", kind: "delivery", targets: [[8, 100.6], [20, -20]], timeLimit: 240, payout: 850, forceWanted: 2 },
  // ---- Phase 27: THE LEDGER LINE — a streamed-district arc for
  // Petra Vane, keeper of the Eastmere Diner (and, before the trial,
  // of Solano's paper books). Offered by phone after Chapter 3.
  // Solano's OLD smuggling ledger — the real one, in his own hand —
  // is moving through Eastmere and Westbrook; Petra wants its route
  // proved, its twin photographed, and its fate chosen quietly,
  // before the Harbour Wire (Ines Marlo, the arc's other pole) turns
  // it into a harbour war. Starting part 1 or 2 is GATED on the
  // mission's district being loaded (App's Petra contact handler
  // drives the shared streamed loader and refuses cleanly if the
  // chunk fails) — a mission never starts into an unloaded district.
  { id: "ledger1", side: "ledger", title: "The Ledger Line I — Cold Storage", giver: "Petra Vane",
    intro: [
      L("Petra Vane", "(phone) Rayan Kade? Petra Vane — I keep the Eastmere Diner, and before that, I kept Solano's books. The paper kind. Listen carefully."),
      L("Rayan Kade", "I'm listening. People who kept Solano's books don't usually call me from this side of the water."),
      L("Petra Vane", "The old ledger — the real one, pre-trial, smuggling routes in his own hand — never burned. And now it's moving: a crew is scouting its old route, Westbrook to the Ferry Quarter, in a grey courier van out of the silo quay."),
      L("Rayan Kade", "And the Harbour Wire would pay well for that route."),
      L("Petra Vane", "Ines Marlo would print it and call it justice, and three crews would go to war over the names in it by Friday. I want it PROVED first — quietly. The van's idling at the silo quay while its driver waits on a tide window — it rolls the moment the window opens, so be behind it BEFORE it does. Follow it. Every stop. Don't be seen."),
      L("Rayan Kade", "Get to Westbrook, sit behind a van, be furniture. I've done worse for less, Petra."),
    ],
    outro: [
      L("Petra Vane", "(phone) Four stops, and he never looked in his mirror once. The route's real — Westbrook quay to the Ferry Quarter warehouse, same as the old days."),
      L("Rayan Kade", "Your crew scout drives like the road owes him money."),
      L("Petra Vane", "He's not mine — that's the point. They know the road now. Next: my diner, in Eastmere. There's a book by my delivery hatch I need photographed before that crew comes looking for it. Call me when you're ready to move fast."),
    ],
    objectiveText: "Meet the courier van at the Westbrook silo quay, then tail it to the Ferry Quarter warehouse — stay 12–45 m behind it through all 4 stops", kind: "tail", holdStart: true, targets: [[-178, 48], [-164, 20], [-100, 20], [-100, 60]], timeLimit: 600, payout: 500 },
  { id: "ledger2", side: "ledger", title: "The Ledger Line II — The Diner Safe", giver: "Petra Vane",
    intro: [
      L("Petra Vane", "(phone) The delivery book, Rayan. It sits by my diner's hatch — every route the old ledger ever ran, copied in Solano's hand the winter before the trial. The crew you followed has worked out it exists."),
      L("Rayan Kade", "And a book like that is worth money. Or worth burning."),
      L("Petra Vane", "Both, to different people. Photograph it — the pages that matter are on the hatch clipboard; your phone will do. Proof, whatever happens next."),
      L("Petra Vane", "Then run the photographs to the Northgate Loft — there's a lockbox there that owes me favours. The crew is already rolling toward my diner; if they reach it and move the book before your photos are safe, we're holding pictures of nothing. Beat them."),
    ],
    outro: [
      L("Petra Vane", "(phone) The lockbox took them — good. And the crew? Reached my diner behind you, found a hatch book of yesterday's fish orders, and left swearing. The twin fooled them."),
      L("Rayan Kade", "The delivery book was a decoy?"),
      L("Petra Vane", "The delivery book was BAIT with true pages, Kade — the routes are real, the book is not the ledger. The ledger itself sits in the Ferry Quarter warehouse, where your van led you. Last job: the book itself travels, once — and you choose where. Call me."),
    ],
    objectiveText: "Photograph the diner's delivery book (stand in the ring → Phone → Camera → Capture), then beat the rival crew to the Northgate Loft", kind: "photo", photoSteps: 1, runTimer: 150, targets: [[60, -252.5], [-68, -195.2]], timeLimit: 420, payout: 650 },
  { id: "ledger3", side: "ledger", title: "The Ledger Line III — Burn or Publish", giver: "Petra Vane",
    intro: [
      L("Petra Vane", "(phone) The warehouse, Rayan. The ledger's in a fish crate by the depot door — the real one, Solano's hand, every route and every name he ever owned. After tonight it stops existing as a weapon. The only question is whose hands unmake it."),
      L("Rayan Kade", "Yours, in a stove. Or Ines Marlo's, on a front page."),
      L("Petra Vane", "Mine, and it BURNS — the districts forget, the crews stand down, and nobody's son gets arrested for a name his father wrote in 1998. Or hers — and the whole harbour reads it at breakfast, and whatever falls, falls. I won't pretend either is clean. Choose with your eyes open."),
    ],
    choice: { options: [
      { label: "Take it to Petra in Eastmere — the ledger burns", flag: "ledger-burn", reply: [
        L("Rayan Kade", "It burns, Petra. Some paper only ever hurt the people trying to live past it."),
        L("Petra Vane", "Then bring it home to my diner, Kade. I'll have the stove lit and the door shut. Quietly, now."),
      ] },
      { label: "Take it to Ines at the Wire — the harbour reads it all", flag: "ledger-publish", reply: [
        L("Rayan Kade", "Sunlight, Petra. Ines prints it — every name — and the harbour judges its own."),
        L("Petra Vane", "Then drive it to her newsroom on Market Row and don't stop for anyone. …I kept those books honestly, Kade. If they must speak, let them speak true."),
      ] },
    ] },
    outro: [
      L("Ines Marlo", "That's — this is the whole thing. His hand, his routes, names I have chased for two years in the margins. It runs tomorrow, above the fold. All of it."),
      L("Det. Mara Voss", "(phone) Kade. Whatever the Wire prints tomorrow, my office reads it with warrants open. Some of those names are about to have a very honest week."),
      L("Rayan Kade", "Print it true, Ines. Every name. That's the whole job."),
    ],
    outroAlt: [
      L("Petra Vane", "Give it here. …Forty years of other men's debts. Smell that? That's a harbour forgetting, one page at a time."),
      L("Rayan Kade", "And the crews who were hunting it?"),
      L("Petra Vane", "Will hear it burned from three mouths by morning — mine, the stove's, and the wind's. Eastmere and Westbrook sleep quiet tonight, Kade. You bought that. Take the money and let the water keep the ashes."),
    ],
    objectiveText: "Pick up the ledger at the Ferry Quarter warehouse, then deliver it to the door you chose", kind: "delivery", targets: [[-100, 60], [20, -20]], targetsAlt: [[-100, 60], [60, -252.5]], timeLimit: 360, payout: 700, payoutAlt: 900, altFlag: "ledger-burn", choiceKey: "ledger" },
  // ---- Phase 37: THE QUIET HARBOUR — post-story arc II (side key
  // "quiet", per slot, requires M.storyDone). The city AFTER Solano:
  // no cartels, no timers that matter — people. Old Elias gives the
  // first and last parts; Lina Park gives the middle one. The arc's
  // real reward is a brass plaque on the Coral Shores bench, rendered
  // in the world once part 3 completes (components/QuietHarbour.tsx);
  // the payouts are deliberately small — part 3's $250 is a gift FROM
  // Elias, framed as his in the outro, riding the standard payout
  // path like every other completion.
  { id: "quiet1", side: "quiet", title: "The Quiet Harbour I — What the Tide Left", giver: "Old Elias",
    intro: [
      L("Old Elias", "Rayan. It's Elias. No trouble this time — that's the strange part."),
      L("Old Elias", "Harbour office is pulling Solano's old mooring markers off the shoreline. Brass discs, his crest on them. Three left on the town beach."),
      L("Old Elias", "Walk the shore and lift them for me, would you? I'd do it myself, but my knees have opinions about sand."),
      L("Rayan Kade", "You want souvenirs of Solano?"),
      L("Old Elias", "I want them GONE. There's a difference. A harbour keeps what it keeps — it doesn't have to keep his name on the waterline."),
    ],
    outro: [
      L("Old Elias", "Three. That's the last of them, then."),
      L("Old Elias", "You know what this beach was, before him? Net-menders. Kids racing the ferry wash. Nobody looked over their shoulder at the water."),
      L("Old Elias", "It's that again. Took forty years and one stubborn family. Walk home slow, Rayan. The harbour's in no hurry anymore."),
    ],
    objectiveText: "Walk the town shoreline and lift Solano's three old mooring markers", kind: "collect", collectLabel: "Mooring marker lifted — Solano's crest, face down in the bucket.", targets: [[6, 116], [88, 118], [-96, 118]], timeLimit: 420, payout: 150 },
  { id: "quiet2", side: "quiet", title: "The Quiet Harbour II — Lina's Day Off", giver: "Lina Park",
    intro: [
      L("Lina Park", "Day off. An actual one. Marlo's article said the observatory up in Northreach can see the whole bay — I've lived here eleven years and never been."),
      L("Lina Park", "You're driving. Slowly. Like a person who values the cargo."),
      L("Rayan Kade", "The cargo being you."),
      L("Lina Park", "The cargo being ME. Pick me up at the garage. And Rayan — no wanted stars. I've read your driving record. It's a novella."),
    ],
    outro: [
      L("Lina Park", "…Okay. That's the whole bay. There's the yard. There's the bridge. There's where the Meridian went down."),
      L("Lina Park", "Eleven years I fixed other people's rides to places like this."),
      L("Rayan Kade", "Worth the day off?"),
      L("Lina Park", "Worth the eleven years. Drive me home whenever, driver. Slowly. I want to watch it get small."),
    ],
    // A delivery-kind ride: garage pickup → the observatory road →
    // Northreach Point, where Lina waits as a figure for the outro
    // beat. The passenger machinery is the taxi system's, honestly:
    // there is no in-car passenger mesh for ANYONE in this game (the
    // player figure itself hides while driving) — Lina rides as
    // kerbside figure + subtitle barks en route, the Chatty-passenger
    // pattern. NO TIMER PRESSURE, scoped to what the engine supports:
    // the mission loop has no timerless mode, so the clock is a full
    // hour against a ~4-minute drive, and bust/wasted cannot fail a
    // mission at all (the sim freezes while G.status is set and the
    // mission persists across the respawn). Starting the mission is
    // gated on Northreach being loaded (App's contact handler, the
    // Ledger pattern) — if the chunk fails, Lina postpones instead.
    objectiveText: "Pick Lina up at her garage, drive her to the Northreach observatory, then on to Northreach Point", kind: "delivery", targets: [[-40, -28], [8, -336], [-20, -361]], timeLimit: 3600, hideTimer: true, payout: 200 },
  { id: "quiet3", side: "quiet", title: "The Quiet Harbour III — The Bench", giver: "Old Elias",
    intro: [
      L("Old Elias", "Rayan. Coral Shores, the bench on the promenade — you know the one, faces the bridge. Come by when you can."),
      L("Old Elias", "No errand. No cargo. Just… come and sit a minute. Tamim's coming too. Boy's been asking what the harbour looks like when nobody's fighting over it."),
      L("Rayan Kade", "You've never once asked me to just sit, Elias."),
      L("Old Elias", "Then it's overdue, isn't it. Come."),
    ],
    outro: [
      L("Old Elias", "There it is. Whole bay, doing nothing. Took me seventy years to learn to watch that."),
      L("Tamim Kade", "From the yard inside, the water was a rumour. You'd hear the ferries and make up the rest."),
      L("Old Elias", "And now?"),
      L("Tamim Kade", "Now it's just… there. Nobody's. Ours. I keep waiting to feel angry and mostly I feel hungry."),
      L("Old Elias", "That's the harbour healing you, boy. It works slow and it works through lunch."),
      L("Old Elias", "Rayan — take this. Two hundred and fifty. Don't argue."),
      L("Rayan Kade", "Elias, I don't need—"),
      L("Old Elias", "It's not need. It's ballast. A man your age should carry a little of an old man's money and an old man's advice, and the advice is heavier, so start with the cash."),
      L("Old Elias", "The advice is this: when they write about Port Sable — and Ines will — be the chapter where it got quiet. Not the loudest chapter. The quiet one."),
      L("Tamim Kade", "…I'm going to get us coffees. From the actual café. With my own money. Still feels illegal."),
      L("Old Elias", "Go on, then. We'll be here. This bench isn't going anywhere — and now, neither are we."),
    ],
    objectiveText: "Meet Elias and Tamim at the Coral Shores bench, facing the bridge", kind: "goto", targets: [[72, 200.3]], timeLimit: 600, payout: 250 },
  // ---- Phase 48: THE HARBOUR CROWN — the endgame empire chain
  // (side key "crown", per slot, FOUR parts). Offered by Ines Marlo
  // once the story is done AND the player's empire exists — at
  // least 2 businesses and 1 rental property (App's Ines handler
  // states the gate, with the counts, when it isn't met). Solano's
  // old backers are returning as MERIDIAN HOLDINGS — the name is
  // the harbour's own (the Meridian run, the Meridian Pair): the
  // front company wears it deliberately, which is rather the point.
  // crown3's auction choice (buy out / expose) is stored in its OWN
  // persisted flag pair (M.crownChoice / M.crownDone, the Ledger
  // pattern — see missionState) because the pack and ledger choices
  // already spend theirs. ----
  { id: "crown1", side: "crown", title: "The Harbour Crown I — Paper Trail", giver: "Ines Marlo",
    intro: [
      L("Ines Marlo", "(phone) Rayan. Sit down for this one. Solano's money never died — it incorporated. Meridian Holdings: a front with clean paper, old backers, and a plan to buy this harbour back one deed at a time."),
      L("Rayan Kade", "Meridian. They named themselves after the run that sank."),
      L("Ines Marlo", "Arrogance is a paper trail, if you know how to read it. Their bagman works a route: he takes the tide boat's manifest at Breakwater Point in Westbrook, then makes two handoffs in Eastmere — the chandlery, and the Light steps. I need him SHADOWED and PHOTOGRAPHED, in order, undeniable."),
      L("Rayan Kade", "Be at his stops before him, camera up. Furniture with a lens."),
      L("Ines Marlo", "Then run the photographs to my newsroom — because the moment the second shutter clicks, his people will know, and they'll come for the film. Westbrook and Eastmere both, Rayan. Call me from the road if the districts are cut off."),
    ],
    outro: [
      L("Ines Marlo", "Breakwater, the chandlery, the Light — faces, plates, timestamps, the manifest changing hands twice. This is not gossip, Rayan. This is a noose with page numbers."),
      L("Rayan Kade", "What does it buy us?"),
      L("Ines Marlo", "It buys the second act. Their whole paper empire hangs on one cold-storage manifest at the Docks — proof of what the 'clean' cargo really is. Call me when you're ready to go and take it."),
    ],
    objectiveText: "Shadow the Meridian bagman: be at Breakwater Point (Westbrook), then photograph his two Eastmere handoffs (chandlery → the Light), then run the film to the Harbour Wire newsroom", kind: "photo", meetSteps: 1, photoSteps: 2, runTimer: 180, targets: [[-189, 12], [70, -226], [107, -283], [20, -20]], timeLimit: 600, payout: 700 },
  { id: "crown2", side: "crown", title: "The Harbour Crown II — Cold Storage", giver: "Ines Marlo",
    intro: [
      L("Ines Marlo", "(phone) The manifest, Rayan. Meridian's cold-storage container sits in the Docks stack yard, south-east of the stacks — the one with the blue seal. Its data core holds the real cargo list: what's actually been moving under 'frozen fish' for a year."),
      L("Rayan Kade", "And I copy it how, with a crayon?"),
      L("Ines Marlo", "Your phone, held to the seal reader — eight seconds, no more. The seal chirps when the copy starts: a quiet alarm. The patrol will stir… but Voss is leaning on the port authority tonight. They will not escalate past three stars while her operation runs. Her words: 'a ceiling, Kade, not a floor — don't test it.'"),
      L("Rayan Kade", "Copy the core, lose the heat, reach the Ferry Quarter safehouse. I've danced this one."),
      L("Ines Marlo", "Not with the harbour's whole future in your pocket. Go."),
    ],
    outro: [
      L("Det. Mara Voss", "(phone) The manifest copy checks out against my own seizures — every 'frozen fish' crate a lie with a bill of lading. Whatever Meridian is, it isn't a fish company."),
      L("Ines Marlo", "And tomorrow they auction the last piece of the old empire — Solano's harbour stake, at the mansion on the Northgate row. That's where this ends, Rayan. One way or another. Sleep. Then call me."),
    ],
    objectiveText: "Copy the manifest from the marked container in the Docks stack yard (hold position 8s), then escape to the Ferry Quarter safehouse — lose your heat first (patrol capped at 3★ tonight)", kind: "escape", targets: [[80, 118], [-92, -92]], timeLimit: 360, payout: 900 },
  { id: "crown3", side: "crown", title: "The Harbour Crown III — The Auction", giver: "Ines Marlo",
    intro: [
      L("Ines Marlo", "(phone) The auction's tonight, Rayan — the seized Solano mansion on the Northgate row, and with it the last harbour stake: the old counting-house deeds, the mooring rights, the works. Meridian's bidder is already there, briefcase open. Whoever holds that stake holds the harbour's throat."),
      L("Rayan Kade", "And I hold a newspaper's worth of evidence and an empire of my own. Options, editor."),
      L("Ines Marlo", "Two. OUTBID them: forty thousand wires the stake into escrow in your name — non-refundable the moment you commit, and Meridian's harbour is YOUR harbour, paying you a dividend on every business you run, forever. Or EXPOSE them: I print the manifest and the bagman's photographs across three editions, the whistleblower reward is fifteen thousand, and Meridian dies in daylight — but the stake sells to strangers, and there is no dividend in daylight."),
      L("Rayan Kade", "Buy the harbour, or free it."),
      L("Ines Marlo", "Decide before you walk in. The auctioneer doesn't wait, and neither do I."),
    ],
    choice: { options: [
      { label: "Buy out Meridian's stake — $40,000 into escrow (permanent +10% on all business income)", flag: "crown-buyout", reply: [
        L("Rayan Kade", "Wire it, Ines. Forty thousand. If the harbour's for sale, it sells to a Kade."),
        L("Ines Marlo", "Done — SableBank has the escrow moving. Non-refundable, Rayan: the commitment IS the bid. Now walk into that auction and watch their bidder's face when the stake's already gone."),
      ] },
      { label: "Expose them — print the manifest and the photographs (3-day Wire series, $15,000 reward)", flag: "crown-expose", reply: [
        L("Rayan Kade", "Print it, Ines. All of it. A harbour you have to buy back was never yours — I'd rather it belonged to everybody."),
        L("Ines Marlo", "Then it's already done — the first edition rolls tonight. Walk in there and enjoy the sound of a front company reading its own obituary over the canapés."),
      ] },
    ] },
    outro: [
      L("Ines Marlo", "It's finished. The auctioneer called the stake SOLD before their bidder understood the escrow had already moved — Meridian's harbour is your harbour now, Rayan. Every till in your empire felt it by morning: a dividend, ten percent, forever, in the bank's own figures."),
      L("Rayan Kade", "From a ledger debt to owning the paper. Tamim's going to laugh for a week."),
      L("Ines Marlo", "One last run, though. The deeds themselves still sit in a Meridian drawer — they have to reach the observatory archive and Voss's desk before Meridian's lawyers wake. Tomorrow. Call me."),
    ],
    outroAlt: [
      L("Harbour Wire (headline)", "MERIDIAN UNMASKED: the Wire prints the cold-storage manifest and the bagman's route — 'frozen fish' was never fish. The auction on the mansion row dissolved in shouting; by midnight, Meridian Holdings' offices stood empty, its phones ringing into the dark."),
      L("Det. Mara Voss", "(phone) My office reads the Wire with warrants open, Kade. Every name in that manifest is having an honest week. The whistleblower reward — fifteen thousand — is yours, and the districts know whose harbour this is. It isn't Meridian's."),
      L("Ines Marlo", "One last run, Rayan. The physical deeds still sit in a Meridian drawer — they have to reach the observatory archive and my detective before the lawyers shred them. Tomorrow. Call me."),
    ],
    objectiveText: "Attend the auction at the seized mansion on the Northgate row — the decision you made is already moving", kind: "goto", targets: [[-96, -236]], timeLimit: 300, payout: 2000, payoutAlt: 15000, altFlag: "crown-expose", choiceKey: "crown" },
  { id: "crown4", side: "crown", title: "The Harbour Crown IV — Harbour Crown", giver: "Ines Marlo",
    intro: [
      L("Ines Marlo", "(phone) Last run, Rayan. The deeds are in a deed box at the Sable Marina office — Meridian's lawyers filed for an injunction at dawn, and the moment it lands, every paper in that drawer is frozen. The observatory archive in Northreach is the one vault an injunction can't touch, and its keeper waits at the cliff jetty, east shore, below the dome."),
      L("Rayan Kade", "By boat, up the east channel. Then?"),
      L("Ines Marlo", "The keeper takes the deeds up the cliff and hands you the archive receipt. That receipt goes to Voss at Patrol HQ — IN PERSON — before the injunction hearing. Meridian's people will be on the water and the road, and the patrol's been tipped you'll run: four stars, Rayan. The harbour's whole future in a deed box. Don't be late, and don't be caught."),
      L("Rayan Kade", "For the harbour, then. One more time."),
    ],
    outro: [
      L("Det. Mara Voss", "The receipt, the archive stamp, the injunction dead in its drawer. It's over, Kade — Meridian is a headline, not a landlord. The harbour is Port Sable's again."),
      L("Ines Marlo", "And there's a car waiting in your garage, Rayan — the auction house released it this morning. The Sovereign: the stake's own showpiece, one of one, teal and gold. The harbour's crown, with wheels. Drive it like you earned it. You did."),
      L("Rayan Kade", "From a ferry dock and a debt… to this. Tell Tamim dinner's at the mansion. Tell the harbour — it's theirs. I just keep the crown polished."),
    ],
    objectiveText: "Take the deed box from the Sable Marina office, run it BY BOAT up the east channel to the observatory jetty (east shore, below the dome), then get the archive receipt to Det. Voss at Patrol HQ — 4★ pressure", kind: "checkpoints", targets: [[17, 108], [44, -340], [-64, 100]], timeLimit: 600, payout: 1500, forceWanted: 4 },
];

// ---- Phase 15: THE MERIDIAN PAIR — one shipment, two loyalties.
// Offered by phone after Chapter 3 (Voss or Elias — whoever you call
// FIRST gets your answer): help Voss's informant play out the sting,
// OR warn Elias's dock crew so the shipment "never arrives". Starting
// one sets M.pairChoice (persisted) and locks the other for this
// playthrough; each pays differently and moves your Docks reputation
// the opposite way (see GameSystems' completion branch). ----
export const PAIR_MISSIONS: MissionDef[] = [
  { id: "pairA", pair: "informant", title: "The Meridian Pair I — The Informant", giver: "Detective Mara Voss",
    intro: [
      L("Det. Mara Voss", "Tonight, Kade. A Solano shipment — the Meridian run — lands at the East Yards crane office, and my informant inside the crew is ready to mark it for seizure."),
      L("Rayan Kade", "And Elias's people are crewing that dock. If I help you, I'm informing on the harbour's own."),
      L("Det. Mara Voss", "You are. There's no clean version of this one, so I won't dress it up. Meet the informant at the crane office, confirm the mark, and the seizure is clean — no arrests on the dock floor. The crew walks, Solano pays."),
      L("Rayan Kade", "The crew walks… but they'll know a harbour mouth talked. And that it was standing next to me."),
      L("Det. Mara Voss", "Then decide with your eyes open. Call Elias instead and this conversation never happened — but neither does the seizure."),
    ],
    outro: [
      L("Det. Mara Voss", "Marked and seized, Kade. Clean as surgery. Solano's lawyers are already screaming about paperwork they can't find."),
      L("Rayan Kade", "And the docks will remember my face next to yours, Detective. That bill comes later."),
      L("Det. Mara Voss", "Then spend the money well. You did the harbour a service it won't thank you for."),
    ],
    objectiveText: "Meet Voss's informant at the East Yards crane office and confirm the shipment mark", kind: "goto", targets: [[60, 100]], timeLimit: 240, payout: 800 },
  { id: "pairB", pair: "dockcrew", title: "The Meridian Pair II — The Warning", giver: "Old Elias",
    intro: [
      L("Old Elias", "Sit, lad, and listen like your life rents the chair. The Meridian shipment lands tonight at the East Yards — and Voss has an informant INSIDE my crew. There's a sting being built on my dock."),
      L("Rayan Kade", "If I warn your crew, I'm burning a police operation. Voss will know a harbour mouth talked."),
      L("Old Elias", "Aye, she will. And my boys keep their jobs, their freedom, and their dinners at home. Get to the crane office before her people move — tell the crew chief the mark is blown and the shipment scatters to the wind."),
      L("Rayan Kade", "And Solano?"),
      L("Old Elias", "Solano loses a shipment and never learns why. The harbour protects its own, Kade. It always has. Decide — call Voss and this stays a story I once told you."),
    ],
    outro: [
      L("Old Elias", "Scattered like gulls, every crate of it. By the time her marked vans rolled in, the East Yards were sweeping empty concrete."),
      L("Rayan Kade", "Voss will work it out eventually, old man."),
      L("Old Elias", "Eventually is a harbour word for never, when the docks close ranks. Nobody at these tables saw anything tonight — and nobody ever will. That's worth more than money, and you'll feel it every time you walk this pier."),
    ],
    objectiveText: "Reach the East Yards crane office and warn the dock crew before the sting lands", kind: "goto", targets: [[60, 100]], timeLimit: 240, payout: 550 },
];


/** Next unplayed part of a side arc, or null when the arc is finished. */
export function nextSideMission(side: "lina" | "voss" | "heist" | "after" | "wire" | "ledger" | "quiet" | "crown", progress: number): MissionDef | null {
  const parts = SIDE_MISSIONS.filter((m) => m.side === side);
  return parts[progress] ?? null;
}

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
