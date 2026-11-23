// Harborfall — Phase 8 "The 500 Sweep, Round 2": fishing, the Lantern
// Park outdoor gym, NPC-memory watchers (invest hourly tick + reputation
// decay live here; the recognition behaviour itself is in GameSystems),
// the Thread & Tide clothing counter, and Lina's tow work. Prompts
// follow the established chain — Interiors, Interactions, Phase7, then
// this component claims G.promptText only when it is still free.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { G, toast, bark, persistSkills, persistZoneRep } from "../game/store";
import { J, jobStats, persistJobStats } from "../game/jobs";
import { ECO } from "../game/economy";
import { INV, tickInvest, persistInvest } from "../game/invest";
import { postEconomy } from "../game/leaderboard";
import { pushPhoneMsg } from "../game/phone";
import { sfx } from "../game/audio";
import { groundYAt, GARAGE_ZONES } from "../world";
import { gameHour } from "./Interactions";
import {
  F, FISHING_SPOTS, rollCatch, GYM, GYM_STATIONS, persistGym,
  CLOTHING_ITEMS, CLOTHING_SHOP, CLOTH, persistClothing,
} from "../game/phase8";

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export default function Phase8Systems() {
  const myPrompt = useRef("");
  const eDownAt = useRef(-1);
  const eHeld = useRef(false);
  const lastEdge = useRef(-1); // last consumed E-press timestamp
  const armAfter = useRef(0); // E presses before this time are the press that STARTED the activity — ignore them
  const atShop = useRef(false);
  const clothIdx = useRef(0);
  const lastHour = useRef(INV.lastHour);
  const lastSerial = useRef(ECO.daySerial);
  const reelClickAt = useRef(0);
  const splashRef = useRef<THREE.Mesh>(null);
  const bobberRef = useRef<THREE.Mesh>(null);
  const hookLine = useRef<THREE.Line>(null);
  const hookGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, -10, 0)]), []);

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "e" && !e.repeat) { eDownAt.current = performance.now() / 1000; eHeld.current = true; }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "e") {
        // a short tap at the clothing counter = browse to the next piece
        if (atShop.current && eDownAt.current > 0 && performance.now() / 1000 - eDownAt.current < 0.35) {
          clothIdx.current = (clothIdx.current + 1) % CLOTHING_ITEMS.length;
          sfx.click();
        }
        eDownAt.current = -1; eHeld.current = false;
        if (G.hold?.label.startsWith("Buying")) G.hold = null;
      }
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);

  /** True exactly once per physical E press (post-arming). */
  const ePressed = () => {
    if (eDownAt.current > 0 && eDownAt.current !== lastEdge.current && eDownAt.current > armAfter.current) { lastEdge.current = eDownAt.current; return true; }
    return false;
  };

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const px = G.playerPos.x, pz = G.playerPos.z;
    const onFoot = !G.driving && !G.interior && !G.status && !G.dialogueActive;

    // ================= SableBank: hourly repricing =================
    const h = gameHour();
    if (lastHour.current !== h) {
      if (lastHour.current !== -1) tickInvest();
      lastHour.current = h; INV.lastHour = h; persistInvest();
    }
    // ================= daily tick: reputation decays =================
    if (ECO.daySerial !== lastSerial.current) {
      lastSerial.current = ECO.daySerial;
      for (const k of Object.keys(G.zoneRep)) G.zoneRep[k] = Math.floor(G.zoneRep[k] * 0.55);
      persistZoneRep();
      postEconomy(); // Phase 8: daily economy snapshot to the Python service (no-op offline)
    }

    let prompt = ""; let warn = false; let act: (() => void) | null = null;

    // ================= FISHING =================
    const spot = FISHING_SPOTS.find((s) => (px - s.x) ** 2 + (pz - s.z) ** 2 < 3.2 ** 2) ?? null;
    if (F.phase !== "idle") {
      const home = F.spot;
      if (!onFoot || !home || (px - home.x) ** 2 + (pz - home.z) ** 2 > 4.5 ** 2) {
        F.phase = "idle"; F.spot = null; // walked off / got in a car: line's in
      }
    }
    if (F.phase === "idle" && onFoot && spot && !GYM.active) {
      prompt = `E — Cast a line at ${spot.name} (rod's on the house)`;
      act = () => { F.phase = "charge"; F.spot = spot; F.power = 0; F.powerDir = 1; armAfter.current = performance.now() / 1000 + 0.15; sfx.click(); };
    } else if (F.phase === "charge" && F.spot) {
      F.power += F.powerDir * dt * 1.35;
      if (F.power >= 1) { F.power = 1; F.powerDir = -1; }
      if (F.power <= 0) { F.power = 0; F.powerDir = 1; }
      prompt = "E — Release the cast! (green = the sweet spot)";
      if (ePressed()) {
        const sweet = F.power >= 0.55 && F.power <= 0.8 ? 1 : 0.35;
        const reach = 0.3 + F.power * 0.85;
        F.castX = F.spot.x + (F.spot.castX - F.spot.x) * reach;
        F.castZ = F.spot.z + (F.spot.castZ - F.spot.z) * reach;
        F.splashAt = t;
        F.biteAt = t + 2.4 + (1 - sweet) * 4.2 + Math.random() * 1.6;
        F.phase = "wait";
        sfx.castLine(); sfx.splash();
      }
    } else if (F.phase === "wait") {
      prompt = "Watch the bobber…";
      warn = true;
      if (t >= F.biteAt) { F.phase = "bite"; F.biteEnd = t + 1.25; F.splashAt = t; sfx.bite(); }
    } else if (F.phase === "bite") {
      prompt = "!! A BITE — E, set the hook!";
      if (ePressed()) { F.phase = "reel"; F.marker = 0.3; F.progress = 0; sfx.click(); }
      else if (t > F.biteEnd) { F.phase = "idle"; F.spot = null; toast("It slipped the hook — gone. Cast again."); sfx.fail(); }
    } else if (F.phase === "reel" && F.spot) {
      // tension mini: holding E winds the marker up; the fish pulls in
      // pulses. Keep the marker in the green band to make progress;
      // pin it past the top and the line snaps.
      const pull = 0.16 + 0.13 * Math.sin(t * 0.9 + 1.3);
      F.marker += (eHeld.current ? 0.52 * dt : -0.34 * dt) + pull * dt;
      F.marker = Math.max(0, F.marker);
      if (eHeld.current && t - reelClickAt.current > 0.13) { reelClickAt.current = t; sfx.reel(); }
      if (F.marker > 1) {
        F.phase = "idle"; F.spot = null; sfx.snap(); toast("SNAP — the line's gone. Too much tension.");
      } else {
        if (F.marker >= 0.35 && F.marker <= 0.75) F.progress += dt * 0.16;
        else F.progress = Math.max(0, F.progress - dt * 0.05);
        prompt = F.marker > 0.75 ? "Ease off — she's running!" : F.marker < 0.35 ? "Wind! Hold E — keep the line tight" : "Steady… keep her in the green";
        warn = F.marker > 0.75;
        if (F.progress >= 1) {
          const caught = rollCatch(F.spot, gameHour());
          F.creel.push(caught);
          jobStats.fishCaught += 1;
          if (!jobStats.bestFish || caught.cm > jobStats.bestFish.cm) {
            jobStats.bestFish = { name: caught.name, cm: caught.cm };
            toast(`🎣 NEW BEST — ${caught.name}, ${caught.cm} cm! (Worth $${caught.value} at Harbour Wraps)`);
          } else toast(`🎣 Caught a ${caught.name} — ${caught.cm} cm, worth $${caught.value}. Sell the creel at Harbour Wraps.`);
          persistJobStats();
          sfx.catchFish();
          bark("Old Elias", "Ha! The harbour provides — if you know where to stand.");
          F.phase = "idle"; F.spot = null;
        }
      }
    }
    // fishing visuals: splash ring + bobber at the cast point
    if (splashRef.current) {
      const age = t - F.splashAt;
      const show = (F.phase === "wait" || F.phase === "bite" || F.phase === "reel") && age < 6;
      splashRef.current.visible = show || age < 1.2;
      if (splashRef.current.visible) {
        splashRef.current.position.set(F.castX, 0.07, F.castZ);
        const sc = 0.6 + (age % 1.4) * 0.9;
        splashRef.current.scale.set(sc, sc, sc);
        (splashRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.5 - (age % 1.4) * 0.32);
      }
    }
    if (bobberRef.current) {
      const show = F.phase === "wait" || F.phase === "bite" || F.phase === "reel";
      bobberRef.current.visible = show;
      if (show) bobberRef.current.position.set(F.castX, 0.1 + Math.sin(t * 2.2) * 0.04 - (F.phase === "bite" ? 0.09 : 0), F.castZ);
    }

    // ================= GYM (Lantern Park outdoor corner) =================
    const station = GYM_STATIONS.find((s) => (px - s.x) ** 2 + (pz - s.z) ** 2 < 2.6 ** 2) ?? null;
    if (GYM.active) {
      const st = GYM.active;
      if (!onFoot || (px - st.x) ** 2 + (pz - st.z) ** 2 > 3.4 ** 2) {
        GYM.active = null;
        toast("Session cut — no refund. The park gym keeps your ten bucks.");
      } else {
        GYM.marker += GYM.dir * dt * 1.15;
        if (GYM.marker >= 1) { GYM.marker = 1; GYM.dir = -1; }
        if (GYM.marker <= 0) { GYM.marker = 0; GYM.dir = 1; }
        prompt = `${st.name} — tap E in the green! (${GYM.hits}/${GYM.need})`;
        if (ePressed()) {
          if (Math.abs(GYM.marker - GYM.zoneAt) <= 0.11) {
            GYM.hits += 1; GYM.zoneAt = 0.3 + Math.random() * 0.45; sfx.click();
            if (GYM.hits >= GYM.need) {
              GYM.lastDay[st.id] = ECO.daySerial; persistGym();
              const before = G.skills[st.skill];
              G.skills[st.skill] = Math.min(100, G.skills[st.skill] + st.gain);
              const other = st.skill === "strength" ? "stamina" : "strength";
              G.skills[other] = Math.min(100, G.skills[other] + st.otherGain);
              persistSkills();
              G.stamina = Math.min(100, G.stamina + 25);
              toast(`💪 Session done — ${st.skill === "strength" ? "Strength" : "Stamina"} ${Math.floor(before)} → ${Math.floor(G.skills[st.skill])}. ${G.skills[st.skill] >= 50 && before < 50 ? (st.skill === "strength" ? "PERK: fists & the bat put peds down longer." : "PERK: stamina pool effectively +25%.") : "Same time tomorrow."}`);
              sfx.complete();
              GYM.active = null;
            }
          } else { sfx.dryFire(); bark("Park trainer", "Timing! Watch the marker, hit the green."); }
        }
      }
    } else if (!prompt && onFoot && station && F.phase === "idle") {
      if (GYM.lastDay[station.id] === ECO.daySerial) { prompt = `${station.name} — done for today. Muscles grow overnight.`; warn = true; }
      else {
        prompt = `E — ${station.name} session ($10) · +${station.gain} ${station.skill === "strength" ? "Strength" : "Stamina"} · once a day`;
        act = () => {
          if (G.cash < 10) { toast("The park gym is $10 a session — you're short."); return; }
          G.cash -= 10;
          GYM.active = station; GYM.hits = 0; GYM.marker = 0; GYM.dir = 1; GYM.zoneAt = 0.3 + Math.random() * 0.45;
          armAfter.current = performance.now() / 1000 + 0.15;
          sfx.click();
        };
      }
    }

    // ================= THREAD & TIDE (clothing counter) =================
    atShop.current = onFoot && (px - CLOTHING_SHOP.x) ** 2 + (pz - CLOTHING_SHOP.z) ** 2 < 2.8 ** 2 && F.phase === "idle" && !GYM.active;
    if (atShop.current && !prompt) {
      const item = CLOTHING_ITEMS[clothIdx.current];
      const wearing = CLOTH.current?.id === item.id;
      prompt = wearing
        ? `Thread & Tide — you're wearing the ${item.label} (tap E browse)`
        : `E — Thread & Tide: ${item.label} $${item.price} (tap E browse · hold E buy)`;
      // hold E (0.9 s) buys, mirroring the gun/dealer counters
      if (!wearing && eDownAt.current > 0 && eHeld.current) {
        const progress = (performance.now() / 1000 - eDownAt.current) / 0.9;
        G.hold = { label: `Buying ${item.label} — $${item.price}…`, progress: Math.min(1, progress) };
        if (progress >= 1) {
          eDownAt.current = -1; G.hold = null;
          if (G.cash < item.price) { toast(`${item.label} is $${item.price} — not enough cash.`); sfx.dryFire(); }
          else {
            G.cash -= item.price;
            CLOTH.current = item; persistClothing();
            toast(`🧥 ${item.label} — yours. It overrides your character-select outfit until you change character or variant there.`);
            sfx.register();
          }
        }
      } else if (G.hold?.label.startsWith("Buying")) G.hold = null;
    }

    // ================= TOW WORK =================
    const myCar = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId] : null;
    if (J.wantTow) {
      J.wantTow = false;
      if (J.towPhase === "idle" && J.taxiPhase === "idle" && J.delPhase === "idle" && !J.race) {
        const eligible = G.cars
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => !c.owned && !c.storedAway && !["boat", "bicycle", "bus", "tow"].includes(c.kind))
          .filter(({ c }) => (c.state.x - px) ** 2 + (c.state.z - pz) ** 2 > 35 ** 2)
          .sort((a, b) => ((a.c.state.x - px) ** 2 + (a.c.state.z - pz) ** 2) - ((b.c.state.x - px) ** 2 + (b.c.state.z - pz) ** 2));
        const target = eligible[Math.min(eligible.length - 1, 2)] ?? eligible[0];
        if (target) {
          J.towCarId = target.i; J.towPhase = "pickup"; J.towHooked = false; J.towStillT = 0;
          pushPhoneMsg("Lina Park", `🪝 Tow job: a ${target.c.model} died on its owner. Amber marker's on it — back the wrecker up to its nose, stop, and the hook sets itself. Bring it to my yard.`);
          toast("🪝 Tow shift started — amber marker on the breakdown. The Sable Wrecker is parked at Lina's.");
        } else toast("No breakdowns on the board right now — try again in a bit.");
      } else toast("Finish what you're running first — then we'll talk towing.");
    }
    const towTargetCar = J.towCarId >= 0 ? G.cars[J.towCarId] : null;
    if (J.towPhase === "pickup" && towTargetCar) {
      if (myCar && myCar.kind === "tow") {
        const rearX = myCar.state.x - Math.sin(myCar.state.heading) * 2.6;
        const rearZ = myCar.state.z - Math.cos(myCar.state.heading) * 2.6;
        const d2 = (rearX - towTargetCar.state.x) ** 2 + (rearZ - towTargetCar.state.z) ** 2;
        if (d2 < 3.6 ** 2 && Math.abs(myCar.state.speed) < 0.8) {
          J.towStillT += dt;
          prompt = "Hold still — setting the hook…";
          if (J.towStillT > 0.7) {
            J.towHooked = true; J.towPhase = "deliver"; J.towSwing = towTargetCar.state.heading; J.towStillT = 0;
            sfx.register(); toast("🪝 Hooked! Haul it to Lina's yard — gently: a towed car swings, and towing halves your acceleration.");
          }
        } else {
          J.towStillT = 0;
          if (d2 < 12 ** 2) { prompt = "Reverse the wrecker's bed up to the broken-down car and stop"; warn = true; }
        }
      }
    }
    if (J.towPhase === "deliver" && towTargetCar) {
      if (J.towHooked) {
        if (myCar && myCar.kind === "tow") {
          // physics-lite tether: the towed car hangs 4.9u behind the
          // wrecker's heading on a swing angle that lags turns (spring),
          // so it pendulums gently through corners instead of tracking
          // like a trailer on rails.
          const diff = wrapAngle(myCar.state.heading - J.towSwing);
          J.towSwing += diff * Math.min(1, dt * 3.1);
          const rearX = myCar.state.x - Math.sin(myCar.state.heading) * 2.3;
          const rearZ = myCar.state.z - Math.cos(myCar.state.heading) * 2.3;
          towTargetCar.state.x = rearX - Math.sin(J.towSwing) * 2.9;
          towTargetCar.state.z = rearZ - Math.cos(J.towSwing) * 2.9;
          towTargetCar.state.heading = J.towSwing;
          towTargetCar.state.speed = 0;
          // delivery: the wrecker rolls into Lina's yard with the car on
          const lina = GARAGE_ZONES[1];
          if ((myCar.state.x - lina.x) ** 2 + (myCar.state.z - lina.z) ** 2 < lina.r * lina.r) {
            const pay = 150;
            G.cash += pay; G.lifetimeEarned += pay;
            jobStats.towDeliveries += 1; jobStats.towEarned += pay; persistJobStats();
            pushPhoneMsg("Lina Park", `🪝 Wrecker job done — $${pay}. Owner's been called; the ${towTargetCar.model} is on my lift list.`);
            toast(`🪝 Delivered! +$${pay} — Lina's tow board is clear.`);
            sfx.cash();
            J.towPhase = "idle"; J.towCarId = -1; J.towHooked = false;
          }
        } else {
          // stepped out of the wrecker: the hook drops, car stays put
          J.towHooked = false; J.towPhase = "pickup"; J.towStillT = 0;
          toast("Hook dropped — the car stays where it lies. Get back in the wrecker to re-hook.");
        }
      }
    }
    // tow hook cable visual
    if (hookLine.current) {
      const show = J.towHooked && towTargetCar && myCar;
      hookLine.current.visible = !!show;
      if (show && myCar && towTargetCar) {
        const pos = hookGeo.getAttribute("position") as THREE.BufferAttribute;
        pos.setXYZ(0, myCar.state.x - Math.sin(myCar.state.heading) * 2.3, 0.7, myCar.state.z - Math.cos(myCar.state.heading) * 2.3);
        pos.setXYZ(1, towTargetCar.state.x + Math.sin(towTargetCar.state.heading) * 1.8, 0.6, towTargetCar.state.z + Math.cos(towTargetCar.state.heading) * 1.8);
        pos.needsUpdate = true;
      }
    }

    // ---- claim the prompt last, per the chain ----
    if (!G.promptText || G.promptText === myPrompt.current) {
      G.promptText = prompt; G.promptWarn = warn; G.interact = act;
      myPrompt.current = prompt;
    } else if (myPrompt.current) {
      myPrompt.current = G.promptText === myPrompt.current ? myPrompt.current : "";
    }
  });

  const rodAt = (s: (typeof FISHING_SPOTS)[number]) => (
    <group key={s.name} position={[s.x, groundYAt(s.x, s.z), s.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.85, 1.05, 24]} />
        <meshBasicMaterial color="#ffb340" transparent opacity={0.65} />
      </mesh>
      {/* a leaning rod + bucket: the spot reads before the prompt does */}
      <mesh position={[0.5, 0.75, 0.2]} rotation={[0, 0, 0.7]} castShadow>
        <cylinderGeometry args={[0.02, 0.03, 1.7, 6]} />
        <meshStandardMaterial color="#3a2c1c" roughness={0.7} />
      </mesh>
      <mesh position={[-0.45, 0.22, 0.1]} castShadow>
        <cylinderGeometry args={[0.24, 0.19, 0.42, 10]} />
        <meshStandardMaterial color="#7a8894" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );

  return (
    <group>
      {FISHING_SPOTS.map(rodAt)}
      {/* splash ring at the cast point */}
      <mesh ref={splashRef} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.72, 20]} />
        <meshBasicMaterial color="#dff2f5" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      {/* bobber */}
      <mesh ref={bobberRef} visible={false}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshStandardMaterial color="#c22e2e" roughness={0.4} />
      </mesh>

      {/* ---- Lantern Park outdoor gym corner ---- */}
      <group position={[GYM_STATIONS[0].x, groundYAt(GYM_STATIONS[0].x, GYM_STATIONS[0].z), GYM_STATIONS[0].z]}>
        <mesh position={[0, 0.28, 0]} castShadow><boxGeometry args={[1.9, 0.16, 0.55]} /><meshStandardMaterial color="#274036" roughness={0.8} /></mesh>
        <mesh position={[-0.85, 0.35, 0]}><boxGeometry args={[0.09, 0.7, 0.5]} /><meshStandardMaterial color="#39424e" metalness={0.5} roughness={0.5} /></mesh>
        <mesh position={[0.85, 0.35, 0]}><boxGeometry args={[0.09, 0.7, 0.5]} /><meshStandardMaterial color="#39424e" metalness={0.5} roughness={0.5} /></mesh>
        <mesh position={[0, 0.72, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.03, 0.03, 2, 8]} /><meshStandardMaterial color="#c8ccd2" metalness={0.8} roughness={0.3} /></mesh>
        <mesh position={[-1.06, 0.72, 0]}><cylinderGeometry args={[0.21, 0.21, 0.07, 12]} /><meshStandardMaterial color="#22262b" roughness={0.6} /></mesh>
        <mesh position={[1.06, 0.72, 0]}><cylinderGeometry args={[0.21, 0.21, 0.07, 12]} /><meshStandardMaterial color="#22262b" roughness={0.6} /></mesh>
      </group>
      <group position={[GYM_STATIONS[1].x, groundYAt(GYM_STATIONS[1].x, GYM_STATIONS[1].z), GYM_STATIONS[1].z]}>
        <mesh position={[0, 0.16, 0]} rotation={[0.1, 0, 0]} castShadow><boxGeometry args={[0.85, 0.14, 2.3]} /><meshStandardMaterial color="#22262b" roughness={0.85} /></mesh>
        <mesh position={[0, 0.55, 1.15]}><boxGeometry args={[0.8, 0.75, 0.12]} /><meshStandardMaterial color="#39424e" metalness={0.5} roughness={0.5} /></mesh>
        <mesh position={[0, 0.95, 1.18]}><boxGeometry args={[0.5, 0.3, 0.05]} /><meshStandardMaterial color="#14181d" roughness={0.3} /></mesh>
      </group>
      {/* rubber mat under the gym corner */}
      <mesh position={[72.7, groundYAt(72.7, -64.5) + 0.02, -64.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[9.5, 4.6]} />
        <meshStandardMaterial color="#23272c" roughness={0.95} />
      </mesh>

      {/* ---- Thread & Tide clothing rack, Market Row ---- */}
      <group position={[CLOTHING_SHOP.x, groundYAt(CLOTHING_SHOP.x, CLOTHING_SHOP.z), CLOTHING_SHOP.z]}>
        <mesh position={[-1.1, 0.8, 0]} castShadow><boxGeometry args={[0.08, 1.6, 0.08]} /><meshStandardMaterial color="#39424e" metalness={0.5} roughness={0.5} /></mesh>
        <mesh position={[1.1, 0.8, 0]} castShadow><boxGeometry args={[0.08, 1.6, 0.08]} /><meshStandardMaterial color="#39424e" metalness={0.5} roughness={0.5} /></mesh>
        <mesh position={[0, 1.58, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.03, 0.03, 2.3, 8]} /><meshStandardMaterial color="#c8ccd2" metalness={0.8} roughness={0.3} /></mesh>
        {CLOTHING_ITEMS.slice(0, 4).map((it, i) => (
          <mesh key={it.id} position={[-0.82 + i * 0.55, 1.22, 0]} castShadow>
            <boxGeometry args={[0.42, 0.62, 0.1]} />
            <meshStandardMaterial color={it.top} roughness={0.85} />
          </mesh>
        ))}
        <mesh position={[0, 2.05, 0]} castShadow><boxGeometry args={[2.7, 0.5, 0.08]} /><meshStandardMaterial color="#17303a" roughness={0.6} /></mesh>
        <mesh position={[0, 2.05, 0.05]}><planeGeometry args={[2.5, 0.34]} /><meshBasicMaterial color="#ffb340" /></mesh>
      </group>

      {/* tow hook cable */}
      {/* @ts-expect-error R3F line element */}
      <line ref={hookLine} geometry={hookGeo} visible={false}>
        <lineBasicMaterial color="#c8ccd2" transparent opacity={0.8} />
      </line>
    </group>
  );
}
