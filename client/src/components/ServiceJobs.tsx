// Harborfall — Phase 32: SERVICE JOBS (paramedic + firefighter).
//
// The dispatch sim has sent NPC units to incident spots since
// Phase 7; these shifts put the player in the unit, working the
// same spots (game/dispatch.ts INCIDENT_SPOTS, player-side).
//
// PARAMEDIC — start at the hospital door (HOSPITAL_DOOR). The job
// ambulance waits on the hospital lot. Drive to the patient (a
// lying figure at the spot), treat them on foot (hold-E, 3 s),
// drive them back to the hospital bay. Pay per patient = base +
// time bonus (the return leg's remaining fraction) + a no-damage
// bonus, all through the NG+ multiplier. Three patients a shift,
// nearest-first, so the legs escalate.
//
// FIREFIGHTER — start at the fire station door (FIRE_EXT_DOOR).
// The tender waits on the civic lot. Park within 9u of the fire,
// hose it on foot (hold-E): the fire's strength drains over ~6 s
// of water and the tank drains with it — one fire drinks 55 of
// the 100 tank, so between the shift's two fires you refill at
// the marked hydrant (or the station door), hold-E 2.5 s. A fire
// left burning 240 s burns out unpaid.
//
// SIREN — while a call is live the unit's beacons flash; while
// YOU drive the unit on a call the siren sounds (game/audio.ts
// jobSiren — the same voice the patrol uses). Traffic courtesy is
// the Phase 22 horn path, honestly scoped: cars ahead in the
// cone get hornPull = 2, the exact write a honk makes — a kerb-
// ward VISUAL ease for ~2 s. Traffic lanes, routes and speeds are
// never touched, and there is no police-yield hook to reuse: the
// patrol does not yield to anyone in this build. The siren never
// draws police attention: the jobs are wanted-neutral, taking the
// unit is never a steal (Vehicle.tsx honours isServiceCar), and a
// shift can only START at wanted 0.
//
// Stand-downs, all honest: bust/wasted mid-shift ends the shift
// (watched here off G.status), NG+ stands both down in
// game/ngplus.ts, a wrecked unit ends the shift and stays in the
// world, and walking away from your unit (> 60u for 25 s) ends it
// too. Vehicles run the rental discipline via game/jobs.ts:
// spawned for the shift, collected at its end (on step-out if
// you're still in it), never owned, never stored.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { G, bark } from "../game/store";
import {
  J, jobBusy, jobStats, persistJobStats,
  startMedShift, startFireShift, medDispatchPatient, fireDispatch,
  endMedJob, endFireJob, collectMedCar, collectFireCar,
  MED_BASE_PAY, MED_TIME_BONUS, MED_CLEAN_BONUS, MED_SHIFT_BONUS, MED_PATIENTS_PER_SHIFT,
  FIRE_BASE_PAY, FIRE_SPEED_BONUS, FIRE_SHIFT_BONUS, FIRES_PER_SHIFT,
  FIRE_TANK, FIRE_COST, FIRE_BURNOUT_S,
} from "../game/jobs";
import { M, ngPayoutMult } from "../game/missionState";
import { HOSPITAL_DOOR, FIRE_EXT_DOOR, props } from "../world";
import { pushPhoneMsg } from "../game/phone";
import { setJobSiren } from "../game/audio";
import { buildHumanoid, type HumanoidRig } from "../humanoid";
import { isBind } from "../game/keybinds";

const REN = "Dispatch — Ren";
const HYDRANTS = props.filter((p) => p.kind === "hydrant");
const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

export default function ServiceJobs() {
  const mine = useRef("");
  const eHeld = useRef(false);
  const chanP = useRef(0);            // treat / refill channel progress (pauses, resets on phase change)
  const chanPhase = useRef("");
  const holdMine = useRef(false);
  const prevStatus = useRef("");
  const medAway = useRef(0);
  const fireAway = useRef(0);
  const fireAge = useRef(0);          // seconds the live fire has burned (respond/hose only)
  const medDelivered = useRef(0);     // this shift's deliveries (J.medPatient is the spot index)
  const firesOut = useRef(0);         // this shift's fires out (J.fireN is the spot index)
  const courtesyAt = useRef(0);

  const patientRigs = useMemo<HumanoidRig[]>(() => [
    buildHumanoid({ top: "#b3542e", bottom: "#2c3440", skin: "#8d5524", hair: "#14100e", gender: "m", hairStyle: "flat" }),
    buildHumanoid({ top: "#3e6b8a", bottom: "#23272e", skin: "#c68863", hair: "#3a2415", gender: "f", hairStyle: "bun" }),
    buildHumanoid({ top: "#5d7a4a", bottom: "#4a3b2a", skin: "#5c3a21", hair: "#0c0c0c", gender: "m", hairStyle: "crop", build: "broad" }),
  ], []);

  const patientRef = useRef<THREE.Group>(null);
  const fireRef = useRef<THREE.Group>(null);
  const flameRefs = useRef<Array<THREE.Mesh | null>>([]);
  const smokeRefs = useRef<Array<THREE.Mesh | null>>([]);
  const dropRefs = useRef<Array<THREE.Mesh | null>>([]);
  const steamRefs = useRef<Array<THREE.Mesh | null>>([]);
  const fireLight = useRef<THREE.PointLight>(null);
  const medBeacon = useRef<THREE.Group>(null);
  const fireBeacon = useRef<THREE.Group>(null);
  const beaconMats = useMemo(() => ({
    medR: new THREE.MeshStandardMaterial({ color: "#571313", emissive: "#ff2a1e", emissiveIntensity: 0.2 }),
    medB: new THREE.MeshStandardMaterial({ color: "#101d3d", emissive: "#2e6bff", emissiveIntensity: 0.2 }),
    fireR: new THREE.MeshStandardMaterial({ color: "#571313", emissive: "#ff2a1e", emissiveIntensity: 0.2 }),
    fireB: new THREE.MeshStandardMaterial({ color: "#101d3d", emissive: "#2e6bff", emissiveIntensity: 0.2 }),
  }), []);
  const smokeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a3f45", roughness: 1, transparent: true, opacity: 0.55 }), []);
  const dropMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7fd8e8", roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }), []);
  const steamMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e8ecec", roughness: 1, transparent: true, opacity: 0.5 }), []);

  // The channel keys are tracked locally (Vehicle's break-in does
  // the same): keydown/keyup on the interact bind.
  useEffect(() => {
    const dn = (e: KeyboardEvent) => { if (isBind(e, "interact")) eHeld.current = true; };
    const up = (e: KeyboardEvent) => { if (isBind(e, "interact")) eHeld.current = false; };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    let claimed = false;
    const claim = (text: string, act: (() => void) | null, warn = false) => {
      if (!G.promptText || G.promptText === mine.current) {
        G.promptText = text; G.promptWarn = warn; G.interact = act;
        mine.current = text; claimed = true;
      }
    };
    const release = () => {
      if (mine.current && G.promptText === mine.current) { G.promptText = ""; G.interact = null; }
      mine.current = "";
    };
    const clearHold = () => { if (holdMine.current) { G.hold = null; holdMine.current = false; } chanP.current = 0; };

    // ---------- stand-down: busted / wasted mid-shift ----------
    if (G.status && !prevStatus.current) {
      if (J.medPhase !== "idle") {
        bark(REN, G.status === "busted" ? "— unit's impounded with you in custody. Shift's over, Kade." : "— medics pulled YOU out this time. Shift's over.");
        pushPhoneMsg(REN, "Shift closed early — the service doesn't ask questions, but the shift is done.");
        endMedJob(false);
      }
      if (J.firePhase !== "idle") {
        bark(REN, G.status === "busted" ? "— tender's impounded with you in custody. Shift's over, Kade." : "— crew dragged you clear of the smoke. Shift's over.");
        pushPhoneMsg(REN, "Shift closed early — the service doesn't ask questions, but the shift is done.");
        endFireJob(false);
      }
      clearHold();
    }
    prevStatus.current = G.status;

    // ---------- collect-on-step-out (the valet discipline) ----------
    if (J.medCollect && !(G.driving && G.activeCarId === J.medCarId)) { collectMedCar(); J.medCollect = false; }
    if (J.fireCollect && !(G.driving && G.activeCarId === J.fireCarId)) { collectFireCar(); J.fireCollect = false; }

    const pay = (base: number) => {
      const total = Math.round(base * ngPayoutMult());
      G.cash += total; G.lifetimeEarned += total;
      jobStats.serviceEarned += total;
      return total;
    };

    // ================= PARAMEDIC =================
    const medCar = J.medCarId >= 0 ? G.cars[J.medCarId] : null;
    if (J.medPhase !== "idle") {
      if (!medCar || medCar.damage >= 100) {
        bark(REN, "— the ambulance is wrecked. Walk away from it; the shift's done.");
        endMedJob(true); clearHold();
      } else {
        // leg clock
        if (J.medPhase === "pickup" || J.medPhase === "return") {
          J.medTimer -= dt;
          if (J.medTimer <= 0) {
            bark(REN, J.medPhase === "pickup" ? "— too late, another unit took that patient. Next call coming." : "— the patient didn't make the ride. I'm sorry. Next call coming.");
            pushPhoneMsg(REN, "A patient was lost on the clock. The board keeps moving — next call dispatched.");
            J.medPatient += 1;
            if (J.medPatient >= MED_PATIENTS_PER_SHIFT) {
              jobStats.medShifts += 1; persistJobStats();
              bark(REN, "— that's the board cleared, such as it is. Shift over.");
              endMedJob(false);
            } else medDispatchPatient();
          }
        }
        if (J.medPhase === "pickup" && J.medSpot && G.driving && G.activeCarId === J.medCarId
          && dist(medCar.state.x, medCar.state.z, J.medSpot.x, J.medSpot.z) < 4.5) {
          J.medPhase = "treat";
          bark(REN, "— on scene. On foot, hands on the patient — hold E beside them.");
        }
        if (J.medPhase === "treat" && J.medSpot) {
          const inCtx = !G.driving && dist(G.playerPos.x, G.playerPos.z, J.medSpot.x, J.medSpot.z) < 2.6;
          if (chanPhase.current !== "treat") { chanPhase.current = "treat"; chanP.current = 0; }
          if (inCtx && eHeld.current) {
            chanP.current += dt / 3;
            G.hold = { label: "Treating the patient…", progress: Math.min(1, chanP.current) };
            holdMine.current = true;
            if (chanP.current >= 1) {
              clearHold();
              J.medPhase = "return";
              const back = dist(J.medSpot.x, J.medSpot.z, HOSPITAL_DOOR.x, HOSPITAL_DOOR.z);
              J.medTotal = J.medTimer = 60 + back / 5;
              bark(REN, "— patient loaded. Bring them home — the bay at the hospital door, and bring the van back whole for the clean bonus.");
            }
          } else if (holdMine.current) { G.hold = null; holdMine.current = false; }
        }
        if (J.medPhase === "return" && Math.abs(medCar.state.speed) < 1.5
          && dist(medCar.state.x, medCar.state.z, HOSPITAL_DOOR.x, HOSPITAL_DOOR.z) < 6.5) {
          const frac = J.medTotal > 0 ? THREE.MathUtils.clamp(J.medTimer / J.medTotal, 0, 1) : 0;
          const clean = medCar.damage - J.medDmg0 <= 0;
          const total = pay(MED_BASE_PAY + Math.round(MED_TIME_BONUS * frac) + (clean ? MED_CLEAN_BONUS : 0));
          medDelivered.current += 1;
          jobStats.patientsDelivered += 1;
          J.medPatient += 1;
          bark(REN, `— patient delivered. $${total} on the shift${clean ? " — and not a scratch on the van. That's how it's done" : ""}.`);
          if (J.medPatient >= MED_PATIENTS_PER_SHIFT) {
            let bonusNote = "";
            if (medDelivered.current >= MED_PATIENTS_PER_SHIFT) { const b = pay(MED_SHIFT_BONUS); bonusNote = ` Full board — shift bonus $${b}.`; }
            jobStats.medShifts += 1; persistJobStats();
            pushPhoneMsg(REN, `Paramedic shift complete: ${medDelivered.current}/${MED_PATIENTS_PER_SHIFT} patients delivered.${bonusNote} The ambulance goes back to the lot — good work.`);
            bark(REN, "— board's clear. Shift over, Kade. The city breathes easier.");
            medDelivered.current = 0;
            endMedJob(false);
          } else { persistJobStats(); medDispatchPatient(); }
        }
        // abandonment: away from the unit, not driving it
        if (!(G.driving && G.activeCarId === J.medCarId) && dist(G.playerPos.x, G.playerPos.z, medCar.state.x, medCar.state.z) > 60) {
          medAway.current += dt;
          if (medAway.current > 25) {
            bark(REN, "— you walked off and left my ambulance standing. Shift's over.");
            medAway.current = 0; endMedJob(false); clearHold();
          }
        } else medAway.current = 0;
      }
    }

    // ================= FIREFIGHTER =================
    const fireCar = J.fireCarId >= 0 ? G.cars[J.fireCarId] : null;
    // Phase 33 audit: the refill routing, shared by the fire-out
    // path and the burnout path. A fire that BURNS OUT after partial
    // hosing used to dispatch the next call directly — with the tank
    // under one fire's drink (FIRE_COST) that next fire could never
    // be finished: the hose ran dry mid-fire, the hold label said
    // "refill at a hydrant" and no refill phase was reachable. Any
    // path that moves the board on with a short tank routes here.
    const routeRefill = () => {
      if (!fireCar) return;
      // the refill point: the hydrant nearest the tender, or the
      // station door — whichever is closer
      let best: { name: string; x: number; z: number } = { name: "Sable Fire Station", x: FIRE_EXT_DOOR.x, z: FIRE_EXT_DOOR.z };
      let bd = dist(fireCar.state.x, fireCar.state.z, best.x, best.z);
      for (const h of HYDRANTS) {
        const d = dist(fireCar.state.x, fireCar.state.z, h.x, h.z);
        if (d < bd) { bd = d; best = { name: "the hydrant", x: h.x, z: h.z }; }
      }
      J.fireRefillAt = best;
      J.firePhase = "refill";
      bark(REN, `— refill at ${best.name === "the hydrant" ? "the marked hydrant" : "the station"} before the next call. Park the tender close, then hold E at the point.`);
    };
    if (J.firePhase !== "idle") {
      if (!fireCar || fireCar.damage >= 100) {
        bark(REN, "— the tender is wrecked. Walk away from it; the shift's done.");
        endFireJob(true); clearHold();
      } else {
        if (J.firePhase === "respond" || J.firePhase === "hose") fireAge.current += dt;
        if (fireAge.current > FIRE_BURNOUT_S && J.fireSpot) {
          bark(REN, `— too late at ${J.fireSpot.name}; it burned itself out. No pay on ashes. Next call.`);
          pushPhoneMsg(REN, "A fire burned out before the tender got water on it. No pay on ashes.");
          fireAge.current = 0;
          J.fireN += 1;
          if (J.fireN >= FIRES_PER_SHIFT) {
            jobStats.fireShifts += 1; persistJobStats();
            bark(REN, "— that's the board. Shift over.");
            endFireJob(false);
          } else if (J.fireWater < FIRE_COST) routeRefill(); // Phase 33: a short tank refills before the next call, like the fire-out path
          else fireDispatch();
        } else if (J.firePhase === "respond" && J.fireSpot
          && dist(fireCar.state.x, fireCar.state.z, J.fireSpot.x, J.fireSpot.z) < 9) {
          J.firePhase = "hose";
          bark(REN, "— tender's in position. On foot, get the hose on it — hold E by the flames. Watch the tank gauge in your head: a fire drinks deep.");
        }
        if (J.firePhase === "hose" && J.fireSpot) {
          const inCtx = !G.driving
            && dist(G.playerPos.x, G.playerPos.z, J.fireSpot.x, J.fireSpot.z) < 7
            && dist(fireCar.state.x, fireCar.state.z, J.fireSpot.x, J.fireSpot.z) < 9;
          if (inCtx && eHeld.current && J.fireWater > 0) {
            const drain = dt / 6; // a full fire takes ~6 s of water
            J.fireSize = Math.max(0, J.fireSize - drain);
            J.fireWater = Math.max(0, J.fireWater - FIRE_COST * drain);
            G.hold = { label: J.fireWater > 0 ? "Hosing the fire…" : "Tank's dry — refill at a hydrant or the station", progress: 1 - J.fireSize };
            holdMine.current = true;
            if (J.fireSize <= 0) {
              clearHold();
              const speedFrac = THREE.MathUtils.clamp(1 - fireAge.current / FIRE_BURNOUT_S, 0, 1);
              const total = pay(FIRE_BASE_PAY + Math.round(FIRE_SPEED_BONUS * speedFrac));
              firesOut.current += 1;
              jobStats.firesOut += 1;
              bark(REN, `— fire's out at ${J.fireSpot.name}. $${total} on the shift. Tank's at ${Math.round(J.fireWater)} — refill before the next one.`);
              fireAge.current = 0;
              J.fireN += 1;
              if (J.fireN >= FIRES_PER_SHIFT) {
                let bonusNote = "";
                if (firesOut.current >= FIRES_PER_SHIFT) { const b = pay(FIRE_SHIFT_BONUS); bonusNote = ` Both fires out — shift bonus $${b}.`; }
                jobStats.fireShifts += 1; persistJobStats();
                pushPhoneMsg(REN, `Fire shift complete: ${firesOut.current}/${FIRES_PER_SHIFT} fires out.${bonusNote} The tender goes back to the lot — good work.`);
                bark(REN, "— board's clear. Shift over, Kade.");
                firesOut.current = 0;
                endFireJob(false);
              } else {
                persistJobStats();
                routeRefill(); // Phase 33: shared with the burnout path
              }
            }
          } else if (holdMine.current) { G.hold = null; holdMine.current = false; }
        }
        if (J.firePhase === "refill" && J.fireRefillAt) {
          const nearPoint = dist(G.playerPos.x, G.playerPos.z, J.fireRefillAt.x, J.fireRefillAt.z) < 3.4
            || dist(G.playerPos.x, G.playerPos.z, FIRE_EXT_DOOR.x, FIRE_EXT_DOOR.z) < 3.4;
          const truckNear = dist(fireCar.state.x, fireCar.state.z, J.fireRefillAt.x, J.fireRefillAt.z) < 9
            || dist(fireCar.state.x, fireCar.state.z, FIRE_EXT_DOOR.x, FIRE_EXT_DOOR.z) < 9;
          const inCtx = !G.driving && nearPoint && truckNear;
          if (chanPhase.current !== "refill") { chanPhase.current = "refill"; chanP.current = 0; }
          if (inCtx && eHeld.current) {
            chanP.current += dt / 2.5;
            G.hold = { label: "Refilling the tank…", progress: Math.min(1, chanP.current) };
            holdMine.current = true;
            if (chanP.current >= 1) {
              clearHold();
              J.fireWater = FIRE_TANK;
              J.fireRefillAt = null;
              bark(REN, "— tank's full. Next call coming over the wire now.");
              fireDispatch();
            }
          } else if (holdMine.current) { G.hold = null; holdMine.current = false; }
        }
        // abandonment: away from the tender, not driving it
        if (!(G.driving && G.activeCarId === J.fireCarId) && dist(G.playerPos.x, G.playerPos.z, fireCar.state.x, fireCar.state.z) > 60) {
          fireAway.current += dt;
          if (fireAway.current > 25) {
            bark(REN, "— you walked off and left my tender standing. Shift's over.");
            fireAway.current = 0; endFireJob(false); clearHold();
          }
        } else fireAway.current = 0;
      }
    }

    // ================= start prompts =================
    if (!G.driving && !G.status && !M.active && J.medPhase === "idle" && J.firePhase === "idle" && !jobBusy()) {
      if (dist(G.playerPos.x, G.playerPos.z, HOSPITAL_DOOR.x, HOSPITAL_DOOR.z) < 2.4) {
        if (G.wanted === 0) claim("E — Start paramedic shift (3 patients, the ambulance is on the lot)", () => { if (!G.driving && startMedShift()) { medDelivered.current = 0; bark(REN, "— Kade? Ren, dispatch. Ambulance is on the hospital lot, keys in. First patient just hit the board — go."); pushPhoneMsg(REN, "Paramedic shift started. The ambulance is on the hospital lot; patients come over the marker, nearest first."); } });
        else claim("Dispatch won't sign you on with the patrol watching — lose the heat first", null, true);
      } else if (dist(G.playerPos.x, G.playerPos.z, FIRE_EXT_DOOR.x, FIRE_EXT_DOOR.z) < 2.4) {
        if (G.wanted === 0) claim("E — Start firefighter shift (2 fires, the tender is on the lot)", () => { if (!G.driving && startFireShift()) { firesOut.current = 0; fireAge.current = 0; bark(REN, "— Kade? Ren, dispatch. Tender's on the lot west of the station, tank full. First call just hit the board — go."); pushPhoneMsg(REN, "Fire shift started. The tender is on the civic lot; mind the tank — a fire drinks 55 of 100, refill between fires."); } });
        else claim("Dispatch won't sign you on with the patrol watching — lose the heat first", null, true);
      }
    }
    if (!claimed) release();

    // ================= visuals: patient =================
    const pg = patientRef.current;
    if (pg) {
      const show = (J.medPhase === "pickup" || J.medPhase === "treat") && !!J.medSpot;
      pg.visible = show;
      if (show && J.medSpot) {
        pg.position.set(J.medSpot.x, 0.18 + Math.sin(t * 1.3) * 0.01, J.medSpot.z);
        patientRigs.forEach((rig, i) => { rig.group.visible = i === J.medPatient % patientRigs.length; });
      }
    }

    // ================= visuals: fire =================
    const fg = fireRef.current;
    const burning = (J.firePhase === "respond" || J.firePhase === "hose") && !!J.fireSpot;
    if (fg) {
      fg.visible = burning;
      if (burning && J.fireSpot) {
        fg.position.set(J.fireSpot.x, 0, J.fireSpot.z);
        const s = Math.max(0.02, J.fireSize);
        flameRefs.current.forEach((m, i) => {
          if (!m) return;
          const flick = 0.88 + 0.22 * Math.sin(t * (11 + i * 3.7) + i * 2.1);
          m.scale.set(s * (0.8 + i * 0.22), s * flick * (1.15 - i * 0.18), s * (0.8 + i * 0.22));
        });
        if (fireLight.current) {
          fireLight.current.intensity = s * (16 + 6 * Math.sin(t * 13.7));
          fireLight.current.position.set(J.fireSpot.x, 1.6, J.fireSpot.z);
        }
        smokeRefs.current.forEach((m, i) => {
          if (!m) return;
          const cyc = (t * 0.14 + i / smokeRefs.current.length) % 1;
          m.position.set(Math.sin(i * 2.4 + t * 0.4) * 0.5 * cyc * 3, 1.6 + cyc * 5.2, Math.cos(i * 1.9) * 0.4 * cyc * 3);
          const sc = (0.5 + cyc * 1.7) * (0.4 + s * 0.6);
          m.scale.set(sc, sc, sc);
        });
      }
    }

    // ================= visuals: hose water + steam =================
    const hosing = J.firePhase === "hose" && !!J.fireSpot && !G.driving && eHeld.current && J.fireWater > 0
      && dist(G.playerPos.x, G.playerPos.z, J.fireSpot.x, J.fireSpot.z) < 7;
    dropRefs.current.forEach((m, i) => {
      if (!m) return;
      m.visible = hosing;
      if (hosing && J.fireSpot) {
        const ph = (t * 1.7 + i / 10) % 1;
        const ox = G.playerPos.x, oz = G.playerPos.z;
        m.position.set(
          ox + (J.fireSpot.x - ox) * ph,
          1.15 + Math.sin(ph * Math.PI) * 2.1 - ph * 0.7,
          oz + (J.fireSpot.z - oz) * ph,
        );
      }
    });
    steamRefs.current.forEach((m, i) => {
      if (!m) return;
      m.visible = hosing;
      if (hosing && J.fireSpot) {
        const cyc = (t * 0.5 + i / 3) % 1;
        m.position.set(J.fireSpot.x + Math.sin(i * 2.2 + t) * 0.5, 0.4 + cyc * 1.5, J.fireSpot.z + Math.cos(i * 1.7) * 0.5);
        const sc = 0.4 + cyc * 1.1;
        m.scale.set(sc, sc, sc);
      }
    });

    // ================= beacons, siren, traffic courtesy =================
    const flash = (t * 2.4) % 1 < 0.5;
    const setBeacon = (grp: THREE.Group | null, car: typeof medCar, rMat: THREE.MeshStandardMaterial, bMat: THREE.MeshStandardMaterial) => {
      if (!grp) return;
      grp.visible = !!car;
      if (!car) return;
      grp.position.set(car.state.x, 0, car.state.z);
      grp.rotation.y = car.state.heading;
      rMat.emissiveIntensity = flash ? 3.4 : 0.15;
      bMat.emissiveIntensity = flash ? 0.15 : 3.4;
    };
    setBeacon(medBeacon.current, J.medPhase !== "idle" ? medCar : null, beaconMats.medR, beaconMats.medB);
    setBeacon(fireBeacon.current, (J.firePhase === "respond" || J.firePhase === "hose") ? fireCar : null, beaconMats.fireR, beaconMats.fireB);

    const medCall = J.medPhase !== "idle" && G.driving && G.activeCarId === J.medCarId && medCar && Math.abs(medCar.state.speed) > 1;
    const fireCall = (J.firePhase === "respond" || J.firePhase === "hose") && G.driving && G.activeCarId === J.fireCarId && fireCar && Math.abs(fireCar.state.speed) > 1;
    setJobSiren(!!(medCall || fireCall));
    if ((medCall || fireCall) && t - courtesyAt.current > 0.4) {
      courtesyAt.current = t;
      const car = medCall ? medCar : fireCar;
      if (car) {
        const sh = Math.sin(car.state.heading), ch = Math.cos(car.state.heading);
        for (const tc of G.traffic) {
          if (tc.dormant || tc.dispatch || tc.svc || tc.busRoute || tc.parked || tc.damage >= 100) continue;
          const dx = tc.x - car.state.x, dz = tc.z - car.state.z;
          const ahead = dx * sh + dz * ch;
          const lateral = dx * ch - dz * sh;
          if (ahead > 1.5 && ahead < 12 && Math.abs(lateral) < 2.6) tc.hornPull = 2;
        }
      }
    }
  });

  return (
    <group>
      {/* the patient: a lying figure at the spot (the wrapper lies
          the rig on its back; the rig cycles by patient index) */}
      <group ref={patientRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        {patientRigs.map((rig, i) => <primitive key={i} object={rig.group} />)}
      </group>
      {/* the fire: flickering flame cones + rising smoke (pools are
          fixed; scale/position are driven per frame) */}
      <group ref={fireRef} visible={false}>
        {[0, 1, 2].map((i) => (
          <mesh key={`f${i}`} ref={(m) => { flameRefs.current[i] = m; }} position={[i === 1 ? 0.55 : i === 2 ? -0.5 : 0, 1.1, i === 2 ? 0.35 : 0]}>
            <coneGeometry args={[0.85, 2.6, 7]} />
            <meshStandardMaterial color={i === 0 ? "#ff7a26" : i === 1 ? "#ffa03c" : "#ff5a1a"} emissive={i === 0 ? "#ff6a1a" : "#ff8a2a"} emissiveIntensity={2.2} transparent opacity={0.92} roughness={0.6} />
          </mesh>
        ))}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh key={`s${i}`} ref={(m) => { smokeRefs.current[i] = m; }}>
            <sphereGeometry args={[0.55, 8, 6]} />
            <primitive object={smokeMat} attach="material" />
          </mesh>
        ))}
      </group>
      <pointLight ref={fireLight} color="#ff8a3c" intensity={0} distance={11} decay={1.6} />
      {/* hose water: recycled droplets on a parabola; steam at the base */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <mesh key={`d${i}`} ref={(m) => { dropRefs.current[i] = m; }} visible={false}>
          <sphereGeometry args={[0.09, 6, 5]} />
          <primitive object={dropMat} attach="material" />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh key={`st${i}`} ref={(m) => { steamRefs.current[i] = m; }} visible={false}>
          <sphereGeometry args={[0.5, 8, 6]} />
          <primitive object={steamMat} attach="material" />
        </mesh>
      ))}
      {/* beacons: red/blue pair riding each unit's lightbar */}
      <group ref={medBeacon} visible={false}>
        <mesh position={[-0.32, 1.62, 0.9]}><boxGeometry args={[0.34, 0.13, 0.4]} /><primitive object={beaconMats.medR} attach="material" /></mesh>
        <mesh position={[0.32, 1.62, 0.9]}><boxGeometry args={[0.34, 0.13, 0.4]} /><primitive object={beaconMats.medB} attach="material" /></mesh>
      </group>
      <group ref={fireBeacon} visible={false}>
        <mesh position={[-0.32, 1.76, 1.35]}><boxGeometry args={[0.34, 0.13, 0.4]} /><primitive object={beaconMats.fireR} attach="material" /></mesh>
        <mesh position={[0.32, 1.76, 1.35]}><boxGeometry args={[0.34, 0.13, 0.4]} /><primitive object={beaconMats.fireB} attach="material" /></mesh>
      </group>
    </group>
  );
}
