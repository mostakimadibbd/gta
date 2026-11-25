// Harborfall — Phase 17 world events: STREET CHALLENGE + SPILLED CARGO.
//
// Two additions to the ambient world, run on their OWN scheduler that
// honours the existing event contract: GameSystems' B2 events and
// Phase 7's ambulance rush both key off G.eventNow, and this
// component never starts while G.eventNow is set, a mission or race
// is live, or the player is in a status screen — and it SETS
// G.eventNow while live, so the older systems return the courtesy.
// The Phase 16 density levers cannot break these spawns: the
// challenger, his car and the crates are fixed meshes owned here,
// never drawn from the ambient traffic/ped pools.
//
// STREET CHALLENGE: an exotic idles at a wide-road spot, driver
// leaning on the door. Drive up and accept (E) and the $200 stake
// leaves your pocket and the game's real race state (game/jobs.ts
// J.race, driven by Phase7) runs a one-rival point-to-point —
// winner takes the $400 pot, loser gets nothing.
// SPILLED CARGO: five crates off a truck at a road spot for ~60 s.
// Walk over them for small cash or stash loot while live traffic
// swerves around the point (GameSystems reads G.eventNow).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { G, toast, bark, persistInventory } from "../game/store";
import { M } from "../game/missionState";
import { J, type RaceDef } from "../game/jobs";
import { DERBY, openDerby, enterDerby, settleDerby, DERBY_PIER, DERBY_DURATION_S, DERBY_PRIZE } from "../game/derby";
import { pushPhoneMsg } from "../game/phone";
import { sfx } from "../game/audio";
import { groundYAt } from "../world";
import { buildHumanoid, animateHumanoid } from "../humanoid";
import CarBody from "./CarBody";

const CHALLENGE_SPOTS: { x: number; z: number; heading: number }[] = [
  { x: 100, z: -56, heading: Math.PI },        // East Yards straight
  { x: -96, z: 100, heading: Math.PI / 2 },    // north beach road
  { x: 76, z: 264, heading: -Math.PI / 2 },    // Coral Shores shore road
];
const CHALLENGE_DESTS: [number, number][] = [[-100, -60], [20, 100], [100, 100], [-60, -100], [60, -140]];
const CARGO_SPOTS: [number, number][] = [[20, 20], [-40, -40], [60, 64], [4, -100], [-100, 20]];
const CRATE_OFFS: [number, number][] = [[0, 0], [2.6, 1.4], [-2.2, 2.4], [1.2, -2.6], [-3.1, -1.2]];
const LOOT: { type: string; name: string; value: number }[] = [
  { type: "contraband", name: "Unmarked electronics", value: 60 },
  { type: "contraband", name: "Harbour-bond whisky case", value: 85 },
  { type: "part", name: "Salvaged turbocharger", value: 110 },
];

type Ev =
  | { kind: "challenge"; spot: number; until: number; barked: boolean }
  | { kind: "cargo"; spot: number; taken: boolean[]; until: number }
  // Phase 24: the FISHING DERBY — the window/scoring state lives in
  // game/derby.ts; this event only holds the slot + the clock.
  | { kind: "derby"; until: number };

export default function Phase17Systems() {
  const ev = useRef<Ev | null>(null);
  const nextAt = useRef(50);
  const mine = useRef("");
  const carRef = useRef<THREE.Group>(null);
  const driverRef = useRef<THREE.Group>(null);
  const derbyRingRef = useRef<THREE.Group>(null);
  const crateRefs = useRef<Array<THREE.Group | null>>([]);
  const driverRig = useMemo(() => buildHumanoid({ top: "#7a1f2b", bottom: "#23272e", skin: "#8d5524", hair: "#14100e", topStyle: "jacket", gender: "m", hairStyle: "flat", sunglasses: true }), []);
  const driverPhase = useRef(0);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const claim = (text: string, act: (() => void) | null, warn = false) => {
      if (!G.promptText || G.promptText === mine.current) {
        G.promptText = text; G.promptWarn = warn; G.interact = act;
        mine.current = text;
      }
    };
    const release = () => {
      if (mine.current && G.promptText === mine.current) { G.promptText = ""; G.interact = null; }
      mine.current = "";
    };
    const endEvent = (gap: number) => {
      if (G.eventNow && (G.eventNow.kind === "challenge" || G.eventNow.kind === "cargo" || G.eventNow.kind === "derby")) G.eventNow = null;
      ev.current = null;
      nextAt.current = t + gap;
      release();
    };

    // ---------------- scheduler ----------------
    if (!ev.current) {
      if (carRef.current) carRef.current.visible = false;
      if (driverRef.current) driverRef.current.visible = false;
      if (derbyRingRef.current) derbyRingRef.current.visible = false;
      crateRefs.current.forEach((g) => { if (g) g.visible = false; });
      // Phase 18 audit: also stand off for a live dispatch incident —
      // a crate spill or a pot race on top of an ambulance call at the
      // same junction read as chaos, not life
      if (t > nextAt.current && !M.active && !J.race && !G.status && !G.eventNow && !G.dialogueActive && !G.incident) {
        const roll = Math.random();
        if (roll < 0.4) {
          const spot = Math.floor(Math.random() * CHALLENGE_SPOTS.length);
          ev.current = { kind: "challenge", spot, until: t + 75, barked: false };
          const s = CHALLENGE_SPOTS[spot];
          G.eventNow = { kind: "challenge", x: s.x, z: s.z };
        } else if (roll < 0.72) {
          const spot = Math.floor(Math.random() * CARGO_SPOTS.length);
          ev.current = { kind: "cargo", spot, taken: [false, false, false, false, false], until: t + 60 };
          const [x, z] = CARGO_SPOTS[spot];
          G.eventNow = { kind: "cargo", x, z };
          if (Math.hypot(G.playerPos.x - x, G.playerPos.z - z) < 60) bark("Trucker (CB)", "— lost half my load back there, crates all over the road —");
        } else {
          // Phase 24: the FISHING DERBY joins the rotation on the
          // same courtesy — it holds G.eventNow for its 3 minutes
          // and the scoring state lives in game/derby.ts.
          openDerby();
          ev.current = { kind: "derby", until: t + DERBY_DURATION_S };
          G.eventNow = { kind: "derby", x: DERBY_PIER.x, z: DERBY_PIER.z };
          pushPhoneMsg("Harbourmaster", `🎣 FISHING DERBY at the Pier — 3 minutes on the clock. Enter at the pier ring (free), then every catch scores its value, shore or boat. Beat the house $${DERBY.house} and the $${DERBY_PRIZE} purse is yours.`);
        }
      }
      return;
    }

    const e = ev.current;
    if (t > e.until) {
      if (e.kind === "derby") settleDerby(); // the whistle — settles exactly once (game/derby.ts)
      endEvent(70 + Math.random() * 50); return;
    }

    // ---------------- FISHING DERBY (Phase 24) ----------------
    if (e.kind === "derby") {
      // stood down externally (New Game+): free the slot WITHOUT
      // settling — standDownDerby already closed the books.
      if (!DERBY.open) { endEvent(45); return; }
      if (derbyRingRef.current) {
        derbyRingRef.current.visible = true;
        derbyRingRef.current.position.set(DERBY_PIER.x, groundYAt(DERBY_PIER.x, DERBY_PIER.z) + 0.05, DERBY_PIER.z);
      }
      const d = Math.hypot(G.playerPos.x - DERBY_PIER.x, G.playerPos.z - DERBY_PIER.z);
      const left = Math.max(0, Math.ceil(e.until - t));
      const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
      if (!DERBY.entered && !G.driving && !G.status && d < 3.4) {
        claim(`E — Enter the Fishing Derby (free — ${clock} left; every catch scores its value vs the house $${DERBY.house})`, () => enterDerby());
      } else if (DERBY.entered && d < 6) {
        claim(`🎣 Derby — you $${DERBY.score} · house $${DERBY.house} · ${clock} left (fish anywhere — pier or boat)`, null, true);
      } else release();
      return;
    }

    // ---------------- STREET CHALLENGE ----------------
    if (e.kind === "challenge") {
      const s = CHALLENGE_SPOTS[e.spot];
      if (carRef.current) { carRef.current.visible = true; carRef.current.position.set(s.x, groundYAt(s.x, s.z), s.z); carRef.current.rotation.y = s.heading; }
      if (driverRef.current) {
        driverRef.current.visible = true;
        const dx = s.x + Math.sin(s.heading + Math.PI / 2) * 1.6, dz = s.z + Math.cos(s.heading + Math.PI / 2) * 1.6;
        driverRef.current.position.set(dx, groundYAt(dx, dz), dz);
        driverRef.current.rotation.y = Math.atan2(G.playerPos.x - dx, G.playerPos.z - dz);
        driverPhase.current += 1 / 60;
        animateHumanoid(driverRig, driverPhase.current * 2, 0.06, t);
      }
      const d = Math.hypot(G.playerPos.x - s.x, G.playerPos.z - s.z);
      if (!e.barked && d < 26) { e.barked = true; bark("Challenger", "Two hundred says my Vantara eats whatever you're driving. Pull up if you're serious."); }
      if (G.driving && d < 9.5 && !J.race && !M.active) {
        claim("E — Street Challenge: $200 stake, winner takes the $400 pot (drive away to decline)", () => {
          if (G.cash < 200) { toast("The challenger laughs — the stake is $200 and you don't have it."); sfx.dryFire(); return; }
          // a destination at least ~120u away, so the run is a race
          const dests = CHALLENGE_DESTS.filter(([x, z]) => Math.hypot(x - s.x, z - s.z) > 120);
          const dest = dests[Math.floor(Math.random() * dests.length)] ?? CHALLENGE_DESTS[0];
          const def: RaceDef = { id: "challenge", name: "Street Challenge", blurb: "An impromptu kerbside pot race.", start: [s.x, s.z], cps: [dest], challenge: true };
          const dirA = Math.atan2(dest[0] - s.x, dest[1] - s.z);
          G.cash -= 200; sfx.cash();
          J.race = {
            def, phase: "countdown", goAt: t + 3, startedAt: 0, cp: 0, bet: 0, playerDoneAt: 0,
            // (the race system's rival renderer supports the three
            // street kinds — the rival runs as the supercar class in
            // the challenger's amber; his parked show car is the hyper)
            opps: [{ x: s.x, z: s.z, heading: dirA, cp: 0, speed: 0, skill: 1.03, finishedAt: 0, color: "#d99a3d", kind: "supercar" }],
          };
          bark("Challenger", "Pot's $400. First to the mark takes it. On the count — don't embarrass that car.");
          endEvent(80 + Math.random() * 40);
        }, true);
        return;
      }
      release();
      return;
    }

    // ---------------- SPILLED CARGO ----------------
    const [cx, cz] = CARGO_SPOTS[e.spot];
    crateRefs.current.forEach((g, i) => {
      if (!g) return;
      const [ox, oz] = CRATE_OFFS[i];
      g.visible = !e.taken[i];
      g.position.set(cx + ox, groundYAt(cx + ox, cz + oz) + 0.32, cz + oz);
      g.rotation.y = i * 1.13;
    });
    if (!G.driving && !G.status) {
      for (let i = 0; i < CRATE_OFFS.length; i++) {
        if (e.taken[i]) continue;
        const [ox, oz] = CRATE_OFFS[i];
        if (Math.hypot(G.playerPos.x - (cx + ox), G.playerPos.z - (cz + oz)) < 2.2) {
          e.taken[i] = true;
          if (Math.random() < 0.32) {
            const item = LOOT[Math.floor(Math.random() * LOOT.length)];
            G.inventory.push({ ...item }); persistInventory();
            toast(`📦 Spilled cargo: ${item.name} — fence it at the pawn shop.`);
          } else {
            const cash = 15 + Math.floor(Math.random() * 26);
            G.cash += cash; G.lifetimeEarned += cash;
            toast(`📦 Spilled cargo: $${cash} in loose notes.`);
          }
          sfx.pickup();
          if (e.taken.every(Boolean)) { toast("That's the whole spill cleared — the trucker owes the road a thank-you."); endEvent(70 + Math.random() * 50); }
          break;
        }
      }
    }
  });

  return (
    <group>
      {/* the challenger's exotic + the challenger */}
      <group ref={carRef} visible={false}>
        <CarBody kind="hyper" color="#d99a3d" />
      </group>
      <group ref={driverRef} visible={false}>
        <primitive object={driverRig.group} />
      </group>
      {/* Phase 24: the derby entry ring at the pier fishing spot */}
      <group ref={derbyRingRef} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.5, 3.1, 28]} />
          <meshBasicMaterial color="#ffb340" transparent opacity={0.7} />
        </mesh>
      </group>
      {/* spilled crates (timber boxes with a dark strap — the same
          destruct/debris material language as the world's crates) */}
      {CRATE_OFFS.map((_, i) => (
        <group key={i} ref={(n) => { crateRefs.current[i] = n; }} visible={false}>
          <mesh><boxGeometry args={[0.85, 0.62, 0.85]} /><meshStandardMaterial color="#9a6b3f" roughness={0.95} /></mesh>
          <mesh position={[0, 0.05, 0]}><boxGeometry args={[0.88, 0.1, 0.88]} /><meshStandardMaterial color="#4a4238" roughness={1} /></mesh>
        </group>
      ))}
    </group>
  );
}
