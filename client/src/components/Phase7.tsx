// Harborfall — Phase 7 "The 500 Sweep, Round 1": jobs (taxi + delivery),
// street races, the economy prompts (businesses / apartment / sleep),
// the world sweep (toll, speed cameras, destructibles, benches, fish,
// wind-driven life) and the emergency-services layer (parked units +
// the rushing-ambulance event). Prompts follow the established chain:
// Interiors writes first, Interactions second, this component last —
// it only claims G.promptText when the others left it free.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { G, toast, bark, addCrime, nowS } from "../game/store";
import { M } from "../game/missionState";
import { pushPhoneMsg } from "../game/phone";
import { sfx } from "../game/audio";
import {
  J, HAIL_POINTS, DEST_POINTS, PICKUP_POINTS, RACES, RACE_PRIZES,
  jobStats, persistJobStats, jobTarget, fmtTime, jobBusy, drivingKind, type RaceDef, type Poi,
} from "../game/jobs";
import { BUSINESSES, APARTMENT, ECO, advanceDay, sleepToMorning, setHomePref, persistEco } from "../game/economy";
import { pushNews, rollSocialPost, socialCrimePost } from "../game/feed";
import { nudgeStock } from "../game/invest";
import { postRaceResult } from "../game/leaderboard";
import { loadDaySet, saveDaySet, DESTRUCT_KEY } from "../game/phase9";
import { fallbackPhysics } from "../physics/GamePhysics";
import {
  TOLL, SPEED_CAMERAS, SPEED_LIMIT_U, DESTRUCTIBLES,
  APARTMENT_DOOR, MANSION, groundYAt, districtAt, props,
} from "../world";
import CarBody from "./CarBody";
import { buildHumanoid, animateHumanoid } from "../humanoid";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const BENCHES = props.filter((p) => p.kind === "bench");
const DROPS: Poi[] = [...PICKUP_POINTS.slice(1), DEST_POINTS[0], DEST_POINTS[8], DEST_POINTS[4], DEST_POINTS[11]];

interface Debris { active: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; rx: number; rz: number; life: number; color: string; }
const FISH_SPOTS: [number, number][] = [[6, 124], [-10, 126], [14, 118], [-52, 156], [-76, 178], [70, 192], [88, 196], [-64, 150], [30, 132]];

export default function Phase7Systems() {
  // ---------- taxi hail ped ----------
  const hailRig = useMemo(() => buildHumanoid({ top: "#d99a3d", bottom: "#2b3440", skin: "#e0ac69", hair: "#20242a", topStyle: "hoodie", gender: "f", hairStyle: "ponytail" }), []);
  const hailRef = useRef<THREE.Group>(null);
  // ---------- races ----------
  const oppRefs = useRef<Array<THREE.Group | null>>([]);
  // ---------- destructibles + debris ----------
  const destRefs = useRef<Array<THREE.Group | null>>([]);
  // Phase 9: the broken set persists across reloads within the game-day
  const broken = useRef<Set<number>>(new Set(loadDaySet(DESTRUCT_KEY)));
  const debris = useRef<Debris[]>(Array.from({ length: 36 }, () => ({ active: false, x: 0, y: -20, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, rz: 0, life: 0, color: "#a3764f" })));
  const debrisRefs = useRef<Array<THREE.Mesh | null>>([]);
  const debrisCursor = useRef(0);
  // ---------- fish ----------
  const fishRefs = useRef<Array<THREE.Group | null>>([]);
  // ---------- toll ----------
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const toll = useRef({ lastCharge: -9, brokenUntil: -9, armOpen: 0 });
  // ---------- speed cameras ----------
  const camCd = useRef<number[]>(SPEED_CAMERAS.map(() => -9));
  const camGlobal = useRef(-9);
  // ---------- ambulance rush event ----------
  const rush = useRef({ active: false, x: 112, nextAt: 80, stopAt: -9 });
  const rushRef = useRef<THREE.Group>(null);
  const rushLightA = useRef<THREE.Mesh>(null);
  const rushLightB = useRef<THREE.Mesh>(null);
  // ---------- watchers / timers ----------
  const prevDay = useRef(G.dayTime);
  const prevWanted = useRef(0);
  const prevWeather = useRef(G.weather);
  const socialAt = useRef(45);
  const crimePosted = useRef(false);
  const exitT = useRef(-1);
  const myPrompt = useRef("");
  const eDownAt = useRef(-1);
  const buyRef = useRef<{ label: string; run: () => void } | null>(null);
  const markerRef = useRef<THREE.Mesh>(null);
  const countStage = useRef(-1);
  const raceOutAt = useRef(-1); // race abort timer (out of car)

  useEffect(() => {
    const dn = (e: KeyboardEvent) => { if (e.key.toLowerCase() === "e" && !e.repeat) eDownAt.current = performance.now() / 1000; };
    const up = (e: KeyboardEvent) => { if (e.key.toLowerCase() === "e") eDownAt.current = -1; };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);

  const spawnDebris = (x: number, y: number, z: number, color: string, n = 6) => {
    for (let k = 0; k < n; k++) {
      const idx = debrisCursor.current;
      debrisCursor.current = (debrisCursor.current + 1) % debris.current.length;
      const d = debris.current[idx];
      d.active = true; d.x = x + rand(-0.4, 0.4); d.y = y + rand(0.1, 0.7); d.z = z + rand(-0.4, 0.4);
      d.vx = rand(-3.4, 3.4); d.vy = rand(2.5, 6); d.vz = rand(-3.4, 3.4);
      d.rx = rand(0, 3); d.rz = rand(0, 3); d.life = 2.2; d.color = color;
      const m = debrisRefs.current[idx];
      if (m) (m.material as THREE.MeshStandardMaterial).color.set(color);
    }
  };

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const px = G.playerPos.x, pz = G.playerPos.z;
    const car = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId] : null;
    const speed = car ? Math.abs(car.state.speed) : 0;
    if (G.driving && G.sitting) { G.sitting = false; G.sitSpot = null; } // never sit-drive

    // ================= daily tick (06:00 wrap) =================
    if (G.dayTime < prevDay.current - 0.5) {
      advanceDay();
      broken.current.clear(); // destructibles are repaired overnight
      saveDaySet(DESTRUCT_KEY, []);
      destRefs.current.forEach((g) => { if (g) g.visible = true; });
    }
    prevDay.current = G.dayTime;

    // ================= TAXI JOBS =================
    if (hailRef.current) {
      const show = J.taxiPhase === "pickup" && J.fare !== null;
      hailRef.current.visible = !!show;
      if (show && J.fare) {
        hailRef.current.position.set(J.fare.x, groundYAt(J.fare.x, J.fare.z), J.fare.z);
        hailRig.group.position.set(0, 0, 0);
        animateHumanoid(hailRig, t * 1.2, 0.05, t);
        hailRig.rArm.rotation.x = -2.7 + Math.sin(t * 6) * 0.35; // hailing wave
        hailRig.rArm.rotation.z = -0.3;
        hailRef.current.rotation.y = Math.atan2(px - J.fare.x, pz - J.fare.z);
      }
    }
    if (J.taxiPhase === "idle" && !jobBusy() && drivingKind() === "taxi" && G.wanted === 0 && t > J.taxiCooldownUntil && !G.status) {
      const near = HAIL_POINTS.filter((h) => (h.x - px) ** 2 + (h.z - pz) ** 2 < 130 ** 2);
      if (near.length > 0 && Math.random() < dt * 0.25) {
        J.fare = pick(near);
        J.taxiPhase = "pickup";
        bark("Sable Cabs", "Fare waiting — follow the amber marker and stop beside them.");
        toast("🚕 Sable Cabs: a fare is hailing — amber marker on your map.");
      }
    } else if (J.taxiPhase === "pickup" && J.fare) {
      if (drivingKind() !== "taxi") { J.taxiPhase = "idle"; J.fare = null; J.taxiCooldownUntil = t + 6; }
      else if (car && (car.state.x - J.fare.x) ** 2 + (car.state.z - J.fare.z) ** 2 < 6 ** 2 && speed < 1) {
        const dest = pick(DEST_POINTS.filter((d) => d !== J.fare));
        J.fareDest = dest;
        J.fareDist = Math.hypot(dest.x - J.fare.x, dest.z - J.fare.z);
        J.boardAt = t; J.boardDamage = car.damage;
        J.taxiPhase = "dropoff";
        bark("Passenger", pick(["Thanks! Just get me there in one piece.", "Airport road manners, please — I'm fragile cargo.", "Step on it a little? The ferry won't wait."]));
        sfx.door();
      }
    } else if (J.taxiPhase === "dropoff" && J.fareDest) {
      if (drivingKind() !== "taxi") {
        if (exitT.current < 0) exitT.current = t;
        if (t - exitT.current > 4) {
          J.taxiPhase = "idle"; J.fareDest = null; J.fare = null; J.taxiCooldownUntil = t + 8; exitT.current = -1;
          bark("Passenger", "Left me standing?! One star. ONE.");
        }
      } else {
        exitT.current = -1;
        if (car && (car.state.x - J.fareDest.x) ** 2 + (car.state.z - J.fareDest.z) ** 2 < 6 ** 2 && speed < 1.5) {
          const elapsed = t - J.boardAt;
          const par = J.fareDist / 9;
          const dmg = car.damage - J.boardDamage;
          let fare = 16 + J.fareDist * 0.3;
          let tip = 0;
          if (elapsed <= par * 1.25) tip += fare * 0.25;
          if (dmg <= 2) tip += 8; else if (dmg > 15) tip = 0;
          const total = Math.round(fare + tip);
          const stars = Math.max(1, Math.min(5, Math.round(3 + (elapsed <= par * 1.25 ? 1 : 0) + (dmg <= 2 ? 1 : 0) - (dmg > 15 ? 2 : 0))));
          G.cash += total; G.lifetimeEarned += total;
          jobStats.taxiFares += 1; jobStats.taxiEarned += total;
          jobStats.taxiBestTip = Math.max(jobStats.taxiBestTip, Math.round(tip));
          persistJobStats();
          pushPhoneMsg("Sable Cabs", `🚕 Fare complete: $${total} (tip $${Math.round(tip)}). Passenger rating: ${"★".repeat(stars)}${"☆".repeat(5 - stars)}`);
          toast(`🚕 Fare paid $${total} — ${stars}★ ride`);
          sfx.cash();
          J.taxiPhase = "idle"; J.fareDest = null; J.fare = null; J.taxiCooldownUntil = t + 12;
        }
      }
    }

    // ================= DELIVERY JOBS =================
    if (J.wantDelivery) {
      J.wantDelivery = false;
      if (J.delPhase === "idle" && !jobBusy()) {
        J.delPhase = "pickup"; J.delLeg = 0; J.delPoint = PICKUP_POINTS[0];
        toast("📦 Delivery chain started — pick up at Lina's Garage (amber marker). 3 legs, chain bonus at the end.");
        pushPhoneMsg("Lina Park", "Got a delivery chain for you — three legs, parts and parcels. First pickup's at my garage. Don't dent the merchandise.");
      } else toast("Finish what you're running first — then we'll talk deliveries.");
    }
    if (J.delPhase !== "idle" && J.delPoint && car) {
      const d2 = (car.state.x - J.delPoint.x) ** 2 + (car.state.z - J.delPoint.z) ** 2;
      if (d2 < 6.5 ** 2 && speed < 1.5) {
        if (J.delPhase === "pickup") {
          J.delPhase = "dropoff";
          J.delPoint = pick(DROPS.filter((d) => d !== J.delPoint));
          sfx.pickup(); toast("📦 Loaded. Drop-off lit on the marker — drive it there.");
        } else {
          const pay = Math.round(90 + Math.random() * 70);
          G.cash += pay; G.lifetimeEarned += pay;
          jobStats.deliveries += 1; jobStats.deliveryEarned += pay;
          J.delLeg += 1;
          sfx.cash();
          if (J.delLeg >= 3) {
            G.cash += 150; G.lifetimeEarned += 150;
            jobStats.deliveryEarned += 150; persistJobStats();
            J.delPhase = "idle"; J.delPoint = null;
            pushPhoneMsg("Lina Park", `Chain complete — $${pay} for the last leg + $150 chain bonus. The harbour's logistics arm strikes again.`);
            toast(`📦 Delivery chain complete! Last leg $${pay} + $150 bonus`);
          } else {
            persistJobStats();
            J.delPhase = "pickup";
            J.delPoint = PICKUP_POINTS[J.delLeg % PICKUP_POINTS.length];
            toast(`📦 Leg done +$${pay} — next pickup lit (${J.delLeg}/3)`);
          }
        }
      }
    }

    // ================= STREET RACES =================
    const race = J.race;
    if (!race) {
      // park the rival cars underground between races (J.race is not
      // React state, so visibility is driven from here, not JSX props)
      oppRefs.current.forEach((g) => { if (g && g.position.y > -40) g.position.set(0, -50, 0); });
    }
    if (race) {
      const def = race.def;
      if (race.phase === "countdown") {
        race.opps.forEach((o, i) => {
          const g = oppRefs.current[i];
          if (g) { g.position.set(o.x, groundYAt(o.x, o.z), o.z); g.rotation.y = o.heading; }
        });
        const left = Math.ceil(race.goAt - t);
        if (left !== countStage.current && left > 0) { countStage.current = left; bark("Race Marshal", `${left}…`); sfx.click(); }
        if (t >= race.goAt) { race.phase = "run"; race.startedAt = t; bark("Race Marshal", "GO!"); sfx.playStart(); }
      } else if (race.phase === "run") {
        // player progress through the shared checkpoint sequence
        const nextCp = def.cps[Math.min(race.cp, def.cps.length - 1)];
        const dCp = Math.hypot(px - nextCp[0], pz - nextCp[1]);
        if (race.playerDoneAt === 0 && dCp < 9 && race.cp < def.cps.length) {
          race.cp += 1; sfx.pickup();
          if (race.cp >= def.cps.length) race.playerDoneAt = t;
          else toast(`Checkpoint ${race.cp}/${def.cps.length}`);
        }
        const playerTime = race.playerDoneAt > 0 ? race.playerDoneAt - race.startedAt : 0;
        const playerProg = race.playerDoneAt > 0 ? def.cps.length * 1000 + 500 - playerTime : race.cp * 1000 - dCp;
        // opponents: checkpoint-to-checkpoint steering with rubber-banding
        let pos = 1;
        race.opps.forEach((o, i) => {
          const g = oppRefs.current[i];
          let oProg: number;
          if (o.finishedAt > 0) {
            oProg = def.cps.length * 1000 + 500 - (o.finishedAt - race.startedAt);
          } else {
            const target = def.cps[Math.min(o.cp, def.cps.length - 1)];
            const dx = target[0] - o.x, dz = target[1] - o.z;
            const d = Math.hypot(dx, dz);
            oProg = o.cp * 1000 - d;
            // pacing from the Harborfall Core (race_pace): the old
            // 0.93/1.06 step bands become a continuous rubber-band —
            // top speed shifts by up to ±1.0 u/s with the progress gap
            const topSpeed = fallbackPhysics.racePace(playerProg, oProg, 15.2 * o.skill, 1.0);
            o.speed = Math.min(o.speed + dt * 6, topSpeed);
            if (d > 0.1) {
              const want = Math.atan2(dx, dz);
              let dh = want - o.heading;
              while (dh > Math.PI) dh -= Math.PI * 2;
              while (dh < -Math.PI) dh += Math.PI * 2;
              o.heading += THREE.MathUtils.clamp(dh, -2.4 * dt, 2.4 * dt);
            }
            o.x += Math.sin(o.heading) * o.speed * dt;
            o.z += Math.cos(o.heading) * o.speed * dt;
            if (d < 9) {
              o.cp += 1;
              if (o.cp >= def.cps.length) { o.finishedAt = t; o.speed = 0; }
            }
          }
          if (oProg > playerProg) pos += 1;
          if (g) { g.position.set(o.x, groundYAt(o.x, o.z), o.z); g.rotation.y = o.heading; }
        });
        // abort: out of the car for more than 5 s
        if (!G.driving && race.playerDoneAt === 0) {
          if (raceOutAt.current < 0) raceOutAt.current = t;
          if (t - raceOutAt.current > 5) {
            toast("Race abandoned — you left your car. The marshal keeps the book.");
            pushPhoneMsg("Race Marshal", `${def.name}: abandoned. No payout${race.bet ? ", and the $100 stake stays with the book" : ""}.`);
            J.race = null;
          }
        } else raceOutAt.current = -1;
        if (J.race && race.playerDoneAt > 0) {
          const place = Math.max(1, pos);
          let payout = RACE_PRIZES[place - 1] ?? 0;
          if (place === 1 && race.bet) payout += 200; // stake back + winnings
          G.cash += payout; G.lifetimeEarned += payout;
          jobStats.racesRun += 1;
          if (place === 1) jobStats.racesWon += 1;
          const bt = jobStats.bestTimes[def.id];
          if (!bt || playerTime < bt) jobStats.bestTimes[def.id] = Math.round(playerTime * 10) / 10;
          persistJobStats();
          // Phase 8 investing nudge: a race WIN lifts Northgate Motors
          if (place === 1) nudgeStock("motors", 0.06, "a local street-race win has the whole town talking cars.");
          postRaceResult(); // Phase 8: optional Python-service leaderboard sync (no-op offline)
          pushPhoneMsg("Race Marshal", `${def.name}: you finished ${place === 1 ? "1st 🏆" : place === 2 ? "2nd" : place === 3 ? "3rd" : `${place}th`} in ${fmtTime(playerTime)} — payout $${payout}.`);
          pushNews(`Harbour Wire: ${def.name} settled`, `An unsanctioned street race through ${districtAt(def.start[0], def.start[1])} ended with a ${fmtTime(playerTime)} winning run. The patrol arrived, as ever, fashionably late.`);
          toast(`🏁 ${def.name}: ${place === 1 ? "1st" : place === 2 ? "2nd" : place === 3 ? "3rd" : `${place}th`} — ${fmtTime(playerTime)} — +$${payout}`);
          sfx.complete();
          J.race = null;
        }
      }
    }

    // ================= TOLL BOOTH =================
    {
      const inZone = car && Math.abs(px - TOLL.x) < 4.6 && Math.abs(pz - TOLL.z) < 3.2;
      const brokenNow = t < toll.current.brokenUntil;
      let open = 0;
      if (inZone && !brokenNow) {
        if (speed < 8) {
          open = 1;
          if (t - toll.current.lastCharge > 4) {
            toll.current.lastCharge = t;
            if (G.cash >= 5) { G.cash -= 5; pushPhoneMsg("SableToll", "Causeway toll — $5 charged. Smooth crossing, neighbour."); }
            else toast("Toll is $5 — the booth notes your plate (no cash taken).");
            sfx.click();
          }
        } else if (speed >= 8 && t - toll.current.lastCharge > 4) {
          toll.current.lastCharge = t;
          toll.current.brokenUntil = t + 20;
          addCrime("reckless");
          sfx.crash();
          toast("💥 You smashed the toll barrier — the patrol noticed. (No toll charged.)");
          pushNews("Barrier down on the causeway", "A driver went through the Coral causeway toll at speed this hour. The barrier is being replaced; the cameras, sadly for someone, were not.");
        }
      }
      toll.current.armOpen += ((open ? 1 : 0) - toll.current.armOpen) * Math.min(1, dt * 5);
      const ang = brokenNow ? 0.9 : -toll.current.armOpen * 1.25;
      if (armL.current) { armL.current.rotation.z = ang; armL.current.visible = true; }
      if (armR.current) { armR.current.rotation.z = -ang; armR.current.visible = true; }
    }

    // ================= SPEED CAMERAS =================
    if (car && speed > SPEED_LIMIT_U && G.wanted === 0) {
      SPEED_CAMERAS.forEach((cam, i) => {
        if ((px - cam.x) ** 2 + (pz - cam.z) ** 2 < 9 ** 2 && t > camCd.current[i] && t > camGlobal.current) {
          camCd.current[i] = t + 75; camGlobal.current = t + 60;
          const fine = Math.min(75, G.cash);
          G.cash -= fine; G.finesPaid += fine;
          G.camFlashAt = nowS();
          sfx.pop();
          pushPhoneMsg("SableCam", `📸 Speed camera on the ${cam.road}: you passed at ≈${Math.round(speed * 3.6)} km/h in a 100 zone. Fine $${fine} paid from your balance. One clean minute resets the cameras.`);
          toast(`📸 Speed camera! $${fine} fine — SableCam has your plate.`);
        }
      });
    }

    // ================= DESTRUCTIBLES + DEBRIS =================
    // Phase 9: restored-broken props stay hidden from the first frame
    for (const i of broken.current) {
      const g = destRefs.current[i];
      if (g && g.visible) g.visible = false;
    }
    if (car && speed > 6) {
      DESTRUCTIBLES.forEach((d, i) => {
        if (broken.current.has(i)) return;
        if ((car.state.x - d.x) ** 2 + (car.state.z - d.z) ** 2 < 2.3 ** 2) {
          broken.current.add(i);
          saveDaySet(DESTRUCT_KEY, [...broken.current]);
          const g = destRefs.current[i];
          if (g) g.visible = false;
          spawnDebris(d.x, groundYAt(d.x, d.z), d.z, d.kind === "barrel" ? "#b3402e" : d.kind === "fence" ? "#6d4c33" : "#a3764f", d.kind === "fence" ? 8 : 6);
          sfx.thud();
        }
      });
    }
    debris.current.forEach((d, i) => {
      const m = debrisRefs.current[i];
      if (!m) return;
      if (!d.active) { m.visible = false; return; }
      m.visible = true;
      d.vy -= 18 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      const gy = groundYAt(d.x, d.z) + 0.14;
      if (d.y < gy) { d.y = gy; d.vy *= -0.35; d.vx *= 0.7; d.vz *= 0.7; }
      d.rx += dt * 3; d.rz += dt * 2.4;
      d.life -= dt;
      if (d.life <= 0) d.active = false;
      const s = Math.max(0.2, Math.min(1, d.life / 0.8));
      m.position.set(d.x, d.y, d.z);
      m.rotation.set(d.rx, 0, d.rz);
      m.scale.setScalar(s);
    });

    // ================= FISH =================
    fishRefs.current.forEach((g, i) => {
      if (!g) return;
      const [cx, cz] = FISH_SPOTS[i];
      const a = t * (0.25 + (i % 3) * 0.07) + i * 1.7;
      const r = 1.6 + (i % 4) * 0.5;
      const cyc = (t * 0.14 + i * 0.37) % 1;
      const jump = cyc < 0.09 ? Math.sin((cyc / 0.09) * Math.PI) * 0.55 : 0;
      g.position.set(cx + Math.cos(a) * r, -0.28 + jump, cz + Math.sin(a) * r);
      g.rotation.set(jump > 0 ? -0.5 : 0, -a, 0);
    });

    // ================= AMBULANCE RUSH (5th world event) =================
    {
      const r = rush.current;
      if (!r.active && t > r.nextAt && !M.active && !G.eventNow && G.wanted === 0 && !J.race && !G.status) {
        r.active = true; r.x = 112; r.stopAt = -9;
        G.eventNow = { kind: "ambulance", x: 112, z: 100 };
        bark("Dispatch", "Ambulance rushing a patient to Sable Clinic — clear the hospital road.");
      }
      if (r.active) {
        if (r.stopAt < 0) {
          r.x = Math.max(90.5, r.x - dt * 13);
          if (r.x <= 90.5) r.stopAt = t + 3;
        } else if (t > r.stopAt) {
          r.active = false; r.nextAt = t + rand(90, 150);
          if (G.eventNow?.kind === "ambulance") G.eventNow = null;
        }
        if (G.eventNow?.kind === "ambulance") { G.eventNow.x = r.x; G.eventNow.z = 97.2; }
      }
      if (rushRef.current) {
        rushRef.current.position.set(r.active ? r.x : -93, groundYAt(r.active ? r.x : -93, r.active ? 97.2 : 108), r.active ? 97.2 : 108);
        rushRef.current.rotation.y = r.active ? -Math.PI / 2 : 0.4;
        const flash = r.active && r.stopAt < 0 && Math.sin(t * 14) > 0;
        if (rushLightA.current) (rushLightA.current.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 2.6 : 0.15;
        if (rushLightB.current) (rushLightB.current.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 0.15 : 2.6;
      }
    }

    // ================= FEED WATCHERS =================
    if (G.wanted >= 3 && prevWanted.current < 3) {
      pushNews(`Harbour Wire: patrol chase in ${districtAt(px, pz)}`, `Helicopters and half the Harbour Patrol are chasing one driver through ${districtAt(px, pz)}. Residents are advised to enjoy the show from indoors.`);
      if (!crimePosted.current) { socialCrimePost(); crimePosted.current = true; }
    }
    if (G.wanted === 0 && prevWanted.current >= 3) {
      pushNews("Harbour Wire: the chase is over", "The patrol has stood down after losing its suspect. Somewhere in Port Sable, an engine is ticking cool in the dark.");
      crimePosted.current = false;
    }
    prevWanted.current = G.wanted;
    if (G.weather !== prevWeather.current) {
      prevWeather.current = G.weather;
      if (t > 30) pushNews(`Harbour Wire: weather turning ${G.weather.toLowerCase()}`, G.weather === "Storm" ? "A storm cell is rolling over the bay — lightning over the towers, ferries holding. Drive like the roads are glass." : G.weather === "Fog" ? "Sea fog has swallowed the bridge. The lighthouse is earning its keep tonight." : G.weather === "Rain" ? "Rain over Port Sable — wet roads, long braking distances, beautiful reflections." : "Skies clearing over the harbour. The evening crowd is heading for the pier.");
    }
    if (t > socialAt.current) { socialAt.current = t + rand(50, 80); rollSocialPost(); }

    // ================= JOB / RACE MARKER =================
    if (markerRef.current) {
      const tgt = jobTarget();
      markerRef.current.visible = !!tgt;
      if (tgt) {
        markerRef.current.position.set(tgt.x, groundYAt(tgt.x, tgt.z) + 2.6 + Math.sin(t * 2.4) * 0.3, tgt.z);
        markerRef.current.rotation.y = t * 1.4;
      }
    }

    // ================= PROMPTS (claimed last) =================
    let prompt = ""; let warn = false; let act: (() => void) | null = null;
    buyRef.current = null;
    if (!G.driving && !G.status && !G.dialogueActive && !G.interior && !G.sitting) {
      // benches
      for (const b of BENCHES) {
        if ((px - b.x) ** 2 + (pz - b.z) ** 2 < 1.7 ** 2) {
          prompt = "Press E — sit on the bench";
          act = () => { G.sitting = true; G.sitSpot = { x: b.x, z: b.z, heading: b.rot + Math.PI / 2 }; sfx.click(); };
          break;
        }
      }
    }
    if (G.sitting && !G.interior) {
      prompt = "Press E — stand up";
      act = () => { G.sitting = false; G.sitSpot = null; };
    }
    if (!prompt && !G.status && !G.dialogueActive && !G.interior) {
      // businesses (hold-E buys)
      for (const b of BUSINESSES) {
        if ((px - b.x) ** 2 + (pz - b.z) ** 2 < 3.2 ** 2) {
          if (ECO.owned.includes(b.id)) prompt = `🏢 You own the ${b.name} — it pays $${b.income} every morning.`;
          else if (G.cash >= b.price) {
            prompt = `Hold E — buy the ${b.name} ($${b.price.toLocaleString()}) · +$${b.income}/day`;
            buyRef.current = {
              label: b.name,
              run: () => {
                G.cash -= b.price; ECO.owned.push(b.id); persistEco();
                // Phase 8 investing nudge: local business changing hands
                // lifts Coral Resorts a touch (documented in invest.ts)
                nudgeStock("coral", 0.03, "a familiar local just bought into Port Sable business.");
                pushPhoneMsg("SableBank", `🏢 -$${b.price.toLocaleString()} — you bought the ${b.name}. It pays $${b.income} into your account every game-morning.`);
                pushNews(`Harbour Wire: ${b.name} changes hands`, `A familiar local face has bought the ${b.name}. Staff were told nothing changes except the signature on the cheques.`);
                toast(`🏢 You own the ${b.name}! +$${b.income} every morning.`);
                sfx.cash();
              },
            };
          } else { prompt = `${b.name} — $${b.price.toLocaleString()} to buy (+$${b.income}/day). You have $${G.cash.toLocaleString()}.`; warn = true; }
          break;
        }
      }
      // apartment
      if (!prompt && (px - APARTMENT_DOOR.x) ** 2 + (pz - APARTMENT_DOOR.z) ** 2 < 2.8 ** 2) {
        if (!ECO.ownsApartment) {
          if (G.cash >= APARTMENT.price) {
            prompt = `Hold E — buy the Coral Shores Apartment ($${APARTMENT.price.toLocaleString()}) · home + garage spot`;
            buyRef.current = {
              label: "Coral Shores Apartment",
              run: () => {
                G.cash -= APARTMENT.price; ECO.ownsApartment = true; persistEco(); setHomePref("apartment");
                pushPhoneMsg("SableBank", `🔑 -$${APARTMENT.price.toLocaleString()} — Coral Shores Apartment is yours. Respawns, sleeps and garage parking now happen here (the villa still works too).`);
                toast("🔑 The Coral Shores Apartment is yours — home sweet harbour.");
                sfx.cash();
              },
            };
          } else { prompt = `Coral Shores Apartment — $${APARTMENT.price.toLocaleString()} (you have $${G.cash.toLocaleString()})`; warn = true; }
        } else {
          prompt = "Press E — sleep at your apartment (morning · full heal · businesses settle)";
          act = () => { setHomePref("apartment"); sleepToMorning("the Coral Shores Apartment"); };
        }
      }
      // villa sleep (front terrace point, clear of the gate prompt)
      if (!prompt && G.ownsMansion && (px - MANSION.x) ** 2 + (pz - (MANSION.z + 4)) ** 2 < 3 ** 2) {
        prompt = "Press E — sleep at the villa (morning · full heal · businesses settle)";
        act = () => sleepToMorning("Sable Heights Villa");
      }
      // race starts (must be in a car)
      if (!prompt) {
        for (const r of RACES) {
          if ((px - r.start[0]) ** 2 + (pz - r.start[1]) ** 2 < 5 ** 2) {
            if (J.race || M.active) break;
            if (car && car.kind !== "boat" && car.kind !== "bicycle") {
              const bt = jobStats.bestTimes[r.id];
              prompt = `Press E — start ${r.name} (${r.cps.length} checkpoints · win $${RACE_PRIZES[0]}${J.bets ? " · $100 bet on" : ""}${bt ? ` · best ${fmtTime(bt)}` : ""})`;
              act = () => startRace(r, t);
            } else { prompt = `${r.name} starts here — you need a car on the marker.`; warn = true; }
            break;
          }
        }
      }
    }
    // hold-E buy processing
    if (buyRef.current && eDownAt.current > 0) {
      const held = performance.now() / 1000 - eDownAt.current;
      G.hold = { label: `Buying ${buyRef.current.label}…`, progress: Math.min(1, held / 0.9) };
      if (held >= 0.9) {
        const run = buyRef.current.run;
        eDownAt.current = -1; G.hold = null;
        run();
      }
    } else if (G.hold?.label.startsWith("Buying")) G.hold = null;

    if (!G.promptText || G.promptText === myPrompt.current) {
      G.promptText = prompt; G.promptWarn = warn; G.interact = act;
      myPrompt.current = prompt;
    } else if (myPrompt.current) {
      // someone earlier in the chain owns the prompt this frame; if it was
      // ours and got overwritten, drop our stale reference cleanly
      myPrompt.current = G.promptText === myPrompt.current ? myPrompt.current : "";
    }
  });

  function startRace(def: RaceDef, t: number) {
    let bet = 0;
    if (J.bets) {
      if (G.cash < 100) { toast("The marshal's book needs $100 — you're short. Turn bets off in the Jobs app."); return; }
      G.cash -= 100; bet = 100;
      pushPhoneMsg("Race Marshal", `${def.name}: $100 stake taken. Win and it's $200 back on top of the prize.`);
    }
    const [sx, sz] = def.start;
    const cp0 = def.cps[0];
    const dirA = Math.atan2(cp0[0] - sx, cp0[1] - sz);
    const kinds = ["muscle", "coupe", "supercar"] as const;
    const colors = ["#b3312c", "#2e7fb8", "#d99a3d"];
    const skills = [0.93, 1.0, 1.04];
    J.race = {
      def, phase: "countdown", goAt: t + 3, startedAt: 0, cp: 0, bet, playerDoneAt: 0,
      opps: kinds.map((k, i) => {
        const off = [[-3.2, 4.5], [3.2, 4.5], [0, 9]][i];
        const ox = sx + Math.sin(dirA + Math.PI / 2) * off[0] + Math.sin(dirA + Math.PI) * off[1];
        const oz = sz + Math.cos(dirA + Math.PI / 2) * off[0] + Math.cos(dirA + Math.PI) * off[1];
        return { x: ox, z: oz, heading: dirA, cp: 0, speed: 0, skill: skills[i], finishedAt: 0, color: colors[i], kind: k };
      }),
    };
    countStage.current = -1;
    raceOutAt.current = -1;
    bark("Race Marshal", `${def.name} — three rivals, ${def.cps.length} checkpoints. On my count…`);
    sfx.click();
  }

  const tollY = groundYAt(TOLL.x, TOLL.z);
  return (
    <group>
      {/* taxi hail ped */}
      <group ref={hailRef} visible={false}><primitive object={hailRig.group} /></group>

      {/* race opponents (positioned by the frame loop; parked at y=-50
          underground between races) */}
      {["muscle", "coupe", "supercar"].map((k, i) => (
        <group key={k} ref={(n) => { oppRefs.current[i] = n; }} position={[0, -50, 0]}>
          <CarBody kind={k as "muscle" | "coupe" | "supercar"} color={["#b3312c", "#2e7fb8", "#d99a3d"][i]} />
        </group>
      ))}

      {/* job / race objective marker */}
      <mesh ref={markerRef} visible={false}>
        <cylinderGeometry args={[0.55, 0.85, 3.4, 10, 1, true]} />
        <meshBasicMaterial color="#ffb340" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* race start rings */}
      {RACES.map((r) => (
        <group key={r.id} position={[r.start[0], groundYAt(r.start[0], r.start[1]) + 0.15, r.start[1]]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[2.6, 0.14, 8, 28]} /><meshStandardMaterial color="#ffb340" emissive="#ffb340" emissiveIntensity={0.7} /></mesh>
        </group>
      ))}

      {/* toll booth (bridge deck, x=60 z=150) */}
      <group position={[TOLL.x, tollY, TOLL.z]}>
        <mesh position={[0, 0.25, 0]}><boxGeometry args={[11, 0.5, 1.6]} /><meshStandardMaterial color="#39424e" roughness={0.7} /></mesh>
        <mesh position={[0, 1.5, 0]} castShadow><boxGeometry args={[1.7, 2, 1.5]} /><meshStandardMaterial color="#d8d2c2" roughness={0.6} /></mesh>
        <mesh position={[0, 2.65, 0]} castShadow><boxGeometry args={[2.3, 0.28, 2]} /><meshStandardMaterial color="#17303a" roughness={0.6} /></mesh>
        <mesh position={[0, 1.9, -0.78]}><boxGeometry args={[1.2, 0.7, 0.04]} /><meshStandardMaterial color="#ffe9a8" emissive="#ffca7a" emissiveIntensity={0.8} /></mesh>
        <group ref={armL} position={[-0.9, 1.15, 0]}>
          <mesh position={[-2.1, 0, 0]} castShadow><boxGeometry args={[4.2, 0.14, 0.14]} /><meshStandardMaterial color="#e8e4da" roughness={0.5} /></mesh>
          <mesh position={[-1.2, 0, 0.09]}><boxGeometry args={[0.7, 0.15, 0.02]} /><meshStandardMaterial color="#c22e2e" /></mesh>
          <mesh position={[-3, 0, 0.09]}><boxGeometry args={[0.7, 0.15, 0.02]} /><meshStandardMaterial color="#c22e2e" /></mesh>
        </group>
        <group ref={armR} position={[0.9, 1.15, 0]}>
          <mesh position={[2.1, 0, 0]} castShadow><boxGeometry args={[4.2, 0.14, 0.14]} /><meshStandardMaterial color="#e8e4da" roughness={0.5} /></mesh>
          <mesh position={[1.2, 0, 0.09]}><boxGeometry args={[0.7, 0.15, 0.02]} /><meshStandardMaterial color="#c22e2e" /></mesh>
          <mesh position={[3, 0, 0.09]}><boxGeometry args={[0.7, 0.15, 0.02]} /><meshStandardMaterial color="#c22e2e" /></mesh>
        </group>
      </group>

      {/* speed cameras */}
      {SPEED_CAMERAS.map((cam, i) => (
        <group key={i} position={[cam.x, groundYAt(cam.x, cam.z), cam.z]}>
          <mesh position={[0, 2.2, 0]} castShadow><cylinderGeometry args={[0.07, 0.09, 4.4, 6]} /><meshStandardMaterial color="#39424e" metalness={0.5} roughness={0.5} /></mesh>
          <mesh position={[0, 4.5, 0]} castShadow><boxGeometry args={[0.55, 0.4, 0.8]} /><meshStandardMaterial color="#e8e4da" roughness={0.4} /></mesh>
          <mesh position={[0, 4.5, 0]}><boxGeometry args={[0.3, 0.22, 0.84]} /><meshStandardMaterial color="#14181d" roughness={0.3} /></mesh>
        </group>
      ))}

      {/* destructibles */}
      {DESTRUCTIBLES.map((d, i) => (
        <group key={i} ref={(n) => { destRefs.current[i] = n; }} position={[d.x, groundYAt(d.x, d.z), d.z]} rotation={[0, d.rot, 0]}>
          {d.kind === "crate" && <mesh position={[0, 0.4, 0]} castShadow><boxGeometry args={[1, 0.8, 1]} /><meshStandardMaterial color="#a3764f" roughness={0.9} /></mesh>}
          {d.kind === "barrel" && <mesh position={[0, 0.43, 0]} castShadow><cylinderGeometry args={[0.32, 0.32, 0.85, 10]} /><meshStandardMaterial color={i % 3 === 0 ? "#2e7fb8" : i % 3 === 1 ? "#b3402e" : "#5c6650"} roughness={0.55} metalness={0.3} /></mesh>}
          {d.kind === "fence" && (
            <group>
              <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[3.9, 0.75, 0.07]} /><meshStandardMaterial color="#8a6a44" roughness={0.95} /></mesh>
              <mesh position={[-1.8, 0.45, 0]}><boxGeometry args={[0.12, 0.9, 0.12]} /><meshStandardMaterial color="#6d4c33" roughness={0.95} /></mesh>
              <mesh position={[1.8, 0.45, 0]}><boxGeometry args={[0.12, 0.9, 0.12]} /><meshStandardMaterial color="#6d4c33" roughness={0.95} /></mesh>
            </group>
          )}
        </group>
      ))}
      {/* debris pool */}
      {debris.current.map((_, i) => (
        <mesh key={i} ref={(n) => { debrisRefs.current[i] = n; }} visible={false}>
          <boxGeometry args={[0.3, 0.22, 0.3]} />
          <meshStandardMaterial color="#a3764f" roughness={0.9} />
        </mesh>
      ))}

      {/* fish */}
      {FISH_SPOTS.map((_, i) => (
        <group key={i} ref={(n) => { fishRefs.current[i] = n; }} position={[0, -20, 0]}>
          <mesh scale={[1.7, 0.38, 0.55]}><sphereGeometry args={[0.42, 8, 6]} /><meshStandardMaterial color="#33505e" roughness={0.3} metalness={0.45} /></mesh>
          <mesh position={[-0.75, 0.05, 0]} rotation={[0, 0, 0.5]}><coneGeometry args={[0.16, 0.4, 4]} /><meshStandardMaterial color="#33505e" roughness={0.3} metalness={0.45} /></mesh>
        </group>
      ))}

      {/* parked emergency units: fire truck at the east fire point */}
      <group position={[104, 0, 24]} rotation={[0, 0.15, 0]}>
        <CarBody kind="van" color="#c22e2e" />
        <mesh position={[0, 2.02, -0.2]}><boxGeometry args={[1.1, 0.14, 0.4]} /><meshStandardMaterial color="#5c1616" emissive="#ff3333" emissiveIntensity={0.2} /></mesh>
        <mesh position={[0, 2.12, 0.4]}><boxGeometry args={[0.5, 0.08, 4.4]} /><meshStandardMaterial color="#c8ccd2" metalness={0.7} roughness={0.35} /></mesh>
      </group>
      {/* the ambulance: parked at the hospital corner, rushes on event */}
      <group ref={rushRef} position={[-93, 0, 108]} rotation={[0, 0.4, 0]}>
        <CarBody kind="van" color="#e8ecef" />
        <mesh ref={rushLightA} position={[-0.3, 2.02, -0.2]}><boxGeometry args={[0.5, 0.14, 0.4]} /><meshStandardMaterial color="#e8ecef" emissive="#ff4444" emissiveIntensity={0.15} /></mesh>
        <mesh ref={rushLightB} position={[0.3, 2.02, -0.2]}><boxGeometry args={[0.5, 0.14, 0.4]} /><meshStandardMaterial color="#e8ecef" emissive="#4488ff" emissiveIntensity={0.15} /></mesh>
        <mesh position={[0, 2.06, 0.9]}><boxGeometry args={[0.52, 0.05, 0.17]} /><meshStandardMaterial color="#c22e2e" roughness={0.5} /></mesh>
        <mesh position={[0, 2.06, 0.9]}><boxGeometry args={[0.17, 0.05, 0.52]} /><meshStandardMaterial color="#c22e2e" roughness={0.5} /></mesh>
      </group>
    </group>
  );
}
