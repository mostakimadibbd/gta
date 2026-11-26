# Harborfall v3.0 — Complete Edition

**Release note · Phase 50 · the overnight run (Phases 26–50) in one document.**

Harborfall is an original open-world game set in Port Sable — an original
city, story, cast and fleet, inspired by the open-world driving genre and
built entirely from procedural parts. v3.0 is the full version: everything
from the v2.0 Complete Edition, plus the twenty-five phases built,
audited and regression-tested in the 26–50 run. The start screen carries
the stamp: **v3.0 — Complete Edition**. Every surface reads version
3.0.0 — the web client, the desktop shell, the Python service.

## What the 26–50 run added, in plain language

- **A bigger map.** Two more streamed districts joined Eastmere:
  **Westbrook** (harbour-industrial shore, grain silo, dock cranes,
  Breakwater Point) and **Northreach** (a clifftop headland with a chapel
  and an observatory). Districts load as small lazy chunks when you travel
  to them; the initial download actually *shrank* during the run (the
  start-screen key art moved out of the first bundle: initial load is
  ≈641 kB gzip).
- **More story.** *The Ledger Line* (Petra Vane's three-mission arc,
  ending in a burn-or-publish choice), *The Quiet Harbour* (a post-story
  shoreline arc), and **The Harbour Crown** — a four-mission endgame
  chain for players who finished the story and built an empire (2
  businesses + 1 rental). Its auction choice is real: buy out Meridian
  Holdings for $40,000 and every business pays a permanent +10% harbour
  dividend, or expose them and read the three-edition Wire series over
  the following mornings. The finale's reward is the **Vantara
  Sovereign**, a one-of-one teal-and-gold flagship that lives in your
  garage like any owned car — across reloads and New Game+.
- **Deeper policing.** Crimes the patrol learns about build an
  **evidence file** that raises your wanted floor and stretches the
  search; a fresh look (new clothes, a haircut) thins it faster, and
  **Marek Doss, the Fixer**, will burn the file for a price — never
  while a cop is looking at you.
- **A landlord ladder.** Three rental properties pay daily rent through
  the same morning tick as your businesses, with tenant events (late
  rent, a good tenant, the occasional repair bill) arriving as messages
  from Ana Ruiz of Sable Lets. Businesses themselves now have **daily
  events** — rush days, quiet days, inspections, a star employee, and
  supply snags you can fix with a delivery run.
- **Service jobs.** Paramedic and firefighter shifts join the job board,
  dispatched by Ren, in real service vehicles from the hospital and the
  new Sable Fire Station.
- **Combat depth, honestly scoped.** Cover and peeking that deepen the
  stealth/bust game, a new Kestrel Carbine, and suppression — near
  misses break bystander nerve. (No enemy ever shoots at you in
  Harborfall; the docs have never pretended otherwise.)
- **Racing for drifters.** The **Sable Slide Series** scores real drift
  chains on three gated courses; the Phone's Records board keeps your
  drift bests, race bests, derby best and best catch.
- **A phone that plays music.** Sable Tunes plays four original
  WebAudio tracks; the Gallery keeps 12 photos with district labels and
  full-resolution downloads. A **dynamic ambient score** (Phase 46)
  layers a pad bed, a night pluck and a wanted pulse under free-roam —
  and always yields to your tracks, the club and the diner jukebox.
- **Weather with consequences.** A forecast you can read, storms that
  push boats around, roads that dry over minutes after rain, autumn
  leaves.
- **Two more interiors** (14 in total): Petra's **Eastmere Diner**
  (working menu, a jukebox, doors 06:00–23:00 — Petra is behind her own
  counter) and the **Westbrook Silo Office**, whose desk holds the
  harbour log: the live Wire headlines and your district standings.
- **Bikes with feel.** Both bikes lean; the motorcycle wheelies on
  handbrake + throttle (and loops out if you hold it too long); the
  bicycle bunny-hops. Presentation only — no free speed, ever.
- **Harbour wildlife.** A five-dolphin pod porpoises a scripted route
  around the bay (it dives when a fast boat closes in), gulls scatter
  from their mooring posts as you approach, and fishing near the pod
  genuinely improves your odds — Elias will tell you so.
- **Photo postcards.** Eight Sable Postcards pay real fees for real
  shots — the checks are positional and conditional (place, hour,
  weather, wanted level, a dolphin actually breaching in frame), never
  image recognition, and the app copy says so. Sold prints fill the
  Postcard Wall in the Northgate Loft.
- **Day events.** Some mornings bring the **Harbour Regatta** (a buoy
  time trial in your own boat — against the clock, no fake opponents)
  or the **Coral Street Market** (a parts voucher Lina honours at 25%
  off, a curios stall that fences your stash at +20%).
- **Multiplayer polish.** Display names over remote players, room chat,
  and room codes — a join with no code lands in the shared default
  room, "sable", so two fresh installs meet by doing nothing.
- **Assists & accessibility.** Drive assist, aim magnetism (never
  lock-on, never through walls), a colourblind-safe HUD palette, and
  reduced flash — all in Settings, all defaulting to the behaviour the
  game already had.
- **Performance.** A real Low preset for weak phones (shadows off,
  native-resolution cap, halved density ceilings), and the poster
  split that cut the initial download by ~27%.

The blueprint ledger, recounted line by line for this release:
**104 ✅ · 8 🟡 · 0 ⬜ over 112 topics** (`docs/BLUEPRINT.md` §15; the
recount corrected a running tally that had folded growth lines into
parent topics — no line changed state in the counting).

## Honest limits

The brand is the honest print; v3.0 keeps every line:

- **Realistic-styled, not photoreal.** People, cars and buildings are
  procedural geometry with painted/procedural textures (plus licensed
  CC0 photo maps on some surfaces — `ASSETS_LICENSES.md`). Characters
  are realistic-styled procedural figures, not scans or photographs.
  Photoreal is not achievable in an instant-play browser build.
- **Reflections are ray-traced-style** — screen-space reflections and
  planar mirrored water on High. Browsers expose no hardware ray
  tracing through WebGL; the game labels it as such in Settings.
- **The WASM binary was never rebuilt in this build environment** (no
  Emscripten here). The C++17 Harborfall Core source ships with exact
  TypeScript mirrors — verified to 4.4e-16 by the parity probe and
  49/49 on the g++ smoke suite — and the loader falls back per
  function, so gameplay is identical with or without the binary.
  `scripts/build-physics.sh` rebuilds it wherever emcc exists, and
  its export list matches the loader's 23 functions exactly.
- **The C# world tools are source-verified, not compile-verified**
  (no .NET SDK in this environment). They are developer tooling; the
  game never depends on them.
- **Multiplayer is session-based**: rooms on one self-hosted server
  instance, in-memory state, no accounts, no persistence of who was
  in a room. Names are decoration, never identity. Single-player
  needs no server at all.
- **Interiors are 14 hand-built pocket rooms**, one per enterable
  building — a scope limit, not an engine limit. The countryside is a
  farm corner network, not a rural region. Buildings don't
  structurally destruct (glass, props and the scaffold do, and persist
  for the day). The story is an authored line with real choice points
  (Ch.5, publish-vs-burn, the Meridian Pair, the Crown's
  buy-out/exposé), not a branching mission tree.
- **Wildlife is scripted**: the dolphin pod follows a route and reacts
  to boats; it is not an ecosystem simulation, and dolphins have no
  collision.
- **Playability is the player's verdict.** Every phase was build-,
  audit- and test-verified in code; no agent play-tested the game in
  a live browser. The smoke list below is the checklist that matters.

## Consolidated smoke list

Highest-risk interactions first (from the Phase 49 marathon), then the
per-phase highlights.

1. **Crown end-to-end, both branches on separate slots:** the gate
   shows your counts when you're short → crown1–4 → on the BUY OUT
   slot, confirm exactly one $40,000 escrow charge (fail crown3 once,
   retry — no second charge), then compare the Bank's business figure
   against the actual morning payout with the dividend live. On the
   EXPOSE slot: editions 1/2/3 land on three consecutive mornings,
   exactly once each, including after a reload mid-series.
2. **Full-garage Sovereign:** fill the garage to 6 stored cars, finish
   crown4, park another car at the villa in the same session, reload —
   the Sovereign must be back (re-delivered) and takeable with G.
   Finish the Crown again after NG+ — no duplicate Sovereign.
3. **Crown2 at high evidence:** build evidence ≥ 75 first, run
   crown2 — wanted sits at the 3★ cap, never above, and the escape
   still completes at wanted 0.
4. **Multiplayer name:** set a display name in Phone → Settings, join
   a room, post a race time — the leaderboard shows the chosen name,
   not "Rayan Kade".
5. **Money spot-checks:** the regatta sub-1:00 purse pays once
   (re-enter the gate — no second purse); the Fixer refuses in cop
   line-of-sight with no charge and charges exactly once when clean;
   a postcard fee pays once per shot even if the shutter is spammed.
6. **Sleep sanity:** sleep after ~19:20 — businesses, rent and loans
   tick exactly once and the day advances by 1.
7. **Districts by car:** drive into Westbrook and Northreach (not just
   walk) — the Phase 31 wall is gone; a car saved inside a district
   restores at its gate while the chunk is unloaded.
8. **Interiors:** the Eastmere Diner at 07:00 (menu, jukebox, Petra
   behind the counter — and only there), locked at midnight with the
   hours on the sign; the Silo Office's harbour log shows your real
   Wire headlines and district standings.
9. **Bikes:** lean on both; motorcycle wheelie (Space + W, or GAS +
   DRIFT on touch) with the loop-out past the balance point; courier
   still delivers on the bicycle — it was never motorcycle-legal.
10. **Business morning:** sleep through days owning businesses — the
    morning message, the Bank badge and the payout agree to the
    dollar, event days included; a supply snag fixed by the run (or
    left to expire) behaves as documented.
11. **Wildlife & postcards:** the pod breaches past the pier and dives
    for a fast boat; fish the Pier while it passes for Elias's bark;
    shoot the Golden Span at ~07:00 or ~18:00 facing the bridge (it
    banks) and again at midday (it doesn't).
12. **Day events:** on a regatta morning, run the buoys and find the
    best time in Phone → Stats → Records; on a market morning, Lina's
    bench shows *and charges* exactly 25% less for the day's deal,
    once; the next morning, stalls, buoys and voucher are gone.
13. **Assists at defaults:** with every assist Off, driving, shooting,
    a storm and the Bank look and play exactly as before. Then: drive
    assist Full (camera eases home after ~2.5 s in a car — and does
    *not* chase the boat or the plane), aim assist against a ped with
    and without a wall between you, colourblind HUD on/off,
    reduced-flash storm.
14. **Low preset on a phone:** Quality → Low — no shadows, native
    resolution, thinner streets; the FPS counter is the verdict. The
    start screen shows title + Play immediately, poster panels fading
    in behind.
15. **Score:** noon is pad-only, the pluck arrives with dusk; 3★
    brings the pulse in, 5★ doubles it; a Sable Tunes track, the club
    or the jukebox silences the score while it plays; N mutes
    everything together.
16. **Credits:** Phone → Settings → About & credits — version reads
    v3.0 — Complete Edition, matching the start screen.

## System notes

- **Web:** `cd client && npm ci && npm run build` → `client/dist`
  (Vercel serves it as a static site; Root Directory = `client`).
  Placement audit from the repo root: `node tools/audit-placements.mjs`
  — prints ALL PLACEMENTS CLEAR.
- **Multiplayer / services server (optional):**
  `python3 -m venv /tmp/hf-venv && /tmp/hf-venv/bin/pip install -r server/requirements.txt`,
  then `cd server && /tmp/hf-venv/bin/python -m uvicorn main:app --port 8765`,
  and run the client with
  `VITE_MULTIPLAYER_SERVER_URL=ws://localhost:8765/ws`. Vercel cannot
  host the WebSocket server persistently — use Render/Railway/Fly or
  your own machine. Tests: `cd server && /tmp/hf-venv/bin/python -m pytest`
  — 48 tests, hermetic.
- **C++ core:** smoke suite builds with any g++ (C++17) — 49/49.
  The WASM build (`scripts/build-physics.sh --deploy`) needs an
  Emscripten environment; without it the TypeScript mirrors are the
  runtime, by design.
- **Desktop:** the Electron shell in `desktop/` wraps the same
  `client/dist` (appId `com.portsable.game`); local installers build
  with `npm run dist:win` / `npm run dist:mac` there. **Caveat:**
  `.github/workflows/desktop-release.yml` exists in the repo for
  automated Windows/macOS release builds, but it could not be pushed
  with the project's GitHub App permissions (Workflows scope, 403) —
  if it is absent from the repo's Actions tab, add the file once via
  the GitHub web UI and the automated .exe/.dmg releases will run.
  The web deploy does not depend on it.
- **Saves** live in `localStorage`, three slots, every key namespaced
  per slot. New Game+ keeps everything you own and restarts the story
  — the per-key decisions are enumerated in `client/src/game/ngplus.ts`.

*Port Sable thanks you for playing. 🚢*
