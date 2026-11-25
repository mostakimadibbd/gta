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
  remote players render in your city. Single-player needs no server.
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
| Space | Jump (foot) · handbrake/drift (car) |
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
Low = no post-processing, 1024px shadows, procedural textures only.
Medium = film grade (bloom, grain, vignette, radial chromatic
aberration, SMAA), real CC0 photo textures at 512px, shader water.
High = + SSAO, stronger bloom, CC0 at full size, softer shadows.
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
cd client && npm ci && npm run dev        # http://localhost:5173
npm run build                             # production build -> client/dist

# Multiplayer server (optional)
python3 -m venv /tmp/hf-venv && /tmp/hf-venv/bin/pip install -r server/requirements.txt
cd server && /tmp/hf-venv/bin/python -m uvicorn main:app --port 8765
# then run the client with: VITE_MULTIPLAYER_SERVER_URL=ws://localhost:8765/ws npm run dev

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
