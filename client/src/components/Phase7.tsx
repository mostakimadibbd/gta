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
import { isBind } from "../game/keybinds";
import { M } from "../game/missionState";
import { pushPhoneMsg } from "../game/phone";
import { sfx } from "../game/audio";
import {
  J, HAIL_POINTS, DEST_POINTS, PICKUP_POINTS, RACES, RACE_PRIZES, BAY_CIRCUIT, SPARROW_RUN,
  jobStats, persistJobStats, jobTarget, fmtTime, jobBusy, drivingKind, type RaceDef, type Poi,
  FARM_LOAD_POINT, FARM_DROP_POINT, FARM_PAY_PER_LOAD, FARM_SHIFT_BONUS, FARM_PICKUP_SPAWN_ID,
  VALET_FRONTAGES, VALET_BASE_PAY, VALET_DAMAGE_PER_POINT, VALET_PAY_FLOOR, VALET_CLEAN_BONUS,
  spawnValetCar, collectValetCar, endValetJob,
  COURIER_PAY_PER_DROP, COURIER_CHAIN_BONUS, COURIER_DROPS, courierLegSeconds,
  rollTaxiType, TAXI_TYPE_HINT, TAXI_TYPE_LABEL, TAXI_BOARD_LINES, CHATTY_LINES,
  NERVOUS_DAMAGE_LINE, NERVOUS_DROPPED_LINE, settleFare,
} from "../game/jobs";
import { BUSINESSES, APARTMENT, ECO, advanceDay, sleepToMorning, setHomePref, persistEco } from "../game/economy";
import { RENT, RENTAL_DOCK, RENTAL_FEE, rentBoat, endRental, rentalCar } from "../game/rentals";
import { pushNews, rollSocialPost, socialCrimePost } from "../game/feed";
import { recordCupResult } from "../game/cup";
import { nudgeStock } from "../game/invest";
import { postRaceResult } from "../game/leaderboard";
import { brokenDestructibles, breakDestructible, resetDestructibles, onDestructibleBreak } from "../game/destruct";
import { fallbackPhysics } from "../physics/GamePhysics";
import {
  TOLL, SPEED_CAMERAS, SPEED_LIMIT_U, DESTRUCTIBLES,
  APARTMENT_DOOR, MANSION, groundYAt, districtAt, props,
} from "../world";
import CarBody from "./CarBody";
import { buildHumanoid, animateHumanoid } from "../humanoid";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
// Phase 12: scratch buffer for the per-frame hail-point scan (was a
// .filter allocation every frame while idling in a taxi)
const hailScratch: Poi[] = [];
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
  // Phase 14: the Bay Circuit ghost rival's mesh + its placement
  const ghostRef = useRef<THREE.Group>(null);
  const positionGhost = (t: number) => {
    const g = ghostRef.current; if (!g) return;
    const o = J.race?.def.mode === "boat" ? J.race.opps[0] : undefined;
    if (!o) { g.visible = false; return; }
    g.visible = true;
    g.position.set(o.x, 0.12 + Math.sin(t * 2.1) * 0.05, o.z);
    g.rotation.set(Math.sin(t * 1.7) * 0.02, o.heading, Math.sin(t * 1.3) * 0.03);
  };
  // ---------- destructibles + debris ----------
  const destRefs = useRef<Array<THREE.Group | null>>([]);
  // Phase 14: the broken set is shared state now (game/destruct.ts) —
  // the bat and thrown bottles break props too; this component owns
  // the meshes + debris and reacts to breaks from any source
  const breakFx = useRef<(i: number, dirX: number, dirZ: number, power: number) => void>(() => {});
  useEffect(() => onDestructibleBreak((i, dx, dz, p) => breakFx.current(i, dx, dz, p)), []);
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
  const rentalSerial = useRef(ECO.daySerial); // Phase 19: day-pass expiry watch
  const markerRef = useRef<THREE.Mesh>(null);
  // Phase 16: farm-work crate stack — rides in the farm pickup's bed
  // while a load is being delivered (2 crates per load, up to 6)
  const crateGroupRef = useRef<THREE.Group>(null);
  const crateRefs = useRef<Array<THREE.Mesh | null>>([]);
  const countStage = useRef(-1);
  const raceOutAt = useRef(-1); // race abort timer (out of car)
  const valetOutAt = useRef(-1); // Phase 22: valet abort timer (out of the customer's car)

  useEffect(() => {
    const dn = (e: KeyboardEvent) => { if (isBind(e, "interact") && !e.repeat) eDownAt.current = performance.now() / 1000; };
    const up = (e: KeyboardEvent) => { if (isBind(e, "interact")) eDownAt.current = -1; };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);

  const spawnDebris = (x: number, y: number, z: number, color: string, n = 6, dirX = 0, dirZ = 0, power = 0) => {
    for (let k = 0; k < n; k++) {
      const idx = debrisCursor.current;
      debrisCursor.current = (debrisCursor.current + 1) % debris.current.length;
      const d = debris.current[idx];
      d.active = true; d.x = x + rand(-0.4, 0.4); d.y = y + rand(0.1, 0.7); d.z = z + rand(-0.4, 0.4);
      // Phase 10: the collision impulse aims the spray — debris flies
      // AWAY from the striking car, scattered around its velocity
      d.vx = rand(-3.4, 3.4) + dirX * power * rand(0.5, 1.1); d.vy = rand(2.5, 6); d.vz = rand(-3.4, 3.4) + dirZ * power * rand(0.5, 1.1);
      d.rx = rand(0, 3); d.rz = rand(0, 3); d.life = 2.2; d.color = color;
      const m = debrisRefs.current[idx];
      if (m) (m.material as THREE.MeshStandardMaterial).color.set(color);
    }
  };
  // Phase 14: ONE break reaction for every source (car ram / bat /
  // bottle) — hide the mesh, spray kind-coloured debris, thud
  breakFx.current = (i, dirX, dirZ, power) => {
    const d = DESTRUCTIBLES[i];
    if (!d) return;
    const g = destRefs.current[i];
    if (g) g.visible = false;
    const color = d.kind === "barrel" ? "#b3402e" : d.kind === "fence" ? "#6d4c33" : d.kind === "stall" ? "#b3542e" : d.kind === "sign" ? "#8a929a" : "#a3764f";
    const n = d.kind === "stall" ? 10 : d.kind === "fence" ? 8 : d.kind === "sign" ? 5 : 6;
    spawnDebris(d.x, groundYAt(d.x, d.z), d.z, color, n, dirX, dirZ, power);
    sfx.thud();
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
      resetDestructibles(); // destructibles are repaired overnight
      destRefs.current.forEach((g) => { if (g) g.visible = true; });
    }
    prevDay.current = G.dayTime;

    // ================= MARINA RENTAL WATCH (Phase 19) =================
    // The pass dies with the day: when the day serial rolls (the
    // 06:00 wrap above OR a sleep, which also advances it), an idle
    // rental is collected on the spot; one still being driven is
    // flagged expired and collected the moment the player steps
    // out. A wreck ends the paperwork immediately.
    if (RENT.active) {
      const rc = rentalCar();
      if (rc && rc.damage >= 100) endRental("wreck");
      else if (rentalSerial.current !== ECO.daySerial) {
        rentalSerial.current = ECO.daySerial;
        if (car && car === rc) RENT.expired = true;
        else endRental("expired");
      } else if (RENT.expired && (!car || car !== rc)) endRental("expired");
    } else rentalSerial.current = ECO.daySerial;

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
      hailScratch.length = 0;
      for (const h of HAIL_POINTS) if ((h.x - px) ** 2 + (h.z - pz) ** 2 < 130 ** 2) hailScratch.push(h);
      if (hailScratch.length > 0 && Math.random() < dt * 0.25) {
        J.fare = pick(hailScratch);
        J.taxiPhase = "pickup";
        // Phase 23: every fare rolls a personality (game/jobs.ts) —
        // the marker label and this toast both name it up front, so
        // the deal is known before the passenger ever gets in.
        J.taxiType = rollTaxiType(); J.taxiBarks = 0; J.taxiBarkAt = 0; J.taxiDmgBarked = false;
        bark("Sable Cabs", "Fare waiting — follow the amber marker and stop beside them.");
        toast(`🚕 Sable Cabs: a fare is hailing — amber marker. They ${TAXI_TYPE_HINT[J.taxiType]} (${TAXI_TYPE_LABEL[J.taxiType]}).`);
      }
    } else if (J.taxiPhase === "pickup" && J.fare) {
      if (drivingKind() !== "taxi") { J.taxiPhase = "idle"; J.fare = null; J.taxiType = ""; J.taxiCooldownUntil = t + 6; }
      else if (car && (car.state.x - J.fare.x) ** 2 + (car.state.z - J.fare.z) ** 2 < 6 ** 2 && speed < 1) {
        const dest = pick(DEST_POINTS.filter((d) => d !== J.fare));
        J.fareDest = dest;
        J.fareDist = Math.hypot(dest.x - J.fare.x, dest.z - J.fare.z);
        J.boardAt = t; J.boardDamage = car.damage;
        J.taxiPhase = "dropoff";
        // Phase 23: the boarding bark IS the personality — it states
        // the deal (the hurried +40%, the nervous no-knock rule) in
        // the passenger's own words before the wheels turn.
        if (J.taxiType === "chatty") J.taxiBarkAt = t + 8; // first story beat lands a few seconds in
        bark("Passenger", J.taxiType ? TAXI_BOARD_LINES[J.taxiType] : pick(["Thanks! Just get me there in one piece.", "Airport road manners, please — I'm fragile cargo.", "Step on it a little? The ferry won't wait."]));
        sfx.door();
      }
    } else if (J.taxiPhase === "dropoff" && J.fareDest) {
      if (drivingKind() !== "taxi") {
        if (exitT.current < 0) exitT.current = t;
        if (t - exitT.current > 4) {
          J.taxiPhase = "idle"; J.fareDest = null; J.fare = null; J.taxiType = ""; J.taxiCooldownUntil = t + 8; exitT.current = -1;
          bark("Passenger", "Left me standing?! One star. ONE.");
        }
      } else {
        exitT.current = -1;
        // Phase 23: mid-ride personality beats — the Chatty fare
        // tells their stories (2–3 barks, then they're done), and
        // the Nervous fare complains the FIRST time the cab takes a
        // knock, so the player learns the tip died when it died.
        if (car && J.taxiType === "chatty" && J.taxiBarks < CHATTY_LINES.length && t >= J.taxiBarkAt) {
          bark("Passenger", CHATTY_LINES[J.taxiBarks]);
          J.taxiBarks += 1;
          J.taxiBarkAt = t + 11 + Math.random() * 6;
        }
        if (car && J.taxiType === "nervous" && !J.taxiDmgBarked && car.damage - J.boardDamage > 0) {
          J.taxiDmgBarked = true;
          bark("Passenger", NERVOUS_DAMAGE_LINE);
        }
        if (car && (car.state.x - J.fareDest.x) ** 2 + (car.state.z - J.fareDest.z) ** 2 < 6 ** 2 && speed < 1.5) {
          const elapsed = t - J.boardAt;
          const par = J.fareDist / 9;
          const dmg = car.damage - J.boardDamage;
          const fare = 16 + J.fareDist * 0.3;
          // Phase 23: ALL tip maths lives in settleFare (game/jobs.ts)
          const { tip, note } = settleFare(J.taxiType, fare, elapsed, par, dmg);
          const total = Math.round(fare + tip);
          let stars = Math.max(1, Math.min(5, Math.round(3 + (elapsed <= par * 1.25 ? 1 : 0) + (dmg <= 2 ? 1 : 0) - (dmg > 15 ? 2 : 0))));
          if (J.taxiType === "nervous" && dmg > 0) stars = Math.min(stars, 2); // a frightened passenger doesn't round up
          G.cash += total; G.lifetimeEarned += total;
          jobStats.taxiFares += 1; jobStats.taxiEarned += total;
          jobStats.taxiBestTip = Math.max(jobStats.taxiBestTip, Math.round(tip));
          jobStats.taxiTips += Math.round(tip);
          persistJobStats();
          pushPhoneMsg("Sable Cabs", `🚕 Fare complete: $${Math.round(fare)} fare + $${Math.round(tip)} tip = $${total}. ${note}. Passenger rating: ${"★".repeat(stars)}${"☆".repeat(5 - stars)}`);
          toast(`🚕 Fare $${Math.round(fare)} + tip $${Math.round(tip)} = $${total} — ${stars}★ ride`);
          if (J.taxiType === "nervous" && dmg > 0) bark("Passenger", NERVOUS_DROPPED_LINE);
          sfx.cash();
          J.taxiPhase = "idle"; J.fareDest = null; J.fare = null; J.taxiType = ""; J.taxiCooldownUntil = t + 12;
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

    // ================= FARM WORK (Phase 16) =================
    // Haul crop crates from the Downs barn to Harbour Wraps in the
    // farm pickup — the delivery chain's pattern with its own flags
    // (J.farmPhase/farmLoad in game/jobs.ts). Only the farm pickup
    // (spawn id 31) can load or deliver: the job is the truck's work.
    if (J.wantFarm) {
      J.wantFarm = false;
      if (J.farmPhase === "idle" && !jobBusy()) {
        J.farmPhase = "load"; J.farmLoad = 0;
        toast("🌾 Farm work started — take the farm pickup to the barn (amber marker) and load up. 3 loads to Harbour Wraps.");
        pushPhoneMsg("Old Elias", "Downs farm needs hands, lad. Crates are stacked by the barn — the old pickup's yours for the shift. Wraps pays $120 a load, and there's a bonus for the full three.");
      } else toast("Finish what you're running first — then we'll talk farm work.");
    }
    if (J.farmPhase !== "idle") {
      const inPickup = !!car && car.id === FARM_PICKUP_SPAWN_ID;
      if (J.farmPhase === "load" && car) {
        const d2 = (car.state.x - FARM_LOAD_POINT.x) ** 2 + (car.state.z - FARM_LOAD_POINT.z) ** 2;
        if (inPickup && d2 < 6.5 ** 2 && speed < 1.5) {
          J.farmPhase = "deliver";
          sfx.pickup(); toast(`🌾 Crates loaded — load ${J.farmLoad + 1} of 3. Harbour Wraps is lit on the marker.`);
        }
      } else if (J.farmPhase === "deliver" && car) {
        const d2 = (car.state.x - FARM_DROP_POINT.x) ** 2 + (car.state.z - FARM_DROP_POINT.z) ** 2;
        if (inPickup && d2 < 6.5 ** 2 && speed < 1.5) {
          const pay = FARM_PAY_PER_LOAD;
          G.cash += pay; G.lifetimeEarned += pay;
          jobStats.farmLoads += 1; jobStats.farmEarned += pay;
          J.farmLoad += 1;
          sfx.cash();
          if (J.farmLoad >= 3) {
            G.cash += FARM_SHIFT_BONUS; G.lifetimeEarned += FARM_SHIFT_BONUS;
            jobStats.farmEarned += FARM_SHIFT_BONUS; persistJobStats();
            J.farmPhase = "idle";
            pushPhoneMsg("Old Elias", `Last load in — the Wraps crew sends their thanks, and the farm adds the $${FARM_SHIFT_BONUS} shift bonus. Honest work, honest pay.`);
            toast(`🌾 Farm shift complete! $${pay} for the load + $${FARM_SHIFT_BONUS} bonus`);
          } else {
            persistJobStats();
            J.farmPhase = "load";
            toast(`🌾 Load delivered +$${pay} — back to the barn for more (${J.farmLoad}/3)`);
          }
        }
      }
    }

    // ================= ODD JOBS: VALET (Phase 22) =================
    // The customer's car (game/jobs.ts spawnValetCar) waits at a
    // hotel/club frontage. Keys change hands when the player gets
    // IN; the park leg is timed from that moment, and the pay is
    // settled on the damage the car gained while it was theirs.
    if (J.wantValet) {
      J.wantValet = false;
      if (J.valetPhase === "idle" && !jobBusy()) {
        J.valetFront = Math.floor(Math.random() * VALET_FRONTAGES.length);
        J.valetCarId = spawnValetCar(J.valetFront);
        J.valetPhase = "pickup"; J.valetCollect = false; valetOutAt.current = -1;
        const f = VALET_FRONTAGES[J.valetFront];
        toast(`🅿️ Valet: a guest at ${f.name} is handing over their keys — the car's at the frontage (amber marker).`);
        pushPhoneMsg("Valet Stand", `New keys on the hook: ${f.name}. $${VALET_BASE_PAY} to park her, minus $${VALET_DAMAGE_PER_POINT} a point of new damage (never under $${VALET_PAY_FLOOR}), plus $${VALET_CLEAN_BONUS} if she arrives unmarked. The bay's lit on your map.`);
      } else toast("Finish what you're running first — then we'll talk valet work.");
    }
    // the job ended while the player was still in the car — the
    // stand collects it the moment they step out (rental discipline)
    if (J.valetCollect && J.valetCarId >= 0 && !(G.driving && G.activeCarId === J.valetCarId)) {
      collectValetCar(); J.valetCollect = false;
      toast("🅿️ The valet stand collected the car.");
    }
    if (J.valetPhase !== "idle" && J.valetFront >= 0) {
      const f = VALET_FRONTAGES[J.valetFront];
      const vc = J.valetCarId >= 0 ? G.cars[J.valetCarId] : null;
      if (vc && vc.damage >= 100) {
        endValetJob(true); // the wreck stays in the world, like a rental wreck
        pushPhoneMsg("Valet Stand", "You TOTALLED a guest's car?! The stand's writing it off — and your name's mud on the hook board.");
        toast("🅿️ Valet failed — the customer's car is wrecked.");
        sfx.dryFire();
      } else if (J.valetPhase === "pickup") {
        if (car && vc && car === vc) {
          J.valetPhase = "park";
          J.valetDamage0 = vc.damage;
          const dist = Math.hypot(f.bayX - f.x, f.bayZ - f.z);
          J.valetEndsAt = t + Math.round(dist / 6 + 30);
          J.valetLeft = J.valetEndsAt - t;
          bark("Guest", "Bay's lit on your map — and I just had her detailed, friend.");
          toast(`🅿️ Keys in hand — park it in the ${f.name} bay before the clock runs out.`);
        }
      } else if (J.valetPhase === "park" && vc) {
        J.valetLeft = Math.max(0, J.valetEndsAt - t);
        if (car && car === vc) {
          valetOutAt.current = -1;
          if ((vc.state.x - f.bayX) ** 2 + (vc.state.z - f.bayZ) ** 2 < 4.2 ** 2 && speed < 1) {
            const dmg = Math.max(0, Math.round(vc.damage - J.valetDamage0));
            let pay = Math.max(VALET_PAY_FLOOR, VALET_BASE_PAY - dmg * VALET_DAMAGE_PER_POINT);
            if (dmg <= 0) pay += VALET_CLEAN_BONUS;
            G.cash += pay; G.lifetimeEarned += pay;
            jobStats.valetJobs += 1; jobStats.valetEarned += pay;
            persistJobStats();
            endValetJob(false);
            pushPhoneMsg("Valet Stand", dmg <= 0
              ? `Perfect park — $${pay} (incl. the $${VALET_CLEAN_BONUS} unmarked bonus). The guest never knew.`
              : `Parked, $${pay} — ${dmg} point${dmg === 1 ? "" : "s"} of new damage at $${VALET_DAMAGE_PER_POINT} each.`);
            toast(`🅿️ Valet parked — +$${pay}${dmg <= 0 ? " (unmarked!)" : ""}`);
            sfx.cash();
          } else if (J.valetLeft <= 0) {
            endValetJob(false);
            pushPhoneMsg("Valet Stand", "Too slow — the guest took a cab and the stand took the keys back. No pay.");
            toast("🅿️ Valet failed — out of time.");
            sfx.dryFire();
          }
        } else {
          // out of the customer's car: 5 s grace, the race rule
          if (valetOutAt.current < 0) valetOutAt.current = t;
          if (t - valetOutAt.current > 5) {
            endValetJob(false);
            pushPhoneMsg("Valet Stand", "You walked away from a guest's car — the stand collected it. No pay.");
            toast("🅿️ Valet failed — you left the customer's car.");
            sfx.dryFire();
          }
        }
      }
    }

    // ================= ODD JOBS: COURIER SPRINT (Phase 22) =================
    // Three drops in sequence, on foot or by bicycle. The countdown
    // only runs in courier mode — sitting in a car pauses it (the
    // marker label says so) — and each drop pays on arrival.
    if (J.wantCourier) {
      J.wantCourier = false;
      // Phase 23 audit fix: game/jobs.ts documents that starting a
      // new chain REPLACES the running one (the chain owns no world
      // objects, so abandonment is total) — but this gate used to
      // refuse the start outright while a chain ran (jobBusy counts
      // the courier itself), so the documented restart could never
      // happen. A running chain now restarts cleanly; landed drops
      // stay paid, the unfinished chain's bonus simply walks.
      if (J.courierPhase === "run") {
        J.courierLeg = 0;
        J.courierPoint = pick(DEST_POINTS);
        J.courierLeft = courierLegSeconds(Math.hypot(J.courierPoint.x - px, J.courierPoint.z - pz));
        toast("🚴 Courier chain restarted — fresh drops, fresh clock. Feet and pedals only: the clock pauses while you drive.");
        pushPhoneMsg("Sable Courier Co-op", "Chain re-rolled — the old one is closed, no hard feelings. Three new drops on the board.");
      } else if (J.courierPhase === "idle" && !jobBusy()) {
        J.courierPhase = "run"; J.courierLeg = 0;
        J.courierPoint = pick(DEST_POINTS);
        J.courierLeft = courierLegSeconds(Math.hypot(J.courierPoint.x - px, J.courierPoint.z - pz));
        toast("🚴 Courier chain started — first drop lit on the marker. Feet and pedals only: the clock pauses while you drive.");
        pushPhoneMsg("Sable Courier Co-op", `Three drops, one chain. $${COURIER_PAY_PER_DROP} a drop, $${COURIER_CHAIN_BONUS} more if you land all three. Run or ride — cars don't count, and the clock knows it.`);
      } else toast("Finish what you're running first — then we'll talk courier work.");
    }
    if (J.courierPhase === "run" && J.courierPoint) {
      const onBike = drivingKind() === "bicycle";
      const eligible = !G.driving || onBike;
      if (eligible) {
        J.courierLeft -= dt;
        const cx = onBike && car ? car.state.x : px, cz = onBike && car ? car.state.z : pz;
        if ((cx - J.courierPoint.x) ** 2 + (cz - J.courierPoint.z) ** 2 < 3.4 ** 2) {
          G.cash += COURIER_PAY_PER_DROP; G.lifetimeEarned += COURIER_PAY_PER_DROP;
          jobStats.courierDrops += 1; jobStats.courierEarned += COURIER_PAY_PER_DROP;
          J.courierLeg += 1;
          sfx.cash();
          if (J.courierLeg >= COURIER_DROPS) {
            G.cash += COURIER_CHAIN_BONUS; G.lifetimeEarned += COURIER_CHAIN_BONUS;
            jobStats.courierEarned += COURIER_CHAIN_BONUS; persistJobStats();
            J.courierPhase = "idle"; J.courierPoint = null;
            pushPhoneMsg("Sable Courier Co-op", `Chain complete — last drop +$${COURIER_PAY_PER_DROP} and the $${COURIER_CHAIN_BONUS} full-chain bonus. The harbour's fastest legs strike again.`);
            toast(`🚴 Courier chain complete! +$${COURIER_PAY_PER_DROP} drop + $${COURIER_CHAIN_BONUS} bonus`);
          } else {
            persistJobStats();
            const from = J.courierPoint;
            const next = pick(DEST_POINTS.filter((d) => d !== from));
            J.courierPoint = next;
            J.courierLeft = courierLegSeconds(Math.hypot(next.x - from.x, next.z - from.z));
            toast(`🚴 Drop ${J.courierLeg}/${COURIER_DROPS} +$${COURIER_PAY_PER_DROP} — next drop lit (${next.name})`);
          }
        } else if (J.courierLeft <= 0) {
          J.courierPhase = "idle"; J.courierPoint = null;
          pushPhoneMsg("Sable Courier Co-op", "The clock beat you — chain closed. Drops you landed stay paid; the bonus walks.");
          toast("🚴 Courier chain failed — out of time on the leg.");
          sfx.dryFire();
        }
      }
    }

    // ================= STREET RACES =================
    // Phase 14: this block runs STREET races only — the Bay Circuit
    // (boat) and Sparrow Run (air) share the J.race state but are
    // stepped by their own block below (different progress source:
    // the vehicle's state, not the on-foot position).
    const race = J.race && !J.race.def.mode ? J.race : null;
    if (!J.race) {
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
        // player progress through the shared checkpoint sequence.
        // Phase 14 correction: measure from the ACTIVE CAR while
        // driving (G.playerPos is the on-foot position and does not
        // track the car) — same pattern as GameSystems' car-aware px.
        const rpx = car ? car.state.x : px, rpz = car ? car.state.z : pz;
        const nextCp = def.cps[Math.min(race.cp, def.cps.length - 1)];
        const dCp = Math.hypot(rpx - nextCp[0], rpz - nextCp[1]);
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
          // Phase 17: Street Challenge — winner takes the whole pot
          // (both $200 stakes), loser gets nothing back
          if (def.challenge) payout = place === 1 ? 400 : 0;
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
          if (race.cup) recordCupResult(def.id, place); // Phase 18: Sable Cup
          J.race = null;
        }
      }
    }

    // ================= PHASE 14: BAY CIRCUIT (boat) + SPARROW RUN (air) =================
    // Same J.race state machine as the street fields — countdown, run,
    // 5 s out-of-vehicle abort, best times in jobStats — but progress
    // is measured from the ACTIVE VEHICLE's state (boat/plane), the
    // Bay Circuit fields ONE ghost rival paced by race_pace, and the
    // Sparrow Run gates its rings on altitude (followPos.y carries
    // the plane's height) with a landing finish.
    const srace = J.race && J.race.def.mode ? J.race : null;
    if (!srace && ghostRef.current) ghostRef.current.visible = false;
    if (srace) {
      const def = srace.def;
      const vc = car; // the vehicle the player is driving (null on foot)
      const vx = vc ? vc.state.x : px, vz = vc ? vc.state.z : pz;
      if (srace.phase === "countdown") {
        if (def.mode === "boat") positionGhost(t);
        const left = Math.ceil(srace.goAt - t);
        if (left !== countStage.current && left > 0) { countStage.current = left; bark(def.mode === "boat" ? "Race Marshal" : "Tower", `${left}…`); sfx.click(); }
        if (t >= srace.goAt) { srace.phase = "run"; srace.startedAt = t; bark(def.mode === "boat" ? "Race Marshal" : "Tower", "GO!"); sfx.playStart(); }
      } else if (srace.phase === "run") {
        const alt = Math.max(0, G.followPos.y - groundYAt(vx, vz));
        const nextCp = def.cps[Math.min(srace.cp, def.cps.length - 1)];
        const dCp = Math.hypot(vx - nextCp[0], vz - nextCp[1]);
        const isLast = srace.cp >= def.cps.length - 1;
        // ring gates: boat 11u flat · air 26u + altitude band (the
        // final ring is the landing — it only counts below 4u)
        const altOk = def.mode !== "air" ? true
          : isLast ? alt < 4
          : Math.abs(alt - (def.cpAlt?.[srace.cp] ?? 25)) < 9;
        if (srace.playerDoneAt === 0 && dCp < (def.mode === "air" ? 26 : 11) && altOk && srace.cp < def.cps.length) {
          srace.cp += 1; sfx.pickup();
          if (srace.cp >= def.cps.length) srace.playerDoneAt = t;
          else toast(`${def.name} — checkpoint ${srace.cp}/${def.cps.length} · ${fmtTime(t - srace.startedAt)}`);
        }
        const playerTime = srace.playerDoneAt > 0 ? srace.playerDoneAt - srace.startedAt : 0;
        const playerProg = srace.playerDoneAt > 0 ? def.cps.length * 1000 + 500 - playerTime : srace.cp * 1000 - dCp;
        // ---- the ghost rival (Bay Circuit only) ----
        let ghostWon = false;
        if (def.mode === "boat" && srace.opps[0]) {
          const o = srace.opps[0];
          if (o.finishedAt > 0) ghostWon = true;
          else {
            const target = def.cps[Math.min(o.cp, def.cps.length - 1)];
            const dx = target[0] - o.x, dz = target[1] - o.z;
            const d = Math.hypot(dx, dz);
            const oProg = o.cp * 1000 - d;
            // ghost pacing from the Harborfall Core (race_pace), base
            // just under a runabout's top speed — beatable, honest
            const topSpeed = fallbackPhysics.racePace(playerProg, oProg, 13.6, 1.0);
            o.speed = Math.min(o.speed + dt * 4, topSpeed);
            if (d > 0.1) {
              const want = Math.atan2(dx, dz);
              let dh = want - o.heading;
              while (dh > Math.PI) dh -= Math.PI * 2;
              while (dh < -Math.PI) dh += Math.PI * 2;
              o.heading += THREE.MathUtils.clamp(dh, -1.6 * dt, 1.6 * dt);
            }
            o.x += Math.sin(o.heading) * o.speed * dt;
            o.z += Math.cos(o.heading) * o.speed * dt;
            if (d < 11) { o.cp += 1; if (o.cp >= def.cps.length) { o.finishedAt = t; o.speed = 0; ghostWon = true; } }
          }
          positionGhost(t);
        }
        // abort: out of the vehicle for more than 5 s (same rule)
        if (!G.driving && srace.playerDoneAt === 0) {
          if (raceOutAt.current < 0) raceOutAt.current = t;
          if (t - raceOutAt.current > 5) {
            toast(`${def.name} abandoned — you left your ${def.mode === "boat" ? "boat" : "plane"}.`);
            pushPhoneMsg("Race Marshal", `${def.name}: abandoned. No payout.`);
            J.race = null;
          }
        } else raceOutAt.current = -1;
        if (J.race && srace.playerDoneAt > 0) {
          const bt = jobStats.bestTimes[def.id];
          if (!bt || playerTime < bt) jobStats.bestTimes[def.id] = Math.round(playerTime * 10) / 10;
          jobStats.racesRun += 1;
          let payout = 0; let verdict: string;
          if (def.mode === "boat") {
            if (ghostWon) verdict = `2nd — the ghost boat got home first (${fmtTime(playerTime)})`;
            else { payout = def.purse ?? 500; jobStats.racesWon += 1; verdict = `1st 🏆 — ${fmtTime(playerTime)} — +$${payout}`; }
          } else {
            const par = def.par ?? 120;
            if (playerTime <= par) { payout = def.purse ?? 600; jobStats.racesWon += 1; verdict = `${fmtTime(playerTime)} — under the ${fmtTime(par)} par! +$${payout}`; }
            else verdict = `${fmtTime(playerTime)} — over the ${fmtTime(par)} par, no purse (best time recorded)`;
          }
          if (payout > 0) { G.cash += payout; G.lifetimeEarned += payout; }
          persistJobStats();
          postRaceResult();
          pushPhoneMsg(def.mode === "air" ? "Tower" : "Race Marshal", `${def.name}: ${verdict}.`);
          toast(`🏁 ${def.name}: ${verdict}`);
          sfx.complete();
          // Phase 18: the Bay Circuit is Cup round 4 — 1st or 2nd
          // against the single ghost is the whole field there is
          if (srace.cup && def.mode === "boat") recordCupResult(def.id, ghostWon ? 2 : 1);
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
    for (const i of brokenDestructibles) {
      const g = destRefs.current[i];
      if (g && g.visible) g.visible = false;
    }
    if (car && speed > 6) {
      DESTRUCTIBLES.forEach((d, i) => {
        if (brokenDestructibles.has(i)) return;
        if ((car.state.x - d.x) ** 2 + (car.state.z - d.z) ** 2 < 2.3 ** 2) {
          // Phase 14: the shared break path (mesh + debris react via
          // the breakFx subscription — bat and bottle breaks land in
          // exactly the same place)
          breakDestructible(i,
            Math.sin(car.state.heading) * Math.sign(car.state.speed), Math.cos(car.state.heading) * Math.sign(car.state.speed),
            Math.min(6, Math.abs(car.state.speed) * 0.55));
        }
      });
    }
    debris.current.forEach((d, i) => {
      const m = debrisRefs.current[i];
      if (!m) return;
      if (!d.active) { m.visible = false; return; }
      m.visible = true;
      // Phase 10: integration is the C++ core's debris_step (gravity,
      // bounce restitution, ground friction, rest settle) via its
      // exact TS mirror — one physics home for every shard in the game
      const gy = groundYAt(d.x, d.z) + 0.14;
      const ns = fallbackPhysics.debrisStep(d, gy, 0.35, 0.7, dt);
      d.x = ns.x; d.y = ns.y; d.z = ns.z; d.vx = ns.vx; d.vy = ns.vy; d.vz = ns.vz;
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

    // ================= FARM CRATES (Phase 16) =================
    // The stack exists only while a load is in the bed (deliver leg);
    // it grows by two crates per load of the shift — load 1 rides
    // with 2 crates, load 3 with a full 6-crate stack.
    if (crateGroupRef.current) {
      const stack = J.farmPhase === "deliver" ? (J.farmLoad + 1) * 2 : 0;
      const pickup = G.cars.find((c) => c.id === FARM_PICKUP_SPAWN_ID);
      const show = stack > 0 && !!pickup && !pickup.storedAway;
      crateGroupRef.current.visible = show;
      if (show && pickup) {
        const bx = pickup.state.x - Math.sin(pickup.state.heading) * 0.85;
        const bz = pickup.state.z - Math.cos(pickup.state.heading) * 0.85;
        crateGroupRef.current.position.set(bx, groundYAt(bx, bz) + 0.82, bz);
        crateGroupRef.current.rotation.y = pickup.state.heading;
        crateRefs.current.forEach((m, i) => { if (m) m.visible = i < stack; });
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
          if (ECO.owned.includes(b.id)) prompt = b.id === "marina"
            ? `🏢 You own the ${b.name} — it pays $${b.income} every morning, and the rental dock down the pier is open (day-pass skiffs).`
            : `🏢 You own the ${b.name} — it pays $${b.income} every morning.`;
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
      // ---- Phase 19: the marina rental dock (owning the business
      // unlocks it; the office counter up the road is the BUSINESSES
      // loop above, the dock point is where boats actually change
      // hands) ----
      if (!prompt && (px - RENTAL_DOCK.x) ** 2 + (pz - RENTAL_DOCK.z) ** 2 < 3.4 ** 2) {
        if (!ECO.owned.includes("marina")) {
          prompt = "Sable Marina Rentals — the rental dock. Own the business (office up the road) and its boats are yours to rent."; warn = true;
        } else if (!RENT.active) {
          if (G.cash >= RENTAL_FEE) {
            prompt = `Hold E — rent a skiff ($${RENTAL_FEE} day-pass) · Sable Marina Rentals`;
            buyRef.current = { label: "Rental skiff day-pass", run: () => { rentBoat(); } };
          } else { prompt = `Sable Marina Rentals — a day-pass is $${RENTAL_FEE} (you have $${G.cash.toLocaleString()}).`; warn = true; }
        } else {
          const rc = rentalCar();
          const near = rc && (rc.state.x - RENTAL_DOCK.x) ** 2 + (rc.state.z - RENTAL_DOCK.z) ** 2 < 45 ** 2;
          if (near) {
            prompt = "Press E — return the rental skiff (the marina crew collects her)";
            act = () => endRental("return");
          } else { prompt = "Your rental skiff is still out — bring her back toward the pier to return her."; warn = true; }
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
      // ---- Phase 14 starts: measured from the VEHICLE (the on-foot
      // position doesn't track it) — Bay Circuit needs a boat on the
      // marina marker, Sparrow Run the plane on the field marker ----
      if (!prompt && car && !J.race && !M.active) {
        if ((car.state.x - BAY_CIRCUIT.start[0]) ** 2 + (car.state.z - BAY_CIRCUIT.start[1]) ** 2 < 7 ** 2) {
          if (car.kind === "boat" || car.kind === "skiff") {
            const bt = jobStats.bestTimes[BAY_CIRCUIT.id];
            prompt = `Press E — start Bay Circuit (${BAY_CIRCUIT.cps.length} checkpoints around Sable Island · beat the ghost boat · win $${BAY_CIRCUIT.purse}${bt ? ` · best ${fmtTime(bt)}` : ""})`;
            act = () => startSpecialRace(BAY_CIRCUIT, t);
          } else { prompt = "Bay Circuit starts here — you need a boat on the marker."; warn = true; }
        } else if ((car.state.x - SPARROW_RUN.start[0]) ** 2 + (car.state.z - SPARROW_RUN.start[1]) ** 2 < 9 ** 2) {
          if (car.kind === "plane") {
            const bt = jobStats.bestTimes[SPARROW_RUN.id];
            prompt = `Press E — start Sparrow Run (time trial · ${SPARROW_RUN.cps.length} rings · beat ${fmtTime(SPARROW_RUN.par ?? 120)} for $${SPARROW_RUN.purse}${bt ? ` · best ${fmtTime(bt)}` : ""})`;
            act = () => startSpecialRace(SPARROW_RUN, t);
          } else { prompt = "Sparrow Run starts here — you need the Sparrow on the marker."; warn = true; }
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
    // Phase 18: a Sable Cup arm (Phone → Jobs) converts when THIS
    // race starts; any other start discards it. Street Challenge
    // races never pass through here (Phase17 seeds J.race directly),
    // which is exactly why they can't count as Cup rounds.
    // Phase 19 audit: the arm conversion/discarding used to run
    // BEFORE the bet check, so a start that then FAILED (bets on,
    // cash short) ate the player's arm even though no race ever
    // started. The arm now only converts or clears once the start
    // is real — the bet is taken first.
    let bet = 0;
    if (J.bets) {
      if (G.cash < 100) { toast("The marshal's book needs $100 — you're short. Turn bets off in the Jobs app."); return; }
      G.cash -= 100; bet = 100;
      pushPhoneMsg("Race Marshal", `${def.name}: $100 stake taken. Win and it's $200 back on top of the prize.`);
    }
    const cup = J.cupArm === def.id;
    J.cupArm = "";
    const [sx, sz] = def.start;
    const cp0 = def.cps[0];
    const dirA = Math.atan2(cp0[0] - sx, cp0[1] - sz);
    const kinds = ["muscle", "coupe", "supercar"] as const;
    const colors = ["#b3312c", "#2e7fb8", "#d99a3d"];
    const skills = [0.93, 1.0, 1.04];
    J.race = {
      def, phase: "countdown", goAt: t + 3, startedAt: 0, cp: 0, bet, playerDoneAt: 0, cup,
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

  /** Phase 14: Bay Circuit + Sparrow Run starts — the same J.race
   * state, no side bet; the boat race seeds ONE ghost rival astern. */
  function startSpecialRace(def: RaceDef, t: number) {
    // Phase 18: the Cup arm converts here too — but only the Bay
    // Circuit is a Cup round; a Sparrow Run start discards the arm
    // like any non-Cup start (see startRace).
    const cup = def.mode === "boat" && J.cupArm === def.id;
    J.cupArm = "";
    const [sx, sz] = def.start;
    const cp0 = def.cps[0];
    const dirA = Math.atan2(cp0[0] - sx, cp0[1] - sz);
    J.race = {
      def, phase: "countdown", goAt: t + 3, startedAt: 0, cp: 0, bet: 0, playerDoneAt: 0, cup,
      opps: def.mode === "boat"
        ? [{ x: sx - Math.sin(dirA) * 7, z: sz - Math.cos(dirA) * 7, heading: dirA, cp: 0, speed: 0, skill: 1, finishedAt: 0, color: "#d8d2c2", kind: "muscle" }]
        : [],
    };
    countStage.current = -1;
    raceOutAt.current = -1;
    bark(def.mode === "boat" ? "Race Marshal" : "Tower",
      def.mode === "boat" ? "Bay Circuit — around the island and home. The pale boat is your ghost. On my count…"
        : "Sparrow Run — rings at the bridge, the lighthouse, Northgate. Land back here to stop the clock. On my count…");
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
      {/* Phase 16: farm-work crates (positioned per-frame in the bed) */}
      <group ref={crateGroupRef} visible={false}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh key={i} ref={(n) => { crateRefs.current[i] = n; }} position={[(i % 2 === 0 ? -0.3 : 0.3), Math.floor(i / 2) * 0.34, 0]} castShadow>
            <boxGeometry args={[0.55, 0.32, 0.75]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#8a5a2b" : "#7a4e24"} roughness={0.9} />
          </mesh>
        ))}
      </group>
      {/* race start rings */}
      {RACES.map((r) => (
        <group key={r.id} position={[r.start[0], groundYAt(r.start[0], r.start[1]) + 0.15, r.start[1]]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[2.6, 0.14, 8, 28]} /><meshStandardMaterial color="#ffb340" emissive="#ffb340" emissiveIntensity={0.7} /></mesh>
        </group>
      ))}
      {/* Phase 14 start rings: Bay Circuit (floating on the marina
          water) + Sparrow Run (on the Sable Field apron) */}
      <group position={[BAY_CIRCUIT.start[0], 0.18, BAY_CIRCUIT.start[1]]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[3.2, 0.16, 8, 28]} /><meshStandardMaterial color="#7fd8e8" emissive="#7fd8e8" emissiveIntensity={0.7} /></mesh>
      </group>
      <group position={[SPARROW_RUN.start[0], groundYAt(SPARROW_RUN.start[0], SPARROW_RUN.start[1]) + 0.15, SPARROW_RUN.start[1]]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[3.2, 0.16, 8, 28]} /><meshStandardMaterial color="#7fd8e8" emissive="#7fd8e8" emissiveIntensity={0.7} /></mesh>
      </group>
      {/* Phase 14: Sparrow Run rings, hanging at their gate altitudes
          (the last one lies flat on the field — the landing gate) */}
      {SPARROW_RUN.cps.map((cp, i) => {
        const alt = SPARROW_RUN.cpAlt?.[i] ?? 0;
        return (
          <group key={i} position={[cp[0], Math.max(1.2, alt), cp[1]]} rotation={alt < 4 ? [Math.PI / 2, 0, 0] : [0, i * 0.7, 0]}>
            <mesh><torusGeometry args={[7, 0.35, 8, 24]} /><meshStandardMaterial color="#ffb340" emissive="#ffb340" emissiveIntensity={0.55} transparent opacity={0.9} /></mesh>
          </group>
        );
      })}
      {/* Phase 14: the Bay Circuit ghost rival — a pale runabout,
          positioned by the frame loop while its race runs */}
      <group ref={ghostRef} visible={false}>
        <mesh position={[0, 0.32, 0]} castShadow><boxGeometry args={[1.7, 0.55, 4.6]} /><meshStandardMaterial color="#d8d2c2" roughness={0.35} metalness={0.1} /></mesh>
        <mesh position={[0, 0.68, -0.5]} castShadow><boxGeometry args={[1.3, 0.4, 1.7]} /><meshStandardMaterial color="#e8e4da" roughness={0.3} /></mesh>
        <mesh position={[0, 0.85, -0.5]}><boxGeometry args={[1.1, 0.28, 0.06]} /><meshStandardMaterial color="#7fd8e8" roughness={0.1} metalness={0.3} /></mesh>
        <mesh position={[0, 0.5, 2.15]}><boxGeometry args={[0.5, 0.35, 0.3]} /><meshStandardMaterial color="#39424e" metalness={0.5} roughness={0.4} /></mesh>
      </group>

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
          {d.kind === "stall" && (
            <group>
              {/* market stall: four posts, a counter, produce crates and
                  the striped canopy that makes it read from the street */}
              {([[-1.3, -0.8], [1.3, -0.8], [-1.3, 0.8], [1.3, 0.8]] as const).map(([x, z], j) => (
                <mesh key={j} position={[x, 1.05, z]} castShadow><boxGeometry args={[0.09, 2.1, 0.09]} /><meshStandardMaterial color="#6d4c33" roughness={0.9} /></mesh>
              ))}
              <mesh position={[0, 0.95, 0]} castShadow><boxGeometry args={[2.9, 0.1, 1.9]} /><meshStandardMaterial color="#7a5a3d" roughness={0.85} /></mesh>
              <mesh position={[0, 2.22, 0]} rotation={[0, 0, 0.06]} castShadow><boxGeometry args={[3.3, 0.07, 2.3]} /><meshStandardMaterial color="#b3542e" roughness={0.8} /></mesh>
              <mesh position={[0, 2.26, 0]} rotation={[0, 0, 0.06]}><boxGeometry args={[3.3, 0.03, 0.5]} /><meshStandardMaterial color="#e8e0d0" roughness={0.8} /></mesh>
              <mesh position={[-0.8, 1.18, 0.2]} castShadow><boxGeometry args={[0.62, 0.36, 0.62]} /><meshStandardMaterial color="#a3764f" roughness={0.9} /></mesh>
              <mesh position={[0.5, 1.16, -0.25]} castShadow><boxGeometry args={[0.55, 0.32, 0.55]} /><meshStandardMaterial color="#59754e" roughness={0.9} /></mesh>
            </group>
          )}
          {d.kind === "sign" && (
            <group>
              <mesh position={[0, 1.25, 0]} castShadow><cylinderGeometry args={[0.05, 0.06, 2.5, 8]} /><meshStandardMaterial color="#59616a" metalness={0.6} roughness={0.45} /></mesh>
              <mesh position={[0, 2.35, 0]} castShadow><boxGeometry args={[1.15, 0.72, 0.06]} /><meshStandardMaterial color="#14524f" roughness={0.5} /></mesh>
              <mesh position={[0, 2.35, 0.04]}><boxGeometry args={[0.95, 0.52, 0.02]} /><meshStandardMaterial color="#ffb340" emissive="#ffb340" emissiveIntensity={0.25} /></mesh>
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
