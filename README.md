# Harborfall — Port Sable

An **original** open-world harbour-city driving adventure that runs in the
browser and as a desktop app. You play Rayan Kade, a former getaway driver
who returns to the coastal city of Port Sable to free his brother from a
corrupt harbour boss's debt ledger.

> **Originality note (intentional):** Harborfall is *inspired by the
> open-world driving genre* — free roam, car stealing, wanted stars, police
> chases, missions, a minimap. Everything else is its own: the city
> (Port Sable), the teal-and-amber coastal-dusk art identity, districts,
> characters, story, car models and branding are all original creations.
> It is not affiliated with Rockstar Games and contains no GTA assets,
> names, map, story or audio.

> **v3.0 — Complete Edition.** The start screen carries the stamp, and
> this is the full version: the six-chapter story plus every side arc
> (Lina's Line, Voss's File, the Harbour Heist, After the Fall, the
> Meridian Pair, the Harbour Wire, the Ledger Line, the Quiet Harbour)
> and the endgame empire chain, **The Harbour Crown**. Three streamed
> districts (Eastmere, Westbrook, Northreach) beyond the city proper,
> 14 hand-built interiors, a working economy of businesses, rentals,
> loans and investments with daily events, evidence-and-heat policing
> with a Fixer, service jobs (paramedic, firefighter), a drift
> championship, harbour wildlife, photo postcards, day events (a boat
> regatta, a street market), a dynamic procedural score, assists &
> accessibility settings, and optional session multiplayer with names,
> chat and room codes. The final blueprint ledger, recounted line by
> line for this release: **104 ✅ · 8 🟡 · 0 ⬜ over 112 topics** —
> every 🟡 carries its honest reason in `docs/BLUEPRINT.md`, and
> `docs/RELEASE_3_0.md` is the release note. Everything is procedural;
> see **Honest limits** below for exactly what that means.

## Play it

- **Web (Vercel):** open the deployed link — no install, works on phone too.
- **Desktop:** Windows `.exe` / macOS `.dmg` installers (see `desktop/`).

## What's in the game

- **Big living city** — 5×5-block procedural Port Sable: 60+ buildings with
  lit window grids, full road grid with lane markings, sidewalks,
  crosswalks, traffic lights, street lamps, trees, benches, hydrants,
  Lantern Park, Sable Beach and animated harbour water. Six districts:
  The Docks, Market Row, Ferry Quarter, Gull Heights, East Yards, Lantern Park.
- **10 drivable cars** (Sable Sprinter, Harbor Hauler pickup, Gullwing GT,
  Ferry Van, Yardbird…) in different colours/body types — walk up, press E.
- **Traffic AI** — 12 NPC cars driving the road grid, turning at
  intersections, stopping for you, fleeing after a crash.
- **Pedestrians** — 14 walkers on the sidewalks who flee fast cars and heat.
- **Wanted & police** — stealing, collisions and hitting pedestrians raise
  1–5 wanted stars; harbour patrol cars (flashing red/blue light bars)
  chase and ram you. Break line of sight to cool down, or get **BUSTED**
  (fine + respawn) / **WASTED** (hospital respawn).
- **Story campaign** — 6 chapters with dialogue (see `docs/STORY.md`),
  plus 3 repeatable job types (delivery, checkpoint sprint, token run).
- **HUD** — circular minimap (roads, cars, police, mission marker), wanted
  stars, cash, health bar, speedometer, objective banner with distance +
  timer, glowing objective pillar in the world.
- **Day cycle** — sun moves, dusk turns to night, windows and lamps glow.
- **Personal themes** — 5 full-game themes (below), saved automatically.
- **Audio / SFX + opening theme** — all WebAudio-synthesised, no audio files. The start screen plays **"Port Sable Sunset"**, an original opening theme composed for Harborfall (sunset synth-jazz: warm pads, sub bass, soft drums, sax-style lead — written for this game, not copied from any other game's music); it fades out when you press Play. In-game SFX: engine hum tied to speed, police siren wail while wanted, crash impact + thud, car horn (**B** on keyboard, HORN button on touch), door, jump/land, tyre skid, wanted-star sting, dialogue blips, UI clicks, pickup/cash chimes, mission-complete jingle, BUSTED sting and fail tone. **N** mutes everything, theme included.
- **Multiplayer (optional)** — WebSocket rooms via the Python server;
  remote players render in your city, wearing the display name set in
  Phone → Settings. Room chat (game panel) and room codes: players in
  the same code share a room, and a join with no code lands in the
  shared default room, "sable". Single-player needs no server.
- **Phase 6 — "Proper Game"** — a third district, **Northgate** (causeway
  north: mansion row, hotel, Sable Motors dealership, Sable Arms, a
  two-deck parking garage you can drive up), **Sable Island** (lighthouse,
  cottages, dock) in the bay, and a real game-flow: splash → poster →
  **staged loading screen** (honest progress from real construction
  stages) → cinematic spawn-in sweep with district title cards.
  Traffic now **obeys the traffic lights**, queues, and swells at rush
  hour; new rides: **city bus** (with a working route), **taxi**,
  **bicycle** (pedal it — costs stamina) and a **speedboat** with wake.
  Police round 2: **spike strips** at 4★ roadblocks, **surrender**
  (hold B at 1★), heli searchlight at night, disguise-lite heat decay.
  Combat round 2: **SMG + shotgun** with per-weapon ammo (Q cycles four
  slots), recoil, muzzle light, cover. Player systems: **stamina**,
  **skills** (Driving/Shooting/Stamina, phone Stats app), **vaulting**,
  limp + slow regen, food stall and hospital heals. **Lina's mods**
  (M in a garage): resprays, engine tunes, brakes. Ambient world
  events, shop hours, and a third character-realism pass (512² painted
  faces, crop/bald hair, jackets). C++ physics v3 source (suspension
  spring/damper + collision friction) with TS mirror + g++ smoke test.
- **Phase 7 — "The 500 Sweep, Round 1"** — **jobs**: drive the yellow
  Sable Cab and fares hail you (fare + tip by speed and cleanliness,
  star ratings), plus Lina's 3-leg **delivery chain** — both run from
  the phone **Jobs app**, earnings in Stats. **Street races**: Docks
  Sprint, Bay Run and Northgate Loop — 3 AI rivals, checkpoints, live
  position, $600/$250/$100 prizes, optional $100 bet, best times.
  **Three new interiors**: Harbour Patrol HQ (surrender at the front
  desk), Sable Clinic (heal inside), Marina Table restaurant (sit +
  a $25 set menu). **Businesses**: buy the Harbour Wraps stall, the
  Northgate Car Wash or a Club Solace share — daily income lands in
  SableBank every game-morning; the **Coral Shores Apartment** is a
  second home (respawn choice, sleep, garage-save #2), and **sleeping**
  at any owned home skips to morning with a full heal. **The Harbour
  Heist**: a two-night chain from Old Elias — prep the getaway van and
  supply crates unseen, then drill the strongroom and run. Missions
  gained **checkpoints** (fail → **R** retries from the last one) and
  **replay** (phone Story app, 40% payout). New phone apps: **News**
  (Harbour Wire headlines written from your actions), **Social**
  (SableSocial) and a **GPS route** on the big map. World sweep: a
  **toll booth** on the causeway ($5 slow, or smash it), **speed
  cameras** ($75 SableCam fines), **destructible** crates/barrels/
  fences, sitting on benches, wind gusts that move palms and boats,
  fish at the pier — and **emergency vehicles**: parked + traffic
  ambulance and fire truck, plus a rushing-ambulance world event.
- **Phase 8 — "The 500 Sweep, Round 2"** — **fishing** at the pier and
  the Sable Island dock (charge, cast, bite, reel — five fish by place
  and time of day, sell the creel at Harbour Wraps); the **Sable
  Fitness** outdoor gym at Lantern Park (bench press + treadmill
  rhythm sessions, a new **Strength** skill); **NPC memory** — Port
  Sable recognises repeat offenders, pickpocket victims avoid you for
  a day, witnesses point you out to cops, and each district keeps a
  reputation that decays overnight; **SableBank Invest** — three
  fictional local stocks that drift hourly and react to your heists,
  race wins and business buys; a **baseball bat** (fifth weapon slot);
  the **Thread & Tide** clothing shop; **tow jobs** with a working
  wrecker and swinging tether; full **gamepad support**; a fourth
  **character realism pass** (stride-matched heel-toe gait, 1024²
  faces, hair cards, blinking, breathing); three original **exotic
  cars** — the Vantara S wedge (scissor doors), the Kestrel One
  hypercar (active rear wing) and the Marlowe GT; a rebuilt
  **floating analog touch joystick**; **graphics smoothness**
  (dynamic resolution + adaptive quality that respects your manual
  choice); and a **language rebalance** — the C++ Harborfall Core now
  decides traffic, pedestrian steering, police line-of-sight, boat
  buoyancy and race pacing, the Python server adds leaderboards and
  economy snapshots, and C# desktop tooling lives in `tools/`.
- **Phase 9 — "The 500 Sweep, Round 3"** — **flight**: the Sable
  Sparrow at Sable Field actually flies (ground roll, lift-off, stall,
  building strikes, hard landings cost damage) and the airfield gains a
  **hangar interior**; a second boat class, the **Harbour Fisher
  skiff**; **traffic wrecks that stay** for the game day with traffic
  diverting around them, and rotating **roadworks** sites with real
  slow zones; **four named townsfolk** with daily schedules and
  branching conversations; a **sixth wanted star** (heat rule at 5★)
  bringing the **Harbour Guard SUV**, a **patrol boat** and a **K9
  unit**; **thrown bottles** that smash Market Row's shopfront glass;
  **weapon mods** at Sable Arms (suppressors, extended mag, reflex
  sight, choke); **free-aim** (hold right-mouse / LT); **Sable Cuts**
  barber + **Port Ink** tattoos; a post-story mission pack, **After
  the Fall** (three jobs, one real choice); the **SableWeb** phone
  browser (five pages of live game data) and a persistent photo
  **Gallery**; business **staffing** (Phase 15: a named 4-person
  roster, up to 2 per business, each with their own bonus and wage);
  shop hours enforced everywhere; and day-scoped persistence for
  wrecks, broken props and smashed glass. The 500-feature ledger
  (docs/BLUEPRINT.md §15) now stands at **82 ✅ · 9 🟡 · 2 ⬜** of 93
  topics — the two remaining ⬜ are trains (no rail network in the
  city plan) and seasons/snow (a subtropical harbour city with no
  winter art set), each with its reason stated in the ledger.
- **Phase 13 — "Remaining Features"** — the ledger closes. **The
  Sable Line**: a two-car light-rail tram on an elevated guideway
  loop above the traffic (Docks · Market Row · Northgate · Coral
  Shores, 4 stations, door chimes, full ride mode — the patrol
  won't board, and riding never cools your stars). **Seasons**: a
  season every 7 game-days turns the sun's arc and the day's
  length, the light, the water, the street trees and the weather
  odds (summer afternoon storms, winter fog) — pinnable in
  Settings, and **no snow, ever**: this is a subtropical harbour,
  and the ledger says so on the line. **Two more interiors**: the
  Sable Motors **showroom** (exotics on turntables, the dealer
  counter works indoors) and **Café Coral** on the Docks strip
  (coffee, pastries, chairs, regulars). And your **last-used car
  now persists across sessions**, waiting where you left it with
  an amber YOUR CAR ring on the big map — unless you wrecked it,
  got busted in it (impounded), or garaged it. Ledger: **84 ✅ ·
  9 🟡 · 0 ⬜** of 93 topics.
- **Phase 14 — "Depth Pass"** — the weakest ledger lines grow teeth.
  A genuine **verlet ragdoll** (13-point skeleton in the C++ core,
  smoke-tested, TS mirror) crumples downed peds and the WASTED fall,
  seeded by the impact that felled them. **Destructibles round 2**:
  fences, market stalls, road signs and the café/showroom glass —
  43 props + 15 panes, breakable by car, bat or bottle, repaired
  overnight. **Two more interiors**: **Sable Fitness** (the gym
  moves indoors; the park corner is stretching mats now) and the
  **Northgate Loft**, a $9,000 second home with a bed, a wardrobe
  for the outfits you own, and harbour-view windows. Two new
  activities on the race scaffolding: the **Bay Circuit** ghost-boat
  race around Sable Island ($500) and the **Sparrow Run** plane
  time-trial through altitude rings ($600 under par). **Three save
  slots** (your old save migrates into Slot 1, originals kept) and
  **key remapping** with conflict detection. Plus a **High-tier
  stability pass**: reflections are opt-in and capped, the composer
  can no longer take the game down with it, and a GPU context loss
  resets graphics safely instead of going black. Ledger: **86 ✅ ·
  7 🟡 · 0 ⬜** of 93 topics.
- **Phase 16 — "World Depth & Player Control"** — you hold the
  performance levers now: **Traffic density, Pedestrian density and
  View distance** in Pause → Settings and Phone → Settings, live
  without a reload (Low traffic halves the ambient flow; view
  distance moves the fog and the streaming radius; Normal is exactly
  how the game shipped). Getting **busted on foot is a scene** now:
  an officer walks you, hands up, to the patrol car before the
  standard bust lands (surrender is unchanged). **Farm life** at
  Sable Downs: the farmhouse is a walk-in interior with a **free
  farmhand's bunk** (sleeping there doesn't move your respawn home —
  it's a workplace perk, not a property), and **Farm work** in the
  Jobs app hauls 3 crate loads from the barn to Harbour Wraps in the
  farm pickup ($120/load + $150 bonus, crates stack in the bed).
  Your **parked fleet** grows: up to **3 owned cars** persist where
  you leave them, numbered amber rings on the big map. And Sable
  Cuts adds **4 hairstyles + beards** (stubble, goatee, full). The
  round also fixes three Phase 15 regressions found by audit: a
  wrecked dispatched unit could stall dispatch forever, a failed
  Meridian Pair attempt locked both branches, and the farm's south
  dirt spur clipped a house. Ledger: **86 ✅ · 7 🟡 · 0 ⬜** of 93
  topics (five 🟡 lines grew).
- **Phase 17 — "City Life & Story Depth"** — a new side arc,
  **The Harbour Wire**: after Chapter 4, editor **Ines Marlo**
  (Phone → Contacts) hires you to investigate Solano's rebuilt
  ledger — **photograph 3 evidence spots** with the real photo-mode
  camera, **tail a courier van** inside a 12–45 m band through its
  stops, then **run the exposé** to the newsroom at 2★, with
  headlines and fallout after every part. The **city bus is
  rideable**: 4 stops (Docks · Ferry Quarter · East Yards · South
  Market), $2 fare, sit back and watch Port Sable go by — the
  patrol won't board, same as the tram. Two new **world events**:
  a **Street Challenge** (a parked exotic driver, $200 stake,
  winner takes the $400 pot in a point-to-point race) and
  **Spilled Cargo** (crates on the road for 60 s — grab cash and
  fenceable loot while traffic swerves around you). The round also
  fixes two Phase 16 regressions found by audit: the arrest escort
  could be escaped mid-scene by slipping into a car or a doorway
  (it now cancels cleanly instead of busting you from across town),
  and a parked-fleet restore could duplicate your garage car.
  Ledger: **86 ✅ · 7 🟡 · 0 ⬜** of 93 topics (three ✅ lines grew).
- **Phase 18 — "Vehicles & Racing Depth"** — **drift scoring**:
  hold the handbrake and slide — chains build a score (×2–×5 for
  linked slides), banked for cash and Driving skill on a clean
  release, lost whole if you clip something mid-chain; rear-drive
  cars score best, and the meter lives in the HUD's mini-bar.
  **The Sable Cup**: the three street races plus the Bay Circuit
  as a four-round championship — arm a round in Phone → Jobs,
  race it at its ring, score 10/6/3/1; 20+ points takes the crown
  ($2,500, a Harbour Wire headline, and a gold voucher worth 20%
  off the Vantara S). **Two new original cars**: the **Sable
  Kestrel RS** track coupe ($18,000, dealer) and the **Bronto
  Hauler** off-road pickup ($9,500 — parked at the farm, and the
  only car that grips *better* on dirt). **Tuning completed**:
  brakes gain tiers II–III, engine III tops the ladder, and
  **drift tyres** ($600) trade wet grip for slide score. The round
  also fixes four Phase 17 regressions found by audit: Wire
  evidence photos could be farmed outside the ring, the ambient
  world events could start over (and silently cancel) the new
  events, a tail-mission retry credited stops never confirmed,
  and Print Run's story heat never cleared after delivery.
  Ledger: **86 ✅ · 7 🟡 · 0 ⬜** of 93 topics (two ✅ lines grew).
- **Phase 19 — "Economy & Empire"** — a **fourth business**:
  **Sable Marina Rentals** ($15,000, +$380/day) at the pier — own
  it and the rental dock opens: a **$75 day-pass skiff**, yours
  until you return it, wreck it, or the day rolls over.
  **Business upgrades**: every business now runs levels 1→3
  (+35% takings per level, upgraded in the Bank app — the number
  shown is the number the morning tick pays). **Staff traits are
  live**: Sana Iqbal's bonus doubles after dark (20:00–06:00),
  and the Bank app shows her current rate as the harbour clock
  turns. **SableBank loans**: borrow $500/$1,500/$4,000 in the
  Bank app — 8% daily interest capped at twice the principal,
  10% auto-repaid each morning, and the bank won't serve you at
  3★ or more. The round also fixes three Phase 18 regressions
  found by audit — the first of them fatal: **the Sable Cup's
  rounds pointed at races that don't exist**, so the championship
  could never be armed, scored or won (it now uses the real
  races, and old saves migrate); a failed race start could
  silently eat a Cup entry; and garage take-out skipped the
  tuning clamp the other car paths all apply.
  Ledger: **86 ✅ · 7 🟡 · 0 ⬜** of 93 topics (businesses grew).
- **Phase 20 — "Finale & Polish" (v2.0 — Complete Edition)** —
  **New Game+**: finish the story and Phone → Story offers a
  confirmed second run on the same save — story and side progress
  reset, everything you own (cash, cars, properties, businesses,
  skills, look, Cup and drift records) stays, while patrols get
  faster (+6%/level, capped +18%), arrests land quicker
  (+10%/level, capped +30%) and every mission pays +25% more per
  level; an **NG+ badge** rides the chapter line. **End credits**:
  an original ~45-second scroll over the live city — from the
  story-complete panel or any time via Phone → Story → Credits,
  Esc to skip. The round opens with a full audit of Phases 17–19
  (one fix: a loan balance of a few dollars could never auto-settle
  and blocked future borrowing — tiny balances now settle outright).
  The start screen carries the stamp: **v2.0 — Complete Edition**.
  Final ledger: **86 ✅ · 7 🟡 · 0 ⬜** of 93 topics — the blueprint
  is complete, and every remaining 🟡 carries its honest
  engine/scope reason in `docs/BLUEPRINT.md`.
- **Phase 21 — "Life & Feel"** — **Staff in the world**: the people
  you hire now actually show up — each staffer works a fixed shift
  at their business's frontage (Sana Iqbal works the night, 20:00–
  06:00, the same hours her bonus doubles; Dev Okafor is part-time
  10:00–18:00), pacing the frontage in a work colour with a
  floating name + trait label and a greeting when you walk up; the
  Bank app notes who is **on shift now**. **Driving feel**:
  collisions now land with a camera impulse and a dull thud scaled
  by the impact; the speed FOV is capped at +8° and can be turned
  off (**Speed FOV** in Pause settings); and dropping off a ledge
  or deck edge gives a proper landing — a beat of air, a suspension
  dip and a burst of dust. All feel work is presentation-only — the
  physics step is untouched. **Balance pass** (numbers only):
  business upgrade costs drop (L2 60%→40%, L3 120%→75% of the buy
  price — the payback was the worst sink in the game) and Sable
  Marina Rentals pays $430/day (was $380 — it had the portfolio's
  worst payback at the highest price); the rest of the money loop
  audited sane and left alone. The round opens with an audit of
  Phases 17–20 (one fix: New Game+ now stands down in-progress
  jobs — taxi, delivery, tow, farm — before resetting, as its
  confirm promises). Ledger unchanged: **86 ✅ · 7 🟡 · 0 ⬜**
  (the employees 🟡 grew — staff are in the world now; what remains
  is rota simulation and management play, a scope call).
- **Phase 22 — "City Rhythm & Odd Jobs"** — **City rhythm**: the
  city now breathes with the clock — one rhythm function drives
  every density path: at **rush hour** (07:00–09:00 and 17:00–
  19:00) traffic and crowds scale ×1.3 and the Cityliner dwells
  shorter at stops; in the **deep night** (00:00–05:00) the city
  thins to ×0.7. It multiplies your density settings (never past
  the High caps; buses, taxis, emergency units and staff are never
  thinned out), and a **Rush hour** chip shows by the HUD clock
  during peaks. **Odd jobs board** (Phone → Jobs): **Valet** — a
  guest's car waits at Club Solace, Hotel Northgate or the Coral
  resort; park it in the marked bay against the clock for $90,
  minus $6 per point of damage you add (floor $20), plus $30 if it
  arrives unmarked. **Courier Sprint** — three drops in sequence
  on foot or bicycle, each on its own countdown (the clock pauses
  while you drive — feet and pedals only), $45 a drop + $60 for
  the full chain. **The horn matters now**: honk (B) and peds
  nearby startle aside; a car directly ahead may pull toward the
  kerb for a couple of seconds — a cosmetic touch of life, on a
  short cooldown, and it never raises wanted. The round opens
  with an audit of Phase 21 (staff shifts, driving feel, balance
  numbers — all verified clean, no fixes needed). Ledger
  unchanged: **86 ✅ · 7 🟡 · 0 ⬜**.
- **Phase 23 — "Night & Fares"** — **Club Solace is a working
  nightclub now** (its room has existed since Phase 3 — this round
  makes it a venue, it doesn't add a thirteenth interior): doors
  **20:00–04:00**, a **bouncer** on the door who turns you away at
  wanted 3★+, a **working bar** (the Harbour Sunset, $12 — a little
  stamina and a brief warm glow at the screen edges; cosmetic only,
  no drunkenness physics), a **colour-cycling dance-floor grid**
  (teal↔amber, always), **7 dancers**, and an original **bass loop**
  that plays only inside. Owning the club share now pays a
  **weekend door bonus**: +25% on Fri/Sat nights, inside the same
  daily-net maths the Bank app shows. **Taxi fares have
  personalities**: **Calm** (the classic fare), **Hurried** (+40%
  tip for landing with time to spare), **Nervous** (any knock to
  the cab kills the tip — they'll tell you the moment it happens),
  **Chatty** (standard pay, three stories minimum). The completion
  toast breaks out fare + tip, and your lifetime tips are tracked.
  The round opens with an audit of Phase 22 (one fix: the courier
  board's restart now actually restarts a running chain, as
  documented). Ledger unchanged: **86 ✅ · 7 🟡 · 0 ⬜**.
- **Phase 27 — "The Ledger Line"** — A new 3-part side arc across
  the streamed districts, from **Petra Vane**, keeper of the
  Eastmere Diner (new named NPC — she stands at her diner hatch in
  Eastmere, and she's in your Phone contacts). Solano's old
  smuggling ledger is moving again: **tail** a courier van out of
  Westbrook (it waits at the silo quay until you're in position,
  then runs the causeway to a Ferry Quarter warehouse),
  **photograph** the diner's delivery book and beat a rival crew's
  countdown to the Northgate Loft, then choose the book's fate —
  **burn it** with Petra ($900, Eastmere + Westbrook reputation up,
  a quiet headline) or **publish it** with Ines at the Harbour Wire
  ($700, a Wire special edition, Market Row reputation up). The
  choice is final per save slot; a failed attempt re-offers the
  same branch. Starting a district mission **loads its district
  first** — if the chunk can't load, Petra refuses cleanly rather
  than starting you into water. The round opens with an audit of
  Phase 26 (three fixes: the district-load toast could re-fire on
  every retry while you waited at a gate; a depenetrated car whose
  only clear spot touched another car could stay in a wall forever
  — it now resolves against buildings and cars jointly, with a
  documented last resort; and the multiplayer server's world bounds
  clipped boats rounding Westbrook and Coral Shores — now per-side
  bounds with open-sea margin, suite still 32/32). Ledger
  unchanged: **86 ✅ · 7 🟡 · 0 ⬜** (the side-storyline line grows).
- **Phase 50 — "v3.0 Finale"** — **The version stamp,
  the credits, and an honest recount.** Every surface
  now reads 3.0.0 (client, desktop shell, the Python
  service, the start-screen stamp). Phone → Settings
  gains an **About & credits** section: the cast, the
  tech, and the honest print in short form. Phase 49's
  three fixes were re-verified at their sites (the
  leaderboard name, the Sovereign reconcile, and the
  physics export list — diffed name-by-name against
  the loader: 23 for 23), and one leftover was closed:
  three save keys the New Game+ census kept but never
  named (your stash, weapon mods and throwables) are
  named in it now. The blueprint ledger was then
  **recounted line by line**: the running tally had
  folded years of growth lines into parent topics and
  under-counted the partial lines by one — the ledger
  as written is **104 ✅ · 8 🟡 · 0 ⬜ over 112
  topics**, and no line's state changed in the
  counting. `docs/RELEASE_3_0.md` is the release note.
- **Phase 49 — "Regression Marathon"** — **The whole
  game, audited at once.** Every phase since 26 was
  checked against every other: all 65 save keys
  (each one slot-scoped, safely loaded, and given an
  explicit New Game+ decision), every job and event
  against every interruption (busted, wasted, day
  change, slot switch), every money number traced to
  its single source, and every cash payment proven
  to fire exactly once. Three real bugs were found
  and fixed: leaderboard posts now use your actual
  multiplayer name instead of always saying "Rayan
  Kade"; the one-of-one Vantara Sovereign can no
  longer be silently lost if it's delivered while
  your garage is full; and the physics build script
  once again exports everything the game asks the
  C++ core for. The C++ core passes its smoke suite
  49/49 and matches its TypeScript mirror exactly;
  the server suite passes 48/48; client and server
  world bounds agree to the unit.
- **Phase 48 — "The Harbour Crown"** — **The endgame:
  the harbour itself is the prize.** Solano's money
  never died — it incorporated as **Meridian
  Holdings**, and it's buying Port Sable back one
  deed at a time. Ines Marlo's four-part finale chain
  opens only to players who finished the story AND
  built an empire (2 businesses + 1 rental — Ines
  states the gate, with your counts, until you have):
  shadow the bagman from Westbrook's Breakwater Point
  to two photographed handoffs in Eastmere and run the
  film to the newsroom against the clock; copy a
  container manifest at the Docks on an 8-second
  channel while Voss's pull caps the patrol at 3★;
  then **the Auction** — buy Meridian's stake out for
  $40,000 wired to escrow on the spot (a permanent
  +10% dividend on every business, inside the same
  figures the Bank shows) or expose them (a Wire
  series across three mornings, a $15,000
  whistleblower reward, the whole harbour's respect);
  and finally run the deeds by boat up the east
  channel to the observatory archive and the receipt
  to Voss at 4★. The reward is the **Vantara
  Sovereign** — a one-of-one grand tourer in deep
  teal with a fixed gold livery, delivered to your
  garage for good — and the 👑 Harbour Crown title in
  your Stats. (The Phase 47 audit also fixed a real
  one: Lina's bench could charge a market voucher
  price a fraction of a second stale across midnight —
  the click now re-reads the deal live, so the price
  charged is always the live one.)
- **Phase 47 — "Two More World Events"** — **Some days
  the harbour puts on a show.** A daily roll inside
  the day change (never both, about three days in
  ten each) makes a day a **Regatta day** — a buoy
  course in the bay: sail through the teal gate to
  start a timed run round six amber buoys, best time
  in Phone → Stats → Records, $250 for beating 1:00
  once that day (a time trial against the clock —
  there are no AI racers) — or a **Market day** in
  Coral Shores: three canopy stalls and a crowd on
  the promenade, with a food stall, one car upgrade
  at 25% off spent at Lina's bench (shown price =
  charged price), and a curios stall that fences
  your stash at +20%. The Wire and your phone
  announce the day each morning; sleep and it's all
  gone. The Phase 46 audit found no defects — the
  ambient score's pause, tension and mute behaviour
  all check out as documented.
- **Phase 46 — "Dynamic Music"** — **A score under the
  city.** Free-roam gains a quiet procedural ambient
  score (game/score.ts, all WebAudio synthesis, no
  files): a pad bed in the opening theme's own chord
  family, a sparse pluck layer that fades in with
  nightfall and out at dawn, and a low pulse that
  enters at 3★ — the pad shifting to the key's minor
  side at the next bar line — and quickens at 5★.
  Layers fade over ~2 s, never cut. It's the lowest-
  priority music in the game: a playing Sable Tunes
  track outranks it, Club Solace and the diner jukebox
  outrank it, the start screen stays the theme's, and
  the N mute covers it like everything else. Settings
  → Music → **Ambient score** turns it off (off = the
  Phase 45 sound exactly). It is layered loops keyed
  to game state — not "adaptive AI music", and the
  docs say so. Opens with an audit of Phase 45 that
  found **one defect**: the rush-hour reserve's
  parking decision read the traffic lever directly,
  past the Low preset's ceiling — on Low with density
  on High the reserve cars circulated all night
  instead of parking (the car count itself was never
  over the cap). It now goes through game/perf.ts
  like every other density reader. Initial download
  holds at ≈630 kB gzip. Ledger unchanged:
  **87 ✅ · 7 🟡 · 0 ⬜**.
- **Phase 45 — "Performance Round 2"** — **A measured diet.**
  The poster key-art panels (~318 kB of base64 JPEG, shown
  only on the start screen) no longer ride the initial
  bundle — they load as their own chunk behind the splash
  screen and fade in when they land, cutting the initial
  download from ≈866 kB to ≈629 kB gzip (−27%). The
  **Low tier is now a real weak-phone preset**: shadows
  off entirely (the city looks flatter — that's the trade,
  and the Settings notes say so), resolution capped at
  native 1.0, ambient traffic and crowds capped at half
  whatever the density levers say, and harbour wildlife
  updating at half rate; the resolution governor never
  goes above your tier's cap, so the preset and the
  governor can't fight. Medium and High are untouched.
  No frame-rate is promised for any device — the HUD's
  FPS counter on your own phone is the verdict. Opens
  with an audit of Phase 44 that found **one defect**:
  Drive assist Full's camera auto-centre also ran behind
  boats and the plane, against its documented
  road-vehicles-only scope — behind the plane it chased
  the tail through every banked turn. It now carries the
  same exclusion as the steering smoothing. Ledger
  unchanged: **87 ✅ · 7 🟡 · 0 ⬜**.
- **Phase 44 — "Assists & Accessibility"** — **Four new
  settings** in Phone → Settings → **Assists & accessibility**,
  every one defaulting to Off — the game plays exactly as it
  did until you opt in. **Drive assist** (Light/Full) smooths
  steering at speed for cars and bikes, applied to the merged
  input so keyboard, gamepad, touch stick and gyro all get it;
  Full also eases the chase camera back behind your car once
  you stop orbiting (any drag or stick input takes it back
  instantly). It changes no top speed, no grip, and **not
  drift scoring** — the drift feed reads your raw input.
  **Aim assist** (Soft/Strong) is magnetism while free-aiming:
  your shot leans part-way toward the nearest person inside a
  small cone — never a lock-on, never through a wall, and hip
  fire stays unassisted. **Colourblind-safe HUD** recolours
  only the HUD and map markers from a colourblind-safe
  palette (police and wanted stars sky blue, targets yellow,
  you and your cars white, money and Bank event badges in
  safe green/vermillion beside the same +/− signs) — the city
  itself doesn't change. **Reduced flash** softens lightning
  and muzzle flashes at their existing effect sites (there is
  no explosion flash in the game to soften — none was
  invented). Subtitle size S/M/L already lives under
  Subtitles (Phase 5) and is unchanged. The round opens with
  an audit of Phase 43 that found **zero defects** — the
  double-press, overlap, gallery-eviction, pod-publication,
  wall-listener and NG+ checks all verified in code. Ledger:
  **87 ✅ · 7 🟡 · 0 ⬜** (one new line — Assists &
  accessibility).
- **Phase 43 — "Photo Challenges"** — **The Sable Postcards.**
  The Wire's picture desk will buy **eight postcards**, one of
  each: a dolphin mid-breach, the police helicopter's shift at
  4★+, a storm over the harbour, the bay bridge and Breakwater
  Point in golden light, Club Solace's neon, the PORT SABLE
  sign after dark, and Northreach's dome. Shoot them in Photo
  Mode — a shot that fits an open postcard is **bought on the
  spot** ($100–$150), stamped in your Gallery, and its framed
  print fills a slot on the **Postcard Wall** at the Northgate
  Loft. Detection is stated honestly, in the app and here:
  there is **no image recognition** — at the shutter press the
  game checks what it actually knows (where the camera stood
  and pointed, the hour, the weather, your wanted level, the
  pod's live positions), and every postcard's entry in the
  Gallery prints its real check. Progress is per save slot and
  survives New Game+. The round opens with an audit of
  Phase 42 that found **two defects**: Elias's "Dolphins —
  good sign" bark and the catch roll were testing the pod
  against **two different cast points** (your line's actual
  landing point vs the spot's nominal one), so the promise
  and the payout could disagree on a short cast — they now
  read the same point; and the New Game+ reset never cleared
  the supply run's day stamp (inert, but the last exit path
  that bypassed the shared reset — it uses it now). Ledger
  unchanged: **86 ✅ · 7 🟡 · 0 ⬜** (the Camera line grows).
- **Phase 42 — "Harbour Wildlife"** — **The bay is alive.** A
  pod of **five dolphins** porpoises a loop around Sable Island
  and along the mainland shore — breaching arcs, splash rings,
  and one real behaviour: take a boat out and get within nine
  metres of one and it **dives** for a few seconds. **Perched
  gulls** now sit on mooring posts at the pier, the island dock
  and the waterline; walk up and they **scatter** into a holding
  circle, then resettle once you've moved off. And the pod is
  worth money to a patient angler: fish while the dolphins work
  within forty metres of your cast and the **rare catch chance
  doubles** — Elias will tell you why ("Dolphins — good sign.").
  Stated plainly: the pod swims a scripted ambient route, not
  an ecosystem simulation, and the placement audit now walks
  the route itself (open water throughout, clear of the
  island, the bridge and the moored ships). The round opens
  with an audit of Phase 41 that found **two defects**: the
  tow job's start gate was a hand-rolled checklist from before
  the shared job census existed, so a tow job could start on
  top of a live supply run (it now uses the same census as
  every other job); and a supply run could outlive its day —
  if the new morning rolled a fresh snag for the same
  business, yesterday's run quietly retargeted to it instead
  of ending (runs now carry the day they started on). Ledger
  unchanged: **86 ✅ · 7 🟡 · 0 ⬜** (the birds/immersion and
  fish lines grow).
- **Phase 41 — "Business Events"** — **Your businesses wake up
  with the city.** Every morning, inside the same guarded tick
  that pays them, each business you own rolls for a one-day
  event: a **rush day** (takings +50%), a **quiet day** (−30%),
  a **supply snag** (takings halved — unless you run the
  **supply errand**: stock from a depot back to the business's
  door, no pay because it's your own stock, full day restored),
  a **city inspection** (pass quietly, or fail at a flat 15%
  and pay a $120–$300 fine, floored at what your pockets hold),
  or a **staff star day** (one named hand's bonus counts
  double). The morning word comes from your own people — your
  lead hand, the inspector, the star themselves — the
  **SableBank app shows a badge per business**, and every cent
  flows through the one net figure, so what the Bank shows in
  the morning is exactly what tomorrow's tick pays (proven by
  a headless arithmetic check through the real tick, 23/23).
  A rush day sometimes makes the Harbour Wire. The round opens
  with an audit of Phase 40 that found **three small defects**
  of one class — the wheelie gesture hadn't been extended to
  the brake light, the driving-skill slide trim, or the skid
  smoke/sound, so a held wheelie lit the brake, trimmed its
  own steering and smoked like a drift; all three now honour
  the gesture. Ledger unchanged: **86 ✅ · 7 🟡 · 0 ⬜** (the
  businesses and daily-tick lines grow).
- **Phase 40 — "Bike Handling"** — **The two bikes get a feel
  pass.** Both now **lean into corners** in proportion to speed ×
  steering — the motorcycle's bank deepens into a shared pose and
  the bicycle leans for the first time (it cornered bolt-upright
  before) — and the **rider leans with the machine**, so bike and
  rider move as one body. The motorcycle gains a **wheelie**:
  hold Space (the DRIFT button on mobile) with the throttle open
  at low-mid speed and the front rises — pitch only, no free
  speed — but hold it past the balance point for more than a
  moment and you **loop out**: a gentle fall, speed scrubbed,
  rider unharmed. The bicycle gains a **bunny hop** on a tap of
  the same key — a visual hop that clears nothing. The round's
  census also fixed two silent fallbacks of the class Phase 28
  hunted: the motorcycle was wheel-sampled on the sedan's
  footprint and drift-scored on a default factor; both entries
  are explicit now. Courier stays bicycle-only, exactly as
  designed, and its position-based drops are untouched. The
  round opens with an audit of Phase 39 that found **zero
  defects** (door gating, interior exits, Petra's hide, the
  jukebox/club music holds, the harbour log, diner hours and
  the chat limiter all verified in code). Ledger unchanged:
  **86 ✅ · 7 🟡 · 0 ⬜** (the motorcycles line grows).
- **Phase 39 — "Two More Interiors"** — **Two new rooms, both in
  the streamed districts (interiors 13 + 14).** The **Eastmere
  Diner** is enterable at last: Petra behind her own counter (her
  street figure steps away while you're inside — never two
  Petras), a 3-item menu (chowder $14, coffee $6, the Fisherman's
  plate $22 — tap to browse, hold to order), booths with
  regulars, and a **jukebox** that plays Daylight Causeway on the
  same room-hold machinery as Club Solace. Doors **06:00–23:00**;
  at closing Petra calls it once and the kitchen stops — nobody
  is thrown out. The **Westbrook silo office** sits atop the
  grain silo (the door fade is the lift, and the sign says so):
  desk, a painted harbour chart, the bay in a painted window,
  and the **harbour log** — read it for the Wire's latest
  headlines and your standing in every district, off the real
  game data. Always open, no NPC. Both doors work only once
  their district has streamed in — which is also the only moment
  you can stand at them. The round opens with an audit of
  Phase 38 that found and fixed one real defect: the multiplayer
  chat rate limit reset whenever a client re-joined or hopped
  rooms, so it only bound players who didn't try to evade it —
  the anchor now follows the player id across rooms (two new
  tests; the Python suite is 48). Ledger unchanged: **86 ✅ ·
  7 🟡 · 0 ⬜** (the enterable-buildings line grows: 12 → 14
  pocket interiors, still 🟡 — each room is hand-built).
- **Phase 37 — "The Quiet Harbour"** — **Post-story arc II: the
  city after Solano.** Three quiet, character-driven missions
  (phone-offered once the story is done, tracked in the Story
  app): walk the town beach with Old Elias's errand and lift
  Solano's three old mooring markers; give **Lina Park a day
  off** — a no-pressure drive to Northreach's observatory and
  the Point beyond it, conversation all the way, gated on the
  district actually loading (if it won't, she postpones); and
  sit on a **new Coral Shores bench** with Elias and Tamim —
  free, working, and in no hurry — for the story's closing
  conversation and a $250 gift he insists on. The arc's real
  reward is permanent: a **brass plaque** on that bench —
  *"For the ones who stayed."* — rendered in the world for the
  rest of the save (NG+ takes it away with the arc). The round's
  audit also fixed a Phase 36 visual defect: lightning's random
  strikes could spear through a roof to ground level; endpoints
  are footprint-tested now, in the base city and the streamed
  districts alike. Ledger unchanged: **86 ✅ · 7 🟡 · 0 ⬜**
  (the side-storyline line grows).
- **Phase 36 — "Weather Depth"** — **The sky commits.** The
  weather machine now rolls its next state in advance: the phone's
  weather page (harbourweather.ps) shows a **"Turning to"**
  forecast beside its next-change timer — the machine's real
  committed future, not a guess — and the HUD weather chip flashes
  an amber arrow with the incoming weather's icon in the last
  moments before the turn. Pressing Y re-rolls the forecast along
  with the weather. Storms deepen: **lightning strikes land
  somewhere real now** — on the tallest roof nearby or on the sea
  (spectacle only; lightning has never hurt anyone in Port Sable)
  — boats ride a **weather chop** that roughens the swell as rain
  and storm build, and the Sparrow shudders with **storm
  turbulence** on its airframe (presentation only — its flight
  path, and the Sparrow Run's par, are untouched). **Roads dry
  slowly**: streets soak in seconds and take ~2.5 minutes to dry,
  and the gloss, the puddles and your tyres' wet grip all follow
  the road's actual wetness instead of the last raindrop. And in
  **Autumn**, amber leaves blow across the streets on the same
  wind the palms feel (the seasons already moved the sun and the
  day length — that part isn't new). The round's audit fixed a
  Sable Tunes honesty bug: the elapsed clock kept counting while
  Club Solace held your track — suspended silence is no longer
  reported as listening time. Ledger unchanged: **86 ✅ · 7 🟡 ·
  0 ⬜** (the dynamic-weather line grows).
- **Phase 35 — "Phone Media"** — **Sable Tunes + a grown-up
  Gallery.** The phone's Music app is now a real music player
  (game/tunes.ts): four original WebAudio compositions as
  selectable tracks — the opening theme "Port Sable Sunset", the
  Club Solace 116 BPM loop, and two loops composed this phase,
  "Daylight Causeway" (96 BPM daytime cruise groove) and "Neon
  Meridian" (84 BPM night-drive synth) — with play/pause,
  prev/next, and honest readouts (elapsed time + position inside
  the fixed loop; a loop has no total length, so there is no fake
  progress bar). Club Solace keeps priority: entering suspends
  your track and the room loop takes over, leaving resumes it;
  your selection persists per slot, and the N mute remains the
  game's one audio switch (there is no volume setting to ride —
  the app says so). The **Gallery** now keeps the last 12 shots
  (oldest replaced), labels each new capture with its district —
  streamed districts included — and opens any shot full-screen in
  the app with its district, date and a delete button; the phone
  copy stays a 320 px JPEG by design (the full-res PNG still
  downloads at capture). The round's audit closed a Slide Series
  leak: a drift chain opened *before* the GO count could bank
  inside the run — the slate is now wiped at GO, so every banked
  point in a run is earned inside it. Ledger unchanged:
  **86 ✅ · 7 🟡 · 0 ⬜** (the smartphone lines grow).
- **Phase 34 — "Drift Championship + Local Bests"** — **The Sable
  Slide Series**: a 3-round drift championship built on the Sable
  Cup's structure. Arm a round in Phone → Jobs, drive to its amber
  ring, and thread the course's gates in order before the clock
  dies — while banking the round's drift target (Docks Yard 500,
  Bay Infield 800, Northgate Interchange 1,000). The Series counts
  only banked chains, straight off the drift system, so a collision
  still loses the open chain before it can score. Pass all three
  (in order — each round unlocks the next) for $3,000, a Harbour
  Wire headline, the champion's title, and **Slide Gold**, a
  champion-only swatch in Lina's existing respray palette. Phone →
  Stats also gains a **Records** board: best drift chain, Slide
  round bests, all five race bests, derby best and best catch in
  one place. (Drift scores are deliberately NOT posted to the
  Python leaderboard — it ranks race *times*, and a points total
  isn't a time; race bests already sync.) The round's audit caught
  a garage-shaped hole in Phase 33's service-unit guards: the job
  ambulance/tender could be filed into the garage (panel, take-out
  swap, even the villa-drive auto-save) and come back out as an
  *owned* car — every store/restore path is guarded now, including
  saves the earlier builds already wrote. Ledger unchanged:
  **86 ✅ · 7 🟡 · 0 ⬜** (the activities line grows).
- **Phase 33 — "Combat Depth"** — **Cover, a new gun, and nerve.**
  **Cover-lite**: crouch against a wall or a car with a firearm in
  hand and you're IN COVER (the chip says so) — tucked lower, harder
  for the patrol to keep eyes on, slower to grab. Aim out of it and
  you're PEEKING: exposed at the normal crouch range until you stop
  aiming. Stated plainly in the docs: Port Sable's police arrest
  rather than shoot, so cover works on the sight and bust maths —
  no fake "enemy accuracy" was invented. **The Kestrel Carbine**:
  Sable Arms' own mid-tier automatic ($950) — longer reach and a
  heavier hit than the SMG, its own model, voice and teal tracer,
  two fittings on the mod bench (suppressor, match grip + long
  barrel), its own ammo pool (ammo is per-weapon in this build),
  and one pickup waiting on the mansion drive. **Suppression-lite**:
  near misses and sustained fire break bystander nerve — crowds
  scatter through the ordinary flee reaction, faster the longer
  you keep shooting, quieter with a suppressor fitted. The round's
  audit fixed three Phase 32 leftovers: a mid-shift reload could
  resurrect the job ambulance as an orphan car (it can't now), the
  tow job could book your own tender as its "breakdown" (excluded),
  and a burned-out fire could leave the next one unfinishable on a
  short tank (the refill gate now covers that path too). Ledger
  unchanged: **86 ✅ · 7 🟡 · 0 ⬜** (the combat lines grow).
- **Phase 32 — "Service Jobs"** — **Work the harbour's emergency
  shifts.** The dispatch sim has sent NPC ambulances and fire
  tenders across Port Sable since Phase 7 — now you drive them.
  **Paramedic** (start at the hospital door): the job ambulance
  waits on the hospital lot; reach the patient on the clock (a
  lying figure at a real roadside spot), treat them on foot
  (hold E), and bring them back to the hospital bay — $110 a
  patient plus a time bonus and a no-damage bonus, three patients
  a shift with the legs getting longer. **Firefighter** (start at
  the NEW **Sable Fire Station** on the Docks strip): park the
  tender close, hose the fire down on foot while it visibly
  shrinks — and mind the tank: a fire drinks 55 of its 100, so
  the refill at a marked hydrant (or back at the station) between
  the shift's two fires is real, not theatre. Both units are new
  vehicle kinds on the rental discipline (yours for the shift,
  never ownable), sirens and flashing beacons included — and the
  siren never draws the patrol: the jobs are wanted-neutral, and
  traffic eases kerb-ward for you through the same path it uses
  for a horn. Busted, wasted, wrecked or walked-away all end the
  shift honestly, and Dispatch — Ren talks you through all of it.
  The round's audit also fixed a freeze the census caught:
  stepping out of a car on the **parking-garage deck** left you
  unable to walk (the on-foot stand test only knew the bridge's
  shape up there) — the deck and its ramp are floors again.
  Ledger unchanged: **86 ✅ · 7 🟡 · 0 ⬜** (the jobs lines grow).
- **Phase 31 — "Northreach"** — **A third streamed district.**
  North of Northgate, the x=−20 road crosses a short bridge to
  **Northreach**: a quiet clifftop headland with a stone chapel,
  an observatory dome, a tea house, cottages and the Northreach
  Point viewpoint — shipped as its own lazy chunk (2.9 kB gzip)
  on the shared district loader, traffic-free like Eastmere and
  Westbrook, with the same save guard (a car left inside
  restores at the gate while the chunk is unloaded). The round's
  audit found two real defects. **Sleeping double-paid the
  morning tick**: a sleep landing looks exactly like the 06:00
  day-wrap to the frame detector, so businesses, rent and loan
  interest all settled twice for one night — sleep now stamps
  the day it settles and the wrap check skips it. And the
  **driven-car clamp was still the Phase 24 map box**, which has
  silently walled your car out of Westbrook since it shipped
  (Eastmere fit the box by luck) — the car and plane clamps now
  grow over any loaded district you're entering, so Westbrook
  is drive-in at last and Northreach is too. The server's world
  bounds and the map's frame both grew north honestly with the
  new land. Ledger unchanged: **86 ✅ · 7 🟡 · 0 ⬜** (the map
  line grows — streamed districts now count 3).
- **Phase 30 — "Property Income"** — **Become a landlord.** Three
  rental properties join the homes: a **Coral Shores flat**
  ($18,000 → $140/day), a **Northgate townhouse** ($32,000 →
  $260/day) and a **Docks warehouse unit** ($45,000 → $390/day —
  a new building on the Docks strip, and Sable Lets only leases
  it to business owners). Rent lands on the **same morning tick**
  as your businesses, and the SableBank app shows a **Daily rent**
  line from the same function that pays it — shown = paid.
  Tenants have luck: mostly quiet, sometimes **late** (half rent),
  sometimes **golden** (full rent + a warmer district), sometimes
  a **repair bill** ($60–$180) — paid from cash when you can
  cover it, otherwise it waits as **DUE** in the bank app and
  that unit's rent pauses until you pay it at the door (cash
  never goes below $0). Every event arrives as a message from
  **Ana Ruiz of Sable Lets**, your property manager — call her
  for a live read of the portfolio. **Sell back at 80%** at the
  door or in the bank (a due bill comes out of the proceeds);
  NG+ keeps the portfolio. No management mini-game — messages
  and money only, and the docs say so. The round opens with an
  audit of Phase 29 that found and fixed two real defects: a
  busted player double-clicking Respawn inside one HUD poll
  could be fined twice and have their evidence halved twice
  (respawn is now exactly-once), and evidence could decay while
  the arrest escort walked you to the car in fog (custody now
  counts as seen). A 34-assertion headless test pins the rent
  arithmetic to the dollar. Ledger unchanged: **86 ✅ · 7 🟡 ·
  0 ⬜** (the economy lines grow).
- **Phase 29 — "Police & Crime Depth"** — **The patrol keeps a
  file on you now.** Every crime they learn about adds **evidence**
  (running a ped down +20, gunfire/robbery +15, assault +10, car
  theft +8, theft +6, a witnessed crash +5, reckless driving +4;
  the file caps at 100). At 25/50/75 evidence the next reported
  crime starts you at a **1★/2★/3★ wanted floor** — the report is
  matched to your file — and the patrol **searches longer** before
  each star falls (11 s + 0.08 s per point). Lay low, clean and
  unseen, and the file thins (1 pt per 4 s); a **fresh look** — a
  wardrobe change, a new Thread & Tide outfit, a Sable Cuts cut or
  trim — thins it 4× as fast for 2 minutes. Get busted or wasted
  and half of it is served. A teal **👁 chip** beside the stars
  shows the count while the file is open, and Phone → Stats shows
  the number, your floor and the full rules. New contact: **Marek
  Doss, the Fixer** (after Ch.2) — for max($250, $150 + $6 per
  evidence point + $200 per star) he burns the whole file and
  clears your stars, once a day — but **never while they're
  looking at you**. One honesty note, in the open: nobody in Port
  Sable recognises your clothes or haircut — witnesses and patrol
  key on the act, never the outfit — so a fresh look thins the
  file and does nothing else; no disguise reset is claimed. The
  round opens with an audit of Phase 28 (no defects: both new
  cars verified in every kind-keyed table and save path, the boat
  clamp against the fishing/derby anchors, the stall chip's
  hysteresis, the placement audit still CLEAR). Ledger unchanged:
  **86 ✅ · 7 🟡 · 0 ⬜** (the police & wanted lines grow).
- **Phase 28 — "Vehicles"** — Two new original cars, fully wired
  (dealer, garage, mods, drift, races, fleet saves): the **Vantara
  Tempest** ($26,000) — Vantara's flagship GT coupe, a step above
  the Kestrel RS, rear-drive with the range's top drift factor,
  one standing on the Sable Motors display row; and the **Sable
  Mule** ($3,200) — the farm's cheap workhorse with the best dirt
  grip of any pickup and a farm truck's road pace, parked by the
  farmhouse. (Traffic note, stated plainly: the traffic system is
  grid-bound with no district gating, so the Mule is dealer +
  farm-parked only — it does not pose as Downs-only traffic.)
  **Boats feel like boats**: the helm gets heavier with speed, the
  bow rises as the hull planes and settles as way comes off, the
  wake builds with the throttle, and a storm now pushes a hull
  onshore (position only — a fishing session anchored to a still
  hull is untouched). **The Sparrow gets a stall with a face**: a
  pulsing STALL chip, a visibly dropping nose below flying speed,
  landing gear that compresses on touchdown, and a prop blur disc
  that spins up with the engine. Flight numbers are unchanged —
  the Sparrow Run's 2:00 par stands as reachable as ever. The
  round opens with an audit of Phase 27 (five fixes: a streamed
  load's success never cleared its loading flag, so a gated
  mission start could wait out a full 10 s for a chunk that had
  already landed; the tail courier could outlive its mission via
  NG+ and be inherited by a later tail; a failed photo mission
  left its camera arm standing for the retry; the multiplayer
  server's east bound clipped a swimmer at the client's own
  offshore limit by 1 unit — now 178, suite still 32/32; and
  boats, the one unclamped vehicle class, could sail off the
  server's chart — they now stop at the chart edge and say so).
  Ledger unchanged: **86 ✅ · 7 🟡 · 0 ⬜** (the vehicle lines grow).
- **Phase 24 — "Sea Life"** — **You can fish from boats now**: sit
  in any still boat (your speedboat, a borrowed skiff, even the
  marina rental) and cast over the side. The boat is the spot —
  the line lands ahead of the bow — and open water fishes the
  **offshore table**: richer weighting and a sixth fish, the
  **Sable Tuna**, that never shows at the shore spots. Start the
  engine, step out or get busted and the session ends cleanly;
  the creel is the same bucket you sell at Harbour Wraps. New
  world event: the **Fishing Derby** — when the Harbourmaster
  calls it, enter free at the pier ring and every catch for the
  next 3 minutes scores its value, shore or boat. Beat the house
  score (it scales gently with your lifetime catches) for **$300
  and a Harbour Wire headline**; your best derby score is kept in
  Stats. The round opens with an audit of Phase 23 (two fixes:
  club closing time is now defined — doors lock at 04:00, last
  orders at the bar, nobody thrown out; and a slow Hurried fare's
  receipt no longer calls the ride "clean"). Ledger unchanged:
  **86 ✅ · 7 🟡 · 0 ⬜**.
- **Phase 10 — realism + physics pass** (no new features): the
  post chain gains **radial chromatic aberration** and a stricter
  bloom threshold; **fog colour follows the day cycle**; **stars**
  fade in on clear nights; **cloud cover thickens with the weather**;
  building windows get a **per-pane night emissive layer** (warm and
  cool lit rooms, most dark); puddles reflect harder at night;
  **power lines** sag between the lamp poles; and the C++ core grows
  four steps — **per-wheel suspension** with visible wheel travel and
  body pitch/roll/heave, **surface grip** (wet asphalt, dirt, sand —
  with wheelspin smoke and wider wet handbrake slides),
  **impact-directed debris** with **asymmetric car crumple**, and
  **swim drag + stroke bob**. Pedestrian knockback now follows the
  car's momentum, and rain throws up **splash rings**. Full per-tier
  effect table and the remaining realism ceiling: docs/VISUAL_AUDIT.md
  (Phase 10 section).

## Personal themes

Open the pause menu (Esc/P), the side panel, or press **T** / **1–5**:

| # | Theme | Look |
|---|------|------|
| 1 | Harbor Dusk | Teal + amber coastal dusk (default) |
| 2 | Midnight Patrol | Deep navy night, bright lamps, police glow |
| 3 | Desert Gold | Warm sand/gold clear day |
| 4 | Emerald Bay | Lush green-teal day |
| 5 | Noir Mono | Desaturated mono + one red accent |

A theme changes sky/fog, sun + ambient light, water, window/lamp glow,
HUD + minimap colours, your accent ring and Rayan's shirt. The choice is
saved in `localStorage` and applies identically on web and desktop.
(Deliberately no pink/purple theme.)

## Controls

### Keyboard
| Keys | Action |
|---|---|
| WASD / Arrow keys | Move · drive + steer |
| Shift | Sprint (on foot) |
| Space | Jump (foot) · handbrake/drift (car) · hold with W on the motorcycle at low-mid speed = wheelie (hold too long past the balance point and you loop out) · tap on the bicycle = bunny hop |
| E / F | Enter/exit car · advance dialogue · board/step off the Sable Line tram at a station · board/step off the Cityliner bus at a stop |
| Enter | Confirm dialogue |
| Esc / P | Pause |
| H / ? | Shortcuts help |
| T | Cycle theme · **1–5** switch theme directly |
| M | Big city map |
| L | Hold / resume day cycle |
| C | Camera near/far |
| N | Mute / unmute |
| R | Respawn when busted/wasted · retry from checkpoint after a mission fail · restart current mission |
| E at a bench / restaurant chair | Sit down (E or move to stand) |
| Space at a deep-water edge | Dive into the water |
| E at your home | Sleep — morning, full heal, businesses pay out |
| Hold E at a business | Buy it (Wraps stall · Car Wash · Club Solace share · Marina Rentals · Coral apartment) |
| Hold E at the marina dock | Rent a rental skiff ($75 day-pass — needs Marina Rentals owned) |
| Phone → SableBank → Loans | Borrow $500/$1,500/$4,000 · repay part or in full |
| Phone → SableBank → business row | Upgrade a business to Lv2/Lv3 (+35% takings per level) |
| Q / Tab | Cycle weapon — fists · pistol · SMG · shotgun · bat · bottles |
| Hold right-mouse | Free-aim — over-shoulder camera, fire along the crosshair |
| W / Shift / Ctrl (in the Sparrow) | Throttle · climb · descend — lift off past ~60 km/h, land gently |
| E at Sable Arms | Tap: browse guns + weapon mods (suppressors, mag, sight, choke) · hold: buy/fit |
| E at Sable Cuts / Port Ink (Market Row) | Tap: browse hair / beards / tattoos · hold: buy (cut $25 · beard trim $15 · tattoo $60, 07:00–23:00) |
| E near a named townsfolk | Talk — branching conversation (Tomas, Priya, Bea, Kip) |
| E at bottle crates (Club Solace / pier) | Restock throwing bottles (+6) |
| E at the pier / island dock | Fish — hold E to charge, release to cast, tap E on the bite, hold E to reel (keep the marker in the green) |
| E at Lantern Park gym stations | Workout session ($10, once a day each) — tap E in the moving zone ×8 |
| E at Thread & Tide (Market Row) | Enter the shop (07:00–23:00) · inside at the counter — tap: browse outfits · hold: buy (worn until you change character/variant) |
| Phone → Jobs → Tow shift | Tow stranded cars with the wrecker at Lina's — reverse the hook in, hold still to hitch, deliver to the yard ($150) |
| Phone → Jobs → Farm shift | Haul 3 crate loads from the Downs barn to Harbour Wraps in the farm pickup ($120/load + $150 shift bonus) |
| E at the Downs farmhouse door | Enter the farmhouse — sleep free in the farmhand's bunk (morning at the farm; your respawn home doesn't move) |
| Phone → SableBank → Invest | Buy/sell three local stocks in $100 lots |
| Click / J (hold for SMG) | Punch / fire weapon |
| Hold B (on foot, 1★, unarmed) | Surrender — $100 fine, no cell |
| Space near a bench / hedge | Vault over it |
| M (in a car, at a garage) | Lina's mod menu (elsewhere: big map) |
| E at shop counters | Tap: browse · hold: buy (dealership, Sable Arms, pawn) |
| Mouse drag / wheel | Orbit / zoom camera |

### Gamepad
Any standard-mapping controller works alongside keyboard/touch
(last input wins): **left stick** move/steer (analog — push past the
edge to sprint), **right stick** camera, **RT/LT** accelerate/brake,
**A** interact, **B** exit car / back, **X** jump / handbrake,
**Y** phone, **LB** weapon cycle, **RB** horn, **Start** pause,
**LT (hold, on foot)** free-aim.
A toast confirms when a gamepad connects.

### Play on your phone
Open the Vercel link in your phone browser — touch controls appear
automatically on touch devices: a **floating analog joystick** that
appears exactly where your left thumb lands (push gently to walk,
far to run, past the edge to sprint; while driving it steers
analog-style and the **gyro only steers while the stick is centred**) +
JUMP and E buttons on foot; GAS/BRAKE pedals, DRIFT, HORN and EXIT
while driving; a pause button top-right; drag the right side of the
screen to orbit the camera. The side panel collapses behind the ☰ button.

### Graphics quality (Phase 5, smoothness Phase 8)
Three tiers — **Low / Medium / High** — auto-detected on first run
and self-tuning: a 2.5-second FPS sample after you start playing
steps the tier down once if the device struggles. Phase 15 hardens
the detection: High is only auto-assigned when the browser *reports*
strong hardware (≥8 GB device memory and ≥8 cores, fine pointer) —
browsers that don't report memory (Safari, Firefox) start at Medium
instead of being assumed strong. Raising the tier to High yourself
is sample-checked for 2 s; if the machine sustains under 30 FPS it
steps back to Medium with a toast. The dynamic-resolution ladder
also gained a 1.0 floor, so sustained load sheds resolution first. Phase 8 adds **dynamic resolution** (the
render resolution walks a ladder toward your tier's cap to hold frame
rate) and a **continuous adaptive tier** (sustained low FPS drops one
tier with a toast) — picking a tier yourself turns the auto-drop off
for the session. A **Show FPS** readout lives in the same two places.
Override any time in **Pause → Graphics** or **Phone → Settings**.
Low = the weak-phone preset (Phase 45): no post-processing, no
shadows at all, resolution capped at native 1.0, ambient traffic
and crowds capped at half, wildlife at half rate, procedural
textures only.
Medium = film grade (bloom, grain, vignette, radial chromatic
aberration, SMAA), real CC0 photo textures at 512px, shader water.
High = + SSAO, stronger bloom, CC0 at 768px, softer shadows.
The composer renders at canvas size, so it follows the dynamic-
resolution ladder; dropping to Low unmounts it entirely.

**Reflections (Phase 11)** — the Settings readout (Pause → Graphics
or Phone → Settings) always names the pipeline in use: **Off**
(Low), **Standard** (Medium: PMREM sky probe + fresnel shader
water), or **Ray-traced-style** (High). Ray-traced-style is the
honest label for what a browser can do in real time — there is no
hardware ray tracing in WebGL — so High builds the look from
reflections instead: **screen-space reflections** traced only
across glossy surfaces (wet streets, puddles, glass, clearcoat
paint) at half resolution, and a **planar-reflection bay** whose
mirrored camera reflects the real skyline, bridge and sunset into
the water. Both are the most expensive effects in the game: both
are High-only, both switch off automatically when the smoothness
governor steps the tier down, and a **Ray-traced reflections**
toggle in the same two settings screens disables them on their
own if High stutters on your phone.

**Your levers (Phase 16)** — beyond the quality tiers, three
world levers sit in **Pause → Settings** and **Phone → Settings**
and apply live, no reload: **Traffic density** (Low runs half the
ambient cars — buses, taxis and emergency units always run, and no
car ever vanishes within 25 units of you; High keeps the rush-hour
reserve circulating all day), **Pedestrian density** (scales the
crowds over the day/night rhythm), and **View distance** (Near /
Normal / Far scales how far out traffic and walkers stream in and
where the fog sits). All three persist per save slot; Normal
everywhere is exactly the pre-Phase-16 behaviour.

**Smoothness (Phase 12)** — the simulation (player, driven car,
traffic, peds, police) runs on a **fixed 60 Hz timestep**, so game
speed and feel are identical on 30/60/120 Hz screens and frame
spikes can't tunnel collisions. Far-away traffic and pedestrians
make their decisions on staggered slices while near ones update
every step; street lamps, palm trunks, pine trees and street props
are GPU-instanced (roughly 1,400 fewer draw calls per frame); the
sun's shadow map refreshes on a snapped grid instead of every
frame; and the initial download is much lighter — the photo
textures and the phone/garage/mod/character screens now load on
first use instead of up front (**initial JS ≈ 760 KB gzipped,
down from ≈ 1,730 KB**). Low tier never downloads the photo
textures at all.
Dialogue is fully subtitled (cinematic letterbox + typewriter);
subtitle size/background, ambient barks and the letterbox bars are
adjustable in the same two places.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Web (Vercel) / Desktop (Electron) — same build: client/dist  │
│  TypeScript + React + Three.js (@react-three/fiber)          │
│  rendering engine · game systems · HUD · themes · touch      │
├──────────────────────────────────────────────────────────────┤
│ Game-logic core: C++17 "Harborfall Core" (src/cpp/physics.cpp)│
│  → WebAssembly: vehicle/pedestrian steps · collision ·       │
│  traffic decisions · police LOS sampling · boat buoyancy ·   │
│  race pacing …with exact TypeScript mirrors (no WASM needed) │
├──────────────────────────────────────────────────────────────┤
│ Server engine: Python + FastAPI (server/main.py)             │
│  WebSocket rooms (32/room) · state relay + speed/teleport    │
│  sanity checks · wanted/mission event relay · /health        │
│  /v1/leaderboards · /v1/economy/snapshot (JSON persistence)  │
├──────────────────────────────────────────────────────────────┤
│ PC shell: Electron (desktop/main.cjs) + electron-builder     │
│  Windows NSIS .exe · macOS universal .dmg                    │
└──────────────────────────────────────────────────────────────┘
```
See `docs/ENGINE.md` for why each language is used, and `docs/STORY.md`
for the full story bible.

## Languages — what runs where, honestly

| Language | Runs | Owns |
|---|---|---|
| **C++17** | In the browser, as WebAssembly (with an exact TypeScript mirror when WASM is absent) | The **Harborfall Core**: vehicle + pedestrian stepping, collision, traffic stop/go decisions, police line-of-sight sampling, boat buoyancy, race-opponent pacing — the game's decision logic, verified by a g++ smoke test |
| **Python** | Server host (Render/Railway/Fly/your machine) | The FastAPI service: multiplayer WebSocket rooms with anti-teleport checks, leaderboards and economy snapshots with JSON persistence |
| **C# / .NET 8** | Developer's desktop only | `tools/Harborfall.WorldTools` — validates the world-data snapshot and inspects exported saves. The same role C# tooling plays in Unity/Unreal pipelines |
| **TypeScript** | In the browser, natively | The presentation shell + glue: rendering (Three.js), HUD, phone, input, and the mirrors of the C++ core |

**Why TypeScript exists at all:** browsers execute JavaScript and
WebAssembly — nothing else. There is no way to ship a browser game
whose presentation layer is C# or Python; that is a platform
constraint, not a preference. What *can* move — decision logic — has
moved into the C++ core; services live in Python; tooling lives in C#.

## Run locally

```sh
# Web client

# Placement audit (headless): every car spawn, lane, door, register
# and scatter prop tested against the building colliders
node tools/audit-placements.mjs   # from the repo root; exit 1 on findings
cd client && npm ci && npm run dev        # http://localhost:5173
npm run build                             # production build -> client/dist

# Multiplayer server (optional)
python3 -m venv /tmp/hf-venv && /tmp/hf-venv/bin/pip install -r server/requirements.txt
cd server && /tmp/hf-venv/bin/python -m uvicorn main:app --port 8765
# then run the client with: VITE_MULTIPLAYER_SERVER_URL=ws://localhost:8765/ws npm run dev
# Joining: the game auto-joins the room code in the game panel (press
# the panel open, "Multiplayer room code"). Friends type the SAME code
# to share a room; different codes are fully separate worlds. The code
# is remembered per save profile, and the built-in default is "sable"
# — the server's shared default room, so two fresh installs meet there
# by doing nothing. Set your display name in Phone → Settings first;
# chat from the panel's Room chat box (200 chars, ~1 line / 1.5 s,
# enforced by the server).

# Server tests (pytest suite in server/tests/ — endpoints, the
# WebSocket join/relay flow, malformed-message handling, the
# anti-teleport gate, and Phase 38's names/chat/room codes;
# hermetic, no network or secrets needed)
/tmp/hf-venv/bin/pip install pytest httpx
cd server && /tmp/hf-venv/bin/python -m pytest   # 48 tests

# WASM physics (optional — TS fallback is built in)
./scripts/build-physics.sh --deploy       # needs Emscripten; writes client/public/physics/

# Desktop
cd client && npm run build && cd ../desktop && npm install && npm start   # F11 fullscreen
npm run dist:win   # or dist:mac — build on the target OS, or use GitHub Actions
```

## Deploy to Vercel (web version)

1. Go to vercel.com → **Add New → Project** → import this repo (`mostakimadibbd/gta`).
2. Set **Root Directory = `client`** (Framework Preset: Vite — `client/vercel.json` already sets build `npm run build`, output `dist`, SPA fallback).
3. Click **Deploy** — done. Share the link; the game is fully playable with **no env vars** (single-player/offline).
4. Optional multiplayer: host `server/` on any ASGI host with WebSockets, then add env var `VITE_MULTIPLAYER_SERVER_URL=wss://<your-server>/ws` and redeploy.

**Server deploy (fixed — the server ships with a deploy pack for every host):**
- **Render:** this repo's root `render.yaml` defines the `harborfall-server` web service automatically (rootDir `server`, health check `/health`).
- **Railway / Heroku-style:** `server/Procfile` runs `uvicorn main:app` on `$PORT`; `server/runtime.txt` pins Python 3.12.
- **Docker / Fly.io / any VPS:** `server/Dockerfile` (python:3.12-slim) — `docker build -t harborfall-server server/ && docker run -p 8765:8765 harborfall-server`.
- **Vercel (HTTP/health only):** create a *separate* Vercel project with **Root Directory = `server`** — `server/vercel.json` routes everything to the FastAPI app. Note: Vercel serverless does not keep WebSockets open, so multiplayer needs Render/Railway/Fly/Docker above; the game itself is fully playable single-player without the server.
- Dependencies are intentionally slim (`fastapi` + plain `uvicorn`) so installs never fail on native builds.

A repo-root `vercel.json` is also included, so importing with the root as
the project root works too (it builds `client/` explicitly).

## Desktop releases (Windows + macOS)

`.github/workflows/desktop-release.yml` builds both installers on
`windows-latest` + `macos-latest` and attaches them to a GitHub Release —
push a tag like `v1.0.0` or run it manually from the Actions tab.
Installers can't be cross-built or code-signed inside a Linux dev VM (no
Windows/macOS toolchains or signing certificates), so local `dist:*`
scripts are provided for building on your own machine and CI does the rest.
Unsigned installers may trigger SmartScreen/Gatekeeper first-run prompts.

## Honest limits

- **Realistic-styled, not photoreal.** Phase 5 raised the ceiling —
  real CC0 photographed PBR maps on roads/sidewalks/brick/plaster
  (credits: `ASSETS_LICENSES.md`), clearcoat car paint, a custom
  water shader, PMREM sky reflections, SSAO on High, and Phase 11's
  ray-traced-style reflections (SSR + planar water) on High — but buildings,
  cars and people are still code-built geometry, not scanned or
  modelled assets. Photoreal is not achievable in an instant-play
  browser build; glTF upgrades are a manual path (`SETUP_MANUAL.md`).
- The embedded CC0 maps cost ~950 KB (gzip) of download so the game
  can ship with zero hosted files; the Low tier never decodes them.
- **No hardware ray tracing.** Browsers expose no RT cores through
  WebGL, and three.js's experimental WebGPU path tracer neither
  runs on iOS Safari nor hits real-time rates on phones. Phase 11's
  "Ray-traced-style" reflections (screen-space reflections +
  planar mirrored water + a PMREM probe, High tier) are the
  real-time reflection stack web games actually ship — labelled
  as such in Settings, never as ray tracing.
- Motion blur is not implemented (no cheap robust effect exists in
  the post library); a speed FOV kick carries the sensation instead.
- Multiplayer is positional relay (no server-side game simulation);
  room state is in-memory on one server instance.
- Story is text dialogue with full subtitles (no voice acting);
  progress/cash/theme/quality persist in `localStorage` on the
  device you play on.
- Phase 6 honesty: the physics **WASM binary was not rebuilt** this
  round (no Emscripten toolchain here) — the v3 C++ source and its
  exact TypeScript mirror ship, the g++ smoke test passes, and the
  loader falls back per-function, so gameplay is identical. Faces are
  higher-resolution *painted* canvases on stylised-realistic rigs —
  still not scanned people. The loading bar counts real construction
  stages, never a timer.
- Phase 9 honesty: flight is an **arcade model** (lift/stall/ceiling
  rules in the vehicle step), not an aerodynamic simulation; the
  "ragdoll" is a procedural collapse/flail on the existing rig — no
  jointed ragdoll solver exists in the browser physics mirror; the
  arrest is a hands-up pose feeding the BUSTED state, not a cuffing
  animation. SableWeb is a closed local web rendered from live game
  data, not the open internet. Wrecks, smashed glass and broken props
  persist for the current game day only (the daily tick repairs the
  city) — see BLUEPRINT §15 for the full per-topic ledger.
- Phase 10 honesty: suspension, grip, debris and swim physics are
  authored in the C++ core with exact TypeScript mirrors (g++ smoke
  36/36) — the WASM binary still has not been compiled (no Emscripten
  in the build environment), so the mirrors are the runtime, as
  before. Car crumple is four dent panels faded by impact depth, not
  mesh deformation. Blob contact shadows were deliberately skipped:
  the follow shadow camera already grounds everything near the
  player. The realism ceiling is asset-bound (procedural/CC0 only) —
  see the Phase 10 section of docs/VISUAL_AUDIT.md.
